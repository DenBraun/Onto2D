import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOperationalAgingModel } from "./operational-aging-model.js";

const artifactUrl = new URL("../../cases/operational-aging/artifacts/operational-aging.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the browser model exposes the full endpoint cohort and bounded result", async () => {
  const model = createOperationalAgingModel(await load());
  assert.equal(model.endpoints.length, 100);
  assert.deepEqual(model.flagship.unitIds, [25, 72]);
  assert.deepEqual([model.distance("current-combined").rank, model.distance("last-20-combined").rank], [78, 1439]);
  assert.deepEqual([model.trajectory(25).observedCycleCount, model.trajectory(72).providedRul], [48, 50]);
  assert.equal(model.historicalLoad.value, null);
});

test("the browser model rejects RUL leakage and future-row promotion", async () => {
  const leaked = await load();
  leaked.distanceResults[0].providedRulUsedAsInput = true;
  assert.throws(() => createOperationalAgingModel(leaked), /distance profiles differ/);
  const future = await load();
  future.trajectories[0].futureRowsIncluded = true;
  assert.throws(() => createOperationalAgingModel(future), /trajectory 25 boundary/);
});

test("unknown selectors fail closed", async () => {
  const model = createOperationalAgingModel(await load());
  assert.throws(() => model.endpoint(999), /Unknown endpoint/);
  assert.throws(() => model.distance("none"), /Unknown distance profile/);
});
