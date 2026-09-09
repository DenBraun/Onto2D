import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = "cases/structural-geometry/robustness/";
const tests = ["nulls", "study", "report"].map(name => `${directory}${name}.test.mjs`);
const result = spawnSync(process.execPath, ["--test", ...tests], { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Biological degree-null checks passed: all index/source/report bindings, complete coverage, independent sampler and synthetic model controls; full 32-index replay is explicit.");
