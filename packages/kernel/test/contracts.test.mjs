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
  assert.equal(KERNEL_IMPLEMENTATION_STATUS, "foundation-active/closure-not-implemented");
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
  assert.ok(!KERNEL_CAPABILITIES.pending.includes("graph-canonicalization"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("profile-collapse"));
  assert.ok(KERNEL_CAPABILITIES.pending.includes("level-boundary-detection"));
});

test("kernel exposes the implemented graph generation foundation", () => {
  const kernel = createKernel();
  assert.equal(typeof kernel.canonicalizeSkeleton, "function");
  assert.equal(typeof kernel.enumerateConnectedSkeletons, "function");
  assert.equal(typeof kernel.createCandidateStore, "function");
});

test("unimplemented capabilities fail explicitly", () => {
  assert.throws(
    () => requireKernelCapability("candidate-enumeration"),
    (error) => error instanceof KernelNotImplementedError &&
      error.code === "KERNEL_NOT_IMPLEMENTED" &&
      error.capability === "candidate-enumeration"
  );
});
