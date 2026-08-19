import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildHistoricalLinguisticsCase } from "../../cases/historical-linguistics/extract.mjs";
import { buildLanguageTransmissionRelease, verifyLanguageTransmissionRelease } from "./build.mjs";
import { compileLanguageTransmissionModelPack } from "./compiler.mjs";

test("the Language Transmission Model Pack reproduces its exact release", async () => { const pack = await buildLanguageTransmissionRelease(); assert.deepEqual(verifyModelPack(pack), pack); assert.deepEqual(await verifyLanguageTransmissionRelease(pack), pack); assert.equal(pack.manifest.model.id, "language-transmission"); assert.match(pack.manifest.model.version, /^v1-[0-9a-f]{16}$/); });
test("classification and borrowing stay in separate relation layers", async () => { const pack = await buildLanguageTransmissionRelease(); const edges = pack.files["model/edges.json"]; assert.equal(edges.filter((edge) => edge.relation === "published-classification-parent").length, 40); assert.equal(edges.filter((edge) => edge.evidenceClass === "wold-borrowing-row").length, 8); assert.ok(edges.filter((edge) => edge.evidenceClass === "wold-borrowing-row").every((edge) => edge.genealogical === false)); });
test("the pack makes source uncertainty, similarity limits, and undefined load queryable", async () => { const pack = await buildLanguageTransmissionRelease(); const nodes = pack.files["model/nodes.json"]; const flagship = nodes.find((node) => node.id === "borrowing:5"); assert.deepEqual([flagship.sourceCertain, flagship.targetBorrowedScore, flagship.genealogicalParent], [true, 0.5, false]); assert.equal(nodes.filter((node) => node.typeRole === "similarity-signal" && node.createsCognacy === false).length, 4); assert.equal(nodes.find((node) => node.typeRole === "historical-load-boundary").value, null); });
test("the compiler rejects a re-signed derived result substitution", async () => { const artifact = structuredClone(await buildHistoricalLinguisticsCase()); artifact.historyEquivalence.comparisons[0].results[0].equal = true; const { caseIdentity: ignored, ...basis } = artifact; artifact.caseIdentity = hashCanonical("onto2d:historical-linguistics-case:v1", basis); assert.throws(() => compileLanguageTransmissionModelPack(artifact), /history-equivalence matrix/); });
test("the compiler rejects a fully rehashed but unapproved language record", async () => {
  const artifact = structuredClone(await buildHistoricalLinguisticsCase());
  artifact.languages[0].lexicalForm.form = "substituted-form";
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:historical-linguistics-case:v1", basis);
  assert.throws(() => compileLanguageTransmissionModelPack(artifact), /not the approved historical-linguistics-v1 release/);
});
