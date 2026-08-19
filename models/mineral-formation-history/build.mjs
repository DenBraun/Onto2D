import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalize } from "@onto2d/kernel";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { buildMineralFormationHistoryCase } from "../../cases/mineral-formation-history/extract.mjs";
import { compileMineralFormationHistoryModelPack } from "./compiler.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const serialize = (value) => `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`;

async function collectFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await collectFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

export async function buildMineralFormationHistoryRelease() { return compileMineralFormationHistoryModelPack(await buildMineralFormationHistoryCase()); }

export async function writeMineralFormationHistoryRelease(pack) {
  verifyModelPack(pack);
  const releaseRoot = path.join(ROOT, "releases", pack.manifest.model.version);
  await mkdir(releaseRoot, { recursive: true });
  await writeFile(path.join(releaseRoot, "manifest.json"), serialize(pack.manifest));
  for (const [relative, value] of Object.entries(pack.files)) {
    const target = path.join(releaseRoot, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, serialize(value));
  }
  await writeFile(path.join(releaseRoot, "bundle.json"), serialize(pack));
  return releaseRoot;
}

export async function verifyMineralFormationHistoryRelease(expected) {
  const releaseRoot = path.join(ROOT, "releases", expected.manifest.model.version);
  assert.deepEqual(await collectFiles(releaseRoot), ["bundle.json", "manifest.json", ...Object.keys(expected.files)].sort());
  const manifest = JSON.parse(await readFile(path.join(releaseRoot, "manifest.json"), "utf8"));
  const files = {};
  for (const relative of Object.values(modelPackFilePaths())) files[relative] = JSON.parse(await readFile(path.join(releaseRoot, relative), "utf8"));
  const split = verifyModelPack({ manifest, files });
  const bundleText = await readFile(path.join(releaseRoot, "bundle.json"), "utf8");
  const bundle = verifyModelPack(JSON.parse(bundleText));
  assert.equal(canonicalize(split), canonicalize(expected));
  assert.equal(canonicalize(bundle), canonicalize(expected));
  assert.equal(bundleText, serialize(expected));
  return split;
}

export async function run({ verify = false } = {}) {
  const pack = await buildMineralFormationHistoryRelease();
  if (!verify) await writeMineralFormationHistoryRelease(pack);
  await verifyMineralFormationHistoryRelease(pack);
  console.log(`${verify ? "Verified" : "Built"} Mineral Formation History Model Pack ${pack.manifest.model.version}: ${pack.manifest.statistics.nodeCount} nodes, ${pack.manifest.statistics.edgeCount} edges, ${pack.manifest.rootHash}`);
  return pack;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
