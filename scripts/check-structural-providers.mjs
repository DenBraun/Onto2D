import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args] of [
  ["python3", ["-B", "docs/structural-geometry/baselines/verify_baseline.py", "--compatibility"]],
  [process.execPath, ["cases/structural-geometry/providers/build.mjs", "--verify"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/providers.test.mjs", "packages/structural-geometry/test/provider-contracts.test.mjs"]]
]) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Metric provider checks passed: exact legacy replay, full-source context, capabilities and portable contracts.");
