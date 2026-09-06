import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["cases/structural-geometry/experiments/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/experiments/build.mjs", "--verify"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/experiments.test.mjs", "packages/structural-geometry/test/experiment-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Stage-three checks passed: full suite replay, source audit, interval reference and typed selections.");
