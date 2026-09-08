import { createHash } from "node:crypto";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { SOURCE_PARENT_DIRECTED_POLICY } from "@onto2d/structural-geometry";
import { prepareOllivierRequest } from "@onto2d/structural-geometry/ollivier";
import { prepareStructuralFlow } from "@onto2d/structural-geometry/flow";

// Case-local selection. It does not extend the public providers' graph bounds.
export const SCOPE_POLICY = deepFreeze({
  id: "biological-source-scopes-v1", version: "1",
  dream4: "every-full-size10-network",
  anatomy: "full-channel-parent-and-every-closed-one-hop-weak-neighborhood",
  membership: "topology-only-before-functional-label-mapping",
  edges: "induced-directed-simple-channel-edges", boundary: "record-all-omitted-edges",
  overflow: "reject-whole-scope-never-truncate", weights: "unit-analysis-lengths",
  bounds: { maxCensusReachabilityEntries: 1_048_576, maxCensusTraversalWork: 8_388_608, maxScopeReferences: 2_097_152 },
  numericalDiagnostic: { idleness: "half", maxIterations: 4 },
  evaluation: "applicability-only-no-predictive-score"
});

export function digest(value) {
  // JSON payload digest, not the kernel canonical identity codec.
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error("Expected a native graph.");
  const { maxNodes, maxEdges } = SOURCE_PARENT_DIRECTED_POLICY.limits;
  if (graph.nodes.length > maxNodes || graph.edges.length > maxEdges) throw new Error("Parent graph exceeds source scope limits.");
  for (const values of [graph.nodes, graph.edges]) {
    if (Object.getOwnPropertySymbols(values).length || Object.keys(values).length !== values.length ||
        Object.keys(values).some((key, index) => key !== String(index))) throw new Error("Expected dense native graph arrays without extra fields.");
  }
  const nodes = [...graph.nodes].sort();
  if (nodes.some(n => typeof n !== "string" || !n.length) || new Set(nodes).size !== nodes.length) throw new Error("Invalid or duplicate node identity.");
  const members = new Set(nodes), seen = new Set(), indices = new Map(nodes.map((node, index) => [node, index]));
  const edges = graph.edges.map(({ source, target }) => {
    const key = JSON.stringify([source, target]);
    if (!members.has(source) || !members.has(target) || source === target || seen.has(key)) throw new Error("Expected loopless simple channel edges with known endpoints.");
    seen.add(key); return { source, target };
  }).sort((a, b) => indices.get(a.source) - indices.get(b.source) || indices.get(a.target) - indices.get(b.target));
  return { nodes, edges };
}

export function graphCensus(graph) {
  const { nodes, edges } = normalizeGraph(graph);
  if (nodes.length ** 2 > SCOPE_POLICY.bounds.maxCensusReachabilityEntries ||
      nodes.length * (nodes.length + edges.length) > SCOPE_POLICY.bounds.maxCensusTraversalWork) {
    throw new Error("Complete parent census exceeds its reachability or traversal work bound.");
  }
  const out = new Map(nodes.map(n => [n, new Set()])), incoming = new Map(nodes.map(n => [n, new Set()]));
  for (const e of edges) { out.get(e.source).add(e.target); incoming.get(e.target).add(e.source); }
  const reach = new Map();
  function visit(start, neighbors) {
    const seen = new Set([start]), queue = [start];
    for (let i = 0; i < queue.length; i += 1) for (const n of neighbors(queue[i])) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    return seen;
  }
  for (const n of nodes) reach.set(n, visit(n, x => out.get(x)));
  const weak = [], strong = [], weakSeen = new Set(), strongSeen = new Set();
  for (const n of nodes) {
    if (!weakSeen.has(n)) { const group = visit(n, x => [...out.get(x), ...incoming.get(x)]); group.forEach(x => weakSeen.add(x)); weak.push(group.size); }
    if (!strongSeen.has(n)) { const group = nodes.filter(x => reach.get(n).has(x) && reach.get(x).has(n)); group.forEach(x => strongSeen.add(x)); strong.push(group.length); }
  }
  return { nodeCount: nodes.length, edgeCount: edges.length,
    isolatedNodeCount: nodes.filter(n => !out.get(n).size && !incoming.get(n).size).length,
    reciprocalArcCount: edges.filter(e => out.get(e.target).has(e.source)).length,
    feedbackArcCount: edges.filter(e => reach.get(e.target).has(e.source)).length,
    reachableOrderedPairCount: [...reach.values()].reduce((sum, set) => sum + set.size - 1, 0),
    weakComponentSizes: weak.sort((a, b) => a - b), strongComponentSizes: strong.sort((a, b) => a - b) };
}

export function enumerateScopes(parent, { neighborhoods = false } = {}) {
  const graph = normalizeGraph(parent), parentGraphHash = digest(graph);
  // Every scope retains selected/excluded nodes and selected/omitted/boundary
  // edges. Bound the complete ledger before allocating any neighborhood arrays.
  const scopeCount = neighborhoods ? graph.nodes.length + 1 : 1;
  if (scopeCount * (graph.nodes.length + 2 * graph.edges.length) > SCOPE_POLICY.bounds.maxScopeReferences) {
    throw new Error("Complete source scope ledger exceeds its reference bound.");
  }
  const selections = [{ kind: "full", root: null, nodes: graph.nodes }];
  if (neighborhoods) for (const root of graph.nodes) {
    const nodes = new Set([root]);
    for (const e of graph.edges) {
      if (e.source === root) nodes.add(e.target);
      if (e.target === root) nodes.add(e.source);
    }
    selections.push({ kind: "closed-weak-one-hop", root, nodes: [...nodes].sort() });
  }
  return selections.map(selection => {
    const members = new Set(selection.nodes), edges = [], omitted = [], boundary = [];
    for (const e of graph.edges) {
      if (members.has(e.source) && members.has(e.target)) edges.push(e);
      else { omitted.push(e); if (members.has(e.source) !== members.has(e.target)) boundary.push(e); }
    }
    const selected = { nodes: selection.nodes, edges };
    return { policyId: SCOPE_POLICY.id, parentGraphHash, kind: selection.kind, root: selection.root,
      graph: selected, graphHash: digest(selected),
      excludedNodes: graph.nodes.filter(n => !members.has(n)), omittedEdges: omitted, boundaryEdges: boundary };
  });
}

export function scopePack(scope, sourceFiles, unitId) {
  const mapping = scope.graph.nodes.map((sourceId, index) => ({ sourceId, nodeId: `n${String(index).padStart(4, "0")}` }));
  const ids = new Map(mapping.map(n => [n.sourceId, n.nodeId]));
  const binding = { policyId: scope.policyId, parentGraphHash: scope.parentGraphHash, graphHash: scope.graphHash, unitId };
  const pack = buildModelPack({ model: { id: `biological-${digest(binding).slice(0, 24)}`, version: "1", name: "Biological source scope", status: "not-evaluated" },
    source: { id: "biological-source-scope-v1", files: sourceFiles, auditHash: `sha256:${digest(binding)}` },
    nodes: mapping.map(n => ({ id: n.nodeId })),
    edges: scope.graph.edges.map((e, i) => ({ id: `e${String(i).padStart(5, "0")}`, source: ids.get(e.source), target: ids.get(e.target), relationLayer: "source-parent" })), dictionaries: {} });
  return { pack, mapping };
}

export function preflightProviders(scope, sourceFiles, unitId) {
  const n = scope.graph.nodes.length, m = scope.graph.edges.length;
  const state = (ready, reason) => ({ state: ready ? "size-eligible" : "ineligible", reason: ready ? null : reason });
  const result = { forman: state(n > 0, "empty-graph"),
    canonical: state(n > 0 && n <= 6 && m <= 30, "canonical-size-bound"),
    typed: { state: "ineligible", reason: "native-channels-do-not-supply-the-five-required-typed-fields" },
    topology: state(n > 0 && n <= 64 && m <= 256, "topology-size-bound") };
  // Cheap gates avoid compiling oversized fragments. The public preparers then
  // check support, mass and transport work on the SAME compiled graph.
  let compiled;
  const obtain = () => (compiled ??= scopePack(scope, sourceFiles, unitId));
  function prepare(name, eligible, fn) {
    if (!eligible) return { state: "ineligible", reason: `${name}-size-or-empty-bound` };
    try {
      const request = fn(obtain().pack);
      return { state: "prepared", requestHash: request.requestHash, reason: null,
        ...(name === "ollivier" ? { transportCells: request.problems.reduce((sum, p) => sum + p.sourceMeasure.length * p.targetMeasure.length, 0) } : {}) };
    } catch (error) {
      if (!error.code?.endsWith("LIMIT_EXCEEDED")) throw error;
      return { state: "ineligible", reason: error.code };
    }
  }
  result.ollivier = prepare("ollivier", n > 0 && n <= 64 && m > 0 && m <= 32,
    pack => prepareOllivierRequest(pack, { edgeIds: pack.files["model/edges.json"].map(e => e.id), idleness: "half" }));
  result.flow = prepare("flow", n > 0 && n <= 64 && m > 0 && m <= 64,
    pack => prepareStructuralFlow(pack, SCOPE_POLICY.numericalDiagnostic));
  result.commonGeometry = { state: result.ollivier.state === "prepared" && result.flow.state === "prepared" ? "prepared" : "ineligible",
    execution: "not-run", stoppingEvent: null };
  return result;
}
