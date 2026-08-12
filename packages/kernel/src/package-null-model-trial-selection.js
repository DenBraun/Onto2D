import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import { createPackageCandidateFilterSession } from "./package-candidate-filter.js";
import {
  PACKAGE_COHORT_PARTITIONER_VERSION,
  PACKAGE_COHORT_PARTITION_SCOPE,
  constructVerifiedPackageCohortMembers
} from "./package-cohort-partitioner.js";
import { verifyPackageDepthCandidateCensus } from "./package-depth-candidate-census.js";
import {
  createPackageDepthCandidateFilterSession
} from "./package-depth-candidate-filter.js";
import {
  createPreparedPackageFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import {
  verifyPackageDepthNullModelTrialCensuses,
  verifyPackageNullModelTrialCensuses
} from "./package-null-model-trial-census.js";
import {
  PACKAGE_SELECTOR_RANKER_VERSION,
  PACKAGE_SELECTOR_RANKING_POLICY,
  PACKAGE_SELECTOR_RANKING_SCOPE,
  normalizePackageSelectorRankingOptions,
  rankVerifiedCohortEvaluations
} from "./package-selector-ranker.js";
import {
  admitVerifiedPackageSelectors
} from "./package-selector-admission.js";
import {
  PACKAGE_SELECTOR_SENSITIVITY_LIMITS,
  evaluateVerifiedPackageSelectorSensitivity,
  normalizePackageSelectorSensitivityOptions
} from "./package-selector-sensitivity.js";

export const PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_VERSION =
  "package-null-model-trial-selections-v1";
export const PACKAGE_NULL_MODEL_TRIAL_SELECTION_SCOPE =
  "complete-occurrence-cohort-functional-selector-replay-v1";
export const PACKAGE_NULL_MODEL_TRIAL_SELECTION_POLICY = deepFreeze({
  memberIdentity: "trial-occurrence-id-v1",
  duplicateCandidates: "retain-as-distinct-occurrences-v1",
  cohortKeys: "recompute-on-proposed-candidate-per-trial-v1",
  functionalValues: "recompute-every-occurrence-per-selector-v1",
  selectorAdmission: "rerank-and-readmit-per-trial-v1",
  sensitivity: "repeat-declared-complete-sweep-per-trial-v1",
  nodeInternalQuantities: "fixed-unless-randomized-by-model-v1",
  derivedEvidence: "recompute-with-functional-or-mark-indeterminate-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxNullTrials",
  "maxProposalOccurrences",
  "maxProposalOperations",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);
const CANDIDATE_OPTION_FIELDS = Object.freeze([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates"
]);
const TRIAL_CENSUS_OPTION_FIELDS = Object.freeze([
  ...CANDIDATE_OPTION_FIELDS,
  "maxNullTrials",
  "maxProposalOccurrences",
  "maxProposalOperations"
]);
const RANKING_OPTION_FIELDS = Object.freeze([
  ...CANDIDATE_OPTION_FIELDS,
  "maxFunctionalEvaluations"
]);
const SENSITIVITY_OPTION_FIELDS = Object.freeze([
  ...RANKING_OPTION_FIELDS,
  "maxSensitivityFunctionalEvaluations"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "SELECT_PACKAGE_NULL_MODEL_TRIALS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectedOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
}

function normalizeOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_SELECTION_OPTIONS_INVALID",
      "Null-model trial-selection options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_SELECTION_OPTIONS_INVALID",
      "Null-model trial-selection options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_SELECTION_OPTION_UNKNOWN",
      "Unknown null-model trial-selection option.",
      { unknown }
    );
  }
  const ranking = normalizePackageSelectorRankingOptions(
    selectedOptions(value, RANKING_OPTION_FIELDS)
  );
  const sensitivity = normalizePackageSelectorSensitivityOptions(
    selectedOptions(value, SENSITIVITY_OPTION_FIELDS)
  );
  return { value, ranking, sensitivity };
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function portableCount(value) {
  return value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}

function sensitivityVariants(selector, coefficientCount) {
  if (coefficientCount === 0) return 0n;
  const perAmplitude = selector.sensitivity.sweep === "one-at-a-time"
    ? BigInt(coefficientCount) * 2n
    : 2n ** BigInt(coefficientCount);
  return perAmplitude * BigInt(selector.sensitivity.amplitudes.length);
}

function executionPreflight(loadedPackage, census, trialCensuses, normalized) {
  const selectableTrials = trialCensuses.trials.filter(
    (trial) => trial.interpretation.status === "valid"
  );
  const eligibleOccurrences = selectableTrials.reduce(
    (total, trial) => total + trial.counts.eligible,
    0
  );
  const selectors = loadedPackage.normalized.selectors;
  const baseEvaluations = BigInt(eligibleOccurrences) * BigInt(selectors.length);
  if (baseEvaluations > BigInt(normalized.ranking.maxFunctionalEvaluations)) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_FUNCTIONAL_EVALUATION_LIMIT",
      "Complete null-trial base functional replay exceeds its aggregate limit.",
      {
        required: portableCount(baseEvaluations),
        maximum: normalized.ranking.maxFunctionalEvaluations
      }
    );
  }
  const functionals = new Map(loadedPackage.normalized.functionals.map(
    (functional) => [functional.id, functional]
  ));
  let sensitivityEvaluations = 0n;
  let requiredVariantsPerTrial = 0n;
  for (const selector of selectors) {
    const functional = functionals.get(selector.functional);
    const variants = sensitivityVariants(
      selector,
      functional.sensitivityCoefficients.length
    );
    if (variants === 0n) continue;
    requiredVariantsPerTrial += variants;
    if (variants > BigInt(PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxVariants)) {
      continue;
    }
    sensitivityEvaluations += variants * BigInt(eligibleOccurrences);
  }
  if (
    eligibleOccurrences > 0 &&
    requiredVariantsPerTrial > BigInt(
      census.generation.binding.runConfig.budget.perturbationSamples
    )
  ) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_PERTURBATION_BUDGET_EXCEEDED",
      "Each null trial must apply the same whole-level perturbation budget as the observed selector pipeline.",
      {
        requiredPerTrial: portableCount(requiredVariantsPerTrial),
        maximum:
          census.generation.binding.runConfig.budget.perturbationSamples
      }
    );
  }
  if (
    sensitivityEvaluations >
      BigInt(normalized.sensitivity.maxSensitivityFunctionalEvaluations)
  ) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_SENSITIVITY_EVALUATION_LIMIT",
      "Complete null-trial sensitivity replay exceeds its aggregate limit.",
      {
        required: portableCount(sensitivityEvaluations),
        maximum:
          normalized.sensitivity.maxSensitivityFunctionalEvaluations
      }
    );
  }
  return {
    eligibleOccurrences,
    requiredBaseFunctionalEvaluations: Number(baseEvaluations),
    requiredSensitivityVariantsPerTrial:
      portableCount(requiredVariantsPerTrial),
    sensitivityEvaluationUpperBound: portableCount(sensitivityEvaluations)
  };
}

function pseudoCensus(census, trialCensuses, trial) {
  return {
    bindingHash: trialCensuses.bindingHash,
    censusHash: trial.trialCensusHash,
    countingDomain: census.countingDomain,
    sourcePopulationHash: trialCensuses.carrierHash,
    generation: census.generation,
    candidateEvaluations: trial.occurrenceEvaluations.map((occurrence) => ({
      memberId: occurrence.occurrenceId,
      filter: occurrence.filter
    }))
  };
}

function constructPartition(loadedPackage, census, trialCensuses, trial, ruleId) {
  const eligible = trial.occurrenceEvaluations.filter(
    (entry) => entry.filter.verdict === "eligible"
  );
  const excludedCandidateIds = {
    predicateRejected: trial.occurrenceEvaluations
      .filter((entry) => entry.filter.verdict === "predicate-rejected")
      .map((entry) => entry.occurrenceId)
      .sort(compareStrings),
    filterIndeterminate: trial.occurrenceEvaluations
      .filter((entry) => entry.filter.verdict === "filter-indeterminate")
      .map((entry) => entry.occurrenceId)
      .sort(compareStrings)
  };
  const eligibleCandidateIds = eligible.map((entry) => entry.occurrenceId)
    .sort(compareStrings);
  let memberPartition = null;
  let status;
  let reason;
  let details;
  if (trial.interpretation.status === "indeterminate") {
    status = "indeterminate";
    reason = "source-census-indeterminate";
    details = { censusReasons: [...trial.interpretation.reasons] };
  } else if (eligible.length === 0) {
    status = "empty";
    reason = "no-eligible-candidates";
    details = {};
  } else {
    memberPartition = constructVerifiedPackageCohortMembers(
      loadedPackage,
      census.generation.binding,
      ruleId,
      eligible.map((entry) => ({
        memberId: entry.occurrenceId,
        candidate: entry.filter.formation.candidate
      }))
    );
    status = memberPartition.status;
    if (status === "indeterminate") {
      reason = memberPartition.reason;
      details = memberPartition.details;
    }
  }
  const rule = memberPartition?.rule ?? loadedPackage.normalized.cohortRules
    .find((entry) => entry.id === ruleId);
  if (rule === undefined) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_COHORT_RULE_MISSING",
      "A null-trial selector references an undeclared cohort rule.",
      { trialId: trial.trialId, cohortRuleId: ruleId }
    );
  }
  const keyEvaluations = memberPartition?.keyEvaluations ?? [];
  const cohorts = memberPartition?.cohorts ?? [];
  const basis = {
    schemaVersion: "1",
    partitioner: PACKAGE_COHORT_PARTITIONER_VERSION,
    scope: PACKAGE_COHORT_PARTITION_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: trialCensuses.bindingHash,
    censusHash: trial.trialCensusHash,
    countingDomain: census.countingDomain,
    sourcePopulationHash: trialCensuses.carrierHash,
    cohortRule: rule,
    status,
    ...(reason === undefined ? {} : { reason, details }),
    excludedCandidateIds,
    eligibleCandidateIds,
    keyEvaluations,
    cohorts,
    counts: {
      evaluatedCandidates: trial.counts.evaluatedOccurrences,
      eligibleCandidates: eligible.length,
      keyResolved: memberPartition?.counts.keyResolved ?? 0,
      keyIndeterminate: memberPartition?.counts.keyIndeterminate ?? 0,
      cohorts: cohorts.length,
      coveredMembers: memberPartition?.counts.coveredMembers ?? 0
    }
  };
  return deepFreeze({
    ...basis,
    partitionHash: hashCanonical(HASH_DOMAINS.PACKAGE_COHORT_PARTITION, basis)
  });
}

function findFunctional(loadedPackage, functionalId) {
  const functional = loadedPackage.normalized.functionals.find(
    (entry) => entry.id === functionalId
  );
  if (functional === undefined) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_FUNCTIONAL_MISSING",
      "A null-trial selector references an undeclared functional.",
      { functionalId }
    );
  }
  return functional;
}

function rankSelector(
  loadedPackage,
  census,
  trialCensuses,
  trial,
  partition,
  selector,
  memberFilters,
  createFunctionalSession,
  normalized
) {
  const functional = findFunctional(loadedPackage, selector.functional);
  let cohortRankings = [];
  let status;
  let reason;
  let details;
  let used = 0;
  if (partition.status === "indeterminate") {
    status = "indeterminate";
    reason = "source-partition-indeterminate";
    details = { partitionReason: partition.reason };
  } else if (partition.status === "empty") {
    status = "empty";
    reason = "no-eligible-candidates";
    details = {};
  } else {
    used = partition.counts.coveredMembers;
    const session = createFunctionalSession(selector.functional);
    cohortRankings = partition.cohorts.map((cohort) => {
      const evaluations = cohort.members.map((occurrenceId) => {
        const filter = memberFilters.get(occurrenceId);
        if (filter === undefined || filter.verdict !== "eligible") {
          fail(
            "PACKAGE_NULL_MODEL_TRIAL_COHORT_MEMBER_MISSING",
            "A null-trial cohort member has no eligible occurrence filter.",
            { trialId: trial.trialId, cohortId: cohort.cohortId, occurrenceId }
          );
        }
        return {
          memberId: occurrenceId,
          evaluation: session.evaluate(filter)
        };
      });
      return rankVerifiedCohortEvaluations(
        cohort,
        evaluations,
        selector,
        functional
      );
    }).sort((left, right) => compareStrings(left.cohortId, right.cohortId));
    const unresolved = cohortRankings.filter(
      (cohort) => cohort.status === "indeterminate"
    );
    if (unresolved.length === 0) {
      status = "ranked";
    } else {
      status = "indeterminate";
      reason = "member-functional-indeterminate";
      details = {
        cohortIds: unresolved.map((cohort) => cohort.cohortId),
        candidateIds: unresolved.flatMap(
          (cohort) => cohort.details.candidateIds
        ).sort(compareStrings)
      };
    }
  }
  const rankedCohorts = cohortRankings.filter(
    (cohort) => cohort.status === "ranked"
  );
  const scoredMembers = cohortRankings.reduce((count, cohort) =>
    count + cohort.members.filter((member) => member.status === "ranked").length,
  0);
  const indeterminateMembers = cohortRankings.reduce((count, cohort) =>
    count + cohort.members.filter(
      (member) => member.status === "indeterminate"
    ).length,
  0);
  const semanticExtrema = rankedCohorts.reduce(
    (count, cohort) => count + cohort.semanticExtrema.length,
    0
  );
  const basis = {
    schemaVersion: "1",
    ranker: PACKAGE_SELECTOR_RANKER_VERSION,
    scope: PACKAGE_SELECTOR_RANKING_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: trialCensuses.bindingHash,
    censusHash: trial.trialCensusHash,
    partitionHash: partition.partitionHash,
    countingDomain: census.countingDomain,
    sourcePopulationHash: trialCensuses.carrierHash,
    selector,
    functionalId: functional.id,
    cohortRuleId: partition.cohortRule.id,
    precisionPolicy: census.generation.binding.runConfig.invariantPrecision,
    rankingPolicy: PACKAGE_SELECTOR_RANKING_POLICY,
    status,
    ...(reason === undefined ? {} : { reason, details }),
    excludedCandidateIds: partition.excludedCandidateIds,
    cohortRankings,
    counts: {
      cohorts: partition.counts.cohorts,
      rankedCohorts: rankedCohorts.length,
      indeterminateCohorts: cohortRankings.length - rankedCohorts.length,
      members: partition.counts.coveredMembers,
      scoredMembers,
      indeterminateMembers,
      semanticExtrema
    },
    variationalSummary: status === "ranked"
      ? 1 - semanticExtrema / partition.counts.coveredMembers
      : null,
    execution: {
      maxFunctionalEvaluations: normalized.maxFunctionalEvaluations,
      usedFunctionalEvaluations: used
    }
  };
  return deepFreeze({
    ...basis,
    rankingHash: hashCanonical(HASH_DOMAINS.PACKAGE_SELECTOR_RANKING, basis)
  });
}

function trialMetricInterpretation(trial, admission) {
  const local = trial.interpretation.status === "valid"
    ? { status: "valid", reasons: [] }
    : trial.interpretation.status === "empty"
      ? { status: "empty", reasons: [...trial.interpretation.reasons] }
      : { status: "indeterminate", reasons: [...trial.interpretation.reasons] };
  const final = admission.status === "complete"
    ? { status: "valid", reasons: [] }
    : admission.status === "empty"
      ? { status: "empty", reasons: [...admission.interpretation.reasons] }
      : {
          status: "indeterminate",
          reasons: [...admission.interpretation.reasons]
        };
  const emptyMetric = (reason) => ({ status: "empty", reasons: [reason] });
  return {
    booleanSelectivity: local,
    variationalSelectivity: Object.fromEntries(admission.selectorCensus.map(
      (entry) => [entry.selectorId, entry.interpretation]
    )),
    selectionRetention: admission.selectionRetention === null
      ? emptyMetric("no-eligible-occurrences")
      : final,
    overallRetention: admission.overallRetention === null
      ? emptyMetric("no-evaluated-occurrences")
      : final,
    indeterminateRatio: admission.indeterminateRatio === null
      ? emptyMetric("no-evaluated-occurrences")
      : final
  };
}

function executeTrial(
  loadedPackage,
  census,
  trialCensuses,
  trial,
  createFunctionalSession,
  normalized
) {
  const pseudo = pseudoCensus(census, trialCensuses, trial);
  const memberFilters = new Map(trial.occurrenceEvaluations.map((entry) => [
    entry.occurrenceId,
    entry.filter
  ]));
  const selectorExecutions = loadedPackage.normalized.selectors.map(
    (selector) => {
      const partition = constructPartition(
        loadedPackage,
        census,
        trialCensuses,
        trial,
        selector.cohortRule
      );
      const ranking = rankSelector(
        loadedPackage,
        census,
        trialCensuses,
        trial,
        partition,
        selector,
        memberFilters,
        createFunctionalSession,
        normalized.ranking
      );
      const sensitivity = evaluateVerifiedPackageSelectorSensitivity(
        loadedPackage,
        pseudo,
        partition,
        ranking,
        normalized.sensitivity,
        (_loadedPackage, _binding, functionalId) =>
          createFunctionalSession(functionalId),
        memberFilters
      );
      return { selectorId: selector.id, partition, ranking, sensitivity };
    }
  );
  const admission = admitVerifiedPackageSelectors(
    loadedPackage,
    pseudo,
    selectorExecutions
  );
  const metrics = {
    booleanSelectivity: trial.booleanSelectivity,
    variationalSelectivity: Object.fromEntries(selectorExecutions.map(
      (entry) => [entry.selectorId, entry.ranking.variationalSummary]
    )),
    selectionRetention: admission.selectionRetention,
    overallRetention: admission.overallRetention,
    indeterminateRatio: admission.indeterminateRatio
  };
  const metricInterpretation = trialMetricInterpretation(trial, admission);
  const basis = {
    trialId: trial.trialId,
    model: trial.model,
    trialCensusHash: trial.trialCensusHash,
    memberIdentity: "trial-occurrence-id-v1",
    selectorExecutions,
    admission,
    selectedOccurrenceIds: [...admission.selectedCandidateIds],
    metrics,
    metricInterpretation,
    counts: {
      evaluatedOccurrences: trial.counts.evaluatedOccurrences,
      predicateRejected: trial.counts.predicateRejected,
      filterIndeterminate: trial.counts.filterIndeterminate,
      eligible: trial.counts.eligible,
      selectorExcluded: admission.counts.selectorExcluded,
      selectionIndeterminate: admission.counts.selectionIndeterminate,
      selected: admission.counts.selectedCandidates,
      finalIndeterminate: admission.counts.finalIndeterminate,
      baseFunctionalEvaluations: selectorExecutions.reduce(
        (total, entry) =>
          total + entry.ranking.execution.usedFunctionalEvaluations,
        0
      ),
      sensitivityFunctionalEvaluations: selectorExecutions.reduce(
        (total, entry) =>
          total + Number(entry.sensitivity.execution.usedFunctionalEvaluations),
        0
      )
    },
    status: admission.status,
    interpretation: admission.interpretation
  };
  return {
    ...basis,
    trialSelectionHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_SELECTION,
      basis
    )
  };
}

function createVerifiedTrialSelections(
  loadedPackage,
  census,
  trialCensuses,
  filterSession,
  normalized
) {
  const preflight = executionPreflight(
    loadedPackage,
    census,
    trialCensuses,
    normalized
  );
  const createFunctionalSession = (functionalId) =>
    createPreparedPackageFunctionalEvaluationSession(
      loadedPackage,
      filterSession,
      functionalId
    );
  const trials = trialCensuses.trials.map((trial) => executeTrial(
    loadedPackage,
    census,
    trialCensuses,
    trial,
    createFunctionalSession,
    normalized
  ));
  const notRun = trialCensuses.status === "not-run";
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_VERSION,
    scope: PACKAGE_NULL_MODEL_TRIAL_SELECTION_SCOPE,
    trialCensusesHash: trialCensuses.trialCensusesHash,
    packageId: trialCensuses.packageId,
    rulesHash: trialCensuses.rulesHash,
    runConfigHash: trialCensuses.runConfigHash,
    bindingHash: trialCensuses.bindingHash,
    censusHash: trialCensuses.censusHash,
    carrierHash: trialCensuses.carrierHash,
    countingDomain: census.countingDomain,
    selectionPolicy: PACKAGE_NULL_MODEL_TRIAL_SELECTION_POLICY,
    selectorOrder: loadedPackage.normalized.selectors.map(
      (selector) => selector.id
    ),
    trials,
    counts: {
      trials: trials.length,
      completeTrials: trials.filter((trial) => trial.status === "complete").length,
      emptyTrials: trials.filter((trial) => trial.status === "empty").length,
      indeterminateTrials: trials.filter(
        (trial) => trial.status === "indeterminate"
      ).length,
      evaluatedOccurrences: trials.reduce(
        (total, trial) => total + trial.counts.evaluatedOccurrences,
        0
      ),
      selectedOccurrences: trials.reduce(
        (total, trial) => total + trial.counts.selected,
        0
      ),
      baseFunctionalEvaluations: trials.reduce(
        (total, trial) => total + trial.counts.baseFunctionalEvaluations,
        0
      ),
      sensitivityFunctionalEvaluations: trials.reduce(
        (total, trial) => total + trial.counts.sensitivityFunctionalEvaluations,
        0
      )
    },
    execution: {
      maxFunctionalEvaluations:
        normalized.ranking.maxFunctionalEvaluations,
      maxSensitivityFunctionalEvaluations:
        normalized.sensitivity.maxSensitivityFunctionalEvaluations,
      preflight
    },
    status: notRun ? "not-run" : "complete",
    interpretation: notRun
      ? { status: "not-run", reasons: ["null-models-disabled"] }
      : {
          status: "trial-selection-complete",
          reasons: ["metric-distributions-and-baseline-interpretation-pending"]
        }
  };
  return deepFreeze({
    ...basis,
    trialSelectionsHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_SELECTIONS,
      basis
    )
  });
}

/** Replays cohorts and selectors for already verified null-trial censuses. */
export function evaluateVerifiedPackageNullModelTrialSelections(
  loadedPackage,
  census,
  trialCensuses,
  filterSession,
  options = {}
) {
  return createVerifiedTrialSelections(
    loadedPackage,
    census,
    trialCensuses,
    filterSession,
    normalizeOptions(options)
  );
}

function verifyArtifact(input, reproduced) {
  let supplied;
  try {
    supplied = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_INVALID",
      "Null-model trial selections are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_MISMATCH",
      "Null-model trial selections differ from deterministic reproduction.",
      {
        expectedTrialSelectionsHash: reproduced.trialSelectionsHash,
        actualTrialSelectionsHash: isObject(supplied) &&
          typeof supplied.trialSelectionsHash === "string"
          ? supplied.trialSelectionsHash
          : null
      }
    );
  }
  return reproduced;
}

export function evaluatePackageNullModelTrialSelections(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  planInput,
  proposalsInput,
  trialCensusesInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectedOptions(normalized.value, ["kernelVersion"])
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    selectedOptions(normalized.value, CANDIDATE_OPTION_FIELDS)
  );
  const trialCensuses = verifyPackageNullModelTrialCensuses(
    trialCensusesInput,
    loadedPackage,
    runConfigInput,
    census,
    planInput,
    proposalsInput,
    selectedOptions(normalized.value, TRIAL_CENSUS_OPTION_FIELDS)
  );
  const filterSession = createPackageCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    selectedOptions(normalized.value, ["kernelVersion"])
  );
  return evaluateVerifiedPackageNullModelTrialSelections(
    loadedPackage,
    census,
    trialCensuses,
    filterSession,
    normalized.value
  );
}

export function evaluatePackageDepthNullModelTrialSelections(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  planInput,
  proposalsInput,
  trialCensusesInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectedOptions(normalized.value, ["kernelVersion"])
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    selectedOptions(normalized.value, CANDIDATE_OPTION_FIELDS)
  );
  const trialCensuses = verifyPackageDepthNullModelTrialCensuses(
    trialCensusesInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    planInput,
    proposalsInput,
    selectedOptions(normalized.value, TRIAL_CENSUS_OPTION_FIELDS)
  );
  const filterSession = createPackageDepthCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    levelClosuresInput,
    selectedOptions(normalized.value, ["kernelVersion"])
  );
  return evaluateVerifiedPackageNullModelTrialSelections(
    loadedPackage,
    census,
    trialCensuses,
    filterSession,
    normalized.value
  );
}

export function verifyPackageNullModelTrialSelections(
  trialSelectionsInput,
  ...inputs
) {
  return verifyArtifact(
    trialSelectionsInput,
    evaluatePackageNullModelTrialSelections(...inputs)
  );
}

export function verifyPackageDepthNullModelTrialSelections(
  trialSelectionsInput,
  ...inputs
) {
  return verifyArtifact(
    trialSelectionsInput,
    evaluatePackageDepthNullModelTrialSelections(...inputs)
  );
}
