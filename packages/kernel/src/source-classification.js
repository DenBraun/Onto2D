import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import {
  SOURCE_CLASSIFICATION_POLICY_VERSION,
  SOURCE_POLICY_LIMITS,
  freezeSourceClassificationPolicy
} from "./source-policy.js";

export const SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION = "source-classification-annotations-v1";
export const SOURCE_CLASSIFICATION_ADJUDICATION_VERSION = "source-classification-adjudication-v1";

export const SOURCE_CLASSIFICATION_LIMITS = deepFreeze({
  maxRelations: 10_000,
  maxClassifiers: SOURCE_POLICY_LIMITS.maxIndependentClassifiers,
  maxAnnotations: 1_000_000,
  maxObservationsPerAnnotation: 100,
  maxIdentifierLength: 1_024,
  maxTextLength: 16_384
});

const RELATION_KINDS = Object.freeze([
  "generative",
  "constitutive",
  "intra-closure-support",
  "evidential",
  "descriptive",
  "regulatory-feedback"
]);
const EXPOSURE_STATUSES = Object.freeze([
  "prospective-blind",
  "deterministic-precommitted",
  "historically-exposed"
]);
const CANONICAL_TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const POLICY_FIELDS = new Set([
  "schemaVersion",
  "freezer",
  "version",
  "authorship",
  "exposure",
  "visibleFields",
  "forbiddenInputs",
  "relationKinds",
  "conflictRule",
  "riskPolicy",
  "policyHash"
]);
const ANNOTATION_INPUT_FIELDS = new Set([
  "schemaVersion",
  "policyHash",
  "view",
  "frozenAt",
  "classifiers",
  "annotations"
]);
const ANNOTATION_OUTPUT_FIELDS = new Set([
  ...ANNOTATION_INPUT_FIELDS,
  "freezer",
  "statistics",
  "annotationHash"
]);
const VIEW_FIELDS = new Set(["hash", "visibleFields", "relationIds"]);
const CLASSIFIER_FIELDS = new Set(["id", "type", "version", "exposure"]);
const CLASSIFIER_EXPOSURE_FIELDS = new Set([
  "status",
  "declaration",
  "sccAwareMaterialSeenBeforeAnnotation"
]);
const ANNOTATION_FIELDS = new Set([
  "relationId",
  "classifierId",
  "kind",
  "observations",
  "rationale"
]);
const ANNOTATION_STATISTICS_FIELDS = new Set([
  "relationCount",
  "classifierCount",
  "annotationCount"
]);
const ADJUDICATION_INPUT_FIELDS = new Set([
  "schemaVersion",
  "policyHash",
  "annotationHash",
  "frozenAt",
  "unblindedAt",
  "adjudicator",
  "decisions"
]);
const ADJUDICATION_OUTPUT_FIELDS = new Set([
  ...ADJUDICATION_INPUT_FIELDS,
  "freezer",
  "statistics",
  "fittingRisk",
  "fittingRiskReasons",
  "adjudicationHash"
]);
const DECISION_INPUT_FIELDS = new Set(["relationId", "kind", "rationale"]);
const DECISION_OUTPUT_FIELDS = new Set([
  ...DECISION_INPUT_FIELDS,
  "status",
  "rawKinds"
]);
const ADJUDICATION_STATISTICS_FIELDS = new Set([
  "relationCount",
  "disagreementCount",
  "disagreementRatio",
  "maximumClassificationDisagreementRatio",
  "thresholdExceeded"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "SOURCE_CLASSIFICATION", message, details });
}

function cloneInput(value, label) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("SOURCE_CLASSIFICATION_INPUT_INVALID", `${label} is not canonicalizable.`, {
      causeCode: error.code,
      ...error.details
    });
  }
}

function assertFields(value, allowed, required, path, code) {
  if (!isObject(value)) fail(code, "Source classification value must be an object.", { path });
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Source classification fields do not match the supported contract.", {
      path,
      unknown,
      missing
    });
  }
}

function normalizedString(value, path, code, maximumLength = SOURCE_CLASSIFICATION_LIMITS.maxTextLength) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > maximumLength
  ) {
    fail(code, "Source classification text must be normalized, non-empty, and within the length limit.", {
      path,
      maximumLength
    });
  }
  return value;
}

function identifier(value, path, code) {
  return normalizedString(value, path, code, SOURCE_CLASSIFICATION_LIMITS.maxIdentifierLength);
}

function timestamp(value, path, code) {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) {
    fail(code, "Source classification timestamps must be canonical UTC instants.", { path });
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(code, "Source classification timestamps must use canonical ISO 8601 UTC milliseconds.", {
      path,
      value
    });
  }
  return value;
}

function normalizedStringSet(value, path, code, maximum = SOURCE_CLASSIFICATION_LIMITS.maxRelations) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    fail(code, "Source classification list must be a non-empty bounded array.", {
      path,
      maximum
    });
  }
  const normalized = value.map((entry, index) => normalizedString(entry, `${path}[${index}]`, code));
  if (new Set(normalized).size !== normalized.length) {
    fail(code, "Source classification sets must not contain duplicates.", { path });
  }
  return normalized.sort(compareText);
}

function assertSameSet(actual, expected, path, code) {
  const missing = expected.filter((entry) => !actual.includes(entry));
  const unknown = actual.filter((entry) => !expected.includes(entry));
  if (missing.length > 0 || unknown.length > 0) {
    fail(code, "Source classification set does not match its frozen policy or inventory.", {
      path,
      missing,
      unknown
    });
  }
}

function verifiedPolicy(policy) {
  const cloned = cloneInput(policy, "Frozen source classification policy");
  const code = "SOURCE_CLASSIFICATION_POLICY_BINDING_INVALID";
  assertFields(cloned, POLICY_FIELDS, [...POLICY_FIELDS], "$.policy", code);
  if (
    cloned.schemaVersion !== "1" ||
    cloned.freezer !== SOURCE_CLASSIFICATION_POLICY_VERSION ||
    !isContentHash(cloned.policyHash)
  ) {
    fail(code, "Source classification policy is not a supported frozen artifact.");
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
    fail(code, "Source classification policy cannot be reproduced by the supported freezer.", {
      causeCode: error.code
    });
  }
  if (reproduced.policyHash !== cloned.policyHash || canonicalize(reproduced) !== canonicalize(cloned)) {
    fail(code, "Source classification policy content does not match its declared hash.", {
      expected: reproduced.policyHash,
      actual: cloned.policyHash
    });
  }
  return cloned;
}

function normalizeClassifier(classifier, path, policy, code) {
  assertFields(classifier, CLASSIFIER_FIELDS, ["id", "type", "exposure"], path, code);
  const expectedType = policy.authorship.mode === "human-independent" ? "human" : "deterministic";
  if (classifier.type !== expectedType) {
    fail(code, "Classifier type does not match frozen policy authorship.", {
      path,
      expected: expectedType,
      actual: classifier.type
    });
  }
  const normalized = {
    id: identifier(classifier.id, `${path}.id`, code),
    type: classifier.type
  };
  if (classifier.type === "deterministic") {
    if (
      classifier.version !== policy.authorship.classifier.version ||
      classifier.id !== policy.authorship.classifier.id
    ) {
      fail(code, "Deterministic classifier identity does not match the frozen policy.", {
        path,
        expected: policy.authorship.classifier
      });
    }
    normalized.version = identifier(classifier.version, `${path}.version`, code);
  } else if (classifier.version !== undefined) {
    fail(code, "Human classifier declarations must not contain a tool version.", { path });
  }

  assertFields(
    classifier.exposure,
    CLASSIFIER_EXPOSURE_FIELDS,
    [...CLASSIFIER_EXPOSURE_FIELDS],
    `${path}.exposure`,
    code
  );
  const allowedExposureStatuses = policy.exposure.status === "historically-exposed"
    ? (classifier.type === "human"
        ? new Set(["prospective-blind", "historically-exposed"])
        : new Set(["historically-exposed"]))
    : new Set([policy.exposure.status]);
  if (
    !EXPOSURE_STATUSES.includes(classifier.exposure.status) ||
    !allowedExposureStatuses.has(classifier.exposure.status) ||
    typeof classifier.exposure.sccAwareMaterialSeenBeforeAnnotation !== "boolean"
  ) {
    fail(code, "Classifier exposure does not match the frozen policy.", {
      path,
      policyStatus: policy.exposure.status,
      classifierStatus: classifier.exposure.status
    });
  }
  const shouldHaveSeenScc = classifier.exposure.status === "historically-exposed";
  if (classifier.exposure.sccAwareMaterialSeenBeforeAnnotation !== shouldHaveSeenScc) {
    fail(code, "Classifier SCC-exposure declaration contradicts the frozen exposure status.", {
      path,
      expected: shouldHaveSeenScc
    });
  }
  normalized.exposure = {
    status: classifier.exposure.status,
    declaration: normalizedString(classifier.exposure.declaration, `${path}.exposure.declaration`, code),
    sccAwareMaterialSeenBeforeAnnotation: classifier.exposure.sccAwareMaterialSeenBeforeAnnotation
  };
  return normalized;
}

function normalizeAnnotation(annotation, index, relationIds, classifierIds) {
  const code = "SOURCE_CLASSIFICATION_ANNOTATION_INVALID";
  const path = `$.annotations[${index}]`;
  assertFields(annotation, ANNOTATION_FIELDS, [...ANNOTATION_FIELDS], path, code);
  const relationId = identifier(annotation.relationId, `${path}.relationId`, code);
  const classifierId = identifier(annotation.classifierId, `${path}.classifierId`, code);
  if (!relationIds.has(relationId) || !classifierIds.has(classifierId)) {
    fail(code, "Annotation references an unknown relation or classifier.", {
      path,
      relationId,
      classifierId
    });
  }
  if (!RELATION_KINDS.includes(annotation.kind)) {
    fail(code, "Annotation relation kind is not supported.", { path, kind: annotation.kind });
  }
  return {
    relationId,
    classifierId,
    kind: annotation.kind,
    observations: normalizedStringSet(
      annotation.observations,
      `${path}.observations`,
      code,
      SOURCE_CLASSIFICATION_LIMITS.maxObservationsPerAnnotation
    ),
    rationale: normalizedString(annotation.rationale, `${path}.rationale`, code)
  };
}

export function freezeSourceClassificationAnnotations(policy, artifact) {
  const frozenPolicy = verifiedPolicy(policy);
  const input = cloneInput(artifact, "Source classification annotations");
  const code = "SOURCE_CLASSIFICATION_ANNOTATIONS_INVALID";
  assertFields(input, ANNOTATION_INPUT_FIELDS, [...ANNOTATION_INPUT_FIELDS], "$", code);
  if (input.schemaVersion !== "1" || input.policyHash !== frozenPolicy.policyHash) {
    fail(code, "Annotation artifact is not bound to the supplied frozen policy.", {
      policyHash: input.policyHash,
      expected: frozenPolicy.policyHash
    });
  }

  assertFields(input.view, VIEW_FIELDS, [...VIEW_FIELDS], "$.view", code);
  if (!isContentHash(input.view.hash)) {
    fail(code, "Annotation view must have a valid content hash.", { hash: input.view.hash });
  }
  const visibleFields = normalizedStringSet(input.view.visibleFields, "$.view.visibleFields", code);
  assertSameSet(visibleFields, frozenPolicy.visibleFields, "$.view.visibleFields", code);
  const relationIds = normalizedStringSet(
    input.view.relationIds,
    "$.view.relationIds",
    code,
    SOURCE_CLASSIFICATION_LIMITS.maxRelations
  );

  if (
    !Array.isArray(input.classifiers) ||
    input.classifiers.length === 0 ||
    input.classifiers.length > SOURCE_CLASSIFICATION_LIMITS.maxClassifiers
  ) {
    fail(code, "Annotation artifact requires a bounded classifier inventory.");
  }
  const classifiers = input.classifiers.map((classifier, index) =>
    normalizeClassifier(classifier, `$.classifiers[${index}]`, frozenPolicy, code)
  ).sort((left, right) => compareText(left.id, right.id));
  const classifierIds = classifiers.map((classifier) => classifier.id);
  if (new Set(classifierIds).size !== classifierIds.length) {
    fail(code, "Classifier identities must be unique.");
  }
  if (
    frozenPolicy.authorship.mode === "human-independent" &&
    classifiers.length < frozenPolicy.authorship.minimumIndependentClassifiers
  ) {
    fail(code, "Annotation artifact has fewer independent classifiers than the frozen policy requires.", {
      minimum: frozenPolicy.authorship.minimumIndependentClassifiers,
      actual: classifiers.length
    });
  }
  if (frozenPolicy.authorship.mode === "deterministic-precommitted" && classifiers.length !== 1) {
    fail(code, "Deterministic annotation requires exactly the precommitted classifier.");
  }

  const expectedAnnotations = relationIds.length * classifiers.length;
  if (
    !Number.isSafeInteger(expectedAnnotations) ||
    expectedAnnotations > SOURCE_CLASSIFICATION_LIMITS.maxAnnotations ||
    !Array.isArray(input.annotations) ||
    input.annotations.length !== expectedAnnotations
  ) {
    fail(code, "Every classifier must independently annotate every relation exactly once.", {
      expected: expectedAnnotations,
      actual: Array.isArray(input.annotations) ? input.annotations.length : null,
      maximum: SOURCE_CLASSIFICATION_LIMITS.maxAnnotations
    });
  }
  const relationIdSet = new Set(relationIds);
  const classifierIdSet = new Set(classifierIds);
  const annotations = input.annotations.map((annotation, index) =>
    normalizeAnnotation(annotation, index, relationIdSet, classifierIdSet)
  ).sort((left, right) =>
    compareText(left.relationId, right.relationId) || compareText(left.classifierId, right.classifierId)
  );
  const keys = annotations.map((annotation) => `${annotation.relationId}\0${annotation.classifierId}`);
  const keySet = new Set(keys);
  if (keySet.size !== keys.length) {
    fail(code, "A classifier may annotate each relation only once.");
  }

  const basis = {
    schemaVersion: "1",
    freezer: SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION,
    policyHash: frozenPolicy.policyHash,
    view: {
      hash: input.view.hash,
      visibleFields,
      relationIds
    },
    frozenAt: timestamp(input.frozenAt, "$.frozenAt", code),
    classifiers,
    annotations,
    statistics: {
      relationCount: relationIds.length,
      classifierCount: classifiers.length,
      annotationCount: annotations.length
    }
  };
  return deepFreeze({
    ...basis,
    annotationHash: hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_ANNOTATIONS, basis)
  });
}

function verifiedAnnotations(policy, artifact) {
  const cloned = cloneInput(artifact, "Frozen source classification annotations");
  const code = "SOURCE_CLASSIFICATION_ANNOTATION_BINDING_INVALID";
  assertFields(cloned, ANNOTATION_OUTPUT_FIELDS, [...ANNOTATION_OUTPUT_FIELDS], "$.annotationArtifact", code);
  assertFields(
    cloned.statistics,
    ANNOTATION_STATISTICS_FIELDS,
    [...ANNOTATION_STATISTICS_FIELDS],
    "$.annotationArtifact.statistics",
    code
  );
  if (
    cloned.schemaVersion !== "1" ||
    cloned.freezer !== SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION ||
    !isContentHash(cloned.annotationHash)
  ) {
    fail(code, "Source classification annotations are not a supported frozen artifact.");
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
    fail(code, "Source classification annotations cannot be reproduced by the supported freezer.", {
      causeCode: error.code
    });
  }
  if (
    reproduced.annotationHash !== cloned.annotationHash ||
    canonicalize(reproduced) !== canonicalize(cloned)
  ) {
    fail(code, "Source classification annotation content does not match its declared hash.", {
      expected: reproduced.annotationHash,
      actual: cloned.annotationHash
    });
  }
  return cloned;
}

function normalizeDecision(decision, index, rawByRelation) {
  const code = "SOURCE_CLASSIFICATION_ADJUDICATION_DECISION_INVALID";
  const path = `$.decisions[${index}]`;
  assertFields(decision, DECISION_INPUT_FIELDS, [...DECISION_INPUT_FIELDS], path, code);
  const relationId = identifier(decision.relationId, `${path}.relationId`, code);
  const raw = rawByRelation.get(relationId);
  if (raw === undefined) {
    fail(code, "Adjudication decision references an unknown relation.", { relationId });
  }
  if (!RELATION_KINDS.includes(decision.kind)) {
    fail(code, "Adjudicated relation kind is not supported.", { relationId, kind: decision.kind });
  }
  const rawKinds = RELATION_KINDS.filter((kind) => raw.has(kind));
  const status = rawKinds.length === 1 ? "agreement" : "adjudicated";
  if (status === "agreement" && decision.kind !== rawKinds[0]) {
    fail(code, "A unanimous raw classification cannot be overwritten during adjudication.", {
      relationId,
      expected: rawKinds[0],
      actual: decision.kind
    });
  }
  return {
    relationId,
    kind: decision.kind,
    rationale: normalizedString(decision.rationale, `${path}.rationale`, code),
    status,
    rawKinds
  };
}

export function freezeSourceClassificationAdjudication(policy, annotationArtifact, artifact) {
  const frozenPolicy = verifiedPolicy(policy);
  const annotations = verifiedAnnotations(frozenPolicy, annotationArtifact);
  const input = cloneInput(artifact, "Source classification adjudication");
  const code = "SOURCE_CLASSIFICATION_ADJUDICATION_INVALID";
  assertFields(input, ADJUDICATION_INPUT_FIELDS, [...ADJUDICATION_INPUT_FIELDS], "$", code);
  if (
    input.schemaVersion !== "1" ||
    input.policyHash !== frozenPolicy.policyHash ||
    input.annotationHash !== annotations.annotationHash
  ) {
    fail(code, "Adjudication artifact is not bound to the supplied policy and annotations.", {
      policyHash: input.policyHash,
      annotationHash: input.annotationHash
    });
  }
  const adjudicator = normalizeClassifier(input.adjudicator, "$.adjudicator", frozenPolicy, code);
  const frozenAt = timestamp(input.frozenAt, "$.frozenAt", code);
  const unblindedAt = timestamp(input.unblindedAt, "$.unblindedAt", code);
  if (
    Date.parse(frozenAt) < Date.parse(annotations.frozenAt) ||
    Date.parse(unblindedAt) < Date.parse(frozenAt)
  ) {
    fail(code, "Annotation, adjudication, and unblinding times must be ordered.", {
      annotationsFrozenAt: annotations.frozenAt,
      adjudicationFrozenAt: frozenAt,
      unblindedAt
    });
  }

  const rawByRelation = new Map(
    annotations.view.relationIds.map((relationId) => [relationId, new Set()])
  );
  for (const annotation of annotations.annotations) {
    rawByRelation.get(annotation.relationId).add(annotation.kind);
  }
  if (!Array.isArray(input.decisions) || input.decisions.length !== rawByRelation.size) {
    fail(code, "Adjudication must contain exactly one final decision for every relation.", {
      expected: rawByRelation.size,
      actual: Array.isArray(input.decisions) ? input.decisions.length : null
    });
  }
  const decisions = input.decisions.map((decision, index) =>
    normalizeDecision(decision, index, rawByRelation)
  ).sort((left, right) => compareText(left.relationId, right.relationId));
  const decisionIds = decisions.map((decision) => decision.relationId);
  if (new Set(decisionIds).size !== decisionIds.length) {
    fail(code, "Adjudication relation identities must be unique.");
  }
  assertSameSet(decisionIds, annotations.view.relationIds, "$.decisions", code);

  const disagreementCount = decisions.filter((decision) => decision.status === "adjudicated").length;
  const disagreementRatio = disagreementCount / decisions.length;
  const threshold = frozenPolicy.riskPolicy.maximumClassificationDisagreementRatio;
  const thresholdExceeded = disagreementRatio > threshold;
  const fittingRiskReasons = [
    ...(frozenPolicy.exposure.status === "historically-exposed" ? ["historically-exposed"] : []),
    ...(thresholdExceeded ? ["classification-disagreement-threshold-exceeded"] : [])
  ];
  const basis = {
    schemaVersion: "1",
    freezer: SOURCE_CLASSIFICATION_ADJUDICATION_VERSION,
    policyHash: frozenPolicy.policyHash,
    annotationHash: annotations.annotationHash,
    frozenAt,
    unblindedAt,
    adjudicator,
    decisions,
    statistics: {
      relationCount: decisions.length,
      disagreementCount,
      disagreementRatio,
      maximumClassificationDisagreementRatio: threshold,
      thresholdExceeded
    },
    fittingRisk: fittingRiskReasons.length === 0 ? "not-flagged" : "elevated",
    fittingRiskReasons
  };
  return deepFreeze({
    ...basis,
    adjudicationHash: hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_ADJUDICATION, basis)
  });
}
