import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel";
import { buildManuscriptStemmaticsCase, verifyManuscriptStemmaticsCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/manuscript-stemmatics.json", import.meta.url);
const schemaUrl = new URL("../schema/manuscript-stemmatics.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:manuscript-stemmatics-case:v1", basis);
  return artifact;
};

test("the source-locked Manuscript Stemmatics artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildManuscriptStemmaticsCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyManuscriptStemmaticsCaseIdentity(committed).caseIdentity, committed.caseIdentity);
});

test("the bounded selection retains the complete source census and honest missingness", async () => {
  const artifact = await load();
  assert.deepEqual([artifact.corpus.witnessCount, artifact.corpus.variantCharacterCount], [58, 4032]);
  assert.deepEqual(artifact.missingData.substantiallyIncompleteWitnessIds, ["Ad2", "Hk", "Ox1", "Ra2"]);
  assert.equal(artifact.missingData.exactMissingRates, null);
  assert.equal(artifact.selection.representativeSampleClaim, false);
});

test("reading agreement cannot create ancestry or collapse sibling witnesses", async () => {
  const artifact = await load();
  const siblings = artifact.agreementComparisons.find((comparison) => comparison.id === "pn-wy");
  assert.deepEqual([siblings.agreementShare, siblings.createsTransmissionRelation, siblings.createsAncestry], [1, false, false]);
  assert.equal(artifact.transmission.relations.some((relation) => relation.source === "Pn" && relation.target === "Wy" || relation.source === "Wy" && relation.target === "Pn"), false);
  assert.notEqual(artifact.witnesses.find((witness) => witness.id === "Pn").identity, artifact.witnesses.find((witness) => witness.id === "Wy").identity);
});

test("Cx2 keeps two attributed inputs and the correction source never becomes a tree edge", async () => {
  const artifact = await load();
  const incoming = artifact.transmission.relations.filter((relation) => relation.target === "Cx2");
  assert.deepEqual(incoming.map((relation) => relation.id), ["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2"]);
  assert.equal(incoming[1].contamination, true);
  assert.equal(incoming[1].treeCompatible, false);
  assert.ok(incoming.every((relation) => relation.directObservation === false));
  assert.deepEqual(artifact.transmission.unresolvedExemplars[0], { id: "better-copy", label: "Caxton's better copy", kind: "unresolved-exemplar-reference", extantWitness: false, exactIdentity: null, inventedByOnto2D: false, sourceClaimId: "claim-caxton-correction" });
});

test("evidence ablation removes exact inputs without rewriting the published source", async () => {
  const artifact = await load();
  for (const run of artifact.evidenceAblation) assert.ok(run.removedEvidenceIds.every((id) => !run.activeEvidenceIds.includes(id)));
  const correction = artifact.evidenceAblation.find((run) => run.id === "without-correction-profile");
  assert.equal(correction.localMultipleParentSupported, false);
  assert.deepEqual(correction.attributedOnlyRelationIds, ["correction-source:better-copy:Cx2"]);
  const examples = artifact.evidenceAblation.find((run) => run.id === "without-example-sites");
  assert.equal(examples.localMultipleParentSupported, true);
  assert.deepEqual(examples.supportedRelationIds, ["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2", "copy:Cx2:Pn", "copy:Cx2:Wy"]);
});

test("history equivalence is regime-relative and Historical Load remains undefined", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.historyEquivalence.comparisons.map((comparison) => comparison.results.map((result) => result.equal)), [[false, true, true, false], [false, true, true, true], [false, false, true, false]]);
  assert.equal(artifact.reconstruction.status, "partial");
  assert.equal(artifact.reconstruction.centralRootingResolved, false);
  assert.equal(artifact.historicalLoad.value, null);
});

test("the verifier rejects re-signed observation and ablation promotions", async () => {
  const observed = await load();
  observed.transmission.relations[0].directObservation = true;
  assert.throws(() => verifyManuscriptStemmaticsCaseIdentity(resign(observed)), /attributed transmission boundary/);

  const retained = await load();
  const run = retained.evidenceAblation.find((candidate) => candidate.id === "without-correction-profile");
  run.activeEvidenceIds.push("claim-correction-profile-207");
  assert.throws(() => verifyManuscriptStemmaticsCaseIdentity(resign(retained)), /ablated evidence remains active/);
});

test("the verifier rejects stale witness identity after a case rehash", async () => {
  const artifact = await load();
  artifact.witnesses[0].label = "Substituted witness label";
  assert.throws(() => verifyManuscriptStemmaticsCaseIdentity(resign(artifact)), /witness Cx1 identity differs/);
});

test("evidence ablation is replayed instead of trusting a rehashed result", async () => {
  const artifact = await load();
  const run = artifact.evidenceAblation.find((candidate) => candidate.id === "full-evidence");
  run.supportedRelationIds = run.supportedRelationIds.slice(1);
  run.withheldRelationIds = ["base-text:Cx1:Cx2"];
  run.localMultipleParentSupported = false;
  run.resultState = "unresolved";
  assert.throws(() => verifyManuscriptStemmaticsCaseIdentity(resign(artifact)), /ablation full-evidence result differs from the evidence policy/);
});

test("the verifier rejects a fully rehashed source-lock substitution outside the approved release", async () => {
  const artifact = await load();
  artifact.source.snapshotFiles[0].identity = `sha256:${"0".repeat(64)}`;
  artifact.source.identity = hashCanonical("onto2d:manuscript-stemmatics-source:v1", {
    authoredFiles: artifact.source.authoredFiles,
    snapshotFiles: artifact.source.snapshotFiles,
    upstreamFiles: artifact.source.upstreamFiles,
    citation: artifact.source.citation
  });
  assert.throws(() => verifyManuscriptStemmaticsCaseIdentity(resign(artifact)), /not the approved manuscript-stemmatics-v1 release/);
});
