import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createArtworkProvenanceModel } from "./artwork-provenance-model.js";
const url = new URL("../../cases/getty-artwork-provenance/artifacts/getty-artwork-provenance.json", import.meta.url);
const load = () => readFile(url, "utf8").then(JSON.parse);
test("browser model exposes the exact cohort, flagship evidence, and regime results", async () => { const model = createArtworkProvenanceModel(await load()); assert.equal(model.objects.length, 4); assert.equal(model.object("A1983").label, "James Christie"); assert.equal(model.events.length, 2); assert.deepEqual(model.results.map((result) => result.verdict), ["equal", "equal", "equal", "distinct", "unresolved"]); assert.equal(model.historicalLoad.value, null); assert.equal(Object.isFrozen(model.flagship.gap), true); });
test("browser model rejects legal-title, gap, and result promotion", async () => { const legal = await load(); legal.events[0].transfers[0].legalTitleDetermination = true; assert.throws(() => createArtworkProvenanceModel(legal), /legal-title boundary/); const gap = await load(); gap.flagship.gap.contents = { owner: "invented" }; assert.throws(() => createArtworkProvenanceModel(gap), /unknown interval/); const result = await load(); result.historyEquivalence.comparison.results[3].verdict = "equal"; assert.throws(() => createArtworkProvenanceModel(result), /equivalence results/); });
test("unknown object selectors fail closed", async () => { const model = createArtworkProvenanceModel(await load()); assert.throws(() => model.object("unknown"), /Unknown stock number/); });
