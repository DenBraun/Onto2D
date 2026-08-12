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
  createPackagePartialPruningControllerSession,
  normalizePackagePredicateMonotonicityAuditOptions
} from "./package-pruning-audit.js";
import {
  createPackageProfilePruningExtensionCensus
} from "./package-profile-pruning-extension.js";

export const PACKAGE_NODE_FRONTIER_AUDITOR_VERSION =
  "package-node-frontier-auditor-v1";
export const PACKAGE_NODE_FRONTIER_AUDIT_SCOPE =
  "complete-depth-one-raw-node-prefix-extension-pairs-v1";
export const PACKAGE_NODE_FRONTIER_AUDIT_POLICY = deepFreeze({
  extensionModel: "incomplete-node-prefix-complete-raw-extension-v1",
  samplingAlgorithm: "sha256-rejection-counter-v1",
  replacement: "with-replacement",
  counterexampleRule: "persistent-node-failure-extension-pass-v1",
  proofInterpretation: "falsification-only-static-proof-required-v1",
  connectivityPolicy: "directed-strong-node-pruning-disabled-v1"
});
export const PACKAGE_NODE_FRONTIER_CONTROLLER_VERSION =
  "package-node-frontier-controller-v1";

const DEPTH_ONE_NODE_FRONTIER_CONTRACT = Object.freeze({
  auditor: PACKAGE_NODE_FRONTIER_AUDITOR_VERSION,
  scope: PACKAGE_NODE_FRONTIER_AUDIT_SCOPE,
  policy: PACKAGE_NODE_FRONTIER_AUDIT_POLICY,
  auditHashDomain: HASH_DOMAINS.PACKAGE_NODE_FRONTIER_AUDIT,
  sampleHashDomain: HASH_DOMAINS.PACKAGE_NODE_FRONTIER_AUDIT_SAMPLE,
  frameHashDomain: HASH_DOMAINS.PACKAGE_NODE_FRONTIER_FRAME,
  canonicalUniverseHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_AUDIT_UNIVERSE,
  controller: PACKAGE_NODE_FRONTIER_CONTROLLER_VERSION,
  decisionHashDomain: HASH_DOMAINS.PACKAGE_NODE_FRONTIER_DECISION
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
    stage: "AUDIT_PACKAGE_NODE_FRONTIERS",
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
      "PACKAGE_NODE_FRONTIER_AUDIT_COUNT_LIMIT",
      "A node-frontier audit count exceeded the safe-integer contract.",
      { field, value, amount }
    );
  }
  return value + amount;
}

function normalizeOptions(options) {
  const normalized = normalizePackagePredicateMonotonicityAuditOptions(options);
  return { value: normalized, samplesPerPredicate: normalized.samplesPerPredicate };
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function graphRuntimeSupported(plan) {
  return plan.requirements.operators.every((operator) =>
    GRAPH_OPERATORS.has(operator)
  );
}

function graphEvaluationOptions(binding) {
  return {
    policy: { ...binding.runConfig.graphPolicy, connected: false },
    limits: binding.enumerationOptions.canonicalizationLimits
  };
}

function connectivitySupported(binding) {
  return !(
    binding.runConfig.graphPolicy.connected &&
    binding.runConfig.graphPolicy.connectivityProjection === "directed-strong"
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
  const rawExtensionHash = hashCanonical(
    contract.frameHashDomain,
    { schemaVersion: "1", candidateInput: entry.candidateInput }
  );
  return hashCanonical(contract.frameHashDomain, {
    schemaVersion: "1",
    previousNodeFrontierFrameHash: previous,
    observedOrdinal,
    rawCandidateOrdinal: entry.rawCandidateOrdinal,
    skeletonId: entry.candidateInput.skeleton,
    rawExtensionHash
  });
}

function observeFrame(binding, canonicalAuditHash, contract) {
  let rawExtensionCandidates = 0;
  let extensionFrameSize = 0;
  let nodeFrontierFrameHash = initialFrameHash(
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
      nodeFrontierFrameHash = updateFrameHash(
        nodeFrontierFrameHash,
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
        Math.max(0, entry.candidateInput.nodes.length - 1),
        "extensionFrameSize"
      );
    }
  );
  if (
    execution.enumeration.status !== "complete" ||
    execution.enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_NODE_FRONTIER_AUDIT_UNIVERSE_INCOMPLETE",
      "A node-frontier audit requires a complete pruning-disabled enumeration.",
      { exhausted: execution.enumeration.budget.exhausted }
    );
  }
  const finalizedProfileCensus = profileCensus.finalize("node-assignment");
  if (
    finalizedProfileCensus.artifact.rawExtensionCandidates !==
    rawExtensionCandidates
  ) {
    fail(
      "PACKAGE_NODE_FRONTIER_PROFILE_CENSUS_MISMATCH",
      "The profile extension census did not cover the complete raw node-frontier frame.",
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
    nodeFrontierFrameHash,
    profileExtensionUniverse: finalizedProfileCensus.artifact,
    compatibleCandidateIds: finalizedProfileCensus.compatibleCandidateIds
  };
}

function sampleFrameIndex(
  frameSize,
  ordinal,
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
        nodeFrontierFrameHash: frameHash,
        predicatePlanHash: planHash,
        sampleOrdinal: ordinal,
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
    "PACKAGE_NODE_FRONTIER_AUDIT_STREAM_EXHAUSTED",
    "The node-frontier sampling stream exceeded its rejection window.",
    { predicatePlanHash: planHash, sampleOrdinal: ordinal, frameSize }
  );
}

function makeState(
  plan,
  canonicalResult,
  frame,
  samplesPerPredicate,
  binding,
  contract
) {
  const supported = graphRuntimeSupported(plan);
  const connectivity = connectivitySupported(binding);
  const selections = supported && connectivity &&
    frame.extensionFrameSize > 0 && samplesPerPredicate > 0
    ? Array.from({ length: samplesPerPredicate }, (_, sampleOrdinal) => ({
        sampleOrdinal,
        ...sampleFrameIndex(
          frame.extensionFrameSize,
          sampleOrdinal,
          plan.planHash,
          frame.nodeFrontierFrameHash,
          binding.runConfigHash,
          contract
        )
      }))
    : [];
  return {
    plan,
    canonicalResult,
    supported,
    connectivity,
    selections,
    samples: Array(selections.length),
    extensionCache: new Map()
  };
}

function evaluateFrame(
  state,
  selection,
  frameIndex,
  observedOrdinal,
  assignedNodes,
  entry,
  binding,
  contract
) {
  const partialGraph = {
    domain: entry.candidateInput.domain,
    nodes: entry.candidateInput.nodes.slice(0, assignedNodes),
    edges: [],
    nodesComplete: false
  };
  const diagnostic = detectPartialGraphPredicateFailure(state.plan, partialGraph);
  const extensionHash = hashCanonical(
    contract.frameHashDomain,
    { schemaVersion: "1", candidateInput: entry.candidateInput }
  );
  let extension = state.extensionCache.get(extensionHash);
  if (extension === undefined) {
    extension = evaluateGraphPredicatePlan(
      state.plan,
      entry.candidateInput,
      graphEvaluationOptions(binding)
    );
    state.extensionCache.set(extensionHash, extension);
  }
  return {
    sampleOrdinal: selection.sampleOrdinal,
    frameIndex,
    streamDraws: selection.streamDraws,
    observedExtensionOrdinal: observedOrdinal,
    rawCandidateOrdinal: entry.rawCandidateOrdinal,
    extensionHash,
    skeletonId: entry.candidateInput.skeleton,
    assignedNodes,
    totalNodes: entry.candidateInput.nodes.length,
    remainingNodeAssignments: entry.candidateInput.nodes.length - assignedNodes,
    partialGraphHash: diagnostic.partialGraphHash,
    extensionEvaluationHash: extension.evaluationHash,
    diagnosticEvaluationHash: diagnostic.evaluationHash,
    partialOutcome: diagnostic.outcome,
    extensionOutcome: extension.outcome,
    persistentFailureDetected: diagnostic.persistentFailureDetected,
    counterexample:
      diagnostic.persistentFailureDetected && extension.outcome === "pass"
  };
}

function populateSamples(states, frame, binding, canonicalAuditHash, contract) {
  const requests = new Map();
  for (const state of states) {
    for (const selection of state.selections) {
      if (!requests.has(selection.frameIndex)) requests.set(selection.frameIndex, []);
      requests.get(selection.frameIndex).push({ state, selection });
    }
  }
  if (requests.size === 0) return;
  let frameIndex = 0;
  let observedOrdinal = 0;
  let replayHash = initialFrameHash(
    binding.bindingHash,
    canonicalAuditHash,
    contract
  );
  const execution = enumerateDecoratedCandidatesWithFrontierObserver(
    binding.enumerationInput,
    binding.enumerationOptions,
    (entry) => {
      replayHash = updateFrameHash(replayHash, observedOrdinal, entry, contract);
      for (
        let assignedNodes = 1;
        assignedNodes < entry.candidateInput.nodes.length;
        assignedNodes += 1
      ) {
        const selected = requests.get(frameIndex) ?? [];
        const cache = new Map();
        for (const request of selected) {
          let sample = cache.get(request.state.plan.planHash);
          if (sample === undefined) {
            sample = evaluateFrame(
              request.state,
              request.selection,
              frameIndex,
              observedOrdinal,
              assignedNodes,
              entry,
              binding,
              contract
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
    replayHash !== frame.nodeFrontierFrameHash ||
    states.some((state) =>
      state.samples.filter((sample) => sample !== undefined).length !==
        state.selections.length
    )
  ) {
    fail(
      "PACKAGE_NODE_FRONTIER_AUDIT_REPLAY_MISMATCH",
      "The sampled node-frontier frame differed during deterministic replay.",
      {
        expectedFrameSize: frame.extensionFrameSize,
        actualFrameSize: frameIndex,
        expectedRawExtensionCandidates: frame.rawExtensionCandidates,
        actualRawExtensionCandidates: observedOrdinal,
        expectedNodeFrontierFrameHash: frame.nodeFrontierFrameHash,
        actualNodeFrontierFrameHash: replayHash
      }
    );
  }
}

function resultForState(state, frame, samplesPerPredicate) {
  let status;
  if (!state.supported) status = "unsupported-runtime";
  else if (!state.connectivity) status = "blocked-connectivity";
  else if (frame.extensionFrameSize === 0) status = "no-frontiers";
  else if (samplesPerPredicate === 0) status = "no-samples";
  else status = state.samples.some((sample) => sample.counterexample)
    ? "failed"
    : "passed";
  const samples = new Set(["passed", "failed"]).has(status)
    ? state.samples
    : [];
  const counts = {
    attempted: samples.length,
    persistentFailuresDetected: samples.filter(
      (sample) => sample.persistentFailureDetected
    ).length,
    extensionPasses: samples.filter(
      (sample) => sample.extensionOutcome === "pass"
    ).length,
    counterexamples: samples.filter((sample) => sample.counterexample).length
  };
  return {
    predicateId: state.plan.predicateId,
    predicatePlanHash: state.plan.planHash,
    pruningEligibility: state.plan.pruning.eligibility,
    canonicalAuditStatus: state.canonicalResult?.status ?? "not-declared",
    runtimeSupport: state.supported
      ? "graph-complete-and-partial-v1"
      : "unsupported",
    connectivitySupport: state.connectivity
      ? "supported"
      : "blocked-directed-strong",
    requestedSamples: samplesPerPredicate,
    frameSize: frame.extensionFrameSize,
    samples,
    counts,
    status,
    pruningEligible: status === "passed" &&
      state.canonicalResult?.pruningEligible === true &&
      state.plan.pruning.eligibility === "static-proven"
  };
}

function overallStatus(results) {
  if (results.length === 0) return "not-applicable";
  if (results.some((result) => result.status === "failed")) return "failed";
  return results.every((result) => result.status === "passed")
    ? "passed"
    : "indeterminate";
}

export function auditBoundPackageNodeFrontiers(
  loadedPackage,
  binding,
  canonicalAudit,
  samplesPerPredicate,
  contract,
  context = {}
) {
  if (!new Set(["passed", "not-applicable"]).has(canonicalAudit.status)) {
    fail(
      "PACKAGE_NODE_FRONTIER_AUDIT_CANONICAL_AUDIT_NOT_PASSED",
      "Node-frontier auditing requires a passed canonical-prefix audit.",
      { canonicalAuditStatus: canonicalAudit.status }
    );
  }
  const frame = observeFrame(binding, canonicalAudit.auditHash, contract);
  const candidateIds = frame.compatibleCandidateIds;
  const canonicalUniverseHash = hashCanonical(
    contract.canonicalUniverseHashDomain,
    { schemaVersion: "1", bindingHash: binding.bindingHash, candidateIds }
  );
  if (
    candidateIds.length !== canonicalAudit.universe.candidateCount ||
    canonicalUniverseHash !== canonicalAudit.universe.universeHash
  ) {
    fail(
      "PACKAGE_NODE_FRONTIER_AUDIT_CANONICAL_UNIVERSE_MISMATCH",
      "The node-frontier traversal differs from the canonical audit universe."
    );
  }
  const canonicalResults = new Map(
    canonicalAudit.results.map((entry) => [entry.predicateId, entry])
  );
  const states = loadedPackage.predicatePlans
    .filter((plan) => plan.monotoneViolation)
    .sort((left, right) => compareStrings(left.predicateId, right.predicateId))
    .map((plan) => makeState(
      plan,
      canonicalResults.get(plan.predicateId),
      frame,
      samplesPerPredicate,
      binding,
      contract
    ));
  populateSamples(states, frame, binding, canonicalAudit.auditHash, contract);
  const results = states.map((state) =>
    resultForState(state, frame, samplesPerPredicate)
  );
  const status = overallStatus(results);
  const counts = {
    declaredPredicates: results.length,
    runtimeSupportedPredicates: results.filter(
      (result) => result.runtimeSupport === "graph-complete-and-partial-v1"
    ).length,
    connectivitySupportedPredicates: results.filter(
      (result) => result.connectivitySupport === "supported"
    ).length,
    passedPredicates: results.filter((result) => result.status === "passed").length,
    failedPredicates: results.filter((result) => result.status === "failed").length,
    indeterminatePredicates: results.filter((result) =>
      !new Set(["passed", "failed"]).has(result.status)
    ).length,
    authorizedPlans: status === "passed"
      ? results.filter((result) => result.pruningEligible).length
      : 0,
    attemptedSamples: results.reduce(
      (total, result) => total + result.counts.attempted,
      0
    ),
    counterexamples: results.reduce(
      (total, result) => total + result.counts.counterexamples,
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
    samplesPerPredicate,
    universe: {
      enumerator: frame.enumeration.enumerator,
      canonicalCandidateCount: candidateIds.length,
      rawExtensionCandidates: frame.rawExtensionCandidates,
      extensionFrameSize: frame.extensionFrameSize,
      canonicalUniverseHash,
      nodeFrontierFrameHash: frame.nodeFrontierFrameHash
    },
    profileExtensionUniverse: frame.profileExtensionUniverse,
    results,
    counts,
    status
  };
  return deepFreeze({
    ...basis,
    nodeFrontierAuditHash: hashCanonical(
      contract.auditHashDomain,
      basis
    )
  });
}

export function auditPackageNodeFrontiers(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const canonicalController = createPackagePartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    normalized.value
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized.value)
  );
  return auditBoundPackageNodeFrontiers(
    loadedPackage,
    canonicalController.binding,
    canonicalController.audit,
    normalized.samplesPerPredicate,
    DEPTH_ONE_NODE_FRONTIER_CONTRACT
  );
}

export function verifyPackageNodeFrontierAudit(
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
      "PACKAGE_NODE_FRONTIER_AUDIT_INVALID",
      "A node-frontier audit is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = auditPackageNodeFrontiers(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NODE_FRONTIER_AUDIT_MISMATCH",
      "A node-frontier audit differs from deterministic reproduction.",
      {
        expectedNodeFrontierAuditHash: reproduced.nodeFrontierAuditHash,
        actualNodeFrontierAuditHash: supplied?.nodeFrontierAuditHash ?? null
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
  return variants.map((variant) => ({ from: node, to: node, ...variant }))
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

function edgeCompletionCount(binding, skeleton) {
  const edgeLimit = binding.enumerationOptions.maxEdges === "n+2"
    ? skeleton.nodeCount + 2
    : binding.enumerationOptions.maxEdges;
  const groups = skeleton.edges.map((edge) => ({
    minimum: 1,
    variants: directedVariants(edge, binding.enumerationInput.edgeVariants)
  }));
  if (binding.runConfig.graphPolicy.allowSelfLoops) {
    for (let node = 0; node < skeleton.nodeCount; node += 1) {
      groups.push({
        minimum: 0,
        variants: loopVariants(node, binding.enumerationInput.edgeVariants)
      });
    }
  }
  const suffixMinimum = Array(groups.length + 1).fill(0);
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    suffixMinimum[index] = suffixMinimum[index + 1] + groups[index].minimum;
  }
  const memo = new Map();
  function visit(index, edgeCount) {
    if (index === groups.length) return 1n;
    const key = `${index}:${edgeCount}`;
    if (memo.has(key)) return memo.get(key);
    const group = groups[index];
    const maximum = binding.runConfig.graphPolicy.allowParallelEdges
      ? edgeLimit - edgeCount - suffixMinimum[index + 1]
      : Math.min(1, edgeLimit - edgeCount - suffixMinimum[index + 1]);
    let total = 0n;
    if (maximum >= group.minimum && !(group.variants.length === 0 && group.minimum > 0)) {
      for (let size = group.minimum; size <= maximum; size += 1) {
        total += multisetCount(group.variants.length, size) *
          visit(index + 1, edgeCount + size);
      }
    }
    memo.set(key, total);
    return total;
  }
  return visit(0, 0);
}

function normalizeFrontierInput(frontierInput, binding) {
  let value;
  try {
    value = canonicalClone(frontierInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NODE_FRONTIER_INPUT_INVALID",
      "Node-frontier input is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value) || !isObject(value.candidateInput) || !isObject(value.frontier)) {
    fail(
      "PACKAGE_NODE_FRONTIER_INPUT_INVALID",
      "Node-frontier input must contain candidateInput and frontier objects."
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
      "assignedNodes",
      "totalNodes",
      "remainingNodeAssignments",
      "edgeRawCandidatesPerAssignment",
      "remainingRawCandidates"
    ]).has(field)
  );
  if (inputUnknown.length > 0 || candidateUnknown.length > 0 || frontierUnknown.length > 0) {
    fail(
      "PACKAGE_NODE_FRONTIER_INPUT_INVALID",
      "Node-frontier fields do not match the closed execution contract.",
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
    !Array.isArray(candidateInput.edges) ||
    candidateInput.edges.length !== 0 ||
    !Number.isSafeInteger(frontier.assignedNodes) ||
    frontier.assignedNodes < 1 ||
    frontier.assignedNodes >= skeleton.nodeCount ||
    candidateInput.nodes.length !== frontier.assignedNodes ||
    frontier.totalNodes !== skeleton.nodeCount ||
    frontier.remainingNodeAssignments !== skeleton.nodeCount - frontier.assignedNodes
  ) {
    fail(
      "PACKAGE_NODE_FRONTIER_STATE_INVALID",
      "Node-frontier state does not belong to a strict bound node prefix.",
      { frontier, skeletonId: skeleton?.id ?? null }
    );
  }
  const allowedNodes = new Set(
    binding.enumerationInput.nodeVariants.map((entry) => canonicalize(entry))
  );
  if (candidateInput.nodes.some((entry) => !allowedNodes.has(canonicalize(entry)))) {
    fail(
      "PACKAGE_NODE_FRONTIER_UNIVERSE_MISMATCH",
      "Node frontier contains a node outside the bound variant alphabet."
    );
  }
  const edgeCount = edgeCompletionCount(binding, skeleton);
  const remaining = edgeCount *
    BigInt(binding.enumerationInput.nodeVariants.length) **
      BigInt(frontier.remainingNodeAssignments);
  if (
    edgeCount > BigInt(Number.MAX_SAFE_INTEGER) ||
    remaining > BigInt(Number.MAX_SAFE_INTEGER) ||
    frontier.edgeRawCandidatesPerAssignment !== Number(edgeCount) ||
    frontier.remainingRawCandidates !== Number(remaining)
  ) {
    fail(
      "PACKAGE_NODE_FRONTIER_REMAINING_COUNT_MISMATCH",
      "Node-frontier counts differ from exact subtree reproduction.",
      {
        expectedEdgeRawCandidatesPerAssignment: edgeCount.toString(),
        expectedRemainingRawCandidates: remaining.toString(),
        actualEdgeRawCandidatesPerAssignment:
          frontier.edgeRawCandidatesPerAssignment,
        actualRemainingRawCandidates: frontier.remainingRawCandidates
      }
    );
  }
  return value;
}

function evaluateDecision(
  loadedPackage,
  nodeAudit,
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
      "PACKAGE_NODE_FRONTIER_PREDICATE_ID_INVALID",
      "Node-frontier authorization requires a normalized predicate ID.",
      { predicateId }
    );
  }
  const plan = loadedPackage.predicatePlans.find(
    (entry) => entry.predicateId === predicateId
  );
  if (plan === undefined) {
    fail(
      "PACKAGE_NODE_FRONTIER_PREDICATE_UNKNOWN",
      "Node-frontier authorization references an unknown predicate.",
      { predicateId }
    );
  }
  const normalized = normalizeFrontierInput(frontierInput, nodeAudit.binding);
  const partialGraph = {
    domain: normalized.candidateInput.domain,
    nodes: normalized.candidateInput.nodes,
    edges: [],
    nodesComplete: false
  };
  const diagnostic = detectPartialGraphPredicateFailure(plan, partialGraph);
  const planAudit = nodeAudit.results.find(
    (entry) => entry.predicateId === predicateId
  );
  const connectivity = connectivitySupported(nodeAudit.binding);
  const authorizedPlan = nodeAudit.status === "passed" &&
    planAudit?.status === "passed" &&
    planAudit.pruningEligible === true &&
    plan.pruning.eligibility === "static-proven";
  const pruningAuthorized = Boolean(
    connectivity && authorizedPlan && diagnostic.persistentFailureDetected
  );
  const reason = pruningAuthorized
    ? "authorized-persistent-node-frontier-failure"
    : !connectivity
      ? "connectivity-universe-not-fixed"
      : nodeAudit.status !== "passed"
        ? "node-frontier-audit-not-passed"
        : !authorizedPlan
          ? "plan-not-authorized"
          : "persistent-failure-not-detected";
  const basis = {
    schemaVersion: "1",
    controller: contract.controller,
    packageId: nodeAudit.packageId,
    rulesHash: nodeAudit.rulesHash,
    bindingHash: nodeAudit.bindingHash,
    runConfigHash: nodeAudit.runConfigHash,
    canonicalAuditHash: nodeAudit.canonicalAuditHash,
    nodeFrontierAuditHash: nodeAudit.nodeFrontierAuditHash,
    predicateId,
    predicatePlanHash: plan.planHash,
    ...(nodeAudit.targetDepth === undefined
      ? {}
      : {
          targetDepth: nodeAudit.targetDepth,
          sourcePopulationHash: nodeAudit.sourcePopulationHash
        }),
    extensionModel: contract.policy.extensionModel,
    frontier: normalized.frontier,
    connectivityUniverseFixed: connectivity,
    diagnostic,
    pruningAuthorized,
    reason
  };
  return deepFreeze({
    ...basis,
    decisionHash: hashCanonical(contract.decisionHashDomain, basis)
  });
}

export function createPreparedPackageNodeFrontierControllerSession(
  loadedPackage,
  canonicalController,
  nodeAudit,
  contract
) {
  const authorizedPredicateIds = nodeAudit.status === "passed"
    ? nodeAudit.results
      .filter((entry) => entry.status === "passed" && entry.pruningEligible)
      .map((entry) => entry.predicateId)
      .sort(compareStrings)
    : [];
  return Object.freeze({
    canonicalAudit: canonicalController.audit,
    nodeFrontierAudit: nodeAudit,
    binding: nodeAudit.binding,
    kernelVersion: canonicalController.kernelVersion,
    preAdmissionAuthorizedPredicateIds: canonicalController.authorizedPredicateIds,
    authorizedPredicateIds: deepFreeze(authorizedPredicateIds),
    evaluatePreAdmission(predicateId, partialGraph) {
      return canonicalController.evaluate(predicateId, partialGraph);
    },
    evaluate(predicateId, frontier) {
      return evaluateDecision(
        loadedPackage,
        nodeAudit,
        predicateId,
        frontier,
        contract
      );
    }
  });
}

export function createPackageNodeFrontierControllerSession(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  nodeAuditInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const canonicalController = createPackagePartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    normalized.value
  );
  const nodeAudit = verifyPackageNodeFrontierAudit(
    nodeAuditInput,
    loadedPackageInput,
    runConfigInput,
    canonicalController.audit,
    normalized.value
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized.value)
  );
  return createPreparedPackageNodeFrontierControllerSession(
    loadedPackage,
    canonicalController,
    nodeAudit,
    DEPTH_ONE_NODE_FRONTIER_CONTRACT
  );
}

export function authorizePackageNodeFrontierPruning(
  loadedPackageInput,
  runConfigInput,
  canonicalAuditInput,
  nodeAuditInput,
  predicateId,
  frontier,
  options = {}
) {
  return createPackageNodeFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    canonicalAuditInput,
    nodeAuditInput,
    options
  ).evaluate(predicateId, frontier);
}
