import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/geometric-signatures/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/geometric-signatures/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/geometric-signatures/reference.py", "--verify-artifacts"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/geometric-signature.test.mjs",
    "packages/structural-geometry/test/geometric-signature-contracts.test.mjs", "packages/structural-geometry/test/geometric-signature-equivariance.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Geometric signature checks passed: certified intervals, exact extrema, fixed-horizon coverage, threshold events, independent references and source replay.");
