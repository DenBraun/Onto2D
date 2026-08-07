import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { HASH_DOMAINS, createCanonicalForm, isContentHash } from "./hash.js";
import {
  normalizeQuantity as normalizeRuntimeQuantity,
  parseUnitExpression
} from "./quantity.js";

const INPUT_FIELDS = new Set(["id", "domain", "nodes", "edges", "skeleton", "canonicalForm"]);
const SKELETON_INPUT_FIELDS = new Set(["id", "nodeCount", "edges", "canonicalForm"]);
const NODE_FIELDS = new Set(["ref", "attrs"]);
const EDGE_FIELDS = new Set(["from", "to", "role", "attrs"]);
const POLICY_FIELDS = new Set([
  "connected",
  "allowParallelEdges",
  "allowSelfLoops",
  "connectivityProjection",
  "structuralNodeAttributes",
  "structuralEdgeAttributes"
]);
const LIMIT_FIELDS = new Set(["maxNodes", "maxEdges", "maxSearchStates"]);
const QUANTITY_FIELDS = new Set(["value", "unit", "tolerance", "semantic", "provenance"]);
const TOLERANCE_FIELDS = new Set(["absolute", "relative"]);
const CANONICAL_FORM_FIELDS = new Set(["schemaVersion", "bytesBase64", "hash"]);
const CANDIDATE_DOMAINS = new Set(["profile-quotient", "element-exact", "single-candidate"]);
const CONNECTIVITY_PROJECTIONS = new Set(["undirected", "directed-strong", "directed-weak"]);
const PROVENANCE_FIELDS = Object.freeze({
  declared: new Set(["kind", "evidence"]),
  computed: new Set(["kind", "method", "evidence"]),
  oracle: new Set(["kind", "source", "method", "evidence"])
});

export const DEFAULT_GRAPH_POLICY = deepFreeze({
  connected: true,
  allowParallelEdges: false,
  allowSelfLoops: false,
  connectivityProjection: "undirected",
  structuralNodeAttributes: [],
  structuralEdgeAttributes: []
});

export const DEFAULT_GRAPH_CANONICALIZATION_LIMITS = deepFreeze({
  maxNodes: 6,
  maxEdges: 64,
  maxSearchStates: 100_000
});

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, code, path, message, details) {
  issues.push(validationIssue(code, path, message, details));
}

function rejectUnknownFields(
  value,
  allowed,
  path,
  issues,
  code = "CANDIDATE_FIELD_UNKNOWN",
  message = "Unknown candidate field."
) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(issues, code, `${path}.${key}`, message, { key });
    }
  }
}

function requireFields(
  value,
  fields,
  path,
  issues,
  code = "CANDIDATE_FIELD_REQUIRED",
  message = "Required field is missing."
) {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      addIssue(issues, code, `${path}.${field}`, message, { field });
    }
  }
}

function requireIdentifier(value, path, issues, code = "CANDIDATE_IDENTIFIER_INVALID") {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    addIssue(issues, code, path, "Expected a normalized non-empty string.", { value });
    return false;
  }
  return true;
}

function normalizeStringSet(value, path, issues) {
  if (!Array.isArray(value)) {
    addIssue(issues, "GRAPH_POLICY_ATTRIBUTE_LIST_INVALID", path, "Structural attributes must be an array.");
    return [];
  }
  const normalized = [];
  const seen = new Set();
  value.forEach((entry, index) => {
    if (!requireIdentifier(entry, `${path}[${index}]`, issues, "GRAPH_POLICY_ATTRIBUTE_INVALID")) return;
    if (seen.has(entry)) {
      addIssue(issues, "GRAPH_POLICY_ATTRIBUTE_DUPLICATE", `${path}[${index}]`, "Structural attribute names must be unique.", {
        attribute: entry
      });
      return;
    }
    seen.add(entry);
    normalized.push(entry);
  });
  return normalized.sort(compareStrings);
}

function normalizeOptions(options, issues) {
  if (!isObject(options)) {
    addIssue(issues, "GRAPH_OPTIONS_INVALID", "$options", "Graph canonicalization options must be an object.");
    return {
      policy: { ...DEFAULT_GRAPH_POLICY },
      limits: { ...DEFAULT_GRAPH_CANONICALIZATION_LIMITS }
    };
  }
  rejectUnknownFields(
    options,
    new Set(["policy", "limits"]),
    "$options",
    issues,
    "GRAPH_OPTIONS_FIELD_UNKNOWN",
    "Unknown graph canonicalization option."
  );

  const policyInput = options.policy === undefined ? {} : options.policy;
  const policy = { ...DEFAULT_GRAPH_POLICY };
  if (!isObject(policyInput)) {
    addIssue(issues, "GRAPH_POLICY_INVALID", "$options.policy", "Graph policy must be an object.");
  } else {
    rejectUnknownFields(
      policyInput,
      POLICY_FIELDS,
      "$options.policy",
      issues,
      "GRAPH_POLICY_FIELD_UNKNOWN",
      "Unknown graph policy field."
    );
    for (const field of ["connected", "allowParallelEdges", "allowSelfLoops"]) {
      if (policyInput[field] === undefined) continue;
      if (typeof policyInput[field] !== "boolean") {
        addIssue(issues, "GRAPH_POLICY_BOOLEAN_INVALID", `$options.policy.${field}`, "Graph policy flag must be boolean.", {
          value: policyInput[field]
        });
      } else {
        policy[field] = policyInput[field];
      }
    }
    if (policyInput.connectivityProjection !== undefined) {
      if (!CONNECTIVITY_PROJECTIONS.has(policyInput.connectivityProjection)) {
        addIssue(issues, "GRAPH_POLICY_CONNECTIVITY_INVALID", "$options.policy.connectivityProjection", "Unknown connectivity projection.", {
          value: policyInput.connectivityProjection
        });
      } else {
        policy.connectivityProjection = policyInput.connectivityProjection;
      }
    }
    if (policyInput.structuralNodeAttributes !== undefined) {
      policy.structuralNodeAttributes = normalizeStringSet(
        policyInput.structuralNodeAttributes,
        "$options.policy.structuralNodeAttributes",
        issues
      );
    }
    if (policyInput.structuralEdgeAttributes !== undefined) {
      policy.structuralEdgeAttributes = normalizeStringSet(
        policyInput.structuralEdgeAttributes,
        "$options.policy.structuralEdgeAttributes",
        issues
      );
    }
  }

  const limitsInput = options.limits === undefined ? {} : options.limits;
  const limits = { ...DEFAULT_GRAPH_CANONICALIZATION_LIMITS };
  if (!isObject(limitsInput)) {
    addIssue(issues, "CANONICALIZATION_LIMITS_INVALID", "$options.limits", "Graph canonicalization limits must be an object.");
  } else {
    rejectUnknownFields(
      limitsInput,
      LIMIT_FIELDS,
      "$options.limits",
      issues,
      "CANONICALIZATION_LIMIT_FIELD_UNKNOWN",
      "Unknown graph canonicalization limit."
    );
    for (const field of LIMIT_FIELDS) {
      if (limitsInput[field] === undefined) continue;
      const minimum = field === "maxEdges" ? 0 : 1;
      if (!Number.isSafeInteger(limitsInput[field]) || limitsInput[field] < minimum) {
        addIssue(issues, "CANONICALIZATION_LIMIT_INVALID", `$options.limits.${field}`, "Canonicalization limit is outside its valid range.", {
          value: limitsInput[field],
          minimum
        });
      } else {
        limits[field] = limitsInput[field];
      }
    }
  }
  return { policy, limits };
}

export function normalizeGraphCanonicalizationOptions(options = {}) {
  const safeOptions = canonicalClone(options);
  const issues = [];
  const normalized = normalizeOptions(safeOptions, issues);
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Graph canonicalization options failed validation.", {
      code: "GRAPH_OPTIONS_VALIDATION_FAILED",
      stage: "CANONICALIZE_GRAPH"
    });
  }
  return deepFreeze(normalized);
}

function normalizeSkeletonOptions(options, issues) {
  if (!isObject(options)) {
    addIssue(issues, "SKELETON_OPTIONS_INVALID", "$options", "Skeleton canonicalization options must be an object.");
    return { ...DEFAULT_GRAPH_CANONICALIZATION_LIMITS };
  }
  rejectUnknownFields(
    options,
    new Set(["limits"]),
    "$options",
    issues,
    "SKELETON_OPTIONS_FIELD_UNKNOWN",
    "Unknown skeleton canonicalization option."
  );
  return normalizeOptions({ limits: options.limits }, issues).limits;
}

function normalizeEvidenceList(value, path, issues) {
  if (!Array.isArray(value)) {
    addIssue(issues, "QUANTITY_PROVENANCE_EVIDENCE_INVALID", path, "Quantity evidence must be an array.");
    return [];
  }
  const seen = new Set();
  const result = [];
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0 || entry !== entry.trim()) {
      addIssue(issues, "QUANTITY_PROVENANCE_EVIDENCE_INVALID", `${path}[${index}]`, "Evidence IDs must be normalized non-empty strings.");
    } else if (seen.has(entry)) {
      addIssue(issues, "QUANTITY_PROVENANCE_EVIDENCE_DUPLICATE", `${path}[${index}]`, "Evidence IDs must be unique.", {
        evidence: entry
      });
    } else {
      seen.add(entry);
      result.push(entry);
    }
  });
  return result.sort(compareStrings);
}

function normalizeQuantity(value, path, issues) {
  rejectUnknownFields(value, QUANTITY_FIELDS, path, issues, "QUANTITY_FIELD_UNKNOWN", "Unknown quantity field.");
  requireFields(value, QUANTITY_FIELDS, path, issues, "QUANTITY_FIELD_REQUIRED", "Required quantity field is missing.");
  if (!Number.isFinite(value.value)) {
    addIssue(issues, "QUANTITY_VALUE_INVALID", `${path}.value`, "Quantity value must be finite.", { value: value.value });
  }
  let parsedUnit = null;
  if (requireIdentifier(value.unit, `${path}.unit`, issues, "QUANTITY_UNIT_INVALID")) {
    try {
      parsedUnit = parseUnitExpression(value.unit);
    } catch (error) {
      if (!(error instanceof KernelError) || error.stage !== "QUANTITY") throw error;
      addIssue(issues, error.code, `${path}.unit`, error.message, error.details);
    }
  }
  if (
    typeof value.semantic !== "string" ||
    value.semantic.trim().length === 0 ||
    value.semantic !== value.semantic.trim()
  ) {
    addIssue(issues, "QUANTITY_SEMANTIC_INVALID", `${path}.semantic`, "Quantity semantic must be a normalized non-empty string.");
  }

  const tolerance = {};
  if (!isObject(value.tolerance)) {
    addIssue(issues, "QUANTITY_TOLERANCE_INVALID", `${path}.tolerance`, "Quantity tolerance must be an object.");
  } else {
    rejectUnknownFields(
      value.tolerance,
      TOLERANCE_FIELDS,
      `${path}.tolerance`,
      issues,
      "QUANTITY_TOLERANCE_FIELD_UNKNOWN",
      "Unknown quantity tolerance field."
    );
    const present = ["absolute", "relative"].filter((field) => value.tolerance[field] !== undefined);
    if (present.length === 0) {
      addIssue(issues, "QUANTITY_TOLERANCE_MISSING", `${path}.tolerance`, "Tolerance needs an absolute or relative bound.");
    }
    for (const field of present) {
      if (!Number.isFinite(value.tolerance[field]) || value.tolerance[field] < 0) {
        addIssue(issues, "QUANTITY_TOLERANCE_INVALID", `${path}.tolerance.${field}`, "Tolerance must be finite and non-negative.", {
          value: value.tolerance[field]
        });
      } else {
        tolerance[field] = Object.is(value.tolerance[field], -0) ? 0 : value.tolerance[field];
      }
    }
  }

  let provenance = { kind: "declared", evidence: [] };
  if (!isObject(value.provenance)) {
    addIssue(issues, "QUANTITY_PROVENANCE_INVALID", `${path}.provenance`, "Quantity provenance must be an object.");
  } else if (!Object.prototype.hasOwnProperty.call(PROVENANCE_FIELDS, value.provenance.kind)) {
    addIssue(issues, "QUANTITY_PROVENANCE_INVALID", `${path}.provenance.kind`, "Unknown quantity provenance kind.", {
      value: value.provenance.kind
    });
  } else {
    const fields = PROVENANCE_FIELDS[value.provenance.kind];
    rejectUnknownFields(
      value.provenance,
      fields,
      `${path}.provenance`,
      issues,
      "QUANTITY_PROVENANCE_FIELD_UNKNOWN",
      "Unknown quantity provenance field."
    );
    requireFields(
      value.provenance,
      fields,
      `${path}.provenance`,
      issues,
      "QUANTITY_PROVENANCE_FIELD_REQUIRED",
      "Required quantity provenance field is missing."
    );
    provenance = {
      kind: value.provenance.kind,
      ...(value.provenance.method === undefined ? {} : { method: value.provenance.method }),
      ...(value.provenance.source === undefined ? {} : { source: value.provenance.source }),
      evidence: normalizeEvidenceList(value.provenance.evidence, `${path}.provenance.evidence`, issues)
    };
    if (value.provenance.method !== undefined && !requireIdentifier(
      value.provenance.method,
      `${path}.provenance.method`,
      issues,
      "QUANTITY_PROVENANCE_METHOD_INVALID"
    )) {
      provenance.method = value.provenance.method;
    }
    if (value.provenance.kind === "oracle" && !isContentHash(value.provenance.source)) {
      addIssue(issues, "QUANTITY_PROVENANCE_SOURCE_INVALID", `${path}.provenance.source`, "Oracle source hash is invalid.");
    }
  }

  let normalizedValue = Object.is(value.value, -0) ? 0 : value.value;
  let normalizedUnit = typeof value.unit === "string" ? value.unit.trim() : value.unit;
  let normalizedTolerance = tolerance;
  if (
    parsedUnit &&
    Number.isFinite(value.value) &&
    Object.keys(tolerance).length > 0 &&
    typeof value.semantic === "string" &&
    value.semantic.trim().length > 0
  ) {
    try {
      const normalized = normalizeRuntimeQuantity({
        value: normalizedValue,
        unit: normalizedUnit,
        tolerance,
        semantic: value.semantic.trim(),
        provenance
      });
      normalizedValue = normalized.value;
      normalizedUnit = normalized.unit;
      normalizedTolerance = normalized.tolerance;
    } catch (error) {
      if (!(error instanceof KernelError) || error.stage !== "QUANTITY") throw error;
      addIssue(issues, error.code, path, error.message, error.details);
    }
  }

  return {
    value: normalizedValue,
    unit: normalizedUnit,
    tolerance: normalizedTolerance,
    semantic: value.semantic,
    provenance
  };
}

function normalizeAttributeValue(value, path, issues) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return Object.is(value, -0) ? 0 : value;
  }
  if (!isObject(value)) {
    addIssue(issues, "CANDIDATE_ATTRIBUTE_INVALID", path, "Candidate attributes must be scalars or Quantity objects.");
    return null;
  }
  return normalizeQuantity(value, path, issues);
}

function normalizeAttributes(value, path, issues) {
  if (value === undefined) return {};
  if (!isObject(value)) {
    addIssue(issues, "CANDIDATE_ATTRIBUTES_INVALID", path, "Candidate attributes must be an object.");
    return {};
  }
  const normalized = {};
  for (const key of Object.keys(value).sort(compareStrings)) {
    if (key.trim().length === 0 || key !== key.trim()) {
      addIssue(issues, "CANDIDATE_ATTRIBUTE_NAME_INVALID", `${path}.${key}`, "Attribute names must be normalized non-empty strings.", {
        attribute: key
      });
    }
    normalized[key] = normalizeAttributeValue(value[key], `${path}.${key}`, issues);
  }
  return normalized;
}

function validateCanonicalForm(value, path, issues) {
  if (!isObject(value)) {
    addIssue(issues, "CANDIDATE_CANONICAL_FORM_INVALID", path, "Canonical form must be an object.");
    return;
  }
  rejectUnknownFields(
    value,
    CANONICAL_FORM_FIELDS,
    path,
    issues,
    "CANDIDATE_CANONICAL_FORM_FIELD_UNKNOWN",
    "Unknown canonical-form field."
  );
  requireFields(
    value,
    CANONICAL_FORM_FIELDS,
    path,
    issues,
    "CANDIDATE_CANONICAL_FORM_FIELD_REQUIRED",
    "Required canonical-form field is missing."
  );
  if (typeof value.schemaVersion !== "string" || value.schemaVersion.length === 0) {
    addIssue(issues, "CANDIDATE_CANONICAL_FORM_INVALID", `${path}.schemaVersion`, "Canonical schema version is invalid.");
  }
  if (typeof value.bytesBase64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.bytesBase64)) {
    addIssue(issues, "CANDIDATE_CANONICAL_FORM_INVALID", `${path}.bytesBase64`, "Canonical bytes must use padded base64.");
  }
  if (!isContentHash(value.hash)) {
    addIssue(issues, "CANDIDATE_CANONICAL_FORM_INVALID", `${path}.hash`, "Canonical form hash is invalid.");
  }
}

function normalizeCandidate(input, policy, limits, issues) {
  if (!isObject(input)) {
    addIssue(issues, "CANDIDATE_TYPE_INVALID", "$", "Candidate input must be an object.");
    return null;
  }
  rejectUnknownFields(input, INPUT_FIELDS, "$", issues);
  requireFields(input, ["domain", "nodes", "edges"], "$", issues);
  if (!CANDIDATE_DOMAINS.has(input.domain)) {
    addIssue(issues, "CANDIDATE_DOMAIN_INVALID", "$.domain", "Unknown candidate counting domain.", { value: input.domain });
  }
  if (input.id !== undefined && !isContentHash(input.id)) {
    addIssue(issues, "CANDIDATE_ID_INVALID", "$.id", "Candidate ID must be a lowercase SHA-256 content identifier.");
  }
  if (input.skeleton !== undefined && !isContentHash(input.skeleton)) {
    addIssue(issues, "CANDIDATE_SKELETON_ID_INVALID", "$.skeleton", "Skeleton ID must be a lowercase SHA-256 content identifier.");
  }
  if (input.canonicalForm !== undefined) validateCanonicalForm(input.canonicalForm, "$.canonicalForm", issues);

  const nodes = [];
  if (!Array.isArray(input.nodes)) {
    addIssue(issues, "CANDIDATE_NODES_INVALID", "$.nodes", "Candidate nodes must be an array.");
  } else {
    if (input.nodes.length === 0) {
      addIssue(issues, "CANDIDATE_EMPTY", "$.nodes", "A candidate must contain at least one node.");
    }
    if (input.nodes.length > limits.maxNodes) {
      addIssue(issues, "CANDIDATE_NODE_LIMIT_EXCEEDED", "$.nodes", "Candidate exceeds the node limit.", {
        actual: input.nodes.length,
        maximum: limits.maxNodes
      });
    }
    input.nodes.forEach((node, index) => {
      const path = `$.nodes[${index}]`;
      if (!isObject(node)) {
        addIssue(issues, "CANDIDATE_NODE_INVALID", path, "Candidate node must be an object.");
        return;
      }
      rejectUnknownFields(node, NODE_FIELDS, path, issues);
      requireFields(node, ["ref"], path, issues);
      if (!isContentHash(node.ref)) {
        addIssue(issues, "CANDIDATE_REF_INVALID", `${path}.ref`, "Node reference must be a lowercase SHA-256 content identifier.");
      }
      nodes.push({ ref: node.ref, attrs: normalizeAttributes(node.attrs, `${path}.attrs`, issues) });
    });
  }

  const edges = [];
  if (!Array.isArray(input.edges)) {
    addIssue(issues, "CANDIDATE_EDGES_INVALID", "$.edges", "Candidate edges must be an array.");
  } else {
    if (input.edges.length > limits.maxEdges) {
      addIssue(issues, "CANDIDATE_EDGE_LIMIT_EXCEEDED", "$.edges", "Candidate exceeds the edge limit.", {
        actual: input.edges.length,
        maximum: limits.maxEdges
      });
    }
    const pairs = new Map();
    input.edges.forEach((edge, index) => {
      const path = `$.edges[${index}]`;
      if (!isObject(edge)) {
        addIssue(issues, "CANDIDATE_EDGE_INVALID", path, "Candidate edge must be an object.");
        return;
      }
      rejectUnknownFields(edge, EDGE_FIELDS, path, issues);
      requireFields(edge, ["from", "to", "role"], path, issues);
      for (const endpoint of ["from", "to"]) {
        if (!Number.isSafeInteger(edge[endpoint]) || edge[endpoint] < 0 || edge[endpoint] >= nodes.length) {
          addIssue(issues, "CANDIDATE_EDGE_ENDPOINT_INVALID", `${path}.${endpoint}`, "Edge endpoint is outside the candidate node array.", {
            value: edge[endpoint],
            nodeCount: nodes.length
          });
        }
      }
      requireIdentifier(edge.role, `${path}.role`, issues, "CANDIDATE_EDGE_ROLE_INVALID");
      if (Number.isSafeInteger(edge.from) && Number.isSafeInteger(edge.to)) {
        if (edge.from === edge.to && !policy.allowSelfLoops) {
          addIssue(issues, "CANDIDATE_SELF_LOOP_FORBIDDEN", path, "Self-loops are disabled by graph policy.", { node: edge.from });
        }
        const pair = `${edge.from}:${edge.to}`;
        if (!policy.allowParallelEdges && pairs.has(pair)) {
          addIssue(issues, "CANDIDATE_PARALLEL_EDGE_FORBIDDEN", path, "Parallel edges are disabled by graph policy.", {
            previousEdge: pairs.get(pair),
            from: edge.from,
            to: edge.to
          });
        } else {
          pairs.set(pair, index);
        }
      }
      edges.push({
        from: edge.from,
        to: edge.to,
        role: edge.role,
        attrs: normalizeAttributes(edge.attrs, `${path}.attrs`, issues),
        inputIndex: index
      });
    });
  }

  return {
    domain: input.domain,
    nodes,
    edges,
    supplied: {
      id: input.id,
      skeleton: input.skeleton,
      canonicalForm: input.canonicalForm
    }
  };
}

function normalizeSkeleton(input, limits, issues) {
  if (!isObject(input)) {
    addIssue(issues, "SKELETON_TYPE_INVALID", "$", "Skeleton input must be an object.");
    return null;
  }
  rejectUnknownFields(
    input,
    SKELETON_INPUT_FIELDS,
    "$",
    issues,
    "SKELETON_FIELD_UNKNOWN",
    "Unknown skeleton field."
  );
  requireFields(
    input,
    ["nodeCount", "edges"],
    "$",
    issues,
    "SKELETON_FIELD_REQUIRED",
    "Required skeleton field is missing."
  );
  if (!Number.isSafeInteger(input.nodeCount) || input.nodeCount < 1) {
    addIssue(issues, "SKELETON_NODE_COUNT_INVALID", "$.nodeCount", "Skeleton node count must be a positive safe integer.", {
      value: input.nodeCount
    });
  } else if (input.nodeCount > limits.maxNodes) {
    addIssue(issues, "SKELETON_NODE_LIMIT_EXCEEDED", "$.nodeCount", "Skeleton exceeds the node limit.", {
      actual: input.nodeCount,
      maximum: limits.maxNodes
    });
  }
  if (input.id !== undefined && !isContentHash(input.id)) {
    addIssue(issues, "SKELETON_ID_INVALID", "$.id", "Skeleton ID must be a lowercase SHA-256 content identifier.");
  }
  if (input.canonicalForm !== undefined) validateCanonicalForm(input.canonicalForm, "$.canonicalForm", issues);

  const edges = [];
  if (!Array.isArray(input.edges)) {
    addIssue(issues, "SKELETON_EDGES_INVALID", "$.edges", "Skeleton edges must be an array.");
  } else {
    if (input.edges.length > limits.maxEdges) {
      addIssue(issues, "SKELETON_EDGE_LIMIT_EXCEEDED", "$.edges", "Skeleton exceeds the edge limit.", {
        actual: input.edges.length,
        maximum: limits.maxEdges
      });
    }
    const seen = new Map();
    input.edges.forEach((edge, index) => {
      const path = `$.edges[${index}]`;
      if (!Array.isArray(edge) || edge.length !== 2) {
        addIssue(issues, "SKELETON_EDGE_INVALID", path, "Skeleton edge must be a two-endpoint tuple.");
        return;
      }
      const [left, right] = edge;
      for (const [offset, endpoint] of [[0, left], [1, right]]) {
        if (!Number.isSafeInteger(endpoint) || endpoint < 0 || endpoint >= input.nodeCount) {
          addIssue(issues, "SKELETON_EDGE_ENDPOINT_INVALID", `${path}[${offset}]`, "Skeleton endpoint is outside the node range.", {
            value: endpoint,
            nodeCount: input.nodeCount
          });
        }
      }
      if (left === right) {
        addIssue(issues, "SKELETON_SELF_LOOP_FORBIDDEN", path, "A simple skeleton cannot contain self-loops.", { node: left });
      }
      if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return;
      const from = Math.min(left, right);
      const to = Math.max(left, right);
      const key = `${from}:${to}`;
      if (seen.has(key)) {
        addIssue(issues, "SKELETON_PARALLEL_EDGE_FORBIDDEN", path, "A simple skeleton cannot contain duplicate adjacencies.", {
          previousEdge: seen.get(key),
          from,
          to
        });
      } else {
        seen.set(key, index);
      }
      edges.push({ from, to, label: null, inputIndex: index });
    });
  }
  return {
    nodeCount: input.nodeCount,
    edges,
    supplied: { id: input.id, canonicalForm: input.canonicalForm }
  };
}

function reachable(nodeCount, adjacency) {
  if (nodeCount === 0) return new Set();
  const seen = new Set([0]);
  const pending = [0];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const neighbor of adjacency[current]) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      pending.push(neighbor);
    }
  }
  return seen;
}

function validateConnectivity(candidate, policy, issues) {
  if (!candidate || !policy.connected || candidate.nodes.length === 0) return;
  const forward = Array.from({ length: candidate.nodes.length }, () => new Set());
  const reverse = Array.from({ length: candidate.nodes.length }, () => new Set());
  for (const edge of candidate.edges) {
    if (!Number.isSafeInteger(edge.from) || !Number.isSafeInteger(edge.to) ||
        edge.from < 0 || edge.to < 0 || edge.from >= candidate.nodes.length || edge.to >= candidate.nodes.length) {
      continue;
    }
    forward[edge.from].add(edge.to);
    reverse[edge.to].add(edge.from);
    if (policy.connectivityProjection !== "directed-strong") {
      forward[edge.to].add(edge.from);
    }
  }
  const forwardCount = reachable(candidate.nodes.length, forward).size;
  const reverseCount = policy.connectivityProjection === "directed-strong"
    ? reachable(candidate.nodes.length, reverse).size
    : forwardCount;
  if (forwardCount !== candidate.nodes.length || reverseCount !== candidate.nodes.length) {
    addIssue(issues, "CANDIDATE_DISCONNECTED", "$.edges", "Candidate does not satisfy the configured connectivity projection.", {
      projection: policy.connectivityProjection,
      nodeCount: candidate.nodes.length,
      forwardReachable: forwardCount,
      reverseReachable: reverseCount
    });
  }
}

function pickAttributes(attributes, structuralNames) {
  const selected = {};
  for (const name of structuralNames) {
    if (Object.prototype.hasOwnProperty.call(attributes, name)) selected[name] = attributes[name];
  }
  return selected;
}

function withOptionalAttributes(value, attributes) {
  return Object.keys(attributes).length === 0 ? value : { ...value, attrs: attributes };
}

function compressSignatures(signatures) {
  const encoded = signatures.map((signature) => canonicalize(signature));
  const unique = [...new Set(encoded)].sort(compareStrings);
  const colors = new Map(unique.map((signature, index) => [signature, index]));
  return encoded.map((signature) => colors.get(signature));
}

function colorCount(colors) {
  return new Set(colors).size;
}

function refineColors(graph, startingColors, statistics) {
  let colors = startingColors;
  while (true) {
    const incident = Array.from({ length: graph.nodes.length }, () => []);
    for (const edge of graph.edges) {
      if (graph.directed) {
        incident[edge.from].push({ direction: "out", neighbor: colors[edge.to], label: edge.label });
        incident[edge.to].push({ direction: "in", neighbor: colors[edge.from], label: edge.label });
      } else {
        incident[edge.from].push({ neighbor: colors[edge.to], label: edge.label });
        incident[edge.to].push({ neighbor: colors[edge.from], label: edge.label });
      }
    }
    const signatures = colors.map((color, node) => ({
      color,
      incident: incident[node].sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)))
    }));
    const refined = compressSignatures(signatures);
    statistics.refinementRounds += 1;
    if (colorCount(refined) === colorCount(colors)) return refined;
    colors = refined;
  }
}

function individualize(colors, node) {
  return compressSignatures(colors.map((color, index) => ({ color, individualized: index === node })));
}

function chooseCell(colors) {
  const cells = new Map();
  colors.forEach((color, node) => {
    if (!cells.has(color)) cells.set(color, []);
    cells.get(color).push(node);
  });
  return [...cells.entries()]
    .filter(([, nodes]) => nodes.length > 1)
    .sort((left, right) => left[1].length - right[1].length || left[0] - right[0])[0]?.[1];
}

function leafSerialization(graph, colors) {
  const canonicalToInput = colors
    .map((color, node) => ({ color, node }))
    .sort((left, right) => left.color - right.color)
    .map((entry) => entry.node);
  const inputToCanonical = Array(canonicalToInput.length);
  canonicalToInput.forEach((node, canonical) => { inputToCanonical[node] = canonical; });

  const nodes = canonicalToInput.map((inputNode) => graph.nodes[inputNode]);
  const decoratedEdges = graph.edges.map((edge) => {
    let from = inputToCanonical[edge.from];
    let to = inputToCanonical[edge.to];
    if (!graph.directed && to < from) [from, to] = [to, from];
    return {
      record: graph.edgeRecord(from, to, edge.label),
      inputIndex: edge.inputIndex
    };
  }).sort((left, right) =>
    compareStrings(canonicalize(left.record), canonicalize(right.record)) || left.inputIndex - right.inputIndex
  );
  const edges = decoratedEdges.map((entry) => entry.record);
  const inputEdgeToCanonical = Array(graph.edges.length);
  decoratedEdges.forEach((entry, canonical) => { inputEdgeToCanonical[entry.inputIndex] = canonical; });
  return {
    serialized: graph.serialize(nodes, edges),
    canonicalToInput,
    inputToCanonical,
    inputEdgeToCanonical
  };
}

function canonicalLabel(graph, budget, phase) {
  const statistics = { searchStates: 0, leaves: 0, refinementRounds: 0 };
  let best;
  let bestBytes;

  function search(seedColors) {
    budget.used += 1;
    statistics.searchStates += 1;
    if (budget.used > budget.maximum) {
      throw new KernelError({
        code: "CANONICALIZATION_BUDGET_EXHAUSTED",
        stage: "CANONICALIZE_GRAPH",
        message: "Graph canonicalization exhausted its deterministic search-state budget.",
        details: { phase, used: budget.used, maximum: budget.maximum, nodeCount: graph.nodes.length }
      });
    }
    const colors = refineColors(graph, seedColors, statistics);
    const cell = chooseCell(colors);
    if (!cell) {
      statistics.leaves += 1;
      const leaf = leafSerialization(graph, colors);
      const bytes = canonicalize(leaf.serialized);
      if (bestBytes === undefined || compareStrings(bytes, bestBytes) < 0) {
        bestBytes = bytes;
        best = leaf;
      }
      return;
    }
    for (const node of cell) search(individualize(colors, node));
  }

  search(compressSignatures(graph.nodes));
  return { ...best, statistics };
}

function makeSimpleSkeletonGraph(nodeCount, edges) {
  return {
    directed: false,
    nodes: Array.from({ length: nodeCount }, () => null),
    edges,
    edgeRecord: (from, to) => [from, to],
    serialize: (nodes, canonicalEdges) => ({ nodeCount: nodes.length, edges: canonicalEdges })
  };
}

function makeSkeletonGraph(candidate) {
  const seen = new Set();
  const edges = [];
  for (const edge of candidate.edges) {
    if (edge.from === edge.to) continue;
    const from = Math.min(edge.from, edge.to);
    const to = Math.max(edge.from, edge.to);
    const key = `${from}:${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, label: null, inputIndex: edges.length });
  }
  return makeSimpleSkeletonGraph(candidate.nodes.length, edges);
}

function makeCandidateGraph(candidate, policy, skeleton) {
  return {
    directed: true,
    nodes: candidate.nodes.map((node) => withOptionalAttributes(
      { ref: node.ref },
      pickAttributes(node.attrs, policy.structuralNodeAttributes)
    )),
    edges: candidate.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      label: withOptionalAttributes(
        { role: edge.role },
        pickAttributes(edge.attrs, policy.structuralEdgeAttributes)
      ),
      inputIndex: edge.inputIndex
    })),
    edgeRecord: (from, to, label) => ({ from, to, ...label }),
    serialize: (nodes, edges) => ({ domain: candidate.domain, nodes, edges, skeleton })
  };
}

function verifySuppliedIdentity(candidate, result) {
  const issues = [];
  if (candidate.supplied.id !== undefined && candidate.supplied.id !== result.candidateId) {
    addIssue(issues, "CANDIDATE_ID_MISMATCH", "$.id", "Supplied candidate ID does not match canonical content.", {
      supplied: candidate.supplied.id,
      computed: result.candidateId
    });
  }
  if (candidate.supplied.skeleton !== undefined && candidate.supplied.skeleton !== result.skeletonId) {
    addIssue(issues, "CANDIDATE_SKELETON_ID_MISMATCH", "$.skeleton", "Supplied skeleton ID does not match canonical skeleton content.", {
      supplied: candidate.supplied.skeleton,
      computed: result.skeletonId
    });
  }
  if (candidate.supplied.canonicalForm !== undefined &&
      canonicalize(candidate.supplied.canonicalForm) !== canonicalize(result.canonicalForm)) {
    addIssue(issues, "CANDIDATE_CANONICAL_FORM_MISMATCH", "$.canonicalForm", "Supplied canonical form does not match canonical content.");
  }
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Candidate derived identity validation failed.", {
      code: "CANDIDATE_VALIDATION_FAILED",
      stage: "CANONICALIZE_GRAPH"
    });
  }
}

function verifySuppliedSkeletonIdentity(skeleton, result) {
  const issues = [];
  if (skeleton.supplied.id !== undefined && skeleton.supplied.id !== result.skeletonId) {
    addIssue(issues, "SKELETON_ID_MISMATCH", "$.id", "Supplied skeleton ID does not match canonical content.", {
      supplied: skeleton.supplied.id,
      computed: result.skeletonId
    });
  }
  if (skeleton.supplied.canonicalForm !== undefined &&
      canonicalize(skeleton.supplied.canonicalForm) !== canonicalize(result.canonicalForm)) {
    addIssue(issues, "SKELETON_CANONICAL_FORM_MISMATCH", "$.canonicalForm", "Supplied skeleton canonical form does not match canonical content.");
  }
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Skeleton derived identity validation failed.", {
      code: "SKELETON_VALIDATION_FAILED",
      stage: "CANONICALIZE_GRAPH"
    });
  }
}

export function canonicalizeSkeleton(input, options = {}) {
  const safeInput = canonicalClone(input);
  const safeOptions = canonicalClone(options);
  const issues = [];
  const limits = normalizeSkeletonOptions(safeOptions, issues);
  const skeleton = normalizeSkeleton(safeInput, limits, issues);
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Skeleton validation failed.", {
      code: "SKELETON_VALIDATION_FAILED",
      stage: "CANONICALIZE_GRAPH"
    });
  }

  const budget = { used: 0, maximum: limits.maxSearchStates };
  const canonical = canonicalLabel(makeSimpleSkeletonGraph(skeleton.nodeCount, skeleton.edges), budget, "skeleton");
  const canonicalForm = createCanonicalForm(HASH_DOMAINS.SKELETON, canonical.serialized, "1");
  const result = {
    skeletonId: canonicalForm.hash,
    canonical: canonical.serialized,
    skeleton: {
      id: canonicalForm.hash,
      ...canonical.serialized,
      canonicalForm
    },
    canonicalForm,
    canonicalizationLimits: limits,
    inputToCanonical: canonical.inputToCanonical,
    canonicalToInput: canonical.canonicalToInput,
    inputEdgeToCanonical: canonical.inputEdgeToCanonical,
    statistics: canonical.statistics
  };
  verifySuppliedSkeletonIdentity(skeleton, result);
  return deepFreeze(result);
}

export function canonicalizeCandidate(input, options = {}) {
  const safeInput = canonicalClone(input);
  const safeOptions = canonicalClone(options);
  const issues = [];
  const { policy, limits } = normalizeOptions(safeOptions, issues);
  const candidate = normalizeCandidate(safeInput, policy, limits, issues);
  validateConnectivity(candidate, policy, issues);
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Candidate graph validation failed.", {
      code: "CANDIDATE_VALIDATION_FAILED",
      stage: "CANONICALIZE_GRAPH"
    });
  }

  const budget = { used: 0, maximum: limits.maxSearchStates };
  const skeletonResult = canonicalLabel(makeSkeletonGraph(candidate), budget, "skeleton");
  const skeletonCanonicalForm = createCanonicalForm(HASH_DOMAINS.SKELETON, skeletonResult.serialized, "1");
  const candidateResult = canonicalLabel(
    makeCandidateGraph(candidate, policy, skeletonCanonicalForm.hash),
    budget,
    "candidate"
  );
  const canonicalForm = createCanonicalForm(HASH_DOMAINS.CANDIDATE, candidateResult.serialized, "1");
  const result = {
    candidateId: canonicalForm.hash,
    skeletonId: skeletonCanonicalForm.hash,
    canonical: candidateResult.serialized,
    candidate: {
      id: canonicalForm.hash,
      ...candidateResult.serialized,
      canonicalForm
    },
    canonicalForm,
    skeletonCanonicalForm,
    graphPolicy: policy,
    canonicalizationLimits: limits,
    inputToCanonical: candidateResult.inputToCanonical,
    canonicalToInput: candidateResult.canonicalToInput,
    inputEdgeToCanonical: candidateResult.inputEdgeToCanonical,
    statistics: {
      searchStates: skeletonResult.statistics.searchStates + candidateResult.statistics.searchStates,
      leaves: skeletonResult.statistics.leaves + candidateResult.statistics.leaves,
      refinementRounds: skeletonResult.statistics.refinementRounds + candidateResult.statistics.refinementRounds,
      skeleton: skeletonResult.statistics,
      candidate: candidateResult.statistics
    }
  };
  verifySuppliedIdentity(candidate, result);
  return deepFreeze(result);
}
