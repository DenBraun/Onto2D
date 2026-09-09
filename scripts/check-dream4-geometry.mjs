import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url), directory = "cases/structural-geometry/dream4/";
const result = spawnSync(process.execPath, ["--test", ...["geometry", "evaluation", "population", "report"].map(name => `${directory}${name}.test.mjs`)],
  { cwd: fileURLToPath(root), stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("DREAM4 pilot bindings, report arithmetic and synthetic controls verified; full source/model replay is explicit.");
