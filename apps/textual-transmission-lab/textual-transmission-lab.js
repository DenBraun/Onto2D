import { createManuscriptTransmissionModel } from "./manuscript-transmission-model.js?v=20260818.1";

const ARTIFACT_URL = new URL("../../cases/manuscript-stemmatics/artifacts/manuscript-stemmatics.json", import.meta.url);
const ARTIFACT_SHA256 = "0f56ccfaf4f3e3bc6dc64fcdf1cbd1a460253b9a3836b755e6fb4b0dd293937d";
const MAX_ARTIFACT_BYTES = 96 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";
const ids = ["load-state", "retrieved-on", "case-identity", "source-identity", "fatal-error", "corpus-metrics", "transmission-graph", "reading-matrix", "profile-bars", "agreement-controls", "agreement-detail", "ablation-controls", "ablation-detail", "pair-controls", "comparison-result", "load-reason"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, value] of Object.entries(el)) if (!value) throw new Error(`Textual Transmission Lab markup is missing #${id}.`);
const state = { model: null, agreementId: "cx2-pn", ablationId: "full-evidence", comparisonId: "cx2-pn" };

function node(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
function svgNode(tag, attributes = {}, text) { const value = document.createElementNS(SVG_NS, tag); for (const [name, content] of Object.entries(attributes)) value.setAttribute(name, String(content)); if (text !== undefined) value.textContent = text; return value; }
function shortIdentity(value) { return `${value.slice(0, 18)}...${value.slice(-8)}`; }
async function digest(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Manuscript Stemmatics artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Manuscript Stemmatics artifact SHA-256 mismatch: ${actual}.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(text); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const items = [[state.model.corpus.witnessCount, "source witnesses"], [state.model.corpus.variantCharacterCount, "NEXUS characters"], [state.model.selection.witnessCount, "display witnesses"], [state.model.selection.readingSiteCount, "display sites"], [state.model.profiles.correctionProfile.count, "published correction profile"]];
  el["corpus-metrics"].replaceChildren(...items.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", String(value)), node("span", "", label)); return card; }));
}

function graphCard(svg, x, y, title, subtitle, kind = "witness") {
  const group = svgNode("g", { class: `graph-card ${kind}`, transform: `translate(${x} ${y})` });
  group.append(svgNode("rect", { x: -88, y: -35, width: 176, height: 70, rx: 13 }), svgNode("text", { x: 0, y: -5, "text-anchor": "middle", class: "graph-title" }, title), svgNode("text", { x: 0, y: 16, "text-anchor": "middle", class: "graph-subtitle" }, subtitle));
  svg.append(group);
}

function graphEdge(svg, d, label, x, y, contamination = false) {
  const group = svgNode("g", { class: contamination ? "transmission-edge contamination" : "transmission-edge" });
  group.append(svgNode("path", { d, "marker-end": contamination ? "url(#contamination-arrow)" : "url(#transmission-arrow)" }), svgNode("text", { x, y, "text-anchor": "middle" }, label));
  svg.append(group);
}

function renderGraph() {
  const scroll = node("div", "graph-scroll");
  const svg = svgNode("svg", { viewBox: "0 0 1040 440", role: "img", "aria-labelledby": "graph-title graph-description" });
  svg.append(svgNode("title", { id: "graph-title" }, "Attributed transmission around the Caxton second edition"), svgNode("desc", { id: "graph-description" }, "Solid arrows show attributed tree-compatible copying. A dashed orange arrow shows the non-tree-compatible correction source from an unresolved better copy into Cx2. Hg, Ch, and El are reading witnesses only in this bounded graph."));
  const defs = svgNode("defs");
  for (const [id, className] of [["transmission-arrow", "transmission-marker"], ["contamination-arrow", "contamination-marker"]]) { const marker = svgNode("marker", { id, markerWidth: 10, markerHeight: 10, refX: 8, refY: 3, orient: "auto", markerUnits: "strokeWidth", class: className }); marker.append(svgNode("path", { d: "M0,0 L0,6 L9,3 z" })); defs.append(marker); }
  svg.append(defs);
  graphEdge(svg, "M188 120 L392 120", "base text / attributed", 290, 105);
  graphEdge(svg, "M568 112 C650 88 718 72 780 67", "copied from / attributed", 681, 60);
  graphEdge(svg, "M568 130 C650 158 718 178 780 184", "copied from / attributed", 684, 176);
  graphEdge(svg, "M188 307 C292 307 322 218 403 155", "correction source / attributed", 309, 276, true);
  graphCard(svg, 100, 120, "Cx1", "Caxton first edition");
  graphCard(svg, 480, 120, "Cx2", "base + corrections", "focus");
  graphCard(svg, 870, 60, "Pn", "copy of Cx2");
  graphCard(svg, 870, 190, "Wy", "copy of Cx2");
  graphCard(svg, 100, 307, "Better copy", "exact identity unresolved", "unresolved");
  const support = svgNode("g", { class: "reading-only", transform: "translate(680 292)" });
  support.append(svgNode("rect", { x: -210, y: -44, width: 420, height: 104, rx: 13 }), svgNode("text", { x: 0, y: -14, "text-anchor": "middle", class: "graph-title" }, "Hg  /  Ch  /  El"), svgNode("text", { x: 0, y: 11, "text-anchor": "middle", class: "graph-subtitle" }, "selected readings + published profile counts"), svgNode("text", { x: 0, y: 34, "text-anchor": "middle", class: "reading-warning" }, "no bounded copying edge asserted"));
  svg.append(support);
  scroll.append(svg);
  el["transmission-graph"].replaceChildren(scroll);
}

function renderReadingMatrix() {
  const table = node("table", "reading-table");
  const head = node("thead");
  const headRow = node("tr");
  headRow.append(node("th", "", "Witness"), ...state.model.sites.map((site) => node("th", "", `${site.locator} / ${site.nexusLabel}`)), node("th", "", "Profile agreement"));
  head.append(headRow);
  const body = node("tbody");
  for (const witness of state.model.witnesses) {
    const row = node("tr");
    const label = node("th");
    label.scope = "row";
    label.append(node("strong", "", witness.id), node("span", "", witness.label));
    row.append(label, ...witness.readings.map((reading) => node("td", "reading-value", reading.value)), node("td", witness.cx2CorrectionProfileAgreementCount === null ? "not-supplied" : "profile-value", witness.cx2CorrectionProfileAgreementCount === null ? "not supplied" : String(witness.cx2CorrectionProfileAgreementCount)));
    body.append(row);
  }
  table.append(head, body);
  const wrapper = node("div", "table-scroll");
  wrapper.append(table);
  el["reading-matrix"].replaceChildren(wrapper);
}

function renderProfiles() {
  const values = state.model.profiles.witnessCounts.filter((entry) => entry.cx2CorrectionProfileAgreementCount !== null);
  const maximum = Math.max(...values.map((entry) => entry.cx2CorrectionProfileAgreementCount));
  el["profile-bars"].replaceChildren(...values.map((entry) => { const row = node("article", "profile-row"); const label = node("strong", "", entry.witnessId); const track = node("div", "profile-track"); const fill = node("i", "profile-fill"); fill.style.width = `${entry.cx2CorrectionProfileAgreementCount / maximum * 100}%`; track.append(fill); row.append(label, track, node("span", "", String(entry.cx2CorrectionProfileAgreementCount))); return row; }));
}

function choiceButtons(items, activeId, onSelect, value) {
  return items.map((item) => { const button = node("button", "choice-button"); button.type = "button"; button.dataset.active = String(item.id === activeId); button.setAttribute("aria-pressed", button.dataset.active); button.append(node("span", "", value(item)), node("strong", "", item.label)); button.addEventListener("click", () => onSelect(item.id)); return button; });
}

function renderAgreement() {
  el["agreement-controls"].replaceChildren(...choiceButtons(state.model.agreements.map((item) => ({ ...item, label: `${item.left} / ${item.right}` })), state.agreementId, (id) => { state.agreementId = id; renderAgreement(); }, (item) => `${item.agreementCount}/${item.comparedSiteCount}`));
  const comparison = state.model.agreement(state.agreementId);
  const card = node("article", "result-card");
  const head = node("header");
  head.append(node("span", "", "SELECTED-SITE AGREEMENT"), node("h3", "", `${comparison.left} / ${comparison.right}`), node("strong", comparison.agreementShare === 1 ? "equal-slice" : "different-slice", `${Math.round(comparison.agreementShare * 100)}%`));
  const text = node("p", "", comparison.agreementShare === 1 ? "The two witnesses agree at both displayed sites." : "The two witnesses differ at both displayed sites.");
  const warning = node("p", "scope-warning", "These examples were selected because the source discusses them. They are not representative of all 4032 characters and create neither ancestry nor copying.");
  card.append(head, text, warning);
  el["agreement-detail"].replaceChildren(card);
}

function relationPill(id, kind) { const value = node("li", kind, id.replaceAll(":", " / ")); return value; }
function renderAblation() {
  el["ablation-controls"].replaceChildren(...choiceButtons(state.model.ablations, state.ablationId, (id) => { state.ablationId = id; renderAblation(); }, (item) => String(item.removedEvidenceIds.length)));
  const result = state.model.ablation(state.ablationId);
  const card = node("article", "ablation-card");
  const header = node("header");
  header.append(node("span", "", result.resultState.toUpperCase()), node("h3", "", result.label), node("strong", result.localMultipleParentSupported ? "supported" : "unsupported", result.localMultipleParentSupported ? "MULTIPLE INPUT SUPPORTED" : "MULTIPLE INPUT NOT SUPPORTED"));
  const grids = node("div", "ablation-groups");
  for (const [title, values, kind] of [["Supported", result.supportedRelationIds, "supported"], ["Attributed only", result.attributedOnlyRelationIds, "attributed"], ["Withheld", result.withheldRelationIds, "withheld"]]) { const section = node("section"); section.append(node("h4", "", `${title} / ${values.length}`)); const list = node("ul"); list.append(...(values.length ? values.map((id) => relationPill(id, kind)) : [node("li", "empty", "none")])); section.append(list); grids.append(section); }
  const removed = node("p", "ablation-removed", result.removedEvidenceIds.length ? `Removed evidence: ${result.removedEvidenceIds.join(", ")}.` : "Removed evidence: none.");
  card.append(header, grids, removed);
  el["ablation-detail"].replaceChildren(card);
}

function renderComparison() {
  el["pair-controls"].replaceChildren(...choiceButtons(state.model.comparisons, state.comparisonId, (id) => { state.comparisonId = id; renderComparison(); }, (item) => String(item.results.filter((result) => result.equal).length)));
  const comparison = state.model.comparison(state.comparisonId);
  const card = node("article", "comparison-card");
  const header = node("header");
  header.append(node("span", "", "DISTINCT WITNESS RECORDS"), node("h3", "", comparison.label), node("p", "", "An equal row answers only that row's exact question; it never merges the witnesses."));
  const list = node("div", "verdict-list");
  for (const result of comparison.results) { const row = node("article", `verdict-row ${result.equal ? "equal" : "distinct"}`); row.append(node("b", "", result.equal ? "EQUAL" : "DISTINCT"), node("strong", "", result.label), node("p", "", result.equal ? result.question : `${result.question} Differing: ${result.differingFields.join(", ")}.`)); list.append(row); }
  card.append(header, list);
  el["comparison-result"].replaceChildren(card);
}

async function main() {
  state.model = createManuscriptTransmissionModel(await fetchArtifact());
  el["retrieved-on"].textContent = state.model.retrievedAt;
  el["case-identity"].textContent = shortIdentity(state.model.identity);
  el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity);
  el["load-reason"].textContent = `${state.model.historicalLoad.reason} The 207 value is evidence in a published correction profile, not a Historical Load score.`;
  renderMetrics(); renderGraph(); renderReadingMatrix(); renderProfiles(); renderAgreement(); renderAblation(); renderComparison();
  el["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

main().catch((error) => { document.body.dataset.state = "error"; el["load-state"].textContent = "Verification failed"; el["fatal-error"].hidden = false; el["fatal-error"].textContent = error.message; console.error(error); });
