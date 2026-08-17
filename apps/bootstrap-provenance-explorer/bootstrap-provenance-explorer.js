import { createModelView, layoutNeighborhood, wrapGraphNodeLabel } from "@onto2d/view";
import { createBootstrapProvenanceModel } from "./bootstrap-provenance-model.js?v=20260817.2";
import { formatHistoricalLoadCost, presentHistoricalLoad } from "./historical-load-presentation.js?v=20260817.2";

const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const GRAPH_LIMITS = Object.freeze({ maxNodes: 42, maxEdges: 90 });
const GRAPH_NODE = Object.freeze({ width: 156, height: 58, radius: 9, maxCharacters: 22, maxLines: 3, lineHeight: 14 });
const ARTIFACT_URLS = Object.freeze({
  trace: new URL("../../cases/live-bootstrap-provenance/generated/upstream-trace.json", import.meta.url),
  stateHistory: new URL("../../cases/live-bootstrap-provenance/generated/state-transitions.json", import.meta.url),
  evidence: new URL("../../cases/live-bootstrap-provenance/generated/evidence.json", import.meta.url),
  graph: new URL("../../cases/live-bootstrap-provenance/generated/graph.json", import.meta.url),
  constructionSpace: new URL("../../cases/live-bootstrap-provenance/analysis/construction-space.json", import.meta.url),
  regimes: new URL("../../cases/live-bootstrap-provenance/analysis/regimes.json", import.meta.url),
  analysis: new URL("../../cases/live-bootstrap-provenance/analysis/historical-load.json", import.meta.url)
});
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const ids = [
  "load-state", "revision-value", "trace-identity", "evidence-identity", "trace-count",
  "trace-search", "directive-filter", "activity-filter", "trace-list", "evidence-mode",
  "graph-mode-note", "provenance-graph", "provenance-edges", "provenance-nodes",
  "graph-empty", "graph-counts", "evidence-legend", "trust-roots", "path-cards",
  "cost-function", "regime-select", "analysis-disclaimer", "load-value", "load-formula",
  "load-target", "a0-value", "af-value", "divergence-value", "load-meaning", "load-scope", "path-comparison",
  "constraint-list", "ablation-list", "inspector-layer", "inspector-name", "inspector-kind",
  "inspector-class", "inspector-status", "inspector-source", "inspector-method",
  "inspector-claim", "inspector-record", "fatal-error"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) {
  if (!element) throw new Error(`Bootstrap Provenance Explorer markup is missing #${id}.`);
}

const state = {
  model: null,
  evidenceMode: "derived",
  selectedId: null,
  graphFocusId: null
};

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function shortHash(value) {
  return typeof value === "string" && value.length > 28
    ? `${value.slice(0, 15)}...${value.slice(-9)}`
    : String(value ?? "not declared");
}

function scalar(value, fallback = "not declared") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

async function loadJson(url) {
  const response = await fetch(url.href, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" }
  });
  if (!response.ok || response.status !== 200 || response.redirected || response.url !== url.href) {
    throw new Error(`Artifact request failed for ${url.pathname}.`);
  }
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error(`${url.pathname} is not JSON content.`);
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_ARTIFACT_BYTES) {
    throw new Error(`${url.pathname} exceeds the Explorer artifact limit.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    throw new Error(`${url.pathname} exceeds the Explorer artifact limit.`);
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${url.pathname} is not valid UTF-8.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url.pathname} is not valid JSON.`);
  }
}

function option(value, label) {
  const node = element("option", "", label);
  node.value = value;
  return node;
}

function renderIdentity() {
  const descriptor = state.model.descriptor;
  elements["revision-value"].textContent = shortHash(descriptor.upstreamRevision);
  elements["revision-value"].title = descriptor.upstreamRevision;
  elements["trace-identity"].textContent = shortHash(descriptor.traceIdentity);
  elements["trace-identity"].title = descriptor.traceIdentity;
  elements["evidence-identity"].textContent = shortHash(descriptor.evidenceIdentity);
  elements["evidence-identity"].title = descriptor.evidenceIdentity;
  elements["analysis-disclaimer"].textContent = descriptor.disclaimer;
}

function traceQuery() {
  return {
    directive: elements["directive-filter"].value,
    status: elements["activity-filter"].value,
    query: elements["trace-search"].value
  };
}

function selectRecord(id, { focusGraph = false } = {}) {
  state.selectedId = id;
  if (focusGraph) state.graphFocusId = id;
  renderTraceSelection();
  renderInspector();
  if (focusGraph) renderGraph();
}

function renderTraceSelection() {
  for (const item of elements["trace-list"].querySelectorAll("[data-event-id]")) {
    item.setAttribute("aria-selected", String(item.dataset.eventId === state.selectedId));
  }
}

function renderTrace() {
  const events = state.model.trace(traceQuery());
  elements["trace-count"].textContent = `${events.length} / ${state.model.descriptor.eventCount}`;
  const items = events.map((event) => {
    const button = element("button", "trace-item");
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-selected", String(event.eventId === state.selectedId));
    button.dataset.eventId = event.eventId;
    button.dataset.active = String(event.profileStatus.active);
    button.append(element("span", "", String(event.ordinal).padStart(3, "0")));
    const body = element("div");
    const target = event.target
      ?? (event.targets.length > 0 ? event.targets.join(" ") : event.definition?.name);
    body.append(
      element("strong", "", `${event.directive} ${scalar(target, "")}`.trim()),
      element("small", "", event.source.comment ?? event.source.raw),
      element("code", "", `${event.source.path}:${event.source.line}`)
    );
    button.append(body);
    button.addEventListener("click", () => selectRecord(event.eventId, { focusGraph: true }));
    return button;
  });
  elements["trace-list"].replaceChildren(...(
    items.length > 0
      ? items
      : [element("p", "trace-empty", "No trace events match the current filters.")]
  ));
}

function graphProjection() {
  const data = state.model.provenance(state.evidenceMode);
  if (data.nodes.length === 0) return { data, projection: null, layout: null };
  const ids = new Set(data.nodes.map((node) => node.id));
  if (!ids.has(state.graphFocusId)) state.graphFocusId = data.nodes[0].id;
  const view = createModelView({
    nodes: data.nodes.map((node) => ({
      ...node,
      name: node.label,
      typeRole: node.kind,
      scientificStatus: node.layer
    })),
    edges: data.edges.map((edge) => ({
      ...edge,
      dependencyType: edge.relation,
      necessity: edge.evidenceClass
    }))
  });
  const projection = view.neighborhood({
    focusId: state.graphFocusId,
    depth: 2,
    direction: "both",
    ...GRAPH_LIMITS
  });
  return {
    data,
    projection,
    layout: layoutNeighborhood(projection, {
      width: 960,
      height: 510,
      padding: 38,
      nodeWidth: GRAPH_NODE.width,
      nodeHeight: GRAPH_NODE.height
    })
  };
}

function renderGraph() {
  const { data, projection, layout } = graphProjection();
  for (const button of elements["evidence-mode"].querySelectorAll("button[data-mode]")) {
    const active = button.dataset.mode === state.evidenceMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  const notes = {
    observed: "Only relations classified as upstream facts are visible.",
    derived: "Upstream and deterministic-derived edges are visible.",
    all: data.inferredCount === 0
      ? "All evidence is visible; this release contains zero inferred-dependency edges."
      : `All evidence is visible, including ${data.inferredCount} inferred edges.`
  };
  elements["graph-mode-note"].textContent = notes[state.evidenceMode];
  elements["graph-empty"].hidden = layout !== null;
  if (layout === null) {
    elements["provenance-edges"].replaceChildren();
    elements["provenance-nodes"].replaceChildren();
    elements["graph-counts"].textContent = "Showing 0 nodes / 0 edges";
    elements["evidence-legend"].replaceChildren();
    return;
  }

  const edges = layout.edges.map((edge) => {
    const group = svgElement("g", {
      class: "evidence-edge",
      tabindex: "0",
      role: "button",
      "aria-label": `${edge.source} to ${edge.target}: ${scalar(edge.dependencyType)}`,
      "data-class": scalar(edge.necessity, "unknown")
    });
    const hitPath = svgElement("path", { class: "evidence-edge-hit", d: edge.path });
    const linePath = svgElement("path", {
      class: "evidence-edge-line",
      d: edge.path,
      "marker-end": "url(#evidence-arrow)"
    });
    const title = svgElement("title");
    title.textContent = `${edge.source} -> ${edge.target} | ${scalar(edge.dependencyType)}`;
    group.append(hitPath, linePath, title);
    group.addEventListener("click", () => selectRecord(edge.id));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectRecord(edge.id);
      }
    });
    return group;
  });
  const nodes = layout.nodes.map((node) => {
    const group = svgElement("g", {
      class: "evidence-node",
      transform: `translate(${node.x} ${node.y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${node.name}, ${node.scientificStatus}`,
      "data-layer": scalar(node.scientificStatus),
      "data-selected": String(node.id === state.selectedId)
    });
    const box = svgElement("rect", {
      x: -layout.nodeWidth / 2,
      y: -layout.nodeHeight / 2,
      width: layout.nodeWidth,
      height: layout.nodeHeight,
      rx: GRAPH_NODE.radius,
      ry: GRAPH_NODE.radius
    });
    const label = svgElement("text", { "aria-hidden": "true" });
    const wrapped = wrapGraphNodeLabel(node.name, {
      maxCharacters: Math.max(8, Math.min(
        GRAPH_NODE.maxCharacters,
        Math.floor((layout.nodeWidth - 24) / 7.25)
      )),
      maxLines: GRAPH_NODE.maxLines
    });
    const firstLineY = -((wrapped.lines.length - 1) * GRAPH_NODE.lineHeight) / 2 + 4;
    label.append(...wrapped.lines.map((line, index) => {
      const span = svgElement("tspan", { x: 0, y: firstLineY + index * GRAPH_NODE.lineHeight });
      span.textContent = line;
      return span;
    }));
    group.dataset.truncated = String(wrapped.truncated);
    const title = svgElement("title");
    title.textContent = `${node.id} | ${node.name}`;
    group.append(box, label, title);
    group.addEventListener("click", () => selectRecord(node.id));
    group.addEventListener("dblclick", () => {
      state.graphFocusId = node.id;
      selectRecord(node.id);
      renderGraph();
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter") selectRecord(node.id);
      if (event.key === " ") {
        event.preventDefault();
        state.graphFocusId = node.id;
        selectRecord(node.id);
        renderGraph();
      }
    });
    return group;
  });
  elements["provenance-edges"].replaceChildren(...edges);
  elements["provenance-nodes"].replaceChildren(...nodes);
  elements["graph-counts"].textContent = `Showing ${layout.nodes.length} / ${data.nodes.length} nodes and ${layout.edges.length} / ${data.edges.length} edges (depth 2)`;
  const counts = new Map();
  for (const edge of data.edges) counts.set(edge.evidenceClass, (counts.get(edge.evidenceClass) ?? 0) + 1);
  elements["evidence-legend"].replaceChildren(...[...counts].sort().map(([name, count]) => {
    const item = element("span");
    item.append(element("i"), document.createTextNode(`${name} ${count}`));
    return item;
  }));
}

function renderTrustRoots() {
  const cards = state.model.trustRoots().map((root) => {
    const card = element("article", "root-card");
    card.dataset.layer = root.layer;
    card.append(
      element("span", "", root.origin === "extracted-boundary" ? "Extracted boundary" : "Counterfactual declaration"),
      element("strong", "", root.label),
      element("code", "", root.id)
    );
    if (root.origin === "extracted-boundary") {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.addEventListener("click", () => selectRecord(root.id, { focusGraph: true }));
    }
    return card;
  });
  elements["trust-roots"].replaceChildren(...cards);
}

function renderPaths() {
  const result = state.model.historicalLoad("event-count", "bootstrappable");
  const paths = [
    state.model.path(result.admissiblePath),
    ...[result.freePath, "path:source-from-prebuilt-toolchain"]
      .filter((id, index, values) => !values.slice(0, index).includes(id))
      .map((id) => state.model.path(id))
  ].sort((left, right) => Number(right.properties.actual) - Number(left.properties.actual));
  const cards = paths.map((path) => {
    const card = element("article", "path-card");
    card.dataset.actual = String(path.properties.actual);
    card.append(
      element("span", "", path.properties.actual ? "Actual pinned trace" : "Onto2D counterfactual"),
      element("h3", "", path.label),
      element("p", "", path.properties.actual
        ? "The active manifest prefix reaches the declared target."
        : "A disclosed alternative in the finite construction space."),
      element("footer", "", `${path.steps.length} steps | source-derived ${path.properties.sourceDerived}`)
    );
    const button = element("button", "", "Inspect exact path record");
    button.type = "button";
    button.addEventListener("click", () => selectRecord(path.id));
    card.append(button);
    return card;
  });
  elements["path-cards"].replaceChildren(...cards);
}

function summarizeSteps(path, limit = 4) {
  const labels = path.steps.map((step) => step.label);
  if (labels.length <= limit) return labels.join(" -> ");
  return `${labels.slice(0, 2).join(" -> ")} -> ... ${labels.length - 3} steps ... -> ${labels.at(-1)}`;
}

function comparisonCard(kind, label, path) {
  const card = element("article", "comparison-path");
  card.dataset.kind = kind;
  card.append(
    element("span", "", label),
    element("strong", "", path.label),
    element("p", "", summarizeSteps(path))
  );
  return card;
}

function renderHistoricalLoad() {
  const result = state.model.historicalLoad(
    elements["cost-function"].value,
    elements["regime-select"].value
  );
  const regime = state.model.regime(result.regime.id);
  const actual = state.model.path("path:observed-prefix-to-first-gcc");
  const free = state.model.path(result.freePath);
  const admissible = state.model.path(result.admissiblePath);
  const presentation = presentHistoricalLoad({ result, regime, freePath: free, admissiblePath: admissible });
  elements["load-value"].textContent = presentation.displayedDelta;
  elements["load-formula"].textContent = presentation.formula;
  elements["load-target"].textContent = result.target.label;
  elements["a0-value"].textContent = `${presentation.freeCost} / ${free.label}`;
  elements["af-value"].textContent = `${presentation.admissibleCost} / ${admissible.label}`;
  elements["divergence-value"].textContent = result.firstDivergence === null
    ? "No divergence"
    : `step ${result.firstDivergence.index}: ${result.firstDivergence.freeStep} vs ${result.firstDivergence.admissibleStep}`;
  elements["cost-function"].title = result.costFunction.description;
  elements["regime-select"].title = regime.description;
  elements["load-meaning"].textContent = presentation.meaning;
  elements["load-scope"].textContent = presentation.scope;
  elements["path-comparison"].replaceChildren(
    comparisonCard("actual", "Actual trace", actual),
    comparisonCard("free", "Unconstrained optimum (a0)", free),
    comparisonCard("admissible", "Constrained optimum (aF)", admissible)
  );
  elements["constraint-list"].replaceChildren(...(
    regime.constraintRecords.length === 0
      ? [element("p", "", "No active constraints in the free regime.")]
      : regime.constraintRecords.map((constraint) => {
          const item = element("p");
          item.append(element("code", "", constraint.id), document.createTextNode(` ${constraint.description}`));
          return item;
        })
  ));
  elements["ablation-list"].replaceChildren(...(
    result.constraintAblation.length === 0
      ? [element("p", "", "No active constraint is available for ablation.")]
      : result.constraintAblation.map((ablation) => {
          const item = element("p");
          const ablatedPath = state.model.path(ablation.ablatedPath);
          const effect = ablation.costReduction === 0
            ? "does not lower the constrained minimum"
            : `lowers the constrained minimum by ${formatHistoricalLoadCost(ablation.costReduction, result.costFunction.id)}`;
          item.append(
            element("code", "", ablation.constraintId.replace(/^constraint:/, "")),
            document.createTextNode(`: removing it ${effect}; optimum becomes "${ablatedPath.label}".`)
          );
          return item;
        })
  ));
}

function sourceText(record) {
  const source = record.sourceLocation ?? record.source ?? record.provenance?.source;
  if (source === null || typeof source !== "object") return "not declared";
  return `${scalar(source.path)}:${scalar(source.line)}`;
}

function renderInspector() {
  if (state.selectedId === null) return;
  const detail = state.model.inspect(state.selectedId);
  const record = detail.record;
  elements["inspector-layer"].textContent = detail.layer;
  elements["inspector-name"].textContent = record.claim ?? record.label ?? record.target ?? record.id ?? record.eventId ?? state.selectedId;
  elements["inspector-kind"].textContent = detail.kind;
  elements["inspector-class"].textContent = scalar(record.evidenceClass, record.relation ?? record.directive);
  elements["inspector-status"].textContent = scalar(record.status, record.profileStatus?.active === undefined ? undefined : record.profileStatus.active ? "active" : "inactive");
  elements["inspector-source"].textContent = sourceText(record);
  elements["inspector-method"].textContent = scalar(record.method, record.provenance?.method ?? record.introducedBy);
  elements["inspector-claim"].textContent = record.claim
    ?? record.interpretationNote
    ?? record.description
    ?? (detail.layer === "onto2d-analysis"
      ? "Onto2D construction-model record; it is not an upstream fact."
      : "Inspect the exact source-bound record below.");
  elements["inspector-record"].textContent = JSON.stringify(detail, null, 2);
}

function bindEvents() {
  elements["trace-search"].addEventListener("input", renderTrace);
  elements["directive-filter"].addEventListener("change", renderTrace);
  elements["activity-filter"].addEventListener("change", renderTrace);
  elements["evidence-mode"].addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.evidenceMode = button.dataset.mode;
    renderGraph();
  });
  elements["cost-function"].addEventListener("change", renderHistoricalLoad);
  elements["regime-select"].addEventListener("change", renderHistoricalLoad);
}

function initializeControls() {
  elements["directive-filter"].append(...state.model.filters.directives.map((directive) => option(directive, directive)));
  elements["cost-function"].replaceChildren(...state.model.filters.costFunctions.map((cost) => option(cost.id, cost.label)));
  elements["regime-select"].replaceChildren(...state.model.filters.regimes.map((regime) => option(regime.id, regime.label)));
  elements["cost-function"].value = "event-count";
  elements["regime-select"].value = "bootstrappable";
}

function renderAll() {
  renderIdentity();
  renderTrace();
  renderGraph();
  renderTrustRoots();
  renderPaths();
  renderHistoricalLoad();
  renderInspector();
}

function displayError(error) {
  document.body.dataset.state = "error";
  elements["load-state"].textContent = "Artifact verification failed";
  elements["fatal-error"].hidden = false;
  elements["fatal-error"].textContent = error instanceof Error ? error.message : String(error);
  console.error(error);
}

async function start() {
  const entries = await Promise.all(Object.entries(ARTIFACT_URLS).map(async ([name, url]) => (
    [name, await loadJson(url)]
  )));
  state.model = createBootstrapProvenanceModel(Object.fromEntries(entries));
  state.selectedId = state.model.trace()[0].eventId;
  state.graphFocusId = state.selectedId;
  initializeControls();
  bindEvents();
  renderAll();
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = "Pinned artifacts verified";
}

start().catch(displayError);
