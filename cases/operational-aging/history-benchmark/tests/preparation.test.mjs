import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseFd001Observations, projectFd001Observations, buildFd001TrainingTargets } from "../source-projection.mjs";
import { buildFd001Preparation, validateFd001Protocol } from "../build.mjs";

const protocol = JSON.parse(await readFile(new URL("../protocol.json", import.meta.url), "utf8"));

test("full FD001 preparation replays every eligible unit without held-out outcomes", async () => {
  const { files, readiness, dataset, trainingTargets, preparation } = await buildFd001Preparation();
  for (const [relative, value] of files) assert.equal(await readFile(new URL(`../../../../${relative}`, import.meta.url), "utf8"), `${JSON.stringify(value, null, 2)}\n`);
  assert.deepEqual(readiness.sourceCounts, { trainingUnits: 100, testUnits: 100, trainingRows: 20631, testRows: 13096 });
  assert.deepEqual(readiness.counts, { trainingSamples: 972, trainingUnits: 100, testSamples: 100, testUnits: 100 });
  assert.equal(readiness.status, "EVALUATION_READY");
  assert.equal(readiness.verdict, "not-evaluated");
  assert.equal(readiness.heldOutTargetsRead, false);
  assert.equal(readiness.features.ageActive, true);
  assert.ok(trainingTargets.records.every((row) => row.sampleId.includes(":train:")));
  assert.ok(dataset.samples.filter((row) => row.split === "test").every((row) => !Object.hasOwn(row, "target")));
  assert.equal(preparation.nulls.trials.length, 16);
  for (const predictions of Object.values(preparation.views)) for (const row of predictions) {
    assert.equal(new Set(row.neighbors.map((n) => n.unitId)).size, 5);
  }
});

test("case compiler rejects ignored policy amendments before source preparation", () => {
  const changed = structuredClone(protocol); changed.primary.baseline = "P0Age";
  assert.throws(() => validateFd001Protocol(changed), /Unsupported metric/);
  const extra = structuredClone(protocol); extra.selection.selectByRul = true;
  assert.throws(() => validateFd001Protocol(extra), { code: "SHAPE" });
  const reviewed = structuredClone(protocol); reviewed.review.status = "approved";
  assert.throws(() => validateFd001Protocol(reviewed), /review policy/);
  for (const [section, key, value] of [["selection", "historyWindow", 0], ["selection", "trainingFirstCutoff", 1], ["nullModel", "trials", null], ["evaluator", "neighbors", 0]]) {
    const invalid = structuredClone(protocol); invalid[section][key] = value;
    assert.throws(() => validateFd001Protocol(invalid), { code: "SHAPE" });
  }
  const metric = structuredClone(protocol); metric.primary.metric = "mse";
  assert.throws(() => validateFd001Protocol(metric), /Unsupported FD001/);
});

test("amended protocol values drive both source features and their frozen descriptions", async () => {
  const amended = structuredClone(protocol);
  amended.selection.historyWindow = 5;
  amended.selection.trainingCutoffStep = 40;
  amended.evaluator.neighbors = 3;
  amended.nullModel.trials = 1;
  const { files, dataset, preparation } = await buildFd001Preparation({ protocol: amended });
  const contract = files.get("cases/operational-aging/history-benchmark/contract.json");
  assert.match(contract.historyView, /up to 5 preceding frames/);
  assert.match(contract.population, /from cycle 20 every 40 cycles/);
  const first = dataset.samples.find((row) => row.split === "train" && row.cutoff === 20);
  assert.equal(first.historyStart, 15);
  assert.equal(first.historyEnd, 19);
  assert.ok(dataset.samples.filter((row) => row.split === "train").every((row) => (row.cutoff - 20) % 40 === 0));
  assert.ok(preparation.views.P1.every((row) => row.neighbors.length === 3));
});

test("source parser rejects malformed, reordered or missing cycles and columns", () => {
  const line = (cycle) => `1 ${cycle} ${Array(24).fill("1.0").join(" ")}`;
  assert.equal(parseFd001Observations(Buffer.from(`${line(1)}\n${line(2)}\n`), "test").size, 1);
  for (const source of [`${line(1)}\n${line(3)}`, `${line(2)}\n${line(1)}`, "1 1 2.0", line(1).replace("1.0", "NaN")]) {
    assert.throws(() => parseFd001Observations(Buffer.from(source), "bad"), /FD001 benchmark source/);
  }
});

test("present is excluded from the history window and later training rows cannot change an earlier view", () => {
  const rows = Array.from({ length: 61 }, (_, index) => [1, index + 1, ...Array(24).fill(index + 1)]);
  const train = new Map([[1, rows]]); const testUnits = new Map([[1, rows.slice(0, 31)]]);
  const data = projectFd001Observations(train, testUnits, protocol);
  const first = data.samples.find((row) => row.split === "train" && row.cutoff === 20);
  assert.equal(first.present[0], 20); assert.equal(first.history[0], 10);
  assert.equal(first.historyStart, 1); assert.equal(first.historyEnd, 19);
  const trainingTargets = buildFd001TrainingTargets(train, data);
  assert.equal(trainingTargets.records.find((row) => row.sampleId === first.sampleId).value, 41);
  rows[50][2] = 999;
  const next = projectFd001Observations(train, testUnits, protocol);
  assert.deepEqual(next.samples.find((row) => row.sampleId === first.sampleId), first);
});

test("a cutoff amendment cannot silently discard engines from the declared full cohort", async () => {
  const amended = structuredClone(protocol);
  amended.selection.trainingFirstCutoff = 200;
  amended.nullModel.trials = 1;
  await assert.rejects(buildFd001Preparation({ protocol: amended }), /training unit \d+ has no eligible prefix/);
});
