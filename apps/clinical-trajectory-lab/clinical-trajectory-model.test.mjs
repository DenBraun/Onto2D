import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClinicalTrajectoryModel } from "./clinical-trajectory-model.js";

const artifactUrl = new URL("../../cases/clinical-trajectories/artifacts/clinical-trajectories.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the Clinical Trajectories browser model exposes the approved bounded cohort", async () => {
  const model = createClinicalTrajectoryModel(await load());
  assert.deepEqual(model.aliases, ["P01", "P02", "P03", "P04", "P05"]);
  assert.equal(model.frame("P01").labs.length, 4);
  assert.equal(model.history("P01").timelineEventCount, 194);
  assert.equal(model.comparison.distance, 0.09);
  assert.equal(model.audit.outcomePredictions, 0);
});

test("the browser model returns exact cutoff-safe source events", async () => {
  const model = createClinicalTrajectoryModel(await load());
  const events = model.recentEvents("P01", { kind: "lab-record", limit: 8 });
  assert.equal(events.length, 8);
  assert.ok(events.every((event) => event.kind === "lab-record" && event.timestamp <= model.timeline("P01").cutoff));
  assert.equal(model.event("P01", events[0].id), events[0]);
});

test("the browser model rejects scope, future, and clinical-use promotions", async () => {
  const scope = await load();
  scope.frames[0].sourceSubjectId = scope.frames[1].sourceSubjectId;
  assert.throws(() => createClinicalTrajectoryModel(scope), /scope differs/);

  const future = await load();
  future.timelines[0].events[0].timestamp = "9999-12-31 23:59:59";
  assert.throws(() => createClinicalTrajectoryModel(future), /timeline boundary differs/);

  const prediction = await load();
  prediction.audit.outcomePredictions = 1;
  assert.throws(() => createClinicalTrajectoryModel(prediction), /clinical safety boundary differs/);
});

test("unknown selectors and unsafe event limits fail closed", async () => {
  const model = createClinicalTrajectoryModel(await load());
  assert.throws(() => model.frame("P99"), /unknown frame/);
  assert.throws(() => model.recentEvents("P01", { kind: "diagnosis", limit: 10 }), /unknown event kind/);
  assert.throws(() => model.recentEvents("P01", { limit: 1000 }), /event limit/);
});

test("the approved browser model is detached and deeply immutable", async () => {
  const source = await load();
  const model = createClinicalTrajectoryModel(source);
  source.frames[0].careunit = "mutated";
  assert.notEqual(model.frame("P01").careunit, "mutated");
  assert.throws(() => { model.frame("P01").careunit = "mutated"; }, TypeError);
  assert.throws(() => model.timeline("P01").events.pop(), TypeError);
});
