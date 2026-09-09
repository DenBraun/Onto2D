import assert from "node:assert/strict";
import test from "node:test";
import { prepareFunctionalPopulation } from "../protocol/populations.mjs";
import { balancedTrainingRows } from "../protocol/model.mjs";
import { fitOuter } from "../dream4/evaluation.mjs";
import { evaluatePrepared } from "./evaluation.mjs";

function sample() {
  const scopes = [], trials = [];
  for (let g = 0; g < 5; g++) {
    const source = `S${g}`, targets = Array.from({ length: 3 + g }, (_, i) => `T${i}`);
    scopes.push({ anatomyId: "Dataset7", source, nodeIds: [source, ...targets], eligible: true, reason: null });
    for (const recordingId of ["shared-recording-a", "shared-recording-b"]) for (const [i, target] of targets.entries()) {
      trials.push({ recordingId, source, target, trialIndex: g, state: i === 0 ? "observed-zero" : "observed", magnitude: i, reason: null });
    }
  }
  const population = prepareFunctionalPopulation(trials, scopes);
  const rows = population.rows.filter(row => row.eligible).map(row => ({ ...row,
    x: Array.from({ length: 54 }, (_, i) => i === 4 ? 2 : i === 7 ? 1 : i % 3 === 0 ? row.magnitude : i % 3 === 1 ? Number(row.source.slice(1)) : 0) }));
  return { anatomy: { id: "Dataset7" }, matched: { population, rows, status: population.status, reason: population.reason } };
}

test("functional evaluation holds out sources across shared recordings and variable receiver counts", () => {
  const data = sample(), original = structuredClone(data), result = evaluatePrepared(data);
  assert.deepEqual(data, original);
  assert.equal(result.report.status, "complete");
  assert.equal(result.report.ablations.B.groups.length, 5);
  assert.deepEqual(result.report.ablations.B.groups.map(row => row.targetCount), [3, 4, 5, 6, 7]);
  for (const fold of result.trace.folds) {
    const rows = new Map(result.trace.rows.map(row => [row.id, row]));
    assert.ok(fold.trainIds.every(id => rows.get(id).source !== fold.heldOut));
    assert.ok(fold.testIds.every(id => rows.get(id).source === fold.heldOut));
  }
  const weights = balancedTrainingRows(data.matched.rows);
  for (let g = 0; g < 5; g++) {
    const sum = weights.reduce((sum, row, i) => sum + (data.matched.rows[i].source === `S${g}` ? row.weight : 0), 0);
    assert.ok(Math.abs(sum - 0.2) < 1e-15, "Receivers do not determine group weight");
  }
});

test("held-out functional outcomes cannot change tuning or fitted predictors", () => {
  const rows = sample().matched.rows, first = fitOuter(rows, "B+F+O+flow", "S3");
  const changed = rows.map(row => row.source === "S3" ? { ...row, y: 1 - row.y, magnitude: 10 - row.magnitude } : row);
  const second = fitOuter(changed, "B+F+O+flow", "S3");
  assert.deepEqual(first.model, second.model); assert.deepEqual(first.candidates, second.candidates);
  assert.deepEqual(first.predictions, second.predictions);
  assert.notEqual(first.summary.meanRankSkill, second.summary.meanRankSkill);
});

test("missing groups or failed numeric computation produce an unavailable primary without a fallback", () => {
  const data = sample(); data.matched.status = "unavailable"; data.matched.reason = "fewer-than-five-eligible-source-groups";
  const costs = {}, result = evaluatePrepared(data, costs);
  assert.equal(result.report.primary, null); assert.equal(result.trace, null); assert.deepEqual(costs, {});
  const broken = sample(); broken.matched.rows[0].x[0] = Infinity;
  const failed = evaluatePrepared(broken);
  assert.equal(failed.report.reason, "required-model-computation-failed"); assert.equal(failed.report.primary, null);
  const wrong = sample(); wrong.matched.rows[0].groupId = "recording-group";
  assert.throws(() => evaluatePrepared(wrong));
});
