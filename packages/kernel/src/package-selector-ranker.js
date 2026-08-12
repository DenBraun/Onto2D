import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  addDecimals,
  decimalToNumber,
  multiplyDecimals,
  parseDecimal,
  subtractDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCohortPartition } from "./package-cohort-partitioner.js";
import {
  createPackageFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import { normalizeQuantity } from "./quantity.js";

export const PACKAGE_SELECTOR_RANKER_VERSION = "package-selector-ranker-v1";
export const PACKAGE_SELECTOR_RANKING_SCOPE = "complete-cohort-ranking-v1";
export const PACKAGE_SELECTOR_RANKING_LIMITS = deepFreeze({
  maxFunctionalEvaluations: 1_000_000
});
export const PACKAGE_SELECTOR_RANKING_POLICY = deepFreeze({
  scoreOrder: "objective-rounded-score-then-candidate-id-v1",
  denseEquivalence: "transitive-overlapping-score-interval-components-v1",
  semanticExtrema: "epsilon-boundary-maximum-effective-tolerance-v1",
  gap: "objective-oriented-first-two-member-scores-v1",
  indeterminate: "retain-all-members-null-cohort-metrics-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "RANK_PACKAGE_SELECTOR",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDecimals(left, right) {
  const difference = subtractDecimals(left, right);
  const coefficient = BigInt(difference.coefficient);
  return coefficient < 0n ? -1 : coefficient > 0n ? 1 : 0;
}

function decimalAbsolute(value) {
  const parsed = parseDecimal(value);
  return BigInt(parsed.coefficient) < 0n ? multiplyDecimals(parsed, -1) : parsed;
}

function decimalMaximum(...values) {
  return values.reduce((maximum, value) =>
    compareDecimals(maximum, value) >= 0 ? maximum : value
  );
}

function quantityToleranceBound(quantity) {
  const absolute = parseDecimal(quantity.tolerance.absolute ?? 0);
  const relative = multiplyDecimals(
    parseDecimal(quantity.tolerance.relative ?? 0),
    decimalAbsolute(quantity.value)
  );
  return decimalMaximum(absolute, relative);
}

function nextPositiveBinary64(value) {
  if (value === 0) return Number.MIN_VALUE;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false);
  return view.getFloat64(0, false);
}

function outwardDecimalToNumber(value, label) {
  let converted;
  try {
    converted = decimalToNumber(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    if (error.code === "DECIMAL_NUMBER_UNDERFLOW") return Number.MIN_VALUE;
    if (error.code !== "DECIMAL_NUMBER_OVERFLOW") throw error;
    fail(
      "PACKAGE_SELECTOR_QUANTITY_OVERFLOW",
      "A selector-derived Quantity cannot be represented as finite binary64.",
      { label, value: parseDecimal(value).canonical }
    );
  }
  const difference = subtractDecimals(parseDecimal(converted), value);
  if (BigInt(difference.coefficient) >= 0n) return converted;
  const outward = nextPositiveBinary64(converted);
  if (!Number.isFinite(outward)) {
    fail(
      "PACKAGE_SELECTOR_QUANTITY_OVERFLOW",
      "A selector-derived Quantity cannot be represented as finite binary64.",
      { label, value: parseDecimal(value).canonical }
    );
  }
  return outward;
}

export function normalizePackageSelectorRankingOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_OPTIONS_INVALID",
      "Package selector ranking options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_SELECTOR_OPTIONS_INVALID",
      "Package selector ranking options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_SELECTOR_OPTION_UNKNOWN",
      "Unknown package selector ranking option.",
      { unknown }
    );
  }
  if (
    value.kernelVersion !== undefined &&
    (
      typeof value.kernelVersion !== "string" ||
      value.kernelVersion.length === 0 ||
      value.kernelVersion !== value.kernelVersion.trim()
    )
  ) {
    fail(
      "PACKAGE_SELECTOR_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a normalized non-empty string.",
      { value: value.kernelVersion }
    );
  }
  const maximum = value.maxFunctionalEvaluations ??
    PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    maximum > PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations
  ) {
    fail(
      "PACKAGE_SELECTOR_EVALUATION_LIMIT_INVALID",
      "Functional evaluation limit must be a positive safe integer within the supported maximum.",
      {
        value: maximum,
        maximum: PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations
      }
    );
  }
  return { ...value, maxFunctionalEvaluations: maximum };
}

function verificationOptions(options) {
  const result = {};
  for (const field of [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates"
  ]) {
    if (options[field] !== undefined) result[field] = options[field];
  }
  return result;
}

function functionalOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function findSelector(loadedPackage, selectorId) {
  if (
    typeof selectorId !== "string" ||
    selectorId.length === 0 ||
    selectorId !== selectorId.trim()
  ) {
    fail(
      "PACKAGE_SELECTOR_ID_INVALID",
      "Selector identifier must be a normalized non-empty string.",
      { selectorId }
    );
  }
  const selector = loadedPackage.normalized.selectors
    .find((entry) => entry.id === selectorId);
  if (selector === undefined) {
    fail(
      "PACKAGE_SELECTOR_NOT_FOUND",
      "Selector identifier is not declared by the loaded package.",
      { selectorId }
    );
  }
  return selector;
}

function findFunctional(loadedPackage, functionalId) {
  const functional = loadedPackage.normalized.functionals
    .find((entry) => entry.id === functionalId);
  if (functional === undefined) {
    fail(
      "PACKAGE_SELECTOR_FUNCTIONAL_NOT_FOUND",
      "Selector functional is not declared by the loaded package.",
      { functionalId }
    );
  }
  return functional;
}

function normalizedMemberEvaluation(input) {
  if (
    isObject(input) &&
    typeof input.candidateId === "string" &&
    isObject(input.evaluation)
  ) {
    return input;
  }
  if (
    isObject(input) &&
    typeof input.memberId === "string" &&
    isObject(input.evaluation)
  ) {
    return { candidateId: input.memberId, evaluation: input.evaluation };
  }
  return { candidateId: input.candidateId, evaluation: input };
}

function scoredRecord(input) {
  const { candidateId, evaluation } = normalizedMemberEvaluation(input);
  const center = evaluation.diagnostic.rounded;
  const tolerance = evaluation.diagnostic.effectiveAbsoluteTolerance;
  return {
    candidateId,
    evaluation,
    center,
    tolerance,
    lower: subtractDecimals(center, tolerance),
    upper: addDecimals(center, tolerance)
  };
}

function objectiveComparator(objective) {
  return (left, right) => {
    const scoreOrder = compareDecimals(left.center, right.center);
    if (scoreOrder !== 0) return objective === "min" ? scoreOrder : -scoreOrder;
    return compareStrings(left.candidateId, right.candidateId);
  };
}

function denseRanks(records, objective) {
  const byLower = [...records].sort((left, right) => {
    const lowerOrder = compareDecimals(left.lower, right.lower);
    if (lowerOrder !== 0) return lowerOrder;
    const upperOrder = compareDecimals(left.upper, right.upper);
    if (upperOrder !== 0) return upperOrder;
    return compareStrings(left.candidateId, right.candidateId);
  });
  const components = [];
  for (const record of byLower) {
    const current = components.at(-1);
    if (current === undefined || compareDecimals(record.lower, current.upper) > 0) {
      components.push({ upper: record.upper, members: [record] });
      continue;
    }
    current.members.push(record);
    if (compareDecimals(record.upper, current.upper) > 0) current.upper = record.upper;
  }
  const compareObjective = objectiveComparator(objective);
  components.sort((left, right) => compareObjective(
    [...left.members].sort(compareObjective)[0],
    [...right.members].sort(compareObjective)[0]
  ));
  const ranks = new Map();
  components.forEach((component, index) => {
    for (const record of component.members) ranks.set(record.candidateId, index + 1);
  });
  return ranks;
}

function semanticExtrema(records, selector) {
  if (records.length === 0) return [];
  const optimum = records[0];
  const epsilonValue = parseDecimal(selector.epsilon.value);
  const epsilonTolerance = quantityToleranceBound(selector.epsilon);
  return records.filter((record) => {
    const difference = selector.objective === "min"
      ? subtractDecimals(record.center, optimum.center)
      : subtractDecimals(optimum.center, record.center);
    const comparisonTolerance = decimalMaximum(
      record.tolerance,
      optimum.tolerance,
      epsilonTolerance
    );
    const boundary = addDecimals(epsilonValue, comparisonTolerance);
    return compareDecimals(difference, boundary) <= 0;
  }).map((record) => record.candidateId).sort(compareStrings);
}

function evidenceUnion(records) {
  return [...new Set(records.flatMap(
    (record) => record.evaluation.score.provenance.evidence
  ))].sort(compareStrings);
}

function gapQuantity(records, selector, functional) {
  if (records.length < 2) return null;
  const first = records[0];
  const second = records[1];
  const difference = selector.objective === "min"
    ? subtractDecimals(second.center, first.center)
    : subtractDecimals(first.center, second.center);
  const tolerance = addDecimals(first.tolerance, second.tolerance);
  return normalizeQuantity({
    value: decimalToNumber(difference),
    unit: functional.result.unit,
    tolerance: {
      absolute: outwardDecimalToNumber(tolerance, "gapTolerance")
    },
    semantic: functional.result.semantic,
    provenance: {
      kind: "computed",
      method: "selector-ranking-gap-v1",
      evidence: evidenceUnion([first, second])
    }
  });
}

export function rankVerifiedCohortEvaluations(
  cohort,
  evaluations,
  selector,
  functional
) {
  const normalizedEvaluations = evaluations.map(normalizedMemberEvaluation);
  const scored = normalizedEvaluations
    .filter(({ evaluation }) => evaluation.status === "scored")
    .map(scoredRecord)
    .sort(objectiveComparator(selector.objective));
  const indeterminate = normalizedEvaluations
    .filter(({ evaluation }) => evaluation.status === "indeterminate")
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId));
  const ranks = denseRanks(scored, selector.objective);
  const complete = indeterminate.length === 0;
  const extrema = complete ? semanticExtrema(scored, selector) : [];
  const extremumSet = new Set(extrema);
  const scoredMembers = scored.map((record) => ({
    candidateId: record.candidateId,
    status: "ranked",
    evaluation: record.evaluation,
    rank: ranks.get(record.candidateId),
    semanticExtremum: complete ? extremumSet.has(record.candidateId) : null
  }));
  const indeterminateMembers = indeterminate.map((entry) => ({
    candidateId: entry.candidateId,
    status: "indeterminate",
    evaluation: entry.evaluation,
    rank: null,
    semanticExtremum: null
  }));
  const members = [...scoredMembers, ...indeterminateMembers];
  if (!complete) {
    return {
      cohortId: cohort.cohortId,
      key: cohort.key,
      memberIds: [...cohort.members],
      status: "indeterminate",
      reason: "member-functional-indeterminate",
      details: {
        candidateIds: indeterminate.map((entry) => entry.candidateId)
      },
      members,
      optimum: null,
      presentationLeader: null,
      semanticExtrema: [],
      epsilon: selector.epsilon,
      degeneracy: null,
      degeneracyRatio: null,
      variationalSelectivity: null,
      gap: null
    };
  }
  const degeneracy = extrema.length;
  const degeneracyRatio = degeneracy / cohort.members.length;
  return {
    cohortId: cohort.cohortId,
    key: cohort.key,
    memberIds: [...cohort.members],
    status: "ranked",
    members,
    optimum: scored[0].evaluation.score,
    presentationLeader: scored[0].candidateId,
    semanticExtrema: extrema,
    epsilon: selector.epsilon,
    degeneracy,
    degeneracyRatio,
    variationalSelectivity: 1 - degeneracyRatio,
    gap: gapQuantity(scored, selector, functional)
  };
}

function candidateFilterIndex(census) {
  return new Map(census.candidateEvaluations.map((evaluation) => [
    evaluation.formation.candidate.id,
    evaluation
  ]));
}

function ensureEvaluationCapacity(partition, maximum) {
  const required = partition.status === "complete"
    ? partition.counts.coveredMembers
    : 0;
  if (required > maximum) {
    fail(
      "PACKAGE_SELECTOR_EVALUATION_LIMIT",
      "Complete selector ranking exceeds the functional evaluation limit.",
      { required, maximum }
    );
  }
  return required;
}

/**
 * Evaluates the selector functional for every member of an independently
 * reproduced complete cohort partition and emits dense rankings plus complete
 * epsilon extrema.
 */
export function rankVerifiedPackageSelector(
  loadedPackage,
  census,
  partition,
  selectorId,
  normalized,
  createFunctionalSession
) {
  const selector = findSelector(loadedPackage, selectorId);
  const functional = findFunctional(loadedPackage, selector.functional);
  if (partition.cohortRule.id !== selector.cohortRule) {
    fail(
      "PACKAGE_SELECTOR_COHORT_RULE_MISMATCH",
      "Selector ranking requires the selector's declared cohort partition.",
      {
        selectorId: selector.id,
        expectedCohortRuleId: selector.cohortRule,
        actualCohortRuleId: partition.cohortRule.id
      }
    );
  }
  const used = ensureEvaluationCapacity(
    partition,
    normalized.maxFunctionalEvaluations
  );
  let cohortRankings = [];
  let status;
  let reason;
  let details;

  if (partition.status === "indeterminate") {
    status = "indeterminate";
    reason = "source-partition-indeterminate";
    details = {
      partitionReason: partition.reason
    };
  } else if (partition.status === "empty") {
    status = "empty";
    reason = "no-eligible-candidates";
    details = {};
  } else {
    const filters = candidateFilterIndex(census);
    const session = createFunctionalSession(
      loadedPackage,
      census.generation.binding,
      selector.functional,
      functionalOptions(normalized)
    );
    cohortRankings = partition.cohorts.map((cohort) => {
      const evaluations = cohort.members.map((candidateId) => {
        const filter = filters.get(candidateId);
        if (filter === undefined || filter.verdict !== "eligible") {
          fail(
            "PACKAGE_SELECTOR_COHORT_MEMBER_MISSING",
            "A reproduced cohort member has no eligible census filter.",
            { cohortId: cohort.cohortId, candidateId }
          );
        }
        return session.evaluate(filter);
      });
      return rankVerifiedCohortEvaluations(
        cohort,
        evaluations,
        selector,
        functional
      );
    }).sort((left, right) => compareStrings(left.cohortId, right.cohortId));
    const unresolved = cohortRankings
      .filter((cohort) => cohort.status === "indeterminate");
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

  const rankedCohorts = cohortRankings
    .filter((cohort) => cohort.status === "ranked");
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
  const variationalSummary = status === "ranked"
    ? 1 - semanticExtrema / partition.counts.coveredMembers
    : null;
  const basis = {
    schemaVersion: "1",
    ranker: PACKAGE_SELECTOR_RANKER_VERSION,
    scope: PACKAGE_SELECTOR_RANKING_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: partition.bindingHash,
    censusHash: partition.censusHash,
    partitionHash: partition.partitionHash,
    countingDomain: partition.countingDomain,
    sourcePopulationHash: partition.sourcePopulationHash,
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
    variationalSummary,
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

/**
 * Evaluates the selector functional for every member of an independently
 * reproduced primitive-source cohort partition.
 */
export function rankPackageSelector(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  partitionInput,
  selectorId,
  options = {}
) {
  const normalized = normalizePackageSelectorRankingOptions(options);
  const sharedOptions = verificationOptions(normalized);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    functionalOptions(normalized)
  );
  const partition = verifyPackageCohortPartition(
    partitionInput,
    loadedPackage,
    runConfigInput,
    censusInput,
    sharedOptions
  );
  const census = canonicalClone(censusInput);
  return rankVerifiedPackageSelector(
    loadedPackage,
    census,
    partition,
    selectorId,
    normalized,
    createPackageFunctionalEvaluationSession
  );
}

/** Verifies a ranking after its package, census, and partition were replayed. */
export function verifyVerifiedPackageSelectorRanking(
  rankingInput,
  loadedPackage,
  census,
  partition,
  normalized,
  createFunctionalSession
) {
  let supplied;
  try {
    supplied = canonicalClone(rankingInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_RANKING_ARTIFACT_INVALID",
      "Package selector ranking is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(supplied) || !isObject(supplied.selector)) {
    fail(
      "PACKAGE_SELECTOR_RANKING_ARTIFACT_INVALID",
      "Package selector ranking does not identify its selector."
    );
  }
  const reproduced = rankVerifiedPackageSelector(
    loadedPackage,
    census,
    partition,
    supplied.selector.id,
    normalized,
    createFunctionalSession
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_SELECTOR_RANKING_MISMATCH",
      "Package selector ranking differs from deterministic reproduction.",
      {
        expectedRankingHash: reproduced.rankingHash,
        actualRankingHash:
          typeof supplied.rankingHash === "string"
            ? supplied.rankingHash
            : null
      }
    );
  }
  return reproduced;
}

/**
 * Accepts a serialized selector ranking only after exact deterministic replay
 * from independently supplied package/run/census/partition inputs.
 */
export function verifyPackageSelectorRanking(
  rankingInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  partitionInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(rankingInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_RANKING_ARTIFACT_INVALID",
      "Package selector ranking is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(supplied) || !isObject(supplied.selector)) {
    fail(
      "PACKAGE_SELECTOR_RANKING_ARTIFACT_INVALID",
      "Package selector ranking does not identify its selector."
    );
  }
  const reproduced = rankPackageSelector(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    partitionInput,
    supplied.selector.id,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_SELECTOR_RANKING_MISMATCH",
      "Package selector ranking differs from deterministic reproduction.",
      {
        expectedRankingHash: reproduced.rankingHash,
        actualRankingHash:
          typeof supplied.rankingHash === "string"
            ? supplied.rankingHash
            : null
      }
    );
  }
  return reproduced;
}
