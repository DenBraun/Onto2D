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
import { localPredicateAttributeRequirements } from "../src/local-predicate-evaluator.js";

function quantity(value, unit, semantic, tolerance = { absolute: 0 }, evidence = []) {
  return {
    value,
    unit,
    tolerance,
    semantic,
    provenance: { kind: "declared", evidence }
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

function substructurePolicy(overrides = {}) {
  return {
    id: "local-substructure-v1",
    remove: "nodes-and-edges",
    includeDisconnected: false,
    includeEmpty: false,
    retainIsolatedNodes: true,
    ...overrides
  };
}

function triangleCandidate() {
  return {
    domain: "element-exact",
    nodes: ["a", "b", "c"].map((value) => ({
      ref: `sha256:${value.repeat(64)}`
    })),
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" },
      { from: 2, to: 0, role: "support" }
    ]
  };
}

test("local evaluation combines graph predicates with exact count arithmetic", () => {
  assert.deepEqual(LOCAL_PREDICATE_EVALUATION_LIMITS, {
    maxValueNodes: 10_000,
    maxSelectionWitnesses: 10_000,
    maxSelectedValues: 5_000,
    maxSubstructureRemovals: 10_000
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

  assert.equal(evaluation.evaluator, "local-predicate-evaluator-v19");
  assert.equal(evaluation.numericBindingHash, binding.bindingHash);
  assert.equal(evaluation.outcome, "pass");
  const comparison = evaluation.witnesses.find((entry) => entry.operator === "compare");
  assert.equal(comparison.left.unrounded.canonical, "6");
  assert.equal(comparison.left.exact, true);
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
  assert.equal(coarse.witnesses[0].left.unrounded.canonical, "0.104");
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

test("numeric structural attributes sum exactly in canonical selection order", () => {
  const compiled = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        {
          kind: "sum",
          attribute: "score",
          set: {
            kind: "nodes",
            selector: { kind: "where", attribute: "active", equals: true }
          }
        },
        {
          kind: "sum",
          attribute: "weight",
          set: { kind: "edges", roles: ["support"] }
        }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: 4.4 }
  }, {
    attributes: {
      score: { kind: "number" },
      weight: { kind: "number" }
    }
  });
  assert.deepEqual(localPredicateAttributeRequirements(compiled), {
    nodeAttributes: ["active", "score"],
    edgeAttributes: ["weight"]
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const attributed = candidate();
  attributed.nodes[0].attrs.score = 0.1;
  attributed.nodes[1].attrs.score = 0.2;
  attributed.nodes[2].attrs.score = 0.3;
  attributed.edges[0].attrs = { weight: 1.25 };
  attributed.edges[1].attrs = { weight: 2.75 };
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["active", "score"],
      structuralEdgeAttributes: ["weight"]
    }
  };
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    attributed,
    attributedOptions
  );
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.left.unrounded.canonical, "4.4");
  assert.equal(witness.left.exact, true);
  assert.deepEqual(
    witness.selections.map((selection) => ({
      attribute: selection.attribute,
      count: selection.count,
      summation: selection.summation,
      accumulationExact: selection.accumulationExact
    })),
    [
      {
        attribute: "score",
        count: 2,
        summation: "exact-decimal",
        accumulationExact: true
      },
      {
        attribute: "weight",
        count: 2,
        summation: "exact-decimal",
        accumulationExact: true
      }
    ]
  );

  const relabelled = canonicalClone(attributed);
  relabelled.nodes.reverse();
  relabelled.edges = [
    { from: 2, to: 1, role: "support", attrs: { weight: 1.25 } },
    { from: 1, to: 0, role: "support", attrs: { weight: 2.75 } }
  ];
  const replay = evaluateLocalPredicatePlan(
    compiled,
    binding,
    relabelled,
    attributedOptions
  );
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);

  const compensatedBinding = bindPredicateNumericPolicy(
    compiled,
    precision({ summation: "compensated-binary64" })
  );
  const compensated = evaluateLocalPredicatePlan(
    compiled,
    compensatedBinding,
    attributed,
    attributedOptions
  );
  assert.equal(compensated.witnesses[0].left.exact, false);
  assert.ok(
    compensated.witnesses[0].selections.every((selection) =>
      selection.summation === "compensated-binary64" &&
      selection.accumulationExact === false
    )
  );
});

test("attribute sums reject incomplete values and expose compensated accumulation", () => {
  const compiled = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "score",
      set: { kind: "nodes", selector: { kind: "all" } }
    },
    comparator: "eq",
    right: { kind: "constant", value: 0 }
  }, { attributes: { score: { kind: "number" } } });
  const exactBinding = bindPredicateNumericPolicy(compiled, precision());
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["score"]
    }
  };
  const missing = candidate();
  missing.nodes[0].attrs = { score: 1 };
  missing.nodes[1].attrs = { score: 2 };
  missing.nodes[2].attrs = {};
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, exactBinding, missing, attributedOptions),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_ATTRIBUTE_VALUE_UNAVAILABLE" &&
      error.details.missingIndexes.length === 1
  );

  const invalid = candidate();
  invalid.nodes.forEach((node) => { node.attrs = { score: 1 }; });
  invalid.nodes[1].attrs.score = true;
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, exactBinding, invalid, attributedOptions),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_ATTRIBUTE_VALUE_INVALID" &&
      error.details.invalidIndexes.length === 1
  );

  const compensatedBinding = bindPredicateNumericPolicy(
    compiled,
    precision({ summation: "compensated-binary64" })
  );
  const compensatedCandidate = candidate();
  compensatedCandidate.nodes[0].attrs = { score: 10_000_000_000_000_000 };
  compensatedCandidate.nodes[1].attrs = { score: 1 };
  compensatedCandidate.nodes[2].attrs = { score: -10_000_000_000_000_000 };
  const compensated = evaluateLocalPredicatePlan(
    compiled,
    compensatedBinding,
    compensatedCandidate,
    attributedOptions
  );
  assert.equal(compensated.outcome, "fail");
  assert.equal(compensated.witnesses[0].left.unrounded.canonical, "1");
  assert.equal(compensated.witnesses[0].left.exact, false);
  assert.equal(compensated.witnesses[0].selections[0].accumulationExact, false);

  const oversizedPlan = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "weight",
      set: { kind: "edges", roles: ["support"] }
    },
    comparator: "eq",
    right: { kind: "constant", value: 0 }
  }, { attributes: { weight: { kind: "number" } } });
  const oversizedBinding = bindPredicateNumericPolicy(oversizedPlan, precision());
  const oversized = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"d".repeat(64)}` }],
    edges: Array.from(
      { length: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues + 1 },
      () => ({ from: 0, to: 0, role: "support", attrs: { weight: 1 } })
    )
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(oversizedPlan, oversizedBinding, oversized, {
      policy: {
        connected: true,
        allowParallelEdges: true,
        allowSelfLoops: true,
        connectivityProjection: "undirected",
        structuralNodeAttributes: [],
        structuralEdgeAttributes: ["weight"]
      },
      limits: { maxNodes: 1, maxEdges: 5_001, maxSearchStates: 10 }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SELECTED_VALUE_LIMIT" &&
      error.details.selectedValues === 5_001
  );
});

test("quantity structural attributes sum with conservative tolerance and provenance", () => {
  const compiled = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "distance",
      set: { kind: "nodes", selector: { kind: "all" } }
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(3.05, "m", "length") }
  }, {
    attributes: {
      distance: { kind: "quantity", unit: "m", semantic: "length" }
    }
  });
  const exactBinding = bindPredicateNumericPolicy(compiled, precision());
  const attributed = candidate();
  attributed.nodes[0].attrs.distance = quantity(
    100,
    "cm",
    "length",
    { absolute: 10 },
    ["evidence-b"]
  );
  attributed.nodes[1].attrs.distance = quantity(
    2,
    "m",
    "length",
    { relative: 5e-18 },
    ["evidence-a"]
  );
  attributed.nodes[2].attrs.distance = quantity(0, "m", "length");
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["active", "distance"]
    }
  };
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    exactBinding,
    attributed,
    attributedOptions
  );
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.left.unrounded.canonical, "3");
  assert.equal(witness.left.exact, true);
  assert.equal(witness.left.quantity.unit, "m");
  assert.equal(witness.left.quantity.semantic, "length");
  assert.equal(witness.left.quantity.tolerance.absolute, 0.10000000000000002);
  assert.deepEqual(witness.left.quantity.provenance, {
    kind: "computed",
    method: "local-quantity-attribute-sum-v1",
    evidence: ["evidence-a", "evidence-b"]
  });
  assert.deepEqual(witness.selections[0], {
    expressionPath: "$.left",
    setKind: "nodes",
    count: 3,
    nodeIndexes: [0, 1, 2],
    attribute: "distance",
    valueKind: "quantity",
    summation: "exact-decimal",
    accumulationExact: true,
    quantityUnit: "m",
    quantitySemantic: "length",
    toleranceAggregation: "sum-effective-absolute-bounds-v1"
  });

  const compensatedBinding = bindPredicateNumericPolicy(
    compiled,
    precision({ summation: "compensated-binary64" })
  );
  const compensated = evaluateLocalPredicatePlan(
    compiled,
    compensatedBinding,
    attributed,
    attributedOptions
  );
  assert.equal(compensated.witnesses[0].left.exact, false);
  assert.equal(compensated.witnesses[0].selections[0].accumulationExact, false);

  const subnormalTolerance = canonicalClone(attributed);
  subnormalTolerance.nodes[0].attrs.distance = quantity(
    0.5,
    "m",
    "length",
    { relative: Number.MIN_VALUE }
  );
  subnormalTolerance.nodes[1].attrs.distance = quantity(0, "m", "length");
  subnormalTolerance.nodes[2].attrs.distance = quantity(0, "m", "length");
  const subnormal = evaluateLocalPredicatePlan(
    compiled,
    exactBinding,
    subnormalTolerance,
    attributedOptions
  );
  assert.equal(subnormal.witnesses[0].left.quantity.tolerance.absolute, Number.MIN_VALUE);

  const overflowingTolerance = canonicalClone(attributed);
  overflowingTolerance.nodes[0].attrs.distance = quantity(
    0,
    "m",
    "length",
    { absolute: Number.MAX_VALUE }
  );
  overflowingTolerance.nodes[1].attrs.distance = quantity(
    0,
    "m",
    "length",
    { absolute: Number.MAX_VALUE }
  );
  overflowingTolerance.nodes[2].attrs.distance = quantity(0, "m", "length");
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      exactBinding,
      overflowingTolerance,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_QUANTITY_TOLERANCE_OVERFLOW"
  );

  const relabelled = canonicalClone(attributed);
  relabelled.nodes.reverse();
  relabelled.edges = [
    { from: 2, to: 1, role: "support" },
    { from: 1, to: 0, role: "support" }
  ];
  const replay = evaluateLocalPredicatePlan(
    compiled,
    exactBinding,
    relabelled,
    attributedOptions
  );
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);

  const emptyPlan = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "distance",
      set: { kind: "nodes", selector: { kind: "canonical-index", index: 9 } }
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0, "m", "length") }
  }, {
    attributes: {
      distance: { kind: "quantity", unit: "m", semantic: "length" }
    }
  });
  const empty = evaluateLocalPredicatePlan(
    emptyPlan,
    bindPredicateNumericPolicy(emptyPlan, precision()),
    attributed,
    attributedOptions
  );
  assert.equal(empty.outcome, "pass");
  assert.equal(empty.witnesses[0].left.quantity.value, 0);
  assert.equal(empty.witnesses[0].left.quantity.tolerance.absolute, 0);
  assert.deepEqual(empty.witnesses[0].left.quantity.provenance.evidence, []);

  const edgePlan = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "span",
      set: { kind: "edges", roles: ["support"] }
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0.1, "m", "length") }
  }, {
    attributes: {
      span: { kind: "quantity", unit: "m", semantic: "length" }
    }
  });
  const edgeCandidate = candidate();
  edgeCandidate.edges.forEach((edge) => {
    edge.attrs = { span: quantity(5.2, "cm", "length") };
  });
  const edgeEvaluation = evaluateLocalPredicatePlan(
    edgePlan,
    bindPredicateNumericPolicy(edgePlan, precision({ decimalPlaces: 1 })),
    edgeCandidate,
    {
      policy: {
        ...options().policy,
        structuralEdgeAttributes: ["span"]
      }
    }
  );
  assert.equal(edgeEvaluation.outcome, "pass");
  assert.equal(edgeEvaluation.witnesses[0].left.unrounded.canonical, "0.104");
  assert.equal(edgeEvaluation.witnesses[0].left.rounded.canonical, "0.1");
  assert.equal(edgeEvaluation.witnesses[0].selections[0].setKind, "edges");
  assert.deepEqual(edgeEvaluation.witnesses[0].selections[0].edgeIndexes, [0, 1]);

  const unitMismatch = canonicalClone(attributed);
  unitMismatch.nodes[0].attrs.distance = quantity(1, "s", "duration");
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      exactBinding,
      unitMismatch,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_QUANTITY_UNIT_MISMATCH"
  );

  const semanticMismatch = canonicalClone(attributed);
  semanticMismatch.nodes[0].attrs.distance = quantity(1, "m", "width");
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      exactBinding,
      semanticMismatch,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_QUANTITY_SEMANTIC_MISMATCH"
  );

  const invalid = canonicalClone(attributed);
  invalid.nodes[0].attrs.distance = 1;
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, exactBinding, invalid, attributedOptions),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_ATTRIBUTE_VALUE_INVALID"
  );
});

test("scalar balance uses the bound result boundary and threshold uncertainty", () => {
  const balance = (tolerance, over = { kind: "nodes", selector: { kind: "all" } }) =>
    plan({
      op: "balance",
      attribute: "flux",
      over,
      tolerance
    }, { attributes: { flux: { kind: "number" } } });
  const attributed = candidate();
  attributed.nodes[0].attrs.flux = 0.1;
  attributed.nodes[1].attrs.flux = 0.2;
  attributed.nodes[2].attrs.flux = -0.3012;
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["active", "flux"]
    }
  };
  const strictPlan = balance(quantity(0.001, "1", "flux", { absolute: 0 }));
  const strict = evaluateLocalPredicatePlan(
    strictPlan,
    bindPredicateNumericPolicy(strictPlan, precision({ decimalPlaces: 4 })),
    attributed,
    attributedOptions
  );
  const strictWitness = strict.witnesses[0];

  assert.equal(strict.outcome, "fail");
  assert.equal(strictWitness.operator, "balance");
  assert.equal(strictWitness.aggregate.kind, "number");
  assert.equal(strictWitness.aggregate.unrounded.canonical, "-0.0012");
  assert.equal(strictWitness.aggregate.rounded.canonical, "-0.0012");
  assert.equal(strictWitness.comparison.comparator, "lte");
  assert.equal(strictWitness.comparison.leftValue, 0.0012);
  assert.equal(strictWitness.comparison.rightValue, 0.001);
  assert.equal(strictWitness.comparison.effectiveTolerance, 0);
  assert.equal(strictWitness.selections[0].attribute, "flux");

  const relabelled = canonicalClone(attributed);
  relabelled.nodes.reverse();
  relabelled.edges = [
    { from: 2, to: 1, role: "support" },
    { from: 1, to: 0, role: "support" }
  ];
  const replay = evaluateLocalPredicatePlan(
    strictPlan,
    bindPredicateNumericPolicy(strictPlan, precision({ decimalPlaces: 4 })),
    relabelled,
    attributedOptions
  );
  assert.equal(replay.evaluationHash, strict.evaluationHash);

  const uncertainPlan = balance(quantity(0.001, "1", "flux", { absolute: 0.0003 }));
  const uncertain = evaluateLocalPredicatePlan(
    uncertainPlan,
    bindPredicateNumericPolicy(uncertainPlan, precision({ decimalPlaces: 4 })),
    attributed,
    attributedOptions
  );
  assert.equal(uncertain.outcome, "pass");
  assert.equal(uncertain.witnesses[0].comparison.effectiveTolerance, 0.0003);

  const roundedPlan = balance(quantity(0.001, "1", "flux", { absolute: 0 }));
  attributed.nodes[2].attrs.flux = -0.29876;
  const rounded = evaluateLocalPredicatePlan(
    roundedPlan,
    bindPredicateNumericPolicy(roundedPlan, precision({ decimalPlaces: 3 })),
    attributed,
    attributedOptions
  );
  assert.equal(rounded.witnesses[0].aggregate.unrounded.canonical, "0.00124");
  assert.equal(rounded.witnesses[0].aggregate.rounded.canonical, "0.001");
  assert.equal(rounded.outcome, "pass");

  attributed.nodes[0].attrs.flux = 10_000_000_000_000_000;
  attributed.nodes[1].attrs.flux = 1;
  attributed.nodes[2].attrs.flux = -10_000_000_000_000_000;
  const compensatedPlan = balance(quantity(1, "1", "flux", { absolute: 0 }));
  const compensated = evaluateLocalPredicatePlan(
    compensatedPlan,
    bindPredicateNumericPolicy(
      compensatedPlan,
      precision({ summation: "compensated-binary64" })
    ),
    attributed,
    attributedOptions
  );
  assert.equal(compensated.outcome, "pass");
  assert.equal(compensated.witnesses[0].aggregate.exact, false);
  assert.equal(compensated.witnesses[0].selections[0].accumulationExact, false);

  const emptyPlan = balance(
    quantity(0, "1", "flux", { absolute: 0 }),
    { kind: "edges", roles: ["missing"] }
  );
  const empty = evaluateLocalPredicatePlan(
    emptyPlan,
    bindPredicateNumericPolicy(emptyPlan, precision()),
    candidate(),
    {
      policy: {
        ...options().policy,
        structuralEdgeAttributes: ["flux"]
      }
    }
  );
  assert.equal(empty.outcome, "pass");
  assert.equal(empty.witnesses[0].aggregate.unrounded.canonical, "0");
  assert.equal(empty.witnesses[0].selections[0].count, 0);

  assert.throws(
    () => evaluateLocalPredicatePlan(
      strictPlan,
      bindPredicateNumericPolicy(strictPlan, precision()),
      candidate(),
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_ATTRIBUTE_VALUE_UNAVAILABLE"
  );

  const cyclePlan = balance(
    quantity(0, "1", "flux", { absolute: 0 }),
    { kind: "cycle", roles: ["support"] }
  );
  const emptyCycle = evaluateLocalPredicatePlan(
    cyclePlan,
    bindPredicateNumericPolicy(cyclePlan, precision()),
    attributed,
    {
      policy: {
        ...attributedOptions.policy,
        structuralEdgeAttributes: ["flux"]
      }
    }
  );
  assert.equal(emptyCycle.outcome, "pass");
  assert.deepEqual(emptyCycle.witnesses[0].selections[0], {
    expressionPath: "$",
    setKind: "cycle",
    count: 0,
    edgeIndexes: [],
    roles: ["support"],
    cycleSelection: "directed-cycle-edge-union-v1",
    attribute: "flux",
    valueKind: "number",
    summation: "exact-decimal",
    accumulationExact: true
  });
});

test("cycle sets select the role-filtered union of directed cycle edges", () => {
  const cycleGraph = {
    domain: "element-exact",
    nodes: ["a", "b", "c", "d"].map((value) => ({
      ref: `sha256:${value.repeat(64)}`
    })),
    edges: [
      { from: 0, to: 1, role: "support", attrs: { flux: 1 } },
      { from: 1, to: 2, role: "support", attrs: { flux: 2 } },
      { from: 2, to: 0, role: "support", attrs: { flux: -3 } },
      { from: 2, to: 3, role: "support", attrs: { flux: 10 } },
      { from: 3, to: 2, role: "feedback", attrs: { flux: -10 } }
    ]
  };
  const cycleOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: [],
      structuralEdgeAttributes: ["flux"]
    }
  };
  const compiled = plan({
    op: "all",
    args: [
      {
        op: "compare",
        left: { kind: "count", set: { kind: "cycle", roles: ["support"] } },
        comparator: "eq",
        right: { kind: "constant", value: 3 }
      },
      {
        op: "compare",
        left: {
          kind: "sum",
          attribute: "flux",
          set: { kind: "cycle", roles: ["support"] }
        },
        comparator: "eq",
        right: { kind: "constant", value: 0 }
      },
      {
        op: "balance",
        attribute: "flux",
        over: { kind: "cycle", roles: ["support"] },
        tolerance: quantity(0, "1", "flux")
      }
    ]
  }, { attributes: { flux: { kind: "number" } } });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    cycleGraph,
    cycleOptions
  );

  assert.equal(evaluation.outcome, "pass");
  const selections = evaluation.witnesses.flatMap((entry) => entry.selections);
  assert.equal(selections.length, 3);
  assert.ok(selections.every((entry) =>
    entry.setKind === "cycle" &&
    entry.count === 3 &&
    entry.edgeIndexes.length === 3 &&
    entry.cycleSelection === "directed-cycle-edge-union-v1"
  ));

  const allRolesPlan = plan({
    op: "compare",
    left: { kind: "count", set: { kind: "cycle" } },
    comparator: "eq",
    right: { kind: "constant", value: 5 }
  });
  const allRoles = evaluateLocalPredicatePlan(
    allRolesPlan,
    bindPredicateNumericPolicy(allRolesPlan, precision()),
    cycleGraph,
    cycleOptions
  );
  assert.equal(allRoles.outcome, "pass");
  assert.equal(allRoles.witnesses[0].selections[0].count, 5);

  const quantityGraph = canonicalClone(cycleGraph);
  [1, 2, -3, 10, -10].forEach((value, index) => {
    quantityGraph.edges[index].attrs = {
      circulation: quantity(value, "m", "cycle-circulation")
    };
  });
  const quantityPlan = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "circulation",
      set: { kind: "cycle", roles: ["support"] }
    },
    comparator: "eq",
    right: {
      kind: "constant",
      value: quantity(0, "m", "cycle-circulation")
    }
  }, {
    attributes: {
      circulation: { kind: "quantity", unit: "m", semantic: "cycle-circulation" }
    }
  });
  const quantityEvaluation = evaluateLocalPredicatePlan(
    quantityPlan,
    bindPredicateNumericPolicy(quantityPlan, precision()),
    quantityGraph,
    {
      policy: {
        ...cycleOptions.policy,
        structuralEdgeAttributes: ["circulation"]
      }
    }
  );
  assert.equal(quantityEvaluation.outcome, "pass");
  assert.equal(quantityEvaluation.witnesses[0].selections[0].valueKind, "quantity");

  const relabelled = canonicalClone(cycleGraph);
  relabelled.nodes = [cycleGraph.nodes[3], cycleGraph.nodes[1], cycleGraph.nodes[0], cycleGraph.nodes[2]];
  const oldToNew = [2, 1, 3, 0];
  relabelled.edges = cycleGraph.edges.slice().reverse().map((edge) => ({
    ...edge,
    from: oldToNew[edge.from],
    to: oldToNew[edge.to]
  }));
  const replay = evaluateLocalPredicatePlan(compiled, binding, relabelled, cycleOptions);
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);
});

test("cycle-edge selection reconciles every directed three-node edge subset", () => {
  const edges = Array.from({ length: 3 }, (_, from) =>
    Array.from({ length: 3 }, (__, to) => ({ from, to, role: "support" }))
  ).flat();
  const compiled = plan({
    op: "compare",
    left: { kind: "count", set: { kind: "cycle", roles: ["support"] } },
    comparator: "gte",
    right: { kind: "constant", value: 0 }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const cycleOptions = {
    policy: {
      ...options().policy,
      connected: false,
      allowSelfLoops: true,
      structuralNodeAttributes: []
    }
  };

  for (let mask = 0; mask < 2 ** edges.length; mask += 1) {
    const selected = edges.filter((_, index) => (mask & (1 << index)) !== 0);
    const reachable = Array.from({ length: 3 }, () => Array(3).fill(false));
    selected.forEach((edge) => { reachable[edge.from][edge.to] = true; });
    for (let via = 0; via < 3; via += 1) {
      for (let from = 0; from < 3; from += 1) {
        for (let to = 0; to < 3; to += 1) {
          reachable[from][to] ||= reachable[from][via] && reachable[via][to];
        }
      }
    }
    const expected = selected.filter((edge) =>
      edge.from === edge.to || reachable[edge.to][edge.from]
    ).length;
    const evaluation = evaluateLocalPredicatePlan(
      compiled,
      binding,
      {
        domain: "element-exact",
        nodes: ["a", "b", "c"].map((value) => ({
          ref: `sha256:${value.repeat(64)}`
        })),
        edges: selected
      },
      cycleOptions
    );
    assert.equal(evaluation.outcome, "pass", `mask ${mask}`);
    assert.equal(evaluation.witnesses[0].selections[0].count, expected, `mask ${mask}`);
  }
});

test("Quantity balance aggregates source uncertainty and enforces semantic policy", () => {
  const expression = {
    op: "balance",
    attribute: "momentum",
    over: { kind: "nodes", selector: { kind: "all" } },
    tolerance: quantity(0.0006, "m", "momentum", { absolute: 0 })
  };
  const inferredPlan = plan(expression);
  const attributed = candidate();
  attributed.nodes[0].attrs.momentum = quantity(
    100,
    "cm",
    "momentum",
    { absolute: 0.02 },
    ["evidence-b"]
  );
  attributed.nodes[1].attrs.momentum = quantity(
    -1.001,
    "m",
    "momentum",
    { absolute: 0.0003 },
    ["evidence-a"]
  );
  attributed.nodes[2].attrs.momentum = quantity(0, "m", "momentum");
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["active", "momentum"]
    }
  };
  const evaluation = evaluateLocalPredicatePlan(
    inferredPlan,
    bindPredicateNumericPolicy(inferredPlan, precision({ decimalPlaces: 4 })),
    attributed,
    attributedOptions
  );
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.aggregate.kind, "quantity");
  assert.equal(witness.aggregate.unrounded.canonical, "-0.001");
  assert.equal(witness.aggregate.quantity.unit, "m");
  assert.equal(witness.aggregate.quantity.semantic, "momentum");
  assert.equal(witness.aggregate.quantity.tolerance.absolute, 0.0005);
  assert.deepEqual(witness.aggregate.quantity.provenance.evidence, [
    "evidence-a",
    "evidence-b"
  ]);
  assert.equal(witness.comparison.leftValue, 0.001);
  assert.equal(witness.comparison.rightValue, 0.0006);
  assert.equal(witness.comparison.effectiveTolerance, 0.0005);

  const explicitPlan = plan({
    ...expression,
    tolerance: quantity(0.0006, "m", "balance-window", { absolute: 0 })
  }, {
    attributes: {
      momentum: { kind: "quantity", unit: "m", semantic: "momentum" }
    }
  });
  assert.throws(
    () => evaluateLocalPredicatePlan(
      explicitPlan,
      bindPredicateNumericPolicy(explicitPlan, precision()),
      attributed,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "QUANTITY_SEMANTIC_INCOMPATIBLE"
  );
  const ignored = evaluateLocalPredicatePlan(
    explicitPlan,
    bindPredicateNumericPolicy(explicitPlan, precision(), { semanticPolicy: "ignore" }),
    attributed,
    attributedOptions
  );
  assert.equal(ignored.outcome, "pass");
  assert.equal(ignored.witnesses[0].comparison.semanticPolicy, "ignore");

  const wrongSemantic = structuredClone(attributed);
  wrongSemantic.nodes[0].attrs.momentum = quantity(1, "m", "velocity");
  assert.throws(
    () => evaluateLocalPredicatePlan(
      inferredPlan,
      bindPredicateNumericPolicy(inferredPlan, precision()),
      wrongSemantic,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_QUANTITY_SEMANTIC_MISMATCH"
  );

  const wrongUnit = structuredClone(attributed);
  wrongUnit.nodes[0].attrs.momentum = quantity(1, "s", "momentum");
  assert.throws(
    () => evaluateLocalPredicatePlan(
      inferredPlan,
      bindPredicateNumericPolicy(inferredPlan, precision()),
      wrongUnit,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_QUANTITY_UNIT_MISMATCH"
  );
});

test("derived quantity addition stays unrounded and propagates tolerance and exactness", () => {
  const sum = {
    kind: "sum",
    attribute: "distance",
    set: { kind: "nodes", selector: { kind: "canonical-index", index: 0 } }
  };
  const constant = {
    kind: "constant",
    value: quantity(0.052, "m", "length", { absolute: 0.001 }, ["evidence-b"])
  };
  const nestedSum = {
    kind: "add",
    terms: [
      sum,
      { kind: "constant", value: quantity(0, "m", "length") }
    ]
  };
  const expression = {
    op: "compare",
    left: { kind: "add", terms: [constant, nestedSum] },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0.1, "m", "length") }
  };
  const environment = {
    attributes: {
      distance: { kind: "quantity", unit: "m", semantic: "length" }
    }
  };
  const compiled = plan(expression, environment);
  const binding = bindPredicateNumericPolicy(
    compiled,
    precision({ decimalPlaces: 1 })
  );
  const attributed = candidate();
  attributed.nodes.forEach((node) => {
    node.attrs.distance = quantity(
      5.2,
      "cm",
      "length",
      { relative: 0.1 },
      ["evidence-a"]
    );
  });
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["active", "distance"]
    }
  };
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    attributed,
    attributedOptions
  );
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.left.unrounded.canonical, "0.104");
  assert.equal(witness.left.rounded.canonical, "0.1");
  assert.equal(witness.left.exact, true);
  assert.equal(witness.left.quantity.tolerance.absolute, 0.0062);
  assert.deepEqual(witness.left.quantity.provenance, {
    kind: "computed",
    method: "local-quantity-add-v1",
    evidence: ["evidence-a", "evidence-b"]
  });
  assert.equal(witness.selections.length, 1);
  assert.equal(witness.selections[0].attribute, "distance");

  const compensatedBinding = bindPredicateNumericPolicy(
    compiled,
    precision({ decimalPlaces: 1, summation: "compensated-binary64" })
  );
  const compensated = evaluateLocalPredicatePlan(
    compiled,
    compensatedBinding,
    attributed,
    attributedOptions
  );
  assert.equal(compensated.witnesses[0].left.exact, false);
  assert.equal(compensated.witnesses[0].selections[0].accumulationExact, false);

  const reordered = plan({
    ...expression,
    left: { kind: "add", terms: [nestedSum, constant] }
  }, environment);
  assert.equal(reordered.planHash, compiled.planHash);
  const replay = evaluateLocalPredicatePlan(
    reordered,
    bindPredicateNumericPolicy(reordered, precision({ decimalPlaces: 1 })),
    attributed,
    attributedOptions
  );
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);

  const cancellationPlan = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        {
          kind: "constant",
          value: quantity(-0.052, "m", "length", { absolute: 0.001 }, ["evidence-b"])
        },
        sum
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0, "m", "length") }
  }, environment);
  const cancellation = evaluateLocalPredicatePlan(
    cancellationPlan,
    bindPredicateNumericPolicy(cancellationPlan, precision({ decimalPlaces: 3 })),
    attributed,
    attributedOptions
  );
  assert.equal(cancellation.witnesses[0].left.unrounded.canonical, "0");
  assert.equal(cancellation.witnesses[0].left.quantity.tolerance.absolute, 0.0062);
  assert.deepEqual(
    cancellation.witnesses[0].left.quantity.provenance.evidence,
    ["evidence-a", "evidence-b"]
  );

  const semanticMismatch = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        { kind: "constant", value: quantity(1, "m", "length") },
        { kind: "constant", value: quantity(1, "m", "width") }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(2, "m", "length") }
  });
  assert.throws(
    () => evaluateLocalPredicatePlan(
      semanticMismatch,
      bindPredicateNumericPolicy(semanticMismatch, precision()),
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "quantity-add-unit-or-semantic-mismatch"
      )
  );

  const implicitLift = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        { kind: "constant", value: 1 },
        { kind: "constant", value: quantity(1, "1", "score") }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(2, "1", "score") }
  });
  assert.throws(
    () => evaluateLocalPredicatePlan(
      implicitLift,
      bindPredicateNumericPolicy(implicitLift, precision()),
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "implicit-number-quantity-lift-not-frozen"
      )
  );
});

test("derived quantity scaling preserves semantics and scales absolute tolerance", () => {
  const distanceSum = {
    kind: "sum",
    attribute: "distance",
    set: { kind: "nodes", selector: { kind: "canonical-index", index: 0 } }
  };
  const quantityOperand = {
    kind: "add",
    terms: [
      distanceSum,
      { kind: "constant", value: quantity(0, "m", "length") }
    ]
  };
  const nestedScale = {
    kind: "multiply",
    factors: [
      { kind: "constant", value: 1 },
      quantityOperand
    ]
  };
  const expression = {
    op: "compare",
    left: {
      kind: "multiply",
      factors: [
        { kind: "constant", value: -2 },
        nestedScale
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(-0.1, "m", "length") }
  };
  const environment = {
    attributes: {
      distance: { kind: "quantity", unit: "m", semantic: "length" }
    }
  };
  const compiled = plan(expression, environment);
  const binding = bindPredicateNumericPolicy(
    compiled,
    precision({ decimalPlaces: 1 })
  );
  const attributed = candidate();
  attributed.nodes.forEach((node) => {
    node.attrs.distance = quantity(
      5.2,
      "cm",
      "length",
      { relative: 0.1 },
      ["evidence-a"]
    );
  });
  const attributedOptions = {
    policy: {
      ...options().policy,
      structuralNodeAttributes: ["active", "distance"]
    }
  };
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    attributed,
    attributedOptions
  );
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.left.unrounded.canonical, "-0.104");
  assert.equal(witness.left.rounded.canonical, "-0.1");
  assert.equal(witness.left.exact, true);
  assert.equal(witness.left.quantity.unit, "m");
  assert.equal(witness.left.quantity.semantic, "length");
  assert.equal(witness.left.quantity.tolerance.absolute, 0.0104);
  assert.deepEqual(witness.left.quantity.provenance, {
    kind: "computed",
    method: "local-quantity-scale-v1",
    evidence: ["evidence-a"]
  });
  assert.equal(witness.selections.length, 1);
  assert.equal(witness.selections[0].attribute, "distance");

  const reordered = plan({
    ...expression,
    left: {
      kind: "multiply",
      factors: [nestedScale, { kind: "constant", value: -2 }]
    }
  }, environment);
  assert.equal(reordered.planHash, compiled.planHash);
  const replay = evaluateLocalPredicatePlan(
    reordered,
    bindPredicateNumericPolicy(reordered, precision({ decimalPlaces: 1 })),
    attributed,
    attributedOptions
  );
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);

  const zeroPlan = plan({
    op: "compare",
    left: {
      kind: "multiply",
      factors: [{ kind: "constant", value: 0 }, distanceSum]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0, "m", "length") }
  }, environment);
  const zero = evaluateLocalPredicatePlan(
    zeroPlan,
    bindPredicateNumericPolicy(zeroPlan, precision()),
    attributed,
    attributedOptions
  );
  assert.equal(zero.witnesses[0].left.unrounded.canonical, "0");
  assert.equal(zero.witnesses[0].left.quantity.tolerance.absolute, 0);

  const composedPlan = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        expression.left,
        { kind: "constant", value: quantity(0.204, "m", "length") }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0.1, "m", "length") }
  }, environment);
  const composed = evaluateLocalPredicatePlan(
    composedPlan,
    bindPredicateNumericPolicy(composedPlan, precision({ decimalPlaces: 3 })),
    attributed,
    attributedOptions
  );
  assert.equal(composed.outcome, "pass");
  assert.equal(composed.witnesses[0].left.quantity.provenance.method, "local-quantity-add-v1");
  assert.equal(composed.witnesses[0].left.quantity.tolerance.absolute, 0.0104);

  const scalarSum = {
    kind: "sum",
    attribute: "score",
    set: { kind: "nodes", selector: { kind: "all" } }
  };
  const compensatedPlan = plan({
    op: "compare",
    left: {
      kind: "multiply",
      factors: [
        scalarSum,
        {
          kind: "constant",
          value: quantity(2, "m", "length", { absolute: 0.1 }, ["evidence-b"])
        }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(2, "m", "length") }
  }, {
    attributes: {
      score: { kind: "number" }
    }
  });
  attributed.nodes[0].attrs.score = 10_000_000_000_000_000;
  attributed.nodes[1].attrs.score = 1;
  attributed.nodes[2].attrs.score = -10_000_000_000_000_000;
  const compensated = evaluateLocalPredicatePlan(
    compensatedPlan,
    bindPredicateNumericPolicy(
      compensatedPlan,
      precision({ summation: "compensated-binary64" })
    ),
    attributed,
    {
      policy: {
        ...attributedOptions.policy,
        structuralNodeAttributes: ["active", "distance", "score"]
      }
    }
  );
  assert.equal(compensated.outcome, "pass");
  assert.equal(compensated.witnesses[0].left.exact, false);
  assert.equal(compensated.witnesses[0].left.quantity.tolerance.absolute, 0.1);
  assert.equal(compensated.witnesses[0].selections[0].accumulationExact, false);
  assert.deepEqual(
    compensated.witnesses[0].left.quantity.provenance.evidence,
    ["evidence-b"]
  );
});

test("irreducible removal proves node and edge minimality with complete witnesses", () => {
  const expression = (removal) => ({
    op: "irreducibleRemoval",
    removal,
    predicate: {
      op: "cycleExists",
      roles: ["support"],
      projection: "undirected-simple",
      minLength: 3,
      maxLength: 3
    }
  });
  const triangle = triangleCandidate();
  for (const removal of ["node", "edge"]) {
    const compiled = plan(expression(removal));
    const binding = bindPredicateNumericPolicy(compiled, precision());
    const evaluation = evaluateLocalPredicatePlan(compiled, binding, triangle, {
      ...options(),
      substructurePolicy: substructurePolicy()
    });
    const witness = evaluation.witnesses[0];

    assert.equal(evaluation.outcome, "pass");
    assert.deepEqual(evaluation.substructurePolicy, substructurePolicy());
    assert.equal(witness.operator, "irreducibleRemoval");
    assert.equal(witness.removal, removal);
    assert.equal(witness.whole.outcome, "pass");
    assert.equal(witness.attemptedRemovals, 3);
    assert.equal(witness.evaluatedSubstructures, 3);
    assert.equal(witness.skippedSubstructures, 0);
    assert.deepEqual(
      witness.removals.map((entry) => entry.outcome),
      ["fail", "fail", "fail"]
    );
    assert.ok(witness.removals.every((entry) =>
      entry.status === "evaluated" &&
      entry.substructureId.startsWith("sha256:") &&
      entry.witnesses[0].operator === "cycleExists"
    ));
  }

  const relabelled = triangleCandidate();
  relabelled.nodes = [triangle.nodes[2], triangle.nodes[0], triangle.nodes[1]];
  relabelled.edges = [
    { from: 1, to: 2, role: "support" },
    { from: 2, to: 0, role: "support" },
    { from: 0, to: 1, role: "support" }
  ];
  const compiled = plan(expression("node"));
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const original = evaluateLocalPredicatePlan(compiled, binding, triangle, {
    ...options(),
    substructurePolicy: substructurePolicy()
  });
  const replay = evaluateLocalPredicatePlan(compiled, binding, relabelled, {
    ...options(),
    substructurePolicy: substructurePolicy()
  });
  assert.equal(replay.evaluationHash, original.evaluationHash);
});

test("minimal exhaustively evaluates every proper subgraph selected by policy", () => {
  const expression = {
    op: "minimal",
    predicate: {
      op: "cycleExists",
      roles: ["support"],
      projection: "undirected-simple",
      minLength: 3,
      maxLength: 3
    }
  };
  const compiled = plan(expression);
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const expectedAttempts = {
    nodes: 7,
    edges: 7,
    "nodes-and-edges": 17
  };

  for (const remove of ["nodes", "edges", "nodes-and-edges"]) {
    const evaluation = evaluateLocalPredicatePlan(
      compiled,
      binding,
      triangleCandidate(),
      {
        ...options(),
        substructurePolicy: substructurePolicy({
          remove,
          includeDisconnected: true,
          includeEmpty: true
        })
      }
    );
    const witness = evaluation.witnesses[0];
    assert.equal(evaluation.outcome, "pass");
    assert.equal(witness.operator, "minimal");
    assert.equal(witness.enumeration, "exhaustive-proper-subgraphs-v1");
    assert.equal(witness.whole.outcome, "pass");
    assert.equal(witness.attemptedSubstructures, expectedAttempts[remove]);
    assert.equal(witness.evaluatedSubstructures, expectedAttempts[remove]);
    assert.equal(witness.skippedSubstructures, 0);
    assert.ok(witness.substructures.every((entry) =>
      entry.status === "evaluated" && entry.outcome === "fail"
    ));
    assert.ok(witness.substructures.some((entry) =>
      entry.selectedNodeIndexes.length === (remove === "edges" ? 3 : 0) &&
      entry.selectedEdgeIndexes.length === 0
    ));
  }

  const relabelled = triangleCandidate();
  relabelled.nodes = [
    triangleCandidate().nodes[2],
    triangleCandidate().nodes[0],
    triangleCandidate().nodes[1]
  ];
  relabelled.edges = [
    { from: 1, to: 2, role: "support" },
    { from: 2, to: 0, role: "support" },
    { from: 0, to: 1, role: "support" }
  ];
  const policy = substructurePolicy({
    includeDisconnected: true,
    includeEmpty: true
  });
  const original = evaluateLocalPredicatePlan(compiled, binding, triangleCandidate(), {
    ...options(),
    substructurePolicy: policy
  });
  const replay = evaluateLocalPredicatePlan(compiled, binding, relabelled, {
    ...options(),
    substructurePolicy: policy
  });
  assert.equal(replay.evaluationHash, original.evaluationHash);
});

test("minimal is stronger than single removal and binds an explicit policy reference", () => {
  const nodeCountIsOneOrThree = {
    op: "any",
    args: [1, 3].map((value) => ({
      op: "compare",
      left: {
        kind: "count",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      comparator: "eq",
      right: { kind: "constant", value }
    }))
  };
  const policy = substructurePolicy({
    remove: "nodes",
    includeDisconnected: true
  });
  const irreduciblePlan = plan({
    op: "irreducibleRemoval",
    removal: "node",
    predicate: nodeCountIsOneOrThree
  });
  const minimalPlan = plan({
    op: "minimal",
    policy: policy.id,
    predicate: nodeCountIsOneOrThree
  }, { substructurePolicies: [policy.id] });
  const irreducible = evaluateLocalPredicatePlan(
    irreduciblePlan,
    bindPredicateNumericPolicy(irreduciblePlan, precision()),
    triangleCandidate(),
    { ...options(), substructurePolicy: policy }
  );
  const minimal = evaluateLocalPredicatePlan(
    minimalPlan,
    bindPredicateNumericPolicy(minimalPlan, precision()),
    triangleCandidate(),
    { ...options(), substructurePolicy: policy }
  );

  assert.equal(irreducible.outcome, "pass");
  assert.equal(minimal.outcome, "fail");
  assert.equal(minimal.witnesses[0].attemptedSubstructures, 7);
  assert.equal(minimal.witnesses[0].evaluatedSubstructures, 6);
  assert.equal(minimal.witnesses[0].skippedSubstructures, 1);
  assert.equal(minimal.witnesses[0].substructures[0].reason, "empty-excluded");
  assert.equal(
    minimal.witnesses[0].substructures.filter((entry) => entry.outcome === "pass").length,
    3
  );

  assert.throws(
    () => evaluateLocalPredicatePlan(
      minimalPlan,
      bindPredicateNumericPolicy(minimalPlan, precision()),
      triangleCandidate(),
      {
        ...options(),
        substructurePolicy: { ...policy, id: "other-policy-v1" }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_MISMATCH" &&
      error.details.mismatchedPolicies[0] === policy.id
  );
});

test("minimal fails closed at the shared exhaustive-substructure limit", () => {
  const denseLoopSet = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
    edges: Array.from({ length: 14 }, (_, index) => ({
      from: 0,
      to: 0,
      role: `loop-${index.toString().padStart(2, "0")}`
    }))
  };
  const compiled = plan({
    op: "minimal",
    predicate: { op: "componentCount", count: 1 }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());

  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, denseLoopSet, {
      policy: {
        ...options().policy,
        allowParallelEdges: true,
        allowSelfLoops: true
      },
      substructurePolicy: substructurePolicy({ remove: "edges" })
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_LIMIT" &&
      error.details.attemptedSubstructures === 10_001 &&
      error.details.maximum === LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
  );
});

test("novel proves a whole property absent from every exact constituent", () => {
  const exactCandidate = {
    domain: "element-exact",
    nodes: ["a", "b"].map((value) => ({
      ref: `sha256:${value.repeat(64)}`
    })),
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  const compiled = plan({
    op: "novel",
    predicate: { op: "countRole", role: "support", min: 1 }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    exactCandidate,
    options()
  );

  assert.equal(evaluation.outcome, "pass");
  assert.equal(evaluation.substructurePolicy, undefined);
  assert.deepEqual(evaluation.witnesses[0], {
    expressionPath: "$",
    operator: "novel",
    outcome: "pass",
    domain: "element-exact",
    projection: "canonical-single-node-no-edge-v1",
    whole: {
      outcome: "pass",
      witnesses: [{
        expressionPath: "$.predicate",
        operator: "countRole",
        outcome: "pass",
        edgeIndexes: [0],
        count: 1,
        role: "support",
        min: 1
      }]
    },
    attemptedConstituents: 2,
    evaluatedConstituents: 2,
    constituents: evaluation.witnesses[0].constituents
  });
  assert.deepEqual(
    evaluation.witnesses[0].constituents.map((entry) => ({
      parentNodeIndex: entry.parentNodeIndex,
      sourceElementId: entry.sourceElementId,
      canonicalNodeToParent: entry.canonicalNodeToParent,
      outcome: entry.outcome,
      nestedOutcome: entry.witnesses[0].outcome
    })),
    [
      {
        parentNodeIndex: 0,
        sourceElementId: evaluation.witnesses[0].constituents[0].sourceElementId,
        canonicalNodeToParent: [0],
        outcome: "fail",
        nestedOutcome: "fail"
      },
      {
        parentNodeIndex: 1,
        sourceElementId: evaluation.witnesses[0].constituents[1].sourceElementId,
        canonicalNodeToParent: [1],
        outcome: "fail",
        nestedOutcome: "fail"
      }
    ]
  );
  assert.ok(evaluation.witnesses[0].constituents.every((entry) =>
    entry.projectionId.startsWith("sha256:") && entry.projectionId.length === 71
  ));

  const relabelled = {
    domain: "element-exact",
    nodes: [...exactCandidate.nodes].reverse(),
    edges: [{ from: 1, to: 0, role: "support" }]
  };
  const replay = evaluateLocalPredicatePlan(compiled, binding, relabelled, options());
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);
});

test("novel propagates whole, constituent, and singleton verdicts", () => {
  const exactCandidate = {
    domain: "element-exact",
    nodes: [
      { ref: `sha256:${"a".repeat(64)}`, attrs: { active: true } },
      { ref: `sha256:${"b".repeat(64)}`, attrs: { active: false } }
    ],
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  const evaluate = (predicate, input = exactCandidate) => {
    const compiled = plan({ op: "novel", predicate });
    return evaluateLocalPredicatePlan(
      compiled,
      bindPredicateNumericPolicy(compiled, precision()),
      input,
      options()
    );
  };

  const constituentPass = evaluate({ op: "connected" });
  assert.equal(constituentPass.outcome, "fail");
  assert.ok(constituentPass.witnesses[0].constituents.every(
    (entry) => entry.outcome === "pass"
  ));

  const wholeFail = evaluate({ op: "countRole", role: "support", min: 2 });
  assert.equal(wholeFail.outcome, "fail");
  assert.equal(wholeFail.witnesses[0].attemptedConstituents, 0);
  assert.deepEqual(wholeFail.witnesses[0].constituents, []);

  const constituentIndeterminate = evaluate({
    op: "pathExists",
    from: { kind: "where", attribute: "active", equals: true },
    to: { kind: "where", attribute: "active", equals: false },
    roles: ["support"]
  });
  assert.equal(constituentIndeterminate.outcome, "indeterminate");
  assert.ok(constituentIndeterminate.witnesses[0].constituents.every(
    (entry) => entry.outcome === "indeterminate"
  ));

  const singleton = evaluate(
    { op: "componentCount", count: 1 },
    { domain: "element-exact", nodes: [exactCandidate.nodes[0]], edges: [] }
  );
  assert.equal(singleton.outcome, "fail");
  assert.equal(singleton.witnesses[0].constituents.length, 1);
  assert.equal(singleton.witnesses[0].constituents[0].outcome, "pass");
});

test("novel is exact-domain only and discovers nested substructure requirements", () => {
  const profileHash = `sha256:${"9".repeat(64)}`;
  const exactPlan = plan({ op: "novel", predicate: { op: "connected" } });
  assert.throws(
    () => evaluateLocalPredicatePlan(
      exactPlan,
      bindPredicateNumericPolicy(exactPlan, precision()),
      { domain: "profile-quotient", nodes: [{ ref: profileHash }], edges: [] },
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_NOVEL_DOMAIN_UNSUPPORTED" &&
      error.details.domain === "profile-quotient"
  );

  const nested = plan({
    op: "novel",
    predicate: {
      op: "minimal",
      predicate: { op: "countRole", role: "support", min: 1 }
    }
  });
  const nestedCandidate = {
    domain: "element-exact",
    nodes: ["a", "b"].map((value) => ({ ref: `sha256:${value.repeat(64)}` })),
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(
      nested,
      bindPredicateNumericPolicy(nested, precision()),
      nestedCandidate,
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_REQUIRED"
  );
  const evaluation = evaluateLocalPredicatePlan(
    nested,
    bindPredicateNumericPolicy(nested, precision()),
    nestedCandidate,
    { ...options(), substructurePolicy: substructurePolicy() }
  );
  assert.equal(evaluation.outcome, "pass");
  assert.equal(evaluation.substructurePolicy.id, "local-substructure-v1");
  assert.equal(
    evaluation.witnesses[0].boundSubstructurePolicyId,
    "local-substructure-v1"
  );

  const invariantPlan = plan({
    op: "novel",
    predicate: {
      op: "compare",
      left: {
        kind: "invariant",
        name: "score",
        node: { kind: "canonical-index", index: 0 }
      },
      comparator: "eq",
      right: { kind: "constant", value: 1 }
    }
  }, { invariants: { score: { kind: "number" } } });
  const invariantEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    bindPredicateNumericPolicy(invariantPlan, precision()),
    nestedCandidate,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash: `sha256:${"d".repeat(64)}`,
        elements: nestedCandidate.nodes.map((node) => ({
          elementId: node.ref,
          invariants: { score: 1 }
        }))
      }
    }
  );
  const invariantWitness = invariantEvaluation.witnesses[0];
  assert.equal(invariantEvaluation.outcome, "fail");
  assert.equal(invariantWitness.whole.outcome, "pass");
  assert.ok(invariantWitness.constituents.every((entry) =>
    entry.outcome === "pass" &&
    entry.witnesses[0].invariants[0].elementId === entry.sourceElementId &&
    entry.canonicalNodeToParent.length === 1
  ));
});

test("novel keeps an empty exact-constituent denominator indeterminate", () => {
  const compiled = plan({
    op: "irreducibleRemoval",
    removal: "node",
    predicate: {
      op: "not",
      arg: {
        op: "novel",
        predicate: {
          op: "compare",
          left: { kind: "constant", value: 1 },
          comparator: "eq",
          right: { kind: "constant", value: 1 }
        }
      }
    }
  });
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    bindPredicateNumericPolicy(compiled, precision()),
    {
      domain: "element-exact",
      nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
      edges: []
    },
    {
      ...options(),
      substructurePolicy: substructurePolicy({ includeEmpty: true })
    }
  );
  const removal = evaluation.witnesses[0].removals[0];
  const emptyNovel = removal.witnesses[0];

  assert.equal(evaluation.outcome, "indeterminate");
  assert.equal(removal.status, "evaluated");
  assert.equal(removal.outcome, "indeterminate");
  assert.equal(emptyNovel.operator, "novel");
  assert.equal(emptyNovel.whole.outcome, "pass");
  assert.equal(emptyNovel.outcome, "indeterminate");
  assert.equal(emptyNovel.attemptedConstituents, 0);
  assert.deepEqual(emptyNovel.constituents, []);
});

test("stable-under exhaustively proves preservation across valid edge deletions", () => {
  const compiled = plan({
    op: "stableUnder",
    perturbation: "local-perturbation-v1",
    threshold: 1,
    predicate: { op: "connected" }
  }, { perturbations: ["local-perturbation-v1"] });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const perturbationContext = {
    definitions: [{
      id: "local-perturbation-v1",
      kind: "edge-deletion",
      enumeration: "exhaustive-valid-single-edits-v1",
      emptyPolicy: "indeterminate"
    }]
  };
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    triangleCandidate(),
    { ...options(), perturbationContext }
  );

  assert.equal(evaluation.outcome, "pass");
  assert.ok(evaluation.perturbationContextHash.startsWith("sha256:"));
  const witness = evaluation.witnesses[0];
  assert.equal(witness.operator, "stableUnder");
  assert.equal(witness.attemptedPerturbations, 3);
  assert.equal(witness.validPerturbations, 3);
  assert.equal(witness.skippedPerturbations, 0);
  assert.equal(witness.passedPerturbations, 3);
  assert.equal(witness.stability.lower.numerator, 3);
  assert.equal(witness.stability.lower.denominator, 3);
  assert.equal(witness.stability.lower.rounded.canonical, "1");
  assert.ok(witness.perturbations.every((entry) =>
    entry.status === "evaluated" &&
    entry.outcome === "pass" &&
    entry.perturbedCandidateId.startsWith("sha256:")
  ));

  const relabelled = triangleCandidate();
  relabelled.nodes.reverse();
  relabelled.edges = [
    { from: 2, to: 1, role: "support" },
    { from: 1, to: 0, role: "support" },
    { from: 0, to: 2, role: "support" }
  ];
  const replay = evaluateLocalPredicatePlan(
    compiled,
    binding,
    relabelled,
    { ...options(), perturbationContext }
  );
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);

  const nodePlan = plan({
    op: "stableUnder",
    perturbation: "local-node-drop-v1",
    threshold: 1,
    predicate: { op: "connected" }
  }, { perturbations: ["local-node-drop-v1"] });
  const nodeEvaluation = evaluateLocalPredicatePlan(
    nodePlan,
    bindPredicateNumericPolicy(nodePlan, precision()),
    triangleCandidate(),
    {
      ...options(),
      perturbationContext: {
        definitions: [{
          id: "local-node-drop-v1",
          kind: "node-deletion",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate"
        }]
      }
    }
  );
  assert.equal(nodeEvaluation.outcome, "pass");
  assert.equal(nodeEvaluation.witnesses[0].validPerturbations, 3);
  assert.ok(nodeEvaluation.witnesses[0].perturbations.every((entry) =>
    entry.parentNodeIndexes.length === 2 &&
    entry.canonicalNodeToParent.length === 2 &&
    entry.canonicalEdgeToParent.length === 1
  ));
});

test("stable-under omits graph-invalid attempts and binds empty-denominator policy", () => {
  const compiled = plan({
    op: "stableUnder",
    perturbation: "edge-drop",
    threshold: 1,
    predicate: { op: "connected" }
  }, { perturbations: ["edge-drop"] });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const definition = {
    id: "edge-drop",
    kind: "edge-deletion",
    enumeration: "exhaustive-valid-single-edits-v1",
    emptyPolicy: "indeterminate"
  };
  const indeterminate = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidate(),
    { ...options(), perturbationContext: { definitions: [definition] } }
  );
  const witness = indeterminate.witnesses[0];
  assert.equal(indeterminate.outcome, "indeterminate");
  assert.equal(witness.attemptedPerturbations, 2);
  assert.equal(witness.validPerturbations, 0);
  assert.equal(witness.skippedPerturbations, 2);
  assert.equal(witness.stability, null);
  assert.ok(witness.perturbations.every((entry) =>
    entry.status === "skipped" &&
    entry.reason === "graph-policy-invalid" &&
    entry.validationIssueCodes.includes("CANDIDATE_DISCONNECTED")
  ));

  const vacuous = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidate(),
    {
      ...options(),
      perturbationContext: {
        definitions: [{ ...definition, emptyPolicy: "vacuous-pass" }]
      }
    }
  );
  assert.equal(vacuous.outcome, "pass");
  assert.notEqual(vacuous.evaluationHash, indeterminate.evaluationHash);
});

test("stable-under uses exact three-valued bounds for role and numeric edits", () => {
  const rolePlan = plan({
    op: "stableUnder",
    perturbation: "replace-support",
    threshold: 1,
    predicate: { op: "countRole", role: "support", min: 2 }
  }, { perturbations: ["replace-support"] });
  const roleEvaluation = evaluateLocalPredicatePlan(
    rolePlan,
    bindPredicateNumericPolicy(rolePlan, precision()),
    candidate(),
    {
      ...options(),
      perturbationContext: {
        definitions: [{
          id: "replace-support",
          kind: "edge-role-replacement",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate",
          replacements: [{ from: "support", to: "alternate" }]
        }]
      }
    }
  );
  assert.equal(roleEvaluation.outcome, "fail");
  assert.equal(roleEvaluation.witnesses[0].failedPerturbations, 2);
  assert.equal(roleEvaluation.witnesses[0].stability.upper.rounded.canonical, "0");
  const profileEvaluation = evaluateLocalPredicatePlan(
    rolePlan,
    bindPredicateNumericPolicy(rolePlan, precision()),
    { ...candidate(), domain: "profile-quotient" },
    {
      ...options(),
      perturbationContext: {
        definitions: [{
          id: "replace-support",
          kind: "edge-role-replacement",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate",
          replacements: [{ from: "support", to: "alternate" }]
        }]
      }
    }
  );
  assert.equal(profileEvaluation.outcome, "fail");

  const numericPlan = plan({
    op: "stableUnder",
    perturbation: "move-x",
    threshold: 1,
    predicate: {
      op: "pathExists",
      from: { kind: "where", attribute: "x", equals: 0 },
      to: { kind: "where", attribute: "x", equals: 2 },
      roles: ["support"]
    }
  }, {
    attributes: { x: { kind: "number" } },
    perturbations: ["move-x"]
  });
  const numericCandidate = candidate();
  numericCandidate.nodes = numericCandidate.nodes.map((node, index) => ({
    ...node,
    attrs: { x: index }
  }));
  const numericOptions = options();
  numericOptions.policy.structuralNodeAttributes = ["x"];
  const numericEvaluation = evaluateLocalPredicatePlan(
    numericPlan,
    bindPredicateNumericPolicy(numericPlan, precision()),
    numericCandidate,
    {
      ...numericOptions,
      perturbationContext: {
        definitions: [{
          id: "move-x",
          kind: "numeric-attribute-displacement",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate",
          target: "nodes",
          attribute: "x",
          epsilon: 1,
          directions: ["increase"]
        }]
      }
    }
  );
  const numericWitness = numericEvaluation.witnesses[0];
  assert.equal(numericEvaluation.outcome, "indeterminate");
  assert.equal(numericWitness.validPerturbations, 3);
  assert.equal(numericWitness.passedPerturbations, 1);
  assert.equal(numericWitness.indeterminatePerturbations, 2);
  assert.equal(numericWitness.stability.lower.rounded.canonical, "0.333333");
  assert.equal(numericWitness.stability.upper.rounded.canonical, "1");

  const exactBoundaryPlan = plan({
    ...numericPlan.expression,
    threshold: 1 / 3
  }, {
    attributes: { x: { kind: "number" } },
    perturbations: ["move-x"]
  });
  const exactBoundary = evaluateLocalPredicatePlan(
    exactBoundaryPlan,
    bindPredicateNumericPolicy(exactBoundaryPlan, precision()),
    numericCandidate,
    {
      ...numericOptions,
      perturbationContext: {
        definitions: [{
          id: "move-x",
          kind: "numeric-attribute-displacement",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate",
          target: "nodes",
          attribute: "x",
          epsilon: 1,
          directions: ["increase"]
        }]
      }
    }
  );
  assert.equal(exactBoundary.outcome, "pass");
  assert.equal(
    exactBoundary.witnesses[0].threshold.canonical,
    "0.3333333333333333"
  );
});

test("sampled stable-under binds a deterministic stream and conservative confidence bounds", () => {
  const compiled = plan({
    op: "stableUnder",
    perturbation: "sample-edge-drop",
    threshold: 0.5,
    predicate: { op: "countRole", role: "support", min: 1 }
  }, { perturbations: ["sample-edge-drop"] });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const sampledCandidate = triangleCandidate();
  sampledCandidate.edges[1].role = "alternate";
  sampledCandidate.edges[2].role = "alternate";
  const definition = {
    id: "sample-edge-drop",
    kind: "edge-deletion",
    enumeration: "sampled-valid-single-edits-v1",
    emptyPolicy: "indeterminate"
  };
  const sampling = {
    algorithm: "sha256-rejection-counter-v1",
    frame: "applicable-single-edit-attempts-v1",
    replacement: "with-replacement",
    uncertainty: "chebyshev-union-95-v1",
    sampleSize: 1_000,
    streamKey: `sha256:${"1".repeat(64)}`
  };
  const perturbationContext = { definitions: [definition], sampling };
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    sampledCandidate,
    { ...options(), perturbationContext }
  );
  const witness = evaluation.witnesses[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.enumeration, "sampled-valid-single-edits-v1");
  assert.equal(
    witness.decisionRule,
    "chebyshev-union-95-three-valued-bounds-v1"
  );
  assert.equal(witness.sampling.frameSize, 3);
  assert.equal(witness.sampling.sampleSize, 1_000);
  assert.equal(witness.sampling.status, "evaluated");
  assert.equal(witness.attemptedPerturbations, 1_000);
  assert.equal(witness.validPerturbations, 1_000);
  assert.equal(witness.confidenceBounds.confidenceNumerator, 95);
  assert.equal(witness.confidenceBounds.confidenceDenominator, 100);
  assert.equal(witness.confidenceBounds.radius.canonical, "0.1");
  assert.ok(
    Number(witness.confidenceBounds.passing.lower.canonical) >= 0.5
  );
  assert.ok(witness.perturbations.every((entry) =>
    Number.isSafeInteger(entry.frameIndex) &&
    entry.frameIndex >= 0 &&
    entry.frameIndex < 3 &&
    entry.streamDraws === 1
  ));

  const replay = evaluateLocalPredicatePlan(
    compiled,
    binding,
    sampledCandidate,
    { ...options(), perturbationContext }
  );
  assert.equal(replay.evaluationHash, evaluation.evaluationHash);

  const relabelled = triangleCandidate();
  relabelled.nodes = [
    sampledCandidate.nodes[2],
    sampledCandidate.nodes[0],
    sampledCandidate.nodes[1]
  ];
  relabelled.edges = [
    { from: 1, to: 2, role: "support" },
    { from: 2, to: 0, role: "alternate" },
    { from: 0, to: 1, role: "alternate" }
  ];
  const relabelledReplay = evaluateLocalPredicatePlan(
    compiled,
    binding,
    relabelled,
    { ...options(), perturbationContext }
  );
  assert.equal(relabelledReplay.evaluationHash, evaluation.evaluationHash);

  const changedStream = evaluateLocalPredicatePlan(
    compiled,
    binding,
    sampledCandidate,
    {
      ...options(),
      perturbationContext: {
        definitions: [definition],
        sampling: {
          ...sampling,
          streamKey: `sha256:${"2".repeat(64)}`
        }
      }
    }
  );
  assert.notEqual(changedStream.evaluationHash, evaluation.evaluationHash);
  assert.notDeepEqual(
    changedStream.witnesses[0].perturbations.map((entry) => entry.frameIndex),
    witness.perturbations.map((entry) => entry.frameIndex)
  );

  const failingPlan = plan({
    op: "stableUnder",
    perturbation: "sample-edge-drop",
    threshold: 0.2,
    predicate: { op: "countRole", role: "absent", min: 1 }
  }, { perturbations: ["sample-edge-drop"] });
  const failing = evaluateLocalPredicatePlan(
    failingPlan,
    bindPredicateNumericPolicy(failingPlan, precision()),
    sampledCandidate,
    { ...options(), perturbationContext }
  );
  assert.equal(failing.outcome, "fail");
  assert.equal(
    failing.witnesses[0].confidenceBounds.nonFailure.upper.canonical,
    "0.1"
  );

  const noBudget = evaluateLocalPredicatePlan(
    compiled,
    binding,
    sampledCandidate,
    {
      ...options(),
      perturbationContext: {
        definitions: [definition],
        sampling: { ...sampling, sampleSize: 0 }
      }
    }
  );
  assert.equal(noBudget.outcome, "indeterminate");
  assert.equal(noBudget.witnesses[0].sampling.status, "budget-empty");
  assert.equal(noBudget.witnesses[0].confidenceBounds, null);

  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, sampledCandidate, {
      ...options(),
      perturbationContext: { definitions: [definition] }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_SAMPLING_INVALID"
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, sampledCandidate, {
      ...options(),
      perturbationContext: {
        definitions: [definition],
        sampling: { ...sampling, sampleSize: 10_001 }
      }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_LIMIT"
  );
});

test("stable-under rejects missing, registry-only, and non-structural contexts", () => {
  const compiled = plan({
    op: "stableUnder",
    perturbation: "move-x",
    threshold: 0.5,
    predicate: { op: "connected" }
  }, { perturbations: ["move-x"] });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, candidate(), options()),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_CONTEXT_REQUIRED"
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, candidate(), {
      ...options(),
      perturbationContext: { definitions: ["move-x"] }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_CONTEXT_INVALID"
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, candidate(), {
      ...options(),
      perturbationContext: {
        definitions: [{
          id: "move-x",
          kind: "numeric-attribute-displacement",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate",
          target: "nodes",
          attribute: "x",
          epsilon: 1,
          directions: ["increase"]
        }]
      }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_ATTRIBUTE_UNBOUND"
  );

});

test("stable-under preserves retained-node invariant bindings across perturbations", () => {
  const nestedInvariantPlan = plan({
    op: "stableUnder",
    perturbation: "replace-support",
    threshold: 1,
    predicate: {
      op: "compare",
      left: {
        kind: "invariant",
        name: "score",
        node: { kind: "canonical-index", index: 0 }
      },
      comparator: "eq",
      right: { kind: "constant", value: 1 }
    }
  }, {
    invariants: { score: { kind: "number" } },
    perturbations: ["replace-support"]
  });
  const graph = candidate();
  const evaluation = evaluateLocalPredicatePlan(
    nestedInvariantPlan,
    bindPredicateNumericPolicy(nestedInvariantPlan, precision()),
    graph,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash: `sha256:${"e".repeat(64)}`,
        elements: graph.nodes.map((node) => ({
          elementId: node.ref,
          invariants: { score: 1 }
        }))
      },
      perturbationContext: {
        definitions: [{
          id: "replace-support",
          kind: "edge-role-replacement",
          enumeration: "exhaustive-valid-single-edits-v1",
          emptyPolicy: "indeterminate",
          replacements: [{ from: "support", to: "alternate" }]
        }]
      }
    }
  );
  const witness = evaluation.witnesses[0];
  assert.equal(evaluation.outcome, "pass");
  assert.equal(witness.validPerturbations, 2);
  assert.ok(witness.perturbations.every((entry) =>
    entry.outcome === "pass" &&
    entry.canonicalNodeToParent.length === graph.nodes.length &&
    entry.witnesses[0].invariants[0].name === "score"
  ));
});

test("stable-under discovers and binds nested substructure policies", () => {
  const compiled = plan({
    op: "stableUnder",
    perturbation: "replace-support",
    threshold: 1,
    predicate: {
      op: "minimal",
      predicate: { op: "connected" }
    }
  }, { perturbations: ["replace-support"] });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const perturbationContext = {
    definitions: [{
      id: "replace-support",
      kind: "edge-role-replacement",
      enumeration: "exhaustive-valid-single-edits-v1",
      emptyPolicy: "indeterminate",
      replacements: [{ from: "support", to: "alternate" }]
    }]
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, candidate(), {
      ...options(),
      perturbationContext
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_REQUIRED"
  );
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidate(),
    {
      ...options(),
      perturbationContext,
      substructurePolicy: substructurePolicy({ remove: "nodes" })
    }
  );
  assert.equal(evaluation.outcome, "fail");
  assert.equal(
    evaluation.witnesses[0].boundSubstructurePolicyId,
    "local-substructure-v1"
  );
  assert.ok(evaluation.witnesses[0].perturbations.every((entry) =>
    entry.witnesses[0].operator === "minimal"
  ));
});

test("stable-under preflights the shared structural-attempt ceiling", () => {
  const compiled = plan({
    op: "stableUnder",
    perturbation: "replacement-family",
    threshold: 1,
    predicate: { op: "connected" }
  }, { perturbations: ["replacement-family"] });
  const manyEdges = {
    domain: "element-exact",
    nodes: [
      { ref: `sha256:${"a".repeat(64)}` },
      { ref: `sha256:${"b".repeat(64)}` }
    ],
    edges: Array.from({ length: 41 }, () => ({
      from: 0,
      to: 1,
      role: "support"
    }))
  };
  const replacementFamily = Array.from({ length: 256 }, (_, index) => ({
    from: "support",
    to: `alternate-${index.toString().padStart(3, "0")}`
  }));
  const localOptions = options();
  localOptions.policy.allowParallelEdges = true;
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      bindPredicateNumericPolicy(compiled, precision()),
      manyEdges,
      {
        ...localOptions,
        perturbationContext: {
          definitions: [{
            id: "replacement-family",
            kind: "edge-role-replacement",
            enumeration: "exhaustive-valid-single-edits-v1",
            emptyPolicy: "indeterminate",
            replacements: replacementFamily
          }]
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_LIMIT" &&
      error.details.maximum ===
        LOCAL_PREDICATE_EVALUATION_LIMITS.maxSubstructureRemovals
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      bindPredicateNumericPolicy(compiled, precision()),
      manyEdges,
      {
        ...localOptions,
        perturbationContext: {
          definitions: [{
            id: "replacement-family",
            kind: "edge-role-replacement",
            enumeration: "sampled-valid-single-edits-v1",
            emptyPolicy: "indeterminate",
            replacements: replacementFamily
          }],
          sampling: {
            algorithm: "sha256-rejection-counter-v1",
            frame: "applicable-single-edit-attempts-v1",
            replacement: "with-replacement",
            uncertainty: "chebyshev-union-95-v1",
            sampleSize: 1,
            streamKey: `sha256:${"3".repeat(64)}`
          }
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_PERTURBATION_FRAME_LIMIT" &&
      error.details.frameSize === 10_496
  );
});

test("irreducible removal distinguishes reducibility, whole failure, and empty denominators", () => {
  const cycle = {
    op: "cycleExists",
    roles: ["support"],
    projection: "undirected-simple",
    minLength: 3
  };
  const compiled = plan({
    op: "irreducibleRemoval",
    removal: "node",
    predicate: cycle
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const completeFour = {
    domain: "element-exact",
    nodes: ["a", "b", "c", "d"].map((value) => ({
      ref: `sha256:${value.repeat(64)}`
    })),
    edges: Array.from({ length: 4 }, (_, from) =>
      Array.from({ length: 4 - from - 1 }, (__, offset) => ({
        from,
        to: from + offset + 1,
        role: "support"
      }))
    ).flat()
  };
  const reducible = evaluateLocalPredicatePlan(compiled, binding, completeFour, {
    ...options(),
    substructurePolicy: substructurePolicy()
  });
  assert.equal(reducible.outcome, "fail");
  assert.ok(reducible.witnesses[0].removals.every((entry) => entry.outcome === "pass"));

  const wholeFailure = evaluateLocalPredicatePlan(compiled, binding, candidate(), {
    ...options(),
    substructurePolicy: substructurePolicy()
  });
  assert.equal(wholeFailure.outcome, "fail");
  assert.equal(wholeFailure.witnesses[0].whole.outcome, "fail");
  assert.deepEqual(wholeFailure.witnesses[0].removals, []);

  const countPlan = plan({
    op: "irreducibleRemoval",
    removal: "node",
    predicate: {
      op: "compare",
      left: { kind: "count", set: { kind: "nodes", selector: { kind: "all" } } },
      comparator: "eq",
      right: { kind: "constant", value: 1 }
    }
  });
  const countBinding = bindPredicateNumericPolicy(countPlan, precision());
  const singleton = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
    edges: []
  };
  const excludedEmpty = evaluateLocalPredicatePlan(countPlan, countBinding, singleton, {
    substructurePolicy: substructurePolicy({ remove: "nodes" })
  });
  assert.equal(excludedEmpty.outcome, "indeterminate");
  assert.equal(excludedEmpty.witnesses[0].evaluatedSubstructures, 0);
  assert.equal(excludedEmpty.witnesses[0].removals[0].reason, "empty-excluded");

  const includedEmpty = evaluateLocalPredicatePlan(countPlan, countBinding, singleton, {
    substructurePolicy: substructurePolicy({ remove: "nodes", includeEmpty: true })
  });
  assert.equal(includedEmpty.outcome, "pass");
  assert.equal(includedEmpty.witnesses[0].removals[0].outcome, "fail");
  assert.deepEqual(includedEmpty.witnesses[0].removals[0].canonicalNodeToParent, []);
});

test("substructure policy controls disconnected and isolated removal semantics", () => {
  const compiled = plan({
    op: "irreducibleRemoval",
    removal: "edge",
    predicate: { op: "connected" }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const disconnectedExcluded = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidate(),
    {
      ...options(),
      substructurePolicy: substructurePolicy({ remove: "edges" })
    }
  );
  assert.equal(disconnectedExcluded.outcome, "indeterminate");
  assert.equal(disconnectedExcluded.witnesses[0].evaluatedSubstructures, 0);
  assert.ok(disconnectedExcluded.witnesses[0].removals.every((entry) =>
    entry.reason === "disconnected-excluded"
  ));

  const disconnectedIncluded = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidate(),
    {
      ...options(),
      substructurePolicy: substructurePolicy({
        remove: "edges",
        includeDisconnected: true
      })
    }
  );
  assert.equal(disconnectedIncluded.outcome, "pass");
  assert.ok(disconnectedIncluded.witnesses[0].removals.every((entry) =>
    entry.status === "evaluated" && entry.outcome === "fail"
  ));

  const dyad = {
    domain: "element-exact",
    nodes: ["a", "b"].map((value) => ({ ref: `sha256:${value.repeat(64)}` })),
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  const pruneIsolates = evaluateLocalPredicatePlan(compiled, binding, dyad, {
    ...options(),
    substructurePolicy: substructurePolicy({
      remove: "edges",
      includeEmpty: true,
      retainIsolatedNodes: false
    })
  });
  assert.equal(pruneIsolates.outcome, "pass");
  assert.deepEqual(pruneIsolates.witnesses[0].removals[0].parentNodeIndexes, []);
});

test("irreducible removal fails closed on policy drift and resolves retained invariants", () => {
  const compiled = plan({
    op: "irreducibleRemoval",
    removal: "node",
    predicate: { op: "connected" }
  });
  const binding = bindPredicateNumericPolicy(compiled, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, triangleCandidate(), {
      ...options(),
      substructurePolicy: substructurePolicy({ remove: "edges" })
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_MISMATCH"
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, triangleCandidate(), options()),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_REQUIRED"
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(compiled, binding, triangleCandidate(), {
      ...options(),
      substructurePolicy: {
        ...substructurePolicy(),
        undeclared: true
      }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_INVALID"
  );

  const graphOnlyPlan = plan({ op: "connected" });
  const graphOnlyBinding = bindPredicateNumericPolicy(graphOnlyPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(
      graphOnlyPlan,
      graphOnlyBinding,
      triangleCandidate(),
      { ...options(), substructurePolicy: substructurePolicy() }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_UNEXPECTED"
  );

  const invariantPlan = plan({
    op: "irreducibleRemoval",
    removal: "node",
    predicate: {
      op: "compare",
      left: {
        kind: "invariant",
        name: "length",
        node: { kind: "canonical-index", index: 0 }
      },
      comparator: "eq",
      right: { kind: "constant", value: quantity(1, "m", "length") }
    }
  }, { invariants: { length: quantity(1, "m", "length") } });
  const invariantBinding = bindPredicateNumericPolicy(invariantPlan, precision());
  const graph = triangleCandidate();
  const invariantEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    invariantBinding,
    graph,
    {
      ...options(),
      substructurePolicy: substructurePolicy(),
      invariantContext: {
        sourcePopulationHash: `sha256:${"f".repeat(64)}`,
        elements: graph.nodes.map((node) => ({
          elementId: node.ref,
          invariants: { length: quantity(1, "m", "length") }
        }))
      }
    }
  );
  const invariantWitness = invariantEvaluation.witnesses[0];
  assert.equal(invariantEvaluation.outcome, "fail");
  assert.equal(invariantWitness.whole.outcome, "pass");
  assert.ok(invariantWitness.removals.every((entry) =>
    entry.status === "evaluated" &&
    entry.outcome === "pass" &&
    entry.canonicalNodeToParent.length === 2 &&
    entry.witnesses[0].invariants[0].canonicalNode === 0
  ));
});

test("element-exact runtime invariants bind unique nodes and source quantities", () => {
  const sourcePopulationHash = `sha256:${"d".repeat(64)}`;
  const sourceQuantity = quantity(
    0.052,
    "m",
    "length",
    { absolute: 0.001 },
    ["invariant-evidence"]
  );
  const directPlan = plan({
    op: "compare",
    left: { kind: "invariant", name: "length" },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0.052, "m", "length") }
  }, { invariants: { length: sourceQuantity } });
  const singleton = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
    edges: []
  };
  const singletonContext = {
    sourcePopulationHash,
    elements: [{
      elementId: singleton.nodes[0].ref,
      invariants: { length: sourceQuantity }
    }]
  };
  const direct = evaluateLocalPredicatePlan(
    directPlan,
    bindPredicateNumericPolicy(directPlan, precision()),
    singleton,
    { ...options(), invariantContext: singletonContext }
  );

  assert.equal(direct.outcome, "pass");
  assert.equal(direct.invariantSourcePopulationHash, sourcePopulationHash);
  assert.deepEqual(direct.invariantNames, ["length"]);
  assert.deepEqual(direct.witnesses[0].left.quantity.provenance, {
    kind: "declared",
    evidence: ["invariant-evidence"]
  });
  assert.deepEqual(direct.witnesses[0].invariants, [{
    expressionPath: "$.left",
    name: "length",
    canonicalNode: 0,
    elementId: singleton.nodes[0].ref,
    quantity: direct.witnesses[0].left.quantity
  }]);

  const selectedInvariant = {
    kind: "invariant",
    name: "length",
    node: { kind: "canonical-index", index: 0 }
  };
  const derivedPlan = plan({
    op: "compare",
    left: {
      kind: "multiply",
      factors: [
        { kind: "constant", value: 2 },
        {
          kind: "add",
          terms: [
            selectedInvariant,
            { kind: "constant", value: quantity(0, "m", "length") }
          ]
        }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0.1, "m", "length") }
  }, { invariants: { length: sourceQuantity } });
  const graph = candidate();
  const context = {
    sourcePopulationHash,
    elements: graph.nodes.map((node) => ({
      elementId: node.ref,
      invariants: { length: sourceQuantity }
    }))
  };
  const derived = evaluateLocalPredicatePlan(
    derivedPlan,
    bindPredicateNumericPolicy(derivedPlan, precision({ decimalPlaces: 1 })),
    graph,
    { ...options(), invariantContext: context }
  );
  assert.equal(derived.outcome, "pass");
  assert.equal(derived.witnesses[0].left.unrounded.canonical, "0.104");
  assert.equal(derived.witnesses[0].left.quantity.tolerance.absolute, 0.002);
  assert.equal(
    derived.witnesses[0].left.quantity.provenance.method,
    "local-quantity-scale-v1"
  );
  assert.equal(derived.witnesses[0].invariants.length, 1);

  const reversed = evaluateLocalPredicatePlan(
    derivedPlan,
    bindPredicateNumericPolicy(derivedPlan, precision({ decimalPlaces: 1 })),
    graph,
    { ...options(), invariantContext: { ...context, elements: [...context.elements].reverse() } }
  );
  assert.equal(reversed.evaluationHash, derived.evaluationHash);

  const rebound = evaluateLocalPredicatePlan(
    derivedPlan,
    bindPredicateNumericPolicy(derivedPlan, precision({ decimalPlaces: 1 })),
    graph,
    {
      ...options(),
      invariantContext: {
        ...context,
        sourcePopulationHash: `sha256:${"e".repeat(64)}`
      }
    }
  );
  assert.notEqual(rebound.evaluationHash, derived.evaluationHash);

  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_REQUIRED"
  );
  const ambiguous = evaluateLocalPredicatePlan(
    directPlan,
    bindPredicateNumericPolicy(directPlan, precision()),
    graph,
    { ...options(), invariantContext: context }
  );
  assert.equal(ambiguous.outcome, "indeterminate");
  assert.deepEqual(ambiguous.witnesses[0].invariantFailures, [{
    operand: "left",
    reason: "invariant-node-ambiguous",
    details: {
      path: "$.left",
      name: "length",
      selector: null,
      nodeIndexes: []
    }
  }]);

  const missingContext = {
    ...singletonContext,
    elements: [{ elementId: singleton.nodes[0].ref, invariants: {} }]
  };
  const missing = evaluateLocalPredicatePlan(
    directPlan,
    bindPredicateNumericPolicy(directPlan, precision()),
    singleton,
    { ...options(), invariantContext: missingContext }
  );
  assert.equal(missing.outcome, "indeterminate");
  assert.deepEqual(missing.witnesses[0].invariantFailures, [{
    operand: "left",
    reason: "invariant-value-unavailable",
    details: {
      path: "$.left",
      name: "length",
      canonicalNode: 0,
      elementId: singleton.nodes[0].ref
    }
  }]);

  const twoMissingPlan = plan({
    op: "compare",
    left: { kind: "invariant", name: "leftLength" },
    comparator: "eq",
    right: { kind: "invariant", name: "rightLength" }
  }, {
    invariants: {
      leftLength: sourceQuantity,
      rightLength: sourceQuantity
    }
  });
  const twoMissingBinding = bindPredicateNumericPolicy(twoMissingPlan, precision());
  const twoMissing = evaluateLocalPredicatePlan(
    twoMissingPlan,
    twoMissingBinding,
    singleton,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash,
        elements: [{ elementId: singleton.nodes[0].ref, invariants: {} }]
      }
    }
  );
  assert.equal(twoMissing.outcome, "indeterminate");
  assert.deepEqual(
    twoMissing.witnesses[0].invariantFailures.map((entry) => [
      entry.operand,
      entry.reason,
      entry.details.name
    ]),
    [
      ["left", "invariant-value-unavailable", "leftLength"],
      ["right", "invariant-value-unavailable", "rightLength"]
    ]
  );
  assert.equal(
    evaluateLocalPredicatePlan(
      twoMissingPlan,
      twoMissingBinding,
      singleton,
      {
        ...options(),
        invariantContext: {
          sourcePopulationHash,
          elements: [{ elementId: singleton.nodes[0].ref, invariants: {} }]
        }
      }
    ).evaluationHash,
    twoMissing.evaluationHash
  );

  const mismatchedContext = {
    ...singletonContext,
    elements: [{
      elementId: `sha256:${"f".repeat(64)}`,
      invariants: { length: sourceQuantity }
    }]
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      { ...options(), invariantContext: mismatchedContext }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_MISMATCH"
  );

  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      {
        ...options(),
        invariantContext: {
          ...singletonContext,
          elements: [{
            ...singletonContext.elements[0],
            invariants: {
              length: sourceQuantity,
              unexpected: sourceQuantity
            }
          }]
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID"
  );

  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      {
        ...options(),
        invariantContext: {
          ...singletonContext,
          elements: [singletonContext.elements[0], singletonContext.elements[0]]
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID"
  );

  const wrongUnit = {
    ...singletonContext,
    elements: [{
      elementId: singleton.nodes[0].ref,
      invariants: { length: quantity(1, "s", "length") }
    }]
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      { ...options(), invariantContext: wrongUnit }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_UNIT_MISMATCH"
  );

  const wrongSemantic = {
    ...singletonContext,
    elements: [{
      elementId: singleton.nodes[0].ref,
      invariants: { length: quantity(0.052, "m", "width") }
    }]
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      { ...options(), invariantContext: wrongSemantic }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_SEMANTIC_MISMATCH"
  );

});

test("profile invariants require identical normalized values from every class member", () => {
  const sourcePopulationHash = `sha256:${"d".repeat(64)}`;
  const profileHash = `sha256:${"9".repeat(64)}`;
  const memberElementIds = [
    `sha256:${"a".repeat(64)}`,
    `sha256:${"b".repeat(64)}`
  ];
  const sourceQuantity = quantity(
    1,
    "m",
    "length",
    { absolute: 0.001 },
    ["consensus-evidence"]
  );
  const compiled = plan({
    op: "compare",
    left: { kind: "invariant", name: "length" },
    comparator: "eq",
    right: { kind: "constant", value: quantity(100, "cm", "length") }
  }, { invariants: { length: sourceQuantity } });
  const candidateInput = {
    domain: "profile-quotient",
    nodes: [{ ref: profileHash }],
    edges: []
  };
  const context = {
    sourcePopulationHash,
    elements: memberElementIds.map((elementId, index) => ({
      elementId,
      invariants: {
        length: index === 0
          ? sourceQuantity
          : quantity(
              100,
              "cm",
              "length",
              { absolute: 0.1 },
              ["consensus-evidence"]
            )
      }
    })),
    profileClasses: [{ profileHash, members: [...memberElementIds].reverse() }]
  };
  const binding = bindPredicateNumericPolicy(compiled, precision());
  const evaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidateInput,
    { ...options(), invariantContext: context }
  );
  const resolution = evaluation.witnesses[0].invariants[0];

  assert.equal(evaluation.outcome, "pass");
  assert.equal(resolution.profileHash, profileHash);
  assert.equal(resolution.elementId, undefined);
  assert.deepEqual(resolution.memberElementIds, memberElementIds);
  assert.equal(resolution.consensusPolicy, "identical-normalized-quantity-v1");
  assert.deepEqual(resolution.quantity, evaluation.witnesses[0].left.quantity);

  const reordered = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidateInput,
    {
      ...options(),
      invariantContext: {
        ...context,
        elements: [...context.elements].reverse(),
        profileClasses: [{ profileHash, members: [...memberElementIds] }]
      }
    }
  );
  assert.equal(reordered.evaluationHash, evaluation.evaluationHash);

  const disagreement = canonicalClone(context);
  disagreement.elements[1].invariants.length = quantity(
    1.1,
    "m",
    "length",
    { absolute: 0.001 },
    ["consensus-evidence"]
  );
  const disagreementEvaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidateInput,
    { ...options(), invariantContext: disagreement }
  );
  assert.equal(disagreementEvaluation.outcome, "indeterminate");
  assert.equal(
    disagreementEvaluation.witnesses[0].invariantFailures[0].reason,
    "profile-invariant-member-values-disagree"
  );
  assert.equal(
    disagreementEvaluation.witnesses[0]
      .invariantFailures[0].details.disagreeingElementIds[0],
    memberElementIds[1]
  );

  const evidenceDisagreement = canonicalClone(context);
  evidenceDisagreement.elements[1].invariants.length.provenance.evidence = [
    "different-evidence"
  ];
  const evidenceDisagreementEvaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidateInput,
    { ...options(), invariantContext: evidenceDisagreement }
  );
  assert.equal(evidenceDisagreementEvaluation.outcome, "indeterminate");
  assert.equal(
    evidenceDisagreementEvaluation.witnesses[0].invariantFailures[0].reason,
    "profile-invariant-member-values-disagree"
  );

  const missing = canonicalClone(context);
  missing.elements[1].invariants = {};
  const missingEvaluation = evaluateLocalPredicatePlan(
    compiled,
    binding,
    candidateInput,
    { ...options(), invariantContext: missing }
  );
  assert.equal(missingEvaluation.outcome, "indeterminate");
  assert.equal(
    missingEvaluation.witnesses[0].invariantFailures[0].reason,
    "profile-invariant-member-values-missing"
  );
  assert.equal(
    missingEvaluation.witnesses[0].invariantFailures[0]
      .details.missingElementIds[0],
    memberElementIds[1]
  );

  const invalidMemberUnit = canonicalClone(context);
  invalidMemberUnit.elements[1].invariants.length = quantity(
    1,
    "s",
    "length",
    { absolute: 0.001 },
    ["consensus-evidence"]
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      binding,
      candidateInput,
      { ...options(), invariantContext: invalidMemberUnit }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_UNIT_MISMATCH" &&
      error.details.elementId === memberElementIds[1]
  );

  const invalidMemberSemantic = canonicalClone(context);
  invalidMemberSemantic.elements[1].invariants.length = quantity(
    1,
    "m",
    "width",
    { absolute: 0.001 },
    ["consensus-evidence"]
  );
  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      binding,
      candidateInput,
      { ...options(), invariantContext: invalidMemberSemantic }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_SEMANTIC_MISMATCH" &&
      error.details.elementId === memberElementIds[1]
  );

  assert.throws(
    () => evaluateLocalPredicatePlan(
      compiled,
      binding,
      candidateInput,
      {
        ...options(),
        invariantContext: {
          sourcePopulationHash: context.sourcePopulationHash,
          elements: context.elements
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID"
  );
});

test("profile invariant arithmetic means bind precision and conservative Quantity uncertainty", () => {
  const sourcePopulationHash = `sha256:${"d".repeat(64)}`;
  const profileHash = `sha256:${"8".repeat(64)}`;
  const memberElementIds = [
    `sha256:${"1".repeat(64)}`,
    `sha256:${"2".repeat(64)}`,
    `sha256:${"3".repeat(64)}`
  ];
  const candidateInput = {
    domain: "profile-quotient",
    nodes: [{ ref: profileHash }],
    edges: []
  };
  const numericPlan = plan({
    op: "compare",
    left: {
      kind: "invariant",
      name: "score",
      profileAggregation: "arithmetic-mean-conservative-v1"
    },
    comparator: "eq",
    right: { kind: "constant", value: 1.666667 }
  }, { invariants: { score: { kind: "number" } } });
  const numericBinding = bindPredicateNumericPolicy(numericPlan, precision());
  const numeric = evaluateLocalPredicatePlan(
    numericPlan,
    numericBinding,
    candidateInput,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash,
        elements: memberElementIds.map((elementId, index) => ({
          elementId,
          invariants: { score: [1, 2, 2][index] }
        })),
        profileClasses: [{ profileHash, members: [...memberElementIds].reverse() }]
      }
    }
  );
  const numericResolution = numeric.witnesses[0].invariants[0];

  assert.equal(numeric.outcome, "pass");
  assert.equal(numeric.witnesses[0].left.unrounded.canonical, "1.666667");
  assert.equal(numeric.witnesses[0].left.exact, false);
  assert.equal(numericResolution.value, 1.666667);
  assert.equal(numericResolution.consensusPolicy, undefined);
  assert.equal(
    numericResolution.aggregation.policy,
    "arithmetic-mean-conservative-v1"
  );
  assert.equal(numericResolution.aggregation.memberCount, 3);
  assert.equal(numericResolution.aggregation.divisionExact, false);
  assert.deepEqual(numericResolution.memberElementIds, memberElementIds);
  assert.ok(numericBinding.operations.some((entry) =>
    entry.operation === "profile-invariant-arithmetic-mean" &&
    entry.policyRefs.join(",") === "arithmetic,precision"
  ));

  const quantityDescriptor = quantity(0, "m", "length");
  const quantityPlan = plan({
    op: "compare",
    left: {
      kind: "invariant",
      name: "length",
      profileAggregation: "arithmetic-mean-conservative-v1"
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(2, "m", "length") }
  }, { invariants: { length: quantityDescriptor } });
  const quantityEvaluation = evaluateLocalPredicatePlan(
    quantityPlan,
    bindPredicateNumericPolicy(quantityPlan, precision()),
    candidateInput,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash,
        elements: memberElementIds.map((elementId, index) => ({
          elementId,
          invariants: {
            length: quantity(
              [1, 2, 3][index],
              "m",
              "length",
              { absolute: [0.1, 0.2, 0.3][index] },
              [`evidence-${index}`]
            )
          }
        })),
        profileClasses: [{ profileHash, members: [...memberElementIds] }]
      }
    }
  );
  const quantityResolution = quantityEvaluation.witnesses[0].invariants[0];

  assert.equal(quantityEvaluation.outcome, "pass");
  assert.equal(quantityResolution.quantity.value, 2);
  assert.equal(quantityResolution.quantity.tolerance.absolute, 0.2);
  assert.deepEqual(quantityResolution.quantity.provenance, {
    kind: "computed",
    method: "profile-invariant-arithmetic-mean-v1",
    evidence: ["evidence-0", "evidence-1", "evidence-2"]
  });
  assert.equal(
    quantityResolution.aggregation.uncertaintyPolicy,
    "mean-effective-bounds-plus-rounding-v1"
  );
  assert.equal(
    quantityResolution.aggregation.effectiveAbsoluteTolerance.canonical,
    "0.2"
  );

  const replay = evaluateLocalPredicatePlan(
    quantityPlan,
    bindPredicateNumericPolicy(quantityPlan, precision()),
    candidateInput,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash,
        elements: [...memberElementIds].reverse().map((elementId) => ({
          elementId,
          invariants: {
            length: quantity(
              memberElementIds.indexOf(elementId) + 1,
              "m",
              "length",
              { absolute: (memberElementIds.indexOf(elementId) + 1) / 10 },
              [`evidence-${memberElementIds.indexOf(elementId)}`]
            )
          }
        })),
        profileClasses: [{ profileHash, members: [...memberElementIds].reverse() }]
      }
    }
  );
  assert.equal(replay.evaluationHash, quantityEvaluation.evaluationHash);
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
  assert.equal(witness.left.unrounded.canonical, "0.01");
  assert.equal(witness.right.unrounded.canonical, "0.01");
  assert.equal(witness.left.exact, true);
  assert.equal(witness.right.exact, true);
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

test("scalar invariants resolve exactly in element and profile domains", () => {
  const invariantPlan = plan({
    op: "compare",
    left: {
      kind: "add",
      terms: [
        { kind: "invariant", name: "score" },
        { kind: "constant", value: 0.5 }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: 1.5 }
  }, { invariants: { score: { kind: "number" } } });
  const invariantBinding = bindPredicateNumericPolicy(invariantPlan, precision());
  const singleton = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
    edges: []
  };
  const sourcePopulationHash = `sha256:${"d".repeat(64)}`;
  const invariantContext = {
    sourcePopulationHash,
    elements: [{ elementId: singleton.nodes[0].ref, invariants: { score: 1 } }]
  };
  const numericEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    invariantBinding,
    singleton,
    { ...options(), invariantContext }
  );
  assert.equal(numericEvaluation.outcome, "pass");
  assert.equal(numericEvaluation.witnesses[0].left.unrounded.canonical, "1.5");
  assert.deepEqual(numericEvaluation.witnesses[0].invariants, [{
    expressionPath: "$.left.terms[1]",
    name: "score",
    canonicalNode: 0,
    elementId: singleton.nodes[0].ref,
    valueKind: "number",
    value: 1
  }]);

  for (const [kind, value] of [
    ["string", "stable"],
    ["boolean", true],
    ["null", null]
  ]) {
    const scalarPlan = plan({
      op: "compare",
      left: { kind: "invariant", name: "label" },
      comparator: "eq",
      right: { kind: "constant", value }
    }, { invariants: { label: { kind } } });
    const scalarEvaluation = evaluateLocalPredicatePlan(
      scalarPlan,
      bindPredicateNumericPolicy(scalarPlan, precision()),
      singleton,
      {
        ...options(),
        invariantContext: {
          sourcePopulationHash,
          elements: [{
            elementId: singleton.nodes[0].ref,
            invariants: { label: value }
          }]
        }
      }
    );
    assert.equal(scalarEvaluation.outcome, "pass");
    assert.equal(scalarEvaluation.witnesses[0].left.kind, kind);
    assert.deepEqual(scalarEvaluation.witnesses[0].invariants[0], {
      expressionPath: "$.left",
      name: "label",
      canonicalNode: 0,
      elementId: singleton.nodes[0].ref,
      valueKind: kind,
      value
    });
  }

  const profileHash = `sha256:${"9".repeat(64)}`;
  const secondElementId = `sha256:${"b".repeat(64)}`;
  const profileCandidate = {
    domain: "profile-quotient",
    nodes: [{ ref: profileHash }],
    edges: []
  };
  const profileEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    invariantBinding,
    profileCandidate,
    {
      ...options(),
      invariantContext: {
        sourcePopulationHash,
        elements: [singleton.nodes[0].ref, secondElementId].map((elementId) => ({
          elementId,
          invariants: { score: 1 }
        })),
        profileClasses: [{
          profileHash,
          members: [secondElementId, singleton.nodes[0].ref]
        }]
      }
    }
  );
  assert.equal(profileEvaluation.outcome, "pass");
  assert.equal(profileEvaluation.witnesses[0].invariants[0].valueKind, "number");
  assert.equal(
    profileEvaluation.witnesses[0].invariants[0].consensusPolicy,
    "identical-normalized-scalar-v1"
  );
  assert.deepEqual(
    profileEvaluation.witnesses[0].invariants[0].memberElementIds,
    [singleton.nodes[0].ref, secondElementId]
  );

  assert.throws(
    () => evaluateLocalPredicatePlan(
      invariantPlan,
      invariantBinding,
      singleton,
      {
        ...options(),
        invariantContext: {
          sourcePopulationHash,
          elements: [{
            elementId: singleton.nodes[0].ref,
            invariants: { score: "1" }
          }]
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID" &&
      error.details.expectedKind === "number"
  );

  const stringPlan = plan({
    op: "compare",
    left: { kind: "invariant", name: "label" },
    comparator: "eq",
    right: { kind: "constant", value: "stable" }
  }, { invariants: { label: { kind: "string" } } });
  assert.throws(
    () => evaluateLocalPredicatePlan(
      stringPlan,
      bindPredicateNumericPolicy(stringPlan, precision()),
      singleton,
      {
        ...options(),
        invariantContext: {
          sourcePopulationHash,
          elements: [{
            elementId: singleton.nodes[0].ref,
            invariants: { label: "x".repeat(1_025) }
          }]
        }
      }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID" &&
      error.details.maximumLength === 1_024 &&
      error.details.actualLength === 1_025
  );
});

test("explicit-semantic Quantity products propagate conservative intervals", () => {
  const productPlan = plan({
    op: "compare",
    left: {
      kind: "multiply",
      resultSemantic: "work energy",
      factors: [
        {
          kind: "constant",
          value: quantity(2, "N", "force", { absolute: 0.1 }, ["force-evidence"])
        },
        {
          kind: "constant",
          value: quantity(3, "m", "length", { absolute: 0.2 }, ["length-evidence"])
        }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(6, "J", "work energy") }
  });
  const evaluation = evaluateLocalPredicatePlan(
    productPlan,
    bindPredicateNumericPolicy(productPlan, precision()),
    candidate(),
    options()
  );
  const left = evaluation.witnesses[0].left;

  assert.equal(evaluation.outcome, "pass");
  assert.equal(left.unrounded.canonical, "6");
  assert.equal(left.quantity.unit, "kg*m^2*s^-2");
  assert.equal(left.quantity.semantic, "work energy");
  assert.equal(left.quantity.tolerance.absolute, 0.72);
  assert.deepEqual(left.quantity.provenance, {
    kind: "computed",
    method: "local-quantity-product-v1",
    evidence: ["force-evidence", "length-evidence"]
  });
});

test("implicit quantity products and stale bindings remain rejected", () => {
  const quantityArithmeticPlan = plan({
    op: "compare",
    left: {
      kind: "multiply",
      factors: [
        { kind: "constant", value: quantity(1, "m", "length") },
        { kind: "constant", value: quantity(1, "m", "length") }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(1, "m^2", "area") }
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
        entry.reason === "quantity-product-semantic-not-frozen"
      )
  );

  const quantitySumPlan = plan({
    op: "compare",
    left: {
      kind: "sum",
      attribute: "distance",
      set: { kind: "nodes", selector: { kind: "all" } }
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(0, "m", "length") }
  }, { attributes: { distance: { kind: "quantity", unit: "m" } } });
  const quantitySumBinding = bindPredicateNumericPolicy(quantitySumPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(
      quantitySumPlan,
      quantitySumBinding,
      candidate(),
      options()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "quantity-attribute-semantic-not-declared"
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
