import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildGalacticArchaeologyCase, verifyGalacticArchaeologyCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/galactic-archaeology.json", import.meta.url);
const sourceUrl = new URL("../source/gaia-dr3-chemical-cartography.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const generatorUrl = new URL("../prepare-source.py", import.meta.url);
const schemaUrl = new URL("../schema/galactic-archaeology.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:galactic-archaeology-case:v1", basis);
  return artifact;
};

test("the frozen Galactic Archaeology artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildGalacticArchaeologyCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyGalacticArchaeologyCaseIdentity(committed).caseIdentity, "sha256:6aa7196a4aa160eecf1938e829ee92342ac4c09263e9a0570d3699f157b64bf0");
});

test("the source projection and its generator match exact offline byte locks", async () => {
  const [bytes, generator, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(generatorUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  assert.equal(bytes.length, upstream.snapshot.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), upstream.snapshot.sha256);
  assert.equal(artifact.source.snapshotIdentity, `sha256:${upstream.snapshot.sha256}`);
  assert.equal(generator.length, upstream.projectionGenerator.bytes);
  assert.equal(createHash("sha256").update(generator).digest("hex"), upstream.projectionGenerator.sha256);
  assert.equal(artifact.source.authoredFiles.find(({ path }) => path === "prepare-source.py")?.identity, `sha256:${upstream.projectionGenerator.sha256}`);
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.deepEqual(artifact.source.tableLocks.map(({ doi }) => doi), ["10.17876/gaia/dr.3/1", "10.17876/gaia/dr.3/43", "10.17876/gaia/dr.3/99"]);
});

test("the cohort is balanced across four explicit rule profiles and two quality strata", async () => {
  const artifact = await load();
  const counts = new Map();
  for (const record of artifact.records) {
    const key = `${record.ruleProfileId}:${record.qualityProfile}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    assert.equal(record.assignment.ruleProfileId, record.ruleProfileId);
    assert.equal(record.assignment.nativeGaiaLabel, false);
  }
  assert.deepEqual([...counts.values()], Array(8).fill(8));
  assert.equal(artifact.cohort.completePopulationClaim, false);
});

test("every parameter and orbit estimate retains its interval and evidence class", async () => {
  const artifact = await load();
  const interval = (value) => assert.ok(Number.isFinite(value.lower) && value.lower <= value.point && value.point <= value.upper);
  for (const record of artifact.records) {
    assert.equal(record.observation.evidenceState, "gaia-catalogue-observation");
    assert.equal(record.gaiaEstimate.evidenceState, "gaia-apsis-estimate");
    assert.equal(record.publishedOrbit.evidenceState, "published-companion-derived");
    ["effectiveTemperature", "surfaceGravity", "metallicity", "alphaToIron"].forEach((field) => interval(record.gaiaEstimate[field]));
    ["rplane", "radialVelocity", "verticalVelocity", "azimuthalVelocity", "maximumHeight", "eccentricity", "radialAction", "verticalAction", "azimuthalAction"].forEach((field) => interval(record.publishedOrbit[field]));
  }
  assert.equal(artifact.audit.recordsWithAllFourParameterIntervals, 64);
  assert.equal(artifact.audit.recordsWithAllNineOrbitIntervals, 64);
  assert.equal(artifact.audit.directObservationOrbitPromotions, 0);
});

test("High quality ablation removes exactly the Medium-only half without mutating the source", async () => {
  const artifact = await load();
  assert.deepEqual([artifact.qualityAblation.baseline.sourceCount, artifact.qualityAblation.strict.sourceCount, artifact.qualityAblation.strict.excludedSourceCount], [64, 32, 32]);
  assert.deepEqual(artifact.qualityAblation.strict.summaries.map(({ sourceCount, patternSurvives }) => [sourceCount, patternSurvives]), Array(4).fill([8, true]));
  assert.equal(artifact.qualityAblation.sourceMutation, false);
});

test("evidence ablation withholds history until all bounded layers are visible", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.evidenceAblation.map(({ regime, classificationStatus, historicalInterpretationStatus }) => [regime, classificationStatus, historicalInterpretationStatus]), [
    ["observed-only", "unresolved", "unresolved"],
    ["observed-plus-gaia-derived", "unresolved", "unresolved"],
    ["through-published-derived", "rule-supported", "withheld"],
    ["full-bounded-context", "rule-supported", "candidate-compatibility-only"]
  ]);
});

test("candidate interpretation never becomes origin, ancestry, or one true history", async () => {
  const artifact = await load();
  assert.ok(artifact.historicalInterpretations.every((item) => item.status === "compatible-pattern-only" && !item.recoveredBirthOrigin && !item.commonAncestryClaim && !item.singleFormationHistoryClaim));
  assert.equal(artifact.reconstruction.trueFormationHistoryRecovered, false);
  assert.equal(artifact.reconstruction.alternativeInterpretationsAllowed, true);
  assert.deepEqual([artifact.audit.nativeGaiaPopulationLabelsInvented, artifact.audit.birthOriginClaims, artifact.audit.commonAncestryClaims], [0, 0, 0]);
});

test("Historical Load remains undefined rather than becoming zero", async () => {
  const artifact = await load();
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
  assert.match(artifact.historicalLoad.reason, /undefined must not be displayed as zero/);
});

test("the approved release rejects fully rehashed evidence and quality promotions", async () => {
  const promoted = await load();
  promoted.records[0].assignment.birthOriginClaim = true;
  assert.throws(() => verifyGalacticArchaeologyCaseIdentity(resign(promoted)), /approved Gaia DR3 release/);

  const quality = await load();
  quality.qualityAblation.strict.summaries[0].sourceCount = 16;
  assert.throws(() => verifyGalacticArchaeologyCaseIdentity(resign(quality)), /approved Gaia DR3 release/);
});
