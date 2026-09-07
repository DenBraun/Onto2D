import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { schemaUrls } from "@onto2d/schemas";
import { readJson } from "../../../cases/structural-geometry/added-value/generate.mjs";
const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls)) { const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id); }
const validate = (name, value) => ajv.validate(ids.get(name), value);
const suite = await readJson("suite.json");
test("closed study schemas accept every unit, full nested receipts and the 531-pair measured suite", async () => {
  for (const row of suite.units) assert.equal(validate("geometricAddedValueUnit", await readJson(row.file)), true, `${row.id}: ${ajv.errorsText()}`);
  assert.equal(validate("geometricAddedValueSuite", suite), true, ajv.errorsText());
});
test("unit schemas reject invented certainty, malformed baselines, missing receipts and fake work fields", async () => {
  const original = await readJson(suite.units.find(u => u.eligibility.combined).file);
  for (const mutate of [a => { a.eligibility.response = false; }, a => { a.eligibility.reasons.push("ignored-gap"); },
    a => { a.baselines.spectrum.pop(); }, a => { a.baselines.degrees[0].count = 0; }, a => { a.evidence.response = null; },
    a => { a.baselines.refinement.pop(); }, a => { a.baselines.similarity = 99; }, a => { a.work.milliseconds = 2; }, a => { a.unitHash += "\n"; }]) {
    const a = structuredClone(original); mutate(a); assert.equal(validate("geometricAddedValueUnit", a), false, mutate.toString());
  }
});
test("suite schemas preserve null paired coverage, zero-denominator indeterminacy, all units/pairs and fixed baseline order", () => {
  for (const mutate of [s => { s.units.pop(); }, s => { s.pairs.pop(); }, s => { s.summary.baselines.reverse(); },
    s => { s.summary.degreeMatched.status = "measured"; }, s => { s.summary.degreeMatched.pairedGain = { numerator: 0, denominator: 1 }; },
    s => { s.pairs.find(p => !p.eligible).matched.response = { numerator: 0, denominator: 1 }; },
    s => { s.pairs.find(p => p.eligible).matched.combined = null; }, s => { s.summary.primary.lost = 1; },
    s => { delete s.sourceHashes["PROTOCOL.md"]; }, s => { s.summary.pValue = 0.001; }]) {
    const s = structuredClone(suite); mutate(s); assert.equal(validate("geometricAddedValueSuite", s), false, mutate.toString());
  }
});
