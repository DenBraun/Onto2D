import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  enumerateDecoratedCandidatesWithFrontierObserver
} from "./candidate-enumerator.js";
import { KernelError } from "./errors.js";
import {
  detectPartialGraphPredicateFailure,
  evaluateGraphPredicatePlan
} from "./graph-predicate-evaluator.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS,
  createPackagePartialPruningControllerSession
} from "./package-pruning-audit.js";
import {
  createPackageProfilePruningExtensionCensus
} from "./package-profile-pruning-extension.js";

export const PACKAGE_GENERATOR_FRONTIER_AUDITOR_VERSION =
  "package-generator-frontier-auditor-v1";
export const PACKAGE_GENERATOR_FRONTIER_AUDIT_SCOPE =
  "complete-depth-one-raw-edge-group-frontiers-v1";
export const PACKAGE_GENERATOR_FRONTIER_AUDIT_POLICY = deepFreeze({
  extensionModel: "complete-node-edge-group-frontier-v1",
  samplingAlgorithm: "sha256-rejection-counter-v1",
  replacement: "with-replacement",
  counterexampleRule: "frontier-fail-extension-pass-v1",
  proofInterpretation: "falsification-only-static-proof-required-v1",
  connectivityPolicy: "directed-strong-frontier-satisfaction-required-v1"
});
export const PACKAGE_GENERATOR_FRONTIER_CONTROLLER_VERSION =
  "package-generator-frontier-controller-v1";

const DEPTH_ONE_FRONTIER_CONTRACT = Object.freeze({
  auditor: PACKAGE_GENERATOR_FRONTIER_AUDITOR_VERSION,
  scope: PACKAGE_GENERATOR_FRONTIER_AUDIT_SCOPE,
  policy: PACKAGE_GENERATOR_FRONTIER_AUDIT_POLICY,
  auditHashDomain: HASH_DOMAINS.PACKAGE_GENERATOR_FRONTIER_AUDIT,
  sampleHashDomain: HASH_DOMAINS.PACKAGE_GENERATOR_FRONTIER_AUDIT_SAMPLE,
  frameHashDomain: HASH_DOMAINS.PACKAGE_GENERATOR_FRONTIER_FRAME,
  canonicalUniverseHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_AUDIT_UNIVERSE,
  controller: PACKAGE_GENERATOR_FRONTIER_CONTROLLER_VERSION,
  decisionHashDomain: HASH_DOMAINS.PACKAGE_GENERATOR_FRONTIER_DECISION
});

const GRAPH_OPERATORS = new Set([
  "all",
  "any",
  "not",
  "degree",
  "cycleExists",
  "connected",
  "componentCount",
  "pathExists",
  "countRole"
]);
const SHA256_RANGE = 1n << 256n;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "AUDIT_PACKAGE_GENERATOR_FRONTIERS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function incrementBy(value, amount, field) {
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    value > Number.MAX_SAFE_INTEGER - amount
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_COUNT_LIMIT",
      "A frontier-audit count exceeded the safe-integer contract.",
      { field, value, amount }
    );
  }
  return value + amount;
}

function normalizeAuditOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_OPTIONS_INVALID",
      "Frontier-audit options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_OPTIONS_INVALID",
      "Frontier-audit options must be an object."
    );
  }
  const samplesPerPredicate = value.samplesPerPredicate ??
    DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS.samplesPerPredicate;
  if (
    !Number.isSafeInteger(samplesPerPredicate) ||
    samplesPerPredicate < 0 ||
    samplesPerPredicate >
      DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS.maxSamplesPerPredicate
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_SAMPLE_LIMIT_INVALID",
      "Frontier-audit samples per predicate must be a bounded non-negative safe integer.",
      {
        value: samplesPerPredicate,
        maximum:
          DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS.maxSamplesPerPredicate
      }
    );
  }
  return { value, samplesPerPredicate };
}

function graphRuntimeSupported(plan) {
  return plan.requirements.operators.every((operator) =>
    GRAPH_OPERATORS.has(operator)
  );
}

function graphEvaluationOptions(binding) {
  return {
    policy: {
      ...binding.runConfig.graphPolicy,
      connected: false
    },
    limits: binding.enumerationOptions.canonicalizationLimits
  };
}

function sampleFrameIndex(
  frameSize,
  sampleOrdinal,
  planHash,
  frameHash,
  runConfigHash,
  contract
) {
  const modulus = BigInt(frameSize);
  const rejectionLimit = SHA256_RANGE - (SHA256_RANGE % modulus);
  for (
    let streamCounter = 0;
    streamCounter <
      DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS.maxStreamDraws;
    streamCounter += 1
  ) {
    const digest = hashCanonical(
      contract.sampleHashDomain,
      {
        schemaVersion: "1",
        algorithm: contract.policy.samplingAlgorithm,
        runConfigHash,
        frontierFrameHash: frameHash,
        predicatePlanHash: planHash,
        sampleOrdinal,
        streamCounter
      }
    );
    const value = BigInt(`0x${digest.slice("sha256:".length)}`);
    if (value < rejectionLimit) {
      return {
        frameIndex: Number(value % modulus),
        streamDraws: streamCounter + 1
      };
    }
  }
  fail(
    "PACKAGE_GENERATOR_FRONTIER_AUDIT_STREAM_EXHAUSTED",
    "The frontier-audit sampling stream exceeded its bounded rejection window.",
    { predicatePlanHash: planHash, sampleOrdinal, frameSize }
  );
}

function initialFrameHash(bindingHash, canonicalAuditHash, contract) {
  return hashCanonical(contract.frameHashDomain, {
    schemaVersion: "1",
    bindingHash,
    canonicalAuditHash,
    scope: contract.scope
  });
}

function updateFrameHash(previous, observedOrdinal, entry, contract) {
  const rawCandidateHash = hashCanonical(
    contract.frameHashDomain,
    {
      schemaVersion: "1",
      candidateInput: entry.candidateInput
    }
  );
  return hashCanonical(contract.frameHashDomain, {
    schemaVersion: "1",
    previousFrontierFrameHash: previous,
    observedOrdinal,
    rawCandidateOrdinal: entry.rawCandidateOrdinal,
    candidateId: entry.canonicalization.candidateId,
    skeletonId: entry.canonicalization.skeletonId,
    rawCandidateHash,
    edgeGroupCounts: entry.edgeGroupCounts
  });
}

function observeFrame(binding, canonicalAuditHash, contract) {
  let rawExtensionCandidates = 0;
  let extensionFrameSize = 0;
  let frontierFrameHash = initialFrameHash(
    binding.bindingHash,
    canonicalAuditHash,
    contract
  );
  const profileCensus = createPackageProfilePruningExtensionCensus(binding);
  const execution = enumerateDecoratedCandidatesWithFrontierObserver(
    binding.enumerationInput,
    binding.enumerationOptions,
    (entry) => {
      profileCensus.observe(entry);
      frontierFrameHash = updateFrameHash(
        frontierFrameHash,
        rawExtensionCandidates,
        entry,
        contract
      );
      rawExtensionCandidates = incrementBy(
        rawExtensionCandidates,
        1,
        "rawExtensionCandidates"
      );
      extensionFrameSize = incrementBy(
        extensionFrameSize,
        entry.edgeGroupCounts.length,
        "extensionFrameSize"
      );
    }
  );
  if (
    execution.enumeration.status !== "complete" ||
    execution.enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_UNIVERSE_INCOMPLETE",
      "A generator-frontier audit requires a complete pruning-disabled enumeration.",
      { exhausted: execution.enumeration.budget.exhausted }
    );
  }
  const finalizedProfileCensus = profileCensus.finalize("edge-group");
  if (
    finalizedProfileCensus.artifact.rawExtensionCandidates !==
    rawExtensionCandidates
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_PROFILE_CENSUS_MISMATCH",
      "The profile extension census did not cover the complete raw frontier frame.",
      {
        rawExtensionCandidates,
        profileRawExtensionCandidates:
          finalizedProfileCensus.artifact.rawExtensionCandidates
      }
    );
  }
  return {
    enumeration: execution.enumeration,
    rawExtensionCandidates,
    extensionFrameSize,
    frontierFrameHash,
    profileExtensionUniverse: finalizedProfileCensus.artifact,
    compatibleCandidateIds: finalizedProfileCensus.compatibleCandidateIds
  };
}

function makePlanState(
  plan,
  canonicalPlanAudit,
  frame,
  samplesPerPredicate,
  binding,
  contract
) {
  const base = {
    plan,
    canonicalPlanAudit,
    supported: graphRuntimeSupported(plan),
    selections: [],
    samples: [],
    extensionCache: new Map()
  };
  if (
    !base.supported ||
    frame.extensionFrameSize === 0 ||
    samplesPerPredicate === 0
  ) {
    return base;
  }
  base.selections = Array.from(
    { length: samplesPerPredicate },
    (_, sampleOrdinal) => ({
      sampleOrdinal,
      ...sampleFrameIndex(
        frame.extensionFrameSize,
        sampleOrdinal,
        plan.planHash,
        frame.frontierFrameHash,
        binding.runConfigHash,
        contract
      )
    })
  );
  base.samples = Array(samplesPerPredicate);
  return base;
}

function partialGraph(entry, completedEdgeGroups) {
  const partialEdgeCount = entry.edgeGroupCounts
    .slice(0, completedEdgeGroups)
    .reduce((total, count) => total + count, 0);
  return {
    graph: {
      domain: entry.candidateInput.domain,
      nodes: entry.candidateInput.nodes,
      edges: entry.candidateInput.edges.slice(0, partialEdgeCount),
      nodesComplete: true
    },
    partialEdgeCount
  };
}

function evaluateRequestedFrame(
  state,
  selection,
  frameIndex,
  observedOrdinal,
  completedEdgeGroups,
  entry,
  binding
) {
  const partial = partialGraph(entry, completedEdgeGroups);
  const options = graphEvaluationOptions(binding);
  const partialEvaluation = evaluateGraphPredicatePlan(
    state.plan,
    {
      domain: partial.graph.domain,
      nodes: partial.graph.nodes,
      edges: partial.graph.edges
    },
    options
  );
  let extensionEvaluation = state.extensionCache.get(
    entry.canonicalization.candidateId
  );
  if (extensionEvaluation === undefined) {
    extensionEvaluation = evaluateGraphPredicatePlan(
      state.plan,
      entry.canonicalization.candidate,
      options
    );
    state.extensionCache.set(
      entry.canonicalization.candidateId,
      extensionEvaluation
    );
  }
  const diagnostic = detectPartialGraphPredicateFailure(
    state.plan,
    partial.graph
  );
  const counterexample = partialEvaluation.outcome === "fail" &&
    extensionEvaluation.outcome === "pass";
  return {
    sampleOrdinal: selection.sampleOrdinal,
    frameIndex,
    streamDraws: selection.streamDraws,
    observedExtensionOrdinal: observedOrdinal,
    rawCandidateOrdinal: entry.rawCandidateOrdinal,
    extensionCandidateId: entry.canonicalization.candidateId,
    skeletonId: entry.canonicalization.skeletonId,
    completedEdgeGroups,
    totalEdgeGroups: entry.edgeGroupCounts.length,
    edgeGroupCounts: [...entry.edgeGroupCounts],
    partialEdgeCount: partial.partialEdgeCount,
    extensionEdgeCount: entry.canonicalization.candidate.edges.length,
    partialGraphHash: diagnostic.partialGraphHash,
    partialEvaluationHash: partialEvaluation.evaluationHash,
    extensionEvaluationHash: extensionEvaluation.evaluationHash,
    diagnosticEvaluationHash: diagnostic.evaluationHash,
    partialOutcome: partialEvaluation.outcome,
    extensionOutcome: extensionEvaluation.outcome,
    persistentFailureDetected: diagnostic.persistentFailureDetected,
    counterexample
  };
}

function populateSamples(states, frame, binding, canonicalAuditHash, contract) {
  const requests = new Map();
  for (const state of states) {
    for (const selection of state.selections) {
      if (!requests.has(selection.frameIndex)) {
        requests.set(selection.frameIndex, []);
      }
      requests.get(selection.frameIndex).push({ state, selection });
    }
  }
  if (requests.size === 0) return;

  let frameIndex = 0;
  let observedOrdinal = 0;
  let replayFrameHash = initialFrameHash(
    binding.bindingHash,
    canonicalAuditHash,
    contract
  );
  const execution = enumerateDecoratedCandidatesWithFrontierObserver(
    binding.enumerationInput,
    binding.enumerationOptions,
    (entry) => {
      replayFrameHash = updateFrameHash(
        replayFrameHash,
        observedOrdinal,
        entry,
        contract
      );
      for (
        let completedEdgeGroups = 0;
        completedEdgeGroups < entry.edgeGroupCounts.length;
        completedEdgeGroups += 1
      ) {
        const selected = requests.get(frameIndex) ?? [];
        const cache = new Map();
        for (const request of selected) {
          let sample = cache.get(request.state.plan.planHash);
          if (sample === undefined) {
            sample = evaluateRequestedFrame(
              request.state,
              request.selection,
              frameIndex,
              observedOrdinal,
              completedEdgeGroups,
              entry,
              binding
            );
            cache.set(request.state.plan.planHash, sample);
          }
          request.state.samples[request.selection.sampleOrdinal] = {
            ...sample,
            sampleOrdinal: request.selection.sampleOrdinal,
            streamDraws: request.selection.streamDraws
          };
        }
        frameIndex += 1;
      }
      observedOrdinal += 1;
    }
  );
  if (
    execution.enumeration.status !== "complete" ||
    frameIndex !== frame.extensionFrameSize ||
    observedOrdinal !== frame.rawExtensionCandidates ||
    replayFrameHash !== frame.frontierFrameHash ||
    states.some((state) =>
      state.samples.filter((sample) => sample !== undefined).length !==
        state.selections.length
    )
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_REPLAY_MISMATCH",
      "The sampled frontier frame differed during deterministic replay.",
      {
        expectedFrameSize: frame.extensionFrameSize,
        actualFrameSize: frameIndex,
        expectedRawExtensionCandidates: frame.rawExtensionCandidates,
        actualRawExtensionCandidates: observedOrdinal,
        expectedFrontierFrameHash: frame.frontierFrameHash,
        actualFrontierFrameHash: replayFrameHash
      }
    );
  }
}

function resultForState(state, frame, samplesPerPredicate) {
  let status;
  if (!state.supported) {
    status = "unsupported-runtime";
  } else if (frame.extensionFrameSize === 0) {
    status = "no-frontiers";
  } else if (samplesPerPredicate === 0) {
    status = "no-samples";
  } else {
    status = state.samples.some((sample) => sample.counterexample)
      ? "failed"
      : "passed";
  }
  const samples = status === "passed" || status === "failed"
    ? state.samples
    : [];
  const counts = {
    attempted: samples.length,
    partialFailures: samples.filter((entry) => entry.partialOutcome === "fail").length,
    extensionPasses: samples.filter((entry) => entry.extensionOutcome === "pass").length,
    persistentFailuresDetected: samples.filter(
      (entry) => entry.persistentFailureDetected
    ).length,
    counterexamples: samples.filter((entry) => entry.counterexample).length
  };
  return {
    predicateId: state.plan.predicateId,
    predicatePlanHash: state.plan.planHash,
    pruningEligibility: state.plan.pruning.eligibility,
    canonicalAuditStatus: state.canonicalPlanAudit?.status ?? "not-declared",
    runtimeSupport: state.supported
      ? "graph-complete-and-partial-v1"
      : "unsupported",
    requestedSamples: samplesPerPredicate,
    frameSize: frame.extensionFrameSize,
    samples,
    counts,
    status,
    pruningEligible: status === "passed" &&
      state.canonicalPlanAudit?.pruningEligible === true &&
      state.plan.pruning.eligibility === "static-proven"
  };
}

function overallStatus(results) {
  if (results.length === 0) return "not-applicable";
  if (results.some((entry) => entry.status === "failed")) return "failed";
  return results.every((entry) => entry.status === "passed")
    ? "passed"
    : "indeterminate";
}

/** Internal shared frontier audit for an already verified canonical audit. */
export function auditBoundPackageGeneratorFrontiers(
  loadedPackage,
  binding,
  canonicalAudit,
  samplesPerPredicate,
  contract,
  context = {}
) {
  if (!new Set(["passed", "not-applicable"]).has(canonicalAudit.status)) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_CANONICAL_AUDIT_NOT_PASSED",
      "Generator-frontier auditing requires a passed or not-applicable canonical-prefix audit.",
      { canonicalAuditStatus: canonicalAudit.status }
    );
  }
  const frame = observeFrame(binding, canonicalAudit.auditHash, contract);
  const candidateIds = frame.compatibleCandidateIds;
  const canonicalUniverseHash = hashCanonical(
    contract.canonicalUniverseHashDomain,
    {
      schemaVersion: "1",
      bindingHash: binding.bindingHash,
      candidateIds
    }
  );
  if (
    candidateIds.length !== canonicalAudit.universe.candidateCount ||
    canonicalUniverseHash !== canonicalAudit.universe.universeHash
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_CANONICAL_UNIVERSE_MISMATCH",
      "The observed frontier traversal differs from the canonical audit universe.",
      {
        expectedCandidateCount: canonicalAudit.universe.candidateCount,
        actualCandidateCount: candidateIds.length,
        expectedUniverseHash: canonicalAudit.universe.universeHash,
        actualUniverseHash: canonicalUniverseHash
      }
    );
  }

  const plans = loadedPackage.predicatePlans
    .filter((plan) => plan.monotoneViolation)
    .sort((left, right) => compareStrings(left.predicateId, right.predicateId));
  const canonicalResults = new Map(
    canonicalAudit.results.map((entry) => [entry.predicateId, entry])
  );
  const states = plans.map((plan) => makePlanState(
    plan,
    canonicalResults.get(plan.predicateId),
    frame,
    samplesPerPredicate,
    binding,
    contract
  ));
  populateSamples(
    states,
    frame,
    binding,
    canonicalAudit.auditHash,
    contract
  );
  const results = states.map((state) => resultForState(
    state,
    frame,
    samplesPerPredicate
  ));
  const status = overallStatus(results);
  const counts = {
    declaredPredicates: results.length,
    runtimeSupportedPredicates: results.filter(
      (entry) => entry.runtimeSupport === "graph-complete-and-partial-v1"
    ).length,
    passedPredicates: results.filter((entry) => entry.status === "passed").length,
    failedPredicates: results.filter((entry) => entry.status === "failed").length,
    indeterminatePredicates: results.filter((entry) => !new Set([
      "passed",
      "failed"
    ]).has(entry.status)).length,
    authorizedPlans: status === "passed"
      ? results.filter((entry) => entry.pruningEligible).length
      : 0,
    attemptedSamples: results.reduce(
      (total, entry) => total + entry.counts.attempted,
      0
    ),
    counterexamples: results.reduce(
      (total, entry) => total + entry.counts.counterexamples,
      0
    )
  };
  const basis = {
    schemaVersion: "1",
    auditor: contract.auditor,
    scope: contract.scope,
    packageId: canonicalAudit.packageId,
    rulesHash: canonicalAudit.rulesHash,
    bindingHash: binding.bindingHash,
    binding,
    runConfigHash: binding.runConfigHash,
    ...context,
    canonicalAuditHash: canonicalAudit.auditHash,
    seed: binding.runConfig.seed,
    policy: contract.policy,
    policySupport: "supported",
    samplesPerPredicate,
    universe: {
      enumerator: frame.enumeration.enumerator,
      canonicalCandidateCount: candidateIds.length,
      rawExtensionCandidates: frame.rawExtensionCandidates,
      extensionFrameSize: frame.extensionFrameSize,
      canonicalUniverseHash,
      frontierFrameHash: frame.frontierFrameHash
    },
    profileExtensionUniverse: frame.profileExtensionUniverse,
    results,
    counts,
    status
  };
  return deepFreeze({
    ...basis,
    frontierAuditHash: hashCanonical(contract.auditHashDomain, basis)
  });
}

/**
 * Audits the actual complete-node edge-group frontiers visited by the
 * deterministic depth-one decorator against reachable complete raw
 * extensions. Passing samples remain falsification evidence, never proof.
 */
export function auditPackageGeneratorFrontiers(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  options = {}
) {
  const normalized = normalizeAuditOptions(options);
  const canonicalController = createPackagePartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    normalized.value
  );
  const { audit: canonicalAudit, binding, kernelVersion } = canonicalController;
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    { kernelVersion }
  );
  return auditBoundPackageGeneratorFrontiers(
    loadedPackage,
    binding,
    canonicalAudit,
    normalized.samplesPerPredicate,
    DEPTH_ONE_FRONTIER_CONTRACT
  );
}

/** Reproduces a stored generator-frontier audit byte-for-byte. */
export function verifyPackageGeneratorFrontierAudit(
  auditInput,
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(auditInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_INVALID",
      "Generator-frontier audit artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = auditPackageGeneratorFrontiers(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_AUDIT_MISMATCH",
      "Generator-frontier audit differs from deterministic reproduction.",
      {
        expectedFrontierAuditHash: reproduced.frontierAuditHash,
        actualFrontierAuditHash: supplied?.frontierAuditHash ?? null
      }
    );
  }
  return reproduced;
}

function directedVariants(edge, variants) {
  return variants.flatMap((variant) => [
    { from: edge[0], to: edge[1], ...variant },
    { from: edge[1], to: edge[0], ...variant }
  ]).sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
}

function loopVariants(node, variants) {
  return variants
    .map((variant) => ({ from: node, to: node, ...variant }))
    .sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
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

function remainingCompletionCount(groups, groupIndex, edgeCount, edgeLimit, allowParallelEdges) {
  const suffixMinimum = Array(groups.length + 1).fill(0);
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    suffixMinimum[index] = suffixMinimum[index + 1] + groups[index].minimum;
  }
  const memo = new Map();
  function visit(index, count) {
    if (index === groups.length) return 1n;
    const key = `${index}:${count}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const group = groups[index];
    const maximum = allowParallelEdges
      ? edgeLimit - count - suffixMinimum[index + 1]
      : Math.min(1, edgeLimit - count - suffixMinimum[index + 1]);
    let total = 0n;
    if (maximum >= group.minimum && !(group.variants.length === 0 && group.minimum > 0)) {
      for (let size = group.minimum; size <= maximum; size += 1) {
        total += multisetCount(group.variants.length, size) * visit(index + 1, count + size);
      }
    }
    memo.set(key, total);
    return total;
  }
  return visit(groupIndex, edgeCount);
}

function frontierGroups(binding, skeleton) {
  const variants = binding.enumerationInput.edgeVariants;
  const groups = skeleton.edges.map((edge) => ({
    minimum: 1,
    variants: directedVariants(edge, variants)
  }));
  if (binding.runConfig.graphPolicy.allowSelfLoops) {
    for (let node = 0; node < skeleton.nodeCount; node += 1) {
      groups.push({ minimum: 0, variants: loopVariants(node, variants) });
    }
  }
  return groups;
}

function normalizeFrontierInput(frontierInput, binding) {
  let value;
  try {
    value = canonicalClone(frontierInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_GENERATOR_FRONTIER_INPUT_INVALID",
      "Generator-frontier input is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value) || !isObject(value.candidateInput) || !isObject(value.frontier)) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_INPUT_INVALID",
      "Generator-frontier input must contain candidateInput and frontier objects."
    );
  }
  const inputUnknown = Object.keys(value).filter(
    (field) => !new Set(["candidateInput", "frontier"]).has(field)
  );
  const candidateUnknown = Object.keys(value.candidateInput).filter(
    (field) => !new Set(["domain", "nodes", "edges", "skeleton"]).has(field)
  );
  const frontierUnknown = Object.keys(value.frontier).filter(
    (field) => !new Set([
      "skeletonId",
      "completedEdgeGroups",
      "totalEdgeGroups",
      "edgeGroupCounts",
      "remainingRawCandidates"
    ]).has(field)
  );
  if (inputUnknown.length > 0 || candidateUnknown.length > 0 || frontierUnknown.length > 0) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_INPUT_INVALID",
      "Generator-frontier fields do not match the closed execution contract.",
      { inputUnknown, candidateUnknown, frontierUnknown }
    );
  }
  const { candidateInput, frontier } = value;
  const skeleton = binding.enumerationInput.skeletons.find(
    (entry) => entry.id === frontier.skeletonId
  );
  if (
    skeleton === undefined ||
    candidateInput.skeleton !== frontier.skeletonId ||
    candidateInput.domain !== binding.enumerationInput.domain ||
    !Array.isArray(candidateInput.nodes) ||
    candidateInput.nodes.length !== skeleton?.nodeCount ||
    !Array.isArray(candidateInput.edges) ||
    !Array.isArray(frontier.edgeGroupCounts)
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_UNIVERSE_MISMATCH",
      "Generator frontier does not belong to the bound skeleton/domain universe.",
      {
        skeletonId: frontier.skeletonId,
        expectedDomain: binding.enumerationInput.domain,
        actualDomain: candidateInput.domain,
        nodeCount: Array.isArray(candidateInput.nodes)
          ? candidateInput.nodes.length
          : null,
        expectedNodeCount: skeleton?.nodeCount ?? null
      }
    );
  }
  const allowedNodes = new Set(
    binding.enumerationInput.nodeVariants.map((entry) => canonicalize(entry))
  );
  if (candidateInput.nodes.some((entry) => !allowedNodes.has(canonicalize(entry)))) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_UNIVERSE_MISMATCH",
      "Generator frontier contains a node outside the bound decoration alphabet."
    );
  }
  const groups = frontierGroups(binding, skeleton);
  if (
    !Number.isSafeInteger(frontier.completedEdgeGroups) ||
    frontier.completedEdgeGroups < 0 ||
    frontier.completedEdgeGroups >= groups.length ||
    frontier.totalEdgeGroups !== groups.length ||
    frontier.edgeGroupCounts.length !== frontier.completedEdgeGroups ||
    !frontier.edgeGroupCounts.every((count) =>
      Number.isSafeInteger(count) && count >= 0
    ) ||
    !Number.isSafeInteger(frontier.remainingRawCandidates) ||
    frontier.remainingRawCandidates < 1
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_STATE_INVALID",
      "Generator-frontier cursor/count metadata is invalid.",
      { frontier, expectedTotalEdgeGroups: groups.length }
    );
  }
  const edgeLimit = binding.enumerationOptions.maxEdges === "n+2"
    ? skeleton.nodeCount + 2
    : binding.enumerationOptions.maxEdges;
  let edgeOffset = 0;
  for (let index = 0; index < frontier.completedEdgeGroups; index += 1) {
    const group = groups[index];
    const count = frontier.edgeGroupCounts[index];
    if (
      count < group.minimum ||
      !binding.runConfig.graphPolicy.allowParallelEdges && count > 1
    ) {
      fail(
        "PACKAGE_GENERATOR_FRONTIER_GROUP_COUNT_INVALID",
        "A completed frontier edge group violates its multiplicity contract.",
        { groupIndex: index, count, minimum: group.minimum }
      );
    }
    const selected = candidateInput.edges.slice(edgeOffset, edgeOffset + count);
    const allowed = new Set(group.variants.map((entry) => canonicalize(entry)));
    const serialized = selected.map((entry) => canonicalize(entry));
    if (
      selected.length !== count ||
      serialized.some((entry) => !allowed.has(entry)) ||
      serialized.some((entry, selectedIndex) =>
        selectedIndex > 0 && serialized[selectedIndex - 1] > entry
      )
    ) {
      fail(
        "PACKAGE_GENERATOR_FRONTIER_GROUP_VARIANT_INVALID",
        "A completed frontier edge group is not a canonical multiset from its bound alphabet.",
        { groupIndex: index }
      );
    }
    edgeOffset += count;
  }
  if (edgeOffset !== candidateInput.edges.length || edgeOffset > edgeLimit) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_EDGE_COUNT_MISMATCH",
      "Frontier edge counts do not reconcile with the supplied partial graph.",
      { edgeOffset, edgeCount: candidateInput.edges.length, edgeLimit }
    );
  }
  const expectedRemaining = remainingCompletionCount(
    groups,
    frontier.completedEdgeGroups,
    edgeOffset,
    edgeLimit,
    binding.runConfig.graphPolicy.allowParallelEdges
  );
  if (
    expectedRemaining > BigInt(Number.MAX_SAFE_INTEGER) ||
    Number(expectedRemaining) !== frontier.remainingRawCandidates
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_REMAINING_COUNT_MISMATCH",
      "Frontier remaining-raw count differs from exact subtree reproduction.",
      {
        expectedRemainingRawCandidates: expectedRemaining.toString(),
        actualRemainingRawCandidates: frontier.remainingRawCandidates
      }
    );
  }
  return value;
}

function reachesEveryNode(nodeCount, adjacency) {
  const seen = new Set([0]);
  const pending = [0];
  while (pending.length > 0) {
    const node = pending.pop();
    for (const next of adjacency[node]) {
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(next);
    }
  }
  return seen.size === nodeCount;
}

function connectivityFrontierSatisfied(binding, partialGraph) {
  if (binding.runConfig.graphPolicy.connectivityProjection !== "directed-strong") {
    return true;
  }
  const nodeCount = partialGraph.nodes.length;
  const forward = Array.from({ length: nodeCount }, () => []);
  const reverse = Array.from({ length: nodeCount }, () => []);
  for (const edge of partialGraph.edges) {
    forward[edge.from].push(edge.to);
    reverse[edge.to].push(edge.from);
  }
  return reachesEveryNode(nodeCount, forward) &&
    reachesEveryNode(nodeCount, reverse);
}

function evaluateFrontierDecision(
  loadedPackage,
  frontierAudit,
  predicateId,
  frontierInput,
  contract
) {
  if (
    typeof predicateId !== "string" ||
    predicateId.length === 0 ||
    predicateId !== predicateId.trim()
  ) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_PREDICATE_ID_INVALID",
      "Generator-frontier authorization requires a normalized predicate ID.",
      { predicateId }
    );
  }
  const plan = loadedPackage.predicatePlans.find(
    (entry) => entry.predicateId === predicateId
  );
  if (plan === undefined) {
    fail(
      "PACKAGE_GENERATOR_FRONTIER_PREDICATE_UNKNOWN",
      "Generator-frontier authorization references an unknown predicate.",
      { predicateId }
    );
  }
  const normalized = normalizeFrontierInput(frontierInput, frontierAudit.binding);
  const partialGraph = {
    domain: normalized.candidateInput.domain,
    nodes: normalized.candidateInput.nodes,
    edges: normalized.candidateInput.edges,
    nodesComplete: true
  };
  const diagnostic = detectPartialGraphPredicateFailure(plan, partialGraph);
  const frontierConnectivitySatisfied = connectivityFrontierSatisfied(
    frontierAudit.binding,
    partialGraph
  );
  const planAudit = frontierAudit.results.find(
    (entry) => entry.predicateId === predicateId
  );
  const authorizedPlan = frontierAudit.status === "passed" &&
    planAudit?.status === "passed" &&
    planAudit.pruningEligible === true &&
    plan.pruning.eligibility === "static-proven";
  const pruningAuthorized = Boolean(
    authorizedPlan &&
    frontierConnectivitySatisfied &&
    diagnostic.persistentFailureDetected
  );
  const reason = pruningAuthorized
    ? "authorized-persistent-frontier-failure"
    : frontierAudit.status !== "passed"
      ? "frontier-audit-not-passed"
      : !authorizedPlan
        ? "plan-not-authorized"
        : !frontierConnectivitySatisfied
          ? "connectivity-frontier-not-satisfied"
          : "persistent-failure-not-detected";
  const basis = {
    schemaVersion: "1",
    controller: contract.controller,
    packageId: frontierAudit.packageId,
    rulesHash: frontierAudit.rulesHash,
    bindingHash: frontierAudit.bindingHash,
    runConfigHash: frontierAudit.runConfigHash,
    canonicalAuditHash: frontierAudit.canonicalAuditHash,
    frontierAuditHash: frontierAudit.frontierAuditHash,
    predicateId,
    predicatePlanHash: plan.planHash,
    ...(frontierAudit.targetDepth === undefined
      ? {}
      : {
          targetDepth: frontierAudit.targetDepth,
          sourcePopulationHash: frontierAudit.sourcePopulationHash
        }),
    extensionModel: contract.policy.extensionModel,
    frontier: normalized.frontier,
    frontierConnectivitySatisfied,
    diagnostic,
    pruningAuthorized,
    reason
  };
  return deepFreeze({
    ...basis,
    decisionHash: hashCanonical(
      contract.decisionHashDomain,
      basis
    )
  });
}

/** Internal prepared controller for already verified canonical/frontier audits. */
export function createPreparedPackageGeneratorFrontierControllerSession(
  loadedPackage,
  canonicalController,
  frontierAudit,
  contract
) {
  const authorizedPredicateIds = frontierAudit.status === "passed"
    ? frontierAudit.results
      .filter((entry) => entry.status === "passed" && entry.pruningEligible)
      .map((entry) => entry.predicateId)
      .sort(compareStrings)
    : [];
  return Object.freeze({
    canonicalAudit: canonicalController.audit,
    frontierAudit,
    binding: frontierAudit.binding,
    kernelVersion: canonicalController.kernelVersion,
    preAdmissionAuthorizedPredicateIds:
      canonicalController.authorizedPredicateIds,
    authorizedPredicateIds: deepFreeze(authorizedPredicateIds),
    evaluatePreAdmission(predicateId, partialGraph) {
      return canonicalController.evaluate(predicateId, partialGraph);
    },
    evaluate(predicateId, frontier) {
      return evaluateFrontierDecision(
        loadedPackage,
        frontierAudit,
        predicateId,
        frontier,
        contract
      );
    }
  });
}

/** Verifies both audits once for repeated recursive frontier decisions. */
export function createPackageGeneratorFrontierControllerSession(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  frontierAuditInput,
  options = {}
) {
  const normalized = normalizeAuditOptions(options);
  const canonicalController = createPackagePartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    normalized.value
  );
  const frontierAudit = verifyPackageGeneratorFrontierAudit(
    frontierAuditInput,
    loadedPackageInput,
    runConfigInput,
    canonicalController.audit,
    normalized.value
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    { kernelVersion: canonicalController.kernelVersion }
  );
  return createPreparedPackageGeneratorFrontierControllerSession(
    loadedPackage,
    canonicalController,
    frontierAudit,
    DEPTH_ONE_FRONTIER_CONTRACT
  );
}
