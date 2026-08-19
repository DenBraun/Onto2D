import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildMineralFormationHistoryCase } from "../../cases/mineral-formation-history/extract.mjs";
import { buildMineralFormationHistoryRelease, verifyMineralFormationHistoryRelease } from "./build.mjs";
import { compileMineralFormationHistoryModelPack, MINERAL_FORMATION_MAPPING_VERSION } from "./compiler.mjs";

const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  return { ...basis, caseIdentity: hashCanonical("onto2d:mineral-formation-history-case:v1", basis) };
};

test("the Mineral Formation compiler emits a valid exact Model Pack", async () => {
  const pack = compileMineralFormationHistoryModelPack(await buildMineralFormationHistoryCase());
  assert.equal(verifyModelPack(pack).manifest.model.id, "mineral-formation-history");
  assert.equal(pack.manifest.model.version, "v1-cefaa83457ac222c");
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 30, edgeCount: 48 });
  assert.equal(pack.files["model/dictionaries.json"].provenance.mappingVersion, MINERAL_FORMATION_MAPPING_VERSION);
});

test("the Model Pack keeps species, sample, measurement, and interpretation layers separate", async () => {
  const pack = compileMineralFormationHistoryModelPack(await buildMineralFormationHistoryCase());
  const nodes = pack.files["model/nodes.json"];
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "mineral-species").length, 1);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "mineral-sample").length, 10);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "measurement-series").length, 10);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "formation-interpretation").length, 3);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "identity-regime").length, 3);
});

test("only exact published claims interpret samples", async () => {
  const pack = compileMineralFormationHistoryModelPack(await buildMineralFormationHistoryCase());
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.filter(({ relation }) => relation === "interprets-sample").length, 3);
  assert.equal(edges.filter(({ relation }) => relation === "unresolved-under").length, 7);
  assert.ok(edges.filter(({ relation }) => relation === "measured-by-series").every(({ causalFormationClaim }) => causalFormationClaim === false));
  assert.equal(pack.files["model/dictionaries.json"].audit.onto2dGeneratedCausalEdges, 0);
});

test("the compiler rejects an epistemic promotion after re-signing", async () => {
  const artifact = await buildMineralFormationHistoryCase();
  artifact.audit.automaticFormationClassifications = 1;
  assert.throws(() => compileMineralFormationHistoryModelPack(resign(artifact)), /approved release/);
});

test("the committed Mineral Formation release remains byte-for-byte reproducible", async () => {
  const expected = await buildMineralFormationHistoryRelease();
  const stored = await verifyMineralFormationHistoryRelease(expected);
  assert.deepEqual(stored, expected);
  assert.equal(expected.manifest.rootHash, "sha256:759b271dd0da6434e97290d22876b34a7258c27991d0fc4fe158d60e2af72820");
});
