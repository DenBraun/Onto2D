import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "packages");
const REPOSITORY_URL = "git+https://github.com/DenBraun/Onto2D.git";
const BUGS_URL = "https://github.com/DenBraun/Onto2D/issues";
const REQUIRED_PACKAGE_FILES = Object.freeze(["src", "README.md", "LICENSE"]);

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
  const lockManifest = JSON.parse(await readFile(path.join(REPOSITORY_ROOT, "package-lock.json"), "utf8"));
  const rootLicense = await readFile(path.join(REPOSITORY_ROOT, "LICENSE"), "utf8");
  const packageDirectories = (await readdir(PACKAGE_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PACKAGE_ROOT, entry.name))
    .sort();
  const names = new Map();
  const failures = [];

  if (!rootManifest.private) failures.push("root package must remain private");
  if (!rootManifest.workspaces?.includes("packages/*")) failures.push("root workspaces must include packages/*");
  if (lockManifest.packages?.[""]?.version !== rootManifest.version) {
    failures.push("root package version differs from package-lock.json");
  }

  for (const directory of packageDirectories) {
    const repositoryDirectory = path.relative(REPOSITORY_ROOT, directory)
      .replaceAll(path.win32.sep, path.posix.sep);
    const manifestFile = path.join(directory, "package.json");
    if (!await exists(manifestFile)) {
      failures.push(`${path.relative(REPOSITORY_ROOT, directory)}: missing package.json`);
      continue;
    }
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    if (!manifest.name?.startsWith("@onto2d/")) failures.push(`${manifestFile}: package name must use @onto2d scope`);
    if (names.has(manifest.name)) failures.push(`${manifest.name}: duplicate package name`);
    names.set(manifest.name, directory);
    if (manifest.version !== rootManifest.version) {
      failures.push(`${manifest.name}: version must match the root release version`);
    }
    if (lockManifest.packages?.[repositoryDirectory]?.version !== manifest.version) {
      failures.push(`${manifest.name}: package version differs from package-lock.json`);
    }
    if (lockManifest.packages?.[repositoryDirectory]?.engines?.node !== manifest.engines?.node) {
      failures.push(`${manifest.name}: Node.js engine differs from package-lock.json`);
    }
    if (manifest.private === true) failures.push(`${manifest.name}: publishable package must not be private`);
    if (manifest.type !== "module") failures.push(`${manifest.name}: package type must be module`);
    if (manifest.license !== "MIT") failures.push(`${manifest.name}: package license must be MIT`);
    if (manifest.engines?.node !== ">=22") failures.push(`${manifest.name}: Node.js engine must be >=22`);
    if (manifest.sideEffects !== false) failures.push(`${manifest.name}: sideEffects must be false`);
    if (typeof manifest.types !== "string") failures.push(`${manifest.name}: TypeScript entrypoint is required`);
    for (const requiredFile of REQUIRED_PACKAGE_FILES) {
      if (!manifest.files?.includes(requiredFile)) {
        failures.push(`${manifest.name}: publish files must include ${requiredFile}`);
      }
      if (!await exists(path.join(directory, requiredFile))) {
        failures.push(`${manifest.name}: missing publish file ${requiredFile}`);
      }
    }
    if (
      await exists(path.join(directory, "LICENSE"))
      && await readFile(path.join(directory, "LICENSE"), "utf8") !== rootLicense
    ) {
      failures.push(`${manifest.name}: package license differs from the repository license`);
    }
    if (
      manifest.repository?.type !== "git"
      || manifest.repository.url !== REPOSITORY_URL
      || manifest.repository.directory !== repositoryDirectory
    ) {
      failures.push(`${manifest.name}: repository metadata is incomplete`);
    }
    if (manifest.bugs?.url !== BUGS_URL) failures.push(`${manifest.name}: bugs URL is missing`);
    if (manifest.publishConfig?.access !== "public") {
      failures.push(`${manifest.name}: scoped package publish access must be public`);
    }
    if (typeof manifest.homepage !== "string" || !manifest.homepage.startsWith("https://github.com/DenBraun/Onto2D/")) {
      failures.push(`${manifest.name}: homepage must point to the package in the repository`);
    }
    if (manifest.exports?.["."]?.types !== manifest.types) {
      failures.push(`${manifest.name}: root export must expose the declared TypeScript entrypoint`);
    }
    for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
      if (dependency.startsWith("@onto2d/") && version !== rootManifest.version) {
        failures.push(`${manifest.name}: ${dependency} must match the root release version`);
      }
    }

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
