import {
  HASH_DOMAINS,
  KernelError,
  SOURCE_RELATION_KINDS,
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical,
  verifySourceClassificationAmendments
} from "@onto2d/kernel";
import {
  SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION,
  buildSourceClassifiedRelations,
  buildSourceEffectiveClassifiedRelations
} from "./source-projection.js";
import { verifySourceCondensation } from "./source-condensation.js";

export const SOURCE_MIGRATION_RECONCILIATION_VERSION =
  "source-migration-reconciliation-v1";

const FORMATION_KINDS = new Set([
  "generative",
  "constitutive",
  "intra-closure-support"
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
    stage: "SOURCE_MIGRATION_RECONCILIATION",
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
      "SOURCE_MIGRATION_RECONCILIATION_INPUT_INVALID",
      `${label} must be canonicalizable.`,
      { causeCode: error.code }
    );
  }
}

function stronglyConnectedComponents(nodes, relations, projection) {
  const orderedNodes = [...nodes].sort(compareStrings);
  const adjacencySets = new Map(orderedNodes.map((node) => [node, new Set()]));
  const reverseSets = new Map(orderedNodes.map((node) => [node, new Set()]));
  for (const relation of relations) {
    adjacencySets.get(relation.source).add(relation.target);
    reverseSets.get(relation.target).add(relation.source);
  }
  const adjacency = new Map(orderedNodes.map((node) => [
    node,
    [...adjacencySets.get(node)].sort(compareStrings)
  ]));
  const reverse = new Map(orderedNodes.map((node) => [
    node,
    [...reverseSets.get(node)].sort(compareStrings)
  ]));
  const visited = new Set();
  const finishOrder = [];
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

  const components = [];
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
    members.sort(compareStrings);
    const memberSet = new Set(members);
    const internalRelations = relations
      .filter((relation) =>
        memberSet.has(relation.source) && memberSet.has(relation.target)
      )
      .map(({ id, source, target, kind }) => ({ id, source, target, kind }))
      .sort((left, right) => compareStrings(left.id, right.id));
    const basis = {
      schemaVersion: "1",
      projection,
      members,
      internalRelations
    };
    components.push({
      componentId: hashCanonical(
        HASH_DOMAINS.SOURCE_SCC_COMPONENT,
        basis,
        CANONICAL_OPTIONS
      ),
      members,
      internalRelationIds: internalRelations.map((relation) => relation.id)
    });
  }
  return components.sort((left, right) => compareStrings(
    canonicalize(left.members, CANONICAL_OPTIONS),
    canonicalize(right.members, CANONICAL_OPTIONS)
  ));
}

function isStronglyConnected(members, relations) {
  const memberSet = new Set(members);
  const adjacency = new Map(members.map((member) => [member, new Set()]));
  const reverse = new Map(members.map((member) => [member, new Set()]));
  for (const relation of relations) {
    if (!memberSet.has(relation.source) || !memberSet.has(relation.target)) {
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
        if (!seen.has(target)) {
          seen.add(target);
          stack.push(target);
        }
      }
    }
    return seen.size === members.length;
  }
  return reachesAll(adjacency) && reachesAll(reverse);
}

function sizeHistogram(components) {
  const counts = new Map();
  for (const component of components) {
    const key = String(component.members.length);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => Number(left[0]) - Number(right[0]))
  );
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function rawResolutionDiagnostics(rawComponents, relations) {
  let nonformationResolved = 0;
  let descriptiveResolved = 0;
  for (const component of rawComponents) {
    const internal = relations.filter((relation) =>
      component.members.includes(relation.source) &&
      component.members.includes(relation.target)
    );
    const formation = internal.filter((relation) => FORMATION_KINDS.has(relation.kind));
    if (isStronglyConnected(component.members, formation)) continue;
    nonformationResolved += 1;
    const withDescriptive = internal.filter((relation) =>
      FORMATION_KINDS.has(relation.kind) || relation.kind === "descriptive"
    );
    if (isStronglyConnected(component.members, withDescriptive)) {
      descriptiveResolved += 1;
    }
  }
  return { nonformationResolved, descriptiveResolved };
}

function reportBasis(
  policy,
  adjudication,
  amendments,
  classified,
  resolution,
  condensation
) {
  const allNodes = resolution.sourceNodes.map((entry) => entry.id);
  const rawComponents = stronglyConnectedComponents(
    allNodes,
    classified.relations,
    "raw-all-relations"
  ).filter((component) => component.members.length > 1);
  const { nonformationResolved, descriptiveResolved } =
    rawResolutionDiagnostics(rawComponents, classified.relations);
  const clusters = resolution.vertices.filter((entry) =>
    entry.kind === "condensed-cluster"
  );
  const constitutiveClusters = clusters.filter((entry) =>
    entry.disposition === "constitutive-cluster"
  );
  const clusteredSourceRecords = clusters.reduce(
    (total, entry) => total + entry.members.length,
    0
  );
  const destinationCounts = {
    "inter-cluster": 0,
    internal: 0,
    "typed-explanation": 0
  };
  for (const relation of resolution.relationDestinations) {
    destinationCounts[relation.destination] += 1;
  }
  const rawCount = rawComponents.length;
  const descriptiveResolutionShare = ratio(descriptiveResolved, rawCount);
  const disagreementRatio = adjudication.statistics.disagreementRatio;
  const disagreementMaximum =
    policy.riskPolicy.maximumClassificationDisagreementRatio;
  const descriptiveMaximum =
    policy.riskPolicy.maximumDescriptiveResolutionShare;
  const descriptiveThresholdExceeded =
    descriptiveResolutionShare > descriptiveMaximum;
  const fittingRiskReasons = [
    ...amendments.fittingRiskReasons,
    ...(descriptiveThresholdExceeded
      ? ["descriptive-resolution-threshold-exceeded"]
      : [])
  ];

  return {
    schemaVersion: "1",
    reporter: SOURCE_MIGRATION_RECONCILIATION_VERSION,
    classificationPolicyHash: policy.policyHash,
    annotationHash: classified.annotationHash,
    adjudicationHash: classified.adjudicationHash,
    amendmentsHash: amendments.amendmentsHash,
    projectionHash: classified.projectionHash,
    resolutionHash: resolution.resolutionHash,
    condensationHash: condensation.condensationHash,
    rawGraph: {
      nodes: allNodes.length,
      relations: classified.relations.length,
      nontrivialSccs: rawCount,
      sizeHistogram: sizeHistogram(rawComponents),
      largestScc: rawComponents.reduce(
        (maximum, entry) => Math.max(maximum, entry.members.length),
        0
      ),
      twoNodeSccs: rawComponents.filter((entry) => entry.members.length === 2).length,
      components: rawComponents
    },
    classification: {
      edgesByKind: Object.fromEntries(SOURCE_RELATION_KINDS.map((kind) => [
        kind,
        classified.statistics.classifiedByKind[kind]
      ])),
      blindnessStatus: policy.exposure.status,
      disagreementCount: adjudication.statistics.disagreementCount,
      disagreementRatio,
      generativeCyclicComponents:
        classified.statistics.generativeCyclicComponentCount,
      formationSupportCyclicComponents:
        classified.statistics.formationSupportCyclicComponentCount
    },
    resolution: {
      vertices: resolution.vertices.length,
      condensedClusters: clusters.length,
      constitutiveClusters: constitutiveClusters.length,
      clusteredSourceRecords,
      clusteredSourceRecordRatio: ratio(clusteredSourceRecords, allNodes.length),
      constitutiveClusterSizeHistogram: sizeHistogram(constitutiveClusters),
      destinationCounts,
      nonformationResolvedRawSccs: nonformationResolved,
      nonformationLayerResolutionShare: ratio(nonformationResolved, rawCount),
      descriptiveResolvedRawSccs: descriptiveResolved,
      descriptiveResolutionShare
    },
    riskSignals: {
      historicalExposure: policy.exposure.status === "historically-exposed",
      classificationDisagreement: {
        actual: disagreementRatio,
        maximum: disagreementMaximum,
        exceeded: disagreementRatio > disagreementMaximum
      },
      descriptiveResolution: {
        actual: descriptiveResolutionShare,
        maximum: descriptiveMaximum,
        exceeded: descriptiveThresholdExceeded
      },
      postUnblindingReclassification: {
        actual: amendments.statistics.changedRelationShare,
        maximum:
          amendments.statistics.maximumPostUnblindingReclassificationShare,
        exceeded: amendments.statistics.thresholdExceeded
      },
      fittingRisk: fittingRiskReasons.length === 0 ? "not-flagged" : "elevated",
      fittingRiskReasons,
      effectiveClassification: "current"
    },
    reconciliation: {
      nodesExactlyOnce:
        resolution.memberIndex.length === allNodes.length &&
        new Set(resolution.memberIndex.map((entry) => entry.sourceId)).size ===
          allNodes.length,
      relationsExactlyOnce:
        resolution.relationDestinations.length === classified.relations.length &&
        new Set(resolution.relationDestinations.map((entry) => entry.relationId)).size ===
          classified.relations.length,
      quotientIsDag:
        condensation.quotient.topologicalOrder.length ===
        condensation.quotient.vertexIds.length
    }
  };
}

/** Derives available loss/conservation diagnostics from fully reviewed artifacts. */
export function createSourceMigrationReconciliationReport(
  classificationPolicyInput,
  classificationViewInput,
  annotationsInput,
  adjudicationInput,
  amendmentsInput,
  classifiedRelationsInput,
  nodeResolutionPolicyInput,
  resolutionInput,
  condensationInput
) {
  const classificationPolicy = cloneInput(
    classificationPolicyInput,
    "Source classification policy"
  );
  const classificationView = cloneInput(
    classificationViewInput,
    "Source classification view"
  );
  const annotations = cloneInput(annotationsInput, "Source annotations");
  const adjudication = cloneInput(adjudicationInput, "Source adjudication");
  const amendments = verifySourceClassificationAmendments(
    classificationPolicy,
    annotations,
    adjudication,
    amendmentsInput
  );
  const suppliedClassified = cloneInput(
    classifiedRelationsInput,
    "Classified source relations"
  );
  const effectiveProjectionSupplied =
    suppliedClassified?.builder === SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION;
  if (amendments.statistics.changeCount !== 0 && !effectiveProjectionSupplied) {
    fail(
      "SOURCE_MIGRATION_REPROJECTION_REQUIRED",
      "Post-unblinding changes require an effective classified projection and new reviewed downstream artifacts.",
      {
        amendmentsHash: amendments.amendmentsHash,
        changes: amendments.statistics.changeCount
      }
    );
  }
  const classified = effectiveProjectionSupplied
    ? buildSourceEffectiveClassifiedRelations(
        classificationPolicy,
        classificationView,
        annotations,
        adjudication,
        amendments
      )
    : buildSourceClassifiedRelations(
        classificationPolicy,
        classificationView,
        annotations,
        adjudication
      );
  if (
    canonicalize(classified, CANONICAL_OPTIONS) !==
    canonicalize(suppliedClassified, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_MIGRATION_CLASSIFIED_RELATIONS_MISMATCH",
      "Migration diagnostics require the exactly reproduced classified relations."
    );
  }
  const condensation = verifySourceCondensation(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    classified,
    nodeResolutionPolicyInput,
    resolutionInput,
    condensationInput,
    amendments
  );
  const resolution = cloneInput(resolutionInput, "Source node resolution");
  const basis = reportBasis(
    classificationPolicy,
    adjudication,
    amendments,
    classified,
    resolution,
    condensation
  );
  if (
    !basis.reconciliation.nodesExactlyOnce ||
    !basis.reconciliation.relationsExactlyOnce ||
    !basis.reconciliation.quotientIsDag
  ) {
    fail(
      "SOURCE_MIGRATION_RECONCILIATION_FAILED",
      "Verified source artifacts do not reconcile nodes, relations, and quotient order."
    );
  }
  return deepFreeze({
    ...basis,
    reportHash: hashCanonical(
      HASH_DOMAINS.SOURCE_MIGRATION_RECONCILIATION,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Exactly replays a serialized reconciliation report and its full upstream chain. */
export function verifySourceMigrationReconciliationReport(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reportInput
) {
  const supplied = cloneInput(
    reportInput,
    "Source migration reconciliation report"
  );
  const reproduced = createSourceMigrationReconciliationReport(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendments,
    classifiedRelations,
    nodeResolutionPolicy,
    resolution,
    condensation
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_MIGRATION_RECONCILIATION_MISMATCH",
      "Source migration reconciliation report differs from deterministic replay.",
      {
        expected: reproduced.reportHash,
        actual: isObject(supplied) ? supplied.reportHash ?? null : null
      }
    );
  }
  return reproduced;
}
