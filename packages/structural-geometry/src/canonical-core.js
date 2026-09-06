import { canonicalizeCandidate } from "@onto2d/kernel/graph-canonicalizer";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { getDistinguishabilityRegime } from "./regimes.js";

const regime = getDistinguishabilityRegime("canonical-structure-v1");
const { candidateTranslation: translation, graphPolicy: policy } = regime.matchingPolicy;
const limits = { maxNodes: regime.limits.maxNodes, maxEdges: regime.limits.maxEdges, maxSearchStates: regime.limits.maxSearchStates };
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function fail(code, message) { throw new EngineError(`STRUCTURAL_CANONICAL_${code}`, message); }

// Private graph adapter shared by source-bound observation and independent
// census checks. It does not authorize a graph as a verified Model Pack.
export function canonicalizeDirectedStructure(nodeIds, edges) {
  if (nodeIds.length < 1 || nodeIds.length > limits.maxNodes || edges.length > limits.maxEdges) {
    fail("LIMIT_EXCEEDED", "Canonical structure requires 1–6 nodes and at most 30 directed edges.");
  }
  const ids = [...nodeIds].sort(compare), orderedEdges = [...edges].sort((a, b) => compare(a.id, b.id));
  const index = new Map(ids.map((id, i) => [id, i]));
  const edgeIds = new Set(), pairs = new Set();
  if (index.size !== ids.length) fail("GRAPH_INVALID", "Canonical node IDs must be distinct.");
  const candidateEdges = orderedEdges.map((edge) => {
    const from = index.get(edge.source), to = index.get(edge.target), pair = `${from}:${to}`;
    if (from === undefined || to === undefined || from === to || edgeIds.has(edge.id) || pairs.has(pair)) {
      fail("GRAPH_INVALID", "Canonical edges require distinct IDs and loopless, nonparallel directed endpoints in scope.");
    }
    edgeIds.add(edge.id); pairs.add(pair);
    return { from, to, role: translation.edgeRole };
  });
  // The uniform reference and role preserve only directed adjacency. No source
  // label, dictionary, scientific status, weight or type enters the candidate.
  const result = canonicalizeCandidate({ domain: translation.domain,
    nodes: ids.map(() => ({ ref: translation.nodeRef })), edges: candidateEdges }, { policy, limits });
  return deepFreeze({
    value: { nodeCount: ids.length, edges: result.canonical.edges.map(({ from, to }) => ({ from, to })) },
    witness: {
      nodes: ids.map((sourceNodeId, i) => ({ sourceNodeId, canonicalNode: result.inputToCanonical[i] })),
      edges: orderedEdges.map((edge, i) => ({ sourceEdgeId: edge.id,
        from: result.inputToCanonical[candidateEdges[i].from], to: result.inputToCanonical[candidateEdges[i].to] })),
      candidateHash: result.candidateId, skeletonHash: result.skeletonId,
      statistics: { searchStates: result.statistics.searchStates, leaves: result.statistics.leaves, refinementRounds: result.statistics.refinementRounds }
    }
  });
}
