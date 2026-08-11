import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  addDecimals,
  decimalToNumber,
  multiplyDecimals,
  parseDecimal,
  roundDecimal,
  subtractDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { evaluateCanonicalPredicateExpression } from "./graph-predicate-evaluator.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { verifyPredicatePlan } from "./predicate-plan-verifier.js";
import { compareQuantities, normalizeQuantity } from "./quantity.js";

export const LOCAL_PREDICATE_EVALUATOR_VERSION = "local-predicate-evaluator-v1";
export const LOCAL_PREDICATE_EVALUATION_LIMITS = deepFreeze({
  maxValueNodes: 10_000,
  maxSelectionWitnesses: 10_000
});

const GRAPH_OPERATORS = new Set([
  "degree",
  "cycleExists",
  "connected",
  "componentCount",
  "pathExists",
  "countRole"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "EVALUATE_LOCAL_PREDICATE",
    message,
    details
  });
}

function constantMode(value) {
  if (isObject(value)) return "quantity";
  if (typeof value === "number") return "number";
  if (value === null) return "null";
  return typeof value;
}

function inspectValueExpression(expression, path, context) {
  context.valueNodes += 1;
  if (expression.kind === "constant") return constantMode(expression.value);
  if (expression.kind === "count") {
    context.selectionWitnesses += 1;
    if (expression.set.kind === "cycle") {
      context.unsupported.push({
        path: `${path}.set`,
        feature: "cycle-set",
        reason: "cycle-set-selection-not-frozen"
      });
      return null;
    }
    return "number";
  }
  if (expression.kind === "add" || expression.kind === "multiply") {
    const field = expression.kind === "add" ? "terms" : "factors";
    const modes = expression[field].map((child, index) =>
      inspectValueExpression(child, `${path}.${field}[${index}]`, context)
    );
    if (modes.every((mode) => mode === "number")) return "number";
    if (modes.every((mode) => mode !== null)) {
      context.unsupported.push({
        path,
        feature: expression.kind,
        reason: "derived-quantity-tolerance-propagation-not-frozen"
      });
    }
    return null;
  }
  context.unsupported.push({
    path,
    feature: expression.kind,
    reason: {
      invariant: "runtime-invariant-resolution-not-frozen",
      coefficient: "runtime-coefficient-binding-not-frozen",
      sum: "runtime-attribute-value-binding-not-frozen"
    }[expression.kind] || "value-expression-runtime-not-supported"
  });
  return null;
}

function inspectPredicateExpression(expression, path, context) {
  if (expression.op === "all" || expression.op === "any") {
    expression.args.forEach((child, index) => {
      inspectPredicateExpression(child, `${path}.args[${index}]`, context);
    });
    return;
  }
  if (expression.op === "not") {
    inspectPredicateExpression(expression.arg, `${path}.arg`, context);
    return;
  }
  if (GRAPH_OPERATORS.has(expression.op)) return;
  if (expression.op === "compare") {
    const leftMode = inspectValueExpression(expression.left, `${path}.left`, context);
    const rightMode = inspectValueExpression(expression.right, `${path}.right`, context);
    if (
      leftMode !== null &&
      rightMode !== null &&
      leftMode !== rightMode &&
      [leftMode, rightMode].every((mode) => mode === "number" || mode === "quantity")
    ) {
      context.unsupported.push({
        path,
        feature: "compare",
        reason: "implicit-number-quantity-lift-not-frozen"
      });
    }
    return;
  }
  context.unsupported.push({
    path,
    feature: expression.op,
    reason: expression.op === "balance"
      ? "derived-quantity-tolerance-propagation-not-frozen"
      : "substructure-runtime-not-supported"
  });
}

export function localPredicateUnsupportedFeatures(plan) {
  return inspectLocalPredicatePlan(plan).unsupported;
}

function inspectLocalPredicatePlan(plan) {
  const context = {
    unsupported: [],
    valueNodes: 0,
    selectionWitnesses: 0
  };
  inspectPredicateExpression(plan.expression, "$", context);
  return context;
}

export function assertLocalPredicatePlanSupported(plan) {
  const inspection = inspectLocalPredicatePlan(plan);
  if (inspection.unsupported.length > 0) {
    fail(
      "PREDICATE_LOCAL_FEATURE_UNSUPPORTED",
      "Local predicate evaluation reached a runtime feature without a frozen execution contract.",
      { unsupported: inspection.unsupported }
    );
  }
  if (
    inspection.valueNodes > LOCAL_PREDICATE_EVALUATION_LIMITS.maxValueNodes ||
    inspection.selectionWitnesses > LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectionWitnesses
  ) {
    fail(
      "PREDICATE_LOCAL_RESOURCE_LIMIT",
      "Local predicate evaluation exceeds its aggregate value-expression resource limits.",
      {
        valueNodes: inspection.valueNodes,
        selectionWitnesses: inspection.selectionWitnesses,
        limits: LOCAL_PREDICATE_EVALUATION_LIMITS
      }
    );
  }
  return inspection;
}

function verifyNumericBinding(plan, input) {
  let binding;
  try {
    binding = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "LOCAL_PREDICATE_NUMERIC_BINDING_INVALID",
      "Predicate numeric binding is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(binding) || !isObject(binding.numericPolicy)) {
    fail(
      "LOCAL_PREDICATE_NUMERIC_BINDING_INVALID",
      "Predicate numeric binding does not match the runtime contract."
    );
  }

  let reproduced;
  try {
    reproduced = bindPredicateNumericPolicy(
      plan,
      binding.numericPolicy.precision,
      { semanticPolicy: binding.numericPolicy.quantityComparison?.semanticPolicy }
    );
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "LOCAL_PREDICATE_NUMERIC_BINDING_INVALID",
      "Predicate numeric binding cannot be reproduced.",
      { causeCode: error.code }
    );
  }
  if (canonicalize(binding) !== canonicalize(reproduced)) {
    fail(
      "LOCAL_PREDICATE_NUMERIC_BINDING_MISMATCH",
      "Predicate numeric binding differs from its deterministic reproduction.",
      {
        expectedBindingHash: reproduced.bindingHash,
        actualBindingHash: binding.bindingHash
      }
    );
  }
  return reproduced;
}

function selectedNodes(graph, selector) {
  if (selector.kind === "canonical-index") {
    return selector.index < graph.nodes.length ? [selector.index] : [];
  }
  if (selector.kind === "all") return graph.nodes.map((_, index) => index);
  const expected = canonicalize(selector.equals);
  return graph.nodes.flatMap((node, index) => {
    const value = node.attrs?.[selector.attribute];
    const scalar = value === null || ["string", "number", "boolean"].includes(typeof value);
    return scalar && canonicalize(value) === expected ? [index] : [];
  });
}

function selectedEdges(graph, roles) {
  return graph.edges.flatMap((edge, index) =>
    roles === undefined || roles.includes(edge.role) ? [index] : []
  );
}

function evaluateNumberExpression(expression, path, graph) {
  if (expression.kind === "constant") {
    return { exact: parseDecimal(expression.value), selections: [] };
  }
  if (expression.kind === "count") {
    const nodeIndexes = expression.set.kind === "nodes"
      ? selectedNodes(graph, expression.set.selector)
      : undefined;
    const edgeIndexes = expression.set.kind === "edges"
      ? selectedEdges(graph, expression.set.roles)
      : undefined;
    const count = nodeIndexes?.length ?? edgeIndexes.length;
    return {
      exact: parseDecimal(count),
      selections: [{
        expressionPath: path,
        setKind: expression.set.kind,
        count,
        ...(nodeIndexes === undefined ? {} : { nodeIndexes }),
        ...(edgeIndexes === undefined ? {} : { edgeIndexes }),
        ...(expression.set.roles === undefined ? {} : { roles: expression.set.roles })
      }]
    };
  }
  const field = expression.kind === "add" ? "terms" : "factors";
  const children = expression[field].map((child, index) =>
    evaluateNumberExpression(child, `${path}.${field}[${index}]`, graph)
  );
  const operation = expression.kind === "add" ? addDecimals : multiplyDecimals;
  const identity = expression.kind === "add" ? 0 : 1;
  return {
    exact: children.reduce((value, child) => operation(value, child.exact), parseDecimal(identity)),
    selections: children.flatMap((child) => child.selections)
  };
}

function evaluatedNumber(expression, path, graph, precision) {
  const result = evaluateNumberExpression(expression, path, graph);
  return {
    value: {
      kind: "number",
      exact: result.exact,
      rounded: roundDecimal(result.exact, precision)
    },
    selections: result.selections
  };
}

function evaluatedQuantity(expression, precision) {
  const normalized = normalizeQuantity(expression.value);
  const exact = parseDecimal(normalized.value);
  const rounded = roundDecimal(exact, precision);
  return {
    value: {
      kind: "quantity",
      exact,
      rounded,
      quantity: {
        ...normalized,
        value: decimalToNumber(rounded)
      }
    },
    selections: []
  };
}

function evaluatedScalar(expression) {
  return {
    value: {
      kind: constantMode(expression.value),
      value: expression.value
    },
    selections: []
  };
}

function evaluateValue(expression, path, graph, precision) {
  const inspection = { unsupported: [], valueNodes: 0, selectionWitnesses: 0 };
  const mode = inspectValueExpression(expression, path, inspection);
  if (mode === "number") return evaluatedNumber(expression, path, graph, precision);
  if (mode === "quantity") return evaluatedQuantity(expression, precision);
  return evaluatedScalar(expression);
}

function decimalRelation(left, right) {
  const difference = subtractDecimals(left, right);
  const coefficient = BigInt(difference.coefficient);
  return coefficient < 0n ? -1 : coefficient > 0n ? 1 : 0;
}

function relationPass(relation, comparator) {
  return {
    eq: relation === 0,
    ne: relation !== 0,
    lt: relation < 0,
    lte: relation <= 0,
    gt: relation > 0,
    gte: relation >= 0
  }[comparator];
}

function compareValues(left, comparator, right, numericPolicy) {
  if (left.kind !== right.kind) {
    fail(
      "PREDICATE_LOCAL_VALUE_KIND_MISMATCH",
      "Local comparison operands reached runtime with different value kinds.",
      { leftKind: left.kind, rightKind: right.kind }
    );
  }
  if (left.kind === "number") {
    const relation = decimalRelation(left.rounded, right.rounded);
    return {
      pass: relationPass(relation, comparator),
      comparison: { kind: "number", relation }
    };
  }
  if (left.kind === "quantity") {
    const comparison = compareQuantities(
      left.quantity,
      comparator,
      right.quantity,
      { semanticPolicy: numericPolicy.quantityComparison.semanticPolicy }
    );
    return {
      pass: comparison.pass,
      comparison: { kind: "quantity", ...comparison }
    };
  }
  const equal = canonicalize(left.value) === canonicalize(right.value);
  return {
    pass: comparator === "eq" ? equal : !equal,
    comparison: { kind: "scalar", equal }
  };
}

function compareEvaluator(expression, path, context) {
  const left = evaluateValue(
    expression.left,
    `${path}.left`,
    context.graph,
    context.numericPolicy.precision
  );
  const right = evaluateValue(
    expression.right,
    `${path}.right`,
    context.graph,
    context.numericPolicy.precision
  );
  const compared = compareValues(
    left.value,
    expression.comparator,
    right.value,
    context.numericPolicy
  );
  const outcome = compared.pass ? "pass" : "fail";
  return {
    outcome,
    witnesses: [{
      expressionPath: path,
      operator: "compare",
      outcome,
      comparator: expression.comparator,
      left: left.value,
      right: right.value,
      comparison: compared.comparison,
      selections: [...left.selections, ...right.selections]
    }]
  };
}

export function evaluateLocalPredicatePlan(planInput, numericBindingInput, candidate, options = {}) {
  const verified = verifyPredicatePlan(planInput);
  assertLocalPredicatePlanSupported(verified.plan);
  const numericBinding = verifyNumericBinding(verified.plan, numericBindingInput);
  const canonical = canonicalizeCandidate(candidate, options);
  const result = evaluateCanonicalPredicateExpression(verified.analysis.expression, "$", {
    graph: canonical.canonical,
    graphPolicy: canonical.graphPolicy,
    partial: false,
    nodesComplete: true,
    numericPolicy: numericBinding.numericPolicy,
    evaluateCompare: compareEvaluator
  });
  const basis = {
    schemaVersion: "1",
    evaluator: LOCAL_PREDICATE_EVALUATOR_VERSION,
    predicatePlanHash: verified.plan.planHash,
    numericBindingHash: numericBinding.bindingHash,
    candidateId: canonical.candidateId,
    graphPolicy: canonical.graphPolicy,
    outcome: result.outcome,
    witnesses: result.witnesses
  };
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(HASH_DOMAINS.PREDICATE_LOCAL_EVALUATION, basis)
  });
}
