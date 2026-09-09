import assert from "node:assert/strict";
import { digest } from "../../datasets/scopes.mjs";
import { summarizePredictions } from "../../dream4/evaluation.mjs";
import { RIDGE_PROFILE, selectLambda } from "../../protocol/model.mjs";
import { FEATURE_NAMES, MODELS, PROFILE } from "./features.mjs";
import { targetValues, groupsOf } from "./study.mjs";
import { comparisonsFor } from "./evaluation.mjs";

export const closed = (value, fields) => assert.deepEqual(Object.keys(value).sort(), [...fields].sort());
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const score = value => assert.ok(Number.isFinite(value) && value >= -1 && value <= 1);

export function summarizeStudy(id, result) {
  return { id, targets: targetValues(result.trace.rows), report: result.report,
    outerEvidence: Object.fromEntries(Object.entries(result.trace.ablations).map(([name, rows]) => [name, rows.map(row => ({ id: row.heldOut,
      predictions: row.predictions, modelSha256: digest(row.model) }))])) };
}

export function validateStudy(study, target, original = null) {
  closed(study, ["id", "targets", "report", "outerEvidence"]);
  assert.equal(study.id, target.id); assert.equal(study.targets.length, target.targetCount);
  assert.equal(digest(study.targets), target.targetValuesSha256); assert.deepEqual(groupsOf(study.targets), target.groups);
  assert.equal(new Set(study.targets.map(row => row.id)).size, study.targets.length);
  const report = study.report, ids = target.groups.map(row => row.id);
  closed(report, ["status", "reason", "ablations", "comparisons", "primary", "capacity"]);
  assert.equal(report.status, "complete"); assert.equal(report.reason, null); assert.ok(ids.length >= 5);
  assert.deepEqual(Object.keys(report.ablations), PROFILE.models); assert.deepEqual(Object.keys(report.capacity), PROFILE.models);
  assert.deepEqual(Object.keys(study.outerEvidence), PROFILE.models);
  for (const [name, result] of Object.entries(report.ablations)) {
    closed(result, ["featureCount", "meanRankSkill", "groups"]); assert.equal(result.featureCount, MODELS[name].length);
    assert.deepEqual(result.groups.map(row => row.id), ids);
    assert.deepEqual(study.outerEvidence[name].map(row => row.id), ids); assert.deepEqual(report.capacity[name].map(row => row.id), ids);
    for (const [i, group] of result.groups.entries()) {
      closed(group, ["id", "lambda", "candidates", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB", "interventions"]);
      const rows = study.targets.filter(row => row.groupId === group.id).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const evidence = study.outerEvidence[name][i]; closed(evidence, ["id", "predictions", "modelSha256"]); assert.match(evidence.modelSha256, /^[a-f0-9]{64}$/);
      const { id, lambda, candidates, ...summary } = group;
      assert.deepEqual(summary, summarizePredictions(rows, evidence.predictions));
      assert.deepEqual(candidates.map(row => row.lambda), RIDGE_PROFILE.lambdas);
      for (const candidate of candidates) {
        closed(candidate, ["lambda", "meanRankSkill", "groups"]);
        assert.deepEqual(candidate.groups.map(row => row.id), ids.filter(other => other !== id));
        candidate.groups.forEach(row => { closed(row, ["id", "meanRankSkill"]); score(row.meanRankSkill); });
        assert.equal(candidate.meanRankSkill, mean(candidate.groups.map(row => row.meanRankSkill)));
      }
      assert.equal(lambda, selectLambda(candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill }))));
      const capacity = report.capacity[name][i]; closed(capacity, ["id", "constantColumns", "nonconstantColumnCount"]);
      const names = MODELS[name].map(index => FEATURE_NAMES[index]), constant = capacity.constantColumns;
      assert.deepEqual(constant, names.filter(name => constant.includes(name)));
      assert.equal(capacity.nonconstantColumnCount, names.length - constant.length);
    }
    assert.equal(result.meanRankSkill, mean(result.groups.map(row => row.meanRankSkill)));
  }
  const comparisons = comparisonsFor(report.ablations);
  assert.deepEqual(report.comparisons, comparisons); assert.deepEqual(report.primary, comparisons[0]);
  if (original) {
    assert.deepEqual(report.ablations.B, original.ablations.B, "B no longer reproduces its primary study.");
    assert.deepEqual(report.ablations["B+G"], original.ablations["B+F+O+flow"], "Full geometry no longer reproduces its primary study.");
  }
}
