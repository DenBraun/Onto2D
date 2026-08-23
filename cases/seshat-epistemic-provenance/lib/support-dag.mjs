import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { ResolutionState, SupportGroupType, createEpistemicArtifact, createSupportGroup } from "./epistemic-model.mjs";

export const SUPPORT_DAG_DOMAIN = "onto2d:seshat-exact-support-dag:v1";
export const SUPPORT_MAPPING_DOMAIN = "onto2d:seshat-support-mapping:v1";

function fail(message) {
  throw new TypeError(`Seshat support DAG rejected: ${message}`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) fail(`${label} must be a normalized non-empty string`);
  return value;
}

function unique(values, label) {
  if (new Set(values).size !== values.length) fail(`${label} must be unique`);
  return values;
}

function validateEdge(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("edge must be an object");
  return deepFreeze({
    id: requiredString(input.id, "edge.id"),
    from: requiredString(input.from, "edge.from"),
    to: requiredString(input.to, "edge.to"),
    semanticType: requiredString(input.semanticType, "edge.semanticType"),
    dependencyMode: input.dependencyMode === "required" ? "required" : fail("edge.dependencyMode must be required")
  });
}

function detectCycle(nodeIds, edges) {
  const outgoing = new Map(nodeIds.map((id) => [id, []]));
  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const edge of edges) {
    outgoing.get(edge.from).push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  }
  const queue = nodeIds.filter((id) => indegree.get(id) === 0).sort();
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    visited += 1;
    for (const next of outgoing.get(current).sort()) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
    queue.sort();
  }
  if (visited !== nodeIds.length) fail("graph must be acyclic");
}

export function createSupportDag(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("graph must be an object");
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges) || !Array.isArray(input.groups)) fail("nodes, edges, and groups must be arrays");
  const nodes = input.nodes.map(createEpistemicArtifact).sort((left, right) => left.id.localeCompare(right.id));
  const edges = input.edges.map(validateEdge).sort((left, right) => left.id.localeCompare(right.id));
  const groups = input.groups.map(createSupportGroup).sort((left, right) => left.id.localeCompare(right.id));
  unique(nodes.map(({ id }) => id), "node ids");
  unique(edges.map(({ id }) => id), "edge ids");
  unique(groups.map(({ id }) => id), "group ids");
  const nodeIds = nodes.map(({ id }) => id);
  const known = new Set(nodeIds);
  for (const edge of edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) fail(`${edge.id} references an unknown node`);
    if (edge.from === edge.to) fail(`${edge.id} is a self edge`);
  }
  for (const group of groups) {
    if (group.memberNodeIds.some((id) => !known.has(id))) fail(`${group.id} references an unknown member node`);
  }
  detectCycle(nodeIds, edges);
  return deepFreeze({
    format: "onto2d-support-dependency-dag",
    formatVersion: "1",
    nodes,
    edges,
    groups,
    mappingIdentities: unique([...(input.mappingIdentities ?? [])].map((identity) => requiredString(identity, "mapping identity")), "mapping identities").sort()
  });
}

export function transitiveSupportClosure(graph, rootNodeId) {
  const root = requiredString(rootNodeId, "rootNodeId");
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodeById.has(root)) fail(`unknown root node ${root}`);
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) incoming.get(edge.to).push(edge);
  const closure = new Set([root]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of incoming.get(current).sort((left, right) => left.id.localeCompare(right.id))) {
      if (!closure.has(edge.from)) {
        closure.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  return deepFreeze({
    rootNodeId: root,
    nodeIds: [...closure].sort(),
    edgeIds: graph.edges.filter((edge) => closure.has(edge.from) && closure.has(edge.to)).map(({ id }) => id).sort(),
    groupIds: graph.groups.filter((group) => group.memberNodeIds.some((id) => closure.has(id))).map(({ id }) => id).sort()
  });
}

export function canonicalSupportDag(graph, rootNodeId) {
  const closure = transitiveSupportClosure(graph, rootNodeId);
  const nodes = graph.nodes.filter((node) => closure.nodeIds.includes(node.id)).map((node) => ({
    id: node.id,
    artifactKind: node.artifactKind,
    artifactSubtype: node.artifactSubtype,
    nativeIdentity: node.nativeIdentity,
    claimIdentity: node.claimIdentity,
    derivationOperation: node.derivationOperation,
    resolutionState: node.resolutionState,
    evidenceBasis: node.evidenceBasis,
    reviewStatus: node.reviewStatus,
    agreementStatus: node.agreementStatus,
    precision: node.precision,
    mappingIdentity: node.mappingIdentity,
    labels: node.labels
  }));
  const edges = graph.edges.filter((edge) => closure.edgeIds.includes(edge.id)).map((edge) => ({ ...edge }));
  const groups = graph.groups.filter((group) => closure.groupIds.includes(group.id)).map((group) => ({
    id: group.id,
    type: group.type,
    label: group.label,
    memberNodeIds: group.memberNodeIds.filter((id) => closure.nodeIds.includes(id)).sort()
  }));
  return deepFreeze({
    format: "onto2d-canonical-support-dag",
    formatVersion: "1",
    rootNodeId,
    nodes,
    edges,
    groups,
    mappingIdentities: [...graph.mappingIdentities]
  });
}

export function exactSupportIdentity(graph, rootNodeId) {
  const canonicalDag = canonicalSupportDag(graph, rootNodeId);
  return deepFreeze({
    supportRootHash: hashCanonical(SUPPORT_DAG_DOMAIN, canonicalDag),
    canonicalBytes: new TextEncoder().encode(canonicalize(canonicalDag)).byteLength,
    canonicalDag
  });
}

export function ablateSupportGroup(graph, groupId) {
  const group = graph.groups.find((candidate) => candidate.id === groupId);
  if (!group) fail(`unknown support group ${groupId}`);
  const removed = new Set(group.memberNodeIds);
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) outgoing.get(edge.from).push(edge.to);
  const queue = [...removed];
  while (queue.length > 0) {
    for (const dependent of outgoing.get(queue.shift()) ?? []) {
      if (!removed.has(dependent)) {
        removed.add(dependent);
        queue.push(dependent);
      }
    }
  }
  const remainingNodeIds = new Set(graph.nodes.map(({ id }) => id).filter((id) => !removed.has(id)));
  const derived = createSupportDag({
    nodes: graph.nodes.filter(({ id }) => remainingNodeIds.has(id)),
    edges: graph.edges.filter(({ from, to }) => remainingNodeIds.has(from) && remainingNodeIds.has(to)),
    groups: graph.groups
      .filter(({ id }) => id !== groupId)
      .map((candidate) => ({ ...candidate, memberNodeIds: candidate.memberNodeIds.filter((id) => remainingNodeIds.has(id)) }))
      .filter(({ memberNodeIds }) => memberNodeIds.length > 0),
    mappingIdentities: graph.mappingIdentities
  });
  return deepFreeze({
    operation: "remove-support-group-transitively",
    removedGroupId: group.id,
    removedGroupType: group.type,
    removedNodeIds: [...removed].sort(),
    removedEdgeIds: graph.edges.filter(({ from, to }) => removed.has(from) || removed.has(to)).map(({ id }) => id).sort(),
    sourceGraphMutated: false,
    graph: derived
  });
}

export function minimumGroupCutToUnresolve(graph, rootNodeId, groupType) {
  if (!Object.values(SupportGroupType).includes(groupType)) fail(`unknown group type ${groupType}`);
  const closure = transitiveSupportClosure(graph, rootNodeId);
  const candidates = graph.groups.filter((group) => group.type === groupType && closure.groupIds.includes(group.id));
  if (candidates.length === 0) return deepFreeze({ value: null, reason: `no-${groupType}-group-in-public-support-closure` });
  for (const group of candidates) {
    const result = ablateSupportGroup(graph, group.id);
    if (!result.graph.nodes.some(({ id }) => id === rootNodeId)) return deepFreeze({ value: 1, witnessGroupIds: [group.id] });
  }
  return deepFreeze({ value: null, reason: "no-single-group-cut-and-higher-order-cut-not-defined-by-mvp-derivation-semantics" });
}

export function firstCategoricalFlip(graph, rootNodeId, groupType) {
  const root = graph.nodes.find(({ id }) => id === rootNodeId);
  if (!root) fail(`unknown root node ${rootNodeId}`);
  if (root.resolutionState !== ResolutionState.Resolved) fail("first categorical flip requires a Resolved baseline root");
  const baselineValue = requiredString(root.labels?.mappedApiValue, "root.labels.mappedApiValue");
  const cut = minimumGroupCutToUnresolve(graph, rootNodeId, groupType);
  if (cut.value === null) {
    return deepFreeze({
      value: null,
      kind: "categorical-value",
      baselineValue,
      reason: cut.reason
    });
  }
  return deepFreeze({
    value: cut.value,
    kind: "categorical-value",
    baselineValue,
    perturbedValue: null,
    response: "unresolved",
    witnessGroupIds: cut.witnessGroupIds
  });
}

export function supportComposition(graph, rootNodeId) {
  const closure = transitiveSupportClosure(graph, rootNodeId);
  const nodes = graph.nodes.filter(({ id }) => closure.nodeIds.includes(id));
  const groups = graph.groups.filter(({ id }) => closure.groupIds.includes(id));
  const count = (values, expected) => values.filter((value) => value === expected).length;
  return deepFreeze({
    evidenceArtifacts: count(nodes.map(({ artifactKind }) => artifactKind), "EvidenceArtifact"),
    codingClaims: count(nodes.map(({ artifactKind }) => artifactKind), "CodingClaim"),
    derivedArtifacts: count(nodes.map(({ artifactKind }) => artifactKind), "DerivedArtifact"),
    sourceRecords: count(groups.map(({ type }) => type), SupportGroupType.SourceRecord),
    sourceWorks: count(groups.map(({ type }) => type), SupportGroupType.SourceWork),
    narratives: count(groups.map(({ type }) => type), SupportGroupType.Narrative),
    researchAssistants: count(groups.map(({ type }) => type), SupportGroupType.ResearchAssistant),
    experts: count(groups.map(({ type }) => type), SupportGroupType.Expert),
    reviewEpisodes: count(groups.map(({ type }) => type), SupportGroupType.ReviewEpisode)
  });
}
