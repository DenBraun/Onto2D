import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildOciLayerHistoryCase } from "../../cases/oci-layer-history/extract.mjs";
import {
  buildOciLayerProvenanceRelease,
  verifyOciLayerProvenanceRelease
} from "./build.mjs";
import { compileOciLayerProvenanceModelPack } from "./compiler.mjs";

const CASE_IDENTITY_DOMAIN = "onto2d:oci-layer-history-case:v1";

function resignCase(artifact) {
  const { caseIdentity: _caseIdentity, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical(CASE_IDENTITY_DOMAIN, basis);
  return artifact;
}

test("the OCI Model Pack is valid, separate, and evidence-layered", async () => {
  const pack = await buildOciLayerProvenanceRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.equal(pack.manifest.model.id, "oci-layer-provenance");
  assert.match(pack.manifest.model.version, /^v1-[0-9a-f]{16}$/);
  assert.equal(pack.files["model/nodes.json"].some((node) => node.entityKind === "oci-filesystem-state"), true);
  assert.equal(pack.files["model/edges.json"].some((edge) => edge.relation === "references-layer" && edge.relationLayer === "native"), true);
  assert.equal(pack.files["model/edges.json"].some((edge) => edge.relation === "next-state" && edge.relationLayer === "derived"), true);
  assert.deepEqual(pack.files["model/dictionaries.json"].audit.historicalLoad.map((entry) => entry.value), [3, 2, 12, 4608]);
});

test("four native histories converge only in the derived final state", async () => {
  const pack = await buildOciLayerProvenanceRelease();
  const nodes = pack.files["model/nodes.json"];
  const histories = nodes.filter((node) => node.entityKind === "oci-history-record");
  assert.equal(histories.length, 4);
  assert.equal(new Set(histories.map((node) => node.manifestIdentity)).size, 4);
  assert.equal(new Set(histories.map((node) => node.layerSequenceIdentity)).size, 4);
  assert.equal(new Set(histories.map((node) => node.finalRootfsIdentity)).size, 1);
});

test("the committed content-addressed OCI release reproduces exactly", async () => {
  const pack = await buildOciLayerProvenanceRelease();
  const verified = await verifyOciLayerProvenanceRelease(pack);
  assert.equal(verified.manifest.rootHash, pack.manifest.rootHash);
});

test("the compiler rejects a re-signed substituted derived state", async () => {
  const artifact = structuredClone(await buildOciLayerHistoryCase());
  artifact.histories[0].layers[0].stateAfter.files[0].contentUtf8 = "substituted\n";
  resignCase(artifact);
  assert.throws(() => compileOciLayerProvenanceModelPack(artifact), /state projection is substituted/);
});

test("the compiler rejects counterfactual evidence relabeled as native", async () => {
  const artifact = structuredClone(await buildOciLayerHistoryCase());
  artifact.counterfactuals[0].evidenceClass = "native-oci-layout";
  resignCase(artifact);
  assert.throws(() => compileOciLayerProvenanceModelPack(artifact), /counterfactual history crossed the native OCI boundary/);
});
