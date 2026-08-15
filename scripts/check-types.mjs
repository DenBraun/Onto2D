import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPESCRIPT_CLI = path.join(REPOSITORY_ROOT, "node_modules", "typescript", "bin", "tsc");
const TYPE_SMOKE = path.join(REPOSITORY_ROOT, "test", "fixtures", "published-types-smoke.ts");

export function run() {
  const result = spawnSync(process.execPath, [
    TYPESCRIPT_CLI,
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "false",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--lib",
    "ES2022,DOM",
    TYPE_SMOKE
  ], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`TypeScript declaration check failed:\n${result.stderr || result.stdout}`);
  }
  console.log("TypeScript declaration check passed for all published workspaces.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
