import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildAirflowDependencyConstraintsCase,
  verifyAirflowDependencyConstraintsCaseIdentity
} from "../extract.mjs";
import { calculateHistoricalLoad } from "../src/resolver.mjs";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the frozen Airflow constraint projection reproduces byte-for-byte", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  assert.deepEqual(verifyAirflowDependencyConstraintsCaseIdentity(artifact), artifact);
  assert.equal(
    `${JSON.stringify(artifact, null, 2)}\n`,
    await readFile(path.join(CASE_ROOT, "artifacts", "airflow-dependency-constraints.json"), "utf8")
  );
});

test("the case artifact conforms to its closed schema", async () => {
  const [artifact, schema] = await Promise.all([
    buildAirflowDependencyConstraintsCase(),
    readFile(path.join(CASE_ROOT, "schema", "airflow-dependency-constraints.schema.json"), "utf8").then(JSON.parse)
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
});

test("the complete bounded census separates accepted solutions from real dependency conflicts", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  assert.equal(artifact.resolverDiagnostics.assignmentsConsidered, 128);
  assert.equal(artifact.resolverDiagnostics.acceptedSolutions, 64);
  assert.equal(artifact.resolverDiagnostics.rejectedAssignments, 64);
  assert.deepEqual(artifact.resolverDiagnostics.rejectionCounts.map(({ count }) => count), [32, 32]);
  assert.ok(artifact.resolverDiagnostics.rejectionCounts.every(({ reason }) => reason.includes("pydantic-core")));
});

test("the official Airflow constraints select one exact solution in the same universe", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  assert.equal(artifact.constraint.entryCount, 121);
  assert.equal(artifact.solutions.filter((solution) => solution.constraintCompliant).length, 1);
  assert.ok(artifact.constraint.selectedPins.every((pin) => artifact.constraint.entries.some((entry) => entry.project === pin.project && entry.version === pin.version)));
});

test("Historical Load is cost-relative and retains a zero control", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  assert.deepEqual(
    artifact.historicalLoad.results.map((result) => [result.costFunction, result.free.optimumCost, result.constrained.optimumCost, result.historicalLoad]),
    [
      ["wheel-download-bytes", 7676228, 7820824, 144596],
      ["environment-change-actions", 0, 7, 7],
      ["selected-wheel-count", 17, 17, 0]
    ]
  );
  assert.equal(artifact.historicalLoad.resolverDiagnosticsUsedAsCost, false);
  assert.throws(() => calculateHistoricalLoad(artifact.solutions, artifact.analysisProfile, "backtracking-steps"), /undeclared cost function/);
});

test("paired pydantic ablation exposes a dependency-coupled branch", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  const pydantic = artifact.constraintAblations.find((entry) => entry.id === "relax-pydantic");
  const core = artifact.constraintAblations.find((entry) => entry.id === "relax-pydantic-core");
  const pair = artifact.constraintAblations.find((entry) => entry.id === "relax-pydantic-pair");
  assert.equal(pydantic.results[0].constrained.solutionCount, 1);
  assert.equal(core.results[0].constrained.solutionCount, 1);
  assert.equal(pair.results[0].constrained.solutionCount, 2);
  assert.equal(pair.results.find((entry) => entry.costFunction === "environment-change-actions").historicalLoad, 5);
});

test("typing-extensions remains one shared target rather than duplicated branches", async () => {
  const artifact = await buildAirflowDependencyConstraintsCase();
  const shared = artifact.sharedDependencies.find((entry) => entry.project === "typing-extensions");
  assert.equal(shared.consumerCount, 6);
  assert.deepEqual(shared.consumers, ["apache-airflow-core==3.3.1", "pydantic", "pydantic-core", "referencing", "sqlalchemy", "typing-inspection"]);
});

test("source mutation fails before resolution", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-airflow-constraints-"));
  try {
    await cp(CASE_ROOT, temporary, { recursive: true });
    const constraintPath = path.join(temporary, "sources", "constraints-no-providers-3.12.txt");
    const source = await readFile(constraintPath, "utf8");
    await writeFile(constraintPath, source.replace("jsonschema==4.26.0", "jsonschema==4.25.1"), "utf8");
    await assert.rejects(() => buildAirflowDependencyConstraintsCase({ caseRoot: temporary }), /differs from its source lock/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("re-signed result and evidence promotions fail closed", async () => {
  const loadMutation = structuredClone(await buildAirflowDependencyConstraintsCase());
  loadMutation.historicalLoad.results[0].historicalLoad += 1;
  assert.throws(() => verifyAirflowDependencyConstraintsCaseIdentity(loadMutation), /Historical Load results are substituted/);

  const diagnosticMutation = structuredClone(await buildAirflowDependencyConstraintsCase());
  diagnosticMutation.historicalLoad.resolverDiagnosticsUsedAsCost = true;
  assert.throws(() => verifyAirflowDependencyConstraintsCaseIdentity(diagnosticMutation), /Historical Load results are substituted|case identity/);
});
