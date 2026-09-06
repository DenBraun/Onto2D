import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { observeTypedRelations, createStructuralVocabularyMapping, alignTypedRelations } from "@onto2d/structural-geometry/typed";
import { fixtures, mappingFixtures, readJson, input } from "../../../cases/structural-geometry/typed/fixtures.mjs";
import { alignmentFixtures } from "../../../cases/structural-geometry/typed/build.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), mappings = await mappingFixtures(), alignments = await alignmentFixtures();

test("closed typed schemas accept all complete/incomplete observations, declarations, mappings and alignments", async () => {
  for (const f of examples) {
    assert.equal(validate("structuralTypedInput", f.input), true, ajv.errorsText());
    assert.equal(validate("structuralTypedObservation", await readJson(`artifacts/${f.id}.json`)), true, ajv.errorsText());
  }
  for (const m of mappings) {
    assert.equal(validate("structuralVocabularyMappingInput", m.declaration), true, ajv.errorsText());
    assert.equal(validate("structuralVocabularyMapping", await readJson(`mappings/${m.id}.json`)), true, ajv.errorsText());
  }
  for (const f of alignments) assert.equal(validate("structuralTypedAlignment", await readJson(`alignments/${f.id}.json`)), true, ajv.errorsText());
});

test("typed schemas reject missing fields, invalid tuples, false availability, excess properties and comparison results", () => {
  const original = observeTypedRelations(examples.find((f) => f.id === "single-edge").pack, input);
  for (const mutate of [
    (a) => { delete a.observations[1].value.edges[0].types.necessity; },
    (a) => { a.observations[1].value.edges[0].types.interactionModeIds = [0, 0]; },
    (a) => { a.observations[1].value.edges[0].types.dependencyTypeId = -1; },
    (a) => { a.observations[1].value.edges[0].types.dependencyTypeId = Number.MAX_SAFE_INTEGER + 1; },
    (a) => { a.observations[1].value.edges[0].types.causalDirectionIds = "[0]"; },
    (a) => { a.observations[1].value.edges[0].types.weight = 1; },
    (a) => { a.observations[1].value.edges[0].to = a.observations[1].value.edges[0].from; },
    (a) => { a.observations[1].value.edges[0].from = 2; },
    (a) => { a.observations[1].witness.edges[0].types.ontologicalRole = "unknown"; },
    (a) => { a.observations[1].witness.statistics.searchStates = 100001; },
    (a) => { a.observations[1].availability = "missing"; }, (a) => { a.observations[1].valueHash = null; },
    (a) => { a.evaluation = "incomplete"; }, (a) => { a.evidence.missing.push({ sourceEdgeId: "e0", field: "necessity" }); },
    (a) => { a.observations.reverse(); }, (a) => { a.preparation.request.regimeId = "canonical-structure-v1"; },
    (a) => { a.implementation.otherAttributes = "included"; }, (a) => { a.distance = 0; }, (a) => { a.status = "indeterminate"; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralTypedObservation", a), false); }
});

test("mapping/alignment schemas reject invalid atoms, self-approval fields and unresolved results with aligned values", () => {
  const m = mappings[0], original = createStructuralVocabularyMapping(m.left.pack, m.right.pack, m.declaration);
  for (const mutate of [
    (a) => { a.declaration.fields.dependencyTypeId[0].left = "0"; },
    (a) => { a.declaration.fields.ontologicalRole[0].right = "unknown"; },
    (a) => { a.declaration.fields.causalDirectionIds[0].right = [0]; },
    (a) => { a.declaration.approved = true; }, (a) => { delete a.declaration.reviewEvidence; },
    (a) => { a.left.dictionaryHash = "unbound"; }, (a) => { a.policy.maxMappingEntries = 1025; }
  ]) { const a = structuredClone(original); mutate(a); assert.equal(validate("structuralVocabularyMapping", a), false); }
  const f = alignments.find((f) => f.id === "renumbered-approved"), a = alignTypedRelations(f.left.pack, f.left.input, f.right.pack, f.right.input, f.options);
  for (const mutate of [
    (v) => { v.compatibility = { state: "unresolved", basis: null, reasons: [{ code: "mapping-not-approved" }] }; },
    (v) => { v.aligned = null; }, (v) => { v.compatibility.reasons = [{ code: "mapping-not-approved" }]; },
    (v) => { v.aligned.right.value.edges[0].types.necessity = null; }, (v) => { v.distance = 0; }
  ]) { const value = structuredClone(a); mutate(value); assert.equal(validate("structuralTypedAlignment", value), false); }
});

test("schema and runtime reject unsupported or unbounded typed requests", () => {
  const pack = examples.find((f) => f.id === "single-edge").pack;
  for (const request of [{}, { regimeId: "topology-only-v1" }, { ...input, threshold: 0 }, { ...input, mapping: {} },
    { ...input, scope: { kind: "induced", nodeIds: ["n0", "n0"] } },
    { ...input, scope: { kind: "induced", nodeIds: Array.from({ length: 7 }, (_, i) => `n${i}`) } }]) {
    assert.equal(validate("structuralTypedInput", request), false); assert.throws(() => observeTypedRelations(pack, request));
  }
});

test("browser replay reproduces every typed observation, vocabulary mapping and approved/unresolved alignment", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/typed.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Typed", write: false, logLevel: "silent" });
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nconst f = JSON.parse(fixturesText);
    JSON.stringify({
      observations: f.examples.map(({pack,input}) => Typed.verifyTypedRelationsObservation(Typed.observeTypedRelations(pack,input),pack,input)),
      mappings: f.mappings.map(({left,right,declaration}) => Typed.verifyStructuralVocabularyMapping(Typed.createStructuralVocabularyMapping(left.pack,right.pack,declaration),left.pack,right.pack,declaration)),
      alignments: f.alignments.map(({left,right,options}) => Typed.verifyTypedRelationsAlignment(Typed.alignTypedRelations(left.pack,left.input,right.pack,right.input,options),left.pack,left.input,right.pack,right.input,options))
    });`, { fixturesText: JSON.stringify({ examples, mappings, alignments }), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), {
    observations: await Promise.all(examples.map((f) => readJson(`artifacts/${f.id}.json`))),
    mappings: await Promise.all(mappings.map((m) => readJson(`mappings/${m.id}.json`))),
    alignments: await Promise.all(alignments.map((f) => readJson(`alignments/${f.id}.json`)))
  });
});
