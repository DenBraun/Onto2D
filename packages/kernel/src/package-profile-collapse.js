import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  PACKAGE_LADDER_CLOSURE_LIMITS,
  closePackageLadder
} from "./package-ladder-closure.js";
import { normalizePackageLevelClosureOptions } from "./package-level-closure.js";
import { normalizeRunConfig } from "./run-config.js";

export const PACKAGE_PROFILE_COLLAPSE_VERSION =
  "package-profile-collapse-evaluator-v1";
export const PACKAGE_PROFILE_COLLAPSE_SCOPE =
  "bounded-exact-vs-profile-projection-v1";
export const PACKAGE_PROFILE_COLLAPSE_POLICY = deepFreeze({
  commonDomain: "profile-quotient",
  projection: "constituent-profile-hash-canonicalization-v1",
  admittedSet: "final-selected-candidates-v1",
  observables:
    "local-predicate-final-selection-and-selector-score-rank-v1",
  error: "projected-symmetric-difference-over-exact-projected-set-v1",
  counterexample: "lexicographically-smallest-projected-candidate-v1"
});
export const PACKAGE_LEVEL_BOUNDARY_DETECTOR_VERSION =
  "package-level-boundary-detector-v1";
export const PACKAGE_LEVEL_BOUNDARY_SCOPE =
  "bounded-profile-collapse-minima-v1";
export const PACKAGE_LEVEL_BOUNDARY_POLICY = deepFreeze({
  transitionOrder: "ascending-target-depth-v1",
  intervalMembership: "target-depth-inclusive-v1",
  minima: "within-tie-tolerance-and-maximum-error-v1",
  noIntervals: "report-global-candidate-minima-without-detection-v1",
  declaration: "uniform-coordinate-or-run-ontology-target-v1",
  mutation: "never-rewrite-declared-coordinates-v1"
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, stage, message, details = {}) {
  throw new KernelError({ code, stage, message, details });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function validateDepths(depths, stage, label = "Requested depth") {
  if (
    !Number.isSafeInteger(depths) ||
    depths < 1 ||
    depths > PACKAGE_LADDER_CLOSURE_LIMITS.maxDepths
  ) {
    fail(
      "PACKAGE_PROFILE_COLLAPSE_DEPTH_INVALID",
      stage,
      `${label} must be a positive safe integer within the ladder limit.`,
      { depths, maximum: PACKAGE_LADDER_CLOSURE_LIMITS.maxDepths }
    );
  }
}

function comparisonRunConfig(runConfig, countingDomain) {
  const value = canonicalClone(runConfig);
  value.countingDomain = countingDomain;
  return normalizeRunConfig(value);
}

function closeComparisonLadders(loadedPackage, runConfig, depths, options) {
  const elementExactConfig = comparisonRunConfig(runConfig, "element-exact");
  const profileQuotientConfig = comparisonRunConfig(
    runConfig,
    "profile-quotient"
  );
  return {
    elementExactConfig,
    profileQuotientConfig,
    elementExact: closePackageLadder(
      loadedPackage,
      elementExactConfig,
      depths,
      options
    ),
    profileQuotient: closePackageLadder(
      loadedPackage,
      profileQuotientConfig,
      depths,
      options
    )
  };
}

function targetLevel(ladder, targetDepth) {
  return ladder.levels.find((level) => level.depth === targetDepth) ?? null;
}

function projectionLimits(level) {
  return level.artifacts.census.generation.binding.enumerationOptions
    .canonicalizationLimits;
}

function projectCandidate(candidate, constituents, graphPolicy, limits) {
  const profiles = new Map(constituents.map((entry) => [
    entry.canonicalNode,
    entry.profileHash
  ]));
  const nodes = candidate.nodes.map((node, index) => {
    const profileHash = profiles.get(index);
    if (profileHash === undefined) {
      fail(
        "PACKAGE_PROFILE_COLLAPSE_CONSTITUENT_MISSING",
        "TEST_PACKAGE_PROFILE_COLLAPSE",
        "A candidate constituent has no profile projection.",
        { candidateId: candidate.id, canonicalNode: index }
      );
    }
    return {
      ref: profileHash,
      ...(node.attrs === undefined ? {} : { attrs: node.attrs })
    };
  });
  const projected = canonicalizeCandidate({
    domain: "profile-quotient",
    nodes,
    edges: candidate.edges.map((edge) => canonicalClone(edge))
  }, {
    policy: graphPolicy,
    limits
  });
  return projected.candidate;
}

function selectorObservation(entry) {
  return {
    selectorId: entry.selectorId,
    outcome: entry.outcome,
    score: entry.score,
    rank: entry.rank,
    sensitivityStatus: entry.sensitivityStatus,
    sensitivityVerdict: entry.sensitivityVerdict
  };
}

function observation(filter, decision) {
  return {
    localVerdict: filter.verdict,
    predicateOutcomes: filter.predicateEvaluations.map((entry) => ({
      predicateId: entry.predicateId,
      outcome: entry.evaluation.outcome
    })),
    finalOutcome: decision.outcome,
    selectorEvaluations: decision.selectorEvaluations.map(selectorObservation)
  };
}

function projectedRows(level) {
  const graphPolicy = level.artifacts.census.generation.binding.runConfig
    .graphPolicy;
  const limits = projectionLimits(level);
  const decisions = new Map(level.artifacts.admission.decisions.map((entry) => [
    entry.candidateId,
    entry
  ]));
  const groups = new Map();
  for (const filter of level.artifacts.census.candidateEvaluations) {
    const sourceCandidate = filter.formation.candidate;
    const decision = decisions.get(sourceCandidate.id);
    if (decision === undefined) {
      fail(
        "PACKAGE_PROFILE_COLLAPSE_DECISION_MISSING",
        "TEST_PACKAGE_PROFILE_COLLAPSE",
        "A candidate filter has no final admission decision.",
        { candidateId: sourceCandidate.id, depth: level.depth }
      );
    }
    const projected = projectCandidate(
      sourceCandidate,
      filter.formation.constituents,
      graphPolicy,
      limits
    );
    if (!groups.has(projected.id)) {
      groups.set(projected.id, {
        projectedCandidateId: projected.id,
        projectedCandidate: projected,
        observations: []
      });
    }
    groups.get(projected.id).observations.push({
      sourceCandidateId: sourceCandidate.id,
      observation: observation(filter, decision)
    });
  }
  return [...groups.values()]
    .map((entry) => {
      entry.observations.sort((left, right) => compareStrings(
        left.sourceCandidateId,
        right.sourceCandidateId
      ));
      return {
        ...entry,
        admitted: entry.observations.some(
          (item) => item.observation.finalOutcome === "selected"
        ),
        internallyConsistent: new Set(entry.observations.map((item) =>
          canonicalize(item.observation)
        )).size <= 1
      };
    })
    .sort((left, right) => compareStrings(
      left.projectedCandidateId,
      right.projectedCandidateId
    ));
}

function pairedRows(exactRows, profileRows) {
  const exact = new Map(exactRows.map((entry) => [
    entry.projectedCandidateId,
    entry
  ]));
  const profile = new Map(profileRows.map((entry) => [
    entry.projectedCandidateId,
    entry
  ]));
  const ids = [...new Set([...exact.keys(), ...profile.keys()])]
    .sort(compareStrings);
  return ids.map((projectedCandidateId) => {
    const exactEntry = exact.get(projectedCandidateId) ?? null;
    const profileEntry = profile.get(projectedCandidateId) ?? null;
    const exactSignature = exactEntry?.internallyConsistent === true
      ? canonicalize(exactEntry.observations[0].observation)
      : null;
    const profileSignature = profileEntry?.internallyConsistent === true
      ? canonicalize(profileEntry.observations[0].observation)
      : null;
    return {
      projectedCandidateId,
      projectedCandidate:
        exactEntry?.projectedCandidate ?? profileEntry.projectedCandidate,
      elementExact: exactEntry,
      profileQuotient: profileEntry,
      crossDomainConsistent:
        exactSignature === null || profileSignature === null
          ? null
          : exactSignature === profileSignature
    };
  });
}

function admittedIds(rows) {
  return rows.filter((entry) => entry.admitted)
    .map((entry) => entry.projectedCandidateId);
}

function difference(left, right) {
  const excluded = new Set(right);
  return left.filter((entry) => !excluded.has(entry));
}

function comparison(exactRows, profileRows) {
  const elementExact = admittedIds(exactRows);
  const profileQuotient = admittedIds(profileRows);
  const elementExactOnly = difference(elementExact, profileQuotient);
  const profileQuotientOnly = difference(profileQuotient, elementExact);
  const intersection = elementExact.filter((entry) =>
    new Set(profileQuotient).has(entry)
  );
  const symmetricDifference = [
    ...elementExactOnly,
    ...profileQuotientOnly
  ].sort(compareStrings);
  return {
    elementExact,
    profileQuotient,
    intersection,
    elementExactOnly,
    profileQuotientOnly,
    symmetricDifference,
    counts: {
      elementExact: elementExact.length,
      profileQuotient: profileQuotient.length,
      intersection: intersection.length,
      elementExactOnly: elementExactOnly.length,
      profileQuotientOnly: profileQuotientOnly.length,
      symmetricDifference: symmetricDifference.length
    },
    collapseError: elementExact.length === 0
      ? null
      : symmetricDifference.length / elementExact.length
  };
}

function counterexample(rows, compared) {
  const mismatch = new Map();
  for (const id of compared.elementExactOnly) mismatch.set(id, "element-exact-only");
  for (const id of compared.profileQuotientOnly) mismatch.set(id, "profile-quotient-only");
  for (const row of rows) {
    if (
      row.elementExact?.internallyConsistent === false ||
      row.profileQuotient?.internallyConsistent === false ||
      row.crossDomainConsistent === false
    ) {
      if (!mismatch.has(row.projectedCandidateId)) {
        mismatch.set(row.projectedCandidateId, "observable-mismatch");
      }
    }
  }
  const first = [...mismatch.keys()].sort(compareStrings)[0];
  if (first === undefined) return null;
  const row = rows.find((entry) => entry.projectedCandidateId === first);
  return {
    projectedCandidateId: first,
    kind: mismatch.get(first),
    projectedCandidate: row.projectedCandidate,
    elementExactObservations: row.elementExact?.observations ?? [],
    profileQuotientObservations: row.profileQuotient?.observations ?? []
  };
}

function unavailableReason(exactLevel, profileLevel) {
  if (exactLevel === null || profileLevel === null) return "target-depth-not-executed";
  return null;
}

function collapseReport(
  loadedPackage,
  pair,
  requestedDepths,
  targetDepth
) {
  const exactLevel = targetLevel(pair.elementExact, targetDepth);
  const profileLevel = targetLevel(pair.profileQuotient, targetDepth);
  const reason = unavailableReason(exactLevel, profileLevel);
  const exactRows = exactLevel === null ? [] : projectedRows(exactLevel);
  const profileRows = profileLevel === null ? [] : projectedRows(profileLevel);
  const rows = pairedRows(exactRows, profileRows);
  const compared = comparison(exactRows, profileRows);
  const smallest = counterexample(rows, compared);
  const status = reason === "target-depth-not-executed"
    ? "truncated"
    : reason === null ? "complete" : "indeterminate";
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_PROFILE_COLLAPSE_VERSION,
    scope: PACKAGE_PROFILE_COLLAPSE_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    requestedDepths,
    targetDepth,
    policy: PACKAGE_PROFILE_COLLAPSE_POLICY,
    runs: {
      elementExact: {
        runConfigHash: pair.elementExact.runConfigHash,
        ladderHash: pair.elementExact.ladderHash,
        levelHash: exactLevel?.levelHash ?? null,
        ladderStatus: pair.elementExact.status,
        levelStatus: exactLevel?.status ?? null
      },
      profileQuotient: {
        runConfigHash: pair.profileQuotient.runConfigHash,
        ladderHash: pair.profileQuotient.ladderHash,
        levelHash: profileLevel?.levelHash ?? null,
        ladderStatus: pair.profileQuotient.status,
        levelStatus: profileLevel?.status ?? null
      }
    },
    projectedCandidates: rows,
    comparison: compared,
    counterexample: smallest,
    verdict: status !== "complete"
      ? "indeterminate"
      : smallest === null ? "equivalent" : "counterexample",
    status,
    interpretation: status === "complete"
      ? { status: "complete", reasons: [] }
      : { status, reasons: [reason] }
  };
  return deepFreeze({
    ...basis,
    collapseHash: hashCanonical(HASH_DOMAINS.PACKAGE_PROFILE_COLLAPSE, basis)
  });
}

/** Compares one bounded target transition in exact and profile domains. */
export function testPackageProfileCollapse(
  loadedPackageInput,
  runConfigInput,
  targetDepth,
  options = {}
) {
  const stage = "TEST_PACKAGE_PROFILE_COLLAPSE";
  validateDepths(targetDepth, stage, "Target depth");
  const normalizedOptions = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  if (runConfig.boundedFixpoint?.enabled === true) {
    fail(
      "PACKAGE_PROFILE_COLLAPSE_FIXPOINT_UNAVAILABLE",
      stage,
      "Profile-collapse comparison does not yet define cumulative cross-round observations."
    );
  }
  const pair = closeComparisonLadders(
    loadedPackage,
    runConfig,
    targetDepth,
    normalizedOptions
  );
  return collapseReport(loadedPackage, pair, targetDepth, targetDepth);
}

/** Reproduces one stored profile-collapse report exactly. */
export function verifyPackageProfileCollapse(
  reportInput,
  loadedPackageInput,
  runConfigInput,
  targetDepth,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(reportInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_PROFILE_COLLAPSE_ARTIFACT_INVALID",
      "TEST_PACKAGE_PROFILE_COLLAPSE",
      "Profile-collapse report is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = testPackageProfileCollapse(
    loadedPackageInput,
    runConfigInput,
    targetDepth,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_PROFILE_COLLAPSE_MISMATCH",
      "TEST_PACKAGE_PROFILE_COLLAPSE",
      "Profile-collapse report differs from deterministic reproduction.",
      {
        expectedCollapseHash: reproduced.collapseHash,
        actualCollapseHash: isObject(supplied) &&
          typeof supplied.collapseHash === "string"
          ? supplied.collapseHash
          : null
      }
    );
  }
  return reproduced;
}

function uniformDeclaredLevel(elements) {
  const levels = [...new Set(elements.flatMap((element) =>
    Number.isSafeInteger(element.ontologyCoordinate?.level)
      ? [element.ontologyCoordinate.level]
      : []
  ))];
  return levels.length === 1 ? levels[0] : null;
}

function declaredLevelAt(pair, runConfig, depth) {
  if (depth === 0) {
    return uniformDeclaredLevel(pair.elementExact.primitivePopulation.elements);
  }
  const level = targetLevel(pair.elementExact, depth);
  if (level !== null) {
    const declared = uniformDeclaredLevel(level.artifacts.population.elements);
    if (declared !== null) return declared;
  }
  return runConfig.ontologyTarget?.level ?? null;
}

function searchGroups(points, policy) {
  if (policy.searchIntervals === undefined || policy.searchIntervals.length === 0) {
    return [points];
  }
  return policy.searchIntervals.map((interval) => points.filter((point) =>
    point.toDepth >= interval.fromDepth && point.toDepth <= interval.toDepth
  ));
}

function candidateMinima(points, policy) {
  const selected = new Set();
  for (const group of searchGroups(points, policy)) {
    const comparable = group.filter((point) =>
      point.status === "complete" && point.collapseError !== null
    );
    if (comparable.length === 0) continue;
    const minimum = Math.min(...comparable.map((point) => point.collapseError));
    for (const point of comparable) {
      if (
        point.collapseError <= policy.maximumCollapseError &&
        point.collapseError <= minimum + policy.tieTolerance
      ) {
        selected.add(point.toDepth);
      }
    }
  }
  return selected;
}

function reportStatus(points) {
  if (points.some((point) => point.status === "indeterminate")) {
    return "indeterminate";
  }
  if (points.some((point) => point.status === "truncated")) return "truncated";
  return "complete";
}

/** Detects bounded collapse minima without mutating declared ontology axes. */
export function detectPackageLevelBoundaries(
  loadedPackageInput,
  runConfigInput,
  depths,
  options = {}
) {
  const stage = "DETECT_PACKAGE_LEVEL_BOUNDARIES";
  validateDepths(depths, stage, "Boundary-search depths");
  const normalizedOptions = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  const detection = runConfig.levelBoundaryPolicy;
  if (detection === undefined || detection.enabled !== true) {
    fail(
      "PACKAGE_LEVEL_BOUNDARY_POLICY_REQUIRED",
      stage,
      "Level-boundary detection requires an enabled frozen policy."
    );
  }
  if (runConfig.boundedFixpoint?.enabled === true) {
    fail(
      "PACKAGE_LEVEL_BOUNDARY_FIXPOINT_UNAVAILABLE",
      stage,
      "Level-boundary detection does not yet define cumulative cross-round collapse observations."
    );
  }
  const pair = closeComparisonLadders(
    loadedPackage,
    runConfig,
    depths,
    normalizedOptions
  );
  const reports = Array.from({ length: depths }, (_, index) =>
    collapseReport(loadedPackage, pair, depths, index + 1)
  );
  const preliminary = reports.map((report) => {
    const before = declaredLevelAt(pair, runConfig, report.targetDepth - 1);
    const after = declaredLevelAt(pair, runConfig, report.targetDepth);
    return {
      fromDepth: report.targetDepth - 1,
      toDepth: report.targetDepth,
      depthBasis: report.depthBasis,
      collapseHash: report.collapseHash,
      collapseError: report.comparison.collapseError,
      declaredLevelBefore: before,
      declaredLevelAfter: after,
      declaredBoundary: before !== null && after !== null && before !== after,
      status: report.status,
      verdict: report.verdict
    };
  });
  const minima = candidateMinima(preliminary, detection);
  const hasIntervals = detection.searchIntervals !== undefined &&
    detection.searchIntervals.length > 0;
  const points = preliminary.map((point) => {
    const candidateMinimum = minima.has(point.toDepth);
    const detectedBoundary = hasIntervals && candidateMinimum;
    const hasDeclaration = point.declaredLevelBefore !== null &&
      point.declaredLevelAfter !== null;
    return {
      ...point,
      candidateMinimum,
      detectedBoundary,
      matchesDeclaration: hasDeclaration
        ? detectedBoundary === point.declaredBoundary
        : null
    };
  });
  const status = reportStatus(points);
  const detectedDepths = points.filter((point) => point.detectedBoundary)
    .map((point) => point.toDepth);
  const candidateMinimumDepths = points
    .filter((point) => point.candidateMinimum)
    .map((point) => point.toDepth);
  const declaredDepths = points.filter((point) => point.declaredBoundary)
    .map((point) => point.toDepth);
  const notes = [
    "computed-boundaries-do-not-mutate-declared-ontology-coordinates",
    ...(hasIntervals
      ? ["detections-require-frozen-search-interval-minima"]
      : ["no-search-intervals-candidate-minima-only"])
  ];
  const basis = {
    schemaVersion: "1",
    detector: PACKAGE_LEVEL_BOUNDARY_DETECTOR_VERSION,
    scope: PACKAGE_LEVEL_BOUNDARY_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    requestedDepths: depths,
    runConfigHash: hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig),
    policy: PACKAGE_LEVEL_BOUNDARY_POLICY,
    detectionPolicy: detection,
    comparisonLadders: {
      elementExact: pair.elementExact.ladderHash,
      profileQuotient: pair.profileQuotient.ladderHash
    },
    points,
    candidateMinimumDepths,
    detectedDepths,
    declaredDepths,
    status,
    interpretation: status === "complete"
      ? { status: "complete", reasons: [] }
      : { status, reasons: [`collapse-${status}`] },
    notes
  };
  return deepFreeze({
    ...basis,
    boundaryHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_LEVEL_BOUNDARY_REPORT,
      basis
    )
  });
}

/** Reproduces one stored level-boundary report exactly. */
export function verifyPackageLevelBoundaries(
  reportInput,
  loadedPackageInput,
  runConfigInput,
  depths,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(reportInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_LEVEL_BOUNDARY_ARTIFACT_INVALID",
      "DETECT_PACKAGE_LEVEL_BOUNDARIES",
      "Level-boundary report is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = detectPackageLevelBoundaries(
    loadedPackageInput,
    runConfigInput,
    depths,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_LEVEL_BOUNDARY_MISMATCH",
      "DETECT_PACKAGE_LEVEL_BOUNDARIES",
      "Level-boundary report differs from deterministic reproduction.",
      {
        expectedBoundaryHash: reproduced.boundaryHash,
        actualBoundaryHash: isObject(supplied) &&
          typeof supplied.boundaryHash === "string"
          ? supplied.boundaryHash
          : null
      }
    );
  }
  return reproduced;
}
