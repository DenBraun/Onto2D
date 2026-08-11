import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  UNIT_GRAMMAR_VERSION,
  areUnitsCompatible,
  canonicalizeCandidate,
  compareQuantities,
  convertQuantity,
  normalizeQuantity,
  normalizeUnitExpression,
  parseUnitExpression
} from "../src/index.js";

const REF = `sha256:${"a".repeat(64)}`;

function quantity(value, unit, semantic = "fixture length", tolerance = { absolute: 0 }) {
  return {
    value,
    unit,
    tolerance,
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

test("unit grammar canonicalizes derived and compound SI expressions", () => {
  const derived = parseUnitExpression("N");
  const expanded = parseUnitExpression("kg*m/s^2");

  assert.equal(UNIT_GRAMMAR_VERSION, "si-multiplicative-v1");
  assert.equal(derived.canonicalUnit, "kg*m*s^-2");
  assert.equal(expanded.canonicalUnit, derived.canonicalUnit);
  assert.equal(expanded.dimensionSignature, derived.dimensionSignature);
  assert.equal(normalizeUnitExpression("m/s/s"), "m*s^-2");
  const repeated = parseUnitExpression("m^16*m^16");
  assert.equal(repeated.canonicalUnit, "m^32");
  assert.equal(parseUnitExpression(repeated.canonicalUnit).dimensionSignature, repeated.dimensionSignature);
  assert.equal(normalizeQuantity(quantity(1, "m^16*m^16")).unit, "m^32");
  assert.ok(Object.isFrozen(derived));
  assert.ok(Object.isFrozen(derived.dimensions));
});

test("quantity normalization converts prefixed values and absolute tolerance", () => {
  const normalized = normalizeQuantity(quantity(250, "cm", "fixture length", {
    absolute: 1,
    relative: 0.01
  }));

  assert.equal(normalized.value, 2.5);
  assert.equal(normalized.unit, "m");
  assert.equal(normalized.tolerance.absolute, 0.01);
  assert.equal(normalized.tolerance.relative, 0.01);

  const convertedBack = convertQuantity(normalized, "cm");
  assert.equal(convertedBack.value, 250);
  assert.equal(convertedBack.unit, "cm");
  assert.equal(convertedBack.tolerance.absolute, 1);

  const squaredPrefix = normalizeQuantity(quantity(1, "dm^2", "fixture area"));
  assert.equal(parseUnitExpression("dm^2").scale, 0.01);
  assert.equal(squaredPrefix.value, 0.01);
  assert.equal(squaredPrefix.unit, "m^2");

  const nonTerminating = convertQuantity(quantity(1, "s", "fixture time"), "min");
  assert.equal(nonTerminating.value, 1 / 60);
});

test("compatibility is dimensional rather than textual", () => {
  assert.equal(areUnitsCompatible("Hz", "s^-1"), true);
  assert.equal(areUnitsCompatible("mL", "cm^3"), true);
  assert.equal(areUnitsCompatible("kg", "m"), false);
});

test("quantity comparison applies the maximum declared absolute or relative bound", () => {
  const left = quantity(100, "cm", "fixture length", { absolute: 0 });
  const right = quantity(1.0005, "m", "fixture length", { absolute: 0.001 });

  const equal = compareQuantities(left, "eq", right);
  const strictLess = compareQuantities(left, "lt", right);
  const lessOrEqual = compareQuantities(left, "lte", right);

  assert.equal(equal.pass, true);
  assert.equal(equal.equivalent, true);
  assert.equal(equal.unit, "m");
  assert.equal(equal.effectiveTolerance, 0.001);
  assert.equal(strictLess.pass, false);
  assert.equal(lessOrEqual.pass, true);
});

test("invalid, incompatible, and semantically mismatched comparisons fail explicitly", () => {
  assert.throws(
    () => parseUnitExpression("m / s"),
    (error) => error instanceof KernelError && error.code === "QUANTITY_UNIT_INVALID"
  );
  assert.throws(
    () => parseUnitExpression("widget"),
    (error) => error instanceof KernelError && error.code === "QUANTITY_UNIT_UNSUPPORTED"
  );
  assert.throws(
    () => convertQuantity(quantity(1, "m"), "s"),
    (error) => error instanceof KernelError && error.code === "QUANTITY_UNIT_INCOMPATIBLE"
  );
  assert.throws(
    () => compareQuantities(quantity(1, "m", "length"), "eq", quantity(1, "m", "width")),
    (error) => error instanceof KernelError && error.code === "QUANTITY_SEMANTIC_INCOMPATIBLE"
  );
  assert.throws(
    () => normalizeQuantity(quantity(1, "m", "length", { absolute: undefined })),
    (error) => error instanceof KernelError && error.code === "QUANTITY_TOLERANCE_INVALID"
  );
  assert.throws(
    () => compareQuantities(quantity(1, "m"), "eq", quantity(1, "m"), { semanticPolicy: "" }),
    (error) => error instanceof KernelError && error.code === "QUANTITY_COMPARISON_OPTIONS_INVALID"
  );
  assert.throws(
    () => normalizeQuantity({
      ...quantity(1, "m"),
      provenance: { kind: "declared", evidence: [" evidence-id "] }
    }),
    (error) => error instanceof KernelError && error.code === "QUANTITY_PROVENANCE_INVALID"
  );
  assert.throws(
    () => normalizeQuantity(quantity(1, "m", " length ")),
    (error) => error instanceof KernelError && error.code === "QUANTITY_SEMANTIC_INVALID"
  );
  assert.throws(
    () => normalizeQuantity(quantity(Number.MIN_VALUE, "cm")),
    (error) => error instanceof KernelError && error.code === "QUANTITY_CONVERSION_UNDERFLOW"
  );
  assert.throws(
    () => convertQuantity(quantity(1, "ym^12"), "Ym^12"),
    (error) => error instanceof KernelError && error.code === "QUANTITY_CONVERSION_UNDERFLOW"
  );
  assert.throws(
    () => compareQuantities(
      quantity(0.5, "m", "length", { relative: Number.MIN_VALUE }),
      "eq",
      quantity(0.5, "m", "length", { absolute: 0 })
    ),
    (error) => error instanceof KernelError && error.code === "QUANTITY_COMPARISON_UNDERFLOW"
  );
});

test("candidate identity uses normalized quantity units", () => {
  const candidate = (measurement) => ({
    domain: "single-candidate",
    nodes: [{ ref: REF, attrs: { measurement } }],
    edges: []
  });
  const options = { policy: { structuralNodeAttributes: ["measurement"] } };

  const centimeters = canonicalizeCandidate(candidate(quantity(100, "cm")), options);
  const meters = canonicalizeCandidate(candidate(quantity(1, "m")), options);

  assert.equal(centimeters.candidateId, meters.candidateId);
  assert.deepEqual(centimeters.candidate.nodes[0].attrs.measurement, meters.candidate.nodes[0].attrs.measurement);
});
