import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  KernelValidationError,
  auditPackagePredicateMonotonicity,
  canonicalClone,
  canonicalize,
  createPackageCandidateBinding,
  enumeratePackageDepthCandidates,
  enumeratePackageCandidates,
  evaluatePackageCandidateCensus,
  loadKernelPackage
} from "../src/index.js";
import {
  validateSupportedPackageGenerationConfig
} from "../src/package-candidate-generator.js";

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

function quantity(value, unit, semantic, evidence = []) {
  return {
    value,
    unit,
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence }
  };
}

function loadedPackage() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-candidate-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ]
  });
}

function attributedLoadedPackage({ heterogeneous = true } = {}) {
  const first = primitive("attribute-source-a", "attribute-source");
  first.invariants.mass = 1;
  const second = primitive("attribute-source-b", "attribute-source");
  second.invariants.mass = heterogeneous ? 2 : 1;
  return loadKernelPackage({
    schemaVersion: "1",
    id: `package-candidate-attributes-${heterogeneous ? "mixed" : "uniform"}`,
    version: "1.0.0",
    identityPolicy: { sourceIdStructural: true },
    primitives: [first, second],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "element-invariant-scalar-v1",
        invariant: "mass"
      }
    }, {
      name: "strength",
      target: "edges",
      source: { kind: "constant-scalar-v1", value: 3 }
    }],
    predicates: [{
      id: "positive-mass",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "compare",
        left: {
          kind: "sum",
          attribute: "mass",
          set: { kind: "nodes", selector: { kind: "all" } }
        },
        comparator: "gte",
        right: { kind: "constant", value: 1 }
      },
      explain: { pass: "positive", fail: "not positive", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
}

function quantityAttributedLoadedPackage({ heterogeneous = false } = {}) {
  const first = primitive("quantity-attribute-source-a", "quantity-source");
  first.invariants.mass = quantity(1000, "g", "mass");
  const second = primitive("quantity-attribute-source-b", "quantity-source");
  second.invariants.mass = quantity(
    heterogeneous ? 2 : 1,
    "kg",
    "mass"
  );
  return loadKernelPackage({
    schemaVersion: "1",
    id: `package-candidate-quantity-attributes-${heterogeneous ? "mixed" : "uniform"}`,
    version: "1.0.0",
    identityPolicy: { sourceIdStructural: true },
    primitives: [first, second],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "element-invariant-quantity-v1",
        invariant: "mass"
      }
    }, {
      name: "span",
      target: "edges",
      source: {
        kind: "constant-quantity-v1",
        value: quantity(100, "cm", "length")
      }
    }],
    predicates: [{
      id: "positive-mass",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "compare",
        left: {
          kind: "sum",
          attribute: "mass",
          set: { kind: "nodes", selector: { kind: "all" } }
        },
        comparator: "gte",
        right: { kind: "constant", value: quantity(1, "kg", "mass") }
      },
      explain: { pass: "positive", fail: "not positive", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
}

function quantityIdentityLoadedPackage(evidenceId, hashCharacter) {
  const source = primitive("quantity-identity-source", "quantity-source");
  source.invariants.mass = quantity(1, "kg", "mass", [evidenceId]);
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-candidate-quantity-identity",
    version: "1.0.0",
    evidence: [{
      id: evidenceId,
      state: "paper-assumption",
      source: {
        path: `evidence/${evidenceId}.txt`,
        mediaType: "text/plain",
        schemaVersion: "1",
        bytes: 1,
        hash: `sha256:${hashCharacter.repeat(64)}`
      }
    }],
    primitives: [source],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "element-invariant-quantity-v1",
        invariant: "mass"
      }
    }]
  });
}

function roleAttributedLoadedPackage({ extraRole = false } = {}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-candidate-role-attributes",
    version: "1.0.0",
    primitives: [primitive("role-attribute-source", "role-source")],
    candidateAttributes: [{
      name: "weight",
      target: "edges",
      source: {
        kind: "edge-role-scalar-v1",
        values: {
          transforms: 1,
          supports: 2,
          ...(extraRole ? { unused: 3 } : {})
        }
      }
    }, {
      name: "span",
      target: "edges",
      source: {
        kind: "edge-role-quantity-v1",
        values: {
          transforms: quantity(2, "m", "length"),
          supports: quantity(100, "cm", "length"),
          ...(extraRole ? { unused: quantity(3, "m", "length") } : {})
        }
      }
    }]
  });
}

function gatedLoadedPackage({ legacyGuard = false } = {}) {
  const guard = legacyGuard
    ? `sha256:${"a".repeat(64)}`
    : { op: "partnerTypeTag", typeTag: "beta" };
  const profile = (slots) => ({
    slots,
    invariantVector: [],
    precisionPolicy: "exact-structural-v1"
  });
  return loadKernelPackage({
    schemaVersion: "1",
    id: `package-profile-composition-${legacyGuard ? "legacy" : "typed"}`,
    version: "1.0.0",
    primitives: [
      {
        sourceId: "source-alpha",
        kind: "primitive",
        typeTags: ["alpha"],
        invariants: {},
        profile: profile([{
          role: "supports",
          polarity: "out",
          capacity: { min: 0, max: 1 },
          guard
        }]),
        claimRefs: []
      },
      {
        sourceId: "source-beta",
        kind: "primitive",
        typeTags: ["beta"],
        invariants: {},
        profile: profile([{
          role: "supports",
          polarity: "in",
          capacity: { min: 0, max: 1 },
          guard: { op: "partnerTypeTag", typeTag: "alpha" }
        }]),
        claimRefs: []
      }
    ]
  });
}

function runConfig(overrides = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["transforms", "supports"],
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-candidate-fixture-v1",
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

test("package binding derives exact/profile alphabets, profile provenance, skeletons, and run budgets", () => {
  const loaded = loadedPackage();
  const exact = createPackageCandidateBinding(loaded, runConfig());
  const quotient = createPackageCandidateBinding(loaded, runConfig({
    countingDomain: "profile-quotient",
    roleAlphabet: ["supports", "transforms"]
  }));

  assert.equal(exact.binder, "package-candidate-binding-v2");
  assert.equal(exact.packageId, loaded.packageId);
  assert.equal(exact.depthBasis, loaded.semanticManifest.depthBasis);
  assert.equal(exact.sourcePopulation.kind, "primitive-depth-population-selection-v1");
  assert.equal(exact.sourcePopulation.population.depth, 0);
  assert.equal(
    exact.sourcePopulation.population.populationHash,
    quotient.sourcePopulation.population.populationHash
  );
  assert.deepEqual(exact.sourcePopulation.selection, {
    sourceDepths: "all-below",
    targetDepth: 1,
    availableDepths: [0],
    selectedDepths: [0]
  });
  assert.equal(exact.enumerationInput.skeletons.length, 2);
  assert.deepEqual(
    exact.enumerationInput.nodeVariants.map((entry) => entry.ref),
    loaded.normalized.primitives.map((entry) => entry.elementId).sort()
  );
  assert.deepEqual(
    exact.enumerationInput.edgeVariants.map((entry) => entry.role),
    ["supports", "transforms"]
  );
  assert.equal(exact.sourcePopulation.profileClasses.length, 1);
  assert.equal(exact.sourcePopulation.profileClasses[0].members.length, 2);
  assert.equal(
    exact.sourcePopulation.profileClasses[0].representativeElementId,
    [...exact.sourcePopulation.profileClasses[0].members].sort()[0]
  );
  assert.equal(quotient.enumerationInput.nodeVariants.length, 1);
  assert.equal(
    quotient.enumerationInput.nodeVariants[0].ref,
    exact.sourcePopulation.profileClasses[0].profileHash
  );
  assert.equal(exact.enumerationOptions.maxEdges, 1);
  assert.equal(exact.enumerationOptions.maxCandidates, 100);
  assert.ok(Object.isFrozen(exact));
  assert.ok(Object.isFrozen(exact.enumerationInput.skeletons));
});

test("package binding is invariant to normalized run set order", () => {
  const loaded = loadedPackage();
  const first = createPackageCandidateBinding(loaded, runConfig());
  const second = createPackageCandidateBinding(loaded, runConfig({
    roleAlphabet: ["supports", "transforms"]
  }));
  assert.equal(first.bindingHash, second.bindingHash);
  assert.equal(canonicalize(first), canonicalize(second));
});

test("primitive depth selection discloses the source-depth policy even when depth zero is equivalent", () => {
  const allBelow = createPackageCandidateBinding(loadedPackage(), runConfig());
  const previous = createPackageCandidateBinding(loadedPackage(), runConfig({
    sourceDepths: "previous-only"
  }));

  assert.deepEqual(allBelow.sourcePopulation.selection.selectedDepths, [0]);
  assert.deepEqual(previous.sourcePopulation.selection.selectedDepths, [0]);
  assert.equal(previous.sourcePopulation.selection.sourceDepths, "previous-only");
  assert.equal(
    allBelow.sourcePopulation.population.populationHash,
    previous.sourcePopulation.population.populationHash
  );
  assert.notEqual(allBelow.bindingHash, previous.bindingHash);
});

test("package enumeration executes the bound finite universe and retains provenance", () => {
  const config = runConfig({
    roleAlphabet: ["supports"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const result = enumeratePackageCandidates(loadedPackage(), config);

  assert.equal(result.generator, "package-candidate-generator-v5");
  assert.equal(result.enumeration.status, "complete");
  assert.equal(result.enumeration.interpretable, true);
  assert.equal(result.enumeration.counts.generatedCandidates, 2);
  assert.equal(result.enumeration.counts.canonicalCandidates, 2);
  assert.equal(result.binding.bindingHash.length, 71);
  assert.equal(result.binding.runConfig.budget.maxNodes, 1);
  assert.equal(result.profileComposition.status, "not-run");
  assert.ok(Object.isFrozen(result));
});

test("package-driven scalar attributes decorate exact nodes and edges before filtering", () => {
  const loaded = attributedLoadedPackage();
  const config = runConfig({
    roleAlphabet: ["supports"],
    graphPolicy: {
      ...runConfig().graphPolicy,
      structuralNodeAttributes: ["mass"],
      structuralEdgeAttributes: ["strength"]
    }
  });
  const binding = createPackageCandidateBinding(loaded, config);

  assert.deepEqual(
    binding.enumerationInput.nodeVariants.map((entry) => entry.attrs.mass).sort(),
    [1, 2]
  );
  assert.deepEqual(binding.enumerationInput.edgeVariants, [{
    role: "supports",
    attrs: { strength: 3 }
  }]);
  const generation = enumeratePackageCandidates(loaded, config);
  assert.equal(generation.enumeration.status, "complete");
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.nodes.every((node) => node.attrs.mass === 1 || node.attrs.mass === 2) &&
    entry.candidate.edges.every((edge) => edge.attrs.strength === 3)
  ));
  const census = evaluatePackageCandidateCensus(loaded, config);
  assert.equal(census.counts.filterIndeterminate, 0);
  assert.ok(census.census[0].passed > 0);
  const depth = enumeratePackageDepthCandidates(loaded, config, [], 1);
  assert.deepEqual(
    depth.binding.enumerationInput.nodeVariants,
    binding.enumerationInput.nodeVariants
  );
  assert.deepEqual(
    depth.binding.enumerationInput.edgeVariants,
    binding.enumerationInput.edgeVariants
  );

  assert.throws(
    () => createPackageCandidateBinding(loaded, {
      ...config,
      countingDomain: "profile-quotient"
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_PROFILE_ATTRIBUTE_INDETERMINATE"
      )
  );
  const uniform = createPackageCandidateBinding(
    attributedLoadedPackage({ heterogeneous: false }),
    { ...config, countingDomain: "profile-quotient" }
  );
  assert.equal(uniform.enumerationInput.nodeVariants.length, 1);
  assert.deepEqual(uniform.enumerationInput.nodeVariants[0].attrs, { mass: 1 });
});

test("package-driven Quantity attributes normalize, filter, and preserve profile consensus", () => {
  const loaded = quantityAttributedLoadedPackage();
  const config = runConfig({
    roleAlphabet: ["supports"],
    graphPolicy: {
      ...runConfig().graphPolicy,
      structuralNodeAttributes: ["mass"],
      structuralEdgeAttributes: ["span"]
    }
  });
  const binding = createPackageCandidateBinding(loaded, config);
  assert.ok(binding.enumerationInput.nodeVariants.every((entry) =>
    canonicalize(entry.attrs.mass) === canonicalize(quantity(1, "kg", "mass"))
  ));
  assert.deepEqual(binding.enumerationInput.edgeVariants, [{
    role: "supports",
    attrs: { span: quantity(1, "m", "length") }
  }]);
  const generation = enumeratePackageCandidates(loaded, config);
  assert.equal(generation.enumeration.status, "complete");
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.nodes.every((node) => node.attrs.mass.unit === "kg") &&
    entry.candidate.edges.every((edge) => edge.attrs.span.unit === "m")
  ));
  const census = evaluatePackageCandidateCensus(loaded, config);
  assert.equal(census.counts.filterIndeterminate, 0);
  assert.ok(census.census[0].passed > 0);
  const depth = enumeratePackageDepthCandidates(loaded, config, [], 1);
  assert.deepEqual(
    depth.binding.enumerationInput.nodeVariants,
    binding.enumerationInput.nodeVariants
  );
  assert.deepEqual(
    depth.binding.enumerationInput.edgeVariants,
    binding.enumerationInput.edgeVariants
  );

  const quotient = createPackageCandidateBinding(loaded, {
    ...config,
    countingDomain: "profile-quotient"
  });
  assert.equal(quotient.enumerationInput.nodeVariants.length, 1);
  assert.equal(quotient.enumerationInput.nodeVariants[0].attrs.mass.value, 1);
  assert.throws(
    () => createPackageCandidateBinding(
      quantityAttributedLoadedPackage({ heterogeneous: true }),
      { ...config, countingDomain: "profile-quotient" }
    ),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_PROFILE_ATTRIBUTE_INDETERMINATE"
      )
  );
});

test("Quantity candidate identity retains complete normalized provenance", () => {
  const firstLoaded = quantityIdentityLoadedPackage("mass-source-a", "a");
  const secondLoaded = quantityIdentityLoadedPackage("mass-source-b", "b");
  const config = runConfig({
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    graphPolicy: {
      ...runConfig().graphPolicy,
      structuralNodeAttributes: ["mass"]
    }
  });
  const first = enumeratePackageCandidates(firstLoaded, config);
  const second = enumeratePackageCandidates(secondLoaded, config);
  const firstCandidate = first.enumeration.candidateStore.candidates[0];
  const secondCandidate = second.enumeration.candidateStore.candidates[0];

  assert.equal(
    first.binding.enumerationInput.nodeVariants[0].ref,
    second.binding.enumerationInput.nodeVariants[0].ref
  );
  assert.notEqual(firstLoaded.packageId, secondLoaded.packageId);
  assert.notEqual(firstCandidate.candidateId, secondCandidate.candidateId);
  assert.deepEqual(
    firstCandidate.candidate.nodes[0].attrs.mass.provenance.evidence,
    ["mass-source-a"]
  );
  assert.deepEqual(
    secondCandidate.candidate.nodes[0].attrs.mass.provenance.evidence,
    ["mass-source-b"]
  );
});

test("role-dependent edge attributes bind one typed value per run role", () => {
  const loaded = roleAttributedLoadedPackage();
  const config = runConfig({
    graphPolicy: {
      ...runConfig().graphPolicy,
      structuralEdgeAttributes: ["weight", "span"]
    }
  });
  const binding = createPackageCandidateBinding(loaded, config);
  assert.deepEqual(binding.enumerationInput.edgeVariants, [{
    role: "supports",
    attrs: {
      span: quantity(1, "m", "length"),
      weight: 2
    }
  }, {
    role: "transforms",
    attrs: {
      span: quantity(2, "m", "length"),
      weight: 1
    }
  }]);

  const generation = enumeratePackageCandidates(loaded, config);
  assert.equal(generation.enumeration.status, "complete");
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.edges.every((edge) =>
      edge.attrs.weight === (edge.role === "supports" ? 2 : 1) &&
      edge.attrs.span.value === (edge.role === "supports" ? 1 : 2)
    )
  ));
  const quotient = createPackageCandidateBinding(loaded, {
    ...config,
    countingDomain: "profile-quotient"
  });
  assert.deepEqual(quotient.enumerationInput.edgeVariants, binding.enumerationInput.edgeVariants);
  const depth = enumeratePackageDepthCandidates(loaded, config, [], 1);
  assert.deepEqual(depth.binding.enumerationInput.edgeVariants, binding.enumerationInput.edgeVariants);
  const extended = createPackageCandidateBinding(
    roleAttributedLoadedPackage({ extraRole: true }),
    config
  );
  assert.deepEqual(
    extended.enumerationInput.edgeVariants,
    binding.enumerationInput.edgeVariants
  );
  assert.notEqual(extended.bindingHash, binding.bindingHash);

  assert.throws(
    () => createPackageCandidateBinding(loaded, {
      ...config,
      roleAlphabet: ["missing-role"]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_UNAVAILABLE"
      )
  );
});

test("candidate attribute definitions reject missing or mismatched typed sources", () => {
  const missing = primitive("missing-attribute-source", "source");
  assert.throws(
    () => loadKernelPackage({
      schemaVersion: "1",
      id: "missing-candidate-attribute",
      version: "1.0.0",
      primitives: [missing],
      candidateAttributes: [{
        name: "mass",
        target: "nodes",
        source: {
          kind: "element-invariant-scalar-v1",
          invariant: "mass"
        }
      }]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_INVARIANT_MISSING"
      )
  );

  const quantified = primitive("quantity-attribute-source", "source");
  quantified.invariants.mass = {
    value: 1,
    unit: "kg",
    tolerance: { absolute: 0 },
    semantic: "mass",
    provenance: { kind: "declared", evidence: [] }
  };
  assert.throws(
    () => loadKernelPackage({
      schemaVersion: "1",
      id: "quantity-candidate-attribute",
      version: "1.0.0",
      primitives: [quantified],
      candidateAttributes: [{
        name: "mass",
        target: "nodes",
        source: {
          kind: "element-invariant-scalar-v1",
          invariant: "mass"
        }
      }]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH"
      )
  );

  assert.throws(
    () => loadKernelPackage({
      schemaVersion: "1",
      id: "scalar-as-quantity-candidate-attribute",
      version: "1.0.0",
      primitives: [primitive("scalar-as-quantity-source", "source")],
      candidateAttributes: [{
        name: "mass",
        target: "nodes",
        source: { kind: "constant-quantity-v1", value: 1 }
      }]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_MISMATCH"
      )
  );

  assert.throws(
    () => loadKernelPackage({
      schemaVersion: "1",
      id: "node-role-candidate-attribute",
      version: "1.0.0",
      primitives: [primitive("node-role-source", "source")],
      candidateAttributes: [{
        name: "weight",
        target: "nodes",
        source: {
          kind: "edge-role-scalar-v1",
          values: { supports: 1 }
        }
      }]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TARGET_INVALID"
      )
  );

  assert.throws(
    () => loadKernelPackage({
      schemaVersion: "1",
      id: "mixed-role-candidate-attribute",
      version: "1.0.0",
      primitives: [primitive("mixed-role-source", "source")],
      candidateAttributes: [{
        name: "weight",
        target: "edges",
        source: {
          kind: "edge-role-scalar-v1",
          values: { supports: 1, transforms: "one" }
        }
      }]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_VALUE_CONFLICT"
      )
  );
});

test("candidate binding rejects carried invariant runtime type drift before enumeration", () => {
  const loaded = quantityAttributedLoadedPackage();
  const config = runConfig();
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  const binding = createPackageCandidateBinding(loaded, config);
  const drifted = structuredClone(binding.sourcePopulation);
  drifted.population.elements[1].invariants.mass.semantic = "drifted mass";

  assert.throws(
    () => validateSupportedPackageGenerationConfig(
      drifted,
      binding.runConfig,
      loaded.normalized.candidateAttributes
    ),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "PACKAGE_CANDIDATE_ATTRIBUTE_SOURCE_TYPE_DRIFT" &&
        entry.details.expectedRuntimeType.semantic === "mass" &&
        entry.details.actualRuntimeType.semantic === "drifted mass"
      )
  );
});

test("profile-slot generation gate enforces capacity, polarity, and typed partner guards", () => {
  const config = runConfig({
    roleAlphabet: ["supports"],
    profileCompositionPolicy: "profile-slot-gate-v1"
  });
  const result = enumeratePackageCandidates(gatedLoadedPackage(), config);

  assert.equal(result.profileComposition.status, "complete");
  assert.equal(result.profileComposition.policy, "profile-slot-gate-v1");
  assert.equal(result.profileComposition.counts.indeterminateCandidates, 0);
  assert.ok(result.profileComposition.counts.incompatibleCandidates > 0);
  assert.ok(result.profileComposition.counts.excludedRawCandidates > 0);
  assert.equal(
    result.profileComposition.counts.compatibleCandidates,
    result.enumeration.counts.canonicalCandidates
  );
  assert.equal(
    result.enumeration.counts.compositionExcludedCandidates,
    result.profileComposition.counts.excludedRawCandidates
  );
  const composed = result.profileComposition.decisions.find(
    (entry) => entry.outcome === "pass" && entry.consumptions.length === 1
  );
  assert.ok(composed);
  assert.equal(composed.guardEvaluations.length, 2);
  assert.ok(composed.guardEvaluations.every((entry) => entry.outcome === "pass"));
  assert.equal(composed.consumptions[0].source.polarity, "out");
  assert.equal(composed.consumptions[0].target.polarity, "in");

  const depth = enumeratePackageDepthCandidates(
    gatedLoadedPackage(),
    config,
    [],
    1
  );
  assert.equal(depth.generator, "package-depth-candidate-generator-v3");
  assert.equal(depth.profileComposition.status, "complete");
  assert.equal(
    depth.profileComposition.counts.compatibleCandidates,
    depth.enumeration.counts.canonicalCandidates
  );
});

test("profile-slot generation gate fails closed on unresolved legacy guards", () => {
  const config = runConfig({
    roleAlphabet: ["supports"],
    profileCompositionPolicy: "profile-slot-gate-v1"
  });
  assert.throws(
    () => enumeratePackageCandidates(gatedLoadedPackage({ legacyGuard: true }), config),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_PROFILE_COMPOSITION_INDETERMINATE" &&
      error.details.reason === "profile-slot-guard-unsupported"
  );
});

test("profile-slot generation gate binds the canonical pre-admission audit universe", () => {
  const config = runConfig({
    roleAlphabet: ["supports"],
    profileCompositionPolicy: "profile-slot-gate-v1"
  });
  const packageArtifact = gatedLoadedPackage();
  const generation = enumeratePackageCandidates(packageArtifact, config);
  const audit = auditPackagePredicateMonotonicity(packageArtifact, config, {
    samplesPerPredicate: 1
  });
  assert.equal(audit.status, "not-applicable");
  assert.equal(audit.bindingHash, generation.binding.bindingHash);
  assert.equal(
    audit.universe.candidateCount,
    generation.enumeration.counts.canonicalCandidates
  );
});

test("package enumeration reports execution-budget exhaustion without changing the run budget", () => {
  const result = enumeratePackageCandidates(loadedPackage(), runConfig({
    roleAlphabet: ["supports"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }), { maxRawCandidates: 1 });

  assert.equal(result.enumeration.status, "budget-exhausted");
  assert.equal(result.enumeration.budget.exhausted?.budget, "maxRawCandidates");
  assert.equal(result.binding.enumerationOptions.maxCandidates, 10);
  assert.equal(result.binding.enumerationOptions.maxRawCandidates, 1);
});

test("package binding reproduces loader output instead of trusting loaded-package labels", () => {
  const tampered = canonicalClone(loadedPackage());
  tampered.packageId = `sha256:${"f".repeat(64)}`;

  assert.throws(
    () => createPackageCandidateBinding(tampered, runConfig()),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "PACKAGE_CANDIDATE_LOADED_PACKAGE_MISMATCH")
  );
});

test("package binding rejects generator semantics that are not implemented", () => {
  const cases = [
    [
      runConfig({ countingDomain: "single-candidate" }),
      "PACKAGE_CANDIDATE_SINGLE_CANDIDATE_UNSUPPORTED"
    ],
    [
      runConfig({ graphPolicy: { ...runConfig().graphPolicy, connected: false } }),
      "PACKAGE_CANDIDATE_CONNECTED_POLICY_REQUIRED"
    ],
    [
      runConfig({
        graphPolicy: {
          ...runConfig().graphPolicy,
          structuralNodeAttributes: ["mass"]
        }
      }),
      "PACKAGE_CANDIDATE_ATTRIBUTE_DEFINITION_MISSING"
    ],
    [
      runConfig({
        budget: {
          ...runConfig().budget,
          maxWallTimeMs: 100
        }
      }),
      "PACKAGE_CANDIDATE_RESOURCE_BUDGET_UNSUPPORTED"
    ],
    [
      runConfig(),
      "PACKAGE_CANDIDATE_SEARCH_BUDGET_TOO_SMALL",
      { maxSearchStates: 1 }
    ]
  ];

  for (const [config, code, options] of cases) {
    assert.throws(
      () => createPackageCandidateBinding(loadedPackage(), config, options),
      (error) => error instanceof KernelValidationError &&
        error.issues.some((entry) => entry.code === code),
      code
    );
  }
});
