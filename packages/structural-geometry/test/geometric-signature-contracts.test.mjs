import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { buildGeometricSignature } from "@onto2d/structural-geometry/geometric-signature";
import { fixtures, readJson } from "../../../cases/structural-geometry/geometric-signatures/fixtures.mjs";
const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls)) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));
const get = id => artifacts[examples.findIndex(f => f.id === id)];
test("closed geometric schemas accept all 25 complete, partial and unavailable composites with their embedded evidence", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("geometricSignatureInput", f.input), true, ajv.errorsText());
    assert.equal(validate("geometricSignatureArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});
test("input schemas and runtime require explicit layer slots and reject numerical or scope overrides", () => {
  const f = examples[0];
  for (const input of [{}, { forman: null, flow: null }, { ...f.input, weights: [] }, { ...f.input, bins: [] },
    { ...f.input, flow: { maxIterations: 25 } }, { ...f.input, ollivier: { edgeIds: [] } },
    { ...f.input, forman: { analysis: "structural-geometry", metricProviderId: "inverse-target-share-v1" } }]) {
    assert.equal(validate("geometricSignatureInput", input), false);
    assert.throws(() => buildGeometricSignature(f.pack, input, { ollivier: null, flow: null }));
  }
});
test("schemas reject invented certainty, malformed distributions, false completeness, unknown profiles and invalid future frames", () => {
  for (const mutate of [a => { a.features.pop(); }, a => { a.features.reverse(); }, a => { a.policy.alignment = "pad-zero"; },
    a => { a.features[0].value.distribution[0].count = 0; }, a => { a.features[0].value.distribution[0].value.lower.numerator += "\n"; },
    a => { a.features[0].value.distribution[0].value.midpoint = 0; }, a => { a.features[0].value.minimum.possibleRoles[0].value.edgeId = "x"; },
    a => { a.features[0].value.signs.unresolved = 1; }, a => { a.features[1].state = "unavailable"; },
    a => { a.features[2].value.frames[0].value = null; }, a => { a.features[2].value.frames[0].reason = "after-fixed-point"; },
    a => { a.features[2].value.termination.reason = "converged"; }, a => { a.profile.flow.parameters.step = "adaptive"; },
    a => { a.request.forman = null; }, a => { a.summary.coverage.numerator = 0; }, a => { a.features[0].valueHash += "\n"; }]) {
    const a = structuredClone(get("path")); mutate(a); assert.equal(validate("geometricSignatureArtifact", a), false, mutate.toString());
  }
  for (const id of ["single-edge", "partial-ollivier", "missing-evidence", "weighted-isolated"]) {
    const a = structuredClone(get(id)); a.summary.status = "complete";
    assert.equal(validate("geometricSignatureArtifact", a), false);
  }
});
test("browser replay verifies all 25 signatures and their source-bound transport certificates without an external solver", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/geometric-signature.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Geometry", write: false, logLevel: "silent" });
  const result = runInNewContext(`${bundle.outputFiles[0].text}\nconst values=JSON.parse(artifactText); JSON.stringify(JSON.parse(fixtureText).map(({pack,input},i)=>
    Geometry.verifyGeometricSignature(values[i],pack,input,{ollivier:values[i].evidence.ollivier,flow:values[i].evidence.flow})));`,
  { fixtureText: JSON.stringify(examples), artifactText: JSON.stringify(artifacts), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(result), artifacts);
});
