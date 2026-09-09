import assert from "node:assert/strict";
import test from "node:test";
import { degrees, selectScope, graphOf, census, matchPopulation, nodeCoverage, binCoverage } from "./selection.mjs";
import { runVariant } from "./study.mjs";
import { python } from "./io.mjs";

const graph = { nodes: ["a", "b", "c", "d", "z"], edges: [{ source: "a", target: "b" }, { source: "b", target: "a" }, { source: "b", target: "c" }, { source: "c", target: "d" }] };
test("directional and two-hop scopes preserve all induced edges, isolated roots and explicit boundaries", () => {
  assert.deepEqual(selectScope(graph, "b", "incoming-one").nodeIds, ["a", "b"]);
  assert.deepEqual(selectScope(graph, "b", "outgoing-one").nodeIds, ["a", "b", "c"]);
  const weak = selectScope(graph, "b", "weak-one");
  assert.deepEqual(weak.edgeIndexes, [0, 1, 2]); assert.deepEqual(weak.boundaryEdgeIndexes, [3]);
  assert.deepEqual(selectScope(graph, "a", "weak-two").nodeIds, ["a", "b", "c"]);
  assert.deepEqual(selectScope(graph, "z", "weak-two").nodeIds, ["z"]);
  const reordered = { nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() };
  assert.deepEqual(selectScope(reordered, "b", "weak-one"), weak);
  assert.deepEqual(graphOf(reordered, weak), graphOf(graph, weak));
  assert.equal(degrees(graph).find(n => n.id === "b").weak, 2); assert.equal(degrees(graph).find(n => n.id === "b").incoming + degrees(graph).find(n => n.id === "b").outgoing, 3);
  assert.throws(() => selectScope(graph, "absent", "weak-one")); assert.throws(() => selectScope(graph, "a", "best-scoring"));
});
test("preparation cannot erase an isolated node or truncate an oversized scope", () => {
  const nodes = Array.from({ length: 70 }, (_, i) => `n${String(i).padStart(2, "0")}`);
  const parent = { nodes, edges: nodes.slice(1).map(target => ({ source: nodes[0], target })) };
  const unit = census(parent, "test"); const scope = unit.selections.find(s => s.root === nodes[0] && s.variant === "weak-one");
  assert.equal(scope.nodeIds.length, 70); assert.equal(scope.edgeIndexes.length, 69); assert.equal(scope.providers.commonGeometry.state, "ineligible");
  const isolated = census(graph, "isolated").selections.find(s => s.root === "z" && s.variant === "weak-one");
  assert.equal(isolated.providers.commonGeometry.state, "ineligible"); assert.deepEqual(graphOf(graph, isolated), { nodes: ["z"], edges: [] });
});

function fixture() {
  const rows = [], selections = [];
  for (let i = 0; i < 5; i++) {
    const source = `s${i}`, targets = ["a", "b", "c", "d"];
    selections.push({ root: source, nodeIds: [source, ...targets.slice(0, 3)], providers: { commonGeometry: { state: "prepared" } } });
    targets.forEach((target, j) => rows.push({ id: `${source}/${target}`, groupId: source, interventionId: source, source, target,
      magnitude: [4, 4, 1, 20][j], rank: [2.5, 2.5, 1, 4][j], y: [0.5, 0.5, 0, 1][j], eligible: true }));
  }
  return { rows, selections };
}
test("matched targets are reranked explicitly with ties; four groups stay unavailable; Python reconstructs membership", async () => {
  const input = fixture(), snapshot = structuredClone(input), result = matchPopulation(input.rows, input.selections);
  assert.equal(result.status, "complete"); assert.equal(result.rows.length, 15); assert.equal(result.rows[0].y, 0.75);
  assert.deepEqual(result, (await python("--population", input)).result); assert.deepEqual(input, snapshot);
  input.selections[0].nodeIds.pop(); const unavailable = matchPopulation(input.rows, input.selections);
  assert.equal(unavailable.status, "unavailable"); assert.equal(unavailable.rows.length, 12);
  assert.deepEqual(unavailable, (await python("--population", input)).result);
});
test("coverage separates mapped, stimulated, time-valid and response-eligible nodes in parent degree bins", () => {
  const unit = census(graph, "test");
  const metadata = { labels: [{ recordingId: "r", columns: [{ state: "exact-label-candidate", anatomyNodeId: "z" }] }],
    events: [{ source: "z", sourceMappingState: "exact-label-candidate", window: { eligible: false } }] };
  const nodes = nodeCoverage(unit, metadata, { rows: [] }), bins = binCoverage(nodes), zero = bins.find(b => b.bin === "0");
  assert.equal(zero.parentNodes, 1); assert.equal(zero.mappedNodes, 1); assert.equal(zero.stimulatedNodes, 1);
  assert.equal(zero.uncontaminatedStimulatedNodes, 0); assert.equal(zero.eligibleSources, 0); assert.ok(zero.variants.every(v => v.preparedRoots === 0));
  assert.equal(bins.reduce((s, b) => s + b.parentNodes, 0), graph.nodes.length);
});
test("a declared numerical failure preserves every required attempt and invalidates the whole comparison; unexpected errors escape", async () => {
  const { rows, selections } = fixture(), population = { variant: "incoming-one", ...matchPopulation(rows, selections) };
  const parent = { nodes: ["a", "b", ...selections.map(s => s.root)].sort(), edges: selections.map(s => ({ source: s.root, target: "a" })) };
  const audit = { populations: [population], units: [{ parent, selections: selections.map((s, i) => ({ ...s, variant: "incoming-one", nodeIds: ["a", s.root], edgeIndexes: [i] })) }] };
  let attempts = 0;
  const { details } = await runVariant({}, audit, "incoming-one", async () => { attempts++; return { status: "unavailable", reason: "STRUCTURAL_FLOW_NUMERIC_LIMIT", geometry: null }; });
  assert.equal(attempts, 5); assert.equal(details.scopes.length, 5); assert.equal(details.contexts, null); assert.equal(details.comparisons, null);
  assert.equal(details.reason, "required-target-scope-computation-failed");
  await assert.rejects(runVariant({}, audit, "incoming-one", async () => { throw new Error("bad certificate"); }), /bad certificate/);
});
