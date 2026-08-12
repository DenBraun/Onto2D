import { canonicalClone, deepFreeze } from "./canonical.js";
import { DECIMAL_ARITHMETIC_VERSION, normalizePrecisionPolicy } from "./decimal.js";
import { KernelError } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyPredicatePlan } from "./predicate-plan-verifier.js";
import { QUANTITY_COMPARISON_POLICY_VERSION } from "./quantity.js";

export const PREDICATE_NUMERIC_BINDER_VERSION = "predicate-numeric-binding-v1";
export const PREDICATE_NUMERIC_BINDING_LIMITS = deepFreeze({
  maxOperations: 10_000
});

const SEMANTIC_POLICIES = new Set(["require-equal", "ignore"]);
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
  } else if (
    expression.kind === "invariant" &&
    expression.profileAggregation !== undefined
  ) {
    addOperation(
      operations,
      path,
      "profile-invariant-arithmetic-mean",
      "arithmetic",
      "precision"
    );
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
  let verified;
  try {
    verified = verifyPredicatePlan(clonedPlan);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    const code = error.code === "PREDICATE_PLAN_HASH_MISMATCH"
      ? "NUMERIC_BINDING_PLAN_HASH_MISMATCH"
      : "NUMERIC_BINDING_PLAN_INVALID";
    fail(code, "Numeric policy binding rejected the predicate plan.", {
      causeCode: error.code,
      ...error.details
    });
  }
  const { analysis, environment } = verified;
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
