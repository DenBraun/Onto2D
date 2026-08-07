import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, [path.join(repositoryRoot, "scripts", "check.mjs")], {
  cwd: repositoryRoot,
  stdio: "inherit"
});

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Build validation passed: packages are published directly from checked source; no transpilation artifact is required.");
