import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = "cases/structural-geometry/robustness/capacity/";
const result = spawnSync(process.execPath, ["--test", ...["features", "evaluation", "report"].map(name => `${directory}${name}.test.mjs`)],
  { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Graph capacity checks passed: independent feature/model controls, fixed target/source bindings, exact primary reproduction and prediction-derived report metrics; full replay is explicit.");
