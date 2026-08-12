import { canonicalClone } from "./canonical.js";
import { KernelError } from "./errors.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  constructVerifiedPackageCohorts,
  verifyVerifiedPackageCohortPartition
} from "./package-cohort-partitioner.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";

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
    stage: "PARTITION_PACKAGE_DEPTH_COHORTS",
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
      "PACKAGE_DEPTH_COHORT_OPTIONS_INVALID",
      "Depth-cohort options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_DEPTH_COHORT_OPTIONS_INVALID",
      "Depth-cohort options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_DEPTH_COHORT_OPTION_UNKNOWN",
      "Unknown depth-cohort option.",
      { unknown }
    );
  }
  return value;
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

/** Constructs cohorts over an exactly reproduced target-depth census. */
export function constructPackageDepthCohorts(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  cohortRuleId,
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
  return constructVerifiedPackageCohorts(
    loadedPackage,
    census,
    cohortRuleId
  );
}

/** Reproduces a target-depth cohort partition exactly. */
export function verifyPackageDepthCohortPartition(
  partitionInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
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
  return verifyVerifiedPackageCohortPartition(
    partitionInput,
    loadedPackage,
    census
  );
}
