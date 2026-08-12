import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import {
  invariantValueKind,
  normalizeInvariantValue
} from "./invariant.js";
import { compareQuantities } from "./quantity.js";

export const PROFILE_SLOT_GUARD_VERSION = "profile-slot-partner-guard-v1";
export const PROFILE_SLOT_GUARD_LIMITS = deepFreeze({
  maxDepth: 16,
  maxNodes: 256,
  maxArguments: 64
});

const COMPARATORS = new Set(["eq", "ne", "lt", "lte", "gt", "gte"]);
const EQUALITY_COMPARATORS = new Set(["eq", "ne"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "PROFILE_GUARD", message, details });
}

function normalizedString(value, field) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim() ||
    value.length > 1_024
  ) {
    fail(
      "PROFILE_GUARD_STRING_INVALID",
      "Profile guard identifiers must be normalized non-empty strings.",
      { field, value }
    );
  }
  return value;
}

function exactFields(value, fields, path) {
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    fail(
      "PROFILE_GUARD_FIELD_UNKNOWN",
      "Profile guard expression contains unknown fields.",
      { path, unknown }
    );
  }
  const missing = [...fields].filter((field) => value[field] === undefined);
  if (missing.length > 0) {
    fail(
      "PROFILE_GUARD_FIELD_MISSING",
      "Profile guard expression omits required fields.",
      { path, missing }
    );
  }
}

function normalizeExpression(value, state, path, depth) {
  state.nodes += 1;
  if (state.nodes > PROFILE_SLOT_GUARD_LIMITS.maxNodes) {
    fail(
      "PROFILE_GUARD_NODE_LIMIT",
      "Profile guard expression exceeds the node limit.",
      { maximum: PROFILE_SLOT_GUARD_LIMITS.maxNodes }
    );
  }
  if (depth > PROFILE_SLOT_GUARD_LIMITS.maxDepth) {
    fail(
      "PROFILE_GUARD_DEPTH_LIMIT",
      "Profile guard expression exceeds the depth limit.",
      { maximum: PROFILE_SLOT_GUARD_LIMITS.maxDepth }
    );
  }
  if (!isObject(value)) {
    fail(
      "PROFILE_GUARD_EXPRESSION_INVALID",
      "Executable profile guards must be objects.",
      { path }
    );
  }
  const op = value.op;
  if (op === "all" || op === "any") {
    exactFields(value, new Set(["op", "args"]), path);
    if (
      !Array.isArray(value.args) ||
      value.args.length === 0 ||
      value.args.length > PROFILE_SLOT_GUARD_LIMITS.maxArguments
    ) {
      fail(
        "PROFILE_GUARD_ARGUMENTS_INVALID",
        "Logical profile guards require a bounded non-empty argument list.",
        {
          path,
          maximum: PROFILE_SLOT_GUARD_LIMITS.maxArguments,
          actual: Array.isArray(value.args) ? value.args.length : null
        }
      );
    }
    const args = value.args.map((entry, index) =>
      normalizeExpression(entry, state, `${path}.args[${index}]`, depth + 1)
    ).sort((left, right) => {
      const leftCanonical = canonicalize(left);
      const rightCanonical = canonicalize(right);
      return leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
    });
    for (let index = 1; index < args.length; index += 1) {
      if (canonicalize(args[index - 1]) === canonicalize(args[index])) {
        fail(
          "PROFILE_GUARD_ARGUMENT_DUPLICATE",
          "Logical profile guard arguments must be unique.",
          { path }
        );
      }
    }
    return { op, args };
  }
  if (op === "not") {
    exactFields(value, new Set(["op", "arg"]), path);
    return {
      op,
      arg: normalizeExpression(value.arg, state, `${path}.arg`, depth + 1)
    };
  }
  if (op === "partnerTypeTag") {
    exactFields(value, new Set(["op", "typeTag"]), path);
    return { op, typeTag: normalizedString(value.typeTag, `${path}.typeTag`) };
  }
  if (op === "partnerInvariant") {
    exactFields(
      value,
      new Set(["op", "name", "comparator", "value"]),
      path
    );
    const name = normalizedString(value.name, `${path}.name`);
    if (!COMPARATORS.has(value.comparator)) {
      fail(
        "PROFILE_GUARD_COMPARATOR_INVALID",
        "Profile guard invariant comparator is unknown.",
        { path, comparator: value.comparator }
      );
    }
    let expected;
    try {
      expected = normalizeInvariantValue(value.value);
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      fail(
        "PROFILE_GUARD_VALUE_INVALID",
        "Profile guard comparison value is invalid.",
        { path, causeCode: error.code }
      );
    }
    if (
      !new Set(["number", "quantity"]).has(invariantValueKind(expected)) &&
      !EQUALITY_COMPARATORS.has(value.comparator)
    ) {
      fail(
        "PROFILE_GUARD_COMPARATOR_TYPE_INVALID",
        "Non-numeric profile guard values support only eq and ne.",
        { path, comparator: value.comparator, kind: invariantValueKind(expected) }
      );
    }
    return { op, name, comparator: value.comparator, value: expected };
  }
  fail(
    "PROFILE_GUARD_OPERATOR_INVALID",
    "Profile guard expression uses an unknown operator.",
    { path, op }
  );
}

/** Normalizes a typed partner guard or preserves a legacy content-hash ref. */
export function normalizeProfileSlotGuard(input) {
  let value;
  try {
    value = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PROFILE_GUARD_INVALID",
      "Profile guard is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (typeof value === "string") {
    if (!isContentHash(value)) {
      fail(
        "PROFILE_GUARD_REFERENCE_INVALID",
        "Legacy profile guard references must be content hashes.",
        { value }
      );
    }
    return value;
  }
  return deepFreeze(normalizeExpression(value, { nodes: 0 }, "$", 1));
}

function scalarComparison(actual, comparator, expected) {
  if (typeof actual === "number") {
    const relation = actual < expected ? -1 : actual > expected ? 1 : 0;
    return {
      pass: {
        eq: relation === 0,
        ne: relation !== 0,
        lt: relation < 0,
        lte: relation <= 0,
        gt: relation > 0,
        gte: relation >= 0
      }[comparator],
      relation
    };
  }
  const equal = canonicalize(actual) === canonicalize(expected);
  return { pass: comparator === "eq" ? equal : !equal, equal };
}

function combineLogical(op, outcomes) {
  if (op === "all") {
    if (outcomes.includes("fail")) return "fail";
    return outcomes.includes("indeterminate") ? "indeterminate" : "pass";
  }
  if (outcomes.includes("pass")) return "pass";
  return outcomes.includes("indeterminate") ? "indeterminate" : "fail";
}

function evaluateExpression(expression, element, path) {
  if (expression.op === "all" || expression.op === "any") {
    const children = expression.args.map((entry, index) =>
      evaluateExpression(entry, element, `${path}.args[${index}]`)
    );
    const outcome = combineLogical(
      expression.op,
      children.map((entry) => entry.outcome)
    );
    return {
      outcome,
      reason: outcome === "indeterminate" ? "logical-child-indeterminate" : null,
      checks: [
        ...children.flatMap((entry) => entry.checks),
        {
          path,
          op: expression.op,
          outcome,
          details: { childOutcomes: children.map((entry) => entry.outcome) }
        }
      ]
    };
  }
  if (expression.op === "not") {
    const child = evaluateExpression(expression.arg, element, `${path}.arg`);
    const outcome = child.outcome === "pass"
      ? "fail"
      : child.outcome === "fail" ? "pass" : "indeterminate";
    return {
      outcome,
      reason: outcome === "indeterminate" ? child.reason : null,
      checks: [
        ...child.checks,
        { path, op: "not", outcome, details: { childOutcome: child.outcome } }
      ]
    };
  }
  if (expression.op === "partnerTypeTag") {
    const pass = element.typeTags.includes(expression.typeTag);
    return {
      outcome: pass ? "pass" : "fail",
      reason: null,
      checks: [{
        path,
        op: expression.op,
        outcome: pass ? "pass" : "fail",
        details: { typeTag: expression.typeTag }
      }]
    };
  }
  const actual = element.invariants[expression.name];
  if (actual === undefined) {
    return {
      outcome: "indeterminate",
      reason: "partner-invariant-unavailable",
      checks: [{
        path,
        op: expression.op,
        outcome: "indeterminate",
        details: { name: expression.name, reason: "unavailable" }
      }]
    };
  }
  const actualKind = invariantValueKind(actual);
  const expectedKind = invariantValueKind(expression.value);
  if (actualKind !== expectedKind) {
    return {
      outcome: "indeterminate",
      reason: "partner-invariant-type-mismatch",
      checks: [{
        path,
        op: expression.op,
        outcome: "indeterminate",
        details: { name: expression.name, actualKind, expectedKind }
      }]
    };
  }
  let comparison;
  if (actualKind === "quantity") {
    try {
      comparison = compareQuantities(
        actual,
        expression.comparator,
        expression.value
      );
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      return {
        outcome: "indeterminate",
        reason: "partner-invariant-quantity-incompatible",
        checks: [{
          path,
          op: expression.op,
          outcome: "indeterminate",
          details: { name: expression.name, causeCode: error.code }
        }]
      };
    }
  } else {
    comparison = scalarComparison(
      actual,
      expression.comparator,
      expression.value
    );
  }
  return {
    outcome: comparison.pass ? "pass" : "fail",
    reason: null,
    checks: [{
      path,
      op: expression.op,
      outcome: comparison.pass ? "pass" : "fail",
      details: {
        name: expression.name,
        comparator: expression.comparator,
        comparison
      }
    }]
  };
}

/** Evaluates one normalized guard across every member of the partner class. */
export function evaluateProfileSlotGuard(guardInput, partnerElements, context) {
  if (!Array.isArray(partnerElements) || partnerElements.length === 0) {
    fail(
      "PROFILE_GUARD_PARTNER_POPULATION_INVALID",
      "Profile guard evaluation requires a non-empty partner population."
    );
  }
  const guard = normalizeProfileSlotGuard(guardInput);
  const guardHash = typeof guard === "string"
    ? guard
    : hashCanonical(HASH_DOMAINS.PROFILE_SLOT_GUARD, guard);
  let memberOutcomes;
  let outcome;
  let reason;
  if (typeof guard === "string") {
    memberOutcomes = [];
    outcome = "indeterminate";
    reason = "profile-slot-guard-unsupported";
  } else {
    memberOutcomes = partnerElements.map((element) => {
      const evaluated = evaluateExpression(guard, element, "$");
      return {
        elementId: element.id,
        outcome: evaluated.outcome,
        reason: evaluated.reason,
        checks: evaluated.checks
      };
    }).sort((left, right) => left.elementId < right.elementId ? -1 : 1);
    const outcomes = memberOutcomes.map((entry) => entry.outcome);
    if (outcomes.includes("indeterminate")) {
      outcome = "indeterminate";
      reason = "profile-slot-guard-member-indeterminate";
    } else if (outcomes.every((entry) => entry === "pass")) {
      outcome = "pass";
      reason = null;
    } else if (outcomes.every((entry) => entry === "fail")) {
      outcome = "fail";
      reason = "profile-slot-guard-unsatisfied";
    } else {
      outcome = "indeterminate";
      reason = "profile-slot-guard-member-disagreement";
    }
  }
  const basis = {
    schemaVersion: "1",
    evaluator: PROFILE_SLOT_GUARD_VERSION,
    guardHash,
    guard,
    ...context,
    partnerElementIds: partnerElements.map((entry) => entry.id).sort(),
    memberOutcomes,
    outcome,
    reason
  };
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(
      HASH_DOMAINS.PROFILE_SLOT_GUARD_EVALUATION,
      basis
    )
  });
}
