import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "clinical-trajectories.json");
const CASE_DOMAIN = "onto2d:clinical-trajectories-case:v1";
const SOURCE_DOMAIN = "onto2d:clinical-trajectories-source:v1";
const FRAME_DOMAIN = "onto2d:clinical-observation-frame:v1";
const APPROVED_CASE_IDENTITY = "sha256:3ee8025e6790966cf8a3e66ba3ec54cb6a8032d18e2679c99e6cfaf23fa47760";
const SUBJECT_IDS = Object.freeze(["10001217", "10002428", "10004235", "10004457", "10005348"]);
const ALIASES = Object.freeze(["P01", "P02", "P03", "P04", "P05"]);
const LAB_ITEM_IDS = Object.freeze(["50912", "50971", "50983", "51222"]);
const HASH = /^[0-9a-f]{64}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SHIFTED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/;

function fail(message) {
  throw new Error(`Clinical Trajectories extraction failed: ${message}`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2).replace(/[\u0080-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function unique(values) {
  return new Set(values).size === values.length;
}

function exactKeys(value, keys, label) {
  if (!isRecord(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`);
}

function safePath(value, label) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`);
  return value;
}

function shiftedTime(value, label) {
  if (typeof value !== "string" || !SHIFTED_TIMESTAMP.test(value)) fail(`${label} must be a shifted source timestamp`);
  const normalized = value.length === 10 ? `${value} 00:00:00` : value;
  const [date, time] = normalized.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const epoch = Date.UTC(year, month - 1, day, hour, minute, second);
  const parsed = new Date(epoch);
  if (!Number.isFinite(epoch)
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
    || parsed.getUTCHours() !== hour
    || parsed.getUTCMinutes() !== minute
    || parsed.getUTCSeconds() !== second) fail(`${label} is not a valid shifted timestamp`);
  return epoch;
}

async function load(relative, limit = 2 * 1024 * 1024) {
  const input = await loadBytes(relative, limit);
  const { bytes } = input;
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${relative} is not valid UTF-8`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail(`${relative} is not valid JSON`);
  }
  return { ...input, value };
}

async function loadBytes(relative, limit = 2 * 1024 * 1024) {
  safePath(relative, "input path");
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length < 1 || bytes.length > limit) fail(`${relative} is empty or exceeds ${limit} bytes`);
  return { path: relative, bytes };
}

function sourceEntry(role, input) {
  return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length });
}

function validateUpstream(value, generatorInput) {
  exactKeys(value, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "inputFiles", "projectionGenerator", "snapshot", "selection"], "upstream lock");
  if (value.format !== "onto2d-clinical-trajectories-upstream-lock" || value.formatVersion !== "1" || value.liveNetworkRequiredByBuild !== false) fail("upstream lock version differs");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.retrievedAt)) fail("retrieval timestamp differs");
  if (value.source?.name !== "MIMIC-IV Clinical Database Demo" || value.source?.version !== "2.2" || value.source?.publisher !== "PhysioNet" || value.source?.doi !== "10.13026/dp1f-ex47" || value.source?.accessPolicy !== "open") fail("source attribution differs");
  if (!/^https:\/\/physionet\.org\//.test(value.source.landingPage) || value.source.license !== "Open Data Commons Open Database License v1.0" || !/^https:\/\/opendatacommons\.org\//.test(value.source.licenseUrl) || !/shifted/i.test(value.source.deidentificationBoundary)) fail("source access or deidentification boundary differs");
  if (!Array.isArray(value.inputFiles) || value.inputFiles.length !== 8 || !unique(value.inputFiles.map((file) => file.path))) fail("upstream input inventory differs");
  for (const file of value.inputFiles) {
    safePath(file.path, "upstream file path");
    if (!HASH.test(file.sha256)) fail(`${file.path} hash is invalid`);
  }
  if (value.projectionGenerator?.path !== generatorInput.path || value.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || value.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator byte lock differs");
  if (value.snapshot?.role !== "bounded-deidentified-cohort" || value.snapshot?.path !== "source/mimic-iv-demo-cohort.json" || !HASH.test(value.snapshot?.sha256 ?? "") || !Number.isSafeInteger(value.snapshot?.bytes) || value.snapshot.generatedBy !== "prepare-source.py") fail("source snapshot lock differs");
  if (value.selection?.profile !== "mimic-iv-demo-clinical-trajectories-v1" || value.selection?.cohortSize !== 5 || !same(value.selection?.subjectAliases, ALIASES) || !same(value.selection?.labItemIds, LAB_ITEM_IDS) || value.selection?.frameHours !== 24 || value.selection?.completenessClaim !== false) fail("cohort selection lock differs");
  return value;
}

function validateProfile(value) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "focusAlias", "frame", "historyWindows", "similarity", "historicalLoad", "nonClaims"], "analysis profile");
  if (value.format !== "onto2d-clinical-trajectories-analysis-profile" || value.formatVersion !== "1" || value.profileVersion !== "mimic-iv-demo-clinical-trajectories-v1" || value.focusAlias !== "P01") fail("analysis profile version differs");
  if (value.frame?.label !== "bounded observation frame" || value.frame?.cutoffAuthority !== "latest selected ICU outtime" || value.frame?.lookbackHours !== 24 || !same(value.frame?.labItemIds, LAB_ITEM_IDS) || !/latest numeric/.test(value.frame?.labSelection ?? "") || !/not medication administration/.test(value.frame?.prescriptionSemantics ?? "")) fail("observation-frame contract differs");
  if (!same(value.historyWindows?.map((window) => window.id), ["current-frame", "focus-admission", "available-demo"])) fail("history-window inventory differs");
  if (value.similarity?.status !== "descriptive-only" || value.similarity?.metric !== "mean normalized absolute difference" || value.similarity?.identityClaimAllowed !== false || value.similarity?.clinicalConclusionAllowed !== false || !same(Object.keys(value.similarity?.scales ?? {}), LAB_ITEM_IDS)) fail("similarity boundary differs");
  if (value.historicalLoad?.status !== "not-evaluated" || value.historicalLoad?.value !== null || !/undefined must not be displayed as zero/.test(value.historicalLoad?.reason ?? "")) fail("Historical Load boundary differs");
  if (!Array.isArray(value.nonClaims) || value.nonClaims.length < 12 || !unique(value.nonClaims)) fail("clinical non-claim inventory is incomplete");
  return value;
}

function validateProjection(value, upstream) {
  exactKeys(value, ["format", "formatVersion", "source", "selection", "inputFiles", "labItems", "admissions", "transfers", "icuStays", "labEvents", "prescriptions", "procedures"], "source projection");
  if (value.format !== "onto2d-mimic-iv-demo-cohort" || value.formatVersion !== "1" || value.source?.version !== "2.2" || value.source?.doi !== upstream.source.doi || !/shifted/i.test(value.source?.deidentification ?? "")) fail("source projection metadata differs");
  if (value.selection?.profile !== upstream.selection.profile || value.selection?.cohortSize !== 5 || value.selection?.frameHours !== 24 || !same(value.selection?.labItemIds, LAB_ITEM_IDS)) fail("source projection selection differs");
  if (!same(value.selection?.subjects?.map((subject) => subject.subject_id), SUBJECT_IDS) || !same(value.selection?.subjects?.map((subject) => subject.alias), ALIASES)) fail("selected subject inventory differs");
  if (!same(value.inputFiles.map(({ path: filePath, sha256: hash }) => ({ path: filePath, sha256: hash })), upstream.inputFiles)) fail("projection input hashes differ from upstream lock");
  if (!same(value.labItems.map((item) => item.itemid), LAB_ITEM_IDS) || value.labItems.some((item) => !item.label || item.fluid !== "Blood" || !Number.isSafeInteger(item.source_row))) fail("lab item dictionary differs");
  const selected = new Set(SUBJECT_IDS);
  const admissions = new Map();
  for (const row of value.admissions) {
    if (!selected.has(row.subject_id) || !/^\d{8}$/.test(row.hadm_id) || !Number.isSafeInteger(row.source_row)) fail("admission scope differs");
    shiftedTime(row.admittime, "admission admittime");
    shiftedTime(row.dischtime, "admission dischtime");
    if (admissions.has(row.hadm_id) || row.dischtime < row.admittime) fail("admission identity or order differs");
    admissions.set(row.hadm_id, row.subject_id);
  }
  const validateEncounterScope = (row, label, optionalEncounter = false) => {
    if (!selected.has(row.subject_id) || !Number.isSafeInteger(row.source_row)) fail(`${label} subject or source row differs`);
    if (row.hadm_id === null && optionalEncounter) return;
    if (admissions.get(row.hadm_id) !== row.subject_id) fail(`${label} crosses subject or hadm scope`);
  };
  for (const row of value.transfers) {
    validateEncounterScope(row, "transfer", true);
    shiftedTime(row.intime, "transfer intime");
    if (row.outtime !== null) shiftedTime(row.outtime, "transfer outtime");
  }
  const stays = new Map();
  for (const row of value.icuStays) {
    validateEncounterScope(row, "ICU stay");
    shiftedTime(row.intime, "ICU intime");
    shiftedTime(row.outtime, "ICU outtime");
    if (stays.has(row.stay_id) || row.outtime < row.intime) fail("ICU stay identity or order differs");
    stays.set(row.stay_id, row);
  }
  for (const row of value.labEvents) {
    validateEncounterScope(row, "lab event", true);
    if (!LAB_ITEM_IDS.includes(row.itemid) || typeof row.valuenum !== "number" || !Number.isFinite(row.valuenum)) fail("lab event scope or value differs");
    shiftedTime(row.charttime, "lab charttime");
    shiftedTime(row.storetime, "lab storetime");
  }
  for (const row of value.prescriptions) {
    validateEncounterScope(row, "prescription");
    shiftedTime(row.starttime, "prescription starttime");
    if (row.stoptime !== null) shiftedTime(row.stoptime, "prescription stoptime");
  }
  for (const row of value.procedures) {
    validateEncounterScope(row, "procedure");
    shiftedTime(row.chartdate, "procedure chartdate");
    if (!row.icd_code || ![9, 10].includes(row.icd_version) || !row.long_title) fail("procedure code record differs");
  }
  for (const subject of value.selection.subjects) {
    const stay = stays.get(subject.stay_id);
    if (!stay || stay.subject_id !== subject.subject_id || stay.hadm_id !== subject.hadm_id || stay.outtime !== subject.cutoff) fail(`${subject.alias} focus stay crosses subject or encounter scope`);
  }
  return value;
}

function sourceLocator(table, row, id) {
  return Object.freeze({ table, row: row.source_row, recordId: id });
}

function timelineEvents(projection, subject) {
  const events = [];
  const add = (timestamp, kind, label, source, extra = {}) => {
    events.push(Object.freeze({
      id: `${source.table}:${source.row}:${kind}`,
      timestamp,
      shiftedTimestamp: true,
      kind,
      label,
      evidenceState: "source-recorded",
      source,
      clinicalInterpretation: null,
      causalClaim: false,
      ...extra
    }));
  };
  for (const row of projection.admissions.filter((record) => record.subject_id === subject.subject_id)) {
    const source = sourceLocator("hosp/admissions.csv.gz", row, row.hadm_id);
    add(row.admittime, "admission-start", `Admission ${row.hadm_id} starts (${row.admission_type})`, source, { hadmId: row.hadm_id });
    add(row.dischtime, "admission-end", `Admission ${row.hadm_id} discharge record`, source, { hadmId: row.hadm_id });
  }
  for (const row of projection.transfers.filter((record) => record.subject_id === subject.subject_id)) {
    const source = sourceLocator("hosp/transfers.csv.gz", row, row.transfer_id);
    add(row.intime, "transfer", `Transfer record: ${row.eventtype}${row.careunit ? ` / ${row.careunit}` : ""}`, source, { hadmId: row.hadm_id, careunit: row.careunit });
  }
  for (const row of projection.icuStays.filter((record) => record.subject_id === subject.subject_id)) {
    const source = sourceLocator("icu/icustays.csv.gz", row, row.stay_id);
    add(row.intime, "icu-start", `ICU stay ${row.stay_id} starts in ${row.first_careunit}`, source, { hadmId: row.hadm_id, stayId: row.stay_id });
    add(row.outtime, "icu-end", `ICU stay ${row.stay_id} ends from ${row.last_careunit}`, source, { hadmId: row.hadm_id, stayId: row.stay_id });
  }
  const labById = new Map(projection.labItems.map((item) => [item.itemid, item]));
  for (const row of projection.labEvents.filter((record) => record.subject_id === subject.subject_id)) {
    const item = labById.get(row.itemid);
    const source = sourceLocator("hosp/labevents.csv.gz", row, row.labevent_id);
    add(row.charttime, "lab-record", `${item.label}: ${row.value} ${row.valueuom}`, source, { hadmId: row.hadm_id, itemId: row.itemid, value: row.valuenum, unit: row.valueuom, sourceFlag: row.flag });
  }
  for (const row of projection.prescriptions.filter((record) => record.subject_id === subject.subject_id)) {
    const source = sourceLocator("hosp/prescriptions.csv.gz", row, row.pharmacy_id);
    add(row.starttime, "prescription-record-start", `Prescription record starts: ${row.drug}`, source, { hadmId: row.hadm_id, pharmacyId: row.pharmacy_id, administrationClaim: false });
    if (row.stoptime !== null) add(row.stoptime, "prescription-record-stop", `Prescription record stops: ${row.drug}`, source, { hadmId: row.hadm_id, pharmacyId: row.pharmacy_id, administrationClaim: false });
  }
  for (const row of projection.procedures.filter((record) => record.subject_id === subject.subject_id)) {
    const recordId = `${row.hadm_id}:${row.seq_num}`;
    const source = sourceLocator("hosp/procedures_icd.csv.gz", row, recordId);
    add(`${row.chartdate} 00:00:00`, "procedure-code-record", `Procedure code ${row.icd_code} (ICD-${row.icd_version}): ${row.long_title}`, source, { hadmId: row.hadm_id, codeSemantics: "recorded-code-only" });
  }
  const cutoff = shiftedTime(subject.cutoff, `${subject.alias} cutoff`);
  const available = events.filter((event) => shiftedTime(event.timestamp, `${event.id} timestamp`) <= cutoff);
  available.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
  if (!unique(available.map((event) => event.id))) fail(`${subject.alias} timeline event IDs repeat`);
  return Object.freeze({
    alias: subject.alias,
    cutoff: subject.cutoff,
    futureSourceEventCount: events.length - available.length,
    events: Object.freeze(available)
  });
}

function buildFrame(projection, profile, subject) {
  const cutoff = shiftedTime(subject.cutoff, `${subject.alias} cutoff`);
  const start = cutoff - profile.frame.lookbackHours * 60 * 60 * 1000;
  const labels = new Map(projection.labItems.map((item) => [item.itemid, item.label]));
  const labs = LAB_ITEM_IDS.map((itemId) => {
    const candidates = projection.labEvents.filter((row) => row.subject_id === subject.subject_id && row.hadm_id === subject.hadm_id && row.itemid === itemId && shiftedTime(row.charttime, "frame lab time") >= start && shiftedTime(row.charttime, "frame lab time") <= cutoff);
    candidates.sort((left, right) => right.charttime.localeCompare(left.charttime) || right.labevent_id.localeCompare(left.labevent_id));
    const row = candidates[0];
    if (!row) fail(`${subject.alias} is missing frame lab ${itemId}`);
    return Object.freeze({ itemId, label: labels.get(itemId), value: row.valuenum, unit: row.valueuom, sourceFlag: row.flag, timestamp: row.charttime, missing: false, source: sourceLocator("hosp/labevents.csv.gz", row, row.labevent_id) });
  });
  const prescriptions = projection.prescriptions.filter((row) => row.subject_id === subject.subject_id && row.hadm_id === subject.hadm_id && shiftedTime(row.starttime, "prescription start") <= cutoff && (row.stoptime === null || shiftedTime(row.stoptime, "prescription stop") >= cutoff));
  const stay = projection.icuStays.find((row) => row.stay_id === subject.stay_id);
  const basis = {
    alias: subject.alias,
    sourceSubjectId: subject.subject_id,
    focusEncounterId: subject.hadm_id,
    focusStayId: subject.stay_id,
    cutoff: subject.cutoff,
    lookbackHours: profile.frame.lookbackHours,
    careunit: stay.last_careunit,
    labs,
    overlappingPrescriptionRecordCount: prescriptions.length
  };
  return Object.freeze({
    ...basis,
    identity: hashCanonical(FRAME_DOMAIN, basis),
    label: profile.frame.label,
    cutoffIsShifted: true,
    completePatientState: false,
    prescriptionSemantics: profile.frame.prescriptionSemantics
  });
}

function buildHistory(projection, subject, frame, timeline, windows) {
  const cutoff = shiftedTime(subject.cutoff, `${subject.alias} cutoff`);
  const focusAdmission = projection.admissions.find((row) => row.hadm_id === subject.hadm_id);
  const focusStay = projection.icuStays.find((row) => row.stay_id === subject.stay_id);
  const admissionStart = shiftedTime(focusAdmission.admittime, "focus admission start");
  const stayStart = shiftedTime(focusStay.intime, "focus stay start");
  const before = (value) => shiftedTime(value, "history record time") <= cutoff;
  const priorAdmissions = projection.admissions.filter((row) => row.subject_id === subject.subject_id && shiftedTime(row.admittime, "admission time") < admissionStart);
  const priorStays = projection.icuStays.filter((row) => row.subject_id === subject.subject_id && shiftedTime(row.intime, "stay time") < stayStart);
  const priorProcedures = projection.procedures.filter((row) => row.subject_id === subject.subject_id && before(row.chartdate));
  const priorPrescriptions = projection.prescriptions.filter((row) => row.subject_id === subject.subject_id && before(row.starttime));
  const flaggedLabs = projection.labEvents.filter((row) => row.subject_id === subject.subject_id && before(row.charttime) && row.flag === "abnormal");
  const frameStart = cutoff - frame.lookbackHours * 60 * 60 * 1000;
  const counts = windows.map((window) => {
    const start = window.id === "current-frame" ? frameStart : window.id === "focus-admission" ? admissionStart : Number.NEGATIVE_INFINITY;
    return Object.freeze({
      id: window.id,
      label: window.label,
      eventCount: timeline.events.filter((event) => shiftedTime(event.timestamp, "window event time") >= start).length
    });
  });
  return Object.freeze({
    alias: subject.alias,
    priorAdmissionCount: priorAdmissions.length,
    priorIcuStayCount: priorStays.length,
    procedureRecordCountAtCutoff: priorProcedures.length,
    prescriptionRecordCountAtCutoff: priorPrescriptions.length,
    abnormalFlaggedSelectedLabCountAtCutoff: flaggedLabs.length,
    timelineEventCount: timeline.events.length,
    futureSourceEventCount: timeline.futureSourceEventCount,
    windows: Object.freeze(counts),
    interpretation: "record-count context only",
    causalClaim: false
  });
}

function similarity(frames, histories, profile) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < frames.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < frames.length; rightIndex += 1) {
      const left = frames[leftIndex];
      const right = frames[rightIndex];
      const distance = LAB_ITEM_IDS.reduce((total, itemId) => {
        const leftValue = left.labs.find((lab) => lab.itemId === itemId).value;
        const rightValue = right.labs.find((lab) => lab.itemId === itemId).value;
        return total + Math.abs(leftValue - rightValue) / profile.similarity.scales[itemId];
      }, 0) / LAB_ITEM_IDS.length;
      pairs.push({ leftAlias: left.alias, rightAlias: right.alias, distance });
    }
  }
  pairs.sort((left, right) => left.distance - right.distance || left.leftAlias.localeCompare(right.leftAlias) || left.rightAlias.localeCompare(right.rightAlias));
  const closest = pairs[0];
  const leftHistory = histories.find((history) => history.alias === closest.leftAlias);
  const rightHistory = histories.find((history) => history.alias === closest.rightAlias);
  const historyFields = ["priorAdmissionCount", "priorIcuStayCount", "procedureRecordCountAtCutoff", "prescriptionRecordCountAtCutoff", "abnormalFlaggedSelectedLabCountAtCutoff"];
  return Object.freeze({
    status: profile.similarity.status,
    metric: profile.similarity.metric,
    scales: profile.similarity.scales,
    leftAlias: closest.leftAlias,
    rightAlias: closest.rightAlias,
    distance: Number(closest.distance.toFixed(6)),
    historyDiffers: historyFields.some((field) => leftHistory[field] !== rightHistory[field]),
    comparedHistoryFields: Object.freeze(historyFields),
    samePatientIdentity: false,
    clinicalEquivalenceClaim: false,
    clinicalConclusion: null
  });
}

function verifySemantics(artifact) {
  if (artifact.format !== "onto2d-clinical-trajectories-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "mimic-iv-demo-clinical-trajectories-v1") fail("artifact version differs");
  const { caseIdentity, ...basis } = artifact;
  if (!IDENTITY.test(caseIdentity ?? "") || caseIdentity !== hashCanonical(CASE_DOMAIN, basis)) fail("case identity differs");
  if (artifact.source.identity !== hashCanonical(SOURCE_DOMAIN, { authoredFiles: artifact.source.authoredFiles, snapshotFiles: artifact.source.snapshotFiles, provider: artifact.source.provider })) fail("source identity differs");
  if (!same(artifact.cohort.patients.map((patient) => patient.alias), ALIASES) || !same(artifact.cohort.patients.map((patient) => patient.sourceSubjectId), SUBJECT_IDS) || artifact.cohort.patientCount !== 5 || artifact.cohort.completePopulationClaim !== false) fail("cohort identity differs");
  if (artifact.frames.length !== 5 || artifact.histories.length !== 5 || artifact.timelines.length !== 5) fail("trajectory inventory differs");
  for (const frame of artifact.frames) {
    const patient = artifact.cohort.patients.find((candidate) => candidate.alias === frame.alias);
    if (!patient || frame.sourceSubjectId !== patient.sourceSubjectId || frame.focusEncounterId !== patient.focusEncounterId || frame.focusStayId !== patient.focusStayId || frame.cutoff !== patient.cutoff) fail(`${frame.alias} crosses patient, encounter, or stay scope`);
    if (frame.label !== "bounded observation frame" || frame.completePatientState !== false || frame.cutoffIsShifted !== true || frame.labs.length !== 4 || !same(frame.labs.map((lab) => lab.itemId), LAB_ITEM_IDS) || frame.labs.some((lab) => lab.missing || shiftedTime(lab.timestamp, "verified frame lab") > shiftedTime(frame.cutoff, "verified frame cutoff"))) fail(`${frame.alias} bounded frame differs`);
    const frameBasis = { alias: frame.alias, sourceSubjectId: frame.sourceSubjectId, focusEncounterId: frame.focusEncounterId, focusStayId: frame.focusStayId, cutoff: frame.cutoff, lookbackHours: frame.lookbackHours, careunit: frame.careunit, labs: frame.labs, overlappingPrescriptionRecordCount: frame.overlappingPrescriptionRecordCount };
    if (!IDENTITY.test(frame.identity) || frame.identity !== hashCanonical(FRAME_DOMAIN, frameBasis) || !/not medication administration/.test(frame.prescriptionSemantics)) fail(`${frame.alias} frame identity or prescription boundary differs`);
  }
  for (const timeline of artifact.timelines) {
    const patient = artifact.cohort.patients.find((candidate) => candidate.alias === timeline.alias);
    if (!patient || timeline.cutoff !== patient.cutoff) fail(`${timeline.alias} timeline crosses patient scope`);
    if (!unique(timeline.events.map((event) => event.id)) || timeline.events.some((event) => shiftedTime(event.timestamp, "verified timeline event") > shiftedTime(timeline.cutoff, "verified timeline cutoff") || event.evidenceState !== "source-recorded" || event.causalClaim !== false || event.clinicalInterpretation !== null || !Number.isSafeInteger(event.source?.row))) fail(`${timeline.alias} timeline leaks or promotes evidence`);
    if (timeline.events.some((event) => event.kind.startsWith("prescription-record-") && event.administrationClaim !== false)) fail(`${timeline.alias} prescription record became an administration claim`);
    if (timeline.events.some((event) => event.kind === "procedure-code-record" && event.codeSemantics !== "recorded-code-only")) fail(`${timeline.alias} procedure code semantics differ`);
  }
  if (!same(artifact.histories.map((history) => history.alias), ALIASES) || artifact.histories.some((history) => history.causalClaim !== false || history.interpretation !== "record-count context only")) fail("history summaries promote clinical interpretation");
  if (artifact.similarFrameComparison.leftAlias !== "P04" || artifact.similarFrameComparison.rightAlias !== "P05" || artifact.similarFrameComparison.distance !== 0.09 || artifact.similarFrameComparison.historyDiffers !== true || artifact.similarFrameComparison.samePatientIdentity !== false || artifact.similarFrameComparison.clinicalEquivalenceClaim !== false || artifact.similarFrameComparison.clinicalConclusion !== null) fail("similar-frame boundary differs");
  if (artifact.audit.futureEventsInFrames !== 0 || artifact.audit.missingLabsImputed !== 0 || artifact.audit.diagnosisAssertions !== 0 || artifact.audit.treatmentRecommendations !== 0 || artifact.audit.outcomePredictions !== 0 || artifact.audit.treatmentEffectsInferred !== 0 || artifact.audit.causalRelationsInferred !== 0 || artifact.audit.realCalendarDateClaims !== 0 || artifact.audit.sourceMutations !== 0) fail("clinical safety audit differs");
  if (artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved mimic-iv-demo-clinical-trajectories-v1 release`);
  return artifact;
}

export function verifyClinicalTrajectoriesCaseIdentity(input) {
  if (!isRecord(input)) fail("artifact must be an object");
  return verifySemantics(structuredClone(input));
}

export async function buildClinicalTrajectoriesCase() {
  const [upstreamInput, profileInput, generatorInput, projectionInput] = await Promise.all([
    load("upstream.json"),
    load("analysis-profile.json"),
    loadBytes("prepare-source.py", 128 * 1024),
    load("source/mimic-iv-demo-cohort.json")
  ]);
  const upstream = validateUpstream(upstreamInput.value, generatorInput);
  const profile = validateProfile(profileInput.value);
  const projection = validateProjection(projectionInput.value, upstream);
  if (upstream.snapshot.sha256 !== sha256(projectionInput.bytes) || upstream.snapshot.bytes !== projectionInput.bytes.length) fail("source projection does not match its byte lock");

  const authoredFiles = [sourceEntry("upstream-lock", upstreamInput), sourceEntry("analysis-profile", profileInput), sourceEntry("projection-generator", generatorInput)];
  const snapshotFiles = [sourceEntry("bounded-source-projection", projectionInput)];
  const provider = Object.freeze({
    name: upstream.source.name,
    version: upstream.source.version,
    publisher: upstream.source.publisher,
    doi: upstream.source.doi,
    landingPage: upstream.source.landingPage,
    license: upstream.source.license,
    licenseUrl: upstream.source.licenseUrl,
    retrievedAt: upstream.retrievedAt,
    deidentificationBoundary: upstream.source.deidentificationBoundary
  });
  const source = Object.freeze({
    identity: hashCanonical(SOURCE_DOMAIN, { authoredFiles, snapshotFiles, provider }),
    authoredFiles: Object.freeze(authoredFiles),
    snapshotFiles: Object.freeze(snapshotFiles),
    provider
  });
  const patients = projection.selection.subjects.map((subject) => Object.freeze({
    alias: subject.alias,
    sourceSubjectId: subject.subject_id,
    focusEncounterId: subject.hadm_id,
    focusStayId: subject.stay_id,
    cutoff: subject.cutoff,
    identifierState: "source-deidentified",
    displayedDateState: "source-shifted"
  }));
  const frames = patients.map((patient) => buildFrame(projection, profile, {
    alias: patient.alias,
    subject_id: patient.sourceSubjectId,
    hadm_id: patient.focusEncounterId,
    stay_id: patient.focusStayId,
    cutoff: patient.cutoff
  }));
  const timelines = patients.map((patient) => timelineEvents(projection, {
    alias: patient.alias,
    subject_id: patient.sourceSubjectId,
    cutoff: patient.cutoff
  }));
  const histories = patients.map((patient, index) => buildHistory(projection, {
    alias: patient.alias,
    subject_id: patient.sourceSubjectId,
    hadm_id: patient.focusEncounterId,
    stay_id: patient.focusStayId,
    cutoff: patient.cutoff
  }, frames[index], timelines[index], profile.historyWindows));
  const similarFrameComparison = similarity(frames, histories, profile);
  const audit = Object.freeze({
    patientCount: patients.length,
    sourceAdmissionRecords: projection.admissions.length,
    sourceTransferRecords: projection.transfers.length,
    sourceIcuStayRecords: projection.icuStays.length,
    sourceSelectedLabRecords: projection.labEvents.length,
    sourcePrescriptionRecords: projection.prescriptions.length,
    sourceProcedureRecords: projection.procedures.length,
    futureEventsInFrames: 0,
    missingLabsImputed: 0,
    diagnosisAssertions: 0,
    treatmentRecommendations: 0,
    outcomePredictions: 0,
    treatmentEffectsInferred: 0,
    causalRelationsInferred: 0,
    realCalendarDateClaims: 0,
    sourceMutations: 0
  });
  const basis = {
    format: "onto2d-clinical-trajectories-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    source,
    methodology: Object.freeze({
      frameLabel: profile.frame.label,
      cutoffAuthority: profile.frame.cutoffAuthority,
      lookbackHours: profile.frame.lookbackHours,
      labSelection: profile.frame.labSelection,
      prescriptionSelection: profile.frame.prescriptionSelection,
      prescriptionSemantics: profile.frame.prescriptionSemantics,
      similarityStatus: profile.similarity.status,
      similarityMetric: profile.similarity.metric,
      missingnessRule: profile.similarity.missingnessRule,
      shiftedDateSemantics: provider.deidentificationBoundary
    }),
    cohort: Object.freeze({
      id: upstream.selection.profile,
      patientCount: patients.length,
      completePopulationClaim: false,
      selectionRule: projection.selection.rule,
      patients: Object.freeze(patients)
    }),
    frames: Object.freeze(frames),
    histories: Object.freeze(histories),
    timelines: Object.freeze(timelines),
    similarFrameComparison,
    audit,
    historicalLoad: Object.freeze(profile.historicalLoad),
    nonClaims: Object.freeze(profile.nonClaims),
    disclaimer: "Research data-model demonstration using deidentified, date-shifted records. Not diagnosis, prognosis, treatment guidance, or a patient-level clinical tool."
  };
  return verifySemantics({ ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) });
}

export async function run({ verify = false } = {}) {
  const artifact = await buildClinicalTrajectoriesCase();
  if (verify) {
    assert.deepEqual(JSON.parse(await readFile(OUTPUT, "utf8")), artifact);
  } else {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  console.log(`${verify ? "Verified" : "Built"} Clinical Trajectories case ${artifact.caseIdentity}: ${artifact.cohort.patientCount} trajectories, ${artifact.timelines.reduce((total, timeline) => total + timeline.events.length, 0)} available source events.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
