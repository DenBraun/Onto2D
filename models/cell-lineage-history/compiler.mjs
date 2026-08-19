import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyCellLineageIdentityCaseIdentity } from "../../cases/cell-lineage-identity/extract.mjs";

export const CELL_LINEAGE_MAPPING_VERSION = "cell-lineage-zf1-mapping-v2";
const RELEASE_DOMAIN = "onto2d:cell-lineage-model-release:v1";
const AUDIT_DOMAIN = "onto2d:cell-lineage-model-audit:v1";
const EDGE_DOMAIN = "onto2d:cell-lineage-model-edge:v1";

function fail(message) { throw new TypeError(`cell-lineage-history Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target) { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target }).slice(7, 27)}`; }
function cellNodeId(cellId) { return `cell:${cellId.toLowerCase()}`; }
function barcodeNodeId(identity) { return `barcode:${identity.slice(7, 23)}`; }
function signatureNodeId(identity) { return `first-four-target-signature:${identity.slice(7, 23)}`; }

export function compileCellLineageHistoryModelPack(input) {
  let artifact;
  try { artifact = verifyCellLineageIdentityCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.cells.length !== 750 || artifact.clusters.length !== 56 || artifact.observedBarcodeGroups.length !== 192 || artifact.firstFourTargetSignatureGroups.length !== 133) fail("case inventory differs");
  if (artifact.audit.caseGeneratedParentCellCount || artifact.audit.caseGeneratedDivisionCount || artifact.audit.caseGeneratedConfidenceCount || artifact.historicalLoad.value !== null) fail("cell-lineage evidence boundary differs");

  const sourceNode = {
    id: "source:gse105010-zf1", name: "GSE105010 / ZF1 scGESTALT cohort",
    description: "All 750 matched cell observations in the exact GSM2813984 GestMaster source member. The cohort is complete for that table, not for the animal's cells or developmental lineage.",
    shortDescription: "750 source rows / 0 dropped / bounded cell-barcode cohort.",
    entityKind: "source-cohort", typeRole: "source-locked-cohort", phase: "sample-identity", evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, completeCellRecovery: false
  };
  const specimenNode = {
    id: "specimen:zf1", name: "ZF1 juvenile zebrafish brain",
    description: "The source-identified brain specimen whose matched transcriptomic cluster and scGESTALT barcode observations form this case.",
    shortDescription: "GSM2813984 / Danio rerio / incomplete cell recovery.",
    entityKind: "specimen", typeRole: "source-specimen", phase: "sample-identity", evidenceStatus: "source-recorded",
    specimenId: artifact.specimen.id, sourceSample: artifact.specimen.sourceSample, matchedCellCount: 750
  };
  const methodNode = {
    id: "method:bounded-first-four-target-projection", name: "Bounded targets 1-4 projection",
    description: artifact.reconstructionBoundary.reason,
    shortDescription: "Exact targets 1-4 grouping; no inferred divisions or confidence.",
    entityKind: "analysis-method", typeRole: "bounded-reconstruction", phase: "bounded-reconstruction", evidenceStatus: "deterministically-derived",
    publishedTreeImported: false, maximumParsimonyRecomputed: false, representsObservedDivision: false
  };
  const clusterNodes = artifact.clusters.map((cluster) => ({
    id: `cluster:${cluster.clusterId}`, name: cluster.label,
    description: cluster.articleLocator ? `${cluster.label}; ${cluster.articleLocator}.` : `Numeric source membership ClusterIdent ${cluster.clusterId}; no biological label is asserted by this release.`,
    shortDescription: `Cluster ${cluster.clusterId} / ${cluster.cellCount} matched cell${cluster.cellCount === 1 ? "" : "s"} / ${cluster.labelStatus}.`,
    entityKind: "transcriptomic-cluster", typeRole: cluster.labelStatus === "numeric-source-membership-only" ? "numeric-cluster" : "paper-labelled-cluster",
    phase: "published-interpretation", evidenceStatus: cluster.labelStatus,
    clusterIdentity: cluster.identity, clusterId: cluster.clusterId, cellCount: cluster.cellCount, articleLocator: cluster.articleLocator
  }));
  const barcodeNodes = artifact.observedBarcodeGroups.map((group) => ({
    id: barcodeNodeId(group.identity), name: `Observed barcode ${group.key.slice(7, 19)}`,
    description: `Exact ten-target HMID reported for ${group.cellCount} matched cell(s), spanning ${group.clusterIds.length} numeric transcriptomic cluster(s). Equality is an observation key, not proof of a unique immediate ancestor.`,
    shortDescription: `${group.cellCount} cells / ${group.clusterIds.length} clusters / exact HMID.`,
    entityKind: "observed-barcode-state", typeRole: "exact-hmid", phase: "direct-measurement", evidenceStatus: "source-recorded",
    barcodeIdentity: group.identity, observedBarcodeKey: group.key, observedBarcode: group.observedBarcode, cellCount: group.cellCount, clusterIds: group.clusterIds
  }));
  const signatureNodes = artifact.firstFourTargetSignatureGroups.map((group) => ({
    id: signatureNodeId(group.identity), name: `Targets 1-4 signature ${group.key.slice(7, 19)}`,
    description: `Exact signature over HMID target positions 1-4 shared by ${group.cellCount} cell(s), ${group.observedBarcodeClassCount} complete HMID class(es), and ${group.clusterIds.length} cluster(s). Target position is not treated as edit chronology, and this bounded projection is not an observed parent cell.`,
    shortDescription: `${group.cellCount} cells / ${group.observedBarcodeClassCount} barcodes / ${group.clusterIds.length} clusters.`,
    entityKind: "first-four-target-signature", typeRole: "derived-grouping-key", phase: "bounded-reconstruction", evidenceStatus: "deterministically-derived",
    firstFourTargetSignatureIdentity: group.identity, firstFourTargetSignatureKey: group.key, firstFourTargetSignature: group.firstFourTargetSignature,
    cellCount: group.cellCount, observedBarcodeClassCount: group.observedBarcodeClassCount, clusterIds: group.clusterIds, representsObservedParent: false
  }));
  const cellNodes = artifact.cells.map((cell) => ({
    id: cellNodeId(cell.cellId), name: cell.cellId,
    description: `Native matched cell record from source row ${cell.sourceRow}, assigned to numeric cluster ${cell.clusterId} and linked to its exact reported HMID without duplicating either identity.`,
    shortDescription: `Source row ${cell.sourceRow} / cluster ${cell.clusterId} / ${cell.targetCoverage}.`,
    entityKind: "cell-observation", typeRole: cell.targetCoverage === "partial" ? "partial-barcode-observation" : "matched-cell-observation",
    phase: "direct-measurement", evidenceStatus: cell.targetCoverage === "partial" ? "partial-target-coverage" : "source-recorded",
    cellIdentity: cell.identity, nativeCellId: cell.cellId, sourceRow: cell.sourceRow, sourceCellNumber: cell.sourceCellNumber, sourceCellBarcode: cell.sourceCellBarcode,
    clusterId: cell.clusterId, targetCoverage: cell.targetCoverage
  }));
  const regimeNodes = artifact.identityRegimes.map((regime) => ({
    id: `identity-regime:${regime.id}`, name: regime.id === "first-four-target-signature" ? "Targets 1-4 Signature" : regime.id.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
    description: regime.meaning, shortDescription: `${regime.actualClassCount} classes from 750 matched cells.`,
    entityKind: "identity-regime", typeRole: regime.id, phase: "onto2d-analysis", evidenceStatus: "deterministically-derived",
    equivalenceKey: regime.equivalenceKey, classCount: regime.actualClassCount
  }));
  const lineageBoundaryNode = {
    id: "boundary:not-a-complete-pedigree", name: "No complete pedigree is claimed",
    description: "The case preserves observed cells, cluster assignments, barcode states, and a bounded signature projection; it creates no parent cell, division event, branch length, or confidence value.",
    shortDescription: "0 inferred parents / 0 divisions / 0 confidence values.",
    entityKind: "analysis-boundary", typeRole: "lineage-completeness-boundary", phase: "evidence-boundary", evidenceStatus: "explicitly-unresolved",
    inferredParentCount: 0, inferredDivisionCount: 0, inferredConfidenceCount: 0
  };
  const loadBoundaryNode = {
    id: "boundary:historical-load-not-evaluated", name: "Historical Load is undefined",
    description: artifact.historicalLoad.reason, shortDescription: "Report class-count changes; do not substitute zero.",
    entityKind: "analysis-boundary", typeRole: "historical-load-boundary", phase: "evidence-boundary", evidenceStatus: "explicitly-not-evaluated", value: null
  };
  const nodes = [sourceNode, specimenNode, methodNode, ...clusterNodes, ...barcodeNodes, ...signatureNodes, ...cellNodes, ...regimeNodes, lineageBoundaryNode, loadBoundaryNode];

  const clusterIdByIdentity = new Map(artifact.clusters.map((cluster) => [cluster.identity, `cluster:${cluster.clusterId}`]));
  const barcodeIdByIdentity = new Map(artifact.observedBarcodeGroups.map((group) => [group.identity, barcodeNodeId(group.identity)]));
  const signatureIdByIdentity = new Map(artifact.firstFourTargetSignatureGroups.map((group) => [group.identity, signatureNodeId(group.identity)]));
  const signatureIdentityByBarcode = new Map();
  for (const cell of artifact.cells) {
    const previous = signatureIdentityByBarcode.get(cell.observedBarcodeIdentity);
    if (previous && previous !== cell.firstFourTargetSignatureIdentity) fail(`barcode ${cell.observedBarcodeIdentity} maps to multiple first-four-target signatures`);
    signatureIdentityByBarcode.set(cell.observedBarcodeIdentity, cell.firstFourTargetSignatureIdentity);
  }
  const edges = [
    { id: edgeId("identifies-specimen", sourceNode.id, specimenNode.id), source: sourceNode.id, target: specimenNode.id, relation: "identifies-specimen", relationLayer: "sample-identity", evidenceClass: "geo-sample-record", evidenceStatus: "source-recorded" },
    { id: edgeId("defines-projection", methodNode.id, sourceNode.id), source: methodNode.id, target: sourceNode.id, relation: "defines-projection", relationLayer: "bounded-reconstruction", evidenceClass: "declared-analysis-profile", evidenceStatus: "derived", representsObservedDivision: false },
  ];
  for (const cell of artifact.cells) {
    const cellId = cellNodeId(cell.cellId);
    const clusterId = clusterIdByIdentity.get(cell.clusterIdentity);
    const barcodeId = barcodeIdByIdentity.get(cell.observedBarcodeIdentity);
    if (!clusterId || !barcodeId) fail(`cell ${cell.cellId} has an unresolved compiled relation`);
    edges.push({ id: edgeId("contains-cell-observation", specimenNode.id, cellId), source: specimenNode.id, target: cellId, relation: "contains-cell-observation", relationLayer: "direct-measurement", evidenceClass: "gestmaster-row", evidenceStatus: "source-recorded", completeCellRecovery: false });
    edges.push({ id: edgeId("assigned-to-cluster", cellId, clusterId), source: cellId, target: clusterId, relation: "assigned-to-cluster", relationLayer: "published-interpretation", evidenceClass: "source-cluster-ident", evidenceStatus: "source-recorded", ancestryClaim: false });
    edges.push({ id: edgeId("reports-barcode-state", cellId, barcodeId), source: cellId, target: barcodeId, relation: "reports-barcode-state", relationLayer: "direct-measurement", evidenceClass: "source-hmid", evidenceStatus: cell.targetCoverage === "partial" ? "partial-target-coverage" : "source-recorded", uniqueAncestorClaim: false });
  }
  for (const group of artifact.observedBarcodeGroups) {
    const barcodeId = barcodeIdByIdentity.get(group.identity);
    const signatureIdentity = signatureIdentityByBarcode.get(group.identity);
    const signatureId = signatureIdByIdentity.get(signatureIdentity);
    if (!barcodeId || !signatureId) fail(`barcode ${group.identity} has no first-four-target projection`);
    edges.push({ id: edgeId("projects-to-first-four-target-signature", barcodeId, signatureId), source: barcodeId, target: signatureId, relation: "projects-to-first-four-target-signature", relationLayer: "bounded-reconstruction", evidenceClass: "exact-first-four-targets", evidenceStatus: "derived", parentCellClaim: false, divisionClaim: false });
  }
  for (const regime of artifact.identityRegimes) edges.push({ id: edgeId("projects-cohort", `identity-regime:${regime.id}`, sourceNode.id), source: `identity-regime:${regime.id}`, target: sourceNode.id, relation: "projects-cohort", relationLayer: "onto2d-analysis", evidenceClass: "declared-equivalence-key", evidenceStatus: "derived", sourceGraphMutable: false });
  edges.push({ id: edgeId("bounded-by", methodNode.id, lineageBoundaryNode.id), source: methodNode.id, target: lineageBoundaryNode.id, relation: "bounded-by", relationLayer: "evidence-boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });
  edges.push({ id: edgeId("bounded-by", "identity-regime:first-four-target-signature", loadBoundaryNode.id), source: "identity-regime:first-four-target-signature", target: loadBoundaryNode.id, relation: "bounded-by", relationLayer: "evidence-boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
    if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`);
    edgeIds.add(edge.id);
  }
  if (edges.some((edge) => edge.parentCellClaim === true || edge.divisionClaim === true || edge.uniqueAncestorClaim === true || edge.ancestryClaim === true)) fail("compiled lineage semantics differ");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: CELL_LINEAGE_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: CELL_LINEAGE_MAPPING_VERSION, releaseIdentity, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity,
    sourceInventory: { specimens: 1, cells: 750, clusters: 56, observedBarcodes: 192, firstFourTargetSignatures: 133, partialCoverageCells: 16 },
    comparisons: { sameClusterDifferentBarcodePairs: 7058, sameBarcodeDifferentClusterPairs: 22967, sameFirstFourTargetSignatureDifferentClusterPairs: 28360 },
    generatedParents: 0, generatedDivisions: 0, generatedConfidenceValues: 0,
    historicalLoad: { status: artifact.historicalLoad.status, value: null }
  };
  const sourceFiles = [...artifact.source.authoredFiles, { path: artifact.source.snapshot.path, identity: `sha256:${artifact.source.snapshot.sha256}` }].map((file) => ({ path: `cases/cell-lineage-identity/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "cell-lineage-history", name: "Cell Lineage Identity", version, description: "A source-locked ZF1 scGESTALT cohort separating native cell records, transcriptomic clusters, observed barcode states, and a bounded projection over HMID target positions 1-4.", status: "external-source-locked-cell-lineage-case" },
    source: { id: `gse105010-zf1-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes, edges,
    dictionaries: canonicalClone({
      provenance: { geoSeries: artifact.source.geoSeries, geoSample: artifact.source.geoSample, articleDoi: artifact.source.articleDoi, protocolDoi: artifact.source.protocolDoi, retrievedAt: artifact.source.retrievedAt, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: CELL_LINEAGE_MAPPING_VERSION },
      evidenceClasses: {
        "geo-sample-record": "Native specimen identity from the GEO sample record.",
        "gestmaster-row": "One exact matched cell row in the pinned ZF1 GestMaster member.",
        "source-cluster-ident": "Numeric ClusterIdent reported for the matched cell.",
        "source-hmid": "Exact ten-target HMID string reported for the matched cell.",
        "exact-first-four-targets": "Deterministic equality over HMID target positions 1-4; target position is not edit time and the projection is not an observed division.",
        "declared-analysis-profile": "Versioned policy defining the bounded regime comparison.",
        "declared-equivalence-key": "Onto2D projection under an explicit identity regime.",
        "analysis-scope": "Boundary preserving lineage uncertainty and undefined Historical Load."
      },
      identityRegimes: Object.fromEntries(artifact.identityRegimes.map((regime) => [regime.id, regime.meaning])),
      presentation: {
        profile: "cell-lineage-presentation-v1", nodeKindField: "entityKind", relationField: "relation", layerField: "phase", evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Cell lineage evidence", searchPlaceholder: "Search cells, clusters, barcode states, targets 1-4 signatures, and boundaries", typeFilter: "Evidence object", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming lineage-evidence relations", children: "Outgoing lineage-evidence relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Cell / state / barcode / reconstruction boundary", summary: "The same 750 observations form 750, 56, 192, or 133 identity classes depending on the declared key.", note: "Shared cluster is not ancestry; shared barcode is not a unique-parent proof; targets 1-4 form a positional projection, not an edit-time ordering; Historical Load remains undefined." }
      },
      audit
    })
  });
}
