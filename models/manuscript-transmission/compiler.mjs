import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyManuscriptStemmaticsCaseIdentity } from "../../cases/manuscript-stemmatics/extract.mjs";

export const MANUSCRIPT_TRANSMISSION_MAPPING_VERSION = "manuscript-transmission-mapping-v1";
const RELEASE_DOMAIN = "onto2d:manuscript-transmission-model-release:v1";
const AUDIT_DOMAIN = "onto2d:manuscript-transmission-model-audit:v1";
const EDGE_DOMAIN = "onto2d:manuscript-transmission-model-edge:v1";
const EXPECTED_MATRIX = [[false, true, true, false], [false, true, true, true], [false, false, true, false]];

function fail(message) {
  throw new TypeError(`manuscript-transmission Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`;
}

export function compileManuscriptTransmissionModelPack(input) {
  let artifact;
  try {
    artifact = verifyManuscriptStemmaticsCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }
  if (artifact.witnesses.length !== 7 || artifact.readingSites.length !== 2 || artifact.transmission.relations.length !== 4) fail("case inventory differs");
  if (artifact.transmission.relations.filter((relation) => relation.contamination).length !== 1) fail("the single contamination relation differs");
  if (artifact.transmission.relations.some((relation) => relation.directObservation)) fail("an attributed relation was promoted to observation");
  if (artifact.transmission.relations.find((relation) => relation.contamination)?.treeCompatible !== false) fail("contamination was promoted to a tree-compatible edge");
  const matrix = artifact.historyEquivalence.comparisons.map((comparison) => comparison.results.map((result) => result.equal));
  if (JSON.stringify(matrix) !== JSON.stringify(EXPECTED_MATRIX)) fail("history-equivalence matrix differs");

  const witnessNodes = artifact.witnesses.map((witness) => ({
    id: `witness:${witness.id}`,
    name: `${witness.id} - ${witness.label}`,
    description: `${witness.label}, retained as a source-projected witness with its published group and bounded transmission role.`,
    shortDescription: `${witness.kind}; group ${witness.analysisGroup}; ${witness.transmissionRole}.`,
    entityKind: "witness",
    typeRole: witness.kind,
    phase: "recorded-collation",
    scientificStatus: witness.evidenceState,
    witnessId: witness.id,
    analysisGroup: witness.analysisGroup,
    bGroupVariantCount: witness.bGroupVariantCount,
    correctionProfileAgreementCount: witness.cx2CorrectionProfileAgreementCount,
    coverageStatus: witness.coverageStatus,
    readingSignature: witness.readingSignature,
    transmissionRole: witness.transmissionRole,
    witnessIdentity: witness.identity
  }));
  const unresolvedNodes = artifact.transmission.unresolvedExemplars.map((exemplar) => ({
    id: `unresolved:${exemplar.id}`,
    name: exemplar.label,
    description: "An unresolved source reference from the published analysis. Onto2D does not invent an extant witness, shelfmark, or exact identity for it.",
    shortDescription: "Source asserted; physical exemplar unresolved.",
    entityKind: "unresolved-exemplar",
    typeRole: "correction-source",
    phase: "attributed-contamination",
    scientificStatus: "identity-unresolved",
    extantWitness: exemplar.extantWitness,
    exactIdentity: exemplar.exactIdentity,
    inventedByOnto2D: exemplar.inventedByOnto2D,
    sourceClaimId: exemplar.sourceClaimId
  }));
  const siteNodes = artifact.readingSites.map((site) => ({
    id: `site:${site.id}`,
    name: `${site.locator} - ${site.nexusLabel}`,
    description: `${site.selectionBasis} This selected example creates no ancestry relation.`,
    shortDescription: `NEXUS character ${site.nexusCharacterIndex}; ${site.readings.length} readings.`,
    entityKind: "reading-site",
    typeRole: "selected-collation-site",
    phase: "recorded-collation",
    scientificStatus: site.evidenceState,
    siteId: site.id,
    locator: site.locator,
    nexusCharacterIndex: site.nexusCharacterIndex,
    nexusLabel: site.nexusLabel,
    sourceLocator: site.sourceLocator,
    createsAncestry: false,
    selectionBiased: true
  }));
  const readingNodes = artifact.readingSites.flatMap((site) => site.readings.map((reading) => ({
    id: `reading:${site.id}:${reading.value}`,
    name: `${site.locator}: ${reading.value}`,
    description: `One exact reading in the bounded source-discussed slice, shared by ${reading.witnessIds.join(", ")}.`,
    shortDescription: `${reading.witnessIds.length} selected witnesses.`,
    entityKind: "reading",
    typeRole: "collation-reading",
    phase: "recorded-collation",
    scientificStatus: "source-projected",
    siteId: site.id,
    value: reading.value,
    witnessIds: reading.witnessIds,
    createsAncestry: false
  })));
  const claimNodes = artifact.scholarlyClaims.map((claim) => ({
    id: `claim:${claim.id}`,
    name: claim.kind.replaceAll("-", " "),
    description: claim.summary,
    shortDescription: `${claim.locators.join(", ")}; attributed, not observed.`,
    entityKind: "scholarly-claim",
    typeRole: claim.kind,
    phase: "published-analysis",
    scientificStatus: "attributed-claim",
    claimId: claim.id,
    locators: claim.locators,
    directObservation: false
  }));
  const profileNode = {
    id: `profile:${artifact.quantitativeProfiles.correctionProfile.id}`,
    name: "Cx2 correction profile",
    description: artifact.quantitativeProfiles.correctionProfile.interpretation,
    shortDescription: `${artifact.quantitativeProfiles.correctionProfile.count} published differences; not a copying observation.`,
    entityKind: "quantitative-profile",
    typeRole: "correction-profile",
    phase: "published-analysis",
    scientificStatus: "attributed-quantitative-analysis",
    count: artifact.quantitativeProfiles.correctionProfile.count,
    definition: artifact.quantitativeProfiles.correctionProfile.definition,
    sourceLocator: artifact.quantitativeProfiles.correctionProfile.sourceLocator,
    directObservation: false
  };
  const transmissionNodes = artifact.transmission.relations.map((relation) => ({
    id: `transmission:${relation.id}`,
    name: relation.relation.replaceAll("-", " "),
    description: relation.contamination
      ? "A published correction-source relation into Cx2, deliberately retained outside the tree-compatible transmission layer."
      : "A transmission relation attributed to the published analysis; it is not a directly observed copying event.",
    shortDescription: `${relation.source} -> ${relation.target}; ${relation.origin}.`,
    entityKind: "transmission-claim",
    typeRole: relation.relation,
    phase: relation.relationLayer,
    scientificStatus: "attributed-claim",
    transmissionId: relation.id,
    sourceWitnessId: relation.source,
    targetWitnessId: relation.target,
    evidenceIds: relation.evidenceIds,
    directObservation: false,
    treeCompatible: relation.treeCompatible,
    contamination: relation.contamination,
    physicalExemplarIdentityResolved: false
  }));
  const agreementNodes = artifact.agreementComparisons.map((comparison) => ({
    ...comparison,
    id: `agreement:${comparison.id}`,
    name: `${comparison.left} / ${comparison.right} selected-site agreement`,
    description: "Exact equality over two deliberately selected, source-discussed sites. This display-only result cannot create transmission or ancestry.",
    shortDescription: `${comparison.agreementCount}/${comparison.comparedSiteCount}; selection-biased.`,
    entityKind: "agreement-comparison",
    typeRole: "selected-reading-agreement",
    phase: "derived-agreement",
    scientificStatus: "selection-biased-derived-result"
  }));
  const regimeNodes = artifact.historyEquivalence.regimes.map((regime) => ({
    id: `regime:${regime.id}`,
    name: regime.label,
    description: regime.question,
    shortDescription: `${regime.fields.length} exact field(s).`,
    entityKind: "equivalence-regime",
    typeRole: "equivalence-regime",
    phase: "derived-analysis",
    scientificStatus: "declared-profile",
    regimeId: regime.id,
    comparedFields: regime.fields
  }));
  const comparisonNodes = artifact.historyEquivalence.comparisons.map((comparison) => ({
    id: `comparison:${comparison.id}`,
    name: comparison.label,
    description: "Two distinct witness histories compared under four independent identity regimes.",
    shortDescription: `${comparison.results.filter((result) => result.equal).length}/4 regimes equal.`,
    entityKind: "witness-comparison",
    typeRole: "history-comparison",
    phase: "derived-analysis",
    scientificStatus: "deterministically-derived",
    comparisonId: comparison.id,
    left: comparison.left,
    right: comparison.right,
    historiesDistinct: true
  }));
  const verdictNodes = artifact.historyEquivalence.comparisons.flatMap((comparison) => comparison.results.map((result) => ({
    id: `verdict:${comparison.id}:${result.regimeId}`,
    name: `${comparison.label} / ${result.label}`,
    description: result.equal ? "The exact witness projections are equal under this regime." : `The exact witness projections differ in ${result.differingFields.join(", ")}.`,
    shortDescription: result.equal ? "EQUIVALENT in this regime." : "DISTINCT in this regime.",
    entityKind: "equivalence-verdict",
    typeRole: "regime-verdict",
    phase: "derived-analysis",
    scientificStatus: "deterministically-derived",
    comparisonId: comparison.id,
    regimeId: result.regimeId,
    equal: result.equal,
    differingFields: result.differingFields
  })));
  const ablationNodes = artifact.evidenceAblation.map((ablation) => ({
    ...ablation,
    id: `ablation:${ablation.id}`,
    name: ablation.label,
    description: `Withholds ${ablation.removedEvidenceIds.length} exact evidence item(s); ${ablation.supportedRelationIds.length} relations remain supported.`,
    shortDescription: `${ablation.resultState}; multiple input ${ablation.localMultipleParentSupported ? "supported" : "not supported"}.`,
    entityKind: "evidence-ablation",
    typeRole: "ablation-result",
    phase: "derived-analysis",
    scientificStatus: "deterministically-derived"
  }));
  const selectionBoundary = {
    id: "boundary:selection",
    name: "Two sites are a bounded display slice",
    description: artifact.evidenceBoundary.nonClaims[0],
    shortDescription: `2 of ${artifact.corpus.variantCharacterCount} characters; not representative.`,
    entityKind: "analysis-boundary",
    typeRole: "selection-boundary",
    phase: "evidence-boundary",
    scientificStatus: "explicit-non-claim",
    selectedSiteCount: artifact.selection.readingSiteCount,
    fullCharacterCount: artifact.corpus.variantCharacterCount,
    representativeSampleClaim: false
  };
  const loadBoundary = {
    id: "boundary:historical-load-not-evaluated",
    name: "Historical Load is undefined",
    description: artifact.historicalLoad.reason,
    shortDescription: "No route space, admissibility rule, or cost functional.",
    entityKind: "analysis-boundary",
    typeRole: "historical-load-boundary",
    phase: "evidence-boundary",
    scientificStatus: "explicitly-not-evaluated",
    value: null
  };
  const nodes = [...witnessNodes, ...unresolvedNodes, ...siteNodes, ...readingNodes, ...claimNodes, profileNode, ...transmissionNodes, ...agreementNodes, ...regimeNodes, ...comparisonNodes, ...verdictNodes, ...ablationNodes, selectionBoundary, loadBoundary];
  const edges = [];
  const witnessById = new Map(artifact.witnesses.map((witness) => [witness.id, witness]));
  for (const witness of artifact.witnesses) {
    for (const reading of witness.readings) {
      edges.push({ id: edgeId("records-reading", `witness:${witness.id}`, `reading:${reading.siteId}:${reading.value}`), source: `witness:${witness.id}`, target: `reading:${reading.siteId}:${reading.value}`, relation: "records-reading", relationLayer: "recorded-collation", evidenceClass: "selected-collation-reading", evidenceStatus: "source-projected", genealogical: false });
    }
  }
  for (const site of artifact.readingSites) {
    for (const reading of site.readings) edges.push({ id: edgeId("reading-at-site", `reading:${site.id}:${reading.value}`, `site:${site.id}`), source: `reading:${site.id}:${reading.value}`, target: `site:${site.id}`, relation: "reading-at-site", relationLayer: "recorded-collation", evidenceClass: "selected-collation-reading", evidenceStatus: "source-projected", genealogical: false });
  }
  for (const relation of artifact.transmission.relations) {
    const source = witnessById.has(relation.source) ? `witness:${relation.source}` : `unresolved:${relation.source}`;
    const target = `witness:${relation.target}`;
    edges.push({ id: edgeId(relation.relation, source, target, relation.id), source, target, relation: relation.relation, relationLayer: relation.relationLayer, evidenceClass: "published-transmission-analysis", evidenceStatus: "attributed-claim", claimNodeId: `transmission:${relation.id}`, evidenceIds: relation.evidenceIds, directObservation: false, treeCompatible: relation.treeCompatible, contamination: relation.contamination, physicalExemplarIdentityResolved: false, genealogical: false });
    for (const evidenceId of relation.evidenceIds) edges.push({ id: edgeId("supports-transmission", `claim:${evidenceId}`, `transmission:${relation.id}`), source: `claim:${evidenceId}`, target: `transmission:${relation.id}`, relation: "supports-transmission", relationLayer: "published-analysis", evidenceClass: "scholarly-claim", evidenceStatus: "attributed", genealogical: false });
    edges.push({ id: edgeId("describes-relation", `transmission:${relation.id}`, target), source: `transmission:${relation.id}`, target, relation: "describes-relation", relationLayer: relation.relationLayer, evidenceClass: "published-transmission-analysis", evidenceStatus: "attributed", genealogical: false });
  }
  edges.push({ id: edgeId("quantifies", profileNode.id, "transmission:correction-source:better-copy:Cx2"), source: profileNode.id, target: "transmission:correction-source:better-copy:Cx2", relation: "quantifies", relationLayer: "published-analysis", evidenceClass: "published-correction-profile", evidenceStatus: "attributed", genealogical: false });
  for (const agreement of artifact.agreementComparisons) {
    const id = `agreement:${agreement.id}`;
    edges.push({ id: edgeId("compares-left", id, `witness:${agreement.left}`), source: id, target: `witness:${agreement.left}`, relation: "compares-left", relationLayer: "derived-agreement", evidenceClass: "selected-site-equality", evidenceStatus: "selection-biased", genealogical: false });
    edges.push({ id: edgeId("compares-right", id, `witness:${agreement.right}`), source: id, target: `witness:${agreement.right}`, relation: "compares-right", relationLayer: "derived-agreement", evidenceClass: "selected-site-equality", evidenceStatus: "selection-biased", genealogical: false });
    edges.push({ id: edgeId("bounded-by", id, selectionBoundary.id), source: id, target: selectionBoundary.id, relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", genealogical: false });
  }
  for (const comparison of artifact.historyEquivalence.comparisons) {
    const id = `comparison:${comparison.id}`;
    edges.push({ id: edgeId("compares-left", id, `witness:${comparison.left}`), source: id, target: `witness:${comparison.left}`, relation: "compares-left", relationLayer: "analysis", evidenceClass: "declared-pair", evidenceStatus: "derived", genealogical: false });
    edges.push({ id: edgeId("compares-right", id, `witness:${comparison.right}`), source: id, target: `witness:${comparison.right}`, relation: "compares-right", relationLayer: "analysis", evidenceClass: "declared-pair", evidenceStatus: "derived", genealogical: false });
    for (const result of comparison.results) {
      const verdict = `verdict:${comparison.id}:${result.regimeId}`;
      edges.push({ id: edgeId("has-verdict", id, verdict), source: id, target: verdict, relation: "has-verdict", relationLayer: "analysis", evidenceClass: "exact-projection-comparison", evidenceStatus: "derived", equal: result.equal, genealogical: false });
      edges.push({ id: edgeId("evaluated-under", verdict, `regime:${result.regimeId}`), source: verdict, target: `regime:${result.regimeId}`, relation: "evaluated-under", relationLayer: "analysis", evidenceClass: "declared-equivalence-regime", evidenceStatus: "derived", genealogical: false });
    }
    edges.push({ id: edgeId("bounded-by", id, loadBoundary.id), source: id, target: loadBoundary.id, relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", genealogical: false });
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
    if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`);
    edgeIds.add(edge.id);
  }
  const directTransmissionEdges = edges.filter((edge) => edge.evidenceClass === "published-transmission-analysis" && edge.relation !== "describes-relation");
  if (directTransmissionEdges.length !== 4 || directTransmissionEdges.filter((edge) => edge.contamination).length !== 1) fail("compiled transmission boundary differs");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: MANUSCRIPT_TRANSMISSION_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: MANUSCRIPT_TRANSMISSION_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { witnesses: witnessNodes.length, unresolvedExemplars: unresolvedNodes.length, readingSites: siteNodes.length, readings: readingNodes.length, scholarlyClaims: claimNodes.length, attributedRelations: artifact.transmission.relations.length, contaminationRelations: 1, agreements: agreementNodes.length, comparisons: comparisonNodes.length, verdicts: verdictNodes.length, ablations: ablationNodes.length },
    observedTransmissionEdges: 0,
    ancestryFromAgreement: 0,
    inventedWitnesses: 0,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/manuscript-stemmatics/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "manuscript-transmission", name: "Manuscript Transmission", version, description: "Source-locked Miller's Tale witnesses, selected readings, attributed copying, and contamination preserved as distinct evidence layers.", status: "external-source-locked-manuscript-stemmatics-case" },
    source: { id: `manuscript-stemmatics-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { citation: artifact.source.citation, license: artifact.source.license, upstreamFiles: artifact.source.upstreamFiles, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: MANUSCRIPT_TRANSMISSION_MAPPING_VERSION },
      evidenceClasses: { "selected-collation-reading": "A bounded projection of an exact NEXUS reading; it creates no ancestry.", "published-transmission-analysis": "A copying or correction-source relation attributed to the published analysis, never direct observation.", "scholarly-claim": "A page-located statement in Robinson's published analysis.", "published-correction-profile": "The published 207-reading profile supporting correction from a second exemplar.", "selected-site-equality": "Exact equality over two deliberately selected examples; non-representative and non-ancestral.", "exact-projection-comparison": "Exact equality under one declared witness-identity regime.", "analysis-scope": "A boundary preventing selected evidence or undefined Historical Load from being overread." },
      identityRegimes: Object.fromEntries(artifact.historyEquivalence.regimes.map((regime) => [regime.id, regime.question])),
      presentation: { profile: "manuscript-transmission-presentation-v1", nodeKindField: "entityKind", relationField: "relation", layerField: "phase", evidenceClassField: "evidenceClass", labels: { catalogTitle: "Manuscript transmission evidence", searchPlaceholder: "Search witnesses, readings, claims, transmission, and regimes", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming textual or evidence relations", children: "Outgoing textual or evidence relations" }, coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }], boundary: { title: "Reading / transmission boundary", summary: "Recorded readings, derived agreement, attributed copying, and attributed contamination remain separate layers.", note: "Shared readings create neither ancestry nor copying. The better copy remains unresolved. Historical Load is undefined because no route space, admissibility rule, cost functional, or baseline route is supplied." } },
      audit
    })
  });
}
