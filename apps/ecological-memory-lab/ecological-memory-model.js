const APPROVED_CASE_IDENTITY = "sha256:d6ceb3b9a5d131e4247ee8c55efd78fea940a9c3957859cbf7fe1c2082190071";
const APPROVED_SOURCE_IDENTITY = "sha256:4bc486a97d653755e6a9fcbf10ed90f3c533085ab17207b45f1e4f2e1f3bc1a9";
const STATE_FIELDS = Object.freeze(["heightP20", "heightP50", "heightP75", "heightP90"]);

function fail(message) { throw new Error(`Ecological Memory artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createEcologicalMemoryModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-ecological-memory-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "ecological-memory-soap-v1") fail("unsupported artifact version");
  if (artifact.caseIdentity !== APPROVED_CASE_IDENTITY || artifact.source?.identity !== APPROVED_SOURCE_IDENTITY) fail("case or source release differs");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.externalFiles?.length !== 3 || artifact.source.externalFiles.some((file) => !/^sha256:[0-9a-f]{64}$/.test(file.identity ?? ""))) fail("source locks differ");
  if (!same(artifact.surveys?.map(({ year, pointCount, qualifiedCellCount }) => [year, pointCount, qualifiedCellCount]), [[2019, 3015329, 7754], [2021, 15278262, 8800]])) fail("survey census differs");
  if (!same(artifact.stateProjection?.variables, STATE_FIELDS) || artifact.stateProjection.cellSizeMeters !== 10 || artifact.stateProjection.minimumReturnsPerCell !== 50 || artifact.stateProjection.projectionIsFullEcosystemState !== false) fail("state projection differs");
  if (artifact.eventGroup?.recordCount !== 4 || artifact.eventGroup.causalRole !== "context-only" || artifact.eventGroup.spatialLinkStatus !== "published-interpretation-not-direct-location-join") fail("event boundary differs");
  const expectedChanges = [["heightP20", -0.311028, 5667], ["heightP50", -0.277956, 5326], ["heightP75", -0.189277, 4896], ["heightP90", -0.10439, 4353]];
  if (artifact.beforeAfter?.matchedCellCount !== 7275 || !same(artifact.beforeAfter.metricChanges.map(({ field, medianChangeMeters, decreasedCellCount }) => [field, medianChangeMeters, decreasedCellCount]), expectedChanges) || artifact.beforeAfter.causalEffectEstimated || artifact.beforeAfter.protocolHeldConstant) fail("before/after result differs");
  if (artifact.similarSnapshot?.cellId !== 7880 || !same(artifact.similarSnapshot.displaySignature, [3, 3.5, 3.8, 4]) || artifact.similarSnapshot.candidateCount !== 2 || artifact.similarSnapshot.before?.noDisturbanceClaim !== false || artifact.similarSnapshot.after?.noOtherDisturbanceClaim !== false || artifact.similarSnapshot.createsFullEcosystemIdentity || artifact.similarSnapshot.createsHistoryIdentity) fail("flagship snapshot differs");
  if (!same(artifact.cellGrid?.fields, ["cellId", "row", "column", "beforeHeightP90", "afterHeightP90", "changeHeightP90"]) || artifact.cellGrid.rows?.length !== 7275) fail("cell grid differs");
  let previous = -1;
  for (const row of artifact.cellGrid.rows) {
    if (!Array.isArray(row) || row.length !== 6 || row.some((value) => typeof value !== "number" || !Number.isFinite(value)) || !Number.isSafeInteger(row[0]) || row[0] <= previous || row[1] !== Math.floor(row[0] / 100) || row[2] !== row[0] % 100) fail("cell grid row differs");
    previous = row[0];
  }
  if (!same(artifact.historyEquivalence?.map(({ regime, equivalent }) => [regime, equivalent]), [["same-spatial-cell", true], ["rounded-four-quantile-projection", true], ["exact-projected-measurement", false], ["recorded-disturbance-context", false], ["measurement-protocol", false], ["full-ecosystem-identity", null]])) fail("equivalence regimes differ");
  if (artifact.reachability?.status !== "observed-after-state-only" || artifact.reachability.futurePredictionIncluded || artifact.reachability.causalEffectEstimated || artifact.reachability.recoveryTrajectoryClaim || artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("future or Historical Load boundary differs");
  const gridIndex = new Map(artifact.cellGrid.rows.map((row) => [row[0], row]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    retrievedAt: artifact.source.retrievedAt,
    source: artifact.source,
    site: artifact.site,
    projection: artifact.stateProjection,
    surveys: artifact.surveys,
    event: artifact.eventGroup,
    beforeAfter: artifact.beforeAfter,
    flagship: artifact.similarSnapshot,
    equivalence: artifact.historyEquivalence,
    timeline: artifact.timeline,
    historyWindows: artifact.historyWindows,
    grid: artifact.cellGrid,
    reachability: artifact.reachability,
    historicalLoad: artifact.historicalLoad,
    boundary: artifact.evidenceBoundary,
    cell(cellId) { const value = gridIndex.get(cellId); if (!value) throw new RangeError(`Unknown matched cell ${cellId}.`); return value; }
  });
}
