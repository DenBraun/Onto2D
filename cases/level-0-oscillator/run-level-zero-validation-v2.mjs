import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { canonicalize, hashCanonical } from "../../packages/kernel/src/index.js";
import { verifyLevelZeroSource } from "./run.mjs";
import { runIntegratedLevelZeroValidation } from "./run-level-zero-validation.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-expanded-pipeline-model:v2";
const ANALYSIS_DOMAIN = "onto2d:level-zero-expanded-pipeline-validation:v2";

const archivedAnalysisDomains = Object.freeze({
  "phase-c-expanded-search-v1": "onto2d:level-zero-phase-c-expanded-analysis:v1"
});

const reproductions = Object.freeze({
  "level-zero-validation-v1": runIntegratedLevelZeroValidation,
  "phase-c-expanded-search-v1": null
});

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    model.modelId !== "level-0-expanded-pipeline-validation" ||
    model.modelVersion !== "2.0.0" ||
    model.status !== "conditional-expanded-gated-validation" ||
    !Array.isArray(model.dependencies)
  ) {
    throw new TypeError("Unsupported integrated Level-0 v2 model.");
  }
  if (
    canonicalize(model.dependencies.map((dependency) => dependency.id)) !==
    canonicalize(Object.keys(reproductions))
  ) {
    throw new TypeError("Integrated Level-0 v2 dependencies are incomplete or out of order.");
  }
  return model;
}

async function reproduceDependency(dependency) {
  const dependencyPath = path.resolve(repositoryRoot, dependency.repositoryPath);
  if (!dependencyPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError(`Integrated v2 dependency ${dependency.id} leaves the repository.`);
  }
  const frozen = JSON.parse(await readFile(dependencyPath, "utf8"));
  const reproduce = reproductions[dependency.id];
  let reproduced;
  if (reproduce) {
    reproduced = await reproduce();
    if (canonicalize(frozen) !== canonicalize(reproduced)) {
      throw new TypeError(`Integrated v2 dependency ${dependency.id} differs from reproduction.`);
    }
  } else {
    const { analysisHash, ...basis } = frozen;
    const archivedDomain = archivedAnalysisDomains[dependency.id];
    if (!archivedDomain || hashCanonical(archivedDomain, basis) !== analysisHash) {
      throw new TypeError(`Integrated v2 archived dependency ${dependency.id} fails integrity.`);
    }
    reproduced = frozen;
  }
  if (reproduced.analysisHash !== dependency.analysisHash) {
    throw new TypeError(`Integrated v2 dependency ${dependency.id} hash differs from the model.`);
  }
  if (reproduced.status !== dependency.requiredStatus) {
    throw new TypeError(`Integrated v2 dependency ${dependency.id} status differs from the model.`);
  }
  return reproduced;
}

export async function runIntegratedLevelZeroValidationV2({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./level-zero-validation-v2.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const reproduced = {};
  for (const dependency of model.dependencies) {
    reproduced[dependency.id] = await reproduceDependency(dependency);
  }
  const v1 = reproduced["level-zero-validation-v1"];
  const expanded = reproduced["phase-c-expanded-search-v1"];
  const expandedDependency = model.dependencies.find(
    (dependency) => dependency.id === "phase-c-expanded-search-v1"
  );
  if (expanded.conclusion.result !== expandedDependency.requiredResult) {
    throw new TypeError("Expanded Phase-C result differs from the integrated v2 model.");
  }
  const qualifiedScenarioIds = [...expanded.conclusion.qualifiedScenarioIds];
  const indeterminateScenarioIds = [...expanded.conclusion.indeterminateScenarioIds];
  const expandedExecutionComplete =
    expanded.conclusion.testedAllPreregisteredScenarios &&
    expanded.conclusion.testedAllPreregisteredPerturbations &&
    indeterminateScenarioIds.length === 0;
  const phaseDStatus = qualifiedScenarioIds.length === 0
    ? "not-run-no-object-qualified-nodes"
    : "pending-expanded-qualified-population";
  const declaredCaseExecutionComplete =
    v1.conclusion.declaredCaseExecutionComplete &&
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
      ? "complete-negative-result-within-expanded-declared-model"
      : indeterminateScenarioIds.length > 0
        ? "expanded-declared-case-indeterminate"
        : "incomplete-or-inconsistent-expanded-case",
    pipeline: model.pipeline,
    claims: model.claims,
    review: model.review,
    dependencies,
    phases: {
      ...v1.phases,
      phaseCExpanded: {
        status: expanded.conclusion.result,
        preregisteredScenarioCount: expanded.preregistration.scenarioCount,
        preregisteredPerturbationCount: expanded.preregistration.perturbationCount,
        qualifiedScenarioIds,
        indeterminateScenarioIds,
        completeParameterOrPerturbationSpaceCovered:
          expanded.conclusion.completeParameterOrPerturbationSpaceCovered
      },
      phaseD: {
        status: phaseDStatus,
        eligibleNodeScenarioIds: qualifiedScenarioIds
      }
    },
    conclusion: {
      declaredCaseExecutionComplete,
      declaredModelLevelZeroValidated: false,
      priorV1DispositionChanged: qualifiedScenarioIds.length > 0,
      generalTheoryValidated: false,
      generalTheoryFalsified: false,
      empiricalValidationClaimed: false,
      independentScientificReviewComplete: false,
      result: qualifiedScenarioIds.length === 0
        ? "Level 0 remains unvalidated in the expanded declared model because no asymmetric Phase-C branch passes every static and dynamic gate."
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
    output: path.join(caseRoot, "artifacts", "level-zero-validation-v2.json"),
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
  const result = await runIntegratedLevelZeroValidationV2();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) {
      throw new Error("Frozen integrated Level-0 v2 artifact differs from reproduction.");
    }
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
