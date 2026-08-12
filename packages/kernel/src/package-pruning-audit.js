import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import {
  detectPartialGraphPredicateFailure,
  evaluateGraphPredicatePlan
} from "./graph-predicate-evaluator.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  enumeratePackageCandidates,
  normalizePackageCandidateExecutionOptions
} from "./package-candidate-generator.js";
import { normalizeRunConfig } from "./run-config.js";

export const PACKAGE_PREDICATE_MONOTONICITY_AUDITOR_VERSION =
  "package-predicate-monotonicity-auditor-v1";
export const PACKAGE_PARTIAL_PRUNING_CONTROLLER_VERSION =
  "package-partial-pruning-controller-v1";
export const PACKAGE_PREDICATE_MONOTONICITY_AUDIT_SCOPE =
  "complete-depth-one-canonical-universe-v1";
export const PACKAGE_PREDICATE_MONOTONICITY_AUDIT_POLICY = deepFreeze({
  extensionModel: "complete-node-canonical-edge-prefix-v1",
  samplingAlgorithm: "sha256-rejection-counter-v1",
  replacement: "with-replacement",
  counterexampleRule: "partial-fail-extension-pass-v1",
  proofInterpretation: "falsification-only-static-proof-required-v1"
});
export const DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS =
  deepFreeze({
    samplesPerPredicate: 200,
    maxSamplesPerPredicate: 10_000,
    maxStreamDraws: 1_024
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
const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "samplesPerPredicate"
]);
const PARTIAL_GRAPH_FIELDS = new Set([
  "domain",
  "nodes",
  "edges",
  "nodesComplete"
]);
const SHA256_RANGE = 1n << 256n;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, stage, message, details = {}) {
  throw new KernelError({ code, stage, message, details });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizePackagePredicateMonotonicityAuditOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_OPTIONS_INVALID",
      "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
      "Monotonicity-audit options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_OPTIONS_INVALID",
      "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
      "Monotonicity-audit options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_OPTION_UNKNOWN",
      "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
      "Unknown monotonicity-audit option.",
      { unknown }
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
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_SAMPLE_LIMIT_INVALID",
      "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
      "Audit samples per predicate must be a bounded non-negative safe integer.",
      {
        value: samplesPerPredicate,
        maximum:
          DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS.maxSamplesPerPredicate
      }
    );
  }
  const execution = normalizePackageCandidateExecutionOptions(Object.fromEntries(
    Object.entries(value).filter(([field]) => field !== "samplesPerPredicate")
  ));
  return { ...execution, samplesPerPredicate };
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function generationOptions(options) {
  return {
    maxRawCandidates: options.maxRawCandidates,
    maxDecorationStates: options.maxDecorationStates,
    maxSearchStates: options.maxSearchStates,
    ...(options.kernelVersion === undefined
      ? {}
      : { kernelVersion: options.kernelVersion })
  };
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

function graphRuntimeSupported(plan) {
  return plan.requirements.operators.every((operator) =>
    GRAPH_OPERATORS.has(operator)
  );
}

function buildExtensionFrame(candidateRecords) {
  const spans = [];
  let frameSize = 0;
  for (const record of candidateRecords) {
    const width = record.candidate.edges.length;
    if (width === 0) continue;
    const next = frameSize + width;
    if (!Number.isSafeInteger(next)) {
      fail(
        "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_FRAME_LIMIT",
        "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
        "The strict edge-prefix extension frame exceeds the safe-integer limit.",
        { frameSize, nextWidth: width }
      );
    }
    spans.push({ start: frameSize, end: next, record });
    frameSize = next;
  }
  return { spans, frameSize };
}

function frameEntry(frame, frameIndex) {
  let low = 0;
  let high = frame.spans.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const span = frame.spans[middle];
    if (frameIndex < span.start) {
      high = middle - 1;
    } else if (frameIndex >= span.end) {
      low = middle + 1;
    } else {
      return {
        record: span.record,
        partialEdgeCount: frameIndex - span.start
      };
    }
  }
  fail(
    "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_FRAME_INVALID",
    "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
    "A sampled extension-frame index cannot be resolved.",
    { frameIndex, frameSize: frame.frameSize }
  );
}

function sampleFrameIndex(
  frameSize,
  sampleOrdinal,
  planHash,
  universeHash,
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
    const digest = hashCanonical(contract.sampleHashDomain, {
      schemaVersion: "1",
      algorithm: contract.policy.samplingAlgorithm,
      runConfigHash,
      universeHash,
      predicatePlanHash: planHash,
      sampleOrdinal,
      streamCounter
    });
    const value = BigInt(`0x${digest.slice("sha256:".length)}`);
    if (value < rejectionLimit) {
      return {
        frameIndex: Number(value % modulus),
        streamDraws: streamCounter + 1
      };
    }
  }
  fail(
    "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_STREAM_EXHAUSTED",
    "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
    "The audit sampling stream exceeded its bounded rejection window.",
    { predicatePlanHash: planHash, sampleOrdinal, frameSize }
  );
}

function partialGraph(record, partialEdgeCount) {
  return {
    domain: record.candidate.domain,
    nodes: record.candidate.nodes,
    edges: record.candidate.edges.slice(0, partialEdgeCount),
    nodesComplete: true
  };
}

function candidateInputFromPartial(input) {
  return {
    domain: input.domain,
    nodes: input.nodes,
    edges: input.edges
  };
}

function auditPlan(
  plan,
  frame,
  samplesPerPredicate,
  universeHash,
  binding,
  contract
) {
  const supported = graphRuntimeSupported(plan);
  if (!supported) {
    return {
      predicateId: plan.predicateId,
      predicatePlanHash: plan.planHash,
      pruningEligibility: plan.pruning.eligibility,
      runtimeSupport: "unsupported",
      frameSize: frame.frameSize,
      requestedSamples: samplesPerPredicate,
      samples: [],
      counts: {
        attempted: 0,
        partialFailures: 0,
        extensionPasses: 0,
        persistentFailuresDetected: 0,
        counterexamples: 0
      },
      status: "unsupported",
      pruningEligible: false
    };
  }
  if (frame.frameSize === 0 || samplesPerPredicate === 0) {
    return {
      predicateId: plan.predicateId,
      predicatePlanHash: plan.planHash,
      pruningEligibility: plan.pruning.eligibility,
      runtimeSupport: "graph-complete-and-partial-v1",
      frameSize: frame.frameSize,
      requestedSamples: samplesPerPredicate,
      samples: [],
      counts: {
        attempted: 0,
        partialFailures: 0,
        extensionPasses: 0,
        persistentFailuresDetected: 0,
        counterexamples: 0
      },
      status: frame.frameSize === 0 ? "no-extensions" : "no-samples",
      pruningEligible: false
    };
  }

  const options = graphEvaluationOptions(binding);
  const extensionCache = new Map();
  const samples = Array.from({ length: samplesPerPredicate }, (_, sampleOrdinal) => {
    const selection = sampleFrameIndex(
      frame.frameSize,
      sampleOrdinal,
      plan.planHash,
      universeHash,
      binding.runConfigHash,
      contract
    );
    const selected = frameEntry(frame, selection.frameIndex);
    const partial = partialGraph(selected.record, selected.partialEdgeCount);
    const partialEvaluation = evaluateGraphPredicatePlan(
      plan,
      candidateInputFromPartial(partial),
      options
    );
    let extensionEvaluation = extensionCache.get(selected.record.candidateId);
    if (extensionEvaluation === undefined) {
      extensionEvaluation = evaluateGraphPredicatePlan(
        plan,
        selected.record.candidate,
        options
      );
      extensionCache.set(selected.record.candidateId, extensionEvaluation);
    }
    const diagnostic = detectPartialGraphPredicateFailure(plan, partial);
    const counterexample = partialEvaluation.outcome === "fail" &&
      extensionEvaluation.outcome === "pass";
    return {
      sampleOrdinal,
      frameIndex: selection.frameIndex,
      streamDraws: selection.streamDraws,
      extensionCandidateId: selected.record.candidateId,
      partialGraphHash: diagnostic.partialGraphHash,
      partialEvaluationHash: partialEvaluation.evaluationHash,
      extensionEvaluationHash: extensionEvaluation.evaluationHash,
      diagnosticEvaluationHash: diagnostic.evaluationHash,
      partialEdgeCount: selected.partialEdgeCount,
      extensionEdgeCount: selected.record.candidate.edges.length,
      partialOutcome: partialEvaluation.outcome,
      extensionOutcome: extensionEvaluation.outcome,
      persistentFailureDetected: diagnostic.persistentFailureDetected,
      counterexample
    };
  });
  const counts = {
    attempted: samples.length,
    partialFailures: samples.filter((entry) => entry.partialOutcome === "fail").length,
    extensionPasses: samples.filter((entry) => entry.extensionOutcome === "pass").length,
    persistentFailuresDetected: samples.filter(
      (entry) => entry.persistentFailureDetected
    ).length,
    counterexamples: samples.filter((entry) => entry.counterexample).length
  };
  const status = counts.counterexamples > 0 ? "failed" : "passed";
  return {
    predicateId: plan.predicateId,
    predicatePlanHash: plan.planHash,
    pruningEligibility: plan.pruning.eligibility,
    runtimeSupport: "graph-complete-and-partial-v1",
    frameSize: frame.frameSize,
    requestedSamples: samplesPerPredicate,
    samples,
    counts,
    status,
    pruningEligible: status === "passed" &&
      plan.pruning.eligibility === "static-proven"
  };
}

const DEPTH_ONE_AUDIT_CONTRACT = Object.freeze({
  auditor: PACKAGE_PREDICATE_MONOTONICITY_AUDITOR_VERSION,
  scope: PACKAGE_PREDICATE_MONOTONICITY_AUDIT_SCOPE,
  policy: PACKAGE_PREDICATE_MONOTONICITY_AUDIT_POLICY,
  generator: "package-candidate-generator-v5",
  auditHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_AUDIT,
  sampleHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_AUDIT_SAMPLE,
  universeHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_AUDIT_UNIVERSE,
  controller: PACKAGE_PARTIAL_PRUNING_CONTROLLER_VERSION,
  decisionHashDomain: HASH_DOMAINS.PACKAGE_PRUNING_DECISION
});

/** Internal shared audit engine for an already reproduced finite binding. */
export function auditBoundPackagePredicateMonotonicity(
  loadedPackage,
  binding,
  enumeration,
  samplesPerPredicate,
  contract,
  context = {}
) {
  if (
    enumeration.status !== "complete" ||
    enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_UNIVERSE_INCOMPLETE",
      "AUDIT_PACKAGE_PREDICATE_MONOTONICITY",
      "A monotonicity audit requires a complete canonical candidate universe.",
      { exhausted: enumeration.budget.exhausted }
    );
  }
  const candidateRecords = enumeration.candidateStore.candidates;
  const frame = buildExtensionFrame(candidateRecords);
  const universeBasis = {
    schemaVersion: "1",
    bindingHash: binding.bindingHash,
    candidateIds: candidateRecords.map((entry) => entry.candidateId)
  };
  const universeHash = hashCanonical(
    contract.universeHashDomain,
    universeBasis
  );
  const plans = loadedPackage.predicatePlans
    .filter((plan) => plan.monotoneViolation)
    .sort((left, right) => compareStrings(left.predicateId, right.predicateId));
  const results = plans.map((plan) => auditPlan(
    plan,
    frame,
    samplesPerPredicate,
    universeHash,
    binding,
    contract
  ));
  const status = overallStatus(results);
  const counts = {
    declaredPredicates: results.length,
    runtimeSupportedPredicates: results.filter(
      (entry) => entry.runtimeSupport === "graph-complete-and-partial-v1"
    ).length,
    passedPredicates: results.filter((entry) => entry.status === "passed").length,
    failedPredicates: results.filter((entry) => entry.status === "failed").length,
    indeterminatePredicates: results.filter((entry) =>
      new Set(["unsupported", "no-extensions", "no-samples"]).has(entry.status)
    ).length,
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
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: binding.bindingHash,
    binding,
    runConfigHash: binding.runConfigHash,
    ...context,
    seed: binding.runConfig.seed,
    policy: contract.policy,
    samplesPerPredicate,
    universe: {
      generator: contract.generator,
      candidateCount: candidateRecords.length,
      extensionFrameSize: frame.frameSize,
      universeHash
    },
    results,
    counts,
    status
  };
  return deepFreeze({
    ...basis,
    auditHash: hashCanonical(contract.auditHashDomain, basis)
  });
}

function overallStatus(results) {
  if (results.length === 0) return "not-applicable";
  if (results.some((entry) => entry.status === "failed")) return "failed";
  return results.every((entry) => entry.status === "passed")
    ? "passed"
    : "indeterminate";
}

/**
 * Reproduces the complete depth-one universe and performs a deterministic
 * falsification audit for every predicate that declares monotone violation.
 */
export function auditPackagePredicateMonotonicity(
  loadedPackageInput,
  runConfigInput,
  options = {}
) {
  const normalizedOptions = normalizePackagePredicateMonotonicityAuditOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  const generation = enumeratePackageCandidates(
    loadedPackage,
    runConfig,
    generationOptions(normalizedOptions)
  );
  return auditBoundPackagePredicateMonotonicity(
    loadedPackage,
    generation.binding,
    generation.enumeration,
    normalizedOptions.samplesPerPredicate,
    DEPTH_ONE_AUDIT_CONTRACT
  );
}

/** Reproduces a stored monotonicity audit byte-for-byte. */
export function verifyPackagePredicateMonotonicityAudit(
  auditInput,
  loadedPackageInput,
  runConfigInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(auditInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_INVALID",
      "VERIFY_PACKAGE_PREDICATE_MONOTONICITY",
      "Monotonicity-audit artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = auditPackagePredicateMonotonicity(
    loadedPackageInput,
    runConfigInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_MISMATCH",
      "VERIFY_PACKAGE_PREDICATE_MONOTONICITY",
      "Monotonicity audit differs from deterministic reproduction.",
      {
        expectedAuditHash: reproduced.auditHash,
        actualAuditHash: isObject(supplied) && typeof supplied.auditHash === "string"
          ? supplied.auditHash
          : null
      }
    );
  }
  return reproduced;
}

function normalizePredicateId(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim()
  ) {
    fail(
      "PACKAGE_PARTIAL_PRUNING_PREDICATE_ID_INVALID",
      "AUTHORIZE_PACKAGE_PARTIAL_PRUNING",
      "Partial-pruning authorization requires a normalized predicate ID.",
      { value }
    );
  }
  return value;
}

function validatePartialGraphForBinding(partialGraphInput, binding) {
  let value;
  try {
    value = canonicalClone(partialGraphInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_PARTIAL_PRUNING_GRAPH_INVALID",
      "AUTHORIZE_PACKAGE_PARTIAL_PRUNING",
      "Partial graph is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value) || value.nodesComplete !== true) {
    fail(
      "PACKAGE_PARTIAL_PRUNING_EXTENSION_MODEL_MISMATCH",
      "AUTHORIZE_PACKAGE_PARTIAL_PRUNING",
      "The v1 pruning controller accepts only complete-node edge-prefix states.",
      { nodesComplete: isObject(value) ? value.nodesComplete : null }
    );
  }
  const unknown = Object.keys(value).filter(
    (field) => !PARTIAL_GRAPH_FIELDS.has(field)
  );
  const missing = [...PARTIAL_GRAPH_FIELDS].filter(
    (field) => !Object.hasOwn(value, field)
  );
  if (unknown.length > 0 || missing.length > 0) {
    fail(
      "PACKAGE_PARTIAL_PRUNING_GRAPH_INVALID",
      "AUTHORIZE_PACKAGE_PARTIAL_PRUNING",
      "Partial graph fields do not match the closed controller contract.",
      { unknown, missing }
    );
  }
  const canonical = canonicalizeCandidate(candidateInputFromPartial(value),
    graphEvaluationOptions(binding));
  const allowedRefs = new Set(
    binding.enumerationInput.nodeVariants.map((entry) => entry.ref)
  );
  const allowedRoles = new Set(
    binding.enumerationInput.edgeVariants.map((entry) => entry.role)
  );
  const foreignRefs = canonical.canonical.nodes
    .map((entry) => entry.ref)
    .filter((ref) => !allowedRefs.has(ref));
  const foreignRoles = canonical.canonical.edges
    .map((entry) => entry.role)
    .filter((role) => !allowedRoles.has(role));
  const configuredMaxEdges = binding.enumerationOptions.maxEdges === "n+2"
    ? canonical.canonical.nodes.length + 2
    : binding.enumerationOptions.maxEdges;
  if (
    canonical.canonical.domain !== binding.enumerationInput.domain ||
    canonical.canonical.nodes.length > binding.runConfig.budget.maxNodes ||
    canonical.canonical.edges.length > configuredMaxEdges ||
    foreignRefs.length > 0 ||
    foreignRoles.length > 0
  ) {
    fail(
      "PACKAGE_PARTIAL_PRUNING_UNIVERSE_MISMATCH",
      "AUTHORIZE_PACKAGE_PARTIAL_PRUNING",
      "Partial graph is outside the audited package/run extension universe.",
      {
        expectedDomain: binding.enumerationInput.domain,
        actualDomain: canonical.canonical.domain,
        foreignRefs,
        foreignRoles,
        nodeCount: canonical.canonical.nodes.length,
        maximumNodes: binding.runConfig.budget.maxNodes,
        edgeCount: canonical.canonical.edges.length,
        maximumEdges: configuredMaxEdges
      }
    );
  }
  return {
    domain: canonical.canonical.domain,
    nodes: canonical.canonical.nodes,
    edges: canonical.canonical.edges,
    nodesComplete: true
  };
}

/**
 * Produces a separate authorization decision. The diagnostic evaluator remains
 * incapable of authorizing pruning by itself.
 */
export function authorizePackagePartialPruning(
  loadedPackageInput,
  runConfigInput,
  auditInput,
  predicateIdInput,
  partialGraphInput,
  options = {}
) {
  return createPackagePartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    auditInput,
    options
  ).evaluate(predicateIdInput, partialGraphInput);
}

function evaluatePreparedPartialPruningDecision(
  loadedPackage,
  audit,
  predicateIdInput,
  partialGraphInput,
  contract
) {
  const predicateId = normalizePredicateId(predicateIdInput);
  const plan = loadedPackage.predicatePlans.find(
    (entry) => entry.predicateId === predicateId
  );
  if (plan === undefined) {
    fail(
      "PACKAGE_PARTIAL_PRUNING_PREDICATE_UNKNOWN",
      "AUTHORIZE_PACKAGE_PARTIAL_PRUNING",
      "Partial-pruning authorization references an unknown package predicate.",
      { predicateId }
    );
  }
  const partialGraph = validatePartialGraphForBinding(
    partialGraphInput,
    audit.binding
  );
  const diagnostic = detectPartialGraphPredicateFailure(plan, partialGraph);
  const planAudit = audit.results.find((entry) => entry.predicateId === predicateId);
  const authorizedPlan = audit.status === "passed" &&
    planAudit?.status === "passed" &&
    planAudit.pruningEligible &&
    plan.pruning.eligibility === "static-proven";
  const pruningAuthorized = Boolean(
    authorizedPlan && diagnostic.persistentFailureDetected
  );
  const reason = pruningAuthorized
    ? "authorized-persistent-failure"
    : audit.status !== "passed"
      ? "audit-not-passed"
      : !authorizedPlan
        ? "plan-not-authorized"
        : "persistent-failure-not-detected";
  const basis = {
    schemaVersion: "1",
    controller: contract.controller,
    packageId: audit.packageId,
    rulesHash: audit.rulesHash,
    bindingHash: audit.bindingHash,
    runConfigHash: audit.runConfigHash,
    auditHash: audit.auditHash,
    predicateId,
    predicatePlanHash: plan.planHash,
    ...(audit.targetDepth === undefined
      ? {}
      : {
          targetDepth: audit.targetDepth,
          sourcePopulationHash: audit.sourcePopulationHash
        }),
    extensionModel: contract.policy.extensionModel,
    auditStatus: audit.status,
    planAuditStatus: planAudit?.status ?? "not-declared",
    diagnostic,
    pruningAuthorized,
    reason
  };
  return deepFreeze({
    ...basis,
    decisionHash: hashCanonical(contract.decisionHashDomain, basis)
  });
}

/** Internal prepared controller for an already verified bound audit. */
export function createPreparedPackagePartialPruningControllerSession(
  loadedPackage,
  audit,
  kernelVersion,
  contract
) {
  const authorizedPredicateIds = audit.status === "passed"
    ? audit.results
      .filter((entry) => entry.status === "passed" && entry.pruningEligible)
      .map((entry) => entry.predicateId)
      .sort(compareStrings)
    : [];
  return Object.freeze({
    audit,
    binding: audit.binding,
    kernelVersion,
    authorizedPredicateIds: deepFreeze(authorizedPredicateIds),
    evaluate(predicateId, partialGraph) {
      return evaluatePreparedPartialPruningDecision(
        loadedPackage,
        audit,
        predicateId,
        partialGraph,
        contract
      );
    }
  });
}

/**
 * Verifies a package/run/audit tuple once and prepares the immutable controller
 * state used by repeated generator-frontier decisions. Individual evaluations
 * retain the exact same artifact contract as the one-shot authorization API.
 */
export function createPackagePartialPruningControllerSession(
  loadedPackageInput,
  runConfigInput,
  auditInput,
  options = {}
) {
  const normalizedOptions = normalizePackagePredicateMonotonicityAuditOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const audit = verifyPackagePredicateMonotonicityAudit(
    auditInput,
    loadedPackage,
    runConfigInput,
    normalizedOptions
  );
  return createPreparedPackagePartialPruningControllerSession(
    loadedPackage,
    audit,
    loadedPackage.semanticManifest.kernelVersion,
    DEPTH_ONE_AUDIT_CONTRACT
  );
}
