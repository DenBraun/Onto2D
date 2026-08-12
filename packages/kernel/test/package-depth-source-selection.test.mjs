import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  admitPackageDepthSelectors,
  canonicalClone,
  closePackageCurrentLevelFixpoint,
  closePackageDepthLevel,
  closePackageLadder,
  closePackageLevel,
  constructPackageDepthCohorts,
  createPackageDepthCandidateBinding,
  createKernel,
  enumeratePackageDepthCandidates,
  evaluatePackageDepthCandidateFilter,
  evaluatePackageDepthCandidateCensus,
  evaluatePackageDepthFunctional,
  evaluatePackageDepthSelectorSensitivity,
  extractPackageDepthDerivedProfiles,
  hashCanonical,
  loadKernelPackage,
  materializePackageDepthSelectedFormations,
  materializePackageDepthDerivedPopulation,
  rankPackageDepthSelector,
  selectPackageDepthSourcePopulation,
  verifyPackageDepthCandidateCensus,
  verifyPackageDepthLevelClosure,
  verifyPackageCurrentLevelFixpoint,
  verifyPackageDepthSourcePopulation,
  verifyPackageLadderClosure
} from "../src/index.js";

function slot(role, polarity, max) {
  return { role, polarity, capacity: { min: 0, max } };
}

function profile(slots = []) {
  return {
    slots,
    invariantVector: [],
    precisionPolicy: "exact-structural-v1"
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

function loadedFixture({
  requiredEdges = 1,
  definition = "residual",
  withSelection = false,
  currentDepthReference = false,
  emptyProfiles = false,
  quantityAttributes = false
} = {}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: `depth-source-${requiredEdges}-${definition}`,
    version: "1.0.0",
    primitives: [{
      sourceId: "source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: quantityAttributes
        ? { mass: quantity(1000, "g", "mass") }
        : {},
      profile: profile(emptyProfiles ? [] : [
        slot("support", "out", 2),
        slot("support", "in", 2)
      ]),
      claimRefs: []
    }],
    ...(quantityAttributes
      ? {
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
              kind: "edge-role-quantity-v1",
              values: { support: quantity(100, "cm", "length") }
            }
          }]
        }
      : {}),
    predicates: [{
      id: "requires-support",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: currentDepthReference ? "self" : "below",
      expr: {
        op: "countRole",
        role: "support",
        min: requiredEdges,
        max: requiredEdges
      },
      explain: { pass: "supported", fail: "unsupported", indeterminate: "unknown" },
      claimRefs: []
    }],
    functionals: [
      ...(withSelection
        ? [{
            id: "node-count",
            expr: {
              kind: "count",
              set: { kind: "nodes", selector: { kind: "all" } }
            },
            coefficients: {},
            sensitivityCoefficients: [],
            result: {
              id: "node-count-result",
              unit: "1",
              semantic: "formation node count",
              toleranceTarget: { absolute: 0 }
            },
            explain: "Prefer the smallest locally admissible formation.",
            claimRefs: []
          }]
        : []),
      ...(quantityAttributes
        ? [{
            id: "formation-mass",
            expr: {
              kind: "sum",
              attribute: "mass",
              set: { kind: "nodes", selector: { kind: "all" } }
            },
            coefficients: {},
            sensitivityCoefficients: [],
            result: {
              id: "formation-mass-result",
              unit: "kg",
              semantic: "mass",
              toleranceTarget: { absolute: 0 }
            },
            explain: "Sum constituent mass into the derived profile.",
            claimRefs: []
          }]
        : [])
    ],
    cohortRules: withSelection ? [{ id: "all", kind: "global" }] : [],
    selectors: withSelection ? [{
      id: "smallest",
      objective: "min",
      functional: "node-count",
      cohortRule: "all",
      epsilon: {
        value: 0,
        unit: "1",
        tolerance: { absolute: 0 },
        semantic: "formation node count",
        provenance: { kind: "declared", evidence: [] }
      },
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 1,
        robustTopKThreshold: 1
      },
      explain: { pass: "smallest", fail: "larger", indeterminate: "unknown" },
      claimRefs: []
    }] : [],
    profileDefinition: definition === "residual" && quantityAttributes
      ? {
          kind: "residual-slots-v2",
          baseProfile: profile(
            emptyProfiles ? [] : [slot("external", "sym", 1)]
          ),
          derivedTypeTags: ["derived"],
          derivedInvariants: [{
            semantic: "mass",
            functional: "formation-mass",
            quantization: quantity(0.001, "kg", "mass")
          }],
          claimRefs: []
        }
      : definition === "residual"
      ? {
          kind: "residual-slots-v1",
          baseProfile: profile(
            emptyProfiles ? [] : [slot("external", "sym", 1)]
          ),
          derivedTypeTags: ["derived"],
          claimRefs: []
        }
      : { kind: "explicit-only" }
  }, currentDepthReference ? { allowCurrentDepthReferences: true } : {});
}

function runConfig(sourceDepths = "all-below") {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths,
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "depth-source-selection-v1",
    invariantPrecision: {
      id: "depth-source-precision-v1",
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
      id: "depth-source-substructure-v1",
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

test("all-below selects primitive and verified derived populations for depth 2", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const selection = selectPackageDepthSourcePopulation(
    loaded,
    config,
    [level],
    2
  );

  assert.equal(selection.selector, "package-depth-source-selector-v2");
  assert.equal(selection.targetDepth, 2);
  assert.deepEqual(selection.availableDepths, [0, 1]);
  assert.deepEqual(selection.selectedDepths, [0, 1]);
  assert.equal(selection.populations[0].kind, "primitive-depth");
  assert.equal(selection.populations[1].kind, "closed-derived-depth");
  assert.equal(selection.populations[1].levelHash, level.levelHash);
  assert.equal(selection.counts.availablePopulations, 2);
  assert.equal(selection.counts.selectedPopulations, 2);
  assert.equal(selection.counts.availableElements, 2);
  assert.equal(selection.counts.selectedElements, 2);
  assert.deepEqual(
    selection.elementIds,
    selection.elements.map((element) => element.id)
  );
  assert.ok(selection.occurrences.every(
    (entry) => entry.minimumDepth === entry.appearances[0].depth
  ));
  const { selectionHash, ...basis } = selection;
  assert.equal(
    selectionHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DEPTH_SOURCE_SELECTION, basis)
  );
  assert.deepEqual(
    verifyPackageDepthSourcePopulation(
      selection,
      loaded,
      config,
      [level],
      2
    ),
    selection
  );
});

test("previous-only selects exactly the immediately preceding complete depth", () => {
  const loaded = loadedFixture();
  const config = runConfig("previous-only");
  const level = closePackageLevel(loaded, config);
  const selection = selectPackageDepthSourcePopulation(
    loaded,
    config,
    [level],
    2
  );

  assert.deepEqual(selection.availableDepths, [0, 1]);
  assert.deepEqual(selection.selectedDepths, [1]);
  assert.equal(selection.counts.selectedPopulations, 1);
  assert.equal(selection.elements.length, 1);
  assert.equal(
    selection.elements[0].id,
    level.artifacts.population.elements[0].id
  );
  assert.equal(selection.elements[0].depth, 1);
});

test("target depth 1 remains a verified primitive-only source selection", () => {
  const loaded = loadedFixture();
  const config = runConfig("previous-only");
  const selection = selectPackageDepthSourcePopulation(
    loaded,
    config,
    [],
    1
  );

  assert.deepEqual(selection.availableDepths, [0]);
  assert.deepEqual(selection.selectedDepths, [0]);
  assert.equal(selection.elements.length, 1);
  assert.equal(selection.elements[0].depth, 0);
});

test("source selection rejects missing, non-complete, over-limit, and tampered levels", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  assert.throws(
    () => selectPackageDepthSourcePopulation(loaded, config, [], 2),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_SOURCE_LEVEL_COVERAGE_INVALID"
  );
  assert.throws(
    () => selectPackageDepthSourcePopulation(loaded, config, [], 65),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_SOURCE_TARGET_DEPTH_UNSUPPORTED"
  );

  const emptyLoaded = loadedFixture({ requiredEdges: 2 });
  const empty = closePackageLevel(emptyLoaded, config);
  assert.throws(
    () => selectPackageDepthSourcePopulation(
      emptyLoaded,
      config,
      [empty],
      2
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_SOURCE_LEVEL_NOT_COMPLETE"
  );

  const level = closePackageLevel(loaded, config);
  const selection = selectPackageDepthSourcePopulation(
    loaded,
    config,
    [level],
    2
  );
  const tampered = canonicalClone(selection);
  tampered.selectedDepths = [1];
  assert.throws(
    () => verifyPackageDepthSourcePopulation(
      tampered,
      loaded,
      config,
      [level],
      2
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_SOURCE_MISMATCH"
  );
  assert.throws(
    () => selectPackageDepthSourcePopulation(
      loaded,
      config,
      [level],
      2,
      { unknown: true }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_SOURCE_OPTION_UNKNOWN"
  );
});

test("the configured kernel exposes source selection and exact verification", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  const selection = kernel.selectPackageDepthSourcePopulation(
    loaded,
    config,
    [level],
    2
  );
  assert.deepEqual(
    kernel.verifyPackageDepthSourcePopulation(
      selection,
      loaded,
      config,
      [level],
      2
    ),
    selection
  );
  assert.ok(kernel.capabilities.implemented.includes(
    "package-depth-source-population-selection"
  ));
});

test("depth-aware binding and enumeration consume the selected element alphabet", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const binding = createPackageDepthCandidateBinding(
    loaded,
    config,
    [level],
    2
  );

  assert.equal(binding.binder, "package-depth-candidate-binding-v2");
  assert.equal(binding.targetDepth, 2);
  assert.deepEqual(binding.sourcePopulation.selectedDepths, [0, 1]);
  assert.deepEqual(
    binding.enumerationInput.nodeVariants.map((entry) => entry.ref),
    binding.sourcePopulation.elementIds
  );
  const { bindingHash, ...basis } = binding;
  assert.equal(
    bindingHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_BINDING, basis)
  );

  const generated = enumeratePackageDepthCandidates(
    loaded,
    config,
    [level],
    2
  );
  assert.equal(generated.binding.bindingHash, binding.bindingHash);
  assert.equal(generated.enumeration.status, "complete");
  const allowed = new Set(binding.sourcePopulation.elementIds);
  for (const record of generated.enumeration.candidateStore.candidates) {
    for (const node of record.candidate.nodes) assert.ok(allowed.has(node.ref));
  }
});

test("depth-aware Quantity attributes continue through derived invariant sources", () => {
  const loaded = loadedFixture({ quantityAttributes: true });
  const config = runConfig();
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  config.graphPolicy.structuralEdgeAttributes = ["span"];
  const level = closePackageLevel(loaded, config);
  assert.equal(level.status, "complete");
  assert.ok(level.artifacts.population.elements.length > 0);
  assert.ok(level.artifacts.population.elements.every((element) =>
    element.invariants.mass?.unit === "kg"
  ));

  const binding = createPackageDepthCandidateBinding(
    loaded,
    config,
    [level],
    2
  );
  assert.deepEqual(binding.sourcePopulation.selectedDepths, [0, 1]);
  assert.ok(binding.enumerationInput.nodeVariants.every((entry) =>
    entry.attrs.mass.unit === "kg"
  ));
  const derivedIds = new Set(level.artifacts.population.elements.map(
    (element) => element.id
  ));
  const carriedVariant = binding.enumerationInput.nodeVariants.find((entry) =>
    derivedIds.has(entry.ref) && entry.attrs.mass.value > 1
  );
  assert.ok(carriedVariant);
  const carriedElement = level.artifacts.population.elements.find(
    (element) => element.id === carriedVariant.ref
  );
  assert.deepEqual(carriedVariant.attrs.mass, carriedElement.invariants.mass);
  assert.equal(carriedVariant.attrs.mass.provenance.kind, "computed");
  const carriedDerivation = level.artifacts.population.derivationIndex.find(
    (entry) => entry.elementId === carriedElement.id
  );
  const carriedProfile = level.artifacts.profiles.results.find(
    (entry) => entry.formationHash === carriedDerivation.primaryFormationHash
  );
  assert.equal(carriedProfile.status, "materialized");
  assert.equal(carriedProfile.derivedInvariantEvaluations.length, 1);
  assert.equal(carriedProfile.derivedInvariantEvaluations[0].status, "scored");
  assert.deepEqual(
    carriedProfile.derivedInvariantEvaluations[0].score,
    carriedElement.invariants.mass
  );
  assert.ok(binding.enumerationInput.edgeVariants.every((entry) =>
    entry.attrs.span.unit === "m"
  ));

  const generated = enumeratePackageDepthCandidates(
    loaded,
    config,
    [level],
    2
  );
  assert.equal(generated.enumeration.status, "complete");
  assert.equal(generated.binding.bindingHash, binding.bindingHash);
});

test("depth-aware profile quotient and previous-only bindings use selected classes", () => {
  const loaded = loadedFixture();
  const previousConfig = runConfig("previous-only");
  previousConfig.countingDomain = "profile-quotient";
  const level = closePackageLevel(loaded, previousConfig);
  const binding = createPackageDepthCandidateBinding(
    loaded,
    previousConfig,
    [level],
    2
  );

  assert.deepEqual(binding.sourcePopulation.selectedDepths, [1]);
  assert.equal(binding.sourcePopulation.elements.length, 1);
  assert.deepEqual(binding.enumerationInput.nodeVariants, [{
    ref: binding.sourcePopulation.profileClasses[0].profileHash
  }]);
});

test("configured kernel exposes depth-aware binding and enumeration", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  const binding = kernel.createPackageDepthCandidateBinding(
    loaded,
    config,
    [level],
    2
  );
  const generated = kernel.enumeratePackageDepthCandidates(
    loaded,
    config,
    [level],
    2
  );
  assert.equal(generated.binding.bindingHash, binding.bindingHash);
  assert.ok(kernel.capabilities.implemented.includes(
    "package-depth-candidate-enumeration"
  ));
});

test("depth-aware filtering resolves derived constituents and binds target depth", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const generated = enumeratePackageDepthCandidates(
    loaded,
    config,
    [level],
    2
  );
  const derivedId = level.artifacts.population.elements[0].id;
  const record = generated.enumeration.candidateStore.candidates.find(
    (entry) => entry.candidate.nodes.length === 1 &&
      entry.candidate.nodes[0].ref === derivedId
  );
  assert.ok(record);
  const evaluation = evaluatePackageDepthCandidateFilter(
    loaded,
    generated.binding,
    [level],
    record.candidate
  );

  assert.equal(
    evaluation.evaluator,
    "package-depth-candidate-filter-evaluator-v1"
  );
  assert.equal(evaluation.formation.targetDepth, 2);
  assert.equal(
    evaluation.formation.sourcePopulationHash,
    generated.binding.sourcePopulation.selectionHash
  );
  assert.equal(evaluation.formation.constituents[0].elementId, derivedId);
  assert.equal(evaluation.verdict, "predicate-rejected");
  const { filterHash, ...basis } = evaluation;
  assert.equal(
    filterHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_FILTER, basis)
  );
});

test("depth-aware filtering rejects stale bindings and nodes outside selected depths", () => {
  const loaded = loadedFixture();
  const config = runConfig("previous-only");
  const level = closePackageLevel(loaded, config);
  const generated = enumeratePackageDepthCandidates(
    loaded,
    config,
    [level],
    2
  );
  const stored = generated.enumeration.candidateStore.candidates[0].candidate;
  const candidate = {
    domain: stored.domain,
    nodes: canonicalClone(stored.nodes),
    edges: canonicalClone(stored.edges)
  };
  candidate.nodes[0].ref = loaded.normalized.primitives[0].elementId;
  assert.throws(
    () => evaluatePackageDepthCandidateFilter(
      loaded,
      generated.binding,
      [level],
      candidate
    ),
    (error) => error.code === "PACKAGE_CANDIDATE_FILTER_VALIDATION_FAILED"
  );

  const stale = canonicalClone(generated.binding);
  stale.targetDepth = 1;
  assert.throws(
    () => evaluatePackageDepthCandidateFilter(
      loaded,
      stale,
      [level],
      generated.enumeration.candidateStore.candidates[0].candidate
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_CANDIDATE_FILTER_BINDING_INVALID"
  );
});

test("configured kernel exposes depth-aware local filtering", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  const generated = kernel.enumeratePackageDepthCandidates(
    loaded,
    config,
    [level],
    2
  );
  const evaluation = kernel.evaluatePackageDepthCandidateFilter(
    loaded,
    generated.binding,
    [level],
    generated.enumeration.candidateStore.candidates[0].candidate
  );
  assert.equal(evaluation.formation.targetDepth, 2);
  assert.ok(kernel.capabilities.implemented.includes(
    "package-depth-candidate-filter-evaluation"
  ));
});

test("depth-aware census covers the complete target-depth-2 universe", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const census = evaluatePackageDepthCandidateCensus(
    loaded,
    config,
    [level],
    2
  );

  assert.equal(census.evaluator, "package-depth-candidate-census-evaluator-v1");
  assert.equal(census.targetDepth, 2);
  assert.equal(
    census.sourcePopulationHash,
    census.generation.binding.sourcePopulation.selectionHash
  );
  assert.equal(
    census.counts.evaluatedCandidates,
    census.generation.enumeration.counts.canonicalCandidates
  );
  assert.equal(
    census.counts.evaluatedCandidates,
    census.counts.predicateRejected +
      census.counts.filterIndeterminate +
      census.counts.eligibleCandidates
  );
  const { censusHash, ...basis } = census;
  assert.equal(
    censusHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_CENSUS, basis)
  );
  assert.deepEqual(
    verifyPackageDepthCandidateCensus(
      census,
      loaded,
      config,
      [level],
      2
    ),
    census
  );

  const tampered = canonicalClone(census);
  tampered.counts.eligibleCandidates += 1;
  assert.throws(
    () => verifyPackageDepthCandidateCensus(
      tampered,
      loaded,
      config,
      [level],
      2
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_CANDIDATE_CENSUS_MISMATCH"
  );
});

test("configured kernel exposes depth-aware census and verification", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  const census = kernel.evaluatePackageDepthCandidateCensus(
    loaded,
    config,
    [level],
    2
  );
  assert.equal(
    kernel.verifyPackageDepthCandidateCensus(
      census,
      loaded,
      config,
      [level],
      2
    ).censusHash,
    census.censusHash
  );
  assert.ok(kernel.capabilities.implemented.includes(
    "package-depth-candidate-local-filter-census"
  ));
});

test("depth-2 selection reuses exact cohort, ranking, sensitivity, and admission semantics", () => {
  const loaded = loadedFixture({ withSelection: true });
  const config = runConfig();
  config.ontologyTarget = { level: 2, phase: "B", segment: "depth-two" };
  const level = closePackageLevel(loaded, config);
  const levels = [level];
  const census = evaluatePackageDepthCandidateCensus(
    loaded,
    config,
    levels,
    2
  );
  const partition = constructPackageDepthCohorts(
    loaded,
    config,
    levels,
    2,
    census,
    "all"
  );
  const ranking = rankPackageDepthSelector(
    loaded,
    config,
    levels,
    2,
    census,
    partition,
    "smallest"
  );
  const sensitivity = evaluatePackageDepthSelectorSensitivity(
    loaded,
    config,
    levels,
    2,
    census,
    partition,
    ranking
  );
  const executions = [{
    selectorId: "smallest",
    partition,
    ranking,
    sensitivity
  }];
  const admission = admitPackageDepthSelectors(
    loaded,
    config,
    levels,
    2,
    census,
    executions
  );
  const formations = materializePackageDepthSelectedFormations(
    loaded,
    config,
    levels,
    2,
    census,
    admission
  );
  const profiles = extractPackageDepthDerivedProfiles(
    loaded,
    config,
    levels,
    2,
    census,
    admission,
    formations
  );
  const population = materializePackageDepthDerivedPopulation(
    loaded,
    config,
    levels,
    2,
    census,
    admission,
    formations,
    profiles
  );
  const closure = closePackageDepthLevel(
    loaded,
    config,
    levels,
    2
  );

  assert.equal(partition.status, "complete");
  assert.equal(ranking.status, "ranked");
  assert.equal(sensitivity.status, "not-applicable");
  assert.equal(admission.status, "complete");
  assert.equal(formations.targetDepth, 2);
  assert.equal(
    formations.formations.length,
    admission.counts.selectedCandidates
  );
  assert.ok(formations.formations.every((entry) => entry.targetDepth === 2));
  assert.equal(profiles.targetDepth, 2);
  assert.equal(profiles.status, "complete");
  assert.equal(population.depth, 2);
  assert.equal(population.status, "complete");
  assert.ok(population.elements.every((entry) => entry.depth === 2));
  assert.ok(population.elements.every((entry) =>
    entry.ontologyCoordinate.level === 2 &&
    entry.axisProvenance.ontologyPhase === "declared"
  ));
  assert.equal(closure.depth, 2);
  assert.equal(closure.status, "complete");
  assert.deepEqual(closure.ontologyCoordinate, config.ontologyTarget);
  assert.deepEqual(closure.axisProvenance, {
    derivationDepth: "computed",
    ontologyLevel: "declared",
    ontologyPhase: "declared"
  });
  assert.equal(
    closure.artifacts.population.populationHash,
    population.populationHash
  );
  assert.deepEqual(
    verifyPackageDepthLevelClosure(
      closure,
      loaded,
      config,
      levels,
      2
    ),
    closure
  );

  const selectedId = admission.selectedCandidateIds[0];
  const filter = census.candidateEvaluations.find(
    (entry) => entry.formation.candidate.id === selectedId
  );
  const evaluation = evaluatePackageDepthFunctional(
    loaded,
    census.generation.binding,
    levels,
    filter,
    "node-count"
  );
  assert.equal(evaluation.status, "scored");
  assert.equal(evaluation.bindingHash, census.bindingHash);
});

test("configured kernel exposes the depth-2 selection and formation chain", () => {
  const kernel = createKernel();
  for (const method of [
    "evaluatePackageDepthFunctional",
    "constructPackageDepthCohorts",
    "verifyPackageDepthCohortPartition",
    "rankPackageDepthSelector",
    "verifyPackageDepthSelectorRanking",
    "evaluatePackageDepthSelectorSensitivity",
    "verifyPackageDepthSelectorSensitivity",
    "admitPackageDepthSelectors",
    "verifyPackageDepthSelectorAdmission",
    "materializePackageDepthSelectedFormations",
    "verifyPackageDepthSelectedFormations",
    "extractPackageDepthDerivedProfiles",
    "verifyPackageDepthDerivedProfiles",
    "materializePackageDepthDerivedPopulation",
    "verifyPackageDepthDerivedPopulation",
    "closePackageDepthLevel",
    "verifyPackageDepthLevelClosure"
  ]) {
    assert.equal(typeof kernel[method], "function", method);
  }
  assert.ok(kernel.capabilities.implemented.includes(
    "package-depth-selected-formation-materialization"
  ));
});

test("a bounded ladder closes three consecutive previous-only depths exactly", () => {
  const loaded = loadedFixture();
  const config = runConfig("previous-only");
  const ladder = closePackageLadder(loaded, config, 3);

  assert.equal(ladder.closer, "package-ladder-closure-v1");
  assert.equal(ladder.requestedDepths, 3);
  assert.equal(ladder.status, "complete");
  assert.deepEqual(ladder.levels.map((level) => level.depth), [1, 2, 3]);
  assert.deepEqual(
    ladder.levels[2].artifacts.census.generation.binding
      .sourcePopulation.selectedDepths,
    [2]
  );
  assert.equal(ladder.counts.executedLevels, 3);
  assert.equal(ladder.selectivityLadder.length, 3);
  assert.equal(ladder.introducedByDepth.length, 3);
  assert.ok(ladder.introducedByDepth.every(
    (entry) => entry.introducedElements > 0
  ));
  const { ladderHash, ...basis } = ladder;
  assert.equal(
    ladderHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_LADDER_RESULT, basis)
  );
  assert.deepEqual(
    verifyPackageLadderClosure(ladder, loaded, config, 3),
    ladder
  );

  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  assert.equal(typeof kernel.closeLadder, "function");
  assert.ok(kernel.capabilities.implemented.includes("package-ladder-closure"));
  assert.ok(!kernel.capabilities.pending.includes("ladder-closure"));
  assert.equal(
    kernel.closeLadder({ package: loaded, config, depths: 3 }).ladderHash,
    ladder.ladderHash
  );
});

test("ladder closure exposes ordinary and bounded current-level fixpoints", () => {
  const config = runConfig();
  const emptyLoaded = loadedFixture({ requiredEdges: 2 });
  const fixpoint = closePackageLadder(emptyLoaded, config, 3);
  assert.equal(fixpoint.status, "fixpoint");
  assert.deepEqual(fixpoint.interpretation, {
    status: "fixpoint",
    reasons: ["no-new-elements"],
    terminalDepth: 1
  });
  assert.equal(fixpoint.counts.executedLevels, 1);
  assert.equal(fixpoint.introducedByDepth[0].introducedElements, 0);

  const explicitOnly = loadedFixture({ definition: "explicit" });
  const indeterminate = closePackageLadder(explicitOnly, config, 3);
  assert.equal(indeterminate.status, "indeterminate");
  assert.deepEqual(indeterminate.interpretation, {
    status: "indeterminate",
    reasons: ["level-indeterminate"],
    terminalDepth: 1
  });
  assert.equal(indeterminate.counts.executedLevels, 1);

  const loaded = loadedFixture();
  config.boundedFixpoint = { enabled: true, maxIterations: 3 };
  const exhausted = closePackageLadder(loaded, config, 2);
  assert.equal(exhausted.closer, "package-fixpoint-ladder-closure-v1");
  assert.equal(exhausted.status, "indeterminate");
  assert.equal(exhausted.levels[0].fixpoint.status, "exhausted");
  assert.equal(exhausted.levels[0].fixpoint.iterations, 3);
  assert.equal(exhausted.levels[0].artifacts.population.status, "indeterminate");
  assert.equal(exhausted.levels[0].artifacts.population.elements.length, 0);
  assert.ok(
    exhausted.levels[0].artifacts.population.tentativeElements.length > 0
  );
  assert.equal(exhausted.levels.length, 1);
  assert.deepEqual(
    verifyPackageLadderClosure(exhausted, loaded, config, 2),
    exhausted
  );

  const selfLoaded = loadedFixture({
    requiredEdges: 2,
    currentDepthReference: true
  });
  const converged = closePackageLadder(selfLoaded, config, 2);
  assert.equal(converged.status, "fixpoint");
  assert.equal(converged.levels[0].fixpoint.status, "converged");
  assert.equal(converged.levels[0].fixpoint.iterations, 1);
  assert.equal(converged.levels[0].status, "empty");
  assert.equal(converged.levels[0].artifacts.population.status, "empty");

  const stableLoaded = loadedFixture({
    requiredEdges: 0,
    currentDepthReference: true,
    emptyProfiles: true
  });
  const stableConfig = runConfig();
  stableConfig.countingDomain = "profile-quotient";
  stableConfig.profileCompositionPolicy = "profile-slot-gate-v1";
  stableConfig.ontologyTarget = { level: 3, phase: "C" };
  stableConfig.boundedFixpoint = { enabled: true, maxIterations: 3 };
  const stable = closePackageLadder(stableLoaded, stableConfig, 2);
  assert.equal(stable.status, "fixpoint");
  assert.equal(stable.levels.length, 2);
  assert.equal(stable.levels[0].status, "complete");
  assert.equal(stable.levels[0].fixpoint.status, "converged");
  assert.equal(stable.levels[0].fixpoint.iterations, 2);
  assert.ok(stable.levels[0].artifacts.population.elements.length > 0);
  assert.deepEqual(
    stable.levels[0].ontologyCoordinate,
    stableConfig.ontologyTarget
  );
  assert.ok(stable.levels[0].artifacts.population.elements.every((element) =>
    element.ontologyCoordinate.level === 3
  ));
  assert.ok(stable.levels[0].rounds.every((round) =>
    round.artifacts.census.generation.profileComposition.status === "complete"
  ));
  const firstRoundByFormation = new Map();
  for (const round of stable.levels[0].rounds) {
    for (const entry of round.artifacts.population.derivationIndex) {
      for (const derivation of entry.derivations) {
        if (!firstRoundByFormation.has(derivation.formationHash)) {
          firstRoundByFormation.set(derivation.formationHash, round.round);
        }
      }
    }
  }
  for (const entry of
    stable.levels[0].artifacts.population.tentativeDerivationIndex) {
    for (const derivation of entry.derivations) {
      assert.equal(
        derivation.fixpointRound,
        firstRoundByFormation.get(derivation.formationHash)
      );
    }
  }
  assert.equal(stable.levels[1].status, "empty");
  assert.equal(stable.levels[1].fixpoint.status, "converged");
  assert.equal(stable.levels[1].fixpoint.iterations, 1);
  const directLevel = closePackageCurrentLevelFixpoint(
    stableLoaded,
    stableConfig
  );
  assert.deepEqual(directLevel, stable.levels[0]);
  assert.deepEqual(
    verifyPackageCurrentLevelFixpoint(
      directLevel,
      stableLoaded,
      stableConfig
    ),
    directLevel
  );
  assert.deepEqual(
    closePackageCurrentLevelFixpoint(
      stableLoaded,
      stableConfig,
      [directLevel],
      2
    ),
    stable.levels[1]
  );
  const tamperedPrior = canonicalClone(directLevel);
  tamperedPrior.fixpoint.iterations = 1;
  assert.throws(
    () => closePackageCurrentLevelFixpoint(
      stableLoaded,
      stableConfig,
      [tamperedPrior],
      2
    ),
    (error) => error instanceof KernelError &&
      error.code === "FIXPOINT_PRIOR_LEVEL_MISMATCH"
  );
  const fixpointKernel = createKernel({
    version: stableLoaded.semanticManifest.kernelVersion
  });
  assert.equal(
    fixpointKernel.closeLevel({
      package: stableLoaded,
      config: stableConfig
    }).levelHash,
    directLevel.levelHash
  );
  assert.deepEqual(
    fixpointKernel.verifyPackageLevelClosure(
      directLevel,
      stableLoaded,
      stableConfig
    ),
    directLevel
  );

  const tampered = canonicalClone(exhausted);
  tampered.levels[0].fixpoint.iterations = 2;
  assert.throws(
    () => verifyPackageLadderClosure(tampered, loaded, config, 2),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LADDER_MISMATCH"
  );
});

test("current-level fixpoint evaluates null models on every round carrier", () => {
  const loaded = loadedFixture({
    requiredEdges: 0,
    currentDepthReference: true,
    emptyProfiles: true
  });
  const config = runConfig();
  config.countingDomain = "profile-quotient";
  config.profileCompositionPolicy = "profile-slot-gate-v1";
  config.boundedFixpoint = { enabled: true, maxIterations: 3 };
  config.nullModels = ["role-shuffle"];
  config.budget.nullModelRuns = 2;

  const closure = closePackageCurrentLevelFixpoint(loaded, config);

  assert.equal(closure.status, "complete");
  assert.equal(closure.fixpoint.status, "converged");
  assert.equal(closure.rounds.length, 2);
  assert.equal(closure.baseline.status, "complete");
  assert.equal(
    closure.baseline.baselineHash,
    closure.rounds.at(-1).baseline.baselineHash
  );
  for (const round of closure.rounds) {
    assert.equal(round.baseline.status, "complete");
    assert.equal(round.artifacts.nullModels.plan.counts.totalTrials, 2);
    assert.equal(round.artifacts.nullModels.proposals.counts.trials, 2);
    assert.equal(round.artifacts.nullModels.trialCensuses.counts.trials, 2);
    assert.equal(round.artifacts.nullModels.trialSelections.counts.trials, 2);
    assert.ok(round.artifacts.nullModels.trialCensuses.trials.every((trial) =>
      trial.occurrenceEvaluations.every((occurrence) =>
        occurrence.filter.evaluator ===
          "package-current-level-candidate-filter-evaluator-v1"
      )
    ));
  }
  assert.equal(
    closure.artifacts.nullModels.plan.planHash,
    closure.rounds.at(-1).artifacts.nullModels.plan.planHash
  );
  assert.deepEqual(
    verifyPackageCurrentLevelFixpoint(closure, loaded, config),
    closure
  );
});

test("current-level fixpoint binds normalized Quantity candidate attributes", () => {
  const loaded = loadedFixture({
    requiredEdges: 2,
    quantityAttributes: true
  });
  const config = runConfig();
  config.boundedFixpoint = { enabled: true, maxIterations: 2 };
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  config.graphPolicy.structuralEdgeAttributes = ["span"];

  const closure = closePackageCurrentLevelFixpoint(loaded, config);
  assert.equal(closure.fixpoint.status, "converged");
  assert.equal(closure.rounds.length, 1);
  const generation = closure.rounds[0].artifacts.census.generation;
  assert.equal(
    generation.binding.enumerationInput.nodeVariants[0].attrs.mass.unit,
    "kg"
  );
  assert.equal(
    generation.binding.enumerationInput.edgeVariants[0].attrs.span.unit,
    "m"
  );
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.nodes.every((node) => node.attrs.mass.unit === "kg") &&
    entry.candidate.edges.every((edge) => edge.attrs.span.unit === "m")
  ));
  assert.deepEqual(
    verifyPackageCurrentLevelFixpoint(closure, loaded, config),
    closure
  );
});
