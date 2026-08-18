import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildReproducibleBuildEquivalenceCase, verifyReproducibleBuildEquivalenceCaseIdentity } from "../extract.mjs";
import { captureExecution, loadBuildFixture } from "../src/build-fixture.mjs";
import { compareBuildHistories } from "../src/history-equivalence.mjs";

const caseRoot = fileURLToPath(new URL("../", import.meta.url));
const artifactPath = fileURLToPath(new URL("../artifacts/reproducible-build-equivalence.json", import.meta.url));
const schemaPath = fileURLToPath(new URL("../schema/reproducible-build-equivalence.schema.json", import.meta.url));
const CASE_DOMAIN = "onto2d:reproducible-build-equivalence-case:v1";

function reSign(artifact) {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical(CASE_DOMAIN, basis);
  return artifact;
}

async function committed() {
  return JSON.parse(await readFile(artifactPath, "utf8"));
}

test("the four captured histories reproduce the committed case artifact byte-for-byte", async () => {
  assert.deepEqual(await buildReproducibleBuildEquivalenceCase(), await committed());
});

test("the case artifact conforms to its closed schema", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: false });
  const validate = ajv.compile(JSON.parse(await readFile(schemaPath, "utf8")));
  const artifact = await committed();
  assert.equal(validate(artifact), true, ajv.errorsText(validate.errors));
});

test("different Node toolchains produce identical specified bytes without collapsing history", async () => {
  const artifact = await committed();
  const pair = artifact.comparisons[0];
  assert.equal(pair.leftHistory, "baseline-node24");
  assert.equal(pair.rightHistory, "baseline-node22");
  assert.equal(pair.historiesDistinct, true);
  assert.deepEqual(pair.regimes.map((result) => [result.regimeId, result.equal]), [
    ["byte-output", true],
    ["declared-input", true],
    ["toolchain", false],
    ["environment", true],
    ["provenance", false]
  ]);
  assert.notEqual(artifact.histories[0].historyIdentity, artifact.histories[1].historyIdentity);
  assert.equal(artifact.histories[0].artifact.sha256, artifact.histories[1].artifact.sha256);
});

test("an explicitly excluded ambient value cannot silently change environment equivalence", async () => {
  const artifact = await committed();
  const pair = artifact.comparisons[1];
  assert.deepEqual(pair.regimes.map((result) => result.equal), [true, true, true, true, false]);
  const environment = pair.regimes.find((result) => result.regimeId === "environment");
  assert.deepEqual(environment.excludedFields, ["environment.observedIrrelevant.ONTO2D_SESSION_LABEL"]);
  assert.deepEqual(environment.differingFields, []);
});

test("a relevant declared input mutation changes input identity and output bytes", async () => {
  const artifact = await committed();
  const pair = artifact.comparisons[2];
  assert.deepEqual(pair.regimes.map((result) => result.equal), [false, false, true, true, false]);
  assert.deepEqual(pair.regimes[0].differingFields, ["artifact.sha256", "artifact.bytes"]);
  assert.deepEqual(pair.regimes[1].differingFields, ["declaredInputs.parameters"]);
});

test("all execution artifacts independently match their bytes and SHA-256", async () => {
  const artifact = await committed();
  for (const history of artifact.histories) {
    assert.equal(history.artifact.bytes, Buffer.byteLength(history.artifact.utf8, "utf8"));
    assert.equal(history.artifact.sha256, `sha256:${createHash("sha256").update(history.artifact.utf8, "utf8").digest("hex")}`);
  }
  assert.equal(new Set(artifact.histories.map((history) => history.artifact.sha256)).size, 2);
});

test("artifact identity and comparison input drift fail closed", async () => {
  const artifact = await committed();
  const mutatedIdentity = structuredClone(artifact);
  mutatedIdentity.histories[0].runtime.version = "24.19.1";
  assert.throws(() => verifyReproducibleBuildEquivalenceCaseIdentity(mutatedIdentity), /history identity was substituted/);

  const fixture = await loadBuildFixture();
  const left = structuredClone(artifact.histories[0]);
  const right = structuredClone(artifact.histories[1]);
  right.artifact.sha256 = left.artifact.sha256.replace(/.$/, "0");
  const profile = { format: "onto2d-build-history-equivalence-profile", formatVersion: "1", profileVersion: "build-history-equivalence-v1", regimes: artifact.regimes, pairOrder: artifact.comparisons.map((value) => value.id), nonClaims: artifact.evidenceBoundary.nonClaims };
  const recomputed = compareBuildHistories(fixture.spec.comparisons[0], left, right, profile);
  assert.equal(recomputed.regimes[0].equal, false);
});

test("re-signed derived, nested identity, and source identity substitutions fail closed", async () => {
  const artifact = await committed();

  const result = structuredClone(artifact);
  result.comparisons[0].regimes[0].differingFields = ["invented-review-field"];
  assert.throws(() => verifyReproducibleBuildEquivalenceCaseIdentity(reSign(result)), /history-equivalence results were substituted/);

  const history = structuredClone(artifact);
  history.histories[0].historyIdentity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => verifyReproducibleBuildEquivalenceCaseIdentity(reSign(history)), /history identity was substituted/);

  const source = structuredClone(artifact);
  source.source.identity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => verifyReproducibleBuildEquivalenceCaseIdentity(reSign(source)), /source identity was substituted/);
});

test("the source lock includes both fixture files and the exact builder implementation", async () => {
  const fixture = await loadBuildFixture();
  assert.deepEqual(fixture.spec.sourceFiles.map(({ path }) => path), [
    "fixture/source/manifest.json",
    "fixture/source/message.txt",
    "src/build-fixture.mjs"
  ]);
  assert.equal(fixture.spec.instructions.builder, "src/build-fixture.mjs");
  assert.equal(fixture.spec.sourceFiles.find(({ path }) => path === fixture.spec.instructions.builder)?.sha256, "b10229aa81426f8b077d212320ba8c64e666eefb7e4ed8a2bbf2c906dcb34543");
});

test("Historical Load stays undefined instead of being reported as zero", async () => {
  const artifact = await committed();
  assert.deepEqual(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
  assert.match(artifact.historicalLoad.reason, /undefined rather than zero/);
});

test("the evidence boundary records untested platforms and trust as unknown", async () => {
  const artifact = await committed();
  assert.deepEqual(artifact.histories.map(({ runtime }) => runtime), [
    { name: "Node.js", version: "24.19.0", major: 24, platform: "darwin", architecture: "arm64" },
    { name: "Node.js", version: "22.23.2", major: 22, platform: "darwin", architecture: "arm64" },
    { name: "Node.js", version: "24.19.0", major: 24, platform: "darwin", architecture: "arm64" },
    { name: "Node.js", version: "24.19.0", major: 24, platform: "darwin", architecture: "arm64" }
  ]);
  assert.ok(artifact.evidenceBoundary.unknown.includes("cross-machine reproducibility"));
  assert.ok(artifact.evidenceBoundary.unknown.includes("non-Darwin reproducibility"));
  assert.ok(artifact.evidenceBoundary.unknown.includes("builder trustworthiness"));
});

test("capture records require the declared process environment and read the real ambient label", async () => {
  const names = ["LANG", "TZ", "SOURCE_DATE_EPOCH", "ONTO2D_SESSION_LABEL"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    Object.assign(process.env, { LANG: "C", TZ: "UTC", SOURCE_DATE_EPOCH: "1786924800", ONTO2D_SESSION_LABEL: "test-capture" });
    const record = await captureExecution({ executionId: "test-capture", parameterSet: "baseline", capturedAt: "2026-08-18T17:20:00.000Z" });
    assert.equal(record.environment.observedIrrelevant.ONTO2D_SESSION_LABEL, "test-capture");
    process.env.TZ = "Europe/Budapest";
    await assert.rejects(() => captureExecution({ executionId: "rejected-capture", parameterSet: "baseline" }), /capture environment TZ/);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
