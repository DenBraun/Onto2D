import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { buildGettyArtworkProvenanceCase, verifyGettyArtworkProvenanceCaseIdentity } from "../extract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the frozen Getty source projection reproduces the committed artifact", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual(verifyGettyArtworkProvenanceCaseIdentity(artifact), artifact);
  assert.equal(await readFile(path.join(ROOT, "artifacts/getty-artwork-provenance.json"), "utf8"), `${JSON.stringify(artifact, null, 2)}\n`);
});

test("the case conforms to its closed contract", async () => {
  const [artifact, schema] = await Promise.all([buildGettyArtworkProvenanceCase(), readFile(path.join(ROOT, "schema/getty-artwork-provenance.schema.json"), "utf8").then(JSON.parse)]);
  const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
});

test("all source locks bind exact local bytes and the normalized query response records transport identity", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  for (const item of [...artifact.source.authoredFiles, ...artifact.source.externalFiles, ...artifact.source.queryFiles]) {
    const bytes = await readFile(path.join(ROOT, item.path));
    assert.equal(bytes.length, item.bytes);
    assert.equal(`sha256:${sha256(bytes)}`, item.identity);
  }
  const response = artifact.source.queryFiles.find((item) => item.role === "actor-place-labels-response");
  assert.equal(response.snapshotNormalization, "append-one-LF");
  assert.equal(response.bytes, response.transportResponseBytes + 1);
  assert.notEqual(response.identity, response.transportResponseIdentity);
});

test("equal labels never collapse four exact Getty object identities", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual(artifact.cohort.objects.map((item) => item.stockNumber), ["A1981", "A1982", "A1983", "A1984"]);
  assert.equal(new Set(artifact.cohort.objects.map((item) => item.id)).size, 4);
  const madonnas = artifact.cohort.objects.filter((item) => item.label === "Madonna & Child");
  assert.equal(madonnas.length, 2);
  assert.notEqual(madonnas[0].artworkRecordIdentity, madonnas[1].artworkRecordIdentity);
});

test("source-declared transfers and native ordering remain bounded and non-legal", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual(artifact.events.map((event) => [event.kind, event.transfers.length]), [["purchase-1938", 4], ["sale-1938", 1]]);
  assert.equal(artifact.eventOrder[0].evidenceState, "upstream-declared");
  assert.ok(artifact.events.flatMap((event) => event.transfers).every((transfer) => transfer.legalTitleDetermination === false));
  assert.ok(artifact.sourceRecords.every((record) => record.ownershipInference === null));
});

test("bounded Getty dates are never silently promoted to exact dates", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual(artifact.events.map((event) => [event.time.precision, event.time.exact]), [["day-bounded", false], ["month-bounded", false]]);
  assert.ok(artifact.sourceRecords.every((record) => record.creationTime.exact === false));
  assert.equal(artifact.flagship.currentContext.relationStart, null);
});

test("the post-sale interval remains explicit missingness, not an invented transaction", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual([artifact.flagship.gap.evidenceState, artifact.flagship.gap.contents, artifact.flagship.gap.assertedTransfer, artifact.flagship.gap.legalTitleDetermination], ["unknown", null, false, false]);
  assert.deepEqual(artifact.flagship.alternativeChains, { status: "not-observed-in-bounded-snapshot", candidates: [], reason: artifact.flagship.alternativeChains.reason });
  const promoted = structuredClone(artifact);
  promoted.flagship.gap.contents = { owner: "invented" };
  assert.throws(() => verifyGettyArtworkProvenanceCaseIdentity(promoted), /unknown interval acquired invented content/);
});

test("history equivalence changes only with the declared identity regime", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual(artifact.historyEquivalence.comparison.results.map(({ regimeId, verdict }) => [regimeId, verdict]), [["physical-object", "equal"], ["direct-records", "equal"], ["actors-unordered", "equal"], ["gap-explicit-chain", "distinct"], ["complete-evidence-chain", "unresolved"]]);
  assert.equal(artifact.historyEquivalence.histories.every((history) => history.complete === false), true);
});

test("Historical Load is undefined here rather than zero", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  assert.deepEqual({ status: artifact.historicalLoad.status, value: artifact.historicalLoad.value }, { status: "not-evaluated", value: null });
  assert.match(artifact.historicalLoad.reason, /undefined rather than zero/);
});

test("semantic and identity mutation fail closed", async () => {
  const artifact = await buildGettyArtworkProvenanceCase();
  const transfer = structuredClone(artifact);
  transfer.events[0].transfers[0].legalTitleDetermination = true;
  assert.throws(() => verifyGettyArtworkProvenanceCaseIdentity(transfer), /legal title determination/);
  const result = structuredClone(artifact);
  result.historyEquivalence.comparison.results[3].verdict = "equal";
  assert.throws(() => verifyGettyArtworkProvenanceCaseIdentity(result), /result differs|results were substituted/);
  const current = structuredClone(artifact);
  current.flagship.currentContext.ownerIds = [];
  assert.throws(() => verifyGettyArtworkProvenanceCaseIdentity(current), /current-context evidence boundary/);
  const nestedIdentity = structuredClone(artifact);
  nestedIdentity.cohort.objects[0].artworkRecordIdentity = artifact.cohort.objects[1].artworkRecordIdentity;
  assert.throws(() => verifyGettyArtworkProvenanceCaseIdentity(nestedIdentity), /artwork record identity was substituted/);
});
