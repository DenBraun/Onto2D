import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGalacticArchaeologyModel } from "./galactic-archaeology-model.js";

const artifactUrl = new URL("../../cases/galactic-archaeology/artifacts/galactic-archaeology.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the browser model exposes the exact bounded Gaia cohort", async () => {
  const model = createGalacticArchaeologyModel(await load());
  assert.equal(model.select().length, 64);
  assert.equal(model.select({ quality: "high" }).length, 32);
  assert.deepEqual(model.profileIds, ["cold-rotating-metal-rich", "alpha-raised-intermediate", "radial-metal-poor", "counter-rotating-metal-poor"]);
  assert.ok(model.summaries("high").every(({ sourceCount, patternSurvives }) => sourceCount === 8 && patternSurvives));
});

test("profile and record selectors fail closed", async () => {
  const model = createGalacticArchaeologyModel(await load());
  const selected = model.select({ quality: "high", profile: "radial-metal-poor" });
  assert.equal(selected.length, 8);
  assert.ok(selected.every(({ ruleProfileId, qualityProfile }) => ruleProfileId === "radial-metal-poor" && qualityProfile === "high"));
  assert.equal(model.record(selected[0].sourceId), selected[0]);
  assert.throws(() => model.select({ quality: "best" }), /unknown quality/);
  assert.throws(() => model.profile("native-halo"), /unknown profile/);
  assert.throws(() => model.record("0"), /unknown source/);
});

test("the browser model rejects uncertainty, quality, and origin promotions", async () => {
  const interval = await load();
  interval.records[0].gaiaEstimate.metallicity.lower = 99;
  assert.throws(() => createGalacticArchaeologyModel(interval), /interval differs/);

  const quality = await load();
  quality.qualityAblation.strict.summaries[0].sourceCount = 16;
  assert.throws(() => createGalacticArchaeologyModel(quality), /quality ablation differs/);

  const origin = await load();
  origin.records[0].assignment.birthOriginClaim = true;
  assert.throws(() => createGalacticArchaeologyModel(origin), /assignment boundary differs/);

  const measurement = await load();
  measurement.records[0].observation.parallax.uncertainty = -1;
  assert.throws(() => createGalacticArchaeologyModel(measurement), /observation measurement differs/);

  const energy = await load();
  energy.records[0].publishedOrbit.energy.point = Number.NaN;
  assert.throws(() => createGalacticArchaeologyModel(energy), /scalar estimate differs/);
});

test("the approved browser model is detached and deeply immutable", async () => {
  const source = await load();
  const model = createGalacticArchaeologyModel(source);
  source.records[0].gaiaEstimate.metallicity.point = 99;
  assert.notEqual(model.records[0].gaiaEstimate.metallicity.point, 99);
  assert.throws(() => { model.records[0].ruleProfileId = "mutated"; }, TypeError);
  assert.throws(() => model.records.pop(), TypeError);
});
