import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildModelPack } from "@onto2d/model-pack";
import {
  CLI_EXIT_CODES,
  CLI_OUTPUT_SCHEMA_VERSION,
  CLI_VERSION,
  runCli
} from "../src/index.js";
import { parseCliArguments } from "../src/parser.js";
import {
  createZip,
  modelPackZipEntries
} from "../../model-pack/test/zip-fixture.mjs";

const BIN_PATH = fileURLToPath(new URL("../src/bin.js", import.meta.url));
const PACKAGE_PATH = fileURLToPath(new URL("../package.json", import.meta.url));
const SOURCE_HASH = `sha256:${"a".repeat(64)}`;

let temporaryRoot;
let packDirectory;
let packArchive;
let tamperedDirectory;

function fixturePack() {
  return buildModelPack({
    model: { id: "cli-fixture", name: "CLI Fixture", version: "1.0.0" },
    source: {
      id: "cli-fixture-source",
      files: [{ path: "source/model.json", hash: SOURCE_HASH }]
    },
    nodes: [
      { id: "a", name: "Alpha", level: 0 },
      { id: "b", name: "Beta", level: 1 },
      { id: "c", name: "Gamma", level: 2 },
      { id: "d", name: "Delta", level: 1 }
    ],
    edges: [
      { id: "a-b", source: "a", target: "b", relationLayer: "source-parent" },
      { id: "b-c", source: "b", target: "c", relationLayer: "source-parent" },
      { id: "a-d", source: "a", target: "d", relationLayer: "auxiliary" }
    ],
    dictionaries: { relationLayers: ["auxiliary", "source-parent"] }
  });
}

async function writePack(directory, pack) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(pack.manifest)}\n`, "utf8");
  for (const [relative, value] of Object.entries(pack.files)) {
    const file = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(value)}\n`, "utf8");
  }
}

function capture() {
  const chunks = [];
  return {
    stream: { write(chunk) { chunks.push(String(chunk)); } },
    text() { return chunks.join(""); }
  };
}

async function invoke(argv) {
  const stdout = capture();
  const stderr = capture();
  const exitCode = await runCli(argv, {
    cwd: temporaryRoot,
    stdout: stdout.stream,
    stderr: stderr.stream
  });
  return { exitCode, stdout: stdout.text(), stderr: stderr.text() };
}

function success(result) {
  assert.equal(result.exitCode, CLI_EXIT_CODES.success);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.schemaVersion, CLI_OUTPUT_SCHEMA_VERSION);
  assert.equal(output.cliVersion, CLI_VERSION);
  assert.equal(output.ok, true);
  return output;
}

before(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "onto2d-cli-test-"));
  packDirectory = path.join(temporaryRoot, "pack");
  packArchive = path.join(temporaryRoot, "pack.onto2d.zip");
  tamperedDirectory = path.join(temporaryRoot, "tampered-pack");
  const pack = fixturePack();
  await writePack(packDirectory, pack);
  await writeFile(packArchive, createZip(modelPackZipEntries(pack)).bytes);
  await writePack(tamperedDirectory, pack);
  const tamperedNodes = structuredClone(pack.files["model/nodes.json"]);
  tamperedNodes[0].name = "Altered without rebuilding the pack";
  await writeFile(
    path.join(tamperedDirectory, "model", "nodes.json"),
    `${JSON.stringify(tamperedNodes)}\n`,
    "utf8"
  );
});

after(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

test("help and version are static and side-effect free", async () => {
  const help = await invoke(["--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /^Onto2D CLI\n/);
  assert.equal(help.stderr, "");

  const version = await invoke(["--version"]);
  assert.equal(version.exitCode, 0);
  assert.equal(version.stdout, `${CLI_VERSION}\n`);
  assert.equal(version.stderr, "");
});

test("verify emits the exact verified release identity", async () => {
  const output = success(await invoke(["verify", "pack"]));
  assert.equal(output.command, "verify");
  assert.equal(output.result.verified, true);
  assert.equal(output.result.release.model.id, "cli-fixture");
  assert.equal(output.result.release.model.version, "1.0.0");
  assert.deepEqual(output.result.release.statistics, { edgeCount: 3, nodeCount: 4 });
  assert.match(output.result.release.identity.rootHash, /^sha256:[a-f0-9]{64}$/);

  const archived = success(await invoke(["verify", "pack.onto2d.zip"]));
  assert.deepEqual(archived.result, output.result);
});

test("node returns the source record and deterministic direct adjacency", async () => {
  const output = success(await invoke(["node", "pack", "b"]));
  assert.equal(output.command, "node");
  assert.deepEqual(output.result.node, { id: "b", level: 1, name: "Beta" });
  assert.deepEqual(output.result.adjacent, { parents: ["a"], children: ["c"] });

  const archived = success(await invoke(["node", "pack.onto2d.zip", "b"]));
  assert.deepEqual(archived.result, output.result);
});

test("neighborhood applies bounded direction, depth, and edge selectors", async () => {
  const output = success(await invoke([
    "neighborhood",
    "pack",
    "b",
    "--selector",
    "{\"relationLayer\":\"source-parent\"}",
    "--depth",
    "1",
    "--direction",
    "both"
  ]));
  assert.equal(output.command, "neighborhood");
  assert.deepEqual(output.result.nodes.map((node) => node.id), ["a", "b", "c"]);
  assert.deepEqual(output.result.edges.map((edge) => edge.id), ["a-b", "b-c"]);
  assert.deepEqual(output.result.distance, [["a", 1], ["b", 0], ["c", 1]]);
  assert.deepEqual(output.result.options, {
    depth: 1,
    direction: "both",
    selector: { relationLayer: "source-parent" }
  });
});

test("paths returns every bounded shortest path under the declared selector", async () => {
  const output = success(await invoke([
    "paths",
    "pack",
    "a",
    "c",
    "--maximum-paths",
    "4",
    "--selector",
    "{\"relationLayer\":\"source-parent\"}"
  ]));
  assert.equal(output.command, "paths");
  assert.equal(output.result.pathCount, 1);
  assert.equal(output.result.shortestLength, 2);
  assert.deepEqual(output.result.paths, [["a", "b", "c"]]);
});

test("usage and verified-data failures use distinct stable exit codes", async () => {
  const usage = await invoke(["neighborhood", "pack", "b", "--depth", "65"]);
  assert.equal(usage.exitCode, CLI_EXIT_CODES.usage);
  assert.equal(usage.stdout, "");
  assert.equal(JSON.parse(usage.stderr).command, "neighborhood");
  assert.equal(JSON.parse(usage.stderr).error.code, "CLI_OPTION_INVALID");

  const data = await invoke(["node", "pack", "missing"]);
  assert.equal(data.exitCode, CLI_EXIT_CODES.data);
  assert.equal(data.stdout, "");
  assert.equal(JSON.parse(data.stderr).error.code, "ENGINE_MODEL_NODE_MISSING");

  const unavailable = await invoke(["verify", "absent"]);
  assert.equal(unavailable.exitCode, CLI_EXIT_CODES.data);
  assert.equal(JSON.parse(unavailable.stderr).error.code, "MODEL_PACK_SOURCE_UNAVAILABLE");

  const tampered = await invoke(["verify", "tampered-pack"]);
  assert.equal(tampered.exitCode, CLI_EXIT_CODES.data);
  assert.equal(JSON.parse(tampered.stderr).error.code, "MODEL_PACK_VERIFICATION_FAILED");
});

test("selectors reject malformed, non-finite, prototype-sensitive, and excessive input", async () => {
  const invalidSelectors = [
    "{",
    "{\"weight\":1e400}",
    "{\"__proto__\":{}}"
  ];
  let nested = "0";
  for (let depth = 0; depth < 66; depth += 1) nested = `{\"value\":${nested}}`;
  invalidSelectors.push(nested);

  for (const selector of invalidSelectors) {
    const result = await invoke(["neighborhood", "pack", "b", "--selector", selector]);
    assert.equal(result.exitCode, CLI_EXIT_CODES.usage);
    assert.equal(JSON.parse(result.stderr).error.code, "CLI_OPTION_INVALID");
  }
});

test("argument arrays reject accessors without invoking them", () => {
  let reads = 0;
  const argv = ["--help"];
  Object.defineProperty(argv, "0", {
    enumerable: true,
    get() {
      reads += 1;
      return "--help";
    }
  });
  assert.throws(
    () => parseCliArguments(argv),
    (error) => error.code === "CLI_ARGUMENTS_INVALID"
  );
  assert.equal(reads, 0);
});

test("the packaged bin executes the same JSON contract", () => {
  const result = spawnSync(process.execPath, [BIN_PATH, "verify", packDirectory], {
    cwd: temporaryRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.command, "verify");
  assert.equal(output.result.release.model.id, "cli-fixture");

  const archived = spawnSync(process.execPath, [BIN_PATH, "verify", packArchive], {
    cwd: temporaryRoot,
    encoding: "utf8"
  });
  assert.equal(archived.status, 0, archived.stderr);
  assert.equal(JSON.parse(archived.stdout).result.release.model.id, "cli-fixture");
});

test("the package exposes the onto2d bin and no kernel dependency", async () => {
  const manifest = JSON.parse(await readFile(PACKAGE_PATH, "utf8"));
  const source = await readFile(new URL("../src/commands.js", import.meta.url), "utf8");
  assert.deepEqual(manifest.bin, { onto2d: "./src/bin.js" });
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    "@onto2d/engine",
    "@onto2d/model-pack"
  ]);
  assert.doesNotMatch(source, /@onto2d\/kernel|packages\/kernel/);
  assert.doesNotMatch(source, /node:fs|writeFile|appendFile|mkdir/);
});
