import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/signatures/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/signatures/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/signatures/reference.py", "--verify-artifacts"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/signature.test.mjs",
    "packages/structural-geometry/test/signature-contracts.test.mjs", "packages/structural-geometry/test/signature-equivariance.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Signature checks passed: independent joint response features, strict eligibility, retained collisions, transported values and complete evidence replay.");
