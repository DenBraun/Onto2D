import { deepFreeze } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { getDistinguishabilityRegime } from "./regimes.js";

function fail(message) { throw new EngineError("STRUCTURAL_TOPOLOGY_GRAPH_INVALID", message); }

// Private bounded evaluator. Public callers must first verify the complete
// source and prepare its induced scope. No graph matching or source attributes
// enter these seven observations.
export function measureDirectedTopology(nodeIds, edges) {
  const limits = getDistinguishabilityRegime("topology-only-v1").limits;
  if (!Array.isArray(nodeIds) || !Array.isArray(edges) || nodeIds.length < limits.minNodes ||
      nodeIds.length > limits.maxNodes || edges.length > limits.maxEdges) fail("Topology exceeds its fixed graph bounds.");
  if (nodeIds.some((id) => typeof id !== "string" || !id.length) || new Set(nodeIds).size !== nodeIds.length) fail("Node IDs must be distinct nonempty strings.");
  const nodes = [...nodeIds].sort(), outgoing = new Map(nodes.map((id) => [id, new Set()]));
  const incoming = new Map(nodes.map((id) => [id, new Set()])), edgeIds = new Set();
  for (const e of edges) {
    if (!e || typeof e.id !== "string" || !e.id.length || edgeIds.has(e.id) || !outgoing.has(e.source) ||
        !incoming.has(e.target) || e.source === e.target || outgoing.get(e.source).has(e.target)) fail("Expected distinct loopless directed edges with scoped endpoints.");
    outgoing.get(e.source).add(e.target); incoming.get(e.target).add(e.source); edgeIds.add(e.id);
  }

  const reachability = new Map(), reachablePairsBySource = [];
  let reachabilityPairVisits = 0, reachabilityEdgeScans = 0;
  for (const source of nodes) {
    const seen = new Set(), queue = [];
    const visit = (id) => {
      reachabilityPairVisits += 1;
      if (reachabilityPairVisits > limits.maxReachabilityPairVisits) {
        throw new EngineError("STRUCTURAL_TOPOLOGY_LIMIT_EXCEEDED", "Directed reachability exhausted its pair-visit budget.");
      }
      seen.add(id); queue.push(id);
    };
    // The work count includes each self seed. The observable excludes all
    // (u,u) pairs, even when a nonempty directed cycle returns to u.
    visit(source);
    for (let i = 0; i < queue.length; i += 1) {
      for (const target of outgoing.get(queue[i])) {
        reachabilityEdgeScans += 1;
        if (!seen.has(target)) visit(target);
      }
    }
    reachability.set(source, seen);
    reachablePairsBySource.push({ sourceNodeId: source, count: seen.size - 1 });
  }

  const strongComponents = [], assigned = new Set();
  for (const source of nodes) {
    if (assigned.has(source)) continue;
    const group = nodes.filter((target) => reachability.get(source).has(target) && reachability.get(target).has(source));
    group.forEach((id) => assigned.add(id)); strongComponents.push(group);
  }
  const weakComponents = [], weakSeen = new Set();
  for (const source of nodes) {
    if (weakSeen.has(source)) continue;
    const group = [source]; weakSeen.add(source);
    for (let i = 0; i < group.length; i += 1) {
      for (const neighbours of [outgoing.get(group[i]), incoming.get(group[i])]) {
        for (const target of neighbours) if (!weakSeen.has(target)) { weakSeen.add(target); group.push(target); }
      }
    }
    weakComponents.push(group.sort());
  }
  const sizes = (groups) => groups.map((group) => group.length).sort((a, b) => a - b);
  const value = { nodeCount: nodes.length, edgeCount: edges.length,
    weakComponentSizes: sizes(weakComponents), strongComponentSizes: sizes(strongComponents),
    reachableOrderedPairCount: reachablePairsBySource.reduce((sum, row) => sum + row.count, 0),
    cyclicNodeCount: strongComponents.reduce((sum, group) => sum + (group.length > 1 ? group.length : 0), 0),
    isolatedNodeCount: nodes.filter((id) => outgoing.get(id).size === 0 && incoming.get(id).size === 0).length };
  return deepFreeze({ value, diagnostics: { weakComponents, strongComponents, reachablePairsBySource,
    work: { reachabilityPairVisits, reachabilityEdgeScans } } });
}
