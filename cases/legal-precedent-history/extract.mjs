import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "legal-precedent-history.json");
const CASE_DOMAIN = "onto2d:legal-precedent-case:v1";
const SOURCE_DOMAIN = "onto2d:legal-precedent-source:v1";
const CONTEXT_DOMAIN = "onto2d:legal-precedent-context:v1";
const APPROVED_CASE_IDENTITY = "sha256:158c1bb5be38b6f9e9f2cd4f32ad3a90f2d3ff20b55369067c86b590c3024691";
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const HASH = /^[0-9a-f]{64}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPINION_IDS = Object.freeze(["brown-i", "brown-ii", "cooper", "griffin", "green", "alexander", "swann"]);
const CLUSTER_IDS = Object.freeze([105221, 105312, 105766, 106825, 107705, 107993, 108316]);
const EXPECTED_PDF_HASHES = Object.freeze([
  "a638465fcfd46d5e3e968bf1e887a2a374f8fc9bf0d8cffc881d4fab7cd04eec",
  "a48d8ac6fa9ab59a886e65527b073ff3732e94b742986a7a00b351bec1cca595",
  "735e4bcb8d33eebebc4740a23cc67767e8442fd8acfb51c1357009f37c20eff6",
  "f4b9cb243df55960cb037a0d28f20a251c2d775779fa0139c0f31f69c66cb601",
  "96dbdfb35e39c6b45e4ca79d51bdde93830b2b1506040ca353ac523c5bb7c977",
  "35baa67a50b0757a8ec165f560bc8a23bc91cef9000057d36760088e8e9ec01b",
  "c8a5593e4169db6f04a3a460ed16a1ef9dbbfa2b3620050b6eb25bc586cd0805"
]);

function fail(message) { throw new Error(`Legal Precedent extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u0080-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function exactKeys(value, keys, label) { if (!isRecord(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`); }
function safePath(value, label) { if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`); return value; }
function unique(values) { return new Set(values).size === values.length; }

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

function sourceEntry(role, input) { return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length }); }

function validateUpstream(value) {
  exactKeys(value, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "sources", "snapshot", "selection"], "upstream lock");
  if (value.format !== "onto2d-legal-precedent-upstream-lock" || value.formatVersion !== "1" || value.liveNetworkRequiredByBuild !== false) fail("upstream lock version differs");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.retrievedAt)) fail("retrieval timestamp differs");
  if (!same(value.sources.map((source) => source.id), ["courtlistener", "govinfo-us-reports"])) fail("source provider inventory differs");
  for (const source of value.sources) if (!/^https:\/\//.test(source.landingPage) || !source.publisher || !source.role || !source.authorityBoundary) fail(`${source.id} attribution is incomplete`);
  if (value.snapshot.role !== "bounded-opinion-cohort" || value.snapshot.path !== "source/school-desegregation-cohort.json" || !HASH.test(value.snapshot.sha256) || !Number.isSafeInteger(value.snapshot.bytes) || !same(value.snapshot.derivedFrom, ["courtlistener", "govinfo-us-reports"])) fail("snapshot lock differs");
  if (value.selection.cohortId !== "scotus-school-desegregation-1954-1971-v1" || value.selection.courtId !== "scotus" || value.selection.opinionCount !== 7 || value.selection.targetOpinionId !== "green" || value.selection.completenessClaim !== false) fail("selection boundary differs");
  return value;
}

function validateProfile(value) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "cohortId", "targetOpinionId", "decisionDateAuthority", "availabilityRule", "expectedPriorOpinionIds", "expectedFutureOpinionIds", "normativeClaims", "counterfactual", "historicalLoad", "nonClaims"], "analysis profile");
  if (value.format !== "onto2d-legal-precedent-analysis-profile" || value.formatVersion !== "1" || value.profileVersion !== "scotus-school-desegregation-green-v1" || value.cohortId !== "scotus-school-desegregation-1954-1971-v1") fail("analysis profile version differs");
  if (value.targetOpinionId !== "green" || value.decisionDateAuthority !== "govinfo-official-decision-date" || value.availabilityRule !== "official-decision-date-strictly-before-target") fail("availability profile differs");
  if (!same(value.expectedPriorOpinionIds, ["brown-i", "brown-ii", "cooper", "griffin"]) || !same(value.expectedFutureOpinionIds, ["alexander", "swann"])) fail("time-slice inventory differs");
  if (!Array.isArray(value.normativeClaims) || value.normativeClaims.length !== 4 || !unique(value.normativeClaims.map((claim) => claim.id))) fail("normative claim inventory differs");
  for (const claim of value.normativeClaims) {
    if (claim.citingOpinionId !== "green" || !value.expectedPriorOpinionIds.includes(claim.citedOpinionId) || claim.bindingStatus !== "not-classified" || claim.claimScope !== "source-attributed-treatment" || !claim.attribution || !claim.locator || !claim.basis) fail(`${claim.id} exceeds its attributed scope`);
  }
  if (value.counterfactual.removedOpinionId !== "brown-ii" || value.counterfactual.legalConclusionAllowed !== false || value.counterfactual.sourceHistoryMutable !== false) fail("counterfactual boundary differs");
  if (value.historicalLoad.status !== "not-evaluated" || value.historicalLoad.value !== null || !/undefined must not be displayed as zero/.test(value.historicalLoad.reason)) fail("Historical Load boundary differs");
  if (!Array.isArray(value.nonClaims) || value.nonClaims.length < 12 || !unique(value.nonClaims)) fail("non-claim boundary is incomplete");
  return value;
}

function validateCohort(value) {
  exactKeys(value, ["format", "formatVersion", "cohortId", "retrievedAt", "court", "doctrinalScope", "opinions"], "source cohort");
  if (value.format !== "onto2d-courtlistener-opinion-cohort" || value.formatVersion !== "1" || value.cohortId !== "scotus-school-desegregation-1954-1971-v1") fail("source cohort version differs");
  if (value.court?.id !== "scotus" || value.court?.name !== "Supreme Court of the United States" || value.court?.hierarchyClaim !== "not-inferred") fail("court boundary differs");
  if (!Array.isArray(value.opinions) || !same(value.opinions.map((opinion) => opinion.id), OPINION_IDS)) fail("opinion order differs");
  if (!same(value.opinions.map((opinion) => opinion.courtListener.clusterId), CLUSTER_IDS) || !unique(value.opinions.map((opinion) => opinion.courtListener.opinionId))) fail("CourtListener identity inventory differs");
  if (!same(value.opinions.map((opinion) => opinion.officialDocument.sha256), EXPECTED_PDF_HASHES)) fail("official PDF byte identities differ");
  for (const opinion of value.opinions) {
    if (!/^[a-z0-9-]+$/.test(opinion.id) || !opinion.name || !opinion.shortName || !/^\d+ U\.S\. \d+$/.test(opinion.reporterCitation) || !DATE.test(opinion.officialDecisionDate)) fail(`${opinion.id} identity metadata is invalid`);
    const courtListener = opinion.courtListener;
    if (courtListener.clusterId !== courtListener.opinionId || !DATE.test(courtListener.dateFiled) || !SHA1.test(courtListener.opinionSha1) || !Number.isSafeInteger(courtListener.citeCountAtRetrieval) || courtListener.citeCountAtRetrieval < 0 || courtListener.status !== "Published" || !Array.isArray(courtListener.citedOpinionIds) || !unique(courtListener.citedOpinionIds) || courtListener.citedOpinionIds.some((id) => !Number.isSafeInteger(id))) fail(`${opinion.id} CourtListener record is invalid`);
    if (![courtListener.publicUrl, courtListener.clusterApiUrl, courtListener.opinionApiUrl].every((url) => /^https:\/\/www\.courtlistener\.com\//.test(url))) fail(`${opinion.id} CourtListener URL is invalid`);
    const official = opinion.officialDocument;
    if (official.publisher !== "U.S. Government Publishing Office" || official.collection !== "United States Reports" || !/^USREPORTS-\d+-\d+$/.test(official.packageId) || !Number.isSafeInteger(official.bytes) || official.bytes < 1 || !HASH.test(official.sha256) || !/^https:\/\/www\.govinfo\.gov\//.test(official.detailUrl) || !/^https:\/\/www\.govinfo\.gov\//.test(official.pdfUrl)) fail(`${opinion.id} GovInfo record is invalid`);
  }
  return value;
}

function buildCitationEdges(opinions) {
  const byProviderId = new Map(opinions.map((opinion) => [opinion.courtListener.opinionId, opinion]));
  const edges = [];
  for (const citing of opinions) {
    for (const citedProviderId of citing.courtListener.citedOpinionIds) {
      const cited = byProviderId.get(citedProviderId);
      if (!cited) continue;
      if (citing.id === cited.id || cited.officialDecisionDate >= citing.officialDecisionDate) fail(`${citing.id} has a non-prior cohort citation to ${cited.id}`);
      edges.push(Object.freeze({
        id: `citation:${citing.id}:${cited.id}`,
        citingOpinionId: citing.id,
        citedOpinionId: cited.id,
        relation: "cites",
        evidenceState: "courtlistener-native-record",
        providerField: "opinion.cites",
        citedProviderOpinionId: citedProviderId,
        causalDependency: "not-inferred",
        bindingStatus: "unknown",
        createsAuthority: false
      }));
    }
  }
  return edges.sort((left, right) => left.id.localeCompare(right.id));
}

function reachableFrom(startId, nodeIds, edges) {
  const allowed = new Set(nodeIds);
  const adjacency = new Map(nodeIds.map((id) => [id, []]));
  for (const edge of edges) if (allowed.has(edge.citingOpinionId) && allowed.has(edge.citedOpinionId)) adjacency.get(edge.citingOpinionId).push(edge.citedOpinionId);
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) for (const next of adjacency.get(queue.shift()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  seen.delete(startId);
  return [...seen].sort();
}

function verifySemantics(artifact) {
  if (artifact.format !== "onto2d-legal-precedent-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "scotus-school-desegregation-green-v1") fail("artifact version differs");
  const { caseIdentity, ...basis } = artifact;
  if (!IDENTITY.test(caseIdentity ?? "") || caseIdentity !== hashCanonical(CASE_DOMAIN, basis)) fail("case identity differs");
  if (artifact.source.identity !== hashCanonical(SOURCE_DOMAIN, { authoredFiles: artifact.source.authoredFiles, snapshotFiles: artifact.source.snapshotFiles, providers: artifact.source.providers })) fail("source identity differs");
  if (!same(artifact.opinions.map((opinion) => opinion.id), OPINION_IDS) || artifact.cohort.opinionCount !== 7 || artifact.cohort.completeDoctrinalCorpus !== false) fail("bounded cohort differs");
  const byId = new Map(artifact.opinions.map((opinion) => [opinion.id, opinion]));
  if (new Set(artifact.opinions.map((opinion) => opinion.courtListener.opinionId)).size !== artifact.opinions.length) fail("duplicate opinion identity");
  if (artifact.opinions.some((opinion) => opinion.courtId !== "scotus" || !DATE.test(opinion.officialDecisionDate) || !DATE.test(opinion.courtListenerDateFiled))) fail("opinion jurisdiction or date differs");
  if (artifact.citations.length !== 16 || artifact.citations.some((edge) => edge.relation !== "cites" || edge.bindingStatus !== "unknown" || edge.createsAuthority !== false)) fail("native citation boundary differs");
  if (!unique(artifact.citations.map((edge) => edge.id)) || artifact.citations.some((edge) => !byId.has(edge.citingOpinionId) || !byId.has(edge.citedOpinionId) || byId.get(edge.citedOpinionId).officialDecisionDate >= byId.get(edge.citingOpinionId).officialDecisionDate)) fail("citation chronology or identity differs");
  if (!same(artifact.availability.priorOpinionIds, ["brown-i", "brown-ii", "cooper", "griffin"]) || !same(artifact.availability.futureOpinionIds, ["alexander", "swann"]) || artifact.availability.futureInputEdgeCount !== 0 || artifact.availability.legalPredictionIncluded !== false) fail("available-at-time projection differs");
  if (artifact.availability.contextCitationEdgeIds.length !== 10 || artifact.availability.targetDirectCitationIds.length !== 4) fail("target citation context differs");
  const contextNodeIds = [...artifact.availability.priorOpinionIds, artifact.availability.targetOpinionId];
  const contextEdges = artifact.citations.filter((edge) => contextNodeIds.includes(edge.citingOpinionId) && contextNodeIds.includes(edge.citedOpinionId));
  const targetEdges = artifact.citations.filter((edge) => edge.citingOpinionId === artifact.availability.targetOpinionId);
  if (!same(artifact.availability.contextCitationEdgeIds, contextEdges.map((edge) => edge.id)) || !same(artifact.availability.targetDirectCitationIds, targetEdges.map((edge) => edge.id))) fail("time-slice edge projection differs");
  const contextBasis = { targetOpinionId: artifact.availability.targetOpinionId, cutoffDate: artifact.availability.cutoffDate, dateAuthority: artifact.availability.dateAuthority, rule: artifact.availability.rule, priorOpinionIds: artifact.availability.priorOpinionIds, contextCitationEdgeIds: artifact.availability.contextCitationEdgeIds, futureOpinionIds: artifact.availability.futureOpinionIds };
  if (artifact.availability.identity !== hashCanonical(CONTEXT_DOMAIN, contextBasis)) fail("available context identity differs");
  if (artifact.normativeClaims.length !== 4 || artifact.normativeClaims.some((claim) => claim.bindingStatus !== "not-classified" || claim.claimScope !== "source-attributed-treatment")) fail("normative layer differs");
  if (!unique(artifact.normativeClaims.map((claim) => claim.id)) || artifact.normativeClaims.some((claim) => !artifact.citations.some((edge) => edge.id === claim.citationId) || claim.inferredFromCitationCount !== false)) fail("normative attribution differs");
  if (artifact.dateDisagreements.length !== 2 || !same(artifact.dateDisagreements.map((item) => item.opinionId), ["cooper", "swann"])) fail("provider date disagreement boundary differs");
  const derivedDisagreements = artifact.opinions.filter((opinion) => opinion.officialDecisionDate !== opinion.courtListenerDateFiled).map((opinion) => opinion.id);
  if (!same(derivedDisagreements, artifact.dateDisagreements.map((item) => item.opinionId))) fail("provider date disagreement derivation differs");
  if (artifact.counterfactual.removedOpinionId !== "brown-ii" || artifact.counterfactual.sourceGraphMutated || artifact.counterfactual.legalConclusionAllowed || artifact.counterfactual.removedDerivedEdgeCount !== 4 || artifact.counterfactual.remainingDerivedEdgeCount !== 6) fail("counterfactual boundary differs");
  const counterfactualNodes = contextNodeIds.filter((id) => id !== artifact.counterfactual.removedOpinionId);
  const counterfactualEdges = contextEdges.filter((edge) => edge.citingOpinionId !== artifact.counterfactual.removedOpinionId && edge.citedOpinionId !== artifact.counterfactual.removedOpinionId);
  if (artifact.counterfactual.remainingDerivedNodeCount !== counterfactualNodes.length || artifact.counterfactual.remainingDerivedEdgeCount !== counterfactualEdges.length || artifact.counterfactual.sourceOpinionCountAfterAnalysis !== artifact.opinions.length || artifact.counterfactual.sourceCitationCountAfterAnalysis !== artifact.citations.length) fail("counterfactual counts differ");
  if (!same(artifact.counterfactual.reachableFromTargetAfterRemoval, ["brown-i", "cooper", "griffin"])) fail("counterfactual reachability differs");
  if (!same(artifact.counterfactual.reachableFromTargetAfterRemoval, reachableFrom(artifact.availability.targetOpinionId, counterfactualNodes, counterfactualEdges))) fail("counterfactual reachability derivation differs");
  if (artifact.citationVsNormativeStatus.length !== 4 || artifact.citationVsNormativeStatus.some((row) => row.bindingStatus !== "unknown" || row.authorityFromCitationCount !== false || !targetEdges.some((edge) => edge.id === row.citationId))) fail("citation versus normative-status matrix differs");
  if (artifact.audit.bindingClaims !== 0 || artifact.audit.citationCountsUsedInDerivation || artifact.audit.courtHierarchyGuessed || artifact.audit.futureInputEdges !== 0 || artifact.audit.duplicateOpinionIdentities !== 0) fail("legal safety audit differs");
  if (artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved scotus-school-desegregation-green-v1 release`);
  return artifact;
}

export function verifyLegalPrecedentCaseIdentity(input) { if (!isRecord(input)) fail("artifact must be an object"); return verifySemantics(structuredClone(input)); }

export async function buildLegalPrecedentCase() {
  const [upstreamInput, profileInput, cohortInput] = await Promise.all([load("upstream.json"), load("analysis-profile.json"), load("source/school-desegregation-cohort.json")]);
  const upstream = validateUpstream(upstreamInput.value);
  const profile = validateProfile(profileInput.value);
  const cohort = validateCohort(cohortInput.value);
  if (upstream.retrievedAt !== cohort.retrievedAt || upstream.selection.cohortId !== cohort.cohortId || profile.cohortId !== cohort.cohortId) fail("cross-file cohort identity differs");
  if (upstream.snapshot.sha256 !== sha256(cohortInput.bytes) || upstream.snapshot.bytes !== cohortInput.bytes.length) fail("source projection does not match its lock");

  const opinions = cohort.opinions.map((opinion) => Object.freeze({
    id: opinion.id,
    name: opinion.name,
    shortName: opinion.shortName,
    reporterCitation: opinion.reporterCitation,
    officialDecisionDate: opinion.officialDecisionDate,
    courtListenerDateFiled: opinion.courtListener.dateFiled,
    dateAgreement: opinion.officialDecisionDate === opinion.courtListener.dateFiled,
    courtId: cohort.court.id,
    courtName: cohort.court.name,
    courtListener: Object.freeze({
      clusterId: opinion.courtListener.clusterId,
      opinionId: opinion.courtListener.opinionId,
      opinionSha1: opinion.courtListener.opinionSha1,
      citeCountAtRetrieval: opinion.courtListener.citeCountAtRetrieval,
      publicUrl: opinion.courtListener.publicUrl
    }),
    officialDocument: Object.freeze({ ...opinion.officialDocument })
  }));
  const citations = buildCitationEdges(cohort.opinions);
  const byId = new Map(opinions.map((opinion) => [opinion.id, opinion]));
  const target = byId.get(profile.targetOpinionId);
  const priorOpinionIds = opinions.filter((opinion) => opinion.officialDecisionDate < target.officialDecisionDate).map((opinion) => opinion.id);
  const futureOpinionIds = opinions.filter((opinion) => opinion.officialDecisionDate > target.officialDecisionDate).map((opinion) => opinion.id);
  if (!same(priorOpinionIds, profile.expectedPriorOpinionIds) || !same(futureOpinionIds, profile.expectedFutureOpinionIds)) fail("derived time slice differs from profile");
  const contextNodeIds = [...priorOpinionIds, target.id];
  const contextCitationEdges = citations.filter((edge) => contextNodeIds.includes(edge.citingOpinionId) && contextNodeIds.includes(edge.citedOpinionId));
  const targetDirectCitations = citations.filter((edge) => edge.citingOpinionId === target.id);
  if (!same(targetDirectCitations.map((edge) => edge.citedOpinionId).sort(), [...priorOpinionIds].sort())) fail("target does not cite all four selected prior opinions");
  const futureInputEdges = citations.filter((edge) => byId.get(edge.citedOpinionId).officialDecisionDate > byId.get(edge.citingOpinionId).officialDecisionDate);
  const normativeClaims = profile.normativeClaims.map((claim) => {
    const citationId = `citation:${claim.citingOpinionId}:${claim.citedOpinionId}`;
    if (!citations.some((edge) => edge.id === citationId)) fail(`${claim.id} has no native citation edge`);
    return Object.freeze({ ...claim, citationId, evidenceSourceUrl: byId.get(claim.citingOpinionId).officialDocument.pdfUrl, inferredFromCitationCount: false });
  });
  const dateDisagreements = opinions.filter((opinion) => !opinion.dateAgreement).map((opinion) => Object.freeze({
    opinionId: opinion.id,
    officialDecisionDate: opinion.officialDecisionDate,
    courtListenerDateFiled: opinion.courtListenerDateFiled,
    resolution: "preserve-both-use-govinfo-for-time-slice"
  }));
  const counterfactualNodeIds = contextNodeIds.filter((id) => id !== profile.counterfactual.removedOpinionId);
  const counterfactualEdges = contextCitationEdges.filter((edge) => edge.citingOpinionId !== profile.counterfactual.removedOpinionId && edge.citedOpinionId !== profile.counterfactual.removedOpinionId);
  const source = {
    authoredFiles: [sourceEntry("upstream-lock", upstreamInput), sourceEntry("analysis-profile", profileInput)],
    snapshotFiles: [sourceEntry("bounded-opinion-cohort", cohortInput)],
    providers: upstream.sources.map((provider) => ({ id: provider.id, publisher: provider.publisher, role: provider.role, authorityBoundary: provider.authorityBoundary })),
    identity: null
  };
  source.identity = hashCanonical(SOURCE_DOMAIN, { authoredFiles: source.authoredFiles, snapshotFiles: source.snapshotFiles, providers: source.providers });
  const availabilityBasis = {
    targetOpinionId: target.id,
    cutoffDate: target.officialDecisionDate,
    dateAuthority: profile.decisionDateAuthority,
    rule: profile.availabilityRule,
    priorOpinionIds,
    contextCitationEdgeIds: contextCitationEdges.map((edge) => edge.id),
    futureOpinionIds
  };
  const availability = {
    ...availabilityBasis,
    identity: hashCanonical(CONTEXT_DOMAIN, availabilityBasis),
    targetDirectCitationIds: targetDirectCitations.map((edge) => edge.id),
    excludedFutureCitationEdgeIds: citations.filter((edge) => futureOpinionIds.includes(edge.citingOpinionId)).map((edge) => edge.id),
    futureInputEdgeCount: futureInputEdges.length,
    legalPredictionIncluded: false
  };
  const withoutIdentity = {
    format: "onto2d-legal-precedent-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    generatedBy: "cases/legal-precedent-history/extract.mjs",
    source,
    cohort: {
      id: cohort.cohortId,
      label: "Selected SCOTUS school-desegregation opinions, 1954-1971",
      courtId: cohort.court.id,
      courtName: cohort.court.name,
      jurisdiction: cohort.court.jurisdiction,
      doctrinalScope: cohort.doctrinalScope,
      opinionCount: opinions.length,
      completeDoctrinalCorpus: false,
      retrievedAt: cohort.retrievedAt
    },
    opinions,
    citations,
    availability,
    normativeClaims,
    dateDisagreements,
    counterfactual: {
      ...profile.counterfactual,
      baseDerivedNodeCount: contextNodeIds.length,
      baseDerivedEdgeCount: contextCitationEdges.length,
      removedDerivedEdgeCount: contextCitationEdges.length - counterfactualEdges.length,
      remainingDerivedNodeCount: counterfactualNodeIds.length,
      remainingDerivedEdgeCount: counterfactualEdges.length,
      reachableFromTargetBeforeRemoval: reachableFrom(target.id, contextNodeIds, contextCitationEdges),
      reachableFromTargetAfterRemoval: reachableFrom(target.id, counterfactualNodeIds, counterfactualEdges),
      sourceOpinionCountAfterAnalysis: opinions.length,
      sourceCitationCountAfterAnalysis: citations.length,
      sourceGraphMutated: false
    },
    citationVsNormativeStatus: targetDirectCitations.map((edge) => {
      const claim = normativeClaims.find((candidate) => candidate.citationId === edge.id);
      return Object.freeze({ citationId: edge.id, citedOpinionId: edge.citedOpinionId, citationRecorded: true, treatment: claim?.treatment ?? "unknown", treatmentAttribution: claim?.attribution ?? null, bindingStatus: "unknown", authorityFromCitationCount: false });
    }),
    historicalLoad: { ...profile.historicalLoad },
    audit: {
      nativeCitationEdges: citations.length,
      attributedTreatmentClaims: normativeClaims.length,
      bindingClaims: 0,
      citationCountsUsedInDerivation: false,
      courtHierarchyGuessed: false,
      futureInputEdges: futureInputEdges.length,
      duplicateOpinionIdentities: opinions.length - new Set(opinions.map((opinion) => opinion.courtListener.opinionId)).size,
      dateDisagreements: dateDisagreements.length,
      legalAdviceGenerated: false
    },
    legalDisclaimer: "Research visualization of a deliberately bounded historical record. It is not legal advice and does not determine current law, authority, or outcome.",
    nonClaims: [...profile.nonClaims]
  };
  return verifySemantics(Object.freeze({ ...withoutIdentity, caseIdentity: hashCanonical(CASE_DOMAIN, withoutIdentity) }));
}

export async function run({ verify = false } = {}) {
  const artifact = await buildLegalPrecedentCase();
  const expected = serialize(artifact);
  if (verify) assert.equal(await readFile(OUTPUT, "utf8"), expected, "committed Legal Precedent artifact differs");
  else { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, expected); }
  console.log(`${verify ? "Verified" : "Built"} Legal Precedent ${artifact.caseIdentity}: ${artifact.cohort.opinionCount} opinions, ${artifact.citations.length} native citation edges, ${artifact.normativeClaims.length} attributed treatments.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
