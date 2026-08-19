import { createOperationalAgingModel } from "./operational-aging-model.js?v=20260818.1";

const ARTIFACT_LOCATION = new URL("../../cases/operational-aging/artifacts/operational-aging.json", import.meta.url);
const ARTIFACT_SHA256 = "8fe12156fdc0a7fad167c28312b12eff0d5a65a0f843e1c5b21f5554b28f4493";
const MAX_ARTIFACT_BYTES = 384 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";
const SENSOR_CHOICES = Object.freeze([2, 4, 7, 11, 15, 21]);
const ids = ["load-state", "retrieved-on", "case-identity", "source-identity", "fatal-error", "corpus-metrics", "endpoint-comparison", "rank-controls", "rank-detail", "rank-map", "sensor-controls", "trajectory-chart", "outcome-diagram", "context-control", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, value] of Object.entries(el)) if (!value) throw new Error(`Operational Aging Lab markup is missing #${id}.`);
const state = { model: null, distanceId: "current-combined", sensorNumber: 11 };

function node(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
function svgNode(tag, attributes = {}, text) { const value = document.createElementNS(SVG_NS, tag); for (const [name, content] of Object.entries(attributes)) value.setAttribute(name, String(content)); if (text !== undefined) value.textContent = text; return value; }
function shortIdentity(value) { return `${value.slice(0, 18)}...${value.slice(-8)}`; }
function percentage(value, digits = 2) { return `${(value * 100).toFixed(digits)}%`; }
async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_LOCATION, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_LOCATION.href) throw new Error("The exact Operational Aging artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Operational Aging artifact SHA-256 mismatch: ${actual}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const items = [[state.model.corpus.trainUnitCount, "train trajectories"], [state.model.corpus.testUnitCount, "test trajectories"], [state.model.corpus.trainRowCount, "train rows"], [state.model.corpus.testRowCount, "test rows"], [state.model.outcome.absoluteDifference, "cycle RUL gap"]];
  el["corpus-metrics"].replaceChildren(...items.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", Number(value).toLocaleString("en-US")), node("span", "", label)); return card; }));
}

function endpointCard(unitId, side) {
  const endpoint = state.model.endpoint(unitId);
  const trajectory = state.model.trajectory(unitId);
  const card = node("article", `endpoint-card ${side}`);
  const header = node("header");
  header.append(node("span", "", `TEST UNIT ${unitId}`), node("strong", "", `cycle ${endpoint.cycle}`));
  const rul = node("div", "rul-reading");
  rul.append(node("span", "", "NASA PROVIDED RUL"), node("strong", "", String(endpoint.providedRul)), node("small", "", "cycles / held-out outcome"));
  const facts = node("dl", "endpoint-facts");
  for (const [label, value] of [["Observed prefix", `${trajectory.observedCycleCount} cycles`], ["Implied endpoint + RUL", `cycle ${trajectory.impliedFailureCycle}`], ["Current input", "3 settings + 21 sensors"], ["Future rows", "not available"]]) { const row = node("div"); row.append(node("dt", "", label), node("dd", "", value)); facts.append(row); }
  card.append(header, rul, facts);
  return card;
}

function renderEndpointComparison() {
  const center = node("div", "pair-result");
  center.append(node("span", "", "CURRENT-FRAME RMS"), node("strong", "", state.model.distance("current-combined").distance.toFixed(6)), node("small", "", "rank 78 / 4,950"), node("b", "", "NEAR, NOT IDENTICAL"));
  el["endpoint-comparison"].replaceChildren(endpointCard(25, "unit-25"), center, endpointCard(72, "unit-72"));
}

function profileInterpretation(result) {
  if (result.id === "current-combined") return "With settings and sensors together, this pair sits in the nearest 1.58% of all endpoint pairs. That is the declared 'looks close now' result.";
  if (result.id === "current-sensors-only-control") return "Removing operating settings moves the pair to rank 368. This arithmetic control shows that the settings materially affect this particular ranking; it is not a physical-causation claim.";
  if (result.id === "current-settings-only-control") return "Settings alone also place the pair at rank 366. They are contextual variables, not a substitute for the sensor frame.";
  if (result.id === "last-20-combined") return "Averaging the last 20 observed cycles moves the pair to rank 1,439. Once a short history is included, their similarity is no longer exceptional in this cohort.";
  return "Using the mean of each complete observed prefix places the pair at rank 1,072. A full-prefix mean is only a history descriptor, not a latent-health measurement.";
}

function profileButton(result) {
  const button = node("button", "choice-button");
  button.type = "button";
  button.dataset.active = String(result.id === state.distanceId);
  button.setAttribute("aria-pressed", button.dataset.active);
  button.append(node("span", "", String(result.rank)), node("strong", "", result.label));
  button.addEventListener("click", () => { state.distanceId = result.id; renderRanks(); });
  return button;
}

function renderRanks() {
  el["rank-controls"].replaceChildren(...state.model.distances.map(profileButton));
  const result = state.model.distance(state.distanceId);
  const detail = node("article", "rank-card");
  const number = node("div", "rank-number");
  number.append(node("span", "", "PAIR RANK"), node("strong", "", `${result.rank}`), node("small", "", `of ${result.pairUniverseSize.toLocaleString("en-US")} / ${percentage(result.percentile)}`));
  const copy = node("div", "rank-copy");
  copy.append(node("span", "", result.window.replaceAll("-", " ")), node("h3", "", result.label), node("p", "", profileInterpretation(result)), node("code", "", `RMS ${result.distance.toFixed(12)} / ${result.dimensionCount} active dimensions`));
  detail.append(number, copy);
  el["rank-detail"].replaceChildren(detail);
  el["rank-map"].replaceChildren(...state.model.distances.map((item) => { const row = node("article", item.id === state.distanceId ? "active" : ""); const label = node("div"); label.append(node("strong", "", item.label), node("span", "", `rank ${item.rank}`)); const track = node("div", "rank-track"); const fill = node("i", "rank-fill"); fill.style.width = `${Math.max(item.percentile * 100, 1.5)}%`; track.append(fill); row.append(label, track, node("b", "", percentage(item.percentile))); return row; }));
}

function sensorButton(number) {
  const button = node("button", "choice-button sensor-choice");
  button.type = "button";
  button.dataset.active = String(number === state.sensorNumber);
  button.setAttribute("aria-pressed", button.dataset.active);
  button.append(node("span", "", `S${String(number).padStart(2, "0")}`), node("strong", "", `sensor ${number}`));
  button.addEventListener("click", () => { state.sensorNumber = number; renderTrajectories(); });
  return button;
}

function linePath(rows, sensorIndex, x, y) { return rows.map((row, index) => `${index ? "L" : "M"}${x(row.cycle).toFixed(2)} ${y(row.sensors[sensorIndex]).toFixed(2)}`).join(" "); }
function renderTrajectories() {
  el["sensor-controls"].replaceChildren(...SENSOR_CHOICES.map(sensorButton));
  const sensorIndex = state.sensorNumber - 1;
  const trajectories = state.model.trajectories;
  const allValues = trajectories.flatMap((trajectory) => trajectory.rows.map((row) => row.sensors[sensorIndex]));
  let minimum = Math.min(...allValues); let maximum = Math.max(...allValues);
  if (minimum === maximum) { minimum -= 0.5; maximum += 0.5; }
  const padding = (maximum - minimum) * 0.08;
  minimum -= padding; maximum += padding;
  const width = 1100; const height = 430; const left = 76; const right = 28; const top = 54; const bottom = 64;
  const maximumCycle = Math.max(...trajectories.map((trajectory) => trajectory.observedCycleCount));
  const x = (cycle) => left + (cycle - 1) / (maximumCycle - 1) * (width - left - right);
  const y = (value) => top + (maximum - value) / (maximum - minimum) * (height - top - bottom);
  const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "trajectory-chart-title trajectory-chart-description" });
  svg.append(svgNode("title", { id: "trajectory-chart-title" }, `Observed sensor ${state.sensorNumber} histories for test units 25 and 72`), svgNode("desc", { id: "trajectory-chart-description" }, `Raw sensor ${state.sensorNumber} values. Unit 25 ends at cycle 48; unit 72 ends at cycle 131. No future cycles are plotted.`));
  for (let step = 0; step <= 4; step += 1) { const value = minimum + (maximum - minimum) * (4 - step) / 4; const position = top + (height - top - bottom) * step / 4; svg.append(svgNode("line", { x1: left, y1: position, x2: width - right, y2: position, class: "chart-grid" }), svgNode("text", { x: left - 12, y: position + 4, "text-anchor": "end", class: "axis-label" }, value.toFixed(2))); }
  for (const cycle of [1, 25, 50, 75, 100, 125]) if (cycle <= maximumCycle) svg.append(svgNode("text", { x: x(cycle), y: height - 28, "text-anchor": "middle", class: "axis-label" }, String(cycle)));
  svg.append(svgNode("text", { x: left, y: 25, class: "chart-heading" }, `SENSOR ${String(state.sensorNumber).padStart(2, "0")} / RAW SOURCE VALUES`), svgNode("text", { x: width - right, y: height - 15, "text-anchor": "end", class: "axis-title" }, "OBSERVED CYCLE"));
  for (const [index, trajectory] of trajectories.entries()) { const className = index === 0 ? "trajectory-line unit-25" : "trajectory-line unit-72"; const finalRow = trajectory.rows.at(-1); svg.append(svgNode("path", { d: linePath(trajectory.rows, sensorIndex, x, y), class: className }), svgNode("circle", { cx: x(finalRow.cycle), cy: y(finalRow.sensors[sensorIndex]), r: 6, class: `trajectory-end ${index === 0 ? "unit-25" : "unit-72"}` }), svgNode("text", { x: x(finalRow.cycle) + (index === 0 ? 12 : -12), y: y(finalRow.sensors[sensorIndex]) - 13, "text-anchor": index === 0 ? "start" : "end", class: `trajectory-label ${index === 0 ? "unit-25" : "unit-72"}` }, `UNIT ${trajectory.unitId} / END ${trajectory.observedCycleCount}`)); }
  const wrapper = node("div", "chart-scroll"); wrapper.append(svg);
  const legend = node("div", "chart-legend");
  legend.append(node("span", "unit-25", "Unit 25 / 48 observed cycles"), node("span", "unit-72", "Unit 72 / 131 observed cycles"), node("small", "", "Shared raw-value scale / no smoothing / no future extrapolation"));
  el["trajectory-chart"].replaceChildren(wrapper, legend);
}

function outcomeUnit(unitId) {
  const trajectory = state.model.trajectory(unitId);
  const card = node("article", `outcome-unit unit-${unitId}`);
  const endpoint = node("div", "outcome-endpoint"); endpoint.append(node("span", "", `OBSERVED ENDPOINT`), node("strong", "", `unit ${unitId} / cycle ${trajectory.observedCycleCount}`));
  const arrow = node("div", "outcome-arrow"); arrow.append(node("i"), node("span", "", "SEPARATE NASA VECTOR"));
  const result = node("div", "outcome-result"); result.append(node("span", "", "PROVIDED RUL"), node("strong", "", String(trajectory.providedRul)), node("small", "", `implied failure threshold / cycle ${trajectory.impliedFailureCycle}`));
  card.append(endpoint, arrow, result); return card;
}
function renderOutcomes() { const warning = node("p", "outcome-warning", "The 95-cycle gap is the observed demonstration result. Because it helped select this pair, it cannot be reported as predictor quality."); el["outcome-diagram"].replaceChildren(outcomeUnit(25), outcomeUnit(72), warning); }

function renderContext() {
  const combined = state.model.distance("current-combined"); const sensors = state.model.distance("current-sensors-only-control");
  const box = node("article", "context-box");
  const compare = node("div", "context-ranks");
  for (const [label, result] of [["SENSORS ONLY", sensors], ["SETTINGS + SENSORS", combined]]) { const item = node("div"); item.append(node("span", "", label), node("strong", "", String(result.rank)), node("small", "", `of 4,950 / ${percentage(result.percentile)}`)); compare.append(item); }
  const note = node("p", "", "Adding the two varying settings changes this pair from rank 368 to rank 78. This is a controlled profile comparison, not proof that settings caused the RUL difference.");
  const tags = node("div", "context-tags"); tags.append(node("span", "", "SEA LEVEL / 1 CONDITION"), node("span", "", "HPC DEGRADATION / 1 MODE"), node("span", "", "SETTING 3 / ZERO TRAINING RANGE"));
  box.append(compare, note, tags); el["context-control"].replaceChildren(box);
}

async function main() {
  state.model = createOperationalAgingModel(await fetchArtifact());
  el["retrieved-on"].textContent = state.model.retrievedAt;
  el["case-identity"].textContent = shortIdentity(state.model.identity);
  el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity);
  el["load-reason"].textContent = `${state.model.historicalLoad.reason} The available RUL gap is an outcome difference, not a route-cost value.`;
  renderMetrics(); renderEndpointComparison(); renderRanks(); renderTrajectories(); renderOutcomes(); renderContext();
  el["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

main().catch((error) => { document.body.dataset.state = "error"; el["load-state"].textContent = "Verification failed"; el["fatal-error"].hidden = false; el["fatal-error"].textContent = error.message; console.error(error); });
