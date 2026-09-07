import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/responses/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/responses/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/responses/reference.py", "--verify-artifacts"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/responses.test.mjs",
    "packages/structural-geometry/test/responses-equivariance.test.mjs", "packages/structural-geometry/test/responses-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Response checks passed: exhaustive selectors, independent path/graph responses, strict coverage, transported histograms, portable replay and legacy compatibility.");
