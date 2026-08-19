import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel";
import { buildClinicalTrajectoriesCase, verifyClinicalTrajectoriesCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/clinical-trajectories.json", import.meta.url);
const schemaUrl = new URL("../schema/clinical-trajectories.schema.json", import.meta.url);
const sourceUrl = new URL("../source/mimic-iv-demo-cohort.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const generatorUrl = new URL("../prepare-source.py", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:clinical-trajectories-case:v1", basis);
  return artifact;
};
const resignFrame = (frame) => {
  const basis = {
    alias: frame.alias,
    sourceSubjectId: frame.sourceSubjectId,
    focusEncounterId: frame.focusEncounterId,
    focusStayId: frame.focusStayId,
    cutoff: frame.cutoff,
    lookbackHours: frame.lookbackHours,
    careunit: frame.careunit,
    labs: frame.labs,
    overlappingPrescriptionRecordCount: frame.overlappingPrescriptionRecordCount
  };
  frame.identity = hashCanonical("onto2d:clinical-observation-frame:v1", basis);
  return frame;
};

test("the source-locked Clinical Trajectories artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildClinicalTrajectoriesCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/ } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.equal(verifyClinicalTrajectoriesCaseIdentity(committed).caseIdentity, "sha256:3ee8025e6790966cf8a3e66ba3ec54cb6a8032d18e2679c99e6cfaf23fa47760");
});

test("the bounded source projection and its generator match exact upstream byte locks", async () => {
  const [bytes, generator, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(generatorUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  assert.equal(bytes.length, upstream.snapshot.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), upstream.snapshot.sha256);
  assert.equal(generator.length, upstream.projectionGenerator.bytes);
  assert.equal(createHash("sha256").update(generator).digest("hex"), upstream.projectionGenerator.sha256);
  assert.equal(artifact.source.authoredFiles.find(({ role }) => role === "projection-generator")?.identity, `sha256:${upstream.projectionGenerator.sha256}`);
  assert.equal(artifact.source.provider.version, "2.2");
  assert.equal(artifact.source.provider.doi, "10.13026/dp1f-ex47");
  assert.match(artifact.source.provider.deidentificationBoundary, /shifted/);
});

test("five deterministic patient, encounter, and ICU scopes remain separate", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.cohort.patients.map(({ alias, sourceSubjectId, focusEncounterId, focusStayId }) => [alias, sourceSubjectId, focusEncounterId, focusStayId]), [
    ["P01", "10001217", "27703517", "34592300"],
    ["P02", "10002428", "23473524", "35479615"],
    ["P03", "10004235", "24181354", "34100191"],
    ["P04", "10004457", "23251352", "31494479"],
    ["P05", "10005348", "25239799", "34629895"]
  ]);
  assert.equal(artifact.cohort.completePopulationClaim, false);
  assert.equal(artifact.audit.patientCount, 5);
});

test("each current frame contains four exact source labs and is not patient state", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.frames.map((frame) => frame.labs.map(({ itemId }) => itemId)), Array.from({ length: 5 }, () => ["50912", "50971", "50983", "51222"]));
  assert.ok(artifact.frames.every((frame) => frame.label === "bounded observation frame" && frame.completePatientState === false && frame.cutoffIsShifted === true));
  assert.ok(artifact.frames.flatMap((frame) => frame.labs).every((lab) => lab.missing === false && lab.source.table === "hosp/labevents.csv.gz" && lab.source.row >= 2));
});

test("no event after a patient cutoff enters the available trajectory", async () => {
  const artifact = await load();
  for (const timeline of artifact.timelines) {
    assert.ok(timeline.events.every((event) => event.timestamp <= timeline.cutoff));
    assert.ok(timeline.futureSourceEventCount > 0);
    assert.ok(timeline.events.every((event) => event.causalClaim === false && event.clinicalInterpretation === null));
  }
  assert.equal(artifact.audit.futureEventsInFrames, 0);
});

test("prescriptions remain records rather than administration or adherence claims", async () => {
  const artifact = await load();
  const events = artifact.timelines.flatMap((timeline) => timeline.events).filter((event) => event.kind.startsWith("prescription-record-"));
  assert.ok(events.length > 0);
  assert.ok(events.every((event) => event.administrationClaim === false));
  assert.match(artifact.methodology.prescriptionSemantics, /not medication administration/);
});

test("the closest bounded frames retain visibly different recorded histories", async () => {
  const artifact = await load();
  assert.deepEqual(artifact.similarFrameComparison, {
    status: "descriptive-only",
    metric: "mean normalized absolute difference",
    scales: { "50912": 1, "50971": 1, "50983": 10, "51222": 5 },
    leftAlias: "P04",
    rightAlias: "P05",
    distance: 0.09,
    historyDiffers: true,
    comparedHistoryFields: ["priorAdmissionCount", "priorIcuStayCount", "procedureRecordCountAtCutoff", "prescriptionRecordCountAtCutoff", "abnormalFlaggedSelectedLabCountAtCutoff"],
    samePatientIdentity: false,
    clinicalEquivalenceClaim: false,
    clinicalConclusion: null
  });
  const histories = new Map(artifact.histories.map((history) => [history.alias, history]));
  assert.notEqual(histories.get("P04").prescriptionRecordCountAtCutoff, histories.get("P05").prescriptionRecordCountAtCutoff);
});

test("history windows expand without inventing a causal interpretation", async () => {
  const artifact = await load();
  for (const history of artifact.histories) {
    assert.deepEqual(history.windows.map(({ id }) => id), ["current-frame", "focus-admission", "available-demo"]);
    assert.ok(history.windows[0].eventCount <= history.windows[1].eventCount);
    assert.ok(history.windows[1].eventCount <= history.windows[2].eventCount);
    assert.equal(history.interpretation, "record-count context only");
    assert.equal(history.causalClaim, false);
  }
});

test("Historical Load and clinical use remain explicitly undefined", async () => {
  const artifact = await load();
  assert.equal(artifact.historicalLoad.status, "not-evaluated");
  assert.equal(artifact.historicalLoad.value, null);
  assert.deepEqual([artifact.audit.diagnosisAssertions, artifact.audit.treatmentRecommendations, artifact.audit.outcomePredictions, artifact.audit.treatmentEffectsInferred], [0, 0, 0, 0]);
  assert.match(artifact.disclaimer, /Not diagnosis, prognosis, treatment guidance/);
});

test("the verifier rejects cross-patient scope, future leakage, and missing-lab promotion", async () => {
  const scope = await load();
  scope.frames[0].sourceSubjectId = scope.frames[1].sourceSubjectId;
  resignFrame(scope.frames[0]);
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(scope)), /crosses patient, encounter, or stay scope/);

  const future = await load();
  future.timelines[0].events[0].timestamp = "9999-12-31 23:59:59";
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(future)), /timeline leaks or promotes evidence/);

  const invalidDate = await load();
  invalidDate.timelines[0].events[0].timestamp = "2157-02-31 12:00:00";
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(invalidDate)), /not a valid shifted timestamp/);

  const missing = await load();
  missing.frames[0].labs.pop();
  resignFrame(missing.frames[0]);
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(missing)), /bounded frame differs/);
});

test("the verifier rejects administration, causality, and prediction promotions", async () => {
  const administration = await load();
  const prescription = administration.timelines.flatMap((timeline) => timeline.events).find((event) => event.kind === "prescription-record-start");
  prescription.administrationClaim = true;
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(administration)), /became an administration claim/);

  const causal = await load();
  causal.histories[0].causalClaim = true;
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(causal)), /promote clinical interpretation/);

  const prediction = await load();
  prediction.audit.outcomePredictions = 1;
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(prediction)), /clinical safety audit differs/);
});

test("the approved release rejects a fully rehashed frame substitution", async () => {
  const artifact = await load();
  artifact.frames[0].labs[0].value += 1;
  resignFrame(artifact.frames[0]);
  assert.throws(() => verifyClinicalTrajectoriesCaseIdentity(resign(artifact)), /not the approved mimic-iv-demo-clinical-trajectories-v1 release/);
});
