import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CATALOG_ADAPTER_CAPABILITIES,
  CATALOG_ADAPTER_STATUS,
  SOURCE_CLASSIFICATION_VIEW_VERSION,
  SOURCE_CLUSTER_CONCENTRATION_LIMITS,
  SOURCE_CLUSTER_CONCENTRATION_VERSION,
  SOURCE_CONDENSATION_LIMITS,
  SOURCE_CONDENSATION_VERSION,
  SOURCE_CLASSIFIED_RELATIONS_VERSION,
  SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION,
  SOURCE_NODE_RESOLUTION_VERSION,
  SOURCE_MIGRATION_RECONCILIATION_VERSION,
  SOURCE_MIGRATION_METRICS_LIMITS,
  SOURCE_MIGRATION_METRICS_VERSION,
  SOURCE_MIGRATION_EXPLANATION_INDEX_VERSION,
  SOURCE_MIGRATION_EXPLANATION_VERSION,
  SOURCE_PROJECTION_LIMITS,
  buildSourceClassifiedRelations,
  buildSourceEffectiveClassifiedRelations,
  condenseSourceRelations,
  createSourceClusterConcentration,
  createSourceMigrationMetrics,
  createSourceMigrationExplanationIndex,
  createSourceMigrationExplanationSession,
  createSourceMigrationReconciliationReport,
  resolveSourceNodes,
  verifySourceCondensation,
  verifySourceClusterConcentration,
  verifySourceEffectiveClassifiedRelations,
  verifySourceMigrationReconciliationReport,
  verifySourceMigrationMetrics,
  verifySourceMigrationExplanationIndex,
  verifySourceNodeResolution,
  createSourceClassificationView
} from "../src/index.js";
import {
  HASH_DOMAINS,
  KernelError,
  SOURCE_RELATION_KINDS,
  CLUSTER_DISPOSITIONS,
  canonicalBytes,
  canonicalize,
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAmendments,
  freezeSourceClassificationAnnotations,
  freezeSourceClassificationPolicy,
  freezeSourceNodeResolutionPolicy,
  hashArtifactBytes,
  hashCanonical
} from "@onto2d/kernel";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const SCHEMA_ROOT = path.join(REPOSITORY_ROOT, "packages", "schemas", "schemas");
const schemaFiles = (await readdir(SCHEMA_ROOT))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const schemas = await Promise.all(schemaFiles.map(async (name) =>
  JSON.parse(await readFile(path.join(SCHEMA_ROOT, name), "utf8"))
));
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
schemas.forEach((schema) => ajv.addSchema(schema));

function assertSchema(name, value) {
  const validate = ajv.getSchema(
    `https://onto2d.dev/schemas/v1/${name}.schema.json`
  );
  assert.ok(validate, `missing compiled schema ${name}`);
  assert.equal(
    validate(value),
    true,
    ajv.errorsText(validate.errors, { dataVar: name, separator: "\n" })
  );
}

function relationRule(kind) {
  return {
    decisionQuestion: `Does this relation satisfy ${kind}?`,
    necessaryObservations: [`necessary ${kind}`],
    sufficientObservations: [`sufficient ${kind}`],
    inclusions: [`include ${kind}`],
    exclusions: [`exclude ${kind}`],
    counterexamples: [`counterexample ${kind}`]
  };
}

function policyDraft() {
  return {
    schemaVersion: "1",
    version: "projection-policy-v1",
    authorship: {
      mode: "human-independent",
      minimumIndependentClassifiers: 2,
      adjudicationRule: "A blind reviewer records the final supported kind."
    },
    exposure: {
      status: "prospective-blind",
      declaration: "Policy and classifiers have not seen SCC-aware material.",
      sccAwareMaterialSeenBeforeFreeze: false
    },
    visibleFields: ["source", "statement", "target"],
    forbiddenInputs: [
      "cycle-visualization",
      "desired-topology",
      "quotient-acyclicity-effect",
      "scc-membership"
    ],
    relationKinds: Object.fromEntries(
      SOURCE_RELATION_KINDS.map((kind) => [kind, relationRule(kind)])
    ),
    conflictRule: "Preserve all raw annotations before adjudication.",
    riskPolicy: {
      maximumClassificationDisagreementRatio: 0.5,
      maximumDescriptiveResolutionShare: 0.25,
      maximumPostUnblindingReclassificationShare: 0.05,
      acceptedBlindness: ["prospective-blind"]
    }
  };
}

const relationKinds = {
  "relation-1": "generative",
  "relation-2": "generative",
  "relation-3": "constitutive",
  "relation-4": "constitutive",
  "relation-5": "descriptive",
  "relation-6": "evidential",
  "relation-7": "generative",
  "relation-8": "generative",
  "relation-9": "generative"
};

function rawRelations() {
  return [
    ["relation-1", "A", "B"],
    ["relation-2", "B", "A"],
    ["relation-3", "B", "C"],
    ["relation-4", "C", "B"],
    ["relation-5", "C", "D"],
    ["relation-6", "D", "D"],
    ["relation-7", "D", "D"],
    ["relation-8", "D", "E"],
    ["relation-9", "D", "C"]
  ].map(([id, source, target]) => ({
    id,
    source,
    target,
    fields: {
      source,
      statement: `Local statement for ${id}`,
      target
    }
  }));
}

function classifier(id) {
  return {
    id,
    type: "human",
    exposure: {
      status: "prospective-blind",
      declaration: `${id} has not seen SCC-aware material.`,
      sccAwareMaterialSeenBeforeAnnotation: false
    }
  };
}

function freezeChain({ reverse = false } = {}) {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const relationInput = reverse ? rawRelations().reverse() : rawRelations();
  const view = createSourceClassificationView(policy, relationInput);
  const classifierIds = reverse ? ["classifier-b", "classifier-a"] : ["classifier-a", "classifier-b"];
  const relationIds = Object.keys(relationKinds);
  let annotationRecords = relationIds.flatMap((relationId) =>
    classifierIds.map((classifierId) => ({
      relationId,
      classifierId,
      kind: relationKinds[relationId],
      observations: [`Observed ${relationId}`],
      rationale: `The frozen rule classifies ${relationId} as ${relationKinds[relationId]}.`
    }))
  );
  if (reverse) annotationRecords = annotationRecords.reverse();
  const annotations = freezeSourceClassificationAnnotations(policy, {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    view: {
      hash: view.viewHash,
      visibleFields: reverse ? [...policy.visibleFields].reverse() : policy.visibleFields,
      relationIds: reverse ? [...relationIds].reverse() : relationIds
    },
    frozenAt: "2026-08-07T10:00:00.000Z",
    classifiers: classifierIds.map(classifier),
    annotations: annotationRecords
  });
  let decisions = relationIds.map((relationId) => ({
    relationId,
    kind: relationKinds[relationId],
    rationale: `Both classifiers agreed on ${relationKinds[relationId]}.`
  }));
  if (reverse) decisions = decisions.reverse();
  const adjudication = freezeSourceClassificationAdjudication(policy, annotations, {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    annotationHash: annotations.annotationHash,
    frozenAt: "2026-08-07T11:00:00.000Z",
    unblindedAt: "2026-08-07T12:00:00.000Z",
    adjudicator: classifier("adjudicator"),
    decisions
  });
  const amendments = freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    {
      schemaVersion: "1",
      policyHash: policy.policyHash,
      adjudicationHash: adjudication.adjudicationHash,
      frozenAt: "2026-08-07T13:00:00.000Z",
      changes: []
    }
  );
  return { policy, view, annotations, adjudication, amendments };
}

test("classification view exposes exactly frozen local fields and has order-independent identity", () => {
  const first = freezeChain();
  const reversed = freezeChain({ reverse: true });
  const { viewHash, ...basis } = first.view;

  assert.equal(SOURCE_CLASSIFICATION_VIEW_VERSION, "source-classification-view-v1");
  assert.deepEqual(SOURCE_PROJECTION_LIMITS, {
    maxRelations: 10_000,
    maxIdentifierLength: 1_024
  });
  assert.equal(first.view.viewHash, reversed.view.viewHash);
  assert.deepEqual(first.view.relations.map((relation) => relation.id), Object.keys(relationKinds));
  assert.equal(viewHash, hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_VIEW, basis));
  assert.ok(Object.isFrozen(first.view));
});

test("classification view rejects hidden SCC fields, missing policy fields, and duplicate relation IDs", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const hidden = rawRelations();
  hidden[0].fields["scc-membership"] = ["A", "B"];
  assert.throws(
    () => createSourceClassificationView(policy, hidden),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_VIEW_RELATION_INVALID"
  );
  const missing = rawRelations();
  delete missing[0].fields.statement;
  assert.throws(
    () => createSourceClassificationView(policy, missing),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_VIEW_RELATION_INVALID"
  );
  const substitutedField = rawRelations();
  substitutedField[0].fields.target = "different-target";
  assert.throws(
    () => createSourceClassificationView(policy, substitutedField),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_VIEW_RELATION_INVALID"
  );
  assert.throws(
    () => createSourceClassificationView(policy, [rawRelations()[0], rawRelations()[0]]),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_VIEW_INVALID"
  );
});

test("verified classified relations preserve every edge and derive both required SCC partitions", () => {
  const chain = freezeChain();
  const artifact = buildSourceClassifiedRelations(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication
  );
  const { projectionHash, ...basis } = artifact;
  const generativeCycle = artifact.projections.generative.components.find((component) => component.cyclic);
  const formationCycle = artifact.projections.formationSupport.components.find((component) => component.cyclic);

  assert.equal(SOURCE_CLASSIFIED_RELATIONS_VERSION, "source-classified-relations-v1");
  assert.deepEqual(artifact.statistics.classifiedByKind, {
    generative: 5,
    constitutive: 2,
    "intra-closure-support": 0,
    evidential: 1,
    descriptive: 1,
    "regulatory-feedback": 0
  });
  assert.equal(artifact.relations.length, rawRelations().length);
  assert.equal(new Set(artifact.relations.map((relation) => relation.id)).size, rawRelations().length);
  assert.deepEqual(generativeCycle.members, ["A", "B"]);
  assert.deepEqual(generativeCycle.internalRelationIds, ["relation-1", "relation-2"]);
  assert.deepEqual(formationCycle.members, ["A", "B", "C"]);
  assert.deepEqual(formationCycle.internalRelationIds, [
    "relation-1",
    "relation-2",
    "relation-3",
    "relation-4"
  ]);
  assert.ok(artifact.projections.generative.components.some((component) =>
    component.cyclic && component.members.length === 1 && component.members[0] === "D"
  ));
  assert.equal(artifact.statistics.generativeCyclicComponentCount, 2);
  assert.equal(artifact.statistics.formationSupportCyclicComponentCount, 2);
  assert.equal(
    projectionHash,
    hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFIED_RELATIONS, basis)
  );
  assert.ok(Object.isFrozen(artifact));
});

test("classified relation and SCC identities are independent of all source-chain input ordering", () => {
  const first = freezeChain();
  const reversed = freezeChain({ reverse: true });
  const firstProjection = buildSourceClassifiedRelations(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication
  );
  const reversedProjection = buildSourceClassifiedRelations(
    reversed.policy,
    reversed.view,
    reversed.annotations,
    reversed.adjudication
  );

  assert.equal(first.policy.policyHash, reversed.policy.policyHash);
  assert.equal(first.annotations.annotationHash, reversed.annotations.annotationHash);
  assert.equal(first.adjudication.adjudicationHash, reversed.adjudication.adjudicationHash);
  assert.equal(firstProjection.projectionHash, reversedProjection.projectionHash);
  assert.deepEqual(firstProjection.projections, reversedProjection.projections);
});

test("projection rejects endpoint substitution and altered upstream artifacts", () => {
  const chain = freezeChain();
  const alteredView = {
    ...chain.view,
    relations: chain.view.relations.map((relation, index) =>
      index === 0 ? { ...relation, target: "substituted" } : relation
    )
  };
  assert.throws(
    () => buildSourceClassifiedRelations(
      chain.policy,
      alteredView,
      chain.annotations,
      chain.adjudication
    ),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_VIEW_BINDING_INVALID"
  );
  assert.throws(
    () => buildSourceClassifiedRelations(
      chain.policy,
      chain.view,
      { ...chain.annotations, frozenAt: "2026-08-07T09:00:00.000Z" },
      chain.adjudication
    ),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ANNOTATIONS_BINDING_INVALID"
  );
  assert.throws(
    () => buildSourceClassifiedRelations(
      chain.policy,
      chain.view,
      chain.annotations,
      { ...chain.adjudication, unblindedAt: "2026-08-07T13:00:00.000Z" }
    ),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ADJUDICATION_BINDING_INVALID"
  );
});

test("effective projection applies immutable amendments and recomputes SCCs", () => {
  const chain = freezeChain();
  const reversed = freezeChain({ reverse: true });
  const frozen = buildSourceClassifiedRelations(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication
  );
  const change = {
    relationId: "relation-5",
    newKind: "generative",
    changedAt: "2026-08-07T13:00:00.000Z",
    reason: "Approved evidence establishes a generative relation.",
    approver: { id: "review-board", role: "approval board" },
    approvalArtifact: reviewedArtifact("relation-5-amendment")
  };
  const amendments = freezeSourceClassificationAmendments(
    chain.policy,
    chain.annotations,
    chain.adjudication,
    {
      schemaVersion: "1",
      policyHash: chain.policy.policyHash,
      adjudicationHash: chain.adjudication.adjudicationHash,
      frozenAt: "2026-08-07T14:00:00.000Z",
      changes: [change]
    }
  );
  const effective = buildSourceEffectiveClassifiedRelations(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    amendments
  );
  const reversedAmendments = freezeSourceClassificationAmendments(
    reversed.policy,
    reversed.annotations,
    reversed.adjudication,
    {
      schemaVersion: "1",
      policyHash: reversed.policy.policyHash,
      adjudicationHash: reversed.adjudication.adjudicationHash,
      frozenAt: "2026-08-07T14:00:00.000Z",
      changes: [change]
    }
  );
  const reversedEffective = buildSourceEffectiveClassifiedRelations(
    reversed.policy,
    reversed.view,
    reversed.annotations,
    reversed.adjudication,
    reversedAmendments
  );
  const relation = effective.relations.find((entry) => entry.id === "relation-5");
  const component = effective.projections.formationSupport.components.find((entry) =>
    entry.members.length === 4
  );
  const { projectionHash, ...basis } = effective;

  assert.equal(
    SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION,
    "source-effective-classified-relations-v1"
  );
  assert.equal(effective.frozenProjectionHash, frozen.projectionHash);
  assert.equal(effective.amendmentsHash, amendments.amendmentsHash);
  assert.equal(amendments.amendmentsHash, reversedAmendments.amendmentsHash);
  assert.equal(effective.projectionHash, reversedEffective.projectionHash);
  assert.equal(relation.frozenKind, "descriptive");
  assert.equal(relation.kind, "generative");
  assert.deepEqual(relation.changeIds, [amendments.changes[0].changeId]);
  assert.equal(relation.finalStateHash, amendments.changes[0].changeId);
  assert.deepEqual(component.members, ["A", "B", "C", "D"]);
  assert.deepEqual(effective.statistics.classifiedByKind, {
    generative: 6,
    constitutive: 2,
    "intra-closure-support": 0,
    evidential: 1,
    descriptive: 0,
    "regulatory-feedback": 0
  });
  assert.equal(effective.statistics.changeCount, 1);
  assert.equal(effective.statistics.amendedRelationCount, 1);
  assert.equal(
    projectionHash,
    hashCanonical(HASH_DOMAINS.SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS, basis)
  );
  assertSchema("source-effective-classified-relations", effective);
  assert.equal(
    verifySourceEffectiveClassifiedRelations(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      amendments,
      structuredClone(effective)
    ).projectionHash,
    effective.projectionHash
  );
  const tampered = structuredClone(effective);
  tampered.relations.find((entry) => entry.id === "relation-5").kind = "evidential";
  assert.throws(
    () => verifySourceEffectiveClassifiedRelations(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      amendments,
      tampered
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_MISMATCH"
  );
});

function dispositionRule(disposition) {
  return {
    decisionQuestion: `Does the component satisfy ${disposition}?`,
    criteria: [`criterion ${disposition}`],
    positiveExamples: [`positive ${disposition}`],
    negativeExamples: [`negative ${disposition}`]
  };
}

function frozenResolutionPolicy(classificationPolicyHash) {
  return freezeSourceNodeResolutionPolicy({
    schemaVersion: "1",
    version: "projection-resolution-v1",
    classificationPolicyHash,
    visibleInputs: [
      "classified-relations",
      "source-relation-endpoints",
      "strongly-connected-component-membership"
    ],
    forbiddenCriteria: [
      "component-size-only",
      "cycle-removal-outcome",
      "desired-acyclicity",
      "paper-resemblance-only"
    ],
    dispositionRules: Object.fromEntries(CLUSTER_DISPOSITIONS.map((disposition) => [
      disposition,
      dispositionRule(disposition)
    ])),
    edgeReconciliation: {
      destinations: ["inter-cluster", "internal", "typed-explanation"],
      requireExactlyOnce: true,
      preserveRawRelationReferences: true
    },
    clusterSemantics: {
      internalOrder: "undefined",
      memberDepthInheritance: "cluster-depth",
      requireCondensationDag: true
    },
    reviewRule: "Apply only reviewed dispositions and preserve every source relation."
  });
}

function reviewedArtifact(name) {
  const bytes = canonicalBytes({ name });
  return {
    path: `review/${name}.json`,
    mediaType: "application/json",
    schemaVersion: "1",
    bytes: bytes.byteLength,
    hash: hashArtifactBytes(bytes)
  };
}

function resolutionInputs(classified, { reverse = false } = {}) {
  let sourceNodes = ["A", "B", "C", "D", "E", "F"].map((id) => ({
    id,
    identityHash: hashCanonical(HASH_DOMAINS.ARTIFACT, { sourceNode: id }),
    sourceArtifact: reviewedArtifact(`source-${id}`)
  }));
  const components = classified.projections.formationSupport.components.filter((entry) =>
    entry.cyclic && entry.members.length > 1
  );
  let componentDecisions = components.map((component) => ({
    componentId: component.componentId,
    disposition: "constitutive-cluster",
    rationaleArtifact: reviewedArtifact(
      `component-${component.members.join("").toLowerCase()}`
    )
  }));
  const vertexByNode = new Map();
  for (const component of components) {
    for (const member of component.members) {
      vertexByNode.set(member, component.componentId);
    }
  }
  const formationKinds = new Set([
    "generative",
    "constitutive",
    "intra-closure-support"
  ]);
  let relationDestinations = classified.relations.map((relation) => {
    const sourceVertex = vertexByNode.get(relation.source) ?? relation.source;
    const targetVertex = vertexByNode.get(relation.target) ?? relation.target;
    const destination = sourceVertex === targetVertex && formationKinds.has(relation.kind)
      ? "internal"
      : sourceVertex !== targetVertex && relation.kind === "generative"
        ? "inter-cluster"
        : "typed-explanation";
    return { relationId: relation.id, destination };
  });
  if (reverse) {
    sourceNodes = sourceNodes.reverse();
    componentDecisions = componentDecisions.reverse();
    relationDestinations = relationDestinations.reverse();
  }
  return { sourceNodes, componentDecisions, relationDestinations };
}

function migrationMetricsInput(report, resolution) {
  const vertexBySource = new Map(
    resolution.memberIndex.map((entry) => [entry.sourceId, entry.vertexId])
  );
  const vertexById = new Map(
    resolution.vertices.map((entry) => [entry.vertexId, entry])
  );
  const primaryByDisposition = {
    "distributed-structure": "distributed-structure-merge",
    "constitutive-cluster": "constitutive-condensation",
    "unresolved-generative-cluster": "generative-condensation",
    "mixed-unresolved-cluster": "mixed-condensation"
  };
  const rawSccDispositions = report.rawGraph.components.map((component) => {
    const vertexIds = new Set(
      component.members.map((sourceId) => vertexBySource.get(sourceId))
    );
    if (vertexIds.size === 1) {
      const cluster = vertexById.get([...vertexIds][0]);
      return {
        rawComponentId: component.componentId,
        primaryResolution: primaryByDisposition[cluster.disposition],
        resultingCluster: cluster.vertexId,
        rationaleArtifact: reviewedArtifact(
          `raw-scc-${component.componentId.slice(-12)}`
        )
      };
    }
    return {
      rawComponentId: component.componentId,
      primaryResolution: "nonformation-layer-separation",
      rationaleArtifact: reviewedArtifact(
        `raw-scc-${component.componentId.slice(-12)}`
      )
    };
  });
  const sourceLevels = { A: 0, B: 0, C: 0, D: 1, E: 2, F: 3 };
  return {
    schemaVersion: "1",
    reconciliationHash: report.reportHash,
    rawSccDispositions,
    catalogueLevels: resolution.sourceNodes.map((entry) => ({
      sourceId: entry.id,
      catalogueLevel: sourceLevels[entry.id]
    }))
  };
}

function concentrationInput(metrics, resolution) {
  const cluster = resolution.vertices.find((entry) =>
    entry.kind === "condensed-cluster"
  );
  const vertexByMember = new Map(resolution.vertices.flatMap((vertex) =>
    vertex.members.map((member) => [member, vertex.vertexId])
  ));
  return {
    schemaVersion: "1",
    metricsHash: metrics.metricsHash,
    definition: {
      version: "fixture-bottleneck-definition-v1",
      frozenAt: "2026-08-07T09:00:00.000Z",
      statement: "Bottlenecks are frozen independently of cluster locations.",
      clusterLocationsSeenBeforeFreeze: false,
      exposureDeclaration: "The definition author did not inspect cluster locations.",
      bottleneckArtifact: reviewedArtifact("bottleneck-definition"),
      concentratedAtOrAbove: 1.5,
      depletedAtOrBelow: 0.5
    },
    points: [
      {
        depth: 0,
        depthBasis: hashCanonical(HASH_DOMAINS.DEPTH_BASIS, { depth: 0 }),
        stratificationVertices: 2,
        sourceVertexIds: [vertexByMember.get("D"), vertexByMember.get("E")],
        bottleneck: true
      },
      {
        depth: 1,
        depthBasis: hashCanonical(HASH_DOMAINS.DEPTH_BASIS, { depth: 1 }),
        stratificationVertices: 2,
        sourceVertexIds: [cluster.vertexId, vertexByMember.get("F")],
        bottleneck: false
      }
    ]
  };
}

test("migration metrics identify a post-unblinding SCC resolution", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const view = createSourceClassificationView(policy, [
    {
      id: "xy",
      source: "X",
      target: "Y",
      fields: { source: "X", statement: "X generates Y", target: "Y" }
    },
    {
      id: "yx",
      source: "Y",
      target: "X",
      fields: { source: "Y", statement: "Y generates X", target: "X" }
    }
  ]);
  const annotations = freezeSourceClassificationAnnotations(policy, {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    view: {
      hash: view.viewHash,
      visibleFields: policy.visibleFields,
      relationIds: ["xy", "yx"]
    },
    frozenAt: "2026-08-07T10:00:00.000Z",
    classifiers: [classifier("classifier-a"), classifier("classifier-b")],
    annotations: ["xy", "yx"].flatMap((relationId) =>
      ["classifier-a", "classifier-b"].map((classifierId) => ({
        relationId,
        classifierId,
        kind: "generative",
        observations: [`Observed ${relationId}`],
        rationale: `${relationId} is initially generative.`
      }))
    )
  });
  const adjudication = freezeSourceClassificationAdjudication(
    policy,
    annotations,
    {
      schemaVersion: "1",
      policyHash: policy.policyHash,
      annotationHash: annotations.annotationHash,
      frozenAt: "2026-08-07T11:00:00.000Z",
      unblindedAt: "2026-08-07T12:00:00.000Z",
      adjudicator: classifier("adjudicator"),
      decisions: ["xy", "yx"].map((relationId) => ({
        relationId,
        kind: "generative",
        rationale: `${relationId} was unanimously generative.`
      }))
    }
  );
  const amendments = freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    {
      schemaVersion: "1",
      policyHash: policy.policyHash,
      adjudicationHash: adjudication.adjudicationHash,
      frozenAt: "2026-08-07T14:00:00.000Z",
      changes: [{
        relationId: "yx",
        newKind: "descriptive",
        changedAt: "2026-08-07T13:00:00.000Z",
        reason: "Approved review found the reverse relation descriptive.",
        approver: { id: "review-board", role: "approval board" },
        approvalArtifact: reviewedArtifact("yx-amendment")
      }]
    }
  );
  const classified = buildSourceEffectiveClassifiedRelations(
    policy,
    view,
    annotations,
    adjudication,
    amendments
  );
  const nodePolicy = frozenResolutionPolicy(policy.policyHash);
  const sourceNodes = ["X", "Y"].map((id) => ({
    id,
    identityHash: hashCanonical(HASH_DOMAINS.ARTIFACT, { sourceNode: id }),
    sourceArtifact: reviewedArtifact(`source-${id}`)
  }));
  const resolution = resolveSourceNodes(
    policy,
    view,
    annotations,
    adjudication,
    classified,
    nodePolicy,
    sourceNodes,
    [],
    [
      { relationId: "xy", destination: "inter-cluster" },
      { relationId: "yx", destination: "typed-explanation" }
    ],
    amendments
  );
  const condensation = condenseSourceRelations(
    policy,
    view,
    annotations,
    adjudication,
    classified,
    nodePolicy,
    resolution,
    amendments
  );
  const report = createSourceMigrationReconciliationReport(
    policy,
    view,
    annotations,
    adjudication,
    amendments,
    classified,
    nodePolicy,
    resolution,
    condensation
  );
  const metricsInput = {
    schemaVersion: "1",
    reconciliationHash: report.reportHash,
    rawSccDispositions: [{
      rawComponentId: report.rawGraph.components[0].componentId,
      primaryResolution: "post-unblinding-reclassification",
      rationaleArtifact: reviewedArtifact("xy-post-unblinding-resolution")
    }],
    catalogueLevels: [
      { sourceId: "X", catalogueLevel: 0 },
      { sourceId: "Y", catalogueLevel: 1 }
    ]
  };
  const metrics = createSourceMigrationMetrics(
    policy,
    view,
    annotations,
    adjudication,
    amendments,
    classified,
    nodePolicy,
    resolution,
    condensation,
    report,
    metricsInput
  );

  assert.equal(metrics.rawNontrivialSccs, 1);
  assert.equal(
    metrics.dispositions[0].primaryResolution,
    "post-unblinding-reclassification"
  );
  assert.equal(metrics.condensedClusters, 0);
  assertSchema("source-migration-metrics", metrics);
  const wrongPrimary = structuredClone(metricsInput);
  wrongPrimary.rawSccDispositions[0].primaryResolution =
    "nonformation-layer-separation";
  assert.throws(
    () => createSourceMigrationMetrics(
      policy,
      view,
      annotations,
      adjudication,
      amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      wrongPrimary
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_SCC_DISPOSITIONS_INVALID"
  );
});

test("reviewed source resolution preserves isolated nodes and condenses to a DAG", () => {
  const chain = freezeChain();
  const classified = buildSourceClassifiedRelations(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication
  );
  const nodePolicy = frozenResolutionPolicy(chain.policy.policyHash);
  const inputs = resolutionInputs(classified);
  const resolution = resolveSourceNodes(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    classified,
    nodePolicy,
    inputs.sourceNodes,
    inputs.componentDecisions,
    inputs.relationDestinations
  );
  const condensation = condenseSourceRelations(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    classified,
    nodePolicy,
    resolution
  );
  const report = createSourceMigrationReconciliationReport(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    chain.amendments,
    classified,
    nodePolicy,
    resolution,
    condensation
  );
  const metrics = createSourceMigrationMetrics(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    chain.amendments,
    classified,
    nodePolicy,
    resolution,
    condensation,
    report,
    migrationMetricsInput(report, resolution)
  );
  const concentration = createSourceClusterConcentration(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    chain.amendments,
    classified,
    nodePolicy,
    resolution,
    condensation,
    report,
    metrics,
    concentrationInput(metrics, resolution)
  );
  const explanationIndex = createSourceMigrationExplanationIndex(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    chain.amendments,
    classified,
    nodePolicy,
    resolution,
    condensation,
    report,
    metrics
  );
  const explanationSession = createSourceMigrationExplanationSession(
    chain.policy,
    chain.view,
    chain.annotations,
    chain.adjudication,
    chain.amendments,
    classified,
    nodePolicy,
    resolution,
    condensation,
    report,
    metrics,
    explanationIndex
  );
  const isolatedExplanation = explanationSession.explain({
    kind: "source-node",
    id: "F"
  });
  const relationExplanation = explanationSession.explain({
    kind: "source-relation",
    id: "relation-5"
  });

  assert.equal(SOURCE_NODE_RESOLUTION_VERSION, "source-node-resolution-v1");
  assert.equal(SOURCE_CONDENSATION_VERSION, "source-condensation-v1");
  assert.equal(
    SOURCE_MIGRATION_RECONCILIATION_VERSION,
    "source-migration-reconciliation-v1"
  );
  assert.equal(SOURCE_MIGRATION_METRICS_VERSION, "source-migration-metrics-v1");
  assert.equal(
    SOURCE_CLUSTER_CONCENTRATION_VERSION,
    "source-cluster-concentration-v1"
  );
  assert.deepEqual(SOURCE_CLUSTER_CONCENTRATION_LIMITS, {
    maxPoints: 20_000,
    maxVertices: 20_000,
    maxDepth: 1_000_000,
    maxIdentifierLength: 1_024,
    maxTextLength: 16_384
  });
  assert.equal(
    SOURCE_MIGRATION_EXPLANATION_INDEX_VERSION,
    "source-migration-explanation-index-v1"
  );
  assert.equal(
    SOURCE_MIGRATION_EXPLANATION_VERSION,
    "source-migration-explanation-v1"
  );
  assert.deepEqual(SOURCE_MIGRATION_METRICS_LIMITS, {
    maxNodes: 20_000,
    maxRawComponents: 20_000,
    maxCatalogueLevel: 1_000_000,
    maxIdentifierLength: 1_024
  });
  assert.deepEqual(SOURCE_CONDENSATION_LIMITS, {
    maxNodes: 20_000,
    maxRelations: 10_000,
    maxIdentifierLength: 1_024
  });
  assert.equal(resolution.counts.sourceNodes, 6);
  assert.equal(resolution.counts.sourceRelations, 9);
  assert.equal(resolution.counts.nontrivialComponents, 1);
  assert.equal(resolution.counts.vertices, 4);
  assert.equal(resolution.counts.condensedClusters, 1);
  assert.equal(resolution.counts.internalRelations, 5);
  assert.equal(resolution.counts.interClusterRelations, 2);
  assert.equal(resolution.counts.typedExplanationRelations, 2);
  assert.ok(resolution.memberIndex.some((entry) => entry.sourceId === "F"));
  const sourceIdentity = new Map(inputs.sourceNodes.map((entry) => [
    entry.id,
    entry.identityHash
  ]));
  const cluster = resolution.vertices.find((entry) =>
    entry.kind === "condensed-cluster"
  );
  const structuralRelations = [
    ["A", "B", "generative"],
    ["B", "A", "generative"],
    ["B", "C", "constitutive"],
    ["C", "B", "constitutive"]
  ].map(([source, target, kind]) => ({
    sourceIdentityHash: sourceIdentity.get(source),
    targetIdentityHash: sourceIdentity.get(target),
    kind
  })).sort((left, right) => canonicalize(left) < canonicalize(right)
    ? -1
    : canonicalize(left) > canonicalize(right) ? 1 : 0);
  assert.equal(
    cluster.vertexId,
    hashCanonical(HASH_DOMAINS.SOURCE_RESOLUTION_VERTEX, {
      schemaVersion: "1",
      kind: "condensed-cluster",
      nodeResolutionPolicyHash: nodePolicy.policyHash,
      disposition: "constitutive-cluster",
      memberIdentityHashes: ["A", "B", "C"]
        .map((id) => sourceIdentity.get(id))
        .sort(),
      internalRelations: structuralRelations
    })
  );
  assert.equal(condensation.quotient.generativeEdges.length, 2);
  assert.equal(condensation.quotient.topologicalOrder.length, 4);
  assert.equal(
    new Set(condensation.quotient.topologicalOrder).size,
    condensation.quotient.vertexIds.length
  );
  assert.equal(
    condensation.relationLayers.generative.length,
    5
  );
  assertSchema("source-node-resolution", resolution);
  assertSchema("source-condensation", condensation);
  assertSchema("source-migration-reconciliation", report);
  assertSchema("source-migration-metrics", metrics);
  assertSchema("source-cluster-concentration", concentration);
  assertSchema("source-migration-explanation-index", explanationIndex);
  assertSchema("source-migration-explanation", isolatedExplanation);
  assertSchema("source-migration-explanation", relationExplanation);
  assert.equal(report.rawGraph.nodes, 6);
  assert.equal(report.rawGraph.relations, 9);
  assert.equal(report.rawGraph.nontrivialSccs, 1);
  assert.deepEqual(report.rawGraph.sizeHistogram, { 4: 1 });
  assert.equal(report.rawGraph.largestScc, 4);
  assert.equal(report.rawGraph.twoNodeSccs, 0);
  assert.deepEqual(report.rawGraph.components[0].members, ["A", "B", "C", "D"]);
  assert.equal(report.resolution.clusteredSourceRecords, 3);
  assert.equal(report.resolution.clusteredSourceRecordRatio, 0.5);
  assert.deepEqual(report.resolution.constitutiveClusterSizeHistogram, { 3: 1 });
  assert.equal(report.resolution.nonformationResolvedRawSccs, 1);
  assert.equal(report.resolution.nonformationLayerResolutionShare, 1);
  assert.equal(report.resolution.descriptiveResolvedRawSccs, 1);
  assert.equal(report.resolution.descriptiveResolutionShare, 1);
  assert.equal(report.riskSignals.descriptiveResolution.exceeded, true);
  assert.deepEqual(report.riskSignals.postUnblindingReclassification, {
    actual: 0,
    maximum: 0.05,
    exceeded: false
  });
  assert.equal(report.riskSignals.effectiveClassification, "current");
  assert.equal(report.riskSignals.fittingRisk, "elevated");
  assert.deepEqual(report.riskSignals.fittingRiskReasons, [
    "descriptive-resolution-threshold-exceeded"
  ]);
  assert.deepEqual(report.reconciliation, {
    nodesExactlyOnce: true,
    relationsExactlyOnce: true,
    quotientIsDag: true
  });
  assert.equal(metrics.rawNodes, 6);
  assert.equal(metrics.rawEdges, 9);
  assert.equal(metrics.dispositions.length, 1);
  assert.equal(
    metrics.dispositions[0].primaryResolution,
    "nonformation-layer-separation"
  );
  assert.equal(metrics.crossCatalogueLevelClusters, 0);
  assert.equal(metrics.postUnblindingChanges, 0);
  assert.equal(concentration.pooled.bottleneck.constitutiveMemberShare, 0);
  assert.equal(concentration.pooled.other.constitutiveMemberShare, 0.75);
  assert.equal(concentration.enrichmentRatio, 0);
  assert.equal(concentration.interpretation, "depleted");
  assert.deepEqual(concentration.nullModel, { status: "not-run" });
  assert.deepEqual(concentration.notes, []);
  const reversedConcentrationInput = concentrationInput(metrics, resolution);
  reversedConcentrationInput.points.reverse();
  reversedConcentrationInput.points.forEach((entry) =>
    entry.sourceVertexIds.reverse()
  );
  assert.equal(
    createSourceClusterConcentration(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      metrics,
      reversedConcentrationInput
    ).concentrationHash,
    concentration.concentrationHash
  );
  assert.equal(explanationIndex.statistics.sourceNodeCount, 6);
  assert.equal(explanationIndex.statistics.sourceRelationCount, 9);
  assert.equal(explanationIndex.statistics.amendedRelationCount, 0);
  assert.equal(isolatedExplanation.result.vertexKind, "source-node");
  assert.deepEqual(isolatedExplanation.result.rawComponentIds, []);
  assert.deepEqual(isolatedExplanation.result.inboundRelationIds, []);
  assert.deepEqual(isolatedExplanation.result.outboundRelationIds, []);
  assert.equal(relationExplanation.result.frozenKind, "descriptive");
  assert.equal(relationExplanation.result.effectiveKind, "descriptive");
  assert.deepEqual(relationExplanation.result.changeIds, []);
  const { resolutionHash, ...resolutionBasis } = resolution;
  assert.equal(
    resolutionHash,
    hashCanonical(HASH_DOMAINS.SOURCE_NODE_RESOLUTION, resolutionBasis)
  );
  const { condensationHash, ...condensationBasis } = condensation;
  assert.equal(
    condensationHash,
    hashCanonical(HASH_DOMAINS.SOURCE_CONDENSATION, condensationBasis)
  );
  const { reportHash, ...reportBasis } = report;
  assert.equal(
    reportHash,
    hashCanonical(HASH_DOMAINS.SOURCE_MIGRATION_RECONCILIATION, reportBasis)
  );
  const { metricsHash, ...metricsBasis } = metrics;
  assert.equal(
    metricsHash,
    hashCanonical(HASH_DOMAINS.SOURCE_MIGRATION_METRICS, metricsBasis)
  );
  const { indexHash, ...indexBasis } = explanationIndex;
  assert.equal(
    indexHash,
    hashCanonical(
      HASH_DOMAINS.SOURCE_MIGRATION_EXPLANATION_INDEX,
      indexBasis
    )
  );
  const { concentrationHash, ...concentrationBasis } = concentration;
  assert.equal(
    concentrationHash,
    hashCanonical(
      HASH_DOMAINS.SOURCE_CLUSTER_CONCENTRATION,
      concentrationBasis
    )
  );
  const { explanationHash, ...explanationBasis } = relationExplanation;
  assert.equal(
    explanationHash,
    hashCanonical(HASH_DOMAINS.SOURCE_MIGRATION_EXPLANATION, explanationBasis)
  );
  assert.equal(
    verifySourceNodeResolution(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      classified,
      nodePolicy,
      structuredClone(resolution)
    ).resolutionHash,
    resolution.resolutionHash
  );
  assert.equal(
    verifySourceCondensation(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      classified,
      nodePolicy,
      resolution,
      structuredClone(condensation)
    ).condensationHash,
    condensation.condensationHash
  );
  assert.equal(
    verifySourceMigrationReconciliationReport(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      structuredClone(report)
    ).reportHash,
    report.reportHash
  );
  assert.equal(
    verifySourceMigrationMetrics(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      structuredClone(metrics)
    ).metricsHash,
    metrics.metricsHash
  );
  assert.equal(
    verifySourceMigrationExplanationIndex(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      metrics,
      structuredClone(explanationIndex)
    ).indexHash,
    explanationIndex.indexHash
  );
  assert.equal(
    verifySourceClusterConcentration(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      metrics,
      structuredClone(concentration)
    ).concentrationHash,
    concentration.concentrationHash
  );
  const tamperedConcentration = structuredClone(concentration);
  tamperedConcentration.interpretation = "concentrated";
  assert.throws(
    () => verifySourceClusterConcentration(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      metrics,
      tamperedConcentration
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLUSTER_CONCENTRATION_MISMATCH"
  );
  const exposedDefinition = concentrationInput(metrics, resolution);
  exposedDefinition.definition.clusterLocationsSeenBeforeFreeze = true;
  assert.throws(
    () => createSourceClusterConcentration(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      metrics,
      exposedDefinition
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLUSTER_CONCENTRATION_DEFINITION_INVALID"
  );
  const incompletePoints = concentrationInput(metrics, resolution);
  incompletePoints.points[1].sourceVertexIds.pop();
  assert.throws(
    () => createSourceClusterConcentration(
      chain.policy,
      chain.view,
      chain.annotations,
      chain.adjudication,
      chain.amendments,
      classified,
      nodePolicy,
      resolution,
      condensation,
      report,
      metrics,
      incompletePoints
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLUSTER_CONCENTRATION_POINTS_INVALID"
  );
  assert.throws(
    () => explanationSession.explain({ kind: "source-node", id: "missing" }),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_EXPLANATION_NOT_FOUND"
  );
});

test("source resolution is order-independent and rejects missing or topology-driven decisions", () => {
  const first = freezeChain();
  const reversed = freezeChain({ reverse: true });
  const firstClassified = buildSourceClassifiedRelations(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication
  );
  const reversedClassified = buildSourceClassifiedRelations(
    reversed.policy,
    reversed.view,
    reversed.annotations,
    reversed.adjudication
  );
  const policy = frozenResolutionPolicy(first.policy.policyHash);
  const firstInputs = resolutionInputs(firstClassified);
  const reversedInputs = resolutionInputs(reversedClassified, { reverse: true });
  const firstResolution = resolveSourceNodes(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    firstClassified,
    policy,
    firstInputs.sourceNodes,
    firstInputs.componentDecisions,
    firstInputs.relationDestinations
  );
  const reversedResolution = resolveSourceNodes(
    reversed.policy,
    reversed.view,
    reversed.annotations,
    reversed.adjudication,
    reversedClassified,
    policy,
    reversedInputs.sourceNodes,
    reversedInputs.componentDecisions,
    reversedInputs.relationDestinations
  );
  assert.equal(firstResolution.resolutionHash, reversedResolution.resolutionHash);
  const tamperedResolution = structuredClone(firstResolution);
  tamperedResolution.memberIndex[0].vertexId = `sha256:${"f".repeat(64)}`;
  assert.throws(
    () => verifySourceNodeResolution(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      tamperedResolution
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_NODE_RESOLUTION_MISMATCH"
  );

  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      firstInputs.sourceNodes,
      [],
      firstInputs.relationDestinations
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_COMPONENT_DECISION_INCOMPLETE"
  );
  const invalidDestinations = structuredClone(firstInputs.relationDestinations);
  invalidDestinations.find((entry) => entry.relationId === "relation-8").destination =
    "typed-explanation";
  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      firstInputs.sourceNodes,
      firstInputs.componentDecisions,
      invalidDestinations
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_RELATION_DESTINATION_INCONSISTENT"
  );
  const missingNode = firstInputs.sourceNodes.filter((entry) => entry.id !== "E");
  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      missingNode,
      firstInputs.componentDecisions,
      firstInputs.relationDestinations
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_NODE_INVENTORY_INCOMPLETE"
  );
  const collidingNodes = structuredClone(firstInputs.sourceNodes);
  collidingNodes.find((entry) => entry.id === "F").identityHash =
    collidingNodes.find((entry) => entry.id === "E").identityHash;
  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      collidingNodes,
      firstInputs.componentDecisions,
      firstInputs.relationDestinations
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_RESOLUTION_VERTEX_COLLISION"
  );
  const condensation = condenseSourceRelations(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    firstClassified,
    policy,
    firstResolution
  );
  const reversedCondensation = condenseSourceRelations(
    reversed.policy,
    reversed.view,
    reversed.annotations,
    reversed.adjudication,
    reversedClassified,
    policy,
    reversedResolution
  );
  const tampered = structuredClone(condensation);
  tampered.quotient.topologicalOrder.reverse();
  assert.throws(
    () => verifySourceCondensation(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      firstResolution,
      tampered
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CONDENSATION_MISMATCH"
  );
  const report = createSourceMigrationReconciliationReport(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    first.amendments,
    firstClassified,
    policy,
    firstResolution,
    condensation
  );
  const reversedReport = createSourceMigrationReconciliationReport(
    reversed.policy,
    reversed.view,
    reversed.annotations,
    reversed.adjudication,
    reversed.amendments,
    reversedClassified,
    policy,
    reversedResolution,
    reversedCondensation
  );
  assert.equal(report.reportHash, reversedReport.reportHash);
  const tamperedReport = structuredClone(report);
  tamperedReport.rawGraph.largestScc = 3;
  assert.throws(
    () => verifySourceMigrationReconciliationReport(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      first.amendments,
      firstClassified,
      policy,
      firstResolution,
      condensation,
      tamperedReport
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_RECONCILIATION_MISMATCH"
  );
  const changedAmendments = freezeSourceClassificationAmendments(
    first.policy,
    first.annotations,
    first.adjudication,
    {
      schemaVersion: "1",
      policyHash: first.policy.policyHash,
      adjudicationHash: first.adjudication.adjudicationHash,
      frozenAt: "2026-08-07T14:00:00.000Z",
      changes: [{
        relationId: "relation-5",
        newKind: "generative",
        changedAt: "2026-08-07T13:00:00.000Z",
        reason: "Approved unblinded reclassification requires a new projection.",
        approver: { id: "review-board", role: "approval board" },
        approvalArtifact: reviewedArtifact("relation-5-amendment")
      }]
    }
  );
  const effectiveClassified = buildSourceEffectiveClassifiedRelations(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    changedAmendments
  );
  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      effectiveClassified,
      policy,
      firstInputs.sourceNodes,
      firstInputs.componentDecisions,
      firstInputs.relationDestinations
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_EFFECTIVE_CLASSIFICATION_AMENDMENTS_REQUIRED"
  );
  assert.throws(
    () => createSourceMigrationReconciliationReport(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      firstClassified,
      policy,
      firstResolution,
      condensation
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_REPROJECTION_REQUIRED"
  );
  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      firstClassified,
      policy,
      firstInputs.sourceNodes,
      firstInputs.componentDecisions,
      firstInputs.relationDestinations,
      changedAmendments
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_EFFECTIVE_CLASSIFICATION_REQUIRED"
  );
  const effectiveInputs = resolutionInputs(effectiveClassified);
  assert.throws(
    () => resolveSourceNodes(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      effectiveClassified,
      policy,
      firstInputs.sourceNodes,
      firstInputs.componentDecisions,
      firstInputs.relationDestinations,
      changedAmendments
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_COMPONENT_DECISION_UNKNOWN"
  );
  const effectiveResolution = resolveSourceNodes(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    effectiveClassified,
    policy,
    effectiveInputs.sourceNodes,
    effectiveInputs.componentDecisions,
    effectiveInputs.relationDestinations,
    changedAmendments
  );
  const effectiveCondensation = condenseSourceRelations(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    effectiveClassified,
    policy,
    effectiveResolution,
    changedAmendments
  );
  const effectiveReport = createSourceMigrationReconciliationReport(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    changedAmendments,
    effectiveClassified,
    policy,
    effectiveResolution,
    effectiveCondensation
  );
  const effectiveMetrics = createSourceMigrationMetrics(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    changedAmendments,
    effectiveClassified,
    policy,
    effectiveResolution,
    effectiveCondensation,
    effectiveReport,
    migrationMetricsInput(effectiveReport, effectiveResolution)
  );
  const effectiveExplanationIndex = createSourceMigrationExplanationIndex(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    changedAmendments,
    effectiveClassified,
    policy,
    effectiveResolution,
    effectiveCondensation,
    effectiveReport,
    effectiveMetrics
  );
  const effectiveExplanationSession = createSourceMigrationExplanationSession(
    first.policy,
    first.view,
    first.annotations,
    first.adjudication,
    changedAmendments,
    effectiveClassified,
    policy,
    effectiveResolution,
    effectiveCondensation,
    effectiveReport,
    effectiveMetrics,
    effectiveExplanationIndex
  );
  const amendedExplanation = effectiveExplanationSession.explain({
    kind: "source-relation",
    id: "relation-5"
  });
  const componentExplanation = effectiveExplanationSession.explain({
    kind: "raw-component",
    id: effectiveMetrics.dispositions[0].rawComponentId
  });
  assert.equal(effectiveResolution.counts.vertices, 3);
  assert.equal(effectiveResolution.counts.internalRelations, 7);
  assert.equal(effectiveReport.classification.edgesByKind.generative, 6);
  assert.equal(effectiveReport.classification.edgesByKind.descriptive, 0);
  assert.equal(effectiveReport.resolution.descriptiveResolvedRawSccs, 0);
  assert.deepEqual(effectiveReport.riskSignals.postUnblindingReclassification, {
    actual: 1 / 9,
    maximum: 0.05,
    exceeded: true
  });
  assert.deepEqual(effectiveReport.riskSignals.fittingRiskReasons, [
    "post-unblinding-reclassification-threshold-exceeded"
  ]);
  assert.equal(
    effectiveMetrics.dispositions[0].primaryResolution,
    "constitutive-condensation"
  );
  assert.equal(
    effectiveMetrics.dispositions[0].resultingCluster,
    effectiveResolution.vertices.find((entry) =>
      entry.kind === "condensed-cluster"
    ).vertexId
  );
  assert.equal(effectiveMetrics.crossCatalogueLevelClusters, 1);
  assert.equal(effectiveMetrics.postUnblindingChanges, 1);
  assert.equal(effectiveMetrics.postUnblindingReclassificationShare, 1 / 9);
  assert.equal(effectiveExplanationIndex.statistics.amendedRelationCount, 1);
  assert.equal(amendedExplanation.result.frozenKind, "descriptive");
  assert.equal(amendedExplanation.result.effectiveKind, "generative");
  assert.deepEqual(
    amendedExplanation.result.changeIds,
    [changedAmendments.changes[0].changeId]
  );
  assert.equal(
    componentExplanation.result.primaryResolution,
    "constitutive-condensation"
  );
  assertSchema("source-node-resolution", effectiveResolution);
  assertSchema("source-condensation", effectiveCondensation);
  assertSchema("source-migration-reconciliation", effectiveReport);
  assertSchema("source-migration-metrics", effectiveMetrics);
  assertSchema(
    "source-migration-explanation-index",
    effectiveExplanationIndex
  );
  assertSchema("source-migration-explanation", amendedExplanation);
  assertSchema("source-migration-explanation", componentExplanation);
  assert.equal(
    verifySourceNodeResolution(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      effectiveClassified,
      policy,
      effectiveResolution,
      changedAmendments
    ).resolutionHash,
    effectiveResolution.resolutionHash
  );
  assert.equal(
    verifySourceCondensation(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      changedAmendments
    ).condensationHash,
    effectiveCondensation.condensationHash
  );
  assert.equal(
    verifySourceMigrationReconciliationReport(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      effectiveReport
    ).reportHash,
    effectiveReport.reportHash
  );
  assert.equal(
    verifySourceMigrationMetrics(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      effectiveReport,
      effectiveMetrics
    ).metricsHash,
    effectiveMetrics.metricsHash
  );
  const invalidMetricsInput = migrationMetricsInput(
    effectiveReport,
    effectiveResolution
  );
  invalidMetricsInput.catalogueLevels.pop();
  assert.throws(
    () => createSourceMigrationMetrics(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      effectiveReport,
      invalidMetricsInput
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_CATALOGUE_LEVELS_INVALID"
  );
  const invalidDispositionInput = migrationMetricsInput(
    effectiveReport,
    effectiveResolution
  );
  invalidDispositionInput.rawSccDispositions[0].primaryResolution =
    "nonformation-layer-separation";
  assert.throws(
    () => createSourceMigrationMetrics(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      effectiveReport,
      invalidDispositionInput
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_SCC_DISPOSITIONS_INVALID"
  );
  const tamperedMetrics = structuredClone(effectiveMetrics);
  tamperedMetrics.crossCatalogueLevelClusters = 0;
  assert.throws(
    () => verifySourceMigrationMetrics(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      effectiveReport,
      tamperedMetrics
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_METRICS_MISMATCH"
  );
  const tamperedIndex = structuredClone(effectiveExplanationIndex);
  tamperedIndex.relations[0].effectiveKind = "evidential";
  assert.throws(
    () => verifySourceMigrationExplanationIndex(
      first.policy,
      first.view,
      first.annotations,
      first.adjudication,
      changedAmendments,
      effectiveClassified,
      policy,
      effectiveResolution,
      effectiveCondensation,
      effectiveReport,
      effectiveMetrics,
      tamperedIndex
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_MIGRATION_EXPLANATION_INDEX_MISMATCH"
  );
});

test("catalog adapter publishes verified resolution without claiming migration inputs", () => {
  assert.equal(
    CATALOG_ADAPTER_STATUS,
    "audit-active/classified-projection-active/effective-reprojection-active/node-resolution-active/condensation-active/reconciliation-diagnostics-active/migration-metrics-active/source-explanations-active/cluster-concentration-active/migration-inputs-pending"
  );
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes("source-classified-relations"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes(
    "source-effective-classified-relations"
  ));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes("source-scc-projections"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes("source-node-resolution"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes("source-condensation"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes(
    "source-migration-reconciliation-diagnostics"
  ));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes(
    "source-migration-metrics"
  ));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes(
    "source-migration-explanation-query"
  ));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes(
    "source-cluster-concentration"
  ));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.pending.includes("source-policy-authorship"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.pending.includes("source-annotation-collection"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.pending.includes(
    "current-catalogue-migration-artifacts"
  ));
  assert.ok(!CATALOG_ADAPTER_CAPABILITIES.pending.includes(
    "source-migration-package"
  ));
});
