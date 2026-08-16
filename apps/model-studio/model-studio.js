import { createModelView, layoutNeighborhood } from "../../packages/view/src/index.js?v=20260816.10";
import { graphHighlight } from "./graph-interactions.js?v=20260816.10";

const MODEL_ROOT = "../../models/causal-emergence/releases/2026.08.15";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const DEFAULT_FOCUS = "0.0";
const GRAPH_LIMITS = Object.freeze({ maxNodes: 48, maxEdges: 180 });

const ids = [
  "model-name", "model-version", "node-count", "edge-count", "root-hash", "load-state",
  "catalog-count", "catalog-search", "level-filter", "role-filter", "phase-filter",
  "status-filter", "catalog-sort", "catalog-list", "catalog-empty", "graph-title", "editor-tab-label",
  "reset-view", "direction-controls", "depth-controls", "neighborhood-graph", "graph-edges",
  "graph-nodes", "graph-message", "graph-counts", "selected-id", "selected-coordinate",
  "selected-name", "selected-tags", "selected-summary", "parent-count", "child-count",
  "degree-count", "parents-total", "children-total", "parent-list", "child-list",
  "selected-description", "selected-record"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) {
  if (!element) throw new Error(`Model Studio markup is missing #${id}.`);
}

const state = {
  view: null,
  manifest: null,
  focusId: DEFAULT_FOCUS,
  selectedId: DEFAULT_FOCUS,
  direction: "both",
  depth: 1
};
let activeGraphProjection = null;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function createElement(name, className, text) {
  const element = document.createElement(name);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function shortenedHash(value) {
  return typeof value === "string" && value.length > 26
    ? `${value.slice(0, 14)}...${value.slice(-8)}`
    : String(value ?? "not available");
}

function scalarLabel(value, fallback = "not declared") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function selectValue(element) {
  return element.value === "" ? [] : [element.value];
}

function selectNumericValue(element) {
  return element.value === "" ? [] : [Number(element.value)];
}

async function fetchJson(path) {
  const response = await fetch(`${MODEL_ROOT}/${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}.`);
  return response.json();
}

function populateSelect(element, entries, allLabel) {
  const first = createElement("option", "", allLabel);
  first.value = "";
  const options = entries.map(({ value, count }) => {
    const option = createElement("option", "", `${value} (${count})`);
    option.value = String(value);
    return option;
  });
  element.replaceChildren(first, ...options);
}

function currentCatalog() {
  const [sort, order] = elements["catalog-sort"].value.split(":");
  return state.view.catalog({
    search: elements["catalog-search"].value,
    levels: selectNumericValue(elements["level-filter"]),
    phases: selectValue(elements["phase-filter"]),
    typeRoles: selectValue(elements["role-filter"]),
    scientificStatuses: selectValue(elements["status-filter"]),
    sort,
    order,
    limit: 500
  });
}

function inspectNode(id) {
  if (!state.view?.get(id)) return;
  state.selectedId = id;
  for (const element of elements["catalog-list"].querySelectorAll("[data-node-id]")) {
    element.setAttribute("aria-selected", String(element.dataset.nodeId === id));
  }
  for (const element of elements["graph-nodes"].querySelectorAll("[data-node-id]")) {
    element.dataset.selected = String(element.dataset.nodeId === id);
  }
  renderInspector();
}

function focusNode(id, updateLocation = true) {
  if (!state.view?.get(id)) return;
  state.focusId = id;
  state.selectedId = id;
  if (updateLocation) replaceLocationState();
  render();
}

function renderCatalog() {
  const catalog = currentCatalog();
  elements["catalog-count"].textContent = `${catalog.matching} / ${catalog.total}`;
  const items = catalog.items.map((node) => {
    const button = createElement("button", "catalog-item");
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(node.id === state.selectedId));
    button.dataset.nodeId = node.id;
    button.dataset.focus = String(node.id === state.focusId);
    button.title = "Click to inspect; double-click to focus the graph";
    const coordinate = createElement("span", "catalog-coordinate", `L${scalarLabel(node.level, "-")} / ${scalarLabel(node.phase, "-")}`);
    const title = createElement("strong", "", node.name);
    const metadata = createElement("small", "", `${node.id} | ${scalarLabel(node.typeRole)} | ${node.degree} edges`);
    button.append(coordinate, title, metadata);
    button.addEventListener("click", () => inspectNode(node.id));
    button.addEventListener("dblclick", () => focusNode(node.id));
    return button;
  });
  elements["catalog-list"].replaceChildren(...items);
  elements["catalog-empty"].hidden = items.length > 0;
}

function relationClass(relation) {
  return ["focus", "parent", "child", "both"].includes(relation) ? relation : "child";
}

function clearGraphHighlight() {
  for (const element of elements["graph-nodes"].querySelectorAll("[data-highlight]")) {
    element.removeAttribute("data-highlight");
  }
  for (const element of elements["graph-edges"].querySelectorAll("[data-highlight]")) {
    element.removeAttribute("data-highlight");
  }
}

function applyGraphHighlight(target) {
  if (!activeGraphProjection) return;
  const highlight = graphHighlight(activeGraphProjection, target);
  const primaryNodes = new Set(highlight.primaryNodes);
  const connectedNodes = new Set(highlight.connectedNodes);
  const primaryEdges = new Set(highlight.primaryEdges);
  const connectedEdges = new Set(highlight.connectedEdges);
  for (const element of elements["graph-nodes"].querySelectorAll("[data-node-id]")) {
    const id = element.dataset.nodeId;
    element.dataset.highlight = primaryNodes.has(id)
      ? "primary"
      : connectedNodes.has(id) ? "connected" : "dimmed";
  }
  for (const element of elements["graph-edges"].querySelectorAll("[data-edge-id]")) {
    const id = element.dataset.edgeId;
    element.dataset.highlight = primaryEdges.has(id)
      ? "primary"
      : connectedEdges.has(id) ? "connected" : "dimmed";
  }
}

function bindGraphHighlight(element, target) {
  element.addEventListener("pointerenter", () => applyGraphHighlight(target));
  element.addEventListener("pointerleave", clearGraphHighlight);
  element.addEventListener("focus", () => applyGraphHighlight(target));
  element.addEventListener("blur", clearGraphHighlight);
}

function renderGraph() {
  const projection = state.view.neighborhood({
    focusId: state.focusId,
    depth: state.depth,
    direction: state.direction,
    ...GRAPH_LIMITS
  });
  const layout = layoutNeighborhood(projection, {
    width: 1040,
    height: 680,
    padding: 62,
    nodeRadius: 25
  });
  activeGraphProjection = projection;
  elements["graph-title"].textContent = projection.focus.name;
  elements["editor-tab-label"].textContent = `${projection.focus.id} ${projection.focus.name}`;
  elements["neighborhood-graph"].setAttribute("aria-label", `${projection.focus.name}: ${projection.counts.displayedNodeCount} visible nodes and ${projection.counts.displayedEdgeCount} visible edges.`);

  const edgeNodes = layout.edges.map((edge) => {
    const isFocusEdge = edge.source === state.focusId || edge.target === state.focusId;
    const group = svgElement("g", {
      class: "graph-edge",
      tabindex: "0",
      role: "img",
      "aria-label": `${edge.source} to ${edge.target}, ${scalarLabel(edge.dependencyType)}`,
      "data-edge-id": edge.id,
      "data-source": edge.source,
      "data-target": edge.target
    });
    const hitPath = svgElement("path", { class: "edge-hit", d: edge.path });
    const linePath = svgElement("path", {
      class: "edge-line",
      d: edge.path,
      fill: "none",
      stroke: isFocusEdge ? "#4ec9b0" : "#6a6a6a",
      "stroke-width": isFocusEdge ? "1.8" : "1.4",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "vector-effect": "non-scaling-stroke",
      "data-focus-edge": isFocusEdge ? "true" : "false",
      "marker-end": isFocusEdge ? "url(#studio-arrow-focus)" : "url(#studio-arrow)"
    });
    const title = svgElement("title");
    title.textContent = `${edge.source} -> ${edge.target} | ${scalarLabel(edge.dependencyType)} | weight ${scalarLabel(edge.weight)}`;
    group.append(hitPath, linePath, title);
    bindGraphHighlight(group, { kind: "edge", id: edge.id });
    return group;
  });
  elements["graph-edges"].replaceChildren(...edgeNodes);

  const nodeNodes = layout.nodes.map((node) => {
    const group = svgElement("g", {
      class: "graph-node",
      transform: `translate(${node.x} ${node.y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${node.name}, node ${node.id}, ${node.relation}. Enter inspects; Shift Enter or Space focuses.`,
      "data-node-id": node.id,
      "data-relation": relationClass(node.relation),
      "data-focus": node.id === state.focusId ? "true" : "false",
      "data-selected": node.id === state.selectedId ? "true" : "false"
    });
    const circle = svgElement("circle", { r: layout.nodeRadius });
    const label = svgElement("text", { x: 0, y: 5 });
    label.textContent = node.id.length > 7 ? `${node.id.slice(0, 6)}.` : node.id;
    const title = svgElement("title");
    title.textContent = `${node.id} | ${node.name}`;
    group.append(circle, label, title);
    group.addEventListener("click", () => inspectNode(node.id));
    group.addEventListener("dblclick", () => focusNode(node.id));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        inspectNode(node.id);
      }
      if (event.key === " " || (event.key === "Enter" && event.shiftKey)) {
        event.preventDefault();
        focusNode(node.id);
      }
    });
    bindGraphHighlight(group, { kind: "node", id: node.id });
    return group;
  });
  elements["graph-nodes"].replaceChildren(...nodeNodes);

  const hidden = projection.counts.hiddenNodeCount + projection.counts.hiddenEdgeCount;
  elements["graph-message"].hidden = hidden === 0;
  elements["graph-message"].textContent = hidden === 0
    ? ""
    : `Bounded view: ${projection.counts.hiddenNodeCount} nodes and ${projection.counts.hiddenEdgeCount} edges omitted.`;
  elements["graph-counts"].textContent = `${projection.counts.displayedNodeCount} nodes | ${projection.counts.displayedEdgeCount} edges | depth ${state.depth}`;
}

function tag(text, tone) {
  const element = createElement("span", "node-tag", text);
  if (tone) element.dataset.tone = tone;
  return element;
}

function renderRelationList(container, identifiers, emptyText) {
  if (identifiers.length === 0) {
    container.replaceChildren(createElement("p", "relation-empty", emptyText));
    return;
  }
  const buttons = identifiers.map((id) => {
    const node = state.view.get(id);
    const button = createElement("button", "relation-item");
    button.type = "button";
    button.title = "Click to inspect";
    button.append(createElement("code", "", id), createElement("span", "", node?.name ?? id));
    button.addEventListener("click", () => inspectNode(id));
    return button;
  });
  container.replaceChildren(...buttons);
}

function renderInspector() {
  const projection = state.view.neighborhood({
    focusId: state.selectedId,
    depth: 1,
    direction: "both",
    maxNodes: 500,
    maxEdges: 2000
  });
  const node = projection.focus;
  elements["selected-id"].textContent = node.id;
  elements["selected-coordinate"].textContent = `Level ${scalarLabel(node.level)} / Phase ${scalarLabel(node.phase)}`;
  elements["selected-name"].textContent = node.name;
  elements["selected-tags"].replaceChildren(
    tag(scalarLabel(node.typeRole), "role"),
    tag(scalarLabel(node.scientificStatus), "status")
  );
  elements["selected-summary"].textContent = node.shortDescription || "No short description is declared for this record.";
  elements["selected-description"].textContent = typeof node.data.description === "string"
    ? node.data.description
    : "No full description is declared for this record.";
  elements["selected-record"].textContent = JSON.stringify({
    evidence: node.data.evidence ?? [],
    requirements: node.data.requirements ?? {},
    scienceIds: node.data.scienceIds ?? [],
    localId: node.data.localId ?? null,
    phaseId: node.data.phaseId ?? null,
    phaseName: node.data.phaseName ?? null,
    typeRoleId: node.data.typeRoleId ?? null
  }, null, 2);
  elements["parent-count"].textContent = String(node.parentCount);
  elements["child-count"].textContent = String(node.childCount);
  elements["degree-count"].textContent = String(node.degree);
  elements["parents-total"].textContent = String(projection.adjacent.parents.length);
  elements["children-total"].textContent = String(projection.adjacent.children.length);
  renderRelationList(elements["parent-list"], projection.adjacent.parents, "No direct parents in this release.");
  renderRelationList(elements["child-list"], projection.adjacent.children, "No direct children in this release.");
}

function updateControls() {
  for (const button of elements["direction-controls"].querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.direction === state.direction));
  }
  for (const button of elements["depth-controls"].querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.depth) === state.depth));
  }
}

function render() {
  if (!state.view) return;
  renderCatalog();
  renderGraph();
  renderInspector();
  updateControls();
}

function requestedGraphState() {
  const parameters = new URLSearchParams(location.hash.slice(1));
  const candidate = parameters.get("node");
  const depth = Number(parameters.get("depth"));
  const direction = parameters.get("direction");
  return {
    focusId: candidate && state.view.get(candidate) ? candidate : DEFAULT_FOCUS,
    depth: [1, 2].includes(depth) ? depth : 1,
    direction: ["parents", "both", "children"].includes(direction) ? direction : "both"
  };
}

function replaceLocationState() {
  const parameters = new URLSearchParams({
    node: state.focusId,
    depth: String(state.depth),
    direction: state.direction
  });
  const nextHash = parameters.toString();
  if (location.hash.slice(1) !== nextHash) history.replaceState(null, "", `#${nextHash}`);
}

function restoreLocationState() {
  const requested = requestedGraphState();
  state.depth = requested.depth;
  state.direction = requested.direction;
  focusNode(requested.focusId, false);
}

function bindEvents() {
  for (const id of ["catalog-search", "level-filter", "role-filter", "phase-filter", "status-filter", "catalog-sort"]) {
    const eventName = id === "catalog-search" ? "input" : "change";
    elements[id].addEventListener(eventName, renderCatalog);
  }
  elements["direction-controls"].addEventListener("click", (event) => {
    const button = event.target.closest("button[data-direction]");
    if (!button) return;
    state.direction = button.dataset.direction;
    renderGraph();
    updateControls();
    replaceLocationState();
  });
  elements["depth-controls"].addEventListener("click", (event) => {
    const button = event.target.closest("button[data-depth]");
    if (!button) return;
    state.depth = Number(button.dataset.depth);
    renderGraph();
    updateControls();
    replaceLocationState();
  });
  elements["reset-view"].addEventListener("click", () => {
    elements["catalog-search"].value = "";
    for (const id of ["level-filter", "role-filter", "phase-filter", "status-filter"]) elements[id].value = "";
    elements["catalog-sort"].value = "id:asc";
    state.direction = "both";
    state.depth = 1;
    focusNode(DEFAULT_FOCUS);
  });
  window.addEventListener("hashchange", restoreLocationState);
}

function displayError(error) {
  document.body.dataset.state = "error";
  elements["load-state"].textContent = "Model load failed";
  elements["graph-title"].textContent = "Could not load the model";
  elements["graph-message"].hidden = false;
  elements["graph-message"].textContent = error instanceof Error ? error.message : String(error);
  console.error(error);
}

async function start() {
  const [manifest, nodes, edges] = await Promise.all([
    fetchJson("manifest.json"),
    fetchJson("model/nodes.json"),
    fetchJson("model/edges.json")
  ]);
  const view = createModelView({ nodes, edges });
  if (
    manifest?.model?.id !== "causal-emergence"
    || manifest?.model?.version !== "2026.08.15"
    || manifest?.statistics?.nodeCount !== view.statistics.nodeCount
    || manifest?.statistics?.edgeCount !== view.statistics.edgeCount
  ) {
    throw new Error("The displayed Model Pack metadata does not match its graph files.");
  }
  state.manifest = manifest;
  state.view = view;
  const requested = requestedGraphState();
  state.focusId = requested.focusId;
  state.selectedId = state.focusId;
  state.depth = requested.depth;
  state.direction = requested.direction;
  elements["model-name"].textContent = manifest.model.name;
  elements["model-version"].textContent = manifest.model.version;
  elements["node-count"].textContent = String(view.statistics.nodeCount);
  elements["edge-count"].textContent = String(view.statistics.edgeCount);
  elements["root-hash"].textContent = shortenedHash(manifest.rootHash);
  elements["root-hash"].title = manifest.rootHash;
  populateSelect(elements["level-filter"], view.facets.levels, "All levels");
  populateSelect(elements["role-filter"], view.facets.typeRoles, "All types");
  populateSelect(elements["phase-filter"], view.facets.phases, "All phases");
  populateSelect(elements["status-filter"], view.facets.scientificStatuses, "All statuses");
  bindEvents();
  render();
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = "Model ready";
}

start().catch(displayError);
