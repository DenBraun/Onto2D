import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildMineralFormationHistoryCase, verifyMineralFormationHistoryCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/mineral-formation-history.json", import.meta.url);
const sourceUrl = new URL("../source/gregory-2019-pyrite-nodules.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const generatorUrl = new URL("../prepare-source.py", import.meta.url);
const schemaUrl = new URL("../schema/mineral-formation-history.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:mineral-formation-history-case:v1", basis);
  return artifact;
};

test("the frozen Mineral Formation History artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildMineralFormationHistoryCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  const mutation = structuredClone(committed);
  mutation.samples[0].unreviewedFormation = "invented";
  assert.equal(validate(mutation), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/samples/0" && keyword === "additionalProperties"));
  const malformedExperiment = structuredClone(committed);
  malformedExperiment.experiments[3].unresolvedCount = 7;
  assert.equal(validate(malformedExperiment), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/experiments/3" && keyword === "oneOf"));
  assert.equal(verifyMineralFormationHistoryCaseIdentity(committed).caseIdentity, "sha256:10b59cb71e26bb07e7a88139f639d5a416d20674b63ff5165a75d03d1b23cf9c");
});

test("the source projection and generator match exact offline locks", async () => {
  const [source, generator, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(generatorUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  assert.equal(source.length, upstream.snapshot.bytes);
  assert.equal(createHash("sha256").update(source).digest("hex"), upstream.snapshot.sha256);
  assert.equal(generator.length, upstream.projectionGenerator.bytes);
  assert.equal(createHash("sha256").update(generator).digest("hex"), upstream.projectionGenerator.sha256);
  assert.equal(artifact.source.snapshotIdentity, `sha256:${upstream.snapshot.sha256}`);
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.deepEqual(artifact.source.inputFiles.map(({ sha256, bytes }) => [sha256.length, bytes > 0]), Array(2).fill([64, true]));
});

test("all source sample and LA-ICP-MS rows remain attributable", async () => {
  const artifact = await load();
  assert.equal(artifact.samples.length, 10);
  assert.equal(artifact.analyses.length, 95);
  assert.equal(new Set(artifact.samples.map(({ sampleId }) => sampleId)).size, 10);
  assert.equal(new Set(artifact.analyses.map(({ analysisId }) => analysisId)).size, 95);
  assert.equal(artifact.samples.reduce((sum, sample) => sum + sample.analysisIdentities.length, 0), 95);
  assert.deepEqual([artifact.measurementColumns.X, artifact.measurementColumns.Y, artifact.measurementColumns.Z], ["Pb_Py", "Pb_Py", "Pb_Py"]);
  assert.equal(artifact.audit.duplicateLeadHeadingsRenamed, 0);
});

test("species, sample, and formation identity remain different regimes", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.identityRegimes.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [["conventional-species", 1, 0], ["sample-record", 10, 0], ["published-formation-profile", 3, 7]]);
  assert.deepEqual(artifact.formationClaims.map(({ sampleId, qualifier }) => [sampleId, qualifier]), [["DD86WRL1-681", "predominantly"], ["PETR14", "predominantly"], ["79990", "interpreted"]]);
  assert.ok(artifact.samples.filter(({ formationMappingStatus }) => formationMappingStatus === "unmapped-within-bounded-case").every(({ sampleId }) => !["DD86WRL1-681", "PETR14", "79990"].includes(sampleId)));
});

test("Historical Load and missing mappings stay explicitly undefined", async () => {
  const artifact = await load();
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
  assert.equal(artifact.audit.automaticFormationClassifications, 0);
  assert.equal(artifact.audit.localityToFormationInferences, 0);
  assert.equal(artifact.audit.ageToFormationInferences, 0);
  assert.equal(artifact.audit.onto2dGeneratedCausalEdges, 0);
});

test("the approved release rejects rehashed claim and epistemic promotions", async () => {
  const autoClassified = await load();
  autoClassified.audit.automaticFormationClassifications = 1;
  assert.throws(() => verifyMineralFormationHistoryCaseIdentity(resign(autoClassified)), /approved release/);

  const strengthened = await load();
  strengthened.formationClaims[0].qualifier = "proven";
  assert.throws(() => verifyMineralFormationHistoryCaseIdentity(resign(strengthened)), /approved release/);

  const loadPromoted = await load();
  loadPromoted.historicalLoad = { status: "evaluated", value: 0, reason: "invented" };
  assert.throws(() => verifyMineralFormationHistoryCaseIdentity(resign(loadPromoted)), /approved release/);
});
