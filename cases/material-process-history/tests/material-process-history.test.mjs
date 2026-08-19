import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildMaterialProcessHistoryCase, verifyMaterialProcessHistoryCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/material-process-history.json", import.meta.url);
const sourceUrl = new URL("../source/ambench-2022-01-material-process.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const generatorUrl = new URL("../prepare-source.py", import.meta.url);
const schemaUrl = new URL("../schema/material-process-history.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:material-process-history-case:v1", basis);
  return artifact;
};

test("the frozen Material Process History artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildMaterialProcessHistoryCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  const schemaMutation = structuredClone(committed);
  schemaMutation.builds[0].thermography.unreviewedField = true;
  assert.equal(validate(schemaMutation), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/builds/0/thermography" && keyword === "additionalProperties"));
  assert.equal(verifyMaterialProcessHistoryCaseIdentity(committed).caseIdentity, "sha256:3a56371445a7b1b9e18da9fbff2dbe0d8ace1d289ef519998a4cf90aa4dd5889");
});

test("the projection and generator match their exact offline locks", async () => {
  const [source, generator, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(generatorUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  assert.equal(source.length, upstream.snapshot.bytes);
  assert.equal(createHash("sha256").update(source).digest("hex"), upstream.snapshot.sha256);
  assert.equal(generator.length, upstream.projectionGenerator.bytes);
  assert.equal(createHash("sha256").update(generator).digest("hex"), upstream.projectionGenerator.sha256);
  assert.equal(artifact.source.snapshotIdentity, `sha256:${upstream.snapshot.sha256}`);
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.deepEqual(artifact.source.inputFiles.map(({ sha256, bytes }) => [sha256.length, bytes > 0]), Array(14).fill([64, true]));
});

test("one nominal material and recipe retain three build and part identities", async () => {
  const artifact = await load();
  assert.equal(new Set(artifact.builds.map(({ identity }) => identity)).size, 3);
  assert.equal(new Set(artifact.builds.map(({ process }) => process.recipeIdentity)).size, 1);
  assert.equal(new Set(artifact.builds.map(({ comparisonPart }) => comparisonPart.identity)).size, 3);
  assert.deepEqual(artifact.identityRegimes.map(({ id, classes }) => [id, classes.length]), [["nominal-material", 1], ["nominal-recipe", 1], ["build-record", 3], ["part-record", 3], ["measured-state", 1]]);
});

test("residual strain stays a coordinate-bearing B7-P3 measurement", async () => {
  const artifact = await load();
  assert.equal(artifact.residualStrain.targetPartId, "AMB2022-718-AMMT-B7-P3");
  assert.equal(artifact.residualStrain.points.length, 2248);
  assert.equal(new Set(artifact.residualStrain.points.map(({ xMm, yMm, zMm }) => `${xMm}|${yMm}|${zMm}`)).size, 2248);
  assert.ok(artifact.residualStrain.points.every(({ yMm }) => yMm === 2.5));
  assert.deepEqual([artifact.residualStrain.summary.xx.minimum.value, artifact.residualStrain.summary.xx.maximum.value, artifact.residualStrain.summary.zz.minimum.value, artifact.residualStrain.summary.zz.maximum.value], [-0.003471, 0.003146, -0.004296, 0.004087]);
  assert.equal(artifact.residualStrain.estimatedMeasurementUncertainty.value, 0.0001);
  assert.deepEqual(artifact.identityRegimes.at(-1).unresolved, ["AMB2022-718-AMMT-B6-P3", "AMB2022-718-AMMT-B8-P3"]);
  assert.equal(artifact.audit.missingSiblingMeasurementsCopied, 0);
});

test("thermography, residual strain, and source anomalies remain separate", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.builds.map(({ thermography }) => thermography.tam.filename), ["AMB2022-01-718-AMMT-B6-P1-StaringCamera_TAM.h5", "AMB2022-01-718-AMMT-B7-P1-StaringCamera_TAM.h5", "AMB2022-01-718-AMMT-B8-P1-StaringCamera_TAM.h5"]);
  assert.deepEqual(artifact.builds.map(({ thermography }) => thermography.solidCoolingRate.filename), Array(3).fill("AMB2022-01-718-AMMT-B6-P1-StaringCamera_SCR.h5"));
  assert.deepEqual(artifact.builds.map(({ thermography }) => thermography.solidCoolingRate.dataDoi), ["10.18434/mds2-2720", "10.18434/mds2-2721", "10.18434/mds2-2722"]);
  assert.equal(artifact.audit.sourceFilenameCorrectionsInvented, 0);
  assert.equal(artifact.audit.causalEdges, 0);
});

test("Historical Load remains undefined rather than becoming zero", async () => {
  const artifact = await load();
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
  assert.match(artifact.historicalLoad.reason, /undefined must not be displayed as zero/);
});

test("the approved release rejects fully rehashed identity, measurement, and causal promotions", async () => {
  const merged = await load();
  merged.builds[1].identity = merged.builds[0].identity;
  assert.throws(() => verifyMaterialProcessHistoryCaseIdentity(resign(merged)), /approved release/);

  const copied = await load();
  copied.audit.missingSiblingMeasurementsCopied = 1;
  assert.throws(() => verifyMaterialProcessHistoryCaseIdentity(resign(copied)), /approved release/);

  const causal = await load();
  causal.audit.causalEdges = 1;
  assert.throws(() => verifyMaterialProcessHistoryCaseIdentity(resign(causal)), /approved release/);

  const loadPromoted = await load();
  loadPromoted.historicalLoad = { status: "evaluated", value: 0, reason: "invented" };
  assert.throws(() => verifyMaterialProcessHistoryCaseIdentity(resign(loadPromoted)), /approved release/);
});
