import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules", "runs"]);

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const tests = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) tests.push(...await collectTests(absolutePath));
    if (entry.isFile() && /\.test\.(?:cjs|js|mjs)$/.test(entry.name)) tests.push(absolutePath);
  }
  return tests;
}

const scope = process.argv[2] ? path.resolve(REPOSITORY_ROOT, process.argv[2]) : REPOSITORY_ROOT;
const tests = (await collectTests(scope)).sort();
if (tests.length === 0) {
  console.error(`No tests found under ${path.relative(REPOSITORY_ROOT, scope) || "."}.`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: REPOSITORY_ROOT,
  stdio: "inherit"
});
process.exit(result.status ?? 1);
