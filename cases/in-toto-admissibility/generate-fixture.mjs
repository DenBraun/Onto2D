import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { artifactHash, fixtureKey, signMetadata } from "./src/metadata.mjs";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(CASE_ROOT, "fixtures");

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function link(name, command, materials, products) {
  return {
    _type: "link",
    name,
    materials,
    products,
    command,
    byproducts: { stderr: "", stdout: "", "return-value": 0 },
    environment: { variables: {}, filesystem: {}, workdir: "." }
  };
}

function buildLayout(spec, keys) {
  const source = spec.artifacts.sourcePath;
  const built = spec.artifacts.buildPath;
  const final = spec.artifacts.finalPath;
  return {
    _type: "layout",
    expires: spec.profile.layoutExpires,
    readme: "Onto2D deterministic in-toto v1.0 admissibility fixture; fixture keys are non-secret test material.",
    keys: {
      [keys.builder.keyid]: keys.builder.publicKey,
      [keys.packager.keyid]: keys.packager.publicKey
    },
    steps: [
      {
        _type: "step",
        name: "build",
        expected_materials: [["REQUIRE", source], ["ALLOW", source], ["DISALLOW", "*"]],
        expected_products: [["REQUIRE", built], ["CREATE", built], ["DISALLOW", "*"]],
        pubkeys: [keys.builder.keyid],
        expected_command: spec.commands.build,
        threshold: 1
      },
      {
        _type: "step",
        name: "package",
        expected_materials: [["REQUIRE", built], ["MATCH", built, "WITH", "PRODUCTS", "FROM", "build"], ["DISALLOW", "*"]],
        expected_products: [["REQUIRE", final], ["CREATE", final], ["DISALLOW", "*"]],
        pubkeys: [keys.packager.keyid],
        expected_command: spec.commands.package,
        threshold: 1
      }
    ],
    inspect: [{
      _type: "inspection",
      name: "final-product",
      expected_materials: [["REQUIRE", final], ["MATCH", final, "WITH", "PRODUCTS", "FROM", "package"], ["DISALLOW", "*"]],
      expected_products: [],
      run: spec.commands.inspection
    }]
  };
}

export async function buildInTotoFixture() {
  const spec = JSON.parse(await readFile(path.join(CASE_ROOT, "fixture-spec.json"), "utf8"));
  const keys = Object.fromEntries(Object.entries(spec.fixtureOnlyKeySeeds).map(([name, seed]) => [name, fixtureKey(seed)]));
  const sourceHash = artifactHash(Buffer.from(spec.artifacts.sourceUtf8, "utf8"));
  const finalHash = artifactHash(Buffer.from(spec.artifacts.finalUtf8, "utf8"));
  const wrongHash = artifactHash(Buffer.from("wrong intermediate bytes\n", "utf8"));
  const buildLink = link("build", spec.commands.build, { [spec.artifacts.sourcePath]: sourceHash }, { [spec.artifacts.buildPath]: finalHash });
  const packageLink = link("package", spec.commands.package, { [spec.artifacts.buildPath]: finalHash }, { [spec.artifacts.finalPath]: finalHash });
  const scenarios = {
    valid: [signMetadata(buildLink, keys.builder), signMetadata(packageLink, keys.packager)],
    shortcut: [signMetadata(link("package", ["node", "shortcut.mjs"], { [spec.artifacts.sourcePath]: sourceHash }, { [spec.artifacts.finalPath]: finalHash }), keys.packager)],
    "material-break": [signMetadata(buildLink, keys.builder), signMetadata(link("package", spec.commands.package, { [spec.artifacts.buildPath]: wrongHash }, { [spec.artifacts.finalPath]: finalHash }), keys.packager)],
    "unauthorized-actor": [signMetadata(buildLink, keys.builder), signMetadata(packageLink, keys.attacker)],
    "command-deviation": [signMetadata(buildLink, keys.builder), signMetadata(link("package", spec.commands.alternativePackage, { [spec.artifacts.buildPath]: finalHash }, { [spec.artifacts.finalPath]: finalHash }), keys.packager)]
  };
  return {
    files: {
      "root.layout": serialize(signMetadata(buildLayout(spec, keys), keys.owner)),
      "target/src/main.txt": spec.artifacts.sourceUtf8,
      "target/dist/app.bin": spec.artifacts.finalUtf8,
      "trusted-owner-key.json": serialize({ keyid: keys.owner.keyid, ...keys.owner.publicKey }),
      ...Object.fromEntries(spec.scenarioOrder.flatMap((scenario) => scenarios[scenario].map((record) => [`scenarios/${scenario}/${record.signed.name}.${record.signatures[0].keyid.slice(0, 12)}.link`, serialize(record)])))
    },
    keys: Object.fromEntries(Object.entries(keys).map(([name, value]) => [name, { keyid: value.keyid, publicKey: value.publicKey }])),
    scenarios
  };
}

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await collectFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

export async function generateInTotoFixture({ verify = false, fixtureRoot = FIXTURE_ROOT } = {}) {
  const fixture = await buildInTotoFixture();
  if (!verify) {
    for (const [relative, contents] of Object.entries(fixture.files)) {
      const target = path.join(fixtureRoot, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
  }
  assert.deepEqual(await collectFiles(fixtureRoot), Object.keys(fixture.files).sort(), "The in-toto fixture contains missing or unexpected files.");
  for (const [relative, contents] of Object.entries(fixture.files)) assert.equal(await readFile(path.join(fixtureRoot, relative), "utf8"), contents, `${relative} differs from the deterministic fixture`);
  return fixture;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  generateInTotoFixture({ verify: process.argv.includes("--verify") }).then(() => console.log(`${process.argv.includes("--verify") ? "Verified" : "Generated"} deterministic in-toto v1.0 fixture.`)).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
