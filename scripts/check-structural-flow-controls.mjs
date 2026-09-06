import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "cases/structural-geometry/flow-controls/analytic_reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/flow-controls/build.mjs", "--verify"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/flow-controls.test.mjs"]],
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Supplemental flow checks passed: frozen star/bridge predictions, exact replay, NetworkX values and legacy compatibility.");
