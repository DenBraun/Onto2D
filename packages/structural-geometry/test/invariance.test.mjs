import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { Onto2D } from "@onto2d/engine";
import { buildModelPack, verifyModelPack } from "@onto2d/model-pack";
import { runStructuralInvarianceProbes, verifyStructuralInvarianceProbes, createStructuralInvarianceAnalysis,
  STRUCTURAL_INVARIANCE_POLICY, STRUCTURAL_INVARIANCE_REGISTRY, STRUCTURAL_SHADOW_OBSERVATION_ADAPTER } from "@onto2d/structural-geometry/invariance";
import { prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { runStructuralProbeSandbox } from "@onto2d/structural-geometry/sandbox";
import { invarianceHash, compareInvarianceObservations, adjudicateInvariance } from "../src/invariance-core.js";
import { fixtures, readJson } from "../../../cases/structural-geometry/invariance/fixtures.mjs";
import { negativeControl } from "../../../cases/structural-geometry/invariance/build.mjs";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";

const examples = await fixtures(), f = id => examples.find(f => f.id === id);
const run = f => runStructuralInvarianceProbes(f.pack, f.input);
const artifacts = new Map(await Promise.all(examples.map(async f => [f.id, await readJson(`artifacts/${f.id}.json`)])));
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = (a, field = "artifactHash", kind = "artifact") => { const { [field]: _hash, ...body } = a; return { ...body, [field]: invarianceHash(kind, body) }; };

test("invariance preserves source bytes and frozen preparation, sandbox identity and all descriptors", () => {
  const source = structuredClone(f("chain")), before = canonicalize(source), a = run(source);
  assert.equal(canonicalize(source), before); frozen(a);
  for (const descriptor of [STRUCTURAL_INVARIANCE_POLICY, STRUCTURAL_INVARIANCE_REGISTRY, STRUCTURAL_SHADOW_OBSERVATION_ADAPTER]) frozen(descriptor);
  assert.deepEqual(a.preparation, prepareStructuralRegime(source.pack, source.input));
  const sandbox = runStructuralProbeSandbox(source.pack, { ...source.input, transformation: { kind: "identity" } });
  assert.equal(a.sandbox.artifactHash, sandbox.artifactHash);
  assert.equal(a.baseline.sourceShadowGraphHash, sandbox.baseline.graph.graphHash);
  assert.equal(a.preparation.regime.probeSets.invariance.execution, "none");
  assert.equal(a.preparation.regime.probeSets.response.execution, "none");
  assert.deepEqual(a, resign(a));
  assert.throws(() => verifyModelPack(JSON.parse(a.runs[0].representation.payload)));
});

test("record-order probe reaches the adapter with changed array order, object keys and JSON whitespace", () => {
  const a = run(f("chain")), before = JSON.parse(a.baseline.representation.payload), r = a.runs[0], after = JSON.parse(r.representation.payload);
  assert.deepEqual(after.nodes, [...before.nodes].reverse()); assert.deepEqual(after.edges, [...before.edges].reverse());
  assert.deepEqual(Object.keys(after), Object.keys(before).reverse());
  assert.deepEqual(Object.keys(after.edges[0]), Object.keys(before.edges.at(-1)).reverse());
  assert.ok(r.representation.payload.includes("\n  ")); assert.equal(r.payloadChanged, true);
  assert.notEqual(r.representation.payloadHash, a.baseline.representation.payloadHash);
  assert.equal(r.representation.graphHash, a.baseline.representation.graphHash);
  assert.equal(r.observation.payloadHash, r.representation.payloadHash);
  assert.equal(r.comparison.status, "passed");
});

test("node and edge renaming transport every record and directed endpoint in independent copies", () => {
  const a = run(f("reciprocal")), before = JSON.parse(a.baseline.representation.payload);
  for (const r of a.runs) {
    const after = JSON.parse(r.representation.payload), nodes = new Map(r.mapping.nodes.map(n => [n.beforeId, n.afterId]));
    const edges = new Map(r.mapping.edges.map(e => [e.beforeId, e.afterId]));
    assert.equal(new Set(nodes.values()).size, before.nodes.length); assert.equal(new Set(edges.values()).size, before.edges.length);
    assert.equal(r.beforePayloadHash, a.baseline.representation.payloadHash);
    for (const e of before.edges) {
      const changed = after.edges.find(x => x.id === edges.get(e.id));
      assert.equal(changed.source, nodes.get(e.source)); assert.equal(changed.target, nodes.get(e.target)); assert.deepEqual(changed.types, e.types);
    }
  }
  assert.ok(a.runs[1].mapping.nodes.every(n => n.afterId.startsWith("vertex:") && n.afterId !== n.beforeId));
  assert.ok(a.runs[2].mapping.edges.every(e => e.afterId.startsWith("link:") && e.afterId !== e.beforeId));
  assert.ok(a.runs[2].mapping.nodes.every(n => n.afterId === n.beforeId));
});

test("presentation probe changes labels, positions, colors and zoom while retaining all measured values", () => {
  const a = run(f("reciprocal")), before = JSON.parse(a.baseline.representation.payload), r = a.runs[3], after = JSON.parse(r.representation.payload);
  assert.notDeepEqual(before.viewport, after.viewport);
  for (const [i, n] of before.nodes.entries()) assert.notDeepEqual(n.presentation, after.nodes[i].presentation);
  for (const [i, e] of before.edges.entries()) assert.notDeepEqual(e.presentation, after.edges[i].presentation);
  assert.equal(r.representation.graphHash, a.baseline.representation.graphHash);
  assert.deepEqual(r.observation.observations, a.baseline.observation.observations);
});

test("all mandatory observable profiles are measured, including all seven topology fields", () => {
  for (const a of artifacts.values()) {
    assert.equal(a.runs.length, 4);
    assert.deepEqual(a.baseline.observation.observations.map(o => o.observable), a.preparation.regime.observables);
    for (const r of a.runs) {
      assert.deepEqual(r.comparison.components.map(c => c.observableId), a.preparation.regime.observables.map(o => o.id));
      assert.equal(r.comparison.coverage.denominator, a.preparation.regime.observables.length);
      assert.equal(r.observation.source.contextHash, a.preparation.context.contextHash);
    }
    assert.equal(a.work.observationEvaluations, 5);
  }
  assert.equal(artifacts.get("star").summary.coverage.denominator, 28);
});

test("missing typed evidence remains indeterminate with stable transported source-edge reasons", () => {
  const a = run(f("missing")); assert.deepEqual(a.summary, { status: "indeterminate", coverage: { numerator: 4, denominator: 8 } });
  for (const r of a.runs) {
    assert.deepEqual(r.comparison.components.map(c => c.state), ["equal", "indeterminate"]);
    assert.equal(r.observation.observations[1].value, null); assert.equal(r.observation.observations[1].valueHash, null);
    assert.deepEqual(r.observation.observations[1].missing, a.baseline.observation.observations[1].missing);
  }
  assert.equal(a.work.canonicalizerCalls, 5);
});

test("negative controls detect topology and joint type changes and preserve differences through missingness", () => {
  const values = [["remove-one-chain-edge", "chain"], ["change-reciprocal-necessity", "reciprocal"], ["remove-edge-with-missing-types", "missing"]]
    .map(([id, source]) => negativeControl(id, artifacts.get(source)));
  assert.deepEqual(values.map(v => v.comparison.status), ["failed", "failed", "indeterminate"]);
  assert.deepEqual(values[1].comparison.components.map(c => c.state), ["equal", "different"]);
  assert.deepEqual(values[2].comparison.components.map(c => c.state), ["different", "indeterminate"]);
  assert.equal(STRUCTURAL_INVARIANCE_REGISTRY.probes.length, 4);
});

test("empty profile is indeterminate and adapter binding mismatches fail before comparison", () => {
  assert.deepEqual(adjudicateInvariance([]), { status: "indeterminate", coverage: { numerator: 0, denominator: 0 } });
  const a = artifacts.get("chain").baseline.observation;
  for (const mutate of [b => { b.observations = []; }, b => { b.observations[0].observable.id = "other"; }, b => { b.observations[0].implementation.contentHash = "forged"; },
    b => { b.source.contextHash = "foreign"; }, b => { b.source.scopeHash = "other-scope"; }, b => { b.adapter.id = "other-adapter"; }]) {
    const b = structuredClone(a); mutate(b); assert.throws(() => compareInvarianceObservations(a, b), e => e.code === "STRUCTURAL_INVARIANCE_PROFILE_MISMATCH");
  }
});

test("singleton and isolates explicitly retain no-op edge renaming without inventing edge coverage", () => {
  for (const id of ["singleton", "isolates"]) {
    const a = run(f(id)), r = a.runs[2];
    assert.equal(r.payloadChanged, false); assert.deepEqual(r.mapping.edges, []);
    assert.equal(r.representation.payloadHash, a.baseline.representation.payloadHash); assert.equal(r.comparison.status, "passed");
    assert.equal(a.runs[1].payloadChanged, true);
  }
});

test("induced scope transports all selected nodes, isolates and immutable boundary accounting", () => {
  const a = run(f("boundary"));
  assert.deepEqual(a.preparation.scope.nodeIds, ["n0", "n1", "n4"]);
  assert.deepEqual(a.preparation.scope.edgeIds, ["e0"]);
  assert.deepEqual(a.preparation.scope.outgoingBoundaryEdgeIds, ["e1"]);
  assert.deepEqual(a.preparation.scope.externalEdgeIds, ["e2"]);
  assert.deepEqual(a.preparation.scope.incomingBoundaryEdgeIds, ["e3"]);
  for (const r of a.runs) { assert.equal(r.mapping.nodes.length, 3); assert.equal(r.mapping.edges.length, 1); }
});

test("exact source identifiers survive UTF-16 ordering, whitespace and supplementary Unicode", () => {
  const types = artifacts.get("reciprocal").baseline.observation.observations[1].value.edges[0].types;
  const labels = [" right\n", "\u{10000}", "\ue000"], pack = packFor({ id: "opaque-invariance", labels, nodes: 3, edges: [{ from: 1, to: 2, types }, { from: 2, to: 0, types }] });
  const a = runStructuralInvarianceProbes(pack, { regimeId: "typed-relations-v1", scope: { kind: "induced", nodeIds: labels } });
  assert.deepEqual(a.baseline.mapping.nodes.map(n => n.sourceNodeId), [...labels].sort());
  assert.equal(a.summary.status, "passed");
});

test("arbitrary source relabeling and edge IDs preserve measured profiles across all six three-node bijections", () => {
  const types = JSON.parse(artifacts.get("reciprocal").baseline.representation.payload).edges[0].types;
  const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let expected;
  for (const p of permutations) {
    const pack = packFor({ id: `renamed-${p.join("")}`, nodes: 3, labels: p.map(i => `alias-${i}`),
      edges: [[0, 1], [1, 0], [1, 2]].reverse().map(([from, to]) => ({ from, to, types })) });
    const a = runStructuralInvarianceProbes(pack, { regimeId: "typed-relations-v1" });
    const profiles = a.runs.map(r => ({ values: r.observation.observations.map(o => o.value), comparison: r.comparison }));
    if (!expected) expected = profiles; else assert.deepEqual(profiles, expected);
  }
});

test("rehashed forged registry, payload, mapping, value, coverage or counters fail expected-source replay", () => {
  const a = artifacts.get("chain"), source = f("chain");
  for (const mutate of [
    b => { b.registry.probes.pop(); }, b => { b.policy.vocabulary = "any-source"; }, b => { b.adapter.presentation = "include"; },
    b => { b.runs[1].mapping.nodes[0].afterId = "other"; }, b => { b.runs[0].representation.payload = "{}"; },
    b => { b.runs[0].observation.observations[0].value.nodeCount = 2; }, b => { b.runs[0].comparison.components[0].state = "different"; },
    b => { b.summary.coverage.numerator = 0; }, b => { b.work.observationEvaluations = 0; }, b => { b.sandbox.artifactHash = b.artifactHash; }
  ]) { const b = structuredClone(a); mutate(b); assert.throws(() => verifyStructuralInvarianceProbes(resign(b), source.pack, source.input), e => e.code === "STRUCTURAL_INVARIANCE_VERIFICATION_FAILED"); }
});

test("verification binds expected full source and requested scope, not only matching graph values", () => {
  const a = artifacts.get("chain"), original = f("chain");
  assert.throws(() => verifyStructuralInvarianceProbes(a, original.pack, { ...original.input, scope: { kind: "induced", nodeIds: ["n0", "n1"] } }));
  const files = original.pack.files;
  const foreign = buildModelPack({ model: { ...original.pack.manifest.model, id: "other-source" }, source: original.pack.manifest.source,
    nodes: files["model/nodes.json"], edges: files["model/edges.json"], dictionaries: files["model/dictionaries.json"] });
  assert.throws(() => verifyStructuralInvarianceProbes(a, foreign, original.input));
});

test("closed requests reject callbacks, probe selection and arbitrary transformation data without invoking getters", () => {
  let calls = 0;
  const getter = Object.defineProperty({ regimeId: "canonical-structure-v1" }, "scope", { enumerable: true, get() { calls += 1; return {}; } });
  for (const input of [null, [], {}, { regimeId: "unknown" }, { regimeId: "canonical-structure-v1", probes: [] },
    { regimeId: "canonical-structure-v1", transform() { calls += 1; } }, getter]) assert.throws(() => runStructuralInvarianceProbes(f("chain").pack, input));
  assert.equal(calls, 0);
});

test("limits retain the 64-node 256-edge topology boundary and reject excess source scope and output bytes", () => {
  const a = run(f("topology-limit")); assert.equal(a.baseline.mapping.nodes.length, 64); assert.equal(a.baseline.mapping.edges.length, 256);
  assert.deepEqual(a.work, { representationCount: 5, observationEvaluations: 5, canonicalizerCalls: 0 });
  const pack = packFor({ id: "too-many-invariance-nodes", nodes: 65, edges: [] });
  assert.throws(() => runStructuralInvarianceProbes(pack, { regimeId: "topology-only-v1" }));
  // Every graph fits the source/codec bounds; their combined measured output
  // exceeds the new stage's cumulative limit before a partial artifact escapes.
  const codes = Array.from({ length: 18000 }, (_, i) => 1000000000000000 + i);
  const types = { dependencyTypeId: 0, interactionModeIds: codes, ontologicalRole: "arising", necessity: "necessary", causalDirectionIds: codes };
  const cumulative = packFor({ id: "invariance-cumulative-limit", nodes: 2, edges: [{ from: 0, to: 1, types }] });
  assert.throws(() => runStructuralInvarianceProbes(cumulative, { regimeId: "typed-relations-v1" }),
    e => e.code === "STRUCTURAL_INVARIANCE_LIMIT_EXCEEDED" && /Cumulative/.test(e.message));
});

test("typed validation audits present fields outside an induced scope", () => {
  const pack = packFor({ id: "invalid-excluded-invariance", nodes: 3, edges: [{ from: 1, to: 2, types: { necessity: "invalid" } }] });
  assert.throws(() => runStructuralInvarianceProbes(pack, { regimeId: "typed-relations-v1", scope: { kind: "induced", nodeIds: ["n0"] } }));
});

test("engine integration is opt-in and accepts only an authentic verified Model", async () => {
  const source = f("chain"), definition = createStructuralInvarianceAnalysis();
  const engine = await Onto2D.create({ models: [source.pack], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, source.input), run(source));
  assert.throws(() => definition.run({ model: {} }, source.input));
  const plain = await Onto2D.create({ models: [source.pack] }); await assert.rejects(() => plain.analyze(definition.id, source.input));
});
