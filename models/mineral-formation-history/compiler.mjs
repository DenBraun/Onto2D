import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyMineralFormationHistoryCaseIdentity } from "../../cases/mineral-formation-history/extract.mjs";

export const MINERAL_FORMATION_MAPPING_VERSION = "mineral-formation-mapping-v1";
const RELEASE_DOMAIN = "onto2d:mineral-formation-model-release:v1";
const AUDIT_DOMAIN = "onto2d:mineral-formation-model-audit:v1";
const EDGE_DOMAIN = "onto2d:mineral-formation-model-edge:v1";

function fail(message) { throw new TypeError(`mineral-formation-history Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }
function sampleNodeId(sampleId) { return `sample:${sampleId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`; }

export function compileMineralFormationHistoryModelPack(input) {
  let artifact;
  try { artifact = verifyMineralFormationHistoryCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.samples.length !== 10 || artifact.analyses.length !== 95 || artifact.formationClaims.length !== 3) fail("case inventory differs");
  if (artifact.audit.automaticFormationClassifications || artifact.audit.localityToFormationInferences || artifact.audit.ageToFormationInferences || artifact.audit.onto2dGeneratedCausalEdges) fail("mineral evidence boundary differs");

  const sourceNode = {
    id: "source:gregory-2019-pyrite-cohort",
    name: "Gregory et al. pyrite-nodule cohort",
    description: "Ten source-identified sedimentary pyrite-nodule samples and 95 retained LA-ICP-MS rows from the pinned Mendeley Data release.",
    shortDescription: "10 samples / 95 analyses / bounded, incomplete cohort.",
    entityKind: "source-cohort", typeRole: "source-locked-cohort", phase: "source-record", evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, completeFormationSpace: false
  };
  const speciesNode = {
    id: "species:pyrite", name: "Pyrite / FeS2",
    description: "The conventional species-level comparison key for the bounded source cohort. It complements rather than replaces sample or formation-history identity.",
    shortDescription: "1 conventional species class / 10 sample records.",
    entityKind: "mineral-species", typeRole: "conventional-species", phase: "species-classification", evidenceStatus: "bounded-source-label",
    speciesIdentity: artifact.species.identity, formula: artifact.species.formula
  };
  const sampleNodes = artifact.samples.map((sample) => ({
    id: sampleNodeId(sample.sampleId), name: sample.sampleId,
    description: `${sample.description}; ${sample.location}, ${sample.country}.`,
    shortDescription: `${sample.ageMa} Ma / ${sample.period} / ${sample.measurementSummary.analysisCount} analyses.`,
    entityKind: "mineral-sample", typeRole: sample.formationMappingStatus === "reviewed-published-interpretation" ? "reviewed-representative" : "unmapped-source-sample",
    phase: "sample-record", evidenceStatus: sample.formationMappingStatus,
    sampleIdentity: sample.identity, sampleId: sample.sampleId, ageMa: sample.ageMa, period: sample.period, location: sample.location, country: sample.country,
    supergroupOrGroup: sample.supergroupOrGroup, formation: sample.formation, memberOrUnit: sample.memberOrUnit,
    analysisCount: sample.measurementSummary.analysisCount
  }));
  const measurementNodes = artifact.samples.map((sample) => ({
    id: `measurement-series:${sampleNodeId(sample.sampleId).slice(7)}`,
    name: `${sample.sampleId} LA-ICP-MS series`,
    description: `${sample.measurementSummary.analysisCount} exact Appendix 3 rows. Selected Co, Ni, Cu, As, Se, Ag, and Sb ranges are descriptive source summaries, not an automatic formation classifier.`,
    shortDescription: `${sample.measurementSummary.analysisCount} source rows / reported trace elements in ppm.`,
    entityKind: "measurement-series", typeRole: "la-icp-ms-series", phase: "direct-measurement", evidenceStatus: "source-recorded",
    sampleId: sample.sampleId, analysisCount: sample.measurementSummary.analysisCount,
    analysisIdentities: sample.analysisIdentities, selectedTraceElementRanges: sample.measurementSummary.selectedTraceElementRanges,
    autoClassificationAllowed: false
  }));
  const claimNodes = artifact.formationClaims.map((claim) => ({
    id: `published-claim:${claim.sampleId.toLowerCase()}`, name: claim.shortLabel,
    description: claim.evidenceSummary, shortDescription: `${claim.qualifier}; ${claim.sampleId}; ${claim.locator}.`,
    entityKind: "formation-interpretation", typeRole: claim.profile, phase: "published-interpretation", evidenceStatus: "qualified-published-claim",
    claimIdentity: claim.identity, sampleId: claim.sampleId, qualifier: claim.qualifier, locator: claim.locator, articleDoi: claim.articleDoi,
    onto2dGenerated: false
  }));
  const regimeNodes = artifact.identityRegimes.map((regime) => ({
    id: `identity-regime:${regime.id}`, name: regime.id.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
    description: regime.meaning, shortDescription: `${regime.classes.length} class(es) / ${regime.unresolved.length} unresolved.`,
    entityKind: "identity-regime", typeRole: regime.id, phase: "onto2d-analysis", evidenceStatus: "deterministically-derived",
    equivalenceKey: regime.equivalenceKey, classCount: regime.classes.length, unresolvedCount: regime.unresolved.length
  }));
  const unresolvedNode = {
    id: "boundary:seven-unmapped-samples", name: "Seven mappings remain unresolved",
    description: "These samples are present in the source projection but receive no case-local formation profile from age, locality, description, or trace-element values.",
    shortDescription: "Unmapped in this release; not globally unknowable.",
    entityKind: "analysis-boundary", typeRole: "unmapped-formation-profile", phase: "evidence-boundary", evidenceStatus: "explicitly-unresolved",
    unresolvedSampleCount: 7, automaticClassificationCount: 0
  };
  const loadNode = {
    id: "boundary:historical-load-not-evaluated", name: "Historical Load is undefined",
    description: artifact.historicalLoad.reason, shortDescription: "No finite path space, admissibility relation, costs, or baseline.",
    entityKind: "analysis-boundary", typeRole: "historical-load-boundary", phase: "evidence-boundary", evidenceStatus: "explicitly-not-evaluated", value: null
  };
  const nodes = [sourceNode, speciesNode, ...sampleNodes, ...measurementNodes, ...claimNodes, ...regimeNodes, unresolvedNode, loadNode];
  const edges = [];
  edges.push({ id: edgeId("declares-species-key", sourceNode.id, speciesNode.id), source: sourceNode.id, target: speciesNode.id, relation: "declares-species-key", relationLayer: "species-classification", evidenceClass: "bounded-species-label", evidenceStatus: "declared", identityReplacement: false });
  for (const sample of artifact.samples) {
    const sampleId = sampleNodeId(sample.sampleId);
    const measurementId = `measurement-series:${sampleId.slice(7)}`;
    edges.push({ id: edgeId("contains-sample", sourceNode.id, sampleId), source: sourceNode.id, target: sampleId, relation: "contains-sample", relationLayer: "source-record", evidenceClass: "dataset-table-1", evidenceStatus: "source-recorded", completeCohortClaim: false });
    edges.push({ id: edgeId("classified-as-species", sampleId, speciesNode.id), source: sampleId, target: speciesNode.id, relation: "classified-as-species", relationLayer: "species-classification", evidenceClass: "bounded-species-label", evidenceStatus: "declared", sampleMerged: false });
    edges.push({ id: edgeId("measured-by-series", sampleId, measurementId), source: sampleId, target: measurementId, relation: "measured-by-series", relationLayer: "direct-measurement", evidenceClass: "appendix-3-la-icp-ms", evidenceStatus: "source-recorded", causalFormationClaim: false });
    if (sample.formationMappingStatus === "unmapped-within-bounded-case") edges.push({ id: edgeId("unresolved-under", sampleId, unresolvedNode.id), source: sampleId, target: unresolvedNode.id, relation: "unresolved-under", relationLayer: "evidence-boundary", evidenceClass: "bounded-review-policy", evidenceStatus: "explicitly-unresolved", unknownGlobally: false });
  }
  for (const claim of artifact.formationClaims) {
    const claimId = `published-claim:${claim.sampleId.toLowerCase()}`;
    const sampleId = sampleNodeId(claim.sampleId);
    const measurementId = `measurement-series:${sampleId.slice(7)}`;
    edges.push({ id: edgeId("interprets-sample", claimId, sampleId), source: claimId, target: sampleId, relation: "interprets-sample", relationLayer: "published-interpretation", evidenceClass: "article-exact-locator", evidenceStatus: "qualified", qualifier: claim.qualifier, causalAuthority: "Gregory et al. 2019" });
    edges.push({ id: edgeId("cites-measurement-series", claimId, measurementId), source: claimId, target: measurementId, relation: "cites-measurement-series", relationLayer: "published-interpretation", evidenceClass: "article-plus-source-data", evidenceStatus: "attributed", autoClassification: false });
  }
  for (const regime of artifact.identityRegimes) edges.push({ id: edgeId("projects-cohort", `identity-regime:${regime.id}`, sourceNode.id), source: `identity-regime:${regime.id}`, target: sourceNode.id, relation: "projects-cohort", relationLayer: "onto2d-analysis", evidenceClass: "declared-equivalence-key", evidenceStatus: "derived", sourceGraphMutable: false });
  edges.push({ id: edgeId("bounded-by", "identity-regime:published-formation-profile", loadNode.id), source: "identity-regime:published-formation-profile", target: loadNode.id, relation: "bounded-by", relationLayer: "evidence-boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
    if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`);
    edgeIds.add(edge.id);
  }
  if (edges.some((edge) => edge.autoClassification === true || edge.causalFormationClaim === true) || edges.filter(({ relation }) => relation === "interprets-sample").length !== 3) fail("compiled interpretation semantics differ");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: MINERAL_FORMATION_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: MINERAL_FORMATION_MAPPING_VERSION, releaseIdentity, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity,
    sourceInventory: { species: 1, samples: 10, analysisRows: 95, measurementSeries: 10 },
    interpretationInventory: { publishedClaims: 3, unresolvedSamples: 7, identityRegimes: 3 },
    automaticFormationClassifications: 0, localityToFormationInferences: 0, ageToFormationInferences: 0, onto2dGeneratedCausalEdges: 0,
    historicalLoad: { status: artifact.historicalLoad.status, value: null }
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/mineral-formation-history/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "mineral-formation-history", name: "Mineral Formation History", version, description: "A source-locked pyrite cohort separating conventional species, native samples, direct measurements, qualified formation interpretations, and unresolved mappings.", status: "external-source-locked-mineral-history-case" },
    source: { id: `gregory-pyrite-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes, edges,
    dictionaries: canonicalClone({
      provenance: { datasetDoi: artifact.source.dataset.doi, articleDoi: artifact.source.article.doi, conceptualAuthorityDoi: artifact.source.conceptualAuthority.doi, retrievedAt: artifact.source.retrievedAt, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: MINERAL_FORMATION_MAPPING_VERSION },
      evidenceClasses: {
        "dataset-table-1": "Native sample identity, age, locality, stratigraphy, and description from the pinned workbook.",
        "appendix-3-la-icp-ms": "Exact source analysis rows grouped by native sample; descriptive measurements only.",
        "article-exact-locator": "Qualified sample-specific formation interpretation attributed to an exact location in Gregory et al. 2019.",
        "article-plus-source-data": "Published interpretation linked to its retained measurement series without automatic reclassification.",
        "bounded-species-label": "Conventional pyrite / FeS2 comparison key for this source cohort.",
        "bounded-review-policy": "No reviewed case-local mapping; unknown only within this release.",
        "declared-equivalence-key": "Onto2D projection under an explicit identity regime.",
        "analysis-scope": "Boundary preserving an undefined Historical Load result."
      },
      identityRegimes: Object.fromEntries(artifact.identityRegimes.map((regime) => [regime.id, regime.meaning])),
      presentation: {
        profile: "mineral-formation-presentation-v1", nodeKindField: "entityKind", relationField: "relation", layerField: "phase", evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Mineral formation evidence", searchPlaceholder: "Search species, samples, measurements, claims, and boundaries", typeFilter: "Evidence object", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming mineral-history relations", children: "Outgoing mineral-history relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Species / sample / formation boundary", summary: "Conventional species equality, physical sample identity, direct measurement, and published formation interpretation remain separate layers.", note: "Age, locality, and chemistry never auto-generate formation claims. Seven mappings and Historical Load remain explicitly unresolved." }
      },
      audit
    })
  });
}
