import { createEvolutionaryContingencyModel } from "./evolutionary-contingency-model.js?v=20260819.2";

const ARTIFACT_URL = new URL("../../cases/ltee-evolutionary-contingency/artifacts/ltee-evolutionary-contingency.json", import.meta.url);
const ARTIFACT_SHA256 = "10b7eaa167f035bbe36b2a712d24176556c5c2107223b94d16d624756dddc92c";
const MAX_ARTIFACT_BYTES = 128 * 1024;
const state = { model: null, protocolId: "replay-3", generation: 20000 };
const ids = ["load-state", "fatal-error", "retrieved-on", "case-identity", "source-identity", "metric-grid", "protocol-controls", "replay-body", "observation-inspector", "protocol-grid", "statistics-grid", "discrepancy-copy", "published-expected", "table-one-expected", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Evolutionary Contingency Lab markup is missing #${id}.`);

function node(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") element.textContent = text; return element; }
function shortIdentity(value) { return `${value.slice(0, 15)}...${value.slice(-8)}`; }
function generationLabel(value) { return value === 0 ? "Ancestor" : value.toLocaleString("en-US"); }
function protocolNumber(id) { return id.slice(-1); }
function fact(term, value) { const wrapper = node("div"); wrapper.append(node("dt", "", term), node("dd", "", value)); return wrapper; }

async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact LTEE Evolutionary Contingency artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`LTEE artifact SHA-256 mismatch: ${actual}.`);
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(source); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const model = state.model;
  const values = [
    [String(model.cohort.sourceGenerationCount), "source-generation labels"],
    [String(model.cohort.protocolCount), "separate replay protocols"],
    [String(model.cohort.observationCount), "retained table observations"],
    [String(model.cohort.independentCitPlusMutantCount), "independent Cit+ mutants"],
    [String(model.audit.impossibilityClaims), "impossibility claims"]
  ];
  el["metric-grid"].replaceChildren(...values.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", value), node("span", "", label)); return card; }));
}

function choice(protocol) {
  const active = protocol.id === state.protocolId;
  const button = node("button", "choice-button", `REPLAY ${protocolNumber(protocol.id)} / ${protocol.replicates.toLocaleString("en-US")} UNITS`);
  button.type = "button";
  button.dataset.active = String(active);
  button.setAttribute("aria-pressed", String(active));
  button.addEventListener("click", () => { state.protocolId = protocol.id; const first = state.model.observations.find((item) => item.experimentId === protocol.id && item.independentCitPlusMutants > 0) ?? state.model.observations.find((item) => item.experimentId === protocol.id); state.generation = first.sourceGeneration; renderReplay(); renderProtocols(); });
  return button;
}

function observationButton(protocolId, generation) {
  const observation = state.model.observation(protocolId, generation);
  const status = observation?.outcomeStatus ?? "not-run";
  const button = node("button", "observation-cell");
  button.type = "button";
  button.dataset.status = status;
  button.dataset.active = String(protocolId === state.protocolId && generation === state.generation);
  button.setAttribute("aria-pressed", button.dataset.active);
  button.setAttribute("aria-label", `Generation ${generationLabel(generation)}, replay ${protocolNumber(protocolId)}: ${observation ? `${observation.independentCitPlusMutants} independent Cit+ mutants in ${observation.replicates} replicates` : "not run"}`);
  if (observation) button.append(node("strong", "", `${observation.independentCitPlusMutants}/${observation.replicates.toLocaleString("en-US")}`), node("small", "", observation.outcomeStatus === "observed" ? "Cit+ observed" : "not observed"));
  else button.append(node("strong", "", "\u2014"), node("small", "", "not run"));
  button.addEventListener("click", () => { state.protocolId = protocolId; state.generation = generation; renderReplay(); renderProtocols(); });
  return button;
}

function renderInspector() {
  const observation = state.model.observation(state.protocolId, state.generation);
  const assessment = state.model.assessment(state.generation);
  const wrapper = node("article");
  wrapper.append(node("span", "inspector-kicker", `GENERATION ${generationLabel(state.generation)} / REPLAY ${protocolNumber(state.protocolId)}`), node("h3", "", observation ? (observation.outcomeStatus === "observed" ? "Cit+ observed" : "Not observed") : "Not run"));
  const copy = observation ? `${observation.independentCitPlusMutants} independent Cit+ mutant${observation.independentCitPlusMutants === 1 ? "" : "s"} across ${observation.replicates.toLocaleString("en-US")} ${state.model.protocol(state.protocolId).replicateUnit} records.` : "This generation/protocol pair has no Table 1 observation. Missing evidence is not a zero count.";
  wrapper.append(node("p", "", copy));
  const facts = node("dl", "inspector-facts");
  facts.append(
    fact("Source background", state.model.background(state.generation).nativeGenerationLabel),
    fact("Exact protocol", state.model.protocol(state.protocolId).nativeLabel),
    fact("Cell status", observation?.outcomeStatus ?? "not-run"),
    fact("Across all replays", assessment.accessibilityStatus.replaceAll("-", " "))
  );
  wrapper.append(facts);
  const note = node("div", "inspector-note", observation?.outcomeStatus === "not-observed" ? "This is bounded non-observation. It is not an impossibility claim." : observation ? "This supports observed accessibility under this exact protocol. It does not make Cit+ inevitable." : "No experimental result is invented for this missing cell.");
  wrapper.append(note);
  el["observation-inspector"].replaceChildren(wrapper);
}

function renderReplay() {
  el["protocol-controls"].replaceChildren(...state.model.protocols.map(choice));
  el["replay-body"].replaceChildren(...state.model.generations.map((generation) => {
    const assessment = state.model.assessment(generation);
    const row = node("tr");
    if (generation === state.generation) row.dataset.active = "true";
    const heading = node("th", "generation-cell", generationLabel(generation));
    heading.scope = "row";
    row.append(heading);
    for (const protocolId of state.model.protocolIds) { const cell = node("td"); cell.dataset.highlighted = String(protocolId === state.protocolId); cell.append(observationButton(protocolId, generation)); row.append(cell); }
    const reading = node("td", "reading-cell");
    reading.append(node("strong", "", assessment.boundedOutcomeStatus === "observed" ? "OBSERVED" : "UNRESOLVED"), node("small", "", assessment.boundedOutcomeStatus === "observed" ? `Cit+ in ${assessment.citPlusObservedExperimentIds.map((id) => `R${protocolNumber(id)}`).join(" + ")}` : "no impossibility claim"));
    row.append(reading);
    return row;
  }));
  renderInspector();
}

function renderProtocols() {
  el["protocol-grid"].replaceChildren(...state.model.protocols.map((protocol) => {
    const card = node("article", "protocol-card");
    card.dataset.active = String(protocol.id === state.protocolId);
    card.append(node("span", "", `REPLAY ${protocolNumber(protocol.id)}`), node("h3", "", protocol.mode), node("strong", "", `${protocol.replicates.toLocaleString("en-US")} units`), node("p", "", `${protocol.independentCitPlusMutants} independent Cit+ mutants / ${protocol.replicateUnit}.`));
    const details = node("dl");
    details.append(fact("Duration", protocol.incubationDays ? `${protocol.incubationDays} days` : `~${protocol.maximumReplayGenerationsApproximate.toLocaleString("en-US")} generations`), fact("Protocol identity", shortIdentity(protocol.identity)));
    card.append(details);
    return card;
  }));
}

function renderStatistics() {
  el["statistics-grid"].replaceChildren(...state.model.publishedStatistics.map((statistic) => {
    const card = node("article", "statistic-card");
    const scale = node("div", "mean-scale");
    const lower = 20000;
    const upper = 33000;
    for (const [kind, value] of [["expected", statistic.expectedMeanGeneration], ["observed", statistic.observedMeanGeneration]]) { const marker = node("i"); marker.dataset.kind = kind; marker.style.left = `${(value - lower) / (upper - lower) * 100}%`; marker.title = `${kind}: ${value.toLocaleString("en-US")}`; scale.append(marker); }
    card.append(node("span", "", `REPLAY ${protocolNumber(statistic.experimentId)} / PUBLISHED`), node("h3", "", `+${statistic.meanShiftGenerations.toLocaleString("en-US")}`), node("p", "", "generation shift in the reported mean"), scale);
    const facts = node("dl");
    facts.append(fact("Expected mean", statistic.expectedMeanGeneration.toLocaleString("en-US")), fact("Observed mean", statistic.observedMeanGeneration.toLocaleString("en-US")), fact("Monte Carlo P", String(statistic.publishedMonteCarloPValue)), fact("P recomputed", "No"));
    card.append(facts);
    if (!statistic.tableOneMeanMatchesPublishedExpected) card.append(node("div", "statistic-warning", "TABLE 1 CHECK DIFFERS / SEE SOURCE AUDIT"));
    return card;
  }));
}

function renderDiscrepancy() {
  const discrepancy = state.model.sourceDiscrepancies[0];
  el["discrepancy-copy"].textContent = discrepancy.interpretation;
  el["published-expected"].textContent = discrepancy.publishedExpectedMeanGeneration.toLocaleString("en-US");
  el["table-one-expected"].textContent = discrepancy.tableOneReplicateWeightedMeanGeneration.toLocaleString("en-US");
}

function initialize(model) {
  state.model = model;
  el["retrieved-on"].textContent = model.source.retrievedAt.replace("T", " ").replace("Z", " UTC");
  el["case-identity"].textContent = shortIdentity(model.identity);
  el["source-identity"].textContent = shortIdentity(model.sourceIdentity);
  renderMetrics(); renderReplay(); renderProtocols(); renderStatistics(); renderDiscrepancy();
  el["load-reason"].textContent = model.historicalLoad.reason;
  el["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

function renderFailure(error) {
  el["fatal-error"].hidden = false;
  el["fatal-error"].textContent = error.message;
  el["load-state"].textContent = "Verification failed";
  document.body.dataset.state = "error";
}

fetchArtifact().then(createEvolutionaryContingencyModel).then(initialize).catch(renderFailure);
