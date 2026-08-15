import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { canonicalize, hashCanonical } from "../../packages/kernel/src/index.js";
import { runLevelZeroValidation } from "./run.mjs";
import { runPhaseCBoundednessPreflight } from "./run-phase-c-preflight.mjs";
import { runPhaseCObjecthoodSearch } from "./run-phase-c-objecthood.mjs";
import { verifyLevelZeroSource } from "./run.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-declared-pipeline-model:v1";
const ANALYSIS_DOMAIN = "onto2d:level-zero-declared-pipeline-validation:v1";

const reproductions = Object.freeze({
  "phase-b-reference-v1": runLevelZeroValidation,
  "phase-c-boundedness-preflight-v1": runPhaseCBoundednessPreflight,
  "phase-c-objecthood-search-v1": runPhaseCObjecthoodSearch
});

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-declared-pipeline-validation" ||
    model.status !== "conditional-gated-validation" ||
    !Array.isArray(model.dependencies)
  ) {
    throw new TypeError("Unsupported integrated Level-0 validation model.");
  }
  const expectedIds = Object.keys(reproductions);
  const actualIds = model.dependencies.map((dependency) => dependency.id);
  if (canonicalize(actualIds) !== canonicalize(expectedIds)) {
    throw new TypeError("Integrated Level-0 dependencies are incomplete or out of order.");
  }
  return model;
}

async function reproduceDependency(dependency) {
  const dependencyPath = path.resolve(repositoryRoot, dependency.repositoryPath);
  if (!dependencyPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError(`Integrated dependency ${dependency.id} leaves the repository.`);
  }
  const frozen = JSON.parse(await readFile(dependencyPath, "utf8"));
  const reproduced = await reproductions[dependency.id]();
  if (canonicalize(frozen) !== canonicalize(reproduced)) {
    throw new TypeError(`Integrated dependency ${dependency.id} differs from its reproduction.`);
  }
  if (reproduced.analysisHash !== dependency.analysisHash) {
    throw new TypeError(`Integrated dependency ${dependency.id} analysis hash differs from the model.`);
  }
  return reproduced;
}

export async function runIntegratedLevelZeroValidation({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./level-zero-validation-v1.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const reproduced = {};
  for (const dependency of model.dependencies) {
    reproduced[dependency.id] = await reproduceDependency(dependency);
  }

  const phaseBArtifact = reproduced["phase-b-reference-v1"];
  const preflightArtifact = reproduced["phase-c-boundedness-preflight-v1"];
  const objecthoodArtifact = reproduced["phase-c-objecthood-search-v1"];
  const phaseBPassed = phaseBArtifact.summary.admittedScenarioIds.includes("resonant-triad") &&
    phaseBArtifact.summary.allExpectationsMatched;
  const minimalCubicPotentialRejected =
    preflightArtifact.scientificResult.status === "rejected-unbounded-potential";
  const objectQualifiedNodeIds = [...objecthoodArtifact.summary.paperCRTObjecthoodScenarioIds];
  const phaseDStatus = objecthoodArtifact.phaseD.status;
  const downstreamStopMatched =
    objectQualifiedNodeIds.length === 0 &&
    phaseDStatus === "not-run-no-object-qualified-nodes";
  const declaredCaseExecutionComplete =
    phaseBPassed &&
    minimalCubicPotentialRejected &&
    objecthoodArtifact.summary.allExpectationsMatched &&
    objecthoodArtifact.summary.terminalNegativeResultComplete &&
    downstreamStopMatched;

  const dependencies = model.dependencies.map((dependency) => {
    const artifact = reproduced[dependency.id];
    return {
      id: dependency.id,
      repositoryPath: dependency.repositoryPath,
      analysisHash: artifact.analysisHash,
      modelHash: artifact.modelHash,
      status: artifact.status
    };
  });
  const basis = {
    schemaVersion: "1",
    caseId: model.caseId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    modelHash,
    sourceHash: source.sha256,
    source,
    status: declaredCaseExecutionComplete
      ? "complete-negative-result-within-declared-model"
      : "incomplete-or-inconsistent-declared-case",
    pipeline: model.pipeline,
    claims: model.claims,
    review: model.review,
    dependencies,
    phases: {
      phaseB: {
        status: phaseBPassed ? "passed-declared-gate" : "failed-declared-gate",
        admittedScenarioIds: [...phaseBArtifact.summary.admittedScenarioIds]
      },
      phaseCPreflight: {
        status: preflightArtifact.scientificResult.status,
        analyticalUnboundedBelow: preflightArtifact.scientificResult.analyticalUnboundedBelow
      },
      phaseCObjecthood: {
        status: objectQualifiedNodeIds.length === 0
          ? "no-object-qualified-node"
          : "object-qualified-node-available",
        trialObjecthoodScenarioIds: [...objecthoodArtifact.summary.trialObjecthoodScenarioIds],
        paperCRTObjecthoodScenarioIds: objectQualifiedNodeIds,
        completePerturbationClassCovered:
          objecthoodArtifact.summary.completePerturbationClassCovered,
        terminalNegativeResultComplete:
          objecthoodArtifact.summary.terminalNegativeResultComplete
      },
      phaseD: {
        status: phaseDStatus,
        eligibleNodeScenarioIds: [...objecthoodArtifact.phaseD.eligibleNodeScenarioIds]
      }
    },
    conclusion: {
      declaredCaseExecutionComplete,
      declaredModelLevelZeroValidated: objectQualifiedNodeIds.length > 0 &&
        phaseDStatus === "collective-admissibility-passed",
      generalTheoryValidated: false,
      generalTheoryFalsified: false,
      empiricalValidationClaimed: false,
      independentScientificReviewComplete: false,
      result: "Level 0 is not validated in the declared model because no Phase-C branch qualifies as a CRT-node."
    }
  };
  return {
    ...basis,
    analysisHash: hashCanonical(ANALYSIS_DOMAIN, basis)
  };
}

function parseArguments(argv) {
  const options = {
    output: path.join(caseRoot, "artifacts", "level-zero-validation-v1.json"),
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
  const result = await runIntegratedLevelZeroValidation();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen integrated Level-0 artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
