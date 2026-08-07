import assert from "node:assert/strict";
import test from "node:test";
import {
  DECIMAL_ARITHMETIC_VERSION,
  DECIMAL_LIMITS,
  KernelError,
  addDecimals,
  decimalToNumber,
  divideDecimals,
  multiplyDecimals,
  normalizePrecisionPolicy,
  parseDecimal,
  roundDecimal,
  subtractDecimals,
  sumDecimals
} from "../src/index.js";

function policy({
  decimalPlaces = 2,
  rounding = "half-even",
  summation = "exact-decimal"
} = {}) {
  return {
    id: `fixture-${decimalPlaces}-${rounding}-${summation}`,
    decimalPlaces,
    rounding,
    summation
  };
}

test("decimal parsing produces one canonical coefficient and scale", () => {
  const value = parseDecimal("1.2300e2");
  assert.equal(DECIMAL_ARITHMETIC_VERSION, "decimal-rational-v1");
  assert.deepEqual(value, {
    arithmetic: "decimal-rational-v1",
    coefficient: "123",
    scale: 0,
    canonical: "123"
  });
  assert.equal(parseDecimal("-0.000").canonical, "0");
  assert.equal(parseDecimal("1e-3").canonical, "0.001");
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(DECIMAL_LIMITS));
});

test("decimal arithmetic avoids binary64 addition artifacts", () => {
  assert.equal(addDecimals("0.1", "0.2").canonical, "0.3");
  assert.equal(subtractDecimals("1", "0.125").canonical, "0.875");
  assert.equal(multiplyDecimals("1.20", "3").canonical, "3.6");
  assert.equal(decimalToNumber(addDecimals("0.1", "0.2")), 0.3);
});

test("rounding modes handle positive and negative ties explicitly", () => {
  assert.equal(roundDecimal("2.5", policy({ decimalPlaces: 0, rounding: "half-even" })).canonical, "2");
  assert.equal(roundDecimal("3.5", policy({ decimalPlaces: 0, rounding: "half-even" })).canonical, "4");
  assert.equal(roundDecimal("-2.5", policy({ decimalPlaces: 0, rounding: "half-even" })).canonical, "-2");
  assert.equal(roundDecimal("-2.5", policy({ decimalPlaces: 0, rounding: "half-up" })).canonical, "-3");
  assert.equal(roundDecimal("-2.9", policy({ decimalPlaces: 0, rounding: "toward-zero" })).canonical, "-2");
});

test("division rounds only at the declared result boundary", () => {
  assert.equal(divideDecimals("1", "8", policy({ decimalPlaces: 2, rounding: "half-even" })).canonical, "0.12");
  assert.equal(divideDecimals("1", "8", policy({ decimalPlaces: 2, rounding: "half-up" })).canonical, "0.13");
  assert.equal(divideDecimals("2", "3", policy({ decimalPlaces: 4, rounding: "half-up" })).canonical, "0.6667");
});

test("exact decimal accumulation is order independent for finite fixtures", () => {
  const first = sumDecimals(["0.1", "0.2", "-0.3"], policy({ decimalPlaces: 8 }));
  const second = sumDecimals(["-0.3", "0.2", "0.1"], policy({ decimalPlaces: 8 }));
  assert.equal(first.value.canonical, "0");
  assert.deepEqual(first.value, second.value);
  assert.equal(first.exact, true);
  assert.equal(first.termCount, 3);
});

test("compensated binary64 accumulation retains a lost low-order term", () => {
  const result = sumDecimals(
    ["10000000000000000", "1", "-10000000000000000"],
    policy({ decimalPlaces: 0, summation: "compensated-binary64" })
  );
  assert.equal(result.value.canonical, "1");
  assert.equal(result.exact, false);
});

test("precision policy and arithmetic failures are explicit", () => {
  assert.deepEqual(normalizePrecisionPolicy(policy()), policy());
  assert.throws(
    () => normalizePrecisionPolicy(policy({ decimalPlaces: DECIMAL_LIMITS.maxDecimalPlaces + 1 })),
    (error) => error instanceof KernelError && error.code === "DECIMAL_POLICY_INVALID"
  );
  assert.throws(
    () => parseDecimal("01.2"),
    (error) => error instanceof KernelError && error.code === "DECIMAL_INPUT_INVALID"
  );
  assert.throws(
    () => divideDecimals("1", "0", policy()),
    (error) => error instanceof KernelError && error.code === "DECIMAL_DIVISION_BY_ZERO"
  );
  assert.throws(
    () => decimalToNumber("1e-400"),
    (error) => error instanceof KernelError && error.code === "DECIMAL_NUMBER_UNDERFLOW"
  );
  assert.throws(
    () => sumDecimals(["1e-400"], policy({ summation: "compensated-binary64" })),
    (error) => error instanceof KernelError && error.code === "DECIMAL_NUMBER_UNDERFLOW"
  );
});
