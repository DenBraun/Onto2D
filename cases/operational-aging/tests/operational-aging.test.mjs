import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel";
import { buildOperationalAgingCase, verifyOperationalAgingCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/operational-aging.json", import.meta.url);
const schemaUrl = new URL("../schema/operational-aging.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:operational-aging-case:v1", basis);
  return artifact;
};
const resignEndpoint = (endpoint) => {
  const { identity: ignored, ...basis } = endpoint;
  endpoint.identity = hashCanonical("onto2d:operational-aging-endpoint:v1", basis);
  return endpoint;
};

test("the source-locked Operational Aging artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildOperationalAgingCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyOperationalAgingCaseIdentity(committed).caseIdentity, committed.caseIdentity);
});

test("FD001 census and operating boundaries stay exact", async () => {
  const artifact = await load();
  assert.deepEqual([artifact.corpus.trainUnitCount, artifact.corpus.testUnitCount, artifact.corpus.trainRowCount, artifact.corpus.testRowCount], [100, 100, 20631, 13096]);
  assert.deepEqual([artifact.corpus.operatingConditionCount, artifact.corpus.faultModeCount], [1, 1]);
  assert.equal(artifact.endpointCohort.length, 100);
  assert.deepEqual(artifact.endpointCohort.map(({ unitId }) => unitId), Array.from({ length: 100 }, (_, index) => index + 1));
  assert.equal(artifact.source.archive.sha256, "74bef434a34db25c7bf72e668ea4cd52afe5f2cf8e44367c55a82bfd91a5a34f");
});

test("current-frame distance cannot consume identifiers, cycles, histories, or RUL", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.inputDefinition.fields, ["settings", "sensors"]);
  assert.deepEqual(artifact.inputDefinition.excludedFields, ["unitId", "cycle", "observedCycleCount", "providedRul"]);
  assert.equal(artifact.inputDefinition.providedRulUsedAsInput, false);
  assert.deepEqual(artifact.distanceResults.map(({ currentFrameInputFields }) => currentFrameInputFields), [["settings", "sensors"], ["sensors"], ["settings"], null, null]);
  assert.ok(artifact.distanceResults.every(({ providedRulUsedAsInput, createsExactStateIdentity }) => !providedRulUsedAsInput && !createsExactStateIdentity));
});

test("observed trajectories end at their endpoint and contain no future rows", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.trajectories.map(({ unitId, observedCycleCount, rows }) => [unitId, observedCycleCount, rows.length]), [[25, 48, 48], [72, 131, 131]]);
  for (const trajectory of artifact.trajectories) {
    assert.deepEqual(trajectory.rows.map(({ cycle }) => cycle), Array.from({ length: trajectory.observedCycleCount }, (_, index) => index + 1));
    assert.equal(trajectory.futureRowsIncluded, false);
    assert.equal(trajectory.futureRowsSynthesized, false);
    assert.equal(trajectory.rows.at(-1).cycle, artifact.endpointCohort[trajectory.unitId - 1].cycle);
  }
});

test("the flagship result is reproducible and explicitly selection-biased", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.flagship.unitIds, [25, 72]);
  assert.deepEqual([artifact.flagship.pairUniverseSize, artifact.flagship.eligiblePairCount, artifact.flagship.currentCombinedRank], [4950, 247, 78]);
  assert.deepEqual([artifact.flagship.usesOutcomeForSelection, artifact.flagship.selectionBiased, artifact.flagship.predictiveEvaluationClaim], [true, true, false]);
  assert.deepEqual([artifact.outcomeComparison.leftProvidedRul, artifact.outcomeComparison.rightProvidedRul, artifact.outcomeComparison.absoluteDifference], [145, 50, 95]);
  assert.equal(artifact.outcomeComparison.providedRulUsedAsInput, false);
});

test("history context changes the rank without becoming latent state", async () => {
  const artifact = await load();
  const byId = Object.fromEntries(artifact.distanceResults.map((result) => [result.id, result]));
  assert.deepEqual([byId["current-combined"].rank, byId["last-20-combined"].rank, byId["full-history-combined"].rank], [78, 1439, 1072]);
  assert.deepEqual([artifact.operatingContext.combinedCurrentRank, artifact.operatingContext.sensorsOnlyControlRank], [78, 368]);
  assert.equal(artifact.latentHistoricalState.directObservation, false);
  assert.equal(artifact.latentHistoricalState.derivedHistoryMeansAreLatentState, false);
});

test("prediction, history equivalence, and Historical Load remain outside this result", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.prediction, { status: "not-evaluated", model: null, predictions: [], trainingTestLeakageChecked: true });
  assert.equal(artifact.historyEquivalence.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
});

test("the verifier rejects re-signed leakage and identity promotions", async () => {
  const leaked = await load();
  leaked.distanceResults[0].providedRulUsedAsInput = true;
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(leaked)), /distance results differ/);

  const promoted = await load();
  promoted.distanceResults[0].createsExactStateIdentity = true;
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(promoted)), /distance results differ/);

  const latent = await load();
  latent.latentHistoricalState.directObservation = true;
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(latent)), /unknown or non-primary boundary differs/);
});

test("the verifier rejects re-signed source, endpoint, and trajectory mutations", async () => {
  const source = await load();
  source.source.archive.bytes += 1;
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(source)), /source identity differs/);

  const endpoint = await load();
  endpoint.endpointCohort[24].sensors[0] += 1;
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(endpoint)), /endpoint 25 identity differs/);

  const trajectory = await load();
  trajectory.trajectories[0].rows[0].cycle = 2;
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(trajectory)), /trajectory 25 boundary differs/);
});

test("the approved release anchor rejects a rehashed endpoint with stale distance results", async () => {
  const artifact = await load();
  artifact.endpointCohort[0].settings[0] += 1000;
  resignEndpoint(artifact.endpointCohort[0]);
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(artifact)), /not the approved operational-aging-fd001-v1 release/);
});

test("the verifier rejects a fully rehashed source-lock substitution outside the approved release", async () => {
  const artifact = await load();
  artifact.source.archive.bytes += 1;
  artifact.source.identity = hashCanonical("onto2d:operational-aging-source:v1", {
    authoredFiles: artifact.source.authoredFiles,
    snapshotFiles: artifact.source.snapshotFiles,
    archive: artifact.source.archive,
    consumedMembers: artifact.source.consumedMembers,
    citation: artifact.source.citation,
    license: artifact.source.license.statement
  });
  assert.throws(() => verifyOperationalAgingCaseIdentity(resign(artifact)), /not the approved operational-aging-fd001-v1 release/);
});
