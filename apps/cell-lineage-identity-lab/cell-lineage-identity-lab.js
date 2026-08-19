import { createCellLineageModel } from "./cell-lineage-model.js?v=20260819.1";

const ARTIFACT_URL = new globalThis.URL("../../cases/cell-lineage-identity/artifacts/cell-lineage-identity.json", import.meta.url);
const EXPECTED_ARTIFACT_SHA256 = "f14298b014b3d40d774f08de6f2a5b9395e3757d6e2fea66dcfdeb9d73e38772";
const EXPECTED_ARTIFACT_BYTES = 660210;
const MAXIMUM_ARTIFACT_BYTES = 768 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";
const REGIME_META = Object.freeze({
  "cell-record": { label: "Cell record", use: "Use this when provenance must resolve one native matched observation and its exact source row." },
  "transcriptomic-cluster": { label: "Transcriptomic cluster", use: "Use this to compare current expression-state membership without turning state similarity into ancestry." },
  "observed-barcode-state": { label: "Observed barcode", use: "Use this to compare byte-equal reported HMID states while retaining collision and saturation caveats." },
  "first-four-target-signature": { label: "Targets 1-4", use: "Use this positional projection to inspect shared target states 1-4, never as an observed parent cell or an edit-time ordering." }
});
const state = { model: null, regimeId: "cell-record", clusterId: 20, barcodeIdentity: null, query: "" };

const byId = (id) => document.getElementById(id);
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function svgElement(tag, attributes = {}) { const node = document.createElementNS(SVG_NS, tag); for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value)); return node; }
function shortHash(value) { return `${value.slice(0, 16)}...${value.slice(-8)}`; }
function compact(value) { return new Intl.NumberFormat("en").format(value); }

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
  return createCellLineageModel(parsed);
}

function renderResultMetrics() {
  byId("result-metrics").replaceChildren(...state.model.regimes.map((regime) => {
    const card = element("div", "result-metric");
    card.append(element("strong", "", compact(regime.actualClassCount)), element("span", "", REGIME_META[regime.id].label));
    return card;
  }));
}

function renderRegime() {
  byId("regime-controls").replaceChildren(...state.model.regimes.map((regime) => {
    const button = element("button", regime.id === state.regimeId ? "is-active" : "");
    button.type = "button";
    button.setAttribute("aria-pressed", String(regime.id === state.regimeId));
    button.append(element("strong", "", compact(regime.actualClassCount)), element("span", "", REGIME_META[regime.id].label));
    button.addEventListener("click", () => { state.regimeId = regime.id; renderRegime(); });
    return button;
  }));
  const regime = state.model.regime(state.regimeId);
  byId("regime-key").textContent = regime.equivalenceKey;
  byId("regime-count").textContent = compact(regime.actualClassCount);
  byId("regime-meaning").textContent = regime.meaning;
  byId("regime-use").textContent = REGIME_META[regime.id].use;
}

function filteredClusters() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.model.clusters;
  return state.model.clusters.filter((cluster) => String(cluster.clusterId).includes(query) || cluster.label.toLowerCase().includes(query) || cluster.labelStatus.toLowerCase().includes(query));
}

function renderClusters() {
  const clusters = filteredClusters();
  const rows = clusters.map((cluster) => {
    const button = element("button", `cluster-row${cluster.clusterId === state.clusterId ? " is-active" : ""}`);
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", String(cluster.clusterId === state.clusterId));
    const title = element("span", "cluster-name");
    title.append(element("strong", "", `Cluster ${cluster.clusterId}`), element("small", "", cluster.label));
    button.append(title, element("span", "cluster-count", `${cluster.cellCount} cell${cluster.cellCount === 1 ? "" : "s"}`), element("span", cluster.labelStatus === "numeric-source-membership-only" ? "cluster-status" : "cluster-status is-labelled", cluster.labelStatus === "numeric-source-membership-only" ? "NUMERIC" : "PAPER LABEL"));
    button.addEventListener("click", () => { state.clusterId = cluster.clusterId; state.barcodeIdentity = null; renderClusters(); renderMap(); renderInspector(); });
    return button;
  });
  if (!rows.length) rows.push(element("p", "empty-list", "No cluster matches this filter."));
  byId("cluster-list").replaceChildren(...rows);
}

function addForeignNode(svg, { x, y, width, height, className, eyebrow, title, note, pressed = false, action }) {
  const foreign = svgElement("foreignObject", { x, y, width, height });
  const node = element(action ? "button" : "div", `graph-node ${className ?? ""}`);
  if (action) { node.type = "button"; node.setAttribute("aria-pressed", String(pressed)); node.addEventListener("click", action); }
  node.append(element("span", "", eyebrow), element("strong", "", title), element("small", "", note));
  foreign.append(node); svg.append(foreign);
}

function renderMap() {
  const svg = byId("lineage-svg");
  const cluster = state.model.cluster(state.clusterId);
  const allBarcodeEntries = state.model.clusterBarcodes(cluster.clusterId);
  const barcodeEntries = allBarcodeEntries.slice(0, 6);
  const shown = barcodeEntries.length;
  byId("map-summary").textContent = `${allBarcodeEntries.length > shown ? `Showing the top ${shown} of ${allBarcodeEntries.length} observed barcodes for this cluster. ` : `Showing all ${shown} observed barcode${shown === 1 ? "" : "s"} for this cluster. `}Arrows show exact table joins and a positional targets 1-4 projection; they do not denote observed cell divisions.`;
  if (!state.barcodeIdentity || !barcodeEntries.some(({ barcode }) => barcode.identity === state.barcodeIdentity)) state.barcodeIdentity = barcodeEntries[0]?.barcode.identity ?? null;
  const signatureIdentities = [...new Set(barcodeEntries.flatMap(({ barcode }) => state.model.barcodeCells(barcode.identity).map(({ firstFourTargetSignatureIdentity }) => firstFourTargetSignatureIdentity)))];
  const width = 950;
  const height = Math.max(480, barcodeEntries.length * 82 + 70);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  const defs = svgElement("defs");
  const marker = svgElement("marker", { id: "lineage-arrowhead", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
  marker.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z" })); defs.append(marker); svg.append(defs);
  const clusterY = height / 2 - 46;
  const rowY = (index, total) => total === 1 ? height / 2 - 38 : 40 + index * ((height - 120) / (total - 1));
  const barcodeY = barcodeEntries.map((_, index) => rowY(index, barcodeEntries.length));
  const signatureY = signatureIdentities.map((_, index) => rowY(index, signatureIdentities.length));

  barcodeEntries.forEach(({ barcode }, index) => {
    svg.append(svgElement("path", { d: `M 240 ${clusterY + 46} C 300 ${clusterY + 46}, 275 ${barcodeY[index] + 38}, 330 ${barcodeY[index] + 38}`, class: "graph-edge", "marker-end": "url(#lineage-arrowhead)" }));
    const signatureIndex = signatureIdentities.indexOf(state.model.barcodeCells(barcode.identity)[0].firstFourTargetSignatureIdentity);
    svg.append(svgElement("path", { d: `M 580 ${barcodeY[index] + 38} C 640 ${barcodeY[index] + 38}, 620 ${signatureY[signatureIndex] + 38}, 680 ${signatureY[signatureIndex] + 38}`, class: "graph-edge is-derived", "marker-end": "url(#lineage-arrowhead)" }));
  });
  addForeignNode(svg, { x: 20, y: clusterY, width: 220, height: 92, className: "is-cluster", eyebrow: "TRANSCRIPTOMIC CLUSTER", title: `Cluster ${cluster.clusterId}`, note: `${cluster.label} / ${cluster.cellCount} cells` });
  barcodeEntries.forEach(({ barcode, cellCount }, index) => addForeignNode(svg, { x: 330, y: barcodeY[index], width: 250, height: 76, className: "is-barcode", eyebrow: "OBSERVED HMID", title: barcode.key.slice(7, 19), note: `${cellCount} selected-cluster cells / ${barcode.cellCount} total`, pressed: barcode.identity === state.barcodeIdentity, action: () => { state.barcodeIdentity = barcode.identity; renderMap(); renderInspector(); } }));
  signatureIdentities.forEach((identity, index) => {
    const group = state.model.firstFourTargetSignature(identity);
    addForeignNode(svg, { x: 680, y: signatureY[index], width: 250, height: 76, className: "is-target-signature", eyebrow: "DERIVED TARGETS 1-4", title: group.key.slice(7, 19), note: `${group.cellCount} cells / ${group.observedBarcodeClassCount} HMID classes` });
  });
}

function definitionList(rows, className = "inspector-facts") {
  const list = element("dl", className);
  for (const [label, value] of rows) { const row = element("div"); row.append(element("dt", "", label), element("dd", "", value)); list.append(row); }
  return list;
}

function renderInspector() {
  const cluster = state.model.cluster(state.clusterId);
  const barcode = state.barcodeIdentity ? state.model.barcode(state.barcodeIdentity) : null;
  const inspector = byId("lineage-inspector");
  const heading = element("div", "inspector-heading");
  heading.append(element("span", "", barcode ? "SELECTED OBSERVED BARCODE" : "SELECTED CLUSTER"), element("h3", "", barcode ? barcode.key.slice(7, 19) : `Cluster ${cluster.clusterId}`));
  const clusterBox = element("article", "inspector-cluster");
  clusterBox.append(element("span", "", `CLUSTER ${cluster.clusterId}`), element("strong", "", cluster.label), element("p", "", cluster.articleLocator ?? "Numeric source membership only; no biological cell-type label is asserted."));
  const children = [heading, clusterBox];
  if (barcode) {
    const cells = state.model.barcodeCells(barcode.identity);
    const signature = state.model.firstFourTargetSignature(cells[0].firstFourTargetSignatureIdentity);
    children.push(definitionList([["Cells", compact(barcode.cellCount)], ["Clusters", barcode.clusterIds.join(", ")], ["Targets 1-4 group", signature.key.slice(7, 19)], ["Coverage", cells.some(({ targetCoverage }) => targetCoverage === "partial") ? "includes partial" : "reported at all targets"]]));
    const barcodeText = element("div", "barcode-text");
    barcodeText.append(element("span", "", "EXACT TEN-TARGET HMID"), element("code", "", barcode.observedBarcode));
    children.push(barcodeText);
  }
  const caveat = element("div", "inspector-caveat");
  caveat.append(element("strong", "", "Read this relation correctly"), element("p", "", "Cluster assignment describes transcriptomic state. HMID equality records an observed barcode state. Targets 1-4 equality is a positional projection, not edit chronology. None alone proves an immediate parent cell."));
  children.push(caveat);
  inspector.replaceChildren(...children);
}

function renderComparisons() {
  const labels = { "same-cluster-different-barcode": ["STATE CONVERGENCE TEST", "Same cluster / different barcode"], "same-barcode-different-cluster": ["STATE DIVERGENCE TEST", "Same barcode / different cluster"], "same-first-four-target-signature-different-cluster": ["POSITIONAL PROJECTION TEST", "Same targets 1-4 signature / different cluster"], "partial-target-coverage": ["UNKNOWN TEST", "Partial target coverage stays explicit"] };
  byId("comparison-grid").replaceChildren(...state.model.comparisons.map((comparison) => {
    const card = element("article", "comparison-card");
    const [eyebrow, title] = labels[comparison.id];
    card.append(element("span", "", eyebrow), element("strong", "", comparison.pairCount === undefined ? compact(comparison.cellCount) : compact(comparison.pairCount)), element("h3", "", title), element("p", "", comparison.result));
    const examples = element("small", "", comparison.examples.map(({ cellId, clusterId }) => `${cellId} [C${clusterId}]`).join(" <-> "));
    card.append(examples);
    return card;
  }));
}

function render() {
  byId("case-identity").textContent = shortHash(state.model.caseIdentity);
  byId("source-identity").textContent = shortHash(state.model.source.identity);
  byId("load-reason").textContent = state.model.historicalLoad.reason;
  renderResultMetrics(); renderRegime(); renderClusters(); renderMap(); renderInspector(); renderComparisons();
}

async function start() {
  try {
    state.model = await loadArtifact();
    render();
    byId("cluster-search").addEventListener("input", (event) => { state.query = event.currentTarget.value; renderClusters(); });
    document.body.dataset.state = "ready";
    byId("load-state").textContent = "Artifact verified";
  } catch (error) {
    document.body.dataset.state = "error";
    byId("load-state").textContent = "Artifact rejected";
    const fatal = byId("fatal-error"); fatal.hidden = false; fatal.textContent = error instanceof Error ? error.message : String(error);
  }
}

start();
