const APPROVED_CASE_IDENTITY = "sha256:3ee8025e6790966cf8a3e66ba3ec54cb6a8032d18e2679c99e6cfaf23fa47760";
const APPROVED_SOURCE_IDENTITY = "sha256:1270b78cbdb30e9f93095dd01deb01a59683d043e6cd61a56b56119c1e50ad5f";
const ALIASES = Object.freeze(["P01", "P02", "P03", "P04", "P05"]);
const LAB_ITEM_IDS = Object.freeze(["50912", "50971", "50983", "51222"]);
const EVENT_KINDS = Object.freeze(["admission-start", "admission-end", "transfer", "icu-start", "icu-end", "lab-record", "prescription-record-start", "prescription-record-stop", "procedure-code-record"]);

function fail(message) {
  throw new TypeError(`Clinical Trajectories artifact rejected: ${message}`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

export function createClinicalTrajectoryModel(input) {
  if (!isRecord(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-clinical-trajectories-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "mimic-iv-demo-clinical-trajectories-v1") fail("format or version differs");
  if (artifact.caseIdentity !== APPROVED_CASE_IDENTITY || artifact.source?.identity !== APPROVED_SOURCE_IDENTITY) fail("case or source release differs");
  if (!same(artifact.cohort?.patients?.map((patient) => patient.alias), ALIASES) || artifact.cohort?.patientCount !== 5 || artifact.cohort?.completePopulationClaim !== false) fail("cohort differs");
  if (!same(artifact.frames?.map((frame) => frame.alias), ALIASES) || !same(artifact.histories?.map((history) => history.alias), ALIASES) || !same(artifact.timelines?.map((timeline) => timeline.alias), ALIASES)) fail("trajectory inventory differs");
  for (const frame of artifact.frames) {
    const patient = artifact.cohort.patients.find((candidate) => candidate.alias === frame.alias);
    if (!patient || frame.sourceSubjectId !== patient.sourceSubjectId || frame.focusEncounterId !== patient.focusEncounterId || frame.focusStayId !== patient.focusStayId || frame.cutoff !== patient.cutoff) fail(`${frame.alias} scope differs`);
    if (frame.label !== "bounded observation frame" || frame.lookbackHours !== 24 || frame.completePatientState !== false || frame.cutoffIsShifted !== true || !same(frame.labs?.map((lab) => lab.itemId), LAB_ITEM_IDS) || frame.labs.some((lab) => lab.missing !== false || lab.source?.table !== "hosp/labevents.csv.gz" || !Number.isSafeInteger(lab.source?.row))) fail(`${frame.alias} bounded frame differs`);
    if (!/not medication administration/.test(frame.prescriptionSemantics)) fail(`${frame.alias} prescription semantics differ`);
  }
  for (const timeline of artifact.timelines) {
    if (!Array.isArray(timeline.events) || timeline.events.length < 1 || new Set(timeline.events.map((event) => event.id)).size !== timeline.events.length) fail(`${timeline.alias} event inventory differs`);
    if (timeline.events.some((event) => event.timestamp > timeline.cutoff || !EVENT_KINDS.includes(event.kind) || event.evidenceState !== "source-recorded" || event.causalClaim !== false || event.clinicalInterpretation !== null || !Number.isSafeInteger(event.source?.row))) fail(`${timeline.alias} timeline boundary differs`);
    if (timeline.events.some((event) => event.kind.startsWith("prescription-record-") && event.administrationClaim !== false)) fail(`${timeline.alias} prescription record became administration`);
  }
  if (!same([artifact.similarFrameComparison?.leftAlias, artifact.similarFrameComparison?.rightAlias, artifact.similarFrameComparison?.distance], ["P04", "P05", 0.09]) || artifact.similarFrameComparison.historyDiffers !== true || artifact.similarFrameComparison.samePatientIdentity !== false || artifact.similarFrameComparison.clinicalEquivalenceClaim !== false || artifact.similarFrameComparison.clinicalConclusion !== null) fail("similar-frame boundary differs");
  if (artifact.audit?.futureEventsInFrames !== 0 || artifact.audit?.missingLabsImputed !== 0 || artifact.audit?.diagnosisAssertions !== 0 || artifact.audit?.treatmentRecommendations !== 0 || artifact.audit?.outcomePredictions !== 0 || artifact.audit?.treatmentEffectsInferred !== 0 || artifact.audit?.causalRelationsInferred !== 0 || artifact.audit?.realCalendarDateClaims !== 0 || artifact.audit?.sourceMutations !== 0) fail("clinical safety boundary differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad?.value !== null) fail("Historical Load boundary differs");

  const patients = new Map(artifact.cohort.patients.map((patient) => [patient.alias, patient]));
  const frames = new Map(artifact.frames.map((frame) => [frame.alias, frame]));
  const histories = new Map(artifact.histories.map((history) => [history.alias, history]));
  const timelines = new Map(artifact.timelines.map((timeline) => [timeline.alias, timeline]));
  const events = new Map(artifact.timelines.flatMap((timeline) => timeline.events.map((event) => [`${timeline.alias}:${event.id}`, event])));
  freeze(artifact);
  const get = (index, alias, label) => {
    const value = index.get(alias);
    if (!value) fail(`unknown ${label} ${alias}`);
    return value;
  };
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    retrievedAt: artifact.source.provider.retrievedAt,
    source: artifact.source,
    methodology: artifact.methodology,
    cohort: artifact.cohort,
    aliases: ALIASES,
    frames: artifact.frames,
    histories: artifact.histories,
    timelines: artifact.timelines,
    comparison: artifact.similarFrameComparison,
    audit: artifact.audit,
    historicalLoad: artifact.historicalLoad,
    nonClaims: artifact.nonClaims,
    disclaimer: artifact.disclaimer,
    patient(alias) { return get(patients, alias, "patient"); },
    frame(alias) { return get(frames, alias, "frame"); },
    history(alias) { return get(histories, alias, "history"); },
    timeline(alias) { return get(timelines, alias, "timeline"); },
    event(alias, eventId) { return get(events, `${alias}:${eventId}`, "event"); },
    recentEvents(alias, { kind = "all", limit = 36 } = {}) {
      if (kind !== "all" && !EVENT_KINDS.includes(kind)) fail(`unknown event kind ${kind}`);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail("event limit must be an integer from 1 through 100");
      const timeline = get(timelines, alias, "timeline");
      const selected = kind === "all" ? timeline.events : timeline.events.filter((event) => event.kind === kind);
      return freeze(selected.slice(-limit).reverse());
    }
  });
}
