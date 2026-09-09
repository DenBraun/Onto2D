import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { BASELINE_FEATURE_NAMES, graphBaselineFeatures } from "../../protocol/baselines.mjs";
import { GEOMETRY_FEATURE_NAMES } from "../../dream4/geometry.mjs";
import { fraction, add, divide, encodedFraction } from "../../../../packages/structural-geometry/src/rational.js";

export const PROFILE = deepFreeze(JSON.parse(readFileSync(new URL("profile.json", import.meta.url))));
const indices = names => names.map(name => { const index = BASELINE_FEATURE_NAMES.indexOf(name); assert.ok(index >= 0); return index; });
const squares = indices(PROFILE.quadraticSquares), products = PROFILE.quadraticProducts.map(indices);
export const FEATURE_NAMES = deepFreeze([...BASELINE_FEATURE_NAMES, ...PROFILE.quadraticSquares.map(name => `square:${name}`),
  ...PROFILE.quadraticProducts.map(names => `product:${names.join("*")}`), ...PROFILE.expandedFeatures, ...GEOMETRY_FEATURE_NAMES]);
const range = (start, count) => Array.from({ length: count }, (_, i) => start + i);
const B = range(0, 23), Q = range(23, 31), S = range(54, 31), G = range(85, 31);
export const MODELS = deepFreeze({ B, "B+G": [...B, ...G], "B+Q": [...B, ...Q], "B+S": [...B, ...S],
  "B+Q+G": [...B, ...Q, ...G], "B+S+G": [...B, ...S, ...G] });
assert.equal(FEATURE_NAMES.length, 116); assert.equal(new Set(FEATURE_NAMES).size, 116);
assert.equal(squares.length + products.length, 31); assert.equal(PROFILE.expandedFeatures.length, 31);
assert.deepEqual(Object.keys(MODELS), PROFILE.models);

function fail(message) { throw Object.assign(new Error(message), { code: "BIOLOGICAL_CAPACITY_LIMIT_EXCEEDED" }); }
export function quadraticCoordinates(baseline) {
  assert.equal(baseline.length, 23); assert.ok(baseline.every(Number.isFinite));
  const result = [...squares.map(i => baseline[i] * baseline[i]), ...products.map(([i, j]) => baseline[i] * baseline[j])];
  if (result.some(value => !Number.isFinite(value))) fail("Quadratic coordinate overflow.");
  return result;
}
const F = value => fraction(BigInt(value)), zero = () => F(0);
const sum = values => values.reduce(add, zero());
const ratio = (a, b) => b ? fraction(BigInt(a), BigInt(b)) : zero();
function convert(value) {
  const exact = encodedFraction(value);
  if (Object.values(exact).some(text => text.replace("-", "").length > PROFILE.limits.rationalDigits)) fail("Expanded coordinate rational bound exceeded.");
  const numeric = Number(value.n) / Number(value.d);
  if (!Number.isFinite(numeric) || (numeric === 0 && value.n !== 0n)) fail("Expanded coordinate conversion is unsupported.");
  return { exact, numeric };
}

/** Complete graph-only basis; outcomes, labels-as-covariates and parent graphs are not inputs. */
export function graphCapacityFeatures(graph) {
  assert.ok(graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges));
  const n = graph.nodes.length, m = graph.edges.length, limits = PROFILE.limits;
  if (n > limits.nodes || m > limits.edges || n * (n - 1) * 116 > limits.pairCoordinates ||
      12 * n ** 3 + n * n * m + 16 * n * m > limits.workUnits) fail("Whole graph exceeds the declared capacity feature bounds.");
  const baseline = graphBaselineFeatures(graph); // Also validates the closed, dense, simple graph before allocation.
  const nodes = [...graph.nodes].sort(), positions = new Map(nodes.map((node, i) => [node, i]));
  const edges = graph.edges.map(edge => [positions.get(edge.source), positions.get(edge.target)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const outgoing = Array.from({ length: n }, () => []), incoming = Array.from({ length: n }, () => []);
  edges.forEach(([u, v]) => { outgoing[u].push(v); incoming[v].push(u); });
  const shortest = nodes.map((_, source) => {
    const distance = Array(n).fill(-1), count = Array(n).fill(0n), queue = [source]; distance[source] = 0; count[source] = 1n;
    for (let i = 0; i < queue.length; i++) for (const target of outgoing[queue[i]]) {
      const u = queue[i];
      if (distance[target] < 0) { distance[target] = distance[u] + 1; queue.push(target); }
      if (distance[target] === distance[u] + 1) count[target] += count[u];
    }
    return { distance, count };
  });
  const union = (u, v) => shortest[u].distance[v] < 0 ? 0 : edges.filter(([a, b]) =>
    shortest[u].distance[a] >= 0 && shortest[b].distance[v] >= 0 && shortest[u].distance[a] + 1 + shortest[b].distance[v] === shortest[u].distance[v]).length;
  const harmonic = nodes.map((_, u) => [false, true].map(reverse => n < 2 ? zero() : divide(sum(nodes.flatMap((_, v) => {
    const d = reverse ? shortest[v].distance[u] : shortest[u].distance[v]; return d > 0 ? [ratio(1, d)] : [];
  })), F(n - 1))));
  const means = nodes.map((_, u) => [incoming[u], outgoing[u]].flatMap(neighbors => [incoming, outgoing].map(adjacency =>
    ratio(neighbors.reduce((total, v) => total + adjacency[v].length, 0), neighbors.length))));
  const reciprocity = nodes.map((_, u) => {
    const reciprocal = incoming[u].filter(v => outgoing[u].includes(v)).length;
    return [ratio(reciprocal, incoming[u].length), ratio(reciprocal, outgoing[u].length)];
  });
  const walks = Array.from({ length: 8 }, () => Array.from({ length: n }, () => null));
  for (let source = 0; source < n; source++) {
    let mass = nodes.map((_, v) => F(Number(source === v)));
    for (let step = 0; step < 8; step++) {
      const next = nodes.map(zero);
      for (let u = 0; u < n; u++) if (outgoing[u].length && mass[u].n) {
        const share = divide(mass[u], F(outgoing[u].length));
        for (const v of outgoing[u]) next[v] = add(next[v], share);
      }
      walks[step][source] = next; mass = next;
    }
  }
  const pairs = baseline.pairs.map(pair => {
    const u = positions.get(pair.source), v = positions.get(pair.target), reverse = shortest[v].distance[u];
    const overlap = adjacency => ratio(adjacency[u].filter(w => adjacency[v].includes(w)).length, new Set([...adjacency[u], ...adjacency[v]]).size);
    const values = [F(Math.max(reverse, 0)), F(Number(reverse < 0)), fraction(shortest[u].count[v]), F(union(u, v)),
      fraction(shortest[v].count[u]), F(union(v, u)), ...harmonic[u], ...harmonic[v], ...means[u], ...means[v],
      ...reciprocity[u], ...reciprocity[v], ...[4, 5, 6, 7].map(step => walks[step][u][v]),
      ...[1, 2, 3].map(step => walks[step][v][u]), overlap(incoming), overlap(outgoing)].map(convert);
    assert.equal(values.length, 31);
    return { source: pair.source, target: pair.target, baseline: pair.values, quadratic: quadraticCoordinates(pair.values),
      expanded: values.map(row => row.numeric), exact: values.map(row => row.exact) };
  });
  return deepFreeze({ profileId: PROFILE.id, pairs });
}
