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

test("local evaluation combines graph predicates with exact count arithmetic", () => {
  assert.deepEqual(LOCAL_PREDICATE_EVALUATION_LIMITS, {
    maxValueNodes: 10_000,
    maxSelectionWitnesses: 10_000,
    maxSelectedValues: 5_000
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

  assert.equal(evaluation.evaluator, "local-predicate-evaluator-v8");
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
  assert.throws(
    () => evaluateLocalPredicatePlan(
      cyclePlan,
      bindPredicateNumericPolicy(cyclePlan, precision()),
      attributed,
      attributedOptions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "cycle-set-selection-not-frozen"
      )
  );
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
  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      graph,
      { ...options(), invariantContext: context }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_NODE_AMBIGUOUS"
  );

  const missingContext = {
    ...singletonContext,
    elements: [{ elementId: singleton.nodes[0].ref, invariants: {} }]
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      singleton,
      { ...options(), invariantContext: missingContext }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_VALUE_UNAVAILABLE"
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

  const profileCandidate = {
    domain: "profile-quotient",
    nodes: [{ ref: singleton.nodes[0].ref }],
    edges: []
  };
  assert.throws(
    () => evaluateLocalPredicatePlan(
      directPlan,
      bindPredicateNumericPolicy(directPlan, precision()),
      profileCandidate,
      { ...options(), invariantContext: singletonContext }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_INVARIANT_DOMAIN_UNSUPPORTED" &&
      error.details.reason === "profile-invariant-consensus-not-frozen"
  );
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

test("scalar invariants, general quantity products, and stale bindings are rejected", () => {
  const invariantPlan = plan({
    op: "compare",
    left: { kind: "invariant", name: "score" },
    comparator: "eq",
    right: { kind: "constant", value: 1 }
  }, { invariants: { score: { kind: "number" } } });
  const invariantBinding = bindPredicateNumericPolicy(invariantPlan, precision());
  assert.throws(
    () => evaluateLocalPredicatePlan(invariantPlan, invariantBinding, candidate(), options()),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_FEATURE_UNSUPPORTED" &&
      error.details.unsupported.some((entry) =>
        entry.reason === "scalar-invariant-runtime-not-supported"
      )
  );

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
