import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  admitPackageSelectors,
  canonicalClone,
  constructPackageCohorts,
  createKernel,
  evaluatePackageCandidateCensus,
  evaluatePackageSelectorSensitivity,
  hashCanonical,
  loadKernelPackage,
  rankPackageSelector,
  verifyPackageSelectorAdmission
} from "../src/index.js";

function quantity(value, semantic) {
  return {
    value,
    unit: "m",
    tolerance: { absolute: 0 },
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

function functional(id, invariant) {
  return {
    id,
    expr: { kind: "invariant", name: invariant },
    coefficients: {},
    sensitivityCoefficients: [],
    result: {
      id: `${id}-result`,
      unit: "m",
      semantic: invariant,
      toleranceTarget: { absolute: 0 }
    },
    explain: `${id} fixture`,
    claimRefs: []
  };
}

function selector(id, functionalId, cohortRule = "all") {
  return {
    id,
    objective: "min",
    functional: functionalId,
    cohortRule,
    epsilon: quantity(0, "selector epsilon"),
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

function packageFixture({
  primitives,
  predicates = [],
  functionals = [],
  selectors = []
}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-selector-admission-fixture",
    version: "1.0.0",
    primitives,
    predicates,
    functionals,
    cohortRules: selectors.length === 0 ? [] : [{ id: "all", kind: "global" }],
    selectors
  });
}

function runConfig(indeterminateThreshold = 0) {
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
      perturbationSamples: 100,
      nullModelRuns: 0
    },
    seed: "package-selector-admission-fixture-v1",
    invariantPrecision: {
      id: "selector-admission-precision-v1",
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
      id: "selector-admission-substructure-v1",
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

function executionForSelector(loaded, config, census, selectorId) {
  const selectorDefinition = loaded.normalized.selectors
    .find((entry) => entry.id === selectorId);
  const partition = constructPackageCohorts(
    loaded,
    config,
    census,
    selectorDefinition.cohortRule
  );
  const ranking = rankPackageSelector(
    loaded,
    config,
    census,
    partition,
    selectorId
  );
  const sensitivity = evaluatePackageSelectorSensitivity(
    loaded,
    config,
    census,
    partition,
    ranking
  );
  return { selectorId, partition, ranking, sensitivity };
}

function pipeline(loaded, config) {
  const census = evaluatePackageCandidateCensus(loaded, config);
  const executions = loaded.normalized.selectors.map((entry) =>
    executionForSelector(loaded, config, census, entry.id)
  );
  return { census, executions };
}

function candidateIdForSource(loaded, census, sourceId) {
  const elementId = loaded.normalized.primitives
    .find((entry) => entry.sourceId === sourceId).elementId;
  return census.candidateEvaluations.find((filter) =>
    filter.formation.constituents[0].elementId === elementId
  ).formation.candidate.id;
}

test("multi-selector admission intersects complete semantic-extremum sets", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-a", { x: quantity(0, "x"), y: quantity(1, "y") }),
      primitive("source-b", { x: quantity(1, "x"), y: quantity(0, "y") }),
      primitive("source-c", { x: quantity(0, "x"), y: quantity(0, "y") })
    ],
    functionals: [functional("score-x", "x"), functional("score-y", "y")],
    selectors: [selector("minimum-x", "score-x"), selector("minimum-y", "score-y")]
  });
  const config = runConfig();
  const { census, executions } = pipeline(loaded, config);
  const admission = admitPackageSelectors(
    loaded,
    config,
    census,
    [...executions].reverse()
  );
  const selectedId = candidateIdForSource(loaded, census, "source-c");

  assert.deepEqual(admission.selectorOrder, ["minimum-x", "minimum-y"]);
  assert.deepEqual(admission.selectedCandidateIds, [selectedId]);
  assert.equal(admission.counts.eligibleCandidates, 3);
  assert.equal(admission.counts.selectorExcluded, 2);
  assert.equal(admission.counts.selectedCandidates, 1);
  assert.equal(admission.selectionRetention, 1 / 3);
  assert.equal(admission.overallRetention, 1 / 3);
  assert.equal(admission.status, "complete");
  assert.equal(admission.interpretation.status, "complete");
  assert.ok(admission.selectorCensus.every(
    (entry) => entry.counts.selected === 2 &&
      entry.counts.excluded === 1 &&
      entry.interpretation.status === "valid"
  ));
  const selected = admission.decisions.find(
    (decision) => decision.candidateId === selectedId
  );
  assert.equal(selected.outcome, "selected");
  assert.deepEqual(selected.selectedBy, ["minimum-x", "minimum-y"]);
  const { admissionHash, ...basis } = admission;
  assert.equal(
    admissionHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_SELECTOR_ADMISSION, basis)
  );
  assert.deepEqual(
    verifyPackageSelectorAdmission(
      admission,
      loaded,
      config,
      census,
      executions
    ),
    admission
  );
});

test("identity admission retains every locally eligible candidate without synthetic selectors", () => {
  const loaded = packageFixture({
    primitives: [primitive("source-a"), primitive("source-b")]
  });
  const config = runConfig();
  const { census } = pipeline(loaded, config);
  const admission = admitPackageSelectors(loaded, config, census, []);

  assert.deepEqual(admission.selectorOrder, []);
  assert.deepEqual(admission.selectorExecutions, []);
  assert.equal(admission.counts.selectedCandidates, 2);
  assert.equal(admission.selectionRetention, 1);
  assert.ok(admission.decisions.every(
    (decision) => decision.outcome === "selected" &&
      decision.selectorEvaluations.length === 0 &&
      decision.selectedBy.length === 0
  ));
  assert.throws(
    () => admitPackageSelectors(
      loaded,
      config,
      census,
      [],
      { maxFunctionalEvaluations: 0 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_ADMISSION_RANKING_LIMIT_INVALID"
  );
});

test("admission preserves predicate rejection, filter indeterminacy, and final ratios", () => {
  const rejectedLoaded = packageFixture({
    primitives: [primitive("source-rejected")],
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
  const config = runConfig();
  const { census: rejectedCensus } = pipeline(rejectedLoaded, config);
  const rejected = admitPackageSelectors(
    rejectedLoaded,
    config,
    rejectedCensus,
    []
  );
  assert.equal(rejected.counts.predicateRejected, 1);
  assert.equal(rejected.counts.selectedCandidates, 0);
  assert.equal(rejected.overallRetention, 0);
  assert.equal(rejected.status, "complete");
  assert.equal(rejected.decisions[0].outcome, "predicate-rejected");

  const uncertainLoaded = packageFixture({
    primitives: [primitive("source-uncertain")],
    predicates: [{
      id: "unresolved-node",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "degree",
        node: { kind: "canonical-index", index: 9 },
        min: 0
      },
      explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
  const { census: uncertainCensus } = pipeline(uncertainLoaded, config);
  const uncertain = admitPackageSelectors(
    uncertainLoaded,
    config,
    uncertainCensus,
    []
  );
  assert.equal(uncertain.counts.filterIndeterminate, 1);
  assert.equal(uncertain.counts.finalIndeterminate, 1);
  assert.equal(uncertain.indeterminateRatio, 1);
  assert.equal(uncertain.status, "indeterminate");
  assert.equal(uncertain.decisions[0].outcome, "filter-indeterminate");
});

test("definite selector exclusion precedes another selector's indeterminacy", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-a", { x: quantity(0, "x"), z: quantity(1, "z") }),
      primitive("source-b", { x: quantity(1, "x") })
    ],
    functionals: [functional("score-x", "x"), functional("score-z", "z")],
    selectors: [selector("minimum-x", "score-x"), selector("minimum-z", "score-z")]
  });
  const config = runConfig(1);
  const { census, executions } = pipeline(loaded, config);
  const admission = admitPackageSelectors(
    loaded,
    config,
    census,
    executions
  );
  const a = admission.decisions.find(
    (entry) => entry.candidateId === candidateIdForSource(loaded, census, "source-a")
  );
  const b = admission.decisions.find(
    (entry) => entry.candidateId === candidateIdForSource(loaded, census, "source-b")
  );

  assert.equal(a.outcome, "selection-indeterminate");
  assert.deepEqual(a.indeterminateBy, ["minimum-z"]);
  assert.equal(b.outcome, "selector-excluded");
  assert.deepEqual(b.excludedBy, ["minimum-x"]);
  assert.deepEqual(b.indeterminateBy, ["minimum-z"]);
  assert.equal(admission.counts.selectorExcluded, 1);
  assert.equal(admission.counts.selectionIndeterminate, 1);
  assert.equal(admission.interpretation.status, "complete");
});

test("fragile sensitivity marks variational interpretation without erasing base selection", () => {
  const selected = selector("minimum-linear", "linear-score");
  selected.sensitivity.amplitudes = [0.25];
  const loaded = packageFixture({
    primitives: [
      primitive("source-a", { x: quantity(0, "x"), y: quantity(1, "y") }),
      primitive("source-b", { x: quantity(1, "x"), y: quantity(0, "y") })
    ],
    functionals: [{
      id: "linear-score",
      expr: {
        kind: "add",
        terms: [
          { kind: "invariant", name: "x" },
          {
            kind: "multiply",
            factors: [
              { kind: "coefficient", name: "a" },
              { kind: "invariant", name: "y" }
            ]
          }
        ]
      },
      coefficients: {
        a: {
          value: 0.9,
          unit: "1",
          tolerance: { absolute: 0 },
          semantic: "coefficient a",
          provenance: { kind: "declared", evidence: [] }
        }
      },
      sensitivityCoefficients: ["a"],
      result: {
        id: "linear-score-result",
        unit: "m",
        semantic: "linear score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "fragile linear score",
      claimRefs: []
    }],
    selectors: [selected]
  });
  const config = runConfig();
  const { census, executions } = pipeline(loaded, config);
  const admission = admitPackageSelectors(
    loaded,
    config,
    census,
    executions
  );

  assert.equal(executions[0].sensitivity.verdict, "fragile");
  assert.equal(admission.selectorCensus[0].interpretation.status, "fragile");
  assert.deepEqual(
    admission.selectorCensus[0].interpretation.reasons,
    ["sensitivity-fragile"]
  );
  assert.equal(admission.counts.selectedCandidates, 1);
  assert.equal(admission.status, "complete");
});

test("admission rejects incomplete selector coverage and verifies exact replay", () => {
  const loaded = packageFixture({
    primitives: [primitive("source-a", { x: quantity(0, "x") })],
    functionals: [functional("score-x", "x")],
    selectors: [selector("minimum-x", "score-x")]
  });
  const config = runConfig();
  const { census, executions } = pipeline(loaded, config);
  const admission = admitPackageSelectors(
    loaded,
    config,
    census,
    executions
  );

  assert.throws(
    () => admitPackageSelectors(loaded, config, census, []),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_ADMISSION_SELECTOR_COVERAGE_MISMATCH"
  );
  assert.throws(
    () => admitPackageSelectors(
      loaded,
      config,
      census,
      [executions[0], executions[0]]
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_ADMISSION_SELECTOR_DUPLICATE"
  );
  const altered = canonicalClone(admission);
  altered.counts.selectedCandidates = 0;
  assert.throws(
    () => verifyPackageSelectorAdmission(
      altered,
      loaded,
      config,
      census,
      executions
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_ADMISSION_MISMATCH"
  );
});

test("the configured kernel exposes complete multi-selector admission", () => {
  const kernel = createKernel();
  assert.equal(typeof kernel.admitPackageSelectors, "function");
  assert.equal(typeof kernel.verifyPackageSelectorAdmission, "function");
  assert.ok(kernel.capabilities.implemented.includes("package-selector-admission"));
});
