import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_ADAPTER_CAPABILITIES,
  CATALOG_ADAPTER_STATUS,
  SOURCE_CLASSIFICATION_VIEW_VERSION,
  SOURCE_CLASSIFIED_RELATIONS_VERSION,
  SOURCE_PROJECTION_LIMITS,
  buildSourceClassifiedRelations,
  createSourceClassificationView
} from "../src/index.js";
import {
  HASH_DOMAINS,
  KernelError,
  SOURCE_RELATION_KINDS,
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAnnotations,
  freezeSourceClassificationPolicy,
  hashCanonical
} from "@onto2d/kernel";

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
  "relation-7": "generative"
};

function rawRelations() {
  return [
    ["relation-1", "A", "B"],
    ["relation-2", "B", "A"],
    ["relation-3", "B", "C"],
    ["relation-4", "C", "B"],
    ["relation-5", "C", "D"],
    ["relation-6", "D", "D"],
    ["relation-7", "D", "D"]
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
  return { policy, view, annotations, adjudication };
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
    generative: 3,
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

test("catalog adapter publishes projection capabilities without claiming migration completion", () => {
  assert.equal(
    CATALOG_ADAPTER_STATUS,
    "audit-active/classified-projection-active/migration-pending"
  );
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes("source-classified-relations"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.implemented.includes("source-scc-projections"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.pending.includes("source-node-resolution"));
  assert.ok(CATALOG_ADAPTER_CAPABILITIES.pending.includes("source-condensation"));
});
