import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyLegalPrecedentCaseIdentity } from "../../cases/legal-precedent-history/extract.mjs";

export const LEGAL_PRECEDENT_MAPPING_VERSION = "legal-precedent-mapping-v1";
const RELEASE_DOMAIN = "onto2d:legal-precedent-model-release:v1";
const AUDIT_DOMAIN = "onto2d:legal-precedent-model-audit:v1";
const EDGE_DOMAIN = "onto2d:legal-precedent-model-edge:v1";

function fail(message) { throw new TypeError(`legal-precedent-history Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }

export function compileLegalPrecedentModelPack(input) {
  let artifact;
  try { artifact = verifyLegalPrecedentCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.opinions.length !== 7 || artifact.citations.length !== 16 || artifact.normativeClaims.length !== 4) fail("case inventory differs");
  if (artifact.audit.bindingClaims !== 0 || artifact.audit.citationCountsUsedInDerivation || artifact.audit.courtHierarchyGuessed || artifact.audit.futureInputEdges !== 0) fail("legal evidence boundary differs");

  const sourceNode = {
    id: "source:school-desegregation-cohort",
    name: "Pinned school-desegregation cohort",
    description: "Seven selected Supreme Court opinions joined across CourtListener citation metadata and exact GovInfo United States Reports documents.",
    shortDescription: "7 opinions / 2 providers / incomplete by design.",
    entityKind: "source-cohort",
    typeRole: "source-locked-cohort",
    phase: "source",
    evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    completeDoctrinalCorpus: false
  };
  const courtNode = {
    id: "court:scotus",
    name: artifact.cohort.courtName,
    description: "The single court boundary declared by this research cohort. The compiler adds no court hierarchy relation.",
    shortDescription: "CourtListener court ID: scotus.",
    entityKind: "court",
    typeRole: "declared-court",
    phase: "source",
    evidenceStatus: "source-recorded",
    courtId: artifact.cohort.courtId,
    hierarchyClaim: "not-inferred"
  };
  const opinionNodes = artifact.opinions.map((opinion) => ({
    id: `opinion:${opinion.id}`,
    name: opinion.shortName,
    description: `${opinion.name}, ${opinion.reporterCitation}; official decision date ${opinion.officialDecisionDate}.`,
    shortDescription: `${opinion.reporterCitation} / ${opinion.officialDecisionDate}.`,
    entityKind: "opinion",
    typeRole: opinion.id === artifact.availability.targetOpinionId ? "target-opinion" : artifact.availability.priorOpinionIds.includes(opinion.id) ? "prior-opinion" : "later-opinion",
    phase: opinion.id === artifact.availability.targetOpinionId ? "decision-time" : artifact.availability.priorOpinionIds.includes(opinion.id) ? "available-before-target" : "after-target",
    evidenceStatus: "official-document-and-provider-record",
    opinionId: opinion.id,
    reporterCitation: opinion.reporterCitation,
    officialDecisionDate: opinion.officialDecisionDate,
    courtListenerDateFiled: opinion.courtListenerDateFiled,
    dateAgreement: opinion.dateAgreement,
    courtListenerOpinionId: opinion.courtListener.opinionId,
    courtListenerOpinionSha1: opinion.courtListener.opinionSha1,
    providerCiteCountAtRetrieval: opinion.courtListener.citeCountAtRetrieval,
    providerCiteCountRole: "display-only",
    bindingStatus: "not-classified",
    publicUrl: opinion.courtListener.publicUrl,
    officialDocumentUrl: opinion.officialDocument.detailUrl
  }));
  const contextNode = {
    id: "analysis:green-available-context",
    name: "Green available-at-time context",
    description: "The four selected opinions with official GovInfo decision dates strictly before Green, plus the ten citation edges among the context and target.",
    shortDescription: "4 prior opinions / 10 context edges / 2 later opinions excluded.",
    entityKind: "availability-projection",
    typeRole: "available-precedent-context",
    phase: "derived-analysis",
    evidenceStatus: "deterministically-derived",
    contextIdentity: artifact.availability.identity,
    cutoffDate: artifact.availability.cutoffDate,
    dateAuthority: artifact.availability.dateAuthority,
    legalPredictionIncluded: false,
    bindingStatusDetermined: false
  };
  const claimNodes = artifact.normativeClaims.map((claim) => ({
    id: `treatment:${claim.id}`,
    name: claim.label,
    description: claim.basis,
    shortDescription: `${claim.treatment}; ${claim.locator}.`,
    entityKind: "normative-treatment-claim",
    typeRole: claim.treatment,
    phase: "source-attributed-interpretation",
    evidenceStatus: "attributed-to-source-opinion",
    claimId: claim.id,
    treatment: claim.treatment,
    attribution: claim.attribution,
    locator: claim.locator,
    bindingStatus: claim.bindingStatus,
    claimScope: claim.claimScope,
    inferredFromCitationCount: false,
    evidenceSourceUrl: claim.evidenceSourceUrl
  }));
  const disagreementNodes = artifact.dateDisagreements.map((item) => ({
    id: `date-disagreement:${item.opinionId}`,
    name: `${artifact.opinions.find((opinion) => opinion.id === item.opinionId).shortName} date disagreement`,
    description: `GovInfo records ${item.officialDecisionDate}; CourtListener dateFiled records ${item.courtListenerDateFiled}. Both are retained.`,
    shortDescription: `${item.officialDecisionDate} / ${item.courtListenerDateFiled}.`,
    entityKind: "source-disagreement",
    typeRole: "provider-date-disagreement",
    phase: "evidence-boundary",
    evidenceStatus: "explicit-conflict",
    ...item
  }));
  const counterfactualNode = {
    id: "analysis:withhold-brown-ii",
    name: "Withhold Brown II from the derived view",
    description: artifact.counterfactual.question,
    shortDescription: "10 -> 6 derived edges; source graph unchanged.",
    entityKind: "counterfactual-analysis",
    typeRole: "graph-ablation",
    phase: "counterfactual",
    evidenceStatus: "analysis-only",
    removedOpinionId: artifact.counterfactual.removedOpinionId,
    baseDerivedEdgeCount: artifact.counterfactual.baseDerivedEdgeCount,
    remainingDerivedEdgeCount: artifact.counterfactual.remainingDerivedEdgeCount,
    sourceGraphMutated: false,
    legalConclusionAllowed: false
  };
  const loadBoundary = {
    id: "boundary:historical-load-not-evaluated",
    name: "Historical Load is undefined",
    description: artifact.historicalLoad.reason,
    shortDescription: "No legal route space, cost function, or history-free baseline.",
    entityKind: "analysis-boundary",
    typeRole: "historical-load-boundary",
    phase: "evidence-boundary",
    evidenceStatus: "explicitly-not-evaluated",
    value: null
  };
  const adviceBoundary = {
    id: "boundary:not-legal-advice",
    name: "Not legal advice",
    description: artifact.legalDisclaimer,
    shortDescription: "No current-law, authority, or outcome determination.",
    entityKind: "analysis-boundary",
    typeRole: "legal-advice-boundary",
    phase: "evidence-boundary",
    evidenceStatus: "explicit-non-claim",
    legalAdviceGenerated: false
  };
  const nodes = [sourceNode, courtNode, ...opinionNodes, contextNode, ...claimNodes, ...disagreementNodes, counterfactualNode, loadBoundary, adviceBoundary];
  const edges = [];
  edges.push({ id: edgeId("scoped-to-court", sourceNode.id, courtNode.id), source: sourceNode.id, target: courtNode.id, relation: "scoped-to-court", relationLayer: "source", evidenceClass: "declared-cohort", evidenceStatus: "source-recorded", hierarchyClaim: false });
  for (const opinion of artifact.opinions) {
    const opinionNodeId = `opinion:${opinion.id}`;
    edges.push({ id: edgeId("contains-opinion", sourceNode.id, opinionNodeId), source: sourceNode.id, target: opinionNodeId, relation: "contains-opinion", relationLayer: "source", evidenceClass: "bounded-selection", evidenceStatus: "source-recorded", completeCorpusClaim: false });
  }
  for (const citation of artifact.citations) {
    edges.push({
      id: citation.id,
      source: `opinion:${citation.citingOpinionId}`,
      target: `opinion:${citation.citedOpinionId}`,
      relation: "cites",
      relationLayer: "native-citation",
      evidenceClass: "courtlistener-opinion-cites",
      evidenceStatus: citation.evidenceState,
      causalDependency: "not-inferred",
      bindingStatus: "unknown",
      createsAuthority: false
    });
  }
  edges.push({ id: edgeId("targets-decision", contextNode.id, "opinion:green"), source: contextNode.id, target: "opinion:green", relation: "targets-decision", relationLayer: "availability", evidenceClass: "declared-analysis-profile", evidenceStatus: "derived" });
  for (const opinionId of artifact.availability.priorOpinionIds) edges.push({ id: edgeId("available-before", contextNode.id, `opinion:${opinionId}`), source: contextNode.id, target: `opinion:${opinionId}`, relation: "available-before", relationLayer: "availability", evidenceClass: "official-decision-date", evidenceStatus: "derived", cutoffDate: artifact.availability.cutoffDate });
  for (const opinionId of artifact.availability.futureOpinionIds) edges.push({ id: edgeId("excluded-after-cutoff", contextNode.id, `opinion:${opinionId}`), source: contextNode.id, target: `opinion:${opinionId}`, relation: "excluded-after-cutoff", relationLayer: "availability", evidenceClass: "official-decision-date", evidenceStatus: "derived", excludedFromHistoricalInput: true });
  for (const claim of artifact.normativeClaims) {
    const nodeId = `treatment:${claim.id}`;
    edges.push({ id: edgeId("attributed-to-opinion", nodeId, `opinion:${claim.citingOpinionId}`), source: nodeId, target: `opinion:${claim.citingOpinionId}`, relation: "attributed-to-opinion", relationLayer: "normative-treatment", evidenceClass: "official-opinion-locator", evidenceStatus: "attributed", createsBindingStatus: false });
    edges.push({ id: edgeId("treats-cited-opinion", nodeId, `opinion:${claim.citedOpinionId}`, claim.treatment), source: nodeId, target: `opinion:${claim.citedOpinionId}`, relation: "treats-cited-opinion", relationLayer: "normative-treatment", evidenceClass: "official-opinion-locator", evidenceStatus: "attributed", treatment: claim.treatment, bindingStatus: "not-classified" });
  }
  for (const disagreement of artifact.dateDisagreements) edges.push({ id: edgeId("qualifies-date", `date-disagreement:${disagreement.opinionId}`, `opinion:${disagreement.opinionId}`), source: `date-disagreement:${disagreement.opinionId}`, target: `opinion:${disagreement.opinionId}`, relation: "qualifies-date", relationLayer: "evidence-boundary", evidenceClass: "cross-provider-comparison", evidenceStatus: "explicit-conflict" });
  edges.push({ id: edgeId("ablates-from-derived-view", counterfactualNode.id, "opinion:brown-ii"), source: counterfactualNode.id, target: "opinion:brown-ii", relation: "ablates-from-derived-view", relationLayer: "counterfactual", evidenceClass: "analysis-operation", evidenceStatus: "counterfactual", sourceGraphMutable: false });
  edges.push({ id: edgeId("analyzes-context", counterfactualNode.id, contextNode.id), source: counterfactualNode.id, target: contextNode.id, relation: "analyzes-context", relationLayer: "counterfactual", evidenceClass: "graph-reachability", evidenceStatus: "derived", legalConclusionAllowed: false });
  edges.push({ id: edgeId("bounded-by", contextNode.id, loadBoundary.id), source: contextNode.id, target: loadBoundary.id, relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });
  edges.push({ id: edgeId("bounded-by", contextNode.id, adviceBoundary.id), source: contextNode.id, target: adviceBoundary.id, relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
    if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`);
    edgeIds.add(edge.id);
  }
  if (edges.filter((edge) => edge.relation === "cites").length !== 16 || edges.some((edge) => edge.bindingStatus === "binding" || edge.createsAuthority === true)) fail("compiled citation semantics differ");
  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: LEGAL_PRECEDENT_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: LEGAL_PRECEDENT_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { opinions: 7, nativeCitationEdges: 16, attributedTreatmentClaims: 4, dateDisagreements: 2, availabilityContexts: 1, counterfactuals: 1 },
    bindingClaims: 0,
    citationCountsUsedInDerivation: false,
    courtHierarchyRelations: 0,
    futureInputEdges: 0,
    sourceGraphMutations: 0,
    legalAdviceGenerated: false,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/legal-precedent-history/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "legal-precedent-history", name: "Legal Precedent History", version, description: "A bounded, time-aware legal citation graph with separately attributed treatment claims and no inferred binding status.", status: "external-source-locked-legal-history-case" },
    source: { id: `legal-precedent-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { cohortId: artifact.cohort.id, retrievedAt: artifact.cohort.retrievedAt, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, availabilityIdentity: artifact.availability.identity, releaseIdentity, mappingVersion: LEGAL_PRECEDENT_MAPPING_VERSION },
      evidenceClasses: {
        "courtlistener-opinion-cites": "Native CourtListener opinion.cites record; citation only.",
        "official-opinion-locator": "Treatment claim attributed to an exact locator in the official Green opinion.",
        "official-decision-date": "GovInfo United States Reports decision date used for the declared time slice.",
        "cross-provider-comparison": "An explicit GovInfo versus CourtListener date disagreement.",
        "graph-reachability": "Derived graph connectivity only; no legal conclusion.",
        "analysis-scope": "Boundary preserving undefined analyses and the no-legal-advice rule."
      },
      presentation: {
        profile: "legal-precedent-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "phase",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Legal precedent evidence", searchPlaceholder: "Search opinions, citations, treatment claims, and source boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming legal-record relations", children: "Outgoing legal-record relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Citation / treatment / authority boundary", summary: "Native citation edges and source-attributed treatment claims remain separate layers; binding status is not inferred.", note: "The cohort is incomplete, later opinions are excluded from earlier context, provider date conflicts remain visible, counterfactuals mutate no source record, and the model is not legal advice." }
      },
      audit
    })
  });
}
