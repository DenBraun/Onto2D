import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  addDecimals,
  multiplyDecimals,
  parseDecimal,
  subtractDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  candidateAttributeSymbolEnvironment,
  invariantSymbolEnvironment
} from "./invariant.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import { createVerifiedPackageValueRuntime } from "./package-functional-evaluator.js";
import { parseUnitExpression } from "./quantity.js";

export const PACKAGE_COHORT_PARTITIONER_VERSION =
  "package-cohort-partitioner-v1";
export const PACKAGE_COHORT_PARTITION_SCOPE =
  "complete-locally-eligible-population-v1";
export const PACKAGE_COHORT_PARTITION_LIMITS = deepFreeze({
  maxKeyExpressionEvaluations: 1_000_000
});

const OPTION_FIELDS = new Set([
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
    stage: "PARTITION_PACKAGE_COHORTS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_COHORT_OPTIONS_INVALID",
      "Package cohort options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_COHORT_OPTIONS_INVALID",
      "Package cohort options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_COHORT_OPTION_UNKNOWN",
      "Unknown package cohort construction option.",
      { unknown }
    );
  }
  return value;
}

function findRule(loadedPackage, cohortRuleId) {
  if (
    typeof cohortRuleId !== "string" ||
    cohortRuleId.length === 0 ||
    cohortRuleId !== cohortRuleId.trim()
  ) {
    fail(
      "PACKAGE_COHORT_RULE_ID_INVALID",
      "Cohort rule identifier must be a normalized non-empty string.",
      { cohortRuleId }
    );
  }
  const rule = loadedPackage.normalized.cohortRules
    .find((entry) => entry.id === cohortRuleId);
  if (rule === undefined) {
    fail(
      "PACKAGE_COHORT_RULE_NOT_FOUND",
      "Cohort rule identifier is not declared by the loaded package.",
      { cohortRuleId }
    );
  }
  return rule;
}

function analyzeRule(loadedPackage, rule) {
  const invariants = invariantSymbolEnvironment(
    loadedPackage.normalized.primitives
  );
  const environment = {
    invariants,
    attributes: candidateAttributeSymbolEnvironment(
      loadedPackage.normalized.candidateAttributes,
      invariants
    )
  };
  const expressions = rule.kind === "shared-support"
    ? rule.resourceKey
    : rule.kind === "profile-role"
      ? rule.roleKey
      : rule.kind === "invariant-window"
        ? [rule.value]
        : [];
  return expressions.map((expression, expressionIndex) => {
    const analysis = analyzeValueExpression(expression, { environment });
    if (canonicalize(analysis.expression) !== canonicalize(expression)) {
      fail(
        "PACKAGE_COHORT_ANALYSIS_MISMATCH",
        "Cohort key differs from its deterministic expression analysis.",
        { cohortRuleId: rule.id, expressionIndex }
      );
    }
    return analysis;
  });
}

function decimalAbsolute(value) {
  const parsed = parseDecimal(value);
  return BigInt(parsed.coefficient) < 0n ? multiplyDecimals(parsed, -1) : parsed;
}

function decimalMaximum(left, right) {
  return BigInt(subtractDecimals(left, right).coefficient) >= 0n ? left : right;
}

function quantityToleranceBound(quantity) {
  const absolute = parseDecimal(quantity.tolerance.absolute ?? 0);
  const relative = multiplyDecimals(
    parseDecimal(quantity.tolerance.relative ?? 0),
    parseDecimal(Math.abs(quantity.value))
  );
  return decimalMaximum(absolute, relative);
}

function isZeroDecimal(value) {
  return parseDecimal(value).coefficient === "0";
}

function normalizedAtom(value, analysis) {
  if (value.kind === "number") {
    return { kind: "number", value: value.unrounded };
  }
  if (value.kind === "quantity") {
    const actualDimensions = parseUnitExpression(value.unit).dimensionSignature;
    if (actualDimensions !== analysis.result.dimensionSignature) {
      fail(
        "PACKAGE_COHORT_KEY_UNIT_MISMATCH",
        "Cohort key runtime dimensions differ from deterministic analysis.",
        {
          expressionHash: analysis.expressionHash,
          runtimeUnit: value.unit,
          runtimeDimensions: actualDimensions,
          analysisDimensions: analysis.result.dimensionSignature
        }
      );
    }
    return {
      kind: "quantity",
      value: value.unrounded,
      unit: value.unit,
      semantic: analysis.result.semantic ?? null,
      effectiveAbsoluteTolerance: value.tolerance
    };
  }
  return { kind: value.kind, value: value.value };
}

function expressionEvaluation(runtime, graph, analysis, expressionIndex) {
  const evaluated = runtime.evaluate(graph, analysis);
  const identity = {
    expressionIndex,
    expressionHash: analysis.expressionHash,
    analysisHash: analysis.analysisHash
  };
  if (evaluated.status === "indeterminate") {
    return {
      ...identity,
      status: "indeterminate",
      reason: evaluated.reason,
      details: evaluated.details
    };
  }
  const value = evaluated.value;
  return {
    ...identity,
    status: "resolved",
    atom: normalizedAtom(value, analysis),
    exact: value.exact,
    selections: value.selections,
    invariants: value.invariants
  };
}

function floorRatio(numeratorInput, denominatorInput) {
  const numerator = parseDecimal(numeratorInput);
  const denominator = parseDecimal(denominatorInput);
  const denominatorCoefficient = BigInt(denominator.coefficient);
  if (denominatorCoefficient <= 0n) {
    fail(
      "PACKAGE_COHORT_WINDOW_WIDTH_INVALID",
      "Invariant-window width must be strictly positive."
    );
  }
  const scaleDifference = denominator.scale - numerator.scale;
  let scaledNumerator = BigInt(numerator.coefficient);
  let scaledDenominator = denominatorCoefficient;
  if (scaleDifference >= 0) {
    scaledNumerator *= 10n ** BigInt(scaleDifference);
  } else {
    scaledDenominator *= 10n ** BigInt(-scaleDifference);
  }
  let quotient = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  if (scaledNumerator < 0n && remainder !== 0n) quotient -= 1n;
  return quotient;
}

function windowKey(rule, expression) {
  const originTolerance = quantityToleranceBound(rule.origin);
  if (!isZeroDecimal(originTolerance)) {
    return {
      status: "indeterminate",
      reason: "window-origin-uncertain",
      details: { effectiveAbsoluteTolerance: originTolerance.canonical }
    };
  }
  const widthTolerance = quantityToleranceBound(rule.width);
  if (!isZeroDecimal(widthTolerance)) {
    return {
      status: "indeterminate",
      reason: "window-width-uncertain",
      details: { effectiveAbsoluteTolerance: widthTolerance.canonical }
    };
  }
  const atom = expression.atom;
  if (atom.kind !== "number" && atom.kind !== "quantity") {
    fail(
      "PACKAGE_COHORT_WINDOW_VALUE_INVALID",
      "Invariant-window key expression must resolve to a number or Quantity.",
      { kind: atom.kind }
    );
  }
  const value = atom.value;
  const tolerance = atom.kind === "quantity"
    ? atom.effectiveAbsoluteTolerance
    : parseDecimal(0);
  const origin = parseDecimal(rule.origin.value);
  const width = parseDecimal(rule.width.value);
  const nominalBin = floorRatio(subtractDecimals(value, origin), width);
  if (!isZeroDecimal(tolerance)) {
    const lowerBin = floorRatio(
      subtractDecimals(subtractDecimals(value, tolerance), origin),
      width
    );
    const upperBin = floorRatio(
      subtractDecimals(addDecimals(value, tolerance), origin),
      width
    );
    if (lowerBin !== nominalBin || upperBin !== nominalBin) {
      return {
        status: "indeterminate",
        reason: "window-value-crosses-boundary",
        details: {
          nominalBin: nominalBin.toString(),
          lowerBin: lowerBin.toString(),
          upperBin: upperBin.toString(),
          effectiveAbsoluteTolerance: tolerance.canonical
        }
      };
    }
  }
  return {
    status: "resolved",
    key: { kind: "invariant-window", binIndex: nominalBin.toString() }
  };
}

function evaluateCandidateKey(
  runtime,
  candidate,
  rule,
  analyses,
  memberId = candidate.id
) {
  const expressions = analyses.map((analysis, expressionIndex) =>
    expressionEvaluation(runtime, candidate, analysis, expressionIndex)
  );
  const unresolved = expressions.find((entry) => entry.status === "indeterminate");
  if (unresolved !== undefined) {
    return {
      candidateId: memberId,
      status: "indeterminate",
      reason: unresolved.reason,
      details: { expressionIndex: unresolved.expressionIndex, ...unresolved.details },
      expressions
    };
  }
  if (rule.kind === "global") {
    return {
      candidateId: memberId,
      status: "resolved",
      key: { kind: "global" },
      expressions
    };
  }
  if (rule.kind === "singleton") {
    return {
      candidateId: memberId,
      status: "resolved",
      key: { kind: "singleton", candidateId: memberId },
      expressions
    };
  }
  if (rule.kind === "profile-role") {
    return {
      candidateId: memberId,
      status: "resolved",
      key: {
        kind: "profile-role",
        atoms: expressions.map((entry) => entry.atom)
      },
      expressions
    };
  }
  if (rule.kind === "shared-support") {
    const resourceTokens = expressions.map((entry) => hashCanonical(
      HASH_DOMAINS.COHORT_RESOURCE,
      { expressionIndex: entry.expressionIndex, atom: entry.atom }
    ));
    return {
      candidateId: memberId,
      status: "resolved",
      key: { kind: "shared-support", resourceTokens },
      expressions
    };
  }
  const window = windowKey(rule, expressions[0]);
  if (window.status === "indeterminate") {
    return {
      candidateId: memberId,
      status: "indeterminate",
      reason: window.reason,
      details: window.details,
      expressions
    };
  }
  return {
    candidateId: memberId,
    status: "resolved",
    key: window.key,
    expressions
  };
}

/**
 * Internal occurrence-aware cohort-key boundary. Member identity is supplied
 * independently from graph identity so repeated draws of the same canonical
 * candidate remain distinct population members. Ordinary candidate partition
 * construction calls the same boundary with memberId === candidate.id.
 */
export function constructVerifiedPackageCohortMembers(
  loadedPackage,
  binding,
  cohortRuleId,
  memberInputs
) {
  if (!Array.isArray(memberInputs)) {
    fail(
      "PACKAGE_COHORT_MEMBER_INPUTS_INVALID",
      "Verified cohort member inputs must be an array."
    );
  }
  const rule = findRule(loadedPackage, cohortRuleId);
  const members = memberInputs.map((entry, index) => {
    if (
      !isObject(entry) ||
      typeof entry.memberId !== "string" ||
      entry.memberId.length === 0 ||
      entry.memberId !== entry.memberId.trim() ||
      !isObject(entry.candidate)
    ) {
      fail(
        "PACKAGE_COHORT_MEMBER_INPUT_INVALID",
        "Each verified cohort member must bind one normalized member ID to a candidate graph.",
        { index }
      );
    }
    return entry;
  });
  const memberIds = members.map((entry) => entry.memberId).sort(compareStrings);
  if (new Set(memberIds).size !== memberIds.length) {
    fail(
      "PACKAGE_COHORT_MEMBER_ID_DUPLICATE",
      "Verified cohort member IDs must be unique even when candidate graphs repeat."
    );
  }
  const analyses = analyzeRule(loadedPackage, rule);
  const expressionEvaluations = members.length * analyses.length;
  if (
    !Number.isSafeInteger(expressionEvaluations) ||
    expressionEvaluations >
      PACKAGE_COHORT_PARTITION_LIMITS.maxKeyExpressionEvaluations
  ) {
    fail(
      "PACKAGE_COHORT_KEY_EVALUATION_LIMIT",
      "Complete cohort key evaluation exceeds its aggregate resource limit.",
      {
        eligibleCandidates: members.length,
        expressionsPerCandidate: analyses.length,
        expressionEvaluations,
        maximum: PACKAGE_COHORT_PARTITION_LIMITS.maxKeyExpressionEvaluations
      }
    );
  }
  const runtime = createVerifiedPackageValueRuntime(binding);
  const keyEvaluations = members.map((entry) => evaluateCandidateKey(
    runtime,
    entry.candidate,
    rule,
    analyses,
    entry.memberId
  ));
  const unresolved = keyEvaluations
    .filter((entry) => entry.status === "indeterminate");
  const cohorts = unresolved.length === 0 && members.length > 0
    ? groupedCohorts(rule, keyEvaluations)
        .sort((left, right) => compareStrings(left.cohortId, right.cohortId))
    : [];
  if (cohorts.length > 0) reconcileCoverage(cohorts, memberIds);
  return deepFreeze({
    rule,
    memberIds,
    keyEvaluations,
    cohorts,
    counts: {
      members: members.length,
      keyResolved: keyEvaluations.length - unresolved.length,
      keyIndeterminate: unresolved.length,
      cohorts: cohorts.length,
      coveredMembers: cohorts.reduce(
        (count, cohort) => count + cohort.members.length,
        0
      )
    },
    status: members.length === 0
      ? "empty"
      : unresolved.length > 0
        ? "indeterminate"
        : "complete",
    ...(unresolved.length === 0
      ? {}
      : {
          reason: "cohort-key-indeterminate",
          details: {
            candidateIds: unresolved.map((entry) => entry.candidateId)
          }
        })
  });
}

function makeCohort(rule, key, members) {
  const sortedMembers = [...members].sort(compareStrings);
  const basis = {
    ruleId: rule.id,
    ruleKind: rule.kind,
    key,
    members: sortedMembers
  };
  return {
    cohortId: hashCanonical(HASH_DOMAINS.COHORT, basis),
    key,
    members: sortedMembers
  };
}

function groupedCohorts(rule, evaluations) {
  if (rule.kind === "global") {
    return [makeCohort(rule, { kind: "global" }, evaluations.map((entry) =>
      entry.candidateId
    ))];
  }
  if (rule.kind === "singleton") {
    return evaluations.map((entry) => makeCohort(
      rule,
      entry.key,
      [entry.candidateId]
    ));
  }
  if (rule.kind === "shared-support") {
    const parent = evaluations.map((_, index) => index);
    function root(index) {
      let value = index;
      while (parent[value] !== value) value = parent[value];
      while (parent[index] !== index) {
        const next = parent[index];
        parent[index] = value;
        index = next;
      }
      return value;
    }
    function unite(left, right) {
      const a = root(left);
      const b = root(right);
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
    const firstByResource = new Map();
    evaluations.forEach((entry, index) => {
      for (const token of entry.key.resourceTokens) {
        const first = firstByResource.get(token);
        if (first === undefined) firstByResource.set(token, index);
        else unite(first, index);
      }
    });
    const components = new Map();
    evaluations.forEach((entry, index) => {
      const component = root(index);
      if (!components.has(component)) components.set(component, []);
      components.get(component).push(entry);
    });
    return [...components.values()].map((entries) => {
      const resourceTokens = [...new Set(entries.flatMap((entry) =>
        entry.key.resourceTokens
      ))].sort(compareStrings);
      return makeCohort(
        rule,
        { kind: "shared-support", resourceTokens },
        entries.map((entry) => entry.candidateId)
      );
    });
  }
  const groups = new Map();
  for (const entry of evaluations) {
    const key = canonicalize(entry.key);
    if (!groups.has(key)) groups.set(key, { key: entry.key, members: [] });
    groups.get(key).members.push(entry.candidateId);
  }
  return [...groups.values()].map((entry) =>
    makeCohort(rule, entry.key, entry.members)
  );
}

function reconcileCoverage(cohorts, eligibleCandidateIds) {
  const covered = cohorts.flatMap((cohort) => cohort.members);
  const unique = new Set(covered);
  if (
    covered.length !== unique.size ||
    covered.length !== eligibleCandidateIds.length ||
    canonicalize([...unique].sort(compareStrings)) !==
      canonicalize(eligibleCandidateIds)
  ) {
    fail(
      "PACKAGE_COHORT_PARTITION_INVALID",
      "Cohort membership does not form an exact partition of eligible candidates.",
      {
        eligibleCandidates: eligibleCandidateIds.length,
        coveredMembers: covered.length,
        uniqueMembers: unique.size
      }
    );
  }
}

/**
 * Internal construction boundary shared by primitive and depth-aware census
 * verifiers. Both inputs must already have been reproduced independently.
 */
export function constructVerifiedPackageCohorts(
  loadedPackage,
  census,
  cohortRuleId
) {
  const rule = findRule(loadedPackage, cohortRuleId);
  const eligible = census.candidateEvaluations
    .filter((entry) => entry.verdict === "eligible");
  const eligibleCandidateIds = eligible.map((entry) =>
    entry.formation.candidate.id
  ).sort(compareStrings);
  const excludedCandidateIds = {
    predicateRejected: census.candidateEvaluations
      .filter((entry) => entry.verdict === "predicate-rejected")
      .map((entry) => entry.formation.candidate.id)
      .sort(compareStrings),
    filterIndeterminate: census.candidateEvaluations
      .filter((entry) => entry.verdict === "filter-indeterminate")
      .map((entry) => entry.formation.candidate.id)
      .sort(compareStrings)
  };

  let status;
  let reason;
  let details;
  let keyEvaluations = [];
  let cohorts = [];
  if (census.interpretation.status === "indeterminate") {
    status = "indeterminate";
    reason = "source-census-indeterminate";
    details = { censusReasons: [...census.interpretation.reasons] };
  } else if (eligible.length === 0) {
    status = "empty";
    reason = "no-eligible-candidates";
    details = {};
  } else {
    const memberPartition = constructVerifiedPackageCohortMembers(
      loadedPackage,
      census.generation.binding,
      cohortRuleId,
      eligible.map((entry) => ({
        memberId: entry.formation.candidate.id,
        candidate: entry.formation.candidate
      }))
    );
    keyEvaluations = memberPartition.keyEvaluations;
    if (memberPartition.status === "indeterminate") {
      status = "indeterminate";
      reason = memberPartition.reason;
      details = memberPartition.details;
    } else {
      status = "complete";
      cohorts = memberPartition.cohorts;
    }
  }

  const resolvedCount = keyEvaluations
    .filter((entry) => entry.status === "resolved").length;
  const indeterminateCount = keyEvaluations.length - resolvedCount;
  const coveredMembers = cohorts.reduce(
    (count, cohort) => count + cohort.members.length,
    0
  );
  const basis = {
    schemaVersion: "1",
    partitioner: PACKAGE_COHORT_PARTITIONER_VERSION,
    scope: PACKAGE_COHORT_PARTITION_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    countingDomain: census.countingDomain,
    sourcePopulationHash: census.sourcePopulationHash,
    cohortRule: rule,
    status,
    ...(reason === undefined ? {} : { reason, details }),
    excludedCandidateIds,
    eligibleCandidateIds,
    keyEvaluations,
    cohorts,
    counts: {
      evaluatedCandidates: census.counts.evaluatedCandidates,
      eligibleCandidates: eligibleCandidateIds.length,
      keyResolved: resolvedCount,
      keyIndeterminate: indeterminateCount,
      cohorts: cohorts.length,
      coveredMembers
    }
  };
  return deepFreeze({
    ...basis,
    partitionHash: hashCanonical(HASH_DOMAINS.PACKAGE_COHORT_PARTITION, basis)
  });
}

/**
 * Constructs a total deterministic cohort partition from a reproduced complete
 * primitive-source local-filter census. It never ranks or admits a member.
 */
export function constructPackageCohorts(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  cohortRuleId,
  options = {}
) {
  const normalizedOptions = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(loadedPackageInput, {
    ...(normalizedOptions.kernelVersion === undefined
      ? {}
      : { kernelVersion: normalizedOptions.kernelVersion })
  });
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    normalizedOptions
  );
  return constructVerifiedPackageCohorts(
    loadedPackage,
    census,
    cohortRuleId
  );
}

/** Verifies a partition after its package and census were already reproduced. */
export function verifyVerifiedPackageCohortPartition(
  partitionInput,
  loadedPackage,
  census
) {
  let supplied;
  try {
    supplied = canonicalClone(partitionInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_COHORT_PARTITION_ARTIFACT_INVALID",
      "Package cohort partition is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (
    !isObject(supplied) ||
    !isObject(supplied.cohortRule) ||
    typeof supplied.cohortRule.id !== "string"
  ) {
    fail(
      "PACKAGE_COHORT_PARTITION_ARTIFACT_INVALID",
      "Package cohort partition does not identify its cohort rule."
    );
  }
  const reproduced = constructVerifiedPackageCohorts(
    loadedPackage,
    census,
    supplied.cohortRule.id
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_COHORT_PARTITION_MISMATCH",
      "Package cohort partition differs from deterministic reproduction.",
      {
        expectedPartitionHash: reproduced.partitionHash,
        actualPartitionHash:
          typeof supplied.partitionHash === "string"
            ? supplied.partitionHash
            : null
      }
    );
  }
  return reproduced;
}

/**
 * Accepts a serialized cohort partition only after exact deterministic
 * reproduction from independently supplied package/run/census inputs.
 */
export function verifyPackageCohortPartition(
  partitionInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(partitionInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_COHORT_PARTITION_ARTIFACT_INVALID",
      "Package cohort partition is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (
    !isObject(supplied) ||
    !isObject(supplied.cohortRule) ||
    typeof supplied.cohortRule.id !== "string"
  ) {
    fail(
      "PACKAGE_COHORT_PARTITION_ARTIFACT_INVALID",
      "Package cohort partition does not identify its cohort rule."
    );
  }
  const reproduced = constructPackageCohorts(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    supplied.cohortRule.id,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_COHORT_PARTITION_MISMATCH",
      "Package cohort partition differs from deterministic reproduction.",
      {
        expectedPartitionHash: reproduced.partitionHash,
        actualPartitionHash:
          typeof supplied.partitionHash === "string"
            ? supplied.partitionHash
            : null
      }
    );
  }
  return reproduced;
}
