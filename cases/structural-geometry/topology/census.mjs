import assert from "node:assert/strict";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { measureDirectedTopology } from "../../../packages/structural-geometry/src/topology-core.js";
import { readJson } from "./fixtures.mjs";

export async function verifyCensus() {
  const { census } = await readJson("reference.json");
  assert.deepEqual(census.map((row) => row.nodes), [1, 2, 3, 4]);
  const rows = [], digests = [];
  for (const entry of census) {
    const n = entry.nodes, nodes = Array.from({ length: n }, (_, i) => `n${i}`);
    const slots = nodes.flatMap((source) => nodes.filter((target) => source !== target).map((target) => ({ source, target })));
    const profiles = new Map(), orbits = new Map();
    assert.equal(entry.labelledGraphs, 2 ** (n * (n - 1)));
    assert.equal(entry.profileIndices.length, entry.labelledGraphs);
    assert.equal(entry.canonicalKeys.length, entry.labelledGraphs);
    for (let mask = 0; mask < entry.labelledGraphs; mask += 1) {
      const edges = slots.filter((_, bit) => mask & (2 ** bit)).map((e, i) => ({ ...e, id: `e${i}` }));
      const { value, diagnostics } = measureDirectedTopology(nodes, edges);
      assert.deepEqual(value, entry.profiles[entry.profileIndices[mask]], `Independent topology mismatch: n=${n}, mask=${mask}`);
      const encoded = canonicalize(value), key = entry.canonicalKeys[mask];
      if (orbits.has(key)) assert.equal(orbits.get(key), encoded, "Isomorphic graphs must have equal summaries.");
      orbits.set(key, encoded);
      if (!profiles.has(encoded)) profiles.set(encoded, new Set());
      profiles.get(encoded).add(key);
      assert.deepEqual(measureDirectedTopology(nodes, edges.map((e) => ({ ...e, source: e.target, target: e.source }))).value, value,
        "All seven summaries are invariant under whole-edge transposition.");
      assert.equal(diagnostics.work.reachabilityPairVisits, value.reachableOrderedPairCount + n);
      digests.push({ n, mask, valueHash: hashCanonical("onto2d:structural-topology-census-value:v1", value) });
    }
    assert.equal(profiles.size, entry.profiles.length);
    rows.push({ nodes: n, labelledGraphs: entry.labelledGraphs, isomorphismClasses: orbits.size,
      summaryClasses: profiles.size, collidingSummaryClasses: [...profiles.values()].filter((keys) => keys.size > 1).length,
      maxIsomorphismClassesPerSummary: Math.max(...[...profiles.values()].map((keys) => keys.size)) });
  }
  assert.equal(rows.reduce((sum, row) => sum + row.isomorphismClasses, 0), 238);
  return { rows, censusHash: hashCanonical("onto2d:structural-topology-census:v1", digests) };
}
