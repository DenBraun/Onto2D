import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import { verifyPackageCohortPartition } from "./package-cohort-partitioner.js";
import {
  PACKAGE_SELECTOR_RANKING_LIMITS,
  verifyPackageSelectorRanking
} from "./package-selector-ranker.js";
import {
  PACKAGE_SELECTOR_SENSITIVITY_LIMITS,
  verifyPackageSelectorSensitivity
} from "./package-selector-sensitivity.js";

export const PACKAGE_SELECTOR_ADMISSION_VERSION =
  "package-selector-admission-v1";
export const PACKAGE_SELECTOR_ADMISSION_SCOPE =
  "complete-local-census-all-declared-selectors-v1";
export const PACKAGE_SELECTOR_ADMISSION_POLICY = deepFreeze({
  selectorOrder: "normalized-selector-id-v1",
  combination: "every-applicable-semantic-extremum-v1",
  decisionPrecedence:
    "predicate-rejected-filter-indeterminate-selector-excluded-selection-indeterminate-selected-v1",
  noSelectors: "identity-admission-without-synthetic-ranking-v1",
  sensitivityEffect: "interpretation-only-without-base-selection-erasure-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);
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
    stage: "ADMIT_PACKAGE_SELECTORS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizePackageSelectorAdmissionOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_ADMISSION_OPTIONS_INVALID",
      "Package selector admission options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_OPTIONS_INVALID",
      "Package selector admission options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_OPTION_UNKNOWN",
      "Unknown package selector admission option.",
      { unknown }
    );
  }
  if (
    value.maxFunctionalEvaluations !== undefined &&
    (
      !Number.isSafeInteger(value.maxFunctionalEvaluations) ||
      value.maxFunctionalEvaluations < 1 ||
      value.maxFunctionalEvaluations >
        PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations
    )
  ) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_RANKING_LIMIT_INVALID",
      "Ranking functional-evaluation limit is outside the supported range.",
      {
        value: value.maxFunctionalEvaluations,
        maximum: PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations
      }
    );
  }
  if (
    value.maxSensitivityFunctionalEvaluations !== undefined &&
    (
      !Number.isSafeInteger(value.maxSensitivityFunctionalEvaluations) ||
      value.maxSensitivityFunctionalEvaluations < 1 ||
      value.maxSensitivityFunctionalEvaluations >
        PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
    )
  ) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_SENSITIVITY_LIMIT_INVALID",
      "Sensitivity functional-evaluation limit is outside the supported range.",
      {
        value: value.maxSensitivityFunctionalEvaluations,
        maximum:
          PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
      }
    );
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
  return selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations",
    "maxSensitivityFunctionalEvaluations"
  ]);
}

function normalizeExecutionInputs(input) {
  let value;
  try {
    value = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_ADMISSION_EXECUTIONS_INVALID",
      "Selector execution inputs are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!Array.isArray(value)) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_EXECUTIONS_INVALID",
      "Selector execution inputs must be an array."
    );
  }
  return value.map((entry, index) => {
    if (!isObject(entry)) {
      fail(
        "PACKAGE_SELECTOR_ADMISSION_EXECUTION_INVALID",
        "Each selector execution input must be an object.",
        { index }
      );
    }
    const unknown = Object.keys(entry)
      .filter((field) => !EXECUTION_FIELDS.has(field));
    if (unknown.length > 0) {
      fail(
        "PACKAGE_SELECTOR_ADMISSION_EXECUTION_FIELD_UNKNOWN",
        "A selector execution input contains an unknown field.",
        { index, unknown }
      );
    }
    const missing = [...EXECUTION_FIELDS]
      .filter((field) => !Object.hasOwn(entry, field));
    if (missing.length > 0) {
      fail(
        "PACKAGE_SELECTOR_ADMISSION_EXECUTION_FIELD_MISSING",
        "A selector execution input is incomplete.",
        { index, missing }
      );
    }
    if (
      typeof entry.selectorId !== "string" ||
      entry.selectorId.length === 0 ||
      entry.selectorId !== entry.selectorId.trim()
    ) {
      fail(
        "PACKAGE_SELECTOR_ADMISSION_SELECTOR_ID_INVALID",
        "Selector execution IDs must be normalized non-empty strings.",
        { index, selectorId: entry.selectorId }
      );
    }
    return entry;
  });
}

function reconcileExecutionIds(selectors, inputs) {
  const expected = selectors.map((selector) => selector.id);
  const actual = inputs.map((entry) => entry.selectorId).sort(compareStrings);
  const duplicates = actual.filter((id, index) => id === actual[index - 1]);
  if (duplicates.length > 0) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_SELECTOR_DUPLICATE",
      "A selector execution was supplied more than once.",
      { selectorIds: [...new Set(duplicates)] }
    );
  }
  if (canonicalize(actual) !== canonicalize(expected)) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_SELECTOR_COVERAGE_MISMATCH",
      "Selector executions must cover every and only declared selector.",
      { expected, actual }
    );
  }
}

function verifyExecutions(
  loadedPackage,
  runConfigInput,
  census,
  executionInputs,
  options
) {
  const inputs = normalizeExecutionInputs(executionInputs);
  const selectors = loadedPackage.normalized.selectors;
  reconcileExecutionIds(selectors, inputs);
  const byId = new Map(inputs.map((entry) => [entry.selectorId, entry]));
  return selectors.map((selector) => {
    const input = byId.get(selector.id);
    const partition = verifyPackageCohortPartition(
      input.partition,
      loadedPackage,
      runConfigInput,
      census,
      candidateOptions(options)
    );
    if (partition.cohortRule.id !== selector.cohortRule) {
      fail(
        "PACKAGE_SELECTOR_ADMISSION_COHORT_RULE_MISMATCH",
        "A selector execution uses a partition for another cohort rule.",
        {
          selectorId: selector.id,
          expectedCohortRuleId: selector.cohortRule,
          actualCohortRuleId: partition.cohortRule.id
        }
      );
    }
    const ranking = verifyPackageSelectorRanking(
      input.ranking,
      loadedPackage,
      runConfigInput,
      census,
      partition,
      rankingOptions(options)
    );
    if (ranking.selector.id !== selector.id) {
      fail(
        "PACKAGE_SELECTOR_ADMISSION_RANKING_SELECTOR_MISMATCH",
        "A ranking belongs to another selector.",
        {
          expectedSelectorId: selector.id,
          actualSelectorId: ranking.selector.id
        }
      );
    }
    const sensitivity = verifyPackageSelectorSensitivity(
      input.sensitivity,
      loadedPackage,
      runConfigInput,
      census,
      partition,
      ranking,
      sensitivityOptions(options)
    );
    return { selectorId: selector.id, partition, ranking, sensitivity };
  });
}

function selectorMemberIndex(execution) {
  const members = new Map();
  for (const cohort of execution.ranking.cohortRankings) {
    for (const member of cohort.members) {
      members.set(member.candidateId, { cohort, member });
    }
  }
  return members;
}

function indeterminateSelectorEvaluation(execution) {
  return {
    selectorId: execution.selectorId,
    cohortId: null,
    outcome: "indeterminate",
    functionalEvaluationHash: null,
    score: null,
    rank: null,
    semanticExtrema: [],
    rankingHash: execution.ranking.rankingHash,
    sensitivityHash: execution.sensitivity.sensitivityHash,
    sensitivityStatus: execution.sensitivity.status,
    sensitivityVerdict: execution.sensitivity.verdict,
    claimRefs: [...execution.ranking.selector.claimRefs]
  };
}

function evaluateSelectorCandidate(execution, memberIndex, candidateId) {
  const located = memberIndex.get(candidateId);
  if (located === undefined) {
    if (execution.partition.status !== "complete") {
      return indeterminateSelectorEvaluation(execution);
    }
    fail(
      "PACKAGE_SELECTOR_ADMISSION_MEMBER_MISSING",
      "A complete selector execution omits an eligible candidate.",
      { selectorId: execution.selectorId, candidateId }
    );
  }
  const { cohort, member } = located;
  const complete = cohort.status === "ranked";
  return {
    selectorId: execution.selectorId,
    cohortId: cohort.cohortId,
    outcome: complete
      ? member.semanticExtremum ? "selected" : "excluded"
      : "indeterminate",
    functionalEvaluationHash: member.evaluation.evaluationHash,
    score: member.evaluation.score,
    rank: member.rank,
    semanticExtrema: [...cohort.semanticExtrema],
    rankingHash: execution.ranking.rankingHash,
    sensitivityHash: execution.sensitivity.sensitivityHash,
    sensitivityStatus: execution.sensitivity.status,
    sensitivityVerdict: execution.sensitivity.verdict,
    claimRefs: [...execution.ranking.selector.claimRefs]
  };
}

function decideCandidate(filterInput, executions, indexes) {
  const occurrenceAware = isObject(filterInput) &&
    typeof filterInput.memberId === "string" &&
    isObject(filterInput.filter);
  const filter = occurrenceAware ? filterInput.filter : filterInput;
  const candidateId = occurrenceAware
    ? filterInput.memberId
    : filter.formation.candidate.id;
  const local = {
    candidateId,
    filterHash: filter.filterHash,
    localVerdict: filter.verdict,
    passedPredicateIds: [...filter.passedPredicates]
  };
  if (filter.verdict === "predicate-rejected") {
    return {
      ...local,
      outcome: "predicate-rejected",
      selectorEvaluations: [],
      selectedBy: [],
      excludedBy: [],
      indeterminateBy: []
    };
  }
  if (filter.verdict === "filter-indeterminate") {
    return {
      ...local,
      outcome: "filter-indeterminate",
      selectorEvaluations: [],
      selectedBy: [],
      excludedBy: [],
      indeterminateBy: []
    };
  }
  const selectorEvaluations = executions.map((execution, index) =>
    evaluateSelectorCandidate(execution, indexes[index], candidateId)
  );
  const selectedBy = selectorEvaluations
    .filter((entry) => entry.outcome === "selected")
    .map((entry) => entry.selectorId);
  const excludedBy = selectorEvaluations
    .filter((entry) => entry.outcome === "excluded")
    .map((entry) => entry.selectorId);
  const indeterminateBy = selectorEvaluations
    .filter((entry) => entry.outcome === "indeterminate")
    .map((entry) => entry.selectorId);
  const outcome = excludedBy.length > 0
    ? "selector-excluded"
    : indeterminateBy.length > 0
      ? "selection-indeterminate"
      : "selected";
  return {
    ...local,
    outcome,
    selectorEvaluations,
    selectedBy,
    excludedBy,
    indeterminateBy
  };
}

function variationalInterpretation(execution) {
  if (execution.ranking.status === "empty") {
    return { status: "not-applicable", reasons: ["no-ranked-cohorts"] };
  }
  if (execution.ranking.status === "indeterminate") {
    return {
      status: "indeterminate",
      reasons: [execution.ranking.reason]
    };
  }
  if (execution.sensitivity.status === "indeterminate") {
    return {
      status: "indeterminate",
      reasons: [...execution.sensitivity.reasons]
    };
  }
  if (execution.sensitivity.verdict === "fragile") {
    return { status: "fragile", reasons: ["sensitivity-fragile"] };
  }
  return { status: "valid", reasons: [] };
}

function selectorCensus(execution, decisions) {
  const evaluations = decisions
    .filter((decision) => decision.localVerdict === "eligible")
    .map((decision) => decision.selectorEvaluations.find(
      (entry) => entry.selectorId === execution.selectorId
    ));
  return {
    selectorId: execution.selectorId,
    cohortRuleId: execution.ranking.cohortRuleId,
    rankingHash: execution.ranking.rankingHash,
    sensitivityHash: execution.sensitivity.sensitivityHash,
    rankingStatus: execution.ranking.status,
    sensitivityStatus: execution.sensitivity.status,
    sensitivityVerdict: execution.sensitivity.verdict,
    counts: {
      evaluated: evaluations.length,
      selected: evaluations.filter((entry) => entry.outcome === "selected").length,
      excluded: evaluations.filter((entry) => entry.outcome === "excluded").length,
      indeterminate: evaluations.filter(
        (entry) => entry.outcome === "indeterminate"
      ).length
    },
    variationalSelectivity: execution.ranking.variationalSummary,
    interpretation: variationalInterpretation(execution)
  };
}

function countOutcome(decisions, outcome) {
  return decisions.filter((decision) => decision.outcome === outcome).length;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function admissionInterpretation(counts, threshold) {
  if (counts.evaluatedCandidates === 0) {
    return { status: "empty", reasons: ["no-evaluated-candidates"] };
  }
  const finalRatio = counts.finalIndeterminate / counts.evaluatedCandidates;
  if (finalRatio > threshold) {
    return {
      status: "indeterminate",
      reasons: ["indeterminate-ratio-exceeds-threshold"]
    };
  }
  return { status: "complete", reasons: [] };
}

/**
 * Intersects every declared selector's complete semantic-extremum decisions
 * over one independently reproduced local-filter census.
 */
export function admitVerifiedPackageSelectors(
  loadedPackage,
  census,
  selectorExecutions
) {
  const indexes = selectorExecutions.map(selectorMemberIndex);
  const decisions = census.candidateEvaluations.map((filter) =>
    decideCandidate(filter, selectorExecutions, indexes)
  ).sort((left, right) => compareStrings(left.candidateId, right.candidateId));
  const selectorCensuses = selectorExecutions.map((execution) =>
    selectorCensus(execution, decisions)
  );
  const counts = {
    evaluatedCandidates: decisions.length,
    predicateRejected: countOutcome(decisions, "predicate-rejected"),
    filterIndeterminate: countOutcome(decisions, "filter-indeterminate"),
    eligibleCandidates: decisions.filter(
      (decision) => decision.localVerdict === "eligible"
    ).length,
    selectorExcluded: countOutcome(decisions, "selector-excluded"),
    selectionIndeterminate: countOutcome(decisions, "selection-indeterminate"),
    selectedCandidates: countOutcome(decisions, "selected"),
    finalIndeterminate: 0
  };
  counts.finalIndeterminate =
    counts.filterIndeterminate + counts.selectionIndeterminate;
  const interpretation = admissionInterpretation(
    counts,
    census.generation.binding.runConfig.indeterminateThreshold
  );
  const basis = {
    schemaVersion: "1",
    admitter: PACKAGE_SELECTOR_ADMISSION_VERSION,
    scope: PACKAGE_SELECTOR_ADMISSION_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    countingDomain: census.countingDomain,
    sourcePopulationHash: census.sourcePopulationHash,
    selectorOrder: selectorExecutions.map((execution) => execution.selectorId),
    admissionPolicy: PACKAGE_SELECTOR_ADMISSION_POLICY,
    selectorExecutions,
    decisions,
    selectorCensus: selectorCensuses,
    selectedCandidateIds: decisions
      .filter((decision) => decision.outcome === "selected")
      .map((decision) => decision.candidateId),
    counts,
    selectionRetention: ratio(
      counts.selectedCandidates,
      counts.eligibleCandidates
    ),
    overallRetention: ratio(
      counts.selectedCandidates,
      counts.evaluatedCandidates
    ),
    indeterminateRatio: ratio(
      counts.finalIndeterminate,
      counts.evaluatedCandidates
    ),
    status: interpretation.status,
    interpretation
  };
  return deepFreeze({
    ...basis,
    admissionHash: hashCanonical(HASH_DOMAINS.PACKAGE_SELECTOR_ADMISSION, basis)
  });
}

/**
 * Intersects every declared selector over one reproduced primitive-source
 * local-filter census.
 */
export function admitPackageSelectors(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  selectorExecutionsInput,
  options = {}
) {
  const normalized = normalizePackageSelectorAdmissionOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    candidateOptions(normalized)
  );
  const selectorExecutions = verifyExecutions(
    loadedPackage,
    runConfigInput,
    census,
    selectorExecutionsInput,
    normalized
  );
  return admitVerifiedPackageSelectors(
    loadedPackage,
    census,
    selectorExecutions
  );
}

/** Reproduces a stored complete multi-selector admission artifact exactly. */
export function verifyPackageSelectorAdmission(
  admissionInput,
  loadedPackageInput,
  runConfigInput,
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
      "PACKAGE_SELECTOR_ADMISSION_ARTIFACT_INVALID",
      "Package selector admission artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = admitPackageSelectors(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    selectorExecutionsInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_SELECTOR_ADMISSION_MISMATCH",
      "Package selector admission differs from deterministic reproduction.",
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
