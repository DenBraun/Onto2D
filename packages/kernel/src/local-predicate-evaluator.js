import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  accumulateDecimals,
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
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { verifyPredicatePlan } from "./predicate-plan-verifier.js";
import { compareQuantities, normalizeQuantity } from "./quantity.js";

export const LOCAL_PREDICATE_EVALUATOR_VERSION = "local-predicate-evaluator-v9";
export const LOCAL_PREDICATE_EVALUATION_LIMITS = deepFreeze({
  maxValueNodes: 10_000,
  maxSelectionWitnesses: 10_000,
  maxSelectedValues: 5_000
});

const QUANTITY_SUM_METHOD = "local-quantity-attribute-sum-v1";
const QUANTITY_ADD_METHOD = "local-quantity-add-v1";
const QUANTITY_SCALE_METHOD = "local-quantity-scale-v1";
const NUMBER_BALANCE_MAGNITUDE_METHOD = "local-number-balance-magnitude-v1";
const QUANTITY_TOLERANCE_AGGREGATION = "sum-effective-absolute-bounds-v1";
const PROFILE_INVARIANT_CONSENSUS_POLICY = "identical-normalized-quantity-v1";
const LOCAL_OPTION_FIELDS = new Set(["policy", "limits", "invariantContext"]);
const EXACT_INVARIANT_CONTEXT_FIELDS = new Set(["sourcePopulationHash", "elements"]);
const PROFILE_INVARIANT_CONTEXT_FIELDS = new Set([
  "sourcePopulationHash",
  "elements",
  "profileClasses"
]);
const INVARIANT_ELEMENT_FIELDS = new Set(["elementId", "invariants"]);
const INVARIANT_PROFILE_CLASS_FIELDS = new Set(["profileHash", "members"]);

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

function normalizedLocalOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PREDICATE_LOCAL_OPTIONS_INVALID",
      "Local predicate evaluation options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PREDICATE_LOCAL_OPTIONS_INVALID",
      "Local predicate evaluation options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !LOCAL_OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PREDICATE_LOCAL_OPTION_UNKNOWN",
      "Unknown local predicate evaluation option.",
      { unknown }
    );
  }
  return {
    canonicalization: {
      ...(value.policy === undefined ? {} : { policy: value.policy }),
      ...(value.limits === undefined ? {} : { limits: value.limits })
    },
    invariantContext: value.invariantContext
  };
}

function sameFields(value, expected) {
  const fields = Object.keys(value);
  return fields.length === expected.size && fields.every((field) => expected.has(field));
}

function constantMode(value) {
  if (isObject(value)) return "quantity";
  if (typeof value === "number") return "number";
  if (value === null) return "null";
  return typeof value;
}

function staticQuantityDescriptor(expression, symbols) {
  if (expression.kind === "constant") {
    if (!isObject(expression.value)) return null;
    try {
      const quantity = normalizeQuantity(expression.value);
      return { unit: quantity.unit, semantic: quantity.semantic };
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      return null;
    }
  }
  if (expression.kind === "invariant") {
    const descriptor = symbols.invariants[expression.name];
    return descriptor?.kind === "quantity" && typeof descriptor.semantic === "string"
      ? { unit: descriptor.unit, semantic: descriptor.semantic }
      : null;
  }
  if (expression.kind === "sum") {
    const descriptor = symbols.attributes[expression.attribute];
    return descriptor?.kind === "quantity" && typeof descriptor.semantic === "string"
      ? { unit: descriptor.unit, semantic: descriptor.semantic }
      : null;
  }
  if (expression.kind === "multiply") {
    const descriptors = expression.factors
      .map((factor) => staticQuantityDescriptor(factor, symbols))
      .filter((descriptor) => descriptor !== null);
    return descriptors.length === 1 ? descriptors[0] : null;
  }
  if (expression.kind !== "add") return null;
  const descriptors = expression.terms.map((term) =>
    staticQuantityDescriptor(term, symbols)
  );
  if (descriptors.some((descriptor) => descriptor === null)) return null;
  const first = descriptors[0];
  return descriptors.every((descriptor) =>
    descriptor.unit === first.unit && descriptor.semantic === first.semantic
  ) ? first : null;
}

function inspectNodeSelectorAttributes(selector, context) {
  if (selector?.kind === "where") context.nodeAttributes.add(selector.attribute);
}

function inspectSetAttributes(set, context) {
  if (set.kind === "nodes") inspectNodeSelectorAttributes(set.selector, context);
}

function inspectValueExpression(expression, path, context) {
  context.valueNodes += 1;
  if (expression.kind === "constant") return constantMode(expression.value);
  if (expression.kind === "invariant") {
    const invariantType = context.symbols.invariants[expression.name];
    if (invariantType?.kind === "quantity" && typeof invariantType.semantic === "string") {
      return "quantity";
    }
    context.unsupported.push({
      path,
      feature: "invariant",
      reason: invariantType?.kind === "quantity"
        ? "quantity-invariant-semantic-not-declared"
        : "scalar-invariant-runtime-not-supported"
    });
    return null;
  }
  if (expression.kind === "count") {
    context.selectionWitnesses += 1;
    inspectSetAttributes(expression.set, context);
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
  if (expression.kind === "sum") {
    context.selectionWitnesses += 1;
    inspectSetAttributes(expression.set, context);
    if (expression.set.kind === "cycle") {
      context.unsupported.push({
        path: `${path}.set`,
        feature: "cycle-set",
        reason: "cycle-set-selection-not-frozen"
      });
      return null;
    }
    const attributeSet = expression.set.kind === "nodes"
      ? context.nodeAttributes
      : context.edgeAttributes;
    attributeSet.add(expression.attribute);
    const attributeType = context.symbols.attributes[expression.attribute];
    if (attributeType?.kind === "number") return "number";
    if (attributeType?.kind === "quantity" && typeof attributeType.semantic === "string") {
      return "quantity";
    }
    context.unsupported.push({
      path,
      feature: "sum",
      reason: attributeType?.kind === "quantity"
        ? "quantity-attribute-semantic-not-declared"
        : "runtime-attribute-type-not-supported"
    });
    return null;
  }
  if (expression.kind === "add") {
    const modes = expression.terms.map((child, index) =>
      inspectValueExpression(child, `${path}.terms[${index}]`, context)
    );
    if (modes.every((mode) => mode === "number")) return "number";
    if (modes.every((mode) => mode === "quantity")) {
      if (staticQuantityDescriptor(expression, context.symbols) !== null) {
        return "quantity";
      }
      context.unsupported.push({
        path,
        feature: "add",
        reason: "quantity-add-unit-or-semantic-mismatch"
      });
      return null;
    }
    if (modes.every((mode) => mode !== null)) {
      context.unsupported.push({
        path,
        feature: "add",
        reason: "implicit-number-quantity-lift-not-frozen"
      });
    }
    return null;
  }
  if (expression.kind === "multiply") {
    const modes = expression.factors.map((child, index) =>
      inspectValueExpression(child, `${path}.factors[${index}]`, context)
    );
    if (modes.every((mode) => mode === "number")) return "number";
    const quantityFactors = modes.filter((mode) => mode === "quantity").length;
    if (
      quantityFactors === 1 &&
      modes.every((mode) => mode === "number" || mode === "quantity")
    ) {
      return "quantity";
    }
    if (quantityFactors > 1) {
      context.unsupported.push({
        path,
        feature: expression.kind,
        reason: "quantity-product-semantic-not-frozen"
      });
    }
    return null;
  }
  context.unsupported.push({
    path,
    feature: expression.kind,
    reason: {
      invariant: "runtime-invariant-resolution-not-frozen",
      coefficient: "runtime-coefficient-binding-not-frozen"
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
  if (GRAPH_OPERATORS.has(expression.op)) {
    if (expression.op === "degree") inspectNodeSelectorAttributes(expression.node, context);
    if (expression.op === "pathExists") {
      inspectNodeSelectorAttributes(expression.from, context);
      inspectNodeSelectorAttributes(expression.to, context);
    }
    return;
  }
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
  if (expression.op === "balance") {
    context.valueNodes += 1;
    context.selectionWitnesses += 1;
    inspectSetAttributes(expression.over, context);
    if (expression.over.kind === "cycle") {
      context.unsupported.push({
        path: `${path}.over`,
        feature: "cycle-set",
        reason: "cycle-set-selection-not-frozen"
      });
      return;
    }
    const attributeSet = expression.over.kind === "nodes"
      ? context.nodeAttributes
      : context.edgeAttributes;
    attributeSet.add(expression.attribute);
    const attributeType = context.symbols.attributes[expression.attribute];
    if (attributeType?.kind === "number" || attributeType?.kind === "quantity") return;
    context.unsupported.push({
      path,
      feature: "balance",
      reason: "runtime-attribute-type-not-supported"
    });
    return;
  }
  context.unsupported.push({
    path,
    feature: expression.op,
    reason: "substructure-runtime-not-supported"
  });
}

export function localPredicateUnsupportedFeatures(plan) {
  return inspectLocalPredicatePlan(plan).unsupported;
}

function inspectLocalPredicatePlan(plan) {
  const context = {
    unsupported: [],
    valueNodes: 0,
    selectionWitnesses: 0,
    symbols: {
      attributes: plan.symbols?.attributes || {},
      invariants: plan.symbols?.invariants || {}
    },
    nodeAttributes: new Set(),
    edgeAttributes: new Set()
  };
  inspectPredicateExpression(plan.expression, "$", context);
  return context;
}

export function localPredicateAttributeRequirements(plan) {
  const inspection = inspectLocalPredicatePlan(plan);
  return deepFreeze({
    nodeAttributes: [...inspection.nodeAttributes].sort(),
    edgeAttributes: [...inspection.edgeAttributes].sort()
  });
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

function selectedSet(graph, set) {
  const nodeIndexes = set.kind === "nodes"
    ? selectedNodes(graph, set.selector)
    : undefined;
  const edgeIndexes = set.kind === "edges"
    ? selectedEdges(graph, set.roles)
    : undefined;
  const indexes = nodeIndexes ?? edgeIndexes;
  return {
    indexes,
    selection: {
      setKind: set.kind,
      count: indexes.length,
      ...(nodeIndexes === undefined ? {} : { nodeIndexes }),
      ...(edgeIndexes === undefined ? {} : { edgeIndexes }),
      ...(set.roles === undefined ? {} : { roles: set.roles })
    }
  };
}

function normalizeInvariantContext(input, graph, requiredNames) {
  if (requiredNames.length === 0) {
    if (input !== undefined) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONTEXT_UNEXPECTED",
        "Invariant context was supplied to a plan that does not resolve invariants."
      );
    }
    return null;
  }
  if (graph.domain !== "element-exact" && graph.domain !== "profile-quotient") {
    fail(
      "PREDICATE_LOCAL_INVARIANT_DOMAIN_UNSUPPORTED",
      "Runtime invariants require an exact-element or profile-consensus counting domain.",
      { domain: graph.domain, reason: "single-candidate-invariant-binding-not-frozen" }
    );
  }
  if (input === undefined) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_CONTEXT_REQUIRED",
      "Runtime invariant resolution requires an explicit source-population context."
    );
  }
  const expectedFields = graph.domain === "element-exact"
    ? EXACT_INVARIANT_CONTEXT_FIELDS
    : PROFILE_INVARIANT_CONTEXT_FIELDS;
  if (!isObject(input) || !sameFields(input, expectedFields)) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
      "Invariant context fields do not match the local runtime contract."
    );
  }
  if (
    !isContentHash(input.sourcePopulationHash) ||
    !Array.isArray(input.elements) ||
    (graph.domain === "profile-quotient" && !Array.isArray(input.profileClasses))
  ) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
      "Invariant context requires its domain-specific source-population arrays."
    );
  }

  const required = new Set(requiredNames);
  const seen = new Set();
  const elements = input.elements.map((entry, index) => {
    if (!isObject(entry) || !sameFields(entry, INVARIANT_ELEMENT_FIELDS)) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
        "Invariant context element fields do not match the local runtime contract.",
        { index }
      );
    }
    if (!isContentHash(entry.elementId) || seen.has(entry.elementId) || !isObject(entry.invariants)) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
        "Invariant context elements require unique content IDs and invariant records.",
        { index, elementId: entry.elementId }
      );
    }
    seen.add(entry.elementId);
    const unknown = Object.keys(entry.invariants)
      .filter((name) => !required.has(name));
    if (unknown.length > 0) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
        "Invariant context contains values not required by the predicate plan.",
        { index, elementId: entry.elementId, unknown }
      );
    }
    const invariants = {};
    for (const name of Object.keys(entry.invariants).sort()) {
      try {
        invariants[name] = normalizeQuantity(entry.invariants[name]);
      } catch (error) {
        if (!(error instanceof KernelError)) throw error;
        fail(
          "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
          "Invariant context contains an invalid Quantity.",
          { index, elementId: entry.elementId, name, causeCode: error.code }
        );
      }
    }
    return { elementId: entry.elementId, invariants };
  }).sort((left, right) =>
    left.elementId < right.elementId ? -1 : left.elementId > right.elementId ? 1 : 0
  );

  let profileClasses = null;
  let expectedElementIds;
  if (graph.domain === "element-exact") {
    expectedElementIds = [...new Set(graph.nodes.map((node) => node.ref))].sort();
  } else {
    const seenProfiles = new Set();
    const seenMembers = new Set();
    const normalizedProfiles = input.profileClasses.map((entry, index) => {
      if (!isObject(entry) || !sameFields(entry, INVARIANT_PROFILE_CLASS_FIELDS)) {
        fail(
          "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
          "Invariant profile-class fields do not match the local runtime contract.",
          { index }
        );
      }
      if (
        !isContentHash(entry.profileHash) ||
        seenProfiles.has(entry.profileHash) ||
        !Array.isArray(entry.members) ||
        entry.members.length === 0
      ) {
        fail(
          "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
          "Invariant profile classes require unique profile IDs and non-empty member arrays.",
          { index, profileHash: entry.profileHash }
        );
      }
      seenProfiles.add(entry.profileHash);
      const members = [];
      const localMembers = new Set();
      for (const elementId of entry.members) {
        if (
          !isContentHash(elementId) ||
          localMembers.has(elementId) ||
          seenMembers.has(elementId)
        ) {
          fail(
            "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
            "Invariant profile members must be unique content-addressed elements.",
            { index, profileHash: entry.profileHash, elementId }
          );
        }
        localMembers.add(elementId);
        seenMembers.add(elementId);
        members.push(elementId);
      }
      return { profileHash: entry.profileHash, members: members.sort() };
    }).sort((left, right) =>
      left.profileHash < right.profileHash ? -1 : left.profileHash > right.profileHash ? 1 : 0
    );
    const expectedProfileHashes = [...new Set(graph.nodes.map((node) => node.ref))].sort();
    const actualProfileHashes = normalizedProfiles.map((entry) => entry.profileHash);
    if (canonicalize(actualProfileHashes) !== canonicalize(expectedProfileHashes)) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONTEXT_MISMATCH",
        "Invariant context profile IDs differ from the canonical candidate references.",
        { expectedProfileHashes, actualProfileHashes }
      );
    }
    profileClasses = new Map(normalizedProfiles.map((entry) => [entry.profileHash, entry]));
    expectedElementIds = [...seenMembers].sort();
  }
  const actualElementIds = elements.map((entry) => entry.elementId);
  if (canonicalize(actualElementIds) !== canonicalize(expectedElementIds)) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_CONTEXT_MISMATCH",
      "Invariant context element IDs differ from the required source-element set.",
      { expectedElementIds, actualElementIds }
    );
  }
  return {
    domain: graph.domain,
    sourcePopulationHash: input.sourcePopulationHash,
    elements: new Map(elements.map((entry) => [entry.elementId, entry])),
    profileClasses
  };
}

function selectedAttributeItems(expression, path, graph) {
  const selected = selectedSet(graph, expression.set);
  if (selected.indexes.length > LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues) {
    fail(
      "PREDICATE_LOCAL_SELECTED_VALUE_LIMIT",
      "Local attribute aggregation exceeds the selected-value limit.",
      {
        path,
        attribute: expression.attribute,
        selectedValues: selected.indexes.length,
        maximum: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues
      }
    );
  }
  const collection = expression.set.kind === "nodes" ? graph.nodes : graph.edges;
  const missingIndexes = [];
  const items = selected.indexes.flatMap((index) => {
    const attributes = collection[index].attrs;
    if (!attributes || !Object.prototype.hasOwnProperty.call(attributes, expression.attribute)) {
      missingIndexes.push(index);
      return [];
    }
    return [{ index, value: attributes[expression.attribute] }];
  });
  if (missingIndexes.length > 0) {
    fail(
      "PREDICATE_LOCAL_ATTRIBUTE_VALUE_UNAVAILABLE",
      "A selected candidate item does not provide the required structural attribute.",
      {
        path,
        attribute: expression.attribute,
        setKind: expression.set.kind,
        missingIndexes
      }
    );
  }
  return { items, selection: selected.selection };
}

function selectedNumberAttributeValues(expression, path, graph) {
  const selected = selectedAttributeItems(expression, path, graph);
  const invalidIndexes = [];
  const values = selected.items.flatMap(({ index, value }) => {
    if (typeof value === "number" && Number.isFinite(value)) return [parseDecimal(value)];
    invalidIndexes.push(index);
    return [];
  });
  if (invalidIndexes.length > 0) {
    fail(
      "PREDICATE_LOCAL_ATTRIBUTE_VALUE_INVALID",
      "A selected candidate attribute does not match its declared numeric runtime type.",
      {
        path,
        attribute: expression.attribute,
        setKind: expression.set.kind,
        invalidIndexes
      }
    );
  }
  return { values, selection: selected.selection };
}

function decimalMaximum(left, right) {
  return BigInt(subtractDecimals(left, right).coefficient) >= 0n ? left : right;
}

function decimalAbsolute(value) {
  const parsed = parseDecimal(value);
  return BigInt(parsed.coefficient) < 0n ? multiplyDecimals(parsed, -1) : parsed;
}

function quantityToleranceBound(quantity) {
  const absolute = parseDecimal(quantity.tolerance.absolute ?? 0);
  const relative = multiplyDecimals(
    parseDecimal(quantity.tolerance.relative ?? 0),
    parseDecimal(Math.abs(quantity.value))
  );
  return decimalMaximum(absolute, relative);
}

function nextPositiveBinary64(value) {
  if (value === 0) return Number.MIN_VALUE;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false);
  return view.getFloat64(0, false);
}

function outwardDecimalToNumber(value) {
  let converted;
  try {
    converted = decimalToNumber(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    if (error.code === "DECIMAL_NUMBER_UNDERFLOW") return Number.MIN_VALUE;
    if (error.code !== "DECIMAL_NUMBER_OVERFLOW") throw error;
    fail(
      "PREDICATE_LOCAL_QUANTITY_TOLERANCE_OVERFLOW",
      "Quantity aggregation tolerance cannot be represented as a finite outward binary64 bound.",
      { tolerance: parseDecimal(value).canonical }
    );
  }
  const difference = subtractDecimals(parseDecimal(converted), value);
  if (BigInt(difference.coefficient) >= 0n) return converted;
  const outward = nextPositiveBinary64(converted);
  if (!Number.isFinite(outward)) {
    fail(
      "PREDICATE_LOCAL_QUANTITY_TOLERANCE_OVERFLOW",
      "Quantity aggregation tolerance cannot be represented as a finite outward binary64 bound.",
      { tolerance: parseDecimal(value).canonical }
    );
  }
  return outward;
}

function selectedQuantityAttributeValues(expression, path, graph, attributeType) {
  const selected = selectedAttributeItems(expression, path, graph);
  const invalidIndexes = [];
  const unitMismatchIndexes = [];
  const semanticMismatchIndexes = [];
  const values = [];
  const toleranceBounds = [];
  const evidence = new Set();

  for (const { index, value } of selected.items) {
    let quantity;
    try {
      quantity = normalizeQuantity(value);
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      invalidIndexes.push(index);
      continue;
    }
    if (quantity.unit !== attributeType.unit) {
      unitMismatchIndexes.push(index);
      continue;
    }
    if (quantity.semantic !== attributeType.semantic) {
      semanticMismatchIndexes.push(index);
      continue;
    }
    values.push(parseDecimal(quantity.value));
    toleranceBounds.push(quantityToleranceBound(quantity));
    quantity.provenance.evidence.forEach((entry) => evidence.add(entry));
  }

  if (invalidIndexes.length > 0) {
    fail(
      "PREDICATE_LOCAL_ATTRIBUTE_VALUE_INVALID",
      "A selected candidate attribute does not match its declared quantity runtime type.",
      {
        path,
        attribute: expression.attribute,
        setKind: expression.set.kind,
        invalidIndexes
      }
    );
  }
  if (unitMismatchIndexes.length > 0) {
    fail(
      "PREDICATE_LOCAL_QUANTITY_UNIT_MISMATCH",
      "A selected quantity attribute does not match its declared canonical unit.",
      {
        path,
        attribute: expression.attribute,
        expectedUnit: attributeType.unit,
        unitMismatchIndexes
      }
    );
  }
  if (semanticMismatchIndexes.length > 0) {
    fail(
      "PREDICATE_LOCAL_QUANTITY_SEMANTIC_MISMATCH",
      "A selected quantity attribute does not match its declared semantic label.",
      {
        path,
        attribute: expression.attribute,
        expectedSemantic: attributeType.semantic,
        semanticMismatchIndexes
      }
    );
  }

  return {
    values,
    toleranceBounds,
    evidence: [...evidence].sort(),
    selection: selected.selection
  };
}

function resolveInvariantExpression(expression, path, graph, symbols, invariantContext) {
  if (invariantContext === null) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_CONTEXT_REQUIRED",
      "Runtime invariant resolution requires an explicit source-population context.",
      { path, name: expression.name }
    );
  }
  const nodeIndexes = expression.node === undefined
    ? graph.nodes.length === 1 ? [0] : []
    : selectedNodes(graph, expression.node);
  if (nodeIndexes.length !== 1) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_NODE_AMBIGUOUS",
      "An invariant expression must resolve exactly one canonical candidate node.",
      {
        path,
        name: expression.name,
        selector: expression.node ?? null,
        nodeIndexes
      }
    );
  }
  const canonicalNode = nodeIndexes[0];
  const sourceRef = graph.nodes[canonicalNode].ref;
  let quantity;
  let witnessBasis;
  if (invariantContext.domain === "element-exact") {
    const element = invariantContext.elements.get(sourceRef);
    quantity = element?.invariants[expression.name];
    if (quantity === undefined) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_VALUE_UNAVAILABLE",
        "The selected element does not provide the required invariant value.",
        { path, name: expression.name, canonicalNode, elementId: sourceRef }
      );
    }
    witnessBasis = { elementId: sourceRef };
  } else {
    const profileClass = invariantContext.profileClasses.get(sourceRef);
    const missingElementIds = profileClass.members.filter((elementId) =>
      invariantContext.elements.get(elementId)?.invariants[expression.name] === undefined
    );
    if (missingElementIds.length > 0) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE",
        "A selected profile class does not provide the invariant for every member.",
        {
          path,
          name: expression.name,
          canonicalNode,
          profileHash: sourceRef,
          reason: "member-values-missing",
          missingElementIds
        }
      );
    }
    const memberQuantities = profileClass.members.map((elementId) =>
      invariantContext.elements.get(elementId).invariants[expression.name]
    );
    const firstCanonical = canonicalize(memberQuantities[0]);
    const disagreeingElementIds = profileClass.members.filter((elementId, index) =>
      canonicalize(memberQuantities[index]) !== firstCanonical
    );
    if (disagreeingElementIds.length > 0) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE",
        "A selected profile class does not have one identical normalized invariant Quantity.",
        {
          path,
          name: expression.name,
          canonicalNode,
          profileHash: sourceRef,
          reason: "member-values-disagree",
          memberElementIds: profileClass.members,
          disagreeingElementIds
        }
      );
    }
    quantity = memberQuantities[0];
    witnessBasis = {
      profileHash: sourceRef,
      memberElementIds: [...profileClass.members],
      consensusPolicy: PROFILE_INVARIANT_CONSENSUS_POLICY
    };
  }
  const descriptor = symbols.invariants[expression.name];
  if (quantity.unit !== descriptor.unit) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_UNIT_MISMATCH",
      "The resolved invariant does not match its declared canonical unit.",
      {
        path,
        name: expression.name,
        canonicalNode,
        ...witnessBasis,
        expectedUnit: descriptor.unit,
        actualUnit: quantity.unit
      }
    );
  }
  if (quantity.semantic !== descriptor.semantic) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_SEMANTIC_MISMATCH",
      "The resolved invariant does not match its declared semantic label.",
      {
        path,
        name: expression.name,
        canonicalNode,
        ...witnessBasis,
        expectedSemantic: descriptor.semantic,
        actualSemantic: quantity.semantic
      }
    );
  }
  return {
    quantity,
    witness: {
      expressionPath: path,
      name: expression.name,
      canonicalNode,
      ...witnessBasis,
      quantity
    }
  };
}

function evaluateNumberExpression(expression, path, graph, numericPolicy) {
  if (expression.kind === "constant") {
    return {
      unrounded: parseDecimal(expression.value),
      exact: true,
      selections: [],
      invariants: []
    };
  }
  if (expression.kind === "count") {
    const selected = selectedSet(graph, expression.set);
    return {
      unrounded: parseDecimal(selected.indexes.length),
      exact: true,
      selections: [{
        expressionPath: path,
        ...selected.selection
      }],
      invariants: []
    };
  }
  if (expression.kind === "sum") {
    const selected = selectedNumberAttributeValues(expression, path, graph);
    const accumulation = accumulateDecimals(
      selected.values,
      numericPolicy.summation.algorithm
    );
    return {
      unrounded: accumulation.value,
      exact: accumulation.exact,
      selections: [{
        expressionPath: path,
        ...selected.selection,
        attribute: expression.attribute,
        valueKind: "number",
        summation: accumulation.algorithm,
        accumulationExact: accumulation.exact
      }],
      invariants: []
    };
  }
  const field = expression.kind === "add" ? "terms" : "factors";
  const children = expression[field].map((child, index) =>
    evaluateNumberExpression(child, `${path}.${field}[${index}]`, graph, numericPolicy)
  );
  const operation = expression.kind === "add" ? addDecimals : multiplyDecimals;
  const identity = expression.kind === "add" ? 0 : 1;
  return {
    unrounded: children.reduce(
      (value, child) => operation(value, child.unrounded),
      parseDecimal(identity)
    ),
    exact: children.every((child) => child.exact),
    selections: children.flatMap((child) => child.selections),
    invariants: children.flatMap((child) => child.invariants)
  };
}

function quantityEvidenceUnion(children) {
  const evidence = new Set();
  children.forEach((child) => child.evidence.forEach((entry) => evidence.add(entry)));
  return [...evidence].sort();
}

function evaluateQuantityExpression(
  expression,
  path,
  graph,
  numericPolicy,
  symbols,
  invariantContext
) {
  if (expression.kind === "constant") {
    const quantity = normalizeQuantity(expression.value);
    return {
      unrounded: parseDecimal(quantity.value),
      exact: true,
      unit: quantity.unit,
      semantic: quantity.semantic,
      tolerance: quantityToleranceBound(quantity),
      evidence: [...quantity.provenance.evidence],
      directQuantity: quantity,
      method: null,
      selections: [],
      invariants: []
    };
  }
  if (expression.kind === "invariant") {
    const resolved = resolveInvariantExpression(
      expression,
      path,
      graph,
      symbols,
      invariantContext
    );
    return {
      unrounded: parseDecimal(resolved.quantity.value),
      exact: true,
      unit: resolved.quantity.unit,
      semantic: resolved.quantity.semantic,
      tolerance: quantityToleranceBound(resolved.quantity),
      evidence: [...resolved.quantity.provenance.evidence],
      directQuantity: resolved.quantity,
      method: null,
      selections: [],
      invariants: [resolved.witness]
    };
  }
  if (expression.kind === "sum") {
    const attributeType = symbols.attributes[expression.attribute];
    const selected = selectedQuantityAttributeValues(
      expression,
      path,
      graph,
      attributeType
    );
    const accumulation = accumulateDecimals(
      selected.values,
      numericPolicy.summation.algorithm
    );
    return {
      unrounded: accumulation.value,
      exact: accumulation.exact,
      unit: attributeType.unit,
      semantic: attributeType.semantic,
      tolerance: accumulateDecimals(selected.toleranceBounds, "exact-decimal").value,
      evidence: selected.evidence,
      directQuantity: null,
      method: QUANTITY_SUM_METHOD,
      selections: [{
        expressionPath: path,
        ...selected.selection,
        attribute: expression.attribute,
        valueKind: "quantity",
        summation: accumulation.algorithm,
        accumulationExact: accumulation.exact,
        quantityUnit: attributeType.unit,
        quantitySemantic: attributeType.semantic,
        toleranceAggregation: QUANTITY_TOLERANCE_AGGREGATION
      }],
      invariants: []
    };
  }

  if (expression.kind === "multiply") {
    const factors = expression.factors.map((factor, index) => {
      const factorPath = `${path}.factors[${index}]`;
      return staticQuantityDescriptor(factor, symbols) === null
        ? {
            mode: "number",
            result: evaluateNumberExpression(factor, factorPath, graph, numericPolicy)
          }
        : {
            mode: "quantity",
            result: evaluateQuantityExpression(
              factor,
              factorPath,
              graph,
              numericPolicy,
              symbols,
              invariantContext
            )
          };
    });
    const quantityFactors = factors.filter((factor) => factor.mode === "quantity");
    if (quantityFactors.length !== 1) {
      fail(
        "PREDICATE_LOCAL_QUANTITY_SCALE_INVALID",
        "Quantity scaling requires exactly one Quantity-valued factor.",
        { path, quantityFactors: quantityFactors.length }
      );
    }
    const quantity = quantityFactors[0].result;
    const scalar = factors
      .filter((factor) => factor.mode === "number")
      .reduce(
        (value, factor) => multiplyDecimals(value, factor.result.unrounded),
        parseDecimal(1)
      );
    return {
      unrounded: multiplyDecimals(scalar, quantity.unrounded),
      exact: factors.every((factor) => factor.result.exact),
      unit: quantity.unit,
      semantic: quantity.semantic,
      tolerance: multiplyDecimals(decimalAbsolute(scalar), quantity.tolerance),
      evidence: [...quantity.evidence],
      directQuantity: null,
      method: QUANTITY_SCALE_METHOD,
      selections: factors.flatMap((factor) => factor.result.selections),
      invariants: factors.flatMap((factor) => factor.result.invariants)
    };
  }

  const children = expression.terms.map((child, index) =>
    evaluateQuantityExpression(
      child,
      `${path}.terms[${index}]`,
      graph,
      numericPolicy,
      symbols,
      invariantContext
    )
  );
  const first = children[0];
  if (!children.every((child) =>
    child.unit === first.unit && child.semantic === first.semantic
  )) {
    fail(
      "PREDICATE_LOCAL_QUANTITY_ADD_MISMATCH",
      "Quantity addition operands do not share one canonical unit and semantic label.",
      {
        path,
        operands: children.map((child) => ({ unit: child.unit, semantic: child.semantic }))
      }
    );
  }
  return {
    unrounded: children.reduce(
      (value, child) => addDecimals(value, child.unrounded),
      parseDecimal(0)
    ),
    exact: children.every((child) => child.exact),
    unit: first.unit,
    semantic: first.semantic,
    tolerance: accumulateDecimals(
      children.map((child) => child.tolerance),
      "exact-decimal"
    ).value,
    evidence: quantityEvidenceUnion(children),
    directQuantity: null,
    method: QUANTITY_ADD_METHOD,
    selections: children.flatMap((child) => child.selections),
    invariants: children.flatMap((child) => child.invariants)
  };
}

function evaluatedQuantity(expression, path, graph, numericPolicy, symbols, invariantContext) {
  const result = evaluateQuantityExpression(
    expression,
    path,
    graph,
    numericPolicy,
    symbols,
    invariantContext
  );
  const rounded = roundDecimal(result.unrounded, numericPolicy.precision);
  const quantity = result.directQuantity === null
    ? normalizeQuantity({
        value: decimalToNumber(rounded),
        unit: result.unit,
        tolerance: { absolute: outwardDecimalToNumber(result.tolerance) },
        semantic: result.semantic,
        provenance: {
          kind: "computed",
          method: result.method,
          evidence: result.evidence
        }
      })
    : normalizeQuantity({
        ...result.directQuantity,
        value: decimalToNumber(rounded)
      });
  return {
    value: {
      kind: "quantity",
      unrounded: result.unrounded,
      rounded,
      exact: result.exact,
      quantity
    },
    selections: result.selections,
    invariants: result.invariants
  };
}

function evaluatedNumber(expression, path, graph, numericPolicy) {
  const result = evaluateNumberExpression(expression, path, graph, numericPolicy);
  return {
    value: {
      kind: "number",
      unrounded: result.unrounded,
      rounded: roundDecimal(result.unrounded, numericPolicy.precision),
      exact: result.exact
    },
    selections: result.selections,
    invariants: result.invariants
  };
}

function evaluatedScalar(expression) {
  return {
    value: {
      kind: constantMode(expression.value),
      value: expression.value
    },
    selections: [],
    invariants: []
  };
}

function evaluateValue(expression, path, graph, numericPolicy, symbols, invariantContext) {
  const inspection = {
    unsupported: [],
    valueNodes: 0,
    selectionWitnesses: 0,
    symbols,
    nodeAttributes: new Set(),
    edgeAttributes: new Set()
  };
  const mode = inspectValueExpression(expression, path, inspection);
  if (mode === "number") return evaluatedNumber(expression, path, graph, numericPolicy);
  if (mode === "quantity") {
    return evaluatedQuantity(
      expression,
      path,
      graph,
      numericPolicy,
      symbols,
      invariantContext
    );
  }
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
    context.numericPolicy,
    context.symbols,
    context.invariantContext
  );
  const right = evaluateValue(
    expression.right,
    `${path}.right`,
    context.graph,
    context.numericPolicy,
    context.symbols,
    context.invariantContext
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
      selections: [...left.selections, ...right.selections],
      invariants: [...left.invariants, ...right.invariants]
    }]
  };
}

function balanceEvaluator(expression, path, context) {
  const tolerance = normalizeQuantity(expression.tolerance);
  const declaredType = context.symbols.attributes[expression.attribute];
  const sum = {
    kind: "sum",
    attribute: expression.attribute,
    set: expression.over
  };
  let aggregate;
  let magnitude;
  if (declaredType.kind === "number") {
    aggregate = evaluatedNumber(sum, path, context.graph, context.numericPolicy);
    magnitude = normalizeQuantity({
      value: decimalToNumber(decimalAbsolute(aggregate.value.rounded)),
      unit: "1",
      tolerance: { absolute: 0 },
      semantic: tolerance.semantic,
      provenance: {
        kind: "computed",
        method: NUMBER_BALANCE_MAGNITUDE_METHOD,
        evidence: []
      }
    });
  } else {
    const attributeType = typeof declaredType.semantic === "string"
      ? declaredType
      : { ...declaredType, semantic: tolerance.semantic };
    aggregate = evaluatedQuantity(
      sum,
      path,
      context.graph,
      context.numericPolicy,
      {
        ...context.symbols,
        attributes: {
          ...context.symbols.attributes,
          [expression.attribute]: attributeType
        }
      },
      context.invariantContext
    );
    magnitude = normalizeQuantity({
      ...aggregate.value.quantity,
      value: Math.abs(aggregate.value.quantity.value)
    });
  }
  const compared = compareQuantities(magnitude, "lte", tolerance, {
    semanticPolicy: context.numericPolicy.quantityComparison.semanticPolicy
  });
  const outcome = compared.pass ? "pass" : "fail";
  return {
    outcome,
    witnesses: [{
      expressionPath: path,
      operator: "balance",
      outcome,
      attribute: expression.attribute,
      aggregate: aggregate.value,
      tolerance,
      comparison: { kind: "quantity", ...compared },
      selections: aggregate.selections
    }]
  };
}

export function evaluateLocalPredicatePlan(planInput, numericBindingInput, candidate, options = {}) {
  const localOptions = normalizedLocalOptions(options);
  const verified = verifyPredicatePlan(planInput);
  assertLocalPredicatePlanSupported(verified.plan);
  const numericBinding = verifyNumericBinding(verified.plan, numericBindingInput);
  const canonical = canonicalizeCandidate(candidate, localOptions.canonicalization);
  const invariantContext = normalizeInvariantContext(
    localOptions.invariantContext,
    canonical.canonical,
    verified.plan.requirements.invariants
  );
  const result = evaluateCanonicalPredicateExpression(verified.analysis.expression, "$", {
    graph: canonical.canonical,
    graphPolicy: canonical.graphPolicy,
    partial: false,
    nodesComplete: true,
    numericPolicy: numericBinding.numericPolicy,
    symbols: verified.plan.symbols,
    invariantContext,
    evaluateCompare: compareEvaluator,
    evaluateBalance: balanceEvaluator
  });
  const basis = {
    schemaVersion: "1",
    evaluator: LOCAL_PREDICATE_EVALUATOR_VERSION,
    predicatePlanHash: verified.plan.planHash,
    numericBindingHash: numericBinding.bindingHash,
    candidateId: canonical.candidateId,
    ...(invariantContext === null
      ? {}
      : { invariantSourcePopulationHash: invariantContext.sourcePopulationHash }),
    graphPolicy: canonical.graphPolicy,
    outcome: result.outcome,
    witnesses: result.witnesses
  };
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(HASH_DOMAINS.PREDICATE_LOCAL_EVALUATION, basis)
  });
}
