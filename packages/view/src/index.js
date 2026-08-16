export const VIEW_VERSION = "0.1.0";
export const CATALOG_SORTS = Object.freeze(["id", "name", "level", "degree"]);
export const NEIGHBORHOOD_DIRECTIONS = Object.freeze(["both", "parents", "children"]);

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAXIMUM_NODES = 100000;
const MAXIMUM_EDGES = 1000000;

export class ViewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ViewError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new ViewError(code, message, details);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, name) {
  if (!isPlainObject(value)) fail("VIEW_INPUT_INVALID", `${name} must be a plain object.`, { name });
  return value;
}

function requireIdentifier(value, name) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 1024
    || FORBIDDEN_KEYS.has(value)
  ) {
    fail("VIEW_IDENTIFIER_INVALID", `${name} must be a safe, non-empty bounded string.`, { name });
  }
  return value;
}

function cloneJson(value, name, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (ancestors.has(value)) fail("VIEW_INPUT_INVALID", `${name} must be acyclic JSON.`, { name });
    ancestors.add(value);
    const result = value.map((item, index) => cloneJson(item, `${name}[${index}]`, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (!isPlainObject(value)) fail("VIEW_INPUT_INVALID", `${name} must contain JSON values.`, { name });
  if (ancestors.has(value)) fail("VIEW_INPUT_INVALID", `${name} must be acyclic JSON.`, { name });
  ancestors.add(value);
  const result = {};
  for (const key of Object.keys(value).sort(compareText)) {
    if (FORBIDDEN_KEYS.has(key)) {
      fail("VIEW_INPUT_INVALID", `${name} contains a prototype-sensitive key.`, { name, key });
    }
    result[key] = cloneJson(value[key], `${name}.${key}`, ancestors);
  }
  ancestors.delete(value);
  return result;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requireArray(value, name, maximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    fail("VIEW_INPUT_INVALID", `${name} must be a bounded array.`, { name, maximum });
  }
  return value;
}

function facetKey(value) {
  if (value === null) return "null:";
  return `${typeof value}:${String(value)}`;
}

function scalarValue(value, name) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  fail("VIEW_FILTER_INVALID", `${name} must contain scalar JSON values.`, { name });
}

function normalizeGraph(input) {
  const graph = requirePlainObject(input, "input");
  const suppliedNodes = requireArray(graph.nodes, "input.nodes", MAXIMUM_NODES);
  const suppliedEdges = requireArray(graph.edges, "input.edges", MAXIMUM_EDGES);
  const nodeIds = new Set();
  const nodes = suppliedNodes.map((entry, index) => {
    const node = cloneJson(requirePlainObject(entry, `input.nodes[${index}]`), `input.nodes[${index}]`);
    const id = requireIdentifier(node.id, `input.nodes[${index}].id`);
    if (nodeIds.has(id)) fail("VIEW_NODE_DUPLICATE", "Node identifiers must be unique.", { id });
    nodeIds.add(id);
    return node;
  }).sort((left, right) => compareText(left.id, right.id));
  const edgeIds = new Set();
  const edges = suppliedEdges.map((entry, index) => {
    const edge = cloneJson(requirePlainObject(entry, `input.edges[${index}]`), `input.edges[${index}]`);
    const id = requireIdentifier(edge.id, `input.edges[${index}].id`);
    const source = requireIdentifier(edge.source, `input.edges[${index}].source`);
    const target = requireIdentifier(edge.target, `input.edges[${index}].target`);
    if (edgeIds.has(id)) fail("VIEW_EDGE_DUPLICATE", "Edge identifiers must be unique.", { id });
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      fail("VIEW_EDGE_ENDPOINT_MISSING", "Every edge endpoint must resolve to a node.", {
        id,
        source,
        target
      });
    }
    edgeIds.add(id);
    return edge;
  }).sort((left, right) => compareText(left.id, right.id));
  return { nodes, edges };
}

function createFacet(nodes, field) {
  const counts = new Map();
  for (const node of nodes) {
    if (node[field] === undefined) continue;
    const value = scalarValue(node[field], `node.${field}`);
    const key = facetKey(value);
    if (!counts.has(key)) counts.set(key, { value, count: 0 });
    counts.get(key).count += 1;
  }
  return [...counts.values()].sort((left, right) => {
    if (typeof left.value === "number" && typeof right.value === "number") {
      return left.value - right.value;
    }
    return compareText(String(left.value), String(right.value));
  });
}

function requireBoundedInteger(value, name, minimum, maximum, fallback) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    fail("VIEW_OPTION_INVALID", `${name} must be an integer from ${minimum} to ${maximum}.`, {
      name,
      minimum,
      maximum
    });
  }
  return result;
}

function normalizeFilterList(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 256) {
    fail("VIEW_FILTER_INVALID", `${name} must be a bounded array.`, { name });
  }
  const result = new Map();
  for (const item of value) {
    const scalar = scalarValue(item, name);
    result.set(facetKey(scalar), scalar);
  }
  return [...result.values()].sort((left, right) => compareText(facetKey(left), facetKey(right)));
}

function summary(node, incoming, outgoing) {
  const parentIds = new Set(incoming.map((edge) => edge.source));
  const childIds = new Set(outgoing.map((edge) => edge.target));
  return {
    id: node.id,
    name: typeof node.name === "string" ? node.name : node.id,
    level: node.level ?? null,
    phase: node.phase ?? null,
    typeRole: node.typeRole ?? null,
    scientificStatus: node.scientificStatus ?? null,
    shortDescription: typeof node.shortDescription === "string" ? node.shortDescription : "",
    parentCount: parentIds.size,
    childCount: childIds.size,
    incomingEdgeCount: incoming.length,
    outgoingEdgeCount: outgoing.length,
    degree: incoming.length + outgoing.length,
    data: node
  };
}

function catalogComparator(sort, order) {
  const direction = order === "desc" ? -1 : 1;
  return (left, right) => {
    let result = 0;
    if (sort === "degree") result = left.degree - right.degree;
    if (sort === "level") {
      const leftLevel = typeof left.level === "number" ? left.level : Number.POSITIVE_INFINITY;
      const rightLevel = typeof right.level === "number" ? right.level : Number.POSITIVE_INFINITY;
      result = leftLevel - rightLevel;
    }
    if (sort === "name") result = compareText(left.name.toLowerCase(), right.name.toLowerCase());
    if (sort === "id") result = compareText(left.id, right.id);
    if (result === 0) result = compareText(left.id, right.id);
    return result * direction;
  };
}

function distances(start, adjacency, depth) {
  const result = new Map([[start, 0]]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentDistance = result.get(current);
    if (currentDistance >= depth) continue;
    for (const next of adjacency.get(current)) {
      if (result.has(next)) continue;
      result.set(next, currentDistance + 1);
      queue.push(next);
    }
  }
  return result;
}

function relationFor(id, focusId, upstream, downstream) {
  if (id === focusId) return "focus";
  const hasUpstream = upstream.has(id);
  const hasDownstream = downstream.has(id);
  if (hasUpstream && hasDownstream) return "both";
  return hasUpstream ? "parent" : "child";
}

function relationPriority(relation) {
  return { focus: 0, parent: 1, child: 2, both: 3 }[relation];
}

export class ModelView {
  #nodes;
  #edges;
  #nodesById;
  #incoming;
  #outgoing;
  #parents;
  #children;
  #summaries;
  #facets;

  constructor(input) {
    const graph = normalizeGraph(input);
    this.#nodes = graph.nodes;
    this.#edges = graph.edges;
    this.#nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    this.#incoming = new Map(graph.nodes.map((node) => [node.id, []]));
    this.#outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
    this.#parents = new Map(graph.nodes.map((node) => [node.id, new Set()]));
    this.#children = new Map(graph.nodes.map((node) => [node.id, new Set()]));
    for (const edge of graph.edges) {
      this.#incoming.get(edge.target).push(edge);
      this.#outgoing.get(edge.source).push(edge);
      this.#parents.get(edge.target).add(edge.source);
      this.#children.get(edge.source).add(edge.target);
    }
    this.#parents = new Map([...this.#parents].map(([id, values]) => [id, [...values].sort(compareText)]));
    this.#children = new Map([...this.#children].map(([id, values]) => [id, [...values].sort(compareText)]));
    this.#summaries = new Map(graph.nodes.map((node) => [
      node.id,
      deepFreeze(summary(node, this.#incoming.get(node.id), this.#outgoing.get(node.id)))
    ]));
    this.#facets = deepFreeze({
      levels: createFacet(graph.nodes, "level"),
      phases: createFacet(graph.nodes, "phase"),
      typeRoles: createFacet(graph.nodes, "typeRole"),
      scientificStatuses: createFacet(graph.nodes, "scientificStatus")
    });
    deepFreeze(this.#nodes);
    deepFreeze(this.#edges);
    Object.freeze(this);
  }

  get statistics() {
    return Object.freeze({ nodeCount: this.#nodes.length, edgeCount: this.#edges.length });
  }

  get facets() {
    return this.#facets;
  }

  get(id) {
    const identifier = requireIdentifier(id, "id");
    return this.#summaries.get(identifier);
  }

  catalog(options = {}) {
    const value = requirePlainObject(options, "options");
    const search = value.search ?? "";
    if (typeof search !== "string" || search.length > 256) {
      fail("VIEW_FILTER_INVALID", "options.search must be a bounded string.");
    }
    const query = search.trim().toLowerCase();
    const levels = normalizeFilterList(value.levels, "options.levels");
    const phases = normalizeFilterList(value.phases, "options.phases");
    const typeRoles = normalizeFilterList(value.typeRoles, "options.typeRoles");
    const scientificStatuses = normalizeFilterList(
      value.scientificStatuses,
      "options.scientificStatuses"
    );
    const sort = value.sort ?? "id";
    const order = value.order ?? (sort === "degree" ? "desc" : "asc");
    if (!CATALOG_SORTS.includes(sort)) fail("VIEW_OPTION_INVALID", "options.sort is not supported.", { sort });
    if (!["asc", "desc"].includes(order)) fail("VIEW_OPTION_INVALID", "options.order is not supported.", { order });
    const offset = requireBoundedInteger(value.offset, "options.offset", 0, this.#nodes.length, 0);
    const limit = requireBoundedInteger(value.limit, "options.limit", 1, 10000, 100);
    const sets = {
      level: new Set(levels.map(facetKey)),
      phase: new Set(phases.map(facetKey)),
      typeRole: new Set(typeRoles.map(facetKey)),
      scientificStatus: new Set(scientificStatuses.map(facetKey))
    };
    const matchesFacet = (node, field) => (
      sets[field].size === 0 || sets[field].has(facetKey(node[field] ?? null))
    );
    const matchesSearch = (node) => (
      query.length === 0
      || [node.id, node.name, node.shortDescription]
        .some((candidate) => candidate.toLowerCase().includes(query))
    );
    const matching = [...this.#summaries.values()].filter((node) => (
      matchesSearch(node)
      && matchesFacet(node, "level")
      && matchesFacet(node, "phase")
      && matchesFacet(node, "typeRole")
      && matchesFacet(node, "scientificStatus")
    )).sort(catalogComparator(sort, order));
    return deepFreeze({
      query: {
        search: search.trim(),
        levels,
        phases,
        typeRoles,
        scientificStatuses,
        sort,
        order
      },
      total: this.#nodes.length,
      matching: matching.length,
      offset,
      limit,
      items: matching.slice(offset, offset + limit)
    });
  }

  neighborhood(options) {
    const value = requirePlainObject(options, "options");
    const focusId = requireIdentifier(value.focusId, "options.focusId");
    if (!this.#nodesById.has(focusId)) {
      fail("VIEW_FOCUS_MISSING", "The focus node does not exist.", { focusId });
    }
    const depth = requireBoundedInteger(value.depth, "options.depth", 0, 4, 1);
    const maxNodes = requireBoundedInteger(value.maxNodes, "options.maxNodes", 1, 500, 60);
    const maxEdges = requireBoundedInteger(value.maxEdges, "options.maxEdges", 0, 2000, 240);
    const direction = value.direction ?? "both";
    if (!NEIGHBORHOOD_DIRECTIONS.includes(direction)) {
      fail("VIEW_OPTION_INVALID", "options.direction is not supported.", { direction });
    }
    const upstream = direction === "children"
      ? new Map([[focusId, 0]])
      : distances(focusId, this.#parents, depth);
    const downstream = direction === "parents"
      ? new Map([[focusId, 0]])
      : distances(focusId, this.#children, depth);
    const discoveredIds = new Set([...upstream.keys(), ...downstream.keys()]);
    const ranked = [...discoveredIds].map((id) => {
      const relation = relationFor(id, focusId, upstream, downstream);
      const upstreamDistance = upstream.get(id) ?? null;
      const downstreamDistance = downstream.get(id) ?? null;
      const distance = Math.min(
        upstreamDistance ?? Number.POSITIVE_INFINITY,
        downstreamDistance ?? Number.POSITIVE_INFINITY
      );
      return {
        ...this.#summaries.get(id),
        relation,
        distance,
        upstreamDistance,
        downstreamDistance
      };
    }).sort((left, right) => (
      left.distance - right.distance
      || relationPriority(left.relation) - relationPriority(right.relation)
      || right.degree - left.degree
      || compareText(left.id, right.id)
    ));
    const nodes = ranked.slice(0, maxNodes);
    const displayedIds = new Set(nodes.map((node) => node.id));
    const discoveredEdges = this.#edges.filter((edge) => (
      discoveredIds.has(edge.source) && discoveredIds.has(edge.target)
    ));
    const candidateEdges = discoveredEdges.filter((edge) => (
      displayedIds.has(edge.source) && displayedIds.has(edge.target)
    )).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relationLayer: edge.relationLayer ?? null,
      dependencyType: edge.dependencyType ?? null,
      necessity: edge.necessity ?? null,
      weight: edge.weight ?? null,
      data: edge
    })).sort((left, right) => {
      const leftFocus = left.source === focusId || left.target === focusId ? 0 : 1;
      const rightFocus = right.source === focusId || right.target === focusId ? 0 : 1;
      return leftFocus - rightFocus || compareText(left.id, right.id);
    });
    const edges = candidateEdges.slice(0, maxEdges);
    return deepFreeze({
      query: { focusId, depth, direction, maxNodes, maxEdges },
      focus: this.#summaries.get(focusId),
      adjacent: {
        parents: this.#parents.get(focusId),
        children: this.#children.get(focusId)
      },
      nodes,
      edges,
      counts: {
        discoveredNodeCount: discoveredIds.size,
        displayedNodeCount: nodes.length,
        hiddenNodeCount: discoveredIds.size - nodes.length,
        availableEdgeCount: discoveredEdges.length,
        displayedEdgeCount: edges.length,
        hiddenEdgeCount: discoveredEdges.length - edges.length
      },
      truncated: discoveredIds.size > nodes.length || discoveredEdges.length > edges.length
    });
  }
}

export function createModelView(input) {
  return new ModelView(input);
}

function round(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function pointText(value) {
  return String(round(value));
}

function assignLayers(nodes) {
  const layers = new Map([[nodes.find((node) => node.relation === "focus").id, 0]]);
  const ties = new Map();
  for (const node of nodes) {
    if (node.relation === "focus") continue;
    if (node.relation === "parent") layers.set(node.id, -node.distance);
    if (node.relation === "child") layers.set(node.id, node.distance);
    if (node.relation === "both") {
      if (node.upstreamDistance < node.downstreamDistance) layers.set(node.id, -node.upstreamDistance);
      else if (node.downstreamDistance < node.upstreamDistance) layers.set(node.id, node.downstreamDistance);
      else {
        if (!ties.has(node.distance)) ties.set(node.distance, []);
        ties.get(node.distance).push(node.id);
      }
    }
  }
  for (const [distance, identifiers] of ties) {
    identifiers.sort(compareText).forEach((id, index) => {
      layers.set(id, index % 2 === 0 ? -distance : distance);
    });
  }
  return layers;
}

function edgeRoute(edge, positions, radius, offset) {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (edge.source === edge.target) {
    const x = source.x;
    const y = source.y;
    const spread = radius * 1.65 + Math.abs(offset);
    return {
      path: `M ${pointText(x + radius * 0.55)} ${pointText(y - radius * 0.78)} C ${pointText(x + spread)} ${pointText(y - spread * 1.6)} ${pointText(x - spread)} ${pointText(y - spread * 1.6)} ${pointText(x - radius * 0.55)} ${pointText(y - radius * 0.78)}`,
      labelX: round(x),
      labelY: round(y - spread * 1.55)
    };
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const unitX = dx / length;
  const unitY = dy / length;
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const endpointInset = radius + 3;
  const startX = source.x + unitX * endpointInset;
  const startY = source.y + unitY * endpointInset;
  const endX = target.x - unitX * (endpointInset + 5);
  const endY = target.y - unitY * (endpointInset + 5);
  const controlX = (startX + endX) / 2 + perpendicularX * offset;
  const controlY = (startY + endY) / 2 + perpendicularY * offset;
  return {
    path: `M ${pointText(startX)} ${pointText(startY)} Q ${pointText(controlX)} ${pointText(controlY)} ${pointText(endX)} ${pointText(endY)}`,
    labelX: round(controlX),
    labelY: round(controlY)
  };
}

export function layoutNeighborhood(projection, options = {}) {
  const graph = cloneJson(requirePlainObject(projection, "projection"), "projection");
  const value = requirePlainObject(options, "options");
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !isPlainObject(graph.query)) {
    fail("VIEW_PROJECTION_INVALID", "projection must be a neighborhood projection.");
  }
  if (graph.nodes.length === 0 || graph.nodes.length > 500 || graph.edges.length > 2000) {
    fail("VIEW_PROJECTION_INVALID", "projection exceeds neighborhood bounds.");
  }
  const focusId = requireIdentifier(graph.query.focusId, "projection.query.focusId");
  if (!NEIGHBORHOOD_DIRECTIONS.includes(graph.query.direction)) {
    fail("VIEW_PROJECTION_INVALID", "projection.query.direction is not supported.");
  }
  requireBoundedInteger(graph.query.depth, "projection.query.depth", 0, 4, 1);
  const nodeIds = new Set();
  for (const [index, node] of graph.nodes.entries()) {
    requirePlainObject(node, `projection.nodes[${index}]`);
    const id = requireIdentifier(node.id, `projection.nodes[${index}].id`);
    if (nodeIds.has(id)) fail("VIEW_PROJECTION_INVALID", "Projection node identifiers must be unique.", { id });
    if (!["focus", "parent", "child", "both"].includes(node.relation)) {
      fail("VIEW_PROJECTION_INVALID", "Projection node relation is not supported.", { id });
    }
    if (!Number.isSafeInteger(node.distance) || node.distance < 0 || node.distance > 4) {
      fail("VIEW_PROJECTION_INVALID", "Projection node distance is invalid.", { id });
    }
    for (const field of ["upstreamDistance", "downstreamDistance"]) {
      if (node[field] !== null && (!Number.isSafeInteger(node[field]) || node[field] < 0 || node[field] > 4)) {
        fail("VIEW_PROJECTION_INVALID", `Projection node ${field} is invalid.`, { id });
      }
    }
    if (node.relation === "focus" && (id !== focusId || node.distance !== 0)) {
      fail("VIEW_PROJECTION_INVALID", "Projection focus metadata is inconsistent.", { id, focusId });
    }
    if (node.relation === "parent" && node.upstreamDistance === null) {
      fail("VIEW_PROJECTION_INVALID", "Parent nodes require upstreamDistance.", { id });
    }
    if (node.relation === "child" && node.downstreamDistance === null) {
      fail("VIEW_PROJECTION_INVALID", "Child nodes require downstreamDistance.", { id });
    }
    if (node.relation === "both" && (node.upstreamDistance === null || node.downstreamDistance === null)) {
      fail("VIEW_PROJECTION_INVALID", "Bidirectional nodes require both distances.", { id });
    }
    nodeIds.add(id);
  }
  if (!nodeIds.has(focusId) || graph.nodes.filter((node) => node.relation === "focus").length !== 1) {
    fail("VIEW_PROJECTION_INVALID", "projection must contain its focus node.");
  }
  const edgeIds = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    requirePlainObject(edge, `projection.edges[${index}]`);
    const id = requireIdentifier(edge.id, `projection.edges[${index}].id`);
    const source = requireIdentifier(edge.source, `projection.edges[${index}].source`);
    const target = requireIdentifier(edge.target, `projection.edges[${index}].target`);
    if (edgeIds.has(id) || !nodeIds.has(source) || !nodeIds.has(target)) {
      fail("VIEW_PROJECTION_INVALID", "Projection edges must be unique and resolve locally.", {
        id,
        source,
        target
      });
    }
    edgeIds.add(id);
  }
  const width = requireBoundedInteger(value.width, "options.width", 320, 4096, 960);
  const height = requireBoundedInteger(value.height, "options.height", 240, 4096, 620);
  const padding = requireBoundedInteger(value.padding, "options.padding", 16, 256, 54);
  const nodeRadius = requireBoundedInteger(value.nodeRadius, "options.nodeRadius", 12, 64, 23);
  if (padding * 2 + nodeRadius * 2 >= width || padding * 2 + nodeRadius * 2 >= height) {
    fail("VIEW_OPTION_INVALID", "Layout padding and node radius leave no drawable area.");
  }
  const layerById = assignLayers(graph.nodes);
  const columns = new Map();
  for (const node of graph.nodes) {
    const layer = layerById.get(node.id);
    if (!columns.has(layer)) columns.set(layer, []);
    columns.get(layer).push(node);
  }
  for (const column of columns.values()) column.sort((left, right) => compareText(left.id, right.id));
  const drawableWidth = width - padding * 2 - nodeRadius * 2;
  const drawableHeight = height - padding * 2 - nodeRadius * 2;
  const minimumNodeGap = nodeRadius * 2 + 18;
  const maximumRows = Math.max(1, Math.floor(drawableHeight / minimumNodeGap) + 1);
  const layerPlans = [...columns].sort((left, right) => left[0] - right[0]).map(([layer, column]) => ({
    layer,
    column,
    laneCount: Math.max(1, Math.ceil(column.length / maximumRows))
  }));
  const totalLanes = layerPlans.reduce((sum, plan) => sum + plan.laneCount, 0);
  let laneCursor = 0;
  const positioned = [];
  for (const plan of layerPlans) {
    const rowCount = Math.ceil(plan.column.length / plan.laneCount);
    for (let index = 0; index < plan.column.length; index += 1) {
      const lane = index % plan.laneCount;
      const row = Math.floor(index / plan.laneCount);
      const globalLane = laneCursor + lane;
      const x = totalLanes === 1
        ? width / 2
        : padding + nodeRadius + (globalLane / (totalLanes - 1)) * drawableWidth;
      const y = rowCount === 1
        ? height / 2
        : padding + nodeRadius + (row / (rowCount - 1)) * drawableHeight;
      positioned.push({
        ...plan.column[index],
        layer: plan.layer,
        x: round(x),
        y: round(y)
      });
    }
    laneCursor += plan.laneCount;
  }
  const positions = new Map(positioned.map((node) => [node.id, node]));
  const pairGroups = new Map();
  for (const edge of graph.edges) {
    const pair = [edge.source, edge.target].sort(compareText).join("\u0000");
    if (!pairGroups.has(pair)) pairGroups.set(pair, []);
    pairGroups.get(pair).push(edge);
  }
  const edges = [];
  for (const group of pairGroups.values()) {
    group.sort((left, right) => compareText(left.id, right.id));
    group.forEach((edge, index) => {
      const offset = (index - (group.length - 1) / 2) * 15;
      edges.push({ ...edge, ...edgeRoute(edge, positions, nodeRadius, offset) });
    });
  }
  edges.sort((left, right) => compareText(left.id, right.id));
  positioned.sort((left, right) => compareText(left.id, right.id));
  return deepFreeze({
    width,
    height,
    nodeRadius,
    focusId,
    nodes: positioned,
    edges
  });
}
