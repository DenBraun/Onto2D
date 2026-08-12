import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  KernelError,
  closePackageLevel,
  createPackageRunArtifactBundle,
  loadKernelPackage,
  materializePackageRunArtifact
} from "@onto2d/kernel";
import {
  PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH,
  RUN_STORE_CAPABILITIES,
  RUN_STORE_STATUS,
  createPackageRunExecutionRecord,
  readPackageRunArtifactBundle,
  readPackageRunExecutionRecords,
  verifyPackageRunExecutionRecord,
  writePackageRunExecutionRecord,
  writePackageRunArtifactBundle
} from "../src/index.js";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const SCHEMA_ROOT = path.join(REPOSITORY_ROOT, "packages", "schemas", "schemas");
const schemaFiles = (await readdir(SCHEMA_ROOT))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const schemas = await Promise.all(schemaFiles.map(async (name) =>
  JSON.parse(await readFile(path.join(SCHEMA_ROOT, name), "utf8"))
));
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
schemas.forEach((schema) => ajv.addSchema(schema));
const validateReceipt = ajv.getSchema(
  "https://onto2d.dev/schemas/v1/package-run-artifact-directory-receipt.schema.json"
);
const validateExecutionRecord = ajv.getSchema(
  "https://onto2d.dev/schemas/v1/package-run-execution-record.schema.json"
);
const validateExecutionReceipt = ajv.getSchema(
  "https://onto2d.dev/schemas/v1/package-run-execution-record-receipt.schema.json"
);

function bundleFixture() {
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "run-store-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "run-store-source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: {},
      profile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }]
  });
  const config = {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "run-store-fixture-v1",
    invariantPrecision: {
      id: "run-store-precision-v1",
      decimalPlaces: 6,
      rounding: "half-even",
      summation: "exact-decimal"
    },
    graphPolicy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: [],
      structuralEdgeAttributes: []
    },
    substructurePolicy: {
      id: "run-store-substructure-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
  const level = closePackageLevel(loaded, config);
  return {
    bundle: createPackageRunArtifactBundle(loaded, config, [level]),
    kernelVersion: loaded.semanticManifest.kernelVersion
  };
}

function executionRecordInput(runHash, overrides = {}) {
  return {
    runHash,
    startedAt: "2026-08-12T10:00:00.000Z",
    completedAt: "2026-08-12T10:00:01.250Z",
    engineBuild: "onto2d-test-build-v1",
    platform: "test-platform",
    resourceUsage: {
      generatedCandidates: 1,
      perturbations: 0,
      nullTrials: 0,
      wallTimeMs: 1_250,
      peakResidentBytes: 4096,
      exhausted: null
    },
    terminalStatus: "complete",
    ...overrides
  };
}

test("run-store atomically writes, replays, and inventories exact bundle bytes", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-run-store-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const runs = path.join(temporary, "runs");
  const { bundle, kernelVersion } = bundleFixture();

  const written = await writePackageRunArtifactBundle(bundle, runs, {
    expectedKernelVersion: kernelVersion
  });
  assert.equal(written.status, "written");
  assert.equal(path.basename(written.directory), bundle.runHash.replace(":", "-"));
  assert.equal(written.bundleHash, bundle.bundleHash);
  assert.equal(written.counts.artifacts, bundle.artifacts.length);
  assert.equal(written.counts.files, bundle.artifacts.length + 1);
  assert.equal(validateReceipt(written), true, ajv.errorsText(validateReceipt.errors));

  const reconstructed = await readPackageRunArtifactBundle(written.directory, {
    expectedKernelVersion: kernelVersion
  });
  assert.equal(reconstructed.bundle.bundleHash, bundle.bundleHash);
  assert.equal(reconstructed.receipt.status, "verified");
  assert.equal(validateReceipt(reconstructed.receipt), true);

  const repeated = await writePackageRunArtifactBundle(bundle, runs);
  assert.equal(repeated.status, "already-present");
  assert.equal(repeated.bundleHash, bundle.bundleHash);

  await assert.rejects(
    () => readPackageRunArtifactBundle(written.directory, {
      expectedKernelVersion: "different-kernel"
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_KERNEL_VERSION_MISMATCH"
  );
  await assert.rejects(
    () => readPackageRunArtifactBundle(written.directory, { maxBundleBytes: 1 }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_FILE_BYTE_LIMIT_EXCEEDED"
  );

  const artifact = bundle.artifacts.find((entry) =>
    entry.ref.path === "semantic-manifest.json"
  );
  const artifactFile = path.join(
    written.directory,
    ...artifact.ref.path.split("/")
  );
  const originalArtifact = Buffer.from(
    materializePackageRunArtifact(bundle, artifact.ref.path).bytesBase64,
    "base64"
  );
  const tamperedArtifact = Buffer.from(originalArtifact);
  tamperedArtifact[tamperedArtifact.length - 1] = 0x20;
  await writeFile(artifactFile, tamperedArtifact);
  await assert.rejects(
    () => readPackageRunArtifactBundle(written.directory),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_FILE_MISMATCH"
  );
  await writeFile(artifactFile, originalArtifact);

  const unexpectedFile = path.join(written.directory, "unexpected.json");
  await writeFile(unexpectedFile, "{}", "utf8");
  await assert.rejects(
    () => readPackageRunArtifactBundle(written.directory),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_DIRECTORY_CONTENT_MISMATCH"
  );
  await unlink(unexpectedFile);

  const envelopeFile = path.join(
    written.directory,
    PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH
  );
  const canonicalEnvelope = await readFile(envelopeFile);
  await writeFile(
    envelopeFile,
    `${JSON.stringify(JSON.parse(canonicalEnvelope.toString("utf8")), null, 2)}\n`,
    "utf8"
  );
  await assert.rejects(
    () => readPackageRunArtifactBundle(written.directory),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_ENVELOPE_NON_CANONICAL"
  );
  await writeFile(envelopeFile, canonicalEnvelope);

  const alias = path.join(temporary, "bundle-alias");
  await symlink(
    written.directory,
    alias,
    process.platform === "win32" ? "junction" : "dir"
  );
  await assert.rejects(
    () => readPackageRunArtifactBundle(alias),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_DIRECTORY_SYMLINK_FORBIDDEN"
  );
});

test("concurrent writers converge without overwriting a verified run", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-run-race-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const { bundle } = bundleFixture();
  const receipts = await Promise.all([
    writePackageRunArtifactBundle(bundle, temporary),
    writePackageRunArtifactBundle(bundle, temporary)
  ]);
  assert.deepEqual(
    receipts.map((entry) => entry.status).sort(),
    ["already-present", "written"]
  );
  assert.equal(receipts[0].bundleHash, receipts[1].bundleHash);
  const entries = await readdir(temporary);
  assert.deepEqual(entries, [bundle.runHash.replace(":", "-")]);
});

test("execution records append atomically without changing semantic bundle identity", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-execution-store-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const { bundle } = bundleFixture();
  const bundleReceipt = await writePackageRunArtifactBundle(bundle, temporary);
  const envelopeFile = path.join(
    bundleReceipt.directory,
    PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH
  );
  const envelopeBefore = await readFile(envelopeFile);

  const record = createPackageRunExecutionRecord(
    executionRecordInput(bundle.runHash)
  );
  assert.equal(validateExecutionRecord(record), true, ajv.errorsText(
    validateExecutionRecord.errors
  ));
  assert.deepEqual(verifyPackageRunExecutionRecord(record, bundle.runHash), record);

  const written = await writePackageRunExecutionRecord(
    record,
    bundleReceipt.directory
  );
  assert.equal(written.status, "written");
  assert.equal(written.executionId, record.executionId);
  assert.equal(written.recordRef.path, `execution/${record.executionId.replace(":", "-")}.json`);
  assert.equal(validateExecutionReceipt(written), true, ajv.errorsText(
    validateExecutionReceipt.errors
  ));

  const repeated = await writePackageRunExecutionRecord(
    record,
    bundleReceipt.directory
  );
  assert.equal(repeated.status, "already-present");
  const concurrentRecord = createPackageRunExecutionRecord(executionRecordInput(
    bundle.runHash,
    {
      startedAt: "2026-08-12T11:00:00.000Z",
      completedAt: "2026-08-12T11:00:00.500Z",
      resourceUsage: {
        generatedCandidates: 1,
        perturbations: 0,
        nullTrials: 0,
        wallTimeMs: 500,
        exhausted: null
      }
    }
  ));
  const concurrentReceipts = await Promise.all([
    writePackageRunExecutionRecord(concurrentRecord, bundleReceipt.directory),
    writePackageRunExecutionRecord(concurrentRecord, bundleReceipt.directory)
  ]);
  assert.deepEqual(
    concurrentReceipts.map((entry) => entry.status).sort(),
    ["already-present", "written"]
  );

  const records = await readPackageRunExecutionRecords(bundleReceipt.directory);
  assert.deepEqual(
    records.map((entry) => entry.executionId),
    [record.executionId, concurrentRecord.executionId].sort()
  );
  assert.ok(Object.isFrozen(records));
  const reconstructed = await readPackageRunArtifactBundle(bundleReceipt.directory);
  assert.equal(reconstructed.bundle.bundleHash, bundle.bundleHash);
  assert.deepEqual(await readFile(envelopeFile), envelopeBefore);
  assert.equal(RUN_STORE_STATUS,
    "verified-directory-persistence-active/execution-records-active");
  assert.ok(RUN_STORE_CAPABILITIES.implemented.includes(
    "append-only-execution-record-writing"
  ));
});

test("execution records fail closed on invalid bindings, identities, and stored bytes", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-execution-invalid-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const { bundle } = bundleFixture();
  const bundleReceipt = await writePackageRunArtifactBundle(bundle, temporary);

  assert.throws(
    () => createPackageRunExecutionRecord(executionRecordInput(bundle.runHash, {
      completedAt: null
    })),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_EXECUTION_RECORD_COMPLETION_REQUIRED"
  );
  assert.throws(
    () => createPackageRunExecutionRecord(executionRecordInput(bundle.runHash, {
      completedAt: "2026-08-12T09:59:59.999Z"
    })),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_EXECUTION_RECORD_TIME_ORDER_INVALID"
  );

  const record = createPackageRunExecutionRecord(executionRecordInput(bundle.runHash));
  assert.throws(
    () => verifyPackageRunExecutionRecord({
      ...record,
      executionId: `sha256:${"0".repeat(64)}`
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_EXECUTION_RECORD_MISMATCH"
  );
  const wrongRunRecord = createPackageRunExecutionRecord(executionRecordInput(
    `sha256:${"0".repeat(64)}`
  ));
  await assert.rejects(
    () => writePackageRunExecutionRecord(wrongRunRecord, bundleReceipt.directory),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_EXECUTION_RECORD_RUN_MISMATCH"
  );

  const receipt = await writePackageRunExecutionRecord(
    record,
    bundleReceipt.directory
  );
  const file = path.join(
    bundleReceipt.directory,
    ...receipt.recordRef.path.split("/")
  );
  const canonical = await readFile(file);
  await writeFile(
    file,
    `${JSON.stringify(JSON.parse(canonical.toString("utf8")), null, 2)}\n`,
    "utf8"
  );
  await assert.rejects(
    () => readPackageRunExecutionRecords(bundleReceipt.directory),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_EXECUTION_RECORD_NON_CANONICAL"
  );
  await writeFile(file, canonical);

  const unexpected = path.join(bundleReceipt.directory, "execution", "unexpected.json");
  await writeFile(unexpected, "{}", "utf8");
  await assert.rejects(
    () => readPackageRunArtifactBundle(bundleReceipt.directory),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_DIRECTORY_CONTENT_MISMATCH"
  );
});
