import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  enumerateDecoratedCandidatesWithNodeGrowthPruning
} from "./candidate-enumerator.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  createPackageNodeFrontierControllerSession
} from "./package-node-frontier-audit.js";
import {
  enumeratePackageCandidatesWithPruning
} from "./package-pruned-candidate-generator.js";
import {
  createPackageProfileCompositionSession
} from "./package-profile-composition.js";
import {
  assertPackageProfilePruningExtensionEntry,
  packageProfileNodeFrontierKey
} from "./package-profile-pruning-extension.js";

export const PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION =
  "package-node-growth-pruned-candidate-generator-v1";
export const PACKAGE_NODE_GROWTH_PRUNING_STRATEGY =
  "audited-node-assignment-subtree-pruning-v1";

const DEPTH_ONE_NODE_GROWTH_CONTRACT = Object.freeze({
  generator: PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION,
  strategy: PACKAGE_NODE_GROWTH_PRUNING_STRATEGY,
  transcriptHashDomain: HASH_DOMAINS.PACKAGE_NODE_GROWTH_PRUNING_TRANSCRIPT,
  resultSetHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_RESULT_SET,
  generationHashDomain:
    HASH_DOMAINS.PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION
});

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "ENUMERATE_PACKAGE_CANDIDATES_WITH_NODE_GROWTH_PRUNING",
    message,
    details
  });
}

function increment(value, field) {
  if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_COUNT_LIMIT",
      "A node-growth pruning counter exceeded the safe-integer contract.",
      { field, value }
    );
  }
  return value + 1;
}

function add(value, amount, field) {
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    value > Number.MAX_SAFE_INTEGER - amount
  ) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_COUNT_LIMIT",
      "A node-growth pruning aggregate exceeded the safe-integer contract.",
      { field, value, amount }
    );
  }
  return value + amount;
}

function retainedStoreHash(domain, bindingHash, candidateStore) {
  return hashCanonical(domain, {
    schemaVersion: "1",
    bindingHash,
    verdict: "node-growth-retained-candidate-store",
    candidates: candidateStore.candidates.map((entry) => ({
      candidateId: entry.candidateId,
      duplicateCount: entry.duplicateCount
    }))
  });
}

export function enumerateBoundPackageCandidatesWithNodeGrowthPruning(
  controller,
  preAdmission,
  contract,
  context = {}
) {
  if (!new Set(["passed", "not-applicable"]).has(
    controller.nodeFrontierAudit.status
  )) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_AUDIT_NOT_PASSED",
      "Node-growth pruning requires a passed or not-applicable node-frontier audit.",
      { nodeFrontierAuditStatus: controller.nodeFrontierAudit.status }
    );
  }
  const { binding } = controller;
  const canonicalizationOptions = {
    policy: binding.runConfig.graphPolicy,
    limits: binding.enumerationOptions.canonicalizationLimits
  };
  let evaluatedNodeFrontiers = 0;
  let nodeFrontierControllerDecisions = 0;
  let authorizedNodeFrontiers = 0;
  let skippedRawCandidates = 0;
  let skippedProfileCompatibleRawCandidates = 0;
  let skippedProfileExcludedRawCandidates = 0;
  let evaluatedCompleteRawCandidates = 0;
  let evaluatedCompletePrefixes = 0;
  let preAdmissionControllerDecisions = 0;
  let preAdmissionAuthorizedDecisions = 0;
  let transcriptHash = hashCanonical(
    contract.transcriptHashDomain,
    {
      schemaVersion: "1",
      bindingHash: binding.bindingHash,
      canonicalAuditHash: controller.canonicalAudit.auditHash,
      nodeFrontierAuditHash:
        controller.nodeFrontierAudit.nodeFrontierAuditHash,
      strategy: contract.strategy
    }
  );
  const prunedNodeFrontiers = [];
  const compositionSession =
    binding.runConfig.profileCompositionPolicy === "profile-slot-gate-v1"
      ? createPackageProfileCompositionSession(binding)
      : null;
  const profileExtensionIndex = new Map(
    controller.nodeFrontierAudit.profileExtensionUniverse.frontiers.map(
      (entry) => [entry.frontierKey, entry]
    )
  );
  const execution = enumerateDecoratedCandidatesWithNodeGrowthPruning(
    binding.enumerationInput,
    binding.enumerationOptions,
    (frontierInput) => {
      const frontierOrdinal = evaluatedNodeFrontiers;
      evaluatedNodeFrontiers = increment(
        evaluatedNodeFrontiers,
        "evaluatedNodeFrontiers"
      );
      for (const predicateId of controller.authorizedPredicateIds) {
        const decision = controller.evaluate(predicateId, frontierInput);
        nodeFrontierControllerDecisions = increment(
          nodeFrontierControllerDecisions,
          "nodeFrontierControllerDecisions"
        );
        transcriptHash = hashCanonical(
          contract.transcriptHashDomain,
          {
            schemaVersion: "1",
            previousTranscriptHash: transcriptHash,
            decisionKind: "node-assignment-frontier",
            frontierOrdinal,
            predicateId,
            decisionHash: decision.decisionHash
          }
        );
        if (!decision.pruningAuthorized) continue;
        authorizedNodeFrontiers = increment(
          authorizedNodeFrontiers,
          "authorizedNodeFrontiers"
        );
        skippedRawCandidates = add(
          skippedRawCandidates,
          frontierInput.frontier.remainingRawCandidates,
          "skippedRawCandidates"
        );
        const profileFrontierKey = packageProfileNodeFrontierKey(
          binding.bindingHash,
          frontierInput.candidateInput,
          frontierInput.frontier
        );
        const profileExtension = assertPackageProfilePruningExtensionEntry(
          controller.nodeFrontierAudit.profileExtensionUniverse,
          profileFrontierKey,
          frontierInput.frontier.remainingRawCandidates,
          profileExtensionIndex
        );
        skippedProfileCompatibleRawCandidates = add(
          skippedProfileCompatibleRawCandidates,
          profileExtension.compatibleRawCandidates,
          "skippedProfileCompatibleRawCandidates"
        );
        skippedProfileExcludedRawCandidates = add(
          skippedProfileExcludedRawCandidates,
          profileExtension.excludedRawCandidates,
          "skippedProfileExcludedRawCandidates"
        );
        prunedNodeFrontiers.push({
          frontierOrdinal,
          partialGraph: canonicalClone({
            domain: frontierInput.candidateInput.domain,
            nodes: frontierInput.candidateInput.nodes,
            edges: [],
            nodesComplete: false
          }),
          decision,
          profileExtension
        });
        return { pruningAuthorized: true };
      }
      return { pruningAuthorized: false };
    },
    (candidateInput) => {
      const rawCandidateOrdinal = evaluatedCompleteRawCandidates;
      evaluatedCompleteRawCandidates = increment(
        evaluatedCompleteRawCandidates,
        "evaluatedCompleteRawCandidates"
      );
      const canonicalization = canonicalizeCandidate(
        candidateInput,
        canonicalizationOptions
      );
      const candidate = canonicalization.candidate;
      for (
        let partialEdgeCount = 0;
        partialEdgeCount <= candidate.edges.length;
        partialEdgeCount += 1
      ) {
        evaluatedCompletePrefixes = increment(
          evaluatedCompletePrefixes,
          "evaluatedCompletePrefixes"
        );
        const partialGraph = {
          domain: candidate.domain,
          nodes: candidate.nodes,
          edges: candidate.edges.slice(0, partialEdgeCount),
          nodesComplete: true
        };
        for (const predicateId of controller.preAdmissionAuthorizedPredicateIds) {
          const decision = controller.evaluatePreAdmission(
            predicateId,
            partialGraph
          );
          preAdmissionControllerDecisions = increment(
            preAdmissionControllerDecisions,
            "preAdmissionControllerDecisions"
          );
          transcriptHash = hashCanonical(
            contract.transcriptHashDomain,
            {
              schemaVersion: "1",
              previousTranscriptHash: transcriptHash,
              decisionKind: "pre-admission-prefix",
              rawCandidateOrdinal,
              candidateId: canonicalization.candidateId,
              partialEdgeCount,
              predicateId,
              decisionHash: decision.decisionHash
            }
          );
          if (!decision.pruningAuthorized) continue;
          preAdmissionAuthorizedDecisions = increment(
            preAdmissionAuthorizedDecisions,
            "preAdmissionAuthorizedDecisions"
          );
          return { pruningAuthorized: true };
        }
      }
      return { pruningAuthorized: false };
    },
    compositionSession === null
      ? null
      : (canonicalizationResult) => compositionSession.evaluate(
        canonicalizationResult
      )
  );
  const enumeration = execution.enumeration;
  const reference = preAdmission.enumeration;
  if (
    enumeration.status !== "complete" ||
    enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_ENUMERATION_INCOMPLETE",
      "Node-growth pruning requires a complete audited traversal.",
      { exhausted: enumeration.budget.exhausted }
    );
  }
  const expectedPreAdmissionPruned = add(
    preAdmissionAuthorizedDecisions,
    skippedProfileCompatibleRawCandidates,
    "expectedPreAdmissionPruned"
  );
  const storesMatch = canonicalize(enumeration.candidateStore) ===
    canonicalize(reference.candidateStore);
  const countsMatch =
    execution.pruning.nodeBranchPrunedFrontiers === authorizedNodeFrontiers &&
    execution.pruning.nodeBranchPrunedRawCandidates === skippedRawCandidates &&
    execution.pruning.preAdmissionPrunedCandidates ===
      preAdmissionAuthorizedDecisions &&
    skippedProfileCompatibleRawCandidates +
      skippedProfileExcludedRawCandidates === skippedRawCandidates &&
    enumeration.counts.logicalRawCandidates ===
      reference.counts.logicalRawCandidates &&
    enumeration.counts.generatedCandidates + skippedRawCandidates ===
      reference.counts.generatedCandidates &&
    evaluatedCompleteRawCandidates ===
      (compositionSession === null
        ? enumeration.counts.generatedCandidates
        : enumeration.counts.generatedCandidates -
          enumeration.counts.compositionExcludedCandidates -
          enumeration.counts.policyExcludedCandidates) &&
    expectedPreAdmissionPruned ===
      reference.counts.preAdmissionPrunedCandidates &&
    reference.counts.nodeBranchPrunedRawCandidates === 0 &&
    reference.counts.nodeBranchPrunedFrontiers === 0 &&
    enumeration.counts.branchPrunedRawCandidates ===
      reference.counts.branchPrunedRawCandidates &&
    enumeration.counts.branchPrunedFrontiers ===
      reference.counts.branchPrunedFrontiers &&
    enumeration.counts.compositionExcludedCandidates +
      skippedProfileExcludedRawCandidates ===
      reference.counts.compositionExcludedCandidates &&
    enumeration.counts.inputSkeletons === reference.counts.inputSkeletons &&
    enumeration.counts.edgeBoundExcludedSkeletons ===
      reference.counts.edgeBoundExcludedSkeletons &&
    enumeration.counts.policyExcludedCandidates ===
      reference.counts.policyExcludedCandidates &&
    enumeration.counts.canonicalizationIndeterminateCandidates ===
      reference.counts.canonicalizationIndeterminateCandidates;
  if (!storesMatch || !countsMatch) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_DIFFERENTIAL_MISMATCH",
      "Node-growth pruning differs from its verified pre-admission reference.",
      {
        storesMatch,
        nodeGrowthCounts: enumeration.counts,
        preAdmissionCounts: reference.counts,
        authorizedNodeFrontiers,
        skippedRawCandidates,
        skippedProfileCompatibleRawCandidates,
        skippedProfileExcludedRawCandidates,
        preAdmissionAuthorizedDecisions
      }
    );
  }
  const skippedDecorationStates =
    reference.counts.decorationStates - enumeration.counts.decorationStates;
  if (skippedDecorationStates < 0) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_STATE_COUNT_MISMATCH",
      "Node-growth pruning visited more states than its reference."
    );
  }
  const nodeGrowthStoreHash = retainedStoreHash(
    contract.resultSetHashDomain,
    binding.bindingHash,
    enumeration.candidateStore
  );
  const referenceStoreHash = retainedStoreHash(
    contract.resultSetHashDomain,
    binding.bindingHash,
    reference.candidateStore
  );
  const pruning = {
    strategy: contract.strategy,
    transcriptHash,
    nodeFrontierAuthorizedPredicateIds: [...controller.authorizedPredicateIds],
    preAdmissionAuthorizedPredicateIds: [
      ...controller.preAdmissionAuthorizedPredicateIds
    ],
    prunedNodeFrontiers,
    counts: {
      evaluatedNodeFrontiers,
      nodeFrontierControllerDecisions,
      authorizedNodeFrontiers,
      skippedRawCandidates,
      skippedProfileCompatibleRawCandidates,
      skippedProfileExcludedRawCandidates,
      evaluatedCompleteRawCandidates,
      evaluatedCompletePrefixes,
      preAdmissionControllerDecisions,
      preAdmissionAuthorizedDecisions,
      visitedDecorationStates: enumeration.counts.decorationStates,
      referenceDecorationStates: reference.counts.decorationStates,
      skippedDecorationStates
    }
  };
  const conformance = {
    status: "passed",
    preAdmissionGenerationHash: preAdmission.generationHash,
    nodeGrowthRetainedStoreHash: nodeGrowthStoreHash,
    preAdmissionRetainedStoreHash: referenceStoreHash,
    pruningDisabledCanonicalCandidates:
      preAdmission.conformance.pruningDisabledCanonicalCandidates,
    preAdmissionCanonicalCandidates: reference.counts.canonicalCandidates,
    nodeGrowthCanonicalCandidates: enumeration.counts.canonicalCandidates,
    eligible: preAdmission.conformance.eligible,
    indeterminate: preAdmission.conformance.indeterminate
  };
  const basis = {
    schemaVersion: "1",
    generator: contract.generator,
    packageId: controller.nodeFrontierAudit.packageId,
    rulesHash: controller.nodeFrontierAudit.rulesHash,
    bindingHash: binding.bindingHash,
    runConfigHash: binding.runConfigHash,
    canonicalAuditHash: controller.canonicalAudit.auditHash,
    nodeFrontierAuditHash:
      controller.nodeFrontierAudit.nodeFrontierAuditHash,
    ...context,
    binding,
    enumeration,
    profileComposition: preAdmission.profileComposition,
    pruning,
    conformance
  };
  return deepFreeze({
    ...basis,
    generationHash: hashCanonical(
      contract.generationHashDomain,
      basis
    )
  });
}

export function enumeratePackageCandidatesWithNodeGrowthPruning(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  nodeFrontierAuditInput,
  options = {}
) {
  const controller = createPackageNodeFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    nodeFrontierAuditInput,
    options
  );
  const preAdmission = enumeratePackageCandidatesWithPruning(
    loadedPackageInput,
    runConfigInput,
    controller.canonicalAudit,
    options
  );
  return enumerateBoundPackageCandidatesWithNodeGrowthPruning(
    controller,
    preAdmission,
    DEPTH_ONE_NODE_GROWTH_CONTRACT
  );
}

export function verifyPackageCandidatesWithNodeGrowthPruning(
  artifactInput,
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  nodeFrontierAuditInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(artifactInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_ARTIFACT_INVALID",
      "Node-growth pruning artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = enumeratePackageCandidatesWithNodeGrowthPruning(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    nodeFrontierAuditInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NODE_GROWTH_PRUNING_ARTIFACT_MISMATCH",
      "Node-growth pruning artifact differs from exact reproduction.",
      {
        expectedGenerationHash: reproduced.generationHash,
        actualGenerationHash: supplied?.generationHash ?? null
      }
    );
  }
  return reproduced;
}
