import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildLegalPrecedentCase } from "../../cases/legal-precedent-history/extract.mjs";
import { buildLegalPrecedentRelease, verifyLegalPrecedentRelease } from "./build.mjs";
import { compileLegalPrecedentModelPack, LEGAL_PRECEDENT_MAPPING_VERSION } from "./compiler.mjs";

const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  return { ...basis, caseIdentity: hashCanonical("onto2d:legal-precedent-case:v1", basis) };
};

test("the Legal Precedent compiler emits a valid exact Model Pack", async () => {
  const pack = compileLegalPrecedentModelPack(await buildLegalPrecedentCase());
  assert.equal(verifyModelPack(pack).manifest.model.id, "legal-precedent-history");
  assert.equal(pack.manifest.model.version, "v1-05958887a4ffef41");
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 19, edgeCount: 45 });
  assert.equal(pack.files["model/dictionaries.json"].provenance.mappingVersion, LEGAL_PRECEDENT_MAPPING_VERSION);
});

test("native citation edges compile without authority or binding promotion", async () => {
  const pack = compileLegalPrecedentModelPack(await buildLegalPrecedentCase());
  const citations = pack.files["model/edges.json"].filter((edge) => edge.relation === "cites");
  assert.equal(citations.length, 16);
  assert.ok(citations.every((edge) => edge.relationLayer === "native-citation" && edge.bindingStatus === "unknown" && edge.createsAuthority === false));
  assert.equal(pack.files["model/dictionaries.json"].audit.bindingClaims, 0);
});

test("attributed treatment is a separate node and relation layer", async () => {
  const pack = compileLegalPrecedentModelPack(await buildLegalPrecedentCase());
  const claims = pack.files["model/nodes.json"].filter((node) => node.entityKind === "normative-treatment-claim");
  const relations = pack.files["model/edges.json"].filter((edge) => edge.relationLayer === "normative-treatment");
  assert.equal(claims.length, 4);
  assert.equal(relations.length, 8);
  assert.ok(claims.every((node) => node.bindingStatus === "not-classified" && node.inferredFromCitationCount === false));
});

test("the availability node excludes later opinions and has no future input", async () => {
  const pack = compileLegalPrecedentModelPack(await buildLegalPrecedentCase());
  const edges = pack.files["model/edges.json"];
  assert.deepEqual(edges.filter((edge) => edge.relation === "available-before").map((edge) => edge.target).sort(), ["opinion:brown-i", "opinion:brown-ii", "opinion:cooper", "opinion:griffin"]);
  assert.deepEqual(edges.filter((edge) => edge.relation === "excluded-after-cutoff").map((edge) => edge.target).sort(), ["opinion:alexander", "opinion:swann"]);
  assert.equal(pack.files["model/dictionaries.json"].audit.futureInputEdges, 0);
});

test("date conflicts and counterfactual source preservation survive compilation", async () => {
  const pack = compileLegalPrecedentModelPack(await buildLegalPrecedentCase());
  const nodes = pack.files["model/nodes.json"];
  assert.equal(nodes.filter((node) => node.entityKind === "source-disagreement").length, 2);
  const counterfactual = nodes.find((node) => node.id === "analysis:withhold-brown-ii");
  assert.deepEqual([counterfactual.baseDerivedEdgeCount, counterfactual.remainingDerivedEdgeCount, counterfactual.sourceGraphMutated, counterfactual.legalConclusionAllowed], [10, 6, false, false]);
});

test("the compiler rejects a promoted legal conclusion even after re-signing", async () => {
  const artifact = await buildLegalPrecedentCase();
  artifact.audit.bindingClaims = 1;
  assert.throws(() => compileLegalPrecedentModelPack(resign(artifact)), /legal safety audit differs/);
});

test("the committed Legal Precedent release remains byte-for-byte reproducible", async () => {
  const expected = await buildLegalPrecedentRelease();
  const stored = await verifyLegalPrecedentRelease(expected);
  assert.deepEqual(stored, expected);
  assert.equal(expected.manifest.rootHash, "sha256:c5541db8a9bc669f452a738ccf02d239ae2e2d286e61a5979129fe86275caf2a");
});
