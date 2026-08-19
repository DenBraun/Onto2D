import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createEvolutionaryContingencyModel } from "./evolutionary-contingency-model.js";

const artifactUrl = new URL("../../cases/ltee-evolutionary-contingency/artifacts/ltee-evolutionary-contingency.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("Evolutionary Contingency browser model accepts the exact artifact", async () => {
  const model = createEvolutionaryContingencyModel(await load());
  assert.equal(model.identity, "sha256:e0024fee2f319158b5fc1dc0e30da1a7d641f0763b4f29ad7cc548c46e13d691");
  assert.deepEqual(model.generations, [0, 5000, 10000, 15000, 20000, 25000, 27000, 27500, 28000, 29000, 30000, 30500, 31000, 31500, 32000, 32500]);
  assert.deepEqual(model.protocolIds, ["replay-1", "replay-2", "replay-3"]);
  assert.equal(model.observation("replay-2", 32000).independentCitPlusMutants, 4);
  assert.equal(model.observation("replay-1", 5000), null);
});

test("browser model distinguishes observed, not observed, and not run", async () => {
  const model = createEvolutionaryContingencyModel(await load());
  assert.equal(model.observation("replay-3", 20000).outcomeStatus, "observed");
  assert.equal(model.observation("replay-3", 25000).outcomeStatus, "not-observed");
  assert.equal(model.observation("replay-3", 30500), null);
  assert.equal(model.assessment(25000).accessibilityStatus, "unresolved");
  assert.equal(model.assessment(20000).accessibilityStatus, "supported-in-at-least-one-bounded-replay");
});

test("browser selectors fail closed and the exact artifact is immutable", async () => {
  const model = createEvolutionaryContingencyModel(await load());
  assert.throws(() => model.protocol("replay-4"), /unknown protocol/);
  assert.throws(() => model.background(33000), /unknown generation/);
  assert.throws(() => model.background(null), /unknown generation/);
  assert.throws(() => model.assessment(""), /unknown generation/);
  assert.throws(() => model.observation("replay-4", 0), /unknown protocol/);
  assert.throws(() => model.statistic("pooled"), /unknown protocol/);
  assert.throws(() => { model.observations[0].replicates = 0; }, TypeError);
});

test("browser model rejects source, impossibility, pooling, and Historical Load mutations", async () => {
  const source = await load();
  source.source.snapshotIdentity = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  assert.throws(() => createEvolutionaryContingencyModel(source), /case or source release differs/);

  const impossible = await load();
  impossible.observations[0].absenceMeansImpossible = true;
  assert.throws(() => createEvolutionaryContingencyModel(impossible), /observation:replay-1:g-00000 differs/);

  const pooled = await load();
  pooled.cohort.protocolsPooled = true;
  assert.throws(() => createEvolutionaryContingencyModel(pooled), /cohort boundary differs/);

  const mismatchedObservation = await load();
  mismatchedObservation.observations[0].backgroundId = "background:ara-3:g-05000";
  assert.throws(() => createEvolutionaryContingencyModel(mismatchedObservation), /observation:replay-1:g-00000 differs/);

  const mismatchedAssessment = await load();
  mismatchedAssessment.reachability.backgroundAssessments[0].observedExperimentIds = [];
  assert.throws(() => createEvolutionaryContingencyModel(mismatchedAssessment), /assessment differs/);

  const loadPromoted = await load();
  loadPromoted.historicalLoad.value = 0;
  assert.throws(() => createEvolutionaryContingencyModel(loadPromoted), /epistemic boundary differs/);
});
