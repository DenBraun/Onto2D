import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalize, hashArtifactBytes } from "@onto2d/kernel";
import {
  auditSourceCatalogue,
  loadSourceCatalogue
} from "@onto2d/catalog-adapter";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import {
  CAUSAL_EMERGENCE_MODEL_VERSION,
  compileCausalEmergenceModelPack
} from "./compiler.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_ROOT = path.join(REPOSITORY_ROOT, "scr");
const RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "models",
  "causal-emergence",
  "releases",
  CAUSAL_EMERGENCE_MODEL_VERSION
);
const encoder = new TextEncoder();

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function sourceFileReferences(levelFiles) {
  const names = [...levelFiles, "descriptions.json", "arising-schema.json"];
  return Promise.all(names.map(async (name) => {
    const bytes = new Uint8Array(await readFile(path.join(SOURCE_ROOT, name)));
    return {
      path: `scr/${name}`,
      hash: hashArtifactBytes(bytes)
    };
  }));
}

export async function buildCausalEmergenceRelease() {
  const catalogue = await loadSourceCatalogue({ catalogueDirectory: SOURCE_ROOT });
  const audit = auditSourceCatalogue(catalogue);
  return compileCausalEmergenceModelPack({
    catalogue,
    audit,
    sourceFiles: await sourceFileReferences(catalogue.levelFiles)
  });
}

async function collectReleaseFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await collectReleaseFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

function expectedFiles(pack) {
  return ["bundle.json", "manifest.json", ...Object.keys(pack.files)].sort();
}

export async function writeCausalEmergenceRelease(pack) {
  verifyModelPack(pack);
  await mkdir(RELEASE_ROOT, { recursive: true });
  await writeFile(path.join(RELEASE_ROOT, "manifest.json"), serialize(pack.manifest));
  for (const [relative, value] of Object.entries(pack.files)) {
    const target = path.join(RELEASE_ROOT, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, serialize(value));
  }
  await writeFile(path.join(RELEASE_ROOT, "bundle.json"), serialize(pack));
}

export async function verifyCausalEmergenceRelease(expectedPack) {
  assert.deepEqual(
    await collectReleaseFiles(RELEASE_ROOT),
    expectedFiles(expectedPack),
    "The release contains missing or unexpected files."
  );
  const manifest = JSON.parse(await readFile(path.join(RELEASE_ROOT, "manifest.json"), "utf8"));
  const files = {};
  for (const relative of Object.values(modelPackFilePaths())) {
    files[relative] = JSON.parse(await readFile(path.join(RELEASE_ROOT, relative), "utf8"));
  }
  const stored = verifyModelPack({ manifest, files });
  const bundleText = await readFile(path.join(RELEASE_ROOT, "bundle.json"), "utf8");
  const bundle = verifyModelPack(JSON.parse(bundleText));
  assert.equal(canonicalize(stored), canonicalize(expectedPack));
  assert.equal(canonicalize(bundle), canonicalize(expectedPack));
  assert.equal(bundleText, serialize(expectedPack), "The convenience bundle is not deterministic.");
  return stored;
}

export async function run({ verify = false } = {}) {
  const pack = await buildCausalEmergenceRelease();
  if (!verify) await writeCausalEmergenceRelease(pack);
  await verifyCausalEmergenceRelease(pack);
  console.log(
    `${verify ? "Verified" : "Built"} Causal Emergence Model Pack ` +
    `${pack.manifest.model.version}: ${pack.manifest.statistics.nodeCount} nodes, ` +
    `${pack.manifest.statistics.edgeCount} edges, ${pack.manifest.rootHash}`
  );
  return pack;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify") }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
