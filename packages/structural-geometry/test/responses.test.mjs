import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack, verifyModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { runStructuralResponseProbes, verifyStructuralResponseProbes, createStructuralResponseAnalysis,
  STRUCTURAL_RESPONSE_POLICY, STRUCTURAL_RESPONSE_REGISTRY, STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER } from "@onto2d/structural-geometry/responses";
import { prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { runStructuralProbeSandbox } from "@onto2d/structural-geometry/sandbox";
import { responseHash, summarizeResponseProbe } from "../src/responses-core.js";
import { measureResponse, observeResponseGraph } from "../src/responses-observation.js";
import { fixtures, readJson } from "../../../cases/structural-geometry/responses/fixtures.mjs";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";

const examples = await fixtures(), controls = await readJson("controls.json"), f = id => examples.find(f => f.id === id);
const run = f => runStructuralResponseProbes(f.pack, f.input);
const artifacts = new Map(await Promise.all(examples.map(async f => [f.id, await readJson(`artifacts/${f.id}.json`)])));
const probe = (a, id) => a.probes.find(p => p.probe.id === id);
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = a => { const { artifactHash, ...body } = a; return { ...body, artifactHash: responseHash("artifact", body) }; };
const errorCode = suffix => e => e.code === `STRUCTURAL_RESPONSE_${suffix}`;

test("response execution preserves source, request, preparation and existing sandbox identities", () => {
  const source = structuredClone(f("diamond-feedback-typed")), before = canonicalize(source), a = run(source);
  assert.equal(canonicalize(source), before); frozen(a);
  for (const descriptor of [STRUCTURAL_RESPONSE_POLICY, STRUCTURAL_RESPONSE_REGISTRY, STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER]) frozen(descriptor);
  assert.deepEqual(a.preparation, prepareStructuralRegime(source.pack, source.input));
  const sandbox = runStructuralProbeSandbox(source.pack, { ...source.input, transformation: { kind: "identity" } });
  assert.equal(a.sandbox.identityArtifactHash, sandbox.artifactHash); assert.deepEqual(a.baseline.graph, sandbox.baseline.graph);
  assert.deepEqual(a, resign(a)); assert.equal(a.preparation.regime.probeSets.response.execution, "none");
  assert.throws(() => verifyModelPack(a.probes[0].runs[0].graph));
});

test("fixed profiles execute three graph probes and two additional declared dependency probes only in typed mode", () => {
  const typed = run(f("diamond-feedback-typed")), untyped = run(f("chain-canonical"));
  assert.equal(STRUCTURAL_RESPONSE_REGISTRY.probes.length, 5); assert.ok(STRUCTURAL_RESPONSE_REGISTRY.probes.every(p => p.family === "response"));
  assert.equal(typed.probes.length, 5); assert.deepEqual(typed.profile.excludedProbeIds, []);
  assert.equal(untyped.probes.length, 3); assert.deepEqual(untyped.profile.excludedProbeIds, ["necessary-parent-ablation-v1", "enabling-parent-ablation-v1"]);
  assert.equal(typed.summary.status, "observed"); assert.deepEqual(typed.summary.coverage, { numerator: 5, denominator: 5, complete: true });
  for (const a of [typed, untyped]) assert.deepEqual(a.profile.probeIds, a.probes.map(p => p.probe.id));
  for (const field of ["distance", "signature", "passed", "admissibilityChanged"]) assert.equal(Object.hasOwn(typed, field), false);
});

test("feedback selection exhausts cycle edges and ignores return paths outside the declared scope", () => {
  const cycle = probe(run(f("cycle-topology")), "feedback-edge-ablation-v1"), boundary = probe(run(f("boundary")), "feedback-edge-ablation-v1");
  assert.deepEqual(cycle.selection.knownEligibleSourceEdgeIds, ["e0", "e1", "e2"]);
  assert.equal(cycle.runs.length, 3); assert.equal(boundary.runs.length, 0);
  for (const r of cycle.runs) {
    assert.equal(r.graph.edges.length, 2); assert.equal(r.graph.nodes.length, 3);
    assert.deepEqual(r.changes.removedSourceEdgeIds, r.target.sourceEdgeIds);
  }
});

test("necessary and enabling probes exhaust their declared categories without inferring contextual or optional constraints", () => {
  const a = run(f("diamond-feedback-typed")), necessary = probe(a, "necessary-parent-ablation-v1"), enabling = probe(a, "enabling-parent-ablation-v1");
  assert.deepEqual(necessary.selection.knownEligibleSourceEdgeIds, ["e0", "e4"]);
  assert.deepEqual(enabling.selection.knownEligibleSourceEdgeIds, ["e1"]);
  assert.deepEqual(necessary.runs.map(r => r.target.sourceEdgeIds), [["e0"], ["e4"]]);
  assert.deepEqual(enabling.runs.map(r => r.target.sourceEdgeIds), [["e1"]]);
});

test("missing necessity leaves complete target membership unresolved and retains known candidates without partial execution", () => {
  const a = run(f("missing-necessity"));
  for (const [id, known] of [["necessary-parent-ablation-v1", ["e4"]], ["enabling-parent-ablation-v1", ["e1"]]]) {
    const p = probe(a, id); assert.deepEqual(p.selection, { state: "unresolved", knownEligibleSourceEdgeIds: known, unknownSourceEdgeIds: ["e0"] });
    assert.deepEqual(p.runs, []); assert.equal(p.execution.reason, "missing-selector-evidence");
    assert.deepEqual(p.summary.coverage, { numerator: 0, denominator: 0, complete: false });
  }
  assert.equal(probe(a, "feedback-edge-ablation-v1").runs.length, 5);
});

test("support path ablation includes both diamond routes, starts from the baseline and retains newly isolated vertices", () => {
  const a = run(f("diamond-topology")), p = probe(a, "redundant-support-path-ablation-v1");
  assert.deepEqual(p.runs.map(r => r.target.sourceEdgeIds), [["e0", "e1"], ["e2", "e3"]]);
  for (const r of p.runs) {
    assert.equal(r.beforeGraphHash, a.baseline.graph.graphHash); assert.equal(r.target.kind, "simple-directed-path");
    assert.equal(r.graph.nodes.length, 4); assert.equal(r.graph.edges.length, 2);
    assert.deepEqual(r.changes.removedSourceEdgeIds, r.target.sourceEdgeIds);
    assert.equal(r.response.components.find(c => c.observableId === "isolated-node-count-v1").delta, 1);
  }
});

test("support routes include direct paths and longer edge-disjoint alternatives without selecting an arbitrary representative", () => {
  const p = probe(run(f("transitive-canonical")), "redundant-support-path-ablation-v1");
  assert.deepEqual(p.runs.map(r => r.target.sourceEdgeIds), [["e0", "e1"], ["e2"]]);
  for (const r of p.runs) {
    assert.deepEqual(r.target.sourceNodeIds.slice(0, 1), ["n0"]); assert.equal(r.target.sourceNodeIds.at(-1), "n2");
    assert.equal(new Set(r.target.sourceNodeIds).size, r.target.sourceNodeIds.length);
    assert.equal(r.response.status, "changed");
  }
});

test("direction reversal retains rejected reciprocal targets and all independent applied targets", () => {
  const a = run(f("mixed-topology")), p = probe(a, "edge-direction-reversal-v1");
  assert.deepEqual(p.execution, { state: "completed", reason: null, targetCount: 4, appliedCount: 2, rejectedCount: 2 });
  assert.equal(p.summary.status, "indeterminate"); assert.deepEqual(p.summary.coverage, { numerator: 14, denominator: 28, complete: false });
  for (const r of p.runs.filter(r => r.execution === "rejected")) {
    assert.deepEqual(r.rejection, { code: "parallel-edge-after-reversal", sourceEdgeIds: ["e0", "e1"] });
    for (const field of ["graph", "edgeMapping", "changes", "observation", "response"]) assert.equal(r[field], null);
  }
  for (const r of p.runs.filter(r => r.execution === "applied")) {
    assert.equal(r.beforeGraphHash, a.baseline.graph.graphHash); assert.equal(r.graph.edges.length, 4);
    assert.equal(r.edgeMapping.filter(m => m.action === "reversed").length, 1);
  }
});

test("an unchanged complete direction response is measured evidence without a universal success or failure label", () => {
  const a = run(f("opaque")), p = probe(a, "edge-direction-reversal-v1");
  assert.equal(p.runs[0].response.status, "unchanged"); assert.equal(p.summary.status, "observed");
  assert.ok(p.runs[0].response.components.every(c => c.state === "equal" && c.delta === null));
  assert.equal(a.summary.status, "indeterminate");
});

test("topology records signed scalar deltas while graph values and component-size vectors retain categorical comparisons", () => {
  const p = probe(run(f("cycle-topology")), "feedback-edge-ablation-v1");
  for (const r of p.runs) {
    const fields = new Map(r.response.components.map(c => [c.observableId, c]));
    assert.equal(fields.get("node-count-v1").delta, 0); assert.equal(fields.get("edge-count-v1").delta, -1);
    assert.equal(fields.get("reachable-ordered-pair-count-v1").delta, -3); assert.equal(fields.get("cyclic-node-count-v1").delta, -3);
    assert.equal(fields.get("strong-component-sizes-v1").state, "different"); assert.equal(fields.get("strong-component-sizes-v1").delta, null);
  }
  assert.ok(run(f("chain-canonical")).probes.flatMap(p => p.runs).every(r => r.response.components[0].delta === null));
});

test("missing non-selector fields allow target discovery but retain structural differences under indeterminate typed responses", () => {
  const a = run(f("missing-role")), p = probe(a, "necessary-parent-ablation-v1");
  assert.equal(p.selection.state, "complete"); assert.equal(p.runs.length, 2);
  const r = p.runs.find(r => r.target.sourceEdgeIds[0] === "e0");
  assert.equal(r.observation.observations[1].availability, "observed");
  assert.equal(a.baseline.observation.observations[1].availability, "missing");
  assert.equal(r.response.status, "indeterminate"); assert.deepEqual(r.response.components.map(c => c.state), ["different", "indeterminate"]);
  assert.equal(p.summary.status, "indeterminate"); assert.equal(a.summary.status, "indeterminate");
});

test("diagnostic histograms retain all target multiplicities and rejected categories without source coordinates", () => {
  for (const a of artifacts.values()) for (const p of a.probes) {
    const histogram = p.summary.diagnostics.effectHistogram;
    assert.equal(histogram.reduce((sum, row) => sum + row.count, 0), p.execution.targetCount);
    for (const { effect } of histogram) {
      assert.deepEqual(Object.keys(effect).sort(), ["components", "rejection", "status"]);
      if (effect.status === "rejected") assert.equal(effect.components, null);
      else assert.deepEqual(effect.components.map(c => c.observableId), a.preparation.regime.observables.map(o => o.id));
    }
  }
  assert.equal(summarizeResponseProbe([], 2).status, "indeterminate");
});

test("exhaustive empty selections remain unavailable and never become measured zero responses", () => {
  const a = run(f("isolates")); assert.deepEqual(a.summary.coverage, { numerator: 0, denominator: 3, complete: false });
  for (const p of a.probes) {
    assert.equal(p.selection.state, "complete"); assert.equal(p.execution.reason, "no-eligible-targets");
    assert.deepEqual(p.runs, []); assert.equal(p.summary.status, "indeterminate"); assert.deepEqual(p.summary.diagnostics.effectHistogram, []);
  }
  assert.equal(a.work.observationEvaluations, 1); assert.equal(a.work.transformationEdgeVisits, 0);
});

test("expected-source verification binds exact scope and source identity even for the same structural graph", () => {
  const source = f("chain-canonical"), a = run(source);
  assert.throws(() => verifyStructuralResponseProbes(a, source.pack, { ...source.input, scope: { kind: "induced", nodeIds: ["n0", "n1"] } }));
  const foreign = buildModelPack({ model: { ...source.pack.manifest.model, id: "foreign-response-source" }, source: source.pack.manifest.source,
    nodes: source.pack.files["model/nodes.json"], edges: source.pack.files["model/edges.json"], dictionaries: source.pack.files["model/dictionaries.json"] });
  assert.throws(() => verifyStructuralResponseProbes(a, foreign, source.input), errorCode("VERIFICATION_FAILED"));
});

test("rehashing forged selectors, targets, transformed graphs, observations, histograms or coverage cannot authorize them", () => {
  const source = f("diamond-topology"), original = artifacts.get(source.id);
  for (const mutate of [
    a => { a.registry.probes[0].selector = "first-edge"; }, a => { a.profile.probeIds.pop(); }, a => { a.probes[2].runs.pop(); },
    a => { a.probes[2].runs[0].target.sourceEdgeIds.reverse(); }, a => { a.probes[1].runs[0].graph.edges.pop(); },
    a => { a.probes[1].runs[0].observation.observations[0].value = 3; }, a => { a.probes[2].runs[0].response.components[1].delta = 0; },
    a => { a.probes[2].summary.diagnostics.effectHistogram[0].count = 9; }, a => { a.summary.coverage.complete = true; },
    a => { a.work.selection.pathExtensions = 0; }, a => { a.sandbox.identityArtifactHash = a.artifactHash; }
  ]) { const a = structuredClone(original); mutate(a); assert.throws(() => verifyStructuralResponseProbes(resign(a), source.pack, source.input), errorCode("VERIFICATION_FAILED")); }
});

test("private observation and comparison boundaries reject incompatible source, scope, regime, adapter or observable bindings", () => {
  const a = artifacts.get("cycle-topology"), b = a.baseline.observation;
  for (const mutate of [o => { o.source.contextHash = "foreign"; }, o => { o.source.scopeHash = "foreign"; }, o => { o.adapter.id = "foreign"; },
    o => { o.observations.pop(); }, o => { o.observations[0].observable.id = "foreign"; }, o => { o.observations[0].implementation.contentHash = "foreign"; }]) {
    const other = structuredClone(b); mutate(other); assert.throws(() => measureResponse(b, other));
  }
  const graph = structuredClone(a.baseline.graph); graph.regime.id = "foreign";
  assert.throws(() => observeResponseGraph(a.preparation, graph, []), errorCode("BINDING_MISMATCH"));
});

test("closed requests reject callbacks, probe subsets, explicit source-ID targets and getter side effects", () => {
  let calls = 0;
  const getter = Object.defineProperty({ regimeId: "topology-only-v1" }, "scope", { enumerable: true, get() { calls += 1; return {}; } });
  for (const input of [null, [], {}, { regimeId: "other" }, { regimeId: "topology-only-v1", probeIds: [] }, { regimeId: "topology-only-v1", targets: ["e0"] },
    { regimeId: "topology-only-v1", transform() { calls += 1; } }, getter]) assert.throws(() => runStructuralResponseProbes(f("chain-topology").pack, input));
  assert.equal(calls, 0);
});

test("finite preflight accepts 64 exhaustive targets and 2048 edge visits, rejecting excess scope and target sets without truncation", () => {
  const a = run(f("maximum")); assert.equal(a.baseline.graph.nodes.length, 64); assert.equal(a.summary.targets.total, 64);
  assert.equal(a.work.transformationEdgeVisits, 2048); assert.equal(a.work.observationEvaluations, 65);
  assert.equal(a.work.selection.pathExtensions, 992); assert.equal(a.work.selection.reachabilitySearches, 1024);
  const tooMany = packFor({ id: "response-over-target-bound", nodes: 33, edges: Array.from({ length: 33 }, (_, from) => ({ from, to: (from + 1) % 33, types: controls.types.necessary })) });
  assert.throws(() => runStructuralResponseProbes(tooMany, { regimeId: "topology-only-v1" }), errorCode("LIMIT_EXCEEDED"));
  const dense = packFor({ id: "response-over-exhaustive-path-bound", nodes: 4,
    edges: Array.from({ length: 4 }, (_, from) => Array.from({ length: 4 }, (_, to) => from === to ? [] : [{ from, to, types: controls.types.necessary }])).flat(2) });
  assert.throws(() => runStructuralResponseProbes(dense, { regimeId: "canonical-structure-v1" }), errorCode("LIMIT_EXCEEDED"));
  const nodes = packFor({ id: "response-over-node-bound", nodes: 65, edges: [] });
  assert.throws(() => runStructuralResponseProbes(nodes, { regimeId: "topology-only-v1" }));
});

test("cumulative output limits reject individually valid typed responses before a partial artifact escapes", () => {
  const codes = Array.from({ length: 3000 }, (_, i) => 1000000000000000 + i);
  const types = { ...controls.types.necessary, interactionModeIds: codes, causalDirectionIds: codes };
  const pack = packFor({ id: "response-cumulative-bound", nodes: 3, edges: [[0, 1], [1, 2], [2, 0]].map(([from, to]) => ({ from, to, types })) });
  assert.throws(() => runStructuralResponseProbes(pack, { regimeId: "typed-relations-v1" }), e => errorCode("LIMIT_EXCEEDED")(e) && /Cumulative/.test(e.message));
});

test("typed source audits include excluded edges and opaque source IDs retain exact spelling", () => {
  const pack = packFor({ id: "response-invalid-excluded-type", nodes: 3, edges: [{ from: 1, to: 2, types: { necessity: "invalid" } }] });
  assert.throws(() => runStructuralResponseProbes(pack, { regimeId: "typed-relations-v1", scope: { kind: "induced", nodeIds: ["n0"] } }));
  const a = run(f("opaque")); assert.deepEqual(a.baseline.mapping.nodes.map(n => n.sourceNodeId), [" left ", "right\n"]);
  assert.deepEqual(probe(a, "necessary-parent-ablation-v1").runs[0].target.sourceNodeIds, [" left ", "right\n"]);
  const scope = run(f("boundary")).preparation.scope;
  assert.deepEqual([scope.edgeIds, scope.outgoingBoundaryEdgeIds, scope.externalEdgeIds, scope.incomingBoundaryEdgeIds], [["e0"], ["e1"], ["e2"], ["e3"]]);
});

test("engine execution is opt-in and requires an authentic Model while matching the direct response API", async () => {
  const source = f("chain-topology"), definition = createStructuralResponseAnalysis();
  const engine = await Onto2D.create({ models: [source.pack], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, source.input), run(source));
  assert.throws(() => definition.run({ model: {} }, source.input));
  const plain = await Onto2D.create({ models: [source.pack] }); await assert.rejects(() => plain.analyze(definition.id, source.input));
});
