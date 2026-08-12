import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm
} from "node:fs/promises";
import path from "node:path";
import {
  KernelError,
  canonicalBytes,
  canonicalClone,
  deepFreeze,
  hashArtifactBytes,
  materializePackageRunArtifact,
  verifyPackageRunArtifactBundle
} from "@onto2d/kernel";

export const PACKAGE_RUN_ARTIFACT_DIRECTORY_VERSION =
  "package-run-artifact-directory-v1";
export const PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH = "artifact-bundle.json";
export const PACKAGE_RUN_EXECUTION_RECORD_VERSION =
  "package-run-execution-record-v1";
export const PACKAGE_RUN_EXECUTION_DIRECTORY = "execution";
export const PACKAGE_RUN_ARTIFACT_DIRECTORY_LIMITS = deepFreeze({
  maxBundleBytes: 512 * 1024 * 1024,
  maxExecutionRecordBytes: 1024 * 1024,
  maxExecutionRecords: 10_000
});
export const RUN_STORE_STATUS =
  "verified-directory-persistence-active/execution-records-active";
export const RUN_STORE_CAPABILITIES = deepFreeze({
  implemented: [
    "verified-run-directory-writing",
    "verified-run-directory-reconstruction",
    "exact-artifact-byte-verification",
    "append-only-execution-record-writing",
    "execution-record-verification"
  ],
  pending: ["remote-object-store-persistence"]
});

const JSON_MEDIA_TYPE = "application/json";
const OPTION_FIELDS = new Set([
  "expectedKernelVersion",
  "maxBundleBytes",
  "maxExecutionRecordBytes",
  "maxExecutionRecords"
]);
const EXECUTION_RECORD_INPUT_FIELDS = new Set([
  "runHash",
  "startedAt",
  "completedAt",
  "engineBuild",
  "platform",
  "resourceUsage",
  "terminalStatus"
]);
const EXECUTION_RECORD_FIELDS = new Set([
  "schemaVersion",
  "recorder",
  "executionId",
  ...EXECUTION_RECORD_INPUT_FIELDS
]);
const RESOURCE_USAGE_FIELDS = new Set([
  "generatedCandidates",
  "perturbations",
  "nullTrials",
  "wallTimeMs",
  "peakResidentBytes",
  "exhausted"
]);
const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);
const EXHAUSTED_BUDGETS = new Set([
  "maxNodes",
  "maxEdges",
  "maxCandidates",
  "perturbationSamples",
  "nullModelRuns",
  "maxWallTimeMs",
  "maxResidentBytes"
]);
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const EXECUTION_FILE_PATTERN = /^execution\/sha256-[a-f0-9]{64}\.json$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PACKAGE_RUN_ARTIFACT_DIRECTORY",
    message,
    details
  });
}

function failIo(operation, error, details = {}) {
  if (error instanceof KernelError) throw error;
  fail(
    "PACKAGE_RUN_ARTIFACT_DIRECTORY_IO_FAILED",
    "A filesystem operation for a run artifact directory failed.",
    {
      operation,
      causeCode: typeof error?.code === "string" ? error.code : null,
      ...details
    }
  );
}

function cloneOptions(options) {
  try {
    return canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_OPTIONS_INVALID",
      "Run artifact directory options must be canonicalizable.",
      { causeCode: error.code }
    );
  }
}

function normalizeOptions(options) {
  const value = cloneOptions(options);
  if (!isObject(value)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_OPTIONS_INVALID",
      "Run artifact directory options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_OPTION_UNKNOWN",
      "Unknown run artifact directory option.",
      { unknown }
    );
  }
  if (
    value.expectedKernelVersion !== undefined &&
    (
      typeof value.expectedKernelVersion !== "string" ||
      value.expectedKernelVersion.length === 0 ||
      value.expectedKernelVersion !== value.expectedKernelVersion.trim()
    )
  ) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a normalized non-empty string."
    );
  }
  const maxBundleBytes = value.maxBundleBytes ??
    PACKAGE_RUN_ARTIFACT_DIRECTORY_LIMITS.maxBundleBytes;
  if (!Number.isSafeInteger(maxBundleBytes) || maxBundleBytes < 1) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_BYTE_LIMIT_INVALID",
      "The bundle-envelope byte limit must be a positive safe integer.",
      { value: maxBundleBytes }
    );
  }
  const maxExecutionRecordBytes = value.maxExecutionRecordBytes ??
    PACKAGE_RUN_ARTIFACT_DIRECTORY_LIMITS.maxExecutionRecordBytes;
  if (!Number.isSafeInteger(maxExecutionRecordBytes) || maxExecutionRecordBytes < 1) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_BYTE_LIMIT_INVALID",
      "The execution-record byte limit must be a positive safe integer.",
      { value: maxExecutionRecordBytes }
    );
  }
  const maxExecutionRecords = value.maxExecutionRecords ??
    PACKAGE_RUN_ARTIFACT_DIRECTORY_LIMITS.maxExecutionRecords;
  if (!Number.isSafeInteger(maxExecutionRecords) || maxExecutionRecords < 1) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_COUNT_LIMIT_INVALID",
      "The execution-record count limit must be a positive safe integer.",
      { value: maxExecutionRecords }
    );
  }
  return {
    ...(value.expectedKernelVersion === undefined
      ? {}
      : { expectedKernelVersion: value.expectedKernelVersion }),
    maxBundleBytes,
    maxExecutionRecordBytes,
    maxExecutionRecords
  };
}

function kernelVerificationOptions(options) {
  return options.expectedKernelVersion === undefined
    ? {}
    : { expectedKernelVersion: options.expectedKernelVersion };
}

function cloneExecutionRecord(value, code) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      code,
      "Execution records must be canonicalizable JSON values.",
      { causeCode: error.code }
    );
  }
}

function assertFields(value, allowed, required, code, label) {
  if (!isObject(value)) {
    fail(code, `${label} must be an object.`);
  }
  const unknown = Object.keys(value)
    .filter((field) => !allowed.has(field))
    .sort(compareStrings);
  const missing = required
    .filter((field) => !Object.hasOwn(value, field))
    .sort(compareStrings);
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${label} has missing or unknown fields.`, { missing, unknown });
  }
}

function normalizedString(value, field, maximum = 16_384) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    value.includes("\0") ||
    !/^(?:\S|\S(?:.*\S)?)$/.test(value)
  ) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_INVALID",
      "Execution-record strings must be normalized, non-empty, and bounded.",
      { field, maximum }
    );
  }
  return value;
}

function contentHash(value, field) {
  if (typeof value !== "string" || !CONTENT_HASH_PATTERN.test(value)) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_INVALID",
      "Execution-record content hashes must use canonical lowercase SHA-256 form.",
      { field }
    );
  }
  return value;
}

function timestamp(value, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_TIMESTAMP_INVALID",
      "Execution-record timestamps must use canonical ISO 8601 UTC milliseconds.",
      { field }
    );
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_TIMESTAMP_INVALID",
      "Execution-record timestamps must denote real canonical UTC instants.",
      { field }
    );
  }
  return value;
}

function safeCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_RESOURCE_USAGE_INVALID",
      "Execution-record counters must be non-negative safe integers.",
      { field, value }
    );
  }
  return value;
}

function normalizeResourceUsage(input) {
  assertFields(
    input,
    RESOURCE_USAGE_FIELDS,
    [
      "generatedCandidates",
      "perturbations",
      "nullTrials",
      "wallTimeMs",
      "exhausted"
    ],
    "PACKAGE_RUN_EXECUTION_RECORD_RESOURCE_USAGE_INVALID",
    "Execution-record resourceUsage"
  );
  if (!Number.isFinite(input.wallTimeMs) || input.wallTimeMs < 0) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_RESOURCE_USAGE_INVALID",
      "Execution-record wallTimeMs must be a finite non-negative number.",
      { field: "wallTimeMs", value: input.wallTimeMs }
    );
  }
  if (
    input.exhausted !== null &&
    (typeof input.exhausted !== "string" || !EXHAUSTED_BUDGETS.has(input.exhausted))
  ) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_RESOURCE_USAGE_INVALID",
      "Execution-record exhausted must be null or a supported run-budget key.",
      { field: "exhausted", value: input.exhausted }
    );
  }
  return {
    generatedCandidates: safeCount(input.generatedCandidates, "generatedCandidates"),
    perturbations: safeCount(input.perturbations, "perturbations"),
    nullTrials: safeCount(input.nullTrials, "nullTrials"),
    wallTimeMs: Object.is(input.wallTimeMs, -0) ? 0 : input.wallTimeMs,
    ...(input.peakResidentBytes === undefined
      ? {}
      : { peakResidentBytes: safeCount(input.peakResidentBytes, "peakResidentBytes") }),
    exhausted: input.exhausted
  };
}

function normalizeExecutionRecordInput(inputValue) {
  const input = cloneExecutionRecord(
    inputValue,
    "PACKAGE_RUN_EXECUTION_RECORD_INVALID"
  );
  assertFields(
    input,
    EXECUTION_RECORD_INPUT_FIELDS,
    [
      "runHash",
      "startedAt",
      "completedAt",
      "engineBuild",
      "resourceUsage",
      "terminalStatus"
    ],
    "PACKAGE_RUN_EXECUTION_RECORD_INVALID",
    "Execution-record input"
  );
  const startedAt = timestamp(input.startedAt, "startedAt");
  const completedAt = input.completedAt === null
    ? null
    : timestamp(input.completedAt, "completedAt");
  if (completedAt !== null && Date.parse(completedAt) < Date.parse(startedAt)) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_TIME_ORDER_INVALID",
      "Execution-record completion cannot precede its start.",
      { startedAt, completedAt }
    );
  }
  if (!TERMINAL_STATUSES.has(input.terminalStatus)) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_STATUS_INVALID",
      "Execution-record terminalStatus is unsupported.",
      { terminalStatus: input.terminalStatus }
    );
  }
  if (input.terminalStatus === "complete" && completedAt === null) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_COMPLETION_REQUIRED",
      "A completed execution record requires completedAt."
    );
  }
  return {
    runHash: contentHash(input.runHash, "runHash"),
    startedAt,
    completedAt,
    engineBuild: normalizedString(input.engineBuild, "engineBuild", 1_024),
    ...(input.platform === undefined
      ? {}
      : { platform: normalizedString(input.platform, "platform", 1_024) }),
    resourceUsage: normalizeResourceUsage(input.resourceUsage),
    terminalStatus: input.terminalStatus
  };
}

/** Creates a content-addressed operational record without changing semantic identity. */
export function createPackageRunExecutionRecord(input) {
  const normalized = normalizeExecutionRecordInput(input);
  const basis = {
    schemaVersion: "1",
    recorder: PACKAGE_RUN_EXECUTION_RECORD_VERSION,
    ...normalized
  };
  return deepFreeze({
    ...basis,
    executionId: hashArtifactBytes(canonicalBytes(basis))
  });
}

/** Exactly replays one execution record and optionally checks its run binding. */
export function verifyPackageRunExecutionRecord(recordInput, expectedRunHash) {
  const record = cloneExecutionRecord(
    recordInput,
    "PACKAGE_RUN_EXECUTION_RECORD_INVALID"
  );
  assertFields(
    record,
    EXECUTION_RECORD_FIELDS,
    [
      "schemaVersion",
      "recorder",
      "executionId",
      "runHash",
      "startedAt",
      "completedAt",
      "engineBuild",
      "resourceUsage",
      "terminalStatus"
    ],
    "PACKAGE_RUN_EXECUTION_RECORD_INVALID",
    "Execution record"
  );
  const input = Object.fromEntries(
    [...EXECUTION_RECORD_INPUT_FIELDS]
      .filter((field) => Object.hasOwn(record, field))
      .map((field) => [field, record[field]])
  );
  const expected = createPackageRunExecutionRecord(input);
  if (!Buffer.from(canonicalBytes(record)).equals(Buffer.from(canonicalBytes(expected)))) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_MISMATCH",
      "Execution record does not match its normalized content-addressed replay."
    );
  }
  if (expectedRunHash !== undefined) {
    contentHash(expectedRunHash, "expectedRunHash");
    if (expected.runHash !== expectedRunHash) {
      fail(
        "PACKAGE_RUN_EXECUTION_RECORD_RUN_MISMATCH",
        "Execution record is bound to a different semantic run.",
        { expected: expectedRunHash, actual: expected.runHash }
      );
    }
  }
  return expected;
}

function normalizeDirectory(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes("\0")
  ) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_PATH_INVALID",
      `${label} must be a normalized non-empty filesystem path.`
    );
  }
  return path.resolve(value);
}

function portableRunDirectoryName(runHash) {
  return runHash.replace("sha256:", "sha256-");
}

function assertLogicalPath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(
      "PACKAGE_RUN_ARTIFACT_LOGICAL_PATH_INVALID",
      "A verified artifact reference contains an unsafe logical path.",
      { path: value }
    );
  }
  return value;
}

function containedPath(root, logicalPath) {
  const safeLogicalPath = assertLogicalPath(logicalPath);
  const resolved = path.resolve(root, ...safeLogicalPath.split("/"));
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_LOGICAL_PATH_INVALID",
      "A verified artifact reference escapes its run directory.",
      { path: logicalPath }
    );
  }
  return resolved;
}

async function pathKind(value) {
  try {
    const stats = await lstat(value);
    if (stats.isSymbolicLink()) return "symlink";
    if (stats.isDirectory()) return "directory";
    if (stats.isFile()) return "file";
    return "other";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    failIo("lstat", error, { path: value });
  }
}

async function readRegularFile(file, maximumBytes, expectedBytes) {
  let handle;
  try {
    const noFollow = typeof constants.O_NOFOLLOW === "number"
      ? constants.O_NOFOLLOW
      : 0;
    handle = await open(file, constants.O_RDONLY | noFollow);
    const stats = await handle.stat();
    if (!stats.isFile()) {
      fail(
        "PACKAGE_RUN_ARTIFACT_FILE_INVALID",
        "Every run artifact path must resolve to a regular file.",
        { path: file }
      );
    }
    if (expectedBytes !== undefined && stats.size !== expectedBytes) {
      fail(
        "PACKAGE_RUN_ARTIFACT_FILE_SIZE_MISMATCH",
        "A stored run artifact has a different byte length from its verified reference.",
        { path: file, expected: expectedBytes, actual: stats.size }
      );
    }
    if (stats.size > maximumBytes) {
      fail(
        "PACKAGE_RUN_ARTIFACT_FILE_BYTE_LIMIT_EXCEEDED",
        "A stored run artifact exceeds the configured read limit.",
        { path: file, bytes: stats.size, maximum: maximumBytes }
      );
    }
    return await handle.readFile();
  } catch (error) {
    failIo("read-file", error, { path: file });
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch (error) {
        failIo("close-file", error, { path: file });
      }
    }
  }
}

async function writeRegularFile(file, bytes) {
  let handle;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    handle = await open(file, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    failIo("write-file", error, { path: file });
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch (error) {
        failIo("close-file", error, { path: file });
      }
    }
  }
}

async function inventoryDirectory(root, relative = "") {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch (error) {
    failIo("read-directory", error, { path: path.join(root, relative) });
  }
  const files = [];
  const directories = [];
  for (const entry of entries.sort((left, right) => compareStrings(left.name, right.name))) {
    const logical = relative.length === 0
      ? entry.name
      : `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      fail(
        "PACKAGE_RUN_ARTIFACT_DIRECTORY_SYMLINK_FORBIDDEN",
        "Run artifact directories cannot contain symbolic links.",
        { path: logical }
      );
    }
    if (entry.isDirectory()) {
      directories.push(logical);
      const nested = await inventoryDirectory(root, logical);
      files.push(...nested.files);
      directories.push(...nested.directories);
      continue;
    }
    if (!entry.isFile()) {
      fail(
        "PACKAGE_RUN_ARTIFACT_FILE_INVALID",
        "Run artifact directories may contain only regular files and directories.",
        { path: logical }
      );
    }
    files.push(logical);
  }
  return { files, directories };
}

function expectedDirectories(expectedFiles) {
  const directories = new Set();
  for (const file of expectedFiles) {
    const parts = file.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  return [...directories].sort(compareStrings);
}

function checkedByteTotal(bundleBytes, artifacts) {
  let total = bundleBytes;
  for (const artifact of artifacts) {
    total += artifact.ref.bytes;
    if (!Number.isSafeInteger(total)) {
      fail(
        "PACKAGE_RUN_ARTIFACT_DIRECTORY_BYTE_TOTAL_INVALID",
        "Stored run artifact byte totals must remain safe integers."
      );
    }
  }
  return total;
}

function executionRecordLogicalPath(executionId) {
  return `${PACKAGE_RUN_EXECUTION_DIRECTORY}/${portableRunDirectoryName(executionId)}.json`;
}

async function readExecutionRecordFile(
  root,
  logicalPath,
  maximumBytes,
  expectedRunHash
) {
  const bytes = await readRegularFile(
    containedPath(root, logicalPath),
    maximumBytes
  );
  let supplied;
  try {
    supplied = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_JSON_INVALID",
      "Stored execution records must contain valid JSON.",
      { path: logicalPath, cause: error.message }
    );
  }
  const record = verifyPackageRunExecutionRecord(supplied, expectedRunHash);
  const canonical = Buffer.from(canonicalBytes(record));
  if (!bytes.equals(canonical)) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_NON_CANONICAL",
      "Stored execution-record bytes are not canonical.",
      { path: logicalPath }
    );
  }
  const expectedPath = executionRecordLogicalPath(record.executionId);
  if (logicalPath !== expectedPath) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_PATH_MISMATCH",
      "Stored execution-record filename does not match its content identity.",
      { expected: expectedPath, actual: logicalPath }
    );
  }
  return record;
}

function createExecutionReceipt(record, directory, status) {
  const bytes = Buffer.from(canonicalBytes(record));
  return deepFreeze({
    schemaVersion: "1",
    writer: PACKAGE_RUN_EXECUTION_RECORD_VERSION,
    status,
    directory,
    runHash: record.runHash,
    executionId: record.executionId,
    recordRef: {
      path: executionRecordLogicalPath(record.executionId),
      mediaType: JSON_MEDIA_TYPE,
      schemaVersion: record.schemaVersion,
      bytes: bytes.byteLength,
      hash: hashArtifactBytes(bytes)
    }
  });
}

function createReceipt(bundle, directory, bundleBytes, status) {
  const bundleRef = {
    path: PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH,
    mediaType: JSON_MEDIA_TYPE,
    schemaVersion: bundle.schemaVersion,
    bytes: bundleBytes.byteLength,
    hash: hashArtifactBytes(bundleBytes)
  };
  return deepFreeze({
    schemaVersion: "1",
    writer: PACKAGE_RUN_ARTIFACT_DIRECTORY_VERSION,
    status,
    directory,
    bundleHash: bundle.bundleHash,
    runHash: bundle.runHash,
    targetDepth: bundle.targetDepth,
    bundleRef,
    artifacts: bundle.artifacts,
    counts: {
      files: bundle.artifacts.length + 1,
      artifacts: bundle.artifacts.length,
      bytes: checkedByteTotal(bundleBytes.byteLength, bundle.artifacts)
    }
  });
}

async function readVerifiedDirectory(
  directoryInput,
  normalizedOptions,
  { enforceDirectoryName = true, status = "verified" } = {}
) {
  const directory = normalizeDirectory(directoryInput, "Run artifact directory");
  const kind = await pathKind(directory);
  if (kind === "symlink") {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_SYMLINK_FORBIDDEN",
      "A run artifact directory cannot be a symbolic link.",
      { path: directory }
    );
  }
  if (kind !== "directory") {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_INVALID",
      "Run artifact directory does not exist or is not a directory.",
      { path: directory, kind }
    );
  }
  let resolvedDirectory;
  try {
    resolvedDirectory = await realpath(directory);
  } catch (error) {
    failIo("realpath", error, { path: directory });
  }
  const envelopeFile = containedPath(
    resolvedDirectory,
    PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH
  );
  const envelopeBytes = await readRegularFile(
    envelopeFile,
    normalizedOptions.maxBundleBytes
  );
  let suppliedBundle;
  try {
    suppliedBundle = JSON.parse(envelopeBytes.toString("utf8"));
  } catch (error) {
    fail(
      "PACKAGE_RUN_ARTIFACT_ENVELOPE_JSON_INVALID",
      "Run artifact bundle envelope must contain valid JSON.",
      { cause: error.message }
    );
  }
  const bundle = verifyPackageRunArtifactBundle(
    suppliedBundle,
    kernelVerificationOptions(normalizedOptions)
  );
  const canonicalEnvelope = Buffer.from(canonicalBytes(bundle));
  if (!envelopeBytes.equals(canonicalEnvelope)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_ENVELOPE_NON_CANONICAL",
      "Run artifact bundle envelope bytes are not the canonical verified bundle bytes."
    );
  }
  const expectedName = portableRunDirectoryName(bundle.runHash);
  if (enforceDirectoryName && path.basename(resolvedDirectory) !== expectedName) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_NAME_MISMATCH",
      "Run artifact directory name is not the portable encoding of its verified runHash.",
      { expected: expectedName, actual: path.basename(resolvedDirectory) }
    );
  }

  const expectedFiles = new Set([PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH]);
  for (const artifact of bundle.artifacts) {
    const logicalPath = assertLogicalPath(artifact.ref.path);
    if (
      logicalPath === PACKAGE_RUN_EXECUTION_DIRECTORY ||
      logicalPath.startsWith(`${PACKAGE_RUN_EXECUTION_DIRECTORY}/`)
    ) {
      fail(
        "PACKAGE_RUN_ARTIFACT_OPERATIONAL_PATH_RESERVED",
        "Semantic bundle artifacts cannot use the reserved execution directory.",
        { path: logicalPath }
      );
    }
    if (expectedFiles.has(logicalPath)) {
      fail(
        "PACKAGE_RUN_ARTIFACT_DIRECTORY_PATH_DUPLICATE",
        "Run artifact directory references must have unique paths.",
        { path: logicalPath }
      );
    }
    expectedFiles.add(logicalPath);
    const materialized = materializePackageRunArtifact(
      bundle,
      logicalPath,
      kernelVerificationOptions(normalizedOptions)
    );
    const expectedBytes = Buffer.from(materialized.bytesBase64, "base64");
    const actualBytes = await readRegularFile(
      containedPath(resolvedDirectory, logicalPath),
      artifact.ref.bytes,
      artifact.ref.bytes
    );
    if (
      !actualBytes.equals(expectedBytes) ||
      hashArtifactBytes(actualBytes) !== artifact.ref.hash
    ) {
      fail(
        "PACKAGE_RUN_ARTIFACT_FILE_MISMATCH",
        "Stored run artifact bytes differ from their verified bundle materialization.",
        { path: logicalPath }
      );
    }
  }

  const inventory = await inventoryDirectory(resolvedDirectory);
  const actualFiles = [...inventory.files].sort(compareStrings);
  const actualDirectories = [...inventory.directories].sort(compareStrings);
  const wantedFiles = [...expectedFiles].sort(compareStrings);
  const wantedDirectories = expectedDirectories(wantedFiles);
  const executionFiles = actualFiles.filter((file) => EXECUTION_FILE_PATTERN.test(file));
  const unknownFiles = actualFiles.filter((file) =>
    !expectedFiles.has(file) && !EXECUTION_FILE_PATTERN.test(file)
  );
  const missingFiles = wantedFiles.filter((file) => !actualFiles.includes(file));
  const allowedDirectories = new Set(wantedDirectories);
  if (actualDirectories.includes(PACKAGE_RUN_EXECUTION_DIRECTORY)) {
    allowedDirectories.add(PACKAGE_RUN_EXECUTION_DIRECTORY);
  }
  const unknownDirectories = actualDirectories.filter((directory) =>
    !allowedDirectories.has(directory)
  );
  if (
    missingFiles.length > 0 ||
    unknownFiles.length > 0 ||
    unknownDirectories.length > 0
  ) {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_CONTENT_MISMATCH",
      "Run artifact directory contains missing or unexpected filesystem entries.",
      {
        expectedFiles: wantedFiles.length,
        actualFiles: actualFiles.length,
        expectedDirectories: wantedDirectories.length,
        actualDirectories: actualDirectories.length,
        missingFiles,
        unknownFiles,
        unknownDirectories
      }
    );
  }
  if (executionFiles.length > normalizedOptions.maxExecutionRecords) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_COUNT_LIMIT_EXCEEDED",
      "Run directory exceeds the configured execution-record count limit.",
      {
        records: executionFiles.length,
        maximum: normalizedOptions.maxExecutionRecords
      }
    );
  }
  const executionRecords = [];
  for (const logicalPath of executionFiles.sort(compareStrings)) {
    executionRecords.push(await readExecutionRecordFile(
      resolvedDirectory,
      logicalPath,
      normalizedOptions.maxExecutionRecordBytes,
      bundle.runHash
    ));
  }
  return deepFreeze({
    bundle,
    executionRecords,
    receipt: createReceipt(
      bundle,
      resolvedDirectory,
      canonicalEnvelope,
      status
    )
  });
}

/** Fully replays a persisted bundle and verifies every referenced byte. */
export async function readPackageRunArtifactBundle(directory, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  const verified = await readVerifiedDirectory(directory, normalizedOptions);
  return deepFreeze({ bundle: verified.bundle, receipt: verified.receipt });
}

/** Fully replays a run directory and returns its operational records by ID. */
export async function readPackageRunExecutionRecords(directory, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  const verified = await readVerifiedDirectory(directory, normalizedOptions);
  return verified.executionRecords;
}

async function safeRemoveStaging(
  stagingDirectory,
  rootDirectory,
  prefix = ".onto2d-write-"
) {
  if (
    stagingDirectory === undefined ||
    path.dirname(stagingDirectory) !== rootDirectory ||
    !path.basename(stagingDirectory).startsWith(prefix)
  ) {
    return;
  }
  const kind = await pathKind(stagingDirectory);
  if (kind === "missing") return;
  if (kind !== "directory") {
    fail(
      "PACKAGE_RUN_ARTIFACT_STAGING_INVALID",
      "Writer staging path changed type before cleanup.",
      { path: stagingDirectory, kind }
    );
  }
  try {
    await rm(stagingDirectory, { recursive: true, force: false });
  } catch (error) {
    failIo("remove-staging", error, { path: stagingDirectory });
  }
}

/** Atomically publishes one verified bundle under its portable runHash directory. */
export async function writePackageRunArtifactBundle(
  bundleInput,
  runsDirectoryInput,
  options = {}
) {
  const normalizedOptions = normalizeOptions(options);
  const bundle = verifyPackageRunArtifactBundle(
    bundleInput,
    kernelVerificationOptions(normalizedOptions)
  );
  const runsDirectory = normalizeDirectory(runsDirectoryInput, "Runs directory");
  try {
    await mkdir(runsDirectory, { recursive: true });
  } catch (error) {
    failIo("create-runs-directory", error, { path: runsDirectory });
  }
  const rootKind = await pathKind(runsDirectory);
  if (rootKind === "symlink") {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_SYMLINK_FORBIDDEN",
      "Runs directory cannot be a symbolic link.",
      { path: runsDirectory }
    );
  }
  if (rootKind !== "directory") {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_INVALID",
      "Runs path must resolve to a directory.",
      { path: runsDirectory, kind: rootKind }
    );
  }
  let resolvedRoot;
  try {
    resolvedRoot = await realpath(runsDirectory);
  } catch (error) {
    failIo("realpath", error, { path: runsDirectory });
  }
  const finalDirectory = path.join(
    resolvedRoot,
    portableRunDirectoryName(bundle.runHash)
  );
  const finalKind = await pathKind(finalDirectory);
  if (finalKind !== "missing") {
    const existing = await readVerifiedDirectory(
      finalDirectory,
      normalizedOptions,
      { status: "already-present" }
    );
    if (existing.bundle.bundleHash !== bundle.bundleHash) {
      fail(
        "PACKAGE_RUN_ARTIFACT_DIRECTORY_CONFLICT",
        "The runHash directory already contains a different verified bundle.",
        {
          runHash: bundle.runHash,
          expectedBundleHash: bundle.bundleHash,
          actualBundleHash: existing.bundle.bundleHash
        }
      );
    }
    return existing.receipt;
  }

  let stagingDirectory;
  try {
    stagingDirectory = await mkdtemp(path.join(resolvedRoot, ".onto2d-write-"));
    const envelopeBytes = Buffer.from(canonicalBytes(bundle));
    if (envelopeBytes.byteLength > normalizedOptions.maxBundleBytes) {
      fail(
        "PACKAGE_RUN_ARTIFACT_FILE_BYTE_LIMIT_EXCEEDED",
        "Run artifact bundle envelope exceeds the configured write limit.",
        {
          bytes: envelopeBytes.byteLength,
          maximum: normalizedOptions.maxBundleBytes
        }
      );
    }
    await writeRegularFile(
      containedPath(stagingDirectory, PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH),
      envelopeBytes
    );
    for (const artifact of bundle.artifacts) {
      const materialized = materializePackageRunArtifact(
        bundle,
        artifact.ref.path,
        kernelVerificationOptions(normalizedOptions)
      );
      await writeRegularFile(
        containedPath(stagingDirectory, artifact.ref.path),
        Buffer.from(materialized.bytesBase64, "base64")
      );
    }
    const staged = await readVerifiedDirectory(
      stagingDirectory,
      normalizedOptions,
      { enforceDirectoryName: false }
    );
    try {
      await rename(stagingDirectory, finalDirectory);
      stagingDirectory = undefined;
    } catch (error) {
      if (await pathKind(finalDirectory) === "missing") throw error;
      const existing = await readVerifiedDirectory(
        finalDirectory,
        normalizedOptions,
        { status: "already-present" }
      );
      if (existing.bundle.bundleHash !== bundle.bundleHash) {
        fail(
          "PACKAGE_RUN_ARTIFACT_DIRECTORY_CONFLICT",
          "A concurrent writer published a different bundle for the same runHash.",
          { runHash: bundle.runHash }
        );
      }
      await safeRemoveStaging(stagingDirectory, resolvedRoot);
      stagingDirectory = undefined;
      return existing.receipt;
    }
    return createReceipt(
      staged.bundle,
      finalDirectory,
      envelopeBytes,
      "written"
    );
  } catch (error) {
    try {
      await safeRemoveStaging(stagingDirectory, resolvedRoot);
    } catch (cleanupError) {
      if (error instanceof KernelError) throw error;
      failIo("cleanup-after-write-failure", cleanupError, {
        path: stagingDirectory ?? null
      });
    }
    failIo("publish-run-directory", error, { path: finalDirectory });
  }
}

/** Atomically appends one canonical operational record without changing bundle bytes. */
export async function writePackageRunExecutionRecord(
  recordInput,
  directoryInput,
  options = {}
) {
  const normalizedOptions = normalizeOptions(options);
  const verifiedDirectory = await readVerifiedDirectory(
    directoryInput,
    normalizedOptions
  );
  const directory = verifiedDirectory.receipt.directory;
  const record = verifyPackageRunExecutionRecord(
    recordInput,
    verifiedDirectory.bundle.runHash
  );
  const recordBytes = Buffer.from(canonicalBytes(record));
  if (recordBytes.byteLength > normalizedOptions.maxExecutionRecordBytes) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_BYTE_LIMIT_EXCEEDED",
      "Execution record exceeds the configured write limit.",
      {
        bytes: recordBytes.byteLength,
        maximum: normalizedOptions.maxExecutionRecordBytes
      }
    );
  }
  const existingRecord = verifiedDirectory.executionRecords.find(
    (entry) => entry.executionId === record.executionId
  );
  if (existingRecord !== undefined) {
    return createExecutionReceipt(record, directory, "already-present");
  }
  if (
    verifiedDirectory.executionRecords.length >=
    normalizedOptions.maxExecutionRecords
  ) {
    fail(
      "PACKAGE_RUN_EXECUTION_RECORD_COUNT_LIMIT_EXCEEDED",
      "Run directory has reached the configured execution-record count limit.",
      {
        records: verifiedDirectory.executionRecords.length,
        maximum: normalizedOptions.maxExecutionRecords
      }
    );
  }

  const executionDirectory = containedPath(
    directory,
    PACKAGE_RUN_EXECUTION_DIRECTORY
  );
  try {
    await mkdir(executionDirectory, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      failIo("create-execution-directory", error, { path: executionDirectory });
    }
  }
  const executionDirectoryKind = await pathKind(executionDirectory);
  if (executionDirectoryKind === "symlink") {
    fail(
      "PACKAGE_RUN_ARTIFACT_DIRECTORY_SYMLINK_FORBIDDEN",
      "Execution-record directory cannot be a symbolic link.",
      { path: executionDirectory }
    );
  }
  if (executionDirectoryKind !== "directory") {
    fail(
      "PACKAGE_RUN_EXECUTION_DIRECTORY_INVALID",
      "Execution-record path must resolve to a directory.",
      { path: executionDirectory, kind: executionDirectoryKind }
    );
  }

  const logicalPath = executionRecordLogicalPath(record.executionId);
  const finalFile = containedPath(directory, logicalPath);
  const parentDirectory = path.dirname(directory);
  let stagingDirectory;
  try {
    stagingDirectory = await mkdtemp(
      path.join(parentDirectory, ".onto2d-execution-")
    );
    const stagingFile = path.join(stagingDirectory, "record.json");
    await writeRegularFile(stagingFile, recordBytes);
    const stagedBytes = await readRegularFile(
      stagingFile,
      normalizedOptions.maxExecutionRecordBytes,
      recordBytes.byteLength
    );
    if (!stagedBytes.equals(recordBytes)) {
      fail(
        "PACKAGE_RUN_EXECUTION_RECORD_STAGING_MISMATCH",
        "Staged execution-record bytes changed before publication."
      );
    }

    let status = "written";
    try {
      await link(stagingFile, finalFile);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      status = "already-present";
    }
    const stored = await readExecutionRecordFile(
      directory,
      logicalPath,
      normalizedOptions.maxExecutionRecordBytes,
      verifiedDirectory.bundle.runHash
    );
    if (!Buffer.from(canonicalBytes(stored)).equals(recordBytes)) {
      fail(
        "PACKAGE_RUN_EXECUTION_RECORD_CONFLICT",
        "Execution ID path contains a different canonical record.",
        { executionId: record.executionId }
      );
    }
    await safeRemoveStaging(
      stagingDirectory,
      parentDirectory,
      ".onto2d-execution-"
    );
    stagingDirectory = undefined;
    return createExecutionReceipt(record, directory, status);
  } catch (error) {
    try {
      await safeRemoveStaging(
        stagingDirectory,
        parentDirectory,
        ".onto2d-execution-"
      );
    } catch (cleanupError) {
      if (error instanceof KernelError) throw error;
      failIo("cleanup-after-execution-write-failure", cleanupError, {
        path: stagingDirectory ?? null
      });
    }
    failIo("publish-execution-record", error, { path: finalFile });
  }
}
