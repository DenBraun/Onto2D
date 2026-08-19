import {
  loadModelPackBundle,
  loadModelPackHttpDirectory
} from "../../packages/model-pack/src/browser.js?v=20260818.11";
import {
  createIndexedDbModelPackCacheStorage,
  createVerifiedModelPackCache
} from "../../packages/model-pack/src/cache.js?v=20260818.11";
import {
  loadModelPackRegistryHttp,
  matchModelPackRegistryResolution,
  resolveModelPackRegistry
} from "../../packages/model-pack/src/registry.js?v=20260818.11";
import { createModelPackWorkerClient } from "../../packages/model-pack/src/worker.js?v=20260818.11";
import { RDF_IMPORT_LIMITS, importNTriples } from "../../packages/rdf-import/src/index.js?v=20260818.11";
import {
  buildRdfMappedModelPack,
  verifyRdfMappingPolicy
} from "../../packages/rdf-mapping/src/index.js?v=20260818.11";
import { validateShacl } from "../../packages/shacl-validation/src/index.js?v=20260818.11";
import { createVerifiedModelPresentation } from "../../packages/engine/src/presentation.js?v=20260818.11";
import { layoutNeighborhood, wrapGraphNodeLabel } from "../../packages/view/src/index.js?v=20260818.11";
import { graphHighlight } from "./graph-interactions.js?v=20260818.11";
import {
  modelSelectionKey,
  modelSelectionLabel,
  registryEntryForKey,
  requestedRegistryEntry,
  requestedWorkspaceState
} from "./model-selection.js?v=20260818.11";

const MODEL_REGISTRY_URL = new URL("../../models/registry.json", import.meta.url);
const MODEL_PACK_WORKER_URL = new URL(
  "../../assets/js/model-pack-worker.js?v=20260818.11",
  import.meta.url
);
const EXPECTED_REGISTRY_HASH = "sha256:9f224aed53312a18a4d83364a456a8392632d15bb635b4609e9e4ad062c70986";
const MODEL_CACHE_OPTIONS = Object.freeze({
  databaseName: "onto2d-model-studio-cache-v1",
  maxEntries: 4,
  maxTotalBytes: 128 * 1024 * 1024
});
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const GRAPH_LIMITS = Object.freeze({ maxNodes: 48, maxEdges: 180 });
const GRAPH_NODE = Object.freeze({ width: 148, height: 54, radius: 8, maxCharacters: 21, maxLines: 3, lineHeight: 13 });
const CATALOG_PAGE_SIZE = 60;
const MAX_POLICY_BYTES = 512 * 1024;
const LOCAL_MODEL_OPTION = "local-rdf";
const PRESENTATION_FIELDS = new Set([
  "id", "name", "level", "phase", "typeRole", "scientificStatus",
  "shortDescription", "parentCount", "childCount", "incomingEdgeCount",
  "outgoingEdgeCount", "degree"
]);

const ids = [
  "model-selector", "model-name", "model-version", "node-count", "edge-count", "root-hash", "load-state",
  "catalog-count", "catalog-search", "level-filter", "role-filter", "phase-filter",
  "status-filter", "catalog-sort", "catalog-list", "catalog-empty", "graph-title", "editor-tab-label",
  "catalog-more", "window-model-id", "rdf-import-open", "rdf-import-dialog", "rdf-import-form",
  "rdf-import-close", "rdf-import-cancel", "rdf-import-submit", "rdf-data-file",
  "rdf-shapes-file", "rdf-policy-file", "rdf-import-status",
  "reset-view", "direction-controls", "depth-controls", "neighborhood-graph", "graph-edges",
  "graph-nodes", "graph-message", "graph-counts", "selected-id", "selected-coordinate",
  "selected-name", "selected-tags", "selected-summary", "parent-count", "child-count",
  "degree-count", "parents-total", "children-total", "parent-list", "child-list",
  "selected-description", "selected-record", "model-boundary-title", "model-boundary-summary",
  "model-boundary-note", "records-title-label", "parents-title-label", "children-title-label",
  "level-filter-control", "role-filter-control", "phase-filter-control", "status-filter-control",
  "level-filter-label", "role-filter-label", "phase-filter-label", "status-filter-label"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) {
  if (!element) throw new Error(`Model Studio markup is missing #${id}.`);
}

const state = {
  registrySnapshot: null,
  selection: null,
  modelSource: null,
  presentation: null,
  presentationMetadata: null,
  manifest: null,
  focusId: null,
  selectedId: null,
  direction: "both",
  depth: 1,
  catalog: {
    key: null,
    items: [],
    total: 0,
    matching: 0,
    nextOffset: null
  }
};
let activeGraphProjection = null;
let modelLoadSequence = 0;

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

function boundedLabel(value, fallback) {
  return typeof value === "string" && value.length > 0 && value.length <= 240
    ? value
    : fallback;
}

function presentationMetadata(pack, { localRdf = false } = {}) {
  const dictionaries = pack.files["model/dictionaries.json"];
  const supplied = dictionaries?.presentation;
  const labels = supplied?.labels;
  const boundary = supplied?.boundary;
  const suppliedCoordinates = Array.isArray(supplied?.coordinates)
    ? supplied.coordinates.slice(0, 4).filter((coordinate) => (
        coordinate !== null
        && typeof coordinate === "object"
        && !Array.isArray(coordinate)
        && PRESENTATION_FIELDS.has(coordinate.field)
        && typeof coordinate.label === "string"
        && coordinate.label.length > 0
        && coordinate.label.length <= 40
      ))
    : [];
  const metadata = {
    labels: {
      catalogTitle: boundedLabel(labels?.catalogTitle, "Records"),
      searchPlaceholder: boundedLabel(labels?.searchPlaceholder, "Search records"),
      levelFilter: boundedLabel(labels?.levelFilter, "Level"),
      typeFilter: boundedLabel(labels?.typeFilter, "Type"),
      phaseFilter: boundedLabel(labels?.phaseFilter, "Phase"),
      statusFilter: boundedLabel(labels?.statusFilter, "Status"),
      parents: boundedLabel(labels?.parents, "Direct parents"),
      children: boundedLabel(labels?.children, "Direct children")
    },
    coordinates: suppliedCoordinates.length > 0
      ? suppliedCoordinates.map(({ field, label }) => Object.freeze({ field, label }))
      : [
          Object.freeze({ field: "level", label: "Level" }),
          Object.freeze({ field: "phase", label: "Phase" })
        ],
    boundary: {
      title: boundedLabel(boundary?.title, "Verified model boundary"),
      summary: boundedLabel(
        boundary?.summary,
        "Record and relation semantics are those declared by this exact verified release."
      ),
      note: boundedLabel(
        boundary?.note,
        "The Studio does not add dependency or causal meaning beyond the selected Model Pack."
      )
    }
  };
  if (localRdf) {
    metadata.boundary = {
      title: "Local RDF boundary",
      summary: "Reviewed mapping projection. Nodes and edges are admitted only by the exact local policy after SHACL conformance.",
      note: "This in-memory model is not a registry release, is not uploaded, and disappears when the page reloads."
    };
  }
  return Object.freeze(metadata);
}

function coordinateText(node, fallback = "No coordinate") {
  const parts = state.presentationMetadata.coordinates
    .filter(({ field }) => node[field] !== null && node[field] !== undefined && node[field] !== "")
    .map(({ field, label }) => `${label} ${String(node[field])}`);
  return parts.length > 0 ? parts.join(" / ") : fallback;
}

function compactCoordinateText(node, fallback = "--") {
  const values = state.presentationMetadata.coordinates
    .map(({ field }) => node[field])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String);
  return values.length > 0 ? values.join(" / ") : fallback;
}

function selectFacetValue(element) {
  if (element.value === "") return [];
  try {
    return [JSON.parse(element.value)];
  } catch {
    return [];
  }
}

function populateSelect(element, entries, allLabel) {
  const first = createElement("option", "", allLabel);
  first.value = "";
  const options = entries.map(({ value, count }) => {
    const option = createElement("option", "", `${value} (${count})`);
    option.value = JSON.stringify(value);
    return option;
  });
  element.replaceChildren(first, ...options);
}

function currentCatalogQuery() {
  const [sort, order] = elements["catalog-sort"].value.split(":");
  return {
    search: elements["catalog-search"].value,
    levels: selectFacetValue(elements["level-filter"]),
    phases: selectFacetValue(elements["phase-filter"]),
    typeRoles: selectFacetValue(elements["role-filter"]),
    scientificStatuses: selectFacetValue(elements["status-filter"]),
    sort,
    order
  };
}

function inspectNode(id) {
  if (!state.presentation?.has(id)) return;
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
  if (!state.presentation?.has(id)) return;
  state.focusId = id;
  state.selectedId = id;
  if (updateLocation) replaceLocationState();
  render();
}

function renderCatalog({ reset = false, loadMore = false } = {}) {
  const query = currentCatalogQuery();
  const key = JSON.stringify(query);
  const shouldReset = reset || state.catalog.key !== key;
  if (shouldReset) {
    const page = state.presentation.catalog({ ...query, offset: 0, limit: CATALOG_PAGE_SIZE });
    state.catalog = {
      key,
      items: [...page.items],
      total: page.total,
      matching: page.matching,
      nextOffset: page.nextOffset
    };
  } else if (loadMore && state.catalog.nextOffset !== null) {
    const page = state.presentation.catalog({
      ...query,
      offset: state.catalog.nextOffset,
      limit: CATALOG_PAGE_SIZE
    });
    state.catalog.items.push(...page.items);
    state.catalog.nextOffset = page.nextOffset;
    state.catalog.total = page.total;
    state.catalog.matching = page.matching;
  }
  elements["catalog-count"].textContent = `${state.catalog.items.length} / ${state.catalog.matching}`;
  elements["catalog-count"].title = `${state.catalog.matching} matching of ${state.catalog.total} total nodes`;
  const items = state.catalog.items.map((node) => {
    const button = createElement("button", "catalog-item");
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(node.id === state.selectedId));
    button.dataset.nodeId = node.id;
    button.dataset.focus = String(node.id === state.focusId);
    button.title = "Click to inspect; double-click to focus the graph";
    const coordinate = createElement("span", "catalog-coordinate", compactCoordinateText(node));
    coordinate.title = coordinateText(node);
    const title = createElement("strong", "", node.name);
    const metadata = createElement("small", "", `${node.id} | ${scalarLabel(node.typeRole)} | ${node.degree} edges`);
    button.append(coordinate, title, metadata);
    button.addEventListener("click", () => inspectNode(node.id));
    button.addEventListener("dblclick", () => focusNode(node.id));
    return button;
  });
  elements["catalog-list"].replaceChildren(...items);
  elements["catalog-empty"].hidden = items.length > 0;
  elements["catalog-more"].hidden = state.catalog.nextOffset === null;
  elements["catalog-more"].textContent = state.catalog.nextOffset === null
    ? "All matching records loaded"
    : `Load next ${Math.min(CATALOG_PAGE_SIZE, state.catalog.matching - state.catalog.items.length)}`;
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
  const projection = state.presentation.neighborhood({
    focusId: state.focusId,
    depth: state.depth,
    direction: state.direction,
    ...GRAPH_LIMITS
  });
  const layout = layoutNeighborhood(projection, {
    width: 1040,
    height: 680,
    padding: 42,
    nodeWidth: GRAPH_NODE.width,
    nodeHeight: GRAPH_NODE.height
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

function renderRelationList(container, nodes, emptyText) {
  if (nodes.length === 0) {
    container.replaceChildren(createElement("p", "relation-empty", emptyText));
    return;
  }
  const buttons = nodes.map((node) => {
    const button = createElement("button", "relation-item");
    button.type = "button";
    button.title = `${node.id} | ${node.name}`;
    button.setAttribute("aria-label", `${node.name}, node ${node.id}. Click to inspect.`);
    const identifier = createElement("code", "", node.id);
    const name = createElement("span", "", node.name);
    identifier.title = node.id;
    name.title = node.name;
    button.append(identifier, name);
    button.addEventListener("click", () => inspectNode(node.id));
    return button;
  });
  container.replaceChildren(...buttons);
}

function renderInspector() {
  const detail = state.presentation.inspect(state.selectedId);
  const node = detail.node;
  const record = detail.record;
  elements["selected-id"].textContent = node.id;
  elements["selected-coordinate"].textContent = coordinateText(node);
  elements["selected-name"].textContent = node.name;
  elements["selected-tags"].replaceChildren(
    tag(scalarLabel(node.typeRole), "role"),
    tag(scalarLabel(node.scientificStatus), "status")
  );
  elements["selected-summary"].textContent = node.shortDescription || "No short description is declared for this record.";
  elements["selected-description"].textContent = typeof record.description === "string"
    ? record.description
    : "No full description is declared for this record.";
  elements["selected-record"].textContent = JSON.stringify(record, null, 2);
  elements["parent-count"].textContent = String(node.parentCount);
  elements["child-count"].textContent = String(node.childCount);
  elements["degree-count"].textContent = String(node.degree);
  elements["parents-total"].textContent = String(detail.relationCounts.parentCount);
  elements["children-total"].textContent = String(detail.relationCounts.childCount);
  renderRelationList(elements["parent-list"], detail.relations.parents, "No direct parents in this release.");
  renderRelationList(elements["child-list"], detail.relations.children, "No direct children in this release.");
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
  if (!state.presentation) return;
  renderCatalog();
  renderGraph();
  renderInspector();
  updateControls();
}

function populateRegistrySelector(snapshot) {
  const options = snapshot.registry.entries.map((entry) => {
    const option = createElement("option", "", modelSelectionLabel(entry));
    option.value = modelSelectionKey(entry);
    return option;
  });
  elements["model-selector"].replaceChildren(...options);
}

function selectRegisteredOption(selection) {
  const local = elements["model-selector"].querySelector(`option[value="${LOCAL_MODEL_OPTION}"]`);
  if (local) local.remove();
  elements["model-selector"].value = modelSelectionKey(selection);
}

function selectLocalOption(manifest) {
  let option = elements["model-selector"].querySelector(`option[value="${LOCAL_MODEL_OPTION}"]`);
  if (!option) {
    option = createElement("option");
    option.value = LOCAL_MODEL_OPTION;
    elements["model-selector"].append(option);
  }
  option.textContent = `${manifest.model.name} - ${manifest.model.version} (local)`;
  elements["model-selector"].value = LOCAL_MODEL_OPTION;
}

function configureFacet(filterId, entries, allLabel, label) {
  populateSelect(elements[filterId], entries, allLabel);
  const prefix = filterId.replace("-filter", "");
  elements[`${prefix}-filter-label`].textContent = label;
  elements[`${prefix}-filter-control`].hidden = entries.length === 0;
}

function activateModelPack(pack, options = {}) {
  const presentationOptions = options.resolution
    ? { resolution: options.resolution, defaultCatalogPageSize: CATALOG_PAGE_SIZE }
    : { defaultCatalogPageSize: CATALOG_PAGE_SIZE };
  const presentation = createVerifiedModelPresentation(pack, presentationOptions);
  const manifest = pack.manifest;
  const descriptor = presentation.descriptor;
  const localRdf = options.modelSource === "local-rdf";
  const metadata = presentationMetadata(pack, { localRdf });
  const previousPresentation = state.presentation;
  state.manifest = manifest;
  state.presentation = presentation;
  state.presentationMetadata = metadata;
  state.selection = options.resolution === undefined
    ? null
    : Object.freeze({ modelId: options.resolution.modelId, version: options.resolution.version });
  state.modelSource = options.modelSource ?? "registry";
  state.catalog = { key: null, items: [], total: 0, matching: 0, nextOffset: null };
  elements["catalog-search"].value = "";
  for (const id of ["level-filter", "role-filter", "phase-filter", "status-filter"]) {
    elements[id].value = "";
  }
  elements["catalog-sort"].value = "id:asc";
  const requested = options.useLocation === true
    ? requestedGraphState(presentation, state.selection)
    : { focusId: defaultFocusId(presentation), depth: 1, direction: "both" };
  state.focusId = requested.focusId;
  state.selectedId = requested.focusId;
  state.depth = requested.depth;
  state.direction = requested.direction;
  elements["window-model-id"].textContent = manifest.model.id;
  elements["model-name"].textContent = manifest.model.name;
  elements["model-version"].textContent = manifest.model.version;
  elements["node-count"].textContent = String(descriptor.statistics.nodeCount);
  elements["edge-count"].textContent = String(descriptor.statistics.edgeCount);
  elements["root-hash"].textContent = shortenedHash(manifest.rootHash);
  elements["root-hash"].title = manifest.rootHash;
  elements["records-title-label"].textContent = metadata.labels.catalogTitle;
  elements["catalog-search"].placeholder = metadata.labels.searchPlaceholder;
  elements["parents-title-label"].textContent = metadata.labels.parents;
  elements["children-title-label"].textContent = metadata.labels.children;
  elements["model-boundary-title"].textContent = metadata.boundary.title;
  elements["model-boundary-summary"].textContent = metadata.boundary.summary;
  elements["model-boundary-note"].textContent = metadata.boundary.note;
  configureFacet("level-filter", descriptor.facets.levels, "All levels", metadata.labels.levelFilter);
  configureFacet("role-filter", descriptor.facets.typeRoles, "All types", metadata.labels.typeFilter);
  configureFacet("phase-filter", descriptor.facets.phases, "All phases", metadata.labels.phaseFilter);
  configureFacet("status-filter", descriptor.facets.scientificStatuses, "All statuses", metadata.labels.statusFilter);
  if (state.selection === null) selectLocalOption(manifest);
  else selectRegisteredOption(state.selection);
  render();
  previousPresentation?.close();
  replaceLocationState();
  document.body.dataset.presentation = "lazy";
  document.body.dataset.modelSource = options.modelSource ?? "registry";
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = options.loadMessage ?? "Model verified";
  elements["rdf-import-open"].disabled = false;
  elements["model-selector"].disabled = false;
}

function selectedFile(id, label) {
  const file = elements[id].files?.[0];
  if (!file) throw new Error(`${label} is required.`);
  return file;
}

function assertFileSize(file, maximum, label) {
  if (file.size > maximum) {
    throw new Error(`${label} exceeds the ${maximum}-byte local import limit.`);
  }
}

function setImportStatus(message, tone = "progress") {
  elements["rdf-import-status"].textContent = message;
  elements["rdf-import-status"].dataset.tone = tone;
}

function importErrorText(error) {
  const message = error instanceof Error ? error.message : String(error);
  return typeof error?.code === "string" ? `${error.code}: ${message}` : message;
}

async function importRdfMapping() {
  const dataFile = selectedFile("rdf-data-file", "Data graph");
  const shapesFile = selectedFile("rdf-shapes-file", "SHACL shapes");
  const policyFile = selectedFile("rdf-policy-file", "Mapping policy");
  assertFileSize(dataFile, RDF_IMPORT_LIMITS.maxBytes, "Data graph");
  assertFileSize(shapesFile, RDF_IMPORT_LIMITS.maxBytes, "SHACL shapes");
  assertFileSize(policyFile, MAX_POLICY_BYTES, "Mapping policy");
  setImportStatus("Reading the exact local input set...");
  const [dataBytes, shapesBytes, policyText] = await Promise.all([
    dataFile.arrayBuffer(),
    shapesFile.arrayBuffer(),
    policyFile.text()
  ]);
  let policyJson;
  try {
    policyJson = JSON.parse(policyText);
  } catch {
    throw new Error("Mapping policy is not valid JSON.");
  }
  const policy = verifyRdfMappingPolicy(policyJson);
  setImportStatus("Importing N-Triples and validating SHACL...");
  const data = importNTriples(dataBytes, { sourceId: policy.inputs.dataSourceId });
  const shapes = importNTriples(shapesBytes, { sourceId: policy.inputs.shapesSourceId });
  const report = validateShacl(data, shapes);
  if (!report.conforms) {
    throw new Error(`SHACL validation rejected the data with ${report.statistics.violationCount} violation(s).`);
  }
  setImportStatus("Verifying the mapping and constructing a Model Pack...");
  const pack = buildRdfMappedModelPack(data, shapes, report, policy, {
    id: policy.id,
    name: policy.provenance.title,
    version: `rdf-${policy.policyHash.slice(7, 19)}`,
    description: policy.provenance.adaptation,
    status: "local-import"
  });
  modelLoadSequence += 1;
  activateModelPack(pack, {
    modelSource: "local-rdf",
    loadMessage: "Local RDF model verified"
  });
  document.body.dataset.registry = "local-import";
  elements["rdf-import-form"].reset();
  elements["rdf-import-dialog"].close();
  setImportStatus("");
}

function defaultFocusId(presentation = state.presentation) {
  const first = presentation?.catalog({ offset: 0, limit: 1 }).items[0];
  if (!first) throw new Error("The verified Model Pack does not contain a graph node.");
  return first.id;
}

function requestedGraphState(presentation = state.presentation, selection = state.selection) {
  const parameters = new URLSearchParams(location.hash.slice(1));
  const identity = selection ?? {
    modelId: state.manifest.model.id,
    version: state.manifest.model.version
  };
  return requestedWorkspaceState(
    parameters,
    identity,
    (id) => presentation.has(id),
    defaultFocusId(presentation)
  );
}

function replaceLocationState() {
  const identity = state.selection ?? {
    modelId: state.manifest.model.id,
    version: state.manifest.model.version
  };
  const parameters = new URLSearchParams({
    model: identity.modelId,
    version: identity.version,
    node: state.focusId,
    depth: String(state.depth),
    direction: state.direction
  });
  const nextHash = parameters.toString();
  if (location.hash.slice(1) !== nextHash) history.replaceState(null, "", `#${nextHash}`);
}

async function restoreLocationState() {
  if (state.registrySnapshot === null) return;
  const parameters = new URLSearchParams(location.hash.slice(1));
  const requestedEntry = requestedRegistryEntry(
    state.registrySnapshot.registry.entries,
    parameters
  );
  if (
    state.selection === null
    || modelSelectionKey(requestedEntry) !== modelSelectionKey(state.selection)
  ) {
    await openRegisteredModel(requestedEntry, { useLocation: true });
    return;
  }
  const requested = requestedGraphState();
  state.depth = requested.depth;
  state.direction = requested.direction;
  focusNode(requested.focusId, false);
}

function bindEvents() {
  for (const id of ["catalog-search", "level-filter", "role-filter", "phase-filter", "status-filter", "catalog-sort"]) {
    const eventName = id === "catalog-search" ? "input" : "change";
    elements[id].addEventListener(eventName, () => renderCatalog({ reset: true }));
  }
  elements["catalog-more"].addEventListener("click", () => renderCatalog({ loadMore: true }));
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
    state.catalog.key = null;
    focusNode(defaultFocusId());
  });
  elements["rdf-import-open"].addEventListener("click", () => {
    setImportStatus("");
    elements["rdf-import-dialog"].showModal();
    elements["rdf-data-file"].focus();
  });
  const closeImportDialog = () => elements["rdf-import-dialog"].close();
  elements["rdf-import-close"].addEventListener("click", closeImportDialog);
  elements["rdf-import-cancel"].addEventListener("click", closeImportDialog);
  elements["rdf-import-form"].addEventListener("submit", async (event) => {
    event.preventDefault();
    elements["rdf-import-submit"].disabled = true;
    try {
      await importRdfMapping();
    } catch (error) {
      setImportStatus(importErrorText(error), "error");
    } finally {
      elements["rdf-import-submit"].disabled = false;
    }
  });
  elements["model-selector"].addEventListener("change", async () => {
    const previousKey = state.selection === null ? LOCAL_MODEL_OPTION : modelSelectionKey(state.selection);
    const selection = registryEntryForKey(
      state.registrySnapshot.registry.entries,
      elements["model-selector"].value
    );
    if (selection === null) {
      elements["model-selector"].value = previousKey;
      return;
    }
    try {
      await openRegisteredModel(selection);
    } catch (error) {
      elements["model-selector"].value = previousKey;
      displaySwitchError(error);
    }
  });
  window.addEventListener("hashchange", () => {
    restoreLocationState().catch(displaySwitchError);
  });
}

function displayError(error) {
  document.body.dataset.state = "error";
  elements["load-state"].textContent = "Model load failed";
  elements["graph-title"].textContent = "Could not load the model";
  elements["graph-message"].hidden = false;
  elements["graph-message"].textContent = error instanceof Error ? error.message : String(error);
  console.error(error);
}

function displaySwitchError(error) {
  if (state.presentation === null) {
    displayError(error);
    return;
  }
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = "Model switch failed";
  elements["graph-message"].hidden = false;
  elements["graph-message"].textContent = error instanceof Error ? error.message : String(error);
  elements["model-selector"].disabled = false;
  console.error(error);
}

function isWorkerOperationalFailure(error) {
  return typeof error?.code === "string" && error.code.startsWith("MODEL_PACK_WORKER_");
}

function isCacheStorageFailure(error) {
  return typeof error?.code === "string" && (
    error.code.startsWith("MODEL_PACK_CACHE_STORAGE_")
    || error.code.startsWith("MODEL_PACK_CACHE_INDEXEDDB_")
  );
}

async function loadThroughVerifiedCache(resolution, loader, verifyBundle = loadModelPackBundle) {
  const identity = Object.freeze({
    rootHash: resolution.rootHash,
    manifestHash: resolution.manifestHash
  });
  const loadBoundPack = async () => matchModelPackRegistryResolution(
    await loader(),
    resolution
  );
  const verifyBoundBundle = async (source) => matchModelPackRegistryResolution(
    await verifyBundle(source),
    resolution
  );
  let cache;
  try {
    const storage = createIndexedDbModelPackCacheStorage({
      databaseName: MODEL_CACHE_OPTIONS.databaseName
    });
    cache = createVerifiedModelPackCache(storage, {
      verifyBundle: verifyBoundBundle,
      maxEntries: MODEL_CACHE_OPTIONS.maxEntries,
      maxTotalBytes: MODEL_CACHE_OPTIONS.maxTotalBytes,
      ownsStorage: true
    });
  } catch (error) {
    if (!isCacheStorageFailure(error)) throw error;
    document.body.dataset.cache = "unavailable";
    return loadBoundPack();
  }

  try {
    const result = await cache.load(identity, loadBoundPack);
    document.body.dataset.cache = result.source === "cache"
      ? "hit"
      : result.cacheState === "invalid" ? "recovered" : "miss";
    return result.pack;
  } catch (error) {
    if (!isCacheStorageFailure(error)) throw error;
    document.body.dataset.cache = "unavailable";
    return loadBoundPack();
  } finally {
    await cache.close();
  }
}

async function loadVerifiedModelPack(resolution) {
  if (typeof Worker !== "function") {
    document.body.dataset.verifier = "main-thread-fallback";
    return loadThroughVerifiedCache(
      resolution,
      () => loadModelPackHttpDirectory(resolution.baseUrl)
    );
  }

  let worker = null;
  let client = null;
  try {
    worker = new Worker(MODEL_PACK_WORKER_URL, {
      type: "module",
      name: "onto2d-model-pack-verifier"
    });
    client = createModelPackWorkerClient(worker, {
      clientId: "model-studio",
      ownsWorker: true,
      requestTimeoutMs: 60_000
    });
    const pack = await loadThroughVerifiedCache(
      resolution,
      () => client.loadHttpDirectory(resolution.baseUrl),
      (source) => client.loadBundle(source, { transfer: "move" })
    );
    document.body.dataset.verifier = "worker";
    return pack;
  } catch (error) {
    if (client !== null && !isWorkerOperationalFailure(error)) throw error;
    document.body.dataset.verifier = "main-thread-fallback";
    return loadThroughVerifiedCache(
      resolution,
      () => loadModelPackHttpDirectory(resolution.baseUrl)
    );
  } finally {
    if (client !== null) {
      client.close();
    } else if (worker !== null) {
      worker.terminate();
    }
  }
}

async function openRegisteredModel(selection, { useLocation = false } = {}) {
  if (state.registrySnapshot === null) {
    throw new Error("The verified Model Pack registry is not loaded.");
  }
  const sequence = ++modelLoadSequence;
  elements["model-selector"].disabled = true;
  elements["load-state"].textContent = "Verifying selected model";
  if (state.presentation === null) document.body.dataset.state = "loading";
  const resolution = resolveModelPackRegistry(
    state.registrySnapshot.registry,
    state.registrySnapshot.registryUrl,
    { modelId: selection.modelId, version: selection.version },
    { expectedRegistryHash: EXPECTED_REGISTRY_HASH }
  );
  const pack = await loadVerifiedModelPack(resolution);
  if (sequence !== modelLoadSequence) return false;
  document.body.dataset.registry = resolution.registryTrust;
  activateModelPack(pack, {
    resolution,
    useLocation,
    modelSource: "registry",
    loadMessage: document.body.dataset.cache === "hit"
      ? "Cached model verified"
      : "Model verified"
  });
  return true;
}

async function start() {
  const snapshot = await loadModelPackRegistryHttp(
    MODEL_REGISTRY_URL,
    { expectedRegistryHash: EXPECTED_REGISTRY_HASH }
  );
  state.registrySnapshot = snapshot;
  document.body.dataset.registry = snapshot.registryTrust;
  populateRegistrySelector(snapshot);
  const selection = requestedRegistryEntry(
    snapshot.registry.entries,
    new URLSearchParams(location.hash.slice(1))
  );
  await openRegisteredModel(selection, { useLocation: true });
  bindEvents();
}

start().catch(displayError);
