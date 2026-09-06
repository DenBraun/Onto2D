import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { buildModelPack } from "@onto2d/model-pack";
import { analyzeStructuralMetricExperiment, auditStructuralWeights } from "@onto2d/structural-geometry/experiments";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural"))) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const controls = JSON.parse(await readFile(new URL("../../../cases/structural-geometry/experiments/controls.json", import.meta.url), "utf8")).cases;
const pack = (graph) => buildModelPack({ model: { id: graph.id, version: "1", name: "Schema control" }, source: { id: "control", files: [] },
  nodes: graph.nodes, edges: graph.edges.map((edge) => ({ relationLayer: "source-parent", ...edge })), dictionaries: {} });
const weighted = { metricPolicyId: "inverse-target-share-v1" };

test("experimental schemas cover all controls, full results, source audit and suite", async () => {
  for (const graph of controls) {
    const source = pack(graph);
    for (const request of [{}, weighted]) {
      assert.equal(validate("structuralMetricExperiment", analyzeStructuralMetricExperiment(source, request)), true, ajv.errorsText());
    }
    assert.equal(validate("structuralWeightAudit", auditStructuralWeights(source)), true, ajv.errorsText());
  }
  for (const [name, file] of [["structuralMetricExperiment", "weighted-full"], ["structuralWeightAudit", "weight-audit"], ["structuralMetricSuite", "suite"]]) {
    const value = JSON.parse(await readFile(new URL(`../../../cases/structural-geometry/experiments/${file}.json`, import.meta.url), "utf8"));
    assert.equal(validate(name, value), true, ajv.errorsText());
  }
  const extreme = structuredClone(controls[0]); extreme.edges[0].weight = 1e308;
  assert.equal(validate("structuralWeightAudit", auditStructuralWeights(pack(extreme))), true, ajv.errorsText());
});

test("closed experimental schemas reject unbound policies and malformed numeric transport", () => {
  const artifact = analyzeStructuralMetricExperiment(pack(controls[0]), weighted);
  for (const change of [
    (a) => { delete a.model.manifestHash; }, (a) => { a.metricPolicy.normalizationContext = "selected-only"; },
    (a) => { a.numericPolicy.decimalPlaces = 6; }, (a) => { a.result.edges[0].length.denominator = "0"; },
    (a) => { a.result.edges[0].length.numerator = "-1"; }, (a) => { a.result.edges[0].curvature.lowerTicks = "0.2"; },
    (a) => { a.result.edges[0].curvature.upperTicks = "-0"; }, (a) => { a.result.summary.mean.denominator = 0; },
    (a) => { a.request.selection = { kind: "roles", roles: ["arising", "arising"] }; },
    (a) => { a.request.selection = { kind: "channel", field: "necessity", value: 1 }; }
  ]) {
    const broken = structuredClone(artifact); change(broken);
    assert.equal(validate("structuralMetricExperiment", broken), false);
  }
});

test("weighted BigInt interval calculations reproduce exact artifacts in a browser-target bundle", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/experiments.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Experiments", write: false, logLevel: "silent" });
  const source = pack(controls[2]);
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(Experiments.analyzeStructuralMetricExperiment(JSON.parse(sourceText), {metricPolicyId: "inverse-target-share-v1"}));`, {
    sourceText: JSON.stringify(source), TextEncoder, TextDecoder, Uint8Array
  });
  assert.deepEqual(JSON.parse(output), analyzeStructuralMetricExperiment(source, weighted));
});
