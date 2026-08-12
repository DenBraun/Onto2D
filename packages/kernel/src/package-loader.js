import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import {
  INVARIANT_STRING_MAX_LENGTH,
  candidateAttributeSymbolEnvironment,
  invariantExpressionSymbol,
  invariantIdentityValue,
  invariantValueKind,
  normalizeInvariantValue
} from "./invariant.js";
import { compilePredicate } from "./predicate-analyzer.js";
import {
  areUnitsCompatible,
  normalizeQuantity as normalizeRuntimeQuantity,
  parseUnitExpression
} from "./quantity.js";
import { normalizeProfileRecord } from "./profile.js";
import { normalizeProfileSlotGuard } from "./profile-guard.js";

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "id",
  "version",
  "sourceArtifacts",
  "sourceMigration",
  "evidence",
  "claims",
  "primitives",
  "predicates",
  "functionals",
  "cohortRules",
  "selectors",
  "partialOraclePolicy",
  "ontologyAxes",
  "perturbations",
  "candidateAttributes",
  "profileDefinition",
  "identityPolicy"
]);
const ARTIFACT_FIELDS = new Set(["path", "mediaType", "schemaVersion", "bytes", "hash"]);
const SOURCE_MIGRATION_FIELDS = new Set([
  "policyHash",
  "blindnessStatus",
  "classificationPolicy",
  "riskPolicy",
  "classificationView",
  "classificationAnnotations",
  "classificationAdjudication",
  "classificationAmendments",
  "classifiedRelations",
  "nodeResolutions",
  "condensation",
  "memberProjections",
  "typedRelationLayers",
  "reconciliation",
  "metrics",
  "explanationIndex",
  "concentration"
]);
const SOURCE_MIGRATION_ARTIFACT_FIELDS = Object.freeze([
  "classificationPolicy",
  "riskPolicy",
  "classificationView",
  "classificationAnnotations",
  "classificationAdjudication",
  "classificationAmendments",
  "classifiedRelations",
  "nodeResolutions",
  "condensation",
  "memberProjections",
  "reconciliation",
  "metrics",
  "explanationIndex"
]);
const MIGRATION_BLINDNESS_STATUSES = new Set([
  "prospective-blind",
  "deterministic-precommitted",
  "historically-exposed"
]);
const EVIDENCE_FIELDS = new Set(["id", "state", "source", "locator", "method"]);
const CLAIM_FIELDS = new Set(["id", "statement", "state", "evidence"]);
const PRIMITIVE_FIELDS = new Set([
  "sourceId",
  "kind",
  "cluster",
  "ontologyCoordinate",
  "axisProvenance",
  "typeTags",
  "invariants",
  "profile",
  "claimRefs"
]);
const CLUSTER_FIELDS = new Set([
  "disposition",
  "members",
  "internalRelations",
  "internalOrder",
  "classificationPolicyHash",
  "classificationArtifact",
  "nodeResolutionArtifact",
  "condensationArtifact"
]);
const PROFILE_FIELDS = new Set(["slots", "invariantVector", "precisionPolicy", "hash"]);
const SLOT_FIELDS = new Set(["role", "polarity", "capacity", "guard"]);
const PROFILE_INVARIANT_FIELDS = new Set(["semantic", "normalized", "quantization"]);
const QUANTITY_FIELDS = new Set(["value", "unit", "tolerance", "semantic", "provenance"]);
const TOLERANCE_FIELDS = new Set(["absolute", "relative"]);
const EXPLICIT_PROFILE_DEFINITION_FIELDS = new Set(["kind"]);
const RESIDUAL_PROFILE_DEFINITION_FIELDS = new Set([
  "kind",
  "baseProfile",
  "derivedTypeTags",
  "claimRefs"
]);
const FORMATION_DERIVED_PROFILE_DEFINITION_FIELDS = new Set([
  ...RESIDUAL_PROFILE_DEFINITION_FIELDS,
  "derivedInvariants"
]);
const FORMATION_DERIVED_TYPED_PROFILE_DEFINITION_FIELDS = new Set([
  ...FORMATION_DERIVED_PROFILE_DEFINITION_FIELDS,
  "derivedTypeRules"
]);
const FORMATION_DERIVED_INVARIANT_FIELDS = new Set([
  "semantic",
  "functional",
  "quantization"
]);
const FORMATION_DERIVED_TYPE_RULE_FIELDS = new Set([
  "typeTag",
  "invariant",
  "comparator",
  "threshold"
]);
const QUANTITY_COMPARATORS = new Set(["eq", "ne", "lt", "lte", "gt", "gte"]);
const CANDIDATE_ATTRIBUTE_FIELDS = new Set(["name", "target", "source"]);
const CANDIDATE_ATTRIBUTE_SOURCE_FIELDS = Object.freeze({
  "constant-scalar-v1": new Set(["kind", "value"]),
  "element-invariant-scalar-v1": new Set(["kind", "invariant"]),
  "constant-quantity-v1": new Set(["kind", "value"]),
  "element-invariant-quantity-v1": new Set(["kind", "invariant"]),
  "edge-role-scalar-v1": new Set(["kind", "values"]),
  "edge-role-quantity-v1": new Set(["kind", "values"])
});
const CONSTANT_CANDIDATE_ATTRIBUTE_SOURCES = new Set([
  "constant-scalar-v1",
  "constant-quantity-v1"
]);
const ROLE_CANDIDATE_ATTRIBUTE_SOURCES = new Set([
  "edge-role-scalar-v1",
  "edge-role-quantity-v1"
]);
const PREDICATE_FIELDS = new Set([
  "id",
  "phase",
  "monotoneViolation",
  "referencesDepth",
  "expr",
  "explain",
  "claimRefs"
]);
const FUNCTIONAL_FIELDS = new Set([
  "id",
  "expr",
  "coefficients",
  "coefficientRoles",
  "sensitivityCoefficients",
  "result",
  "explain",
  "claimRefs"
]);
const FUNCTIONAL_REQUIRED_FIELDS = [...FUNCTIONAL_FIELDS].filter(
  (field) => field !== "coefficientRoles"
);
const FUNCTIONAL_COEFFICIENT_ROLES = new Set(["fixed", "free", "fitted"]);
const SELECTOR_FIELDS = new Set([
  "id",
  "objective",
  "functional",
  "cohortRule",
  "epsilon",
  "tiePolicy",
  "sensitivity",
  "explain",
  "claimRefs"
]);
const ONTOLOGY_PHASE = /^(?:A|B|C|D|custom:[A-Za-z0-9][A-Za-z0-9._-]*)$/;
const EVIDENCE_STATES = new Set([
  "paper-assumption",
  "paper-derivation",
  "package-operationalization",
  "computationally-verified",
  "externally-supported",
  "falsified",
  "unresolved"
]);
const CLUSTER_DISPOSITIONS = new Set([
  "distributed-structure",
  "constitutive-cluster",
  "unresolved-generative-cluster",
  "mixed-unresolved-cluster"
]);
const DEFAULT_IDENTITY_POLICY = Object.freeze({
  version: "identity-v1",
  sourceIdStructural: false,
  ontologyCoordinateStructural: true,
  typeTagsStructural: true,
  invariantsStructural: true,
  profileStructural: true,
  clusterPolicyStructural: true
});
const DEFAULT_ONTOLOGY_AXES = Object.freeze({
  phasePrecedence: [],
  levelPolicy: "declared"
});
const DEFAULT_PARTIAL_ORACLE_POLICY = Object.freeze({ mode: "indeterminate" });
const DEFAULT_PROFILE_DEFINITION = Object.freeze({ kind: "explicit-only" });
const DEFAULT_CANDIDATE_ATTRIBUTES = Object.freeze([]);
const PERTURBATION_COMMON_FIELDS = new Set([
  "id",
  "kind",
  "enumeration",
  "emptyPolicy"
]);
const PERTURBATION_FIELDS = Object.freeze({
  "edge-deletion": new Set([...PERTURBATION_COMMON_FIELDS, "roles"]),
  "node-deletion": new Set(PERTURBATION_COMMON_FIELDS),
  "edge-role-replacement": new Set([
    ...PERTURBATION_COMMON_FIELDS,
    "replacements"
  ]),
  "numeric-attribute-displacement": new Set([
    ...PERTURBATION_COMMON_FIELDS,
    "target",
    "attribute",
    "epsilon",
    "directions"
  ])
});
const DEFAULT_PERTURBATION_ENUMERATION =
  "exhaustive-valid-single-edits-v1";
const PERTURBATION_ENUMERATIONS = new Set([
  DEFAULT_PERTURBATION_ENUMERATION,
  "sampled-valid-single-edits-v1"
]);
const PERTURBATION_EMPTY_POLICIES = new Set([
  "indeterminate",
  "vacuous-pass"
]);
const PERTURBATION_DIRECTIONS = new Set(["decrease", "increase"]);

export const DEFAULT_KERNEL_VERSION = "0.1.0";

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCanonical(left, right) {
  return compareStrings(canonicalize(left), canonicalize(right));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, code, path, message, details) {
  issues.push(validationIssue(code, path, message, details));
}

function requireObject(value, path, issues) {
  if (!isObject(value)) {
    addIssue(issues, "PACKAGE_TYPE_INVALID", path, "Expected an object.", { actual: typeof value });
    return false;
  }
  return true;
}

function requireArray(value, path, issues) {
  if (!Array.isArray(value)) {
    addIssue(issues, "PACKAGE_TYPE_INVALID", path, "Expected an array.", { actual: typeof value });
    return false;
  }
  return true;
}

function requireString(value, path, issues) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, "PACKAGE_STRING_INVALID", path, "Expected a non-empty string.", { value });
    return false;
  }
  return true;
}

function requireIdentifier(value, path, issues) {
  if (!requireString(value, path, issues)) return false;
  if (value !== value.trim()) {
    addIssue(issues, "PACKAGE_IDENTIFIER_NOT_NORMALIZED", path, "Identifier cannot contain leading or trailing whitespace.", {
      value
    });
    return false;
  }
  return true;
}

function rejectUnknownFields(value, allowed, path, issues) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(issues, "PACKAGE_FIELD_UNKNOWN", `${path}.${key}`, "Unknown package field.", { key });
    }
  }
}

function requireFields(value, fields, path, issues) {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      addIssue(issues, "PACKAGE_FIELD_REQUIRED", `${path}.${field}`, "Required field is missing.", {
        field
      });
    }
  }
}

function validateStringArray(value, path, issues, { nonempty = false } = {}) {
  if (!requireArray(value, path, issues)) return;
  if (nonempty && value.length === 0) {
    addIssue(issues, "PACKAGE_ARRAY_EMPTY", path, "Array must contain at least one item.");
  }
  const seen = new Set();
  value.forEach((item, index) => {
    if (requireIdentifier(item, `${path}[${index}]`, issues)) {
      if (seen.has(item)) {
        addIssue(issues, "PACKAGE_DUPLICATE_VALUE", `${path}[${index}]`, "Duplicate array value.", {
          value: item
        });
      }
      seen.add(item);
    }
  });
}

function requirePerturbationIdentifier(value, path, issues) {
  if (!requireIdentifier(value, path, issues)) return false;
  if (value.length > 1_024 || /[\r\n]/.test(value)) {
    addIssue(
      issues,
      "PACKAGE_PERTURBATION_IDENTIFIER_INVALID",
      path,
      "Perturbation identifiers must not contain line breaks or exceed 1,024 characters.",
      { length: value.length, maximum: 1_024 }
    );
    return false;
  }
  return true;
}

function validatePerturbation(entry, path, issues) {
  if (typeof entry === "string") {
    requirePerturbationIdentifier(entry, path, issues);
    return;
  }
  if (!requireObject(entry, path, issues)) return;
  requireFields(entry, ["id", "kind"], path, issues);
  requirePerturbationIdentifier(entry.id, `${path}.id`, issues);
  if (
    typeof entry.kind !== "string" ||
    !Object.prototype.hasOwnProperty.call(PERTURBATION_FIELDS, entry.kind)
  ) {
    addIssue(
      issues,
      "PACKAGE_PERTURBATION_KIND_INVALID",
      `${path}.kind`,
      "Perturbation kind is not one of the executable finite single-edit classes.",
      { kind: entry.kind }
    );
    return;
  }
  rejectUnknownFields(entry, PERTURBATION_FIELDS[entry.kind], path, issues);
  if (
    entry.enumeration !== undefined &&
    !PERTURBATION_ENUMERATIONS.has(entry.enumeration)
  ) {
    addIssue(
      issues,
      "PACKAGE_PERTURBATION_ENUMERATION_INVALID",
      `${path}.enumeration`,
      "Perturbation enumeration must use a supported finite single-edit contract.",
      { enumeration: entry.enumeration }
    );
  }
  if (
    entry.emptyPolicy !== undefined &&
    !PERTURBATION_EMPTY_POLICIES.has(entry.emptyPolicy)
  ) {
    addIssue(
      issues,
      "PACKAGE_PERTURBATION_EMPTY_POLICY_INVALID",
      `${path}.emptyPolicy`,
      "Perturbation emptyPolicy must be indeterminate or vacuous-pass.",
      { emptyPolicy: entry.emptyPolicy }
    );
  }
  if (entry.kind === "edge-deletion") {
    if (entry.roles !== undefined) {
      validateStringArray(entry.roles, `${path}.roles`, issues, { nonempty: true });
      if (Array.isArray(entry.roles)) {
        entry.roles.forEach((role, index) => {
          if (typeof role === "string") {
            requirePerturbationIdentifier(
              role,
              `${path}.roles[${index}]`,
              issues
            );
          }
        });
      }
      if (Array.isArray(entry.roles) && entry.roles.length > 256) {
        addIssue(
          issues,
          "PACKAGE_PERTURBATION_LIMIT_EXCEEDED",
          `${path}.roles`,
          "Perturbation role filters cannot exceed 256 entries.",
          { maximum: 256, actual: entry.roles.length }
        );
      }
    }
    return;
  }
  if (entry.kind === "node-deletion") return;
  if (entry.kind === "edge-role-replacement") {
    if (!requireArray(entry.replacements, `${path}.replacements`, issues)) return;
    if (entry.replacements.length === 0) {
      addIssue(
        issues,
        "PACKAGE_ARRAY_EMPTY",
        `${path}.replacements`,
        "Role-replacement perturbations require at least one replacement."
      );
    }
    if (entry.replacements.length > 256) {
      addIssue(
        issues,
        "PACKAGE_PERTURBATION_LIMIT_EXCEEDED",
        `${path}.replacements`,
        "Role-replacement perturbations cannot exceed 256 replacements.",
        { maximum: 256, actual: entry.replacements.length }
      );
    }
    const seen = new Set();
    entry.replacements.forEach((replacement, index) => {
      const replacementPath = `${path}.replacements[${index}]`;
      if (!requireObject(replacement, replacementPath, issues)) return;
      rejectUnknownFields(replacement, new Set(["from", "to"]), replacementPath, issues);
      requireFields(replacement, ["from", "to"], replacementPath, issues);
      const validFrom = requirePerturbationIdentifier(
        replacement.from,
        `${replacementPath}.from`,
        issues
      );
      const validTo = requirePerturbationIdentifier(
        replacement.to,
        `${replacementPath}.to`,
        issues
      );
      if (!validFrom || !validTo) return;
      if (replacement.from === replacement.to) {
        addIssue(
          issues,
          "PACKAGE_PERTURBATION_ROLE_REPLACEMENT_NOOP",
          replacementPath,
          "Role replacement must change the edge role.",
          { role: replacement.from }
        );
      }
      const key = canonicalize(replacement);
      if (seen.has(key)) {
        addIssue(
          issues,
          "PACKAGE_DUPLICATE_VALUE",
          replacementPath,
          "Duplicate role replacement.",
          { replacement }
        );
      }
      seen.add(key);
    });
    return;
  }
  if (!new Set(["nodes", "edges"]).has(entry.target)) {
    addIssue(
      issues,
      "PACKAGE_PERTURBATION_TARGET_INVALID",
      `${path}.target`,
      "Numeric displacement target must be nodes or edges.",
      { target: entry.target }
    );
  }
  requirePerturbationIdentifier(entry.attribute, `${path}.attribute`, issues);
  if (
    typeof entry.epsilon !== "number" ||
    !Number.isFinite(entry.epsilon) ||
    entry.epsilon <= 0
  ) {
    addIssue(
      issues,
      "PACKAGE_PERTURBATION_EPSILON_INVALID",
      `${path}.epsilon`,
      "Numeric displacement epsilon must be finite and strictly positive.",
      { epsilon: entry.epsilon }
    );
  }
  if (entry.directions !== undefined) {
    if (!requireArray(entry.directions, `${path}.directions`, issues)) return;
    if (entry.directions.length === 0) {
      addIssue(
        issues,
        "PACKAGE_ARRAY_EMPTY",
        `${path}.directions`,
        "Numeric displacement directions cannot be empty."
      );
    }
    const seen = new Set();
    entry.directions.forEach((direction, index) => {
      if (!PERTURBATION_DIRECTIONS.has(direction)) {
        addIssue(
          issues,
          "PACKAGE_PERTURBATION_DIRECTION_INVALID",
          `${path}.directions[${index}]`,
          "Numeric displacement direction must be decrease or increase.",
          { direction }
        );
      } else if (seen.has(direction)) {
        addIssue(
          issues,
          "PACKAGE_DUPLICATE_VALUE",
          `${path}.directions[${index}]`,
          "Duplicate numeric displacement direction.",
          { direction }
        );
      }
      seen.add(direction);
    });
  }
}

function validateArtifact(artifact, path, issues) {
  if (!requireObject(artifact, path, issues)) return;
  rejectUnknownFields(artifact, ARTIFACT_FIELDS, path, issues);
  requireFields(artifact, ARTIFACT_FIELDS, path, issues);
  if (requireString(artifact.path, `${path}.path`, issues)) {
    const segments = artifact.path.split(/[\\/]/);
    if (
      artifact.path.startsWith("/") ||
      /^[A-Za-z]:/.test(artifact.path) ||
      segments.includes("..") ||
      segments.includes(".") ||
      segments.includes("")
    ) {
      addIssue(issues, "ARTIFACT_PATH_INVALID", `${path}.path`, "Artifact path must be relative and normalized.", {
        value: artifact.path
      });
    }
  }
  requireString(artifact.mediaType, `${path}.mediaType`, issues);
  requireString(artifact.schemaVersion, `${path}.schemaVersion`, issues);
  if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0) {
    addIssue(issues, "ARTIFACT_SIZE_INVALID", `${path}.bytes`, "Artifact byte length must be a non-negative safe integer.", {
      value: artifact.bytes
    });
  }
  if (!isContentHash(artifact.hash)) {
    addIssue(issues, "ARTIFACT_HASH_INVALID", `${path}.hash`, "Artifact hash must be a lowercase sha256 identifier.", {
      value: artifact.hash
    });
  }
}

function validateEvidence(evidence, path, issues) {
  if (!requireObject(evidence, path, issues)) return;
  rejectUnknownFields(evidence, EVIDENCE_FIELDS, path, issues);
  requireFields(evidence, ["id", "state", "source"], path, issues);
  requireIdentifier(evidence.id, `${path}.id`, issues);
  if (!EVIDENCE_STATES.has(evidence.state)) {
    addIssue(issues, "EVIDENCE_STATE_INVALID", `${path}.state`, "Unknown evidence state.", {
      value: evidence.state
    });
  }
  validateArtifact(evidence.source, `${path}.source`, issues);
  if (evidence.locator !== undefined && requireObject(evidence.locator, `${path}.locator`, issues)) {
    rejectUnknownFields(evidence.locator, new Set(["page", "equation", "fragment"]), `${path}.locator`, issues);
    for (const field of ["page", "equation"]) {
      if (evidence.locator[field] !== undefined && (!Number.isSafeInteger(evidence.locator[field]) || evidence.locator[field] < 1)) {
        addIssue(issues, "EVIDENCE_LOCATOR_INVALID", `${path}.locator.${field}`, "Evidence page/equation locator must be a positive safe integer.");
      }
    }
    if (evidence.locator.fragment !== undefined && typeof evidence.locator.fragment !== "string") {
      addIssue(issues, "EVIDENCE_LOCATOR_INVALID", `${path}.locator.fragment`, "Evidence fragment locator must be a string.");
    }
  }
  if (evidence.method !== undefined) {
    if (requireObject(evidence.method, `${path}.method`, issues)) {
      rejectUnknownFields(evidence.method, new Set(["id", "version", "inputHash"]), `${path}.method`, issues);
      requireFields(evidence.method, ["id", "version", "inputHash"], `${path}.method`, issues);
      requireIdentifier(evidence.method.id, `${path}.method.id`, issues);
      requireString(evidence.method.version, `${path}.method.version`, issues);
      if (!isContentHash(evidence.method.inputHash)) {
        addIssue(issues, "EVIDENCE_METHOD_HASH_INVALID", `${path}.method.inputHash`, "Method input hash is invalid.");
      }
    }
  }
}

function validateClaim(claim, path, issues) {
  if (!requireObject(claim, path, issues)) return;
  rejectUnknownFields(claim, CLAIM_FIELDS, path, issues);
  requireFields(claim, ["id", "statement", "state", "evidence"], path, issues);
  requireIdentifier(claim.id, `${path}.id`, issues);
  requireString(claim.statement, `${path}.statement`, issues);
  if (!EVIDENCE_STATES.has(claim.state)) {
    addIssue(issues, "EVIDENCE_STATE_INVALID", `${path}.state`, "Unknown claim evidence state.", {
      value: claim.state
    });
  }
  validateStringArray(claim.evidence, `${path}.evidence`, issues);
}

function validateTolerance(tolerance, path, issues) {
  if (!requireObject(tolerance, path, issues)) return;
  rejectUnknownFields(tolerance, TOLERANCE_FIELDS, path, issues);
  const present = ["absolute", "relative"].filter((field) => tolerance[field] !== undefined);
  if (present.length === 0) {
    addIssue(issues, "QUANTITY_TOLERANCE_MISSING", path, "Tolerance needs an absolute or relative bound.");
  }
  for (const field of present) {
    if (!Number.isFinite(tolerance[field]) || tolerance[field] < 0) {
      addIssue(issues, "QUANTITY_TOLERANCE_INVALID", `${path}.${field}`, "Tolerance must be finite and non-negative.", {
        value: tolerance[field]
      });
    }
  }
}

function validateUnit(unit, path, issues) {
  if (!requireIdentifier(unit, path, issues)) return null;
  try {
    return parseUnitExpression(unit);
  } catch (error) {
    if (!(error instanceof KernelError) || error.stage !== "QUANTITY") throw error;
    addIssue(issues, error.code, path, error.message, error.details);
    return null;
  }
}

function unitsCompatible(left, right) {
  try {
    return areUnitsCompatible(left, right);
  } catch (error) {
    if (!(error instanceof KernelError) || error.stage !== "QUANTITY") throw error;
    return null;
  }
}

function validateQuantity(quantity, path, issues) {
  const initialIssueCount = issues.length;
  if (!requireObject(quantity, path, issues)) return;
  rejectUnknownFields(quantity, QUANTITY_FIELDS, path, issues);
  requireFields(quantity, QUANTITY_FIELDS, path, issues);
  if (!Number.isFinite(quantity.value)) {
    addIssue(issues, "QUANTITY_VALUE_INVALID", `${path}.value`, "Quantity value must be finite.", {
      value: quantity.value
    });
  }
  validateUnit(quantity.unit, `${path}.unit`, issues);
  requireIdentifier(quantity.semantic, `${path}.semantic`, issues);
  validateTolerance(quantity.tolerance, `${path}.tolerance`, issues);
  if (requireObject(quantity.provenance, `${path}.provenance`, issues)) {
    const provenanceFields = {
      declared: new Set(["kind", "evidence"]),
      computed: new Set(["kind", "method", "evidence"]),
      oracle: new Set(["kind", "source", "method", "evidence"])
    };
    if (!new Set(["declared", "computed", "oracle"]).has(quantity.provenance.kind)) {
      addIssue(issues, "QUANTITY_PROVENANCE_INVALID", `${path}.provenance.kind`, "Unknown quantity provenance kind.", {
        value: quantity.provenance.kind
      });
    } else {
      rejectUnknownFields(quantity.provenance, provenanceFields[quantity.provenance.kind], `${path}.provenance`, issues);
    }
    validateStringArray(quantity.provenance.evidence, `${path}.provenance.evidence`, issues);
    if (quantity.provenance.kind === "computed") {
      requireIdentifier(quantity.provenance.method, `${path}.provenance.method`, issues);
    }
    if (quantity.provenance.kind === "oracle") {
      requireIdentifier(quantity.provenance.method, `${path}.provenance.method`, issues);
      if (!isContentHash(quantity.provenance.source)) {
        addIssue(issues, "QUANTITY_PROVENANCE_SOURCE_INVALID", `${path}.provenance.source`, "Oracle source hash is invalid.");
      }
    }
  }
  if (issues.length === initialIssueCount) {
    try {
      normalizeRuntimeQuantity(quantity);
    } catch (error) {
      if (!(error instanceof KernelError) || error.stage !== "QUANTITY") throw error;
      addIssue(issues, error.code, path, error.message, error.details);
    }
  }
}

function validateProfile(profile, path, issues) {
  if (!requireObject(profile, path, issues)) return;
  rejectUnknownFields(profile, PROFILE_FIELDS, path, issues);
  requireFields(profile, ["slots", "invariantVector", "precisionPolicy"], path, issues);
  requireIdentifier(profile.precisionPolicy, `${path}.precisionPolicy`, issues);
  if (requireArray(profile.slots, `${path}.slots`, issues)) {
    profile.slots.forEach((slot, index) => {
      const slotPath = `${path}.slots[${index}]`;
      if (!requireObject(slot, slotPath, issues)) return;
      rejectUnknownFields(slot, SLOT_FIELDS, slotPath, issues);
      requireFields(slot, ["role", "polarity", "capacity"], slotPath, issues);
      requireIdentifier(slot.role, `${slotPath}.role`, issues);
      if (!new Set(["in", "out", "sym"]).has(slot.polarity)) {
        addIssue(issues, "PACKAGE_PROFILE_POLARITY_INVALID", `${slotPath}.polarity`, "Unknown slot polarity.");
      }
      if (requireObject(slot.capacity, `${slotPath}.capacity`, issues)) {
        rejectUnknownFields(slot.capacity, new Set(["min", "max"]), `${slotPath}.capacity`, issues);
        requireFields(slot.capacity, ["min", "max"], `${slotPath}.capacity`, issues);
        const { min, max } = slot.capacity;
        if (!Number.isSafeInteger(min) || min < 0) {
          addIssue(issues, "PACKAGE_PROFILE_CAPACITY_INVALID", `${slotPath}.capacity.min`, "Minimum capacity must be a non-negative safe integer.");
        }
        if (max !== null && (!Number.isSafeInteger(max) || max < min)) {
          addIssue(issues, "PACKAGE_PROFILE_CAPACITY_INVALID", `${slotPath}.capacity.max`, "Maximum capacity must be null or an integer not below min.");
        }
      }
      if (slot.guard !== undefined) {
        try {
          normalizeProfileSlotGuard(slot.guard);
        } catch (error) {
          if (!(error instanceof KernelError) || error.stage !== "PROFILE_GUARD") {
            throw error;
          }
          addIssue(
            issues,
            error.code,
            `${slotPath}.guard`,
            error.message,
            error.details
          );
        }
      }
    });
  }
  if (requireArray(profile.invariantVector, `${path}.invariantVector`, issues)) {
    const semantics = new Set();
    profile.invariantVector.forEach((entry, index) => {
      const entryPath = `${path}.invariantVector[${index}]`;
      if (!requireObject(entry, entryPath, issues)) return;
      rejectUnknownFields(entry, PROFILE_INVARIANT_FIELDS, entryPath, issues);
      requireFields(entry, PROFILE_INVARIANT_FIELDS, entryPath, issues);
      requireIdentifier(entry.semantic, `${entryPath}.semantic`, issues);
      if (semantics.has(entry.semantic)) {
        addIssue(issues, "PACKAGE_PROFILE_INVARIANT_DUPLICATE", `${entryPath}.semantic`, "Profile invariant semantic must be unique.", {
          semantic: entry.semantic
        });
      }
      semantics.add(entry.semantic);
      validateQuantity(entry.normalized, `${entryPath}.normalized`, issues);
      validateQuantity(entry.quantization, `${entryPath}.quantization`, issues);
      if (isObject(entry.quantization) && Number.isFinite(entry.quantization.value) && entry.quantization.value <= 0) {
        addIssue(issues, "PACKAGE_PROFILE_QUANTIZATION_INVALID", `${entryPath}.quantization.value`, "Profile quantization must be positive.");
      }
      if (
        isObject(entry.normalized) &&
        isObject(entry.quantization) &&
        unitsCompatible(entry.normalized.unit, entry.quantization.unit) === false
      ) {
        addIssue(issues, "QUANTITY_UNIT_INCOMPATIBLE", entryPath, "Normalized invariant and quantization must use compatible units.", {
          normalizedUnit: entry.normalized.unit,
          quantizationUnit: entry.quantization.unit
        });
      }
    });
  }
  if (profile.hash !== undefined && !isContentHash(profile.hash)) {
    addIssue(issues, "PACKAGE_PROFILE_HASH_INVALID", `${path}.hash`, "Profile hash is invalid.");
  }
}

function validateCoordinate(coordinate, path, issues) {
  if (!requireObject(coordinate, path, issues)) return;
  rejectUnknownFields(coordinate, new Set(["level", "phase", "segment"]), path, issues);
  requireFields(coordinate, ["level"], path, issues);
  if (!Number.isSafeInteger(coordinate.level) || coordinate.level < 0) {
    addIssue(issues, "ONTOLOGY_COORDINATE_LEVEL_INVALID", `${path}.level`, "Ontology level must be a non-negative safe integer.");
  }
  if (coordinate.phase !== undefined && (typeof coordinate.phase !== "string" || !ONTOLOGY_PHASE.test(coordinate.phase))) {
    addIssue(issues, "ONTOLOGY_COORDINATE_PHASE_INVALID", `${path}.phase`, "Ontology phase is invalid.", {
      value: coordinate.phase
    });
  }
  if (coordinate.segment !== undefined) requireIdentifier(coordinate.segment, `${path}.segment`, issues);
}

function validateAxisProvenance(provenance, path, issues) {
  if (!requireObject(provenance, path, issues)) return;
  const allowed = new Set(["ontologyLevel", "ontologyPhase", "catalogueLevel", "cataloguePhase"]);
  rejectUnknownFields(provenance, allowed, path, issues);
  const expected = {
    ontologyLevel: new Set(["declared", "computed"]),
    ontologyPhase: new Set(["declared"]),
    catalogueLevel: new Set(["declared"]),
    cataloguePhase: new Set(["declared"])
  };
  for (const [field, values] of Object.entries(expected)) {
    if (provenance[field] !== undefined && !values.has(provenance[field])) {
      addIssue(issues, "ONTOLOGY_COORDINATE_PROVENANCE_INVALID", `${path}.${field}`, "Invalid axis provenance value.");
    }
  }
}

function validateCluster(cluster, path, issues) {
  if (!requireObject(cluster, path, issues)) return;
  rejectUnknownFields(cluster, CLUSTER_FIELDS, path, issues);
  requireFields(cluster, CLUSTER_FIELDS, path, issues);
  if (!CLUSTER_DISPOSITIONS.has(cluster.disposition)) {
    addIssue(issues, "SOURCE_RESOLUTION_DISPOSITION_INVALID", `${path}.disposition`, "Unknown cluster disposition.");
  }
  validateStringArray(cluster.members, `${path}.members`, issues, { nonempty: true });
  if (Array.isArray(cluster.members) && cluster.members.length < 2) {
    addIssue(issues, "SOURCE_RESOLUTION_CLUSTER_TOO_SMALL", `${path}.members`, "A condensed cluster needs at least two members.");
  }
  validateStringArray(cluster.internalRelations, `${path}.internalRelations`, issues);
  if (cluster.internalOrder !== "undefined") {
    addIssue(issues, "SOURCE_RESOLUTION_INTERNAL_ORDER_INVALID", `${path}.internalOrder`, "Cluster internal order must be undefined.");
  }
  if (!isContentHash(cluster.classificationPolicyHash)) {
    addIssue(issues, "SOURCE_CLASSIFICATION_POLICY_HASH_INVALID", `${path}.classificationPolicyHash`, "Classification policy hash is invalid.");
  }
  validateArtifact(cluster.classificationArtifact, `${path}.classificationArtifact`, issues);
  validateArtifact(cluster.nodeResolutionArtifact, `${path}.nodeResolutionArtifact`, issues);
  validateArtifact(cluster.condensationArtifact, `${path}.condensationArtifact`, issues);
}

function validateSourceMigration(sourceMigration, sourceArtifacts, primitives, issues) {
  const path = "$.sourceMigration";
  if (!requireObject(sourceMigration, path, issues)) return;
  rejectUnknownFields(sourceMigration, SOURCE_MIGRATION_FIELDS, path, issues);
  requireFields(
    sourceMigration,
    [...SOURCE_MIGRATION_FIELDS].filter((field) => field !== "concentration"),
    path,
    issues
  );
  if (!isContentHash(sourceMigration.policyHash)) {
    addIssue(
      issues,
      "SOURCE_MIGRATION_POLICY_HASH_INVALID",
      `${path}.policyHash`,
      "Source migration policyHash must be a content hash."
    );
  }
  if (!MIGRATION_BLINDNESS_STATUSES.has(sourceMigration.blindnessStatus)) {
    addIssue(
      issues,
      "SOURCE_MIGRATION_BLINDNESS_STATUS_INVALID",
      `${path}.blindnessStatus`,
      "Source migration blindnessStatus is invalid."
    );
  }

  const artifactEntries = [];
  for (const field of SOURCE_MIGRATION_ARTIFACT_FIELDS) {
    validateArtifact(sourceMigration[field], `${path}.${field}`, issues);
    if (isObject(sourceMigration[field])) {
      artifactEntries.push({ field, artifact: sourceMigration[field] });
    }
  }
  if (sourceMigration.concentration !== undefined) {
    validateArtifact(sourceMigration.concentration, `${path}.concentration`, issues);
    if (isObject(sourceMigration.concentration)) {
      artifactEntries.push({ field: "concentration", artifact: sourceMigration.concentration });
    }
  }
  if (requireArray(sourceMigration.typedRelationLayers, `${path}.typedRelationLayers`, issues)) {
    if (sourceMigration.typedRelationLayers.length !== 6) {
      addIssue(
        issues,
        "SOURCE_MIGRATION_TYPED_LAYERS_INCOMPLETE",
        `${path}.typedRelationLayers`,
        "Source migration must bind exactly six typed relation-layer artifacts.",
        { expected: 6, actual: sourceMigration.typedRelationLayers.length }
      );
    }
    sourceMigration.typedRelationLayers.forEach((artifact, index) => {
      validateArtifact(artifact, `${path}.typedRelationLayers[${index}]`, issues);
      if (isObject(artifact)) {
        artifactEntries.push({ field: `typedRelationLayers[${index}]`, artifact });
      }
    });
  }

  const migrationHashes = new Set();
  artifactEntries.forEach(({ field, artifact }) => {
    if (!isContentHash(artifact.hash)) return;
    if (migrationHashes.has(artifact.hash)) {
      addIssue(
        issues,
        "SOURCE_MIGRATION_ARTIFACT_DUPLICATE",
        `${path}.${field}.hash`,
        "Each source-migration role must bind a distinct artifact hash.",
        { hash: artifact.hash }
      );
    }
    migrationHashes.add(artifact.hash);
    const bound = Array.isArray(sourceArtifacts)
      ? sourceArtifacts.find((entry) => isObject(entry) && entry.hash === artifact.hash)
      : undefined;
    if (bound === undefined) {
      addIssue(
        issues,
        "SOURCE_MIGRATION_ARTIFACT_UNBOUND",
        `${path}.${field}`,
        "Every source-migration artifact must occur in sourceArtifacts.",
        { hash: artifact.hash }
      );
    } else if (canonicalize(bound) !== canonicalize(artifact)) {
      addIssue(
        issues,
        "SOURCE_MIGRATION_ARTIFACT_REFERENCE_MISMATCH",
        `${path}.${field}`,
        "The source-migration artifact reference must exactly match sourceArtifacts.",
        { hash: artifact.hash }
      );
    }
  });

  const clusterMembers = new Map();
  if (Array.isArray(primitives)) {
    primitives.forEach((primitive, index) => {
      if (!isObject(primitive) || primitive.kind !== "condensed-cluster" || !isObject(primitive.cluster)) {
        return;
      }
      const clusterPath = `$.primitives[${index}].cluster`;
      const expected = [
        ["classificationPolicyHash", sourceMigration.policyHash],
        ["classificationArtifact", sourceMigration.classifiedRelations?.hash],
        ["nodeResolutionArtifact", sourceMigration.nodeResolutions?.hash],
        ["condensationArtifact", sourceMigration.condensation?.hash]
      ];
      expected.forEach(([field, expectedValue]) => {
        const actual = field === "classificationPolicyHash"
          ? primitive.cluster[field]
          : primitive.cluster[field]?.hash;
        if (actual !== expectedValue) {
          addIssue(
            issues,
            "SOURCE_MIGRATION_CLUSTER_PROVENANCE_MISMATCH",
            `${clusterPath}.${field}`,
            "Condensed-cluster provenance must match the bound source migration.",
            { field, expected: expectedValue ?? null, actual: actual ?? null }
          );
        }
      });
      if (Array.isArray(primitive.cluster.members)) {
        primitive.cluster.members.forEach((member) => {
          if (clusterMembers.has(member)) {
            addIssue(
              issues,
              "SOURCE_MIGRATION_CLUSTER_MEMBER_DUPLICATE",
              `${clusterPath}.members`,
              "A source member cannot belong to more than one condensed-cluster primitive.",
              {
                member,
                firstPrimitive: clusterMembers.get(member),
                secondPrimitive: primitive.sourceId ?? null
              }
            );
          } else {
            clusterMembers.set(member, primitive.sourceId ?? null);
          }
        });
      }
    });
  }
}

function validatePrimitive(primitive, path, issues) {
  if (!requireObject(primitive, path, issues)) return;
  rejectUnknownFields(primitive, PRIMITIVE_FIELDS, path, issues);
  requireFields(primitive, ["sourceId", "kind", "typeTags", "invariants", "claimRefs"], path, issues);
  requireIdentifier(primitive.sourceId, `${path}.sourceId`, issues);
  if (!new Set(["primitive", "condensed-cluster"]).has(primitive.kind)) {
    addIssue(issues, "PACKAGE_PRIMITIVE_KIND_INVALID", `${path}.kind`, "Unknown primitive definition kind.");
  }
  if (primitive.kind === "condensed-cluster") {
    validateCluster(primitive.cluster, `${path}.cluster`, issues);
  }
  if (primitive.kind === "primitive" && primitive.cluster !== undefined) {
    addIssue(issues, "SOURCE_RESOLUTION_CLUSTER_FORBIDDEN", `${path}.cluster`, "Ordinary primitives cannot carry cluster provenance.");
  }
  if (primitive.ontologyCoordinate !== undefined) validateCoordinate(primitive.ontologyCoordinate, `${path}.ontologyCoordinate`, issues);
  if (primitive.axisProvenance !== undefined) validateAxisProvenance(primitive.axisProvenance, `${path}.axisProvenance`, issues);
  if (isObject(primitive.ontologyCoordinate)) {
    if (!isObject(primitive.axisProvenance)) {
      addIssue(issues, "ONTOLOGY_COORDINATE_PROVENANCE_MISSING", `${path}.axisProvenance`, "Ontology coordinates require explicit axis provenance.");
    } else {
      if (primitive.axisProvenance.ontologyLevel === undefined) {
        addIssue(issues, "ONTOLOGY_COORDINATE_PROVENANCE_MISSING", `${path}.axisProvenance.ontologyLevel`, "Ontology level provenance is required.");
      }
      if (primitive.ontologyCoordinate.phase !== undefined && primitive.axisProvenance.ontologyPhase === undefined) {
        addIssue(issues, "ONTOLOGY_COORDINATE_PROVENANCE_MISSING", `${path}.axisProvenance.ontologyPhase`, "Ontology phase provenance is required.");
      }
    }
  }
  validateStringArray(primitive.typeTags, `${path}.typeTags`, issues);
  validateStringArray(primitive.claimRefs, `${path}.claimRefs`, issues);
  if (requireObject(primitive.invariants, `${path}.invariants`, issues)) {
    for (const [name, value] of Object.entries(primitive.invariants)) {
      requireIdentifier(name, `${path}.invariants.${name}`, issues);
      validateInvariantValue(value, `${path}.invariants.${name}`, issues);
    }
  }
  if (primitive.profile === undefined) {
    addIssue(issues, "PACKAGE_PROFILE_REQUIRED", `${path}.profile`, "The current loader requires an explicit primitive profile.");
  } else {
    validateProfile(primitive.profile, `${path}.profile`, issues);
  }
}

function validateInvariantValue(value, path, issues) {
  if (isObject(value)) {
    validateQuantity(value, path, issues);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      addIssue(
        issues,
        "PACKAGE_INVARIANT_NUMBER_INVALID",
        path,
        "A numeric invariant value must be finite.",
        { value }
      );
    }
    return;
  }
  if (typeof value === "string") {
    if (value.length > INVARIANT_STRING_MAX_LENGTH) {
      addIssue(
        issues,
        "PACKAGE_INVARIANT_STRING_LIMIT",
        path,
        "A string invariant value exceeds the kernel length limit.",
        { actualLength: value.length, maximumLength: INVARIANT_STRING_MAX_LENGTH }
      );
    }
    return;
  }
  if (typeof value === "boolean" || value === null) return;
  addIssue(
    issues,
    "PACKAGE_INVARIANT_VALUE_INVALID",
    path,
    "An invariant value must be a Quantity or JSON scalar.",
    { actualKind: Array.isArray(value) ? "array" : typeof value }
  );
}

function validateCandidateAttributes(attributes, primitives, path, issues) {
  if (!requireArray(attributes, path, issues)) return;
  if (attributes.length > 256) {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_ATTRIBUTE_LIMIT",
      path,
      "Candidate-attribute definitions exceed the supported limit.",
      { actual: attributes.length, maximum: 256 }
    );
  }
  const names = new Set();
  attributes.forEach((definition, index) => {
    const definitionPath = `${path}[${index}]`;
    if (!requireObject(definition, definitionPath, issues)) return;
    rejectUnknownFields(
      definition,
      CANDIDATE_ATTRIBUTE_FIELDS,
      definitionPath,
      issues
    );
    requireFields(
      definition,
      CANDIDATE_ATTRIBUTE_FIELDS,
      definitionPath,
      issues
    );
    if (requireIdentifier(definition.name, `${definitionPath}.name`, issues)) {
      if (names.has(definition.name)) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_DUPLICATE",
          `${definitionPath}.name`,
          "Candidate-attribute names must be globally unique.",
          { name: definition.name }
        );
      }
      names.add(definition.name);
    }
    if (!new Set(["nodes", "edges"]).has(definition.target)) {
      addIssue(
        issues,
        "PACKAGE_CANDIDATE_ATTRIBUTE_TARGET_INVALID",
        `${definitionPath}.target`,
        "Candidate attribute target must be nodes or edges."
      );
    }
    const sourcePath = `${definitionPath}.source`;
    if (!requireObject(definition.source, sourcePath, issues)) return;
    const sourceFields = CANDIDATE_ATTRIBUTE_SOURCE_FIELDS[
      definition.source.kind
    ];
    if (sourceFields === undefined) {
      addIssue(
        issues,
        "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_INVALID",
        `${sourcePath}.kind`,
        "Candidate attribute uses an unsupported derivation source."
      );
      return;
    }
    rejectUnknownFields(definition.source, sourceFields, sourcePath, issues);
    requireFields(definition.source, sourceFields, sourcePath, issues);
    if (ROLE_CANDIDATE_ATTRIBUTE_SOURCES.has(definition.source.kind)) {
      if (definition.target !== "edges") {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TARGET_INVALID",
          sourcePath,
          "Role-dependent candidate attributes can target edges only."
        );
      }
      if (!requireObject(definition.source.values, `${sourcePath}.values`, issues)) {
        return;
      }
      const entries = Object.entries(definition.source.values);
      if (entries.length === 0) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_MAP_EMPTY",
          `${sourcePath}.values`,
          "A role-dependent candidate attribute must define at least one role."
        );
      }
      if (entries.length > 256) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_MAP_LIMIT",
          `${sourcePath}.values`,
          "A role-dependent candidate attribute exceeds the supported role limit.",
          { actual: entries.length, maximum: 256 }
        );
      }
      let firstKind;
      let firstQuantity;
      for (const [role, value] of entries) {
        const valuePath = `${sourcePath}.values.${role}`;
        requireIdentifier(role, valuePath, issues);
        validateInvariantValue(value, valuePath, issues);
        const valueKind = invariantValueKind(value);
        const quantitySource = definition.source.kind ===
          "edge-role-quantity-v1";
        if ((quantitySource && valueKind !== "quantity") ||
            (!quantitySource && valueKind === "quantity")) {
          addIssue(
            issues,
            "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH",
            valuePath,
            quantitySource
              ? "A role-dependent Quantity attribute requires Quantity values."
              : "A role-dependent scalar attribute requires JSON scalar values.",
            { attribute: definition.name, role }
          );
          continue;
        }
        if (!quantitySource) {
          if (firstKind !== undefined && valueKind !== firstKind) {
            addIssue(
              issues,
              "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_VALUE_CONFLICT",
              valuePath,
              "Every role-dependent scalar value must have the same JSON scalar type.",
              { attribute: definition.name, role, expectedKind: firstKind, actualKind: valueKind }
            );
          }
          firstKind ??= valueKind;
          continue;
        }
        let normalizedQuantity;
        try {
          normalizedQuantity = normalizeRuntimeQuantity(value);
        } catch {
          continue;
        }
        if (firstQuantity !== undefined && (
          normalizedQuantity.unit !== firstQuantity.unit ||
          normalizedQuantity.semantic !== firstQuantity.semantic
        )) {
          addIssue(
            issues,
            "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_VALUE_CONFLICT",
            valuePath,
            "Every role-dependent Quantity value must have compatible units and one semantic.",
            {
              attribute: definition.name,
              role,
              expectedUnit: firstQuantity.unit,
              actualUnit: normalizedQuantity.unit,
              expectedSemantic: firstQuantity.semantic,
              actualSemantic: normalizedQuantity.semantic
            }
          );
        }
        firstQuantity ??= normalizedQuantity;
      }
      return;
    }
    if (CONSTANT_CANDIDATE_ATTRIBUTE_SOURCES.has(definition.source.kind)) {
      validateInvariantValue(definition.source.value, `${sourcePath}.value`, issues);
      const quantity = isObject(definition.source.value);
      if (definition.source.kind === "constant-scalar-v1" && quantity) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH",
          `${sourcePath}.value`,
          "A constant scalar candidate attribute requires a JSON scalar value."
        );
      }
      if (definition.source.kind === "constant-quantity-v1" && !quantity) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH",
          `${sourcePath}.value`,
          "A constant Quantity candidate attribute requires a Quantity value."
        );
      }
      return;
    }
    requireIdentifier(
      definition.source.invariant,
      `${sourcePath}.invariant`,
      issues
    );
    if (definition.target !== "nodes") {
      addIssue(
        issues,
        "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TARGET_INVALID",
        sourcePath,
        "Element-invariant attributes can target nodes only."
      );
    }
    primitives.forEach((primitive, primitiveIndex) => {
      const value = isObject(primitive) && isObject(primitive.invariants)
        ? primitive.invariants[definition.source.invariant]
        : undefined;
      if (value === undefined) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_INVARIANT_MISSING",
          `$.primitives[${primitiveIndex}].invariants.${definition.source.invariant}`,
          "Every primitive must define an invariant used as a candidate attribute.",
          { attribute: definition.name }
        );
      } else if (
        definition.source.kind === "element-invariant-scalar-v1" &&
        isObject(value)
      ) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH",
          `$.primitives[${primitiveIndex}].invariants.${definition.source.invariant}`,
          "A scalar candidate attribute requires a JSON scalar invariant value.",
          { attribute: definition.name }
        );
      } else if (
        definition.source.kind === "element-invariant-quantity-v1" &&
        !isObject(value)
      ) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH",
          `$.primitives[${primitiveIndex}].invariants.${definition.source.invariant}`,
          "A Quantity candidate attribute requires a Quantity invariant value.",
          { attribute: definition.name }
        );
      }
    });
  });
}

function validatePredicate(
  predicate,
  path,
  issues,
  { allowCurrentDepthReferences = false } = {}
) {
  if (!requireObject(predicate, path, issues)) return;
  rejectUnknownFields(predicate, PREDICATE_FIELDS, path, issues);
  requireFields(predicate, PREDICATE_FIELDS, path, issues);
  requireIdentifier(predicate.id, `${path}.id`, issues);
  if (!new Set(["formation", "maintenance", "termination"]).has(predicate.phase)) {
    addIssue(issues, "PREDICATE_TYPE_PHASE_INVALID", `${path}.phase`, "Predicate phase is invalid.");
  }
  if (typeof predicate.monotoneViolation !== "boolean") {
    addIssue(issues, "PREDICATE_TYPE_MONOTONICITY_INVALID", `${path}.monotoneViolation`, "monotoneViolation must be boolean.");
  }
  if (!new Set(["below", "self"]).has(predicate.referencesDepth)) {
    addIssue(
      issues,
      "PREDICATE_TYPE_DEPTH_REFERENCE_INVALID",
      `${path}.referencesDepth`,
      "Predicate depth reference must be below or self.",
      { value: predicate.referencesDepth }
    );
  } else if (
    predicate.referencesDepth === "self" &&
    !allowCurrentDepthReferences
  ) {
    addIssue(issues, "STRATIFICATION_SELF_REFERENCE", `${path}.referencesDepth`, "Initial kernel packages may reference only lower derivation depths.", {
      value: predicate.referencesDepth
    });
  }
  if (!isObject(predicate.expr) || typeof predicate.expr.op !== "string") {
    addIssue(issues, "PREDICATE_TYPE_EXPRESSION_INVALID", `${path}.expr`, "Predicate expression must be declarative data with an op.");
  }
  validateExplanation(predicate.explain, `${path}.explain`, issues);
  validateStringArray(predicate.claimRefs, `${path}.claimRefs`, issues);
}

function validateValueExpression(expression, path, issues) {
  if (!isObject(expression)) {
    addIssue(issues, "FUNCTIONAL_EXPRESSION_INVALID", path, "Value expression must be declarative data with a kind.");
    return;
  }
  requireIdentifier(expression.kind, `${path}.kind`, issues);
}

function validateQuantitySpec(specification, path, issues) {
  const initialIssueCount = issues.length;
  if (!requireObject(specification, path, issues)) return;
  rejectUnknownFields(specification, new Set(["id", "unit", "semantic", "toleranceTarget"]), path, issues);
  requireFields(specification, ["id", "unit", "semantic", "toleranceTarget"], path, issues);
  requireIdentifier(specification.id, `${path}.id`, issues);
  validateUnit(specification.unit, `${path}.unit`, issues);
  requireIdentifier(specification.semantic, `${path}.semantic`, issues);
  validateTolerance(specification.toleranceTarget, `${path}.toleranceTarget`, issues);
  if (issues.length === initialIssueCount) {
    try {
      normalizeRuntimeQuantity({
        value: 0,
        unit: specification.unit,
        tolerance: specification.toleranceTarget,
        semantic: specification.semantic,
        provenance: { kind: "declared", evidence: [] }
      });
    } catch (error) {
      if (!(error instanceof KernelError) || error.stage !== "QUANTITY") throw error;
      addIssue(issues, error.code, path, error.message, error.details);
    }
  }
}

function validateFunctional(functional, path, issues) {
  if (!requireObject(functional, path, issues)) return;
  rejectUnknownFields(functional, FUNCTIONAL_FIELDS, path, issues);
  requireFields(functional, FUNCTIONAL_REQUIRED_FIELDS, path, issues);
  requireIdentifier(functional.id, `${path}.id`, issues);
  validateValueExpression(functional.expr, `${path}.expr`, issues);
  if (requireObject(functional.coefficients, `${path}.coefficients`, issues)) {
    for (const [name, quantity] of Object.entries(functional.coefficients)) {
      requireIdentifier(name, `${path}.coefficients`, issues);
      validateQuantity(quantity, `${path}.coefficients.${name}`, issues);
    }
  }
  validateStringArray(functional.sensitivityCoefficients, `${path}.sensitivityCoefficients`, issues);
  if (Array.isArray(functional.sensitivityCoefficients) && isObject(functional.coefficients)) {
    functional.sensitivityCoefficients.forEach((name, index) => {
      if (typeof name === "string" && !Object.prototype.hasOwnProperty.call(functional.coefficients, name)) {
        addIssue(issues, "FUNCTIONAL_SENSITIVITY_COEFFICIENT_MISSING", `${path}.sensitivityCoefficients[${index}]`, "Sensitivity coefficient is not declared by the functional.", {
          coefficient: name
        });
      }
    });
  }
  if (functional.coefficientRoles !== undefined) {
    const rolesPath = `${path}.coefficientRoles`;
    if (requireObject(functional.coefficientRoles, rolesPath, issues)) {
      for (const [name, role] of Object.entries(functional.coefficientRoles)) {
        requireIdentifier(name, `${rolesPath}.${name}`, issues);
        if (!isObject(functional.coefficients) || !Object.hasOwn(functional.coefficients, name)) {
          addIssue(
            issues,
            "FUNCTIONAL_COEFFICIENT_ROLE_UNKNOWN",
            `${rolesPath}.${name}`,
            "A coefficient role may reference only a declared coefficient.",
            { coefficient: name }
          );
        }
        if (!FUNCTIONAL_COEFFICIENT_ROLES.has(role)) {
          addIssue(
            issues,
            "FUNCTIONAL_COEFFICIENT_ROLE_INVALID",
            `${rolesPath}.${name}`,
            "Coefficient role must be fixed, free, or fitted.",
            { coefficient: name, role }
          );
        }
      }
      if (isObject(functional.coefficients)) {
        for (const name of Object.keys(functional.coefficients)) {
          if (!Object.hasOwn(functional.coefficientRoles, name)) {
            addIssue(
              issues,
              "FUNCTIONAL_COEFFICIENT_ROLE_MISSING",
              `${rolesPath}.${name}`,
              "Explicit coefficient roles must cover every declared coefficient.",
              { coefficient: name }
            );
          }
        }
      }
      if (
        Array.isArray(functional.sensitivityCoefficients) &&
        functional.sensitivityCoefficients.every((name) => typeof name === "string")
      ) {
        const expected = Object.entries(functional.coefficientRoles)
          .filter(([, role]) => role === "free" || role === "fitted")
          .map(([name]) => name)
          .sort();
        const actual = [...new Set(functional.sensitivityCoefficients)].sort();
        if (canonicalize(expected) !== canonicalize(actual)) {
          addIssue(
            issues,
            "FUNCTIONAL_SENSITIVITY_COVERAGE_MISMATCH",
            `${path}.sensitivityCoefficients`,
            "Sensitivity coefficients must exactly cover every free or fitted coefficient.",
            {
              expected,
              actual,
              missing: expected.filter((name) => !actual.includes(name)),
              unexpected: actual.filter((name) => !expected.includes(name))
            }
          );
        }
      }
    }
  }
  validateQuantitySpec(functional.result, `${path}.result`, issues);
  requireString(functional.explain, `${path}.explain`, issues);
  validateStringArray(functional.claimRefs, `${path}.claimRefs`, issues);
}

function validateCohortRule(rule, path, issues) {
  if (!requireObject(rule, path, issues)) return;
  requireFields(rule, ["id", "kind"], path, issues);
  requireIdentifier(rule.id, `${path}.id`, issues);
  if (!new Set(["shared-support", "profile-role", "invariant-window", "singleton", "global"]).has(rule.kind)) {
    addIssue(issues, "COHORT_KIND_INVALID", `${path}.kind`, "Unknown cohort rule kind.");
    return;
  }
  if (rule.kind === "shared-support") {
    rejectUnknownFields(rule, new Set(["id", "kind", "resourceKey"]), path, issues);
    if (requireArray(rule.resourceKey, `${path}.resourceKey`, issues)) {
      if (rule.resourceKey.length === 0) addIssue(issues, "COHORT_RESOURCE_KEY_EMPTY", `${path}.resourceKey`, "Shared-support resource key cannot be empty.");
      rule.resourceKey.forEach((expression, index) => validateValueExpression(expression, `${path}.resourceKey[${index}]`, issues));
    }
  } else if (rule.kind === "profile-role") {
    rejectUnknownFields(rule, new Set(["id", "kind", "roleKey"]), path, issues);
    if (requireArray(rule.roleKey, `${path}.roleKey`, issues)) {
      if (rule.roleKey.length === 0) addIssue(issues, "COHORT_ROLE_KEY_EMPTY", `${path}.roleKey`, "Profile-role key cannot be empty.");
      rule.roleKey.forEach((expression, index) => validateValueExpression(expression, `${path}.roleKey[${index}]`, issues));
    }
  } else if (rule.kind === "invariant-window") {
    rejectUnknownFields(rule, new Set(["id", "kind", "value", "origin", "width", "bins"]), path, issues);
    validateValueExpression(rule.value, `${path}.value`, issues);
    validateQuantity(rule.origin, `${path}.origin`, issues);
    validateQuantity(rule.width, `${path}.width`, issues);
    if (isObject(rule.width) && Number.isFinite(rule.width.value) && rule.width.value <= 0) {
      addIssue(issues, "COHORT_WINDOW_WIDTH_INVALID", `${path}.width.value`, "Invariant-window width must be positive.");
    }
    if (
      isObject(rule.origin) &&
      isObject(rule.width) &&
      unitsCompatible(rule.origin.unit, rule.width.unit) === false
    ) {
      addIssue(issues, "QUANTITY_UNIT_INCOMPATIBLE", path, "Invariant-window origin and width must use compatible units.");
    }
    if (rule.bins !== "lower-closed-upper-open") {
      addIssue(issues, "COHORT_WINDOW_BINS_INVALID", `${path}.bins`, "Invariant-window bins must be lower-closed-upper-open.");
    }
  } else {
    rejectUnknownFields(rule, new Set(["id", "kind"]), path, issues);
  }
}

function validateExplanation(explanation, path, issues) {
  if (!requireObject(explanation, path, issues)) return;
  rejectUnknownFields(explanation, new Set(["pass", "fail", "indeterminate"]), path, issues);
  requireFields(explanation, ["pass", "fail", "indeterminate"], path, issues);
  for (const field of ["pass", "fail", "indeterminate"]) {
    requireString(explanation[field], `${path}.${field}`, issues);
  }
}

function validateSelector(selector, path, issues) {
  if (!requireObject(selector, path, issues)) return;
  rejectUnknownFields(selector, SELECTOR_FIELDS, path, issues);
  requireFields(selector, SELECTOR_FIELDS, path, issues);
  requireIdentifier(selector.id, `${path}.id`, issues);
  if (!new Set(["min", "max"]).has(selector.objective)) {
    addIssue(issues, "SELECTOR_OBJECTIVE_INVALID", `${path}.objective`, "Selector objective must be min or max.");
  }
  requireIdentifier(selector.functional, `${path}.functional`, issues);
  requireIdentifier(selector.cohortRule, `${path}.cohortRule`, issues);
  validateQuantity(selector.epsilon, `${path}.epsilon`, issues);
  if (isObject(selector.epsilon) && Number.isFinite(selector.epsilon.value) && selector.epsilon.value < 0) {
    addIssue(issues, "SELECTOR_EPSILON_INVALID", `${path}.epsilon.value`, "Selector epsilon cannot be negative.");
  }
  if (selector.tiePolicy !== "retain-all") {
    addIssue(issues, "SELECTOR_TIE_POLICY_INVALID", `${path}.tiePolicy`, "Semantic ties must use retain-all.");
  }
  if (requireObject(selector.sensitivity, `${path}.sensitivity`, issues)) {
    const sensitivityPath = `${path}.sensitivity`;
    const fields = new Set(["amplitudes", "sweep", "topK", "robustLeaderSetThreshold", "robustTopKThreshold"]);
    rejectUnknownFields(selector.sensitivity, fields, sensitivityPath, issues);
    requireFields(selector.sensitivity, fields, sensitivityPath, issues);
    if (requireArray(selector.sensitivity.amplitudes, `${sensitivityPath}.amplitudes`, issues)) {
      if (selector.sensitivity.amplitudes.length === 0) {
        addIssue(issues, "SENSITIVITY_AMPLITUDES_EMPTY", `${sensitivityPath}.amplitudes`, "Sensitivity amplitudes cannot be empty.");
      }
      const amplitudes = new Set();
      selector.sensitivity.amplitudes.forEach((amplitude, index) => {
        if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude >= 1) {
          addIssue(issues, "SENSITIVITY_AMPLITUDE_INVALID", `${sensitivityPath}.amplitudes[${index}]`, "Sensitivity amplitude must be finite and strictly between zero and one.");
        }
        if (amplitudes.has(amplitude)) {
          addIssue(issues, "SENSITIVITY_AMPLITUDE_DUPLICATE", `${sensitivityPath}.amplitudes[${index}]`, "Sensitivity amplitudes must be unique.");
        }
        amplitudes.add(amplitude);
      });
    }
    if (!new Set(["one-at-a-time", "cartesian"]).has(selector.sensitivity.sweep)) {
      addIssue(issues, "SENSITIVITY_SWEEP_INVALID", `${sensitivityPath}.sweep`, "Unknown sensitivity sweep mode.");
    }
    if (!Number.isSafeInteger(selector.sensitivity.topK) || selector.sensitivity.topK < 1) {
      addIssue(issues, "SENSITIVITY_TOP_K_INVALID", `${sensitivityPath}.topK`, "Sensitivity topK must be a positive safe integer.");
    }
    for (const field of ["robustLeaderSetThreshold", "robustTopKThreshold"]) {
      const value = selector.sensitivity[field];
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        addIssue(issues, "SENSITIVITY_THRESHOLD_INVALID", `${sensitivityPath}.${field}`, "Sensitivity threshold must be a finite ratio in [0,1].");
      }
    }
  }
  validateExplanation(selector.explain, `${path}.explain`, issues);
  validateStringArray(selector.claimRefs, `${path}.claimRefs`, issues);
}

function validateRegistry(values, path, issues, validator) {
  if (!requireArray(values, path, issues)) return;
  const ids = new Set();
  values.forEach((value, index) => {
    const itemPath = `${path}[${index}]`;
    validator(value, itemPath, issues);
    if (isObject(value) && typeof value.id === "string") {
      if (ids.has(value.id)) {
        addIssue(issues, "PACKAGE_DUPLICATE_ID", `${itemPath}.id`, "Duplicate registry identifier.", {
          id: value.id,
          registry: path
        });
      }
      ids.add(value.id);
    }
  });
}

function validateOntologyAxes(axes, path, issues) {
  if (!requireObject(axes, path, issues)) return;
  rejectUnknownFields(axes, new Set(["phasePrecedence", "levelPolicy"]), path, issues);
  requireFields(axes, ["phasePrecedence", "levelPolicy"], path, issues);
  if (!new Set(["declared", "profile-collapse-computed", "mixed-with-comparison"]).has(axes.levelPolicy)) {
    addIssue(issues, "ONTOLOGY_COORDINATE_LEVEL_POLICY_INVALID", `${path}.levelPolicy`, "Unknown ontology level policy.");
  }
  if (!requireArray(axes.phasePrecedence, `${path}.phasePrecedence`, issues)) return;
  const adjacency = new Map();
  const relations = new Set();
  axes.phasePrecedence.forEach((relation, index) => {
    const relationPath = `${path}.phasePrecedence[${index}]`;
    if (!requireObject(relation, relationPath, issues)) return;
    rejectUnknownFields(relation, new Set(["before", "after"]), relationPath, issues);
    requireFields(relation, ["before", "after"], relationPath, issues);
    for (const field of ["before", "after"]) {
      if (typeof relation[field] !== "string" || !ONTOLOGY_PHASE.test(relation[field])) {
        addIssue(issues, "ONTOLOGY_COORDINATE_PHASE_INVALID", `${relationPath}.${field}`, "Invalid phase in precedence relation.");
      }
    }
    if (relation.before === relation.after) {
      addIssue(issues, "ONTOLOGY_COORDINATE_PHASE_CYCLE", relationPath, "A phase cannot precede itself.");
    }
    if (typeof relation.before === "string" && typeof relation.after === "string") {
      const key = `${relation.before}\u0000${relation.after}`;
      if (relations.has(key)) {
        addIssue(issues, "ONTOLOGY_COORDINATE_PHASE_DUPLICATE", relationPath, "Duplicate ontology phase precedence relation.", {
          before: relation.before,
          after: relation.after
        });
      }
      relations.add(key);
    }
    if (!adjacency.has(relation.before)) adjacency.set(relation.before, new Set());
    adjacency.get(relation.before).add(relation.after);
  });

  const visiting = new Set();
  const visited = new Set();
  function visit(phase) {
    if (visiting.has(phase)) return true;
    if (visited.has(phase)) return false;
    visiting.add(phase);
    for (const next of adjacency.get(phase) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(phase);
    visited.add(phase);
    return false;
  }
  if ([...adjacency.keys()].some(visit)) {
    addIssue(issues, "ONTOLOGY_COORDINATE_PHASE_CYCLE", `${path}.phasePrecedence`, "Ontology phase precedence must be acyclic.");
  }
}

function validatePartialOraclePolicy(policy, path, issues) {
  if (!requireObject(policy, path, issues)) return;
  if (policy.mode === "indeterminate") {
    rejectUnknownFields(policy, new Set(["mode"]), path, issues);
    return;
  }
  if (policy.mode === "accept-expanded-tolerance") {
    rejectUnknownFields(policy, new Set(["mode", "toleranceMultiplier", "maximumResidual"]), path, issues);
    if (!Number.isFinite(policy.toleranceMultiplier) || policy.toleranceMultiplier < 1) {
      addIssue(issues, "ORACLE_PARTIAL_POLICY_INVALID", `${path}.toleranceMultiplier`, "Tolerance multiplier must be finite and at least one.");
    }
    if (policy.maximumResidual !== undefined) validateQuantity(policy.maximumResidual, `${path}.maximumResidual`, issues);
    return;
  }
  addIssue(issues, "ORACLE_PARTIAL_POLICY_INVALID", `${path}.mode`, "Unknown partial-oracle policy mode.");
}

function validateIdentityPolicy(policy, path, issues) {
  if (!requireObject(policy, path, issues)) return;
  const allowed = new Set(Object.keys(DEFAULT_IDENTITY_POLICY));
  rejectUnknownFields(policy, allowed, path, issues);
  requireIdentifier(policy.version, `${path}.version`, issues);
  for (const field of [...allowed].filter((field) => field !== "version")) {
    if (typeof policy[field] !== "boolean") {
      addIssue(issues, "PACKAGE_IDENTITY_POLICY_INVALID", `${path}.${field}`, "Identity policy flags must be boolean.");
    }
  }
}

function validateProfileDefinition(definition, path, issues) {
  if (!requireObject(definition, path, issues)) return;
  if (definition.kind === "explicit-only") {
    rejectUnknownFields(
      definition,
      EXPLICIT_PROFILE_DEFINITION_FIELDS,
      path,
      issues
    );
    requireFields(definition, EXPLICIT_PROFILE_DEFINITION_FIELDS, path, issues);
    return;
  }
  if (
    definition.kind === "residual-slots-v1" ||
    definition.kind === "residual-slots-v2" ||
    definition.kind === "residual-slots-v3"
  ) {
    const fields = definition.kind === "residual-slots-v3"
      ? FORMATION_DERIVED_TYPED_PROFILE_DEFINITION_FIELDS
      : definition.kind === "residual-slots-v2"
        ? FORMATION_DERIVED_PROFILE_DEFINITION_FIELDS
        : RESIDUAL_PROFILE_DEFINITION_FIELDS;
    rejectUnknownFields(
      definition,
      fields,
      path,
      issues
    );
    requireFields(
      definition,
      fields,
      path,
      issues
    );
    validateProfile(definition.baseProfile, `${path}.baseProfile`, issues);
    validateStringArray(
      definition.derivedTypeTags,
      `${path}.derivedTypeTags`,
      issues
    );
    validateStringArray(definition.claimRefs, `${path}.claimRefs`, issues);
    if (
      new Set(["residual-slots-v2", "residual-slots-v3"]).has(
        definition.kind
      ) &&
      requireArray(
        definition.derivedInvariants,
        `${path}.derivedInvariants`,
        issues
      )
    ) {
      const semantics = new Set(
        isObject(definition.baseProfile) &&
        Array.isArray(definition.baseProfile.invariantVector)
          ? definition.baseProfile.invariantVector
            .filter((entry) => isObject(entry) && typeof entry.semantic === "string")
            .map((entry) => entry.semantic)
          : []
      );
      definition.derivedInvariants.forEach((entry, index) => {
        const entryPath = `${path}.derivedInvariants[${index}]`;
        if (!requireObject(entry, entryPath, issues)) return;
        rejectUnknownFields(
          entry,
          FORMATION_DERIVED_INVARIANT_FIELDS,
          entryPath,
          issues
        );
        requireFields(
          entry,
          FORMATION_DERIVED_INVARIANT_FIELDS,
          entryPath,
          issues
        );
        const semanticValid = requireIdentifier(
          entry.semantic,
          `${entryPath}.semantic`,
          issues
        );
        requireIdentifier(
          entry.functional,
          `${entryPath}.functional`,
          issues
        );
        validateQuantity(
          entry.quantization,
          `${entryPath}.quantization`,
          issues
        );
        if (
          isObject(entry.quantization) &&
          Number.isFinite(entry.quantization.value) &&
          entry.quantization.value <= 0
        ) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_QUANTIZATION_INVALID",
            `${entryPath}.quantization.value`,
            "Formation-derived profile quantization must be positive."
          );
        }
        if (semanticValid && semantics.has(entry.semantic)) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_INVARIANT_DUPLICATE",
            `${entryPath}.semantic`,
            "Formation-derived profile invariant semantics must be unique and must not replace a base invariant.",
            { semantic: entry.semantic }
          );
        }
        if (semanticValid) semantics.add(entry.semantic);
      });
    }
    if (
      definition.kind === "residual-slots-v3" &&
      requireArray(
        definition.derivedTypeRules,
        `${path}.derivedTypeRules`,
        issues
      )
    ) {
      const derivedInvariants = new Map(
        Array.isArray(definition.derivedInvariants)
          ? definition.derivedInvariants
            .filter((entry) => isObject(entry) && typeof entry.semantic === "string")
            .map((entry) => [entry.semantic, entry])
          : []
      );
      const typeTags = new Set(
        Array.isArray(definition.derivedTypeTags)
          ? definition.derivedTypeTags.filter((entry) => typeof entry === "string")
          : []
      );
      definition.derivedTypeRules.forEach((rule, index) => {
        const rulePath = `${path}.derivedTypeRules[${index}]`;
        if (!requireObject(rule, rulePath, issues)) return;
        rejectUnknownFields(
          rule,
          FORMATION_DERIVED_TYPE_RULE_FIELDS,
          rulePath,
          issues
        );
        requireFields(
          rule,
          FORMATION_DERIVED_TYPE_RULE_FIELDS,
          rulePath,
          issues
        );
        const typeTagValid = requireIdentifier(
          rule.typeTag,
          `${rulePath}.typeTag`,
          issues
        );
        const invariantValid = requireIdentifier(
          rule.invariant,
          `${rulePath}.invariant`,
          issues
        );
        if (!QUANTITY_COMPARATORS.has(rule.comparator)) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_TYPE_COMPARATOR_INVALID",
            `${rulePath}.comparator`,
            "Formation-derived type comparator is unavailable.",
            { comparator: rule.comparator }
          );
        }
        validateQuantity(rule.threshold, `${rulePath}.threshold`, issues);
        if (typeTagValid && typeTags.has(rule.typeTag)) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_TYPE_TAG_DUPLICATE",
            `${rulePath}.typeTag`,
            "Formation-derived type rules and base derived type tags must be unique.",
            { typeTag: rule.typeTag }
          );
        }
        if (typeTagValid) typeTags.add(rule.typeTag);
        const invariant = invariantValid
          ? derivedInvariants.get(rule.invariant)
          : undefined;
        if (invariantValid && invariant === undefined) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_TYPE_INVARIANT_REFERENCE_MISSING",
            `${rulePath}.invariant`,
            "Formation-derived type rule must reference a declared formation-derived invariant.",
            { invariant: rule.invariant }
          );
        }
        if (
          invariant !== undefined &&
          isObject(rule.threshold) &&
          rule.threshold.semantic !== rule.invariant
        ) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_TYPE_THRESHOLD_SEMANTIC_MISMATCH",
            `${rulePath}.threshold.semantic`,
            "Formation-derived type threshold semantic must equal the referenced invariant.",
            {
              invariant: rule.invariant,
              thresholdSemantic: rule.threshold.semantic
            }
          );
        }
        if (
          invariant !== undefined &&
          isObject(invariant.quantization) &&
          isObject(rule.threshold) &&
          unitsCompatible(invariant.quantization.unit, rule.threshold.unit) === false
        ) {
          addIssue(
            issues,
            "QUANTITY_UNIT_INCOMPATIBLE",
            `${rulePath}.threshold.unit`,
            "Formation-derived type threshold and invariant must use compatible units.",
            {
              invariantUnit: invariant.quantization.unit,
              thresholdUnit: rule.threshold.unit,
              invariant: rule.invariant
            }
          );
        }
      });
    }
    return;
  }
  rejectUnknownFields(definition, new Set(["kind"]), path, issues);
  requireFields(definition, new Set(["kind"]), path, issues);
  addIssue(
    issues,
    "PACKAGE_PROFILE_DEFINITION_UNAVAILABLE",
    `${path}.kind`,
    "The declared derived-profile policy is unavailable.",
    { value: definition.kind }
  );
}

function validateReferences(raw, issues) {
  const evidence = new Set(raw.evidence.map((entry) => entry.id));
  const claims = new Set(raw.claims.map((entry) => entry.id));
  const functionals = new Map(raw.functionals.map((entry) => [entry.id, entry]));
  const cohortRules = new Set(raw.cohortRules.map((entry) => entry.id));
  const check = (values, available, path, code) => {
    if (!Array.isArray(values)) return;
    values.forEach((id, index) => {
      if (typeof id === "string" && !available.has(id)) {
        addIssue(issues, code, `${path}[${index}]`, "Referenced identifier does not exist.", { id });
      }
    });
  };
  raw.claims.forEach((claim, index) => check(claim.evidence, evidence, `$.claims[${index}].evidence`, "EVIDENCE_REFERENCE_MISSING"));
  raw.primitives.forEach((primitive, index) => {
    check(primitive.claimRefs, claims, `$.primitives[${index}].claimRefs`, "PACKAGE_CLAIM_REFERENCE_MISSING");
    for (const [name, quantity] of Object.entries(primitive.invariants || {})) {
      check(quantity?.provenance?.evidence, evidence, `$.primitives[${index}].invariants.${name}.provenance.evidence`, "EVIDENCE_REFERENCE_MISSING");
    }
    (primitive.profile?.invariantVector || []).forEach((entry, invariantIndex) => {
      for (const field of ["normalized", "quantization"]) {
        check(
          entry[field]?.provenance?.evidence,
          evidence,
          `$.primitives[${index}].profile.invariantVector[${invariantIndex}].${field}.provenance.evidence`,
          "EVIDENCE_REFERENCE_MISSING"
        );
      }
    });
  });
  raw.candidateAttributes.forEach((definition, index) => {
    if (definition.source?.kind === "constant-quantity-v1") {
      check(
        definition.source.value?.provenance?.evidence,
        evidence,
        `$.candidateAttributes[${index}].source.value.provenance.evidence`,
        "EVIDENCE_REFERENCE_MISSING"
      );
    }
    if (definition.source?.kind === "edge-role-quantity-v1") {
      for (const [role, value] of Object.entries(definition.source.values)) {
        check(
          value?.provenance?.evidence,
          evidence,
          `$.candidateAttributes[${index}].source.values.${role}.provenance.evidence`,
          "EVIDENCE_REFERENCE_MISSING"
        );
      }
    }
  });
  raw.predicates.forEach((predicate, index) => check(predicate.claimRefs, claims, `$.predicates[${index}].claimRefs`, "PACKAGE_CLAIM_REFERENCE_MISSING"));
  raw.functionals.forEach((functional, index) => {
    check(functional.claimRefs, claims, `$.functionals[${index}].claimRefs`, "PACKAGE_CLAIM_REFERENCE_MISSING");
    for (const [name, quantity] of Object.entries(functional.coefficients)) {
      check(quantity.provenance.evidence, evidence, `$.functionals[${index}].coefficients.${name}.provenance.evidence`, "EVIDENCE_REFERENCE_MISSING");
    }
  });
  raw.cohortRules.forEach((rule, index) => {
    for (const field of ["origin", "width"]) {
      if (rule[field]) check(rule[field].provenance.evidence, evidence, `$.cohortRules[${index}].${field}.provenance.evidence`, "EVIDENCE_REFERENCE_MISSING");
    }
  });
  raw.selectors.forEach((selector, index) => {
    check(selector.claimRefs, claims, `$.selectors[${index}].claimRefs`, "PACKAGE_CLAIM_REFERENCE_MISSING");
    check(selector.epsilon.provenance.evidence, evidence, `$.selectors[${index}].epsilon.provenance.evidence`, "EVIDENCE_REFERENCE_MISSING");
    if (!functionals.has(selector.functional)) {
      addIssue(issues, "SELECTOR_FUNCTIONAL_REFERENCE_MISSING", `$.selectors[${index}].functional`, "Selector functional does not exist.", {
        id: selector.functional
      });
    } else {
      const functional = functionals.get(selector.functional);
      if (unitsCompatible(selector.epsilon.unit, functional.result.unit) === false) {
        addIssue(issues, "QUANTITY_UNIT_INCOMPATIBLE", `$.selectors[${index}].epsilon.unit`, "Selector epsilon and functional result must use compatible units.", {
          epsilonUnit: selector.epsilon.unit,
          resultUnit: functional.result.unit,
          functional: selector.functional
        });
      }
    }
    if (!cohortRules.has(selector.cohortRule)) {
      addIssue(issues, "SELECTOR_COHORT_REFERENCE_MISSING", `$.selectors[${index}].cohortRule`, "Selector cohort rule does not exist.", {
        id: selector.cohortRule
      });
    }
  });
  if (new Set(["residual-slots-v1", "residual-slots-v2", "residual-slots-v3"]).has(
    raw.profileDefinition.kind
  )) {
    check(
      raw.profileDefinition.claimRefs,
      claims,
      "$.profileDefinition.claimRefs",
      "PACKAGE_CLAIM_REFERENCE_MISSING"
    );
    raw.profileDefinition.baseProfile.invariantVector.forEach(
      (entry, invariantIndex) => {
        for (const field of ["normalized", "quantization"]) {
          check(
            entry[field].provenance.evidence,
            evidence,
            `$.profileDefinition.baseProfile.invariantVector[${invariantIndex}].${field}.provenance.evidence`,
            "EVIDENCE_REFERENCE_MISSING"
          );
        }
      }
    );
    if (new Set(["residual-slots-v2", "residual-slots-v3"]).has(
      raw.profileDefinition.kind
    )) {
      raw.profileDefinition.derivedInvariants.forEach((entry, index) => {
        const entryPath = `$.profileDefinition.derivedInvariants[${index}]`;
        const functional = functionals.get(entry.functional);
        if (functional === undefined) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_FUNCTIONAL_REFERENCE_MISSING",
            `${entryPath}.functional`,
            "Formation-derived profile invariant functional does not exist.",
            { id: entry.functional }
          );
          return;
        }
        if (functional.result.semantic !== entry.semantic) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_INVARIANT_SEMANTIC_MISMATCH",
            `${entryPath}.semantic`,
            "Formation-derived profile semantic must equal the functional result semantic.",
            {
              semantic: entry.semantic,
              functionalSemantic: functional.result.semantic,
              functional: entry.functional
            }
          );
        }
        if (entry.quantization.semantic !== entry.semantic) {
          addIssue(
            issues,
            "PACKAGE_PROFILE_INVARIANT_SEMANTIC_MISMATCH",
            `${entryPath}.quantization.semantic`,
            "Formation-derived profile quantization semantic must equal the declared profile semantic.",
            {
              semantic: entry.semantic,
              quantizationSemantic: entry.quantization.semantic
            }
          );
        }
        if (unitsCompatible(functional.result.unit, entry.quantization.unit) === false) {
          addIssue(
            issues,
            "QUANTITY_UNIT_INCOMPATIBLE",
            `${entryPath}.quantization.unit`,
            "Formation-derived profile quantization and functional result must use compatible units.",
            {
              quantizationUnit: entry.quantization.unit,
              functionalUnit: functional.result.unit,
              functional: entry.functional
            }
          );
        }
      });
    }
    if (raw.profileDefinition.kind === "residual-slots-v3") {
      raw.profileDefinition.derivedTypeRules.forEach((rule, index) => {
        check(
          rule.threshold?.provenance?.evidence,
          evidence,
          `$.profileDefinition.derivedTypeRules[${index}].threshold.provenance.evidence`,
          "EVIDENCE_REFERENCE_MISSING"
        );
      });
    }

    const carriedInvariants = new Map(
      raw.profileDefinition.baseProfile.invariantVector.map((entry) => [
        entry.semantic,
        {
          source: "base-profile",
          unit: entry.normalized.unit,
          semantic: entry.normalized.semantic
        }
      ])
    );
    if (new Set(["residual-slots-v2", "residual-slots-v3"]).has(
      raw.profileDefinition.kind
    )) {
      for (const entry of raw.profileDefinition.derivedInvariants) {
        const functional = functionals.get(entry.functional);
        if (functional === undefined) continue;
        carriedInvariants.set(entry.semantic, {
          source: "formation-functional",
          unit: functional.result.unit,
          semantic: functional.result.semantic,
          functional: entry.functional
        });
      }
    }
    raw.candidateAttributes.forEach((definition, index) => {
      if (!definition.source.kind.startsWith("element-invariant-")) return;
      const carried = carriedInvariants.get(definition.source.invariant);
      if (carried === undefined) return;
      const primitiveValue = raw.primitives[0].invariants[
        definition.source.invariant
      ];
      const path = `$.candidateAttributes[${index}].source.invariant`;
      if (
        definition.source.kind !== "element-invariant-quantity-v1" ||
        invariantValueKind(primitiveValue) !== "quantity"
      ) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_CARRY_FORWARD_TYPE_MISMATCH",
          path,
          "A profile Quantity carried into a future candidate must use a Quantity candidate-attribute source.",
          {
            attribute: definition.name,
            invariant: definition.source.invariant,
            carriedSource: carried.source
          }
        );
        return;
      }
      if (
        areUnitsCompatible(primitiveValue.unit, carried.unit) === false ||
        primitiveValue.semantic !== carried.semantic
      ) {
        addIssue(
          issues,
          "PACKAGE_CANDIDATE_ATTRIBUTE_CARRY_FORWARD_TYPE_MISMATCH",
          path,
          "A carried profile invariant must preserve the candidate attribute's primitive unit dimensions and semantic.",
          {
            attribute: definition.name,
            invariant: definition.source.invariant,
            primitiveUnit: primitiveValue.unit,
            carriedUnit: carried.unit,
            primitiveSemantic: primitiveValue.semantic,
            carriedSemantic: carried.semantic,
            carriedSource: carried.source,
            ...(carried.functional === undefined
              ? {}
              : { functional: carried.functional })
          }
        );
      }
    });
  }
  if (raw.partialOraclePolicy.maximumResidual) {
    check(
      raw.partialOraclePolicy.maximumResidual.provenance.evidence,
      evidence,
      "$.partialOraclePolicy.maximumResidual.provenance.evidence",
      "EVIDENCE_REFERENCE_MISSING"
    );
  }
}

function rebaseExpressionIssues(issues, error, path) {
  if (!(error instanceof KernelValidationError) || error.code !== "EXPRESSION_ANALYSIS_FAILED") throw error;
  for (const entry of error.issues) {
    issues.push(validationIssue(
      entry.code,
      entry.path === "$" ? path : `${path}${entry.path.slice(1)}`,
      entry.message,
      entry.details
    ));
  }
}

function rebasePredicateCompilationIssues(issues, error, path) {
  if (!(error instanceof KernelValidationError) || error.code !== "PREDICATE_COMPILATION_FAILED") throw error;
  for (const entry of error.issues) {
    issues.push(validationIssue(
      entry.code,
      entry.path === "$" ? path : `${path}${entry.path.slice(1)}`,
      entry.message,
      entry.details
    ));
  }
}

function collectPerturbationIds(raw, issues) {
  const ids = new Set();
  raw.perturbations.forEach((entry, index) => {
    const path = `$.perturbations[${index}]`;
    const id = typeof entry === "string" ? entry : isObject(entry) ? entry.id : undefined;
    if (id === undefined) return;
    if (!requireIdentifier(id, typeof entry === "string" ? path : `${path}.id`, issues)) return;
    if (ids.has(id)) {
      addIssue(issues, "PACKAGE_DUPLICATE_ID", typeof entry === "string" ? path : `${path}.id`, "Duplicate perturbation identifier.", {
        id,
        registry: "$.perturbations"
      });
    }
    ids.add(id);
  });
  return [...ids].sort();
}

function buildInvariantEnvironment(raw, issues) {
  const invariants = {};
  const declarations = new Map();
  raw.primitives.forEach((primitive, primitiveIndex) => {
    for (const [name, value] of Object.entries(primitive.invariants)) {
      const kind = invariantValueKind(value);
      const parsed = kind === "quantity" ? parseUnitExpression(value.unit) : null;
      const declaration = {
        kind,
        ...(parsed === null
          ? {}
          : {
              dimensionSignature: parsed.dimensionSignature,
              semantic: value.semantic.trim()
            }),
        path: `$.primitives[${primitiveIndex}].invariants.${name}`
      };
      const previous = declarations.get(name);
      if (
        previous !== undefined &&
        (
          previous.kind !== declaration.kind ||
          (
            declaration.kind === "quantity" &&
            (
              previous.dimensionSignature !== declaration.dimensionSignature ||
              previous.semantic !== declaration.semantic
            )
          )
        )
      ) {
        addIssue(
          issues,
          "EXPRESSION_INVARIANT_TYPE_CONFLICT",
          declaration.path,
          "Invariant declarations with the same name must have identical runtime types; Quantity declarations must also have identical dimensions and semantics.",
          {
            name,
            previousPath: previous.path,
            previousKind: previous.kind,
            kind: declaration.kind,
            ...(previous.kind === "quantity"
              ? {
                  previousDimensionSignature: previous.dimensionSignature,
                  previousSemantic: previous.semantic
                }
              : {}),
            ...(declaration.kind === "quantity"
              ? {
                  dimensionSignature: declaration.dimensionSignature,
                  semantic: declaration.semantic
                }
              : {})
          }
        );
      } else if (previous === undefined) {
        declarations.set(name, declaration);
        invariants[name] = invariantExpressionSymbol(value);
      }
    }
  });
  return invariants;
}

function buildCandidateAttributeEnvironment(raw, invariants) {
  return candidateAttributeSymbolEnvironment(
    raw.candidateAttributes,
    invariants
  );
}

function compilePackageExpressions(raw, issues) {
  const invariants = buildInvariantEnvironment(raw, issues);
  const attributes = buildCandidateAttributeEnvironment(raw, invariants);
  const perturbations = collectPerturbationIds(raw, issues);
  const compiled = {
    predicates: new Map(),
    functionals: new Map(),
    cohortRules: new Map()
  };

  raw.predicates.forEach((predicate, index) => {
    try {
      const plan = compilePredicate(predicate, {
        environment: { invariants, attributes, perturbations }
      });
      compiled.predicates.set(predicate.id, plan);
    } catch (error) {
      rebasePredicateCompilationIssues(issues, error, `$.predicates[${index}]`);
    }
  });

  raw.functionals.forEach((functional, index) => {
    try {
      const analysis = analyzeValueExpression(functional.expr, {
        environment: {
          invariants,
          attributes,
          coefficients: functional.coefficients
        }
      });
      const resultUnit = parseUnitExpression(functional.result.unit);
      if (analysis.result.kind !== "number" && analysis.result.kind !== "quantity") {
        addIssue(
          issues,
          "FUNCTIONAL_RESULT_NON_NUMERIC",
          `$.functionals[${index}].expr`,
          "Functional expression must produce a number or quantity.",
          {
            functional: functional.id,
            actualKind: analysis.result.kind
          }
        );
      } else if (analysis.result.dimensionSignature !== resultUnit.dimensionSignature) {
        addIssue(
          issues,
          "FUNCTIONAL_RESULT_UNIT_INCOMPATIBLE",
          `$.functionals[${index}].result.unit`,
          "Functional result unit is incompatible with the inferred expression dimension.",
          {
            functional: functional.id,
            expressionUnit: analysis.result.unit,
            expressionDimensionSignature: analysis.result.dimensionSignature,
            resultUnit: functional.result.unit,
            resultDimensionSignature: resultUnit.dimensionSignature
          }
        );
      }
      compiled.functionals.set(functional.id, analysis);
    } catch (error) {
      rebaseExpressionIssues(issues, error, `$.functionals[${index}].expr`);
    }
  });

  raw.cohortRules.forEach((rule, index) => {
    const environment = { invariants, attributes };
    if (rule.kind === "shared-support" || rule.kind === "profile-role") {
      const field = rule.kind === "shared-support" ? "resourceKey" : "roleKey";
      const analyses = [];
      rule[field].forEach((expression, expressionIndex) => {
        try {
          analyses.push(analyzeValueExpression(expression, { environment }));
        } catch (error) {
          rebaseExpressionIssues(issues, error, `$.cohortRules[${index}].${field}[${expressionIndex}]`);
        }
      });
      if (analyses.length === rule[field].length) compiled.cohortRules.set(rule.id, { field, analyses });
      return;
    }
    if (rule.kind !== "invariant-window") return;
    try {
      const analysis = analyzeValueExpression(rule.value, { environment });
      if (analysis.result.kind !== "number" && analysis.result.kind !== "quantity") {
        addIssue(
          issues,
          "COHORT_WINDOW_VALUE_NON_NUMERIC",
          `$.cohortRules[${index}].value`,
          "Invariant-window expression must produce a number or quantity.",
          { actualKind: analysis.result.kind }
        );
      } else {
        const originUnit = parseUnitExpression(rule.origin.unit);
        if (analysis.result.dimensionSignature !== originUnit.dimensionSignature) {
          addIssue(
            issues,
            "COHORT_WINDOW_VALUE_UNIT_INCOMPATIBLE",
            `$.cohortRules[${index}].value`,
            "Invariant-window expression and origin must have identical dimensions.",
            {
              expressionUnit: analysis.result.unit,
              expressionDimensionSignature: analysis.result.dimensionSignature,
              originUnit: rule.origin.unit,
              originDimensionSignature: originUnit.dimensionSignature
            }
          );
        }
      }
      compiled.cohortRules.set(rule.id, { field: "value", analysis });
    } catch (error) {
      rebaseExpressionIssues(issues, error, `$.cohortRules[${index}].value`);
    }
  });

  return compiled;
}

function validatePackage(raw, options = {}) {
  const issues = [];
  if (!requireObject(raw, "$", issues)) return { issues, compiledExpressions: null };
  rejectUnknownFields(raw, ROOT_FIELDS, "$", issues);
  requireFields(raw, ["schemaVersion", "id", "version"], "$", issues);
  if (raw.schemaVersion !== "1") {
    addIssue(issues, "PACKAGE_SCHEMA_UNSUPPORTED", "$.schemaVersion", "Only kernel package schema version 1 is supported.", {
      value: raw.schemaVersion
    });
  }
  requireIdentifier(raw.id, "$.id", issues);
  requireIdentifier(raw.version, "$.version", issues);

  if (requireArray(raw.sourceArtifacts, "$.sourceArtifacts", issues)) {
    const artifactHashes = new Set();
    const artifactPaths = new Set();
    raw.sourceArtifacts.forEach((artifact, index) => {
      const artifactPath = `$.sourceArtifacts[${index}]`;
      validateArtifact(artifact, artifactPath, issues);
      if (!isObject(artifact)) return;
      for (const [field, values] of [["hash", artifactHashes], ["path", artifactPaths]]) {
        if (typeof artifact[field] !== "string") continue;
        if (values.has(artifact[field])) {
          addIssue(issues, "PACKAGE_DUPLICATE_ARTIFACT", `${artifactPath}.${field}`, "Source artifact is duplicated.", {
            field,
            value: artifact[field]
          });
        }
        values.add(artifact[field]);
      }
    });
  }
  validateRegistry(raw.evidence, "$.evidence", issues, validateEvidence);
  validateRegistry(raw.claims, "$.claims", issues, validateClaim);
  validateRegistry(raw.primitives, "$.primitives", issues, validatePrimitive);
  if (Array.isArray(raw.primitives)) {
    if (raw.primitives.length === 0) {
      addIssue(issues, "PACKAGE_PRIMITIVES_EMPTY", "$.primitives", "A kernel package must declare at least one primitive.");
    }
    const sourceIds = new Set();
    raw.primitives.forEach((primitive, index) => {
      if (!isObject(primitive) || typeof primitive.sourceId !== "string") return;
      if (sourceIds.has(primitive.sourceId)) {
        addIssue(issues, "PACKAGE_DUPLICATE_ID", `$.primitives[${index}].sourceId`, "Duplicate primitive source identifier.", {
          id: primitive.sourceId,
          registry: "$.primitives"
        });
      }
      sourceIds.add(primitive.sourceId);
    });
  }
  validateRegistry(
    raw.predicates,
    "$.predicates",
    issues,
    (predicate, path, predicateIssues) => validatePredicate(
      predicate,
      path,
      predicateIssues,
      options
    )
  );
  validateRegistry(raw.functionals, "$.functionals", issues, validateFunctional);
  validateRegistry(raw.cohortRules, "$.cohortRules", issues, validateCohortRule);
  validateRegistry(raw.selectors, "$.selectors", issues, validateSelector);
  validateCandidateAttributes(
    raw.candidateAttributes,
    Array.isArray(raw.primitives) ? raw.primitives : [],
    "$.candidateAttributes",
    issues
  );
  validatePartialOraclePolicy(raw.partialOraclePolicy, "$.partialOraclePolicy", issues);
  validateOntologyAxes(raw.ontologyAxes, "$.ontologyAxes", issues);
  if (requireArray(raw.perturbations, "$.perturbations", issues)) {
    raw.perturbations.forEach((entry, index) =>
      validatePerturbation(entry, `$.perturbations[${index}]`, issues)
    );
  }
  validateProfileDefinition(raw.profileDefinition, "$.profileDefinition", issues);
  validateIdentityPolicy(raw.identityPolicy, "$.identityPolicy", issues);
  if (raw.sourceMigration !== undefined) {
    validateSourceMigration(
      raw.sourceMigration,
      raw.sourceArtifacts,
      raw.primitives,
      issues
    );
  } else if (
    Array.isArray(raw.primitives) &&
    raw.primitives.some((primitive) => isObject(primitive) && primitive.kind === "condensed-cluster")
  ) {
    addIssue(
      issues,
      "SOURCE_MIGRATION_REQUIRED",
      "$.sourceMigration",
      "Condensed-cluster primitives require a complete bound source migration."
    );
  }

  let compiledExpressions = null;
  if (issues.length === 0) validateReferences(raw, issues);
  if (issues.length === 0) compiledExpressions = compilePackageExpressions(raw, issues);
  return { issues, compiledExpressions };
}

function sortedStrings(values) {
  return [...values].sort();
}

function sortedRecord(record, transform = (value) => value) {
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, transform(record[key])]));
}

function normalizeQuantity(quantity) {
  const normalized = normalizeRuntimeQuantity(quantity);
  return {
    value: normalized.value,
    unit: normalized.unit,
    tolerance: sortedRecord(normalized.tolerance),
    semantic: normalized.semantic,
    provenance: {
      ...normalized.provenance,
      evidence: sortedStrings(normalized.provenance.evidence)
    }
  };
}

function normalizeArtifact(artifact) {
  return {
    path: artifact.path,
    mediaType: artifact.mediaType,
    schemaVersion: artifact.schemaVersion,
    bytes: artifact.bytes,
    hash: artifact.hash
  };
}

function normalizeQuantitySpec(specification) {
  const normalized = normalizeRuntimeQuantity({
    value: 0,
    unit: specification.unit,
    tolerance: specification.toleranceTarget,
    semantic: specification.semantic,
    provenance: { kind: "declared", evidence: [] }
  });
  return {
    id: specification.id.trim(),
    unit: normalized.unit,
    semantic: normalized.semantic,
    toleranceTarget: sortedRecord(normalized.tolerance)
  };
}

function normalizeFunctional(functional, analysis) {
  const sensitivityCoefficients = sortedStrings(functional.sensitivityCoefficients);
  const sensitivitySet = new Set(sensitivityCoefficients);
  const coefficientRoles = sortedRecord(Object.fromEntries(
    Object.keys(functional.coefficients).map((name) => [
      name,
      functional.coefficientRoles?.[name] ??
        (sensitivitySet.has(name) ? "free" : "fixed")
    ])
  ));
  return {
    id: functional.id.trim(),
    expr: analysis.expression,
    coefficients: sortedRecord(functional.coefficients, normalizeQuantity),
    coefficientRoles,
    sensitivityCoefficients,
    result: normalizeQuantitySpec(functional.result),
    explain: functional.explain.trim(),
    claimRefs: sortedStrings(functional.claimRefs)
  };
}

function normalizePredicate(predicate, plan) {
  return {
    id: predicate.id.trim(),
    phase: predicate.phase,
    monotoneViolation: predicate.monotoneViolation,
    referencesDepth: predicate.referencesDepth,
    expr: plan.expression,
    explain: {
      pass: predicate.explain.pass.trim(),
      fail: predicate.explain.fail.trim(),
      indeterminate: predicate.explain.indeterminate.trim()
    },
    claimRefs: sortedStrings(predicate.claimRefs)
  };
}

function normalizeCohortRule(rule, compiled) {
  if (rule.kind === "shared-support") {
    return { id: rule.id.trim(), kind: rule.kind, resourceKey: compiled.analyses.map((analysis) => analysis.expression) };
  }
  if (rule.kind === "profile-role") {
    return { id: rule.id.trim(), kind: rule.kind, roleKey: compiled.analyses.map((analysis) => analysis.expression) };
  }
  if (rule.kind === "invariant-window") {
    return {
      id: rule.id.trim(),
      kind: rule.kind,
      value: compiled.analysis.expression,
      origin: normalizeQuantity(rule.origin),
      width: normalizeQuantity(rule.width),
      bins: "lower-closed-upper-open"
    };
  }
  return { id: rule.id.trim(), kind: rule.kind };
}

function normalizeSelector(selector) {
  return {
    id: selector.id.trim(),
    objective: selector.objective,
    functional: selector.functional,
    cohortRule: selector.cohortRule,
    epsilon: normalizeQuantity(selector.epsilon),
    tiePolicy: "retain-all",
    sensitivity: {
      ...selector.sensitivity,
      amplitudes: [...selector.sensitivity.amplitudes].sort((left, right) => left - right)
    },
    explain: selector.explain,
    claimRefs: sortedStrings(selector.claimRefs)
  };
}

function normalizePerturbation(entry) {
  if (typeof entry === "string") return entry;
  const common = {
    id: entry.id.trim(),
    kind: entry.kind,
    enumeration: entry.enumeration ?? DEFAULT_PERTURBATION_ENUMERATION,
    emptyPolicy: entry.emptyPolicy ?? "indeterminate"
  };
  if (entry.kind === "edge-deletion") {
    return {
      ...common,
      ...(entry.roles === undefined ? {} : { roles: sortedStrings(entry.roles) })
    };
  }
  if (entry.kind === "node-deletion") return common;
  if (entry.kind === "edge-role-replacement") {
    return {
      ...common,
      replacements: [...entry.replacements]
        .map((replacement) => ({
          from: replacement.from.trim(),
          to: replacement.to.trim()
        }))
        .sort(compareCanonical)
    };
  }
  return {
    ...common,
    target: entry.target,
    attribute: entry.attribute.trim(),
    epsilon: Object.is(entry.epsilon, -0) ? 0 : entry.epsilon,
    directions: sortedStrings(entry.directions ?? ["decrease", "increase"])
  };
}

function normalizePartialOraclePolicy(policy) {
  if (policy.mode === "indeterminate") return { mode: "indeterminate" };
  return {
    mode: "accept-expanded-tolerance",
    toleranceMultiplier: policy.toleranceMultiplier,
    ...(policy.maximumResidual === undefined
      ? {}
      : { maximumResidual: normalizeQuantity(policy.maximumResidual) })
  };
}

function normalizeProfileDefinition(definition, issues) {
  if (definition.kind === "explicit-only") return { kind: "explicit-only" };
  const normalized = {
    kind: definition.kind,
    baseProfile: normalizeProfile(
      definition.baseProfile,
      "$.profileDefinition.baseProfile",
      issues
    ),
    derivedTypeTags: sortedStrings(definition.derivedTypeTags),
    claimRefs: sortedStrings(definition.claimRefs)
  };
  if (definition.kind === "residual-slots-v1") return normalized;
  const withInvariants = {
    ...normalized,
    derivedInvariants: definition.derivedInvariants.map((entry) => ({
      semantic: entry.semantic.trim(),
      functional: entry.functional.trim(),
      quantization: normalizeQuantity(entry.quantization)
    })).sort((left, right) =>
      compareStrings(left.semantic, right.semantic) ||
      compareStrings(left.functional, right.functional)
    )
  };
  if (definition.kind === "residual-slots-v2") return withInvariants;
  return {
    ...withInvariants,
    derivedTypeRules: definition.derivedTypeRules.map((rule) => ({
      typeTag: rule.typeTag.trim(),
      invariant: rule.invariant.trim(),
      comparator: rule.comparator,
      threshold: normalizeQuantity(rule.threshold)
    })).sort((left, right) =>
      compareStrings(left.typeTag, right.typeTag) ||
      compareStrings(left.invariant, right.invariant) ||
      compareStrings(left.comparator, right.comparator)
    )
  };
}

function normalizeProfile(profile, path, issues) {
  const normalized = normalizeProfileRecord(profile);
  const hash = normalized.hash;
  if (profile.hash !== undefined && profile.hash !== hash) {
    addIssue(issues, "PACKAGE_PROFILE_HASH_MISMATCH", `${path}.hash`, "Declared profile hash does not match normalized profile.", {
      declared: profile.hash,
      computed: hash
    });
  }
  return normalized;
}

function normalizeCluster(cluster) {
  return {
    disposition: cluster.disposition,
    members: sortedStrings(cluster.members),
    internalRelations: sortedStrings(cluster.internalRelations),
    internalOrder: "undefined",
    classificationPolicyHash: cluster.classificationPolicyHash,
    classificationArtifact: normalizeArtifact(cluster.classificationArtifact),
    nodeResolutionArtifact: normalizeArtifact(cluster.nodeResolutionArtifact),
    condensationArtifact: normalizeArtifact(cluster.condensationArtifact)
  };
}

function normalizeSourceMigration(sourceMigration) {
  return {
    policyHash: sourceMigration.policyHash,
    blindnessStatus: sourceMigration.blindnessStatus,
    ...Object.fromEntries(SOURCE_MIGRATION_ARTIFACT_FIELDS.map((field) => [
      field,
      normalizeArtifact(sourceMigration[field])
    ])),
    typedRelationLayers: sourceMigration.typedRelationLayers
      .map(normalizeArtifact)
      .sort((left, right) => compareStrings(left.hash, right.hash)),
    ...(sourceMigration.concentration === undefined
      ? {}
      : { concentration: normalizeArtifact(sourceMigration.concentration) })
  };
}

export function createPrimitiveIdentityBasis(primitive, identityPolicy) {
  const identity = { kind: primitive.kind };
  if (identityPolicy.sourceIdStructural) identity.sourceId = primitive.sourceId;
  if (identityPolicy.ontologyCoordinateStructural) identity.ontologyCoordinate = primitive.ontologyCoordinate || null;
  if (identityPolicy.typeTagsStructural) identity.typeTags = primitive.typeTags;
  if (identityPolicy.invariantsStructural) {
    identity.invariants = sortedRecord(primitive.invariants, invariantIdentityValue);
  }
  if (identityPolicy.profileStructural) identity.profileHash = primitive.profile.hash;
  if (identityPolicy.clusterPolicyStructural) {
    identity.cluster = primitive.cluster ? {
      disposition: primitive.cluster.disposition,
      classificationPolicyHash: primitive.cluster.classificationPolicyHash,
      nodeResolutionHash: primitive.cluster.nodeResolutionArtifact.hash,
      condensationHash: primitive.cluster.condensationArtifact.hash
    } : null;
  }
  return identity;
}

function normalizePackage(raw, issues, compiledExpressions) {
  const identityPolicy = { ...DEFAULT_IDENTITY_POLICY, ...raw.identityPolicy };
  const primitives = raw.primitives.map((primitive, index) => {
    const normalized = {
      sourceId: primitive.sourceId.trim(),
      kind: primitive.kind,
      ...(primitive.cluster === undefined ? {} : { cluster: normalizeCluster(primitive.cluster) }),
      ...(primitive.ontologyCoordinate === undefined ? {} : { ontologyCoordinate: primitive.ontologyCoordinate }),
      ...(primitive.axisProvenance === undefined ? {} : { axisProvenance: primitive.axisProvenance }),
      typeTags: sortedStrings(primitive.typeTags),
      invariants: sortedRecord(primitive.invariants, normalizeInvariantValue),
      profile: normalizeProfile(primitive.profile, `$.primitives[${index}].profile`, issues),
      claimRefs: sortedStrings(primitive.claimRefs)
    };
    return {
      ...normalized,
      elementId: hashCanonical(HASH_DOMAINS.ELEMENT, createPrimitiveIdentityBasis(normalized, identityPolicy))
    };
  }).sort((left, right) => compareStrings(left.elementId, right.elementId) || compareStrings(left.sourceId, right.sourceId));

  const normalized = {
    schemaVersion: "1",
    id: raw.id.trim(),
    version: raw.version.trim(),
    sourceArtifacts: raw.sourceArtifacts.map(normalizeArtifact).sort((left, right) => compareStrings(left.hash, right.hash)),
    ...(raw.sourceMigration === undefined
      ? {}
      : { sourceMigration: normalizeSourceMigration(raw.sourceMigration) }),
    evidence: [...raw.evidence].sort((left, right) => compareStrings(left.id, right.id)).map((entry) => ({
      ...entry,
      source: normalizeArtifact(entry.source)
    })),
    claims: [...raw.claims].sort((left, right) => compareStrings(left.id, right.id)).map((entry) => ({
      ...entry,
      evidence: sortedStrings(entry.evidence)
    })),
    primitives,
    predicates: [...raw.predicates]
      .sort((left, right) => compareStrings(left.id, right.id))
      .map((entry) => normalizePredicate(entry, compiledExpressions.predicates.get(entry.id))),
    functionals: [...raw.functionals]
      .sort((left, right) => compareStrings(left.id, right.id))
      .map((entry) => normalizeFunctional(entry, compiledExpressions.functionals.get(entry.id))),
    cohortRules: [...raw.cohortRules]
      .sort((left, right) => compareStrings(left.id, right.id))
      .map((entry) => normalizeCohortRule(entry, compiledExpressions.cohortRules.get(entry.id))),
    selectors: [...raw.selectors].sort((left, right) => compareStrings(left.id, right.id)).map(normalizeSelector),
    partialOraclePolicy: normalizePartialOraclePolicy(raw.partialOraclePolicy),
    ontologyAxes: {
      ...raw.ontologyAxes,
      phasePrecedence: [...raw.ontologyAxes.phasePrecedence].sort(compareCanonical)
    },
    perturbations: raw.perturbations
      .map(normalizePerturbation)
      .sort((left, right) => {
        const leftId = typeof left === "string" ? left : left.id;
        const rightId = typeof right === "string" ? right : right.id;
        return compareStrings(leftId, rightId) || compareCanonical(left, right);
      }),
    candidateAttributes: raw.candidateAttributes.map((definition) => ({
      name: definition.name.trim(),
      target: definition.target,
      source: CONSTANT_CANDIDATE_ATTRIBUTE_SOURCES.has(definition.source.kind)
        ? {
            kind: definition.source.kind,
            value: normalizeInvariantValue(definition.source.value)
          }
        : ROLE_CANDIDATE_ATTRIBUTE_SOURCES.has(definition.source.kind)
          ? {
              kind: definition.source.kind,
              values: sortedRecord(
                definition.source.values,
                normalizeInvariantValue
              )
            }
          : {
              kind: definition.source.kind,
              invariant: definition.source.invariant.trim()
            }
    })).sort((left, right) => compareStrings(left.name, right.name)),
    profileDefinition: normalizeProfileDefinition(raw.profileDefinition, issues),
    identityPolicy
  };
  return normalized;
}

function materializeDefaults(input) {
  return {
    ...input,
    sourceArtifacts: input.sourceArtifacts === undefined ? [] : input.sourceArtifacts,
    evidence: input.evidence === undefined ? [] : input.evidence,
    claims: input.claims === undefined ? [] : input.claims,
    primitives: input.primitives === undefined ? [] : input.primitives,
    predicates: input.predicates === undefined ? [] : input.predicates,
    functionals: input.functionals === undefined ? [] : input.functionals,
    cohortRules: input.cohortRules === undefined ? [] : input.cohortRules,
    selectors: input.selectors === undefined ? [] : input.selectors,
    partialOraclePolicy: input.partialOraclePolicy === undefined ? DEFAULT_PARTIAL_ORACLE_POLICY : input.partialOraclePolicy,
    ontologyAxes: input.ontologyAxes === undefined ? DEFAULT_ONTOLOGY_AXES : input.ontologyAxes,
    perturbations: input.perturbations === undefined ? [] : input.perturbations,
    candidateAttributes: input.candidateAttributes === undefined
      ? []
      : input.candidateAttributes,
    profileDefinition: input.profileDefinition === undefined ? DEFAULT_PROFILE_DEFINITION : input.profileDefinition,
    identityPolicy: input.identityPolicy === undefined
      ? { ...DEFAULT_IDENTITY_POLICY }
      : isObject(input.identityPolicy)
        ? { ...DEFAULT_IDENTITY_POLICY, ...input.identityPolicy }
        : input.identityPolicy
  };
}

export function loadKernelPackage(input, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Kernel package loader options must be an object.");
  }
  const safeOptions = canonicalClone(options);
  if (Object.keys(safeOptions).some((field) =>
    !new Set(["kernelVersion", "allowCurrentDepthReferences"]).has(field)
  )) {
    throw new TypeError("Unknown kernel package loader option.");
  }
  const kernelVersion = safeOptions.kernelVersion === undefined
    ? DEFAULT_KERNEL_VERSION
    : safeOptions.kernelVersion;
  if (typeof kernelVersion !== "string" || kernelVersion.trim().length === 0) {
    throw new TypeError("Kernel version must be a non-empty string.");
  }
  if (
    safeOptions.allowCurrentDepthReferences !== undefined &&
    typeof safeOptions.allowCurrentDepthReferences !== "boolean"
  ) {
    throw new TypeError("allowCurrentDepthReferences must be Boolean.");
  }
  const cloned = canonicalClone(input);
  const withDefaults = materializeDefaults(cloned);
  const validation = validatePackage(withDefaults, {
    allowCurrentDepthReferences:
      safeOptions.allowCurrentDepthReferences === true
  });
  const { issues, compiledExpressions } = validation;
  if (issues.length > 0) throw new KernelValidationError(issues);

  const normalized = normalizePackage(withDefaults, issues, compiledExpressions);
  const seenElementIds = new Set();
  normalized.primitives.forEach((primitive, index) => {
    if (seenElementIds.has(primitive.elementId)) {
      addIssue(issues, "PACKAGE_DUPLICATE_ELEMENT_ID", `$.primitives[${index}].elementId`, "Two primitive definitions normalize to the same structural identity.", {
        elementId: primitive.elementId,
        sourceId: primitive.sourceId
      });
    }
    seenElementIds.add(primitive.elementId);
  });
  if (issues.length > 0) throw new KernelValidationError(issues);

  const identityPolicyHash = hashCanonical(HASH_DOMAINS.IDENTITY_POLICY, normalized.identityPolicy);
  const rulesHash = hashCanonical(HASH_DOMAINS.RULES, {
    predicates: normalized.predicates,
    functionals: normalized.functionals,
    cohortRules: normalized.cohortRules,
    selectors: normalized.selectors,
    partialOraclePolicy: normalized.partialOraclePolicy,
    ontologyAxes: normalized.ontologyAxes,
    perturbations: normalized.perturbations,
    candidateAttributes: normalized.candidateAttributes,
    profileDefinition: normalized.profileDefinition
  });
  const sourceMigrationHash = normalized.sourceMigration === undefined
    ? null
    : hashCanonical(HASH_DOMAINS.SOURCE_MIGRATION_BINDING, normalized.sourceMigration);
  const depthBasis = hashCanonical(HASH_DOMAINS.DEPTH_BASIS, {
    primitiveElementIds: normalized.primitives.map((primitive) => primitive.elementId).sort(),
    identityPolicyHash,
    condensationHash: normalized.sourceMigration?.condensation.hash ?? null
  });
  const packageId = hashCanonical(HASH_DOMAINS.PACKAGE, normalized);
  return deepFreeze({
    kind: "loaded-kernel-package",
    schemaVersion: "1",
    packageId,
    normalized,
    predicatePlans: [...compiledExpressions.predicates.values()]
      .sort((left, right) => compareStrings(left.predicateId, right.predicateId)),
    semanticManifest: {
      schemaVersion: "1",
      kernelVersion: kernelVersion.trim(),
      packageId,
      rulesHash,
      depthBasis,
      identityPolicyHash,
      ...(sourceMigrationHash === null ? {} : { sourceMigrationHash })
    }
  });
}

export const PACKAGE_DEFAULTS = deepFreeze({
  partialOraclePolicy: DEFAULT_PARTIAL_ORACLE_POLICY,
  ontologyAxes: DEFAULT_ONTOLOGY_AXES,
  profileDefinition: DEFAULT_PROFILE_DEFINITION,
  candidateAttributes: DEFAULT_CANDIDATE_ATTRIBUTES,
  identityPolicy: DEFAULT_IDENTITY_POLICY
});
