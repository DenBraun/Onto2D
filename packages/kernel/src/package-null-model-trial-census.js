import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  verifyPackageCandidateCensus
} from "./package-candidate-census.js";
import {
  createPackageCandidateFilterSession
} from "./package-candidate-filter.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  createPackageDepthCandidateFilterSession
} from "./package-depth-candidate-filter.js";
import {
  verifyPackageDepthNullModelProposals,
  verifyPackageNullModelProposals
} from "./package-null-model-proposals.js";

export const PACKAGE_NULL_MODEL_TRIAL_CENSUSES_VERSION =
  "package-null-model-trial-censuses-v1";
export const PACKAGE_NULL_MODEL_TRIAL_CENSUS_SCOPE =
  "complete-occurrence-local-filter-replay-v1";

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxNullTrials",
  "maxProposalOccurrences",
  "maxProposalOperations"
]);
const CANDIDATE_OPTION_FIELDS = Object.freeze([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "CENSUS_PACKAGE_NULL_MODEL_TRIALS",
    message,
    details
  });
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
      "PACKAGE_NULL_MODEL_TRIAL_CENSUS_OPTIONS_INVALID",
      "Null-model trial-census options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_CENSUS_OPTIONS_INVALID",
      "Null-model trial-census options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_CENSUS_OPTION_UNKNOWN",
      "Unknown null-model trial-census option.",
      { unknown }
    );
  }
  return value;
}

function predicateCensus(plans, occurrenceEvaluations) {
  const rows = new Map(plans.map((plan) => [plan.predicateId, {
    predicateId: plan.predicateId,
    evaluated: 0,
    passed: 0,
    failed: 0,
    indeterminate: 0,
    exclusivelyRejected: 0
  }]));
  for (const occurrence of occurrenceEvaluations) {
    const failed = occurrence.filter.failedPredicates;
    for (const entry of occurrence.filter.predicateEvaluations) {
      const row = rows.get(entry.predicateId);
      if (row === undefined) {
        fail(
          "PACKAGE_NULL_MODEL_TRIAL_PREDICATE_UNKNOWN",
          "A null-model filter contains an unknown predicate.",
          {
            occurrenceId: occurrence.occurrenceId,
            predicateId: entry.predicateId
          }
        );
      }
      row.evaluated += 1;
      if (entry.evaluation.outcome === "pass") row.passed += 1;
      else if (entry.evaluation.outcome === "fail") row.failed += 1;
      else if (entry.evaluation.outcome === "indeterminate") {
        row.indeterminate += 1;
      } else {
        fail(
          "PACKAGE_NULL_MODEL_TRIAL_PREDICATE_OUTCOME_INVALID",
          "A null-model filter contains an unknown predicate outcome.",
          {
            occurrenceId: occurrence.occurrenceId,
            predicateId: entry.predicateId,
            outcome: entry.evaluation.outcome
          }
        );
      }
    }
    if (failed.length === 1) rows.get(failed[0]).exclusivelyRejected += 1;
  }
  return [...rows.values()].map((row) => ({
    ...row,
    inert: row.failed === 0,
    dominating: row.evaluated > 0 && row.failed / row.evaluated >= 0.9
  }));
}

function occurrenceEvaluation(trial, occurrence, session) {
  const filter = session.evaluate(occurrence.candidate);
  if (filter.formation.candidate.id !== occurrence.candidateId) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_CANDIDATE_MISMATCH",
      "A refiltered null-model occurrence changed canonical identity.",
      {
        trialId: trial.trialId,
        occurrenceIndex: occurrence.occurrenceIndex,
        expectedCandidateId: occurrence.candidateId,
        actualCandidateId: filter.formation.candidate.id
      }
    );
  }
  const identity = {
    trialId: trial.trialId,
    occurrenceIndex: occurrence.occurrenceIndex,
    sourceCandidateId: occurrence.sourceCandidateId,
    candidateId: occurrence.candidateId
  };
  return {
    ...identity,
    occurrenceId: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_OCCURRENCE,
      identity
    ),
    filter
  };
}

function trialCensus(trial, session, plans, threshold) {
  const occurrenceEvaluations = trial.occurrences.map((occurrence) =>
    occurrenceEvaluation(trial, occurrence, session));
  const count = (verdict) => occurrenceEvaluations.filter(
    (entry) => entry.filter.verdict === verdict
  ).length;
  const evaluatedCandidates = occurrenceEvaluations.length;
  const counts = {
    evaluatedOccurrences: evaluatedCandidates,
    predicateRejected: count("predicate-rejected"),
    filterIndeterminate: count("filter-indeterminate"),
    eligible: count("eligible")
  };
  if (
    evaluatedCandidates !==
      counts.predicateRejected + counts.filterIndeterminate + counts.eligible
  ) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_COUNT_MISMATCH",
      "Null-model trial verdict counts do not reconcile.",
      { trialId: trial.trialId, ...counts }
    );
  }
  const booleanSelectivity = evaluatedCandidates === 0
    ? null
    : counts.eligible / evaluatedCandidates;
  const indeterminateRatio = evaluatedCandidates === 0
    ? null
    : counts.filterIndeterminate / evaluatedCandidates;
  const interpretation = evaluatedCandidates === 0
    ? { status: "empty", reasons: ["no-evaluated-occurrences"] }
    : indeterminateRatio > threshold
      ? {
          status: "indeterminate",
          reasons: ["indeterminate-ratio-exceeds-threshold"]
        }
      : { status: "valid", reasons: [] };
  const basis = {
    trialId: trial.trialId,
    model: trial.model,
    trialProposalHash: trial.trialProposalHash,
    occurrenceEvaluations,
    counts,
    booleanSelectivity,
    indeterminateRatio,
    interpretation,
    predicateCensus: predicateCensus(plans, occurrenceEvaluations)
  };
  return {
    ...basis,
    trialCensusHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_CENSUS,
      basis
    )
  };
}

function createVerifiedTrialCensuses(loadedPackage, census, proposals, session) {
  const trials = proposals.trials.map((trial) => trialCensus(
    trial,
    session,
    loadedPackage.predicatePlans,
    census.generation.binding.runConfig.indeterminateThreshold
  ));
  const notRun = proposals.status === "not-run";
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_NULL_MODEL_TRIAL_CENSUSES_VERSION,
    scope: PACKAGE_NULL_MODEL_TRIAL_CENSUS_SCOPE,
    proposalsHash: proposals.proposalsHash,
    packageId: proposals.packageId,
    rulesHash: proposals.rulesHash,
    runConfigHash: proposals.runConfigHash,
    bindingHash: proposals.bindingHash,
    censusHash: proposals.censusHash,
    carrierHash: proposals.carrierHash,
    indeterminateThreshold:
      census.generation.binding.runConfig.indeterminateThreshold,
    trials,
    counts: {
      trials: trials.length,
      evaluatedOccurrences: trials.reduce(
        (total, trial) => total + trial.counts.evaluatedOccurrences,
        0
      ),
      predicateRejected: trials.reduce(
        (total, trial) => total + trial.counts.predicateRejected,
        0
      ),
      filterIndeterminate: trials.reduce(
        (total, trial) => total + trial.counts.filterIndeterminate,
        0
      ),
      eligible: trials.reduce(
        (total, trial) => total + trial.counts.eligible,
        0
      ),
      validTrials: trials.filter(
        (trial) => trial.interpretation.status === "valid"
      ).length,
      emptyTrials: trials.filter(
        (trial) => trial.interpretation.status === "empty"
      ).length,
      indeterminateTrials: trials.filter(
        (trial) => trial.interpretation.status === "indeterminate"
      ).length
    },
    status: notRun ? "not-run" : "complete",
    interpretation: notRun
      ? { status: "not-run", reasons: ["null-models-disabled"] }
      : {
          status: "local-census-complete",
          reasons: ["cohorts-functionals-selectors-and-distributions-pending"]
        }
  };
  return deepFreeze({
    ...basis,
    trialCensusesHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_CENSUSES,
      basis
    )
  });
}

/** Replays local filtering for proposals on an already verified carrier. */
export function evaluateVerifiedPackageNullModelTrialCensuses(
  loadedPackage,
  census,
  proposals,
  session
) {
  return createVerifiedTrialCensuses(
    loadedPackage,
    census,
    proposals,
    session
  );
}

function verifyArtifact(input, reproduced) {
  let supplied;
  try {
    supplied = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_CENSUSES_INVALID",
      "Null-model trial censuses are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NULL_MODEL_TRIAL_CENSUSES_MISMATCH",
      "Null-model trial censuses differ from deterministic reproduction.",
      {
        expectedTrialCensusesHash: reproduced.trialCensusesHash,
        actualTrialCensusesHash: isObject(supplied) &&
          typeof supplied.trialCensusesHash === "string"
          ? supplied.trialCensusesHash
          : null
      }
    );
  }
  return reproduced;
}

export function evaluatePackageNullModelTrialCensuses(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  planInput,
  proposalsInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectedOptions(normalized, ["kernelVersion"])
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    selectedOptions(normalized, CANDIDATE_OPTION_FIELDS)
  );
  const proposals = verifyPackageNullModelProposals(
    proposalsInput,
    loadedPackage,
    runConfigInput,
    census,
    planInput,
    normalized
  );
  const session = createPackageCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    selectedOptions(normalized, ["kernelVersion"])
  );
  return evaluateVerifiedPackageNullModelTrialCensuses(
    loadedPackage,
    census,
    proposals,
    session
  );
}

export function evaluatePackageDepthNullModelTrialCensuses(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  planInput,
  proposalsInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectedOptions(normalized, ["kernelVersion"])
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    selectedOptions(normalized, CANDIDATE_OPTION_FIELDS)
  );
  const proposals = verifyPackageDepthNullModelProposals(
    proposalsInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    planInput,
    normalized
  );
  const session = createPackageDepthCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    levelClosuresInput,
    selectedOptions(normalized, ["kernelVersion"])
  );
  return evaluateVerifiedPackageNullModelTrialCensuses(
    loadedPackage,
    census,
    proposals,
    session
  );
}

export function verifyPackageNullModelTrialCensuses(
  trialCensusesInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  planInput,
  proposalsInput,
  options = {}
) {
  return verifyArtifact(
    trialCensusesInput,
    evaluatePackageNullModelTrialCensuses(
      loadedPackageInput,
      runConfigInput,
      censusInput,
      planInput,
      proposalsInput,
      options
    )
  );
}

export function verifyPackageDepthNullModelTrialCensuses(
  trialCensusesInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  planInput,
  proposalsInput,
  options = {}
) {
  return verifyArtifact(
    trialCensusesInput,
    evaluatePackageDepthNullModelTrialCensuses(
      loadedPackageInput,
      runConfigInput,
      levelClosuresInput,
      targetDepth,
      censusInput,
      planInput,
      proposalsInput,
      options
    )
  );
}
