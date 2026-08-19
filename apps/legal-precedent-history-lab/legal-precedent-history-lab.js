import { createLegalPrecedentModel } from "./legal-precedent-model.js?v=20260819.2";

const ARTIFACT_URL = new URL("../../cases/legal-precedent-history/artifacts/legal-precedent-history.json", import.meta.url);
const ARTIFACT_SHA256 = "1c5eb958a2cb79cc955dcb0372ed04ed4f591a06c7e20645824e06d751e93646";
const MAX_BYTES = 48 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";
const ids = ["load-state", "case-identity", "source-identity", "retrieved-at", "fatal-error", "cohort-metrics", "opinion-timeline", "scope-controls", "treatment-toggle", "citation-graph", "graph-readout", "opinion-inspector", "status-matrix", "counterfactual-toggle", "derived-node-count", "derived-edge-count", "date-disagreements", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, value] of Object.entries(el)) if (!value) throw new Error(`Legal Precedent History Lab markup is missing #${id}.`);
const state = { model: null, fullRecord: false, treatmentVisible: true, withholdBrownII: false, selectedOpinionId: "green" };
const positions = Object.freeze({ "brown-i": [105, 178], "brown-ii": [278, 346], cooper: [451, 178], griffin: [624, 346], green: [797, 178], alexander: [970, 346], swann: [1143, 178] });

function node(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
function svgNode(tag, attributes = {}, text) { const value = document.createElementNS(SVG_NS, tag); for (const [name, content] of Object.entries(attributes)) value.setAttribute(name, String(content)); if (text !== undefined) value.textContent = text; return value; }
function shortIdentity(value) { return `${value.slice(0, 18)}...${value.slice(-8)}`; }
function externalLinkIcon() { const icon = svgNode("svg", { class: "ui-icon", "aria-hidden": "true" }); icon.append(svgNode("use", { href: "../../assets/icons/ui-symbols.svg#external-link" })); return icon; }
async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Legal Precedent artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Legal Precedent artifact SHA-256 mismatch: ${actual}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The artifact is not valid JSON."); }
}

function opinionRole(id) { if (id === "green") return "target"; if (state.model.availability.priorOpinionIds.includes(id)) return "prior"; return "future"; }
function renderMetrics() {
  const metrics = [[7, "selected opinions"], [16, "native citation edges"], [4, "prior at Green date"], [2, "later / excluded"], [0, "binding claims"]];
  el["cohort-metrics"].replaceChildren(...metrics.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", String(value).padStart(2, "0")), node("span", "", label)); return card; }));
}

function selectOpinion(id) { state.selectedOpinionId = id; renderTimeline(); renderGraph(); renderInspector(); }
function renderTimeline() {
  el["opinion-timeline"].replaceChildren(...state.model.opinions.map((opinion) => {
    const role = opinionRole(opinion.id);
    const button = node("button", "timeline-card"); button.type = "button"; button.dataset.role = role; button.dataset.active = String(opinion.id === state.selectedOpinionId); button.setAttribute("aria-pressed", button.dataset.active);
    button.append(node("span", "", role === "target" ? "TARGET DECISION" : role === "prior" ? "AVAILABLE BEFORE" : "LATER / EXCLUDED"), node("strong", "", opinion.shortName), node("code", "", opinion.reporterCitation), node("time", "", opinion.officialDecisionDate), node("small", "", "GovInfo decision date"));
    if (!opinion.dateAgreement) { const dot = node("b"); dot.title = "Provider dates disagree"; button.append(dot); }
    button.addEventListener("click", () => selectOpinion(opinion.id));
    return button;
  }));
}

function edgePath(edge, index, offset = 0) {
  const [targetX, targetY] = positions[edge.citedOpinionId]; const [sourceX, sourceY] = positions[edge.citingOpinionId];
  const startX = sourceX - 76; const endX = targetX + 77; const span = Math.max(1, startX - endX); const bend = ((index % 5) - 2) * 22 + offset;
  const controlX1 = startX - span * .37; const controlX2 = endX + span * .37;
  return `M${startX} ${sourceY + offset} C${controlX1} ${sourceY + bend} ${controlX2} ${targetY + bend} ${endX} ${targetY + offset}`;
}

function renderScopeControls() {
  const choices = [[false, "Green date"], [true, "Full bounded record"]];
  el["scope-controls"].replaceChildren(...choices.map(([fullRecord, label]) => {
    const button = node("button", "choice-button", label); button.type = "button"; button.setAttribute("aria-pressed", String(state.fullRecord === fullRecord));
    button.addEventListener("click", () => { state.fullRecord = fullRecord; if (fullRecord && state.withholdBrownII) state.withholdBrownII = false; renderAllGraphState(); });
    return button;
  }));
}

function renderGraph() {
  const graph = state.model.graph({ fullRecord: state.fullRecord, withholdBrownII: state.withholdBrownII });
  const activeIds = new Set(graph.opinions.map((opinion) => opinion.id));
  const svg = el["citation-graph"];
  const title = svg.querySelector("title")?.cloneNode(true); const description = svg.querySelector("desc")?.cloneNode(true);
  svg.replaceChildren(); if (title) svg.append(title); if (description) svg.append(description);
  const defs = svgNode("defs");
  const citationMarker = svgNode("marker", { id: "citation-arrow", markerWidth: 9, markerHeight: 9, refX: 8, refY: 3, orient: "auto", markerUnits: "strokeWidth" }); citationMarker.append(svgNode("path", { d: "M0,0 L0,6 L9,3 z", fill: "#61736f" }));
  const treatmentMarker = svgNode("marker", { id: "treatment-arrow", markerWidth: 9, markerHeight: 9, refX: 8, refY: 3, orient: "auto", markerUnits: "strokeWidth" }); treatmentMarker.append(svgNode("path", { d: "M0,0 L0,6 L9,3 z", fill: "#bd4b2e" }));
  defs.append(citationMarker, treatmentMarker); svg.append(defs);
  graph.citations.forEach((edge, index) => { const className = `citation-edge${edge.citingOpinionId === state.selectedOpinionId || edge.citedOpinionId === state.selectedOpinionId ? " highlighted" : ""}`; svg.append(svgNode("path", { d: edgePath(edge, index), class: className })); });
  if (state.treatmentVisible) graph.citations.forEach((edge, index) => { if (state.model.claimForCitation(edge.id)) svg.append(svgNode("path", { d: edgePath(edge, index, -8), class: "treatment-edge" })); });
  for (const opinion of state.model.opinions) {
    const [x, y] = positions[opinion.id]; const role = opinionRole(opinion.id); const withheld = state.withholdBrownII && opinion.id === "brown-ii"; const excluded = !state.fullRecord && role === "future";
    const group = svgNode("g", { class: `graph-node${opinion.id === state.selectedOpinionId ? " active" : ""}`, transform: `translate(${x} ${y})`, "data-role": role, "data-withheld": withheld, tabindex: 0, role: "button", "aria-label": `${opinion.shortName}, ${opinion.reporterCitation}${excluded ? ", later than Green and excluded from this time slice" : ""}${withheld ? ", withheld from the derived view" : ""}` });
    group.append(svgNode("rect", { x: -76, y: -34, width: 152, height: 68, rx: 13 }), svgNode("text", { x: 0, y: -5, class: "node-name" }, opinion.shortName), svgNode("text", { x: 0, y: 16, class: "node-cite" }, opinion.reporterCitation));
    const activate = () => selectOpinion(opinion.id); group.addEventListener("click", activate); group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
    if (!activeIds.has(opinion.id) && !excluded && !withheld) group.dataset.withheld = "true";
    svg.append(group);
  }
  const scope = state.fullRecord ? "full seven-opinion record" : "Green decision-date context";
  const ablation = state.withholdBrownII ? "; Brown II withheld from the derived view" : "";
  el["graph-readout"].textContent = `${scope}: ${graph.opinions.length} active nodes / ${graph.citations.length} active citation edges${ablation}. Source record remains 7 opinions / 16 citation edges.`;
}

function fact(label, value) { const row = node("div"); row.append(node("dt", "", label), node("dd", "", value)); return row; }
function sourceLink(href, label) { const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.append(label, externalLinkIcon()); return link; }
function renderInspector() {
  const opinion = state.model.opinion(state.selectedOpinionId); const role = opinionRole(opinion.id); const cited = state.model.citations.filter((edge) => edge.citingOpinionId === opinion.id).length; const citedBy = state.model.citations.filter((edge) => edge.citedOpinionId === opinion.id).length;
  const heading = node("header", "inspector-head"); const title = node("div"); title.append(node("span", "", role === "target" ? "TARGET DECISION" : role === "prior" ? "PRIOR IN GREEN CONTEXT" : "LATER THAN GREEN"), node("h3", "", opinion.shortName)); heading.append(title, node("code", "", opinion.reporterCitation));
  const facts = node("dl", "inspector-facts"); facts.append(fact("Official decision date", opinion.officialDecisionDate), fact("CourtListener dateFiled", opinion.courtListenerDateFiled), fact("Cites inside cohort", String(cited)), fact("Cited by inside cohort", String(citedBy)), fact("CourtListener opinion ID", String(opinion.courtListener.opinionId)), fact("Provider cite count", `${opinion.courtListener.citeCountAtRetrieval.toLocaleString("en-US")} / display-only`), fact("CourtListener opinion SHA-1", opinion.courtListener.opinionSha1), fact("GovInfo PDF SHA-256", opinion.officialDocument.sha256));
  const links = node("div", "inspector-links"); links.append(sourceLink(opinion.courtListener.publicUrl, "CourtListener opinion"), sourceLink(opinion.officialDocument.detailUrl, "GovInfo details"), sourceLink(opinion.officialDocument.pdfUrl, "Official PDF"));
  const children = [heading, facts, links]; if (!opinion.dateAgreement) children.push(node("p", "date-warning", "Provider dates disagree. Both values are retained; GovInfo drives this declared time slice."));
  el["opinion-inspector"].replaceChildren(...children);
}

function renderMatrix() {
  el["status-matrix"].replaceChildren(...state.model.greenMatrix().map((row) => {
    const tr = document.createElement("tr"); const opinionCell = document.createElement("td"); opinionCell.append(node("strong", "", row.opinion.shortName), node("code", "", row.opinion.reporterCitation));
    const citationCell = document.createElement("td"); citationCell.append(node("span", "status-token", "RECORDED"));
    const treatmentCell = document.createElement("td"); treatmentCell.append(node("span", "status-token attributed", row.claim.treatment.replaceAll("-", " "))); const inspect = node("button", "matrix-button", row.claim.locator); inspect.type = "button"; inspect.addEventListener("click", () => selectOpinion(row.citedOpinionId)); treatmentCell.append(document.createElement("br"), inspect);
    const bindingCell = document.createElement("td"); bindingCell.append(node("span", "status-token unknown", "UNKNOWN"));
    const countCell = document.createElement("td"); countCell.append(node("strong", "", row.opinion.courtListener.citeCountAtRetrieval.toLocaleString("en-US")), node("code", "", "display-only"));
    tr.append(opinionCell, citationCell, treatmentCell, bindingCell, countCell); return tr;
  }));
}

function renderCounterfactual() {
  const graph = state.model.graph({ fullRecord: false, withholdBrownII: state.withholdBrownII });
  el["counterfactual-toggle"].setAttribute("aria-pressed", String(state.withholdBrownII));
  el["counterfactual-toggle"].textContent = state.withholdBrownII ? "Restore Brown II to derived view" : "Withhold Brown II in derived view";
  el["derived-node-count"].textContent = String(graph.opinions.length);
  el["derived-edge-count"].textContent = String(graph.citations.length);
}

function renderDisagreements() {
  el["date-disagreements"].replaceChildren(...state.model.dateDisagreements.map((item) => {
    const opinion = state.model.opinion(item.opinionId); const card = node("article", "disagreement-card"); card.append(node("span", "", "PRESERVED SOURCE CONFLICT"), node("h3", "", opinion.shortName)); const dates = node("div", "date-pair"); const official = node("div"); official.append(node("small", "", "GovInfo decision"), node("strong", "", item.officialDecisionDate)); const provider = node("div"); provider.append(node("small", "", "CourtListener dateFiled"), node("strong", "", item.courtListenerDateFiled)); dates.append(official, provider); card.append(dates, node("p", "", "Resolution: preserve both; use the official GovInfo field only for this declared temporal projection.")); return card;
  }));
}

function renderAllGraphState() { renderScopeControls(); renderGraph(); renderCounterfactual(); }
async function main() {
  state.model = createLegalPrecedentModel(await fetchArtifact());
  el["retrieved-at"].textContent = state.model.retrievedAt; el["case-identity"].textContent = shortIdentity(state.model.identity); el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity); el["load-reason"].textContent = `${state.model.historicalLoad.reason} The useful result here is the explicit time boundary and evidence typing, not a scalar.`;
  renderMetrics(); renderTimeline(); renderAllGraphState(); renderInspector(); renderMatrix(); renderDisagreements();
  el["treatment-toggle"].addEventListener("click", () => { state.treatmentVisible = !state.treatmentVisible; el["treatment-toggle"].setAttribute("aria-pressed", String(state.treatmentVisible)); el["treatment-toggle"].textContent = `Treatment overlay ${state.treatmentVisible ? "on" : "off"}`; renderGraph(); });
  el["counterfactual-toggle"].addEventListener("click", () => { state.withholdBrownII = !state.withholdBrownII; state.fullRecord = false; renderAllGraphState(); });
  el["load-state"].textContent = "Artifact verified"; document.body.dataset.state = "ready";
}

main().catch((error) => { document.body.dataset.state = "error"; el["load-state"].textContent = "Verification failed"; el["fatal-error"].hidden = false; el["fatal-error"].textContent = error.message; console.error(error); });
