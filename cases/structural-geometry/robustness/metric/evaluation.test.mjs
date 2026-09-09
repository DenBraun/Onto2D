import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRows } from "../capacity/evaluation.mjs";
import { summarizeStudy } from "../capacity/report.mjs";
import { evaluate, compareGroups } from "./evaluation.mjs";
import { validateModel } from "./report.mjs";
import { python } from "./io.mjs";

const fixture = () => Array.from({ length: 5 }, (_, g) => Array.from({ length: 4 }, (_, t) => ({ id: `row-${g}-${t}`, groupId: `g${g}`,
  interventionId: `s${g}`, source: `s${g}`, target: `t${t}`, magnitude: (t + 1) / 10, y: t / 3, eligible: true,
  x: Array.from({ length: 116 }, (_, j) => j === 0 ? 10 : ((t + 1) * (j + 1) % 11) / 4 + g / 10) }))).flat();
test("metric fits agree with an independent joint solver while unchanged unit models reproduce capacity controls", async () => {
  const rows = fixture(), original = summarizeStudy("synthetic", evaluateRows(rows)), result = evaluate(rows, original.report);
  assert.deepEqual((await python("--models", result.trace)).result, { distinctReferenceFits: 110, predictionsChecked: 840 });
  for (const [name, value] of Object.entries(result.report.models)) {
    validateModel(value, name, original); assert.deepEqual(value.summary, original.report.ablations[name]);
    const changed = structuredClone(value); changed.outerEvidence[0].predictions.reverse(); assert.throws(() => validateModel(changed, name, original));
    const tuning = structuredClone(value); tuning.summary.groups[0].candidates[0].groups[0].id = "g0";
    assert.throws(() => validateModel(tuning, name, original));
  }
  const altered = structuredClone(result.trace); altered.ablations["B+S+G"][0].predictions[0] += 1;
  await assert.rejects(python("--models", altered));
  assert.equal(result.report.comparisons.expandedReferenceDifference.interpretation, "equal");
});
test("exact aggregation rejects floating false gains and model inputs cannot omit features or groups", () => {
  const groups = nums => nums.map((n, i) => ({ id: `g${i}`, meanRankSkill: n / 10, interventions: [{ rankSkill: { numerator: String(n), denominator: "10" } }] }));
  const comparison = compareGroups(groups([1, 2, 0]), groups([0, 0, 3]));
  assert.ok(comparison.meanDelta > 0); assert.equal(comparison.interpretation, "equal");
  for (const change of [rows => rows[0].x.pop(), rows => { rows[0].x[85] = NaN; }, rows => rows.splice(0, 4)]) {
    const rows = fixture(); change(rows); assert.throws(() => evaluate(rows, {}));
  }
});
