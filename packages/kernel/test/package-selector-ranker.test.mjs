import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  constructPackageCohorts,
  createKernel,
  evaluatePackageCandidateCensus,
  hashCanonical,
  loadKernelPackage,
  rankPackageSelector,
  verifyPackageSelectorRanking
} from "../src/index.js";

function quantity(value, semantic, absolute = 0) {
  return {
    value,
    unit: "m",
    tolerance: { absolute },
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

function functional(toleranceTarget = 0) {
  return {
    id: "score",
    expr: { kind: "invariant", name: "score" },
    coefficients: {},
    sensitivityCoefficients: [],
    result: {
      id: "score-result",
      unit: "m",
      semantic: "ranking score",
      toleranceTarget: { absolute: toleranceTarget }
    },
    explain: "ranking score fixture",
    claimRefs: []
  };
}

function selector(
  id,
  objective = "min",
  cohortRule = "all",
  epsilonValue = 0,
  epsilonTolerance = 0
) {
  return {
    id,
    objective,
    functional: "score",
    cohortRule,
    epsilon: quantity(
      epsilonValue,
      "selector epsilon boundary",
      epsilonTolerance
    ),
    tiePolicy: "retain-all",
    sensitivity: {
      amplitudes: [0.1],
      sweep: "one-at-a-time",
      topK: 1,
      robustLeaderSetThreshold: 0.9,
      robustTopKThreshold: 0.9
    },
    explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
    claimRefs: []
  };
}

function predicate(id, expr) {
  return {
    id,
    phase: "formation",
    monotoneViolation: false,
    referencesDepth: "below",
    expr,
    explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
    claimRefs: []
  };
}

function packageFixture({
  primitives,
  cohortRules = [{ id: "all", kind: "global" }],
  selectors = [selector("minimum")],
  predicates = [],
  toleranceTarget = 0
}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-selector-ranking-fixture",
    version: "1.0.0",
    primitives,
    predicates,
    functionals: [functional(toleranceTarget)],
    cohortRules,
    selectors
  });
}

function runConfig({ indeterminateThreshold = 0 } = {}) {
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
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-selector-ranking-fixture-v1",
    invariantPrecision: {
      id: "selector-ranking-precision-v1",
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
      id: "selector-ranking-substructure-v1",
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

function inputs(loaded, config, ruleId = "all") {
  const census = evaluatePackageCandidateCensus(loaded, config);
  const partition = constructPackageCohorts(loaded, config, census, ruleId);
  return { census, partition };
}

function rank(loaded, config, selectorId = "minimum", ruleId = "all", options) {
  const { census, partition } = inputs(loaded, config, ruleId);
  return {
    census,
    partition,
    ranking: rankPackageSelector(
      loaded,
      config,
      census,
      partition,
      selectorId,
      options
    )
  };
}

test("min and max selectors emit dense ranks, complete extrema, and oriented gaps", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-c", { score: quantity(3, "score") }),
      primitive("source-b", { score: quantity(1, "score") }),
      primitive("source-a", { score: quantity(1, "score") })
    ],
    selectors: [selector("minimum"), selector("maximum", "max")]
  });
  const config = runConfig();
  const { census, partition, ranking: minimum } = rank(loaded, config);
  const maximum = rankPackageSelector(
    loaded,
    config,
    census,
    partition,
    "maximum"
  );
  const minCohort = minimum.cohortRankings[0];
  const maxCohort = maximum.cohortRankings[0];

  assert.equal(minimum.status, "ranked");
  assert.deepEqual(minCohort.members.map((entry) => entry.rank), [1, 1, 2]);
  assert.deepEqual(minCohort.members.map((entry) => entry.evaluation.score.value), [1, 1, 3]);
  assert.equal(minCohort.semanticExtrema.length, 2);
  assert.equal(minCohort.degeneracy, 2);
  assert.equal(minCohort.degeneracyRatio, 2 / 3);
  assert.ok(Math.abs(minCohort.variationalSelectivity - 1 / 3) < Number.EPSILON);
  assert.equal(minCohort.gap.value, 0);
  assert.equal(maximum.status, "ranked");
  assert.deepEqual(maxCohort.members.map((entry) => entry.rank), [1, 2, 2]);
  assert.deepEqual(maxCohort.members.map((entry) => entry.evaluation.score.value), [3, 1, 1]);
  assert.equal(maxCohort.semanticExtrema.length, 1);
  assert.equal(maxCohort.gap.value, 2);
  const { rankingHash, ...basis } = minimum;
  assert.equal(
    rankingHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_SELECTOR_RANKING, basis)
  );
  assert.ok(Object.isFrozen(minimum));
});

test("dense score intervals close transitively without changing epsilon extrema", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-c", { score: quantity(3, "score", 1) }),
      primitive("source-b", { score: quantity(1.5, "score", 1) }),
      primitive("source-a", { score: quantity(0, "score", 1) })
    ],
    toleranceTarget: 1
  });
  const { ranking } = rank(loaded, runConfig());
  const cohort = ranking.cohortRankings[0];

  assert.deepEqual(cohort.members.map((entry) => entry.rank), [1, 1, 1]);
  assert.deepEqual(cohort.members.map((entry) => entry.semanticExtremum), [true, false, false]);
  assert.equal(cohort.gap.value, 1.5);
  assert.equal(cohort.gap.tolerance.absolute, 2);
  assert.ok(Math.abs(cohort.variationalSelectivity - 2 / 3) < Number.EPSILON);
});

test("epsilon tolerance controls one closed extremum boundary", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-b", { score: quantity(1.2, "score") }),
      primitive("source-a", { score: quantity(0, "score") })
    ],
    selectors: [selector("minimum", "min", "all", 1, 0.25)]
  });
  const { ranking } = rank(loaded, runConfig());
  const cohort = ranking.cohortRankings[0];

  assert.equal(cohort.degeneracy, 2);
  assert.equal(cohort.degeneracyRatio, 1);
  assert.equal(cohort.variationalSelectivity, 0);
  assert.ok(cohort.members.every((entry) => entry.semanticExtremum));
});

test("multiple complete cohorts produce the population-weighted variational summary", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-d", {
        group: quantity(1, "group"),
        score: quantity(3, "score")
      }),
      primitive("source-c", {
        group: quantity(1, "group"),
        score: quantity(2, "score")
      }),
      primitive("source-b", {
        group: quantity(0, "group"),
        score: quantity(1, "score")
      }),
      primitive("source-a", {
        group: quantity(0, "group"),
        score: quantity(1, "score")
      })
    ],
    cohortRules: [{
      id: "groups",
      kind: "profile-role",
      roleKey: [{ kind: "invariant", name: "group" }]
    }],
    selectors: [selector("minimum", "min", "groups")]
  });
  const { ranking } = rank(loaded, runConfig(), "minimum", "groups");

  assert.equal(ranking.cohortRankings.length, 2);
  assert.deepEqual(
    ranking.cohortRankings.map((entry) => entry.degeneracy).sort(),
    [1, 2]
  );
  assert.equal(ranking.counts.semanticExtrema, 3);
  assert.equal(ranking.variationalSummary, 0.25);
});

test("an indeterminate functional member remains in the cohort and nulls its metrics", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-b"),
      primitive("source-a", { score: quantity(1, "score") })
    ]
  });
  const { ranking } = rank(loaded, runConfig());
  const cohort = ranking.cohortRankings[0];

  assert.equal(ranking.status, "indeterminate");
  assert.equal(ranking.reason, "member-functional-indeterminate");
  assert.equal(ranking.counts.members, 2);
  assert.equal(ranking.counts.scoredMembers, 1);
  assert.equal(ranking.counts.indeterminateMembers, 1);
  assert.equal(ranking.variationalSummary, null);
  assert.equal(cohort.status, "indeterminate");
  assert.equal(cohort.members.length, 2);
  assert.equal(cohort.members[0].status, "ranked");
  assert.equal(cohort.members[0].semanticExtremum, null);
  assert.equal(cohort.members[1].status, "indeterminate");
  assert.equal(cohort.members[1].evaluation.reason, "invariant-value-unavailable");
  assert.equal(cohort.optimum, null);
  assert.equal(cohort.degeneracy, null);
  assert.equal(cohort.gap, null);
});

test("empty and source-indeterminate partitions remain explicit ranking states", () => {
  const rejected = packageFixture({
    primitives: [primitive("source-a", { score: quantity(1, "score") })],
    predicates: [predicate("reject", {
      op: "compare",
      comparator: "gt",
      left: { kind: "constant", value: 0 },
      right: { kind: "constant", value: 1 }
    })]
  });
  const empty = rank(rejected, runConfig()).ranking;
  assert.equal(empty.status, "empty");
  assert.equal(empty.reason, "no-eligible-candidates");
  assert.deepEqual(empty.cohortRankings, []);
  assert.equal(empty.execution.usedFunctionalEvaluations, 0);

  const uncertain = packageFixture({
    primitives: [
      primitive("source-b", { score: quantity(2, "score") }),
      primitive("source-a", { score: quantity(1, "score") })
    ],
    predicates: [predicate("requires-gate", {
      op: "degree",
      node: { kind: "canonical-index", index: 9 },
      min: 0
    })]
  });
  const sourceIndeterminate = rank(uncertain, runConfig()).ranking;
  assert.equal(sourceIndeterminate.status, "indeterminate");
  assert.equal(sourceIndeterminate.reason, "source-partition-indeterminate");
  assert.deepEqual(sourceIndeterminate.cohortRankings, []);
  assert.equal(sourceIndeterminate.execution.usedFunctionalEvaluations, 0);
});

test("ranking rejects rule drift and execution truncation, and verifies exact replay", () => {
  const primitives = [
    primitive("source-b", { score: quantity(2, "score") }),
    primitive("source-a", { score: quantity(1, "score") })
  ];
  const loaded = packageFixture({
    primitives,
    cohortRules: [
      { id: "all", kind: "global" },
      { id: "alone", kind: "singleton" }
    ]
  });
  const config = runConfig();
  const { census, partition } = inputs(loaded, config);
  const ranking = rankPackageSelector(
    loaded,
    config,
    census,
    partition,
    "minimum"
  );
  const execution = census.generation.binding.enumerationOptions;
  assert.equal(
    rankPackageSelector(
      loaded,
      config,
      census,
      partition,
      "minimum",
      {
        maxRawCandidates: execution.maxRawCandidates,
        maxDecorationStates: execution.maxDecorationStates,
        maxSearchStates: execution.canonicalizationLimits.maxSearchStates
      }
    ).rankingHash,
    ranking.rankingHash
  );
  assert.deepEqual(
    verifyPackageSelectorRanking(
      ranking,
      loaded,
      config,
      census,
      partition
    ),
    ranking
  );
  const altered = canonicalClone(ranking);
  altered.counts.semanticExtrema += 1;
  assert.throws(
    () => verifyPackageSelectorRanking(
      altered,
      loaded,
      config,
      census,
      partition
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_RANKING_MISMATCH"
  );
  const singleton = constructPackageCohorts(
    loaded,
    config,
    census,
    "alone"
  );
  assert.throws(
    () => rankPackageSelector(
      loaded,
      config,
      census,
      singleton,
      "minimum"
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_COHORT_RULE_MISMATCH"
  );
  assert.throws(
    () => rankPackageSelector(
      loaded,
      config,
      census,
      partition,
      "minimum",
      { maxFunctionalEvaluations: 1 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_EVALUATION_LIMIT"
  );

  const reordered = packageFixture({
    primitives: [...primitives].reverse(),
    cohortRules: [
      { id: "alone", kind: "singleton" },
      { id: "all", kind: "global" }
    ]
  });
  assert.equal(rank(reordered, config).ranking.rankingHash, ranking.rankingHash);
});

test("the configured kernel exposes complete selector ranking and verification", async () => {
  const loaded = packageFixture({
    primitives: [primitive("source-a", { score: quantity(1, "score") })]
  });
  const config = runConfig();
  const kernel = createKernel();
  const census = kernel.evaluatePackageCandidateCensus(loaded, config);
  const partition = kernel.constructPackageCohorts(
    loaded,
    config,
    census,
    "all"
  );
  const ranking = kernel.rankPackageSelector(
    loaded,
    config,
    census,
    partition,
    "minimum"
  );

  assert.equal(ranking.status, "ranked");
  assert.equal(ranking.cohortRankings[0].variationalSelectivity, 0);
  assert.deepEqual(
    kernel.verifyPackageSelectorRanking(
      ranking,
      loaded,
      config,
      census,
      partition
    ),
    ranking
  );
  assert.ok(kernel.capabilities.implemented.includes("package-selector-ranking"));
  assert.ok(!kernel.capabilities.pending.includes("functional-ranking"));
});
