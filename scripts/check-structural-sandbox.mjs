import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/sandbox/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/sandbox/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/sandbox/reference.py", "--verify-artifacts"]],
  // The reference/census replay runs above; npm test also discovers its dedicated tests.
  [process.execPath, ["--test", "packages/structural-geometry/test/sandbox.test.mjs",
    "packages/structural-geometry/test/sandbox-equivariance.test.mjs", "packages/structural-geometry/test/sandbox-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Sandbox checks passed: immutable targets, independent transformations, transported target sets, portable contracts and legacy replay.");
