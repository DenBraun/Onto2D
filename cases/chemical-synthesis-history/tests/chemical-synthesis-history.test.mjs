import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import {
  buildChemicalSynthesisHistoryCase,
  calculateChemicalHistoricalLoad,
  preserveOptionalMeasurement,
  verifyChemicalSynthesisHistoryCaseIdentity
} from "../extract.mjs";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASE_DOMAIN = "onto2d:chemical-synthesis-history-case:v1";

function reSign(artifact) {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical(CASE_DOMAIN, basis);
  return artifact;
}

test("the pinned ORD projections reproduce the committed case artifact byte-for-byte", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  assert.deepEqual(verifyChemicalSynthesisHistoryCaseIdentity(artifact), artifact);
  assert.equal(await readFile(path.join(CASE_ROOT, "artifacts", "chemical-synthesis-history.json"), "utf8"), `${JSON.stringify(artifact, null, 2)}\n`);
});

test("the case artifact conforms to its closed top-level schema", async () => {
  const [artifact, schema] = await Promise.all([
    buildChemicalSynthesisHistoryCase(),
    readFile(path.join(CASE_ROOT, "schema", "chemical-synthesis-history.schema.json"), "utf8").then(JSON.parse)
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
});

test("five exact product identifiers each retain two distinct native route fragments", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  assert.equal(artifact.cohorts.conditionSweep.targets.length, 5);
  assert.equal(artifact.cohorts.conditionSweep.targets.flatMap((target) => target.routes).length, 10);
  for (const experiment of artifact.experiments.filter((entry) => entry.id.startsWith("same-target-different-route:"))) {
    assert.equal(experiment.exactProductIdentifierEqual, true);
    assert.equal(experiment.nativeRecordIdentityEqual, false);
    assert.equal(experiment.routeIdentityEqual, false);
    assert.ok(experiment.recordedYieldDifferencePercentagePoints > 0);
  }
});

test("exact source SMILES preserves stereochemistry and performs no hidden normalization", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  assert.equal(artifact.identityProfiles.targetIdentity.normalization, "none");
  assert.match(artifact.identityProfiles.targetIdentity.stereochemistry, /preserved exactly/);
  const cascadeProducts = artifact.cohorts.linkedCascade.records.map((record) => record.desiredProduct.smiles);
  assert.ok(cascadeProducts.some((smiles) => smiles.includes("@@")));
});

test("native reaction_id references, including source multiplicity, are preserved as continuity evidence", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  const records = artifact.cohorts.linkedCascade.records;
  assert.deepEqual(records[1].crossReferencedReactionIds, [records[0].reactionId, records[0].reactionId]);
  assert.deepEqual(records[2].crossReferencedReactionIds, [records[1].reactionId]);
  const continuity = artifact.experiments.find((entry) => entry.id === "native-cross-reference-continuity:islatravir");
  assert.deepEqual(continuity.supportedTransitions.map((entry) => entry.nativeReferenceMultiplicity), [2, 1]);
});

test("missing measurements remain null rather than becoming zero", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  assert.equal(artifact.cohorts.linkedCascade.records[1].outcomes[0].yieldPercentage, null);
  assert.equal(preserveOptionalMeasurement(null, "yield"), null);
  assert.equal(preserveOptionalMeasurement(0, "yield"), 0);
  assert.throws(() => preserveOptionalMeasurement("0", "yield"), /finite or null/);
});

test("Historical Load is +2 only in the declared four-route analysis space", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  assert.deepEqual(artifact.historicalLoad.results.map((result) => [result.costFunction, result.historicalLoad]), [
    ["reaction-record-count", 2],
    ["recorded-intermediate-count", 2]
  ]);
  assert.throws(() => calculateChemicalHistoricalLoad(artifact.pathSpace.routes, artifact.historicalLoad.profile, "yield-score"), /undeclared Historical Load cost/);
  assert.throws(() => calculateChemicalHistoricalLoad(artifact.pathSpace.routes.slice(1), artifact.historicalLoad.profile, "reaction-record-count"), /route space differs/);
});

test("counterfactual promotion, route reordering, and result mutation fail closed", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  const promoted = structuredClone(artifact);
  promoted.pathSpace.routes[0].actual = true;
  assert.throws(() => verifyChemicalSynthesisHistoryCaseIdentity(promoted), /route space was substituted|promoted/);
  const reordered = structuredClone(artifact);
  reordered.cohorts.conditionSweep.targets[0].routes.reverse();
  assert.throws(() => verifyChemicalSynthesisHistoryCaseIdentity(reordered), /experiment results were substituted/);
  const changed = structuredClone(artifact);
  changed.historicalLoad.results[0].historicalLoad = 999;
  assert.throws(() => verifyChemicalSynthesisHistoryCaseIdentity(changed), /Historical Load result was substituted/);
});

test("re-signed source identity and dataset-reference substitutions fail closed", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();

  const source = structuredClone(artifact);
  source.source.identity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => verifyChemicalSynthesisHistoryCaseIdentity(reSign(source)), /source identity was substituted/);

  const dataset = structuredClone(artifact);
  dataset.source.externalFiles[0].datasetId = dataset.ord.datasets[1].datasetId;
  assert.throws(() => verifyChemicalSynthesisHistoryCaseIdentity(reSign(dataset)), /external source lock differs/);
});

test("identifier matching is never represented as physical-batch continuity", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  assert.match(artifact.identityProfiles.continuityRule.rule, /never a physical-batch relation/);
  assert.ok(artifact.evidenceBoundary.nonClaims.includes("exact product SMILES equality proves physical-batch continuity"));
});
