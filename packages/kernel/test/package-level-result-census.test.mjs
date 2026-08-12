import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  closePackageDepthLevel,
  closePackageLevel,
  createKernel,
  createPackageLevelResultCensus,
  hashCanonical,
  loadKernelPackage,
  verifyPackageLevelResultCensus
} from "../src/index.js";

function quantity(value, semantic = "score") {
  return {
    value,
    unit: "1",
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function loadedFixture({ reject = false } = {}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "level-result-census-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "result-census-source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: {},
      profile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }],
    predicates: reject ? [{
      id: "reject-singleton",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "compare",
        left: {
          kind: "count",
          set: { kind: "nodes", selector: { kind: "all" } }
        },
        comparator: "eq",
        right: { kind: "constant", value: 2 }
      },
      explain: { pass: "two nodes", fail: "not two nodes", indeterminate: "unknown" },
      claimRefs: []
    }] : [],
    functionals: [{
      id: "constant-score",
      expr: { kind: "constant", value: 0 },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "constant-score-result",
        unit: "1",
        semantic: "score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "constant conformance score",
      claimRefs: []
    }],
    cohortRules: [{ id: "all", kind: "global" }],
    selectors: [{
      id: "minimum-score",
      objective: "min",
      functional: "constant-score",
      cohortRule: "all",
      epsilon: quantity(0),
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
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [{
          role: "support",
          polarity: "sym",
          capacity: { min: 0, max: 1 }
        }],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      derivedTypeTags: ["derived"],
      claimRefs: []
    }
  });
}

function runConfig() {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "level-result-census-v1",
    invariantPrecision: {
      id: "level-result-census-precision-v1",
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
      id: "level-result-census-substructure-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
}

test("integrated level census reconciles every final ordinary-level metric", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const census = createPackageLevelResultCensus(loaded, config, level);

  assert.equal(census.targetDepth, 1);
  assert.equal(census.levelHash, level.levelHash);
  assert.equal(census.runHash, level.run.runHash);
  assert.equal(census.counts.canonicalCandidates, 1);
  assert.equal(census.counts.evaluatedCandidates, 1);
  assert.equal(census.counts.selectedCandidates, 1);
  assert.equal(census.counts.admittedElements, 1);
  assert.equal(census.selectivity.boolean, 1);
  assert.deepEqual(census.selectivity.variational, [{
    selectorId: "minimum-score",
    value: 0
  }]);
  assert.equal(census.selectorCensus[0].counts.selected, 1);
  assert.equal(census.interpretation.level.status, "complete");
  assert.equal(census.interpretation.selectors[0].status, "valid");
  assert.deepEqual(census.admittedElementIds, [
    level.artifacts.population.elements[0].id
  ]);

  const { resultCensusHash, ...basis } = census;
  assert.equal(
    resultCensusHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_LEVEL_RESULT_CENSUS, basis)
  );
  assert.equal(
    verifyPackageLevelResultCensus(census, loaded, config, level)
      .resultCensusHash,
    resultCensusHash
  );

  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  assert.ok(kernel.capabilities.implemented.includes("package-level-result-census"));
  assert.equal(
    kernel.createPackageLevelResultCensus(loaded, config, level).resultCensusHash,
    resultCensusHash
  );
  assert.equal(
    kernel.verifyPackageLevelResultCensus(census, loaded, config, level)
      .resultCensusHash,
    resultCensusHash
  );
});

test("depth-aware integrated census replays its exact prior-level chain", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level1 = closePackageLevel(loaded, config);
  const level2 = closePackageDepthLevel(loaded, config, [level1], 2);
  const census = createPackageLevelResultCensus(
    loaded,
    config,
    level2,
    [level1]
  );

  assert.equal(census.targetDepth, 2);
  assert.equal(census.counts.canonicalCandidates, 2);
  assert.equal(census.counts.evaluatedCandidates, 2);
  assert.equal(census.counts.selectedCandidates, 2);
  assert.equal(census.counts.admittedElements, 2);
  assert.equal(
    verifyPackageLevelResultCensus(
      census,
      loaded,
      config,
      level2,
      [level1]
    ).resultCensusHash,
    census.resultCensusHash
  );

  const tampered = structuredClone(census);
  tampered.counts.admittedElements = 0;
  assert.throws(
    () => verifyPackageLevelResultCensus(
      tampered,
      loaded,
      config,
      level2,
      [level1]
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_RESULT_CENSUS_MISMATCH"
  );
  assert.throws(
    () => createPackageLevelResultCensus(loaded, config, level2, []),
    (error) => error instanceof KernelError
  );
});

test("integrated census preserves an empty admitted result without losing evaluated counts", () => {
  const loaded = loadedFixture({ reject: true });
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const census = createPackageLevelResultCensus(loaded, config, level);

  assert.equal(level.status, "empty");
  assert.equal(census.counts.evaluatedCandidates, 1);
  assert.equal(census.counts.predicateRejected, 1);
  assert.equal(census.counts.eligibleCandidates, 0);
  assert.equal(census.counts.selectedCandidates, 0);
  assert.equal(census.counts.admittedElements, 0);
  assert.equal(census.selectivity.boolean, 0);
  assert.equal(census.selectivity.selectionRetention, null);
  assert.equal(census.selectivity.overallRetention, 0);
  assert.equal(census.interpretation.level.status, "empty");
  assert.equal(census.predicateCensus[0].exclusivelyRejected, 1);
});
