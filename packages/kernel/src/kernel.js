import { canonicalize } from "./canonical.js";
import { createCandidateStore } from "./candidate-store.js";
import { KernelNotImplementedError } from "./errors.js";
import { canonicalizeCandidate, canonicalizeSkeleton } from "./graph-canonicalizer.js";
import { hashCanonical } from "./hash.js";
import { loadKernelPackage } from "./package-loader.js";
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
  "depth-basis-hash",
  "rules-hash"
]);

const PENDING_CAPABILITIES = Object.freeze([
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
  const version = options.version === undefined ? "0.1.0" : options.version;
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
