import { createInTotoAdmissibilityModel } from "./in-toto-admissibility-model.js?v=20260818.1";

const ARTIFACT_URL = new URL("../../cases/in-toto-admissibility/artifacts/in-toto-admissibility.json", import.meta.url);
const EXPECTED_SHA256 = "4bead31a7f18f308842b4c9babd5480b89d00c82acc047bc17a08b64a5416be6";
const MAX_BYTES = 96 * 1024;
const ids = ["load-state", "case-identity", "final-identity", "spec-version", "left-final-hash", "right-execution-label", "right-execution-name", "right-final-hash", "right-verdict", "step-flow", "scenario-controls", "link-list", "verification-summary", "check-list", "warning-box", "route-list", "cost-controls", "load-number", "load-equation", "load-unit", "load-definition", "fatal-error"];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) if (!element) throw new Error(`in-toto Explorer markup is missing #${id}.`);
const state = { model: null, executionId: "shortcut", costId: "step-count" };

function node(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
function short(value, length = 22) { return value.length > length ? `${value.slice(0, length)}...` : value; }
async function sha256Hex(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact in-toto case artifact could not be loaded.");
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("The in-toto case artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("The in-toto case artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error("The in-toto case artifact exceeds its byte limit.");
  const digest = await sha256Hex(bytes);
  if (digest !== EXPECTED_SHA256) throw new Error(`in-toto case SHA-256 mismatch: ${digest}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The in-toto case artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The in-toto case artifact is not valid JSON."); }
}

function renderLayout() {
  const cards = [];
  state.model.layout.steps.forEach((step, index) => {
    if (index) cards.push(node("span", "flow-arrow", "->"));
    const card = node("article", "step-card");
    card.append(node("span", "", `step ${index + 1}`), node("strong", "", step.name), node("code", "", step.expected_command.join(" ")), node("code", "", `${step.pubkeys[0].slice(0, 16)}...`));
    cards.push(card);
  });
  cards.push(node("span", "flow-arrow", "->"));
  const inspection = state.model.layout.inspections[0];
  const card = node("article", "step-card");
  card.append(node("span", "", "client inspection"), node("strong", "", inspection.name), node("code", "", inspection.run.join(" ")));
  cards.push(card);
  elements["step-flow"].replaceChildren(...cards);
}

function renderScenarioControls() {
  elements["scenario-controls"].replaceChildren(...state.model.executions.map((execution, index) => {
    const button = node("button", "scenario-button", `${String(index + 1).padStart(2, "0")} ${execution.id.replaceAll("-", " ")}`);
    button.type = "button";
    button.dataset.active = String(execution.id === state.executionId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.executionId = execution.id; renderExecution(); });
    return button;
  }));
}

function renderLinks(execution) {
  elements["link-list"].replaceChildren(...execution.links.map((link) => {
    const row = node("article", "link-row");
    const title = node("strong", "", link.record.signed.name);
    const detail = node("div");
    detail.append(node("code", "", link.record.signed.command.join(" ")), node("code", "", `signed ${short(link.signerKeyId)}`), node("code", "", `metadata ${short(link.identity)}`));
    row.append(title, detail);
    return row;
  }));
}

function renderChecks(execution) {
  const native = execution.verification.native;
  elements["verification-summary"].textContent = `${native.checks.filter((check) => check.status === "pass").length} of ${native.checks.length} native checks pass. Native verdict: ${native.status}. Optional strict-command verdict: ${execution.verification.strictCommand.status}.`;
  elements["check-list"].replaceChildren(...native.checks.map((check) => {
    const row = node("article", "check-row"); row.dataset.status = check.status;
    const body = node("div"); body.append(node("strong", "", check.label), node("p", "", check.detail), node("code", "", check.sourcePointer));
    row.append(node("span", "check-status", check.status), body); return row;
  }));
  elements["warning-box"].hidden = native.warnings.length === 0;
  elements["warning-box"].textContent = native.warnings.map((warning) => `${warning.label}: ${warning.detail}`).join(" ");
}

function renderExecution() {
  const execution = state.model.execution(state.executionId);
  renderScenarioControls(); renderLinks(execution); renderChecks(execution);
  elements["right-execution-label"].textContent = `Selected / ${execution.id}`;
  elements["right-execution-name"].textContent = execution.label;
  elements["right-final-hash"].textContent = execution.finalArtifact.sha256;
  elements["right-verdict"].textContent = execution.verification.native.status.toUpperCase();
  elements["right-verdict"].dataset.status = execution.verification.native.status;
}

function renderRoutes() {
  elements["route-list"].replaceChildren(...state.model.routes.map((route) => {
    const row = node("article", "route-row"); row.dataset.admissible = String(route.admissible);
    const body = node("div"); body.append(node("strong", "", route.label));
    const tags = node("div", "route-tags");
    [route.actual ? "actual baseline" : "counterfactual", route.admissible ? "admissible" : "inadmissible", `${route.costs.steps} step(s)`, `${route.costs.actors} actor(s)`].forEach((tag) => tags.append(node("span", "", tag)));
    body.append(tags); row.append(body, node("strong", "", route.admissible ? "PASS" : "FAIL")); return row;
  }));
}

function renderCostControls() {
  elements["cost-controls"].replaceChildren(...state.model.historicalLoad.results.map((result) => {
    const button = node("button", "cost-button", result.costFunction.replaceAll("-", " ")); button.type = "button";
    button.dataset.active = String(result.costFunction === state.costId); button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.costId = result.costFunction; renderLoad(); }); return button;
  }));
}

function renderLoad() {
  const result = state.model.load(state.costId); renderCostControls();
  elements["load-number"].textContent = `+${result.historicalLoad}`;
  elements["load-equation"].textContent = result.equation;
  elements["load-unit"].textContent = `The shortest native-policy-admissible route requires ${result.historicalLoad} additional ${result.unit} relative to the cheapest technically possible route in this four-route space.`;
  elements["load-definition"].textContent = `${result.definition} This is neither a risk score nor an in-toto metric.`;
}

async function main() {
  state.model = createInTotoAdmissibilityModel(await fetchArtifact());
  elements["case-identity"].textContent = state.model.identity;
  elements["final-identity"].textContent = state.model.finalArtifact.sha256;
  elements["spec-version"].textContent = `in-toto ${state.model.specification.version}`;
  elements["left-final-hash"].textContent = state.model.finalArtifact.sha256;
  renderLayout(); renderExecution(); renderRoutes(); renderLoad();
  elements["load-state"].textContent = "Artifact verified"; document.body.dataset.state = "ready";
}

main().catch((error) => { document.body.dataset.state = "error"; elements["load-state"].textContent = "Verification failed"; elements["fatal-error"].hidden = false; elements["fatal-error"].textContent = error.message; console.error(error); });
