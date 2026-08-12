import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUSTER_DISPOSITIONS,
  INTERNAL_ORDER,
  KERNEL_CAPABILITIES,
  KERNEL_IMPLEMENTATION_STATUS,
  MIGRATION_EXPOSURE_STATUSES,
  SOURCE_RELATION_KINDS,
  createKernel
} from "../src/index.js";

test("kernel publishes the complete source-relation vocabulary", () => {
  assert.equal(
    KERNEL_IMPLEMENTATION_STATUS,
    "foundation-active/decorated-generation-active/profile-composition-gate-active/scalar-candidate-attributes-active/quantity-candidate-attributes-active/role-dependent-edge-candidate-attributes-active/formation-functional-attribute-carry-forward-active/formation-derived-types-active/predicate-plans-active/local-census-active/null-model-plan-active/null-model-proposals-active/null-model-local-trial-census-active/null-model-trial-selection-active/null-model-baseline-active/functional-evaluation-active/functional-attribute-sums-active/coefficient-role-closure-active/cohort-partition-active/selector-ranking-active/selector-sensitivity-active/selector-admission-active/selected-formations-active/derived-profiles-active/run-axis-active/generalized-level-closure-active/explicit-ladder-closure-active/profile-collapse-active/level-boundary-detection-active/carrier-promotion-active/bounded-fixpoint-active/current-level-null-model-active/resumable-generation-active/exhaustive-minimality-active/local-scalar-invariants-active/package-scalar-invariants-active/local-novel-active/local-stability-active/sampled-stability-active/nested-substructure-invariants-active/profile-invariant-aggregation-active/local-quantity-products-active/pruning-audit-controller-active/pruning-pre-admission-active/profile-gated-pre-admission-pruning-active/profile-gated-raw-frontier-pruning-active/recursive-pruning-active/node-growth-pruning-active/directed-strong-recursive-pruning-active/generalized-depth-recursive-pruning-active/level-explanation-index-active/integrated-level-result-census-active/artifact-bundle-index-active/source-amendments-active/source-migration-binding-active/schema-v1-implementation-closure-active"
  );
  assert.deepEqual(SOURCE_RELATION_KINDS, [
    "generative",
    "constitutive",
    "intra-closure-support",
    "evidential",
    "descriptive",
    "regulatory-feedback"
  ]);
  assert.equal(INTERNAL_ORDER.UNDEFINED, "undefined");
  assert.ok(CLUSTER_DISPOSITIONS.includes("constitutive-cluster"));
  assert.ok(MIGRATION_EXPOSURE_STATUSES.includes("historically-exposed"));
  assert.ok(Object.isFrozen(SOURCE_RELATION_KINDS));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("graph-isomorphism-canonicalization"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("connected-skeleton-enumeration"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("decorated-candidate-enumeration"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("run-config-normalization"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("primitive-depth-population-materialization"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-candidate-binding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-candidate-enumeration"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-predicate-monotonicity-audit"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-predicate-monotonicity-audit-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-partial-pruning-authorization"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-candidate-pre-admission-pruning"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "profile-gated-pre-admission-pruning"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "profile-gated-raw-frontier-pruning"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-candidate-pruning-differential-conformance"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-candidate-pruning-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-generator-frontier-audit"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-generator-frontier-audit-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-generator-frontier-authorization"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-recursive-candidate-pruning"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-recursive-pruning-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-recursive-pruning-differential-conformance"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "directed-strong-recursive-pruning"
  ));
  for (const capability of [
    "package-node-frontier-audit",
    "package-node-frontier-audit-verification",
    "package-node-frontier-authorization",
    "package-node-growth-candidate-pruning",
    "package-node-growth-pruning-verification",
    "package-node-growth-pruning-differential-conformance",
    "node-growth-recursive-pruning"
  ]) {
    assert.ok(KERNEL_CAPABILITIES.implemented.includes(capability));
    assert.ok(!KERNEL_CAPABILITIES.pending.includes(capability));
  }
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-predicate-monotonicity-audit"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-predicate-monotonicity-audit-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-partial-pruning-authorization"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-candidate-pre-admission-pruning"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-candidate-pruning-differential-conformance"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-candidate-pruning-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-generator-frontier-audit"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-generator-frontier-audit-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-generator-frontier-authorization"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-recursive-candidate-pruning"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-recursive-pruning-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-recursive-pruning-differential-conformance"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "generalized-depth-recursive-pruning"
  ));
  for (const capability of [
    "package-depth-node-frontier-audit",
    "package-depth-node-frontier-audit-verification",
    "package-depth-node-frontier-authorization",
    "package-depth-node-growth-candidate-pruning",
    "package-depth-node-growth-pruning-verification",
    "package-depth-node-growth-pruning-differential-conformance",
    "generalized-depth-node-growth-recursive-pruning"
  ]) {
    assert.ok(KERNEL_CAPABILITIES.implemented.includes(capability));
  }
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-explanation-index"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-explanation-index-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-candidate-explanation-query"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-scalar-invariant-values"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-stable-under-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "local-sampled-stable-under-evaluation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-candidate-filter-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-functional-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-functional-structural-attribute-sum"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-cohort-partitioning"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-cohort-partition-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-selector-ranking"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-selector-ranking-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-selector-admission"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-selector-admission-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-closure"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-closure-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-source-population-selection"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-candidate-binding"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-candidate-filter-evaluation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-depth-candidate-local-filter-census"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-selector-sensitivity"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-selector-sensitivity-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-candidate-local-filter-census"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-candidate-local-filter-census-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("candidate-deduplication-store"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("unit-grammar"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("quantity-normalization"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("tolerance-aware-comparison"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("decimal-rational-arithmetic"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("deterministic-decimal-rounding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("numeric-accumulation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("unrounded-numeric-accumulation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("typed-value-expression-analysis"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("boolean-expression-analysis"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("predicate-plan-compilation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("graph-predicate-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-exact-compare-predicate-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-exact-scalar-attribute-sum-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-compensated-scalar-attribute-sum-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-quantity-attribute-sum-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-derived-quantity-addition-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-derived-quantity-scaling-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "local-general-quantity-product-evaluation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-element-invariant-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-profile-invariant-consensus-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "local-profile-invariant-aggregation-evaluation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-scalar-invariant-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-balance-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-cycle-edge-selection"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-irreducible-removal-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("local-novel-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("partial-graph-predicate-failure-detection"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("predicate-numeric-policy-binding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("oracle-request-binding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("oracle-response-validation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-policy-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-annotation-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-adjudication-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-amendment-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-node-resolution-policy-freeze"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("graph-canonicalization"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("deterministic-decimal-arithmetic"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("typed-expression-analysis"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("boolean-expression-analysis"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("oracle-response-validation"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("source-classification"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("source-node-resolution"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("source-condensation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "source-migration-package-binding"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "condensed-cluster-package-loading"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "source-migration-run-artifact-binding"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("derived-depth-population-binding"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("candidate-partial-pruning"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "generalized-depth-recursive-pruning"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "directed-strong-recursive-pruning"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "nested-substructure-invariant-resolution"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "nested-substructure-invariant-resolution"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "additional-profile-invariant-aggregation"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("null-model-execution"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "current-level-null-model-execution"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "current-level-null-model-execution"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "resumable-candidate-generation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "resumable-candidate-generation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "resumable-candidate-generation-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-null-model-planning"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-null-model-proposal-generation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-null-model-local-trial-census"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-null-model-trial-selection"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-null-model-trial-selection-verification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-null-model-baseline"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "integrated-package-depth-null-model-execution"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "profile-guard-aware-generation"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "profile-guard-aware-generation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "run-target-ontology-coordinate-materialization"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-candidate-structural-attribute-derivation"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "package-candidate-structural-attribute-derivation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-scalar-candidate-attribute-derivation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-quantity-candidate-attribute-derivation"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "package-quantity-candidate-attribute-derivation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-role-dependent-edge-candidate-attribute-derivation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "formation-functional-candidate-attribute-carry-forward"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "package-role-dependent-edge-candidate-attribute-derivation"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "formation-dependent-type-classification"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "formation-dependent-type-classification"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-result-census"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-result-census-verification"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "integrated-level-result-census"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "integrated-level-result-census"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-run-artifact-bundle"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-run-artifact-store"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-run-candidate-explanation"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("artifact-bundle-index"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("artifact-bundle-index"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("source-explanation-index"));
  assert.deepEqual(KERNEL_CAPABILITIES.pending, []);
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("functional-ranking"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("sensitivity-analysis"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "functional-coefficient-role-closure"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("predicate-evaluation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-profile-collapse-testing"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-level-boundary-detection"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "package-carrier-promotion-materialization"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("profile-collapse"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("level-boundary-detection"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("package-ladder-closure"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("ladder-closure"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "bounded-current-level-fixpoint"
  ));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes(
    "bounded-current-level-fixpoint-verification"
  ));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes(
    "bounded-current-level-fixpoint"
  ));
});

test("kernel exposes the implemented graph generation foundation", () => {
  const kernel = createKernel();
  assert.equal(typeof kernel.canonicalizeSkeleton, "function");
  assert.equal(typeof kernel.enumerateConnectedSkeletons, "function");
  assert.equal(typeof kernel.createCandidateStore, "function");
  assert.equal(typeof kernel.enumerateDecoratedCandidates, "function");
  assert.equal(typeof kernel.advanceDecoratedCandidateEnumeration, "function");
  assert.equal(
    typeof kernel.verifyDecoratedCandidateEnumerationStep,
    "function"
  );
  assert.equal(typeof kernel.normalizeRunConfig, "function");
  assert.equal(typeof kernel.materializePrimitiveDepthPopulation, "function");
  assert.equal(typeof kernel.createPackageCandidateBinding, "function");
  assert.equal(typeof kernel.enumeratePackageCandidates, "function");
  assert.equal(typeof kernel.evaluatePackageCandidateFilter, "function");
  assert.equal(typeof kernel.evaluatePackageFunctional, "function");
  assert.equal(typeof kernel.constructPackageCohorts, "function");
  assert.equal(typeof kernel.verifyPackageCohortPartition, "function");
  assert.equal(typeof kernel.rankPackageSelector, "function");
  assert.equal(typeof kernel.verifyPackageSelectorRanking, "function");
  assert.equal(typeof kernel.admitPackageSelectors, "function");
  assert.equal(typeof kernel.verifyPackageSelectorAdmission, "function");
  assert.equal(typeof kernel.evaluatePackageSelectorSensitivity, "function");
  assert.equal(typeof kernel.verifyPackageSelectorSensitivity, "function");
  assert.equal(typeof kernel.materializePackageSelectedFormations, "function");
  assert.equal(typeof kernel.extractPackageDerivedProfiles, "function");
  assert.equal(typeof kernel.materializePackageDerivedDepthPopulation, "function");
  assert.equal(typeof kernel.closePackageLevel, "function");
  assert.equal(typeof kernel.verifyPackageLevelClosure, "function");
  assert.equal(typeof kernel.closeLevel, "function");
  assert.equal(typeof kernel.closePackageCurrentLevelFixpoint, "function");
  assert.equal(typeof kernel.verifyPackageCurrentLevelFixpoint, "function");
  assert.equal(typeof kernel.selectPackageDepthSourcePopulation, "function");
  assert.equal(typeof kernel.verifyPackageDepthSourcePopulation, "function");
  assert.equal(typeof kernel.createPackageDepthCandidateBinding, "function");
  assert.equal(typeof kernel.enumeratePackageDepthCandidates, "function");
  assert.equal(typeof kernel.createPackageLevelExplanationIndex, "function");
  assert.equal(typeof kernel.verifyPackageLevelExplanationIndex, "function");
  assert.equal(typeof kernel.explainPackageLevelCandidate, "function");
  assert.equal(typeof kernel.createPackageRunArtifactBundle, "function");
  assert.equal(typeof kernel.verifyPackageRunArtifactBundle, "function");
  assert.equal(typeof kernel.materializePackageRunArtifact, "function");
  assert.equal(typeof kernel.createPackageRunArtifactStore, "function");
  assert.equal(typeof kernel.verifyPackageRunArtifactStore, "function");
  assert.equal(typeof kernel.explainPackageRunCandidate, "function");
  assert.equal(typeof kernel.auditPackageDepthPredicateMonotonicity, "function");
  assert.equal(
    typeof kernel.verifyPackageDepthPredicateMonotonicityAudit,
    "function"
  );
  assert.equal(
    typeof kernel.createPackageDepthPartialPruningControllerSession,
    "function"
  );
  assert.equal(typeof kernel.authorizePackageDepthPartialPruning, "function");
  assert.equal(
    typeof kernel.enumeratePackageDepthCandidatesWithPruning,
    "function"
  );
  assert.equal(
    typeof kernel.verifyPackageDepthCandidatesWithPruning,
    "function"
  );
  assert.equal(typeof kernel.auditPackageDepthGeneratorFrontiers, "function");
  assert.equal(
    typeof kernel.verifyPackageDepthGeneratorFrontierAudit,
    "function"
  );
  assert.equal(
    typeof kernel.createPackageDepthGeneratorFrontierControllerSession,
    "function"
  );
  assert.equal(
    typeof kernel.authorizePackageDepthGeneratorFrontierPruning,
    "function"
  );
  assert.equal(
    typeof kernel.enumeratePackageDepthCandidatesWithRecursivePruning,
    "function"
  );
  assert.equal(
    typeof kernel.verifyPackageDepthCandidatesWithRecursivePruning,
    "function"
  );
  assert.equal(typeof kernel.auditPackageDepthNodeFrontiers, "function");
  assert.equal(typeof kernel.verifyPackageDepthNodeFrontierAudit, "function");
  assert.equal(
    typeof kernel.createPackageDepthNodeFrontierControllerSession,
    "function"
  );
  assert.equal(
    typeof kernel.authorizePackageDepthNodeFrontierPruning,
    "function"
  );
  assert.equal(
    typeof kernel.enumeratePackageDepthCandidatesWithNodeGrowthPruning,
    "function"
  );
  assert.equal(
    typeof kernel.verifyPackageDepthCandidatesWithNodeGrowthPruning,
    "function"
  );
  assert.equal(typeof kernel.evaluatePackageDepthCandidateFilter, "function");
  assert.equal(typeof kernel.evaluatePackageDepthCandidateCensus, "function");
  assert.equal(typeof kernel.verifyPackageDepthCandidateCensus, "function");
  assert.equal(typeof kernel.evaluatePackageCandidateCensus, "function");
  assert.equal(typeof kernel.verifyPackageCandidateCensus, "function");
  assert.equal(typeof kernel.auditPackagePredicateMonotonicity, "function");
  assert.equal(typeof kernel.verifyPackagePredicateMonotonicityAudit, "function");
  assert.equal(typeof kernel.authorizePackagePartialPruning, "function");
  assert.equal(typeof kernel.createPackagePartialPruningControllerSession, "function");
  assert.equal(typeof kernel.enumeratePackageCandidatesWithPruning, "function");
  assert.equal(typeof kernel.verifyPackageCandidatesWithPruning, "function");
  assert.equal(typeof kernel.auditPackageGeneratorFrontiers, "function");
  assert.equal(typeof kernel.verifyPackageGeneratorFrontierAudit, "function");
  assert.equal(
    typeof kernel.createPackageGeneratorFrontierControllerSession,
    "function"
  );
  assert.equal(
    typeof kernel.enumeratePackageCandidatesWithRecursivePruning,
    "function"
  );
  assert.equal(
    typeof kernel.verifyPackageCandidatesWithRecursivePruning,
    "function"
  );
  assert.equal(typeof kernel.auditPackageNodeFrontiers, "function");
  assert.equal(typeof kernel.verifyPackageNodeFrontierAudit, "function");
  assert.equal(
    typeof kernel.createPackageNodeFrontierControllerSession,
    "function"
  );
  assert.equal(typeof kernel.authorizePackageNodeFrontierPruning, "function");
  assert.equal(
    typeof kernel.enumeratePackageCandidatesWithNodeGrowthPruning,
    "function"
  );
  assert.equal(
    typeof kernel.verifyPackageCandidatesWithNodeGrowthPruning,
    "function"
  );
  assert.equal(typeof kernel.parseUnitExpression, "function");
  assert.equal(typeof kernel.normalizeQuantity, "function");
  assert.equal(typeof kernel.compareQuantities, "function");
  assert.equal(typeof kernel.parseDecimal, "function");
  assert.equal(typeof kernel.sumDecimals, "function");
  assert.equal(typeof kernel.accumulateDecimals, "function");
  assert.equal(typeof kernel.analyzeValueExpression, "function");
  assert.equal(typeof kernel.analyzePredicateExpression, "function");
  assert.equal(typeof kernel.compilePredicate, "function");
  assert.equal(typeof kernel.evaluateGraphPredicatePlan, "function");
  assert.equal(typeof kernel.evaluateLocalPredicatePlan, "function");
  assert.equal(typeof kernel.detectPartialGraphPredicateFailure, "function");
  assert.equal(typeof kernel.bindPredicateNumericPolicy, "function");
  assert.equal(typeof kernel.createOracleRequestBinding, "function");
  assert.equal(typeof kernel.validateOracleResponse, "function");
  assert.equal(typeof kernel.freezeSourceClassificationPolicy, "function");
  assert.equal(typeof kernel.freezeSourceClassificationAnnotations, "function");
  assert.equal(typeof kernel.freezeSourceClassificationAdjudication, "function");
  assert.equal(typeof kernel.freezeSourceNodeResolutionPolicy, "function");
  assert.equal(typeof kernel.materializePackageCarrierPromotions, "function");
  assert.equal(typeof kernel.verifyPackageCarrierPromotions, "function");
  assert.equal(typeof kernel.promoteCarriers, "function");
  assert.equal("explainSource" in kernel, false);
  assert.throws(() => createKernel({ unknown: true }), TypeError);
});
