import { deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  createPackageProfileCompositionSession
} from "./package-profile-composition.js";

export const PACKAGE_PROFILE_PRUNING_EXTENSION_CENSUS_VERSION =
  "package-profile-pruning-extension-census-v1";

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "AUDIT_PACKAGE_PROFILE_PRUNING_EXTENSIONS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function increment(value, field) {
  if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) {
    fail(
      "PACKAGE_PROFILE_PRUNING_EXTENSION_COUNT_LIMIT",
      "A profile-pruning extension count exceeded the safe-integer contract.",
      { field, value }
    );
  }
  return value + 1;
}

function frontierKey(domain, bindingHash, kind, candidateInput, frontier) {
  return hashCanonical(domain, {
    schemaVersion: "1",
    bindingHash,
    kind,
    candidateInput,
    frontier
  });
}

export function packageProfileEdgeFrontierKey(
  bindingHash,
  candidateInput,
  frontier
) {
  return frontierKey(
    HASH_DOMAINS.PACKAGE_PROFILE_EDGE_FRONTIER_KEY,
    bindingHash,
    "edge-group",
    candidateInput,
    {
      skeletonId: frontier.skeletonId,
      completedEdgeGroups: frontier.completedEdgeGroups,
      totalEdgeGroups: frontier.totalEdgeGroups,
      edgeGroupCounts: [...frontier.edgeGroupCounts]
    }
  );
}

export function packageProfileNodeFrontierKey(
  bindingHash,
  candidateInput,
  frontier
) {
  return frontierKey(
    HASH_DOMAINS.PACKAGE_PROFILE_NODE_FRONTIER_KEY,
    bindingHash,
    "node-assignment",
    candidateInput,
    {
      skeletonId: frontier.skeletonId,
      assignedNodes: frontier.assignedNodes,
      totalNodes: frontier.totalNodes,
      remainingNodeAssignments: frontier.remainingNodeAssignments
    }
  );
}

function addDisposition(map, key, outcome) {
  let entry = map.get(key);
  if (entry === undefined) {
    entry = {
      frontierKey: key,
      compatibleRawCandidates: 0,
      excludedRawCandidates: 0
    };
    map.set(key, entry);
  }
  if (outcome === "pass") {
    entry.compatibleRawCandidates = increment(
      entry.compatibleRawCandidates,
      "frontiers.compatibleRawCandidates"
    );
  } else {
    entry.excludedRawCandidates = increment(
      entry.excludedRawCandidates,
      "frontiers.excludedRawCandidates"
    );
  }
}

function sumPrefix(values, length) {
  let result = 0;
  for (let index = 0; index < length; index += 1) result += values[index];
  return result;
}

/**
 * Classifies every graph-policy-admissible raw extension and aggregates its
 * complete profile decision onto each strict edge and node prefix that can
 * reach it. The resulting maps are later matched against live frontier keys.
 */
export function createPackageProfilePruningExtensionCensus(binding) {
  const policy = binding.runConfig.profileCompositionPolicy;
  const compositionSession = policy === "profile-slot-gate-v1"
    ? createPackageProfileCompositionSession(binding)
    : null;
  const compatibleCandidateIds = new Set();
  const edgeFrontiers = new Map();
  const nodeFrontiers = new Map();
  let rawExtensionCandidates = 0;
  let compatibleRawExtensionCandidates = 0;
  let excludedRawExtensionCandidates = 0;

  return Object.freeze({
    observe(entry) {
      const outcome = compositionSession === null
        ? "pass"
        : compositionSession.evaluate(entry.canonicalization).outcome;
      rawExtensionCandidates = increment(
        rawExtensionCandidates,
        "rawExtensionCandidates"
      );
      if (outcome === "pass") {
        compatibleRawExtensionCandidates = increment(
          compatibleRawExtensionCandidates,
          "compatibleRawExtensionCandidates"
        );
        compatibleCandidateIds.add(entry.canonicalization.candidateId);
      } else {
        excludedRawExtensionCandidates = increment(
          excludedRawExtensionCandidates,
          "excludedRawExtensionCandidates"
        );
      }

      for (
        let completedEdgeGroups = 0;
        completedEdgeGroups < entry.edgeGroupCounts.length;
        completedEdgeGroups += 1
      ) {
        const partialEdgeCount = sumPrefix(
          entry.edgeGroupCounts,
          completedEdgeGroups
        );
        const candidateInput = {
          domain: entry.candidateInput.domain,
          nodes: entry.candidateInput.nodes,
          edges: entry.candidateInput.edges.slice(0, partialEdgeCount),
          skeleton: entry.candidateInput.skeleton
        };
        const frontier = {
          skeletonId: entry.candidateInput.skeleton,
          completedEdgeGroups,
          totalEdgeGroups: entry.edgeGroupCounts.length,
          edgeGroupCounts: entry.edgeGroupCounts.slice(0, completedEdgeGroups)
        };
        addDisposition(
          edgeFrontiers,
          packageProfileEdgeFrontierKey(
            binding.bindingHash,
            candidateInput,
            frontier
          ),
          outcome
        );
      }

      for (
        let assignedNodes = 1;
        assignedNodes < entry.candidateInput.nodes.length;
        assignedNodes += 1
      ) {
        const remainingNodeAssignments =
          entry.candidateInput.nodes.length - assignedNodes;
        const candidateInput = {
          domain: entry.candidateInput.domain,
          nodes: entry.candidateInput.nodes.slice(0, assignedNodes),
          edges: [],
          skeleton: entry.candidateInput.skeleton
        };
        const frontier = {
          skeletonId: entry.candidateInput.skeleton,
          assignedNodes,
          totalNodes: entry.candidateInput.nodes.length,
          remainingNodeAssignments
        };
        addDisposition(
          nodeFrontiers,
          packageProfileNodeFrontierKey(
            binding.bindingHash,
            candidateInput,
            frontier
          ),
          outcome
        );
      }
    },
    finalize(kind) {
      if (kind !== "edge-group" && kind !== "node-assignment") {
        fail(
          "PACKAGE_PROFILE_PRUNING_EXTENSION_KIND_INVALID",
          "A profile-pruning extension census requires a known frontier kind.",
          { kind }
        );
      }
      const candidateIds = [...compatibleCandidateIds].sort(compareStrings);
      const source = kind === "edge-group" ? edgeFrontiers : nodeFrontiers;
      const frontiers = [...source.values()].sort((left, right) =>
        compareStrings(left.frontierKey, right.frontierKey)
      );
      const censusHashDomain = kind === "edge-group"
        ? HASH_DOMAINS.PACKAGE_PROFILE_EDGE_FRONTIER_CENSUS
        : HASH_DOMAINS.PACKAGE_PROFILE_NODE_FRONTIER_CENSUS;
      const censusHash = hashCanonical(censusHashDomain, {
        schemaVersion: "1",
        bindingHash: binding.bindingHash,
        kind,
        frontiers
      });
      const basis = {
        schemaVersion: "1",
        evaluator: PACKAGE_PROFILE_PRUNING_EXTENSION_CENSUS_VERSION,
        bindingHash: binding.bindingHash,
        policy,
        status: policy === "profile-slot-gate-v1" ? "complete" : "not-run",
        kind,
        rawExtensionCandidates,
        compatibleRawExtensionCandidates,
        excludedRawExtensionCandidates,
        compatibleCanonicalCandidateCount: candidateIds.length,
        compatibleCanonicalCandidateHash: hashCanonical(
          HASH_DOMAINS.PACKAGE_PROFILE_PRUNING_EXTENSION_UNIVERSE,
          {
            schemaVersion: "1",
            bindingHash: binding.bindingHash,
            candidateIds
          }
        ),
        frontiers,
        censusHash
      };
      return {
        compatibleCandidateIds: deepFreeze(candidateIds),
        artifact: deepFreeze({
          ...basis,
          extensionUniverseHash: hashCanonical(
            HASH_DOMAINS.PACKAGE_PROFILE_PRUNING_EXTENSION_UNIVERSE,
            basis
          )
        }),
        byKey: new Map(frontiers.map((entry) => [entry.frontierKey, entry]))
      };
    }
  });
}

export function assertPackageProfilePruningExtensionEntry(
  extensionUniverse,
  frontierKey,
  remainingRawCandidates,
  frontierIndex = null
) {
  const entry = frontierIndex === null
    ? extensionUniverse.frontiers.find(
      (candidate) => candidate.frontierKey === frontierKey
    )
    : frontierIndex.get(frontierKey);
  if (entry === undefined) {
    fail(
      "PACKAGE_PROFILE_PRUNING_FRONTIER_UNBOUND",
      "A live pruning frontier is absent from the audited profile extension census.",
      { frontierKey }
    );
  }
  const observed = entry.compatibleRawCandidates + entry.excludedRawCandidates;
  if (observed !== remainingRawCandidates) {
    fail(
      "PACKAGE_PROFILE_PRUNING_FRONTIER_COUNT_MISMATCH",
      "A live pruning frontier differs from its audited profile extension count.",
      { frontierKey, observed, remainingRawCandidates }
    );
  }
  return entry;
}
