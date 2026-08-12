import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  accumulateDecimals,
  addDecimals,
  decimalToNumber,
  divideDecimals,
  multiplyDecimals,
  parseDecimal,
  roundDecimal,
  subtractDecimals
} from "./decimal.js";
import { KernelError, KernelValidationError } from "./errors.js";
import { INVARIANT_STRING_MAX_LENGTH } from "./invariant.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { evaluateCanonicalPredicateExpression } from "./graph-predicate-evaluator.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { verifyPredicatePlan } from "./predicate-plan-verifier.js";
import { compareQuantities, normalizeQuantity, parseUnitExpression } from "./quantity.js";
import {
  PROFILE_INVARIANT_AGGREGATION_POLICY,
  aggregateProfileInvariantValues
} from "./profile-invariant-aggregation.js";

export const LOCAL_PREDICATE_EVALUATOR_VERSION = "local-predicate-evaluator-v19";
export const LOCAL_PREDICATE_EVALUATION_LIMITS = deepFreeze({
  maxValueNodes: 10_000,
  maxSelectionWitnesses: 10_000,
  maxSelectedValues: 5_000,
  maxSubstructureRemovals: 10_000
});

const QUANTITY_SUM_METHOD = "local-quantity-attribute-sum-v1";
const QUANTITY_ADD_METHOD = "local-quantity-add-v1";
const QUANTITY_SCALE_METHOD = "local-quantity-scale-v1";
const QUANTITY_PRODUCT_METHOD = "local-quantity-product-v1";
const NUMBER_BALANCE_MAGNITUDE_METHOD = "local-number-balance-magnitude-v1";
const QUANTITY_TOLERANCE_AGGREGATION = "sum-effective-absolute-bounds-v1";
const PROFILE_QUANTITY_INVARIANT_CONSENSUS_POLICY =
  "identical-normalized-quantity-v1";
const PROFILE_SCALAR_INVARIANT_CONSENSUS_POLICY =
  "identical-normalized-scalar-v1";
const CYCLE_EDGE_SELECTION_METHOD = "directed-cycle-edge-union-v1";
const MINIMAL_SUBSTRUCTURE_ENUMERATION_METHOD =
  "exhaustive-proper-subgraphs-v1";
const NOVEL_CONSTITUENT_PROJECTION_METHOD =
  "canonical-single-node-no-edge-v1";
const EXACT_STABLE_PERTURBATION_ENUMERATION_METHOD =
  "exhaustive-valid-single-edits-v1";
const SAMPLED_STABLE_PERTURBATION_ENUMERATION_METHOD =
  "sampled-valid-single-edits-v1";
const STABLE_PERTURBATION_ENUMERATION_METHODS = new Set([
  EXACT_STABLE_PERTURBATION_ENUMERATION_METHOD,
  SAMPLED_STABLE_PERTURBATION_ENUMERATION_METHOD
]);
const EXACT_STABLE_DECISION_RULE = "exact-three-valued-bounds-v1";
const SAMPLED_STABLE_DECISION_RULE =
  "chebyshev-union-95-three-valued-bounds-v1";
const PERTURBATION_SAMPLING_ALGORITHM =
  "sha256-rejection-counter-v1";
const PERTURBATION_SAMPLING_FRAME =
  "applicable-single-edit-attempts-v1";
const PERTURBATION_SAMPLING_REPLACEMENT = "with-replacement";
const PERTURBATION_SAMPLING_UNCERTAINTY =
  "chebyshev-union-95-v1";
const PERTURBATION_SAMPLING_BOUND_SCALE = 6;
const LOCAL_OPTION_FIELDS = new Set([
  "policy",
  "limits",
  "invariantContext",
  "substructurePolicy",
  "perturbationContext"
]);
const EXACT_INVARIANT_CONTEXT_FIELDS = new Set(["sourcePopulationHash", "elements"]);
const PROFILE_INVARIANT_CONTEXT_FIELDS = new Set([
  "sourcePopulationHash",
  "elements",
  "profileClasses"
]);
const INVARIANT_ELEMENT_FIELDS = new Set(["elementId", "invariants"]);
const INVARIANT_PROFILE_CLASS_FIELDS = new Set(["profileHash", "members"]);
const SUBSTRUCTURE_POLICY_FIELDS = new Set([
  "id",
  "remove",
  "includeDisconnected",
  "includeEmpty",
  "retainIsolatedNodes"
]);
const SUBSTRUCTURE_REMOVAL_POLICIES = new Set([
  "nodes",
  "edges",
  "nodes-and-edges"
]);
const PERTURBATION_CONTEXT_FIELDS = new Set(["definitions", "sampling"]);
const PERTURBATION_SAMPLING_FIELDS = new Set([
  "algorithm",
  "frame",
  "replacement",
  "uncertainty",
  "sampleSize",
  "streamKey"
]);
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
    invariantContext: value.invariantContext,
    substructurePolicy: value.substructurePolicy,
    perturbationContext: value.perturbationContext
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
    if (descriptors.length === 1) return descriptors[0];
    if (
      descriptors.length > 1 &&
      typeof expression.resultSemantic === "string"
    ) {
      const units = descriptors
        .map((descriptor) => descriptor.unit)
        .filter((unit) => unit !== "1");
      return {
        unit: parseUnitExpression(units.length === 0 ? "1" : units.join("*")).canonicalUnit,
        semantic: expression.resultSemantic
      };
    }
    return null;
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
    if (
      invariantType?.kind === "number" ||
      invariantType?.kind === "string" ||
      invariantType?.kind === "boolean" ||
      invariantType?.kind === "null"
    ) {
      return invariantType.kind;
    }
    if (invariantType?.kind === "quantity") {
      if (typeof invariantType.semantic === "string") return "quantity";
      context.unsupported.push({
        path,
        feature: "invariant",
        reason: "quantity-invariant-semantic-not-declared"
      });
      return null;
    }
    context.unsupported.push({
      path,
      feature: "invariant",
      reason: "runtime-invariant-type-not-supported"
    });
    return null;
  }
  if (expression.kind === "count") {
    context.selectionWitnesses += 1;
    inspectSetAttributes(expression.set, context);
    return "number";
  }
  if (expression.kind === "sum") {
    context.selectionWitnesses += 1;
    inspectSetAttributes(expression.set, context);
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
      quantityFactors >= 1 &&
      modes.every((mode) => mode === "number" || mode === "quantity") &&
      (quantityFactors === 1 || typeof expression.resultSemantic === "string")
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
    const leftMode = inspectValueExpression(
      expression.left,
      `${path}.left`,
      context
    );
    const rightMode = inspectValueExpression(
      expression.right,
      `${path}.right`,
      context
    );
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
  if (
    expression.op === "minimal" ||
    expression.op === "irreducibleRemoval" ||
    expression.op === "novel" ||
    expression.op === "stableUnder"
  ) {
    inspectPredicateExpression(
      expression.predicate,
      `${path}.predicate`,
      context
    );
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

function collectSubstructureRequirements(expression, requirements = {
  minimal: false,
  policies: new Set(),
  removalModes: new Set()
}) {
  if (expression.op === "all" || expression.op === "any") {
    expression.args.forEach((child) =>
      collectSubstructureRequirements(child, requirements)
    );
  } else if (expression.op === "not") {
    collectSubstructureRequirements(expression.arg, requirements);
  } else if (expression.op === "minimal") {
    requirements.minimal = true;
    if (expression.policy !== undefined) requirements.policies.add(expression.policy);
    collectSubstructureRequirements(expression.predicate, requirements);
  } else if (expression.op === "irreducibleRemoval") {
    requirements.removalModes.add(expression.removal);
    collectSubstructureRequirements(expression.predicate, requirements);
  } else if (expression.op === "novel") {
    collectSubstructureRequirements(expression.predicate, requirements);
  } else if (expression.op === "stableUnder") {
    collectSubstructureRequirements(expression.predicate, requirements);
  }
  return requirements;
}

function normalizeSubstructurePolicyForPlan(plan, input) {
  const requirements = collectSubstructureRequirements(plan.expression);
  if (!requirements.minimal && requirements.removalModes.size === 0) {
    if (input !== undefined) {
      fail(
        "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_UNEXPECTED",
        "Substructure policy was supplied to a plan without an executable substructure operator."
      );
    }
    return null;
  }
  if (input === undefined) {
    fail(
      "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_REQUIRED",
      "Substructure evaluation requires the explicit run substructure policy.",
      {
        minimal: requirements.minimal,
        removalModes: [...requirements.removalModes].sort(),
        referencedPolicies: [...requirements.policies].sort()
      }
    );
  }
  if (!isObject(input) || !sameFields(input, SUBSTRUCTURE_POLICY_FIELDS)) {
    fail(
      "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_INVALID",
      "Substructure policy fields do not match the local runtime contract."
    );
  }
  if (
    typeof input.id !== "string" ||
    input.id.length === 0 ||
    input.id.length > 1_024 ||
    input.id !== input.id.trim() ||
    /[\r\n]/.test(input.id) ||
    !SUBSTRUCTURE_REMOVAL_POLICIES.has(input.remove) ||
    [
      input.includeDisconnected,
      input.includeEmpty,
      input.retainIsolatedNodes
    ].some((value) => typeof value !== "boolean")
  ) {
    fail(
      "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_INVALID",
      "Substructure policy values do not match the local runtime contract.",
      { policyId: input.id, remove: input.remove }
    );
  }
  const mismatchedPolicies = [...requirements.policies]
    .filter((policyId) => policyId !== input.id)
    .sort();
  if (mismatchedPolicies.length > 0) {
    fail(
      "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_MISMATCH",
      "A minimal predicate references a policy other than the bound run policy.",
      {
        policyId: input.id,
        referencedPolicies: [...requirements.policies].sort(),
        mismatchedPolicies
      }
    );
  }
  const disallowed = [...requirements.removalModes].filter((mode) =>
    input.remove !== "nodes-and-edges" && input.remove !== `${mode}s`
  ).sort();
  if (disallowed.length > 0) {
    fail(
      "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_MISMATCH",
      "The run substructure policy does not permit every requested irreducible removal.",
      { policyId: input.id, remove: input.remove, disallowed }
    );
  }
  return deepFreeze({
    id: input.id,
    remove: input.remove,
    includeDisconnected: input.includeDisconnected,
    includeEmpty: input.includeEmpty,
    retainIsolatedNodes: input.retainIsolatedNodes
  });
}

export function assertLocalPredicateSubstructurePolicy(planInput, input) {
  const verified = verifyPredicatePlan(planInput);
  assertLocalPredicatePlanSupported(verified.plan);
  return normalizeSubstructurePolicyForPlan(verified.plan, input);
}

function validPerturbationIdentifier(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1_024 &&
    value === value.trim() &&
    !/[\r\n]/.test(value);
}

function normalizePerturbationStringList(value, details) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 256 ||
    value.some((entry) => !validPerturbationIdentifier(entry)) ||
    new Set(value).size !== value.length
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
      "Perturbation string lists require unique normalized non-empty values.",
      details
    );
  }
  return [...value].sort();
}

function normalizePerturbationDefinition(input, index) {
  if (!isObject(input) || !validPerturbationIdentifier(input.id)) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
      "Perturbation definitions require a normalized non-empty identifier.",
      { index, id: input?.id }
    );
  }
  const allowed = PERTURBATION_FIELDS[input.kind];
  if (
    allowed === undefined ||
    Object.keys(input).some((field) => !allowed.has(field)) ||
    !STABLE_PERTURBATION_ENUMERATION_METHODS.has(input.enumeration) ||
    !new Set(["indeterminate", "vacuous-pass"]).has(input.emptyPolicy)
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
      "Perturbation definition fields, kind, enumeration, or empty policy do not match the exact runtime contract.",
      { index, id: input.id, kind: input.kind }
    );
  }
  const common = {
    id: input.id,
    kind: input.kind,
    enumeration: input.enumeration,
    emptyPolicy: input.emptyPolicy
  };
  if (input.kind === "edge-deletion") {
    return {
      ...common,
      ...(input.roles === undefined
        ? {}
        : {
            roles: normalizePerturbationStringList(input.roles, {
              index,
              id: input.id,
              field: "roles"
            })
          })
    };
  }
  if (input.kind === "node-deletion") {
    if (!sameFields(input, PERTURBATION_FIELDS["node-deletion"])) {
      fail(
        "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
        "Node-deletion definition fields do not match the normalized runtime contract.",
        { index, id: input.id }
      );
    }
    return common;
  }
  if (input.kind === "edge-role-replacement") {
    if (
      !Object.prototype.hasOwnProperty.call(input, "replacements") ||
      !Array.isArray(input.replacements) ||
      input.replacements.length === 0 ||
      input.replacements.length > 256
    ) {
      fail(
        "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
        "Role-replacement perturbations require a non-empty replacement list.",
        { index, id: input.id }
      );
    }
    const replacements = input.replacements.map((entry, replacementIndex) => {
      if (
        !isObject(entry) ||
        !sameFields(entry, new Set(["from", "to"])) ||
        !validPerturbationIdentifier(entry.from) ||
        !validPerturbationIdentifier(entry.to) ||
        entry.from === entry.to
      ) {
        fail(
          "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
          "Role replacements must contain distinct normalized from/to roles.",
          { index, replacementIndex, id: input.id }
        );
      }
      return { from: entry.from, to: entry.to };
    }).sort((left, right) => {
      const leftKey = canonicalize(left);
      const rightKey = canonicalize(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
    if (
      new Set(replacements.map((replacement) => canonicalize(replacement))).size !==
      replacements.length
    ) {
      fail(
        "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
        "Role-replacement perturbations cannot contain duplicate replacements.",
        { index, id: input.id }
      );
    }
    return { ...common, replacements };
  }
  if (
    !sameFields(input, PERTURBATION_FIELDS["numeric-attribute-displacement"]) ||
    !new Set(["nodes", "edges"]).has(input.target) ||
    !validPerturbationIdentifier(input.attribute) ||
    typeof input.epsilon !== "number" ||
    !Number.isFinite(input.epsilon) ||
    input.epsilon <= 0 ||
    !Array.isArray(input.directions) ||
    input.directions.length === 0 ||
    input.directions.length > 2 ||
    input.directions.some((direction) =>
      direction !== "decrease" && direction !== "increase"
    ) ||
    new Set(input.directions).size !== input.directions.length
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID",
      "Numeric-attribute displacement does not match the normalized finite runtime contract.",
      { index, id: input.id }
    );
  }
  return {
    ...common,
    target: input.target,
    attribute: input.attribute,
    epsilon: input.epsilon,
    directions: [...input.directions].sort()
  };
}

function normalizePerturbationContextForPlan(plan, input) {
  const requiredIds = [...plan.requirements.perturbations].sort();
  if (requiredIds.length === 0) {
    if (input !== undefined) {
      fail(
        "PREDICATE_LOCAL_PERTURBATION_CONTEXT_UNEXPECTED",
        "Perturbation context was supplied to a plan without stableUnder."
      );
    }
    return null;
  }
  if (
    !isObject(input) ||
    Object.keys(input).some((field) => !PERTURBATION_CONTEXT_FIELDS.has(field)) ||
    !Array.isArray(input.definitions)
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_REQUIRED",
      "stableUnder requires an explicit context of executable perturbation definitions.",
      { requiredPerturbations: requiredIds }
    );
  }
  const definitions = input.definitions
    .map(normalizePerturbationDefinition)
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const actualIds = definitions.map((definition) => definition.id);
  if (
    new Set(actualIds).size !== actualIds.length ||
    canonicalize(actualIds) !== canonicalize(requiredIds)
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_MISMATCH",
      "Perturbation context must contain every and only the definitions required by the plan.",
      { requiredPerturbations: requiredIds, actualPerturbations: actualIds }
    );
  }
  const sampledDefinitions = definitions.filter((definition) =>
    definition.enumeration === SAMPLED_STABLE_PERTURBATION_ENUMERATION_METHOD
  );
  let sampling;
  if (sampledDefinitions.length === 0) {
    if (input.sampling !== undefined) {
      fail(
        "PREDICATE_LOCAL_PERTURBATION_SAMPLING_UNEXPECTED",
        "Sampling configuration was supplied without a sampled perturbation definition."
      );
    }
  } else {
    const supplied = input.sampling;
    if (
      !isObject(supplied) ||
      !sameFields(supplied, PERTURBATION_SAMPLING_FIELDS) ||
      supplied.algorithm !== PERTURBATION_SAMPLING_ALGORITHM ||
      supplied.frame !== PERTURBATION_SAMPLING_FRAME ||
      supplied.replacement !== PERTURBATION_SAMPLING_REPLACEMENT ||
      supplied.uncertainty !== PERTURBATION_SAMPLING_UNCERTAINTY ||
      !Number.isSafeInteger(supplied.sampleSize) ||
      supplied.sampleSize < 0 ||
      !isContentHash(supplied.streamKey)
    ) {
      fail(
        "PREDICATE_LOCAL_PERTURBATION_SAMPLING_INVALID",
        "Sampled perturbations require the frozen stream, frame, replacement, uncertainty, size, and stream-key contract.",
        {
          sampledPerturbations: sampledDefinitions.map((definition) =>
            definition.id
          )
        }
      );
    }
    sampling = {
      algorithm: supplied.algorithm,
      frame: supplied.frame,
      replacement: supplied.replacement,
      uncertainty: supplied.uncertainty,
      sampleSize: supplied.sampleSize,
      streamKey: supplied.streamKey
    };
  }
  const basis = {
    schemaVersion: "1",
    definitions,
    ...(sampling === undefined ? {} : { sampling })
  };
  return Object.freeze({
    definitions: deepFreeze(definitions),
    definitionsById: new Map(
      definitions.map((definition) => [definition.id, definition])
    ),
    ...(sampling === undefined ? {} : { sampling: deepFreeze(sampling) }),
    contextHash: hashCanonical(HASH_DOMAINS.PERTURBATION_CONTEXT, basis)
  });
}

export function assertLocalPredicatePerturbationContext(planInput, input) {
  const verified = verifyPredicatePlan(planInput);
  assertLocalPredicatePlanSupported(verified.plan);
  const context = normalizePerturbationContextForPlan(verified.plan, input);
  return context === null
    ? null
    : deepFreeze({
        definitions: context.definitions,
        ...(context.sampling === undefined
          ? {}
          : { sampling: context.sampling }),
        perturbationContextHash: context.contextHash
      });
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

function selectedCycleEdges(graph, roles) {
  const eligible = selectedEdges(graph, roles);
  const adjacency = Array.from({ length: graph.nodes.length }, () => []);
  eligible.forEach((index) => {
    const edge = graph.edges[index];
    adjacency[edge.from].push(edge.to);
  });
  adjacency.forEach((neighbors) => neighbors.sort((left, right) => left - right));

  function reaches(start, target) {
    if (start === target) return true;
    const seen = new Set([start]);
    const pending = [start];
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const node = pending[cursor];
      for (const neighbor of adjacency[node]) {
        if (neighbor === target) return true;
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        pending.push(neighbor);
      }
    }
    return false;
  }

  return eligible.filter((index) => {
    const edge = graph.edges[index];
    return reaches(edge.to, edge.from);
  });
}

export function selectCanonicalValueSet(graph, set) {
  const nodeIndexes = set.kind === "nodes"
    ? selectedNodes(graph, set.selector)
    : undefined;
  const edgeIndexes = set.kind === "edges"
    ? selectedEdges(graph, set.roles)
    : set.kind === "cycle"
      ? selectedCycleEdges(graph, set.roles)
      : undefined;
  const indexes = nodeIndexes ?? edgeIndexes;
  return {
    indexes,
    selection: {
      setKind: set.kind,
      count: indexes.length,
      ...(nodeIndexes === undefined ? {} : { nodeIndexes }),
      ...(edgeIndexes === undefined ? {} : { edgeIndexes }),
      ...(set.roles === undefined ? {} : { roles: set.roles }),
      ...(set.kind === "cycle"
        ? { cycleSelection: CYCLE_EDGE_SELECTION_METHOD }
        : {})
    }
  };
}

function normalizeInvariantRuntimeValue(value, descriptor, details) {
  if (descriptor?.kind === "quantity") {
    try {
      return normalizeQuantity(value);
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      fail(
        "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
        "Invariant context contains an invalid Quantity.",
        { ...details, causeCode: error.code }
      );
    }
  }
  if (descriptor?.kind === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Object.is(value, -0) ? 0 : value;
    }
  } else if (descriptor?.kind === "string") {
    if (
      typeof value === "string" &&
      value.length <= INVARIANT_STRING_MAX_LENGTH
    ) {
      return value;
    }
  } else if (descriptor?.kind === "boolean") {
    if (typeof value === "boolean") return value;
  } else if (descriptor?.kind === "null") {
    if (value === null) return null;
  }
  fail(
    "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID",
    "Invariant context value does not match its declared runtime type or value limits.",
    {
      ...details,
      expectedKind: descriptor?.kind ?? null,
      ...(descriptor?.kind === "string" && typeof value === "string"
        ? {
            maximumLength: INVARIANT_STRING_MAX_LENGTH,
            actualLength: value.length
          }
        : {})
    }
  );
}

function normalizeInvariantContext(input, graph, requiredNames, symbols) {
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
      invariants[name] = normalizeInvariantRuntimeValue(
        entry.invariants[name],
        symbols.invariants[name],
        { index, elementId: entry.elementId, name }
      );
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

function assertInvariantValueMatchesDescriptor(value, descriptor, details) {
  if (descriptor.kind !== "quantity") return;
  if (value.unit !== descriptor.unit) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_UNIT_MISMATCH",
      "The resolved invariant does not match its declared canonical unit.",
      {
        ...details,
        expectedUnit: descriptor.unit,
        actualUnit: value.unit
      }
    );
  }
  if (value.semantic !== descriptor.semantic) {
    fail(
      "PREDICATE_LOCAL_INVARIANT_SEMANTIC_MISMATCH",
      "The resolved invariant does not match its declared semantic label.",
      {
        ...details,
        expectedSemantic: descriptor.semantic,
        actualSemantic: value.semantic
      }
    );
  }
}

function selectedAttributeItems(expression, path, graph) {
  const selected = selectCanonicalValueSet(graph, expression.set);
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

function resolveInvariantExpression(
  expression,
  path,
  graph,
  symbols,
  invariantContext,
  precisionPolicy
) {
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
  const descriptor = symbols.invariants[expression.name];
  let value;
  let witnessBasis;
  let aggregationResult = null;
  if (invariantContext.domain === "element-exact") {
    const element = invariantContext.elements.get(sourceRef);
    value = element?.invariants[expression.name];
    if (value === undefined) {
      fail(
        "PREDICATE_LOCAL_INVARIANT_VALUE_UNAVAILABLE",
        "The selected element does not provide the required invariant value.",
        { path, name: expression.name, canonicalNode, elementId: sourceRef }
      );
    }
    witnessBasis = { elementId: sourceRef };
    assertInvariantValueMatchesDescriptor(value, descriptor, {
      path,
      name: expression.name,
      canonicalNode,
      ...witnessBasis
    });
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
    const memberValues = profileClass.members.map((elementId) =>
      invariantContext.elements.get(elementId).invariants[expression.name]
    );
    profileClass.members.forEach((elementId, index) => {
      assertInvariantValueMatchesDescriptor(memberValues[index], descriptor, {
        path,
        name: expression.name,
        canonicalNode,
        profileHash: sourceRef,
        elementId
      });
    });
    if (expression.profileAggregation === PROFILE_INVARIANT_AGGREGATION_POLICY) {
      aggregationResult = aggregateProfileInvariantValues(
        descriptor,
        memberValues,
        precisionPolicy
      );
      value = aggregationResult.value;
      witnessBasis = {
        profileHash: sourceRef,
        memberElementIds: [...profileClass.members],
        aggregation: aggregationResult.aggregation
      };
    } else {
      const firstCanonical = canonicalize(memberValues[0]);
      const disagreeingElementIds = profileClass.members.filter((elementId, index) =>
        canonicalize(memberValues[index]) !== firstCanonical
      );
      if (disagreeingElementIds.length > 0) {
        fail(
          "PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE",
          "A selected profile class does not have one identical normalized invariant value.",
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
      value = memberValues[0];
      witnessBasis = {
        profileHash: sourceRef,
        memberElementIds: [...profileClass.members],
        consensusPolicy: descriptor.kind === "quantity"
          ? PROFILE_QUANTITY_INVARIANT_CONSENSUS_POLICY
          : PROFILE_SCALAR_INVARIANT_CONSENSUS_POLICY
      };
    }
  }
  return {
    kind: descriptor.kind,
    value,
    aggregationResult,
    witness: {
      expressionPath: path,
      name: expression.name,
      canonicalNode,
      ...witnessBasis,
      ...(descriptor.kind === "quantity"
        ? { quantity: value }
        : { valueKind: descriptor.kind, value })
    }
  };
}

function evaluateNumberExpression(
  expression,
  path,
  graph,
  numericPolicy,
  symbols,
  invariantContext
) {
  if (expression.kind === "constant") {
    return {
      unrounded: parseDecimal(expression.value),
      exact: true,
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
      invariantContext,
      numericPolicy.precision
    );
    return {
      unrounded: resolved.aggregationResult?.unrounded ?? parseDecimal(resolved.value),
      exact: resolved.aggregationResult?.exact ?? true,
      selections: [],
      invariants: [resolved.witness]
    };
  }
  if (expression.kind === "count") {
    const selected = selectCanonicalValueSet(graph, expression.set);
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
    evaluateNumberExpression(
      child,
      `${path}.${field}[${index}]`,
      graph,
      numericPolicy,
      symbols,
      invariantContext
    )
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
      invariantContext,
      numericPolicy.precision
    );
    if (resolved.aggregationResult !== null) {
      return {
        unrounded: resolved.aggregationResult.unrounded,
        exact: resolved.aggregationResult.exact,
        unit: resolved.value.unit,
        semantic: resolved.value.semantic,
        tolerance: resolved.aggregationResult.tolerance,
        evidence: resolved.aggregationResult.evidence,
        directQuantity: resolved.value,
        method: null,
        selections: [],
        invariants: [resolved.witness]
      };
    }
    return {
      unrounded: parseDecimal(resolved.value.value),
      exact: true,
      unit: resolved.value.unit,
      semantic: resolved.value.semantic,
      tolerance: quantityToleranceBound(resolved.value),
      evidence: [...resolved.value.provenance.evidence],
      directQuantity: resolved.value,
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
            result: evaluateNumberExpression(
              factor,
              factorPath,
              graph,
              numericPolicy,
              symbols,
              invariantContext
            )
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
    if (
      quantityFactors.length === 0 ||
      (quantityFactors.length > 1 && typeof expression.resultSemantic !== "string")
    ) {
      fail(
        "PREDICATE_LOCAL_QUANTITY_SCALE_INVALID",
        "Quantity multiplication requires one Quantity factor or an explicit semantic for a general product.",
        { path, quantityFactors: quantityFactors.length }
      );
    }
    let unrounded = parseDecimal(1);
    let tolerance = parseDecimal(0);
    for (const factor of factors) {
      const nextTolerance = addDecimals(
        addDecimals(
          multiplyDecimals(decimalAbsolute(unrounded), factor.result.tolerance ?? 0),
          multiplyDecimals(decimalAbsolute(factor.result.unrounded), tolerance)
        ),
        multiplyDecimals(tolerance, factor.result.tolerance ?? 0)
      );
      unrounded = multiplyDecimals(unrounded, factor.result.unrounded);
      tolerance = nextTolerance;
    }
    const units = quantityFactors
      .map((factor) => factor.result.unit)
      .filter((unit) => unit !== "1");
    return {
      unrounded,
      exact: factors.every((factor) => factor.result.exact),
      unit: parseUnitExpression(units.length === 0 ? "1" : units.join("*")).canonicalUnit,
      semantic: quantityFactors.length === 1
        ? quantityFactors[0].result.semantic
        : expression.resultSemantic,
      tolerance,
      evidence: quantityEvidenceUnion(quantityFactors.map((factor) => factor.result)),
      directQuantity: null,
      method: quantityFactors.length === 1
        ? QUANTITY_SCALE_METHOD
        : QUANTITY_PRODUCT_METHOD,
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

function evaluatedNumber(
  expression,
  path,
  graph,
  numericPolicy,
  symbols,
  invariantContext
) {
  const result = evaluateNumberExpression(
    expression,
    path,
    graph,
    numericPolicy,
    symbols,
    invariantContext
  );
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

function evaluatedScalar(expression, path, graph, symbols, invariantContext) {
  if (expression.kind === "invariant") {
    const resolved = resolveInvariantExpression(
      expression,
      path,
      graph,
      symbols,
      invariantContext
    );
    return {
      value: {
        kind: resolved.kind,
        value: resolved.value
      },
      selections: [],
      invariants: [resolved.witness]
    };
  }
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
  if (mode === "number") {
    return evaluatedNumber(
      expression,
      path,
      graph,
      numericPolicy,
      symbols,
      invariantContext
    );
  }
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
  return evaluatedScalar(expression, path, graph, symbols, invariantContext);
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

function invariantResolutionFailure(error, operand) {
  if (!(error instanceof KernelError)) return null;
  let reason;
  if (error.code === "PREDICATE_LOCAL_INVARIANT_NODE_AMBIGUOUS") {
    reason = "invariant-node-ambiguous";
  } else if (error.code === "PREDICATE_LOCAL_INVARIANT_VALUE_UNAVAILABLE") {
    reason = "invariant-value-unavailable";
  } else if (
    error.code === "PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE" &&
    error.details.reason === "member-values-missing"
  ) {
    reason = "profile-invariant-member-values-missing";
  } else if (
    error.code === "PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE" &&
    error.details.reason === "member-values-disagree"
  ) {
    reason = "profile-invariant-member-values-disagree";
  } else {
    return null;
  }
  return {
    operand,
    reason,
    details: canonicalClone(error.details)
  };
}

function capturedCompareOperand(expression, path, operand, context) {
  try {
    return {
      evaluation: evaluateValue(
        expression,
        path,
        context.graph,
        context.numericPolicy,
        context.symbols,
        context.invariantContext
      ),
      failure: null,
      error: null
    };
  } catch (error) {
    return {
      evaluation: null,
      failure: invariantResolutionFailure(error, operand),
      error
    };
  }
}

function compareEvaluator(expression, path, context) {
  const leftResult = capturedCompareOperand(
    expression.left,
    `${path}.left`,
    "left",
    context
  );
  const rightResult = capturedCompareOperand(
    expression.right,
    `${path}.right`,
    "right",
    context
  );
  if (leftResult.error !== null && leftResult.failure === null) throw leftResult.error;
  if (rightResult.error !== null && rightResult.failure === null) throw rightResult.error;
  const invariantFailures = [leftResult.failure, rightResult.failure]
    .filter((failure) => failure !== null);
  if (invariantFailures.length > 0) {
    return {
      outcome: "indeterminate",
      witnesses: [{
        expressionPath: path,
        operator: "compare",
        outcome: "indeterminate",
        comparator: expression.comparator,
        invariantFailures
      }]
    };
  }
  const left = leftResult.evaluation;
  const right = rightResult.evaluation;
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

function indexedSubstructureInput(
  graph,
  selectedNodeIndexes,
  selectedEdgeIndexes,
  policy
) {
  let parentNodeIndexes = [...selectedNodeIndexes];
  let parentEdgeIndexes = [...selectedEdgeIndexes];
  if (!policy.retainIsolatedNodes) {
    const incident = new Set();
    parentEdgeIndexes.forEach((index) => {
      incident.add(graph.edges[index].from);
      incident.add(graph.edges[index].to);
    });
    parentNodeIndexes = parentNodeIndexes.filter((index) => incident.has(index));
    const retained = new Set(parentNodeIndexes);
    parentEdgeIndexes = parentEdgeIndexes.filter((index) => {
      const edge = graph.edges[index];
      return retained.has(edge.from) && retained.has(edge.to);
    });
  }
  const parentToInput = new Map(
    parentNodeIndexes.map((parentIndex, inputIndex) => [parentIndex, inputIndex])
  );
  return {
    input: {
      domain: graph.domain,
      nodes: parentNodeIndexes.map((index) => graph.nodes[index]),
      edges: parentEdgeIndexes.map((index) => ({
        ...graph.edges[index],
        from: parentToInput.get(graph.edges[index].from),
        to: parentToInput.get(graph.edges[index].to)
      }))
    },
    parentNodeIndexes,
    parentEdgeIndexes
  };
}

function removedSubstructureInput(graph, removal, removedIndex, policy) {
  const selectedNodeIndexes = graph.nodes
    .map((_, index) => index)
    .filter((index) => removal !== "node" || index !== removedIndex);
  const selectedEdgeIndexes = graph.edges
    .map((_, index) => index)
    .filter((index) => {
      if (removal === "edge") return index !== removedIndex;
      const edge = graph.edges[index];
      return edge.from !== removedIndex && edge.to !== removedIndex;
    });
  return indexedSubstructureInput(
    graph,
    selectedNodeIndexes,
    selectedEdgeIndexes,
    policy
  );
}

function substructureIsConnected(graph, context) {
  if (graph.nodes.length === 0) return false;
  return evaluateCanonicalPredicateExpression({ op: "connected" }, "$", {
    graph,
    graphPolicy: context.graphPolicy,
    partial: false,
    nodesComplete: true
  }).outcome === "pass";
}

function normalizedRemovedSubstructure(removed, context) {
  if (removed.input.nodes.length === 0) {
    const graph = { domain: removed.input.domain, nodes: [], edges: [] };
    return {
      substructureId: hashCanonical(HASH_DOMAINS.SUBSTRUCTURE, graph),
      graph,
      canonicalNodeToParent: [],
      canonicalEdgeToParent: []
    };
  }
  const normalized = canonicalizeCandidate(removed.input, {
    policy: { ...context.graphPolicy, connected: false },
    limits: context.canonicalizationLimits
  });
  const canonicalEdgeToInput = Array(normalized.inputEdgeToCanonical.length);
  normalized.inputEdgeToCanonical.forEach((canonicalIndex, inputIndex) => {
    canonicalEdgeToInput[canonicalIndex] = inputIndex;
  });
  return {
    substructureId: normalized.candidateId,
    graph: normalized.canonical,
    canonicalNodeToParent: normalized.canonicalToInput.map(
      (inputIndex) => removed.parentNodeIndexes[inputIndex]
    ),
    canonicalEdgeToParent: canonicalEdgeToInput.map(
      (inputIndex) => removed.parentEdgeIndexes[inputIndex]
    )
  };
}

function perturbationParentInput(graph, parentNodeIndexes, parentEdgeIndexes) {
  const parentToInput = new Map(
    parentNodeIndexes.map((parentIndex, inputIndex) => [parentIndex, inputIndex])
  );
  return {
    domain: graph.domain,
    nodes: parentNodeIndexes.map((index) => graph.nodes[index]),
    edges: parentEdgeIndexes.map((index) => ({
      ...graph.edges[index],
      from: parentToInput.get(graph.edges[index].from),
      to: parentToInput.get(graph.edges[index].to)
    }))
  };
}

function assertPerturbationAttributeBound(definition, context) {
  if (definition.kind !== "numeric-attribute-displacement") return;
  const structuralAttributes = definition.target === "nodes"
    ? context.graphPolicy.structuralNodeAttributes
    : context.graphPolicy.structuralEdgeAttributes;
  if (!structuralAttributes.includes(definition.attribute)) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_ATTRIBUTE_UNBOUND",
      "Numeric perturbations require their target attribute to be structural under the bound graph policy.",
      {
        perturbationId: definition.id,
        target: definition.target,
        attribute: definition.attribute
      }
    );
  }
}

function perturbationAttemptInputs(definition, graph, context) {
  const allNodeIndexes = graph.nodes.map((_, index) => index);
  const allEdgeIndexes = graph.edges.map((_, index) => index);
  if (definition.kind === "edge-deletion") {
    const roles = definition.roles === undefined
      ? null
      : new Set(definition.roles);
    return allEdgeIndexes.flatMap((parentEdgeIndex) => {
      const edge = graph.edges[parentEdgeIndex];
      if (roles !== null && !roles.has(edge.role)) return [];
      const parentEdgeIndexes = allEdgeIndexes.filter(
        (index) => index !== parentEdgeIndex
      );
      return [{
        witnessBasis: {
          parentEdgeIndex,
          deletedRole: edge.role,
          parentNodeIndexes: allNodeIndexes,
          parentEdgeIndexes
        },
        input: perturbationParentInput(
          graph,
          allNodeIndexes,
          parentEdgeIndexes
        ),
        parentNodeIndexes: allNodeIndexes,
        parentEdgeIndexes
      }];
    });
  }
  if (definition.kind === "node-deletion") {
    return allNodeIndexes.map((parentNodeIndex) => {
      const parentNodeIndexes = allNodeIndexes.filter(
        (index) => index !== parentNodeIndex
      );
      const retained = new Set(parentNodeIndexes);
      const parentEdgeIndexes = allEdgeIndexes.filter((index) => {
        const edge = graph.edges[index];
        return retained.has(edge.from) && retained.has(edge.to);
      });
      return {
        witnessBasis: {
          parentNodeIndex,
          deletedRef: graph.nodes[parentNodeIndex].ref,
          parentNodeIndexes,
          parentEdgeIndexes
        },
        input: perturbationParentInput(
          graph,
          parentNodeIndexes,
          parentEdgeIndexes
        ),
        parentNodeIndexes,
        parentEdgeIndexes
      };
    });
  }
  if (definition.kind === "edge-role-replacement") {
    const attempts = [];
    allEdgeIndexes.forEach((parentEdgeIndex) => {
      const edge = graph.edges[parentEdgeIndex];
      definition.replacements.forEach((replacement, replacementIndex) => {
        if (edge.role !== replacement.from) return;
        const input = perturbationParentInput(
          graph,
          allNodeIndexes,
          allEdgeIndexes
        );
        input.edges[parentEdgeIndex] = {
          ...input.edges[parentEdgeIndex],
          role: replacement.to
        };
        attempts.push({
          witnessBasis: {
            parentEdgeIndex,
            replacementIndex,
            fromRole: replacement.from,
            toRole: replacement.to,
            parentNodeIndexes: allNodeIndexes,
            parentEdgeIndexes: allEdgeIndexes
          },
          input,
          parentNodeIndexes: allNodeIndexes,
          parentEdgeIndexes: allEdgeIndexes
        });
      });
    });
    return attempts;
  }

  assertPerturbationAttributeBound(definition, context);
  const collection = definition.target === "nodes" ? graph.nodes : graph.edges;
  const attempts = [];
  collection.forEach((entry, parentIndex) => {
    definition.directions.forEach((direction) => {
      const indexField = definition.target === "nodes"
        ? { parentNodeIndex: parentIndex }
        : { parentEdgeIndex: parentIndex };
      const common = {
        target: definition.target,
        ...indexField,
        attribute: definition.attribute,
        direction,
        epsilon: definition.epsilon,
        parentNodeIndexes: allNodeIndexes,
        parentEdgeIndexes: allEdgeIndexes
      };
      const originalValue = entry.attrs?.[definition.attribute];
      if (typeof originalValue !== "number" || !Number.isFinite(originalValue)) {
        attempts.push({
          witnessBasis: common,
          skipReason: "numeric-attribute-unavailable"
        });
        return;
      }
      const displacedValue = direction === "decrease"
        ? originalValue - definition.epsilon
        : originalValue + definition.epsilon;
      if (!Number.isFinite(displacedValue)) {
        attempts.push({
          witnessBasis: { ...common, originalValue },
          skipReason: "numeric-result-non-finite"
        });
        return;
      }
      if (Object.is(displacedValue, originalValue) || displacedValue === originalValue) {
        attempts.push({
          witnessBasis: { ...common, originalValue, displacedValue },
          skipReason: "numeric-displacement-noop"
        });
        return;
      }
      const input = perturbationParentInput(
        graph,
        allNodeIndexes,
        allEdgeIndexes
      );
      const target = definition.target === "nodes"
        ? input.nodes[parentIndex]
        : input.edges[parentIndex];
      const normalizedDisplacedValue = Object.is(displacedValue, -0)
        ? 0
        : displacedValue;
      const replacement = {
        ...target,
        attrs: {
          ...(target.attrs ?? {}),
          [definition.attribute]: normalizedDisplacedValue
        }
      };
      if (definition.target === "nodes") input.nodes[parentIndex] = replacement;
      else input.edges[parentIndex] = replacement;
      attempts.push({
        witnessBasis: {
          ...common,
          originalValue,
          displacedValue: normalizedDisplacedValue
        },
        input,
        parentNodeIndexes: allNodeIndexes,
        parentEdgeIndexes: allEdgeIndexes
      });
    });
  });
  return attempts;
}

function perturbationAttemptCount(definition, graph) {
  if (definition.kind === "edge-deletion") {
    return definition.roles === undefined
      ? graph.edges.length
      : graph.edges.filter((edge) => definition.roles.includes(edge.role)).length;
  }
  if (definition.kind === "node-deletion") return graph.nodes.length;
  if (definition.kind === "edge-role-replacement") {
    const counts = new Map();
    definition.replacements.forEach((replacement) => {
      counts.set(replacement.from, (counts.get(replacement.from) ?? 0) + 1);
    });
    return graph.edges.reduce(
      (total, edge) => total + (counts.get(edge.role) ?? 0),
      0
    );
  }
  const size = definition.target === "nodes"
    ? graph.nodes.length
    : graph.edges.length;
  return size * definition.directions.length;
}

const SHA256_RANGE = 1n << 256n;
const SAMPLED_BOUND_FACTOR = 10n **
  BigInt(PERTURBATION_SAMPLING_BOUND_SCALE);

function sampleFrameIndex(frameSize, sampleOrdinal, definition, context) {
  const modulus = BigInt(frameSize);
  const rejectionLimit = SHA256_RANGE - (SHA256_RANGE % modulus);
  for (let streamCounter = 0; streamCounter < 1_024; streamCounter += 1) {
    const digest = hashCanonical(HASH_DOMAINS.PERTURBATION_SAMPLE_DRAW, {
      schemaVersion: "1",
      algorithm: PERTURBATION_SAMPLING_ALGORITHM,
      streamKey: context.perturbationContext.sampling.streamKey,
      perturbationContextHash: context.perturbationContext.contextHash,
      predicatePlanHash: context.predicatePlanHash,
      candidateId: context.candidateId,
      perturbationId: definition.id,
      sampleOrdinal,
      streamCounter
    });
    const value = BigInt(`0x${digest.slice("sha256:".length)}`);
    if (value < rejectionLimit) {
      return {
        frameIndex: Number(value % modulus),
        streamDraws: streamCounter + 1
      };
    }
  }
  fail(
    "PREDICATE_LOCAL_PERTURBATION_STREAM_EXHAUSTED",
    "The sampled perturbation stream exceeded its bounded rejection window.",
    { perturbationId: definition.id, sampleOrdinal, frameSize }
  );
}

function sampledPerturbationAttempts(frame, definition, context) {
  const sampleSize = context.perturbationContext.sampling.sampleSize;
  if (frame.length === 0 || sampleSize === 0) return [];
  return Array.from({ length: sampleSize }, (_, sampleOrdinal) => {
    const selection = sampleFrameIndex(
      frame.length,
      sampleOrdinal,
      definition,
      context
    );
    const selected = frame[selection.frameIndex];
    return {
      ...selected,
      witnessBasis: {
        ...selected.witnessBasis,
        frameIndex: selection.frameIndex,
        streamDraws: selection.streamDraws
      }
    };
  });
}

function assertPerturbationAttemptAvailable(path, context) {
  context.substructureState.attemptedSubstructures += 1;
  if (
    context.substructureState.attemptedSubstructures >
    LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_LIMIT",
      "Local stableUnder evaluation exceeds the shared structural-attempt limit.",
      {
        path,
        attemptedStructuralOperations:
          context.substructureState.attemptedSubstructures,
        maximum: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
      }
    );
  }
}

function normalizedPerturbationAttempt(attempt, context) {
  if (attempt.skipReason !== undefined) {
    return {
      ...attempt.witnessBasis,
      status: "skipped",
      reason: attempt.skipReason
    };
  }
  let normalized;
  try {
    normalized = canonicalizeCandidate(attempt.input, {
      policy: context.graphPolicy,
      limits: context.canonicalizationLimits
    });
  } catch (error) {
    if (
      !(error instanceof KernelValidationError) ||
      error.code !== "CANDIDATE_VALIDATION_FAILED"
    ) {
      throw error;
    }
    return {
      ...attempt.witnessBasis,
      status: "skipped",
      reason: "graph-policy-invalid",
      validationIssueCodes: [...new Set(
        error.issues.map((issue) => issue.code)
      )].sort()
    };
  }
  const canonicalEdgeToInput = Array(normalized.inputEdgeToCanonical.length);
  normalized.inputEdgeToCanonical.forEach((canonicalIndex, inputIndex) => {
    canonicalEdgeToInput[canonicalIndex] = inputIndex;
  });
  return {
    ...attempt.witnessBasis,
    status: "evaluated",
    perturbedCandidateId: normalized.candidateId,
    graph: normalized.canonical,
    canonicalNodeToParent: normalized.canonicalToInput.map(
      (inputIndex) => attempt.parentNodeIndexes[inputIndex]
    ),
    canonicalEdgeToParent: canonicalEdgeToInput.map(
      (inputIndex) => attempt.parentEdgeIndexes[inputIndex]
    )
  };
}

function fractionRelationToDecimal(numerator, denominator, decimal) {
  let left = BigInt(numerator);
  let right = BigInt(decimal.coefficient) * BigInt(denominator);
  if (decimal.scale >= 0) left *= 10n ** BigInt(decimal.scale);
  else right *= 10n ** BigInt(-decimal.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}

function stabilityBound(numerator, denominator, numericPolicy) {
  return {
    numerator,
    denominator,
    rounded: divideDecimals(
      parseDecimal(numerator),
      parseDecimal(denominator),
      numericPolicy.precision
    )
  };
}

function ceilingDivideBigInt(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function floorSquareRoot(value) {
  if (value < 2n) return value;
  let current = value;
  let next = (current + value / current) / 2n;
  while (next < current) {
    current = next;
    next = (current + value / current) / 2n;
  }
  return current;
}

function ceilingSquareRoot(value) {
  const floor = floorSquareRoot(value);
  return floor * floor === value ? floor : floor + 1n;
}

function scaledProbabilityDecimal(value) {
  const integer = value / SAMPLED_BOUND_FACTOR;
  const fraction = value % SAMPLED_BOUND_FACTOR;
  if (fraction === 0n) return parseDecimal(integer.toString());
  return parseDecimal(
    `${integer}.${fraction.toString().padStart(
      PERTURBATION_SAMPLING_BOUND_SCALE,
      "0"
    )}`
  );
}

function sampledConfidenceBounds(counts) {
  const denominator = BigInt(counts.valid);
  const radiusScaled = ceilingSquareRoot(ceilingDivideBigInt(
    10n * SAMPLED_BOUND_FACTOR * SAMPLED_BOUND_FACTOR,
    denominator
  ));
  const interval = (numerator) => {
    const scaledNumerator = BigInt(numerator) * SAMPLED_BOUND_FACTOR;
    const observedFloor = scaledNumerator / denominator;
    const observedCeiling = ceilingDivideBigInt(
      scaledNumerator,
      denominator
    );
    const lower = observedFloor > radiusScaled
      ? observedFloor - radiusScaled
      : 0n;
    const upper = observedCeiling + radiusScaled < SAMPLED_BOUND_FACTOR
      ? observedCeiling + radiusScaled
      : SAMPLED_BOUND_FACTOR;
    return {
      lower: scaledProbabilityDecimal(lower),
      upper: scaledProbabilityDecimal(upper),
      lowerScaled: lower,
      upperScaled: upper
    };
  };
  const passing = interval(counts.pass);
  const nonFailure = interval(counts.pass + counts.indeterminate);
  return {
    decisionBasis: { passing, nonFailure },
    witness: {
      confidenceNumerator: 95,
      confidenceDenominator: 100,
      boundDecimalPlaces: PERTURBATION_SAMPLING_BOUND_SCALE,
      radius: scaledProbabilityDecimal(radiusScaled),
      passing: { lower: passing.lower, upper: passing.upper },
      nonFailure: {
        lower: nonFailure.lower,
        upper: nonFailure.upper
      }
    }
  };
}

function stableDecision(counts, threshold, emptyPolicy) {
  if (counts.valid === 0) {
    return emptyPolicy === "vacuous-pass" ? "pass" : "indeterminate";
  }
  if (
    fractionRelationToDecimal(counts.pass, counts.valid, threshold) >= 0
  ) {
    return "pass";
  }
  if (
    fractionRelationToDecimal(
      counts.pass + counts.indeterminate,
      counts.valid,
      threshold
    ) < 0
  ) {
    return "fail";
  }
  return "indeterminate";
}

function sampledStableDecision(counts, threshold, frameSize, emptyPolicy) {
  if (frameSize === 0) {
    return {
      outcome: emptyPolicy === "vacuous-pass" ? "pass" : "indeterminate",
      confidenceBounds: null
    };
  }
  if (counts.valid === 0) {
    return { outcome: "indeterminate", confidenceBounds: null };
  }
  const confidence = sampledConfidenceBounds(counts);
  const outcome = fractionRelationToDecimal(
    confidence.decisionBasis.passing.lowerScaled,
    SAMPLED_BOUND_FACTOR,
    threshold
  ) >= 0
    ? "pass"
    : fractionRelationToDecimal(
        confidence.decisionBasis.nonFailure.upperScaled,
        SAMPLED_BOUND_FACTOR,
        threshold
      ) < 0
      ? "fail"
      : "indeterminate";
  return { outcome, confidenceBounds: confidence.witness };
}

function removalOutcome(wholeOutcome, removals) {
  if (wholeOutcome !== "pass") return wholeOutcome;
  const evaluated = removals.filter((entry) => entry.status === "evaluated");
  if (evaluated.length === 0) return "indeterminate";
  if (evaluated.some((entry) => entry.outcome === "pass")) return "fail";
  if (evaluated.some((entry) => entry.outcome === "indeterminate")) {
    return "indeterminate";
  }
  return "pass";
}

function novelOutcome(wholeOutcome, constituents) {
  if (wholeOutcome !== "pass") return wholeOutcome;
  if (constituents.length === 0) return "indeterminate";
  if (constituents.some((entry) => entry.outcome === "pass")) return "fail";
  if (constituents.some((entry) => entry.outcome === "indeterminate")) {
    return "indeterminate";
  }
  return "pass";
}

function forEachIndexSubset(length, visit) {
  const included = Array(length).fill(false);
  while (true) {
    if (visit(included.flatMap((value, index) => value ? [index] : [])) === false) {
      return;
    }
    let index = 0;
    while (index < length && included[index]) {
      included[index] = false;
      index += 1;
    }
    if (index === length) return;
    included[index] = true;
  }
}

function powerOfTwoCapped(exponent, ceiling) {
  let value = 1;
  for (let index = 0; index < exponent; index += 1) {
    if (value > Math.floor(ceiling / 2)) return ceiling + 1;
    value *= 2;
  }
  return value;
}

function properSubstructureSelectionCountCapped(graph, policy, ceiling) {
  if (policy.remove === "nodes") {
    return Math.min(
      powerOfTwoCapped(graph.nodes.length, ceiling + 1) - 1,
      ceiling + 1
    );
  }
  if (policy.remove === "edges") {
    return Math.min(
      powerOfTwoCapped(graph.edges.length, ceiling + 1) - 1,
      ceiling + 1
    );
  }

  let count = 0;
  forEachIndexSubset(graph.nodes.length, (selectedNodeIndexes) => {
    const retained = new Set(selectedNodeIndexes);
    const eligibleEdges = graph.edges.filter((edge) =>
      retained.has(edge.from) && retained.has(edge.to)
    ).length;
    const excludesWhole = selectedNodeIndexes.length === graph.nodes.length;
    let combinations = powerOfTwoCapped(
      eligibleEdges,
      ceiling - count + (excludesWhole ? 1 : 0)
    );
    if (excludesWhole) combinations -= 1;
    count += combinations;
    if (count > ceiling) {
      count = ceiling + 1;
      return false;
    }
    return true;
  });
  return count;
}

function enumerateProperSubstructureSelections(graph, policy, visit) {
  const allNodeIndexes = graph.nodes.map((_, index) => index);
  const allEdgeIndexes = graph.edges.map((_, index) => index);
  const emit = (selectedNodeIndexes, selectedEdgeIndexes) => {
    if (
      selectedNodeIndexes.length === allNodeIndexes.length &&
      selectedEdgeIndexes.length === allEdgeIndexes.length
    ) return;
    visit(selectedNodeIndexes, selectedEdgeIndexes);
  };

  if (policy.remove === "nodes") {
    forEachIndexSubset(graph.nodes.length, (selectedNodeIndexes) => {
      if (selectedNodeIndexes.length === graph.nodes.length) return;
      const retained = new Set(selectedNodeIndexes);
      const selectedEdgeIndexes = allEdgeIndexes.filter((index) => {
        const edge = graph.edges[index];
        return retained.has(edge.from) && retained.has(edge.to);
      });
      emit(selectedNodeIndexes, selectedEdgeIndexes);
    });
    return;
  }

  if (policy.remove === "edges") {
    forEachIndexSubset(graph.edges.length, (selectedEdgeIndexes) => {
      emit(allNodeIndexes, selectedEdgeIndexes);
    });
    return;
  }

  forEachIndexSubset(graph.nodes.length, (selectedNodeIndexes) => {
    const retained = new Set(selectedNodeIndexes);
    const eligibleEdgeIndexes = allEdgeIndexes.filter((index) => {
      const edge = graph.edges[index];
      return retained.has(edge.from) && retained.has(edge.to);
    });
    forEachIndexSubset(eligibleEdgeIndexes.length, (localEdgeIndexes) => {
      emit(
        selectedNodeIndexes,
        localEdgeIndexes.map((index) => eligibleEdgeIndexes[index])
      );
    });
  });
}

function assertSubstructureAttemptAvailable(path, context) {
  context.substructureState.attemptedSubstructures += 1;
  if (
    context.substructureState.attemptedSubstructures >
    LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
  ) {
    fail(
      "PREDICATE_LOCAL_SUBSTRUCTURE_LIMIT",
      "Local substructure evaluation exceeds the attempted-substructure limit.",
      {
        path,
        attemptedSubstructures: context.substructureState.attemptedSubstructures,
        maximum: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
      }
    );
  }
}

function evaluatePreparedSubstructure(
  expression,
  path,
  context,
  removed,
  witnessBasis
) {
  if (removed.input.nodes.length === 0 && !context.substructurePolicy.includeEmpty) {
    return {
      ...witnessBasis,
      parentNodeIndexes: removed.parentNodeIndexes,
      parentEdgeIndexes: removed.parentEdgeIndexes,
      status: "skipped",
      reason: "empty-excluded"
    };
  }
  if (
    removed.input.nodes.length > 0 &&
    !context.substructurePolicy.includeDisconnected &&
    !substructureIsConnected(removed.input, context)
  ) {
    return {
      ...witnessBasis,
      parentNodeIndexes: removed.parentNodeIndexes,
      parentEdgeIndexes: removed.parentEdgeIndexes,
      status: "skipped",
      reason: "disconnected-excluded"
    };
  }
  const normalized = normalizedRemovedSubstructure(removed, context);
  const result = evaluateCanonicalPredicateExpression(
    expression.predicate,
    `${path}.predicate`,
    {
      ...context,
      graph: normalized.graph,
      candidateId: normalized.substructureId
    }
  );
  return {
    ...witnessBasis,
    parentNodeIndexes: removed.parentNodeIndexes,
    parentEdgeIndexes: removed.parentEdgeIndexes,
    status: "evaluated",
    substructureId: normalized.substructureId,
    canonicalNodeToParent: normalized.canonicalNodeToParent,
    canonicalEdgeToParent: normalized.canonicalEdgeToParent,
    outcome: result.outcome,
    witnesses: result.witnesses
  };
}

function minimalEvaluator(expression, path, context) {
  const whole = evaluateCanonicalPredicateExpression(
    expression.predicate,
    `${path}.predicate`,
    context
  );
  const substructures = [];
  if (whole.outcome === "pass") {
    const remaining = LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals -
      context.substructureState.attemptedSubstructures;
    if (
      properSubstructureSelectionCountCapped(
        context.graph,
        context.substructurePolicy,
        remaining
      ) > remaining
    ) {
      context.substructureState.attemptedSubstructures =
        LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals;
      assertSubstructureAttemptAvailable(path, context);
    }
    enumerateProperSubstructureSelections(
      context.graph,
      context.substructurePolicy,
      (selectedNodeIndexes, selectedEdgeIndexes) => {
        assertSubstructureAttemptAvailable(path, context);
        const removed = indexedSubstructureInput(
          context.graph,
          selectedNodeIndexes,
          selectedEdgeIndexes,
          context.substructurePolicy
        );
        substructures.push(evaluatePreparedSubstructure(
          expression,
          path,
          context,
          removed,
          { selectedNodeIndexes, selectedEdgeIndexes }
        ));
      }
    );
  }
  const outcome = removalOutcome(whole.outcome, substructures);
  const evaluatedSubstructures = substructures.filter(
    (entry) => entry.status === "evaluated"
  ).length;
  return {
    outcome,
    witnesses: [{
      expressionPath: path,
      operator: "minimal",
      outcome,
      policyId: context.substructurePolicy.id,
      enumeration: MINIMAL_SUBSTRUCTURE_ENUMERATION_METHOD,
      whole: { outcome: whole.outcome, witnesses: whole.witnesses },
      attemptedSubstructures: substructures.length,
      evaluatedSubstructures,
      skippedSubstructures: substructures.length - evaluatedSubstructures,
      substructures
    }]
  };
}

function irreducibleRemovalEvaluator(expression, path, context) {
  const whole = evaluateCanonicalPredicateExpression(
    expression.predicate,
    `${path}.predicate`,
    context
  );
  const removals = [];
  if (whole.outcome === "pass") {
    const count = expression.removal === "node"
      ? context.graph.nodes.length
      : context.graph.edges.length;
    for (let removedIndex = 0; removedIndex < count; removedIndex += 1) {
      assertSubstructureAttemptAvailable(path, context);
      const removed = removedSubstructureInput(
        context.graph,
        expression.removal,
        removedIndex,
        context.substructurePolicy
      );
      const removalBasis = {
        ...(expression.removal === "node"
          ? { removedNodeIndex: removedIndex }
          : { removedEdgeIndex: removedIndex }),
        parentNodeIndexes: removed.parentNodeIndexes,
        parentEdgeIndexes: removed.parentEdgeIndexes
      };
      removals.push(evaluatePreparedSubstructure(
        expression,
        path,
        context,
        removed,
        removalBasis
      ));
    }
  }
  const outcome = removalOutcome(whole.outcome, removals);
  const evaluatedSubstructures = removals.filter(
    (entry) => entry.status === "evaluated"
  ).length;
  return {
    outcome,
    witnesses: [{
      expressionPath: path,
      operator: "irreducibleRemoval",
      outcome,
      removal: expression.removal,
      policyId: context.substructurePolicy.id,
      whole: { outcome: whole.outcome, witnesses: whole.witnesses },
      attemptedRemovals: removals.length,
      evaluatedSubstructures,
      skippedSubstructures: removals.length - evaluatedSubstructures,
      removals
    }]
  };
}

function novelEvaluator(expression, path, context) {
  if (context.graph.domain !== "element-exact") {
    fail(
      "PREDICATE_LOCAL_NOVEL_DOMAIN_UNSUPPORTED",
      "Novel predicate evaluation requires an element-exact candidate.",
      { path, domain: context.graph.domain }
    );
  }
  const whole = evaluateCanonicalPredicateExpression(
    expression.predicate,
    `${path}.predicate`,
    context
  );
  const constituents = [];
  if (whole.outcome === "pass") {
    const remaining = LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals -
      context.substructureState.attemptedSubstructures;
    if (context.graph.nodes.length > remaining) {
      context.substructureState.attemptedSubstructures =
        LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals;
      assertSubstructureAttemptAvailable(path, context);
    }
    context.graph.nodes.forEach((node, parentNodeIndex) => {
      assertSubstructureAttemptAvailable(path, context);
      const normalized = normalizedRemovedSubstructure({
        input: {
          domain: context.graph.domain,
          nodes: [node],
          edges: []
        },
        parentNodeIndexes: [parentNodeIndex],
        parentEdgeIndexes: []
      }, context);
      const result = evaluateCanonicalPredicateExpression(
        expression.predicate,
        `${path}.predicate`,
        {
          ...context,
          graph: normalized.graph,
          candidateId: normalized.substructureId
        }
      );
      constituents.push({
        parentNodeIndex,
        sourceElementId: node.ref,
        projectionId: normalized.substructureId,
        canonicalNodeToParent: normalized.canonicalNodeToParent,
        outcome: result.outcome,
        witnesses: result.witnesses
      });
    });
  }
  const outcome = novelOutcome(whole.outcome, constituents);
  return {
    outcome,
    witnesses: [{
      expressionPath: path,
      operator: "novel",
      outcome,
      domain: "element-exact",
      projection: NOVEL_CONSTITUENT_PROJECTION_METHOD,
      ...(context.substructurePolicy === null
        ? {}
        : { boundSubstructurePolicyId: context.substructurePolicy.id }),
      whole: { outcome: whole.outcome, witnesses: whole.witnesses },
      attemptedConstituents: constituents.length,
      evaluatedConstituents: constituents.length,
      constituents
    }]
  };
}

function stableUnderEvaluator(expression, path, context) {
  const definition = context.perturbationContext.definitionsById.get(
    expression.perturbation
  );
  if (definition === undefined) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_CONTEXT_MISMATCH",
      "stableUnder references a perturbation absent from the bound context.",
      { path, perturbationId: expression.perturbation }
    );
  }
  assertPerturbationAttributeBound(definition, context);
  const sampled = definition.enumeration ===
    SAMPLED_STABLE_PERTURBATION_ENUMERATION_METHOD;
  const frameSize = perturbationAttemptCount(definition, context.graph);
  const sampleSize = sampled
    ? context.perturbationContext.sampling.sampleSize
    : null;
  if (
    sampled &&
    sampleSize > 0 &&
    frameSize > LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
  ) {
    fail(
      "PREDICATE_LOCAL_PERTURBATION_FRAME_LIMIT",
      "The sampled perturbation frame exceeds the bounded materialization limit.",
      {
        path,
        perturbationId: definition.id,
        frameSize,
        maximum: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
      }
    );
  }
  const attemptedCount = sampled && frameSize > 0
    ? sampleSize
    : frameSize;
  const remaining = LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals -
    context.substructureState.attemptedSubstructures;
  if (attemptedCount > remaining) {
    context.substructureState.attemptedSubstructures =
      LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals;
    assertPerturbationAttemptAvailable(path, context);
  }
  const frame = sampled && sampleSize === 0
    ? []
    : perturbationAttemptInputs(definition, context.graph, context);
  const generated = sampled
    ? sampledPerturbationAttempts(frame, definition, context)
    : frame;
  const perturbations = generated.map((attempt, attemptIndex) => {
    assertPerturbationAttemptAvailable(path, context);
    const normalized = normalizedPerturbationAttempt(attempt, context);
    if (normalized.status === "skipped") {
      return { attemptIndex, ...normalized };
    }
    const result = evaluateCanonicalPredicateExpression(
      expression.predicate,
      `${path}.predicate`,
      {
        ...context,
        graph: normalized.graph,
        candidateId: normalized.perturbedCandidateId
      }
    );
    const { graph, ...witness } = normalized;
    return {
      attemptIndex,
      ...witness,
      outcome: result.outcome,
      witnesses: result.witnesses
    };
  });
  const evaluated = perturbations.filter((entry) => entry.status === "evaluated");
  const counts = {
    valid: evaluated.length,
    pass: evaluated.filter((entry) => entry.outcome === "pass").length,
    fail: evaluated.filter((entry) => entry.outcome === "fail").length,
    indeterminate: evaluated.filter(
      (entry) => entry.outcome === "indeterminate"
    ).length
  };
  const threshold = parseDecimal(expression.threshold);
  const sampledDecision = sampled
    ? sampledStableDecision(
        counts,
        threshold,
        frameSize,
        definition.emptyPolicy
      )
    : null;
  const outcome = sampled
    ? sampledDecision.outcome
    : stableDecision(counts, threshold, definition.emptyPolicy);
  const stability = counts.valid === 0
    ? null
    : {
        lower: stabilityBound(
          counts.pass,
          counts.valid,
          context.numericPolicy
        ),
        upper: stabilityBound(
          counts.pass + counts.indeterminate,
          counts.valid,
          context.numericPolicy
        )
      };
  return {
    outcome,
    witnesses: [{
      expressionPath: path,
      operator: "stableUnder",
      outcome,
      perturbationId: definition.id,
      perturbationKind: definition.kind,
      enumeration: definition.enumeration,
      emptyPolicy: definition.emptyPolicy,
      boundPerturbationContextHash: context.perturbationContext.contextHash,
      ...(context.substructurePolicy === null
        ? {}
        : { boundSubstructurePolicyId: context.substructurePolicy.id }),
      threshold,
      decisionRule: sampled
        ? SAMPLED_STABLE_DECISION_RULE
        : EXACT_STABLE_DECISION_RULE,
      ...(sampled
        ? {
            sampling: {
              ...context.perturbationContext.sampling,
              frameSize,
              status: frameSize === 0
                ? "frame-empty"
                : context.perturbationContext.sampling.sampleSize === 0
                  ? "budget-empty"
                  : counts.valid === 0
                    ? "no-valid-samples"
                    : "evaluated"
            },
            confidenceBounds: sampledDecision.confidenceBounds
          }
        : {}),
      attemptedPerturbations: perturbations.length,
      validPerturbations: counts.valid,
      skippedPerturbations: perturbations.length - counts.valid,
      passedPerturbations: counts.pass,
      failedPerturbations: counts.fail,
      indeterminatePerturbations: counts.indeterminate,
      stability,
      perturbations
    }]
  };
}

function substructureEvaluator(expression, path, context) {
  if (expression.op === "minimal") return minimalEvaluator(expression, path, context);
  if (expression.op === "irreducibleRemoval") {
    return irreducibleRemovalEvaluator(expression, path, context);
  }
  if (expression.op === "stableUnder") {
    return stableUnderEvaluator(expression, path, context);
  }
  return novelEvaluator(expression, path, context);
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
    aggregate = evaluatedNumber(
      sum,
      path,
      context.graph,
      context.numericPolicy,
      context.symbols,
      context.invariantContext
    );
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
  const substructurePolicy = normalizeSubstructurePolicyForPlan(
    verified.plan,
    localOptions.substructurePolicy
  );
  const perturbationContext = normalizePerturbationContextForPlan(
    verified.plan,
    localOptions.perturbationContext
  );
  const numericBinding = verifyNumericBinding(verified.plan, numericBindingInput);
  const canonical = canonicalizeCandidate(candidate, localOptions.canonicalization);
  const invariantContext = normalizeInvariantContext(
    localOptions.invariantContext,
    canonical.canonical,
    verified.plan.requirements.invariants,
    verified.plan.symbols
  );
  const result = evaluateCanonicalPredicateExpression(verified.analysis.expression, "$", {
    graph: canonical.canonical,
    predicatePlanHash: verified.plan.planHash,
    candidateId: canonical.candidateId,
    graphPolicy: canonical.graphPolicy,
    partial: false,
    nodesComplete: true,
    numericPolicy: numericBinding.numericPolicy,
    symbols: verified.plan.symbols,
    invariantContext,
    substructurePolicy,
    perturbationContext,
    substructureState: { attemptedSubstructures: 0 },
    canonicalizationLimits: canonical.canonicalizationLimits,
    evaluateCompare: compareEvaluator,
    evaluateBalance: balanceEvaluator,
    evaluateSubstructure: substructureEvaluator
  });
  const basis = {
    schemaVersion: "1",
    evaluator: LOCAL_PREDICATE_EVALUATOR_VERSION,
    predicatePlanHash: verified.plan.planHash,
    numericBindingHash: numericBinding.bindingHash,
    candidateId: canonical.candidateId,
    ...(invariantContext === null
      ? {}
      : {
          invariantSourcePopulationHash: invariantContext.sourcePopulationHash,
          invariantNames: [...verified.plan.requirements.invariants]
        }),
    ...(substructurePolicy === null ? {} : { substructurePolicy }),
    ...(perturbationContext === null
      ? {}
      : { perturbationContextHash: perturbationContext.contextHash }),
    graphPolicy: canonical.graphPolicy,
    outcome: result.outcome,
    witnesses: result.witnesses
  };
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(HASH_DOMAINS.PREDICATE_LOCAL_EVALUATION, basis)
  });
}
