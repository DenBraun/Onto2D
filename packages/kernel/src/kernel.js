import { canonicalClone, canonicalize } from "./canonical.js";
import { createCandidateStore } from "./candidate-store.js";
import {
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
import { hashCanonical } from "./hash.js";
import { loadKernelPackage } from "./package-loader.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { createOracleRequestBinding, validateOracleResponse } from "./oracle-validator.js";
import { analyzePredicateExpression, compilePredicate } from "./predicate-analyzer.js";
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

const IMPLEMENTED_CAPABILITIES = Object.freeze([
  "canonical-json",
  "domain-separated-sha256",
  "package-defaults",
  "package-normalization",
  "package-structural-validation",
  "graph-isomorphism-canonicalization",
  "skeleton-content-addressing",
  "connected-skeleton-enumeration",
  "candidate-deduplication-store",
  "unit-grammar",
  "quantity-normalization",
  "tolerance-aware-comparison",
  "decimal-rational-arithmetic",
  "deterministic-decimal-rounding",
  "numeric-accumulation",
  "typed-value-expression-analysis",
  "boolean-expression-analysis",
  "predicate-plan-compilation",
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
  "candidate-enumeration",
  "predicate-evaluation",
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

export function createKernel(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Kernel options must be an object.");
  }
  const safeOptions = canonicalClone(options);
  if (Object.keys(safeOptions).some((field) => field !== "version")) {
    throw new TypeError("Unknown kernel option.");
  }
  const version = safeOptions.version === undefined ? "0.1.0" : safeOptions.version;
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
    parseUnitExpression,
    normalizeUnitExpression,
    normalizeQuantity,
    convertQuantity,
    compareQuantities,
    parseDecimal,
    normalizePrecisionPolicy,
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
