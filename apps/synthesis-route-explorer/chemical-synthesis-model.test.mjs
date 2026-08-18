import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createChemicalSynthesisModel } from "./chemical-synthesis-model.js";

const artifactUrl = new URL("../../cases/chemical-synthesis-history/artifacts/chemical-synthesis-history.json", import.meta.url);
const loadArtifact = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("browser model exposes bounded targets, cascade, routes, and load values", async () => {
  const model = createChemicalSynthesisModel(await loadArtifact());
  assert.equal(model.targets.length, 5);
  assert.equal(model.cascade.length, 3);
  assert.equal(model.routes.length, 4);
  assert.equal(model.target("target-2-pyridyl").routes[1].outcome.yield.value, 99.99999237060547);
  assert.equal(model.route("ord-cross-referenced-cascade").actual, true);
  assert.equal(model.load("reaction-record-count").historicalLoad, 2);
  assert.equal(Object.isFrozen(model.targets[0].routes[0]), true);
});

test("browser model rejects target, continuity, and analysis mutations", async () => {
  const target = await loadArtifact();
  target.cohorts.conditionSweep.targets[0].routes[1].outcome.productSmiles = "different";
  assert.throws(() => createChemicalSynthesisModel(target), /one exact product identifier/);
  const continuity = await loadArtifact();
  continuity.cohorts.linkedCascade.records[1].crossReferencedReactionIds.pop();
  assert.throws(() => createChemicalSynthesisModel(continuity), /continuity is missing/);
  const load = await loadArtifact();
  load.historicalLoad.results[0].historicalLoad = 0;
  assert.throws(() => createChemicalSynthesisModel(load), /reviewed contract/);
});

test("unknown browser selectors fail closed", async () => {
  const model = createChemicalSynthesisModel(await loadArtifact());
  assert.throws(() => model.target("unknown"), /Unknown target/);
  assert.throws(() => model.route("unknown"), /Unknown route/);
  assert.throws(() => model.load("unknown"), /Unknown Historical Load/);
});
