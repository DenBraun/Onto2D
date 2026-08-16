import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createModelPackWorkerBundle,
  repositoryRoot,
  workerOutput
} from "./model-pack-worker-bundle.mjs";

const [expected, committed] = await Promise.all([
  createModelPackWorkerBundle(),
  readFile(path.join(repositoryRoot, workerOutput), "utf8").catch(() => null)
]);

if (committed !== expected) {
  throw new Error(`${workerOutput} differs from its source; run npm run build:worker.`);
}

console.log(`Worker bundle check passed: ${workerOutput} matches its source.`);
