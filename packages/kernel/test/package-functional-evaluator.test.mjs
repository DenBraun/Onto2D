import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  canonicalize,
  createKernel,
  createPackageCandidateBinding,
  enumeratePackageCandidates,
  evaluatePackageCandidateFilter,
  evaluatePackageFunctional,
  hashCanonical,
  loadKernelPackage
} from "../src/index.js";

const ARTIFACT_HASH = `sha256:${"a".repeat(64)}`;

function evidence(id) {
  return {
    id,
    state: "package-operationalization",
    source: {
      path: `${id}.json`,
      mediaType: "application/json",
      schemaVersion: "1",
      bytes: 0,
      hash: ARTIFACT_HASH
    }
  };
}

function quantity(value, unit, semantic, absolute = 0, evidenceIds = []) {
  return {
    value,
    unit,
    tolerance: { absolute },
    semantic,
    provenance: { kind: "declared", evidence: evidenceIds }
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

function functional(
  id,
  expr,
  unit,
  semantic,
  toleranceTarget,
  coefficients = {}
) {
  return {
    id,
    expr,
    coefficients,
    sensitivityCoefficients: [],
    result: {
      id: `${id}-result`,
      unit,
      semantic,
      toleranceTarget
    },
    explain: `${id} fixture`,
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
  functionals,
  predicates = [],
  evidenceIds = [],
  candidateAttributes = []
}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-functional-fixture",
    version: "1.0.0",
    evidence: evidenceIds.map(evidence),
    primitives,
    predicates,
    functionals,
    candidateAttributes
  });
}

function runConfig({ domain = "element-exact", maxNodes = 1, maxEdges = 0 } = {}) {
  return {
    schemaVersion: "1",
    countingDomain: domain,
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes,
      maxEdges,
      maxCandidates: 10_000,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-functional-fixture-v1",
    invariantPrecision: {
      id: "functional-precision-v1",
      decimalPlaces: 1,
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
      id: "functional-substructure-v1",
      remove: "nodes-and-edges",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
}

function exactRef(loaded, sourceId) {
  return loaded.normalized.primitives
    .find((entry) => entry.sourceId === sourceId).elementId;
}

function eligibleExact(loaded, config, sourceId) {
  const binding = createPackageCandidateBinding(loaded, config);
  const filter = evaluatePackageCandidateFilter(loaded, binding, {
    domain: "element-exact",
    nodes: [{ ref: exactRef(loaded, sourceId) }],
    edges: []
  });
  assert.equal(filter.verdict, "eligible");
  return { binding, filter };
}

test("package functionals sum Quantity structural attributes with complete witnesses", () => {
  const loaded = packageFixture({
    evidenceIds: ["mass-evidence"],
    primitives: [primitive("attribute-source", "alpha")],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "constant-quantity-v1",
        value: quantity(1, "kg", "mass", 0.1, ["mass-evidence"])
      }
    }],
    functionals: [functional(
      "attribute-mass",
      {
        kind: "sum",
        attribute: "mass",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      "kg",
      "mass",
      { absolute: 0.1 }
    )]
  });
  const config = runConfig();
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  const generation = enumeratePackageCandidates(loaded, config);
  const candidate = generation.enumeration.candidateStore.candidates[0].candidate;
  const filter = evaluatePackageCandidateFilter(
    loaded,
    generation.binding,
    candidate
  );
  assert.equal(filter.verdict, "eligible");
  const result = evaluatePackageFunctional(
    loaded,
    generation.binding,
    filter,
    "attribute-mass"
  );
  assert.equal(result.status, "scored");
  assert.equal(result.score.value, 1);
  assert.equal(result.score.unit, "kg");
  assert.equal(result.score.tolerance.absolute, 0.1);
  assert.deepEqual(result.score.provenance.evidence, ["mass-evidence"]);
  assert.equal(result.diagnostic.unrounded.canonical, "1");
  assert.deepEqual(result.selections, [{
    expressionPath: "$",
    setKind: "nodes",
    count: 1,
    nodeIndexes: [0],
    attribute: "mass",
    valueKind: "quantity",
    summation: "exact-decimal",
    accumulationExact: true,
    quantityUnit: "kg",
    quantitySemantic: "mass",
    toleranceAggregation: "sum-effective-absolute-bounds-v1"
  }]);
});

test("package functionals sum scalar structural attributes in canonical selection order", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("scalar-attribute-a", "alpha", { mass: 0.1 }),
      primitive("scalar-attribute-b", "beta", { mass: 0.2 })
    ],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "element-invariant-scalar-v1",
        invariant: "mass"
      }
    }],
    functionals: [functional(
      "scalar-attribute-mass",
      {
        kind: "sum",
        attribute: "mass",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      "1",
      "scalar mass",
      { absolute: 0 }
    )]
  });
  const config = runConfig({ maxNodes: 2, maxEdges: 1 });
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  const generation = enumeratePackageCandidates(loaded, config);
  const candidate = generation.enumeration.candidateStore.candidates
    .map((entry) => entry.candidate)
    .find((entry) =>
      entry.nodes.length === 2 &&
      new Set(entry.nodes.map((node) => node.ref)).size === 2
    );
  assert.ok(candidate);
  const filter = evaluatePackageCandidateFilter(
    loaded,
    generation.binding,
    candidate
  );
  const result = evaluatePackageFunctional(
    loaded,
    generation.binding,
    filter,
    "scalar-attribute-mass"
  );

  assert.equal(result.status, "scored");
  assert.equal(result.score.value, 0.3);
  assert.equal(result.score.unit, "1");
  assert.equal(result.diagnostic.unrounded.canonical, "0.3");
  assert.equal(result.selections[0].valueKind, "number");
  assert.deepEqual(result.selections[0].nodeIndexes, [0, 1]);

  const compensatedConfig = runConfig({ maxNodes: 2, maxEdges: 1 });
  compensatedConfig.invariantPrecision.summation = "compensated-binary64";
  compensatedConfig.graphPolicy.structuralNodeAttributes = ["mass"];
  const compensatedGeneration = enumeratePackageCandidates(
    loaded,
    compensatedConfig
  );
  const compensatedCandidate = compensatedGeneration.enumeration.candidateStore
    .candidates
    .map((entry) => entry.candidate)
    .find((entry) =>
      entry.nodes.length === 2 &&
      new Set(entry.nodes.map((node) => node.ref)).size === 2
    );
  assert.ok(compensatedCandidate);
  const compensatedFilter = evaluatePackageCandidateFilter(
    loaded,
    compensatedGeneration.binding,
    compensatedCandidate
  );
  const compensatedResult = evaluatePackageFunctional(
    loaded,
    compensatedGeneration.binding,
    compensatedFilter,
    "scalar-attribute-mass"
  );
  assert.equal(compensatedResult.status, "scored");
  assert.equal(compensatedResult.score.value, 0.3);
  assert.equal(compensatedResult.diagnostic.exact, false);
  assert.equal(
    compensatedResult.selections[0].summation,
    "compensated-binary64"
  );
  assert.equal(compensatedResult.selections[0].accumulationExact, false);
});

test("package functionals evaluate coefficient/invariant addition with one result-boundary rounding", () => {
  const loaded = packageFixture({
    evidenceIds: ["coefficient-evidence", "invariant-evidence"],
    primitives: [primitive("source-a", "alpha", {
      length: quantity(2.25, "m", "length", 0.2, ["invariant-evidence"])
    })],
    functionals: [functional(
      "combined-length",
      {
        kind: "add",
        terms: [
          { kind: "coefficient", name: "offset" },
          { kind: "invariant", name: "length" }
        ]
      },
      "m",
      "combined length",
      { absolute: 0.3 },
      {
        offset: quantity(0.5, "m", "offset", 0.1, ["coefficient-evidence"])
      }
    )]
  });
  const { binding, filter } = eligibleExact(loaded, runConfig(), "source-a");
  const result = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "combined-length"
  );

  assert.equal(result.status, "scored");
  assert.equal(result.score.value, 2.8);
  assert.equal(result.score.unit, "m");
  assert.equal(result.score.semantic, "combined length");
  assert.equal(result.score.tolerance.absolute, 0.3);
  assert.deepEqual(result.score.provenance, {
    kind: "computed",
    method: "finite-functional-expression-v1",
    evidence: ["coefficient-evidence", "invariant-evidence"]
  });
  assert.equal(result.diagnostic.unrounded.canonical, "2.75");
  assert.equal(result.diagnostic.rounded.canonical, "2.8");
  assert.equal(result.diagnostic.effectiveAbsoluteTolerance.canonical, "0.3");
  assert.equal(result.diagnostic.toleranceTargetMet, true);
  assert.equal(result.coefficients[0].name, "offset");
  assert.equal(result.invariants[0].elementId, exactRef(loaded, "source-a"));
  const { evaluationHash, ...basis } = result;
  assert.equal(
    evaluationHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_FUNCTIONAL_EVALUATION, basis)
  );
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.score));
});

test("package functionals compose multiple Quantities with conservative interval products", () => {
  const loaded = packageFixture({
    evidenceIds: ["force-evidence", "length-evidence"],
    primitives: [primitive("source-a", "alpha", {
      length: quantity(3, "m", "length", 0.2, ["length-evidence"])
    })],
    functionals: [functional(
      "energy",
      {
        kind: "multiply",
        factors: [
          { kind: "coefficient", name: "force" },
          { kind: "invariant", name: "length" }
        ]
      },
      "J",
      "work energy",
      { absolute: 0.72 },
      {
        force: quantity(2, "N", "force", 0.1, ["force-evidence"])
      }
    )]
  });
  const { binding, filter } = eligibleExact(loaded, runConfig(), "source-a");
  const result = evaluatePackageFunctional(loaded, binding, filter, "energy");

  assert.equal(result.status, "scored");
  assert.equal(result.score.value, 6);
  assert.equal(result.score.unit, "kg*m^2*s^-2");
  assert.equal(result.score.semantic, "work energy");
  assert.equal(result.diagnostic.expressionUnit, "kg*m^2*s^-2");
  assert.equal(result.diagnostic.effectiveAbsoluteTolerance.canonical, "0.72");
  assert.equal(result.score.tolerance.absolute, 0.72);
  assert.deepEqual(result.score.provenance.evidence, [
    "force-evidence",
    "length-evidence"
  ]);
});

test("package functionals consume numeric scalar invariants as exact numbers", () => {
  const loaded = packageFixture({
    primitives: [primitive("source-a", "alpha", { multiplicity: 3 })],
    functionals: [functional(
      "scaled-length",
      {
        kind: "multiply",
        factors: [
          { kind: "invariant", name: "multiplicity" },
          { kind: "coefficient", name: "length" }
        ]
      },
      "m",
      "scaled length",
      { absolute: 0 },
      { length: quantity(2, "m", "length") }
    )]
  });
  const { binding, filter } = eligibleExact(loaded, runConfig(), "source-a");
  const result = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "scaled-length"
  );

  assert.equal(result.status, "scored");
  assert.equal(result.score.value, 6);
  assert.equal(result.score.unit, "m");
  assert.equal(result.invariants[0].valueKind, "number");
  assert.equal(result.invariants[0].value, 3);
  assert.equal(result.invariants[0].elementId, exactRef(loaded, "source-a"));
  assert.equal(result.invariants[0].quantity, undefined);
});

test("numeric scalar functionals require identical complete profile consensus", () => {
  const consensusPackage = packageFixture({
    primitives: [
      primitive("source-b", "beta", { multiplicity: 3 }),
      primitive("source-a", "alpha", { multiplicity: 3 })
    ],
    functionals: [functional(
      "profile-multiplicity",
      { kind: "invariant", name: "multiplicity" },
      "1",
      "profile multiplicity",
      { absolute: 0 }
    )]
  });
  const config = runConfig({ domain: "profile-quotient" });
  const binding = createPackageCandidateBinding(consensusPackage, config);
  const profileClass = binding.sourcePopulation.profileClasses[0];
  const filter = evaluatePackageCandidateFilter(
    consensusPackage,
    binding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: profileClass.profileHash }],
      edges: []
    }
  );
  const scored = evaluatePackageFunctional(
    consensusPackage,
    binding,
    filter,
    "profile-multiplicity"
  );
  assert.equal(scored.status, "scored");
  assert.equal(scored.score.value, 3);
  assert.equal(scored.invariants[0].valueKind, "number");
  assert.equal(
    scored.invariants[0].consensusPolicy,
    "identical-normalized-scalar-v1"
  );
  assert.deepEqual(scored.invariants[0].memberElementIds, profileClass.members);

  const disagreementPackage = packageFixture({
    primitives: [
      primitive("source-b", "beta", { multiplicity: 2 }),
      primitive("source-a", "alpha", { multiplicity: 3 })
    ],
    functionals: [functional(
      "profile-multiplicity",
      { kind: "invariant", name: "multiplicity" },
      "1",
      "profile multiplicity",
      { absolute: 0 }
    )]
  });
  const disagreementBinding = createPackageCandidateBinding(
    disagreementPackage,
    config
  );
  const disagreementClass = disagreementBinding.sourcePopulation.profileClasses[0];
  const disagreementFilter = evaluatePackageCandidateFilter(
    disagreementPackage,
    disagreementBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: disagreementClass.profileHash }],
      edges: []
    }
  );
  const disagreement = evaluatePackageFunctional(
    disagreementPackage,
    disagreementBinding,
    disagreementFilter,
    "profile-multiplicity"
  );
  assert.equal(disagreement.status, "indeterminate");
  assert.equal(
    disagreement.reason,
    "profile-invariant-member-values-disagree"
  );
});

test("package functionals aggregate non-identical numeric and Quantity profile invariants", () => {
  const loaded = packageFixture({
    evidenceIds: ["length-a", "length-b"],
    primitives: [
      primitive("source-b", "beta", {
        multiplicity: 3,
        length: quantity(3, "m", "length", 0.3, ["length-b"])
      }),
      primitive("source-a", "alpha", {
        multiplicity: 2,
        length: quantity(1, "m", "length", 0.1, ["length-a"])
      })
    ],
    functionals: [
      functional(
        "mean-multiplicity",
        {
          kind: "invariant",
          name: "multiplicity",
          profileAggregation: "arithmetic-mean-conservative-v1"
        },
        "1",
        "mean multiplicity",
        { absolute: 0 }
      ),
      functional(
        "mean-length",
        {
          kind: "invariant",
          name: "length",
          profileAggregation: "arithmetic-mean-conservative-v1"
        },
        "m",
        "mean length",
        { absolute: 0.2 }
      )
    ]
  });
  const config = runConfig({ domain: "profile-quotient" });
  const binding = createPackageCandidateBinding(loaded, config);
  const profileClass = binding.sourcePopulation.profileClasses[0];
  const filter = evaluatePackageCandidateFilter(loaded, binding, {
    domain: "profile-quotient",
    nodes: [{ ref: profileClass.profileHash }],
    edges: []
  });
  const numeric = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "mean-multiplicity"
  );
  const measured = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "mean-length"
  );

  assert.equal(numeric.status, "scored");
  assert.equal(numeric.score.value, 2.5);
  assert.equal(numeric.invariants[0].value, 2.5);
  assert.equal(numeric.invariants[0].aggregation.divisionExact, true);
  assert.equal(numeric.invariants[0].consensusPolicy, undefined);
  assert.equal(measured.status, "scored");
  assert.equal(measured.score.value, 2);
  assert.equal(measured.diagnostic.effectiveAbsoluteTolerance.canonical, "0.2");
  assert.deepEqual(measured.score.provenance.evidence, ["length-a", "length-b"]);
  assert.equal(measured.invariants[0].quantity.tolerance.absolute, 0.2);
  assert.equal(
    measured.invariants[0].quantity.provenance.method,
    "profile-invariant-arithmetic-mean-v1"
  );
  assert.deepEqual(measured.invariants[0].memberElementIds, profileClass.members);

  const exact = eligibleExact(loaded, runConfig(), "source-a");
  const exactNumeric = evaluatePackageFunctional(
    loaded,
    exact.binding,
    exact.filter,
    "mean-multiplicity"
  );
  assert.equal(exactNumeric.score.value, 2);
  assert.equal(exactNumeric.invariants[0].aggregation, undefined);
  assert.equal(exactNumeric.invariants[0].elementId, exactRef(loaded, "source-a"));

  const incomplete = packageFixture({
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha", { multiplicity: 2 })
    ],
    functionals: [functional(
      "incomplete-mean",
      {
        kind: "invariant",
        name: "multiplicity",
        profileAggregation: "arithmetic-mean-conservative-v1"
      },
      "1",
      "incomplete mean",
      { absolute: 0 }
    )]
  });
  const incompleteBinding = createPackageCandidateBinding(incomplete, config);
  const incompleteClass = incompleteBinding.sourcePopulation.profileClasses[0];
  const incompleteFilter = evaluatePackageCandidateFilter(
    incomplete,
    incompleteBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: incompleteClass.profileHash }],
      edges: []
    }
  );
  const incompleteResult = evaluatePackageFunctional(
    incomplete,
    incompleteBinding,
    incompleteFilter,
    "incomplete-mean"
  );
  assert.equal(incompleteResult.status, "indeterminate");
  assert.equal(
    incompleteResult.reason,
    "profile-invariant-member-values-missing"
  );
});

test("directed-cycle counts are relabelling-invariant functional inputs", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-c", "gamma"),
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ],
    functionals: [functional(
      "cycle-size",
      { kind: "count", set: { kind: "cycle", roles: ["support"] } },
      "1",
      "directed cycle size",
      { absolute: 0 }
    )]
  });
  const config = runConfig({ maxNodes: 3, maxEdges: 3 });
  const binding = createPackageCandidateBinding(loaded, config);
  const refs = loaded.normalized.primitives
    .map((entry) => entry.elementId)
    .sort();
  const firstCandidate = {
    domain: "element-exact",
    nodes: refs.map((ref) => ({ ref })),
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" },
      { from: 2, to: 0, role: "support" }
    ]
  };
  const secondCandidate = {
    domain: "element-exact",
    nodes: [...firstCandidate.nodes].reverse(),
    edges: [
      { from: 2, to: 1, role: "support" },
      { from: 1, to: 0, role: "support" },
      { from: 0, to: 2, role: "support" }
    ].reverse()
  };
  const firstFilter = evaluatePackageCandidateFilter(loaded, binding, firstCandidate);
  const secondFilter = evaluatePackageCandidateFilter(loaded, binding, secondCandidate);
  const first = evaluatePackageFunctional(
    loaded,
    binding,
    firstFilter,
    "cycle-size"
  );
  const second = evaluatePackageFunctional(
    loaded,
    binding,
    secondFilter,
    "cycle-size"
  );

  assert.equal(first.score.value, 3);
  assert.equal(first.selections[0].setKind, "cycle");
  assert.equal(first.selections[0].count, 3);
  assert.equal(
    first.selections[0].cycleSelection,
    "directed-cycle-edge-union-v1"
  );
  assert.equal(first.evaluationHash, second.evaluationHash);
  assert.equal(canonicalize(first), canonicalize(second));
});

test("candidate-specific invariant gaps produce hashed indeterminate artifacts", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha", {
        length: quantity(3, "m", "length")
      })
    ],
    functionals: [functional(
      "length-score",
      { kind: "invariant", name: "length" },
      "m",
      "length score",
      { absolute: 0 }
    )]
  });
  const exact = eligibleExact(loaded, runConfig(), "source-b");
  const missing = evaluatePackageFunctional(
    loaded,
    exact.binding,
    exact.filter,
    "length-score"
  );
  assert.equal(missing.status, "indeterminate");
  assert.equal(missing.reason, "invariant-value-unavailable");
  assert.equal(missing.score, null);
  assert.equal(missing.diagnostic, null);
  assert.match(missing.evaluationHash, /^sha256:[a-f0-9]{64}$/);

  const profileConfig = runConfig({ domain: "profile-quotient" });
  const profileBinding = createPackageCandidateBinding(loaded, profileConfig);
  const profileClass = profileBinding.sourcePopulation.profileClasses[0];
  const profileFilter = evaluatePackageCandidateFilter(
    loaded,
    profileBinding,
    {
      domain: "profile-quotient",
      nodes: [{ ref: profileClass.profileHash }],
      edges: []
    }
  );
  const disagreement = evaluatePackageFunctional(
    loaded,
    profileBinding,
    profileFilter,
    "length-score"
  );
  assert.equal(disagreement.status, "indeterminate");
  assert.equal(
    disagreement.reason,
    "profile-invariant-member-values-missing"
  );

  const multiBinding = createPackageCandidateBinding(
    loaded,
    runConfig({ maxNodes: 2, maxEdges: 1 })
  );
  const refs = loaded.normalized.primitives.map((entry) => entry.elementId).sort();
  const multiFilter = evaluatePackageCandidateFilter(loaded, multiBinding, {
    domain: "element-exact",
    nodes: refs.map((ref) => ({ ref })),
    edges: [{ from: 0, to: 1, role: "support" }]
  });
  const ambiguous = evaluatePackageFunctional(
    loaded,
    multiBinding,
    multiFilter,
    "length-score"
  );
  assert.equal(ambiguous.status, "indeterminate");
  assert.equal(ambiguous.reason, "invariant-node-ambiguous");
  assert.deepEqual(ambiguous.details.nodeIndexes, []);
});

test("profile consensus scores while an unmet result tolerance withholds ranking score", () => {
  const loaded = packageFixture({
    primitives: [
      primitive("source-b", "beta", {
        length: quantity(3, "m", "length", 0.2)
      }),
      primitive("source-a", "alpha", {
        length: quantity(3, "m", "length", 0.2)
      })
    ],
    functionals: [
      functional(
        "profile-length",
        { kind: "invariant", name: "length" },
        "m",
        "profile length",
        { absolute: 0.2 }
      ),
      functional(
        "too-uncertain",
        { kind: "invariant", name: "length" },
        "m",
        "profile length",
        { absolute: 0.1 }
      )
    ]
  });
  const config = runConfig({ domain: "profile-quotient" });
  const binding = createPackageCandidateBinding(loaded, config);
  const profileClass = binding.sourcePopulation.profileClasses[0];
  const filter = evaluatePackageCandidateFilter(loaded, binding, {
    domain: "profile-quotient",
    nodes: [{ ref: profileClass.profileHash }],
    edges: []
  });
  const scored = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "profile-length"
  );
  const withheld = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "too-uncertain"
  );

  assert.equal(scored.status, "scored");
  assert.equal(scored.invariants[0].profileHash, profileClass.profileHash);
  assert.deepEqual(scored.invariants[0].memberElementIds, profileClass.members);
  assert.equal(
    scored.invariants[0].consensusPolicy,
    "identical-normalized-quantity-v1"
  );
  assert.equal(withheld.status, "indeterminate");
  assert.equal(withheld.reason, "result-tolerance-target-unmet");
  assert.equal(withheld.score, null);
  assert.equal(withheld.diagnostic.toleranceTargetMet, false);
  assert.equal(withheld.diagnostic.effectiveAbsoluteTolerance.canonical, "0.2");
  assert.equal(withheld.diagnostic.toleranceTargetBound.canonical, "0.1");
});

test("functional evaluation rejects altered prerequisites and locally ineligible candidates", () => {
  const eligiblePackage = packageFixture({
    primitives: [primitive("source-a", "alpha")],
    functionals: [functional(
      "constant-score",
      { kind: "constant", value: 1.25 },
      "1",
      "constant score",
      { absolute: 0 }
    )]
  });
  const eligible = eligibleExact(eligiblePackage, runConfig(), "source-a");
  const alteredFilter = canonicalClone(eligible.filter);
  alteredFilter.filterHash = `sha256:${"f".repeat(64)}`;
  assert.throws(
    () => evaluatePackageFunctional(
      eligiblePackage,
      eligible.binding,
      alteredFilter,
      "constant-score"
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_FUNCTIONAL_FILTER_MISMATCH"
  );

  const alteredBinding = canonicalClone(eligible.binding);
  alteredBinding.bindingHash = `sha256:${"e".repeat(64)}`;
  assert.throws(
    () => evaluatePackageFunctional(
      eligiblePackage,
      alteredBinding,
      eligible.filter,
      "constant-score"
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_FILTER_BINDING_MISMATCH"
  );

  const rejectedPackage = packageFixture({
    primitives: [primitive("source-a", "alpha")],
    predicates: [predicate("requires-edge", {
      op: "countRole",
      role: "support",
      min: 1
    })],
    functionals: [functional(
      "constant-score",
      { kind: "constant", value: 1 },
      "1",
      "constant score",
      { absolute: 0 }
    )]
  });
  const rejectedBinding = createPackageCandidateBinding(
    rejectedPackage,
    runConfig()
  );
  const rejectedFilter = evaluatePackageCandidateFilter(
    rejectedPackage,
    rejectedBinding,
    {
      domain: "element-exact",
      nodes: [{ ref: exactRef(rejectedPackage, "source-a") }],
      edges: []
    }
  );
  assert.equal(rejectedFilter.verdict, "predicate-rejected");
  assert.throws(
    () => evaluatePackageFunctional(
      rejectedPackage,
      rejectedBinding,
      rejectedFilter,
      "constant-score"
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_FUNCTIONAL_CANDIDATE_INELIGIBLE"
  );
});

test("the configured kernel exposes package functional evaluation", async () => {
  const kernel = createKernel({ version: "functional-kernel-test" });
  const loaded = await kernel.loadPackage({
    schemaVersion: "1",
    id: "kernel-functional-fixture",
    version: "1.0.0",
    primitives: [primitive("source-a", "alpha")],
    functionals: [functional(
      "score",
      { kind: "constant", value: 1 },
      "1",
      "kernel score",
      { absolute: 0 }
    )]
  });
  const binding = kernel.createPackageCandidateBinding(loaded, runConfig());
  const filter = kernel.evaluatePackageCandidateFilter(loaded, binding, {
    domain: "element-exact",
    nodes: [{ ref: exactRef(loaded, "source-a") }],
    edges: []
  });
  const result = kernel.evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "score"
  );

  assert.equal(result.status, "scored");
  assert.equal(result.score.value, 1);
  assert.ok(kernel.capabilities.implemented.includes("package-functional-evaluation"));
});
