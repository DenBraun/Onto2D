import { canonicalClone, canonicalize, deepFreeze, isContentHash } from "@onto2d/kernel/canonical";
import { closed, compareIds, contentHash, integer, nonempty, nullTrialBudget, requireValue } from "./contract.js";

const VIEWS = Object.freeze(["P0", "P1", "P0Age", "P1Age"]);
function bounded(value, label) {
  requireValue(Number.isFinite(value) && Math.abs(value) <= 1e12, "NUMERIC_INPUT", `${label} must be finite and within ±1e12.`);
}
function envelope(kind, value) { return deepFreeze({ ...value, hash: contentHash(kind, value) }); }

export function normalizeRegressionDataset(input) {
  const data = canonicalClone(input);
  closed(data, ["schemaVersion", "presentFeatures", "historyFeatures", "samples"], "regression dataset");
  requireValue(data.schemaVersion === "1", "VERSION", "Unsupported regression dataset.");
  for (const key of ["presentFeatures", "historyFeatures"]) {
    requireValue(Array.isArray(data[key]) && data[key].length > 0 && data[key].length <= 128, "SHAPE", "Feature names must have 1–128 entries.");
    data[key].forEach((name) => nonempty(name, key));
    requireValue(new Set(data[key]).size === data[key].length, "SHAPE", "Feature names must be unique within each view.");
  }
  requireValue(Array.isArray(data.samples), "SHAPE", "Samples must be an array.");
  integer(data.samples.length, 2, 16384, "sample count");
  const ids = new Set();
  for (const row of data.samples) {
    closed(row, ["sampleId", "unitId", "split", "cutoff", "presentTime", "historyStart", "historyEnd", "present", "history", "recordHash"], "sample");
    nonempty(row.sampleId, "sampleId"); nonempty(row.unitId, "unitId");
    requireValue(!ids.has(row.sampleId), "DUPLICATE_SAMPLE", "Duplicate sample ID."); ids.add(row.sampleId);
    requireValue(["train", "test"].includes(row.split), "SHAPE", "Split must be train or test.");
    requireValue(isContentHash(row.recordHash), "SHAPE", "Raw observation prefix must be hash-bound.");
    for (const field of ["cutoff", "presentTime", "historyStart", "historyEnd"]) integer(row[field], 0, 1e9, field);
    for (const [key, names] of [["present", data.presentFeatures], ["history", data.historyFeatures]]) {
      requireValue(Array.isArray(row[key]) && row[key].length === names.length, "SHAPE", `${key} feature dimension mismatch.`);
      row[key].forEach((value) => bounded(value, key));
    }
  }
  data.samples.sort((a, b) => compareIds(a.sampleId, b.sampleId));
  return deepFreeze(data);
}

export function normalizeRegressionTargets(input) {
  const targets = canonicalClone(input);
  closed(targets, ["schemaVersion", "records"], "regression targets");
  requireValue(targets.schemaVersion === "1" && Array.isArray(targets.records), "SHAPE", "Invalid target envelope.");
  integer(targets.records.length, 1, 16384, "target count");
  const ids = new Set();
  for (const row of targets.records) {
    closed(row, ["sampleId", "value"], "target"); nonempty(row.sampleId, "target.sampleId");
    requireValue(!ids.has(row.sampleId), "DUPLICATE_TARGET", "Duplicate target ID."); ids.add(row.sampleId);
    if (row.value !== null) {
      bounded(row.value, "target.value");
      requireValue(row.value >= 0, "NUMERIC_INPUT", "Remaining duration must be non-negative.");
    }
  }
  targets.records.sort((a, b) => compareIds(a.sampleId, b.sampleId));
  return deepFreeze(targets);
}

export function validateHistoryRegressionContract(input) {
  const c = canonicalClone(input);
  closed(c, ["schemaVersion", "benchmarkId", "caseId", "claimClass", "designClass", "historyMode", "effect", "population",
    "presentView", "historyView", "targetView", "splitPolicy", "preprocessing", "evaluator", "primaryMetric", "secondaryMetrics", "nullModel", "bindings", "interpretationBoundary"], "regression contract");
  requireValue(c.schemaVersion === "1", "VERSION", "Unsupported regression contract.");
  requireValue(["synthetic", "empirical"].includes(c.claimClass) && c.designClass === "predictive" && c.effect === "future", "UNSUPPORTED_DESIGN", "Only synthetic or empirical predictive duration contrasts are supported.");
  requireValue(["recorded", "embodied", "reconstructed"].includes(c.historyMode), "SHAPE", "Unknown history mode.");
  for (const field of ["benchmarkId", "caseId", "population", "presentView", "historyView", "targetView", "interpretationBoundary"]) nonempty(c[field], field);
  requireValue(c.splitPolicy === "unit-disjoint" && c.preprocessing === "training-min-max-no-clipping", "UNSUPPORTED_PROTOCOL", "Unsupported split or normalization policy.");
  closed(c.evaluator, ["id", "neighbors", "tieBreak", "implementationHash"], "evaluator");
  requireValue(c.evaluator.id === "unit-nearest-neighbor-regression-v1" && c.evaluator.tieBreak === "sample-id", "UNSUPPORTED_EVALUATOR", "Unsupported regression evaluator.");
  integer(c.evaluator.neighbors, 1, 64, "neighbors");
  requireValue(isContentHash(c.evaluator.implementationHash), "SHAPE", "Evaluator implementation must be hash-bound.");
  closed(c.primaryMetric, ["id", "resolution", "units"], "primaryMetric");
  requireValue(c.primaryMetric.id === "mae" && c.primaryMetric.units === "cycles", "UNSUPPORTED_METRIC", "Only MAE in cycles is supported.");
  bounded(c.primaryMetric.resolution, "resolution");
  requireValue(c.primaryMetric.resolution >= 0, "SHAPE", "Resolution cannot be negative.");
  requireValue(canonicalize(c.secondaryMetrics) === '["rmse"]', "UNSUPPORTED_METRIC", "RMSE must be the declared secondary metric.");
  closed(c.nullModel, ["id", "seed", "trials", "stratum"], "nullModel");
  requireValue(c.nullModel.id === "test-history-permutation-v1" && c.nullModel.stratum === "one-declared-population", "UNSUPPORTED_NULL", "This profile supports a single predeclared test permutation stratum.");
  integer(c.nullModel.seed, 0, 4294967295, "seed"); integer(c.nullModel.trials, 1, 256, "trials");
  closed(c.bindings, ["datasetHash", "trainingTargetsHash", "heldOutTargetSourceHash", "builderHash", "protocolHash"], "bindings");
  for (const value of Object.values(c.bindings)) requireValue(isContentHash(value), "SHAPE", "Every regression input must be hash-bound.");
  return deepFreeze(c);
}

function verifyPopulation(data, targets, k) {
  const units = new Map(); const records = new Map(); const testUnits = new Set();
  for (const row of data.samples) {
    requireValue(row.presentTime === row.cutoff, "PRESENT_CUTOFF", "Present observation must be at cutoff.");
    requireValue(row.historyStart <= row.historyEnd && row.historyEnd < row.cutoff, "FUTURE_HISTORY", "History must precede the present cutoff.");
    requireValue(!units.has(row.unitId) || units.get(row.unitId) === row.split, "UNIT_LEAKAGE", "A physical unit cannot cross training/test splits.");
    requireValue(!records.has(row.recordHash) || records.get(row.recordHash) === row.split, "DUPLICATE_SPLIT_RECORD", "A source observation prefix is duplicated across splits.");
    units.set(row.unitId, row.split); records.set(row.recordHash, row.split);
    if (row.split === "test") {
      requireValue(!testUnits.has(row.unitId), "TEST_UNIT_REPEATED", "Exactly one held-out endpoint per test unit is supported."); testUnits.add(row.unitId);
    }
  }
  const train = data.samples.filter((row) => row.split === "train");
  const test = data.samples.filter((row) => row.split === "test");
  requireValue(train.length > 0 && test.length > 0 && new Set(train.map((row) => row.unitId)).size >= k, "INSUFFICIENT_TRAINING", "Both splits and at least k distinct training units are required.");
  requireValue(canonicalize(train.map((row) => row.sampleId)) === canonicalize(targets.records.map((row) => row.sampleId)), "TRAINING_TARGET_POPULATION", "Training labels must match only training samples, exactly.");
  requireValue(targets.records.every((row) => row.value !== null), "MISSING_TRAINING_TARGET", "This profile does not impute missing training targets.");
  return { train, test };
}

function ranges(rows, key, count) {
  return Array.from({ length: count }, (_, index) => {
    let minimum = Infinity; let maximum = -Infinity;
    for (const row of rows) { const value = key === "age" ? row.cutoff : row[key][index]; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
    return { minimum, maximum, active: maximum > minimum };
  });
}
function scaled(value, range) {
  if (!range.active) return 0;
  const result = (value - range.minimum) / (range.maximum - range.minimum);
  requireValue(Number.isFinite(result) && Math.abs(result) <= 1e100, "NUMERIC_RANGE", "Normalized feature exceeds finite distance limits.");
  return result;
}
function vector(row, normalization, view, donor = row) {
  const output = row.present.map((v, i) => scaled(v, normalization.present[i]));
  if (view.startsWith("P1")) output.push(...donor.history.map((v, i) => scaled(v, normalization.history[i])));
  if (view.endsWith("Age")) output.push(scaled(row.cutoff, normalization.age[0]));
  return output;
}
function predict(train, test, labels, normalization, view, k, donors = test) {
  const candidates = train.map((row) => ({ row, features: vector(row, normalization, view) }));
  return test.map((row, index) => {
    const features = vector(row, normalization, view, donors[index]);
    const nearest = new Map();
    for (const candidate of candidates) {
      const distance = features.reduce((sum, v, j) => sum + (v - candidate.features[j]) ** 2, 0);
      requireValue(Number.isFinite(distance), "NUMERIC_RANGE", "Distance overflow.");
      const previous = nearest.get(candidate.row.unitId);
      if (!previous || distance < previous.distance || (distance === previous.distance && compareIds(candidate.row.sampleId, previous.sampleId) < 0)) {
        nearest.set(candidate.row.unitId, { sampleId: candidate.row.sampleId, unitId: candidate.row.unitId, distance, value: labels.get(candidate.row.sampleId) });
      }
    }
    const neighbors = [...nearest.values()].sort((a, b) => a.distance - b.distance || compareIds(a.sampleId, b.sampleId)).slice(0, k);
    return { sampleId: row.sampleId, value: neighbors.reduce((sum, n) => sum + n.value, 0) / k, neighbors };
  });
}

/** The preparation stage has no parameter for held-out outcomes. */
export function prepareHistoryRegression(contractInput, datasetInput, trainingTargetInput, options = {}) {
  const contract = validateHistoryRegressionContract(contractInput);
  const budget = nullTrialBudget(options, contract.nullModel.trials);
  const data = normalizeRegressionDataset(datasetInput); const targets = normalizeRegressionTargets(trainingTargetInput);
  requireValue(contentHash("regression-dataset", data) === contract.bindings.datasetHash, "REGRESSION_DATA_BINDING", "Regression data differ from the contract.");
  requireValue(contentHash("regression-targets", targets) === contract.bindings.trainingTargetsHash, "TRAINING_TARGET_BINDING", "Training labels differ from the contract.");
  const { train, test } = verifyPopulation(data, targets, contract.evaluator.neighbors);
  const trialCount = Math.min(budget, contract.nullModel.trials);
  const components = (4 + trialCount) * data.presentFeatures.length + (2 + trialCount) * data.historyFeatures.length + 2;
  requireValue(train.length * test.length * components <= 250000000, "REGRESSION_BUDGET", "Preparation exceeds the fixed 250 million distance-component budget; no scientific verdict is produced.");
  const labels = new Map(targets.records.map((row) => [row.sampleId, row.value]));
  const normalization = { present: ranges(train, "present", data.presentFeatures.length), history: ranges(train, "history", data.historyFeatures.length), age: ranges(train, "age", 1) };
  const views = Object.fromEntries(VIEWS.map((view) => [view, predict(train, test, labels, normalization, view, contract.evaluator.neighbors)]));
  const trials = [];
  for (let trial = 0; trial < Math.min(budget, contract.nullModel.trials); trial += 1) {
    const donors = test.map((row) => ({ row, priority: contentHash("regression-permutation", { seed: contract.nullModel.seed, trial, sampleId: row.sampleId }) }))
      .sort((a, b) => compareIds(a.priority, b.priority) || compareIds(a.row.sampleId, b.row.sampleId)).map(({ row }) => row);
    trials.push({ trial, donorSampleIds: donors.map((row) => row.sampleId), predictions: predict(train, test, labels, normalization, "P1", contract.evaluator.neighbors, donors) });
  }
  return envelope("regression-preparation", {
    schemaVersion: "1", benchmarkId: contract.benchmarkId, contractHash: contentHash("regression-contract", contract),
    status: trials.length === contract.nullModel.trials ? "prepared" : "incomplete",
    counts: { trainingSamples: train.length, trainingUnits: new Set(train.map((r) => r.unitId)).size, testSamples: test.length, testUnits: test.length },
    normalization, views, nulls: { status: trials.length === contract.nullModel.trials ? "complete" : "exhausted", requestedTrials: contract.nullModel.trials, trials }
  });
}

export function verifyHistoryRegressionPreparation(value, contract, data, targets, options = {}) {
  const expected = prepareHistoryRegression(contract, data, targets, options);
  requireValue(canonicalize(value) === canonicalize(expected), "REGRESSION_REPLAY", "Prediction preparation differs from exact replay.");
  return expected;
}

function metric(predictions, targets) {
  const absoluteErrors = predictions.map((row, i) => Math.abs(row.value - targets[i].value));
  // Scale before squaring: tiny errors must not underflow to a perfect score,
  // and roundoff must not put RMSE above the largest observed absolute error.
  const maximum = absoluteErrors.reduce((largest, value) => Math.max(largest, value), 0);
  const rmse = maximum === 0 ? 0 : maximum * Math.sqrt(absoluteErrors.reduce((sum, value) => sum + (value / maximum) ** 2, 0) / absoluteErrors.length);
  return { count: absoluteErrors.length, mae: absoluteErrors.reduce((a, b) => a + b, 0) / absoluteErrors.length,
    rmse };
}

/** Scoring is separate from preparation; case-level evidence review remains external. */
export function scoreHistoryRegression(contractInput, data, trainingTargets, heldOutTargetInput, options = {}) {
  const contract = validateHistoryRegressionContract(contractInput);
  const preparation = prepareHistoryRegression(contract, data, trainingTargets, options);
  const targets = normalizeRegressionTargets(heldOutTargetInput);
  requireValue(canonicalize(preparation.views.P0.map((r) => r.sampleId)) === canonicalize(targets.records.map((r) => r.sampleId)), "TEST_TARGET_POPULATION", "Held-out labels must match every test endpoint exactly.");
  const result = { schemaVersion: "1", benchmarkId: contract.benchmarkId, claimClass: contract.claimClass, preparationHash: preparation.hash,
    targetHash: contentHash("regression-targets", targets), primary: null, ageSensitivity: null,
    nulls: { status: preparation.nulls.status, trialMae: [], meanMae: null, trueHistoryBeatsNullMean: null },
    verdict: "indeterminate", interpretationBoundary: contract.interpretationBoundary };
  if (targets.records.some((row) => row.value === null)) return envelope("regression-result", result);
  const scores = Object.fromEntries(VIEWS.map((view) => [view, metric(preparation.views[view], targets.records)]));
  result.primary = { metric: "mae", units: "cycles", presentOnly: scores.P0, presentPlusHistory: scores.P1, orientedGain: scores.P0.mae - scores.P1.mae, resolution: contract.primaryMetric.resolution };
  result.ageSensitivity = { presentWithAge: scores.P0Age, presentWithAgeAndHistory: scores.P1Age, orientedGain: scores.P0Age.mae - scores.P1Age.mae };
  result.nulls.trialMae = preparation.nulls.trials.map((trial) => metric(trial.predictions, targets.records).mae);
  if (result.nulls.trialMae.length) result.nulls.meanMae = result.nulls.trialMae.reduce((a, b) => a + b, 0) / result.nulls.trialMae.length;
  if (preparation.status !== "prepared") return envelope("regression-result", result);
  result.nulls.trueHistoryBeatsNullMean = result.nulls.meanMae - scores.P1.mae > contract.primaryMetric.resolution;
  const gain = result.primary.orientedGain;
  result.verdict = gain < -contract.primaryMetric.resolution ? "negative" : gain > contract.primaryMetric.resolution
    ? result.nulls.trueHistoryBeatsNullMean ? "positive" : "indeterminate" : "neutral-within-resolution";
  return envelope("regression-result", result);
}
