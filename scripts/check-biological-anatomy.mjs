import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = "cases/structural-geometry/robustness/anatomy/";
const result = spawnSync(process.execPath, ["--test", ...["study", "report"].map(name => `${directory}${name}.test.mjs`)],
  { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Adult anatomy sensitivity checks passed: source binding, native and shared populations, unavailable states, independent overlap controls and report arithmetic; full source/model replay is explicit.");
