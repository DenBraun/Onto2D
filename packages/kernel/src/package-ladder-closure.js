import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  closePackageDepthLevel
} from "./package-depth-level-closure.js";
import {
  closePreparedPackageFixpointLadder
} from "./package-fixpoint-closure.js";
import { closePackageLevel } from "./package-level-closure.js";
import { materializePrimitiveDepthPopulation } from "./primitive-depth-population.js";
import { normalizeRunConfig } from "./run-config.js";

export const PACKAGE_LADDER_CLOSURE_VERSION = "package-ladder-closure-v1";
export const PACKAGE_LADDER_CLOSURE_SCOPE =
  "bounded-explicit-depth-transitions-v1";
export const PACKAGE_LADDER_CLOSURE_LIMITS = deepFreeze({
  maxDepths: 64
});
export const PACKAGE_LADDER_CLOSURE_POLICY = deepFreeze({
  levelOrder: "ascending-contiguous-depth-v1",
  sourceSemantics: "run-config-all-below-or-previous-only-v1",
  elementIdentity: "minimum-derivation-depth-with-all-appearances-v1",
  termination: "requested-depth-or-no-new-elements-or-indeterminate-v1",
  executionCeilings: "independently-preflighted-per-level-v1"
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
    stage: "CLOSE_PACKAGE_LADDER",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeInputs(depths, options) {
  if (
    !Number.isSafeInteger(depths) ||
    depths < 1 ||
    depths > PACKAGE_LADDER_CLOSURE_LIMITS.maxDepths
  ) {
    fail(
      "PACKAGE_LADDER_DEPTHS_INVALID",
      "Requested ladder depths must be a positive safe integer within the supported limit.",
      { depths, maximum: PACKAGE_LADDER_CLOSURE_LIMITS.maxDepths }
    );
  }
  let normalized;
  try {
    normalized = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_LADDER_OPTIONS_INVALID",
      "Ladder options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(normalized)) {
    fail("PACKAGE_LADDER_OPTIONS_INVALID", "Ladder options must be an object.");
  }
  const unknown = Object.keys(normalized)
    .filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_LADDER_OPTION_UNKNOWN",
      "Unknown ladder-closure option.",
      { unknown }
    );
  }
  return normalized;
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function primitiveAppearance(population) {
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

function depthIndex(index) {
  return [...index.values()]
    .sort((left, right) => compareStrings(left.elementId, right.elementId));
}

function aggregateExecution(levels) {
  const fields = [
    "requiredFunctionalEvaluations",
    "usedFunctionalEvaluations",
    "requiredPerturbationSamples",
    "usedPerturbationSamples",
    "requiredSensitivityFunctionalEvaluations",
    "usedSensitivityFunctionalEvaluations"
  ];
  const totals = Object.fromEntries(fields.map((field) => [
    field,
    levels.reduce((sum, level) => sum + level.execution[field], 0)
  ]));
  return {
    policy: PACKAGE_LADDER_CLOSURE_POLICY.executionCeilings,
    executedLevels: levels.length,
    ...totals
  };
}

function ladderInterpretation(levels, requestedDepths, introducedByDepth) {
  const last = levels.at(-1);
  if (last.status === "indeterminate") {
    return {
      status: "indeterminate",
      reasons: ["level-indeterminate"],
      terminalDepth: last.depth
    };
  }
  if (introducedByDepth.at(-1).introducedElements === 0) {
    return {
      status: "fixpoint",
      reasons: ["no-new-elements"],
      terminalDepth: last.depth
    };
  }
  if (levels.length === requestedDepths) {
    return {
      status: "complete",
      reasons: [],
      terminalDepth: last.depth
    };
  }
  fail(
    "PACKAGE_LADDER_TERMINATION_INVALID",
    "Ladder execution stopped without a declared terminal condition."
  );
}

/** Executes consecutive closure transitions until the request or a terminal. */
export function closePackageLadder(
  loadedPackageInput,
  runConfigInput,
  depths,
  options = {}
) {
  const normalizedOptions = normalizeInputs(depths, options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  if (runConfig.boundedFixpoint?.enabled === true) {
    return closePreparedPackageFixpointLadder(
      loadedPackage,
      runConfig,
      depths,
      normalizedOptions
    );
  }
  const primitivePopulation = materializePrimitiveDepthPopulation(
    loadedPackage,
    loadedOptions(normalizedOptions)
  );
  const index = new Map();
  addAppearances(index, primitiveAppearance(primitivePopulation));
  const levels = [];
  const introducedByDepth = [];
  for (let depth = 1; depth <= depths; depth += 1) {
    const level = depth === 1
      ? closePackageLevel(loadedPackage, runConfig, normalizedOptions)
      : closePackageDepthLevel(
          loadedPackage,
          runConfig,
          levels,
          depth,
          normalizedOptions
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
  const interpretation = ladderInterpretation(
    levels,
    depths,
    introducedByDepth
  );
  const indexed = depthIndex(index);
  const derivedAppearances = indexed.reduce((sum, entry) =>
    sum + entry.appearances.filter((appearance) => appearance.depth > 0).length,
  0);
  const uniqueDerivedElements = indexed
    .filter((entry) => entry.minimumDepth > 0).length;
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig);
  const basis = {
    schemaVersion: "1",
    closer: PACKAGE_LADDER_CLOSURE_VERSION,
    scope: PACKAGE_LADDER_CLOSURE_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash,
    runConfig,
    requestedDepths: depths,
    policy: PACKAGE_LADDER_CLOSURE_POLICY,
    primitivePopulation,
    levels,
    introducedByDepth,
    depthIndex: indexed,
    selectivityLadder: levels.map((level) => ({
      depth: level.depth,
      levelHash: level.levelHash,
      booleanSelectivity: level.metrics.booleanSelectivity,
      selectorCensus: level.metrics.selectorCensus
    })),
    counts: {
      requestedLevels: depths,
      executedLevels: levels.length,
      primitiveElements: primitivePopulation.elements.length,
      derivedAppearances,
      uniqueDerivedElements,
      rederivedAppearances: derivedAppearances - uniqueDerivedElements,
      totalUniqueElements: indexed.length
    },
    execution: aggregateExecution(levels),
    status: interpretation.status,
    interpretation
  };
  return deepFreeze({
    ...basis,
    ladderHash: hashCanonical(HASH_DOMAINS.PACKAGE_LADDER_RESULT, basis)
  });
}

/** Reproduces a stored closure ladder exactly. */
export function verifyPackageLadderClosure(
  ladderInput,
  loadedPackageInput,
  runConfigInput,
  depths,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(ladderInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_LADDER_ARTIFACT_INVALID",
      "Package ladder is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = closePackageLadder(
    loadedPackageInput,
    runConfigInput,
    depths,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_LADDER_MISMATCH",
      "Package ladder differs from deterministic reproduction.",
      {
        expectedLadderHash: reproduced.ladderHash,
        actualLadderHash:
          isObject(supplied) && typeof supplied.ladderHash === "string"
            ? supplied.ladderHash
            : null
      }
    );
  }
  return reproduced;
}
