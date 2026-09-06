import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { schemaUrls } from "@onto2d/schemas";
import { STRUCTURAL_FLOW_SOLVER, createStructuralFlowAnalyzer, prepareStructuralFlow,
  verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { packFor, rational as r } from "../../../cases/structural-geometry/flow/fixtures.mjs";
import { fixtures, readJson, PROTOCOL_SHA256 } from "../../../cases/structural-geometry/flow-controls/fixtures.mjs";

const inputs = await fixtures();
const bridge = inputs.find((f) => f.graphId === "two-k4-single-bridge");
const load = (f) => readJson(`artifacts/${f.id}.json`);
const value = (x) => [BigInt(x.numerator), BigInt(x.denominator)];
const greater = (a, b) => { const [an, ad] = value(a); const [bn, bd] = value(b); return an * bd > bn * ad; };

test("directed stars preserve unequal normalized lengths across all step/idleness combinations", async () => {
  const stars = inputs.filter((f) => f.graphId.endsWith("-star"));
  assert.equal(new Set(stars.map((f) => `${f.graphId}/${f.input.step}/${f.input.idleness}`)).size, 8);
  for (const f of stars) {
    const a = await load(f);
    assert.equal(a.states.length, 2);
    assert.equal(a.termination.reason, "fixed-point");
    assert.equal(a.termination.iteration, 1);
    for (const state of a.states) {
      assert.deepEqual(state.summary.lengthSum, r(4));
      assert.deepEqual(state.summary.signs, { negative: 0, zero: 4, positive: 0 });
      for (const edge of state.edges) {
        const leaf = edge.id.match(/leaf-([1-4])/)[1];
        assert.deepEqual(edge.length, r(2 * Number(leaf), 5));
        assert.deepEqual(edge.wasserstein, edge.length);
        assert.deepEqual(edge.curvature, r(0));
      }
    }
    assert.deepEqual(a.cuts.removedEdgeIds, []);
    assert.equal(a.cuts.weakComponents.length, 1);
    assert.equal(a.cuts.strongComponents.length, 5);
  }
});

test("single bridge follows exact first-step anchors and separates the two declared K4 groups at the fixed cap", async () => {
  const a = await load(bridge);
  assert.equal(a.request.graph.nodes.length, 8);
  assert.equal(a.request.graph.edges.length, 26);
  assert.equal(a.states.length, 17);
  assert.equal(a.termination.reason, "iteration-limit");
  assert.equal(a.termination.iteration, 16);
  for (const edge of a.states[1].edges) {
    const [source, target] = edge.id.split("->");
    const expected = source[0] !== target[0] ? r(26, 7) : source[1] === "0" || target[1] === "0" ? r(13, 14) : r(13, 21);
    assert.deepEqual(edge.length, expected);
  }
  for (const state of a.states) {
    assert.deepEqual(state.summary.lengthSum, r(26));
    assert.deepEqual(state.normalization.shortenedEdgeIds, []);
    const edges = new Map(state.edges.map((e) => [e.id, e]));
    for (const edge of state.edges) {
      const [source, target] = edge.id.split("->");
      const reverse = edges.get(`${target}->${source}`);
      for (const key of ["length", "wasserstein", "curvature"]) assert.deepEqual(edge[key], reverse[key]);
    }
  }
  const final = a.states.at(-1);
  assert.deepEqual(final.edges.filter((e) => greater(e.length, r(2))).map((e) => e.id), ["a0->b0", "b0->a0"]);
  assert.deepEqual(a.cuts.removedEdgeIds, ["a0->b0", "b0->a0"]);
  const groups = [["a0", "a1", "a2", "a3"], ["b0", "b1", "b2", "b3"]];
  assert.deepEqual(a.cuts.weakComponents, groups);
  assert.deepEqual(a.cuts.strongComponents, groups);
});

test("all supplemental histories bind the source/input, replay certificates and satisfy existing closed schemas", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const ids = new Map();
  for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural"))) {
    const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
  }
  const validate = (name, data) => assert.equal(ajv.validate(ids.get(`structuralFlow${name}`), data), true, ajv.errorsText());
  const suite = await readJson("suite.json");
  assert.equal(suite.protocolSha256, PROTOCOL_SHA256);
  assert.deepEqual(suite.runs.map((run) => run.id), inputs.map((f) => f.id));
  for (const f of inputs) {
    const sourceBefore = JSON.stringify(f.pack); const inputBefore = JSON.stringify(f.input);
    const artifact = await load(f);
    validate("Input", f.input); validate("Request", artifact.request); validate("Artifact", artifact);
    assert.deepEqual(prepareStructuralFlow(f.pack, f.input), artifact.request);
    let iteration = 0;
    const analyzer = createStructuralFlowAnalyzer({ ...STRUCTURAL_FLOW_SOLVER, evaluate(request) {
      validate("TransportRequest", request);
      const state = artifact.states[iteration++];
      validate("State", state); validate("TransportResponse", state.transportResponse);
      return state.transportResponse;
    } });
    assert.deepEqual(await analyzer.analyze(f.pack, f.input), artifact);
    assert.doesNotThrow(() => verifyStructuralFlowArtifact(artifact, f.pack, f.input));
    assert.equal(JSON.stringify(f.pack), sourceBefore);
    assert.equal(JSON.stringify(f.input), inputBefore);
  }
});

test("supplemental verifier rejects changed input, changed source, altered optimality evidence and cut membership", async () => {
  const a = await load(bridge);
  for (const input of [
    { ...bridge.input, step: "half" }, { ...bridge.input, idleness: "half" },
    { ...bridge.input, maxIterations: 15 }, { ...bridge.input, cut: { kind: "none" } }
  ]) assert.throws(() => verifyStructuralFlowArtifact(a, bridge.pack, input));
  const graph = structuredClone(bridge.graph);
  graph.edges.push({ id: "a1->b1", source: "a1", target: "b1" });
  assert.throws(() => verifyStructuralFlowArtifact(a, packFor(graph), bridge.input));
  for (const mutate of [
    (x) => { x.states[1].edges[0].length = r(1); },
    (x) => { x.states[2].transportResponse.solutions[0].flow[0][0] += 1; },
    (x) => { x.states[3].transportResponse.solutions[0].sourcePotentials[0] = r(100); },
    (x) => { x.cuts.removedEdgeIds = []; },
    (x) => { x.cuts.weakComponents[0].push("b0"); },
    (x) => { x.termination.reason = "tolerance"; }
  ]) {
    const broken = structuredClone(a); mutate(broken);
    assert.throws(() => verifyStructuralFlowArtifact(broken, bridge.pack, bridge.input));
  }
});

test("strict bridge cut retains equality and never feeds back into the flow or source", async () => {
  const analyzer = createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
  const sourceBefore = JSON.stringify(bridge.pack);
  const input = { ...bridge.input, maxIterations: 1 };
  const separated = await analyzer.analyze(bridge.pack, input);
  const retained = await analyzer.analyze(bridge.pack, { ...input, cut: { kind: "final-length", threshold: r(26, 7) } });
  const uncut = await analyzer.analyze(bridge.pack, { ...input, cut: { kind: "none" } });
  assert.deepEqual(separated.cuts.removedEdgeIds, ["a0->b0", "b0->a0"]);
  for (const artifact of [retained, uncut]) {
    assert.deepEqual(artifact.cuts.removedEdgeIds, []);
    assert.equal(artifact.cuts.weakComponents.length, 1);
    // Input-bound hashes differ, but every computed metric and stopping event agrees.
    assert.deepEqual(artifact.states.map((s) => s.edges), separated.states.map((s) => s.edges));
    assert.deepEqual(artifact.termination, separated.termination);
  }
  assert.equal(JSON.stringify(bridge.pack), sourceBefore);
});
