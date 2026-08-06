import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelValidationError, validationIssue } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";

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
  "profileDefinition",
  "identityPolicy"
]);
const ARTIFACT_FIELDS = new Set(["path", "mediaType", "schemaVersion", "bytes", "hash"]);
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
const PROFILE_DEFINITION_FIELDS = new Set(["kind"]);
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
  "sensitivityCoefficients",
  "result",
  "explain",
  "claimRefs"
]);
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

function validateQuantity(quantity, path, issues) {
  if (!requireObject(quantity, path, issues)) return;
  rejectUnknownFields(quantity, QUANTITY_FIELDS, path, issues);
  requireFields(quantity, QUANTITY_FIELDS, path, issues);
  if (!Number.isFinite(quantity.value)) {
    addIssue(issues, "QUANTITY_VALUE_INVALID", `${path}.value`, "Quantity value must be finite.", {
      value: quantity.value
    });
  }
  requireIdentifier(quantity.unit, `${path}.unit`, issues);
  requireString(quantity.semantic, `${path}.semantic`, issues);
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
      requireString(quantity.provenance.method, `${path}.provenance.method`, issues);
    }
    if (quantity.provenance.kind === "oracle") {
      requireString(quantity.provenance.method, `${path}.provenance.method`, issues);
      if (!isContentHash(quantity.provenance.source)) {
        addIssue(issues, "QUANTITY_PROVENANCE_SOURCE_INVALID", `${path}.provenance.source`, "Oracle source hash is invalid.");
      }
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
      if (isObject(entry.normalized) && isObject(entry.quantization) && entry.normalized.unit !== entry.quantization.unit) {
        addIssue(issues, "QUANTITY_UNIT_INCOMPATIBLE", entryPath, "Normalized invariant and quantization must use the same unit in the bootstrap loader.", {
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
    addIssue(issues, "SOURCE_RESOLUTION_FOUNDATION_UNAVAILABLE", path, "Condensed clusters require source-migration reconciliation, which is not implemented in the foundation loader.");
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
    for (const [name, quantity] of Object.entries(primitive.invariants)) {
      requireIdentifier(name, `${path}.invariants.${name}`, issues);
      validateQuantity(quantity, `${path}.invariants.${name}`, issues);
    }
  }
  if (primitive.profile === undefined) {
    addIssue(issues, "PACKAGE_PROFILE_REQUIRED", `${path}.profile`, "Bootstrap loader requires an explicit primitive profile.");
  } else {
    validateProfile(primitive.profile, `${path}.profile`, issues);
  }
}

function validatePredicate(predicate, path, issues) {
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
  if (predicate.referencesDepth !== "below") {
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
  if (!requireObject(specification, path, issues)) return;
  rejectUnknownFields(specification, new Set(["id", "unit", "semantic", "toleranceTarget"]), path, issues);
  requireFields(specification, ["id", "unit", "semantic", "toleranceTarget"], path, issues);
  requireIdentifier(specification.id, `${path}.id`, issues);
  requireIdentifier(specification.unit, `${path}.unit`, issues);
  requireString(specification.semantic, `${path}.semantic`, issues);
  validateTolerance(specification.toleranceTarget, `${path}.toleranceTarget`, issues);
}

function validateFunctional(functional, path, issues) {
  if (!requireObject(functional, path, issues)) return;
  rejectUnknownFields(functional, FUNCTIONAL_FIELDS, path, issues);
  requireFields(functional, FUNCTIONAL_FIELDS, path, issues);
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
    if (isObject(rule.origin) && isObject(rule.width) && rule.origin.unit !== rule.width.unit) {
      addIssue(issues, "QUANTITY_UNIT_INCOMPATIBLE", path, "Invariant-window origin and width must use the same unit in the bootstrap loader.");
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
  rejectUnknownFields(definition, PROFILE_DEFINITION_FIELDS, path, issues);
  requireFields(definition, PROFILE_DEFINITION_FIELDS, path, issues);
  if (definition.kind !== "explicit-only") {
    addIssue(issues, "PACKAGE_PROFILE_DEFINITION_UNAVAILABLE", `${path}.kind`, "Only explicit primitive profiles are available in the current foundation.", {
      value: definition.kind
    });
  }
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
      if (selector.epsilon.unit !== functional.result.unit) {
        addIssue(issues, "QUANTITY_UNIT_INCOMPATIBLE", `$.selectors[${index}].epsilon.unit`, "Selector epsilon and functional result must use the same unit in the bootstrap loader.", {
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
  if (raw.partialOraclePolicy.maximumResidual) {
    check(
      raw.partialOraclePolicy.maximumResidual.provenance.evidence,
      evidence,
      "$.partialOraclePolicy.maximumResidual.provenance.evidence",
      "EVIDENCE_REFERENCE_MISSING"
    );
  }
}

function validatePackage(raw) {
  const issues = [];
  if (!requireObject(raw, "$", issues)) return issues;
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
  validateRegistry(raw.predicates, "$.predicates", issues, validatePredicate);
  validateRegistry(raw.functionals, "$.functionals", issues, validateFunctional);
  validateRegistry(raw.cohortRules, "$.cohortRules", issues, validateCohortRule);
  validateRegistry(raw.selectors, "$.selectors", issues, validateSelector);
  validatePartialOraclePolicy(raw.partialOraclePolicy, "$.partialOraclePolicy", issues);
  validateOntologyAxes(raw.ontologyAxes, "$.ontologyAxes", issues);
  requireArray(raw.perturbations, "$.perturbations", issues);
  validateProfileDefinition(raw.profileDefinition, "$.profileDefinition", issues);
  validateIdentityPolicy(raw.identityPolicy, "$.identityPolicy", issues);
  if (raw.sourceMigration !== undefined) {
    requireObject(raw.sourceMigration, "$.sourceMigration", issues);
    addIssue(issues, "SOURCE_CLASSIFICATION_FOUNDATION_UNAVAILABLE", "$.sourceMigration", "Source migration requires edge reconciliation and condensation validation, which are not implemented in the foundation loader.");
  }

  if (issues.length === 0) validateReferences(raw, issues);
  return issues;
}

function sortedStrings(values) {
  return [...values].sort();
}

function sortedRecord(record, transform = (value) => value) {
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, transform(record[key])]));
}

function normalizeQuantity(quantity) {
  return {
    value: Object.is(quantity.value, -0) ? 0 : quantity.value,
    unit: quantity.unit.trim(),
    tolerance: sortedRecord(quantity.tolerance),
    semantic: quantity.semantic.trim(),
    provenance: {
      ...quantity.provenance,
      evidence: sortedStrings(quantity.provenance.evidence)
    }
  };
}

function quantityIdentity(quantity) {
  return {
    value: quantity.value,
    unit: quantity.unit,
    tolerance: quantity.tolerance,
    semantic: quantity.semantic
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
  return {
    id: specification.id.trim(),
    unit: specification.unit.trim(),
    semantic: specification.semantic.trim(),
    toleranceTarget: sortedRecord(specification.toleranceTarget)
  };
}

function normalizeFunctional(functional) {
  return {
    id: functional.id.trim(),
    expr: functional.expr,
    coefficients: sortedRecord(functional.coefficients, normalizeQuantity),
    sensitivityCoefficients: sortedStrings(functional.sensitivityCoefficients),
    result: normalizeQuantitySpec(functional.result),
    explain: functional.explain.trim(),
    claimRefs: sortedStrings(functional.claimRefs)
  };
}

function normalizeCohortRule(rule) {
  if (rule.kind === "shared-support") {
    return { id: rule.id.trim(), kind: rule.kind, resourceKey: rule.resourceKey };
  }
  if (rule.kind === "profile-role") {
    return { id: rule.id.trim(), kind: rule.kind, roleKey: rule.roleKey };
  }
  if (rule.kind === "invariant-window") {
    return {
      id: rule.id.trim(),
      kind: rule.kind,
      value: rule.value,
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

function normalizeProfile(profile, path, issues) {
  const slots = profile.slots.map((slot) => ({
    role: slot.role.trim(),
    polarity: slot.polarity,
    capacity: { min: slot.capacity.min, max: slot.capacity.max },
    ...(slot.guard === undefined ? {} : { guard: slot.guard })
  })).sort(compareCanonical);
  const invariantVector = profile.invariantVector.map((entry) => ({
    semantic: entry.semantic.trim(),
    normalized: normalizeQuantity(entry.normalized),
    quantization: normalizeQuantity(entry.quantization)
  })).sort((left, right) => compareStrings(left.semantic, right.semantic) || compareCanonical(left, right));
  const normalized = {
    slots,
    invariantVector,
    precisionPolicy: profile.precisionPolicy.trim()
  };
  const identity = {
    slots,
    invariantVector: invariantVector.map((entry) => ({
      semantic: entry.semantic,
      normalized: quantityIdentity(entry.normalized),
      quantization: quantityIdentity(entry.quantization)
    })),
    precisionPolicy: normalized.precisionPolicy
  };
  const hash = hashCanonical(HASH_DOMAINS.PROFILE, identity);
  if (profile.hash !== undefined && profile.hash !== hash) {
    addIssue(issues, "PACKAGE_PROFILE_HASH_MISMATCH", `${path}.hash`, "Declared profile hash does not match normalized profile.", {
      declared: profile.hash,
      computed: hash
    });
  }
  return { ...normalized, hash };
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

function primitiveIdentity(primitive, identityPolicy) {
  const identity = { kind: primitive.kind };
  if (identityPolicy.sourceIdStructural) identity.sourceId = primitive.sourceId;
  if (identityPolicy.ontologyCoordinateStructural) identity.ontologyCoordinate = primitive.ontologyCoordinate || null;
  if (identityPolicy.typeTagsStructural) identity.typeTags = primitive.typeTags;
  if (identityPolicy.invariantsStructural) {
    identity.invariants = sortedRecord(primitive.invariants, quantityIdentity);
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

function normalizePackage(raw, issues) {
  const identityPolicy = { ...DEFAULT_IDENTITY_POLICY, ...raw.identityPolicy };
  const primitives = raw.primitives.map((primitive, index) => {
    const normalized = {
      sourceId: primitive.sourceId.trim(),
      kind: primitive.kind,
      ...(primitive.cluster === undefined ? {} : { cluster: normalizeCluster(primitive.cluster) }),
      ...(primitive.ontologyCoordinate === undefined ? {} : { ontologyCoordinate: primitive.ontologyCoordinate }),
      ...(primitive.axisProvenance === undefined ? {} : { axisProvenance: primitive.axisProvenance }),
      typeTags: sortedStrings(primitive.typeTags),
      invariants: sortedRecord(primitive.invariants, normalizeQuantity),
      profile: normalizeProfile(primitive.profile, `$.primitives[${index}].profile`, issues),
      claimRefs: sortedStrings(primitive.claimRefs)
    };
    return {
      ...normalized,
      elementId: hashCanonical(HASH_DOMAINS.ELEMENT, primitiveIdentity(normalized, identityPolicy))
    };
  }).sort((left, right) => compareStrings(left.elementId, right.elementId) || compareStrings(left.sourceId, right.sourceId));

  const normalized = {
    schemaVersion: "1",
    id: raw.id.trim(),
    version: raw.version.trim(),
    sourceArtifacts: raw.sourceArtifacts.map(normalizeArtifact).sort((left, right) => compareStrings(left.hash, right.hash)),
    ...(raw.sourceMigration === undefined ? {} : { sourceMigration: raw.sourceMigration }),
    evidence: [...raw.evidence].sort((left, right) => compareStrings(left.id, right.id)).map((entry) => ({
      ...entry,
      source: normalizeArtifact(entry.source)
    })),
    claims: [...raw.claims].sort((left, right) => compareStrings(left.id, right.id)).map((entry) => ({
      ...entry,
      evidence: sortedStrings(entry.evidence)
    })),
    primitives,
    predicates: [...raw.predicates].sort((left, right) => compareStrings(left.id, right.id)).map((entry) => ({
      ...entry,
      claimRefs: sortedStrings(entry.claimRefs)
    })),
    functionals: [...raw.functionals].sort((left, right) => compareStrings(left.id, right.id)).map(normalizeFunctional),
    cohortRules: [...raw.cohortRules].sort((left, right) => compareStrings(left.id, right.id)).map(normalizeCohortRule),
    selectors: [...raw.selectors].sort((left, right) => compareStrings(left.id, right.id)).map(normalizeSelector),
    partialOraclePolicy: normalizePartialOraclePolicy(raw.partialOraclePolicy),
    ontologyAxes: {
      ...raw.ontologyAxes,
      phasePrecedence: [...raw.ontologyAxes.phasePrecedence].sort(compareCanonical)
    },
    perturbations: [...raw.perturbations].sort(compareCanonical),
    profileDefinition: raw.profileDefinition,
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
  const cloned = canonicalClone(input);
  const withDefaults = materializeDefaults(cloned);
  const issues = validatePackage(withDefaults);
  if (issues.length > 0) throw new KernelValidationError(issues);

  const normalized = normalizePackage(withDefaults, issues);
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
    profileDefinition: normalized.profileDefinition
  });
  const depthBasis = hashCanonical(HASH_DOMAINS.DEPTH_BASIS, {
    primitiveElementIds: normalized.primitives.map((primitive) => primitive.elementId).sort(),
    identityPolicyHash,
    condensationHash: null
  });
  const packageId = hashCanonical(HASH_DOMAINS.PACKAGE, normalized);
  const kernelVersion = options.kernelVersion === undefined ? "0.1.0" : options.kernelVersion;
  if (typeof kernelVersion !== "string" || kernelVersion.trim().length === 0) {
    throw new TypeError("Kernel version must be a non-empty string.");
  }

  return deepFreeze({
    kind: "loaded-kernel-package",
    schemaVersion: "1",
    packageId,
    normalized,
    semanticManifest: {
      schemaVersion: "1",
      kernelVersion: kernelVersion.trim(),
      packageId,
      rulesHash,
      depthBasis,
      identityPolicyHash
    }
  });
}

export const PACKAGE_DEFAULTS = deepFreeze({
  partialOraclePolicy: DEFAULT_PARTIAL_ORACLE_POLICY,
  ontologyAxes: DEFAULT_ONTOLOGY_AXES,
  profileDefinition: DEFAULT_PROFILE_DEFINITION,
  identityPolicy: DEFAULT_IDENTITY_POLICY
});
