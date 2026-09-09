import assert from "node:assert/strict";
import test from "node:test";
import { ABLATIONS, FEATURE_NAMES, evaluateRows, fitOuter, pairedSummary, summarizePredictions } from "./evaluation.mjs";

const syntheticRows = () => Array.from({ length: 5 }, (_, group) => Array.from({ length: 2 }, (_, intervention) =>
  Array.from({ length: 3 }, (_, target) => ({ id: `${group}/${intervention}/${target}`, groupId: `g${group}`,
    interventionId: `${group}/${intervention}`, magnitude: target, y: target / 2,
    x: Array.from({ length: 54 }, (_, column) => column === 4 ? 2 : column === 7 ? 1 :
      column % 3 === 0 ? target + (group % 2) : column % 3 === 1 ? intervention : 3) })))).flat(2);

test("complete nested evaluation retains all six fixed feature sets and all groups", () => {
  const rows = syntheticRows(), original = structuredClone(rows), result = evaluateRows(rows);
  assert.deepEqual(rows, original);
  assert.equal(FEATURE_NAMES.length, 54);
  assert.deepEqual(Object.values(ABLATIONS).map(columns => columns.length), [23, 29, 29, 42, 35, 54]);
  assert.equal(result.report.comparisons.length, 6);
  assert.deepEqual(Object.keys(result.report.ablations), Object.keys(ABLATIONS));
  for (const ablation of Object.values(result.report.ablations)) {
    assert.equal(ablation.groups.length, 5);
    for (const group of ablation.groups) {
      assert.equal(group.targetCount, 6);
      assert.equal(group.candidates.length, 5);
      assert.equal(group.candidates.every(candidate => candidate.groups.length === 4 && candidate.groups.every(row => row.id !== group.id)), true);
    }
  }
  assert.equal(result.report.propagation.groups.length, 5);
  assert.equal(result.report.primary.meanDelta, 0);
  assert.equal(result.report.primary.interpretation, "no-observed-gain-for-this-pipeline");
});

test("held-out targets never affect tuning, fitted transforms or predictions", () => {
  const rows = syntheticRows(), first = fitOuter(rows, "B+F+O+flow", "g2");
  const changed = rows.map(row => row.groupId === "g2" ? { ...row, y: 1 - row.y, magnitude: 2 - row.magnitude } : row);
  const second = fitOuter(changed, "B+F+O+flow", "g2");
  assert.deepEqual(first.candidates, second.candidates);
  assert.deepEqual(first.model, second.model);
  assert.deepEqual(first.predictions, second.predictions);
  assert.equal(first.lambda, second.lambda);
  assert.notEqual(first.summary.meanRankSkill, second.summary.meanRankSkill);
});

test("held-out feature distribution never enters training standardization or tuning", () => {
  const rows = syntheticRows(), first = fitOuter(rows, "B", "g4");
  const changed = rows.map(row => row.groupId === "g4" ? { ...row, x: row.x.map(x => x + 100) } : row);
  const second = fitOuter(changed, "B", "g4");
  assert.deepEqual(first.candidates, second.candidates);
  assert.deepEqual(first.model, second.model);
  assert.notDeepEqual(first.predictions, second.predictions);
});

test("constant predictions score zero, remain eligible and select the largest tied lambda", () => {
  const rows = syntheticRows().map(row => ({ ...row, x: Array(54).fill(0) }));
  const result = fitOuter(rows, "B", "g0");
  assert.equal(result.lambda, 100);
  assert.equal(result.summary.meanRankSkill, 0);
  assert.equal(result.summary.targetCount, 6);
  assert.equal(result.summary.spearman.mean, null);
  assert.equal(result.summary.spearman.undefinedInterventions.length, 2);
});

test("invalid numeric predictions or incomplete feature vectors are never silently excluded", () => {
  const rows = syntheticRows();
  assert.throws(() => summarizePredictions(rows, []));
  assert.throws(() => summarizePredictions(rows, rows.map(() => NaN)));
  const malformed = structuredClone(rows); malformed[0].x.pop();
  assert.throws(() => evaluateRows(malformed));
  assert.throws(() => evaluateRows([...rows, rows[0]]));
});

test("descriptive sensitivity uses paired equal-group differences, including negative gains", () => {
  const right = [0, 0.2, -0.1, 0.1, 0.3].map((meanRankSkill, i) => ({ id: String(i), meanRankSkill }));
  const left = right.map((row, i) => ({ ...row, meanRankSkill: row.meanRankSkill + [0.5, -0.5, 0, 0, 0][i] }));
  const result = pairedSummary(left, right);
  assert.equal(result.meanDelta, 0);
  assert.deepEqual(result.leaveOneGroupOutRange, [-0.125, 0.125]);
  assert.equal(result.minimum, -0.5);
  assert.equal(result.maximum, 0.5);
  assert.throws(() => pairedSummary(left, [...right].reverse()));
});
