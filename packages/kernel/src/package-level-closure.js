import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { materializeRunAxis } from "./run-axis.js";
import { evaluatePackageCandidateCensus } from "./package-candidate-census.js";
import { constructPackageCohorts } from "./package-cohort-partitioner.js";
import {
  PACKAGE_SELECTOR_RANKING_LIMITS,
  rankPackageSelector
} from "./package-selector-ranker.js";
import {
  PACKAGE_SELECTOR_SENSITIVITY_LIMITS,
  evaluatePackageSelectorSensitivity
} from "./package-selector-sensitivity.js";
import { admitPackageSelectors } from "./package-selector-admission.js";
import { materializePackageSelectedFormations } from "./package-selected-formations.js";
import { extractPackageDerivedProfiles } from "./package-derived-profiles.js";
import { materializePackageDerivedDepthPopulation } from "./package-derived-depth-population.js";
import { normalizeRunConfig } from "./run-config.js";
import { createPackageNullModelPlan } from "./package-null-model-plan.js";
import {
  createPackageNullModelProposals
} from "./package-null-model-proposals.js";
import {
  evaluatePackageNullModelTrialCensuses
} from "./package-null-model-trial-census.js";
import {
  evaluatePackageNullModelTrialSelections
} from "./package-null-model-trial-selection.js";
import {
  evaluatePackageNullModelBaseline
} from "./package-null-model-baseline.js";

export const PACKAGE_LEVEL_CLOSURE_VERSION = "package-level-closure-v1";
export const PACKAGE_LEVEL_CLOSURE_SCOPE = "primitive-to-derived-depth-1-v1";

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "CLOSE_PACKAGE_LEVEL",
    message,
    details
  });
}

export function normalizePackageLevelClosureOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_LEVEL_CLOSURE_OPTIONS_INVALID",
      "Level-closure options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_OPTIONS_INVALID",
      "Level-closure options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_OPTION_UNKNOWN",
      "Unknown level-closure option.",
      { unknown }
    );
  }
  for (const [field, maximum] of [
    [
      "maxFunctionalEvaluations",
      PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations
    ],
    [
      "maxSensitivityFunctionalEvaluations",
      PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
    ]
  ]) {
    if (
      value[field] !== undefined &&
      (
        !Number.isSafeInteger(value[field]) ||
        value[field] < 1 ||
        value[field] > maximum
      )
    ) {
      fail(
        "PACKAGE_LEVEL_CLOSURE_EVALUATION_LIMIT_INVALID",
        "A level-closure evaluation limit is outside the supported range.",
        { field, value: value[field], maximum }
      );
    }
  }
  return value;
}

function selectOptions(options, fields) {
  const result = {};
  for (const field of fields) {
    if (options[field] !== undefined) result[field] = options[field];
  }
  return result;
}

function loadedOptions(options) {
  return selectOptions(options, ["kernelVersion"]);
}

function candidateOptions(options) {
  return selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates"
  ]);
}

function rankingOptions(options) {
  return selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations"
  ]);
}

function sensitivityOptions(options) {
  return selectOptions(options, [...OPTION_FIELDS]);
}

function requiredSelectorVariants(selector, functional) {
  const coefficientCount = BigInt(functional.sensitivityCoefficients.length);
  if (coefficientCount === 0n) return 0n;
  const perAmplitude = selector.sensitivity.sweep === "one-at-a-time"
    ? 2n * coefficientCount
    : 2n ** coefficientCount;
  return perAmplitude * BigInt(selector.sensitivity.amplitudes.length);
}

function safeCount(value, label) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_COUNT_UNSAFE",
      "A complete level execution count exceeds the JSON safe-integer range.",
      { label, value: value.toString() }
    );
  }
  return Number(value);
}

export function preflightPackageLevelExecution(
  loadedPackage,
  runConfig,
  census,
  options,
  nullModelsIntegrated = false
) {
  if (
    !nullModelsIntegrated &&
    (runConfig.nullModels.length > 0 || runConfig.budget.nullModelRuns > 0)
  ) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_NULL_MODELS_UNAVAILABLE",
      "Level closure cannot claim completion while configured null models are unavailable.",
      {
        nullModels: runConfig.nullModels,
        nullModelRuns: runConfig.budget.nullModelRuns
      }
    );
  }
  const eligible = BigInt(census.counts.eligibleCandidates);
  const selectors = loadedPackage.normalized.selectors;
  const functionals = new Map(loadedPackage.normalized.functionals.map(
    (functional) => [functional.id, functional]
  ));
  const rankingEvaluations = eligible * BigInt(selectors.length);
  const requiredVariants = eligible === 0n
    ? 0n
    : selectors.reduce((total, selector) => total + requiredSelectorVariants(
      selector,
      functionals.get(selector.functional)
    ), 0n);
  const sensitivityEvaluations = requiredVariants * eligible;
  const rankingLimit = BigInt(
    options.maxFunctionalEvaluations ??
      PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations
  );
  const sensitivityLimit = BigInt(
    options.maxSensitivityFunctionalEvaluations ??
      PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
  );
  if (rankingEvaluations > rankingLimit) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_RANKING_BUDGET_EXCEEDED",
      "Whole-level ranking exceeds the functional-evaluation ceiling.",
      {
        required: rankingEvaluations.toString(),
        maximum: rankingLimit.toString()
      }
    );
  }
  if (requiredVariants > BigInt(runConfig.budget.perturbationSamples)) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_PERTURBATION_BUDGET_EXCEEDED",
      "Whole-level sensitivity exceeds the run perturbation-sample budget.",
      {
        required: requiredVariants.toString(),
        maximum: runConfig.budget.perturbationSamples
      }
    );
  }
  if (sensitivityEvaluations > sensitivityLimit) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_SENSITIVITY_BUDGET_EXCEEDED",
      "Whole-level sensitivity exceeds the functional-evaluation ceiling.",
      {
        required: sensitivityEvaluations.toString(),
        maximum: sensitivityLimit.toString()
      }
    );
  }
  return {
    selectorCount: selectors.length,
    eligibleCandidates: census.counts.eligibleCandidates,
    maxFunctionalEvaluations: Number(rankingLimit),
    requiredFunctionalEvaluations: safeCount(
      rankingEvaluations,
      "rankingEvaluations"
    ),
    perturbationSamples: runConfig.budget.perturbationSamples,
    requiredPerturbationSamples: safeCount(requiredVariants, "requiredVariants"),
    maxSensitivityFunctionalEvaluations: Number(sensitivityLimit),
    requiredSensitivityFunctionalEvaluations: safeCount(
      sensitivityEvaluations,
      "sensitivityEvaluations"
    )
  };
}

function executeSelectors(loadedPackage, runConfig, census, options) {
  return loadedPackage.normalized.selectors.map((selector) => {
    const partition = constructPackageCohorts(
      loadedPackage,
      runConfig,
      census,
      selector.cohortRule,
      candidateOptions(options)
    );
    const ranking = rankPackageSelector(
      loadedPackage,
      runConfig,
      census,
      partition,
      selector.id,
      rankingOptions(options)
    );
    const sensitivity = evaluatePackageSelectorSensitivity(
      loadedPackage,
      runConfig,
      census,
      partition,
      ranking,
      sensitivityOptions(options)
    );
    return { selectorId: selector.id, partition, ranking, sensitivity };
  });
}

export function finalizePackageLevelExecution(preflight, selectorExecutions) {
  return {
    ...preflight,
    usedFunctionalEvaluations: selectorExecutions.reduce(
      (total, entry) => total + entry.ranking.execution.usedFunctionalEvaluations,
      0
    ),
    usedPerturbationSamples: selectorExecutions.reduce(
      (total, entry) => total + entry.sensitivity.execution.evaluatedVariants,
      0
    ),
    usedSensitivityFunctionalEvaluations: selectorExecutions.reduce(
      (total, entry) =>
        total + entry.sensitivity.execution.usedFunctionalEvaluations,
      0
    )
  };
}

export function interpretPackageLevel(admission, profiles, population, baseline = null) {
  const reasons = [];
  if (admission.status === "indeterminate") reasons.push("admission-indeterminate");
  if (profiles.status === "indeterminate") reasons.push("derived-profile-indeterminate");
  if (population.status === "indeterminate") reasons.push("population-indeterminate");
  if (reasons.length > 0) return { status: "indeterminate", reasons };
  if (population.status === "empty") {
    return { status: "empty", reasons: ["no-materialized-elements"] };
  }
  if (baseline?.status === "indeterminate") {
    return { status: "indeterminate", reasons: ["baseline-indeterminate"] };
  }
  return { status: "complete", reasons: [] };
}

function executeNullModels(
  loadedPackage,
  runConfig,
  census,
  admission,
  options
) {
  if (runConfig.nullModels.length === 0) {
    return {
      baseline: { status: "not-run", reasons: ["null-models-disabled"] },
      artifacts: null
    };
  }
  const plan = createPackageNullModelPlan(
    loadedPackage,
    runConfig,
    census,
    candidateOptions(options)
  );
  const proposals = createPackageNullModelProposals(
    loadedPackage,
    runConfig,
    census,
    plan,
    candidateOptions(options)
  );
  const trialCensuses = evaluatePackageNullModelTrialCensuses(
    loadedPackage,
    runConfig,
    census,
    plan,
    proposals,
    candidateOptions(options)
  );
  const trialSelections = evaluatePackageNullModelTrialSelections(
    loadedPackage,
    runConfig,
    census,
    plan,
    proposals,
    trialCensuses,
    options
  );
  const baseline = evaluatePackageNullModelBaseline(
    loadedPackage,
    runConfig,
    census,
    admission,
    plan,
    proposals,
    trialCensuses,
    trialSelections,
    options
  );
  return {
    baseline,
    artifacts: { plan, proposals, trialCensuses, trialSelections }
  };
}

export function createPackageLevelRunIdentity(
  loadedPackage,
  runConfigHash,
  bindingHash
) {
  const basis = {
    schemaVersion: "1",
    kernelVersion: loadedPackage.semanticManifest.kernelVersion,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash,
    bindingHash
  };
  return {
    ...basis,
    runHash: hashCanonical(HASH_DOMAINS.RUN, basis)
  };
}

/** Executes the complete currently supported primitive-to-depth-1 closure. */
export function closePackageLevel(
  loadedPackageInput,
  runConfigInput,
  options = {}
) {
  const normalizedOptions = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  const census = evaluatePackageCandidateCensus(
    loadedPackage,
    runConfig,
    candidateOptions(normalizedOptions)
  );
  const preflight = preflightPackageLevelExecution(
    loadedPackage,
    runConfig,
    census,
    normalizedOptions,
    true
  );
  const selectorExecutions = executeSelectors(
    loadedPackage,
    runConfig,
    census,
    normalizedOptions
  );
  const execution = finalizePackageLevelExecution(preflight, selectorExecutions);
  const admission = admitPackageSelectors(
    loadedPackage,
    runConfig,
    census,
    selectorExecutions,
    sensitivityOptions(normalizedOptions)
  );
  const formations = materializePackageSelectedFormations(
    loadedPackage,
    runConfig,
    census,
    admission,
    sensitivityOptions(normalizedOptions)
  );
  const profiles = extractPackageDerivedProfiles(
    loadedPackage,
    runConfig,
    census,
    admission,
    formations,
    sensitivityOptions(normalizedOptions)
  );
  const population = materializePackageDerivedDepthPopulation(
    loadedPackage,
    runConfig,
    census,
    admission,
    formations,
    profiles,
    sensitivityOptions(normalizedOptions)
  );
  const nullModels = executeNullModels(
    loadedPackage,
    runConfig,
    census,
    admission,
    normalizedOptions
  );
  const interpretation = interpretPackageLevel(
    admission,
    profiles,
    population,
    nullModels.baseline
  );
  const run = createPackageLevelRunIdentity(
    loadedPackage,
    census.generation.binding.runConfigHash,
    census.bindingHash
  );
  const axis = materializeRunAxis(census.generation.binding.runConfig);
  const basis = {
    schemaVersion: "1",
    closer: PACKAGE_LEVEL_CLOSURE_VERSION,
    scope: PACKAGE_LEVEL_CLOSURE_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    run,
    depth: 1,
    ...axis,
    countingDomain: census.countingDomain,
    artifacts: {
      census,
      admission,
      formations,
      profiles,
      population,
      ...(nullModels.artifacts === null
        ? {}
        : { nullModels: nullModels.artifacts })
    },
    metrics: {
      booleanSelectivity: census.booleanSelectivity,
      selectorCensus: admission.selectorCensus,
      selectionRetention: admission.selectionRetention,
      overallRetention: admission.overallRetention,
      counts: {
        ...admission.counts,
        selectedFormations: formations.counts.selectedFormations,
        materializedProfiles: profiles.counts.materializedProfiles,
        uniqueElements: population.counts.uniqueElements,
        alternateDerivations: population.counts.alternateDerivations
      }
    },
    baseline: nullModels.baseline,
    execution,
    status: interpretation.status,
    interpretation
  };
  return deepFreeze({
    ...basis,
    levelHash: hashCanonical(HASH_DOMAINS.PACKAGE_LEVEL_RESULT, basis)
  });
}

/** Reproduces a stored package-level closure exactly. */
export function verifyPackageLevelClosure(
  levelInput,
  loadedPackageInput,
  runConfigInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(levelInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_LEVEL_CLOSURE_ARTIFACT_INVALID",
      "Level-closure artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = closePackageLevel(
    loadedPackageInput,
    runConfigInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_LEVEL_CLOSURE_MISMATCH",
      "Level closure differs from deterministic reproduction.",
      {
        expectedLevelHash: reproduced.levelHash,
        actualLevelHash:
          isObject(supplied) && typeof supplied.levelHash === "string"
            ? supplied.levelHash
            : null
      }
    );
  }
  return reproduced;
}
