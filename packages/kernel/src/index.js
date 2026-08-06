/**
 * Public dependency-free boundary of the Onto2D kernel.
 *
 * The deterministic package and graph-identity foundation is executable.
 * Candidate decoration, predicate evaluation, selection, and closure remain
 * explicit pending capabilities.
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
  HASH_DOMAINS,
  assertContentHash,
  createCanonicalForm,
  hashBytes,
  hashCanonical,
  isContentHash
} from "./hash.js";
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
export { createKernel, KERNEL_CAPABILITIES } from "./kernel.js";
export { loadKernelPackage, PACKAGE_DEFAULTS } from "./package-loader.js";

import { KernelNotImplementedError } from "./errors.js";

export const KERNEL_IMPLEMENTATION_STATUS = "foundation-active/closure-not-implemented";

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
