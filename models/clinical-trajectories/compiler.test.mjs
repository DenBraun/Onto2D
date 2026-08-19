import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildClinicalTrajectoriesCase } from "../../cases/clinical-trajectories/extract.mjs";
import { buildClinicalTrajectoriesRelease, verifyClinicalTrajectoriesRelease } from "./build.mjs";
import { CLINICAL_TRAJECTORIES_MAPPING_VERSION, compileClinicalTrajectoriesModelPack } from "./compiler.mjs";

const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  return { ...basis, caseIdentity: hashCanonical("onto2d:clinical-trajectories-case:v1", basis) };
};

test("the Clinical Trajectories compiler emits a valid exact Model Pack", async () => {
  const pack = compileClinicalTrajectoriesModelPack(await buildClinicalTrajectoriesCase());
  assert.equal(verifyModelPack(pack).manifest.model.id, "clinical-trajectories");
  assert.equal(pack.manifest.model.version, "v1-2360048548115b14");
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 55, edgeCount: 74 });
  assert.equal(pack.files["model/dictionaries.json"].provenance.mappingVersion, CLINICAL_TRAJECTORIES_MAPPING_VERSION);
});

test("native subject, admission, and ICU scopes compile without cross-patient joins", async () => {
  const pack = compileClinicalTrajectoriesModelPack(await buildClinicalTrajectoriesCase());
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.filter((node) => node.entityKind === "deidentified-patient-record").length, 5);
  assert.equal(nodes.filter((node) => node.entityKind === "hospital-encounter").length, 5);
  assert.equal(nodes.filter((node) => node.entityKind === "icu-stay").length, 5);
  assert.equal(edges.filter((edge) => edge.relation === "has-focus-encounter").length, 5);
  assert.equal(edges.filter((edge) => edge.relation === "contains-icu-stay").length, 5);
});

test("bounded frames retain exact labs without becoming complete patient state", async () => {
  const pack = compileClinicalTrajectoriesModelPack(await buildClinicalTrajectoriesCase());
  const nodes = pack.files["model/nodes.json"];
  const frames = nodes.filter((node) => node.entityKind === "observation-frame");
  const labs = nodes.filter((node) => node.entityKind === "lab-record");
  assert.equal(frames.length, 5);
  assert.equal(labs.length, 20);
  assert.ok(frames.every((node) => node.completePatientState === false && node.prescriptionAdministrationClaim === false));
  assert.ok(labs.every((node) => node.missing === false && node.diagnosisAssertion === false && node.sourceLocator.table === "hosp/labevents.csv.gz"));
});

test("history and similarity compile with no causality or clinical conclusion", async () => {
  const pack = compileClinicalTrajectoriesModelPack(await buildClinicalTrajectoriesCase());
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  const similarity = nodes.find((node) => node.id === "analysis:closest-bounded-frames");
  assert.deepEqual([similarity.distance, similarity.historyDiffers, similarity.samePatientIdentity, similarity.clinicalEquivalenceClaim, similarity.clinicalConclusion], [0.09, true, false, false, null]);
  assert.equal(edges.filter((edge) => edge.relation === "causes" || edge.causal === true || edge.clinicalConclusion === true).length, 0);
  assert.equal(pack.files["model/dictionaries.json"].audit.causalEdges, 0);
  assert.equal(pack.files["model/dictionaries.json"].audit.outcomePredictions, 0);
});

test("shifted dates, prescription semantics, clinical use, and Historical Load remain explicit boundaries", async () => {
  const pack = compileClinicalTrajectoriesModelPack(await buildClinicalTrajectoriesCase());
  const nodes = pack.files["model/nodes.json"];
  const boundaries = new Map(nodes.filter((node) => node.entityKind === "analysis-boundary").map((node) => [node.id, node]));
  assert.equal(boundaries.get("boundary:shifted-dates").realCalendarDateClaims, 0);
  assert.equal(boundaries.get("boundary:prescription-records").administrationClaims, 0);
  assert.equal(boundaries.get("boundary:not-clinical-use").diagnosisAssertions, 0);
  assert.equal(boundaries.get("boundary:not-clinical-use").outcomePredictions, 0);
  assert.equal(boundaries.get("boundary:historical-load").value, null);
});

test("the compiler rejects a promoted clinical result even after re-signing", async () => {
  const artifact = structuredClone(await buildClinicalTrajectoriesCase());
  artifact.audit.outcomePredictions = 1;
  assert.throws(() => compileClinicalTrajectoriesModelPack(resign(artifact)), /clinical safety audit differs/);
});

test("the committed Clinical Trajectories release remains byte-for-byte reproducible", async () => {
  const expected = await buildClinicalTrajectoriesRelease();
  const stored = await verifyClinicalTrajectoriesRelease(expected);
  assert.deepEqual(stored, expected);
  assert.equal(expected.manifest.rootHash, "sha256:0d89eb1db1fa2196b2bd76aff00993d3f4bc2a276b059fbe2381e66fc842450f");
  assert.equal(expected.manifest.manifestHash, "sha256:dbb0c48d344df97e5a5ccb172c0aae5799c437b5c43664fd0c52a7c3908c98fd");
});
