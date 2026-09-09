import assert from "node:assert/strict";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { createOllivierAnalyzer } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { enumerateScopes, scopePack, preflightProviders } from "../datasets/scopes.mjs";
import { collectPairGeometry, FLOW_INPUT } from "../dream4/geometry.mjs";

export function prepareAnatomy(native, applicability, sourceFiles, id = "Dataset7") {
  const matches = native.witvliet.units.filter(unit => unit.id === id), cached = applicability.witvliet.filter(unit => unit.id === id);
  assert.equal(matches.length, 1); assert.equal(cached.length, 1);
  const selections = enumerateScopes(matches[0].projection, { neighborhoods: true }), parent = selections[0].graph;
  assert.deepEqual(parent, cached[0].parent);
  assert.equal(cached[0].scopes.length, selections.length);
  const positions = new Map(parent.edges.map((edge, i) => [JSON.stringify(edge), i]));
  const indices = edges => edges.map(edge => positions.get(JSON.stringify(edge)));
  for (const [i, scope] of selections.entries()) {
    const expected = cached[0].scopes[i], providers = preflightProviders(scope, sourceFiles, id);
    assert.deepEqual(expected, { policyId: scope.policyId, parentGraphHash: scope.parentGraphHash, graphHash: scope.graphHash,
      kind: scope.kind, root: scope.root, nodeIds: scope.graph.nodes, excludedNodeIds: scope.excludedNodes,
      edgeIndexes: indices(scope.graph.edges), omittedEdgeIndexes: indices(scope.omittedEdges),
      boundaryEdgeIndexes: indices(scope.boundaryEdges), providers });
  }
  const roots = selections.slice(1);
  const scopes = roots.map((scope, i) => {
    const providers = cached[0].scopes[i + 1].providers, eligible = providers.commonGeometry.state === "prepared";
    return { anatomyId: id, source: scope.root, nodeIds: scope.graph.nodes, eligible,
      reason: eligible ? null : ["ollivier", "flow"].filter(name => providers[name].state !== "prepared")
        .map(name => `${name}:${providers[name].reason}`).join(";") };
  });
  return { id, parent, roots, scopes };
}

export async function computeGeometry(anatomy, sourceFiles, onComplete = () => {}) {
  const results = [];
  for (const scope of anatomy.roots.filter((_, i) => anatomy.scopes[i].eligible)) {
    const started = performance.now(), { pack, mapping } = scopePack(scope, sourceFiles, anatomy.id);
    try {
      const artifacts = { forman: analyzeStructuralGeometry(pack),
        ollivier: await createOllivierAnalyzer(createPythonOllivierAdapter()).analyze(pack, {
          edgeIds: pack.files["model/edges.json"].map(edge => edge.id), idleness: "half" }),
        flow: await createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()).analyze(pack, FLOW_INPUT) };
      const geometry = collectPairGeometry({ graph: scope.graph, pack, mapping, artifacts });
      results.push({ source: scope.root, status: "complete", reason: null, scope, pack, mapping, artifacts, geometry });
    } catch (error) {
      // Integrity/programming failures abort; known complete-scope work bounds
      // remain an explicit unavailable computation, never a partial descriptor.
      if (!error.code?.endsWith("LIMIT_EXCEEDED")) throw error;
      results.push({ source: scope.root, status: "unavailable", reason: error.code, scope });
    }
    onComplete(results.at(-1), { elapsedMs: performance.now() - started, sampledRssBytes: process.memoryUsage().rss });
  }
  return results;
}
