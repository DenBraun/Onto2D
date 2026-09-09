import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = "cases/structural-geometry/robustness/metric/";
const result = spawnSync(process.execPath, ["--test", ...["metric", "evaluation", "report"].map(name => `${directory}${name}.test.mjs`)],
  { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Metric sensitivity checks passed: independent control fixtures, fixed populations, exact scale invariance and report metrics; full biological replay requires the pinned NetworkX environment.");
