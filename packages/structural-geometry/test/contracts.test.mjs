import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { buildModelPack } from "@onto2d/model-pack";
import {
  SOURCE_PARENT_DIRECTED_POLICY,
  UNIT_METRIC_POLICY,
  analyzeStructuralGeometry,
  projectStructuralGeometry
} from "@onto2d/structural-geometry";

const names = ["structuralProjectionPolicy", "structuralMetricPolicy", "structuralProjection",
  "structuralGeometryRequest", "structuralGeometryArtifact"];
const ajv = new Ajv2020({ allErrors: true, strict: false });
const ids = new Map();
for (const name of names) {
  const schema = JSON.parse(await readFile(schemaUrls[name], "utf8"));
  ajv.addSchema(schema);
  ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const singlePack = buildModelPack({
  model: { id: "geometry-contract", name: "Contract control", version: "1" },
  source: { id: "declared-control", files: [] },
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [{ id: "e", source: "a", target: "b", relationLayer: "source-parent" }],
  dictionaries: {}
});

test("closed schema policies agree with runtime constants and reject silent metric changes", () => {
  assert.equal(validate("structuralProjectionPolicy", SOURCE_PARENT_DIRECTED_POLICY), true, ajv.errorsText());
  assert.equal(validate("structuralMetricPolicy", UNIT_METRIC_POLICY), true, ajv.errorsText());
  assert.equal(validate("structuralProjectionPolicy", { ...SOURCE_PARENT_DIRECTED_POLICY, direction: "symmetrized" }), false);
  assert.equal(validate("structuralProjectionPolicy", { ...SOURCE_PARENT_DIRECTED_POLICY, includeQuantization: false }), false);
  assert.equal(validate("structuralMetricPolicy", { ...UNIT_METRIC_POLICY, edgeWeight: 0.5 }), false);
  assert.equal(validate("structuralMetricPolicy", { ...UNIT_METRIC_POLICY, extra: true }), false);
  assert.equal(validate("structuralGeometryRequest", {}), true);
  assert.equal(validate("structuralGeometryRequest", { metricPolicyId: "unit-v1", projectionPolicyId: "source-parent-directed-v1" }), true);
  for (const request of [{ metricPolicyId: "weighted" }, { projectionPolicyId: "causal-directed-v1" }, { scope: "local" }, { metricPolicyId: null }]) {
    assert.equal(validate("structuralGeometryRequest", request), false);
  }
});

test("schemas cover synthetic, isolated and full-model artifacts and projections", async () => {
  const emptyEdges = structuredClone(singlePack);
  const isolated = buildModelPack({
    model: emptyEdges.manifest.model, source: emptyEdges.manifest.source,
    nodes: [{ id: "isolated" }], edges: [], dictionaries: {}
  });
  for (const pack of [singlePack, isolated]) {
    assert.equal(validate("structuralProjection", projectStructuralGeometry(pack)), true, ajv.errorsText());
    assert.equal(validate("structuralGeometryArtifact", analyzeStructuralGeometry(pack)), true, ajv.errorsText());
  }
  for (const [name, filename] of [["structuralProjection", "projection"], ["structuralGeometryArtifact", "artifact"]]) {
    const value = JSON.parse(await readFile(new URL(`../../../cases/structural-geometry/causal-emergence/${filename}.json`, import.meta.url), "utf8"));
    assert.equal(validate(name, value), true, ajv.errorsText());
  }
});

test("artifact schemas reject incomplete identity and malformed exact summaries", () => {
  const artifact = analyzeStructuralGeometry(singlePack);
  const changes = [
    (a) => { delete a.model.manifestHash; },
    (a) => { a.model.modelRootHash = "unverified"; },
    (a) => { a.algorithm.id = "ollivier"; },
    (a) => { a.parameters.iterations = 1; },
    (a) => { a.result.summary.mean.denominator = 0; },
    (a) => { a.result.edges[0].curvature = 0.5; },
    (a) => { a.result.nodes[0].unexpected = true; },
    (a) => { a.result.groups.bySourceLevel[0].key = { present: false, value: null }; }
  ];
  for (const change of changes) {
    const malformed = structuredClone(artifact);
    change(malformed);
    assert.equal(validate("structuralGeometryArtifact", malformed), false);
  }
});

test("the public package bundles for a browser and reproduces canonical output without Node globals", async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("../src/index.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Geometry", write: false,
    logLevel: "silent"
  });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\n` +
    `JSON.stringify(Geometry.analyzeStructuralGeometry(JSON.parse(sourceText)));`, {
    // TextEncoder and its Uint8Array result must belong to the same realm.
    sourceText: JSON.stringify(singlePack), TextEncoder, TextDecoder, Uint8Array
  });
  assert.deepEqual(JSON.parse(output), analyzeStructuralGeometry(singlePack));
});
