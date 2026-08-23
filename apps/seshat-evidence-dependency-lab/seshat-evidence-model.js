const APPROVED_CASE_IDENTITY = "sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a";
const APPROVED_SOURCE_IDENTITY = "sha256:e73b305e53e41b28835d4bf141c0ade909a218f95ac21cfd8f5ce292afe4e96d";
const POLITY_IDS = Object.freeze(["eg_old_k_1", "it_roman_principate", "us_emergent_mississippian_2"]);
const SUPPORT_ROOTS = Object.freeze([
  "sha256:2dd92cf6477643f6c3a4d934f4981513334afdc7d7f8c1fa053c519e704ccdb6",
  "sha256:c2cec7ad97b8441732eb5b4ef7101ae5d90e8ccd4d8538d8ed93f87726119489",
  "sha256:793d07132f0e473711629ff4372b2df5d1b790333ed0568f6892fc13d3c69687"
]);

function fail(message) { throw new TypeError(`Seshat Evidence Dependency artifact rejected: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

function closureFor(graph, rootNodeId) {
  const known = new Set(graph.nodes.map(({ id }) => id));
  if (!known.has(rootNodeId)) fail(`unknown root ${rootNodeId}`);
  const incoming = new Map(graph.nodes.map(({ id }) => [id, []]));
  for (const edge of graph.edges) incoming.get(edge.to).push(edge);
  const nodeIds = new Set([rootNodeId]);
  const queue = [rootNodeId];
  while (queue.length > 0) {
    for (const edge of incoming.get(queue.shift())) {
      if (!nodeIds.has(edge.from)) { nodeIds.add(edge.from); queue.push(edge.from); }
    }
  }
  return freeze({
    nodes: graph.nodes.filter(({ id }) => nodeIds.has(id)),
    edges: graph.edges.filter(({ from, to }) => nodeIds.has(from) && nodeIds.has(to)),
    groups: graph.groups.filter(({ memberNodeIds }) => memberNodeIds.some((id) => nodeIds.has(id)))
  });
}

export function createSeshatEvidenceModel(input) {
  if (!object(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-seshat-epistemic-provenance-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "polaris-2026-road-three-polity-v1") fail("format or version differs");
  if (artifact.caseIdentity !== APPROVED_CASE_IDENTITY || artifact.source?.identity !== APPROVED_SOURCE_IDENTITY || artifact.source.sourceProjectionIdentity !== "sha256:77cb429b835559740fbd129e65937bcadd4cb67e189f3633cc917e3a95696ba4" || artifact.source.authorityProjectionIdentity !== "sha256:ffe5ea70a4887cb9b6744bc6a8d212fbdfc6f878ef575ebe3ca2597195fc4687") fail("case or source release differs");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.snapshotRelease !== "Polaris-2026" || artifact.source.polarisWorkbookIdentity !== "sha256:cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41") fail("source lock differs");
  if (artifact.source.codebookVersion !== "4.20.2021" || artifact.source.codebookIdentity !== "sha256:31442ad457955c768a67a5eb4675f8e4cbf23616dcc1f1fc1cfabae05482601d" || artifact.source.publicDataLicense !== "CC BY-SA 4.0" || artifact.source.publicDataTermsIdentity !== "sha256:0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321") fail("Codebook or public-data license boundary differs");
  if (artifact.variable?.exactNativeCode !== "P" || artifact.variable.mappedApiValue !== "present" || artifact.variable.polityCount !== 3 || !Array.isArray(artifact.claims) || artifact.claims.length !== 3 || !same(artifact.claims.map(({ polityId }) => polityId), POLITY_IDS)) fail("claim inventory differs");
  if (!artifact.claims.every((claim) => claim.exactNativeCode === "P" && claim.mappedApiValue === "present") || !same(artifact.claims.map(({ support }) => support.supportRootHash), SUPPORT_ROOTS)) fail("native or support identity differs");
  if (artifact.identityComparison?.allNativeValuesEqual !== true || artifact.identityComparison.allExactSupportIdentitiesEqual !== false || artifact.identityComparison.pairs?.length !== 3 || artifact.identityComparison.pairs.some((pair) => !pair.sameExactNativeCode || !pair.sameMappedValue || pair.sameExactSupportIdentity)) fail("identity comparison boundary differs");
  if (artifact.supportGraph?.format !== "onto2d-support-dependency-dag" || artifact.supportGraph.nodes?.length !== 22 || artifact.supportGraph.edges?.length !== 25 || artifact.supportGraph.groups?.length !== 18 || artifact.supportGraph.edges.some(({ dependencyMode }) => dependencyMode !== "required")) fail("support graph boundary differs");
  if (new Set(artifact.supportGraph.nodes.map(({ id }) => id)).size !== 22 || new Set(artifact.supportGraph.edges.map(({ id }) => id)).size !== 25 || new Set(artifact.supportGraph.groups.map(({ id }) => id)).size !== 18) fail("support graph identities are not unique");
  const forbiddenGroups = new Set(["ResearchAssistant", "Expert", "Reviewer", "ReviewEpisode"]);
  if (artifact.supportGraph.groups.some(({ type }) => forbiddenGroups.has(type)) || artifact.claims.some((claim) => claim.support.minimumGroupCuts.researchAssistant.value !== null || claim.support.minimumGroupCuts.expert.value !== null || claim.support.minimumGroupCuts.reviewEpisode.value !== null || claim.support.firstCategoricalFlips.researchAssistant.value !== null || claim.support.firstCategoricalFlips.expert.value !== null || claim.support.firstCategoricalFlips.reviewEpisode.value !== null)) fail("unknown public actor or review metadata was promoted");
  if (artifact.claims.some((claim) => claim.support.firstCategoricalFlips.sourceWork.value !== claim.support.minimumGroupCuts.sourceWork.value || claim.support.firstCategoricalFlips.sourceWork.kind !== "categorical-value" || claim.support.firstCategoricalFlips.sourceWork.baselineValue !== "present" || (claim.support.firstCategoricalFlips.sourceWork.value === 1 && (claim.support.firstCategoricalFlips.sourceWork.perturbedValue !== null || claim.support.firstCategoricalFlips.sourceWork.response !== "unresolved")))) fail("first categorical flip boundary differs");
  if (artifact.typeSystem?.axesAreIndependent !== true || artifact.typeSystem.evidenceBasisUsedForClaims !== "UnknownBasis" || artifact.typeSystem.reviewStatusUsedForClaims !== "unknown" || artifact.typeSystem.agreementStatusUsedForClaims !== "unknown") fail("epistemic axes boundary differs");
  if (!Array.isArray(artifact.stressAnalyses) || artifact.stressAnalyses.length !== 4 || artifact.stressAnalyses.some((analysis) => analysis.supportGroupType !== "SourceWork" || analysis.rawResponse?.baseline !== "Resolved" || analysis.rawResponse.perturbed !== "Unknown" || analysis.threshold !== null || analysis.qualitativeLabel !== null || analysis.sourceGraphMutated !== false)) fail("raw ablation boundary differs");
  if (artifact.methodology?.pcaPerformed || artifact.methodology?.imputationPerformed || artifact.methodology?.qualitativeStabilityLabelsAssigned || artifact.methodology?.stressOutputsUsedForSelection || artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("analysis boundary differs");
  if (artifact.dataAvailability?.publicBoundary !== true || artifact.audit?.researchAssistantGroupsInvented || artifact.audit.expertGroupsInvented || artifact.audit.reviewEpisodeGroupsInvented || artifact.audit.sourceMutationsDuringAblation) fail("public-data firewall differs");

  const claims = new Map(artifact.claims.map((claim) => [claim.polityId, claim]));
  const nodes = new Map(artifact.supportGraph.nodes.map((node) => [node.id, node]));
  const stressByGroup = new Map(artifact.stressAnalyses.map((analysis) => [`${analysis.polityId}:${analysis.supportGroupId}`, analysis]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    source: artifact.source,
    methodology: artifact.methodology,
    variable: artifact.variable,
    polityIds: POLITY_IDS,
    claims: artifact.claims,
    graph: artifact.supportGraph,
    comparison: artifact.identityComparison,
    stresses: artifact.stressAnalyses,
    availability: artifact.dataAvailability,
    historicalLoad: artifact.historicalLoad,
    limitations: artifact.limitations,
    audit: artifact.audit,
    claim(polityId) { const claim = claims.get(String(polityId)); if (!claim) fail(`unknown polity ${polityId}`); return claim; },
    node(nodeId) { const node = nodes.get(String(nodeId)); if (!node) fail(`unknown node ${nodeId}`); return node; },
    support(polityId) { return closureFor(artifact.supportGraph, this.claim(polityId).rootNodeId); },
    sourceWorkGroups(polityId) { return this.support(polityId).groups.filter(({ type }) => type === "SourceWork"); },
    ablation(polityId, groupId) { const analysis = stressByGroup.get(`${polityId}:${groupId}`); if (!analysis) fail(`no public source-work ablation ${polityId}:${groupId}`); return analysis; }
  });
}
