import { canonicalClone, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import {
  canonicalizeSkeleton,
  normalizeGraphCanonicalizationOptions
} from "./graph-canonicalizer.js";

const OPTION_FIELDS = new Set(["maxLabelledGraphs", "maxSkeletons", "canonicalizationLimits"]);

export const DEFAULT_SKELETON_ENUMERATION_LIMITS = deepFreeze({
  maxLabelledGraphs: 32_768,
  maxSkeletons: 1_000_000
});

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(code, path, message, details) {
  return validationIssue(code, path, message, details);
}

function normalizeOptions(options, issues) {
  if (!isObject(options)) {
    issues.push(issue("GENERATION_OPTIONS_INVALID", "$options", "Skeleton enumeration options must be an object."));
    return {
      ...DEFAULT_SKELETON_ENUMERATION_LIMITS,
      canonicalizationLimits: {}
    };
  }
  for (const key of Object.keys(options)) {
    if (!OPTION_FIELDS.has(key)) {
      issues.push(issue("GENERATION_OPTION_UNKNOWN", `$options.${key}`, "Unknown skeleton enumeration option.", { key }));
    }
  }
  const normalized = {
    ...DEFAULT_SKELETON_ENUMERATION_LIMITS,
    canonicalizationLimits: options.canonicalizationLimits === undefined ? {} : options.canonicalizationLimits
  };
  for (const field of ["maxLabelledGraphs", "maxSkeletons"]) {
    if (options[field] === undefined) continue;
    if (!Number.isSafeInteger(options[field]) || options[field] < 1) {
      issues.push(issue("GENERATION_BUDGET_INVALID", `$options.${field}`, "Enumeration budget must be a positive safe integer.", {
        value: options[field]
      }));
    } else {
      normalized[field] = options[field];
    }
  }
  if (!isObject(normalized.canonicalizationLimits)) {
    issues.push(issue(
      "GENERATION_CANONICALIZATION_LIMITS_INVALID",
      "$options.canonicalizationLimits",
      "Canonicalization limits must be an object."
    ));
    normalized.canonicalizationLimits = {};
  }
  return normalized;
}

function allPossibleEdges(nodeCount) {
  const edges = [];
  for (let from = 0; from < nodeCount; from += 1) {
    for (let to = from + 1; to < nodeCount; to += 1) edges.push([from, to]);
  }
  return edges;
}

function materializeEdges(possibleEdges, mask) {
  const edges = [];
  possibleEdges.forEach((edge, index) => {
    if ((mask & (1 << index)) !== 0) edges.push(edge);
  });
  return edges;
}

function isConnected(nodeCount, edges) {
  if (nodeCount === 1) return true;
  const adjacency = Array.from({ length: nodeCount }, () => []);
  for (const [from, to] of edges) {
    adjacency[from].push(to);
    adjacency[to].push(from);
  }
  const seen = new Set([0]);
  const pending = [0];
  while (pending.length > 0) {
    const node = pending.pop();
    for (const neighbor of adjacency[node]) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      pending.push(neighbor);
    }
  }
  return seen.size === nodeCount;
}

function exhaustion(budget, used, maximum, details = {}) {
  return deepFreeze({ budget, used, maximum, ...details });
}

export function enumerateConnectedSkeletons(nodeCount, options = {}) {
  const safeNodeCount = canonicalClone(nodeCount);
  const safeOptions = canonicalClone(options);
  const issues = [];
  if (!Number.isSafeInteger(safeNodeCount) || safeNodeCount < 1 || safeNodeCount > 6) {
    issues.push(issue(
      "GENERATION_NODE_COUNT_INVALID",
      "$nodeCount",
      "Connected skeleton enumeration supports an integer node count from 1 through 6.",
      { value: safeNodeCount, minimum: 1, maximum: 6 }
    ));
  }
  const normalized = normalizeOptions(safeOptions, issues);
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Skeleton enumeration configuration failed validation.", {
      code: "GENERATION_VALIDATION_FAILED",
      stage: "ENUMERATE_SKELETONS"
    });
  }
  const canonicalization = normalizeGraphCanonicalizationOptions({
    limits: normalized.canonicalizationLimits
  });

  const possibleEdges = allPossibleEdges(safeNodeCount);
  const totalLabelledGraphs = 2 ** possibleEdges.length;
  const records = new Map();
  let examinedLabelledGraphs = 0;
  let connectedLabelledGraphs = 0;
  let canonicalizedLabelledGraphs = 0;
  let duplicateLabelings = 0;
  let exhausted = null;

  for (let mask = 0; mask < totalLabelledGraphs; mask += 1) {
    if (examinedLabelledGraphs >= normalized.maxLabelledGraphs) {
      exhausted = exhaustion(
        "maxLabelledGraphs",
        examinedLabelledGraphs,
        normalized.maxLabelledGraphs,
        { nextMask: mask, totalLabelledGraphs }
      );
      break;
    }
    examinedLabelledGraphs += 1;
    const edges = materializeEdges(possibleEdges, mask);
    if (!isConnected(safeNodeCount, edges)) continue;
    connectedLabelledGraphs += 1;

    const result = canonicalizeSkeleton(
      { nodeCount: safeNodeCount, edges },
      { limits: canonicalization.limits }
    );
    canonicalizedLabelledGraphs += 1;
    const existing = records.get(result.skeletonId);
    if (existing) {
      if (existing.canonicalForm.bytesBase64 !== result.canonicalForm.bytesBase64) {
        throw new KernelError({
          code: "CANONICALIZATION_HASH_COLLISION",
          stage: "ENUMERATE_SKELETONS",
          message: "Distinct canonical skeleton bytes produced the same content identifier.",
          details: { skeletonId: result.skeletonId }
        });
      }
      existing.labelledMultiplicity += 1;
      duplicateLabelings += 1;
      continue;
    }
    if (records.size >= normalized.maxSkeletons) {
      exhausted = exhaustion("maxSkeletons", records.size, normalized.maxSkeletons, {
        firstExcludedSkeletonId: result.skeletonId,
        mask
      });
      break;
    }
    records.set(result.skeletonId, {
      id: result.skeletonId,
      nodeCount: result.canonical.nodeCount,
      edges: result.canonical.edges,
      canonicalForm: result.canonicalForm,
      labelledMultiplicity: 1
    });
  }

  const skeletons = [...records.values()]
    .sort((left, right) => compareStrings(left.id, right.id))
    .map((record) => deepFreeze({ ...record }));
  const status = exhausted === null ? "complete" : "budget-exhausted";
  return deepFreeze({
    schemaVersion: "1",
    status,
    interpretable: status === "complete",
    nodeCount: safeNodeCount,
    skeletons,
    counts: {
      totalLabelledGraphs,
      examinedLabelledGraphs,
      connectedLabelledGraphs,
      canonicalizedLabelledGraphs,
      uniqueSkeletons: skeletons.length,
      duplicateLabelings
    },
    budget: {
      maxLabelledGraphs: normalized.maxLabelledGraphs,
      maxSkeletons: normalized.maxSkeletons,
      canonicalizationLimits: canonicalization.limits,
      exhausted
    }
  });
}
