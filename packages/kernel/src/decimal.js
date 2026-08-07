import { deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";

export const DECIMAL_ARITHMETIC_VERSION = "decimal-rational-v1";

export const DECIMAL_LIMITS = deepFreeze({
  maxInputCharacters: 256,
  maxInputSignificantDigits: 1_024,
  maxResultSignificantDigits: 2_048,
  maxAbsoluteScale: 1_024,
  maxDecimalPlaces: 256,
  maxPowerOfTen: 4_096,
  maxTerms: 100_000,
  maxCanonicalCharacters: 4_096
});

const ROUNDING_MODES = new Set(["half-even", "half-up", "toward-zero"]);
const SUMMATION_MODES = new Set(["exact-decimal", "compensated-binary64"]);
const PRECISION_POLICY_FIELDS = new Set(["id", "decimalPlaces", "rounding", "summation"]);
const DECIMAL_VALUE_FIELDS = new Set(["arithmetic", "coefficient", "scale", "canonical"]);
const DECIMAL_PATTERN = /^(-)?(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?(?:0|[1-9][0-9]*)))?$/;
const POWERS_OF_TEN = [1n];

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "DECIMAL", message, details });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function powerOfTen(exponent) {
  if (!Number.isSafeInteger(exponent) || exponent < 0 || exponent > DECIMAL_LIMITS.maxPowerOfTen) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Power-of-ten exponent exceeds the decimal resource limit.", {
      exponent,
      maximum: DECIMAL_LIMITS.maxPowerOfTen
    });
  }
  for (let index = POWERS_OF_TEN.length; index <= exponent; index += 1) {
    POWERS_OF_TEN.push(POWERS_OF_TEN[index - 1] * 10n);
  }
  return POWERS_OF_TEN[exponent];
}

function canonicalString(coefficient, scale) {
  if (coefficient === 0n) return "0";
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString();
  let result;
  if (scale <= 0) {
    result = digits + "0".repeat(-scale);
  } else if (scale >= digits.length) {
    result = `0.${"0".repeat(scale - digits.length)}${digits}`;
  } else {
    result = `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  }
  return negative ? `-${result}` : result;
}

function normalizeParts(coefficient, scale) {
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  let normalizedCoefficient = coefficient;
  let normalizedScale = scale;
  while (normalizedCoefficient % 10n === 0n) {
    normalizedCoefficient /= 10n;
    normalizedScale -= 1;
  }
  return { coefficient: normalizedCoefficient, scale: normalizedScale };
}

function assertPartsWithinLimits(coefficient, scale) {
  if (!Number.isSafeInteger(scale) || Math.abs(scale) > DECIMAL_LIMITS.maxAbsoluteScale) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Decimal scale exceeds the resource limit.", {
      scale,
      maximumAbsoluteScale: DECIMAL_LIMITS.maxAbsoluteScale
    });
  }
  const significantDigits = (coefficient < 0n ? -coefficient : coefficient).toString().length;
  if (significantDigits > DECIMAL_LIMITS.maxResultSignificantDigits) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Decimal coefficient exceeds the significant-digit limit.", {
      significantDigits,
      maximum: DECIMAL_LIMITS.maxResultSignificantDigits
    });
  }
  const canonical = canonicalString(coefficient, scale);
  if (canonical.length > DECIMAL_LIMITS.maxCanonicalCharacters) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Canonical decimal exceeds the character limit.", {
      characters: canonical.length,
      maximum: DECIMAL_LIMITS.maxCanonicalCharacters
    });
  }
  return canonical;
}

function createDecimalValue(coefficient, scale) {
  const normalized = normalizeParts(coefficient, scale);
  const canonical = assertPartsWithinLimits(normalized.coefficient, normalized.scale);
  return deepFreeze({
    arithmetic: DECIMAL_ARITHMETIC_VERSION,
    coefficient: normalized.coefficient.toString(),
    scale: normalized.scale,
    canonical
  });
}

function parseText(text) {
  if (text.length === 0 || text.length > DECIMAL_LIMITS.maxInputCharacters || text !== text.trim()) {
    fail("DECIMAL_INPUT_INVALID", "Decimal input must be normalized and within the character limit.", {
      input: text,
      maximumCharacters: DECIMAL_LIMITS.maxInputCharacters
    });
  }
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) {
    fail("DECIMAL_INPUT_INVALID", "Decimal input does not match the supported grammar.", { input: text });
  }
  const [, negative, integer, fraction = "", exponentText = "0"] = match;
  const digits = `${integer}${fraction}`;
  if (digits.length > DECIMAL_LIMITS.maxInputSignificantDigits) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Decimal input exceeds the significant-digit limit.", {
      significantDigits: digits.length,
      maximum: DECIMAL_LIMITS.maxInputSignificantDigits
    });
  }
  const exponentBigInt = BigInt(exponentText.startsWith("+") ? exponentText.slice(1) : exponentText);
  if (
    exponentBigInt > BigInt(DECIMAL_LIMITS.maxAbsoluteScale) ||
    exponentBigInt < BigInt(-DECIMAL_LIMITS.maxAbsoluteScale)
  ) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Decimal exponent exceeds the resource limit.", {
      exponent: exponentText,
      maximumAbsoluteScale: DECIMAL_LIMITS.maxAbsoluteScale
    });
  }
  const exponent = Number(exponentBigInt);
  const unsignedCoefficient = BigInt(digits);
  const coefficient = negative ? -unsignedCoefficient : unsignedCoefficient;
  const scale = fraction.length - exponent;
  return createDecimalValue(coefficient, scale);
}

function decimalText(input) {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      fail("DECIMAL_INPUT_INVALID", "Numeric decimal input must be finite.", { input });
    }
    return Object.is(input, -0) ? "0" : input.toString();
  }
  if (typeof input === "bigint") return input.toString();
  if (typeof input === "string") return input;
  fail("DECIMAL_INPUT_INVALID", "Decimal input must be a number, bigint, string, or parsed DecimalValue.", {
    inputType: typeof input
  });
}

function parsedParts(value) {
  const parsed = parseDecimal(value);
  return { coefficient: BigInt(parsed.coefficient), scale: parsed.scale };
}

function validateDecimalValue(value) {
  const fields = Object.keys(value);
  if (
    fields.some((field) => !DECIMAL_VALUE_FIELDS.has(field)) ||
    [...DECIMAL_VALUE_FIELDS].some((field) => !fields.includes(field)) ||
    value.arithmetic !== DECIMAL_ARITHMETIC_VERSION ||
    typeof value.coefficient !== "string" ||
    !/^-?(?:0|[1-9][0-9]*)$/.test(value.coefficient) ||
    !Number.isSafeInteger(value.scale) ||
    typeof value.canonical !== "string"
  ) {
    fail("DECIMAL_VALUE_INVALID", "Parsed DecimalValue does not match the public contract.", {
      fields,
      arithmetic: value.arithmetic
    });
  }
  const reconstructed = createDecimalValue(BigInt(value.coefficient), value.scale);
  if (
    reconstructed.coefficient !== value.coefficient ||
    reconstructed.scale !== value.scale ||
    reconstructed.canonical !== value.canonical
  ) {
    fail("DECIMAL_VALUE_INVALID", "Parsed DecimalValue is not canonical.", {
      coefficient: value.coefficient,
      scale: value.scale,
      canonical: value.canonical
    });
  }
  return reconstructed;
}

export function parseDecimal(input) {
  if (isObject(input)) return validateDecimalValue(input);
  return parseText(decimalText(input));
}

export function normalizePrecisionPolicy(policy) {
  if (!isObject(policy)) {
    fail("DECIMAL_POLICY_INVALID", "Precision policy must be an object.", { policy });
  }
  const fields = Object.keys(policy);
  if (
    fields.some((field) => !PRECISION_POLICY_FIELDS.has(field)) ||
    [...PRECISION_POLICY_FIELDS].some((field) => !fields.includes(field))
  ) {
    fail("DECIMAL_POLICY_INVALID", "Precision policy fields do not match the public contract.", {
      fields
    });
  }
  if (
    typeof policy.id !== "string" ||
    policy.id.trim().length === 0 ||
    policy.id !== policy.id.trim()
  ) {
    fail("DECIMAL_POLICY_INVALID", "Precision policy ID must be a normalized non-empty string.", {
      id: policy.id
    });
  }
  if (
    !Number.isSafeInteger(policy.decimalPlaces) ||
    policy.decimalPlaces < 0 ||
    policy.decimalPlaces > DECIMAL_LIMITS.maxDecimalPlaces
  ) {
    fail("DECIMAL_POLICY_INVALID", "decimalPlaces exceeds the supported range.", {
      decimalPlaces: policy.decimalPlaces,
      maximum: DECIMAL_LIMITS.maxDecimalPlaces
    });
  }
  if (!ROUNDING_MODES.has(policy.rounding)) {
    fail("DECIMAL_POLICY_INVALID", "Unknown decimal rounding mode.", { rounding: policy.rounding });
  }
  if (!SUMMATION_MODES.has(policy.summation)) {
    fail("DECIMAL_POLICY_INVALID", "Unknown decimal summation mode.", { summation: policy.summation });
  }
  return deepFreeze({
    id: policy.id,
    decimalPlaces: policy.decimalPlaces,
    rounding: policy.rounding,
    summation: policy.summation
  });
}

function alignParts(left, right) {
  const scale = Math.max(left.scale, right.scale);
  const leftPower = scale - left.scale;
  const rightPower = scale - right.scale;
  return {
    scale,
    leftCoefficient: left.coefficient * powerOfTen(leftPower),
    rightCoefficient: right.coefficient * powerOfTen(rightPower)
  };
}

export function addDecimals(left, right) {
  const aligned = alignParts(parsedParts(left), parsedParts(right));
  return createDecimalValue(aligned.leftCoefficient + aligned.rightCoefficient, aligned.scale);
}

export function subtractDecimals(left, right) {
  const aligned = alignParts(parsedParts(left), parsedParts(right));
  return createDecimalValue(aligned.leftCoefficient - aligned.rightCoefficient, aligned.scale);
}

export function multiplyDecimals(left, right) {
  const leftParts = parsedParts(left);
  const rightParts = parsedParts(right);
  return createDecimalValue(
    leftParts.coefficient * rightParts.coefficient,
    leftParts.scale + rightParts.scale
  );
}

function roundedQuotient(numerator, denominator, rounding) {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n || rounding === "toward-zero") return quotient;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const doubledRemainder = absoluteRemainder * 2n;
  const isTie = doubledRemainder === absoluteDenominator;
  const isAboveHalf = doubledRemainder > absoluteDenominator;
  const oddQuotient = (quotient < 0n ? -quotient : quotient) % 2n === 1n;
  const increment =
    isAboveHalf ||
    (isTie && rounding === "half-up") ||
    (isTie && rounding === "half-even" && oddQuotient);
  if (!increment) return quotient;
  const sign = (numerator < 0n) !== (denominator < 0n) ? -1n : 1n;
  return quotient + sign;
}

function roundParts(parts, decimalPlaces, rounding) {
  if (parts.scale <= decimalPlaces) return createDecimalValue(parts.coefficient, parts.scale);
  const discardedPlaces = parts.scale - decimalPlaces;
  const divisor = powerOfTen(discardedPlaces);
  return createDecimalValue(roundedQuotient(parts.coefficient, divisor, rounding), decimalPlaces);
}

export function roundDecimal(value, policy) {
  const normalizedPolicy = normalizePrecisionPolicy(policy);
  return roundParts(parsedParts(value), normalizedPolicy.decimalPlaces, normalizedPolicy.rounding);
}

export function divideDecimals(dividend, divisor, policy) {
  const normalizedPolicy = normalizePrecisionPolicy(policy);
  const left = parsedParts(dividend);
  const right = parsedParts(divisor);
  if (right.coefficient === 0n) {
    fail("DECIMAL_DIVISION_BY_ZERO", "Decimal division by zero is undefined.");
  }

  const exponent = right.scale - left.scale + normalizedPolicy.decimalPlaces;
  let numerator = left.coefficient;
  let denominator = right.coefficient;
  if (exponent >= 0) numerator *= powerOfTen(exponent);
  else denominator *= powerOfTen(-exponent);

  const coefficient = roundedQuotient(numerator, denominator, normalizedPolicy.rounding);
  return createDecimalValue(coefficient, normalizedPolicy.decimalPlaces);
}

export function decimalToNumber(value) {
  const parsed = parseDecimal(value);
  const result = Number(parsed.canonical);
  if (!Number.isFinite(result)) {
    fail("DECIMAL_NUMBER_OVERFLOW", "Decimal value cannot be represented as finite binary64.", {
      canonical: parsed.canonical
    });
  }
  if (result === 0 && parsed.coefficient !== "0") {
    fail("DECIMAL_NUMBER_UNDERFLOW", "Non-zero decimal value underflows the finite binary64 range.", {
      canonical: parsed.canonical
    });
  }
  return Object.is(result, -0) ? 0 : result;
}

function exactDecimalSum(values) {
  let accumulator = { coefficient: 0n, scale: 0 };
  for (const value of values) {
    const next = parsedParts(value);
    const aligned = alignParts(accumulator, next);
    accumulator = normalizeParts(
      aligned.leftCoefficient + aligned.rightCoefficient,
      aligned.scale
    );
    assertPartsWithinLimits(accumulator.coefficient, accumulator.scale);
  }
  return accumulator;
}

function compensatedBinary64Sum(values) {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    const number = decimalToNumber(value);
    const next = sum + number;
    if (!Number.isFinite(next)) {
      fail("DECIMAL_NUMBER_OVERFLOW", "Compensated binary64 sum became non-finite.", {
        sum,
        next: number
      });
    }
    correction += Math.abs(sum) >= Math.abs(number)
      ? (sum - next) + number
      : (number - next) + sum;
    if (!Number.isFinite(correction)) {
      fail("DECIMAL_NUMBER_OVERFLOW", "Compensated binary64 correction became non-finite.", {
        correction
      });
    }
    sum = next;
  }
  const result = sum + correction;
  if (!Number.isFinite(result)) {
    fail("DECIMAL_NUMBER_OVERFLOW", "Compensated binary64 result became non-finite.", {
      sum,
      correction
    });
  }
  return parsedParts(Object.is(result, -0) ? 0 : result);
}

export function sumDecimals(values, policy) {
  if (!Array.isArray(values)) {
    fail("DECIMAL_SUM_INPUT_INVALID", "Decimal summation requires an array.", {
      inputType: typeof values
    });
  }
  if (values.length > DECIMAL_LIMITS.maxTerms) {
    fail("DECIMAL_LIMIT_EXCEEDED", "Decimal summation exceeds the term limit.", {
      terms: values.length,
      maximum: DECIMAL_LIMITS.maxTerms
    });
  }
  const normalizedPolicy = normalizePrecisionPolicy(policy);
  const exact = normalizedPolicy.summation === "exact-decimal";
  const accumulated = exact ? exactDecimalSum(values) : compensatedBinary64Sum(values);
  const value = roundParts(accumulated, normalizedPolicy.decimalPlaces, normalizedPolicy.rounding);
  return deepFreeze({
    arithmetic: DECIMAL_ARITHMETIC_VERSION,
    policy: normalizedPolicy,
    termCount: values.length,
    exact,
    value
  });
}
