import { canonicalClone, canonicalize } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  createPreparedPackageCandidateFilterSession
} from "./package-candidate-filter.js";
import {
  createPackageDepthCandidateBinding
} from "./package-depth-candidate-generator.js";

export const PACKAGE_DEPTH_CANDIDATE_FILTER_EVALUATOR_VERSION =
  "package-depth-candidate-filter-evaluator-v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "FILTER_PACKAGE_DEPTH_CANDIDATE",
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
      "PACKAGE_DEPTH_CANDIDATE_FILTER_OPTIONS_INVALID",
      "Depth-candidate filter options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (
    !isObject(value) ||
    Object.keys(value).some((field) => field !== "kernelVersion")
  ) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_FILTER_OPTIONS_INVALID",
      "Depth-candidate filter options may contain only kernelVersion."
    );
  }
  if (
    value.kernelVersion !== undefined &&
    (typeof value.kernelVersion !== "string" ||
      value.kernelVersion.trim().length === 0)
  ) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_FILTER_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a non-empty string.",
      { value: value.kernelVersion }
    );
  }
  return value.kernelVersion === undefined
    ? {}
    : { kernelVersion: value.kernelVersion.trim() };
}

function bindingReplayOptions(binding, levelClosures, kernelVersion) {
  if (
    !isObject(binding.enumerationOptions) ||
    !isObject(binding.enumerationOptions.canonicalizationLimits)
  ) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_FILTER_BINDING_INVALID",
      "Depth-candidate binding lacks reproducible execution options."
    );
  }
  const options = {
    maxRawCandidates: binding.enumerationOptions.maxRawCandidates,
    maxDecorationStates: binding.enumerationOptions.maxDecorationStates,
    maxSearchStates:
      binding.enumerationOptions.canonicalizationLimits.maxSearchStates,
    ...(kernelVersion === undefined ? {} : { kernelVersion })
  };
  if (levelClosures.length > 0) {
    const level = levelClosures[0];
    if (!isObject(level) || !isObject(level.execution)) {
      fail(
        "PACKAGE_DEPTH_CANDIDATE_FILTER_LEVEL_INVALID",
        "Prior level closure lacks reproducible execution options."
      );
    }
    options.maxFunctionalEvaluations =
      level.execution.maxFunctionalEvaluations;
    options.maxSensitivityFunctionalEvaluations =
      level.execution.maxSensitivityFunctionalEvaluations;
  }
  return options;
}

function verifyBinding(
  loadedPackage,
  bindingInput,
  levelClosures,
  kernelVersion
) {
  let binding;
  let levels;
  try {
    binding = canonicalClone(bindingInput);
    levels = canonicalClone(levelClosures);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_CANDIDATE_FILTER_BINDING_INVALID",
      "Depth-candidate binding is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (
    !isObject(binding) ||
    !isObject(binding.runConfig) ||
    !Array.isArray(levels)
  ) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_FILTER_BINDING_INVALID",
      "Depth-candidate binding or prior level list is malformed."
    );
  }
  let reproduced;
  try {
    reproduced = createPackageDepthCandidateBinding(
      loadedPackage,
      binding.runConfig,
      levels,
      binding.targetDepth,
      bindingReplayOptions(binding, levels, kernelVersion)
    );
  } catch (error) {
    if (error instanceof KernelError) {
      fail(
        "PACKAGE_DEPTH_CANDIDATE_FILTER_BINDING_INVALID",
        "Depth-candidate binding cannot be reproduced.",
        { causeCode: error.code, causeIssues: error.issues ?? [] }
      );
    }
    throw error;
  }
  if (canonicalize(binding) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_FILTER_BINDING_MISMATCH",
      "Depth-candidate binding differs from deterministic reproduction.",
      {
        expectedBindingHash: reproduced.bindingHash,
        actualBindingHash: binding.bindingHash
      }
    );
  }
  return reproduced;
}

/** Prepares repeated depth-aware local filtering after exact binding replay. */
export function createPackageDepthCandidateFilterSession(
  loadedPackageInput,
  bindingInput,
  levelClosures,
  options = {}
) {
  const normalizedOptions = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    normalizedOptions
  );
  const binding = verifyBinding(
    loadedPackage,
    bindingInput,
    levelClosures,
    normalizedOptions.kernelVersion
  );
  return createPreparedPackageCandidateFilterSession(loadedPackage, binding, {
    evaluator: PACKAGE_DEPTH_CANDIDATE_FILTER_EVALUATOR_VERSION,
    hashDomain: HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_FILTER
  });
}

/** Evaluates one candidate from a reproduced target-depth universe. */
export function evaluatePackageDepthCandidateFilter(
  loadedPackageInput,
  bindingInput,
  levelClosures,
  candidateInput,
  options = {}
) {
  return createPackageDepthCandidateFilterSession(
    loadedPackageInput,
    bindingInput,
    levelClosures,
    options
  ).evaluate(candidateInput);
}
