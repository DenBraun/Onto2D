import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { createCandidateStore } from "./candidate-store.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import {
  DEFAULT_GRAPH_CANONICALIZATION_LIMITS,
  canonicalizeCandidate,
  canonicalizeSkeleton,
  normalizeGraphCanonicalizationOptions
} from "./graph-canonicalizer.js";

const INPUT_FIELDS = new Set([
  "domain",
  "skeletons",
  "nodeVariants",
  "edgeVariants",
  "graphPolicy"
]);
const OPTION_FIELDS = new Set([
  "maxEdges",
  "maxRawCandidates",
  "maxCandidates",
  "maxDecorationStates",
  "canonicalizationLimits"
]);
const SKELETON_FIELDS = new Set([
  "id",
  "nodeCount",
  "edges",
  "canonicalForm",
  "labelledMultiplicity"
]);
const NODE_VARIANT_FIELDS = new Set(["ref", "attrs"]);
const EDGE_VARIANT_FIELDS = new Set(["role", "attrs"]);
const DOMAINS = new Set(["profile-quotient", "element-exact", "single-candidate"]);
const VALIDATION_REF = `sha256:${"0".repeat(64)}`;
const MAX_SIMPLE_SKELETON_EDGES =
  DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxNodes *
  (DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxNodes - 1) / 2;

export const DECORATED_CANDIDATE_ENUMERATOR_VERSION = "decorated-candidate-enumerator-v1";

export const DEFAULT_CANDIDATE_ENUMERATION_LIMITS = deepFreeze({
  maxEdges: "n+2",
  maxRawCandidates: 1_000_000,
  maxCandidates: 1_000_000,
  maxDecorationStates: 5_000_000
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

function rejectUnknownFields(value, allowed, path, issues, code, message) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) addIssue(issues, code, `${path}.${key}`, message, { key });
  }
}

function rebaseValidationIssues(error, path, issues) {
  for (const entry of error.issues) {
    const suffix = entry.path === "$" ? "" : entry.path.slice(1);
    addIssue(issues, entry.code, `${path}${suffix}`, entry.message, entry.details);
  }
}

function rebaseCandidateVariantIssues(error, path, collection, issues) {
  const prefix = `$.${collection}[0]`;
  for (const entry of error.issues) {
    const rebased = entry.path.startsWith(prefix)
      ? `${path}${entry.path.slice(prefix.length)}`
      : entry.path === "$"
        ? path
        : `${path}${entry.path.slice(1)}`;
    addIssue(issues, entry.code, rebased, entry.message, entry.details);
  }
}

function rebaseGraphOptionIssues(error, issues) {
  for (const entry of error.issues) {
    let path;
    if (entry.path.startsWith("$options.policy")) {
      path = `$input.graphPolicy${entry.path.slice("$options.policy".length)}`;
    } else if (entry.path.startsWith("$options.limits")) {
      path = `$options.canonicalizationLimits${entry.path.slice("$options.limits".length)}`;
    } else {
      path = entry.path;
    }
    addIssue(issues, entry.code, path, entry.message, entry.details);
  }
}

function validateAttributeNames(value, allowedNames, path, issues) {
  if (value === undefined) return;
  if (!isObject(value)) return;
  const allowed = new Set(allowedNames);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(
        issues,
        "CANDIDATE_ENUMERATION_ATTRIBUTE_NOT_STRUCTURAL",
        `${path}.${key}`,
        "Decoration variants may contain only attributes declared structural by the graph policy.",
        { attribute: key }
      );
    }
  }
}

function normalizeOptions(options, issues) {
  if (!isObject(options)) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_OPTIONS_INVALID",
      "$options",
      "Candidate enumeration options must be an object."
    );
    return { ...DEFAULT_CANDIDATE_ENUMERATION_LIMITS, canonicalizationLimits: {} };
  }
  rejectUnknownFields(
    options,
    OPTION_FIELDS,
    "$options",
    issues,
    "CANDIDATE_ENUMERATION_OPTION_UNKNOWN",
    "Unknown candidate enumeration option."
  );
  const normalized = {
    ...DEFAULT_CANDIDATE_ENUMERATION_LIMITS,
    canonicalizationLimits: options.canonicalizationLimits === undefined
      ? {}
      : options.canonicalizationLimits
  };
  for (const field of ["maxRawCandidates", "maxCandidates", "maxDecorationStates"]) {
    if (options[field] === undefined) continue;
    if (!Number.isSafeInteger(options[field]) || options[field] < 1) {
      addIssue(
        issues,
        "CANDIDATE_ENUMERATION_BUDGET_INVALID",
        `$options.${field}`,
        "Candidate enumeration budgets must be positive safe integers.",
        { value: options[field] }
      );
    } else {
      normalized[field] = options[field];
    }
  }
  if (options.maxEdges !== undefined) {
    if (options.maxEdges !== "n+2" &&
        (!Number.isSafeInteger(options.maxEdges) || options.maxEdges < 0)) {
      addIssue(
        issues,
        "CANDIDATE_ENUMERATION_EDGE_BUDGET_INVALID",
        "$options.maxEdges",
        "The edge budget must be a non-negative safe integer or 'n+2'.",
        { value: options.maxEdges }
      );
    } else {
      normalized.maxEdges = options.maxEdges;
    }
  }
  if (!isObject(normalized.canonicalizationLimits)) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_CANONICALIZATION_LIMITS_INVALID",
      "$options.canonicalizationLimits",
      "Canonicalization limits must be an object."
    );
    normalized.canonicalizationLimits = {};
  }
  return normalized;
}

function normalizeSkeletons(value, limits, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_SKELETONS_INVALID",
      "$input.skeletons",
      "Candidate enumeration requires a non-empty skeleton array."
    );
    return [];
  }
  const records = [];
  const seen = new Map();
  value.forEach((entry, index) => {
    const path = `$input.skeletons[${index}]`;
    if (!isObject(entry)) {
      addIssue(issues, "CANDIDATE_ENUMERATION_SKELETON_INVALID", path, "Skeleton entries must be objects.");
      return;
    }
    rejectUnknownFields(
      entry,
      SKELETON_FIELDS,
      path,
      issues,
      "CANDIDATE_ENUMERATION_SKELETON_FIELD_UNKNOWN",
      "Unknown skeleton enumeration input field."
    );
    if (
      entry.labelledMultiplicity !== undefined &&
      (!Number.isSafeInteger(entry.labelledMultiplicity) || entry.labelledMultiplicity < 1)
    ) {
      addIssue(
        issues,
        "CANDIDATE_ENUMERATION_LABELLED_MULTIPLICITY_INVALID",
        `${path}.labelledMultiplicity`,
        "Skeleton labelled multiplicity must be a positive safe integer when supplied.",
        { value: entry.labelledMultiplicity }
      );
    }
    try {
      const result = canonicalizeSkeleton({
        ...(entry.id === undefined ? {} : { id: entry.id }),
        nodeCount: entry.nodeCount,
        edges: entry.edges,
        ...(entry.canonicalForm === undefined ? {} : { canonicalForm: entry.canonicalForm })
      }, { limits });
      const adjacency = Array.from({ length: result.canonical.nodeCount }, () => []);
      for (const [from, to] of result.canonical.edges) {
        adjacency[from].push(to);
        adjacency[to].push(from);
      }
      const seenNodes = new Set([0]);
      const pending = [0];
      while (pending.length > 0) {
        const node = pending.pop();
        for (const neighbor of adjacency[node]) {
          if (seenNodes.has(neighbor)) continue;
          seenNodes.add(neighbor);
          pending.push(neighbor);
        }
      }
      if (seenNodes.size !== result.canonical.nodeCount) {
        addIssue(
          issues,
          "CANDIDATE_ENUMERATION_SKELETON_DISCONNECTED",
          path,
          "Decorated enumeration requires connected simple skeletons.",
          { skeletonId: result.skeletonId, reachable: seenNodes.size, nodeCount: result.canonical.nodeCount }
        );
        return;
      }
      if (seen.has(result.skeletonId)) {
        addIssue(
          issues,
          "CANDIDATE_ENUMERATION_SKELETON_DUPLICATE",
          path,
          "Skeleton inputs must have distinct canonical identities.",
          { skeletonId: result.skeletonId, previousIndex: seen.get(result.skeletonId) }
        );
        return;
      }
      seen.set(result.skeletonId, index);
      records.push(result.skeleton);
    } catch (error) {
      if (error instanceof KernelValidationError) {
        rebaseValidationIssues(error, path, issues);
        return;
      }
      throw error;
    }
  });
  return records.sort((left, right) => compareStrings(left.id, right.id));
}

function normalizeNodeVariants(value, domain, graphPolicy, limits, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_NODE_VARIANTS_INVALID",
      "$input.nodeVariants",
      "Candidate enumeration requires a non-empty node-variant array."
    );
    return [];
  }
  const variants = [];
  const seen = new Map();
  value.forEach((entry, index) => {
    const path = `$input.nodeVariants[${index}]`;
    if (!isObject(entry)) {
      addIssue(issues, "CANDIDATE_ENUMERATION_NODE_VARIANT_INVALID", path, "Node variants must be objects.");
      return;
    }
    rejectUnknownFields(
      entry,
      NODE_VARIANT_FIELDS,
      path,
      issues,
      "CANDIDATE_ENUMERATION_NODE_VARIANT_FIELD_UNKNOWN",
      "Unknown node-variant field."
    );
    validateAttributeNames(entry.attrs, graphPolicy.structuralNodeAttributes, `${path}.attrs`, issues);
    try {
      const result = canonicalizeCandidate(
        {
          domain,
          nodes: [{
            ref: entry.ref,
            ...(entry.attrs === undefined ? {} : { attrs: entry.attrs })
          }],
          edges: []
        },
        {
          policy: { ...graphPolicy, connected: false, allowParallelEdges: true, allowSelfLoops: true },
          limits
        }
      );
      const normalized = result.canonical.nodes[0];
      const key = canonicalize(normalized);
      if (seen.has(key)) {
        addIssue(
          issues,
          "CANDIDATE_ENUMERATION_NODE_VARIANT_DUPLICATE",
          path,
          "Node variants must remain distinct after structural normalization.",
          { previousIndex: seen.get(key) }
        );
        return;
      }
      seen.set(key, index);
      variants.push(normalized);
    } catch (error) {
      if (error instanceof KernelValidationError) {
        rebaseCandidateVariantIssues(error, path, "nodes", issues);
        return;
      }
      throw error;
    }
  });
  return variants.sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
}

function normalizeEdgeVariants(value, domain, graphPolicy, limits, issues) {
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_EDGE_VARIANTS_INVALID",
      "$input.edgeVariants",
      "Edge variants must be an array."
    );
    return [];
  }
  const variants = [];
  const seen = new Map();
  value.forEach((entry, index) => {
    const path = `$input.edgeVariants[${index}]`;
    if (!isObject(entry)) {
      addIssue(issues, "CANDIDATE_ENUMERATION_EDGE_VARIANT_INVALID", path, "Edge variants must be objects.");
      return;
    }
    rejectUnknownFields(
      entry,
      EDGE_VARIANT_FIELDS,
      path,
      issues,
      "CANDIDATE_ENUMERATION_EDGE_VARIANT_FIELD_UNKNOWN",
      "Unknown edge-variant field."
    );
    validateAttributeNames(entry.attrs, graphPolicy.structuralEdgeAttributes, `${path}.attrs`, issues);
    try {
      const result = canonicalizeCandidate(
        {
          domain,
          nodes: [{ ref: VALIDATION_REF }],
          edges: [{
            from: 0,
            to: 0,
            role: entry.role,
            ...(entry.attrs === undefined ? {} : { attrs: entry.attrs })
          }]
        },
        {
          policy: { ...graphPolicy, connected: false, allowParallelEdges: true, allowSelfLoops: true },
          limits: { ...limits, maxEdges: Math.max(1, limits.maxEdges) }
        }
      );
      const normalized = {
        role: result.canonical.edges[0].role,
        ...(result.canonical.edges[0].attrs === undefined
          ? {}
          : { attrs: result.canonical.edges[0].attrs })
      };
      const key = canonicalize(normalized);
      if (seen.has(key)) {
        addIssue(
          issues,
          "CANDIDATE_ENUMERATION_EDGE_VARIANT_DUPLICATE",
          path,
          "Edge variants must remain distinct after structural normalization.",
          { previousIndex: seen.get(key) }
        );
        return;
      }
      seen.set(key, index);
      variants.push(normalized);
    } catch (error) {
      if (error instanceof KernelValidationError) {
        rebaseCandidateVariantIssues(error, path, "edges", issues);
        return;
      }
      throw error;
    }
  });
  return variants.sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
}

function directedVariants(edge, variants) {
  const result = [];
  for (const variant of variants) {
    result.push({ from: edge[0], to: edge[1], ...variant });
    result.push({ from: edge[1], to: edge[0], ...variant });
  }
  return result.sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
}

function loopVariants(node, variants) {
  return variants
    .map((variant) => ({ from: node, to: node, ...variant }))
    .sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
}

function isConnectivityExclusion(error) {
  return error instanceof KernelValidationError &&
    error.issues.length > 0 &&
    error.issues.every((entry) => entry.code === "CANDIDATE_DISCONNECTED");
}

function cursor(skeletonId, nodeIndex, edgeGroupIndex) {
  return { skeletonId, nodeIndex, edgeGroupIndex };
}

/**
 * Exhaustively decorates a finite canonical skeleton set. The caller supplies
 * complete finite node and edge variant alphabets; this function does not
 * derive scientific roles or attributes and does not evaluate predicates.
 */
export function enumerateDecoratedCandidates(input, options = {}) {
  const safeInput = canonicalClone(input);
  const safeOptions = canonicalClone(options);
  const issues = [];
  if (!isObject(safeInput)) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_INPUT_INVALID",
      "$input",
      "Candidate enumeration input must be an object."
    );
  }
  rejectUnknownFields(
    safeInput,
    INPUT_FIELDS,
    "$input",
    issues,
    "CANDIDATE_ENUMERATION_INPUT_FIELD_UNKNOWN",
    "Unknown candidate enumeration input field."
  );

  const normalizedOptions = normalizeOptions(safeOptions, issues);
  const domain = isObject(safeInput) ? safeInput.domain : undefined;
  if (!DOMAINS.has(domain)) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_DOMAIN_INVALID",
      "$input.domain",
      "Candidate enumeration requires a valid fixed counting domain.",
      { value: domain }
    );
  }

  let canonicalization = null;
  try {
    canonicalization = normalizeGraphCanonicalizationOptions({
      policy: isObject(safeInput) ? safeInput.graphPolicy : undefined,
      limits: normalizedOptions.canonicalizationLimits
    });
  } catch (error) {
    if (error instanceof KernelValidationError) {
      rebaseGraphOptionIssues(error, issues);
    } else {
      throw error;
    }
  }
  if (canonicalization === null) {
    canonicalization = normalizeGraphCanonicalizationOptions();
  }

  const skeletons = normalizeSkeletons(
    isObject(safeInput) ? safeInput.skeletons : undefined,
    {
      ...canonicalization.limits,
      maxEdges: Math.max(canonicalization.limits.maxEdges, MAX_SIMPLE_SKELETON_EDGES)
    },
    issues
  );
  const nodeVariants = normalizeNodeVariants(
    isObject(safeInput) ? safeInput.nodeVariants : undefined,
    DOMAINS.has(domain) ? domain : "element-exact",
    canonicalization.policy,
    canonicalization.limits,
    issues
  );
  const edgeVariants = normalizeEdgeVariants(
    isObject(safeInput) ? safeInput.edgeVariants : undefined,
    DOMAINS.has(domain) ? domain : "element-exact",
    canonicalization.policy,
    canonicalization.limits,
    issues
  );

  if (skeletons.some((skeleton) => skeleton.edges.length > 0) && edgeVariants.length === 0) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_EDGE_VARIANTS_REQUIRED",
      "$input.edgeVariants",
      "At least one edge variant is required when a skeleton contains an adjacency."
    );
  }
  const largestEdgeBudget = Math.max(0, ...skeletons.map((skeleton) => {
    const edgeLimit = normalizedOptions.maxEdges === "n+2"
      ? skeleton.nodeCount + 2
      : normalizedOptions.maxEdges;
    if (skeleton.edges.length > edgeLimit || edgeVariants.length === 0) return 0;
    const groupCount = skeleton.edges.length +
      (canonicalization.policy.allowSelfLoops ? skeleton.nodeCount : 0);
    if (groupCount === 0) return 0;
    return canonicalization.policy.allowParallelEdges
      ? edgeLimit
      : Math.min(edgeLimit, groupCount);
  }));
  if (largestEdgeBudget > canonicalization.limits.maxEdges) {
    addIssue(
      issues,
      "CANDIDATE_ENUMERATION_CANONICALIZATION_EDGE_LIMIT_TOO_SMALL",
      "$options.canonicalizationLimits.maxEdges",
      "The canonicalization edge limit must cover every configured generation edge budget.",
      { generationMaximum: largestEdgeBudget, canonicalizationMaximum: canonicalization.limits.maxEdges }
    );
  }
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Candidate enumeration configuration failed validation.", {
      code: "CANDIDATE_ENUMERATION_VALIDATION_FAILED",
      stage: "ENUMERATE_CANDIDATES"
    });
  }

  const store = createCandidateStore({
    domain,
    maxCandidates: normalizedOptions.maxCandidates,
    canonicalization
  });
  let exhausted = null;
  let decorationStates = 0;
  let generatedCandidates = 0;
  let policyExcludedCandidates = 0;
  let canonicalizationIndeterminateCandidates = 0;
  let edgeBoundExcludedSkeletons = 0;
  let currentCursor = cursor(skeletons[0].id, 0, null);

  function enterState(nextCursor) {
    currentCursor = nextCursor;
    if (decorationStates >= normalizedOptions.maxDecorationStates) {
      exhausted = deepFreeze({
        budget: "maxDecorationStates",
        used: decorationStates,
        maximum: normalizedOptions.maxDecorationStates,
        cursor: currentCursor
      });
      return false;
    }
    decorationStates += 1;
    return true;
  }

  function emitCandidate(skeleton, nodes, edges, edgeGroupIndex) {
    currentCursor = cursor(skeleton.id, nodes.length, edgeGroupIndex);
    if (generatedCandidates >= normalizedOptions.maxRawCandidates) {
      exhausted = deepFreeze({
        budget: "maxRawCandidates",
        used: generatedCandidates,
        maximum: normalizedOptions.maxRawCandidates,
        cursor: currentCursor
      });
      return false;
    }
    generatedCandidates += 1;
    try {
      const result = store.add({ domain, nodes, edges, skeleton: skeleton.id });
      if (result.status === "budget-exhausted") {
        exhausted = result.exhaustion;
        return false;
      }
    } catch (error) {
      if (isConnectivityExclusion(error)) {
        policyExcludedCandidates += 1;
        return true;
      }
      if (error instanceof KernelError && error.code === "CANONICALIZATION_BUDGET_EXHAUSTED") {
        canonicalizationIndeterminateCandidates += 1;
        exhausted = deepFreeze({
          budget: "maxSearchStates",
          used: error.details.used,
          maximum: error.details.maximum,
          skeletonId: skeleton.id,
          canonicalizationPhase: error.details.phase
        });
        return false;
      }
      throw error;
    }
    return true;
  }

  function enumerateSkeleton(skeleton) {
    const edgeLimit = normalizedOptions.maxEdges === "n+2"
      ? skeleton.nodeCount + 2
      : normalizedOptions.maxEdges;
    if (skeleton.edges.length > edgeLimit) {
      edgeBoundExcludedSkeletons += 1;
      return true;
    }
    const groups = skeleton.edges.map((edge) => ({
      minimum: 1,
      variants: directedVariants(edge, edgeVariants)
    }));
    if (canonicalization.policy.allowSelfLoops) {
      for (let node = 0; node < skeleton.nodeCount; node += 1) {
        groups.push({ minimum: 0, variants: loopVariants(node, edgeVariants) });
      }
    }
    const suffixMinimum = Array(groups.length + 1).fill(0);
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      suffixMinimum[index] = suffixMinimum[index + 1] + groups[index].minimum;
    }

    function visitEdgeGroups(groupIndex, edges) {
      if (exhausted !== null) return false;
      if (!enterState(cursor(skeleton.id, skeleton.nodeCount, groupIndex))) return false;
      if (groupIndex === groups.length) {
        return emitCandidate(skeleton, assignedNodes, edges, groupIndex);
      }
      const group = groups[groupIndex];
      const maximum = canonicalization.policy.allowParallelEdges
        ? edgeLimit - edges.length - suffixMinimum[groupIndex + 1]
        : Math.min(1, edgeLimit - edges.length - suffixMinimum[groupIndex + 1]);
      if (maximum < group.minimum || group.variants.length === 0 && group.minimum > 0) return true;

      function choose(targetSize, start, selected) {
        if (exhausted !== null) return false;
        if (!enterState(cursor(skeleton.id, skeleton.nodeCount, groupIndex))) return false;
        if (selected.length === targetSize) {
          return visitEdgeGroups(groupIndex + 1, edges.concat(selected));
        }
        for (let index = start; index < group.variants.length; index += 1) {
          selected.push(group.variants[index]);
          if (!choose(targetSize, index, selected)) return false;
          selected.pop();
        }
        return true;
      }

      for (let size = group.minimum; size <= maximum; size += 1) {
        if (!choose(size, 0, [])) return false;
      }
      return true;
    }

    const assignedNodes = [];
    function visitNodes(nodeIndex) {
      if (exhausted !== null) return false;
      if (!enterState(cursor(skeleton.id, nodeIndex, null))) return false;
      if (nodeIndex === skeleton.nodeCount) return visitEdgeGroups(0, []);
      for (const variant of nodeVariants) {
        assignedNodes.push(variant);
        if (!visitNodes(nodeIndex + 1)) return false;
        assignedNodes.pop();
      }
      return true;
    }
    return visitNodes(0);
  }

  for (const skeleton of skeletons) {
    if (!enumerateSkeleton(skeleton)) break;
  }

  const status = exhausted === null ? "complete" : "budget-exhausted";
  const candidateStore = status === "complete" ? store.finalize() : store.snapshot();
  if (generatedCandidates !==
      policyExcludedCandidates +
      canonicalizationIndeterminateCandidates +
      candidateStore.counts.attemptedCandidates) {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_COUNT_MISMATCH",
      stage: "ENUMERATE_CANDIDATES",
      message: "Candidate enumeration counts did not reconcile.",
      details: {
        generatedCandidates,
        policyExcludedCandidates,
        canonicalizationIndeterminateCandidates,
        attemptedCandidates: candidateStore.counts.attemptedCandidates
      }
    });
  }

  return deepFreeze({
    schemaVersion: "1",
    enumerator: DECORATED_CANDIDATE_ENUMERATOR_VERSION,
    status,
    interpretable: status === "complete",
    domain,
    graphPolicy: canonicalization.policy,
    skeletonIds: skeletons.map((skeleton) => skeleton.id),
    nodeVariants,
    edgeVariants,
    candidateStore,
    counts: {
      inputSkeletons: skeletons.length,
      edgeBoundExcludedSkeletons,
      decorationStates,
      generatedCandidates,
      policyExcludedCandidates,
      canonicalizationIndeterminateCandidates,
      attemptedCandidates: candidateStore.counts.attemptedCandidates,
      canonicalCandidates: candidateStore.counts.uniqueCandidates,
      duplicateCandidates: candidateStore.counts.duplicateCandidates
    },
    budget: {
      maxEdges: normalizedOptions.maxEdges,
      maxRawCandidates: normalizedOptions.maxRawCandidates,
      maxCandidates: normalizedOptions.maxCandidates,
      maxDecorationStates: normalizedOptions.maxDecorationStates,
      canonicalizationLimits: canonicalization.limits,
      exhausted
    }
  });
}
