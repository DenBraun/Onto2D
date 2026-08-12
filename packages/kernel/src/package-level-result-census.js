import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyPackageDepthLevelClosure } from "./package-depth-level-closure.js";
import { verifyPackageLevelClosure } from "./package-level-closure.js";

export const PACKAGE_LEVEL_RESULT_CENSUS_VERSION =
  "package-level-result-census-v1";
export const PACKAGE_LEVEL_RESULT_CENSUS_SCOPE =
  "complete-verified-level-result-census-v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PACKAGE_LEVEL_RESULT_CENSUS",
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

function verifyBoundLevel(
  levelInput,
  loadedPackage,
  runConfig,
  priorLevels,
  options
) {
  const supplied = cloneArtifact(
    levelInput,
    "PACKAGE_LEVEL_RESULT_CENSUS_LEVEL_INVALID",
    "Integrated level census requires a canonicalizable level artifact."
  );
  if (!Array.isArray(priorLevels)) {
    fail(
      "PACKAGE_LEVEL_RESULT_CENSUS_PRIOR_LEVELS_INVALID",
      "Integrated level census requires an array of prior levels."
    );
  }
  if (supplied?.closer === "package-level-closure-v1") {
    if (priorLevels.length !== 0) {
      fail(
        "PACKAGE_LEVEL_RESULT_CENSUS_PRIOR_LEVELS_UNEXPECTED",
        "A primitive-to-depth-one level cannot be integrated with prior levels.",
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
    "PACKAGE_LEVEL_RESULT_CENSUS_LEVEL_UNSUPPORTED",
    "Integrated level census supports only verified ordinary or depth-aware level closures.",
    { closer: supplied?.closer ?? null }
  );
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(
      "PACKAGE_LEVEL_RESULT_CENSUS_RECONCILIATION_FAILED",
      "Verified level artifacts do not reconcile at the integrated census boundary.",
      { label, expected, actual }
    );
  }
}

function reconcileLevel(level) {
  const { census, admission, formations, profiles, population } =
    level.artifacts;
  const censusCounts = census.counts;
  const admissionCounts = admission.counts;
  const metricsCounts = level.metrics.counts;

  for (const field of [
    "evaluatedCandidates",
    "predicateRejected",
    "filterIndeterminate",
    "eligibleCandidates"
  ]) {
    assertEqual(admissionCounts[field], censusCounts[field], field);
    assertEqual(metricsCounts[field], admissionCounts[field], `metrics.${field}`);
  }
  for (const field of [
    "selectorExcluded",
    "selectionIndeterminate",
    "selectedCandidates",
    "finalIndeterminate"
  ]) {
    assertEqual(metricsCounts[field], admissionCounts[field], `metrics.${field}`);
  }
  assertEqual(
    formations.counts.selectedFormations,
    admissionCounts.selectedCandidates,
    "selectedFormations"
  );
  assertEqual(
    profiles.counts.selectedFormations,
    formations.counts.selectedFormations,
    "profileSelectedFormations"
  );
  assertEqual(
    population.counts.selectedFormations,
    formations.counts.selectedFormations,
    "populationSelectedFormations"
  );
  assertEqual(
    metricsCounts.selectedFormations,
    formations.counts.selectedFormations,
    "metrics.selectedFormations"
  );
  assertEqual(
    metricsCounts.materializedProfiles,
    profiles.counts.materializedProfiles,
    "metrics.materializedProfiles"
  );
  assertEqual(
    metricsCounts.uniqueElements,
    population.counts.uniqueElements,
    "metrics.uniqueElements"
  );
  assertEqual(
    metricsCounts.alternateDerivations,
    population.counts.alternateDerivations,
    "metrics.alternateDerivations"
  );
  assertEqual(
    population.elements.length,
    population.counts.uniqueElements,
    "population.elements"
  );
  assertEqual(
    admission.selectorCensus.length,
    level.execution.selectorCount,
    "selectorCount"
  );
  assertEqual(
    census.targetDepth,
    level.depth,
    "targetDepth"
  );
  for (const [field, actual, expected] of [
    ["booleanSelectivity", level.metrics.booleanSelectivity, census.booleanSelectivity],
    ["selectionRetention", level.metrics.selectionRetention, admission.selectionRetention],
    ["overallRetention", level.metrics.overallRetention, admission.overallRetention]
  ]) {
    assertEqual(actual, expected, field);
  }
  if (canonicalize(level.metrics.selectorCensus) !== canonicalize(admission.selectorCensus)) {
    fail(
      "PACKAGE_LEVEL_RESULT_CENSUS_RECONCILIATION_FAILED",
      "Verified level selector census differs from its admission source.",
      { label: "selectorCensus" }
    );
  }
}

function integratedCounts(level) {
  const { census, admission, formations, profiles, population } =
    level.artifacts;
  return {
    generatedBeforeCanonicalization:
      census.counts.generatedBeforeCanonicalization,
    canonicalCandidates: census.counts.canonicalCandidates,
    evaluatedCandidates: admission.counts.evaluatedCandidates,
    predicateRejected: admission.counts.predicateRejected,
    filterIndeterminate: admission.counts.filterIndeterminate,
    eligibleCandidates: admission.counts.eligibleCandidates,
    selectorExcluded: admission.counts.selectorExcluded,
    selectionIndeterminate: admission.counts.selectionIndeterminate,
    selectedCandidates: admission.counts.selectedCandidates,
    finalIndeterminate: admission.counts.finalIndeterminate,
    selectedFormations: formations.counts.selectedFormations,
    materializedProfiles: profiles.counts.materializedProfiles,
    indeterminateProfiles: profiles.counts.indeterminateProfiles,
    admittedElements: population.counts.uniqueElements,
    alternateDerivations: population.counts.alternateDerivations
  };
}

/** Integrates every final census field from one exactly replayed closed level. */
export function createPackageLevelResultCensus(
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
  reconcileLevel(verified);
  const { census, admission, formations, profiles, population } =
    verified.artifacts;
  const basis = {
    schemaVersion: "1",
    integrator: PACKAGE_LEVEL_RESULT_CENSUS_VERSION,
    scope: PACKAGE_LEVEL_RESULT_CENSUS_SCOPE,
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
    counts: integratedCounts(verified),
    selectivity: {
      boolean: census.booleanSelectivity,
      variational: admission.selectorCensus.map((entry) => ({
        selectorId: entry.selectorId,
        value: entry.variationalSelectivity
      })),
      selectionRetention: admission.selectionRetention,
      overallRetention: admission.overallRetention,
      indeterminateRatio: admission.indeterminateRatio
    },
    predicateCensus: census.census,
    selectorCensus: admission.selectorCensus,
    admittedElementIds: population.elements.map((element) => element.id),
    baseline: verified.baseline,
    interpretation: {
      level: verified.interpretation,
      local: census.interpretation,
      admission: admission.interpretation,
      selectors: admission.selectorCensus.map((entry) => ({
        selectorId: entry.selectorId,
        ...entry.interpretation
      }))
    }
  };
  return deepFreeze({
    ...basis,
    resultCensusHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_LEVEL_RESULT_CENSUS,
      basis
    )
  });
}

/** Reproduces a stored integrated level census exactly. */
export function verifyPackageLevelResultCensus(
  censusInput,
  loadedPackage,
  runConfig,
  level,
  priorLevels = [],
  options = {}
) {
  const supplied = cloneArtifact(
    censusInput,
    "PACKAGE_LEVEL_RESULT_CENSUS_INVALID",
    "Integrated level census must be a canonicalizable artifact."
  );
  const reproduced = createPackageLevelResultCensus(
    loadedPackage,
    runConfig,
    level,
    priorLevels,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_LEVEL_RESULT_CENSUS_MISMATCH",
      "Integrated level census differs from deterministic reproduction.",
      {
        expectedResultCensusHash: reproduced.resultCensusHash,
        actualResultCensusHash:
          isObject(supplied) && typeof supplied.resultCensusHash === "string"
            ? supplied.resultCensusHash
            : null
      }
    );
  }
  return reproduced;
}
