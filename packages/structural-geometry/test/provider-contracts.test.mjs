import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS, createStructuralMetricContext, buildStructuralProvider,
  analyzeStructuralGeometryWithProvider } from "@onto2d/structural-geometry/providers";
import { examplePack, examples, readJson } from "../../../cases/structural-geometry/providers/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }); const ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural"))) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const source = await examplePack();

test("closed provider schemas cover every descriptor, context, example and legacy envelope", async () => {
  for (const d of STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS) assert.equal(validate("structuralProviderDescriptor", d), true, ajv.errorsText());
  assert.equal(validate("structuralMetricContext", createStructuralMetricContext(source).binding), true, ajv.errorsText());
  for (const example of examples) {
    const prefix = example.type === "provider" ? "structuralProvider" : "structuralProviderAnalysis";
    const a = await readJson(`artifacts/${example.id}.json`);
    assert.equal(validate(`${prefix}Input`, example.input), true, ajv.errorsText());
    assert.equal(validate(`${prefix}Artifact`, a), true, ajv.errorsText());
    const replay = example.type === "provider" ? buildStructuralProvider(source, example.input) : analyzeStructuralGeometryWithProvider(source, example.input);
    assert.deepEqual(a, replay);
  }
});

test("provider schemas reject malformed numerics, identities, context rules and incompatible shapes", async () => {
  const original = await readJson("artifacts/inverse-share.json");
  for (const mutate of [
    (a) => { a.schemaVersion = "2"; }, (a) => { delete a.context.model.manifestHash; },
    (a) => { a.context.normalizationContext = "selected-only"; }, (a) => { a.context.dictionaryHash = "local"; },
    (a) => { a.provider.id = "declared-weight-v1"; }, (a) => { a.provider.limits.maxViews = 33; },
    (a) => { a.provider.capabilities = ["nested-edge-views"]; },
    (a) => { a.request.providerId = "necessity-filtration-v1"; }, (a) => { a.request.parameters = { extra: true }; },
    (a) => { a.result.edges[0].length.numerator = "0"; }, (a) => { a.result.edges[0].weight.denominator = "0"; },
    (a) => { a.result.nodes[0].weight.numerator = "-1"; }, (a) => { a.result.extra = true; },
    (a) => { a.result = { kind: "channels", channels: [] }; }, (a) => { a.extra = true; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralProviderArtifact", a), false); }
  const filtration = await readJson("artifacts/necessity.json");
  const missingStage = structuredClone(filtration); missingStage.result.stages.pop();
  assert.equal(validate("structuralProviderArtifact", missingStage), false);
  const envelope = await readJson("artifacts/unit-analysis.json"); envelope.metricArtifact = filtration;
  assert.equal(validate("structuralProviderAnalysisArtifact", envelope), false);
});

test("analysis request schemas and runtime both reject unsupported metric consumers and missing explicit identities", () => {
  for (const request of [
    {}, { analysis: "structural-geometry" }, { analysis: "structural-geometry", metricProviderId: "inverse-target-share-v1" },
    { analysis: "structural-geometry", metricProviderId: "unit-v1", selection: { kind: "all" } },
    { analysis: "structural-flow", metricProviderId: "unit-v1" },
    { analysis: "structural-metric-experiment", metricProviderId: "typed-channel-v1" },
    { analysis: "structural-metric-experiment", metricProviderId: "unit-v1", selection: null }
  ]) {
    assert.equal(validate("structuralProviderAnalysisInput", request), false);
    assert.throws(() => analyzeStructuralGeometryWithProvider(source, request));
  }
});

test("browser builds and verifies all provider families and both legacy envelopes with identical hashes", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/providers.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Providers", write: false, logLevel: "silent" });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(JSON.parse(exampleText).map((e) => {
    const pack = JSON.parse(packText);
    if (e.type === "provider") {
      const context = Providers.createStructuralMetricContext(pack);
      const artifact = Providers.createStructuralMetricProvider(e.input.providerId).build(context.projection, context, e.input.parameters);
      return Providers.verifyStructuralProviderArtifact(artifact, pack, e.input);
    }
    const artifact = Providers.analyzeStructuralGeometryWithProvider(pack, e.input);
    return Providers.verifyStructuralProviderAnalysis(artifact, pack, e.input);
  }));`, { packText: JSON.stringify(source), exampleText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), await Promise.all(examples.map((e) => readJson(`artifacts/${e.id}.json`))));
});
