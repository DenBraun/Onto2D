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

export const DECORATED_CANDIDATE_ENUMERATOR_VERSION = "decorated-candidate-enumerator-v5";

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

function multisetCount(variantCount, selectionSize) {
  if (selectionSize === 0) return 1n;
  if (variantCount === 0) return 0n;
  let result = 1n;
  for (let factor = 1; factor < variantCount; factor += 1) {
    result = result * (BigInt(selectionSize) + BigInt(factor)) / BigInt(factor);
  }
  return result;
}

function safeCount(value, code, message, details) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new KernelError({
      code,
      stage: "ENUMERATE_CANDIDATES",
      message,
      details: { ...details, value: value.toString() }
    });
  }
  return Number(value);
}

/**
 * Exhaustively decorates a finite canonical skeleton set. The caller supplies
 * complete finite node and edge variant alphabets; this function does not
 * derive scientific roles or attributes and does not evaluate predicates.
 */
function enumerateDecoratedCandidatesCore(
  input,
  options,
  {
    preAdmissionPruner = null,
    completeCandidateObserver = null,
    rawCandidateObserver = null,
    edgeGroupFrontierPruner = null,
    nodeFrontierObserver = null,
    nodeFrontierPruner = null,
    completeCandidateGate = null
  } = {}
) {
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
  let preAdmissionPrunedCandidates = 0;
  let branchPrunedRawCandidates = 0;
  let branchPrunedFrontiers = 0;
  let nodeBranchPrunedRawCandidates = 0;
  let nodeBranchPrunedFrontiers = 0;
  let compositionExcludedCandidates = 0;
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

  function emitCandidate(
    skeleton,
    nodes,
    edges,
    edgeGroupIndex,
    edgeGroupCounts
  ) {
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
    if (rawCandidateObserver !== null) {
      rawCandidateObserver({
        rawCandidateOrdinal: generatedCandidates - 1,
        candidateInput: { domain, nodes, edges, skeleton: skeleton.id },
        edgeGroupCounts: [...edgeGroupCounts]
      });
    }
    try {
      const candidateInput = { domain, nodes, edges, skeleton: skeleton.id };
      if (completeCandidateGate !== null) {
        const canonicalizationResult = canonicalizeCandidate(
          candidateInput,
          canonicalization
        );
        const decision = completeCandidateGate(canonicalizationResult);
        if (
          !isObject(decision) ||
          !new Set(["pass", "exclude"]).has(decision.outcome)
        ) {
          throw new KernelError({
            code: "CANDIDATE_ENUMERATION_COMPOSITION_GATE_RESULT_INVALID",
            stage: "ENUMERATE_CANDIDATES",
            message: "The internal complete-candidate composition gate returned an invalid decision."
          });
        }
        if (decision.outcome === "exclude") {
          compositionExcludedCandidates += 1;
          return true;
        }
      }
      if (preAdmissionPruner !== null) {
        const decision = preAdmissionPruner(candidateInput);
        if (!isObject(decision) || typeof decision.pruningAuthorized !== "boolean") {
          throw new KernelError({
            code: "CANDIDATE_ENUMERATION_PRUNER_RESULT_INVALID",
            stage: "ENUMERATE_CANDIDATES",
            message: "The internal pre-admission pruner returned an invalid decision."
          });
        }
        if (decision.pruningAuthorized) {
          preAdmissionPrunedCandidates += 1;
          return true;
        }
      }
      const result = store.add(candidateInput);
      if (result.status === "budget-exhausted") {
        exhausted = result.exhaustion;
        return false;
      }
      if (completeCandidateObserver !== null) {
        completeCandidateObserver({
          rawCandidateOrdinal: generatedCandidates - 1,
          candidateInput,
          canonicalization: result.canonicalization,
          edgeGroupCounts: [...edgeGroupCounts]
        });
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

    const completionMemo = new Map();
    function countRawCompletions(groupIndex, edgeCount) {
      if (groupIndex === groups.length) return 1n;
      const key = `${groupIndex}:${edgeCount}`;
      const cached = completionMemo.get(key);
      if (cached !== undefined) return cached;
      const group = groups[groupIndex];
      const maximum = canonicalization.policy.allowParallelEdges
        ? edgeLimit - edgeCount - suffixMinimum[groupIndex + 1]
        : Math.min(1, edgeLimit - edgeCount - suffixMinimum[groupIndex + 1]);
      let total = 0n;
      if (maximum >= group.minimum && !(group.variants.length === 0 && group.minimum > 0)) {
        for (let size = group.minimum; size <= maximum; size += 1) {
          total += multisetCount(group.variants.length, size) *
            countRawCompletions(groupIndex + 1, edgeCount + size);
        }
      }
      completionMemo.set(key, total);
      return total;
    }

    function visitEdgeGroups(groupIndex, edges, edgeGroupCounts) {
      if (exhausted !== null) return false;
      if (!enterState(cursor(skeleton.id, skeleton.nodeCount, groupIndex))) return false;
      if (
        edgeGroupFrontierPruner !== null &&
        groupIndex < groups.length
      ) {
        const remainingRawCandidates = safeCount(
          countRawCompletions(groupIndex, edges.length),
          "CANDIDATE_ENUMERATION_PRUNED_RAW_COUNT_LIMIT",
          "A recursively pruned subtree exceeds the safe-integer counting contract.",
          { skeletonId: skeleton.id, groupIndex, edgeCount: edges.length }
        );
        const decision = edgeGroupFrontierPruner({
          candidateInput: {
            domain,
            nodes: assignedNodes,
            edges,
            skeleton: skeleton.id
          },
          frontier: {
            skeletonId: skeleton.id,
            completedEdgeGroups: groupIndex,
            totalEdgeGroups: groups.length,
            edgeGroupCounts: [...edgeGroupCounts],
            remainingRawCandidates
          }
        });
        if (!isObject(decision) || typeof decision.pruningAuthorized !== "boolean") {
          throw new KernelError({
            code: "CANDIDATE_ENUMERATION_FRONTIER_PRUNER_RESULT_INVALID",
            stage: "ENUMERATE_CANDIDATES",
            message: "The internal edge-group frontier pruner returned an invalid decision."
          });
        }
        if (decision.pruningAuthorized) {
          if (!Number.isSafeInteger(
            branchPrunedRawCandidates + remainingRawCandidates
          )) {
            throw new KernelError({
              code: "CANDIDATE_ENUMERATION_PRUNED_RAW_COUNT_LIMIT",
              stage: "ENUMERATE_CANDIDATES",
              message: "Recursive pruning counts exceeded the safe-integer contract.",
              details: { branchPrunedRawCandidates, remainingRawCandidates }
            });
          }
          branchPrunedRawCandidates += remainingRawCandidates;
          branchPrunedFrontiers += 1;
          return true;
        }
      }
      if (groupIndex === groups.length) {
        return emitCandidate(
          skeleton,
          assignedNodes,
          edges,
          groupIndex,
          edgeGroupCounts
        );
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
          return visitEdgeGroups(
            groupIndex + 1,
            edges.concat(selected),
            edgeGroupCounts.concat(selected.length)
          );
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
      if (nodeIndex === skeleton.nodeCount) return visitEdgeGroups(0, [], []);
      if (
        nodeIndex > 0 &&
        (nodeFrontierObserver !== null || nodeFrontierPruner !== null)
      ) {
        const remainingNodeAssignments = skeleton.nodeCount - nodeIndex;
        const edgeRawCandidatesPerAssignment = safeCount(
          countRawCompletions(0, 0),
          "CANDIDATE_ENUMERATION_NODE_FRONTIER_COUNT_LIMIT",
          "A node frontier's edge descendants exceed the safe-integer counting contract.",
          { skeletonId: skeleton.id, nodeIndex }
        );
        const remainingRawCandidates = safeCount(
          BigInt(edgeRawCandidatesPerAssignment) *
            BigInt(nodeVariants.length) ** BigInt(remainingNodeAssignments),
          "CANDIDATE_ENUMERATION_NODE_FRONTIER_COUNT_LIMIT",
          "A node frontier's raw descendants exceed the safe-integer counting contract.",
          { skeletonId: skeleton.id, nodeIndex, remainingNodeAssignments }
        );
        const frontierInput = {
          candidateInput: {
            domain,
            nodes: [...assignedNodes],
            edges: [],
            skeleton: skeleton.id
          },
          frontier: {
            skeletonId: skeleton.id,
            assignedNodes: nodeIndex,
            totalNodes: skeleton.nodeCount,
            remainingNodeAssignments,
            edgeRawCandidatesPerAssignment,
            remainingRawCandidates
          }
        };
        if (nodeFrontierObserver !== null) nodeFrontierObserver(frontierInput);
        if (nodeFrontierPruner !== null) {
          const decision = nodeFrontierPruner(frontierInput);
          if (
            !isObject(decision) ||
            typeof decision.pruningAuthorized !== "boolean"
          ) {
            throw new KernelError({
              code: "CANDIDATE_ENUMERATION_NODE_FRONTIER_PRUNER_RESULT_INVALID",
              stage: "ENUMERATE_CANDIDATES",
              message: "The internal node-frontier pruner returned an invalid decision."
            });
          }
          if (decision.pruningAuthorized) {
            if (!Number.isSafeInteger(
              nodeBranchPrunedRawCandidates + remainingRawCandidates
            )) {
              throw new KernelError({
                code: "CANDIDATE_ENUMERATION_NODE_FRONTIER_COUNT_LIMIT",
                stage: "ENUMERATE_CANDIDATES",
                message: "Node-frontier pruning counts exceeded the safe-integer contract.",
                details: {
                  nodeBranchPrunedRawCandidates,
                  remainingRawCandidates
                }
              });
            }
            nodeBranchPrunedRawCandidates += remainingRawCandidates;
            nodeBranchPrunedFrontiers += 1;
            return true;
          }
        }
      }
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
  const logicalRawCandidates = generatedCandidates +
    branchPrunedRawCandidates + nodeBranchPrunedRawCandidates;
  if (!Number.isSafeInteger(logicalRawCandidates)) {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_LOGICAL_RAW_COUNT_LIMIT",
      stage: "ENUMERATE_CANDIDATES",
      message: "The logical raw-candidate census exceeded the safe-integer contract.",
      details: {
        generatedCandidates,
        branchPrunedRawCandidates,
        nodeBranchPrunedRawCandidates
      }
    });
  }
  if (generatedCandidates !==
      policyExcludedCandidates +
      canonicalizationIndeterminateCandidates +
      compositionExcludedCandidates +
      preAdmissionPrunedCandidates +
      candidateStore.counts.attemptedCandidates) {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_COUNT_MISMATCH",
      stage: "ENUMERATE_CANDIDATES",
      message: "Candidate enumeration counts did not reconcile.",
      details: {
        generatedCandidates,
        policyExcludedCandidates,
        canonicalizationIndeterminateCandidates,
        compositionExcludedCandidates,
        preAdmissionPrunedCandidates,
        attemptedCandidates: candidateStore.counts.attemptedCandidates
      }
    });
  }

  const enumeration = deepFreeze({
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
      logicalRawCandidates,
      policyExcludedCandidates,
      canonicalizationIndeterminateCandidates,
      compositionExcludedCandidates,
      preAdmissionPrunedCandidates,
      branchPrunedRawCandidates,
      branchPrunedFrontiers,
      nodeBranchPrunedRawCandidates,
      nodeBranchPrunedFrontiers,
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
  return Object.freeze({
    enumeration,
    pruning: deepFreeze({
      enabled: preAdmissionPruner !== null ||
        edgeGroupFrontierPruner !== null || nodeFrontierPruner !== null,
      preAdmissionPrunedCandidates,
      branchPrunedRawCandidates,
      branchPrunedFrontiers,
      nodeBranchPrunedRawCandidates,
      nodeBranchPrunedFrontiers
    })
  });
}

/** Internal exact profile-slot gate over complete canonical candidates. */
export function enumerateDecoratedCandidatesWithCompositionGate(
  input,
  options,
  completeCandidateGate
) {
  if (typeof completeCandidateGate !== "function") {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_COMPOSITION_GATE_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal profile composition gating requires a decision function."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    completeCandidateGate
  }).enumeration;
}

export function enumerateDecoratedCandidates(input, options = {}) {
  return enumerateDecoratedCandidatesCore(input, options).enumeration;
}

/**
 * Internal package-integration boundary. Public callers use the ordinary
 * two-argument enumerator; only a previously verified package controller may
 * supply this synchronous pre-admission decision function.
 */
export function enumerateDecoratedCandidatesWithPreAdmissionPruning(
  input,
  options,
  preAdmissionPruner
) {
  if (typeof preAdmissionPruner !== "function") {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_PRUNER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal pre-admission pruning requires a decision function."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    preAdmissionPruner
  });
}

/**
 * Internal package boundary for an exact complete-candidate composition gate
 * followed by audited pre-admission pruning. The gate deliberately runs first
 * so the pruning controller observes exactly the profile-compatible universe.
 */
export function enumerateDecoratedCandidatesWithCompositionGateAndPreAdmissionPruning(
  input,
  options,
  completeCandidateGate,
  preAdmissionPruner
) {
  if (
    typeof completeCandidateGate !== "function" ||
    typeof preAdmissionPruner !== "function"
  ) {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_COMBINED_GATE_PRUNER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal combined composition gating and pre-admission pruning require two decision functions."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    completeCandidateGate,
    preAdmissionPruner
  });
}

/** Internal read-only traversal hook used to audit reachable edge frontiers. */
export function enumerateDecoratedCandidatesWithFrontierObserver(
  input,
  options,
  completeCandidateObserver
) {
  if (typeof completeCandidateObserver !== "function") {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_FRONTIER_OBSERVER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal frontier observation requires a callback function."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    completeCandidateObserver
  });
}

/** Internal raw-leaf hook used by the replay-resumable coordinator. */
export function enumerateDecoratedCandidatesWithRawCandidateObserver(
  input,
  options,
  rawCandidateObserver
) {
  if (typeof rawCandidateObserver !== "function") {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_RAW_OBSERVER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal raw-candidate observation requires a callback function."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    rawCandidateObserver
  });
}

/** Internal read-only traversal hook for strict incomplete-node frontiers. */
export function enumerateDecoratedCandidatesWithNodeFrontierObserver(
  input,
  options,
  nodeFrontierObserver
) {
  if (typeof nodeFrontierObserver !== "function") {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_NODE_FRONTIER_OBSERVER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal node-frontier observation requires a callback function."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    nodeFrontierObserver
  });
}

/** Internal exact node-assignment subtree-pruning boundary. */
export function enumerateDecoratedCandidatesWithNodeFrontierPruning(
  input,
  options,
  nodeFrontierPruner
) {
  if (typeof nodeFrontierPruner !== "function") {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_NODE_FRONTIER_PRUNER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal node-frontier pruning requires a decision function."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    nodeFrontierPruner
  });
}

/** Internal audited node-growth boundary with complete-candidate fallback. */
export function enumerateDecoratedCandidatesWithNodeGrowthPruning(
  input,
  options,
  nodeFrontierPruner,
  preAdmissionPruner,
  completeCandidateGate = null
) {
  if (
    typeof nodeFrontierPruner !== "function" ||
    typeof preAdmissionPruner !== "function" ||
    (completeCandidateGate !== null &&
      typeof completeCandidateGate !== "function")
  ) {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_NODE_GROWTH_PRUNER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal node-growth pruning requires frontier and pre-admission decision functions."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    nodeFrontierPruner,
    preAdmissionPruner,
    completeCandidateGate
  });
}

/** Internal audited recursive edge-group pruning boundary. */
export function enumerateDecoratedCandidatesWithRecursivePruning(
  input,
  options,
  edgeGroupFrontierPruner,
  preAdmissionPruner,
  completeCandidateGate = null
) {
  if (
    typeof edgeGroupFrontierPruner !== "function" ||
    typeof preAdmissionPruner !== "function" ||
    (completeCandidateGate !== null &&
      typeof completeCandidateGate !== "function")
  ) {
    throw new KernelError({
      code: "CANDIDATE_ENUMERATION_RECURSIVE_PRUNER_INVALID",
      stage: "ENUMERATE_CANDIDATES",
      message: "Internal recursive pruning requires frontier and pre-admission decision functions."
    });
  }
  return enumerateDecoratedCandidatesCore(input, options, {
    edgeGroupFrontierPruner,
    preAdmissionPruner,
    completeCandidateGate
  });
}
