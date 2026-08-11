import { deepFreeze } from "./canonical.js";
import { decimalToNumber, multiplyDecimals, parseDecimal } from "./decimal.js";
import { KernelError } from "./errors.js";

export const UNIT_GRAMMAR_VERSION = "si-multiplicative-v1";
export const QUANTITY_COMPARISON_POLICY_VERSION = "declared-max-tolerance-v1";

const BASE_UNIT_ORDER = Object.freeze(["kg", "m", "s", "A", "K", "mol", "cd"]);
const MAX_UNIT_EXPRESSION_LENGTH = 128;
const MAX_UNIT_FACTORS = 32;
const MAX_COMBINED_EXPONENT = 64;
const MAX_UNIT_EXPONENT = MAX_COMBINED_EXPONENT;
const COMPARATORS = new Set(["eq", "ne", "lt", "lte", "gt", "gte"]);
const QUANTITY_FIELDS = new Set(["value", "unit", "tolerance", "semantic", "provenance"]);
const CONTENT_HASH = /^sha256:[a-f0-9]{64}$/;
const PROVENANCE_FIELDS = Object.freeze({
  declared: new Set(["kind", "evidence"]),
  computed: new Set(["kind", "method", "evidence"]),
  oracle: new Set(["kind", "source", "method", "evidence"])
});

function dimensions(entries = {}) {
  return Object.freeze({ ...entries });
}

const UNIT_DEFINITIONS = Object.freeze({
  "1": { scale: "1", dimensions: dimensions(), prefixable: false },
  m: { scale: "1", dimensions: dimensions({ m: 1 }), prefixable: true },
  kg: { scale: "1", dimensions: dimensions({ kg: 1 }), prefixable: false },
  g: { scale: "1e-3", dimensions: dimensions({ kg: 1 }), prefixable: true },
  s: { scale: "1", dimensions: dimensions({ s: 1 }), prefixable: true },
  A: { scale: "1", dimensions: dimensions({ A: 1 }), prefixable: true },
  K: { scale: "1", dimensions: dimensions({ K: 1 }), prefixable: true },
  mol: { scale: "1", dimensions: dimensions({ mol: 1 }), prefixable: true },
  cd: { scale: "1", dimensions: dimensions({ cd: 1 }), prefixable: true },
  rad: { scale: "1", dimensions: dimensions(), prefixable: true },
  sr: { scale: "1", dimensions: dimensions(), prefixable: true },
  Hz: { scale: "1", dimensions: dimensions({ s: -1 }), prefixable: true },
  N: { scale: "1", dimensions: dimensions({ kg: 1, m: 1, s: -2 }), prefixable: true },
  Pa: { scale: "1", dimensions: dimensions({ kg: 1, m: -1, s: -2 }), prefixable: true },
  J: { scale: "1", dimensions: dimensions({ kg: 1, m: 2, s: -2 }), prefixable: true },
  W: { scale: "1", dimensions: dimensions({ kg: 1, m: 2, s: -3 }), prefixable: true },
  C: { scale: "1", dimensions: dimensions({ A: 1, s: 1 }), prefixable: true },
  V: { scale: "1", dimensions: dimensions({ kg: 1, m: 2, s: -3, A: -1 }), prefixable: true },
  F: { scale: "1", dimensions: dimensions({ kg: -1, m: -2, s: 4, A: 2 }), prefixable: true },
  ohm: { scale: "1", dimensions: dimensions({ kg: 1, m: 2, s: -3, A: -2 }), prefixable: true },
  S: { scale: "1", dimensions: dimensions({ kg: -1, m: -2, s: 3, A: 2 }), prefixable: true },
  Wb: { scale: "1", dimensions: dimensions({ kg: 1, m: 2, s: -2, A: -1 }), prefixable: true },
  T: { scale: "1", dimensions: dimensions({ kg: 1, s: -2, A: -1 }), prefixable: true },
  H: { scale: "1", dimensions: dimensions({ kg: 1, m: 2, s: -2, A: -2 }), prefixable: true },
  lm: { scale: "1", dimensions: dimensions({ cd: 1 }), prefixable: true },
  lx: { scale: "1", dimensions: dimensions({ cd: 1, m: -2 }), prefixable: true },
  Bq: { scale: "1", dimensions: dimensions({ s: -1 }), prefixable: true },
  Gy: { scale: "1", dimensions: dimensions({ m: 2, s: -2 }), prefixable: true },
  Sv: { scale: "1", dimensions: dimensions({ m: 2, s: -2 }), prefixable: true },
  kat: { scale: "1", dimensions: dimensions({ mol: 1, s: -1 }), prefixable: true },
  min: { scale: "60", dimensions: dimensions({ s: 1 }), prefixable: false },
  h: { scale: "3600", dimensions: dimensions({ s: 1 }), prefixable: false },
  d: { scale: "86400", dimensions: dimensions({ s: 1 }), prefixable: false },
  L: { scale: "1e-3", dimensions: dimensions({ m: 3 }), prefixable: true }
});

const PREFIXES = Object.freeze([
  ["da", "1e1"],
  ["Y", "1e24"],
  ["Z", "1e21"],
  ["E", "1e18"],
  ["P", "1e15"],
  ["T", "1e12"],
  ["G", "1e9"],
  ["M", "1e6"],
  ["k", "1e3"],
  ["h", "1e2"],
  ["d", "1e-1"],
  ["c", "1e-2"],
  ["m", "1e-3"],
  ["u", "1e-6"],
  ["n", "1e-9"],
  ["p", "1e-12"],
  ["f", "1e-15"],
  ["a", "1e-18"],
  ["z", "1e-21"],
  ["y", "1e-24"]
]);

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "QUANTITY", message, details });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeFinite(value, code, message, details = {}) {
  if (!Number.isFinite(value)) fail(code, message, { ...details, value });
  return Object.is(value, -0) ? 0 : value;
}

function greatestCommonDivisor(left, right) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function createScaleRatio(numerator, denominator) {
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor
  };
}

function decimalScaleRatio(value) {
  const parsed = parseDecimal(value);
  const coefficient = BigInt(parsed.coefficient);
  return parsed.scale >= 0
    ? createScaleRatio(coefficient, 10n ** BigInt(parsed.scale))
    : createScaleRatio(coefficient * 10n ** BigInt(-parsed.scale), 1n);
}

function multiplyScaleRatios(left, right) {
  return createScaleRatio(
    left.numerator * right.numerator,
    left.denominator * right.denominator
  );
}

function divideScaleRatios(left, right) {
  return createScaleRatio(
    left.numerator * right.denominator,
    left.denominator * right.numerator
  );
}

function powerScaleRatio(value, exponent) {
  const power = BigInt(Math.abs(exponent));
  const powered = {
    numerator: value.numerator ** power,
    denominator: value.denominator ** power
  };
  return exponent < 0
    ? { numerator: powered.denominator, denominator: powered.numerator }
    : powered;
}

function leadingMantissa(text) {
  const digits = text.slice(0, 16);
  return Number(digits) / 10 ** (digits.length - 1);
}

function scaleRatioToNumber(value) {
  const directNumerator = Number(value.numerator);
  const directDenominator = Number(value.denominator);
  if (Number.isFinite(directNumerator) && Number.isFinite(directDenominator)) {
    return directNumerator / directDenominator;
  }
  const numerator = value.numerator.toString();
  const denominator = value.denominator.toString();
  return leadingMantissa(numerator) /
    leadingMantissa(denominator) *
    10 ** (numerator.length - denominator.length);
}

function resolveSymbol(symbol) {
  if (Object.prototype.hasOwnProperty.call(UNIT_DEFINITIONS, symbol)) {
    const definition = UNIT_DEFINITIONS[symbol];
    return { ...definition, scale: decimalScaleRatio(definition.scale) };
  }
  for (const [prefix, prefixScale] of PREFIXES) {
    if (!symbol.startsWith(prefix) || symbol.length === prefix.length) continue;
    const base = symbol.slice(prefix.length);
    const definition = UNIT_DEFINITIONS[base];
    if (definition?.prefixable) {
      return {
        scale: multiplyScaleRatios(
          decimalScaleRatio(prefixScale),
          decimalScaleRatio(definition.scale)
        ),
        dimensions: definition.dimensions,
        prefixable: false
      };
    }
  }
  fail("QUANTITY_UNIT_UNSUPPORTED", "Unit symbol is not supported by the active grammar.", {
    grammar: UNIT_GRAMMAR_VERSION,
    symbol
  });
}

function formatCanonicalUnit(unitDimensions) {
  const factors = [];
  for (const symbol of BASE_UNIT_ORDER) {
    const exponent = unitDimensions[symbol] || 0;
    if (exponent === 0) continue;
    factors.push(exponent === 1 ? symbol : `${symbol}^${exponent}`);
  }
  return factors.length === 0 ? "1" : factors.join("*");
}

function dimensionSignature(unitDimensions) {
  return BASE_UNIT_ORDER.map((symbol) => unitDimensions[symbol] || 0).join(":");
}

function parseUnitExpressionInternal(expression) {
  if (typeof expression !== "string" || expression.length === 0) {
    fail("QUANTITY_UNIT_INVALID", "Unit expression must be a non-empty string.", { expression });
  }
  if (
    expression !== expression.trim() ||
    /\s/.test(expression) ||
    expression.length > MAX_UNIT_EXPRESSION_LENGTH
  ) {
    fail("QUANTITY_UNIT_INVALID", "Unit expression is not normalized or exceeds the grammar limit.", {
      expression,
      maximumLength: MAX_UNIT_EXPRESSION_LENGTH
    });
  }

  const resultDimensions = {};
  let scaleRatio = { numerator: 1n, denominator: 1n };
  let index = 0;
  let operatorSign = 1;
  let factorCount = 0;

  while (index < expression.length) {
    const symbolMatch = /^(?:1|[A-Za-z][A-Za-z0-9]*)/.exec(expression.slice(index));
    if (!symbolMatch) {
      fail("QUANTITY_UNIT_INVALID", "Expected a unit symbol.", { expression, index });
    }
    const symbol = symbolMatch[0];
    index += symbol.length;

    let exponent = 1;
    if (expression[index] === "^") {
      index += 1;
      const exponentMatch = /^-?(?:[1-9][0-9]*)/.exec(expression.slice(index));
      if (!exponentMatch) {
        fail("QUANTITY_UNIT_INVALID", "Unit exponent must be a non-zero integer without leading zeroes.", {
          expression,
          index
        });
      }
      exponent = Number(exponentMatch[0]);
      index += exponentMatch[0].length;
      if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_UNIT_EXPONENT) {
        fail("QUANTITY_UNIT_INVALID", "Unit exponent exceeds the grammar limit.", {
          expression,
          exponent,
          maximumAbsoluteExponent: MAX_UNIT_EXPONENT
        });
      }
    }
    exponent *= operatorSign;

    const definition = resolveSymbol(symbol);
    const scaleFactor = powerScaleRatio(definition.scale, exponent);
    const nextScaleRatio = multiplyScaleRatios(scaleRatio, scaleFactor);
    const nextScale = scaleRatioToNumber(nextScaleRatio);
    if (!Number.isFinite(nextScale) || nextScale === 0) {
      fail("QUANTITY_UNIT_INVALID", "Unit scale is outside the supported finite non-zero range.", {
        expression,
        scale: nextScale
      });
    }
    scaleRatio = nextScaleRatio;
    for (const [base, baseExponent] of Object.entries(definition.dimensions)) {
      const combined = (resultDimensions[base] || 0) + baseExponent * exponent;
      if (Math.abs(combined) > MAX_COMBINED_EXPONENT) {
        fail("QUANTITY_UNIT_INVALID", "Combined unit exponent exceeds the grammar limit.", {
          expression,
          base,
          exponent: combined,
          maximumAbsoluteExponent: MAX_COMBINED_EXPONENT
        });
      }
      if (combined === 0) delete resultDimensions[base];
      else resultDimensions[base] = combined;
    }

    factorCount += 1;
    if (factorCount > MAX_UNIT_FACTORS) {
      fail("QUANTITY_UNIT_INVALID", "Unit expression has too many factors.", {
        expression,
        maximumFactors: MAX_UNIT_FACTORS
      });
    }
    if (index === expression.length) break;

    const operator = expression[index];
    if (operator !== "*" && operator !== "/") {
      fail("QUANTITY_UNIT_INVALID", "Expected '*' or '/' between unit factors.", {
        expression,
        index
      });
    }
    operatorSign = operator === "/" ? -1 : 1;
    index += 1;
    if (index === expression.length) {
      fail("QUANTITY_UNIT_INVALID", "Unit expression cannot end with an operator.", {
        expression,
        index: index - 1
      });
    }
  }

  const orderedDimensions = {};
  for (const symbol of BASE_UNIT_ORDER) {
    if (resultDimensions[symbol] !== undefined) orderedDimensions[symbol] = resultDimensions[symbol];
  }
  return {
    parsed: deepFreeze({
      grammar: UNIT_GRAMMAR_VERSION,
      expression,
      canonicalUnit: formatCanonicalUnit(orderedDimensions),
      dimensionSignature: dimensionSignature(orderedDimensions),
      dimensions: orderedDimensions,
      scale: scaleRatioToNumber(scaleRatio)
    }),
    scaleRatio
  };
}

export function parseUnitExpression(expression) {
  return parseUnitExpressionInternal(expression).parsed;
}

export function normalizeUnitExpression(expression) {
  return parseUnitExpression(expression).canonicalUnit;
}

export function areUnitsCompatible(left, right) {
  return parseUnitExpression(left).dimensionSignature === parseUnitExpression(right).dimensionSignature;
}

function normalizeTolerance(tolerance) {
  if (!isObject(tolerance)) {
    fail("QUANTITY_TOLERANCE_INVALID", "Quantity tolerance must be an object.", { tolerance });
  }
  const keys = Object.keys(tolerance);
  if (keys.length === 0 || keys.some((key) => key !== "absolute" && key !== "relative")) {
    fail("QUANTITY_TOLERANCE_INVALID", "Tolerance needs an absolute or relative bound and no unknown fields.", {
      fields: keys
    });
  }
  const normalized = {};
  if (tolerance.absolute !== undefined) {
    if (!Number.isFinite(tolerance.absolute) || tolerance.absolute < 0) {
      fail("QUANTITY_TOLERANCE_INVALID", "Absolute tolerance must be finite and non-negative.", {
        value: tolerance.absolute
      });
    }
    normalized.absolute = Object.is(tolerance.absolute, -0) ? 0 : tolerance.absolute;
  }
  if (tolerance.relative !== undefined) {
    if (!Number.isFinite(tolerance.relative) || tolerance.relative < 0) {
      fail("QUANTITY_TOLERANCE_INVALID", "Relative tolerance must be finite and non-negative.", {
        value: tolerance.relative
      });
    }
    normalized.relative = Object.is(tolerance.relative, -0) ? 0 : tolerance.relative;
  }
  if (Object.keys(normalized).length === 0) {
    fail("QUANTITY_TOLERANCE_INVALID", "Tolerance needs a defined absolute or relative bound.", {
      fields: keys
    });
  }
  return normalized;
}

function copyProvenance(provenance) {
  if (!isObject(provenance)) {
    fail("QUANTITY_PROVENANCE_INVALID", "Quantity provenance must be an object.", { provenance });
  }
  const allowed = PROVENANCE_FIELDS[provenance.kind];
  if (!allowed) {
    fail("QUANTITY_PROVENANCE_INVALID", "Unknown quantity provenance kind.", {
      kind: provenance.kind
    });
  }
  const fields = Object.keys(provenance);
  if (fields.some((field) => !allowed.has(field)) || [...allowed].some((field) => !fields.includes(field))) {
    fail("QUANTITY_PROVENANCE_INVALID", "Quantity provenance fields do not match its kind.", {
      kind: provenance.kind,
      fields
    });
  }
  if (
    !Array.isArray(provenance.evidence) ||
    provenance.evidence.some((entry) =>
      typeof entry !== "string" || entry.trim().length === 0 || entry !== entry.trim()
    ) ||
    new Set(provenance.evidence).size !== provenance.evidence.length
  ) {
    fail("QUANTITY_PROVENANCE_INVALID", "Quantity evidence must contain unique normalized non-empty identifiers.", {
      evidence: provenance.evidence
    });
  }
  if (
    (provenance.kind === "computed" || provenance.kind === "oracle") &&
    (
      typeof provenance.method !== "string" ||
      provenance.method.trim().length === 0 ||
      provenance.method !== provenance.method.trim()
    )
  ) {
    fail("QUANTITY_PROVENANCE_INVALID", "Computed and Oracle quantities require a normalized method identifier.", {
      method: provenance.method
    });
  }
  if (provenance.kind === "oracle" && !CONTENT_HASH.test(provenance.source)) {
    fail("QUANTITY_PROVENANCE_INVALID", "Oracle quantity provenance requires a content hash source.", {
      source: provenance.source
    });
  }
  return {
    kind: provenance.kind,
    ...(provenance.method === undefined ? {} : { method: provenance.method.trim() }),
    ...(provenance.source === undefined ? {} : { source: provenance.source }),
    evidence: [...provenance.evidence].sort()
  };
}

function normalizeQuantityInput(quantity) {
  if (!isObject(quantity)) {
    fail("QUANTITY_VALUE_INVALID", "Quantity must be an object.", { quantity });
  }
  const fields = Object.keys(quantity);
  if (
    fields.some((field) => !QUANTITY_FIELDS.has(field)) ||
    [...QUANTITY_FIELDS].some((field) => !fields.includes(field))
  ) {
    fail("QUANTITY_VALUE_INVALID", "Quantity fields do not match the public contract.", { fields });
  }
  const value = normalizeFinite(
    quantity.value,
    "QUANTITY_VALUE_INVALID",
    "Quantity value must be finite."
  );
  if (
    typeof quantity.semantic !== "string" ||
    quantity.semantic.trim().length === 0 ||
    quantity.semantic !== quantity.semantic.trim()
  ) {
    fail("QUANTITY_SEMANTIC_INVALID", "Quantity semantic must be a normalized non-empty string.", {
      semantic: quantity.semantic
    });
  }
  const unit = parseUnitExpressionInternal(quantity.unit);
  return {
    value,
    unit: { ...unit.parsed, scaleRatio: unit.scaleRatio },
    tolerance: normalizeTolerance(quantity.tolerance),
    semantic: quantity.semantic,
    provenance: copyProvenance(quantity.provenance)
  };
}

function exactlyScaledDecimal(value, ratio) {
  const parsed = parseDecimal(value);
  if (parsed.coefficient === "0") return parsed;
  let numerator = BigInt(parsed.coefficient) * ratio.numerator;
  let denominator = ratio.denominator;
  const reduced = createScaleRatio(numerator, denominator);
  numerator = reduced.numerator;
  denominator = reduced.denominator;

  let powersOfTwo = 0;
  let powersOfFive = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    powersOfTwo += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    powersOfFive += 1;
  }
  if (denominator !== 1n) return null;

  const decimalPlaces = Math.max(powersOfTwo, powersOfFive);
  const coefficient = numerator *
    2n ** BigInt(decimalPlaces - powersOfTwo) *
    5n ** BigInt(decimalPlaces - powersOfFive);
  const resultScale = parsed.scale + decimalPlaces;
  return parseDecimal(`${coefficient}e${-resultScale}`);
}

function scaledFinite(value, ratio, details) {
  const multiplier = scaleRatioToNumber(ratio);
  try {
    const exact = exactlyScaledDecimal(value, ratio);
    const scaled = decimalToNumber(exact ??
      multiplyDecimals(parseDecimal(value), parseDecimal(multiplier))
    );
    return normalizeFinite(
      scaled,
      "QUANTITY_CONVERSION_OVERFLOW",
      "Unit conversion produced a non-finite value.",
      details
    );
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    if (error.code === "DECIMAL_NUMBER_UNDERFLOW") {
      fail("QUANTITY_CONVERSION_UNDERFLOW", "Non-zero quantity conversion underflowed to zero.", {
        ...details,
        value,
        multiplier
      });
    }
    if (error.code === "DECIMAL_NUMBER_OVERFLOW") {
      fail("QUANTITY_CONVERSION_OVERFLOW", "Unit conversion produced a non-finite value.", {
        ...details,
        value,
        multiplier
      });
    }
    throw error;
  }
}

export function convertQuantity(quantity, targetUnit) {
  const source = normalizeQuantityInput(quantity);
  const target = parseUnitExpressionInternal(targetUnit);
  if (source.unit.dimensionSignature !== target.parsed.dimensionSignature) {
    fail("QUANTITY_UNIT_INCOMPATIBLE", "Quantity units have different dimensions.", {
      sourceUnit: source.unit.expression,
      sourceDimensions: source.unit.dimensions,
      targetUnit: target.parsed.expression,
      targetDimensions: target.parsed.dimensions
    });
  }
  const multiplierRatio = divideScaleRatios(source.unit.scaleRatio, target.scaleRatio);
  const multiplier = scaleRatioToNumber(multiplierRatio);
  if (!Number.isFinite(multiplier)) {
    fail("QUANTITY_CONVERSION_OVERFLOW", "Unit conversion factor is outside the supported finite non-zero range.", {
      sourceUnit: source.unit.expression,
      targetUnit: target.parsed.expression,
      multiplier
    });
  }
  if (multiplier === 0) {
    fail("QUANTITY_CONVERSION_UNDERFLOW", "Non-zero unit conversion factor underflowed to zero.", {
      sourceUnit: source.unit.expression,
      targetUnit: target.parsed.expression
    });
  }
  const tolerance = {
    ...(source.tolerance.absolute === undefined
      ? {}
      : {
          absolute: scaledFinite(source.tolerance.absolute, multiplierRatio, {
            sourceUnit: source.unit.expression,
            targetUnit: target.parsed.expression,
            field: "tolerance.absolute"
          })
        }),
    ...(source.tolerance.relative === undefined ? {} : { relative: source.tolerance.relative })
  };
  return deepFreeze({
    value: scaledFinite(source.value, multiplierRatio, {
      sourceUnit: source.unit.expression,
      targetUnit: target.parsed.expression,
      field: "value"
    }),
    unit: target.parsed.expression,
    tolerance,
    semantic: source.semantic,
    provenance: source.provenance
  });
}

export function normalizeQuantity(quantity) {
  const parsed = parseUnitExpression(quantity?.unit);
  return convertQuantity(quantity, parsed.canonicalUnit);
}

function toleranceBound(quantity, referenceMagnitude) {
  const relative = quantity.tolerance.relative || 0;
  const relativeBound = relative * referenceMagnitude;
  if (relativeBound === 0 && relative !== 0 && referenceMagnitude !== 0) {
    fail("QUANTITY_COMPARISON_UNDERFLOW", "Non-zero relative tolerance underflowed to zero.", {
      relative,
      referenceMagnitude
    });
  }
  return Math.max(
    quantity.tolerance.absolute || 0,
    relativeBound
  );
}

export function compareQuantities(left, comparator, right, options = {}) {
  if (!COMPARATORS.has(comparator)) {
    fail("QUANTITY_COMPARATOR_INVALID", "Unknown quantity comparator.", { comparator });
  }
  if (!isObject(options)) {
    fail("QUANTITY_COMPARISON_OPTIONS_INVALID", "Quantity comparison options must be an object.", {
      options
    });
  }
  const optionFields = Object.keys(options);
  if (optionFields.some((field) => field !== "semanticPolicy")) {
    fail("QUANTITY_COMPARISON_OPTIONS_INVALID", "Unknown quantity comparison option.", {
      fields: optionFields
    });
  }
  const semanticPolicy = options.semanticPolicy === undefined
    ? "require-equal"
    : options.semanticPolicy;
  if (semanticPolicy !== "require-equal" && semanticPolicy !== "ignore") {
    fail("QUANTITY_COMPARISON_OPTIONS_INVALID", "Unknown quantity semantic policy.", {
      semanticPolicy
    });
  }

  const normalizedLeft = normalizeQuantity(left);
  const normalizedRight = normalizeQuantity(right);
  if (normalizedLeft.unit !== normalizedRight.unit) {
    fail("QUANTITY_UNIT_INCOMPATIBLE", "Quantity units have different dimensions.", {
      leftUnit: left?.unit,
      rightUnit: right?.unit
    });
  }
  if (semanticPolicy === "require-equal" && normalizedLeft.semantic !== normalizedRight.semantic) {
    fail("QUANTITY_SEMANTIC_INCOMPATIBLE", "Quantity semantics differ under the active comparison policy.", {
      leftSemantic: normalizedLeft.semantic,
      rightSemantic: normalizedRight.semantic
    });
  }

  const difference = normalizeFinite(
    normalizedLeft.value - normalizedRight.value,
    "QUANTITY_COMPARISON_OVERFLOW",
    "Quantity comparison produced a non-finite difference."
  );
  const referenceMagnitude = Math.max(Math.abs(normalizedLeft.value), Math.abs(normalizedRight.value));
  const effectiveTolerance = normalizeFinite(
    Math.max(
      toleranceBound(normalizedLeft, referenceMagnitude),
      toleranceBound(normalizedRight, referenceMagnitude)
    ),
    "QUANTITY_COMPARISON_OVERFLOW",
    "Quantity comparison produced a non-finite tolerance."
  );
  const equivalent = Math.abs(difference) <= effectiveTolerance;
  const relation = difference < 0 ? -1 : difference > 0 ? 1 : 0;
  const pass = {
    eq: equivalent,
    ne: !equivalent,
    lt: difference < -effectiveTolerance,
    lte: difference <= effectiveTolerance,
    gt: difference > effectiveTolerance,
    gte: difference >= -effectiveTolerance
  }[comparator];

  return deepFreeze({
    comparator,
    pass,
    equivalent,
    relation,
    unit: normalizedLeft.unit,
    leftValue: normalizedLeft.value,
    rightValue: normalizedRight.value,
    difference,
    effectiveTolerance,
    semanticPolicy
  });
}
