import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyLteeEvolutionaryContingencyCaseIdentity } from "../../cases/ltee-evolutionary-contingency/extract.mjs";

export const LTEE_LINEAGE_HISTORY_MAPPING_VERSION = "ltee-lineage-history-mapping-v1";
const RELEASE_DOMAIN = "onto2d:ltee-lineage-history-model-release:v1";
const AUDIT_DOMAIN = "onto2d:ltee-lineage-history-model-audit:v1";
const EDGE_DOMAIN = "onto2d:ltee-lineage-history-model-edge:v1";

function fail(message) { throw new TypeError(`ltee-lineage-history Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }
function generationLabel(value) { return value === 0 ? "Ancestor" : `Generation ${value.toLocaleString("en-US")}`; }

export function compileLteeLineageHistoryModelPack(input) {
  let artifact;
  try { artifact = verifyLteeEvolutionaryContingencyCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.cohort.sourceGenerationCount !== 16 || artifact.cohort.protocolCount !== 3 || artifact.cohort.observationCount !== 38 || artifact.cohort.independentCitPlusMutantCount !== 17) fail("case inventory differs");
  if (artifact.audit.impossibilityClaims || artifact.audit.protocolsPooled || artifact.audit.completeGenotypesInvented || artifact.audit.uniqueCloneIdentitiesInvented || artifact.audit.replayHistoriesPromotedToOriginalHistory || artifact.audit.causalMutationEdges || artifact.audit.liveQueriesDuringBuild) fail("epistemic boundary differs");

  const sourceNode = {
    id: "source:ltee-ara3-citrate-replays",
    name: "Ara-3 citrate replay evidence",
    description: "The exact bounded projection of Tables 1 and 2 and replay-method descriptions in Blount, Borland, and Lenski (2008).",
    shortDescription: "16 generations / 3 replay protocols / 38 table observations.",
    entityKind: "source-cohort",
    typeRole: "source-locked-projection",
    phase: "source",
    evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    completeMutationPathSpaceClaim: false
  };
  const outcomeNode = {
    id: artifact.cohort.targetOutcomeId,
    name: "Aerobic citrate use (Cit+)",
    description: "The target phenotype whose appearance was recorded in the selected replay experiments; individual observations are not promoted to identical molecular events.",
    shortDescription: "Target phenotype / bounded replay outcome.",
    entityKind: "target-outcome",
    typeRole: "Cit+",
    phase: "target",
    evidenceStatus: "source-declared",
    uniqueMolecularEventClaim: false
  };
  const evidenceLayerNodes = artifact.methodology.evidenceLayers.map((layer, index) => ({
    id: `evidence-layer:${layer.id}`,
    name: layer.id.replaceAll("-", " "),
    description: layer.role,
    shortDescription: layer.authority,
    entityKind: "evidence-layer",
    typeRole: layer.id,
    phase: `evidence-${index + 1}`,
    evidenceStatus: index < 4 ? "source-attributed" : "onto2d-analysis",
    authority: layer.authority,
    layerOrder: index + 1
  }));
  const protocolNodes = artifact.protocols.map((protocol) => ({
    id: `protocol:${protocol.id}`,
    name: protocol.nativeLabel,
    description: `${protocol.mode}; ${protocol.replicates.toLocaleString("en-US")} ${protocol.replicateUnit} records yielded ${protocol.independentCitPlusMutants} independent Cit+ mutants. This design remains separate from the other replays.`,
    shortDescription: `${protocol.replicates.toLocaleString("en-US")} replicates / ${protocol.independentCitPlusMutants} independent Cit+ mutants.`,
    entityKind: "replay-protocol",
    typeRole: protocol.id,
    phase: "replay-protocol",
    evidenceStatus: "source-described",
    protocolIdentity: protocol.identity,
    mode: protocol.mode,
    replicateUnit: protocol.replicateUnit,
    replicates: protocol.replicates,
    independentCitPlusMutants: protocol.independentCitPlusMutants,
    protocolPoolingAllowed: false
  }));
  const assessmentByBackground = new Map(artifact.reachability.backgroundAssessments.map((item) => [item.backgroundId, item]));
  const backgroundNodes = artifact.backgrounds.map((background) => {
    const assessment = assessmentByBackground.get(background.id);
    return {
      id: background.id,
      name: `${generationLabel(background.sourceGeneration)} source background`,
      description: `A published Ara-3 generation sample used as a replay starting background. It is not a complete genotype or a unique-clone identity; potentiation from generation alone remains unresolved.`,
      shortDescription: `${assessment.observedExperimentIds.length} protocol${assessment.observedExperimentIds.length === 1 ? "" : "s"} / Cit+ ${assessment.boundedOutcomeStatus}.`,
      entityKind: "source-background",
      typeRole: assessment.boundedOutcomeStatus,
      phase: "historical-background",
      evidenceStatus: assessment.accessibilityStatus,
      backgroundIdentity: background.identity,
      populationId: background.populationId,
      sourceGeneration: background.sourceGeneration,
      nativeGenerationLabel: background.nativeGenerationLabel,
      observedExperimentIds: canonicalClone(assessment.observedExperimentIds),
      citPlusObservedExperimentIds: canonicalClone(assessment.citPlusObservedExperimentIds),
      completeGenotypeAvailable: false,
      uniqueCloneIdentityAvailable: false,
      impossibilityClaim: false
    };
  });
  const observationNodes = artifact.observations.map((observation) => ({
    id: observation.id,
    name: `${generationLabel(observation.sourceGeneration)} / ${observation.experimentId}`,
    description: `${observation.replicates.toLocaleString("en-US")} retained replicate units and ${observation.independentCitPlusMutants} independent Cit+ mutant${observation.independentCitPlusMutants === 1 ? "" : "s"} in this exact table cell.`,
    shortDescription: `${observation.independentCitPlusMutants}/${observation.replicates.toLocaleString("en-US")} independent Cit+ observations / ${observation.outcomeStatus}.`,
    entityKind: "replay-observation",
    typeRole: observation.experimentId,
    phase: "replay-observation",
    evidenceStatus: observation.outcomeStatus,
    observationIdentity: observation.identity,
    sourceGeneration: observation.sourceGeneration,
    experimentId: observation.experimentId,
    replicates: observation.replicates,
    independentCitPlusMutants: observation.independentCitPlusMutants,
    outcomeStatus: observation.outcomeStatus,
    impossibilityClaim: false,
    outcomeFrequencyClaim: false
  }));
  const statisticNodes = artifact.publishedStatistics.map((statistic) => ({
    id: `statistic:${statistic.experimentId}`,
    name: `${statistic.experimentId} published shift`,
    description: `Published observed mean generation ${statistic.observedMeanGeneration.toLocaleString("en-US")} versus expected ${statistic.expectedMeanGeneration.toLocaleString("en-US")}; Monte Carlo P = ${statistic.publishedMonteCarloPValue}.`,
    shortDescription: `Δ +${statistic.meanShiftGenerations.toLocaleString("en-US")} generations / P ${statistic.publishedMonteCarloPValue}.`,
    entityKind: "published-statistic",
    typeRole: statistic.experimentId,
    phase: "published-analysis",
    evidenceStatus: statistic.tableOneMeanMatchesPublishedExpected ? "source-attributed-arithmetic-aligned" : "source-attributed-discrepancy-visible",
    statisticIdentity: statistic.identity,
    expectedMeanGeneration: statistic.expectedMeanGeneration,
    observedMeanGeneration: statistic.observedMeanGeneration,
    meanShiftGenerations: statistic.meanShiftGenerations,
    publishedMonteCarloPValue: statistic.publishedMonteCarloPValue,
    monteCarloIterations: statistic.monteCarloIterations,
    pValueRecomputed: false,
    tableOneMeanMatchesPublishedExpected: statistic.tableOneMeanMatchesPublishedExpected
  }));
  const interpretationNode = {
    id: "interpretation:history-conditioned-propensity",
    name: "History-conditioned Cit+ propensity",
    description: "The paper interprets later Ara-3 backgrounds as having greater propensity to evolve Cit+ under the selected experiments and supports a potentiated background without identifying one unique potentiating mutation.",
    shortDescription: "Published support / bounded to Ara-3 and the selected replays.",
    entityKind: "published-interpretation",
    typeRole: "bounded-propensity",
    phase: "published-interpretation",
    evidenceStatus: "source-attributed-bounded",
    universalLawClaim: false,
    causalMutationIdentified: false,
    generationUniquelyDeterminesPotentiation: false
  };
  const discrepancyNode = {
    id: "discrepancy:replay-2-expected-mean",
    name: "Replay 2 expected-mean discrepancy",
    description: artifact.sourceDiscrepancies[0].interpretation,
    shortDescription: "Published 28,382 / Table 1 replicate-weighted 26,382.",
    entityKind: "source-discrepancy",
    typeRole: "visible-not-resolved",
    phase: "source-audit",
    evidenceStatus: "visible-not-resolved",
    publishedExpectedMeanGeneration: artifact.sourceDiscrepancies[0].publishedExpectedMeanGeneration,
    tableOneReplicateWeightedMeanGeneration: artifact.sourceDiscrepancies[0].tableOneReplicateWeightedMeanGeneration,
    silentCorrectionApplied: false
  };
  const boundaryNodes = [
    { id: "boundary:not-impossible", name: "Non-observation is not impossibility", description: "A zero-mutant table cell is bounded non-observation under one exact replay design, not proof that Cit+ is biologically inaccessible.", typeRole: "reachability-boundary" },
    { id: "boundary:not-genotype", name: "Generation is not genotype", description: "A published source generation neither supplies a complete genotype nor uniquely identifies every source clone or potentiation state.", typeRole: "identity-boundary" },
    { id: "boundary:not-original-history", name: "Replay is not original history", description: "A replay begins from a historical sample under a new experiment; it is evidence about accessibility, not a continuation of the original LTEE trajectory.", typeRole: "history-boundary" },
    { id: "boundary:historical-load", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, typeRole: "historical-load-boundary", value: null }
  ].map((node) => ({ ...node, shortDescription: "Explicit interpretation boundary.", entityKind: "analysis-boundary", phase: "boundary", evidenceStatus: "explicit-non-claim" }));

  const nodes = [sourceNode, outcomeNode, ...evidenceLayerNodes, ...protocolNodes, ...backgroundNodes, ...observationNodes, ...statisticNodes, interpretationNode, discrepancyNode, ...boundaryNodes];
  const edges = [];
  const add = (relation, source, target, fields = {}) => edges.push({ id: edgeId(relation, source, target, fields.key ?? ""), source, target, relation, genealogical: false, causal: false, ...fields });
  for (const layer of evidenceLayerNodes) add("declares-evidence-layer", sourceNode.id, layer.id, { relationLayer: "source", evidenceClass: "source-attribution", evidenceStatus: "declared", key: layer.id });
  add("defines-target", sourceNode.id, outcomeNode.id, { relationLayer: "source", evidenceClass: "published-target-phenotype", evidenceStatus: "source-declared" });
  for (const protocol of protocolNodes) add("describes-protocol", sourceNode.id, protocol.id, { relationLayer: "protocol", evidenceClass: "published-protocol", evidenceStatus: "source-described", key: protocol.id });
  for (const background of backgroundNodes) add("contains-background", sourceNode.id, background.id, { relationLayer: "historical-background", evidenceClass: "published-generation-sample", evidenceStatus: "source-declared", key: background.id });
  for (const observation of artifact.observations) {
    const observationId = observation.id;
    add("starts-from", observationId, observation.backgroundId, { relationLayer: "replay-observation", evidenceClass: "table-1-cell", evidenceStatus: observation.outcomeStatus, originalHistoryContinuation: false, key: observationId });
    add("runs-under", observationId, `protocol:${observation.experimentId}`, { relationLayer: "replay-observation", evidenceClass: "table-1-cell", evidenceStatus: observation.outcomeStatus, protocolPoolingAllowed: false, key: observationId });
    add("tests-accessibility-of", observationId, outcomeNode.id, { relationLayer: "replay-observation", evidenceClass: "bounded-outcome-observation", evidenceStatus: observation.outcomeStatus, impossibilityClaim: false, key: observationId });
  }
  for (const statistic of artifact.publishedStatistics) add("summarizes-protocol", `statistic:${statistic.experimentId}`, `protocol:${statistic.experimentId}`, { relationLayer: "published-analysis", evidenceClass: "published-monte-carlo-summary", evidenceStatus: "source-attributed", pValueRecomputed: false, key: statistic.experimentId });
  for (const statistic of artifact.publishedStatistics) add("supported-by", interpretationNode.id, `statistic:${statistic.experimentId}`, { relationLayer: "published-interpretation", evidenceClass: "published-history-contingency-interpretation", evidenceStatus: "source-attributed-bounded", causalMutationIdentified: false, key: statistic.experimentId });
  add("audits", discrepancyNode.id, "statistic:replay-2", { relationLayer: "source-audit", evidenceClass: "visible-arithmetic-discrepancy", evidenceStatus: "visible-not-resolved", silentCorrectionApplied: false });
  for (const boundary of boundaryNodes.slice(0, 3)) add("bounded-by", interpretationNode.id, boundary.id, { relationLayer: "boundary", evidenceClass: "explicit-non-claim", evidenceStatus: "declared", key: boundary.id });
  add("bounded-by", sourceNode.id, "boundary:historical-load", { relationLayer: "boundary", evidenceClass: "explicitly-not-evaluated", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs repeat");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edgeIds.has(edge.id)) fail(`edge ${edge.id} is repeated or unresolved`);
    edgeIds.add(edge.id);
  }
  if (edges.some((edge) => edge.causal !== false || edge.genealogical !== false || edge.impossibilityClaim === true || edge.protocolPoolingAllowed === true || edge.originalHistoryContinuation === true || ["causes", "descends-from", "inherits-genotype-from"].includes(edge.relation))) fail("compiled edge exceeds the evidence boundary");
  if (nodes.some((node) => node.impossibilityClaim === true || node.completeGenotypeAvailable === true || node.uniqueCloneIdentityAvailable === true || node.universalLawClaim === true || node.causalMutationIdentified === true || node.silentCorrectionApplied === true)) fail("compiled node exceeds the evidence boundary");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: LTEE_LINEAGE_HISTORY_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: LTEE_LINEAGE_HISTORY_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { evidenceLayers: evidenceLayerNodes.length, protocols: protocolNodes.length, sourceBackgrounds: backgroundNodes.length, observations: observationNodes.length, publishedStatistics: statisticNodes.length, sourceDiscrepancies: 1, boundaries: boundaryNodes.length },
    protocolsPooled: 0,
    impossibilityClaims: 0,
    completeGenotypesInvented: 0,
    uniqueCloneIdentitiesInvented: 0,
    replayHistoriesPromotedToOriginalHistory: 0,
    causalEdges: 0,
    genealogicalEdges: 0,
    publishedPValuesRecomputed: 0,
    sourceDiscrepanciesSilentlyCorrected: 0,
    liveQueriesDuringBuild: 0,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  return buildModelPack({
    model: { id: "ltee-lineage-history", name: "LTEE Lineage History", version, description: "A source-locked Ara-3 citrate replay case preserving generation samples, three distinct protocols, bounded observations, published statistics, and interpretation boundaries as separate graph layers.", status: "external-source-locked-evolutionary-contingency-case" },
    source: { id: `ltee-lineage-history-${artifact.source.identity.slice(7, 23)}`, files: [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/ltee-evolutionary-contingency/${file.path}`, hash: file.identity })), auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { doi: artifact.source.doi, pmid: artifact.source.pmid, pmcid: artifact.source.pmcid, articleUrl: artifact.source.articleUrl, retrievedAt: artifact.source.retrievedAt, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: LTEE_LINEAGE_HISTORY_MAPPING_VERSION },
      evidenceClasses: {
        "source-attribution": "A declared separation between article metadata, source tables, protocol descriptions, published interpretation, and Onto2D analysis.",
        "published-target-phenotype": "The selected paper's Cit+ target outcome.",
        "published-protocol": "One exact replay design whose units and scale are not pooled with another design.",
        "published-generation-sample": "A source-generation label without promotion to complete genotype or unique clone.",
        "table-1-cell": "One retained non-missing generation-by-protocol cell from Table 1.",
        "bounded-outcome-observation": "Cit+ observed or not observed under a bounded protocol, never an impossibility proof.",
        "published-monte-carlo-summary": "A Table 2 statistic retained with its published P value and without a new P-value computation.",
        "published-history-contingency-interpretation": "A paper-attributed bounded interpretation of later-background propensity.",
        "visible-arithmetic-discrepancy": "A source statistic and a simpler table-derived diagnostic shown together without silent correction.",
        "explicit-non-claim": "A boundary preventing genotype, impossibility, original-history, causality, universal-law, or Historical Load promotion."
      },
      presentation: {
        profile: "ltee-lineage-history-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "phase",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "LTEE replay evidence", searchPlaceholder: "Search generations, replay protocols, observations, statistics, and boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming evidence relations", children: "Outgoing evidence relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Historical background / replay / interpretation boundary", summary: "A replay cell describes observed accessibility from one recorded generation under one exact protocol.", note: "Non-observation is not impossibility; generation is not genotype; replay is not original history; published statistics are not recomputed; Historical Load remains undefined." }
      },
      audit
    })
  });
}
