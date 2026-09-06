import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { Model, Onto2D } from "@onto2d/engine";
import { STRUCTURAL_FLOW_POLICY, STRUCTURAL_FLOW_SOLVER, prepareStructuralFlow,
  createStructuralFlowAnalyzer, createStructuralFlowAnalysis, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { controls, fixtures, packFor, readJson, rational as r } from "../../../cases/structural-geometry/flow/fixtures.mjs";
import { referenceValues } from "../../../cases/structural-geometry/flow/build.mjs";

const adapter = createPythonStructuralFlowAdapter();
const analyzer = createStructuralFlowAnalyzer(adapter);
const control = (id) => controls().find((c) => c.graph.id === id);
const solve = (id, input) => { const c = control(id); return analyzer.analyze(packFor(c.graph), input ?? c.input); };
const code = (suffix) => (error) => error.code === `STRUCTURAL_FLOW_${suffix}`;
const numeric = (v) => Number(v.numerator) / Number(v.denominator);
function frozen(v) { if (v && typeof v === "object") { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }

test("all frozen flow trajectories replay with independently reconstructed NetworkX values", async () => {
  const expected = await readJson("networkx-expected.json"); const suite = await readJson("suite.json");
  const cases = await fixtures();
  assert.equal(expected.reference.version, "3.2.1"); assert.equal(cases.length, 11);
  assert.equal(expected.cases.length, cases.length); assert.equal(suite.runs.length, cases.length);
  let states = 0; let calculations = 0;
  for (const f of cases) {
    const artifact = verifyStructuralFlowArtifact(await readJson(`artifacts/${f.id}.json`), f.pack, f.input);
    assert.deepEqual(referenceValues(f.id, artifact), expected.cases.find((c) => c.id === f.id));
    assert.equal(artifact.artifactHash, suite.runs.find((c) => c.id === f.id).artifactHash);
    states += artifact.states.length; calculations += artifact.states.length * artifact.request.graph.edges.length;
    for (const state of artifact.states) {
      assert.deepEqual(state.summary.lengthSum, r(artifact.request.graph.edges.length));
      assert.ok(state.edges.every((e) => BigInt(e.length.numerator) > 0n));
    }
  }
  assert.equal(states, 68); assert.equal(calculations, 1089);
});

test("published G(3,2) recurrence independently checks every step and three recovered groups", () => {
  const result = spawnSync("python3", ["-B", fileURLToPath(new URL("../../../cases/structural-geometry/flow/paper_reference.py", import.meta.url))],
    { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /714 exact edge values/);
});

test("path evolves simultaneously and maintains exact mean-one lengths", async () => {
  const artifact = await solve("path", { maxIterations: 4 });
  assert.equal(artifact.termination.reason, "iteration-limit"); assert.equal(artifact.states.length, 5);
  assert.deepEqual(artifact.states[1].edges.map((e) => e.length), [r(15, 16), r(9, 8), r(15, 16)]);
  assert.deepEqual(artifact.states[4].edges.map((e) => e.length), [r(185, 209), r(257, 209), r(185, 209)]);
  assert.notDeepEqual(artifact.states[0].edges.map((e) => e.curvature), artifact.states[1].edges.map((e) => e.curvature));
});

test("fixed points, exact period-two cycles and zero-length degeneracy have distinct stopping records", async () => {
  for (const id of ["single-edge", "bidirected-clique"]) {
    const a = await solve(id); assert.equal(a.termination.reason, "fixed-point"); assert.equal(a.termination.iteration, 1);
  }
  const cycle = await solve("period-two");
  assert.deepEqual(cycle.termination, { reason: "cycle", iteration: 2, cycleStart: 0, cyclePeriod: 2, edgeIds: [] });
  assert.deepEqual(cycle.states[0].edges.map((e) => e.length), cycle.states[2].edges.map((e) => e.length));
  assert.notDeepEqual(cycle.states[0].edges, cycle.states[1].edges);
  const degenerate = await solve("feedback-triangle");
  assert.equal(degenerate.termination.reason, "degenerate-length"); assert.equal(degenerate.termination.iteration, 0);
  assert.equal(degenerate.termination.edgeIds.length, 3); assert.equal(degenerate.states.length, 1);
  assert.ok(degenerate.states[0].edges.every((e) => e.wasserstein.numerator === "0" && e.length.numerator === "1"));
});

test("tolerance needs both deltas and consecutive stable steps; cap is not convergence", async () => {
  const a = await solve("path", { tolerance: r(1), stableSteps: 3 });
  assert.equal(a.termination.reason, "tolerance"); assert.equal(a.termination.iteration, 3);
  assert.deepEqual(a.states.map((s) => s.summary.stableStepCount), [0, 1, 2, 3]);
  // First length delta is 1/8, curvature delta is 1/6: 3/20 lies between them.
  const b = await solve("path", { tolerance: r(3, 20), stableSteps: 1 });
  assert.equal(b.states[1].summary.stableStepCount, 0); assert.equal(b.termination.reason, "tolerance");
  assert.ok(b.termination.iteration > 1);
  const c = await solve("path", { maxIterations: 1, tolerance: r(1), stableSteps: 2 });
  assert.equal(c.termination.reason, "iteration-limit");
});

test("initial lengths are metric closed before normalization, including isolates", async () => {
  const a = await solve("initial-metric-closure"); const state = a.states[0];
  assert.deepEqual(state.normalization, { rawSum: r(7), closureSum: r(4), factor: r(3, 4), shortenedEdgeIds: ["a->c"] });
  assert.deepEqual(state.edges.map((e) => e.length), [r(3, 4), r(3, 2), r(3, 4)]);
  assert.equal(a.cuts.connectivity.isolatedNodeCount, 1);
  assert.ok(a.cuts.weakComponents.some((c) => c.length === 1 && c[0] === "isolated"));
});

test("uniform scaling changes provenance but preserves the entire normalized numeric trajectory", async () => {
  const { graph, input } = control("initial-metric-closure");
  const a = await analyzer.analyze(packFor(graph), input);
  const b = await analyzer.analyze(packFor(graph), { ...input,
    initialLengths: input.initialLengths.map((e) => ({ ...e, length: r(BigInt(e.length.numerator) * 7n) })) });
  assert.deepEqual(a.states.map((s) => s.edges), b.states.map((s) => s.edges));
  assert.notEqual(a.request.requestHash, b.request.requestHash);
});

test("source weights and labels bind identity without becoming flow lengths", async () => {
  const { graph } = control("path"); const input = { maxIterations: 2 };
  const a = await analyzer.analyze(packFor(graph), input);
  graph.edges.forEach((e, i) => { e.weight = 0.05 + i; }); graph.nodes[0].name = "Revised source label";
  const b = await analyzer.analyze(packFor(graph), input);
  assert.deepEqual(a.states.map((s) => s.edges), b.states.map((s) => s.edges));
  assert.notEqual(a.model.modelRootHash, b.model.modelRootHash);
});

test("source, input, requests and complete history remain immutable across asynchronous solving", async () => {
  const { graph } = control("path"); const source = structuredClone(packFor(graph));
  const input = { maxIterations: 2 }; const before = structuredClone(source);
  const request = prepareStructuralFlow(source, input); const pending = analyzer.analyze(source, input);
  input.maxIterations = 1; source.files["model/nodes.json"][0].name = "Changed during await";
  const artifact = await pending; verifyStructuralFlowArtifact(artifact, before, { maxIterations: 2 });
  frozen(artifact); frozen(request); frozen(STRUCTURAL_FLOW_POLICY);
  await assert.rejects(analyzer.analyze(source, input));
  const intact = structuredClone(before); await analyzer.analyze(intact, { maxIterations: 1 }); assert.deepEqual(intact, before);
});

test("record and initial-length permutations preserve deterministic artifact identity", async () => {
  const { graph, input } = control("initial-metric-closure");
  const a = await analyzer.analyze(packFor(graph), input);
  graph.nodes.reverse(); graph.edges.reverse(); input.initialLengths.reverse();
  assert.deepEqual(await analyzer.analyze(packFor(graph), input), a);
});

test("global reversal and Unicode relabeling preserve corresponding flow values", async () => {
  const { graph } = control("asymmetric-neighborhood"); const input = { maxIterations: 3 };
  const a = await analyzer.analyze(packFor(graph), input);
  const labels = new Map(graph.nodes.map((n, i) => [n.id, ["😀", "\ue000", "α", "日本", "Ж", "z", "a", "b"][i] ?? `n${i}`]));
  graph.nodes = graph.nodes.map((n) => ({ ...n, id: labels.get(n.id) }));
  graph.edges = graph.edges.map((e) => ({ ...e, source: labels.get(e.target), target: labels.get(e.source) }));
  const b = await analyzer.analyze(packFor(graph), input);
  assert.deepEqual(a.states.map((s) => s.edges), b.states.map((s) => s.edges));
  assert.notEqual(a.artifactHash, b.artifactHash);
  assert.deepEqual(b.request.graph.nodes.map((n) => n.id), [...labels.values()].sort());
});

test("induced scope keeps all internal edges, counts boundaries and verifies excluded source data", async () => {
  const { graph } = control("path"); const pack = packFor(graph);
  const input = { scope: { kind: "induced", nodeIds: ["c", "b"] } };
  const a = await analyzer.analyze(pack, input);
  assert.equal(a.request.graph.edges.length, 1); assert.equal(a.request.scope.boundaryEdgeCount, 2);
  assert.equal(a.request.scope.excludedNodeCount, 2); assert.equal(a.request.scope.excludedEdgeCount, 2);
  assert.equal(a.termination.reason, "fixed-point");
  assert.throws(() => verifyStructuralFlowArtifact(a, pack));
  graph.edges.at(-1).relationLayer = "unsupported";
  assert.throws(() => prepareStructuralFlow(packFor(graph), input));
});

test("final cuts are strict, retain isolated vertices and never feed back into the flow", async () => {
  const a = await solve("path", { maxIterations: 2 });
  const b = await solve("path", { maxIterations: 2, cut: { kind: "final-length", threshold: r(1, 100) } });
  assert.deepEqual(a.states.map((s) => s.edges), b.states.map((s) => s.edges));
  assert.equal(b.cuts.removedEdgeIds.length, 3); assert.equal(b.cuts.connectivity.isolatedNodeCount, 4);
  assert.equal(b.request.graph.edges.length, 3);
  const equal = await solve("single-edge", { cut: { kind: "final-length", threshold: r(1) } });
  assert.deepEqual(equal.cuts.removedEdgeIds, []);
});

test("closed input rejects malformed rational numbers, unknown edges, incomplete lengths and options", () => {
  const { graph } = control("path"); const pack = packFor(graph);
  for (const input of [null, [], { maxIterations: 0 }, { maxIterations: 25 }, { maxIterations: 0.5 }, { stableSteps: 0 },
    { stableSteps: 9 }, { step: 0.5 }, { idleness: null }, { cut: { kind: "none", threshold: r(1) } },
    { cut: { kind: "final-length", threshold: r(0) } }, { scope: { kind: "full", nodeIds: [] } },
    { scope: { kind: "induced", nodeIds: ["a", "a"] } }, { scope: { kind: "induced", nodeIds: ["a", "unknown"] } },
    { edgeIds: ["a->b"] }, { initialLengths: [] }, { tolerance: r(2) }, { tolerance: r(2, 4) }, { tolerance: r(-1) },
    { tolerance: r(1, 0) }, { tolerance: r("01") }, { tolerance: r("-0") }, { tolerance: r("1e-6") },
    { tolerance: r("1".repeat(257)) }, { tolerance: { numerator: 1, denominator: "2" } }]) {
    assert.throws(() => prepareStructuralFlow(pack, input));
  }
  for (const edgeId of ["unknown", "b->c"]) {
    assert.throws(() => prepareStructuralFlow(pack, { initialLengths: graph.edges.map((e, i) => ({ edgeId: i === 0 ? edgeId : e.id, length: r(1) })) }));
  }
});

test("graph, support and total history budgets fail explicitly before any solver call", () => {
  const { graph } = control("single-edge"); graph.nodes.push(...Array.from({ length: 63 }, (_, i) => ({ id: `n${i}` })));
  assert.throws(() => prepareStructuralFlow(packFor(graph)), code("LIMIT_EXCEEDED"));
  const dense = { id: "budget", nodes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}` })) };
  dense.edges = dense.nodes.flatMap((a) => dense.nodes.filter((b) => b !== a).map((b) => ({ id: `${a.id}->${b.id}`, source: a.id, target: b.id })));
  assert.equal(prepareStructuralFlow(packFor(dense), { maxIterations: 1 }).graph.edges.length, 56);
  assert.throws(() => prepareStructuralFlow(packFor(dense)), code("LIMIT_EXCEEDED"));
  dense.nodes.push({ id: "extra" });
  for (const n of dense.nodes.slice(0, 8)) dense.edges.push({ id: `extra->${n.id}`, source: "extra", target: n.id }, { id: `${n.id}->extra`, source: n.id, target: "extra" });
  assert.throws(() => prepareStructuralFlow(packFor(dense), { maxIterations: 1 }), code("LIMIT_EXCEEDED"));
  const star = { id: "support", nodes: ["u", "v", ...Array.from({ length: 17 }, (_, i) => `n${i}`)].map((id) => ({ id })),
    edges: [{ id: "u->v", source: "u", target: "v" }, ...Array.from({ length: 17 }, (_, i) => ({ id: `n${i}->u`, source: `n${i}`, target: "u" }))] };
  assert.throws(() => prepareStructuralFlow(packFor(star)), code("LIMIT_EXCEEDED"));
  assert.throws(() => prepareStructuralFlow(packFor({ id: "empty", nodes: [{ id: "a" }], edges: [] })), code("LIMIT_EXCEEDED"));
});

test("replay rejects forged certificates even when the surrounding artifact is rehashed", async () => {
  const f = (await fixtures()).find((c) => c.id === "path"); const original = await readJson("artifacts/path.json");
  for (const change of [
    (s) => { s.flow[0][0] += 1; }, (s) => { s.flow[0][0] = -1; }, (s) => { s.flow[0][0] = 0.5; },
    (s) => { s.sourcePotentials[0] = r(100); }, (s) => { s.targetPotentials[0] = r(-100); },
    (s) => { s.costNumerator = r(999); }, (s) => { s.sourcePotentials[0] = r(2, 2); },
    (s) => { s.flow.pop(); }, (s) => { s.extra = true; }
  ]) {
    const broken = structuredClone(original); change(broken.states[0].transportResponse.solutions[0]);
    const { artifactHash: _, ...body } = broken; broken.artifactHash = hashCanonical("onto2d:structural-flow-artifact:v1", body);
    assert.throws(() => verifyStructuralFlowArtifact(broken, f.pack, f.input));
  }
});

test("replay rejects changed history, false stopping, missing states, broken chains and source rebinding", async () => {
  const f = (await fixtures()).find((c) => c.id === "path"); const original = await readJson("artifacts/path.json");
  for (const change of [
    (a) => { a.states[1].edges[0].length = r(1); }, (a) => { a.states[1].summary.stableStepCount = 2; },
    (a) => { a.states[1].normalization.factor = r(1); }, (a) => { a.states[1].previousStateHash = a.states[1].stateHash; },
    (a) => { a.states[1].transportResponse.requestHash = a.states[0].transportResponse.requestHash; },
    (a) => { a.states.reverse(); }, (a) => { a.states.pop(); }, (a) => { a.states.push(a.states.at(-1)); },
    (a) => { a.termination.reason = "tolerance"; }, (a) => { a.cuts.removedEdgeIds = ["a->b"]; },
    (a) => { a.request.parameters.step = "one"; }, (a) => { a.model.modelVersion = "2"; },
    (a) => { a.request.policy.distance = "undirected"; }, (a) => { a.extra = 1; }
  ]) {
    const broken = structuredClone(original); change(broken);
    const { artifactHash: _, ...body } = broken; broken.artifactHash = hashCanonical("onto2d:structural-flow-artifact:v1", body);
    assert.throws(() => verifyStructuralFlowArtifact(broken, f.pack, f.input));
  }
  assert.throws(() => verifyStructuralFlowArtifact(original, f.pack, { ...f.input, step: "one" }));
});

test("a forged asynchronous oracle response is rejected before any next iteration", async () => {
  let calls = 0;
  const broken = createStructuralFlowAnalyzer({ ...STRUCTURAL_FLOW_SOLVER, async evaluate(request) {
    calls += 1; const response = await adapter.evaluate(request); response.solutions[0].costNumerator = r(999); return response;
  } });
  await assert.rejects(broken.analyze(packFor(control("path").graph)), code("CERTIFICATE_INVALID"));
  assert.equal(calls, 1);
});

test("engine flow is opt-in and rejects unverified or forged Model objects", async () => {
  const pack = packFor(control("path").graph); const analysis = createStructuralFlowAnalysis(adapter);
  assert.equal((await Onto2D.create({ models: [pack] })).analyses().some((a) => a.id === analysis.id), false);
  const engine = await Onto2D.create({ models: [pack], analyses: [analysis] });
  verifyStructuralFlowArtifact(await engine.analyze(analysis.id, { maxIterations: 1 }), pack, { maxIterations: 1 });
  assert.throws(() => analysis.run({ model: {} })); assert.throws(() => analysis.run({ model: Object.create(Model.prototype) }));
});

test("adapter options, process errors, deadline and bounded rational Python protocol fail explicitly", async () => {
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: 30001 }, { pythonExecutable: "" }, { extra: true }]) {
    assert.throws(() => createPythonStructuralFlowAdapter(options), code("INPUT_INVALID"));
  }
  assert.throws(() => createStructuralFlowAnalyzer({ ...adapter, version: "2" }), code("SOLVER_UNSUPPORTED"));
  let captured;
  await createStructuralFlowAnalyzer({ ...STRUCTURAL_FLOW_SOLVER, evaluate(request) { captured ??= request; return adapter.evaluate(request); } })
    .analyze(packFor(control("single-edge").graph));
  await assert.rejects(createPythonStructuralFlowAdapter({ pythonExecutable: "/does-not-exist/onto2d-python" }).evaluate(captured), code("ORACLE_FAILED"));
  await assert.rejects(createPythonStructuralFlowAdapter({ timeoutMs: 1 }).evaluate(captured), code("ORACLE_TIMEOUT"));
  await assert.rejects(adapter.evaluate({ padding: Array(1100).fill("x".repeat(1024)) }), code("LIMIT_EXCEEDED"));
  const oracle = fileURLToPath(new URL("../src/python/flow_oracle.py", import.meta.url));
  const payloads = [JSON.stringify(captured).replace('"schemaVersion":"1"', '"schemaVersion":"1","schemaVersion":"1"')];
  for (const change of [(q) => { q.problems[0].sourceMeasure[0].units = true; },
    (q) => { q.problems[0].costs[0][0] = r(-1); }, (q) => { q.problems[0].costs[0][0] = r(2, 4); },
    (q) => { q.problems[0].costs[0][0] = null; }, (q) => { q.problems[0].costs[0][0] = r("--1"); }]) {
    const copy = structuredClone(captured); change(copy); payloads.push(JSON.stringify(copy));
  }
  for (const payload of payloads) {
    const result = spawnSync("python3", ["-I", "-B", oracle], { input: payload, encoding: "utf8", timeout: 30000, maxBuffer: 1048576 });
    assert.equal(result.status, 1, result.stderr); assert.equal(result.stdout, "");
  }
  assert.equal(numeric(captured.problems[0].distance), 1);
});
