import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { observeCanonicalStructure } from "@onto2d/structural-geometry/canonical";
import { TOPOLOGY_OBSERVATION_IMPLEMENTATION, observeStructuralTopology, verifyStructuralTopologyObservation,
  createStructuralTopologyObservationAnalysis } from "@onto2d/structural-geometry/topology";
import { fixtures, packFor, input, readJson } from "../../../cases/structural-geometry/topology/fixtures.mjs";

const controls = (await readJson("controls.json")).controls;
const graph = (id) => structuredClone(controls.find((g) => g.id === id));
const source = packFor(graph("outward-star"));
const observe = (id) => observeStructuralTopology(packFor(graph(id)), input);
const code = (suffix) => (error) => error.code === `STRUCTURAL_TOPOLOGY_${suffix}`;
const resign = (kind, value, field = "artifactHash") => {
  const { [field]: _old, ...body } = value;
  return { ...body, [field]: hashCanonical(`onto2d:structural-topology-${kind}:v1`, body) };
};
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}

test("topology measures exactly the seven frozen specs while preserving the unevaluated preparation", () => {
  const before = canonicalize(source), a = observeStructuralTopology(source, input);
  assert.equal(a.evaluation, "measured");
  assert.deepEqual(a.preparation, prepareStructuralRegime(source, input));
  assert.equal(a.preparation.evaluation, "not-run");
  assert.deepEqual(a.observation.observables, a.preparation.regime.observables);
  assert.deepEqual(a.implementation, TOPOLOGY_OBSERVATION_IMPLEMENTATION);
  assert.deepEqual(a.implementation.valueFields.map((entry) => entry.observableId), a.observation.observables.map((spec) => spec.id));
  assert.deepEqual(a.implementation.valueFields.map((entry) => entry.field).sort(), Object.keys(a.observation.value).sort());
  assert.equal(a.observation.observables.length, 7);
  assert.deepEqual(resign("value", a.observation, "valueHash"), a.observation);
  assert.deepEqual(resign("artifact", a), a);
  for (const key of ["distance", "status", "probes", "responseSignature"]) assert.equal(Object.hasOwn(a, key), false);
  frozen(a); assert.equal(canonicalize(source), before);
});

test("all 23 observations replay exactly against their frozen verified sources", async () => {
  const examples = await fixtures(); assert.equal(examples.length, 23);
  for (const f of examples) {
    const a = await readJson(`artifacts/${f.id}.json`);
    assert.deepEqual(verifyStructuralTopologyObservation(a, f.pack, f.input), a);
  }
});

test("the outward and inward star collide in all seven summaries while exact canonical analysis separates them", () => {
  const a = observe("outward-star"), b = observe("inward-star");
  assert.deepEqual(a.observation, b.observation);
  assert.deepEqual(a.observation.value, { nodeCount: 3, edgeCount: 2, weakComponentSizes: [3], strongComponentSizes: [1, 1, 1],
    reachableOrderedPairCount: 2, cyclicNodeCount: 0, isolatedNodeCount: 0 });
  assert.notDeepEqual(a.diagnostics.reachablePairsBySource, b.diagnostics.reachablePairsBySource);
  assert.equal(a.implementation.graphIsomorphismClaim, false);
  const exact = (id) => observeCanonicalStructure(packFor(graph(id)), { regimeId: "canonical-structure-v1" });
  assert.notEqual(exact("outward-star").observation.valueHash, exact("inward-star").observation.valueHash);
});

test("directed reachability counts distinct pairs once despite multiple paths and excludes self pairs on cycles", () => {
  const diamond = observeStructuralTopology(packFor({ id: "diamond", nodes: 4, edges: [[0, 1], [0, 2], [1, 3], [2, 3]] }), input);
  assert.equal(diamond.observation.value.reachableOrderedPairCount, 5);
  assert.deepEqual(diamond.diagnostics.reachablePairsBySource.map((r) => r.count), [3, 1, 1, 0]);
  assert.equal(observe("directed-triangle").observation.value.reachableOrderedPairCount, 6);
  assert.equal(observe("directed-chain").observation.value.reachableOrderedPairCount, 3);
  assert.equal(observe("transitive-triangle").observation.value.reachableOrderedPairCount, 3);
  assert.notEqual(observe("directed-chain").observation.valueHash, observe("transitive-triangle").observation.valueHash);
});

test("component vectors sort numerically and retain isolated singletons", () => {
  const ordered = observe("numeric-component-order");
  assert.deepEqual(ordered.observation.value.weakComponentSizes, [2, 10]);
  assert.deepEqual(ordered.observation.value.strongComponentSizes, [2, 10]);
  assert.equal(ordered.observation.value.cyclicNodeCount, 12);
  assert.equal(ordered.observation.value.reachableOrderedPairCount, 92);
  assert.deepEqual(observe("two-isolates").observation.value, { nodeCount: 2, edgeCount: 0, weakComponentSizes: [1, 1],
    strongComponentSizes: [1, 1], reachableOrderedPairCount: 0, cyclicNodeCount: 0, isolatedNodeCount: 2 });
});

test("disconnected reciprocal pairs and one directed cycle have different reachability and component profiles", () => {
  const a = observe("cycle-four").observation.value, b = observe("disjoint-reciprocal-pairs").observation.value;
  assert.equal(a.cyclicNodeCount, 4); assert.equal(b.cyclicNodeCount, 4);
  assert.deepEqual(a.strongComponentSizes, [4]); assert.deepEqual(b.strongComponentSizes, [2, 2]);
  assert.equal(a.reachableOrderedPairCount, 12); assert.equal(b.reachableOrderedPairCount, 4);
});

test("64-node boundaries support exact analytic reachability and explicit worst-case traversal work", () => {
  const chain = observe("chain-64"), cycle = observe("cycle-64"), max = observe("maximum-64-256"), isolates = observe("isolates-64");
  assert.equal(chain.observation.value.reachableOrderedPairCount, 2016);
  assert.equal(chain.observation.value.cyclicNodeCount, 0);
  for (const a of [cycle, max]) {
    assert.equal(a.observation.value.reachableOrderedPairCount, 4032);
    assert.equal(a.observation.value.cyclicNodeCount, 64);
    assert.deepEqual(a.observation.value.strongComponentSizes, [64]);
    assert.equal(a.diagnostics.work.reachabilityPairVisits, 4096);
  }
  assert.equal(max.observation.value.edgeCount, 256);
  assert.equal(max.diagnostics.work.reachabilityEdgeScans, 16384);
  assert.equal(isolates.observation.value.isolatedNodeCount, 64);
  assert.equal(isolates.diagnostics.work.reachabilityPairVisits, 64);
  assert.equal(isolates.diagnostics.work.reachabilityEdgeScans, 0);
});

test("source relabeling, identity, dictionaries and annotations change provenance but preserve all observed coordinates", () => {
  const a = observe("asymmetric-six");
  assert.deepEqual(observe("asymmetric-six-renamed").diagnostics.reachablePairsBySource.map((row) => row.sourceNodeId),
    ["-", "0", "10", "a", "😀", "\uE000"]);
  for (const id of ["asymmetric-six-renamed", "asymmetric-six-annotations"]) {
    const b = observe(id);
    assert.deepEqual(b.observation, a.observation);
    assert.notEqual(b.preparation.context.contextHash, a.preparation.context.contextHash);
    assert.notEqual(b.artifactHash, a.artifactHash);
  }
});

test("record order and renamed edge IDs do not change summary values or diagnostic memberships", () => {
  const edges = source.files["model/edges.json"].map((e, i) => ({ ...e, id: `renamed-${10 - i}` })).reverse();
  const changed = buildModelPack({ model: source.manifest.model, source: source.manifest.source,
    nodes: [...source.files["model/nodes.json"]].reverse(), edges, dictionaries: {} });
  const a = observeStructuralTopology(source, input), b = observeStructuralTopology(changed, input);
  assert.deepEqual(b.observation, a.observation); assert.deepEqual(b.diagnostics, a.diagnostics);
  assert.notEqual(b.artifactHash, a.artifactHash);
});

test("induced scope excludes boundary paths and edges while retaining scoped isolates and all boundary provenance", () => {
  const g = { id: "boundary", nodes: 5, edges: [[0, 1], [1, 2], [2, 3], [3, 0]] };
  const request = { ...input, scope: { kind: "induced", nodeIds: ["n4", "n1", "n0"] } };
  const a = observeStructuralTopology(packFor(g), request);
  assert.deepEqual(a.observation.value, { nodeCount: 3, edgeCount: 1, weakComponentSizes: [1, 2], strongComponentSizes: [1, 1, 1],
    reachableOrderedPairCount: 1, cyclicNodeCount: 0, isolatedNodeCount: 1 });
  assert.deepEqual(a.preparation.scope.incomingBoundaryEdgeIds, ["e3"]);
  assert.deepEqual(a.preparation.scope.outgoingBoundaryEdgeIds, ["e1"]);
  assert.deepEqual(a.preparation.scope.externalEdgeIds, ["e2"]);
  const changed = structuredClone(g); changed.edges[2] = [3, 2];
  const b = observeStructuralTopology(packFor(changed), request);
  assert.deepEqual(b.observation, a.observation); assert.notEqual(b.artifactHash, a.artifactHash);
});

test("full scope and explicit induced full membership share a value with distinct preparation bindings", () => {
  const a = observeStructuralTopology(source, input);
  const b = observeStructuralTopology(source, { ...input, scope: { kind: "induced", nodeIds: ["n2", "n0", "n1"] } });
  assert.deepEqual(b.observation, a.observation); assert.notEqual(b.artifactHash, a.artifactHash);
});

test("complete source verification precedes scoping, including invalid excluded relationships", () => {
  const request = { ...input, scope: { kind: "induced", nodeIds: ["n2"] } };
  const corrupt = structuredClone(source); corrupt.files["model/edges.json"][0].weight = 0.9;
  assert.throws(() => observeStructuralTopology(corrupt, request));
  for (const edges of [[[0, 0]], [[0, 1], [0, 1]]]) {
    assert.throws(() => observeStructuralTopology(packFor({ id: "invalid", nodes: 3, edges }), request));
  }
  assert.throws(() => observeStructuralTopology(source, { ...input, scope: { kind: "induced", nodeIds: ["absent"] } }));
});

test("requests cannot override the fixed profile, limits or introduce thresholds and empty scopes", () => {
  for (const request of [{}, null, [], { ...input, tolerance: 0.1 }, { ...input, maxReachabilityPairVisits: 1 },
    { ...input, scope: { kind: "full", nodeIds: [] } }, { ...input, scope: { kind: "induced", nodeIds: [] } }]) {
    assert.throws(() => observeStructuralTopology(source, request));
  }
  for (const regimeId of ["canonical-structure-v1", "typed-relations-v1", "history-aware-v1"]) {
    assert.throws(() => observeStructuralTopology(source, { regimeId }), code("REGIME_UNSUPPORTED"));
  }
  let invoked = false;
  assert.throws(() => observeStructuralTopology(source, { get regimeId() { invoked = true; return input.regimeId; } }));
  assert.equal(invoked, false);
});

test("65 nodes or 257 internal edges reject without truncation while a bounded induced scope remains valid", () => {
  const large = packFor({ id: "65", nodes: 65, edges: [] });
  const limit = (e) => e.code === "STRUCTURAL_REGIME_LIMIT_EXCEEDED";
  assert.throws(() => observeStructuralTopology(large, input), limit);
  const dense = graph("maximum-64-256"); dense.edges.push([0, 5]);
  assert.throws(() => observeStructuralTopology(packFor(dense), input), limit);
  assert.equal(observeStructuralTopology(large, { ...input, scope: { kind: "induced", nodeIds: ["n0"] } }).observation.value.nodeCount, 1);
});

test("expected-source verification rejects rehashed values, spec order, memberships, work totals and fabricated comparison results", () => {
  const original = observeStructuralTopology(source, input);
  for (const mutate of [
    ...["nodeCount", "edgeCount", "reachableOrderedPairCount", "cyclicNodeCount", "isolatedNodeCount"].map((field) => (a) => { a.observation.value[field] += 1; }),
    (a) => { a.observation.value.weakComponentSizes.push(1); }, (a) => { a.observation.value.strongComponentSizes.pop(); },
    (a) => { a.observation.observables.reverse(); }, (a) => { a.observation.regime.contentHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.diagnostics.strongComponents.reverse(); }, (a) => { a.diagnostics.weakComponents[0].pop(); },
    (a) => { a.diagnostics.reachablePairsBySource[0].count += 1; }, (a) => { a.diagnostics.work.reachabilityPairVisits += 1; },
    (a) => { a.diagnostics.work.reachabilityEdgeScans += 1; }, (a) => { a.implementation.graphIsomorphismClaim = true; },
    (a) => { a.preparation.evaluation = "measured"; }, (a) => { a.evaluation = "not-run"; },
    (a) => { a.distance = 0; }, (a) => { a.status = "indistinguishable-under-regime"; }
  ]) {
    const a = structuredClone(original); mutate(a); a.observation = resign("value", a.observation, "valueHash");
    assert.throws(() => verifyStructuralTopologyObservation(resign("artifact", a), source, input), code("VERIFICATION_FAILED"));
  }
  // Equal summary values do not authorize replay against a different source.
  assert.throws(() => verifyStructuralTopologyObservation(original, packFor(graph("inward-star")), input), code("VERIFICATION_FAILED"));
  assert.throws(() => verifyStructuralTopologyObservation(original, source, { ...input, scope: { kind: "induced", nodeIds: ["n0"] } }), code("VERIFICATION_FAILED"));
});

test("oversized verification artifacts reject within the fixed byte budget", () => {
  const a = structuredClone(observeStructuralTopology(source, input)); a.extra = "x".repeat(1048576);
  assert.throws(() => verifyStructuralTopologyObservation(a, source, input), code("LIMIT_EXCEEDED"));
});

test("topology observations require explicit engine registration and the authentic Model bridge", async () => {
  const definition = createStructuralTopologyObservationAnalysis();
  const engine = await Onto2D.create({ models: [source], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, input), observeStructuralTopology(source, input));
  assert.throws(() => definition.run({ model: {} }, input));
  const plain = await Onto2D.create({ models: [source] });
  await assert.rejects(() => plain.analyze(definition.id, input));
});
