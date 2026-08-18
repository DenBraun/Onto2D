import { createGitHistoryModel } from "./git-history-model.js?v=20260818.3";

const ARTIFACT_URL = new URL("../../cases/git-history-identity/artifacts/history-identity.json", import.meta.url);
const EXPECTED_ARTIFACT_SHA256 = "eab24316d47b511ed4f2aebb465309db19b1d4218d3fe42eeadf23a3c3436b11";
const MAX_ARTIFACT_BYTES = 512 * 1024;
const ids = [
  "load-state", "fixture-identity", "object-count", "history-count", "comparison-count",
  "experiment-list", "regime-list", "left-history-title", "right-history-title", "left-head",
  "right-head", "left-timeline", "right-timeline", "identity-result", "active-regime",
  "identity-verdict", "left-identity", "right-identity", "identity-symbol", "identity-explanation",
  "experiment-claim", "regime-matrix", "inspector-id", "inspector-oid", "inspector-tree",
  "inspector-parents", "inspector-actor", "inspector-time", "inspector-message", "tree-entries",
  "fatal-error"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, node] of Object.entries(elements)) {
  if (!node) throw new Error(`Git History Identity Lab markup is missing #${id}.`);
}

const state = {
  model: null,
  comparisonId: "same-tree-different-ancestry",
  regimeId: "tree",
  selectedCommitId: "A2"
};

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortIdentity(value, length = 11) {
  return value.startsWith("sha256:") ? `${value.slice(0, length + 7)}...` : `${value.slice(0, length)}...`;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Git fixture artifact could not be loaded.");
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("The Git fixture artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The Git fixture artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The Git fixture artifact exceeds its byte limit.");
  const digest = await sha256Hex(bytes);
  if (digest !== EXPECTED_ARTIFACT_SHA256) throw new Error(`Git fixture SHA-256 mismatch: ${digest}.`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The Git fixture artifact is not valid UTF-8.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The Git fixture artifact is not valid JSON.");
  }
}

function current() {
  return {
    comparison: state.model.comparison(state.comparisonId),
    regime: state.model.regime(state.regimeId)
  };
}

function explanation(regimeId, equal) {
  if (regimeId === "tree") return equal
    ? "Both head commits reference the same native Git tree object: the current filesystem state is identical."
    : "The head commits reference different native Git tree objects.";
  if (regimeId === "commit") return equal
    ? "Both selections resolve to the same native commit object."
    : "Tree equality does not erase parent, actor, timestamp, or message fields from native commit identity.";
  if (regimeId === "ancestry") return equal
    ? "The exact parent closure below each selected head is identical, even though the head commit metadata differs."
    : "The selected heads have different exact parent closure or topology.";
  return equal
    ? "tree-state-v1 deliberately treats these distinct histories as one equivalence class while preserving both records."
    : "The selected histories are not equivalent under tree-state-v1.";
}

function renderControls() {
  elements["experiment-list"].replaceChildren(...state.model.comparisons.map((comparison) => {
    const button = element("button", "control-button");
    button.type = "button";
    button.dataset.id = comparison.id;
    button.setAttribute("aria-pressed", String(comparison.id === state.comparisonId));
    button.append(element("span", "", comparison.id.split("-")[0]), element("strong", "", comparison.label));
    button.addEventListener("click", () => {
      state.comparisonId = comparison.id;
      state.selectedCommitId = comparison.leftHead;
      render();
    });
    return button;
  }));
  elements["regime-list"].replaceChildren(...state.model.regimes.map((regime) => {
    const button = element("button", "control-button");
    button.type = "button";
    button.dataset.id = regime.id;
    button.setAttribute("aria-pressed", String(regime.id === state.regimeId));
    button.append(element("span", "", regime.id), element("strong", "", regime.label));
    button.title = regime.compares;
    button.addEventListener("click", () => {
      state.regimeId = regime.id;
      render();
    });
    return button;
  }));
}

function commitButton(commit, isHead) {
  const button = element("button", "commit-card");
  button.type = "button";
  button.dataset.head = String(isHead);
  button.dataset.selected = String(commit.fixtureId === state.selectedCommitId);
  button.title = `${commit.fixtureId} | ${commit.oid}`;
  const identity = element("div");
  identity.append(element("strong", "", commit.fixtureId), element("code", "", shortIdentity(commit.oid, 9)));
  button.append(
    identity,
    element("p", "", commit.message),
    element("small", "", commit.parents.length === 0 ? "root commit" : `parent ${commit.parents.join(" + ")}`)
  );
  button.addEventListener("click", () => {
    state.selectedCommitId = commit.fixtureId;
    render();
  });
  return button;
}

function renderHistory(side, historyId) {
  const history = state.model.history(historyId);
  const title = elements[`${side}-history-title`];
  title.textContent = history.label;
  const head = state.model.commit(history.head);
  elements[`${side}-head`].textContent = shortIdentity(head.oid);
  elements[`${side}-head`].title = head.oid;
  elements[`${side}-timeline`].replaceChildren(...history.commits.map((commitId) =>
    commitButton(state.model.commit(commitId), commitId === history.head)
  ));
}

function renderResult() {
  const { comparison, regime } = current();
  const result = comparison.results[regime.id];
  elements["identity-result"].dataset.equal = String(result.equal);
  elements["active-regime"].textContent = regime.label;
  elements["identity-verdict"].textContent = result.equal ? "SAME" : "DIFFERENT";
  elements["identity-symbol"].textContent = result.equal ? "=" : "!=";
  for (const side of ["left", "right"]) {
    elements[`${side}-identity`].textContent = shortIdentity(result[side], 16);
    elements[`${side}-identity`].title = result[side];
  }
  elements["identity-explanation"].textContent = explanation(regime.id, result.equal);
  elements["experiment-claim"].textContent = comparison.claim;
}

function renderMatrix() {
  const { comparison } = current();
  elements["regime-matrix"].replaceChildren(...state.model.regimes.map((regime) => {
    const result = comparison.results[regime.id];
    const button = element("button", "matrix-row");
    button.type = "button";
    button.dataset.active = String(regime.id === state.regimeId);
    button.dataset.equal = String(result.equal);
    button.append(
      element("span", "", regime.label),
      element("code", "", shortIdentity(result.left, 8)),
      element("b", "", result.equal ? "SAME" : "DIFFERENT"),
      element("code", "", shortIdentity(result.right, 8))
    );
    button.addEventListener("click", () => {
      state.regimeId = regime.id;
      render();
    });
    return button;
  }));
}

function renderInspector() {
  const commit = state.model.commit(state.selectedCommitId);
  const tree = state.model.tree(commit.treeFixtureId);
  elements["inspector-id"].textContent = commit.fixtureId;
  elements["inspector-oid"].textContent = commit.oid;
  elements["inspector-tree"].textContent = commit.tree;
  elements["inspector-parents"].textContent = commit.parentOids.length === 0 ? "none / root" : commit.parentOids.join(" | ");
  elements["inspector-actor"].textContent = `${commit.actor.name} <${commit.actor.email}>`;
  elements["inspector-time"].textContent = `${new Date(commit.timestamp * 1000).toISOString()} ${commit.timezone}`;
  elements["inspector-message"].textContent = commit.message;
  elements["tree-entries"].replaceChildren(...tree.entries.map((entry) => {
    const row = element("div");
    const path = element("strong", "", entry.path);
    path.title = entry.path;
    const oid = element("code", "", shortIdentity(entry.oid, 10));
    oid.title = entry.oid;
    row.append(path, element("span", "", entry.mode), oid);
    return row;
  }));
}

function render() {
  renderControls();
  const { comparison } = current();
  renderHistory("left", comparison.leftHistory);
  renderHistory("right", comparison.rightHistory);
  renderResult();
  renderMatrix();
  renderInspector();
}

async function start() {
  const artifact = await fetchArtifact();
  state.model = createGitHistoryModel(artifact);
  const statistics = state.model.statistics;
  elements["fixture-identity"].textContent = shortIdentity(state.model.identity, 16);
  elements["fixture-identity"].title = state.model.identity;
  elements["object-count"].textContent = `${statistics.blobCount} blob / ${statistics.treeCount} tree / ${statistics.commitCount} commit`;
  elements["history-count"].textContent = String(statistics.historyCount);
  elements["comparison-count"].textContent = String(statistics.comparisonCount);
  render();
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = "Artifact verified";
}

start().catch((error) => {
  document.body.dataset.state = "error";
  elements["load-state"].textContent = "Verification failed";
  elements["fatal-error"].hidden = false;
  elements["fatal-error"].textContent = error instanceof Error ? error.message : String(error);
});
