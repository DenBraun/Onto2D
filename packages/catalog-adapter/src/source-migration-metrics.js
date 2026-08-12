import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical,
  isContentHash,
  verifySourceClassificationAmendments
} from "@onto2d/kernel";
import { verifySourceMigrationReconciliationReport } from "./source-migration-diagnostics.js";

export const SOURCE_MIGRATION_METRICS_VERSION = "source-migration-metrics-v1";
export const SOURCE_MIGRATION_METRICS_LIMITS = deepFreeze({
  maxNodes: 20_000,
  maxRawComponents: 20_000,
  maxCatalogueLevel: 1_000_000,
  maxIdentifierLength: 1_024
});

const INPUT_FIELDS = new Set([
  "schemaVersion",
  "reconciliationHash",
  "rawSccDispositions",
  "catalogueLevels"
]);
const DISPOSITION_FIELDS = new Set([
  "rawComponentId",
  "primaryResolution",
  "resultingCluster",
  "rationaleArtifact"
]);
const LEVEL_FIELDS = new Set(["sourceId", "catalogueLevel"]);
const ARTIFACT_REF_FIELDS = new Set([
  "path",
  "mediaType",
  "schemaVersion",
  "bytes",
  "hash"
]);
const PRIMARY_RESOLUTIONS = new Set([
  "distributed-structure-merge",
  "constitutive-condensation",
  "generative-condensation",
  "mixed-condensation",
  "nonformation-layer-separation",
  "post-unblinding-reclassification"
]);
const FORMATION_KINDS = new Set([
  "generative",
  "constitutive",
  "intra-closure-support"
]);
const CLUSTER_RESOLUTION_BY_DISPOSITION = Object.freeze({
  "distributed-structure": "distributed-structure-merge",
  "constitutive-cluster": "constitutive-condensation",
  "unresolved-generative-cluster": "generative-condensation",
  "mixed-unresolved-cluster": "mixed-condensation"
});
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
    stage: "SOURCE_MIGRATION_METRICS",
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
      "SOURCE_MIGRATION_METRICS_INPUT_INVALID",
      `${label} must be canonicalizable.`,
      { causeCode: error.code }
    );
  }
}

function exactFields(value, allowed, required, path, code) {
  if (!isObject(value)) {
    fail(code, "Source migration metric records must be objects.", { path });
  }
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Source migration metric fields do not match the contract.", {
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
    value.length > SOURCE_MIGRATION_METRICS_LIMITS.maxIdentifierLength
  ) {
    fail(code, "Source migration identifiers must be normalized and bounded.", {
      path,
      maximum: SOURCE_MIGRATION_METRICS_LIMITS.maxIdentifierLength
    });
  }
  return value;
}

function artifactRef(value, path, code) {
  exactFields(value, ARTIFACT_REF_FIELDS, [...ARTIFACT_REF_FIELDS], path, code);
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
    fail(code, "Raw-SCC dispositions require a complete rationale reference.", {
      path
    });
  }
  return value;
}

function normalizeCatalogueLevels(levelsInput, resolution) {
  const code = "SOURCE_MIGRATION_CATALOGUE_LEVELS_INVALID";
  const value = cloneInput(levelsInput, "Source catalogue levels");
  if (
    !Array.isArray(value) ||
    value.length > SOURCE_MIGRATION_METRICS_LIMITS.maxNodes
  ) {
    fail(code, "Source catalogue levels must be a bounded array.");
  }
  const expected = new Set(resolution.sourceNodes.map((entry) => entry.id));
  const levels = value.map((entry, index) => {
    const path = `$.catalogueLevels[${index}]`;
    exactFields(entry, LEVEL_FIELDS, [...LEVEL_FIELDS], path, code);
    const sourceId = identifier(entry.sourceId, `${path}.sourceId`, code);
    if (!expected.has(sourceId)) {
      fail(code, "A catalogue-level record names no reconciled source node.", {
        sourceId
      });
    }
    if (
      !Number.isSafeInteger(entry.catalogueLevel) ||
      entry.catalogueLevel < 0 ||
      entry.catalogueLevel > SOURCE_MIGRATION_METRICS_LIMITS.maxCatalogueLevel
    ) {
      fail(code, "Catalogue levels must be bounded non-negative safe integers.", {
        sourceId,
        maximum: SOURCE_MIGRATION_METRICS_LIMITS.maxCatalogueLevel
      });
    }
    return { sourceId, catalogueLevel: entry.catalogueLevel };
  }).sort((left, right) => compareStrings(left.sourceId, right.sourceId));
  const ids = levels.map((entry) => entry.sourceId);
  const missing = [...expected].filter((sourceId) => !ids.includes(sourceId));
  if (
    new Set(ids).size !== ids.length ||
    missing.length !== 0 ||
    levels.length !== expected.size
  ) {
    fail(code, "Every reconciled source node requires exactly one catalogue level.", {
      missing,
      expected: expected.size,
      actual: levels.length
    });
  }
  return levels;
}

function changedRelationsByRawComponent(component, amendments, relationById) {
  const members = new Set(component.members);
  const changed = new Set(amendments.changes.map((entry) => entry.relationId));
  return [...changed].filter((relationId) => {
    const relation = relationById.get(relationId);
    return relation !== undefined &&
      members.has(relation.source) && members.has(relation.target);
  });
}

function isStronglyConnected(members, relations, kindField) {
  const memberSet = new Set(members);
  const adjacency = new Map(members.map((member) => [member, new Set()]));
  const reverse = new Map(members.map((member) => [member, new Set()]));
  for (const relation of relations) {
    if (
      !memberSet.has(relation.source) ||
      !memberSet.has(relation.target) ||
      !FORMATION_KINDS.has(relation[kindField])
    ) {
      continue;
    }
    adjacency.get(relation.source).add(relation.target);
    reverse.get(relation.target).add(relation.source);
  }
  function reachesAll(graph) {
    const seen = new Set([members[0]]);
    const stack = [members[0]];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const target of graph.get(current)) {
        if (seen.has(target)) continue;
        seen.add(target);
        stack.push(target);
      }
    }
    return seen.size === members.length;
  }
  return reachesAll(adjacency) && reachesAll(reverse);
}

function normalizeDispositions(
  dispositionsInput,
  report,
  resolution,
  amendments,
  classified
) {
  const code = "SOURCE_MIGRATION_SCC_DISPOSITIONS_INVALID";
  const value = cloneInput(dispositionsInput, "Raw-SCC dispositions");
  if (
    !Array.isArray(value) ||
    value.length > SOURCE_MIGRATION_METRICS_LIMITS.maxRawComponents
  ) {
    fail(code, "Raw-SCC dispositions must be a bounded array.");
  }
  const componentById = new Map(
    report.rawGraph.components.map((entry) => [entry.componentId, entry])
  );
  const vertexById = new Map(resolution.vertices.map((entry) => [entry.vertexId, entry]));
  const vertexBySource = new Map(
    resolution.memberIndex.map((entry) => [entry.sourceId, entry.vertexId])
  );
  const relationById = new Map(classified.relations.map((entry) => [entry.id, entry]));
  const dispositions = value.map((entry, index) => {
    const path = `$.rawSccDispositions[${index}]`;
    exactFields(
      entry,
      DISPOSITION_FIELDS,
      ["rawComponentId", "primaryResolution", "rationaleArtifact"],
      path,
      code
    );
    const rawComponentId = identifier(
      entry.rawComponentId,
      `${path}.rawComponentId`,
      code
    );
    if (!isContentHash(rawComponentId) || !componentById.has(rawComponentId)) {
      fail(code, "A raw-SCC disposition names no reconciled raw component.", {
        rawComponentId
      });
    }
    if (!PRIMARY_RESOLUTIONS.has(entry.primaryResolution)) {
      fail(code, "A raw-SCC disposition uses an unsupported resolution.", {
        rawComponentId,
        primaryResolution: entry.primaryResolution
      });
    }
    const component = componentById.get(rawComponentId);
    const resolvedVertexIds = new Set(
      component.members.map((sourceId) => vertexBySource.get(sourceId))
    );
    const changedRelationIds = changedRelationsByRawComponent(
      component,
      amendments,
      relationById
    ).sort(compareStrings);
    const internalRelations = component.internalRelationIds.map((relationId) =>
      relationById.get(relationId)
    );
    const postUnblindingResolved = changedRelationIds.length > 0 &&
      internalRelations.every((relation) => "frozenKind" in relation) &&
      isStronglyConnected(component.members, internalRelations, "frozenKind") &&
      !isStronglyConnected(component.members, internalRelations, "kind");
    const clusterResolution = resolvedVertexIds.size === 1 &&
      vertexById.get([...resolvedVertexIds][0])?.kind === "condensed-cluster";
    if (clusterResolution) {
      const cluster = vertexById.get([...resolvedVertexIds][0]);
      const expectedPrimary = CLUSTER_RESOLUTION_BY_DISPOSITION[cluster.disposition];
      if (
        entry.primaryResolution !== expectedPrimary ||
        entry.resultingCluster !== cluster.vertexId
      ) {
        fail(code, "A condensed raw-SCC disposition contradicts reviewed resolution.", {
          rawComponentId,
          expectedPrimary,
          expectedCluster: cluster.vertexId,
          actualPrimary: entry.primaryResolution,
          actualCluster: entry.resultingCluster ?? null
        });
      }
    } else {
      const expectedPrimary = postUnblindingResolved
        ? "post-unblinding-reclassification"
        : "nonformation-layer-separation";
      if (
        entry.primaryResolution !== expectedPrimary ||
        Object.hasOwn(entry, "resultingCluster")
      ) {
        fail(code, "A separated raw-SCC disposition contradicts reviewed resolution.", {
          rawComponentId,
          resolvedVertices: resolvedVertexIds.size,
          changedRelationIds,
          expectedPrimary,
          actualPrimary: entry.primaryResolution
        });
      }
    }
    return {
      rawComponentId,
      members: component.members,
      edgeIds: component.internalRelationIds,
      primaryResolution: entry.primaryResolution,
      ...(clusterResolution ? { resultingCluster: entry.resultingCluster } : {}),
      rationaleArtifact: artifactRef(
        entry.rationaleArtifact,
        `${path}.rationaleArtifact`,
        code
      )
    };
  }).sort((left, right) => compareStrings(left.rawComponentId, right.rawComponentId));
  const ids = dispositions.map((entry) => entry.rawComponentId);
  const missing = [...componentById.keys()].filter((id) => !ids.includes(id));
  if (
    new Set(ids).size !== ids.length ||
    missing.length !== 0 ||
    dispositions.length !== componentById.size
  ) {
    fail(code, "Every raw nontrivial SCC requires exactly one disposition.", {
      missing,
      expected: componentById.size,
      actual: dispositions.length
    });
  }
  return dispositions;
}

/** Builds the complete deterministic source-migration metrics artifact. */
export function createSourceMigrationMetrics(
  classificationPolicyInput,
  classificationView,
  annotations,
  adjudication,
  amendmentsInput,
  classifiedRelations,
  nodeResolutionPolicy,
  resolutionInput,
  condensation,
  reconciliationInput,
  metricsInput
) {
  const classificationPolicy = cloneInput(
    classificationPolicyInput,
    "Source classification policy"
  );
  const amendments = verifySourceClassificationAmendments(
    classificationPolicy,
    annotations,
    adjudication,
    amendmentsInput
  );
  const reconciliation = verifySourceMigrationReconciliationReport(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendments,
    classifiedRelations,
    nodeResolutionPolicy,
    resolutionInput,
    condensation,
    reconciliationInput
  );
  const resolution = cloneInput(resolutionInput, "Source node resolution");
  const classified = cloneInput(classifiedRelations, "Classified source relations");
  const input = cloneInput(metricsInput, "Source migration metrics input");
  const code = "SOURCE_MIGRATION_METRICS_INVALID";
  exactFields(input, INPUT_FIELDS, [...INPUT_FIELDS], "$", code);
  if (
    input.schemaVersion !== "1" ||
    input.reconciliationHash !== reconciliation.reportHash
  ) {
    fail(code, "Migration metrics are not bound to the verified reconciliation report.");
  }
  const catalogueLevels = normalizeCatalogueLevels(
    input.catalogueLevels,
    resolution
  );
  const dispositions = normalizeDispositions(
    input.rawSccDispositions,
    reconciliation,
    resolution,
    amendments,
    classified
  );
  const levelBySource = new Map(
    catalogueLevels.map((entry) => [entry.sourceId, entry.catalogueLevel])
  );
  const crossCatalogueLevelClusters = resolution.vertices.filter((vertex) =>
    vertex.kind === "condensed-cluster" &&
    new Set(vertex.members.map((sourceId) => levelBySource.get(sourceId))).size > 1
  ).length;
  const riskPolicyHash = hashCanonical(
    HASH_DOMAINS.SOURCE_MIGRATION_RISK_POLICY,
    {
      schemaVersion: "1",
      classificationPolicyHash: classificationPolicy.policyHash,
      riskPolicy: classificationPolicy.riskPolicy
    },
    CANONICAL_OPTIONS
  );
  const basis = {
    schemaVersion: "1",
    builder: SOURCE_MIGRATION_METRICS_VERSION,
    classificationPolicyHash: classificationPolicy.policyHash,
    amendmentsHash: amendments.amendmentsHash,
    reconciliationHash: reconciliation.reportHash,
    rawNodes: reconciliation.rawGraph.nodes,
    rawEdges: reconciliation.rawGraph.relations,
    rawNontrivialSccs: reconciliation.rawGraph.nontrivialSccs,
    rawSccSizeHistogram: reconciliation.rawGraph.sizeHistogram,
    largestRawScc: reconciliation.rawGraph.largestScc,
    twoNodeSccs: reconciliation.rawGraph.twoNodeSccs,
    classifiedEdges: reconciliation.classification.edgesByKind,
    blindnessStatus: reconciliation.classification.blindnessStatus,
    classificationDisagreementRatio:
      reconciliation.classification.disagreementRatio,
    postUnblindingChanges: amendments.statistics.changeCount,
    dispositions,
    nonformationLayerResolutionShare:
      reconciliation.resolution.nonformationLayerResolutionShare,
    descriptiveResolutionShare:
      reconciliation.resolution.descriptiveResolutionShare,
    postUnblindingReclassificationShare:
      amendments.statistics.changedRelationShare,
    condensedClusters: reconciliation.resolution.condensedClusters,
    constitutiveClusters: reconciliation.resolution.constitutiveClusters,
    constitutiveClusterSizeHistogram:
      reconciliation.resolution.constitutiveClusterSizeHistogram,
    crossCatalogueLevelClusters,
    clusteredSourceRecordRatio:
      reconciliation.resolution.clusteredSourceRecordRatio,
    catalogueLevels,
    riskPolicyHash,
    fittingRisk: reconciliation.riskSignals.fittingRisk,
    fittingRiskReasons: reconciliation.riskSignals.fittingRiskReasons
  };
  return deepFreeze({
    ...basis,
    metricsHash: hashCanonical(
      HASH_DOMAINS.SOURCE_MIGRATION_METRICS,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Exactly replays a serialized complete source-migration metrics artifact. */
export function verifySourceMigrationMetrics(
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
  metricsInput
) {
  const supplied = cloneInput(metricsInput, "Source migration metrics");
  const reproduced = createSourceMigrationMetrics(
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
    {
      schemaVersion: supplied?.schemaVersion,
      reconciliationHash: supplied?.reconciliationHash,
      rawSccDispositions: Array.isArray(supplied?.dispositions)
        ? supplied.dispositions.map((entry) => ({
            rawComponentId: entry.rawComponentId,
            primaryResolution: entry.primaryResolution,
            ...(Object.hasOwn(entry, "resultingCluster")
              ? { resultingCluster: entry.resultingCluster }
              : {}),
            rationaleArtifact: entry.rationaleArtifact
          }))
        : supplied?.dispositions,
      catalogueLevels: supplied?.catalogueLevels
    }
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_MIGRATION_METRICS_MISMATCH",
      "Source migration metrics differ from deterministic replay.",
      {
        expected: reproduced.metricsHash,
        actual: isObject(supplied) ? supplied.metricsHash ?? null : null
      }
    );
  }
  return reproduced;
}
