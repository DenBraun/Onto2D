import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  KernelValidationError,
  canonicalClone,
  canonicalize,
  createPackageCandidateBinding,
  evaluatePackageCandidateFilter,
  hashCanonical,
  loadKernelPackage
} from "../src/index.js";

function primitive(sourceId, typeTag) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [typeTag],
    invariants: {},
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function quantity(value, unit, semantic) {
  return {
    value,
    unit,
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function predicate(id, expr, phase = "formation") {
  return {
    id,
    phase,
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
    id: "package-filter-fixture",
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
    seed: "package-filter-fixture-v1",
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

function exactCandidate(packageArtifact) {
  const refs = packageArtifact.normalized.primitives
    .map((entry) => entry.elementId)
    .sort();
  return {
    domain: "element-exact",
    nodes: refs.map((ref) => ({ ref })),
    edges: [{ from: 0, to: 1, role: "support" }]
  };
}

test("package filtering evaluates every predicate and gives failure precedence", () => {
  const packageArtifact = loaded([
    predicate("a-pass", { op: "countRole", role: "support", min: 1 }),
    predicate("b-fail", { op: "countRole", role: "absent", min: 1 }, "maintenance"),
    predicate("c-indeterminate", {
      op: "degree",
      node: { kind: "canonical-index", index: 9 },
      min: 0
    }, "termination")
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    exactCandidate(packageArtifact)
  );

  assert.equal(result.evaluator, "package-candidate-filter-evaluator-v2");
  assert.equal(result.verdict, "predicate-rejected");
  assert.deepEqual(result.counts, {
    evaluated: 3,
    passed: 1,
    failed: 1,
    indeterminate: 1
  });
  assert.deepEqual(result.passedPredicates, ["a-pass"]);
  assert.deepEqual(result.failedPredicates, ["b-fail"]);
  assert.deepEqual(result.indeterminatePredicates, ["c-indeterminate"]);
  assert.deepEqual(
    result.predicateEvaluations.map((entry) => entry.predicateId),
    ["a-pass", "b-fail", "c-indeterminate"]
  );
  assert.ok(result.predicateEvaluations.every((entry) =>
    entry.evaluation.candidateId === result.formation.candidate.id
  ));
  const { filterHash, ...basis } = result;
  assert.equal(hashCanonical(HASH_DOMAINS.PACKAGE_CANDIDATE_FILTER, basis), filterHash);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.predicateEvaluations));
});

test("profile-quotient filtering discloses deterministic representative resolution", () => {
  const packageArtifact = loaded([
    predicate("empty-edge-set", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig({
    countingDomain: "profile-quotient",
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const binding = createPackageCandidateBinding(packageArtifact, config);
  const profileClass = binding.sourcePopulation.profileClasses[0];
  const result = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "profile-quotient",
    nodes: [{ ref: profileClass.profileHash }],
    edges: []
  });

  assert.equal(result.verdict, "eligible");
  assert.deepEqual(result.counts, {
    evaluated: 1,
    passed: 1,
    failed: 0,
    indeterminate: 0
  });
  assert.equal(result.formation.targetDepth, 1);
  assert.equal(result.formation.constituents[0].resolution, "profile-representative");
  assert.equal(
    result.formation.constituents[0].elementId,
    profileClass.representativeElementId
  );
  assert.deepEqual(
    result.formation.constituents[0].profileClassMembers,
    profileClass.members
  );
});

test("candidate relabelling and edge order cannot change package filter identity", () => {
  const packageArtifact = loaded([
    predicate("connected", { op: "connected" })
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const candidate = exactCandidate(packageArtifact);
  const relabelled = {
    domain: candidate.domain,
    nodes: [...candidate.nodes].reverse(),
    edges: [{ from: 1, to: 0, role: "support" }]
  };

  const first = evaluatePackageCandidateFilter(packageArtifact, binding, candidate);
  const second = evaluatePackageCandidateFilter(packageArtifact, binding, relabelled);
  assert.equal(first.filterHash, second.filterHash);
  assert.equal(canonicalize(first), canonicalize(second));
});

test("filtering rejects stale bindings and candidates outside the bound universe", () => {
  const packageArtifact = loaded();
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const stale = canonicalClone(binding);
  stale.bindingHash = `sha256:${"f".repeat(64)}`;
  assert.throws(
    () => evaluatePackageCandidateFilter(packageArtifact, stale, exactCandidate(packageArtifact)),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_FILTER_BINDING_MISMATCH"
  );

  const unknownRef = exactCandidate(packageArtifact);
  unknownRef.nodes[0].ref = `sha256:${"e".repeat(64)}`;
  assert.throws(
    () => evaluatePackageCandidateFilter(packageArtifact, binding, unknownRef),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_FILTER_NODE_VARIANT_UNBOUND"
      )
  );

  const unknownRole = exactCandidate(packageArtifact);
  unknownRole.edges[0].role = "unbound";
  assert.throws(
    () => evaluatePackageCandidateFilter(packageArtifact, binding, unknownRole),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_FILTER_EDGE_VARIANT_UNBOUND"
      )
  );

  const reciprocalBinding = createPackageCandidateBinding(packageArtifact, runConfig({
    budget: {
      maxNodes: 2,
      maxEdges: 2,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }));
  const reciprocal = exactCandidate(packageArtifact);
  reciprocal.edges.push({ from: 1, to: 0, role: "support" });
  assert.throws(
    () => evaluatePackageCandidateFilter(packageArtifact, reciprocalBinding, reciprocal),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_FILTER_EDGE_GROUP_MULTIPLICITY_UNBOUND"
      )
  );
});

test("package filtering executes exact structural comparisons under the run numeric binding", () => {
  const packageArtifact = loaded([
    predicate("numeric", {
      op: "compare",
      left: {
        kind: "count",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      comparator: "eq",
      right: { kind: "constant", value: 1 }
    })
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }));
  const ref = packageArtifact.normalized.primitives[0].elementId;
  const result = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "element-exact",
    nodes: [{ ref }],
    edges: []
  });

  assert.equal(result.verdict, "eligible");
  assert.equal(result.predicateEvaluations[0].evaluation.evaluator, "local-predicate-evaluator-v1");
  assert.match(
    result.predicateEvaluations[0].evaluation.numericBindingHash,
    /^sha256:[a-f0-9]{64}$/
  );
  assert.equal(result.predicateEvaluations[0].evaluation.witnesses[0].left.exact.canonical, "1");
});

test("package filtering rejects selectors whose attributes are absent from the bound universe", () => {
  const packageArtifact = loaded([
    predicate("missing-active", {
      op: "compare",
      left: {
        kind: "count",
        set: {
          kind: "nodes",
          selector: { kind: "where", attribute: "active", equals: true }
        }
      },
      comparator: "eq",
      right: { kind: "constant", value: 0 }
    })
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }));
  const ref = packageArtifact.normalized.primitives[0].elementId;

  assert.throws(
    () => evaluatePackageCandidateFilter(packageArtifact, binding, {
      domain: "element-exact",
      nodes: [{ ref }],
      edges: []
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_FILTER_ATTRIBUTES_UNAVAILABLE" &&
      error.details.unavailableAttributes[0].predicateId === "missing-active" &&
      error.details.unavailableAttributes[0].attributes[0] === "active"
  );
});

test("unfrozen numeric predicates block the whole local filter artifact", () => {
  const packageArtifact = loaded([
    predicate("balance", {
      op: "balance",
      attribute: "flux",
      over: { kind: "edges" },
      tolerance: quantity(0.001, "1", "flux")
    })
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }));
  const ref = packageArtifact.normalized.primitives[0].elementId;

  assert.throws(
    () => evaluatePackageCandidateFilter(packageArtifact, binding, {
      domain: "element-exact",
      nodes: [{ ref }],
      edges: []
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_FILTER_PREDICATE_UNSUPPORTED" &&
      error.details.unsupported[0].features.some((entry) =>
        entry.feature === "balance" &&
        entry.reason === "derived-quantity-tolerance-propagation-not-frozen"
      )
  );
});

test("an empty top-level predicate set is locally eligible without synthetic admission", () => {
  const packageArtifact = loaded();
  const binding = createPackageCandidateBinding(packageArtifact, runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }));
  const ref = packageArtifact.normalized.primitives[0].elementId;
  const result = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "element-exact",
    nodes: [{ ref }],
    edges: []
  });

  assert.equal(result.verdict, "eligible");
  assert.deepEqual(result.counts, {
    evaluated: 0,
    passed: 0,
    failed: 0,
    indeterminate: 0
  });
  assert.deepEqual(result.predicateEvaluations, []);
  assert.deepEqual(result.passedPredicates, []);
});
