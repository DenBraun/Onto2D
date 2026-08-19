import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel";
import { buildEcologicalMemoryCase, verifyEcologicalMemoryCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/ecological-memory.json", import.meta.url);
const schemaUrl = new URL("../schema/ecological-memory.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:ecological-memory-case:v1", basis);
  return artifact;
};
const resignSurvey = (survey) => {
  const { identity: ignored, ...basis } = survey;
  survey.identity = hashCanonical("onto2d:ecological-memory-survey:v1", basis);
  return survey;
};
const resignAnalysis = (artifact) => {
  const basis = {
    surveys: artifact.surveys,
    eventGroup: artifact.eventGroup,
    beforeAfter: artifact.beforeAfter,
    similarSnapshot: artifact.similarSnapshot,
    historyEquivalence: artifact.historyEquivalence,
    timeline: artifact.timeline,
    reachability: artifact.reachability,
    historicalLoad: artifact.historicalLoad
  };
  artifact.analysisIdentity = hashCanonical("onto2d:ecological-memory-analysis:v1", basis);
  return artifact;
};

test("the source-locked Ecological Memory artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildEcologicalMemoryCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyEcologicalMemoryCaseIdentity(committed).caseIdentity, committed.caseIdentity);
});

test("the SOAP cohort preserves exact native-file and survey boundaries", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.source.externalFiles.map(({ role, bytes }) => [role, bytes]), [
    ["pre-fire-lidar", 21403480],
    ["post-fire-lidar", 119247766],
    ["shared-terrain-reference", 4009492]
  ]);
  assert.deepEqual(artifact.surveys.map(({ year, pointCount, qualifiedCellCount }) => [year, pointCount, qualifiedCellCount]), [
    [2019, 3015329, 7754],
    [2021, 15278262, 8800]
  ]);
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.equal(artifact.evidenceBoundary.exactReleaseTagKnown, false);
  assert.equal(artifact.evidenceBoundary.exactExternalBytesPinned, true);
});

test("the before/after comparison is deterministic and remains descriptive", async () => {
  const artifact = await load();
  assert.equal(artifact.beforeAfter.matchedCellCount, 7275);
  assert.deepEqual(artifact.beforeAfter.metricChanges.map(({ field, medianChangeMeters, decreasedCellCount }) => [field, medianChangeMeters, decreasedCellCount]), [
    ["heightP20", -0.311028, 5667],
    ["heightP50", -0.277956, 5326],
    ["heightP75", -0.189277, 4896],
    ["heightP90", -0.10439, 4353]
  ]);
  assert.equal(artifact.beforeAfter.causalEffectEstimated, false);
  assert.equal(artifact.beforeAfter.protocolHeldConstant, false);
  assert.equal(artifact.cellGrid.rows.length, 7275);
});

test("the flagship cell keeps projected similarity separate from history identity", async () => {
  const artifact = await load();
  assert.equal(artifact.similarSnapshot.cellId, 7880);
  assert.deepEqual(artifact.similarSnapshot.displaySignature, [3, 3.5, 3.8, 4]);
  assert.equal(artifact.similarSnapshot.before.selectedEventRecordsBeforeSurvey, 0);
  assert.equal(artifact.similarSnapshot.before.noDisturbanceClaim, false);
  assert.equal(artifact.similarSnapshot.after.selectedEventRecordsBeforeSurvey, 4);
  assert.equal(artifact.similarSnapshot.after.noOtherDisturbanceClaim, false);
  assert.equal(artifact.similarSnapshot.createsFullEcosystemIdentity, false);
  assert.equal(artifact.similarSnapshot.createsHistoryIdentity, false);
  assert.deepEqual(artifact.historyEquivalence.map(({ regime, equivalent }) => [regime, equivalent]), [
    ["same-spatial-cell", true],
    ["rounded-four-quantile-projection", true],
    ["exact-projected-measurement", false],
    ["recorded-disturbance-context", false],
    ["measurement-protocol", false],
    ["full-ecosystem-identity", null]
  ]);
});

test("recorded history, published interpretation, and causal claims stay separate", async () => {
  const artifact = await load();
  assert.equal(artifact.eventGroup.recordCount, 4);
  assert.equal(artifact.eventGroup.sourceStatus, "primary-reporter-records");
  assert.equal(artifact.eventGroup.spatialLinkStatus, "published-interpretation-not-direct-location-join");
  assert.equal(artifact.eventGroup.causalRole, "context-only");
  assert.equal(artifact.evidenceBoundary.recordedEventProvesCausation, false);
  assert.equal(artifact.evidenceBoundary.exactFirePerimeterJoinedToTile, false);
  assert.equal(artifact.evidenceBoundary.eventAbsenceMeansNoDisturbance, false);
});

test("future response and Historical Load remain explicitly bounded", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.reachability, {
    status: "observed-after-state-only",
    futurePredictionIncluded: false,
    causalEffectEstimated: false,
    recoveryTrajectoryClaim: false
  });
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
});

test("the verifier rejects re-signed identity and causality promotions", async () => {
  const identity = await load();
  identity.similarSnapshot.createsFullEcosystemIdentity = true;
  assert.throws(() => verifyEcologicalMemoryCaseIdentity(resign(identity)), /analysis identity differs/);

  const causal = await load();
  causal.beforeAfter.causalEffectEstimated = true;
  assert.throws(() => verifyEcologicalMemoryCaseIdentity(resign(causal)), /analysis identity differs/);
});

test("the verifier rejects stale nested survey and event identities", async () => {
  const survey = await load();
  survey.surveys[0].qualifiedCellCount += 1;
  assert.throws(() => verifyEcologicalMemoryCaseIdentity(resign(survey)), /2019 survey identity differs/);

  const event = await load();
  event.eventGroupBasis.records[0].reporterType = "secondary";
  assert.throws(() => verifyEcologicalMemoryCaseIdentity(resign(event)), /event group identity differs/);
});

test("the approved release rejects fully rehashed scientific-result substitutions", async () => {
  const artifact = await load();
  artifact.beforeAfter.metricChanges[0].medianChangeMeters = 10;
  resignAnalysis(artifact);
  assert.throws(() => verifyEcologicalMemoryCaseIdentity(resign(artifact)), /not the approved ecological-memory-soap-v1 release/);
});

test("the approved release rejects a fully rehashed source-lock substitution", async () => {
  const artifact = await load();
  artifact.source.externalFiles[0].bytes += 1;
  const { identity: ignored, ...sourceBasis } = artifact.source;
  artifact.source.identity = hashCanonical("onto2d:ecological-memory-source:v1", sourceBasis);
  assert.throws(() => verifyEcologicalMemoryCaseIdentity(resign(artifact)), /not the approved ecological-memory-soap-v1 release/);
});
