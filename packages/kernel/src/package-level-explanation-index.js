import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";
import { verifyPackageDepthLevelClosure } from "./package-depth-level-closure.js";
import { verifyPackageLevelClosure } from "./package-level-closure.js";

export const PACKAGE_LEVEL_EXPLANATION_INDEXER_VERSION =
  "package-level-explanation-indexer-v1";
export const PACKAGE_LEVEL_EXPLANATION_INDEX_SCOPE =
  "complete-verified-level-candidate-lineage-v1";
export const PACKAGE_LEVEL_CANDIDATE_EXPLAINER_VERSION =
  "package-level-candidate-explainer-v1";

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PACKAGE_LEVEL_EXPLANATION_INDEX",
    message,
    details
  });
}

function cloneArtifact(value, code, message) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, message, { causeCode: error.code });
  }
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueMap(values, keyFor, label) {
  const result = new Map();
  for (const value of values) {
    const key = keyFor(value);
    if (result.has(key)) {
      fail(
        "PACKAGE_LEVEL_EXPLANATION_INDEX_DUPLICATE",
        "A verified level contains a duplicate explanation index key.",
        { label, key }
      );
    }
    result.set(key, value);
  }
  return result;
}

function verifyBoundLevel(
  levelInput,
  loadedPackage,
  runConfig,
  priorLevels,
  options
) {
  const supplied = cloneArtifact(
    levelInput,
    "PACKAGE_LEVEL_EXPLANATION_LEVEL_INVALID",
    "Explanation indexing requires a canonicalizable level artifact."
  );
  if (!Array.isArray(priorLevels)) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_PRIOR_LEVELS_INVALID",
      "Explanation indexing requires an array of prior levels."
    );
  }
  if (supplied?.closer === "package-level-closure-v1") {
    if (priorLevels.length !== 0) {
      fail(
        "PACKAGE_LEVEL_EXPLANATION_PRIOR_LEVELS_UNEXPECTED",
        "A primitive-to-depth-one level cannot be indexed with prior levels.",
        { priorLevels: priorLevels.length }
      );
    }
    return verifyPackageLevelClosure(
      supplied,
      loadedPackage,
      runConfig,
      options
    );
  }
  if (supplied?.closer === "package-depth-level-closure-v1") {
    return verifyPackageDepthLevelClosure(
      supplied,
      loadedPackage,
      runConfig,
      priorLevels,
      supplied.depth,
      options
    );
  }
  fail(
    "PACKAGE_LEVEL_EXPLANATION_LEVEL_UNSUPPORTED",
    "Explanation indexing supports only verified ordinary or depth-aware level closures.",
    { closer: supplied?.closer ?? null }
  );
}

function derivationLinks(population) {
  const elements = uniqueMap(population.elements, (element) => element.id, "elementId");
  const links = new Map();
  for (const record of population.derivationIndex) {
    const element = elements.get(record.elementId);
    if (element === undefined) {
      fail(
        "PACKAGE_LEVEL_EXPLANATION_DERIVATION_ELEMENT_MISSING",
        "A verified derivation index references an absent materialized element.",
        { elementId: record.elementId }
      );
    }
    for (const derivation of record.derivations) {
      const values = links.get(derivation.candidateId) ?? [];
      values.push({
        element,
        primaryFormationHash: record.primaryFormationHash,
        derivation
      });
      links.set(derivation.candidateId, values);
    }
  }
  for (const values of links.values()) {
    values.sort((left, right) => compareStrings(left.element.id, right.element.id));
  }
  return links;
}

function buildEntries(level) {
  const { census, admission, formations, profiles, population } = level.artifacts;
  const decisions = uniqueMap(
    admission.decisions,
    (entry) => entry.candidateId,
    "admissionCandidateId"
  );
  const formationByCandidate = uniqueMap(
    formations.formations,
    (entry) => entry.candidateId,
    "formationCandidateId"
  );
  const profileByCandidate = uniqueMap(
    profiles.results,
    (entry) => entry.candidateId,
    "profileCandidateId"
  );
  const derivedByCandidate = derivationLinks(population);
  const seen = new Set();
  const entries = census.candidateEvaluations.map((filter) => {
    const candidateId = filter.formation.candidate.id;
    if (seen.has(candidateId)) {
      fail(
        "PACKAGE_LEVEL_EXPLANATION_INDEX_DUPLICATE",
        "A verified census contains a duplicate candidate explanation.",
        { label: "censusCandidateId", key: candidateId }
      );
    }
    seen.add(candidateId);
    const decision = decisions.get(candidateId);
    if (decision === undefined) {
      fail(
        "PACKAGE_LEVEL_EXPLANATION_ADMISSION_MISSING",
        "A census candidate has no admission decision.",
        { candidateId }
      );
    }
    const formation = formationByCandidate.get(candidateId) ?? null;
    const profile = profileByCandidate.get(candidateId) ?? null;
    if (
      (decision.outcome === "selected") !== (formation !== null) ||
      (formation !== null) !== (profile !== null)
    ) {
      fail(
        "PACKAGE_LEVEL_EXPLANATION_LINEAGE_MISMATCH",
        "Candidate admission, formation, and profile lineage do not reconcile.",
        {
          candidateId,
          admissionOutcome: decision.outcome,
          hasFormation: formation !== null,
          hasProfile: profile !== null
        }
      );
    }
    return {
      candidateId,
      filter,
      admission: decision,
      formation,
      profile,
      derivedElements: derivedByCandidate.get(candidateId) ?? []
    };
  });
  if (
    decisions.size !== entries.length ||
    [...formationByCandidate.keys()].some((candidateId) => !seen.has(candidateId)) ||
    [...profileByCandidate.keys()].some((candidateId) => !seen.has(candidateId)) ||
    [...derivedByCandidate.keys()].some((candidateId) => !seen.has(candidateId))
  ) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_COVERAGE_MISMATCH",
      "Level explanation sources do not cover the same candidate universe.",
      {
        censusCandidates: entries.length,
        admissionDecisions: decisions.size,
        formations: formationByCandidate.size,
        profiles: profileByCandidate.size,
        derivationCandidates: derivedByCandidate.size
      }
    );
  }
  return entries;
}

/** Builds a complete candidate-lineage index from one exactly replayed level. */
export function createPackageLevelExplanationIndex(
  loadedPackage,
  runConfig,
  level,
  priorLevels = [],
  options = {}
) {
  const verified = verifyBoundLevel(
    level,
    loadedPackage,
    runConfig,
    priorLevels,
    options
  );
  const entries = buildEntries(verified);
  const { census, admission, formations, profiles, population } =
    verified.artifacts;
  const distinctDerivedElements = new Set(entries.flatMap((entry) =>
    entry.derivedElements.map((link) => link.element.id)
  ));
  const basis = {
    schemaVersion: "1",
    indexer: PACKAGE_LEVEL_EXPLANATION_INDEXER_VERSION,
    scope: PACKAGE_LEVEL_EXPLANATION_INDEX_SCOPE,
    packageId: verified.packageId,
    rulesHash: verified.rulesHash,
    depthBasis: verified.depthBasis,
    runHash: verified.run.runHash,
    levelHash: verified.levelHash,
    targetDepth: verified.depth,
    countingDomain: verified.countingDomain,
    sourcePopulationHash: census.sourcePopulationHash,
    artifactHashes: {
      censusHash: census.censusHash,
      admissionHash: admission.admissionHash,
      formationSetHash: formations.formationSetHash,
      profileSetHash: profiles.profileSetHash,
      populationHash: population.populationHash
    },
    entries,
    counts: {
      candidates: entries.length,
      selectedCandidates: entries.filter(
        (entry) => entry.admission.outcome === "selected"
      ).length,
      formations: entries.filter((entry) => entry.formation !== null).length,
      materializedProfiles: entries.filter(
        (entry) => entry.profile?.status === "materialized"
      ).length,
      indeterminateProfiles: entries.filter(
        (entry) => entry.profile?.status === "indeterminate"
      ).length,
      derivedElementLinks: entries.reduce(
        (total, entry) => total + entry.derivedElements.length,
        0
      ),
      distinctDerivedElements: distinctDerivedElements.size
    }
  };
  return deepFreeze({
    ...basis,
    indexHash: hashCanonical(HASH_DOMAINS.PACKAGE_LEVEL_EXPLANATION_INDEX, basis)
  });
}

/** Reproduces a stored explanation index from its complete level basis. */
export function verifyPackageLevelExplanationIndex(
  indexInput,
  loadedPackage,
  runConfig,
  level,
  priorLevels = [],
  options = {}
) {
  const supplied = cloneArtifact(
    indexInput,
    "PACKAGE_LEVEL_EXPLANATION_INDEX_INVALID",
    "Package level explanation index is not canonicalizable."
  );
  const reproduced = createPackageLevelExplanationIndex(
    loadedPackage,
    runConfig,
    level,
    priorLevels,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_INDEX_MISMATCH",
      "Package level explanation index differs from deterministic reproduction.",
      {
        expectedIndexHash: reproduced.indexHash,
        actualIndexHash: supplied?.indexHash ?? null
      }
    );
  }
  return reproduced;
}

function verifySelfContainedIndex(indexInput) {
  const index = cloneArtifact(
    indexInput,
    "PACKAGE_LEVEL_EXPLANATION_INDEX_INVALID",
    "Package level explanation index is not canonicalizable."
  );
  if (
    index?.indexer !== PACKAGE_LEVEL_EXPLANATION_INDEXER_VERSION ||
    index.scope !== PACKAGE_LEVEL_EXPLANATION_INDEX_SCOPE ||
    !isContentHash(index.indexHash) ||
    !Array.isArray(index.entries)
  ) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_INDEX_INVALID",
      "Candidate explanation requires a recognized content-addressed index."
    );
  }
  const { indexHash, ...basis } = index;
  const reproducedHash = hashCanonical(
    HASH_DOMAINS.PACKAGE_LEVEL_EXPLANATION_INDEX,
    basis
  );
  if (indexHash !== reproducedHash) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_INDEX_HASH_MISMATCH",
      "Explanation index content does not match its index hash.",
      { expectedIndexHash: reproducedHash, actualIndexHash: indexHash }
    );
  }
  uniqueMap(index.entries, (entry) => entry.candidateId, "candidateId");
  return index;
}

/** Resolves one immutable candidate explanation from a bound index snapshot. */
export function explainPackageLevelCandidate(indexInput, candidateId) {
  if (!isContentHash(candidateId)) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_CANDIDATE_ID_INVALID",
      "Candidate explanation requires a canonical candidate ID.",
      { candidateId }
    );
  }
  const index = verifySelfContainedIndex(indexInput);
  const entry = index.entries.find((value) => value.candidateId === candidateId);
  if (entry === undefined) {
    fail(
      "PACKAGE_LEVEL_EXPLANATION_CANDIDATE_UNKNOWN",
      "Candidate ID is absent from the bound level explanation index.",
      { candidateId, indexHash: index.indexHash }
    );
  }
  const basis = {
    schemaVersion: "1",
    explainer: PACKAGE_LEVEL_CANDIDATE_EXPLAINER_VERSION,
    indexHash: index.indexHash,
    packageId: index.packageId,
    rulesHash: index.rulesHash,
    runHash: index.runHash,
    levelHash: index.levelHash,
    targetDepth: index.targetDepth,
    candidateId,
    entry
  };
  return deepFreeze({
    ...basis,
    explanationHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_LEVEL_CANDIDATE_EXPLANATION,
      basis
    )
  });
}
