import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashArtifactBytes } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import {
  extractCase,
  verifySourceInputs
} from "../../cases/live-bootstrap-provenance/extract.mjs";
import {
  buildLiveBootstrapRelease,
  verifyLiveBootstrapRelease
} from "./build.mjs";
import { compileLiveBootstrapModelPack } from "./compiler.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const CASE_ROOT = path.join(REPOSITORY_ROOT, "cases/live-bootstrap-provenance");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("the external provenance Model Pack is valid, separate, and evidence-classified", async () => {
  const pack = await buildLiveBootstrapRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.equal(pack.manifest.model.id, "live-bootstrap-provenance");
  assert.notEqual(pack.manifest.model.id, "causal-emergence");
  assert.equal(pack.manifest.statistics.nodeCount, 434);
  assert.equal(pack.manifest.statistics.edgeCount, 442);
  assert.match(pack.manifest.model.version, /^v2-[0-9a-f]{16}$/);
  assert.match(pack.manifest.rootHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(pack.files["model/nodes.json"].some((node) =>
    node.id.startsWith("counterfactual:")
  ), false);
  assert.equal(pack.files["model/edges.json"].some((edge) =>
    edge.relation.includes("counterfactual") || edge.evidenceClass === "inferred-dependency"
  ), false);
  assert.equal(
    pack.files["model/dictionaries.json"].provenance.nonEndorsement,
    "live-bootstrap does not endorse Onto2D or any Onto2D analysis."
  );
  assert.equal(
    pack.files["model/dictionaries.json"].presentation.labels.catalogTitle,
    "Bootstrap entities"
  );
});

test("every imported entity and relation retains inspectable provenance", async () => {
  const pack = await buildLiveBootstrapRelease();
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.every((node) =>
    node.provenance?.layer === "upstream-fact" || node.provenance?.layer === "derived-fact"
  ), true);
  assert.equal(edges.every((edge) =>
    typeof edge.claim === "string"
    && edge.claim.length > 0
    && typeof edge.method === "string"
    && edge.sourceLocation?.path
    && Number.isInteger(edge.sourceLocation.line)
  ), true);
  const observed = edges.find((edge) => edge.evidenceClass === "observed-order");
  assert.equal(observed.relation, "observed-after");
  const unknown = edges.find((edge) => edge.evidenceClass === "unknown");
  assert.equal(unknown.evidenceStatus, "unknown");
  assert.equal(unknown.relation, "compiler-selection-unresolved");
});

test("the committed content-addressed release reproduces exactly", async () => {
  const pack = await buildLiveBootstrapRelease();
  const verified = await verifyLiveBootstrapRelease(pack);
  assert.equal(verified.manifest.rootHash, pack.manifest.rootHash);
});

test("changing one consumed upstream byte changes source, release, and Model Pack identity", async () => {
  const [lock, evidenceProfile] = await Promise.all([
    readJson(path.join(CASE_ROOT, "upstream.json")),
    readJson(path.join(CASE_ROOT, "evidence-profile.json"))
  ]);
  const originalInputs = await verifySourceInputs(lock);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "onto2d-model-source-drift-"));
  try {
    for (const [relative, bytes] of originalInputs.inputs) {
      const target = path.join(temporaryRoot, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    const manifestPath = path.join(temporaryRoot, "steps/manifest");
    const changedManifest = Buffer.from(originalInputs.inputs.get("steps/manifest"));
    const marker = changedManifest.indexOf(Buffer.from("2023 Samuel Tyler"));
    assert.notEqual(marker, -1);
    changedManifest[marker + 3] = "4".charCodeAt(0);
    await writeFile(manifestPath, changedManifest);
    const changedLock = structuredClone(lock);
    changedLock.files.find((file) => file.path === "steps/manifest").sha256 =
      hashArtifactBytes(changedManifest);

    const [originalArtifacts, changedArtifacts] = await Promise.all([
      extractCase(),
      extractCase({
        lockInput: changedLock,
        evidenceProfileInput: evidenceProfile,
        upstreamRoot: temporaryRoot
      })
    ]);
    const originalPack = compileLiveBootstrapModelPack(originalArtifacts);
    const changedPack = compileLiveBootstrapModelPack(changedArtifacts);
    assert.notEqual(
      originalArtifacts.trace.source.sourceIdentity,
      changedArtifacts.trace.source.sourceIdentity
    );
    assert.notEqual(originalPack.manifest.model.version, changedPack.manifest.model.version);
    assert.notEqual(originalPack.manifest.rootHash, changedPack.manifest.rootHash);
    assert.notEqual(originalPack.manifest.source.id, changedPack.manifest.source.id);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("compiler rejects cross-boundary artifact substitution", async () => {
  const artifacts = await extractCase();
  const changed = structuredClone(artifacts);
  changed.evidence.traceIdentity = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => compileLiveBootstrapModelPack(changed),
    /evidence is bound to another trace/
  );
});
