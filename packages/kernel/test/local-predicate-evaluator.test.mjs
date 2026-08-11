import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  LOCAL_PREDICATE_EVALUATION_LIMITS,
  bindPredicateNumericPolicy,
  canonicalClone,
  compilePredicate,
  evaluateLocalPredicatePlan,
  hashCanonical
} from "../src/index.js";

function quantity(value, unit, semantic, tolerance = { absolute: 0 }) {
  return {
    value,
    unit,
    tolerance,
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function precision(overrides = {}) {
  return {
    id: "local-evaluator-precision-v1",
    decimalPlaces: 6,
    rounding: "half-even",
    summation: "exact-decimal",
    ...overrides
  };
}

function plan(expression, environment = {}) {
  return compilePredicate({
    id: "local-evaluator-fixture",
    phase: "formation",
    monotoneViolation: false,
    referencesDepth: "below",
    expr: expression,
    explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
    claimRefs: []
  }, { environment });
}

function candidate() {
  return {
    domain: "element-exact",
    nodes: [
      { ref: `sha256:${"a".repeat(64)}`, attrs: { active: true } },
      { ref: `sha256:${"b".repeat(64)}`, attrs: { active: false } },
      { ref: `sha256:${"c".repeat(64)}`, attrs: { active: true } }
    ],
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" }
    ]
  };
}

function options() {
  return {
    policy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: ["active"],
      structuralEdgeAttributes: []
    }
  };
}

test("local evaluation combines graph predicates with exact count arithmetic", () => {
  assert.deepEqual(LOCAL_PREDICATE_EVALUATION_LIMITS, {
    maxValueNodes: 10_000,
    maxSelectionWitnesses: 10_000
  });
  assert.ok(Object.isFrozen(LOCAL_PREDICATE_EVALUATION_LIMITS));
  const compiled = plan({
    op: "all",
    args: [
      { op: "connected" },
      {
        op: "compare",
        left: {
          kind: "add",
          terms: [
            {
              kind: "count",
              set: { kind: "nodes", selector: { kind: "where", attribute: "active", equals: true } }
            },
            {
              kind: "multiply",
              factors: [
                { kind: "constant", value: 2 },
                { kind: "count", set: { kind: "edges", roles: ["support"] } }
              ]
            }
          ]
        },
        comparator: "eq",
        right: { kind: "constant", value: 6 }
      }
    ]
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const evaluation = evaluateLocalPredicatePlan(compiled, binding, candidate(), options());

  assert.equal(evaluation.evaluator, "local-predicate-evaluator-v1");
  assert.equal(evaluation.numericBindingHash, binding.bindingHash);
  assert.equal(evaluation.outcome, "pass");
  const comparison = evaluation.witnesses.find((entry) => entry.operator === "compare");
  assert.equal(comparison.left.exact.canonical, "6");
  assert.equal(comparison.left.rounded.canonical, "6");
  assert.equal(comparison.comparison.kind, "number");
  assert.equal(comparison.comparison.relation, 0);
  assert.deepEqual(
    comparison.selections.map((entry) => [entry.setKind, entry.count]).sort(),
    [["edges", 2], ["nodes", 2]]
  );
  const { evaluationHash, ...basis } = evaluation;
  assert.equal(hashCanonical(HASH_DOMAINS.PREDICATE_LOCAL_EVALUATION, basis), evaluationHash);
  assert.ok(Object.isFrozen(evaluation));
  assert.ok(Object.isFrozen(evaluation.witnesses));

  const relabelled = candidate();
  relabelled.nodes.reverse();
  relabelled.edges = [
    { from: 2, to: 1, role: "support" },
    { from: 1, to: 0, role: "support" }
  ];
  const replay = evaluateLocalPredicatePlan(compiled, binding, relabelled, options());
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);
});

test("dimensionless comparison rounds only at the bound result boundary", () => {
  const compiled = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        { kind: "constant", value: 0.052 },
        { kind: "constant", value: 0.052 }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: 0.1 }
  });
  const coarseBinding = bindPredicateNumericPolicy(compiled, precision({ decimalPlaces: 2 }));
  const fineBinding = bindPredicateNumericPolicy(compiled, precision({ decimalPlaces: 3 }));
  const coarse = evaluateLocalPredicatePlan(compiled, coarseBinding, candidate(), options());
  const fine = evaluateLocalPredicatePlan(compiled, fineBinding, candidate(), options());

  assert.equal(coarse.outcome, "pass");
  assert.equal(coarse.witnesses[0].left.exact.canonical, "0.104");
  assert.equal(coarse.witnesses[0].left.rounded.canonical, "0.1");
  assert.equal(fine.outcome, "fail");
  assert.equal(fine.witnesses[0].left.rounded.canonical, "0.104");
  assert.notEqual(coarse.evaluationHash, fine.evaluationHash);

  for (const [comparator, expected] of Object.entries({
    eq: false,
    ne: true,
    lt: true,
    lte: true,
    gt: false,
    gte: false
  })) {
    const orderedPlan = plan({
      op: "compare",
      left: { kind: "constant", value: 1 },
      comparator,
      right: { kind: "constant", value: 2 }
    });
    const orderedBinding = bindPredicateNumericPolicy(orderedPlan, precision());
    const ordered = evaluateLocalPredicatePlan(
      orderedPlan,
      orderedBinding,
      candidate(),
      options()
    );
    assert.equal(ordered.outcome === "pass", expected, comparator);
  }
});

test("constant quantities use canonical units, bound rounding, semantics, and declared tolerances", () => {
  const compiled = plan({
    op: "compare",
    left: { kind: "constant", value: quantity(1, "m", "length", { absolute: 0.001 }) },
    comparator: "eq",
    right: { kind: "constant", value: quantity(100.05, "cm", "length") }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const evaluation = evaluateLocalPredicatePlan(compiled, binding, candidate(), options());
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.left.quantity.unit, "m");
  assert.equal(witness.right.quantity.unit, "m");
  assert.equal(witness.comparison.kind, "quantity");
  assert.equal(witness.comparison.equivalent, true);
  assert.equal(witness.comparison.effectiveTolerance, 0.001);
});

test("SI-equivalent direct quantities retain one exact decimal value before comparison", () => {
  const compiled = plan({
    op: "compare",
    left: { kind: "constant", value: quantity(0.1, "dm", "length") },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0.01, "m", "length") }
  });
  const binding = bindPredicateNumericPolicy(
    compiled,
    precision({ decimalPlaces: 18 })
  );
  const evaluation = evaluateLocalPredicatePlan(compiled, binding, candidate(), options());
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.left.exact.canonical, "0.01");
  assert.equal(witness.right.exact.canonical, "0.01");
  assert.equal(witness.comparison.difference, 0);
});

test("scalar constant equality is executable without inventing numeric operations", () => {
  const compiled = plan({
    op: "compare",
    left: { kind: "constant", value: "same" },
    comparator: "eq",
    right: { kind: "constant", value: "same" }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const evaluation = evaluateLocalPredicatePlan(compiled, binding, candidate(), options());

  assert.deepEqual(binding.operations, []);
  assert.equal(evaluation.outcome, "pass");
  assert.deepEqual(evaluation.witnesses[0].comparison, { kind: "scalar", equal: true });
});

test("unfrozen value sources, quantity arithmetic, and stale bindings are rejected", () => {
  const invariantPlan = plan({
    op: "compare",
    left: { kind: "invariant", name: "length" },
    comparator: "eq",
    right: { kind: "constant", value: quantity(1, "m", "length") }
  }, { invariants: { length: quantity(1, "m", "length") } });
  const invariantBinding = bindPredicateNumericPolicy(invariantPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(invariantPlan, invariantBinding, candidate(), options()),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "runtime-invariant-resolution-not-frozen"
      )
  );

  const quantityArithmeticPlan = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        { kind: "constant", value: quantity(1, "m", "length") },
        { kind: "constant", value: quantity(1, "m", "length") }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(2, "m", "length") }
  });
  const quantityBinding = bindPredicateNumericPolicy(quantityArithmeticPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(
      quantityArithmeticPlan,
      quantityBinding,
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "derived-quantity-tolerance-propagation-not-frozen"
      )
  );

  const cycleCountPlan = plan({
    op: "compare",
    left: { kind: "count", set: { kind: "cycle", roles: ["support"] } },
    comparator: "eq",
    right: { kind: "constant", value: 0 }
  });
  const cycleCountBinding = bindPredicateNumericPolicy(cycleCountPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(
      cycleCountPlan,
      cycleCountBinding,
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "cycle-set-selection-not-frozen"
      )
  );

  const implicitLiftPlan = plan({
    op: "compare",
    left: { kind: "constant", value: 1 },
    comparator: "eq",
    right: { kind: "constant", value: quantity(1, "1", "ratio") }
  });
  const implicitLiftBinding = bindPredicateNumericPolicy(implicitLiftPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(
      implicitLiftPlan,
      implicitLiftBinding,
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "implicit-number-quantity-lift-not-frozen"
      )
  );

  const wideTerms = () => Array.from(
    { length: 5_000 },
    () => ({ kind: "constant", value: 1 })
  );
  const resourcePlan = plan({
    op: "compare",
    left: { kind: "add", terms: wideTerms() },
    comparator: "eq",
    right: { kind: "add", terms: wideTerms() }
  });
  const resourceBinding = bindPredicateNumericPolicy(resourcePlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(
      resourcePlan,
      resourceBinding,
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_RESOURCE_LIMIT" &&
      error.details.valueNodes === 10_002
  );

  const numericPlan = plan({
    op: "compare",
    left: { kind: "constant", value: 1 },
    comparator: "eq",
    right: { kind: "constant", value: 1 }
  });
  const stale = canonicalClone(bindPredicateNumericPolicy(numericPlan, precision()));
  stale.bindingHash = `sha256:${"f".repeat(64)}`;
  assert.throws(
    () => evaluateLocalPredicatePlan(numericPlan, stale, candidate(), options()),
    (error) => error instanceof KernelError &&
      error.code === "LOCAL_PREDICATE_NUMERIC_BINDING_MISMATCH"
  );
});
