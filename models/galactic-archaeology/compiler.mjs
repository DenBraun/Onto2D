import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyGalacticArchaeologyCaseIdentity } from "../../cases/galactic-archaeology/extract.mjs";

export const GALACTIC_ARCHAEOLOGY_MAPPING_VERSION = "galactic-archaeology-mapping-v1";
const RELEASE_DOMAIN = "onto2d:galactic-archaeology-model-release:v1";
const AUDIT_DOMAIN = "onto2d:galactic-archaeology-model-audit:v1";
const EDGE_DOMAIN = "onto2d:galactic-archaeology-model-edge:v1";

function fail(message) { throw new TypeError(`galactic-archaeology Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }

export function compileGalacticArchaeologyModelPack(input) {
  let artifact;
  try { artifact = verifyGalacticArchaeologyCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.records.length !== 64 || artifact.audit.recordsWithAllFourParameterIntervals !== 64 || artifact.audit.recordsWithAllNineOrbitIntervals !== 64) fail("case inventory differs");
  if (artifact.audit.directObservationOrbitPromotions || artifact.audit.nativeGaiaPopulationLabelsInvented || artifact.audit.birthOriginClaims || artifact.audit.commonAncestryClaims || artifact.audit.liveQueriesDuringBuild) fail("epistemic boundary differs");

  const sourceNode = {
    id: "source:gaia-dr3-bounded-cohort",
    name: "Frozen Gaia DR3 cohort",
    description: "64 deterministically selected Gaia DR3 chemical-cartography sources, balanced across four Onto2D rule profiles and two published quality strata.",
    shortDescription: "64 sources / 33 exact ADQL queries / offline canonical build.",
    entityKind: "source-cohort",
    typeRole: "source-locked-catalogue-projection",
    phase: "source",
    evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    completePopulationClaim: false
  };
  const layerNodes = artifact.methodology.evidenceLayers.map((layer, index) => ({
    id: `evidence-layer:${layer.id}`,
    name: layer.id.replaceAll("-", " "),
    description: layer.role,
    shortDescription: layer.authority,
    entityKind: "evidence-layer",
    typeRole: layer.id,
    phase: `layer-${index + 1}`,
    evidenceStatus: index < 3 ? "source-declared" : index === 3 ? "onto2d-rule" : "published-context",
    authority: layer.authority,
    layerOrder: index + 1
  }));
  const starNodes = artifact.records.map((record) => ({
    id: `star:${record.sourceId}`,
    name: `Gaia DR3 ${record.sourceId}`,
    description: `${record.ruleProfileId.replaceAll("-", " ")} / ${record.qualityProfile}. Observations, Gaia estimates, and published orbital estimates remain separate properties with their reported uncertainty.`,
    shortDescription: `[M/H] ${record.gaiaEstimate.metallicity.point.toFixed(2)} / vphi ${record.publishedOrbit.azimuthalVelocity.point.toFixed(1)} km/s / ecc ${record.publishedOrbit.eccentricity.point.toFixed(2)}.`,
    entityKind: "stellar-source",
    typeRole: record.ruleProfileId,
    phase: "bounded-cohort",
    evidenceStatus: "layered-source-record",
    sourceId: record.sourceId,
    qualityProfile: record.qualityProfile,
    ruleProfileId: record.ruleProfileId,
    metallicity: canonicalClone(record.gaiaEstimate.metallicity),
    alphaToIron: canonicalClone(record.gaiaEstimate.alphaToIron),
    azimuthalVelocity: canonicalClone(record.publishedOrbit.azimuthalVelocity),
    eccentricity: canonicalClone(record.publishedOrbit.eccentricity),
    maximumHeight: canonicalClone(record.publishedOrbit.maximumHeight),
    radialVelocity: canonicalClone(record.observation.radialVelocity),
    nativeGaiaPopulationLabel: false,
    birthOriginClaim: false,
    commonAncestryClaim: false
  }));
  const profileNodes = artifact.cohort.ruleProfiles.map((profile) => ({
    id: `rule-profile:${profile.id}`,
    name: profile.label,
    description: profile.rule,
    shortDescription: "Onto2D deterministic selection; not a native Gaia population label.",
    entityKind: "rule-profile",
    typeRole: profile.id,
    phase: "layer-4",
    evidenceStatus: "onto2d-rule",
    nativeGaiaPopulationLabel: false,
    birthOriginClaim: false
  }));
  const interpretationNodes = artifact.historicalInterpretations.map((item) => ({
    id: `interpretation:${item.ruleProfileId}`,
    name: `${item.ruleProfileId.replaceAll("-", " ")} context`,
    description: item.statements.join("; "),
    shortDescription: "Compatible pattern only; alternative histories remain possible.",
    entityKind: "historical-interpretation",
    typeRole: "candidate-compatibility",
    phase: "layer-5",
    evidenceStatus: "published-context-bounded",
    statements: item.statements,
    status: item.status,
    recoveredBirthOrigin: false,
    commonAncestryClaim: false,
    singleFormationHistoryClaim: false
  }));
  const qualityNodes = [artifact.qualityAblation.baseline, artifact.qualityAblation.strict].map((regime) => ({
    id: `quality:${regime.id}`,
    name: `${regime.id === "medium" ? "Medium" : "High"} quality view`,
    description: `${regime.sourceCount} frozen sources satisfy this quality regime; the source projection itself is not mutated.`,
    shortDescription: `${regime.sourceCount} sources / four rule profiles represented.`,
    entityKind: "quality-regime",
    typeRole: regime.id,
    phase: "quality-ablation",
    evidenceStatus: "published-rule-replayed",
    sourceCount: regime.sourceCount,
    sourceMutation: false
  }));
  const boundaryNodes = [
    { id: "boundary:not-origin", name: "Profile is not birth origin", description: "Rule membership and present-day chemo-kinematic compatibility do not recover a stellar birth site or unique formation route.", typeRole: "origin-boundary" },
    { id: "boundary:not-ancestry", name: "Chemistry is not ancestry", description: "Chemical similarity does not create a common-ancestry relation between stellar sources.", typeRole: "ancestry-boundary" },
    { id: "boundary:historical-load", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, typeRole: "historical-load-boundary", value: null }
  ].map((node) => ({ ...node, shortDescription: "Explicit non-claim.", entityKind: "analysis-boundary", phase: "evidence-boundary", evidenceStatus: "explicit-non-claim" }));

  const nodes = [sourceNode, ...layerNodes, ...starNodes, ...profileNodes, ...interpretationNodes, ...qualityNodes, ...boundaryNodes];
  const edges = [];
  const add = (relation, source, target, fields = {}) => edges.push({ id: edgeId(relation, source, target, fields.key ?? ""), source, target, relation, genealogical: false, ...fields });
  for (const record of artifact.records) {
    const star = `star:${record.sourceId}`;
    add("contains-source", sourceNode.id, star, { relationLayer: "source", evidenceClass: "bounded-selection", evidenceStatus: "source-locked", completePopulationClaim: false, key: record.sourceId });
    add("describes", "evidence-layer:observed", star, { relationLayer: "observed", evidenceClass: "gaia-catalogue-observation", evidenceStatus: "source-declared", key: record.sourceId });
    add("estimates-parameters-for", "evidence-layer:gaia-derived", star, { relationLayer: "gaia-derived", evidenceClass: "gaia-apsis-estimate", evidenceStatus: "source-declared", uncertaintyRetained: true, key: record.sourceId });
    add("estimates-orbit-for", "evidence-layer:published-derived", star, { relationLayer: "published-derived", evidenceClass: "published-companion-derived", evidenceStatus: "source-declared", uncertaintyRetained: true, directObservation: false, key: record.sourceId });
    add("classified-under", star, `rule-profile:${record.ruleProfileId}`, { relationLayer: "onto2d-classified", evidenceClass: "deterministic-rule-membership", evidenceStatus: "onto2d-rule", nativeGaiaLabel: false });
    add("included-in-quality-view", star, "quality:medium", { relationLayer: "quality-ablation", evidenceClass: "appendix-b-quality-rule", evidenceStatus: "published-rule-replayed", key: record.sourceId });
    if (record.qualityProfile === "high") add("included-in-quality-view", star, "quality:high", { relationLayer: "quality-ablation", evidenceClass: "appendix-b-quality-rule", evidenceStatus: "published-rule-replayed", key: record.sourceId });
  }
  for (const profile of artifact.cohort.ruleProfiles) {
    add("implemented-by", `rule-profile:${profile.id}`, "evidence-layer:onto2d-classified", { relationLayer: "onto2d-classified", evidenceClass: "declared-rule", evidenceStatus: "onto2d-rule" });
    add("compatible-with", `rule-profile:${profile.id}`, `interpretation:${profile.id}`, { relationLayer: "publication-context", evidenceClass: "bounded-compatibility", evidenceStatus: "published-context-bounded", causal: false, uniqueOrigin: false });
    add("contextualized-by", `interpretation:${profile.id}`, "evidence-layer:publication-context", { relationLayer: "publication-context", evidenceClass: "published-context", evidenceStatus: "published-context-bounded" });
    add("bounded-by", `interpretation:${profile.id}`, "boundary:not-origin", { relationLayer: "boundary", evidenceClass: "explicit-non-claim", evidenceStatus: "declared" });
    add("bounded-by", `interpretation:${profile.id}`, "boundary:not-ancestry", { relationLayer: "boundary", evidenceClass: "explicit-non-claim", evidenceStatus: "declared" });
  }
  add("bounded-by", sourceNode.id, "boundary:historical-load", { relationLayer: "boundary", evidenceClass: "explicitly-not-evaluated", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs repeat");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edgeIds.has(edge.id)) fail(`edge ${edge.id} is repeated or unresolved`);
    edgeIds.add(edge.id);
  }
  if (edges.some((edge) => ["born-in", "descends-from", "shares-ancestry-with", "causes"].includes(edge.relation) || edge.uniqueOrigin === true || edge.causal === true)) fail("compiled edge exceeds the historical interpretation boundary");
  if (nodes.some((node) => node.birthOriginClaim === true || node.commonAncestryClaim === true || node.singleFormationHistoryClaim === true || node.nativeGaiaPopulationLabel === true)) fail("compiled node exceeds the historical interpretation boundary");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: GALACTIC_ARCHAEOLOGY_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: GALACTIC_ARCHAEOLOGY_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { stellarSources: starNodes.length, evidenceLayers: layerNodes.length, ruleProfiles: profileNodes.length, candidateInterpretations: interpretationNodes.length, qualityRegimes: qualityNodes.length },
    parameterIntervalsRetained: 64 * 4,
    orbitIntervalsRetained: 64 * 9,
    directObservationOrbitPromotions: 0,
    nativeGaiaPopulationLabelsInvented: 0,
    birthOriginClaims: 0,
    commonAncestryClaims: 0,
    causalEdges: 0,
    liveQueriesDuringBuild: 0,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  return buildModelPack({
    model: { id: "galactic-archaeology", name: "Galactic Archaeology", version, description: "A source-locked Gaia DR3 case preserving observation, derived parameter, published orbit, rule classification, and candidate historical interpretation as separate layers.", status: "external-source-locked-reconstruction-case" },
    source: { id: `galactic-archaeology-${artifact.source.identity.slice(7, 23)}`, files: [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/galactic-archaeology/${file.path}`, hash: file.identity })), auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { release: artifact.source.release, retrievedAt: artifact.source.retrievedAt, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: GALACTIC_ARCHAEOLOGY_MAPPING_VERSION, paperDoi: artifact.source.paper.doi, tableDois: artifact.source.tableLocks.map(({ doi }) => doi) },
      evidenceClasses: {
        "bounded-selection": "A deterministic 64-source projection from exact Gaia DR3 queries.",
        "gaia-catalogue-observation": "A Gaia source catalogue quantity with its reported measurement uncertainty.",
        "gaia-apsis-estimate": "A GSP-Spec parameter estimate with 16th/84th percentile bounds.",
        "published-companion-derived": "An orbit or action estimate in the chemical-cartography companion table.",
        "deterministic-rule-membership": "Onto2D application of an explicit chemo-kinematic rule, not a native Gaia label.",
        "bounded-compatibility": "A candidate historical compatibility statement that permits alternatives and makes no birth-origin claim.",
        "appendix-b-quality-rule": "A replay of the paper's Medium or High GSP-Spec quality criteria.",
        "explicit-non-claim": "A boundary preventing origin, ancestry, causality, or Historical Load promotion."
      },
      presentation: {
        profile: "galactic-archaeology-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "phase",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Galactic archaeology evidence", searchPlaceholder: "Search stars, evidence layers, rule profiles, interpretations, and boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming evidence relations", children: "Outgoing evidence relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Observation / derivation / history boundary", summary: "Present stellar traces support inspectable candidate historical interpretations only after explicit derived and classification layers.", note: "Orbital quantities are derived, rule profiles are not Gaia labels, and neither chemistry nor kinematics proves birth origin, ancestry, or one true Galactic formation history." }
      },
      audit
    })
  });
}
