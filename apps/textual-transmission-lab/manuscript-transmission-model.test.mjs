import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createManuscriptTransmissionModel } from "./manuscript-transmission-model.js";

const artifactUrl = new URL("../../cases/manuscript-stemmatics/artifacts/manuscript-stemmatics.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the browser model exposes the bounded collation and attributed reconstruction", async () => {
  const model = createManuscriptTransmissionModel(await load());
  assert.equal(model.corpus.witnessCount, 58);
  assert.equal(model.corpus.variantCharacterCount, 4032);
  assert.equal(model.witnesses.length, 7);
  assert.equal(model.sites.length, 2);
  assert.equal(model.transmission.relations.length, 4);
  assert.equal(model.agreement("cx2-pn").createsAncestry, false);
  assert.equal(model.historicalLoad.value, null);
});

test("the browser model rejects contamination promotion and a substituted verdict", async () => {
  const promoted = await load();
  promoted.transmission.relations.find((relation) => relation.contamination).treeCompatible = true;
  assert.throws(() => createManuscriptTransmissionModel(promoted), /contamination boundary/);
  const verdict = await load();
  verdict.historyEquivalence.comparisons[0].results[0].equal = true;
  assert.throws(() => createManuscriptTransmissionModel(verdict), /history-equivalence matrix/);
});

test("unknown selectors fail closed", async () => {
  const model = createManuscriptTransmissionModel(await load());
  assert.throws(() => model.witness("none"), /Unknown witness/);
  assert.throws(() => model.ablation("none"), /Unknown ablation/);
});
