import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildOciLayerHistoryCase,
  calculateHistoricalLoad,
  verifyOciLayerHistoryCaseIdentity
} from "../extract.mjs";
import { generateOciFixture } from "../generate-fixture.mjs";
import { applyLayer, parseLayerTar } from "../src/oci-layout.mjs";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the committed OCI layout and case artifact reproduce byte-for-byte", async () => {
  await generateOciFixture({ verify: true });
  const artifact = await buildOciLayerHistoryCase();
  assert.deepEqual(verifyOciLayerHistoryCaseIdentity(artifact), artifact);
  assert.equal(
    `${JSON.stringify(artifact, null, 2)}\n`,
    await readFile(path.join(CASE_ROOT, "artifacts", "oci-layer-history.json"), "utf8")
  );
});

test("the case artifact conforms to its closed schema", async () => {
  const [artifact, schema] = await Promise.all([
    buildOciLayerHistoryCase(),
    readFile(path.join(CASE_ROOT, "schema", "oci-layer-history.schema.json"), "utf8").then(JSON.parse)
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
});

test("four native OCI manifests retain distinct histories behind one final rootfs", async () => {
  const artifact = await buildOciLayerHistoryCase();
  assert.equal(artifact.histories.length, 4);
  assert.equal(new Set(artifact.histories.map((history) => history.finalRootfs.identity)).size, 1);
  assert.equal(new Set(artifact.histories.map((history) => history.manifest.digest)).size, 4);
  assert.equal(new Set(artifact.histories.map((history) => history.layerSequenceIdentity)).size, 4);
  const flattening = artifact.experiments.find((experiment) => experiment.id === "flattening");
  assert.equal(flattening.results["flattened-rootfs"].equal, true);
  assert.equal(flattening.results["layer-sequence"].equal, false);
  assert.equal(flattening.results.manifest.equal, false);
  assert.equal(flattening.results["history-equivalence"].equal, true);
});

test("whiteouts delete lower-layer files and never become rootfs files", async () => {
  const artifact = await buildOciLayerHistoryCase();
  const history = artifact.histories.find((entry) => entry.id === "history-a");
  const deletion = history.layers.find((layer) => layer.id === "a-delete-a");
  assert.deepEqual(deletion.operations, [{
    kind: "delete-file",
    marker: ".wh.a.txt",
    target: "a.txt",
    existed: true,
    changedBytes: 6
  }]);
  assert.equal(history.finalRootfs.files.some((file) => file.path === "a.txt" || file.path.startsWith(".wh.")), false);
  assert.throws(
    () => applyLayer([], [{ path: ".wh.", bytes: Buffer.alloc(0), size: 0, mode: 420, uid: 0, gid: 0, mtime: 0 }], "invalid"),
    /whiteout marker is invalid/
  );
});

test("reversing an order-sensitive native sequence changes the derived state", async () => {
  const artifact = await buildOciLayerHistoryCase();
  const native = artifact.histories.find((history) => history.id === "history-a");
  const reversed = artifact.counterfactuals.find((history) => history.id === "history-a-reversed");
  assert.equal(reversed.evidenceClass, "counterfactual");
  assert.equal(reversed.manifest, null);
  assert.notEqual(reversed.finalRootfs.identity, native.finalRootfs.identity);
  assert.equal(reversed.finalRootfs.files.some((file) => file.path === "a.txt"), true);
});

test("Historical Load is explicit, cost-relative, and closed to undeclared metrics", async () => {
  const artifact = await buildOciLayerHistoryCase();
  assert.deepEqual(
    artifact.historicalLoad.results.map((result) => [result.costFunction, result.historicalLoad]),
    [
      ["layer-count", 3],
      ["operation-count", 2],
      ["changed-byte-count", 12],
      ["transferred-byte-count", 4608]
    ]
  );
  assert.throws(
    () => calculateHistoricalLoad(artifact.histories, artifact.historicalLoad.profile, "wall-clock-time"),
    /undeclared cost function/
  );
});

test("one changed layer byte fails descriptor verification before interpretation", async () => {
  const artifact = await buildOciLayerHistoryCase();
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-oci-case-"));
  try {
    await cp(CASE_ROOT, temporary, { recursive: true });
    const digest = artifact.histories[0].layers[0].descriptor.digest.slice("sha256:".length);
    const layerPath = path.join(temporary, "fixtures", "oci-layout", "blobs", "sha256", digest);
    const bytes = await readFile(layerPath);
    const mutated = Buffer.from(bytes);
    mutated[512] ^= 0x01;
    await writeFile(layerPath, mutated);
    await assert.rejects(() => buildOciLayerHistoryCase({ caseRoot: temporary }), /content does not match its descriptor/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("counterfactual histories cannot acquire native manifest evidence", async () => {
  const artifact = structuredClone(await buildOciLayerHistoryCase());
  artifact.counterfactuals[0].manifest = artifact.histories[0].manifest;
  assert.throws(() => verifyOciLayerHistoryCaseIdentity(artifact), /counterfactual history crossed the native OCI boundary/);
});

test("signed-looking substitutions of experiments and derived controls fail closed", async () => {
  const experimentMutation = structuredClone(await buildOciLayerHistoryCase());
  experimentMutation.experiments[0].results.manifest.equal = true;
  assert.throws(() => verifyOciLayerHistoryCaseIdentity(experimentMutation), /case experiments are substituted/);

  const counterfactualMutation = structuredClone(await buildOciLayerHistoryCase());
  counterfactualMutation.counterfactuals[0].finalRootfs = counterfactualMutation.histories[0].finalRootfs;
  assert.throws(() => verifyOciLayerHistoryCaseIdentity(counterfactualMutation), /counterfactual history crossed the native OCI boundary or was substituted/);
});

test("the analysis profile inventory is closed and ordered", async () => {
  const artifact = await buildOciLayerHistoryCase();
  const profile = structuredClone(artifact.historicalLoad.profile);
  profile.candidateHistories.reverse();
  assert.throws(
    () => calculateHistoricalLoad(artifact.histories, profile, "layer-count"),
    /analysis candidates differ from the reviewed native history inventory/
  );
});

test("the bounded tar reader rejects damaged checksums", async () => {
  const artifact = await buildOciLayerHistoryCase();
  const digest = artifact.histories[0].layers[0].descriptor.digest.slice("sha256:".length);
  const bytes = await readFile(path.join(CASE_ROOT, "fixtures", "oci-layout", "blobs", "sha256", digest));
  const mutated = Buffer.from(bytes);
  mutated[0] ^= 0x01;
  assert.throws(() => parseLayerTar(mutated), /tar checksum mismatch/);
});
