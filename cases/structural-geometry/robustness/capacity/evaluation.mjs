import assert from "node:assert/strict";
import { RIDGE_PROFILE, groupedFolds, balancedTrainingRows, fitRidge, predictRidge, selectLambda } from "../../protocol/model.mjs";
import { summarizePredictions, pairedSummary } from "../../dream4/evaluation.mjs";
import { FEATURE_NAMES, MODELS, PROFILE } from "./features.mjs";
import { fraction, add, divide, encodedFraction } from "../../../../packages/structural-geometry/src/rational.js";

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const exactMean = values => divide(values.reduce(add, fraction(0n)), fraction(BigInt(values.length)));
const exactGroup = group => exactMean(group.interventions.map(row => fraction(BigInt(row.rankSkill.numerator), BigInt(row.rankSkill.denominator))));
const difference = (a, b) => add(a, fraction(-b.n, b.d));

export function comparisonsFor(ablations) {
  return PROFILE.comparisons.map(([left, right]) => {
    const a = ablations[left].groups, b = ablations[right].groups, raw = pairedSummary(a, b);
    const deltas = a.map((row, i) => difference(exactGroup(row), exactGroup(b[i]))), exact = exactMean(deltas);
    return { left, right, ...raw, groups: raw.groups.map((row, i) => ({ ...row, exactDelta: encodedFraction(deltas[i]) })),
      exactMeanDelta: encodedFraction(exact), interpretation: exact.n > 0n ? "limited-fixed-representation-gain" : "no-observed-gain-for-this-pipeline" };
  });
}
function timed(costs, phase, fn) {
  const start = performance.now();
  try { return fn(); } finally {
    costs[`${phase}Ms`] = (costs[`${phase}Ms`] ?? 0) + performance.now() - start;
    costs[`${phase}Calls`] = (costs[`${phase}Calls`] ?? 0) + 1;
    costs[`${phase}SampledRssBytes`] = Math.max(costs[`${phase}SampledRssBytes`] ?? 0, process.memoryUsage().rss);
  }
}

export function fitOuter(rows, name, fold, costs = {}) {
  const columns = MODELS[name]; assert.ok(columns);
  const mapped = new Map(rows.map(row => [row.id, { ...row, x: columns.map(column => row.x[column]) }]));
  const select = ids => ids.map(id => { assert.ok(mapped.has(id)); return mapped.get(id); });
  const fit = (trainIds, testIds, lambda) => {
    const train = select(trainIds), test = select(testIds);
    const model = timed(costs, "fitting", () => fitRidge(balancedTrainingRows(train), lambda));
    const predictions = timed(costs, "inference", () => test.map(row => predictRidge(model, row.x)));
    return { model, predictions, summary: summarizePredictions(test, predictions) };
  };
  const candidates = RIDGE_PROFILE.lambdas.map(lambda => {
    const validation = fold.inner.map(inner => {
      const result = fit(inner.trainIds, inner.validationIds, lambda);
      return { validationGroup: inner.validationGroup, model: result.model, predictions: result.predictions,
        summary: { meanRankSkill: result.summary.meanRankSkill } };
    });
    return { lambda, meanRankSkill: mean(validation.map(row => row.summary.meanRankSkill)), validation };
  });
  const lambda = selectLambda(candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill })));
  return { heldOut: fold.heldOut, lambda, candidates, ...fit(fold.trainIds, fold.testIds, lambda) };
}

export function summarizeModels(trace) {
  const ablations = Object.fromEntries(Object.entries(trace.ablations).map(([name, results]) => {
    const groups = results.map(result => ({ id: result.heldOut, lambda: result.lambda,
      candidates: result.candidates.map(candidate => ({ lambda: candidate.lambda, meanRankSkill: candidate.meanRankSkill,
        groups: candidate.validation.map(row => ({ id: row.validationGroup, meanRankSkill: row.summary.meanRankSkill })) })), ...result.summary }));
    return [name, { featureCount: MODELS[name].length, meanRankSkill: mean(groups.map(row => row.meanRankSkill)), groups }];
  }));
  const comparisons = comparisonsFor(ablations);
  const capacity = Object.fromEntries(Object.entries(trace.ablations).map(([name, rows]) => [name, rows.map(row => ({ id: row.heldOut,
    constantColumns: MODELS[name].filter((_, i) => row.model.scales[i] === 0).map(i => FEATURE_NAMES[i]),
    nonconstantColumnCount: row.model.scales.filter(scale => scale !== 0).length }))]));
  return { status: "complete", reason: null, ablations, comparisons, primary: comparisons[0], capacity };
}

export function evaluateRows(rows, costs = {}) {
  assert.ok(Array.isArray(rows) && rows.length > 0 && rows.length <= PROFILE.limits.rows);
  assert.ok(rows.every(row => Array.isArray(row.x) && row.x.length === 116 && Object.keys(row.x).length === 116 && row.x.every(Number.isFinite) &&
    Number.isFinite(row.y) && row.y >= 0 && row.y <= 1 && Number.isFinite(row.magnitude) && row.magnitude >= 0 && row.eligible));
  const folds = groupedFolds(rows); assert.ok(folds.length >= 5);
  const trace = { rows, folds, ablations: {} };
  for (const name of PROFILE.models) {
    costs[name] = [];
    trace.ablations[name] = folds.map(fold => {
      const measured = { heldOut: fold.heldOut }; costs[name].push(measured);
      return fitOuter(rows, name, fold, measured);
    });
  }
  return { report: summarizeModels(trace), trace };
}
