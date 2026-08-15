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
import { verifyLevelZeroSource } from "./run.mjs";
import {
  PHASE_C_BOUNDEDNESS_SOLVER,
  phaseCBoundednessSolver
} from "./solver/phase-c-boundedness-solver.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DOMAIN = "onto2d:level-zero-phase-c-model:v1";
const COMPONENT_DOMAIN = "onto2d:level-zero-phase-c-component:v1";
const ANALYSIS_DOMAIN = "onto2d:level-zero-phase-c-preflight:v1";

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-phase-c-cubic-boundedness-preflight" ||
    model.status !== "falsification-preflight"
  ) {
    throw new TypeError("Unsupported Level-0 Phase-C preflight model.");
  }
  if (canonicalize(model.oracle?.solver) !== canonicalize(PHASE_C_BOUNDEDNESS_SOLVER)) {
    throw new TypeError("Phase-C model solver identity does not match the implementation.");
  }
  if (
    !Array.isArray(model.parameters?.massSquared) ||
    model.parameters.massSquared.length !== 3 ||
    !Array.isArray(model.parameters?.radii) ||
    model.parameters.radii.length < 3
  ) {
    throw new TypeError("Phase-C preflight requires three components and at least three radii.");
  }
  const expectedQuantityIds = [
    "asymptotic_leading_coefficient",
    "asymptotic_leading_degree",
    ...model.parameters.radii.map((radius) => `potential_at_radius_${radius}`),
    "terminal_derivative",
    "turning_radius"
  ];
  const quantityIds = model.oracle.quantities.map((quantity) => quantity.id);
  if (canonicalize(quantityIds) !== canonicalize(expectedQuantityIds)) {
    throw new TypeError("Phase-C quantity declarations do not match the sampled radii.");
  }
  if (new Set(quantityIds).size !== quantityIds.length) {
    throw new TypeError("Phase-C quantity identifiers must be unique.");
  }
  return model;
}

function candidateFor(modelHash) {
  const nodes = [0, 1, 2].map((componentIndex) => ({
    ref: hashCanonical(COMPONENT_DOMAIN, { modelHash, componentIndex })
  }));
  return {
    domain: "single-candidate",
    nodes,
    edges: [
      { from: 0, to: 1, role: "cubic-coupling" },
      { from: 1, to: 2, role: "cubic-coupling" },
      { from: 2, to: 0, role: "cubic-coupling" }
    ]
  };
}

function requestFor(model, modelHash, sourceHash, canonicalForm) {
  return createOracleRequestBinding({
    candidate: canonicalForm,
    quantities: model.oracle.quantities,
    parameters: {
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      modelHash,
      massSquared: model.parameters.massSquared,
      lambda: model.parameters.lambda,
      radii: model.parameters.radii,
      reportedAbsoluteTolerance: model.parameters.reportedAbsoluteTolerance,
      evidenceIds: [sourceHash, modelHash]
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

function classify(model, values) {
  const samples = model.parameters.radii.map((radius) => ({
    radius,
    potential: values[`potential_at_radius_${radius}`]
  }));
  const tail = samples.slice(-3);
  const tailStrictlyDescending = tail.every((sample, index) => (
    index === 0 || sample.potential < tail[index - 1].potential
  ));
  const analyticalUnboundedBelow =
    model.scope.amplitudeDomain === "unbounded-nonnegative" &&
    values.asymptotic_leading_degree > 0 &&
    values.asymptotic_leading_coefficient < 0;
  const terminalDerivativeNegative = values.terminal_derivative < 0;
  const numericalTailWitness =
    tailStrictlyDescending &&
    terminalDerivativeNegative &&
    samples.at(-1).potential < samples[0].potential;
  const boundednessGatePassed = !analyticalUnboundedBelow;
  return {
    samples,
    asymptoticLeadingDegree: values.asymptotic_leading_degree,
    asymptoticLeadingCoefficient: values.asymptotic_leading_coefficient,
    turningRadius: values.turning_radius,
    terminalDerivative: values.terminal_derivative,
    tailStrictlyDescending,
    terminalDerivativeNegative,
    numericalTailWitness,
    analyticalUnboundedBelow,
    boundednessGatePassed,
    phaseCObjecthoodEstablished: false,
    status: boundednessGatePassed
      ? "boundedness-gate-passed-no-objecthood-claim"
      : "rejected-unbounded-potential",
    requiredResolution: boundednessGatePassed
      ? "localization and perturbative-persistence tests remain required"
      : "justify a bounded amplitude domain or freeze a stabilizing even-order term"
  };
}

export async function runPhaseCBoundednessPreflight({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./phase-c-boundedness-v1.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const sourceHash = source.sha256;
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const canonical = canonicalizeCandidate(candidateFor(modelHash));
  const requestBinding = requestFor(model, modelHash, sourceHash, canonical.canonicalForm);
  const oracleResponse = await phaseCBoundednessSolver.evaluate({
    requestHash: requestBinding.requestHash,
    request: requestBinding.request
  });
  const oracleValidation = validateOracleResponse(requestBinding, oracleResponse, {
    evidenceIds: [sourceHash, modelHash]
  });
  const values = quantityValues(oracleValidation);
  const scientificResult = classify(model, values);
  const basis = {
    schemaVersion: "1",
    caseId: model.caseId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    modelHash,
    sourceHash,
    source,
    status: "phase-c-boundedness-preflight",
    scope: model.scope,
    solver: PHASE_C_BOUNDEDNESS_SOLVER,
    candidateId: canonical.candidateId,
    skeletonId: canonical.skeletonId,
    requestBinding,
    oracleResponse,
    oracleValidation,
    scientificResult,
    summary: {
      oracleEvidenceAccepted: oracleValidation.status === "accepted",
      boundednessGatePassed: scientificResult.boundednessGatePassed,
      phaseCObjecthoodEstablished: false,
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
    output: path.join(caseRoot, "artifacts", "phase-c-boundedness-v1.json"),
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
  const result = await runPhaseCBoundednessPreflight();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen Phase-C boundedness artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
