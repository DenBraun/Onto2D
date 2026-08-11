import { deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, createCanonicalForm, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { createPrimitiveIdentityBasis } from "./package-loader.js";

export const PRIMITIVE_DEPTH_POPULATION_VERSION = "primitive-depth-population-v1";

function materializeElement(primitive, loadedPackage) {
  const identity = createPrimitiveIdentityBasis(
    primitive,
    loadedPackage.normalized.identityPolicy
  );
  const canonicalForm = createCanonicalForm(HASH_DOMAINS.ELEMENT, identity, "1");
  if (canonicalForm.hash !== primitive.elementId) {
    throw new KernelError({
      code: "PRIMITIVE_ELEMENT_IDENTITY_MISMATCH",
      stage: "MATERIALIZE_PRIMITIVE_DEPTH",
      message: "Primitive element identity could not be reproduced from the loaded package.",
      details: {
        expected: canonicalForm.hash,
        actual: primitive.elementId
      }
    });
  }
  return {
    id: primitive.elementId,
    kind: primitive.kind,
    depth: 0,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    axisProvenance: {
      derivationDepth: "computed",
      ...(primitive.axisProvenance ?? {})
    },
    canonicalForm,
    profile: primitive.profile,
    provenance: null,
    ...(primitive.ontologyCoordinate === undefined
      ? {}
      : { ontologyCoordinate: primitive.ontologyCoordinate }),
    typeTags: primitive.typeTags,
    invariants: primitive.invariants,
    admittedBy: [],
    selectedBy: [],
    claimRefs: primitive.claimRefs,
    ...(primitive.cluster === undefined ? {} : { cluster: primitive.cluster })
  };
}

export function materializePrimitiveDepthPopulation(input, options = {}) {
  const loadedPackage = verifyLoadedPackage(input, options);
  const elements = loadedPackage.normalized.primitives
    .map((primitive) => materializeElement(primitive, loadedPackage))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const basis = {
    schemaVersion: "1",
    materializer: PRIMITIVE_DEPTH_POPULATION_VERSION,
    packageId: loadedPackage.packageId,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    depth: 0,
    elements
  };
  return deepFreeze({
    ...basis,
    populationHash: hashCanonical(HASH_DOMAINS.DEPTH_POPULATION, basis)
  });
}
