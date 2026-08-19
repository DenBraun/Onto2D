import { createClinicalTrajectoryModel } from "./clinical-trajectory-model.js?v=20260819.2";

const ARTIFACT_URL = new URL("../../cases/clinical-trajectories/artifacts/clinical-trajectories.json", import.meta.url);
const ARTIFACT_SHA256 = "c1f69d6bcaadb244fe5d3c7ce6744add001aaff52f3098dfdf3f1f3d5643e9ea";
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const EVENT_FILTERS = Object.freeze([
  Object.freeze({ id: "all", label: "All records" }),
  Object.freeze({ id: "lab-record", label: "Labs" }),
  Object.freeze({ id: "prescription-record-start", label: "Prescriptions" }),
  Object.freeze({ id: "transfer", label: "Transfers" }),
  Object.freeze({ id: "procedure-code-record", label: "Procedure codes" }),
  Object.freeze({ id: "admission-start", label: "Admissions" }),
  Object.freeze({ id: "icu-start", label: "ICU stays" })
]);
const LAB_SHORT_LABELS = Object.freeze({ "50912": "Creatinine", "50971": "Potassium", "50983": "Sodium", "51222": "Hemoglobin" });
const ids = ["fatal-error", "retrieved-on", "case-identity", "source-identity", "load-state", "metric-grid", "patient-controls", "trajectory-summary", "frame-title", "frame-cutoff", "frame-labs", "frame-facts", "history-title", "history-metrics", "history-windows", "event-controls", "event-list", "event-inspector", "comparison-distance", "comparison-frames", "comparison-history", "source-inventory", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Clinical Trajectory Lab markup is missing #${id}.`);
const state = { model: null, alias: "P01", eventKind: "all", eventId: null };

function node(tag, className = "", text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function shortIdentity(value) {
  return `${value.slice(0, 18)}...${value.slice(-8)}`;
}

function shifted(value) {
  return `${value} / shifted`;
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Clinical Trajectories artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Clinical Trajectories artifact SHA-256 mismatch: ${actual}.`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The artifact is not valid UTF-8.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The artifact is not valid JSON.");
  }
}

function renderMetrics() {
  const availableEvents = state.model.timelines.reduce((total, timeline) => total + timeline.events.length, 0);
  const values = [
    [state.model.cohort.patientCount, "deidentified trajectories"],
    [availableEvents.toLocaleString("en-US"), "cutoff-safe events"],
    [state.model.frames[0].labs.length, "declared frame labs"],
    [state.model.audit.futureEventsInFrames, "future event leaks"],
    [state.model.audit.outcomePredictions, "clinical predictions"]
  ];
  el["metric-grid"].replaceChildren(...values.map(([value, label]) => {
    const card = node("article", "metric-card");
    card.append(node("strong", "", String(value)), node("span", "", label));
    return card;
  }));
}

function renderPatientControls() {
  el["patient-controls"].replaceChildren(...state.model.aliases.map((alias) => {
    const patient = state.model.patient(alias);
    const history = state.model.history(alias);
    const button = node("button", "patient-button");
    button.type = "button";
    button.dataset.active = String(alias === state.alias);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.append(node("span", "", alias), node("strong", "", `subject_id ${patient.sourceSubjectId}`), node("small", "", `${history.timelineEventCount} available events`));
    button.addEventListener("click", () => {
      state.alias = alias;
      state.eventId = null;
      renderPatientControls();
      renderTrajectory();
      renderTimeline();
    });
    return button;
  }));
}

function fact(label, value) {
  const item = node("div");
  item.append(node("dt", "", label), node("dd", "", value));
  return item;
}

function historyMetric(value, label) {
  const item = node("article");
  item.append(node("strong", "", Number(value).toLocaleString("en-US")), node("span", "", label));
  return item;
}

function renderTrajectory() {
  const patient = state.model.patient(state.alias);
  const frame = state.model.frame(state.alias);
  const history = state.model.history(state.alias);
  el["trajectory-summary"].textContent = `${state.alias} binds source subject ${patient.sourceSubjectId}, admission ${patient.focusEncounterId}, and ICU stay ${patient.focusStayId}. All identifiers are deidentified source values.`;
  el["frame-title"].textContent = `${state.alias} / ${frame.careunit}`;
  el["frame-cutoff"].textContent = shifted(frame.cutoff);
  el["frame-labs"].replaceChildren(...frame.labs.map((lab) => {
    const card = node("article", "lab-card");
    const heading = node("header");
    heading.append(node("span", "", LAB_SHORT_LABELS[lab.itemId]), node("code", "", lab.itemId));
    const reading = node("div", "lab-reading");
    reading.append(node("strong", "", String(lab.value)), node("small", "", lab.unit));
    const footer = node("footer");
    footer.append(node("time", "", shifted(lab.timestamp)), node("span", lab.sourceFlag ? "source-flag" : "source-unflagged", lab.sourceFlag ? `source flag: ${lab.sourceFlag}` : "no source flag"));
    card.append(heading, reading, footer);
    return card;
  }));
  el["frame-facts"].replaceChildren(
    fact("Frame identity", shortIdentity(frame.identity)),
    fact("Lookback", `${frame.lookbackHours} hours`),
    fact("Overlapping prescription records", String(frame.overlappingPrescriptionRecordCount)),
    fact("Prescription meaning", "record interval; not administration")
  );
  el["history-title"].textContent = `${state.alias} / records at cutoff`;
  el["history-metrics"].replaceChildren(
    historyMetric(history.priorAdmissionCount, "prior admissions"),
    historyMetric(history.priorIcuStayCount, "prior ICU stays"),
    historyMetric(history.procedureRecordCountAtCutoff, "procedure-code records"),
    historyMetric(history.prescriptionRecordCountAtCutoff, "prescription records"),
    historyMetric(history.abnormalFlaggedSelectedLabCountAtCutoff, "selected labs source-flagged abnormal"),
    historyMetric(history.futureSourceEventCount, "later source events excluded")
  );
  const maximum = Math.max(...history.windows.map((window) => window.eventCount));
  el["history-windows"].replaceChildren(...history.windows.map((window) => {
    const row = node("article", "window-row");
    const label = node("div");
    label.append(node("strong", "", window.label), node("span", "", `${window.eventCount.toLocaleString("en-US")} events`));
    const track = node("div", "window-track");
    const fill = node("i");
    fill.style.width = `${window.eventCount / maximum * 100}%`;
    track.append(fill);
    row.append(label, track);
    return row;
  }));
}

function renderEventControls() {
  el["event-controls"].replaceChildren(...EVENT_FILTERS.map((filter) => {
    const button = node("button", "choice-button", filter.label);
    button.type = "button";
    button.dataset.active = String(filter.id === state.eventKind);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => {
      state.eventKind = filter.id;
      state.eventId = null;
      renderEventControls();
      renderTimeline();
    });
    return button;
  }));
}

function eventInspector(event) {
  const article = node("article");
  const header = node("header");
  header.append(node("span", "", event.kind.replaceAll("-", " ")), node("time", "", shifted(event.timestamp)));
  article.append(header, node("h3", "", event.label));
  const facts = node("dl");
  facts.append(
    fact("Source table", event.source.table),
    fact("CSV row", String(event.source.row)),
    fact("Native record", event.source.recordId),
    fact("Encounter scope", event.hadmId ?? "not attached to an admission")
  );
  article.append(facts, node("p", "inspector-boundary", "Source-recorded event. No clinical interpretation or causal relation is attached."));
  return article;
}

function renderTimeline() {
  const events = state.model.recentEvents(state.alias, { kind: state.eventKind, limit: 40 });
  if (!events.length) {
    el["event-list"].replaceChildren(node("p", "empty-events", `No ${state.eventKind.replaceAll("-", " ")} events are available before the ${state.alias} cutoff.`));
    el["event-inspector"].replaceChildren(node("p", "empty-events", "Choose another event family or patient alias."));
    return;
  }
  if (!state.eventId || !events.some((event) => event.id === state.eventId)) state.eventId = events[0].id;
  el["event-list"].replaceChildren(...events.map((event) => {
    const button = node("button", "event-button");
    button.type = "button";
    button.dataset.active = String(event.id === state.eventId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.append(node("span", "", event.kind.replaceAll("-", " ")), node("strong", "", event.label), node("time", "", shifted(event.timestamp)));
    button.addEventListener("click", () => {
      state.eventId = event.id;
      renderTimeline();
    });
    return button;
  }));
  el["event-inspector"].replaceChildren(eventInspector(state.model.event(state.alias, state.eventId)));
}

function comparisonFrame(alias) {
  const frame = state.model.frame(alias);
  const card = node("article", "comparison-frame");
  const header = node("header");
  header.append(node("span", "", alias), node("strong", "", frame.careunit));
  const labs = node("dl");
  for (const lab of frame.labs) labs.append(fact(LAB_SHORT_LABELS[lab.itemId], `${lab.value} ${lab.unit}`));
  card.append(header, labs, node("footer", "", shifted(frame.cutoff)));
  return card;
}

function comparisonHistory(alias) {
  const history = state.model.history(alias);
  const card = node("article", "comparison-history-card");
  card.append(node("span", "", `${alias} RECORDED CONTEXT`), node("strong", "", `${history.timelineEventCount.toLocaleString("en-US")} events`));
  const list = node("dl");
  list.append(
    fact("Prior admissions", String(history.priorAdmissionCount)),
    fact("Prior ICU stays", String(history.priorIcuStayCount)),
    fact("Procedure-code records", String(history.procedureRecordCountAtCutoff)),
    fact("Prescription records", String(history.prescriptionRecordCountAtCutoff)),
    fact("Selected lab abnormal flags", String(history.abnormalFlaggedSelectedLabCountAtCutoff))
  );
  card.append(list);
  return card;
}

function renderComparison() {
  const result = state.model.comparison;
  el["comparison-distance"].textContent = result.distance.toFixed(2);
  el["comparison-frames"].replaceChildren(comparisonFrame(result.leftAlias), node("div", "comparison-marker", "NEAREST UNDER DECLARED METRIC"), comparisonFrame(result.rightAlias));
  el["comparison-history"].replaceChildren(comparisonHistory(result.leftAlias), comparisonHistory(result.rightAlias));
}

function renderSourceInventory() {
  const audit = state.model.audit;
  const values = [
    [audit.sourceAdmissionRecords, "admission rows"],
    [audit.sourceTransferRecords, "transfer rows"],
    [audit.sourceIcuStayRecords, "ICU stay rows"],
    [audit.sourceSelectedLabRecords, "selected lab rows"],
    [audit.sourcePrescriptionRecords, "prescription rows"],
    [audit.sourceProcedureRecords, "procedure-code rows"]
  ];
  el["source-inventory"].replaceChildren(...values.map(([value, label]) => {
    const item = node("article");
    item.append(node("strong", "", Number(value).toLocaleString("en-US")), node("span", "", label));
    return item;
  }));
}

async function main() {
  state.model = createClinicalTrajectoryModel(await fetchArtifact());
  el["retrieved-on"].textContent = state.model.retrievedAt;
  el["case-identity"].textContent = shortIdentity(state.model.identity);
  el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity);
  el["load-reason"].textContent = state.model.historicalLoad.reason;
  renderMetrics();
  renderPatientControls();
  renderEventControls();
  renderTrajectory();
  renderTimeline();
  renderComparison();
  renderSourceInventory();
  el["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

main().catch((error) => {
  document.body.dataset.state = "error";
  el["load-state"].textContent = "Verification failed";
  el["fatal-error"].hidden = false;
  el["fatal-error"].textContent = error.message;
  console.error(error);
});
