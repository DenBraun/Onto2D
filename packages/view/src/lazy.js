import {
  CATALOG_SORTS,
  NEIGHBORHOOD_DIRECTIONS,
  ViewError,
  createModelView
} from "@onto2d/view";

export const MODEL_PRESENTATION_FORMAT = "onto2d-model-presentation";
export const MODEL_PRESENTATION_FORMAT_VERSION = "1";
export const MODEL_PRESENTATION_LIMITS = Object.freeze({
  maxCatalogPageSize: 500,
  maxInspectorRelations: 1000,
  maxInputDepth: 128,
  maxInputEntries: 2_000_000
});

const INPUT_FIELDS = new Set(["identity", "nodes", "edges"]);
const IDENTITY_FIELDS = new Set(["modelId", "modelVersion", "rootHash", "manifestHash"]);
const OPTION_FIELDS = new Set(["defaultCatalogPageSize"]);
const INSPECT_OPTION_FIELDS = new Set(["maxRelations"]);
const CONTENT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function fail(code, message, details = {}) {
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

function dataEntries(value, name) {
  if (!isPlainObject(value)) {
    fail("VIEW_PRESENTATION_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    fail("VIEW_PRESENTATION_INPUT_INVALID", `${name} must not contain symbol fields.`, { name });
  }
  const entries = new Map();
  for (const key of Object.keys(descriptors).sort(compareText)) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      fail("VIEW_PRESENTATION_INPUT_INVALID", `${name} must contain enumerable data fields only.`, {
        name,
        field: key
      });
    }
    if (FORBIDDEN_KEYS.has(key)) {
      fail("VIEW_PRESENTATION_INPUT_INVALID", `${name} contains a prototype-sensitive field.`, {
        name,
        field: key
      });
    }
    entries.set(key, descriptor.value);
  }
  return entries;
}

function exactEntries(value, fields, name, code = "VIEW_PRESENTATION_INPUT_INVALID") {
  const entries = dataEntries(value, name);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort(compareText);
  const missing = [...fields].filter((field) => !entries.has(field)).sort(compareText);
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${name} has an invalid field set.`, { name, missing, unknown });
  }
  return entries;
}

function optionEntries(value, fields, name) {
  const entries = dataEntries(value, name);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort(compareText);
  if (unknown.length > 0) {
    fail("VIEW_PRESENTATION_OPTION_INVALID", `${name} contains unknown fields.`, {
      name,
      unknown
    });
  }
  return entries;
}

function requireIdentifier(value, name) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 1024
    || FORBIDDEN_KEYS.has(value)
  ) {
    fail("VIEW_PRESENTATION_IDENTITY_INVALID", `${name} must be a safe bounded identifier.`, {
      name
    });
  }
  return value;
}

function requireContentHash(value, name) {
  if (typeof value !== "string" || !CONTENT_HASH_PATTERN.test(value)) {
    fail("VIEW_PRESENTATION_IDENTITY_INVALID", `${name} must be a lowercase SHA-256 content hash.`, {
      name
    });
  }
  return value;
}

function requireInteger(value, name, minimum, maximum, fallback) {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized < minimum || normalized > maximum) {
    fail("VIEW_PRESENTATION_LIMIT_INVALID", `${name} is outside the supported range.`, {
      name,
      minimum,
      maximum
    });
  }
  return normalized;
}

function validateJson(value, name, budget, depth = 0) {
  if (depth > MODEL_PRESENTATION_LIMITS.maxInputDepth) {
    fail("VIEW_PRESENTATION_INPUT_LIMIT_EXCEEDED", `${name} exceeds maxInputDepth.`, { name });
  }
  budget.entries += 1;
  if (budget.entries > MODEL_PRESENTATION_LIMITS.maxInputEntries) {
    fail("VIEW_PRESENTATION_INPUT_LIMIT_EXCEEDED", `${name} exceeds maxInputEntries.`, { name });
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter((key) => key !== "length");
    if (Object.getOwnPropertySymbols(value).length > 0 || keys.length !== value.length) {
      fail("VIEW_PRESENTATION_INPUT_INVALID", `${name} must be a dense JSON array.`, { name });
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        fail("VIEW_PRESENTATION_INPUT_INVALID", `${name} must contain data elements only.`, {
          name,
          index
        });
      }
      validateJson(descriptor.value, `${name}[${index}]`, budget, depth + 1);
    }
    return;
  }
  const entries = dataEntries(value, name);
  for (const [key, child] of entries) {
    validateJson(child, `${name}.${key}`, budget, depth + 1);
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizeIdentity(value) {
  const entries = exactEntries(value, IDENTITY_FIELDS, "input.identity");
  return deepFreeze({
    modelId: requireIdentifier(entries.get("modelId"), "input.identity.modelId"),
    modelVersion: requireIdentifier(entries.get("modelVersion"), "input.identity.modelVersion"),
    rootHash: requireContentHash(entries.get("rootHash"), "input.identity.rootHash"),
    manifestHash: requireContentHash(entries.get("manifestHash"), "input.identity.manifestHash")
  });
}

function lightweightSummary(node) {
  return {
    id: node.id,
    name: node.name,
    level: node.level,
    phase: node.phase,
    typeRole: node.typeRole,
    scientificStatus: node.scientificStatus,
    shortDescription: node.shortDescription,
    parentCount: node.parentCount,
    childCount: node.childCount,
    incomingEdgeCount: node.incomingEdgeCount,
    outgoingEdgeCount: node.outgoingEdgeCount,
    degree: node.degree
  };
}

function lightweightNeighborhoodNode(node) {
  return {
    ...lightweightSummary(node),
    relation: node.relation,
    distance: node.distance,
    upstreamDistance: node.upstreamDistance,
    downstreamDistance: node.downstreamDistance
  };
}

function lightweightEdge(edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relationLayer: edge.relationLayer,
    dependencyType: edge.dependencyType,
    necessity: edge.necessity,
    weight: edge.weight
  };
}

function response(kind, identity, body) {
  return deepFreeze({
    format: MODEL_PRESENTATION_FORMAT,
    formatVersion: MODEL_PRESENTATION_FORMAT_VERSION,
    kind,
    identity,
    ...body
  });
}

export class LazyModelPresentation {
  #view;
  #identity;
  #descriptor;
  #defaultCatalogPageSize;
  #closed = false;

  constructor(input, options = {}) {
    const entries = exactEntries(input, INPUT_FIELDS, "input");
    const optionValues = optionEntries(options, OPTION_FIELDS, "options");
    const budget = { entries: 0 };
    const identity = normalizeIdentity(entries.get("identity"));
    const nodes = entries.get("nodes");
    const edges = entries.get("edges");
    validateJson(nodes, "input.nodes", budget);
    validateJson(edges, "input.edges", budget);
    this.#view = createModelView({ nodes, edges });
    this.#identity = identity;
    this.#defaultCatalogPageSize = requireInteger(
      optionValues.get("defaultCatalogPageSize"),
      "options.defaultCatalogPageSize",
      1,
      MODEL_PRESENTATION_LIMITS.maxCatalogPageSize,
      60
    );
    this.#descriptor = response("descriptor", identity, {
      statistics: this.#view.statistics,
      facets: this.#view.facets,
      capabilities: {
        catalogPaging: true,
        explicitInspection: true,
        boundedNeighborhoods: true,
        semanticExecution: false
      }
    });
    Object.freeze(this);
  }

  #assertOpen() {
    if (this.#closed) {
      fail("VIEW_PRESENTATION_CLOSED", "The lazy presentation session is closed.");
    }
  }

  get descriptor() {
    this.#assertOpen();
    return this.#descriptor;
  }

  has(id) {
    this.#assertOpen();
    return this.#view.get(id) !== undefined;
  }

  catalog(options = {}) {
    this.#assertOpen();
    const values = optionEntries(options, new Set([
      "search",
      "levels",
      "phases",
      "typeRoles",
      "scientificStatuses",
      "sort",
      "order",
      "offset",
      "limit"
    ]), "options");
    const normalized = Object.fromEntries(values);
    validateJson(normalized, "options", { entries: 0 });
    normalized.limit = requireInteger(
      values.get("limit"),
      "options.limit",
      1,
      MODEL_PRESENTATION_LIMITS.maxCatalogPageSize,
      this.#defaultCatalogPageSize
    );
    const projection = this.#view.catalog(normalized);
    const nextOffset = projection.offset + projection.items.length < projection.matching
      ? projection.offset + projection.items.length
      : null;
    return response("catalog-page", this.#identity, {
      query: projection.query,
      total: projection.total,
      matching: projection.matching,
      offset: projection.offset,
      limit: projection.limit,
      nextOffset,
      items: projection.items.map(lightweightSummary)
    });
  }

  inspect(id, options = {}) {
    this.#assertOpen();
    const values = optionEntries(options, INSPECT_OPTION_FIELDS, "options");
    const maxRelations = requireInteger(
      values.get("maxRelations"),
      "options.maxRelations",
      1,
      MODEL_PRESENTATION_LIMITS.maxInspectorRelations,
      250
    );
    const node = this.#view.get(id);
    if (!node) {
      fail("VIEW_PRESENTATION_NODE_MISSING", "The requested presentation node does not exist.", {
        id: typeof id === "string" ? id : null
      });
    }
    const local = this.#view.neighborhood({
      focusId: node.id,
      depth: 1,
      direction: "both",
      maxNodes: 1,
      maxEdges: 0
    });
    const relationPage = (identifiers) => identifiers.slice(0, maxRelations).map((identifier) => (
      lightweightSummary(this.#view.get(identifier))
    ));
    return response("node-detail", this.#identity, {
      node: lightweightSummary(node),
      record: node.data,
      relations: {
        parents: relationPage(local.adjacent.parents),
        children: relationPage(local.adjacent.children)
      },
      relationCounts: {
        parentCount: local.adjacent.parents.length,
        childCount: local.adjacent.children.length,
        hiddenParentCount: Math.max(0, local.adjacent.parents.length - maxRelations),
        hiddenChildCount: Math.max(0, local.adjacent.children.length - maxRelations)
      }
    });
  }

  neighborhood(options) {
    this.#assertOpen();
    const values = optionEntries(options, new Set([
      "focusId",
      "depth",
      "direction",
      "maxNodes",
      "maxEdges"
    ]), "options");
    const normalized = Object.fromEntries(values);
    validateJson(normalized, "options", { entries: 0 });
    const projection = this.#view.neighborhood(normalized);
    return response("neighborhood", this.#identity, {
      query: projection.query,
      focus: lightweightSummary(projection.focus),
      adjacent: projection.adjacent,
      nodes: projection.nodes.map(lightweightNeighborhoodNode),
      edges: projection.edges.map(lightweightEdge),
      counts: projection.counts,
      truncated: projection.truncated
    });
  }

  close() {
    this.#closed = true;
  }
}

export function createLazyModelPresentation(input, options) {
  return new LazyModelPresentation(input, options);
}

export const MODEL_PRESENTATION_CATALOG_SORTS = CATALOG_SORTS;
export const MODEL_PRESENTATION_NEIGHBORHOOD_DIRECTIONS = NEIGHBORHOOD_DIRECTIONS;
