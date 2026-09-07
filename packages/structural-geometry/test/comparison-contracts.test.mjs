import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { compareStructuralModels } from "@onto2d/structural-geometry/comparison";
import { createStructuralVocabularyMapping } from "@onto2d/structural-geometry/typed";
import { fixtures, readJson } from "../../../cases/structural-geometry/comparison/fixtures.mjs";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));

test("closed comparison schemas accept all 43 regime requests and complete/incomplete results", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("structuralComparisonInput", f.input), true, `${f.id}: ${ajv.errorsText()}`);
    assert.equal(validate("structuralComparisonArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});

test("comparison schema and runtime reject implicit regimes, thresholds, wrong vocabulary and malformed use restrictions", () => {
  const x = examples[0], input = x.input;
  const gap = { side: "left", observableId: "canonical-directed-structure-v1", disposition: "unavailable", reference: "test", contentHash: x.left.manifest.rootHash };
  for (const request of [{}, { ...input, regimeId: "history-aware-v1" }, { ...input, threshold: 0 },
    { ...input, vocabulary: {} }, { ...input, components: [] }, { ...input, rightScope: { kind: "induced", nodeIds: [] } },
    { ...input, leftScope: { kind: "induced", nodeIds: Array.from({ length: 7 }, (_, i) => `n${i}`) } },
    { ...input, evidenceGaps: [gap, gap] }, { ...input, evidenceGaps: [{ ...gap, disposition: "missing" }] },
    { ...input, evidenceGaps: [{ ...gap, observableId: "edge-count-v1" }] }, { ...input, evidenceGaps: [{ ...gap, reference: "test\n" }] },
    { regimeId: "typed-relations-v1", vocabulary: { approvedMappingHash: gap.contentHash } }]) {
    assert.equal(validate("structuralComparisonInput", request), false); assert.throws(() => compareStructuralModels(x.left, x.right, request));
  }
});

test("comparison result schemas reject false success, invalid coverage, reordered components and forged contracts", () => {
  const original = artifacts.find(a => a.request.regimeId === "typed-relations-v1" && a.distance === 0);
  for (const mutate of [
    a => { a.distance = 0.1; }, a => { a.distance = null; }, a => { a.status = "indeterminate"; },
    a => { a.coverage.numerator = 0; }, a => { a.coverage.denominator = 1; }, a => { a.coverage.complete = false; },
    a => { a.coverage.families[0].numerator = 0; }, a => { a.policy.errors = "ignore"; },
    a => { a.components.reverse(); }, a => { a.components.pop(); }, a => { a.components[1].values = null; },
    a => { a.components[1].state = "different"; }, a => { a.components[1].left.availability = "missing"; },
    a => { a.components[1].reasons = [{ code: "evidence-unavailable", side: "left" }]; },
    a => { a.components[1].values.left.edges[0].types.necessity = "unknown"; },
    a => { a.components[0].mandatory = false; }, a => { a.evidence.alignment.sources.left.evaluation = "not-run"; },
    a => { delete a.request.evidenceGaps; }, a => { a.artifactHash += "\n"; }, a => { a.responseSignature = {}; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralComparisonArtifact", a), false); }
  const incomplete = artifacts.find(a => a.distance === null);
  for (const mutate of [a => { a.distance = 0; }, a => { a.status = "indistinguishable-under-regime"; },
    a => { a.coverage.numerator = a.coverage.denominator; }, a => { a.diagnostics.incompleteObservableIds = []; },
    a => { a.components[1].reasons = []; }]) {
    const a = structuredClone(incomplete); mutate(a); assert.equal(validate("structuralComparisonArtifact", a), false);
  }
});

test("all comparison schemas preserve opaque source IDs including surrounding whitespace", () => {
  const pack = packFor({ id: "schema-opaque", nodes: 2, labels: [" a ", "b\n"], edges: [] });
  for (const regimeId of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
    const input = { regimeId, rightScope: { kind: "induced", nodeIds: ["b\n", " a "] } };
    assert.equal(validate("structuralComparisonInput", input), true, ajv.errorsText());
    assert.equal(validate("structuralComparisonArtifact", compareStructuralModels(pack, pack, input)), true, ajv.errorsText());
  }
});

test("uncovered vocabulary values are bounded by the artifact budget, not the mapping-entry count", () => {
  const pack = packFor({ id: "many-uncovered-values", nodes: 2, edges: [{ from: 0, to: 1, types: {
    dependencyTypeId: 0, interactionModeIds: Array.from({ length: 600 }, (_, i) => i),
    causalDirectionIds: [], ontologicalRole: "arising", necessity: "necessary" } }] });
  const mapping = createStructuralVocabularyMapping(pack, pack, { id: "empty-map", version: "1",
    fields: { dependencyTypeId: [], interactionModeIds: [], causalDirectionIds: [], ontologicalRole: [], necessity: [] },
    reviewEvidence: { reference: "test-only", contentHash: pack.manifest.rootHash } });
  const input = { regimeId: "typed-relations-v1", vocabulary: { mapping, approvedMappingHash: mapping.artifactHash } };
  const a = compareStructuralModels(pack, pack, input);
  assert.equal(a.distance, null); assert.equal(a.components[1].reasons.length, 1206);
  assert.equal(validate("structuralComparisonArtifact", a), true, ajv.errorsText());
});

test("the browser bundle reproduces all 43 exact comparison artifacts and independently verifies expected inputs", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/comparison.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Comparison", write: false, logLevel: "silent" });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nconst fixtures = JSON.parse(fixturesText);
    JSON.stringify(fixtures.map(({left,right,input}) => Comparison.verifyStructuralComparison(
      Comparison.compareStructuralModels(left,right,input),left,right,input)));`,
  { fixturesText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), artifacts);
});
