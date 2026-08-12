import {
  DECIMAL_LIMITS,
  accumulateDecimals,
  addDecimals,
  decimalToNumber,
  divideDecimals,
  multiplyDecimals,
  normalizePrecisionPolicy,
  parseDecimal,
  subtractDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { invariantValueKind } from "./invariant.js";
import { normalizeQuantity } from "./quantity.js";

export const PROFILE_INVARIANT_AGGREGATION_POLICY =
  "arithmetic-mean-conservative-v1";
export const PROFILE_INVARIANT_UNCERTAINTY_POLICY =
  "mean-effective-bounds-plus-rounding-v1";
export const PROFILE_INVARIANT_PROVENANCE_METHOD =
  "profile-invariant-arithmetic-mean-v1";

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PROFILE_INVARIANT_AGGREGATION",
    message,
    details
  });
}

function decimalAbsolute(value) {
  const parsed = parseDecimal(value);
  return BigInt(parsed.coefficient) < 0n
    ? multiplyDecimals(parsed, -1)
    : parsed;
}

function decimalMaximum(left, right) {
  return BigInt(subtractDecimals(left, right).coefficient) >= 0n ? left : right;
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
      "PROFILE_INVARIANT_AGGREGATION_TOLERANCE_OVERFLOW",
      "Aggregated invariant uncertainty cannot be represented as a finite binary64 bound.",
      { tolerance: parseDecimal(value).canonical }
    );
  }
  const difference = subtractDecimals(parseDecimal(converted), value);
  if (BigInt(difference.coefficient) >= 0n) return converted;
  const outward = nextPositiveBinary64(converted);
  if (!Number.isFinite(outward)) {
    fail(
      "PROFILE_INVARIANT_AGGREGATION_TOLERANCE_OVERFLOW",
      "Aggregated invariant uncertainty cannot be represented as a finite binary64 bound.",
      { tolerance: parseDecimal(value).canonical }
    );
  }
  return outward;
}

function outwardNonnegativeQuotient(dividend, divisor) {
  const quotient = divideDecimals(dividend, divisor, {
    id: "profile-invariant-uncertainty-outward-v1",
    decimalPlaces: DECIMAL_LIMITS.maxDecimalPlaces,
    rounding: "toward-zero",
    summation: "exact-decimal"
  });
  return BigInt(subtractDecimals(
    multiplyDecimals(quotient, divisor),
    dividend
  ).coefficient) >= 0n
    ? quotient
    : addDecimals(quotient, parseDecimal(`1e-${DECIMAL_LIMITS.maxDecimalPlaces}`));
}

function aggregationMean(values, precision) {
  const sum = accumulateDecimals(values, "exact-decimal").value;
  const divisor = parseDecimal(values.length);
  const unrounded = divideDecimals(sum, divisor, precision);
  const exact = subtractDecimals(
    multiplyDecimals(unrounded, divisor),
    sum
  ).coefficient === "0";
  const roundingBound = exact
    ? parseDecimal(0)
    : parseDecimal(`1e-${precision.decimalPlaces}`);
  return { sum, divisor, unrounded, exact, roundingBound };
}

function commonDiagnostic(mean, precision, memberCount) {
  return {
    policy: PROFILE_INVARIANT_AGGREGATION_POLICY,
    memberCount,
    precisionPolicy: precision,
    summation: "exact-decimal",
    divisionExact: mean.exact,
    unrounded: mean.unrounded
  };
}

/**
 * Aggregates a complete, descriptor-validated profile invariant vector.
 * Missing values and descriptor mismatches remain the caller's responsibility
 * because those failures have evaluator-specific diagnostic contracts.
 */
export function aggregateProfileInvariantValues(
  descriptor,
  memberValues,
  precisionPolicy
) {
  if (
    descriptor === undefined ||
    !new Set(["number", "quantity"]).has(descriptor.kind)
  ) {
    fail(
      "PROFILE_INVARIANT_AGGREGATION_TYPE_UNSUPPORTED",
      "Arithmetic profile aggregation requires a number or Quantity invariant.",
      { kind: descriptor?.kind ?? null }
    );
  }
  if (!Array.isArray(memberValues) || memberValues.length === 0) {
    fail(
      "PROFILE_INVARIANT_AGGREGATION_MEMBERS_INVALID",
      "Arithmetic profile aggregation requires a non-empty member vector."
    );
  }
  const precision = normalizePrecisionPolicy(precisionPolicy);
  const actualKinds = memberValues.map(invariantValueKind);
  if (actualKinds.some((kind) => kind !== descriptor.kind)) {
    fail(
      "PROFILE_INVARIANT_AGGREGATION_TYPE_MISMATCH",
      "Profile aggregation members must match the declared invariant type.",
      { expectedKind: descriptor.kind, actualKinds }
    );
  }

  if (descriptor.kind === "number") {
    const mean = aggregationMean(memberValues.map(parseDecimal), precision);
    const value = decimalToNumber(mean.unrounded);
    return {
      kind: "number",
      value,
      unrounded: mean.unrounded,
      exact: mean.exact,
      aggregation: commonDiagnostic(mean, precision, memberValues.length)
    };
  }

  const quantities = memberValues.map(normalizeQuantity);
  const incompatibleIndexes = quantities.flatMap((quantity, index) =>
    quantity.unit === descriptor.unit && quantity.semantic === descriptor.semantic
      ? []
      : [index]
  );
  if (incompatibleIndexes.length > 0) {
    fail(
      "PROFILE_INVARIANT_AGGREGATION_QUANTITY_MISMATCH",
      "Quantity aggregation members must share the declared canonical unit and semantic.",
      {
        expectedUnit: descriptor.unit,
        expectedSemantic: descriptor.semantic,
        incompatibleIndexes
      }
    );
  }

  const mean = aggregationMean(
    quantities.map((quantity) => parseDecimal(quantity.value)),
    precision
  );
  const memberToleranceSum = accumulateDecimals(
    quantities.map(quantityToleranceBound),
    "exact-decimal"
  ).value;
  const meanMemberTolerance = outwardNonnegativeQuotient(
    memberToleranceSum,
    mean.divisor
  );
  const pointValue = decimalToNumber(mean.unrounded);
  const pointConversionBound = decimalAbsolute(
    subtractDecimals(parseDecimal(pointValue), mean.unrounded)
  );
  const effectiveAbsoluteTolerance = addDecimals(
    addDecimals(meanMemberTolerance, mean.roundingBound),
    pointConversionBound
  );
  const evidence = [...new Set(quantities.flatMap(
    (quantity) => quantity.provenance.evidence
  ))].sort();
  const quantity = normalizeQuantity({
    value: pointValue,
    unit: descriptor.unit,
    tolerance: { absolute: outwardDecimalToNumber(effectiveAbsoluteTolerance) },
    semantic: descriptor.semantic,
    provenance: {
      kind: "computed",
      method: PROFILE_INVARIANT_PROVENANCE_METHOD,
      evidence
    }
  });
  return {
    kind: "quantity",
    value: quantity,
    unrounded: mean.unrounded,
    tolerance: effectiveAbsoluteTolerance,
    evidence,
    exact: mean.exact,
    aggregation: {
      ...commonDiagnostic(mean, precision, memberValues.length),
      uncertaintyPolicy: PROFILE_INVARIANT_UNCERTAINTY_POLICY,
      effectiveAbsoluteTolerance,
      evidence
    }
  };
}
