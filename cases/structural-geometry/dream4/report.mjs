import assert from "node:assert/strict";
import { selectLambda, RIDGE_PROFILE } from "../protocol/model.mjs";
import { ABLATIONS, pairedSummary } from "./evaluation.mjs";

const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const closed = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const number = value => assert.ok(Number.isFinite(value) && value >= -1 && value <= 1);
const count = (value, max = 36) => assert.ok(Number.isInteger(value) && value >= 0 && value <= max);
const integer = value => { assert.match(value, /^-?(0|[1-9][0-9]{0,5})$/); return BigInt(value); };

function metric(row) {
  closed(row, ["id", "count", "rankSkill", "spearman", "kendallTauB"]);
  assert.equal(row.count, 9);
  const k = row.kendallTauB, s = row.spearman, r = row.rankSkill;
  closed(k, ["value", "reason", "concordant", "discordant", "tiedPredictedOnly", "tiedObservedOnly", "tiedBoth", "numerator", "denominatorSquared"]);
  const counts = [k.concordant, k.discordant, k.tiedPredictedOnly, k.tiedObservedOnly, k.tiedBoth];
  counts.forEach(value => count(value));
  assert.equal(counts.reduce((a, b) => a + b, 0), 36);
  const numerator = k.concordant - k.discordant, denominator = k.concordant + k.discordant + k.tiedPredictedOnly;
  assert.ok(denominator > 0);
  assert.deepEqual(r, { value: numerator / denominator, reason: null, numerator: String(numerator), denominator: String(denominator) });
  assert.equal(k.numerator, String(numerator));
  const squared = denominator * (k.concordant + k.discordant + k.tiedObservedOnly);
  assert.equal(k.denominatorSquared, String(squared));
  assert.equal(k.reason, squared === 0 ? "constant-prediction" : null);
  assert.equal(k.value, squared === 0 ? null : numerator / Math.sqrt(squared));
  closed(s, ["value", "reason", "numerator", "predictedSumSquares", "observedSumSquares", "denominatorSquared", "exactComponents"]);
  const a = integer(s.predictedSumSquares), b = integer(s.observedSumSquares), c = integer(s.numerator);
  assert.ok(a >= 0n && a <= 240n && b > 0n && b <= 240n && c * c <= a * b);
  assert.equal(s.denominatorSquared, String(a * b));
  assert.equal(s.exactComponents, "centered-doubled-average-ranks");
  assert.equal(s.reason, a === 0n ? "constant-prediction" : null);
  assert.equal(s.value, a === 0n ? null : Number(c) / Math.sqrt(Number(a * b)));
  assert.equal(a === 0n, squared === 0);
}

function groupSummary(group, contrast) {
  assert.equal(group.targetCount, 90);
  assert.equal(group.interventionCount, 10);
  assert.deepEqual(group.interventions.map(row => row.id), Array.from({ length: 10 }, (_, i) => `${group.id}:${contrast}:G${i + 1}`).sort());
  group.interventions.forEach(metric);
  assert.equal(group.meanRankSkill, mean(group.interventions.map(row => row.rankSkill.value)));
  for (const name of ["spearman", "kendallTauB"]) {
    const undefinedInterventions = group.interventions.filter(row => row[name].value === null).map(row => ({ id: row.id, reason: row[name].reason }));
    assert.deepEqual(group[name], { mean: undefinedInterventions.length ? null : mean(group.interventions.map(row => row[name].value)), undefinedInterventions });
  }
}

export function validateResults(results, protocol) {
  assert.deepEqual(results.map(result => result.contrast), ["knockouts", "knockdowns"]);
  for (const result of results) {
    assert.equal(result.role, result.contrast === "knockouts" ? "primary" : "secondary");
    // The committed D4 result covers the complete frozen population. Failed
    // runs remain local and cannot replace it with a partial successful score.
    closed(result, ["contrast", "role", "coverage", "exclusions", "status", "reason", "ablations", "comparisons", "primary", "propagation"]);
    assert.equal(result.status, "complete"); assert.equal(result.reason, null);
    assert.deepEqual(result.coverage, { groups: 5, eligibleGroups: 5, interventions: 50, eligibleInterventions: 50,
      targetRows: 450, eligibleTargetRows: 450, geometryGroups: 5, matchedRows: 450 });
    assert.deepEqual(result.exclusions, []);
    assert.deepEqual(Object.keys(result.ablations), protocol.ablations.ordered);
    for (const [name, ablation] of Object.entries(result.ablations)) {
      closed(ablation, ["featureCount", "meanRankSkill", "groups"]);
      assert.equal(ablation.featureCount, ABLATIONS[name].length);
      assert.deepEqual(ablation.groups.map(group => group.id), protocol.dream4.unitIds);
      for (const group of ablation.groups) {
        closed(group, ["id", "lambda", "candidates", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB", "interventions"]);
        groupSummary(group, result.contrast);
        assert.deepEqual(group.candidates.map(candidate => candidate.lambda), RIDGE_PROFILE.lambdas);
        for (const candidate of group.candidates) {
          closed(candidate, ["lambda", "meanRankSkill", "groups"]);
          assert.deepEqual(candidate.groups.map(row => row.id), protocol.dream4.unitIds.filter(id => id !== group.id));
          candidate.groups.forEach(row => { closed(row, ["id", "meanRankSkill"]); number(row.meanRankSkill); });
          assert.equal(candidate.meanRankSkill, mean(candidate.groups.map(row => row.meanRankSkill)));
        }
        assert.equal(group.lambda, selectLambda(group.candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill }))));
      }
      assert.equal(ablation.meanRankSkill, mean(ablation.groups.map(group => group.meanRankSkill)));
    }
    const comparisons = [["B+F+O+flow", "B"], ["B+F", "B"], ["B+O", "B"], ["B+flow", "B"], ["B+F+O", "B+F"], ["B+F+O+flow", "B+F+O"]]
      .map(([left, right]) => ({ left, right, ...pairedSummary(result.ablations[left].groups, result.ablations[right].groups) }));
    assert.deepEqual(result.comparisons, comparisons);
    assert.deepEqual(result.primary, comparisons[0]);
    closed(result.propagation, ["meanRankSkill", "groups"]);
    assert.deepEqual(result.propagation.groups.map(group => group.id), protocol.dream4.unitIds);
    for (const group of result.propagation.groups) {
      closed(group, ["id", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB", "interventions"]);
      groupSummary(group, result.contrast);
    }
    assert.equal(result.propagation.meanRankSkill, mean(result.propagation.groups.map(group => group.meanRankSkill)));
  }
  return results;
}
