import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack, verifyModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { runStructuralProbeSandbox, verifyStructuralProbeSandbox, createStructuralProbeSandboxAnalysis,
  STRUCTURAL_PROBE_SANDBOX_POLICY } from "@onto2d/structural-geometry/sandbox";
import { prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { fixtures, readJson } from "../../../cases/structural-geometry/sandbox/fixtures.mjs";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";
import { packFor as untypedPack } from "../../../cases/structural-geometry/canonical/fixtures.mjs";

const examples = await fixtures(), controls = await readJson("controls.json");
const f = id => examples.find(x => x.id === id), run = x => runStructuralProbeSandbox(x.pack, x.input);
const source = f("chain-identity").pack, input = f("chain-identity").input;
const code = suffix => e => e.code === `STRUCTURAL_SANDBOX_${suffix}`;
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = (kind, a, field = "artifactHash") => {
  const { [field]: _hash, ...body } = a;
  return { ...body, [field]: hashCanonical(`onto2d:structural-sandbox-${kind}:v1`, body, { limits: { maxEntries: 500000 } }) };
};

test("sandbox freezes independent graphs and preserves exact source, request, regime preparation and mappings", () => {
  const x = structuredClone(f("chain-identity")), before = canonicalize(x), a = run(x);
  assert.equal(canonicalize(x), before); frozen(a); frozen(STRUCTURAL_PROBE_SANDBOX_POLICY);
  assert.deepEqual(a.preparation, prepareStructuralRegime(x.pack, { regimeId: x.input.regimeId }));
  assert.deepEqual(a, resign("artifact", a)); assert.deepEqual(a.policy, STRUCTURAL_PROBE_SANDBOX_POLICY);
  assert.deepEqual(a.runs[0].graph, a.baseline.graph); assert.notEqual(a.runs[0].graph, a.baseline.graph);
  assert.equal(a.observationEvaluation, "not-run"); assert.equal(a.preparation.regime.probeSets.response.execution, "none");
  for (const field of ["distance", "status", "responseSignature", "invariancePassed"]) assert.equal(Object.hasOwn(a, field), false);
  assert.throws(() => verifyModelPack(a.runs[0].graph));
});

test("each-edge removals start from the same baseline and retain all isolates", () => {
  const a = run(f("chain-remove-each")), edges = a.baseline.graph.edges;
  assert.equal(a.runs.length, edges.length);
  for (const r of a.runs) {
    assert.equal(r.beforeGraphHash, a.baseline.graph.graphHash);
    assert.equal(r.graph.edges.length, edges.length - 1); assert.deepEqual(r.graph.nodes, a.baseline.graph.nodes);
    assert.deepEqual(r.changes.removedSourceEdgeIds, r.target.sourceEdgeIds);
    assert.equal(r.edgeMapping.filter(m => m.action === "removed" && m.afterEdgeId === null).length, 1);
    for (const m of r.edgeMapping.filter(m => m.action === "preserved")) assert.equal(m.beforeEdgeId, m.afterEdgeId);
  }
  const all = run(f("chain-remove-all")); assert.equal(all.runs[0].graph.edges.length, 0);
  assert.deepEqual(all.runs[0].graph.nodes, all.baseline.graph.nodes);
});

test("all-edge reversal is simultaneous and carries joint typed annotations unchanged", () => {
  const a = run(f("reciprocal-reverse-all")), r = a.runs[0];
  assert.equal(r.execution, "applied"); assert.equal(r.graph.edges.length, 2);
  for (const [i, edge] of a.baseline.graph.edges.entries()) {
    assert.deepEqual(r.graph.edges[i], { ...edge, source: edge.target, target: edge.source });
    assert.equal(r.edgeMapping[i].action, "reversed");
  }
});

test("reciprocal singleton reversal rejects every target without fabricated output or collapsed edges", () => {
  const a = run(f("reciprocal-reverse-each"));
  assert.deepEqual(a.execution, { state: "completed", reason: null, targetCount: 2, appliedCount: 0, rejectedCount: 2 });
  assert.equal(a.work.outputGraphCount, 1); assert.equal(a.baseline.graph.edges.length, 2);
  for (const r of a.runs) {
    assert.equal(r.execution, "rejected"); assert.equal(r.graph, null); assert.equal(r.changes, null); assert.equal(r.edgeMapping, null);
    assert.deepEqual(r.rejection, { code: "parallel-edge-after-reversal", sourceEdgeIds: ["e0", "e1"] });
  }
});

test("a completed batch retains both rejected and applied independent targets", () => {
  const a = run(f("mixed-reverse-each"));
  assert.deepEqual(a.execution, { state: "completed", reason: null, targetCount: 3, appliedCount: 1, rejectedCount: 2 });
  assert.equal(a.runs[2].execution, "applied"); assert.equal(a.runs[2].graph.edges.length, 3);
  assert.deepEqual(a.runs[2].changes.reversedSourceEdgeIds, ["e2"]);
  assert.equal(a.work.transformationEdgeVisits, 9);
});

test("empty edge targets are unavailable while edgeless identity copies are applied", () => {
  for (const op of ["remove-all", "remove-each", "reverse-all", "reverse-each"]) {
    const a = run(f(`isolates-${op}`));
    assert.deepEqual(a.execution, { state: "unavailable", reason: "empty-target-set", targetCount: 0, appliedCount: 0, rejectedCount: 0 });
    assert.deepEqual(a.runs, []); assert.deepEqual(a.work, { transformationEdgeVisits: 0, outputGraphCount: 1 });
    assert.equal(a.baseline.graph.nodes.length, 2);
  }
  const identity = run(f("isolates-identity")); assert.equal(identity.runs[0].execution, "applied");
  assert.equal(identity.runs[0].graph.nodes.length, 2); assert.equal(identity.work.outputGraphCount, 2);
});

test("typed fields retain absent evidence and normalized sets without adding geometric or presentation attributes", () => {
  const missing = run(f("missing-reverse-all"));
  assert.equal(Object.hasOwn(missing.baseline.graph.edges[0].types, "interactionModeIds"), false);
  assert.deepEqual(missing.runs[0].graph.edges[0].types, missing.baseline.graph.edges[0].types);
  const sets = run(f("sets-identity"));
  for (const field of ["interactionModeIds", "causalDirectionIds"]) {
    const values = sets.baseline.graph.edges[0].types[field]; assert.deepEqual(values, [...values].sort((a, b) => a - b));
  }
  const x = f("sets-identity"), a = runStructuralProbeSandbox(x.pack, { ...x.input, regimeId: "canonical-structure-v1" });
  assert.equal(Object.hasOwn(a.baseline.graph.edges[0], "types"), false);
});

test("scoped operations preserve all four source edge partitions and isolated selected nodes", () => {
  const a = run(f("boundary-remove-all"));
  assert.deepEqual(a.preparation.scope.nodeIds, ["n0", "n1", "n4"]);
  for (const [field, expected] of [["edgeIds", ["e0"]], ["incomingBoundaryEdgeIds", ["e3"]],
    ["outgoingBoundaryEdgeIds", ["e1"]], ["externalEdgeIds", ["e2"]]]) assert.deepEqual(a.preparation.scope[field], expected);
  assert.deepEqual(a.selection.eligibleSourceEdgeIds, ["e0"]); assert.equal(a.runs[0].graph.nodes.length, 3);
  assert.deepEqual(a.runs[0].changes.removedSourceEdgeIds, ["e0"]);
});

test("opaque source IDs and exact scope spelling survive the source/shadow mapping", () => {
  const x = f("opaque-identity"), a = run(x);
  assert.deepEqual(a.baseline.mapping.nodes.map(n => n.sourceNodeId), [" left ", "right\n"]);
  const b = runStructuralProbeSandbox(x.pack, { ...x.input, scope: { kind: "induced", nodeIds: ["right\n", " left "] } });
  assert.deepEqual(b.baseline.graph.nodes, a.baseline.graph.nodes); assert.deepEqual(b.baseline.mapping, a.baseline.mapping);
  assert.throws(() => runStructuralProbeSandbox(x.pack, { ...x.input, scope: { kind: "induced", nodeIds: ["left"] } }));
});

test("all 32 symmetric targets execute at the fixed maximum work and 33 targets never truncate", () => {
  const a = run(f("maximum-targets-remove-each"));
  assert.equal(a.runs.length, 32); assert.equal(new Set(a.runs.flatMap(r => r.target.sourceEdgeIds)).size, 32);
  assert.equal(a.work.transformationEdgeVisits, 1024); assert.equal(a.work.outputGraphCount, 33);
  const g = structuredClone(controls.graphs.find(g => g.id === "cycle-32"));
  g.edges.push({ ...g.edges[0], to: 2 });
  assert.throws(() => runStructuralProbeSandbox(packFor(g), f("maximum-targets-remove-each").input), code("LIMIT_EXCEEDED"));
});

test("topology accepts 64 nodes and 256 edges for one all-edge operation, enforcing regime limits without truncation", () => {
  const graph = { id: "maximum-graph", nodes: 64, edges: Array.from({ length: 64 }, (_, u) => [1, 2, 3, 4].map(d => [u, (u + d) % 64])).flat() };
  const request = { regimeId: "topology-only-v1", transformation: { kind: "remove-edges", targets: "all-scoped-edges" } };
  const a = runStructuralProbeSandbox(untypedPack(graph), request);
  assert.equal(a.baseline.graph.edges.length, 256); assert.equal(a.runs[0].graph.nodes.length, 64);
  assert.equal(a.work.transformationEdgeVisits, 256);
  assert.throws(() => runStructuralProbeSandbox(untypedPack({ ...graph, edges: [...graph.edges, [0, 5]] }), request));
  assert.throws(() => runStructuralProbeSandbox(untypedPack({ ...graph, nodes: 65 }), request));
  assert.throws(() => runStructuralProbeSandbox(untypedPack({ id: "seven", nodes: 7, edges: [] }), input));
});

test("source corruption and invalid excluded typed fields reject before an empty or otherwise rejected target", () => {
  const corrupt = structuredClone(source); corrupt.files["model/edges.json"][0].target = "unknown";
  assert.throws(() => runStructuralProbeSandbox(corrupt, { ...input, scope: { kind: "induced", nodeIds: ["n0"] } }));
  const g = structuredClone(controls.graphs.find(g => g.id === "boundary")); g.edges[2].types.necessity = "invalid";
  const request = { regimeId: "typed-relations-v1", scope: { kind: "induced", nodeIds: ["n4"] }, transformation: { kind: "reverse-edges", targets: "each-scoped-edge" } };
  assert.throws(() => runStructuralProbeSandbox(packFor(g), request), e => e.code === "STRUCTURAL_TYPED_FIELD_INVALID");
  g.edges[2].types = {}; assert.equal(runStructuralProbeSandbox(packFor(g), request).execution.state, "unavailable");
});

test("loops, parallel source edges and foreign layers are invalid even outside the selected scope", () => {
  const x = f("mixed-identity");
  for (const mutate of [g => { g.edges[0].to = 0; }, g => { g.edges.push(g.edges[0]); }]) {
    const g = structuredClone(controls.graphs.find(g => g.id === "mixed")); mutate(g);
    assert.throws(() => runStructuralProbeSandbox(packFor(g), { ...x.input, scope: { kind: "induced", nodeIds: ["n2"] } }));
  }
  const files = structuredClone(x.pack.files);
  files["model/edges.json"][0].relationLayer = "other";
  const bad = buildModelPack({ model: x.pack.manifest.model, source: x.pack.manifest.source,
    nodes: files["model/nodes.json"], edges: files["model/edges.json"], dictionaries: files["model/dictionaries.json"] });
  assert.throws(() => runStructuralProbeSandbox(bad, { ...x.input, scope: { kind: "induced", nodeIds: ["n2"] } }));
});

test("closed requests reject arbitrary target IDs, callbacks, seeds, thresholds, sequences and policy overrides", () => {
  for (const request of [null, [], {}, { transformation: { kind: "identity" } }, { ...input, seed: 1 }, { ...input, maxTargets: 1 },
    { ...input, callback() {} }, { ...input, threshold: 1 }, { ...input, transformations: [] }, { ...input, scope: null },
    { ...input, scope: { kind: "induced", nodeIds: [] } }, { ...input, regimeId: "unknown" },
    ...[{}, null, { kind: "identity", targets: "all-scoped-edges" }, { kind: "reverse-edges" }, { kind: "add-edge" },
      { kind: "remove-edges", targets: ["e0"] }, { kind: "reverse-edges", targets: "first-edge" },
      { kind: "remove-edges", targets: "each-scoped-edge", limit: 1 }].map(transformation => ({ ...input, transformation }))]) {
    assert.throws(() => runStructuralProbeSandbox(source, request));
  }
  let invoked = false;
  assert.throws(() => runStructuralProbeSandbox(source, { ...input, transformation: { get kind() { invoked = true; return "identity"; } } }));
  assert.equal(invoked, false);
});

test("replay rejects rehashed graphs, targets, mapping, work, rejection and source provenance", () => {
  const x = f("mixed-reverse-each"), original = run(x);
  for (const mutate of [
    a => { a.baseline.graph.nodes[0].id = "n999"; }, a => { a.baseline.graph.source.scopeHash = a.artifactHash; },
    a => { a.baseline.mapping.edges[0].sourceEdgeId = "forged"; }, a => { a.selection.eligibleSourceEdgeIds.reverse(); },
    a => { a.runs[0].target.sourceEdgeIds = ["e2"]; }, a => { a.runs[0].rejection.sourceEdgeIds = ["e0", "e2"]; },
    a => { a.runs[2].graph.edges[2].source = "n000"; }, a => { a.runs[2].edgeMapping[2].action = "preserved"; },
    a => { a.runs[2].changes.reversedSourceEdgeIds = []; }, a => { a.runs.reverse(); }, a => { a.runs.pop(); },
    a => { a.execution.appliedCount += 1; }, a => { a.work.transformationEdgeVisits -= 1; },
    a => { a.observationEvaluation = "passed"; }, a => { a.policy.ordering = "choose-first-source-id"; }
  ]) {
    const a = structuredClone(original); mutate(a);
    a.baseline.graph = resign("graph", a.baseline.graph, "graphHash");
    a.runs = a.runs.map(r => resign("run", { ...r, graph: r.graph && resign("graph", r.graph, "graphHash") }, "runHash"));
    assert.throws(() => verifyStructuralProbeSandbox(resign("artifact", a), x.pack, x.input), code("VERIFICATION_FAILED"));
  }
});

test("verification binds an externally expected source, scope and operation even when graph values match", () => {
  const a = run(f("chain-identity"));
  assert.throws(() => verifyStructuralProbeSandbox(a, source, { ...input, scope: { kind: "induced", nodeIds: a.preparation.scope.nodeIds } }), code("VERIFICATION_FAILED"));
  assert.throws(() => verifyStructuralProbeSandbox(a, source, { ...input, transformation: { kind: "reverse-edges", targets: "all-scoped-edges" } }), code("VERIFICATION_FAILED"));
  const files = source.files, changed = buildModelPack({ model: { ...source.manifest.model, name: "different source metadata" }, source: source.manifest.source,
    nodes: files["model/nodes.json"], edges: files["model/edges.json"], dictionaries: files["model/dictionaries.json"] });
  assert.throws(() => verifyStructuralProbeSandbox(a, changed, input), code("VERIFICATION_FAILED"));
});

test("verification and cumulative execution enforce separate artifact byte budgets", () => {
  const a = structuredClone(run(f("chain-identity"))); a.extra = Array(5000).fill("x".repeat(1024));
  assert.throws(() => verifyStructuralProbeSandbox(a, source, input), code("LIMIT_EXCEEDED"));
  const types = { dependencyTypeId: 0, interactionModeIds: Array.from({ length: 2000 }, (_, i) => i),
    causalDirectionIds: [], ontologicalRole: "arising", necessity: "necessary" };
  const edges = Array.from({ length: 6 }, (_, from) => Array.from({ length: 6 }, (_, to) => from === to ? null : { from, to, types }).filter(Boolean)).flat();
  const pack = packFor({ id: "cumulative-budget", nodes: 6, edges });
  assert.throws(() => runStructuralProbeSandbox(pack, { regimeId: "typed-relations-v1", transformation: { kind: "remove-edges", targets: "each-scoped-edge" } }), /cumulative output exceeds/);
});

test("engine execution requires opt-in and an authentic source Model", async () => {
  const definition = createStructuralProbeSandboxAnalysis();
  const engine = await Onto2D.create({ models: [source], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, input), runStructuralProbeSandbox(source, input));
  assert.throws(() => definition.run({ model: {} }, input));
  const plain = await Onto2D.create({ models: [source] }); await assert.rejects(() => plain.analyze(definition.id, input));
});
