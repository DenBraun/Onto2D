import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules", "runs"]);

async function collectFiles(directory, predicate) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(absolutePath, predicate));
    if (entry.isFile() && predicate(absolutePath)) result.push(absolutePath);
  }

  return result;
}

export async function run() {
  const sourceFiles = await collectFiles(
    REPOSITORY_ROOT,
    (file) => /\.(?:cjs|js|mjs)$/.test(file)
  );
  const jsonFiles = await collectFiles(
    REPOSITORY_ROOT,
    (file) => file.endsWith(".json")
  );
  const failures = [];

  for (const file of sourceFiles.sort()) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      failures.push(`${path.relative(REPOSITORY_ROOT, file)}\n${result.stderr || result.stdout}`);
    }
  }

  for (const file of jsonFiles.sort()) {
    try {
      JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      failures.push(`${path.relative(REPOSITORY_ROOT, file)}\n${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Source validation failed:\n\n${failures.join("\n\n")}`);
  }

  console.log(`Source check passed: ${sourceFiles.length} JavaScript files and ${jsonFiles.length} JSON files.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
