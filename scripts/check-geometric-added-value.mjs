import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/added-value/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/added-value/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/added-value/reference.py", "--verify-artifacts"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/added-value.test.mjs", "packages/structural-geometry/test/added-value-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Geometric added-value checks passed: prospective source plan, matched coverage, exact paired outcomes, independent baselines and preserved zero gain.");
