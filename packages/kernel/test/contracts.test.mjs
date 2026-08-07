import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUSTER_DISPOSITIONS,
  INTERNAL_ORDER,
  KERNEL_CAPABILITIES,
  KERNEL_IMPLEMENTATION_STATUS,
  KernelNotImplementedError,
  MIGRATION_EXPOSURE_STATUSES,
  SOURCE_RELATION_KINDS,
  createKernel,
  requireKernelCapability
} from "../src/index.js";

test("kernel publishes the complete source-relation vocabulary", () => {
  assert.equal(KERNEL_IMPLEMENTATION_STATUS, "foundation-active/predicate-plans-active/closure-not-implemented");
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
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("candidate-deduplication-store"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("unit-grammar"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("quantity-normalization"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("tolerance-aware-comparison"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("decimal-rational-arithmetic"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("deterministic-decimal-rounding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("numeric-accumulation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("typed-value-expression-analysis"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("boolean-expression-analysis"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("predicate-plan-compilation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("predicate-numeric-policy-binding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("oracle-request-binding"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("oracle-response-validation"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-policy-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-annotation-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-classification-adjudication-freeze"));
  assert.ok(KERNEL_CAPABILITIES.implemented.includes("source-node-resolution-policy-freeze"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("graph-canonicalization"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("deterministic-decimal-arithmetic"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("typed-expression-analysis"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("boolean-expression-analysis"));
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("oracle-response-validation"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("source-classification"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("source-node-resolution"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("source-condensation"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("profile-collapse"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("level-boundary-detection"));
});

test("kernel exposes the implemented graph generation foundation", () => {
  const kernel = createKernel();
  assert.equal(typeof kernel.canonicalizeSkeleton, "function");
  assert.equal(typeof kernel.enumerateConnectedSkeletons, "function");
  assert.equal(typeof kernel.createCandidateStore, "function");
  assert.equal(typeof kernel.parseUnitExpression, "function");
  assert.equal(typeof kernel.normalizeQuantity, "function");
  assert.equal(typeof kernel.compareQuantities, "function");
  assert.equal(typeof kernel.parseDecimal, "function");
  assert.equal(typeof kernel.sumDecimals, "function");
  assert.equal(typeof kernel.analyzeValueExpression, "function");
  assert.equal(typeof kernel.analyzePredicateExpression, "function");
  assert.equal(typeof kernel.compilePredicate, "function");
  assert.equal(typeof kernel.bindPredicateNumericPolicy, "function");
  assert.equal(typeof kernel.createOracleRequestBinding, "function");
  assert.equal(typeof kernel.validateOracleResponse, "function");
  assert.equal(typeof kernel.freezeSourceClassificationPolicy, "function");
  assert.equal(typeof kernel.freezeSourceClassificationAnnotations, "function");
  assert.equal(typeof kernel.freezeSourceClassificationAdjudication, "function");
  assert.equal(typeof kernel.freezeSourceNodeResolutionPolicy, "function");
  assert.throws(() => createKernel({ unknown: true }), TypeError);
});

test("unimplemented capabilities fail explicitly", () => {
  assert.throws(
    () => requireKernelCapability("candidate-enumeration"),
    (error) => error instanceof KernelNotImplementedError &&
      error.code === "KERNEL_NOT_IMPLEMENTED" &&
      error.capability === "candidate-enumeration"
  );
});
