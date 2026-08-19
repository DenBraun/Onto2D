import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCellLineageModel, EXPECTED_CELL_LINEAGE_CASE_IDENTITY } from "./cell-lineage-model.js";

const artifactUrl = new URL("../../cases/cell-lineage-identity/artifacts/cell-lineage-identity.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the browser model accepts the exact approved artifact", async () => {
  const model = createCellLineageModel(await load());
  assert.equal(model.caseIdentity, EXPECTED_CELL_LINEAGE_CASE_IDENTITY);
  assert.deepEqual([model.cells.length, model.clusters.length, model.barcodes.length, model.firstFourTargetSignatures.length], [750, 56, 192, 133]);
  assert.deepEqual(model.regimes.map(({ id, actualClassCount }) => [id, actualClassCount]), [["cell-record", 750], ["transcriptomic-cluster", 56], ["observed-barcode-state", 192], ["first-four-target-signature", 133]]);
});

test("cluster and barcode indexes preserve cross-regime differences", async () => {
  const model = createCellLineageModel(await load());
  const cluster20 = model.cluster(20);
  assert.equal(cluster20.label, "fezf1+ neurons");
  assert.equal(model.clusterCells(20).length, cluster20.cellCount);
  assert.ok(model.clusterBarcodes(20).length > 1);
  const shared = model.barcodes.find(({ clusterIds }) => clusterIds.includes(27) && clusterIds.includes(30));
  assert.ok(shared);
  assert.ok(model.barcodeCells(shared.identity).some(({ clusterId }) => clusterId === 27));
  assert.ok(model.barcodeCells(shared.identity).some(({ clusterId }) => clusterId === 30));
});

test("partial observations and undefined Historical Load remain visible", async () => {
  const model = createCellLineageModel(await load());
  assert.equal(model.cells.filter(({ targetCoverage }) => targetCoverage === "partial").length, 16);
  assert.equal(model.comparison("partial-target-coverage").cellCount, 16);
  assert.equal(model.reconstructionBoundary.groupingRepresentsObservedDivision, false);
  assert.equal(model.historicalLoad.value, null);
});

test("the browser model rejects identity and relation mutations", async () => {
  const identityMutation = await load();
  identityMutation.caseIdentity = "sha256:" + "0".repeat(64);
  assert.throws(() => createCellLineageModel(identityMutation), /case identity differs/);

  const relationMutation = await load();
  relationMutation.cells[0].observedBarcodeIdentity = "sha256:" + "f".repeat(64);
  assert.throws(() => createCellLineageModel(relationMutation), /unresolved relation/);

  const membershipMutation = await load();
  membershipMutation.observedBarcodeGroups[0].cellIds[0] = membershipMutation.cells.at(-1).cellId;
  assert.throws(() => createCellLineageModel(membershipMutation), /membership differs/);

  const exampleMutation = await load();
  exampleMutation.comparisons[0].examples[0].clusterId += 1;
  assert.throws(() => createCellLineageModel(exampleMutation), /example differs/);

  const promotion = await load();
  promotion.audit.caseGeneratedDivisionCount = 1;
  assert.throws(() => createCellLineageModel(promotion), /epistemic boundary differs/);
});

test("the browser model is detached and deeply immutable", async () => {
  const input = await load();
  const model = createCellLineageModel(input);
  const sourceHash = model.source.rawArchive.sha256;
  input.source.rawArchive.sha256 = "0".repeat(64);
  input.observedBarcodeGroups[0].cellIds.push("invented-cell");
  assert.equal(model.source.rawArchive.sha256, sourceHash);
  assert.notEqual(model.barcodes[0].cellIds.at(-1), "invented-cell");
  assert.throws(() => { model.source.rawArchive.sha256 = "0".repeat(64); }, TypeError);
  assert.throws(() => { model.barcodes[0].cellIds.push("invented-cell"); }, TypeError);
  assert.throws(() => { model.comparisons[0].examples[0].clusterId = -1; }, TypeError);
});
