import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOciLayerHistoryModel } from "./oci-layer-history-model.js";

const artifact = JSON.parse(await readFile(new URL("../../cases/oci-layer-history/artifacts/oci-layer-history.json", import.meta.url), "utf8"));

test("browser model validates the exact OCI identity and cost boundaries", () => {
  const model = createOciLayerHistoryModel(artifact);
  assert.equal(model.histories.length, 4);
  assert.equal(model.comparisons.length, 3);
  assert.equal(model.load("layer-count").historicalLoad, 3);
  assert.equal(model.load("transferred-byte-count").historicalLoad, 4608);
  assert.equal(model.deletedHistory.absentFromFinalRootfs, true);
});

test("browser model keeps flattened equality separate from native identities", () => {
  const model = createOciLayerHistoryModel(artifact);
  const result = model.comparison("flattening").results;
  assert.equal(result["flattened-rootfs"].equal, true);
  assert.equal(result["layer-sequence"].equal, false);
  assert.equal(result.manifest.equal, false);
  assert.equal(result["history-equivalence"].equal, true);
});

test("browser model fails closed on render-sensitive substitutions", () => {
  const stateDrift = structuredClone(artifact);
  stateDrift.histories[0].finalRootfs.identity = stateDrift.counterfactuals[0].finalRootfs.identity;
  assert.throws(() => createOciLayerHistoryModel(stateDrift), /final state is detached/);
  const costDrift = structuredClone(artifact);
  costDrift.historicalLoad.results[0].historicalLoad = 2;
  assert.throws(() => createOciLayerHistoryModel(costDrift), /Historical Load is substituted/);
  const nativeCounterfactual = structuredClone(artifact);
  nativeCounterfactual.counterfactuals[0].manifest = artifact.histories[0].manifest;
  assert.throws(() => createOciLayerHistoryModel(nativeCounterfactual), /crossed the native boundary/);
});
