const DISTANCE_IDS = Object.freeze(["current-combined", "current-sensors-only-control", "current-settings-only-control", "last-20-combined", "full-history-combined"]);
const EXPECTED = Object.freeze([[0.082125416271, 78], [0.083710777228, 368], [0.069085145288, 366], [0.066452134448, 1439], [0.035615328056, 1072]]);
function fail(message) { throw new Error(`Operational Aging artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createOperationalAgingModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-operational-aging-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "operational-aging-fd001-v1") fail("unsupported artifact version");
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.caseIdentity ?? "") || !/^sha256:[0-9a-f]{64}$/.test(artifact.source?.identity ?? "")) fail("case or source identity is invalid");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.archive?.sha256 !== "74bef434a34db25c7bf72e668ea4cd52afe5f2cf8e44367c55a82bfd91a5a34f") fail("source lock differs");
  if (!same([artifact.corpus?.dataset, artifact.corpus?.trainUnitCount, artifact.corpus?.testUnitCount, artifact.corpus?.trainRowCount, artifact.corpus?.testRowCount], ["FD001", 100, 100, 20631, 13096])) fail("corpus census differs");
  if (!same(artifact.inputDefinition?.fields, ["settings", "sensors"]) || !same(artifact.inputDefinition?.excludedFields, ["unitId", "cycle", "observedCycleCount", "providedRul"]) || artifact.inputDefinition.providedRulUsedAsInput !== false || artifact.inputDefinition.cycleUsedInCurrentFrame !== false) fail("input boundary differs");
  if (artifact.endpointCohort?.length !== 100 || !same(artifact.endpointCohort.map(({ unitId }) => unitId), Array.from({ length: 100 }, (_, index) => index + 1))) fail("endpoint cohort differs");
  if (!same(artifact.flagship?.unitIds, [25, 72]) || artifact.flagship.currentCombinedRank !== 78 || artifact.flagship.usesOutcomeForSelection !== true || artifact.flagship.selectionBiased !== true || artifact.flagship.predictiveEvaluationClaim !== false || artifact.flagship.currentFramesExactlyEqual !== false) fail("flagship boundary differs");
  if (!same(artifact.distanceResults?.map(({ id }) => id), DISTANCE_IDS) || !same(artifact.distanceResults.map(({ distance, rank }) => [distance, rank]), EXPECTED) || artifact.distanceResults.some((result) => result.providedRulUsedAsInput || result.createsExactStateIdentity)) fail("distance profiles differ");
  if (!same(artifact.trajectories?.map(({ unitId, observedCycleCount, providedRul }) => [unitId, observedCycleCount, providedRul]), [[25, 48, 145], [72, 131, 50]])) fail("trajectory inventory differs");
  for (const trajectory of artifact.trajectories) if (trajectory.rows.length !== trajectory.observedCycleCount || trajectory.rows.some((row, index) => row.cycle !== index + 1) || trajectory.futureRowsIncluded !== false || trajectory.futureRowsSynthesized !== false || trajectory.latentHealthObserved !== false || trajectory.providedRulUsedAsInput !== false) fail(`trajectory ${trajectory.unitId} boundary differs`);
  if (!same([artifact.outcomeComparison?.leftProvidedRul, artifact.outcomeComparison?.rightProvidedRul, artifact.outcomeComparison?.absoluteDifference], [145, 50, 95]) || artifact.outcomeComparison.providedRulUsedAsInput !== false || artifact.outcomeComparison.predictedRul !== null) fail("outcome boundary differs");
  if (artifact.latentHistoricalState?.directObservation !== false || artifact.latentHistoricalState?.derivedHistoryMeansAreLatentState !== false || artifact.prediction?.status !== "not-evaluated" || artifact.prediction?.predictions?.length !== 0 || artifact.historyEquivalence?.status !== "not-evaluated" || artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad?.value !== null) fail("non-primary boundary differs");
  const endpointIndex = new Map(artifact.endpointCohort.map((endpoint) => [endpoint.unitId, endpoint]));
  const trajectoryIndex = new Map(artifact.trajectories.map((trajectory) => [trajectory.unitId, trajectory]));
  const distanceIndex = new Map(artifact.distanceResults.map((result) => [result.id, result]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity, sourceIdentity: artifact.source.identity, retrievedAt: artifact.source.retrievedAt, source: artifact.source, corpus: artifact.corpus, input: artifact.inputDefinition, endpoints: artifact.endpointCohort, flagship: artifact.flagship, distances: artifact.distanceResults, trajectories: artifact.trajectories, outcome: artifact.outcomeComparison, context: artifact.operatingContext, latentState: artifact.latentHistoricalState, prediction: artifact.prediction, historicalLoad: artifact.historicalLoad, boundary: artifact.evidenceBoundary,
    endpoint(unitId) { const value = endpointIndex.get(unitId); if (!value) throw new RangeError(`Unknown endpoint ${unitId}.`); return value; },
    trajectory(unitId) { const value = trajectoryIndex.get(unitId); if (!value) throw new RangeError(`Unknown trajectory ${unitId}.`); return value; },
    distance(id) { const value = distanceIndex.get(id); if (!value) throw new RangeError(`Unknown distance profile ${id}.`); return value; }
  });
}
