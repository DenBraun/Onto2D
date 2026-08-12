import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  "check-source.mjs",
  "check-workspace.mjs",
  "check-schemas.mjs",
  "check-kernel-closure.mjs",
  "check-docs.mjs",
  "audit-catalogue.mjs"
];

for (const script of checks) {
  const args = [path.join(REPOSITORY_ROOT, "scripts", script)];
  if (script === "audit-catalogue.mjs") args.push("--verify");
  const result = spawnSync(process.execPath, args, {
    cwd: REPOSITORY_ROOT,
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("All repository checks passed.");
