import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
for (const args of [
  ["cases/structural-geometry/ollivier/build.mjs", "--verify"],
  ["--test", "packages/structural-geometry/test/ollivier.test.mjs", "packages/structural-geometry/test/ollivier-contracts.test.mjs"]
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Ollivier checks passed: source replay, exact optimality certificates, frozen NetworkX values and public contracts.");
