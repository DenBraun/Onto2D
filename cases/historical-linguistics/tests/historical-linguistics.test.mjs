import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel";
import { buildHistoricalLinguisticsCase, verifyHistoricalLinguisticsCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/historical-linguistics.json", import.meta.url);
const schemaUrl = new URL("../schema/historical-linguistics.schema.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:historical-linguistics-case:v1", basis);
  return artifact;
};

test("the source-locked Historical Linguistics artifact reproduces exactly and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildHistoricalLinguisticsCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { date: /^\d{4}-\d{2}-\d{2}$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyHistoricalLinguisticsCaseIdentity(committed).caseIdentity, committed.caseIdentity);
});

test("six WOLD records join to Glottolog through stable, unique Glottocodes", async () => {
  const artifact = await load();
  assert.equal(artifact.languages.length, 6);
  assert.equal(new Set(artifact.languages.map((language) => language.glottocode)).size, 6);
  assert.ok(artifact.languages.every((language) => language.identifierMapping.status === "matched-by-glottocode"));
  assert.equal(artifact.languages.find((language) => language.glottocode === "oldh1241").identifierMapping.isoSourceDifference, true);
  assert.ok(artifact.languages.every((language) => language.classificationClaim.groundTruthClaim === false));
});

test("borrowing remains horizontal and preserves two independent uncertainty fields", async () => {
  const artifact = await load();
  assert.ok(artifact.borrowings.every((borrowing) => borrowing.genealogicalParent === false && borrowing.generalizedBeyondTargetForm === false));
  const flagship = artifact.borrowings.find((borrowing) => borrowing.id === "5");
  assert.deepEqual([flagship.sourceGlottocode, flagship.recipientGlottocode, flagship.crossTopLevelFamily], ["stan1293", "mana1288", true]);
  assert.deepEqual([flagship.sourceCertain, flagship.targetBorrowedStatus, flagship.targetBorrowedScore], [true, "3. perhaps borrowed", 0.5]);
  assert.equal(artifact.genealogy.edges.some((edge) => edge.parent === "stan1293" && edge.child === "mana1288"), false);
});

test("surface similarity cannot manufacture cognacy or ancestry", async () => {
  const artifact = await load();
  assert.equal(artifact.surfaceComparisons.length, 4);
  assert.ok(artifact.surfaceComparisons.every((comparison) => comparison.cognacyStatus === "not-asserted" && comparison.createsCognacy === false && comparison.createsGenealogy === false));
  assert.equal(artifact.reconstruction.cognacyAssertions, 0);
  assert.equal(artifact.reconstruction.newPhylogenyInferred, false);
});

test("tree and borrowing layers survive independently and the equivalence matrix is regime-relative", async () => {
  const artifact = await load();
  assert.equal(artifact.reconstruction.verticalEdges, 40);
  assert.equal(artifact.reconstruction.horizontalEdges, 4);
  assert.deepEqual(artifact.historyEquivalence.comparisons.map((comparison) => comparison.results.map((result) => result.equal)), [[false, true, false, false], [false, false, false, false], [false, true, false, true]]);
  assert.equal(artifact.historicalLoad.value, null);
});

test("the verifier rejects a re-signed derived verdict substitution", async () => {
  const artifact = await load();
  artifact.historyEquivalence.comparisons[0].results[0].equal = true;
  assert.throws(() => verifyHistoricalLinguisticsCaseIdentity(resign(artifact)), /history-equivalence matrix/);
});

test("the verifier rejects stale nested genealogy identity after a case rehash", async () => {
  const artifact = await load();
  const edge = artifact.genealogy.edges[0];
  [edge.parent, edge.child] = [edge.child, edge.parent];
  assert.throws(() => verifyHistoricalLinguisticsCaseIdentity(resign(artifact)), /genealogy identity differs/);
});

test("the verifier rejects a fully rehashed source-lock substitution outside the approved release", async () => {
  const artifact = await load();
  artifact.source.snapshotFiles[0].identity = `sha256:${"0".repeat(64)}`;
  artifact.source.identity = hashCanonical("onto2d:historical-linguistics-source:v1", {
    authoredFiles: artifact.source.authoredFiles,
    snapshotFiles: artifact.source.snapshotFiles,
    releases: artifact.source.releases
  });
  assert.throws(() => verifyHistoricalLinguisticsCaseIdentity(resign(artifact)), /not the approved historical-linguistics-v1 release/);
});
