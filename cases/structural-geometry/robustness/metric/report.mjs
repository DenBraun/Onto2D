import assert from "node:assert/strict";
import { digest } from "../../datasets/scopes.mjs";
import { RIDGE_PROFILE, selectLambda } from "../../protocol/model.mjs";
import { summarizePredictions } from "../../dream4/evaluation.mjs";
import { FEATURE_NAMES, MODELS } from "../capacity/features.mjs";
import { closed } from "../capacity/report.mjs";
import { PROFILE, LIMIT_REASONS } from "./geometry.mjs";
import { comparisons, mean, unavailable } from "./evaluation.mjs";

export const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
export const integer = (value, maximum) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= maximum);
export function summarizeScope(scope, original) {
  const m = scope.measured, complete = m.status === "complete", changed = (a, b) => digest(a) !== digest(b);
  return { id: scope.id, datasetId: scope.datasetId, root: scope.root, graphSha256: digest(scope.context.graph), status: m.status, reason: m.reason,
    providerHash: m.provider.artifactHash, requestHash: m.request?.requestHash ?? null, flowHash: m.flow?.artifactHash ?? null,
    geometrySha256: complete ? digest(m.geometry) : null,
    stateCount: m.flow?.states.length ?? 0, pairCount: m.geometry?.pairs.length ?? 0, termination: m.flow?.termination ?? null,
    changedPairs: complete ? m.geometry.pairs.filter((p, i) => changed(p.exact, original.geometry.pairs[i].exact)).length : null,
    changedStaticEdges: complete ? m.geometry.fields.filter((p, i) => changed(p.ollivier, original.geometry.fields[i].ollivier)).length : null,
    changedTerminalLengths: complete ? m.geometry.fields.filter((p, i) => changed(p.length, original.geometry.fields[i].length)).length : null };
}

export function validateModel(model, name, original) {
  closed(model, ["summary", "outerEvidence", "capacity"]);
  const ids = original.report.ablations.B.groups.map(g => g.id), summary = model.summary;
  closed(summary, ["featureCount", "meanRankSkill", "groups"]);
  assert.equal(summary.featureCount, MODELS[name].length);
  for (const values of [summary.groups, model.outerEvidence, model.capacity]) assert.deepEqual(values.map(g => g.id), ids);
  for (const [i, group] of summary.groups.entries()) {
    closed(group, ["id", "lambda", "candidates", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB", "interventions"]);
    const evidence = model.outerEvidence[i]; closed(evidence, ["id", "predictions", "modelSha256"]); hash(evidence.modelSha256);
    const rows = original.targets.filter(row => row.groupId === group.id).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const { id, lambda, candidates, ...statistics } = group;
    assert.deepEqual(statistics, summarizePredictions(rows, evidence.predictions));
    assert.deepEqual(candidates.map(c => c.lambda), RIDGE_PROFILE.lambdas);
    for (const c of candidates) {
      closed(c, ["lambda", "meanRankSkill", "groups"]); assert.deepEqual(c.groups.map(g => g.id), ids.filter(other => other !== id));
      c.groups.forEach(g => { closed(g, ["id", "meanRankSkill"]); assert.ok(Number.isFinite(g.meanRankSkill) && Math.abs(g.meanRankSkill) <= 1); });
      assert.equal(c.meanRankSkill, mean(c.groups.map(g => g.meanRankSkill)));
    }
    assert.equal(lambda, selectLambda(candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill }))));
    const capacity = model.capacity[i], names = MODELS[name].map(i => FEATURE_NAMES[i]);
    closed(capacity, ["id", "constantColumns", "nonconstantColumnCount"]);
    assert.deepEqual(capacity.constantColumns, names.filter(name => capacity.constantColumns.includes(name)));
    assert.equal(capacity.nonconstantColumnCount, names.length - capacity.constantColumns.length);
  }
  assert.equal(summary.meanRankSkill, mean(summary.groups.map(g => g.meanRankSkill)));
}

export function validateVariant(variant, capacity) {
  closed(variant, ["id", "scopes", "studies", "independent", "localDetailsSha256"]);
  assert.ok(PROFILE.variants.some(v => v.id === variant.id)); hash(variant.localDetailsSha256);
  assert.deepEqual(variant.scopes.map(s => s.id), capacity.scopes.map(s => s.id));
  let states = 0, pairs = 0, staticEdges = 0, failedAttemptsRetained = 0;
  for (const [i, scope] of variant.scopes.entries()) {
    closed(scope, ["id", "datasetId", "root", "graphSha256", "status", "reason", "providerHash", "requestHash", "flowHash", "geometrySha256", "stateCount", "pairCount", "termination", "changedPairs", "changedStaticEdges", "changedTerminalLengths"]);
    const source = capacity.scopes[i];
    for (const k of ["id", "datasetId", "root", "graphSha256"]) assert.equal(scope[k], source[k]);
    assert.match(scope.providerHash, /^sha256:[a-f0-9]{64}$/);
    if (scope.requestHash !== null) assert.match(scope.requestHash, /^sha256:[a-f0-9]{64}$/);
    if (scope.status === "complete") {
      assert.equal(scope.reason, null); assert.match(scope.flowHash, /^sha256:[a-f0-9]{64}$/); hash(scope.geometrySha256);
      assert.ok(scope.requestHash !== null); integer(scope.stateCount, 5); assert.ok(scope.stateCount > 0);
      assert.equal(scope.pairCount, source.pairCount);
      assert.equal(scope.termination.iteration, scope.stateCount - 1);
      closed(scope.termination, ["reason", "iteration", "cycleStart", "cyclePeriod", "edgeIds"]);
      assert.ok(["fixed-point", "tolerance", "cycle", "degenerate-length", "iteration-limit"].includes(scope.termination.reason));
      integer(scope.changedPairs, source.pairCount); integer(scope.changedStaticEdges, source.edgeCount); integer(scope.changedTerminalLengths, source.edgeCount);
      if (["unit-half", "double-unit-initial"].includes(variant.id)) assert.deepEqual([scope.changedPairs, scope.changedStaticEdges, scope.changedTerminalLengths], [0, 0, 0]);
      if (variant.id === "outdegree-initial") assert.equal(scope.changedStaticEdges, 0);
      states += scope.stateCount; pairs += scope.pairCount; staticEdges += source.edgeCount;
    } else {
      assert.equal(scope.status, "unavailable"); assert.ok(LIMIT_REASONS.includes(scope.reason));
      assert.ok(!["unit-half", "double-unit-initial"].includes(variant.id));
      for (const key of ["flowHash", "geometrySha256", "termination", "changedPairs", "changedStaticEdges", "changedTerminalLengths"]) assert.equal(scope[key], null);
      assert.equal(scope.stateCount, 0); assert.equal(scope.pairCount, 0); failedAttemptsRetained++;
    }
  }
  assert.deepEqual(variant.studies.map(s => s.id), PROFILE.studies);
  const fitting = []; let exactComparisonsChecked = 0;
  for (const [i, study] of variant.studies.entries()) {
    closed(study, ["id", "report"]);
    const original = capacity.studies[i], failures = variant.scopes.filter(s => (study.id.startsWith("dream4-") ? s.datasetId !== "Dataset7" : s.datasetId === "Dataset7") && s.status !== "complete")
      .map(s => ({ id: s.id, reason: s.reason }));
    if (failures.length) {
      assert.deepEqual(study.report, unavailable(failures)); fitting.push({ id: study.id, distinctReferenceFits: 0, predictionsChecked: 0 }); continue;
    }
    const report = study.report; closed(report, ["status", "reason", "failures", "models", "comparisons"]);
    assert.equal(report.status, "complete"); assert.equal(report.reason, null); assert.deepEqual(report.failures, []);
    assert.deepEqual(Object.keys(report.models), PROFILE.models);
    for (const name of PROFILE.models) {
      const model = report.models[name]; validateModel(model, name, original);
      if (["unit-half", "double-unit-initial"].includes(variant.id)) {
        assert.deepEqual(model.summary, original.report.ablations[name]); assert.deepEqual(model.outerEvidence, original.outerEvidence[name]);
        assert.deepEqual(model.capacity, original.report.capacity[name]);
      }
    }
    assert.deepEqual(report.comparisons, comparisons(report.models, original.report)); exactComparisonsChecked += 4;
    const g = original.report.ablations.B.groups.length;
    fitting.push({ id: study.id, distinctReferenceFits: g * (g - 1) / 2 * 10 + g * 2, predictionsChecked: original.targets.length * 2 * (5 * (g - 1) + 1) });
  }
  assert.deepEqual(variant.independent, { status: "verified", scopeCount: capacity.scopes.length, states, pairs, staticEdges, failedAttemptsRetained, fitting, exactComparisonsChecked });
}
