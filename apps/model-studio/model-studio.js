import {
  loadModelPackBundle,
  loadModelPackHttpDirectory
} from "../../packages/model-pack/src/browser.js?v=20260816.17";
import {
  createIndexedDbModelPackCacheStorage,
  createVerifiedModelPackCache
} from "../../packages/model-pack/src/cache.js?v=20260816.17";
import {
  matchModelPackRegistryResolution,
  resolveModelPackRegistryHttp
} from "../../packages/model-pack/src/registry.js?v=20260816.17";
import { createModelPackWorkerClient } from "../../packages/model-pack/src/worker.js?v=20260816.17";
import { RDF_IMPORT_LIMITS, importNTriples } from "../../packages/rdf-import/src/index.js?v=20260816.17";
import {
  buildRdfMappedModelPack,
  verifyRdfMappingPolicy
} from "../../packages/rdf-mapping/src/index.js?v=20260816.17";
import { validateShacl } from "../../packages/shacl-validation/src/index.js?v=20260816.17";
import { createVerifiedModelPresentation } from "../../packages/engine/src/presentation.js?v=20260816.17";
import { layoutNeighborhood } from "../../packages/view/src/index.js?v=20260816.17";
import { graphHighlight } from "./graph-interactions.js?v=20260816.17";

const MODEL_REGISTRY_URL = new URL("../../models/registry.json", import.meta.url);
const MODEL_PACK_WORKER_URL = new URL(
  "../../assets/js/model-pack-worker.js?v=20260816.17",
  import.meta.url
);
const MODEL_SELECTION = Object.freeze({
  modelId: "causal-emergence",
  version: "2026.08.15"
});
const EXPECTED_REGISTRY_HASH = "sha256:11a8245635b36395d814f37ca35d2a35e28ce8d78eb19fa89c6b3da8d73759a6";
const MODEL_CACHE_OPTIONS = Object.freeze({
  databaseName: "onto2d-model-studio-cache-v1",
  maxEntries: 4,
  maxTotalBytes: 128 * 1024 * 1024
});
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const DEFAULT_FOCUS = "0.0";
const GRAPH_LIMITS = Object.freeze({ maxNodes: 48, maxEdges: 180 });
const CATALOG_PAGE_SIZE = 60;
const MAX_POLICY_BYTES = 512 * 1024;

const ids = [
  "model-name", "model-version", "node-count", "edge-count", "root-hash", "load-state",
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
  "model-boundary-note"
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
for (const [id, element] of Object.entries(elements)) {
  if (!element) throw new Error(`Model Studio markup is missing #${id}.`);
}

const state = {
  presentation: null,
  manifest: null,
  focusId: DEFAULT_FOCUS,
  selectedId: DEFAULT_FOCUS,
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

function compactNodeId(value) {
  const id = String(value);
  const fragment = id.match(/[#/]([^#/]+)$/)?.[1] ?? id;
  return fragment.length > 9 ? `${fragment.slice(0, 8)}.` : fragment;
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

function currentCatalogQuery() {
  const [sort, order] = elements["catalog-sort"].value.split(":");
  return {
    search: elements["catalog-search"].value,
    levels: selectNumericValue(elements["level-filter"]),
    phases: selectValue(elements["phase-filter"]),
    typeRoles: selectValue(elements["role-filter"]),
    scientificStatuses: selectValue(elements["status-filter"]),
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
    label.textContent = compactNodeId(node.id);
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

function renderRelationList(container, nodes, emptyText) {
  if (nodes.length === 0) {
    container.replaceChildren(createElement("p", "relation-empty", emptyText));
    return;
  }
  const buttons = nodes.map((node) => {
    const button = createElement("button", "relation-item");
    button.type = "button";
    button.title = "Click to inspect";
    button.append(createElement("code", "", node.id), createElement("span", "", node.name));
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
  elements["selected-coordinate"].textContent = `Level ${scalarLabel(node.level)} / Phase ${scalarLabel(node.phase)}`;
  elements["selected-name"].textContent = node.name;
  elements["selected-tags"].replaceChildren(
    tag(scalarLabel(node.typeRole), "role"),
    tag(scalarLabel(node.scientificStatus), "status")
  );
  elements["selected-summary"].textContent = node.shortDescription || "No short description is declared for this record.";
  elements["selected-description"].textContent = typeof record.description === "string"
    ? record.description
    : "No full description is declared for this record.";
  elements["selected-record"].textContent = JSON.stringify({
    evidence: record.evidence ?? [],
    requirements: record.requirements ?? {},
    scienceIds: record.scienceIds ?? [],
    localId: record.localId ?? null,
    phaseId: record.phaseId ?? null,
    phaseName: record.phaseName ?? null,
    typeRoleId: record.typeRoleId ?? null,
    levelMeaning: record.levelMeaning ?? null,
    rdfSource: record.rdfSource ?? null
  }, null, 2);
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

function activateModelPack(pack, options = {}) {
  const presentationOptions = options.resolution
    ? { resolution: options.resolution, defaultCatalogPageSize: CATALOG_PAGE_SIZE }
    : { defaultCatalogPageSize: CATALOG_PAGE_SIZE };
  const presentation = createVerifiedModelPresentation(pack, presentationOptions);
  const manifest = pack.manifest;
  const descriptor = presentation.descriptor;
  state.manifest = manifest;
  state.presentation = presentation;
  state.catalog = { key: null, items: [], total: 0, matching: 0, nextOffset: null };
  elements["catalog-search"].value = "";
  for (const id of ["level-filter", "role-filter", "phase-filter", "status-filter"]) {
    elements[id].value = "";
  }
  elements["catalog-sort"].value = "id:asc";
  const requested = options.useLocation === true
    ? requestedGraphState(presentation)
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
  const localRdf = options.modelSource === "local-rdf";
  elements["model-boundary-title"].textContent = localRdf ? "Local RDF boundary" : "Model boundary";
  elements["model-boundary-summary"].textContent = localRdf
    ? "Reviewed mapping projection. Nodes and edges are admitted only by the exact local policy after SHACL conformance."
    : "Transparent source snapshot. Links are preserved source-parent records, not reviewed generative causation.";
  elements["model-boundary-note"].textContent = localRdf
    ? "This in-memory model is not a registry release, is not uploaded, and disappears when the page reloads."
    : "There is only one real Model Pack release. Version comparison remains disabled until reviewed lineage exists.";
  populateSelect(elements["level-filter"], descriptor.facets.levels, "All levels");
  populateSelect(elements["role-filter"], descriptor.facets.typeRoles, "All types");
  populateSelect(elements["phase-filter"], descriptor.facets.phases, "All phases");
  populateSelect(elements["status-filter"], descriptor.facets.scientificStatuses, "All statuses");
  render();
  if (options.useLocation !== true) replaceLocationState();
  document.body.dataset.presentation = "lazy";
  document.body.dataset.modelSource = options.modelSource ?? "registry";
  document.body.dataset.state = "ready";
  elements["load-state"].textContent = options.loadMessage ?? "Model verified";
  elements["rdf-import-open"].disabled = false;
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
  if (presentation?.has(DEFAULT_FOCUS)) return DEFAULT_FOCUS;
  const first = presentation?.catalog({ offset: 0, limit: 1 }).items[0];
  if (!first) throw new Error("The verified Model Pack does not contain a graph node.");
  return first.id;
}

function requestedGraphState(presentation = state.presentation) {
  const parameters = new URLSearchParams(location.hash.slice(1));
  const candidate = parameters.get("node");
  const depth = Number(parameters.get("depth"));
  const direction = parameters.get("direction");
  return {
    focusId: candidate && presentation.has(candidate) ? candidate : defaultFocusId(presentation),
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

async function start() {
  const resolution = await resolveModelPackRegistryHttp(
    MODEL_REGISTRY_URL,
    MODEL_SELECTION,
    { expectedRegistryHash: EXPECTED_REGISTRY_HASH }
  );
  document.body.dataset.registry = resolution.registryTrust;
  const pack = await loadVerifiedModelPack(resolution);
  const manifest = pack.manifest;
  if (
    manifest?.model?.id !== MODEL_SELECTION.modelId
    || manifest?.model?.version !== MODEL_SELECTION.version
  ) {
    throw new Error("The verified Model Pack is not the release expected by Model Studio.");
  }
  activateModelPack(pack, {
    resolution,
    useLocation: true,
    modelSource: "registry",
    loadMessage: document.body.dataset.cache === "hit"
      ? "Cached model verified"
      : "Model verified"
  });
  bindEvents();
}

start().catch(displayError);
