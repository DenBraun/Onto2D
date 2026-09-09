import assert from "node:assert/strict";
import { groupedFolds } from "../../protocol/model.mjs";
import { fitOuter } from "../capacity/evaluation.mjs";
import { FEATURE_NAMES, MODELS } from "../capacity/features.mjs";
import { pairedSummary } from "../../dream4/evaluation.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { fraction, add, divide, encodedFraction } from "../../../../packages/structural-geometry/src/rational.js";
import { PROFILE } from "./geometry.mjs";

export const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const exactMean = values => divide(values.reduce(add, fraction(0n)), fraction(BigInt(values.length)));
const exactGroup = row => exactMean(row.interventions.map(i => fraction(BigInt(i.rankSkill.numerator), BigInt(i.rankSkill.denominator))));
export function compareGroups(left, right) {
  const raw = pairedSummary(left, right);
  const deltas = left.map((row, i) => { const a = exactGroup(row), b = exactGroup(right[i]); return add(a, fraction(-b.n, b.d)); });
  const exact = exactMean(deltas);
  return { ...raw, groups: raw.groups.map((row, i) => ({ ...row, exactDelta: encodedFraction(deltas[i]) })),
    exactMeanDelta: encodedFraction(exact), interpretation: exact.n > 0n ? "higher" : exact.n < 0n ? "lower" : "equal" };
}
export function modelSummary(name, results) {
  const groups = results.map(result => ({ id: result.heldOut, lambda: result.lambda,
    candidates: result.candidates.map(candidate => ({ lambda: candidate.lambda, meanRankSkill: candidate.meanRankSkill,
      groups: candidate.validation.map(row => ({ id: row.validationGroup, meanRankSkill: row.summary.meanRankSkill })) })), ...result.summary }));
  return { summary: { featureCount: MODELS[name].length, meanRankSkill: mean(groups.map(row => row.meanRankSkill)), groups },
    outerEvidence: results.map(row => ({ id: row.heldOut, predictions: row.predictions, modelSha256: digest(row.model) })),
    capacity: results.map(row => ({ id: row.heldOut, constantColumns: MODELS[name].filter((_, i) => row.model.scales[i] === 0).map(i => FEATURE_NAMES[i]),
      nonconstantColumnCount: row.model.scales.filter(scale => scale !== 0).length })) };
}
export const comparisons = (models, original) => ({
  expandedGain: compareGroups(models["B+S+G"].summary.groups, original.ablations["B+S"].groups),
  originalGain: compareGroups(models["B+G"].summary.groups, original.ablations.B.groups),
  expandedReferenceDifference: compareGroups(models["B+S+G"].summary.groups, original.ablations["B+S+G"].groups),
  originalReferenceDifference: compareGroups(models["B+G"].summary.groups, original.ablations["B+G"].groups)
});
export function evaluate(rows, original, costs = {}) {
  assert.ok(Array.isArray(rows) && rows.length > 0 && rows.length <= 4096);
  assert.ok(rows.every(row => Array.isArray(row.x) && row.x.length === 116 && Object.keys(row.x).length === 116 && row.x.every(Number.isFinite) &&
    row.eligible && Number.isFinite(row.y) && row.y >= 0 && row.y <= 1 && Number.isFinite(row.magnitude) && row.magnitude >= 0));
  const folds = groupedFolds(rows); assert.ok(folds.length >= 5);
  const trace = { rows, folds, ablations: {} }, models = {};
  for (const name of PROFILE.models) {
    costs[name] = [];
    trace.ablations[name] = folds.map(fold => { const measured = { heldOut: fold.heldOut }; costs[name].push(measured); return fitOuter(rows, name, fold, measured); });
    models[name] = modelSummary(name, trace.ablations[name]);
  }
  return { report: { status: "complete", reason: null, failures: [], models, comparisons: comparisons(models, original) }, trace };
}

export const unavailable = failures => ({ status: "unavailable", reason: "all-original-prepared-scopes-required", failures, models: null, comparisons: null });
