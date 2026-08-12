import { canonicalClone, canonicalize } from "./canonical.js";
import { enumerateDecoratedCandidates } from "./candidate-enumerator.js";
import {
  advanceDecoratedCandidateEnumeration,
  verifyDecoratedCandidateEnumerationStep
} from "./resumable-candidate-enumerator.js";
import { createCandidateStore } from "./candidate-store.js";
import {
  accumulateDecimals,
  addDecimals,
  decimalToNumber,
  divideDecimals,
  multiplyDecimals,
  normalizePrecisionPolicy,
  parseDecimal,
  roundDecimal,
  subtractDecimals,
  sumDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { canonicalizeCandidate, canonicalizeSkeleton } from "./graph-canonicalizer.js";
import {
  detectPartialGraphPredicateFailure,
  evaluateGraphPredicatePlan
} from "./graph-predicate-evaluator.js";
import { hashCanonical } from "./hash.js";
import { evaluateLocalPredicatePlan } from "./local-predicate-evaluator.js";
import { DEFAULT_KERNEL_VERSION, loadKernelPackage } from "./package-loader.js";
import {
  createPackageCandidateBinding,
  enumeratePackageCandidates
} from "./package-candidate-generator.js";
import {
  auditPackagePredicateMonotonicity,
  authorizePackagePartialPruning,
  createPackagePartialPruningControllerSession,
  verifyPackagePredicateMonotonicityAudit
} from "./package-pruning-audit.js";
import {
  enumeratePackageCandidatesWithPruning,
  verifyPackageCandidatesWithPruning
} from "./package-pruned-candidate-generator.js";
import {
  auditPackageGeneratorFrontiers,
  createPackageGeneratorFrontierControllerSession,
  verifyPackageGeneratorFrontierAudit
} from "./package-generator-frontier-audit.js";
import {
  enumeratePackageCandidatesWithRecursivePruning,
  verifyPackageCandidatesWithRecursivePruning
} from "./package-recursive-pruned-candidate-generator.js";
import {
  auditPackageNodeFrontiers,
  authorizePackageNodeFrontierPruning,
  createPackageNodeFrontierControllerSession,
  verifyPackageNodeFrontierAudit
} from "./package-node-frontier-audit.js";
import {
  enumeratePackageCandidatesWithNodeGrowthPruning,
  verifyPackageCandidatesWithNodeGrowthPruning
} from "./package-node-growth-pruned-candidate-generator.js";
import {
  auditPackageDepthGeneratorFrontiers,
  auditPackageDepthNodeFrontiers,
  auditPackageDepthPredicateMonotonicity,
  authorizePackageDepthGeneratorFrontierPruning,
  authorizePackageDepthNodeFrontierPruning,
  authorizePackageDepthPartialPruning,
  createPackageDepthGeneratorFrontierControllerSession,
  createPackageDepthNodeFrontierControllerSession,
  createPackageDepthPartialPruningControllerSession,
  enumeratePackageDepthCandidatesWithPruning,
  enumeratePackageDepthCandidatesWithNodeGrowthPruning,
  enumeratePackageDepthCandidatesWithRecursivePruning,
  verifyPackageDepthCandidatesWithPruning,
  verifyPackageDepthCandidatesWithNodeGrowthPruning,
  verifyPackageDepthCandidatesWithRecursivePruning,
  verifyPackageDepthGeneratorFrontierAudit,
  verifyPackageDepthNodeFrontierAudit,
  verifyPackageDepthPredicateMonotonicityAudit
} from "./package-depth-pruning.js";
import {
  createPackageLevelExplanationIndex,
  explainPackageLevelCandidate,
  verifyPackageLevelExplanationIndex
} from "./package-level-explanation-index.js";
import {
  createPackageLevelResultCensus,
  verifyPackageLevelResultCensus
} from "./package-level-result-census.js";
import {
  createPackageRunArtifactBundle,
  createPackageRunArtifactStore,
  createPackageRunArtifactStoreSession,
  explainPackageRunCandidate,
  materializePackageRunArtifact,
  verifyPackageRunArtifactBundle,
  verifyPackageRunArtifactStore
} from "./package-run-artifact-bundle.js";
import {
  evaluatePackageCandidateCensus,
  verifyPackageCandidateCensus
} from "./package-candidate-census.js";
import {
  createPackageDepthNullModelPlan,
  createPackageNullModelPlan,
  verifyPackageDepthNullModelPlan,
  verifyPackageNullModelPlan
} from "./package-null-model-plan.js";
import {
  createPackageDepthNullModelProposals,
  createPackageNullModelProposals,
  verifyPackageDepthNullModelProposals,
  verifyPackageNullModelProposals
} from "./package-null-model-proposals.js";
import {
  evaluatePackageDepthNullModelTrialCensuses,
  evaluatePackageNullModelTrialCensuses,
  verifyPackageDepthNullModelTrialCensuses,
  verifyPackageNullModelTrialCensuses
} from "./package-null-model-trial-census.js";
import {
  evaluatePackageDepthNullModelTrialSelections,
  evaluatePackageNullModelTrialSelections,
  verifyPackageDepthNullModelTrialSelections,
  verifyPackageNullModelTrialSelections
} from "./package-null-model-trial-selection.js";
import {
  evaluatePackageDepthNullModelBaseline,
  evaluatePackageNullModelBaseline,
  verifyPackageDepthNullModelBaseline,
  verifyPackageNullModelBaseline
} from "./package-null-model-baseline.js";
import { evaluatePackageCandidateFilter } from "./package-candidate-filter.js";
import {
  constructPackageCohorts,
  verifyPackageCohortPartition
} from "./package-cohort-partitioner.js";
import {
  evaluatePackageDepthFunctional,
  evaluatePackageFunctional
} from "./package-functional-evaluator.js";
import {
  rankPackageSelector,
  verifyPackageSelectorRanking
} from "./package-selector-ranker.js";
import {
  admitPackageSelectors,
  verifyPackageSelectorAdmission
} from "./package-selector-admission.js";
import {
  materializePackageSelectedFormations,
  verifyPackageSelectedFormations
} from "./package-selected-formations.js";
import {
  extractPackageDerivedProfiles,
  verifyPackageDerivedProfiles
} from "./package-derived-profiles.js";
import {
  materializePackageDerivedDepthPopulation,
  verifyPackageDerivedDepthPopulation
} from "./package-derived-depth-population.js";
import {
  closePackageLevel,
  verifyPackageLevelClosure
} from "./package-level-closure.js";
import {
  selectPackageDepthSourcePopulation,
  verifyPackageDepthSourcePopulation
} from "./package-depth-source-selection.js";
import {
  createPackageDepthCandidateBinding,
  enumeratePackageDepthCandidates
} from "./package-depth-candidate-generator.js";
import {
  evaluatePackageDepthCandidateFilter
} from "./package-depth-candidate-filter.js";
import {
  evaluatePackageDepthCandidateCensus,
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  constructPackageDepthCohorts,
  verifyPackageDepthCohortPartition
} from "./package-depth-cohort-partitioner.js";
import {
  rankPackageDepthSelector,
  verifyPackageDepthSelectorRanking
} from "./package-depth-selector-ranker.js";
import {
  evaluatePackageDepthSelectorSensitivity,
  verifyPackageDepthSelectorSensitivity
} from "./package-depth-selector-sensitivity.js";
import {
  admitPackageDepthSelectors,
  verifyPackageDepthSelectorAdmission
} from "./package-depth-selector-admission.js";
import {
  materializePackageDepthSelectedFormations,
  verifyPackageDepthSelectedFormations
} from "./package-depth-selected-formations.js";
import {
  extractPackageDepthDerivedProfiles,
  verifyPackageDepthDerivedProfiles
} from "./package-depth-derived-profiles.js";
import {
  materializePackageDepthDerivedPopulation,
  verifyPackageDepthDerivedPopulation
} from "./package-depth-derived-population.js";
import {
  closePackageDepthLevel,
  verifyPackageDepthLevelClosure
} from "./package-depth-level-closure.js";
import {
  closePackageLadder,
  verifyPackageLadderClosure
} from "./package-ladder-closure.js";
import {
  closePackageCurrentLevelFixpoint,
  verifyPackageCurrentLevelFixpoint
} from "./package-fixpoint-closure.js";
import {
  detectPackageLevelBoundaries,
  testPackageProfileCollapse,
  verifyPackageLevelBoundaries,
  verifyPackageProfileCollapse
} from "./package-profile-collapse.js";
import {
  materializePackageCarrierPromotions,
  verifyPackageCarrierPromotions
} from "./package-carrier-promotion.js";
import {
  evaluatePackageSelectorSensitivity,
  verifyPackageSelectorSensitivity
} from "./package-selector-sensitivity.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { createOracleRequestBinding, validateOracleResponse } from "./oracle-validator.js";
import { analyzePredicateExpression, compilePredicate } from "./predicate-analyzer.js";
import { materializePrimitiveDepthPopulation } from "./primitive-depth-population.js";
import {
  freezeSourceClassificationPolicy,
  freezeSourceNodeResolutionPolicy
} from "./source-policy.js";
import {
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAnnotations
} from "./source-classification.js";
import {
  freezeSourceClassificationAmendments,
  verifySourceClassificationAmendments
} from "./source-classification-amendments.js";
import {
  compareQuantities,
  convertQuantity,
  normalizeQuantity,
  normalizeUnitExpression,
  parseUnitExpression
} from "./quantity.js";
import { enumerateConnectedSkeletons } from "./skeleton-enumerator.js";
import { normalizeRunConfig } from "./run-config.js";

const IMPLEMENTED_CAPABILITIES = Object.freeze([
  "canonical-json",
  "domain-separated-sha256",
  "package-defaults",
  "package-normalization",
  "package-structural-validation",
  "package-scalar-invariant-values",
  "graph-isomorphism-canonicalization",
  "skeleton-content-addressing",
  "connected-skeleton-enumeration",
  "decorated-candidate-enumeration",
  "run-config-normalization",
  "primitive-depth-population-materialization",
  "package-candidate-binding",
  "package-candidate-enumeration",
  "package-predicate-monotonicity-audit",
  "package-predicate-monotonicity-audit-verification",
  "package-partial-pruning-authorization",
  "package-candidate-pre-admission-pruning",
  "profile-gated-pre-admission-pruning",
  "profile-gated-raw-frontier-pruning",
  "package-candidate-pruning-differential-conformance",
  "package-candidate-pruning-verification",
  "package-generator-frontier-audit",
  "package-generator-frontier-audit-verification",
  "package-generator-frontier-authorization",
  "package-recursive-candidate-pruning",
  "package-recursive-pruning-verification",
  "package-recursive-pruning-differential-conformance",
  "directed-strong-recursive-pruning",
  "package-node-frontier-audit",
  "package-node-frontier-audit-verification",
  "package-node-frontier-authorization",
  "package-node-growth-candidate-pruning",
  "package-node-growth-pruning-verification",
  "package-node-growth-pruning-differential-conformance",
  "node-growth-recursive-pruning",
  "package-depth-predicate-monotonicity-audit",
  "package-depth-predicate-monotonicity-audit-verification",
  "package-depth-partial-pruning-authorization",
  "package-depth-candidate-pre-admission-pruning",
  "package-depth-candidate-pruning-differential-conformance",
  "package-depth-candidate-pruning-verification",
  "package-depth-generator-frontier-audit",
  "package-depth-generator-frontier-audit-verification",
  "package-depth-generator-frontier-authorization",
  "package-depth-recursive-candidate-pruning",
  "package-depth-recursive-pruning-verification",
  "package-depth-recursive-pruning-differential-conformance",
  "generalized-depth-recursive-pruning",
  "package-depth-node-frontier-audit",
  "package-depth-node-frontier-audit-verification",
  "package-depth-node-frontier-authorization",
  "package-depth-node-growth-candidate-pruning",
  "package-depth-node-growth-pruning-verification",
  "package-depth-node-growth-pruning-differential-conformance",
  "generalized-depth-node-growth-recursive-pruning",
  "package-level-explanation-index",
  "package-level-explanation-index-verification",
  "package-level-candidate-explanation-query",
  "package-level-result-census",
  "package-level-result-census-verification",
  "integrated-level-result-census",
  "package-run-artifact-bundle",
  "package-run-artifact-bundle-verification",
  "package-run-artifact-materialization",
  "package-run-artifact-store",
  "package-run-artifact-store-verification",
  "package-run-candidate-explanation",
  "artifact-bundle-index",
  "package-candidate-filter-evaluation",
  "package-functional-evaluation",
  "package-functional-structural-attribute-sum",
  "package-cohort-partitioning",
  "package-cohort-partition-verification",
  "package-selector-ranking",
  "package-selector-ranking-verification",
  "package-selector-admission",
  "package-selector-admission-verification",
  "package-selected-formation-materialization",
  "package-selected-formation-verification",
  "package-derived-profile-extraction",
  "package-derived-profile-verification",
  "formation-functional-profile-invariant-derivation",
  "formation-dependent-type-classification",
  "profile-partner-guard-execution",
  "package-derived-depth-population-materialization",
  "package-derived-depth-population-verification",
  "package-level-closure",
  "package-level-closure-verification",
  "package-depth-source-population-selection",
  "package-depth-source-population-verification",
  "package-depth-candidate-binding",
  "package-depth-candidate-enumeration",
  "package-depth-candidate-filter-evaluation",
  "package-depth-candidate-local-filter-census",
  "package-depth-candidate-local-filter-census-verification",
  "package-depth-functional-evaluation",
  "package-depth-cohort-partitioning",
  "package-depth-cohort-partition-verification",
  "package-depth-selector-ranking",
  "package-depth-selector-ranking-verification",
  "package-depth-selector-sensitivity",
  "package-depth-selector-sensitivity-verification",
  "package-depth-selector-admission",
  "package-depth-selector-admission-verification",
  "package-depth-selected-formation-materialization",
  "package-depth-selected-formation-verification",
  "package-depth-derived-profile-extraction",
  "package-depth-derived-profile-verification",
  "package-depth-derived-population-materialization",
  "package-depth-derived-population-verification",
  "package-depth-level-closure",
  "package-depth-level-closure-verification",
  "package-ladder-closure",
  "package-ladder-closure-verification",
  "package-profile-collapse-testing",
  "package-profile-collapse-verification",
  "package-level-boundary-detection",
  "package-level-boundary-verification",
  "package-carrier-promotion-materialization",
  "package-carrier-promotion-verification",
  "bounded-current-level-fixpoint",
  "bounded-current-level-fixpoint-verification",
  "current-level-null-model-execution",
  "resumable-candidate-generation",
  "resumable-candidate-generation-verification",
  "package-selector-sensitivity",
  "package-selector-sensitivity-verification",
  "functional-coefficient-role-closure",
  "package-candidate-local-filter-census",
  "package-candidate-local-filter-census-verification",
  "package-null-model-planning",
  "package-null-model-plan-verification",
  "package-null-model-proposal-generation",
  "package-null-model-proposal-verification",
  "package-null-model-local-trial-census",
  "package-null-model-local-trial-census-verification",
  "package-null-model-trial-selection",
  "package-null-model-trial-selection-verification",
  "package-null-model-baseline",
  "package-null-model-baseline-verification",
  "integrated-package-null-model-execution",
  "integrated-package-depth-null-model-execution",
  "profile-guard-aware-generation",
  "run-target-ontology-coordinate-materialization",
  "package-scalar-candidate-attribute-derivation",
  "package-quantity-candidate-attribute-derivation",
  "package-role-dependent-edge-candidate-attribute-derivation",
  "formation-functional-candidate-attribute-carry-forward",
  "package-candidate-structural-attribute-derivation",
  "candidate-deduplication-store",
  "unit-grammar",
  "quantity-normalization",
  "tolerance-aware-comparison",
  "decimal-rational-arithmetic",
  "deterministic-decimal-rounding",
  "numeric-accumulation",
  "unrounded-numeric-accumulation",
  "typed-value-expression-analysis",
  "boolean-expression-analysis",
  "predicate-plan-compilation",
  "graph-predicate-evaluation",
  "local-exact-compare-predicate-evaluation",
  "local-exact-scalar-attribute-sum-evaluation",
  "local-compensated-scalar-attribute-sum-evaluation",
  "local-quantity-attribute-sum-evaluation",
  "local-derived-quantity-addition-evaluation",
  "local-derived-quantity-scaling-evaluation",
  "local-general-quantity-product-evaluation",
  "local-element-invariant-evaluation",
  "local-profile-invariant-consensus-evaluation",
  "local-profile-invariant-aggregation-evaluation",
  "local-scalar-invariant-evaluation",
  "local-balance-evaluation",
  "local-cycle-edge-selection",
  "local-irreducible-removal-evaluation",
  "local-novel-evaluation",
  "local-stable-under-evaluation",
  "local-sampled-stable-under-evaluation",
  "nested-substructure-invariant-resolution",
  "partial-graph-predicate-failure-detection",
  "predicate-numeric-policy-binding",
  "oracle-request-binding",
  "oracle-response-validation",
  "source-classification-policy-freeze",
  "source-classification-annotation-freeze",
  "source-classification-adjudication-freeze",
  "source-classification-amendment-freeze",
  "source-classification-amendment-verification",
  "source-node-resolution-policy-freeze",
  "source-migration-package-binding",
  "condensed-cluster-package-loading",
  "source-migration-run-artifact-binding",
  "depth-basis-hash",
  "rules-hash"
]);

const PENDING_CAPABILITIES = Object.freeze([]);

function withKernelVersion(options, version) {
  if (!options || typeof options !== "object" || Array.isArray(options)) return options;
  return { ...canonicalClone(options), kernelVersion: version };
}

export function createKernel(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Kernel options must be an object.");
  }
  const safeOptions = canonicalClone(options);
  if (Object.keys(safeOptions).some(
    (field) => !new Set(["version", "artifactStore"]).has(field)
  )) {
    throw new TypeError("Unknown kernel option.");
  }
  const version = safeOptions.version === undefined ? DEFAULT_KERNEL_VERSION : safeOptions.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new TypeError("Kernel version must be a non-empty string.");
  }
  const artifactStoreSession = safeOptions.artifactStore === undefined
    ? null
    : createPackageRunArtifactStoreSession(safeOptions.artifactStore, {
        expectedKernelVersion: version.trim()
      });

  return Object.freeze({
    version: version.trim(),
    capabilities: Object.freeze({
      implemented: IMPLEMENTED_CAPABILITIES,
      pending: PENDING_CAPABILITIES
    }),
    async loadPackage(input, options = {}) {
      const normalized = canonicalClone(options);
      if (
        !normalized ||
        typeof normalized !== "object" ||
        Array.isArray(normalized) ||
        Object.keys(normalized).some(
          (field) => field !== "allowCurrentDepthReferences"
        )
      ) {
        throw new TypeError("Unknown kernel package load option.");
      }
      return loadKernelPackage(input, {
        kernelVersion: version.trim(),
        ...(normalized.allowCurrentDepthReferences === undefined
          ? {}
          : {
              allowCurrentDepthReferences:
                normalized.allowCurrentDepthReferences
            })
      });
    },
    canonicalize,
    canonicalizeCandidate,
    canonicalizeSkeleton,
    createCandidateStore,
    enumerateConnectedSkeletons,
    enumerateDecoratedCandidates,
    advanceDecoratedCandidateEnumeration,
    verifyDecoratedCandidateEnumerationStep,
    normalizeRunConfig,
    materializePrimitiveDepthPopulation(loadedPackage, options = {}) {
      return materializePrimitiveDepthPopulation(
        loadedPackage,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageCandidateBinding(loadedPackage, runConfig, options = {}) {
      return createPackageCandidateBinding(
        loadedPackage,
        runConfig,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageCandidates(loadedPackage, runConfig, options = {}) {
      return enumeratePackageCandidates(
        loadedPackage,
        runConfig,
        withKernelVersion(options, version.trim())
      );
    },
    auditPackagePredicateMonotonicity(
      loadedPackage,
      runConfig,
      options = {}
    ) {
      return auditPackagePredicateMonotonicity(
        loadedPackage,
        runConfig,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackagePredicateMonotonicityAudit(
      audit,
      loadedPackage,
      runConfig,
      options = {}
    ) {
      return verifyPackagePredicateMonotonicityAudit(
        audit,
        loadedPackage,
        runConfig,
        withKernelVersion(options, version.trim())
      );
    },
    auditPackageGeneratorFrontiers(
      loadedPackage,
      runConfig,
      canonicalAudit,
      options = {}
    ) {
      return auditPackageGeneratorFrontiers(
        loadedPackage,
        runConfig,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageGeneratorFrontierAudit(
      frontierAudit,
      loadedPackage,
      runConfig,
      canonicalAudit,
      options = {}
    ) {
      return verifyPackageGeneratorFrontierAudit(
        frontierAudit,
        loadedPackage,
        runConfig,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageGeneratorFrontierControllerSession(
      loadedPackage,
      runConfig,
      canonicalAudit,
      frontierAudit,
      options = {}
    ) {
      return createPackageGeneratorFrontierControllerSession(
        loadedPackage,
        runConfig,
        canonicalAudit,
        frontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageCandidatesWithRecursivePruning(
      loadedPackage,
      runConfig,
      canonicalAudit,
      frontierAudit,
      options = {}
    ) {
      return enumeratePackageCandidatesWithRecursivePruning(
        loadedPackage,
        runConfig,
        canonicalAudit,
        frontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCandidatesWithRecursivePruning(
      artifact,
      loadedPackage,
      runConfig,
      canonicalAudit,
      frontierAudit,
      options = {}
    ) {
      return verifyPackageCandidatesWithRecursivePruning(
        artifact,
        loadedPackage,
        runConfig,
        canonicalAudit,
        frontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    auditPackageNodeFrontiers(
      loadedPackage,
      runConfig,
      canonicalAudit,
      options = {}
    ) {
      return auditPackageNodeFrontiers(
        loadedPackage,
        runConfig,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageNodeFrontierAudit(
      audit,
      loadedPackage,
      runConfig,
      canonicalAudit,
      options = {}
    ) {
      return verifyPackageNodeFrontierAudit(
        audit,
        loadedPackage,
        runConfig,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageNodeFrontierControllerSession(
      loadedPackage,
      runConfig,
      canonicalAudit,
      nodeFrontierAudit,
      options = {}
    ) {
      return createPackageNodeFrontierControllerSession(
        loadedPackage,
        runConfig,
        canonicalAudit,
        nodeFrontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    authorizePackageNodeFrontierPruning(
      loadedPackage,
      runConfig,
      canonicalAudit,
      nodeFrontierAudit,
      predicateId,
      frontier,
      options = {}
    ) {
      return authorizePackageNodeFrontierPruning(
        loadedPackage,
        runConfig,
        canonicalAudit,
        nodeFrontierAudit,
        predicateId,
        frontier,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageCandidatesWithNodeGrowthPruning(
      loadedPackage,
      runConfig,
      canonicalAudit,
      nodeFrontierAudit,
      options = {}
    ) {
      return enumeratePackageCandidatesWithNodeGrowthPruning(
        loadedPackage,
        runConfig,
        canonicalAudit,
        nodeFrontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCandidatesWithNodeGrowthPruning(
      artifact,
      loadedPackage,
      runConfig,
      canonicalAudit,
      nodeFrontierAudit,
      options = {}
    ) {
      return verifyPackageCandidatesWithNodeGrowthPruning(
        artifact,
        loadedPackage,
        runConfig,
        canonicalAudit,
        nodeFrontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    authorizePackagePartialPruning(
      loadedPackage,
      runConfig,
      audit,
      predicateId,
      partialGraph,
      options = {}
    ) {
      return authorizePackagePartialPruning(
        loadedPackage,
        runConfig,
        audit,
        predicateId,
        partialGraph,
        withKernelVersion(options, version.trim())
      );
    },
    createPackagePartialPruningControllerSession(
      loadedPackage,
      runConfig,
      audit,
      options = {}
    ) {
      return createPackagePartialPruningControllerSession(
        loadedPackage,
        runConfig,
        audit,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageCandidatesWithPruning(
      loadedPackage,
      runConfig,
      audit,
      options = {}
    ) {
      return enumeratePackageCandidatesWithPruning(
        loadedPackage,
        runConfig,
        audit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCandidatesWithPruning(
      artifact,
      loadedPackage,
      runConfig,
      audit,
      options = {}
    ) {
      return verifyPackageCandidatesWithPruning(
        artifact,
        loadedPackage,
        runConfig,
        audit,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageCandidateFilter(loadedPackage, binding, candidate, options = {}) {
      return evaluatePackageCandidateFilter(
        loadedPackage,
        binding,
        candidate,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageFunctional(
      loadedPackage,
      binding,
      filter,
      functionalId,
      options = {}
    ) {
      return evaluatePackageFunctional(
        loadedPackage,
        binding,
        filter,
        functionalId,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageCandidateCensus(loadedPackage, runConfig, options = {}) {
      return evaluatePackageCandidateCensus(
        loadedPackage,
        runConfig,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCandidateCensus(
      census,
      loadedPackage,
      runConfig,
      options = {}
    ) {
      return verifyPackageCandidateCensus(
        census,
        loadedPackage,
        runConfig,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageNullModelPlan(
      loadedPackage,
      runConfig,
      census,
      options = {}
    ) {
      return createPackageNullModelPlan(
        loadedPackage,
        runConfig,
        census,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageNullModelPlan(
      plan,
      loadedPackage,
      runConfig,
      census,
      options = {}
    ) {
      return verifyPackageNullModelPlan(
        plan,
        loadedPackage,
        runConfig,
        census,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageNullModelProposals(
      loadedPackage,
      runConfig,
      census,
      plan,
      options = {}
    ) {
      return createPackageNullModelProposals(
        loadedPackage,
        runConfig,
        census,
        plan,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageNullModelProposals(
      proposals,
      loadedPackage,
      runConfig,
      census,
      plan,
      options = {}
    ) {
      return verifyPackageNullModelProposals(
        proposals,
        loadedPackage,
        runConfig,
        census,
        plan,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageNullModelTrialCensuses(
      loadedPackage,
      runConfig,
      census,
      plan,
      proposals,
      options = {}
    ) {
      return evaluatePackageNullModelTrialCensuses(
        loadedPackage,
        runConfig,
        census,
        plan,
        proposals,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageNullModelTrialCensuses(
      trialCensuses,
      loadedPackage,
      runConfig,
      census,
      plan,
      proposals,
      options = {}
    ) {
      return verifyPackageNullModelTrialCensuses(
        trialCensuses,
        loadedPackage,
        runConfig,
        census,
        plan,
        proposals,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageNullModelTrialSelections(
      loadedPackage,
      runConfig,
      census,
      plan,
      proposals,
      trialCensuses,
      options = {}
    ) {
      return evaluatePackageNullModelTrialSelections(
        loadedPackage,
        runConfig,
        census,
        plan,
        proposals,
        trialCensuses,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageNullModelTrialSelections(
      trialSelections,
      loadedPackage,
      runConfig,
      census,
      plan,
      proposals,
      trialCensuses,
      options = {}
    ) {
      return verifyPackageNullModelTrialSelections(
        trialSelections,
        loadedPackage,
        runConfig,
        census,
        plan,
        proposals,
        trialCensuses,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageNullModelBaseline(
      loadedPackage,
      runConfig,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections,
      options = {}
    ) {
      return evaluatePackageNullModelBaseline(
        loadedPackage,
        runConfig,
        census,
        admission,
        plan,
        proposals,
        trialCensuses,
        trialSelections,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageNullModelBaseline(
      baseline,
      loadedPackage,
      runConfig,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections,
      options = {}
    ) {
      return verifyPackageNullModelBaseline(
        baseline,
        loadedPackage,
        runConfig,
        census,
        admission,
        plan,
        proposals,
        trialCensuses,
        trialSelections,
        withKernelVersion(options, version.trim())
      );
    },
    constructPackageCohorts(
      loadedPackage,
      runConfig,
      census,
      cohortRuleId,
      options = {}
    ) {
      return constructPackageCohorts(
        loadedPackage,
        runConfig,
        census,
        cohortRuleId,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCohortPartition(
      partition,
      loadedPackage,
      runConfig,
      census,
      options = {}
    ) {
      return verifyPackageCohortPartition(
        partition,
        loadedPackage,
        runConfig,
        census,
        withKernelVersion(options, version.trim())
      );
    },
    rankPackageSelector(
      loadedPackage,
      runConfig,
      census,
      partition,
      selectorId,
      options = {}
    ) {
      return rankPackageSelector(
        loadedPackage,
        runConfig,
        census,
        partition,
        selectorId,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageSelectorRanking(
      ranking,
      loadedPackage,
      runConfig,
      census,
      partition,
      options = {}
    ) {
      return verifyPackageSelectorRanking(
        ranking,
        loadedPackage,
        runConfig,
        census,
        partition,
        withKernelVersion(options, version.trim())
      );
    },
    admitPackageSelectors(
      loadedPackage,
      runConfig,
      census,
      selectorExecutions,
      options = {}
    ) {
      return admitPackageSelectors(
        loadedPackage,
        runConfig,
        census,
        selectorExecutions,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageSelectorAdmission(
      admission,
      loadedPackage,
      runConfig,
      census,
      selectorExecutions,
      options = {}
    ) {
      return verifyPackageSelectorAdmission(
        admission,
        loadedPackage,
        runConfig,
        census,
        selectorExecutions,
        withKernelVersion(options, version.trim())
      );
    },
    materializePackageSelectedFormations(
      loadedPackage,
      runConfig,
      census,
      admission,
      options = {}
    ) {
      return materializePackageSelectedFormations(
        loadedPackage,
        runConfig,
        census,
        admission,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageSelectedFormations(
      formations,
      loadedPackage,
      runConfig,
      census,
      admission,
      options = {}
    ) {
      return verifyPackageSelectedFormations(
        formations,
        loadedPackage,
        runConfig,
        census,
        admission,
        withKernelVersion(options, version.trim())
      );
    },
    extractPackageDerivedProfiles(
      loadedPackage,
      runConfig,
      census,
      admission,
      formations,
      options = {}
    ) {
      return extractPackageDerivedProfiles(
        loadedPackage,
        runConfig,
        census,
        admission,
        formations,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDerivedProfiles(
      profiles,
      loadedPackage,
      runConfig,
      census,
      admission,
      formations,
      options = {}
    ) {
      return verifyPackageDerivedProfiles(
        profiles,
        loadedPackage,
        runConfig,
        census,
        admission,
        formations,
        withKernelVersion(options, version.trim())
      );
    },
    materializePackageDerivedDepthPopulation(
      loadedPackage,
      runConfig,
      census,
      admission,
      formations,
      profiles,
      options = {}
    ) {
      return materializePackageDerivedDepthPopulation(
        loadedPackage,
        runConfig,
        census,
        admission,
        formations,
        profiles,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDerivedDepthPopulation(
      population,
      loadedPackage,
      runConfig,
      census,
      admission,
      formations,
      profiles,
      options = {}
    ) {
      return verifyPackageDerivedDepthPopulation(
        population,
        loadedPackage,
        runConfig,
        census,
        admission,
        formations,
        profiles,
        withKernelVersion(options, version.trim())
      );
    },
    closePackageLevel(loadedPackage, runConfig, options = {}) {
      const normalizedConfig = normalizeRunConfig(runConfig);
      return normalizedConfig.boundedFixpoint?.enabled === true
        ? closePackageCurrentLevelFixpoint(
            loadedPackage,
            normalizedConfig,
            [],
            1,
            withKernelVersion(options, version.trim())
          )
        : closePackageLevel(
            loadedPackage,
            normalizedConfig,
            withKernelVersion(options, version.trim())
          );
    },
    verifyPackageLevelClosure(
      level,
      loadedPackage,
      runConfig,
      options = {}
    ) {
      const normalizedConfig = normalizeRunConfig(runConfig);
      return normalizedConfig.boundedFixpoint?.enabled === true
        ? verifyPackageCurrentLevelFixpoint(
            level,
            loadedPackage,
            normalizedConfig,
            [],
            1,
            withKernelVersion(options, version.trim())
          )
        : verifyPackageLevelClosure(
            level,
            loadedPackage,
            normalizedConfig,
            withKernelVersion(options, version.trim())
          );
    },
    selectPackageDepthSourcePopulation(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return selectPackageDepthSourcePopulation(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthSourcePopulation(
      selection,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return verifyPackageDepthSourcePopulation(
        selection,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageDepthCandidateBinding(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return createPackageDepthCandidateBinding(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageDepthCandidates(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return enumeratePackageDepthCandidates(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    auditPackageDepthPredicateMonotonicity(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return auditPackageDepthPredicateMonotonicity(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthPredicateMonotonicityAudit(
      audit,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return verifyPackageDepthPredicateMonotonicityAudit(
        audit,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageDepthPartialPruningControllerSession(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      audit,
      options = {}
    ) {
      return createPackageDepthPartialPruningControllerSession(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        audit,
        withKernelVersion(options, version.trim())
      );
    },
    authorizePackageDepthPartialPruning(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      audit,
      predicateId,
      partialGraph,
      options = {}
    ) {
      return authorizePackageDepthPartialPruning(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        audit,
        predicateId,
        partialGraph,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageDepthCandidatesWithPruning(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      audit,
      options = {}
    ) {
      return enumeratePackageDepthCandidatesWithPruning(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        audit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthCandidatesWithPruning(
      artifact,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      audit,
      options = {}
    ) {
      return verifyPackageDepthCandidatesWithPruning(
        artifact,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        audit,
        withKernelVersion(options, version.trim())
      );
    },
    auditPackageDepthGeneratorFrontiers(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      options = {}
    ) {
      return auditPackageDepthGeneratorFrontiers(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthGeneratorFrontierAudit(
      frontierAudit,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      options = {}
    ) {
      return verifyPackageDepthGeneratorFrontierAudit(
        frontierAudit,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageDepthGeneratorFrontierControllerSession(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      frontierAudit,
      options = {}
    ) {
      return createPackageDepthGeneratorFrontierControllerSession(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        frontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    authorizePackageDepthGeneratorFrontierPruning(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      frontierAudit,
      predicateId,
      frontier,
      options = {}
    ) {
      return authorizePackageDepthGeneratorFrontierPruning(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        frontierAudit,
        predicateId,
        frontier,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageDepthCandidatesWithRecursivePruning(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      frontierAudit,
      options = {}
    ) {
      return enumeratePackageDepthCandidatesWithRecursivePruning(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        frontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthCandidatesWithRecursivePruning(
      artifact,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      frontierAudit,
      options = {}
    ) {
      return verifyPackageDepthCandidatesWithRecursivePruning(
        artifact,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        frontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    auditPackageDepthNodeFrontiers(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      options = {}
    ) {
      return auditPackageDepthNodeFrontiers(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthNodeFrontierAudit(
      nodeFrontierAudit,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      options = {}
    ) {
      return verifyPackageDepthNodeFrontierAudit(
        nodeFrontierAudit,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageDepthNodeFrontierControllerSession(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      nodeFrontierAudit,
      options = {}
    ) {
      return createPackageDepthNodeFrontierControllerSession(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        nodeFrontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    authorizePackageDepthNodeFrontierPruning(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      nodeFrontierAudit,
      predicateId,
      frontier,
      options = {}
    ) {
      return authorizePackageDepthNodeFrontierPruning(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        nodeFrontierAudit,
        predicateId,
        frontier,
        withKernelVersion(options, version.trim())
      );
    },
    enumeratePackageDepthCandidatesWithNodeGrowthPruning(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      nodeFrontierAudit,
      options = {}
    ) {
      return enumeratePackageDepthCandidatesWithNodeGrowthPruning(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        nodeFrontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthCandidatesWithNodeGrowthPruning(
      artifact,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      canonicalAudit,
      nodeFrontierAudit,
      options = {}
    ) {
      return verifyPackageDepthCandidatesWithNodeGrowthPruning(
        artifact,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        canonicalAudit,
        nodeFrontierAudit,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthCandidateFilter(
      loadedPackage,
      binding,
      levelClosures,
      candidate,
      options = {}
    ) {
      return evaluatePackageDepthCandidateFilter(
        loadedPackage,
        binding,
        levelClosures,
        candidate,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthCandidateCensus(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return evaluatePackageDepthCandidateCensus(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthCandidateCensus(
      census,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return verifyPackageDepthCandidateCensus(
        census,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageDepthNullModelPlan(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      options = {}
    ) {
      return createPackageDepthNullModelPlan(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthNullModelPlan(
      plan,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      options = {}
    ) {
      return verifyPackageDepthNullModelPlan(
        plan,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageDepthNullModelProposals(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      plan,
      options = {}
    ) {
      return createPackageDepthNullModelProposals(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        plan,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthNullModelProposals(
      proposals,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      plan,
      options = {}
    ) {
      return verifyPackageDepthNullModelProposals(
        proposals,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        plan,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthNullModelTrialCensuses(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      plan,
      proposals,
      options = {}
    ) {
      return evaluatePackageDepthNullModelTrialCensuses(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        plan,
        proposals,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthNullModelTrialCensuses(
      trialCensuses,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      plan,
      proposals,
      options = {}
    ) {
      return verifyPackageDepthNullModelTrialCensuses(
        trialCensuses,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        plan,
        proposals,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthNullModelTrialSelections(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      plan,
      proposals,
      trialCensuses,
      options = {}
    ) {
      return evaluatePackageDepthNullModelTrialSelections(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        plan,
        proposals,
        trialCensuses,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthNullModelTrialSelections(
      trialSelections,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      plan,
      proposals,
      trialCensuses,
      options = {}
    ) {
      return verifyPackageDepthNullModelTrialSelections(
        trialSelections,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        plan,
        proposals,
        trialCensuses,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthNullModelBaseline(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections,
      options = {}
    ) {
      return evaluatePackageDepthNullModelBaseline(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        plan,
        proposals,
        trialCensuses,
        trialSelections,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthNullModelBaseline(
      baseline,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      plan,
      proposals,
      trialCensuses,
      trialSelections,
      options = {}
    ) {
      return verifyPackageDepthNullModelBaseline(
        baseline,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        plan,
        proposals,
        trialCensuses,
        trialSelections,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthFunctional(
      loadedPackage,
      binding,
      levelClosures,
      filter,
      functionalId,
      options = {}
    ) {
      return evaluatePackageDepthFunctional(
        loadedPackage,
        binding,
        levelClosures,
        filter,
        functionalId,
        withKernelVersion(options, version.trim())
      );
    },
    constructPackageDepthCohorts(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      cohortRuleId,
      options = {}
    ) {
      return constructPackageDepthCohorts(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        cohortRuleId,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthCohortPartition(
      partition,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      options = {}
    ) {
      return verifyPackageDepthCohortPartition(
        partition,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        withKernelVersion(options, version.trim())
      );
    },
    rankPackageDepthSelector(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      partition,
      selectorId,
      options = {}
    ) {
      return rankPackageDepthSelector(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        partition,
        selectorId,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthSelectorRanking(
      ranking,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      partition,
      options = {}
    ) {
      return verifyPackageDepthSelectorRanking(
        ranking,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        partition,
        withKernelVersion(options, version.trim())
      );
    },
    evaluatePackageDepthSelectorSensitivity(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      partition,
      ranking,
      options = {}
    ) {
      return evaluatePackageDepthSelectorSensitivity(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        partition,
        ranking,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthSelectorSensitivity(
      sensitivity,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      partition,
      ranking,
      options = {}
    ) {
      return verifyPackageDepthSelectorSensitivity(
        sensitivity,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        partition,
        ranking,
        withKernelVersion(options, version.trim())
      );
    },
    admitPackageDepthSelectors(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      selectorExecutions,
      options = {}
    ) {
      return admitPackageDepthSelectors(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        selectorExecutions,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthSelectorAdmission(
      admission,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      selectorExecutions,
      options = {}
    ) {
      return verifyPackageDepthSelectorAdmission(
        admission,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        selectorExecutions,
        withKernelVersion(options, version.trim())
      );
    },
    materializePackageDepthSelectedFormations(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      options = {}
    ) {
      return materializePackageDepthSelectedFormations(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthSelectedFormations(
      formations,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      options = {}
    ) {
      return verifyPackageDepthSelectedFormations(
        formations,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        withKernelVersion(options, version.trim())
      );
    },
    extractPackageDepthDerivedProfiles(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      formations,
      options = {}
    ) {
      return extractPackageDepthDerivedProfiles(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        formations,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthDerivedProfiles(
      profiles,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      formations,
      options = {}
    ) {
      return verifyPackageDepthDerivedProfiles(
        profiles,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        formations,
        withKernelVersion(options, version.trim())
      );
    },
    materializePackageDepthDerivedPopulation(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      formations,
      profiles,
      options = {}
    ) {
      return materializePackageDepthDerivedPopulation(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        formations,
        profiles,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthDerivedPopulation(
      population,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      census,
      admission,
      formations,
      profiles,
      options = {}
    ) {
      return verifyPackageDepthDerivedPopulation(
        population,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        census,
        admission,
        formations,
        profiles,
        withKernelVersion(options, version.trim())
      );
    },
    closePackageDepthLevel(
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return closePackageDepthLevel(
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageDepthLevelClosure(
      level,
      loadedPackage,
      runConfig,
      levelClosures,
      targetDepth,
      options = {}
    ) {
      return verifyPackageDepthLevelClosure(
        level,
        loadedPackage,
        runConfig,
        levelClosures,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageLevelExplanationIndex(
      loadedPackage,
      runConfig,
      level,
      priorLevels = [],
      options = {}
    ) {
      return createPackageLevelExplanationIndex(
        loadedPackage,
        runConfig,
        level,
        priorLevels,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageLevelExplanationIndex(
      index,
      loadedPackage,
      runConfig,
      level,
      priorLevels = [],
      options = {}
    ) {
      return verifyPackageLevelExplanationIndex(
        index,
        loadedPackage,
        runConfig,
        level,
        priorLevels,
        withKernelVersion(options, version.trim())
      );
    },
    explainPackageLevelCandidate(index, candidateId) {
      return explainPackageLevelCandidate(index, candidateId);
    },
    createPackageLevelResultCensus(
      loadedPackage,
      runConfig,
      level,
      priorLevels = [],
      options = {}
    ) {
      return createPackageLevelResultCensus(
        loadedPackage,
        runConfig,
        level,
        priorLevels,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageLevelResultCensus(
      census,
      loadedPackage,
      runConfig,
      level,
      priorLevels = [],
      options = {}
    ) {
      return verifyPackageLevelResultCensus(
        census,
        loadedPackage,
        runConfig,
        level,
        priorLevels,
        withKernelVersion(options, version.trim())
      );
    },
    createPackageRunArtifactBundle(
      loadedPackage,
      runConfig,
      levels,
      options = {}
    ) {
      return createPackageRunArtifactBundle(
        loadedPackage,
        runConfig,
        levels,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageRunArtifactBundle(bundle) {
      return verifyPackageRunArtifactBundle(bundle, {
        expectedKernelVersion: version.trim()
      });
    },
    materializePackageRunArtifact(bundle, path) {
      return materializePackageRunArtifact(bundle, path, {
        expectedKernelVersion: version.trim()
      });
    },
    createPackageRunArtifactStore(bundles) {
      return createPackageRunArtifactStore(bundles, {
        expectedKernelVersion: version.trim()
      });
    },
    verifyPackageRunArtifactStore(store) {
      return verifyPackageRunArtifactStore(store, {
        expectedKernelVersion: version.trim()
      });
    },
    explainPackageRunCandidate(store, runHash, candidateId) {
      return explainPackageRunCandidate(store, runHash, candidateId, {
        expectedKernelVersion: version.trim()
      });
    },
    evaluatePackageSelectorSensitivity(
      loadedPackage,
      runConfig,
      census,
      partition,
      ranking,
      options = {}
    ) {
      return evaluatePackageSelectorSensitivity(
        loadedPackage,
        runConfig,
        census,
        partition,
        ranking,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageSelectorSensitivity(
      sensitivity,
      loadedPackage,
      runConfig,
      census,
      partition,
      ranking,
      options = {}
    ) {
      return verifyPackageSelectorSensitivity(
        sensitivity,
        loadedPackage,
        runConfig,
        census,
        partition,
        ranking,
        withKernelVersion(options, version.trim())
      );
    },
    parseUnitExpression,
    normalizeUnitExpression,
    normalizeQuantity,
    convertQuantity,
    compareQuantities,
    parseDecimal,
    normalizePrecisionPolicy,
    accumulateDecimals,
    addDecimals,
    subtractDecimals,
    multiplyDecimals,
    divideDecimals,
    roundDecimal,
    sumDecimals,
    decimalToNumber,
    analyzeValueExpression,
    analyzePredicateExpression,
    compilePredicate,
    evaluateGraphPredicatePlan,
    evaluateLocalPredicatePlan,
    detectPartialGraphPredicateFailure,
    bindPredicateNumericPolicy,
    createOracleRequestBinding,
    validateOracleResponse,
    freezeSourceClassificationPolicy,
    freezeSourceClassificationAnnotations,
    freezeSourceClassificationAdjudication,
    freezeSourceClassificationAmendments,
    verifySourceClassificationAmendments,
    freezeSourceNodeResolutionPolicy,
    hash(domain, value) {
      return hashCanonical(domain, value);
    },
    closeLevel(input) {
      const normalized = canonicalClone(input);
      if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
        throw new TypeError("closeLevel input must be an object.");
      }
      const unknown = Object.keys(normalized).filter(
        (field) => !new Set(["package", "config", "options"]).has(field)
      );
      if (unknown.length > 0) throw new TypeError("Unknown closeLevel input field.");
      if (!Object.hasOwn(normalized, "package") || !Object.hasOwn(normalized, "config")) {
        throw new TypeError("closeLevel requires package and config.");
      }
      const normalizedConfig = normalizeRunConfig(normalized.config);
      return normalizedConfig.boundedFixpoint?.enabled === true
        ? closePackageCurrentLevelFixpoint(
            normalized.package,
            normalizedConfig,
            [],
            1,
            withKernelVersion(normalized.options ?? {}, version.trim())
          )
        : closePackageLevel(
            normalized.package,
            normalizedConfig,
            withKernelVersion(normalized.options ?? {}, version.trim())
          );
    },
    closePackageCurrentLevelFixpoint(
      loadedPackage,
      runConfig,
      priorLevels = [],
      targetDepth = 1,
      options = {}
    ) {
      return closePackageCurrentLevelFixpoint(
        loadedPackage,
        runConfig,
        priorLevels,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCurrentLevelFixpoint(
      level,
      loadedPackage,
      runConfig,
      priorLevels = [],
      targetDepth = 1,
      options = {}
    ) {
      return verifyPackageCurrentLevelFixpoint(
        level,
        loadedPackage,
        runConfig,
        priorLevels,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    closePackageLadder(
      loadedPackage,
      runConfig,
      depths,
      options = {}
    ) {
      return closePackageLadder(
        loadedPackage,
        runConfig,
        depths,
        withKernelVersion(options, version.trim())
      );
    },
    closeLadder(input) {
      const normalized = canonicalClone(input);
      if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
        throw new TypeError("closeLadder input must be an object.");
      }
      const allowed = new Set(["package", "config", "depths", "options"]);
      const unknown = Object.keys(normalized).filter(
        (field) => !allowed.has(field)
      );
      if (unknown.length > 0) throw new TypeError("Unknown closeLadder input field.");
      for (const field of ["package", "config", "depths"]) {
        if (!Object.hasOwn(normalized, field)) {
          throw new TypeError(`closeLadder requires ${field}.`);
        }
      }
      return closePackageLadder(
        normalized.package,
        normalized.config,
        normalized.depths,
        withKernelVersion(normalized.options ?? {}, version.trim())
      );
    },
    verifyPackageLadderClosure(
      ladder,
      loadedPackage,
      runConfig,
      depths,
      options = {}
    ) {
      return verifyPackageLadderClosure(
        ladder,
        loadedPackage,
        runConfig,
        depths,
        withKernelVersion(options, version.trim())
      );
    },
    testPackageProfileCollapse(
      loadedPackage,
      runConfig,
      targetDepth,
      options = {}
    ) {
      return testPackageProfileCollapse(
        loadedPackage,
        runConfig,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageProfileCollapse(
      report,
      loadedPackage,
      runConfig,
      targetDepth,
      options = {}
    ) {
      return verifyPackageProfileCollapse(
        report,
        loadedPackage,
        runConfig,
        targetDepth,
        withKernelVersion(options, version.trim())
      );
    },
    testProfileCollapse(input) {
      const normalized = canonicalClone(input);
      if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
        throw new TypeError("testProfileCollapse input must be an object.");
      }
      const allowed = new Set(["package", "config", "targetDepth", "options"]);
      const unknown = Object.keys(normalized).filter((field) => !allowed.has(field));
      if (unknown.length > 0) {
        throw new TypeError("Unknown testProfileCollapse input field.");
      }
      for (const field of ["package", "config", "targetDepth"]) {
        if (!Object.hasOwn(normalized, field)) {
          throw new TypeError(`testProfileCollapse requires ${field}.`);
        }
      }
      return testPackageProfileCollapse(
        normalized.package,
        normalized.config,
        normalized.targetDepth,
        withKernelVersion(normalized.options ?? {}, version.trim())
      );
    },
    detectPackageLevelBoundaries(
      loadedPackage,
      runConfig,
      depths,
      options = {}
    ) {
      return detectPackageLevelBoundaries(
        loadedPackage,
        runConfig,
        depths,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageLevelBoundaries(
      report,
      loadedPackage,
      runConfig,
      depths,
      options = {}
    ) {
      return verifyPackageLevelBoundaries(
        report,
        loadedPackage,
        runConfig,
        depths,
        withKernelVersion(options, version.trim())
      );
    },
    detectLevelBoundaries(input) {
      const normalized = canonicalClone(input);
      if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
        throw new TypeError("detectLevelBoundaries input must be an object.");
      }
      const allowed = new Set(["package", "config", "depths", "options"]);
      const unknown = Object.keys(normalized).filter((field) => !allowed.has(field));
      if (unknown.length > 0) {
        throw new TypeError("Unknown detectLevelBoundaries input field.");
      }
      for (const field of ["package", "config", "depths"]) {
        if (!Object.hasOwn(normalized, field)) {
          throw new TypeError(`detectLevelBoundaries requires ${field}.`);
        }
      }
      return detectPackageLevelBoundaries(
        normalized.package,
        normalized.config,
        normalized.depths,
        withKernelVersion(normalized.options ?? {}, version.trim())
      );
    },
    materializePackageCarrierPromotions(
      loadedPackage,
      runConfig,
      ladder,
      collapse,
      requestedDepths,
      policy,
      options = {}
    ) {
      return materializePackageCarrierPromotions(
        loadedPackage,
        runConfig,
        ladder,
        collapse,
        requestedDepths,
        policy,
        withKernelVersion(options, version.trim())
      );
    },
    verifyPackageCarrierPromotions(
      promotions,
      loadedPackage,
      runConfig,
      ladder,
      collapse,
      requestedDepths,
      policy,
      options = {}
    ) {
      return verifyPackageCarrierPromotions(
        promotions,
        loadedPackage,
        runConfig,
        ladder,
        collapse,
        requestedDepths,
        policy,
        withKernelVersion(options, version.trim())
      );
    },
    promoteCarriers(input) {
      const normalized = canonicalClone(input);
      if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
        throw new TypeError("promoteCarriers input must be an object.");
      }
      const allowed = new Set([
        "package",
        "config",
        "ladder",
        "collapse",
        "depths",
        "policy",
        "options"
      ]);
      const unknown = Object.keys(normalized).filter((field) => !allowed.has(field));
      if (unknown.length > 0) {
        throw new TypeError("Unknown promoteCarriers input field.");
      }
      for (const field of [
        "package",
        "config",
        "ladder",
        "collapse",
        "depths",
        "policy"
      ]) {
        if (!Object.hasOwn(normalized, field)) {
          throw new TypeError(`promoteCarriers requires ${field}.`);
        }
      }
      return materializePackageCarrierPromotions(
        normalized.package,
        normalized.config,
        normalized.ladder,
        normalized.collapse,
        normalized.depths,
        normalized.policy,
        withKernelVersion(normalized.options ?? {}, version.trim())
      );
    },
    async explain(input) {
      if (artifactStoreSession === null) {
        throw new KernelError({
          code: "KERNEL_ARTIFACT_STORE_UNBOUND",
          stage: "EXPLAIN",
          message: "Kernel candidate explanation requires a verified artifactStore binding."
        });
      }
      const normalized = canonicalClone(input);
      if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
        throw new TypeError("explain input must be an object.");
      }
      const unknown = Object.keys(normalized).filter(
        (field) => !new Set(["runHash", "candidateId"]).has(field)
      );
      if (unknown.length > 0) throw new TypeError("Unknown explain input field.");
      if (!Object.hasOwn(normalized, "runHash") || !Object.hasOwn(normalized, "candidateId")) {
        throw new TypeError("explain requires runHash and candidateId.");
      }
      return artifactStoreSession.explain(
        normalized.runHash,
        normalized.candidateId
      );
    }
  });
}

export const KERNEL_CAPABILITIES = Object.freeze({
  implemented: IMPLEMENTED_CAPABILITIES,
  pending: PENDING_CAPABILITIES
});
