import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildCellLineageIdentityCase, verifyCellLineageIdentityCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/cell-lineage-identity.json", import.meta.url);
const schemaUrl = new URL("../schema/cell-lineage-identity.schema.json", import.meta.url);
const sourceUrl = new URL("../source/gse105010-zf1-scgestalt.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:cell-lineage-identity-case:v1", basis);
  return artifact;
};

test("the frozen Cell Lineage Identity artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildCellLineageIdentityCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  const mutation = structuredClone(committed);
  mutation.cells[0].inferredParent = "invented";
  assert.equal(validate(mutation), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/cells/0" && keyword === "additionalProperties"));
  const ambiguousComparison = structuredClone(committed);
  ambiguousComparison.comparisons[0].cellCount = 2;
  assert.equal(validate(ambiguousComparison), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "/comparisons/0" && keyword === "oneOf"));
  assert.equal(verifyCellLineageIdentityCaseIdentity(committed).caseIdentity, "sha256:483e7dff9429c3a5280d16f2b5d3f5c27c47a0680661a6ab90576ee9654ed826");
});

test("the complete ZF1 projection matches the exact offline source lock", async () => {
  const [sourceBytes, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  assert.equal(sourceBytes.length, upstream.snapshot.bytes);
  assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), upstream.snapshot.sha256);
  assert.equal(artifact.source.snapshot.sha256, upstream.snapshot.sha256);
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.equal(artifact.cells.length, 750);
  assert.equal(new Set(artifact.cells.map(({ cellId }) => cellId)).size, 750);
});

test("cell, cluster, barcode, and first-four-target-signature identities remain separate", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.identityRegimes.map(({ id, actualClassCount }) => [id, actualClassCount]), [["cell-record", 750], ["transcriptomic-cluster", 56], ["observed-barcode-state", 192], ["first-four-target-signature", 133]]);
  assert.equal(artifact.audit.sameClusterDifferentObservedBarcodePairs, 7058);
  assert.equal(artifact.audit.sameObservedBarcodeDifferentClusterPairs, 22967);
  assert.equal(artifact.audit.sameFirstFourTargetSignatureDifferentClusterPairs, 28360);
  assert.ok(artifact.comparisons.every(({ examples }) => examples.length === 2));
});

test("partial target coverage and reconstruction limits remain explicit", async () => {
  const artifact = await load();
  assert.equal(artifact.cells.filter(({ targetCoverage }) => targetCoverage === "partial").length, 16);
  assert.equal(artifact.reconstructionBoundary.publishedTreeImported, false);
  assert.equal(artifact.reconstructionBoundary.publishedMaximumParsimonyRecomputed, false);
  assert.equal(artifact.reconstructionBoundary.groupingRepresentsObservedDivision, false);
  assert.equal(artifact.audit.caseGeneratedParentCellCount, 0);
  assert.equal(artifact.audit.caseGeneratedDivisionCount, 0);
  assert.equal(artifact.audit.caseGeneratedConfidenceCount, 0);
  assert.equal(artifact.historicalLoad.value, null);
});

test("the approved release rejects rehashed epistemic promotions", async () => {
  const parentInvented = await load();
  parentInvented.audit.caseGeneratedParentCellCount = 1;
  assert.throws(() => verifyCellLineageIdentityCaseIdentity(resign(parentInvented)), /approved release/);

  const confidenceInvented = await load();
  confidenceInvented.reconstructionBoundary.confidenceMayBeInvented = true;
  assert.throws(() => verifyCellLineageIdentityCaseIdentity(resign(confidenceInvented)), /approved release/);

  const loadPromoted = await load();
  loadPromoted.historicalLoad = { status: "evaluated", value: 0, reason: "invented" };
  assert.throws(() => verifyCellLineageIdentityCaseIdentity(resign(loadPromoted)), /approved release/);
});
