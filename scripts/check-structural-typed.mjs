import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/typed/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/typed/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/typed/reference.py", "--verify-artifacts"]],
  // Reference/census tests run above once; npm test also discovers them by name.
  [process.execPath, ["--test", "packages/structural-geometry/test/typed.test.mjs",
    "packages/structural-geometry/test/typed-vocabulary.test.mjs", "packages/structural-geometry/test/typed-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Typed checks passed: joint-field matching, independent permutations, explicit vocabulary authority, portable contracts and legacy replay.");
