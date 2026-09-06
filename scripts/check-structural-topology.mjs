import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  ["python3", ["-B", "cases/structural-geometry/topology/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/topology/build.mjs", "--verify"]],
  ["python3", ["-B", "cases/structural-geometry/topology/reference.py", "--verify-artifacts"]],
  // The builder and Python invocations cover the reference tests once here.
  // npm test also discovers the separate reference tests.
  [process.execPath, ["--test", "packages/structural-geometry/test/topology.test.mjs", "packages/structural-geometry/test/topology-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Topology checks passed: independent directed summaries, documented collisions, portable contracts and exact legacy compatibility.");
