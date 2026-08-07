import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { normalizeQuantity, parseUnitExpression } from "./quantity.js";

export const PREDICATE_EXPRESSION_ANALYZER_VERSION = "typed-predicate-expression-v1";
export const PREDICATE_PLAN_COMPILER_VERSION = "predicate-plan-v1";

export const DEFAULT_PREDICATE_EXPRESSION_LIMITS = deepFreeze({
  maxDepth: 64,
  maxNodes: 10_000,
  maxArgs: 10_000,
  maxRoles: 256,
  maxStringLength: 1_024,
  maxSubstructureNesting: 8
});

const PERSISTENCE = Object.freeze({ PROVEN: "proven", NOT_PROVEN: "not-proven" });
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const COMPARATORS = new Set(["eq", "ne", "lt", "lte", "gt", "gte"]);
const GRAPH_PROJECTIONS = new Set(["directed", "undirected-simple", "undirected-multigraph"]);
const OPERATORS = new Set([
  "all",
  "any",
  "not",
  "degree",
  "cycleExists",
  "connected",
  "componentCount",
  "pathExists",
  "countRole",
  "balance",
  "compare",
  "minimal",
  "novel",
  "stableUnder",
  "irreducibleRemoval"
]);
const OPERATOR_FIELDS = Object.freeze({
  all: new Set(["op", "args"]),
  any: new Set(["op", "args"]),
  not: new Set(["op", "arg"]),
  degree: new Set(["op", "node", "role", "min", "max"]),
  cycleExists: new Set(["op", "roles", "projection", "minLength", "maxLength"]),
  connected: new Set(["op"]),
  componentCount: new Set(["op", "count"]),
  pathExists: new Set(["op", "from", "to", "roles"]),
  countRole: new Set(["op", "role", "min", "max"]),
  balance: new Set(["op", "attribute", "over", "tolerance"]),
  compare: new Set(["op", "left", "comparator", "right"]),
  minimal: new Set(["op", "predicate", "policy"]),
  novel: new Set(["op", "predicate"]),
  stableUnder: new Set(["op", "perturbation", "predicate", "threshold"]),
  irreducibleRemoval: new Set(["op", "predicate", "removal"])
});
const REQUIRED_FIELDS = Object.freeze({
  all: ["op", "args"],
  any: ["op", "args"],
  not: ["op", "arg"],
  degree: ["op", "node"],
  cycleExists: ["op", "projection"],
  connected: ["op"],
  componentCount: ["op", "count"],
  pathExists: ["op", "from", "to"],
  countRole: ["op", "role"],
  balance: ["op", "attribute", "over", "tolerance"],
  compare: ["op", "left", "comparator", "right"],
  minimal: ["op", "predicate"],
  novel: ["op", "predicate"],
  stableUnder: ["op", "perturbation", "predicate", "threshold"],
  irreducibleRemoval: ["op", "predicate", "removal"]
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(context, code, path, message, details = {}) {
  context.issues.push(validationIssue(code, path, message, details));
}

function rejectUnknownFields(context, value, allowed, path) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      addIssue(context, "PREDICATE_TYPE_FIELD_UNKNOWN", `${path}.${field}`, "Unknown predicate-expression field.", { field });
    }
  }
}

function requireFields(context, value, fields, path) {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      addIssue(context, "PREDICATE_TYPE_FIELD_REQUIRED", `${path}.${field}`, "Required predicate-expression field is missing.", { field });
    }
  }
}

function normalizedIdentifier(context, value, path, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > context.limits.maxStringLength
  ) {
    addIssue(context, "PREDICATE_TYPE_IDENTIFIER_INVALID", path, `${label} must be a normalized non-empty string within the configured length limit.`, {
      value,
      maximumLength: context.limits.maxStringLength
    });
    return null;
  }
  return value;
}

function normalizeLimits(input, issues) {
  if (input === undefined) return { ...DEFAULT_PREDICATE_EXPRESSION_LIMITS };
  if (!isObject(input)) {
    issues.push(validationIssue("PREDICATE_TYPE_LIMITS_INVALID", "$.limits", "Predicate-expression limits must be an object."));
    return { ...DEFAULT_PREDICATE_EXPRESSION_LIMITS };
  }
  const result = { ...DEFAULT_PREDICATE_EXPRESSION_LIMITS };
  for (const [field, value] of Object.entries(input)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_PREDICATE_EXPRESSION_LIMITS, field)) {
      issues.push(validationIssue("PREDICATE_TYPE_LIMIT_UNKNOWN", `$.limits.${field}`, "Unknown predicate-expression limit.", { field }));
      continue;
    }
    if (!Number.isSafeInteger(value) || value < 1 || value > DEFAULT_PREDICATE_EXPRESSION_LIMITS[field]) {
      issues.push(validationIssue("PREDICATE_TYPE_LIMIT_INVALID", `$.limits.${field}`, "Predicate-expression limit must be a positive safe integer no greater than the kernel ceiling.", {
        value,
        maximum: DEFAULT_PREDICATE_EXPRESSION_LIMITS[field]
      }));
      continue;
    }
    result[field] = value;
  }
  return result;
}

function rebaseAnalysisIssues(context, error, path, mapIssuePath) {
  if (!(error instanceof KernelValidationError) || error.code !== "EXPRESSION_ANALYSIS_FAILED") throw error;
  for (const entry of error.issues) {
    const coefficientForbidden = entry.code === "EXPRESSION_SYMBOL_UNDECLARED" &&
      entry.details?.registry === "coefficients";
    const issuePath = entry.path.startsWith("$.environment")
      ? entry.path
      : mapIssuePath === undefined
        ? entry.path === "$"
          ? path
          : `${path}${entry.path.slice(1)}`
        : mapIssuePath(entry.path);
    addIssue(
      context,
      coefficientForbidden ? "PREDICATE_TYPE_COEFFICIENT_FORBIDDEN" : `PREDICATE_TYPE_${entry.code}`,
      issuePath,
      coefficientForbidden
        ? "Predicate expressions cannot resolve functional coefficients."
        : entry.message,
      entry.details
    );
  }
}

function normalizeIdentifierRegistry(value, path, context, { optional = false } = {}) {
  if (value === undefined && optional) return null;
  if (!Array.isArray(value)) {
    addIssue(context, "PREDICATE_TYPE_SYMBOL_REGISTRY_INVALID", path, "Predicate identifier registry must be an array.");
    return new Set();
  }
  const result = new Set();
  value.forEach((entry, index) => {
    const id = normalizedIdentifier(context, entry, `${path}[${index}]`, "Registry identifier");
    if (id === null) return;
    if (result.has(id)) {
      addIssue(context, "PREDICATE_TYPE_SYMBOL_DUPLICATE", `${path}[${index}]`, "Predicate identifier registry values must be unique.", { id });
    }
    result.add(id);
  });
  return result;
}

function valueAnalysisLimits(context) {
  return {
    maxDepth: context.limits.maxDepth,
    maxNodes: context.limits.maxNodes,
    maxTerms: context.limits.maxArgs,
    maxRoles: context.limits.maxRoles,
    maxStringLength: context.limits.maxStringLength
  };
}

function normalizeEnvironment(environment, context) {
  if (!isObject(environment)) {
    addIssue(context, "PREDICATE_TYPE_ENVIRONMENT_INVALID", "$.environment", "Predicate-expression environment must be an object.");
    return {
      value: { invariants: {}, attributes: {} },
      perturbations: new Set(),
      substructurePolicies: null
    };
  }
  rejectUnknownFields(
    context,
    environment,
    new Set(["invariants", "attributes", "perturbations", "substructurePolicies"]),
    "$.environment"
  );
  const valueEnvironment = {
    invariants: environment.invariants === undefined ? {} : environment.invariants,
    attributes: environment.attributes === undefined ? {} : environment.attributes
  };
  try {
    analyzeValueExpression({ kind: "constant", value: 0 }, {
      environment: valueEnvironment,
      limits: valueAnalysisLimits(context)
    });
  } catch (error) {
    rebaseAnalysisIssues(context, error, "$.environment");
  }
  return {
    value: valueEnvironment,
    perturbations: normalizeIdentifierRegistry(
      environment.perturbations === undefined ? [] : environment.perturbations,
      "$.environment.perturbations",
      context
    ),
    substructurePolicies: normalizeIdentifierRegistry(
      environment.substructurePolicies,
      "$.environment.substructurePolicies",
      context,
      { optional: true }
    )
  };
}

function mergeSymbolTypes(context, registry, symbols, path) {
  for (const [name, descriptor] of Object.entries(symbols)) {
    const previous = context.symbols[registry][name];
    if (previous !== undefined && canonicalize(previous) !== canonicalize(descriptor)) {
      addIssue(context, "PREDICATE_TYPE_SYMBOL_CONFLICT", path, "Predicate expression infers incompatible types for one symbol.", {
        registry,
        name,
        previous,
        actual: descriptor
      });
    } else if (previous === undefined) {
      context.symbols[registry][name] = descriptor;
    }
  }
}

function mergeValueAnalysis(context, analysis, path, { recordHash = true } = {}) {
  for (const name of analysis.requirements.invariants) context.requirements.invariants.add(name);
  for (const name of analysis.requirements.attributes) context.requirements.attributes.add(name);
  for (const role of analysis.requirements.roles) context.requirements.roles.add(role);
  if (analysis.requirements.coefficients.length > 0) {
    addIssue(context, "PREDICATE_TYPE_COEFFICIENT_FORBIDDEN", path, "Predicate expressions cannot resolve functional coefficients.", {
      coefficients: analysis.requirements.coefficients
    });
  }
  mergeSymbolTypes(context, "invariants", analysis.symbols.invariants, path);
  mergeSymbolTypes(context, "attributes", analysis.symbols.attributes, path);
  if (recordHash) {
    context.requirements.valueExpressionHashes.add(analysis.expressionHash);
    context.statistics.valueExpressions += 1;
  }
}

function analyzeValueAt(expression, path, context, options = {}) {
  try {
    const environment = options.environment === undefined
      ? context.environment.value
      : options.environment;
    const analysis = analyzeValueExpression(expression, {
      environment,
      limits: valueAnalysisLimits(context)
    });
    mergeValueAnalysis(context, analysis, path, options);
    return analysis;
  } catch (error) {
    rebaseAnalysisIssues(context, error, path, options.mapIssuePath);
    return null;
  }
}

function analyzeNodeSelector(selector, path, context) {
  const analysis = analyzeValueAt({
    kind: "count",
    set: { kind: "nodes", selector }
  }, path, context, {
    recordHash: false,
    mapIssuePath: (issuePath) => issuePath === "$" || issuePath === "$.set"
      ? path
      : issuePath.startsWith("$.set.selector")
        ? `${path}${issuePath.slice("$.set.selector".length)}`
        : `${path}${issuePath.slice(1)}`
  });
  return analysis === null ? null : analysis.expression.set.selector;
}

function analyzeSetSelector(selector, path, context) {
  const analysis = analyzeValueAt({ kind: "count", set: selector }, path, context, {
    recordHash: false,
    mapIssuePath: (issuePath) => issuePath === "$" || issuePath === "$.set"
      ? path
      : issuePath.startsWith("$.set")
        ? `${path}${issuePath.slice("$.set".length)}`
        : `${path}${issuePath.slice(1)}`
  });
  return analysis === null ? null : analysis.expression.set;
}

function normalizeRoles(value, path, context) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    addIssue(context, "PREDICATE_TYPE_ROLES_INVALID", path, "Predicate roles must be an array.");
    return null;
  }
  if (value.length > context.limits.maxRoles) {
    addIssue(context, "PREDICATE_TYPE_ROLE_LIMIT", path, "Predicate role count exceeds the configured limit.", {
      count: value.length,
      maximum: context.limits.maxRoles
    });
  }
  const roles = [];
  const seen = new Set();
  value.slice(0, context.limits.maxRoles).forEach((entry, index) => {
    const role = normalizedIdentifier(context, entry, `${path}[${index}]`, "Role");
    if (role === null) return;
    if (seen.has(role)) {
      addIssue(context, "PREDICATE_TYPE_ROLE_DUPLICATE", `${path}[${index}]`, "Predicate roles must be unique.", { role });
      return;
    }
    seen.add(role);
    roles.push(role);
    context.requirements.roles.add(role);
  });
  return roles.sort();
}

function normalizeBound(value, path, context, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_SAFE_INTEGER) {
    addIssue(context, "PREDICATE_TYPE_BOUND_INVALID", path, "Predicate bound must be a safe integer within its permitted range.", {
      value,
      minimum
    });
    return null;
  }
  return value;
}

function normalizeRange(node, path, context, { required = false, minimum = 0, minField = "min", maxField = "max" } = {}) {
  const hasMin = node[minField] !== undefined;
  const hasMax = node[maxField] !== undefined;
  if (required && !hasMin && !hasMax) {
    addIssue(context, "PREDICATE_TYPE_BOUND_REQUIRED", path, "Predicate range requires a lower or upper bound.");
  }
  const min = hasMin ? normalizeBound(node[minField], `${path}.${minField}`, context, { minimum }) : undefined;
  const max = hasMax ? normalizeBound(node[maxField], `${path}.${maxField}`, context, { minimum }) : undefined;
  if (min !== undefined && min !== null && max !== undefined && max !== null && min > max) {
    addIssue(context, "PREDICATE_TYPE_BOUND_ORDER_INVALID", path, "Predicate lower bound cannot exceed its upper bound.", {
      min,
      max
    });
  }
  return {
    ...(min === undefined || min === null ? {} : { [minField]: min }),
    ...(max === undefined || max === null ? {} : { [maxField]: max })
  };
}

function persistence(pass = PERSISTENCE.NOT_PROVEN, fail = PERSISTENCE.NOT_PROVEN) {
  return { pass, fail };
}

function boundedPersistence(range) {
  const hasMin = range.min !== undefined;
  const hasMax = range.max !== undefined;
  if (hasMin && !hasMax) return persistence(PERSISTENCE.PROVEN, PERSISTENCE.NOT_PROVEN);
  if (!hasMin && hasMax) return persistence(PERSISTENCE.NOT_PROVEN, PERSISTENCE.PROVEN);
  return persistence();
}

function boundedDetectability(range, selectorAvailable = true) {
  if (!selectorAvailable) return { pass: false, fail: false };
  const hasMin = range.min !== undefined;
  const hasMax = range.max !== undefined;
  return {
    pass: hasMin && !hasMax,
    fail: !hasMin && hasMax
  };
}

function combinePersistence(children) {
  return persistence(
    children.every((child) => child.persistence.pass === PERSISTENCE.PROVEN)
      ? PERSISTENCE.PROVEN
      : PERSISTENCE.NOT_PROVEN,
    children.every((child) => child.persistence.fail === PERSISTENCE.PROVEN)
      ? PERSISTENCE.PROVEN
      : PERSISTENCE.NOT_PROVEN
  );
}

function combineDetectability(children) {
  return {
    pass: children.every((child) => child.detectability.pass),
    fail: children.every((child) => child.detectability.fail)
  };
}

function result(normalized, truthPersistence, witnessKinds = [], partialDetectability = { pass: false, fail: false }) {
  return {
    normalized,
    persistence: truthPersistence,
    detectability: partialDetectability,
    witnessKinds: new Set(witnessKinds)
  };
}

function mergeWitnesses(context, nodeResult) {
  for (const kind of nodeResult.witnessKinds) context.requirements.witnessKinds.add(kind);
  return nodeResult;
}

function analyzeLogical(expression, path, depth, substructureDepth, context) {
  if (expression.op === "not") {
    const child = analyzeExpression(expression.arg, `${path}.arg`, depth + 1, substructureDepth, context);
    if (child === null) return null;
    return result(
      { op: "not", arg: child.normalized },
      persistence(child.persistence.fail, child.persistence.pass),
      child.witnessKinds,
      { pass: child.detectability.fail, fail: child.detectability.pass }
    );
  }
  const args = expression.args;
  if (!Array.isArray(args) || args.length === 0) {
    addIssue(context, "PREDICATE_TYPE_ARGS_INVALID", `${path}.args`, "Boolean combinator requires a non-empty argument array.");
    return null;
  }
  if (args.length > context.limits.maxArgs) {
    addIssue(context, "PREDICATE_TYPE_ARG_LIMIT", `${path}.args`, "Boolean argument count exceeds the configured limit.", {
      count: args.length,
      maximum: context.limits.maxArgs
    });
  }
  const children = args
    .slice(0, context.limits.maxArgs)
    .map((entry, index) => analyzeExpression(entry, `${path}.args[${index}]`, depth + 1, substructureDepth, context));
  if (children.some((child) => child === null)) return null;
  const normalizedArgs = children.map((child) => child.normalized).sort((left, right) => {
    const a = canonicalize(left);
    const b = canonicalize(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const witnesses = new Set();
  children.forEach((child) => child.witnessKinds.forEach((kind) => witnesses.add(kind)));
  return result(
    { op: expression.op, args: normalizedArgs },
    combinePersistence(children),
    witnesses,
    combineDetectability(children)
  );
}

function analyzeDegree(expression, path, context) {
  const node = analyzeNodeSelector(expression.node, `${path}.node`, context);
  const range = normalizeRange(expression, path, context, { required: true });
  const role = expression.role === undefined
    ? undefined
    : normalizedIdentifier(context, expression.role, `${path}.role`, "Role");
  if (role !== undefined && role !== null) context.requirements.roles.add(role);
  if (node === null || role === null) return null;
  return result({
    op: "degree",
    node,
    ...(role === undefined ? {} : { role }),
    ...range
  }, node.kind === "canonical-index"
    ? persistence()
    : persistence(
      PERSISTENCE.NOT_PROVEN,
      range.min === undefined && range.max !== undefined
        ? PERSISTENCE.PROVEN
        : PERSISTENCE.NOT_PROVEN
    ), ["node", "edge"], {
    pass: false,
    fail: node.kind !== "canonical-index" && range.min === undefined && range.max !== undefined
  });
}

function analyzeCycle(expression, path, context) {
  const roles = normalizeRoles(expression.roles, `${path}.roles`, context);
  if (!GRAPH_PROJECTIONS.has(expression.projection)) {
    addIssue(context, "PREDICATE_TYPE_PROJECTION_INVALID", `${path}.projection`, "Unknown graph projection.", {
      projection: expression.projection
    });
  } else {
    context.requirements.graphProjections.add(expression.projection);
  }
  const lengths = normalizeRange(expression, path, context, {
    minimum: 1,
    minField: "minLength",
    maxField: "maxLength"
  });
  if (roles === null || !GRAPH_PROJECTIONS.has(expression.projection)) return null;
  return result({
    op: "cycleExists",
    ...(roles === undefined ? {} : { roles }),
    projection: expression.projection,
    ...lengths
  }, persistence(PERSISTENCE.PROVEN, PERSISTENCE.NOT_PROVEN), ["cycle", "edge"], {
    pass: true,
    fail: false
  });
}

function analyzePath(expression, path, context) {
  const from = analyzeNodeSelector(expression.from, `${path}.from`, context);
  const to = analyzeNodeSelector(expression.to, `${path}.to`, context);
  const roles = normalizeRoles(expression.roles, `${path}.roles`, context);
  if (from === null || to === null || roles === null) return null;
  const selectorStable = from.kind !== "canonical-index" && to.kind !== "canonical-index";
  return result({
    op: "pathExists",
    from,
    to,
    ...(roles === undefined ? {} : { roles })
  }, persistence(
    selectorStable ? PERSISTENCE.PROVEN : PERSISTENCE.NOT_PROVEN,
    PERSISTENCE.NOT_PROVEN
  ), ["path", "node", "edge"], {
    pass: selectorStable,
    fail: false
  });
}

function analyzeCountRole(expression, path, context) {
  const role = normalizedIdentifier(context, expression.role, `${path}.role`, "Role");
  const range = normalizeRange(expression, path, context, { required: true });
  if (role === null) return null;
  context.requirements.roles.add(role);
  return result(
    { op: "countRole", role, ...range },
    boundedPersistence(range),
    ["edge"],
    boundedDetectability(range)
  );
}

function normalizeTolerance(value, path, context) {
  try {
    const tolerance = normalizeQuantity(value);
    const boundedStrings = [
      [tolerance.semantic, `${path}.semantic`, "Balance tolerance semantic"],
      ...(tolerance.provenance.method === undefined
        ? []
        : [[tolerance.provenance.method, `${path}.provenance.method`, "Balance tolerance method"]]),
      ...tolerance.provenance.evidence.map((entry, index) => [
        entry,
        `${path}.provenance.evidence[${index}]`,
        "Balance tolerance evidence identifier"
      ])
    ];
    let stringsValid = true;
    for (const [entry, entryPath, label] of boundedStrings) {
      if (entry.length <= context.limits.maxStringLength) continue;
      addIssue(context, "PREDICATE_TYPE_STRING_LIMIT", entryPath, `${label} exceeds the configured length limit.`, {
        maximumLength: context.limits.maxStringLength
      });
      stringsValid = false;
    }
    if (tolerance.value < 0) {
      addIssue(context, "PREDICATE_TYPE_TOLERANCE_INVALID", `${path}.value`, "Balance tolerance value must be non-negative.", {
        value: tolerance.value
      });
    }
    return stringsValid ? tolerance : null;
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    addIssue(context, "PREDICATE_TYPE_TOLERANCE_INVALID", path, error.message, {
      causeCode: error.code,
      ...error.details
    });
    return null;
  }
}

function analyzeBalance(expression, path, context) {
  const attribute = normalizedIdentifier(context, expression.attribute, `${path}.attribute`, "Attribute name");
  const tolerance = normalizeTolerance(expression.tolerance, `${path}.tolerance`, context);
  const valueEnvironment = {
    ...context.environment.value,
    attributes: { ...context.environment.value.attributes }
  };
  if (attribute !== null && tolerance !== null && !Object.prototype.hasOwnProperty.call(valueEnvironment.attributes, attribute)) {
    const parsed = parseUnitExpression(tolerance.unit);
    valueEnvironment.attributes[attribute] = parsed.dimensionSignature === "0:0:0:0:0:0:0"
      ? { kind: "number" }
      : { kind: "quantity", unit: tolerance.unit };
  }
  const aggregate = attribute === null
    ? null
    : analyzeValueAt(
      { kind: "sum", attribute, set: expression.over },
      `${path}.over`,
      context,
      {
        recordHash: false,
        environment: valueEnvironment,
        mapIssuePath: (issuePath) => issuePath === "$"
          ? path
          : issuePath.startsWith("$.attribute")
            ? `${path}.attribute${issuePath.slice("$.attribute".length)}`
            : issuePath.startsWith("$.set")
              ? `${path}.over${issuePath.slice("$.set".length)}`
              : `${path}${issuePath.slice(1)}`
      }
    );
  if (attribute === null || tolerance === null || aggregate === null) return null;
  const toleranceUnit = parseUnitExpression(tolerance.unit);
  if (aggregate.result.dimensionSignature !== toleranceUnit.dimensionSignature) {
    addIssue(context, "PREDICATE_TYPE_BALANCE_UNIT_INCOMPATIBLE", `${path}.tolerance.unit`, "Balance attribute and tolerance must have identical dimensions.", {
      attribute,
      attributeUnit: aggregate.result.unit,
      toleranceUnit: tolerance.unit
    });
    return null;
  }
  return result({
    op: "balance",
    attribute,
    over: aggregate.expression.set,
    tolerance
  }, persistence(), ["quantity", "node", "edge"]);
}

function isNumeric(type) {
  return type.kind === "number" || type.kind === "quantity";
}

function analyzeCompare(expression, path, context) {
  const left = analyzeValueAt(expression.left, `${path}.left`, context);
  const right = analyzeValueAt(expression.right, `${path}.right`, context);
  if (!COMPARATORS.has(expression.comparator)) {
    addIssue(context, "PREDICATE_TYPE_COMPARATOR_INVALID", `${path}.comparator`, "Unknown comparison operator.", {
      comparator: expression.comparator
    });
  }
  if (left === null || right === null || !COMPARATORS.has(expression.comparator)) return null;
  const leftNumeric = isNumeric(left.result);
  const rightNumeric = isNumeric(right.result);
  if (leftNumeric !== rightNumeric) {
    addIssue(context, "PREDICATE_TYPE_COMPARE_OPERAND_MISMATCH", path, "Comparison operands must both be numeric or both be the same scalar type.", {
      leftKind: left.result.kind,
      rightKind: right.result.kind
    });
    return null;
  }
  if (leftNumeric) {
    if (left.result.dimensionSignature !== right.result.dimensionSignature) {
      addIssue(context, "PREDICATE_TYPE_COMPARE_UNIT_INCOMPATIBLE", path, "Numeric comparison operands must have identical dimensions.", {
        leftUnit: left.result.unit,
        rightUnit: right.result.unit
      });
      return null;
    }
    if (
      left.result.semantic !== undefined &&
      right.result.semantic !== undefined &&
      left.result.semantic !== right.result.semantic
    ) {
      addIssue(context, "PREDICATE_TYPE_COMPARE_SEMANTIC_INCOMPATIBLE", path, "Numeric comparison operands have incompatible declared semantics.", {
        leftSemantic: left.result.semantic,
        rightSemantic: right.result.semantic
      });
      return null;
    }
  } else {
    if (left.result.kind !== right.result.kind) {
      addIssue(context, "PREDICATE_TYPE_COMPARE_OPERAND_MISMATCH", path, "Scalar comparison operands must have identical types.", {
        leftKind: left.result.kind,
        rightKind: right.result.kind
      });
      return null;
    }
    if (expression.comparator !== "eq" && expression.comparator !== "ne") {
      addIssue(context, "PREDICATE_TYPE_SCALAR_ORDERING_FORBIDDEN", `${path}.comparator`, "Non-numeric scalar operands support only eq and ne.", {
        comparator: expression.comparator,
        kind: left.result.kind
      });
      return null;
    }
  }
  return result({
    op: "compare",
    left: left.expression,
    comparator: expression.comparator,
    right: right.expression
  }, persistence(), leftNumeric ? ["quantity"] : []);
}

function analyzeSubstructure(expression, path, depth, substructureDepth, context) {
  const nextSubstructureDepth = substructureDepth + 1;
  context.statistics.maxSubstructureNesting = Math.max(
    context.statistics.maxSubstructureNesting,
    nextSubstructureDepth
  );
  context.statistics.substructureCombinators += 1;
  if (nextSubstructureDepth > context.limits.maxSubstructureNesting) {
    addIssue(context, "PREDICATE_TYPE_SUBSTRUCTURE_NESTING_LIMIT", path, "Substructure combinator nesting exceeds the configured limit.", {
      depth: nextSubstructureDepth,
      maximum: context.limits.maxSubstructureNesting
    });
    return null;
  }
  const child = analyzeExpression(
    expression.predicate,
    `${path}.predicate`,
    depth + 1,
    nextSubstructureDepth,
    context
  );
  if (child === null) return null;
  const normalized = { op: expression.op };
  if (expression.op === "minimal") {
    if (expression.policy === undefined) {
      context.requirements.usesDefaultSubstructurePolicy = true;
    } else {
      const policy = normalizedIdentifier(context, expression.policy, `${path}.policy`, "Substructure policy");
      if (policy === null) return null;
      if (
        context.environment.substructurePolicies !== null &&
        !context.environment.substructurePolicies.has(policy)
      ) {
        addIssue(context, "PREDICATE_TYPE_SUBSTRUCTURE_POLICY_UNDECLARED", `${path}.policy`, "Substructure policy is not declared in the analysis environment.", { policy });
      }
      context.requirements.substructurePolicies.add(policy);
      normalized.policy = policy;
    }
  }
  if (expression.op === "stableUnder") {
    const perturbation = normalizedIdentifier(context, expression.perturbation, `${path}.perturbation`, "Perturbation");
    if (perturbation === null) return null;
    if (!context.environment.perturbations.has(perturbation)) {
      addIssue(context, "PREDICATE_TYPE_PERTURBATION_UNDECLARED", `${path}.perturbation`, "Perturbation is not declared in the rule package.", { perturbation });
    }
    if (!Number.isFinite(expression.threshold) || expression.threshold < 0 || expression.threshold > 1) {
      addIssue(context, "PREDICATE_TYPE_STABILITY_THRESHOLD_INVALID", `${path}.threshold`, "Stability threshold must be finite and between zero and one.", {
        value: expression.threshold
      });
    }
    context.requirements.perturbations.add(perturbation);
    normalized.perturbation = perturbation;
    normalized.threshold = Object.is(expression.threshold, -0) ? 0 : expression.threshold;
  }
  if (expression.op === "irreducibleRemoval") {
    if (expression.removal !== "node" && expression.removal !== "edge") {
      addIssue(context, "PREDICATE_TYPE_REMOVAL_INVALID", `${path}.removal`, "Irreducible-removal mode must be node or edge.", {
        removal: expression.removal
      });
    } else {
      normalized.removal = expression.removal;
    }
  }
  normalized.predicate = child.normalized;
  const witnesses = new Set(child.witnessKinds);
  witnesses.add(expression.op === "stableUnder" ? "perturbation" : "substructure");
  return result(normalized, persistence(), witnesses);
}

function analyzeExpression(expression, path, depth, substructureDepth, context) {
  context.statistics.nodes += 1;
  context.statistics.maxDepth = Math.max(context.statistics.maxDepth, depth);
  if (context.statistics.nodes > context.limits.maxNodes) {
    if (!context.nodeLimitReported) {
      addIssue(context, "PREDICATE_TYPE_NODE_LIMIT", path, "Predicate expression exceeds the configured node limit.", {
        maximum: context.limits.maxNodes
      });
      context.nodeLimitReported = true;
    }
    return null;
  }
  if (depth > context.limits.maxDepth) {
    addIssue(context, "PREDICATE_TYPE_DEPTH_LIMIT", path, "Predicate expression exceeds the configured depth limit.", {
      depth,
      maximum: context.limits.maxDepth
    });
    return null;
  }
  if (!isObject(expression)) {
    addIssue(context, "PREDICATE_TYPE_NODE_INVALID", path, "Predicate-expression node must be an object.");
    return null;
  }
  if (!OPERATORS.has(expression.op)) {
    addIssue(context, "PREDICATE_TYPE_OPERATOR_INVALID", `${path}.op`, "Unknown predicate-expression operator.", {
      op: expression.op
    });
    return null;
  }
  context.requirements.operators.add(expression.op);
  rejectUnknownFields(context, expression, OPERATOR_FIELDS[expression.op], path);
  requireFields(context, expression, REQUIRED_FIELDS[expression.op], path);

  let nodeResult;
  if (expression.op === "all" || expression.op === "any" || expression.op === "not") {
    nodeResult = analyzeLogical(expression, path, depth, substructureDepth, context);
  } else if (expression.op === "degree") {
    nodeResult = analyzeDegree(expression, path, context);
  } else if (expression.op === "cycleExists") {
    nodeResult = analyzeCycle(expression, path, context);
  } else if (expression.op === "connected") {
    nodeResult = result({ op: "connected" }, persistence(), ["node", "edge"]);
  } else if (expression.op === "componentCount") {
    const count = normalizeBound(expression.count, `${path}.count`, context);
    nodeResult = count === null
      ? null
      : result({ op: "componentCount", count }, persistence(), ["node", "edge"]);
  } else if (expression.op === "pathExists") {
    nodeResult = analyzePath(expression, path, context);
  } else if (expression.op === "countRole") {
    nodeResult = analyzeCountRole(expression, path, context);
  } else if (expression.op === "balance") {
    nodeResult = analyzeBalance(expression, path, context);
  } else if (expression.op === "compare") {
    nodeResult = analyzeCompare(expression, path, context);
  } else {
    nodeResult = analyzeSubstructure(expression, path, depth, substructureDepth, context);
  }
  return nodeResult === null ? null : mergeWitnesses(context, nodeResult);
}

function normalizeAnalyzerInput(expression, options) {
  try {
    return { expression: canonicalClone(expression), options: canonicalClone(options) };
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    throw new KernelValidationError([
      validationIssue("PREDICATE_TYPE_INPUT_INVALID", "$", error.message, {
        causeCode: error.code,
        ...error.details
      })
    ], "Predicate-expression analysis failed.", {
      code: "PREDICATE_ANALYSIS_FAILED",
      stage: "ANALYZE"
    });
  }
}

function materializeRequirements(context) {
  return {
    invariants: [...context.requirements.invariants].sort(),
    attributes: [...context.requirements.attributes].sort(),
    roles: [...context.requirements.roles].sort(),
    perturbations: [...context.requirements.perturbations].sort(),
    substructurePolicies: [...context.requirements.substructurePolicies].sort(),
    graphProjections: [...context.requirements.graphProjections].sort(),
    operators: [...context.requirements.operators].sort(),
    valueExpressionHashes: [...context.requirements.valueExpressionHashes].sort(),
    witnessKinds: [...context.requirements.witnessKinds].sort(),
    usesDefaultSubstructurePolicy: context.requirements.usesDefaultSubstructurePolicy
  };
}

export function analyzePredicateExpression(expression, options = {}) {
  if (!isObject(options)) throw new TypeError("Predicate-expression analyzer options must be an object.");
  const cloned = normalizeAnalyzerInput(expression, options);
  if (Object.keys(cloned.options).some((field) => field !== "environment" && field !== "limits")) {
    throw new TypeError("Unknown predicate-expression analyzer option.");
  }
  const issues = [];
  const limits = normalizeLimits(cloned.options.limits, issues);
  const context = {
    issues,
    limits,
    environment: null,
    requirements: {
      invariants: new Set(),
      attributes: new Set(),
      roles: new Set(),
      perturbations: new Set(),
      substructurePolicies: new Set(),
      graphProjections: new Set(),
      operators: new Set(),
      valueExpressionHashes: new Set(),
      witnessKinds: new Set(),
      usesDefaultSubstructurePolicy: false
    },
    symbols: { invariants: {}, attributes: {} },
    statistics: {
      nodes: 0,
      maxDepth: 0,
      valueExpressions: 0,
      substructureCombinators: 0,
      maxSubstructureNesting: 0
    },
    nodeLimitReported: false
  };
  context.environment = normalizeEnvironment(
    cloned.options.environment === undefined ? {} : cloned.options.environment,
    context
  );
  const analyzed = issues.length === 0
    ? analyzeExpression(cloned.expression, "$", 1, 0, context)
    : null;
  if (issues.length > 0 || analyzed === null) {
    throw new KernelValidationError(issues, "Predicate-expression analysis failed.", {
      code: "PREDICATE_ANALYSIS_FAILED",
      stage: "ANALYZE"
    });
  }
  const normalizedExpression = canonicalClone(analyzed.normalized);
  const requirements = materializeRequirements(context);
  const expressionHash = hashCanonical(HASH_DOMAINS.PREDICATE_EXPRESSION, normalizedExpression);
  const basis = {
    schemaVersion: "1",
    analyzer: PREDICATE_EXPRESSION_ANALYZER_VERSION,
    expressionHash,
    result: "predicate-outcome",
    requirements,
    symbols: context.symbols,
    truthPersistence: analyzed.persistence,
    partialDetectability: analyzed.detectability
  };
  return deepFreeze({
    ...basis,
    analysisHash: hashCanonical(HASH_DOMAINS.PREDICATE_EXPRESSION_ANALYSIS, basis),
    expression: normalizedExpression,
    statistics: context.statistics
  });
}

function validatePredicateMetadata(predicate, context) {
  const allowed = new Set([
    "id",
    "phase",
    "monotoneViolation",
    "referencesDepth",
    "expr",
    "explain",
    "claimRefs"
  ]);
  rejectUnknownFields(context, predicate, allowed, "$");
  requireFields(context, predicate, [...allowed], "$");
  const id = normalizedIdentifier(context, predicate.id, "$.id", "Predicate identifier");
  if (!new Set(["formation", "maintenance", "termination"]).has(predicate.phase)) {
    addIssue(context, "PREDICATE_TYPE_PHASE_INVALID", "$.phase", "Predicate phase is invalid.", { phase: predicate.phase });
  }
  if (typeof predicate.monotoneViolation !== "boolean") {
    addIssue(context, "PREDICATE_TYPE_MONOTONICITY_INVALID", "$.monotoneViolation", "monotoneViolation must be Boolean.");
  }
  if (predicate.referencesDepth !== "below" && predicate.referencesDepth !== "self") {
    addIssue(context, "PREDICATE_TYPE_DEPTH_REFERENCE_INVALID", "$.referencesDepth", "Predicate depth reference must be below or self.");
  }
  if (!isObject(predicate.explain)) {
    addIssue(context, "PREDICATE_TYPE_EXPLANATION_INVALID", "$.explain", "Predicate explanation must be an object.");
  } else {
    rejectUnknownFields(context, predicate.explain, new Set(["pass", "fail", "indeterminate"]), "$.explain");
    requireFields(context, predicate.explain, ["pass", "fail", "indeterminate"], "$.explain");
    for (const field of ["pass", "fail", "indeterminate"]) {
      normalizedIdentifier(context, predicate.explain[field], `$.explain.${field}`, "Explanation text");
    }
  }
  if (!Array.isArray(predicate.claimRefs)) {
    addIssue(context, "PREDICATE_TYPE_CLAIM_REFS_INVALID", "$.claimRefs", "Predicate claim references must be an array.");
  } else {
    const seen = new Set();
    predicate.claimRefs.forEach((entry, index) => {
      const claim = normalizedIdentifier(context, entry, `$.claimRefs[${index}]`, "Claim reference");
      if (claim !== null && seen.has(claim)) {
        addIssue(context, "PREDICATE_TYPE_CLAIM_REF_DUPLICATE", `$.claimRefs[${index}]`, "Predicate claim references must be unique.", { claim });
      }
      if (claim !== null) seen.add(claim);
    });
  }
  return id;
}

export function compilePredicate(predicate, options = {}) {
  if (!isObject(options)) throw new TypeError("Predicate compiler options must be an object.");
  let clonedPredicate;
  let clonedOptions;
  try {
    clonedPredicate = canonicalClone(predicate);
    clonedOptions = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    throw new KernelValidationError([
      validationIssue("PREDICATE_TYPE_INPUT_INVALID", "$", error.message, {
        causeCode: error.code,
        ...error.details
      })
    ], "Predicate plan compilation failed.", {
      code: "PREDICATE_COMPILATION_FAILED",
      stage: "COMPILE"
    });
  }
  if (Object.keys(clonedOptions).some((field) => field !== "environment" && field !== "limits")) {
    throw new TypeError("Unknown predicate compiler option.");
  }
  const metadataContext = {
    issues: [],
    limits: normalizeLimits(clonedOptions.limits, [])
  };
  const predicateId = isObject(clonedPredicate)
    ? validatePredicateMetadata(clonedPredicate, metadataContext)
    : null;
  if (!isObject(clonedPredicate)) {
    addIssue(metadataContext, "PREDICATE_TYPE_INPUT_INVALID", "$", "Predicate must be an object.");
  }
  let analysis = null;
  if (isObject(clonedPredicate)) {
    try {
      analysis = analyzePredicateExpression(clonedPredicate.expr, clonedOptions);
    } catch (error) {
      if (!(error instanceof KernelValidationError) || error.code !== "PREDICATE_ANALYSIS_FAILED") throw error;
      for (const entry of error.issues) {
        const issuePath = entry.path.startsWith("$.environment") || entry.path.startsWith("$.limits")
          ? `$.options${entry.path.slice(1)}`
          : entry.path === "$"
            ? "$.expr"
            : `$.expr${entry.path.slice(1)}`;
        metadataContext.issues.push(validationIssue(
          entry.code,
          issuePath,
          entry.message,
          entry.details
        ));
      }
    }
  }
  if (metadataContext.issues.length > 0 || analysis === null || predicateId === null) {
    throw new KernelValidationError(metadataContext.issues, "Predicate plan compilation failed.", {
      code: "PREDICATE_COMPILATION_FAILED",
      stage: "COMPILE"
    });
  }
  const staticFailurePersistence = analysis.truthPersistence.fail;
  const partialFailureDetectable = analysis.partialDetectability.fail;
  const eligibility = clonedPredicate.monotoneViolation === false
    ? "disabled"
    : staticFailurePersistence !== PERSISTENCE.PROVEN
      ? "blocked-unproven"
      : partialFailureDetectable
        ? "static-proven"
        : "blocked-partial-data";
  const basis = {
    schemaVersion: "1",
    compiler: PREDICATE_PLAN_COMPILER_VERSION,
    predicateId,
    phase: clonedPredicate.phase,
    referencesDepth: clonedPredicate.referencesDepth,
    monotoneViolation: clonedPredicate.monotoneViolation,
    expressionAnalysisHash: analysis.analysisHash,
    pruning: {
      declared: clonedPredicate.monotoneViolation,
      staticFailurePersistence,
      partialFailureDetectable,
      auditRequired: clonedPredicate.monotoneViolation,
      eligibility
    }
  };
  return deepFreeze({
    ...basis,
    planHash: hashCanonical(HASH_DOMAINS.PREDICATE_PLAN, basis),
    expressionHash: analysis.expressionHash,
    expression: analysis.expression,
    requirements: analysis.requirements,
    symbols: analysis.symbols,
    truthPersistence: analysis.truthPersistence,
    partialDetectability: analysis.partialDetectability,
    statistics: analysis.statistics
  });
}
