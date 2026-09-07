import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { runStructuralProbeSandbox } from "@onto2d/structural-geometry/sandbox";

function* permutations(values) {
  if (!values.length) { yield []; return; }
  for (let i = 0; i < values.length; i += 1) for (const rest of permutations(values.filter((_, j) => j !== i))) yield [values[i], ...rest];
}
const makePack = (n, pairs, labels, edgeIds, reverse = false) => buildModelPack({
  model: { id: "sandbox-transport-control", name: "Sandbox transport control", version: "1" }, source: { id: "declared-test", files: [] }, dictionaries: {},
  nodes: (reverse ? [...labels].reverse() : labels).map(id => ({ id })),
  edges: (reverse ? [...pairs.entries()].reverse() : [...pairs.entries()]).map(([i, [u, v]]) =>
    ({ id: edgeIds[i], source: labels[u], target: labels[v], relationLayer: "source-parent" })) });
function transportedResult(a, labels, edgeIds) {
  const nodeBySource = new Map(labels.map((id, i) => [id, i])), edgeBySource = new Map(edgeIds.map((id, i) => [id, i]));
  const nodeByShadow = new Map(a.baseline.mapping.nodes.map(n => [n.shadowNodeId, nodeBySource.get(n.sourceNodeId)]));
  const edgeByShadow = new Map(a.baseline.mapping.edges.map(e => [e.shadowEdgeId, edgeBySource.get(e.sourceEdgeId)]));
  const numbers = ids => ids.map(id => edgeBySource.get(id)).sort((x, y) => x - y);
  const graph = g => g && { nodes: g.nodes.map(n => nodeByShadow.get(n.id)).sort((x, y) => x - y),
    edges: g.edges.map(e => [edgeByShadow.get(e.id), nodeByShadow.get(e.source), nodeByShadow.get(e.target)]).sort((x, y) => x[0] - y[0]) };
  const runs = a.runs.map(r => ({ target: numbers(r.target.sourceEdgeIds), execution: r.execution,
    conflict: r.rejection && numbers(r.rejection.sourceEdgeIds), graph: graph(r.graph),
    mapping: r.edgeMapping && r.edgeMapping.map(m => [edgeBySource.get(m.sourceEdgeId), m.action]).sort((x, y) => x[0] - y[0]) }));
  runs.sort((x, y) => canonicalize(x.target).localeCompare(canonicalize(y.target), "en"));
  return { baseline: graph(a.baseline.graph), eligible: numbers(a.selection.eligibleSourceEdgeIds), execution: a.execution, work: a.work, runs };
}

test("all node bijections on all 69 small graphs transport every singleton target and its outcome", () => {
  let renamedRequests = 0;
  for (let n = 1; n <= 3; n += 1) {
    const slots = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? null : [u, v]).filter(Boolean)).flat();
    for (let mask = 0; mask < 2 ** slots.length; mask += 1) {
      const pairs = slots.filter((_, i) => mask & (1 << i)), labels = Array.from({ length: n }, (_, i) => `n${i}`), ids = pairs.map((_, i) => `e${i}`);
      const pack = makePack(n, pairs, labels, ids);
      for (const kind of ["remove-edges", "reverse-edges"]) {
        const input = { regimeId: "topology-only-v1", transformation: { kind, targets: "each-scoped-edge" } };
        const expected = transportedResult(runStructuralProbeSandbox(pack, input), labels, ids);
        for (const p of permutations(Array.from({ length: n }, (_, i) => i))) {
          const changedLabels = p.map(i => `renamed-${i}`), changedIds = ids.map((_, i) => `edge-${ids.length - i}`);
          const changed = makePack(n, pairs, changedLabels, changedIds);
          assert.deepEqual(transportedResult(runStructuralProbeSandbox(changed, input), changedLabels, changedIds), expected);
          renamedRequests += 1;
        }
      }
    }
  }
  assert.equal(renamedRequests, 786);
});

test("serialization and source record order preserve exact sandbox artifacts", () => {
  const pairs = [[0, 1], [1, 0], [1, 2]], labels = [" z ", "\uE000", "𝄞"], ids = ["edge\n", " y ", "x"];
  const pack = makePack(3, pairs, labels, ids), reordered = makePack(3, pairs, labels, ids, true);
  assert.deepEqual(pack, reordered);
  const input = { regimeId: "topology-only-v1", transformation: { kind: "reverse-edges", targets: "each-scoped-edge" } };
  const result = runStructuralProbeSandbox(pack, input), before = canonicalize(pack);
  assert.deepEqual(runStructuralProbeSandbox(reordered, { transformation: { targets: "each-scoped-edge", kind: "reverse-edges" }, regimeId: input.regimeId }), result);
  assert.equal(canonicalize(pack), before);
});
