import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMineralFormationModel } from "./mineral-formation-model.js";

const artifactUrl = new URL("../../cases/mineral-formation-history/artifacts/mineral-formation-history.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the Explorer model exposes the exact bounded cohort", async () => {
  const model = createMineralFormationModel(await load());
  assert.equal(model.samples.length, 10);
  assert.equal(model.formationClaims.length, 3);
  assert.equal(model.analyses("HP8-319.8").length, 13);
  assert.equal(model.traceSeries("DD86WRL1-681", "Ni").length, 5);
  assert.equal(model.claim("RI08-24-477.67"), null);
});

test("identity regimes keep unresolved samples visible", async () => {
  const model = createMineralFormationModel(await load());
  assert.deepEqual(model.identityRegimes.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [["conventional-species", 1, 0], ["sample-record", 10, 0], ["published-formation-profile", 3, 7]]);
  assert.equal(model.historicalLoad.value, null);
});

test("the Explorer rejects source and interpretation promotion", async () => {
  const source = await load();
  source.audit.automaticFormationClassifications = 1;
  assert.throws(() => createMineralFormationModel(source), /epistemic audit differs/);

  const loadPromoted = await load();
  loadPromoted.historicalLoad = { status: "evaluated", value: 0, reason: "invented" };
  assert.throws(() => createMineralFormationModel(loadPromoted), /Historical Load boundary differs/);

  const membership = await load();
  membership.samples[0].analysisIdentities.pop();
  assert.throws(() => createMineralFormationModel(membership), /analysis membership differs/);

  const claim = await load();
  claim.formationClaims[0].sampleIdentity = claim.samples[0].identity;
  assert.throws(() => createMineralFormationModel(claim), /unresolved sample identity/);
});

test("the Explorer model is detached and deeply immutable", async () => {
  const input = await load();
  const model = createMineralFormationModel(input);
  const sourceIdentity = model.sourceIdentity;
  input.source.identity = "sha256:" + "0".repeat(64);
  input.samples[0].analysisIdentities.push("sha256:" + "f".repeat(64));
  assert.equal(model.sourceIdentity, sourceIdentity);
  assert.equal(model.samples[0].analysisIdentities.length, model.analyses("79990").length);
  assert.throws(() => { model.samples[0].analysisIdentities.push("invented-analysis"); }, TypeError);
  assert.throws(() => { model.analyses("79990").push({}); }, TypeError);
  assert.throws(() => { model.traceSeries("79990", "Co")[0].value = -1; }, TypeError);
});
