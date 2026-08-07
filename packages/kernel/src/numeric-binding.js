import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { DECIMAL_ARITHMETIC_VERSION, normalizePrecisionPolicy } from "./decimal.js";
import { KernelError } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  PREDICATE_EXPRESSION_ANALYZER_VERSION,
  PREDICATE_PLAN_COMPILER_VERSION,
  analyzePredicateExpression
} from "./predicate-analyzer.js";
import { QUANTITY_COMPARISON_POLICY_VERSION } from "./quantity.js";

export const PREDICATE_NUMERIC_BINDER_VERSION = "predicate-numeric-binding-v1";
export const PREDICATE_NUMERIC_BINDING_LIMITS = deepFreeze({
  maxOperations: 10_000
});

const SEMANTIC_POLICIES = new Set(["require-equal", "ignore"]);
const PLAN_FIELDS = new Set([
  "schemaVersion",
  "compiler",
  "planHash",
  "predicateId",
  "phase",
  "referencesDepth",
  "monotoneViolation",
  "expressionAnalysisHash",
  "pruning",
  "expressionHash",
  "expression",
  "requirements",
  "symbols",
  "truthPersistence",
  "partialDetectability",
  "statistics"
]);
const POLICY_ORDER = Object.freeze([
  "arithmetic",
  "precision",
  "quantityComparison",
  "summation"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "NUMERIC_BIND", message, details });
}

function simplifiedSymbol(descriptor) {
  if (!isObject(descriptor) || typeof descriptor.kind !== "string") {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan contains invalid symbol metadata.", {
      descriptor
    });
  }
  if (descriptor.kind === "quantity") {
    return {
      kind: "quantity",
      unit: descriptor.unit,
      ...(descriptor.semantic === undefined ? {} : { semantic: descriptor.semantic })
    };
  }
  return { kind: descriptor.kind };
}

function simplifiedRegistry(registry) {
  if (!isObject(registry)) {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan symbol registry must be an object.");
  }
  return Object.fromEntries(
    Object.keys(registry).sort().map((name) => [name, simplifiedSymbol(registry[name])])
  );
}

function analysisEnvironment(plan) {
  return {
    invariants: simplifiedRegistry(plan.symbols?.invariants),
    attributes: simplifiedRegistry(plan.symbols?.attributes),
    perturbations: plan.requirements?.perturbations,
    substructurePolicies: plan.requirements?.substructurePolicies
  };
}

function assertPredicatePlan(plan) {
  if (!isObject(plan)) {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Numeric policy binding requires a compiled predicate plan.");
  }
  const fields = Object.keys(plan);
  const unknown = fields.filter((field) => !PLAN_FIELDS.has(field));
  const missing = [...PLAN_FIELDS].filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan fields do not match the supported compiler contract.", {
      unknown,
      missing
    });
  }
  if (plan.schemaVersion !== "1" || plan.compiler !== PREDICATE_PLAN_COMPILER_VERSION) {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan version is not supported by the numeric binder.", {
      schemaVersion: plan.schemaVersion,
      compiler: plan.compiler
    });
  }
  if (
    typeof plan.predicateId !== "string" ||
    plan.predicateId.length === 0 ||
    plan.predicateId !== plan.predicateId.trim() ||
    !new Set(["formation", "maintenance", "termination"]).has(plan.phase) ||
    !new Set(["below", "self"]).has(plan.referencesDepth) ||
    typeof plan.monotoneViolation !== "boolean"
  ) {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan metadata is not a valid compiler output.");
  }

  const expressionHash = hashCanonical(HASH_DOMAINS.PREDICATE_EXPRESSION, plan.expression);
  if (expressionHash !== plan.expressionHash) {
    fail("NUMERIC_BINDING_PLAN_HASH_MISMATCH", "Predicate expression does not match its declared hash.", {
      expected: expressionHash,
      actual: plan.expressionHash
    });
  }

  let analysis;
  try {
    analysis = analyzePredicateExpression(plan.expression, {
      environment: analysisEnvironment(plan)
    });
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan cannot be reproduced by the supported analyzer.", {
      causeCode: error.code
    });
  }
  if (
    analysis.analyzer !== PREDICATE_EXPRESSION_ANALYZER_VERSION ||
    analysis.analysisHash !== plan.expressionAnalysisHash ||
    analysis.expressionHash !== plan.expressionHash
  ) {
    fail("NUMERIC_BINDING_PLAN_HASH_MISMATCH", "Predicate analysis does not match the compiled plan.", {
      expected: analysis.analysisHash,
      actual: plan.expressionAnalysisHash
    });
  }

  for (const [field, expected, actual] of [
    ["expression", analysis.expression, plan.expression],
    ["requirements", analysis.requirements, plan.requirements],
    ["symbols", analysis.symbols, plan.symbols],
    ["truthPersistence", analysis.truthPersistence, plan.truthPersistence],
    ["partialDetectability", analysis.partialDetectability, plan.partialDetectability],
    ["statistics", analysis.statistics, plan.statistics]
  ]) {
    if (canonicalize(expected) !== canonicalize(actual)) {
      fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate plan analysis witness is internally inconsistent.", {
        field
      });
    }
  }

  const staticFailurePersistence = analysis.truthPersistence.fail;
  const partialFailureDetectable = analysis.partialDetectability.fail;
  const eligibility = plan.monotoneViolation === false
    ? "disabled"
    : staticFailurePersistence !== "proven"
      ? "blocked-unproven"
      : partialFailureDetectable
        ? "static-proven"
        : "blocked-partial-data";
  const expectedPruning = {
    declared: plan.monotoneViolation,
    staticFailurePersistence,
    partialFailureDetectable,
    auditRequired: plan.monotoneViolation,
    eligibility
  };
  if (canonicalize(expectedPruning) !== canonicalize(plan.pruning)) {
    fail("NUMERIC_BINDING_PLAN_INVALID", "Predicate pruning metadata cannot be reproduced from its analysis.");
  }

  const planBasis = {
    schemaVersion: plan.schemaVersion,
    compiler: plan.compiler,
    predicateId: plan.predicateId,
    phase: plan.phase,
    referencesDepth: plan.referencesDepth,
    monotoneViolation: plan.monotoneViolation,
    expressionAnalysisHash: plan.expressionAnalysisHash,
    pruning: plan.pruning
  };
  const planHash = hashCanonical(HASH_DOMAINS.PREDICATE_PLAN, planBasis);
  if (planHash !== plan.planHash) {
    fail("NUMERIC_BINDING_PLAN_HASH_MISMATCH", "Predicate plan metadata does not match its declared hash.", {
      expected: planHash,
      actual: plan.planHash
    });
  }
  return { analysis, environment: analysisEnvironment(plan) };
}

function orderedPolicyRefs(...refs) {
  const requested = new Set(refs);
  return POLICY_ORDER.filter((entry) => requested.has(entry));
}

function addOperation(operations, path, operation, ...policyRefs) {
  if (operations.length >= PREDICATE_NUMERIC_BINDING_LIMITS.maxOperations) {
    fail("NUMERIC_BINDING_OPERATION_LIMIT", "Predicate numeric operation count exceeds the binding limit.", {
      maximum: PREDICATE_NUMERIC_BINDING_LIMITS.maxOperations,
      path
    });
  }
  operations.push({ path, operation, policyRefs: orderedPolicyRefs(...policyRefs) });
}

function collectValueOperations(expression, path, operations) {
  if (expression.kind === "add" || expression.kind === "multiply") {
    const field = expression.kind === "add" ? "terms" : "factors";
    expression[field].forEach((child, index) => {
      collectValueOperations(child, `${path}.${field}[${index}]`, operations);
    });
    addOperation(
      operations,
      path,
      expression.kind === "add" ? "value-add" : "value-multiply",
      "arithmetic"
    );
  } else if (expression.kind === "sum") {
    addOperation(operations, path, "value-sum", "arithmetic", "summation");
  }
}

function numericResult(expression, environment) {
  const result = analyzeValueExpression(expression, { environment }).result;
  return result.kind === "number" || result.kind === "quantity" ? result : null;
}

function collectPredicateOperations(expression, path, operations, valueEnvironment) {
  if (expression.op === "all" || expression.op === "any") {
    expression.args.forEach((child, index) => {
      collectPredicateOperations(child, `${path}.args[${index}]`, operations, valueEnvironment);
    });
    return;
  }
  if (expression.op === "not") {
    collectPredicateOperations(expression.arg, `${path}.arg`, operations, valueEnvironment);
    return;
  }
  if (expression.op === "compare") {
    const left = numericResult(expression.left, valueEnvironment);
    const right = numericResult(expression.right, valueEnvironment);
    if (left !== null && right !== null) {
      collectValueOperations(expression.left, `${path}.left`, operations);
      collectValueOperations(expression.right, `${path}.right`, operations);
      const quantityComparison = left.kind === "quantity" || right.kind === "quantity";
      addOperation(
        operations,
        path,
        quantityComparison ? "quantity-compare" : "numeric-compare",
        "arithmetic",
        "precision",
        ...(quantityComparison ? ["quantityComparison"] : [])
      );
    }
    return;
  }
  if (expression.op === "balance") {
    addOperation(
      operations,
      path,
      "balance",
      "arithmetic",
      "precision",
      "quantityComparison",
      "summation"
    );
    return;
  }
  if (
    expression.op === "minimal" ||
    expression.op === "novel" ||
    expression.op === "stableUnder" ||
    expression.op === "irreducibleRemoval"
  ) {
    collectPredicateOperations(
      expression.predicate,
      `${path}.predicate`,
      operations,
      valueEnvironment
    );
    if (expression.op === "stableUnder") {
      addOperation(operations, path, "stability-threshold", "arithmetic", "precision");
    }
  }
}

export function bindPredicateNumericPolicy(plan, precisionPolicy, options = {}) {
  if (!isObject(options)) throw new TypeError("Numeric binding options must be an object.");
  let clonedPlan;
  let clonedOptions;
  try {
    clonedPlan = canonicalClone(plan);
    clonedOptions = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("NUMERIC_BINDING_INPUT_INVALID", "Numeric binding input is not canonicalizable.", {
      causeCode: error.code
    });
  }
  if (Object.keys(clonedOptions).some((field) => field !== "semanticPolicy")) {
    throw new TypeError("Unknown numeric binding option.");
  }
  const semanticPolicy = clonedOptions.semanticPolicy === undefined
    ? "require-equal"
    : clonedOptions.semanticPolicy;
  if (!SEMANTIC_POLICIES.has(semanticPolicy)) {
    fail("NUMERIC_BINDING_POLICY_INVALID", "Unknown quantity semantic comparison policy.", {
      semanticPolicy
    });
  }

  const normalizedPrecision = normalizePrecisionPolicy(precisionPolicy);
  const { analysis, environment } = assertPredicatePlan(clonedPlan);
  const valueEnvironment = {
    invariants: environment.invariants,
    attributes: environment.attributes
  };
  const operations = [];
  collectPredicateOperations(analysis.expression, "$", operations, valueEnvironment);
  operations.sort((left, right) => {
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    return left.operation < right.operation ? -1 : left.operation > right.operation ? 1 : 0;
  });

  const numericPolicy = {
    arithmetic: DECIMAL_ARITHMETIC_VERSION,
    precision: normalizedPrecision,
    roundingBoundary: "value-expression-result-v1",
    summation: {
      algorithm: normalizedPrecision.summation,
      termOrder: "canonical-selection-order-v1"
    },
    quantityComparison: {
      version: QUANTITY_COMPARISON_POLICY_VERSION,
      semanticPolicy,
      toleranceCombination: "maximum-declared-bound-v1",
      boundary: "closed"
    }
  };
  const basis = {
    schemaVersion: "1",
    binder: PREDICATE_NUMERIC_BINDER_VERSION,
    predicatePlanHash: clonedPlan.planHash,
    expressionHash: clonedPlan.expressionHash,
    numericPolicy,
    operations
  };
  return deepFreeze({
    ...basis,
    bindingHash: hashCanonical(HASH_DOMAINS.PREDICATE_NUMERIC_BINDING, basis)
  });
}
