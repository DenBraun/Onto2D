import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  decimalToNumber,
  multiplyDecimals,
  parseDecimal,
  subtractDecimals,
  addDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  createPackageFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import {
  rankVerifiedCohortEvaluations,
  verifyPackageSelectorRanking
} from "./package-selector-ranker.js";
import { normalizeQuantity } from "./quantity.js";

export const PACKAGE_SELECTOR_SENSITIVITY_EVALUATOR_VERSION =
  "package-selector-sensitivity-evaluator-v1";
export const PACKAGE_SELECTOR_SENSITIVITY_SCOPE =
  "complete-required-perturbation-sweep-v1";
export const PACKAGE_SELECTOR_SENSITIVITY_LIMITS = deepFreeze({
  maxVariants: 1_000_000,
  maxSensitivityFunctionalEvaluations: 1_000_000
});
export const PACKAGE_SELECTOR_SENSITIVITY_POLICY = deepFreeze({
  coefficientPerturbation: "exact-multiplicative-one-plus-or-minus-amplitude-v1",
  oneAtATimeOrder: "amplitude-coefficient-negative-positive-v1",
  cartesianOrder: "amplitude-lexicographic-sign-vector-v1",
  comparison: "exact-leader-presentation-and-canonical-top-k-sets-v1",
  missingComparison: "indeterminate-without-denominator-reduction-v1"
});

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
    stage: "EVALUATE_PACKAGE_SELECTOR_SENSITIVITY",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizePackageSelectorSensitivityOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_OPTIONS_INVALID",
      "Package selector sensitivity options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_OPTIONS_INVALID",
      "Package selector sensitivity options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_OPTION_UNKNOWN",
      "Unknown package selector sensitivity option.",
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
      "PACKAGE_SELECTOR_SENSITIVITY_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a normalized non-empty string.",
      { value: value.kernelVersion }
    );
  }
  const maximum = value.maxSensitivityFunctionalEvaluations ??
    PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    maximum >
      PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
  ) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_EVALUATION_LIMIT_INVALID",
      "Sensitivity functional-evaluation limit is outside the supported range.",
      {
        value: maximum,
        maximum:
          PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
      }
    );
  }
  return { ...value, maxSensitivityFunctionalEvaluations: maximum };
}

function rankingOptions(options) {
  const result = {};
  for (const field of [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations"
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

function findSelectorAndFunctional(loadedPackage, selectorId) {
  const selector = loadedPackage.normalized.selectors
    .find((entry) => entry.id === selectorId);
  if (selector === undefined) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_SELECTOR_NOT_FOUND",
      "Sensitivity selector is not declared by the loaded package.",
      { selectorId }
    );
  }
  const functional = loadedPackage.normalized.functionals
    .find((entry) => entry.id === selector.functional);
  if (functional === undefined) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_FUNCTIONAL_NOT_FOUND",
      "Sensitivity functional is not declared by the loaded package.",
      { functionalId: selector.functional }
    );
  }
  return { selector, functional };
}

function variantCountPerAmplitude(sweep, coefficientCount) {
  if (coefficientCount === 0) return 0n;
  if (sweep === "one-at-a-time") return BigInt(coefficientCount) * 2n;
  return 2n ** BigInt(coefficientCount);
}

function portableCount(value) {
  return value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}

function requiredExecution(selector, coefficientCount, ranking, runBudget) {
  const perAmplitude = variantCountPerAmplitude(
    selector.sensitivity.sweep,
    coefficientCount
  );
  const variants = perAmplitude * BigInt(selector.sensitivity.amplitudes.length);
  const members = BigInt(ranking.counts.members);
  const cohorts = BigInt(ranking.counts.cohorts);
  const functionalEvaluations = variants * members;
  const comparisons = variants * cohorts;
  return {
    variantCount: variants,
    functionalEvaluationCount: functionalEvaluations,
    comparisonCount: comparisons,
    variants: portableCount(variants),
    functionalEvaluations: portableCount(functionalEvaluations),
    comparisons: portableCount(comparisons),
    runBudget
  };
}

function factor(amplitude, direction) {
  const one = parseDecimal(1);
  const delta = parseDecimal(amplitude);
  return direction === "negative"
    ? subtractDecimals(one, delta)
    : addDecimals(one, delta);
}

function oneAtATimeDefinitions(amplitude, coefficientNames) {
  return coefficientNames.flatMap((coefficient) =>
    ["negative", "positive"].map((direction) => ({
      amplitude,
      sweep: "one-at-a-time",
      directions: [{ coefficient, direction, factor: factor(amplitude, direction) }]
    }))
  );
}

function cartesianDefinitions(amplitude, coefficientNames) {
  const variants = [];
  function visit(index, directions) {
    if (index === coefficientNames.length) {
      variants.push({ amplitude, sweep: "cartesian", directions });
      return;
    }
    const coefficient = coefficientNames[index];
    for (const direction of ["negative", "positive"]) {
      visit(index + 1, [
        ...directions,
        { coefficient, direction, factor: factor(amplitude, direction) }
      ]);
    }
  }
  visit(0, []);
  return variants;
}

function variantDefinitions(
  loadedPackage,
  baseRanking,
  selector,
  coefficientNames
) {
  return selector.sensitivity.amplitudes.flatMap((amplitude) =>
    selector.sensitivity.sweep === "one-at-a-time"
      ? oneAtATimeDefinitions(amplitude, coefficientNames)
      : cartesianDefinitions(amplitude, coefficientNames)
  ).map((definition) => ({
    ...definition,
    variantId: hashCanonical(
      HASH_DOMAINS.PACKAGE_SELECTOR_SENSITIVITY_VARIANT,
      {
        packageId: loadedPackage.packageId,
        rulesHash: loadedPackage.semanticManifest.rulesHash,
        baseRankingHash: baseRanking.rankingHash,
        selectorId: selector.id,
        functionalId: selector.functional,
        ...definition
      }
    )
  }));
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
      "PACKAGE_SELECTOR_SENSITIVITY_QUANTITY_OVERFLOW",
      "A perturbed Quantity cannot be represented as finite binary64.",
      { label, value: parseDecimal(value).canonical }
    );
  }
  const difference = subtractDecimals(parseDecimal(converted), value);
  if (BigInt(difference.coefficient) >= 0n) return converted;
  const outward = nextPositiveBinary64(converted);
  if (!Number.isFinite(outward)) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_QUANTITY_OVERFLOW",
      "A perturbed Quantity cannot be represented as finite binary64.",
      { label, value: parseDecimal(value).canonical }
    );
  }
  return outward;
}

function coefficientDecimalToNumber(value, label) {
  try {
    return decimalToNumber(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    if (
      error.code !== "DECIMAL_NUMBER_UNDERFLOW" &&
      error.code !== "DECIMAL_NUMBER_OVERFLOW"
    ) {
      throw error;
    }
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_QUANTITY_UNREPRESENTABLE",
      "A perturbed coefficient value cannot be represented as finite nonzero binary64.",
      { label, value: parseDecimal(value).canonical, causeCode: error.code }
    );
  }
}

function perturbedQuantity(quantity, multiplier, name) {
  const value = multiplyDecimals(parseDecimal(quantity.value), multiplier);
  const absolute = quantity.tolerance.absolute === undefined
    ? undefined
    : multiplyDecimals(parseDecimal(quantity.tolerance.absolute), multiplier);
  return normalizeQuantity({
    ...quantity,
    value: coefficientDecimalToNumber(value, `${name}.value`),
    tolerance: {
      ...(absolute === undefined
        ? {}
        : { absolute: outwardDecimalToNumber(absolute, `${name}.absoluteTolerance`) }),
      ...(quantity.tolerance.relative === undefined
        ? {}
        : { relative: quantity.tolerance.relative })
    }
  });
}

function variantCoefficients(functional, definition) {
  const factors = new Map(definition.directions.map((entry) => [
    entry.coefficient,
    entry.factor
  ]));
  const coefficients = {};
  const witnesses = Object.entries(functional.coefficients).map(([name, base]) => {
    const multiplier = factors.get(name) ?? parseDecimal(1);
    const perturbed = factors.has(name)
      ? perturbedQuantity(base, multiplier, name)
      : base;
    coefficients[name] = perturbed;
    return {
      name,
      factor: multiplier,
      base,
      perturbed
    };
  });
  return { coefficients, witnesses };
}

function filterIndex(census) {
  return new Map(census.candidateEvaluations.map((evaluation) => [
    evaluation.formation.candidate.id,
    evaluation
  ]));
}

function topK(cohort, count) {
  return cohort.members.slice(0, Math.min(count, cohort.members.length))
    .map((member) => member.candidateId)
    .sort(compareStrings);
}

function sameSet(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function comparison(base, perturbed, topKCount) {
  const baseView = {
    semanticExtrema: [...base.semanticExtrema],
    presentationLeader: base.presentationLeader,
    topK: topK(base, topKCount)
  };
  if (perturbed.status === "indeterminate") {
    return {
      cohortId: base.cohortId,
      status: "indeterminate",
      reason: "perturbed-cohort-indeterminate",
      base: baseView,
      perturbed: null,
      leaderSetStable: null,
      presentationLeaderStable: null,
      topKStable: null
    };
  }
  const perturbedView = {
    semanticExtrema: [...perturbed.semanticExtrema],
    presentationLeader: perturbed.presentationLeader,
    topK: topK(perturbed, topKCount)
  };
  return {
    cohortId: base.cohortId,
    status: "comparable",
    base: baseView,
    perturbed: perturbedView,
    leaderSetStable: sameSet(
      baseView.semanticExtrema,
      perturbedView.semanticExtrema
    ),
    presentationLeaderStable:
      baseView.presentationLeader === perturbedView.presentationLeader,
    topKStable: sameSet(baseView.topK, perturbedView.topK)
  };
}

function evaluateVariant(
  definition,
  partition,
  baseByCohort,
  preparedFilters,
  selector,
  functional
) {
  const { coefficients, witnesses } = variantCoefficients(functional, definition);
  const cohortRankings = partition.cohorts.map((cohort) => {
    const evaluations = cohort.members.map((candidateId) => ({
      memberId: candidateId,
      evaluation: preparedFilters.get(candidateId).evaluate(coefficients)
    }));
    return rankVerifiedCohortEvaluations(
      cohort,
      evaluations,
      selector,
      functional
    );
  }).sort((left, right) => compareStrings(left.cohortId, right.cohortId));
  const comparisons = cohortRankings.map((cohort) => comparison(
    baseByCohort.get(cohort.cohortId),
    cohort,
    selector.sensitivity.topK
  ));
  return {
    ...definition,
    coefficients: witnesses,
    status: cohortRankings.every((cohort) => cohort.status === "ranked")
      ? "ranked"
      : "indeterminate",
    cohortRankings,
    comparisons
  };
}

function pointForAmplitude(amplitude, variants, cohortCount) {
  const comparisons = variants.flatMap((variant) => variant.comparisons);
  const requiredComparisons = variants.length * cohortCount;
  const comparable = comparisons.filter((entry) => entry.status === "comparable");
  const complete = comparable.length === requiredComparisons;
  const leaderSetMatches = comparable.filter((entry) => entry.leaderSetStable).length;
  const presentationLeaderMatches = comparable.filter(
    (entry) => entry.presentationLeaderStable
  ).length;
  const topKMatches = comparable.filter((entry) => entry.topKStable).length;
  return {
    amplitude,
    requiredVariants: variants.length,
    evaluatedVariants: variants.length,
    requiredComparisons,
    evaluatedComparisons: comparisons.length,
    comparableComparisons: comparable.length,
    leaderSetMatches,
    presentationLeaderMatches,
    topKMatches,
    leaderSetStability: complete ? leaderSetMatches / requiredComparisons : null,
    presentationLeaderStability:
      complete ? presentationLeaderMatches / requiredComparisons : null,
    topKStability: complete ? topKMatches / requiredComparisons : null
  };
}

function statusWithoutExecution(baseRanking, coefficientNames, execution) {
  if (baseRanking.status === "indeterminate") {
    return {
      status: "indeterminate",
      reasons: ["base-ranking-indeterminate"],
      details: { baseRankingReason: baseRanking.reason }
    };
  }
  if (baseRanking.status === "empty") {
    return {
      status: "not-applicable",
      reasons: ["no-ranked-cohorts"],
      details: {}
    };
  }
  if (coefficientNames.length === 0) {
    return {
      status: "not-applicable",
      reasons: ["no-sensitivity-coefficients"],
      details: {}
    };
  }
  if (
    execution.variantCount >
      BigInt(PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxVariants)
  ) {
    return {
      status: "indeterminate",
      reasons: ["variant-limit-exceeded"],
      details: {
        requiredVariants: execution.variants,
        maximumVariants: PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxVariants
      }
    };
  }
  if (execution.variantCount > BigInt(execution.runBudget)) {
    return {
      status: "indeterminate",
      reasons: ["perturbation-budget-insufficient"],
      details: {
        requiredVariants: execution.variants,
        perturbationSamples: execution.runBudget
      }
    };
  }
  return null;
}

function reportBasis({
  loadedPackage,
  ranking,
  selector,
  functional,
  coefficientNames,
  execution,
  status,
  reasons,
  details,
  points = [],
  variants = [],
  verdict = null,
  usedFunctionalEvaluations = 0,
  evaluatedComparisons = 0
}) {
  return {
    schemaVersion: "1",
    evaluator: PACKAGE_SELECTOR_SENSITIVITY_EVALUATOR_VERSION,
    scope: PACKAGE_SELECTOR_SENSITIVITY_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: ranking.bindingHash,
    censusHash: ranking.censusHash,
    partitionHash: ranking.partitionHash,
    baseRankingHash: ranking.rankingHash,
    countingDomain: ranking.countingDomain,
    sourcePopulationHash: ranking.sourcePopulationHash,
    selectorId: selector.id,
    functionalId: functional.id,
    policy: selector.sensitivity,
    sensitivityPolicy: PACKAGE_SELECTOR_SENSITIVITY_POLICY,
    sensitivityCoefficients: coefficientNames,
    status,
    reasons,
    details,
    points,
    variants,
    verdict,
    execution: {
      perturbationSamples: execution.runBudget,
      maxSensitivityFunctionalEvaluations:
        execution.maxSensitivityFunctionalEvaluations,
      requiredVariants: execution.variants,
      evaluatedVariants: variants.length,
      requiredFunctionalEvaluations: execution.functionalEvaluations,
      usedFunctionalEvaluations,
      requiredComparisons: execution.comparisons,
      evaluatedComparisons
    }
  };
}

/**
 * Executes every required coefficient perturbation against every member of an
 * independently reproduced base selector ranking.
 */
export function evaluateVerifiedPackageSelectorSensitivity(
  loadedPackage,
  census,
  partition,
  baseRanking,
  normalized,
  createFunctionalSession,
  memberFilters = null
) {
  const { selector, functional } = findSelectorAndFunctional(
    loadedPackage,
    baseRanking.selector.id
  );
  const coefficientNames = [...functional.sensitivityCoefficients];
  const runBudget = census.generation.binding.runConfig.budget.perturbationSamples;
  const required = requiredExecution(
    selector,
    coefficientNames.length,
    baseRanking,
    runBudget
  );
  const execution = {
    ...required,
    maxSensitivityFunctionalEvaluations:
      normalized.maxSensitivityFunctionalEvaluations
  };
  let preflight = statusWithoutExecution(
    baseRanking,
    coefficientNames,
    execution
  );
  if (
    preflight === null &&
    execution.functionalEvaluationCount >
      BigInt(normalized.maxSensitivityFunctionalEvaluations)
  ) {
    preflight = {
      status: "indeterminate",
      reasons: ["functional-evaluation-limit-exceeded"],
      details: {
        requiredFunctionalEvaluations: execution.functionalEvaluations,
        maximumFunctionalEvaluations:
          normalized.maxSensitivityFunctionalEvaluations
      }
    };
  }
  if (preflight !== null) {
    const basis = reportBasis({
      loadedPackage,
      ranking: baseRanking,
      selector,
      functional,
      coefficientNames,
      execution,
      ...preflight
    });
    return deepFreeze({
      ...basis,
      sensitivityHash: hashCanonical(
        HASH_DOMAINS.PACKAGE_SELECTOR_SENSITIVITY,
        basis
      )
    });
  }

  const filters = memberFilters === null ? filterIndex(census) : memberFilters;
  if (!(filters instanceof Map)) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_MEMBER_FILTERS_INVALID",
      "Verified selector sensitivity member filters must be a Map."
    );
  }
  const session = createFunctionalSession(
    loadedPackage,
    census.generation.binding,
    functional.id,
    functionalOptions(normalized)
  );
  const preparedFilters = new Map();
  for (const candidateId of partition.eligibleCandidateIds) {
    const filter = filters.get(candidateId);
    if (filter === undefined || filter.verdict !== "eligible") {
      fail(
        "PACKAGE_SELECTOR_SENSITIVITY_MEMBER_MISSING",
        "A sensitivity member has no reproduced eligible census filter.",
        { candidateId }
      );
    }
    preparedFilters.set(candidateId, session.prepare(filter));
  }
  const definitions = variantDefinitions(
    loadedPackage,
    baseRanking,
    selector,
    coefficientNames
  );
  const baseByCohort = new Map(baseRanking.cohortRankings.map((cohort) => [
    cohort.cohortId,
    cohort
  ]));
  const variants = definitions.map((definition) => evaluateVariant(
    definition,
    partition,
    baseByCohort,
    preparedFilters,
    selector,
    functional
  ));
  const points = selector.sensitivity.amplitudes.map((amplitude) =>
    pointForAmplitude(
      amplitude,
      variants.filter((variant) => variant.amplitude === amplitude),
      baseRanking.counts.cohorts
    )
  );
  const complete = variants.every((variant) => variant.status === "ranked");
  const verdict = complete && points.every((point) =>
    point.leaderSetStability >= selector.sensitivity.robustLeaderSetThreshold &&
    point.topKStability >= selector.sensitivity.robustTopKThreshold
  ) ? "robust" : complete ? "fragile" : null;
  const status = complete ? "complete" : "indeterminate";
  const reasons = complete ? [] : ["variant-ranking-indeterminate"];
  const details = complete
    ? {}
    : {
        variantIds: variants
          .filter((variant) => variant.status === "indeterminate")
          .map((variant) => variant.variantId)
      };
  const basis = reportBasis({
    loadedPackage,
    ranking: baseRanking,
    selector,
    functional,
    coefficientNames,
    execution,
    status,
    reasons,
    details,
    points,
    variants,
    verdict,
    usedFunctionalEvaluations: execution.functionalEvaluations,
    evaluatedComparisons: execution.comparisons
  });
  return deepFreeze({
    ...basis,
    sensitivityHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_SELECTOR_SENSITIVITY,
      basis
    )
  });
}

/** Executes coefficient sensitivity over a primitive-source selector ranking. */
export function evaluatePackageSelectorSensitivity(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  partitionInput,
  rankingInput,
  options = {}
) {
  const normalized = normalizePackageSelectorSensitivityOptions(options);
  const baseRanking = verifyPackageSelectorRanking(
    rankingInput,
    loadedPackageInput,
    runConfigInput,
    censusInput,
    partitionInput,
    rankingOptions(normalized)
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    functionalOptions(normalized)
  );
  return evaluateVerifiedPackageSelectorSensitivity(
    loadedPackage,
    canonicalClone(censusInput),
    canonicalClone(partitionInput),
    baseRanking,
    normalized,
    createPackageFunctionalEvaluationSession
  );
}

/** Verifies sensitivity after every source ranking input was already replayed. */
export function verifyVerifiedPackageSelectorSensitivity(
  sensitivityInput,
  loadedPackage,
  census,
  partition,
  ranking,
  normalized,
  createFunctionalSession
) {
  let supplied;
  try {
    supplied = canonicalClone(sensitivityInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_ARTIFACT_INVALID",
      "Package selector sensitivity report is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = evaluateVerifiedPackageSelectorSensitivity(
    loadedPackage,
    census,
    partition,
    ranking,
    normalized,
    createFunctionalSession
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_MISMATCH",
      "Package selector sensitivity report differs from deterministic reproduction.",
      {
        expectedSensitivityHash: reproduced.sensitivityHash,
        actualSensitivityHash:
          isObject(supplied) && typeof supplied.sensitivityHash === "string"
            ? supplied.sensitivityHash
            : null
      }
    );
  }
  return reproduced;
}

/**
 * Accepts a serialized sensitivity report only after exact deterministic
 * reproduction of its complete package/run/ranking basis.
 */
export function verifyPackageSelectorSensitivity(
  sensitivityInput,
  loadedPackageInput,
  runConfigInput,
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
      "PACKAGE_SELECTOR_SENSITIVITY_ARTIFACT_INVALID",
      "Package selector sensitivity report is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = evaluatePackageSelectorSensitivity(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    partitionInput,
    rankingInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_SELECTOR_SENSITIVITY_MISMATCH",
      "Package selector sensitivity report differs from deterministic reproduction.",
      {
        expectedSensitivityHash: reproduced.sensitivityHash,
        actualSensitivityHash:
          isObject(supplied) && typeof supplied.sensitivityHash === "string"
            ? supplied.sensitivityHash
            : null
      }
    );
  }
  return reproduced;
}
