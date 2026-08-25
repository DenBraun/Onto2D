import assert from "node:assert/strict";
import test from "node:test";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildAirflowDependencyConstraintsCase } from "../../cases/airflow-dependency-constraints/extract.mjs";
import { compileAirflowDependencyConstraintsModelPack } from "./compiler.mjs";

test("the Airflow constraint compiler emits a valid deterministic Model Pack", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  const first = compileAirflowDependencyConstraintsModelPack(artifact);
  const second = compileAirflowDependencyConstraintsModelPack(artifact);
  assert.deepEqual(verifyModelPack(first), first);
  assert.deepEqual(second, first);
});

test("all bounded solutions retain exact selected candidate membership", async () => {
  const pack = compileAirflowDependencyConstraintsModelPack(await buildAirflowDependencyConstraintsCase());
  const solutions = pack.files["model/nodes.json"].filter((node) => node.entityKind === "dependency-solution");
  const selections = pack.files["model/edges.json"].filter((edge) => edge.relation === "selects-candidate");
  assert.equal(solutions.length, 64);
  assert.equal(selections.length, 64 * 17);
  assert.equal(solutions.filter((node) => node.constraintCompliant).length, 1);
});

test("official constraints, analysis results, and counterfactuals remain distinct", async () => {
  const pack = compileAirflowDependencyConstraintsModelPack(await buildAirflowDependencyConstraintsCase());
  const nodes = pack.files["model/nodes.json"];
  assert.equal(nodes.filter((node) => node.entityKind === "versioned-constraint-record").length, 1);
  assert.equal(nodes.filter((node) => node.entityKind === "historical-load-result").length, 3);
  assert.equal(nodes.filter((node) => node.entityKind === "constraint-ablation").length, 8);
  assert.ok(nodes.filter((node) => node.entityKind === "historical-load-result").every((node) => node.resolverDiagnosticsUsedAsCost === false));
});

test("the compiler rejects a re-signed Historical Load substitution", async () => {
  const artifact = structuredClone(await buildAirflowDependencyConstraintsCase());
  artifact.historicalLoad.results[0].historicalLoad += 1;
  assert.throws(() => compileAirflowDependencyConstraintsModelPack(artifact), /Historical Load results are substituted/);
});
