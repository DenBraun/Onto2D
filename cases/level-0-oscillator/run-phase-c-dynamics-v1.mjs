import { readFile, mkdir, writeFile } from "node:fs/promises";
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
import { runPhaseCObjecthoodSearch } from "./run-phase-c-objecthood-v1.mjs";
import {
  PHASE_C_DYNAMICS_SOLVER,
  phaseCDynamicsSolver,
  runPhaseCDynamicsNumerics
} from "./solver/phase-c-dynamics-solver.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-phase-c-dynamics-model:v1";
const ANALYSIS_DOMAIN = "onto2d:level-zero-phase-c-dynamics-analysis:v1";

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-phase-c-real-time-persistence-probe" ||
    model.status !== "bounded-dynamics-extension"
  ) {
    throw new TypeError("Unsupported Level-0 Phase-C dynamics model.");
  }
  if (canonicalize(model.oracle?.solver) !== canonicalize(PHASE_C_DYNAMICS_SOLVER)) {
    throw new TypeError("Phase-C dynamics solver identity does not match the model.");
  }
  if (
    model.dependency?.id !== "phase-c-objecthood-search-v1" ||
    typeof model.dependency.repositoryPath !== "string"
  ) {
    throw new TypeError("Phase-C dynamics model must bind the objecthood search.");
  }
  if (
    !model.expectation ||
    model.expectation.realTimePersistencePassed !== false ||
    model.expectation.priorObjecthoodDispositionChanged !== false
  ) {
    throw new TypeError("Phase-C dynamics negative expectation must be explicit.");
  }
  return model;
}

async function verifyDependency(model) {
  const dependency = model.dependency;
  const dependencyPath = path.resolve(repositoryRoot, dependency.repositoryPath);
  if (!dependencyPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError("Phase-C dynamics dependency path leaves the repository.");
  }
  const artifact = JSON.parse(await readFile(dependencyPath, "utf8"));
  const reproduction = await runPhaseCObjecthoodSearch();
  if (canonicalize(artifact) !== canonicalize(reproduction)) {
    throw new TypeError("Phase-C dynamics dependency differs from its exact reproduction.");
  }
  if (artifact.analysisHash !== dependency.analysisHash) {
    throw new TypeError("Phase-C dynamics dependency analysis hash differs from the model.");
  }
  const scenario = artifact.scenarios.find((entry) => entry.id === dependency.requiredScenarioId);
  if (
    !scenario ||
    scenario.candidateId !== dependency.requiredCandidateId ||
    scenario.skeletonId !== dependency.requiredSkeletonId ||
    scenario.scientificResult.intrinsicLocalizationPassed !==
      dependency.requiredLocalizationPassed ||
    scenario.scientificResult.amplitudeStabilityPassed !==
      dependency.requiredAmplitudeStabilityPassed ||
    scenario.scientificResult.trialObjecthoodPassed !==
      dependency.requiredTrialObjecthoodPassed
  ) {
    throw new TypeError("Phase-C dynamics source scenario differs from the declared mapping.");
  }
  if (scenario.requestBinding.request.candidate.hash !== dependency.requiredCandidateId) {
    throw new TypeError("Phase-C dynamics source candidate form differs from its declared identity.");
  }
  return {
    record: {
      ...dependency,
      modelHash: artifact.modelHash,
      sourceHash: artifact.sourceHash,
      sourceScenarioDisposition: {
        localized: scenario.scientificResult.intrinsicLocalizationPassed,
        amplitudeStable: scenario.scientificResult.amplitudeStabilityPassed,
        trialObjecthood: scenario.scientificResult.trialObjecthoodPassed
      }
    },
    candidate: scenario.requestBinding.request.candidate
  };
}

function requestFor(model, modelHash, evidenceIds, candidate) {
  return createOracleRequestBinding({
    candidate,
    quantities: model.oracle.quantities,
    parameters: {
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      modelHash,
      sourceCandidateId: model.dependency.requiredCandidateId,
      ...model.parameters,
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

function classify(values, acceptance, expectation) {
  const stationarityPassed =
    values.stationarity_max_residual_base <= acceptance.stationarityMaxResidual &&
    values.stationarity_max_residual_refined <= acceptance.stationarityMaxResidual;
  const controlPersistencePassed =
    values.control_max_profile_relative_departure_base <=
      acceptance.controlProfileRelativeDepartureMaximum &&
    values.control_max_profile_relative_departure_refined <=
      acceptance.controlProfileRelativeDepartureMaximum;
  const energyValues = Object.entries(values)
    .filter(([id]) => id.includes("energy_relative_drift"))
    .map(([, value]) => value);
  const energyConservationPassed = energyValues.every(
    (value) => value <= acceptance.energyRelativeDriftMaximum
  );
  const symmetricAmplifications = [
    values.symmetric_max_deviation_amplification_base,
    values.symmetric_max_deviation_amplification_time_refined,
    values.symmetric_max_deviation_amplification_refined
  ];
  const antisymmetricAmplifications = [
    values.antisymmetric_max_deviation_amplification_base,
    values.antisymmetric_max_deviation_amplification_time_refined,
    values.antisymmetric_max_deviation_amplification_refined
  ];
  const symmetricInstabilityObserved = symmetricAmplifications.every(
    (value) => value >= acceptance.symmetricAmplificationMinimum
  );
  const antisymmetricControlBounded = antisymmetricAmplifications.every(
    (value) => value <= acceptance.antisymmetricAmplificationMaximum
  );
  const timeConvergencePassed =
    values.symmetric_amplification_time_relative_change <=
      acceptance.amplificationTimeRelativeChangeMaximum &&
    values.antisymmetric_amplification_time_relative_change <=
      acceptance.amplificationTimeRelativeChangeMaximum;
  const spaceConvergencePassed =
    values.symmetric_amplification_space_relative_change <=
      acceptance.amplificationSpaceRelativeChangeMaximum &&
    values.antisymmetric_amplification_space_relative_change <=
      acceptance.amplificationSpaceRelativeChangeMaximum;
  const numericalQualityPassed =
    stationarityPassed && controlPersistencePassed && energyConservationPassed;
  const convergencePassed = timeConvergencePassed && spaceConvergencePassed;
  const realTimePersistencePassed =
    numericalQualityPassed &&
    convergencePassed &&
    antisymmetricControlBounded &&
    !symmetricInstabilityObserved;
  const priorObjecthoodDispositionChanged = false;
  const expectationMatched =
    symmetricInstabilityObserved === expectation.symmetricInstabilityObserved &&
    antisymmetricControlBounded === expectation.antisymmetricControlBounded &&
    realTimePersistencePassed === expectation.realTimePersistencePassed &&
    priorObjecthoodDispositionChanged === expectation.priorObjecthoodDispositionChanged;
  let status = "numerically-indeterminate";
  if (numericalQualityPassed && convergencePassed && symmetricInstabilityObserved) {
    status = "symmetric-dynamical-instability-confirmed";
  } else if (numericalQualityPassed && convergencePassed) {
    status = "no-symmetric-instability-observed-in-declared-window";
  }
  return {
    values,
    stationarityPassed,
    controlPersistencePassed,
    energyConservationPassed,
    timeConvergencePassed,
    spaceConvergencePassed,
    numericalQualityPassed,
    convergencePassed,
    symmetricInstabilityObserved,
    antisymmetricControlBounded,
    realTimePersistencePassed,
    completeRealTimePerturbationClassCovered: false,
    priorObjecthoodDispositionChanged,
    expectationMatched,
    status
  };
}

export async function runPhaseCDynamicsProbe({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./phase-c-dynamics-v1.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const dependency = await verifyDependency(model);
  const sourceHash = source.sha256;
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const evidenceIds = [sourceHash, dependency.record.analysisHash, modelHash];
  const requestBinding = requestFor(model, modelHash, evidenceIds, dependency.candidate);
  const oracleResponse = await phaseCDynamicsSolver.evaluate({
    requestHash: requestBinding.requestHash,
    request: requestBinding.request
  });
  const oracleValidation = validateOracleResponse(requestBinding, oracleResponse, { evidenceIds });
  const scientificResult = classify(
    quantityValues(oracleValidation),
    model.acceptance,
    model.expectation
  );
  const replay = runPhaseCDynamicsNumerics(requestBinding.request.parameters);
  const roundedReplayValues = Object.fromEntries(Object.entries(replay.metrics).map(([id, value]) => [
    id,
    value === 0 ? 0 : Number.parseFloat(value.toPrecision(model.parameters.roundingSignificantDigits))
  ]));
  if (canonicalize(roundedReplayValues) !== canonicalize(scientificResult.values)) {
    throw new TypeError("Phase-C dynamics visualization replay differs from Oracle values.");
  }
  const basis = {
    schemaVersion: "1",
    caseId: model.caseId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    modelHash,
    sourceHash,
    source,
    dependency: dependency.record,
    inputMapping: model.inputMapping,
    status: "bounded-real-time-persistence-probe",
    scope: model.scope,
    solver: PHASE_C_DYNAMICS_SOLVER,
    requestBinding,
    oracleResponse,
    oracleValidation,
    scientificResult,
    visualization: replay.visualization,
    conclusion: {
      localizedPulseRealTimePersistencePassed: scientificResult.realTimePersistencePassed,
      symmetricDynamicalInstabilityObserved: scientificResult.symmetricInstabilityObserved,
      priorNegativeObjecthoodDispositionChanged:
        scientificResult.priorObjecthoodDispositionChanged,
      completeRealTimePerturbationClassCovered: false,
      empiricalValidationClaimed: false,
      result: scientificResult.status
    }
  };
  return {
    ...basis,
    analysisHash: hashCanonical(ANALYSIS_DOMAIN, basis)
  };
}

function parseArguments(argv) {
  const options = {
    output: path.join(caseRoot, "artifacts", "phase-c-dynamics-v1.json"),
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
  const result = await runPhaseCDynamicsProbe();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen Phase-C dynamics artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
