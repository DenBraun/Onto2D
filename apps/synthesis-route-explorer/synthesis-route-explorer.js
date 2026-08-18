import { createChemicalSynthesisModel } from "./chemical-synthesis-model.js?v=20260818.1";

const ARTIFACT_URL = new URL("../../cases/chemical-synthesis-history/artifacts/chemical-synthesis-history.json", import.meta.url);
const EXPECTED_SHA256 = "d6033f8302bcce07954a8ba69abdc1f7c53858dbe3a85a30f269b9bc47eb198d";
const MAX_BYTES = 64 * 1024;
const ids = ["load-state", "case-identity", "source-identity", "ord-release", "target-controls", "target-label", "target-smiles", "target-cohort", "route-left", "route-right", "same-target", "same-record", "same-route", "yield-gap", "cascade-flow", "route-space", "cost-controls", "load-number", "load-equation", "load-explanation", "load-definition", "fatal-error"];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) if (!element) throw new Error(`Synthesis Route Explorer markup is missing #${id}.`);
const state = { model: null, targetId: "target-2-pyridyl", costId: "reaction-record-count" };

function node(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
function short(value, length = 30) { return value.length > length ? `${value.slice(0, length)}...` : value; }
function formatPercent(value) { return `${Number(value.toFixed(2))}%`; }
async function sha256Hex(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact chemical synthesis case artifact could not be loaded.");
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("The chemical synthesis artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("The chemical synthesis artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error("The chemical synthesis artifact exceeds its byte limit.");
  const digest = await sha256Hex(bytes);
  if (digest !== EXPECTED_SHA256) throw new Error(`Chemical synthesis artifact SHA-256 mismatch: ${digest}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The chemical synthesis artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The chemical synthesis artifact is not valid JSON."); }
}

function renderTargetControls() {
  elements["target-controls"].replaceChildren(...state.model.targets.map((target, index) => {
    const button = node("button", "target-button", `${String(index + 1).padStart(2, "0")} ${target.label.replace(/^Target [A-E] \/ /, "")}`);
    button.type = "button";
    button.dataset.active = String(target.id === state.targetId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.targetId = target.id; renderTarget(); });
    return button;
  }));
}

function field(label, value, mono = false) {
  const row = node("div", "route-field");
  row.append(node("dt", "", label), node("dd", mono ? "mono" : "", value));
  return row;
}

function routeCard(route, side) {
  const card = node("article", "route-card");
  card.dataset.side = side;
  const heading = node("header", "");
  const label = route.selectionReason === "minimum-recorded-yield" ? "Selected minimum" : "Selected maximum";
  heading.append(node("span", "", label), node("strong", "yield-value", formatPercent(route.outcome.yield.value)));
  const list = node("dl", "route-details");
  list.append(
    field("ORD record", route.reactionId, true),
    field("Aryl halide", short(route.inputs.arylHalide.smiles, 52), true),
    field("Catalyst", route.inputs.catalyst.name ?? short(route.inputs.catalyst.smiles, 34)),
    field("Base", route.inputs.base.name ?? short(route.inputs.base.smiles, 34)),
    field("Additive", route.inputs.additive.name ?? short(route.inputs.additive.smiles, 42), route.inputs.additive.name === null),
    field("Conditions", `${route.conditions.temperature.value} deg C / ${route.conditions.reactionTime.value} h`),
    field("Workup", route.workups.join(" -> "))
  );
  const identity = node("code", "route-identity", route.routeIdentity);
  card.append(heading, list, identity);
  return card;
}

function renderTarget() {
  const target = state.model.target(state.targetId);
  const [left, right] = target.routes;
  renderTargetControls();
  elements["target-label"].textContent = target.label;
  elements["target-smiles"].textContent = target.productIdentifier.value;
  elements["target-cohort"].textContent = `${target.sourceCohortSize} native records share this exact source product string; the deterministic comparison displays its measured-yield extrema.`;
  elements["route-left"].replaceChildren(routeCard(left, "left"));
  elements["route-right"].replaceChildren(routeCard(right, "right"));
  elements["same-target"].textContent = "YES";
  elements["same-record"].textContent = "NO";
  elements["same-route"].textContent = "NO";
  elements["yield-gap"].textContent = `+${formatPercent(right.outcome.yield.value - left.outcome.yield.value)}`;
}

function outcomeSummary(record) {
  const measured = record.outcomes.findLast((outcome) => outcome.yieldPercentage !== null) ?? record.outcomes.at(-1);
  return measured.yieldPercentage === null ? "yield missing" : `${formatPercent(measured.yieldPercentage)} yield`;
}

function renderCascade() {
  const cards = [];
  state.model.cascade.forEach((record, index) => {
    if (index) cards.push(node("span", "cascade-arrow", "->"));
    const card = node("article", "cascade-card");
    card.append(node("span", "", `record ${index + 1}`), node("strong", "", index === 2 ? "islatravir" : record.desiredProduct.name), node("p", "", outcomeSummary(record)), node("code", "", record.reactionId));
    if (index) card.append(node("small", "native-reference", `${record.crossReferencedReactionIds.length} native reaction_id reference${record.crossReferencedReactionIds.length === 1 ? "" : "s"}`));
    cards.push(card);
  });
  elements["cascade-flow"].replaceChildren(...cards);
}

function renderRouteSpace() {
  elements["route-space"].replaceChildren(...state.model.routes.map((route) => {
    const row = node("article", "analysis-route");
    row.dataset.admissible = String(route.admissible);
    const copy = node("div", "");
    copy.append(node("strong", "", route.label), node("p", "", route.rejection ?? "Every transition is backed by an exact ORD record and native cross-reference."));
    const tags = node("div", "route-tags");
    [route.actual ? "actual mapped route" : "counterfactual", `${route.costs.reactionRecords} record(s)`, `${route.costs.recordedIntermediates} intermediate(s)`].forEach((tag) => tags.append(node("span", "", tag)));
    copy.append(tags);
    row.append(copy, node("strong", "route-verdict", route.admissible ? "ADMISSIBLE" : "EXCLUDED"));
    return row;
  }));
}

function renderCostControls() {
  elements["cost-controls"].replaceChildren(...state.model.historicalLoad.results.map((result) => {
    const button = node("button", "cost-button", result.costFunction.replaceAll("-", " "));
    button.type = "button";
    button.dataset.active = String(result.costFunction === state.costId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.costId = result.costFunction; renderLoad(); });
    return button;
  }));
}

function renderLoad() {
  const result = state.model.load(state.costId);
  renderCostControls();
  elements["load-number"].textContent = `+${result.historicalLoad}`;
  elements["load-equation"].textContent = result.equation;
  elements["load-explanation"].textContent = state.costId === "reaction-record-count"
    ? "The evidence-backed route needs three recorded reaction transitions instead of the declared one-step shortcut: two additional records must remain in view."
    : "The evidence-backed route exposes two intermediate material states that the declared direct shortcut hides completely.";
  elements["load-definition"].textContent = `${result.definition} The number measures evidence-preserving history only inside these four routes. It says nothing about yield, safety, cost, difficulty, or shortcut feasibility.`;
}

async function main() {
  state.model = createChemicalSynthesisModel(await fetchArtifact());
  elements["case-identity"].textContent = state.model.identity;
  elements["source-identity"].textContent = state.model.sourceIdentity;
  elements["ord-release"].textContent = `ORD ${state.model.ord.release} / schema ${state.model.ord.schemaVersion}`;
  renderTarget(); renderCascade(); renderRouteSpace(); renderLoad();
  elements["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

main().catch((error) => { document.body.dataset.state = "error"; elements["load-state"].textContent = "Verification failed"; elements["fatal-error"].hidden = false; elements["fatal-error"].textContent = error.message; console.error(error); });
