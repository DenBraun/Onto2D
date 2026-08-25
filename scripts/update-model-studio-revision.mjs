import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { synchronizeModelStudioRevision } from "./public-module-revisions.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = path.join(REPOSITORY_ROOT, "apps", "model-studio", "index.html");
const APP_PATH = path.join(REPOSITORY_ROOT, "apps", "model-studio", "model-studio.js");
const revision = process.argv[2];

if (!revision || process.argv.length !== 3) {
  console.error("Usage: npm run revision:model-studio -- YYYYMMDD.N");
  process.exitCode = 1;
} else {
  try {
    const [indexSource, appSource] = await Promise.all([
      readFile(INDEX_PATH, "utf8"),
      readFile(APP_PATH, "utf8")
    ]);
    const updated = synchronizeModelStudioRevision(indexSource, appSource, revision);
    const writes = [];
    if (updated.indexSource !== indexSource) writes.push(writeFile(INDEX_PATH, updated.indexSource));
    if (updated.appSource !== appSource) writes.push(writeFile(APP_PATH, updated.appSource));
    await Promise.all(writes);
    console.log(
      writes.length === 0
        ? `Model Studio module graph is already aligned at ${revision}.`
        : `Model Studio module graph updated coherently to ${revision}.`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
