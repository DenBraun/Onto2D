import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { inspectModelStudioRevisionGraph } from "./public-module-revisions.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = path.join(REPOSITORY_ROOT, "apps", "model-studio", "index.html");
const APP_PATH = path.join(REPOSITORY_ROOT, "apps", "model-studio", "model-studio.js");

export async function run() {
  const [indexSource, appSource] = await Promise.all([
    readFile(INDEX_PATH, "utf8"),
    readFile(APP_PATH, "utf8")
  ]);
  const inspection = inspectModelStudioRevisionGraph(indexSource, appSource);
  if (inspection.errors.length > 0) {
    const revision = inspection.revision ?? "YYYYMMDD.N";
    throw new Error(
      `Public module revision check failed:\n- ${inspection.errors.join("\n- ")}\n\n`
      + `Run npm run revision:model-studio -- ${revision} to update the graph coherently.`
    );
  }
  console.log(
    `Public module revision check passed: Model Studio ${inspection.revision}, `
    + `${inspection.references.length} aligned dependencies.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
