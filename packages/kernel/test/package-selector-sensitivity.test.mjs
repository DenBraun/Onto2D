import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  constructPackageCohorts,
  createKernel,
  evaluatePackageCandidateCensus,
  evaluatePackageSelectorSensitivity,
  hashCanonical,
  loadKernelPackage,
  rankPackageSelector,
  verifyPackageSelectorSensitivity
} from "../src/index.js";

function quantity(value, unit, semantic, absolute = 0, relative) {
  return {
    value,
    unit,
    tolerance: {
      absolute,
      ...(relative === undefined ? {} : { relative })
    },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function primitive(sourceId, invariants = {}) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [sourceId],
    invariants,
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function coefficient(name, value, absolute = 0, relative) {
  return [name, quantity(
    value,
    "1",
    `coefficient ${name}`,
    absolute,
    relative
  )];
}

function linearFunctional({
  coefficients = [coefficient("a", 0.2)],
  sensitivityCoefficients = coefficients.map(([name]) => name),
  toleranceTarget = 1
} = {}) {
  const coefficientTerms = coefficients.map(([name]) => ({
    kind: "multiply",
    factors: [
      { kind: "coefficient", name },
      { kind: "invariant", name: `weight-${name}` }
    ]
  }));
  return {
    id: "score",
    expr: {
      kind: "add",
      terms: [{ kind: "invariant", name: "offset" }, ...coefficientTerms]
    },
    coefficients: Object.fromEntries(coefficients),
    sensitivityCoefficients,
    result: {
      id: "score-result",
      unit: "m",
      semantic: "sensitivity score",
      toleranceTarget: { absolute: toleranceTarget }
    },
    explain: "linear sensitivity fixture",
    claimRefs: []
  };
}

function directCoefficientFunctional(absolute = 0.09) {
  return {
    id: "score",
    expr: { kind: "coefficient", name: "a" },
    coefficients: Object.fromEntries([coefficient("a", 1, absolute, 0.05)]),
    sensitivityCoefficients: ["a"],
    result: {
      id: "score-result",
      unit: "1",
      semantic: "sensitivity score",
      toleranceTarget: { absolute: 0.1 }
    },
    explain: "direct coefficient sensitivity fixture",
    claimRefs: []
  };
}

function selector({
  amplitudes = [0.1],
  sweep = "one-at-a-time",
  topK = 1,
  cohortRule = "all",
  robustLeaderSetThreshold = 0.9,
  robustTopKThreshold = 0.9,
  epsilonUnit = "m"
} = {}) {
  return {
    id: "minimum",
    objective: "min",
    functional: "score",
    cohortRule,
    epsilon: quantity(0, epsilonUnit, "selector epsilon"),
    tiePolicy: "retain-all",
    sensitivity: {
      amplitudes,
      sweep,
      topK,
      robustLeaderSetThreshold,
      robustTopKThreshold
    },
    explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
    claimRefs: []
  };
}

function packageFixture({
  primitives,
  functional = linearFunctional(),
  selected = selector(),
  cohortRules = [{ id: "all", kind: "global" }],
  predicates = []
}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-selector-sensitivity-fixture",
    version: "1.0.0",
    primitives,
    predicates,
    functionals: [functional],
    cohortRules,
    selectors: [selected]
  });
}

function runConfig(perturbationSamples = 100, indeterminateThreshold = 0) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10_000,
      perturbationSamples,
      nullModelRuns: 0
    },
    seed: "package-selector-sensitivity-fixture-v1",
    invariantPrecision: {
      id: "selector-sensitivity-precision-v1",
      decimalPlaces: 6,
      rounding: "half-even",
      summation: "exact-decimal"
    },
    graphPolicy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: [],
      structuralEdgeAttributes: []
    },
    substructurePolicy: {
      id: "selector-sensitivity-substructure-v1",
      remove: "nodes-and-edges",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold
  };
}

function linearPrimitive(sourceId, offset, weights, group) {
  return primitive(sourceId, {
    offset: quantity(offset, "m", "offset"),
    ...Object.fromEntries(Object.entries(weights).map(([name, value]) => [
      `weight-${name}`,
      quantity(value, "m", `weight ${name}`)
    ])),
    ...(group === undefined
      ? {}
      : { group: quantity(group, "1", "group") })
  });
}

function pipeline(loaded, config) {
  const census = evaluatePackageCandidateCensus(loaded, config);
  const ruleId = loaded.normalized.selectors[0].cohortRule;
  const partition = constructPackageCohorts(
    loaded,
    config,
    census,
    ruleId
  );
  const ranking = rankPackageSelector(
    loaded,
    config,
    census,
    partition,
    "minimum"
  );
  return { census, partition, ranking };
}

function sensitivity(loaded, config, options) {
  const { census, partition, ranking } = pipeline(loaded, config);
  return {
    census,
    partition,
    ranking,
    report: evaluatePackageSelectorSensitivity(
      loaded,
      config,
      census,
      partition,
      ranking,
      options
    )
  };
}

test("one-at-a-time sensitivity emits exact factors and distinguishes robust from fragile rankings", () => {
  const candidates = [
    linearPrimitive("source-a", 0, { a: 1 }),
    linearPrimitive("source-b", 1, { a: 0 })
  ];
  const robust = sensitivity(
    packageFixture({ primitives: candidates }),
    runConfig()
  ).report;
  const fragile = sensitivity(
    packageFixture({
      primitives: candidates,
      functional: linearFunctional({ coefficients: [coefficient("a", 0.9)] }),
      selected: selector({ amplitudes: [0.25] })
    }),
    runConfig()
  ).report;

  assert.equal(robust.status, "complete");
  assert.equal(robust.verdict, "robust");
  assert.deepEqual(
    robust.variants.map((variant) => variant.directions[0].direction),
    ["negative", "positive"]
  );
  assert.deepEqual(
    robust.variants.map((variant) => variant.directions[0].factor.canonical),
    ["0.9", "1.1"]
  );
  assert.equal(
    robust.variants[0].variantId,
    hashCanonical(HASH_DOMAINS.PACKAGE_SELECTOR_SENSITIVITY_VARIANT, {
      packageId: robust.packageId,
      rulesHash: robust.rulesHash,
      baseRankingHash: robust.baseRankingHash,
      selectorId: robust.selectorId,
      functionalId: robust.functionalId,
      amplitude: robust.variants[0].amplitude,
      sweep: robust.variants[0].sweep,
      directions: robust.variants[0].directions
    })
  );
  assert.equal(fragile.status, "complete");
  assert.equal(fragile.verdict, "fragile");
  assert.equal(fragile.points[0].leaderSetStability, 0.5);
  assert.equal(fragile.points[0].presentationLeaderStability, 0.5);
  assert.equal(fragile.points[0].topKStability, 0.5);
});

test("Cartesian sensitivity is complete and lexicographically ordered", () => {
  const loaded = packageFixture({
    primitives: [linearPrimitive("source-a", 0, { a: 1, b: 1 })],
    functional: linearFunctional({
      coefficients: [coefficient("b", 0.3), coefficient("a", 0.2)]
    }),
    selected: selector({ sweep: "cartesian" })
  });
  const report = sensitivity(loaded, runConfig()).report;

  assert.equal(report.execution.requiredVariants, 4);
  assert.equal(report.execution.requiredFunctionalEvaluations, 4);
  assert.deepEqual(report.sensitivityCoefficients, ["a", "b"]);
  assert.deepEqual(
    report.variants.map((variant) =>
      variant.directions.map((direction) => direction.direction)
    ),
    [
      ["negative", "negative"],
      ["negative", "positive"],
      ["positive", "negative"],
      ["positive", "positive"]
    ]
  );
});

test("perturbations scale absolute tolerance and preserve relative tolerance and provenance", () => {
  const loaded = packageFixture({
    primitives: [primitive("source-a")],
    functional: directCoefficientFunctional(),
    selected: selector({ amplitudes: [0.25], epsilonUnit: "1" })
  });
  const report = sensitivity(loaded, runConfig()).report;
  const [negative, positive] = report.variants;

  assert.equal(report.status, "indeterminate");
  assert.equal(report.verdict, null);
  assert.equal(negative.coefficients[0].perturbed.value, 0.75);
  assert.equal(negative.coefficients[0].perturbed.tolerance.absolute, 0.0675);
  assert.equal(positive.coefficients[0].perturbed.value, 1.25);
  assert.equal(positive.coefficients[0].perturbed.tolerance.absolute, 0.1125);
  assert.equal(positive.coefficients[0].perturbed.tolerance.relative, 0.05);
  assert.deepEqual(
    positive.coefficients[0].perturbed.provenance,
    positive.coefficients[0].base.provenance
  );
  assert.deepEqual(report.reasons, ["variant-ranking-indeterminate"]);
  assert.equal(report.points[0].leaderSetStability, null);
});

test("multiple cohorts keep the full variant-times-cohort denominator", () => {
  const loaded = packageFixture({
    primitives: [
      linearPrimitive("source-a", 0, { a: 1 }, 0),
      linearPrimitive("source-b", 1, { a: 0 }, 0),
      linearPrimitive("source-c", 0, { a: 1 }, 1),
      linearPrimitive("source-d", 1, { a: 0 }, 1)
    ],
    selected: selector({ cohortRule: "groups" }),
    cohortRules: [{
      id: "groups",
      kind: "profile-role",
      roleKey: [{ kind: "invariant", name: "group" }]
    }]
  });
  const report = sensitivity(loaded, runConfig()).report;

  assert.equal(report.execution.requiredVariants, 2);
  assert.equal(report.execution.requiredFunctionalEvaluations, 8);
  assert.equal(report.execution.requiredComparisons, 4);
  assert.equal(report.points[0].requiredComparisons, 4);
  assert.equal(report.points[0].comparableComparisons, 4);
});

test("empty coefficient and candidate populations are explicit not-applicable states", () => {
  const withoutCoefficients = packageFixture({
    primitives: [linearPrimitive("source-a", 0, {}, undefined)],
    functional: linearFunctional({
      coefficients: [],
      sensitivityCoefficients: []
    })
  });
  const noCoefficients = sensitivity(withoutCoefficients, runConfig()).report;
  assert.equal(noCoefficients.status, "not-applicable");
  assert.deepEqual(noCoefficients.reasons, ["no-sensitivity-coefficients"]);
  assert.equal(noCoefficients.execution.requiredVariants, 0);

  const rejected = packageFixture({
    primitives: [linearPrimitive("source-a", 0, { a: 1 })],
    predicates: [{
      id: "reject",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "compare",
        comparator: "gt",
        left: { kind: "constant", value: 0 },
        right: { kind: "constant", value: 1 }
      },
      explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
  const empty = sensitivity(rejected, runConfig()).report;
  assert.equal(empty.status, "not-applicable");
  assert.deepEqual(empty.reasons, ["no-ranked-cohorts"]);
  assert.equal(empty.execution.requiredFunctionalEvaluations, 0);
  assert.equal(empty.execution.evaluatedVariants, 0);
});

test("base indeterminacy and insufficient execution budgets fail closed before a partial sweep", () => {
  const unresolved = packageFixture({
    primitives: [
      primitive("source-a"),
      linearPrimitive("source-b", 0, { a: 1 })
    ]
  });
  const baseIndeterminate = sensitivity(unresolved, runConfig()).report;
  assert.equal(baseIndeterminate.status, "indeterminate");
  assert.deepEqual(baseIndeterminate.reasons, ["base-ranking-indeterminate"]);
  assert.equal(baseIndeterminate.execution.evaluatedVariants, 0);

  const loaded = packageFixture({
    primitives: [
      linearPrimitive("source-a", 0, { a: 1 }),
      linearPrimitive("source-b", 1, { a: 0 })
    ]
  });
  const runLimited = sensitivity(loaded, runConfig(1)).report;
  assert.equal(runLimited.status, "indeterminate");
  assert.deepEqual(runLimited.reasons, ["perturbation-budget-insufficient"]);
  assert.equal(runLimited.execution.evaluatedVariants, 0);

  const hardLimited = sensitivity(
    loaded,
    runConfig(),
    { maxSensitivityFunctionalEvaluations: 3 }
  ).report;
  assert.deepEqual(
    hardLimited.reasons,
    ["functional-evaluation-limit-exceeded"]
  );
  assert.equal(hardLimited.execution.requiredFunctionalEvaluations, 4);
  assert.equal(hardLimited.execution.usedFunctionalEvaluations, 0);
});

test("oversized Cartesian counts remain exact and fail closed without safe-integer overflow", () => {
  const coefficients = Array.from({ length: 54 }, (_, index) =>
    coefficient(`c-${String(index).padStart(2, "0")}`, 0.01)
  );
  const weights = Object.fromEntries(coefficients.map(([name]) => [name, 1]));
  const loaded = packageFixture({
    primitives: [linearPrimitive("source-a", 0, weights)],
    functional: linearFunctional({ coefficients }),
    selected: selector({ sweep: "cartesian" })
  });
  const report = sensitivity(loaded, runConfig()).report;

  assert.equal(report.status, "indeterminate");
  assert.deepEqual(report.reasons, ["variant-limit-exceeded"]);
  assert.equal(report.execution.requiredVariants, "18014398509481984");
  assert.equal(
    report.execution.requiredFunctionalEvaluations,
    "18014398509481984"
  );
  assert.equal(report.execution.evaluatedVariants, 0);
});

test("sensitivity reports are domain-hashed and require exact deterministic replay", () => {
  const loaded = packageFixture({
    primitives: [
      linearPrimitive("source-a", 0, { a: 1 }),
      linearPrimitive("source-b", 1, { a: 0 })
    ]
  });
  const config = runConfig();
  const { census, partition, ranking, report } = sensitivity(loaded, config);
  const { sensitivityHash, ...basis } = report;

  assert.equal(
    sensitivityHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_SELECTOR_SENSITIVITY, basis)
  );
  assert.deepEqual(
    verifyPackageSelectorSensitivity(
      report,
      loaded,
      config,
      census,
      partition,
      ranking
    ),
    report
  );
  const altered = canonicalClone(report);
  altered.points[0].topKMatches -= 1;
  assert.throws(
    () => verifyPackageSelectorSensitivity(
      altered,
      loaded,
      config,
      census,
      partition,
      ranking
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_SENSITIVITY_MISMATCH"
  );
});

test("the configured kernel exposes sensitivity evaluation and verification", () => {
  const kernel = createKernel();
  assert.equal(typeof kernel.evaluatePackageSelectorSensitivity, "function");
  assert.equal(typeof kernel.verifyPackageSelectorSensitivity, "function");
  assert.ok(
    kernel.capabilities.implemented.includes("package-selector-sensitivity")
  );
  assert.ok(!kernel.capabilities.pending.includes("sensitivity-analysis"));
});
