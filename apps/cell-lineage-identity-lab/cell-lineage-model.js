export const EXPECTED_CELL_LINEAGE_CASE_IDENTITY = "sha256:483e7dff9429c3a5280d16f2b5d3f5c27c47a0680661a6ab90576ee9654ed826";

const EXPECTED_REGIMES = Object.freeze([
  ["cell-record", 750],
  ["transcriptomic-cluster", 56],
  ["observed-barcode-state", 192],
  ["first-four-target-signature", 133]
]);
const EXPECTED_COMPARISONS = Object.freeze([
  ["same-cluster-different-barcode", "pairCount", 7058],
  ["same-barcode-different-cluster", "pairCount", 22967],
  ["same-first-four-target-signature-different-cluster", "pairCount", 28360],
  ["partial-target-coverage", "cellCount", 16]
]);

function fail(message) { throw new TypeError(`Cell Lineage model validation failed: ${message}`); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function requiredString(value, label) { if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`); return value; }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} must be unique`); }
function sorted(values) { return [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right), "en", { numeric: true })); }
function sameMembers(left, right) { return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right)); }
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

export function createCellLineageModel(input) {
  if (!isObject(input)) fail("artifact must be an object");
  let artifact;
  try { artifact = structuredClone(input); } catch { fail("artifact must be structured-cloneable"); }
  if (artifact.format !== "onto2d-cell-lineage-identity-case" || artifact.formatVersion !== "1" || artifact.caseId !== "cell-lineage-identity") fail("artifact format differs");
  if (artifact.caseIdentity !== EXPECTED_CELL_LINEAGE_CASE_IDENTITY) fail("case identity differs");
  if (!Array.isArray(artifact.cells) || artifact.cells.length !== 750 || !Array.isArray(artifact.clusters) || artifact.clusters.length !== 56 || !Array.isArray(artifact.observedBarcodeGroups) || artifact.observedBarcodeGroups.length !== 192 || !Array.isArray(artifact.firstFourTargetSignatureGroups) || artifact.firstFourTargetSignatureGroups.length !== 133) fail("bounded inventory differs");
  if (!Array.isArray(artifact.identityRegimes) || artifact.identityRegimes.length !== 4 || !Array.isArray(artifact.comparisons) || artifact.comparisons.length !== 4) fail("analysis inventory differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null || artifact.audit?.caseGeneratedParentCellCount !== 0 || artifact.audit?.caseGeneratedDivisionCount !== 0 || artifact.audit?.caseGeneratedConfidenceCount !== 0) fail("epistemic boundary differs");

  const { cells, clusters, observedBarcodeGroups: barcodes, firstFourTargetSignatureGroups: firstFourTargetSignatures, identityRegimes: regimes, comparisons } = artifact;
  unique(cells.map(({ cellId }) => requiredString(cellId, "cellId")), "cell ids");
  unique(cells.map(({ identity }) => requiredString(identity, "cell identity")), "cell identities");
  unique(clusters.map(({ clusterId }) => clusterId), "cluster ids");
  unique(clusters.map(({ identity }) => requiredString(identity, "cluster identity")), "cluster identities");
  unique(barcodes.map(({ identity }) => requiredString(identity, "barcode identity")), "barcode identities");
  unique(firstFourTargetSignatures.map(({ identity }) => requiredString(identity, "first-four-target signature identity")), "first-four-target signature identities");
  unique(regimes.map(({ id }) => requiredString(id, "regime id")), "regime ids");
  unique(comparisons.map(({ id }) => requiredString(id, "comparison id")), "comparison ids");
  if (JSON.stringify(regimes.map(({ id, expectedClassCount, actualClassCount }) => [id, expectedClassCount === actualClassCount ? actualClassCount : null])) !== JSON.stringify(EXPECTED_REGIMES)) fail("identity regimes differ");
  if (JSON.stringify(comparisons.map((comparison) => {
    const expected = EXPECTED_COMPARISONS.find(([id]) => id === comparison.id);
    return [comparison.id, expected?.[1], comparison[expected?.[1]]];
  })) !== JSON.stringify(EXPECTED_COMPARISONS)) fail("comparison counts differ");

  const clusterById = new Map(clusters.map((cluster) => [cluster.clusterId, cluster]));
  const barcodeByIdentity = new Map(barcodes.map((barcode) => [barcode.identity, barcode]));
  const signatureByIdentity = new Map(firstFourTargetSignatures.map((group) => [group.identity, group]));
  const cellById = new Map(cells.map((cell) => [cell.cellId, cell]));
  for (const cell of cells) {
    const cluster = clusterById.get(cell.clusterId);
    if (!cluster || cluster.identity !== cell.clusterIdentity || !barcodeByIdentity.has(cell.observedBarcodeIdentity) || !signatureByIdentity.has(cell.firstFourTargetSignatureIdentity)) fail(`${cell.cellId} has an unresolved relation`);
  }
  for (const cluster of clusters) {
    if (cells.filter(({ clusterIdentity }) => clusterIdentity === cluster.identity).length !== cluster.cellCount) fail(`cluster ${cluster.clusterId} membership differs`);
  }
  for (const barcode of barcodes) {
    const members = cells.filter(({ observedBarcodeIdentity }) => observedBarcodeIdentity === barcode.identity);
    if (new Set(barcode.cellIds).size !== barcode.cellIds.length || new Set(barcode.clusterIds).size !== barcode.clusterIds.length || members.length !== barcode.cellCount || barcode.cellIds.length !== barcode.cellCount || !sameMembers(members.map(({ cellId }) => cellId), barcode.cellIds) || !sameMembers(members.map(({ clusterId }) => clusterId), barcode.clusterIds)) fail(`barcode ${barcode.identity} membership differs`);
    if (new Set(members.map(({ firstFourTargetSignatureIdentity }) => firstFourTargetSignatureIdentity)).size !== 1) fail(`barcode ${barcode.identity} maps to multiple first-four-target signatures`);
  }
  for (const signature of firstFourTargetSignatures) {
    const members = cells.filter(({ firstFourTargetSignatureIdentity }) => firstFourTargetSignatureIdentity === signature.identity);
    if (new Set(signature.clusterIds).size !== signature.clusterIds.length || members.length !== signature.cellCount || !sameMembers(members.map(({ clusterId }) => clusterId), signature.clusterIds) || new Set(members.map(({ observedBarcodeIdentity }) => observedBarcodeIdentity)).size !== signature.observedBarcodeClassCount) fail(`first-four-target signature ${signature.identity} membership differs`);
  }
  for (const comparison of comparisons) for (const example of comparison.examples) {
    const member = cellById.get(example.cellId);
    const barcode = member ? barcodeByIdentity.get(member.observedBarcodeIdentity) : null;
    const signature = member ? signatureByIdentity.get(member.firstFourTargetSignatureIdentity) : null;
    if (!member || member.sourceRow !== example.sourceRow || member.clusterId !== example.clusterId || member.targetCoverage !== example.targetCoverage || barcode?.key !== example.observedBarcodeKey || signature?.key !== example.firstFourTargetSignatureKey) fail(`comparison ${comparison.id} example differs`);
  }
  if (cells.filter(({ targetCoverage }) => targetCoverage === "partial").length !== 16) fail("partial target coverage differs");

  freeze(artifact);
  const cellsByCluster = new Map(clusters.map(({ clusterId }) => [clusterId, Object.freeze(cells.filter((cell) => cell.clusterId === clusterId))]));

  function cluster(clusterId) { const value = clusterById.get(Number(clusterId)); if (!value) fail(`unknown cluster ${clusterId}`); return value; }
  function cell(cellId) { const value = cellById.get(cellId); if (!value) fail(`unknown cell ${cellId}`); return value; }
  function barcode(identity) { const value = barcodeByIdentity.get(identity); if (!value) fail(`unknown barcode ${identity}`); return value; }
  function firstFourTargetSignature(identity) { const value = signatureByIdentity.get(identity); if (!value) fail(`unknown first-four-target signature ${identity}`); return value; }
  function regime(id) { const value = regimes.find((candidate) => candidate.id === id); if (!value) fail(`unknown regime ${id}`); return value; }
  function comparison(id) { const value = comparisons.find((candidate) => candidate.id === id); if (!value) fail(`unknown comparison ${id}`); return value; }
  function clusterCells(clusterId) { cluster(clusterId); return cellsByCluster.get(Number(clusterId)); }
  function clusterBarcodes(clusterId) {
    const counts = new Map();
    for (const member of clusterCells(clusterId)) counts.set(member.observedBarcodeIdentity, (counts.get(member.observedBarcodeIdentity) ?? 0) + 1);
    return Object.freeze([...counts].map(([identity, cellCount]) => Object.freeze({ barcode: barcode(identity), cellCount })).sort((left, right) => right.cellCount - left.cellCount || left.barcode.key.localeCompare(right.barcode.key)));
  }
  function barcodeCells(identity) { return Object.freeze(barcode(identity).cellIds.map(cell)); }

  return Object.freeze({
    caseIdentity: artifact.caseIdentity,
    source: artifact.source,
    specimen: artifact.specimen,
    clusters,
    barcodes,
    firstFourTargetSignatures,
    cells,
    regimes,
    comparisons,
    reconstructionBoundary: artifact.reconstructionBoundary,
    historicalLoad: artifact.historicalLoad,
    audit: artifact.audit,
    cluster,
    cell,
    barcode,
    firstFourTargetSignature,
    regime,
    comparison,
    clusterCells,
    clusterBarcodes,
    barcodeCells
  });
}
