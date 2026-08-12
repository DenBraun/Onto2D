import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  verifyPackageDepthSelectorAdmission
} from "./package-depth-selector-admission.js";
import {
  verifyPackageSelectorAdmission
} from "./package-selector-admission.js";
import {
  verifyPackageDepthNullModelTrialSelections,
  verifyPackageNullModelTrialSelections
} from "./package-null-model-trial-selection.js";

export const PACKAGE_NULL_MODEL_BASELINE_VERSION =
  "package-null-model-baseline-v1";
export const PACKAGE_NULL_MODEL_BASELINE_SCOPE =
  "per-model-complete-trial-metric-distributions-v1";
export const PACKAGE_NULL_MODEL_DISTRIBUTION_POLICY = deepFreeze({
  pooling: "never-across-models-carriers-or-ontology-gates-v1",
  sampleOrder: "trial-id-v1",
  mean: "compensated-binary64-fixed-order-v1",
  standardDeviation: "sample-n-minus-one-compensated-binary64-v1",
  standardizedEffect: "observed-minus-null-mean-over-sample-sd-v1",
  missingSample: "invalidate-without-denominator-reduction-v1",
  zeroVariance: "null-z-with-observed-constant-relation-v1"
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
const ADMISSION_OPTION_FIELDS = Object.freeze([
  ...CANDIDATE_OPTION_FIELDS,
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "BASELINE_PACKAGE_NULL_MODELS",
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
      "PACKAGE_NULL_MODEL_BASELINE_OPTIONS_INVALID",
      "Null-model baseline options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_NULL_MODEL_BASELINE_OPTIONS_INVALID",
      "Null-model baseline options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_NULL_MODEL_BASELINE_OPTION_UNKNOWN",
      "Unknown null-model baseline option.",
      { unknown }
    );
  }
  return value;
}

function compensatedSum(values) {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    const next = sum + value;
    correction += Math.abs(sum) >= Math.abs(value)
      ? (sum - next) + value
      : (value - next) + sum;
    sum = next;
  }
  return sum + correction;
}

function cleanZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function sampleStatistics(values) {
  const mean = cleanZero(compensatedSum(values) / values.length);
  if (values.length < 2) return { mean, sd: null };
  const squaredDeviations = values.map((value) => {
    const difference = value - mean;
    return difference * difference;
  });
  const variance = compensatedSum(squaredDeviations) / (values.length - 1);
  return { mean, sd: cleanZero(Math.sqrt(Math.max(0, variance))) };
}

function metricState(value, interpretation) {
  return { value, status: interpretation.status, reasons: interpretation.reasons };
}

function observedMetrics(census, admission) {
  const localState = census.interpretation.status === "valid"
    ? { status: "valid", reasons: [] }
    : census.interpretation.status === "empty"
      ? { status: "empty", reasons: [...census.interpretation.reasons] }
      : {
          status: "indeterminate",
          reasons: [...census.interpretation.reasons]
        };
  const finalState = admission.status === "complete"
    ? { status: "valid", reasons: [] }
    : admission.status === "empty"
      ? { status: "empty", reasons: [...admission.interpretation.reasons] }
      : {
          status: "indeterminate",
          reasons: [...admission.interpretation.reasons]
        };
  const empty = (reason) => ({ status: "empty", reasons: [reason] });
  return {
    censusHash: census.censusHash,
    admissionHash: admission.admissionHash,
    metrics: {
      booleanSelectivity: metricState(census.booleanSelectivity, localState),
      variationalSelectivity: Object.fromEntries(admission.selectorCensus.map(
        (entry) => [entry.selectorId, metricState(
          entry.variationalSelectivity,
          entry.interpretation
        )]
      )),
      selectionRetention: metricState(
        admission.selectionRetention,
        admission.selectionRetention === null
          ? empty("no-eligible-candidates")
          : finalState
      ),
      overallRetention: metricState(
        admission.overallRetention,
        admission.overallRetention === null
          ? empty("no-evaluated-candidates")
          : finalState
      ),
      indeterminateRatio: metricState(
        admission.indeterminateRatio,
        admission.indeterminateRatio === null
          ? empty("no-evaluated-candidates")
          : finalState
      )
    }
  };
}

function summarizeMetric(model, metricId, observed, samples) {
  const ordered = [...samples].sort((left, right) =>
    compareStrings(left.trialId, right.trialId)
  );
  const unavailableSamples = ordered.filter((sample) =>
    typeof sample.value !== "number" ||
    !Number.isFinite(sample.value) ||
    !new Set(["valid", "fragile"]).has(sample.status)
  );
  let mean = null;
  let sd = null;
  let z = null;
  let constantRelation = null;
  const notes = [];
  if (unavailableSamples.length > 0) {
    notes.push("sample-metric-unavailable");
  } else {
    const statistics = sampleStatistics(ordered.map((sample) => sample.value));
    mean = statistics.mean;
    sd = statistics.sd;
    if (sd === null) {
      notes.push("sample-standard-deviation-requires-two-runs");
    } else if (sd === 0) {
      if (typeof observed.value !== "number") {
        constantRelation = "observed-unavailable";
        notes.push("zero-variance-observed-unavailable");
      } else if (observed.value === mean) {
        constantRelation = "equal";
        notes.push("zero-variance-observed-equals-null-constant");
      } else {
        constantRelation = "different";
        notes.push("zero-variance-observed-differs-from-null-constant");
      }
    } else if (
      typeof observed.value === "number" &&
      new Set(["valid", "fragile"]).has(observed.status)
    ) {
      z = cleanZero((observed.value - mean) / sd);
    }
  }
  const fragile = observed.status === "fragile" || ordered.some(
    (sample) => sample.status === "fragile"
  );
  const observedUnavailable =
    typeof observed.value !== "number" ||
    !new Set(["valid", "fragile"]).has(observed.status);
  if (fragile) notes.push("coefficient-sensitivity-fragile");
  if (observedUnavailable) notes.push("observed-metric-unavailable");
  const status = unavailableSamples.length > 0 || observedUnavailable
    ? "indeterminate"
    : fragile
      ? "fragile"
      : "complete";
  const basis = {
    model,
    metricId,
    expectedSamples: ordered.length,
    availableSamples: ordered.length - unavailableSamples.length,
    mean,
    sd,
    z,
    constantRelation,
    status,
    notes: [...new Set(notes)],
    sampleTrialIds: ordered.map((sample) => sample.trialId)
  };
  return {
    ...basis,
    distributionHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_DISTRIBUTION,
      basis
    )
  };
}

function scalarSamples(trials, metric) {
  return trials.map((trial) => ({
    trialId: trial.trialId,
    value: trial.metrics[metric],
    ...trial.metricInterpretation[metric]
  }));
}

function variationalSamples(trials, selectorId) {
  return trials.map((trial) => ({
    trialId: trial.trialId,
    value: trial.metrics.variationalSelectivity[selectorId],
    ...trial.metricInterpretation.variationalSelectivity[selectorId]
  }));
}

function modelBaseline(model, trials, observed, selectorOrder, samplesArtifact) {
  const booleanSelectivity = summarizeMetric(
    model,
    "booleanSelectivity",
    observed.metrics.booleanSelectivity,
    scalarSamples(trials, "booleanSelectivity")
  );
  const variationalSelectivity = Object.fromEntries(selectorOrder.map(
    (selectorId) => [selectorId, summarizeMetric(
      model,
      `variationalSelectivity:${selectorId}`,
      observed.metrics.variationalSelectivity[selectorId],
      variationalSamples(trials, selectorId)
    )]
  ));
  const selectionRetention = summarizeMetric(
    model,
    "selectionRetention",
    observed.metrics.selectionRetention,
    scalarSamples(trials, "selectionRetention")
  );
  const overallRetention = summarizeMetric(
    model,
    "overallRetention",
    observed.metrics.overallRetention,
    scalarSamples(trials, "overallRetention")
  );
  const indeterminateRatio = summarizeMetric(
    model,
    "indeterminateRatio",
    observed.metrics.indeterminateRatio,
    scalarSamples(trials, "indeterminateRatio")
  );
  const summaries = [
    booleanSelectivity,
    ...Object.values(variationalSelectivity),
    selectionRetention,
    overallRetention,
    indeterminateRatio
  ];
  const indeterminate = summaries.some(
    (summary) => summary.status !== "complete"
  );
  return {
    status: indeterminate ? "indeterminate" : "complete",
    runs: trials.length,
    metrics: {
      booleanSelectivity,
      variationalSelectivity,
      selectionRetention,
      overallRetention,
      indeterminateRatio
    },
    samplesArtifact,
    notes: indeterminate
      ? [...new Set(summaries.flatMap((summary) => summary.notes))]
      : []
  };
}

function createVerifiedBaseline(
  loadedPackage,
  census,
  admission,
  trialSelections
) {
  const observed = observedMetrics(census, admission);
  const selectorOrder = loadedPackage.normalized.selectors.map(
    (selector) => selector.id
  );
  const grouped = new Map();
  for (const trial of trialSelections.trials) {
    if (!grouped.has(trial.model)) grouped.set(trial.model, []);
    grouped.get(trial.model).push(trial);
  }
  const models = Object.fromEntries([...grouped.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([model, trials]) => [model, modelBaseline(
      model,
      trials,
      observed,
      selectorOrder,
      trialSelections.trialSelectionsHash
    )]));
  const notRun = trialSelections.status === "not-run";
  const indeterminateModels = Object.values(models).filter(
    (model) => model.status === "indeterminate"
  ).length;
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_NULL_MODEL_BASELINE_VERSION,
    scope: PACKAGE_NULL_MODEL_BASELINE_SCOPE,
    trialSelectionsHash: trialSelections.trialSelectionsHash,
    packageId: trialSelections.packageId,
    rulesHash: trialSelections.rulesHash,
    runConfigHash: trialSelections.runConfigHash,
    bindingHash: trialSelections.bindingHash,
    censusHash: trialSelections.censusHash,
    carrierHash: trialSelections.carrierHash,
    countingDomain: trialSelections.countingDomain,
    distributionPolicy: PACKAGE_NULL_MODEL_DISTRIBUTION_POLICY,
    observed,
    models,
    counts: {
      models: Object.keys(models).length,
      completeModels: Object.values(models).filter(
        (model) => model.status === "complete"
      ).length,
      indeterminateModels,
      trials: trialSelections.counts.trials
    },
    status: notRun
      ? "not-run"
      : indeterminateModels > 0
        ? "indeterminate"
        : "complete",
    interpretation: notRun
      ? { status: "not-run", reasons: ["null-models-disabled"] }
      : indeterminateModels > 0
        ? {
            status: "indeterminate",
            reasons: ["one-or-more-model-metrics-uninterpretable"]
          }
        : { status: "complete", reasons: [] }
  };
  return deepFreeze({
    ...basis,
    baselineHash: hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_BASELINE, basis)
  });
}

/** Summarizes an observed carrier against already verified null selections. */
export function evaluateVerifiedPackageNullModelBaseline(
  loadedPackage,
  census,
  admission,
  trialSelections
) {
  return createVerifiedBaseline(
    loadedPackage,
    census,
    admission,
    trialSelections
  );
}

function ensureAdmissionInput(input) {
  if (!isObject(input) || !Array.isArray(input.selectorExecutions)) {
    fail(
      "PACKAGE_NULL_MODEL_BASELINE_ADMISSION_INVALID",
      "Observed admission must embed its complete selector executions."
    );
  }
}

function verifyArtifact(input, reproduced) {
  let supplied;
  try {
    supplied = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_BASELINE_INVALID",
      "Null-model baseline is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NULL_MODEL_BASELINE_MISMATCH",
      "Null-model baseline differs from deterministic reproduction.",
      {
        expectedBaselineHash: reproduced.baselineHash,
        actualBaselineHash: isObject(supplied) &&
          typeof supplied.baselineHash === "string"
          ? supplied.baselineHash
          : null
      }
    );
  }
  return reproduced;
}

export function evaluatePackageNullModelBaseline(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  planInput,
  proposalsInput,
  trialCensusesInput,
  trialSelectionsInput,
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
  ensureAdmissionInput(admissionInput);
  const admission = verifyPackageSelectorAdmission(
    admissionInput,
    loadedPackage,
    runConfigInput,
    census,
    admissionInput.selectorExecutions,
    selectedOptions(normalized, ADMISSION_OPTION_FIELDS)
  );
  const selections = verifyPackageNullModelTrialSelections(
    trialSelectionsInput,
    loadedPackage,
    runConfigInput,
    census,
    planInput,
    proposalsInput,
    trialCensusesInput,
    normalized
  );
  return evaluateVerifiedPackageNullModelBaseline(
    loadedPackage,
    census,
    admission,
    selections
  );
}

export function evaluatePackageDepthNullModelBaseline(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  planInput,
  proposalsInput,
  trialCensusesInput,
  trialSelectionsInput,
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
  ensureAdmissionInput(admissionInput);
  const admission = verifyPackageDepthSelectorAdmission(
    admissionInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    admissionInput.selectorExecutions,
    selectedOptions(normalized, ADMISSION_OPTION_FIELDS)
  );
  const selections = verifyPackageDepthNullModelTrialSelections(
    trialSelectionsInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    planInput,
    proposalsInput,
    trialCensusesInput,
    normalized
  );
  return evaluateVerifiedPackageNullModelBaseline(
    loadedPackage,
    census,
    admission,
    selections
  );
}

export function verifyPackageNullModelBaseline(baselineInput, ...inputs) {
  return verifyArtifact(
    baselineInput,
    evaluatePackageNullModelBaseline(...inputs)
  );
}

export function verifyPackageDepthNullModelBaseline(baselineInput, ...inputs) {
  return verifyArtifact(
    baselineInput,
    evaluatePackageDepthNullModelBaseline(...inputs)
  );
}
