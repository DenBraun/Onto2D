import { canonicalClone, canonicalize } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  PACKAGE_GENERATOR_FRONTIER_AUDIT_POLICY,
  auditBoundPackageGeneratorFrontiers,
  createPreparedPackageGeneratorFrontierControllerSession
} from "./package-generator-frontier-audit.js";
import {
  createPackageDepthCandidateFilterSession
} from "./package-depth-candidate-filter.js";
import {
  enumeratePackageDepthCandidates
} from "./package-depth-candidate-generator.js";
import {
  PACKAGE_PREDICATE_MONOTONICITY_AUDIT_POLICY,
  auditBoundPackagePredicateMonotonicity,
  createPreparedPackagePartialPruningControllerSession,
  normalizePackagePredicateMonotonicityAuditOptions
} from "./package-pruning-audit.js";
import {
  enumerateBoundPackageCandidatesWithPruning
} from "./package-pruned-candidate-generator.js";
import {
  enumerateBoundPackageCandidatesWithRecursivePruning
} from "./package-recursive-pruned-candidate-generator.js";
import {
  PACKAGE_NODE_FRONTIER_AUDIT_POLICY,
  auditBoundPackageNodeFrontiers,
  createPreparedPackageNodeFrontierControllerSession
} from "./package-node-frontier-audit.js";
import {
  enumerateBoundPackageCandidatesWithNodeGrowthPruning
} from "./package-node-growth-pruned-candidate-generator.js";

export const PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDITOR_VERSION =
  "package-depth-predicate-monotonicity-auditor-v1";
export const PACKAGE_DEPTH_PARTIAL_PRUNING_CONTROLLER_VERSION =
  "package-depth-partial-pruning-controller-v1";
export const PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDIT_SCOPE =
  "complete-depth-aware-canonical-universe-v1";
export const PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDITOR_VERSION =
  "package-depth-generator-frontier-auditor-v1";
export const PACKAGE_DEPTH_GENERATOR_FRONTIER_CONTROLLER_VERSION =
  "package-depth-generator-frontier-controller-v1";
export const PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SCOPE =
  "complete-depth-aware-raw-edge-group-frontiers-v1";
export const PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATOR_VERSION =
  "package-depth-pruned-candidate-generator-v1";
export const PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION =
  "package-depth-recursive-pruned-candidate-generator-v1";
export const PACKAGE_DEPTH_CANDIDATE_PRUNING_STRATEGY =
  "canonical-candidate-prefix-pre-admission-v1";
export const PACKAGE_DEPTH_RECURSIVE_PRUNING_STRATEGY =
  "audited-edge-group-subtree-pruning-v1";
export const PACKAGE_DEPTH_NODE_FRONTIER_AUDITOR_VERSION =
  "package-depth-node-frontier-auditor-v1";
export const PACKAGE_DEPTH_NODE_FRONTIER_CONTROLLER_VERSION =
  "package-depth-node-frontier-controller-v1";
export const PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SCOPE =
  "complete-depth-aware-raw-node-prefix-extension-pairs-v1";
export const PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION =
  "package-depth-node-growth-pruned-candidate-generator-v1";
export const PACKAGE_DEPTH_NODE_GROWTH_PRUNING_STRATEGY =
  "audited-node-assignment-subtree-pruning-v1";

const CANONICAL_AUDIT_CONTRACT = Object.freeze({
  auditor: PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDITOR_VERSION,
  scope: PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDIT_SCOPE,
  policy: PACKAGE_PREDICATE_MONOTONICITY_AUDIT_POLICY,
  generator: "package-depth-candidate-generator-v3",
  auditHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT,
  sampleHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT_SAMPLE,
  universeHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT_UNIVERSE,
  controller: PACKAGE_DEPTH_PARTIAL_PRUNING_CONTROLLER_VERSION,
  decisionHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_DECISION
});

const FRONTIER_AUDIT_CONTRACT = Object.freeze({
  auditor: PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDITOR_VERSION,
  scope: PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SCOPE,
  policy: PACKAGE_GENERATOR_FRONTIER_AUDIT_POLICY,
  auditHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT,
  sampleHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SAMPLE,
  frameHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_GENERATOR_FRONTIER_FRAME,
  canonicalUniverseHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT_UNIVERSE,
  controller: PACKAGE_DEPTH_GENERATOR_FRONTIER_CONTROLLER_VERSION,
  decisionHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_GENERATOR_FRONTIER_DECISION
});

const PRE_ADMISSION_CONTRACT = Object.freeze({
  generator: PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATOR_VERSION,
  strategy: PACKAGE_DEPTH_CANDIDATE_PRUNING_STRATEGY,
  transcriptHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_TRANSCRIPT,
  resultSetHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_RESULT_SET,
  canonicalUniverseHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT_UNIVERSE,
  generationHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATION
});

const RECURSIVE_CONTRACT = Object.freeze({
  generator: PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION,
  strategy: PACKAGE_DEPTH_RECURSIVE_PRUNING_STRATEGY,
  transcriptHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_RECURSIVE_PRUNING_TRANSCRIPT,
  resultSetHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_RESULT_SET,
  generationHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATION
});

const NODE_FRONTIER_AUDIT_CONTRACT = Object.freeze({
  auditor: PACKAGE_DEPTH_NODE_FRONTIER_AUDITOR_VERSION,
  scope: PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SCOPE,
  policy: PACKAGE_NODE_FRONTIER_AUDIT_POLICY,
  auditHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_NODE_FRONTIER_AUDIT,
  sampleHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SAMPLE,
  frameHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_NODE_FRONTIER_FRAME,
  canonicalUniverseHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT_UNIVERSE,
  controller: PACKAGE_DEPTH_NODE_FRONTIER_CONTROLLER_VERSION,
  decisionHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_NODE_FRONTIER_DECISION
});

const NODE_GROWTH_CONTRACT = Object.freeze({
  generator: PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION,
  strategy: PACKAGE_DEPTH_NODE_GROWTH_PRUNING_STRATEGY,
  transcriptHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_NODE_GROWTH_PRUNING_TRANSCRIPT,
  resultSetHashDomain: HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_RESULT_SET,
  generationHashDomain:
    HASH_DOMAINS.PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION
});

const DEPTH_OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations",
  "samplesPerPredicate"
]);

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PACKAGE_DEPTH_PRUNING",
    message,
    details
  });
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function normalizeDepthOptions(options) {
  const value = cloneArtifact(
    options,
    "PACKAGE_DEPTH_PRUNING_OPTIONS_INVALID",
    "Depth-aware pruning options are not canonicalizable."
  );
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(
      "PACKAGE_DEPTH_PRUNING_OPTIONS_INVALID",
      "Depth-aware pruning options must be an object."
    );
  }
  const unknown = Object.keys(value).filter(
    (field) => !DEPTH_OPTION_FIELDS.has(field)
  );
  if (unknown.length > 0) {
    fail(
      "PACKAGE_DEPTH_PRUNING_OPTION_UNKNOWN",
      "Unknown depth-aware pruning option.",
      { unknown }
    );
  }
  const auditOptions = Object.fromEntries(
    Object.entries(value).filter(([field]) => !new Set([
      "maxFunctionalEvaluations",
      "maxSensitivityFunctionalEvaluations"
    ]).has(field))
  );
  const normalizedAudit =
    normalizePackagePredicateMonotonicityAuditOptions(auditOptions);
  return {
    ...value,
    ...normalizedAudit
  };
}

function generationOptions(options) {
  return {
    maxRawCandidates: options.maxRawCandidates,
    maxDecorationStates: options.maxDecorationStates,
    maxSearchStates: options.maxSearchStates,
    ...(options.maxFunctionalEvaluations === undefined
      ? {}
      : { maxFunctionalEvaluations: options.maxFunctionalEvaluations }),
    ...(options.maxSensitivityFunctionalEvaluations === undefined
      ? {}
      : {
          maxSensitivityFunctionalEvaluations:
            options.maxSensitivityFunctionalEvaluations
        }),
    ...(options.kernelVersion === undefined
      ? {}
      : { kernelVersion: options.kernelVersion })
  };
}

function contextForBinding(binding) {
  return {
    targetDepth: binding.targetDepth,
    sourcePopulationHash: binding.sourcePopulation.selectionHash
  };
}

function cloneArtifact(value, code, message) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, message, { causeCode: error.code });
  }
}

function assertReproduced(supplied, reproduced, code, message, hashField) {
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(code, message, {
      expectedHash: reproduced[hashField],
      actualHash: supplied?.[hashField] ?? null
    });
  }
  return reproduced;
}

/** Audits the complete canonical universe bound to an arbitrary target depth. */
export function auditPackageDepthPredicateMonotonicity(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  options = {}
) {
  const normalized = normalizeDepthOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const generation = enumeratePackageDepthCandidates(
    loadedPackage,
    runConfigInput,
    levelClosures,
    targetDepth,
    generationOptions(normalized)
  );
  return auditBoundPackagePredicateMonotonicity(
    loadedPackage,
    generation.binding,
    generation.enumeration,
    normalized.samplesPerPredicate,
    CANONICAL_AUDIT_CONTRACT,
    contextForBinding(generation.binding)
  );
}

export function verifyPackageDepthPredicateMonotonicityAudit(
  auditInput,
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  options = {}
) {
  const supplied = cloneArtifact(
    auditInput,
    "PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDIT_INVALID",
    "Depth-aware monotonicity audit is not canonicalizable."
  );
  return assertReproduced(
    supplied,
    auditPackageDepthPredicateMonotonicity(
      loadedPackageInput,
      runConfigInput,
      levelClosures,
      targetDepth,
      options
    ),
    "PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDIT_MISMATCH",
    "Depth-aware monotonicity audit differs from deterministic reproduction.",
    "auditHash"
  );
}

export function createPackageDepthPartialPruningControllerSession(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  auditInput,
  options = {}
) {
  const normalized = normalizeDepthOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const audit = verifyPackageDepthPredicateMonotonicityAudit(
    auditInput,
    loadedPackage,
    runConfigInput,
    levelClosures,
    targetDepth,
    normalized
  );
  return createPreparedPackagePartialPruningControllerSession(
    loadedPackage,
    audit,
    loadedPackage.semanticManifest.kernelVersion,
    CANONICAL_AUDIT_CONTRACT
  );
}

export function authorizePackageDepthPartialPruning(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  auditInput,
  predicateId,
  partialGraph,
  options = {}
) {
  return createPackageDepthPartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    auditInput,
    options
  ).evaluate(predicateId, partialGraph);
}

export function enumeratePackageDepthCandidatesWithPruning(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  auditInput,
  options = {}
) {
  const controller = createPackageDepthPartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    auditInput,
    options
  );
  const session = createPackageDepthCandidateFilterSession(
    loadedPackageInput,
    controller.binding,
    levelClosures,
    { kernelVersion: controller.kernelVersion }
  );
  return enumerateBoundPackageCandidatesWithPruning(
    controller,
    (candidate) => session.evaluate(candidate),
    PRE_ADMISSION_CONTRACT,
    contextForBinding(controller.binding)
  );
}

export function verifyPackageDepthCandidatesWithPruning(
  artifactInput,
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  auditInput,
  options = {}
) {
  const supplied = cloneArtifact(
    artifactInput,
    "PACKAGE_DEPTH_CANDIDATE_PRUNING_ARTIFACT_INVALID",
    "Depth-aware pre-admission artifact is not canonicalizable."
  );
  return assertReproduced(
    supplied,
    enumeratePackageDepthCandidatesWithPruning(
      loadedPackageInput,
      runConfigInput,
      levelClosures,
      targetDepth,
      auditInput,
      options
    ),
    "PACKAGE_DEPTH_CANDIDATE_PRUNING_ARTIFACT_MISMATCH",
    "Depth-aware pre-admission artifact differs from deterministic reproduction.",
    "generationHash"
  );
}

/** Audits actual raw edge-group frontiers for the same depth-aware universe. */
export function auditPackageDepthGeneratorFrontiers(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  options = {}
) {
  const normalized = normalizeDepthOptions(options);
  const canonicalController = createPackageDepthPartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    normalized
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    { kernelVersion: canonicalController.kernelVersion }
  );
  return auditBoundPackageGeneratorFrontiers(
    loadedPackage,
    canonicalController.binding,
    canonicalController.audit,
    normalized.samplesPerPredicate,
    FRONTIER_AUDIT_CONTRACT,
    contextForBinding(canonicalController.binding)
  );
}

export function verifyPackageDepthGeneratorFrontierAudit(
  auditInput,
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  options = {}
) {
  const supplied = cloneArtifact(
    auditInput,
    "PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_INVALID",
    "Depth-aware frontier audit is not canonicalizable."
  );
  return assertReproduced(
    supplied,
    auditPackageDepthGeneratorFrontiers(
      loadedPackageInput,
      runConfigInput,
      levelClosures,
      targetDepth,
      canonicalAuditInput,
      options
    ),
    "PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_MISMATCH",
    "Depth-aware frontier audit differs from deterministic reproduction.",
    "frontierAuditHash"
  );
}

export function createPackageDepthGeneratorFrontierControllerSession(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  frontierAuditInput,
  options = {}
) {
  const normalized = normalizeDepthOptions(options);
  const canonicalController = createPackageDepthPartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    normalized
  );
  const frontierAudit = verifyPackageDepthGeneratorFrontierAudit(
    frontierAuditInput,
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalController.audit,
    normalized
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    { kernelVersion: canonicalController.kernelVersion }
  );
  return createPreparedPackageGeneratorFrontierControllerSession(
    loadedPackage,
    canonicalController,
    frontierAudit,
    FRONTIER_AUDIT_CONTRACT
  );
}

export function authorizePackageDepthGeneratorFrontierPruning(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  frontierAuditInput,
  predicateId,
  frontier,
  options = {}
) {
  return createPackageDepthGeneratorFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    frontierAuditInput,
    options
  ).evaluate(predicateId, frontier);
}

export function enumeratePackageDepthCandidatesWithRecursivePruning(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  frontierAuditInput,
  options = {}
) {
  const controller = createPackageDepthGeneratorFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    frontierAuditInput,
    options
  );
  const preAdmission = enumeratePackageDepthCandidatesWithPruning(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    controller.canonicalAudit,
    options
  );
  return enumerateBoundPackageCandidatesWithRecursivePruning(
    controller,
    preAdmission,
    RECURSIVE_CONTRACT,
    contextForBinding(controller.binding)
  );
}

export function verifyPackageDepthCandidatesWithRecursivePruning(
  artifactInput,
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  frontierAuditInput,
  options = {}
) {
  const supplied = cloneArtifact(
    artifactInput,
    "PACKAGE_DEPTH_RECURSIVE_PRUNING_ARTIFACT_INVALID",
    "Depth-aware recursive-pruning artifact is not canonicalizable."
  );
  return assertReproduced(
    supplied,
    enumeratePackageDepthCandidatesWithRecursivePruning(
      loadedPackageInput,
      runConfigInput,
      levelClosures,
      targetDepth,
      canonicalAuditInput,
      frontierAuditInput,
      options
    ),
    "PACKAGE_DEPTH_RECURSIVE_PRUNING_ARTIFACT_MISMATCH",
    "Depth-aware recursive-pruning artifact differs from deterministic reproduction.",
    "generationHash"
  );
}

/** Audits incomplete node prefixes for an arbitrary bound source depth. */
export function auditPackageDepthNodeFrontiers(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  options = {}
) {
  const normalized = normalizeDepthOptions(options);
  const canonicalController = createPackageDepthPartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    normalized
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    { kernelVersion: canonicalController.kernelVersion }
  );
  return auditBoundPackageNodeFrontiers(
    loadedPackage,
    canonicalController.binding,
    canonicalController.audit,
    normalized.samplesPerPredicate,
    NODE_FRONTIER_AUDIT_CONTRACT,
    contextForBinding(canonicalController.binding)
  );
}

export function verifyPackageDepthNodeFrontierAudit(
  auditInput,
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  options = {}
) {
  const supplied = cloneArtifact(
    auditInput,
    "PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_INVALID",
    "A depth-aware node-frontier audit is not canonicalizable."
  );
  return assertReproduced(
    supplied,
    auditPackageDepthNodeFrontiers(
      loadedPackageInput,
      runConfigInput,
      levelClosures,
      targetDepth,
      canonicalAuditInput,
      options
    ),
    "PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_MISMATCH",
    "A depth-aware node-frontier audit differs from deterministic reproduction.",
    "nodeFrontierAuditHash"
  );
}

export function createPackageDepthNodeFrontierControllerSession(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  nodeFrontierAuditInput,
  options = {}
) {
  const normalized = normalizeDepthOptions(options);
  const canonicalController = createPackageDepthPartialPruningControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    normalized
  );
  const nodeFrontierAudit = verifyPackageDepthNodeFrontierAudit(
    nodeFrontierAuditInput,
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalController.audit,
    normalized
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    { kernelVersion: canonicalController.kernelVersion }
  );
  return createPreparedPackageNodeFrontierControllerSession(
    loadedPackage,
    canonicalController,
    nodeFrontierAudit,
    NODE_FRONTIER_AUDIT_CONTRACT
  );
}

export function authorizePackageDepthNodeFrontierPruning(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  nodeFrontierAuditInput,
  predicateId,
  frontier,
  options = {}
) {
  return createPackageDepthNodeFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    nodeFrontierAuditInput,
    options
  ).evaluate(predicateId, frontier);
}

export function enumeratePackageDepthCandidatesWithNodeGrowthPruning(
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  nodeFrontierAuditInput,
  options = {}
) {
  const controller = createPackageDepthNodeFrontierControllerSession(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    canonicalAuditInput,
    nodeFrontierAuditInput,
    options
  );
  const preAdmission = enumeratePackageDepthCandidatesWithPruning(
    loadedPackageInput,
    runConfigInput,
    levelClosures,
    targetDepth,
    controller.canonicalAudit,
    options
  );
  return enumerateBoundPackageCandidatesWithNodeGrowthPruning(
    controller,
    preAdmission,
    NODE_GROWTH_CONTRACT,
    contextForBinding(controller.binding)
  );
}

export function verifyPackageDepthCandidatesWithNodeGrowthPruning(
  artifactInput,
  loadedPackageInput,
  runConfigInput,
  levelClosures,
  targetDepth,
  canonicalAuditInput,
  nodeFrontierAuditInput,
  options = {}
) {
  const supplied = cloneArtifact(
    artifactInput,
    "PACKAGE_DEPTH_NODE_GROWTH_PRUNING_ARTIFACT_INVALID",
    "A depth-aware node-growth pruning artifact is not canonicalizable."
  );
  return assertReproduced(
    supplied,
    enumeratePackageDepthCandidatesWithNodeGrowthPruning(
      loadedPackageInput,
      runConfigInput,
      levelClosures,
      targetDepth,
      canonicalAuditInput,
      nodeFrontierAuditInput,
      options
    ),
    "PACKAGE_DEPTH_NODE_GROWTH_PRUNING_ARTIFACT_MISMATCH",
    "A depth-aware node-growth pruning artifact differs from deterministic reproduction.",
    "generationHash"
  );
}
