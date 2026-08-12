import { canonicalClone } from "./canonical.js";
import { KernelError } from "./errors.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  createPackageDepthFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  verifyVerifiedPackageCohortPartition
} from "./package-cohort-partitioner.js";
import {
  normalizePackageSelectorRankingOptions,
  verifyVerifiedPackageSelectorRanking
} from "./package-selector-ranker.js";
import {
  evaluateVerifiedPackageSelectorSensitivity,
  normalizePackageSelectorSensitivityOptions,
  verifyVerifiedPackageSelectorSensitivity
} from "./package-selector-sensitivity.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "EVALUATE_PACKAGE_DEPTH_SELECTOR_SENSITIVITY",
    message,
    details
  });
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function rankingOptions(options) {
  const selected = {};
  for (const field of [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations"
  ]) {
    if (options[field] !== undefined) selected[field] = options[field];
  }
  return normalizePackageSelectorRankingOptions(selected);
}

function depthFunctionalSession(levelClosures) {
  return (loaded, binding, functionalId, functionalOptions) =>
    createPackageDepthFunctionalEvaluationSession(
      loaded,
      binding,
      levelClosures,
      functionalId,
      functionalOptions
    );
}

/** Executes every required perturbation over a target-depth selector ranking. */
export function evaluatePackageDepthSelectorSensitivity(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  partitionInput,
  rankingInput,
  options = {}
) {
  const normalized = normalizePackageSelectorSensitivityOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    normalized
  );
  const partition = verifyVerifiedPackageCohortPartition(
    partitionInput,
    loadedPackage,
    census
  );
  const createFunctionalSession = depthFunctionalSession(levelClosuresInput);
  const ranking = verifyVerifiedPackageSelectorRanking(
    rankingInput,
    loadedPackage,
    census,
    partition,
    rankingOptions(normalized),
    createFunctionalSession
  );
  return evaluateVerifiedPackageSelectorSensitivity(
    loadedPackage,
    census,
    partition,
    ranking,
    normalized,
    createFunctionalSession
  );
}

/** Reproduces a target-depth sensitivity report exactly. */
export function verifyPackageDepthSelectorSensitivity(
  sensitivityInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  partitionInput,
  rankingInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(sensitivityInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SELECTOR_SENSITIVITY_INVALID",
      "Depth-selector sensitivity report is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(supplied)) {
    fail(
      "PACKAGE_DEPTH_SELECTOR_SENSITIVITY_INVALID",
      "Depth-selector sensitivity report must be an object."
    );
  }
  const normalized = normalizePackageSelectorSensitivityOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    normalized
  );
  const partition = verifyVerifiedPackageCohortPartition(
    partitionInput,
    loadedPackage,
    census
  );
  const createFunctionalSession = depthFunctionalSession(levelClosuresInput);
  const ranking = verifyVerifiedPackageSelectorRanking(
    rankingInput,
    loadedPackage,
    census,
    partition,
    rankingOptions(normalized),
    createFunctionalSession
  );
  return verifyVerifiedPackageSelectorSensitivity(
    supplied,
    loadedPackage,
    census,
    partition,
    ranking,
    normalized,
    createFunctionalSession
  );
}
