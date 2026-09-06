import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { CANONICAL_STRUCTURE_IMPLEMENTATION, observeCanonicalStructure, verifyCanonicalStructureObservation,
  createCanonicalStructureObservationAnalysis } from "@onto2d/structural-geometry/canonical";
import { fixtures, packFor, input, readJson } from "../../../cases/structural-geometry/canonical/fixtures.mjs";

const controls = (await readJson("controls.json")).controls;
const graph = (id) => structuredClone(controls.find((g) => g.id === id));
const source = packFor(graph("outward-star"));
const code = (suffix) => (error) => error.code === `STRUCTURAL_CANONICAL_${suffix}`;
const resign = (kind, value, field = "artifactHash") => {
  const { [field]: _old, ...body } = value;
  return { ...body, [field]: hashCanonical(`onto2d:structural-canonical-${kind}:v1`, body) };
};
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}

test("canonical observation measures the frozen spec while retaining the exact unevaluated preparation", () => {
  const before = canonicalize(source), a = observeCanonicalStructure(source, input);
  assert.equal(a.evaluation, "measured");
  assert.deepEqual(a.preparation, prepareStructuralRegime(source, input));
  assert.equal(a.preparation.evaluation, "not-run");
  assert.equal(a.observation.observable.id, "canonical-directed-structure-v1");
  assert.equal(a.implementation.witnessMeaning, "one-isomorphism-not-canonical-orbits");
  assert.deepEqual(a.implementation, CANONICAL_STRUCTURE_IMPLEMENTATION);
  assert.deepEqual(resign("value", a.observation, "valueHash"), a.observation);
  assert.deepEqual(resign("artifact", a), a);
  for (const key of ["distance", "status", "probes", "responseSignature"]) assert.equal(Object.hasOwn(a, key), false);
  frozen(a); assert.equal(canonicalize(source), before);
});

test("all frozen source-bound observations replay exactly", async () => {
  for (const f of await fixtures()) {
    const a = await readJson(`artifacts/${f.id}.json`);
    assert.deepEqual(verifyCanonicalStructureObservation(a, f.pack, f.input), a);
  }
});

test("source relabeling, model identity, dictionaries and annotations change provenance without changing the canonical value", () => {
  const a = observeCanonicalStructure(packFor(graph("asymmetric-six")), input);
  for (const id of ["asymmetric-six-renamed", "asymmetric-six-annotations"]) {
    const b = observeCanonicalStructure(packFor(graph(id)), input);
    assert.deepEqual(b.observation, a.observation);
    assert.notEqual(b.preparation.context.contextHash, a.preparation.context.contextHash);
    assert.notEqual(b.artifactHash, a.artifactHash);
  }
});

test("direction distinguishes the outward and inward star despite equal node, edge and weak skeleton counts", () => {
  const a = observeCanonicalStructure(source, input), b = observeCanonicalStructure(packFor(graph("inward-star")), input);
  assert.equal(a.observation.value.nodeCount, b.observation.value.nodeCount);
  assert.equal(a.observation.value.edges.length, b.observation.value.edges.length);
  assert.equal(a.witness.skeletonHash, b.witness.skeletonHash);
  assert.notEqual(a.observation.valueHash, b.observation.valueHash);
});

test("cycles, reciprocal arcs and disconnected structure are retained, including every isolate", () => {
  for (const [left, right] of [["one-edge", "reciprocal-pair"], ["cycle-four", "disjoint-reciprocal-pairs"],
    ["singleton", "two-isolates"], ["directed-chain", "transitive-triangle"]]) {
    assert.notEqual(observeCanonicalStructure(packFor(graph(left)), input).observation.valueHash,
      observeCanonicalStructure(packFor(graph(right)), input).observation.valueHash);
  }
  const emptyEdges = observeCanonicalStructure(packFor(graph("six-isolates")), input);
  assert.deepEqual(emptyEdges.observation.value, { nodeCount: 6, edges: [] });
  assert.equal(emptyEdges.witness.nodes.length, 6);
});

test("the witness bijection reconstructs precisely the source directed edges for every control", () => {
  for (const g of controls) {
    const pack = packFor(g), a = observeCanonicalStructure(pack, input);
    const mapping = new Map(a.witness.nodes.map((n) => [n.sourceNodeId, n.canonicalNode]));
    assert.deepEqual([...mapping.values()].sort((x, y) => x - y), Array.from({ length: g.nodes }, (_, i) => i));
    const expected = pack.files["model/edges.json"].map((e) => ({ sourceEdgeId: e.id, from: mapping.get(e.source), to: mapping.get(e.target) }));
    assert.deepEqual(a.witness.edges, expected);
    assert.deepEqual(expected.map(({ from, to }) => `${from}:${to}`).sort(), a.observation.value.edges.map(({ from, to }) => `${from}:${to}`).sort());
    assert.ok(a.witness.statistics.searchStates <= 100000);
  }
});

test("explicit scoping excludes boundary relationships from values while preserving their complete provenance", () => {
  const g = { id: "boundary", nodes: 5, edges: [[0, 1], [1, 2], [2, 3], [3, 0]] };
  const request = { ...input, scope: { kind: "induced", nodeIds: ["n4", "n1", "n0"] } };
  const a = observeCanonicalStructure(packFor(g), request);
  assert.equal(a.observation.value.nodeCount, 3); assert.equal(a.observation.value.edges.length, 1);
  assert.deepEqual(a.preparation.scope.incomingBoundaryEdgeIds, ["e3"]);
  assert.deepEqual(a.preparation.scope.outgoingBoundaryEdgeIds, ["e1"]);
  assert.deepEqual(a.preparation.scope.externalEdgeIds, ["e2"]);
  const changed = structuredClone(g); changed.edges[2] = [3, 2];
  const b = observeCanonicalStructure(packFor(changed), request);
  assert.deepEqual(b.observation, a.observation);
  assert.notEqual(b.preparation.scope.scopeHash, a.preparation.scope.scopeHash);
  assert.notEqual(b.artifactHash, a.artifactHash);
});

test("full scope and explicit induced full membership yield the same observation under different preparation identities", () => {
  const a = observeCanonicalStructure(source, input);
  const b = observeCanonicalStructure(source, { ...input, scope: { kind: "induced", nodeIds: ["n2", "n0", "n1"] } });
  assert.deepEqual(b.observation, a.observation);
  assert.notEqual(b.preparation.artifactHash, a.preparation.artifactHash);
});

test("record order and edge IDs do not enter canonical values", () => {
  const edges = source.files["model/edges.json"].map((e, i) => ({ ...e, id: `renamed-${10 - i}` })).reverse();
  const changed = buildModelPack({ model: source.manifest.model, source: source.manifest.source,
    nodes: [...source.files["model/nodes.json"]].reverse(), edges, dictionaries: {} });
  const a = observeCanonicalStructure(source, input), b = observeCanonicalStructure(changed, input);
  assert.deepEqual(b.observation, a.observation); assert.notEqual(b.artifactHash, a.artifactHash);
  assert.deepEqual(verifyCanonicalStructureObservation(b, changed, input), b);
});

test("explicit regime selection rejects unimplemented evaluators, arbitrary thresholds and work-limit overrides", () => {
  for (const request of [{}, null, [], { ...input, tolerance: 0.1 }, { ...input, maxSearchStates: 1 },
    { ...input, scope: { kind: "full", nodeIds: [] } }, { ...input, scope: { kind: "induced", nodeIds: [] } }]) {
    assert.throws(() => observeCanonicalStructure(source, request));
  }
  for (const regimeId of ["typed-relations-v1", "topology-only-v1", "history-aware-v1"]) {
    assert.throws(() => observeCanonicalStructure(source, { regimeId }), code("REGIME_UNSUPPORTED"));
  }
  let invoked = false;
  assert.throws(() => observeCanonicalStructure(source, { get regimeId() { invoked = true; return input.regimeId; } }));
  assert.equal(invoked, false);
});

test("complete-source corruption and invalid excluded topology cannot be hidden by an induced scope", () => {
  const request = { ...input, scope: { kind: "induced", nodeIds: ["n2"] } };
  const corrupt = structuredClone(source); corrupt.files["model/edges.json"][0].weight = 0.9;
  assert.throws(() => observeCanonicalStructure(corrupt, request));
  assert.throws(() => observeCanonicalStructure(packFor({ id: "loop", nodes: 3, edges: [[0, 0]] }), request));
  assert.throws(() => observeCanonicalStructure(packFor({ id: "parallel", nodes: 3, edges: [[0, 1], [0, 1]] }), request));
  assert.throws(() => observeCanonicalStructure(source, { ...input, scope: { kind: "induced", nodeIds: ["absent"] } }));
});

test("the six-node bound is enforced before matching, and complete six-node digraphs are supported", () => {
  assert.equal(observeCanonicalStructure(packFor(graph("complete-six")), input).observation.value.edges.length, 30);
  const seven = packFor({ id: "seven", nodes: 7, edges: [] });
  assert.throws(() => observeCanonicalStructure(seven, input), (e) => e.code === "STRUCTURAL_REGIME_LIMIT_EXCEEDED");
  assert.equal(observeCanonicalStructure(seven, { ...input, scope: { kind: "induced", nodeIds: ["n0"] } }).observation.value.nodeCount, 1);
});

test("expected-source replay rejects rehashed canonical values, source mappings, implementation identities and search statistics", () => {
  const original = observeCanonicalStructure(source, input);
  for (const mutate of [
    (a) => { a.observation.value.edges.reverse(); }, (a) => { a.observation.value.nodeCount = 4; },
    (a) => { a.observation.value.edges[0].from = 0; }, (a) => { a.observation.regime.contentHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.witness.nodes[0].canonicalNode = 0; }, (a) => { a.witness.edges[0].from = 0; },
    (a) => { a.witness.statistics.searchStates += 1; }, (a) => { a.witness.candidateHash = a.witness.skeletonHash; },
    (a) => { a.implementation.attributes = "included"; }, (a) => { a.preparation.evaluation = "measured"; },
    (a) => { a.evaluation = "not-run"; }, (a) => { a.distance = 0; }
  ]) {
    const a = structuredClone(original); mutate(a);
    a.observation = resign("value", a.observation, "valueHash");
    assert.throws(() => verifyCanonicalStructureObservation(resign("artifact", a), source, input), code("VERIFICATION_FAILED"));
  }
  assert.throws(() => verifyCanonicalStructureObservation(original, packFor(graph("inward-star")), input), code("VERIFICATION_FAILED"));
});

test("verification rejects a different valid automorphism witness because artifacts promise exact deterministic replay", () => {
  const a = structuredClone(observeCanonicalStructure(source, input));
  // Both leaf exchanges are graph isomorphisms; they are not the same replay record.
  const leaves = a.witness.nodes.filter((n) => n.sourceNodeId !== "n0");
  [leaves[0].canonicalNode, leaves[1].canonicalNode] = [leaves[1].canonicalNode, leaves[0].canonicalNode];
  const map = new Map(a.witness.nodes.map((n) => [n.sourceNodeId, n.canonicalNode]));
  a.witness.edges = source.files["model/edges.json"].map((e) => ({ sourceEdgeId: e.id, from: map.get(e.source), to: map.get(e.target) }));
  assert.throws(() => verifyCanonicalStructureObservation(resign("artifact", a), source, input), code("VERIFICATION_FAILED"));
});

test("oversized verification payloads fail the byte budget without being accepted by a self-reported hash", () => {
  const a = structuredClone(observeCanonicalStructure(source, input)); a.extra = "x".repeat(1048576);
  assert.throws(() => verifyCanonicalStructureObservation(a, source, input), code("LIMIT_EXCEEDED"));
});

test("canonical observations opt into the engine and require its authentic Model bridge", async () => {
  const definition = createCanonicalStructureObservationAnalysis();
  const engine = await Onto2D.create({ models: [source], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, input), observeCanonicalStructure(source, input));
  assert.throws(() => definition.run({ model: {} }, input));
  const plain = await Onto2D.create({ models: [source] });
  await assert.rejects(() => plain.analyze(definition.id, input));
});
