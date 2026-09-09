import assert from "node:assert/strict";
import { RIDGE_PROFILE, selectLambda } from "../protocol/model.mjs";
import { ABLATIONS, pairedSummary } from "../dream4/evaluation.mjs";

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
export const counts = (rows, key) => Object.fromEntries([...new Set(rows.map(row => row[key]))].sort()
  .map(value => [value, rows.filter(row => row[key] === value).length]));
export const closed = (value, fields) => assert.deepEqual(Object.keys(value).sort(), [...fields].sort());
const natural = (value, maximum = 100000) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= maximum);
const int = value => { assert.match(value, /^-?(0|[1-9][0-9]{0,11})$/); return BigInt(value); };

export function summarizePopulation(data) {
  const p = data.matched.population, a = p.aggregation;
  return { status: p.status, reason: p.reason, coverage: p.coverage,
    groups: p.groups.map(({ rowIds, ...group }) => group),
    trialStates: a.counts, trialReasons: a.reasonCounts,
    recordingResponses: a.recordingResponses.length,
    measuredRecordingResponses: a.recordingResponses.filter(row => row.magnitude !== null).length,
    sourceReceiverAggregates: a.responses.length,
    measuredSourceReceiverAggregates: a.responses.filter(row => row.magnitude !== null).length,
    candidateStates: counts(p.rows, "state"),
    pairExclusions: counts(p.rows.filter(row => row.pairReason !== null), "pairReason"),
    targetExclusions: counts(p.rows.filter(row => !row.eligible), "reason") };
}

export function validatePopulation(p, intake, audit) {
  closed(p, ["status", "reason", "coverage", "groups", "trialStates", "trialReasons", "recordingResponses", "measuredRecordingResponses",
    "sourceReceiverAggregates", "measuredSourceReceiverAggregates", "candidateStates", "pairExclusions", "targetExclusions"]);
  const expected = audit.celegans.roots;
  assert.deepEqual(p.groups.map(group => group.id), expected.map(group => group.source));
  for (const [i, group] of p.groups.entries()) {
    closed(group, ["id", "source", "anatomyId", "scopeEligible", "scopeReason", "eligible", "reason", "reasons",
      "candidateCount", "eligibleReceiverCount", "distinctMagnitudeCount"]);
    assert.equal(group.source, group.id); assert.equal(group.anatomyId, "Dataset7");
    assert.equal(group.scopeEligible, expected[i].scopeEligible);
    assert.equal(group.candidateCount, expected[i].nodeCount - 1);
    natural(group.eligibleReceiverCount, group.candidateCount); natural(group.distinctMagnitudeCount, group.eligibleReceiverCount);
    assert.equal(group.scopeEligible ? group.scopeReason === null : typeof group.scopeReason === "string" && group.scopeReason.length > 0, true);
    const reasons = [...(!group.scopeEligible ? ["root-scope-ineligible"] : []),
      ...(group.eligibleReceiverCount < 3 ? ["fewer-than-three-eligible-receivers"] : []),
      ...(group.distinctMagnitudeCount < 2 ? ["fewer-than-two-distinct-target-magnitudes"] : [])];
    assert.deepEqual(group.reasons, reasons); assert.equal(group.reason, reasons[0] ?? null); assert.equal(group.eligible, !reasons.length);
  }
  const groups = p.groups.filter(group => group.eligible), c = p.coverage;
  closed(c, ["groups", "eligibleGroups", "candidateRows", "recordingQualifiedRows", "eligibleTargetRows", "noTrialRows", "trialRows"]);
  Object.values(c).forEach(value => natural(value));
  assert.equal(c.groups, p.groups.length); assert.equal(c.eligibleGroups, groups.length);
  assert.equal(c.candidateRows, p.groups.reduce((sum, group) => sum + group.candidateCount, 0));
  assert.equal(c.recordingQualifiedRows, p.groups.reduce((sum, group) => sum + group.eligibleReceiverCount, 0));
  assert.equal(c.eligibleTargetRows, groups.reduce((sum, group) => sum + group.eligibleReceiverCount, 0));
  assert.equal(p.status, groups.length >= 5 ? "complete" : "unavailable");
  assert.equal(p.reason, groups.length >= 5 ? null : "fewer-than-five-eligible-source-groups");
  const sumCounts = ledger => { Object.values(ledger).forEach(value => natural(value)); return Object.values(ledger).reduce((a, b) => a + b, 0); };
  assert.equal(sumCounts(p.trialStates), c.trialRows);
  assert.equal(sumCounts(p.trialReasons), p.trialStates.unobserved + p.trialStates["not-applicable"]);
  assert.equal(sumCounts(p.candidateStates), c.candidateRows);
  assert.equal(sumCounts(p.pairExclusions), c.candidateRows - c.recordingQualifiedRows);
  assert.equal(sumCounts(p.targetExclusions), c.candidateRows - c.eligibleTargetRows);
  assert.equal(p.pairExclusions["no-trial-rows"] ?? 0, c.noTrialRows);
  assert.equal(c.trialRows, intake.requestedWindows + (intake.receiverReasons["no-accepted-receiver-column"] ?? 0));
  assert.equal(p.sourceReceiverAggregates, c.candidateRows - c.noTrialRows);
  natural(p.recordingResponses, c.trialRows); natural(p.measuredRecordingResponses, p.recordingResponses);
  natural(p.measuredSourceReceiverAggregates, p.sourceReceiverAggregates);
  assert.ok(p.measuredSourceReceiverAggregates >= c.recordingQualifiedRows);
  return groups;
}

function groupMetrics(group, expected) {
  const n = expected.eligibleReceiverCount;
  assert.equal(group.targetCount, n); assert.equal(group.interventionCount, 1); assert.equal(group.interventions.length, 1);
  const row = group.interventions[0], k = row.kendallTauB, s = row.spearman;
  closed(row, ["id", "count", "rankSkill", "spearman", "kendallTauB"]);
  assert.equal(row.id, JSON.stringify(["Dataset7", group.id])); assert.equal(row.count, n);
  closed(k, ["value", "reason", "concordant", "discordant", "tiedPredictedOnly", "tiedObservedOnly", "tiedBoth", "numerator", "denominatorSquared"]);
  const parts = [k.concordant, k.discordant, k.tiedPredictedOnly, k.tiedObservedOnly, k.tiedBoth];
  parts.forEach(value => natural(value, n * (n - 1) / 2));
  assert.equal(parts.reduce((a, b) => a + b, 0), n * (n - 1) / 2);
  const numerator = k.concordant - k.discordant, denominator = k.concordant + k.discordant + k.tiedPredictedOnly;
  assert.ok(denominator > 0);
  assert.deepEqual(row.rankSkill, { value: numerator / denominator, reason: null, numerator: String(numerator), denominator: String(denominator) });
  assert.equal(group.meanRankSkill, row.rankSkill.value);
  const squared = denominator * (k.concordant + k.discordant + k.tiedObservedOnly);
  assert.equal(k.numerator, String(numerator)); assert.equal(k.denominatorSquared, String(squared));
  assert.equal(k.reason, squared === 0 ? "constant-prediction" : null);
  assert.equal(k.value, squared === 0 ? null : numerator / Math.sqrt(squared));
  closed(s, ["value", "reason", "numerator", "predictedSumSquares", "observedSumSquares", "denominatorSquared", "exactComponents"]);
  const a = int(s.predictedSumSquares), b = int(s.observedSumSquares), c = int(s.numerator), maximum = BigInt(n * (n * n - 1) / 3);
  assert.ok(a >= 0n && b > 0n && a <= maximum && b <= maximum && c * c <= a * b);
  assert.equal(s.denominatorSquared, String(a * b)); assert.equal(s.exactComponents, "centered-doubled-average-ranks");
  assert.equal(s.reason, a === 0n ? "constant-prediction" : null); assert.equal(a === 0n, squared === 0);
  assert.equal(s.value, a === 0n ? null : Number(c) / Math.sqrt(Number(a * b)));
  for (const name of ["spearman", "kendallTauB"]) assert.deepEqual(group[name], { mean: row[name].value,
    undefinedInterventions: row[name].value === null ? [{ id: row.id, reason: row[name].reason }] : [] });
}

export function validateStudy(study, groups) {
  if (study.status === "unavailable") {
    closed(study, ["status", "reason", "primary", ...(Object.hasOwn(study, "diagnostic") ? ["diagnostic"] : [])]);
    assert.equal(study.primary, null);
    assert.ok(["fewer-than-five-eligible-source-groups", "required-geometry-computation-failed", "required-model-computation-failed"].includes(study.reason));
    if (study.reason === "fewer-than-five-eligible-source-groups") assert.ok(groups.length < 5);
    if (study.reason === "required-model-computation-failed") assert.ok(typeof study.diagnostic === "string" && study.diagnostic.length > 0);
    return;
  }
  closed(study, ["status", "reason", "ablations", "comparisons", "primary", "propagation"]);
  assert.equal(study.status, "complete"); assert.equal(study.reason, null); assert.ok(groups.length >= 5);
  assert.deepEqual(Object.keys(study.ablations), Object.keys(ABLATIONS));
  const ids = groups.map(group => group.id);
  for (const [name, result] of Object.entries(study.ablations)) {
    closed(result, ["featureCount", "meanRankSkill", "groups"]);
    assert.equal(result.featureCount, ABLATIONS[name].length); assert.deepEqual(result.groups.map(group => group.id), ids);
    for (const [i, group] of result.groups.entries()) {
      closed(group, ["id", "lambda", "candidates", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB", "interventions"]);
      groupMetrics(group, groups[i]);
      assert.deepEqual(group.candidates.map(candidate => candidate.lambda), RIDGE_PROFILE.lambdas);
      for (const candidate of group.candidates) {
        closed(candidate, ["lambda", "meanRankSkill", "groups"]);
        assert.deepEqual(candidate.groups.map(row => row.id), ids.filter(id => id !== group.id));
        candidate.groups.forEach(row => { closed(row, ["id", "meanRankSkill"]); assert.ok(Number.isFinite(row.meanRankSkill) && Math.abs(row.meanRankSkill) <= 1); });
        assert.equal(candidate.meanRankSkill, mean(candidate.groups.map(row => row.meanRankSkill)));
      }
      assert.equal(group.lambda, selectLambda(group.candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill }))));
    }
    assert.equal(result.meanRankSkill, mean(result.groups.map(group => group.meanRankSkill)));
  }
  closed(study.propagation, ["meanRankSkill", "groups"]);
  assert.deepEqual(study.propagation.groups.map(group => group.id), ids);
  for (const [i, group] of study.propagation.groups.entries()) {
    closed(group, ["id", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB", "interventions"]);
    groupMetrics(group, groups[i]);
  }
  assert.equal(study.propagation.meanRankSkill, mean(study.propagation.groups.map(group => group.meanRankSkill)));
  const pairs = [["B+F+O+flow", "B"], ["B+F", "B"], ["B+O", "B"], ["B+flow", "B"], ["B+F+O", "B+F"], ["B+F+O+flow", "B+F+O"]];
  const comparisons = pairs.map(([left, right]) => ({ left, right, ...pairedSummary(study.ablations[left].groups, study.ablations[right].groups) }));
  assert.deepEqual(study.comparisons, comparisons); assert.deepEqual(study.primary, comparisons[0]);
}
