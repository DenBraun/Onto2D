import { canonicalClone, canonicalize } from "./canonical.js";
import { KernelError } from "./errors.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  verifyVerifiedPackageCohortPartition
} from "./package-cohort-partitioner.js";
import {
  createPackageDepthFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import {
  normalizePackageSelectorRankingOptions,
  verifyVerifiedPackageSelectorRanking
} from "./package-selector-ranker.js";
import {
  admitVerifiedPackageSelectors,
  normalizePackageSelectorAdmissionOptions
} from "./package-selector-admission.js";
import {
  normalizePackageSelectorSensitivityOptions,
  verifyVerifiedPackageSelectorSensitivity
} from "./package-selector-sensitivity.js";

const EXECUTION_FIELDS = new Set([
  "selectorId",
  "partition",
  "ranking",
  "sensitivity"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "ADMIT_PACKAGE_DEPTH_SELECTORS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function selectOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
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

function sensitivityOptions(options) {
  return normalizePackageSelectorSensitivityOptions(options);
}

function depthFunctionalSession(levels) {
  return (loaded, binding, functionalId, functionalOptions) =>
    createPackageDepthFunctionalEvaluationSession(
      loaded,
      binding,
      levels,
      functionalId,
      functionalOptions
    );
}

function normalizeExecutions(input) {
  let value;
  try {
    value = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SELECTOR_ADMISSION_EXECUTIONS_INVALID",
      "Depth-selector executions are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!Array.isArray(value)) {
    fail(
      "PACKAGE_DEPTH_SELECTOR_ADMISSION_EXECUTIONS_INVALID",
      "Depth-selector executions must be an array."
    );
  }
  return value.map((entry, index) => {
    if (!isObject(entry)) {
      fail(
        "PACKAGE_DEPTH_SELECTOR_ADMISSION_EXECUTION_INVALID",
        "Each depth-selector execution must be an object.",
        { index }
      );
    }
    const unknown = Object.keys(entry)
      .filter((field) => !EXECUTION_FIELDS.has(field));
    const missing = [...EXECUTION_FIELDS]
      .filter((field) => !Object.hasOwn(entry, field));
    if (unknown.length > 0 || missing.length > 0) {
      fail(
        "PACKAGE_DEPTH_SELECTOR_ADMISSION_EXECUTION_INVALID",
        "A depth-selector execution has an invalid field set.",
        { index, unknown, missing }
      );
    }
    if (
      typeof entry.selectorId !== "string" ||
      entry.selectorId.length === 0 ||
      entry.selectorId !== entry.selectorId.trim()
    ) {
      fail(
        "PACKAGE_DEPTH_SELECTOR_ADMISSION_SELECTOR_ID_INVALID",
        "Depth-selector execution IDs must be normalized non-empty strings.",
        { index, selectorId: entry.selectorId }
      );
    }
    return entry;
  });
}

function verifyExecutions(
  inputs,
  loadedPackage,
  levels,
  census,
  options
) {
  const selectors = loadedPackage.normalized.selectors;
  const expected = selectors.map((selector) => selector.id);
  const actual = inputs.map((entry) => entry.selectorId).sort(compareStrings);
  if (
    new Set(actual).size !== actual.length ||
    canonicalize(expected) !== canonicalize(actual)
  ) {
    fail(
      "PACKAGE_DEPTH_SELECTOR_ADMISSION_COVERAGE_MISMATCH",
      "Depth-selector executions must cover every declared selector exactly once.",
      { expected, actual }
    );
  }
  const byId = new Map(inputs.map((entry) => [entry.selectorId, entry]));
  const createFunctionalSession = depthFunctionalSession(levels);
  const normalizedRankingOptions = rankingOptions(options);
  const normalizedSensitivityOptions = sensitivityOptions(options);
  return selectors.map((selector) => {
    const input = byId.get(selector.id);
    const partition = verifyVerifiedPackageCohortPartition(
      input.partition,
      loadedPackage,
      census
    );
    if (partition.cohortRule.id !== selector.cohortRule) {
      fail(
        "PACKAGE_DEPTH_SELECTOR_ADMISSION_COHORT_RULE_MISMATCH",
        "A depth-selector execution uses another selector's cohort rule.",
        {
          selectorId: selector.id,
          expectedCohortRuleId: selector.cohortRule,
          actualCohortRuleId: partition.cohortRule.id
        }
      );
    }
    const ranking = verifyVerifiedPackageSelectorRanking(
      input.ranking,
      loadedPackage,
      census,
      partition,
      normalizedRankingOptions,
      createFunctionalSession
    );
    if (ranking.selector.id !== selector.id) {
      fail(
        "PACKAGE_DEPTH_SELECTOR_ADMISSION_RANKING_MISMATCH",
        "A depth-selector ranking belongs to another selector.",
        {
          expectedSelectorId: selector.id,
          actualSelectorId: ranking.selector.id
        }
      );
    }
    const sensitivity = verifyVerifiedPackageSelectorSensitivity(
      input.sensitivity,
      loadedPackage,
      census,
      partition,
      ranking,
      normalizedSensitivityOptions,
      createFunctionalSession
    );
    return { selectorId: selector.id, partition, ranking, sensitivity };
  });
}

/** Intersects every selector over one reproduced target-depth census. */
export function admitPackageDepthSelectors(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  selectorExecutionsInput,
  options = {}
) {
  const normalized = normalizePackageSelectorAdmissionOptions(options);
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
  const inputs = normalizeExecutions(selectorExecutionsInput);
  const executions = verifyExecutions(
    inputs,
    loadedPackage,
    levelClosuresInput,
    census,
    normalized
  );
  return admitVerifiedPackageSelectors(loadedPackage, census, executions);
}

/** Reproduces target-depth multi-selector admission exactly. */
export function verifyPackageDepthSelectorAdmission(
  admissionInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  selectorExecutionsInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(admissionInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SELECTOR_ADMISSION_INVALID",
      "Depth-selector admission is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = admitPackageDepthSelectors(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    censusInput,
    selectorExecutionsInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DEPTH_SELECTOR_ADMISSION_MISMATCH",
      "Depth-selector admission differs from deterministic reproduction.",
      {
        expectedAdmissionHash: reproduced.admissionHash,
        actualAdmissionHash:
          isObject(supplied) && typeof supplied.admissionHash === "string"
            ? supplied.admissionHash
            : null
      }
    );
  }
  return reproduced;
}
