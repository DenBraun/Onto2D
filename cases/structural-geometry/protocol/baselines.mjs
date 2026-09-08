// Case-local structural features. Inputs contain no outcomes, intervention
// magnitudes, geometry descriptors, fitted parameters or inferred edge weights.

const freeze = value => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const BASELINE_FEATURE_NAMES = freeze([
  "node_count", "edge_count", "directed_density",
  "source_in_degree", "source_out_degree", "target_in_degree", "target_out_degree",
  "direct_edge", "reverse_edge", "global_reciprocity",
  "same_weak_component", "same_strong_component", "reachable",
  "directed_distance", "unreachable", "common_predecessors", "common_successors",
  "two_step_path_count", "feed_forward_shortcut_count", "directed_triangle_closure_count",
  "propagation_step_2", "propagation_step_3", "propagation_step_4"
]);

export const GRAPH_BASELINE_PROFILE = freeze({
  id: "biological-graph-baselines-v1", version: "1",
  featureNames: BASELINE_FEATURE_NAMES,
  input: "one explicit directed loopless simple graph; node IDs are opaque",
  population: "every ordered pair of distinct supplied nodes; isolates retained",
  limits: { maxNodes: 64, maxEdges: 256, maxOrderedPairs: 4032,
    maxFeatureValues: 92736, maxWorkUnits: 1200000 },
  overflow: "reject-whole-input-before-pair-or-matrix-allocation; no truncation",
  workBound: "4*n*n*(n-1) + n*(n+2*m) + 4*n*(n+m)",
  density: "m/(n*(n-1)); 0 when n=1",
  reciprocity: "number of arcs whose reverse exists divided by m; 0 when m=0",
  distance: "minimum directed hop count; 0 sentinel only when unreachable=1",
  commonPredecessors: "number of u with u->source and u->target",
  commonSuccessors: "number of u with source->u and target->u",
  twoStepPaths: "(A^2)[source,target]; source and target distinct and loops forbidden",
  feedForwardShortcut: "A[source,target]*(A^2)[source,target]; non-induced role count",
  directedTriangleClosure: "A[source,target]*(A^2)[target,source]; non-induced role count",
  motifs: "additional and reciprocal arcs are allowed; no induced-motif census is implied",
  propagation: {
    matrix: "P[u,v]=A[u,v]/out_degree(u) for nonsinks; sink rows are zero",
    coordinates: "(P^k)[source,target] for exact walk lengths k=2,3,4; revisits allowed",
    sinks: "walk mass terminates; no absorbing self-loop or renormalization is added",
    arithmetic: "exact BigInt coefficients using the LCM of positive outdegrees; Number(numerator)/Number(denominator) at output",
    standaloneScoreDefinition: "sum(2^(-k)*(P^k)[source,target], k=1..4); P1=direct_edge/source_out_degree, or 0 for a sink"
  },
  scope: "all features use the same supplied graph; no parent or target lookup",
  fitting: "none; graph-size constants remain explicit even when constant within a rank task"
});

function fail(code, message) {
  const error = new Error(message);
  error.code = `BIOLOGICAL_BASELINE_${code}`;
  throw error;
}

function fields(value, expected) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    !Object.getOwnPropertySymbols(value).length &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}

function dense(value) {
  return !Object.getOwnPropertySymbols(value).length && Object.keys(value).length === value.length &&
    Object.keys(value).every((key, index) => key === String(index));
}

function readGraph(graph) {
  if (!fields(graph, ["nodes", "edges"]) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    fail("INPUT_INVALID", "Expected only explicit nodes and directed source/target edges.");
  }
  const n = graph.nodes.length, m = graph.edges.length, limits = GRAPH_BASELINE_PROFILE.limits;
  if (n === 0) fail("INPUT_INVALID", "A graph must contain at least one supplied node.");
  const pairs = n * (n - 1), work = 4 * n * pairs + n * (n + 2 * m) + 4 * n * (n + m);
  if (n > limits.maxNodes || m > limits.maxEdges || pairs > limits.maxOrderedPairs ||
      pairs * BASELINE_FEATURE_NAMES.length > limits.maxFeatureValues || work > limits.maxWorkUnits) {
    fail("LIMIT_EXCEEDED", "Graph baseline pair/feature/work bounds exceeded; supply a declared complete scope.");
  }
  if (!dense(graph.nodes) || !dense(graph.edges)) fail("INPUT_INVALID", "Graph node/edge arrays must be dense and contain no undeclared fields.");
  if ([...graph.nodes].some(node => typeof node !== "string" || node.length === 0)) {
    fail("INPUT_INVALID", "Every node must have a nonempty string identity.");
  }
  const nodes = [...graph.nodes].sort(), index = new Map(nodes.map((node, i) => [node, i]));
  if (index.size !== n) fail("INPUT_INVALID", "Duplicate node identity.");
  const seen = new Set(), edges = [];
  for (const edge of graph.edges) {
    if (!fields(edge, ["source", "target"]) || !index.has(edge.source) || !index.has(edge.target)) {
      fail("INPUT_INVALID", "Every edge needs only source and target identities from the supplied graph.");
    }
    const source = index.get(edge.source), target = index.get(edge.target), key = source * n + target;
    if (source === target || seen.has(key)) fail("INPUT_INVALID", "Self-loops and duplicate directed edges are unsupported.");
    seen.add(key); edges.push([source, target]);
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { nodes, edges };
}

function gcd(a, b) {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function walkProbabilities(outgoing) {
  const n = outgoing.length;
  // One graph-wide denominator makes every intermediate sum an integer. Node
  // relabeling therefore cannot alter the result through floating summation order.
  let scale = 1n;
  for (const neighbors of outgoing) if (neighbors.length) {
    const degree = BigInt(neighbors.length);
    scale = (scale / gcd(scale, degree)) * degree;
  }
  const multipliers = outgoing.map(neighbors => neighbors.length ? scale / BigInt(neighbors.length) : 0n);
  const matrices = Array.from({ length: 3 }, () => Array.from({ length: n }, () => Array(n).fill(0)));
  for (let source = 0; source < n; source += 1) {
    let numerators = Array(n).fill(0n), denominator = 1n;
    numerators[source] = 1n;
    for (let step = 1; step <= 4; step += 1) {
      const next = Array(n).fill(0n);
      for (let node = 0; node < n; node += 1) {
        if (numerators[node] === 0n) continue;
        const share = numerators[node] * multipliers[node];
        for (const target of outgoing[node]) next[target] += share;
      }
      numerators = next; denominator *= scale;
      if (step >= 2) matrices[step - 2][source] = numerators.map(numerator => Number(numerator) / Number(denominator));
    }
  }
  return matrices;
}

/** Extract all 23 fixed graph-only coordinates for every ordered off-diagonal pair. */
export function graphBaselineFeatures(input) {
  const { nodes, edges } = readGraph(input), n = nodes.length, m = edges.length;
  const outgoing = Array.from({ length: n }, () => []), incoming = Array.from({ length: n }, () => []);
  const adjacency = Array.from({ length: n }, () => new Uint8Array(n));
  for (const [source, target] of edges) {
    outgoing[source].push(target); incoming[target].push(source); adjacency[source][target] = 1;
  }
  const distances = Array.from({ length: n }, (_, source) => {
    const distance = Array(n).fill(-1), queue = [source];
    distance[source] = 0;
    for (let i = 0; i < queue.length; i += 1) for (const target of outgoing[queue[i]]) {
      if (distance[target] >= 0) continue;
      distance[target] = distance[queue[i]] + 1; queue.push(target);
    }
    return distance;
  });
  const weakComponents = Array(n).fill(-1);
  for (let source = 0; source < n; source += 1) {
    if (weakComponents[source] >= 0) continue;
    const queue = [source]; weakComponents[source] = source;
    for (let i = 0; i < queue.length; i += 1) for (const next of [...outgoing[queue[i]], ...incoming[queue[i]]]) {
      if (weakComponents[next] >= 0) continue;
      weakComponents[next] = source; queue.push(next);
    }
  }
  const twoSteps = Array.from({ length: n }, () => new Uint8Array(n));
  for (let source = 0; source < n; source += 1) for (const middle of outgoing[source]) {
    for (const target of outgoing[middle]) twoSteps[source][target] += 1;
  }
  const propagation = walkProbabilities(outgoing), pairs = [];
  const density = n > 1 ? m / (n * (n - 1)) : 0;
  const reciprocity = m ? edges.filter(([source, target]) => adjacency[target][source]).length / m : 0;
  for (let source = 0; source < n; source += 1) for (let target = 0; target < n; target += 1) {
    if (source === target) continue;
    const reachable = distances[source][target] >= 0, direct = adjacency[source][target];
    const values = [n, m, density, incoming[source].length, outgoing[source].length,
      incoming[target].length, outgoing[target].length, direct, adjacency[target][source], reciprocity,
      Number(weakComponents[source] === weakComponents[target]), Number(reachable && distances[target][source] >= 0),
      Number(reachable), reachable ? distances[source][target] : 0, Number(!reachable),
      incoming[source].filter(node => adjacency[node][target]).length,
      outgoing[source].filter(node => adjacency[target][node]).length,
      twoSteps[source][target], direct * twoSteps[source][target], direct * twoSteps[target][source],
      ...propagation.map(matrix => matrix[source][target])];
    if (values.length !== BASELINE_FEATURE_NAMES.length || values.some(value => !Number.isFinite(value))) {
      fail("INTERNAL_ERROR", "A baseline coordinate is outside the finite fixed feature contract.");
    }
    pairs.push({ source: nodes[source], target: nodes[target], values });
  }
  return freeze({ profileId: GRAPH_BASELINE_PROFILE.id, featureNames: BASELINE_FEATURE_NAMES, pairs });
}
