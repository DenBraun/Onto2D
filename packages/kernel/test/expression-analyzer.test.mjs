import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelValidationError,
  analyzeValueExpression,
  loadKernelPackage
} from "../src/index.js";

function quantity(value, unit, semantic) {
  return {
    value,
    unit,
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function primitive(sourceId, invariants = {}) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [],
    invariants,
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function functionalPackage(expression, resultUnit = "1") {
  return {
    schemaVersion: "1",
    id: "expression-fixture",
    version: "1.0.0",
    primitives: [primitive("base", { length: quantity(1, "m", "length") })],
    functionals: [{
      id: "score",
      expr: expression,
      coefficients: { offset: quantity(10, "cm", "length") },
      sensitivityCoefficients: [],
      result: {
        id: "score-result",
        unit: resultUnit,
        semantic: "score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "Expression fixture.",
      claimRefs: []
    }]
  };
}

test("value-expression analysis infers compatible additive dimensions and dependencies", () => {
  const analysis = analyzeValueExpression({
    kind: "add",
    terms: [
      { kind: "coefficient", name: "offset" },
      { kind: "invariant", name: "length" }
    ]
  }, {
    environment: {
      coefficients: { offset: quantity(100, "cm", "length") },
      invariants: { length: quantity(1, "m", "length") }
    }
  });

  assert.equal(analysis.analyzer, "typed-value-expression-v1");
  assert.equal(analysis.result.kind, "quantity");
  assert.equal(analysis.result.unit, "m");
  assert.deepEqual(analysis.requirements.coefficients, ["offset"]);
  assert.deepEqual(analysis.requirements.invariants, ["length"]);
  assert.match(analysis.expressionHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(analysis.analysisHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(analysis));
});

test("multiplication composes dimensions into canonical base units", () => {
  const analysis = analyzeValueExpression({
    kind: "multiply",
    resultSemantic: "work energy",
    factors: [
      { kind: "constant", value: quantity(2, "N", "force") },
      { kind: "constant", value: quantity(3, "m", "length") }
    ]
  });

  assert.equal(analysis.result.kind, "quantity");
  assert.equal(analysis.result.unit, "kg*m^2*s^-2");
  assert.equal(analysis.result.semantic, "work energy");
  assert.equal(analysis.expression.resultSemantic, "work energy");
  assert.equal(analysis.result.dimensionSignature, "1:2:-2:0:0:0:0");

  assert.throws(
    () => analyzeValueExpression({
      kind: "multiply",
      resultSemantic: "renamed length",
      factors: [
        { kind: "constant", value: 2 },
        { kind: "constant", value: quantity(3, "m", "length") }
      ]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "EXPRESSION_PRODUCT_SEMANTIC_UNEXPECTED"
      )
  );
});

test("selectors normalize role sets and expose inferred attribute requirements", () => {
  const analysis = analyzeValueExpression({
    kind: "add",
    terms: [
      {
        kind: "count",
        set: { kind: "edges", roles: ["support", "bridge"] }
      },
      {
        kind: "count",
        set: {
          kind: "nodes",
          selector: { kind: "where", attribute: "active", equals: true }
        }
      }
    ]
  });

  assert.deepEqual(analysis.requirements.roles, ["bridge", "support"]);
  assert.deepEqual(analysis.requirements.attributes, ["active"]);
  assert.equal(analysis.symbols.attributes.active.kind, "boolean");
});

test("analysis hash is independent of environment record and commutative operand order", () => {
  const first = analyzeValueExpression({
    kind: "add",
    terms: [{ kind: "invariant", name: "a" }, { kind: "invariant", name: "b" }]
  }, {
    environment: {
      invariants: {
        a: quantity(1, "m", "length"),
        b: quantity(2, "cm", "length")
      },
      coefficients: { unused: quantity(1, "kg", "mass") }
    }
  });
  const second = analyzeValueExpression({
    kind: "add",
    terms: [{ kind: "invariant", name: "b" }, { kind: "invariant", name: "a" }]
  }, {
    environment: {
      coefficients: {},
      invariants: {
        b: quantity(20, "mm", "length"),
        a: quantity(4, "m", "length")
      }
    }
  });

  assert.equal(first.expressionHash, second.expressionHash);
  assert.equal(first.analysisHash, second.analysisHash);
});

test("analysis rejects undeclared symbols and incompatible addition", () => {
  assert.throws(
    () => analyzeValueExpression({ kind: "coefficient", name: "missing" }),
    (error) => error instanceof KernelValidationError &&
      error.code === "EXPRESSION_ANALYSIS_FAILED" &&
      error.issues.some((issue) => issue.code === "EXPRESSION_SYMBOL_UNDECLARED")
  );

  assert.throws(
    () => analyzeValueExpression({
      kind: "add",
      terms: [
        { kind: "constant", value: quantity(1, "m", "length") },
        { kind: "constant", value: quantity(1, "kg", "mass") }
      ]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_ADD_DIMENSION_MISMATCH")
  );

  assert.throws(
    () => analyzeValueExpression({ kind: "constant", value: 1, unexpected: true }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_FIELD_UNKNOWN")
  );

  assert.throws(
    () => analyzeValueExpression({
      kind: "add",
      terms: [{ kind: "constant", value: 1 }, { kind: "constant", value: 2 }]
    }, { limits: { maxNodes: 2 } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_NODE_LIMIT")
  );

  assert.throws(
    () => analyzeValueExpression({ kind: "constant", value: 1 }, { environment: null }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_ENVIRONMENT_INVALID")
  );

  assert.throws(
    () => analyzeValueExpression({
      kind: "count",
      set: {
        kind: "nodes",
        selector: { kind: "where", attribute: "tag", equals: "too-long" }
      }
    }, { limits: { maxStringLength: 4 } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_STRING_LIMIT")
  );

  assert.throws(
    () => analyzeValueExpression({
      kind: "constant",
      value: quantity(1, "m", "semantic-too-long")
    }, { limits: { maxStringLength: 8 } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_STRING_LIMIT")
  );
});

test("profile aggregation is explicit and limited to numeric invariant types", () => {
  const number = analyzeValueExpression({
    kind: "invariant",
    name: "score",
    profileAggregation: "arithmetic-mean-conservative-v1"
  }, { environment: { invariants: { score: { kind: "number" } } } });
  const measured = analyzeValueExpression({
    kind: "invariant",
    name: "length",
    profileAggregation: "arithmetic-mean-conservative-v1"
  }, { environment: { invariants: { length: quantity(1, "m", "length") } } });

  assert.equal(number.result.kind, "number");
  assert.equal(measured.result.kind, "quantity");
  assert.equal(
    number.expression.profileAggregation,
    "arithmetic-mean-conservative-v1"
  );
  assert.notEqual(
    number.expressionHash,
    analyzeValueExpression(
      { kind: "invariant", name: "score" },
      { environment: { invariants: { score: { kind: "number" } } } }
    ).expressionHash
  );

  assert.throws(
    () => analyzeValueExpression({
      kind: "invariant",
      name: "label",
      profileAggregation: "arithmetic-mean-conservative-v1"
    }, { environment: { invariants: { label: { kind: "string" } } } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "EXPRESSION_PROFILE_AGGREGATION_TYPE_INVALID"
      )
  );
  assert.throws(
    () => analyzeValueExpression({
      kind: "invariant",
      name: "score",
      profileAggregation: "mean-v0"
    }, { environment: { invariants: { score: { kind: "number" } } } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "EXPRESSION_PROFILE_AGGREGATION_POLICY_INVALID"
      )
  );
});

test("package loading normalizes analyzed expressions and verifies functional result units", () => {
  const source = functionalPackage({
    kind: "add",
    terms: [
      { kind: "invariant", name: "length" },
      { kind: "coefficient", name: "offset" }
    ]
  }, "cm");
  const loaded = loadKernelPackage(source);
  assert.equal(loaded.normalized.functionals[0].result.unit, "m");

  const incompatible = functionalPackage({ kind: "constant", value: 1 }, "m");
  assert.throws(
    () => loadKernelPackage(incompatible),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "FUNCTIONAL_RESULT_UNIT_INCOMPATIBLE")
  );

  const nonNumeric = functionalPackage({ kind: "constant", value: "score" }, "1");
  assert.throws(
    () => loadKernelPackage(nonNumeric),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "FUNCTIONAL_RESULT_NON_NUMERIC")
  );
});

test("package loading verifies invariant-window expression dimensions", () => {
  const source = functionalPackage({ kind: "constant", value: 0 }, "1");
  source.cohortRules = [{
    id: "length-window",
    kind: "invariant-window",
    value: { kind: "invariant", name: "length" },
    origin: quantity(0, "cm", "length origin"),
    width: quantity(10, "cm", "length width"),
    bins: "lower-closed-upper-open"
  }];
  const loaded = loadKernelPackage(source);
  assert.equal(loaded.normalized.cohortRules[0].origin.unit, "m");

  source.cohortRules[0].origin = quantity(0, "kg", "mass origin");
  source.cohortRules[0].width = quantity(1, "kg", "mass width");
  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "COHORT_WINDOW_VALUE_UNIT_INCOMPATIBLE")
  );
});

test("package loading rejects conflicting invariant symbol declarations", () => {
  const source = functionalPackage({ kind: "invariant", name: "length" }, "m");
  source.primitives.push(primitive("conflict", { length: quantity(1, "kg", "mass") }));

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EXPRESSION_INVARIANT_TYPE_CONFLICT")
  );
});
