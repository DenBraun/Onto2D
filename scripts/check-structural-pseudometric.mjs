import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/pseudometric/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/pseudometric/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/pseudometric/reference.py", "--verify-artifacts"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/pseudometric.test.mjs",
    "packages/structural-geometry/test/pseudometric-contracts.test.mjs", "packages/structural-geometry/test/pseudometric-equivariance.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Pseudometric checks passed: fixed domains, exact fractions, independent metric laws, strict missingness and authenticated evidence replay.");
