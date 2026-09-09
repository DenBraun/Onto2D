import assert from "node:assert/strict";
import { evaluateRows } from "../dream4/evaluation.mjs";

export function evaluatePrepared(data, costs = null) {
  const { matched } = data;
  if (matched.status !== "complete") return { report: { status: "unavailable", reason: matched.reason, primary: null }, trace: null };
  assert.equal(data.anatomy.id, "Dataset7");
  assert.equal(matched.rows.length, matched.population.coverage.eligibleTargetRows);
  const expected = matched.population.rows.filter(row => row.eligible);
  assert.deepEqual(matched.rows.map(row => row.id), expected.map(row => row.id));
  assert.ok(matched.rows.every(row => row.eligible && row.groupId === row.source));
  const groups = [...new Set(matched.rows.map(row => row.groupId))].sort();
  assert.ok(groups.length >= 5);
  assert.deepEqual(groups, matched.population.groups.filter(group => group.eligible).map(group => group.id));
  try { return evaluateRows(matched.rows, costs); }
  catch (error) {
    return { report: { status: "unavailable", reason: "required-model-computation-failed", diagnostic: error.message, primary: null }, trace: null };
  }
}
