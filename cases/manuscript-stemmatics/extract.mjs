import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "manuscript-stemmatics.json");
const CASE_DOMAIN = "onto2d:manuscript-stemmatics-case:v1";
const SOURCE_DOMAIN = "onto2d:manuscript-stemmatics-source:v1";
const WITNESS_DOMAIN = "onto2d:manuscript-witness:v1";
const PROJECTION_DOMAIN = "onto2d:manuscript-history-equivalence:v1";
const APPROVED_CASE_IDENTITY = "sha256:f434de7c96b481ee68abcf13f4b50e216af99ce8710014061b5a7ff7ac574629";
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const HASH = /^[0-9a-f]{64}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const WITNESS_IDS = Object.freeze(["Cx1", "Cx2", "Pn", "Wy", "Hg", "Ch", "El"]);
const SITE_IDS = Object.freeze(["mi-65-silk-grene", "mi-511-cogheth-knocketh"]);
const RELATION_IDS = Object.freeze(["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2", "copy:Cx2:Pn", "copy:Cx2:Wy"]);
const EXPECTED_VERDICTS = Object.freeze([
  [false, true, true, false],
  [false, true, true, true],
  [false, false, true, false]
]);
const ABLATION_POLICY = Object.freeze({
  relationRules: Object.freeze({
    "base-text:Cx1:Cx2": Object.freeze({ requiredEvidenceIds: Object.freeze(["claim-caxton-correction"]), supportingEvidenceIds: Object.freeze([]) }),
    "correction-source:better-copy:Cx2": Object.freeze({ requiredEvidenceIds: Object.freeze(["claim-caxton-correction"]), supportingEvidenceIds: Object.freeze(["claim-correction-profile-207"]) }),
    "copy:Cx2:Pn": Object.freeze({ requiredEvidenceIds: Object.freeze(["claim-descendants-of-cx2"]), supportingEvidenceIds: Object.freeze([]) }),
    "copy:Cx2:Wy": Object.freeze({ requiredEvidenceIds: Object.freeze(["claim-descendants-of-cx2"]), supportingEvidenceIds: Object.freeze([]) })
  }),
  localMultipleParentRelationIds: Object.freeze(["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2"])
});

function fail(message) { throw new Error(`Manuscript Stemmatics extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u0080-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function exactKeys(value, keys, label) { if (!isRecord(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`); }
function safePath(value, label) { if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`); return value; }

async function load(relative, limit = 128 * 1024) {
  safePath(relative, "input path");
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length < 1 || bytes.length > limit) fail(`${relative} is empty or exceeds ${limit} bytes`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail(`${relative} is not valid UTF-8`); }
  let value;
  try { value = JSON.parse(text); } catch { fail(`${relative} is not valid JSON`); }
  return { path: relative, bytes, value };
}

function fileEntry(role, input) { return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length }); }

function validateUpstream(value) {
  exactKeys(value, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "upstreamFiles", "snapshots", "selection"], "upstream lock");
  if (value.format !== "onto2d-manuscript-stemmatics-upstream-lock" || value.formatVersion !== "1") fail("upstream lock version differs");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.retrievedAt) || value.liveNetworkRequiredByBuild !== false) fail("retrieval boundary differs");
  if (value.source?.id !== "new-stemmatics" || !/^https:\/\//.test(value.source.indexUrl ?? "") || !/version not specified/.test(value.source.licenseStatement ?? "") || !value.source.citation) fail("source attribution is incomplete");
  if (!Array.isArray(value.upstreamFiles) || !same(value.upstreamFiles.map((file) => file.role), ["dataset-index", "millers-tale-nexus", "millers-tale-analysis"])) fail("upstream file inventory differs");
  for (const file of value.upstreamFiles) if (!/^https:\/\//.test(file.url) || !HASH.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || !file.etag || !file.lastModified) fail(`${file.role} lock is incomplete`);
  if (!Array.isArray(value.snapshots) || value.snapshots.length !== 2) fail("snapshot inventory differs");
  for (const snapshot of value.snapshots) {
    safePath(snapshot.path, `${snapshot.role}.path`);
    if (!HASH.test(snapshot.sha256) || !Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 1 || !Array.isArray(snapshot.derivedFrom) || snapshot.derivedFrom.length < 2) fail(`${snapshot.role} snapshot lock is incomplete`);
  }
  if (value.selection.profile !== "millers-tale-cx2-multiple-exemplar-v1" || value.selection.corpusId !== "new-stemmatics-millers-tale-link-1" || !same(value.selection.selectedWitnessIds, WITNESS_IDS) || !same(value.selection.selectedReadingSiteIds, SITE_IDS) || value.selection.flagshipWitnessId !== "Cx2" || !same(value.selection.unresolvedExemplarIds, ["better-copy"])) fail("selection boundary differs");
  return value;
}

function validateCollation(value) {
  exactKeys(value, ["format", "formatVersion", "sourceFile", "corpus", "missingData", "witnesses", "correctionProfile", "readingSites", "selectionBoundary"], "collation selection");
  if (value.format !== "onto2d-millers-tale-collation-selection" || value.formatVersion !== "1") fail("collation selection version differs");
  if (value.sourceFile.sha256 !== "b6b7b2114119a48cedad400bc1d2cfea80013e71bcf3d70b2e2f3a0ada6ce7b5" || value.sourceFile.bytes !== 425284) fail("NEXUS source lock differs");
  if (value.corpus.id !== "new-stemmatics-millers-tale-link-1" || value.corpus.nexusTaxa !== 59 || value.corpus.collationBaseCount !== 1 || value.corpus.witnessCount !== 58 || value.corpus.variantCharacterCount !== 4032 || value.corpus.transposedMatrix !== true || value.corpus.parallelSegmentation !== true) fail("corpus census differs");
  if (value.missingData.substantiallyIncompleteWitnessCount !== 4 || !same(value.missingData.witnessIds, ["Ad2", "Hk", "Ox1", "Ra2"]) || value.missingData.exactMissingRates !== null) fail("missing-data boundary differs");
  if (!Array.isArray(value.witnesses) || !same(value.witnesses.map((witness) => witness.id), WITNESS_IDS) || new Set(WITNESS_IDS).size !== WITNESS_IDS.length) fail("selected witness inventory differs");
  if (!same(value.witnesses.map((witness) => witness.bGroupVariantCount), [218, 132, 115, 125, 0, 3, 32])) fail("published b-group counts differ");
  if (!same(value.witnesses.map((witness) => witness.cx2CorrectionProfileAgreementCount), [0, 207, null, null, 188, 188, 183])) fail("published correction-profile counts differ");
  if (value.correctionProfile.count !== 207 || value.correctionProfile.id !== "cx2-corrections-present-in-more-than-three-witnesses") fail("correction profile differs");
  if (!Array.isArray(value.readingSites) || !same(value.readingSites.map((site) => site.id), SITE_IDS)) fail("reading-site inventory differs");
  for (const site of value.readingSites) {
    const observed = site.readings.flatMap((reading) => reading.witnessIds);
    if (!Number.isSafeInteger(site.nexusCharacterIndex) || site.nexusCharacterIndex < 1 || new Set(observed).size !== WITNESS_IDS.length || !same([...observed].sort(), [...WITNESS_IDS].sort())) fail(`${site.id} reading coverage differs`);
  }
  if (value.selectionBoundary.selectedWitnessCount !== 7 || value.selectionBoundary.selectedSiteCount !== 2 || value.selectionBoundary.representativeSampleClaim !== false || value.selectionBoundary.fullCollationReconstructionClaim !== false) fail("selection claim was broadened");
  return value;
}

function validateClaims(value) {
  exactKeys(value, ["format", "formatVersion", "sourceFile", "publication", "claims", "entities", "transmissionRelations"], "analysis claims");
  if (value.format !== "onto2d-millers-tale-analysis-claims" || value.formatVersion !== "1" || value.sourceFile.sha256 !== "55c0d2c1f50e844b1c465626ca1a5ff21b4d6d79ea10ff23cf450b7ecd8456b9" || value.sourceFile.bytes !== 348556 || value.sourceFile.pageCount !== 27) fail("analysis source lock differs");
  const claimIds = value.claims.map((claim) => claim.id);
  if (!same(claimIds, ["claim-corpus-census", "claim-b-group", "claim-descendants-of-cx2", "claim-caxton-correction", "claim-correction-profile-207", "claim-tree-distortion", "claim-rooting-uncertainty"]) || value.claims.some((claim) => claim.directObservation !== false || !Array.isArray(claim.locators) || claim.locators.length < 1)) fail("published claim boundary differs");
  if (!same(value.entities, [{ id: "better-copy", label: "Caxton's better copy", kind: "unresolved-exemplar-reference", extantWitness: false, exactIdentity: null, inventedByOnto2D: false, sourceClaimId: "claim-caxton-correction" }])) fail("unresolved exemplar boundary differs");
  if (!same(value.transmissionRelations.map((relation) => relation.id), RELATION_IDS)) fail("transmission relation inventory differs");
  const validEndpoints = new Set([...WITNESS_IDS, "better-copy"]);
  for (const relation of value.transmissionRelations) {
    if (!validEndpoints.has(relation.source) || !validEndpoints.has(relation.target) || relation.origin !== "published-analysis" || relation.directObservation !== false || relation.physicalExemplarIdentityResolved !== false || !Array.isArray(relation.evidenceIds) || relation.evidenceIds.some((id) => !claimIds.includes(id))) fail(`${relation.id} evidence boundary differs`);
  }
  const contamination = value.transmissionRelations.filter((relation) => relation.contamination);
  if (contamination.length !== 1 || contamination[0].id !== "correction-source:better-copy:Cx2" || contamination[0].treeCompatible !== false || value.transmissionRelations.filter((relation) => relation.target === "Cx2").length !== 2) fail("multiple-source relation differs");
  return value;
}

function validateProfile(value) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "corpusId", "flagshipWitnessId", "comparisonPairs", "equivalenceRegimes", "ablationRuns", "historicalLoad", "nonClaims"], "analysis profile");
  if (value.format !== "onto2d-manuscript-transmission-analysis-profile" || value.formatVersion !== "1" || value.profileVersion !== "manuscript-transmission-v1" || value.corpusId !== "new-stemmatics-millers-tale-link-1" || value.flagshipWitnessId !== "Cx2") fail("analysis profile version differs");
  if (!same(value.comparisonPairs.map((pair) => pair.id), ["cx2-pn", "pn-wy", "cx1-cx2"]) || !same(value.equivalenceRegimes.map((regime) => regime.id), ["witness-record", "selected-reading-slice", "scholarly-group", "transmission-role"])) fail("equivalence profile differs");
  if (!same(value.ablationRuns.map((run) => run.id), ["full-evidence", "without-correction-profile", "without-published-correction-claim", "without-example-sites"])) fail("ablation inventory differs");
  if (value.historicalLoad.status !== "not-evaluated" || value.historicalLoad.value !== null || !/undefined rather than zero/.test(value.historicalLoad.reason ?? "")) fail("Historical Load boundary differs");
  if (!Array.isArray(value.nonClaims) || value.nonClaims.length < 8 || new Set(value.nonClaims).size !== value.nonClaims.length) fail("non-claim boundary is incomplete");
  return value;
}

function readingValue(site, witnessId) {
  const matches = site.readings.filter((reading) => reading.witnessIds.includes(witnessId));
  if (matches.length !== 1) fail(`${site.id} has ${matches.length} readings for ${witnessId}`);
  return matches[0].value;
}

function transmissionRole(witnessId) {
  if (witnessId === "Cx1") return "base-source-for-cx2";
  if (witnessId === "Cx2") return "base-plus-correction-target";
  if (witnessId === "Pn" || witnessId === "Wy") return "descendant-of-cx2";
  return "no-bounded-incoming-claim";
}

function buildWitnesses(collation) {
  return collation.witnesses.map((source) => {
    const readings = collation.readingSites.map((site) => ({ siteId: site.id, locator: site.locator, value: readingValue(site, source.id), evidenceState: "selected-collation-reading", sourceLocator: site.sourceLocator }));
    const withoutIdentity = { ...source, readings, readingSignature: readings.map((reading) => `${reading.siteId}:${reading.value}`).join("|"), transmissionRole: transmissionRole(source.id), evidenceState: "source-projected-witness" };
    return Object.freeze({ ...withoutIdentity, identity: hashCanonical(WITNESS_DOMAIN, withoutIdentity) });
  });
}

function compareWitnesses(witnesses, pairs, regimes) {
  const byId = new Map(witnesses.map((witness) => [witness.id, witness]));
  return pairs.map((pair) => {
    const left = byId.get(pair.left); const right = byId.get(pair.right);
    if (!left || !right || left === right) fail(`${pair.id} comparison endpoints differ`);
    const results = regimes.map((regime) => {
      const leftValues = Object.fromEntries(regime.fields.map((field) => [field, field === "witnessId" ? left.id : left[field]]));
      const rightValues = Object.fromEntries(regime.fields.map((field) => [field, field === "witnessId" ? right.id : right[field]]));
      const differingFields = regime.fields.filter((field) => !same(leftValues[field], rightValues[field]));
      return Object.freeze({ regimeId: regime.id, label: regime.label, question: regime.question, comparedFields: [...regime.fields], leftProjectionIdentity: hashCanonical(PROJECTION_DOMAIN, { regimeId: regime.id, values: leftValues }), rightProjectionIdentity: hashCanonical(PROJECTION_DOMAIN, { regimeId: regime.id, values: rightValues }), differingFields, equal: differingFields.length === 0 });
    });
    return Object.freeze({ id: pair.id, label: pair.label, left: pair.left, right: pair.right, historiesDistinct: true, results });
  });
}

function buildAgreementComparisons(witnesses, pairs) {
  const byId = new Map(witnesses.map((witness) => [witness.id, witness]));
  return pairs.map((pair) => {
    const left = byId.get(pair.left); const right = byId.get(pair.right);
    const agreements = SITE_IDS.filter((siteId) => left.readings.find((reading) => reading.siteId === siteId).value === right.readings.find((reading) => reading.siteId === siteId).value);
    return Object.freeze({ id: pair.id, left: pair.left, right: pair.right, method: "exact equality over two source-discussed reading sites v1", comparedSiteIds: [...SITE_IDS], agreementSiteIds: agreements, agreementCount: agreements.length, comparedSiteCount: SITE_IDS.length, agreementShare: agreements.length / SITE_IDS.length, selectionBiased: true, representativeOfFullCollation: false, createsTransmissionRelation: false, createsAncestry: false });
  });
}

function deriveAblation(run, claims, readingSites, relations) {
  const evidenceIds = new Set([...claims.map((claim) => claim.id), ...readingSites.map((site) => `reading:${site.id}`)]);
  const removed = new Set(run.removedEvidenceIds);
  if (typeof run.id !== "string" || typeof run.label !== "string" || run.label.length === 0 || removed.size !== run.removedEvidenceIds.length || [...removed].some((id) => !evidenceIds.has(id))) fail(`${run.id} removes unknown evidence`);
  const relationById = new Map(relations.map((relation) => [relation.id, relation]));
  if (relationById.size !== RELATION_IDS.length || !same([...relationById.keys()], RELATION_IDS)) fail(`${run.id} relation inventory differs`);
  const supportedRelationIds = [];
  const attributedOnlyRelationIds = [];
  const withheldRelationIds = [];
  for (const relationId of RELATION_IDS) {
    const relation = relationById.get(relationId);
    const rule = ABLATION_POLICY.relationRules[relationId];
    if (!rule || !same(relation.evidenceIds, [...rule.requiredEvidenceIds, ...rule.supportingEvidenceIds])) fail(`${relationId} evidence policy differs`);
    if (rule.requiredEvidenceIds.some((id) => removed.has(id))) withheldRelationIds.push(relationId);
    else if (rule.supportingEvidenceIds.some((id) => removed.has(id))) attributedOnlyRelationIds.push(relationId);
    else supportedRelationIds.push(relationId);
  }
  const localMultipleParentSupported = ABLATION_POLICY.localMultipleParentRelationIds.every((id) => supportedRelationIds.includes(id));
  const resultState = ABLATION_POLICY.localMultipleParentRelationIds.some((id) => withheldRelationIds.includes(id)) ? "unresolved" : "partial";
  const activeEvidenceIds = [...evidenceIds].filter((id) => !removed.has(id));
  return Object.freeze({
    id: run.id,
    label: run.label,
    removedEvidenceIds: [...run.removedEvidenceIds],
    supportedRelationIds,
    attributedOnlyRelationIds,
    withheldRelationIds,
    localMultipleParentSupported,
    resultState,
    activeEvidenceIds,
    removedEvidenceRetained: false
  });
}

function buildAblations(profile, claims, collation) {
  return profile.ablationRuns.map((run) => {
    const derived = deriveAblation(run, claims.claims, collation.readingSites, claims.transmissionRelations);
    const expected = {
      supportedRelationIds: run.supportedRelationIds,
      attributedOnlyRelationIds: run.attributedOnlyRelationIds,
      withheldRelationIds: run.withheldRelationIds,
      localMultipleParentSupported: run.localMultipleParentSupported,
      resultState: run.resultState
    };
    const actual = {
      supportedRelationIds: derived.supportedRelationIds,
      attributedOnlyRelationIds: derived.attributedOnlyRelationIds,
      withheldRelationIds: derived.withheldRelationIds,
      localMultipleParentSupported: derived.localMultipleParentSupported,
      resultState: derived.resultState
    };
    if (!same(actual, expected)) fail(`${run.id} expected ablation result differs from the evidence policy`);
    return derived;
  });
}

function verifySemantics(artifact) {
  if (artifact.format !== "onto2d-manuscript-stemmatics-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "manuscript-stemmatics-v1") fail("artifact version differs");
  const { caseIdentity, ...basis } = artifact;
  if (!IDENTITY.test(caseIdentity ?? "") || caseIdentity !== hashCanonical(CASE_DOMAIN, basis)) fail("case identity differs");
  if (artifact.source.identity !== hashCanonical(SOURCE_DOMAIN, { authoredFiles: artifact.source.authoredFiles, snapshotFiles: artifact.source.snapshotFiles, upstreamFiles: artifact.source.upstreamFiles, citation: artifact.source.citation })) fail("source identity differs");
  if (!same(artifact.witnesses.map((witness) => witness.id), WITNESS_IDS) || artifact.witnesses.some((witness) => !IDENTITY.test(witness.identity) || witness.readings.length !== 2)) fail("witness identity differs");
  for (const witness of artifact.witnesses) {
    const { identity, ...witnessBasis } = witness;
    if (identity !== hashCanonical(WITNESS_DOMAIN, witnessBasis)) fail(`witness ${witness.id} identity differs`);
  }
  if (!same(artifact.missingData.substantiallyIncompleteWitnessIds, ["Ad2", "Hk", "Ox1", "Ra2"]) || artifact.missingData.exactMissingRates !== null) fail("missing data was fabricated");
  if (!same(artifact.transmission.relations.map((relation) => relation.id), RELATION_IDS) || artifact.transmission.relations.some((relation) => relation.directObservation !== false || relation.origin !== "published-analysis" || relation.physicalExemplarIdentityResolved !== false)) fail("attributed transmission boundary differs");
  const contamination = artifact.transmission.relations.filter((relation) => relation.contamination);
  if (contamination.length !== 1 || contamination[0].source !== "better-copy" || contamination[0].target !== "Cx2" || contamination[0].treeCompatible !== false || contamination[0].relationLayer !== "attributed-contamination") fail("contamination boundary differs");
  const multiple = artifact.reconstruction.multipleSourceCases[0];
  if (artifact.reconstruction.status !== "partial" || artifact.reconstruction.actualPastClaim !== false || artifact.reconstruction.centralRootingResolved !== false || artifact.reconstruction.candidateHistories.length !== 0 || multiple.target !== "Cx2" || !same(multiple.inputRelationIds, ["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2"]) || multiple.treeCompatible !== false || multiple.unresolvedSourceIds[0] !== "better-copy") fail("multiple-source reconstruction boundary differs");
  if (artifact.agreementComparisons.some((comparison) => comparison.createsAncestry || comparison.createsTransmissionRelation || comparison.representativeOfFullCollation)) fail("reading agreement was promoted");
  if (!same(artifact.historyEquivalence.comparisons.map((comparison) => comparison.results.map((result) => result.equal)), EXPECTED_VERDICTS)) fail("history-equivalence matrix differs");
  if (artifact.evidenceAblation.some((run) => run.removedEvidenceRetained || run.removedEvidenceIds.some((id) => run.activeEvidenceIds.includes(id)))) fail("ablated evidence remains active");
  for (const run of artifact.evidenceAblation) {
    const replayed = deriveAblation(run, artifact.scholarlyClaims, artifact.readingSites, artifact.transmission.relations);
    if (!same(replayed, run)) fail(`ablation ${run.id} result differs from the evidence policy`);
  }
  if (artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved manuscript-stemmatics-v1 release`);
  return artifact;
}

export function verifyManuscriptStemmaticsCaseIdentity(input) { if (!isRecord(input)) fail("artifact must be an object"); return verifySemantics(structuredClone(input)); }

export async function buildManuscriptStemmaticsCase() {
  const [upstreamInput, profileInput, collationInput, claimsInput] = await Promise.all([load("upstream.json"), load("analysis-profile.json"), load("source/millers-tale-collation-selection.json"), load("source/millers-tale-analysis-claims.json")]);
  const upstream = validateUpstream(upstreamInput.value); const profile = validateProfile(profileInput.value); const collation = validateCollation(collationInput.value); const claims = validateClaims(claimsInput.value);
  const snapshotByRole = new Map([["collation-selection", collationInput], ["analysis-claims", claimsInput]]);
  for (const lock of upstream.snapshots) { const input = snapshotByRole.get(lock.role); if (!input || lock.path !== input.path || lock.sha256 !== sha256(input.bytes) || lock.bytes !== input.bytes.length) fail(`${lock.role} projection does not match its lock`); }
  const nexusLock = upstream.upstreamFiles.find((file) => file.role === "millers-tale-nexus"); const analysisLock = upstream.upstreamFiles.find((file) => file.role === "millers-tale-analysis");
  if (nexusLock.sha256 !== collation.sourceFile.sha256 || nexusLock.bytes !== collation.sourceFile.bytes || analysisLock.sha256 !== claims.sourceFile.sha256 || analysisLock.bytes !== claims.sourceFile.bytes) fail("projection upstream identity differs");
  const witnesses = buildWitnesses(collation);
  const comparisons = compareWitnesses(witnesses, profile.comparisonPairs, profile.equivalenceRegimes);
  const ablations = buildAblations(profile, claims, collation);
  const authoredFiles = [fileEntry("upstream-lock", upstreamInput), fileEntry("analysis-profile", profileInput)];
  const snapshotFiles = [fileEntry("collation-selection", collationInput), fileEntry("analysis-claims", claimsInput)];
  const sourceBasis = { authoredFiles, snapshotFiles, upstreamFiles: upstream.upstreamFiles, citation: upstream.source.citation };
  const source = { identity: hashCanonical(SOURCE_DOMAIN, sourceBasis), retrievedAt: upstream.retrievedAt, liveNetworkRequiredByBuild: false, authoredFiles, snapshotFiles, upstreamFiles: upstream.upstreamFiles, citation: upstream.source.citation, license: { statement: upstream.source.licenseStatement, url: upstream.source.licenseUrl } };
  const withoutIdentity = {
    format: "onto2d-manuscript-stemmatics-case", formatVersion: "1", caseVersion: "manuscript-stemmatics-v1", source,
    corpus: { ...collation.corpus, sourceDataset: "The New Stemmatics", selectionProfile: upstream.selection.profile },
    selection: { witnessIds: [...WITNESS_IDS], readingSiteIds: [...SITE_IDS], witnessCount: WITNESS_IDS.length, readingSiteCount: SITE_IDS.length, representativeSampleClaim: false, fullCollationReconstructionClaim: false },
    missingData: { substantiallyIncompleteWitnessCount: collation.missingData.substantiallyIncompleteWitnessCount, substantiallyIncompleteWitnessIds: collation.missingData.witnessIds, threshold: collation.missingData.threshold, exactMissingRates: null, selectedCellMissingnessClaim: "not-evaluated" },
    witnesses,
    readingSites: collation.readingSites.map((site) => ({ ...site, evidenceState: "selected-collation-and-published-analysis", createsAncestry: false })),
    quantitativeProfiles: { bGroupVariantTotal: 222, correctionProfile: collation.correctionProfile, witnessCounts: witnesses.map((witness) => ({ witnessId: witness.id, bGroupVariantCount: witness.bGroupVariantCount, cx2CorrectionProfileAgreementCount: witness.cx2CorrectionProfileAgreementCount })) },
    scholarlyClaims: claims.claims,
    transmission: { unresolvedExemplars: claims.entities, relations: claims.transmissionRelations },
    agreementComparisons: buildAgreementComparisons(witnesses, profile.comparisonPairs),
    reconstruction: { method: "attributed published analysis with bounded source projection", status: "partial", supportedHistorySetState: "partial", actualPastClaim: false, centralRootingResolved: false, candidateHistories: [], multipleSourceCases: [{ target: "Cx2", inputRelationIds: ["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2"], relationLayersDistinct: true, treeCompatible: false, unresolvedSourceIds: ["better-copy"], evidenceState: "published-analysis-supported" }], treeDistortionClaimId: "claim-tree-distortion", rootUncertaintyClaimId: "claim-rooting-uncertainty" },
    evidenceAblation: ablations,
    historyEquivalence: { regimes: profile.equivalenceRegimes, comparisons },
    historicalLoad: profile.historicalLoad,
    evidenceBoundary: { observed: "The NEXUS collation records witness readings; the committed reading slice is a bounded projection.", derived: "Selected-site agreement and exact equivalence verdicts are deterministic analysis artifacts.", reconstructed: "Every transmission relation is attributed to the published analysis and remains non-observed.", unknown: "The better copy's exact identity and the central rooting remain unresolved.", nonClaims: profile.nonClaims }
  };
  return verifySemantics(Object.freeze({ ...withoutIdentity, caseIdentity: hashCanonical(CASE_DOMAIN, withoutIdentity) }));
}

export async function run({ verify = false } = {}) {
  const artifact = await buildManuscriptStemmaticsCase(); const expected = serialize(artifact);
  if (verify) assert.equal(await readFile(OUTPUT, "utf8"), expected, "committed Manuscript Stemmatics artifact differs");
  else { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, expected); }
  console.log(`${verify ? "Verified" : "Built"} Manuscript Stemmatics ${artifact.caseIdentity}: ${artifact.selection.witnessCount} witnesses, ${artifact.readingSites.length} reading sites, ${artifact.transmission.relations.length} attributed relations.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify"); if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`); run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; }); }
