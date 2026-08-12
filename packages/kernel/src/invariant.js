import { KernelError } from "./errors.js";
import { normalizeQuantity } from "./quantity.js";

export const INVARIANT_STRING_MAX_LENGTH = 1_024;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "INVARIANT", message, details });
}

export function invariantValueKind(value) {
  if (isObject(value)) return "quantity";
  if (value === null) return "null";
  return typeof value;
}

export function normalizeInvariantValue(value) {
  const kind = invariantValueKind(value);
  if (kind === "quantity") {
    const quantity = normalizeQuantity(value);
    return {
      value: quantity.value,
      unit: quantity.unit,
      tolerance: Object.fromEntries(
        Object.keys(quantity.tolerance).sort().map((key) => [key, quantity.tolerance[key]])
      ),
      semantic: quantity.semantic,
      provenance: {
        ...quantity.provenance,
        evidence: [...quantity.provenance.evidence].sort()
      }
    };
  }
  if (kind === "number") {
    if (!Number.isFinite(value)) {
      fail(
        "INVARIANT_NUMBER_INVALID",
        "A numeric invariant value must be finite.",
        { value }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (kind === "string") {
    if (value.length > INVARIANT_STRING_MAX_LENGTH) {
      fail(
        "INVARIANT_STRING_LIMIT",
        "A string invariant value exceeds the kernel length limit.",
        { actualLength: value.length, maximumLength: INVARIANT_STRING_MAX_LENGTH }
      );
    }
    return value;
  }
  if (kind === "boolean" || kind === "null") return value;
  fail(
    "INVARIANT_VALUE_INVALID",
    "An invariant value must be a Quantity or JSON scalar.",
    { actualKind: kind }
  );
}

export function invariantExpressionSymbol(value) {
  const kind = invariantValueKind(value);
  return kind === "quantity" ? value : { kind };
}

export function invariantSymbolEnvironment(primitives) {
  const invariants = {};
  for (const primitive of primitives) {
    for (const [name, value] of Object.entries(primitive.invariants)) {
      if (invariants[name] === undefined) {
        invariants[name] = invariantExpressionSymbol(value);
      }
    }
  }
  return invariants;
}

export function candidateAttributeSymbolEnvironment(
  candidateAttributes,
  invariants
) {
  return Object.fromEntries(candidateAttributes.map((definition) => [
    definition.name,
    definition.source.kind.startsWith("constant-")
      ? invariantExpressionSymbol(definition.source.value)
      : definition.source.kind.startsWith("edge-role-")
        ? invariantExpressionSymbol(
            definition.source.values[
              Object.keys(definition.source.values).sort()[0]
            ]
          )
        : invariants[definition.source.invariant]
  ]));
}

export function invariantIdentityValue(value) {
  if (invariantValueKind(value) !== "quantity") return value;
  return {
    value: value.value,
    unit: value.unit,
    tolerance: value.tolerance,
    semantic: value.semantic
  };
}
