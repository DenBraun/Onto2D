import assert from "node:assert/strict";
import { digest } from "../datasets/scopes.mjs";
import { ABLATIONS, pairedSummary } from "../dream4/evaluation.mjs";
import { RIDGE_PROFILE, selectLambda } from "../protocol/model.mjs";
import { STOP_REASONS } from "../dream4/geometry.mjs";
import { NULL_PROFILE } from "./nulls.mjs";
import { rowScope } from "./study.mjs";

export const closed = (value, fields) => assert.deepEqual(Object.keys(value).sort(), [...fields].sort());
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const natural = (value, max = 10000000) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= max);
const score = value => assert.ok(Number.isFinite(value) && Math.abs(value) <= 1);
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(other => other === value).length]));

export function compactReport(report) {
  const group = ({ interventions, ...row }) => row;
  return { status: report.status, reason: report.reason,
    ablations: Object.fromEntries(Object.entries(report.ablations).map(([name, result]) => [name, { ...result, groups: result.groups.map(group) }])),
    comparisons: report.comparisons, primary: report.primary,
    propagation: { ...report.propagation, groups: report.propagation.groups.map(group) } };
}

export function targetSummary(target) {
  return { id: target.id, targetCount: target.rows.length, targetValuesSha256: digest(target.rows),
    requiredScopes: [...new Set(target.rows.map(row => rowScope(target.id, row)))].sort(),
    groups: [...new Set(target.rows.map(row => row.groupId))].sort().map(id => {
      const rows = target.rows.filter(row => row.groupId === id);
      return { id, targetCount: rows.length, interventionIds: [...new Set(rows.map(row => row.interventionId))].sort() };
    }), original: compactReport(target.original) };
}

export function summarizeReplicate(details, independent, localDetailsSha256) {
  return { nullIndex: details.nullIndex, localDetailsSha256,
    scopes: details.scopes.map(({ id, sampled: s, measured: m }) => ({ id,
      sampling: { status: s.status, reason: s.reason, graphSha256: s.graphSha256, accepted: s.accepted, required: s.required,
        proposals: s.proposals, outcomes: s.outcomes, changed: s.changed, attemptsSha256: digest(s.attempts) },
      geometry: m.status === "complete" ? { status: m.status, reason: null, pairCount: m.geometry.pairs.length,
        featuresSha256: digest(m.geometry), evidence: m.geometry.evidence, termination: m.geometry.termination } :
        { status: m.status, reason: m.reason, pairCount: null, featuresSha256: null, evidence: null, termination: null } })),
    studies: details.studies.map(({ trace, report, ...row }) => ({ ...row, report: report ? compactReport(report) : null })),
    independent };
}

function groupMetrics(group, expected) {
  assert.equal(group.targetCount, expected.targetCount); assert.equal(group.interventionCount, expected.interventionIds.length);
  score(group.meanRankSkill);
  for (const name of ["spearman", "kendallTauB"]) {
    const value = group[name]; closed(value, ["mean", "undefinedInterventions"]);
    const ids = value.undefinedInterventions.map(row => row.id);
    assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => expected.interventionIds.includes(id)));
    value.undefinedInterventions.forEach(row => { closed(row, ["id", "reason"]); assert.equal(row.reason, "constant-prediction"); });
    if (ids.length) assert.equal(value.mean, null); else score(value.mean);
  }
}

export function validateCompact(report, target) {
  closed(report, ["status", "reason", "ablations", "comparisons", "primary", "propagation"]);
  assert.equal(report.status, "complete"); assert.equal(report.reason, null);
  assert.deepEqual(Object.keys(report.ablations), Object.keys(ABLATIONS));
  const ids = target.groups.map(row => row.id);
  for (const [name, result] of Object.entries(report.ablations)) {
    closed(result, ["featureCount", "meanRankSkill", "groups"]);
    assert.equal(result.featureCount, ABLATIONS[name].length);
    assert.deepEqual(result.groups.map(row => row.id), ids);
    for (const [i, group] of result.groups.entries()) {
      closed(group, ["id", "lambda", "candidates", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB"]);
      groupMetrics(group, target.groups[i]);
      assert.deepEqual(group.candidates.map(row => row.lambda), RIDGE_PROFILE.lambdas);
      for (const candidate of group.candidates) {
        closed(candidate, ["lambda", "meanRankSkill", "groups"]);
        assert.deepEqual(candidate.groups.map(row => row.id), ids.filter(id => id !== group.id));
        for (const row of candidate.groups) { closed(row, ["id", "meanRankSkill"]); score(row.meanRankSkill); }
        assert.equal(candidate.meanRankSkill, mean(candidate.groups.map(row => row.meanRankSkill)));
      }
      assert.equal(group.lambda, selectLambda(group.candidates.map(({ lambda, meanRankSkill }) => ({ lambda, meanRankSkill }))));
    }
    assert.equal(result.meanRankSkill, mean(result.groups.map(row => row.meanRankSkill)));
  }
  closed(report.propagation, ["meanRankSkill", "groups"]);
  assert.deepEqual(report.propagation.groups.map(row => row.id), ids);
  for (const [i, group] of report.propagation.groups.entries()) {
    closed(group, ["id", "targetCount", "interventionCount", "meanRankSkill", "spearman", "kendallTauB"]);
    groupMetrics(group, target.groups[i]);
  }
  assert.equal(report.propagation.meanRankSkill, mean(report.propagation.groups.map(row => row.meanRankSkill)));
  const pairs = [["B+F+O+flow", "B"], ["B+F", "B"], ["B+O", "B"], ["B+flow", "B"], ["B+F+O", "B+F"], ["B+F+O+flow", "B+F+O"]];
  const comparisons = pairs.map(([left, right]) => ({ left, right, ...pairedSummary(report.ablations[left].groups, report.ablations[right].groups) }));
  assert.deepEqual(report.comparisons, comparisons); assert.deepEqual(report.primary, comparisons[0]);
}

export function summarizeAll(replicates, originals, targets) {
  const distribution = values => values.length ? { count: values.length, mean: mean(values), minimum: Math.min(...values), maximum: Math.max(...values) } :
    { count: 0, mean: null, minimum: null, maximum: null };
  return { scopes: originals.map(original => {
    const rows = replicates.map(row => row.scopes.find(scope => scope.id === original.id));
    const sampled = rows.filter(row => row.sampling.status === "complete"), multiplicities = counts(sampled.map(row => row.sampling.graphSha256));
    return { id: original.id, sampled: sampled.length, unavailable: rows.length - sampled.length,
      measured: rows.filter(row => row.geometry.status === "complete").length,
      unchanged: sampled.filter(row => !row.sampling.changed).length, distinctGraphs: Object.keys(multiplicities).length, multiplicities };
  }), studies: targets.map(target => {
    const rows = replicates.map(row => ({ nullIndex: row.nullIndex, ...row.studies.find(study => study.id === target.id) }));
    const complete = rows.filter(row => row.status === "complete"), originalDelta = target.original.primary.meanDelta;
    const deltas = complete.map(row => row.report.primary.meanDelta);
    return { id: target.id, planned: NULL_PROFILE.indices, complete: complete.length,
      unavailable: rows.filter(row => row.status !== "complete").map(row => ({ nullIndex: row.nullIndex, reason: row.reason, failures: row.failures })),
      originalMeanDelta: originalDelta,
      baseline: distribution(complete.map(row => row.report.ablations.B.meanRankSkill)),
      full: distribution(complete.map(row => row.report.ablations["B+F+O+flow"].meanRankSkill)),
      pairedDifference: distribution(deltas),
      relativeToOriginal: { below: deltas.filter(value => value < originalDelta).length,
        tied: deltas.filter(value => value === originalDelta).length, above: deltas.filter(value => value > originalDelta).length },
      interpretation: "descriptive-indexed-null-sensitivity-not-a-calibrated-p-value" };
  }) };
}

export function validateReplicate(rep, originals, targets) {
  closed(rep, ["nullIndex", "localDetailsSha256", "scopes", "studies", "independent"]); hash(rep.localDetailsSha256);
  assert.deepEqual(rep.scopes.map(row => row.id), originals.map(row => row.id));
  for (const [i, row] of rep.scopes.entries()) {
    closed(row, ["id", "sampling", "geometry"]);
    const original = originals[i], s = row.sampling, g = row.geometry;
    closed(s, ["status", "reason", "graphSha256", "accepted", "required", "proposals", "outcomes", "changed", "attemptsSha256"]);
    hash(s.graphSha256); hash(s.attemptsSha256); natural(s.proposals, 4096); natural(s.accepted, s.required);
    assert.equal(s.required, original.edgeCount * 10);
    assert.equal(s.changed, s.graphSha256 !== original.originalGraphSha256);
    assert.ok(Object.keys(s.outcomes).every(key => ["accepted", "equal-indices", "unchanged-edge-set", "self-loop", "parallel-arc", "component-membership"].includes(key)));
    Object.values(s.outcomes).forEach(value => natural(value, s.proposals));
    assert.equal(Object.values(s.outcomes).reduce((a, b) => a + b, 0), s.proposals); assert.equal(s.outcomes.accepted ?? 0, s.accepted);
    assert.equal(s.status, original.edgeCount && s.accepted === s.required ? "complete" : "unavailable");
    assert.equal(s.reason, s.status === "complete" ? null : original.edgeCount ? "swap-target-not-reached" : "empty-edge-set");
    if (s.status === "unavailable") assert.equal(s.proposals, original.edgeCount ? 4096 : 0);
    closed(g, ["status", "reason", "pairCount", "featuresSha256", "evidence", "termination"]);
    if (s.status !== "complete") { assert.equal(g.status, "not-run"); assert.equal(g.reason, "sampling-unavailable"); }
    else if (g.status !== "complete") { assert.equal(g.status, "unavailable"); assert.ok(g.reason.endsWith("LIMIT_EXCEEDED")); }
    if (g.status === "complete") {
      assert.equal(g.reason, null); assert.equal(g.pairCount, original.nodeCount * (original.nodeCount - 1)); hash(g.featuresSha256);
      closed(g.evidence, ["forman", "ollivier", "flow"]); Object.values(g.evidence).forEach(value => assert.match(value, /^sha256:[a-f0-9]{64}$/));
      closed(g.termination, ["reason", "iteration", "cycleStart", "cyclePeriod", "edgeIds"]);
      assert.ok(STOP_REASONS.includes(g.termination.reason)); natural(g.termination.iteration, 4);
      if (g.termination.reason === "iteration-limit") assert.equal(g.termination.iteration, 4);
      if (g.termination.reason === "cycle") {
        natural(g.termination.cycleStart, g.termination.iteration - 2);
        assert.equal(g.termination.cyclePeriod, g.termination.iteration - g.termination.cycleStart);
      } else { assert.equal(g.termination.cycleStart, null); assert.equal(g.termination.cyclePeriod, null); }
      if (g.termination.reason === "degenerate-length") {
        assert.ok(g.termination.edgeIds.length > 0 && g.termination.edgeIds.length <= original.edgeCount);
        assert.equal(new Set(g.termination.edgeIds).size, g.termination.edgeIds.length);
        g.termination.edgeIds.forEach(id => assert.match(id, /^e[0-9]{5}$/));
      } else assert.deepEqual(g.termination.edgeIds, []);
    } else for (const key of ["pairCount", "featuresSha256", "evidence", "termination"]) assert.equal(g[key], null);
  }
  assert.deepEqual(rep.studies.map(row => row.id), targets.map(row => row.id));
  const referenceStudies = [];
  for (const [i, row] of rep.studies.entries()) {
    closed(row, ["id", "status", "reason", "failures", "report", ...(Object.hasOwn(row, "diagnostic") ? ["diagnostic"] : [])]);
    const target = targets[i];
    const failures = target.requiredScopes.flatMap(id => {
      const scope = rep.scopes.find(row => row.id === id);
      return scope.sampling.status !== "complete" ? [{ id, phase: "sampling", reason: scope.sampling.reason }] :
        scope.geometry.status !== "complete" ? [{ id, phase: "geometry", reason: scope.geometry.reason }] : [];
    });
    assert.deepEqual(row.failures, failures);
    if (row.status === "complete") { assert.equal(row.reason, null); assert.equal(failures.length, 0); validateCompact(row.report, target); }
    else {
      assert.equal(row.status, "unavailable"); assert.equal(row.report, null);
      assert.equal(row.reason, failures.length ? "complete-matched-null-population-required" : "required-null-model-computation-failed");
      if (!failures.length) assert.ok(typeof row.diagnostic === "string" && row.diagnostic.length > 0);
    }
    const g = target.groups.length, complete = row.status === "complete";
    referenceStudies.push({ id: row.id, status: row.status,
      distinctReferenceFits: complete ? g * (g - 1) / 2 * 30 + g * 6 : 0,
      predictionsChecked: complete ? target.targetCount * 6 * (5 * (g - 1) + 1) : 0 });
  }
  assert.deepEqual(rep.independent, { status: "verified", method: "sha256-edge-set-union-find-bellman-ford-joint-intercept-ridge",
    nullScopesChecked: originals.length, proposalsChecked: rep.scopes.reduce((sum, row) => sum + row.sampling.proposals, 0),
    descriptorPairs: rep.scopes.reduce((sum, row) => sum + (row.geometry.pairCount ?? 0), 0),
    distinctReferenceFits: referenceStudies.reduce((sum, row) => sum + row.distinctReferenceFits, 0),
    predictionsChecked: referenceStudies.reduce((sum, row) => sum + row.predictionsChecked, 0), studies: referenceStudies,
    numericTolerance: 2e-10, rankTies: "exact-binary64-no-tolerance" });
}
