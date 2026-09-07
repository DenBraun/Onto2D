import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/comparison/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/comparison/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/comparison/reference.py", "--verify-artifacts"]],
  // Reference replay runs above once; npm test also discovers its dedicated tests.
  [process.execPath, ["--test", "packages/structural-geometry/test/comparison.test.mjs",
    "packages/structural-geometry/test/comparison-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Strict comparison checks passed: independent split/merge controls, complete coverage, explicit missingness and portable replay.");
