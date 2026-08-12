import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  enumerateDecoratedCandidatesWithRecursivePruning
} from "./candidate-enumerator.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  createPackageGeneratorFrontierControllerSession
} from "./package-generator-frontier-audit.js";
import {
  enumeratePackageCandidatesWithPruning
} from "./package-pruned-candidate-generator.js";
import {
  createPackageProfileCompositionSession
} from "./package-profile-composition.js";
import {
  assertPackageProfilePruningExtensionEntry,
  packageProfileEdgeFrontierKey
} from "./package-profile-pruning-extension.js";

export const PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION =
  "package-recursive-pruned-candidate-generator-v1";
export const PACKAGE_RECURSIVE_PRUNING_STRATEGY =
  "audited-edge-group-subtree-pruning-v1";

const DEPTH_ONE_RECURSIVE_PRUNING_CONTRACT = Object.freeze({
  generator: PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION,
  strategy: PACKAGE_RECURSIVE_PRUNING_STRATEGY,
  transcriptHashDomain: HASH_DOMAINS.PACKAGE_RECURSIVE_PRUNING_TRANSCRIPT,
  resultSetHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_RESULT_SET,
  generationHashDomain:
    HASH_DOMAINS.PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATION
});

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "ENUMERATE_PACKAGE_CANDIDATES_WITH_RECURSIVE_PRUNING",
    message,
    details
  });
}

function incrementCounter(value, field) {
  if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_COUNT_LIMIT",
      "A recursive-pruning counter exceeded the safe-integer contract.",
      { field, value }
    );
  }
  return value + 1;
}

function addCounter(value, amount, field) {
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    value > Number.MAX_SAFE_INTEGER - amount
  ) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_COUNT_LIMIT",
      "A recursive-pruning aggregate exceeded the safe-integer contract.",
      { field, value, amount }
    );
  }
  return value + amount;
}

function retainedStoreHash(domain, bindingHash, candidateStore) {
  return hashCanonical(domain, {
    schemaVersion: "1",
    bindingHash,
    verdict: "recursive-retained-candidate-store",
    candidates: candidateStore.candidates.map((entry) => ({
      candidateId: entry.candidateId,
      duplicateCount: entry.duplicateCount
    }))
  });
}

/**
 * Closes audited edge-group subtrees, retains pre-admission pruning as a final
 * guard, and requires exact agreement with both pre-admission-only and fully
 * disabled reference execution before returning an interpretable artifact.
 */
export function enumerateBoundPackageCandidatesWithRecursivePruning(
  controller,
  preAdmission,
  contract,
  context = {}
) {
  if (!new Set(["passed", "not-applicable"]).has(controller.frontierAudit.status)) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_FRONTIER_AUDIT_NOT_PASSED",
      "Recursive pruning requires a passed or not-applicable generator-frontier audit.",
      { frontierAuditStatus: controller.frontierAudit.status }
    );
  }
  const { binding } = controller;
  const canonicalizationOptions = {
    policy: binding.runConfig.graphPolicy,
    limits: binding.enumerationOptions.canonicalizationLimits
  };
  let evaluatedFrontiers = 0;
  let frontierControllerDecisions = 0;
  let authorizedFrontiers = 0;
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
      frontierAuditHash: controller.frontierAudit.frontierAuditHash,
      strategy: contract.strategy
    }
  );
  const prunedFrontiers = [];
  const compositionSession =
    binding.runConfig.profileCompositionPolicy === "profile-slot-gate-v1"
      ? createPackageProfileCompositionSession(binding)
      : null;
  const profileExtensionIndex = new Map(
    controller.frontierAudit.profileExtensionUniverse.frontiers.map(
      (entry) => [entry.frontierKey, entry]
    )
  );

  const execution = enumerateDecoratedCandidatesWithRecursivePruning(
    binding.enumerationInput,
    binding.enumerationOptions,
    (frontierInput) => {
      const frontierOrdinal = evaluatedFrontiers;
      evaluatedFrontiers = incrementCounter(
        evaluatedFrontiers,
        "evaluatedFrontiers"
      );
      for (const predicateId of controller.authorizedPredicateIds) {
        const decision = controller.evaluate(predicateId, frontierInput);
        frontierControllerDecisions = incrementCounter(
          frontierControllerDecisions,
          "frontierControllerDecisions"
        );
        transcriptHash = hashCanonical(
          contract.transcriptHashDomain,
          {
            schemaVersion: "1",
            previousTranscriptHash: transcriptHash,
            decisionKind: "edge-group-frontier",
            frontierOrdinal,
            predicateId,
            decisionHash: decision.decisionHash
          }
        );
        if (!decision.pruningAuthorized) continue;
        authorizedFrontiers = incrementCounter(
          authorizedFrontiers,
          "authorizedFrontiers"
        );
        skippedRawCandidates = addCounter(
          skippedRawCandidates,
          frontierInput.frontier.remainingRawCandidates,
          "skippedRawCandidates"
        );
        const profileFrontierKey = packageProfileEdgeFrontierKey(
          binding.bindingHash,
          frontierInput.candidateInput,
          frontierInput.frontier
        );
        const profileExtension = assertPackageProfilePruningExtensionEntry(
          controller.frontierAudit.profileExtensionUniverse,
          profileFrontierKey,
          frontierInput.frontier.remainingRawCandidates,
          profileExtensionIndex
        );
        skippedProfileCompatibleRawCandidates = addCounter(
          skippedProfileCompatibleRawCandidates,
          profileExtension.compatibleRawCandidates,
          "skippedProfileCompatibleRawCandidates"
        );
        skippedProfileExcludedRawCandidates = addCounter(
          skippedProfileExcludedRawCandidates,
          profileExtension.excludedRawCandidates,
          "skippedProfileExcludedRawCandidates"
        );
        prunedFrontiers.push({
          frontierOrdinal,
          partialGraph: canonicalClone({
            domain: frontierInput.candidateInput.domain,
            nodes: frontierInput.candidateInput.nodes,
            edges: frontierInput.candidateInput.edges,
            nodesComplete: true
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
      evaluatedCompleteRawCandidates = incrementCounter(
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
        evaluatedCompletePrefixes = incrementCounter(
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
          preAdmissionControllerDecisions = incrementCounter(
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
          preAdmissionAuthorizedDecisions = incrementCounter(
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
  if (
    enumeration.status !== "complete" ||
    enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_ENUMERATION_INCOMPLETE",
      "Recursive pruning requires a complete audited traversal.",
      { exhausted: enumeration.budget.exhausted }
    );
  }
  const expectedPreAdmissionPruned = addCounter(
    preAdmissionAuthorizedDecisions,
    skippedProfileCompatibleRawCandidates,
    "expectedPreAdmissionPruned"
  );
  const preAdmissionEnumeration = preAdmission.enumeration;
  const storesMatch = canonicalize(enumeration.candidateStore) ===
    canonicalize(preAdmissionEnumeration.candidateStore);
  const countsMatch =
    execution.pruning.branchPrunedFrontiers === authorizedFrontiers &&
    execution.pruning.branchPrunedRawCandidates === skippedRawCandidates &&
    execution.pruning.preAdmissionPrunedCandidates ===
      preAdmissionAuthorizedDecisions &&
    skippedProfileCompatibleRawCandidates +
      skippedProfileExcludedRawCandidates === skippedRawCandidates &&
    enumeration.counts.logicalRawCandidates ===
      preAdmissionEnumeration.counts.logicalRawCandidates &&
    enumeration.counts.generatedCandidates + skippedRawCandidates ===
      preAdmissionEnumeration.counts.generatedCandidates &&
    evaluatedCompleteRawCandidates ===
      (compositionSession === null
        ? enumeration.counts.generatedCandidates
        : enumeration.counts.generatedCandidates -
          enumeration.counts.compositionExcludedCandidates -
          enumeration.counts.policyExcludedCandidates) &&
    expectedPreAdmissionPruned ===
      preAdmissionEnumeration.counts.preAdmissionPrunedCandidates &&
    enumeration.counts.compositionExcludedCandidates +
      skippedProfileExcludedRawCandidates ===
      preAdmissionEnumeration.counts.compositionExcludedCandidates &&
    enumeration.counts.policyExcludedCandidates ===
      preAdmissionEnumeration.counts.policyExcludedCandidates &&
    enumeration.counts.canonicalizationIndeterminateCandidates ===
      preAdmissionEnumeration.counts.canonicalizationIndeterminateCandidates;
  if (!storesMatch || !countsMatch) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_DIFFERENTIAL_MISMATCH",
      "Recursive pruning differs from the verified pre-admission reference.",
      {
        storesMatch,
        recursiveCounts: enumeration.counts,
        preAdmissionCounts: preAdmissionEnumeration.counts,
        authorizedFrontiers,
        skippedRawCandidates,
        skippedProfileCompatibleRawCandidates,
        skippedProfileExcludedRawCandidates,
        preAdmissionAuthorizedDecisions
      }
    );
  }

  const pruning = {
    strategy: contract.strategy,
    transcriptHash,
    frontierAuthorizedPredicateIds: [...controller.authorizedPredicateIds],
    preAdmissionAuthorizedPredicateIds: [
      ...controller.preAdmissionAuthorizedPredicateIds
    ],
    prunedFrontiers,
    counts: {
      evaluatedFrontiers,
      frontierControllerDecisions,
      authorizedFrontiers,
      skippedRawCandidates,
      skippedProfileCompatibleRawCandidates,
      skippedProfileExcludedRawCandidates,
      evaluatedCompleteRawCandidates,
      evaluatedCompletePrefixes,
      preAdmissionControllerDecisions,
      preAdmissionAuthorizedDecisions,
      visitedDecorationStates: enumeration.counts.decorationStates,
      referenceDecorationStates:
        preAdmissionEnumeration.counts.decorationStates,
      skippedDecorationStates:
        preAdmissionEnumeration.counts.decorationStates -
        enumeration.counts.decorationStates
    }
  };
  if (pruning.counts.skippedDecorationStates < 0) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_STATE_COUNT_MISMATCH",
      "Recursive pruning visited more decoration states than its reference.",
      pruning.counts
    );
  }
  const recursiveStoreHash = retainedStoreHash(
    contract.resultSetHashDomain,
    binding.bindingHash,
    enumeration.candidateStore
  );
  const referenceStoreHash = retainedStoreHash(
    contract.resultSetHashDomain,
    binding.bindingHash,
    preAdmissionEnumeration.candidateStore
  );
  const conformance = {
    status: "passed",
    preAdmissionGenerationHash: preAdmission.generationHash,
    recursiveRetainedStoreHash: recursiveStoreHash,
    preAdmissionRetainedStoreHash: referenceStoreHash,
    pruningDisabledCanonicalCandidates:
      preAdmission.conformance.pruningDisabledCanonicalCandidates,
    preAdmissionCanonicalCandidates:
      preAdmissionEnumeration.counts.canonicalCandidates,
    recursiveCanonicalCandidates: enumeration.counts.canonicalCandidates,
    eligible: preAdmission.conformance.eligible,
    indeterminate: preAdmission.conformance.indeterminate
  };
  const basis = {
    schemaVersion: "1",
    generator: contract.generator,
    packageId: controller.frontierAudit.packageId,
    rulesHash: controller.frontierAudit.rulesHash,
    bindingHash: binding.bindingHash,
    runConfigHash: binding.runConfigHash,
    canonicalAuditHash: controller.canonicalAudit.auditHash,
    frontierAuditHash: controller.frontierAudit.frontierAuditHash,
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

export function enumeratePackageCandidatesWithRecursivePruning(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  frontierAuditInput,
  options = {}
) {
  const controller = createPackageGeneratorFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    frontierAuditInput,
    options
  );
  const preAdmission = enumeratePackageCandidatesWithPruning(
    loadedPackageInput,
    runConfigInput,
    controller.canonicalAudit,
    options
  );
  return enumerateBoundPackageCandidatesWithRecursivePruning(
    controller,
    preAdmission,
    DEPTH_ONE_RECURSIVE_PRUNING_CONTRACT
  );
}

/** Reproduces recursive-pruning generation and all three reference layers. */
export function verifyPackageCandidatesWithRecursivePruning(
  artifactInput,
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  frontierAuditInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(artifactInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_RECURSIVE_PRUNING_ARTIFACT_INVALID",
      "Recursive-pruning generation artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = enumeratePackageCandidatesWithRecursivePruning(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    frontierAuditInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_RECURSIVE_PRUNING_ARTIFACT_MISMATCH",
      "Recursive-pruning generation differs from exact deterministic reproduction.",
      {
        expectedGenerationHash: reproduced.generationHash,
        actualGenerationHash: supplied?.generationHash ?? null
      }
    );
  }
  return reproduced;
}
