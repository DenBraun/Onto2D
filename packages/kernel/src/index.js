/**
 * Public dependency-free boundary of the Onto2D kernel.
 *
 * The deterministic package, graph-identity, quantity/decimal, typed value and
 * Boolean analysis, predicate-plan, numeric-policy binding, and scientific
 * Oracle validation, source policy/annotation artifact foundations, finite
 * decorated-candidate enumeration, verified primitive depth populations,
 * normalized package/run binding, complete graph-predicate evaluation,
 * package-bound local numeric filtering, complete local-filter censuses, and
 * conservative partial-failure detection are executable. Source migration,
 * derived-element materialization, pruning authorization, remaining runtime-bound numeric/
 * substructure evaluation, selection, and closure remain explicit pending
 * capabilities.
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
  KernelNotImplementedError,
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
  PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION,
  evaluatePackageCandidateFilter
} from "./package-candidate-filter.js";
export {
  PACKAGE_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD,
  PACKAGE_CANDIDATE_CENSUS_EVALUATOR_VERSION,
  evaluatePackageCandidateCensus,
  verifyPackageCandidateCensus
} from "./package-candidate-census.js";
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

import { KernelNotImplementedError } from "./errors.js";

export const KERNEL_IMPLEMENTATION_STATUS = "foundation-active/decorated-generation-active/predicate-plans-active/local-census-active/closure-not-implemented";

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

export function requireKernelCapability(capability) {
  throw new KernelNotImplementedError(capability);
}
