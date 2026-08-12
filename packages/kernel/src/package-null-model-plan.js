import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  verifyPackageCandidateCensus
} from "./package-candidate-census.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";

export const PACKAGE_NULL_MODEL_PLAN_VERSION = "package-null-model-plan-v1";
export const PACKAGE_NULL_MODEL_PLAN_LIMITS = deepFreeze({
  maxTrials: 10_000,
  maxCarrierCandidates: 1_000_000
});
export const PACKAGE_NULL_MODEL_RANDOMNESS_POLICY = deepFreeze({
  streamDerivation: "run-seed-model-trial-domain-hash-v1",
  streamIndependence: "model-and-trial-order-independent-v1",
  drawExpansion: "sha256-counter-rejection-sampling-v1"
});
export const PACKAGE_NULL_MODEL_EXECUTION_REQUIREMENTS = deepFreeze({
  localPredicates: "rerun-every-candidate-v1",
  cohorts: "reconstruct-total-partition-per-trial-v1",
  functionals: "reevaluate-every-cohort-member-v1",
  selectors: "rerank-and-readmit-per-trial-v1",
  evidence: "recompute-invalidated-or-indeterminate-v1",
  pooling: "never-across-ontology-gates-or-carrier-populations-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxNullTrials"
]);

const MODEL_CONTRACTS = deepFreeze({
  "role-shuffle": {
    model: "role-shuffle",
    proposal: "uniform-edge-role-multiset-permutation-v1",
    sampling: "candidate-wise-fisher-yates-v1",
    population: "one-proposal-per-carrier-candidate-v1",
    preserves: [
      "candidate-skeleton",
      "edge-directions",
      "structural-attributes",
      "edge-role-multiset",
      "declared-candidate-universe"
    ]
  },
  "degree-rewire": {
    model: "degree-rewire",
    proposal: "role-wise-directed-degree-preserving-valid-swap-v1",
    sampling: "uniform-same-role-edge-pair-v1",
    population: "one-proposal-per-carrier-candidate-v1",
    mixing: {
      swap: "directed-target-swap-v1",
      attemptsPerEdge: 10,
      minimumWhenEligible: 1,
      invalidProposal: "reject-and-retain-current-v1"
    },
    preserves: [
      "candidate-node-multiset",
      "role-wise-directed-degree-sequence",
      "structural-attributes",
      "declared-candidate-universe"
    ]
  },
  uniform: {
    model: "uniform",
    proposal: "exact-uniform-index-from-finite-canonical-universe-v1",
    sampling: "independent-with-replacement-v1",
    population: "carrier-size-proposals-v1",
    preserves: ["declared-candidate-universe", "counting-domain"]
  }
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PLAN_PACKAGE_NULL_MODELS",
    message,
    details
  });
}

function normalizeOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_PLAN_OPTIONS_INVALID",
      "Null-model plan options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_NULL_MODEL_PLAN_OPTIONS_INVALID",
      "Null-model plan options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_NULL_MODEL_PLAN_OPTION_UNKNOWN",
      "Unknown null-model plan option.",
      { unknown }
    );
  }
  const maxNullTrials = value.maxNullTrials ??
    PACKAGE_NULL_MODEL_PLAN_LIMITS.maxTrials;
  if (
    !Number.isSafeInteger(maxNullTrials) ||
    maxNullTrials < 1 ||
    maxNullTrials > PACKAGE_NULL_MODEL_PLAN_LIMITS.maxTrials
  ) {
    fail(
      "PACKAGE_NULL_MODEL_PLAN_LIMIT_INVALID",
      "Null-model trial limit must be a positive integer within the hard limit.",
      {
        maxNullTrials,
        maximum: PACKAGE_NULL_MODEL_PLAN_LIMITS.maxTrials
      }
    );
  }
  return { ...value, maxNullTrials };
}

function selectedOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
}

function loadedOptions(options) {
  return selectedOptions(options, ["kernelVersion"]);
}

function candidateOptions(options) {
  return selectedOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates"
  ]);
}

function ontologyGate(runConfig, targetDepth) {
  return runConfig.ontologyTarget === undefined
    ? {
        kind: "derivation-depth-target-v1",
        targetDepth
      }
    : {
        kind: "run-ontology-target-v1",
        targetDepth,
        ontologyCoordinate: runConfig.ontologyTarget
      };
}

function carrierPopulation(census) {
  const candidateIds = census.candidateEvaluations.map(
    (entry) => entry.formation.candidate.id
  );
  if (candidateIds.length > PACKAGE_NULL_MODEL_PLAN_LIMITS.maxCarrierCandidates) {
    fail(
      "PACKAGE_NULL_MODEL_CARRIER_LIMIT",
      "Null-model carrier population exceeds the hard candidate limit.",
      {
        actual: candidateIds.length,
        maximum: PACKAGE_NULL_MODEL_PLAN_LIMITS.maxCarrierCandidates
      }
    );
  }
  const basis = {
    kind: "complete-canonical-candidate-census-v1",
    runConfigHash: census.generation.binding.runConfigHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    countingDomain: census.countingDomain,
    targetDepth: census.targetDepth,
    sourcePopulationHash: census.sourcePopulationHash,
    candidateIds
  };
  return {
    ...basis,
    carrierHash: hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_CARRIER, basis)
  };
}

function trialRecords(runConfig, carrier, models, maximum) {
  const required = BigInt(models.length) * BigInt(runConfig.budget.nullModelRuns);
  if (required > BigInt(maximum)) {
    fail(
      "PACKAGE_NULL_MODEL_PLAN_TRIAL_LIMIT",
      "Configured null-model trials exceed the execution-plan limit.",
      { required: required.toString(), maximum }
    );
  }
  const trials = [];
  for (const model of models) {
    for (let trialIndex = 0; trialIndex < runConfig.budget.nullModelRuns; trialIndex += 1) {
      const streamBasis = {
        schemaVersion: "1",
        runSeed: runConfig.seed,
        runConfigHash: carrier.runConfigHash,
        carrierHash: carrier.carrierHash,
        model,
        trialIndex
      };
      const streamHash = hashCanonical(
        HASH_DOMAINS.PACKAGE_NULL_MODEL_STREAM,
        streamBasis
      );
      const basis = {
        model,
        trialIndex,
        streamHash,
        carrierHash: carrier.carrierHash
      };
      trials.push({
        ...basis,
        trialId: hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL, basis)
      });
    }
  }
  return trials;
}

/** Builds a complete immutable null-model execution plan from verified inputs. */
export function createVerifiedPackageNullModelPlan(
  loadedPackage,
  census,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const runConfig = census.generation.binding.runConfig;
  const models = [...runConfig.nullModels];
  const runs = runConfig.budget.nullModelRuns;
  if ((models.length === 0) !== (runs === 0)) {
    fail(
      "PACKAGE_NULL_MODEL_CONFIGURATION_INCOMPLETE",
      "Null models and nullModelRuns must be enabled or disabled together.",
      { models, nullModelRuns: runs }
    );
  }
  const carrier = carrierPopulation(census);
  const modelContracts = models.map((model) => MODEL_CONTRACTS[model]);
  const trials = trialRecords(
    runConfig,
    carrier,
    models,
    normalized.maxNullTrials
  );
  const planned = trials.length > 0;
  const basis = {
    schemaVersion: "1",
    planner: PACKAGE_NULL_MODEL_PLAN_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash: census.generation.binding.runConfigHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    ontologyGate: ontologyGate(runConfig, census.targetDepth),
    carrierPopulation: carrier,
    randomnessPolicy: PACKAGE_NULL_MODEL_RANDOMNESS_POLICY,
    executionRequirements: PACKAGE_NULL_MODEL_EXECUTION_REQUIREMENTS,
    modelContracts,
    trials,
    counts: {
      models: models.length,
      trialsPerModel: runs,
      totalTrials: trials.length,
      carrierCandidates: carrier.candidateIds.length
    },
    status: planned ? "planned" : "not-run",
    interpretation: planned
      ? {
          status: "planned",
          reasons: ["trial-execution-and-metric-distributions-pending"]
        }
      : { status: "not-run", reasons: ["null-models-disabled"] }
  };
  return deepFreeze({
    ...basis,
    planHash: hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_PLAN, basis)
  });
}

export function createPackageNullModelPlan(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    candidateOptions(normalized)
  );
  return createVerifiedPackageNullModelPlan(loadedPackage, census, normalized);
}

export function createPackageDepthNullModelPlan(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    candidateOptions(normalized)
  );
  return createVerifiedPackageNullModelPlan(loadedPackage, census, normalized);
}

function verifyPlan(planInput, reproduced) {
  let supplied;
  try {
    supplied = canonicalClone(planInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_PLAN_INVALID",
      "Null-model plan is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NULL_MODEL_PLAN_MISMATCH",
      "Null-model plan differs from deterministic reproduction.",
      {
        expectedPlanHash: reproduced.planHash,
        actualPlanHash: isObject(supplied) && typeof supplied.planHash === "string"
          ? supplied.planHash
          : null
      }
    );
  }
  return reproduced;
}

export function verifyPackageNullModelPlan(
  planInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  options = {}
) {
  return verifyPlan(
    planInput,
    createPackageNullModelPlan(
      loadedPackageInput,
      runConfigInput,
      censusInput,
      options
    )
  );
}

export function verifyPackageDepthNullModelPlan(
  planInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  options = {}
) {
  return verifyPlan(
    planInput,
    createPackageDepthNullModelPlan(
      loadedPackageInput,
      runConfigInput,
      levelClosuresInput,
      targetDepth,
      censusInput,
      options
    )
  );
}
