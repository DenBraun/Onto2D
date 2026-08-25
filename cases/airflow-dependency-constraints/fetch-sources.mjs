import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_ROOT = path.join(CASE_ROOT, "sources");
const SOURCE_LOCK = path.join(SOURCES_ROOT, "source-lock.json");
const SOURCE_IDENTITY_DOMAIN = "onto2d:airflow-constraint-source-lock:v1";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function fail(message) {
  throw new Error(`Airflow constraint source fetch failed: ${message}`);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizedProject(value) {
  return value.toLowerCase().replace(/[_.]+/g, "-");
}

async function responseBytes(url) {
  const response = await fetch(url, {
    headers: { accept: url.includes("pypi.org") ? "application/json" : "text/plain" },
    redirect: "error"
  });
  if (!response.ok) fail(`${url} returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_RESPONSE_BYTES) fail(`${url} returned an invalid byte count`);
  return bytes;
}

function lockEntry(relativePath, url, bytes) {
  return { path: relativePath, url, size: bytes.length, sha256: sha256(bytes) };
}

async function buildSourceLock() {
  const spec = JSON.parse(await readFile(path.join(CASE_ROOT, "source-spec.json"), "utf8"));
  const files = [];
  const constraintBytes = await responseBytes(spec.constraint.url);
  await mkdir(SOURCES_ROOT, { recursive: true });
  await writeFile(path.join(SOURCES_ROOT, spec.constraint.path), constraintBytes);
  files.push(lockEntry(spec.constraint.path, spec.constraint.url, constraintBytes));

  for (const release of spec.pypiReleases) {
    const project = normalizedProject(release.project);
    const relativePath = `pypi/${project}-${release.version}.json`;
    const url = `https://pypi.org/pypi/${encodeURIComponent(release.project)}/${encodeURIComponent(release.version)}/json`;
    const bytes = await responseBytes(url);
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    await mkdir(path.join(SOURCES_ROOT, "pypi"), { recursive: true });
    await writeFile(path.join(SOURCES_ROOT, relativePath), bytes);
    files.push(lockEntry(relativePath, url, bytes));
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  const basis = {
    format: "onto2d-airflow-constraint-source-lock",
    formatVersion: "1",
    capturedAt: spec.capturedAt,
    sourceSpec: "source-spec.json",
    files
  };
  return { ...basis, identity: hashCanonical(SOURCE_IDENTITY_DOMAIN, basis) };
}

async function verifySourceLock() {
  const lock = JSON.parse(await readFile(SOURCE_LOCK, "utf8"));
  const { identity, ...basis } = lock;
  if (hashCanonical(SOURCE_IDENTITY_DOMAIN, basis) !== identity) fail("source-lock identity is invalid");
  for (const entry of lock.files) {
    const bytes = await readFile(path.join(SOURCES_ROOT, entry.path));
    if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) fail(`${entry.path} differs from its source lock`);
  }
  return lock;
}

async function main(argv) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--verify")) fail("only --verify is supported");
  if (argv[0] === "--verify") {
    const lock = await verifySourceLock();
    console.log(`Verified ${lock.files.length} Airflow constraint source files.`);
    return;
  }
  const lock = await buildSourceLock();
  await writeFile(SOURCE_LOCK, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  console.log(`Wrote ${SOURCE_LOCK} with ${lock.files.length} files.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
