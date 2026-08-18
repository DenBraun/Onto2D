import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createInTotoAdmissibilityModel } from "./in-toto-admissibility-model.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifact = () => readFile(path.join(ROOT, "cases/in-toto-admissibility/artifacts/in-toto-admissibility.json"), "utf8").then(JSON.parse);

test("the browser model preserves actual execution and verdict boundaries", async () => {
  const model = createInTotoAdmissibilityModel(await artifact());
  assert.equal(model.executions.length, 5);
  assert.equal(model.execution("valid").verification.native.status, "accepted");
  assert.equal(model.execution("shortcut").verification.native.status, "rejected");
  assert.equal(model.execution("command-deviation").verification.strictCommand.status, "rejected");
  assert.equal(new Set(model.executions.map((execution) => execution.finalArtifact.sha256)).size, 1);
});

test("the browser model exposes four explicitly bounded load results", async () => {
  const model = createInTotoAdmissibilityModel(await artifact());
  assert.deepEqual(model.historicalLoad.results.map((result) => result.historicalLoad), [1, 1, 1, 1]);
  assert.equal(model.routes.filter((route) => route.counterfactual).every((route) => !route.actual), true);
  assert.throws(() => model.load("time"), /Unknown Historical Load cost/);
});

test("the browser model fails closed on verdict and path-boundary mutations", async () => {
  const verdict = await artifact(); verdict.executions[0].verification.native.status = "rejected";
  assert.throws(() => createInTotoAdmissibilityModel(verdict), /verdict differs/);
  const route = await artifact(); route.pathSpace.routes[0].actual = true;
  assert.throws(() => createInTotoAdmissibilityModel(route), /route boundary/);
});
