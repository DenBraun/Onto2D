import assert from "node:assert/strict";
import test from "node:test";
import { matchAnatomies, evaluate, compareMatched, computeAllScopes } from "./study.mjs";
import { python } from "./io.mjs";
import { summarizeStudy, validateStudy } from "./report.mjs";

function fixture(id, { sources = 5, missing = [] } = {}) {
  const rows = Array.from({ length: sources }, (_, i) => `S${i}`).flatMap(source => ["A", "B", "C", "D"].filter(target => !missing.includes(target))
    .map((target, i) => ({ id: JSON.stringify([id, source, target]), groupId: source, interventionId: JSON.stringify([id, source]),
      source, target, magnitude: { A: 0.1, B: 0.2, C: 0.2, D: 0.8 }[target], measuredRecordings: 2, recordings: 2,
      recordingIds: ["r1", "r2"], rank: i + 1, y: i / 3, eligible: true, x: Array.from({ length: 54 }, (_, j) => i + j) })));
  return { anatomy: { id }, matched: { population: { rows }, rows }, responses: { trials: rows.map(({ source, target, magnitude }) => ({ source, target, magnitude })) } };
}

test("anatomy matching preserves identities, tied ranks and all missing-side rows without mutating native ranks", async () => {
  const left = fixture("Dataset7"), right = fixture("Dataset8", { missing: ["A"] }), before = structuredClone([left, right]);
  const result = matchAnatomies(left, right);
  assert.deepEqual([left, right], before); assert.equal(result.status, "complete");
  assert.equal(result.candidates.length, 20); assert.equal(result.candidates.filter(row => row.shared).length, 15);
  assert.deepEqual(result.rows[0].slice(0, 3).map(row => [row.target, row.rank, row.y]), [["B", 1.5, 0.25], ["C", 1.5, 0.25], ["D", 3, 1]]);
  assert.ok(result.rows[0].every(row => JSON.parse(row.id)[0] === "Dataset7"));
  assert.ok(result.rows[1].every(row => JSON.parse(row.id)[0] === "Dataset8"));
  const reference = await python("reference.py", ["--overlap"], [left, right]);
  const { rows, ...ledger } = result; assert.deepEqual(reference.ledger, ledger);
  assert.deepEqual(reference.targets, rows.map(values => values.map(({ source, target, magnitude, rank, y }) => ({ source, target, magnitude, rank, y }))));
});

test("too few shared receivers, constant outcomes and fewer than five sources remain unavailable", () => {
  for (const options of [{ missing: ["A", "B"] }, { missing: ["A", "D"] }, { sources: 4 }]) {
    const result = matchAnatomies(fixture("Dataset7"), fixture("Dataset8", options));
    assert.equal(result.status, "unavailable"); assert.equal(result.reason, "fewer-than-five-shared-source-groups");
    assert.deepEqual(evaluate(result.rows[0], result.reason), { report: { status: "unavailable", reason: result.reason, primary: null }, trace: null });
  }
  const left = fixture("Dataset7"), right = fixture("Dataset8");
  for (const data of [left, right]) for (const row of data.matched.rows) row.magnitude = 1;
  assert.ok(matchAnatomies(left, right).groups.every(row => row.reason === "fewer-than-two-distinct-target-magnitudes"));
});

test("shared trial, recording and magnitude disagreements abort instead of selecting convenient outcomes", async () => {
  for (const mutate of [d => { d.responses.trials[0].magnitude++; }, d => { d.matched.rows[0].recordingIds[0] = "other"; },
    d => { d.matched.rows[0].magnitude++; }, d => { d.anatomy.id = "Dataset7"; }, d => d.matched.population.rows.push(d.matched.rows[0])]) {
    const left = fixture("Dataset7"), right = fixture("Dataset8"); mutate(right);
    assert.throws(() => matchAnatomies(left, right));
  }
  const left = fixture("Dataset7"), right = fixture("Dataset8"); right.responses.trials[0].magnitude++;
  await assert.rejects(python("reference.py", ["--overlap"], [left, right]), /lineage differs/);
});

test("missing geometry blocks evaluation and never becomes a zero-feature fallback", () => {
  const rows = fixture("Dataset8").matched.rows; rows[0].x = null;
  assert.throws(() => evaluate(rows));
  const blocked = evaluate(rows, "required-geometry-computation-failed");
  assert.equal(blocked.trace, null);
  assert.deepEqual(compareMatched([blocked.report, blocked.report]), { status: "unavailable", reason: "both-matched-studies-required", comparisons: null });
});

test("flow arithmetic refusal retains its root and continues the census; integrity errors abort", async () => {
  const anatomy = { id: "Dataset8", roots: ["A", "B", "C"].map(root => ({ root })), scopes: [true, true, false].map(eligible => ({ eligible })) };
  const seen = [];
  const compute = async data => {
    const source = data.roots[0].root; seen.push(source);
    if (source === "A") throw Object.assign(new Error("digit bound"), { code: "STRUCTURAL_FLOW_NUMERIC_LIMIT" });
    return [{ source, status: "complete", reason: null }];
  };
  const result = await computeAllScopes(anatomy, [], () => {}, compute);
  assert.deepEqual(seen, ["A", "B"]); assert.equal(result[0].reason, "STRUCTURAL_FLOW_NUMERIC_LIMIT");
  assert.deepEqual(result[0].scope, { root: "A" }); assert.equal(result[1].status, "complete");
  await assert.rejects(computeAllScopes(anatomy, [], () => {}, async () => { throw Object.assign(new Error("invalid certificate"), { code: "INVALID_CERTIFICATE" }); }), /invalid certificate/);
});

test("anatomy comparison uses Dataset8 minus Dataset7, including the change in geometry gain", () => {
  const study = (b, full) => ({ status: "complete", ablations: { B: { groups: b.map((value, i) => ({ id: String(i), meanRankSkill: value })) },
    "B+F+O+flow": { groups: full.map((value, i) => ({ id: String(i), meanRankSkill: value })) } },
    primary: { groups: b.map((value, i) => ({ id: String(i), delta: full[i] - value })) } });
  const result = compareMatched([study([0, 0], [0.5, 0.5]), study([0.5, 0.5], [0.5, 0.5])]);
  assert.equal(result.comparisons.baseline.meanDelta, 0.5); assert.equal(result.comparisons.full.meanDelta, 0);
  assert.equal(result.comparisons.geometryGain.meanDelta, -0.5);
});

test("an eligible synthetic Dataset8 study fits all six ablations and agrees with independent grouped ridge", async () => {
  const matched = matchAnatomies(fixture("Dataset7"), fixture("Dataset8")), rows = matched.rows[1];
  const result = evaluate(rows), summary = summarizeStudy("Dataset8-matched", rows, result);
  assert.equal(result.report.status, "complete"); validateStudy(summary, "Dataset8-matched", rows, null);
  const reference = await python("reference.py", ["--models"], result.trace);
  assert.deepEqual(reference, { distinctReferenceFits: 330, predictionsChecked: 2520 });
  const changed = structuredClone(result.trace); changed.ablations.B[0].predictions[0] += 1;
  await assert.rejects(python("reference.py", ["--models"], changed));
  for (const mutate of [r => { r.report.ablations.B.meanRankSkill += 0.01; }, r => { r.report.primary.meanDelta += 0.1; },
    r => { r.report.ablations.B.groups[0].lambda = 999; }]) {
    const changed = structuredClone(summary); mutate(changed); assert.throws(() => validateStudy(changed, "Dataset8-matched", rows, null));
  }
});
