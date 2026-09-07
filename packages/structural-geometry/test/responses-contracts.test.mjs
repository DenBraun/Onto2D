import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { runStructuralResponseProbes } from "@onto2d/structural-geometry/responses";
import { fixtures, readJson } from "../../../cases/structural-geometry/responses/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));
const artifact = id => artifacts[examples.findIndex(f => f.id === id)];

test("closed response schemas accept every request, path target, rejection, missing selector and measured outcome", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("structuralResponseInput", f.input), true, `${f.id}: ${ajv.errorsText()}`);
    assert.equal(validate("structuralResponseArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});

test("schema and runtime reject probe subsets, arbitrary targets, callbacks and invalid regime scopes", () => {
  const f = examples[0];
  for (const request of [{}, { ...f.input, probeIds: [] }, { ...f.input, targets: ["e0"] }, { ...f.input, regimeId: "unknown" },
    { ...f.input, scope: { kind: "full", limit: 1 } }, { ...f.input, scope: { kind: "induced", nodeIds: [] } },
    { ...f.input, scope: { kind: "induced", nodeIds: ["n0", "n0"] } }, { ...f.input, transform: "callback" }]) {
    assert.equal(validate("structuralResponseInput", request), false); assert.throws(() => runStructuralResponseProbes(f.pack, request));
  }
});

test("schemas reject registry, profile, target, delta, histogram and coverage contradictions", () => {
  const original = artifact("diamond-topology");
  for (const mutate of [
    a => { a.policy.selection = "sampled"; }, a => { a.registry.probes.pop(); }, a => { a.profile.probeIds.reverse(); },
    a => { a.probes.pop(); }, a => { a.probes[2].runs[0].target.sourceNodeIds = ["n0", "n1", "n0"]; },
    a => { a.probes[2].runs[0].target.shadowEdgeIds = []; }, a => { a.probes[1].runs[0].target.kind = "simple-directed-path"; },
    a => { a.probes[2].runs[0].response.components[1].delta = 0; }, a => { a.probes[2].runs[0].response.components[2].delta = 1; },
    a => { a.probes[2].runs[0].response.status = "unchanged"; }, a => { a.probes[2].summary.diagnostics.effectHistogram[0].count = 0; },
    a => { a.summary.status = "observed"; }, a => { a.summary.coverage.complete = true; },
    a => { a.work.selection.edgeScans = 131073; }, a => { a.work.observationEvaluations = 66; },
    a => { a.baseline.graph.graphHash += "\n"; }, a => { a.distance = 0; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralResponseArtifact", a), false); }
});

test("rejected and unresolved probes cannot carry invented observations, complete coverage or a partial target set", () => {
  const rejected = artifact("mixed-topology");
  for (const mutate of [
    a => { a.probes[1].runs[0].observation = a.baseline.observation; }, a => { a.probes[1].runs[0].graph = a.baseline.graph; },
    a => { a.probes[1].runs[0].response = a.probes[1].runs[2].response; }, a => { a.probes[1].summary.status = "observed"; }
  ]) { const a = structuredClone(rejected); mutate(a); assert.equal(validate("structuralResponseArtifact", a), false); }
  const unresolved = artifact("missing-necessity");
  for (const mutate of [
    a => { a.probes[1].selection.unknownSourceEdgeIds = []; }, a => { a.probes[1].execution.reason = "no-eligible-targets"; },
    a => { a.probes[1].runs = [a.probes[0].runs[0]]; }, a => { a.probes[1].summary.coverage.complete = true; },
    a => { a.baseline.observation.observations[1].valueHash = a.artifactHash; }, a => { a.baseline.observation.observations[1].missing = []; }
  ]) { const a = structuredClone(unresolved); mutate(a); assert.equal(validate("structuralResponseArtifact", a), false); }
});

test("browser verification reproduces all 16 source-bound response artifacts including the 64-target boundary", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/responses.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Responses", write: false, logLevel: "silent" });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nconst expected = JSON.parse(artifactsText); JSON.stringify(JSON.parse(fixturesText).map(({pack,input}, i) =>
    Responses.verifyStructuralResponseProbes(expected[i],pack,input)));`,
  { fixturesText: JSON.stringify(examples), artifactsText: JSON.stringify(artifacts), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), artifacts);
});
