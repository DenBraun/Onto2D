import assert from "node:assert/strict";
import { PROFILE, census, degrees, binCoverage, matchPopulation } from "./selection.mjs";
import { compareContexts } from "./study.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { closed } from "../capacity/report.mjs";
import { validateModel, hash, integer } from "../metric/report.mjs";
import { LIMIT_REASONS } from "../metric/geometry.mjs";

export function validateAudit(audit) {
  assert.equal(audit.format, "onto2d-scope-source-audit-v1"); assert.equal(audit.profileChoicesSha256, digest(PROFILE));
  assert.equal(audit.comparativeScoresComputed, false); assert.deepEqual(audit.units.map(u => u.id), PROFILE.anatomies);
  for (const unit of audit.units) {
    const { nodes, bins, targetCoverageRole, ...selection } = unit;
    assert.deepEqual(selection, census(unit.parent, unit.id));
    assert.deepEqual(nodes.map(({ id, incoming, outgoing, weak, lowDegree, bin }) => ({ id, incoming, outgoing, weak, lowDegree, bin })), degrees(unit.parent));
    assert.deepEqual(bins, binCoverage(nodes));
    assert.equal(targetCoverageRole, unit.id === "Dataset7" ? "eligible-primary" : "eligible-candidates-in-unavailable-primary");
  }
  assert.deepEqual(audit.populations, PROFILE.variants.map(variant => ({ variant, ...matchPopulation(audit.originalTargets, audit.units[0].selections.filter(s => s.variant === variant)) })));
}
export function summarizeVariant(details) {
  return { variant: details.variant, status: details.status, reason: details.reason,
    scopes: details.scopes.map(s => ({ root: s.root, graphSha256: digest(s.context.graph), status: s.measured.status, reason: s.measured.reason,
      geometrySha256: s.measured.geometry ? digest(s.measured.geometry) : null, featuresSha256: s.features ? digest(s.features) : null,
      flowHash: s.measured.flow?.artifactHash ?? null, stateCount: s.measured.flow?.states.length ?? 0, pairCount: s.measured.geometry?.pairs.length ?? 0,
      termination: s.measured.flow?.termination ?? null })),
    contexts: details.contexts?.map(({ trace, ...context }) => context) ?? null, comparisons: details.comparisons };
}
export function validateVariant(variant, audit, capacity) {
  closed(variant, ["variant", "status", "reason", "scopes", "contexts", "comparisons", "independent", "localDetailsSha256"]); hash(variant.localDetailsSha256);
  const population = audit.populations.find(p => p.variant === variant.variant); assert.ok(population);
  const roots = population.status === "complete" ? population.groups.filter(g => g.eligible).map(g => g.id) : [];
  assert.deepEqual(variant.scopes.map(s => s.root), roots);
  let states = 0, pairs = 0, failed = 0, staticEdges = 0;
  for (const scope of variant.scopes) {
    closed(scope, ["root", "graphSha256", "status", "reason", "geometrySha256", "featuresSha256", "flowHash", "stateCount", "pairCount", "termination"]);
    const selection = audit.units[0].selections.find(s => s.variant === variant.variant && s.root === scope.root);
    assert.equal(scope.graphSha256, selection.graphSha256);
    if (scope.status === "complete") {
      assert.equal(scope.reason, null); hash(scope.geometrySha256); hash(scope.featuresSha256); assert.match(scope.flowHash, /^sha256:[a-f0-9]{64}$/);
      integer(scope.stateCount, 5); assert.ok(scope.stateCount >= 1); assert.equal(scope.pairCount, selection.nodeIds.length * (selection.nodeIds.length - 1));
      assert.equal(scope.termination.iteration, scope.stateCount - 1); assert.ok(["fixed-point", "tolerance", "cycle", "degenerate-length", "iteration-limit"].includes(scope.termination.reason));
      states += scope.stateCount; pairs += scope.pairCount; staticEdges += selection.edgeIndexes.length;
    } else {
      assert.equal(scope.status, "unavailable"); assert.ok(LIMIT_REASONS.includes(scope.reason)); failed++;
      for (const key of ["geometrySha256", "featuresSha256", "flowHash", "termination"]) assert.equal(scope[key], null);
      assert.equal(scope.stateCount, 0); assert.equal(scope.pairCount, 0);
    }
  }
  const reason = population.status !== "complete" ? population.reason : failed ? "required-target-scope-computation-failed" : null;
  assert.equal(variant.reason, reason); assert.equal(variant.status, reason === null ? "complete" : "unavailable");
  const fitting = [];
  if (reason !== null) { assert.equal(variant.contexts, null); assert.equal(variant.comparisons, null); }
  else {
    assert.deepEqual(variant.contexts.map(c => c.id), ["reference", "alternative"]);
    const original = { targets: population.rows, report: { ablations: { B: { groups: roots.map(id => ({ id })) } } } };
    for (const context of variant.contexts) {
      closed(context, ["id", "models"]); assert.deepEqual(Object.keys(context.models), PROFILE.models);
      for (const name of PROFILE.models) {
        validateModel(context.models[name], name, original);
        if (variant.variant === "weak-one") {
          const prior = capacity.studies[2];
          assert.deepEqual(context.models[name].summary, prior.report.ablations[name]);
          assert.deepEqual(context.models[name].outerEvidence, prior.outerEvidence[name]);
          assert.deepEqual(context.models[name].capacity, prior.report.capacity[name]);
        }
      }
      const g = roots.length, n = population.rows.length;
      fitting.push({ id: context.id, distinctReferenceFits: PROFILE.models.length * (5 * g * (g - 1) / 2 + g),
        predictionsChecked: PROFILE.models.length * n * (5 * (g - 1) + 1) });
    }
    assert.deepEqual(variant.comparisons, compareContexts(variant.contexts));
  }
  assert.deepEqual(variant.independent, { status: "verified", scopeCount: roots.length, states, pairs, staticEdges, failedAttemptsRetained: failed,
    expandedCoordinates: pairs * 31, fitting, exactComparisonsChecked: reason === null ? PROFILE.comparisons.length : 0 });
}
