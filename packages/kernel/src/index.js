/**
 * Public dependency-free boundary of the Onto2D kernel.
 *
 * The deterministic package, graph-identity, quantity/decimal, typed value and
 * Boolean analysis, predicate-plan, numeric-policy binding, and scientific
 * Oracle validation, source policy/annotation artifact foundations, finite
 * decorated-candidate enumeration, verified primitive depth populations,
 * normalized package/run binding, complete graph-predicate evaluation,
 * package-bound local numeric filtering, directed cycle-edge selection,
 * single-removal irreducibility, exact constituent novelty, exhaustive typed
 * stability evaluation,
 * complete local-filter censuses, package-bound finite functional evaluation,
 * complete cohort partitioning, complete selector ranking, coefficient
 * sensitivity execution, deterministic multi-selector admission, selected
 * formation materialization, residual-profile extraction with optional
 * formation-functional invariant derivation, derived population
 * materialization, verified arbitrary-depth level closure, and explicit
 * bounded ladder execution, profile-collapse and level-boundary diagnostics,
 * explicit carrier-promotion materialization, and bounded current-level
 * fixpoints, plus conservative partial-failure detection, deterministic
 * monotonicity audits, separate pruning authorization, and verified pre-
 * admission, edge-frontier and node-growth pruning with differential
 * conformance, exact incomplete-node frontier accounting, replay-resumable candidate traversal,
 * integrated level censuses, verified explanations, and semantic run artifact
 * bundles are executable. Complete-candidate profile-slot gating, per-model
 * null distributions and primitive/depth/current-round baseline integration,
 * and run-target ontology-coordinate materialization are also executable.
 * Formation-functional results also carry through derived Element invariants
 * into later-depth candidate attributes without same-candidate feedback.
 * Nested substructure invariant resolution is executable without recomputing
 * constituent values. Source-migration artifacts bind through the closed
 * package/run manifest, while their complete explanation replay remains in
 * the catalogue adapter. The schema-v1 kernel pending registry is empty.
 */

export {
  CANONICAL_JSON_POLICY,
  CANONICAL_LIMITS,
  canonicalBytes,
  canonicalClone,
  canonicalize,
  deepFreeze
} from "./canonical.js";
export {
  KernelError,
  KernelValidationError,
  validationIssue
} from "./errors.js";
export {
  DECIMAL_ARITHMETIC_VERSION,
  DECIMAL_LIMITS,
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
export {
  HASH_DOMAINS,
  assertContentHash,
  createCanonicalForm,
  hashArtifactBytes,
  hashBytes,
  hashCanonical,
  isContentHash
} from "./hash.js";
export {
  DEFAULT_VALUE_EXPRESSION_LIMITS,
  VALUE_EXPRESSION_ANALYZER_VERSION,
  analyzeValueExpression
} from "./expression-analyzer.js";
export {
  DEFAULT_PREDICATE_EXPRESSION_LIMITS,
  PREDICATE_EXPRESSION_ANALYZER_VERSION,
  PREDICATE_PLAN_COMPILER_VERSION,
  analyzePredicateExpression,
  compilePredicate
} from "./predicate-analyzer.js";
export {
  PREDICATE_NUMERIC_BINDING_LIMITS,
  PREDICATE_NUMERIC_BINDER_VERSION,
  bindPredicateNumericPolicy
} from "./numeric-binding.js";
export {
  GRAPH_PREDICATE_EVALUATOR_VERSION,
  PARTIAL_GRAPH_PREDICATE_EVALUATOR_VERSION,
  detectPartialGraphPredicateFailure,
  evaluateGraphPredicatePlan
} from "./graph-predicate-evaluator.js";
export {
  LOCAL_PREDICATE_EVALUATION_LIMITS,
  LOCAL_PREDICATE_EVALUATOR_VERSION,
  evaluateLocalPredicatePlan
} from "./local-predicate-evaluator.js";
export {
  ORACLE_PROTOCOL_VERSION,
  ORACLE_RESPONSE_VALIDATOR_VERSION,
  ORACLE_VALIDATION_LIMITS,
  createOracleRequestBinding,
  validateOracleResponse
} from "./oracle-validator.js";
export {
  SOURCE_CLASSIFICATION_VISIBLE_FIELDS,
  SOURCE_CLASSIFICATION_POLICY_VERSION,
  SOURCE_NODE_RESOLUTION_POLICY_VERSION,
  SOURCE_POLICY_LIMITS,
  freezeSourceClassificationPolicy,
  freezeSourceNodeResolutionPolicy
} from "./source-policy.js";
export {
  SOURCE_CLASSIFICATION_ADJUDICATION_VERSION,
  SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION,
  SOURCE_CLASSIFICATION_LIMITS,
  freezeSourceClassificationAdjudication,
  freezeSourceClassificationAnnotations
} from "./source-classification.js";
export {
  SOURCE_CLASSIFICATION_AMENDMENTS_VERSION,
  SOURCE_CLASSIFICATION_AMENDMENT_LIMITS,
  freezeSourceClassificationAmendments,
  verifySourceClassificationAmendments
} from "./source-classification-amendments.js";
export {
  DEFAULT_GRAPH_CANONICALIZATION_LIMITS,
  DEFAULT_GRAPH_POLICY,
  canonicalizeCandidate,
  canonicalizeSkeleton,
  normalizeGraphCanonicalizationOptions
} from "./graph-canonicalizer.js";
export {
  DEFAULT_SKELETON_ENUMERATION_LIMITS,
  enumerateConnectedSkeletons
} from "./skeleton-enumerator.js";
export {
  DEFAULT_CANDIDATE_STORE_LIMITS,
  createCandidateStore
} from "./candidate-store.js";
export {
  DECORATED_CANDIDATE_ENUMERATOR_VERSION,
  DEFAULT_CANDIDATE_ENUMERATION_LIMITS,
  enumerateDecoratedCandidates
} from "./candidate-enumerator.js";
export {
  RESUMABLE_CANDIDATE_ENUMERATION_LIMITS,
  RESUMABLE_CANDIDATE_ENUMERATION_POLICY,
  RESUMABLE_CANDIDATE_ENUMERATOR_VERSION,
  advanceDecoratedCandidateEnumeration,
  verifyDecoratedCandidateEnumerationStep
} from "./resumable-candidate-enumerator.js";
export {
  DEFAULT_PROFILE_COMPOSITION_POLICY,
  DEFAULT_RUN_BUDGET,
  RUN_CONFIG_NORMALIZER_VERSION,
  normalizeRunConfig
} from "./run-config.js";
export {
  PRIMITIVE_DEPTH_POPULATION_VERSION,
  materializePrimitiveDepthPopulation
} from "./primitive-depth-population.js";
export {
  DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS,
  PACKAGE_CANDIDATE_BINDER_VERSION,
  PACKAGE_CANDIDATE_GENERATOR_VERSION,
  createPackageCandidateBinding,
  enumeratePackageCandidates
} from "./package-candidate-generator.js";
export {
  PACKAGE_PROFILE_COMPOSITION_POLICY,
  PACKAGE_PROFILE_COMPOSITION_VERSION
} from "./package-profile-composition.js";
export {
  DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS,
  PACKAGE_PARTIAL_PRUNING_CONTROLLER_VERSION,
  PACKAGE_PREDICATE_MONOTONICITY_AUDITOR_VERSION,
  PACKAGE_PREDICATE_MONOTONICITY_AUDIT_POLICY,
  PACKAGE_PREDICATE_MONOTONICITY_AUDIT_SCOPE,
  auditPackagePredicateMonotonicity,
  authorizePackagePartialPruning,
  createPackagePartialPruningControllerSession,
  verifyPackagePredicateMonotonicityAudit
} from "./package-pruning-audit.js";
export {
  PACKAGE_GENERATOR_FRONTIER_AUDITOR_VERSION,
  PACKAGE_GENERATOR_FRONTIER_AUDIT_POLICY,
  PACKAGE_GENERATOR_FRONTIER_AUDIT_SCOPE,
  PACKAGE_GENERATOR_FRONTIER_CONTROLLER_VERSION,
  auditPackageGeneratorFrontiers,
  createPackageGeneratorFrontierControllerSession,
  verifyPackageGeneratorFrontierAudit
} from "./package-generator-frontier-audit.js";
export {
  PACKAGE_CANDIDATE_PRUNING_STRATEGY,
  PACKAGE_PRUNED_CANDIDATE_GENERATOR_VERSION,
  enumeratePackageCandidatesWithPruning,
  verifyPackageCandidatesWithPruning
} from "./package-pruned-candidate-generator.js";
export {
  PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_RECURSIVE_PRUNING_STRATEGY,
  enumeratePackageCandidatesWithRecursivePruning,
  verifyPackageCandidatesWithRecursivePruning
} from "./package-recursive-pruned-candidate-generator.js";
export {
  PACKAGE_NODE_FRONTIER_AUDITOR_VERSION,
  PACKAGE_NODE_FRONTIER_AUDIT_POLICY,
  PACKAGE_NODE_FRONTIER_AUDIT_SCOPE,
  PACKAGE_NODE_FRONTIER_CONTROLLER_VERSION,
  auditPackageNodeFrontiers,
  authorizePackageNodeFrontierPruning,
  createPackageNodeFrontierControllerSession,
  verifyPackageNodeFrontierAudit
} from "./package-node-frontier-audit.js";
export {
  PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_NODE_GROWTH_PRUNING_STRATEGY,
  enumeratePackageCandidatesWithNodeGrowthPruning,
  verifyPackageCandidatesWithNodeGrowthPruning
} from "./package-node-growth-pruned-candidate-generator.js";
export {
  PACKAGE_DEPTH_CANDIDATE_PRUNING_STRATEGY,
  PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDITOR_VERSION,
  PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SCOPE,
  PACKAGE_DEPTH_GENERATOR_FRONTIER_CONTROLLER_VERSION,
  PACKAGE_DEPTH_NODE_FRONTIER_AUDITOR_VERSION,
  PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SCOPE,
  PACKAGE_DEPTH_NODE_FRONTIER_CONTROLLER_VERSION,
  PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_DEPTH_NODE_GROWTH_PRUNING_STRATEGY,
  PACKAGE_DEPTH_PARTIAL_PRUNING_CONTROLLER_VERSION,
  PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDITOR_VERSION,
  PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDIT_SCOPE,
  PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_DEPTH_RECURSIVE_PRUNING_STRATEGY,
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
export {
  PACKAGE_LEVEL_CANDIDATE_EXPLAINER_VERSION,
  PACKAGE_LEVEL_EXPLANATION_INDEXER_VERSION,
  PACKAGE_LEVEL_EXPLANATION_INDEX_SCOPE,
  createPackageLevelExplanationIndex,
  explainPackageLevelCandidate,
  verifyPackageLevelExplanationIndex
} from "./package-level-explanation-index.js";
export {
  PACKAGE_LEVEL_RESULT_CENSUS_SCOPE,
  PACKAGE_LEVEL_RESULT_CENSUS_VERSION,
  createPackageLevelResultCensus,
  verifyPackageLevelResultCensus
} from "./package-level-result-census.js";
export {
  PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS,
  PACKAGE_RUN_ARTIFACT_BUNDLE_SCOPE,
  PACKAGE_RUN_ARTIFACT_BUNDLE_VERSION,
  PACKAGE_RUN_ARTIFACT_MATERIALIZER_VERSION,
  PACKAGE_RUN_ARTIFACT_STORE_SCOPE,
  PACKAGE_RUN_ARTIFACT_STORE_VERSION,
  PACKAGE_RUN_CANDIDATE_EXPLAINER_VERSION,
  PACKAGE_RUN_SEMANTIC_MANIFEST_VERSION,
  createPackageRunArtifactBundle,
  createPackageRunArtifactStore,
  createPackageRunArtifactStoreSession,
  explainPackageRunCandidate,
  materializePackageRunArtifact,
  verifyPackageRunArtifactBundle,
  verifyPackageRunArtifactStore
} from "./package-run-artifact-bundle.js";
export {
  PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION,
  evaluatePackageCandidateFilter
} from "./package-candidate-filter.js";
export {
  FUNCTIONAL_EXPRESSION_METHOD,
  PACKAGE_FUNCTIONAL_EVALUATOR_VERSION,
  evaluatePackageDepthFunctional,
  evaluatePackageFunctional
} from "./package-functional-evaluator.js";
export {
  PROFILE_INVARIANT_AGGREGATION_POLICY,
  PROFILE_INVARIANT_PROVENANCE_METHOD,
  PROFILE_INVARIANT_UNCERTAINTY_POLICY
} from "./profile-invariant-aggregation.js";
export {
  PACKAGE_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD,
  PACKAGE_CANDIDATE_CENSUS_EVALUATOR_VERSION,
  evaluatePackageCandidateCensus,
  verifyPackageCandidateCensus
} from "./package-candidate-census.js";
export {
  PACKAGE_NULL_MODEL_EXECUTION_REQUIREMENTS,
  PACKAGE_NULL_MODEL_PLAN_LIMITS,
  PACKAGE_NULL_MODEL_PLAN_VERSION,
  PACKAGE_NULL_MODEL_RANDOMNESS_POLICY,
  createPackageDepthNullModelPlan,
  createPackageNullModelPlan,
  verifyPackageDepthNullModelPlan,
  verifyPackageNullModelPlan
} from "./package-null-model-plan.js";
export {
  PACKAGE_NULL_MODEL_PROPOSAL_LIMITS,
  PACKAGE_NULL_MODEL_PROPOSAL_POLICY,
  PACKAGE_NULL_MODEL_PROPOSALS_VERSION,
  createPackageDepthNullModelProposals,
  createPackageNullModelProposals,
  verifyPackageDepthNullModelProposals,
  verifyPackageNullModelProposals
} from "./package-null-model-proposals.js";
export {
  PACKAGE_NULL_MODEL_TRIAL_CENSUS_SCOPE,
  PACKAGE_NULL_MODEL_TRIAL_CENSUSES_VERSION,
  evaluatePackageDepthNullModelTrialCensuses,
  evaluatePackageNullModelTrialCensuses,
  verifyPackageDepthNullModelTrialCensuses,
  verifyPackageNullModelTrialCensuses
} from "./package-null-model-trial-census.js";
export {
  PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_VERSION,
  PACKAGE_NULL_MODEL_TRIAL_SELECTION_POLICY,
  PACKAGE_NULL_MODEL_TRIAL_SELECTION_SCOPE,
  evaluatePackageDepthNullModelTrialSelections,
  evaluatePackageNullModelTrialSelections,
  verifyPackageDepthNullModelTrialSelections,
  verifyPackageNullModelTrialSelections
} from "./package-null-model-trial-selection.js";
export {
  PACKAGE_NULL_MODEL_BASELINE_SCOPE,
  PACKAGE_NULL_MODEL_BASELINE_VERSION,
  PACKAGE_NULL_MODEL_DISTRIBUTION_POLICY,
  evaluatePackageDepthNullModelBaseline,
  evaluatePackageNullModelBaseline,
  verifyPackageDepthNullModelBaseline,
  verifyPackageNullModelBaseline
} from "./package-null-model-baseline.js";
export {
  PACKAGE_COHORT_PARTITIONER_VERSION,
  PACKAGE_COHORT_PARTITION_SCOPE,
  PACKAGE_COHORT_PARTITION_LIMITS,
  constructPackageCohorts,
  verifyPackageCohortPartition
} from "./package-cohort-partitioner.js";
export {
  PACKAGE_SELECTOR_RANKER_VERSION,
  PACKAGE_SELECTOR_RANKING_SCOPE,
  PACKAGE_SELECTOR_RANKING_LIMITS,
  PACKAGE_SELECTOR_RANKING_POLICY,
  rankPackageSelector,
  verifyPackageSelectorRanking
} from "./package-selector-ranker.js";
export {
  PACKAGE_SELECTOR_ADMISSION_VERSION,
  PACKAGE_SELECTOR_ADMISSION_SCOPE,
  PACKAGE_SELECTOR_ADMISSION_POLICY,
  admitPackageSelectors,
  verifyPackageSelectorAdmission
} from "./package-selector-admission.js";
export {
  PACKAGE_SELECTED_FORMATIONS_VERSION,
  PACKAGE_SELECTED_FORMATIONS_SCOPE,
  PACKAGE_SELECTED_FORMATIONS_POLICY,
  materializePackageSelectedFormations,
  verifyPackageSelectedFormations
} from "./package-selected-formations.js";
export {
  PACKAGE_DERIVED_PROFILE_EXTRACTOR_VERSION,
  PACKAGE_DERIVED_PROFILE_SCOPE,
  PACKAGE_DERIVED_PROFILE_POLICY,
  extractPackageDerivedProfiles,
  verifyPackageDerivedProfiles
} from "./package-derived-profiles.js";
export {
  PACKAGE_DERIVED_DEPTH_POPULATION_VERSION,
  PACKAGE_DERIVED_ELEMENT_IDENTITY_POLICY,
  materializePackageDerivedDepthPopulation,
  verifyPackageDerivedDepthPopulation
} from "./package-derived-depth-population.js";
export {
  PACKAGE_LEVEL_CLOSURE_VERSION,
  PACKAGE_LEVEL_CLOSURE_SCOPE,
  closePackageLevel,
  verifyPackageLevelClosure
} from "./package-level-closure.js";
export {
  PACKAGE_DEPTH_SOURCE_SELECTOR_VERSION,
  PACKAGE_DEPTH_SOURCE_SELECTOR_SCOPE,
  PACKAGE_DEPTH_SOURCE_SELECTION_LIMITS,
  PACKAGE_DEPTH_SOURCE_SELECTION_POLICY,
  selectPackageDepthSourcePopulation,
  verifyPackageDepthSourcePopulation
} from "./package-depth-source-selection.js";
export {
  PACKAGE_DEPTH_CANDIDATE_BINDER_VERSION,
  PACKAGE_DEPTH_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_DEPTH_CANDIDATE_BINDING_POLICY,
  createPackageDepthCandidateBinding,
  enumeratePackageDepthCandidates
} from "./package-depth-candidate-generator.js";
export {
  PACKAGE_DEPTH_CANDIDATE_FILTER_EVALUATOR_VERSION,
  evaluatePackageDepthCandidateFilter
} from "./package-depth-candidate-filter.js";
export {
  PACKAGE_DEPTH_CANDIDATE_CENSUS_EVALUATOR_VERSION,
  PACKAGE_DEPTH_CANDIDATE_CENSUS_SCOPE,
  PACKAGE_DEPTH_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD,
  evaluatePackageDepthCandidateCensus,
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
export {
  constructPackageDepthCohorts,
  verifyPackageDepthCohortPartition
} from "./package-depth-cohort-partitioner.js";
export {
  rankPackageDepthSelector,
  verifyPackageDepthSelectorRanking
} from "./package-depth-selector-ranker.js";
export {
  evaluatePackageDepthSelectorSensitivity,
  verifyPackageDepthSelectorSensitivity
} from "./package-depth-selector-sensitivity.js";
export {
  admitPackageDepthSelectors,
  verifyPackageDepthSelectorAdmission
} from "./package-depth-selector-admission.js";
export {
  materializePackageDepthSelectedFormations,
  verifyPackageDepthSelectedFormations
} from "./package-depth-selected-formations.js";
export {
  extractPackageDepthDerivedProfiles,
  verifyPackageDepthDerivedProfiles
} from "./package-depth-derived-profiles.js";
export {
  materializePackageDepthDerivedPopulation,
  verifyPackageDepthDerivedPopulation
} from "./package-depth-derived-population.js";
export {
  PACKAGE_DEPTH_LEVEL_CLOSURE_SCOPE,
  PACKAGE_DEPTH_LEVEL_CLOSURE_VERSION,
  closePackageDepthLevel,
  verifyPackageDepthLevelClosure
} from "./package-depth-level-closure.js";
export {
  PACKAGE_LADDER_CLOSURE_LIMITS,
  PACKAGE_LADDER_CLOSURE_POLICY,
  PACKAGE_LADDER_CLOSURE_SCOPE,
  PACKAGE_LADDER_CLOSURE_VERSION,
  closePackageLadder,
  verifyPackageLadderClosure
} from "./package-ladder-closure.js";
export {
  PACKAGE_CURRENT_LEVEL_CANDIDATE_BINDER_VERSION,
  PACKAGE_CURRENT_LEVEL_CANDIDATE_FILTER_VERSION,
  PACKAGE_CURRENT_LEVEL_CANDIDATE_GENERATOR_VERSION,
  PACKAGE_CURRENT_LEVEL_CENSUS_VERSION,
  PACKAGE_CURRENT_LEVEL_CLOSURE_VERSION,
  PACKAGE_CURRENT_LEVEL_FIXPOINT_POLICY,
  PACKAGE_CURRENT_LEVEL_POPULATION_VERSION,
  PACKAGE_CURRENT_LEVEL_ROUND_VERSION,
  PACKAGE_CURRENT_LEVEL_SOURCE_SELECTOR_VERSION,
  PACKAGE_FIXPOINT_LADDER_CLOSURE_VERSION,
  PACKAGE_FIXPOINT_LADDER_POLICY,
  closePackageCurrentLevelFixpoint,
  verifyPackageCurrentLevelFixpoint
} from "./package-fixpoint-closure.js";
export {
  PACKAGE_LEVEL_BOUNDARY_DETECTOR_VERSION,
  PACKAGE_LEVEL_BOUNDARY_POLICY,
  PACKAGE_LEVEL_BOUNDARY_SCOPE,
  PACKAGE_PROFILE_COLLAPSE_POLICY,
  PACKAGE_PROFILE_COLLAPSE_SCOPE,
  PACKAGE_PROFILE_COLLAPSE_VERSION,
  detectPackageLevelBoundaries,
  testPackageProfileCollapse,
  verifyPackageLevelBoundaries,
  verifyPackageProfileCollapse
} from "./package-profile-collapse.js";
export {
  PACKAGE_CARRIER_PROMOTION_POLICY,
  PACKAGE_CARRIER_PROMOTION_SCOPE,
  PACKAGE_CARRIER_PROMOTION_VERSION,
  materializePackageCarrierPromotions,
  normalizePackageCarrierPromotionPolicy,
  verifyPackageCarrierPromotions
} from "./package-carrier-promotion.js";
export {
  PACKAGE_SELECTOR_SENSITIVITY_EVALUATOR_VERSION,
  PACKAGE_SELECTOR_SENSITIVITY_SCOPE,
  PACKAGE_SELECTOR_SENSITIVITY_LIMITS,
  PACKAGE_SELECTOR_SENSITIVITY_POLICY,
  evaluatePackageSelectorSensitivity,
  verifyPackageSelectorSensitivity
} from "./package-selector-sensitivity.js";
export {
  QUANTITY_COMPARISON_POLICY_VERSION,
  UNIT_GRAMMAR_VERSION,
  areUnitsCompatible,
  compareQuantities,
  convertQuantity,
  normalizeQuantity,
  normalizeUnitExpression,
  parseUnitExpression
} from "./quantity.js";
export { createKernel, KERNEL_CAPABILITIES } from "./kernel.js";
export { loadKernelPackage, PACKAGE_DEFAULTS } from "./package-loader.js";

export const KERNEL_IMPLEMENTATION_STATUS = "foundation-active/decorated-generation-active/profile-composition-gate-active/scalar-candidate-attributes-active/quantity-candidate-attributes-active/role-dependent-edge-candidate-attributes-active/formation-functional-attribute-carry-forward-active/formation-derived-types-active/predicate-plans-active/local-census-active/null-model-plan-active/null-model-proposals-active/null-model-local-trial-census-active/null-model-trial-selection-active/null-model-baseline-active/functional-evaluation-active/functional-attribute-sums-active/coefficient-role-closure-active/cohort-partition-active/selector-ranking-active/selector-sensitivity-active/selector-admission-active/selected-formations-active/derived-profiles-active/run-axis-active/generalized-level-closure-active/explicit-ladder-closure-active/profile-collapse-active/level-boundary-detection-active/carrier-promotion-active/bounded-fixpoint-active/current-level-null-model-active/resumable-generation-active/exhaustive-minimality-active/local-scalar-invariants-active/package-scalar-invariants-active/local-novel-active/local-stability-active/sampled-stability-active/nested-substructure-invariants-active/profile-invariant-aggregation-active/local-quantity-products-active/pruning-audit-controller-active/pruning-pre-admission-active/profile-gated-pre-admission-pruning-active/profile-gated-raw-frontier-pruning-active/recursive-pruning-active/node-growth-pruning-active/directed-strong-recursive-pruning-active/generalized-depth-recursive-pruning-active/level-explanation-index-active/integrated-level-result-census-active/artifact-bundle-index-active/source-amendments-active/source-migration-binding-active/schema-v1-implementation-closure-active";

export const SOURCE_RELATION_KINDS = Object.freeze([
  "generative",
  "constitutive",
  "intra-closure-support",
  "evidential",
  "descriptive",
  "regulatory-feedback"
]);

export const CLUSTER_DISPOSITIONS = Object.freeze([
  "distributed-structure",
  "constitutive-cluster",
  "unresolved-generative-cluster",
  "mixed-unresolved-cluster"
]);

export const MIGRATION_EXPOSURE_STATUSES = Object.freeze([
  "prospective-blind",
  "deterministic-precommitted",
  "historically-exposed"
]);

export const EVIDENCE_STATES = Object.freeze([
  "paper-assumption",
  "paper-derivation",
  "package-operationalization",
  "computationally-verified",
  "externally-supported",
  "falsified",
  "unresolved"
]);

export const PREDICATE_OUTCOMES = Object.freeze([
  "pass",
  "fail",
  "indeterminate"
]);

export const INTERNAL_ORDER = Object.freeze({
  DEFINED: "defined",
  UNDEFINED: "undefined"
});
