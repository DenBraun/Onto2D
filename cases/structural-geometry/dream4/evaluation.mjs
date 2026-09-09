import { performance } from "node:perf_hooks";
import { BASELINE_FEATURE_NAMES } from "../protocol/baselines.mjs";
import { prepareDreamPopulation } from "../protocol/populations.mjs";
import { rankMetrics } from "../protocol/metrics.mjs";
import { RIDGE_PROFILE, groupedFolds, balancedTrainingRows, fitRidge, predictRidge, selectLambda } from "../protocol/model.mjs";
import { GEOMETRY_FEATURE_NAMES, PROFILE_ID } from "./geometry.mjs";

const range = (start, count) => Array.from({ length: count }, (_, i) => start + i);
export const FEATURE_NAMES = Object.freeze([...BASELINE_FEATURE_NAMES, ...GEOMETRY_FEATURE_NAMES]);
export const ABLATIONS = Object.freeze(Object.fromEntries([
  ["B", range(0, 23)], ["B+F", range(0, 29)], ["B+O", [...range(0, 23), ...range(29, 6)]],
  ["B+flow", [...range(0, 23), ...range(35, 19)]], ["B+F+O", range(0, 35)], ["B+F+O+flow", range(0, 54)]
].map(([name, columns]) => [name, Object.freeze(columns)])));
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

export function summarizePredictions(rows, predictions) {
  if (rows.length !== predictions.length || !rows.length || predictions.some(value => !Number.isFinite(value))) {
    throw new Error("Predictions must cover every eligible observation with finite values.");
  }
  const ids = [...new Set(rows.map(row => row.interventionId))].sort();
  const interventions = ids.map(id => {
    const indexes = rows.flatMap((row, i) => row.interventionId === id ? [i] : []);
    const metrics = rankMetrics(indexes.map(i => predictions[i]), indexes.map(i => rows[i].magnitude));
    if (metrics.rankSkill.value === null) throw new Error("Eligible intervention has undefined rank skill.");
    return { id, ...metrics };
  });
  const secondary = name => {
    const unavailable = interventions.filter(row => row[name].value === null);
    return { mean: unavailable.length ? null : mean(interventions.map(row => row[name].value)),
      undefinedInterventions: unavailable.map(row => ({ id: row.id, reason: row[name].reason })) };
  };
  return { targetCount: rows.length, interventionCount: interventions.length,
    meanRankSkill: mean(interventions.map(row => row.rankSkill.value)),
    spearman: secondary("spearman"), kendallTauB: secondary("kendallTauB"), interventions };
}

function timed(costs, phase, fn) {
  const start = performance.now();
  try { return fn(); } finally {
    if (costs) {
      costs[`${phase}Ms`] = (costs[`${phase}Ms`] ?? 0) + performance.now() - start;
      costs[`${phase}Calls`] = (costs[`${phase}Calls`] ?? 0) + 1;
      costs[`${phase}SampledRssBytes`] = Math.max(costs[`${phase}SampledRssBytes`] ?? 0, process.memoryUsage().rss);
    }
  }
}

export function fitOuter(rows, name, heldOut, costs = null) {
  const columns = ABLATIONS[name];
  if (!columns) throw new Error("Unknown frozen ablation.");
  const folds = groupedFolds(rows), fold = folds.find(item => item.heldOut === heldOut);
  if (!fold) throw new Error("Unknown held-out group.");
  const mapped = new Map(rows.map(row => [row.id, { ...row, x: columns.map(column => row.x[column]) }]));
  const select = ids => ids.map(id => mapped.get(id));
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
    return { lambda, meanRankSkill: mean(validation.map(result => result.summary.meanRankSkill)), validation };
  });
  const lambda = selectLambda(candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill })));
  return { heldOut, lambda, candidates, ...fit(fold.trainIds, fold.testIds, lambda) };
}

export function pairedSummary(left, right) {
  if (!left.length || left.length !== right.length || left.some((row, i) => row.id !== right[i].id ||
      !Number.isFinite(row.meanRankSkill) || !Number.isFinite(right[i].meanRankSkill))) throw new Error("Paired group populations differ.");
  const groups = left.map((row, i) => ({ id: row.id, delta: row.meanRankSkill - right[i].meanRankSkill }));
  const values = groups.map(row => row.delta), delta = mean(values);
  const leaveOneGroupOut = groups.map(row => ({ omitted: row.id, meanDelta: mean(groups.filter(other => other !== row).map(other => other.delta)) }));
  return { groups, meanDelta: delta, minimum: Math.min(...values), maximum: Math.max(...values),
    leaveOneGroupOut, leaveOneGroupOutRange: [Math.min(...leaveOneGroupOut.map(row => row.meanDelta)), Math.max(...leaveOneGroupOut.map(row => row.meanDelta))],
    interpretation: delta > 0 ? "limited-fixed-representation-gain" : "no-observed-gain-for-this-pipeline",
    uncertainty: "descriptive-group-sensitivity-not-a-confidence-interval" };
}

export function evaluateRows(rows, costs = null) {
  if (!Array.isArray(rows) || rows.some(row => !Array.isArray(row.x) || row.x.length !== 54 ||
      Object.keys(row.x).length !== 54 || row.x.some(value => !Number.isFinite(value)) ||
      !Number.isFinite(row.y) || row.y < 0 || row.y > 1 || !Number.isFinite(row.magnitude) || row.magnitude < 0)) {
    throw new Error("Evaluation requires the complete finite 54-coordinate population.");
  }
  const folds = groupedFolds(rows), trace = {}, ablations = {};
  for (const name of Object.keys(ABLATIONS)) {
    const results = folds.map(fold => {
      const measured = costs ? {} : null, result = fitOuter(rows, name, fold.heldOut, measured);
      if (costs) {
        costs.byAblation ??= {}; costs.byAblation[name] ??= [];
        costs.byAblation[name].push({ heldOut: fold.heldOut, ...measured });
        for (const [key, value] of Object.entries(measured)) {
          costs[key] = key.endsWith("RssBytes") ? Math.max(costs[key] ?? 0, value) : (costs[key] ?? 0) + value;
        }
      }
      return result;
    });
    trace[name] = results;
    const groups = results.map(result => ({ id: result.heldOut, lambda: result.lambda,
      candidates: result.candidates.map(candidate => ({ lambda: candidate.lambda, meanRankSkill: candidate.meanRankSkill,
        groups: candidate.validation.map(row => ({ id: row.validationGroup, meanRankSkill: row.summary.meanRankSkill })) })),
      ...result.summary }));
    ablations[name] = { featureCount: ABLATIONS[name].length, meanRankSkill: mean(groups.map(row => row.meanRankSkill)), groups };
  }
  const propagationGroups = folds.map(fold => {
    const heldOut = rows.filter(row => row.groupId === fold.heldOut).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const predictions = heldOut.map(({ x }) => (x[7] ? 1 / x[4] : 0) / 2 + x[20] / 4 + x[21] / 8 + x[22] / 16);
    return { id: fold.heldOut, ...summarizePredictions(heldOut, predictions) };
  });
  const comparisons = [["B+F+O+flow", "B"], ["B+F", "B"], ["B+O", "B"], ["B+flow", "B"], ["B+F+O", "B+F"], ["B+F+O+flow", "B+F+O"]]
    .map(([left, right]) => ({ left, right, ...pairedSummary(ablations[left].groups, ablations[right].groups) }));
  return { report: { status: "complete", reason: null, ablations, comparisons,
    primary: comparisons[0], propagation: { meanRankSkill: mean(propagationGroups.map(row => row.meanRankSkill)), groups: propagationGroups } },
  trace: { rows, folds, ablations: trace } };
}

export function prepareContrast(units, geometry, contrast) {
  const population = prepareDreamPopulation(units, contrast);
  const byUnit = new Map(geometry.map(unit => [unit.id, unit]));
  if (byUnit.size !== geometry.length || geometry.length !== 5 || units.some(unit => !byUnit.has(unit.id))) {
    throw new Error("Geometry must account for all five source networks exactly once.");
  }
  const features = new Map(), exclusions = [];
  for (const unit of units) {
    const entry = byUnit.get(unit.id);
    if (entry.status !== "complete") { exclusions.push({ groupId: unit.id, reason: entry.reason }); continue; }
    if (entry.geometry.profileId !== PROFILE_ID || entry.geometry.pairs.length !== 90 ||
        JSON.stringify(entry.geometry.featureNames) !== JSON.stringify(GEOMETRY_FEATURE_NAMES)) throw new Error("Geometry feature profile differs.");
    const seen = new Set();
    for (const pair of entry.geometry.pairs) {
      const key = JSON.stringify([unit.id, pair.source, pair.target]);
      if (seen.has(key) || pair.source === pair.target || !unit.nodes.includes(pair.source) || !unit.nodes.includes(pair.target) ||
          pair.baseline.length !== 23 || pair.geometry.length !== 31) throw new Error("Geometry pair population differs.");
      seen.add(key); features.set(key, [...pair.baseline, ...pair.geometry]);
    }
  }
  for (const group of population.groups) for (const intervention of group.interventions) {
    if (!intervention.eligible) exclusions.push({ groupId: group.id, interventionId: intervention.id, reason: intervention.reason });
  }
  const rows = population.rows.map(row => ({ ...row, x: features.get(JSON.stringify([row.groupId, row.source, row.target])) ?? null }));
  const coverage = { ...population.coverage, geometryGroups: geometry.filter(unit => unit.status === "complete").length,
    matchedRows: rows.filter(row => row.eligible && row.x !== null).length };
  return { population, rows, coverage, exclusions, complete: population.status === "complete" && !exclusions.length };
}

export function evaluateContrast(prepared, costs = null) {
  const { population, rows, coverage, exclusions } = prepared;
  const base = { contrast: population.contrast, role: population.role, coverage, exclusions };
  if (!prepared.complete) return { report: { ...base, status: "unavailable", reason: "complete-matched-population-required", primary: null }, trace: null };
  try {
    const result = evaluateRows(rows, costs);
    return { report: { ...base, ...result.report }, trace: result.trace };
  } catch (error) {
    return { report: { ...base, status: "unavailable", reason: "required-computation-failed", diagnostic: error.message, primary: null }, trace: null };
  }
}
