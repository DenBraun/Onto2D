import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url), directory = "cases/structural-geometry/celegans/";
const tests = ["intake", "extract", "reference", "evaluation", "report"].map(name => `${directory}${name}.test.mjs`);
const result = spawnSync(process.execPath, ["--test", ...tests], { cwd: fileURLToPath(root), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("C. elegans source/coverage/score bindings, synthetic extraction and independent controls verified; native archive/model replay is explicit.");
