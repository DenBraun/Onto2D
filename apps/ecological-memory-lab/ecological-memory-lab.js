import { createEcologicalMemoryModel } from "./ecological-memory-model.js?v=20260819.2";

const ARTIFACT_URL = new URL("../../cases/ecological-memory/artifacts/ecological-memory.json", import.meta.url);
const ARTIFACT_SHA256 = "ecfd81f0c085c47c8f8034673a037fd5862794c885ab545b54cb19e7c660c307";
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const STATE_LABELS = Object.freeze({ heightP20: "P20 height", heightP50: "P50 height", heightP75: "P75 height", heightP90: "P90 height" });
const GRID_MODES = Object.freeze([
  Object.freeze({ id: "before", label: "2019 / before", column: 3 }),
  Object.freeze({ id: "after", label: "2021 / after", column: 4 }),
  Object.freeze({ id: "change", label: "2021 - 2019", column: 5 })
]);
const CELL_PIXELS = 6;
const state = { model: null, gridMode: "change" };
const ids = ["load-state", "fatal-error", "retrieved-on", "case-identity", "source-identity", "metric-grid", "timeline", "snapshot-comparison", "signature-values", "flagship-context", "state-bars", "grid-controls", "grid-canvas", "grid-title", "grid-legend", "grid-legend-low", "grid-legend-high", "grid-readout", "change-metrics", "equivalence-grid", "history-windows", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Ecological Memory Lab markup is missing #${id}.`);

function node(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") element.textContent = text; return element; }
function shortIdentity(value) { return `${value.slice(0, 15)}...${value.slice(-8)}`; }
function signed(value, places = 2) { return `${value > 0 ? "+" : ""}${value.toFixed(places)}`; }
function percentage(value) { return `${(value * 100).toFixed(1)}%`; }

async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Ecological Memory artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Ecological Memory artifact SHA-256 mismatch: ${actual}.`);
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(source); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const before = state.model.surveys[0];
  const after = state.model.surveys[1];
  const values = [
    [state.model.beforeAfter.matchedCellCount.toLocaleString("en-US"), "matched 10 m cells"],
    [before.pointCount.toLocaleString("en-US"), "2019 native returns"],
    [after.pointCount.toLocaleString("en-US"), "2021 native returns"],
    [String(state.model.event.recordCount), "Creek Fire records"],
    [String(state.model.flagship.candidateCount), "same-cell equal signatures"]
  ];
  el["metric-grid"].replaceChildren(...values.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", value), node("span", "", label)); return card; }));
}

function renderTimeline() {
  el.timeline.replaceChildren(...state.model.timeline.map((item, index) => {
    const card = node("article", `timeline-item ${item.kind}`);
    card.append(node("span", "timeline-index", String(index + 1).padStart(2, "0")), node("strong", "", item.label), node("time", "", item.date), node("small", "", item.evidenceStatus.replaceAll("-", " ")));
    return card;
  }));
}

function observationCard(observation, label) {
  const card = node("article", "snapshot-card");
  const header = node("header");
  header.append(node("span", "", label), node("strong", "", String(observation.year)));
  const values = node("dl", "snapshot-values");
  for (const field of Object.keys(STATE_LABELS)) { const row = node("div"); row.append(node("dt", "", STATE_LABELS[field]), node("dd", "", `${observation.state[field].toFixed(3)} m`)); values.append(row); }
  const footer = node("footer", "", `${observation.returnCount.toLocaleString("en-US")} retained returns`);
  card.append(header, values, footer);
  return card;
}

function renderFlagship() {
  const result = state.model.flagship;
  el["snapshot-comparison"].replaceChildren(observationCard(result.before, "BEFORE SELECTED EVENT"), observationCard(result.after, "AFTER SELECTED EVENT"));
  el["signature-values"].replaceChildren(...result.displaySignature.map((value, index) => { const item = node("div"); item.append(node("span", "", `P${[20, 50, 75, 90][index]}`), node("strong", "", value.toFixed(1))); return item; }));
  el["flagship-context"].textContent = `Cell ${result.cellId} / E${result.location.easting} / N${result.location.northing}. The display signature matches at ${result.signaturePrecisionMeters.toFixed(1)} m precision, while the exact values, return counts, event context, and sensors do not.`;
}

function renderStateBars() {
  const [before, after] = state.model.surveys;
  const maximum = Math.max(...Object.values(before.medians), ...Object.values(after.medians));
  el["state-bars"].replaceChildren(...Object.keys(STATE_LABELS).map((field) => {
    const row = node("article", "state-row");
    row.append(node("strong", "", STATE_LABELS[field]));
    const bars = node("div", "state-bar-pair");
    for (const [survey, className] of [[before, "before"], [after, "after"]]) {
      const line = node("div", `state-bar ${className}`);
      const label = node("span", "", String(survey.year));
      const track = node("i");
      const fill = node("b");
      fill.style.width = `${survey.medians[field] / maximum * 100}%`;
      track.append(fill);
      line.append(label, track, node("em", "", `${survey.medians[field].toFixed(3)} m`));
      bars.append(line);
    }
    row.append(bars);
    return row;
  }));
}

function interpolate(left, right, amount) {
  const result = left.map((value, index) => Math.round(value + (right[index] - value) * Math.max(0, Math.min(1, amount))));
  return `rgb(${result.join(",")})`;
}

function gridScale(mode) {
  const values = state.model.grid.rows.map((row) => row[mode.column]);
  if (mode.id === "change") {
    const extent = Math.max(...values.map(Math.abs));
    return { minimum: -extent, maximum: extent };
  }
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
}

function gridColor(mode, value, scale) {
  const neutral = [237, 235, 225];
  if (mode === "change") return value < 0 ? interpolate(neutral, [190, 67, 37], value / scale.minimum) : interpolate(neutral, [23, 108, 101], value / scale.maximum);
  return interpolate([231, 237, 224], [31, 91, 65], (value - scale.minimum) / (scale.maximum - scale.minimum));
}

function renderGrid() {
  const mode = GRID_MODES.find((item) => item.id === state.gridMode);
  el["grid-controls"].replaceChildren(...GRID_MODES.map((item) => {
    const button = node("button", "choice-button", item.label);
    button.type = "button";
    button.dataset.active = String(item.id === state.gridMode);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.gridMode = item.id; renderGrid(); });
    return button;
  }));
  const scale = gridScale(mode);
  const canvas = el["grid-canvas"];
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A 2D canvas context is required to render the matched-cell map.");
  context.fillStyle = "#e4e2d8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const row of state.model.grid.rows) {
    context.fillStyle = gridColor(mode.id, row[mode.column], scale);
    context.fillRect(row[2] * CELL_PIXELS, row[1] * CELL_PIXELS, CELL_PIXELS, CELL_PIXELS);
  }
  const flagship = state.model.flagship;
  context.strokeStyle = "#101a18";
  context.lineWidth = 2;
  context.strokeRect(flagship.location.column * CELL_PIXELS - 1, flagship.location.row * CELL_PIXELS - 1, CELL_PIXELS + 2, CELL_PIXELS + 2);
  context.strokeStyle = "#fff";
  context.lineWidth = 1;
  context.strokeRect(flagship.location.column * CELL_PIXELS, flagship.location.row * CELL_PIXELS, CELL_PIXELS, CELL_PIXELS);
  el["grid-title"].textContent = mode.id === "change" ? "P90 height change / metres" : `P90 vegetation height / ${mode.label}`;
  el["grid-legend"].dataset.mode = mode.id;
  el["grid-legend-low"].textContent = `${signed(scale.minimum, 1)} m`;
  el["grid-legend-high"].textContent = `${signed(scale.maximum, 1)} m`;
  el["grid-readout"].textContent = `Outlined: flagship cell ${flagship.cellId} / move over the map to inspect another matched cell.`;
}

function gridPointer(event) {
  const canvas = el["grid-canvas"];
  const bounds = canvas.getBoundingClientRect();
  const column = Math.min(99, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * 100)));
  const row = Math.min(99, Math.max(0, Math.floor((event.clientY - bounds.top) / bounds.height * 100)));
  const cellId = row * 100 + column;
  try {
    const record = state.model.cell(cellId);
    el["grid-readout"].textContent = `Cell ${cellId} / 2019 ${record[3].toFixed(2)} m / 2021 ${record[4].toFixed(2)} m / change ${signed(record[5])} m`;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    el["grid-readout"].textContent = `Cell ${cellId} is outside the 7,275-cell matched comparison.`;
  }
}

function renderChanges() {
  el["change-metrics"].replaceChildren(...state.model.beforeAfter.metricChanges.map((metric) => {
    const card = node("article", "change-card");
    card.append(node("span", "", STATE_LABELS[metric.field]), node("strong", "", `${signed(metric.medianChangeMeters, 3)} m`), node("p", "", `${metric.decreasedCellCount.toLocaleString("en-US")} of ${state.model.beforeAfter.matchedCellCount.toLocaleString("en-US")} matched cells were lower (${percentage(metric.decreaseFraction)}).`));
    return card;
  }));
}

function renderEquivalence() {
  el["equivalence-grid"].replaceChildren(...state.model.equivalence.map((result) => {
    const card = node("article", "equivalence-card");
    const status = result.equivalent === null ? "UNRESOLVED" : result.equivalent ? "YES" : "NO";
    card.dataset.result = status.toLowerCase();
    card.append(node("span", "", status), node("h3", "", result.regime.replaceAll("-", " ")), node("p", "", result.reason));
    return card;
  }));
}

function renderWindows() {
  el["history-windows"].replaceChildren(...state.model.historyWindows.map((window, index) => {
    const card = node("article", "window-card");
    card.append(node("span", "", `WINDOW ${String(index + 1).padStart(2, "0")}`), node("h3", "", window.id.replaceAll("-", " ")), node("p", "", window.includes.join(" / ")), node("strong", "", window.eventContextVisible ? "EVENT CONTEXT VISIBLE" : "EVENT CONTEXT HIDDEN"));
    return card;
  }));
}

async function main() {
  state.model = createEcologicalMemoryModel(await fetchArtifact());
  el["retrieved-on"].textContent = state.model.retrievedAt;
  el["case-identity"].textContent = shortIdentity(state.model.identity);
  el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity);
  el["load-reason"].textContent = state.model.historicalLoad.reason;
  renderMetrics();
  renderTimeline();
  renderFlagship();
  renderStateBars();
  renderGrid();
  renderChanges();
  renderEquivalence();
  renderWindows();
  el["grid-canvas"].addEventListener("mousemove", gridPointer);
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
