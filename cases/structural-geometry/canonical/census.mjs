import assert from "node:assert/strict";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { canonicalizeDirectedStructure } from "../../../packages/structural-geometry/src/canonical-core.js";
import { readJson } from "./fixtures.mjs";

export function slots(n) { return Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => [u, v]).filter(([, v]) => u !== v)).flat(); }
export function graphFor(n, mask) {
  return slots(n).filter((_, bit) => mask & (2 ** bit)).map(([u, v], i) => ({ id: `e${i}`, source: `n${u}`, target: `n${v}` }));
}
export async function verifyCensus() {
  const reference = await readJson("reference.json");
  assert.deepEqual(reference.census.map((entry) => entry.nodes), [1, 2, 3, 4], "The exhaustive census domain must stay fixed.");
  const rows = [], digests = [];
  for (const entry of reference.census) {
    const n = entry.nodes, forward = new Map(), backward = new Map(), positions = new Map(slots(n).map(([u, v], i) => [`${u}:${v}`, i]));
    let maxSearchStates = 0;
    assert.equal(entry.keys.length, 2 ** (n * (n - 1)));
    for (const [mask, key] of entry.keys.entries()) {
      const nodes = Array.from({ length: n }, (_, i) => `n${i}`), edges = graphFor(n, mask);
      const result = canonicalizeDirectedStructure(nodes, edges), value = canonicalize(result.value);
      // Independent minimum-permutation keys need not use the kernel's label
      // order. Compare orbit partitions in both directions, never hash claims alone.
      if (forward.has(key)) assert.equal(forward.get(key), value, `False split: n=${n}, mask=${mask}`);
      if (backward.has(value)) assert.equal(backward.get(value), key, `False merge: n=${n}, mask=${mask}`);
      forward.set(key, value); backward.set(value, key);
      const valueMask = result.value.edges.reduce((bits, { from, to }) => bits + 2 ** positions.get(`${from}:${to}`), 0);
      assert.equal(entry.keys[valueMask], key, `Output outside source orbit: n=${n}, mask=${mask}`);
      const mapping = new Map(result.witness.nodes.map((node) => [node.sourceNodeId, node.canonicalNode]));
      assert.deepEqual([...mapping.values()].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
      assert.deepEqual(edges.map((edge) => `${mapping.get(edge.source)}:${mapping.get(edge.target)}`).sort(),
        result.value.edges.map(({ from, to }) => `${from}:${to}`).sort());
      maxSearchStates = Math.max(maxSearchStates, result.witness.statistics.searchStates);
      digests.push({ n, mask, key, valueHash: hashCanonical("onto2d:structural-canonical-census-value:v1", result.value) });
    }
    assert.equal(forward.size, entry.isomorphismClasses);
    assert.equal(backward.size, entry.isomorphismClasses);
    rows.push({ nodes: n, labelledGraphs: entry.keys.length, isomorphismClasses: forward.size, maxSearchStates });
  }
  return { rows, censusHash: hashCanonical("onto2d:structural-canonical-census:v1", digests) };
}
function* permutations(values) {
  if (!values.length) { yield []; return; }
  for (let i = 0; i < values.length; i += 1) for (const rest of permutations(values.filter((_, j) => j !== i))) yield [values[i], ...rest];
}
export async function verifySixNodeRelabelings() {
  const graph = (await readJson("controls.json")).controls.find((g) => g.id === "asymmetric-six");
  let expected, count = 0;
  for (const mapping of permutations([0, 1, 2, 3, 4, 5])) {
    const edges = graph.edges.map(([u, v], i) => ({ id: `e${i}`, source: `n${mapping[u]}`, target: `n${mapping[v]}` }));
    const value = canonicalize(canonicalizeDirectedStructure(mapping.map((i) => `n${i}`), edges).value);
    if (expected === undefined) expected = value;
    else assert.equal(value, expected, `Six-node relabeling ${count} split the canonical value.`);
    count += 1;
  }
  assert.equal(count, 720);
  return { graph: graph.id, permutations: count };
}
