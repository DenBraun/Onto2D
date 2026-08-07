import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { normalizeQuantity, parseUnitExpression } from "./quantity.js";

export const VALUE_EXPRESSION_ANALYZER_VERSION = "typed-value-expression-v1";

export const DEFAULT_VALUE_EXPRESSION_LIMITS = deepFreeze({
  maxDepth: 64,
  maxNodes: 10_000,
  maxTerms: 10_000,
  maxRoles: 256,
  maxStringLength: 1_024,
  maxAbsoluteDimensionExponent: 16
});

const BASE_UNIT_ORDER = Object.freeze(["kg", "m", "s", "A", "K", "mol", "cd"]);
const EXPRESSION_KINDS = new Set([
  "constant",
  "invariant",
  "count",
  "sum",
  "add",
  "multiply",
  "coefficient"
]);
const EXPRESSION_FIELDS = Object.freeze({
  constant: new Set(["kind", "value"]),
  invariant: new Set(["kind", "name", "node"]),
  count: new Set(["kind", "set"]),
  sum: new Set(["kind", "attribute", "set"]),
  add: new Set(["kind", "terms"]),
  multiply: new Set(["kind", "factors"]),
  coefficient: new Set(["kind", "name"])
});
const REQUIRED_EXPRESSION_FIELDS = Object.freeze({
  constant: ["kind", "value"],
  invariant: ["kind", "name"],
  count: ["kind", "set"],
  sum: ["kind", "attribute", "set"],
  add: ["kind", "terms"],
  multiply: ["kind", "factors"],
  coefficient: ["kind", "name"]
});
const NODE_SELECTOR_FIELDS = Object.freeze({
  "canonical-index": new Set(["kind", "index"]),
  all: new Set(["kind"]),
  where: new Set(["kind", "attribute", "equals"])
});
const SET_SELECTOR_FIELDS = Object.freeze({
  nodes: new Set(["kind", "selector"]),
  edges: new Set(["kind", "roles"]),
  cycle: new Set(["kind", "roles"])
});
const SYMBOL_KINDS = new Set(["number", "quantity", "string", "boolean", "null"]);
const DIMENSIONLESS = Object.freeze({});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(context, code, path, message, details = {}) {
  context.issues.push(validationIssue(code, path, message, details));
}

function unknownFields(context, value, allowed, path) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      issue(context, "EXPRESSION_FIELD_UNKNOWN", `${path}.${field}`, "Unknown value-expression field.", { field });
    }
  }
}

function requiredFields(context, value, fields, path) {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      issue(context, "EXPRESSION_FIELD_REQUIRED", `${path}.${field}`, "Required value-expression field is missing.", { field });
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
    issue(context, "EXPRESSION_IDENTIFIER_INVALID", path, `${label} must be a normalized non-empty string within the configured length limit.`, {
      value,
      maximumLength: context.limits.maxStringLength
    });
    return null;
  }
  return value;
}

function formatDimensions(dimensions) {
  const factors = [];
  for (const symbol of BASE_UNIT_ORDER) {
    const exponent = dimensions[symbol] || 0;
    if (exponent === 0) continue;
    factors.push(exponent === 1 ? symbol : `${symbol}^${exponent}`);
  }
  return factors.length === 0 ? "1" : factors.join("*");
}

function signatureOf(dimensions) {
  return BASE_UNIT_ORDER.map((symbol) => dimensions[symbol] || 0).join(":");
}

function orderedDimensions(input) {
  const result = {};
  for (const symbol of BASE_UNIT_ORDER) {
    if (input[symbol]) result[symbol] = input[symbol];
  }
  return result;
}

function numericType(kind, dimensions = DIMENSIONLESS, semantic) {
  const ordered = orderedDimensions(dimensions);
  return {
    kind,
    unit: formatDimensions(ordered),
    dimensionSignature: signatureOf(ordered),
    dimensions: ordered,
    ...(semantic === undefined ? {} : { semantic })
  };
}

function scalarType(kind) {
  return { kind };
}

function descriptorFromUnit(kind, unit, semantic) {
  const parsed = parseUnitExpression(unit);
  return numericType(kind, parsed.dimensions, semantic);
}

function enforceDimensionLimit(type, path, context) {
  if (type.kind !== "number" && type.kind !== "quantity") return type;
  for (const [symbol, exponent] of Object.entries(type.dimensions)) {
    if (Math.abs(exponent) > context.limits.maxAbsoluteDimensionExponent) {
      issue(context, "EXPRESSION_DIMENSION_EXPONENT_LIMIT", path, "Symbol dimension exceeds the configured expression limit.", {
        symbol,
        exponent,
        maximumAbsoluteExponent: context.limits.maxAbsoluteDimensionExponent
      });
      return null;
    }
  }
  return type;
}

function normalizeSymbolDescriptor(value, path, context) {
  try {
    if (isObject(value) && Object.prototype.hasOwnProperty.call(value, "value")) {
      const quantity = normalizeQuantity(value);
      if (!enforceQuantityStringLimits(quantity, path, context)) return null;
      return descriptorFromUnit("quantity", quantity.unit, quantity.semantic);
    }
    if (
      isObject(value) &&
      typeof value.unit === "string" &&
      Object.prototype.hasOwnProperty.call(value, "toleranceTarget")
    ) {
      unknownFields(context, value, new Set(["id", "unit", "semantic", "toleranceTarget"]), path);
      normalizedIdentifier(context, value.id, `${path}.id`, "Quantity-specification identifier");
      const specification = normalizeQuantity({
        value: 0,
        unit: value.unit,
        tolerance: value.toleranceTarget,
        semantic: value.semantic,
        provenance: { kind: "declared", evidence: [] }
      });
      if (!enforceQuantityStringLimits(specification, path, context)) return null;
      return descriptorFromUnit("quantity", specification.unit, specification.semantic);
    }
    if (!isObject(value)) {
      issue(context, "EXPRESSION_SYMBOL_INVALID", path, "Expression symbol metadata must be a quantity, quantity specification, or type descriptor.");
      return null;
    }
    const allowed = value.kind === "quantity"
      ? new Set(["kind", "unit", "semantic"])
      : new Set(["kind"]);
    unknownFields(context, value, allowed, path);
    if (!SYMBOL_KINDS.has(value.kind)) {
      issue(context, "EXPRESSION_SYMBOL_KIND_INVALID", `${path}.kind`, "Unknown expression symbol kind.", { kind: value.kind });
      return null;
    }
    if (value.kind === "quantity") {
      if (typeof value.unit !== "string") {
        issue(context, "EXPRESSION_SYMBOL_UNIT_REQUIRED", `${path}.unit`, "A quantity symbol requires a unit.");
        return null;
      }
      if (value.semantic !== undefined && (
        typeof value.semantic !== "string" ||
        value.semantic.length === 0 ||
        value.semantic !== value.semantic.trim() ||
        value.semantic.length > context.limits.maxStringLength
      )) {
        issue(context, "EXPRESSION_SYMBOL_SEMANTIC_INVALID", `${path}.semantic`, "Quantity-symbol semantic must be a normalized non-empty string within the configured length limit.");
        return null;
      }
      return descriptorFromUnit("quantity", value.unit, value.semantic);
    }
    return value.kind === "number" ? numericType("number") : scalarType(value.kind);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    issue(context, "EXPRESSION_SYMBOL_INVALID", path, error.message, {
      causeCode: error.code,
      ...error.details
    });
    return null;
  }
}

function normalizeEnvironment(environment, context) {
  if (!isObject(environment)) {
    issue(context, "EXPRESSION_ENVIRONMENT_INVALID", "$.environment", "Value-expression environment must be an object.");
    return { coefficients: {}, invariants: {}, attributes: {} };
  }
  unknownFields(context, environment, new Set(["coefficients", "invariants", "attributes"]), "$.environment");
  const normalized = {};
  for (const registry of ["coefficients", "invariants", "attributes"]) {
    const input = environment[registry] === undefined ? {} : environment[registry];
    const target = {};
    if (!isObject(input)) {
      issue(context, "EXPRESSION_SYMBOL_REGISTRY_INVALID", `$.environment.${registry}`, "Expression symbol registry must be an object.");
      normalized[registry] = target;
      continue;
    }
    for (const name of Object.keys(input).sort()) {
      if (normalizedIdentifier(context, name, `$.environment.${registry}.${name}`, "Symbol name") === null) continue;
      const descriptor = normalizeSymbolDescriptor(input[name], `$.environment.${registry}.${name}`, context);
      const bounded = descriptor === null
        ? null
        : enforceDimensionLimit(descriptor, `$.environment.${registry}.${name}`, context);
      if (bounded !== null) target[name] = bounded;
    }
    normalized[registry] = target;
  }
  return normalized;
}

function normalizeLimits(input, issues) {
  if (input === undefined) return { ...DEFAULT_VALUE_EXPRESSION_LIMITS };
  if (!isObject(input)) {
    issues.push(validationIssue("EXPRESSION_LIMITS_INVALID", "$.limits", "Value-expression limits must be an object."));
    return { ...DEFAULT_VALUE_EXPRESSION_LIMITS };
  }
  const result = { ...DEFAULT_VALUE_EXPRESSION_LIMITS };
  for (const [field, value] of Object.entries(input)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_VALUE_EXPRESSION_LIMITS, field)) {
      issues.push(validationIssue("EXPRESSION_LIMIT_UNKNOWN", `$.limits.${field}`, "Unknown value-expression limit.", { field }));
      continue;
    }
    if (!Number.isSafeInteger(value) || value < 1 || value > DEFAULT_VALUE_EXPRESSION_LIMITS[field]) {
      issues.push(validationIssue("EXPRESSION_LIMIT_INVALID", `$.limits.${field}`, "Value-expression limit must be a positive safe integer no greater than the kernel ceiling.", {
        value,
        maximum: DEFAULT_VALUE_EXPRESSION_LIMITS[field]
      }));
      continue;
    }
    result[field] = value;
  }
  return result;
}

function scalarConstant(value) {
  if (value === null) return { normalized: null, type: scalarType("null") };
  if (typeof value === "number" && Number.isFinite(value)) {
    return { normalized: Object.is(value, -0) ? 0 : value, type: numericType("number") };
  }
  if (typeof value === "string") return { normalized: value, type: scalarType("string") };
  if (typeof value === "boolean") return { normalized: value, type: scalarType("boolean") };
  return null;
}

function enforceStringLength(value, path, context, label) {
  if (typeof value !== "string" || value.length <= context.limits.maxStringLength) return true;
  issue(context, "EXPRESSION_STRING_LIMIT", path, `${label} exceeds the configured length limit.`, {
    maximumLength: context.limits.maxStringLength
  });
  return false;
}

function enforceQuantityStringLimits(quantity, path, context) {
  let valid = enforceStringLength(quantity.semantic, `${path}.semantic`, context, "Quantity semantic");
  if (quantity.provenance.method !== undefined) {
    valid = enforceStringLength(
      quantity.provenance.method,
      `${path}.provenance.method`,
      context,
      "Quantity provenance method"
    ) && valid;
  }
  quantity.provenance.evidence.forEach((entry, index) => {
    valid = enforceStringLength(
      entry,
      `${path}.provenance.evidence[${index}]`,
      context,
      "Quantity evidence identifier"
    ) && valid;
  });
  return valid;
}

function analyzeConstant(value, path, context) {
  const scalar = scalarConstant(value);
  if (scalar !== null) {
    if (typeof value === "string" && value.length > context.limits.maxStringLength) {
      issue(context, "EXPRESSION_CONSTANT_INVALID", path, "String constant exceeds the configured length limit.", {
        maximumLength: context.limits.maxStringLength
      });
      return null;
    }
    return scalar;
  }
  try {
    if (isObject(value)) {
      const quantity = normalizeQuantity(value);
      if (!enforceQuantityStringLimits(quantity, path, context)) return null;
      const parsed = parseUnitExpression(quantity.unit);
      return {
        normalized: quantity,
        type: enforceDimensionLimit(
          numericType("quantity", parsed.dimensions, quantity.semantic),
          path,
          context
        )
      };
    }
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    issue(context, "EXPRESSION_CONSTANT_INVALID", path, error.message, {
      causeCode: error.code,
      ...error.details
    });
    return null;
  }
  issue(context, "EXPRESSION_CONSTANT_INVALID", path, "Constant must be a finite JSON scalar or a valid quantity.");
  return null;
}

function normalizeRoleList(value, path, context) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issue(context, "EXPRESSION_SELECTOR_ROLES_INVALID", path, "Selector roles must be an array.");
    return null;
  }
  if (value.length > context.limits.maxRoles) {
    issue(context, "EXPRESSION_SELECTOR_ROLES_LIMIT", path, "Selector role count exceeds the configured limit.", {
      count: value.length,
      maximum: context.limits.maxRoles
    });
  }
  const roles = [];
  const seen = new Set();
  value.slice(0, context.limits.maxRoles).forEach((role, index) => {
    const normalized = normalizedIdentifier(context, role, `${path}[${index}]`, "Role");
    if (normalized === null) return;
    if (seen.has(normalized)) {
      issue(context, "EXPRESSION_SELECTOR_ROLE_DUPLICATE", `${path}[${index}]`, "Selector roles must be unique.", { role: normalized });
      return;
    }
    seen.add(normalized);
    roles.push(normalized);
    context.requirements.roles.add(normalized);
  });
  return roles.sort();
}

function analyzeNodeSelector(selector, path, context) {
  if (!isObject(selector)) {
    issue(context, "EXPRESSION_NODE_SELECTOR_INVALID", path, "Node selector must be an object.");
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(NODE_SELECTOR_FIELDS, selector.kind)) {
    issue(context, "EXPRESSION_NODE_SELECTOR_KIND_INVALID", `${path}.kind`, "Unknown node-selector kind.", { kind: selector.kind });
    return null;
  }
  unknownFields(context, selector, NODE_SELECTOR_FIELDS[selector.kind], path);
  if (selector.kind === "canonical-index") {
    requiredFields(context, selector, ["kind", "index"], path);
    if (!Number.isSafeInteger(selector.index) || selector.index < 0) {
      issue(context, "EXPRESSION_NODE_INDEX_INVALID", `${path}.index`, "Canonical node index must be a non-negative safe integer.", { value: selector.index });
      return null;
    }
    return { kind: "canonical-index", index: selector.index };
  }
  if (selector.kind === "all") {
    requiredFields(context, selector, ["kind"], path);
    return { kind: "all" };
  }
  requiredFields(context, selector, ["kind", "attribute", "equals"], path);
  const attribute = normalizedIdentifier(context, selector.attribute, `${path}.attribute`, "Attribute name");
  const equals = scalarConstant(selector.equals);
  if (equals === null) {
    issue(context, "EXPRESSION_SELECTOR_EQUALS_INVALID", `${path}.equals`, "Where-selector equality target must be a finite JSON scalar.");
  } else if (!enforceStringLength(selector.equals, `${path}.equals`, context, "Where-selector string target")) {
    return null;
  }
  if (attribute !== null) {
    context.requirements.attributes.add(attribute);
    const declared = context.environment.attributes[attribute];
    if (equals !== null) {
      if (declared === undefined) {
        context.environment.attributes[attribute] = equals.type;
      } else if (declared.kind !== equals.type.kind) {
        issue(context, "EXPRESSION_ATTRIBUTE_TYPE_INCOMPATIBLE", `${path}.equals`, "Where-selector scalar does not match the declared attribute type.", {
          attribute,
          declaredKind: declared.kind,
          actualKind: equals.type.kind
        });
      }
    }
  }
  return attribute === null || equals === null
    ? null
    : { kind: "where", attribute, equals: equals.normalized };
}

function analyzeSetSelector(selector, path, context) {
  if (!isObject(selector)) {
    issue(context, "EXPRESSION_SET_SELECTOR_INVALID", path, "Set selector must be an object.");
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(SET_SELECTOR_FIELDS, selector.kind)) {
    issue(context, "EXPRESSION_SET_SELECTOR_KIND_INVALID", `${path}.kind`, "Unknown set-selector kind.", { kind: selector.kind });
    return null;
  }
  unknownFields(context, selector, SET_SELECTOR_FIELDS[selector.kind], path);
  if (selector.kind === "nodes") {
    requiredFields(context, selector, ["kind", "selector"], path);
    const normalized = analyzeNodeSelector(selector.selector, `${path}.selector`, context);
    return normalized === null ? null : { kind: "nodes", selector: normalized };
  }
  requiredFields(context, selector, ["kind"], path);
  const roles = normalizeRoleList(selector.roles, `${path}.roles`, context);
  if (roles === null) return null;
  return {
    kind: selector.kind,
    ...(roles === undefined ? {} : { roles })
  };
}

function resolveSymbol(registry, name, path, context) {
  const normalized = normalizedIdentifier(context, name, path, `${registry.slice(0, -1)} name`);
  if (normalized === null) return null;
  const descriptor = context.environment[registry][normalized];
  if (descriptor === undefined) {
    issue(context, "EXPRESSION_SYMBOL_UNDECLARED", path, "Expression references an undeclared symbol.", {
      registry,
      name: normalized
    });
    return null;
  }
  context.requirements[registry].add(normalized);
  return { name: normalized, type: descriptor };
}

function ensureNumeric(type, path, context) {
  if (type === null) return false;
  if (type.kind === "number" || type.kind === "quantity") return true;
  issue(context, "EXPRESSION_NUMERIC_OPERAND_REQUIRED", path, "Arithmetic expressions require number or quantity operands.", {
    actualKind: type.kind
  });
  return false;
}

function inferAdd(children, path, context) {
  if (children.some((child, index) => !ensureNumeric(child?.type || null, `${path}[${index}]`, context))) return null;
  const first = children[0].type;
  let incompatible = false;
  for (let index = 1; index < children.length; index += 1) {
    if (children[index].type.dimensionSignature !== first.dimensionSignature) {
      incompatible = true;
      issue(context, "EXPRESSION_ADD_DIMENSION_MISMATCH", `${path}[${index}]`, "Additive operands must have identical dimensions.", {
        expected: first.dimensionSignature,
        actual: children[index].type.dimensionSignature
      });
    }
  }
  if (incompatible) return null;
  const kind = children.some((child) => child.type.kind === "quantity") ? "quantity" : "number";
  const semantics = [...new Set(children.map((child) => child.type.semantic).filter((value) => value !== undefined))];
  return numericType(kind, first.dimensions, semantics.length === 1 ? semantics[0] : undefined);
}

function inferMultiply(children, path, context) {
  if (children.some((child, index) => !ensureNumeric(child?.type || null, `${path}[${index}]`, context))) return null;
  const dimensions = {};
  for (const child of children) {
    for (const symbol of BASE_UNIT_ORDER) {
      const exponent = (dimensions[symbol] || 0) + (child.type.dimensions[symbol] || 0);
      if (Math.abs(exponent) > context.limits.maxAbsoluteDimensionExponent) {
        issue(context, "EXPRESSION_DIMENSION_EXPONENT_LIMIT", path, "Multiplication produces a dimension outside the representable unit grammar.", {
          symbol,
          exponent,
          maximumAbsoluteExponent: context.limits.maxAbsoluteDimensionExponent
        });
        return null;
      }
      if (exponent === 0) delete dimensions[symbol];
      else dimensions[symbol] = exponent;
    }
  }
  const kind = children.some((child) => child.type.kind === "quantity") ? "quantity" : "number";
  return numericType(kind, dimensions);
}

function analyzeExpression(expression, path, depth, context) {
  context.statistics.nodes += 1;
  context.statistics.maxDepth = Math.max(context.statistics.maxDepth, depth);
  if (context.statistics.nodes > context.limits.maxNodes) {
    if (!context.nodeLimitReported) {
      issue(context, "EXPRESSION_NODE_LIMIT", path, "Value expression exceeds the configured node limit.", {
        maximum: context.limits.maxNodes
      });
      context.nodeLimitReported = true;
    }
    return null;
  }
  if (depth > context.limits.maxDepth) {
    issue(context, "EXPRESSION_DEPTH_LIMIT", path, "Value expression exceeds the configured depth limit.", {
      depth,
      maximum: context.limits.maxDepth
    });
    return null;
  }
  if (!isObject(expression)) {
    issue(context, "EXPRESSION_NODE_INVALID", path, "Value-expression node must be an object.");
    return null;
  }
  if (!EXPRESSION_KINDS.has(expression.kind)) {
    issue(context, "EXPRESSION_KIND_INVALID", `${path}.kind`, "Unknown value-expression kind.", { kind: expression.kind });
    return null;
  }
  unknownFields(context, expression, EXPRESSION_FIELDS[expression.kind], path);
  requiredFields(context, expression, REQUIRED_EXPRESSION_FIELDS[expression.kind], path);

  if (expression.kind === "constant") {
    const constant = analyzeConstant(expression.value, `${path}.value`, context);
    return constant === null ? null : {
      normalized: { kind: "constant", value: constant.normalized },
      type: constant.type
    };
  }
  if (expression.kind === "invariant") {
    const resolved = resolveSymbol("invariants", expression.name, `${path}.name`, context);
    const node = expression.node === undefined ? undefined : analyzeNodeSelector(expression.node, `${path}.node`, context);
    if (resolved === null || node === null) return null;
    return {
      normalized: { kind: "invariant", name: resolved.name, ...(node === undefined ? {} : { node }) },
      type: resolved.type
    };
  }
  if (expression.kind === "coefficient") {
    const resolved = resolveSymbol("coefficients", expression.name, `${path}.name`, context);
    return resolved === null ? null : {
      normalized: { kind: "coefficient", name: resolved.name },
      type: resolved.type
    };
  }
  if (expression.kind === "count") {
    const set = analyzeSetSelector(expression.set, `${path}.set`, context);
    return set === null ? null : {
      normalized: { kind: "count", set },
      type: numericType("number")
    };
  }
  if (expression.kind === "sum") {
    const attribute = normalizedIdentifier(context, expression.attribute, `${path}.attribute`, "Attribute name");
    const set = analyzeSetSelector(expression.set, `${path}.set`, context);
    let type = null;
    if (attribute !== null) {
      context.requirements.attributes.add(attribute);
      type = context.environment.attributes[attribute] || null;
      if (type === null) {
        issue(context, "EXPRESSION_SYMBOL_UNDECLARED", `${path}.attribute`, "Sum references an attribute without declared type metadata.", {
          registry: "attributes",
          name: attribute
        });
      } else {
        ensureNumeric(type, `${path}.attribute`, context);
      }
    }
    if (attribute === null || set === null || type === null || (type.kind !== "number" && type.kind !== "quantity")) return null;
    return {
      normalized: { kind: "sum", attribute, set },
      type
    };
  }

  const field = expression.kind === "add" ? "terms" : "factors";
  const values = expression[field];
  if (!Array.isArray(values) || values.length === 0) {
    issue(context, "EXPRESSION_OPERANDS_INVALID", `${path}.${field}`, "Arithmetic operand list must be a non-empty array.");
    return null;
  }
  if (values.length > context.limits.maxTerms) {
    issue(context, "EXPRESSION_OPERAND_LIMIT", `${path}.${field}`, "Arithmetic operand count exceeds the configured limit.", {
      count: values.length,
      maximum: context.limits.maxTerms
    });
  }
  const children = values
    .slice(0, context.limits.maxTerms)
    .map((value, index) => analyzeExpression(value, `${path}.${field}[${index}]`, depth + 1, context));
  if (children.some((child) => child === null)) return null;
  const type = expression.kind === "add"
    ? inferAdd(children, `${path}.${field}`, context)
    : inferMultiply(children, `${path}.${field}`, context);
  if (type === null) return null;
  const normalizedChildren = children.map((child) => child.normalized).sort((left, right) => {
    const a = canonicalize(left);
    const b = canonicalize(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return {
    normalized: { kind: expression.kind, [field]: normalizedChildren },
    type
  };
}

function referencedSymbols(environment, requirements) {
  const result = {};
  for (const registry of ["coefficients", "invariants", "attributes"]) {
    result[registry] = Object.fromEntries(requirements[registry].map((name) => [name, environment[registry][name]]));
  }
  return result;
}

export function analyzeValueExpression(expression, options = {}) {
  if (!isObject(options)) throw new TypeError("Value-expression analyzer options must be an object.");
  let clonedExpression;
  let clonedOptions;
  try {
    clonedExpression = canonicalClone(expression);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    throw new KernelValidationError([
      validationIssue("EXPRESSION_INPUT_INVALID", "$", error.message, {
        causeCode: error.code,
        ...error.details
      })
    ], "Value-expression analysis failed.", {
      code: "EXPRESSION_ANALYSIS_FAILED",
      stage: "ANALYZE"
    });
  }
  try {
    clonedOptions = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    throw new KernelValidationError([
      validationIssue("EXPRESSION_OPTIONS_INVALID", "$.options", error.message, {
        causeCode: error.code,
        ...error.details
      })
    ], "Value-expression analysis failed.", {
      code: "EXPRESSION_ANALYSIS_FAILED",
      stage: "ANALYZE"
    });
  }
  const optionFields = Object.keys(clonedOptions);
  if (optionFields.some((field) => field !== "environment" && field !== "limits")) {
    throw new TypeError("Unknown value-expression analyzer option.");
  }
  const issues = [];
  const limits = normalizeLimits(clonedOptions.limits, issues);
  const context = {
    issues,
    limits,
    environment: null,
    requirements: {
      invariants: new Set(),
      coefficients: new Set(),
      attributes: new Set(),
      roles: new Set()
    },
    statistics: { nodes: 0, maxDepth: 0 },
    nodeLimitReported: false
  };
  context.environment = normalizeEnvironment(
    clonedOptions.environment === undefined ? {} : clonedOptions.environment,
    context
  );
  const analyzed = analyzeExpression(clonedExpression, "$", 1, context);
  if (issues.length > 0 || analyzed === null) {
    throw new KernelValidationError(issues, "Value-expression analysis failed.", {
      code: "EXPRESSION_ANALYSIS_FAILED",
      stage: "ANALYZE"
    });
  }

  const requirements = {
    invariants: [...context.requirements.invariants].sort(),
    coefficients: [...context.requirements.coefficients].sort(),
    attributes: [...context.requirements.attributes].sort(),
    roles: [...context.requirements.roles].sort()
  };
  const symbols = referencedSymbols(context.environment, requirements);
  const normalizedExpression = canonicalClone(analyzed.normalized);
  const expressionHash = hashCanonical(HASH_DOMAINS.VALUE_EXPRESSION, normalizedExpression);
  const basis = {
    schemaVersion: "1",
    analyzer: VALUE_EXPRESSION_ANALYZER_VERSION,
    expressionHash,
    result: analyzed.type,
    requirements,
    symbols
  };
  return deepFreeze({
    ...basis,
    analysisHash: hashCanonical(HASH_DOMAINS.VALUE_EXPRESSION_ANALYSIS, basis),
    expression: normalizedExpression,
    statistics: context.statistics
  });
}
