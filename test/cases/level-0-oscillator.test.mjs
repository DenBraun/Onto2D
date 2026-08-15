import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createOracleRequestBinding,
  validateOracleResponse
} from "../../packages/kernel/src/index.js";
import { runLevelZeroValidation } from "../../cases/level-0-oscillator/run.mjs";
import { runPhaseCBoundednessPreflight } from "../../cases/level-0-oscillator/run-phase-c-preflight.mjs";
import { runPhaseCObjecthoodSearch } from "../../cases/level-0-oscillator/run-phase-c-objecthood.mjs";
import { runIntegratedLevelZeroValidation } from "../../cases/level-0-oscillator/run-level-zero-validation.mjs";
import {
  LEVEL_ZERO_REFERENCE_SOLVER,
  levelZeroReferenceSolver
} from "../../cases/level-0-oscillator/solver/reference-solver.mjs";
import {
  PHASE_C_BOUNDEDNESS_SOLVER,
  phaseCBoundednessSolver
} from "../../cases/level-0-oscillator/solver/phase-c-boundedness-solver.mjs";
import {
  PHASE_C_OBJECTHOOD_SOLVER,
  phaseCObjecthoodSolver
} from "../../cases/level-0-oscillator/solver/phase-c-objecthood-solver.mjs";

const analysisResult = runLevelZeroValidation();
const phaseCResult = runPhaseCBoundednessPreflight();
const phaseCObjecthoodResult = runPhaseCObjecthoodSearch();
const integratedLevelZeroResult = runIntegratedLevelZeroValidation();

async function analysis() {
  return analysisResult;
}

async function phaseCAnalysis() {
  return phaseCResult;
}

async function phaseCObjecthoodAnalysis() {
  return phaseCObjecthoodResult;
}

async function integratedLevelZeroAnalysis() {
  return integratedLevelZeroResult;
}

function expectedStationarityResidual(modes, grid, spacePeriod, timePeriod) {
  const dx = spacePeriod / grid;
  const dt = timePeriod / grid;
  const squared = modes.reduce((sum, mode) => {
    const coefficient =
      -4 * Math.sin(mode.omega * dt / 2) ** 2 / dt ** 2 +
      4 * Math.sin(mode.k * dx / 2) ** 2 / dx ** 2 +
      mode.m2;
    return sum + (mode.A * coefficient) ** 2;
  }, 0);
  return Math.sqrt(squared);
}

function simpsonIntegral(fn, minimum, maximum, intervals) {
  assert.equal(intervals % 2, 0);
  const step = (maximum - minimum) / intervals;
  let weighted = fn(minimum) + fn(maximum);
  for (let index = 1; index < intervals; index += 1) {
    weighted += (index % 2 === 0 ? 2 : 4) * fn(minimum + index * step);
  }
  return weighted * step / 3;
}

test("the Level-0 reference benchmark separates its positive and negative controls", async () => {
  const result = await analysis();
  assert.equal(result.status, "computational-conformance-only");
  assert.equal(result.summary.scenarioCount, 4);
  assert.deepEqual(result.summary.admittedScenarioIds, ["resonant-triad"]);
  assert.deepEqual(result.summary.rejectedScenarioIds, [
    "balanced-dyad",
    "detuned-triad",
    "off-shell-triad"
  ]);
  assert.equal(result.summary.allExpectationsMatched, true);
  assert.equal(result.summary.fullLevelZeroValidated, false);
  assert.equal(result.summary.empiricalValidationClaimed, false);
});

test("the resonant triad has accepted oracle evidence and second-order convergence", async () => {
  const result = await analysis();
  const triad = result.scenarios.find((scenario) => scenario.id === "resonant-triad");
  assert.equal(triad.oracleValidation.status, "accepted");
  assert.equal(triad.numerical.dispersionPassed, true);
  assert.equal(triad.numerical.stationarityPassed, true);
  assert.equal(triad.numerical.balancePassed, true);
  assert.equal(triad.numerical.periodicNormDiagnosticPassed, true);
  assert.ok(triad.numerical.values.stationarity_l2_residual_fine > 0);
  assert.ok(
    triad.numerical.values.stationarity_l2_residual_fine <
    triad.numerical.values.stationarity_l2_residual_coarse
  );
  assert.ok(triad.numerical.values.stationarity_observed_order >= 1.8);
  assert.equal(triad.structural.triadEvaluation.outcome, "pass");
  assert.equal(triad.structural.simpleCycleRank, 1);
  assert.equal(triad.structural.removalIrreducible, true);
  assert.equal(triad.admitted, true);
});

test("each negative control fails its intended scientific gate", async () => {
  const result = await analysis();
  const dyad = result.scenarios.find((scenario) => scenario.id === "balanced-dyad");
  const detuned = result.scenarios.find((scenario) => scenario.id === "detuned-triad");
  const offShell = result.scenarios.find((scenario) => scenario.id === "off-shell-triad");

  assert.equal(dyad.numerical.passed, true);
  assert.equal(dyad.structural.passed, false);
  assert.equal(dyad.structural.triadEvaluation.outcome, "fail");
  assert.equal(dyad.structural.simpleCycleRank, 0);

  assert.equal(detuned.numerical.dispersionPassed, true);
  assert.equal(detuned.numerical.stationarityPassed, true);
  assert.equal(detuned.numerical.balancePassed, false);
  assert.equal(detuned.structural.passed, true);

  assert.equal(offShell.numerical.dispersionPassed, false);
  assert.equal(offShell.numerical.stationarityPassed, false);
  assert.equal(offShell.numerical.balancePassed, true);
  assert.equal(offShell.structural.passed, true);
});

test("an analytic discrete reference independently reproduces the solver diagnostics", async () => {
  const model = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/model-v1.json", import.meta.url),
    "utf8"
  ));
  const result = await analysis();
  for (const scenario of model.scenarios) {
    const observed = result.scenarios.find((entry) => entry.id === scenario.id).numerical.values;
    const expectedCoarse = expectedStationarityResidual(
      scenario.modes,
      model.numericalMethod.coarseGrid,
      model.normalization.spacePeriod,
      model.normalization.timePeriod
    );
    const expectedFine = expectedStationarityResidual(
      scenario.modes,
      model.numericalMethod.fineGrid,
      model.normalization.spacePeriod,
      model.normalization.timePeriod
    );
    const expectedNorm = model.normalization.spacePeriod * scenario.modes.reduce(
      (sum, mode) => sum + mode.A ** 2,
      0
    );
    assert.ok(Math.abs(observed.stationarity_l2_residual_coarse - expectedCoarse) < 1e-10);
    assert.ok(Math.abs(observed.stationarity_l2_residual_fine - expectedFine) < 1e-10);
    assert.ok(Math.abs(observed.periodic_norm_mean - expectedNorm) < 1e-10);
  }
});

test("the case-specific solver stays outside the kernel and binds exact evidence", async () => {
  const source = await readFile(
    new URL("../../cases/level-0-oscillator/solver/reference-solver.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /packages\/kernel|@onto2d\/kernel/);
  assert.deepEqual(
    {
      id: levelZeroReferenceSolver.id,
      version: levelZeroReferenceSolver.version,
      method: levelZeroReferenceSolver.method
    },
    LEVEL_ZERO_REFERENCE_SOLVER
  );

  const result = await analysis();
  const triad = result.scenarios[0];
  const rebound = createOracleRequestBinding(triad.requestBinding.request);
  assert.equal(rebound.requestHash, triad.requestBinding.requestHash);
  assert.deepEqual(
    validateOracleResponse(rebound, triad.oracleResponse, {
      evidenceIds: [result.sourceHash, result.modelHash]
    }),
    triad.oracleValidation
  );
});

test("scientific input drift changes identities and source-lock drift fails closed", async () => {
  const model = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/model-v1.json", import.meta.url),
    "utf8"
  ));
  const baseline = await analysis();
  const changed = structuredClone(model);
  changed.scenarios[0].modes[0].A = 0.9;
  const altered = await runLevelZeroValidation({ model: changed });
  assert.notEqual(altered.modelHash, baseline.modelHash);
  assert.notEqual(altered.analysisHash, baseline.analysisHash);
  assert.notEqual(altered.scenarios[0].candidateId, baseline.scenarios[0].candidateId);
  assert.notEqual(
    altered.scenarios[0].requestBinding.requestHash,
    baseline.scenarios[0].requestBinding.requestHash
  );

  const staleSource = structuredClone(model);
  staleSource.source.sha256 = "0".repeat(64);
  await assert.rejects(
    runLevelZeroValidation({ model: staleSource }),
    /differs from source-lock\.json/
  );
});

test("the frozen Level-0 artifact is an exact reproduction", async () => {
  const frozen = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/artifacts/reference-validation-v1.json", import.meta.url),
    "utf8"
  ));
  const result = await analysis();
  assert.deepEqual(result, frozen);
  const report = await readFile(
    new URL("../../cases/level-0-oscillator/REPORT.md", import.meta.url),
    "utf8"
  );
  assert.match(report, new RegExp(result.modelHash));
  assert.match(report, new RegExp(result.analysisHash));
  assert.match(report, new RegExp(result.source.doi));
});

test("the Phase-C preflight rejects the free cubic potential as unbounded below", async () => {
  const result = await phaseCAnalysis();
  assert.equal(result.oracleValidation.status, "accepted");
  assert.equal(result.scientificResult.asymptoticLeadingDegree, 3);
  assert.equal(result.scientificResult.asymptoticLeadingCoefficient, -0.5);
  assert.equal(result.scientificResult.turningRadius, 4);
  assert.equal(result.scientificResult.terminalDerivative, -5760);
  assert.equal(result.scientificResult.tailStrictlyDescending, true);
  assert.equal(result.scientificResult.numericalTailWitness, true);
  assert.equal(result.scientificResult.analyticalUnboundedBelow, true);
  assert.equal(result.scientificResult.boundednessGatePassed, false);
  assert.equal(result.scientificResult.phaseCObjecthoodEstablished, false);
  assert.equal(result.scientificResult.status, "rejected-unbounded-potential");
  assert.equal(result.summary.fullLevelZeroValidated, false);
  assert.equal(result.summary.empiricalValidationClaimed, false);
});

test("an independent polynomial evaluation reproduces every Phase-C sample", async () => {
  const model = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/phase-c-boundedness-v1.json", import.meta.url),
    "utf8"
  ));
  const result = await phaseCAnalysis();
  const quadraticCoefficient = model.parameters.massSquared.reduce((sum, value) => sum + value, 0);
  const cubicCoefficient = 2 * Math.abs(model.parameters.lambda);
  for (const sample of result.scientificResult.samples) {
    const expected = quadraticCoefficient * sample.radius ** 2 - cubicCoefficient * sample.radius ** 3;
    assert.equal(sample.potential, expected);
  }
  assert.deepEqual(
    result.scientificResult.samples.map((sample) => sample.potential),
    [2.5, 8, 16, -64, -1280, -13312, -118784]
  );
});

test("the uncoupled Phase-C control removes the unbounded cubic direction", async () => {
  const model = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/phase-c-boundedness-v1.json", import.meta.url),
    "utf8"
  ));
  model.parameters.lambda = 0;
  const result = await runPhaseCBoundednessPreflight({ model });
  assert.equal(result.scientificResult.asymptoticLeadingDegree, 2);
  assert.equal(result.scientificResult.asymptoticLeadingCoefficient, 3);
  assert.equal(result.scientificResult.terminalDerivative, 384);
  assert.equal(result.scientificResult.analyticalUnboundedBelow, false);
  assert.equal(result.scientificResult.numericalTailWitness, false);
  assert.equal(result.scientificResult.boundednessGatePassed, true);
  assert.equal(result.scientificResult.phaseCObjecthoodEstablished, false);
  assert.equal(result.scientificResult.status, "boundedness-gate-passed-no-objecthood-claim");
});

test("the Phase-C solver stays outside the kernel and binds exact evidence", async () => {
  const source = await readFile(
    new URL("../../cases/level-0-oscillator/solver/phase-c-boundedness-solver.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /packages\/kernel|@onto2d\/kernel/);
  assert.deepEqual(
    {
      id: phaseCBoundednessSolver.id,
      version: phaseCBoundednessSolver.version,
      method: phaseCBoundednessSolver.method
    },
    PHASE_C_BOUNDEDNESS_SOLVER
  );

  const result = await phaseCAnalysis();
  const rebound = createOracleRequestBinding(result.requestBinding.request);
  assert.equal(rebound.requestHash, result.requestBinding.requestHash);
  assert.deepEqual(
    validateOracleResponse(rebound, result.oracleResponse, {
      evidenceIds: [result.sourceHash, result.modelHash]
    }),
    result.oracleValidation
  );
});

test("the frozen Phase-C preflight artifact and report are exact reproductions", async () => {
  const frozen = JSON.parse(await readFile(
    new URL(
      "../../cases/level-0-oscillator/artifacts/phase-c-boundedness-v1.json",
      import.meta.url
    ),
    "utf8"
  ));
  const result = await phaseCAnalysis();
  assert.deepEqual(result, frozen);
  const report = await readFile(
    new URL("../../cases/level-0-oscillator/PHASE_C_PREFLIGHT.md", import.meta.url),
    "utf8"
  );
  assert.match(report, new RegExp(result.modelHash));
  assert.match(report, new RegExp(result.analysisHash));
  assert.match(report, new RegExp(result.source.doi));
});

test("the bounded Phase-C search separates localization, stability, and nontriviality", async () => {
  const result = await phaseCObjecthoodAnalysis();
  assert.equal(result.summary.scenarioCount, 3);
  assert.deepEqual(result.summary.trialObjecthoodScenarioIds, []);
  assert.deepEqual(result.summary.paperCRTObjecthoodScenarioIds, []);
  assert.equal(result.summary.allExpectationsMatched, true);

  const pulse = result.scenarios.find((scenario) => scenario.id === "localized-pulse");
  assert.equal(pulse.scientificResult.boundedPotential, true);
  assert.equal(pulse.scientificResult.stationarityPassed, true);
  assert.equal(pulse.scientificResult.gridConvergencePassed, true);
  assert.equal(pulse.scientificResult.nontrivialGamma, true);
  assert.equal(pulse.scientificResult.intrinsicLocalizationPassed, true);
  assert.equal(pulse.scientificResult.amplitudeStabilityPassed, false);
  assert.deepEqual(pulse.scientificResult.failedNecessaryGates, ["amplitudeStabilityPassed"]);
  assert.equal(pulse.scientificResult.negativeDispositionComplete, true);
  assert.equal(pulse.scientificResult.unrunPerturbationClassesCanChangeDisposition, false);
  assert.ok(pulse.scientificResult.values.symmetric_profile_rayleigh_quotient < 0);

  const plateau = result.scenarios.find((scenario) => scenario.id === "stable-plateau");
  assert.equal(plateau.scientificResult.amplitudeStabilityPassed, true);
  assert.equal(plateau.scientificResult.intrinsicLocalizationPassed, false);
  assert.deepEqual(plateau.scientificResult.failedNecessaryGates, ["intrinsicLocalizationPassed"]);
  assert.ok(plateau.scientificResult.values.symmetric_profile_rayleigh_quotient > 0);

  const vacuum = result.scenarios.find((scenario) => scenario.id === "uncoupled-vacuum");
  assert.equal(vacuum.scientificResult.amplitudeStabilityPassed, true);
  assert.equal(vacuum.scientificResult.nontrivialGamma, false);
  assert.deepEqual(vacuum.scientificResult.failedNecessaryGates, [
    "nontrivialGamma",
    "intrinsicLocalizationPassed"
  ]);
  assert.equal(vacuum.scientificResult.values.gamma_fine, 0);
});

test("the Phase-C search has explicit convergence and domain-size witnesses", async () => {
  const result = await phaseCObjecthoodAnalysis();
  const pulse = result.scenarios.find((scenario) => scenario.id === "localized-pulse");
  const plateau = result.scenarios.find((scenario) => scenario.id === "stable-plateau");

  assert.ok(pulse.scientificResult.values.stationarity_max_residual_fine < 1e-11);
  assert.ok(pulse.scientificResult.values.gamma_grid_relative_change < 0.001);
  assert.ok(pulse.scientificResult.values.profile_grid_relative_l2 < 0.001);
  assert.ok(pulse.scientificResult.values.gamma_domain_relative_change < 0.001);
  assert.equal(pulse.scientificResult.values.support_radius_relative_change, 0);

  assert.ok(plateau.scientificResult.values.gamma_extended > plateau.scientificResult.values.gamma_fine);
  assert.ok(plateau.scientificResult.values.gamma_domain_relative_change > 0.3);
  assert.ok(plateau.scientificResult.values.support_radius_relative_change > 0.3);
  assert.equal(plateau.scientificResult.values.symmetric_hessian_positive_definite, 1);
  assert.equal(plateau.scientificResult.values.antisymmetric_hessian_positive_definite, 1);
});

test("an analytic continuum pulse independently matches the Phase-C finite-difference branch", async () => {
  const result = await phaseCObjecthoodAnalysis();
  const pulse = result.scenarios.find((scenario) => scenario.id === "localized-pulse");
  const massSquared = 1;
  const lambda = 2;
  const quarticCoefficient = 0.5;
  const cubic = 4 * lambda / 3;
  const quartic = 3 * quarticCoefficient / 2;
  const discriminant = cubic ** 2 - 4 * quartic * massSquared;
  const exactPulse = (x) => 2 * massSquared /
    (cubic + Math.sqrt(discriminant) * Math.cosh(Math.sqrt(massSquared) * x));
  const gammaReference = 9 * simpsonIntegral(
    (x) => exactPulse(x) ** 2,
    -20,
    20,
    20000
  );
  const rayleighNumerator = simpsonIntegral((x) => {
    const value = exactPulse(x);
    return -2 * lambda * value ** 3 + 6 * quarticCoefficient * value ** 4;
  }, -20, 20, 20000);
  const rayleighDenominator = simpsonIntegral(
    (x) => exactPulse(x) ** 2,
    -20,
    20,
    20000
  );
  const rayleighReference = rayleighNumerator / rayleighDenominator;

  assert.ok(Math.abs(pulse.scientificResult.values.gamma_fine - gammaReference) / gammaReference < 0.001);
  assert.ok(Math.abs(pulse.scientificResult.values.peak_amplitude_fine - exactPulse(0)) < 0.001);
  assert.ok(
    Math.abs(
      pulse.scientificResult.values.symmetric_profile_rayleigh_quotient - rayleighReference
    ) < 0.001
  );
  assert.ok(rayleighReference < 0);
});

test("the stable plateau peak independently matches the upper homogeneous root", async () => {
  const result = await phaseCObjecthoodAnalysis();
  const plateau = result.scenarios.find((scenario) => scenario.id === "stable-plateau");
  const massSquared = 1;
  const lambda = 2;
  const quarticCoefficient = 0.5;
  const discriminant = 4 * lambda ** 2 - 12 * quarticCoefficient * massSquared;
  const upperRoot = (2 * lambda + Math.sqrt(discriminant)) / (6 * quarticCoefficient);
  assert.ok(Math.abs(plateau.scientificResult.values.peak_amplitude_fine - upperRoot) < 1e-6);
  const homogeneousCurvature =
    massSquared - 4 * lambda * upperRoot + 9 * quarticCoefficient * upperRoot ** 2;
  assert.ok(homogeneousCurvature > 0);
});

test("the Phase-C objecthood solver stays outside the kernel and binds all evidence", async () => {
  const source = await readFile(
    new URL("../../cases/level-0-oscillator/solver/phase-c-objecthood-solver.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /packages\/kernel|@onto2d\/kernel/);
  assert.deepEqual(
    {
      id: phaseCObjecthoodSolver.id,
      version: phaseCObjecthoodSolver.version,
      method: phaseCObjecthoodSolver.method
    },
    PHASE_C_OBJECTHOOD_SOLVER
  );

  const result = await phaseCObjecthoodAnalysis();
  for (const scenario of result.scenarios) {
    const rebound = createOracleRequestBinding(scenario.requestBinding.request);
    assert.equal(rebound.requestHash, scenario.requestBinding.requestHash);
    assert.deepEqual(
      validateOracleResponse(rebound, scenario.oracleResponse, {
        evidenceIds: [
          result.sourceHash,
          ...result.dependencies.map((dependency) => dependency.analysisHash),
          result.modelHash
        ]
      }),
      scenario.oracleValidation
    );
  }
});

test("Phase-C objecthood input and dependency drift fail closed", async () => {
  const model = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/phase-c-objecthood-v1.json", import.meta.url),
    "utf8"
  ));
  const baseline = await phaseCObjecthoodAnalysis();
  const changed = structuredClone(model);
  changed.scenarios[0].lambda = 2.01;
  const altered = await runPhaseCObjecthoodSearch({ model: changed });
  assert.notEqual(altered.modelHash, baseline.modelHash);
  assert.notEqual(altered.analysisHash, baseline.analysisHash);
  assert.notEqual(altered.scenarios[0].requestBinding.requestHash, baseline.scenarios[0].requestBinding.requestHash);

  const staleDependency = structuredClone(model);
  staleDependency.dependencies[0].analysisHash = `sha256:${"0".repeat(64)}`;
  await assert.rejects(
    runPhaseCObjecthoodSearch({ model: staleDependency }),
    /dependency analysis hash differs/
  );

  const missingStabilizer = structuredClone(model);
  missingStabilizer.scenarios[0].quarticCoefficient = 0;
  await assert.rejects(
    runPhaseCObjecthoodSearch({ model: missingStabilizer }),
    /quarticCoefficient must be positive/
  );
});

test("Phase D stops explicitly when Phase C supplies no object-qualified node", async () => {
  const result = await phaseCObjecthoodAnalysis();
  assert.deepEqual(result.phaseD, {
    status: "not-run-no-object-qualified-nodes",
    eligibleNodeScenarioIds: []
  });
  assert.equal(result.summary.completePerturbationClassCovered, false);
  assert.equal(result.summary.allScenariosHaveNecessaryGateFailure, true);
  assert.equal(result.summary.terminalNegativeResultComplete, true);
  assert.equal(result.summary.fullLevelZeroValidated, false);
  assert.equal(result.summary.empiricalValidationClaimed, false);
});

test("the frozen Phase-C objecthood artifact and report are exact reproductions", async () => {
  const frozen = JSON.parse(await readFile(
    new URL(
      "../../cases/level-0-oscillator/artifacts/phase-c-objecthood-v1.json",
      import.meta.url
    ),
    "utf8"
  ));
  const result = await phaseCObjecthoodAnalysis();
  assert.deepEqual(result, frozen);
  const report = await readFile(
    new URL("../../cases/level-0-oscillator/PHASE_C_OBJECTHOOD.md", import.meta.url),
    "utf8"
  );
  assert.match(report, new RegExp(result.modelHash));
  assert.match(report, new RegExp(result.analysisHash));
  for (const dependency of result.dependencies) {
    assert.match(report, new RegExp(dependency.analysisHash));
  }
  assert.match(report, new RegExp(result.source.doi));
});

test("the integrated Level-0 case completes with a bounded negative conclusion", async () => {
  const result = await integratedLevelZeroAnalysis();
  assert.equal(result.status, "complete-negative-result-within-declared-model");
  assert.equal(result.phases.phaseB.status, "passed-declared-gate");
  assert.deepEqual(result.phases.phaseB.admittedScenarioIds, ["resonant-triad"]);
  assert.equal(result.phases.phaseCPreflight.status, "rejected-unbounded-potential");
  assert.equal(result.phases.phaseCPreflight.analyticalUnboundedBelow, true);
  assert.equal(result.phases.phaseCObjecthood.status, "no-object-qualified-node");
  assert.equal(result.phases.phaseCObjecthood.terminalNegativeResultComplete, true);
  assert.deepEqual(result.phases.phaseCObjecthood.paperCRTObjecthoodScenarioIds, []);
  assert.equal(result.phases.phaseD.status, "not-run-no-object-qualified-nodes");
  assert.equal(result.conclusion.declaredCaseExecutionComplete, true);
  assert.equal(result.conclusion.declaredModelLevelZeroValidated, false);
  assert.equal(result.conclusion.generalTheoryValidated, false);
  assert.equal(result.conclusion.generalTheoryFalsified, false);
  assert.equal(result.conclusion.empiricalValidationClaimed, false);
  assert.equal(result.conclusion.independentScientificReviewComplete, false);
  assert.equal(result.review.status, "pending-independent-scientific-review");
});

test("the integrated Level-0 model fails closed on dependency drift", async () => {
  const model = JSON.parse(await readFile(
    new URL("../../cases/level-0-oscillator/level-zero-validation-v1.json", import.meta.url),
    "utf8"
  ));
  const baseline = await integratedLevelZeroAnalysis();
  const changed = structuredClone(model);
  changed.claims.allowed.push("a deliberately identity-changing claim");
  const altered = await runIntegratedLevelZeroValidation({ model: changed });
  assert.notEqual(altered.modelHash, baseline.modelHash);
  assert.notEqual(altered.analysisHash, baseline.analysisHash);

  const stale = structuredClone(model);
  stale.dependencies[2].analysisHash = `sha256:${"0".repeat(64)}`;
  await assert.rejects(
    runIntegratedLevelZeroValidation({ model: stale }),
    /analysis hash differs from the model/
  );
});

test("the frozen integrated Level-0 artifact and report are exact reproductions", async () => {
  const frozen = JSON.parse(await readFile(
    new URL(
      "../../cases/level-0-oscillator/artifacts/level-zero-validation-v1.json",
      import.meta.url
    ),
    "utf8"
  ));
  const result = await integratedLevelZeroAnalysis();
  assert.deepEqual(result, frozen);
  const report = await readFile(
    new URL("../../cases/level-0-oscillator/LEVEL_ZERO_VALIDATION.md", import.meta.url),
    "utf8"
  );
  assert.match(report, new RegExp(result.modelHash));
  assert.match(report, new RegExp(result.analysisHash));
  for (const dependency of result.dependencies) {
    assert.match(report, new RegExp(dependency.analysisHash));
  }
  assert.match(report, new RegExp(result.source.doi));
  const reviewGuide = await readFile(
    new URL("../../cases/level-0-oscillator/REVIEW.md", import.meta.url),
    "utf8"
  );
  assert.match(reviewGuide, /npm run case:level-0:verify/);
  assert.match(reviewGuide, /not approval of the general\s+theory/i);
});
