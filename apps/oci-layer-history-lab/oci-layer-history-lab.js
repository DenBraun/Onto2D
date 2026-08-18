import { createOciLayerHistoryModel } from "./oci-layer-history-model.js?v=20260818.1";

const ARTIFACT_URL = new URL("../../cases/oci-layer-history/artifacts/oci-layer-history.json", import.meta.url);
const EXPECTED_ARTIFACT_SHA256 = "eb16c8a4d2b6c671c9bad61ac54961aa61835f363b160a637a7d994518c3766b";
const MAX_ARTIFACT_BYTES = 128 * 1024;
const elementIds = [
  "load-state", "case-identity", "history-count", "layer-count", "file-count", "spec-version",
  "comparison-controls", "pair-label", "left-history-label", "right-history-label", "left-manifest", "right-manifest",
  "left-timeline", "right-timeline", "rootfs-identity", "rootfs-files", "identity-regimes", "hidden-explanation",
  "hidden-records", "inspector-history", "inspector-layer", "inspector-digest", "inspector-size", "inspector-entries",
  "inspector-operations", "inspector-state", "cost-controls", "load-value", "load-unit", "load-equation",
  "load-definition", "candidate-costs", "load-interpretation", "fatal-error"
];
const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));
for (const [id, value] of Object.entries(elements)) if (!value) throw new Error(`OCI Layer History Lab markup is missing #${id}.`);

const state = { model: null, comparisonId: "flattening", costId: "layer-count", selectedHistoryId: "history-a", selectedLayerOrdinal: 0 };

function node(name, className, text) {
  const value = document.createElement(name);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function short(value, length = 20) {
  return value.length > length ? `${value.slice(0, length)}\u2026` : value;
}

function setMachine(element, value) {
  element.textContent = value;
  element.title = value;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact OCI case artifact could not be loaded.");
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("The OCI case artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The OCI case artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The OCI case artifact exceeds its byte limit.");
  const digest = await sha256Hex(bytes);
  if (digest !== EXPECTED_ARTIFACT_SHA256) throw new Error(`OCI case SHA-256 mismatch: ${digest}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The OCI case artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The OCI case artifact is not valid JSON."); }
}

function currentPair() {
  const comparison = state.model.comparison(state.comparisonId);
  return { comparison, left: state.model.history(comparison.left), right: state.model.history(comparison.right) };
}

function renderComparisonControls() {
  elements["comparison-controls"].replaceChildren(...state.model.comparisons.map((comparison, index) => {
    const button = node("button", "control-button");
    button.type = "button";
    button.dataset.active = String(comparison.id === state.comparisonId);
    button.setAttribute("aria-pressed", String(comparison.id === state.comparisonId));
    button.append(node("span", "control-number", String(index + 1).padStart(2, "0")), node("strong", "", comparison.label));
    button.addEventListener("click", () => {
      state.comparisonId = comparison.id;
      state.selectedHistoryId = comparison.left;
      state.selectedLayerOrdinal = 0;
      renderComparison();
    });
    return button;
  }));
}

function layerCard(history, layer) {
  const button = node("button", "layer-card");
  button.type = "button";
  button.dataset.active = String(history.id === state.selectedHistoryId && layer.ordinal === state.selectedLayerOrdinal);
  button.setAttribute("aria-pressed", button.dataset.active);
  const operation = layer.operations.map((entry) => entry.kind.replace("-file", "")).join(" + ");
  button.append(node("span", "", `L${layer.ordinal + 1}`), node("strong", "", layer.label), node("small", "", operation));
  button.addEventListener("click", () => {
    state.selectedHistoryId = history.id;
    state.selectedLayerOrdinal = layer.ordinal;
    renderTimelines();
    renderInspector();
  });
  return button;
}

function renderTimelines() {
  const { left, right } = currentPair();
  elements["left-timeline"].replaceChildren(...left.layers.map((layer) => layerCard(left, layer)));
  elements["right-timeline"].replaceChildren(...right.layers.map((layer) => layerCard(right, layer)));
}

function renderRootfs(history) {
  setMachine(elements["rootfs-identity"], history.finalRootfs.identity);
  elements["rootfs-files"].replaceChildren(...history.finalRootfs.files.map((file) => {
    const card = node("div", "rootfs-file");
    card.append(node("strong", "", `/${file.path}`), node("span", "", `${file.size} bytes`), node("code", "", short(file.contentIdentity, 18)));
    return card;
  }));
}

function renderIdentityRegimes() {
  const { comparison } = currentPair();
  elements["identity-regimes"].replaceChildren(...state.model.regimes.map((regime) => {
    const result = comparison.results[regime.id];
    const row = node("div", "identity-row");
    row.dataset.equal = String(result.equal);
    const heading = node("div", "identity-label");
    heading.append(node("strong", "", regime.label), node("small", "", regime.question));
    const values = node("div", "identity-values");
    values.append(node("code", "", short(result.left)), node("b", "", result.equal ? "=" : "\u2260"), node("code", "", short(result.right)));
    row.append(heading, values, node("em", "", result.equal ? "SAME" : "DIFFERENT"));
    return row;
  }));
}

function renderHiddenHistory() {
  const { left, right } = currentPair();
  const hidden = [left, right].flatMap((history) => history.layers.flatMap((layer) => layer.operations.filter((operation) => operation.kind === "delete-file" || operation.kind === "opaque-delete").map((operation) => ({ history, layer, operation }))));
  elements["hidden-explanation"].textContent = hidden.length > 0
    ? "These verified mutations disappear from the final file listing but remain inspectable in the layer record."
    : "This selected pair contains no deletion. Its histories still differ through replacement or layer grouping.";
  elements["hidden-records"].replaceChildren(...(hidden.length > 0 ? hidden.map(({ history, layer, operation }) => {
    const card = node("div", "hidden-card");
    card.append(node("span", "", history.id), node("strong", "", `/${operation.target}`), node("small", "", `${operation.kind} in ${layer.id}`));
    return card;
  }) : [node("div", "hidden-card empty", "No deleted path in this pair")]));
}

function renderInspector() {
  const history = state.model.history(state.selectedHistoryId);
  const layer = history.layers[state.selectedLayerOrdinal] ?? history.layers[0];
  elements["inspector-history"].textContent = history.id;
  elements["inspector-layer"].textContent = `${layer.ordinal + 1} / ${history.layers.length} - ${layer.label}`;
  setMachine(elements["inspector-digest"], layer.descriptor.digest);
  elements["inspector-size"].textContent = `${layer.descriptor.size.toLocaleString()} bytes`;
  elements["inspector-entries"].textContent = layer.entries.map((entry) => `/${entry.path}`).join(", ");
  elements["inspector-operations"].textContent = layer.operations.map((operation) => `${operation.kind} /${operation.target}`).join(", ");
  setMachine(elements["inspector-state"], layer.stateAfter.identity);
}

function renderComparison() {
  const { comparison, left, right } = currentPair();
  renderComparisonControls();
  elements["pair-label"].textContent = comparison.label;
  elements["left-history-label"].textContent = left.label;
  elements["right-history-label"].textContent = right.label;
  setMachine(elements["left-manifest"], left.manifest.digest);
  setMachine(elements["right-manifest"], right.manifest.digest);
  renderTimelines();
  renderRootfs(left);
  renderIdentityRegimes();
  renderHiddenHistory();
  renderInspector();
}

function renderCostControls() {
  elements["cost-controls"].replaceChildren(...state.model.historicalLoad.results.map((result) => {
    const button = node("button", "cost-button");
    button.type = "button";
    button.dataset.active = String(result.costFunction === state.costId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.append(node("strong", "", result.costFunction.replaceAll("-", " ")), node("span", "", `${result.historicalLoad.toLocaleString()} ${result.unit}`));
    button.addEventListener("click", () => { state.costId = result.costFunction; renderHistoricalLoad(); });
    return button;
  }));
}

function renderHistoricalLoad() {
  const result = state.model.load(state.costId);
  renderCostControls();
  elements["load-value"].textContent = result.historicalLoad.toLocaleString();
  elements["load-unit"].textContent = result.unit;
  elements["load-equation"].textContent = `${result.observedCost.toLocaleString()} \u2212 ${result.optimumCost.toLocaleString()} = +${result.historicalLoad.toLocaleString()}`;
  elements["load-definition"].textContent = result.definition;
  const maximum = Math.max(...result.candidateCosts.map((candidate) => candidate.cost));
  elements["candidate-costs"].replaceChildren(...result.candidateCosts.map((candidate) => {
    const row = node("div", "cost-row");
    const label = node("div", "");
    label.append(node("strong", "", candidate.historyId), node("span", "", candidate.cost.toLocaleString()));
    const track = node("i", "");
    const bar = node("b", "");
    bar.style.width = `${Math.max(4, candidate.cost / maximum * 100)}%`;
    track.append(bar);
    row.dataset.optimum = String(candidate.cost === result.optimumCost);
    row.append(label, track);
    return row;
  }));
  elements["load-interpretation"].textContent = `For ${result.costFunction.replaceAll("-", " ")}, history-a carries ${result.historicalLoad.toLocaleString()} extra ${result.unit} relative to ${result.optimumHistories.join(" and ")} inside this declared space. This is not a universal OCI complexity score.`;
}

function renderSummary() {
  const model = state.model;
  setMachine(elements["case-identity"], model.identity);
  elements["history-count"].textContent = String(model.histories.length);
  elements["layer-count"].textContent = String(model.histories.reduce((sum, history) => sum + history.layers.length, 0));
  elements["file-count"].textContent = String(model.histories[0].finalRootfs.files.length);
  elements["spec-version"].textContent = `OCI ${model.specification.version}`;
}

async function main() {
  state.model = createOciLayerHistoryModel(await fetchArtifact());
  renderSummary();
  renderComparison();
  renderHistoricalLoad();
  elements["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

main().catch((error) => {
  document.body.dataset.state = "error";
  elements["load-state"].textContent = "Verification failed";
  elements["fatal-error"].hidden = false;
  elements["fatal-error"].textContent = error.message;
  console.error(error);
});
