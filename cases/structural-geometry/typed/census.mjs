import assert from "node:assert/strict";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { canonicalizeTypedDirectedStructure } from "../../../packages/structural-geometry/src/typed-core.js";
import { readJson } from "./fixtures.mjs";

function* permutations(values) {
  if (!values.length) { yield []; return; }
  for (let i = 0; i < values.length; i += 1) for (const rest of permutations(values.filter((_, j) => i !== j))) yield [values[i], ...rest];
}
export function referenceKey(value) {
  let best;
  for (const p of permutations(Array.from({ length: value.nodeCount }, (_, i) => i))) {
    const edges = value.edges.map((e) => [p[e.from], p[e.to], Object.fromEntries(Object.keys(e.types).sort().map((f) =>
      [f, Array.isArray(e.types[f]) ? [...e.types[f]].sort((a, b) => a - b) : e.types[f]]))]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const text = JSON.stringify([value.nodeCount, edges]);
    if (best === undefined || text < best) best = text;
  }
  return best;
}
export async function verifyCensus() {
  const { census } = await readJson("reference.json"), { colors } = await readJson("controls.json");
  assert.deepEqual(census.map((c) => c.nodes), [1, 2, 3]);
  const colorKeys = colors.map((color) => canonicalize(color)), rows = [], digests = [];
  for (const entry of census) {
    const n = entry.nodes, ids = Array.from({ length: n }, (_, i) => `n${i}`);
    const slots = ids.flatMap((source, u) => ids.flatMap((target, v) => u === v ? [] : [{ source, target, u, v }]));
    const positions = new Map(slots.map(({ u, v }, i) => [`${u}:${v}`, i]));
    const forward = new Map(), backward = new Map(); let maxSearchStates = 0;
    assert.equal(entry.keys.length, 3 ** (n * (n - 1))); assert.equal(entry.labelledGraphs, entry.keys.length);
    for (const [code, key] of entry.keys.entries()) {
      const edges = slots.flatMap((e, i) => {
        const label = Math.floor(code / 3 ** i) % 3;
        return label ? [{ id: `e${i}`, source: e.source, target: e.target, ...colors[label - 1] }] : [];
      });
      const result = canonicalizeTypedDirectedStructure(ids, edges), value = canonicalize(result.value);
      if (forward.has(key)) assert.equal(forward.get(key), value, `False typed split: n=${n}, code=${code}`);
      if (backward.has(value)) assert.equal(backward.get(value), key, `False typed merge: n=${n}, code=${code}`);
      forward.set(key, value); backward.set(value, key);
      const outputCode = result.value.edges.reduce((sum, e) => {
        const label = colorKeys.indexOf(canonicalize(e.types)) + 1;
        assert.ok(label > 0, "Output must preserve all five fields as one label.");
        return sum + label * 3 ** positions.get(`${e.from}:${e.to}`);
      }, 0);
      assert.equal(entry.keys[outputCode], key, "Canonical typed output left its source orbit.");
      maxSearchStates = Math.max(maxSearchStates, result.witness.statistics.searchStates);
      digests.push({ n, code, key, valueHash: hashCanonical("onto2d:structural-typed-census-value:v1", result.value) });
    }
    assert.equal(forward.size, entry.typedIsomorphismClasses); assert.equal(backward.size, forward.size);
    rows.push({ nodes: n, labelledGraphs: entry.keys.length, typedIsomorphismClasses: forward.size, maxSearchStates });
  }
  return { rows, censusHash: hashCanonical("onto2d:structural-typed-census:v1", digests) };
}
export async function verifySixNodeRelabelings() {
  const graph = (await readJson("controls.json")).controls.find((g) => g.id === "asymmetric-six");
  let expected, count = 0;
  for (const p of permutations([0, 1, 2, 3, 4, 5])) {
    const edges = graph.edges.map((e, i) => ({ id: `e${i}`, source: `n${p[e.from]}`, target: `n${p[e.to]}`, ...e.types }));
    const value = canonicalize(canonicalizeTypedDirectedStructure(p.map((i) => `n${i}`), edges).value);
    if (expected === undefined) expected = value;
    else assert.equal(value, expected, `Typed six-node relabeling ${count} split the value.`);
    count += 1;
  }
  assert.equal(count, 720); return { graph: graph.id, permutations: count };
}
