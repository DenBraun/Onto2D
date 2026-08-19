import { createMaterialProcessHistoryModel } from "./material-process-history-model.js?v=20260819.2";

const ARTIFACT_URL = new URL("../../cases/material-process-history/artifacts/material-process-history.json", import.meta.url);
const ARTIFACT_SHA256 = "3d33ad1873131b2022b1a75e70b0c013340485071686f150627cc817fbe9e805";
const MAX_ARTIFACT_BYTES = 512 * 1024;
const state = { model: null, buildId: "AMB2022-718-AMMT-B7", component: "XX", height: "all", screenPoints: [] };
const ids = ["load-state", "fatal-error", "retrieved-on", "case-identity", "source-identity", "metric-grid", "pipeline", "recipe-grid", "build-controls", "build-cards", "build-inspector", "identity-grid", "component-controls", "height-select", "plot-label", "strain-canvas", "scale-min", "scale-max", "plot-readout", "measurement-facts", "anomaly-description", "anomaly-files", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Material Process History Lab markup is missing #${id}.`);

function node(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") element.textContent = text; return element; }
function shortIdentity(value) { return `${value.slice(0, 15)}...${value.slice(-8)}`; }
function buildShort(id) { return id.slice(-2); }
function scientific(value) { return Number(value).toExponential(3); }
function quantity(value) { return `${value.value} ${value.unit}`; }

async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Material Process History artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Material Process History artifact SHA-256 mismatch: ${actual}.`);
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(source); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const model = state.model;
  const values = [
    [String(model.cohort.buildCount), "native build identities"],
    ["1", "shared nominal P3 recipe"],
    [model.cohort.residualStrainPointCount.toLocaleString("en-US"), "B7-P3 strain coordinates"],
    [String(model.cohort.residualStrainHeightSliceCount), "exact height slices"],
    [String(model.audit.causalEdges), "generated causal edges"]
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

function recipeCard(value, label, note = "") {
  const card = node("article", "recipe-card");
  card.append(node("span", "", label), node("strong", "", value));
  if (note) card.append(node("small", "", note));
  return card;
}

function renderRecipe() {
  const recipe = state.model.recipe;
  el["recipe-grid"].replaceChildren(
    recipeCard("IN718", "Material class", recipe.feedstockId),
    recipeCard(quantity(recipe.nominalLaserPower), "Nominal laser power"),
    recipeCard(quantity(recipe.nominalScanSpeed), "Nominal scan speed"),
    recipeCard(quantity(recipe.nominalLayerThickness), "Layer thickness"),
    recipeCard(String(recipe.totalLayers), "Total layers"),
    recipeCard(quantity(recipe.hatchSpacing), "Hatch spacing"),
    recipeCard(quantity(recipe.beamSpotSize), "Beam spot size"),
    recipeCard(`${recipe.atmosphere} / ${quantity(recipe.oxygenContentLimit)} max`, "Build atmosphere")
  );
}

function choice(label, active, onClick) {
  const button = node("button", "choice-button", label);
  button.type = "button";
  button.dataset.active = String(active);
  button.setAttribute("aria-pressed", String(active));
  button.addEventListener("click", onClick);
  return button;
}

function fact(term, value, kind = "") { const wrapper = node("div", kind); wrapper.append(node("dt", "", term), node("dd", "", value)); return wrapper; }

function renderBuildControls() {
  el["build-controls"].replaceChildren(...state.model.builds.map((build) => choice(buildShort(build.id), state.buildId === build.id, () => { state.buildId = build.id; renderBuildSelection(); })));
}

function renderBuildSelection() {
  renderBuildControls();
  el["build-cards"].replaceChildren(...state.model.builds.map((build) => {
    const card = node("button", "build-card");
    card.type = "button";
    card.dataset.active = String(build.id === state.buildId);
    card.setAttribute("aria-pressed", card.dataset.active);
    card.addEventListener("click", () => { state.buildId = build.id; renderBuildSelection(); });
    const measured = build.comparisonPart.id === state.model.residualStrain.targetPartId;
    card.append(node("span", "", buildShort(build.id)), node("strong", "", build.comparisonPart.id), node("small", "", build.comparisonPart.purpose), node("i", measured ? "measured" : "unknown", measured ? "P3 STATE MEASURED" : "P3 STATE UNKNOWN"));
    return card;
  }));
  const build = state.model.build(state.buildId);
  const measured = build.comparisonPart.id === state.model.residualStrain.targetPartId;
  const wrapper = node("article");
  wrapper.append(node("span", "inspector-kicker", `${buildShort(build.id)} / NATIVE SOURCE RECORD`), node("h3", "", build.id), node("p", "", build.status));
  const facts = node("dl", "build-facts");
  facts.append(
    fact("Build record date", build.recordedCreationDate.slice(0, 10)),
    fact("P3 purpose", build.comparisonPart.purpose),
    fact("P3 native identity", shortIdentity(build.comparisonPart.identity)),
    fact("Recipe identity", shortIdentity(build.process.recipeIdentity)),
    fact("P1 thermography", `${build.thermography.frameRate.value} Hz / ${build.thermography.bitDepth} bit`),
    fact("P3 residual strain", measured ? "2,248 coordinates / available" : "unknown / not copied", measured ? "available" : "missing")
  );
  const note = node("div", measured ? "inspector-note available" : "inspector-note", measured ? "This exact P3 part is the published CHESS measurement target." : "Nominal recipe equality does not transfer the B7-P3 measurement to this part.");
  wrapper.append(facts, note);
  el["build-inspector"].replaceChildren(wrapper);
}

function renderIdentityRegimes() {
  el["identity-grid"].replaceChildren(...state.model.identityRegimes.map((regime, index) => {
    const card = node("article", "identity-card");
    const count = node("strong", "", regime.classes.length === 1 && regime.unresolved.length ? "1 + ?" : String(regime.classes.length));
    card.append(node("span", "", String(index + 1).padStart(2, "0")), node("h3", "", regime.id.replaceAll("-", " ")), count, node("p", "", regime.meaning));
    const detail = node("footer", "", regime.unresolved.length ? `${regime.unresolved.length} sibling states unresolved` : `${regime.classes.length} resolved class${regime.classes.length === 1 ? "" : "es"}`);
    card.append(detail);
    return card;
  }));
}

function strainColour(value, extent) {
  const normalized = Math.max(-1, Math.min(1, value / extent));
  if (normalized < 0) {
    const amount = Math.abs(normalized);
    return `rgb(${Math.round(243 - 174 * amount)},${Math.round(246 - 118 * amount)},${Math.round(242 - 67 * amount)})`;
  }
  return `rgb(${Math.round(247 - 35 * normalized)},${Math.round(244 - 157 * normalized)},${Math.round(237 - 174 * normalized)})`;
}

function drawStrain() {
  const component = state.component;
  const selectedHeight = state.height === "all" ? null : Number(state.height);
  const points = state.model.points(component, selectedHeight);
  const all = state.model.points(component);
  const extent = Math.max(...all.map(({ value }) => Math.abs(value)));
  const canvas = el["strain-canvas"];
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width > 0 ? bounds.width : 1100;
  const height = width * 520 / 1100;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A 2D canvas context is required for the strain map.");
  context.scale(scale, scale);
  context.fillStyle = "#fffef9";
  context.fillRect(0, 0, width, height);
  const margin = { left: 62, right: 20, top: 22, bottom: 48 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = (value) => margin.left + value / 75 * innerWidth;
  const y = (value) => margin.top + (12 - value) / 12 * innerHeight;
  context.strokeStyle = "#d9d5ca";
  context.fillStyle = "#6a6d68";
  context.lineWidth = 1;
  context.font = "12px SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  for (const tick of [0, 15, 30, 45, 60, 75]) { const position = x(tick); context.beginPath(); context.moveTo(position, margin.top); context.lineTo(position, height - margin.bottom); context.stroke(); context.fillText(String(tick), position, height - 24); }
  context.textAlign = "right";
  for (const tick of [0, 3, 6, 9, 12]) { const position = y(tick); context.beginPath(); context.moveTo(margin.left, position); context.lineTo(width - margin.right, position); context.stroke(); context.fillText(String(tick), margin.left - 10, position + 4); }
  context.fillStyle = "#303735";
  context.textAlign = "center";
  context.fillText("X position / mm", margin.left + innerWidth / 2, height - 7);
  context.save(); context.translate(16, margin.top + innerHeight / 2); context.rotate(-Math.PI / 2); context.fillText("Z position / mm", 0, 0); context.restore();
  const pointSize = selectedHeight === null ? Math.max(2.1, Math.min(4, width / 300)) : Math.max(5, width / 125);
  state.screenPoints = points.map((point) => ({ point, x: x(point.xMm), y: y(point.zMm) }));
  for (const entry of state.screenPoints) {
    context.fillStyle = strainColour(entry.point.value, extent);
    context.fillRect(entry.x - pointSize / 2, entry.y - pointSize / 2, pointSize, pointSize);
  }
  el["plot-label"].textContent = `${component} residual elastic strain`;
  el["scale-min"].textContent = `-${extent.toExponential(2)}`;
  el["scale-max"].textContent = `+${extent.toExponential(2)}`;
  const sliceText = selectedHeight === null ? "all 24 heights" : `Z ${selectedHeight.toFixed(2)} mm`;
  canvas.setAttribute("aria-label", `Spatial map of ${component} residual elastic strain in the B7-P3 XZ plane: ${points.length.toLocaleString("en-US")} points, ${sliceText}.`);
  el["plot-readout"].textContent = `${points.length.toLocaleString("en-US")} exact points visible / ${sliceText} / component ${component} / unitless strain.`;
}

function renderStrainControls() {
  el["component-controls"].replaceChildren(...state.model.components.map((component) => choice(`${component} COMPONENT`, state.component === component, () => { state.component = component; renderStrainControls(); drawStrain(); })));
  const current = el["height-select"].value;
  if (el["height-select"].options.length === 1) {
    for (const slice of state.model.residualStrain.summary.heightSlices) {
      const option = node("option", "", `Z ${slice.zMm.toFixed(2)} MM / ${slice.pointCount} POINTS`);
      option.value = String(slice.zMm);
      el["height-select"].append(option);
    }
  }
  el["height-select"].value = state.height === "all" ? "all" : String(state.height);
  if (current && current !== el["height-select"].value && state.height === "all") el["height-select"].value = "all";
}

function renderMeasurementFacts() {
  const result = state.model.residualStrain;
  const facts = [
    ["Technique", "Synchrotron X-ray EDD"],
    ["Measurement plane", `Y = ${result.measurementPlane.position} ${result.measurementPlane.unit}`],
    ["Published uncertainty", `~ ${result.estimatedMeasurementUncertainty.value.toExponential(0)} ${result.strainUnit}`],
    ["XX range", `${scientific(result.summary.xx.minimum.value)} to ${scientific(result.summary.xx.maximum.value)}`],
    ["ZZ range", `${scientific(result.summary.zz.minimum.value)} to ${scientific(result.summary.zz.maximum.value)}`],
    ["Coordinates", `${result.summary.pointCount.toLocaleString("en-US")} / ${result.summary.uniqueZCount} heights`]
  ];
  el["measurement-facts"].replaceChildren(...facts.map(([term, value]) => fact(term, value)));
}

function renderAnomaly() {
  const anomaly = state.model.sourceAnomalies[0];
  el["anomaly-description"].textContent = anomaly.description;
  el["anomaly-files"].replaceChildren(...state.model.builds.map((build) => {
    const card = node("article");
    card.append(node("span", "", buildShort(build.id)), node("strong", "", build.thermography.solidCoolingRate.filename), node("small", "", build.thermography.solidCoolingRate.dataDoi));
    if (buildShort(build.id) !== "B6") card.dataset.warning = "true";
    return card;
  }));
}

function canvasReadout(event) {
  if (!state.screenPoints.length) return;
  const rect = el["strain-canvas"].getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let closest = null;
  let distance = Infinity;
  for (const entry of state.screenPoints) {
    const candidate = Math.hypot(entry.x - x, entry.y - y);
    if (candidate < distance) { distance = candidate; closest = entry.point; }
  }
  if (closest && distance <= 14) el["plot-readout"].textContent = `Source row ${closest.sourceRow} / X ${closest.xMm.toFixed(2)} mm / Y ${closest.yMm.toFixed(2)} mm / Z ${closest.zMm.toFixed(2)} mm / ${state.component} ${scientific(closest.value)}.`;
}

function initialize(model) {
  state.model = model;
  el["retrieved-on"].textContent = model.source.retrievedAt.replace("T", " ").replace("Z", " UTC");
  el["case-identity"].textContent = shortIdentity(model.identity);
  el["source-identity"].textContent = shortIdentity(model.sourceIdentity);
  renderMetrics(); renderPipeline(); renderRecipe(); renderBuildSelection(); renderIdentityRegimes(); renderStrainControls(); renderMeasurementFacts(); renderAnomaly();
  el["load-reason"].textContent = model.historicalLoad.reason;
  el["height-select"].addEventListener("change", () => { state.height = el["height-select"].value; drawStrain(); });
  el["strain-canvas"].addEventListener("pointermove", canvasReadout);
  el["strain-canvas"].addEventListener("pointerleave", drawStrain);
  let resizeFrame = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(drawStrain); });
  drawStrain();
  el["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

function renderFailure(error) {
  el["fatal-error"].hidden = false;
  el["fatal-error"].textContent = error.message;
  el["load-state"].textContent = "Verification failed";
  document.body.dataset.state = "error";
}

fetchArtifact().then(createMaterialProcessHistoryModel).then(initialize).catch(renderFailure);
