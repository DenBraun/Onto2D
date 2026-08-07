import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUSTER_DISPOSITIONS,
  HASH_DOMAINS,
  KernelError,
  SOURCE_CLASSIFICATION_VISIBLE_FIELDS,
  SOURCE_CLASSIFICATION_POLICY_VERSION,
  SOURCE_NODE_RESOLUTION_POLICY_VERSION,
  SOURCE_POLICY_LIMITS,
  SOURCE_RELATION_KINDS,
  createKernel,
  freezeSourceClassificationPolicy,
  freezeSourceNodeResolutionPolicy,
  hashCanonical
} from "../src/index.js";

function relationRule(kind) {
  return {
    decisionQuestion: `Does the source evidence satisfy ${kind}?`,
    necessaryObservations: [`necessary ${kind}`],
    sufficientObservations: [`sufficient ${kind}`],
    inclusions: [`include ${kind}`],
    exclusions: [`exclude ${kind}`],
    counterexamples: [`counterexample ${kind}`]
  };
}

function classificationPolicy(overrides = {}) {
  return {
    schemaVersion: "1",
    version: "classification-fixture-v1",
    authorship: {
      mode: "human-independent",
      minimumIndependentClassifiers: 2,
      adjudicationRule: "A third reviewer adjudicates without SCC-aware material."
    },
    exposure: {
      status: "prospective-blind",
      declaration: "Policy authors and classifiers have not seen SCC-aware migration material.",
      sccAwareMaterialSeenBeforeFreeze: false
    },
    visibleFields: ["source-text", "parent-code", "source", "target"],
    forbiddenInputs: [
      "scc-membership",
      "quotient-acyclicity-effect",
      "desired-topology",
      "cycle-visualization"
    ],
    relationKinds: Object.fromEntries(
      [...SOURCE_RELATION_KINDS].reverse().map((kind) => [kind, relationRule(kind)])
    ),
    conflictRule: "Preserve disagreement and send it to the declared adjudicator.",
    riskPolicy: {
      maximumClassificationDisagreementRatio: 0.15,
      maximumDescriptiveResolutionShare: 0.25,
      maximumPostUnblindingReclassificationShare: 0.05,
      acceptedBlindness: ["historically-exposed", "prospective-blind"]
    },
    ...overrides
  };
}

function dispositionRule(disposition) {
  return {
    decisionQuestion: `Does the classified component satisfy ${disposition}?`,
    criteria: [`criterion ${disposition}`],
    positiveExamples: [`positive ${disposition}`],
    negativeExamples: [`negative ${disposition}`]
  };
}

function resolutionPolicy(classificationPolicyHash, overrides = {}) {
  return {
    schemaVersion: "1",
    version: "node-resolution-fixture-v1",
    classificationPolicyHash,
    visibleInputs: [
      "strongly-connected-component-membership",
      "source-relation-endpoints",
      "classified-relations",
      "classification-annotations"
    ],
    forbiddenCriteria: [
      "paper-resemblance-only",
      "desired-acyclicity",
      "cycle-removal-outcome",
      "component-size-only"
    ],
    dispositionRules: Object.fromEntries(
      [...CLUSTER_DISPOSITIONS].reverse().map((disposition) => [
        disposition,
        dispositionRule(disposition)
      ])
    ),
    edgeReconciliation: {
      destinations: ["typed-explanation", "internal", "inter-cluster"],
      requireExactlyOnce: true,
      preserveRawRelationReferences: true
    },
    clusterSemantics: {
      internalOrder: "undefined",
      memberDepthInheritance: "cluster-depth",
      requireCondensationDag: true
    },
    reviewRule: "Resolve components only from classified relations and preserve unresolved cases.",
    ...overrides
  };
}

test("source classification policy freeze is complete, normalized, content-addressed, and immutable", () => {
  const frozen = freezeSourceClassificationPolicy(classificationPolicy());
  const equivalent = freezeSourceClassificationPolicy(classificationPolicy({
    visibleFields: ["target", "source", "parent-code", "source-text"],
    riskPolicy: {
      ...classificationPolicy().riskPolicy,
      acceptedBlindness: ["prospective-blind", "historically-exposed"]
    }
  }));
  const { policyHash, ...basis } = frozen;

  assert.equal(SOURCE_CLASSIFICATION_POLICY_VERSION, "source-classification-policy-v1");
  assert.deepEqual(SOURCE_POLICY_LIMITS, {
    maxIdentifierLength: 1_024,
    maxTextLength: 16_384,
    maxListEntries: 1_000,
    maxIndependentClassifiers: 100
  });
  assert.ok(SOURCE_CLASSIFICATION_VISIBLE_FIELDS.includes("source"));
  assert.ok(SOURCE_CLASSIFICATION_VISIBLE_FIELDS.includes("target"));
  assert.ok(!SOURCE_CLASSIFICATION_VISIBLE_FIELDS.includes("sccMembership"));
  assert.deepEqual(Object.keys(frozen.relationKinds), SOURCE_RELATION_KINDS);
  assert.deepEqual(frozen.visibleFields, ["parent-code", "source", "source-text", "target"]);
  assert.equal(frozen.policyHash, equivalent.policyHash);
  assert.equal(
    policyHash,
    hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_POLICY, basis)
  );
  assert.notEqual(
    policyHash,
    freezeSourceClassificationPolicy(classificationPolicy({ version: "classification-fixture-v2" })).policyHash
  );
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.relationKinds.generative));
});

test("classification freeze enforces blindness claims, authored category coverage, and migration risks", () => {
  assert.throws(
    () => freezeSourceClassificationPolicy(classificationPolicy({
      exposure: {
        ...classificationPolicy().exposure,
        sccAwareMaterialSeenBeforeFreeze: true
      }
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_EXPOSURE_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationPolicy(classificationPolicy({
      visibleFields: ["source", "target", "scc-membership"]
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_POLICY_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationPolicy(classificationPolicy({
      visibleFields: ["source", "target", "sccMembership"]
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_POLICY_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationPolicy(classificationPolicy({
      authorship: {
        ...classificationPolicy().authorship,
        minimumIndependentClassifiers: 101
      }
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_AUTHORSHIP_INVALID"
  );
  const incomplete = classificationPolicy();
  delete incomplete.relationKinds.descriptive;
  assert.throws(
    () => freezeSourceClassificationPolicy(incomplete),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_POLICY_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationPolicy(classificationPolicy({
      riskPolicy: {
        ...classificationPolicy().riskPolicy,
        maximumClassificationDisagreementRatio: 1.01
      }
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_RISK_POLICY_INVALID"
  );
});

test("historical exposure remains explicit and cannot be represented as prospective blind", () => {
  const frozen = freezeSourceClassificationPolicy(classificationPolicy({
    exposure: {
      status: "historically-exposed",
      declaration: "The current audit authors previously inspected SCC membership and cycle reports.",
      sccAwareMaterialSeenBeforeFreeze: true
    }
  }));
  assert.equal(frozen.exposure.status, "historically-exposed");
  assert.throws(
    () => freezeSourceClassificationPolicy(classificationPolicy({
      authorship: {
        mode: "deterministic-precommitted",
        classifier: { id: "classifier", version: "1" },
        adjudicationRule: "Deterministic rule conflicts are reported as policy errors."
      }
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_EXPOSURE_INVALID"
  );
});

test("node-resolution policy binds classification identity and freezes reconciliation semantics", () => {
  const classification = freezeSourceClassificationPolicy(classificationPolicy());
  const frozen = freezeSourceNodeResolutionPolicy(resolutionPolicy(classification.policyHash));
  const equivalent = freezeSourceNodeResolutionPolicy(resolutionPolicy(classification.policyHash, {
    visibleInputs: [
      "classification-annotations",
      "classified-relations",
      "source-relation-endpoints",
      "strongly-connected-component-membership"
    ]
  }));
  const { policyHash, ...basis } = frozen;

  assert.equal(SOURCE_NODE_RESOLUTION_POLICY_VERSION, "source-node-resolution-policy-v1");
  assert.deepEqual(Object.keys(frozen.dispositionRules), CLUSTER_DISPOSITIONS);
  assert.equal(frozen.classificationPolicyHash, classification.policyHash);
  assert.equal(frozen.policyHash, equivalent.policyHash);
  assert.equal(
    policyHash,
    hashCanonical(HASH_DOMAINS.SOURCE_NODE_RESOLUTION_POLICY, basis)
  );
  assert.deepEqual(frozen.edgeReconciliation.destinations, [
    "inter-cluster",
    "internal",
    "typed-explanation"
  ]);
  assert.ok(Object.isFrozen(frozen));
});

test("node-resolution freeze rejects topology-driven criteria and weakened cluster invariants", () => {
  const classification = freezeSourceClassificationPolicy(classificationPolicy());
  assert.throws(
    () => freezeSourceNodeResolutionPolicy(resolutionPolicy(classification.policyHash, {
      forbiddenCriteria: ["cycle-removal-outcome"]
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_RESOLUTION_POLICY_INVALID"
  );
  assert.throws(
    () => freezeSourceNodeResolutionPolicy(resolutionPolicy(classification.policyHash, {
      visibleInputs: ["classification-annotations", "classified-relations"]
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_RESOLUTION_POLICY_INVALID"
  );
  assert.throws(
    () => freezeSourceNodeResolutionPolicy(resolutionPolicy(classification.policyHash, {
      clusterSemantics: {
        internalOrder: "defined",
        memberDepthInheritance: "cluster-depth",
        requireCondensationDag: true
      }
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_RESOLUTION_POLICY_INVALID"
  );
});

test("kernel exposes policy freezing without claiming source migration execution", () => {
  const kernel = createKernel();
  const classification = kernel.freezeSourceClassificationPolicy(classificationPolicy());
  const resolution = kernel.freezeSourceNodeResolutionPolicy(
    resolutionPolicy(classification.policyHash)
  );

  assert.ok(kernel.capabilities.implemented.includes("source-classification-policy-freeze"));
  assert.ok(kernel.capabilities.implemented.includes("source-node-resolution-policy-freeze"));
  assert.ok(!kernel.capabilities.implemented.includes("source-classification"));
  assert.ok(kernel.capabilities.pending.includes("source-classification"));
  assert.ok(kernel.capabilities.pending.includes("source-node-resolution"));
  assert.ok(kernel.capabilities.pending.includes("source-condensation"));
  assert.match(resolution.policyHash, /^sha256:[a-f0-9]{64}$/);
});
