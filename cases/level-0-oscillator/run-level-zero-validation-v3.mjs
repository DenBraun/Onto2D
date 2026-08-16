import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { canonicalize, hashCanonical } from "../../packages/kernel/src/index.js";
import { runLevelZeroValidation, verifyLevelZeroSource } from "./run.mjs";
import { runPhaseCBoundednessPreflight } from "./run-phase-c-preflight.mjs";
import { runPhaseCObjecthoodSearch } from "./run-phase-c-objecthood.mjs";
import { runPhaseCDynamicsProbe } from "./run-phase-c-dynamics.mjs";
import { runPhaseCExpandedSearch } from "./run-phase-c-expanded-search.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-portable-expanded-pipeline-model:v3";
const ANALYSIS_DOMAIN = "onto2d:level-zero-portable-expanded-pipeline-validation:v3";

const reproductions = Object.freeze({
  "phase-b-reference-v1": runLevelZeroValidation,
  "phase-c-boundedness-preflight-v1": runPhaseCBoundednessPreflight,
  "phase-c-objecthood-search-v2": runPhaseCObjecthoodSearch,
  "phase-c-dynamics-v2": runPhaseCDynamicsProbe,
  "phase-c-expanded-search-v2": runPhaseCExpandedSearch
});

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-portable-expanded-pipeline-validation" ||
    model.modelVersion !== "3.0.0" ||
    model.status !== "portable-expanded-gated-validation" ||
    model.numericalIdentity?.policy !== "portable-numeric-reporting-v1" ||
    !Array.isArray(model.dependencies)
  ) {
    throw new TypeError("Unsupported integrated Level-0 v3 model.");
  }
  if (
    canonicalize(model.dependencies.map((dependency) => dependency.id)) !==
    canonicalize(Object.keys(reproductions))
  ) {
    throw new TypeError("Integrated Level-0 v3 dependencies are incomplete or out of order.");
  }
  return model;
}

async function reproduceDependency(dependency) {
  const dependencyPath = path.resolve(repositoryRoot, dependency.repositoryPath);
  if (!dependencyPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError(`Integrated v3 dependency ${dependency.id} leaves the repository.`);
  }
  const frozen = JSON.parse(await readFile(dependencyPath, "utf8"));
  const reproduced = await reproductions[dependency.id]();
  if (canonicalize(frozen) !== canonicalize(reproduced)) {
    throw new TypeError(`Integrated v3 dependency ${dependency.id} differs from reproduction.`);
  }
  if (reproduced.analysisHash !== dependency.analysisHash) {
    throw new TypeError(`Integrated v3 dependency ${dependency.id} hash differs from the model.`);
  }
  if (reproduced.status !== dependency.requiredStatus) {
    throw new TypeError(`Integrated v3 dependency ${dependency.id} status differs from the model.`);
  }
  return reproduced;
}

export async function runIntegratedLevelZeroValidationV3({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./level-zero-validation-v3.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const reproduced = {};
  for (const dependency of model.dependencies) {
    reproduced[dependency.id] = await reproduceDependency(dependency);
  }

  const phaseB = reproduced["phase-b-reference-v1"];
  const preflight = reproduced["phase-c-boundedness-preflight-v1"];
  const objecthood = reproduced["phase-c-objecthood-search-v2"];
  const dynamics = reproduced["phase-c-dynamics-v2"];
  const expanded = reproduced["phase-c-expanded-search-v2"];
  const dynamicsContract = model.dependencies.find(
    (dependency) => dependency.id === "phase-c-dynamics-v2"
  );
  const expandedContract = model.dependencies.find(
    (dependency) => dependency.id === "phase-c-expanded-search-v2"
  );
  if (dynamics.scientificResult.status !== dynamicsContract.requiredResult) {
    throw new TypeError("Phase-C dynamics result differs from the integrated v3 model.");
  }
  if (expanded.conclusion.result !== expandedContract.requiredResult) {
    throw new TypeError("Expanded Phase-C result differs from the integrated v3 model.");
  }

  const phaseBPassed = phaseB.summary.admittedScenarioIds.includes("resonant-triad") &&
    phaseB.summary.allExpectationsMatched;
  const boundednessRejected =
    preflight.scientificResult.status === "rejected-unbounded-potential";
  const objectQualifiedNodeIds = [...objecthood.summary.paperCRTObjecthoodScenarioIds];
  const expandedQualifiedScenarioIds = [...expanded.conclusion.qualifiedScenarioIds];
  const expandedIndeterminateScenarioIds = [...expanded.conclusion.indeterminateScenarioIds];
  const phaseDStatus = expandedQualifiedScenarioIds.length === 0
    ? "not-run-no-object-qualified-nodes"
    : "pending-expanded-qualified-population";
  const expandedExecutionComplete =
    expanded.conclusion.testedAllPreregisteredScenarios &&
    expanded.conclusion.testedAllPreregisteredPerturbations &&
    expandedIndeterminateScenarioIds.length === 0;
  const declaredCaseExecutionComplete =
    phaseBPassed &&
    boundednessRejected &&
    objecthood.summary.allExpectationsMatched &&
    objecthood.summary.terminalNegativeResultComplete &&
    dynamics.conclusion.priorNegativeObjecthoodDispositionChanged === false &&
    expandedExecutionComplete &&
    phaseDStatus === "not-run-no-object-qualified-nodes";

  const dependencies = model.dependencies.map((dependency) => {
    const artifact = reproduced[dependency.id];
    return {
      id: dependency.id,
      repositoryPath: dependency.repositoryPath,
      analysisHash: artifact.analysisHash,
      modelHash: artifact.modelHash,
      status: artifact.status,
      exactReproductionVerified: true
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
      ? "complete-negative-result-within-portable-expanded-model"
      : expandedIndeterminateScenarioIds.length > 0
        ? "portable-expanded-declared-case-indeterminate"
        : "incomplete-or-inconsistent-portable-expanded-case",
    pipeline: model.pipeline,
    claims: model.claims,
    numericalIdentity: model.numericalIdentity,
    review: model.review,
    dependencies,
    phases: {
      phaseB: {
        status: phaseBPassed ? "passed-declared-gate" : "failed-declared-gate",
        admittedScenarioIds: [...phaseB.summary.admittedScenarioIds]
      },
      phaseCPreflight: {
        status: preflight.scientificResult.status,
        analyticalUnboundedBelow: preflight.scientificResult.analyticalUnboundedBelow
      },
      phaseCObjecthood: {
        status: objectQualifiedNodeIds.length === 0
          ? "no-object-qualified-node"
          : "object-qualified-node-available",
        trialObjecthoodScenarioIds: [...objecthood.summary.trialObjecthoodScenarioIds],
        paperCRTObjecthoodScenarioIds: objectQualifiedNodeIds,
        terminalNegativeResultComplete: objecthood.summary.terminalNegativeResultComplete
      },
      phaseCDynamics: {
        status: dynamics.scientificResult.status,
        priorNegativeObjecthoodDispositionChanged:
          dynamics.conclusion.priorNegativeObjecthoodDispositionChanged
      },
      phaseCExpanded: {
        status: expanded.conclusion.result,
        preregisteredScenarioCount: expanded.preregistration.scenarioCount,
        preregisteredPerturbationCount: expanded.preregistration.perturbationCount,
        qualifiedScenarioIds: expandedQualifiedScenarioIds,
        indeterminateScenarioIds: expandedIndeterminateScenarioIds,
        completeParameterOrPerturbationSpaceCovered:
          expanded.conclusion.completeParameterOrPerturbationSpaceCovered
      },
      phaseD: {
        status: phaseDStatus,
        eligibleNodeScenarioIds: expandedQualifiedScenarioIds
      }
    },
    conclusion: {
      declaredCaseExecutionComplete,
      declaredModelLevelZeroValidated: false,
      priorDispositionChanged: expandedQualifiedScenarioIds.length > 0,
      generalTheoryValidated: false,
      generalTheoryFalsified: false,
      empiricalValidationClaimed: false,
      independentScientificReviewComplete: false,
      result: expandedQualifiedScenarioIds.length === 0
        ? "Level 0 remains unvalidated in the portable expanded declared model because no asymmetric Phase-C branch passes every static and dynamic gate."
        : "The expanded search produced a trial object, but Level 0 remains unvalidated until Phase D is executed."
    }
  };
  return {
    ...basis,
    analysisHash: hashCanonical(ANALYSIS_DOMAIN, basis)
  };
}

function parseArguments(argv) {
  const options = {
    output: path.join(caseRoot, "artifacts", "level-zero-validation-v3.json"),
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
  const result = await runIntegratedLevelZeroValidationV3();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen integrated Level-0 v3 artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
