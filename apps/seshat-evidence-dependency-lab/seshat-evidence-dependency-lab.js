import { createSeshatEvidenceModel } from "./seshat-evidence-model.js?v=20260823.2";

const ARTIFACT_URL = new URL("../../cases/seshat-epistemic-provenance/artifacts/seshat-epistemic-provenance.json", import.meta.url);
const ARTIFACT_SHA256 = "5a6f6dc090cfe0d9282b2af2e25856467f4ca3f9c0584840bc29b3d523536f90";
const MAX_ARTIFACT_BYTES = 128 * 1024;
const state = { model: null, polityId: "eg_old_k_1", groupId: null };
const ids = ["load-state", "fatal-error", "case-identity", "source-identity", "snapshot-release", "metric-grid", "claim-controls", "claim-native", "claim-mapped", "claim-polity", "claim-period", "claim-support-root", "claim-narrative", "support-graph", "graph-readout", "shared-dependencies", "cut-grid", "ablation-controls", "ablation-result", "identity-grid", "availability-body", "load-reason", "limitations"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(el)) if (!element) throw new Error(`Historical Evidence Dependency Lab markup is missing #${id}.`);

function node(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text !== "") element.textContent = text; return element; }
function shortIdentity(value) { return `${value.slice(0, 15)}...${value.slice(-8)}`; }
function titleCase(value) { return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatYear(value) { return value < 0 ? `${Math.abs(value)} BCE` : `${value} CE`; }
function fact(label, value) { const wrapper = node("div"); wrapper.append(node("dt", "", label), node("dd", "", String(value))); return wrapper; }
function svg(tag, attributes = {}) { const element = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value)); return element; }

async function digest(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchArtifact() {
  const response = await fetch(ARTIFACT_URL, { cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok || response.url !== ARTIFACT_URL.href) throw new Error("The exact Seshat epistemic provenance artifact could not be loaded.");
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("The artifact has an unexpected media type.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("The artifact exceeds its byte limit.");
  const actual = await digest(bytes);
  if (actual !== ARTIFACT_SHA256) throw new Error(`Seshat artifact SHA-256 mismatch: ${actual}.`);
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The artifact is not valid UTF-8."); }
  try { return JSON.parse(source); } catch { throw new Error("The artifact is not valid JSON."); }
}

function renderMetrics() {
  const values = [
    ["3", "frozen claims"],
    ["P", "exact native code"],
    ["3", "support identities"],
    ["22", "DAG nodes"],
    ["4", "raw ablations"],
    ["0", "invented actors"]
  ];
  el["metric-grid"].replaceChildren(...values.map(([value, label]) => { const card = node("article", "metric-card"); card.append(node("strong", "", value), node("span", "", label)); return card; }));
}

function renderControls() {
  el["claim-controls"].replaceChildren(...state.model.claims.map((claim) => {
    const button = node("button", "choice-button", claim.polityName.replace("Empire - ", ""));
    button.type = "button";
    button.dataset.active = String(claim.polityId === state.polityId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.polityId = claim.polityId; state.groupId = null; renderClaim(); });
    return button;
  }));
}

function renderNativeClaim(claim) {
  const claimNode = state.model.node(claim.rootNodeId);
  el["claim-native"].textContent = claim.exactNativeCode;
  el["claim-mapped"].textContent = claim.mappedApiValue;
  el["claim-polity"].textContent = claim.polityName;
  el["claim-period"].textContent = `${formatYear(claimNode.labels.period.startYear)} - ${formatYear(claimNode.labels.period.endYear)}`;
  el["claim-support-root"].textContent = shortIdentity(claim.support.supportRootHash);
  el["claim-narrative"].textContent = claim.narrative;
}

function graphLayer(graphNode) {
  if (graphNode.artifactSubtype === "LocallyMappedSourceWork") return 0;
  if (["InlineReferenceRecord", "PolarisWorkbookRow", "SeshatPublicApiRecord"].includes(graphNode.artifactSubtype)) return 1;
  if (graphNode.artifactSubtype === "PublicCodingNarrative") return 2;
  return 3;
}

function graphLabel(graphNode) {
  if (graphNode.artifactSubtype === "LocallyMappedSourceWork") return graphNode.labels.label;
  if (graphNode.artifactSubtype === "InlineReferenceRecord") return graphNode.labels.rawReference;
  if (graphNode.artifactSubtype === "PolarisWorkbookRow") return `Polaris row ${graphNode.labels.sheetRow} / ${graphNode.labels.exactNativeCode}`;
  if (graphNode.artifactSubtype === "SeshatPublicApiRecord") return `API record ${graphNode.labels.apiRecordId} / ${graphNode.labels.apiValue}`;
  if (graphNode.artifactSubtype === "PublicCodingNarrative") return "Public coding narrative";
  return `Road = ${graphNode.labels.exactNativeCode}`;
}

function graphKind(graphNode) {
  if (graphNode.artifactSubtype === "LocallyMappedSourceWork") return "work";
  if (graphNode.artifactSubtype === "PublicCodingNarrative") return "narrative";
  if (graphNode.artifactKind === "CodingClaim") return "claim";
  return "record";
}

function wrapLabel(label, length = 30) {
  if (label.length <= length) return [label];
  const words = label.split(" ");
  const lines = [""];
  for (const word of words) {
    const candidate = `${lines.at(-1)} ${word}`.trim();
    if (candidate.length > length && lines.at(-1)) lines.push(word); else lines[lines.length - 1] = candidate;
  }
  return lines.slice(0, 2);
}

function renderGraph(claim) {
  const support = state.model.support(claim.polityId);
  const layerNodes = [0, 1, 2, 3].map((layer) => support.nodes.filter((graphNode) => graphLayer(graphNode) === layer).sort((left, right) => left.id.localeCompare(right.id)));
  const positions = new Map();
  const xs = [40, 355, 710, 1040];
  for (let layer = 0; layer < layerNodes.length; layer += 1) {
    const items = layerNodes[layer];
    const gap = 500 / Math.max(items.length, 1);
    items.forEach((graphNode, index) => positions.set(graphNode.id, { x: xs[layer], y: 50 + gap * index + Math.max(0, (gap - 62) / 2) }));
  }
  const defs = el["support-graph"].querySelector("defs");
  el["support-graph"].replaceChildren(defs);
  const edgeLayer = svg("g", { class: "graph-edges" });
  for (const graphEdge of support.edges) {
    const from = positions.get(graphEdge.from);
    const to = positions.get(graphEdge.to);
    const startX = from.x + 240;
    const startY = from.y + 31;
    const endX = to.x;
    const endY = to.y + 31;
    const bend = Math.max(35, (endX - startX) / 2);
    const path = svg("path", { d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`, "marker-end": "url(#support-arrow)" });
    path.append(svg("title"));
    path.firstChild.textContent = `${graphEdge.semanticType} / required`;
    edgeLayer.append(path);
  }
  const nodeLayer = svg("g", { class: "graph-nodes" });
  for (const graphNode of support.nodes) {
    const position = positions.get(graphNode.id);
    const group = svg("g", { class: `graph-node graph-node-${graphKind(graphNode)}`, transform: `translate(${position.x} ${position.y})` });
    group.append(svg("rect", { width: 240, height: 62, rx: 3 }));
    const type = svg("text", { x: 13, y: 19, class: "graph-node-type" }); type.textContent = graphNode.artifactSubtype.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase(); group.append(type);
    wrapLabel(graphLabel(graphNode)).forEach((line, index) => { const label = svg("text", { x: 13, y: 40 + index * 14, class: "graph-node-label" }); label.textContent = line; group.append(label); });
    const title = svg("title"); title.textContent = graphNode.id; group.append(title);
    nodeLayer.append(group);
  }
  el["support-graph"].append(edgeLayer, nodeLayer);
  el["graph-readout"].textContent = `${claim.polityName}: ${support.nodes.length} nodes / ${support.edges.length} required edges / ${support.groups.length} groups / dependency depth ${claim.support.metrics.dependencyDepth}. Hover an edge or node for its exact identifier.`;
}

function renderDependencies(claim) {
  const support = state.model.support(claim.polityId);
  const workGroups = state.model.sourceWorkGroups(claim.polityId);
  if (workGroups.length === 0) {
    const empty = node("article", "empty-dependency"); empty.append(node("strong", "", "NO PUBLIC SOURCE-WORK GROUP"), node("p", "", "The Roman Principate narrative exports no inline source marker. The cut is unavailable, not zero."));
    el["shared-dependencies"].replaceChildren(empty);
  } else {
    el["shared-dependencies"].replaceChildren(...workGroups.map((group) => {
      const workNodeId = group.memberNodeIds[0];
      const references = support.edges.filter(({ from, semanticType }) => from === workNodeId && semanticType === "identifies-source-work-for-reference").length;
      const card = node("article", references > 1 ? "shared-card shared" : "shared-card");
      card.append(node("span", "", references > 1 ? "SHARED FAN-OUT" : "SOURCE WORK"), node("h3", "", group.label), node("strong", "", `${references} inline reference record${references === 1 ? "" : "s"}`), node("p", "", references > 1 ? "One mapped work supports multiple reference branches; it remains one ablation group." : "One mapped work and one inline reference branch."));
      return card;
    }));
  }
  const cuts = [["Source work", claim.support.minimumGroupCuts.sourceWork, claim.support.firstCategoricalFlips.sourceWork], ["Research assistant", claim.support.minimumGroupCuts.researchAssistant, claim.support.firstCategoricalFlips.researchAssistant], ["Expert", claim.support.minimumGroupCuts.expert, claim.support.firstCategoricalFlips.expert], ["Review episode", claim.support.minimumGroupCuts.reviewEpisode, claim.support.firstCategoricalFlips.reviewEpisode]];
  el["cut-grid"].replaceChildren(...cuts.map(([label, cut, flip]) => { const card = node("article", cut.value === null ? "cut-card unavailable" : "cut-card"); const detail = cut.value === null ? cut.reason : `${flip.baselineValue} -> ${flip.response} / ${cut.witnessGroupIds[0]}`; card.append(node("span", "", label), node("strong", "", cut.value === null ? "unavailable" : String(cut.value)), node("small", "", detail)); return card; }));
}

function renderAblation(claim) {
  const groups = state.model.sourceWorkGroups(claim.polityId);
  if (!groups.some(({ id }) => id === state.groupId)) state.groupId = groups[0]?.id ?? null;
  el["ablation-controls"].replaceChildren(...groups.map((group) => {
    const button = node("button", "ablation-button", group.label);
    button.type = "button";
    button.dataset.active = String(group.id === state.groupId);
    button.setAttribute("aria-pressed", button.dataset.active);
    button.addEventListener("click", () => { state.groupId = group.id; renderAblation(claim); });
    return button;
  }));
  if (!state.groupId) {
    const empty = node("div", "ablation-empty"); empty.append(node("span", "", "RAW RESPONSE"), node("h3", "", "No public source-work perturbation"), node("p", "", "No SourceWork group occurs in this claim's public support closure. No synthetic ablation is shown."), node("code", "", "sourceWorkCut = null"));
    el["ablation-result"].replaceChildren(empty);
    return;
  }
  const result = state.model.ablation(claim.polityId, state.groupId);
  const wrapper = node("div");
  wrapper.append(node("span", "", "RAW CATEGORICAL RESPONSE"), node("h3", "", `${result.rawResponse.baseline} -> ${result.rawResponse.perturbed}`));
  const response = node("div", "response-pair");
  const baseline = node("article"); baseline.append(node("small", "", "BASELINE"), node("strong", "", "P / present"), node("code", "", "resolutionState = Resolved"));
  const perturbed = node("article"); perturbed.append(node("small", "", "PERTURBED"), node("strong", "", "null / null"), node("code", "", "resolutionState = Unknown"));
  response.append(baseline, perturbed);
  const facts = node("dl", "ablation-facts");
  facts.append(fact("Removed nodes", result.perturbation.removedNodeIds.length), fact("Removed edges", result.perturbation.removedEdgeIds.length), fact("First flip", "1 group"), fact("Root retained", "NO"), fact("Source mutated", "NO"), fact("Threshold / label", "null / null"));
  wrapper.append(response, facts);
  el["ablation-result"].replaceChildren(wrapper);
}

function renderClaim() {
  const claim = state.model.claim(state.polityId);
  renderControls();
  renderNativeClaim(claim);
  renderGraph(claim);
  renderDependencies(claim);
  renderAblation(claim);
}

function renderIdentity() {
  el["identity-grid"].replaceChildren(...state.model.comparison.pairs.map((pair) => {
    const left = state.model.claim(pair.leftPolityId);
    const right = state.model.claim(pair.rightPolityId);
    const card = node("article", "identity-card");
    const header = node("header"); header.append(node("span", "", left.polityName), node("i", "", "vs"), node("span", "", right.polityName));
    const rows = node("dl");
    rows.append(fact("Native code", "same / P"), fact("Mapped value", "same / present"), fact("Composition", pair.sameSupportComposition ? "same" : "different"), fact("Exact support identity", pair.sameExactSupportIdentity ? "same" : "different"));
    card.append(header, rows, node("footer", "", "SAME VALUE / DIFFERENT SUPPORT IDENTITY"));
    return card;
  }));
}

function renderAvailability() {
  el["availability-body"].replaceChildren(...state.model.availability.results.map((result) => {
    const row = node("tr");
    const capability = node("th", "", titleCase(result.capability)); capability.scope = "row";
    row.append(capability, node("td", `status-${result.status}`, result.status), node("td", "", result.scope));
    return row;
  }));
}

function renderLimitations() {
  el.limitations.replaceChildren(...state.model.limitations.map((limitation, index) => { const card = node("article"); card.append(node("span", "", `BOUNDARY ${String(index + 1).padStart(2, "0")}`), node("p", "", limitation)); return card; }));
}

async function main() {
  const artifact = await fetchArtifact();
  state.model = createSeshatEvidenceModel(artifact);
  el["case-identity"].textContent = shortIdentity(state.model.identity);
  el["source-identity"].textContent = shortIdentity(state.model.sourceIdentity);
  el["snapshot-release"].textContent = `${state.model.source.snapshotRelease} / ${state.model.source.retrievedAt.slice(0, 10)}`;
  renderMetrics();
  renderClaim();
  renderIdentity();
  renderAvailability();
  el["load-reason"].textContent = state.model.historicalLoad.reason;
  renderLimitations();
  el["load-state"].textContent = "Artifact verified";
  document.body.dataset.state = "ready";
}

main().catch((error) => {
  el["fatal-error"].hidden = false;
  el["fatal-error"].textContent = error instanceof Error ? error.message : String(error);
  el["load-state"].textContent = "Artifact rejected";
  document.body.dataset.state = "error";
});
