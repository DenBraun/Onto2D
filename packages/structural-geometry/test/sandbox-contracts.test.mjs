import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { runStructuralProbeSandbox } from "@onto2d/structural-geometry/sandbox";
import { fixtures, readJson } from "../../../cases/structural-geometry/sandbox/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));

test("closed sandbox schemas accept every request and all applied, rejected, unavailable and bounded-work artifacts", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("structuralProbeSandboxInput", f.input), true, `${f.id}: ${ajv.errorsText()}`);
    assert.equal(validate("structuralProbeSandboxArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});

test("sandbox schema and runtime reject undeclared regimes, callbacks, scopes and source-ID selection", () => {
  const { pack, input } = examples[0];
  for (const request of [{}, { ...input, seed: 42 }, { ...input, regimeId: "unknown" }, { ...input, scope: { kind: "induced", nodeIds: [] } },
    { ...input, scope: { kind: "induced", nodeIds: Array.from({ length: 7 }, (_, i) => `n${i}`) } },
    ...[null, {}, { kind: "remove-edges", targets: ["e0"] }, { kind: "identity", targets: "all-scoped-edges" },
      { kind: "reverse-edges", targets: "each-scoped-edge", limit: 1 }].map(transformation => ({ ...input, transformation }))]) {
    assert.equal(validate("structuralProbeSandboxInput", request), false); assert.throws(() => runStructuralProbeSandbox(pack, request));
  }
});

test("sandbox schemas reject changed policies, false observation claims and invalid graph/type/source records", () => {
  const original = artifacts[examples.findIndex(f => f.id === "reciprocal-identity")];
  for (const mutate of [
    a => { a.policy.codeExecution = "callbacks"; }, a => { a.observationEvaluation = "measured"; },
    a => { a.baseline.graph.kind = "model-pack"; }, a => { a.baseline.graph.source.scopeHash += "\n"; },
    a => { a.baseline.graph.nodes[0].id = "n999"; }, a => { a.baseline.graph.edges[0].id = "e256"; },
    a => { a.baseline.graph.edges[0].types.necessity = "unknown"; }, a => { a.baseline.graph.edges[0].types.interactionModeIds = [0, 0]; },
    a => { a.baseline.graph.edges[0].types.weight = 1; }, a => { a.baseline.mapping.nodes[0].sourceNodeId = ""; },
    a => { a.runs[0].graph = null; }, a => { a.runs[0].edgeMapping[0].action = "removed"; },
    a => { a.runs[0].edgeMapping[0].afterEdgeId = null; }, a => { a.execution.targetCount = 33; },
    a => { a.work.transformationEdgeVisits = 1025; }, a => { a.distance = 0; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralProbeSandboxArtifact", a), false); }
});

test("rejected targets and empty selections cannot carry invented output graphs or counts", () => {
  const rejected = artifacts[examples.findIndex(f => f.id === "reciprocal-reverse-each")];
  for (const mutate of [
    a => { a.runs[0].graph = a.baseline.graph; }, a => { a.runs[0].changes = { removedSourceEdgeIds: [], reversedSourceEdgeIds: [] }; },
    a => { a.runs[0].rejection = null; }, a => { a.runs[0].rejection.sourceEdgeIds = ["e0"]; },
    a => { a.runs[0].execution = "applied"; }, a => { a.runs[0].transformation.kind = "remove-edges"; }
  ]) { const a = structuredClone(rejected); mutate(a); assert.equal(validate("structuralProbeSandboxArtifact", a), false); }
  const empty = artifacts[examples.findIndex(f => f.id === "isolates-remove-all")];
  for (const mutate of [a => { a.execution.state = "completed"; }, a => { a.execution.appliedCount = 1; },
    a => { a.runs = [rejected.runs[0]]; }, a => { a.selection.eligibleSourceEdgeIds = ["e0"]; }, a => { a.work.outputGraphCount = 2; }]) {
    const a = structuredClone(empty); mutate(a); assert.equal(validate("structuralProbeSandboxArtifact", a), false);
  }
});

test("opaque source IDs and explicit induced scopes agree across runtime and schema", () => {
  const f = examples.find(f => f.id === "opaque-reverse-each");
  const input = { ...f.input, scope: { kind: "induced", nodeIds: ["right\n", " left "] } };
  assert.equal(validate("structuralProbeSandboxInput", input), true, ajv.errorsText());
  assert.equal(validate("structuralProbeSandboxArtifact", runStructuralProbeSandbox(f.pack, input)), true, ajv.errorsText());
});

test("the browser bundle reproduces and verifies all 51 source-bound sandbox artifacts", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/sandbox.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Sandbox", write: false, logLevel: "silent" });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(JSON.parse(fixturesText).map(({pack,input}) =>
    Sandbox.verifyStructuralProbeSandbox(Sandbox.runStructuralProbeSandbox(pack,input),pack,input)));`,
  { fixturesText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), artifacts);
});
