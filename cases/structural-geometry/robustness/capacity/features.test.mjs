import assert from "node:assert/strict";
import test from "node:test";
import { graphCapacityFeatures, quadraticCoordinates, FEATURE_NAMES, MODELS, PROFILE } from "./features.mjs";
import { python } from "./io.mjs";

const graph = (nodes, arcs) => ({ nodes, edges: arcs.map(([source, target]) => ({ source, target })) });
const diamond = graph(["A", "B", "C", "D"], [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"]]);
const named = pair => Object.fromEntries(PROFILE.expandedFeatures.map((name, i) => [name, pair.expanded[i]]));

test("all three-node digraphs, a singleton, branching paths and long walks agree with independent exact features", async () => {
  const nodes = ["A", "B", "C"], arcs = nodes.flatMap(u => nodes.filter(v => v !== u).map(v => [u, v]));
  const controls = Array.from({ length: 64 }, (_, mask) => graph(nodes, arcs.filter((_, i) => mask & (1 << i))));
  controls.push(graph(["isolate"], []), diamond, graph(["A", "B", "C", "D"], [["A", "B"], ["B", "A"], ["A", "C"], ["C", "D"], ["D", "A"]]));
  assert.deepEqual(controls.map(graphCapacityFeatures), await python("reference.py", ["--features"], controls));
});

test("shortest path multiplicity differs from edge union and sink propagation does not invent self-loops", () => {
  const pairs = graphCapacityFeatures(diamond).pairs, value = named(pairs.find(row => row.source === "A" && row.target === "D"));
  assert.equal(value.forward_shortest_path_count, 2); assert.equal(value.forward_shortest_path_edge_union_count, 4);
  assert.equal(value.reverse_distance, 0); assert.equal(value.reverse_unreachable, 1);
  assert.equal(value.source_out_harmonic, 5 / 6); assert.equal(value.target_in_harmonic, 5 / 6);
  assert.equal(value.propagation_step_5, 0); assert.equal(value.propagation_step_8, 0);
  const common = named(pairs.find(row => row.source === "B" && row.target === "C"));
  assert.equal(common.predecessor_jaccard, 1); assert.equal(common.successor_jaccard, 1);
  const cycle = graphCapacityFeatures(graph(["A", "B", "C"], [["A", "B"], ["B", "C"], ["C", "A"]]));
  const reverse = named(cycle.pairs.find(row => row.source === "A" && row.target === "B"));
  assert.equal(reverse.reverse_distance, 2); assert.equal(reverse.reverse_propagation_step_2, 1); assert.equal(reverse.propagation_step_7, 1);
});

test("record order and opaque node relabelling cannot change graph-only coordinates", () => {
  const before = structuredClone(diamond), original = graphCapacityFeatures(diamond);
  assert.deepEqual(graphCapacityFeatures({ nodes: [...diamond.nodes].reverse(), edges: [...diamond.edges].reverse() }), original);
  const names = new Map([["A", "z"], ["B", "x"], ["C", "a"], ["D", "q"]]);
  const renamed = graphCapacityFeatures(graph(diamond.nodes.map(node => names.get(node)), diamond.edges.map(row => [names.get(row.source), names.get(row.target)])));
  for (const pair of original.pairs) assert.deepEqual(renamed.pairs.find(row => row.source === names.get(pair.source) && row.target === names.get(pair.target)),
    { ...pair, source: names.get(pair.source), target: names.get(pair.target) });
  assert.deepEqual(diamond, before);
});

test("capacity feature bounds and closed graph inputs reject partial graphs, extra signals and numeric overflow", () => {
  assert.throws(() => graphCapacityFeatures(graph(Array.from({ length: 65 }, (_, i) => `n${i}`), [])), /bound/);
  assert.throws(() => graphCapacityFeatures({ ...diamond, outcomes: [1, 2] }));
  assert.throws(() => graphCapacityFeatures({ ...diamond, edges: [...diamond.edges, diamond.edges[0]] }));
  const sparse = [...diamond.nodes]; delete sparse[1]; assert.throws(() => graphCapacityFeatures({ ...diamond, nodes: sparse }));
  assert.throws(() => quadraticCoordinates(Array(23).fill(1e308)), /overflow/);
  assert.equal(FEATURE_NAMES.length, 116); assert.equal(MODELS["B+Q"].length, 54); assert.equal(MODELS["B+S"].length, 54);
  assert.equal(MODELS["B+S+G"].length, 85);
});
