import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { runStructuralResponseSignature, verifyStructuralResponseSignature } from "@onto2d/structural-geometry/signature";
import { fixtures, readJson } from "../../../cases/structural-geometry/signatures/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));
const get = id => artifacts[examples.findIndex(f => f.id === id)];

test("closed signature schemas accept all 27 complete/incomplete artifacts and their embedded evidence", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("structuralResponseSignatureInput", f.input), true, ajv.errorsText());
    assert.equal(validate("structuralResponseSignatureArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});
test("signature input schema and runtime reject implicit profiles, caller features and arbitrary evidence", () => {
  for (const input of [{}, { regimeId: "unknown" }, { regimeId: "topology-only-v1", features: [] }, { regimeId: "topology-only-v1", evidence: {} },
    { regimeId: "topology-only-v1", scope: { kind: "induced", nodeIds: [] } },
    { regimeId: "typed-relations-v1", scope: { kind: "full", nodeIds: ["n0"] } }]) {
    assert.equal(validate("structuralResponseSignatureInput", input), false);
    assert.throws(() => runStructuralResponseSignature(examples[0].pack, input));
  }
});
test("schemas reject feature/profile substitutions, false completeness, invalid deltas and provenance coordinates", () => {
  for (const mutate of [
    a => { a.features.pop(); }, a => { a.profile.features.reverse(); }, a => { a.policy.geometry = "included"; },
    a => { a.features[0].value[0].components[0].state = "indeterminate"; }, a => { a.features[0].value[0].components[0].delta = 1; },
    a => { a.features[0].value[0].count = 0; }, a => { a.features[0].value[0].sourceEdgeId = "e0"; },
    a => { a.features[0].state = "indeterminate"; }, a => { a.features[0].reasons.push({ code: "no-eligible-targets", count: 1 }); },
    a => { a.summary.reasons.push("invariance-failed"); }, a => { a.value = null; }, a => { a.valueHash += "\n"; },
    a => { a.comparisonContext = { kind: "untyped-graph" }; }, a => { a.work.observationEvaluations = 71; },
    a => { delete a.request.scope; }, a => { a.evidence.responses.request.regimeId = "topology-only-v1"; }
  ]) { const a = structuredClone(get("diamond-feedback-typed")); mutate(a); assert.equal(validate("structuralResponseSignatureArtifact", a), false); }
});
test("incomplete feature families cannot become empty histograms, partial coordinates or complete signatures", () => {
  for (const mutate of [
    a => { a.features[0].value = []; }, a => { a.features[0].valueHash = a.artifactHash; },
    a => { a.features[0].reasons = []; }, a => { a.features[0].coverage.complete = true; },
    a => { a.summary.status = "complete"; }, a => { a.summary.coverage.complete = true; },
    a => { a.value = get("diamond-feedback-topology-only-v1").value; }, a => { a.valueHash = a.artifactHash; }
  ]) { const a = structuredClone(get("chain-topology")); mutate(a); assert.equal(validate("structuralResponseSignatureArtifact", a), false); }
  const a = structuredClone(get("missing-role")); a.summary.invarianceStatus = "passed";
  assert.equal(validate("structuralResponseSignatureArtifact", a), false);
});
test("schema represents failed invariance with complete feature coverage while replay rejects fabricated evidence", () => {
  const a = structuredClone(get("diamond-feedback-canonical-structure-v1"));
  a.evidence.invariance.runs[0].comparison.status = "failed";
  a.evidence.invariance.runs[0].comparison.components[0].state = "different";
  a.evidence.invariance.summary.status = "failed";
  a.summary.status = "indeterminate"; a.summary.invarianceStatus = "failed"; a.summary.reasons = ["invariance-failed"];
  a.value = null; a.valueHash = null;
  assert.equal(validate("structuralResponseSignatureArtifact", a), true, ajv.errorsText());
  const f = examples.find(f => f.id === "diamond-feedback-canonical-structure-v1");
  assert.throws(() => verifyStructuralResponseSignature(a, f.pack, f.input));
  a.summary.status = "complete";
  assert.equal(validate("structuralResponseSignatureArtifact", a), false);
});
test("browser verification rebuilds all 27 signature artifacts and both complete upstream evidence layers", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/signature.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Signature", write: false, logLevel: "silent" });
  const result = runInNewContext(`${bundle.outputFiles[0].text}\nconst values = JSON.parse(artifactText); JSON.stringify(JSON.parse(fixtureText).map(({pack,input},i) =>
    Signature.verifyStructuralResponseSignature(values[i],pack,input)));`,
  { artifactText: JSON.stringify(artifacts), fixtureText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(result), artifacts);
});
