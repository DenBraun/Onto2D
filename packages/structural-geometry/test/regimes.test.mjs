import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { canonicalizeCandidate } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { createStructuralMetricContext, buildStructuralProvider } from "@onto2d/structural-geometry/providers";
import { DISTINGUISHABILITY_REGIMES, STRUCTURAL_OBSERVABLE_SPECS, getDistinguishabilityRegime,
  verifyDistinguishabilityRegime, verifyStructuralObservationSpec, prepareStructuralRegime,
  verifyStructuralRegimePreparation, createStructuralRegimePreparationAnalysis } from "@onto2d/structural-geometry/regimes";
import { controlPack, fixtures, readJson } from "../../../cases/structural-geometry/regimes/fixtures.mjs";

const source = controlPack();
const exact = { regimeId: "canonical-structure-v1" };
const code = (suffix) => (e) => e.code === `STRUCTURAL_REGIME_${suffix}`;
const resign = (kind, value, field = "contentHash") => {
  const { [field]: _old, ...body } = value;
  return { ...body, [field]: hashCanonical(`onto2d:structural-regime-${kind}:v1`, body) };
};
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function sizedPack(n, count = 0) {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
  const edges = nodes.flatMap((a) => nodes.filter((b) => a.id !== b.id).map((b) => ({ id: `${a.id}->${b.id}`,
    source: a.id, target: b.id, relationLayer: "source-parent" }))).slice(0, count);
  return buildModelPack({ model: { id: "size-control", name: "Size control", version: "1" }, source: { id: "declared", files: [] }, nodes, edges, dictionaries: {} });
}

test("regime registry is immutable, explicitly selected and rejects undeclared or future profiles", () => {
  assert.equal(DISTINGUISHABILITY_REGIMES.length, 3); assert.equal(STRUCTURAL_OBSERVABLE_SPECS.length, 9);
  frozen(DISTINGUISHABILITY_REGIMES); frozen(STRUCTURAL_OBSERVABLE_SPECS);
  for (const id of [undefined, null, {}, "constructor", "history-aware-v1", "response-v0"]) {
    assert.throws(() => getDistinguishabilityRegime(id), code("UNSUPPORTED"));
  }
  assert.throws(() => prepareStructuralRegime(source), /canonical/i);
  assert.throws(() => prepareStructuralRegime(source, {}), code("INPUT_INVALID"));
});

test("every observable and policy reference is content-bound, including empty probe sets", () => {
  for (const spec of STRUCTURAL_OBSERVABLE_SPECS) {
    assert.deepEqual(resign("observable", spec), spec);
    assert.deepEqual(resign("policy", spec.supplier), spec.supplier);
    assert.equal(verifyStructuralObservationSpec(structuredClone(spec), spec.id), spec);
  }
  for (const regime of DISTINGUISHABILITY_REGIMES) {
    assert.deepEqual(resign("descriptor", regime), regime);
    for (const policy of [regime.scopePolicy, regime.matchingPolicy, regime.vocabularyPolicy, regime.invariancePolicy,
      ...Object.values(regime.probeSets), regime.missingnessPolicy, regime.aggregationPolicy]) assert.deepEqual(resign("policy", policy), policy);
    for (const ref of regime.observables) {
      const spec = STRUCTURAL_OBSERVABLE_SPECS.find((s) => s.id === ref.id);
      assert.equal(ref.contentHash, spec.contentHash);
    }
    assert.equal(verifyDistinguishabilityRegime(structuredClone(regime), regime.id), regime);
  }
});

test("rehashed changes to observable order, invariance, evidence, matching and budgets cannot impersonate built-ins", () => {
  const regime = getDistinguishabilityRegime("topology-only-v1");
  for (const change of [
    (r) => { r.observables.reverse(); }, (r) => { r.observables.pop(); },
    (r) => { r.matchingPolicy.graphIsomorphismClaim = true; },
    (r) => { r.invariancePolicy.transformations.push("reverse-all-edges"); },
    (r) => { r.limits.maxNodes = 100; }, (r) => { r.missingnessPolicy.incompleteDistance = 0; },
    (r) => { r.probeSets.response.probes.push("unreviewed-probe"); }
  ]) {
    const copy = structuredClone(regime); change(copy);
    assert.throws(() => verifyDistinguishabilityRegime(resign("descriptor", copy), regime.id), code("VERIFICATION_FAILED"));
  }
  const spec = structuredClone(STRUCTURAL_OBSERVABLE_SPECS[0]); spec.requiredEvidence = [];
  assert.throws(() => verifyStructuralObservationSpec(resign("observable", spec), spec.id), code("VERIFICATION_FAILED"));
  assert.throws(() => verifyDistinguishabilityRegime(regime, exact.regimeId), code("VERIFICATION_FAILED"));
});

test("declared exact translations fit the existing bounded kernel contract, including typed set encoding and disconnected nodes", () => {
  // Interface feasibility only. Exhaustive independent isomorphism validation belongs to SG2-011/013.
  for (const regime of DISTINGUISHABILITY_REGIMES.filter((r) => r.limits.maxSearchStates)) {
    const { candidateTranslation: t, graphPolicy } = regime.matchingPolicy;
    const attrs = regime.id === "typed-relations-v1" ? { dependencyTypeId: 0, interactionModeIds: "[0,1]",
      ontologicalRole: "arising", necessity: "necessary", causalDirectionIds: "[0]" } : {};
    const candidate = { domain: t.domain, nodes: Array.from({ length: 3 }, () => ({ ref: t.nodeRef })),
      edges: [{ from: 0, to: 1, role: t.edgeRole, attrs }] };
    const limits = { maxNodes: regime.limits.maxNodes, maxEdges: regime.limits.maxEdges, maxSearchStates: regime.limits.maxSearchStates };
    const result = canonicalizeCandidate(candidate, { policy: graphPolicy, limits });
    assert.equal(result.canonical.nodes.length, 3); assert.equal(result.canonical.edges.length, 1);
    assert.throws(() => canonicalizeCandidate(candidate, { policy: graphPolicy, limits: { ...limits, maxSearchStates: 1 } }),
      (e) => e.code === "CANONICALIZATION_BUDGET_EXHAUSTED");
  }
});

test("preparation retains full source and MetricProvider dictionary context without computing a metric or observation", () => {
  const context = createStructuralMetricContext(source);
  for (const regime of DISTINGUISHABILITY_REGIMES) {
    const a = prepareStructuralRegime(source, { regimeId: regime.id });
    assert.deepEqual(a.context, context.binding);
    assert.equal(a.regime.projectionPolicy.contentHash, context.projection.policyHash);
    assert.equal(a.evaluation, "not-run");
    for (const key of ["result", "observations", "distance", "status", "metricArtifact"]) assert.equal(Object.hasOwn(a, key), false);
    frozen(a);
    assert.deepEqual(a.scope.nodeIds, ["a", "b", "c", "d", "isolated"]);
    assert.equal(a.scope.edgeIds.length, 4);
  }
});

test("induced scopes partition every source edge, keep selected isolates and normalize only membership order", () => {
  const input = { ...exact, scope: { kind: "induced", nodeIds: ["isolated", "b", "a"] } };
  const before = JSON.stringify(input);
  const a = prepareStructuralRegime(source, input);
  assert.deepEqual(a.scope.nodeIds, ["a", "b", "isolated"]);
  assert.deepEqual(a.scope.edgeIds, ["a->b"]);
  assert.deepEqual(a.scope.incomingBoundaryEdgeIds, ["d->a"]);
  assert.deepEqual(a.scope.outgoingBoundaryEdgeIds, ["b->c"]);
  assert.deepEqual(a.scope.externalEdgeIds, ["c->d"]);
  assert.equal(a.scope.sourceNodeCount, 5); assert.equal(a.scope.sourceEdgeCount, 4);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(prepareStructuralRegime(source, { ...input, scope: { ...input.scope, nodeIds: ["b", "a", "isolated"] } }), a);
  assert.notEqual(prepareStructuralRegime(source, exact).scope.scopeHash, a.scope.scopeHash);
});

test("closed requests reject unsupported policies, scope forms, duplicate IDs and invalid data before preparation", () => {
  for (const input of [null, [], { ...exact, extra: true }, { ...exact, scope: null }, { ...exact, scope: {} },
    { ...exact, scope: { kind: "full", nodeIds: [] } }, { ...exact, scope: { kind: "weak" } },
    ...[[], ["a", "a"], [""], [1], null].map((nodeIds) => ({ ...exact, scope: { kind: "induced", nodeIds } }))]) {
    assert.throws(() => prepareStructuralRegime(source, input), code("INPUT_INVALID"));
  }
  for (const id of ["unknown", " a", "a\n"]) {
    assert.throws(() => prepareStructuralRegime(source, { ...exact, scope: { kind: "induced", nodeIds: [id] } }), code("SCOPE_INVALID"));
  }
  let invoked = false;
  assert.throws(() => prepareStructuralRegime(source, { get regimeId() { invoked = true; return exact.regimeId; } }));
  assert.equal(invoked, false);
});

test("preparation enforces exact and summary size limits without silent truncation or automatic scoping", () => {
  assert.equal(prepareStructuralRegime(sizedPack(6, 30), exact).scope.edgeIds.length, 30);
  assert.throws(() => prepareStructuralRegime(sizedPack(7), exact), code("LIMIT_EXCEEDED"));
  const summary = { regimeId: "topology-only-v1" };
  assert.equal(prepareStructuralRegime(sizedPack(64, 256), summary).scope.nodeIds.length, 64);
  assert.throws(() => prepareStructuralRegime(sizedPack(65), summary), code("LIMIT_EXCEEDED"));
  assert.throws(() => prepareStructuralRegime(sizedPack(64, 257), summary), code("LIMIT_EXCEEDED"));
  assert.equal(prepareStructuralRegime(sizedPack(65), { ...exact, scope: { kind: "induced", nodeIds: ["n0"] } }).scope.nodeIds.length, 1);
});

test("full-source verification rejects corruption and forbidden topology outside a selected fragment", () => {
  const input = { ...exact, scope: { kind: "induced", nodeIds: ["isolated"] } };
  const corrupt = structuredClone(source); corrupt.files["model/edges.json"][0].necessity = "optional";
  assert.throws(() => prepareStructuralRegime(corrupt, input));
  for (const change of [
    (edges) => { edges[0].target = edges[0].source; },
    (edges) => { edges[0].relationLayer = "annotation"; },
    (edges) => { edges.push({ ...edges[0], id: "parallel" }); }
  ]) {
    const edges = structuredClone(source.files["model/edges.json"]); change(edges);
    const invalid = buildModelPack({ model: source.manifest.model, source: { id: "declared", files: [] },
      nodes: source.files["model/nodes.json"], edges, dictionaries: {} });
    assert.throws(() => prepareStructuralRegime(invalid, input));
  }
});

test("typed vocabulary binding records local provenance without treating equal code numbers as compatible evidence", () => {
  const input = { regimeId: "typed-relations-v1" };
  const a = prepareStructuralRegime(controlPack({ dictionaries: { codes: { "0": "alpha" } } }), input);
  const b = prepareStructuralRegime(controlPack({ dictionaries: { codes: { "0": "beta" } } }), input);
  assert.notEqual(a.context.dictionaryHash, b.context.dictionaryHash);
  assert.equal(a.regime.contentHash, b.regime.contentHash);
  assert.equal(a.regime.vocabularyPolicy.missingCompatibility, "indeterminate");
  const sameBytesOtherModel = prepareStructuralRegime(controlPack({ modelId: "another-model" }), input);
  const original = prepareStructuralRegime(source, input);
  assert.equal(sameBytesOtherModel.context.dictionaryHash, original.context.dictionaryHash);
  assert.notEqual(sameBytesOtherModel.context.contextHash, original.context.contextHash);
  assert.equal(sameBytesOtherModel.evaluation, "not-run");
  // Even absent typed declarations remain unevaluated here; later observations must account for them.
  assert.equal(prepareStructuralRegime(sizedPack(2, 1), input).evaluation, "not-run");
});

test("relabeling changes provenance and scope hashes while preserving the observation contract identity", () => {
  const renamed = controlPack({ rename: (id) => `renamed:${id}` });
  const a = prepareStructuralRegime(source, exact), b = prepareStructuralRegime(renamed, exact);
  assert.equal(a.regime.contentHash, b.regime.contentHash);
  assert.notEqual(a.context.sourceProjectionHash, b.context.sourceProjectionHash);
  assert.notEqual(a.scope.scopeHash, b.scope.scopeHash); assert.notEqual(a.artifactHash, b.artifactHash);
  assert.throws(() => verifyStructuralRegimePreparation(a, renamed, exact), code("VERIFICATION_FAILED"));
});

test("expected-source replay rejects rehashed scope partitions, contexts, policies and fabricated measured results", () => {
  const input = { ...exact, scope: { kind: "induced", nodeIds: ["a", "b"] } };
  const original = prepareStructuralRegime(source, input);
  for (const change of [
    (a) => { a.scope.incomingBoundaryEdgeIds = []; }, (a) => { a.scope.edgeIds.push("b->c"); },
    (a) => { a.context.dictionaryHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.regime.observables = []; }, (a) => { a.observableSpecs[0].mandatory = false; },
    (a) => { a.evaluation = "measured"; }, (a) => { a.distance = 0; }, (a) => { a.status = "indistinguishable-under-regime"; }
  ]) {
    const a = structuredClone(original); change(a);
    a.scope = resign("scope", a.scope, "scopeHash");
    assert.throws(() => verifyStructuralRegimePreparation(resign("preparation", a, "artifactHash"), source, input), code("VERIFICATION_FAILED"));
  }
  assert.throws(() => verifyStructuralRegimePreparation(original, source, exact), code("VERIFICATION_FAILED"));
});

test("artifact byte bound rejects excessive untrusted payloads before replay equality", () => {
  const a = structuredClone(prepareStructuralRegime(source, exact)); a.extra = "x".repeat(1048576);
  assert.throws(() => verifyStructuralRegimePreparation(a, source, exact), code("LIMIT_EXCEEDED"));
});

test("all frozen preparations replay from expected sources without altering existing provider outputs or inputs", async () => {
  for (const f of await fixtures()) {
    const before = canonicalize(f.pack);
    const providerBefore = buildStructuralProvider(f.pack, { providerId: "unit-v1" });
    const artifact = await readJson(`artifacts/${f.id}.json`);
    assert.deepEqual(verifyStructuralRegimePreparation(artifact, f.pack, f.input), artifact);
    assert.equal(canonicalize(f.pack), before);
    assert.deepEqual(buildStructuralProvider(f.pack, { providerId: "unit-v1" }), providerBefore);
  }
});

test("preparation engine analysis is opt-in and rejects a fabricated model context", async () => {
  const definition = createStructuralRegimePreparationAnalysis();
  const engine = await Onto2D.create({ models: [source], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, exact), prepareStructuralRegime(source, exact));
  assert.throws(() => definition.run({ model: {} }, exact));
  const plain = await Onto2D.create({ models: [source] });
  await assert.rejects(() => plain.analyze(definition.id, exact));
});
