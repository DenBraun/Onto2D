import {
  HASH_DOMAINS,
  KernelError,
  SOURCE_CLASSIFICATION_ADJUDICATION_VERSION,
  SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION,
  SOURCE_CLASSIFICATION_POLICY_VERSION,
  canonicalClone,
  canonicalize,
  deepFreeze,
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAnnotations,
  freezeSourceClassificationPolicy,
  hashCanonical,
  isContentHash
} from "@onto2d/kernel";

export const SOURCE_CLASSIFICATION_VIEW_VERSION = "source-classification-view-v1";
export const SOURCE_CLASSIFIED_RELATIONS_VERSION = "source-classified-relations-v1";

export const SOURCE_PROJECTION_LIMITS = deepFreeze({
  maxRelations: 10_000,
  maxIdentifierLength: 1_024
});

const RELATION_KINDS = Object.freeze([
  "generative",
  "constitutive",
  "intra-closure-support",
  "evidential",
  "descriptive",
  "regulatory-feedback"
]);
const FORMATION_SUPPORT_KINDS = Object.freeze([
  "generative",
  "constitutive",
  "intra-closure-support"
]);
const VIEW_INPUT_RELATION_FIELDS = new Set(["id", "source", "target", "fields"]);
const VIEW_OUTPUT_FIELDS = new Set([
  "schemaVersion",
  "builder",
  "policyHash",
  "relations",
  "statistics",
  "viewHash"
]);
const VIEW_STATISTICS_FIELDS = new Set(["relationCount"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "SOURCE_PROJECTION", message, details });
}

function cloneInput(value, label) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("SOURCE_PROJECTION_INPUT_INVALID", `${label} is not canonicalizable.`, {
      causeCode: error.code,
      ...error.details
    });
  }
}

function assertFields(value, allowed, required, path, code) {
  if (!isObject(value)) fail(code, "Source projection value must be an object.", { path });
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Source projection fields do not match the supported contract.", {
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
    value.length > SOURCE_PROJECTION_LIMITS.maxIdentifierLength
  ) {
    fail(code, "Source projection identifiers must be normalized, non-empty, and bounded.", {
      path,
      maximumLength: SOURCE_PROJECTION_LIMITS.maxIdentifierLength
    });
  }
  return value;
}

function verifyPolicy(policy) {
  const cloned = cloneInput(policy, "Frozen source classification policy");
  const code = "SOURCE_PROJECTION_POLICY_INVALID";
  if (
    !isObject(cloned) ||
    cloned.schemaVersion !== "1" ||
    cloned.freezer !== SOURCE_CLASSIFICATION_POLICY_VERSION ||
    !isContentHash(cloned.policyHash)
  ) {
    fail(code, "Source projection requires a supported frozen classification policy.");
  }
  const draft = {
    schemaVersion: cloned.schemaVersion,
    version: cloned.version,
    authorship: cloned.authorship,
    exposure: cloned.exposure,
    visibleFields: cloned.visibleFields,
    forbiddenInputs: cloned.forbiddenInputs,
    relationKinds: cloned.relationKinds,
    conflictRule: cloned.conflictRule,
    riskPolicy: cloned.riskPolicy
  };
  let reproduced;
  try {
    reproduced = freezeSourceClassificationPolicy(draft);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, "Source projection policy cannot be reproduced.", { causeCode: error.code });
  }
  if (canonicalize(reproduced) !== canonicalize(cloned)) {
    fail(code, "Source projection policy content does not match its declared identity.", {
      expected: reproduced.policyHash,
      actual: cloned.policyHash
    });
  }
  return cloned;
}

function normalizeRelation(relation, index, policy) {
  const code = "SOURCE_CLASSIFICATION_VIEW_RELATION_INVALID";
  const path = `$.relations[${index}]`;
  assertFields(
    relation,
    VIEW_INPUT_RELATION_FIELDS,
    [...VIEW_INPUT_RELATION_FIELDS],
    path,
    code
  );
  if (!isObject(relation.fields)) {
    fail(code, "Source classification view fields must be an object.", { path: `${path}.fields` });
  }
  const fieldNames = Object.keys(relation.fields).sort(compareText);
  const expectedFields = [...policy.visibleFields].sort(compareText);
  const missingEndpoints = ["source", "target"].filter((field) => !expectedFields.includes(field));
  if (missingEndpoints.length > 0) {
    fail(code, "Source classification policy must explicitly expose both relation endpoints.", {
      path: "$.policy.visibleFields",
      missing: missingEndpoints
    });
  }
  const missing = expectedFields.filter((field) => !fieldNames.includes(field));
  const unknown = fieldNames.filter((field) => !expectedFields.includes(field));
  if (missing.length > 0 || unknown.length > 0) {
    fail(code, "Source classification view must expose exactly the frozen visible fields.", {
      path: `${path}.fields`,
      missing,
      unknown
    });
  }
  if (relation.fields.source !== relation.source || relation.fields.target !== relation.target) {
    fail(code, "Source classification view endpoint fields must match the structural relation endpoints.", {
      path,
      source: relation.source,
      fieldSource: relation.fields.source,
      target: relation.target,
      fieldTarget: relation.fields.target
    });
  }
  return {
    id: identifier(relation.id, `${path}.id`, code),
    source: identifier(relation.source, `${path}.source`, code),
    target: identifier(relation.target, `${path}.target`, code),
    fields: Object.fromEntries(expectedFields.map((field) => [field, relation.fields[field]]))
  };
}

export function createSourceClassificationView(policy, relations) {
  const frozenPolicy = verifyPolicy(policy);
  const input = cloneInput(relations, "Source classification view relations");
  const code = "SOURCE_CLASSIFICATION_VIEW_INVALID";
  if (
    !Array.isArray(input) ||
    input.length === 0 ||
    input.length > SOURCE_PROJECTION_LIMITS.maxRelations
  ) {
    fail(code, "Source classification view requires a non-empty bounded relation inventory.", {
      maximum: SOURCE_PROJECTION_LIMITS.maxRelations
    });
  }
  const normalized = input.map((relation, index) =>
    normalizeRelation(relation, index, frozenPolicy)
  ).sort((left, right) => compareText(left.id, right.id));
  const relationIds = normalized.map((relation) => relation.id);
  if (new Set(relationIds).size !== relationIds.length) {
    fail(code, "Source classification relation identities must be unique.");
  }
  const basis = {
    schemaVersion: "1",
    builder: SOURCE_CLASSIFICATION_VIEW_VERSION,
    policyHash: frozenPolicy.policyHash,
    relations: normalized,
    statistics: { relationCount: normalized.length }
  };
  return deepFreeze({
    ...basis,
    viewHash: hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_VIEW, basis)
  });
}

function verifyView(policy, view) {
  const cloned = cloneInput(view, "Frozen source classification view");
  const code = "SOURCE_CLASSIFICATION_VIEW_BINDING_INVALID";
  assertFields(cloned, VIEW_OUTPUT_FIELDS, [...VIEW_OUTPUT_FIELDS], "$.view", code);
  assertFields(
    cloned.statistics,
    VIEW_STATISTICS_FIELDS,
    [...VIEW_STATISTICS_FIELDS],
    "$.view.statistics",
    code
  );
  if (
    cloned.schemaVersion !== "1" ||
    cloned.builder !== SOURCE_CLASSIFICATION_VIEW_VERSION ||
    cloned.policyHash !== policy.policyHash ||
    !isContentHash(cloned.viewHash)
  ) {
    fail(code, "Source classification view is not bound to the supplied policy.");
  }
  let reproduced;
  try {
    reproduced = createSourceClassificationView(policy, cloned.relations);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, "Source classification view cannot be reproduced.", { causeCode: error.code });
  }
  if (canonicalize(reproduced) !== canonicalize(cloned)) {
    fail(code, "Source classification view content does not match its declared identity.", {
      expected: reproduced.viewHash,
      actual: cloned.viewHash
    });
  }
  return cloned;
}

function verifyAnnotations(policy, view, artifact) {
  const cloned = cloneInput(artifact, "Frozen source classification annotations");
  const code = "SOURCE_CLASSIFICATION_ANNOTATIONS_BINDING_INVALID";
  if (
    !isObject(cloned) ||
    cloned.schemaVersion !== "1" ||
    cloned.freezer !== SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION ||
    cloned.policyHash !== policy.policyHash ||
    cloned.view?.hash !== view.viewHash ||
    !isContentHash(cloned.annotationHash)
  ) {
    fail(code, "Source annotations are not bound to the supplied policy and view.");
  }
  const relationIds = view.relations.map((relation) => relation.id);
  if (
    canonicalize(cloned.view?.visibleFields) !== canonicalize(policy.visibleFields) ||
    canonicalize(cloned.view?.relationIds) !== canonicalize(relationIds)
  ) {
    fail(code, "Source annotation view inventory differs from the verified classification view.");
  }
  const draft = {
    schemaVersion: cloned.schemaVersion,
    policyHash: cloned.policyHash,
    view: cloned.view,
    frozenAt: cloned.frozenAt,
    classifiers: cloned.classifiers,
    annotations: cloned.annotations
  };
  let reproduced;
  try {
    reproduced = freezeSourceClassificationAnnotations(policy, draft);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, "Source annotations cannot be reproduced.", { causeCode: error.code });
  }
  if (canonicalize(reproduced) !== canonicalize(cloned)) {
    fail(code, "Source annotation content does not match its declared identity.", {
      expected: reproduced.annotationHash,
      actual: cloned.annotationHash
    });
  }
  return cloned;
}

function verifyAdjudication(policy, annotations, artifact) {
  const cloned = cloneInput(artifact, "Frozen source classification adjudication");
  const code = "SOURCE_CLASSIFICATION_ADJUDICATION_BINDING_INVALID";
  if (
    !isObject(cloned) ||
    cloned.schemaVersion !== "1" ||
    cloned.freezer !== SOURCE_CLASSIFICATION_ADJUDICATION_VERSION ||
    cloned.policyHash !== policy.policyHash ||
    cloned.annotationHash !== annotations.annotationHash ||
    !isContentHash(cloned.adjudicationHash)
  ) {
    fail(code, "Source adjudication is not bound to the supplied policy and annotations.");
  }
  const draft = {
    schemaVersion: cloned.schemaVersion,
    policyHash: cloned.policyHash,
    annotationHash: cloned.annotationHash,
    frozenAt: cloned.frozenAt,
    unblindedAt: cloned.unblindedAt,
    adjudicator: cloned.adjudicator,
    decisions: cloned.decisions.map(({ relationId, kind, rationale }) => ({
      relationId,
      kind,
      rationale
    }))
  };
  let reproduced;
  try {
    reproduced = freezeSourceClassificationAdjudication(policy, annotations, draft);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, "Source adjudication cannot be reproduced.", { causeCode: error.code });
  }
  if (canonicalize(reproduced) !== canonicalize(cloned)) {
    fail(code, "Source adjudication content does not match its declared identity.", {
      expected: reproduced.adjudicationHash,
      actual: cloned.adjudicationHash
    });
  }
  return cloned;
}

function stronglyConnectedComponents(nodes, relations, projection) {
  const orderedNodes = [...nodes].sort(compareText);
  const adjacencySets = new Map(orderedNodes.map((node) => [node, new Set()]));
  const reverseSets = new Map(orderedNodes.map((node) => [node, new Set()]));
  for (const relation of relations) {
    adjacencySets.get(relation.source).add(relation.target);
    reverseSets.get(relation.target).add(relation.source);
  }
  const adjacency = new Map(orderedNodes.map((node) => [
    node,
    [...adjacencySets.get(node)].sort(compareText)
  ]));
  const reverse = new Map(orderedNodes.map((node) => [
    node,
    [...reverseSets.get(node)].sort(compareText)
  ]));
  const visited = new Set();
  const finishOrder = [];
  const membersList = [];

  for (const root of orderedNodes) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack = [{ node: root, nextNeighbor: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.node);
      if (frame.nextNeighbor < neighbors.length) {
        const target = neighbors[frame.nextNeighbor];
        frame.nextNeighbor += 1;
        if (!visited.has(target)) {
          visited.add(target);
          stack.push({ node: target, nextNeighbor: 0 });
        }
      } else {
        finishOrder.push(frame.node);
        stack.pop();
      }
    }
  }

  const assigned = new Set();
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const root = finishOrder[index];
    if (assigned.has(root)) continue;
    const members = [];
    const stack = [root];
    assigned.add(root);
    while (stack.length > 0) {
      const member = stack.pop();
      members.push(member);
      for (const source of reverse.get(member)) {
        if (assigned.has(source)) continue;
        assigned.add(source);
        stack.push(source);
      }
    }
    membersList.push(members.sort(compareText));
  }

  const components = membersList.map((members) => {
    const memberSet = new Set(members);
    const internalRelations = relations
      .filter((relation) => memberSet.has(relation.source) && memberSet.has(relation.target))
      .map(({ id, source, target, kind }) => ({ id, source, target, kind }))
      .sort((left, right) => compareText(left.id, right.id));
    const internalRelationIds = internalRelations.map((relation) => relation.id);
    const cyclic = members.length > 1 || relations.some((relation) =>
      relation.source === relation.target && memberSet.has(relation.source)
    );
    const componentBasis = {
      schemaVersion: "1",
      projection,
      members,
      internalRelations
    };
    return {
      componentId: hashCanonical(HASH_DOMAINS.SOURCE_SCC_COMPONENT, componentBasis),
      members,
      internalRelationIds,
      cyclic
    };
  }).sort((left, right) => compareText(canonicalize(left.members), canonicalize(right.members)));

  return components;
}

function projectionFor(name, includedKinds, nodes, relations) {
  const included = new Set(includedKinds);
  const projectedRelations = relations.filter((relation) => included.has(relation.kind));
  const components = stronglyConnectedComponents(nodes, projectedRelations, name);
  return {
    name,
    includedKinds: [...includedKinds],
    relationIds: projectedRelations.map((relation) => relation.id),
    components,
    cyclicComponentIds: components
      .filter((component) => component.cyclic)
      .map((component) => component.componentId)
      .sort(compareText)
  };
}

export function buildSourceClassifiedRelations(
  policy,
  viewArtifact,
  annotationArtifact,
  adjudicationArtifact
) {
  const frozenPolicy = verifyPolicy(policy);
  const view = verifyView(frozenPolicy, viewArtifact);
  const annotations = verifyAnnotations(frozenPolicy, view, annotationArtifact);
  const adjudication = verifyAdjudication(frozenPolicy, annotations, adjudicationArtifact);
  const decisions = new Map(adjudication.decisions.map((decision) => [decision.relationId, decision]));
  const relations = view.relations.map((relation) => {
    const decision = decisions.get(relation.id);
    if (decision === undefined) {
      fail("SOURCE_CLASSIFIED_RELATION_MISSING", "Verified adjudication is missing a source relation.", {
        relationId: relation.id
      });
    }
    return {
      id: relation.id,
      source: relation.source,
      target: relation.target,
      kind: decision.kind,
      decisionStatus: decision.status,
      rawKinds: decision.rawKinds
    };
  });
  const nodes = new Set(relations.flatMap((relation) => [relation.source, relation.target]));
  const generative = projectionFor("generative", ["generative"], nodes, relations);
  const formationSupport = projectionFor(
    "formation-support",
    FORMATION_SUPPORT_KINDS,
    nodes,
    relations
  );
  const classifiedByKind = Object.fromEntries(RELATION_KINDS.map((kind) => [kind, 0]));
  for (const relation of relations) classifiedByKind[relation.kind] += 1;
  const basis = {
    schemaVersion: "1",
    builder: SOURCE_CLASSIFIED_RELATIONS_VERSION,
    policyHash: frozenPolicy.policyHash,
    viewHash: view.viewHash,
    annotationHash: annotations.annotationHash,
    adjudicationHash: adjudication.adjudicationHash,
    relations,
    projections: { generative, formationSupport },
    statistics: {
      nodeCount: nodes.size,
      relationCount: relations.length,
      classifiedByKind,
      generativeCyclicComponentCount: generative.cyclicComponentIds.length,
      formationSupportCyclicComponentCount: formationSupport.cyclicComponentIds.length
    }
  };
  return deepFreeze({
    ...basis,
    projectionHash: hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFIED_RELATIONS, basis)
  });
}
