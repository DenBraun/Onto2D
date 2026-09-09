import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { digest, normalizeGraph, preflightProviders } from "../../datasets/scopes.mjs";
import { averageRanks } from "../../protocol/metrics.mjs";

export const PROFILE = deepFreeze(JSON.parse(readFileSync(new URL("profile.json", import.meta.url))));
export const values = rows => rows.map(({ x, ...row }) => row);
export function degrees(parent) {
  const graph = normalizeGraph(parent);
  return graph.nodes.map(id => {
    const incoming = graph.edges.filter(e => e.target === id).map(e => e.source), outgoing = graph.edges.filter(e => e.source === id).map(e => e.target);
    const weak = new Set([...incoming, ...outgoing]).size;
    return { id, incoming: incoming.length, outgoing: outgoing.length, weak, lowDegree: weak <= 5,
      bin: PROFILE.degreeBins.find(b => weak >= b.min && weak <= b.max).id };
  });
}
export function selectScope(parent, root, variant) {
  const graph = normalizeGraph(parent);
  assert.ok(PROFILE.variants.includes(variant)); assert.ok(graph.nodes.includes(root));
  assert.ok(graph.nodes.length <= PROFILE.limits.anatomicalNodes);
  const members = new Set([root]); let frontier = [root];
  for (let hop = 0; hop < (variant === "weak-two" ? 2 : 1); hop++) {
    const added = new Set();
    for (const node of frontier) for (const e of graph.edges) {
      if (variant !== "incoming-one" && e.source === node && !members.has(e.target)) added.add(e.target);
      if (variant !== "outgoing-one" && e.target === node && !members.has(e.source)) added.add(e.source);
    }
    frontier = [...added]; frontier.forEach(node => members.add(node));
  }
  const edgeIndexes = [], omittedEdgeIndexes = [], boundaryEdgeIndexes = [];
  graph.edges.forEach((e, i) => {
    const a = members.has(e.source), b = members.has(e.target);
    if (a && b) edgeIndexes.push(i); else { omittedEdgeIndexes.push(i); if (a !== b) boundaryEdgeIndexes.push(i); }
  });
  const selected = { nodes: [...members].sort(), edges: edgeIndexes.map(i => graph.edges[i]) };
  return { root, variant, nodeIds: selected.nodes, excludedNodeIds: graph.nodes.filter(n => !members.has(n)), edgeIndexes, omittedEdgeIndexes, boundaryEdgeIndexes,
    graphSha256: digest(selected) };
}
export function graphOf(parent, selection) {
  // Selection indices address the normalized parent, regardless of the input's
  // insertion order. Reconstruct against that same order before using geometry.
  const graph = normalizeGraph(parent);
  return { nodes: selection.nodeIds, edges: selection.edgeIndexes.map(i => graph.edges[i]) };
}
export function census(parent, id) {
  const graph = normalizeGraph(parent), selections = [];
  assert.ok(graph.nodes.length * PROFILE.variants.length <= PROFILE.limits.scopeCount);
  assert.ok(graph.nodes.length * PROFILE.variants.length * (graph.nodes.length + 2 * graph.edges.length) <= PROFILE.limits.ledgerReferences,
    "Complete scope ledger exceeds its bound; never keep a partial census.");
  for (const variant of PROFILE.variants) for (const root of graph.nodes) {
    const selection = selectScope(graph, root, variant), scoped = graphOf(graph, selection);
    const providers = preflightProviders({ policyId: PROFILE.id, parentGraphHash: digest(graph), graphHash: selection.graphSha256, graph: scoped }, [], id);
    selections.push({ ...selection, providers });
  }
  return { id, parent: graph, parentSha256: digest(graph), degrees: degrees(graph), selections };
}
export function matchPopulation(rows, selections) {
  assert.ok(rows.length <= PROFILE.limits.targetRows && new Set(rows.map(r => r.id)).size === rows.length);
  const lookup = new Map(selections.map(s => [s.root, s])); assert.equal(lookup.size, selections.length);
  const pairs = rows.map(row => {
    const scope = lookup.get(row.source); assert.ok(scope);
    const reason = scope.providers.commonGeometry.state !== "prepared" ? "root-scope-ineligible" : !scope.nodeIds.includes(row.target) ? "receiver-outside-scope" : null;
    return { id: row.id, source: row.source, target: row.target, retained: reason === null, reason };
  });
  const groups = [...new Set(rows.map(r => r.groupId))].sort().map(id => {
    const retained = rows.filter(r => r.groupId === id && pairs.find(p => p.id === r.id).retained);
    const distinctMagnitudeCount = new Set(retained.map(r => r.magnitude)).size;
    const reason = retained.length < 3 ? "fewer-than-three-common-receivers" : distinctMagnitudeCount < 2 ? "fewer-than-two-distinct-magnitudes" : null;
    return { id, retainedCount: retained.length, distinctMagnitudeCount, eligible: reason === null, reason };
  });
  const matched = groups.filter(g => g.eligible).flatMap(group => {
    const chosen = rows.filter(r => r.groupId === group.id && pairs.find(p => p.id === r.id).retained), ranks = averageRanks(chosen.map(r => r.magnitude));
    return values(chosen).map((row, i) => ({ ...row, rank: ranks[i], y: (ranks[i] - 1) / (chosen.length - 1) }));
  });
  const available = groups.filter(g => g.eligible).length >= 5;
  return { pairs, groups, rows: matched, status: available ? "complete" : "unavailable", reason: available ? null : "fewer-than-five-common-source-groups" };
}

export function nodeCoverage(unit, metadata, population) {
  return unit.degrees.map(node => {
    const mappedRecordings = metadata.labels.filter(r => r.columns.some(c => c.state === "exact-label-candidate" && c.anatomyNodeId === node.id)).map(r => r.recordingId);
    const events = metadata.events.filter(e => e.source === node.id && e.sourceMappingState === "exact-label-candidate");
    const pairs = population.rows.filter(r => r.pairEligible), eligible = population.rows.filter(r => r.eligible);
    return { ...node, mappedRecordings, exactStimulusEvents: events.length, uncontaminatedEvents: events.filter(e => e.window.eligible).length,
      responsePairsAsSource: pairs.filter(r => r.source === node.id).length, responsePairsAsReceiver: pairs.filter(r => r.target === node.id).length,
      eligiblePairsAsSource: eligible.filter(r => r.source === node.id).length, eligiblePairsAsReceiver: eligible.filter(r => r.target === node.id).length,
      scopes: PROFILE.variants.map(variant => {
        const scopes = unit.selections.filter(s => s.variant === variant), own = scopes.find(s => s.root === node.id);
        return { variant, rootPrepared: own.providers.commonGeometry.state === "prepared",
          preparedScopesContainingNode: scopes.filter(s => s.providers.commonGeometry.state === "prepared" && s.nodeIds.includes(node.id)).length };
      }) };
  });
}
export function binCoverage(nodes) {
  return PROFILE.degreeBins.map(bin => {
    const rows = nodes.filter(n => n.bin === bin.id);
    return { bin: bin.id, parentNodes: rows.length, mappedNodes: rows.filter(n => n.mappedRecordings.length).length,
      stimulatedNodes: rows.filter(n => n.exactStimulusEvents).length, uncontaminatedStimulatedNodes: rows.filter(n => n.uncontaminatedEvents).length,
      responseSources: rows.filter(n => n.responsePairsAsSource).length, responseReceivers: rows.filter(n => n.responsePairsAsReceiver).length,
      eligibleSources: rows.filter(n => n.eligiblePairsAsSource).length, eligibleReceivers: rows.filter(n => n.eligiblePairsAsReceiver).length,
      eligiblePairsBySource: rows.reduce((sum, n) => sum + n.eligiblePairsAsSource, 0), eligiblePairsByReceiver: rows.reduce((sum, n) => sum + n.eligiblePairsAsReceiver, 0),
      variants: PROFILE.variants.map(variant => ({ variant, preparedRoots: rows.filter(n => n.scopes.find(s => s.variant === variant).rootPrepared).length,
        representedNodes: rows.filter(n => n.scopes.find(s => s.variant === variant).preparedScopesContainingNode > 0).length })) };
  });
}
