import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const commands = [
  [process.execPath, ["--test", "cases/structural-geometry/datasets/datasets.test.mjs", "cases/structural-geometry/datasets/applicability.test.mjs"]],
  [process.execPath, ["scripts/check-biological-protocol.mjs"]],
  [process.execPath, ["scripts/check-dream4-geometry.mjs"]],
  [process.execPath, ["scripts/check-celegans-geometry.mjs"]],
  [process.execPath, ["scripts/check-biological-robustness.mjs"]],
  [process.execPath, ["scripts/check-biological-anatomy.mjs"]],
  [process.execPath, ["scripts/check-biological-capacity.mjs"]],
  [process.execPath, ["scripts/check-biological-metric.mjs"]],
  [process.execPath, ["scripts/check-biological-scope.mjs"]],
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
  [process.execPath, ["scripts/check-structural-comparison.mjs"]],
  [process.execPath, ["scripts/check-structural-sandbox.mjs"]],
  [process.execPath, ["scripts/check-structural-invariance.mjs"]],
  [process.execPath, ["scripts/check-structural-responses.mjs"]],
  [process.execPath, ["scripts/check-structural-signature.mjs"]],
  [process.execPath, ["scripts/check-structural-pseudometric.mjs"]],
  [process.execPath, ["scripts/check-geometric-signature.mjs"]],
  [process.execPath, ["scripts/check-geometric-added-value.mjs"]],
  [process.execPath, ["scripts/check-structural-ollivier.mjs"]],
  [process.execPath, ["scripts/check-structural-flow.mjs"]]
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Structural geometry checks passed: exact replay, separate incidence reference and public contracts.");
