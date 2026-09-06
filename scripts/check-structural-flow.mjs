import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "cases/structural-geometry/flow/paper_reference.py"]],
  [process.execPath, ["cases/structural-geometry/flow/build.mjs", "--verify"]],
  [process.execPath, ["scripts/check-structural-flow-controls.mjs"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/flow.test.mjs", "packages/structural-geometry/test/flow-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Shadow flow checks passed: published recurrence, exact replay, frozen NetworkX values and public contracts.");
