import assert from "node:assert/strict";
import test from "node:test";
import { groupedFolds } from "../../protocol/model.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { fitOuter, evaluateRows, comparisonsFor } from "./evaluation.mjs";
import { PROFILE } from "./features.mjs";
import { summarizeStudy, validateStudy } from "./report.mjs";
import { groupsOf, targetValues } from "./study.mjs";
import { python } from "./io.mjs";

const fixture = () => Array.from({ length: 5 }, (_, g) => Array.from({ length: 4 }, (_, t) => ({ id: `row-${g}-${t}`,
  groupId: `g${g}`, interventionId: `s${g}`, source: `s${g}`, target: `t${t}`, magnitude: (t + 1) / 10, y: t / 3, eligible: true,
  x: Array.from({ length: 116 }, (_, j) => j === 0 ? 10 : ((t + 1) * (j + 1) % 11) / 4 + g / 10) }))).flat();

test("all six capacity models agree with independent grouped ridge and reject an altered prediction", async () => {
  const rows = fixture(), costs = {}, result = evaluateRows(rows, costs), id = "synthetic";
  const target = { id, targetCount: rows.length, targetValuesSha256: digest(targetValues(rows)), groups: groupsOf(rows) };
  const study = summarizeStudy(id, result); validateStudy(study, target);
  assert.deepEqual(await python("reference.py", ["--models"], result.trace), { distinctReferenceFits: 330, predictionsChecked: 2520 });
  const exact = { trace: result.trace, comparisons: structuredClone(result.report.comparisons) };
  assert.equal(await python("reference.py", ["--comparisons"], exact), 8);
  exact.comparisons[0].exactMeanDelta.numerator = "999";
  await assert.rejects(python("reference.py", ["--comparisons"], exact));
  assert.ok(result.report.capacity.B.every(row => row.constantColumns.includes("node_count")));
  for (const values of Object.values(costs)) assert.ok(values.every(row => row.fittingCalls === 21 && row.inferenceCalls === 21));
  const changed = structuredClone(result.trace); changed.ablations["B+S+G"][0].predictions[0] += 1;
  await assert.rejects(python("reference.py", ["--models"], changed));
  for (const mutate of [s => { s.outerEvidence["B+S"][0].predictions.reverse(); }, s => { s.report.primary.meanDelta++; },
    s => { s.report.ablations["B+Q"].groups[0].lambda = 123; }, s => { s.report.capacity.B[0].nonconstantColumnCount++; },
    s => s.report.ablations["B+S"].groups[0].candidates.pop()]) {
    const copy = structuredClone(study); mutate(copy); assert.throws(() => validateStudy(copy, target));
  }
});

test("changing held-out covariates and outcomes cannot change tuning, training means or coefficients", () => {
  const rows = fixture(), fold = groupedFolds(rows)[0], original = fitOuter(rows, "B+S", fold);
  const changed = rows.map(row => row.groupId !== fold.heldOut ? row : { ...row, x: row.x.map(value => value + 1e6), y: 1 - row.y, magnitude: 1 - row.magnitude });
  const next = fitOuter(changed, "B+S", fold);
  assert.deepEqual(next.candidates, original.candidates); assert.deepEqual(next.model, original.model); assert.equal(next.lambda, original.lambda);
  assert.notDeepEqual(next.predictions, original.predictions);
});

test("incomplete feature vectors, nonfinite targets and insufficient groups cannot yield a partial study", () => {
  for (const mutate of [rows => rows[0].x.pop(), rows => { rows[0].x[0] = NaN; }, rows => { rows[0].y = Infinity; },
    rows => rows.splice(0, 4), rows => rows.push(rows[0])]) {
    const rows = fixture(); mutate(rows); assert.throws(() => evaluateRows(rows));
  }
});

test("floating cancellation cannot turn an exact zero group-mean difference into a gain claim", () => {
  const groups = values => values.map((numerator, i) => ({ id: `g${i}`, meanRankSkill: numerator / 10,
    interventions: [{ rankSkill: { numerator: String(numerator), denominator: "10" } }] }));
  const ablations = Object.fromEntries(PROFILE.models.map(name => [name, { groups: groups(name === "B+S+G" ? [1, 2, 0] : [0, 0, 3]) }]));
  const comparison = comparisonsFor(ablations)[0];
  assert.ok(comparison.meanDelta > 0); assert.deepEqual(comparison.exactMeanDelta, { numerator: "0", denominator: "1" });
  assert.equal(comparison.interpretation, "no-observed-gain-for-this-pipeline");
});
