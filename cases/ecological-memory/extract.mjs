import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "ecological-memory.json");
const CASE_DOMAIN = "onto2d:ecological-memory-case:v1";
const SOURCE_DOMAIN = "onto2d:ecological-memory-source:v1";
const SURVEY_DOMAIN = "onto2d:ecological-memory-survey:v1";
const EVENT_DOMAIN = "onto2d:ecological-memory-event-group:v1";
const ANALYSIS_DOMAIN = "onto2d:ecological-memory-analysis:v1";
const APPROVED_CASE_IDENTITY = "sha256:d6ceb3b9a5d131e4247ee8c55efd78fea940a9c3957859cbf7fe1c2082190071";
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const HASH = /^[0-9a-f]{64}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const GIT_BLOB = /^[0-9a-f]{40}$/;
const STATE_FIELDS = Object.freeze(["heightP20", "heightP50", "heightP75", "heightP90"]);
const SURVEY_YEARS = Object.freeze([2019, 2021]);
const EXPECTED_POINT_COUNTS = Object.freeze([3015329, 15278262]);
const EXPECTED_CLASSIFICATIONS = Object.freeze([
  Object.freeze({ "1": 647413, "2": 698646, "5": 1575195, "6": 93988, "7": 87 }),
  Object.freeze({ "1": 2107584, "2": 7506828, "5": 5662973, "6": 829, "7": 48 })
]);

function fail(message) { throw new Error(`Ecological Memory extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function round(value, places = 6) { return Number(value.toFixed(places)); }
function exactKeys(value, keys, label) { if (!isRecord(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`); }
function finite(value, label) { if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be finite`); return value; }
function safePath(value, label) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`);
  return value;
}

async function loadBytes(relative, limit = 8 * 1024 * 1024) {
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

function fileEntry(role, input) {
  return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length });
}

function validateUpstream(value) {
  exactKeys(value, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "tutorials", "externalFiles", "projectionGenerator", "snapshots", "selection"], "upstream lock");
  if (value.format !== "onto2d-ecological-memory-upstream-lock" || value.formatVersion !== "1" || value.liveNetworkRequiredByBuild !== false || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.retrievedAt)) fail("upstream lock version or retrieval boundary differs");
  if (value.source?.id !== "neon-soap-creek-fire-lidar-tutorial-cohort" || value.source.publisher !== "National Ecological Observatory Network (NEON)" || !/^https:\/\/www\.neonscience\.org\//.test(value.source.landingPage ?? "") || !/CC BY 4\.0/.test(value.source.license ?? "") || !value.source.citation) fail("NEON source attribution differs");
  if (!Array.isArray(value.tutorials) || !same(value.tutorials.map((item) => item.role), ["event-query-output", "fire-affected-tile-interpretation-and-analysis-protocol"])) fail("tutorial lock inventory differs");
  for (const tutorial of value.tutorials) if (tutorial.repository !== "NEONScience/NEON-Data-Skills" || !GIT_BLOB.test(tutorial.gitBlob ?? "") || !HASH.test(tutorial.sha256 ?? "") || !Number.isSafeInteger(tutorial.bytes) || tutorial.bytes < 1) fail(`${tutorial.role} tutorial lock differs`);
  const expectedExternal = [
    ["pre-fire-lidar", "DP1.30003.001", 2019, "62be6c7649625ba20dfc40cc5136f4c31b894319b59abb3117657017025060d9", 21403480],
    ["post-fire-lidar", "DP1.30003.001", 2021, "e0a7a5a6871587c5b36395128bd9fc48a7c50ae72de676c239efc0ca351ae09a", 119247766],
    ["shared-terrain-reference", "DP3.30024.001", 2021, "90ee3b76207542694e8e04d2c6289a5093fd0d8b6ce4b07d25533b2061acc1ab", 4009492]
  ];
  if (!Array.isArray(value.externalFiles) || !same(value.externalFiles.map((file) => [file.role, file.productId, file.year, file.sha256, file.bytes]), expectedExternal)) fail("external file locks differ");
  for (const file of value.externalFiles) if (!file.googleDriveFileId || !file.name || !file.mediaType) fail(`${file.role} external lock is incomplete`);
  if (value.projectionGenerator?.path !== "prepare-source.py" || !HASH.test(value.projectionGenerator.sha256 ?? "") || value.projectionGenerator.bytes !== 9620 || !same(value.projectionGenerator.dependencies, ["numpy==2.0.2", "laspy==2.6.1", "lazrs==0.6.3", "rasterio==1.4.3"])) fail("projection generator lock differs");
  if (!Array.isArray(value.snapshots) || !same(value.snapshots.map((snapshot) => snapshot.role), ["lidar-state-projection", "recorded-event-projection"])) fail("snapshot lock inventory differs");
  for (const snapshot of value.snapshots) { safePath(snapshot.path, `${snapshot.role}.path`); if (!HASH.test(snapshot.sha256 ?? "") || !Number.isSafeInteger(snapshot.bytes) || !Array.isArray(snapshot.derivedFrom)) fail(`${snapshot.role} snapshot lock differs`); }
  if (value.selection?.siteCode !== "SOAP" || value.selection.tile !== "293000_4100000" || !same(value.selection.surveyYears, SURVEY_YEARS) || value.selection.recordedEvent !== "Creek Fire" || value.selection.profile !== "soap-classified-vegetation-height-v1" || value.selection.formalReleaseTag !== null) fail("upstream selection differs");
  return value;
}

function validateProjection(value, upstream) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "sourceFiles", "site", "terrainReference", "projection", "surveys", "evidenceBoundary"], "LiDAR projection");
  if (value.format !== "onto2d-neon-soap-lidar-projection" || value.formatVersion !== "1" || value.profileVersion !== "soap-classified-vegetation-height-v1") fail("LiDAR projection version differs");
  const expectedFiles = upstream.externalFiles.map(({ role, name, bytes, sha256: hash }) => ({ role, name, bytes, sha256: hash }));
  if (!same(value.sourceFiles, expectedFiles)) fail("LiDAR source file locks differ");
  if (!same(value.site, { siteCode: "SOAP", siteName: "Soaproot Saddle", domainId: "D17", tile: "293000_4100000" })) fail("LiDAR site projection differs");
  if (value.terrainReference?.width !== 1000 || value.terrainReference.height !== 1000 || value.terrainReference.crs !== "EPSG:32611" || !same(value.terrainReference.transform, [1, 0, 293000, 0, -1, 4101000, 0, 0, 1]) || value.terrainReference.noData !== -9999) fail("terrain reference differs");
  const projection = value.projection;
  if (projection.classificationCode !== 5 || projection.classificationLabel !== "high vegetation" || projection.heightReference !== "2021 DTM" || !same(projection.heightRangeMeters, [0, 80]) || projection.cellSizeMeters !== 10 || projection.minimumReturnsPerCell !== 50 || !same(projection.quantiles, [0.2, 0.5, 0.75, 0.9]) || projection.quantileMethod !== "numpy-linear" || projection.nativeRecordsRetainedExternally !== true || projection.projectionIsFullEcosystemState !== false) fail("state projection policy differs");
  if (!Array.isArray(value.surveys) || !same(value.surveys.map((survey) => survey.year), SURVEY_YEARS)) fail("survey inventory differs");
  const expectedQualified = [7754, 8800];
  for (const [index, survey] of value.surveys.entries()) {
    if (survey.pointCount !== EXPECTED_POINT_COUNTS[index] || !same(survey.classificationCounts, EXPECTED_CLASSIFICATIONS[index]) || survey.qualifiedCellCount !== expectedQualified[index] || !Array.isArray(survey.cells) || survey.cells.length !== expectedQualified[index]) fail(`${survey.year} survey census differs`);
    let previous = -1;
    for (const cell of survey.cells) {
      exactKeys(cell, ["cellId", "row", "column", "easting", "northing", "returnCount", ...STATE_FIELDS], `${survey.year} cell`);
      if (!Number.isSafeInteger(cell.cellId) || cell.cellId <= previous || cell.cellId < 0 || cell.cellId > 9999) fail(`${survey.year} cell order differs`);
      previous = cell.cellId;
      if (cell.row !== Math.floor(cell.cellId / 100) || cell.column !== cell.cellId % 100 || cell.easting !== 293000 + cell.column * 10 || cell.northing !== 4101000 - cell.row * 10 || !Number.isSafeInteger(cell.returnCount) || cell.returnCount < 50) fail(`${survey.year} cell ${cell.cellId} geometry or coverage differs`);
      const heights = STATE_FIELDS.map((field) => finite(cell[field], `${survey.year} cell ${cell.cellId}.${field}`));
      if (heights.some((height) => height < 0 || height > 80) || heights.some((height, position) => position > 0 && height < heights[position - 1])) fail(`${survey.year} cell ${cell.cellId} quantiles differ`);
    }
  }
  if (!same(value.evidenceBoundary, { sameSpatialExtent: true, sameTerrainReference: true, sameLidarInstrument: false, instrumentChange: "2019 Optech Gemini; 2021 Teledyne Optech Galaxy Prime", firePerimeterInferredFromPoints: false, causalEffectEstimated: false, futureStatePredicted: false })) fail("LiDAR evidence boundary differs");
  return value;
}

function validateEvents(value, upstream) {
  exactKeys(value, ["format", "formatVersion", "source", "site", "selection", "records", "publishedInterpretation", "evidenceBoundary"], "event projection");
  if (value.format !== "onto2d-neon-soap-event-projection" || value.formatVersion !== "1" || value.source.productId !== "DP1.10111.001" || value.source.releaseTag !== null || value.source.gitBlob !== upstream.tutorials[0].gitBlob || value.source.sha256 !== upstream.tutorials[0].sha256) fail("event source lock differs");
  if (!same(value.site, { domainId: "D17", siteId: "SOAP", siteName: "Soaproot Saddle" }) || value.selection.remarks !== "Creek Fire" || value.selection.eventType !== "fire" || value.selection.recordCount !== 4 || value.selection.groupingStatus !== "published-tutorial-grouping") fail("event selection differs");
  const expected = [
    ["0c1fcf9f-5bee-478c-8412-0bf57925a04b", "SOAP.20200904.fire", "2020-09-04", "2020-10-04", "Y"],
    ["4ffe7ac8-ff68-48e8-97e6-2efd446cd3da", "SOAP.20201004.fire", "2020-10-04", "2020-11-03", "Y"],
    ["53b0b814-8441-41c4-a44b-91fc3413d97b", "SOAP.20201004.fire", "2020-11-03", "2020-12-03", "Y"],
    ["6b641a93-0494-4998-9d8a-c56df5d70891", "SOAP.20201004.fire", "2020-12-03", "2020-12-24", "N"]
  ];
  if (!Array.isArray(value.records) || !same(value.records.map((record) => [record.uid, record.eventId, record.startDate, record.endDate, record.ongoingEvent]), expected)) fail("Creek Fire record inventory differs");
  for (const record of value.records) if (record.estimatedOrActualDate !== "actual" || record.samplingProtocolVersion !== "NEON.DOC.003282vD" || record.eventType !== "fire" || record.methodTypeChoice !== "fire-wildfire" || record.fireSeverity !== "high" || record.reporterType !== "primary" || record.remarks !== "Creek Fire" || record.recordedBy !== "0000-0001-7920-7757" || !record.sourceFile) fail(`${record.uid} evidence status differs`);
  if (value.publishedInterpretation.gitBlob !== upstream.tutorials[1].gitBlob || value.publishedInterpretation.sha256 !== upstream.tutorials[1].sha256 || value.publishedInterpretation.claimRole !== "published-interpretation-not-direct-event-observation") fail("published interpretation lock differs");
  if (!same(value.evidenceBoundary, { eventAbsenceMeansNoEvent: false, recordedEventProvesCausation: false, recordedLocationsDefineExactPerimeter: false, publishedInterpretationIsDirectObservation: false })) fail("event evidence boundary differs");
  return value;
}

function validateProfile(value) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "surveyYears", "stateProjection", "beforeAfter", "similarSnapshot", "historyWindows", "reachability", "historicalLoad", "nonClaims"], "analysis profile");
  if (value.format !== "onto2d-ecological-memory-analysis-profile" || value.formatVersion !== "1" || value.profileVersion !== "ecological-memory-soap-v1" || !same(value.surveyYears, SURVEY_YEARS)) fail("analysis profile version differs");
  if (!same(value.stateProjection.fields, STATE_FIELDS) || value.stateProjection.displayPrecisionMeters !== 0.1 || value.stateProjection.equivalenceRule !== "same-cell-and-equal-four-field-decimal-signature" || value.stateProjection.minimumReturnsPerCell !== 50 || !same(value.stateProjection.expectedQualifiedCells, { "2019": 7754, "2021": 8800, matched: 7275 })) fail("state projection analysis profile differs");
  if (!same(value.beforeAfter.expectedSurveyMedians, { "2019": [3.084981, 4.125513, 5.076358, 5.914652], "2021": [2.663489, 3.693247, 4.686855, 5.565742] }) || !same(value.beforeAfter.expectedMatchedMedianChanges, [-0.311028, -0.277956, -0.189277, -0.10439]) || !same(value.beforeAfter.expectedDecreaseCounts, [5667, 5326, 4896, 4353])) fail("before/after expectations differ");
  if (value.similarSnapshot.selection !== "lowest-cell-id-among-same-cell-equal-signature-pairs" || value.similarSnapshot.expectedCandidateCount !== 2 || value.similarSnapshot.expectedCellId !== 7880 || !same(value.similarSnapshot.expectedSignature, [3, 3.5, 3.8, 4]) || value.similarSnapshot.createsFullEcosystemIdentity || value.similarSnapshot.createsHistoryIdentity) fail("similar snapshot profile differs");
  if (!same(value.historyWindows.map((window) => window.id), ["current-projection-only", "selected-recorded-event", "full-bounded-evidence"]) || value.reachability.status !== "observed-after-state-only" || value.reachability.futurePredictionIncluded || value.reachability.causalEffectEstimated || value.reachability.recoveryTrajectoryClaim) fail("history window or reachability boundary differs");
  if (value.historicalLoad.status !== "not-evaluated" || value.historicalLoad.value !== null || !/undefined must not be displayed as zero/.test(value.historicalLoad.reason ?? "") || !Array.isArray(value.nonClaims) || value.nonClaims.length < 10 || new Set(value.nonClaims).size !== value.nonClaims.length) fail("non-claim boundary differs");
  return value;
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function displaySignature(cell, places = 1) { return STATE_FIELDS.map((field) => Number(cell[field].toFixed(places))); }

function summarizeSurvey(survey) {
  const summary = {
    year: survey.year,
    pointCount: survey.pointCount,
    qualifiedCellCount: survey.qualifiedCellCount,
    retainedHighVegetationReturnCount: survey.filterCounts.retained,
    medians: Object.fromEntries(STATE_FIELDS.map((field) => [field, round(median(survey.cells.map((cell) => cell[field])))])),
    sensor: survey.year === 2019 ? "Optech Gemini" : "Teledyne Optech Galaxy Prime",
    evidenceState: "source-projected-measurement",
    fullEcosystemState: false
  };
  return { ...summary, identity: hashCanonical(SURVEY_DOMAIN, summary) };
}

function buildAnalysis(projection, events, profile) {
  const [before, after] = projection.surveys;
  const beforeById = new Map(before.cells.map((cell) => [cell.cellId, cell]));
  const matched = after.cells.filter((cell) => beforeById.has(cell.cellId)).map((cell) => ({ before: beforeById.get(cell.cellId), after: cell }));
  if (matched.length !== profile.stateProjection.expectedQualifiedCells.matched) fail("matched-cell census differs");

  const surveys = [summarizeSurvey(before), summarizeSurvey(after)];
  const actualMedians = Object.fromEntries(surveys.map((survey) => [String(survey.year), STATE_FIELDS.map((field) => survey.medians[field])]));
  if (!same(actualMedians, profile.beforeAfter.expectedSurveyMedians)) fail("survey medians differ from reviewed expectations");

  const metricChanges = STATE_FIELDS.map((field, index) => {
    const changes = matched.map((pair) => pair.after[field] - pair.before[field]);
    const result = {
      field,
      medianChangeMeters: round(median(changes)),
      meanChangeMeters: round(changes.reduce((sum, value) => sum + value, 0) / changes.length),
      decreasedCellCount: changes.filter((value) => value < 0).length,
      increasedCellCount: changes.filter((value) => value > 0).length,
      unchangedCellCount: changes.filter((value) => value === 0).length,
      decreaseFraction: round(changes.filter((value) => value < 0).length / changes.length)
    };
    if (result.medianChangeMeters !== profile.beforeAfter.expectedMatchedMedianChanges[index] || result.decreasedCellCount !== profile.beforeAfter.expectedDecreaseCounts[index]) fail(`${field} before/after result differs`);
    return result;
  });

  const candidates = matched.filter((pair) => same(displaySignature(pair.before), displaySignature(pair.after)));
  candidates.sort((left, right) => left.before.cellId - right.before.cellId);
  if (candidates.length !== profile.similarSnapshot.expectedCandidateCount || candidates[0]?.before.cellId !== profile.similarSnapshot.expectedCellId || !same(displaySignature(candidates[0].before), profile.similarSnapshot.expectedSignature)) fail("similar-state flagship selection differs");
  const selected = candidates[0];
  const eventGroupBasis = { sourceProductId: events.source.productId, groupingStatus: events.selection.groupingStatus, records: events.records, publishedInterpretation: events.publishedInterpretation };
  const eventGroup = {
    label: "Creek Fire / four rendered source records",
    recordCount: events.records.length,
    startDate: events.records[0].startDate,
    endDate: events.records.at(-1).endDate,
    sourceStatus: "primary-reporter-records",
    spatialLinkStatus: "published-interpretation-not-direct-location-join",
    causalRole: "context-only",
    identity: hashCanonical(EVENT_DOMAIN, eventGroupBasis)
  };
  const similarSnapshot = {
    cellId: selected.before.cellId,
    location: { row: selected.before.row, column: selected.before.column, easting: selected.before.easting, northing: selected.before.northing, crs: "EPSG:32611" },
    signaturePrecisionMeters: profile.stateProjection.displayPrecisionMeters,
    displaySignature: displaySignature(selected.before),
    candidateCount: candidates.length,
    before: { year: before.year, returnCount: selected.before.returnCount, state: Object.fromEntries(STATE_FIELDS.map((field) => [field, selected.before[field]])), selectedEventRecordsBeforeSurvey: 0, noDisturbanceClaim: false },
    after: { year: after.year, returnCount: selected.after.returnCount, state: Object.fromEntries(STATE_FIELDS.map((field) => [field, selected.after[field]])), selectedEventRecordsBeforeSurvey: events.records.length, noOtherDisturbanceClaim: false },
    createsFullEcosystemIdentity: false,
    createsHistoryIdentity: false,
    interpretation: "The same 10 m cell has the same four-value signature at 0.1 m display precision before and after the selected recorded event, but the event context and measurement protocol differ."
  };
  const cellGrid = {
    fields: ["cellId", "row", "column", "beforeHeightP90", "afterHeightP90", "changeHeightP90"],
    rows: matched.map((pair) => [pair.before.cellId, pair.before.row, pair.before.column, pair.before.heightP90, pair.after.heightP90, round(pair.after.heightP90 - pair.before.heightP90)])
  };
  const historyEquivalence = [
    { regime: "same-spatial-cell", equivalent: true, reason: "The pair refers to one exact 10 m grid cell." },
    { regime: "rounded-four-quantile-projection", equivalent: true, reason: "All four displayed height quantiles agree at 0.1 m precision." },
    { regime: "exact-projected-measurement", equivalent: false, reason: "The unrounded quantiles and retained-return counts differ." },
    { regime: "recorded-disturbance-context", equivalent: false, reason: "The 2021 observation follows the selected Creek Fire records; the 2019 observation does not." },
    { regime: "measurement-protocol", equivalent: false, reason: "The surveys used different LiDAR sensors." },
    { regime: "full-ecosystem-identity", equivalent: null, reason: "The four-variable projection cannot decide full ecosystem identity." }
  ];
  const timeline = [
    { id: "survey-2019", order: 1, kind: "measurement", label: "Pre-fire LiDAR survey", date: "2019", precision: "year", evidenceStatus: "source-locked" },
    { id: "creek-fire", order: 2, kind: "recorded-event", label: "Creek Fire records", date: `${eventGroup.startDate}/${eventGroup.endDate}`, precision: "bounded-records", evidenceStatus: "source-recorded-context" },
    { id: "survey-2021", order: 3, kind: "measurement", label: "Post-fire LiDAR survey", date: "2021-07-12/2021-07-13", precision: "day", evidenceStatus: "source-locked" }
  ];
  const beforeAfter = { matchedCellCount: matched.length, metricChanges, causalEffectEstimated: false, protocolHeldConstant: false, interpretation: "Most matched cells have lower projected height quantiles in 2021, but the comparison is descriptive because the LiDAR sensor changed and no causal design is present." };
  const analysisBasis = { surveys, eventGroup, beforeAfter, similarSnapshot, historyEquivalence, timeline, reachability: profile.reachability, historicalLoad: profile.historicalLoad };
  return {
    ...analysisBasis,
    analysisIdentity: hashCanonical(ANALYSIS_DOMAIN, analysisBasis),
    cellGrid,
    historyWindows: profile.historyWindows,
    nonClaims: profile.nonClaims
  };
}

function verifySemantics(artifact) {
  if (artifact.format !== "onto2d-ecological-memory-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "ecological-memory-soap-v1") fail("artifact version differs");
  const { caseIdentity, ...basis } = artifact;
  if (!IDENTITY.test(caseIdentity ?? "") || caseIdentity !== hashCanonical(CASE_DOMAIN, basis)) fail("case identity differs");
  const { identity: sourceIdentity, ...sourceBasis } = artifact.source ?? {};
  if (!IDENTITY.test(sourceIdentity ?? "") || sourceIdentity !== hashCanonical(SOURCE_DOMAIN, sourceBasis)) fail("source identity differs");
  if (!Array.isArray(artifact.surveys) || !same(artifact.surveys.map((survey) => survey.year), SURVEY_YEARS)) fail("artifact survey inventory differs");
  for (const survey of artifact.surveys) { const { identity, ...surveyBasis } = survey; if (identity !== hashCanonical(SURVEY_DOMAIN, surveyBasis)) fail(`${survey.year} survey identity differs`); }
  if (artifact.eventGroup?.identity !== hashCanonical(EVENT_DOMAIN, artifact.eventGroupBasis)) fail("event group identity differs");
  const analysisBasis = { surveys: artifact.surveys, eventGroup: artifact.eventGroup, beforeAfter: artifact.beforeAfter, similarSnapshot: artifact.similarSnapshot, historyEquivalence: artifact.historyEquivalence, timeline: artifact.timeline, reachability: artifact.reachability, historicalLoad: artifact.historicalLoad };
  if (artifact.analysisIdentity !== hashCanonical(ANALYSIS_DOMAIN, analysisBasis)) fail("analysis identity differs");
  if (artifact.beforeAfter.matchedCellCount !== 7275 || artifact.beforeAfter.causalEffectEstimated || artifact.beforeAfter.protocolHeldConstant || artifact.similarSnapshot.cellId !== 7880 || artifact.similarSnapshot.candidateCount !== 2 || artifact.similarSnapshot.createsFullEcosystemIdentity || artifact.similarSnapshot.createsHistoryIdentity) fail("flagship analysis boundary differs");
  if (!Array.isArray(artifact.cellGrid?.rows) || artifact.cellGrid.rows.length !== 7275 || !same(artifact.cellGrid.fields, ["cellId", "row", "column", "beforeHeightP90", "afterHeightP90", "changeHeightP90"])) fail("cell grid differs");
  if (artifact.reachability.status !== "observed-after-state-only" || artifact.reachability.futurePredictionIncluded || artifact.reachability.causalEffectEstimated || artifact.reachability.recoveryTrajectoryClaim || artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("reachability or Historical Load boundary differs");
  if (artifact.caseIdentity !== APPROVED_CASE_IDENTITY) fail("artifact is not the approved ecological-memory-soap-v1 release");
  return artifact;
}

export async function buildEcologicalMemoryCase() {
  const [upstreamInput, projectionInput, eventInput, profileInput, generatorInput] = await Promise.all([
    loadJson("upstream.json", 64 * 1024),
    loadJson("source/soap-lidar-projection.json", 8 * 1024 * 1024),
    loadJson("source/soap-event-projection.json", 64 * 1024),
    loadJson("analysis-profile.json", 64 * 1024),
    loadBytes("prepare-source.py", 64 * 1024)
  ]);
  const upstream = validateUpstream(upstreamInput.value);
  const projection = validateProjection(projectionInput.value, upstream);
  const events = validateEvents(eventInput.value, upstream);
  const profile = validateProfile(profileInput.value);

  const authoredFiles = [fileEntry("upstream-lock", upstreamInput), fileEntry("analysis-profile", profileInput), fileEntry("projection-generator", generatorInput)];
  const snapshotFiles = [fileEntry("lidar-state-projection", projectionInput), fileEntry("recorded-event-projection", eventInput)];
  for (const snapshot of upstream.snapshots) {
    const actual = snapshotFiles.find((file) => file.role === snapshot.role);
    if (!actual || actual.identity !== `sha256:${snapshot.sha256}` || actual.bytes !== snapshot.bytes || actual.path !== snapshot.path) fail(`${snapshot.role} bytes differ from upstream lock`);
  }
  const generator = authoredFiles.find((file) => file.role === "projection-generator");
  if (generator.identity !== `sha256:${upstream.projectionGenerator.sha256}` || generator.bytes !== upstream.projectionGenerator.bytes) fail("projection generator bytes differ from upstream lock");

  const sourceBasis = {
    id: upstream.source.id,
    retrievedAt: upstream.retrievedAt,
    publisher: upstream.source.publisher,
    citation: upstream.source.citation,
    license: upstream.source.license,
    landingPage: upstream.source.landingPage,
    tutorialLocks: upstream.tutorials,
    externalFiles: upstream.externalFiles.map((file) => ({ ...file, identity: `sha256:${file.sha256}` })),
    authoredFiles,
    snapshotFiles,
    selection: upstream.selection,
    liveNetworkRequiredByBuild: false
  };
  const source = { ...sourceBasis, identity: hashCanonical(SOURCE_DOMAIN, sourceBasis) };
  const analysis = buildAnalysis(projection, events, profile);
  const artifactBasis = {
    format: "onto2d-ecological-memory-case",
    formatVersion: "1",
    caseVersion: "ecological-memory-soap-v1",
    source,
    site: projection.site,
    stateProjection: { ...projection.projection, variableCount: STATE_FIELDS.length, variables: STATE_FIELDS },
    eventGroupBasis: { sourceProductId: events.source.productId, groupingStatus: events.selection.groupingStatus, records: events.records, publishedInterpretation: events.publishedInterpretation },
    ...analysis,
    evidenceBoundary: {
      nativeRecordsRetainedExternally: true,
      exactReleaseTagKnown: false,
      exactExternalBytesPinned: true,
      recordedEventProvesCausation: false,
      eventAbsenceMeansNoDisturbance: false,
      exactFirePerimeterJoinedToTile: false,
      sameLidarInstrument: false,
      stateProjectionIsFullEcosystemState: false,
      futurePredictionIncluded: false
    }
  };
  return { ...artifactBasis, caseIdentity: hashCanonical(CASE_DOMAIN, artifactBasis) };
}

export function verifyEcologicalMemoryCaseIdentity(input) {
  return verifySemantics(structuredClone(input));
}

export async function run({ verify = false } = {}) {
  const artifact = await buildEcologicalMemoryCase();
  if (!verify) { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, serialize(artifact)); }
  const stored = JSON.parse(await readFile(OUTPUT, "utf8"));
  assert.deepEqual(stored, artifact);
  verifySemantics(stored);
  console.log(`${verify ? "Verified" : "Built"} Ecological Memory case ${artifact.caseVersion}: ${artifact.surveys.length} surveys, ${artifact.beforeAfter.matchedCellCount} matched cells, ${artifact.caseIdentity}`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
