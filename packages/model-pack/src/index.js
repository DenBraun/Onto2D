import {
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical,
  isContentHash
} from "@onto2d/kernel/canonical";

export const MODEL_PACK_FORMAT = "onto2d-model-pack";
export const MODEL_PACK_FORMAT_VERSION = "1";
export const MODEL_PACK_SCHEMA_VERSION = "1";
export const MODEL_PACK_ENGINE_API_VERSION = "1";

const FILE_PATHS = Object.freeze({
  nodes: "model/nodes.json",
  edges: "model/edges.json",
  dictionaries: "model/dictionaries.json",
  byId: "indexes/by-id.json",
  parents: "indexes/parents.json",
  children: "indexes/children.json",
  levels: "indexes/levels.json",
  phases: "indexes/phases.json",
  typeRoles: "indexes/type-roles.json",
  scientificStatus: "indexes/scientific-status.json"
});

const SEMANTIC_FILE_IDS = Object.freeze(["nodes", "edges", "dictionaries"]);
const INDEX_FILE_IDS = Object.freeze([
  "byId",
  "parents",
  "children",
  "levels",
  "phases",
  "typeRoles",
  "scientificStatus"
]);
const FORBIDDEN_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);

export class ModelPackError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ModelPackError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new ModelPackError(code, message, details);
}

function requirePlainObject(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("MODEL_PACK_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("MODEL_PACK_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  return value;
}

function requireString(value, name, maximum = 1024) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    fail("MODEL_PACK_INPUT_INVALID", `${name} must be a non-empty bounded string.`, { name });
  }
  return value;
}

function requireIdentifier(value, name) {
  const identifier = requireString(value, name);
  if (FORBIDDEN_IDENTIFIERS.has(identifier)) {
    fail("MODEL_PACK_IDENTIFIER_FORBIDDEN", `${name} uses a prototype-sensitive identifier.`, {
      name,
      identifier
    });
  }
  return identifier;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeModel(value) {
  const model = requirePlainObject(value, "model");
  const normalized = {
    id: requireIdentifier(model.id, "model.id"),
    name: requireString(model.name, "model.name"),
    version: requireIdentifier(model.version, "model.version")
  };
  if (model.description !== undefined) {
    normalized.description = requireString(model.description, "model.description", 4096);
  }
  if (model.status !== undefined) {
    normalized.status = requireIdentifier(model.status, "model.status");
  }
  return normalized;
}

function normalizeSource(value) {
  const source = requirePlainObject(value, "source");
  if (!Array.isArray(source.files)) {
    fail("MODEL_PACK_INPUT_INVALID", "source.files must be an array.");
  }
  const paths = new Set();
  const files = source.files.map((entry, index) => {
    const file = requirePlainObject(entry, `source.files[${index}]`);
    const filePath = requireString(file.path, `source.files[${index}].path`);
    if (
      filePath.startsWith("/") ||
      filePath.includes("\\") ||
      filePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
      fail("MODEL_PACK_SOURCE_PATH_INVALID", "Source paths must be normalized relative paths.", {
        path: filePath
      });
    }
    if (paths.has(filePath)) {
      fail("MODEL_PACK_SOURCE_PATH_DUPLICATE", "Source paths must be unique.", { path: filePath });
    }
    paths.add(filePath);
    if (!isContentHash(file.hash)) {
      fail("MODEL_PACK_SOURCE_HASH_INVALID", "Every source file requires a content hash.", {
        path: filePath
      });
    }
    return { path: filePath, hash: file.hash };
  }).sort((left, right) => compareText(left.path, right.path));
  const normalized = {
    id: requireIdentifier(source.id, "source.id"),
    files
  };
  if (source.auditHash !== undefined) {
    if (!isContentHash(source.auditHash)) {
      fail("MODEL_PACK_SOURCE_HASH_INVALID", "source.auditHash must be a content hash.");
    }
    normalized.auditHash = source.auditHash;
  }
  return normalized;
}

function normalizeNodes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    fail("MODEL_PACK_NODES_INVALID", "nodes must be a non-empty array.");
  }
  const identifiers = new Set();
  return value.map((entry, index) => {
    const node = canonicalClone(requirePlainObject(entry, `nodes[${index}]`));
    const id = requireIdentifier(node.id, `nodes[${index}].id`);
    if (identifiers.has(id)) {
      fail("MODEL_PACK_NODE_DUPLICATE", "Model node identifiers must be unique.", { id });
    }
    identifiers.add(id);
    return node;
  }).sort((left, right) => compareText(left.id, right.id));
}

function normalizeEdges(value, nodeIds) {
  if (!Array.isArray(value)) fail("MODEL_PACK_EDGES_INVALID", "edges must be an array.");
  const identifiers = new Set();
  return value.map((entry, index) => {
    const edge = canonicalClone(requirePlainObject(entry, `edges[${index}]`));
    const id = requireIdentifier(edge.id, `edges[${index}].id`);
    const source = requireIdentifier(edge.source, `edges[${index}].source`);
    const target = requireIdentifier(edge.target, `edges[${index}].target`);
    if (identifiers.has(id)) {
      fail("MODEL_PACK_EDGE_DUPLICATE", "Model edge identifiers must be unique.", { id });
    }
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      fail("MODEL_PACK_EDGE_ENDPOINT_MISSING", "Every edge endpoint must resolve to a model node.", {
        id,
        source,
        target
      });
    }
    identifiers.add(id);
    return edge;
  }).sort((left, right) => compareText(left.id, right.id));
}

function groupedIndex(nodes, field) {
  const groups = new Map();
  for (const node of nodes) {
    if (node[field] === undefined || node[field] === null) continue;
    const key = canonicalize(node[field]);
    if (!groups.has(key)) groups.set(key, { value: node[field], nodes: [] });
    groups.get(key).nodes.push(node.id);
  }
  return [...groups.values()]
    .map((entry) => ({ ...entry, nodes: entry.nodes.sort(compareText) }))
    .sort((left, right) => compareText(canonicalize(left.value), canonicalize(right.value)));
}

export function buildModelIndexes(nodesInput, edgesInput) {
  const nodes = normalizeNodes(nodesInput);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = normalizeEdges(edgesInput, nodeIds);
  const parents = new Map(nodes.map((node) => [node.id, new Set()]));
  const children = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    parents.get(edge.target).add(edge.source);
    children.get(edge.source).add(edge.target);
  }
  const neighborIndex = (index) => [...index.entries()].map(([id, neighbors]) => ({
    id,
    nodes: [...neighbors].sort(compareText)
  })).sort((left, right) => compareText(left.id, right.id));
  return deepFreeze(canonicalClone({
    byId: nodes.map((node, index) => ({ id: node.id, index })),
    parents: neighborIndex(parents),
    children: neighborIndex(children),
    levels: groupedIndex(nodes, "level"),
    phases: groupedIndex(nodes, "phase"),
    typeRoles: groupedIndex(nodes, "typeRole"),
    scientificStatus: groupedIndex(nodes, "scientificStatus")
  }));
}

function fileDescriptor(id, path, value) {
  return {
    id,
    path,
    hash: hashCanonical("onto2d:model-pack-file:v1", { path, value })
  };
}

function manifestRootInput(manifest) {
  return {
    format: manifest.format,
    formatVersion: manifest.formatVersion,
    schemaVersion: manifest.schemaVersion,
    modelId: manifest.model.id,
    compatibility: manifest.compatibility,
    source: manifest.source,
    semanticFiles: manifest.semanticFiles
  };
}

function manifestHashInput(manifest) {
  const { manifestHash: _manifestHash, ...body } = manifest;
  return body;
}

export function buildModelPack(input) {
  const value = canonicalClone(requirePlainObject(input, "input"));
  const model = normalizeModel(value.model);
  const source = normalizeSource(value.source);
  const nodes = normalizeNodes(value.nodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = normalizeEdges(value.edges, nodeIds);
  const dictionaries = canonicalClone(requirePlainObject(value.dictionaries, "dictionaries"));
  const indexes = buildModelIndexes(nodes, edges);
  const files = {
    [FILE_PATHS.nodes]: nodes,
    [FILE_PATHS.edges]: edges,
    [FILE_PATHS.dictionaries]: dictionaries,
    [FILE_PATHS.byId]: indexes.byId,
    [FILE_PATHS.parents]: indexes.parents,
    [FILE_PATHS.children]: indexes.children,
    [FILE_PATHS.levels]: indexes.levels,
    [FILE_PATHS.phases]: indexes.phases,
    [FILE_PATHS.typeRoles]: indexes.typeRoles,
    [FILE_PATHS.scientificStatus]: indexes.scientificStatus
  };
  const semanticFiles = SEMANTIC_FILE_IDS.map((id) => (
    fileDescriptor(id, FILE_PATHS[id], files[FILE_PATHS[id]])
  ));
  const indexFiles = INDEX_FILE_IDS.map((id) => (
    fileDescriptor(id, FILE_PATHS[id], files[FILE_PATHS[id]])
  ));
  const manifest = {
    schemaVersion: MODEL_PACK_SCHEMA_VERSION,
    format: MODEL_PACK_FORMAT,
    formatVersion: MODEL_PACK_FORMAT_VERSION,
    model,
    compatibility: {
      engineApiVersion: MODEL_PACK_ENGINE_API_VERSION,
      modelPackFormatVersion: MODEL_PACK_FORMAT_VERSION
    },
    source,
    semanticFiles,
    indexFiles,
    statistics: {
      nodeCount: nodes.length,
      edgeCount: edges.length
    }
  };
  manifest.rootHash = hashCanonical("onto2d:model-pack-root:v1", manifestRootInput(manifest));
  manifest.manifestHash = hashCanonical(
    "onto2d:model-pack-manifest:v1",
    manifestHashInput(manifest)
  );
  return deepFreeze(canonicalClone({ manifest, files }));
}

export function verifyModelPack(pack) {
  const value = canonicalClone(requirePlainObject(pack, "pack"));
  const manifest = requirePlainObject(value.manifest, "pack.manifest");
  const files = requirePlainObject(value.files, "pack.files");
  if (
    manifest.format !== MODEL_PACK_FORMAT ||
    manifest.formatVersion !== MODEL_PACK_FORMAT_VERSION ||
    manifest.schemaVersion !== MODEL_PACK_SCHEMA_VERSION ||
    manifest.compatibility?.engineApiVersion !== MODEL_PACK_ENGINE_API_VERSION ||
    manifest.compatibility?.modelPackFormatVersion !== MODEL_PACK_FORMAT_VERSION
  ) {
    fail("MODEL_PACK_COMPATIBILITY_UNSUPPORTED", "The Model Pack format is not supported.");
  }
  for (const filePath of Object.values(FILE_PATHS)) {
    if (!Object.hasOwn(files, filePath)) {
      fail("MODEL_PACK_FILE_MISSING", "The Model Pack is missing a required file.", {
        path: filePath
      });
    }
  }
  const expected = buildModelPack({
    model: manifest.model,
    source: manifest.source,
    nodes: files[FILE_PATHS.nodes],
    edges: files[FILE_PATHS.edges],
    dictionaries: files[FILE_PATHS.dictionaries]
  });
  if (canonicalize(value) !== canonicalize(expected)) {
    fail("MODEL_PACK_VERIFICATION_FAILED", "Model Pack bytes, indexes, or identities differ from reconstruction.", {
      model: manifest.model?.id,
      version: manifest.model?.version
    });
  }
  return expected;
}

export function modelPackFilePaths() {
  return Object.freeze({ ...FILE_PATHS });
}
