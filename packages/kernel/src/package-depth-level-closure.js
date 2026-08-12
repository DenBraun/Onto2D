import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { materializeRunAxis } from "./run-axis.js";
import {
  createPreparedPackageCandidateFilterSession
} from "./package-candidate-filter.js";
import {
  constructVerifiedPackageCohorts
} from "./package-cohort-partitioner.js";
import {
  PACKAGE_DEPTH_CANDIDATE_FILTER_EVALUATOR_VERSION
} from "./package-depth-candidate-filter.js";
import {
  evaluatePackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  createPreparedPackageFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import {
  normalizePackageSelectorRankingOptions,
  rankVerifiedPackageSelector
} from "./package-selector-ranker.js";
import {
  evaluateVerifiedPackageSelectorSensitivity,
  normalizePackageSelectorSensitivityOptions
} from "./package-selector-sensitivity.js";
import {
  admitVerifiedPackageSelectors
} from "./package-selector-admission.js";
import {
  materializeVerifiedPackageSelectedFormations
} from "./package-selected-formations.js";
import {
  extractVerifiedPackageDerivedProfiles
} from "./package-derived-profiles.js";
import {
  materializeVerifiedPackageDerivedDepthPopulation
} from "./package-derived-depth-population.js";
import {
  createPackageLevelRunIdentity,
  finalizePackageLevelExecution,
  interpretPackageLevel,
  normalizePackageLevelClosureOptions,
  preflightPackageLevelExecution
} from "./package-level-closure.js";
import { normalizeRunConfig } from "./run-config.js";
import {
  createPackageDepthNullModelPlan
} from "./package-null-model-plan.js";
import {
  createPackageDepthNullModelProposals
} from "./package-null-model-proposals.js";
import {
  evaluatePackageDepthNullModelTrialCensuses
} from "./package-null-model-trial-census.js";
import {
  evaluatePackageDepthNullModelTrialSelections
} from "./package-null-model-trial-selection.js";
import {
  evaluatePackageDepthNullModelBaseline
} from "./package-null-model-baseline.js";

export const PACKAGE_DEPTH_LEVEL_CLOSURE_VERSION =
  "package-depth-level-closure-v1";
export const PACKAGE_DEPTH_LEVEL_CLOSURE_SCOPE =
  "verified-prior-levels-to-target-depth-v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "CLOSE_PACKAGE_DEPTH_LEVEL",
    message,
    details
  });
}

function selectOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
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
  return normalizePackageSelectorRankingOptions(selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations"
  ]));
}

function selectorExecutions(loadedPackage, census, options) {
  const filterSession = createPreparedPackageCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    {
      evaluator: PACKAGE_DEPTH_CANDIDATE_FILTER_EVALUATOR_VERSION,
      hashDomain: HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_FILTER
    }
  );
  const createFunctionalSession = (
    _loadedPackage,
    _binding,
    functionalId
  ) => createPreparedPackageFunctionalEvaluationSession(
    loadedPackage,
    filterSession,
    functionalId
  );
  const normalizedRanking = rankingOptions(options);
  const normalizedSensitivity =
    normalizePackageSelectorSensitivityOptions(options);
  return loadedPackage.normalized.selectors.map((selector) => {
    const partition = constructVerifiedPackageCohorts(
      loadedPackage,
      census,
      selector.cohortRule
    );
    const ranking = rankVerifiedPackageSelector(
      loadedPackage,
      census,
      partition,
      selector.id,
      normalizedRanking,
      createFunctionalSession
    );
    const sensitivity = evaluateVerifiedPackageSelectorSensitivity(
      loadedPackage,
      census,
      partition,
      ranking,
      normalizedSensitivity,
      createFunctionalSession
    );
    return { selectorId: selector.id, partition, ranking, sensitivity };
  });
}

function priorLevelHashes(census) {
  return census.generation.binding.sourcePopulation.populations
    .filter((entry) => entry.depth > 0)
    .map((entry) => ({
      depth: entry.depth,
      levelHash: entry.levelHash,
      populationHash: entry.populationHash,
      runHash: entry.runHash
    }));
}

function executeDepthNullModels(
  loadedPackage,
  runConfig,
  levels,
  targetDepth,
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
  const plan = createPackageDepthNullModelPlan(
    loadedPackage,
    runConfig,
    levels,
    targetDepth,
    census,
    candidateOptions(options)
  );
  const proposals = createPackageDepthNullModelProposals(
    loadedPackage,
    runConfig,
    levels,
    targetDepth,
    census,
    plan,
    candidateOptions(options)
  );
  const trialCensuses = evaluatePackageDepthNullModelTrialCensuses(
    loadedPackage,
    runConfig,
    levels,
    targetDepth,
    census,
    plan,
    proposals,
    candidateOptions(options)
  );
  const trialSelections = evaluatePackageDepthNullModelTrialSelections(
    loadedPackage,
    runConfig,
    levels,
    targetDepth,
    census,
    plan,
    proposals,
    trialCensuses,
    options
  );
  const baseline = evaluatePackageDepthNullModelBaseline(
    loadedPackage,
    runConfig,
    levels,
    targetDepth,
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

/** Executes one complete target-depth transition from verified prior levels. */
export function closePackageDepthLevel(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  options = {}
) {
  const normalizedOptions = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  const census = evaluatePackageDepthCandidateCensus(
    loadedPackage,
    runConfig,
    levelClosuresInput,
    targetDepth,
    normalizedOptions
  );
  const preflight = preflightPackageLevelExecution(
    loadedPackage,
    runConfig,
    census,
    normalizedOptions,
    true
  );
  const executions = selectorExecutions(
    loadedPackage,
    census,
    normalizedOptions
  );
  const execution = finalizePackageLevelExecution(preflight, executions);
  const admission = admitVerifiedPackageSelectors(
    loadedPackage,
    census,
    executions
  );
  const formations = materializeVerifiedPackageSelectedFormations(
    loadedPackage,
    census,
    admission
  );
  const profiles = extractVerifiedPackageDerivedProfiles(
    loadedPackage,
    census,
    formations
  );
  const population = materializeVerifiedPackageDerivedDepthPopulation(
    loadedPackage,
    census,
    formations,
    profiles
  );
  const nullModels = executeDepthNullModels(
    loadedPackage,
    runConfig,
    levelClosuresInput,
    targetDepth,
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
    closer: PACKAGE_DEPTH_LEVEL_CLOSURE_VERSION,
    scope: PACKAGE_DEPTH_LEVEL_CLOSURE_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    run,
    depth: targetDepth,
    ...axis,
    priorLevels: priorLevelHashes(census),
    sourceSelectionHash:
      census.generation.binding.sourcePopulation.selectionHash,
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

/** Reproduces a stored target-depth level closure exactly. */
export function verifyPackageDepthLevelClosure(
  levelInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(levelInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_LEVEL_CLOSURE_ARTIFACT_INVALID",
      "Depth-level closure is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = closePackageDepthLevel(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DEPTH_LEVEL_CLOSURE_MISMATCH",
      "Depth-level closure differs from deterministic reproduction.",
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
