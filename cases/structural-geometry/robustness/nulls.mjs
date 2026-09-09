import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { digest, normalizeGraph } from "../datasets/scopes.mjs";

export const NULL_PROFILE = deepFreeze({ id: "onto2d-biological-rank-null-v1", indices: 32,
  maxProposals: 4096, swapsPerEdge: 10, maxNodes: 64, maxEdges: 64,
  datasetId: "native unit ID (insilico_size10_1..5 or Dataset7)",
  root: "original D2 scope root, null for a full DREAM4 network",
  population: "fixed D4/D5 eligible target rows and original scope memberships; no rescoping after swaps",
  replicate: "same null index across all units; evaluate only when every target-bearing scope is complete",
  context: "all 29 prepared anatomical scopes retained and every successfully sampled scope measured, including roots without eligible targets",
  duplicates: "retained with multiplicity, including a final graph equal to the original",
  interpretation: "bounded deterministic degree/component-preserving null; not uniform, no calibrated p-value" });

const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const edgeOrder = (a, b) => order(a.source, b.source) || order(a.target, b.target);
const edgeKey = edge => JSON.stringify([edge.source, edge.target]);
const identity = value => typeof value === "string" && value.length > 0 && value.length <= 256 && value.isWellFormed();

export function labelledConstraints(graph) {
  const adjacency = new Map(graph.nodes.map(node => [node, new Set()]));
  const degree = new Map(graph.nodes.map(node => [node, { node, incoming: 0, outgoing: 0 }]));
  for (const edge of graph.edges) {
    adjacency.get(edge.source).add(edge.target); adjacency.get(edge.target).add(edge.source);
    degree.get(edge.source).outgoing++; degree.get(edge.target).incoming++;
  }
  const seen = new Set(), components = [];
  for (const node of graph.nodes) if (!seen.has(node)) {
    const stack = [node], members = []; seen.add(node);
    while (stack.length) {
      const current = stack.pop(); members.push(current);
      for (const next of adjacency.get(current)) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    components.push(members.sort());
  }
  return { degrees: [...degree.values()], components };
}

export function sampleNull(request) {
  assert.deepEqual(Object.keys(request).sort(), ["datasetId", "graph", "nullIndex", "originalGraphSha256", "root"]);
  assert.ok(identity(request.datasetId));
  assert.ok(request.root === null || identity(request.root));
  assert.ok(Number.isInteger(request.nullIndex) && request.nullIndex >= 0 && request.nullIndex < NULL_PROFILE.indices);
  assert.ok(request.graph.nodes.length <= NULL_PROFILE.maxNodes && request.graph.edges.length <= NULL_PROFILE.maxEdges,
    "Null sampling exceeds complete graph bounds.");
  const original = normalizeGraph(request.graph);
  assert.ok(original.nodes.length > 0 && original.nodes.every(identity));
  assert.ok(request.root === null || original.nodes.includes(request.root));
  assert.equal(digest(original), request.originalGraphSha256, "Null request must bind the original D2 graph.");
  const constraints = labelledConstraints(original), partition = JSON.stringify(constraints.components);
  let edges = original.edges, accepted = 0;
  const attempts = [], required = NULL_PROFILE.swapsPerEdge * edges.length;
  for (let counter = 0; edges.length && counter < NULL_PROFILE.maxProposals && accepted < required; counter++) {
    const bytes = createHash("sha256").update(JSON.stringify([NULL_PROFILE.id, request.datasetId, request.root,
      request.originalGraphSha256, request.nullIndex, counter]), "utf8").digest();
    const first = bytes.readUInt32BE(0) % edges.length, second = bytes.readUInt32BE(4) % edges.length;
    let outcome;
    if (first === second) outcome = "equal-indices";
    else {
      const a = edges[first], b = edges[second];
      const left = { source: a.source, target: b.target }, right = { source: b.source, target: a.target };
      if (a.source === b.source || a.target === b.target) outcome = "unchanged-edge-set";
      else if (left.source === left.target || right.source === right.target) outcome = "self-loop";
      else {
        const unchanged = edges.filter((_, i) => i !== first && i !== second), keys = new Set(unchanged.map(edgeKey));
        if (keys.has(edgeKey(left)) || keys.has(edgeKey(right))) outcome = "parallel-arc";
        else {
          const proposed = [...unchanged, left, right].sort(edgeOrder);
          if (JSON.stringify(labelledConstraints({ nodes: original.nodes, edges: proposed }).components) !== partition) outcome = "component-membership";
          else { edges = proposed; accepted++; outcome = "accepted"; }
        }
      }
    }
    attempts.push({ counter, first, second, outcome });
  }
  const graph = { nodes: original.nodes, edges }, complete = edges.length > 0 && accepted === required;
  assert.deepEqual(labelledConstraints(graph), constraints);
  const counts = Object.fromEntries([...new Set(attempts.map(row => row.outcome))].sort().map(outcome =>
    [outcome, attempts.filter(row => row.outcome === outcome).length]));
  return deepFreeze({ profileId: NULL_PROFILE.id, datasetId: request.datasetId, root: request.root,
    originalGraphSha256: request.originalGraphSha256, nullIndex: request.nullIndex,
    status: complete ? "complete" : "unavailable", reason: complete ? null : edges.length ? "swap-target-not-reached" : "empty-edge-set",
    graph, graphSha256: digest(graph), accepted, required, proposals: attempts.length, outcomes: counts,
    changed: digest(graph) !== request.originalGraphSha256, constraints, attempts });
}

export function verifyNull(artifact, request) {
  assert.deepEqual(artifact, sampleNull(request), "Null artifact differs from complete deterministic replay.");
  return artifact;
}
