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

function loaded(predicates = [], invariants = {}, perturbations = []) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-filter-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta", invariants),
      primitive("source-a", "alpha", invariants)
    ],
    predicates,
    perturbations
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

  assert.equal(result.evaluator, "package-candidate-filter-evaluator-v20");
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
    }),
    predicate("quantity-scale", {
      op: "compare",
      left: {
        kind: "multiply",
        factors: [
          {
            kind: "count",
            set: { kind: "nodes", selector: { kind: "all" } }
          },
          { kind: "constant", value: quantity(2, "m", "length") }
        ]
      },
      comparator: "eq",
      right: { kind: "constant", value: quantity(2, "m", "length") }
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
  assert.equal(result.predicateEvaluations[0].evaluation.evaluator, "local-predicate-evaluator-v19");
  assert.match(
    result.predicateEvaluations[0].evaluation.numericBindingHash,
    /^sha256:[a-f0-9]{64}$/
  );
  assert.equal(
    result.predicateEvaluations[0].evaluation.witnesses[0].left.unrounded.canonical,
    "1"
  );
  assert.equal(
    result.predicateEvaluations[1].evaluation.witnesses[0].left.quantity.provenance.method,
    "local-quantity-scale-v1"
  );
});

test("package filtering executes explicit-semantic general Quantity products", () => {
  const packageArtifact = loaded([predicate("work-energy", {
    op: "compare",
    left: {
      kind: "multiply",
      resultSemantic: "work energy",
      factors: [
        { kind: "constant", value: quantity(2, "N", "force") },
        { kind: "constant", value: quantity(3, "m", "length") }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(6, "J", "work energy") }
  })]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    exactCandidate(packageArtifact)
  );

  assert.equal(result.verdict, "eligible");
  assert.equal(
    result.predicateEvaluations[0].evaluation
      .witnesses[0].left.quantity.provenance.method,
    "local-quantity-product-v1"
  );
});

test("package filtering executes directed cycle-edge selections", () => {
  const packageArtifact = loadKernelPackage({
    schemaVersion: "1",
    id: "package-filter-cycle-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-c", "gamma"),
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ],
    predicates: [predicate("directed-cycle", {
      op: "compare",
      left: { kind: "count", set: { kind: "cycle", roles: ["support"] } },
      comparator: "eq",
      right: { kind: "constant", value: 3 }
    })]
  });
  const binding = createPackageCandidateBinding(packageArtifact, runConfig({
    budget: {
      maxNodes: 3,
      maxEdges: 3,
      maxCandidates: 1_000,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }));
  const refs = packageArtifact.normalized.primitives
    .map((entry) => entry.elementId)
    .sort();
  const result = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "element-exact",
    nodes: refs.map((ref) => ({ ref })),
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" },
      { from: 2, to: 0, role: "support" }
    ]
  });
  const selection = result.predicateEvaluations[0]
    .evaluation.witnesses[0].selections[0];

  assert.equal(result.verdict, "eligible");
  assert.equal(selection.setKind, "cycle");
  assert.equal(selection.count, 3);
  assert.equal(selection.cycleSelection, "directed-cycle-edge-union-v1");
});

test("package filtering resolves exact invariants and proves profile-wide consensus", () => {
  const packageArtifact = loadKernelPackage({
    schemaVersion: "1",
    id: "package-filter-invariant-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta", { length: quantity(2, "m", "length") }),
      primitive("source-a", "alpha", { length: quantity(3, "m", "length") })
    ],
    predicates: [predicate("element-invariant", {
      op: "compare",
      left: { kind: "invariant", name: "length" },
      comparator: "eq",
      right: { kind: "constant", value: quantity(3, "m", "length") }
    })]
  });
  const config = runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const binding = createPackageCandidateBinding(packageArtifact, config);
  const ref = packageArtifact.normalized.primitives
    .find((entry) => entry.sourceId === "source-a").elementId;
  const result = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "element-exact",
    nodes: [{ ref }],
    edges: []
  });
  const evaluation = result.predicateEvaluations[0].evaluation;

  assert.equal(result.verdict, "eligible");
  assert.equal(
    evaluation.invariantSourcePopulationHash,
    binding.sourcePopulation.population.populationHash
  );
  assert.deepEqual(evaluation.invariantNames, ["length"]);
  assert.equal(evaluation.witnesses[0].invariants[0].elementId, ref);
  assert.equal(evaluation.witnesses[0].invariants[0].name, "length");

  const profileBinding = createPackageCandidateBinding(packageArtifact, {
    ...config,
    countingDomain: "profile-quotient"
  });
  const profileHash = profileBinding.sourcePopulation.profileClasses[0].profileHash;
  const disagreementResult = evaluatePackageCandidateFilter(
    packageArtifact,
    profileBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: profileHash }],
      edges: []
    }
  );
  assert.equal(disagreementResult.verdict, "filter-indeterminate");
  assert.deepEqual(disagreementResult.counts, {
    evaluated: 1,
    passed: 0,
    failed: 0,
    indeterminate: 1
  });
  assert.deepEqual(disagreementResult.indeterminatePredicates, ["element-invariant"]);
  assert.equal(
    disagreementResult.predicateEvaluations[0]
      .evaluation.witnesses[0].invariantFailures[0].reason,
    "profile-invariant-member-values-disagree"
  );

  const consensusPackage = loaded(
    [predicate("profile-invariant", {
      op: "compare",
      left: { kind: "invariant", name: "length" },
      comparator: "eq",
      right: { kind: "constant", value: quantity(3, "m", "length") }
    })],
    { length: quantity(3, "m", "length") }
  );
  const consensusBinding = createPackageCandidateBinding(consensusPackage, {
    ...config,
    countingDomain: "profile-quotient"
  });
  const consensusClass = consensusBinding.sourcePopulation.profileClasses[0];
  const consensusResult = evaluatePackageCandidateFilter(
    consensusPackage,
    consensusBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: consensusClass.profileHash }],
      edges: []
    }
  );
  const consensusResolution =
    consensusResult.predicateEvaluations[0].evaluation.witnesses[0].invariants[0];
  assert.equal(consensusResult.verdict, "eligible");
  assert.equal(consensusResolution.profileHash, consensusClass.profileHash);
  assert.deepEqual(consensusResolution.memberElementIds, consensusClass.members);
  assert.equal(consensusResolution.consensusPolicy, "identical-normalized-quantity-v1");
});

test("package filtering executes explicit profile-invariant arithmetic means", () => {
  const packageArtifact = loadKernelPackage({
    schemaVersion: "1",
    id: "package-filter-profile-aggregation-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta", { score: 3 }),
      primitive("source-a", "alpha", { score: 2 })
    ],
    predicates: [predicate("mean-score", {
      op: "compare",
      left: {
        kind: "invariant",
        name: "score",
        profileAggregation: "arithmetic-mean-conservative-v1"
      },
      comparator: "eq",
      right: { kind: "constant", value: 2.5 }
    })]
  });
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
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: profileClass.profileHash }],
      edges: []
    }
  );
  const resolution = result.predicateEvaluations[0]
    .evaluation.witnesses[0].invariants[0];

  assert.equal(result.verdict, "eligible");
  assert.equal(resolution.value, 2.5);
  assert.equal(resolution.aggregation.policy, "arithmetic-mean-conservative-v1");
  assert.equal(resolution.aggregation.divisionExact, true);
  assert.deepEqual(resolution.memberElementIds, profileClass.members);
});

test("package filtering resolves profile invariants inside canonical substructures", () => {
  const packageArtifact = loadKernelPackage({
    schemaVersion: "1",
    id: "package-filter-nested-profile-invariant-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta", { score: 3 }),
      primitive("source-a", "alpha", { score: 2 })
    ],
    predicates: [predicate("nested-mean-score", {
      op: "irreducibleRemoval",
      removal: "node",
      predicate: {
        op: "compare",
        left: {
          kind: "invariant",
          name: "score",
          node: { kind: "canonical-index", index: 0 },
          profileAggregation: "arithmetic-mean-conservative-v1"
        },
        comparator: "eq",
        right: { kind: "constant", value: 2.5 }
      }
    })]
  });
  const binding = createPackageCandidateBinding(packageArtifact, runConfig({
    countingDomain: "profile-quotient"
  }));
  const profileClass = binding.sourcePopulation.profileClasses[0];
  const result = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "profile-quotient",
    nodes: [
      { ref: profileClass.profileHash },
      { ref: profileClass.profileHash }
    ],
    edges: [{ from: 0, to: 1, role: "support" }]
  });
  const witness = result.predicateEvaluations[0].evaluation.witnesses[0];

  assert.equal(result.verdict, "predicate-rejected");
  assert.equal(witness.outcome, "fail");
  assert.equal(witness.whole.outcome, "pass");
  assert.ok(witness.removals.every((entry) =>
    entry.status === "evaluated" &&
    entry.outcome === "pass" &&
    entry.witnesses[0].invariants[0].profileHash === profileClass.profileHash &&
    entry.witnesses[0].invariants[0].aggregation.policy ===
      "arithmetic-mean-conservative-v1"
  ));
});

test("package filtering executes package-authored scalar invariants and profile consensus", () => {
  const scalarPredicates = [
    predicate("number-invariant", {
      op: "compare",
      left: {
        kind: "add",
        terms: [
          { kind: "invariant", name: "score" },
          { kind: "constant", value: 2 }
        ]
      },
      comparator: "eq",
      right: { kind: "constant", value: 5 }
    }),
    predicate("string-invariant", {
      op: "compare",
      left: { kind: "invariant", name: "label" },
      comparator: "eq",
      right: { kind: "constant", value: "ready" }
    }),
    predicate("boolean-invariant", {
      op: "compare",
      left: { kind: "invariant", name: "enabled" },
      comparator: "eq",
      right: { kind: "constant", value: true }
    }),
    predicate("null-invariant", {
      op: "compare",
      left: { kind: "invariant", name: "marker" },
      comparator: "eq",
      right: { kind: "constant", value: null }
    })
  ];
  const invariants = {
    score: 3,
    label: "ready",
    enabled: true,
    marker: null
  };
  const packageArtifact = loaded(scalarPredicates, invariants);
  const config = runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const binding = createPackageCandidateBinding(packageArtifact, config);
  const ref = packageArtifact.normalized.primitives[0].elementId;
  const exact = evaluatePackageCandidateFilter(packageArtifact, binding, {
    domain: "element-exact",
    nodes: [{ ref }],
    edges: []
  });

  assert.equal(exact.verdict, "eligible");
  assert.deepEqual(exact.counts, {
    evaluated: 4,
    passed: 4,
    failed: 0,
    indeterminate: 0
  });
  const resolutions = exact.predicateEvaluations.map((entry) =>
    entry.evaluation.witnesses[0].invariants[0]
  );
  assert.deepEqual(
    resolutions.map((entry) => entry.valueKind).sort(),
    ["boolean", "null", "number", "string"]
  );

  const profileBinding = createPackageCandidateBinding(packageArtifact, {
    ...config,
    countingDomain: "profile-quotient"
  });
  const profileClass = profileBinding.sourcePopulation.profileClasses[0];
  const consensus = evaluatePackageCandidateFilter(
    packageArtifact,
    profileBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: profileClass.profileHash }],
      edges: []
    }
  );
  assert.equal(consensus.verdict, "eligible");
  assert.ok(consensus.predicateEvaluations.every((entry) =>
    entry.evaluation.witnesses[0].invariants[0].consensusPolicy ===
      "identical-normalized-scalar-v1"
  ));

  const disagreeing = loadKernelPackage({
    schemaVersion: "1",
    id: "package-filter-scalar-disagreement-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta", { state: "off" }),
      primitive("source-a", "alpha", { state: "on" })
    ],
    predicates: [predicate("state", {
      op: "compare",
      left: { kind: "invariant", name: "state" },
      comparator: "eq",
      right: { kind: "constant", value: "on" }
    })]
  });
  const disagreementBinding = createPackageCandidateBinding(disagreeing, {
    ...config,
    countingDomain: "profile-quotient"
  });
  const disagreementClass = disagreementBinding.sourcePopulation.profileClasses[0];
  const disagreement = evaluatePackageCandidateFilter(
    disagreeing,
    disagreementBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: disagreementClass.profileHash }],
      edges: []
    }
  );
  assert.equal(disagreement.verdict, "filter-indeterminate");
  assert.equal(
    disagreement.predicateEvaluations[0]
      .evaluation.witnesses[0].invariantFailures[0].reason,
    "profile-invariant-member-values-disagree"
  );
});

test("package filtering rejects predicate attributes absent from the bound universe", () => {
  const packageArtifact = loaded([
    predicate("balance-flux", {
      op: "balance",
      attribute: "flux",
      over: { kind: "edges" },
      tolerance: quantity(0.001, "1", "flux")
    }),
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
    (error) => {
      if (!(error instanceof KernelError) ||
        error.code !== "PACKAGE_CANDIDATE_FILTER_ATTRIBUTES_UNAVAILABLE") return false;
      const balance = error.details.unavailableAttributes
        .find((entry) => entry.predicateId === "balance-flux");
      const selector = error.details.unavailableAttributes
        .find((entry) => entry.predicateId === "missing-active");
      return balance?.attributes[0] === "flux" &&
        balance.nodeAttributes.length === 0 &&
        balance.edgeAttributes[0] === "flux" &&
        selector?.attributes[0] === "active" &&
        selector.nodeAttributes[0] === "active" &&
        selector.edgeAttributes.length === 0;
    }
  );
});

test("package filtering executes exhaustive minimality under the run policy", () => {
  const packageArtifact = loaded([
    predicate("minimal", {
      op: "minimal",
      predicate: { op: "connected" }
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
  const evaluation = result.predicateEvaluations[0].evaluation;

  assert.equal(result.verdict, "filter-indeterminate");
  assert.equal(evaluation.outcome, "indeterminate");
  assert.deepEqual(evaluation.substructurePolicy, binding.runConfig.substructurePolicy);
  assert.equal(evaluation.witnesses[0].operator, "minimal");
  assert.equal(evaluation.witnesses[0].attemptedSubstructures, 1);
  assert.equal(evaluation.witnesses[0].substructures[0].reason, "empty-excluded");
});

test("package filtering executes exact constituent novelty without a removal policy", () => {
  const packageArtifact = loaded([
    predicate("novel-support", {
      op: "novel",
      predicate: { op: "countRole", role: "support", min: 1 }
    })
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    exactCandidate(packageArtifact)
  );
  const evaluation = result.predicateEvaluations[0].evaluation;

  assert.equal(result.verdict, "eligible");
  assert.equal(evaluation.outcome, "pass");
  assert.equal(evaluation.substructurePolicy, undefined);
  assert.equal(evaluation.witnesses[0].operator, "novel");
  assert.equal(
    evaluation.witnesses[0].projection,
    "canonical-single-node-no-edge-v1"
  );
  assert.equal(evaluation.witnesses[0].evaluatedConstituents, 2);
  assert.ok(evaluation.witnesses[0].constituents.every((entry) =>
    entry.outcome === "fail" &&
    binding.sourcePopulation.elementIds.includes(entry.sourceElementId)
  ));
});

test("package filtering binds typed perturbations and executes stable-under", () => {
  const packageArtifact = loaded(
    [predicate("stable-connectivity", {
      op: "stableUnder",
      perturbation: "replace-support",
      threshold: 1,
      predicate: { op: "connected" }
    })],
    {},
    [{
      id: "replace-support",
      kind: "edge-role-replacement",
      replacements: [{ from: "support", to: "alternate" }]
    }]
  );
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    exactCandidate(packageArtifact)
  );
  const evaluation = result.predicateEvaluations[0].evaluation;
  const witness = evaluation.witnesses[0];

  assert.equal(result.verdict, "eligible");
  assert.equal(evaluation.outcome, "pass");
  assert.equal(evaluation.evaluator, "local-predicate-evaluator-v19");
  assert.ok(evaluation.perturbationContextHash.startsWith("sha256:"));
  assert.equal(witness.boundPerturbationContextHash, evaluation.perturbationContextHash);
  assert.equal(witness.perturbationKind, "edge-role-replacement");
  assert.equal(witness.validPerturbations, 1);
  assert.equal(witness.passedPerturbations, 1);
  assert.equal(witness.perturbations[0].toRole, "alternate");

  const registryOnly = loaded(
    [predicate("registry-only-stability", {
      op: "stableUnder",
      perturbation: "registry-only",
      threshold: 1,
      predicate: { op: "connected" }
    })],
    {},
    ["registry-only"]
  );
  const registryBinding = createPackageCandidateBinding(registryOnly, runConfig());
  assert.throws(
    () => evaluatePackageCandidateFilter(
      registryOnly,
      registryBinding,
      exactCandidate(registryOnly)
    ),
    (error) => error instanceof KernelError &&
      error.code ===
        "PACKAGE_CANDIDATE_FILTER_PERTURBATION_DEFINITION_UNAVAILABLE"
  );

  const unavailableNumericAttribute = loaded(
    [predicate("numeric-stability", {
      op: "stableUnder",
      perturbation: "displace-mass",
      threshold: 1,
      predicate: { op: "connected" }
    })],
    {},
    [{
      id: "displace-mass",
      kind: "numeric-attribute-displacement",
      target: "nodes",
      attribute: "mass",
      epsilon: 0.1
    }]
  );
  const unavailableNumericBinding = createPackageCandidateBinding(
    unavailableNumericAttribute,
    runConfig()
  );
  assert.throws(
    () => evaluatePackageCandidateFilter(
      unavailableNumericAttribute,
      unavailableNumericBinding,
      exactCandidate(unavailableNumericAttribute)
    ),
    (error) => error instanceof KernelError &&
      error.code ===
        "PACKAGE_CANDIDATE_FILTER_PERTURBATION_ATTRIBUTES_UNAVAILABLE"
  );
});

test("package filtering derives sampled stability streams from the bound run", () => {
  const packageArtifact = loaded(
    [predicate("sampled-stable-connectivity", {
      op: "stableUnder",
      perturbation: "sample-replacement",
      threshold: 0.4,
      predicate: { op: "connected" }
    })],
    {},
    [{
      id: "sample-replacement",
      kind: "edge-role-replacement",
      enumeration: "sampled-valid-single-edits-v1",
      replacements: [{ from: "support", to: "alternate" }]
    }]
  );
  const sampledConfig = runConfig();
  sampledConfig.budget.perturbationSamples = 32;
  const binding = createPackageCandidateBinding(packageArtifact, sampledConfig);
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    exactCandidate(packageArtifact)
  );
  const witness = result.predicateEvaluations[0].evaluation.witnesses[0];

  assert.equal(result.verdict, "eligible");
  assert.equal(witness.enumeration, "sampled-valid-single-edits-v1");
  assert.equal(witness.sampling.sampleSize, 32);
  assert.equal(witness.sampling.streamKey, binding.runConfigHash);
  assert.equal(witness.sampling.frameSize, 1);
  assert.equal(witness.validPerturbations, 32);
  assert.equal(witness.passedPerturbations, 32);
  assert.equal(witness.confidenceBounds.radius.canonical, "0.559017");
  assert.equal(witness.confidenceBounds.passing.lower.canonical, "0.440983");

  const noSampleBinding = createPackageCandidateBinding(
    packageArtifact,
    runConfig()
  );
  const noSample = evaluatePackageCandidateFilter(
    packageArtifact,
    noSampleBinding,
    exactCandidate(packageArtifact)
  );
  const noSampleWitness = noSample.predicateEvaluations[0].evaluation.witnesses[0];
  assert.equal(noSample.verdict, "filter-indeterminate");
  assert.equal(noSampleWitness.sampling.status, "budget-empty");
  assert.equal(noSampleWitness.confidenceBounds, null);
});

test("package filtering binds irreducible removal to the run substructure policy", () => {
  const packageArtifact = loaded([
    predicate("node-irreducible-connected", {
      op: "irreducibleRemoval",
      removal: "node",
      predicate: { op: "connected" }
    })
  ]);
  const binding = createPackageCandidateBinding(packageArtifact, runConfig());
  const result = evaluatePackageCandidateFilter(
    packageArtifact,
    binding,
    exactCandidate(packageArtifact)
  );
  const evaluation = result.predicateEvaluations[0].evaluation;

  assert.equal(result.verdict, "predicate-rejected");
  assert.equal(evaluation.outcome, "fail");
  assert.deepEqual(
    evaluation.substructurePolicy,
    binding.runConfig.substructurePolicy
  );
  assert.equal(evaluation.witnesses[0].operator, "irreducibleRemoval");
  assert.equal(evaluation.witnesses[0].evaluatedSubstructures, 2);
  assert.ok(evaluation.witnesses[0].removals.every((entry) =>
    entry.status === "evaluated" && entry.outcome === "pass"
  ));

  const mismatchedBinding = createPackageCandidateBinding(
    packageArtifact,
    runConfig({
      substructurePolicy: {
        id: "edge-removal-v1",
        remove: "edges",
        includeDisconnected: false,
        includeEmpty: false,
        retainIsolatedNodes: true
      }
    })
  );
  assert.throws(
    () => evaluatePackageCandidateFilter(
      packageArtifact,
      mismatchedBinding,
      exactCandidate(packageArtifact)
    ),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_LOCAL_SUBSTRUCTURE_POLICY_MISMATCH"
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
