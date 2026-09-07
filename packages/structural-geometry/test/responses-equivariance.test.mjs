import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { runStructuralResponseProbes } from "@onto2d/structural-geometry/responses";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";
import { fixtures, readJson } from "../../../cases/structural-geometry/responses/fixtures.mjs";

const controls = await readJson("controls.json"), types = controls.types[controls.censusType];
const sort = values => [...values].sort((a, b) => { const x = canonicalize(a), y = canonicalize(b); return x < y ? -1 : x > y ? 1 : 0; });
function permutations(values) { return !values.length ? [[]] : values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest])); }
function renamed(pack, permutation) {
  const sourceNodes = pack.files["model/nodes.json"], sourceEdges = pack.files["model/edges.json"];
  const nodes = new Map(sourceNodes.map((n, i) => [n.id, `${permutation[i] % 2 ? "\u{10000}" : "\ue000"} node ${permutation[i]} `]));
  const edges = new Map(sourceEdges.map((e, i) => [e.id, ` renamed-edge-${sourceEdges.length - 1 - i}\n`]));
  return { pack: buildModelPack({ model: { ...pack.manifest.model, id: `transport-${permutation.join("")}` }, source: pack.manifest.source,
    nodes: [...sourceNodes].reverse().map(n => ({ ...n, id: nodes.get(n.id), presentation: { label: "changed", x: 42 } })),
    edges: [...sourceEdges].reverse().map(e => ({ ...e, id: edges.get(e.id), source: nodes.get(e.source), target: nodes.get(e.target), label: "changed presentation" })),
    dictionaries: pack.files["model/dictionaries.json"] }),
    nodes: new Map([...nodes].map(([a, b]) => [b, a])), edges: new Map([...edges].map(([a, b]) => [b, a])) };
}
function transported(artifact, back = { nodes: new Map(), edges: new Map() }) {
  const node = id => back.nodes.get(id) ?? id, edge = id => back.edges.get(id) ?? id;
  const nodes = new Map(artifact.baseline.mapping.nodes.map(n => [n.shadowNodeId, node(n.sourceNodeId)]));
  const edges = new Map(artifact.baseline.mapping.edges.map(e => [e.shadowEdgeId, edge(e.sourceEdgeId)]));
  const graph = g => g ? { nodes: g.nodes.map(n => nodes.get(n.id)).sort(), edges: sort(g.edges.map(e => ({ id: edges.get(e.id), source: nodes.get(e.source), target: nodes.get(e.target), ...(e.types ? { types: e.types } : {}) }))) } : null;
  const values = observation => observation?.observations.map(o => ({ value: o.value, missing: sort(o.missing.map(g => ({ ...g, sourceEdgeId: edge(g.sourceEdgeId) }))) })) ?? null;
  return { baseline: { graph: graph(artifact.baseline.graph), values: values(artifact.baseline.observation) },
    probes: artifact.probes.map(p => ({ id: p.probe.id, selection: { state: p.selection.state,
      known: p.selection.knownEligibleSourceEdgeIds.map(edge).sort(), unknown: p.selection.unknownSourceEdgeIds.map(edge).sort() },
      execution: p.execution, summary: p.summary,
      runs: sort(p.runs.map(r => ({ target: { kind: r.target.kind, nodes: r.target.sourceNodeIds.map(node), edges: r.target.sourceEdgeIds.map(edge) },
        execution: r.execution, rejection: r.rejection ? { code: r.rejection.code, sourceEdgeIds: r.rejection.sourceEdgeIds.map(edge).sort() } : null,
        graph: graph(r.graph), values: values(r.observation), response: r.response,
        edgeMapping: r.edgeMapping ? sort(r.edgeMapping.map(m => ({ sourceEdgeId: edge(m.sourceEdgeId), action: m.action, retained: m.afterEdgeId !== null }))) : null,
        changes: r.changes ? { removed: r.changes.removedSourceEdgeIds.map(edge).sort(), reversed: r.changes.reversedSourceEdgeIds.map(edge).sort() } : null }))) })),
    summary: artifact.summary, work: { ...artifact.work, selection: { pathExtensions: artifact.work.selection.pathExtensions, reachabilitySearches: artifact.work.selection.reachabilitySearches } } };
}

test("all 69 small directed graphs transport every response target, output and histogram under all node bijections and reversed edge IDs", () => {
  let requests = 0;
  for (let n = 1; n <= 3; n += 1) {
    const pairs = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? [] : [[u, v]])).flat(2);
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const pack = packFor({ id: `response-transport-${n}-${mask}`, nodes: n, edges: pairs.filter((_, i) => mask & (1 << i)).map(([from, to]) => ({ from, to, types })) });
      const input = { regimeId: "topology-only-v1" }, original = transported(runStructuralResponseProbes(pack, input));
      for (const permutation of permutations(Array.from({ length: n }, (_, i) => i))) {
        const changed = renamed(pack, permutation);
        assert.deepEqual(transported(runStructuralResponseProbes(changed.pack, input), changed), original, `n${n} mask${mask} permutation${permutation}`); requests += 1;
      }
    }
  }
  assert.equal(requests, 393);
});

test("all 24 typed diamond-feedback bijections preserve declared dependency selectors, joint observations and effect multiplicities", async () => {
  const source = (await fixtures()).find(f => f.id === "diamond-feedback-typed"), original = transported(runStructuralResponseProbes(source.pack, source.input));
  for (const permutation of permutations([0, 1, 2, 3])) {
    const changed = renamed(source.pack, permutation);
    assert.deepEqual(transported(runStructuralResponseProbes(changed.pack, source.input), changed), original);
  }
});
