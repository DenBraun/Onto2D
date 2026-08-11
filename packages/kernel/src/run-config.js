import { canonicalClone, deepFreeze } from "./canonical.js";
import { normalizePrecisionPolicy } from "./decimal.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { normalizeGraphCanonicalizationOptions } from "./graph-canonicalizer.js";

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "countingDomain",
  "sourceDepths",
  "reportAxes",
  "roleAlphabet",
  "budget",
  "seed",
  "invariantPrecision",
  "graphPolicy",
  "substructurePolicy",
  "nullModels",
  "ontologyTarget",
  "evidencePolicy",
  "indeterminateThreshold",
  "levelBoundaryPolicy",
  "boundedFixpoint"
]);
const REQUIRED_ROOT_FIELDS = Object.freeze([
  "schemaVersion",
  "countingDomain",
  "sourceDepths",
  "reportAxes",
  "roleAlphabet",
  "seed",
  "invariantPrecision",
  "graphPolicy",
  "substructurePolicy",
  "nullModels",
  "evidencePolicy",
  "indeterminateThreshold"
]);
const BUDGET_FIELDS = new Set([
  "maxNodes",
  "maxEdges",
  "maxCandidates",
  "perturbationSamples",
  "nullModelRuns",
  "maxWallTimeMs",
  "maxResidentBytes"
]);
const GRAPH_POLICY_FIELDS = Object.freeze([
  "connected",
  "allowParallelEdges",
  "allowSelfLoops",
  "connectivityProjection",
  "structuralNodeAttributes",
  "structuralEdgeAttributes"
]);
const SUBSTRUCTURE_FIELDS = new Set([
  "id",
  "remove",
  "includeDisconnected",
  "includeEmpty",
  "retainIsolatedNodes"
]);
const ONTOLOGY_FIELDS = new Set(["level", "phase", "segment"]);
const LEVEL_BOUNDARY_FIELDS = new Set([
  "enabled",
  "searchIntervals",
  "maximumCollapseError",
  "tieTolerance"
]);
const SEARCH_INTERVAL_FIELDS = new Set(["fromDepth", "toDepth"]);
const BOUNDED_FIXPOINT_FIELDS = new Set(["enabled", "maxIterations"]);
const COUNTING_DOMAINS = new Set(["profile-quotient", "element-exact", "single-candidate"]);
const SOURCE_DEPTH_POLICIES = new Set(["all-below", "previous-only"]);
const REPORT_AXES = new Set([
  "derivation-depth",
  "ontology-level",
  "ontology-phase",
  "catalogue-level",
  "catalogue-phase",
  "predicate-phase"
]);
const NULL_MODELS = new Set(["role-shuffle", "degree-rewire", "uniform"]);
const EVIDENCE_POLICIES = new Set(["require-all", "allow-declared"]);
const REMOVAL_POLICIES = new Set(["nodes", "edges", "nodes-and-edges"]);
const ONTOLOGY_PHASE = /^(?:A|B|C|D|custom:[A-Za-z0-9][A-Za-z0-9._-]*)$/;

export const RUN_CONFIG_NORMALIZER_VERSION = "run-config-normalizer-v1";

export const DEFAULT_RUN_BUDGET = deepFreeze({
  maxNodes: 4,
  maxEdges: "n+2",
  maxCandidates: 1_000_000,
  perturbationSamples: 200,
  nullModelRuns: 500
});

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, code, path, message, details) {
  issues.push(validationIssue(code, path, message, details));
}

function rejectUnknownFields(value, allowed, path, issues) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(issues, "RUN_CONFIG_FIELD_UNKNOWN", `${path}.${key}`, "Unknown run-configuration field.", { key });
    }
  }
}

function requireFields(value, fields, path, issues) {
  if (!isObject(value)) return;
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      addIssue(issues, "RUN_CONFIG_FIELD_REQUIRED", `${path}.${field}`, "Required run-configuration field is missing.", {
        field
      });
    }
  }
}

function requireIdentifier(value, path, issues) {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    addIssue(issues, "RUN_CONFIG_IDENTIFIER_INVALID", path, "Expected a normalized non-empty string.", { value });
    return false;
  }
  return true;
}

function normalizeEnum(value, allowed, path, issues, code) {
  if (!allowed.has(value)) {
    addIssue(issues, code, path, "Value is not part of the supported run-configuration vocabulary.", { value });
  }
  return value;
}

function normalizeStringSet(value, path, issues, { allowed, nonempty = false } = {}) {
  if (!Array.isArray(value)) {
    addIssue(issues, "RUN_CONFIG_ARRAY_INVALID", path, "Expected an array.", { value });
    return [];
  }
  if (nonempty && value.length === 0) {
    addIssue(issues, "RUN_CONFIG_ARRAY_EMPTY", path, "Array must contain at least one item.");
  }
  const result = [];
  const seen = new Set();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!requireIdentifier(entry, entryPath, issues)) return;
    if (allowed !== undefined && !allowed.has(entry)) {
      addIssue(issues, "RUN_CONFIG_ARRAY_VALUE_INVALID", entryPath, "Array entry is not part of the supported vocabulary.", {
        value: entry
      });
      return;
    }
    if (seen.has(entry)) {
      addIssue(issues, "RUN_CONFIG_ARRAY_VALUE_DUPLICATE", entryPath, "Array entries must be unique.", { value: entry });
      return;
    }
    seen.add(entry);
    result.push(entry);
  });
  return result.sort(compareStrings);
}

function validateSafeInteger(value, path, issues, { minimum, maximum = Number.MAX_SAFE_INTEGER, code }) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    addIssue(issues, code, path, "Integer run budget is outside its supported range.", {
      value,
      minimum,
      maximum
    });
    return false;
  }
  return true;
}

function normalizeBudget(value, issues) {
  if (value === undefined) return { ...DEFAULT_RUN_BUDGET };
  if (!isObject(value)) {
    addIssue(issues, "RUN_CONFIG_BUDGET_INVALID", "$input.budget", "Run budget must be an object.", { value });
    return { ...DEFAULT_RUN_BUDGET };
  }
  rejectUnknownFields(value, BUDGET_FIELDS, "$input.budget", issues);
  const budget = { ...DEFAULT_RUN_BUDGET, ...value };
  validateSafeInteger(budget.maxNodes, "$input.budget.maxNodes", issues, {
    minimum: 1,
    maximum: 6,
    code: "RUN_CONFIG_MAX_NODES_INVALID"
  });
  if (budget.maxEdges !== "n+2") {
    validateSafeInteger(budget.maxEdges, "$input.budget.maxEdges", issues, {
      minimum: 0,
      code: "RUN_CONFIG_MAX_EDGES_INVALID"
    });
  }
  validateSafeInteger(budget.maxCandidates, "$input.budget.maxCandidates", issues, {
    minimum: 1,
    code: "RUN_CONFIG_MAX_CANDIDATES_INVALID"
  });
  validateSafeInteger(budget.perturbationSamples, "$input.budget.perturbationSamples", issues, {
    minimum: 0,
    code: "RUN_CONFIG_PERTURBATION_SAMPLES_INVALID"
  });
  validateSafeInteger(budget.nullModelRuns, "$input.budget.nullModelRuns", issues, {
    minimum: 0,
    code: "RUN_CONFIG_NULL_MODEL_RUNS_INVALID"
  });
  for (const field of ["maxWallTimeMs", "maxResidentBytes"]) {
    if (budget[field] !== undefined) {
      validateSafeInteger(budget[field], `$input.budget.${field}`, issues, {
        minimum: 1,
        code: "RUN_CONFIG_RESOURCE_BUDGET_INVALID"
      });
    }
  }
  return {
    maxNodes: budget.maxNodes,
    maxEdges: budget.maxEdges,
    maxCandidates: budget.maxCandidates,
    perturbationSamples: budget.perturbationSamples,
    nullModelRuns: budget.nullModelRuns,
    ...(budget.maxWallTimeMs === undefined ? {} : { maxWallTimeMs: budget.maxWallTimeMs }),
    ...(budget.maxResidentBytes === undefined ? {} : { maxResidentBytes: budget.maxResidentBytes })
  };
}

function normalizeGraphPolicy(value, issues) {
  if (!isObject(value)) {
    addIssue(issues, "RUN_CONFIG_GRAPH_POLICY_INVALID", "$input.graphPolicy", "Graph policy must be an object.", {
      value
    });
    return normalizeGraphCanonicalizationOptions().policy;
  }
  requireFields(value, GRAPH_POLICY_FIELDS, "$input.graphPolicy", issues);
  try {
    return normalizeGraphCanonicalizationOptions({ policy: value }).policy;
  } catch (error) {
    if (!(error instanceof KernelValidationError)) throw error;
    for (const entry of error.issues) {
      const prefix = "$options.policy";
      const path = entry.path.startsWith(prefix)
        ? `$input.graphPolicy${entry.path.slice(prefix.length)}`
        : entry.path;
      addIssue(issues, entry.code, path, entry.message, entry.details);
    }
    return normalizeGraphCanonicalizationOptions().policy;
  }
}

function normalizePrecision(value, issues) {
  try {
    return normalizePrecisionPolicy(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    addIssue(
      issues,
      error.code,
      "$input.invariantPrecision",
      "Invariant precision policy failed normalization.",
      error.details
    );
    return null;
  }
}

function normalizeSubstructurePolicy(value, issues) {
  const fallback = {
    id: "invalid",
    remove: "nodes",
    includeDisconnected: false,
    includeEmpty: false,
    retainIsolatedNodes: false
  };
  if (!isObject(value)) {
    addIssue(issues, "RUN_CONFIG_SUBSTRUCTURE_POLICY_INVALID", "$input.substructurePolicy", "Substructure policy must be an object.", {
      value
    });
    return fallback;
  }
  rejectUnknownFields(value, SUBSTRUCTURE_FIELDS, "$input.substructurePolicy", issues);
  requireFields(value, SUBSTRUCTURE_FIELDS, "$input.substructurePolicy", issues);
  requireIdentifier(value.id, "$input.substructurePolicy.id", issues);
  normalizeEnum(
    value.remove,
    REMOVAL_POLICIES,
    "$input.substructurePolicy.remove",
    issues,
    "RUN_CONFIG_SUBSTRUCTURE_REMOVAL_INVALID"
  );
  for (const field of ["includeDisconnected", "includeEmpty", "retainIsolatedNodes"]) {
    if (typeof value[field] !== "boolean") {
      addIssue(
        issues,
        "RUN_CONFIG_SUBSTRUCTURE_FLAG_INVALID",
        `$input.substructurePolicy.${field}`,
        "Substructure policy flags must be boolean.",
        { value: value[field] }
      );
    }
  }
  return {
    id: value.id,
    remove: value.remove,
    includeDisconnected: value.includeDisconnected,
    includeEmpty: value.includeEmpty,
    retainIsolatedNodes: value.retainIsolatedNodes
  };
}

function normalizeOntologyTarget(value, issues) {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    addIssue(issues, "RUN_CONFIG_ONTOLOGY_TARGET_INVALID", "$input.ontologyTarget", "Ontology target must be an object.", {
      value
    });
    return undefined;
  }
  rejectUnknownFields(value, ONTOLOGY_FIELDS, "$input.ontologyTarget", issues);
  requireFields(value, ["level"], "$input.ontologyTarget", issues);
  validateSafeInteger(value.level, "$input.ontologyTarget.level", issues, {
    minimum: 0,
    code: "RUN_CONFIG_ONTOLOGY_LEVEL_INVALID"
  });
  if (value.phase !== undefined && (typeof value.phase !== "string" || !ONTOLOGY_PHASE.test(value.phase))) {
    addIssue(issues, "RUN_CONFIG_ONTOLOGY_PHASE_INVALID", "$input.ontologyTarget.phase", "Ontology phase is invalid.", {
      value: value.phase
    });
  }
  if (value.segment !== undefined) requireIdentifier(value.segment, "$input.ontologyTarget.segment", issues);
  return {
    level: value.level,
    ...(value.phase === undefined ? {} : { phase: value.phase }),
    ...(value.segment === undefined ? {} : { segment: value.segment })
  };
}

function validateRatio(value, path, issues, code) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    addIssue(issues, code, path, "Expected a finite ratio in the closed interval [0, 1].", { value });
    return false;
  }
  return true;
}

function normalizeLevelBoundaryPolicy(value, issues) {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    addIssue(issues, "RUN_CONFIG_LEVEL_BOUNDARY_INVALID", "$input.levelBoundaryPolicy", "Level-boundary policy must be an object.", {
      value
    });
    return undefined;
  }
  rejectUnknownFields(value, LEVEL_BOUNDARY_FIELDS, "$input.levelBoundaryPolicy", issues);
  requireFields(value, ["enabled", "maximumCollapseError", "tieTolerance"], "$input.levelBoundaryPolicy", issues);
  if (typeof value.enabled !== "boolean") {
    addIssue(issues, "RUN_CONFIG_LEVEL_BOUNDARY_FLAG_INVALID", "$input.levelBoundaryPolicy.enabled", "Level-boundary enabled flag must be boolean.", {
      value: value.enabled
    });
  }
  validateRatio(
    value.maximumCollapseError,
    "$input.levelBoundaryPolicy.maximumCollapseError",
    issues,
    "RUN_CONFIG_COLLAPSE_ERROR_INVALID"
  );
  if (typeof value.tieTolerance !== "number" || !Number.isFinite(value.tieTolerance) || value.tieTolerance < 0) {
    addIssue(issues, "RUN_CONFIG_TIE_TOLERANCE_INVALID", "$input.levelBoundaryPolicy.tieTolerance", "Tie tolerance must be finite and non-negative.", {
      value: value.tieTolerance
    });
  }
  let searchIntervals;
  if (value.searchIntervals !== undefined) {
    if (!Array.isArray(value.searchIntervals)) {
      addIssue(issues, "RUN_CONFIG_SEARCH_INTERVALS_INVALID", "$input.levelBoundaryPolicy.searchIntervals", "Search intervals must be an array.");
      searchIntervals = [];
    } else {
      searchIntervals = value.searchIntervals.map((interval, index) => {
        const path = `$input.levelBoundaryPolicy.searchIntervals[${index}]`;
        if (!isObject(interval)) {
          addIssue(issues, "RUN_CONFIG_SEARCH_INTERVAL_INVALID", path, "Search interval must be an object.", { value: interval });
          return { fromDepth: 0, toDepth: 0 };
        }
        rejectUnknownFields(interval, SEARCH_INTERVAL_FIELDS, path, issues);
        requireFields(interval, SEARCH_INTERVAL_FIELDS, path, issues);
        validateSafeInteger(interval.fromDepth, `${path}.fromDepth`, issues, {
          minimum: 0,
          code: "RUN_CONFIG_SEARCH_DEPTH_INVALID"
        });
        validateSafeInteger(interval.toDepth, `${path}.toDepth`, issues, {
          minimum: 0,
          code: "RUN_CONFIG_SEARCH_DEPTH_INVALID"
        });
        if (Number.isSafeInteger(interval.fromDepth) && Number.isSafeInteger(interval.toDepth) && interval.fromDepth > interval.toDepth) {
          addIssue(issues, "RUN_CONFIG_SEARCH_INTERVAL_REVERSED", path, "Search interval start cannot exceed its end.", {
            fromDepth: interval.fromDepth,
            toDepth: interval.toDepth
          });
        }
        return { fromDepth: interval.fromDepth, toDepth: interval.toDepth };
      }).sort((left, right) => left.fromDepth - right.fromDepth || left.toDepth - right.toDepth);
    }
  }
  return {
    enabled: value.enabled,
    ...(searchIntervals === undefined ? {} : { searchIntervals }),
    maximumCollapseError: value.maximumCollapseError,
    tieTolerance: value.tieTolerance
  };
}

function normalizeBoundedFixpoint(value, issues) {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    addIssue(issues, "RUN_CONFIG_BOUNDED_FIXPOINT_INVALID", "$input.boundedFixpoint", "Bounded-fixpoint policy must be an object.", {
      value
    });
    return undefined;
  }
  rejectUnknownFields(value, BOUNDED_FIXPOINT_FIELDS, "$input.boundedFixpoint", issues);
  requireFields(value, BOUNDED_FIXPOINT_FIELDS, "$input.boundedFixpoint", issues);
  if (typeof value.enabled !== "boolean") {
    addIssue(issues, "RUN_CONFIG_BOUNDED_FIXPOINT_FLAG_INVALID", "$input.boundedFixpoint.enabled", "Bounded-fixpoint enabled flag must be boolean.", {
      value: value.enabled
    });
  }
  validateSafeInteger(value.maxIterations, "$input.boundedFixpoint.maxIterations", issues, {
    minimum: 1,
    code: "RUN_CONFIG_MAX_ITERATIONS_INVALID"
  });
  return { enabled: value.enabled, maxIterations: value.maxIterations };
}

export function normalizeRunConfig(input) {
  if (!isObject(input)) {
    throw new KernelValidationError([
      validationIssue("RUN_CONFIG_INVALID", "$input", "Run configuration must be an object.", {
        valueType: input === null ? "null" : typeof input
      })
    ], "Run configuration failed validation.", {
      code: "RUN_CONFIG_VALIDATION_FAILED",
      stage: "NORMALIZE_RUN_CONFIG"
    });
  }
  const value = canonicalClone(input);
  const issues = [];
  rejectUnknownFields(value, ROOT_FIELDS, "$input", issues);
  requireFields(value, REQUIRED_ROOT_FIELDS, "$input", issues);

  if (value.schemaVersion !== "1") {
    addIssue(issues, "RUN_CONFIG_SCHEMA_VERSION_UNSUPPORTED", "$input.schemaVersion", "Only run-configuration schema version 1 is supported.", {
      value: value.schemaVersion
    });
  }
  normalizeEnum(value.countingDomain, COUNTING_DOMAINS, "$input.countingDomain", issues, "RUN_CONFIG_COUNTING_DOMAIN_INVALID");
  normalizeEnum(value.sourceDepths, SOURCE_DEPTH_POLICIES, "$input.sourceDepths", issues, "RUN_CONFIG_SOURCE_DEPTHS_INVALID");
  const reportAxes = normalizeStringSet(value.reportAxes, "$input.reportAxes", issues, {
    allowed: REPORT_AXES,
    nonempty: true
  });
  const roleAlphabet = normalizeStringSet(value.roleAlphabet, "$input.roleAlphabet", issues, { nonempty: true });
  const budget = normalizeBudget(value.budget, issues);
  requireIdentifier(value.seed, "$input.seed", issues);
  const invariantPrecision = value.invariantPrecision === undefined
    ? null
    : normalizePrecision(value.invariantPrecision, issues);
  const graphPolicy = normalizeGraphPolicy(value.graphPolicy, issues);
  const substructurePolicy = normalizeSubstructurePolicy(value.substructurePolicy, issues);
  const nullModels = normalizeStringSet(value.nullModels, "$input.nullModels", issues, { allowed: NULL_MODELS });
  const ontologyTarget = normalizeOntologyTarget(value.ontologyTarget, issues);
  normalizeEnum(value.evidencePolicy, EVIDENCE_POLICIES, "$input.evidencePolicy", issues, "RUN_CONFIG_EVIDENCE_POLICY_INVALID");
  validateRatio(value.indeterminateThreshold, "$input.indeterminateThreshold", issues, "RUN_CONFIG_INDETERMINATE_THRESHOLD_INVALID");
  const levelBoundaryPolicy = normalizeLevelBoundaryPolicy(value.levelBoundaryPolicy, issues);
  const boundedFixpoint = normalizeBoundedFixpoint(value.boundedFixpoint, issues);

  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Run configuration failed validation.", {
      code: "RUN_CONFIG_VALIDATION_FAILED",
      stage: "NORMALIZE_RUN_CONFIG"
    });
  }
  return deepFreeze({
    schemaVersion: "1",
    countingDomain: value.countingDomain,
    sourceDepths: value.sourceDepths,
    reportAxes,
    roleAlphabet,
    budget,
    seed: value.seed,
    invariantPrecision,
    graphPolicy,
    substructurePolicy,
    nullModels,
    ...(ontologyTarget === undefined ? {} : { ontologyTarget }),
    evidencePolicy: value.evidencePolicy,
    indeterminateThreshold: value.indeterminateThreshold,
    ...(levelBoundaryPolicy === undefined ? {} : { levelBoundaryPolicy }),
    ...(boundedFixpoint === undefined ? {} : { boundedFixpoint })
  });
}
