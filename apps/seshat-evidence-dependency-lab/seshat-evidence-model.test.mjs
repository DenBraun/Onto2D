import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSeshatEvidenceModel } from "./seshat-evidence-model.js";

const artifactUrl = new URL("../../cases/seshat-epistemic-provenance/artifacts/seshat-epistemic-provenance.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the browser model exposes three equal codes with distinct support identities", async () => {
  const model = createSeshatEvidenceModel(await load());
  assert.equal(model.claims.length, 3);
  assert.ok(model.claims.every(({ exactNativeCode, mappedApiValue }) => exactNativeCode === "P" && mappedApiValue === "present"));
  assert.equal(new Set(model.claims.map(({ support }) => support.supportRootHash)).size, 3);
  assert.equal(model.comparison.allNativeValuesEqual, true);
  assert.equal(model.comparison.allExactSupportIdentitiesEqual, false);
  assert.equal(model.source.codebookVersion, "4.20.2021");
  assert.equal(model.source.publicDataLicense, "CC BY-SA 4.0");
});

test("the browser model retains shared source-work fan-out and unavailable cuts", async () => {
  const model = createSeshatEvidenceModel(await load());
  const cahokia = model.support("us_emergent_mississippian_2");
  const pauketatEdges = cahokia.edges.filter(({ from, semanticType }) => from === "source-work:pauketat-2014" && semanticType === "identifies-source-work-for-reference");
  assert.equal(pauketatEdges.length, 2);
  assert.equal(model.sourceWorkGroups("eg_old_k_1").length, 1);
  assert.equal(model.sourceWorkGroups("it_roman_principate").length, 0);
  assert.equal(model.sourceWorkGroups("us_emergent_mississippian_2").length, 3);
  assert.equal(model.claim("it_roman_principate").support.minimumGroupCuts.sourceWork.value, null);
  assert.ok(model.claims.every((claim) => claim.support.minimumGroupCuts.expert.value === null));
  assert.deepEqual(model.claim("eg_old_k_1").support.firstCategoricalFlips.sourceWork, { value: 1, kind: "categorical-value", baselineValue: "present", perturbedValue: null, response: "unresolved", witnessGroupIds: ["group:source-work:partridge-2010"] });
  assert.equal(model.claim("it_roman_principate").support.firstCategoricalFlips.sourceWork.value, null);
});

test("browser ablation exposes only committed raw responses", async () => {
  const model = createSeshatEvidenceModel(await load());
  const analysis = model.ablation("us_emergent_mississippian_2", "group:source-work:pauketat-2014");
  assert.deepEqual(analysis.rawResponse, { kind: "categorical-resolution", baseline: "Resolved", perturbed: "Unknown" });
  assert.equal(analysis.perturbation.rootRetained, false);
  assert.equal(analysis.threshold, null);
  assert.equal(analysis.qualitativeLabel, null);
  assert.equal(analysis.sourceGraphMutated, false);
  assert.throws(() => model.ablation("it_roman_principate", "group:source-work:none"), /no public source-work ablation/);
});

test("the browser model rejects actor, review, and qualitative promotions", async () => {
  const actor = await load();
  actor.supportGraph.groups.push({ id: "group:expert:invented", type: "Expert", label: "Invented", memberNodeIds: ["api-record:eg_old_k_1:road"] });
  assert.throws(() => createSeshatEvidenceModel(actor), /support graph boundary differs|metadata was promoted/);

  const review = await load();
  review.claims[0].support.minimumGroupCuts.reviewEpisode = { value: 1, witnessGroupIds: ["invented"] };
  assert.throws(() => createSeshatEvidenceModel(review), /metadata was promoted/);

  const qualitative = await load();
  qualitative.stressAnalyses[0].qualitativeLabel = "SENSITIVE";
  assert.throws(() => createSeshatEvidenceModel(qualitative), /raw ablation boundary differs/);
});

test("the approved browser model is detached and deeply immutable", async () => {
  const source = await load();
  const model = createSeshatEvidenceModel(source);
  source.claims[0].exactNativeCode = "A";
  assert.equal(model.claims[0].exactNativeCode, "P");
  assert.throws(() => { model.claims[0].exactNativeCode = "A"; }, TypeError);
  assert.throws(() => model.graph.nodes.pop(), TypeError);
});
