import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyOperationalAgingCaseIdentity } from "../../cases/operational-aging/extract.mjs";

export const OPERATIONAL_AGING_MAPPING_VERSION = "operational-aging-mapping-v1";
const RELEASE_DOMAIN = "onto2d:operational-aging-model-release:v1";
const AUDIT_DOMAIN = "onto2d:operational-aging-model-audit:v1";
const EDGE_DOMAIN = "onto2d:operational-aging-model-edge:v1";

function fail(message) { throw new TypeError(`operational-aging Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }

export function compileOperationalAgingModelPack(input) {
  let artifact;
  try { artifact = verifyOperationalAgingCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.endpointCohort.length !== 100 || artifact.trajectories.length !== 2 || artifact.distanceResults.length !== 5) fail("case inventory differs");
  if (artifact.distanceResults.some((result) => result.providedRulUsedAsInput || result.createsExactStateIdentity)) fail("distance boundary differs");
  if (artifact.prediction.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("non-primary result boundary differs");

  const sourceNode = {
    id: "source:nasa-cmapss-fd001", name: "NASA C-MAPSS FD001", description: "The exact source-locked FD001 archive projection used by this analysis.", shortDescription: "100 train units, 100 test units; one condition and one fault mode.",
    entityKind: "source", typeRole: "source-locked-dataset", phase: "source", scientificStatus: "source-locked", sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity
  };
  const cohortNode = {
    id: "cohort:fd001-test-endpoints", name: "FD001 test endpoints", description: "One final observed sensor-and-setting frame for each of the 100 truncated test trajectories.", shortDescription: "100 observed-prefix endpoints; no future test rows.",
    entityKind: "cohort", typeRole: "test-endpoint-cohort", phase: "observed-prefix", scientificStatus: "source-projected", unitCount: 100, futureRowsAvailable: false
  };
  const endpointNodes = artifact.endpointCohort.map((endpoint) => ({
    id: `endpoint:test-unit-${endpoint.unitId}`, name: `Test unit ${endpoint.unitId} / cycle ${endpoint.cycle}`, description: "The last observed FD001 test frame. Settings and sensors are observations; the provided RUL remains an outcome outside the frame.", shortDescription: `${endpoint.observedCycleCount} observed cycles; endpoint source-locked.`,
    entityKind: "endpoint", typeRole: "observed-test-endpoint", phase: "observed-prefix", scientificStatus: endpoint.evidenceState, unitId: endpoint.unitId, observedCycleCount: endpoint.observedCycleCount, endpointIdentity: endpoint.identity, providedRulUsedAsInput: false, futureRowsAvailable: false
  }));
  const trajectoryNodes = artifact.trajectories.map((trajectory) => ({
    id: `trajectory:test-unit-${trajectory.unitId}`, name: `Observed history / unit ${trajectory.unitId}`, description: "The complete observed test prefix, ordered from cycle 1 to the source-provided endpoint. No future cycle or latent health state is included.", shortDescription: `${trajectory.observedCycleCount} observed cycles; future excluded.`,
    entityKind: "trajectory", typeRole: "observed-test-prefix", phase: "observed-history", scientificStatus: trajectory.evidenceState, unitId: trajectory.unitId, observedCycleCount: trajectory.observedCycleCount, trajectoryIdentity: trajectory.identity, futureRowsIncluded: false, latentHealthObserved: false
  }));
  const distanceNodes = artifact.distanceResults.map((result) => ({
    id: `distance:${result.id}`, name: result.label, description: `RMS distance ${result.distance}; rank ${result.rank} of ${result.pairUniverseSize} under this exact declared profile.`, shortDescription: `rank ${result.rank}/${result.pairUniverseSize}; ${(result.percentile * 100).toFixed(2)} percentile.`,
    entityKind: "distance-result", typeRole: result.id, phase: result.window === "last-observed-row" ? "current-frame-analysis" : "observed-history-analysis", scientificStatus: "deterministically-derived", distance: result.distance, rank: result.rank, pairUniverseSize: result.pairUniverseSize, percentile: result.percentile, window: result.window, dimensionScope: result.dimensionScope, dimensionCount: result.dimensionCount, currentFrameInputFields: result.currentFrameInputFields, historyRowsUsed: result.historyRowsUsed, providedRulUsedAsInput: false, createsExactStateIdentity: false
  }));
  const outcomeNodes = artifact.trajectories.map((trajectory) => ({
    id: `outcome:provided-rul-unit-${trajectory.unitId}`, name: `Provided RUL / unit ${trajectory.unitId}`, description: "NASA's separately supplied remaining-useful-life outcome for this truncated test endpoint. It was not used as a distance input.", shortDescription: `${trajectory.providedRul} cycles after the observed endpoint.`,
    entityKind: "provided-outcome", typeRole: "provided-test-rul", phase: "provided-outcome", scientificStatus: "source-provided-held-out-outcome", unitId: trajectory.unitId, providedRul: trajectory.providedRul, impliedFailureCycle: trajectory.impliedFailureCycle, providedRulUsedAsInput: false, predicted: false
  }));
  const comparisonNode = {
    id: "comparison:flagship-rul", name: "Flagship outcome difference", description: "The selected pair differs by 95 provided RUL cycles. Pair selection deliberately used this outcome and is therefore selection-biased, not a predictive evaluation.", shortDescription: "145 vs 50 cycles; difference 95; outcome-aware selection.",
    entityKind: "outcome-comparison", typeRole: "selection-biased-rul-comparison", phase: "provided-outcome-analysis", scientificStatus: "selection-biased-derived-result", absoluteDifference: 95, usesOutcomeForSelection: true, selectionBiased: true, predictiveEvaluationClaim: false
  };
  const boundaries = [
    { id: "boundary:input", name: "Current-frame input boundary", description: "Only settings and sensors enter current-frame distance. Unit ID, cycle count, observed history length, and provided RUL are excluded.", shortDescription: "Settings + sensors only; no RUL leakage.", entityKind: "analysis-boundary", typeRole: "input-boundary", phase: "evidence-boundary", scientificStatus: "explicit-non-claim", providedRulUsedAsInput: false },
    { id: "boundary:selection", name: "Outcome-aware selection", description: "The flagship pair maximizes provided-RUL separation inside the nearest five percent by current-frame distance. This is a demonstration selected with knowledge of the outcome.", shortDescription: "Selection-biased; not predictor evaluation.", entityKind: "analysis-boundary", typeRole: "selection-boundary", phase: "evidence-boundary", scientificStatus: "explicit-non-claim", usesOutcomeForSelection: true, predictiveEvaluationClaim: false },
    { id: "boundary:latent-state", name: "Latent health is unobserved", description: artifact.latentHistoricalState.sourceDisclosure, shortDescription: "Derived history summaries are not latent health.", entityKind: "analysis-boundary", typeRole: "latent-state-boundary", phase: "evidence-boundary", scientificStatus: "explicitly-unobserved", directObservation: false },
    { id: "boundary:prediction", name: "RUL prediction is not evaluated", description: "This release trains no RUL predictor and reports no prediction-quality metric.", shortDescription: "No model, predictions, or accuracy claim.", entityKind: "analysis-boundary", typeRole: "prediction-boundary", phase: "evidence-boundary", scientificStatus: "explicitly-not-evaluated", status: "not-evaluated" },
    { id: "boundary:historical-load", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, shortDescription: "No finite route space, route cost, or baseline route.", entityKind: "analysis-boundary", typeRole: "historical-load-boundary", phase: "evidence-boundary", scientificStatus: "explicitly-not-evaluated", value: null }
  ];
  const nodes = [sourceNode, cohortNode, ...endpointNodes, ...trajectoryNodes, ...distanceNodes, ...outcomeNodes, comparisonNode, ...boundaries];
  const edges = [];
  edges.push({ id: edgeId("projects", sourceNode.id, cohortNode.id), source: sourceNode.id, target: cohortNode.id, relation: "projects", relationLayer: "source", evidenceClass: "source-lock", evidenceStatus: "source-locked", genealogical: false });
  for (const endpoint of artifact.endpointCohort) edges.push({ id: edgeId("contains-endpoint", cohortNode.id, `endpoint:test-unit-${endpoint.unitId}`), source: cohortNode.id, target: `endpoint:test-unit-${endpoint.unitId}`, relation: "contains-endpoint", relationLayer: "observed-prefix", evidenceClass: "source-projected-endpoint", evidenceStatus: "source-projected", genealogical: false });
  for (const trajectory of artifact.trajectories) {
    const trajectoryId = `trajectory:test-unit-${trajectory.unitId}`;
    const endpointId = `endpoint:test-unit-${trajectory.unitId}`;
    edges.push({ id: edgeId("ends-at", trajectoryId, endpointId), source: trajectoryId, target: endpointId, relation: "ends-at", relationLayer: "observed-history", evidenceClass: "source-projected-observed-prefix", evidenceStatus: "source-projected", futureRowsIncluded: false, genealogical: false });
    edges.push({ id: edgeId("has-provided-outcome", endpointId, `outcome:provided-rul-unit-${trajectory.unitId}`), source: endpointId, target: `outcome:provided-rul-unit-${trajectory.unitId}`, relation: "has-provided-outcome", relationLayer: "provided-outcome", evidenceClass: "source-provided-test-rul", evidenceStatus: "held-out-outcome", providedRulUsedAsInput: false, predicted: false, genealogical: false });
  }
  for (const result of artifact.distanceResults) {
    const resultId = `distance:${result.id}`;
    for (const unitId of artifact.flagship.unitIds) edges.push({ id: edgeId("compares", resultId, `endpoint:test-unit-${unitId}`, String(unitId)), source: resultId, target: `endpoint:test-unit-${unitId}`, relation: "compares", relationLayer: result.window === "last-observed-row" ? "current-frame-analysis" : "observed-history-analysis", evidenceClass: "declared-distance-profile", evidenceStatus: "deterministically-derived", providedRulUsedAsInput: false, createsExactStateIdentity: false, genealogical: false });
  }
  edges.push({ id: edgeId("declared-near", "endpoint:test-unit-25", "endpoint:test-unit-72"), source: "endpoint:test-unit-25", target: "endpoint:test-unit-72", relation: "declared-near", relationLayer: "current-frame-analysis", evidenceClass: "declared-distance-profile", evidenceStatus: "deterministically-derived", profileId: "current-combined", rank: 78, providedRulUsedAsInput: false, createsExactStateIdentity: false, genealogical: false });
  for (const unitId of artifact.flagship.unitIds) edges.push({ id: edgeId("compares-outcome", comparisonNode.id, `outcome:provided-rul-unit-${unitId}`), source: comparisonNode.id, target: `outcome:provided-rul-unit-${unitId}`, relation: "compares-outcome", relationLayer: "provided-outcome-analysis", evidenceClass: "selection-biased-outcome-comparison", evidenceStatus: "derived", selectionBiased: true, genealogical: false });
  edges.push({ id: edgeId("bounded-by", "distance:current-combined", "boundary:input"), source: "distance:current-combined", target: "boundary:input", relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", genealogical: false });
  edges.push({ id: edgeId("bounded-by", comparisonNode.id, "boundary:selection"), source: comparisonNode.id, target: "boundary:selection", relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", genealogical: false });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) { if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`); if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`); edgeIds.add(edge.id); }
  const near = edges.filter((edge) => edge.relation === "declared-near");
  if (near.length !== 1 || near[0].providedRulUsedAsInput || near[0].createsExactStateIdentity) fail("declared-near relation was promoted");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: OPERATIONAL_AGING_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = { mappingVersion: OPERATIONAL_AGING_MAPPING_VERSION, releaseIdentity, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, inventory: { endpoints: endpointNodes.length, trajectories: trajectoryNodes.length, distanceProfiles: distanceNodes.length, providedOutcomes: outcomeNodes.length }, futureRowsIncluded: 0, latentHealthObservations: 0, predictions: 0, outcomeInputs: 0, exactIdentityFromNearness: 0, flagshipSelectionBiased: true, historicalLoadStatus: artifact.historicalLoad.status };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/operational-aging/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "operational-aging", name: "Operational Aging", version, description: "Source-locked NASA C-MAPSS FD001 endpoints, observed histories, declared distance profiles, and provided outcomes kept as separate evidence layers.", status: "external-source-locked-operational-aging-case" },
    source: { id: `operational-aging-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { citation: artifact.source.citation, license: artifact.source.license, archive: artifact.source.archive, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: OPERATIONAL_AGING_MAPPING_VERSION },
      evidenceClasses: { "source-lock": "Exact NASA archive and consumed-member locks.", "source-projected-endpoint": "The last observed test row, containing settings and sensors only.", "source-projected-observed-prefix": "Cycles 1 through the final observed test row; no future rows.", "source-provided-test-rul": "A separately supplied outcome, never an input to a distance profile.", "declared-distance-profile": "A deterministic normalized RMS comparison under one explicit window and field scope.", "selection-biased-outcome-comparison": "An outcome difference for a pair deliberately selected using that outcome.", "analysis-scope": "An explicit boundary against interpreting nearness as identity, outcome as input, or an unevaluated quantity as zero." },
      presentation: { profile: "operational-aging-presentation-v1", nodeKindField: "entityKind", relationField: "relation", layerField: "phase", evidenceClassField: "evidenceClass", labels: { catalogTitle: "Operational aging evidence", searchPlaceholder: "Search endpoints, histories, outcomes, and boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming observation or analysis relations", children: "Outgoing observation or analysis relations" }, coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }], boundary: { title: "Observation / history / outcome boundary", summary: "Current frames, observed histories, latent health, provided RUL, and predictions remain distinct layers.", note: "The highlighted pair is near only under one declared profile. Its 95-cycle RUL gap was used to select the demonstration and is not predictive performance. Historical Load is undefined for this case." } },
      audit
    })
  });
}
