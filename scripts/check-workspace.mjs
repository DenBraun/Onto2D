import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "packages");

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function exportTargets(exportsField) {
  const targets = [];
  const visit = (value) => {
    if (typeof value === "string") targets.push(value);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(exportsField);
  return targets.filter((target) => !target.includes("*"));
}

export async function run() {
  const rootManifest = JSON.parse(await readFile(path.join(REPOSITORY_ROOT, "package.json"), "utf8"));
  const packageDirectories = (await readdir(PACKAGE_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PACKAGE_ROOT, entry.name))
    .sort();
  const names = new Map();
  const failures = [];

  if (!rootManifest.private) failures.push("root package must remain private");
  if (!rootManifest.workspaces?.includes("packages/*")) failures.push("root workspaces must include packages/*");

  for (const directory of packageDirectories) {
    const manifestFile = path.join(directory, "package.json");
    if (!await exists(manifestFile)) {
      failures.push(`${path.relative(REPOSITORY_ROOT, directory)}: missing package.json`);
      continue;
    }
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    if (!manifest.name?.startsWith("@onto2d/")) failures.push(`${manifestFile}: package name must use @onto2d scope`);
    if (names.has(manifest.name)) failures.push(`${manifest.name}: duplicate package name`);
    names.set(manifest.name, directory);

    for (const target of exportTargets(manifest.exports)) {
      if (!target.startsWith("./")) {
        failures.push(`${manifest.name}: export target must be relative: ${target}`);
      } else if (!await exists(path.resolve(directory, target))) {
        failures.push(`${manifest.name}: missing export target ${target}`);
      }
    }
  }

  const kernelManifest = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "kernel", "package.json"), "utf8"));
  const kernelDependencies = {
    ...kernelManifest.dependencies,
    ...kernelManifest.optionalDependencies,
    ...kernelManifest.peerDependencies
  };
  if (Object.keys(kernelDependencies).length > 0) {
    failures.push("@onto2d/kernel must remain dependency-free at the repository boundary");
  }

  if (failures.length > 0) {
    throw new Error(`Workspace validation failed:\n${failures.join("\n")}`);
  }

  console.log(`Workspace check passed: ${packageDirectories.length} packages with valid export boundaries.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
