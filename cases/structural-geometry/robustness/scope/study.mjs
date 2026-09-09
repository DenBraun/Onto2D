import assert from "node:assert/strict";
import { verifyReport as verifyMetric } from "../metric/build.mjs";
import { verifyReport as verifyAnatomy } from "../anatomy/build.mjs";
import { loadSources as loadCapacity } from "../metric/study.mjs";
import { PROFILE, census, degrees, nodeCoverage, binCoverage, matchPopulation, graphOf, values } from "./selection.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { carrier, measure } from "../metric/geometry.mjs";
import { graphCapacityFeatures } from "../capacity/features.mjs";
import { fitOuter } from "../capacity/evaluation.mjs";
import { groupedFolds } from "../../protocol/model.mjs";
import { modelSummary, compareGroups } from "../metric/evaluation.mjs";
import { readJson } from "./io.mjs";

export async function loadSources() {
  const metric = await verifyMetric(), anatomy = await verifyAnatomy(), capacity = await loadCapacity();
  const worm = await readJson("../../celegans/results.json");
  const d5 = await readJson("../../celegans/cache/details.json", { hash: worm.localDetailsSha256, maximum: 64000000 });
  const d62 = await readJson("../anatomy/cache/details.json", { hash: anatomy.localDetailsSha256, maximum: 128000000 });
  assert.deepEqual(Object.keys(d62.prior).sort(), ["anatomy", "geometry", "matched", "responses"]);
  for (const key of ["anatomy", "responses", "matched"]) assert.equal(digest(d62.prior[key]), digest(d5.data[key]), `D6.2 prior ${key} differs from D5.`);
  const units = [d5.data, d62.data].map(data => ({ id: data.anatomy.id, parent: data.anatomy.parent,
    metadata: { labels: data.plan.labels, events: data.plan.events }, population: data.matched.population }));
  return { dependencies: { metric: metric.reportSha256, anatomy: anatomy.reportSha256, capacity: capacity.capacity.reportSha256 },
    units, capacity, originalRows: values(capacity.targets[2].rows) };
}
export function sourceAudit(sources) {
  const units = sources.units.map(source => {
    const unit = census(source.parent, source.id), nodes = nodeCoverage(unit, source.metadata, source.population);
    return { ...unit, nodes, bins: binCoverage(nodes), targetCoverageRole: source.id === "Dataset7" ? "eligible-primary" : "eligible-candidates-in-unavailable-primary" };
  });
  const dream4 = sources.capacity.scopes.filter(s => s.datasetId !== "Dataset7").map(scope => ({ id: scope.datasetId, parent: scope.graph,
    nodes: degrees(scope.graph).map(node => ({ ...node, includedInFullGraph: true, knockoutSourcePairs: 9, knockoutReceiverPairs: 9, knockdownSourcePairs: 9, knockdownReceiverPairs: 9 })) }));
  const primary = units[0];
  return { format: "onto2d-scope-source-audit-v1", profileChoicesSha256: digest(PROFILE), dependencies: sources.dependencies,
    comparativeScoresComputed: false, units, dream4, originalTargets: sources.originalRows,
    populations: PROFILE.variants.map(variant => ({ variant, ...matchPopulation(sources.originalRows, primary.selections.filter(s => s.variant === variant)) })) };
}
export function compareContexts(contexts) {
  const [a, b] = contexts.map(c => c.models), groups = (models, name) => models[name].summary.groups;
  const pairs = [[a,"B+S+G",a,"B+S"],[b,"B+S+G",b,"B+S"],[a,"B+G",a,"B"],[b,"B+G",b,"B"],
    ...PROFILE.models.map(name => [b,name,a,name])];
  return Object.fromEntries(pairs.map(([l, ln, r, rn], i) => [PROFILE.comparisons[i], compareGroups(groups(l, ln), groups(r, rn))]));
}
export function fitContext(rows, costs = {}) {
  assert.ok(rows.length > 0 && rows.length <= PROFILE.limits.targetRows);
  assert.ok(rows.every(r => r.eligible && r.x.length === 116 && r.x.every(Number.isFinite) && Number.isFinite(r.magnitude) && r.magnitude >= 0 && r.y >= 0 && r.y <= 1));
  const folds = groupedFolds(rows); assert.ok(folds.length >= 5);
  const trace = { rows, folds, ablations: {} }, models = {};
  for (const name of PROFILE.models) {
    costs[name] = [];
    trace.ablations[name] = folds.map(fold => { const cost = { heldOut: fold.heldOut }; costs[name].push(cost); return fitOuter(rows, name, fold, cost); });
    models[name] = modelSummary(name, trace.ablations[name]);
  }
  return { models, trace };
}
export function joinRows(rows, scopes) {
  return rows.map(row => {
    const scope = scopes.find(s => s.root === row.source); assert.ok(scope && scope.geometry && scope.features);
    const feature = scope.features.pairs.find(p => p.source === row.source && p.target === row.target);
    const geometry = scope.geometry.pairs.find(p => p.source === row.source && p.target === row.target);
    assert.ok(feature && geometry); assert.deepEqual(feature.baseline, geometry.baseline);
    return { ...row, x: [...feature.baseline, ...feature.quadratic, ...feature.expanded, ...geometry.geometry] };
  });
}
export async function runVariant(sources, audit, variant, analyze = measure) {
  const population = audit.populations.find(p => p.variant === variant), scopes = [], costs = { variant, geometry: [], fitting: [] };
  const unavailable = reason => ({ variant, status: "unavailable", reason, scopes, contexts: null, comparisons: null });
  if (population.status !== "complete") return { details: unavailable(population.reason), costs };
  const roots = population.groups.filter(g => g.eligible).map(g => g.id), parent = audit.units[0].parent;
  for (const root of roots) {
    const start = performance.now(), selection = audit.units[0].selections.find(s => s.variant === variant && s.root === root);
    const context = carrier(graphOf(parent, selection), JSON.stringify([PROFILE.id, variant, root]));
    const measured = await analyze(context, "unit-half");
    const features = measured.status === "complete" ? graphCapacityFeatures(context.graph) : null;
    scopes.push({ root, context, measured, features }); costs.geometry.push({ root, elapsedMs: performance.now() - start, sampledRssBytes: process.memoryUsage().rss });
    console.log(`D6.5 ${variant}/${root}: ${measured.status}${measured.reason ? ` (${measured.reason})` : ""}`);
  }
  if (scopes.some(s => s.measured.status !== "complete")) return { details: unavailable("required-target-scope-computation-failed"), costs };
  const referenceScopes = sources.capacity.scopes.filter(s => s.datasetId === "Dataset7" && roots.includes(s.root));
  if (variant === "weak-one") for (const scope of scopes) {
    const prior = referenceScopes.find(s => s.root === scope.root);
    assert.deepEqual(scope.features, prior.features); assert.deepEqual(scope.measured.geometry.pairs, prior.geometry.pairs);
  }
  const contexts = [referenceScopes, scopes.map(s => ({ ...s, geometry: s.measured.geometry }))].map((items, index) => {
    const cost = {}; costs.fitting.push(cost); const { models, trace } = fitContext(joinRows(population.rows, items), cost);
    return { id: index === 0 ? "reference" : "alternative", models, trace };
  });
  if (variant === "weak-one") for (const context of contexts) for (const name of PROFILE.models) {
    assert.deepEqual(context.models[name].summary, sources.capacity.targets[2].original.report.ablations[name]);
    assert.deepEqual(context.models[name].outerEvidence, sources.capacity.targets[2].original.outerEvidence[name]);
  }
  return { details: { variant, status: "complete", reason: null, scopes, contexts, comparisons: compareContexts(contexts) }, costs };
}
