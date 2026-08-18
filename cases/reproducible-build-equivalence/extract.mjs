import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildDeterministicArtifact, loadBuildFixture } from "./src/build-fixture.mjs";
import { compareBuildHistories, validateEquivalenceProfile } from "./src/history-equivalence.mjs";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "reproducible-build-equivalence.json");
const CASE_DOMAIN = "onto2d:reproducible-build-equivalence-case:v1";
const SOURCE_DOMAIN = "onto2d:reproducible-build-equivalence-evidence:v1";
const BUILD_SOURCE_DOMAIN = "onto2d:reproducible-build-source:v1";
const INSTRUCTIONS_DOMAIN = "onto2d:reproducible-build-instructions:v1";
const DECLARED_INPUT_DOMAIN = "onto2d:reproducible-build-declared-input:v1";
const HISTORY_DOMAIN = "onto2d:reproducible-build-history:v1";
const HASH = /^sha256:[0-9a-f]{64}$/;
const EXECUTION_IDS = Object.freeze(["baseline-node24", "baseline-node22", "ambient-variation-node24", "relevant-input-node24"]);
const COMPARISON_SPECS = Object.freeze([
  Object.freeze({ id: "cross-toolchain-rebuild", label: "Same inputs, different Node toolchain", left: "baseline-node24", right: "baseline-node22" }),
  Object.freeze({ id: "irrelevant-environment-variation", label: "Irrelevant ambient value changed", left: "baseline-node24", right: "ambient-variation-node24" }),
  Object.freeze({ id: "relevant-input-mutation", label: "Declared release channel changed", left: "baseline-node24", right: "relevant-input-node24" })
]);

function fail(message) {
  throw new Error(`Reproducible Build Equivalence extraction failed: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function json(relativePath, limit = 256 * 1024) {
  const bytes = await readFile(path.join(CASE_ROOT, relativePath));
  if (bytes.length > limit) fail(`${relativePath} exceeds its ${limit}-byte limit`);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { bytes, value: JSON.parse(text) };
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!same(actual, wanted)) fail(`${label} fields must be exactly ${wanted.join(", ")}`);
}

function validateExecution(record, fixture, expectedId) {
  exactKeys(record, ["format", "formatVersion", "executionId", "capturedAt", "runtime", "declaredInputs", "environment", "artifact"], `execution ${expectedId}`);
  if (record.format !== "onto2d-build-execution-record" || record.formatVersion !== "1" || record.executionId !== expectedId) fail(`${expectedId} record identity differs`);
  if (!Number.isFinite(Date.parse(record.capturedAt))) fail(`${expectedId}.capturedAt is invalid`);
  exactKeys(record.runtime, ["name", "version", "major", "platform", "architecture"], `${expectedId}.runtime`);
  if (record.runtime.name !== "Node.js" || !/^\d+\.\d+\.\d+$/.test(record.runtime.version) || Number(record.runtime.version.split(".", 1)[0]) !== record.runtime.major) fail(`${expectedId}.runtime is invalid`);
  if (!Number.isSafeInteger(record.runtime.major) || record.runtime.major < 20 || typeof record.runtime.platform !== "string" || typeof record.runtime.architecture !== "string") fail(`${expectedId}.runtime fields are invalid`);
  const expectedRuntime = expectedId === "baseline-node22"
    ? { name: "Node.js", version: "22.23.2", major: 22, platform: "darwin", architecture: "arm64" }
    : { name: "Node.js", version: "24.19.0", major: 24, platform: "darwin", architecture: "arm64" };
  if (!same(record.runtime, expectedRuntime)) fail(`${expectedId}.runtime differs from the frozen v1 capture boundary`);
  exactKeys(record.declaredInputs, ["sourceIdentity", "instructionsIdentity", "parameters", "identity"], `${expectedId}.declaredInputs`);
  if (![record.declaredInputs.sourceIdentity, record.declaredInputs.instructionsIdentity, record.declaredInputs.identity, record.artifact?.sha256].every((value) => HASH.test(value ?? ""))) fail(`${expectedId} has an invalid SHA-256 identity`);
  exactKeys(record.environment, ["normalized", "observedIrrelevant"], `${expectedId}.environment`);
  exactKeys(record.environment.normalized, ["LANG", "TZ", "SOURCE_DATE_EPOCH"], `${expectedId}.environment.normalized`);
  exactKeys(record.environment.observedIrrelevant, ["ONTO2D_SESSION_LABEL"], `${expectedId}.environment.observedIrrelevant`);
  if (!same(record.environment.normalized, fixture.spec.instructions.declaredEnvironment)) fail(`${expectedId} normalized environment differs from the build contract`);
  exactKeys(record.artifact, ["path", "mediaType", "encoding", "bytes", "sha256", "utf8"], `${expectedId}.artifact`);
  const expectedParameterSet = expectedId === "relevant-input-node24" ? "relevant-mutation" : "baseline";
  const rebuilt = buildDeterministicArtifact(fixture, fixture.spec.parameters[expectedParameterSet]);
  if (!same(record.declaredInputs, rebuilt.declaredInputs) || !same(record.artifact, rebuilt.artifact)) fail(`${expectedId} does not reproduce from its declared inputs`);
  if (record.artifact.bytes !== Buffer.byteLength(record.artifact.utf8, "utf8") || record.artifact.sha256 !== `sha256:${sha256(Buffer.from(record.artifact.utf8, "utf8"))}`) fail(`${expectedId} artifact bytes or digest differ`);
  return Object.freeze({ ...record, historyIdentity: hashCanonical(HISTORY_DOMAIN, record) });
}

function verifyExpectedMatrix(comparisons) {
  const expected = {
    "cross-toolchain-rebuild": [true, true, false, true, false],
    "irrelevant-environment-variation": [true, true, true, true, false],
    "relevant-input-mutation": [false, false, true, true, false]
  };
  for (const comparison of comparisons) {
    if (!same(comparison.regimes.map((regime) => regime.equal), expected[comparison.id])) fail(`${comparison.id} result matrix differs from the reviewed experiment`);
  }
}

function verifyArtifactSource(source) {
  exactKeys(source, ["identity", "authoredFiles", "sourceFiles", "liveNetworkRequiredByBuild"], "artifact source");
  if (source.liveNetworkRequiredByBuild !== false) fail("artifact source unexpectedly requires live network access");
  if (!Array.isArray(source.authoredFiles) || !same(source.authoredFiles.map((file) => file.path), ["build-spec.json", "equivalence-profile.json", "fixture/executions.json"])) fail("authored source inventory differs");
  for (const [index, file] of source.authoredFiles.entries()) {
    exactKeys(file, ["path", "bytes", "identity"], `authoredFiles[${index}]`);
    if (!HASH.test(file.identity) || !Number.isSafeInteger(file.bytes) || file.bytes < 1) fail(`authoredFiles[${index}] identity is invalid`);
  }
  if (!Array.isArray(source.sourceFiles) || !same(source.sourceFiles.map((file) => file.path), ["fixture/source/manifest.json", "fixture/source/message.txt", "src/build-fixture.mjs"])) fail("build source inventory differs");
  const sourceFiles = source.sourceFiles.map((file, index) => {
    exactKeys(file, ["path", "sha256", "bytes", "identity"], `sourceFiles[${index}]`);
    if (!/^[0-9a-f]{64}$/.test(file.sha256) || file.identity !== `sha256:${file.sha256}` || !Number.isSafeInteger(file.bytes) || file.bytes < 1) fail(`sourceFiles[${index}] identity is invalid`);
    return { path: file.path, sha256: file.sha256, bytes: file.bytes };
  });
  const expectedIdentity = hashCanonical(SOURCE_DOMAIN, {
    authoredFiles: source.authoredFiles.map((file) => file.identity),
    sourceFiles
  });
  if (source.identity !== expectedIdentity) fail("source identity was substituted");
  return sourceFiles;
}

function verifyArtifactHistory(history, expectedId, build) {
  exactKeys(history, ["format", "formatVersion", "executionId", "capturedAt", "runtime", "declaredInputs", "environment", "artifact", "historyIdentity"], `history ${expectedId}`);
  if (history.format !== "onto2d-build-execution-record" || history.formatVersion !== "1" || history.executionId !== expectedId || !Number.isFinite(Date.parse(history.capturedAt))) fail(`${expectedId} history header is invalid`);
  const { historyIdentity, ...record } = history;
  if (!HASH.test(historyIdentity) || hashCanonical(HISTORY_DOMAIN, record) !== historyIdentity) fail(`${expectedId} history identity was substituted`);
  const expectedRuntime = expectedId === "baseline-node22"
    ? { name: "Node.js", version: "22.23.2", major: 22, platform: "darwin", architecture: "arm64" }
    : { name: "Node.js", version: "24.19.0", major: 24, platform: "darwin", architecture: "arm64" };
  if (!same(history.runtime, expectedRuntime)) fail(`${expectedId} runtime differs from the frozen v1 capture boundary`);
  const expectedChannel = expectedId === "relevant-input-node24" ? "preview" : "stable";
  if (!same(history.declaredInputs?.parameters, { releaseChannel: expectedChannel })) fail(`${expectedId} declared parameters differ`);
  if (history.declaredInputs.sourceIdentity !== build.sourceIdentity || history.declaredInputs.instructionsIdentity !== build.instructionsIdentity) fail(`${expectedId} declared input references differ`);
  const expectedInputIdentity = hashCanonical(DECLARED_INPUT_DOMAIN, {
    sourceIdentity: build.sourceIdentity,
    instructionsIdentity: build.instructionsIdentity,
    parameters: history.declaredInputs.parameters
  });
  if (history.declaredInputs.identity !== expectedInputIdentity) fail(`${expectedId} declared input identity was substituted`);
  if (!same(history.environment?.normalized, build.instructions.declaredEnvironment)) fail(`${expectedId} normalized environment differs from the build contract`);
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(history.environment?.observedIrrelevant?.ONTO2D_SESSION_LABEL ?? "")) fail(`${expectedId} ambient record is invalid`);
  if (history.artifact?.path !== build.artifact.path || history.artifact.mediaType !== build.artifact.mediaType || history.artifact.encoding !== build.artifact.encoding) fail(`${expectedId} artifact contract differs`);
  const artifactBytes = Buffer.from(history.artifact.utf8 ?? "", "utf8");
  if (history.artifact.bytes !== artifactBytes.length || history.artifact.sha256 !== `sha256:${sha256(artifactBytes)}`) fail(`${expectedId} artifact bytes or digest differ`);
  return history;
}

function verifyArtifactSemantics(artifact) {
  exactKeys(artifact, ["format", "formatVersion", "caseVersion", "generatedBy", "source", "methodology", "build", "regimes", "histories", "comparisons", "conclusion", "historicalLoad", "evidenceBoundary", "caseIdentity"], "case artifact");
  if (artifact.caseVersion !== "reproducible-build-equivalence-v1" || artifact.generatedBy !== "cases/reproducible-build-equivalence/extract.mjs") fail("case version or generator was substituted");
  const sourceFiles = verifyArtifactSource(artifact.source);
  if (artifact.build?.sourceIdentity !== hashCanonical(BUILD_SOURCE_DOMAIN, sourceFiles)) fail("build source identity was substituted");
  if (artifact.build.instructionsIdentity !== hashCanonical(INSTRUCTIONS_DOMAIN, artifact.build.instructions)) fail("build instruction identity was substituted");
  if (artifact.build.instructions?.builder !== "src/build-fixture.mjs" || artifact.build.instructions.format !== "onto2d-deterministic-text-bundle-v1" || artifact.build.instructions.sourceDateEpoch !== 1786924800) fail("build instruction contract differs");
  const profile = validateEquivalenceProfile({
    format: "onto2d-build-history-equivalence-profile",
    formatVersion: "1",
    profileVersion: "build-history-equivalence-v1",
    regimes: artifact.regimes,
    pairOrder: COMPARISON_SPECS.map((comparison) => comparison.id),
    nonClaims: artifact.evidenceBoundary?.nonClaims
  });
  if (!Array.isArray(artifact.histories) || !same(artifact.histories.map((history) => history.executionId), EXECUTION_IDS)) fail("history inventory is incomplete or reordered");
  const histories = artifact.histories.map((history, index) => verifyArtifactHistory(history, EXECUTION_IDS[index], artifact.build));
  if (!same(histories.map((history) => history.environment.observedIrrelevant.ONTO2D_SESSION_LABEL), ["alpha", "beta", "gamma", "delta"])) fail("ambient variation evidence differs");
  const timestamps = histories.map((history) => Date.parse(history.capturedAt));
  if (!same(timestamps, [...timestamps].sort((left, right) => left - right))) fail("capture records are not chronological");
  const expectedOutputs = [...new Map(histories.map((history) => [history.artifact.sha256, history.artifact])).values()];
  if (!same(artifact.build.specifiedOutputs, expectedOutputs)) fail("specified output inventory was substituted");
  const historyIndex = new Map(histories.map((history) => [history.executionId, history]));
  const comparisons = COMPARISON_SPECS.map((comparison) => compareBuildHistories(comparison, historyIndex.get(comparison.left), historyIndex.get(comparison.right), profile));
  if (!same(artifact.comparisons, comparisons)) fail("history-equivalence results were substituted");
  verifyExpectedMatrix(comparisons);
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
}

export async function buildReproducibleBuildEquivalenceCase() {
  const [fixture, profileFile, executionsFile] = await Promise.all([
    loadBuildFixture(),
    json("equivalence-profile.json", 64 * 1024),
    json("fixture/executions.json")
  ]);
  const profile = validateEquivalenceProfile(profileFile.value);
  if (executionsFile.value?.format !== "onto2d-build-execution-set" || executionsFile.value.formatVersion !== "1") fail("execution set format differs");
  if (!Array.isArray(executionsFile.value.records) || !same(executionsFile.value.records.map((record) => record.executionId), fixture.spec.executions)) fail("execution record inventory is incomplete or reordered");
  const histories = executionsFile.value.records.map((record, index) => validateExecution(record, fixture, fixture.spec.executions[index]));
  if (new Set(histories.map((history) => history.historyIdentity)).size !== histories.length) fail("distinct executions collapsed to one history identity");
  if (!same(histories.map((history) => history.environment.observedIrrelevant.ONTO2D_SESSION_LABEL), ["alpha", "beta", "gamma", "delta"])) fail("ambient variation evidence differs");
  if (!same(histories.map((history) => history.runtime.major), [24, 22, 24, 24])) fail("toolchain capture evidence differs");
  const timestamps = histories.map((history) => Date.parse(history.capturedAt));
  if (!same(timestamps, [...timestamps].sort((left, right) => left - right))) fail("capture records are not chronological");
  const historyIndex = new Map(histories.map((history) => [history.executionId, history]));
  if (!same(fixture.spec.comparisons.map((comparison) => comparison.id), profile.pairOrder)) fail("comparison order differs from the equivalence profile");
  const comparisons = fixture.spec.comparisons.map((comparison) => compareBuildHistories(comparison, historyIndex.get(comparison.left), historyIndex.get(comparison.right), profile));
  verifyExpectedMatrix(comparisons);

  const authoredFiles = [
    { path: "build-spec.json", bytes: fixture.specBytes },
    { path: "equivalence-profile.json", bytes: profileFile.bytes },
    { path: "fixture/executions.json", bytes: executionsFile.bytes }
  ].map((entry) => ({ path: entry.path, bytes: entry.bytes.length, identity: `sha256:${sha256(entry.bytes)}` }));
  const source = {
    identity: hashCanonical(SOURCE_DOMAIN, {
      authoredFiles: authoredFiles.map((file) => file.identity),
      sourceFiles: fixture.spec.sourceFiles
    }),
    authoredFiles,
    sourceFiles: fixture.spec.sourceFiles.map((file) => ({ ...file, identity: `sha256:${file.sha256}` })),
    liveNetworkRequiredByBuild: false
  };
  const basis = {
    format: "onto2d-reproducible-build-equivalence-case",
    formatVersion: "1",
    caseVersion: fixture.spec.caseVersion,
    generatedBy: "cases/reproducible-build-equivalence/extract.mjs",
    source,
    methodology: fixture.spec.methodology,
    build: {
      artifact: fixture.spec.artifact,
      instructions: fixture.spec.instructions,
      sourceIdentity: fixture.sourceIdentity,
      instructionsIdentity: fixture.instructionsIdentity,
      specifiedOutputs: [...new Map(histories.map((history) => [history.artifact.sha256, history.artifact])).values()]
    },
    regimes: profile.regimes,
    histories,
    comparisons,
    conclusion: {
      status: "regime-relative-equivalence-demonstrated",
      flagship: "The Node.js 24 and Node.js 22 executions are byte-output and declared-input equivalent while remaining toolchain- and provenance-distinct.",
      ambientControl: "Changing ONTO2D_SESSION_LABEL leaves byte, declared-input, toolchain, and normalized-environment equivalence unchanged because the profile explicitly excludes it.",
      relevantControl: "Changing the declared releaseChannel changes declared-input identity and output bytes while leaving toolchain and normalized-environment equivalence unchanged."
    },
    historicalLoad: {
      status: "not-evaluated",
      value: null,
      reason: "This case compares whether two histories are equivalent under a declared regime. It does not define candidate routes, an admissibility predicate, or a cost function, so Historical Load would be undefined rather than zero."
    },
    evidenceBoundary: {
      directRecords: ["four captured local execution records", "exact source bytes", "exact produced artifact bytes", "runtime version and platform reported by each capture process"],
      derived: ["source, instruction, input, history, and regime projection identities", "pairwise equivalence verdicts", "differing-field lists"],
      excluded: ["ONTO2D_SESSION_LABEL from normalized environment identity"],
      unknown: ["cross-machine reproducibility", "non-Darwin reproducibility", "builder trustworthiness", "behavior outside Node.js 22.23.2 and 24.19.0", "transitive equivalence across different regimes"],
      nonClaims: profile.nonClaims
    }
  };
  return Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) });
}

export function verifyReproducibleBuildEquivalenceCaseIdentity(input) {
  const artifact = structuredClone(input);
  if (artifact?.format !== "onto2d-reproducible-build-equivalence-case" || artifact.formatVersion !== "1" || !HASH.test(artifact.caseIdentity ?? "")) fail("artifact identity header is invalid");
  verifyArtifactSemantics(artifact);
  const { caseIdentity, ...basis } = artifact;
  if (hashCanonical(CASE_DOMAIN, basis) !== caseIdentity) fail("case identity does not match artifact content");
  return artifact;
}

export async function writeReproducibleBuildEquivalenceCase(artifact) {
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, serialize(artifact));
  return OUTPUT;
}

export async function run({ verify = false } = {}) {
  const artifact = await buildReproducibleBuildEquivalenceCase();
  verifyReproducibleBuildEquivalenceCaseIdentity(artifact);
  if (verify) {
    const committed = await readFile(OUTPUT, "utf8");
    assert.equal(committed, serialize(artifact), "Committed Reproducible Build Equivalence artifact differs from exact reproduction.");
  } else {
    await writeReproducibleBuildEquivalenceCase(artifact);
  }
  console.log(`${verify ? "Verified" : "Built"} Reproducible Build Equivalence ${artifact.caseIdentity}: ${artifact.histories.length} histories, ${artifact.comparisons.length} pairs, ${artifact.regimes.length} regimes.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
