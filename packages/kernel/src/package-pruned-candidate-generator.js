import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  enumerateDecoratedCandidatesWithCompositionGateAndPreAdmissionPruning,
  enumerateDecoratedCandidatesWithPreAdmissionPruning
} from "./candidate-enumerator.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { createPackageCandidateFilterSession } from "./package-candidate-filter.js";
import { createPackagePartialPruningControllerSession } from "./package-pruning-audit.js";
import {
  createDisabledPackageProfileComposition,
  createPackageProfileCompositionSession,
  enumerateBoundCandidatesWithProfileComposition
} from "./package-profile-composition.js";

export const PACKAGE_PRUNED_CANDIDATE_GENERATOR_VERSION =
  "package-pruned-candidate-generator-v1";
export const PACKAGE_CANDIDATE_PRUNING_STRATEGY =
  "canonical-candidate-prefix-pre-admission-v1";

const DEPTH_ONE_PRUNING_CONTRACT = Object.freeze({
  generator: PACKAGE_PRUNED_CANDIDATE_GENERATOR_VERSION,
  strategy: PACKAGE_CANDIDATE_PRUNING_STRATEGY,
  transcriptHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_TRANSCRIPT,
  resultSetHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_RESULT_SET,
  canonicalUniverseHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_AUDIT_UNIVERSE,
  generationHashDomain: HASH_DOMAINS.PACKAGE_PRUNED_CANDIDATE_GENERATION
});

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "ENUMERATE_PACKAGE_CANDIDATES_WITH_PRUNING",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function incrementCounter(value, field) {
  if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_COUNT_LIMIT",
      "A pruning-census counter exceeded the safe-integer contract.",
      { field, value }
    );
  }
  return value + 1;
}

function resultSetHash(domain, bindingHash, verdict, candidateIds) {
  return hashCanonical(domain, {
    schemaVersion: "1",
    bindingHash,
    verdict,
    candidateIds
  });
}

function idsForVerdict(evaluations, verdict) {
  return evaluations
    .filter((entry) => entry.verdict === verdict)
    .map((entry) => entry.formation.candidate.id)
    .sort(compareStrings);
}

function assertEqualIds(code, message, left, right, details = {}) {
  if (canonicalize(left) !== canonicalize(right)) {
    fail(code, message, {
      ...details,
      leftCount: left.length,
      rightCount: right.length,
      firstLeftOnly: left.find((entry) => !right.includes(entry)) ?? null,
      firstRightOnly: right.find((entry) => !left.includes(entry)) ?? null
    });
  }
}

/**
 * Executes the audited controller at the canonical prefix of every complete
 * raw decoration before CandidateStore admission. The function also replays a
 * pruning-disabled baseline and complete local filtering so a returned
 * artifact always carries an exact differential-conformance result.
 */
export function enumerateBoundPackageCandidatesWithPruning(
  controller,
  evaluateCandidate,
  contract,
  context = {}
) {
  const { audit, binding, authorizedPredicateIds } = controller;
  const canonicalizationOptions = {
    policy: binding.runConfig.graphPolicy,
    limits: binding.enumerationOptions.canonicalizationLimits
  };
  let evaluatedRawCandidates = 0;
  let evaluatedPrefixStates = 0;
  let controllerDecisions = 0;
  let authorizedDecisions = 0;
  let transcriptHash = hashCanonical(contract.transcriptHashDomain, {
    schemaVersion: "1",
    bindingHash: binding.bindingHash,
    auditHash: audit.auditHash,
    strategy: contract.strategy
  });
  const prunedByCandidate = new Map();

  const preAdmissionPruner = (candidateInput) => {
    evaluatedRawCandidates = incrementCounter(
      evaluatedRawCandidates,
      "evaluatedRawCandidates"
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
      evaluatedPrefixStates = incrementCounter(
        evaluatedPrefixStates,
        "evaluatedPrefixStates"
      );
      const partialGraph = {
        domain: candidate.domain,
        nodes: candidate.nodes,
        edges: candidate.edges.slice(0, partialEdgeCount),
        nodesComplete: true
      };
      for (const predicateId of authorizedPredicateIds) {
        const decision = controller.evaluate(predicateId, partialGraph);
        controllerDecisions = incrementCounter(
          controllerDecisions,
          "controllerDecisions"
        );
        transcriptHash = hashCanonical(contract.transcriptHashDomain, {
          schemaVersion: "1",
          previousTranscriptHash: transcriptHash,
          rawCandidateOrdinal: evaluatedRawCandidates - 1,
          candidateId: canonicalization.candidateId,
          partialEdgeCount,
          predicateId,
          decisionHash: decision.decisionHash
        });
        if (!decision.pruningAuthorized) continue;
        authorizedDecisions = incrementCounter(
          authorizedDecisions,
          "authorizedDecisions"
        );
        const existing = prunedByCandidate.get(canonicalization.candidateId);
        if (existing === undefined) {
          prunedByCandidate.set(canonicalization.candidateId, {
            candidateId: canonicalization.candidateId,
            skeletonId: canonicalization.skeletonId,
            predicateId,
            partialEdgeCount,
            completeEdgeCount: candidate.edges.length,
            decision,
            rawOccurrences: 1
          });
        } else {
          if (
            existing.predicateId !== predicateId ||
            existing.partialEdgeCount !== partialEdgeCount ||
            existing.decision.decisionHash !== decision.decisionHash
          ) {
            fail(
              "PACKAGE_CANDIDATE_PRUNING_DUPLICATE_DECISION_MISMATCH",
              "Canonical duplicates produced different first pruning decisions.",
              { candidateId: canonicalization.candidateId }
            );
          }
          existing.rawOccurrences = incrementCounter(
            existing.rawOccurrences,
            "prunedCandidates.rawOccurrences"
          );
        }
        return { pruningAuthorized: true };
      }
    }
    return { pruningAuthorized: false };
  };
  const compositionSession =
    binding.runConfig.profileCompositionPolicy === "profile-slot-gate-v1"
      ? createPackageProfileCompositionSession(binding)
      : null;
  const execution = compositionSession === null
    ? enumerateDecoratedCandidatesWithPreAdmissionPruning(
      binding.enumerationInput,
      binding.enumerationOptions,
      preAdmissionPruner
    )
    : enumerateDecoratedCandidatesWithCompositionGateAndPreAdmissionPruning(
      binding.enumerationInput,
      binding.enumerationOptions,
      (canonicalizationResult) => compositionSession.evaluate(canonicalizationResult),
      preAdmissionPruner
    );

  const enumeration = execution.enumeration;
  const profileComposition = compositionSession === null
    ? createDisabledPackageProfileComposition()
    : compositionSession.finalize(enumeration);
  if (
    enumeration.status !== "complete" ||
    enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_ENUMERATION_INCOMPLETE",
      "Audited pruning requires a complete pre-admission enumeration.",
      { exhausted: enumeration.budget.exhausted }
    );
  }
  if (
    execution.pruning.preAdmissionPrunedCandidates !== authorizedDecisions ||
    enumeration.counts.preAdmissionPrunedCandidates !== authorizedDecisions ||
    evaluatedRawCandidates !==
      (compositionSession === null
        ? enumeration.counts.generatedCandidates
        : enumeration.counts.generatedCandidates -
          enumeration.counts.compositionExcludedCandidates -
          enumeration.counts.policyExcludedCandidates)
  ) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_EXECUTION_COUNT_MISMATCH",
      "Pre-admission pruning execution counts do not reconcile.",
      {
        evaluatedRawCandidates,
        generatedCandidates: enumeration.counts.generatedCandidates,
        policyExcludedCandidates: enumeration.counts.policyExcludedCandidates,
        prunedRawCandidates: execution.pruning.preAdmissionPrunedCandidates,
        authorizedDecisions
      }
    );
  }

  const baselineGeneration = enumerateBoundCandidatesWithProfileComposition(binding);
  const baseline = baselineGeneration.enumeration;
  if (
    baseline.status !== "complete" ||
    baseline.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_BASELINE_INCOMPLETE",
      "Differential conformance requires a complete pruning-disabled baseline.",
      { exhausted: baseline.budget.exhausted }
    );
  }
  const prunedCandidates = [...prunedByCandidate.values()]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId));
  const expectedPrunedDuplicateCount =
    execution.pruning.preAdmissionPrunedCandidates -
    prunedCandidates.length;
  const countsReconcile =
    baseline.counts.inputSkeletons === enumeration.counts.inputSkeletons &&
    baseline.counts.edgeBoundExcludedSkeletons ===
      enumeration.counts.edgeBoundExcludedSkeletons &&
    baseline.counts.decorationStates === enumeration.counts.decorationStates &&
    baseline.counts.generatedCandidates === enumeration.counts.generatedCandidates &&
    baseline.counts.policyExcludedCandidates ===
      enumeration.counts.policyExcludedCandidates &&
    baseline.counts.compositionExcludedCandidates ===
      enumeration.counts.compositionExcludedCandidates &&
    baseline.counts.canonicalizationIndeterminateCandidates ===
      enumeration.counts.canonicalizationIndeterminateCandidates &&
    baseline.counts.attemptedCandidates ===
      enumeration.counts.attemptedCandidates +
      enumeration.counts.preAdmissionPrunedCandidates &&
    baseline.counts.canonicalCandidates ===
      enumeration.counts.canonicalCandidates + prunedCandidates.length &&
    baseline.counts.duplicateCandidates ===
      enumeration.counts.duplicateCandidates + expectedPrunedDuplicateCount &&
    baseline.counts.preAdmissionPrunedCandidates === 0;
  const profileCompositionMatches = canonicalize(profileComposition) ===
    canonicalize(baselineGeneration.profileComposition);
  if (!countsReconcile || !profileCompositionMatches) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_BASELINE_COUNT_MISMATCH",
      "Pruning-enabled and pruning-disabled enumeration counts do not reconcile.",
      {
        baseline: baseline.counts,
        pruningEnabled: enumeration.counts,
        profileCompositionMatches,
        uniquePrunedCandidates: prunedCandidates.length,
        expectedPrunedDuplicateCount
      }
    );
  }

  const baselineCandidateIds = baseline.candidateStore.candidates
    .map((entry) => entry.candidateId);
  const baselineUniverseHash = hashCanonical(
    contract.canonicalUniverseHashDomain,
    {
      schemaVersion: "1",
      bindingHash: binding.bindingHash,
      candidateIds: baselineCandidateIds
    }
  );
  if (
    baselineCandidateIds.length !== audit.universe.candidateCount ||
    baselineUniverseHash !== audit.universe.universeHash
  ) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_AUDIT_UNIVERSE_MISMATCH",
      "The pruning-disabled replay differs from the verified audit universe.",
      {
        expectedCandidateCount: audit.universe.candidateCount,
        actualCandidateCount: baselineCandidateIds.length,
        expectedUniverseHash: audit.universe.universeHash,
        actualUniverseHash: baselineUniverseHash
      }
    );
  }

  const baselineEvaluations = baseline.candidateStore.candidates
    .map((record) => evaluateCandidate(record.candidate));
  const retainedEvaluations = enumeration.candidateStore.candidates
    .map((record) => evaluateCandidate(record.candidate));
  const baselineById = new Map(baselineEvaluations.map((entry) => [
    entry.formation.candidate.id,
    entry
  ]));
  for (const record of prunedCandidates) {
    const evaluation = baselineById.get(record.candidateId);
    if (
      evaluation === undefined ||
      evaluation.verdict !== "predicate-rejected" ||
      !evaluation.failedPredicates.includes(record.predicateId)
    ) {
      fail(
        "PACKAGE_CANDIDATE_PRUNING_UNSOUND",
        "An authorized pre-admission decision removed a candidate not rejected by its complete predicate evaluation.",
        {
          candidateId: record.candidateId,
          predicateId: record.predicateId,
          verdict: evaluation?.verdict ?? null,
          failedPredicates: evaluation?.failedPredicates ?? []
        }
      );
    }
  }

  const verdicts = ["eligible", "filter-indeterminate"];
  const resultSets = {};
  for (const verdict of verdicts) {
    const baselineIds = idsForVerdict(baselineEvaluations, verdict);
    const retainedIds = idsForVerdict(retainedEvaluations, verdict);
    assertEqualIds(
      "PACKAGE_CANDIDATE_PRUNING_DIFFERENTIAL_MISMATCH",
      "Pruning changed the complete post-filter candidate set.",
      baselineIds,
      retainedIds,
      { verdict }
    );
    resultSets[verdict] = {
      candidateCount: baselineIds.length,
      pruningDisabledHash: resultSetHash(
        contract.resultSetHashDomain,
        binding.bindingHash,
        verdict,
        baselineIds
      ),
      pruningEnabledHash: resultSetHash(
        contract.resultSetHashDomain,
        binding.bindingHash,
        verdict,
        retainedIds
      )
    };
  }

  const pruning = {
    strategy: contract.strategy,
    transcriptHash,
    authorizedPredicateIds: [...authorizedPredicateIds],
    prunedCandidates,
    counts: {
      evaluatedRawCandidates,
      evaluatedPrefixStates,
      controllerDecisions,
      authorizedDecisions,
      uniquePrunedCandidates: prunedCandidates.length,
      duplicatePrunedCandidates: expectedPrunedDuplicateCount,
      retainedCanonicalCandidates: enumeration.counts.canonicalCandidates
    }
  };
  const conformance = {
    status: "passed",
    pruningDisabledCanonicalCandidates: baseline.counts.canonicalCandidates,
    pruningEnabledCanonicalCandidates: enumeration.counts.canonicalCandidates,
    pruningDisabledRejectedCandidates:
      idsForVerdict(baselineEvaluations, "predicate-rejected").length,
    pruningEnabledRejectedCandidates:
      idsForVerdict(retainedEvaluations, "predicate-rejected").length,
    eligible: resultSets.eligible,
    indeterminate: resultSets["filter-indeterminate"]
  };
  const basis = {
    schemaVersion: "1",
    generator: contract.generator,
    packageId: audit.packageId,
    rulesHash: audit.rulesHash,
    bindingHash: binding.bindingHash,
    runConfigHash: binding.runConfigHash,
    auditHash: audit.auditHash,
    ...context,
    binding,
    enumeration,
    profileComposition,
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

export function enumeratePackageCandidatesWithPruning(
  loadedPackageInput,
  runConfigInput,
  auditInput,
  options = {}
) {
  const controller = createPackagePartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    auditInput,
    options
  );
  const session = createPackageCandidateFilterSession(
    loadedPackageInput,
    controller.binding,
    { kernelVersion: controller.kernelVersion }
  );
  return enumerateBoundPackageCandidatesWithPruning(
    controller,
    (candidate) => session.evaluate(candidate),
    DEPTH_ONE_PRUNING_CONTRACT
  );
}

/** Replays a stored pruning-enabled generation and differential census. */
export function verifyPackageCandidatesWithPruning(
  artifactInput,
  loadedPackageInput,
  runConfigInput,
  auditInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(artifactInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_CANDIDATE_PRUNING_ARTIFACT_INVALID",
      "Pruning-enabled generation artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = enumeratePackageCandidatesWithPruning(
    loadedPackageInput,
    runConfigInput,
    auditInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_CANDIDATE_PRUNING_ARTIFACT_MISMATCH",
      "Pruning-enabled generation differs from exact deterministic reproduction.",
      {
        expectedGenerationHash: reproduced.generationHash,
        actualGenerationHash: supplied?.generationHash ?? null
      }
    );
  }
  return reproduced;
}
