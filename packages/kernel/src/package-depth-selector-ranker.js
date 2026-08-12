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
  rankVerifiedPackageSelector,
  verifyVerifiedPackageSelectorRanking
} from "./package-selector-ranker.js";

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
    stage: "RANK_PACKAGE_DEPTH_SELECTOR",
    message,
    details
  });
}

function normalizeOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SELECTOR_OPTIONS_INVALID",
      "Depth-selector ranking options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_DEPTH_SELECTOR_OPTIONS_INVALID",
      "Depth-selector ranking options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_DEPTH_SELECTOR_OPTION_UNKNOWN",
      "Unknown depth-selector ranking option.",
      { unknown }
    );
  }
  return value;
}

function selectOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
}

function loadedOptions(options) {
  return selectOptions(options, ["kernelVersion"]);
}

function normalizedRankingOptions(options) {
  return normalizePackageSelectorRankingOptions(selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations"
  ]));
}

/** Ranks every member of a reproduced target-depth cohort partition. */
export function rankPackageDepthSelector(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  partitionInput,
  selectorId,
  options = {}
) {
  const normalized = normalizeOptions(options);
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
  const rankingOptions = normalizedRankingOptions(normalized);
  return rankVerifiedPackageSelector(
    loadedPackage,
    census,
    partition,
    selectorId,
    rankingOptions,
    (loaded, binding, functionalId, functionalOptions) =>
      createPackageDepthFunctionalEvaluationSession(
        loaded,
        binding,
        levelClosuresInput,
        functionalId,
        functionalOptions
      )
  );
}

/** Reproduces a target-depth selector ranking exactly. */
export function verifyPackageDepthSelectorRanking(
  rankingInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  partitionInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
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
  const rankingOptions = normalizedRankingOptions(normalized);
  return verifyVerifiedPackageSelectorRanking(
    rankingInput,
    loadedPackage,
    census,
    partition,
    rankingOptions,
    (loaded, binding, functionalId, functionalOptions) =>
      createPackageDepthFunctionalEvaluationSession(
        loaded,
        binding,
        levelClosuresInput,
        functionalId,
        functionalOptions
      )
  );
}
