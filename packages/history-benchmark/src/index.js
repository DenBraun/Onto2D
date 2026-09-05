import { canonicalClone, canonicalize, deepFreeze } from "@onto2d/kernel/canonical";
import {
  HistoryBenchmarkError, closed, compareIds, contentHash, normalizeObservations, normalizeTargets, nullTrialBudget,
  requireValue, validateHistoryBenchmarkContract
} from "./contract.js";
import { pairwiseError, partitionKeys, permuteHistories } from "./evaluate.js";

export {
  HISTORY_BENCHMARK_VERSION, HISTORY_BENCHMARK_VERDICTS, HISTORY_BENCHMARK_STATUSES,
  HistoryBenchmarkError, contentHash, normalizeObservations, normalizeTargets, validateHistoryBenchmarkContract
} from "./contract.js";

function artifact(kind, payload) {
  return deepFreeze({ ...payload, hash: contentHash(kind, payload) });
}

/** Deliberately accepts observations only. There is no target callback or target row in this stage. */
export function buildHistoryBenchmarkViews(contractInput, observationInput) {
  const contract = validateHistoryBenchmarkContract(contractInput);
  const observations = normalizeObservations(observationInput);
  requireValue(contentHash("observations", observations) === contract.bindings.observationsHash, "OBSERVATIONS_BINDING", "Observations differ from the frozen contract.");
  for (const unit of observations.units) {
    requireValue(unit.present.time === unit.cutoff, "PRESENT_CUTOFF", `Present observation is not at the cutoff for ${unit.unitId}.`);
    let previous = -1;
    for (const event of unit.history) {
      requireValue(event.time <= unit.cutoff, "FUTURE_HISTORY", `Post-cutoff history in ${unit.unitId}.`);
      requireValue(event.time > previous, "HISTORY_ORDER", `History is not strictly ordered in ${unit.unitId}.`);
      previous = event.time;
    }
  }
  const common = { schemaVersion: "1", observationsHash: contract.bindings.observationsHash, builderHash: contract.bindings.builderHash };
  const present = artifact("view", { ...common, role: "present", records: observations.units.map((unit) => ({
    unitId: unit.unitId, cutoff: unit.cutoff, events: [unit.present]
  })) });
  const history = artifact("view", { ...common, role: "history", records: observations.units.map((unit) => ({
    unitId: unit.unitId, cutoff: unit.cutoff, events: unit.history
  })) });
  const split = artifact("split", { schemaVersion: "1", strategy: "complete-census", unitIds: observations.units.map((unit) => unit.unitId) });
  return deepFreeze({ present, history, split });
}

export function runHistoryBenchmark(contractInput, inputs, options = {}) {
  const contract = validateHistoryBenchmarkContract(contractInput);
  inputs = canonicalClone(inputs);
  closed(inputs, ["observations", "targets"], "inputs");
  const budget = nullTrialBudget(options, contract.nullModel.trials);
  const observations = normalizeObservations(inputs.observations);
  const targets = normalizeTargets(inputs.targets);
  const issues = [];
  let views = null;
  try {
    views = buildHistoryBenchmarkViews(contract, observations);
    requireValue(contentHash("targets", targets) === contract.bindings.targetsHash, "TARGETS_BINDING", "Targets differ from the frozen contract.");
    requireValue(canonicalize(observations.units.map((unit) => unit.unitId)) === canonicalize(targets.records.map((row) => row.unitId)),
      "TARGET_POPULATION", "Target and observation populations must match exactly.");
    if (contract.effect === "future") {
      for (let i = 0; i < observations.units.length; i += 1) {
        requireValue(targets.records[i].time > observations.units[i].cutoff, "TARGET_CUTOFF", "Future targets must occur after the cutoff.");
      }
    }
  } catch (error) {
    if (!(error instanceof HistoryBenchmarkError)) throw error;
    issues.push({ code: error.code, message: error.message });
  }
  const base = {
    schemaVersion: "1", benchmarkId: contract.benchmarkId, caseId: contract.caseId,
    claimClass: contract.claimClass, designClass: contract.designClass,
    contractHash: contentHash("contract", contract),
    inputs: {
      observationsHash: contentHash("observations", observations), targetHash: contentHash("targets", targets),
      presentViewHash: views?.present.hash ?? null, historyViewHash: views?.history.hash ?? null,
      splitHash: views?.split.hash ?? null, evaluatorHash: contentHash("evaluator", contract.evaluator)
    },
    primary: null,
    nulls: { id: contract.nullModel.id, role: contract.nullModel.role, status: "not-evaluated", requestedTrials: contract.nullModel.trials, trials: [], meanError: null, trueHistoryBeatsNullMean: null },
    verdict: "invalid", issues,
    interpretationBoundary: contract.interpretationBoundary
  };
  if (issues.length > 0) return artifact("result", base);
  if (observations.units.length < 2 || targets.records.some((row) => row.label === null)) {
    base.verdict = "indeterminate";
    issues.push({ code: "INSUFFICIENT_TARGETS", message: "At least two units with complete target labels are required; missing is not zero." });
    return artifact("result", base);
  }
  const keys = partitionKeys(observations.units);
  const labels = targets.records.map((row) => row.label);
  const p0 = pairwiseError(keys.presentOnly, labels);
  const p1 = pairwiseError(keys.presentPlusHistory, labels);
  const gain = (p0.errors - p1.errors) / p0.pairs;
  base.primary = { metric: "pairwise-error", direction: "lower-is-better", presentOnly: p0, presentPlusHistory: p1, orientedGain: gain, resolution: contract.primaryMetric.resolution };
  for (let trial = 0; trial < Math.min(budget, contract.nullModel.trials); trial += 1) {
    const donors = permuteHistories(observations.units, contract.nullModel.seed, trial);
    const score = pairwiseError(partitionKeys(observations.units, donors).presentPlusHistory, labels);
    base.nulls.trials.push({ trial, donorUnitIds: donors.map((unit) => unit.unitId), ...score });
  }
  const complete = base.nulls.trials.length === contract.nullModel.trials;
  base.nulls.status = complete ? "complete" : "exhausted";
  if (base.nulls.trials.length > 0) {
    base.nulls.meanError = base.nulls.trials.reduce((sum, trial) => sum + trial.errors, 0) / (p0.pairs * base.nulls.trials.length);
  }
  if (complete) base.nulls.trueHistoryBeatsNullMean = base.nulls.meanError - p1.value > contract.primaryMetric.resolution;
  if (!complete) {
    base.verdict = "indeterminate";
    issues.push({ code: "NULL_EXHAUSTED", message: "The declared null ensemble did not complete." });
  } else if (gain > contract.primaryMetric.resolution) {
    base.verdict = contract.nullModel.role === "require-better-than-null-mean" && !base.nulls.trueHistoryBeatsNullMean ? "indeterminate" : "positive";
    if (base.verdict === "indeterminate") issues.push({ code: "NULL_NOT_SEPARATED", message: "True history did not beat the declared null mean beyond resolution." });
  } else if (gain < -contract.primaryMetric.resolution) base.verdict = "negative";
  else base.verdict = "neutral-within-resolution";
  return artifact("result", base);
}

export function verifyHistoryBenchmarkResult(result, contract, inputs, options = {}) {
  const expected = runHistoryBenchmark(contract, inputs, options);
  requireValue(canonicalize(result) === canonicalize(expected), "RESULT_REPLAY", "Benchmark result differs from exact replay.");
  return expected;
}

/** A portfolio of exact result references; no average of unlike case metrics. */
export function buildHistoryBenchmarkSuite(entries) {
  entries = canonicalClone(entries);
  requireValue(Array.isArray(entries), "SHAPE", "Suite entries must be an array.");
  const ids = new Set();
  const results = entries.map((entry) => {
    closed(entry, ["contract", "inputs", "result"], "suite entry");
    const result = verifyHistoryBenchmarkResult(entry.result, entry.contract, entry.inputs);
    requireValue(!ids.has(result.benchmarkId), "DUPLICATE_BENCHMARK", "Suite benchmark IDs must be unique.");
    ids.add(result.benchmarkId);
    return { benchmarkId: result.benchmarkId, claimClass: result.claimClass, designClass: result.designClass, verdict: result.verdict, resultHash: result.hash };
  }).sort((a, b) => compareIds(a.benchmarkId, b.benchmarkId));
  return artifact("suite", { schemaVersion: "1", suiteId: "history-matters-pilot", results });
}
