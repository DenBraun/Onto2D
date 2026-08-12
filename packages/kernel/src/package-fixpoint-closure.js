import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { DEFAULT_GRAPH_CANONICALIZATION_LIMITS } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  createPreparedPackageCandidateFilterSession
} from "./package-candidate-filter.js";
import {
  derivePackageProfileClasses,
  derivePackageCandidateVariants,
  enumeratePackageSkeletons,
  maximumPackageGeneratedEdges,
  normalizePackageCandidateExecutionOptions,
  validatePackageCanonicalizationPreflight,
  validateSupportedPackageGenerationConfig
} from "./package-candidate-generator.js";
import {
  constructVerifiedPackageCohorts
} from "./package-cohort-partitioner.js";
import {
  materializeVerifiedPackageDerivedDepthPopulation
} from "./package-derived-depth-population.js";
import {
  extractVerifiedPackageDerivedProfiles
} from "./package-derived-profiles.js";
import {
  createPreparedPackageFunctionalEvaluationSession
} from "./package-functional-evaluator.js";
import {
  finalizePackageLevelExecution,
  interpretPackageLevel,
  normalizePackageLevelClosureOptions,
  preflightPackageLevelExecution
} from "./package-level-closure.js";
import {
  evaluateVerifiedPackageNullModelBaseline
} from "./package-null-model-baseline.js";
import {
  createVerifiedPackageNullModelPlan
} from "./package-null-model-plan.js";
import {
  createVerifiedPackageNullModelProposals
} from "./package-null-model-proposals.js";
import {
  evaluateVerifiedPackageNullModelTrialCensuses
} from "./package-null-model-trial-census.js";
import {
  evaluateVerifiedPackageNullModelTrialSelections
} from "./package-null-model-trial-selection.js";
import {
  materializeVerifiedPackageSelectedFormations
} from "./package-selected-formations.js";
import {
  admitVerifiedPackageSelectors
} from "./package-selector-admission.js";
import {
  normalizePackageSelectorRankingOptions,
  rankVerifiedPackageSelector
} from "./package-selector-ranker.js";
import {
  evaluateVerifiedPackageSelectorSensitivity,
  normalizePackageSelectorSensitivityOptions
} from "./package-selector-sensitivity.js";
import { materializePrimitiveDepthPopulation } from "./primitive-depth-population.js";
import { normalizeRunConfig } from "./run-config.js";
import { materializeRunAxis } from "./run-axis.js";
import {
  enumerateBoundCandidatesWithProfileComposition
} from "./package-profile-composition.js";

export const PACKAGE_CURRENT_LEVEL_SOURCE_SELECTOR_VERSION =
  "package-current-level-source-selector-v1";
export const PACKAGE_CURRENT_LEVEL_CANDIDATE_BINDER_VERSION =
  "package-current-level-candidate-binding-v2";
export const PACKAGE_CURRENT_LEVEL_CANDIDATE_GENERATOR_VERSION =
  "package-current-level-candidate-generator-v3";
export const PACKAGE_CURRENT_LEVEL_CANDIDATE_FILTER_VERSION =
  "package-current-level-candidate-filter-evaluator-v1";
export const PACKAGE_CURRENT_LEVEL_CENSUS_VERSION =
  "package-current-level-candidate-census-evaluator-v1";
export const PACKAGE_CURRENT_LEVEL_ROUND_VERSION =
  "package-current-level-fixpoint-round-v2";
export const PACKAGE_CURRENT_LEVEL_POPULATION_VERSION =
  "package-current-level-fixpoint-population-v1";
export const PACKAGE_CURRENT_LEVEL_CLOSURE_VERSION =
  "package-current-level-fixpoint-closure-v2";
export const PACKAGE_FIXPOINT_LADDER_CLOSURE_VERSION =
  "package-fixpoint-ladder-closure-v1";

export const PACKAGE_CURRENT_LEVEL_FIXPOINT_POLICY = deepFreeze({
  initialCurrentPopulation: "empty-v1",
  roundSource: "selected-below-depths-plus-previous-current-set-v1",
  accumulation: "canonical-element-id-monotone-union-v1",
  convergence: "first-round-with-no-new-elements-v1",
  exhaustion: "indeterminate-without-final-population-v1",
  nullModels: "independent-current-round-carrier-v1",
  roundOrder: "ascending-one-based-v1"
});

export const PACKAGE_FIXPOINT_LADDER_POLICY = deepFreeze({
  levelOrder: "ascending-contiguous-depth-v1",
  sourceSemantics: "run-config-all-below-or-previous-only-plus-current-v1",
  elementIdentity: "minimum-derivation-depth-with-all-appearances-v1",
  termination: "requested-depth-or-no-new-elements-or-indeterminate-v1",
  executionCeilings: "independently-preflighted-per-fixpoint-round-v1"
});

const PREDICATE_OUTCOMES = new Set(["pass", "fail", "indeterminate"]);
const OUTCOME_COUNT_FIELDS = Object.freeze({
  pass: "passed",
  fail: "failed",
  indeterminate: "indeterminate"
});
const DOMINANCE_THRESHOLD = 0.9;
const MAX_FIXPOINT_ELEMENT_IDENTITIES = 1_000_000;

function fail(code, stage, message, details = {}) {
  throw new KernelError({ code, stage, message, details });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
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

function rankingOptions(options) {
  return normalizePackageSelectorRankingOptions(selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates",
    "maxFunctionalEvaluations"
  ]));
}

function currentStateHash(loadedPackage, runConfigHash, targetDepth, elements) {
  return hashCanonical(HASH_DOMAINS.PACKAGE_FIXPOINT_CURRENT_STATE, {
    schemaVersion: "1",
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    runConfigHash,
    targetDepth,
    elements
  });
}

function populationReference(entry) {
  return {
    depth: entry.depth,
    kind: entry.kind,
    populationHash: entry.population.populationHash,
    ...(entry.levelHash === undefined ? {} : { levelHash: entry.levelHash }),
    ...(entry.runHash === undefined ? {} : { runHash: entry.runHash })
  };
}

function uniqueElements(populations) {
  const byId = new Map();
  for (const population of populations) {
    for (const element of population.elements) {
      if (!byId.has(element.id)) byId.set(element.id, element);
    }
  }
  return [...byId.values()].sort((left, right) =>
    compareStrings(left.id, right.id));
}

function belowPopulations(primitivePopulation, priorLevels, targetDepth) {
  const entries = [{
    depth: 0,
    kind: "primitive-depth",
    population: primitivePopulation
  }];
  for (let depth = 1; depth < targetDepth; depth += 1) {
    const level = priorLevels[depth - 1];
    if (
      level === undefined ||
      level.depth !== depth ||
      level.closer !== PACKAGE_CURRENT_LEVEL_CLOSURE_VERSION ||
      level.status !== "complete" ||
      level.fixpoint.status !== "converged" ||
      level.artifacts.population.status !== "complete"
    ) {
      fail(
        "FIXPOINT_PRIOR_LEVEL_INVALID",
        "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
        "Every lower current-level fixpoint must be complete, converged, and contiguous.",
        { targetDepth, requiredDepth: depth, actualStatus: level?.status ?? null }
      );
    }
    entries.push({
      depth,
      kind: "closed-current-level-fixpoint",
      levelHash: level.levelHash,
      runHash: level.run.runHash,
      population: level.artifacts.population
    });
  }
  return entries;
}

function selectedBelowEntries(entries, runConfig, targetDepth) {
  return runConfig.sourceDepths === "all-below"
    ? entries
    : entries.filter((entry) => entry.depth === targetDepth - 1);
}

function createCurrentLevelSourceSelection(
  loadedPackage,
  runConfig,
  targetDepth,
  round,
  entries,
  currentElements
) {
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig);
  const selectedEntries = selectedBelowEntries(entries, runConfig, targetDepth);
  const belowElements = uniqueElements(selectedEntries.map((entry) =>
    entry.population));
  if (belowElements.length === 0) {
    fail(
      "FIXPOINT_BELOW_SOURCE_EMPTY",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "The configured below-depth source selection contains no elements.",
      { targetDepth, sourceDepths: runConfig.sourceDepths }
    );
  }
  const elements = uniqueElements([
    { elements: belowElements },
    { elements: currentElements }
  ]);
  if (elements.length > MAX_FIXPOINT_ELEMENT_IDENTITIES) {
    fail(
      "FIXPOINT_SOURCE_ELEMENT_LIMIT_EXCEEDED",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "A current-level source exceeds the published element capacity.",
      {
        targetDepth,
        round,
        elements: elements.length,
        maximum: MAX_FIXPOINT_ELEMENT_IDENTITIES
      }
    );
  }
  const profileClasses = derivePackageProfileClasses(elements);
  const basis = {
    schemaVersion: "1",
    selector: PACKAGE_CURRENT_LEVEL_SOURCE_SELECTOR_VERSION,
    scope: "selected-below-depths-plus-previous-current-set-v1",
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash,
    sourceDepths: runConfig.sourceDepths,
    targetDepth,
    round,
    availableDepths: entries.map((entry) => entry.depth),
    selectedDepths: selectedEntries.map((entry) => entry.depth),
    belowPopulations: entries.map(populationReference),
    selectedBelowPopulationHashes: selectedEntries.map(
      (entry) => entry.population.populationHash
    ),
    belowElementIds: belowElements.map((element) => element.id),
    currentElementIds: currentElements.map((element) => element.id),
    currentPopulationHash: currentStateHash(
      loadedPackage,
      runConfigHash,
      targetDepth,
      currentElements
    ),
    elements,
    elementIds: elements.map((element) => element.id),
    profileClasses,
    policy: {
      belowSelection: "run-config-all-below-or-previous-only-v1",
      currentSelection: "previous-round-monotone-current-set-v1",
      duplicateResolution: "canonical-element-id-first-selected-depth-v1",
      profileRepresentative: "lexicographically-smallest-element-id-v1"
    },
    counts: {
      availableBelowPopulations: entries.length,
      selectedBelowPopulations: selectedEntries.length,
      belowElements: belowElements.length,
      currentElements: currentElements.length,
      selectedElements: elements.length,
      profileClasses: profileClasses.length
    }
  };
  return deepFreeze({
    ...basis,
    selectionHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_FIXPOINT_SOURCE_SELECTION,
      basis
    )
  });
}

function createCurrentLevelCandidateBinding(
  loadedPackage,
  runConfig,
  targetDepth,
  round,
  entries,
  currentElements,
  options
) {
  const execution = normalizePackageCandidateExecutionOptions(
    candidateOptions(options)
  );
  const sourcePopulation = createCurrentLevelSourceSelection(
    loadedPackage,
    runConfig,
    targetDepth,
    round,
    entries,
    currentElements
  );
  validateSupportedPackageGenerationConfig(
    { elements: sourcePopulation.elements },
    runConfig,
    loadedPackage.normalized.candidateAttributes
  );
  validatePackageCanonicalizationPreflight(runConfig, execution);
  const { nodeVariants, edgeVariants } = derivePackageCandidateVariants(
    sourcePopulation,
    runConfig,
    loadedPackage.normalized.candidateAttributes
  );
  const canonicalizationLimits = {
    maxNodes: DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxNodes,
    maxEdges: Math.max(
      DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxEdges,
      maximumPackageGeneratedEdges(runConfig),
      1
    ),
    maxSearchStates: execution.maxSearchStates
  };
  const basis = {
    schemaVersion: "1",
    binder: PACKAGE_CURRENT_LEVEL_CANDIDATE_BINDER_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash: sourcePopulation.runConfigHash,
    runConfig,
    targetDepth,
    round,
    bindingPolicy: {
      sourceSelection: "exact-current-level-source-selection-v1",
      elementAlphabet: "all-selected-element-ids-v1",
      profileAlphabet: "one-hash-per-selected-profile-class-v1",
      skeletonAndDecorationBudgets: "explicit-round-execution-v1"
    },
    sourcePopulation,
    enumerationInput: {
      domain: runConfig.countingDomain,
      skeletons: enumeratePackageSkeletons(runConfig.budget.maxNodes),
      nodeVariants,
      edgeVariants,
      graphPolicy: runConfig.graphPolicy
    },
    enumerationOptions: {
      maxEdges: runConfig.budget.maxEdges,
      maxRawCandidates: execution.maxRawCandidates,
      maxCandidates: runConfig.budget.maxCandidates,
      maxDecorationStates: execution.maxDecorationStates,
      canonicalizationLimits
    }
  };
  return deepFreeze({
    ...basis,
    bindingHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_FIXPOINT_CANDIDATE_BINDING,
      basis
    )
  });
}

function countVerdicts(candidateEvaluations) {
  const count = (verdict) => candidateEvaluations
    .filter((entry) => entry.verdict === verdict).length;
  return {
    evaluatedCandidates: candidateEvaluations.length,
    predicateRejected: count("predicate-rejected"),
    filterIndeterminate: count("filter-indeterminate"),
    eligibleCandidates: count("eligible")
  };
}

function predicateCensus(plans, candidateEvaluations) {
  const accumulators = new Map(plans.map((plan) => [plan.predicateId, {
    evaluated: 0,
    passed: 0,
    failed: 0,
    indeterminate: 0,
    exclusivelyRejected: 0
  }]));
  for (const candidate of candidateEvaluations) {
    const seen = new Set();
    for (const entry of candidate.predicateEvaluations) {
      const counts = accumulators.get(entry.predicateId);
      if (
        counts === undefined ||
        seen.has(entry.predicateId) ||
        !PREDICATE_OUTCOMES.has(entry.evaluation.outcome)
      ) {
        fail(
          "FIXPOINT_CENSUS_PREDICATE_MISMATCH",
          "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
          "A current-level filter has an unknown or duplicate predicate outcome."
        );
      }
      seen.add(entry.predicateId);
      counts.evaluated += 1;
      counts[OUTCOME_COUNT_FIELDS[entry.evaluation.outcome]] += 1;
    }
    if (seen.size !== plans.length) {
      fail(
        "FIXPOINT_CENSUS_PREDICATE_MISMATCH",
        "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
        "A current-level filter does not cover every package predicate."
      );
    }
    if (candidate.failedPredicates.length === 1) {
      const counts = accumulators.get(candidate.failedPredicates[0]);
      if (counts === undefined) {
        fail(
          "FIXPOINT_CENSUS_PREDICATE_MISMATCH",
          "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
          "A current-level filter references an unknown failed predicate.",
          {
            candidateId: candidate.formation.candidate.id,
            predicateId: candidate.failedPredicates[0]
          }
        );
      }
      counts.exclusivelyRejected += 1;
    }
  }
  return plans.map((plan) => {
    const counts = accumulators.get(plan.predicateId);
    if (
      counts.evaluated !==
        counts.passed + counts.failed + counts.indeterminate
    ) {
      fail(
        "FIXPOINT_CENSUS_PREDICATE_COUNT_MISMATCH",
        "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
        "Per-predicate current-level census counts do not reconcile.",
        { predicateId: plan.predicateId }
      );
    }
    return {
      predicateId: plan.predicateId,
      ...counts,
      inert: counts.failed === 0,
      dominating: counts.evaluated > 0 &&
        counts.failed / counts.evaluated >= DOMINANCE_THRESHOLD
    };
  }).sort((left, right) => compareStrings(left.predicateId, right.predicateId));
}

function evaluateCurrentLevelCensus(loadedPackage, binding) {
  const { enumeration, profileComposition } =
    enumerateBoundCandidatesWithProfileComposition(binding);
  if (
    enumeration.status !== "complete" ||
    enumeration.interpretable !== true ||
    enumeration.candidateStore.status !== "complete"
  ) {
    fail(
      "FIXPOINT_CENSUS_ENUMERATION_INCOMPLETE",
      "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
      "A fixpoint round requires a complete candidate enumeration.",
      { status: enumeration.status, exhausted: enumeration.budget.exhausted }
    );
  }
  const generation = deepFreeze({
    schemaVersion: "1",
    generator: PACKAGE_CURRENT_LEVEL_CANDIDATE_GENERATOR_VERSION,
    binding,
    enumeration,
    profileComposition
  });
  const session = createPreparedPackageCandidateFilterSession(
    loadedPackage,
    binding,
    {
      evaluator: PACKAGE_CURRENT_LEVEL_CANDIDATE_FILTER_VERSION,
      hashDomain: HASH_DOMAINS.PACKAGE_FIXPOINT_CANDIDATE_FILTER
    }
  );
  const records = [...enumeration.candidateStore.candidates]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId));
  const candidateEvaluations = records.map((record) =>
    session.evaluate(record.candidate));
  candidateEvaluations.forEach((evaluation, index) => {
    if (evaluation.formation.candidate.id !== records[index].candidateId) {
      fail(
        "FIXPOINT_CENSUS_CANDIDATE_MISMATCH",
        "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
        "A filtered current-level candidate differs from its enumerated identity.",
        {
          expectedCandidateId: records[index].candidateId,
          actualCandidateId: evaluation.formation.candidate.id
        }
      );
    }
  });
  const verdictCounts = countVerdicts(candidateEvaluations);
  if (
    verdictCounts.evaluatedCandidates !==
      verdictCounts.predicateRejected +
      verdictCounts.filterIndeterminate +
      verdictCounts.eligibleCandidates ||
    verdictCounts.evaluatedCandidates !== enumeration.counts.canonicalCandidates
  ) {
    fail(
      "FIXPOINT_CENSUS_COUNT_MISMATCH",
      "CENSUS_PACKAGE_CURRENT_LEVEL_CANDIDATES",
      "Current-level census counts do not reconcile with the canonical universe."
    );
  }
  const evaluated = verdictCounts.evaluatedCandidates;
  const booleanSelectivity = evaluated === 0
    ? null
    : verdictCounts.eligibleCandidates / evaluated;
  const indeterminateRatio = evaluated === 0
    ? null
    : verdictCounts.filterIndeterminate / evaluated;
  const threshold = binding.runConfig.indeterminateThreshold;
  const interpretation = evaluated === 0
    ? { status: "empty", reasons: ["no-evaluated-candidates"] }
    : indeterminateRatio > threshold
      ? {
          status: "indeterminate",
          reasons: ["indeterminate-ratio-exceeds-threshold"]
        }
      : { status: "valid", reasons: [] };
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_CURRENT_LEVEL_CENSUS_VERSION,
    scope: "complete-current-level-round-local-filter-census-v1",
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: binding.bindingHash,
    countingDomain: binding.runConfig.countingDomain,
    targetDepth: binding.targetDepth,
    round: binding.round,
    sourcePopulationHash: binding.sourcePopulation.selectionHash,
    dominanceThreshold: DOMINANCE_THRESHOLD,
    indeterminateThreshold: threshold,
    generation,
    candidateEvaluations,
    counts: {
      generatedBeforeCanonicalization: enumeration.counts.generatedCandidates,
      canonicalCandidates: enumeration.counts.canonicalCandidates,
      ...verdictCounts
    },
    booleanSelectivity,
    indeterminateRatio,
    interpretation,
    census: predicateCensus(loadedPackage.predicatePlans, candidateEvaluations)
  };
  return deepFreeze({
    ...basis,
    censusHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_FIXPOINT_CANDIDATE_CENSUS,
      basis
    )
  });
}

function executeSelectors(loadedPackage, census, options) {
  const filterSession = createPreparedPackageCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    {
      evaluator: PACKAGE_CURRENT_LEVEL_CANDIDATE_FILTER_VERSION,
      hashDomain: HASH_DOMAINS.PACKAGE_FIXPOINT_CANDIDATE_FILTER
    }
  );
  const createFunctionalSession = (
    _loadedPackage,
    _binding,
    functionalId
  ) => createPreparedPackageFunctionalEvaluationSession(
    loadedPackage,
    filterSession,
    functionalId
  );
  const normalizedRanking = rankingOptions(options);
  const normalizedSensitivity = normalizePackageSelectorSensitivityOptions(options);
  return loadedPackage.normalized.selectors.map((selector) => {
    const partition = constructVerifiedPackageCohorts(
      loadedPackage,
      census,
      selector.cohortRule
    );
    const ranking = rankVerifiedPackageSelector(
      loadedPackage,
      census,
      partition,
      selector.id,
      normalizedRanking,
      createFunctionalSession
    );
    const sensitivity = evaluateVerifiedPackageSelectorSensitivity(
      loadedPackage,
      census,
      partition,
      ranking,
      normalizedSensitivity,
      createFunctionalSession
    );
    return { selectorId: selector.id, partition, ranking, sensitivity };
  });
}

function executeRoundNullModels(
  loadedPackage,
  runConfig,
  census,
  admission,
  options
) {
  if (runConfig.nullModels.length === 0) {
    return {
      baseline: { status: "not-run", reasons: ["null-models-disabled"] },
      artifacts: null
    };
  }
  const plan = createVerifiedPackageNullModelPlan(
    loadedPackage,
    census,
    candidateOptions(options)
  );
  const proposals = createVerifiedPackageNullModelProposals(
    census,
    plan,
    candidateOptions(options)
  );
  const filterSession = createPreparedPackageCandidateFilterSession(
    loadedPackage,
    census.generation.binding,
    {
      evaluator: PACKAGE_CURRENT_LEVEL_CANDIDATE_FILTER_VERSION,
      hashDomain: HASH_DOMAINS.PACKAGE_FIXPOINT_CANDIDATE_FILTER
    }
  );
  const trialCensuses = evaluateVerifiedPackageNullModelTrialCensuses(
    loadedPackage,
    census,
    proposals,
    filterSession
  );
  const trialSelections = evaluateVerifiedPackageNullModelTrialSelections(
    loadedPackage,
    census,
    trialCensuses,
    filterSession,
    options
  );
  const baseline = evaluateVerifiedPackageNullModelBaseline(
    loadedPackage,
    census,
    admission,
    trialSelections
  );
  return {
    baseline,
    artifacts: { plan, proposals, trialCensuses, trialSelections }
  };
}

function executeRound(
  loadedPackage,
  runConfig,
  targetDepth,
  roundNumber,
  entries,
  currentElements,
  belowElementIds,
  options
) {
  const binding = createCurrentLevelCandidateBinding(
    loadedPackage,
    runConfig,
    targetDepth,
    roundNumber,
    entries,
    currentElements,
    options
  );
  const census = evaluateCurrentLevelCensus(loadedPackage, binding);
  const preflight = preflightPackageLevelExecution(
    loadedPackage,
    runConfig,
    census,
    options,
    true
  );
  const selectorExecutions = executeSelectors(loadedPackage, census, options);
  const execution = finalizePackageLevelExecution(preflight, selectorExecutions);
  const admission = admitVerifiedPackageSelectors(
    loadedPackage,
    census,
    selectorExecutions
  );
  const formations = materializeVerifiedPackageSelectedFormations(
    loadedPackage,
    census,
    admission
  );
  const profiles = extractVerifiedPackageDerivedProfiles(
    loadedPackage,
    census,
    formations
  );
  const population = materializeVerifiedPackageDerivedDepthPopulation(
    loadedPackage,
    census,
    formations,
    profiles
  );
  const nullModels = executeRoundNullModels(
    loadedPackage,
    runConfig,
    census,
    admission,
    options
  );
  const closureInterpretation = interpretPackageLevel(
    admission,
    profiles,
    population,
    nullModels.baseline
  );
  const currentIds = new Set(currentElements.map((element) => element.id));
  const addedElements = closureInterpretation.status === "indeterminate"
    ? []
    : population.elements.filter((element) =>
        !currentIds.has(element.id) && !belowElementIds.has(element.id)
      ).sort((left, right) => compareStrings(left.id, right.id));
  const afterElements = uniqueElements([
    { elements: currentElements },
    { elements: addedElements }
  ]);
  if (afterElements.length > MAX_FIXPOINT_ELEMENT_IDENTITIES) {
    fail(
      "FIXPOINT_CURRENT_ELEMENT_LIMIT_EXCEEDED",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "A current-level round exceeds the published current-set capacity.",
      {
        targetDepth,
        round: roundNumber,
        elements: afterElements.length,
        maximum: MAX_FIXPOINT_ELEMENT_IDENTITIES
      }
    );
  }
  const converged = closureInterpretation.status !== "indeterminate" &&
    addedElements.length === 0;
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_CURRENT_LEVEL_ROUND_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash: binding.runConfigHash,
    targetDepth,
    round: roundNumber,
    sourceSelectionHash: binding.sourcePopulation.selectionHash,
    currentBeforeHash: binding.sourcePopulation.currentPopulationHash,
    currentBeforeElementIds: currentElements.map((element) => element.id),
    artifacts: {
      census,
      admission,
      formations,
      profiles,
      population,
      ...(nullModels.artifacts === null
        ? {}
        : { nullModels: nullModels.artifacts })
    },
    baseline: nullModels.baseline,
    addedElementIds: addedElements.map((element) => element.id),
    currentAfterHash: currentStateHash(
      loadedPackage,
      binding.runConfigHash,
      targetDepth,
      afterElements
    ),
    currentAfterElementIds: afterElements.map((element) => element.id),
    execution,
    converged,
    status: closureInterpretation.status === "indeterminate"
      ? "indeterminate"
      : "complete",
    interpretation: closureInterpretation.status === "indeterminate"
      ? {
          status: "indeterminate",
          reasons: [...closureInterpretation.reasons]
        }
      : converged
        ? { status: "converged", reasons: ["no-new-elements"] }
        : { status: "advanced", reasons: ["new-elements-added"] }
  };
  return {
    artifact: deepFreeze({
      ...basis,
      roundHash: hashCanonical(HASH_DOMAINS.PACKAGE_FIXPOINT_ROUND, basis)
    }),
    addedElements,
    afterElements
  };
}

function mergeTentativePopulation(rounds, currentElements) {
  const currentIds = new Set(currentElements.map((element) => element.id));
  const byId = new Map();
  for (const round of rounds) {
    const population = round.artifacts.population;
    const derivationsById = new Map(population.derivationIndex.map((entry) => [
      entry.elementId,
      entry
    ]));
    for (const element of population.elements) {
      if (!currentIds.has(element.id)) continue;
      const entry = derivationsById.get(element.id);
      if (entry === undefined || entry.derivations.length === 0) {
        fail(
          "FIXPOINT_POPULATION_DERIVATION_MISSING",
          "MATERIALIZE_PACKAGE_CURRENT_LEVEL_POPULATION",
          "A tentative current-level element has no derivation record.",
          { elementId: element.id, round: round.round }
        );
      }
      if (!byId.has(element.id)) byId.set(element.id, []);
      byId.get(element.id).push({
        element,
        round: round.round,
        entry
      });
    }
  }
  const elements = [];
  const derivationIndex = [];
  for (const elementId of [...byId.keys()].sort(compareStrings)) {
    const records = byId.get(elementId);
    const firstDerivationByFormation = new Map();
    for (const record of records) {
      for (const derivation of record.entry.derivations) {
        if (!firstDerivationByFormation.has(derivation.formationHash)) {
          firstDerivationByFormation.set(derivation.formationHash, {
            ...derivation,
            fixpointRound: record.round
          });
        }
      }
    }
    const derivations = [...firstDerivationByFormation.values()].sort((left, right) =>
      compareStrings(left.formationHash, right.formationHash));
    const primary = derivations[0];
    const primaryRecord = records.find(
      (record) => record.entry.primaryFormationHash === primary.formationHash
    );
    if (primaryRecord === undefined) {
      fail(
        "FIXPOINT_POPULATION_PRIMARY_DERIVATION_MISSING",
        "MATERIALIZE_PACKAGE_CURRENT_LEVEL_POPULATION",
        "A tentative current-level element has no primary derivation record.",
        { elementId, primaryFormationHash: primary.formationHash }
      );
    }
    elements.push(primaryRecord.element);
    derivationIndex.push({
      elementId,
      primaryFormationHash: primary.formationHash,
      derivations
    });
  }
  return { elements, derivationIndex };
}

function materializeFixpointPopulation(
  loadedPackage,
  runConfig,
  targetDepth,
  rounds,
  currentElements,
  fixpointStatus
) {
  const tentative = mergeTentativePopulation(rounds, currentElements);
  const converged = fixpointStatus === "converged";
  const finalElements = converged ? tentative.elements : [];
  const finalDerivations = converged ? tentative.derivationIndex : [];
  const tentativeDerivations = tentative.derivationIndex.reduce(
    (sum, entry) => sum + entry.derivations.length,
    0
  );
  const finalDerivationCount = finalDerivations.reduce(
    (sum, entry) => sum + entry.derivations.length,
    0
  );
  const status = !converged
    ? "indeterminate"
    : finalElements.length === 0 ? "empty" : "complete";
  const interpretation = status === "indeterminate"
    ? {
        status: "indeterminate",
        reasons: [fixpointStatus === "exhausted"
          ? "fixpoint-iteration-limit-exhausted"
          : "fixpoint-round-indeterminate"]
      }
    : status === "empty"
      ? { status: "empty", reasons: ["no-materialized-elements"] }
      : { status: "complete", reasons: [] };
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig);
  const basis = {
    schemaVersion: "1",
    materializer: PACKAGE_CURRENT_LEVEL_POPULATION_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    runConfigHash,
    depth: targetDepth,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    maxIterations: runConfig.boundedFixpoint.maxIterations,
    fixpointStatus,
    roundHashes: rounds.map((round) => round.roundHash),
    tentativeElements: tentative.elements,
    tentativeDerivationIndex: tentative.derivationIndex,
    elements: finalElements,
    derivationIndex: finalDerivations,
    counts: {
      rounds: rounds.length,
      tentativeUniqueElements: tentative.elements.length,
      tentativeAlternateDerivations:
        tentativeDerivations - tentative.elements.length,
      uniqueElements: finalElements.length,
      alternateDerivations: finalDerivationCount - finalElements.length
    },
    status,
    interpretation
  };
  return deepFreeze({
    ...basis,
    populationHash: hashCanonical(HASH_DOMAINS.PACKAGE_FIXPOINT_POPULATION, basis)
  });
}

function aggregateRoundExecution(rounds) {
  const fields = [
    "requiredFunctionalEvaluations",
    "usedFunctionalEvaluations",
    "requiredPerturbationSamples",
    "usedPerturbationSamples",
    "requiredSensitivityFunctionalEvaluations",
    "usedSensitivityFunctionalEvaluations"
  ];
  return {
    policy: "independently-preflighted-per-fixpoint-round-v1",
    executedRounds: rounds.length,
    ...Object.fromEntries(fields.map((field) => [
      field,
      rounds.reduce((sum, round) => sum + round.execution[field], 0)
    ]))
  };
}

function levelRunIdentity(loadedPackage, runConfigHash, targetDepth, entries) {
  const basis = {
    schemaVersion: "1",
    kernelVersion: loadedPackage.semanticManifest.kernelVersion,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash,
    targetDepth,
    belowPopulations: entries.map(populationReference),
    roundPolicy: PACKAGE_CURRENT_LEVEL_FIXPOINT_POLICY
  };
  return {
    ...basis,
    runHash: hashCanonical(HASH_DOMAINS.RUN, basis)
  };
}

function closePreparedPackageCurrentLevelFixpoint(
  loadedPackage,
  runConfig,
  priorLevels,
  targetDepth,
  normalizedOptions
) {
  const primitivePopulation = materializePrimitiveDepthPopulation(
    loadedPackage,
    loadedOptions(normalizedOptions)
  );
  const entries = belowPopulations(
    primitivePopulation,
    priorLevels,
    targetDepth
  );
  const selectedEntries = selectedBelowEntries(entries, runConfig, targetDepth);
  const belowElementIds = new Set(uniqueElements(selectedEntries.map(
    (entry) => entry.population
  )).map((element) => element.id));
  let currentElements = [];
  const rounds = [];
  let fixpointStatus = null;
  for (
    let roundNumber = 1;
    roundNumber <= runConfig.boundedFixpoint.maxIterations;
    roundNumber += 1
  ) {
    const result = executeRound(
      loadedPackage,
      runConfig,
      targetDepth,
      roundNumber,
      entries,
      currentElements,
      belowElementIds,
      normalizedOptions
    );
    rounds.push(result.artifact);
    if (result.artifact.status === "indeterminate") {
      fixpointStatus = "round-indeterminate";
      break;
    }
    currentElements = result.afterElements;
    if (result.artifact.converged) {
      fixpointStatus = "converged";
      break;
    }
  }
  if (fixpointStatus === null) fixpointStatus = "exhausted";
  const population = materializeFixpointPopulation(
    loadedPackage,
    runConfig,
    targetDepth,
    rounds,
    currentElements,
    fixpointStatus
  );
  const terminal = rounds.at(-1);
  const converged = fixpointStatus === "converged";
  const status = population.status;
  const interpretation = status === "indeterminate"
    ? { status: "indeterminate", reasons: [...population.interpretation.reasons] }
    : status === "empty"
      ? { status: "empty", reasons: ["no-materialized-elements"] }
      : { status: "complete", reasons: [] };
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig);
  const execution = aggregateRoundExecution(rounds);
  const basis = {
    schemaVersion: "1",
    closer: PACKAGE_CURRENT_LEVEL_CLOSURE_VERSION,
    scope: "bounded-current-level-monotone-closure-v2",
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    run: levelRunIdentity(loadedPackage, runConfigHash, targetDepth, entries),
    depth: targetDepth,
    ...materializeRunAxis(runConfig),
    priorLevels: entries.filter((entry) => entry.depth > 0)
      .map(populationReference),
    countingDomain: runConfig.countingDomain,
    policy: PACKAGE_CURRENT_LEVEL_FIXPOINT_POLICY,
    fixpoint: {
      status: fixpointStatus,
      enabled: true,
      maxIterations: runConfig.boundedFixpoint.maxIterations,
      iterations: rounds.length,
      converged,
      terminalRound: terminal.round,
      terminalRoundHash: terminal.roundHash
    },
    rounds,
    artifacts: {
      census: terminal.artifacts.census,
      admission: terminal.artifacts.admission,
      formations: terminal.artifacts.formations,
      profiles: terminal.artifacts.profiles,
      population,
      ...(terminal.artifacts.nullModels === undefined
        ? {}
        : { nullModels: terminal.artifacts.nullModels })
    },
    metrics: {
      booleanSelectivity: converged
        ? terminal.artifacts.census.booleanSelectivity
        : null,
      selectorCensus: converged
        ? terminal.artifacts.admission.selectorCensus
        : [],
      selectionRetention: converged
        ? terminal.artifacts.admission.selectionRetention
        : null,
      overallRetention: converged
        ? terminal.artifacts.admission.overallRetention
        : null,
      counts: {
        ...terminal.artifacts.admission.counts,
        selectedFormations: terminal.artifacts.formations.counts.selectedFormations,
        materializedProfiles: terminal.artifacts.profiles.counts.materializedProfiles,
        uniqueElements: population.counts.uniqueElements,
        alternateDerivations: population.counts.alternateDerivations,
        tentativeUniqueElements: population.counts.tentativeUniqueElements
      }
    },
    baseline: terminal.baseline,
    execution,
    status,
    interpretation
  };
  return deepFreeze({
    ...basis,
    levelHash: hashCanonical(HASH_DOMAINS.PACKAGE_FIXPOINT_LEVEL_RESULT, basis)
  });
}

function validateFixpointRequest(runConfig, priorLevels, targetDepth) {
  if (runConfig.boundedFixpoint?.enabled !== true) {
    fail(
      "FIXPOINT_MODE_REQUIRED",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "Current-level fixpoint closure requires boundedFixpoint.enabled: true."
    );
  }
  if (!Number.isSafeInteger(targetDepth) || targetDepth < 1 || targetDepth > 64) {
    fail(
      "FIXPOINT_TARGET_DEPTH_INVALID",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "Fixpoint target depth must be a positive safe integer within 64.",
      { targetDepth }
    );
  }
  if (!Array.isArray(priorLevels) || priorLevels.length !== targetDepth - 1) {
    fail(
      "FIXPOINT_PRIOR_LEVEL_COVERAGE_INVALID",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "Prior fixpoint levels must cover every lower positive depth exactly once.",
      { targetDepth, supplied: Array.isArray(priorLevels) ? priorLevels.length : null }
    );
  }
}

/** Closes one current level after exact replay of every supplied lower level. */
export function closePackageCurrentLevelFixpoint(
  loadedPackageInput,
  runConfigInput,
  priorLevelsInput = [],
  targetDepth = 1,
  options = {}
) {
  const normalizedOptions = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  let priorLevels;
  try {
    priorLevels = canonicalClone(priorLevelsInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "FIXPOINT_PRIOR_LEVELS_INVALID",
      "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "Prior fixpoint levels are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  validateFixpointRequest(runConfig, priorLevels, targetDepth);
  const verifiedPriorLevels = [];
  for (let depth = 1; depth < targetDepth; depth += 1) {
    const reproduced = closePreparedPackageCurrentLevelFixpoint(
      loadedPackage,
      runConfig,
      verifiedPriorLevels,
      depth,
      normalizedOptions
    );
    if (canonicalize(priorLevels[depth - 1]) !== canonicalize(reproduced)) {
      fail(
        "FIXPOINT_PRIOR_LEVEL_MISMATCH",
        "CLOSE_PACKAGE_CURRENT_LEVEL_FIXPOINT",
        "A lower fixpoint level differs from deterministic reproduction.",
        {
          depth,
          expectedLevelHash: reproduced.levelHash,
          actualLevelHash: priorLevels[depth - 1]?.levelHash ?? null
        }
      );
    }
    verifiedPriorLevels.push(reproduced);
  }
  return closePreparedPackageCurrentLevelFixpoint(
    loadedPackage,
    runConfig,
    verifiedPriorLevels,
    targetDepth,
    normalizedOptions
  );
}

function primitiveAppearances(population) {
  return population.elements.map((element) => ({
    element,
    appearance: {
      depth: 0,
      populationHash: population.populationHash,
      levelHash: null
    }
  }));
}

function levelAppearances(level) {
  return level.artifacts.population.elements.map((element) => ({
    element,
    appearance: {
      depth: level.depth,
      populationHash: level.artifacts.population.populationHash,
      levelHash: level.levelHash
    }
  }));
}

function addAppearances(index, appearances) {
  let introduced = 0;
  for (const { element, appearance } of appearances) {
    let entry = index.get(element.id);
    if (entry === undefined) {
      if (index.size >= MAX_FIXPOINT_ELEMENT_IDENTITIES) {
        fail(
          "FIXPOINT_LADDER_ELEMENT_LIMIT_EXCEEDED",
          "CLOSE_PACKAGE_FIXPOINT_LADDER",
          "The fixpoint ladder exceeds the published unique-element capacity.",
          { maximum: MAX_FIXPOINT_ELEMENT_IDENTITIES }
        );
      }
      entry = {
        elementId: element.id,
        minimumDepth: appearance.depth,
        element,
        appearances: []
      };
      index.set(element.id, entry);
      introduced += 1;
    }
    entry.appearances.push(appearance);
  }
  return introduced;
}

function aggregateLevelExecution(levels) {
  const fields = [
    "requiredFunctionalEvaluations",
    "usedFunctionalEvaluations",
    "requiredPerturbationSamples",
    "usedPerturbationSamples",
    "requiredSensitivityFunctionalEvaluations",
    "usedSensitivityFunctionalEvaluations"
  ];
  return {
    policy: PACKAGE_FIXPOINT_LADDER_POLICY.executionCeilings,
    executedLevels: levels.length,
    executedRounds: levels.reduce(
      (sum, level) => sum + level.execution.executedRounds,
      0
    ),
    ...Object.fromEntries(fields.map((field) => [
      field,
      levels.reduce((sum, level) => sum + level.execution[field], 0)
    ]))
  };
}

/** Internal dispatcher target for bounded-fixpoint ladder execution. */
export function closePreparedPackageFixpointLadder(
  loadedPackage,
  runConfig,
  depths,
  options
) {
  const primitivePopulation = materializePrimitiveDepthPopulation(
    loadedPackage,
    loadedOptions(options)
  );
  const index = new Map();
  addAppearances(index, primitiveAppearances(primitivePopulation));
  const levels = [];
  const introducedByDepth = [];
  for (let depth = 1; depth <= depths; depth += 1) {
    const level = closePreparedPackageCurrentLevelFixpoint(
      loadedPackage,
      runConfig,
      levels,
      depth,
      options
    );
    levels.push(level);
    const introducedElements = addAppearances(index, levelAppearances(level));
    introducedByDepth.push({
      depth,
      levelHash: level.levelHash,
      populationHash: level.artifacts.population.populationHash,
      populationElements: level.artifacts.population.elements.length,
      introducedElements,
      rederivedElements:
        level.artifacts.population.elements.length - introducedElements
    });
    if (level.status === "indeterminate" || introducedElements === 0) break;
  }
  const last = levels.at(-1);
  const lastIntroduction = introducedByDepth.at(-1);
  const interpretation = last.status === "indeterminate"
    ? {
        status: "indeterminate",
        reasons: ["level-indeterminate"],
        terminalDepth: last.depth
      }
    : lastIntroduction.introducedElements === 0
      ? {
          status: "fixpoint",
          reasons: ["no-new-elements"],
          terminalDepth: last.depth
        }
      : {
          status: "complete",
          reasons: [],
          terminalDepth: last.depth
        };
  const indexed = [...index.values()].sort((left, right) =>
    compareStrings(left.elementId, right.elementId));
  const derivedAppearances = indexed.reduce((sum, entry) =>
    sum + entry.appearances.filter((appearance) => appearance.depth > 0).length,
  0);
  const uniqueDerivedElements = indexed
    .filter((entry) => entry.minimumDepth > 0).length;
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig);
  const basis = {
    schemaVersion: "1",
    closer: PACKAGE_FIXPOINT_LADDER_CLOSURE_VERSION,
    scope: "bounded-current-level-fixpoint-depth-transitions-v1",
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash,
    runConfig,
    requestedDepths: depths,
    policy: PACKAGE_FIXPOINT_LADDER_POLICY,
    primitivePopulation,
    levels,
    introducedByDepth,
    depthIndex: indexed,
    selectivityLadder: levels.map((level) => ({
      depth: level.depth,
      levelHash: level.levelHash,
      fixpointStatus: level.fixpoint.status,
      iterations: level.fixpoint.iterations,
      booleanSelectivity: level.metrics.booleanSelectivity,
      selectorCensus: level.metrics.selectorCensus
    })),
    counts: {
      requestedLevels: depths,
      executedLevels: levels.length,
      executedRounds: levels.reduce(
        (sum, level) => sum + level.fixpoint.iterations,
        0
      ),
      primitiveElements: primitivePopulation.elements.length,
      derivedAppearances,
      uniqueDerivedElements,
      rederivedAppearances: derivedAppearances - uniqueDerivedElements,
      totalUniqueElements: indexed.length
    },
    execution: aggregateLevelExecution(levels),
    status: interpretation.status,
    interpretation
  };
  return deepFreeze({
    ...basis,
    ladderHash: hashCanonical(HASH_DOMAINS.PACKAGE_FIXPOINT_LADDER_RESULT, basis)
  });
}

/** Reproduces one current-level fixpoint closure exactly. */
export function verifyPackageCurrentLevelFixpoint(
  levelInput,
  loadedPackageInput,
  runConfigInput,
  priorLevelsInput = [],
  targetDepth = 1,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(levelInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "FIXPOINT_LEVEL_ARTIFACT_INVALID",
      "VERIFY_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "Current-level fixpoint closure is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = closePackageCurrentLevelFixpoint(
    loadedPackageInput,
    runConfigInput,
    priorLevelsInput,
    targetDepth,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "FIXPOINT_LEVEL_MISMATCH",
      "VERIFY_PACKAGE_CURRENT_LEVEL_FIXPOINT",
      "Current-level fixpoint closure differs from deterministic reproduction.",
      {
        expectedLevelHash: reproduced.levelHash,
        actualLevelHash: supplied?.levelHash ?? null
      }
    );
  }
  return reproduced;
}
