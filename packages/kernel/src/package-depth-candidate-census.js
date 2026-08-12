import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  enumeratePackageDepthCandidates
} from "./package-depth-candidate-generator.js";
import {
  createPackageDepthCandidateFilterSession
} from "./package-depth-candidate-filter.js";

export const PACKAGE_DEPTH_CANDIDATE_CENSUS_EVALUATOR_VERSION =
  "package-depth-candidate-census-evaluator-v1";
export const PACKAGE_DEPTH_CANDIDATE_CENSUS_SCOPE =
  "complete-depth-aware-local-filter-census-v1";
export const PACKAGE_DEPTH_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD = 0.9;

const PREDICATE_OUTCOMES = new Set(["pass", "fail", "indeterminate"]);
const OUTCOME_COUNT_FIELDS = Object.freeze({
  pass: "passed",
  fail: "failed",
  indeterminate: "indeterminate"
});

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "CENSUS_PACKAGE_DEPTH_CANDIDATES",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function countVerdicts(candidateEvaluations) {
  const count = (verdict) => candidateEvaluations
    .filter((entry) => entry.verdict === verdict).length;
  return {
    evaluatedCandidates: candidateEvaluations.length,
    predicateRejected: count("predicate-rejected"),
    filterIndeterminate: count("filter-indeterminate"),
    eligibleCandidates: count("eligible")
  };
}

function predicateCensus(plans, candidateEvaluations) {
  const accumulators = new Map(plans.map((plan) => [plan.predicateId, {
    evaluated: 0,
    passed: 0,
    failed: 0,
    indeterminate: 0,
    exclusivelyRejected: 0
  }]));
  for (const candidate of candidateEvaluations) {
    const candidateId = candidate.formation.candidate.id;
    const seen = new Set();
    for (const entry of candidate.predicateEvaluations) {
      const counts = accumulators.get(entry.predicateId);
      if (
        counts === undefined ||
        seen.has(entry.predicateId) ||
        !PREDICATE_OUTCOMES.has(entry.evaluation.outcome)
      ) {
        fail(
          "PACKAGE_DEPTH_CANDIDATE_CENSUS_PREDICATE_MISMATCH",
          "A depth-candidate filter has an unknown or duplicate predicate outcome.",
          {
            candidateId,
            predicateId: entry.predicateId,
            outcome: entry.evaluation.outcome
          }
        );
      }
      seen.add(entry.predicateId);
      counts.evaluated += 1;
      counts[OUTCOME_COUNT_FIELDS[entry.evaluation.outcome]] += 1;
    }
    if (seen.size !== plans.length) {
      fail(
        "PACKAGE_DEPTH_CANDIDATE_CENSUS_PREDICATE_MISMATCH",
        "A depth-candidate filter does not cover every package predicate.",
        {
          candidateId,
          missingPredicateIds: plans
            .map((plan) => plan.predicateId)
            .filter((predicateId) => !seen.has(predicateId))
        }
      );
    }
    if (candidate.failedPredicates.length === 1) {
      const counts = accumulators.get(candidate.failedPredicates[0]);
      if (counts === undefined) {
        fail(
          "PACKAGE_DEPTH_CANDIDATE_CENSUS_PREDICATE_MISMATCH",
          "A depth-candidate filter references an unknown failed predicate."
        );
      }
      counts.exclusivelyRejected += 1;
    }
  }
  return plans
    .map((plan) => {
      const counts = accumulators.get(plan.predicateId);
      const { evaluated, passed, failed, indeterminate } = counts;
      if (evaluated !== passed + failed + indeterminate) {
        fail(
          "PACKAGE_DEPTH_CANDIDATE_CENSUS_PREDICATE_COUNT_MISMATCH",
          "Per-predicate depth census counts do not reconcile.",
          { predicateId: plan.predicateId }
        );
      }
      return {
        predicateId: plan.predicateId,
        ...counts,
        inert: failed === 0,
        dominating: evaluated > 0 &&
          failed / evaluated >=
            PACKAGE_DEPTH_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD
      };
    })
    .sort((left, right) => compareStrings(left.predicateId, right.predicateId));
}

/** Enumerates and locally filters every candidate at target depth 1 or 2. */
export function evaluatePackageDepthCandidateCensus(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  options = {}
) {
  const generation = enumeratePackageDepthCandidates(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    options
  );
  if (
    generation.enumeration.status !== "complete" ||
    generation.enumeration.interpretable !== true ||
    generation.enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_CENSUS_ENUMERATION_INCOMPLETE",
      "A depth census requires a complete depth-aware candidate enumeration.",
      {
        status: generation.enumeration.status,
        storeStatus: generation.enumeration.candidateStore.status,
        exhausted: generation.enumeration.budget.exhausted
      }
    );
  }
  const safeLoadedPackage = canonicalClone(loadedPackageInput);
  const safeLevels = canonicalClone(levelClosuresInput);
  const safeOptions = canonicalClone(options);
  const filterOptions = safeOptions.kernelVersion === undefined
    ? {}
    : { kernelVersion: safeOptions.kernelVersion };
  const session = createPackageDepthCandidateFilterSession(
    safeLoadedPackage,
    generation.binding,
    safeLevels,
    filterOptions
  );
  const records = [...generation.enumeration.candidateStore.candidates]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId));
  const candidateEvaluations = records.map((record) =>
    session.evaluate(record.candidate));
  candidateEvaluations.forEach((evaluation, index) => {
    if (evaluation.formation.candidate.id !== records[index].candidateId) {
      fail(
        "PACKAGE_DEPTH_CANDIDATE_CENSUS_CANDIDATE_MISMATCH",
        "A filtered depth candidate differs from the enumerated identity.",
        {
          expectedCandidateId: records[index].candidateId,
          actualCandidateId: evaluation.formation.candidate.id
        }
      );
    }
  });

  const verdictCounts = countVerdicts(candidateEvaluations);
  if (
    verdictCounts.evaluatedCandidates !==
      verdictCounts.predicateRejected +
      verdictCounts.filterIndeterminate +
      verdictCounts.eligibleCandidates ||
    verdictCounts.evaluatedCandidates !==
      generation.enumeration.counts.canonicalCandidates
  ) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_CENSUS_COUNT_MISMATCH",
      "Depth census counts do not reconcile with the canonical universe.",
      {
        canonicalCandidates: generation.enumeration.counts.canonicalCandidates,
        ...verdictCounts
      }
    );
  }
  const evaluated = verdictCounts.evaluatedCandidates;
  const booleanSelectivity = evaluated === 0
    ? null
    : verdictCounts.eligibleCandidates / evaluated;
  const indeterminateRatio = evaluated === 0
    ? null
    : verdictCounts.filterIndeterminate / evaluated;
  const indeterminateThreshold = generation.binding.runConfig.indeterminateThreshold;
  const interpretation = evaluated === 0
    ? { status: "empty", reasons: ["no-evaluated-candidates"] }
    : indeterminateRatio > indeterminateThreshold
      ? {
          status: "indeterminate",
          reasons: ["indeterminate-ratio-exceeds-threshold"]
        }
      : { status: "valid", reasons: [] };
  const census = predicateCensus(
    safeLoadedPackage.predicatePlans,
    candidateEvaluations
  );
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_DEPTH_CANDIDATE_CENSUS_EVALUATOR_VERSION,
    scope: PACKAGE_DEPTH_CANDIDATE_CENSUS_SCOPE,
    packageId: safeLoadedPackage.packageId,
    rulesHash: safeLoadedPackage.semanticManifest.rulesHash,
    bindingHash: generation.binding.bindingHash,
    countingDomain: generation.binding.runConfig.countingDomain,
    targetDepth,
    sourcePopulationHash: generation.binding.sourcePopulation.selectionHash,
    dominanceThreshold: PACKAGE_DEPTH_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD,
    indeterminateThreshold,
    generation,
    candidateEvaluations,
    counts: {
      generatedBeforeCanonicalization:
        generation.enumeration.counts.generatedCandidates,
      canonicalCandidates: generation.enumeration.counts.canonicalCandidates,
      ...verdictCounts
    },
    booleanSelectivity,
    indeterminateRatio,
    interpretation,
    census
  };
  return deepFreeze({
    ...basis,
    censusHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_CENSUS,
      basis
    )
  });
}

/** Reproduces a complete depth-aware census exactly. */
export function verifyPackageDepthCandidateCensus(
  censusInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(censusInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_CANDIDATE_CENSUS_INVALID",
      "Depth census artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = evaluatePackageDepthCandidateCensus(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DEPTH_CANDIDATE_CENSUS_MISMATCH",
      "Depth census differs from deterministic reproduction.",
      {
        expectedCensusHash: reproduced.censusHash,
        actualCensusHash:
          supplied !== null &&
          typeof supplied === "object" &&
          typeof supplied.censusHash === "string"
            ? supplied.censusHash
            : null
      }
    );
  }
  return reproduced;
}
