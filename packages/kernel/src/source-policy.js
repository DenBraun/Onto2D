import { canonicalClone, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";

export const SOURCE_CLASSIFICATION_POLICY_VERSION = "source-classification-policy-v1";
export const SOURCE_NODE_RESOLUTION_POLICY_VERSION = "source-node-resolution-policy-v1";

export const SOURCE_POLICY_LIMITS = deepFreeze({
  maxIdentifierLength: 1_024,
  maxTextLength: 16_384,
  maxListEntries: 1_000,
  maxIndependentClassifiers: 100
});

export const SOURCE_CLASSIFICATION_VISIBLE_FIELDS = deepFreeze([
  "causal-directions",
  "dependency-type",
  "interaction-modes",
  "necessity",
  "ontological-role",
  "parent-code",
  "quantization",
  "source",
  "source-text",
  "statement",
  "target",
  "weight"
]);

const RELATION_KINDS = Object.freeze([
  "generative",
  "constitutive",
  "intra-closure-support",
  "evidential",
  "descriptive",
  "regulatory-feedback"
]);
const CLUSTER_DISPOSITIONS = Object.freeze([
  "distributed-structure",
  "constitutive-cluster",
  "unresolved-generative-cluster",
  "mixed-unresolved-cluster"
]);
const EXPOSURE_STATUSES = Object.freeze([
  "prospective-blind",
  "deterministic-precommitted",
  "historically-exposed"
]);
const REQUIRED_CLASSIFICATION_FORBIDDEN_INPUTS = Object.freeze([
  "cycle-visualization",
  "desired-topology",
  "quotient-acyclicity-effect",
  "scc-membership"
]);
const ALLOWED_CLASSIFICATION_VISIBLE_FIELDS = new Set(SOURCE_CLASSIFICATION_VISIBLE_FIELDS);
const REQUIRED_RESOLUTION_INPUTS = Object.freeze([
  "classified-relations",
  "source-relation-endpoints",
  "strongly-connected-component-membership"
]);
const REQUIRED_RESOLUTION_FORBIDDEN_CRITERIA = Object.freeze([
  "component-size-only",
  "cycle-removal-outcome",
  "desired-acyclicity",
  "paper-resemblance-only"
]);
const REQUIRED_EDGE_DESTINATIONS = Object.freeze([
  "inter-cluster",
  "internal",
  "typed-explanation"
]);
const CONTENT_HASH = /^sha256:[a-f0-9]{64}$/;

const CLASSIFICATION_FIELDS = new Set([
  "schemaVersion",
  "version",
  "authorship",
  "exposure",
  "visibleFields",
  "forbiddenInputs",
  "relationKinds",
  "conflictRule",
  "riskPolicy"
]);
const AUTHORSHIP_FIELDS = new Set([
  "mode",
  "minimumIndependentClassifiers",
  "classifier",
  "adjudicationRule"
]);
const CLASSIFIER_FIELDS = new Set(["id", "version"]);
const EXPOSURE_FIELDS = new Set(["status", "declaration", "sccAwareMaterialSeenBeforeFreeze"]);
const RELATION_RULE_FIELDS = new Set([
  "decisionQuestion",
  "necessaryObservations",
  "sufficientObservations",
  "inclusions",
  "exclusions",
  "counterexamples"
]);
const RISK_FIELDS = new Set([
  "maximumClassificationDisagreementRatio",
  "maximumDescriptiveResolutionShare",
  "maximumPostUnblindingReclassificationShare",
  "acceptedBlindness"
]);
const RESOLUTION_FIELDS = new Set([
  "schemaVersion",
  "version",
  "classificationPolicyHash",
  "visibleInputs",
  "forbiddenCriteria",
  "dispositionRules",
  "edgeReconciliation",
  "clusterSemantics",
  "reviewRule"
]);
const DISPOSITION_RULE_FIELDS = new Set([
  "decisionQuestion",
  "criteria",
  "positiveExamples",
  "negativeExamples"
]);
const EDGE_RECONCILIATION_FIELDS = new Set([
  "destinations",
  "requireExactlyOnce",
  "preserveRawRelationReferences"
]);
const CLUSTER_SEMANTICS_FIELDS = new Set([
  "internalOrder",
  "memberDepthInheritance",
  "requireCondensationDag"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "SOURCE_POLICY", message, details });
}

function cloneInput(value, label) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("SOURCE_POLICY_INPUT_INVALID", `${label} is not canonicalizable.`, {
      causeCode: error.code,
      ...error.details
    });
  }
}

function assertFields(value, allowed, required, path, code) {
  if (!isObject(value)) fail(code, "Source policy value must be an object.", { path });
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Source policy fields do not match the supported contract.", {
      path,
      unknown,
      missing
    });
  }
}

function normalizedString(value, path, code, maximumLength = SOURCE_POLICY_LIMITS.maxTextLength) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > maximumLength
  ) {
    fail(code, "Source policy text must be normalized, non-empty, and within the length limit.", {
      path,
      maximumLength
    });
  }
  return value;
}

function identifier(value, path, code) {
  return normalizedString(value, path, code, SOURCE_POLICY_LIMITS.maxIdentifierLength);
}

function normalizedStringSet(value, path, code, options = {}) {
  if (
    !Array.isArray(value) ||
    (options.nonEmpty !== false && value.length === 0) ||
    value.length > SOURCE_POLICY_LIMITS.maxListEntries
  ) {
    fail(code, "Source policy list must be a bounded array.", {
      path,
      maximumEntries: SOURCE_POLICY_LIMITS.maxListEntries
    });
  }
  const normalized = value.map((entry, index) =>
    normalizedString(entry, `${path}[${index}]`, code)
  );
  if (new Set(normalized).size !== normalized.length) {
    fail(code, "Source policy lists must not contain duplicate entries.", { path });
  }
  return normalized.sort();
}

function assertExactSet(actual, expected, path, code) {
  const missing = expected.filter((entry) => !actual.includes(entry));
  const unknown = actual.filter((entry) => !expected.includes(entry));
  if (missing.length > 0 || unknown.length > 0) {
    fail(code, "Source policy list does not contain the required frozen vocabulary.", {
      path,
      missing,
      unknown
    });
  }
}

function ratio(value, path, code) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(code, "Source migration risk thresholds must be finite ratios from zero through one.", {
      path,
      value
    });
  }
  return value;
}

function normalizeAuthorship(authorship) {
  const code = "SOURCE_CLASSIFICATION_AUTHORSHIP_INVALID";
  assertFields(
    authorship,
    AUTHORSHIP_FIELDS,
    ["mode", "adjudicationRule"],
    "$.authorship",
    code
  );
  if (!new Set(["human-independent", "deterministic-precommitted"]).has(authorship.mode)) {
    fail(code, "Classification authorship mode is not supported.", { mode: authorship.mode });
  }
  const normalized = {
    mode: authorship.mode,
    adjudicationRule: normalizedString(authorship.adjudicationRule, "$.authorship.adjudicationRule", code)
  };
  if (authorship.mode === "human-independent") {
    if (
      !Number.isSafeInteger(authorship.minimumIndependentClassifiers) ||
      authorship.minimumIndependentClassifiers < 2 ||
      authorship.minimumIndependentClassifiers > SOURCE_POLICY_LIMITS.maxIndependentClassifiers ||
      authorship.classifier !== undefined
    ) {
      fail(code, "Human classification requires a realizable bounded independent-classifier count and no deterministic classifier identity.", {
        minimum: 2,
        maximum: SOURCE_POLICY_LIMITS.maxIndependentClassifiers
      });
    }
    normalized.minimumIndependentClassifiers = authorship.minimumIndependentClassifiers;
  } else {
    if (authorship.minimumIndependentClassifiers !== undefined) {
      fail(code, "Deterministic classification must not declare human classifier counts.");
    }
    assertFields(
      authorship.classifier,
      CLASSIFIER_FIELDS,
      ["id", "version"],
      "$.authorship.classifier",
      code
    );
    normalized.classifier = {
      id: identifier(authorship.classifier.id, "$.authorship.classifier.id", code),
      version: identifier(authorship.classifier.version, "$.authorship.classifier.version", code)
    };
  }
  return normalized;
}

function normalizeExposure(exposure, authorshipMode) {
  const code = "SOURCE_CLASSIFICATION_EXPOSURE_INVALID";
  assertFields(exposure, EXPOSURE_FIELDS, [...EXPOSURE_FIELDS], "$.exposure", code);
  if (!EXPOSURE_STATUSES.includes(exposure.status)) {
    fail(code, "Classification exposure status is not supported.", { status: exposure.status });
  }
  if (typeof exposure.sccAwareMaterialSeenBeforeFreeze !== "boolean") {
    fail(code, "Classification exposure must state whether SCC-aware material was seen before policy freeze.");
  }
  if (exposure.status === "prospective-blind" && authorshipMode !== "human-independent") {
    fail(code, "Prospective-blind status requires independent human authorship.");
  }
  if (
    exposure.status === "deterministic-precommitted" &&
    authorshipMode !== "deterministic-precommitted"
  ) {
    fail(code, "Deterministic-precommitted status requires deterministic classifier authorship.");
  }
  if (
    exposure.status === "historically-exposed" &&
    exposure.sccAwareMaterialSeenBeforeFreeze !== true
  ) {
    fail(code, "Historically-exposed status must preserve the positive exposure declaration.");
  }
  if (
    exposure.status !== "historically-exposed" &&
    exposure.sccAwareMaterialSeenBeforeFreeze !== false
  ) {
    fail(code, "Blind or precommitted status is incompatible with pre-freeze SCC-aware exposure.");
  }
  return {
    status: exposure.status,
    declaration: normalizedString(exposure.declaration, "$.exposure.declaration", code),
    sccAwareMaterialSeenBeforeFreeze: exposure.sccAwareMaterialSeenBeforeFreeze
  };
}

function normalizeRelationRule(rule, kind) {
  const code = "SOURCE_CLASSIFICATION_RELATION_RULE_INVALID";
  const path = `$.relationKinds.${kind}`;
  assertFields(rule, RELATION_RULE_FIELDS, [...RELATION_RULE_FIELDS], path, code);
  return {
    decisionQuestion: normalizedString(rule.decisionQuestion, `${path}.decisionQuestion`, code),
    necessaryObservations: normalizedStringSet(rule.necessaryObservations, `${path}.necessaryObservations`, code),
    sufficientObservations: normalizedStringSet(rule.sufficientObservations, `${path}.sufficientObservations`, code),
    inclusions: normalizedStringSet(rule.inclusions, `${path}.inclusions`, code),
    exclusions: normalizedStringSet(rule.exclusions, `${path}.exclusions`, code),
    counterexamples: normalizedStringSet(rule.counterexamples, `${path}.counterexamples`, code)
  };
}

function normalizeRiskPolicy(riskPolicy, exposureStatus) {
  const code = "SOURCE_CLASSIFICATION_RISK_POLICY_INVALID";
  assertFields(riskPolicy, RISK_FIELDS, [...RISK_FIELDS], "$.riskPolicy", code);
  const acceptedBlindness = normalizedStringSet(
    riskPolicy.acceptedBlindness,
    "$.riskPolicy.acceptedBlindness",
    code
  );
  const invalid = acceptedBlindness.filter((status) => !EXPOSURE_STATUSES.includes(status));
  if (invalid.length > 0) {
    fail(code, "Risk policy contains an unknown exposure status.", { invalid });
  }
  if (!acceptedBlindness.includes(exposureStatus)) {
    fail(code, "The frozen policy exposure status is not accepted by its migration risk policy.", {
      exposureStatus
    });
  }
  return {
    maximumClassificationDisagreementRatio: ratio(
      riskPolicy.maximumClassificationDisagreementRatio,
      "$.riskPolicy.maximumClassificationDisagreementRatio",
      code
    ),
    maximumDescriptiveResolutionShare: ratio(
      riskPolicy.maximumDescriptiveResolutionShare,
      "$.riskPolicy.maximumDescriptiveResolutionShare",
      code
    ),
    maximumPostUnblindingReclassificationShare: ratio(
      riskPolicy.maximumPostUnblindingReclassificationShare,
      "$.riskPolicy.maximumPostUnblindingReclassificationShare",
      code
    ),
    acceptedBlindness
  };
}

export function freezeSourceClassificationPolicy(policy) {
  const input = cloneInput(policy, "Source classification policy");
  const code = "SOURCE_CLASSIFICATION_POLICY_INVALID";
  assertFields(input, CLASSIFICATION_FIELDS, [...CLASSIFICATION_FIELDS], "$", code);
  if (input.schemaVersion !== "1") {
    fail(code, "Source classification policy schema version is not supported.", {
      schemaVersion: input.schemaVersion
    });
  }
  const authorship = normalizeAuthorship(input.authorship);
  const exposure = normalizeExposure(input.exposure, authorship.mode);
  const visibleFields = normalizedStringSet(input.visibleFields, "$.visibleFields", code);
  const unsupportedVisibleFields = visibleFields.filter((field) =>
    !ALLOWED_CLASSIFICATION_VISIBLE_FIELDS.has(field)
  );
  const missingVisibleFields = ["source", "target"].filter((field) =>
    !visibleFields.includes(field)
  );
  if (unsupportedVisibleFields.length > 0 || missingVisibleFields.length > 0) {
    fail(code, "Classification-visible fields must use the closed local-field vocabulary and include both endpoints.", {
      unsupported: unsupportedVisibleFields,
      missing: missingVisibleFields
    });
  }
  const forbiddenInputs = normalizedStringSet(input.forbiddenInputs, "$.forbiddenInputs", code);
  assertExactSet(
    forbiddenInputs,
    REQUIRED_CLASSIFICATION_FORBIDDEN_INPUTS,
    "$.forbiddenInputs",
    code
  );
  const leakedInputs = visibleFields.filter((field) => forbiddenInputs.includes(field));
  if (leakedInputs.length > 0) {
    fail(code, "Classification-visible fields include SCC-aware or outcome-aware inputs.", {
      leakedInputs
    });
  }
  assertFields(
    input.relationKinds,
    new Set(RELATION_KINDS),
    RELATION_KINDS,
    "$.relationKinds",
    code
  );
  const relationKinds = Object.fromEntries(
    RELATION_KINDS.map((kind) => [kind, normalizeRelationRule(input.relationKinds[kind], kind)])
  );
  const basis = {
    schemaVersion: "1",
    freezer: SOURCE_CLASSIFICATION_POLICY_VERSION,
    version: identifier(input.version, "$.version", code),
    authorship,
    exposure,
    visibleFields,
    forbiddenInputs,
    relationKinds,
    conflictRule: normalizedString(input.conflictRule, "$.conflictRule", code),
    riskPolicy: normalizeRiskPolicy(input.riskPolicy, exposure.status)
  };
  return deepFreeze({
    ...basis,
    policyHash: hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_POLICY, basis)
  });
}

function normalizeDispositionRule(rule, disposition) {
  const code = "SOURCE_RESOLUTION_DISPOSITION_RULE_INVALID";
  const path = `$.dispositionRules.${disposition}`;
  assertFields(rule, DISPOSITION_RULE_FIELDS, [...DISPOSITION_RULE_FIELDS], path, code);
  return {
    decisionQuestion: normalizedString(rule.decisionQuestion, `${path}.decisionQuestion`, code),
    criteria: normalizedStringSet(rule.criteria, `${path}.criteria`, code),
    positiveExamples: normalizedStringSet(rule.positiveExamples, `${path}.positiveExamples`, code),
    negativeExamples: normalizedStringSet(rule.negativeExamples, `${path}.negativeExamples`, code)
  };
}

export function freezeSourceNodeResolutionPolicy(policy) {
  const input = cloneInput(policy, "Source node-resolution policy");
  const code = "SOURCE_RESOLUTION_POLICY_INVALID";
  assertFields(input, RESOLUTION_FIELDS, [...RESOLUTION_FIELDS], "$", code);
  if (input.schemaVersion !== "1") {
    fail(code, "Source node-resolution policy schema version is not supported.", {
      schemaVersion: input.schemaVersion
    });
  }
  if (!isContentHash(input.classificationPolicyHash) || !CONTENT_HASH.test(input.classificationPolicyHash)) {
    fail(code, "Node-resolution policy must bind a valid classification policy hash.", {
      classificationPolicyHash: input.classificationPolicyHash
    });
  }
  const visibleInputs = normalizedStringSet(input.visibleInputs, "$.visibleInputs", code);
  const missingInputs = REQUIRED_RESOLUTION_INPUTS.filter((entry) => !visibleInputs.includes(entry));
  if (missingInputs.length > 0) {
    fail(code, "Node-resolution policy omits required post-classification inputs.", { missingInputs });
  }
  const forbiddenCriteria = normalizedStringSet(input.forbiddenCriteria, "$.forbiddenCriteria", code);
  assertExactSet(
    forbiddenCriteria,
    REQUIRED_RESOLUTION_FORBIDDEN_CRITERIA,
    "$.forbiddenCriteria",
    code
  );
  assertFields(
    input.dispositionRules,
    new Set(CLUSTER_DISPOSITIONS),
    CLUSTER_DISPOSITIONS,
    "$.dispositionRules",
    code
  );
  const dispositionRules = Object.fromEntries(
    CLUSTER_DISPOSITIONS.map((disposition) => [
      disposition,
      normalizeDispositionRule(input.dispositionRules[disposition], disposition)
    ])
  );

  assertFields(
    input.edgeReconciliation,
    EDGE_RECONCILIATION_FIELDS,
    [...EDGE_RECONCILIATION_FIELDS],
    "$.edgeReconciliation",
    code
  );
  const destinations = normalizedStringSet(
    input.edgeReconciliation.destinations,
    "$.edgeReconciliation.destinations",
    code
  );
  assertExactSet(destinations, REQUIRED_EDGE_DESTINATIONS, "$.edgeReconciliation.destinations", code);
  if (
    input.edgeReconciliation.requireExactlyOnce !== true ||
    input.edgeReconciliation.preserveRawRelationReferences !== true
  ) {
    fail(code, "Every raw source relation must be preserved and reconciled exactly once.");
  }

  assertFields(
    input.clusterSemantics,
    CLUSTER_SEMANTICS_FIELDS,
    [...CLUSTER_SEMANTICS_FIELDS],
    "$.clusterSemantics",
    code
  );
  if (
    input.clusterSemantics.internalOrder !== "undefined" ||
    input.clusterSemantics.memberDepthInheritance !== "cluster-depth" ||
    input.clusterSemantics.requireCondensationDag !== true
  ) {
    fail(code, "Node-resolution cluster semantics must preserve undefined internal order and DAG condensation.");
  }

  const basis = {
    schemaVersion: "1",
    freezer: SOURCE_NODE_RESOLUTION_POLICY_VERSION,
    version: identifier(input.version, "$.version", code),
    classificationPolicyHash: input.classificationPolicyHash,
    visibleInputs,
    forbiddenCriteria,
    dispositionRules,
    edgeReconciliation: {
      destinations,
      requireExactlyOnce: true,
      preserveRawRelationReferences: true
    },
    clusterSemantics: {
      internalOrder: "undefined",
      memberDepthInheritance: "cluster-depth",
      requireCondensationDag: true
    },
    reviewRule: normalizedString(input.reviewRule, "$.reviewRule", code)
  };
  return deepFreeze({
    ...basis,
    policyHash: hashCanonical(HASH_DOMAINS.SOURCE_NODE_RESOLUTION_POLICY, basis)
  });
}
