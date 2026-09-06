import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { canonicalizeCandidate as rootCanonicalize } from "@onto2d/kernel";
import { canonicalizeCandidate as portableCanonicalize } from "@onto2d/kernel/graph-canonicalizer";
import { observeCanonicalStructure } from "@onto2d/structural-geometry/canonical";
import { fixtures, packFor, input, readJson } from "../../../cases/structural-geometry/canonical/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);

test("closed canonical contracts accept every measured fixture and its preserved preparation", async () => {
  for (const f of await fixtures()) {
    const a = await readJson(`artifacts/${f.id}.json`);
    assert.equal(validate("structuralCanonicalInput", f.input), true, ajv.errorsText());
    assert.equal(validate("structuralCanonicalObservation", a), true, ajv.errorsText());
    assert.equal(validate("structuralRegimePreparation", a.preparation), true, ajv.errorsText());
  }
});

test("canonical schemas reject invalid endpoint ranges, loops, duplicate arcs, altered regimes and fabricated comparison fields", () => {
  const original = observeCanonicalStructure(packFor({ id: "schema-control", nodes: 3, edges: [[0, 1], [0, 2]] }), input);
  for (const change of [
    (a) => { a.observation.value.nodeCount = 0; }, (a) => { a.observation.value.edges[0].from = 3; },
    (a) => { a.observation.value.edges[0].to = a.observation.value.edges[0].from; },
    (a) => { a.observation.value.edges.push(a.observation.value.edges[0]); },
    (a) => { a.observation.value.edges[0].from = 0.5; }, (a) => { a.witness.nodes[0].canonicalNode = -1; },
    (a) => { a.witness.statistics.searchStates = 100001; }, (a) => { a.observation.regime.contentHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.preparation.request.regimeId = "topology-only-v1"; }, (a) => { a.implementation.attributes = "included"; },
    (a) => { delete a.preparation.context.model.manifestHash; }, (a) => { a.observation.valueHash = "self-asserted"; },
    (a) => { a.evaluation = "not-run"; }, (a) => { a.preparation.evaluation = "measured"; },
    (a) => { a.status = "indistinguishable-under-regime"; }, (a) => { a.distance = 0; }
  ]) { const a = structuredClone(original); change(a); assert.equal(validate("structuralCanonicalObservation", a), false); }
});

test("schema and runtime both require the implemented exact regime and reject partial or unbounded requests", () => {
  const source = packFor({ id: "input-control", nodes: 2, edges: [[0, 1]] });
  for (const request of [{}, { regimeId: "topology-only-v1" }, { regimeId: "typed-relations-v1" },
    { ...input, maxSearchStates: 1 }, { ...input, threshold: 0.01 }, { ...input, scope: null },
    { ...input, scope: { kind: "induced", nodeIds: ["n0", "n0"] } },
    { ...input, scope: { kind: "induced", nodeIds: Array.from({ length: 7 }, (_, i) => `n${i}`) } }]) {
    assert.equal(validate("structuralCanonicalInput", request), false);
    assert.throws(() => observeCanonicalStructure(source, request));
  }
});

test("browser computation and exact source replay reproduce all 17 canonical observations", async () => {
  assert.equal(portableCanonicalize, rootCanonicalize);
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/canonical.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Canonical", write: false, logLevel: "silent" });
  const examples = await fixtures();
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(JSON.parse(fixturesText).map(({pack,input}) => {
    const a = Canonical.observeCanonicalStructure(pack, input);
    return Canonical.verifyCanonicalStructureObservation(a, pack, input);
  }));`, { fixturesText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), await Promise.all(examples.map((f) => readJson(`artifacts/${f.id}.json`))));
});
