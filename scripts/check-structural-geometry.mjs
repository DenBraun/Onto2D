import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const commands = [
  ["python3", ["cases/structural-geometry/synthetic/reference.py", "--verify"]],
  [process.execPath, ["cases/structural-geometry/build.mjs", "--verify"]],
  [process.execPath, ["--test", "packages/structural-geometry/test/geometry.test.mjs",
    "packages/structural-geometry/test/contracts.test.mjs"]],
  [process.execPath, ["scripts/check-structural-experiments.mjs"]],
  [process.execPath, ["scripts/check-structural-providers.mjs"]],
  [process.execPath, ["scripts/check-structural-regimes.mjs"]],
  [process.execPath, ["scripts/check-structural-canonical.mjs"]],
  [process.execPath, ["scripts/check-structural-topology.mjs"]],
  [process.execPath, ["scripts/check-structural-typed.mjs"]],
  [process.execPath, ["scripts/check-structural-ollivier.mjs"]],
  [process.execPath, ["scripts/check-structural-flow.mjs"]]
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Structural geometry checks passed: exact replay, separate incidence reference and public contracts.");
