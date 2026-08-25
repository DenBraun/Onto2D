import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAirflowConstraintModel } from "./airflow-constraint-model.js";

const artifact = JSON.parse(await readFile(new URL("../../cases/airflow-dependency-constraints/artifacts/airflow-dependency-constraints.json", import.meta.url), "utf8"));

test("browser model exposes the exact bounded Airflow result", () => {
  const model = createAirflowConstraintModel(structuredClone(artifact));
  assert.equal(model.solutions.length, 64);
  assert.equal(model.load("wheel-download-bytes").historicalLoad, 144596);
  assert.equal(model.load("environment-change-actions").historicalLoad, 7);
  assert.equal(model.load("selected-wheel-count").historicalLoad, 0);
  assert.equal(model.baseline.costs["environment-change-actions"], 0);
  assert.equal(model.constrained.costs["environment-change-actions"], 7);
});

test("browser model preserves official, derived, diagnostic, and counterfactual layers", () => {
  const model = createAirflowConstraintModel(structuredClone(artifact));
  assert.equal(model.constraint.evidenceClass, "official-versioned-airflow-constraint-file");
  assert.equal(model.diagnostics.rejectedAssignments, 64);
  assert.equal(model.historicalLoad.resolverDiagnosticsUsedAsCost, false);
  assert.equal(model.ablation("relax-pydantic-pair").results[0].constrained.solutionCount, 2);
});

test("browser model rejects result, scope, and evidence promotions", () => {
  const result = structuredClone(artifact);
  result.historicalLoad.results[0].historicalLoad += 1;
  assert.throws(() => createAirflowConstraintModel(result), /Historical Load result differs/);
  const scope = structuredClone(artifact);
  scope.scope.boundary = "Complete Airflow installation.";
  assert.throws(() => createAirflowConstraintModel(scope), /scope boundary differs/);
  const diagnostics = structuredClone(artifact);
  diagnostics.historicalLoad.resolverDiagnosticsUsedAsCost = true;
  assert.throws(() => createAirflowConstraintModel(diagnostics), /Historical Load result differs/);
});

test("selectors fail closed and the exact artifact becomes immutable", () => {
  const model = createAirflowConstraintModel(structuredClone(artifact));
  assert.throws(() => model.project("missing"), /unknown project/);
  assert.throws(() => model.load("runtime"), /unknown cost/);
  assert.throws(() => model.ablation("missing"), /unknown ablation/);
  assert.equal(Object.isFrozen(model.solutions[0].selections), true);
});
