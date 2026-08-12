import { deepFreeze } from "./canonical.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  createPackageCandidateBinding,
  derivePackageCandidateVariants
} from "./package-candidate-generator.js";
import {
  selectPackageDepthSourcePopulation
} from "./package-depth-source-selection.js";
import {
  enumerateBoundCandidatesWithProfileComposition
} from "./package-profile-composition.js";

export const PACKAGE_DEPTH_CANDIDATE_BINDER_VERSION =
  "package-depth-candidate-binding-v2";
export const PACKAGE_DEPTH_CANDIDATE_GENERATOR_VERSION =
  "package-depth-candidate-generator-v3";
export const PACKAGE_DEPTH_CANDIDATE_BINDING_POLICY = deepFreeze({
  sourceSelection: "exact-package-depth-source-selection-v1",
  elementAlphabet: "all-selected-element-ids-v1",
  profileAlphabet: "one-hash-per-selected-profile-class-v1",
  skeletonAndDecorationBudgets:
    "reproduced-package-candidate-binding-execution-v1"
});

const CANDIDATE_OPTION_FIELDS = [
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates"
];

function candidateOptions(options) {
  const selected = {};
  for (const field of CANDIDATE_OPTION_FIELDS) {
    if (options[field] !== undefined) selected[field] = options[field];
  }
  return selected;
}

/** Binds a depth-aware source selection to the finite candidate universe. */
export function createPackageDepthCandidateBinding(
  loadedPackage,
  runConfig,
  levelClosures,
  targetDepth,
  options = {}
) {
  const sourcePopulation = selectPackageDepthSourcePopulation(
    loadedPackage,
    runConfig,
    levelClosures,
    targetDepth,
    options
  );
  const primitiveBinding = createPackageCandidateBinding(
    loadedPackage,
    runConfig,
    candidateOptions(options)
  );
  const { nodeVariants, edgeVariants } = derivePackageCandidateVariants(
    sourcePopulation,
    primitiveBinding.runConfig,
    loadedPackage.normalized.candidateAttributes
  );
  const basis = {
    schemaVersion: "1",
    binder: PACKAGE_DEPTH_CANDIDATE_BINDER_VERSION,
    packageId: primitiveBinding.packageId,
    rulesHash: sourcePopulation.rulesHash,
    depthBasis: primitiveBinding.depthBasis,
    runConfigHash: primitiveBinding.runConfigHash,
    runConfig: primitiveBinding.runConfig,
    targetDepth,
    bindingPolicy: PACKAGE_DEPTH_CANDIDATE_BINDING_POLICY,
    sourcePopulation,
    enumerationInput: {
      ...primitiveBinding.enumerationInput,
      nodeVariants,
      edgeVariants
    },
    enumerationOptions: primitiveBinding.enumerationOptions
  };
  return deepFreeze({
    ...basis,
    bindingHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_DEPTH_CANDIDATE_BINDING,
      basis
    )
  });
}

/** Enumerates the complete finite universe for a depth-aware binding. */
export function enumeratePackageDepthCandidates(
  loadedPackage,
  runConfig,
  levelClosures,
  targetDepth,
  options = {}
) {
  const binding = createPackageDepthCandidateBinding(
    loadedPackage,
    runConfig,
    levelClosures,
    targetDepth,
    options
  );
  const { enumeration, profileComposition } =
    enumerateBoundCandidatesWithProfileComposition(binding);
  return deepFreeze({
    schemaVersion: "1",
    generator: PACKAGE_DEPTH_CANDIDATE_GENERATOR_VERSION,
    binding,
    enumeration,
    profileComposition
  });
}
