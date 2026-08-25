import { createAirflowConstraintModel } from "./airflow-constraint-model.js?v=20260825.1";

const ARTIFACT_URL = new URL("../../cases/airflow-dependency-constraints/artifacts/airflow-dependency-constraints.json", import.meta.url);
const ARTIFACT_SHA256 = "7d11b2110f8fafff1571c08669f70b8fcafd74d307867f3b3b89ce784c1718b9";
const MAX_ARTIFACT_BYTES = 384 * 1024;
const state = { model: null, costId: "wheel-download-bytes", ablationId: "relax-pydantic-pair" };
const ids = ["load-state", "fatal-error", "case-identity", "source-identity", "source-count", "metric-grid", "cost-controls", "cost-detail", "solution-table", "ablation-controls", "ablation-detail", "shared-grid", "rejection-list", "scope-boundary"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Airflow Constraint Resolution Lab markup is missing #${id}.`);

function node(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") element.textContent = text; return element; }
function shortIdentity(value) { return `${value.slice(0, 15)}...${value.slice(-8)}`; }
function number(value) { return value.toLocaleString("en-US"); }
function costLabel(id) { return ({ "wheel-download-bytes": "Wheel bytes", "environment-change-actions": "Version changes", "selected-wheel-count": "Wheel count" })[id]; }
function costValue(value, id) { return id === "wheel-download-bytes" ? `${number(value)} B` : number(value); }

async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Airflow constraint artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Airflow constraint artifact SHA-256 mismatch: ${actual}.`);
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(source); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const model = state.model;
  const values = [
    [model.projects.length, "projects"],
    [model.candidateUniverse.candidates.length, "exact candidates"],
    [model.diagnostics.assignmentsConsidered, "assignments"],
    [model.solutions.length, "complete solutions"],
    [model.solutions.filter(({ constraintCompliant }) => constraintCompliant).length, "officially admitted"]
  ];
  el["metric-grid"].replaceChildren(...values.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", number(value)), node("span", "", label)); return card; }));
}

function renderCost() {
  const result = state.model.load(state.costId);
  el["cost-controls"].replaceChildren(...state.model.historicalLoad.results.map((entry) => {
    const button = node("button", "choice-button", costLabel(entry.costFunction));
    button.type = "button";
    button.dataset.active = String(entry.costFunction === state.costId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.costId = entry.costFunction; renderCost(); renderAblation(); });
    return button;
  }));
  const wrapper = node("div", "cost-equation");
  for (const [kind, label, value] of [["free", "Free optimum", result.free.optimumCost], ["constrained", "Constrained optimum", result.constrained.optimumCost], ["load", "Historical Load", result.historicalLoad]]) {
    const card = node("article"); card.dataset.kind = kind; card.append(node("span", "", label), node("strong", "", costValue(value, state.costId)), node("small", "", kind === "free" ? `${result.free.solutionCount} free solutions` : kind === "constrained" ? `${result.constrained.solutionCount} admitted solution` : `aF - a0 / ${result.unit}`)); wrapper.append(card);
  }
  const note = node("p", "cost-note", result.historicalLoad === 0 ? "Zero is retained as a scientific result: the constraint changes identity but not this minimum." : "The value belongs only to this cost and finite projection; it is not a universal Airflow score.");
  el["cost-detail"].replaceChildren(wrapper, note);
}

function selectionMap(solution) { return new Map(solution.selections.map((entry) => [entry.project, entry.version])); }
function renderSolutions() {
  const baseline = selectionMap(state.model.baseline);
  const constrained = selectionMap(state.model.constrained);
  const rows = state.model.projects.filter((project) => project.versions.length > 1).map((project) => {
    const leftVersion = baseline.get(project.project);
    const rightVersion = constrained.get(project.project);
    const left = state.model.candidate(project.project, leftVersion);
    const right = state.model.candidate(project.project, rightVersion);
    const row = node("tr");
    const projectCell = node("th", "project-name", project.project); projectCell.scope = "row";
    row.append(projectCell, node("td", "version-cell", leftVersion), node("td", "version-cell constrained-version", rightVersion), node("td", "delta-cell", `${right.wheel.size - left.wheel.size >= 0 ? "+" : ""}${number(right.wheel.size - left.wheel.size)} B`));
    return row;
  });
  el["solution-table"].replaceChildren(...rows);
}

function ablationLabel(id) { return id.replace("relax-", "").replaceAll("-", " "); }
function renderAblation() {
  el["ablation-controls"].replaceChildren(...state.model.constraintAblations.map((entry) => {
    const button = node("button", "choice-button", ablationLabel(entry.id));
    button.type = "button";
    button.dataset.active = String(entry.id === state.ablationId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.ablationId = entry.id; renderAblation(); });
    return button;
  }));
  const ablation = state.model.ablation(state.ablationId);
  const result = ablation.results.find((entry) => entry.costFunction === state.costId);
  const wrapper = node("article", "ablation-card");
  wrapper.append(node("span", "", "RELAXED PROJECTS"), node("h3", "", ablation.relaxedProjects.join(" + ")), node("strong", "", `${result.constrained.solutionCount} admitted solution${result.constrained.solutionCount === 1 ? "" : "s"}`), node("p", "", `${costLabel(state.costId)} Historical Load becomes ${costValue(result.historicalLoad, state.costId)}. Official source bytes remain unchanged.`));
  el["ablation-detail"].replaceChildren(wrapper);
}

function renderShared() {
  el["shared-grid"].replaceChildren(...state.model.sharedDependencies.map((entry) => {
    const card = node("article", "shared-card");
    card.append(node("strong", "", entry.project), node("span", "", `${entry.consumerCount} consumers`), node("p", "", entry.consumers.join(" / "))); return card;
  }));
}

function renderDiagnostics() {
  const summary = node("article", "diagnostic-summary");
  summary.append(node("strong", "", number(state.model.diagnostics.rejectedAssignments)), node("span", "", "rejected assignments"), node("p", "", "The exhaustive enumerator records these conflicts, but no assignment count, runtime, or backtracking step enters a path cost."));
  const reasons = state.model.diagnostics.rejectionCounts.map((entry) => { const item = node("article", "rejection-card"); item.append(node("strong", "", `${number(entry.count)} rejections`), node("code", "", entry.reason)); return item; });
  el["rejection-list"].replaceChildren(summary, ...reasons);
}

function render() {
  const model = state.model;
  el["case-identity"].textContent = shortIdentity(model.identity);
  el["source-identity"].textContent = shortIdentity(model.sourceIdentity);
  el["source-count"].textContent = `${model.source.lock.files.length} exact files`;
  el["scope-boundary"].textContent = model.scope.boundary;
  renderMetrics(); renderCost(); renderSolutions(); renderAblation(); renderShared(); renderDiagnostics();
}

async function main() {
  try {
    state.model = createAirflowConstraintModel(await fetchArtifact());
    render();
    document.body.dataset.state = "ready";
    el["load-state"].textContent = "Verified exact release";
  } catch (error) {
    document.body.dataset.state = "error";
    el["load-state"].textContent = "Artifact rejected";
    el["fatal-error"].hidden = false;
    el["fatal-error"].textContent = error.message;
  }
}

main();
