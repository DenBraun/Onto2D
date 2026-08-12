import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import { verifyPackageSelectorAdmission } from "./package-selector-admission.js";

export const PACKAGE_SELECTED_FORMATIONS_VERSION =
  "package-selected-formations-v1";
export const PACKAGE_SELECTED_FORMATIONS_SCOPE =
  "definitely-selected-candidate-formations-v1";
export const PACKAGE_SELECTED_FORMATIONS_POLICY = deepFreeze({
  candidateOrder: "canonical-candidate-id-v1",
  admissionSource: "exact-admission-selected-outcome-v1",
  constituentResolution: "preserve-filter-formation-resolution-v1",
  claimLineage:
    "passed-predicate-selected-selector-and-functional-claims-v1",
  materializationDisposition:
    "formation-only-profile-and-element-identity-deferred-v1"
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
    stage: "MATERIALIZE_PACKAGE_SELECTED_FORMATIONS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareStrings);
}

export function normalizePackageSelectedFormationsOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTED_FORMATIONS_OPTIONS_INVALID",
      "Selected-formation options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_SELECTED_FORMATIONS_OPTIONS_INVALID",
      "Selected-formation options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_SELECTED_FORMATIONS_OPTION_UNKNOWN",
      "Unknown selected-formation option.",
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

function admissionOptions(options) {
  return selectOptions(options, [...OPTION_FIELDS]);
}

function functionalClaimRefs(admission, candidateId) {
  const claims = [];
  for (const execution of admission.selectorExecutions) {
    for (const cohort of execution.ranking.cohortRankings) {
      const member = cohort.members.find(
        (entry) => entry.candidateId === candidateId
      );
      if (member !== undefined) claims.push(...member.evaluation.claimRefs);
    }
  }
  return claims;
}

function claimEvidence(claimRefs, claimsById) {
  return sortedUnique(claimRefs.flatMap((claimId) => {
    const claim = claimsById.get(claimId);
    if (claim === undefined) {
      fail(
        "PACKAGE_SELECTED_FORMATIONS_CLAIM_MISSING",
        "A formation claim is absent from the reproduced package.",
        { claimId }
      );
    }
    return claim.evidence;
  }));
}

function createFormation(
  admission,
  decision,
  filter,
  claimsById
) {
  const predicateClaimRefs = filter.predicateEvaluations
    .filter((entry) => decision.passedPredicateIds.includes(entry.predicateId))
    .flatMap((entry) => entry.claimRefs);
  const selectorClaimRefs = decision.selectorEvaluations
    .filter((entry) => entry.outcome === "selected")
    .flatMap((entry) => entry.claimRefs);
  const claimRefs = sortedUnique([
    ...predicateClaimRefs,
    ...selectorClaimRefs,
    ...functionalClaimRefs(admission, decision.candidateId)
  ]);
  const basis = {
    schemaVersion: "1",
    candidateId: decision.candidateId,
    filterHash: filter.filterHash,
    admissionHash: admission.admissionHash,
    targetDepth: filter.formation.targetDepth,
    depthBasis: filter.formation.depthBasis,
    sourcePopulationHash: filter.formation.sourcePopulationHash,
    candidate: filter.formation.candidate,
    constituents: filter.formation.constituents,
    admittedBy: [...decision.passedPredicateIds],
    selectedBy: [...decision.selectedBy],
    selectionWitnesses: decision.selectorEvaluations.map((entry) => ({
      selectorId: entry.selectorId,
      cohortId: entry.cohortId,
      functionalEvaluationHash: entry.functionalEvaluationHash,
      rankingHash: entry.rankingHash,
      sensitivityHash: entry.sensitivityHash
    })),
    claimRefs,
    evidence: claimEvidence(claimRefs, claimsById)
  };
  return {
    ...basis,
    formationHash: hashCanonical(HASH_DOMAINS.SELECTED_FORMATION, basis)
  };
}

function reproduceInputs(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  options
) {
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(options)
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    candidateOptions(options)
  );
  if (!isObject(admissionInput) || !Array.isArray(admissionInput.selectorExecutions)) {
    fail(
      "PACKAGE_SELECTED_FORMATIONS_ADMISSION_INVALID",
      "Selected formations require an admission artifact with embedded selector executions."
    );
  }
  const admission = verifyPackageSelectorAdmission(
    admissionInput,
    loadedPackage,
    runConfigInput,
    census,
    admissionInput.selectorExecutions,
    admissionOptions(options)
  );
  return { loadedPackage, census, admission };
}

/**
 * Materializes the exact, provenance-complete formation basis for every
 * definitely selected candidate. Profiles and derived Element identities are
 * intentionally left to their separately versioned deterministic boundary.
 */
export function materializeVerifiedPackageSelectedFormations(
  loadedPackage,
  census,
  admission
) {
  const decisionsById = new Map(admission.decisions.map((entry) => [
    entry.candidateId,
    entry
  ]));
  const filtersById = new Map(census.candidateEvaluations.map((entry) => [
    entry.formation.candidate.id,
    entry
  ]));
  const claimsById = new Map(loadedPackage.normalized.claims.map((entry) => [
    entry.id,
    entry
  ]));
  const formations = admission.selectedCandidateIds.map((candidateId) => {
    const decision = decisionsById.get(candidateId);
    const filter = filtersById.get(candidateId);
    if (
      decision === undefined ||
      decision.outcome !== "selected" ||
      filter === undefined ||
      filter.verdict !== "eligible"
    ) {
      fail(
        "PACKAGE_SELECTED_FORMATIONS_SELECTION_MISMATCH",
        "A selected candidate has no matching eligible admission/filter basis.",
        { candidateId }
      );
    }
    return createFormation(
      admission,
      decision,
      filter,
      claimsById
    );
  }).sort((left, right) => compareStrings(left.candidateId, right.candidateId));
  const counts = {
    ...admission.counts,
    selectedFormations: formations.length
  };
  if (counts.selectedCandidates !== counts.selectedFormations) {
    fail(
      "PACKAGE_SELECTED_FORMATIONS_COUNT_MISMATCH",
      "Selected formation count does not reconcile with admission.",
      counts
    );
  }
  const basis = {
    schemaVersion: "1",
    materializer: PACKAGE_SELECTED_FORMATIONS_VERSION,
    scope: PACKAGE_SELECTED_FORMATIONS_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    admissionHash: admission.admissionHash,
    countingDomain: census.countingDomain,
    sourcePopulationHash: census.sourcePopulationHash,
    targetDepth: census.targetDepth,
    depthBasis: census.generation.binding.depthBasis,
    formationPolicy: PACKAGE_SELECTED_FORMATIONS_POLICY,
    selectedCandidateIds: [...admission.selectedCandidateIds],
    formations,
    counts,
    status: admission.status,
    interpretation: admission.interpretation
  };
  return deepFreeze({
    ...basis,
    formationSetHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_SELECTED_FORMATIONS,
      basis
    )
  });
}

/** Materializes selected formations from a primitive-source admission. */
export function materializePackageSelectedFormations(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  options = {}
) {
  const normalizedOptions = normalizePackageSelectedFormationsOptions(options);
  const { loadedPackage, census, admission } = reproduceInputs(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    admissionInput,
    normalizedOptions
  );
  return materializeVerifiedPackageSelectedFormations(
    loadedPackage,
    census,
    admission
  );
}

/** Reproduces a stored selected-formation artifact exactly. */
export function verifyPackageSelectedFormations(
  formationsInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(formationsInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_SELECTED_FORMATIONS_ARTIFACT_INVALID",
      "Selected-formation artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = materializePackageSelectedFormations(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    admissionInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_SELECTED_FORMATIONS_MISMATCH",
      "Selected formations differ from deterministic reproduction.",
      {
        expectedFormationSetHash: reproduced.formationSetHash,
        actualFormationSetHash:
          isObject(supplied) && typeof supplied.formationSetHash === "string"
            ? supplied.formationSetHash
            : null
      }
    );
  }
  return reproduced;
}
