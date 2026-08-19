import { createMineralFormationModel, ELEMENT_COLUMNS } from "./mineral-formation-model.js?v=20260819.1";

const ARTIFACT_URL = new globalThis.URL("../../cases/mineral-formation-history/artifacts/mineral-formation-history.json", import.meta.url);
const EXPECTED_ARTIFACT_SHA256 = "b04015e2ea288f8413b946e3d38e8b061a4ea5b4cd8e80fb393584aa29374ceb";
const EXPECTED_ARTIFACT_BYTES = 206912;
const MAXIMUM_ARTIFACT_BYTES = 256 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";
const REGIME_LABELS = Object.freeze({ "conventional-species": "Species", "sample-record": "Samples", "published-formation-profile": "Formation profiles" });
const FILTER_LABELS = Object.freeze({ all: "All 10", mapped: "Mapped 3", unmapped: "Unmapped 7" });
const state = { model: null, sampleId: "DD86WRL1-681", element: "Ni", regimeId: "conventional-species", sampleFilter: "all" };

const byId = (id) => document.getElementById(id);
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function svgElement(tag, attributes = {}) { const node = document.createElementNS(SVG_NS, tag); for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value)); return node; }
function shortHash(value) { return `${value.slice(0, 18)}...${value.slice(-8)}`; }
function compactNumber(value) { return new Intl.NumberFormat("en", { maximumFractionDigits: value < 10 ? 3 : value < 100 ? 2 : 1 }).format(value); }

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function loadArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok) throw new Error(`Artifact request failed with HTTP ${response.status}.`);
  if (response.redirected || response.url !== ARTIFACT_URL.href) throw new Error("Artifact redirects or response URL changes are not accepted.");
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAXIMUM_ARTIFACT_BYTES)) throw new Error("Artifact Content-Length is invalid or exceeds the byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== EXPECTED_ARTIFACT_BYTES || bytes.byteLength > MAXIMUM_ARTIFACT_BYTES) throw new Error(`Artifact byte length differs: received ${bytes.byteLength}.`);
  const actualHash = await sha256(bytes);
  if (actualHash !== EXPECTED_ARTIFACT_SHA256) throw new Error(`Artifact SHA-256 differs: received ${actualHash}.`);
  let parsed;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new Error("Artifact is not valid UTF-8 JSON."); }
  return createMineralFormationModel(parsed);
}

function renderMetrics() {
  const metrics = [
    ["1", "species key", "Pyrite / FeS2"],
    [String(state.model.cohort.sampleCount), "sample records", "native IDs retained"],
    [String(state.model.cohort.analysisCount), "LA-ICP-MS rows", "all attributable"],
    [String(state.model.cohort.reviewedFormationClaimCount), "reviewed profiles", "qualified claims"],
    [String(state.model.cohort.unmappedWithinCaseCount), "unmapped", "explicitly unresolved"]
  ];
  byId("metric-grid").replaceChildren(...metrics.map(([value, label, note]) => {
    const card = element("article", "metric-card");
    card.append(element("strong", "", value), element("span", "", label), element("small", "", note));
    return card;
  }));
}

function renderControls(containerId, values, active, labels, action) {
  byId(containerId).replaceChildren(...values.map((value) => {
    const button = element("button", value === active ? "is-active" : "", labels[value] ?? value);
    button.type = "button";
    button.setAttribute("aria-pressed", String(value === active));
    button.addEventListener("click", () => action(value));
    return button;
  }));
}

function renderRegime() {
  renderControls("regime-controls", Object.keys(REGIME_LABELS), state.regimeId, REGIME_LABELS, (regimeId) => { state.regimeId = regimeId; renderRegime(); });
  const regime = state.model.regime(state.regimeId);
  byId("regime-key").textContent = regime.equivalenceKey;
  byId("regime-count").textContent = regime.id === "published-formation-profile" ? `${regime.classes.length} + ${regime.unresolved.length}?` : String(regime.classes.length);
  byId("regime-meaning").textContent = regime.meaning;
  const classes = regime.classes.map((entry) => {
    const card = element("article", "class-card");
    card.append(element("span", "", "CLASS"), element("strong", "", entry.label), element("small", "", `${entry.members.length} member${entry.members.length === 1 ? "" : "s"}`));
    return card;
  });
  if (regime.unresolved.length) {
    const card = element("article", "class-card is-unknown");
    card.append(element("span", "", "UNRESOLVED"), element("strong", "", "No reviewed mapping"), element("small", "", `${regime.unresolved.length} source samples`));
    classes.push(card);
  }
  byId("regime-classes").replaceChildren(...classes);
}

function renderFormationCards() {
  byId("formation-cards").replaceChildren(...state.model.formationClaims.map((claim, index) => {
    const sample = state.model.sample(claim.sampleId);
    const card = element("article", `formation-card${state.sampleId === claim.sampleId ? " is-selected" : ""}`);
    const button = element("button", "formation-card-button");
    button.type = "button";
    button.addEventListener("click", () => { state.sampleId = claim.sampleId; renderFormationCards(); renderSamples(); renderTrace(); });
    button.append(element("span", "formation-index", `0${index + 1}`), element("small", "", claim.qualifier.toUpperCase()), element("h3", "", claim.shortLabel), element("strong", "", claim.sampleId), element("p", "", claim.evidenceSummary));
    const meta = element("dl", "formation-meta");
    for (const [key, value] of [["Age", `${sample.ageMa} Ma`], ["Source", claim.locator]]) { const row = element("div"); row.append(element("dt", "", key), element("dd", "", value)); meta.append(row); }
    card.append(button, meta);
    return card;
  }));
}

function filteredSamples() {
  if (state.sampleFilter === "mapped") return state.model.samples.filter((sample) => state.model.claim(sample.sampleId));
  if (state.sampleFilter === "unmapped") return state.model.samples.filter((sample) => !state.model.claim(sample.sampleId));
  return state.model.samples;
}

function renderSamples() {
  renderControls("sample-filter", Object.keys(FILTER_LABELS), state.sampleFilter, FILTER_LABELS, (sampleFilter) => {
    state.sampleFilter = sampleFilter;
    const available = filteredSamples();
    if (!available.some(({ sampleId }) => sampleId === state.sampleId)) state.sampleId = available[0].sampleId;
    renderSamples(); renderFormationCards(); renderTrace();
  });
  byId("sample-list").replaceChildren(...filteredSamples().map((sample) => {
    const claim = state.model.claim(sample.sampleId);
    const button = element("button", `sample-row${sample.sampleId === state.sampleId ? " is-active" : ""}`);
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", String(sample.sampleId === state.sampleId));
    button.addEventListener("click", () => { state.sampleId = sample.sampleId; renderSamples(); renderFormationCards(); renderTrace(); });
    const title = element("span", "sample-name"); title.append(element("strong", "", sample.sampleId), element("small", "", `${sample.period} / ${sample.ageMa} Ma`));
    button.append(title, element("span", claim ? "sample-status is-mapped" : "sample-status", claim ? "MAPPED" : "UNMAPPED"), element("span", "sample-count", `${sample.measurementSummary.analysisCount} rows`));
    return button;
  }));
  renderInspector();
}

function renderInspector() {
  const sample = state.model.sample(state.sampleId);
  const claim = state.model.claim(state.sampleId);
  const inspector = byId("sample-inspector");
  const status = element("span", claim ? "inspector-status is-mapped" : "inspector-status", claim ? "REVIEWED MAPPING" : "UNMAPPED IN THIS RELEASE");
  const title = element("h3", "", sample.sampleId);
  const description = element("p", "inspector-description", sample.description);
  const facts = element("dl", "inspector-facts");
  for (const [key, value] of [["Age", `${sample.ageMa} Ma / ${sample.period}`], ["Locality", `${sample.location}, ${sample.country}`], ["Stratigraphy", [sample.supergroupOrGroup, sample.formation, sample.memberOrUnit].filter((entry) => entry && entry !== "-").join(" / ") || "Not specified"], ["Analyses", `${sample.measurementSummary.analysisCount} exact source rows`]]) {
    const row = element("div"); row.append(element("dt", "", key), element("dd", "", value)); facts.append(row);
  }
  const interpretation = element("div", claim ? "interpretation-box" : "interpretation-box is-unknown");
  interpretation.append(element("span", "", claim ? "PUBLISHED INTERPRETATION" : "EPISTEMIC BOUNDARY"), element("strong", "", claim?.shortLabel ?? "No case-local formation profile"), element("p", "", claim?.evidenceSummary ?? "Age, locality, description, and trace-element measurements remain available, but this release generates no replacement mechanism claim."));
  inspector.replaceChildren(status, title, description, facts, interpretation);
}

function renderTrace() {
  renderControls("element-controls", Object.keys(ELEMENT_COLUMNS), state.element, Object.fromEntries(Object.keys(ELEMENT_COLUMNS).map((key) => [key, key])), (elementName) => { state.element = elementName; renderTrace(); });
  const sample = state.model.sample(state.sampleId);
  const series = state.model.traceSeries(state.sampleId, state.element);
  const valid = series.filter(({ value }) => typeof value === "number" && value > 0);
  byId("trace-label").textContent = `${sample.sampleId} / ${state.element}`;
  const svg = byId("trace-svg");
  svg.replaceChildren();
  if (!valid.length) {
    const message = svgElement("text", { x: 450, y: 180, "text-anchor": "middle", class: "empty-plot" }); message.textContent = "No positive numeric values"; svg.append(message);
    byId("trace-readout").textContent = "No numeric points are available for this element and sample.";
    return;
  }
  const width = 900, height = 360, left = 74, right = 28, top = 28, bottom = 54;
  const logs = valid.map(({ value }) => Math.log10(value));
  const rawMin = Math.min(...logs), rawMax = Math.max(...logs), padding = Math.max((rawMax - rawMin) * 0.12, 0.15);
  const min = rawMin - padding, max = rawMax + padding;
  const x = (index) => left + (valid.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (valid.length - 1));
  const y = (value) => top + (max - Math.log10(value)) * (height - top - bottom) / (max - min);
  const grid = svgElement("g", { class: "trace-grid" });
  for (let tick = 0; tick <= 4; tick += 1) {
    const yy = top + tick * (height - top - bottom) / 4;
    const logValue = max - tick * (max - min) / 4;
    grid.append(svgElement("line", { x1: left, x2: width - right, y1: yy, y2: yy }));
    const label = svgElement("text", { x: left - 12, y: yy + 4, "text-anchor": "end" }); label.textContent = compactNumber(10 ** logValue); grid.append(label);
  }
  svg.append(grid);
  const points = valid.map((entry, index) => [x(index), y(entry.value), entry]);
  const path = svgElement("path", { class: "trace-line", d: points.map(([xx, yy], index) => `${index ? "L" : "M"}${xx.toFixed(2)},${yy.toFixed(2)}`).join(" ") });
  svg.append(path);
  for (const [xx, yy, entry] of points) {
    const dot = svgElement("circle", { class: "trace-dot", cx: xx, cy: yy, r: 5, tabindex: 0 });
    const title = svgElement("title"); title.textContent = `${entry.analysisId}: ${compactNumber(entry.value)} ppm`; dot.append(title); svg.append(dot);
  }
  const xLabel = svgElement("text", { x: (left + width - right) / 2, y: height - 14, "text-anchor": "middle", class: "axis-label" }); xLabel.textContent = `Source analysis order / ${valid.length} numeric points`; svg.append(xLabel);
  const minimum = Math.min(...valid.map(({ value }) => value));
  const maximum = Math.max(...valid.map(({ value }) => value));
  byId("trace-readout").textContent = `${valid.length} numeric ${state.element} values for ${state.sampleId}: ${compactNumber(minimum)} to ${compactNumber(maximum)} ppm. Source order is preserved; the line is a visual guide only.`;
}

function renderEvidence() {
  byId("evidence-chain").replaceChildren(...state.model.source ? [
    ["01", "Sample record", "Native ID, age, locality, stratigraphy"],
    ["02", "Direct measurement", "95 attributable LA-ICP-MS rows"],
    ["03", "Published interpretation", "Three qualified, exact locators"],
    ["04", "Species classification", "One complementary pyrite key"],
    ["05", "Onto2D analysis", "Regimes, unknowns, non-claims"]
  ].map(([index, title, copy]) => { const item = element("article"); item.append(element("span", "", index), element("strong", "", title), element("p", "", copy)); return item; }) : []);
}

function render(model) {
  state.model = model;
  byId("retrieved-on").textContent = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(model.source.retrievedAt));
  byId("case-identity").textContent = shortHash(model.identity);
  byId("case-identity").title = model.identity;
  byId("source-identity").textContent = shortHash(model.sourceIdentity);
  byId("source-identity").title = model.sourceIdentity;
  byId("load-reason").textContent = model.historicalLoad.reason;
  renderMetrics(); renderRegime(); renderFormationCards(); renderSamples(); renderTrace(); renderEvidence();
  byId("load-state").textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

async function main() {
  try { render(await loadArtifact()); }
  catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    const fatal = byId("fatal-error"); fatal.hidden = false; fatal.textContent = `Mineral Formation History could not be verified: ${message}`;
    byId("load-state").textContent = "Verification failed";
    document.body.dataset.state = "error";
  }
}

main();
