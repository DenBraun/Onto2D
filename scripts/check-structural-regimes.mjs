import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  [process.execPath, ["cases/structural-geometry/regimes/build.mjs", "--verify"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/regimes.test.mjs", "packages/structural-geometry/test/regime-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Regime contracts passed: content-bound profiles, source/scope replay, bounded preparation and portable APIs; comparison evaluators remain pending.");
