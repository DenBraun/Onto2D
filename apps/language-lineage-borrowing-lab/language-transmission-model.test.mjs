import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLanguageTransmissionModel } from "./language-transmission-model.js";
const artifactUrl = new URL("../../cases/historical-linguistics/artifacts/historical-linguistics.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
test("the browser model exposes the exact cohort and separated evidence layers", async () => { const model = createLanguageTransmissionModel(await load()); assert.equal(model.languages.length, 6); assert.equal(model.genealogy.edges.length, 40); assert.equal(model.borrowings.length, 4); assert.equal(model.language("mana1288").lexicalForm.form, "mi\u0283\u028cr"); assert.equal(model.borrowing("5").genealogicalParent, false); assert.equal(model.similarity("5").createsCognacy, false); assert.equal(model.historicalLoad.value, null); });
test("the browser model rejects borrowing promotion and a substituted verdict", async () => { const promoted = await load(); promoted.borrowings[0].genealogicalParent = true; assert.throws(() => createLanguageTransmissionModel(promoted), /borrowing boundary/); const verdict = await load(); verdict.historyEquivalence.comparisons[0].results[0].equal = true; assert.throws(() => createLanguageTransmissionModel(verdict), /equivalence matrix/); });
test("unknown selectors fail closed", async () => { const model = createLanguageTransmissionModel(await load()); assert.throws(() => model.language("none0000"), /Unknown Glottocode/); assert.throws(() => model.borrowing("none"), /Unknown borrowing/); });
