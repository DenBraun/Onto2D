import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  PREDICATE_NUMERIC_BINDING_LIMITS,
  PREDICATE_NUMERIC_BINDER_VERSION,
  QUANTITY_COMPARISON_POLICY_VERSION,
  bindPredicateNumericPolicy,
  compilePredicate
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

function predicate(expr) {
  return {
    id: "numeric-binding-fixture",
    phase: "formation",
    monotoneViolation: false,
    referencesDepth: "below",
    expr,
    explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
    claimRefs: []
  };
}

function precision(overrides = {}) {
  return {
    id: "fixture-precision",
    decimalPlaces: 6,
    rounding: "half-even",
    summation: "exact-decimal",
    ...overrides
  };
}

function numericPlan() {
  return compilePredicate(predicate({
    op: "all",
    args: [
      {
        op: "compare",
        left: {
          kind: "add",
          terms: [
            { kind: "constant", value: 0.1 },
            {
              kind: "multiply",
              factors: [
                { kind: "constant", value: 0.2 },
                { kind: "sum", attribute: "flux", set: { kind: "edges" } }
              ]
            }
          ]
        },
        comparator: "eq",
        right: { kind: "constant", value: 0.3 }
      },
      {
        op: "balance",
        attribute: "flux",
        over: { kind: "edges" },
        tolerance: quantity(0.001, "1", "flux")
      },
      {
        op: "stableUnder",
        perturbation: "noise",
        threshold: 0.95,
        predicate: {
          op: "compare",
          left: { kind: "constant", value: quantity(1, "m", "length") },
          comparator: "lte",
          right: { kind: "constant", value: quantity(100, "cm", "length") }
        }
      }
    ]
  }), {
    environment: {
      attributes: { flux: { kind: "number" } },
      perturbations: ["noise"]
    }
  });
}

test("predicate numeric binding attaches explicit policy references to every numeric operation", () => {
  const plan = numericPlan();
  const binding = bindPredicateNumericPolicy(plan, precision());

  assert.equal(PREDICATE_NUMERIC_BINDER_VERSION, "predicate-numeric-binding-v1");
  assert.deepEqual(PREDICATE_NUMERIC_BINDING_LIMITS, { maxOperations: 10_000 });
  assert.ok(Object.isFrozen(PREDICATE_NUMERIC_BINDING_LIMITS));
  assert.equal(QUANTITY_COMPARISON_POLICY_VERSION, "declared-max-tolerance-v1");
  assert.equal(binding.predicatePlanHash, plan.planHash);
  assert.equal(binding.expressionHash, plan.expressionHash);
  assert.equal(binding.numericPolicy.arithmetic, "decimal-rational-v1");
  assert.equal(binding.numericPolicy.precision.summation, "exact-decimal");
  assert.equal(binding.numericPolicy.summation.termOrder, "canonical-selection-order-v1");
  assert.deepEqual(
    [...new Set(binding.operations.map((entry) => entry.operation))].sort(),
    [
      "balance",
      "numeric-compare",
      "quantity-compare",
      "stability-threshold",
      "value-add",
      "value-multiply",
      "value-sum"
    ]
  );
  assert.ok(binding.operations
    .filter((entry) => ["balance", "numeric-compare", "quantity-compare", "stability-threshold"].includes(entry.operation))
    .every((entry) => entry.policyRefs.includes("precision")));
  assert.ok(binding.operations
    .filter((entry) => ["value-add", "value-multiply", "value-sum"].includes(entry.operation))
    .every((entry) => !entry.policyRefs.includes("precision")));
  assert.match(binding.bindingHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(binding));
  assert.ok(Object.isFrozen(binding.numericPolicy));
  assert.ok(Object.isFrozen(binding.operations));
});

test("binding defaults are explicit and semantic-policy changes alter identity", () => {
  const plan = numericPlan();
  const required = bindPredicateNumericPolicy(plan, precision());
  const ignored = bindPredicateNumericPolicy(plan, precision(), { semanticPolicy: "ignore" });

  assert.equal(required.numericPolicy.quantityComparison.semanticPolicy, "require-equal");
  assert.equal(ignored.numericPolicy.quantityComparison.semanticPolicy, "ignore");
  assert.notEqual(required.bindingHash, ignored.bindingHash);
  assert.deepEqual(bindPredicateNumericPolicy(plan, precision()), required);
});

test("non-numeric predicate plans bind the policy without inventing operations", () => {
  const plan = compilePredicate(predicate({ op: "connected" }));
  const binding = bindPredicateNumericPolicy(plan, precision());

  assert.deepEqual(binding.operations, []);
  assert.match(binding.bindingHash, /^sha256:[a-f0-9]{64}$/);
});

test("binding rejects altered plans and invalid policy options", () => {
  const plan = numericPlan();
  const alteredExpression = JSON.parse(JSON.stringify(plan));
  alteredExpression.expression.args[0] = { op: "connected" };
  assert.throws(
    () => bindPredicateNumericPolicy(alteredExpression, precision()),
    (error) => error instanceof KernelError && error.code === "NUMERIC_BINDING_PLAN_HASH_MISMATCH"
  );

  const alteredMetadata = JSON.parse(JSON.stringify(plan));
  alteredMetadata.predicateId = "altered";
  assert.throws(
    () => bindPredicateNumericPolicy(alteredMetadata, precision()),
    (error) => error instanceof KernelError && error.code === "NUMERIC_BINDING_PLAN_HASH_MISMATCH"
  );
  const alteredAnalysisWitness = JSON.parse(JSON.stringify(plan));
  alteredAnalysisWitness.truthPersistence = { pass: "tampered", fail: "tampered" };
  alteredAnalysisWitness.partialDetectability = { pass: true, fail: true };
  alteredAnalysisWitness.statistics.nodes = 999_999;
  assert.throws(
    () => bindPredicateNumericPolicy(alteredAnalysisWitness, precision()),
    (error) => error instanceof KernelError && error.code === "NUMERIC_BINDING_PLAN_INVALID"
  );
  const alteredPruning = JSON.parse(JSON.stringify(plan));
  alteredPruning.pruning.eligibility = "static-proven";
  assert.throws(
    () => bindPredicateNumericPolicy(alteredPruning, precision()),
    (error) => error instanceof KernelError && error.code === "NUMERIC_BINDING_PLAN_INVALID"
  );
  assert.throws(
    () => bindPredicateNumericPolicy(plan, precision(), { semanticPolicy: "" }),
    (error) => error instanceof KernelError && error.code === "NUMERIC_BINDING_POLICY_INVALID"
  );
  assert.throws(
    () => bindPredicateNumericPolicy(plan, precision(), { unknown: true }),
    TypeError
  );
  assert.throws(
    () => bindPredicateNumericPolicy(plan, precision({ decimalPlaces: -1 })),
    (error) => error instanceof KernelError && error.code === "DECIMAL_POLICY_INVALID"
  );
});
