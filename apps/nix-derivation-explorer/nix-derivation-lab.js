import { createNixDerivationModel } from "./nix-derivation-model.js?v=20260818.4";

const ARTIFACT_URL = new URL("../../cases/nix-derivation-identity/artifacts/nix-derivation-identity.json", import.meta.url);
const EXPECTED_ARTIFACT_SHA256 = "b967275bc1f71b586ea836e2fc52198c5c476836589db0f6eff909fa2a9fcbd6";
const MAX_ARTIFACT_BYTES = 768 * 1024;
const ids = [
  "load-state", "case-identity", "derivation-count", "direct-edge-count", "closure-edge-count", "nix-runtime",
  "experiment-list", "regime-list", "left-title", "right-title", "left-drv", "right-drv", "left-addressing",
  "right-addressing", "left-output", "right-output", "left-closure", "right-closure", "left-environment",
  "right-environment", "inspect-left", "inspect-right", "construction-lanes", "identity-result", "active-regime",
  "identity-verdict", "left-identity", "right-identity", "identity-symbol", "identity-explanation", "experiment-claim",
  "regime-matrix", "inspector-id", "inspector-drv", "inspector-raw", "inspector-output", "inspector-system",
  "inspector-builder", "inspector-depth", "inspector-inputs", "environment-entries", "fatal-error"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, node] of Object.entries(elements)) {
  if (!node) throw new Error(`Nix Derivation Identity Lab markup is missing #${id}.`);
}

const state = {
  model: null,
  comparisonId: "same-content-different-derivation",
  regimeId: "output-content",
  selectedSide: "left"
};

const regimeExplanations = Object.freeze({
  "output-content": {
    same: "The two observed outputs contain exactly the same verified bytes.",
    different: "The observed output bytes differ.",
    unresolved: "At least one output was not realized, so byte equality is not known."
  },
  derivation: {
    same: "Both sides refer to the same native .drv store path.",
    different: "The native .drv paths differ: Nix received different construction descriptions.",
    unresolved: "Derivation identity was not captured."
  },
  "input-closure": {
    same: "The complete inputDrvs membership and topology are identical.",
    different: "The transitive input closure or its topology differs.",
    unresolved: "Input-closure evidence is incomplete."
  },
  "builder-environment": {
    same: "System, builder, arguments, and declared environment match under builder-env-v1.",
    different: "At least one declared builder-environment field differs.",
    unresolved: "Builder-environment evidence is incomplete."
  },
  "history-class": {
    same: "Under output-content-v1, the two constructions belong to the same output history class.",
    different: "The constructions do not share an output-content history class.",
    unresolved: "The output history class cannot be assigned without realized content evidence."
  }
});

function node(name, className, text) {
  const value = document.createElement(name);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function short(value, length = 15) {
  if (value === null) return "not observed";
  const visible = value.startsWith("/nix/store/") ? value.slice("/nix/store/".length) : value;
  return visible.length > length ? `${visible.slice(0, length)}\u2026` : visible;
}

function setPath(element, value) {
  element.textContent = value;
  element.title = value;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Nix case artifact could not be loaded.");
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("The Nix case artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The Nix case artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The Nix case artifact exceeds its byte limit.");
  const digest = await sha256Hex(bytes);
  if (digest !== EXPECTED_ARTIFACT_SHA256) throw new Error(`Nix case SHA-256 mismatch: ${digest}.`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The Nix case artifact is not valid UTF-8.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The Nix case artifact is not valid JSON.");
  }
}

function current() {
  const comparison = state.model.comparison(state.comparisonId);
  return {
    comparison,
    regime: state.model.regime(state.regimeId),
    left: state.model.derivation(comparison.leftFixtureId),
    right: state.model.derivation(comparison.rightFixtureId)
  };
}

function statusFor(result) {
  return result.status === "unresolved" ? "unresolved" : result.equal ? "same" : "different";
}

function renderControls() {
  elements["experiment-list"].replaceChildren(...state.model.comparisons.map((comparison, index) => {
    const button = node("button", "control-button");
    button.type = "button";
    button.dataset.active = String(comparison.id === state.comparisonId);
    button.setAttribute("aria-pressed", String(comparison.id === state.comparisonId));
    const number = node("span", "control-number", String(index + 1).padStart(2, "0"));
    const copy = node("span");
    copy.append(node("strong", "", comparison.label), node("small", "", `${comparison.leftFixtureId} \u2194 ${comparison.rightFixtureId}`));
    button.append(number, copy);
    button.addEventListener("click", () => {
      state.comparisonId = comparison.id;
      state.selectedSide = "left";
      render();
    });
    return button;
  }));

  elements["regime-list"].replaceChildren(...state.model.regimes.map((regime) => {
    const button = node("button", "control-button regime-button");
    button.type = "button";
    button.dataset.active = String(regime.id === state.regimeId);
    button.setAttribute("aria-pressed", String(regime.id === state.regimeId));
    const copy = node("span");
    copy.append(node("strong", "", regime.label), node("small", "", regime.compares));
    button.append(copy);
    button.addEventListener("click", () => {
      state.regimeId = regime.id;
      render();
    });
    return button;
  }));
}

function renderDerivation(prefix, derivation) {
  elements[`${prefix}-title`].textContent = derivation.fixtureId;
  setPath(elements[`${prefix}-drv`], derivation.drvPath);
  elements[`${prefix}-addressing`].textContent = derivation.outputAddressing;
  setPath(elements[`${prefix}-output`], derivation.outputPath);
  elements[`${prefix}-closure`].textContent = `${derivation.inputClosure.members.length} member${derivation.inputClosure.members.length === 1 ? "" : "s"} / depth ${derivation.depth}`;
  setPath(elements[`${prefix}-environment`], derivation.builderEnvironment.identity);
}

function arrow(kind, label) {
  const wrapper = node("span", `map-arrow ${kind}`);
  wrapper.setAttribute("aria-label", label);
  wrapper.append(node("i"), node("b", "", "\u203a"));
  return wrapper;
}

function mapBox(className, title, detail) {
  const box = node("span", `map-node ${className}`);
  box.title = detail;
  box.append(node("small", "", title), node("strong", "", short(detail, 18)));
  return box;
}

function renderLane(side, derivation) {
  const lane = node("section", "construction-lane");
  lane.append(node("h4", "", side === "left" ? "LEFT" : "RIGHT"));
  const flow = node("div", "construction-flow");
  const inputStack = node("div", "input-stack");
  if (derivation.directInputDrvs.length === 0) inputStack.append(mapBox("empty", "DIRECT INPUT", "none"));
  for (const input of derivation.directInputDrvs) {
    const record = state.model.derivations.find((entry) => entry.drvPath === input.drvPath);
    inputStack.append(mapBox("input", "INPUT DRV", record?.fixtureId ?? input.drvPath));
  }
  flow.append(
    inputStack,
    arrow("native", "native inputDrv relation"),
    mapBox("derivation", "DERIVATION", derivation.fixtureId),
    arrow("declared", "declares output; realization is not implied"),
    mapBox("output", derivation.outputEvidence === "materialized-fixed-output" ? "OBSERVED OUTPUT" : "DECLARED OUTPUT", derivation.outputPath)
  );
  lane.append(flow);
  return lane;
}

function renderMap(left, right) {
  elements["construction-lanes"].replaceChildren(renderLane("left", left), renderLane("right", right));
}

function renderResult(comparison, regime) {
  const result = comparison.results[regime.id];
  const status = statusFor(result);
  elements["identity-result"].dataset.status = status;
  elements["active-regime"].textContent = regime.label;
  elements["identity-verdict"].textContent = status === "same" ? "SAME" : status === "different" ? "DIFFERENT" : "UNRESOLVED";
  elements["identity-symbol"].textContent = status === "same" ? "=" : status === "different" ? "\u2260" : "?";
  setPath(elements["left-identity"], result.left ?? "not observed");
  setPath(elements["right-identity"], result.right ?? "not observed");
  elements["identity-explanation"].textContent = regimeExplanations[regime.id][status];
  elements["experiment-claim"].textContent = comparison.claim;
}

function renderMatrix(comparison) {
  elements["regime-matrix"].replaceChildren(...state.model.regimes.map((regime) => {
    const result = comparison.results[regime.id];
    const status = statusFor(result);
    const button = node("button", "matrix-row");
    button.type = "button";
    button.dataset.status = status;
    button.dataset.active = String(regime.id === state.regimeId);
    button.setAttribute("aria-pressed", String(regime.id === state.regimeId));
    const label = node("span", "matrix-label");
    label.append(node("strong", "", regime.label), node("small", "", regime.compares));
    const values = node("span", "matrix-values");
    const left = node("code", "", short(result.left, 19));
    left.title = result.left ?? "not observed";
    const right = node("code", "", short(result.right, 19));
    right.title = result.right ?? "not observed";
    values.append(left, node("b", "", status === "same" ? "=" : status === "different" ? "\u2260" : "?"), right);
    button.append(label, values, node("em", "", status.toUpperCase()));
    button.addEventListener("click", () => {
      state.regimeId = regime.id;
      render();
    });
    return button;
  }));
}

function renderInspector(derivation) {
  elements["inspector-id"].textContent = derivation.fixtureId;
  setPath(elements["inspector-drv"], derivation.drvPath);
  setPath(elements["inspector-raw"], derivation.rawIdentity);
  setPath(elements["inspector-output"], derivation.outputPath);
  elements["inspector-system"].textContent = derivation.system;
  setPath(elements["inspector-builder"], derivation.builder);
  elements["inspector-depth"].textContent = String(derivation.depth);
  elements["inspector-inputs"].textContent = `${derivation.directInputDrvs.length} direct / ${derivation.inputClosure.members.length} transitive`;
  const entries = Object.entries(derivation.env).sort(([left], [right]) => left.localeCompare(right));
  elements["environment-entries"].replaceChildren(...entries.map(([key, value]) => {
    const row = node("div");
    const code = node("code", "", String(value));
    code.title = String(value);
    row.append(node("span", "", key), code);
    return row;
  }));
  elements["inspect-left"].dataset.active = String(state.selectedSide === "left");
  elements["inspect-right"].dataset.active = String(state.selectedSide === "right");
}

function render() {
  const { comparison, regime, left, right } = current();
  renderControls();
  renderDerivation("left", left);
  renderDerivation("right", right);
  renderMap(left, right);
  renderResult(comparison, regime);
  renderMatrix(comparison);
  renderInspector(state.selectedSide === "left" ? left : right);
}

function wireInspector() {
  elements["inspect-left"].addEventListener("click", () => {
    state.selectedSide = "left";
    render();
  });
  elements["inspect-right"].addEventListener("click", () => {
    state.selectedSide = "right";
    render();
  });
}

async function start() {
  const artifact = await fetchArtifact();
  state.model = createNixDerivationModel(artifact);
  elements["case-identity"].textContent = short(state.model.identity, 22);
  elements["case-identity"].title = state.model.identity;
  elements["derivation-count"].textContent = String(state.model.statistics.derivationCount);
  elements["direct-edge-count"].textContent = String(state.model.statistics.directEdgeCount);
  elements["closure-edge-count"].textContent = String(state.model.statistics.closureEdgeCount);
  elements["nix-runtime"].textContent = `Nix ${state.model.nix.version} / ${state.model.nix.platform}`;
  wireInspector();
  render();
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = "Artifact verified";
}

start().catch((error) => {
  document.body.dataset.state = "error";
  elements["load-state"].textContent = "Verification failed";
  elements["fatal-error"].hidden = false;
  elements["fatal-error"].textContent = error.message;
});
