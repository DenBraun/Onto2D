import { createGalacticArchaeologyModel } from "./galactic-archaeology-model.js?v=20260819.2";

const ARTIFACT_URL = new URL("../../cases/galactic-archaeology/artifacts/galactic-archaeology.json", import.meta.url);
const ARTIFACT_SHA256 = "55cd3d042474dd0638cbe13846a2e30feb113f0bbfe59d6dfbe1b1d0540c0129";
const MAX_ARTIFACT_BYTES = 512 * 1024;
const PROFILE_COLOURS = Object.freeze({
  "cold-rotating-metal-rich": "#24756d",
  "alpha-raised-intermediate": "#a36e27",
  "radial-metal-poor": "#bc5138",
  "counter-rotating-metal-poor": "#725d8e"
});
const PROFILE_SHORT = Object.freeze({
  "cold-rotating-metal-rich": "cold rotating",
  "alpha-raised-intermediate": "alpha raised",
  "radial-metal-poor": "radial metal-poor",
  "counter-rotating-metal-poor": "counter-rotating"
});
const state = { model: null, quality: "medium", profile: "all", sourceId: null, evidenceIndex: 3, screenPoints: [] };
const ids = ["load-state", "fatal-error", "retrieved-on", "case-identity", "source-identity", "metric-grid", "pipeline", "quality-controls", "profile-controls", "orbit-canvas", "orbit-legend", "orbit-readout", "source-count", "source-list", "source-inspector", "quality-grid", "evidence-controls", "evidence-result", "interpretation-grid", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Galactic Archaeology Lab markup is missing #${id}.`);

function node(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") element.textContent = text; return element; }
function shortIdentity(value) { return `${value.slice(0, 15)}...${value.slice(-8)}`; }
function profileName(id) { return PROFILE_SHORT[id] ?? id.replaceAll("-", " "); }
function interval(value, places = 2) { return `${value.point.toFixed(places)} [${value.lower.toFixed(places)}, ${value.upper.toFixed(places)}] ${value.unit}`; }

async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Galactic Archaeology artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Galactic Archaeology artifact SHA-256 mismatch: ${actual}.`);
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(source); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const values = [
    [String(state.model.cohort.sourceCount), "frozen stellar sources"],
    [String(state.model.source.executedQueryCount), "exact ADQL queries"],
    [String(state.model.source.tableLocks.length), "separate Gaia tables"],
    [String(state.model.cohort.highQualityCount), "High-quality survivors"],
    [String(state.model.cohort.ruleProfileCount), "rule patterns survive"]
  ];
  el["metric-grid"].replaceChildren(...values.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", value), node("span", "", label)); return card; }));
}

function renderPipeline() {
  el.pipeline.replaceChildren(...state.model.methodology.evidenceLayers.map((layer, index) => {
    const card = node("article", "pipeline-card");
    card.append(node("span", "", String(index + 1).padStart(2, "0")), node("h3", "", layer.id.replaceAll("-", " ")), node("p", "", layer.role), node("code", "", layer.authority));
    return card;
  }));
}

function choice(label, active, onClick) {
  const button = node("button", "choice-button", label);
  button.type = "button";
  button.dataset.active = String(active);
  button.setAttribute("aria-pressed", String(active));
  button.addEventListener("click", onClick);
  return button;
}

function renderControls() {
  el["quality-controls"].replaceChildren(
    choice("MEDIUM / 64", state.quality === "medium", () => { state.quality = "medium"; renderSelection(); }),
    choice("HIGH / 32", state.quality === "high", () => { state.quality = "high"; renderSelection(); })
  );
  el["profile-controls"].replaceChildren(choice("ALL PROFILES", state.profile === "all", () => { state.profile = "all"; renderSelection(); }), ...state.model.profileIds.map((id) => choice(profileName(id).toUpperCase(), state.profile === id, () => { state.profile = id; renderSelection(); })));
}

function renderLegend() {
  el["orbit-legend"].replaceChildren(...state.model.profileIds.map((id) => {
    const item = node("span", "legend-item");
    const mark = node("i");
    mark.style.setProperty("--colour", PROFILE_COLOURS[id]);
    item.append(mark, node("span", "", profileName(id)));
    return item;
  }));
}

function drawPlot(records) {
  const canvas = el["orbit-canvas"];
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(320, bounds.width || 1000);
  const height = width * .59;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A 2D canvas context is required for the orbit plot.");
  context.scale(scale, scale);
  context.fillStyle = "#fbfbf7";
  context.fillRect(0, 0, width, height);
  const margin = { left: 66, right: 22, top: 24, bottom: 53 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xMin = -300;
  const xMax = 320;
  const yMin = 0;
  const yMax = 1;
  const x = (value) => margin.left + (value - xMin) / (xMax - xMin) * innerWidth;
  const y = (value) => margin.top + (yMax - value) / (yMax - yMin) * innerHeight;
  context.strokeStyle = "#d7d9d2";
  context.fillStyle = "#68716d";
  context.lineWidth = 1;
  context.font = "12px SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  for (const tick of [-300, -200, -100, 0, 100, 200, 300]) { const position = x(tick); context.beginPath(); context.moveTo(position, margin.top); context.lineTo(position, height - margin.bottom); context.stroke(); context.fillText(String(tick), position, height - 28); }
  context.textAlign = "right";
  for (const tick of [0, .2, .4, .6, .8, 1]) { const position = y(tick); context.beginPath(); context.moveTo(margin.left, position); context.lineTo(width - margin.right, position); context.stroke(); context.fillText(tick.toFixed(1), margin.left - 10, position + 4); }
  context.fillStyle = "#33403d";
  context.textAlign = "center";
  context.fillText("azimuthal velocity / km s^-1", margin.left + innerWidth / 2, height - 8);
  context.save();
  context.translate(17, margin.top + innerHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("eccentricity", 0, 0);
  context.restore();
  state.screenPoints = records.map((record) => ({ record, x: x(record.publishedOrbit.azimuthalVelocity.point), y: y(record.publishedOrbit.eccentricity.point) }));
  for (const point of state.screenPoints) {
    context.beginPath();
    context.arc(point.x, point.y, point.record.sourceId === state.sourceId ? 7 : 5, 0, Math.PI * 2);
    context.fillStyle = PROFILE_COLOURS[point.record.ruleProfileId];
    context.globalAlpha = point.record.qualityProfile === "high" ? .95 : .55;
    context.fill();
    if (point.record.sourceId === state.sourceId) { context.globalAlpha = 1; context.strokeStyle = "#182220"; context.lineWidth = 2; context.stroke(); }
  }
  context.globalAlpha = 1;
}

function fact(term, value) { const wrapper = node("div"); wrapper.append(node("dt", "", term), node("dd", "", value)); return wrapper; }
function renderInspector(record) {
  const wrapper = node("article");
  wrapper.append(node("h3", "", `Gaia DR3 ${record.sourceId}`), node("p", "", `${record.qualityProfile.toUpperCase()} / ${profileName(record.ruleProfileId).toUpperCase()}`));
  const facts = node("dl", "source-facts");
  facts.append(
    fact("[M/H] estimate", interval(record.gaiaEstimate.metallicity)),
    fact("[alpha/Fe] estimate", interval(record.gaiaEstimate.alphaToIron)),
    fact("vphi orbit", interval(record.publishedOrbit.azimuthalVelocity, 1)),
    fact("eccentricity", interval(record.publishedOrbit.eccentricity, 3)),
    fact("zmax", interval(record.publishedOrbit.maximumHeight, 2)),
    fact("radial velocity", record.observation.radialVelocity.missing ? "missing / not zero" : `${record.observation.radialVelocity.value.toFixed(2)} +/- ${record.observation.radialVelocity.uncertainty.toFixed(2)} km/s`)
  );
  wrapper.append(facts, node("div", "inspector-note", "This source satisfies an Onto2D rule. The label is not a native Gaia population, birth site, or ancestry assertion."));
  el["source-inspector"].replaceChildren(wrapper);
}

function renderSourceList(records) {
  const previousScrollTop = el["source-list"].scrollTop;
  el["source-count"].textContent = `${records.length} visible`;
  el["source-list"].replaceChildren(...records.map((record) => {
    const button = node("button", "source-button");
    button.type = "button";
    button.dataset.active = String(record.sourceId === state.sourceId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.append(node("strong", "", record.sourceId), node("span", "", `${profileName(record.ruleProfileId)} / ecc ${record.publishedOrbit.eccentricity.point.toFixed(2)}`));
    button.addEventListener("click", () => { state.sourceId = record.sourceId; renderSelection(); });
    return button;
  }));
  el["source-list"].scrollTop = Math.min(previousScrollTop, Math.max(0, el["source-list"].scrollHeight - el["source-list"].clientHeight));
  const selected = records.find(({ sourceId }) => sourceId === state.sourceId) ?? records[0];
  if (selected) renderInspector(selected);
}

function renderSelection() {
  renderControls();
  const records = state.model.select({ quality: state.quality, profile: state.profile });
  if (!records.some(({ sourceId }) => sourceId === state.sourceId)) state.sourceId = records[0]?.sourceId ?? null;
  drawPlot(records);
  renderSourceList(records);
  el["orbit-readout"].textContent = `${records.length} sources shown under ${state.quality.toUpperCase()} quality${state.profile === "all" ? " across all four Onto2D profiles" : ` in ${profileName(state.profile)}`}. Medium-only points are translucent; selecting High removes them rather than mutating their source records.`;
}

function renderQuality() {
  const medium = new Map(state.model.summaries("medium").map((item) => [item.ruleProfileId, item]));
  const high = new Map(state.model.summaries("high").map((item) => [item.ruleProfileId, item]));
  el["quality-grid"].replaceChildren(...state.model.profileIds.map((id, index) => {
    const baseline = medium.get(id);
    const strict = high.get(id);
    const card = node("article", "quality-card");
    const header = node("header"); header.append(node("span", "", `PROFILE ${String(index + 1).padStart(2, "0")}`), node("h3", "", profileName(id)));
    const pair = node("div", "quality-pair");
    for (const item of [baseline, strict]) { const block = node("article"); block.append(node("strong", "", String(item.sourceCount)), node("span", "", `${item.qualityRegime.toUpperCase()} sources`)); pair.append(block); }
    const facts = node("dl");
    facts.append(fact("median [M/H]", `${baseline.medianMetallicity.toFixed(2)} -> ${strict.medianMetallicity.toFixed(2)}`), fact("median vphi", `${baseline.medianAzimuthalVelocity.toFixed(1)} -> ${strict.medianAzimuthalVelocity.toFixed(1)}`), fact("median ecc", `${baseline.medianEccentricity.toFixed(2)} -> ${strict.medianEccentricity.toFixed(2)}`));
    card.append(header, pair, facts, node("footer", "", strict.patternSurvives ? "PATTERN STILL REPRESENTED" : "PATTERN UNRESOLVED"));
    return card;
  }));
}

function renderEvidence() {
  el["evidence-controls"].replaceChildren(...state.model.evidenceAblation.map((item, index) => {
    const button = node("button", "evidence-button", `${String(index + 1).padStart(2, "0")} / ${item.regime.replaceAll("-", " ")}`);
    button.type = "button";
    button.dataset.active = String(index === state.evidenceIndex);
    button.setAttribute("aria-pressed", String(index === state.evidenceIndex));
    button.addEventListener("click", () => { state.evidenceIndex = index; renderEvidence(); });
    return button;
  }));
  const result = state.model.evidenceAblation[state.evidenceIndex];
  const wrapper = node("div");
  wrapper.append(node("span", "", `REGIME ${String(state.evidenceIndex + 1).padStart(2, "0")}`), node("h3", "", result.regime.replaceAll("-", " ")), node("p", "", result.reason));
  const layers = node("div", "visible-layers");
  layers.append(...result.visibleLayers.map((layer) => node("code", "", layer)));
  const statuses = node("div", "result-status");
  statuses.append(fact("Classification", result.classificationStatus), fact("History", result.historicalInterpretationStatus));
  wrapper.append(layers, statuses);
  el["evidence-result"].replaceChildren(wrapper);
}

function renderInterpretations() {
  el["interpretation-grid"].replaceChildren(...state.model.interpretations.map((item, index) => {
    const card = node("article", "interpretation-card");
    const list = node("ul");
    list.append(...item.statements.map((statement) => node("li", "", statement)));
    card.append(node("span", "", `CANDIDATE ${String(index + 1).padStart(2, "0")}`), node("h3", "", profileName(item.ruleProfileId)), list, node("footer", "", "NO BIRTH ORIGIN / NO COMMON ANCESTRY / ALTERNATIVES OPEN"));
    return card;
  }));
}

function plotPointer(event) {
  const bounds = el["orbit-canvas"].getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const nearest = state.screenPoints.map((point) => ({ point, distance: Math.hypot(point.x - x, point.y - y) })).sort((left, right) => left.distance - right.distance)[0];
  if (!nearest || nearest.distance > 20) return;
  state.sourceId = nearest.point.record.sourceId;
  renderSelection();
}

async function main() {
  state.model = createGalacticArchaeologyModel(await fetchArtifact());
  state.sourceId = state.model.records[0].sourceId;
  el["retrieved-on"].textContent = state.model.retrievedAt;
  el["case-identity"].textContent = shortIdentity(state.model.identity);
  el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity);
  el["load-reason"].textContent = state.model.historicalLoad.reason;
  renderMetrics();
  renderPipeline();
  renderLegend();
  renderSelection();
  renderQuality();
  renderEvidence();
  renderInterpretations();
  el["orbit-canvas"].addEventListener("click", plotPointer);
  new ResizeObserver(() => drawPlot(state.model.select({ quality: state.quality, profile: state.profile }))).observe(el["orbit-canvas"]);
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
