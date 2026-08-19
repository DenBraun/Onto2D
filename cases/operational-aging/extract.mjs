import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "operational-aging.json");
const CASE_DOMAIN = "onto2d:operational-aging-case:v1";
const SOURCE_DOMAIN = "onto2d:operational-aging-source:v1";
const ENDPOINT_DOMAIN = "onto2d:operational-aging-endpoint:v1";
const TRAJECTORY_DOMAIN = "onto2d:operational-aging-trajectory:v1";
const APPROVED_CASE_IDENTITY = "sha256:a5a95df5511fd8992acc4df6dd17384a362d69e150fd180f01f62901e3a04e49";
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const HASH = /^[0-9a-f]{64}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const INPUT_LABELS = Object.freeze(["setting1", "setting2", "setting3", ...Array.from({ length: 21 }, (_, index) => `sensor${index + 1}`)]);
const FLAGSHIP_IDS = Object.freeze([25, 72]);
const EXPECTED_ACTIVE = Object.freeze(["setting1", "setting2", "sensor2", "sensor3", "sensor4", "sensor6", "sensor7", "sensor8", "sensor9", "sensor11", "sensor12", "sensor13", "sensor14", "sensor15", "sensor17", "sensor20", "sensor21"]);
const EXPECTED_ZERO_RANGE = Object.freeze(["setting3", "sensor1", "sensor5", "sensor10", "sensor16", "sensor18", "sensor19"]);
const EXPECTED_METRICS = Object.freeze({
  "current-combined": Object.freeze([0.082125416271, 78, 0.015757575758]),
  "current-sensors-only-control": Object.freeze([0.083710777228, 368, 0.074343434343]),
  "current-settings-only-control": Object.freeze([0.069085145288, 366, 0.073939393939]),
  "last-20-combined": Object.freeze([0.066452134448, 1439, 0.290707070707]),
  "full-history-combined": Object.freeze([0.035615328056, 1072, 0.216565656566])
});

function fail(message) { throw new Error(`Operational Aging extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function exactKeys(value, keys, label) { if (!isRecord(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`); }
function round(value, places) { return Number(value.toFixed(places)); }
function safePath(value, label) { if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`); return value; }

async function loadBytes(relative, limit = 512 * 1024) {
  safePath(relative, "input path");
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length < 1 || bytes.length > limit) fail(`${relative} is empty or exceeds ${limit} bytes`);
  return { path: relative, bytes };
}

async function loadJson(relative, limit) {
  const input = await loadBytes(relative, limit);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes); } catch { fail(`${relative} is not valid UTF-8`); }
  try { return { ...input, value: JSON.parse(text) }; } catch { fail(`${relative} is not valid JSON`); }
}

function fileEntry(role, input) { return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length }); }

function validateUpstream(value) {
  exactKeys(value, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "archive", "consumedMembers", "projectionGenerator", "snapshots", "selection"], "upstream lock");
  if (value.format !== "onto2d-operational-aging-upstream-lock" || value.formatVersion !== "1" || value.liveNetworkRequiredByBuild !== false || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.retrievedAt)) fail("upstream lock version or retrieval boundary differs");
  if (value.source?.id !== "nasa-cmapss-jet-engine-simulated-data" || !/^https:\/\/data\.nasa\.gov\//.test(value.source.landingPage ?? "") || value.source.licenseStatement !== "License not specified on the NASA Open Data dataset and resource pages" || !value.source.citation) fail("NASA source attribution differs");
  if (value.archive?.sha256 !== "74bef434a34db25c7bf72e668ea4cd52afe5f2cf8e44367c55a82bfd91a5a34f" || value.archive.bytes !== 12425978 || value.archive.memberCount !== 14 || value.archive.mediaType !== "application/zip") fail("NASA archive lock differs");
  if (!Array.isArray(value.consumedMembers) || !same(value.consumedMembers.map((file) => file.name), ["train_FD001.txt", "test_FD001.txt", "RUL_FD001.txt", "readme.txt", "Damage Propagation Modeling.pdf"])) fail("consumed member inventory differs");
  for (const file of value.consumedMembers) if (!HASH.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 1) fail(`${file.name} lock is incomplete`);
  if (!Array.isArray(value.snapshots) || !same(value.snapshots.map((snapshot) => snapshot.role), ["endpoint-projection", "flagship-history-projection"])) fail("source snapshot inventory differs");
  for (const snapshot of value.snapshots) { safePath(snapshot.path, `${snapshot.role}.path`); if (!HASH.test(snapshot.sha256) || !Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 1 || !Array.isArray(snapshot.derivedFrom)) fail(`${snapshot.role} lock is incomplete`); }
  if (value.projectionGenerator?.path !== "prepare-source.mjs" || !HASH.test(value.projectionGenerator.sha256) || !Number.isSafeInteger(value.projectionGenerator.bytes)) fail("projection generator lock differs");
  if (value.selection?.dataset !== "FD001" || !same(value.selection.flagshipUnitIds, FLAGSHIP_IDS) || value.selection.profile !== "nearest-five-percent-max-rul-separation-v1") fail("upstream selection differs");
  return value;
}

function finiteVector(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) fail(`${label} must contain ${length} finite numbers`);
  return value;
}

function validateEndpointProjection(value, upstream) {
  exactKeys(value, ["format", "formatVersion", "sourceFiles", "columns", "corpus", "normalization", "endpoints", "evidenceBoundary"], "endpoint projection");
  if (value.format !== "onto2d-cmapss-fd001-endpoint-projection" || value.formatVersion !== "1") fail("endpoint projection version differs");
  if (!same(value.sourceFiles, upstream.consumedMembers.map(({ role, name, sha256, bytes }) => ({ role, name, sha256, bytes })))) fail("endpoint source locks differ");
  const corpus = value.corpus;
  if (corpus.dataset !== "FD001" || corpus.operatingConditionCount !== 1 || corpus.operatingConditionLabel !== "Sea Level" || corpus.faultModeCount !== 1 || corpus.faultModeLabel !== "HPC Degradation" || corpus.trainUnitCount !== 100 || corpus.trainRowCount !== 20631 || corpus.trainMaximumCycle !== 362 || corpus.trainingEndsAtFailureThreshold !== true || corpus.testUnitCount !== 100 || corpus.testRowCount !== 13096 || corpus.testMaximumObservedCycle !== 303 || corpus.testEndsBeforeFailureThreshold !== true || corpus.providedRulCount !== 100 || corpus.providedRulMinimum !== 7 || corpus.providedRulMaximum !== 145) fail("FD001 corpus census differs");
  if (!same(value.normalization.dimensions.map((dimension) => dimension.label), INPUT_LABELS) || value.normalization.source !== "training-trajectories-only" || value.normalization.method !== "per-dimension training min-max" || value.normalization.activeDimensionCount !== 17 || value.normalization.zeroRangeDimensionCount !== 7) fail("normalization profile differs");
  const active = value.normalization.dimensions.filter((dimension) => dimension.activeInDistance).map((dimension) => dimension.label);
  const zero = value.normalization.dimensions.filter((dimension) => !dimension.activeInDistance).map((dimension) => dimension.label);
  if (!same(active, EXPECTED_ACTIVE) || !same(zero, EXPECTED_ZERO_RANGE)) fail("active-distance dimensions differ");
  for (const dimension of value.normalization.dimensions) {
    if (!Number.isFinite(dimension.minimum) || !Number.isFinite(dimension.maximum) || dimension.maximum < dimension.minimum || dimension.activeInDistance !== (dimension.maximum > dimension.minimum) || dimension.exclusionReason !== (dimension.activeInDistance ? null : "zero-training-range")) fail(`${dimension.label} range differs`);
  }
  if (!Array.isArray(value.endpoints) || value.endpoints.length !== 100 || !same(value.endpoints.map((endpoint) => endpoint.unitId), Array.from({ length: 100 }, (_, index) => index + 1))) fail("test endpoint inventory differs");
  for (const endpoint of value.endpoints) {
    finiteVector(endpoint.settings, 3, `unit ${endpoint.unitId} settings`); finiteVector(endpoint.sensors, 21, `unit ${endpoint.unitId} sensors`);
    finiteVector(endpoint.historyDescriptors?.last20ObservedMean?.settings, 3, `unit ${endpoint.unitId} last-20 settings`); finiteVector(endpoint.historyDescriptors?.last20ObservedMean?.sensors, 21, `unit ${endpoint.unitId} last-20 sensors`);
    finiteVector(endpoint.historyDescriptors?.fullObservedMean?.settings, 3, `unit ${endpoint.unitId} full-history settings`); finiteVector(endpoint.historyDescriptors?.fullObservedMean?.sensors, 21, `unit ${endpoint.unitId} full-history sensors`);
    if (!Number.isSafeInteger(endpoint.cycle) || endpoint.cycle !== endpoint.observedCycleCount || !Number.isSafeInteger(endpoint.providedRul) || endpoint.providedRul < 0 || endpoint.providedRulRole !== "held-out-outcome-only") fail(`unit ${endpoint.unitId} endpoint boundary differs`);
  }
  if (!same(value.evidenceBoundary.currentFrameFields, ["settings", "sensors"]) || !same(value.evidenceBoundary.excludedFromDistance, ["unitId", "cycle", "observedCycleCount", "providedRul"]) || value.evidenceBoundary.providedRulUsedAsInput !== false || value.evidenceBoundary.futureTestRowsAvailable !== false || value.evidenceBoundary.latentHealthObserved !== false) fail("endpoint evidence boundary differs");
  return value;
}

function validateHistoryProjection(value, endpoints) {
  exactKeys(value, ["format", "formatVersion", "sourceFiles", "selection", "histories", "evidenceBoundary"], "history projection");
  if (value.format !== "onto2d-cmapss-fd001-flagship-history-projection" || value.formatVersion !== "1" || value.selection.profile !== "nearest-five-percent-max-rul-separation-v1" || value.selection.pairUniverseSize !== 4950 || value.selection.eligiblePairCount !== 247 || value.selection.eligibleFraction !== 0.05 || !same(value.selection.selectedUnitIds, FLAGSHIP_IDS) || value.selection.selectionUsesProvidedRulOutcome !== true || value.selection.selectionBiased !== true) fail("history selection boundary differs");
  if (!Array.isArray(value.histories) || !same(value.histories.map((history) => history.unitId), FLAGSHIP_IDS)) fail("flagship history inventory differs");
  for (const history of value.histories) {
    const endpoint = endpoints.endpoints[history.unitId - 1];
    if (history.observedCycleCount !== endpoint.observedCycleCount || history.providedRul !== endpoint.providedRul || history.providedRulRole !== "held-out-outcome-only" || history.rows.length !== history.observedCycleCount) fail(`unit ${history.unitId} history metadata differs`);
    for (const [index, row] of history.rows.entries()) { if (row.cycle !== index + 1) fail(`unit ${history.unitId} cycle order differs`); finiteVector(row.settings, 3, `unit ${history.unitId} cycle ${row.cycle} settings`); finiteVector(row.sensors, 21, `unit ${history.unitId} cycle ${row.cycle} sensors`); }
    if (!same(history.rows.at(-1), { cycle: endpoint.cycle, settings: endpoint.settings, sensors: endpoint.sensors })) fail(`unit ${history.unitId} endpoint and history differ`);
  }
  if (value.evidenceBoundary.rowsContainOnlyObservedPrefix !== true || value.evidenceBoundary.futureCyclesSynthesized !== false || value.evidenceBoundary.latentHealthObserved !== false || value.evidenceBoundary.predictionIncluded !== false) fail("history evidence boundary differs");
  return value;
}

function validateProfile(value) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "dataset", "currentFrame", "pairSelection", "distanceProfiles", "outcome", "reachability", "historyEquivalence", "historicalLoad", "nonClaims"], "analysis profile");
  if (value.format !== "onto2d-operational-aging-analysis-profile" || value.formatVersion !== "1" || value.profileVersion !== "operational-aging-fd001-v1" || value.dataset !== "FD001") fail("analysis profile version differs");
  if (!same(value.currentFrame.fields, ["settings", "sensors"]) || !same(value.currentFrame.excludedFields, ["unitId", "cycle", "observedCycleCount", "providedRul"]) || value.currentFrame.normalization !== "training-min-max-v1" || value.currentFrame.distance !== "binary64-root-mean-square-v1" || value.currentFrame.reportDecimalPlaces !== 12 || value.currentFrame.zeroRangePolicy !== "retain-as-context-exclude-from-numeric-distance") fail("current-frame profile differs");
  if (value.pairSelection.unorderedPairCount !== 4950 || value.pairSelection.eligiblePairCount !== 247 || !same(value.pairSelection.expectedSelectedUnitIds, FLAGSHIP_IDS) || value.pairSelection.usesOutcomeForSelection !== true || value.pairSelection.selectionBiased !== true || value.pairSelection.predictiveEvaluationClaim !== false) fail("pair selection profile differs");
  if (!same(value.distanceProfiles.map((profile) => profile.id), Object.keys(EXPECTED_METRICS))) fail("distance profile inventory differs");
  for (const profile of value.distanceProfiles) if (!same([profile.expectedDistance, profile.expectedRank, profile.expectedPercentile], EXPECTED_METRICS[profile.id])) fail(`${profile.id} expected result differs`);
  if (value.outcome.field !== "providedRul" || value.outcome.role !== "held-out-outcome-only" || value.outcome.expectedLeftRul !== 145 || value.outcome.expectedRightRul !== 50 || value.outcome.expectedAbsoluteDifference !== 95 || value.outcome.predictedRulIncluded !== false || value.outcome.predictionStatus !== "not-evaluated") fail("outcome boundary differs");
  if (value.historyEquivalence.status !== "not-evaluated" || value.historicalLoad.status !== "not-evaluated" || value.historicalLoad.value !== null || !/undefined rather than zero/.test(value.historicalLoad.reason ?? "")) fail("non-primary analysis boundary differs");
  if (!Array.isArray(value.nonClaims) || value.nonClaims.length < 10 || new Set(value.nonClaims).size !== value.nonClaims.length) fail("non-claim boundary differs");
  return value;
}

function vector(record) { return [...record.settings, ...record.sensors]; }

function descriptor(endpoint, profile) {
  if (profile.window === "last-observed-row") return vector(endpoint);
  if (profile.window === "last-20-observed-rows-mean") return vector(endpoint.historyDescriptors.last20ObservedMean);
  if (profile.window === "all-observed-rows-mean") return vector(endpoint.historyDescriptors.fullObservedMean);
  fail(`${profile.id} has an unknown window`);
}

function dimensionIndexes(dimensions, scope) {
  const active = dimensions.map((dimension, index) => dimension.activeInDistance ? index : null).filter((index) => index !== null);
  if (scope === "all-nonconstant-settings-and-sensors") return active;
  if (scope === "all-nonconstant-sensors") return active.filter((index) => index >= 3);
  if (scope === "all-nonconstant-settings") return active.filter((index) => index < 3);
  fail(`unknown dimension scope ${scope}`);
}

function distance(left, right, dimensions, indexes) {
  const total = indexes.reduce((sum, index) => {
    const range = dimensions[index].maximum - dimensions[index].minimum;
    const delta = (left[index] - right[index]) / range;
    return sum + delta * delta;
  }, 0);
  return Math.sqrt(total / indexes.length);
}

function pairResults(endpoints, dimensions, profile, places) {
  const indexes = dimensionIndexes(dimensions, profile.dimensionScope);
  const projected = endpoints.map((endpoint) => ({ unitId: endpoint.unitId, providedRul: endpoint.providedRul, values: descriptor(endpoint, profile) }));
  const pairs = [];
  for (let left = 0; left < projected.length; left += 1) {
    for (let right = left + 1; right < projected.length; right += 1) {
      const a = projected[left]; const b = projected[right];
      pairs.push({ leftUnitId: a.unitId, rightUnitId: b.unitId, distance: distance(a.values, b.values, dimensions, indexes), absoluteProvidedRulDifference: Math.abs(a.providedRul - b.providedRul) });
    }
  }
  pairs.sort((a, b) => a.distance - b.distance || a.leftUnitId - b.leftUnitId || a.rightUnitId - b.rightUnitId);
  const selectedIndex = pairs.findIndex((pair) => pair.leftUnitId === FLAGSHIP_IDS[0] && pair.rightUnitId === FLAGSHIP_IDS[1]);
  if (pairs.length !== 4950 || selectedIndex < 0) fail(`${profile.id} pair universe differs`);
  const currentFrameInputFields = profile.window !== "last-observed-row"
    ? null
    : profile.dimensionScope === "all-nonconstant-sensors"
      ? ["sensors"]
      : profile.dimensionScope === "all-nonconstant-settings"
        ? ["settings"]
        : ["settings", "sensors"];
  return { pairs, selected: pairs[selectedIndex], result: { id: profile.id, label: profile.label, window: profile.window, dimensionScope: profile.dimensionScope, dimensionCount: indexes.length, distance: round(pairs[selectedIndex].distance, places), rank: selectedIndex + 1, pairUniverseSize: pairs.length, percentile: round((selectedIndex + 1) / pairs.length, places), currentFrameInputFields, historyRowsUsed: profile.window === "last-observed-row" ? 1 : profile.window === "last-20-observed-rows-mean" ? 20 : null, providedRulUsedAsInput: false, createsExactStateIdentity: false } };
}

function buildAnalysis(endpoints, profile) {
  const computed = new Map();
  for (const distanceProfile of profile.distanceProfiles) computed.set(distanceProfile.id, pairResults(endpoints.endpoints, endpoints.normalization.dimensions, distanceProfile, profile.currentFrame.reportDecimalPlaces));
  for (const distanceProfile of profile.distanceProfiles) {
    const result = computed.get(distanceProfile.id).result;
    if (!same([result.distance, result.rank, result.percentile], EXPECTED_METRICS[result.id])) fail(`${result.id} computed result differs`);
  }
  const current = computed.get("current-combined");
  const eligible = current.pairs.slice(0, profile.pairSelection.eligiblePairCount);
  const selected = [...eligible].sort((a, b) => b.absoluteProvidedRulDifference - a.absoluteProvidedRulDifference || a.distance - b.distance || a.leftUnitId - b.leftUnitId || a.rightUnitId - b.rightUnitId)[0];
  if (!same([selected.leftUnitId, selected.rightUnitId, selected.absoluteProvidedRulDifference], [25, 72, 95])) fail("flagship pair selection differs");
  return {
    pairSelection: { ...profile.pairSelection, eligibleDistanceMaximum: round(eligible.at(-1).distance, profile.currentFrame.reportDecimalPlaces), selectedUnitIds: FLAGSHIP_IDS, selectedPairRank: current.result.rank, selectedAbsoluteProvidedRulDifference: selected.absoluteProvidedRulDifference },
    distanceResults: profile.distanceProfiles.map((distanceProfile) => computed.get(distanceProfile.id).result)
  };
}

function verifySemantics(artifact) {
  if (artifact.format !== "onto2d-operational-aging-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "operational-aging-fd001-v1") fail("artifact version differs");
  const { caseIdentity, ...basis } = artifact;
  if (!IDENTITY.test(caseIdentity ?? "") || caseIdentity !== hashCanonical(CASE_DOMAIN, basis)) fail("case identity differs");
  if (!IDENTITY.test(artifact.source?.identity ?? "") || artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.license.statement !== "License not specified on the NASA Open Data dataset and resource pages") fail("source identity or license boundary differs");
  const sourceBasis = { authoredFiles: artifact.source.authoredFiles, snapshotFiles: artifact.source.snapshotFiles, archive: artifact.source.archive, consumedMembers: artifact.source.consumedMembers, citation: artifact.source.citation, license: artifact.source.license.statement };
  if (artifact.source.identity !== hashCanonical(SOURCE_DOMAIN, sourceBasis)) fail("source identity differs");
  if (artifact.corpus.dataset !== "FD001" || artifact.corpus.trainUnitCount !== 100 || artifact.corpus.testUnitCount !== 100 || artifact.corpus.trainRowCount !== 20631 || artifact.corpus.testRowCount !== 13096) fail("corpus census differs");
  if (!same(artifact.inputDefinition.activeDistanceDimensions, EXPECTED_ACTIVE) || !same(artifact.inputDefinition.zeroRangeContextDimensions, EXPECTED_ZERO_RANGE) || artifact.inputDefinition.providedRulUsedAsInput !== false || artifact.inputDefinition.cycleUsedInCurrentFrame !== false) fail("input boundary differs");
  if (artifact.endpointCohort.length !== 100 || !same(artifact.endpointCohort.map((endpoint) => endpoint.unitId), Array.from({ length: 100 }, (_, index) => index + 1)) || artifact.endpointCohort.some((endpoint) => !IDENTITY.test(endpoint.identity) || endpoint.providedRulRole !== "held-out-outcome-only" || endpoint.providedRulUsedAsInput !== false || endpoint.futureRowsAvailable !== false || endpoint.cycle !== endpoint.observedCycleCount)) fail("endpoint cohort differs");
  for (const endpoint of artifact.endpointCohort) {
    const { identity, ...endpointBasis } = endpoint;
    if (identity !== hashCanonical(ENDPOINT_DOMAIN, endpointBasis)) fail(`endpoint ${endpoint.unitId} identity differs`);
  }
  if (!same(artifact.flagship.unitIds, FLAGSHIP_IDS) || artifact.flagship.selectionBiased !== true || artifact.flagship.usesOutcomeForSelection !== true || artifact.flagship.predictiveEvaluationClaim !== false || artifact.flagship.currentFramesExactlyEqual !== false || artifact.flagship.declaredNearCurrentFrame !== true) fail("flagship interpretation differs");
  if (!same(artifact.distanceResults.map((result) => [result.distance, result.rank, result.percentile]), Object.values(EXPECTED_METRICS)) || artifact.distanceResults.some((result) => result.providedRulUsedAsInput || result.createsExactStateIdentity)) fail("distance results differ");
  if (!same(artifact.distanceResults.map((result) => result.currentFrameInputFields), [["settings", "sensors"], ["sensors"], ["settings"], null, null])) fail("distance input labels differ");
  if (!same(artifact.trajectories.map((trajectory) => [trajectory.unitId, trajectory.observedCycleCount, trajectory.providedRul, trajectory.impliedFailureCycle]), [[25, 48, 145, 193], [72, 131, 50, 181]])) fail("flagship trajectories or outcomes differ");
  for (const trajectory of artifact.trajectories) {
    if (!IDENTITY.test(trajectory.identity) || trajectory.rows.length !== trajectory.observedCycleCount || trajectory.rows.some((row, index) => row.cycle !== index + 1) || trajectory.futureRowsIncluded !== false || trajectory.latentHealthObserved !== false || trajectory.providedRulUsedAsInput !== false) fail(`trajectory ${trajectory.unitId} boundary differs`);
    const { identity, ...trajectoryBasis } = trajectory;
    if (identity !== hashCanonical(TRAJECTORY_DOMAIN, trajectoryBasis)) fail(`trajectory ${trajectory.unitId} identity differs`);
    const endpoint = artifact.endpointCohort[trajectory.unitId - 1];
    const finalRow = trajectory.rows.at(-1);
    if (trajectory.providedRul !== endpoint.providedRul || trajectory.observedCycleCount !== endpoint.observedCycleCount || !same(finalRow, { cycle: endpoint.cycle, settings: endpoint.settings, sensors: endpoint.sensors })) fail(`trajectory ${trajectory.unitId} does not end at its endpoint`);
  }
  if (artifact.outcomeComparison.leftProvidedRul !== 145 || artifact.outcomeComparison.rightProvidedRul !== 50 || artifact.outcomeComparison.absoluteDifference !== 95 || artifact.outcomeComparison.providedRulUsedAsInput !== false || artifact.outcomeComparison.predictedRul !== null || artifact.outcomeComparison.predictionStatus !== "not-evaluated") fail("outcome comparison differs");
  if (artifact.reachability.status !== "descriptive-source-outcome" || artifact.reachability.causalClaim !== false || artifact.reachability.universalPhysicalClaim !== false) fail("reachability boundary differs");
  if (artifact.latentHistoricalState.status !== "unobserved" || artifact.latentHistoricalState.directObservation !== false || artifact.latentHistoricalState.derivedHistoryMeansAreLatentState !== false || artifact.prediction.status !== "not-evaluated" || artifact.prediction.model !== null || artifact.prediction.predictions.length !== 0 || artifact.historyEquivalence.status !== "not-evaluated" || artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("unknown or non-primary boundary differs");
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved operational-aging-fd001-v1 release`);
  return artifact;
}

export function verifyOperationalAgingCaseIdentity(input) { if (!isRecord(input)) fail("artifact must be an object"); return verifySemantics(structuredClone(input)); }

export async function buildOperationalAgingCase() {
  const [upstreamInput, profileInput, endpointsInput, historiesInput, generatorInput] = await Promise.all([loadJson("upstream.json", 64 * 1024), loadJson("analysis-profile.json", 64 * 1024), loadJson("source/fd001-endpoints.json", 384 * 1024), loadJson("source/fd001-flagship-histories.json", 192 * 1024), loadBytes("prepare-source.mjs", 32 * 1024)]);
  const upstream = validateUpstream(upstreamInput.value);
  const profile = validateProfile(profileInput.value);
  const endpoints = validateEndpointProjection(endpointsInput.value, upstream);
  const histories = validateHistoryProjection(historiesInput.value, endpoints);
  for (const lock of upstream.snapshots) { const input = lock.role === "endpoint-projection" ? endpointsInput : historiesInput; if (lock.path !== input.path || lock.sha256 !== sha256(input.bytes) || lock.bytes !== input.bytes.length) fail(`${lock.role} does not match its lock`); }
  if (upstream.projectionGenerator.path !== generatorInput.path || upstream.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || upstream.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator does not match its lock");
  const authoredFiles = [fileEntry("upstream-lock", upstreamInput), fileEntry("analysis-profile", profileInput), fileEntry("projection-generator", generatorInput)];
  const snapshotFiles = [fileEntry("endpoint-projection", endpointsInput), fileEntry("flagship-history-projection", historiesInput)];
  const sourceBasis = { authoredFiles, snapshotFiles, archive: upstream.archive, consumedMembers: upstream.consumedMembers, citation: upstream.source.citation, license: upstream.source.licenseStatement };
  const source = { identity: hashCanonical(SOURCE_DOMAIN, sourceBasis), retrievedAt: upstream.retrievedAt, liveNetworkRequiredByBuild: false, landingPage: upstream.source.landingPage, datasetIdentifier: upstream.source.datasetIdentifier, resourceId: upstream.source.resourceId, authoredFiles, snapshotFiles, archive: upstream.archive, consumedMembers: upstream.consumedMembers, citation: upstream.source.citation, license: { statement: upstream.source.licenseStatement, specifiedBySource: false } };
  const analysis = buildAnalysis(endpoints, profile);
  const endpointCohort = endpoints.endpoints.map((endpoint) => {
    const withoutIdentity = { unitId: endpoint.unitId, split: "test", cycle: endpoint.cycle, observedCycleCount: endpoint.observedCycleCount, settings: endpoint.settings, sensors: endpoint.sensors, historyDescriptors: endpoint.historyDescriptors, providedRul: endpoint.providedRul, providedRulRole: endpoint.providedRulRole, providedRulUsedAsInput: false, futureRowsAvailable: false, evidenceState: "source-projected-simulated-endpoint" };
    return Object.freeze({ ...withoutIdentity, identity: hashCanonical(ENDPOINT_DOMAIN, withoutIdentity) });
  });
  const trajectories = histories.histories.map((history) => {
    const trajectoryBasis = { unitId: history.unitId, split: "test", observedCycleCount: history.observedCycleCount, providedRul: history.providedRul, providedRulRole: history.providedRulRole, impliedFailureCycle: history.observedCycleCount + history.providedRul, rows: history.rows, futureRowsIncluded: false, futureRowsSynthesized: false, latentHealthObserved: false, providedRulUsedAsInput: false, evidenceState: "source-projected-observed-prefix" };
    return Object.freeze({ ...trajectoryBasis, identity: hashCanonical(TRAJECTORY_DOMAIN, trajectoryBasis) });
  });
  const currentFrames = FLAGSHIP_IDS.map((unitId) => endpointCohort[unitId - 1]);
  const withoutIdentity = {
    format: "onto2d-operational-aging-case", formatVersion: "1", caseVersion: "operational-aging-fd001-v1", source,
    corpus: endpoints.corpus,
    inputDefinition: { fields: profile.currentFrame.fields, excludedFields: profile.currentFrame.excludedFields, normalization: profile.currentFrame.normalization, distance: profile.currentFrame.distance, activeDistanceDimensions: EXPECTED_ACTIVE, zeroRangeContextDimensions: EXPECTED_ZERO_RANGE, operatingSettingsRetained: true, providedRulUsedAsInput: false, cycleUsedInCurrentFrame: false, unitIdUsedInCurrentFrame: false },
    endpointCohort,
    flagship: { unitIds: FLAGSHIP_IDS, selectionProfile: profile.pairSelection.selectionRule, pairUniverseSize: analysis.pairSelection.unorderedPairCount, eligiblePairCount: analysis.pairSelection.eligiblePairCount, eligibleDistanceMaximum: analysis.pairSelection.eligibleDistanceMaximum, currentCombinedRank: analysis.pairSelection.selectedPairRank, usesOutcomeForSelection: true, selectionBiased: true, predictiveEvaluationClaim: false, currentFramesExactlyEqual: same(vector(currentFrames[0]), vector(currentFrames[1])), declaredNearCurrentFrame: true },
    distanceResults: analysis.distanceResults,
    trajectories,
    outcomeComparison: { leftUnitId: 25, rightUnitId: 72, leftProvidedRul: 145, rightProvidedRul: 50, absoluteDifference: 95, leftImpliedFailureCycle: 193, rightImpliedFailureCycle: 181, providedRulRole: "held-out-outcome-only", providedRulUsedAsInput: false, predictedRul: null, predictionStatus: "not-evaluated" },
    operatingContext: { conditionCount: 1, conditionLabel: "Sea Level", settingFieldsRetained: ["setting1", "setting2", "setting3"], activeSettingFields: ["setting1", "setting2"], constantSettingFields: ["setting3"], sensorsOnlyControlRank: analysis.distanceResults.find((result) => result.id === "current-sensors-only-control").rank, combinedCurrentRank: analysis.distanceResults.find((result) => result.id === "current-combined").rank, multipleConditionGeneralizationClaim: false },
    reachability: profile.reachability,
    latentHistoricalState: { status: "unobserved", directObservation: false, sourceDisclosure: "Participants were not given the simulator health index explicitly.", derivedHistoryMeansAreLatentState: false },
    prediction: { status: "not-evaluated", model: null, predictions: [], trainingTestLeakageChecked: true },
    historyEquivalence: profile.historyEquivalence,
    historicalLoad: profile.historicalLoad,
    evidenceBoundary: { observed: "FD001 test rows are simulated sensor and setting snapshots over an observed prefix.", providedOutcome: "RUL_FD001 supplies one held-out remaining-cycle outcome per test endpoint.", derived: "Training-range normalization, distances, ranks, history means, and implied failure cycles are deterministic analysis artifacts.", unknown: "The simulator health index and exact latent degradation state are not present in participant data.", counterfactual: "No future test rows or alternative operational histories are synthesized.", nonClaims: profile.nonClaims }
  };
  return verifySemantics(Object.freeze({ ...withoutIdentity, caseIdentity: hashCanonical(CASE_DOMAIN, withoutIdentity) }));
}

export async function run({ verify = false } = {}) {
  const artifact = await buildOperationalAgingCase();
  const expected = serialize(artifact);
  if (verify) assert.equal(await readFile(OUTPUT, "utf8"), expected);
  else { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, expected); }
  console.log(`${verify ? "Verified" : "Built"} Operational Aging ${artifact.caseIdentity}: ${artifact.endpointCohort.length} endpoints, pair ${artifact.flagship.unitIds.join("/")}, RUL delta ${artifact.outcomeComparison.absoluteDifference}.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) { console.error(`Unknown argument ${unknown[0]}`); process.exitCode = 2; }
  else run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
