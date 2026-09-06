import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { observeStructuralTopology } from "@onto2d/structural-geometry/topology";
import { fixtures, packFor, input, readJson } from "../../../cases/structural-geometry/topology/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);

test("closed topology schemas accept every measured fixture and its unchanged preparation", async () => {
  for (const f of await fixtures()) {
    const a = await readJson(`artifacts/${f.id}.json`);
    assert.equal(validate("structuralTopologyInput", f.input), true, ajv.errorsText());
    assert.equal(validate("structuralTopologyObservation", a), true, ajv.errorsText());
    assert.equal(validate("structuralRegimePreparation", a.preparation), true, ajv.errorsText());
  }
});

test("topology schemas reject unknown fields, invalid counts and vectors, changed contracts and comparison claims", () => {
  const original = observeStructuralTopology(packFor({ id: "schema-control", nodes: 3, edges: [[0, 1], [0, 2]] }), input);
  for (const change of [
    (a) => { a.observation.value.nodeCount = 0; }, (a) => { a.observation.value.nodeCount = 65; },
    (a) => { a.observation.value.edgeCount = 257; }, (a) => { a.observation.value.edgeCount = 0.5; },
    (a) => { a.observation.value.reachableOrderedPairCount = 4033; }, (a) => { a.observation.value.cyclicNodeCount = -1; },
    (a) => { a.observation.value.weakComponentSizes = []; }, (a) => { a.observation.value.weakComponentSizes = [0]; },
    (a) => { a.observation.value.strongComponentSizes = [65]; }, (a) => { delete a.observation.value.isolatedNodeCount; },
    (a) => { a.observation.observables.reverse(); }, (a) => { a.observation.observables.pop(); },
    (a) => { a.observation.valueHash = "unverified"; }, (a) => { a.observation.value.extra = 1; },
    (a) => { a.diagnostics.strongComponents[0].push(a.diagnostics.strongComponents[0][0]); },
    (a) => { a.diagnostics.reachablePairsBySource[0].count = 64; },
    (a) => { a.diagnostics.work.reachabilityPairVisits = 4097; }, (a) => { a.diagnostics.work.reachabilityEdgeScans = 16385; },
    (a) => { a.preparation.request.regimeId = "canonical-structure-v1"; }, (a) => { a.implementation.attributes = "included"; },
    (a) => { a.evaluation = "not-run"; }, (a) => { a.preparation.evaluation = "measured"; },
    (a) => { a.status = "indistinguishable-under-regime"; }, (a) => { a.distance = 0; }
  ]) { const a = structuredClone(original); change(a); assert.equal(validate("structuralTopologyObservation", a), false); }
});

test("topology schema and runtime require explicit selection and reject thresholds or partial requests", () => {
  const source = packFor({ id: "input-control", nodes: 2, edges: [[0, 1]] });
  for (const request of [{}, { regimeId: "canonical-structure-v1" }, { regimeId: "typed-relations-v1" },
    { ...input, maxReachabilityPairVisits: 1 }, { ...input, threshold: 0.01 }, { ...input, scope: null },
    { ...input, scope: { kind: "induced", nodeIds: ["n0", "n0"] } },
    { ...input, scope: { kind: "induced", nodeIds: Array.from({ length: 65 }, (_, i) => `n${i}`) } }]) {
    assert.equal(validate("structuralTopologyInput", request), false);
    assert.throws(() => observeStructuralTopology(source, request));
  }
});

test("browser computation and expected-source verification reproduce all 23 topology observations", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/topology.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Topology", write: false, logLevel: "silent" });
  const examples = await fixtures();
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(JSON.parse(fixturesText).map(({pack,input}) => {
    const a = Topology.observeStructuralTopology(pack, input);
    return Topology.verifyStructuralTopologyObservation(a, pack, input);
  }));`, { fixturesText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), await Promise.all(examples.map((f) => readJson(`artifacts/${f.id}.json`))));
});
