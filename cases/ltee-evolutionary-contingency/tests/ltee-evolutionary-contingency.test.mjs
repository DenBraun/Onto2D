import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildLteeEvolutionaryContingencyCase, verifyLteeEvolutionaryContingencyCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/ltee-evolutionary-contingency.json", import.meta.url);
const sourceUrl = new URL("../source/ltee-ara3-citrate-replay.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const generatorUrl = new URL("../prepare-source.py", import.meta.url);
const schemaUrl = new URL("../schema/ltee-evolutionary-contingency.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:ltee-evolutionary-contingency-case:v1", basis);
  return artifact;
};

test("the frozen LTEE artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildLteeEvolutionaryContingencyCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  const schemaMutation = structuredClone(committed);
  schemaMutation.observations[0].inventedGenotype = "unknown";
  assert.equal(validate(schemaMutation), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/observations/0" && keyword === "additionalProperties"));
  const protocolMutation = structuredClone(committed);
  protocolMutation.protocols[0].inventedProtocolField = true;
  assert.equal(validate(protocolMutation), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/protocols/0" && keyword === "additionalProperties"));
  const regimeMutation = structuredClone(committed);
  regimeMutation.reachabilityRegimes[0].inventedClassCount = 16;
  assert.equal(validate(regimeMutation), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/reachabilityRegimes/0" && keyword === "additionalProperties"));
  assert.equal(verifyLteeEvolutionaryContingencyCaseIdentity(committed).caseIdentity, "sha256:e0024fee2f319158b5fc1dc0e30da1a7d641f0763b4f29ad7cc548c46e13d691");
});

test("the source projection and generator match their offline byte locks", async () => {
  const [source, generator, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(generatorUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  assert.equal(source.length, upstream.snapshot.bytes);
  assert.equal(createHash("sha256").update(source).digest("hex"), upstream.snapshot.sha256);
  assert.equal(generator.length, upstream.projectionGenerator.bytes);
  assert.equal(createHash("sha256").update(generator).digest("hex"), upstream.projectionGenerator.sha256);
  assert.equal(artifact.source.snapshotIdentity, `sha256:${upstream.snapshot.sha256}`);
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.equal(upstream.retrievedArticle.redistributedInRepository, false);
});

test("all three replay protocols remain separate and retain exact totals", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.protocols.map(({ id, replicates, independentCitPlusMutants }) => [id, replicates, independentCitPlusMutants]), [["replay-1", 72, 4], ["replay-2", 340, 5], ["replay-3", 2800, 8]]);
  assert.deepEqual(artifact.cohort.replicateCountByProtocol, [72, 340, 2800]);
  assert.equal(artifact.cohort.protocolsPooled, false);
  assert.equal(artifact.audit.protocolsPooled, 0);
});

test("bounded non-observation never becomes impossibility", async () => {
  const artifact = await load();
  const observed = artifact.reachability.backgroundAssessments.filter(({ boundedOutcomeStatus }) => boundedOutcomeStatus === "observed");
  const unresolved = artifact.reachability.backgroundAssessments.filter(({ accessibilityStatus }) => accessibilityStatus === "unresolved");
  assert.deepEqual(observed.map(({ sourceGeneration }) => sourceGeneration), [20000, 27000, 30500, 31000, 31500, 32000, 32500]);
  assert.equal(unresolved.length, 9);
  assert.ok(artifact.observations.every(({ absenceMeansImpossible }) => absenceMeansImpossible === false));
  assert.ok(artifact.reachability.backgroundAssessments.every(({ impossibilityClaim }) => impossibilityClaim === false));
  assert.equal(artifact.audit.impossibilityClaims, 0);
});

test("published statistics remain attributed and expose the replay-2 arithmetic discrepancy", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.publishedStatistics.map(({ expectedMeanGeneration, observedMeanGeneration, meanShiftGenerations, publishedMonteCarloPValue }) => [expectedMeanGeneration, observedMeanGeneration, meanShiftGenerations, publishedMonteCarloPValue]), [[24917, 31750, 6833, 0.0085], [28382, 32100, 3718, 0.0007], [22571, 27563, 4992, 0.0823]]);
  assert.deepEqual(artifact.publishedStatistics.map(({ tableOneMeanMatchesPublishedExpected }) => tableOneMeanMatchesPublishedExpected), [true, false, true]);
  assert.deepEqual(artifact.publishedStatistics.map(({ tableOneReplicateWeightedMean }) => tableOneReplicateWeightedMean.rounded), [24917, 26382, 22571]);
  assert.equal(artifact.sourceDiscrepancies[0].status, "visible-not-resolved");
  assert.equal(artifact.audit.publishedPValuesRecomputed, 0);
});

test("generation identity is not promoted to genotype, clone, or original history", async () => {
  const artifact = await load();
  assert.equal(new Set(artifact.backgrounds.map(({ identity }) => identity)).size, 16);
  assert.ok(artifact.backgrounds.every(({ completeGenotypeAvailableInTable, cloneIdentityAvailableInTable, potentiationStatusFromGenerationAlone }) => !completeGenotypeAvailableInTable && !cloneIdentityAvailableInTable && potentiationStatusFromGenerationAlone === "unresolved"));
  assert.equal(artifact.publishedInterpretation.potentiatingMutationIdentifiedBySelectedTables, false);
  assert.equal(artifact.publishedInterpretation.generationUniquelyDeterminesPotentiation, false);
  assert.equal(artifact.audit.causalMutationEdges, 0);
  assert.equal(artifact.audit.replayHistoriesPromotedToOriginalHistory, 0);
});

test("Historical Load stays undefined instead of becoming zero", async () => {
  const artifact = await load();
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
  assert.match(artifact.historicalLoad.reason, /undefined must not be displayed as zero/);
});

test("the approved release rejects fully rehashed epistemic promotions", async () => {
  const impossible = await load();
  impossible.observations[0].absenceMeansImpossible = true;
  assert.throws(() => verifyLteeEvolutionaryContingencyCaseIdentity(resign(impossible)), /approved release/);

  const pooled = await load();
  pooled.cohort.protocolsPooled = true;
  assert.throws(() => verifyLteeEvolutionaryContingencyCaseIdentity(resign(pooled)), /approved release/);

  const causal = await load();
  causal.audit.causalMutationEdges = 1;
  assert.throws(() => verifyLteeEvolutionaryContingencyCaseIdentity(resign(causal)), /approved release/);

  const loadPromoted = await load();
  loadPromoted.historicalLoad = { status: "evaluated", value: 0, reason: "invented" };
  assert.throws(() => verifyLteeEvolutionaryContingencyCaseIdentity(resign(loadPromoted)), /approved release/);
});
