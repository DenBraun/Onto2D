import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { Model, Onto2D } from "@onto2d/engine";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { OLLIVIER_POLICY, OLLIVIER_SOLVER, prepareOllivierRequest, acceptOllivierResponse,
  createOllivierAnalyzer, createOllivierAnalysis, verifyOllivierArtifact } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { controls, packFor, fixtures, readJson } from "../../../cases/structural-geometry/ollivier/fixtures.mjs";

const graph = (id) => structuredClone(controls.find((g) => g.id === id));
const inputFor = (g, extra = {}) => ({ edgeIds: g.edgeIds ?? g.edges.map((e) => e.id), ...extra });
const adapter = createPythonOllivierAdapter();
const analyzer = () => createOllivierAnalyzer(adapter, { maxCacheEntries: 0 });
const rational = (n, d = 1) => ({ numerator: String(n), denominator: String(d) });
const code = (suffix) => (e) => e.code === `STRUCTURAL_OLLIVIER_${suffix}`;
const solve = async (id, idleness = "zero") => {
  const g = graph(id); return analyzer().analyze(packFor(g), inputFor(g, { idleness }));
};
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}

test("analytic directed controls fix neighborhoods, idleness and empty-neighborhood behavior", async () => {
  const expected = {
    "single-edge": [0], path: [-1, -2, -1], cycle: [-2, -2, -2, -2],
    "outward-star": [0, 0, 0, 0], "inward-star": [0, 0, 0, 0],
    "feedback-triangle": [1, 1, 1], "reciprocal-pair": [0, 0]
  };
  for (const [id, values] of Object.entries(expected)) {
    assert.deepEqual((await solve(id)).result.edges.map((e) => e.curvature), values.map((n) => rational(n)), id);
  }
  assert.deepEqual((await solve("path", "half")).result.edges.map((e) => e.curvature), [rational(-1, 2), rational(-1), rational(-1, 2)]);
  assert.ok((await solve("bidirected-clique")).result.edges.every((e) => e.curvature.numerator === "1" && e.curvature.denominator === "2"));
  assert.ok((await solve("bidirected-clique", "half")).result.edges.every((e) => e.curvature.numerator === "3" && e.curvature.denominator === "4"));
});

test("Ollivier detects a neighborhood shortcut with identical Forman endpoint-degree values", async () => {
  const results = [];
  for (const id of ["degree-control-open", "degree-control-shortcut"]) {
    const g = graph(id); const pack = packFor(g);
    results.push({ forman: analyzeStructuralGeometry(pack).result.edges.find((e) => e.id === "u->v").curvature,
      ollivier: (await analyzer().analyze(pack, inputFor(g))).result.edges[0].curvature });
  }
  assert.equal(results[0].forman, results[1].forman);
  assert.deepEqual(results.map((r) => r.ollivier), [rational(-2), rational(0)]);
});

test("frozen certificates and all independent NetworkX values replay against their exact source", async () => {
  const independent = await readJson("networkx-expected.json");
  const suite = await readJson("suite.json");
  const cases = await fixtures();
  assert.equal(independent.reference.package, "networkx");
  assert.equal(independent.reference.version, "3.2.1");
  assert.equal(cases.length, 40);
  assert.equal(independent.cases.length, cases.length);
  assert.equal(suite.runs.length, cases.length);
  for (const entry of cases) {
    const artifact = await readJson(`artifacts/${entry.id}.json`);
    const verified = verifyOllivierArtifact(artifact, entry.pack, entry.input);
    assert.deepEqual(independent.cases.find((v) => v.id === entry.id), { id: entry.id,
      requestHash: verified.request.requestHash, edges: verified.result.edges.map(({ id, wasserstein, curvature }) => ({ id, wasserstein, curvature })) });
    assert.equal(suite.runs.find((v) => v.id === entry.id).artifactHash, verified.artifactHash);
  }
});

test("projection, request, certificates and source snapshots stay immutable", async () => {
  const g = graph("unequal-mass-shortcuts"); const pack = structuredClone(packFor(g)); const before = JSON.stringify(pack);
  const request = prepareOllivierRequest(pack, inputFor(g));
  const artifact = await analyzer().analyze(pack, inputFor(g));
  frozen(request); frozen(artifact); frozen(OLLIVIER_POLICY);
  assert.equal(JSON.stringify(pack), before);
  assert.notEqual(artifact.result.edges[0].curvature.denominator, "0");
});

test("source attribute changes bind identity without turning source weights into transport lengths", async () => {
  const original = graph("path"); const changed = structuredClone(original);
  changed.edges.forEach((edge, i) => { edge.weight = i + 0.01; edge.necessity = "optional"; });
  changed.nodes[0].name = "Updated source label";
  const left = await analyzer().analyze(packFor(original), inputFor(original));
  const right = await analyzer().analyze(packFor(changed), inputFor(changed));
  assert.deepEqual(left.result, right.result);
  assert.notEqual(left.request.requestHash, right.request.requestHash);
  assert.notEqual(left.model.modelRootHash, right.model.modelRootHash);
});

test("record order and request ID permutations preserve exact request and artifact identity", async () => {
  const g = graph("diamond-dag"); const a = await analyzer().analyze(packFor(g), inputFor(g));
  g.nodes.reverse(); g.edges.reverse();
  const b = await analyzer().analyze(packFor(g), inputFor(g));
  assert.deepEqual(a, b);
});

test("Unicode relabeling preserves numeric values and follows the declared UTF-16 support order", async () => {
  const g = graph("unequal-mass-shortcuts");
  const a = await analyzer().analyze(packFor(g), inputFor(g));
  const map = new Map(g.nodes.map((n, i) => [n.id, ["😀", "\ue000", "α", "日本", "Ж", "z", "a", "b"][i]]));
  g.nodes = g.nodes.map((n) => ({ ...n, id: map.get(n.id) }));
  g.edges = g.edges.map((e) => ({ ...e, source: map.get(e.source), target: map.get(e.target) }));
  const b = await analyzer().analyze(packFor(g), inputFor(g));
  assert.deepEqual(a.result.edges.map((e) => e.curvature), b.result.edges.map((e) => e.curvature));
  assert.notEqual(a.request.requestHash, b.request.requestHash);
  const support = b.request.problems[0].sourceMeasure.map((e) => e.nodeId);
  assert.deepEqual(support, [...support].sort());
});

test("global reversal transposes unit transport and preserves corresponding edge curvature", async () => {
  const g = graph("unequal-mass-shortcuts");
  const a = await analyzer().analyze(packFor(g), inputFor(g, { idleness: "half" }));
  g.edges = g.edges.map((e) => ({ ...e, source: e.target, target: e.source }));
  const b = await analyzer().analyze(packFor(g), inputFor(g, { idleness: "half" }));
  assert.deepEqual(a.result.edges.map((e) => e.curvature), b.result.edges.map((e) => e.curvature));
  assert.deepEqual(b.request.problems[0].costs, a.request.problems[0].costs[0].map((_, i) => a.request.problems[0].costs.map((row) => row[i])));
});

test("single-edge reversal changes directed support geometry", async () => {
  const g = graph("degree-control-shortcut");
  const a = await analyzer().analyze(packFor(g), inputFor(g));
  const shortcut = g.edges.find((e) => e.id === "a->b");
  [shortcut.source, shortcut.target] = [shortcut.target, shortcut.source];
  const b = await analyzer().analyze(packFor(g), inputFor(g));
  assert.deepEqual([a.result.edges[0].curvature, b.result.edges[0].curvature], [rational(0), rational(-2)]);
});

test("disconnected components are retained and never require symmetrization or synthetic distances", async () => {
  const g = graph("path"); const before = await analyzer().analyze(packFor(g), inputFor(g));
  g.nodes.push({ id: "isolated" }, { id: "x" }, { id: "y" });
  g.edges.push({ id: "x->y", source: "x", target: "y" });
  const after = await analyzer().analyze(packFor(g), { edgeIds: ["a->b", "b->c", "c->d"] });
  assert.deepEqual(before.result, after.result);
  assert.equal(after.request.graph.nodes.length, 7);
});

test("induced scope explicitly accounts for boundary edges and recomputes its own neighborhoods", async () => {
  const g = graph("path"); const pack = packFor(g);
  const full = await analyzer().analyze(pack, { edgeIds: ["b->c"] });
  const input = { scope: { kind: "induced", nodeIds: ["c", "b"] }, edgeIds: ["b->c"] };
  const fragment = await analyzer().analyze(pack, input);
  assert.deepEqual(full.result.edges[0].curvature, rational(-2));
  assert.deepEqual(fragment.result.edges[0].curvature, rational(0));
  assert.equal(fragment.request.scope.boundaryEdgeCount, 2);
  assert.equal(fragment.request.scope.excludedNodeCount, 2);
  assert.equal(fragment.request.sourceProjectionHash, full.request.sourceProjectionHash);
  assert.notEqual(fragment.request.projectionHash, full.request.projectionHash);
  assert.throws(() => verifyOllivierArtifact(fragment, pack, { edgeIds: ["b->c"] }), code("RESPONSE_BINDING_MISMATCH"));
});

test("closed inputs reject malformed scopes, selectors, idleness and empty selections", () => {
  const pack = packFor(graph("path"));
  for (const bad of [null, [], {}, { edgeIds: [] }, { edgeIds: ["a->b", "a->b"] }, { edgeIds: [7] },
    { edgeIds: ["a->b"], idleness: null }, { edgeIds: ["a->b"], idleness: ["zero"] },
    { edgeIds: ["a->b"], scope: null }, { edgeIds: ["a->b"], scope: { kind: ["full"] } },
    { edgeIds: ["a->b"], scope: { kind: "full", nodeIds: [] } },
    { edgeIds: ["a->b"], scope: { kind: "induced", nodeIds: ["a", "a"] } },
    { edgeIds: ["a->b"], metricPolicyId: "unit-v1" }]) {
    assert.throws(() => prepareOllivierRequest(pack, bad));
  }
  for (const bad of [{ edgeIds: ["unknown"] }, { edgeIds: ["a->b"], scope: { kind: "induced", nodeIds: ["a", "unknown"] } },
    { edgeIds: ["a->b"], scope: { kind: "induced", nodeIds: ["b", "c"] } }]) {
    assert.throws(() => prepareOllivierRequest(pack, bad), code("SCOPE_INVALID"));
  }
});

test("complete-source verification prevents invalid excluded relations from hiding behind a fragment", () => {
  const g = graph("path"); g.edges.at(-1).relationLayer = "unsupported";
  assert.throws(() => prepareOllivierRequest(packFor(g), { scope: { kind: "induced", nodeIds: ["a", "b"] }, edgeIds: ["a->b"] }));
  const source = structuredClone(packFor(graph("path"))); source.files["model/edges.json"][0].weight = 2;
  assert.throws(() => prepareOllivierRequest(source, { edgeIds: ["b->c"] }));
});

test("node, edge, analyzed-edge and support bounds fail explicitly without truncation", () => {
  const g = graph("single-edge");
  g.nodes.push(...Array.from({ length: 63 }, (_, i) => ({ id: `n${i}` })));
  assert.throws(() => prepareOllivierRequest(packFor(g), inputFor(g)), code("LIMIT_EXCEEDED"));
  const star = { id: "large-support", nodes: ["u", "v", ...Array.from({ length: 17 }, (_, i) => `n${i}`)].map((id) => ({ id })),
    edges: [{ id: "u->v", source: "u", target: "v" }, ...Array.from({ length: 17 }, (_, i) => ({ id: `n${i}->u`, source: `n${i}`, target: "u" }))] };
  assert.throws(() => prepareOllivierRequest(packFor(star), { edgeIds: ["u->v"] }), code("LIMIT_EXCEEDED"));
  const dense = { id: "dense", nodes: Array.from({ length: 17 }, (_, i) => ({ id: `n${i}` })) };
  dense.edges = dense.nodes.flatMap((a) => dense.nodes.filter((b) => a !== b).map((b) => ({ id: `${a.id}->${b.id}`, source: a.id, target: b.id })));
  assert.throws(() => prepareOllivierRequest(packFor(dense), { edgeIds: [dense.edges[0].id] }), code("LIMIT_EXCEEDED"));
  assert.throws(() => prepareOllivierRequest(packFor(dense), { edgeIds: dense.edges.slice(0, 33).map((e) => e.id) }), code("INPUT_INVALID"));
  dense.nodes.pop(); dense.edges = dense.edges.filter((e) => e.source !== "n16" && e.target !== "n16");
  const bounded = packFor(dense);
  assert.equal(prepareOllivierRequest(bounded, { edgeIds: dense.edges.slice(0, 16).map((e) => e.id), idleness: "half" }).problems.length, 16);
  assert.throws(() => prepareOllivierRequest(bounded, { edgeIds: dense.edges.slice(0, 17).map((e) => e.id), idleness: "half" }), code("LIMIT_EXCEEDED"));
});

test("transport certificates reject forged mass, dual bounds, objectives, bindings and extra fields", async () => {
  const g = graph("unequal-mass-shortcuts"); const pack = packFor(g); const input = inputFor(g);
  const request = prepareOllivierRequest(pack, input); const response = await adapter.evaluate(request);
  for (const change of [
    (r) => { r.solutions[0].flow[0][0] += 1; },
    (r) => { r.solutions[0].flow[0][0] = -1; },
    (r) => { r.solutions[0].flow[0][0] = 0.5; },
    (r) => { r.solutions[0].sourcePotentials[0] = 4097; },
    (r) => { r.solutions[0].sourcePotentials[0] += 4; },
    (r) => { r.solutions[0].targetPotentials[0] -= 1; },
    (r) => { r.solutions[0].costNumerator += 1; },
    (r) => { r.solutions[0].flow.pop(); }, (r) => { r.solutions[0].flow[0].pop(); },
    (r) => { r.solutions[0].edgeId = "other"; }, (r) => { r.solutions.push(r.solutions[0]); },
    (r) => { r.requestHash = `sha256:${"0".repeat(64)}`; },
    (r) => { r.solver.version = "2"; }, (r) => { r.extra = true; }
  ]) {
    const forged = structuredClone(response); change(forged);
    assert.throws(() => acceptOllivierResponse(forged, pack, input));
  }
});

test("a feasible nonoptimal plan is rejected even when its self-reported objective matches", async () => {
  const g = graph("bidirected-clique"); const pack = packFor(g); const input = { edgeIds: [g.edges[0].id] };
  const request = prepareOllivierRequest(pack, input); const response = await adapter.evaluate(request);
  // Both marginals are [1,1]. Choose the more expensive of the two permutations.
  const costs = request.problems[0].costs;
  const diagonal = costs[0][0] + costs[1][1]; const cross = costs[0][1] + costs[1][0];
  response.solutions[0].flow = diagonal > cross ? [[1, 0], [0, 1]] : [[0, 1], [1, 0]];
  response.solutions[0].costNumerator = Math.max(diagonal, cross);
  assert.throws(() => acceptOllivierResponse(response, pack, input), code("CERTIFICATE_INVALID"));
});

test("rehashing cannot validate altered graph distances, summaries or source identities", async () => {
  const g = graph("path"); const pack = packFor(g); const input = inputFor(g);
  const artifact = await analyzer().analyze(pack, input);
  for (const change of [(a) => { a.result.summary.mean.numerator = "7"; },
    (a) => { a.request.problems[0].costs[0][0] = 0; },
    (a) => { a.request.graph.edges.pop(); }, (a) => { a.model.manifestHash = `sha256:${"0".repeat(64)}`; }]) {
    const forged = structuredClone(artifact); change(forged);
    const { artifactHash: _, ...body } = forged;
    forged.artifactHash = hashCanonical("onto2d:structural-ollivier-artifact:v1", body);
    assert.throws(() => verifyOllivierArtifact(forged, pack, input), code("ARTIFACT_VERIFICATION_FAILED"));
  }
});

test("LRU cache binds exact model, projection and idleness, and supports eviction and disabling", async () => {
  let calls = 0;
  const wrapped = { ...OLLIVIER_SOLVER, evaluate: (request) => { calls += 1; return adapter.evaluate(request); } };
  const cached = createOllivierAnalyzer(wrapped, { maxCacheEntries: 1 });
  const g = graph("path"); const pack = packFor(g); const zero = inputFor(g); const half = inputFor(g, { idleness: "half" });
  const a = await cached.analyze(pack, zero); assert.deepEqual(await cached.analyze(pack, zero), a); assert.equal(calls, 1);
  await cached.analyze(pack, half); await cached.analyze(pack, zero); assert.equal(calls, 3);
  cached.clearCache(); await cached.analyze(pack, zero); assert.equal(calls, 4);
  g.nodes[0].name = "new provenance"; await cached.analyze(packFor(g), zero); assert.equal(calls, 5);
  const uncached = createOllivierAnalyzer(wrapped, { maxCacheEntries: 0 });
  await uncached.analyze(pack, zero); await uncached.analyze(pack, zero); assert.equal(calls, 7);
});

test("failed certificates never enter cache and async evaluation binds the pre-await source snapshot", async () => {
  const g = graph("path"); const pack = structuredClone(packFor(g)); const input = inputFor(g);
  let calls = 0;
  const cached = createOllivierAnalyzer({ ...OLLIVIER_SOLVER, async evaluate(request) {
    calls += 1;
    const response = await adapter.evaluate(request);
    if (calls === 1) response.solutions[0].costNumerator += 1;
    return response;
  } });
  await assert.rejects(cached.analyze(pack, input), code("CERTIFICATE_INVALID"));
  await cached.analyze(pack, input); assert.equal(calls, 2);
  const original = structuredClone(pack);
  const pending = analyzer().analyze(pack, input);
  pack.files["model/nodes.json"][0].name = "changed after request";
  verifyOllivierArtifact(await pending, original, input);
  await assert.rejects(cached.analyze(pack, input));
});

test("engine analysis is opt-in and requires a verified engine Model", async () => {
  const g = graph("path"); const pack = packFor(g); const analysis = createOllivierAnalysis(adapter);
  const unregistered = await Onto2D.create({ models: [pack] });
  assert.equal(unregistered.analyses().some((entry) => entry.id === analysis.id), false);
  const engine = await Onto2D.create({ models: [pack], analyses: [analysis] });
  const result = await engine.analyze(analysis.id, inputFor(g));
  verifyOllivierArtifact(result, pack, inputFor(g));
  assert.throws(() => analysis.run({ model: {} }, inputFor(g)));
  assert.throws(() => analysis.run({ model: Object.create(Model.prototype) }, inputFor(g)));
});

test("adapter options, process failures, timeouts and oversized requests fail explicitly", async () => {
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: null }, { timeoutMs: 30001 }, { pythonExecutable: "" }, { extra: 1 }]) {
    assert.throws(() => createPythonOllivierAdapter(options), code("INPUT_INVALID"));
  }
  for (const options of [{ maxCacheEntries: -1 }, { maxCacheEntries: null }, { maxCacheEntries: 129 }, { extra: 1 }]) {
    assert.throws(() => createOllivierAnalyzer(adapter, options), code("INPUT_INVALID"));
  }
  assert.throws(() => createOllivierAnalyzer({ ...adapter, version: "2" }), code("SOLVER_UNSUPPORTED"));
  const g = graph("path"); const request = prepareOllivierRequest(packFor(g), inputFor(g));
  await assert.rejects(createPythonOllivierAdapter({ pythonExecutable: "/does-not-exist/onto2d-python" }).evaluate(request), code("ORACLE_FAILED"));
  await assert.rejects(createPythonOllivierAdapter({ timeoutMs: 1 }).evaluate(request), code("ORACLE_TIMEOUT"));
  await assert.rejects(adapter.evaluate({ padding: "x".repeat(1048577) }));
  await assert.rejects(adapter.evaluate({ ...request, problems: [] }), code("ORACLE_FAILED"));
});

test("Python stdin rejects duplicate properties, noninteger masses and unreachable sentinel costs", () => {
  const g = graph("path"); const request = prepareOllivierRequest(packFor(g), inputFor(g));
  const oracle = fileURLToPath(new URL("../src/python/ollivier_oracle.py", import.meta.url));
  const invalid = structuredClone(request); invalid.problems[0].costs[0][0] = null;
  const booleanMass = structuredClone(request); booleanMass.problems[0].sourceMeasure[0].units = true;
  for (const payload of [JSON.stringify(invalid), JSON.stringify(booleanMass), JSON.stringify(request).replace('"schemaVersion":"1"', '"schemaVersion":"1","schemaVersion":"1"')]) {
    const result = spawnSync("python3", ["-I", "-B", oracle], { input: payload, encoding: "utf8", timeout: 30000, maxBuffer: 1048576 });
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
  }
});

// Exhaustively enumerates row allocations for tiny problems; deliberately uses
// neither residual paths nor the production certificate algorithm.
function exhaustiveCost(problem) {
  const supply = problem.sourceMeasure.map((e) => e.units);
  const demand = problem.targetMeasure.map((e) => e.units);
  const memo = new Map();
  function row(i, remaining) {
    if (i === supply.length) return remaining.every((v) => v === 0) ? 0 : Infinity;
    const key = `${i}:${remaining.join(",")}`;
    if (memo.has(key)) return memo.get(key);
    let best = Infinity;
    function assign(j, mass, cost, next) {
      if (j === remaining.length) {
        if (mass === 0) best = Math.min(best, cost + row(i + 1, next));
        return;
      }
      for (let k = 0; k <= Math.min(mass, remaining[j]); k += 1) {
        assign(j + 1, mass - k, cost + k * problem.costs[i][j], [...next, remaining[j] - k]);
      }
    }
    assign(0, supply[i], 0, []); memo.set(key, best); return best;
  }
  return row(0, demand);
}

test("exact oracle matches exhaustive transport optima on a deterministic small directed graph family", async () => {
  let state = 19381;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  for (let trial = 0; trial < 16; trial += 1) {
    const nodes = ["a", "b", "c", "d"].map((id) => ({ id }));
    const edges = nodes.flatMap((a) => nodes.filter((b) => a !== b && (a.id === "a" && b.id === "b" || random() < 0.4))
      .map((b) => ({ id: `${a.id}->${b.id}`, source: a.id, target: b.id })));
    const g = { id: `generated-${trial}`, nodes, edges };
    for (const idleness of ["zero", "half"]) {
      const request = prepareOllivierRequest(packFor(g), inputFor(g, { idleness }));
      const response = await adapter.evaluate(request);
      acceptOllivierResponse(response, packFor(g), inputFor(g, { idleness }));
      assert.deepEqual(response.solutions.map((s) => s.costNumerator), request.problems.map(exhaustiveCost));
    }
  }
});
