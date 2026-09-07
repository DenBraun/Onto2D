import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/invariance/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/invariance/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/invariance/reference.py", "--verify-artifacts"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/invariance.test.mjs", "packages/structural-geometry/test/invariance-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Invariance checks passed: fixed registry, measured controls, independent orbits, strict missingness, portable replay and legacy compatibility.");
