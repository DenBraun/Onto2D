import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  admitPackageSelectors,
  canonicalClone,
  closePackageLevel,
  createKernel,
  evaluatePackageCandidateCensus,
  extractPackageDerivedProfiles,
  hashCanonical,
  loadKernelPackage,
  materializePackageDerivedDepthPopulation,
  materializePackageSelectedFormations,
  verifyPackageDerivedDepthPopulation,
  verifyPackageDerivedProfiles,
  verifyPackageLevelClosure
} from "../src/index.js";

const GUARD_HASH = `sha256:${"b".repeat(64)}`;

function slot(role, polarity, max, guard) {
  return {
    role,
    polarity,
    capacity: { min: 0, max },
    ...(guard === undefined ? {} : { guard })
  };
}

function profile(slots = []) {
  return {
    slots,
    invariantVector: [],
    precisionPolicy: "exact-structural-v1"
  };
}

function quantity(value, unit, semantic, absolute = 0) {
  return {
    value,
    unit,
    tolerance: { absolute },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function functional(id, expr, unit, semantic, toleranceTarget) {
  return {
    id,
    expr,
    coefficients: {},
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

function loadedFixture({
  slots = [slot("support", "out", 2), slot("support", "in", 2)],
  definition = "residual",
  requiredEdges = 1,
  invariants = {},
  primitiveTypeTags = ["source"],
  additionalPrimitiveTypeTags = [],
  functionals = [],
  cohortRules = [],
  selectors = [],
  identityPolicy,
  typeRuleMinimum = 1
} = {}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: `package-derived-profile-${definition}`,
    version: "1.0.0",
    primitives: [primitiveTypeTags, ...additionalPrimitiveTypeTags].map(
      (typeTags, index) => ({
        sourceId: index === 0 ? "source" : `source-${index}`,
        kind: "primitive",
        typeTags,
        invariants,
        profile: profile(slots),
        claimRefs: []
      })
    ),
    predicates: [{
      id: "requires-support",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "countRole",
        role: "support",
        min: requiredEdges,
        max: requiredEdges
      },
      explain: { pass: "supported", fail: "unsupported", indeterminate: "unknown" },
      claimRefs: []
    }],
    functionals,
    cohortRules,
    selectors,
    profileDefinition: definition === "explicit"
      ? { kind: "explicit-only" }
      : definition === "derived" || definition === "typed"
        ? {
            kind: definition === "typed"
              ? "residual-slots-v3"
              : "residual-slots-v2",
            baseProfile: profile([slot("external", "sym", 1)]),
            derivedTypeTags: ["derived-fixture"],
            claimRefs: [],
            derivedInvariants: [{
              semantic: "formation-edge-count",
              functional: "formation-edge-count",
              quantization: quantity(
                1,
                "1",
                "formation-edge-count"
              )
            }],
            ...(definition === "typed"
              ? {
                  derivedTypeRules: [
                    {
                      typeTag: "multi-support",
                      invariant: "formation-edge-count",
                      comparator: "gt",
                      threshold: quantity(1, "1", "formation-edge-count")
                    },
                    {
                      typeTag: "one-support",
                      invariant: "formation-edge-count",
                      comparator: "gte",
                      threshold: quantity(
                        typeRuleMinimum,
                        "1",
                        "formation-edge-count"
                      )
                    }
                  ]
                }
              : {})
          }
        : {
          kind: "residual-slots-v1",
          baseProfile: profile([slot("external", "sym", 1)]),
          derivedTypeTags: ["derived-fixture"],
          claimRefs: []
        },
    ...(identityPolicy === undefined ? {} : { identityPolicy })
  });
}

function runConfig(countingDomain = "element-exact", ontologyTarget) {
  return {
    schemaVersion: "1",
    countingDomain,
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
    seed: "package-derived-profile-fixture-v1",
    invariantPrecision: {
      id: "profile-precision-v1",
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
      id: "profile-substructure-v1",
      remove: "nodes-and-edges",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    ...(ontologyTarget === undefined ? {} : { ontologyTarget }),
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
}

function pipeline(loaded, options = {}) {
  const config = runConfig(options.countingDomain, options.ontologyTarget);
  const census = evaluatePackageCandidateCensus(loaded, config);
  const admission = admitPackageSelectors(loaded, config, census, []);
  const formations = materializePackageSelectedFormations(
    loaded,
    config,
    census,
    admission
  );
  const profiles = extractPackageDerivedProfiles(
    loaded,
    config,
    census,
    admission,
    formations
  );
  const population = materializePackageDerivedDepthPopulation(
    loaded,
    config,
    census,
    admission,
    formations,
    profiles
  );
  return { config, census, admission, formations, profiles, population };
}

test("residual-slot extraction consumes directed endpoints and adds the frozen base profile", () => {
  const loaded = loadedFixture();
  const {
    config,
    census,
    admission,
    formations,
    profiles,
    population
  } = pipeline(loaded);

  assert.equal(loaded.normalized.profileDefinition.kind, "residual-slots-v1");
  assert.match(loaded.normalized.profileDefinition.baseProfile.hash, /^sha256:/);
  assert.equal(formations.formations.length, 1);
  assert.equal(profiles.status, "complete");
  assert.deepEqual(profiles.counts, {
    selectedFormations: 1,
    materializedProfiles: 1,
    indeterminateProfiles: 0
  });
  const result = profiles.results[0];
  assert.equal(result.status, "materialized");
  assert.equal(result.consumptions.length, 1);
  assert.equal(result.consumptions[0].source.polarity, "out");
  assert.equal(result.consumptions[0].target.polarity, "in");
  assert.equal(result.profile.slots.length, 5);
  assert.ok(result.profile.slots.some(
    (entry) => entry.role === "external" && entry.capacity.max === 1
  ));
  assert.equal(
    result.profile.slots.filter(
      (entry) => entry.role === "support" && entry.capacity.max === 1
    ).length,
    2
  );
  assert.equal(
    result.profile.slots.filter(
      (entry) => entry.role === "support" && entry.capacity.max === 2
    ).length,
    2
  );
  const { profileResultHash, ...resultBasis } = result;
  assert.equal(
    profileResultHash,
    hashCanonical(HASH_DOMAINS.DERIVED_PROFILE_EXTRACTION, resultBasis)
  );
  const { profileSetHash, ...basis } = profiles;
  assert.equal(
    profileSetHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DERIVED_PROFILES, basis)
  );
  assert.deepEqual(
    verifyPackageDerivedProfiles(
      profiles,
      loaded,
      config,
      census,
      admission,
      formations
    ),
    profiles
  );
  assert.equal(population.status, "complete");
  assert.equal(population.depth, 1);
  assert.equal(population.elements.length, 1);
  assert.equal(population.counts.uniqueElements, 1);
  assert.equal(population.counts.alternateDerivations, 0);
  const element = population.elements[0];
  assert.equal(element.kind, "derived");
  assert.equal(element.id, element.canonicalForm.hash);
  assert.equal(element.profile.hash, result.profile.hash);
  assert.equal(element.provenance.sourceCandidate, result.candidateId);
  assert.equal(element.provenance.derivationDepth, 1);
  assert.equal(element.provenance.roleAssignment.edges.length, 1);
  assert.deepEqual(population.derivationIndex[0].derivations[0].admittedBy, [
    "requires-support"
  ]);
  const { populationHash, ...populationBasis } = population;
  assert.equal(
    populationHash,
    hashCanonical(HASH_DOMAINS.DEPTH_POPULATION, populationBasis)
  );
  assert.deepEqual(
    verifyPackageDerivedDepthPopulation(
      population,
      loaded,
      config,
      census,
      admission,
      formations,
      profiles
    ),
    population
  );
});

test("derived elements materialize the declared run ontology target under identity policy", () => {
  const target = { level: 2, phase: "B", segment: "core" };
  const loaded = loadedFixture();
  const withoutTarget = pipeline(loaded).population.elements[0];
  const withTarget = pipeline(loaded, { ontologyTarget: target }).population
    .elements[0];

  assert.deepEqual(withTarget.ontologyCoordinate, target);
  assert.deepEqual(withTarget.axisProvenance, {
    derivationDepth: "computed",
    ontologyLevel: "declared",
    ontologyPhase: "declared"
  });
  assert.notEqual(withTarget.id, withoutTarget.id);
  const level = closePackageLevel(loaded, runConfig(undefined, target));
  assert.deepEqual(level.ontologyCoordinate, target);
  assert.deepEqual(level.axisProvenance, withTarget.axisProvenance);
  assert.deepEqual(level.artifacts.population.elements[0].ontologyCoordinate, target);
  assert.deepEqual(
    verifyPackageLevelClosure(level, loaded, runConfig(undefined, target)),
    level
  );

  const nonstructural = loadedFixture({
    identityPolicy: { ontologyCoordinateStructural: false }
  });
  const nonstructuralWithout = pipeline(nonstructural).population.elements[0];
  const nonstructuralWith = pipeline(nonstructural, {
    ontologyTarget: target
  }).population.elements[0];
  assert.deepEqual(nonstructuralWith.ontologyCoordinate, target);
  assert.equal(nonstructuralWith.id, nonstructuralWithout.id);
});

test("formation functionals derive complete profile invariants with replayable lineage", () => {
  const edgeCountFunctional = functional(
    "formation-edge-count",
    { kind: "count", set: { kind: "edges" } },
    "1",
    "formation-edge-count",
    { absolute: 0 }
  );
  const loaded = loadedFixture({
    definition: "derived",
    functionals: [edgeCountFunctional]
  });
  const { profiles, population } = pipeline(loaded);

  assert.equal(loaded.normalized.profileDefinition.kind, "residual-slots-v2");
  assert.equal(profiles.status, "complete");
  const result = profiles.results[0];
  assert.equal(result.status, "materialized");
  assert.equal(result.derivedInvariantEvaluations.length, 1);
  assert.equal(result.derivedInvariantEvaluations[0].status, "scored");
  assert.equal(
    result.derivedInvariantEvaluations[0].functionalId,
    "formation-edge-count"
  );
  assert.deepEqual(result.profile.invariantVector.map((entry) => ({
    semantic: entry.semantic,
    value: entry.normalized.value,
    unit: entry.normalized.unit
  })), [{
    semantic: "formation-edge-count",
    value: 1,
    unit: "1"
  }]);
  assert.equal(
    population.elements[0].invariants["formation-edge-count"].value,
    1
  );
});

test("formation-derived type rules classify elements from verified invariant thresholds", () => {
  const edgeCountFunctional = functional(
    "formation-edge-count",
    { kind: "count", set: { kind: "edges" } },
    "1",
    "formation-edge-count",
    { absolute: 0 }
  );
  const typed = pipeline(loadedFixture({
    definition: "typed",
    functionals: [edgeCountFunctional]
  }));

  assert.equal(
    typed.profiles.profileDefinition.kind,
    "residual-slots-v3"
  );
  const result = typed.profiles.results[0];
  assert.equal(result.status, "materialized");
  assert.deepEqual(
    result.derivedTypeEvaluations.map((entry) => [
      entry.rule.typeTag,
      entry.outcome,
      entry.comparison.pass
    ]),
    [
      ["multi-support", "not-assigned", false],
      ["one-support", "assigned", true]
    ]
  );
  assert.equal(
    result.derivedTypeEvaluations[0].sourceFunctionalEvaluationHash,
    result.derivedInvariantEvaluations[0].evaluationHash
  );
  assert.deepEqual(result.derivedTypeTags, [
    "derived-fixture",
    "one-support"
  ]);
  assert.deepEqual(
    typed.population.elements[0].typeTags,
    result.derivedTypeTags
  );

  const unmatched = pipeline(loadedFixture({
    definition: "typed",
    functionals: [edgeCountFunctional],
    typeRuleMinimum: 2
  }));
  assert.deepEqual(unmatched.profiles.results[0].derivedTypeTags, [
    "derived-fixture"
  ]);
  assert.notEqual(
    typed.population.elements[0].id,
    unmatched.population.elements[0].id
  );

  const nonstructuralMatched = pipeline(loadedFixture({
    definition: "typed",
    functionals: [edgeCountFunctional],
    identityPolicy: { typeTagsStructural: false }
  }));
  const nonstructuralUnmatched = pipeline(loadedFixture({
    definition: "typed",
    functionals: [edgeCountFunctional],
    identityPolicy: { typeTagsStructural: false },
    typeRuleMinimum: 2
  }));
  assert.deepEqual(
    nonstructuralMatched.population.elements[0].typeTags,
    result.derivedTypeTags
  );
  assert.equal(
    nonstructuralMatched.population.elements[0].id,
    nonstructuralUnmatched.population.elements[0].id
  );
});

test("formation-derived invariants fail closed on unresolved functional values", () => {
  const uncertainFunctional = functional(
    "formation-edge-count",
    {
      kind: "invariant",
      name: "uncertain",
      node: { kind: "canonical-index", index: 0 }
    },
    "1",
    "formation-edge-count",
    { absolute: 0 }
  );
  const loaded = loadedFixture({
    definition: "derived",
    invariants: {
      uncertain: quantity(1, "1", "formation-edge-count", 0.5)
    },
    functionals: [uncertainFunctional]
  });
  const { profiles, population } = pipeline(loaded);

  assert.equal(profiles.status, "indeterminate");
  assert.equal(
    profiles.results[0].reason,
    "profile-derived-invariant-indeterminate"
  );
  assert.equal(
    profiles.results[0].derivedInvariantEvaluations[0].reason,
    "result-tolerance-target-unmet"
  );
  assert.deepEqual(profiles.results[0].consumptions, []);
  assert.equal(profiles.results[0].profile, null);
  assert.equal(population.status, "indeterminate");
  assert.deepEqual(population.elements, []);
});

test("missing capacity and guarded consumption remain explicit indeterminate profiles", () => {
  const missingPipeline = pipeline(loadedFixture({
    slots: [slot("support", "out", 2)]
  }));
  const missing = missingPipeline.profiles;
  assert.equal(missing.status, "indeterminate");
  assert.equal(missing.results[0].reason, "profile-slot-capacity-unavailable");
  assert.equal(missing.results[0].details.endpoint, "target");
  assert.equal(missing.results[0].profile, null);
  assert.deepEqual(missing.results[0].consumptions, []);
  assert.equal(missingPipeline.population.status, "indeterminate");
  assert.deepEqual(missingPipeline.population.elements, []);
  assert.deepEqual(missingPipeline.population.derivationIndex, []);

  const guarded = pipeline(loadedFixture({
    slots: [
      slot("support", "out", 2),
      slot("support", "in", 2, GUARD_HASH)
    ]
  })).profiles;
  assert.equal(guarded.status, "indeterminate");
  assert.equal(guarded.results[0].reason, "profile-slot-guard-unsupported");
});

test("typed partner guards execute over the verified formation constituents", () => {
  const passing = pipeline(loadedFixture({
    slots: [
      slot("support", "out", 2),
      slot("support", "in", 2, {
        op: "partnerTypeTag",
        typeTag: "source"
      })
    ]
  })).profiles;
  assert.equal(passing.status, "complete");
  assert.equal(passing.results[0].guardEvaluations.length, 1);
  assert.equal(passing.results[0].guardEvaluations[0].outcome, "pass");
  assert.equal(
    passing.results[0].consumptions[0].target.guardEvaluationHash,
    passing.results[0].guardEvaluations[0].evaluationHash
  );

  const unsatisfied = pipeline(loadedFixture({
    slots: [
      slot("support", "out", 2),
      slot("support", "in", 2, {
        op: "partnerTypeTag",
        typeTag: "different"
      })
    ]
  })).profiles;
  assert.equal(unsatisfied.status, "indeterminate");
  assert.equal(
    unsatisfied.results[0].reason,
    "profile-slot-guard-unsatisfied"
  );
  assert.equal(unsatisfied.results[0].guardEvaluations[0].outcome, "fail");

  const missingData = pipeline(loadedFixture({
    slots: [
      slot("support", "out", 2),
      slot("support", "in", 2, {
        op: "partnerInvariant",
        name: "missing",
        comparator: "eq",
        value: true
      })
    ]
  })).profiles;
  assert.equal(missingData.status, "indeterminate");
  assert.equal(
    missingData.results[0].reason,
    "profile-slot-guard-indeterminate"
  );
  assert.equal(
    missingData.results[0].guardEvaluations[0].memberOutcomes[0].reason,
    "partner-invariant-unavailable"
  );
});

test("profile-quotient partner guards reject member-dependent representative substitution", () => {
  const profiles = pipeline(loadedFixture({
    primitiveTypeTags: ["alpha"],
    additionalPrimitiveTypeTags: [["beta"]],
    slots: [
      slot("support", "out", 2),
      slot("support", "in", 2, {
        op: "partnerTypeTag",
        typeTag: "alpha"
      })
    ]
  }), { countingDomain: "profile-quotient" }).profiles;

  assert.equal(profiles.status, "indeterminate");
  assert.equal(
    profiles.results[0].reason,
    "profile-slot-guard-indeterminate"
  );
  const evaluation = profiles.results[0].guardEvaluations[0];
  assert.equal(evaluation.reason, "profile-slot-guard-member-disagreement");
  assert.deepEqual(
    evaluation.memberOutcomes.map((entry) => entry.outcome).sort(),
    ["fail", "pass"]
  );
});

test("explicit-only packages never fabricate derived profiles or elements", () => {
  const { profiles, population } = pipeline(
    loadedFixture({ definition: "explicit" })
  );

  assert.equal(profiles.status, "indeterminate");
  assert.equal(profiles.counts.materializedProfiles, 0);
  assert.equal(profiles.counts.indeterminateProfiles, 1);
  assert.equal(
    profiles.results[0].reason,
    "derived-profile-policy-unavailable"
  );
  assert.equal(profiles.results[0].profile, null);
  assert.equal(population.status, "indeterminate");
  assert.equal(population.counts.uniqueElements, 0);
  assert.deepEqual(population.elements, []);
});

test("an empty selected set produces explicit empty profile and depth artifacts", () => {
  const { formations, profiles, population } = pipeline(
    loadedFixture({ requiredEdges: 2 })
  );

  assert.equal(formations.formations.length, 0);
  assert.equal(profiles.status, "empty");
  assert.deepEqual(profiles.results, []);
  assert.deepEqual(profiles.interpretation, {
    status: "empty",
    reasons: ["no-selected-formations"]
  });
  assert.equal(population.status, "empty");
  assert.deepEqual(population.elements, []);
  assert.deepEqual(population.derivationIndex, []);
  assert.deepEqual(population.interpretation, {
    status: "empty",
    reasons: ["no-materialized-elements"]
  });
});

test("derived-profile replay rejects tampering and the configured kernel exposes it", () => {
  const loaded = loadedFixture();
  const {
    config,
    census,
    admission,
    formations,
    profiles,
    population
  } = pipeline(loaded);
  const tampered = canonicalClone(profiles);
  tampered.results[0].profile.slots[0].capacity.max = 99;
  assert.throws(
    () => verifyPackageDerivedProfiles(
      tampered,
      loaded,
      config,
      census,
      admission,
      formations
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DERIVED_PROFILE_MISMATCH"
  );
  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  const viaKernel = kernel.extractPackageDerivedProfiles(
    loaded,
    config,
    census,
    admission,
    formations
  );
  assert.deepEqual(viaKernel, profiles);
  assert.deepEqual(
    kernel.verifyPackageDerivedProfiles(
      profiles,
      loaded,
      config,
      census,
      admission,
      formations
    ),
    profiles
  );
  assert.ok(kernel.capabilities.implemented.includes(
    "package-derived-profile-extraction"
  ));
  const viaKernelPopulation = kernel.materializePackageDerivedDepthPopulation(
    loaded,
    config,
    census,
    admission,
    formations,
    profiles
  );
  assert.deepEqual(viaKernelPopulation, population);
  assert.deepEqual(
    kernel.verifyPackageDerivedDepthPopulation(
      population,
      loaded,
      config,
      census,
      admission,
      formations,
      profiles
    ),
    population
  );
});

test("package level closure reproduces the complete primitive-to-depth-1 chain", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);

  assert.equal(level.closer, "package-level-closure-v1");
  assert.equal(level.scope, "primitive-to-derived-depth-1-v1");
  assert.equal(level.status, "complete");
  assert.equal(level.depth, 1);
  assert.equal(level.metrics.booleanSelectivity, 0.5);
  assert.equal(level.metrics.counts.selectedCandidates, 1);
  assert.equal(level.metrics.counts.uniqueElements, 1);
  assert.equal(level.baseline.status, "not-run");
  assert.equal(level.execution.selectorCount, 0);
  assert.equal(level.execution.requiredFunctionalEvaluations, 0);
  assert.equal(level.execution.usedFunctionalEvaluations, 0);
  assert.equal(level.execution.requiredPerturbationSamples, 0);
  assert.equal(level.execution.usedPerturbationSamples, 0);
  assert.equal(level.execution.requiredSensitivityFunctionalEvaluations, 0);
  const { runHash, ...runBasis } = level.run;
  assert.equal(runHash, hashCanonical(HASH_DOMAINS.RUN, runBasis));
  const { levelHash, ...levelBasis } = level;
  assert.equal(
    levelHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_LEVEL_RESULT, levelBasis)
  );
  assert.deepEqual(
    verifyPackageLevelClosure(level, loaded, config),
    level
  );

  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  assert.deepEqual(kernel.closePackageLevel(loaded, config), level);
  assert.deepEqual(kernel.closeLevel({ package: loaded, config }), level);
  assert.deepEqual(
    kernel.verifyPackageLevelClosure(level, loaded, config),
    level
  );
  assert.ok(kernel.capabilities.implemented.includes("package-level-closure"));
});

test("level closure preserves empty and indeterminate terminals without partial elements", () => {
  const emptyLoaded = loadedFixture({ requiredEdges: 2 });
  const empty = closePackageLevel(emptyLoaded, runConfig());
  assert.equal(empty.status, "empty");
  assert.deepEqual(empty.artifacts.population.elements, []);

  const explicitLoaded = loadedFixture({ definition: "explicit" });
  const indeterminate = closePackageLevel(explicitLoaded, runConfig());
  assert.equal(indeterminate.status, "indeterminate");
  assert.ok(indeterminate.interpretation.reasons.includes(
    "derived-profile-indeterminate"
  ));
  assert.deepEqual(indeterminate.artifacts.population.elements, []);
});

test("level closure integrates configured null models and rejects tampered results", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const withNulls = canonicalClone(config);
  withNulls.nullModels = ["uniform"];
  withNulls.budget.nullModelRuns = 1;
  const controlled = closePackageLevel(loaded, withNulls);
  assert.equal(controlled.baseline.status, "complete");
  assert.equal(controlled.artifacts.nullModels.plan.status, "planned");
  assert.equal(controlled.artifacts.nullModels.proposals.status, "complete");
  assert.equal(controlled.artifacts.nullModels.trialCensuses.status, "complete");
  assert.equal(controlled.artifacts.nullModels.trialSelections.status, "complete");
  assert.deepEqual(
    verifyPackageLevelClosure(controlled, loaded, withNulls),
    controlled
  );

  const level = closePackageLevel(loaded, config);
  const tampered = canonicalClone(level);
  tampered.metrics.counts.uniqueElements = 0;
  assert.throws(
    () => verifyPackageLevelClosure(tampered, loaded, config),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_CLOSURE_MISMATCH"
  );
});

test("level closure enforces execution budgets across all selectors", () => {
  const score = {
    id: "weighted-score",
    expr: { kind: "coefficient", name: "weight" },
    coefficients: {
      weight: {
        value: 1,
        unit: "1",
        tolerance: { absolute: 0 },
        semantic: "weight",
        provenance: { kind: "declared", evidence: [] }
      }
    },
    sensitivityCoefficients: ["weight"],
    result: {
      id: "weighted-score-result",
      unit: "1",
      semantic: "weight",
      toleranceTarget: { absolute: 0 }
    },
    explain: "weight",
    claimRefs: []
  };
  const selector = (id) => ({
    id,
    objective: "min",
    functional: "weighted-score",
    cohortRule: "all",
    epsilon: {
      value: 0,
      unit: "1",
      tolerance: { absolute: 0 },
      semantic: "weight",
      provenance: { kind: "declared", evidence: [] }
    },
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
  });
  const loaded = loadedFixture({
    functionals: [score],
    cohortRules: [{ id: "all", kind: "global" }],
    selectors: [selector("first"), selector("second")]
  });
  const insufficientPerturbations = runConfig();
  insufficientPerturbations.budget.perturbationSamples = 3;
  assert.throws(
    () => closePackageLevel(loaded, insufficientPerturbations),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_CLOSURE_PERTURBATION_BUDGET_EXCEEDED" &&
      error.details.required === "4"
  );

  const config = runConfig();
  config.budget.perturbationSamples = 4;
  assert.throws(
    () => closePackageLevel(loaded, config, { maxFunctionalEvaluations: 1 }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_CLOSURE_RANKING_BUDGET_EXCEEDED" &&
      error.details.required === "2"
  );
  assert.throws(
    () => closePackageLevel(loaded, config, {
      maxSensitivityFunctionalEvaluations: 3
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_CLOSURE_SENSITIVITY_BUDGET_EXCEEDED" &&
      error.details.required === "4"
  );

  const complete = closePackageLevel(loaded, config);
  assert.equal(complete.execution.requiredFunctionalEvaluations, 2);
  assert.equal(complete.execution.usedFunctionalEvaluations, 2);
  assert.equal(complete.execution.requiredPerturbationSamples, 4);
  assert.equal(complete.execution.usedPerturbationSamples, 4);
  assert.equal(
    complete.execution.requiredSensitivityFunctionalEvaluations,
    4
  );
  assert.equal(complete.execution.usedSensitivityFunctionalEvaluations, 4);

  const uncertainScore = canonicalClone(score);
  uncertainScore.coefficients.weight.tolerance.absolute = 0.2;
  uncertainScore.result.toleranceTarget.absolute = 0.1;
  const uncertainLoaded = loadedFixture({
    functionals: [uncertainScore],
    cohortRules: [{ id: "all", kind: "global" }],
    selectors: [selector("first"), selector("second")]
  });
  const indeterminate = closePackageLevel(uncertainLoaded, config);
  assert.equal(indeterminate.status, "indeterminate");
  assert.equal(indeterminate.execution.requiredFunctionalEvaluations, 2);
  assert.equal(indeterminate.execution.usedFunctionalEvaluations, 2);
  assert.equal(indeterminate.execution.requiredPerturbationSamples, 4);
  assert.equal(indeterminate.execution.usedPerturbationSamples, 0);
  assert.equal(
    indeterminate.execution.requiredSensitivityFunctionalEvaluations,
    4
  );
  assert.equal(indeterminate.execution.usedSensitivityFunctionalEvaluations, 0);
});
