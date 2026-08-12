import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  admitPackageDepthSelectors,
  admitPackageSelectors,
  constructPackageCohorts,
  closePackageDepthLevel,
  closePackageLevel,
  createKernel,
  createPackageDepthNullModelProposals,
  createPackageDepthNullModelPlan,
  createPackageNullModelProposals,
  createPackageNullModelPlan,
  evaluatePackageCandidateCensus,
  evaluatePackageDepthCandidateCensus,
  evaluatePackageDepthNullModelTrialCensuses,
  evaluatePackageDepthNullModelTrialSelections,
  evaluatePackageDepthNullModelBaseline,
  evaluatePackageNullModelTrialCensuses,
  evaluatePackageNullModelTrialSelections,
  evaluatePackageNullModelBaseline,
  evaluatePackageSelectorSensitivity,
  hashCanonical,
  loadKernelPackage,
  rankPackageSelector,
  verifyPackageDepthLevelClosure,
  verifyPackageDepthNullModelPlan,
  verifyPackageDepthNullModelProposals,
  verifyPackageDepthNullModelTrialCensuses,
  verifyPackageDepthNullModelTrialSelections,
  verifyPackageDepthNullModelBaseline,
  verifyPackageNullModelProposals,
  verifyPackageNullModelTrialCensuses,
  verifyPackageNullModelTrialSelections,
  verifyPackageNullModelBaseline,
  verifyPackageNullModelPlan,
  verifyPackageLevelClosure
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

function quantity(value, semantic) {
  return {
    value,
    unit: "m",
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function selectionLoaded() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-null-model-trial-selection-fixture",
    version: "1.0.0",
    primitives: [
      primitive("selection-c", "selection", { score: quantity(2, "score") }),
      primitive("selection-a", "selection", { score: quantity(0, "score") }),
      primitive("selection-b", "selection", { score: quantity(1, "score") })
    ],
    functionals: [{
      id: "minimum-score-functional",
      expr: { kind: "invariant", name: "score" },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "minimum-score-result",
        unit: "m",
        semantic: "score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "Rank each trial occurrence by its proposed candidate score.",
      claimRefs: []
    }],
    cohortRules: [{ id: "trial-global", kind: "global" }],
    selectors: [{
      id: "minimum-score-selector",
      objective: "min",
      functional: "minimum-score-functional",
      cohortRule: "trial-global",
      epsilon: quantity(0, "score epsilon"),
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
    }]
  });
}

function sensitiveSelectionLoaded() {
  const functional = {
    id: "sensitive-score",
    expr: {
      kind: "add",
      terms: [
        { kind: "invariant", name: "offset" },
        {
          kind: "multiply",
          factors: [
            { kind: "coefficient", name: "a" },
            { kind: "invariant", name: "weight-a" }
          ]
        }
      ]
    },
    coefficients: { a: quantity(0.2, "coefficient a") },
    sensitivityCoefficients: ["a"],
    result: {
      id: "sensitive-score-result",
      unit: "m",
      semantic: "sensitive score",
      toleranceTarget: { absolute: 0 }
    },
    explain: "Exercise trial-local coefficient sensitivity.",
    claimRefs: []
  };
  functional.coefficients.a.unit = "1";
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-null-model-trial-sensitivity-fixture",
    version: "1.0.0",
    primitives: [
      primitive("sensitive-a", "sensitive", {
        offset: quantity(0, "sensitive score"),
        "weight-a": quantity(1, "sensitive score")
      }),
      primitive("sensitive-b", "sensitive", {
        offset: quantity(1, "sensitive score"),
        "weight-a": quantity(1, "sensitive score")
      })
    ],
    functionals: [functional],
    cohortRules: [{ id: "sensitive-global", kind: "global" }],
    selectors: [{
      id: "sensitive-minimum",
      objective: "min",
      functional: "sensitive-score",
      cohortRule: "sensitive-global",
      epsilon: quantity(0, "sensitive epsilon"),
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
    }]
  });
}

function depthClosureLoaded() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-null-model-depth-closure-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "depth-source",
      kind: "primitive",
      typeTags: ["depth-source"],
      invariants: {},
      profile: {
        slots: [
          {
            role: "support",
            polarity: "out",
            capacity: { min: 0, max: 2 }
          },
          {
            role: "support",
            polarity: "in",
            capacity: { min: 0, max: 2 }
          }
        ],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }],
    predicates: [{
      id: "requires-one-support-edge",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: {
        op: "countRole",
        role: "support",
        min: 1,
        max: 1
      },
      explain: {
        pass: "one support edge",
        fail: "not one support edge",
        indeterminate: "unknown"
      },
      claimRefs: []
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [{
          role: "external",
          polarity: "sym",
          capacity: { min: 0, max: 1 }
        }],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      derivedTypeTags: ["depth-derived"],
      claimRefs: []
    }
  });
}

function observedAdmission(packageArtifact, config, census) {
  const executions = packageArtifact.normalized.selectors.map((selector) => {
    const partition = constructPackageCohorts(
      packageArtifact,
      config,
      census,
      selector.cohortRule
    );
    const ranking = rankPackageSelector(
      packageArtifact,
      config,
      census,
      partition,
      selector.id
    );
    const sensitivity = evaluatePackageSelectorSensitivity(
      packageArtifact,
      config,
      census,
      partition,
      ranking
    );
    return { selectorId: selector.id, partition, ranking, sensitivity };
  });
  return admitPackageSelectors(
    packageArtifact,
    config,
    census,
    executions
  );
}

function loaded() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-null-model-plan-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ]
  });
}

function runConfig(overrides = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support", "transfer"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 20,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-null-model-plan-seed-v1",
    invariantPrecision: {
      id: "package-null-model-plan-precision-v1",
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

function configured(models = ["uniform", "role-shuffle", "degree-rewire"]) {
  return runConfig({
    nullModels: models,
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 20,
      perturbationSamples: 0,
      nullModelRuns: 2
    }
  });
}

test("null-model planning binds a complete carrier and independent deterministic streams", () => {
  const packageArtifact = loaded();
  const config = configured();
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);

  assert.equal(plan.planner, "package-null-model-plan-v1");
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.interpretation, {
    status: "planned",
    reasons: ["trial-execution-and-metric-distributions-pending"]
  });
  assert.deepEqual(
    plan.modelContracts.map((entry) => entry.model),
    ["degree-rewire", "role-shuffle", "uniform"]
  );
  assert.deepEqual(plan.counts, {
    models: 3,
    trialsPerModel: 2,
    totalTrials: 6,
    carrierCandidates: census.counts.canonicalCandidates
  });
  assert.deepEqual(
    plan.carrierPopulation.candidateIds,
    census.candidateEvaluations.map((entry) => entry.formation.candidate.id)
  );
  assert.equal(plan.carrierPopulation.censusHash, census.censusHash);
  assert.equal(plan.ontologyGate.kind, "derivation-depth-target-v1");
  assert.equal(plan.ontologyGate.targetDepth, 1);
  assert.equal(new Set(plan.trials.map((entry) => entry.streamHash)).size, 6);
  assert.equal(new Set(plan.trials.map((entry) => entry.trialId)).size, 6);
  assert.ok(plan.trials.every((entry) =>
    entry.carrierHash === plan.carrierPopulation.carrierHash
  ));
  const { planHash, ...basis } = plan;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_PLAN, basis),
    planHash
  );
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.trials));
  assert.equal(
    verifyPackageNullModelPlan(plan, packageArtifact, config, census).planHash,
    plan.planHash
  );
  assert.equal(
    createKernel().createPackageNullModelPlan(
      packageArtifact,
      config,
      census
    ).planHash,
    plan.planHash
  );

  const reorderedConfig = configured([
    "degree-rewire",
    "uniform",
    "role-shuffle"
  ]);
  const reorderedCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    reorderedConfig
  );
  assert.equal(
    createPackageNullModelPlan(
      packageArtifact,
      reorderedConfig,
      reorderedCensus
    ).planHash,
    plan.planHash
  );
});

test("null-model planning preserves explicit disabled and ontology-gated states", () => {
  const packageArtifact = loaded();
  const disabledConfig = runConfig();
  const disabledCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    disabledConfig
  );
  const disabled = createPackageNullModelPlan(
    packageArtifact,
    disabledConfig,
    disabledCensus
  );

  assert.equal(disabled.status, "not-run");
  assert.deepEqual(disabled.modelContracts, []);
  assert.deepEqual(disabled.trials, []);
  assert.deepEqual(disabled.counts, {
    models: 0,
    trialsPerModel: 0,
    totalTrials: 0,
    carrierCandidates: disabledCensus.counts.canonicalCandidates
  });
  assert.deepEqual(disabled.interpretation, {
    status: "not-run",
    reasons: ["null-models-disabled"]
  });

  const gatedConfig = {
    ...configured(["uniform"]),
    ontologyTarget: { level: 4, phase: "B", segment: "core" }
  };
  const gatedCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    gatedConfig
  );
  const gated = createPackageNullModelPlan(
    packageArtifact,
    gatedConfig,
    gatedCensus
  );
  assert.deepEqual(gated.ontologyGate, {
    kind: "run-ontology-target-v1",
    targetDepth: 1,
    ontologyCoordinate: { level: 4, phase: "B", segment: "core" }
  });
  assert.notEqual(gated.planHash, disabled.planHash);
});

test("stream identity changes with seed and depth-aware planning uses the same contract", () => {
  const packageArtifact = loaded();
  const config = configured(["uniform"]);
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);
  const changedSeedConfig = { ...config, seed: "changed-independent-seed-v1" };
  const changedSeedCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    changedSeedConfig
  );
  const changedSeed = createPackageNullModelPlan(
    packageArtifact,
    changedSeedConfig,
    changedSeedCensus
  );

  assert.notEqual(changedSeed.planHash, plan.planHash);
  assert.notDeepEqual(
    changedSeed.trials.map((entry) => entry.streamHash),
    plan.trials.map((entry) => entry.streamHash)
  );

  const depthCensus = evaluatePackageDepthCandidateCensus(
    packageArtifact,
    config,
    [],
    1
  );
  const depthPlan = createPackageDepthNullModelPlan(
    packageArtifact,
    config,
    [],
    1,
    depthCensus
  );
  assert.equal(depthPlan.status, "planned");
  assert.equal(depthPlan.censusHash, depthCensus.censusHash);
  assert.equal(depthPlan.carrierPopulation.targetDepth, 1);
  assert.equal(
    verifyPackageDepthNullModelPlan(
      depthPlan,
      packageArtifact,
      config,
      [],
      1,
      depthCensus
    ).planHash,
    depthPlan.planHash
  );
});

test("planning rejects incomplete configuration, excess trials, unknown options, and tampering", () => {
  const packageArtifact = loaded();
  const enabledWithoutRuns = runConfig({ nullModels: ["uniform"] });
  const enabledWithoutRunsCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    enabledWithoutRuns
  );
  assert.throws(
    () => createPackageNullModelPlan(
      packageArtifact,
      enabledWithoutRuns,
      enabledWithoutRunsCensus
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_CONFIGURATION_INCOMPLETE"
  );

  const configuredArtifact = configured();
  const census = evaluatePackageCandidateCensus(
    packageArtifact,
    configuredArtifact
  );
  assert.throws(
    () => createPackageNullModelPlan(
      packageArtifact,
      configuredArtifact,
      census,
      { maxNullTrials: 5 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PLAN_TRIAL_LIMIT" &&
      error.details.required === "6"
  );
  assert.throws(
    () => createPackageNullModelPlan(
      packageArtifact,
      configuredArtifact,
      census,
      { unsupported: true }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PLAN_OPTION_UNKNOWN"
  );
  assert.throws(
    () => createPackageNullModelPlan(
      packageArtifact,
      configuredArtifact,
      census,
      { maxNullTrials: 10_001 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PLAN_LIMIT_INVALID" &&
      error.details.maximum === 10_000
  );

  const plan = createPackageNullModelPlan(
    packageArtifact,
    configuredArtifact,
    census
  );
  const tampered = structuredClone(plan);
  tampered.trials[0].trialIndex = 9;
  assert.throws(
    () => verifyPackageNullModelPlan(
      tampered,
      packageArtifact,
      configuredArtifact,
      census
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PLAN_MISMATCH" &&
      error.details.expectedPlanHash === plan.planHash
  );
  assert.throws(
    () => verifyPackageNullModelPlan(
      undefined,
      packageArtifact,
      configuredArtifact,
      census
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PLAN_INVALID"
  );
});

function degreeSignature(candidate) {
  const roles = [...new Set(candidate.edges.map((edge) => edge.role))].sort();
  return roles.map((role) => ({
    role,
    nodes: candidate.nodes.map((unused, node) => ({
      incoming: candidate.edges.filter(
        (edge) => edge.role === role && edge.to === node
      ).length,
      outgoing: candidate.edges.filter(
        (edge) => edge.role === role && edge.from === node
      ).length
    })).sort((left, right) =>
      left.incoming - right.incoming || left.outgoing - right.outgoing
    )
  }));
}

test("all null models generate bounded deterministic carrier-size proposals", () => {
  const packageArtifact = loadKernelPackage({
    schemaVersion: "1",
    id: "package-null-model-proposal-fixture",
    version: "1.0.0",
    primitives: [primitive("proposal-source", "proposal")]
  });
  const config = {
    ...configured(),
    budget: {
      maxNodes: 3,
      maxEdges: 2,
      maxCandidates: 10_000,
      perturbationSamples: 0,
      nullModelRuns: 1
    }
  };
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);
  const proposals = createPackageNullModelProposals(
    packageArtifact,
    config,
    census,
    plan
  );
  const carrier = new Map(census.candidateEvaluations.map((entry) => [
    entry.formation.candidate.id,
    entry.formation.candidate
  ]));

  assert.equal(proposals.status, "complete");
  assert.deepEqual(proposals.interpretation, {
    status: "proposal-complete",
    reasons: ["trial-evaluation-and-distributions-pending"]
  });
  assert.equal(proposals.trials.length, 3);
  assert.equal(
    proposals.counts.occurrences,
    census.counts.canonicalCandidates * 3
  );
  assert.equal(
    verifyPackageNullModelProposals(
      proposals,
      packageArtifact,
      config,
      census,
      plan
    ).proposalsHash,
    proposals.proposalsHash
  );
  assert.equal(
    createKernel().createPackageNullModelProposals(
      packageArtifact,
      config,
      census,
      plan
    ).proposalsHash,
    proposals.proposalsHash
  );

  const byModel = new Map(proposals.trials.map((trial) => [trial.model, trial]));
  assert.ok(proposals.trials.every((trial) =>
    trial.occurrences.every((entry) => carrier.has(entry.candidateId))
  ));
  const roleTrial = byModel.get("role-shuffle");
  for (const occurrence of roleTrial.occurrences) {
    const source = carrier.get(occurrence.sourceCandidateId);
    assert.deepEqual(
      occurrence.candidate.edges.map((edge) => edge.role).sort(),
      source.edges.map((edge) => edge.role).sort()
    );
    assert.equal(occurrence.candidate.skeleton, source.skeleton);
  }

  const degreeTrial = byModel.get("degree-rewire");
  assert.ok(degreeTrial.counts.attemptedSwaps > 0);
  assert.equal(
    degreeTrial.counts.attemptedSwaps,
    degreeTrial.counts.acceptedSwaps + degreeTrial.counts.rejectedSwaps
  );
  for (const occurrence of degreeTrial.occurrences) {
    assert.deepEqual(
      degreeSignature(occurrence.candidate),
      degreeSignature(carrier.get(occurrence.sourceCandidateId))
    );
  }

  const uniformTrial = byModel.get("uniform");
  assert.ok(uniformTrial.occurrences.every((entry) => carrier.has(entry.candidateId)));
  assert.ok(uniformTrial.occurrences.every((entry) =>
    entry.operation.frameSize === carrier.size &&
    entry.operation.replacement === "with-replacement"
  ));

  const { proposalsHash, ...basis } = proposals;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_PROPOSALS, basis),
    proposalsHash
  );
  const tampered = structuredClone(proposals);
  tampered.trials[0].occurrences[0].candidateId =
    tampered.trials[0].occurrences.at(-1).candidateId;
  assert.throws(
    () => verifyPackageNullModelProposals(
      tampered,
      packageArtifact,
      config,
      census,
      plan
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PROPOSALS_MISMATCH"
  );
  assert.throws(
    () => createPackageNullModelProposals(
      packageArtifact,
      config,
      census,
      plan,
      { maxProposalOccurrences: 1 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_PROPOSAL_OCCURRENCE_LIMIT"
  );
});

test("disabled and depth-aware proposal artifacts preserve their honest boundary", () => {
  const packageArtifact = loaded();
  const disabledConfig = runConfig();
  const disabledCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    disabledConfig
  );
  const disabledPlan = createPackageNullModelPlan(
    packageArtifact,
    disabledConfig,
    disabledCensus
  );
  const disabled = createPackageNullModelProposals(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan
  );
  assert.equal(disabled.status, "not-run");
  assert.deepEqual(disabled.trials, []);
  assert.equal(disabled.counts.occurrences, 0);

  const config = configured(["uniform"]);
  const depthCensus = evaluatePackageDepthCandidateCensus(
    packageArtifact,
    config,
    [],
    1
  );
  const depthPlan = createPackageDepthNullModelPlan(
    packageArtifact,
    config,
    [],
    1,
    depthCensus
  );
  const depthProposals = createPackageDepthNullModelProposals(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan
  );
  assert.equal(depthProposals.status, "complete");
  assert.equal(depthProposals.trials.length, 2);
  assert.equal(
    verifyPackageDepthNullModelProposals(
      depthProposals,
      packageArtifact,
      config,
      [],
      1,
      depthCensus,
      depthPlan
    ).proposalsHash,
    depthProposals.proposalsHash
  );
});

test("null-model trial censuses refilter every occurrence without deduplicating samples", () => {
  const packageArtifact = loadKernelPackage({
    schemaVersion: "1",
    id: "package-null-model-trial-census-fixture",
    version: "1.0.0",
    primitives: [primitive("trial-census-source", "trial-census")]
  });
  const config = {
    ...configured(),
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 1_000,
      perturbationSamples: 0,
      nullModelRuns: 2
    }
  };
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);
  const proposals = createPackageNullModelProposals(
    packageArtifact,
    config,
    census,
    plan
  );
  const trialCensuses = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    config,
    census,
    plan,
    proposals
  );
  const expectedOccurrences =
    census.counts.canonicalCandidates * plan.counts.totalTrials;

  assert.equal(trialCensuses.status, "complete");
  assert.deepEqual(trialCensuses.interpretation, {
    status: "local-census-complete",
    reasons: ["cohorts-functionals-selectors-and-distributions-pending"]
  });
  assert.equal(trialCensuses.counts.trials, plan.counts.totalTrials);
  assert.equal(trialCensuses.counts.evaluatedOccurrences, expectedOccurrences);
  assert.equal(trialCensuses.counts.eligible, expectedOccurrences);
  assert.equal(trialCensuses.counts.predicateRejected, 0);
  assert.equal(trialCensuses.counts.filterIndeterminate, 0);
  assert.equal(trialCensuses.counts.validTrials, plan.counts.totalTrials);
  assert.ok(trialCensuses.trials.every((trial) =>
    trial.counts.evaluatedOccurrences === census.counts.canonicalCandidates &&
    trial.booleanSelectivity === 1 &&
    trial.indeterminateRatio === 0 &&
    trial.predicateCensus.length === 0
  ));
  const occurrences = trialCensuses.trials.flatMap(
    (trial) => trial.occurrenceEvaluations
  );
  assert.equal(new Set(occurrences.map((entry) => entry.occurrenceId)).size,
    expectedOccurrences);
  assert.ok(occurrences.every((entry) =>
    entry.filter.formation.candidate.id === entry.candidateId
  ));
  assert.equal(
    verifyPackageNullModelTrialCensuses(
      trialCensuses,
      packageArtifact,
      config,
      census,
      plan,
      proposals
    ).trialCensusesHash,
    trialCensuses.trialCensusesHash
  );
  assert.equal(
    createKernel().evaluatePackageNullModelTrialCensuses(
      packageArtifact,
      config,
      census,
      plan,
      proposals
    ).trialCensusesHash,
    trialCensuses.trialCensusesHash
  );
  const { trialCensusesHash, ...basis } = trialCensuses;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_CENSUSES, basis),
    trialCensusesHash
  );

  const tampered = structuredClone(trialCensuses);
  tampered.trials[0].counts.eligible -= 1;
  assert.throws(
    () => verifyPackageNullModelTrialCensuses(
      tampered,
      packageArtifact,
      config,
      census,
      plan,
      proposals
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_TRIAL_CENSUSES_MISMATCH"
  );
});

test("disabled and depth-aware trial censuses retain exact occurrence scope", () => {
  const packageArtifact = loaded();
  const disabledConfig = runConfig();
  const disabledCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    disabledConfig
  );
  const disabledPlan = createPackageNullModelPlan(
    packageArtifact,
    disabledConfig,
    disabledCensus
  );
  const disabledProposals = createPackageNullModelProposals(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan
  );
  const disabled = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan,
    disabledProposals
  );
  assert.equal(disabled.status, "not-run");
  assert.deepEqual(disabled.trials, []);
  assert.equal(disabled.counts.evaluatedOccurrences, 0);

  const config = configured(["uniform"]);
  const depthCensus = evaluatePackageDepthCandidateCensus(
    packageArtifact,
    config,
    [],
    1
  );
  const depthPlan = createPackageDepthNullModelPlan(
    packageArtifact,
    config,
    [],
    1,
    depthCensus
  );
  const depthProposals = createPackageDepthNullModelProposals(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan
  );
  const depthTrialCensuses = evaluatePackageDepthNullModelTrialCensuses(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan,
    depthProposals
  );
  assert.equal(depthTrialCensuses.status, "complete");
  assert.equal(depthTrialCensuses.counts.trials, 2);
  assert.equal(
    verifyPackageDepthNullModelTrialCensuses(
      depthTrialCensuses,
      packageArtifact,
      config,
      [],
      1,
      depthCensus,
      depthPlan,
      depthProposals
    ).trialCensusesHash,
    depthTrialCensuses.trialCensusesHash
  );
});

test("null-model trial selection retains occurrence multiplicity and reruns the complete selector pipeline", () => {
  const packageArtifact = selectionLoaded();
  const config = {
    ...configured(),
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 2
    }
  };
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);
  const proposals = createPackageNullModelProposals(
    packageArtifact,
    config,
    census,
    plan
  );
  const trialCensuses = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    config,
    census,
    plan,
    proposals
  );
  const selections = evaluatePackageNullModelTrialSelections(
    packageArtifact,
    config,
    census,
    plan,
    proposals,
    trialCensuses
  );

  assert.equal(selections.status, "complete");
  assert.deepEqual(selections.interpretation, {
    status: "trial-selection-complete",
    reasons: ["metric-distributions-and-baseline-interpretation-pending"]
  });
  assert.equal(selections.trials.length, plan.counts.totalTrials);
  assert.equal(
    selections.counts.evaluatedOccurrences,
    trialCensuses.counts.evaluatedOccurrences
  );
  assert.equal(
    selections.counts.baseFunctionalEvaluations,
    trialCensuses.counts.eligible
  );
  assert.equal(selections.counts.sensitivityFunctionalEvaluations, 0);
  for (const trial of selections.trials) {
    const censusTrial = trialCensuses.trials.find(
      (entry) => entry.trialId === trial.trialId
    );
    const execution = trial.selectorExecutions[0];
    const members = execution.ranking.cohortRankings.flatMap(
      (cohort) => cohort.members
    );
    assert.equal(members.length, censusTrial.counts.eligible);
    assert.equal(new Set(members.map((member) => member.candidateId)).size,
      members.length);
    assert.ok(members.every((member) => {
      const occurrence = censusTrial.occurrenceEvaluations.find(
        (entry) => entry.occurrenceId === member.candidateId
      );
      return occurrence !== undefined &&
        member.evaluation.candidateId === occurrence.candidateId;
    }));
    assert.deepEqual(
      trial.selectedOccurrenceIds,
      execution.ranking.cohortRankings[0].semanticExtrema
    );
    assert.equal(trial.metrics.booleanSelectivity, 1);
    assert.equal(trial.metrics.indeterminateRatio, 0);
    assert.equal(execution.sensitivity.status, "not-applicable");
    assert.deepEqual(execution.sensitivity.reasons, [
      "no-sensitivity-coefficients"
    ]);
  }
  const uniformCensuses = trialCensuses.trials.filter(
    (trial) => trial.model === "uniform"
  );
  const duplicateTrial = uniformCensuses.find((trial) =>
    new Set(trial.occurrenceEvaluations.map((entry) => entry.candidateId)).size <
      trial.occurrenceEvaluations.length
  );
  assert.ok(duplicateTrial, "the frozen seed must exercise replacement duplicates");
  const duplicateSelection = selections.trials.find(
    (trial) => trial.trialId === duplicateTrial.trialId
  );
  assert.equal(
    duplicateSelection.selectorExecutions[0].ranking.counts.members,
    duplicateTrial.occurrenceEvaluations.length
  );
  assert.equal(
    verifyPackageNullModelTrialSelections(
      selections,
      packageArtifact,
      config,
      census,
      plan,
      proposals,
      trialCensuses
    ).trialSelectionsHash,
    selections.trialSelectionsHash
  );
  assert.equal(
    createKernel().evaluatePackageNullModelTrialSelections(
      packageArtifact,
      config,
      census,
      plan,
      proposals,
      trialCensuses
    ).trialSelectionsHash,
    selections.trialSelectionsHash
  );
  const { trialSelectionsHash, ...basis } = selections;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_SELECTIONS, basis),
    trialSelectionsHash
  );

  const tampered = structuredClone(selections);
  tampered.trials[0].counts.selected += 1;
  assert.throws(
    () => verifyPackageNullModelTrialSelections(
      tampered,
      packageArtifact,
      config,
      census,
      plan,
      proposals,
      trialCensuses
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_MISMATCH"
  );
  assert.throws(
    () => evaluatePackageNullModelTrialSelections(
      packageArtifact,
      config,
      census,
      plan,
      proposals,
      trialCensuses,
      { maxFunctionalEvaluations: 1 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_TRIAL_FUNCTIONAL_EVALUATION_LIMIT"
  );
});

test("disabled and depth-aware null-trial selection preserve the same occurrence contract", () => {
  const packageArtifact = loaded();
  const disabledConfig = runConfig();
  const disabledCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    disabledConfig
  );
  const disabledPlan = createPackageNullModelPlan(
    packageArtifact,
    disabledConfig,
    disabledCensus
  );
  const disabledProposals = createPackageNullModelProposals(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan
  );
  const disabledTrialCensuses = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan,
    disabledProposals
  );
  const disabled = evaluatePackageNullModelTrialSelections(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan,
    disabledProposals,
    disabledTrialCensuses
  );
  assert.equal(disabled.status, "not-run");
  assert.deepEqual(disabled.trials, []);
  assert.equal(disabled.counts.evaluatedOccurrences, 0);

  const config = configured(["uniform"]);
  const depthCensus = evaluatePackageDepthCandidateCensus(
    packageArtifact,
    config,
    [],
    1
  );
  const depthPlan = createPackageDepthNullModelPlan(
    packageArtifact,
    config,
    [],
    1,
    depthCensus
  );
  const depthProposals = createPackageDepthNullModelProposals(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan
  );
  const depthTrialCensuses = evaluatePackageDepthNullModelTrialCensuses(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan,
    depthProposals
  );
  const depthSelections = evaluatePackageDepthNullModelTrialSelections(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan,
    depthProposals,
    depthTrialCensuses
  );
  assert.equal(depthSelections.status, "complete");
  assert.equal(depthSelections.counts.trials, 2);
  assert.equal(
    verifyPackageDepthNullModelTrialSelections(
      depthSelections,
      packageArtifact,
      config,
      [],
      1,
      depthCensus,
      depthPlan,
      depthProposals,
      depthTrialCensuses
    ).trialSelectionsHash,
    depthSelections.trialSelectionsHash
  );
});

test("null-trial selectors execute the declared coefficient sensitivity sweep for every occurrence", () => {
  const packageArtifact = sensitiveSelectionLoaded();
  const config = {
    ...configured(["uniform"]),
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 100,
      perturbationSamples: 2,
      nullModelRuns: 1
    }
  };
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);
  const proposals = createPackageNullModelProposals(
    packageArtifact,
    config,
    census,
    plan
  );
  const trialCensuses = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    config,
    census,
    plan,
    proposals
  );
  const selections = evaluatePackageNullModelTrialSelections(
    packageArtifact,
    config,
    census,
    plan,
    proposals,
    trialCensuses
  );
  const execution = selections.trials[0].selectorExecutions[0];

  assert.equal(execution.sensitivity.status, "complete");
  assert.equal(execution.sensitivity.verdict, "robust");
  assert.equal(
    selections.trials[0].metricInterpretation.variationalSelectivity
      ["sensitive-minimum"].status,
    "valid"
  );
  assert.equal(execution.sensitivity.variants.length, 2);
  assert.equal(execution.sensitivity.execution.usedFunctionalEvaluations, 4);
  assert.equal(selections.counts.sensitivityFunctionalEvaluations, 4);
  assert.equal(
    selections.execution.preflight.sensitivityEvaluationUpperBound,
    4
  );
  assert.ok(execution.sensitivity.variants.every((variant) =>
    variant.cohortRankings[0].members.length ===
      trialCensuses.trials[0].counts.eligible
  ));
  assert.throws(
    () => evaluatePackageNullModelTrialSelections(
      packageArtifact,
      config,
      census,
      plan,
      proposals,
      trialCensuses,
      { maxSensitivityFunctionalEvaluations: 3 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_TRIAL_SENSITIVITY_EVALUATION_LIMIT"
  );
});

test("null-model baselines keep models separate and handle zero variance without fabricated z scores", () => {
  const packageArtifact = selectionLoaded();
  const config = {
    ...configured(),
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 2
    }
  };
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const admission = observedAdmission(packageArtifact, config, census);
  const plan = createPackageNullModelPlan(packageArtifact, config, census);
  const proposals = createPackageNullModelProposals(
    packageArtifact,
    config,
    census,
    plan
  );
  const trialCensuses = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    config,
    census,
    plan,
    proposals
  );
  const trialSelections = evaluatePackageNullModelTrialSelections(
    packageArtifact,
    config,
    census,
    plan,
    proposals,
    trialCensuses
  );
  const baseline = evaluatePackageNullModelBaseline(
    packageArtifact,
    config,
    census,
    admission,
    plan,
    proposals,
    trialCensuses,
    trialSelections
  );

  assert.equal(baseline.status, "complete");
  assert.deepEqual(Object.keys(baseline.models), [
    "degree-rewire",
    "role-shuffle",
    "uniform"
  ]);
  assert.ok(Object.values(baseline.models).every((model) =>
    model.runs === 2 &&
    model.samplesArtifact === trialSelections.trialSelectionsHash
  ));
  for (const modelId of ["degree-rewire", "role-shuffle"]) {
    const distribution = baseline.models[modelId].metrics.booleanSelectivity;
    assert.equal(distribution.mean, 1);
    assert.equal(distribution.sd, 0);
    assert.equal(distribution.z, null);
    assert.equal(distribution.constantRelation, "equal");
    assert.ok(distribution.notes.includes(
      "zero-variance-observed-equals-null-constant"
    ));
  }
  assert.ok(Object.values(baseline.models).every((model) =>
    Object.keys(model.metrics.variationalSelectivity).join() ===
      "minimum-score-selector"
  ));
  assert.equal(
    verifyPackageNullModelBaseline(
      baseline,
      packageArtifact,
      config,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections
    ).baselineHash,
    baseline.baselineHash
  );
  assert.equal(
    createKernel().evaluatePackageNullModelBaseline(
      packageArtifact,
      config,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections
    ).baselineHash,
    baseline.baselineHash
  );
  const { baselineHash, ...basis } = baseline;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_BASELINE, basis),
    baselineHash
  );
  const tampered = structuredClone(baseline);
  tampered.models.uniform.metrics.overallRetention.mean = 0.123;
  assert.throws(
    () => verifyPackageNullModelBaseline(
      tampered,
      packageArtifact,
      config,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NULL_MODEL_BASELINE_MISMATCH"
  );
});

test("disabled and depth-aware baselines preserve explicit not-run and complete states", () => {
  const packageArtifact = loaded();
  const disabledConfig = runConfig();
  const disabledCensus = evaluatePackageCandidateCensus(
    packageArtifact,
    disabledConfig
  );
  const disabledAdmission = observedAdmission(
    packageArtifact,
    disabledConfig,
    disabledCensus
  );
  const disabledPlan = createPackageNullModelPlan(
    packageArtifact,
    disabledConfig,
    disabledCensus
  );
  const disabledProposals = createPackageNullModelProposals(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan
  );
  const disabledCensuses = evaluatePackageNullModelTrialCensuses(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan,
    disabledProposals
  );
  const disabledSelections = evaluatePackageNullModelTrialSelections(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledPlan,
    disabledProposals,
    disabledCensuses
  );
  const disabled = evaluatePackageNullModelBaseline(
    packageArtifact,
    disabledConfig,
    disabledCensus,
    disabledAdmission,
    disabledPlan,
    disabledProposals,
    disabledCensuses,
    disabledSelections
  );
  assert.equal(disabled.status, "not-run");
  assert.deepEqual(disabled.models, {});
  assert.deepEqual(disabled.interpretation, {
    status: "not-run",
    reasons: ["null-models-disabled"]
  });

  const config = configured(["uniform"]);
  const depthCensus = evaluatePackageDepthCandidateCensus(
    packageArtifact,
    config,
    [],
    1
  );
  const depthAdmission = admitPackageDepthSelectors(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    []
  );
  const depthPlan = createPackageDepthNullModelPlan(
    packageArtifact,
    config,
    [],
    1,
    depthCensus
  );
  const depthProposals = createPackageDepthNullModelProposals(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan
  );
  const depthCensuses = evaluatePackageDepthNullModelTrialCensuses(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan,
    depthProposals
  );
  const depthSelections = evaluatePackageDepthNullModelTrialSelections(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthPlan,
    depthProposals,
    depthCensuses
  );
  const depthBaseline = evaluatePackageDepthNullModelBaseline(
    packageArtifact,
    config,
    [],
    1,
    depthCensus,
    depthAdmission,
    depthPlan,
    depthProposals,
    depthCensuses,
    depthSelections
  );
  assert.equal(depthBaseline.status, "complete");
  assert.equal(depthBaseline.models.uniform.runs, 2);
  assert.equal(
    verifyPackageDepthNullModelBaseline(
      depthBaseline,
      packageArtifact,
      config,
      [],
      1,
      depthCensus,
      depthAdmission,
      depthPlan,
      depthProposals,
      depthCensuses,
      depthSelections
    ).baselineHash,
    depthBaseline.baselineHash
  );
});

test("primitive level closure executes configured null models and embeds the reproducible sample chain", () => {
  const packageArtifact = selectionLoaded();
  const config = {
    ...configured(),
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 2
    }
  };
  const level = closePackageLevel(packageArtifact, config);

  assert.equal(level.baseline.status, "complete");
  assert.deepEqual(Object.keys(level.baseline.models), [
    "degree-rewire",
    "role-shuffle",
    "uniform"
  ]);
  assert.equal(level.artifacts.nullModels.plan.status, "planned");
  assert.equal(level.artifacts.nullModels.proposals.status, "complete");
  assert.equal(level.artifacts.nullModels.trialCensuses.status, "complete");
  assert.equal(level.artifacts.nullModels.trialSelections.status, "complete");
  assert.equal(
    level.baseline.trialSelectionsHash,
    level.artifacts.nullModels.trialSelections.trialSelectionsHash
  );
  assert.ok(!level.interpretation.reasons.includes("baseline-indeterminate"));
  assert.equal(
    verifyPackageLevelClosure(level, packageArtifact, config).levelHash,
    level.levelHash
  );
});

test("depth level closure executes configured null models over its exact source population", () => {
  const packageArtifact = depthClosureLoaded();
  const config = {
    ...runConfig(),
    roleAlphabet: ["support"],
    nullModels: ["role-shuffle"],
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 2
    }
  };
  const level1 = closePackageLevel(packageArtifact, config);
  const level2 = closePackageDepthLevel(
    packageArtifact,
    config,
    [level1],
    2
  );

  assert.notEqual(level1.baseline.status, "not-run");
  assert.notEqual(level2.baseline.status, "not-run");
  assert.equal(level2.artifacts.nullModels.plan.carrierPopulation.targetDepth, 2);
  assert.equal(level2.artifacts.nullModels.proposals.status, "complete");
  assert.equal(level2.artifacts.nullModels.trialCensuses.status, "complete");
  assert.equal(level2.artifacts.nullModels.trialSelections.status, "complete");
  assert.equal(
    level2.baseline.trialSelectionsHash,
    level2.artifacts.nullModels.trialSelections.trialSelectionsHash
  );
  assert.equal(
    verifyPackageDepthLevelClosure(
      level2,
      packageArtifact,
      config,
      [level1],
      2
    ).levelHash,
    level2.levelHash
  );
});
