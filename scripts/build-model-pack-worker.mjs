import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createModelPackWorkerBundle,
  repositoryRoot,
  workerOutput
} from "./model-pack-worker-bundle.mjs";

const output = await createModelPackWorkerBundle();
await writeFile(path.join(repositoryRoot, workerOutput), output, "utf8");
console.log(`Built ${workerOutput}.`);
