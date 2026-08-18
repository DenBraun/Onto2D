import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DOMAIN = "onto2d:reproducible-build-source:v1";
const INSTRUCTIONS_DOMAIN = "onto2d:reproducible-build-instructions:v1";
const INPUT_DOMAIN = "onto2d:reproducible-build-declared-input:v1";
const HASH = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function fail(message) {
  throw new Error(`Reproducible Build fixture failed: ${message}`);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeRelativePath(value, label) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) {
    fail(`${label} must be a safe repository-relative path`);
  }
  return value;
}

function normalizedParameters(input, label = "parameters") {
  exactKeys(input, ["releaseChannel"], label);
  if (!IDENTIFIER.test(input.releaseChannel)) fail(`${label}.releaseChannel must be a normalized identifier`);
  return Object.freeze({ releaseChannel: input.releaseChannel });
}

export function validateBuildSpec(input) {
  const spec = structuredClone(input);
  exactKeys(spec, ["format", "formatVersion", "caseVersion", "artifact", "sourceFiles", "instructions", "parameters", "executions", "comparisons", "methodology"], "build spec");
  if (spec.format !== "onto2d-reproducible-build-fixture-spec" || spec.formatVersion !== "1" || spec.caseVersion !== "reproducible-build-equivalence-v1") fail("unsupported build specification");
  exactKeys(spec.artifact, ["path", "mediaType", "encoding", "lineEnding"], "artifact");
  safeRelativePath(spec.artifact.path, "artifact.path");
  if (spec.artifact.mediaType !== "text/plain" || spec.artifact.encoding !== "utf-8" || spec.artifact.lineEnding !== "LF") fail("v1 artifact contract differs");
  if (!Array.isArray(spec.sourceFiles) || spec.sourceFiles.length !== 3) fail("v1 requires exactly three build input files");
  const paths = new Set();
  for (const [index, source] of spec.sourceFiles.entries()) {
    exactKeys(source, ["path", "sha256", "bytes"], `sourceFiles[${index}]`);
    safeRelativePath(source.path, `sourceFiles[${index}].path`);
    if (paths.has(source.path)) fail(`source path ${source.path} is repeated`);
    paths.add(source.path);
    if (!HASH.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || source.bytes > 32 * 1024) fail(`sourceFiles[${index}] identity is invalid`);
  }
  if (JSON.stringify([...paths]) !== JSON.stringify([...paths].sort())) fail("source files must be sorted by path");
  exactKeys(spec.instructions, ["builder", "format", "sourceDateEpoch", "declaredEnvironment", "excludedAmbientFields"], "instructions");
  safeRelativePath(spec.instructions.builder, "instructions.builder");
  if (spec.instructions.format !== "onto2d-deterministic-text-bundle-v1" || spec.instructions.sourceDateEpoch !== 1786924800) fail("v1 instruction profile differs");
  exactKeys(spec.instructions.declaredEnvironment, ["LANG", "TZ", "SOURCE_DATE_EPOCH"], "declaredEnvironment");
  if (JSON.stringify(spec.instructions.declaredEnvironment) !== JSON.stringify({ LANG: "C", TZ: "UTC", SOURCE_DATE_EPOCH: "1786924800" })) fail("declared environment differs");
  if (JSON.stringify(spec.instructions.excludedAmbientFields) !== JSON.stringify(["ONTO2D_SESSION_LABEL"])) fail("excluded ambient field inventory differs");
  exactKeys(spec.parameters, ["baseline", "relevant-mutation"], "parameters");
  normalizedParameters(spec.parameters.baseline, "parameters.baseline");
  normalizedParameters(spec.parameters["relevant-mutation"], "parameters.relevant-mutation");
  if (spec.parameters.baseline.releaseChannel === spec.parameters["relevant-mutation"].releaseChannel) fail("relevant mutation must change the release channel");
  const executionIds = ["baseline-node24", "baseline-node22", "ambient-variation-node24", "relevant-input-node24"];
  if (JSON.stringify(spec.executions) !== JSON.stringify(executionIds)) fail("execution inventory differs");
  if (!Array.isArray(spec.comparisons) || spec.comparisons.length !== 3) fail("v1 requires three comparisons");
  const seenComparisons = new Set();
  for (const [index, comparison] of spec.comparisons.entries()) {
    exactKeys(comparison, ["id", "label", "left", "right"], `comparisons[${index}]`);
    if (!IDENTIFIER.test(comparison.id) || seenComparisons.has(comparison.id)) fail(`comparisons[${index}].id is invalid or repeated`);
    seenComparisons.add(comparison.id);
    if (!executionIds.includes(comparison.left) || !executionIds.includes(comparison.right) || comparison.left === comparison.right) fail(`${comparison.id} has invalid execution references`);
  }
  exactKeys(spec.methodology, ["definitionUrl", "environmentUrl", "sourceDateEpochUrl", "retrievedAt"], "methodology");
  for (const field of ["definitionUrl", "environmentUrl", "sourceDateEpochUrl"]) if (!spec.methodology[field].startsWith("https://reproducible-builds.org/")) fail(`methodology.${field} is not an official source`);
  if (!Number.isFinite(Date.parse(spec.methodology.retrievedAt))) fail("methodology.retrievedAt is invalid");
  return Object.freeze(spec);
}

async function readJson(relativePath) {
  const bytes = await readFile(path.join(CASE_ROOT, relativePath));
  return { bytes, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
}

export async function loadBuildFixture() {
  const specFile = await readJson("build-spec.json");
  if (specFile.bytes.length > 32 * 1024) fail("build-spec.json exceeds 32 KiB");
  const spec = validateBuildSpec(specFile.value);
  const sources = {};
  for (const source of spec.sourceFiles) {
    const bytes = await readFile(path.join(CASE_ROOT, source.path));
    if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) fail(`${source.path} differs from its source lock`);
    sources[source.path] = bytes;
  }
  const manifestBytes = sources["fixture/source/manifest.json"];
  const messageBytes = sources["fixture/source/message.txt"];
  if (!manifestBytes || !messageBytes) fail("required source files are absent");
  const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
  exactKeys(manifest, ["name", "version"], "source manifest");
  if (!IDENTIFIER.test(manifest.name) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) fail("source manifest identity is invalid");
  const message = new TextDecoder("utf-8", { fatal: true }).decode(messageBytes);
  if (!message.endsWith("\n") || message.slice(0, -1).includes("\n") || message.includes("\r") || message.includes("\0")) fail("message.txt must be one LF-terminated UTF-8 line");
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, spec.sourceFiles);
  const instructionsIdentity = hashCanonical(INSTRUCTIONS_DOMAIN, spec.instructions);
  return Object.freeze({
    spec,
    specBytes: specFile.bytes,
    manifest: Object.freeze(manifest),
    message: message.slice(0, -1),
    sourceIdentity,
    instructionsIdentity
  });
}

export function buildDeterministicArtifact(fixture, parametersInput) {
  const parameters = normalizedParameters(parametersInput);
  const sourceDate = new Date(fixture.spec.instructions.sourceDateEpoch * 1000).toISOString();
  const text = [
    "ONTO2D HISTORY EQUIVALENCE FIXTURE",
    `name=${fixture.manifest.name}`,
    `version=${fixture.manifest.version}`,
    `channel=${parameters.releaseChannel}`,
    `source-date=${sourceDate}`,
    `message=${fixture.message}`,
    ""
  ].join("\n");
  const bytes = Buffer.from(text, "utf8");
  const declaredInputs = Object.freeze({
    sourceIdentity: fixture.sourceIdentity,
    instructionsIdentity: fixture.instructionsIdentity,
    parameters,
    identity: hashCanonical(INPUT_DOMAIN, {
      sourceIdentity: fixture.sourceIdentity,
      instructionsIdentity: fixture.instructionsIdentity,
      parameters
    })
  });
  return Object.freeze({
    declaredInputs,
    artifact: Object.freeze({
      path: fixture.spec.artifact.path,
      mediaType: fixture.spec.artifact.mediaType,
      encoding: fixture.spec.artifact.encoding,
      bytes: bytes.length,
      sha256: `sha256:${sha256(bytes)}`,
      utf8: text
    })
  });
}

export function runtimeRecord() {
  const version = process.versions.node;
  const major = Number(version.split(".", 1)[0]);
  if (!Number.isSafeInteger(major)) fail("Node.js runtime version is invalid");
  return Object.freeze({ name: "Node.js", version, major, platform: process.platform, architecture: process.arch });
}

export async function captureExecution({ executionId, parameterSet, capturedAt = new Date().toISOString() }) {
  if (!IDENTIFIER.test(executionId)) fail("executionId must be a normalized identifier");
  if (!IDENTIFIER.test(parameterSet)) fail("parameterSet must be a normalized identifier");
  if (!Number.isFinite(Date.parse(capturedAt))) fail("capturedAt is invalid");
  const fixture = await loadBuildFixture();
  const parameters = fixture.spec.parameters[parameterSet];
  if (!parameters) fail(`unknown parameter set ${parameterSet}`);
  for (const [name, expected] of Object.entries(fixture.spec.instructions.declaredEnvironment)) {
    if (process.env[name] !== expected) fail(`capture environment ${name} must be exactly ${expected}`);
  }
  const sessionLabel = process.env.ONTO2D_SESSION_LABEL;
  if (typeof sessionLabel !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(sessionLabel)) fail("ONTO2D_SESSION_LABEL is invalid");
  const built = buildDeterministicArtifact(fixture, parameters);
  return Object.freeze({
    format: "onto2d-build-execution-record",
    formatVersion: "1",
    executionId,
    capturedAt,
    runtime: runtimeRecord(),
    declaredInputs: built.declaredInputs,
    environment: Object.freeze({
      normalized: Object.freeze({ ...fixture.spec.instructions.declaredEnvironment }),
      observedIrrelevant: Object.freeze({ ONTO2D_SESSION_LABEL: sessionLabel })
    }),
    artifact: built.artifact
  });
}
