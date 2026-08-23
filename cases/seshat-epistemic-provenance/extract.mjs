import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";
import {
  AgreementStatus,
  ArtifactKind,
  DerivationOperation,
  EvidenceBasis,
  Precision,
  ResolutionState,
  ReviewStatus,
  SupportGroupType,
  createNativeSeshatTimeBounds,
  createEpistemicArtifact,
  createSupportGroup,
  directlyAttestsResolvedCategoricalValue,
  parseNativeSeshatCode,
  roundTripNativeSeshatCode,
  roundTripNativeSeshatTimeBounds
} from "./lib/epistemic-model.mjs";
import {
  SUPPORT_MAPPING_DOMAIN,
  ablateSupportGroup,
  createSupportDag,
  exactSupportIdentity,
  firstCategoricalFlip,
  minimumGroupCutToUnresolve,
  supportComposition,
  transitiveSupportClosure
} from "./lib/support-dag.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, "artifacts", "seshat-epistemic-provenance.json");
const CASE_DOMAIN = "onto2d:seshat-epistemic-provenance-case:v1";
const SOURCE_DOMAIN = "onto2d:seshat-epistemic-provenance-source:v1";
const CLAIM_DOMAIN = "onto2d:seshat-coding-claim:v1";
const NATIVE_RECORD_DOMAIN = "onto2d:seshat-native-record:v1";
const API_RECORD_DOMAIN = "onto2d:seshat-api-record:v1";
const NARRATIVE_DOMAIN = "onto2d:seshat-narrative:v1";
const REFERENCE_DOMAIN = "onto2d:seshat-inline-reference:v1";
const SOURCE_WORK_DOMAIN = "onto2d:seshat-source-work:v1";
const COMPARISON_DOMAIN = "onto2d:seshat-claim-comparison:v1";
const APPROVED_CASE_IDENTITY = "sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a";
const POLITY_IDS = Object.freeze(["eg_old_k_1", "it_roman_principate", "us_emergent_mississippian_2"]);

function fail(message) { throw new Error(`Seshat Epistemic Provenance extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} must be unique`); return values; }

async function loadBytes(relative, maximumBytes = 1024 * 1024) {
  const bytes = await readFile(path.join(ROOT, relative));
  if (bytes.length < 1 || bytes.length > maximumBytes) fail(`${relative} is empty or exceeds ${maximumBytes} bytes`);
  return { relative, bytes };
}

async function loadJson(relative) {
  const input = await loadBytes(relative);
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)); } catch { fail(`${relative} is not valid UTF-8 JSON`); }
  return { ...input, value };
}

function validateUpstream(upstream, inputsByPath) {
  if (upstream?.format !== "onto2d-seshat-epistemic-provenance-upstream-lock" || upstream.formatVersion !== "1" || upstream.caseVersion !== "polaris-2026-road-three-polity-v1" || upstream.liveNetworkRequiredByBuild !== false) fail("upstream release boundary differs");
  const sources = new Map((upstream.sources ?? []).map((source) => [source.id, source]));
  if (sources.get("polaris-2026")?.commit !== "55ca5fbc2b563ddbbc1a3413071d4bd243d0a5fa" || sources.get("polaris-2026").sha256 !== "cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41" || sources.get("seshat-public-api")?.serverCodeCommit !== "9e812bcdbdfe5bb3e87e7a2588d2bcb9a2dc78f0" || sources.get("seshat-api-serializer")?.sha256 !== "3571ba8fab32d62ca57bd2052d7da1e67431f90b36947b222dc421a4fab3251f" || sources.get("seshat-codebook-4.20.2021")?.sha256 !== "31442ad457955c768a67a5eb4675f8e4cbf23616dcc1f1fc1cfabae05482601d" || sources.get("seshat-public-data-terms")?.sha256 !== "0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321") fail("upstream source authority differs");
  for (const locked of upstream.inputs ?? []) {
    const input = inputsByPath.get(locked.path);
    if (!input || input.bytes.length !== locked.bytes || sha256(input.bytes) !== locked.sha256) fail(`${locked.path} byte lock differs`);
  }
  if (upstream.licenseBoundary?.repositoryCodeLicense !== "MIT" || upstream.licenseBoundary?.publicDataLicense !== "CC BY-SA 4.0" || typeof upstream.licenseBoundary.policy !== "string") fail("license boundary differs");
  return upstream;
}

function validateAuthority(authority) {
  if (authority?.format !== "onto2d-seshat-authority-boundary" || authority.formatVersion !== "1") fail("source authority projection differs");
  if (authority.codebook?.version !== "4.20.2021" || authority.codebook.sha256 !== "31442ad457955c768a67a5eb4675f8e4cbf23616dcc1f1fc1cfabae05482601d" || authority.codebook.bytes !== 11149295) fail("Codebook lock differs");
  if (authority.publicDataTerms?.license !== "CC BY-SA 4.0" || authority.publicDataTerms.capturedResponseSha256 !== "0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321" || authority.publicDataTerms.capturedResponseBytes !== 27270) fail("public-data terms lock differs");
  if (authority.repositoryBoundary?.license !== "MIT" || authority.repositoryBoundary.commit !== "55ca5fbc2b563ddbbc1a3413071d4bd243d0a5fa") fail("repository license boundary differs");
  return authority;
}

function validateProfile(profile) {
  if (profile?.format !== "onto2d-seshat-mvp-selection-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "polaris-2026-road-three-polity-v1" || profile.frozenBeforeStressComputation !== true || profile.stressOutputsUsedForSelection !== false) fail("selection profile differs");
  if (!same([...profile.candidatePolityIds].sort(), [...POLITY_IDS].sort()) || profile.selectedVariable?.polarisName !== "road" || profile.selectedVariable.apiName !== "Road") fail("selected cohort or variable differs");
  if (!POLITY_IDS.every((id) => profile.selectedVariable.nativeCodesByPolity[id] === "P") || profile.nativeMapping?.apiValue !== "present" || profile.nativeMapping.resolutionState !== ResolutionState.Resolved || profile.nativeMapping.derivationOperation !== DerivationOperation.DirectCoding) fail("native mapping differs");
  const entries = profile.sourceWorkMapping?.entries;
  if (!Array.isArray(entries) || entries.length !== 5) fail("source-work mapping inventory differs");
  unique(entries.map(({ rawReference }) => rawReference), "source-work raw references");
  return profile;
}

function validateAvailability(availability) {
  if (availability?.format !== "onto2d-seshat-data-availability-probe" || availability.formatVersion !== "1" || availability.publicBoundary !== true) fail("data-availability boundary differs");
  const statusByCapability = Object.fromEntries(availability.results.map(({ capability, status }) => [capability, status]));
  if (statusByCapability["native-code"] !== "available" || statusByCapability["source-work-identity"] !== "partial" || statusByCapability["per-datapoint-research-assistant"] !== "unavailable-publicly" || statusByCapability["per-datapoint-expert"] !== "unavailable-publicly" || statusByCapability["review-status-or-event"] !== "unavailable-publicly") fail("public provenance capability status differs");
  return availability;
}

function parseReferencePayloads(description) {
  const references = [];
  const pattern = /\u00a7REF\u00a7([\s\S]*?)\u00a7REF\u00a7/g;
  let match;
  while ((match = pattern.exec(description)) !== null) references.push({ rawReference: match[1], start: match.index, end: pattern.lastIndex });
  return references;
}

function validateSource(source, profile) {
  if (source?.format !== "onto2d-seshat-road-source-snapshot" || source.formatVersion !== "1" || source.snapshotRelease?.name !== "Polaris-2026" || source.snapshotRelease.commit !== "55ca5fbc2b563ddbbc1a3413071d4bd243d0a5fa" || source.apiSnapshot?.serverCodeCommit !== "9e812bcdbdfe5bb3e87e7a2588d2bcb9a2dc78f0") fail("source snapshot boundary differs");
  if (source.snapshotRelease.repositoryCodeLicense !== "MIT" || source.snapshotRelease.publicDataLicense !== "CC BY-SA 4.0" || source.snapshotRelease.publicDataTermsCaptureSha256 !== "0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321") fail("source license projection differs");
  const rows = source.snapshotRelease.rows;
  const records = source.apiSnapshot.records;
  if (!Array.isArray(rows) || rows.length !== 3 || !Array.isArray(records) || records.length !== 3) fail("source record census differs");
  unique(rows.map(({ polity_id }) => polity_id), "Polaris polity ids");
  unique(records.map(({ polity }) => polity.name), "API polity ids");
  const mappingReferences = new Set(profile.sourceWorkMapping.entries.map(({ rawReference }) => rawReference));
  const observedReferences = [];
  for (const polityId of POLITY_IDS) {
    const row = rows.find(({ polity_id: id }) => id === polityId);
    const record = records.find(({ polity }) => polity.name === polityId);
    if (!row || !record || row.section !== "sc" || row.variable_name !== "road" || row.value_from !== "P" || row.value_to !== null || row.is_disputed || row.is_uncertain) fail(`${polityId} native row differs`);
    if (record.name !== "Road" || record.road !== "present" || record.is_disputed || record.is_uncertain || typeof record.description !== "string" || record.description.length === 0) fail(`${polityId} API row differs`);
    const rowTime = createNativeSeshatTimeBounds({ yearFrom: row.year_from, yearTo: row.year_to });
    const recordTime = createNativeSeshatTimeBounds({ yearFrom: record.year_from, yearTo: record.year_to });
    const polityTime = createNativeSeshatTimeBounds({ yearFrom: record.polity.start_year, yearTo: record.polity.end_year });
    roundTripNativeSeshatTimeBounds(rowTime);
    roundTripNativeSeshatTimeBounds(recordTime);
    roundTripNativeSeshatTimeBounds(polityTime);
    observedReferences.push(...parseReferencePayloads(record.description).map(({ rawReference }) => rawReference));
  }
  if (!same([...new Set(observedReferences)].sort(), [...mappingReferences].sort())) fail("inline reference mapping does not exactly cover the source snapshot");
  return source;
}

function evidenceNode({ id, subtype, nativeIdentity, labels }) {
  return createEpistemicArtifact({
    id,
    artifactKind: ArtifactKind.EvidenceArtifact,
    artifactSubtype: subtype,
    nativeIdentity,
    claimIdentity: null,
    derivationOperation: null,
    resolutionState: null,
    evidenceBasis: EvidenceBasis.UnknownBasis,
    reviewStatus: ReviewStatus.Unknown,
    agreementStatus: AgreementStatus.Unknown,
    precision: Precision.Unknown,
    mappingIdentity: null,
    labels
  });
}

function edge(id, from, to, semanticType) { return { id, from, to, semanticType, dependencyMode: "required" }; }

function graphDepth(graph, rootNodeId) {
  const closure = transitiveSupportClosure(graph, rootNodeId);
  const distance = new Map(closure.nodeIds.map((id) => [id, 0]));
  const relevant = graph.edges.filter(({ id }) => closure.edgeIds.includes(id));
  for (let pass = 0; pass < closure.nodeIds.length; pass += 1) {
    for (const candidate of relevant) distance.set(candidate.to, Math.max(distance.get(candidate.to), distance.get(candidate.from) + 1));
  }
  return distance.get(rootNodeId);
}

function buildGraph(source, profile, mappingIdentity) {
  const nodes = [];
  const edges = [];
  const groups = [];
  const claims = [];
  const sourceWorkNodes = new Map();
  const sourceWorkGroups = new Map();
  const sourceWorkByRawReference = new Map(profile.sourceWorkMapping.entries.map((entry) => [entry.rawReference, entry]));

  for (const polityId of POLITY_IDS) {
    const row = source.snapshotRelease.rows.find(({ polity_id: id }) => id === polityId);
    const record = source.apiSnapshot.records.find(({ polity }) => polity.name === polityId);
    const parsedNative = parseNativeSeshatCode(row.value_from);
    if (roundTripNativeSeshatCode(parsedNative) !== row.value_from || !directlyAttestsResolvedCategoricalValue(parsedNative, record.road)) fail(`${polityId} native code does not round-trip to a directly attested API value`);
    const claimIdentity = hashCanonical(CLAIM_DOMAIN, { profileVersion: profile.profileVersion, polityId, variable: "Road", nativeCode: row.value_from, mappingIdentity });
    const claimNodeId = `claim:${polityId}:road`;
    const nativeNodeId = `native-record:${polityId}:road`;
    const apiNodeId = `api-record:${polityId}:road`;
    const narrativeNodeId = `narrative:${polityId}:road`;
    nodes.push(evidenceNode({ id: nativeNodeId, subtype: "PolarisWorkbookRow", nativeIdentity: hashCanonical(NATIVE_RECORD_DOMAIN, row), labels: { polityId, sheet: source.snapshotRelease.sheet, sheetRow: row.sheetRow, variableName: row.variable_name, exactNativeCode: row.value_from, disputeFlag: row.is_disputed, uncertaintyFlag: row.is_uncertain } }));
    nodes.push(evidenceNode({ id: apiNodeId, subtype: "SeshatPublicApiRecord", nativeIdentity: hashCanonical(API_RECORD_DOMAIN, record), labels: { polityId, apiRecordId: record.id, variableName: record.name, apiValue: record.road, tag: record.tag, tagMeaning: "Confident qualifier; not a coder identity", comment: record.comment } }));
    nodes.push(evidenceNode({ id: narrativeNodeId, subtype: "PublicCodingNarrative", nativeIdentity: hashCanonical(NARRATIVE_DOMAIN, { apiRecordId: record.id, description: record.description }), labels: { polityId, exactText: record.description } }));
    nodes.push(createEpistemicArtifact({
      id: claimNodeId,
      artifactKind: ArtifactKind.CodingClaim,
      artifactSubtype: "SeshatCategoricalCodingClaim",
      nativeIdentity: claimIdentity,
      claimIdentity,
      derivationOperation: parsedNative.derivationOperation,
      resolutionState: parsedNative.resolutionState,
      evidenceBasis: EvidenceBasis.UnknownBasis,
      reviewStatus: ReviewStatus.Unknown,
      agreementStatus: AgreementStatus.Unknown,
      precision: Precision.Exact,
      mappingIdentity,
      labels: { polityId, polityName: record.polity.long_name, period: { startYear: record.polity.start_year, endYear: record.polity.end_year }, variableName: "Road", exactNativeCode: row.value_from, mappedApiValue: record.road }
    }));
    edges.push(edge(`edge:${nativeNodeId}:records-native-code`, nativeNodeId, claimNodeId, "records-native-code"));
    edges.push(edge(`edge:${apiNodeId}:records-api-value`, apiNodeId, claimNodeId, "records-api-value"));
    edges.push(edge(`edge:${apiNodeId}:exports-narrative`, apiNodeId, narrativeNodeId, "exports-narrative"));
    edges.push(edge(`edge:${narrativeNodeId}:supports-coding-rationale`, narrativeNodeId, claimNodeId, "supports-coding-rationale"));
    groups.push(createSupportGroup({ id: `group:source-record:polaris:${polityId}`, type: SupportGroupType.SourceRecord, label: `${record.polity.long_name}: Polaris row`, memberNodeIds: [nativeNodeId] }));
    groups.push(createSupportGroup({ id: `group:source-record:api:${polityId}`, type: SupportGroupType.SourceRecord, label: `${record.polity.long_name}: API record`, memberNodeIds: [apiNodeId] }));
    groups.push(createSupportGroup({ id: `group:narrative:${polityId}`, type: SupportGroupType.Narrative, label: `${record.polity.long_name}: public narrative`, memberNodeIds: [narrativeNodeId] }));

    const references = parseReferencePayloads(record.description);
    references.forEach(({ rawReference, start, end }, index) => {
      const mapping = sourceWorkByRawReference.get(rawReference);
      const occurrence = index + 1;
      const referenceNodeId = `reference:${polityId}:${record.id}:${occurrence}`;
      const sourceWorkNodeId = mapping.sourceWorkId;
      nodes.push(evidenceNode({ id: referenceNodeId, subtype: "InlineReferenceRecord", nativeIdentity: hashCanonical(REFERENCE_DOMAIN, { apiRecordId: record.id, occurrence, rawReference, start, end }), labels: { polityId, apiRecordId: record.id, occurrence, rawReference, characterSpan: { start, end }, mappingVersion: profile.sourceWorkMapping.mappingVersion } }));
      groups.push(createSupportGroup({ id: `group:source-record:reference:${polityId}:${occurrence}`, type: SupportGroupType.SourceRecord, label: `${record.polity.long_name}: reference ${occurrence}`, memberNodeIds: [referenceNodeId] }));
      if (!sourceWorkNodes.has(sourceWorkNodeId)) {
        const workNode = evidenceNode({ id: sourceWorkNodeId, subtype: "LocallyMappedSourceWork", nativeIdentity: hashCanonical(SOURCE_WORK_DOMAIN, { sourceWorkId: mapping.sourceWorkId, label: mapping.label, mappingVersion: profile.sourceWorkMapping.mappingVersion }), labels: { sourceWorkId: mapping.sourceWorkId, label: mapping.label, identityScope: "explicit-local-mapping-not-native-seshat-stable-id", mappingVersion: profile.sourceWorkMapping.mappingVersion } });
        sourceWorkNodes.set(sourceWorkNodeId, workNode);
        sourceWorkGroups.set(sourceWorkNodeId, createSupportGroup({ id: `group:${sourceWorkNodeId}`, type: SupportGroupType.SourceWork, label: mapping.label, memberNodeIds: [sourceWorkNodeId] }));
      }
      edges.push(edge(`edge:${sourceWorkNodeId}:${referenceNodeId}`, sourceWorkNodeId, referenceNodeId, "identifies-source-work-for-reference"));
      edges.push(edge(`edge:${referenceNodeId}:${narrativeNodeId}`, referenceNodeId, narrativeNodeId, "cited-by-narrative"));
    });
    claims.push({ polityId, polityName: record.polity.long_name, rootNodeId: claimNodeId, claimIdentity, exactNativeCode: row.value_from, mappedApiValue: record.road, narrative: record.description, inlineReferenceCount: references.length });
  }
  nodes.push(...sourceWorkNodes.values());
  groups.push(...sourceWorkGroups.values());
  const comparisonNodeId = "derived:road-three-polity-comparison";
  const comparisonIdentity = hashCanonical(COMPARISON_DOMAIN, { claimIdentities: claims.map(({ claimIdentity }) => claimIdentity).sort(), operation: DerivationOperation.DeterministicDerivation });
  nodes.push(createEpistemicArtifact({ id: comparisonNodeId, artifactKind: ArtifactKind.DerivedArtifact, artifactSubtype: "ThreePolityCodingComparison", nativeIdentity: comparisonIdentity, claimIdentity: null, derivationOperation: DerivationOperation.DeterministicDerivation, resolutionState: ResolutionState.Resolved, evidenceBasis: EvidenceBasis.UnknownBasis, reviewStatus: ReviewStatus.Unknown, agreementStatus: AgreementStatus.Unknown, precision: Precision.Exact, mappingIdentity, labels: { variableName: "Road", polityCount: 3 } }));
  for (const claim of claims) edges.push(edge(`edge:${claim.rootNodeId}:${comparisonNodeId}`, claim.rootNodeId, comparisonNodeId, "input-to-deterministic-comparison"));
  return { graph: createSupportDag({ nodes, edges, groups, mappingIdentities: [mappingIdentity] }), claims, comparisonNodeId, comparisonIdentity };
}

function describeClaimSupport(graph, claim) {
  const exact = exactSupportIdentity(graph, claim.rootNodeId);
  const closure = transitiveSupportClosure(graph, claim.rootNodeId);
  const workGroups = graph.groups.filter(({ id, type }) => type === SupportGroupType.SourceWork && closure.groupIds.includes(id));
  const sourceWorkReferenceCounts = workGroups.map((group) => {
    const workNodeId = group.memberNodeIds[0];
    return graph.edges.filter(({ from, semanticType, id }) => from === workNodeId && semanticType === "identifies-source-work-for-reference" && closure.edgeIds.includes(id)).length;
  });
  return {
    supportRootHash: exact.supportRootHash,
    canonicalBytes: exact.canonicalBytes,
    composition: supportComposition(graph, claim.rootNodeId),
    metrics: {
      supportNodeCount: closure.nodeIds.length,
      supportEdgeCount: closure.edgeIds.length,
      supportGroupCount: closure.groupIds.length,
      uniqueSourceWorkGroupCount: workGroups.length,
      inlineReferenceRecordCount: claim.inlineReferenceCount,
      maximumReferencesPerSourceWork: sourceWorkReferenceCounts.length === 0 ? 0 : Math.max(...sourceWorkReferenceCounts),
      dependencyDepth: graphDepth(graph, claim.rootNodeId)
    },
    minimumGroupCuts: {
      sourceWork: minimumGroupCutToUnresolve(graph, claim.rootNodeId, SupportGroupType.SourceWork),
      researchAssistant: minimumGroupCutToUnresolve(graph, claim.rootNodeId, SupportGroupType.ResearchAssistant),
      expert: minimumGroupCutToUnresolve(graph, claim.rootNodeId, SupportGroupType.Expert),
      reviewEpisode: minimumGroupCutToUnresolve(graph, claim.rootNodeId, SupportGroupType.ReviewEpisode)
    },
    firstCategoricalFlips: {
      sourceWork: firstCategoricalFlip(graph, claim.rootNodeId, SupportGroupType.SourceWork),
      researchAssistant: firstCategoricalFlip(graph, claim.rootNodeId, SupportGroupType.ResearchAssistant),
      expert: firstCategoricalFlip(graph, claim.rootNodeId, SupportGroupType.Expert),
      reviewEpisode: firstCategoricalFlip(graph, claim.rootNodeId, SupportGroupType.ReviewEpisode)
    }
  };
}

function sourceWorkStressAnalyses(graph, claims) {
  const analyses = [];
  for (const claim of claims) {
    const closure = transitiveSupportClosure(graph, claim.rootNodeId);
    const groups = graph.groups.filter(({ type, id }) => type === SupportGroupType.SourceWork && closure.groupIds.includes(id));
    for (const group of groups) {
      const perturbed = ablateSupportGroup(graph, group.id);
      const rootRetained = perturbed.graph.nodes.some(({ id }) => id === claim.rootNodeId);
      analyses.push({
        id: `ablation:${claim.polityId}:${group.id}`,
        polityId: claim.polityId,
        supportRootNodeId: claim.rootNodeId,
        supportGroupId: group.id,
        supportGroupType: group.type,
        operation: perturbed.operation,
        dependencySemantics: "required-conjunctive-transitive-removal",
        baseline: { exactNativeCode: claim.exactNativeCode, mappedValue: claim.mappedApiValue, resolutionState: ResolutionState.Resolved, rootRetained: true },
        perturbation: { removedNodeIds: perturbed.removedNodeIds, removedEdgeIds: perturbed.removedEdgeIds, exactNativeCode: null, mappedValue: null, resolutionState: ResolutionState.Unknown, rootRetained },
        rawResponse: { kind: "categorical-resolution", baseline: ResolutionState.Resolved, perturbed: ResolutionState.Unknown },
        threshold: null,
        qualitativeLabel: null,
        sourceGraphMutated: perturbed.sourceGraphMutated
      });
      if (rootRetained || perturbed.sourceGraphMutated) fail(`${claim.polityId} source-work ablation did not unresolve without mutation`);
    }
  }
  return analyses;
}

function identityComparison(claims) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const left = claims[leftIndex];
      const right = claims[rightIndex];
      pairs.push({
        leftPolityId: left.polityId,
        rightPolityId: right.polityId,
        sameExactNativeCode: left.exactNativeCode === right.exactNativeCode,
        sameMappedValue: left.mappedApiValue === right.mappedApiValue,
        sameSupportComposition: same(left.support.composition, right.support.composition),
        sameExactSupportIdentity: left.support.supportRootHash === right.support.supportRootHash
      });
    }
  }
  return {
    rule: "Exact support identity is equality of the canonical labelled support DAG, claim identity, and mapping identity; aggregate composition is descriptive only.",
    allNativeValuesEqual: pairs.every(({ sameExactNativeCode }) => sameExactNativeCode),
    allExactSupportIdentitiesEqual: pairs.every(({ sameExactSupportIdentity }) => sameExactSupportIdentity),
    pairs
  };
}

export async function buildSeshatEpistemicProvenanceCase() {
  const [upstreamInput, profileInput, availabilityInput, sourceInput, authorityInput] = await Promise.all([loadJson("upstream.json"), loadJson("selection-profile.json"), loadJson("data-availability.json"), loadJson("source/road-three-polity-source.json"), loadJson("source/authority-boundary.json")]);
  const inputsByPath = new Map([profileInput, availabilityInput, sourceInput, authorityInput].map((input) => [input.relative, input]));
  const upstream = validateUpstream(upstreamInput.value, inputsByPath);
  const profile = validateProfile(profileInput.value);
  const availability = validateAvailability(availabilityInput.value);
  const source = validateSource(sourceInput.value, profile);
  const authority = validateAuthority(authorityInput.value);
  const mappingIdentity = hashCanonical(SUPPORT_MAPPING_DOMAIN, { nativeMapping: profile.nativeMapping, sourceWorkMapping: profile.sourceWorkMapping });
  const authorityProjectionIdentity = `sha256:${sha256(authorityInput.bytes)}`;
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, { sourceProjectionIdentity: `sha256:${sha256(sourceInput.bytes)}`, authorityProjectionIdentity, polarisWorkbookIdentity: `sha256:${source.snapshotRelease.workbookSha256}`, polarisCommit: source.snapshotRelease.commit, apiServerCodeCommit: source.apiSnapshot.serverCodeCommit, mappingIdentity });
  const { graph, claims: claimSeeds, comparisonNodeId, comparisonIdentity } = buildGraph(source, profile, mappingIdentity);
  const claims = claimSeeds.map((claim) => ({ ...claim, support: describeClaimSupport(graph, claim) }));
  const comparisonSupport = exactSupportIdentity(graph, comparisonNodeId);
  const stresses = sourceWorkStressAnalyses(graph, claims);
  const basis = {
    format: "onto2d-seshat-epistemic-provenance-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    source: {
      identity: sourceIdentity,
      sourceProjectionIdentity: `sha256:${sha256(sourceInput.bytes)}`,
      sourceProjectionBytes: sourceInput.bytes.length,
      authorityProjectionIdentity,
      authorityProjectionBytes: authorityInput.bytes.length,
      retrievedAt: upstream.retrievedAt,
      snapshotRelease: source.snapshotRelease.name,
      polarisCommit: source.snapshotRelease.commit,
      polarisWorkbookIdentity: `sha256:${source.snapshotRelease.workbookSha256}`,
      apiEndpoint: source.apiSnapshot.endpoint,
      apiServerCodeCommit: source.apiSnapshot.serverCodeCommit,
      serializerIdentity: `sha256:${source.apiSnapshot.serializerSha256}`,
      codebookVersion: authority.codebook.version,
      codebookIdentity: `sha256:${authority.codebook.sha256}`,
      publicDataTermsIdentity: `sha256:${authority.publicDataTerms.capturedResponseSha256}`,
      publicDataLicense: authority.publicDataTerms.license,
      liveNetworkRequiredByBuild: false,
      authoredFiles: [upstreamInput, profileInput, availabilityInput].map((input) => ({ path: input.relative, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length })),
      snapshotFiles: [sourceInput, authorityInput].map((input) => ({ path: input.relative, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length })),
      licenseBoundary: upstream.licenseBoundary
    },
    methodology: {
      question: "Can identical historical categorical codes have distinct epistemic identities because their public support dependency structures differ?",
      selectionProfile: profile.profileVersion,
      frozenBeforeStressComputation: profile.frozenBeforeStressComputation,
      stressOutputsUsedForSelection: profile.stressOutputsUsedForSelection,
      dependencySemantics: "Every declared support edge is required. Removing a support group transitively removes all dependent artifacts; no alternative-support threshold is inferred.",
      mappingIdentity,
      mappingPolicy: profile.sourceWorkMapping.policy,
      rawOutputsOnly: true,
      pcaPerformed: false,
      imputationPerformed: false,
      qualitativeStabilityLabelsAssigned: false
    },
    dataAvailability: availability,
    typeSystem: {
      artifactKinds: Object.values(ArtifactKind),
      derivationOperations: Object.values(DerivationOperation),
      resolutionStates: Object.values(ResolutionState),
      evidenceBasisUsedForClaims: EvidenceBasis.UnknownBasis,
      reviewStatusUsedForClaims: ReviewStatus.Unknown,
      agreementStatusUsedForClaims: AgreementStatus.Unknown,
      precisionUsedForClaims: Precision.Exact,
      axesAreIndependent: true
    },
    variable: { section: "sc", polarisName: "road", apiName: "Road", exactNativeCode: "P", mappedApiValue: "present", polityCount: claims.length },
    claims,
    supportGraph: graph,
    derivedComparison: { nodeId: comparisonNodeId, identity: comparisonIdentity, supportRootHash: comparisonSupport.supportRootHash, canonicalBytes: comparisonSupport.canonicalBytes, operation: DerivationOperation.DeterministicDerivation },
    identityComparison: identityComparison(claims),
    stressAnalyses: stresses,
    historicalLoad: { status: "not-evaluated", value: null, reason: "The MVP evaluates epistemic dependency structure, not historical path dependence." },
    limitations: [
      ...profile.claimsNotMade,
      "Public Road objects do not expose per-datapoint coder, expert, or review-event identities; those group cuts remain unavailable rather than synthetic.",
      "Inline reference payloads are locally mapped to source-work groups and do not establish bibliographic completeness or independence.",
      "Required-edge ablations demonstrate the declared dependency model; they do not estimate historical truth or general robustness."
    ],
    audit: {
      polityClaimsRetained: claims.length,
      exactNativeCodesRetained: claims.filter(({ exactNativeCode }) => exactNativeCode === "P").length,
      publicNarrativesRetained: claims.filter(({ narrative }) => narrative.length > 0).length,
      inlineReferenceRecordsRetained: claims.reduce((sum, { inlineReferenceCount }) => sum + inlineReferenceCount, 0),
      mappedSourceWorkGroups: graph.groups.filter(({ type }) => type === SupportGroupType.SourceWork).length,
      researchAssistantGroupsInvented: 0,
      expertGroupsInvented: 0,
      reviewEpisodeGroupsInvented: 0,
      liveQueriesDuringBuild: 0,
      sourceMutationsDuringAblation: stresses.filter(({ sourceGraphMutated }) => sourceGraphMutated).length
    }
  };
  return Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) });
}

export function verifySeshatEpistemicProvenanceCaseIdentity(artifact, { enforceApproved = true } = {}) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) fail("artifact must be an object");
  const { caseIdentity, ...basis } = artifact;
  const computed = hashCanonical(CASE_DOMAIN, basis);
  if (caseIdentity !== computed) fail(`case identity mismatch: expected ${computed}, received ${caseIdentity}`);
  if (enforceApproved && caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved release ${APPROVED_CASE_IDENTITY}`);
  if (artifact.format !== "onto2d-seshat-epistemic-provenance-case" || artifact.caseVersion !== "polaris-2026-road-three-polity-v1" || artifact.source?.liveNetworkRequiredByBuild !== false) fail("artifact release boundary differs");
  if (artifact.claims?.length !== 3 || artifact.variable?.exactNativeCode !== "P" || artifact.variable.mappedApiValue !== "present" || artifact.identityComparison?.allNativeValuesEqual !== true || artifact.identityComparison.allExactSupportIdentitiesEqual !== false) fail("claim identity comparison differs");
  if (artifact.audit?.researchAssistantGroupsInvented || artifact.audit?.expertGroupsInvented || artifact.audit?.reviewEpisodeGroupsInvented || artifact.audit?.liveQueriesDuringBuild || artifact.audit?.sourceMutationsDuringAblation) fail("epistemic audit differs");
  if (artifact.methodology?.pcaPerformed || artifact.methodology?.imputationPerformed || artifact.methodology?.qualitativeStabilityLabelsAssigned || artifact.historicalLoad?.value !== null) fail("analysis boundary differs");
  return artifact;
}

export async function run({ verify = false, enforceApproved = true } = {}) {
  const artifact = await buildSeshatEpistemicProvenanceCase();
  if (!verify) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  const stored = JSON.parse(await readFile(OUTPUT, "utf8"));
  verifySeshatEpistemicProvenanceCaseIdentity(stored, { enforceApproved });
  assert.equal(serialize(stored), serialize(artifact));
  console.log(`${verify ? "Verified" : "Built"} Seshat Epistemic Provenance ${artifact.caseIdentity}: ${artifact.claims.length} claims, ${artifact.supportGraph.nodes.length} support nodes, ${artifact.stressAnalyses.length} raw ablations`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => !["--verify", "--print-identity"].includes(argument));
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify"), enforceApproved: !process.argv.includes("--print-identity") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
