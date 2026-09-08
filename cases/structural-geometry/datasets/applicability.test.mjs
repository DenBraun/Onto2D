import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { observeStructuralTopology } from "@onto2d/structural-geometry/topology";
import { enumerateScopes, graphCensus, normalizeGraph, preflightProviders, scopePack } from "./scopes.mjs";
import { availability, comparable, mapNeuronLabels, observation } from "./task-profile.mjs";
import { atomicText } from "./build.mjs";

const sourceFiles = [{ path: "synthetic.json", hash: `sha256:${"a".repeat(64)}` }];
const graph = { nodes: ["a", "b", "c", "d", "isolate"], edges: [
  { source: "a", target: "b" }, { source: "b", target: "a" }, { source: "b", target: "c" }, { source: "c", target: "d" }
] };

test("source scopes are exhaustive, induced and independent of incidental source ordering", () => {
  const scopes = enumerateScopes(graph, { neighborhoods: true });
  assert.equal(scopes.length, graph.nodes.length + 1);
  assert.deepEqual(scopes, enumerateScopes({ nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() }, { neighborhoods: true }));
  const a = scopes.find(s => s.root === "a");
  assert.deepEqual(a.graph.nodes, ["a", "b"]);
  assert.equal(a.graph.edges.length, 2);
  assert.equal(a.omittedEdges.length, 2);
  assert.deepEqual(a.boundaryEdges, [{ source: "b", target: "c" }]);
  const isolated = scopes.find(s => s.root === "isolate");
  assert.equal(isolated.graph.nodes.length, 1);
  assert.equal(preflightProviders(isolated, sourceFiles, "synthetic").flow.state, "ineligible");
  assert.equal(scopes[0].graph.nodes.length, 5);
});

test("parent census agrees with the existing directed topology evaluator", () => {
  const scope = enumerateScopes(graph)[0], census = graphCensus(graph), { pack } = scopePack(scope, sourceFiles, "synthetic");
  const actual = observeStructuralTopology(pack, { regimeId: "topology-only-v1" }).observation.value;
  for (const key of ["nodeCount", "edgeCount", "weakComponentSizes", "strongComponentSizes", "isolatedNodeCount", "reachableOrderedPairCount"]) assert.deepEqual(census[key], actual[key]);
  assert.equal(census.reciprocalArcCount, 2);
  assert.equal(census.feedbackArcCount, 2);
  assert.equal(analyzeStructuralGeometry(pack).result.edges.length, graph.edges.length);
  const prepared = preflightProviders(scope, sourceFiles, "synthetic");
  assert.equal(prepared.commonGeometry.state, "prepared");
  assert.equal(prepared.commonGeometry.execution, "not-run");
});

test("common provider population rejects an oversized complete scope without edge sampling", () => {
  const nodes = Array.from({ length: 10 }, (_, i) => `n${i}`);
  const edges = nodes.flatMap(source => nodes.filter(target => target !== source).map(target => ({ source, target })));
  const scope = enumerateScopes({ nodes, edges })[0];
  const prepared = preflightProviders(scope, sourceFiles, "dense");
  assert.equal(prepared.commonGeometry.state, "ineligible");
  assert.equal(prepared.canonical.state, "ineligible");
  assert.equal(scope.graph.edges.length, 90);
  const highSupport = { nodes: Array.from({ length: 18 }, (_, i) => `n${i}`), edges: [] };
  highSupport.edges = highSupport.nodes.slice(1).map(source => ({ source, target: "n0" }));
  highSupport.edges.push({ source: "n0", target: "n1" });
  const rejected = preflightProviders(enumerateScopes(highSupport)[0], sourceFiles, "support");
  assert.equal(rejected.ollivier.reason, "STRUCTURAL_OLLIVIER_LIMIT_EXCEEDED");
  assert.equal(rejected.flow.reason, "STRUCTURAL_FLOW_LIMIT_EXCEEDED");
});

test("channel input rejects ambiguous simple graphs and binds parent identity", () => {
  for (const invalid of [
    { nodes: ["a", "a"], edges: [] }, { nodes: ["a"], edges: [{ source: "a", target: "a" }] },
    { nodes: ["a"], edges: [{ source: "a", target: "b" }] }, { ...graph, edges: [...graph.edges, graph.edges[0]] }
  ]) assert.throws(() => normalizeGraph(invalid));
  const scope = enumerateScopes(graph)[0], { pack } = scopePack(scope, sourceFiles, "one");
  assert.notEqual(pack.manifest.rootHash, scopePack(scope, [{ ...sourceFiles[0], hash: `sha256:${"b".repeat(64)}` }], "one").pack.manifest.rootHash);
  assert.notEqual(pack.manifest.rootHash, scopePack(scope, sourceFiles, "two").pack.manifest.rootHash);
});

const sample = { domain: "synthetic-measurement-v1", quantity: "signal", unit: "native", subject: "one", state: "observed", value: 1, reason: null };
test("task availability preserves measured zero, missingness, exclusions and failures", () => {
  const states = ["observed", "observed-zero", "not-applicable", "unobserved", "rejected-transformation", "budget-failure"];
  const rows = states.map((state, i) => observation({ ...sample, subject: String(i), state,
    value: i < 2 ? 1 - i : null, reason: i < 2 ? null : "explicit-test-reason" }));
  assert.deepEqual(availability(rows), { population: 6, applicable: 5, observed: 2, counts: Object.fromEntries(states.map(s => [s, 1])) });
  assert.equal(comparable(rows[0], rows[1]), true);
  assert.equal(comparable(rows[0], rows[3]), false);
  assert.equal(comparable(rows[0], observation({ ...sample, domain: "different" })), false);
  assert.throws(() => availability([rows[0], rows[0]]));
  for (const invalid of [{ value: NaN }, { value: Infinity }, { value: 0 }, { state: "observed-zero" }, { state: "unobserved", value: 0, reason: "missing" }, { extra: true }]) assert.throws(() => observation({ ...sample, ...invalid }));
});

test("cross-source mapping never guesses aliases, duplicates, target markers or missing labels", () => {
  const rows = mapNeuronLabels([" AVAL ", "AVAR", "AVAR", "AIY?", "", "AIZ", "NMSR", "merge"], ["AVAL", "AVAR", "AIYL", "AIYR", "NSMR"]);
  assert.equal(rows[0].state, "exact-label-candidate");
  assert.equal(rows[0].rawLabel, " AVAL ");
  assert.equal(rows.filter(r => r.anatomyNodeId !== null).length, 1);
  assert.equal(rows[1].state, "ambiguous-within-recording");
  assert.equal(rows[5].state, "absent-from-anatomy");
});

test("source arrays cannot silently omit edges or labels, and coverage rejects iterables without a population length", () => {
  assert.throws(() => normalizeGraph({ nodes: ["a", "b"], edges: new Array(1) }), /dense/);
  assert.throws(() => mapNeuronLabels(new Array(1), ["A"]), /dense/);
  assert.throws(() => mapNeuronLabels(["A"], new Array(1)), /dense/);
  assert.throws(() => availability(new Set([observation(sample)])), /array/);
});

test("complete scope and census work are bounded before constructing quadratic ledgers", () => {
  const nodes = Array.from({ length: 1024 }, (_, i) => `n${i}`);
  const edges = nodes.map((source, i) => ({ source, target: nodes[(i + 1) % nodes.length] }));
  assert.throws(() => enumerateScopes({ nodes, edges }, { neighborhoods: true }), /reference bound/);
  assert.equal(enumerateScopes({ nodes, edges }).length, 1);
  assert.throws(() => graphCensus({ nodes: [...nodes, "extra"], edges }), /reachability or traversal/);
});

test("prepared artifact writes reject symlink destinations and parents without modifying their targets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "onto2d-datasets-io-"));
  const base = pathToFileURL(`${directory}/`);
  try {
    await atomicText("census.json", "first\n", base);
    await atomicText("census.json", "second\n", base);
    assert.equal(await readFile(new URL("census.json", base), "utf8"), "second\n");
    await mkdir(join(directory, "real"));
    await symlink(join(directory, "real"), join(directory, "cache"));
    await assert.rejects(atomicText("cache/prepared/applicability.json", "blocked", base), /real directory/);
    assert.deepEqual(await readdir(join(directory, "real")), []);
    await rm(join(directory, "cache"));
    await mkdir(join(directory, "cache"));
    await symlink(join(directory, "real"), join(directory, "cache/prepared"));
    await assert.rejects(atomicText("cache/prepared/applicability.json", "blocked", base), /real directory/);
    await rm(new URL("census.json", base));
    await symlink(join(directory, "missing"), new URL("census.json", base));
    await assert.rejects(atomicText("census.json", "blocked", base), /symlink/);
    await assert.rejects(atomicText("../outside.json", "blocked", base), /Unknown/);
    assert.deepEqual((await readdir(directory)).sort(), ["cache", "census.json", "real"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
