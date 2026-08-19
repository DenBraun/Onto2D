import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyEcologicalMemoryCaseIdentity } from "../../cases/ecological-memory/extract.mjs";

export const ECOLOGICAL_MEMORY_MAPPING_VERSION = "ecological-memory-mapping-v1";
const RELEASE_DOMAIN = "onto2d:ecological-memory-model-release:v1";
const AUDIT_DOMAIN = "onto2d:ecological-memory-model-audit:v1";
const EDGE_DOMAIN = "onto2d:ecological-memory-model-edge:v1";

function fail(message) { throw new TypeError(`ecological-memory Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }

export function compileEcologicalMemoryModelPack(input) {
  let artifact;
  try { artifact = verifyEcologicalMemoryCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.surveys.length !== 2 || artifact.eventGroup.recordCount !== 4 || artifact.beforeAfter.matchedCellCount !== 7275 || artifact.similarSnapshot.cellId !== 7880) fail("case inventory differs");
  if (artifact.beforeAfter.causalEffectEstimated || artifact.beforeAfter.protocolHeldConstant || artifact.similarSnapshot.createsFullEcosystemIdentity || artifact.similarSnapshot.createsHistoryIdentity) fail("scientific boundary differs");

  const sourceNode = {
    id: "source:neon-soap-tutorial-cohort",
    name: "NEON SOAP tutorial cohort",
    description: "Exact public tutorial files and compact projections for one 1 x 1 km Soaproot Saddle LiDAR tile.",
    shortDescription: "Three external byte locks; two exact tutorial blobs.",
    entityKind: "source",
    typeRole: "source-locked-cohort",
    phase: "source",
    scientificStatus: "source-locked",
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    formalReleaseTagKnown: false,
    exactExternalBytesPinned: true
  };
  const siteNode = {
    id: "site:soap-tile-293000-4100000",
    name: "SOAP tile 293000 / 4100000",
    description: "One exact 1 x 1 km EPSG:32611 tile at NEON's Soaproot Saddle site.",
    shortDescription: "D17 / SOAP / one bounded spatial extent.",
    entityKind: "site",
    typeRole: "bounded-lidar-tile",
    phase: "spatial-boundary",
    scientificStatus: "source-identified"
  };
  const projectionNode = {
    id: "projection:vegetation-height-v1",
    name: "Four-quantile vegetation-height projection",
    description: "High-vegetation returns summarized as P20, P50, P75, and P90 height in qualified 10 m cells using the 2021 DTM.",
    shortDescription: "4 variables / 10 m cells / at least 50 returns.",
    entityKind: "state-projection",
    typeRole: "bounded-vegetation-height-projection",
    phase: "derived-state",
    scientificStatus: "deterministically-derived",
    variableCount: 4,
    fullEcosystemState: false
  };
  const surveyNodes = artifact.surveys.map((survey) => ({
    id: `survey:soap-${survey.year}`,
    name: `${survey.year} SOAP LiDAR survey`,
    description: `${survey.pointCount.toLocaleString("en-US")} native returns projected into ${survey.qualifiedCellCount.toLocaleString("en-US")} qualified 10 m cells.`,
    shortDescription: `${survey.sensor}; ${survey.qualifiedCellCount.toLocaleString("en-US")} cells.`,
    entityKind: "survey",
    typeRole: survey.year === 2019 ? "pre-selected-event-survey" : "post-selected-event-survey",
    phase: survey.year === 2019 ? "observed-before" : "observed-after",
    scientificStatus: survey.evidenceState,
    year: survey.year,
    sensor: survey.sensor,
    surveyIdentity: survey.identity,
    fullEcosystemState: false
  }));
  const eventNode = {
    id: "event:creek-fire-record-group",
    name: "Creek Fire records",
    description: "Four primary-reporter records rendered by NEON's site-management tutorial and grouped there as the 2020 Creek Fire.",
    shortDescription: "4 records / 2020-09-04 to 2020-12-24.",
    entityKind: "recorded-event",
    typeRole: "published-event-group",
    phase: "recorded-history",
    scientificStatus: "source-recorded-context",
    eventIdentity: artifact.eventGroup.identity,
    recordCount: 4,
    causalRole: "context-only",
    exactTilePerimeterJoin: false
  };
  const beforeAfterNode = {
    id: "analysis:matched-before-after",
    name: "Matched-cell before / after comparison",
    description: "A descriptive 2021-minus-2019 comparison over 7,275 cells qualified in both surveys.",
    shortDescription: "7,275 matched cells; P90 median change -0.10439 m.",
    entityKind: "analysis-result",
    typeRole: "descriptive-before-after",
    phase: "history-aware-analysis",
    scientificStatus: "deterministically-derived-bounded",
    matchedCellCount: 7275,
    causalEffectEstimated: false,
    protocolHeldConstant: false
  };
  const cellNode = {
    id: "cell:soap-7880",
    name: "SOAP grid cell 7880",
    description: "The exact 10 m cell selected by the declared equal-signature rule.",
    shortDescription: "EPSG:32611 / E293800 / N4100220.",
    entityKind: "spatial-cell",
    typeRole: "flagship-matched-cell",
    phase: "spatial-boundary",
    scientificStatus: "source-projected-location",
    cellId: 7880
  };
  const observationNodes = [artifact.similarSnapshot.before, artifact.similarSnapshot.after].map((observation) => ({
    id: `observation:cell-7880-${observation.year}`,
    name: `Cell 7880 / ${observation.year}`,
    description: `The unrounded four-quantile projected observation for cell 7880 in ${observation.year}.`,
    shortDescription: `${observation.returnCount.toLocaleString("en-US")} retained high-vegetation returns.`,
    entityKind: "observation",
    typeRole: observation.year === 2019 ? "pre-event-state-projection" : "post-event-state-projection",
    phase: observation.year === 2019 ? "observed-before" : "observed-after",
    scientificStatus: "source-projected-measurement",
    year: observation.year,
    returnCount: observation.returnCount,
    state: canonicalClone(observation.state),
    fullEcosystemState: false
  }));
  const signatureNode = {
    id: "analysis:cell-7880-rounded-signature",
    name: "Equal displayed state signature",
    description: "Both observations round to [3.0, 3.5, 3.8, 4.0] m under the four-variable display profile.",
    shortDescription: "Same displayed projection; different evidence context.",
    entityKind: "equivalence-result",
    typeRole: "projection-relative-equivalence",
    phase: "state-comparison",
    scientificStatus: "regime-relative-derived-result",
    signature: canonicalClone(artifact.similarSnapshot.displaySignature),
    precisionMeters: 0.1,
    createsFullEcosystemIdentity: false,
    createsHistoryIdentity: false
  };
  const equivalenceNodes = artifact.historyEquivalence.map((result) => ({
    id: `equivalence:${result.regime}`,
    name: result.regime.replaceAll("-", " "),
    description: result.reason,
    shortDescription: result.equivalent === null ? "Unresolved by this projection." : result.equivalent ? "Equivalent in this regime." : "Not equivalent in this regime.",
    entityKind: "equivalence-result",
    typeRole: result.regime,
    phase: "equivalence-analysis",
    scientificStatus: result.equivalent === null ? "explicitly-unresolved" : "deterministically-derived",
    equivalent: result.equivalent
  }));
  const historyWindowNodes = artifact.historyWindows.map((window) => ({
    id: `history-window:${window.id}`,
    name: window.id.replaceAll("-", " "),
    description: `Includes ${window.includes.join(", ")}.`,
    shortDescription: window.eventContextVisible ? "Recorded event context visible." : "Current projection only.",
    entityKind: "history-window",
    typeRole: window.id,
    phase: "history-window",
    scientificStatus: "declared-analysis-scope",
    eventContextVisible: window.eventContextVisible
  }));
  const boundaryNodes = [
    { id: "boundary:protocol", name: "Instrument change", description: "The 2019 Optech Gemini and 2021 Teledyne Optech Galaxy Prime are not treated as one unchanged measurement protocol.", shortDescription: "Sensor protocol differs across years.", typeRole: "protocol-boundary", scientificStatus: "explicit-confound", sameInstrument: false },
    { id: "boundary:causality", name: "No causal effect estimate", description: "Temporal order and a published fire-affected-tile interpretation do not identify the Creek Fire as the necessary cause of the measured difference.", shortDescription: "Recorded before/after is not causation.", typeRole: "causality-boundary", scientificStatus: "explicit-non-claim", causalEffectEstimated: false },
    { id: "boundary:reachability", name: "Observed after-state only", description: "The 2021 survey supplies one later observation; no future state is predicted and two surveys do not form a recovery trajectory.", shortDescription: "No prediction or recovery curve.", typeRole: "reachability-boundary", scientificStatus: "explicitly-bounded", futurePredictionIncluded: false },
    { id: "boundary:historical-load", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, shortDescription: "No route space, route cost, or baseline.", typeRole: "historical-load-boundary", scientificStatus: "explicitly-not-evaluated", value: null }
  ].map((node) => ({ ...node, entityKind: "analysis-boundary", phase: "evidence-boundary" }));

  const nodes = [sourceNode, siteNode, projectionNode, ...surveyNodes, eventNode, beforeAfterNode, cellNode, ...observationNodes, signatureNode, ...equivalenceNodes, ...historyWindowNodes, ...boundaryNodes];
  const edges = [];
  const add = (relation, source, target, fields = {}) => edges.push({ id: edgeId(relation, source, target, fields.key ?? ""), source, target, relation, genealogical: false, ...fields });
  add("projects", sourceNode.id, siteNode.id, { relationLayer: "source", evidenceClass: "source-lock", evidenceStatus: "source-locked" });
  add("defines", sourceNode.id, projectionNode.id, { relationLayer: "source", evidenceClass: "declared-projection", evidenceStatus: "source-locked" });
  for (const survey of surveyNodes) {
    add("observes", survey.id, siteNode.id, { relationLayer: survey.phase, evidenceClass: "source-projected-measurement", evidenceStatus: "source-projected", key: survey.id });
    add("uses-projection", survey.id, projectionNode.id, { relationLayer: "derived-state", evidenceClass: "declared-projection", evidenceStatus: "derived", key: survey.id });
  }
  add("recorded-before", eventNode.id, "survey:soap-2021", { relationLayer: "recorded-history", evidenceClass: "recorded-temporal-context", evidenceStatus: "source-recorded", causal: false });
  add("contextualizes", eventNode.id, beforeAfterNode.id, { relationLayer: "history-aware-analysis", evidenceClass: "published-interpretation", evidenceStatus: "attributed", causal: false });
  for (const survey of surveyNodes) add("compared-by", survey.id, beforeAfterNode.id, { relationLayer: "history-aware-analysis", evidenceClass: "matched-cell-comparison", evidenceStatus: "derived", key: survey.id });
  add("contains", siteNode.id, cellNode.id, { relationLayer: "spatial-boundary", evidenceClass: "grid-membership", evidenceStatus: "derived" });
  for (const observation of observationNodes) {
    add("observes-cell", observation.id, cellNode.id, { relationLayer: observation.phase, evidenceClass: "source-projected-measurement", evidenceStatus: "source-projected", key: observation.id });
    add("compared-by", observation.id, signatureNode.id, { relationLayer: "state-comparison", evidenceClass: "declared-rounding-profile", evidenceStatus: "derived", key: observation.id });
  }
  add("declared-equivalent", observationNodes[0].id, observationNodes[1].id, { relationLayer: "state-comparison", evidenceClass: "declared-rounding-profile", evidenceStatus: "regime-relative", regime: "rounded-four-quantile-projection", createsFullEcosystemIdentity: false, createsHistoryIdentity: false });
  for (const result of equivalenceNodes) add("reports", signatureNode.id, result.id, { relationLayer: "equivalence-analysis", evidenceClass: "declared-equivalence-regime", evidenceStatus: "derived", key: result.id });
  for (const window of historyWindowNodes) add("scopes", window.id, signatureNode.id, { relationLayer: "history-window", evidenceClass: "declared-analysis-scope", evidenceStatus: "declared", key: window.id });
  add("bounded-by", beforeAfterNode.id, "boundary:protocol", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "protocol" });
  add("bounded-by", beforeAfterNode.id, "boundary:causality", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "causality" });
  add("bounded-by", beforeAfterNode.id, "boundary:reachability", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "reachability" });
  add("bounded-by", beforeAfterNode.id, "boundary:historical-load", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "historical-load" });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) { if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`); if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`); edgeIds.add(edge.id); }
  const causalEdges = edges.filter((edge) => edge.relation === "causes" || edge.causal === true);
  if (causalEdges.length) fail("recorded disturbance was promoted to causation");
  const near = edges.filter((edge) => edge.relation === "declared-equivalent");
  if (near.length !== 1 || near[0].createsFullEcosystemIdentity || near[0].createsHistoryIdentity) fail("projection equivalence was promoted to identity");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: ECOLOGICAL_MEMORY_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: ECOLOGICAL_MEMORY_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { surveys: surveyNodes.length, recordedEventGroups: 1, equivalenceRegimes: equivalenceNodes.length, historyWindows: historyWindowNodes.length },
    causalEdges: 0,
    futurePredictions: 0,
    recoveryTrajectoryClaims: 0,
    fullEcosystemIdentityClaims: 0,
    historyIdentityFromProjectedSimilarity: 0,
    formalReleaseTagKnown: false,
    exactExternalBytesPinned: true,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/ecological-memory/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "ecological-memory", name: "Ecological Memory", version, description: "A source-locked NEON SOAP before/after case that keeps recorded disturbance, projected vegetation height, protocol change, and causal interpretation separate.", status: "external-source-locked-ecological-memory-case" },
    source: { id: `ecological-memory-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { citation: artifact.source.citation, license: artifact.source.license, landingPage: artifact.source.landingPage, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: ECOLOGICAL_MEMORY_MAPPING_VERSION },
      evidenceClasses: {
        "source-lock": "Exact tutorial blobs, public file IDs, byte counts, and SHA-256 identities.",
        "declared-projection": "A bounded four-quantile vegetation-height projection, not full ecosystem state.",
        "source-projected-measurement": "A measurement projected from one exact source survey under the declared protocol.",
        "recorded-temporal-context": "A source-recorded event that precedes an observation without becoming a causal edge.",
        "published-interpretation": "A separately attributable tutorial interpretation connecting the tile and fire context.",
        "matched-cell-comparison": "A deterministic same-grid-cell comparison across the two surveys.",
        "declared-rounding-profile": "Projection-relative equality at a declared 0.1 m display precision.",
        "declared-equivalence-regime": "One explicit answer to an equivalence question; no regime silently replaces another.",
        "declared-analysis-scope": "An explicit history-window or non-claim boundary.",
        "analysis-scope": "A boundary against causal, predictive, recovery, identity, or Historical Load overclaiming."
      },
      presentation: {
        profile: "ecological-memory-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "phase",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Ecological memory evidence", searchPlaceholder: "Search surveys, cells, events, and boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming evidence or analysis relations", children: "Outgoing evidence or analysis relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }],
        boundary: { title: "Record / measurement / interpretation boundary", summary: "Recorded disturbance, projected state, sensor protocol, and causal interpretation remain separate.", note: "Cell 7880 looks the same only under one four-number rounding regime. Exact measurements, event context, and measurement protocol differ; Historical Load remains undefined." }
      },
      audit
    })
  });
}
