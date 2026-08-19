import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildMaterialProcessHistoryCase } from "../../cases/material-process-history/extract.mjs";
import { compileMaterialProcessHistoryModelPack } from "./compiler.mjs";

test("Material Process History compiles deterministically into a valid Model Pack", async () => {
  const artifact = await buildMaterialProcessHistoryCase();
  const first = compileMaterialProcessHistoryModelPack(artifact);
  const second = compileMaterialProcessHistoryModelPack(artifact);
  assert.deepEqual(first, second);
  assert.equal(verifyModelPack(first).manifest.rootHash, first.manifest.rootHash);
  assert.equal(first.manifest.model.id, "material-process-history");
  assert.equal(first.manifest.statistics.nodeCount, 54);
  assert.equal(first.manifest.statistics.edgeCount, 68);
});

test("compiled relations preserve provenance without causal promotion", async () => {
  const pack = compileMaterialProcessHistoryModelPack(await buildMaterialProcessHistoryCase());
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "am-build").length, 3);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "am-part").length, 3);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "strain-height-slice").length, 24);
  assert.equal(edges.filter(({ relation }) => relation === "measures").length, 1);
  assert.deepEqual(edges.filter(({ relation }) => relation === "measures").map(({ source, target }) => [source, target]), [["measurement:b7-p3-residual-strain", "part:AMB2022-718-AMMT-B7-P3"]]);
  assert.ok(edges.every(({ causal, genealogical }) => causal === false && genealogical === false));
  assert.ok(edges.every(({ relation }) => !["causes", "caused-by", "inherits-state-from"].includes(relation)));
  assert.equal(pack.files["model/dictionaries.json"].audit.fullSourceStrainPoints, 2248);
  assert.equal(pack.files["model/dictionaries.json"].audit.missingSiblingMeasurementsCopied, 0);
});

test("compiled recipe equality does not merge build or part nodes", async () => {
  const pack = compileMaterialProcessHistoryModelPack(await buildMaterialProcessHistoryCase());
  const nodes = pack.files["model/nodes.json"];
  assert.equal(new Set(nodes.filter(({ entityKind }) => entityKind === "am-build").map(({ buildIdentity }) => buildIdentity)).size, 3);
  assert.equal(new Set(nodes.filter(({ entityKind }) => entityKind === "build-process").map(({ recipeIdentity }) => recipeIdentity)).size, 1);
  assert.equal(new Set(nodes.filter(({ entityKind }) => entityKind === "am-part").map(({ partIdentity }) => partIdentity)).size, 3);
  assert.deepEqual(nodes.filter(({ entityKind }) => entityKind === "am-part").map(({ residualStrainMeasurementAvailable }) => residualStrainMeasurementAvailable), [false, true, false]);
});

test("compiler rejects a changed case even when its outer hash is recomputed", async () => {
  const artifact = structuredClone(await buildMaterialProcessHistoryCase());
  artifact.audit.causalEdges = 1;
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:material-process-history-case:v1", basis);
  assert.throws(() => compileMaterialProcessHistoryModelPack(artifact), /not the approved release/);
});
