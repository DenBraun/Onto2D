import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { buildInTotoFixture, generateInTotoFixture } from "../generate-fixture.mjs";
import { buildInTotoAdmissibilityCase, calculateHistoricalLoad, verifyInTotoAdmissibilityCaseIdentity } from "../extract.mjs";
import { verifyMetadataSignature } from "../src/metadata.mjs";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(CASE_ROOT, "..", "..");

test("the deterministic final artifact is explicitly retained despite the global dist ignore", async () => {
  const [ignore, specification, finalArtifact] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, ".gitignore"), "utf8"),
    readFile(path.join(CASE_ROOT, "fixture-spec.json"), "utf8").then(JSON.parse),
    readFile(path.join(CASE_ROOT, "fixtures", "target", "dist", "app.bin"), "utf8")
  ]);
  const ignoreRules = new Set(ignore.split(/\r?\n/));
  assert.equal(ignoreRules.has("!cases/in-toto-admissibility/fixtures/target/dist/"), true);
  assert.equal(ignoreRules.has("!cases/in-toto-admissibility/fixtures/target/dist/app.bin"), true);
  assert.equal(finalArtifact, specification.artifacts.finalUtf8);
});

test("the signed fixture and extracted artifact reproduce byte-for-byte", async () => {
  await generateInTotoFixture({ verify: true });
  const artifact = await buildInTotoAdmissibilityCase();
  assert.deepEqual(verifyInTotoAdmissibilityCaseIdentity(artifact), artifact);
  assert.equal(await readFile(path.join(CASE_ROOT, "artifacts", "in-toto-admissibility.json"), "utf8"), `${JSON.stringify(artifact, null, 2)}\n`);
});

test("the case artifact conforms to its closed top-level schema", async () => {
  const [artifact, schema] = await Promise.all([buildInTotoAdmissibilityCase(), readFile(path.join(CASE_ROOT, "schema", "in-toto-admissibility.schema.json"), "utf8").then(JSON.parse)]);
  const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
});

test("all actual executions retain the exact same final bytes while native admissibility differs", async () => {
  const artifact = await buildInTotoAdmissibilityCase();
  assert.equal(new Set(artifact.executions.map((execution) => execution.finalArtifact.sha256)).size, 1);
  assert.equal(artifact.executions.find((execution) => execution.id === "valid").verification.native.status, "accepted");
  assert.equal(artifact.executions.find((execution) => execution.id === "shortcut").verification.native.status, "rejected");
  assert.equal(artifact.experiments[0].finalBytesEqual, true);
});

test("missing links, broken continuity, and unauthorized actors fail for distinct native reasons", async () => {
  const artifact = await buildInTotoAdmissibilityCase();
  const failed = (id) => artifact.executions.find((execution) => execution.id === id).verification.native.checks.filter((check) => check.status === "fail").map((check) => check.id);
  assert.ok(failed("shortcut").includes("build-required"));
  assert.ok(failed("material-break").includes("package-material-match"));
  assert.ok(failed("unauthorized-actor").includes("package-authorized"));
  assert.equal(failed("unauthorized-actor").includes("package-material-match"), false);
});

test("expected_command mismatch remains a native warning and an optional strict-profile rejection", async () => {
  const artifact = await buildInTotoAdmissibilityCase();
  const execution = artifact.executions.find((entry) => entry.id === "command-deviation");
  assert.equal(execution.verification.native.status, "accepted");
  assert.deepEqual(execution.verification.native.warnings.map((warning) => warning.nativeEffect), ["warning-only"]);
  assert.equal(execution.verification.strictCommand.status, "rejected");
});

test("fixture signatures bind exact metadata and fail after mutation", async () => {
  const fixture = await buildInTotoFixture();
  const record = structuredClone(fixture.scenarios.valid[0]);
  assert.equal(verifyMetadataSignature(record, fixture.keys.builder.publicKey, fixture.keys.builder.keyid), true);
  record.signed.command.push("--mutated");
  assert.equal(verifyMetadataSignature(record, fixture.keys.builder.publicKey, fixture.keys.builder.keyid), false);
});

test("counterfactual routes never become actual and Historical Load stays cost-relative", async () => {
  const artifact = await buildInTotoAdmissibilityCase();
  assert.equal(artifact.pathSpace.routes.some((route) => route.counterfactual && route.actual), false);
  assert.deepEqual(artifact.historicalLoad.results.map((result) => [result.costFunction, result.historicalLoad]), [["step-count", 1], ["distinct-actor-count", 1], ["attestation-count", 1], ["material-transition-count", 1]]);
  assert.throws(() => calculateHistoricalLoad(artifact.pathSpace.routes, artifact.historicalLoad.profile, "wall-clock"), /undeclared Historical Load cost/);
});

test("verdict mutation and counterfactual-to-actual promotion fail closed", async () => {
  const artifact = await buildInTotoAdmissibilityCase();
  const verdict = structuredClone(artifact);
  verdict.executions.find((execution) => execution.id === "shortcut").verification.native.status = "accepted";
  assert.throws(() => verifyInTotoAdmissibilityCaseIdentity(verdict), /verdict was substituted/);
  const counterfactual = structuredClone(artifact);
  counterfactual.pathSpace.routes[0].actual = true;
  assert.throws(() => verifyInTotoAdmissibilityCaseIdentity(counterfactual), /counterfactual route was marked actual/);
});

test("one changed fixture byte is rejected before interpretation", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-in-toto-"));
  try {
    await cp(path.join(CASE_ROOT, "fixtures"), temporary, { recursive: true });
    const target = path.join(temporary, "target", "dist", "app.bin");
    await writeFile(target, "mutated\n");
    await assert.rejects(() => generateInTotoFixture({ verify: true, fixtureRoot: temporary }), /differs from the deterministic fixture/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
