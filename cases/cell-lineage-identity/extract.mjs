import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, "artifacts", "cell-lineage-identity.json");
const CASE_DOMAIN = "onto2d:cell-lineage-identity-case:v1";
const SOURCE_DOMAIN = "onto2d:cell-lineage-identity-source:v1";
const CELL_DOMAIN = "onto2d:cell-lineage-cell:v1";
const CLUSTER_DOMAIN = "onto2d:cell-lineage-cluster:v1";
const BARCODE_DOMAIN = "onto2d:cell-lineage-observed-barcode:v1";
const FIRST_FOUR_TARGET_DOMAIN = "onto2d:cell-lineage-first-four-target-signature:v1";
const APPROVED_CASE_IDENTITY = "sha256:483e7dff9429c3a5280d16f2b5d3f5c27c47a0680661a6ab90576ee9654ed826";

function fail(message) { throw new Error(`Cell Lineage Identity extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function requiredString(value, label) { if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`); return value; }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} must be unique`); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

async function loadBytes(relative, maximumBytes = 2 * 1024 * 1024) {
  const bytes = await readFile(path.join(ROOT, relative));
  if (bytes.length < 1 || bytes.length > maximumBytes) fail(`${relative} is empty or exceeds ${maximumBytes} bytes`);
  return { relative, bytes };
}

async function loadJson(relative, maximumBytes) {
  const input = await loadBytes(relative, maximumBytes);
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)); } catch { fail(`${relative} is not valid UTF-8 JSON`); }
  return { ...input, value };
}

function validateUpstream(upstream, sourceInput, generatorInput) {
  if (upstream?.format !== "onto2d-cell-lineage-identity-upstream-lock" || upstream.formatVersion !== "1" || upstream.retrievedAt !== "2026-08-19T11:08:56Z" || upstream.liveNetworkRequiredByBuild !== false) fail("upstream release boundary differs");
  if (upstream.dataset?.series !== "GSE105010" || upstream.dataset.sample !== "GSM2813984" || upstream.dataset.sampleName !== "ZF1_scGSTLT" || upstream.dataset.organism !== "Danio rerio") fail("dataset authority differs");
  if (upstream.article?.doi !== "10.1038/nbt.4103" || upstream.protocol?.doi !== "10.1038/s41596-018-0058-x") fail("publication authority differs");
  if (upstream.sourceArchive?.sha256 !== "f1148c62c8a53e4e8ce001a39c8567035d67917280035692568e0c62f2fe9611" || upstream.sourceArchive.member?.sha256 !== "18268e01f510638986a746968d6fae1d3a86622653e7a76388358c90bcd848fe") fail("GEO archive lock differs");
  if (upstream.publishedCode?.commit !== "8be1a3c7ec50a471f76e35b9437f31ecd8406a3c" || upstream.publishedCode.archived !== true) fail("published code lock differs");
  if (upstream.snapshot?.path !== sourceInput.relative || upstream.snapshot.sha256 !== sha256(sourceInput.bytes) || upstream.snapshot.bytes !== sourceInput.bytes.length) fail("source snapshot byte lock differs");
  if (upstream.projectionGenerator?.path !== generatorInput.relative || upstream.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || upstream.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator byte lock differs");
  if (!same(upstream.selection, { animal: "ZF1", sourceCells: 750, sourceRowsDropped: 0, observedTranscriptomicClusters: 56, exactObservedBarcodeStrings: 192, exactFirstFourTargetSignatures: 133, partialTargetCoverageCells: 16, completeAnimalOrDevelopmentalLineageClaim: false })) fail("bounded source selection differs");
  return upstream;
}

function validateSource(source) {
  if (source?.format !== "onto2d-gse105010-zf1-scgestalt-projection" || source.formatVersion !== "1" || source.profileVersion !== "gse105010-zf1-all-observations-v2") fail("source projection format differs");
  if (source.source?.geoSeries !== "GSE105010" || source.source.geoSample !== "GSM2813984" || source.source.sampleName !== "ZF1_scGSTLT") fail("source projection authority differs");
  if (!Array.isArray(source.cells) || source.cells.length !== 750 || !Array.isArray(source.clusters) || source.clusters.length !== 56 || !Array.isArray(source.observedBarcodeGroups) || source.observedBarcodeGroups.length !== 192 || !Array.isArray(source.firstFourTargetSignatureGroups) || source.firstFourTargetSignatureGroups.length !== 133) fail("source projection inventory differs");
  unique(source.cells.map(({ cellId }) => requiredString(cellId, "cellId")), "cell ids");
  unique(source.observedBarcodeGroups.map(({ key }) => requiredString(key, "barcode key")), "barcode keys");
  unique(source.firstFourTargetSignatureGroups.map(({ key }) => requiredString(key, "first-four-target signature key")), "first-four-target signature keys");
  for (const cell of source.cells) {
    if (!Number.isInteger(cell.sourceRow) || !Number.isInteger(cell.clusterId) || !Array.isArray(cell.targetStates) || cell.targetStates.length !== 10) fail(`${cell.cellId} source fields differ`);
    if (!/^sha256:[0-9a-f]{64}$/.test(cell.observedBarcodeKey) || !/^sha256:[0-9a-f]{64}$/.test(cell.firstFourTargetSignatureKey)) fail(`${cell.cellId} grouping key differs`);
    if (!source.clusters.some(({ clusterId }) => clusterId === cell.clusterId) || !source.observedBarcodeGroups.some(({ key }) => key === cell.observedBarcodeKey) || !source.firstFourTargetSignatureGroups.some(({ key }) => key === cell.firstFourTargetSignatureKey)) fail(`${cell.cellId} has an unresolved grouping reference`);
  }
  if (!same(source.boundedComparisons, { sameClusterDifferentObservedBarcodePairs: 7058, sameObservedBarcodeDifferentClusterPairs: 22967, sameFirstFourTargetSignatureDifferentClusterPairs: 28360 })) fail("bounded pair comparison differs");
  if (!same(source.audit, { cellsRetained: 750, sourceRowsDropped: 0, clusterCount: 56, observedBarcodeClassCount: 192, firstFourTargetSignatureClassCount: 133, partialTargetCoverageCellCount: 16, unobservedDivisionsInvented: 0, confidenceValuesInvented: 0, biologicalLabelsInvented: 0 })) fail("source audit differs");
  return source;
}

function validateProfile(profile) {
  if (profile?.format !== "onto2d-cell-lineage-identity-analysis-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "zf1-scgestalt-regime-comparison-v2") fail("analysis profile differs");
  if (!same(profile.identityRegimes?.map(({ id, expectedClassCount }) => [id, expectedClassCount]), [["cell-record", 750], ["transcriptomic-cluster", 56], ["observed-barcode-state", 192], ["first-four-target-signature", 133]])) fail("identity regime boundary differs");
  if (!same(profile.comparisons?.map(({ id, pairCount }) => [id, pairCount]), [["same-cluster-different-barcode", 7058], ["same-barcode-different-cluster", 22967], ["same-first-four-target-signature-different-cluster", 28360]])) fail("comparison inventory differs");
  if (profile.reconstructionPolicy?.publishedTreeImported !== false || profile.reconstructionPolicy.publishedMaximumParsimonyRecomputed !== false || profile.reconstructionPolicy.firstFourTargetGroupingComputed !== true || profile.reconstructionPolicy.groupingRepresentsObservedDivision !== false || profile.reconstructionPolicy.sameBarcodeProvesUniqueAncestor !== false || profile.reconstructionPolicy.missingTargetStateMayBeImputed !== false || profile.reconstructionPolicy.confidenceMayBeInvented !== false) fail("reconstruction policy differs");
  if (profile.historicalLoad?.status !== "not-evaluated" || profile.historicalLoad.value !== null) fail("Historical Load boundary differs");
  return profile;
}

function pickExamples(source) {
  const cells = [...source.cells].sort((left, right) => left.cellId.localeCompare(right.cellId));
  const cluster20 = cells.filter(({ clusterId }) => clusterId === 20);
  const first = cluster20[0];
  const second = cluster20.find(({ observedBarcodeKey }) => observedBarcodeKey !== first.observedBarcodeKey);
  if (!first || !second) fail("cannot select same-cluster example");

  const crossBarcode = [...source.observedBarcodeGroups]
    .filter(({ clusterIds }) => clusterIds.includes(27) && clusterIds.includes(30))
    .sort((left, right) => left.cellCount - right.cellCount || left.key.localeCompare(right.key))[0];
  const crossMembers = cells.filter(({ observedBarcodeKey }) => observedBarcodeKey === crossBarcode?.key);
  const cluster27 = crossMembers.find(({ clusterId }) => clusterId === 27);
  const cluster30 = crossMembers.find(({ clusterId }) => clusterId === 30);
  if (!cluster27 || !cluster30) fail("cannot select shared-barcode example");

  let firstFourPair;
  for (const group of [...source.firstFourTargetSignatureGroups].sort((left, right) => left.cellCount - right.cellCount || left.key.localeCompare(right.key))) {
    const members = cells.filter(({ firstFourTargetSignatureKey }) => firstFourTargetSignatureKey === group.key);
    const left = members[0];
    const right = members.find((candidate) => candidate.clusterId !== left.clusterId && candidate.observedBarcodeKey !== left.observedBarcodeKey);
    if (right) { firstFourPair = [left, right]; break; }
  }
  if (!firstFourPair) fail("cannot select first-four-target-signature example");
  const partial = cells.filter(({ targetCoverage }) => targetCoverage === "partial").slice(0, 2);
  if (partial.length !== 2) fail("cannot select partial-coverage examples");
  return { sameCluster: [first, second], sameBarcode: [cluster27, cluster30], sameFirstFour: firstFourPair, partial };
}

function cellRef(cell) {
  return { cellId: cell.cellId, sourceRow: cell.sourceRow, clusterId: cell.clusterId, observedBarcodeKey: cell.observedBarcodeKey, firstFourTargetSignatureKey: cell.firstFourTargetSignatureKey, targetCoverage: cell.targetCoverage };
}

export async function buildCellLineageIdentityCase() {
  const [upstreamInput, sourceInput, profileInput, generatorInput] = await Promise.all([
    loadJson("upstream.json", 128 * 1024),
    loadJson("source/gse105010-zf1-scgestalt.json", 2 * 1024 * 1024),
    loadJson("analysis-profile.json", 128 * 1024),
    loadBytes("prepare-source.py", 128 * 1024),
  ]);
  const upstream = validateUpstream(upstreamInput.value, sourceInput, generatorInput);
  const source = validateSource(sourceInput.value);
  const profile = validateProfile(profileInput.value);
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, {
    series: upstream.dataset.series,
    sample: upstream.dataset.sample,
    sourceArchive: upstream.sourceArchive,
    snapshotSha256: upstream.snapshot.sha256,
    profileVersion: source.profileVersion,
  });
  const clusterIdentities = new Map(source.clusters.map((cluster) => [cluster.clusterId, hashCanonical(CLUSTER_DOMAIN, { sourceIdentity, clusterId: cluster.clusterId })]));
  const barcodeIdentities = new Map(source.observedBarcodeGroups.map((group) => [group.key, hashCanonical(BARCODE_DOMAIN, { sourceIdentity, observedBarcodeKey: group.key })]));
  const signatureIdentities = new Map(source.firstFourTargetSignatureGroups.map((group) => [group.key, hashCanonical(FIRST_FOUR_TARGET_DOMAIN, { sourceIdentity, firstFourTargetSignatureKey: group.key })]));
  const cells = source.cells.map((cell) => ({
    identity: hashCanonical(CELL_DOMAIN, { sourceIdentity, nativeCellId: cell.cellId }),
    cellId: cell.cellId,
    sourceRow: cell.sourceRow,
    sourceCellNumber: cell.sourceCellNumber,
    sourceCellBarcode: cell.sourceCellBarcode,
    clusterId: cell.clusterId,
    clusterIdentity: clusterIdentities.get(cell.clusterId),
    observedBarcodeIdentity: barcodeIdentities.get(cell.observedBarcodeKey),
    firstFourTargetSignatureIdentity: signatureIdentities.get(cell.firstFourTargetSignatureKey),
    targetCoverage: cell.targetCoverage,
  }));
  const examples = pickExamples(source);
  const basis = {
    format: "onto2d-cell-lineage-identity-case",
    formatVersion: "1",
    caseId: "cell-lineage-identity",
    profileVersion: profile.profileVersion,
    source: {
      identity: sourceIdentity,
      geoSeries: upstream.dataset.series,
      geoSample: upstream.dataset.sample,
      sampleName: upstream.dataset.sampleName,
      organism: upstream.dataset.organism,
      articleDoi: upstream.article.doi,
      protocolDoi: upstream.protocol.doi,
      retrievedAt: upstream.retrievedAt,
      liveNetworkRequiredByBuild: false,
      rawArchive: { url: upstream.sourceArchive.url, bytes: upstream.sourceArchive.bytes, sha256: upstream.sourceArchive.sha256 },
      rawMember: upstream.sourceArchive.member,
      publishedCode: upstream.publishedCode,
      snapshot: { path: upstream.snapshot.path, bytes: upstream.snapshot.bytes, sha256: upstream.snapshot.sha256 },
      authoredFiles: [
        { path: "upstream.json", identity: `sha256:${sha256(upstreamInput.bytes)}` },
        { path: "analysis-profile.json", identity: `sha256:${sha256(profileInput.bytes)}` },
        { path: "prepare-source.py", identity: `sha256:${sha256(generatorInput.bytes)}` },
      ],
    },
    specimen: { id: "ZF1", sourceSample: "GSM2813984", material: "juvenile zebrafish brain", sourceMatchedCellCount: 750, completeCellRecovery: false },
    clusters: source.clusters.map((cluster) => ({ identity: clusterIdentities.get(cluster.clusterId), ...cluster })),
    observedBarcodeGroups: source.observedBarcodeGroups.map((group) => ({ identity: barcodeIdentities.get(group.key), key: group.key, observedBarcode: group.value, cellCount: group.cellCount, clusterIds: group.clusterIds, cellIds: group.cellIds })),
    firstFourTargetSignatureGroups: source.firstFourTargetSignatureGroups.map((group) => ({ identity: signatureIdentities.get(group.key), key: group.key, firstFourTargetSignature: group.value, cellCount: group.cellCount, clusterIds: group.clusterIds, observedBarcodeClassCount: new Set(source.cells.filter(({ firstFourTargetSignatureKey }) => firstFourTargetSignatureKey === group.key).map(({ observedBarcodeKey }) => observedBarcodeKey)).size })),
    cells,
    identityRegimes: profile.identityRegimes.map((regime) => ({ ...regime, actualClassCount: regime.expectedClassCount })),
    comparisons: [
      { ...profile.comparisons[0], examples: examples.sameCluster.map(cellRef) },
      { ...profile.comparisons[1], examples: examples.sameBarcode.map(cellRef) },
      { ...profile.comparisons[2], examples: examples.sameFirstFour.map(cellRef) },
      { id: "partial-target-coverage", cellCount: 16, result: "OUT states remain explicit and are never imputed.", examples: examples.partial.map(cellRef) },
    ],
    reconstructionBoundary: profile.reconstructionPolicy,
    historicalLoad: profile.historicalLoad,
    nonClaims: profile.nonClaims,
    audit: { ...source.audit, ...source.boundedComparisons, caseGeneratedParentCellCount: 0, caseGeneratedDivisionCount: 0, caseGeneratedConfidenceCount: 0 },
  };
  return { ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) };
}

export function verifyCellLineageIdentityCaseIdentity(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) fail("artifact must be an object");
  const { caseIdentity, ...basis } = artifact;
  const expected = hashCanonical(CASE_DOMAIN, basis);
  if (caseIdentity !== expected) fail(`case identity ${caseIdentity} does not match ${expected}`);
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} does not match approved release ${APPROVED_CASE_IDENTITY}`);
  if (artifact.cells.length !== 750 || artifact.clusters.length !== 56 || artifact.observedBarcodeGroups.length !== 192 || artifact.firstFourTargetSignatureGroups.length !== 133) fail("approved inventory differs");
  if (artifact.audit.caseGeneratedParentCellCount || artifact.audit.caseGeneratedDivisionCount || artifact.audit.caseGeneratedConfidenceCount || artifact.historicalLoad.value !== null) fail("approved epistemic boundary differs");
  return artifact;
}

async function main() {
  const artifact = await buildCellLineageIdentityCase();
  const output = serialize(artifact);
  if (process.argv.includes("--verify")) {
    const committed = await readFile(OUTPUT, "utf8");
    assert.equal(committed, output, "committed Cell Lineage Identity artifact differs from extraction");
    verifyCellLineageIdentityCaseIdentity(JSON.parse(committed));
    console.log(`Verified ${path.relative(process.cwd(), OUTPUT)} (${artifact.caseIdentity})`);
    return;
  }
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, output, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)} (${artifact.caseIdentity})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((error) => { console.error(error); process.exitCode = 1; });
