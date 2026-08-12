import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageLevelClosure } from "./package-level-closure.js";
import {
  verifyPackageDepthLevelClosure
} from "./package-depth-level-closure.js";
import { materializePrimitiveDepthPopulation } from "./primitive-depth-population.js";
import { normalizeRunConfig } from "./run-config.js";
import { PACKAGE_SELECTOR_RANKING_LIMITS } from "./package-selector-ranker.js";
import { PACKAGE_SELECTOR_SENSITIVITY_LIMITS } from "./package-selector-sensitivity.js";

export const PACKAGE_DEPTH_SOURCE_SELECTOR_VERSION =
  "package-depth-source-selector-v2";
export const PACKAGE_DEPTH_SOURCE_SELECTOR_SCOPE =
  "verified-contiguous-closed-depth-source-selection-v1";
export const PACKAGE_DEPTH_SOURCE_SELECTION_LIMITS = deepFreeze({
  maxTargetDepth: 64
});
export const PACKAGE_DEPTH_SOURCE_SELECTION_POLICY = deepFreeze({
  availableDepths: "contiguous-zero-through-target-minus-one-v1",
  allBelow: "select-every-available-depth-v1",
  previousOnly: "select-target-minus-one-v1",
  repeatedElement: "minimum-selected-depth-primary-v1",
  profileRepresentative: "lexicographically-smallest-element-id-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "SELECT_PACKAGE_DEPTH_SOURCE",
    message,
    details
  });
}

function normalizeInputs(levelClosures, targetDepth, options) {
  let levels;
  let normalizedOptions;
  try {
    levels = canonicalClone(levelClosures);
    normalizedOptions = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SOURCE_INPUT_INVALID",
      "Source-selection inputs are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!Array.isArray(levels)) {
    fail(
      "PACKAGE_DEPTH_SOURCE_LEVELS_INVALID",
      "Prior level closures must be an array."
    );
  }
  if (!Number.isSafeInteger(targetDepth) || targetDepth < 1) {
    fail(
      "PACKAGE_DEPTH_SOURCE_TARGET_DEPTH_INVALID",
      "Target depth must be a positive safe integer.",
      { targetDepth }
    );
  }
  if (targetDepth > PACKAGE_DEPTH_SOURCE_SELECTION_LIMITS.maxTargetDepth) {
    fail(
      "PACKAGE_DEPTH_SOURCE_TARGET_DEPTH_UNSUPPORTED",
      "Target depth exceeds the supported explicit closure-chain limit.",
      {
        targetDepth,
        maximum: PACKAGE_DEPTH_SOURCE_SELECTION_LIMITS.maxTargetDepth
      }
    );
  }
  if (!isObject(normalizedOptions)) {
    fail(
      "PACKAGE_DEPTH_SOURCE_OPTIONS_INVALID",
      "Source-selection options must be an object."
    );
  }
  const unknown = Object.keys(normalizedOptions)
    .filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_DEPTH_SOURCE_OPTION_UNKNOWN",
      "Unknown source-selection option.",
      { unknown }
    );
  }
  for (const field of [
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates"
  ]) {
    if (
      normalizedOptions[field] !== undefined &&
      (!Number.isSafeInteger(normalizedOptions[field]) ||
        normalizedOptions[field] < 1)
    ) {
      fail(
        "PACKAGE_DEPTH_SOURCE_OPTION_INVALID",
        "Candidate execution options must be positive safe integers.",
        { field, value: normalizedOptions[field] }
      );
    }
  }
  for (const [field, maximum] of [
    ["maxFunctionalEvaluations", PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations],
    [
      "maxSensitivityFunctionalEvaluations",
      PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
    ]
  ]) {
    if (
      normalizedOptions[field] !== undefined &&
      (!Number.isSafeInteger(normalizedOptions[field]) ||
        normalizedOptions[field] < 1 ||
        normalizedOptions[field] > maximum)
    ) {
      fail(
        "PACKAGE_DEPTH_SOURCE_OPTION_INVALID",
        "A selector execution option is outside the supported range.",
        { field, value: normalizedOptions[field], maximum }
      );
    }
  }
  return { levels, normalizedOptions };
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function verifyPriorLevels(levelInputs, loadedPackage, runConfig, options) {
  const byDepth = new Map();
  const ordered = [...levelInputs].sort((left, right) => {
    const leftDepth = isObject(left) && Number.isSafeInteger(left.depth)
      ? left.depth
      : Number.MAX_SAFE_INTEGER;
    const rightDepth = isObject(right) && Number.isSafeInteger(right.depth)
      ? right.depth
      : Number.MAX_SAFE_INTEGER;
    return leftDepth - rightDepth;
  });
  for (const input of ordered) {
    if (!isObject(input) || !Number.isSafeInteger(input.depth) || input.depth < 1) {
      fail(
        "PACKAGE_DEPTH_SOURCE_LEVEL_INVALID",
        "Every prior level must expose a positive safe-integer depth."
      );
    }
    if (byDepth.has(input.depth)) {
      fail(
        "PACKAGE_DEPTH_SOURCE_DUPLICATE_LEVEL",
        "Prior level closures must contain exactly one artifact per depth.",
        { depth: input.depth }
      );
    }
    const priorLevels = [...byDepth.values()];
    const level = input.depth === 1
      ? verifyPackageLevelClosure(
          input,
          loadedPackage,
          runConfig,
          options
        )
      : verifyPackageDepthLevelClosure(
          input,
          loadedPackage,
          runConfig,
          priorLevels,
          input.depth,
          options
        );
    if (
      level.status !== "complete" ||
      level.artifacts.population.status !== "complete"
    ) {
      fail(
        "PACKAGE_DEPTH_SOURCE_LEVEL_NOT_COMPLETE",
        "Only a complete prior level can feed the next candidate source population.",
        { depth: level.depth, status: level.status }
      );
    }
    byDepth.set(level.depth, level);
  }
  return byDepth;
}

function requireContiguousLevels(byDepth, targetDepth) {
  const required = [];
  for (let depth = 1; depth < targetDepth; depth += 1) required.push(depth);
  const supplied = [...byDepth.keys()].sort((left, right) => left - right);
  if (
    required.length !== supplied.length ||
    required.some((depth, index) => depth !== supplied[index])
  ) {
    fail(
      "PACKAGE_DEPTH_SOURCE_LEVEL_COVERAGE_INVALID",
      "Prior level closures must cover every completed depth below the target exactly once.",
      { targetDepth, required, supplied }
    );
  }
}

function populationEntries(primitivePopulation, byDepth, targetDepth) {
  const entries = [{
    depth: 0,
    kind: "primitive-depth",
    populationHash: primitivePopulation.populationHash,
    population: primitivePopulation
  }];
  for (let depth = 1; depth < targetDepth; depth += 1) {
    const level = byDepth.get(depth);
    entries.push({
      depth,
      kind: "closed-derived-depth",
      populationHash: level.artifacts.population.populationHash,
      levelHash: level.levelHash,
      runHash: level.run.runHash,
      population: level.artifacts.population
    });
  }
  return entries;
}

function deriveOccurrences(populations) {
  const byElement = new Map();
  for (const entry of populations) {
    for (const element of entry.population.elements) {
      if (!byElement.has(element.id)) byElement.set(element.id, []);
      byElement.get(element.id).push({
        depth: entry.depth,
        populationHash: entry.populationHash
      });
    }
  }
  return [...byElement.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([elementId, appearances]) => ({
      elementId,
      minimumDepth: appearances[0].depth,
      appearances
    }));
}

function selectElements(populations, selectedDepths) {
  const selected = new Set(selectedDepths);
  const byElement = new Map();
  for (const entry of populations) {
    if (!selected.has(entry.depth)) continue;
    for (const element of entry.population.elements) {
      if (!byElement.has(element.id)) byElement.set(element.id, element);
    }
  }
  return [...byElement.values()].sort((left, right) =>
    compareStrings(left.id, right.id));
}

function deriveProfileClasses(elements) {
  const classes = new Map();
  for (const element of elements) {
    const profileHash = element.profile.hash;
    if (!classes.has(profileHash)) classes.set(profileHash, []);
    classes.get(profileHash).push(element.id);
  }
  return [...classes.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([profileHash, membersInput]) => {
      const members = membersInput.sort(compareStrings);
      return {
        profileHash,
        members,
        representativeElementId: members[0]
      };
    });
}

/** Selects a complete source population for one bounded explicit target depth. */
export function selectPackageDepthSourcePopulation(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  options = {}
) {
  const { levels, normalizedOptions } = normalizeInputs(
    levelClosuresInput,
    targetDepth,
    options
  );
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  const primitivePopulation = materializePrimitiveDepthPopulation(
    loadedPackage,
    loadedOptions(normalizedOptions)
  );
  const byDepth = verifyPriorLevels(
    levels,
    loadedPackage,
    runConfig,
    normalizedOptions
  );
  requireContiguousLevels(byDepth, targetDepth);

  const populations = populationEntries(
    primitivePopulation,
    byDepth,
    targetDepth
  );
  const availableDepths = populations.map((entry) => entry.depth);
  const selectedDepths = runConfig.sourceDepths === "all-below"
    ? availableDepths
    : [targetDepth - 1];
  const elements = selectElements(populations, selectedDepths);
  if (elements.length === 0) {
    fail(
      "PACKAGE_DEPTH_SOURCE_SELECTION_EMPTY",
      "The selected source depths contain no elements.",
      { targetDepth, selectedDepths }
    );
  }
  const occurrences = deriveOccurrences(populations);
  const profileClasses = deriveProfileClasses(elements);
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig);
  const basis = {
    schemaVersion: "1",
    selector: PACKAGE_DEPTH_SOURCE_SELECTOR_VERSION,
    scope: PACKAGE_DEPTH_SOURCE_SELECTOR_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash,
    sourceDepths: runConfig.sourceDepths,
    targetDepth,
    availableDepths,
    selectedDepths,
    policy: PACKAGE_DEPTH_SOURCE_SELECTION_POLICY,
    populations,
    occurrences,
    elements,
    elementIds: elements.map((element) => element.id),
    profileClasses,
    counts: {
      availablePopulations: populations.length,
      selectedPopulations: selectedDepths.length,
      availableElements: occurrences.length,
      selectedElements: elements.length,
      profileClasses: profileClasses.length
    }
  };
  return deepFreeze({
    ...basis,
    selectionHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_DEPTH_SOURCE_SELECTION,
      basis
    )
  });
}

/** Reproduces a stored depth-source selection exactly. */
export function verifyPackageDepthSourcePopulation(
  selectionInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(selectionInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SOURCE_ARTIFACT_INVALID",
      "Source-selection artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = selectPackageDepthSourcePopulation(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DEPTH_SOURCE_MISMATCH",
      "Source-selection artifact differs from deterministic reproduction.",
      {
        expectedSelectionHash: reproduced.selectionHash,
        actualSelectionHash: isObject(supplied) &&
          typeof supplied.selectionHash === "string"
          ? supplied.selectionHash
          : null
      }
    );
  }
  return reproduced;
}
