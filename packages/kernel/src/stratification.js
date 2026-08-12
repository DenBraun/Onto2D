import { KernelError } from "./errors.js";

export function hasCurrentDepthReferences(loadedPackage) {
  return loadedPackage.normalized.predicates.some(
    (predicate) => predicate.referencesDepth === "self"
  );
}

/** Prevents ordinary single-pass coordinators from simulating recursion. */
export function assertPackageRunStratification(loadedPackage, runConfig) {
  const hasSelfReference = hasCurrentDepthReferences(loadedPackage);
  const fixpointEnabled = runConfig.boundedFixpoint?.enabled === true;
  if (hasSelfReference && !fixpointEnabled) {
    throw new KernelError({
      code: "STRATIFICATION_SELF_REFERENCE_REQUIRES_FIXPOINT",
      stage: "BIND_PACKAGE_CANDIDATES",
      message: "Current-depth predicates require explicit bounded-fixpoint mode."
    });
  }
  if (fixpointEnabled) {
    throw new KernelError({
      code: "PACKAGE_BOUNDED_FIXPOINT_COORDINATOR_REQUIRED",
      stage: "BIND_PACKAGE_CANDIDATES",
      message: "Bounded-fixpoint runs must use the current-level round coordinator.",
      details: { hasSelfReference, boundedFixpoint: runConfig.boundedFixpoint }
    });
  }
}
