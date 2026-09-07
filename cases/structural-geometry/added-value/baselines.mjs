// Exact, bounded study baselines. Callers supply verified, full-source graphs.
export const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function graphFromPack(pack) {
  const nodes = pack.files["model/nodes.json"].map(n => n.id).sort();
  const index = new Map(nodes.map((id, i) => [id, i]));
  return { n: nodes.length, edges: pack.files["model/edges.json"].map(e => [index.get(e.source), index.get(e.target)]) };
}
export function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((v, i) => permutations(items.filter((_, j) => i !== j)).map(rest => [v, ...rest]));
}
const cachedPermutations = new Map();
export function canonicalGraph({ n, edges }) {
  if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error("Study canonical baseline requires 1–6 vertices.");
  if (!cachedPermutations.has(n)) cachedPermutations.set(n, permutations(Array.from({ length: n }, (_, i) => i)));
  const arcs = new Set(edges.map(([u, v]) => `${u},${v}`));
  let code = null;
  for (const p of cachedPermutations.get(n)) {
    let row = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) row += arcs.has(`${p[i]},${p[j]}`) ? "1" : "0";
    if (code === null || row < code) code = row;
  }
  return { nodeCount: n, code };
}
function histogram(values) {
  const counts = new Map();
  for (const value of values) { const key = JSON.stringify(value); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts].sort(([a], [b]) => order(a, b)).map(([key, count]) => ({ value: JSON.parse(key), count }));
}
export function degrees({ n, edges }) {
  const incoming = Array(n).fill(0), outgoing = Array(n).fill(0);
  for (const [u, v] of edges) { outgoing[u]++; incoming[v]++; }
  return histogram(incoming.map((x, i) => [x, outgoing[i]]));
}
function reach({ n, edges }, undirected = false) {
  const neighbors = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) { neighbors[u].push(v); if (undirected) neighbors[v].push(u); }
  return neighbors.map((_, start) => {
    const seen = new Set([start]), queue = [start];
    for (let i = 0; i < queue.length; i++) for (const next of neighbors[queue[i]]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    return seen;
  });
}
export function topology(graph) {
  const direct = reach(graph), weak = reach(graph, true);
  const groups = rows => {
    const used = new Set(), sizes = [];
    for (let i = 0; i < graph.n; i++) if (!used.has(i)) {
      const group = [...rows[i]].filter(j => rows[j].has(i)); group.forEach(j => used.add(j)); sizes.push(group.length);
    }
    return sizes.sort((a, b) => a - b);
  };
  const strong = groups(direct);
  return { nodeCount: graph.n, edgeCount: graph.edges.length, weakComponentSizes: groups(weak), strongComponentSizes: strong,
    reachableOrderedPairCount: direct.reduce((sum, row) => sum + row.size - 1, 0), cyclicNodeCount: strong.filter(n => n > 1).reduce((a, b) => a + b, 0),
    isolatedNodeCount: Array.from({ length: graph.n }, (_, i) => i).filter(i => !graph.edges.some(([u, v]) => u === i || v === i)).length };
}
export function baselines(graph) {
  const motifs = [];
  for (let a = 0; a < graph.n; a++) for (let b = a + 1; b < graph.n; b++) for (let c = b + 1; c < graph.n; c++) {
    const nodes = [a, b, c];
    motifs.push(canonicalGraph({ n: 3, edges: graph.edges.filter(([u, v]) => nodes.includes(u) && nodes.includes(v)).map(([u, v]) => [nodes.indexOf(u), nodes.indexOf(v)]) }).code);
  }
  const matrix = Array.from({ length: graph.n }, () => Array(graph.n).fill(0));
  for (const [u, v] of graph.edges) matrix[u][v] = 1;
  let power = Array.from({ length: graph.n }, (_, i) => Array.from({ length: graph.n }, (_, j) => Number(i === j)));
  const spectrum = [];
  for (let k = 1; k <= 6; k++) {
    power = power.map(row => row.map((_, j) => row.reduce((s, v, i) => s + v * matrix[i][j], 0)));
    spectrum.push(power.reduce((s, row, i) => s + row[i], 0));
  }
  return { counts: [graph.n, graph.edges.length], degrees: degrees(graph), topology: topology(graph), motifs: histogram(motifs),
    spectrum, canonical: canonicalGraph(graph) };
}
export function colorRefinement(graphs) {
  let colors = graphs.map(g => Array(g.n).fill(0));
  const values = colors.map(c => [histogram(c)]);
  for (let round = 0; round < 6; round++) {
    const tuples = graphs.map((g, k) => colors[k].map((color, i) => JSON.stringify([color,
      g.edges.filter(([, v]) => v === i).map(([u]) => colors[k][u]).sort((a, b) => a - b),
      g.edges.filter(([u]) => u === i).map(([, v]) => colors[k][v]).sort((a, b) => a - b)])));
    const ranks = new Map([...new Set(tuples.flat())].sort().map((key, i) => [key, i]));
    colors = tuples.map(rows => rows.map(row => ranks.get(row)));
    colors.forEach((c, i) => values[i].push(histogram(c)));
  }
  return values;
}
