import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { contentHash } from "../src/index.js";
import {
  normalizeRegressionDataset, normalizeRegressionTargets, prepareHistoryRegression,
  verifyHistoryRegressionPreparation, scoreHistoryRegression
} from "../src/predictive.js";

export function reference() {
  const sample = (id, split, p, h, cutoff = 20) => ({ sampleId: id, unitId: id, split, cutoff,
    presentTime: cutoff, historyStart: 1, historyEnd: cutoff - 1, present: [p], history: [h], recordHash: contentHash("regression-source-record", { id }) });
  const data = { schemaVersion: "1", presentFeatures: ["current"], historyFeatures: ["prior-mean"], samples: [
    sample("train-a", "train", 0, 0), sample("train-b", "train", 0, 10),
    sample("test-a", "test", 0, 0), sample("test-b", "test", 0, 10)
  ] };
  const targets = { schemaVersion: "1", records: [{ sampleId: "train-a", value: 10 }, { sampleId: "train-b", value: 30 }] };
  const contract = {
    schemaVersion: "1", benchmarkId: "regression-reference", caseId: "reference", claimClass: "synthetic",
    designClass: "predictive", historyMode: "recorded", effect: "future",
    population: "Two training and two test units; synthetic control.",
    presentView: "Current scalar.", historyView: "Prior scalar.", targetView: "Separate synthetic outcome.",
    splitPolicy: "unit-disjoint", preprocessing: "training-min-max-no-clipping",
    evaluator: { id: "unit-nearest-neighbor-regression-v1", neighbors: 1, tieBreak: "sample-id", implementationHash: `sha256:${"1".repeat(64)}` },
    primaryMetric: { id: "mae", resolution: 0, units: "cycles" }, secondaryMetrics: ["rmse"],
    nullModel: { id: "test-history-permutation-v1", seed: 1729, trials: 4, stratum: "one-declared-population" },
    bindings: { datasetHash: "", trainingTargetsHash: "", heldOutTargetSourceHash: `sha256:${"2".repeat(64)}`, builderHash: `sha256:${"3".repeat(64)}`, protocolHash: `sha256:${"4".repeat(64)}` },
    interpretationBoundary: "Synthetic regression fixture, not empirical evidence."
  };
  return bind({ contract, data, targets });
}
function bind(f) {
  f.contract.bindings.datasetHash = contentHash("regression-dataset", normalizeRegressionDataset(f.data));
  f.contract.bindings.trainingTargetsHash = contentHash("regression-targets", normalizeRegressionTargets(f.targets));
  return f;
}

test("nearest-neighbor preparation uses training labels only and history resolves a held-out control", () => {
  const f = reference();
  const prepared = prepareHistoryRegression(f.contract, f.data, f.targets);
  assert.deepEqual(prepared.views.P0.map((r) => r.value), [10, 10]);
  assert.deepEqual(prepared.views.P1.map((r) => r.value), [10, 30]);
  assert.deepEqual(prepared.views.P0Age.map((r) => r.value), [10, 10]);
  assert.equal(prepared.status, "prepared");
  const scores = scoreHistoryRegression(f.contract, f.data, f.targets, {
    schemaVersion: "1", records: [{ sampleId: "test-a", value: 10 }, { sampleId: "test-b", value: 30 }]
  });
  assert.equal(scores.primary.presentOnly.mae, 10);
  assert.equal(scores.primary.presentPlusHistory.mae, 0);
  assert.equal(scores.primary.orientedGain, 10);
  assert.ok(Object.isFrozen(prepared.views.P1));
});

test("test extremes cannot change normalization; held-out target changes cannot change predictions", () => {
  const f = reference(); const before = prepareHistoryRegression(f.contract, f.data, f.targets);
  f.data.samples.find((r) => r.sampleId === "test-b").history[0] = 1000; bind(f);
  const after = prepareHistoryRegression(f.contract, f.data, f.targets);
  assert.deepEqual(after.normalization, before.normalization);
  assert.equal(after.normalization.history[0].maximum, 10);
  const first = scoreHistoryRegression(f.contract, f.data, f.targets, { schemaVersion: "1", records: [{ sampleId: "test-a", value: 10 }, { sampleId: "test-b", value: 30 }] });
  const second = scoreHistoryRegression(f.contract, f.data, f.targets, { schemaVersion: "1", records: [{ sampleId: "test-a", value: 90 }, { sampleId: "test-b", value: 80 }] });
  assert.equal(first.preparationHash, second.preparationHash);
  assert.notEqual(first.hash, second.hash);
});

test("same-unit prefixes cannot cross splits or occupy multiple neighbor positions", () => {
  const f = reference();
  f.data.samples[2].unitId = "train-a"; bind(f);
  assert.throws(() => prepareHistoryRegression(f.contract, f.data, f.targets), { code: "UNIT_LEAKAGE" });
  const g = reference();
  g.data.samples.push({ ...g.data.samples[0], sampleId: "train-a-prefix", cutoff: 30, presentTime: 30 });
  g.targets.records.push({ sampleId: "train-a-prefix", value: 10 }); g.contract.evaluator.neighbors = 2; bind(g);
  const output = prepareHistoryRegression(g.contract, g.data, g.targets);
  assert.deepEqual(output.views.P1[0].neighbors.map((r) => r.unitId).sort(), ["train-a", "train-b"]);
  assert.equal(output.views.P1[0].value, 20);
});

test("population joins, future leakage, duplicate records and leaked target fields fail closed", () => {
  for (const [mutate, code] of [
    [(f) => { f.data.samples[0].historyEnd = 21; }, "FUTURE_HISTORY"],
    [(f) => { f.data.samples[0].presentTime = 19; }, "PRESENT_CUTOFF"],
    [(f) => { f.targets.records[0].sampleId = "test-a"; }, "TRAINING_TARGET_POPULATION"],
    [(f) => { f.data.samples[2].recordHash = f.data.samples[0].recordHash; }, "DUPLICATE_SPLIT_RECORD"]
  ]) {
    const f = reference(); mutate(f); bind(f);
    assert.throws(() => prepareHistoryRegression(f.contract, f.data, f.targets), { code });
  }
  const f = reference(); f.data.samples[0].target = 99;
  assert.throws(() => normalizeRegressionDataset(f.data), { code: "SHAPE" });
  const g = reference(); g.targets.records.push(g.targets.records[0]);
  assert.throws(() => normalizeRegressionTargets(g.targets), { code: "DUPLICATE_TARGET" });
});

test("input ordering, ties, null assignments and exact replay are deterministic", () => {
  const f = reference(); const expected = prepareHistoryRegression(f.contract, f.data, f.targets);
  f.data.samples.reverse(); f.targets.records.reverse();
  assert.deepEqual(prepareHistoryRegression(f.contract, f.data, f.targets), expected);
  for (const trial of expected.nulls.trials) assert.deepEqual([...trial.donorSampleIds].sort(), ["test-a", "test-b"]);
  const changed = structuredClone(expected); changed.views.P1[0].value += 1;
  assert.throws(() => verifyHistoryRegressionPreparation(changed, f.contract, f.data, f.targets), { code: "REGRESSION_REPLAY" });
  f.contract.nullModel.seed += 1;
  assert.throws(() => verifyHistoryRegressionPreparation(expected, f.contract, f.data, f.targets), { code: "REGRESSION_REPLAY" });
});

test("missing outcomes and exhausted null budgets never become neutral evidence", () => {
  const f = reference();
  const targets = { schemaVersion: "1", records: [{ sampleId: "test-a", value: null }, { sampleId: "test-b", value: 30 }] };
  assert.equal(scoreHistoryRegression(f.contract, f.data, f.targets, targets).verdict, "indeterminate");
  const prepared = prepareHistoryRegression(f.contract, f.data, f.targets, { maxNullTrials: 0 });
  assert.equal(prepared.status, "incomplete");
  assert.equal(prepared.nulls.status, "exhausted");
  targets.records[0].value = 10;
  const result = scoreHistoryRegression(f.contract, f.data, f.targets, targets, { maxNullTrials: 0 });
  assert.equal(result.verdict, "indeterminate");
  assert.equal(result.nulls.meanMae, null);
});

test("regression retains harmful history, neutral history, and age-sufficient baselines", () => {
  const outcomes = { schemaVersion: "1", records: [{ sampleId: "test-a", value: 10 }, { sampleId: "test-b", value: 30 }] };
  const bad = reference(); bad.data.samples[2].history = [10]; bad.data.samples[3].history = [0]; bind(bad);
  assert.equal(scoreHistoryRegression(bad.contract, bad.data, bad.targets, outcomes).verdict, "negative");
  const neutral = reference(); neutral.data.samples.forEach((row) => { row.history = [0]; }); bind(neutral);
  assert.equal(scoreHistoryRegression(neutral.contract, neutral.data, neutral.targets, outcomes).verdict, "neutral-within-resolution");
  const age = reference();
  for (const row of age.data.samples.filter((row) => row.sampleId.endsWith("b"))) { row.cutoff = 40; row.presentTime = 40; }
  bind(age);
  const result = scoreHistoryRegression(age.contract, age.data, age.targets, outcomes);
  assert.equal(result.primary.orientedGain, 10);
  assert.equal(result.ageSensitivity.presentWithAge.mae, 0);
  assert.equal(result.ageSensitivity.orientedGain, 0);
});

test("regression transport schemas validate preparation and scored synthetic artifacts", async () => {
  const f = reference();
  const preparation = prepareHistoryRegression(f.contract, f.data, f.targets);
  const result = scoreHistoryRegression(f.contract, f.data, f.targets, { schemaVersion: "1", records: [{ sampleId: "test-a", value: 10 }, { sampleId: "test-b", value: 30 }] });
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  for (const [name, value] of Object.entries({ contract: f.contract, dataset: f.data, targets: f.targets, preparation, result })) {
    const schema = JSON.parse(await readFile(new URL(`../../schemas/schemas/history-regression-${name}.schema.json`, import.meta.url), "utf8"));
    const validate = ajv.compile(schema);
    assert.ok(validate(value), ajv.errorsText(validate.errors));
    assert.equal(validate({ ...value, undeclared: true }), false);
  }
});

test("the declared workload limit rejects excessive runs before distance evaluation", () => {
  const f = reference();
  f.contract.nullModel.trials = 256;
  f.data.presentFeatures = Array.from({ length: 128 }, (_, i) => `p${i}`);
  f.data.historyFeatures = Array.from({ length: 128 }, (_, i) => `h${i}`);
  f.data.samples = ["train", "test"].flatMap((split) => Array.from({ length: 100 }, (_, i) => ({
    sampleId: `${split}-${i}`, unitId: `${split}-${i}`, split, cutoff: 20, presentTime: 20,
    historyStart: 1, historyEnd: 19, present: Array(128).fill(i), history: Array(128).fill(i),
    recordHash: contentHash("regression-source-record", { split, i })
  })));
  f.targets.records = f.data.samples.filter((row) => row.split === "train").map((row) => ({ sampleId: row.sampleId, value: 10 }));
  bind(f);
  assert.throws(() => prepareHistoryRegression(f.contract, f.data, f.targets), { code: "REGRESSION_BUDGET" });
});

test("regression options reject malformed budgets without invoking accessors", () => {
  const f = reference();
  for (const options of [null, [], "", { maxNullTrials: null }, { maxNullTrials: -1 }, { unknown: 0 }]) {
    assert.throws(() => prepareHistoryRegression(f.contract, f.data, f.targets, options), { code: "SHAPE" });
  }
  let reads = 0;
  assert.throws(() => prepareHistoryRegression(f.contract, f.data, f.targets, { get maxNullTrials() { reads += 1; return 0; } }), { code: "CANONICALIZATION_ACCESSOR" });
  assert.equal(reads, 0);
});

test("RMSE preserves tiny errors and stays within the declared numeric transport range", async () => {
  const f = reference();
  const template = f.data.samples[2];
  f.data.samples = [f.data.samples[0], ...Array.from({ length: 28 }, (_, i) => ({
    ...template, sampleId: `test-${i}`, unitId: `test-${i}`, recordHash: contentHash("record", i)
  }))];
  f.targets.records = [{ sampleId: "train-a", value: 0 }];
  f.contract.nullModel.trials = 1;
  bind(f);
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(JSON.parse(await readFile(new URL("../../schemas/schemas/history-regression-result.schema.json", import.meta.url), "utf8")));
  for (const value of [1e12, 1e-200, 0]) {
    const outcomes = { schemaVersion: "1", records: f.data.samples.filter((row) => row.split === "test").map((row) => ({ sampleId: row.sampleId, value })) };
    const result = scoreHistoryRegression(f.contract, f.data, f.targets, outcomes);
    assert.equal(result.primary.presentOnly.rmse, value);
    assert.ok(validate(result), ajv.errorsText(validate.errors));
  }
});

test("hand-calculated distances select distinct units across all four views", () => {
  const f = reference();
  const sample = (sampleId, unitId, split, p, h, cutoff) => ({ sampleId, unitId, split, cutoff,
    presentTime: cutoff, historyStart: 1, historyEnd: cutoff - 1, present: [p], history: [h], recordHash: contentHash("record", sampleId) });
  f.data.samples = [sample("a", "u1", "train", 0, 0, 20), sample("b", "u1", "train", 2, 2, 40),
    sample("c", "u2", "train", 4, 4, 60), sample("d", "u3", "train", 8, 8, 80), sample("test", "held-out", "test", 3, 8, 100)];
  f.targets.records = [80, 60, 40, 20].map((value, i) => ({ sampleId: "abcd"[i], value }));
  f.contract.evaluator.neighbors = 2;
  bind(f);
  const { views } = prepareHistoryRegression(f.contract, f.data, f.targets);
  assert.deepEqual(Object.values(views).map((rows) => rows[0].value), [50, 30, 30, 30]);
  assert.deepEqual(views.P0[0].neighbors.map((row) => row.sampleId), ["b", "c"]);
  assert.deepEqual(views.P1[0].neighbors.map((row) => row.sampleId), ["c", "d"]);
  assert.deepEqual(views.P1[0].neighbors.map((row) => row.distance), [17 / 64, 25 / 64]);
  assert.deepEqual(views.P1Age[0].neighbors.map((row) => row.sampleId), ["d", "c"]);
});
