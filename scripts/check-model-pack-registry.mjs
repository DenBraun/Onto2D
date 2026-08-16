import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  matchModelPackRegistryResolution,
  resolveModelPackRegistry
} from "../packages/model-pack/src/registry.js";
import { verifyModelPack } from "../packages/model-pack/src/index.js";

const registryFile = new URL("../models/registry.json", import.meta.url);
const registryUrl = "https://onto2d.dev/models/registry.json";
const studioFile = new URL("../apps/model-studio/model-studio.js", import.meta.url);

function fail(message) {
  throw new Error(`Model Pack registry check failed: ${message}`);
}

export async function run() {
  const registry = JSON.parse(await readFile(registryFile, "utf8"));
  if (!Array.isArray(registry.entries) || registry.entries.length === 0) {
    fail("models/registry.json has no release entries");
  }

  let registryHash = null;
  for (const entry of registry.entries) {
    const resolution = resolveModelPackRegistry(
      registry,
      registryUrl,
      { modelId: entry.modelId, version: entry.version }
    );
    registryHash ??= resolution.registryHash;
    if (resolution.registryHash !== registryHash) fail("resolution hashes differ");

    const packFile = new URL(`${entry.packPath}bundle.json`, registryFile);
    let pack;
    try {
      pack = verifyModelPack(JSON.parse(await readFile(packFile, "utf8")));
    } catch (error) {
      fail(`${fileURLToPath(packFile)} cannot be verified: ${error.message}`);
    }
    matchModelPackRegistryResolution(pack, resolution);
  }

  const studio = await readFile(studioFile, "utf8");
  const pinned = studio.match(/const EXPECTED_REGISTRY_HASH = "(sha256:[0-9a-f]{64})";/)?.[1];
  if (pinned !== registryHash) {
    fail("Model Studio registry pin is missing or stale");
  }

  console.log(
    `Registry check passed: ${registry.entries.length} exact release, pinned ${registryHash}.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
