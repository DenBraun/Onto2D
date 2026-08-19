import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createEcologicalMemoryModel } from "./ecological-memory-model.js";

const artifactUrl = new URL("../../cases/ecological-memory/artifacts/ecological-memory.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the Ecological Memory browser model exposes the approved result", async () => {
  const model = createEcologicalMemoryModel(await load());
  assert.equal(model.surveys.length, 2);
  assert.equal(model.beforeAfter.matchedCellCount, 7275);
  assert.equal(model.flagship.cellId, 7880);
  assert.deepEqual(model.flagship.displaySignature, [3, 3.5, 3.8, 4]);
  assert.equal(model.cell(7880)[0], 7880);
});

test("the browser model rejects causality and identity promotions", async () => {
  const causal = await load();
  causal.beforeAfter.causalEffectEstimated = true;
  assert.throws(() => createEcologicalMemoryModel(causal), /before\/after result differs/);

  const identity = await load();
  identity.similarSnapshot.createsHistoryIdentity = true;
  assert.throws(() => createEcologicalMemoryModel(identity), /flagship snapshot differs/);

  const absence = await load();
  absence.similarSnapshot.after.noOtherDisturbanceClaim = true;
  assert.throws(() => createEcologicalMemoryModel(absence), /flagship snapshot differs/);
});

test("the browser model rejects alternate releases and malformed grids", async () => {
  const release = await load();
  release.caseIdentity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => createEcologicalMemoryModel(release), /case or source release differs/);

  const grid = await load();
  grid.cellGrid.rows[1][0] = grid.cellGrid.rows[0][0];
  assert.throws(() => createEcologicalMemoryModel(grid), /cell grid row differs/);
});
