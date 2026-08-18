import { createHistoryEquivalenceModel } from "./history-equivalence-model.js?v=20260818.1";

const ARTIFACT_URL = new URL("../../cases/reproducible-build-equivalence/artifacts/reproducible-build-equivalence.json", import.meta.url);
const EXPECTED_SHA256 = "629ece373035c716136c4acf6b51d3b1213186af083979dffa9d6165a65ae6ea";
const MAX_BYTES = 48 * 1024;
const ids = ["load-state", "case-identity", "source-identity", "history-count", "pair-controls", "pair-label", "history-left", "history-right", "regime-controls", "verdict-symbol", "verdict-word", "verdict-question", "verdict-explanation", "compared-fields", "differing-fields", "excluded-fields", "projection-left", "projection-right", "matrix-head", "matrix-body", "specified-outputs", "instruction-profile", "historical-load-status", "historical-load-reason", "fatal-error"];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) if (!element) throw new Error(`History Equivalence Lab markup is missing #${id}.`);
const state = { model: null, pairId: "cross-toolchain-rebuild", regimeId: "byte-output" };

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function short(value, length = 30) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact build-equivalence artifact could not be loaded.");
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("The build-equivalence artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("The build-equivalence artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error("The build-equivalence artifact exceeds its byte limit.");
  const digest = await sha256Hex(bytes);
  if (digest !== EXPECTED_SHA256) throw new Error(`Build-equivalence artifact SHA-256 mismatch: ${digest}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The build-equivalence artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The build-equivalence artifact is not valid JSON."); }
}

function renderPairControls() {
  elements["pair-controls"].replaceChildren(...state.model.comparisons.map((comparison, index) => {
    const button = node("button", "pair-button", `${String(index + 1).padStart(2, "0")} ${comparison.label}`);
    button.type = "button";
    button.dataset.active = String(comparison.id === state.pairId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.pairId = comparison.id; renderComparison(); });
    return button;
  }));
}

function field(label, value, { mono = false, excluded = false } = {}) {
  const row = node("div", "history-field");
  if (excluded) row.dataset.excluded = "true";
  row.append(node("dt", "", label), node("dd", mono ? "mono" : "", value));
  return row;
}

function historyCard(history, side) {
  const card = node("article", "history-card");
  card.dataset.side = side;
  const header = node("header", "");
  header.append(node("span", "", side === "left" ? "BUILD A" : "BUILD B"), node("strong", "", history.executionId));
  const details = node("dl", "history-details");
  details.append(
    field("Runtime", `${history.runtime.name} ${history.runtime.version}`),
    field("Platform", `${history.runtime.platform} / ${history.runtime.architecture}`),
    field("Captured", history.capturedAt, { mono: true }),
    field("Channel", history.declaredInputs.parameters.releaseChannel, { mono: true }),
    field("Input identity", short(history.declaredInputs.identity, 34), { mono: true }),
    field("Normalized env", `LANG=${history.environment.normalized.LANG}; TZ=${history.environment.normalized.TZ}; EPOCH=${history.environment.normalized.SOURCE_DATE_EPOCH}`, { mono: true }),
    field("Session label", `${history.environment.observedIrrelevant.ONTO2D_SESSION_LABEL} / excluded from environment regime`, { mono: true, excluded: true }),
    field("Output", `${history.artifact.bytes} bytes / ${short(history.artifact.sha256, 34)}`, { mono: true }),
    field("History identity", short(history.historyIdentity, 34), { mono: true })
  );
  card.append(header, details);
  return card;
}

function renderRegimeControls(comparison) {
  elements["regime-controls"].replaceChildren(...comparison.regimes.map((result) => {
    const button = node("button", "regime-button");
    button.type = "button";
    button.dataset.active = String(result.regimeId === state.regimeId);
    button.dataset.equal = String(result.equal);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.append(node("span", "", result.label), node("strong", "", result.equal ? "=" : "!="));
    button.addEventListener("click", () => { state.regimeId = result.regimeId; renderVerdict(); });
    return button;
  }));
}

function renderList(element, values, emptyText) {
  const items = values.length ? values : [emptyText];
  element.replaceChildren(...items.map((value) => node("li", "", value)));
  element.dataset.empty = String(values.length === 0);
}

function renderVerdict() {
  const result = state.model.verdict(state.pairId, state.regimeId);
  const comparison = state.model.comparison(state.pairId);
  renderRegimeControls(comparison);
  elements["verdict-symbol"].textContent = result.equal ? "=" : "!=";
  elements["verdict-word"].textContent = result.equal ? "EQUIVALENT" : "DISTINCT";
  elements["verdict-word"].dataset.equal = String(result.equal);
  elements["verdict-question"].textContent = result.question;
  elements["verdict-explanation"].textContent = result.equal
    ? "Every field selected by this regime has the same deterministic projection. The execution histories still remain separate records."
    : `This regime observes ${result.differingFields.length} differing field${result.differingFields.length === 1 ? "" : "s"}; equality under another regime does not override this verdict.`;
  renderList(elements["compared-fields"], result.comparedFields, "No fields declared");
  renderList(elements["differing-fields"], result.differingFields, "No selected fields differ");
  renderList(elements["excluded-fields"], result.excludedFields, "No explicit exclusions in this regime");
  elements["projection-left"].textContent = result.leftProjectionIdentity;
  elements["projection-right"].textContent = result.rightProjectionIdentity;
}

function renderComparison() {
  const comparison = state.model.comparison(state.pairId);
  renderPairControls();
  elements["pair-label"].textContent = comparison.label;
  elements["history-left"].replaceChildren(historyCard(state.model.history(comparison.leftHistory), "left"));
  elements["history-right"].replaceChildren(historyCard(state.model.history(comparison.rightHistory), "right"));
  renderVerdict();
}

function renderMatrix() {
  const head = node("tr", "");
  head.append(node("th", "", "Comparison"), ...state.model.regimes.map((regime) => node("th", "", regime.label)));
  elements["matrix-head"].replaceChildren(head);
  elements["matrix-body"].replaceChildren(...state.model.comparisons.map((comparison) => {
    const row = node("tr", "");
    row.append(node("th", "", comparison.label));
    for (const result of comparison.regimes) {
      const cell = node("td", "matrix-verdict", result.equal ? "EQUAL" : "DIFFERENT");
      cell.dataset.equal = String(result.equal);
      row.append(cell);
    }
    return row;
  }));
}

function renderBuildContract() {
  elements["specified-outputs"].replaceChildren(...state.model.build.specifiedOutputs.map((output) => {
    const item = node("li", "");
    item.append(node("strong", "", output.utf8.includes("channel=preview") ? "preview output" : "stable output"), node("code", "", `${output.bytes} bytes / ${output.sha256}`));
    return item;
  }));
  elements["instruction-profile"].textContent = `${state.model.build.instructions.format} / SOURCE_DATE_EPOCH=${state.model.build.instructions.sourceDateEpoch}`;
  elements["historical-load-status"].textContent = "NOT EVALUATED";
  elements["historical-load-reason"].textContent = state.model.historicalLoad.reason;
}

async function main() {
  state.model = createHistoryEquivalenceModel(await fetchArtifact());
  elements["case-identity"].textContent = state.model.identity;
  elements["source-identity"].textContent = state.model.sourceIdentity;
  elements["history-count"].textContent = `${state.model.histories.length} execution records / ${state.model.comparisons.length} pairs / ${state.model.regimes.length} regimes`;
  renderComparison();
  renderMatrix();
  renderBuildContract();
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
