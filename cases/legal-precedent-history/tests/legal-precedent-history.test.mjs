import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel";
import { buildLegalPrecedentCase, verifyLegalPrecedentCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/legal-precedent-history.json", import.meta.url);
const schemaUrl = new URL("../schema/legal-precedent-history.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:legal-precedent-case:v1", basis);
  return artifact;
};

test("the source-locked Legal Precedent artifact reproduces exactly and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildLegalPrecedentCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { date: /^\d{4}-\d{2}-\d{2}$/, "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyLegalPrecedentCaseIdentity(committed).caseIdentity, committed.caseIdentity);
});

test("the Green time slice includes four prior opinions and excludes both later opinions", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.availability.priorOpinionIds, ["brown-i", "brown-ii", "cooper", "griffin"]);
  assert.deepEqual(artifact.availability.futureOpinionIds, ["alexander", "swann"]);
  assert.equal(artifact.availability.cutoffDate, "1968-05-27");
  assert.equal(artifact.availability.futureInputEdgeCount, 0);
  assert.equal(artifact.availability.excludedFutureCitationEdgeIds.length, 6);
});

test("citation stays distinct from attributed treatment and binding status", async () => {
  const artifact = await load();
  assert.equal(artifact.citations.length, 16);
  assert.ok(artifact.citations.every((edge) => edge.relation === "cites" && edge.bindingStatus === "unknown" && edge.createsAuthority === false));
  assert.equal(artifact.normativeClaims.length, 4);
  assert.ok(artifact.normativeClaims.every((claim) => claim.claimScope === "source-attributed-treatment" && claim.bindingStatus === "not-classified" && claim.inferredFromCitationCount === false));
  assert.equal(artifact.audit.bindingClaims, 0);
});

test("provider citation counts cannot manufacture authority", async () => {
  const artifact = await load();
  artifact.opinions.find((opinion) => opinion.id === "brown-i").courtListener.citeCountAtRetrieval = Number.MAX_SAFE_INTEGER;
  assert.throws(() => verifyLegalPrecedentCaseIdentity(resign(artifact)), /not the approved scotus-school-desegregation-green-v1 release/);
  assert.equal((await load()).audit.citationCountsUsedInDerivation, false);
});

test("the verifier rejects a future opinion inserted into an earlier citation context", async () => {
  const artifact = await load();
  const edge = artifact.citations.find((candidate) => candidate.id === "citation:swann:green");
  edge.id = "citation:green:swann";
  [edge.citingOpinionId, edge.citedOpinionId] = [edge.citedOpinionId, edge.citingOpinionId];
  assert.throws(() => verifyLegalPrecedentCaseIdentity(resign(artifact)), /citation chronology/);
});

test("the verifier rejects promotion of a native citation into authority", async () => {
  const artifact = await load();
  artifact.citations[0].bindingStatus = "binding";
  artifact.citations[0].createsAuthority = true;
  assert.throws(() => verifyLegalPrecedentCaseIdentity(resign(artifact)), /native citation boundary/);
});

test("missing treatment and hierarchy remain unknown rather than guessed", async () => {
  const artifact = await load();
  const treated = new Set(artifact.normativeClaims.map((claim) => claim.citationId));
  assert.equal(artifact.citations.filter((edge) => !treated.has(edge.id)).length, 12);
  assert.ok(artifact.citations.filter((edge) => !treated.has(edge.id)).every((edge) => edge.bindingStatus === "unknown"));
  assert.equal(artifact.audit.courtHierarchyGuessed, false);
});

test("provider date disagreements remain visible and use GovInfo only for the declared time slice", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.dateDisagreements.map((item) => [item.opinionId, item.officialDecisionDate, item.courtListenerDateFiled]), [
    ["cooper", "1958-09-12", "1958-10-06"],
    ["swann", "1971-04-20", "1971-06-07"]
  ]);
  assert.equal(artifact.availability.dateAuthority, "govinfo-official-decision-date");
});

test("counterfactual removal changes only the derived view", async () => {
  const artifact = await load();
  assert.deepEqual([artifact.counterfactual.baseDerivedEdgeCount, artifact.counterfactual.remainingDerivedEdgeCount], [10, 6]);
  assert.deepEqual(artifact.counterfactual.reachableFromTargetAfterRemoval, ["brown-i", "cooper", "griffin"]);
  assert.deepEqual([artifact.counterfactual.sourceOpinionCountAfterAnalysis, artifact.counterfactual.sourceCitationCountAfterAnalysis, artifact.counterfactual.sourceGraphMutated], [7, 16, false]);
  assert.equal(artifact.counterfactual.legalConclusionAllowed, false);
});

test("Historical Load is explicitly undefined and no legal advice is generated", async () => {
  const artifact = await load();
  assert.deepEqual([artifact.historicalLoad.status, artifact.historicalLoad.value], ["not-evaluated", null]);
  assert.equal(artifact.audit.legalAdviceGenerated, false);
  assert.match(artifact.legalDisclaimer, /not legal advice/);
});
