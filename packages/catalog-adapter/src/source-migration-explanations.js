import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical
} from "@onto2d/kernel";
import { verifySourceMigrationMetrics } from "./source-migration-metrics.js";

export const SOURCE_MIGRATION_EXPLANATION_INDEX_VERSION =
  "source-migration-explanation-index-v1";
export const SOURCE_MIGRATION_EXPLANATION_VERSION =
  "source-migration-explanation-v1";

const CANONICAL_OPTIONS = Object.freeze({
  limits: Object.freeze({
    maxDepth: 64,
    maxEntries: 2_000_000,
    maxStringBytes: 1_048_576
  })
});
const QUERY_FIELDS = new Set(["kind", "id"]);
const QUERY_KINDS = new Set(["source-node", "source-relation", "raw-component"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "SOURCE_MIGRATION_EXPLANATIONS",
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
      "SOURCE_MIGRATION_EXPLANATION_INPUT_INVALID",
      `${label} must be canonicalizable.`,
      { causeCode: error.code }
    );
  }
}

function exactQuery(queryInput) {
  const query = cloneInput(queryInput, "Source migration explanation query");
  if (!isObject(query)) {
    fail(
      "SOURCE_MIGRATION_EXPLANATION_QUERY_INVALID",
      "Source migration explanation query must be an object."
    );
  }
  const fields = Object.keys(query);
  const unknown = fields.filter((field) => !QUERY_FIELDS.has(field));
  const missing = [...QUERY_FIELDS].filter((field) => !fields.includes(field));
  if (
    unknown.length > 0 ||
    missing.length > 0 ||
    !QUERY_KINDS.has(query.kind) ||
    typeof query.id !== "string" ||
    query.id.length === 0 ||
    query.id !== query.id.trim() ||
    query.id.length > 1_024
  ) {
    fail(
      "SOURCE_MIGRATION_EXPLANATION_QUERY_INVALID",
      "Source migration explanation query fields are invalid.",
      { unknown, missing }
    );
  }
  return query;
}

function createLookup(items, field) {
  return new Map(items.map((entry) => [entry[field], entry]));
}

/** Builds complete queryable lineage for every migrated source object. */
export function createSourceMigrationExplanationIndex(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendmentsInput,
  classifiedRelationsInput,
  nodeResolutionPolicy,
  resolutionInput,
  condensation,
  reconciliation,
  metricsInput
) {
  const metrics = verifySourceMigrationMetrics(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendmentsInput,
    classifiedRelationsInput,
    nodeResolutionPolicy,
    resolutionInput,
    condensation,
    reconciliation,
    metricsInput
  );
  const amendments = cloneInput(amendmentsInput, "Source classification amendments");
  const classified = cloneInput(classifiedRelationsInput, "Classified source relations");
  const resolution = cloneInput(resolutionInput, "Source node resolution");
  const condensationArtifact = cloneInput(condensation, "Source condensation");
  const levelBySource = createLookup(metrics.catalogueLevels, "sourceId");
  const vertexIdBySource = new Map(
    resolution.memberIndex.map((entry) => [entry.sourceId, entry.vertexId])
  );
  const vertexById = createLookup(resolution.vertices, "vertexId");
  const destinationByRelation = createLookup(
    resolution.relationDestinations,
    "relationId"
  );
  const effectiveDecisionByRelation = createLookup(
    amendments.effectiveDecisions,
    "relationId"
  );
  const componentIdsBySource = new Map(
    resolution.sourceNodes.map((entry) => [entry.id, []])
  );
  const componentIdsByRelation = new Map(
    classified.relations.map((entry) => [entry.id, []])
  );
  const inboundBySource = new Map(
    resolution.sourceNodes.map((entry) => [entry.id, []])
  );
  const outboundBySource = new Map(
    resolution.sourceNodes.map((entry) => [entry.id, []])
  );
  for (const relation of classified.relations) {
    outboundBySource.get(relation.source).push(relation.id);
    inboundBySource.get(relation.target).push(relation.id);
  }
  for (const component of metrics.dispositions) {
    for (const sourceId of component.members) {
      componentIdsBySource.get(sourceId).push(component.rawComponentId);
    }
    for (const relationId of component.edgeIds) {
      componentIdsByRelation.get(relationId).push(component.rawComponentId);
    }
  }
  for (const values of componentIdsBySource.values()) values.sort(compareStrings);
  for (const values of componentIdsByRelation.values()) values.sort(compareStrings);
  for (const values of inboundBySource.values()) values.sort(compareStrings);
  for (const values of outboundBySource.values()) values.sort(compareStrings);

  const nodes = resolution.sourceNodes.map((sourceNode) => {
    const vertexId = vertexIdBySource.get(sourceNode.id);
    const vertex = vertexById.get(vertexId);
    return {
      sourceId: sourceNode.id,
      identityHash: sourceNode.identityHash,
      sourceArtifact: sourceNode.sourceArtifact,
      catalogueLevel: levelBySource.get(sourceNode.id).catalogueLevel,
      vertexId,
      vertexKind: vertex.kind,
      ...(vertex.kind === "condensed-cluster"
        ? { clusterDisposition: vertex.disposition }
        : {}),
      vertexMembers: vertex.members,
      rawComponentIds: componentIdsBySource.get(sourceNode.id),
      inboundRelationIds: inboundBySource.get(sourceNode.id),
      outboundRelationIds: outboundBySource.get(sourceNode.id)
    };
  }).sort((left, right) => compareStrings(left.sourceId, right.sourceId));

  const relations = classified.relations.map((relation) => {
    const destination = destinationByRelation.get(relation.id);
    const effective = effectiveDecisionByRelation.get(relation.id);
    if (
      destination === undefined ||
      effective === undefined ||
      effective.effectiveKind !== relation.kind
    ) {
      fail(
        "SOURCE_MIGRATION_EXPLANATION_LINEAGE_INVALID",
        "Verified source relation lineage does not reconcile.",
        { relationId: relation.id }
      );
    }
    return {
      relationId: relation.id,
      source: relation.source,
      target: relation.target,
      frozenKind: effective.frozenKind,
      effectiveKind: effective.effectiveKind,
      decisionStatus: relation.decisionStatus,
      rawKinds: relation.rawKinds,
      finalStateHash: effective.finalStateHash,
      changeIds: effective.changeIds,
      sourceVertex: destination.sourceVertex,
      targetVertex: destination.targetVertex,
      destination: destination.destination,
      rawComponentIds: componentIdsByRelation.get(relation.id)
    };
  }).sort((left, right) => compareStrings(left.relationId, right.relationId));

  const rawComponents = metrics.dispositions.map((entry) => ({ ...entry }));
  const basis = {
    schemaVersion: "1",
    builder: SOURCE_MIGRATION_EXPLANATION_INDEX_VERSION,
    classificationPolicyHash: metrics.classificationPolicyHash,
    amendmentsHash: metrics.amendmentsHash,
    projectionHash: resolution.projectionHash,
    resolutionHash: resolution.resolutionHash,
    condensationHash: condensationArtifact.condensationHash,
    reconciliationHash: metrics.reconciliationHash,
    metricsHash: metrics.metricsHash,
    nodes,
    relations,
    rawComponents,
    statistics: {
      sourceNodeCount: nodes.length,
      sourceRelationCount: relations.length,
      rawComponentCount: rawComponents.length,
      condensedClusterCount: metrics.condensedClusters,
      amendedRelationCount: relations.filter((entry) =>
        entry.changeIds.length > 0
      ).length
    }
  };
  return deepFreeze({
    ...basis,
    indexHash: hashCanonical(
      HASH_DOMAINS.SOURCE_MIGRATION_EXPLANATION_INDEX,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Exactly replays a serialized source-migration explanation index. */
export function verifySourceMigrationExplanationIndex(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reconciliation,
  metrics,
  indexInput
) {
  const supplied = cloneInput(indexInput, "Source migration explanation index");
  const reproduced = createSourceMigrationExplanationIndex(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendments,
    classifiedRelations,
    nodeResolutionPolicy,
    resolution,
    condensation,
    reconciliation,
    metrics
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_MIGRATION_EXPLANATION_INDEX_MISMATCH",
      "Source migration explanation index differs from deterministic replay.",
      {
        expected: reproduced.indexHash,
        actual: isObject(supplied) ? supplied.indexHash ?? null : null
      }
    );
  }
  return reproduced;
}

function explanationFor(index, query) {
  const collection = query.kind === "source-node"
    ? index.nodes
    : query.kind === "source-relation"
      ? index.relations
      : index.rawComponents;
  const identityField = query.kind === "source-node"
    ? "sourceId"
    : query.kind === "source-relation"
      ? "relationId"
      : "rawComponentId";
  const result = collection.find((entry) => entry[identityField] === query.id);
  if (result === undefined) {
    fail(
      "SOURCE_MIGRATION_EXPLANATION_NOT_FOUND",
      "The verified source-migration index has no matching entry.",
      query
    );
  }
  const basis = {
    schemaVersion: "1",
    reporter: SOURCE_MIGRATION_EXPLANATION_VERSION,
    indexHash: index.indexHash,
    query,
    result
  };
  return deepFreeze({
    ...basis,
    explanationHash: hashCanonical(
      HASH_DOMAINS.SOURCE_MIGRATION_EXPLANATION,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Verifies once and returns a bound in-memory source explanation session. */
export function createSourceMigrationExplanationSession(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reconciliation,
  metrics,
  indexInput
) {
  const index = verifySourceMigrationExplanationIndex(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendments,
    classifiedRelations,
    nodeResolutionPolicy,
    resolution,
    condensation,
    reconciliation,
    metrics,
    indexInput
  );
  return Object.freeze({
    indexHash: index.indexHash,
    explain(queryInput) {
      return explanationFor(index, exactQuery(queryInput));
    }
  });
}
