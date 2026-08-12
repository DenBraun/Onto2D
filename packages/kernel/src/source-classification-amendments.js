import {
  canonicalClone,
  canonicalize,
  deepFreeze
} from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import { freezeSourceClassificationAdjudication } from "./source-classification.js";

export const SOURCE_CLASSIFICATION_AMENDMENTS_VERSION =
  "source-classification-amendments-v1";
export const SOURCE_CLASSIFICATION_AMENDMENT_LIMITS = deepFreeze({
  maxChanges: 10_000,
  maxIdentifierLength: 1_024,
  maxTextLength: 16_384
});
const SOURCE_RELATION_KINDS = Object.freeze([
  "generative",
  "constitutive",
  "intra-closure-support",
  "evidential",
  "descriptive",
  "regulatory-feedback"
]);

const INPUT_FIELDS = new Set([
  "schemaVersion",
  "policyHash",
  "adjudicationHash",
  "frozenAt",
  "changes"
]);
const OUTPUT_FIELDS = new Set([
  "schemaVersion",
  "freezer",
  "policyHash",
  "annotationHash",
  "adjudicationHash",
  "unblindedAt",
  "frozenAt",
  "changes",
  "effectiveDecisions",
  "statistics",
  "fittingRisk",
  "fittingRiskReasons",
  "amendmentsHash"
]);
const CHANGE_INPUT_FIELDS = new Set([
  "relationId",
  "newKind",
  "changedAt",
  "reason",
  "approver",
  "approvalArtifact"
]);
const APPROVER_FIELDS = new Set(["id", "role"]);
const ARTIFACT_REF_FIELDS = new Set([
  "path",
  "mediaType",
  "schemaVersion",
  "bytes",
  "hash"
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
    stage: "SOURCE_CLASSIFICATION_AMENDMENTS",
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
      "SOURCE_CLASSIFICATION_AMENDMENTS_INPUT_INVALID",
      `${label} must be canonicalizable.`,
      { causeCode: error.code }
    );
  }
}

function exactFields(value, allowed, required, path, code) {
  if (!isObject(value)) {
    fail(code, "Source classification amendment values must be objects.", { path });
  }
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Source classification amendment fields do not match the contract.", {
      path,
      unknown,
      missing
    });
  }
}

function normalizedString(value, path, code, maximum) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > maximum
  ) {
    fail(code, "Source classification amendment text must be normalized and bounded.", {
      path,
      maximum
    });
  }
  return value;
}

function timestamp(value, path, code) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    fail(code, "Source classification amendment timestamps must use canonical UTC milliseconds.", {
      path
    });
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(code, "Source classification amendment timestamps must denote real UTC instants.", {
      path
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
    fail(code, "Amendment approval artifacts require complete bounded references.", {
      path
    });
  }
  return value;
}

function verifiedAdjudication(policy, annotations, adjudicationInput) {
  const supplied = cloneInput(adjudicationInput, "Source adjudication");
  const draft = {
    schemaVersion: supplied?.schemaVersion,
    policyHash: supplied?.policyHash,
    annotationHash: supplied?.annotationHash,
    frozenAt: supplied?.frozenAt,
    unblindedAt: supplied?.unblindedAt,
    adjudicator: supplied?.adjudicator,
    decisions: Array.isArray(supplied?.decisions)
      ? supplied.decisions.map((entry) => ({
          relationId: entry.relationId,
          kind: entry.kind,
          rationale: entry.rationale
        }))
      : supplied?.decisions
  };
  let reproduced;
  try {
    reproduced = freezeSourceClassificationAdjudication(
      policy,
      annotations,
      draft
    );
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "SOURCE_CLASSIFICATION_AMENDMENTS_ADJUDICATION_INVALID",
      "Amendments require a reproducible frozen adjudication.",
      { causeCode: error.code }
    );
  }
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_CLASSIFICATION_AMENDMENTS_ADJUDICATION_INVALID",
      "Supplied adjudication differs from deterministic replay."
    );
  }
  return reproduced;
}

function normalizeApprover(value, path, code) {
  exactFields(value, APPROVER_FIELDS, [...APPROVER_FIELDS], path, code);
  return {
    id: normalizedString(
      value.id,
      `${path}.id`,
      code,
      SOURCE_CLASSIFICATION_AMENDMENT_LIMITS.maxIdentifierLength
    ),
    role: normalizedString(
      value.role,
      `${path}.role`,
      code,
      SOURCE_CLASSIFICATION_AMENDMENT_LIMITS.maxTextLength
    )
  };
}

function decisionStateHash(adjudicationHash, decision) {
  return hashCanonical(HASH_DOMAINS.SOURCE_CLASSIFICATION_DECISION, {
    schemaVersion: "1",
    adjudicationHash,
    relationId: decision.relationId,
    kind: decision.kind
  });
}

function normalizeChanges(changesInput, adjudication, frozenAt) {
  const code = "SOURCE_CLASSIFICATION_AMENDMENT_INVALID";
  if (
    !Array.isArray(changesInput) ||
    changesInput.length > SOURCE_CLASSIFICATION_AMENDMENT_LIMITS.maxChanges
  ) {
    fail(code, "Post-unblinding changes must be a bounded array.", {
      maximum: SOURCE_CLASSIFICATION_AMENDMENT_LIMITS.maxChanges
    });
  }
  const decisionByRelation = new Map(adjudication.decisions.map((entry) => [
    entry.relationId,
    entry
  ]));
  const normalizedInputs = changesInput.map((entry, index) => {
    const path = `$.changes[${index}]`;
    exactFields(
      entry,
      CHANGE_INPUT_FIELDS,
      [...CHANGE_INPUT_FIELDS],
      path,
      code
    );
    const relationId = normalizedString(
      entry.relationId,
      `${path}.relationId`,
      code,
      SOURCE_CLASSIFICATION_AMENDMENT_LIMITS.maxIdentifierLength
    );
    if (!decisionByRelation.has(relationId)) {
      fail(code, "An amendment references no frozen adjudication decision.", {
        relationId
      });
    }
    if (!SOURCE_RELATION_KINDS.includes(entry.newKind)) {
      fail(code, "An amendment uses an unsupported relation kind.", {
        relationId,
        newKind: entry.newKind
      });
    }
    const changedAt = timestamp(entry.changedAt, `${path}.changedAt`, code);
    if (Date.parse(changedAt) <= Date.parse(adjudication.unblindedAt)) {
      fail(code, "Every amendment must occur strictly after unblinding.", {
        relationId,
        unblindedAt: adjudication.unblindedAt,
        changedAt
      });
    }
    if (Date.parse(changedAt) > Date.parse(frozenAt)) {
      fail(code, "An amendment cannot occur after its log freeze instant.", {
        relationId,
        changedAt,
        frozenAt
      });
    }
    return {
      relationId,
      newKind: entry.newKind,
      changedAt,
      reason: normalizedString(
        entry.reason,
        `${path}.reason`,
        code,
        SOURCE_CLASSIFICATION_AMENDMENT_LIMITS.maxTextLength
      ),
      approver: normalizeApprover(entry.approver, `${path}.approver`, code),
      approvalArtifact: artifactRef(
        entry.approvalArtifact,
        `${path}.approvalArtifact`,
        code
      )
    };
  }).sort((left, right) =>
    compareStrings(left.changedAt, right.changedAt) ||
    compareStrings(left.relationId, right.relationId) ||
    compareStrings(left.newKind, right.newKind)
  );
  const instants = normalizedInputs.map((entry) =>
    `${entry.relationId}\0${entry.changedAt}`
  );
  if (new Set(instants).size !== instants.length) {
    fail(
      "SOURCE_CLASSIFICATION_AMENDMENT_ORDER_AMBIGUOUS",
      "One relation cannot have multiple amendments at the same instant."
    );
  }

  const stateByRelation = new Map(adjudication.decisions.map((decision) => [
    decision.relationId,
    {
      kind: decision.kind,
      stateHash: decisionStateHash(adjudication.adjudicationHash, decision),
      changeIds: []
    }
  ]));
  const changes = normalizedInputs.map((entry) => {
    const state = stateByRelation.get(entry.relationId);
    if (entry.newKind === state.kind) {
      fail(
        "SOURCE_CLASSIFICATION_AMENDMENT_NO_CHANGE",
        "An amendment must change the currently effective relation kind.",
        { relationId: entry.relationId, kind: entry.newKind }
      );
    }
    const basis = {
      schemaVersion: "1",
      relationId: entry.relationId,
      originalKind: state.kind,
      newKind: entry.newKind,
      changedAt: entry.changedAt,
      reason: entry.reason,
      approver: entry.approver,
      approvalArtifact: entry.approvalArtifact,
      priorStateHash: state.stateHash
    };
    const changeId = hashCanonical(
      HASH_DOMAINS.SOURCE_CLASSIFICATION_AMENDMENT,
      basis,
      CANONICAL_OPTIONS
    );
    state.kind = entry.newKind;
    state.stateHash = changeId;
    state.changeIds.push(changeId);
    return { ...basis, changeId };
  });
  const effectiveDecisions = adjudication.decisions.map((decision) => {
    const state = stateByRelation.get(decision.relationId);
    return {
      relationId: decision.relationId,
      frozenKind: decision.kind,
      effectiveKind: state.kind,
      finalStateHash: state.stateHash,
      changeIds: state.changeIds
    };
  });
  return { changes, effectiveDecisions };
}

/** Freezes a complete, non-overwriting post-unblinding amendment log. */
export function freezeSourceClassificationAmendments(
  policyInput,
  annotationsInput,
  adjudicationInput,
  amendmentsInput
) {
  const policy = cloneInput(policyInput, "Source classification policy");
  const annotations = cloneInput(annotationsInput, "Source annotations");
  const adjudication = verifiedAdjudication(
    policy,
    annotations,
    adjudicationInput
  );
  const input = cloneInput(amendmentsInput, "Source classification amendments");
  const code = "SOURCE_CLASSIFICATION_AMENDMENTS_INVALID";
  exactFields(input, INPUT_FIELDS, [...INPUT_FIELDS], "$", code);
  if (
    input.schemaVersion !== "1" ||
    input.policyHash !== policy.policyHash ||
    input.adjudicationHash !== adjudication.adjudicationHash
  ) {
    fail(code, "Amendments are not bound to the frozen policy and adjudication.");
  }
  const frozenAt = timestamp(input.frozenAt, "$.frozenAt", code);
  if (Date.parse(frozenAt) <= Date.parse(adjudication.unblindedAt)) {
    fail(code, "The amendment log must be frozen strictly after unblinding.", {
      unblindedAt: adjudication.unblindedAt,
      frozenAt
    });
  }
  const { changes, effectiveDecisions } = normalizeChanges(
    input.changes,
    adjudication,
    frozenAt
  );
  const changedRelationCount = new Set(
    changes.map((entry) => entry.relationId)
  ).size;
  const changedRelationShare = changedRelationCount / adjudication.decisions.length;
  const maximum =
    policy.riskPolicy.maximumPostUnblindingReclassificationShare;
  const thresholdExceeded = changedRelationShare > maximum;
  const fittingRiskReasons = [
    ...adjudication.fittingRiskReasons,
    ...(thresholdExceeded
      ? ["post-unblinding-reclassification-threshold-exceeded"]
      : [])
  ];
  const basis = {
    schemaVersion: "1",
    freezer: SOURCE_CLASSIFICATION_AMENDMENTS_VERSION,
    policyHash: policy.policyHash,
    annotationHash: adjudication.annotationHash,
    adjudicationHash: adjudication.adjudicationHash,
    unblindedAt: adjudication.unblindedAt,
    frozenAt,
    changes,
    effectiveDecisions,
    statistics: {
      relationCount: adjudication.decisions.length,
      changeCount: changes.length,
      changedRelationCount,
      changedRelationShare,
      maximumPostUnblindingReclassificationShare: maximum,
      thresholdExceeded
    },
    fittingRisk: fittingRiskReasons.length === 0 ? "not-flagged" : "elevated",
    fittingRiskReasons
  };
  return deepFreeze({
    ...basis,
    amendmentsHash: hashCanonical(
      HASH_DOMAINS.SOURCE_CLASSIFICATION_AMENDMENTS,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Exactly replays a serialized post-unblinding amendment log. */
export function verifySourceClassificationAmendments(
  policy,
  annotations,
  adjudication,
  amendmentsInput
) {
  const supplied = cloneInput(amendmentsInput, "Source classification amendments");
  exactFields(
    supplied,
    OUTPUT_FIELDS,
    [...OUTPUT_FIELDS],
    "$",
    "SOURCE_CLASSIFICATION_AMENDMENTS_INVALID"
  );
  const reproduced = freezeSourceClassificationAmendments(
    policy,
    annotations,
    adjudication,
    {
      schemaVersion: supplied.schemaVersion,
      policyHash: supplied.policyHash,
      adjudicationHash: supplied.adjudicationHash,
      frozenAt: supplied.frozenAt,
      changes: Array.isArray(supplied.changes)
        ? supplied.changes.map((entry) => ({
            relationId: entry.relationId,
            newKind: entry.newKind,
            changedAt: entry.changedAt,
            reason: entry.reason,
            approver: entry.approver,
            approvalArtifact: entry.approvalArtifact
          }))
        : supplied.changes
    }
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_CLASSIFICATION_AMENDMENTS_MISMATCH",
      "Source classification amendments differ from deterministic replay.",
      {
        expected: reproduced.amendmentsHash,
        actual: isObject(supplied) ? supplied.amendmentsHash ?? null : null
      }
    );
  }
  return reproduced;
}
