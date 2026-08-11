import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  createKernel,
  evaluatePackageCandidateCensus,
  hashCanonical,
  loadKernelPackage,
  verifyPackageCandidateCensus
} from "../src/index.js";

function quantity(value) {
  return {
    value,
    unit: "m",
    tolerance: { absolute: 0 },
    semantic: "length",
    provenance: { kind: "declared", evidence: [] }
  };
}

function primitive(sourceId, typeTag, invariants = {}) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [typeTag],
    invariants,
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
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

function loaded(predicates = []) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-census-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ],
    predicates
  });
}

function runConfig(overrides = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-census-fixture-v1",
    invariantPrecision: {
      id: "fixture-precision-v1",
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
      id: "node-removal-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0,
    ...overrides
  };
}

test("complete package census binds every canonical candidate and reproduces its hash", () => {
  const packageArtifact = loaded();
  const config = runConfig();
  const result = evaluatePackageCandidateCensus(packageArtifact, config);
  const candidateIds = result.candidateEvaluations.map((entry) =>
    entry.formation.candidate.id
  );
  const generatedIds = result.generation.enumeration.candidateStore.candidates
    .map((entry) => entry.candidateId);

  assert.equal(result.evaluator, "package-candidate-census-evaluator-v1");
  assert.equal(result.scope, "complete-local-filter-census-v1");
  assert.deepEqual(candidateIds, generatedIds);
  assert.deepEqual(candidateIds, [...candidateIds].sort());
  assert.equal(result.counts.evaluatedCandidates, generatedIds.length);
  assert.equal(result.counts.canonicalCandidates, generatedIds.length);
  assert.equal(result.counts.predicateRejected, 0);
  assert.equal(result.counts.filterIndeterminate, 0);
  assert.equal(result.counts.eligibleCandidates, generatedIds.length);
  assert.equal(result.booleanSelectivity, 1);
  assert.equal(result.indeterminateRatio, 0);
  assert.deepEqual(result.interpretation, { status: "valid", reasons: [] });
  assert.deepEqual(result.census, []);
  assert.ok(result.candidateEvaluations.every((entry) => entry.verdict === "eligible"));
  const { censusHash, ...basis } = result;
  assert.equal(hashCanonical(HASH_DOMAINS.PACKAGE_CANDIDATE_CENSUS, basis), censusHash);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.candidateEvaluations));
  assert.equal(
    verifyPackageCandidateCensus(result, packageArtifact, config).censusHash,
    result.censusHash
  );
  assert.equal(
    createKernel().verifyPackageCandidateCensus(result, packageArtifact, config).censusHash,
    result.censusHash
  );

  const altered = structuredClone(result);
  altered.counts.eligibleCandidates -= 1;
  const { censusHash: discardedHash, ...alteredBasis } = altered;
  assert.equal(discardedHash, result.censusHash);
  altered.censusHash = hashCanonical(
    HASH_DOMAINS.PACKAGE_CANDIDATE_CENSUS,
    alteredBasis
  );
  assert.notEqual(altered.censusHash, result.censusHash);
  assert.throws(
    () => verifyPackageCandidateCensus(altered, packageArtifact, config),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_CENSUS_MISMATCH" &&
      error.details.expectedCensusHash === result.censusHash &&
      error.details.actualCensusHash === altered.censusHash
  );
  assert.throws(
    () => verifyPackageCandidateCensus(undefined, packageArtifact, config),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_CENSUS_INVALID"
  );

  const profileResult = evaluatePackageCandidateCensus(
    loaded(),
    runConfig({ countingDomain: "profile-quotient" })
  );
  assert.equal(profileResult.countingDomain, "profile-quotient");
  assert.equal(
    profileResult.counts.evaluatedCandidates,
    profileResult.generation.enumeration.counts.canonicalCandidates
  );
  assert.ok(profileResult.candidateEvaluations.every((entry) =>
    entry.formation.candidate.domain === "profile-quotient"
  ));
});

test("predicate census distinguishes overlap, exclusive rejection, inertness, and dominance", () => {
  const result = evaluatePackageCandidateCensus(loaded([
    predicate("a-edge-required", { op: "countRole", role: "support", min: 1 }),
    predicate("b-always-fail", { op: "countRole", role: "absent", min: 1 }),
    predicate("c-inert", { op: "countRole", role: "absent", max: 0 })
  ]), runConfig());
  const evaluated = result.counts.evaluatedCandidates;
  const census = new Map(result.census.map((entry) => [entry.predicateId, entry]));

  assert.ok(evaluated > 0);
  assert.equal(result.counts.predicateRejected, evaluated);
  assert.equal(result.counts.filterIndeterminate, 0);
  assert.equal(result.counts.eligibleCandidates, 0);
  assert.equal(result.booleanSelectivity, 0);
  assert.equal(census.get("b-always-fail").failed, evaluated);
  assert.equal(census.get("b-always-fail").dominating, true);
  assert.ok(census.get("b-always-fail").exclusivelyRejected > 0);
  assert.ok(census.get("b-always-fail").exclusivelyRejected < evaluated);
  assert.ok(census.get("a-edge-required").failed > 0);
  assert.ok(census.get("a-edge-required").passed > 0);
  assert.equal(census.get("a-edge-required").exclusivelyRejected, 0);
  assert.equal(census.get("c-inert").passed, evaluated);
  assert.equal(census.get("c-inert").failed, 0);
  assert.equal(census.get("c-inert").inert, true);
  for (const entry of result.census) {
    assert.equal(
      entry.evaluated,
      entry.passed + entry.failed + entry.indeterminate
    );
  }

  const duplicatePredicate = structuredClone(result);
  duplicatePredicate.census.push({
    ...duplicatePredicate.census[0],
    evaluated: duplicatePredicate.census[0].evaluated + 1
  });
  assert.throws(
    () => verifyPackageCandidateCensus(
      duplicatePredicate,
      loaded([
        predicate("a-edge-required", { op: "countRole", role: "support", min: 1 }),
        predicate("b-always-fail", { op: "countRole", role: "absent", min: 1 }),
        predicate("c-inert", { op: "countRole", role: "absent", max: 0 })
      ]),
      runConfig()
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_CENSUS_MISMATCH"
  );

  const thresholdPackage = loadKernelPackage({
    schemaVersion: "1",
    id: "package-census-dominance-boundary",
    version: "1.0.0",
    primitives: Array.from({ length: 10 }, (_, index) =>
      primitive(
        `source-${index}`,
        `type-${index}`,
        { length: quantity(index === 9 ? 1 : 0) }
      )
    ),
    predicates: [predicate("nine-of-ten-fail", {
      op: "compare",
      left: { kind: "invariant", name: "length" },
      comparator: "eq",
      right: { kind: "constant", value: quantity(1) }
    })]
  });
  const thresholdResult = evaluatePackageCandidateCensus(
    thresholdPackage,
    runConfig({
      budget: {
        maxNodes: 1,
        maxEdges: 0,
        maxCandidates: 20,
        perturbationSamples: 0,
        nullModelRuns: 0
      }
    })
  );
  assert.equal(thresholdResult.census[0].evaluated, 10);
  assert.equal(thresholdResult.census[0].failed, 9);
  assert.equal(thresholdResult.census[0].dominating, true);
});

test("indeterminate thresholds are explicit and incomplete enumeration cannot form a census", () => {
  const packageArtifact = loaded([
    predicate("unresolved-node", {
      op: "degree",
      node: { kind: "canonical-index", index: 9 },
      min: 0
    })
  ]);
  const config = runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    indeterminateThreshold: 0.5
  });
  const result = evaluatePackageCandidateCensus(packageArtifact, config);

  assert.equal(result.indeterminateRatio, 1);
  assert.equal(result.booleanSelectivity, 0);
  assert.deepEqual(result.interpretation, {
    status: "indeterminate",
    reasons: ["indeterminate-ratio-exceeds-threshold"]
  });
  assert.equal(result.census[0].predicateId, "unresolved-node");
  assert.equal(result.census[0].indeterminate, result.counts.evaluatedCandidates);

  const boundary = evaluatePackageCandidateCensus(packageArtifact, {
    ...config,
    indeterminateThreshold: 1
  });
  assert.deepEqual(boundary.interpretation, { status: "valid", reasons: [] });

  assert.throws(
    () => evaluatePackageCandidateCensus(loaded(), runConfig(), {
      maxRawCandidates: 1
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_CENSUS_ENUMERATION_INCOMPLETE" &&
      error.details.status === "budget-exhausted"
  );
  assert.throws(
    () => evaluatePackageCandidateCensus(loaded(), runConfig({
      budget: {
        maxNodes: 2,
        maxEdges: 1,
        maxCandidates: 1,
        perturbationSamples: 0,
        nullModelRuns: 0
      }
    })),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_CENSUS_ENUMERATION_INCOMPLETE" &&
      error.details.exhausted.budget === "maxCandidates"
  );
});
