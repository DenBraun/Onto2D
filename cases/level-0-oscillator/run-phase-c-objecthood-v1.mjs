import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalize,
  canonicalizeCandidate,
  createOracleRequestBinding,
  hashCanonical,
  validateOracleResponse
} from "../../packages/kernel/src/index.js";
import { runLevelZeroValidation, verifyLevelZeroSource } from "./run.mjs";
import { runPhaseCBoundednessPreflight } from "./run-phase-c-preflight.mjs";
import {
  PHASE_C_OBJECTHOOD_SOLVER,
  phaseCObjecthoodSolver
} from "./solver/phase-c-objecthood-solver.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-phase-c-objecthood-model:v1";
const COMPONENT_DOMAIN = "onto2d:level-zero-phase-c-objecthood-component:v1";
const ANALYSIS_DOMAIN = "onto2d:level-zero-phase-c-objecthood-search:v1";

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-phase-c-stabilized-envelope-search" ||
    model.status !== "bounded-computational-operationalization" ||
    !Array.isArray(model.scenarios) ||
    model.scenarios.length < 1
  ) {
    throw new TypeError("Unsupported Level-0 Phase-C objecthood model.");
  }
  if (canonicalize(model.oracle?.solver) !== canonicalize(PHASE_C_OBJECTHOOD_SOLVER)) {
    throw new TypeError("Phase-C objecthood solver identity does not match the model.");
  }
  const scenarioIds = model.scenarios.map((scenario) => scenario.id);
  if (new Set(scenarioIds).size !== scenarioIds.length) {
    throw new TypeError("Phase-C objecthood scenario identifiers must be unique.");
  }
  if (!Array.isArray(model.dependencies) || model.dependencies.length !== 2) {
    throw new TypeError("Phase-C objecthood model must bind Phase B and the boundedness preflight.");
  }
  if (
    model.dependencies[0].id !== "phase-b-reference-v1" ||
    model.dependencies[1].id !== "phase-c-cubic-boundedness-preflight-v1"
  ) {
    throw new TypeError("Phase-C objecthood dependencies are incomplete or out of order.");
  }
  return model;
}

async function readDependency(dependency) {
  const dependencyPath = path.resolve(repositoryRoot, dependency.repositoryPath);
  if (!dependencyPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError("Phase-C dependency path leaves the repository.");
  }
  return JSON.parse(await readFile(dependencyPath, "utf8"));
}

async function verifyDependencies(model) {
  const phaseBDependency = model.dependencies[0];
  const phaseBArtifact = await readDependency(phaseBDependency);
  const phaseBReproduction = await runLevelZeroValidation();
  if (canonicalize(phaseBArtifact) !== canonicalize(phaseBReproduction)) {
    throw new TypeError("Phase-B dependency differs from its exact reproduction.");
  }
  if (phaseBArtifact.analysisHash !== phaseBDependency.analysisHash) {
    throw new TypeError("Phase-B dependency analysis hash differs from the model.");
  }
  const sourceScenario = phaseBArtifact.scenarios.find(
    (scenario) => scenario.id === phaseBDependency.requiredScenarioId
  );
  if (
    !sourceScenario ||
    !sourceScenario.admitted ||
    sourceScenario.candidateId !== phaseBDependency.requiredCandidateId ||
    sourceScenario.skeletonId !== phaseBDependency.requiredSkeletonId
  ) {
    throw new TypeError("Phase-B source candidate differs from the declared Phase-C mapping.");
  }

  const preflightDependency = model.dependencies[1];
  const artifact = await readDependency(preflightDependency);
  const reproduction = await runPhaseCBoundednessPreflight();
  if (canonicalize(artifact) !== canonicalize(reproduction)) {
    throw new TypeError("Phase-C boundedness dependency differs from its exact reproduction.");
  }
  if (artifact.analysisHash !== preflightDependency.analysisHash) {
    throw new TypeError("Phase-C boundedness dependency analysis hash differs from the model.");
  }
  if (artifact.scientificResult?.status !== preflightDependency.requiredStatus) {
    throw new TypeError("Phase-C boundedness dependency status differs from the model.");
  }
  return [
    {
      ...phaseBDependency,
      modelHash: phaseBArtifact.modelHash,
      sourceHash: phaseBArtifact.sourceHash,
      sourceScenarioAdmitted: sourceScenario.admitted
    },
    {
      ...preflightDependency,
      modelHash: artifact.modelHash,
      sourceHash: artifact.sourceHash
    }
  ];
}

function candidateFor(modelHash, scenario) {
  const nodes = [0, 1, 2].map((componentIndex) => ({
    ref: hashCanonical(COMPONENT_DOMAIN, { modelHash, scenarioId: scenario.id, componentIndex })
  }));
  return {
    domain: "single-candidate",
    nodes,
    edges: [
      { from: 0, to: 1, role: "stabilized-envelope-coupling" },
      { from: 1, to: 2, role: "stabilized-envelope-coupling" },
      { from: 2, to: 0, role: "stabilized-envelope-coupling" }
    ]
  };
}

function requestFor(model, modelHash, evidenceIds, scenario, canonicalForm) {
  return createOracleRequestBinding({
    candidate: canonicalForm,
    quantities: model.oracle.quantities,
    parameters: {
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      modelHash,
      scenarioId: scenario.id,
      massSquared: model.parameters.massSquared,
      baseHalfWidth: model.parameters.baseHalfWidth,
      extendedHalfWidth: model.parameters.extendedHalfWidth,
      coarseIntervals: model.parameters.coarseIntervals,
      fineIntervals: model.parameters.fineIntervals,
      extendedIntervals: model.parameters.extendedIntervals,
      newtonTolerance: model.parameters.newtonTolerance,
      newtonMaxIterations: model.parameters.newtonMaxIterations,
      roundingSignificantDigits: model.parameters.roundingSignificantDigits,
      reportedAbsoluteTolerance: model.parameters.reportedAbsoluteTolerance,
      lambda: scenario.lambda,
      quarticCoefficient: scenario.quarticCoefficient,
      initialBranch: scenario.initialBranch,
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

function classify(values, acceptance) {
  const boundedPotential =
    values.potential_leading_degree % 2 === 0 &&
    values.potential_leading_coefficient > 0;
  const stationarityPassed =
    values.stationarity_max_residual_coarse <= acceptance.stationarityMaxResidual &&
    values.stationarity_max_residual_fine <= acceptance.stationarityMaxResidual;
  const gridConvergencePassed =
    values.gamma_grid_relative_change <= acceptance.gammaGridRelativeChangeMaximum &&
    values.profile_grid_relative_l2 <= acceptance.profileGridRelativeL2Maximum;
  const nontrivialGamma = values.gamma_fine >= acceptance.gammaMinimum;
  const intrinsicLocalizationPassed =
    nontrivialGamma &&
    values.gamma_domain_relative_change <= acceptance.gammaDomainRelativeChangeMaximum &&
    values.support_radius_relative_change <= acceptance.supportRadiusRelativeChangeMaximum;
  const amplitudeStabilityPassed =
    values.symmetric_hessian_positive_definite === acceptance.positiveDefiniteFlag &&
    values.antisymmetric_hessian_positive_definite === acceptance.positiveDefiniteFlag;
  const trialObjecthoodPassed =
    boundedPotential &&
    stationarityPassed &&
    gridConvergencePassed &&
    nontrivialGamma &&
    intrinsicLocalizationPassed &&
    amplitudeStabilityPassed;
  const necessaryGates = {
    boundedPotential,
    stationarityPassed,
    gridConvergencePassed,
    nontrivialGamma,
    intrinsicLocalizationPassed,
    amplitudeStabilityPassed
  };
  const failedNecessaryGates = Object.entries(necessaryGates)
    .filter(([, passed]) => !passed)
    .map(([gate]) => gate);
  return {
    values,
    boundedPotential,
    stationarityPassed,
    gridConvergencePassed,
    nontrivialGamma,
    intrinsicLocalizationPassed,
    amplitudeStabilityPassed,
    trialObjecthoodPassed,
    failedNecessaryGates,
    negativeDispositionComplete: failedNecessaryGates.length > 0,
    unrunPerturbationClassesCanChangeDisposition: failedNecessaryGates.length === 0,
    completePerturbationClassCovered: false,
    paperCRTObjecthoodEstablished: false
  };
}

function namedGate(result, name) {
  const gates = {
    "amplitude-stability": result.amplitudeStabilityPassed,
    "intrinsic-localization": result.intrinsicLocalizationPassed,
    "nontrivial-gamma": result.nontrivialGamma
  };
  if (!Object.prototype.hasOwnProperty.call(gates, name)) {
    throw new TypeError(`Unknown expected Phase-C gate: ${name}`);
  }
  return gates[name];
}

export async function runPhaseCObjecthoodSearch({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./phase-c-objecthood-v1.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const dependencies = await verifyDependencies(model);
  const sourceHash = source.sha256;
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const evidenceIds = [
    sourceHash,
    ...dependencies.map((dependency) => dependency.analysisHash),
    modelHash
  ];
  const scenarios = [];

  for (const scenario of model.scenarios) {
    const canonical = canonicalizeCandidate(candidateFor(modelHash, scenario));
    const requestBinding = requestFor(
      model,
      modelHash,
      evidenceIds,
      scenario,
      canonical.canonicalForm
    );
    const oracleResponse = await phaseCObjecthoodSolver.evaluate({
      requestHash: requestBinding.requestHash,
      request: requestBinding.request
    });
    const oracleValidation = validateOracleResponse(requestBinding, oracleResponse, {
      evidenceIds
    });
    const scientificResult = classify(quantityValues(oracleValidation), model.acceptance);
    const expectedGateFailed = !namedGate(scientificResult, scenario.expectedFailedGate);
    scenarios.push({
      id: scenario.id,
      description: scenario.description,
      control: scenario.control,
      expectedFailedGate: scenario.expectedFailedGate,
      candidateId: canonical.candidateId,
      skeletonId: canonical.skeletonId,
      requestBinding,
      oracleResponse,
      oracleValidation,
      scientificResult,
      expectedTrialObjecthood: scenario.expectedTrialObjecthood,
      expectedGateFailed,
      expectationMatched:
        scientificResult.trialObjecthoodPassed === scenario.expectedTrialObjecthood &&
        expectedGateFailed
    });
  }

  const trialQualified = scenarios
    .filter((scenario) => scenario.scientificResult.trialObjecthoodPassed)
    .map((scenario) => scenario.id);
  const paperQualified = scenarios
    .filter((scenario) => scenario.scientificResult.paperCRTObjecthoodEstablished)
    .map((scenario) => scenario.id);
  const terminalNegativeResultComplete =
    paperQualified.length === 0 &&
    scenarios.every((scenario) => scenario.scientificResult.negativeDispositionComplete);
  const basis = {
    schemaVersion: "1",
    caseId: model.caseId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    modelHash,
    sourceHash,
    source,
    dependencies,
    inputMapping: model.inputMapping,
    status: "bounded-phase-c-trial-family-search",
    scope: model.scope,
    solver: PHASE_C_OBJECTHOOD_SOLVER,
    scenarios,
    phaseD: {
      status: paperQualified.length === 0
        ? "not-run-no-object-qualified-nodes"
        : "pending-collective-model",
      eligibleNodeScenarioIds: paperQualified
    },
    summary: {
      scenarioCount: scenarios.length,
      trialObjecthoodScenarioIds: trialQualified,
      paperCRTObjecthoodScenarioIds: paperQualified,
      allExpectationsMatched: scenarios.every((scenario) => scenario.expectationMatched),
      allScenariosHaveNecessaryGateFailure: scenarios.every(
        (scenario) => scenario.scientificResult.failedNecessaryGates.length > 0
      ),
      terminalNegativeResultComplete,
      completePerturbationClassCovered: false,
      fullLevelZeroValidated: false,
      empiricalValidationClaimed: false
    }
  };
  return {
    ...basis,
    analysisHash: hashCanonical(ANALYSIS_DOMAIN, basis)
  };
}

function parseArguments(argv) {
  const options = {
    output: path.join(caseRoot, "artifacts", "phase-c-objecthood-v1.json"),
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
  const result = await runPhaseCObjecthoodSearch();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen Phase-C objecthood artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
