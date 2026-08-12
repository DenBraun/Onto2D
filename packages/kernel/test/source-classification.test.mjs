import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  HASH_DOMAINS,
  KernelError,
  SOURCE_CLASSIFICATION_ADJUDICATION_VERSION,
  SOURCE_CLASSIFICATION_AMENDMENTS_VERSION,
  SOURCE_CLASSIFICATION_AMENDMENT_LIMITS,
  SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION,
  SOURCE_CLASSIFICATION_LIMITS,
  SOURCE_RELATION_KINDS,
  createKernel,
  canonicalBytes,
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAmendments,
  freezeSourceClassificationAnnotations,
  freezeSourceClassificationPolicy,
  hashArtifactBytes,
  hashCanonical,
  verifySourceClassificationAmendments
} from "../src/index.js";

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

function approvalArtifact(name) {
  const bytes = canonicalBytes({ approval: name });
  return {
    path: `review/${name}.json`,
    mediaType: "application/json",
    schemaVersion: "1",
    bytes: bytes.byteLength,
    hash: hashArtifactBytes(bytes)
  };
}

function amendmentInput(policy, adjudication, changes) {
  return {
    schemaVersion: "1",
    policyHash: policy.policyHash,
    adjudicationHash: adjudication.adjudicationHash,
    frozenAt: "2026-08-07T15:00:00.000Z",
    changes
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

test("post-unblinding amendments retain frozen decisions and derive a complete change chain", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const annotations = freezeSourceClassificationAnnotations(
    policy,
    annotationInput(policy)
  );
  const adjudication = freezeSourceClassificationAdjudication(
    policy,
    annotations,
    adjudicationInput(policy, annotations)
  );
  const changes = [
    {
      relationId: "relation-b",
      newKind: "evidential",
      changedAt: "2026-08-07T14:00:00.000Z",
      reason: "A second approved review found that the relation only supports evidence.",
      approver: { id: "review-board", role: "post-unblinding approval board" },
      approvalArtifact: approvalArtifact("relation-b-second")
    },
    {
      relationId: "relation-b",
      newKind: "descriptive",
      changedAt: "2026-08-07T13:00:00.000Z",
      reason: "The first unblinded review reclassified the constitutive claim.",
      approver: { id: "review-board", role: "post-unblinding approval board" },
      approvalArtifact: approvalArtifact("relation-b-first")
    }
  ];
  const frozen = freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    amendmentInput(policy, adjudication, changes)
  );
  const equivalent = freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    amendmentInput(policy, adjudication, [...changes].reverse())
  );
  const { amendmentsHash, ...basis } = frozen;

  assert.equal(
    SOURCE_CLASSIFICATION_AMENDMENTS_VERSION,
    "source-classification-amendments-v1"
  );
  assert.deepEqual(SOURCE_CLASSIFICATION_AMENDMENT_LIMITS, {
    maxChanges: 10_000,
    maxIdentifierLength: 1_024,
    maxTextLength: 16_384
  });
  assert.equal(frozen.amendmentsHash, equivalent.amendmentsHash);
  assert.deepEqual(frozen.changes.map((entry) => entry.originalKind), [
    "constitutive",
    "descriptive"
  ]);
  assert.equal(frozen.changes[1].priorStateHash, frozen.changes[0].changeId);
  assert.equal(
    frozen.effectiveDecisions.find((entry) => entry.relationId === "relation-b")
      .effectiveKind,
    "evidential"
  );
  assert.deepEqual(frozen.statistics, {
    relationCount: 2,
    changeCount: 2,
    changedRelationCount: 1,
    changedRelationShare: 0.5,
    maximumPostUnblindingReclassificationShare: 0.05,
    thresholdExceeded: true
  });
  assert.equal(frozen.fittingRisk, "elevated");
  assert.deepEqual(frozen.fittingRiskReasons, [
    "classification-disagreement-threshold-exceeded",
    "post-unblinding-reclassification-threshold-exceeded"
  ]);
  assert.equal(
    amendmentsHash,
    hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_AMENDMENTS, basis)
  );
  assertSchema("source-classification-amendments", frozen);
  assert.equal(
    verifySourceClassificationAmendments(
      policy,
      annotations,
      adjudication,
      structuredClone(frozen)
    ).amendmentsHash,
    frozen.amendmentsHash
  );
  assert.ok(Object.isFrozen(frozen));
});

test("post-unblinding amendment logs fail closed on chronology, no-ops, ambiguity, and tampering", () => {
  const policy = freezeSourceClassificationPolicy(policyDraft());
  const annotations = freezeSourceClassificationAnnotations(
    policy,
    annotationInput(policy)
  );
  const adjudication = freezeSourceClassificationAdjudication(
    policy,
    annotations,
    adjudicationInput(policy, annotations)
  );
  const change = {
    relationId: "relation-b",
    newKind: "descriptive",
    changedAt: "2026-08-07T13:00:00.000Z",
    reason: "Approved post-unblinding correction.",
    approver: { id: "review-board", role: "approval board" },
    approvalArtifact: approvalArtifact("relation-b")
  };
  const freeze = (changes) => freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    amendmentInput(policy, adjudication, changes)
  );

  assert.throws(
    () => freeze([{ ...change, changedAt: adjudication.unblindedAt }]),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLASSIFICATION_AMENDMENT_INVALID"
  );
  assert.throws(
    () => freeze([{ ...change, newKind: "constitutive" }]),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLASSIFICATION_AMENDMENT_NO_CHANGE"
  );
  assert.throws(
    () => freeze([change, { ...change, newKind: "evidential" }]),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLASSIFICATION_AMENDMENT_ORDER_AMBIGUOUS"
  );
  assert.throws(
    () => freeze([{ ...change, relationId: "unknown-relation" }]),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLASSIFICATION_AMENDMENT_INVALID"
  );
  const frozen = freeze([change]);
  const tampered = structuredClone(frozen);
  tampered.changes[0].newKind = "regulatory-feedback";
  assert.throws(
    () => verifySourceClassificationAmendments(
      policy,
      annotations,
      adjudication,
      tampered
    ),
    (error) => error instanceof KernelError &&
      error.code === "SOURCE_CLASSIFICATION_AMENDMENTS_MISMATCH"
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

test("kernel exposes artifact freezing without claiming current-catalogue application", () => {
  const kernel = createKernel();
  const policy = kernel.freezeSourceClassificationPolicy(policyDraft());
  const annotations = kernel.freezeSourceClassificationAnnotations(policy, annotationInput(policy));
  const adjudication = kernel.freezeSourceClassificationAdjudication(
    policy,
    annotations,
    adjudicationInput(policy, annotations)
  );
  const amendments = kernel.freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    amendmentInput(policy, adjudication, [])
  );

  assert.ok(kernel.capabilities.implemented.includes("source-classification-annotation-freeze"));
  assert.ok(kernel.capabilities.implemented.includes("source-classification-adjudication-freeze"));
  assert.ok(kernel.capabilities.implemented.includes("source-classification-amendment-freeze"));
  assert.ok(!kernel.capabilities.pending.includes("source-classification"));
  assert.match(adjudication.adjudicationHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(amendments.statistics.changeCount, 0);
});
