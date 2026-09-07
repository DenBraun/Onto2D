import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { runStructuralInvarianceProbes } from "@onto2d/structural-geometry/invariance";
import { fixtures, readJson } from "../../../cases/structural-geometry/invariance/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));

test("closed invariance schemas accept all regimes, boundary scopes, complete and missing results", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("structuralInvarianceInput", f.input), true, `${f.id}: ${ajv.errorsText()}`);
    assert.equal(validate("structuralInvarianceArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});

test("input schema and runtime reject probe selection, extra options and invalid scopes", () => {
  const f = examples[0];
  for (const request of [{}, { ...f.input, probes: [] }, { ...f.input, seed: 0 }, { ...f.input, regimeId: "other" },
    { ...f.input, scope: { kind: "induced", nodeIds: [] } }, { ...f.input, scope: { kind: "induced", nodeIds: ["n0", "n0"] } },
    { ...f.input, scope: { kind: "full", limit: 1 } }, { ...f.input, scope: { kind: "induced", nodeIds: Array(7).fill(0).map((_, i) => `n${i}`) } }]) {
    assert.equal(validate("structuralInvarianceInput", request), false); assert.throws(() => runStructuralInvarianceProbes(f.pack, request));
  }
});

test("artifact schema rejects false registries, missing probes, profile substitution and invalid aggregate states", () => {
  const original = artifacts[0];
  // Failure is a valid scientific outcome in the schema. Only source-bound
  // replay can establish whether these claimed measured values are authentic.
  const failed = structuredClone(original);
  failed.runs[0].comparison.components[0].state = "different";
  failed.runs[0].comparison.status = "failed"; failed.summary.status = "failed";
  assert.equal(validate("structuralInvarianceArtifact", failed), true, ajv.errorsText());
  for (const mutate of [
    a => { a.registry.probes.pop(); }, a => { a.policy.targets = "selected"; }, a => { a.adapter.presentation = "included"; },
    a => { a.runs.pop(); }, a => { a.runs.reverse(); }, a => { a.baseline.observation.observations[0].observable.id = "edge-count-v1"; },
    a => { a.baseline.observation.observations[0].value.edges[0].from = 6; }, a => { a.runs[0].mapping.nodes[0].sourceNodeId = ""; },
    a => { a.runs[0].comparison.status = "failed"; }, a => { a.runs[0].comparison.coverage.denominator = 0; },
    a => { a.runs[0].payloadChanged = false; }, a => { a.summary.status = "indeterminate"; }, a => { a.summary.coverage.numerator = 0; },
    a => { a.work.canonicalizerCalls = 11; }, a => { a.distance = 0; }, a => { a.runs[0].representation.payloadHash += "\n"; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralInvarianceArtifact", a), false); }
});

test("missing typed observations cannot acquire values, empty reasons, full coverage or passing statuses", () => {
  const original = artifacts[examples.findIndex(f => f.id === "missing")];
  const difference = structuredClone(original); difference.runs[0].comparison.components[0].state = "different";
  assert.equal(validate("structuralInvarianceArtifact", difference), true, ajv.errorsText());
  for (const mutate of [
    a => { a.baseline.observation.observations[1].missing = []; }, a => { a.baseline.observation.observations[1].valueHash = a.artifactHash; },
    a => { a.baseline.observation.observations[1].value = { nodeCount: 1, edges: [] }; },
    a => { a.runs[0].comparison.status = "passed"; }, a => { a.runs[0].comparison.coverage.numerator = 2; },
    a => { a.summary.status = "passed"; }, a => { a.summary.coverage.numerator = 8; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralInvarianceArtifact", a), false); }
});

test("browser execution reproduces and verifies all 13 exact payloads, mappings and measured artifacts", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/invariance.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Invariance", write: false, logLevel: "silent" });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(JSON.parse(fixturesText).map(({pack,input}, i) =>
    Invariance.verifyStructuralInvarianceProbes(JSON.parse(artifactsText)[i],pack,input)));`,
  { fixturesText: JSON.stringify(examples), artifactsText: JSON.stringify(artifacts), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), artifacts);
});
