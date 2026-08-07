import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  SOURCE_CLASSIFICATION_ADJUDICATION_VERSION,
  SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION,
  SOURCE_CLASSIFICATION_LIMITS,
  SOURCE_RELATION_KINDS,
  createKernel,
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAnnotations,
  freezeSourceClassificationPolicy,
  hashCanonical
} from "../src/index.js";

function relationRule(kind) {
  return {
    decisionQuestion: `Does the evidence support ${kind}?`,
    necessaryObservations: [`necessary ${kind}`],
    sufficientObservations: [`sufficient ${kind}`],
    inclusions: [`include ${kind}`],
    exclusions: [`exclude ${kind}`],
    counterexamples: [`counterexample ${kind}`]
  };
}

function policyDraft(overrides = {}) {
  return {
    schemaVersion: "1",
    version: "annotation-policy-v1",
    authorship: {
      mode: "human-independent",
      minimumIndependentClassifiers: 2,
      adjudicationRule: "A blind reviewer records one final decision per disagreement."
    },
    exposure: {
      status: "prospective-blind",
      declaration: "Eligible classifiers have not seen SCC-aware material.",
      sccAwareMaterialSeenBeforeFreeze: false
    },
    visibleFields: ["source", "target", "source-text", "parent-code"],
    forbiddenInputs: [
      "cycle-visualization",
      "desired-topology",
      "quotient-acyclicity-effect",
      "scc-membership"
    ],
    relationKinds: Object.fromEntries(
      SOURCE_RELATION_KINDS.map((kind) => [kind, relationRule(kind)])
    ),
    conflictRule: "Preserve raw votes and require blind adjudication.",
    riskPolicy: {
      maximumClassificationDisagreementRatio: 0.4,
      maximumDescriptiveResolutionShare: 0.25,
      maximumPostUnblindingReclassificationShare: 0.05,
      acceptedBlindness: ["prospective-blind", "historically-exposed"]
    },
    ...overrides
  };
}

function human(id, status = "prospective-blind") {
  return {
    id,
    type: "human",
    exposure: {
      status,
      declaration: status === "historically-exposed"
        ? `${id} previously saw SCC-aware audit material.`
        : `${id} has not seen SCC-aware material.`,
      sccAwareMaterialSeenBeforeAnnotation: status === "historically-exposed"
    }
  };
}

function annotationInput(policy, overrides = {}) {
  return {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    view: {
      hash: `sha256:${"a".repeat(64)}`,
      visibleFields: ["target", "source", "parent-code", "source-text"],
      relationIds: ["relation-b", "relation-a"]
    },
    frozenAt: "2026-08-07T10:00:00.000Z",
    classifiers: [human("classifier-b"), human("classifier-a")],
    annotations: [
      {
        relationId: "relation-b",
        classifierId: "classifier-b",
        kind: "descriptive",
        observations: ["local field B"],
        rationale: "The link is descriptive under the frozen policy."
      },
      {
        relationId: "relation-a",
        classifierId: "classifier-a",
        kind: "generative",
        observations: ["local field A"],
        rationale: "The link states a formation dependency."
      },
      {
        relationId: "relation-b",
        classifierId: "classifier-a",
        kind: "constitutive",
        observations: ["local field B", "source statement"],
        rationale: "The endpoints are mutually defined."
      },
      {
        relationId: "relation-a",
        classifierId: "classifier-b",
        kind: "generative",
        observations: ["local field A"],
        rationale: "The source is required for target formation."
      }
    ],
    ...overrides
  };
}

function adjudicationInput(policy, annotations, overrides = {}) {
  return {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    annotationHash: annotations.annotationHash,
    frozenAt: "2026-08-07T11:00:00.000Z",
    unblindedAt: "2026-08-07T12:00:00.000Z",
    adjudicator: human("adjudicator"),
    decisions: [
      {
        relationId: "relation-b",
        kind: "constitutive",
        rationale: "The blind adjudicator applied the frozen conflict rule."
      },
      {
        relationId: "relation-a",
        kind: "generative",
        rationale: "Both classifiers independently agreed."
      }
    ],
    ...overrides
  };
}

test("raw classification annotations form a complete normalized content-addressed matrix", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const frozen = freezeSourceClassificationAnnotations(policy, annotationInput(policy));
  const equivalent = freezeSourceClassificationAnnotations(policy, annotationInput(policy, {
    classifiers: [human("classifier-a"), human("classifier-b")],
    view: {
      ...annotationInput(policy).view,
      visibleFields: ["parent-code", "source", "source-text", "target"],
      relationIds: ["relation-a", "relation-b"]
    },
    annotations: [...annotationInput(policy).annotations].reverse()
  }));
  const { annotationHash, ...basis } = frozen;

  assert.equal(SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION, "source-classification-annotations-v1");
  assert.deepEqual(SOURCE_CLASSIFICATION_LIMITS, {
    maxRelations: 10_000,
    maxClassifiers: 100,
    maxAnnotations: 1_000_000,
    maxObservationsPerAnnotation: 100,
    maxIdentifierLength: 1_024,
    maxTextLength: 16_384
  });
  assert.deepEqual(frozen.view.relationIds, ["relation-a", "relation-b"]);
  assert.deepEqual(frozen.classifiers.map((entry) => entry.id), ["classifier-a", "classifier-b"]);
  assert.deepEqual(frozen.statistics, {
    relationCount: 2,
    classifierCount: 2,
    annotationCount: 4
  });
  assert.equal(frozen.annotationHash, equivalent.annotationHash);
  assert.equal(
    annotationHash,
    hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_ANNOTATIONS, basis)
  );
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.annotations));
});

test("annotation freeze rejects incomplete independence, view drift, and false exposure", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  assert.throws(
    () => freezeSourceClassificationAnnotations(policy, annotationInput(policy, {
      annotations: annotationInput(policy).annotations.slice(1)
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ANNOTATIONS_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationAnnotations(policy, annotationInput(policy, {
      view: { ...annotationInput(policy).view, visibleFields: ["source", "target"] }
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ANNOTATIONS_INVALID"
  );
  const invalidExposure = annotationInput(policy);
  invalidExposure.classifiers[0].exposure.sccAwareMaterialSeenBeforeAnnotation = true;
  assert.throws(
    () => freezeSourceClassificationAnnotations(policy, invalidExposure),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ANNOTATIONS_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationAnnotations({ ...policy, version: "tampered" }, annotationInput(policy)),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_POLICY_BINDING_INVALID"
  );
});

test("blind adjudication preserves raw disagreement and derives the frozen risk metric", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const annotations = freezeSourceClassificationAnnotations(policy, annotationInput(policy));
  const frozen = freezeSourceClassificationAdjudication(
    policy,
    annotations,
    adjudicationInput(policy, annotations)
  );
  const { adjudicationHash, ...basis } = frozen;

  assert.equal(
    SOURCE_CLASSIFICATION_ADJUDICATION_VERSION,
    "source-classification-adjudication-v1"
  );
  assert.deepEqual(frozen.decisions[0], {
    relationId: "relation-a",
    kind: "generative",
    rationale: "Both classifiers independently agreed.",
    status: "agreement",
    rawKinds: ["generative"]
  });
  assert.deepEqual(frozen.decisions[1].rawKinds, ["constitutive", "descriptive"]);
  assert.equal(frozen.decisions[1].status, "adjudicated");
  assert.deepEqual(frozen.statistics, {
    relationCount: 2,
    disagreementCount: 1,
    disagreementRatio: 0.5,
    maximumClassificationDisagreementRatio: 0.4,
    thresholdExceeded: true
  });
  assert.equal(frozen.fittingRisk, "elevated");
  assert.deepEqual(frozen.fittingRiskReasons, [
    "classification-disagreement-threshold-exceeded"
  ]);
  assert.equal(
    adjudicationHash,
    hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_ADJUDICATION, basis)
  );
  assert.ok(Object.isFrozen(frozen));
});

test("adjudication rejects altered raw artifacts, unanimous overwrites, and early unblinding", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const annotations = freezeSourceClassificationAnnotations(policy, annotationInput(policy));
  assert.throws(
    () => freezeSourceClassificationAdjudication(
      policy,
      { ...annotations, frozenAt: "2026-08-07T09:00:00.000Z" },
      adjudicationInput(policy, annotations)
    ),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ANNOTATION_BINDING_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationAdjudication(policy, annotations, adjudicationInput(policy, annotations, {
      decisions: [
        ...adjudicationInput(policy, annotations).decisions.slice(0, 1),
        {
          relationId: "relation-a",
          kind: "descriptive",
          rationale: "This attempts to overwrite unanimous raw annotations."
        }
      ]
    })),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLASSIFICATION_ADJUDICATION_DECISION_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationAdjudication(policy, annotations, adjudicationInput(policy, annotations, {
      unblindedAt: "2026-08-07T10:30:00.000Z"
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ADJUDICATION_INVALID"
  );
  assert.throws(
    () => freezeSourceClassificationAnnotations(policy, annotationInput(policy, {
      frozenAt: "2026-08-07T10:00:00Z"
    })),
    (error) => error instanceof KernelError && error.code === "SOURCE_CLASSIFICATION_ANNOTATIONS_INVALID"
  );
});

test("deterministic precommitted annotation uses exactly the frozen classifier identity", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft({
    authorship: {
      mode: "deterministic-precommitted",
      classifier: { id: "rule-classifier", version: "1.0.0" },
      adjudicationRule: "The deterministic classifier must return one supported category."
    },
    exposure: {
      status: "deterministic-precommitted",
      declaration: "The complete rule set was frozen before SCC-aware input.",
      sccAwareMaterialSeenBeforeFreeze: false
    },
    riskPolicy: {
      ...policyDraft().riskPolicy,
      acceptedBlindness: ["deterministic-precommitted"]
    }
  }));
  const classifier = {
    id: "rule-classifier",
    type: "deterministic",
    version: "1.0.0",
    exposure: {
      status: "deterministic-precommitted",
      declaration: "The tool received no SCC-aware input before annotation.",
      sccAwareMaterialSeenBeforeAnnotation: false
    }
  };
  const annotations = freezeSourceClassificationAnnotations(policy, {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    view: {
      hash: `sha256:${"b".repeat(64)}`,
      visibleFields: policy.visibleFields,
      relationIds: ["relation-a"]
    },
    frozenAt: "2026-08-07T10:00:00.000Z",
    classifiers: [classifier],
    annotations: [{
      relationId: "relation-a",
      classifierId: "rule-classifier",
      kind: "evidential",
      observations: ["rule match"],
      rationale: "The frozen deterministic rule matched evidential."
    }]
  });
  const adjudication = freezeSourceClassificationAdjudication(policy, annotations, {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    annotationHash: annotations.annotationHash,
    frozenAt: "2026-08-07T10:01:00.000Z",
    unblindedAt: "2026-08-07T10:02:00.000Z",
    adjudicator: classifier,
    decisions: [{
      relationId: "relation-a",
      kind: "evidential",
      rationale: "The single deterministic result is final."
    }]
  });

  assert.equal(annotations.statistics.classifierCount, 1);
  assert.equal(adjudication.fittingRisk, "not-flagged");
  assert.equal(adjudication.decisions[0].status, "agreement");
});

test("historical policy preserves mixed individual exposure declarations and always elevates risk", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft({
    exposure: {
      status: "historically-exposed",
      declaration: "Policy authors saw the published SCC audit before freeze.",
      sccAwareMaterialSeenBeforeFreeze: true
    }
  }));
  const input = annotationInput(policy, {
    classifiers: [
      human("blind-classifier"),
      human("exposed-classifier", "historically-exposed")
    ]
  });
  input.annotations = input.annotations.map((annotation) => ({
    ...annotation,
    classifierId: annotation.classifierId === "classifier-a"
      ? "blind-classifier"
      : "exposed-classifier",
    kind: "generative"
  }));
  const annotations = freezeSourceClassificationAnnotations(policy, input);
  const adjudication = freezeSourceClassificationAdjudication(policy, annotations, {
    ...adjudicationInput(policy, annotations),
    adjudicator: human("blind-adjudicator"),
    decisions: [
      { relationId: "relation-a", kind: "generative", rationale: "Unanimous classification." },
      { relationId: "relation-b", kind: "generative", rationale: "Unanimous classification." }
    ]
  });

  assert.deepEqual(
    annotations.classifiers.map((classifier) => classifier.exposure.status),
    ["prospective-blind", "historically-exposed"]
  );
  assert.equal(adjudication.statistics.disagreementCount, 0);
  assert.equal(adjudication.fittingRisk, "elevated");
  assert.deepEqual(adjudication.fittingRiskReasons, ["historically-exposed"]);
});

test("kernel exposes artifact freezing while classification execution remains pending", () => {
  const kernel = createKernel();
  const policy = kernel.freezeSourceClassificationPolicy(policyDraft());
  const annotations = kernel.freezeSourceClassificationAnnotations(policy, annotationInput(policy));
  const adjudication = kernel.freezeSourceClassificationAdjudication(
    policy,
    annotations,
    adjudicationInput(policy, annotations)
  );

  assert.ok(kernel.capabilities.implemented.includes("source-classification-annotation-freeze"));
  assert.ok(kernel.capabilities.implemented.includes("source-classification-adjudication-freeze"));
  assert.ok(kernel.capabilities.pending.includes("source-classification"));
  assert.match(adjudication.adjudicationHash, /^sha256:[a-f0-9]{64}$/);
});
