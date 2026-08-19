import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildManuscriptStemmaticsCase } from "../../cases/manuscript-stemmatics/extract.mjs";
import { buildManuscriptTransmissionRelease, verifyManuscriptTransmissionRelease } from "./build.mjs";
import { compileManuscriptTransmissionModelPack } from "./compiler.mjs";

test("the Manuscript Transmission Model Pack reproduces its exact release", async () => {
  const pack = await buildManuscriptTransmissionRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.deepEqual(await verifyManuscriptTransmissionRelease(pack), pack);
  assert.equal(pack.manifest.model.id, "manuscript-transmission");
  assert.match(pack.manifest.model.version, /^v1-[0-9a-f]{16}$/);
});

test("attributed transmission and contamination remain separate queryable layers", async () => {
  const pack = await buildManuscriptTransmissionRelease();
  const edges = pack.files["model/edges.json"];
  const transmission = edges.filter((edge) => edge.evidenceClass === "published-transmission-analysis" && edge.relation !== "describes-relation");
  assert.equal(transmission.length, 4);
  assert.equal(transmission.filter((edge) => edge.relationLayer === "attributed-contamination").length, 1);
  assert.ok(transmission.every((edge) => edge.directObservation === false && edge.genealogical === false));
  assert.equal(transmission.find((edge) => edge.contamination).treeCompatible, false);
});

test("selected agreement cannot create ancestry and the unresolved exemplar stays unresolved", async () => {
  const pack = await buildManuscriptTransmissionRelease();
  const nodes = pack.files["model/nodes.json"];
  assert.ok(nodes.filter((node) => node.entityKind === "agreement-comparison").every((node) => node.createsAncestry === false && node.createsTransmissionRelation === false && node.selectionBiased === true));
  const unresolved = nodes.find((node) => node.id === "unresolved:better-copy");
  assert.deepEqual([unresolved.extantWitness, unresolved.exactIdentity, unresolved.inventedByOnto2D], [false, null, false]);
  assert.equal(nodes.find((node) => node.typeRole === "historical-load-boundary").value, null);
});

test("the compiler rejects a re-signed contamination promotion", async () => {
  const artifact = structuredClone(await buildManuscriptStemmaticsCase());
  artifact.transmission.relations.find((relation) => relation.contamination).treeCompatible = true;
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:manuscript-stemmatics-case:v1", basis);
  assert.throws(() => compileManuscriptTransmissionModelPack(artifact), /contamination/);
});

test("the compiler rejects a fully rehashed but unapproved witness record", async () => {
  const artifact = structuredClone(await buildManuscriptStemmaticsCase());
  artifact.witnesses[0].label = "Substituted witness label";
  const { identity: ignoredWitnessIdentity, ...witnessBasis } = artifact.witnesses[0];
  artifact.witnesses[0].identity = hashCanonical("onto2d:manuscript-witness:v1", witnessBasis);
  const { caseIdentity: ignoredCaseIdentity, ...caseBasis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:manuscript-stemmatics-case:v1", caseBasis);
  assert.throws(() => compileManuscriptTransmissionModelPack(artifact), /not the approved manuscript-stemmatics-v1 release/);
});
