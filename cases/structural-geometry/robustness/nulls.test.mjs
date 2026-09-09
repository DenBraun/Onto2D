import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGraph, digest } from "../datasets/scopes.mjs";
import { sampleNull, verifyNull, labelledConstraints } from "./nulls.mjs";
import { reference } from "./io.mjs";

const graph = edges => normalizeGraph({ nodes: ["a", "b", "c", "d"], edges: edges.map(([source, target]) => ({ source, target })) });
const diamond = graph(["ab", "ac", "bd", "cd"]);
const request = (value = diamond, nullIndex = 0) => ({ datasetId: "control", root: null, graph: value,
  originalGraphSha256: digest(value), nullIndex });

test("every indexed null retains exact labelled degrees, components and complete proposal accounting", () => {
  const value = graph(["ab", "ac", "bd", "cd", "da"]);
  for (let i = 0; i < 32; i++) {
    const result = sampleNull(request(value, i));
    assert.equal(result.status, "complete"); assert.equal(result.accepted, 50);
    assert.deepEqual(labelledConstraints(result.graph), labelledConstraints(value));
    assert.equal(Object.values(result.outcomes).reduce((a, b) => a + b, 0), result.proposals);
    assert.deepEqual(result.attempts.map(row => row.counter), Array.from({ length: result.proposals }, (_, i) => i));
    assert.ok(Object.isFrozen(result.graph.edges));
  }
});

test("duplicates and final graphs equal to the source remain indexed with multiplicity", () => {
  const results = Array.from({ length: 32 }, (_, i) => sampleNull(request(diamond, i)));
  assert.ok(results.every(row => row.status === "complete" && row.accepted === 40 && !row.changed));
  assert.equal(new Set(results.map(row => row.graphSha256)).size, 1);
  assert.equal(new Set(results.map(row => digest(row.attempts))).size, 32);
});

test("immobile, empty and component-breaking graphs become unavailable without relaxing the stopping rule", () => {
  const cycle = sampleNull(request(graph(["ab", "bc", "cd", "da"])));
  assert.equal(cycle.status, "unavailable"); assert.equal(cycle.accepted, 0); assert.equal(cycle.proposals, 4096);
  assert.ok(cycle.outcomes["component-membership"] > 0);
  const empty = sampleNull(request(graph([])));
  assert.equal(empty.reason, "empty-edge-set"); assert.equal(empty.proposals, 0);
  const disconnected = sampleNull(request(graph(["ab", "cd"])));
  assert.equal(disconnected.accepted, 0);
  assert.deepEqual(disconnected.constraints.components, [["a", "b"], ["c", "d"]]);
});

test("original identity, complete replay, bounded indices and fixed parameters reject tampering", () => {
  const input = request(), value = sampleNull(input);
  assert.deepEqual(verifyNull(value, input), value);
  for (const altered of [{ ...input, nullIndex: 32 }, { ...input, originalGraphSha256: "0".repeat(64) },
    { ...input, root: "foreign" }, { ...input, maxProposals: 8192 }, { ...input, datasetId: "\ud800" }]) assert.throws(() => sampleNull(altered));
  const changed = structuredClone(value); changed.attempts[0].first = (changed.attempts[0].first + 1) % 4;
  assert.throws(() => verifyNull(changed, input));
  assert.throws(() => verifyNull(value, { ...input, nullIndex: 1 }));
  const oversized = { nodes: Array.from({ length: 65 }, (_, i) => String(i)), edges: [] };
  assert.throws(() => sampleNull(request(oversized)), /bounds/);
});

test("independent union-find sampler agrees on all 32 indices and UTF-16 ordering", async () => {
  const value = graph(["ab", "ac", "bd", "cd", "da"]);
  for (let i = 0; i < 32; i++) {
    const input = request(value, i);
    assert.deepEqual((await reference(input, { mode: "--sampler" })).result, sampleNull(input));
  }
  const names = ["a", "\u{10000}", "\ue000", "quote\"\\\n"], replacement = new Map(value.nodes.map((node, i) => [node, names[i]]));
  const unicode = normalizeGraph({ nodes: names, edges: value.edges.map(row => ({ source: replacement.get(row.source), target: replacement.get(row.target) })) });
  const input = { ...request(unicode, 31), datasetId: "dataset\u{10000}", root: names[1] };
  assert.deepEqual((await reference(input, { mode: "--sampler" })).result, sampleNull(input));
});
