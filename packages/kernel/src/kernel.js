import { canonicalClone, canonicalize } from "./canonical.js";
import { enumerateDecoratedCandidates } from "./candidate-enumerator.js";
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
import { KernelNotImplementedError } from "./errors.js";
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
import { evaluatePackageCandidateFilter } from "./package-candidate-filter.js";
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
  "graph-isomorphism-canonicalization",
  "skeleton-content-addressing",
  "connected-skeleton-enumeration",
  "decorated-candidate-enumeration",
  "run-config-normalization",
  "primitive-depth-population-materialization",
  "package-candidate-binding",
  "package-candidate-enumeration",
  "package-candidate-filter-evaluation",
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
  "local-element-invariant-evaluation",
  "local-balance-evaluation",
  "partial-graph-predicate-failure-detection",
  "predicate-numeric-policy-binding",
  "oracle-request-binding",
  "oracle-response-validation",
  "source-classification-policy-freeze",
  "source-classification-annotation-freeze",
  "source-classification-adjudication-freeze",
  "source-node-resolution-policy-freeze",
  "depth-basis-hash",
  "rules-hash"
]);

const PENDING_CAPABILITIES = Object.freeze([
  "source-classification",
  "source-node-resolution",
  "source-condensation",
  "derived-depth-population-binding",
  "candidate-partial-pruning",
  "numeric-and-substructure-predicate-evaluation",
  "cohort-construction",
  "functional-ranking",
  "sensitivity-analysis",
  "profile-collapse",
  "level-boundary-detection",
  "closure",
  "explanation-index"
]);

function unavailable(capability) {
  return async function unavailableKernelCapability() {
    throw new KernelNotImplementedError(capability);
  };
}

function withKernelVersion(options, version) {
  if (!options || typeof options !== "object" || Array.isArray(options)) return options;
  return { ...canonicalClone(options), kernelVersion: version };
}

export function createKernel(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Kernel options must be an object.");
  }
  const safeOptions = canonicalClone(options);
  if (Object.keys(safeOptions).some((field) => field !== "version")) {
    throw new TypeError("Unknown kernel option.");
  }
  const version = safeOptions.version === undefined ? DEFAULT_KERNEL_VERSION : safeOptions.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new TypeError("Kernel version must be a non-empty string.");
  }

  return Object.freeze({
    version: version.trim(),
    capabilities: Object.freeze({
      implemented: IMPLEMENTED_CAPABILITIES,
      pending: PENDING_CAPABILITIES
    }),
    async loadPackage(input) {
      return loadKernelPackage(input, { kernelVersion: version.trim() });
    },
    canonicalize,
    canonicalizeCandidate,
    canonicalizeSkeleton,
    createCandidateStore,
    enumerateConnectedSkeletons,
    enumerateDecoratedCandidates,
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
    evaluatePackageCandidateFilter(loadedPackage, binding, candidate, options = {}) {
      return evaluatePackageCandidateFilter(
        loadedPackage,
        binding,
        candidate,
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
    freezeSourceNodeResolutionPolicy,
    hash(domain, value) {
      return hashCanonical(domain, value);
    },
    closeLevel: unavailable("closure"),
    closeLadder: unavailable("closure"),
    explain: unavailable("explanation-index"),
    explainSource: unavailable("explanation-index"),
    testProfileCollapse: unavailable("profile-collapse"),
    detectLevelBoundaries: unavailable("level-boundary-detection")
  });
}

export const KERNEL_CAPABILITIES = Object.freeze({
  implemented: IMPLEMENTED_CAPABILITIES,
  pending: PENDING_CAPABILITIES
});
