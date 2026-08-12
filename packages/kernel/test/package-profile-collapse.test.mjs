import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  createKernel,
  detectPackageLevelBoundaries,
  hashCanonical,
  loadKernelPackage,
  testPackageProfileCollapse,
  verifyPackageLevelBoundaries,
  verifyPackageProfileCollapse
} from "../src/index.js";

function profile() {
  return {
    slots: [],
    invariantVector: [],
    precisionPolicy: "exact-structural-v1"
  };
}

function quantity(value) {
  return {
    value,
    unit: "1",
    tolerance: { absolute: 0 },
    semantic: "fixture invariant",
    provenance: { kind: "declared", evidence: [] }
  };
}

function packageFixture({ withSelectorMismatch = false } = {}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: `profile-collapse-${withSelectorMismatch ? "mismatch" : "equivalent"}`,
    version: "1.0.0",
    primitives: [1, 2].map((value) => ({
      sourceId: `source-${value}`,
      kind: "primitive",
      ontologyCoordinate: { level: 0 },
      axisProvenance: { ontologyLevel: "declared" },
      typeTags: ["source"],
      invariants: { q: quantity(value) },
      profile: profile(),
      claimRefs: []
    })),
    predicates: [],
    functionals: withSelectorMismatch ? [{
      id: "q-score",
      expr: {
        kind: "invariant",
        name: "q",
        node: { kind: "canonical-index", index: 0 }
      },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "q-result",
        unit: "1",
        semantic: "fixture invariant",
        toleranceTarget: { absolute: 0 }
      },
      explain: "Prefer the smallest q.",
      claimRefs: []
    }] : [],
    cohortRules: withSelectorMismatch
      ? [{ id: "all", kind: "global" }]
      : [],
    selectors: withSelectorMismatch ? [{
      id: "minimum-q",
      objective: "min",
      functional: "q-score",
      cohortRule: "all",
      epsilon: quantity(0),
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 1,
        robustTopKThreshold: 1
      },
      explain: { pass: "minimum", fail: "larger", indeterminate: "unknown" },
      claimRefs: []
    }] : [],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: profile(),
      derivedTypeTags: ["derived"],
      claimRefs: []
    }
  });
}

function runConfig({ intervals = true } = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth", "ontology-level"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "profile-collapse-v1",
    invariantPrecision: {
      id: "profile-collapse-precision-v1",
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
      id: "profile-collapse-substructure-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    ontologyTarget: { level: 1 },
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0,
    levelBoundaryPolicy: {
      enabled: true,
      ...(intervals
        ? { searchIntervals: [{ fromDepth: 1, toDepth: 1 }] }
        : {}),
      maximumCollapseError: 0,
      tieTolerance: 0
    }
  };
}

test("profile collapse projects exact multiplicity into one equivalent profile candidate", () => {
  const loaded = packageFixture();
  const config = runConfig();
  const report = testPackageProfileCollapse(loaded, config, 1);

  assert.equal(report.status, "complete");
  assert.equal(report.verdict, "equivalent");
  assert.equal(report.comparison.collapseError, 0);
  assert.equal(report.comparison.counts.elementExact, 1);
  assert.equal(report.comparison.counts.profileQuotient, 1);
  assert.equal(report.projectedCandidates.length, 1);
  assert.equal(
    report.projectedCandidates[0].elementExact.observations.length,
    2
  );
  assert.equal(
    report.projectedCandidates[0].elementExact.internallyConsistent,
    true
  );
  const { collapseHash, ...basis } = report;
  assert.equal(
    collapseHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_PROFILE_COLLAPSE, basis)
  );
  assert.deepEqual(
    verifyPackageProfileCollapse(report, loaded, config, 1),
    report
  );

  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  assert.equal(
    kernel.testProfileCollapse({
      package: loaded,
      config,
      targetDepth: 1
    }).collapseHash,
    report.collapseHash
  );
  assert.ok(kernel.capabilities.implemented.includes(
    "package-profile-collapse-testing"
  ));
  assert.ok(!kernel.capabilities.pending.includes("profile-collapse"));
});

test("collapse counterexamples and interval-boundary decisions remain explicit", () => {
  const loaded = packageFixture({ withSelectorMismatch: true });
  const config = runConfig();
  const collapse = testPackageProfileCollapse(loaded, config, 1);

  assert.equal(collapse.status, "complete");
  assert.equal(collapse.verdict, "counterexample");
  assert.equal(collapse.comparison.collapseError, 1);
  assert.equal(collapse.counterexample.kind, "element-exact-only");
  assert.equal(
    collapse.projectedCandidates[0].elementExact.internallyConsistent,
    false
  );

  const equivalent = packageFixture();
  const boundaries = detectPackageLevelBoundaries(equivalent, config, 1);
  assert.equal(boundaries.status, "complete");
  assert.deepEqual(boundaries.candidateMinimumDepths, [1]);
  assert.deepEqual(boundaries.detectedDepths, [1]);
  assert.deepEqual(boundaries.declaredDepths, [1]);
  assert.equal(boundaries.points[0].matchesDeclaration, true);
  const { boundaryHash, ...basis } = boundaries;
  assert.equal(
    boundaryHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_LEVEL_BOUNDARY_REPORT, basis)
  );
  assert.deepEqual(
    verifyPackageLevelBoundaries(boundaries, equivalent, config, 1),
    boundaries
  );

  const noIntervals = detectPackageLevelBoundaries(
    equivalent,
    runConfig({ intervals: false }),
    1
  );
  assert.deepEqual(noIntervals.candidateMinimumDepths, [1]);
  assert.deepEqual(noIntervals.detectedDepths, []);
  assert.equal(noIntervals.points[0].matchesDeclaration, false);

  const tampered = canonicalClone(boundaries);
  tampered.detectedDepths = [];
  assert.throws(
    () => verifyPackageLevelBoundaries(
      tampered,
      equivalent,
      config,
      1
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_BOUNDARY_MISMATCH"
  );
});

test("profile collapse and boundary detection reject incomplete fixpoint observations", () => {
  const loaded = packageFixture();
  const config = {
    ...runConfig(),
    boundedFixpoint: { enabled: true, maxIterations: 2 }
  };

  assert.throws(
    () => testPackageProfileCollapse(loaded, config, 1),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_PROFILE_COLLAPSE_FIXPOINT_UNAVAILABLE"
  );
  assert.throws(
    () => detectPackageLevelBoundaries(loaded, config, 1),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_BOUNDARY_FIXPOINT_UNAVAILABLE"
  );
});
