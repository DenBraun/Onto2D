import {
  CLUSTER_DISPOSITIONS,
  HASH_DOMAINS,
  KernelError,
  SOURCE_NODE_RESOLUTION_POLICY_VERSION,
  SOURCE_RELATION_KINDS,
  canonicalClone,
  canonicalize,
  deepFreeze,
  freezeSourceNodeResolutionPolicy,
  hashCanonical,
  isContentHash,
  verifySourceClassificationAmendments
} from "@onto2d/kernel";
import {
  SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION,
  buildSourceClassifiedRelations,
  verifySourceEffectiveClassifiedRelations
} from "./source-projection.js";

export const SOURCE_NODE_RESOLUTION_VERSION = "source-node-resolution-v1";
export const SOURCE_CONDENSATION_VERSION = "source-condensation-v1";
export const SOURCE_CONDENSATION_LIMITS = deepFreeze({
  maxNodes: 20_000,
  maxRelations: 10_000,
  maxIdentifierLength: 1_024
});

const NODE_FIELDS = new Set(["id", "identityHash", "sourceArtifact"]);
const COMPONENT_DECISION_FIELDS = new Set([
  "componentId",
  "disposition",
  "rationaleArtifact"
]);
const RELATION_DESTINATION_FIELDS = new Set(["relationId", "destination"]);
const ARTIFACT_REF_FIELDS = new Set([
  "path",
  "mediaType",
  "schemaVersion",
  "bytes",
  "hash"
]);
const RESOLUTION_POLICY_DRAFT_FIELDS = [
  "schemaVersion",
  "version",
  "classificationPolicyHash",
  "visibleInputs",
  "forbiddenCriteria",
  "dispositionRules",
  "edgeReconciliation",
  "clusterSemantics",
  "reviewRule"
];
const FORMATION_KINDS = new Set([
  "generative",
  "constitutive",
  "intra-closure-support"
]);
const DESTINATIONS = new Set([
  "inter-cluster",
  "internal",
  "typed-explanation"
]);
const CANONICAL_OPTIONS = Object.freeze({
  limits: Object.freeze({
    maxDepth: 64,
    maxEntries: 2_000_000,
    maxStringBytes: 1_048_576
  })
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "SOURCE_CONDENSATION",
    message,
    details
  });
}

function cloneInput(value, label) {
  try {
    return canonicalClone(value, CANONICAL_OPTIONS);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "SOURCE_CONDENSATION_INPUT_INVALID",
      `${label} must be canonicalizable.`,
      { causeCode: error.code }
    );
  }
}

function exactFields(value, allowed, required, path, code) {
  if (!isObject(value)) {
    fail(code, "Source reconciliation records must be objects.", { path });
  }
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Source reconciliation record fields do not match the contract.", {
      path,
      unknown,
      missing
    });
  }
}

function identifier(value, path, code) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > SOURCE_CONDENSATION_LIMITS.maxIdentifierLength
  ) {
    fail(code, "Source reconciliation identifiers must be normalized and bounded.", {
      path,
      maximumLength: SOURCE_CONDENSATION_LIMITS.maxIdentifierLength
    });
  }
  return value;
}

function artifactRef(value, path) {
  const code = "SOURCE_RESOLUTION_ARTIFACT_REF_INVALID";
  exactFields(
    value,
    ARTIFACT_REF_FIELDS,
    [...ARTIFACT_REF_FIELDS],
    path,
    code
  );
  if (
    typeof value.path !== "string" ||
    value.path.length === 0 ||
    value.path !== value.path.trim() ||
    value.path.length > 32_768 ||
    typeof value.mediaType !== "string" ||
    value.mediaType.length === 0 ||
    value.mediaType !== value.mediaType.trim() ||
    value.mediaType.length > 1_024 ||
    typeof value.schemaVersion !== "string" ||
    value.schemaVersion.length === 0 ||
    value.schemaVersion !== value.schemaVersion.trim() ||
    value.schemaVersion.length > 1_024 ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    !isContentHash(value.hash)
  ) {
    fail(code, "Reviewed source artifacts require a complete canonical reference.", {
      path
    });
  }
  return value;
}

function verifyResolutionPolicy(policyInput, classificationPolicyHash) {
  const supplied = cloneInput(policyInput, "Source node-resolution policy");
  if (
    !isObject(supplied) ||
    supplied.freezer !== SOURCE_NODE_RESOLUTION_POLICY_VERSION ||
    supplied.classificationPolicyHash !== classificationPolicyHash ||
    !isContentHash(supplied.policyHash)
  ) {
    fail(
      "SOURCE_RESOLUTION_POLICY_BINDING_INVALID",
      "Node-resolution policy is not bound to the verified classification policy."
    );
  }
  const draft = Object.fromEntries(
    RESOLUTION_POLICY_DRAFT_FIELDS.map((field) => [field, supplied[field]])
  );
  let reproduced;
  try {
    reproduced = freezeSourceNodeResolutionPolicy(draft);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "SOURCE_RESOLUTION_POLICY_BINDING_INVALID",
      "Node-resolution policy cannot be reproduced.",
      { causeCode: error.code }
    );
  }
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_RESOLUTION_POLICY_BINDING_INVALID",
      "Node-resolution policy differs from its deterministic reproduction.",
      { expected: reproduced.policyHash, actual: supplied.policyHash }
    );
  }
  return reproduced;
}

function verifyClassifiedChain(
  classificationPolicy,
  view,
  annotations,
  adjudication,
  classifiedInput,
  amendmentsInput
) {
  const supplied = cloneInput(classifiedInput, "Classified source relations");
  let reproduced;
  if (supplied?.builder === SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION) {
    if (amendmentsInput === undefined) {
      fail(
        "SOURCE_EFFECTIVE_CLASSIFICATION_AMENDMENTS_REQUIRED",
        "Effective classified relations require their immutable amendment log."
      );
    }
    reproduced = verifySourceEffectiveClassifiedRelations(
      classificationPolicy,
      view,
      annotations,
      adjudication,
      amendmentsInput,
      supplied
    );
  } else {
    reproduced = buildSourceClassifiedRelations(
      classificationPolicy,
      view,
      annotations,
      adjudication
    );
    if (amendmentsInput !== undefined) {
      const amendments = verifySourceClassificationAmendments(
        classificationPolicy,
        annotations,
        adjudication,
        amendmentsInput
      );
      if (amendments.statistics.changeCount !== 0) {
        fail(
          "SOURCE_EFFECTIVE_CLASSIFICATION_REQUIRED",
          "A non-empty amendment log requires effective classified relations."
        );
      }
    }
  }
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_CLASSIFIED_RELATIONS_BINDING_INVALID",
      "Classified relations differ from the verified policy/annotation chain.",
      {
        expected: reproduced.projectionHash,
        actual: isObject(supplied) ? supplied.projectionHash ?? null : null
      }
    );
  }
  return reproduced;
}

function normalizeSourceNodes(nodesInput) {
  const value = cloneInput(nodesInput, "Source node inventory");
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > SOURCE_CONDENSATION_LIMITS.maxNodes
  ) {
    fail(
      "SOURCE_NODE_INVENTORY_INVALID",
      "Source reconciliation requires a non-empty bounded node inventory.",
      { maximum: SOURCE_CONDENSATION_LIMITS.maxNodes }
    );
  }
  const nodes = value.map((entry, index) => {
    const path = `$.sourceNodes[${index}]`;
    exactFields(entry, NODE_FIELDS, [...NODE_FIELDS], path, "SOURCE_NODE_INVALID");
    if (!isContentHash(entry.identityHash)) {
      fail(
        "SOURCE_NODE_INVALID",
        "Every source node requires a content-addressed normalized identity.",
        { path: `${path}.identityHash` }
      );
    }
    return {
      id: identifier(entry.id, `${path}.id`, "SOURCE_NODE_INVALID"),
      identityHash: entry.identityHash,
      sourceArtifact: artifactRef(entry.sourceArtifact, `${path}.sourceArtifact`)
    };
  }).sort((left, right) => compareStrings(left.id, right.id));
  const ids = nodes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) {
    fail("SOURCE_NODE_DUPLICATE", "Source node identities must be unique.");
  }
  return nodes;
}

function normalizeComponentDecisions(decisionsInput, classified) {
  const value = cloneInput(decisionsInput, "Reviewed component decisions");
  if (!Array.isArray(value)) {
    fail(
      "SOURCE_COMPONENT_DECISIONS_INVALID",
      "Reviewed component decisions must be an array."
    );
  }
  const cyclicComponents = classified.projections.formationSupport.components
    .filter((component) => component.cyclic && component.members.length > 1);
  const components = new Map(cyclicComponents.map((entry) => [entry.componentId, entry]));
  const decisions = value.map((entry, index) => {
    const path = `$.componentDecisions[${index}]`;
    exactFields(
      entry,
      COMPONENT_DECISION_FIELDS,
      [...COMPONENT_DECISION_FIELDS],
      path,
      "SOURCE_COMPONENT_DECISION_INVALID"
    );
    const componentId = identifier(
      entry.componentId,
      `${path}.componentId`,
      "SOURCE_COMPONENT_DECISION_INVALID"
    );
    if (!isContentHash(componentId) || !components.has(componentId)) {
      fail(
        "SOURCE_COMPONENT_DECISION_UNKNOWN",
        "A reviewed decision names no cyclic formation-support component.",
        { componentId }
      );
    }
    if (!CLUSTER_DISPOSITIONS.includes(entry.disposition)) {
      fail(
        "SOURCE_COMPONENT_DISPOSITION_INVALID",
        "A reviewed component decision uses an unsupported disposition.",
        { componentId, disposition: entry.disposition }
      );
    }
    const component = components.get(componentId);
    return {
      componentId,
      members: component.members,
      internalRelationIds: component.internalRelationIds,
      disposition: entry.disposition,
      rationaleArtifact: artifactRef(
        entry.rationaleArtifact,
        `${path}.rationaleArtifact`
      )
    };
  }).sort((left, right) => compareStrings(left.componentId, right.componentId));
  const ids = decisions.map((entry) => entry.componentId);
  if (new Set(ids).size !== ids.length) {
    fail(
      "SOURCE_COMPONENT_DECISION_DUPLICATE",
      "Every cyclic formation-support component requires exactly one decision."
    );
  }
  const missing = [...components.keys()].filter((componentId) => !ids.includes(componentId));
  if (missing.length > 0 || decisions.length !== components.size) {
    fail(
      "SOURCE_COMPONENT_DECISION_INCOMPLETE",
      "Every cyclic formation-support component requires exactly one reviewed decision.",
      { missing, expected: components.size, actual: decisions.length }
    );
  }
  return decisions;
}

function vertexForComponent(component, decision, nodeById, relationById, policyHash) {
  const memberIdentityHashes = component.members
    .map((id) => nodeById.get(id).identityHash)
    .sort(compareStrings);
  const internalRelations = component.internalRelationIds
    .map((id) => relationById.get(id))
    .map((relation) => ({
      sourceIdentityHash: nodeById.get(relation.source).identityHash,
      targetIdentityHash: nodeById.get(relation.target).identityHash,
      kind: relation.kind
    }))
    .sort((left, right) => compareStrings(
      canonicalize(left, CANONICAL_OPTIONS),
      canonicalize(right, CANONICAL_OPTIONS)
    ));
  const basis = {
    schemaVersion: "1",
    kind: "condensed-cluster",
    nodeResolutionPolicyHash: policyHash,
    disposition: decision.disposition,
    memberIdentityHashes,
    internalRelations
  };
  return {
    vertexId: hashCanonical(
      HASH_DOMAINS.SOURCE_RESOLUTION_VERTEX,
      basis,
      CANONICAL_OPTIONS
    ),
    kind: "condensed-cluster",
    disposition: decision.disposition,
    members: component.members,
    internalRelationIds: component.internalRelationIds,
    internalOrder: "undefined"
  };
}

function vertexForNode(node, policyHash, internalRelations = []) {
  const structuralInternalRelations = internalRelations.map((relation) => ({
    sourceIdentityHash: node.identityHash,
    targetIdentityHash: node.identityHash,
    kind: relation.kind
  })).sort((left, right) => compareStrings(
    canonicalize(left, CANONICAL_OPTIONS),
    canonicalize(right, CANONICAL_OPTIONS)
  ));
  const basis = {
    schemaVersion: "1",
    kind: "source-node",
    nodeResolutionPolicyHash: policyHash,
    memberIdentityHash: node.identityHash,
    internalRelations: structuralInternalRelations
  };
  return {
    vertexId: hashCanonical(
      HASH_DOMAINS.SOURCE_RESOLUTION_VERTEX,
      basis,
      CANONICAL_OPTIONS
    ),
    kind: "source-node",
    members: [node.id],
    internalRelationIds: internalRelations.map((entry) => entry.id),
    internalOrder: internalRelations.length === 0 ? "defined" : "undefined"
  };
}

function buildVertices(nodes, decisions, classified, policyHash) {
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));
  const relationById = new Map(classified.relations.map((entry) => [entry.id, entry]));
  const endpointIds = new Set(classified.relations.flatMap((entry) => [entry.source, entry.target]));
  const missingEndpoints = [...endpointIds].filter((id) => !nodeById.has(id)).sort(compareStrings);
  if (missingEndpoints.length > 0) {
    fail(
      "SOURCE_NODE_INVENTORY_INCOMPLETE",
      "Source node inventory omits classified relation endpoints.",
      { missingEndpoints }
    );
  }
  const decisionsById = new Map(decisions.map((entry) => [entry.componentId, entry]));
  const vertices = [];
  const assigned = new Set();
  for (const component of classified.projections.formationSupport.components) {
    if (component.cyclic && component.members.length > 1) {
      const decision = decisionsById.get(component.componentId);
      const vertex = vertexForComponent(
        component,
        decision,
        nodeById,
        relationById,
        policyHash
      );
      vertices.push(vertex);
      component.members.forEach((member) => assigned.add(member));
      continue;
    }
    if (component.members.length !== 1) {
      fail(
        "SOURCE_RESOLUTION_COMPONENT_INVALID",
        "An acyclic strongly connected component must contain one source node.",
        { componentId: component.componentId, members: component.members.length }
      );
    }
    const member = component.members[0];
    vertices.push(vertexForNode(
      nodeById.get(member),
      policyHash,
      component.internalRelationIds.map((id) => relationById.get(id))
    ));
    assigned.add(member);
  }
  for (const node of nodes) {
    if (!assigned.has(node.id)) vertices.push(vertexForNode(node, policyHash));
  }
  vertices.sort((left, right) => compareStrings(left.vertexId, right.vertexId));
  const vertexIds = vertices.map((entry) => entry.vertexId);
  if (new Set(vertexIds).size !== vertexIds.length) {
    fail(
      "SOURCE_RESOLUTION_VERTEX_COLLISION",
      "Distinct source partitions produced the same resolution vertex identity."
    );
  }
  const memberIndex = vertices.flatMap((vertex) => vertex.members.map((sourceId) => ({
    sourceId,
    vertexId: vertex.vertexId
  }))).sort((left, right) => compareStrings(left.sourceId, right.sourceId));
  if (
    memberIndex.length !== nodes.length ||
    new Set(memberIndex.map((entry) => entry.sourceId)).size !== nodes.length
  ) {
    fail(
      "SOURCE_NODE_RECONCILIATION_INVALID",
      "Every source node must resolve to exactly one stratification vertex."
    );
  }
  return { vertices, memberIndex };
}

function expectedDestination(relation, sourceVertex, targetVertex) {
  if (sourceVertex === targetVertex && FORMATION_KINDS.has(relation.kind)) {
    return "internal";
  }
  if (sourceVertex !== targetVertex && relation.kind === "generative") {
    return "inter-cluster";
  }
  return "typed-explanation";
}

function normalizeRelationDestinations(input, classified, memberIndex) {
  const value = cloneInput(input, "Reviewed relation destinations");
  if (!Array.isArray(value)) {
    fail(
      "SOURCE_RELATION_DESTINATIONS_INVALID",
      "Reviewed relation destinations must be an array."
    );
  }
  const relationById = new Map(classified.relations.map((entry) => [entry.id, entry]));
  const vertexBySource = new Map(memberIndex.map((entry) => [entry.sourceId, entry.vertexId]));
  const destinations = value.map((entry, index) => {
    const path = `$.relationDestinations[${index}]`;
    exactFields(
      entry,
      RELATION_DESTINATION_FIELDS,
      [...RELATION_DESTINATION_FIELDS],
      path,
      "SOURCE_RELATION_DESTINATION_INVALID"
    );
    const relationId = identifier(
      entry.relationId,
      `${path}.relationId`,
      "SOURCE_RELATION_DESTINATION_INVALID"
    );
    const relation = relationById.get(relationId);
    if (relation === undefined) {
      fail(
        "SOURCE_RELATION_DESTINATION_UNKNOWN",
        "A relation destination names no classified source relation.",
        { relationId }
      );
    }
    if (!DESTINATIONS.has(entry.destination)) {
      fail(
        "SOURCE_RELATION_DESTINATION_INVALID",
        "A relation destination is outside the frozen reconciliation vocabulary.",
        { relationId, destination: entry.destination }
      );
    }
    const sourceVertex = vertexBySource.get(relation.source);
    const targetVertex = vertexBySource.get(relation.target);
    const expected = expectedDestination(relation, sourceVertex, targetVertex);
    if (entry.destination !== expected) {
      fail(
        "SOURCE_RELATION_DESTINATION_INCONSISTENT",
        "A reviewed relation destination contradicts its typed resolved endpoints.",
        { relationId, expected, actual: entry.destination }
      );
    }
    return {
      relationId,
      kind: relation.kind,
      source: relation.source,
      target: relation.target,
      sourceVertex,
      targetVertex,
      destination: entry.destination
    };
  }).sort((left, right) => compareStrings(left.relationId, right.relationId));
  const ids = destinations.map((entry) => entry.relationId);
  if (new Set(ids).size !== ids.length) {
    fail(
      "SOURCE_RELATION_DESTINATION_DUPLICATE",
      "Every classified source relation requires exactly one destination."
    );
  }
  const missing = [...relationById.keys()].filter((id) => !ids.includes(id));
  if (missing.length > 0 || destinations.length !== relationById.size) {
    fail(
      "SOURCE_RELATION_DESTINATION_INCOMPLETE",
      "Every classified source relation requires exactly one reviewed destination.",
      { missing, expected: relationById.size, actual: destinations.length }
    );
  }
  return destinations;
}

/** Resolves every reviewed source node and relation into one exact partition. */
export function resolveSourceNodes(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  classifiedRelations,
  nodeResolutionPolicy,
  sourceNodes,
  componentDecisions,
  relationDestinations,
  amendments
) {
  const classified = verifyClassifiedChain(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    classifiedRelations,
    amendments
  );
  const policy = verifyResolutionPolicy(
    nodeResolutionPolicy,
    classified.policyHash
  );
  const nodes = normalizeSourceNodes(sourceNodes);
  const decisions = normalizeComponentDecisions(componentDecisions, classified);
  const { vertices, memberIndex } = buildVertices(
    nodes,
    decisions,
    classified,
    policy.policyHash
  );
  const destinations = normalizeRelationDestinations(
    relationDestinations,
    classified,
    memberIndex
  );
  const basis = {
    schemaVersion: "1",
    resolver: SOURCE_NODE_RESOLUTION_VERSION,
    classificationPolicyHash: classified.policyHash,
    nodeResolutionPolicyHash: policy.policyHash,
    projectionHash: classified.projectionHash,
    sourceNodes: nodes,
    componentDecisions: decisions,
    relationDestinations: destinations,
    vertices,
    memberIndex,
    counts: {
      sourceNodes: nodes.length,
      sourceRelations: classified.relations.length,
      nontrivialComponents: decisions.length,
      vertices: vertices.length,
      condensedClusters: vertices.filter((entry) =>
        entry.kind === "condensed-cluster"
      ).length,
      internalRelations: destinations.filter((entry) =>
        entry.destination === "internal"
      ).length,
      interClusterRelations: destinations.filter((entry) =>
        entry.destination === "inter-cluster"
      ).length,
      typedExplanationRelations: destinations.filter((entry) =>
        entry.destination === "typed-explanation"
      ).length
    }
  };
  return deepFreeze({
    ...basis,
    resolutionHash: hashCanonical(
      HASH_DOMAINS.SOURCE_NODE_RESOLUTION,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Replays a serialized source-node resolution from its reviewed inputs. */
export function verifySourceNodeResolution(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  classifiedRelations,
  nodeResolutionPolicy,
  resolutionInput,
  amendments
) {
  const supplied = cloneInput(resolutionInput, "Source node resolution");
  const reproduced = resolveSourceNodes(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    classifiedRelations,
    nodeResolutionPolicy,
    supplied?.sourceNodes,
    Array.isArray(supplied?.componentDecisions)
      ? supplied.componentDecisions.map((entry) => ({
          componentId: entry.componentId,
          disposition: entry.disposition,
          rationaleArtifact: entry.rationaleArtifact
        }))
      : supplied?.componentDecisions,
    Array.isArray(supplied?.relationDestinations)
      ? supplied.relationDestinations.map((entry) => ({
          relationId: entry.relationId,
          destination: entry.destination
        }))
      : supplied?.relationDestinations,
    amendments
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_NODE_RESOLUTION_MISMATCH",
      "Source node resolution differs from deterministic replay.",
      {
        expected: reproduced.resolutionHash,
        actual: isObject(supplied) ? supplied.resolutionHash ?? null : null
      }
    );
  }
  return reproduced;
}

function heapPush(heap, value) {
  let index = heap.length;
  heap.push(value);
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (compareStrings(heap[parent], value) <= 0) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = value;
}

function heapPop(heap) {
  const first = heap[0];
  const last = heap.pop();
  if (heap.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    if (left >= heap.length) break;
    const right = left + 1;
    const child = right < heap.length && compareStrings(heap[right], heap[left]) < 0
      ? right
      : left;
    if (compareStrings(heap[child], last) >= 0) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = last;
  return first;
}

function topologicalOrder(vertexIds, edges) {
  const adjacency = new Map(vertexIds.map((id) => [id, new Set()]));
  const indegree = new Map(vertexIds.map((id) => [id, 0]));
  for (const edge of edges) {
    const children = adjacency.get(edge.sourceVertex);
    if (!children.has(edge.targetVertex)) {
      children.add(edge.targetVertex);
      indegree.set(edge.targetVertex, indegree.get(edge.targetVertex) + 1);
    }
  }
  const ready = [];
  for (const id of vertexIds) {
    if (indegree.get(id) === 0) heapPush(ready, id);
  }
  const order = [];
  while (ready.length > 0) {
    const current = heapPop(ready);
    order.push(current);
    for (const target of [...adjacency.get(current)].sort(compareStrings)) {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) {
        heapPush(ready, target);
      }
    }
  }
  if (order.length !== vertexIds.length) {
    fail(
      "SOURCE_CONDENSATION_QUOTIENT_CYCLIC",
      "The inter-cluster generative quotient must be a DAG.",
      { vertices: vertexIds.length, ordered: order.length }
    );
  }
  return order;
}

/** Builds the lossless typed relation layers and generative DAG quotient. */
export function condenseSourceRelations(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  classifiedRelations,
  nodeResolutionPolicy,
  resolutionInput,
  amendments
) {
  const resolution = verifySourceNodeResolution(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    classifiedRelations,
    nodeResolutionPolicy,
    resolutionInput,
    amendments
  );
  const generativeEdges = resolution.relationDestinations
    .filter((entry) =>
      entry.kind === "generative" && entry.destination === "inter-cluster"
    )
    .map((entry) => ({
      relationId: entry.relationId,
      sourceVertex: entry.sourceVertex,
      targetVertex: entry.targetVertex
    }));
  const vertexIds = resolution.vertices.map((entry) => entry.vertexId);
  const relationLayers = Object.fromEntries(SOURCE_RELATION_KINDS.map((kind) => [
    kind,
    resolution.relationDestinations.filter((entry) => entry.kind === kind)
  ]));
  const basis = {
    schemaVersion: "1",
    condenser: SOURCE_CONDENSATION_VERSION,
    classificationPolicyHash: resolution.classificationPolicyHash,
    nodeResolutionPolicyHash: resolution.nodeResolutionPolicyHash,
    projectionHash: resolution.projectionHash,
    resolutionHash: resolution.resolutionHash,
    vertices: resolution.vertices,
    memberIndex: resolution.memberIndex,
    quotient: {
      vertexIds,
      generativeEdges,
      topologicalOrder: topologicalOrder(vertexIds, generativeEdges)
    },
    relationLayers,
    counts: {
      sourceNodes: resolution.counts.sourceNodes,
      sourceRelations: resolution.counts.sourceRelations,
      vertices: resolution.counts.vertices,
      condensedClusters: resolution.counts.condensedClusters,
      quotientGenerativeRelations: generativeEdges.length,
      internalRelations: resolution.counts.internalRelations,
      typedExplanationRelations: resolution.counts.typedExplanationRelations
    }
  };
  return deepFreeze({
    ...basis,
    condensationHash: hashCanonical(
      HASH_DOMAINS.SOURCE_CONDENSATION,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Replays a serialized source condensation and every upstream reviewed input. */
export function verifySourceCondensation(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensationInput,
  amendments
) {
  const supplied = cloneInput(condensationInput, "Source condensation");
  const reproduced = condenseSourceRelations(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    classifiedRelations,
    nodeResolutionPolicy,
    resolution,
    amendments
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_CONDENSATION_MISMATCH",
      "Source condensation differs from deterministic replay.",
      {
        expected: reproduced.condensationHash,
        actual: isObject(supplied) ? supplied.condensationHash ?? null : null
      }
    );
  }
  return reproduced;
}
