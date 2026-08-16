import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalize,
  createOracleRequestBinding,
  hashCanonical,
  validateOracleResponse
} from "../../packages/kernel/src/index.js";
import { verifyLevelZeroSource } from "./run.mjs";
import { runPhaseCObjecthoodSearch } from "./run-phase-c-objecthood.mjs";
import { runPhaseCDynamicsProbe } from "./run-phase-c-dynamics.mjs";
import {
  PHASE_C_EXPANDED_SOLVER,
  phaseCExpandedSolver,
  runPhaseCExpandedNumerics
} from "./solver/phase-c-expanded-solver.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-phase-c-expanded-model:v1";
const ANALYSIS_DOMAIN = "onto2d:level-zero-phase-c-expanded-analysis:v1";

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-phase-c-asymmetric-complex-search" ||
    model.status !== "preregistered-bounded-extension" ||
    model.preregisteredAt !== "2026-08-16"
  ) {
    throw new TypeError("Unsupported expanded Level-0 Phase-C model.");
  }
  if (canonicalize(model.oracle?.solver) !== canonicalize(PHASE_C_EXPANDED_SOLVER)) {
    throw new TypeError("Expanded Phase-C solver identity does not match the model.");
  }
  if (!Array.isArray(model.scenarios) || model.scenarios.length !== 6) {
    throw new TypeError("Expanded Phase-C model must freeze exactly six scenarios.");
  }
  if (!Array.isArray(model.perturbations) || model.perturbations.length !== 4) {
    throw new TypeError("Expanded Phase-C model must freeze exactly four perturbations.");
  }
  if (!Array.isArray(model.dependencies) || model.dependencies.length !== 2) {
    throw new TypeError("Expanded Phase-C model must bind both prior Phase-C artifacts.");
  }
  if (!model.stoppingRule || !model.hypotheses?.outcomePolicy) {
    throw new TypeError("Expanded Phase-C model must freeze hypotheses and a stopping rule.");
  }
  return model;
}

function resolvedRepositoryPath(repositoryPath) {
  const resolved = path.resolve(repositoryRoot, repositoryPath);
  if (!resolved.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError("Expanded Phase-C dependency path leaves the repository.");
  }
  return resolved;
}

async function exactArtifact(dependency, reproduce) {
  const artifact = JSON.parse(await readFile(
    resolvedRepositoryPath(dependency.repositoryPath),
    "utf8"
  ));
  const reproduction = await reproduce();
  if (canonicalize(artifact) !== canonicalize(reproduction)) {
    throw new TypeError(`${dependency.id} differs from its exact reproduction.`);
  }
  if (artifact.analysisHash !== dependency.analysisHash) {
    throw new TypeError(`${dependency.id} analysis hash differs from the model.`);
  }
  return artifact;
}

async function verifyDependencies(model) {
  const objecthoodDependency = model.dependencies.find(
    (dependency) => dependency.id === "phase-c-objecthood-search-v1"
  );
  const dynamicsDependency = model.dependencies.find(
    (dependency) => dependency.id === "phase-c-dynamics-v1"
  );
  if (!objecthoodDependency || !dynamicsDependency) {
    throw new TypeError("Expanded Phase-C dependency identifiers are incomplete.");
  }
  const objecthood = await exactArtifact(objecthoodDependency, runPhaseCObjecthoodSearch);
  const dynamics = await exactArtifact(dynamicsDependency, runPhaseCDynamicsProbe);
  const sourceScenario = objecthood.scenarios.find(
    (scenario) => scenario.id === objecthoodDependency.requiredScenarioId
  );
  if (
    !sourceScenario ||
    sourceScenario.candidateId !== objecthoodDependency.requiredCandidateId ||
    sourceScenario.scientificResult.trialObjecthoodPassed !== false
  ) {
    throw new TypeError("Expanded Phase-C source scenario differs from its declared dependency.");
  }
  if (dynamics.scientificResult.status !== dynamicsDependency.requiredStatus) {
    throw new TypeError("Expanded Phase-C dynamics dependency has an unexpected status.");
  }
  return {
    records: [
      {
        ...objecthoodDependency,
        modelHash: objecthood.modelHash,
        sourceHash: objecthood.sourceHash,
        exactReproductionVerified: true
      },
      {
        ...dynamicsDependency,
        modelHash: dynamics.modelHash,
        sourceHash: dynamics.sourceHash,
        exactReproductionVerified: true
      }
    ],
    candidate: sourceScenario.requestBinding.request.candidate
  };
}

function requestFor(model, scenario, modelHash, evidenceIds, candidate) {
  return createOracleRequestBinding({
    candidate,
    quantities: model.oracle.quantities,
    parameters: {
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      modelHash,
      scenarioId: scenario.id,
      eligible: scenario.eligible,
      ...model.parameters,
      massSquared: scenario.massSquared,
      lambda: scenario.lambda,
      quarticCoefficient: scenario.quarticCoefficient,
      seedScale: scenario.seedScale,
      perturbations: model.perturbations,
      evidenceIds
    },
    toleranceTarget: model.oracle.toleranceTarget,
    solver: model.oracle.solver
  });
}

function quantityValues(validation) {
  return Object.fromEntries(Object.entries(validation.acceptedValues).map(([id, quantity]) => [
    id,
    quantity.value
  ]));
}

function classifyScenario(scenario, values, acceptance) {
  const stationarityPassed = [
    values.stationarity_max_residual_coarse,
    values.stationarity_max_residual_fine,
    values.stationarity_max_residual_extended
  ].every((value) => value <= acceptance.stationarityMaxResidual);
  const gridConvergencePassed =
    values.gamma_grid_relative_change <= acceptance.gammaGridRelativeChangeMaximum &&
    values.profile_grid_relative_l2 <= acceptance.profileGridRelativeL2Maximum;
  const nontrivialGammaPassed = values.gamma_fine >= acceptance.gammaMinimum;
  const intrinsicLocalizationPassed =
    values.gamma_domain_relative_change <= acceptance.gammaDomainRelativeChangeMaximum &&
    values.support_radius_relative_change <= acceptance.supportRadiusRelativeChangeMaximum;
  const asymmetryPassed = scenario.eligible
    ? values.component_asymmetry_index_fine >= acceptance.asymmetryIndexMinimum
    : false;
  const realAmplitudeStabilityPassed =
    values.real_hessian_positive_definite === acceptance.positiveDefiniteFlag;
  const complexPhaseStabilityPassed =
    values.phase_hessian_positive_definite === acceptance.positiveDefiniteFlag;
  const controlPersistencePassed =
    values.control_max_profile_relative_departure_base <=
      acceptance.controlProfileRelativeDepartureMaximum &&
    values.control_max_profile_relative_departure_refined <=
      acceptance.controlProfileRelativeDepartureMaximum;
  const energyConservationPassed =
    values.dynamic_max_energy_relative_drift_base <= acceptance.energyRelativeDriftMaximum &&
    values.dynamic_max_energy_relative_drift_refined <= acceptance.energyRelativeDriftMaximum;
  const dynamicRefinementPassed =
    values.dynamic_time_relative_change <= acceptance.dynamicRefinementRelativeChangeMaximum &&
    values.dynamic_space_relative_change <= acceptance.dynamicRefinementRelativeChangeMaximum;
  const dynamicBankPassed =
    values.dynamic_worst_amplification_space_refined <
      acceptance.dynamicAmplificationMaximum;
  const numericalQualityPassed =
    stationarityPassed &&
    gridConvergencePassed &&
    controlPersistencePassed &&
    energyConservationPassed &&
    dynamicRefinementPassed;
  const gates = {
    stationarityPassed,
    gridConvergencePassed,
    nontrivialGammaPassed,
    intrinsicLocalizationPassed,
    asymmetryPassed,
    realAmplitudeStabilityPassed,
    complexPhaseStabilityPassed,
    controlPersistencePassed,
    energyConservationPassed,
    dynamicRefinementPassed,
    dynamicBankPassed
  };
  const failedNecessaryGates = Object.entries({
    stationarity: stationarityPassed,
    "grid-convergence": gridConvergencePassed,
    "nontrivial-gamma": nontrivialGammaPassed,
    "intrinsic-localization": intrinsicLocalizationPassed,
    asymmetry: asymmetryPassed,
    "real-amplitude-stability": realAmplitudeStabilityPassed,
    "complex-phase-stability": complexPhaseStabilityPassed,
    "control-persistence": controlPersistencePassed,
    "energy-conservation": energyConservationPassed,
    "dynamic-refinement": dynamicRefinementPassed,
    "dynamic-bank": dynamicBankPassed
  }).filter(([, passed]) => !passed).map(([id]) => id);
  const trialObjecthoodPassed =
    scenario.eligible && numericalQualityPassed && failedNecessaryGates.length === 0;
  return {
    values,
    gates,
    numericalQualityPassed,
    failedNecessaryGates,
    trialObjecthoodPassed,
    status: !numericalQualityPassed
      ? "numerically-indeterminate"
      : trialObjecthoodPassed
        ? "trial-objecthood-passed-within-declared-bank"
        : "rejected-by-declared-necessary-gates"
  };
}

function roundedReplay(metrics, digits) {
  return Object.fromEntries(Object.entries(metrics).map(([id, value]) => [
    id,
    value === 0 ? 0 : Number.parseFloat(value.toPrecision(digits))
  ]));
}

export async function runPhaseCExpandedSearch({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./phase-c-expanded-search-v1.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const dependencies = await verifyDependencies(model);
  const sourceHash = source.sha256;
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const evidenceIds = [
    sourceHash,
    ...dependencies.records.map((dependency) => dependency.analysisHash),
    modelHash
  ];
  const scenarios = [];
  for (const scenario of model.scenarios) {
    const requestBinding = requestFor(
      model,
      scenario,
      modelHash,
      evidenceIds,
      dependencies.candidate
    );
    const oracleResponse = await phaseCExpandedSolver.evaluate({
      requestHash: requestBinding.requestHash,
      request: requestBinding.request
    });
    const oracleValidation = validateOracleResponse(
      requestBinding,
      oracleResponse,
      { evidenceIds }
    );
    const scientificResult = classifyScenario(
      scenario,
      quantityValues(oracleValidation),
      model.acceptance
    );
    const replay = runPhaseCExpandedNumerics(requestBinding.request.parameters);
    if (
      canonicalize(roundedReplay(
        replay.metrics,
        model.parameters.roundingSignificantDigits
      )) !== canonicalize(scientificResult.values)
    ) {
      throw new TypeError(`${scenario.id} visualization replay differs from Oracle values.`);
    }
    scenarios.push({
      id: scenario.id,
      eligible: scenario.eligible,
      parameters: {
        massSquared: scenario.massSquared,
        lambda: scenario.lambda,
        quarticCoefficient: scenario.quarticCoefficient,
        seedScale: scenario.seedScale
      },
      requestBinding,
      oracleResponse,
      oracleValidation,
      scientificResult,
      visualization: replay.visualization
    });
  }
  const eligible = scenarios.filter((scenario) => scenario.eligible);
  const qualified = eligible.filter((scenario) => scenario.scientificResult.trialObjecthoodPassed);
  const indeterminate = eligible.filter(
    (scenario) => scenario.scientificResult.status === "numerically-indeterminate"
  );
  const result = indeterminate.length > 0
    ? "bounded-search-indeterminate"
    : qualified.length > 0
      ? "bounded-positive-qualified-asymmetric-branch"
      : "bounded-negative-no-qualified-asymmetric-branch";
  const basis = {
    schemaVersion: "1",
    caseId: model.caseId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    modelHash,
    sourceHash,
    source,
    dependencies: dependencies.records,
    inputMapping: model.inputMapping,
    preregistration: {
      date: model.preregisteredAt,
      hypotheses: model.hypotheses,
      stoppingRule: model.stoppingRule,
      scenarioCount: model.scenarios.length,
      eligibleScenarioCount: model.scenarios.filter((scenario) => scenario.eligible).length,
      perturbationCount: model.perturbations.length
    },
    status: "completed-preregistered-bounded-extension",
    scope: model.scope,
    solver: PHASE_C_EXPANDED_SOLVER,
    scenarios,
    conclusion: {
      qualifiedScenarioIds: qualified.map((scenario) => scenario.id),
      indeterminateScenarioIds: indeterminate.map((scenario) => scenario.id),
      testedAllPreregisteredScenarios: scenarios.length === model.scenarios.length,
      testedAllPreregisteredPerturbations: scenarios.every(
        (scenario) => scenario.visualization.dynamics.length === model.perturbations.length
      ),
      priorNegativeObjecthoodDispositionChanged: qualified.length > 0,
      completeParameterOrPerturbationSpaceCovered: false,
      empiricalValidationClaimed: false,
      result
    }
  };
  return {
    ...basis,
    analysisHash: hashCanonical(ANALYSIS_DOMAIN, basis)
  };
}

function parseArguments(argv) {
  const options = {
    output: path.join(caseRoot, "artifacts", "phase-c-expanded-search-v1.json"),
    verify: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--verify") options.verify = true;
    else if (flag === "--output" && argv[index + 1]) {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const result = await runPhaseCExpandedSearch();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen expanded Phase-C artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
