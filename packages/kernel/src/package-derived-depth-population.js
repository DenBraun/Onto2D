import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, createCanonicalForm, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import { verifyPackageDerivedProfiles } from "./package-derived-profiles.js";
import { verifyPackageSelectedFormations } from "./package-selected-formations.js";
import { materializeRunAxis } from "./run-axis.js";

export const PACKAGE_DERIVED_DEPTH_POPULATION_VERSION =
  "package-derived-depth-population-v3";
export const PACKAGE_DERIVED_ELEMENT_IDENTITY_POLICY = deepFreeze({
  graphContent: "canonical-candidate-content-without-execution-provenance-v1",
  quantityAttributes: "normalized-value-unit-tolerance-semantic-v1",
  ontologyCoordinate: "normalized-run-target-or-absent-v1",
  typeTags: "verified-profile-result-type-tags-v1",
  packageIdentityFields: "loaded-identity-policy-v1",
  primaryDerivation: "lexicographically-smallest-formation-hash-v1",
  alternateDerivations: "separate-canonical-derivation-index-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "MATERIALIZE_PACKAGE_DERIVED_DEPTH",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizePackageDerivedDepthPopulationOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DERIVED_DEPTH_OPTIONS_INVALID",
      "Derived-depth options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_DERIVED_DEPTH_OPTIONS_INVALID",
      "Derived-depth options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_DERIVED_DEPTH_OPTION_UNKNOWN",
      "Unknown derived-depth option.",
      { unknown }
    );
  }
  return value;
}

function selectOptions(options, fields) {
  const result = {};
  for (const field of fields) {
    if (options[field] !== undefined) result[field] = options[field];
  }
  return result;
}

function loadedOptions(options) {
  return selectOptions(options, ["kernelVersion"]);
}

function candidateOptions(options) {
  return selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates"
  ]);
}

function isQuantity(value) {
  return isObject(value) &&
    typeof value.value === "number" &&
    typeof value.unit === "string" &&
    isObject(value.tolerance) &&
    typeof value.semantic === "string" &&
    isObject(value.provenance);
}

function structuralAttribute(value) {
  if (!isQuantity(value)) return value;
  return {
    value: value.value,
    unit: value.unit,
    tolerance: value.tolerance,
    semantic: value.semantic
  };
}

function structuralAttributes(attributes) {
  return Object.fromEntries(Object.keys(attributes).sort(compareStrings).map(
    (key) => [key, structuralAttribute(attributes[key])]
  ));
}

function structuralCandidate(candidate) {
  return {
    domain: candidate.domain,
    nodes: candidate.nodes.map((node) => ({
      ref: node.ref,
      ...(node.attrs === undefined
        ? {}
        : { attrs: structuralAttributes(node.attrs) })
    })),
    edges: candidate.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      role: edge.role,
      ...(edge.attrs === undefined
        ? {}
        : { attrs: structuralAttributes(edge.attrs) })
    })),
    skeleton: candidate.skeleton
  };
}

function quantityIdentity(quantity) {
  return {
    value: quantity.value,
    unit: quantity.unit,
    tolerance: quantity.tolerance,
    semantic: quantity.semantic
  };
}

function elementInvariants(profile) {
  return Object.fromEntries(profile.invariantVector.map((entry) => [
    entry.semantic,
    entry.normalized
  ]));
}

function elementIdentityBasis(
  candidate,
  profile,
  typeTags,
  identityPolicy,
  ontologyCoordinate
) {
  const identity = {
    kind: "derived",
    content: structuralCandidate(candidate)
  };
  if (identityPolicy.ontologyCoordinateStructural) {
    identity.ontologyCoordinate = ontologyCoordinate ?? null;
  }
  if (identityPolicy.typeTagsStructural) {
    identity.typeTags = typeTags;
  }
  if (identityPolicy.invariantsStructural) {
    identity.invariants = Object.fromEntries(
      Object.entries(elementInvariants(profile)).sort(
        ([left], [right]) => compareStrings(left, right)
      ).map(([key, quantity]) => [key, quantityIdentity(quantity)])
    );
  }
  if (identityPolicy.profileStructural) identity.profileHash = profile.hash;
  if (identityPolicy.clusterPolicyStructural) identity.cluster = null;
  return identity;
}

function roleAssignment(candidate) {
  return {
    edges: candidate.edges.map((edge, canonicalEdge) => ({
      canonicalEdge,
      role: edge.role,
      direction: edge.from === edge.to
        ? "symmetric"
        : edge.from < edge.to ? "forward" : "reverse"
    }))
  };
}

function derivation(formation, profileResult) {
  return {
    candidateId: formation.candidateId,
    formationHash: formation.formationHash,
    profileResultHash: profileResult.profileResultHash,
    admittedBy: [...formation.admittedBy],
    selectedBy: [...formation.selectedBy],
    claimRefs: [...profileResult.claimRefs],
    provenance: {
      constituents: formation.constituents.map((entry) => entry.elementId),
      constituentProfiles: formation.constituents.map(
        (entry) => entry.profileHash
      ),
      skeleton: formation.candidate.skeleton,
      roleAssignment: roleAssignment(formation.candidate),
      sourceCandidate: formation.candidateId,
      derivationDepth: formation.targetDepth,
      depthBasis: formation.depthBasis,
      evidence: [...profileResult.evidence]
    }
  };
}

function candidateMaterialization(
  formation,
  profileResult,
  identityPolicy,
  ontologyCoordinate
) {
  const identity = elementIdentityBasis(
    formation.candidate,
    profileResult.profile,
    profileResult.derivedTypeTags,
    identityPolicy,
    ontologyCoordinate
  );
  const canonicalForm = createCanonicalForm(HASH_DOMAINS.ELEMENT, identity, "1");
  const derivationRecord = derivation(formation, profileResult);
  const axis = materializeRunAxis({ ontologyTarget: ontologyCoordinate });
  return {
    element: {
      id: canonicalForm.hash,
      kind: "derived",
      depth: formation.targetDepth,
      depthBasis: formation.depthBasis,
      axisProvenance: axis.axisProvenance,
      canonicalForm,
      profile: profileResult.profile,
      provenance: derivationRecord.provenance,
      ...(axis.ontologyCoordinate === undefined
        ? {}
        : { ontologyCoordinate: axis.ontologyCoordinate }),
      typeTags: [...profileResult.derivedTypeTags],
      invariants: elementInvariants(profileResult.profile),
      admittedBy: [...formation.admittedBy],
      selectedBy: [...formation.selectedBy],
      claimRefs: [...profileResult.claimRefs]
    },
    derivation: derivationRecord
  };
}

function reconcileMaterializations(materializations) {
  const byElement = new Map();
  for (const materialization of materializations) {
    const elementId = materialization.element.id;
    if (!byElement.has(elementId)) byElement.set(elementId, []);
    byElement.get(elementId).push(materialization);
  }
  const elements = [];
  const derivationIndex = [];
  for (const [elementId, entries] of [...byElement.entries()].sort(
    ([left], [right]) => compareStrings(left, right)
  )) {
    entries.sort((left, right) => compareStrings(
      left.derivation.formationHash,
      right.derivation.formationHash
    ));
    const primary = entries[0];
    elements.push(primary.element);
    derivationIndex.push({
      elementId,
      primaryFormationHash: primary.derivation.formationHash,
      derivations: entries.map((entry) => entry.derivation)
    });
  }
  return { elements, derivationIndex };
}

function interpretation(profiles) {
  if (profiles.status === "indeterminate") {
    return {
      status: "indeterminate",
      reasons: ["source-derived-profiles-indeterminate"]
    };
  }
  if (profiles.status === "empty") {
    return { status: "empty", reasons: ["no-materialized-elements"] };
  }
  return { status: "complete", reasons: [] };
}

/** Materializes and reconciles a complete derived depth from derived profiles. */
export function materializeVerifiedPackageDerivedDepthPopulation(
  loadedPackage,
  census,
  verifiedFormations,
  profiles
) {
  const formations = profiles.status === "complete"
    ? verifiedFormations.formations
    : [];
  const profileResultsByCandidate = new Map(profiles.results.map((entry) => [
    entry.candidateId,
    entry
  ]));
  const definition = loadedPackage.normalized.profileDefinition;
  const ontologyCoordinate = census.generation.binding.runConfig.ontologyTarget;
  const materializations = formations.map((formation) => {
    const profileResult = profileResultsByCandidate.get(formation.candidateId);
    if (profileResult === undefined || profileResult.status !== "materialized") {
      fail(
        "PACKAGE_DERIVED_DEPTH_PROFILE_MISSING",
        "A complete derived-profile set omits a selected formation.",
        { candidateId: formation.candidateId }
      );
    }
    if (!new Set([
      "residual-slots-v1",
      "residual-slots-v2",
      "residual-slots-v3"
    ]).has(
      definition.kind
    )) {
      fail(
        "PACKAGE_DERIVED_DEPTH_PROFILE_POLICY_INVALID",
        "A complete derived-profile set requires an executable residual-slot policy."
      );
    }
    return candidateMaterialization(
      formation,
      profileResult,
      loadedPackage.normalized.identityPolicy,
      ontologyCoordinate
    );
  });
  const reconciled = reconcileMaterializations(materializations);
  const resultInterpretation = interpretation(profiles);
  const counts = {
    selectedFormations: profiles.counts.selectedFormations,
    materializedProfiles: profiles.counts.materializedProfiles,
    uniqueElements: reconciled.elements.length,
    alternateDerivations:
      materializations.length - reconciled.elements.length,
    indeterminateProfiles: profiles.counts.indeterminateProfiles
  };
  const basis = {
    schemaVersion: "1",
    materializer: PACKAGE_DERIVED_DEPTH_POPULATION_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    admissionHash: profiles.admissionHash,
    formationSetHash: profiles.formationSetHash,
    profileSetHash: profiles.profileSetHash,
    countingDomain: profiles.countingDomain,
    sourcePopulationHash: profiles.sourcePopulationHash,
    depth: profiles.targetDepth,
    depthBasis: profiles.depthBasis,
    elementIdentityPolicy: PACKAGE_DERIVED_ELEMENT_IDENTITY_POLICY,
    elements: reconciled.elements,
    derivationIndex: reconciled.derivationIndex,
    counts,
    status: resultInterpretation.status,
    interpretation: resultInterpretation
  };
  return deepFreeze({
    ...basis,
    populationHash: hashCanonical(HASH_DOMAINS.DEPTH_POPULATION, basis)
  });
}

/** Materializes a derived population from primitive-source formations. */
export function materializePackageDerivedDepthPopulation(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  formationsInput,
  profilesInput,
  options = {}
) {
  const normalizedOptions = normalizePackageDerivedDepthPopulationOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    candidateOptions(normalizedOptions)
  );
  const verifiedFormations = verifyPackageSelectedFormations(
    formationsInput,
    loadedPackage,
    runConfigInput,
    census,
    admissionInput,
    normalizedOptions
  );
  const profiles = verifyPackageDerivedProfiles(
    profilesInput,
    loadedPackage,
    runConfigInput,
    census,
    admissionInput,
    verifiedFormations,
    normalizedOptions
  );
  return materializeVerifiedPackageDerivedDepthPopulation(
    loadedPackage,
    census,
    verifiedFormations,
    profiles
  );
}

/** Verifies a population after its formations and profiles were replayed. */
export function verifyVerifiedPackageDerivedDepthPopulation(
  populationInput,
  loadedPackage,
  census,
  formations,
  profiles
) {
  let supplied;
  try {
    supplied = canonicalClone(populationInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DERIVED_DEPTH_ARTIFACT_INVALID",
      "Derived-depth population is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = materializeVerifiedPackageDerivedDepthPopulation(
    loadedPackage,
    census,
    formations,
    profiles
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DERIVED_DEPTH_MISMATCH",
      "Derived-depth population differs from deterministic reproduction.",
      {
        expectedPopulationHash: reproduced.populationHash,
        actualPopulationHash:
          isObject(supplied) && typeof supplied.populationHash === "string"
            ? supplied.populationHash
            : null
      }
    );
  }
  return reproduced;
}

/** Reproduces a stored derived-depth population exactly. */
export function verifyPackageDerivedDepthPopulation(
  populationInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  formationsInput,
  profilesInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(populationInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DERIVED_DEPTH_ARTIFACT_INVALID",
      "Derived-depth population is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = materializePackageDerivedDepthPopulation(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    admissionInput,
    formationsInput,
    profilesInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DERIVED_DEPTH_MISMATCH",
      "Derived-depth population differs from deterministic reproduction.",
      {
        expectedPopulationHash: reproduced.populationHash,
        actualPopulationHash:
          isObject(supplied) && typeof supplied.populationHash === "string"
            ? supplied.populationHash
            : null
      }
    );
  }
  return reproduced;
}
