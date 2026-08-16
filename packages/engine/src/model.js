import { canonicalClone, canonicalize, deepFreeze } from "@onto2d/kernel";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { engineFail } from "./errors.js";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    engineFail("ENGINE_IDENTIFIER_INVALID", `${name} must be a non-empty string.`, { name });
  }
  return value;
}

function requirePlainQuery(value, name) {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    engineFail("ENGINE_QUERY_INVALID", `${name} must be a plain object.`, { name });
  }
  return canonicalClone(value);
}

function matches(record, query) {
  return Object.entries(query).every(([field, expected]) => (
    Object.prototype.hasOwnProperty.call(record, field) &&
    canonicalize(record[field]) === canonicalize(expected)
  ));
}

class ModelNode {
  #model;
  #record;

  constructor(model, record) {
    this.#model = model;
    this.#record = record;
    Object.freeze(this);
  }

  get id() { return this.#record.id; }
  get name() { return this.#record.name; }
  get description() { return this.#record.description; }
  get level() { return this.#record.level; }
  get phase() { return this.#record.phase; }
  get typeRole() { return this.#record.typeRole; }
  get scientificStatus() { return this.#record.scientificStatus; }
  get data() { return this.#record; }

  parents(selector) { return this.#model.parents(this.id, selector); }
  children(selector) { return this.#model.children(this.id, selector); }
  ancestors(selector) { return this.#model.ancestors(this.id, selector); }
  descendants(selector) { return this.#model.descendants(this.id, selector); }
  neighborhood(options) { return this.#model.neighborhood(this.id, options); }
  toJSON() { return this.#record; }
}

export class Model {
  #pack;
  #nodes;
  #edges;
  #nodesById;
  #nodeViews;
  #parents;
  #children;

  constructor(pack) {
    this.#pack = verifyModelPack(pack);
    const paths = modelPackFilePaths();
    this.#nodes = this.#pack.files[paths.nodes];
    this.#edges = this.#pack.files[paths.edges];
    this.#nodesById = new Map(this.#nodes.map((node) => [node.id, node]));
    this.#nodeViews = new Map();
    this.#parents = new Map(this.#nodes.map((node) => [node.id, []]));
    this.#children = new Map(this.#nodes.map((node) => [node.id, []]));
    for (const edge of this.#edges) {
      this.#parents.get(edge.target).push(edge);
      this.#children.get(edge.source).push(edge);
    }
    for (const index of [this.#parents, this.#children]) {
      for (const edges of index.values()) edges.sort((left, right) => compareText(left.id, right.id));
    }
    Object.freeze(this);
  }

  get id() { return this.#pack.manifest.model.id; }
  get name() { return this.#pack.manifest.model.name; }
  get version() { return this.#pack.manifest.model.version; }
  get rootHash() { return this.#pack.manifest.rootHash; }
  get manifestHash() { return this.#pack.manifest.manifestHash; }
  get manifest() { return this.#pack.manifest; }
  get dictionaries() {
    return this.#pack.files[modelPackFilePaths().dictionaries];
  }

  has(id) {
    return this.#nodesById.has(requireIdentifier(id, "id"));
  }

  get(id) {
    const identifier = requireIdentifier(id, "id");
    const record = this.#nodesById.get(identifier);
    if (!record) return undefined;
    if (!this.#nodeViews.has(identifier)) {
      this.#nodeViews.set(identifier, new ModelNode(this, record));
    }
    return this.#nodeViews.get(identifier);
  }

  require(id) {
    const node = this.get(id);
    if (!node) engineFail("ENGINE_MODEL_NODE_MISSING", "The model node does not exist.", { id });
    return node;
  }

  nodes(query = {}) {
    const normalized = requirePlainQuery(query, "query");
    return Object.freeze(this.#nodes.filter((node) => matches(node, normalized)).map((node) => this.get(node.id)));
  }

  edges(query = {}) {
    const normalized = requirePlainQuery(query, "query");
    return Object.freeze(this.#edges.filter((edge) => matches(edge, normalized)));
  }

  query(query = {}) {
    return this.nodes(query);
  }

  #related(id, index, endpoint, selector) {
    const identifier = this.require(id).id;
    const normalized = requirePlainQuery(selector, "selector");
    const relatedIds = new Set(index.get(identifier)
      .filter((edge) => matches(edge, normalized))
      .map((edge) => edge[endpoint]));
    const result = [...relatedIds].sort(compareText).map((relatedId) => this.get(relatedId));
    return Object.freeze(result);
  }

  parents(id, selector = {}) {
    return this.#related(id, this.#parents, "source", selector);
  }

  children(id, selector = {}) {
    return this.#related(id, this.#children, "target", selector);
  }

  #closure(id, direction, selector) {
    const start = this.require(id).id;
    const visited = new Set([start]);
    const queue = [start];
    const result = [];
    while (queue.length > 0) {
      const current = queue.shift();
      const next = direction === "parents"
        ? this.parents(current, selector)
        : this.children(current, selector);
      for (const node of next) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        result.push(node);
        queue.push(node.id);
      }
    }
    return Object.freeze(result);
  }

  ancestors(id, selector = {}) {
    return this.#closure(id, "parents", selector);
  }

  descendants(id, selector = {}) {
    return this.#closure(id, "children", selector);
  }

  paths(options) {
    const value = requirePlainQuery(options, "options");
    const from = this.require(value.from).id;
    const to = this.require(value.to).id;
    const selector = requirePlainQuery(value.selector, "options.selector");
    const maximumPaths = value.maximumPaths ?? 256;
    if (!Number.isSafeInteger(maximumPaths) || maximumPaths < 1 || maximumPaths > 10000) {
      engineFail("ENGINE_PATH_LIMIT_INVALID", "maximumPaths must be an integer from 1 to 10000.");
    }
    if (from === to) return Object.freeze([Object.freeze([from])]);

    const distance = new Map([[from, 0]]);
    const predecessors = new Map();
    const queue = [from];
    let targetDistance;
    while (queue.length > 0) {
      const current = queue.shift();
      const currentDistance = distance.get(current);
      if (targetDistance !== undefined && currentDistance >= targetDistance) continue;
      for (const node of this.children(current, selector)) {
        const nextDistance = currentDistance + 1;
        if (!distance.has(node.id)) {
          distance.set(node.id, nextDistance);
          predecessors.set(node.id, [current]);
          queue.push(node.id);
        } else if (distance.get(node.id) === nextDistance) {
          predecessors.get(node.id).push(current);
        }
        if (node.id === to) targetDistance = nextDistance;
      }
    }
    if (!distance.has(to)) return Object.freeze([]);
    for (const values of predecessors.values()) values.sort(compareText);

    const paths = [];
    const build = (current, suffix) => {
      if (current === from) {
        if (paths.length >= maximumPaths) {
          engineFail("ENGINE_PATH_LIMIT_EXCEEDED", "The shortest-path set exceeds maximumPaths.", {
            maximumPaths
          });
        }
        paths.push(Object.freeze([from, ...suffix]));
        return;
      }
      for (const predecessor of predecessors.get(current) || []) {
        build(predecessor, [current, ...suffix]);
      }
    };
    build(to, []);
    return Object.freeze(paths);
  }

  neighborhood(id, options = {}) {
    const value = requirePlainQuery(options, "options");
    const depth = value.depth ?? 1;
    const direction = value.direction ?? "both";
    const selector = requirePlainQuery(value.selector, "options.selector");
    if (!Number.isSafeInteger(depth) || depth < 0 || depth > 64) {
      engineFail("ENGINE_NEIGHBORHOOD_DEPTH_INVALID", "depth must be an integer from 0 to 64.");
    }
    if (!["parents", "children", "both"].includes(direction)) {
      engineFail("ENGINE_NEIGHBORHOOD_DIRECTION_INVALID", "direction is not supported.", { direction });
    }
    const start = this.require(id).id;
    const distance = new Map([[start, 0]]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift();
      const currentDepth = distance.get(current);
      if (currentDepth >= depth) continue;
      const related = [];
      if (direction !== "children") related.push(...this.parents(current, selector));
      if (direction !== "parents") related.push(...this.children(current, selector));
      for (const node of related.sort((left, right) => compareText(left.id, right.id))) {
        if (distance.has(node.id)) continue;
        distance.set(node.id, currentDepth + 1);
        queue.push(node.id);
      }
    }
    const identifiers = new Set(distance.keys());
    const nodes = [...identifiers].sort(compareText).map((nodeId) => this.get(nodeId));
    const edges = this.#edges.filter((edge) => (
      identifiers.has(edge.source) && identifiers.has(edge.target) && matches(edge, selector)
    ));
    return deepFreeze({ nodes, edges, distance: [...distance.entries()].sort() });
  }
}

export function createModel(pack) {
  return new Model(pack);
}
