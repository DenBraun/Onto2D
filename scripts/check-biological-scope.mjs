import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = "cases/structural-geometry/robustness/scope/";
const result = spawnSync(process.execPath, ["--test", ...["selection", "report"].map(name => `${directory}${name}.test.mjs`)],
  { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Scope coverage checks passed: exhaustive selections, parent degree bins, matched targets, unavailable outcomes and report metrics; full biological replay requires the pinned NetworkX environment.");
