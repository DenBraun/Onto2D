import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/canonical/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/canonical/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/canonical/reference.py", "--verify-artifacts"]],
  // The case builder above covers the exhaustive/reference tests; avoid running
  // the same census twice in this command. npm test discovers those tests too.
  [process.execPath, ["--test", "packages/structural-geometry/test/canonical.test.mjs", "packages/structural-geometry/test/canonical-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Canonical observation checks passed: independent graph partitions, source-bound witnesses, portable contracts and exact legacy compatibility.");
