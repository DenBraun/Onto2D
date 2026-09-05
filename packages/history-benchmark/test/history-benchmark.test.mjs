import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildHistoryBenchmarkSuite, buildHistoryBenchmarkViews, contentHash, normalizeObservations, normalizeTargets,
  runHistoryBenchmark, validateHistoryBenchmarkContract, verifyHistoryBenchmarkResult
} from "../src/index.js";
import { buildPilot, run as verifyPilot } from "../../../cases/history-matters-reference/build.mjs";

const pilot = await buildPilot();
const fixture = () => structuredClone(pilot.entries[0]);
function rebind(entry) {
  entry.contract.bindings.observationsHash = contentHash("observations", normalizeObservations(entry.inputs.observations));
  entry.contract.bindings.targetsHash = contentHash("targets", normalizeTargets(entry.inputs.targets));
  return entry;
}

test("analytic controls preserve positive, negative, and neutral results with exact counts", () => {
  const [positive, negative, neutral] = pilot.entries.map(({ result }) => result);
  assert.equal(positive.verdict, "positive");
  assert.deepEqual(positive.primary.presentOnly, { errors: 16, pairs: 28, value: 4 / 7 });
  assert.deepEqual(positive.primary.presentPlusHistory, { errors: 0, pairs: 28, value: 0 });
  assert.equal(positive.nulls.trueHistoryBeatsNullMean, true);
  assert.equal(negative.verdict, "negative");
  assert.equal(negative.primary.presentOnly.errors, 0);
  assert.equal(negative.primary.presentPlusHistory.errors, 12);
  assert.equal(neutral.verdict, "neutral-within-resolution");
  assert.equal(neutral.primary.orientedGain, 0);
});

test("semantic cases retain census and regime boundaries, including metadata controls", () => {
  const [git, oci, builds] = pilot.entries.slice(3).map(({ result }) => result);
  assert.deepEqual([git.primary.presentOnly.errors, oci.primary.presentOnly.errors, builds.primary.presentOnly.errors], [6, 6, 2]);
  for (const result of [git, oci, builds]) {
    assert.equal(result.claimClass, "semantic");
    assert.equal(result.designClass, "exact");
    assert.equal(result.primary.presentPlusHistory.errors, 0);
    assert.equal(result.nulls.role, "diagnostic");
  }
  assert.equal(oci.nulls.trueHistoryBeatsNullMean, false);
});

test("unit order is irrelevant but source identity and temporal order remain bound", () => {
  const entry = fixture();
  entry.inputs.observations.units.reverse();
  entry.inputs.targets.records.reverse();
  assert.deepEqual(runHistoryBenchmark(entry.contract, entry.inputs), entry.result);
  const temporal = fixture();
  temporal.inputs.observations.units[0].history.reverse();
  rebind(temporal);
  const invalid = runHistoryBenchmark(temporal.contract, temporal.inputs);
  assert.equal(invalid.verdict, "invalid");
  assert.equal(invalid.issues[0].code, "HISTORY_ORDER");
});

test("target-only changes cannot change frozen P or H", () => {
  const entry = fixture();
  const before = buildHistoryBenchmarkViews(entry.contract, entry.inputs.observations);
  entry.inputs.targets.records[0].label = "new-outcome";
  rebind(entry);
  assert.deepEqual(buildHistoryBenchmarkViews(entry.contract, entry.inputs.observations), before);
  assert.notEqual(runHistoryBenchmark(entry.contract, entry.inputs).hash, entry.result.hash);
  entry.inputs.observations.units[0].target = "leaked";
  assert.throws(() => buildHistoryBenchmarkViews(entry.contract, entry.inputs.observations), { code: "SHAPE" });
});

test("duplicate IDs, undeclared fields and unsupported evaluator versions are rejected", () => {
  const duplicateUnit = fixture();
  duplicateUnit.inputs.observations.units[1].unitId = duplicateUnit.inputs.observations.units[0].unitId;
  assert.throws(() => normalizeObservations(duplicateUnit.inputs.observations), { code: "DUPLICATE_UNIT" });
  const duplicateTarget = fixture();
  duplicateTarget.inputs.targets.records[1].unitId = duplicateTarget.inputs.targets.records[0].unitId;
  assert.throws(() => normalizeTargets(duplicateTarget.inputs.targets), { code: "DUPLICATE_TARGET" });
  const unsupported = fixture();
  unsupported.contract.evaluator.version = "2";
  assert.throws(() => validateHistoryBenchmarkContract(unsupported.contract), { code: "UNSUPPORTED_EVALUATOR" });
  const unknownField = fixture();
  unknownField.contract.primaryMetric.selectedAfterEvaluation = true;
  assert.throws(() => validateHistoryBenchmarkContract(unknownField.contract), { code: "SHAPE" });
});

test("future history, present drift and target cutoff violations fail closed even when rehashed", () => {
  for (const [mutate, code] of [
    [(entry) => { entry.inputs.observations.units[0].history[1].time = 3; }, "FUTURE_HISTORY"],
    [(entry) => { entry.inputs.observations.units[0].present.time = 1; }, "PRESENT_CUTOFF"],
    [(entry) => { entry.inputs.targets.records[0].time = 2; }, "TARGET_CUTOFF"],
    [(entry) => { entry.inputs.targets.records.pop(); }, "TARGET_POPULATION"]
  ]) {
    const entry = fixture(); mutate(entry); rebind(entry);
    const result = runHistoryBenchmark(entry.contract, entry.inputs);
    assert.equal(result.verdict, "invalid");
    assert.equal(result.primary, null);
    assert.equal(result.issues[0].code, code);
  }
});

test("source, target, contract, evaluator, metric, seed and result tampering cannot replay", () => {
  for (const mutate of [
    (e) => { e.inputs.observations.units[0].history[0].value = "wrong"; },
    (e) => { e.inputs.observations.units[0].cutoff = 9; },
    (e) => { e.inputs.targets.records[0].label = "changed"; },
    (e) => { e.contract.evaluator.implementationHash = `sha256:${"0".repeat(64)}`; },
    (e) => { e.contract.sources[0].sha256 = `sha256:${"0".repeat(64)}`; },
    (e) => { e.contract.bindings.builderHash = `sha256:${"0".repeat(64)}`; },
    (e) => { e.contract.nullModel.seed += 1; },
    (e) => { e.contract.primaryMetric.resolution = 1; },
    (e) => { e.result.primary.presentPlusHistory.errors = 1; }
  ]) {
    const e = fixture(); mutate(e);
    assert.throws(() => verifyHistoryBenchmarkResult(e.result, e.contract, e.inputs), { code: "RESULT_REPLAY" });
  }
  for (const [field, value, code] of [["splitPolicy", "held-out", "UNSUPPORTED_SPLIT"], ["claimClass", "empirical", "UNSUPPORTED_CLAIM"]]) {
    const e = fixture(); e.contract[field] = value;
    assert.throws(() => runHistoryBenchmark(e.contract, e.inputs), { code });
  }
  const e = fixture(); e.contract.selectionPolicy.targetBlind = false;
  assert.throws(() => validateHistoryBenchmarkContract(e.contract), { code: "SELECTION_LEAKAGE" });
});

test("missing targets, singleton census and incomplete nulls are indeterminate, never neutral", () => {
  const e = fixture(); e.inputs.targets.records[0].label = null; rebind(e);
  assert.equal(runHistoryBenchmark(e.contract, e.inputs).verdict, "indeterminate");
  e.inputs.observations.units = e.inputs.observations.units.slice(0, 1);
  e.inputs.targets.records = e.inputs.targets.records.slice(0, 1); rebind(e);
  assert.equal(runHistoryBenchmark(e.contract, e.inputs).primary, null);
  const complete = fixture();
  for (const maxNullTrials of [0, 3]) {
    const result = runHistoryBenchmark(complete.contract, complete.inputs, { maxNullTrials });
    assert.equal(result.verdict, "indeterminate");
    assert.equal(result.nulls.status, "exhausted");
    assert.equal(result.nulls.trueHistoryBeatsNullMean, null);
    assert.deepEqual(verifyHistoryBenchmarkResult(result, complete.contract, complete.inputs, { maxNullTrials }), result);
  }
});

test("permutations preserve all histories and the frozen present; null failure stays visible", () => {
  const { contract, inputs, result } = fixture();
  const ids = inputs.observations.units.map((unit) => unit.unitId).sort();
  for (const trial of result.nulls.trials) assert.deepEqual([...trial.donorUnitIds].sort(), ids);
  const oci = structuredClone(pilot.entries[4]);
  oci.contract.nullModel.role = "require-better-than-null-mean";
  const inconclusive = runHistoryBenchmark(oci.contract, oci.inputs);
  assert.equal(inconclusive.verdict, "indeterminate");
  assert.equal(inconclusive.issues[0].code, "NULL_NOT_SEPARATED");
  assert.ok(Object.isFrozen(runHistoryBenchmark(contract, inputs).nulls.trials));
});

test("suite verifies membership, is permutation invariant, and has no global score", () => {
  assert.deepEqual(buildHistoryBenchmarkSuite([...pilot.entries].reverse()), pilot.suite);
  assert.deepEqual(Object.keys(pilot.suite).sort(), ["hash", "results", "schemaVersion", "suiteId"]);
  assert.throws(() => buildHistoryBenchmarkSuite([pilot.entries[0], pilot.entries[0]]), { code: "DUPLICATE_BENCHMARK" });
  const candidates = pilot.registry.entries.filter((entry) => entry.claimClass === "empirical");
  assert.equal(candidates.length, 2);
  for (const entry of candidates) assert.equal(entry.resultPath, null);
});

test("every pilot artifact conforms to its closed transport schema", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const names = ["contract", "observations", "view", "target", "split", "result", "suite", "registry"];
  const validators = Object.fromEntries(await Promise.all(names.map(async (name) => [name, ajv.compile(JSON.parse(await readFile(new URL(`../../schemas/schemas/history-benchmark-${name}.schema.json`, import.meta.url), "utf8")))])));
  for (const [file, value] of pilot.files) {
    let name = file.endsWith("history-benchmark-registry.json") ? "registry" : file.split("/").at(-1).replace(".json", "");
    if (name === "pilot") continue;
    if (name.endsWith("-view")) name = "view";
    if (name === "targets") name = "target";
    assert.ok(validators[name](value), `${file}: ${ajv.errorsText(validators[name].errors)}`);
  }
  const extra = { ...fixture().contract, undeclared: true };
  assert.equal(validators.contract(extra), false);
});

test("committed goldens and browser payload reproduce from exact source locks", async () => {
  await verifyPilot({ verify: true });
});

test("execution options reject malformed budgets without invoking accessors", () => {
  const { contract, inputs } = fixture();
  for (const options of [null, [], "", { maxNullTrials: null }, { maxNullTrials: -1 }, { unknown: 0 }]) {
    assert.throws(() => runHistoryBenchmark(contract, inputs, options), { code: "SHAPE" });
  }
  let reads = 0;
  const options = { get maxNullTrials() { reads += 1; return 0; } };
  assert.throws(() => runHistoryBenchmark(contract, inputs, options), { code: "CANONICALIZATION_ACCESSOR" });
  const envelope = { get observations() { reads += 1; return inputs.observations; }, targets: inputs.targets };
  assert.throws(() => runHistoryBenchmark(contract, envelope), { code: "CANONICALIZATION_ACCESSOR" });
  assert.equal(reads, 0);
});

test("source locks reject drive paths, URLs, traversal and control characters on every platform", async () => {
  const ajv = new Ajv2020({ strict: true });
  const validate = ajv.compile(JSON.parse(await readFile(new URL("../../schemas/schemas/history-benchmark-contract.schema.json", import.meta.url), "utf8")));
  for (const path of ["C:/outside.json", "C:outside.json", "https://example.org/source.json", "../source.json", "a/../source.json", "a\\source.json", "a/\u0000source.json", "a\n/source.json"]) {
    const { contract } = fixture(); contract.sources[0].path = path;
    assert.throws(() => validateHistoryBenchmarkContract(contract), { code: "SOURCE_PATH" });
    assert.equal(validate(contract), false, path);
  }
});
