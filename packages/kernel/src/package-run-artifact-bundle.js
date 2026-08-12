import {
  canonicalBytes,
  canonicalClone,
  canonicalize,
  deepFreeze
} from "./canonical.js";
import { KernelError } from "./errors.js";
import {
  HASH_DOMAINS,
  hashArtifactBytes,
  hashCanonical,
  isContentHash
} from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS,
  normalizePackageCandidateExecutionOptions
} from "./package-candidate-generator.js";
import { verifyPackageDepthLevelClosure } from "./package-depth-level-closure.js";
import {
  createPackageLevelExplanationIndex,
  explainPackageLevelCandidate
} from "./package-level-explanation-index.js";
import {
  normalizePackageLevelClosureOptions,
  verifyPackageLevelClosure
} from "./package-level-closure.js";
import { createPackageLevelResultCensus } from "./package-level-result-census.js";
import { PACKAGE_SELECTOR_RANKING_LIMITS } from "./package-selector-ranker.js";
import { PACKAGE_SELECTOR_SENSITIVITY_LIMITS } from "./package-selector-sensitivity.js";
import { normalizeRunConfig } from "./run-config.js";

export const PACKAGE_RUN_ARTIFACT_BUNDLE_VERSION =
  "package-run-artifact-bundle-v1";
export const PACKAGE_RUN_ARTIFACT_BUNDLE_SCOPE =
  "complete-verified-level-chain-artifacts-v1";
export const PACKAGE_RUN_SEMANTIC_MANIFEST_VERSION =
  "package-run-semantic-manifest-v1";
export const PACKAGE_RUN_ARTIFACT_MATERIALIZER_VERSION =
  "package-run-artifact-materializer-v1";
export const PACKAGE_RUN_ARTIFACT_STORE_VERSION =
  "package-run-artifact-store-v1";
export const PACKAGE_RUN_ARTIFACT_STORE_SCOPE =
  "externally-bound-verified-run-bundle-index-v1";
export const PACKAGE_RUN_CANDIDATE_EXPLAINER_VERSION =
  "package-run-candidate-explainer-v1";
export const PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS = deepFreeze({
  maxBundles: 100,
  maxLevels: 64,
  maxArtifacts: 4096
});

const JSON_MEDIA_TYPE = "application/json";
const EXPECTED_STORE_OPTION_FIELDS = new Set(["expectedKernelVersion"]);
const VERIFIED_BUNDLES = new WeakSet();
const VERIFIED_STORES = new WeakSet();

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PACKAGE_RUN_ARTIFACT_BUNDLE",
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

function selectFields(value, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    value[field] === undefined ? [] : [[field, value[field]]]
  ));
}

function resolvedExecutionOptions(loadedPackage, options) {
  const normalized = normalizePackageLevelClosureOptions(options);
  const candidate = normalizePackageCandidateExecutionOptions(selectFields(
    normalized,
    [
      "kernelVersion",
      "maxRawCandidates",
      "maxDecorationStates",
      "maxSearchStates"
    ]
  ));
  return {
    kernelVersion:
      normalized.kernelVersion ?? loadedPackage.semanticManifest.kernelVersion,
    maxRawCandidates:
      candidate.maxRawCandidates ??
      DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS.maxRawCandidates,
    maxDecorationStates:
      candidate.maxDecorationStates ??
      DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS.maxDecorationStates,
    maxSearchStates:
      candidate.maxSearchStates ??
      DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS.maxSearchStates,
    maxFunctionalEvaluations:
      normalized.maxFunctionalEvaluations ??
      PACKAGE_SELECTOR_RANKING_LIMITS.maxFunctionalEvaluations,
    maxSensitivityFunctionalEvaluations:
      normalized.maxSensitivityFunctionalEvaluations ??
      PACKAGE_SELECTOR_SENSITIVITY_LIMITS.maxSensitivityFunctionalEvaluations
  };
}

function verifyLevelChain(
  levelsInput,
  loadedPackage,
  runConfig,
  executionOptions
) {
  if (!Array.isArray(levelsInput) || levelsInput.length < 1) {
    fail(
      "PACKAGE_RUN_ARTIFACT_LEVELS_INVALID",
      "A run artifact bundle requires at least one closed level."
    );
  }
  if (levelsInput.length > PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS.maxLevels) {
    fail(
      "PACKAGE_RUN_ARTIFACT_LEVEL_LIMIT_EXCEEDED",
      "A run artifact bundle exceeds the supported level count.",
      {
        levels: levelsInput.length,
        maximum: PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS.maxLevels
      }
    );
  }
  const levels = [];
  for (let index = 0; index < levelsInput.length; index += 1) {
    const supplied = cloneArtifact(
      levelsInput[index],
      "PACKAGE_RUN_ARTIFACT_LEVEL_INVALID",
      "Every bundled level must be canonicalizable."
    );
    const expectedDepth = index + 1;
    if (supplied?.depth !== expectedDepth) {
      fail(
        "PACKAGE_RUN_ARTIFACT_LEVEL_CHAIN_INVALID",
        "Bundled levels must form one ascending contiguous chain from depth one.",
        { index, expectedDepth, actualDepth: supplied?.depth ?? null }
      );
    }
    const verified = index === 0
      ? verifyPackageLevelClosure(
          supplied,
          loadedPackage,
          runConfig,
          executionOptions
        )
      : verifyPackageDepthLevelClosure(
          supplied,
          loadedPackage,
          runConfig,
          levels,
          expectedDepth,
          executionOptions
        );
    levels.push(verified);
  }
  return levels;
}

function inputHash(kind, value) {
  return hashCanonical(HASH_DOMAINS.PACKAGE_RUN_BUNDLE_INPUT, { kind, value });
}

function artifactReference(path, artifactKind, semanticHash, value, targetDepth = null) {
  const bytes = canonicalBytes(value);
  return {
    artifactKind,
    targetDepth,
    semanticHash,
    ref: {
      path,
      mediaType: JSON_MEDIA_TYPE,
      schemaVersion: value.schemaVersion ?? "1",
      bytes: bytes.byteLength,
      hash: hashArtifactBytes(bytes)
    }
  };
}

function normalizedInputValues(loadedPackage, runConfig) {
  const normalized = loadedPackage.normalized;
  return [
    ["normalized-package", "normalized-input/package.json", loadedPackage.packageId, loadedPackage],
    ["source-artifacts", "normalized-input/source-artifacts.json", inputHash("source-artifacts", normalized.sourceArtifacts), {
      schemaVersion: "1",
      sourceArtifacts: normalized.sourceArtifacts
    }],
    ...(normalized.sourceMigration === undefined ? [] : [[
      "source-migration",
      "normalized-input/source-migration.json",
      loadedPackage.semanticManifest.sourceMigrationHash,
      {
        schemaVersion: "1",
        sourceMigration: normalized.sourceMigration
      }
    ]]),
    ["primitives", "normalized-input/primitives.json", inputHash("primitives", normalized.primitives), {
      schemaVersion: "1",
      primitives: normalized.primitives
    }],
    ["predicates", "normalized-input/predicates.json", inputHash("predicates", normalized.predicates), {
      schemaVersion: "1",
      predicates: normalized.predicates
    }],
    ["functionals", "normalized-input/functionals.json", inputHash("functionals", normalized.functionals), {
      schemaVersion: "1",
      functionals: normalized.functionals
    }],
    ["cohort-rules", "normalized-input/cohort-rules.json", inputHash("cohort-rules", normalized.cohortRules), {
      schemaVersion: "1",
      cohortRules: normalized.cohortRules
    }],
    ["selectors", "normalized-input/selectors.json", inputHash("selectors", normalized.selectors), {
      schemaVersion: "1",
      selectors: normalized.selectors
    }],
    ["claims", "normalized-input/claims.json", inputHash("claims", normalized.claims), {
      schemaVersion: "1",
      claims: normalized.claims
    }],
    ["evidence", "normalized-input/evidence.json", inputHash("evidence", normalized.evidence), {
      schemaVersion: "1",
      evidence: normalized.evidence
    }],
    ["oracle-policy", "normalized-input/oracle-policy.json", inputHash("oracle-policy", normalized.partialOraclePolicy), {
      schemaVersion: "1",
      partialOraclePolicy: normalized.partialOraclePolicy
    }],
    ["ontology-axes", "normalized-input/ontology-axes.json", inputHash("ontology-axes", normalized.ontologyAxes), {
      schemaVersion: "1",
      ontologyAxes: normalized.ontologyAxes
    }],
    ["perturbations", "normalized-input/perturbations.json", inputHash("perturbations", normalized.perturbations), {
      schemaVersion: "1",
      perturbations: normalized.perturbations
    }],
    ["profile-definition", "normalized-input/profile-definition.json", inputHash("profile-definition", normalized.profileDefinition), {
      schemaVersion: "1",
      profileDefinition: normalized.profileDefinition
    }],
    ["identity-policy", "normalized-input/identity-policy.json", loadedPackage.semanticManifest.identityPolicyHash, {
      schemaVersion: "1",
      identityPolicy: normalized.identityPolicy
    }],
    ["run-config", "normalized-input/run-config.json", hashCanonical(HASH_DOMAINS.RUN_CONFIG, runConfig), runConfig]
  ];
}

function levelArtifactValues(levelEntries) {
  return levelEntries.flatMap((entry, index) => {
    const base = `levels/${String(index).padStart(3, "0")}`;
    return [
      ["level-result", `${base}/result.json`, entry.level.levelHash, entry.level, entry.targetDepth],
      ["level-census", `${base}/census.json`, entry.resultCensus.resultCensusHash, entry.resultCensus, entry.targetDepth],
      ["level-explanations", `${base}/explanations.json`, entry.explanationIndex.indexHash, entry.explanationIndex, entry.targetDepth]
    ];
  });
}

function referenceMap(artifacts) {
  return new Map(artifacts.map((entry) => [entry.artifactKind, entry]));
}

function createSemanticManifest(
  loadedPackage,
  runConfig,
  levelEntries,
  inputArtifacts
) {
  const refs = referenceMap(inputArtifacts);
  const target = levelEntries.at(-1);
  const basis = {
    schemaVersion: "1",
    generator: PACKAGE_RUN_SEMANTIC_MANIFEST_VERSION,
    kernelVersion: loadedPackage.semanticManifest.kernelVersion,
    runHash: target.level.run.runHash,
    depthBasisHash: loadedPackage.semanticManifest.depthBasis,
    ...(loadedPackage.semanticManifest.sourceMigrationHash === undefined
      ? {}
      : {
          sourceMigrationHash:
            loadedPackage.semanticManifest.sourceMigrationHash
        }),
    packageId: loadedPackage.packageId,
    primitivesHash: refs.get("primitives").semanticHash,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    functionalsHash: refs.get("functionals").semanticHash,
    cohortRulesHash: refs.get("cohort-rules").semanticHash,
    selectorsHash: refs.get("selectors").semanticHash,
    sensitivityPolicyHash: inputHash(
      "sensitivity-policies",
      loadedPackage.normalized.selectors.map((selector) => ({
        selectorId: selector.id,
        sensitivity: selector.sensitivity
      }))
    ),
    claimsHash: refs.get("claims").semanticHash,
    evidenceHash: refs.get("evidence").semanticHash,
    oraclePolicyHash: refs.get("oracle-policy").semanticHash,
    configHash: refs.get("run-config").semanticHash,
    numericalPolicyHash: inputHash(
      "numerical-policy",
      runConfig.invariantPrecision
    ),
    seed: runConfig.seed,
    targetDepth: target.targetDepth,
    levelRuns: levelEntries.map((entry) => ({
      targetDepth: entry.targetDepth,
      runHash: entry.level.run.runHash,
      levelHash: entry.level.levelHash,
      resultCensusHash: entry.resultCensus.resultCensusHash,
      explanationIndexHash: entry.explanationIndex.indexHash
    })),
    inputArtifacts: inputArtifacts.map((entry) => entry.ref)
  };
  return deepFreeze({
    ...basis,
    manifestHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_RUN_SEMANTIC_MANIFEST,
      basis
    )
  });
}

function buildLevelEntries(loadedPackage, runConfig, levels, executionOptions) {
  return levels.map((level, index) => {
    const priorLevels = levels.slice(0, index);
    return {
      targetDepth: level.depth,
      level,
      resultCensus: createPackageLevelResultCensus(
        loadedPackage,
        runConfig,
        level,
        priorLevels,
        executionOptions
      ),
      explanationIndex: createPackageLevelExplanationIndex(
        loadedPackage,
        runConfig,
        level,
        priorLevels,
        executionOptions
      )
    };
  });
}

/** Builds a self-verifying semantic artifact bundle for one contiguous level chain. */
export function createPackageRunArtifactBundle(
  loadedPackageInput,
  runConfigInput,
  levelsInput,
  options = {}
) {
  const normalizedOptionInput = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectFields(normalizedOptionInput, ["kernelVersion"])
  );
  const executionOptions = resolvedExecutionOptions(
    loadedPackage,
    normalizedOptionInput
  );
  if (executionOptions.kernelVersion !== loadedPackage.semanticManifest.kernelVersion) {
    fail(
      "PACKAGE_RUN_ARTIFACT_KERNEL_VERSION_MISMATCH",
      "Bundle execution options must bind the loaded package kernel version.",
      {
        expected: loadedPackage.semanticManifest.kernelVersion,
        actual: executionOptions.kernelVersion
      }
    );
  }
  const runConfig = normalizeRunConfig(runConfigInput);
  const levels = verifyLevelChain(
    levelsInput,
    loadedPackage,
    runConfig,
    executionOptions
  );
  const levelEntries = buildLevelEntries(
    loadedPackage,
    runConfig,
    levels,
    executionOptions
  );
  const inputValues = normalizedInputValues(loadedPackage, runConfig);
  const inputArtifacts = inputValues.map(([
    artifactKind,
    path,
    semanticHash,
    value
  ]) => artifactReference(path, artifactKind, semanticHash, value));
  const semanticManifest = createSemanticManifest(
    loadedPackage,
    runConfig,
    levelEntries,
    inputArtifacts
  );
  const manifestArtifact = artifactReference(
    "semantic-manifest.json",
    "semantic-manifest",
    semanticManifest.manifestHash,
    semanticManifest
  );
  const levelArtifacts = levelArtifactValues(levelEntries).map(([
    artifactKind,
    path,
    semanticHash,
    value,
    targetDepth
  ]) => artifactReference(
    path,
    artifactKind,
    semanticHash,
    value,
    targetDepth
  ));
  const artifacts = [manifestArtifact, ...inputArtifacts, ...levelArtifacts]
    .sort((left, right) => compareStrings(left.ref.path, right.ref.path));
  if (artifacts.length > PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS.maxArtifacts) {
    fail(
      "PACKAGE_RUN_ARTIFACT_LIMIT_EXCEEDED",
      "A run artifact bundle exceeds the supported artifact count.",
      {
        artifacts: artifacts.length,
        maximum: PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS.maxArtifacts
      }
    );
  }
  const target = levelEntries.at(-1);
  const basis = {
    schemaVersion: "1",
    bundler: PACKAGE_RUN_ARTIFACT_BUNDLE_VERSION,
    scope: PACKAGE_RUN_ARTIFACT_BUNDLE_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash: semanticManifest.configHash,
    runHash: target.level.run.runHash,
    targetDepth: target.targetDepth,
    executionOptions,
    normalizedInput: { loadedPackage, runConfig },
    semanticManifest,
    levels: levelEntries,
    artifacts,
    counts: {
      levels: levelEntries.length,
      runs: levelEntries.length,
      artifacts: artifacts.length,
      candidates: levelEntries.reduce(
        (total, entry) => total + entry.resultCensus.counts.evaluatedCandidates,
        0
      ),
      admittedElements: levelEntries.reduce(
        (total, entry) => total + entry.resultCensus.counts.admittedElements,
        0
      )
    }
  };
  const bundle = deepFreeze({
    ...basis,
    bundleHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_RUN_ARTIFACT_BUNDLE,
      basis
    )
  });
  VERIFIED_BUNDLES.add(bundle);
  return bundle;
}

/** Reproduces an entire serialized run bundle from its embedded semantic inputs. */
export function verifyPackageRunArtifactBundle(bundleInput, options = {}) {
  const normalizedOptions = normalizeStoreOptions(options);
  if (isObject(bundleInput) && VERIFIED_BUNDLES.has(bundleInput)) {
    if (
      normalizedOptions.expectedKernelVersion !== undefined &&
      bundleInput.semanticManifest.kernelVersion !==
        normalizedOptions.expectedKernelVersion
    ) {
      fail(
        "PACKAGE_RUN_ARTIFACT_KERNEL_VERSION_MISMATCH",
        "A run artifact bundle was produced by a different kernel version.",
        {
          expected: normalizedOptions.expectedKernelVersion,
          actual: bundleInput.semanticManifest.kernelVersion
        }
      );
    }
    return bundleInput;
  }
  const supplied = cloneArtifact(
    bundleInput,
    "PACKAGE_RUN_ARTIFACT_BUNDLE_INVALID",
    "A run artifact bundle must be canonicalizable."
  );
  if (!isObject(supplied?.normalizedInput)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_BUNDLE_INPUT_MISSING",
      "A run artifact bundle must embed its normalized package and RunConfig."
    );
  }
  const expectedKernelVersion = normalizedOptions.expectedKernelVersion;
  if (
    expectedKernelVersion !== undefined &&
    supplied.normalizedInput.loadedPackage?.semanticManifest?.kernelVersion !==
      expectedKernelVersion
  ) {
    fail(
      "PACKAGE_RUN_ARTIFACT_KERNEL_VERSION_MISMATCH",
      "A run artifact bundle was produced by a different kernel version.",
      {
        expected: expectedKernelVersion,
        actual:
          supplied.normalizedInput.loadedPackage?.semanticManifest?.kernelVersion ??
          null
      }
    );
  }
  const reproduced = createPackageRunArtifactBundle(
    supplied.normalizedInput.loadedPackage,
    supplied.normalizedInput.runConfig,
    Array.isArray(supplied.levels)
      ? supplied.levels.map((entry) => entry.level)
      : supplied.levels,
    supplied.executionOptions
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_BUNDLE_MISMATCH",
      "Run artifact bundle differs from deterministic reproduction.",
      {
        expectedBundleHash: reproduced.bundleHash,
        actualBundleHash:
          isObject(supplied) && typeof supplied.bundleHash === "string"
            ? supplied.bundleHash
            : null
      }
    );
  }
  VERIFIED_BUNDLES.add(reproduced);
  return reproduced;
}

function bundleArtifactValues(bundle) {
  const values = new Map();
  values.set("semantic-manifest.json", bundle.semanticManifest);
  for (const [artifactKind, path, , value] of normalizedInputValues(
    bundle.normalizedInput.loadedPackage,
    bundle.normalizedInput.runConfig
  )) {
    void artifactKind;
    values.set(path, value);
  }
  for (const [artifactKind, path, , value] of levelArtifactValues(bundle.levels)) {
    void artifactKind;
    values.set(path, value);
  }
  return values;
}

/** Returns the exact canonical bytes named by one verified bundle reference. */
export function materializePackageRunArtifact(bundleInput, path, options = {}) {
  const bundle = verifyPackageRunArtifactBundle(bundleInput, options);
  if (typeof path !== "string" || path.length === 0 || path !== path.trim()) {
    fail(
      "PACKAGE_RUN_ARTIFACT_PATH_INVALID",
      "Bundle artifact lookup requires a normalized non-empty path."
    );
  }
  const artifact = bundle.artifacts.find((entry) => entry.ref.path === path);
  const value = bundleArtifactValues(bundle).get(path);
  if (artifact === undefined || value === undefined) {
    fail(
      "PACKAGE_RUN_ARTIFACT_PATH_UNKNOWN",
      "The requested path is not present in the verified bundle.",
      { path }
    );
  }
  const bytes = canonicalBytes(value);
  const basis = {
    schemaVersion: "1",
    materializer: PACKAGE_RUN_ARTIFACT_MATERIALIZER_VERSION,
    bundleHash: bundle.bundleHash,
    ref: artifact.ref,
    bytesBase64: Buffer.from(bytes).toString("base64")
  };
  return deepFreeze({
    ...basis,
    materializationHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_RUN_ARTIFACT_MATERIALIZATION,
      basis
    )
  });
}

function normalizeStoreOptions(options) {
  const value = cloneArtifact(
    options,
    "PACKAGE_RUN_ARTIFACT_STORE_OPTIONS_INVALID",
    "Artifact-store options must be canonicalizable."
  );
  if (!isObject(value)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_STORE_OPTIONS_INVALID",
      "Artifact-store options must be an object."
    );
  }
  const unknown = Object.keys(value).filter(
    (field) => !EXPECTED_STORE_OPTION_FIELDS.has(field)
  );
  if (unknown.length > 0) {
    fail(
      "PACKAGE_RUN_ARTIFACT_STORE_OPTION_UNKNOWN",
      "Unknown artifact-store option.",
      { unknown }
    );
  }
  if (
    value.expectedKernelVersion !== undefined &&
    (
      typeof value.expectedKernelVersion !== "string" ||
      value.expectedKernelVersion.length === 0 ||
      value.expectedKernelVersion !== value.expectedKernelVersion.trim()
    )
  ) {
    fail(
      "PACKAGE_RUN_ARTIFACT_STORE_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a normalized non-empty string."
    );
  }
  return value;
}

/** Builds an immutable external-store snapshot indexed by every bundled runHash. */
export function createPackageRunArtifactStore(bundlesInput, options = {}) {
  const normalizedOptions = normalizeStoreOptions(options);
  if (!Array.isArray(bundlesInput) || bundlesInput.length < 1) {
    fail(
      "PACKAGE_RUN_ARTIFACT_STORE_BUNDLES_INVALID",
      "A package run artifact store requires at least one bundle."
    );
  }
  if (bundlesInput.length > PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS.maxBundles) {
    fail(
      "PACKAGE_RUN_ARTIFACT_STORE_BUNDLE_LIMIT_EXCEEDED",
      "Artifact store exceeds the supported bundle count.",
      {
        bundles: bundlesInput.length,
        maximum: PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS.maxBundles
      }
    );
  }
  const bundles = bundlesInput.map((bundle) =>
    verifyPackageRunArtifactBundle(bundle, normalizedOptions)
  ).sort((left, right) => compareStrings(left.bundleHash, right.bundleHash));
  const bundleHashes = new Set();
  const runs = new Map();
  for (const bundle of bundles) {
    if (bundleHashes.has(bundle.bundleHash)) {
      fail(
        "PACKAGE_RUN_ARTIFACT_STORE_BUNDLE_DUPLICATE",
        "Artifact store cannot contain a duplicate bundle.",
        { bundleHash: bundle.bundleHash }
      );
    }
    bundleHashes.add(bundle.bundleHash);
    for (const entry of bundle.levels) {
      const runHash = entry.level.run.runHash;
      if (runs.has(runHash)) {
        fail(
          "PACKAGE_RUN_ARTIFACT_STORE_RUN_DUPLICATE",
          "A runHash must resolve to exactly one bundled level.",
          { runHash }
        );
      }
      runs.set(runHash, {
        runHash,
        bundleHash: bundle.bundleHash,
        targetDepth: entry.targetDepth,
        levelHash: entry.level.levelHash,
        resultCensusHash: entry.resultCensus.resultCensusHash,
        explanationIndexHash: entry.explanationIndex.indexHash
      });
    }
  }
  const runIndex = [...runs.values()].sort((left, right) =>
    compareStrings(left.runHash, right.runHash)
  );
  const basis = {
    schemaVersion: "1",
    indexer: PACKAGE_RUN_ARTIFACT_STORE_VERSION,
    scope: PACKAGE_RUN_ARTIFACT_STORE_SCOPE,
    bundles,
    runIndex,
    counts: {
      bundles: bundles.length,
      runs: runIndex.length,
      levels: bundles.reduce((total, bundle) => total + bundle.levels.length, 0),
      artifacts: bundles.reduce(
        (total, bundle) => total + bundle.artifacts.length,
        0
      )
    }
  };
  const store = deepFreeze({
    ...basis,
    storeHash: hashCanonical(HASH_DOMAINS.PACKAGE_RUN_ARTIFACT_STORE, basis)
  });
  VERIFIED_STORES.add(store);
  return store;
}

/** Reproduces every bundle and the complete runHash index in a store snapshot. */
export function verifyPackageRunArtifactStore(storeInput, options = {}) {
  const normalizedOptions = normalizeStoreOptions(options);
  if (isObject(storeInput) && VERIFIED_STORES.has(storeInput)) {
    if (
      normalizedOptions.expectedKernelVersion !== undefined &&
      storeInput.bundles.some((bundle) =>
        bundle.semanticManifest.kernelVersion !==
          normalizedOptions.expectedKernelVersion
      )
    ) {
      fail(
        "PACKAGE_RUN_ARTIFACT_KERNEL_VERSION_MISMATCH",
        "Artifact store contains a bundle produced by a different kernel version.",
        { expected: normalizedOptions.expectedKernelVersion }
      );
    }
    return storeInput;
  }
  const supplied = cloneArtifact(
    storeInput,
    "PACKAGE_RUN_ARTIFACT_STORE_INVALID",
    "A package run artifact store must be canonicalizable."
  );
  const reproduced = createPackageRunArtifactStore(
    Array.isArray(supplied?.bundles) ? supplied.bundles : supplied?.bundles,
    normalizedOptions
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_RUN_ARTIFACT_STORE_MISMATCH",
      "Artifact store differs from deterministic reproduction.",
      {
        expectedStoreHash: reproduced.storeHash,
        actualStoreHash:
          isObject(supplied) && typeof supplied.storeHash === "string"
            ? supplied.storeHash
            : null
      }
    );
  }
  VERIFIED_STORES.add(reproduced);
  return reproduced;
}

function explainFromVerifiedStore(store, runHash, candidateId) {
  if (!isContentHash(runHash)) {
    fail(
      "PACKAGE_RUN_EXPLANATION_RUN_HASH_INVALID",
      "Candidate explanation lookup requires a canonical runHash.",
      { runHash }
    );
  }
  if (!isContentHash(candidateId)) {
    fail(
      "PACKAGE_RUN_EXPLANATION_CANDIDATE_ID_INVALID",
      "Candidate explanation lookup requires a canonical candidate ID.",
      { candidateId }
    );
  }
  const run = store.runIndex.find((entry) => entry.runHash === runHash);
  if (run === undefined) {
    fail(
      "PACKAGE_RUN_EXPLANATION_RUN_UNKNOWN",
      "The requested runHash is not present in the bound artifact store.",
      { runHash }
    );
  }
  const bundle = store.bundles.find(
    (entry) => entry.bundleHash === run.bundleHash
  );
  const level = bundle?.levels.find(
    (entry) => entry.level.run.runHash === runHash
  );
  if (bundle === undefined || level === undefined) {
    fail(
      "PACKAGE_RUN_EXPLANATION_INDEX_INCONSISTENT",
      "Verified artifact-store run index does not resolve to its bundled level.",
      { runHash, bundleHash: run.bundleHash }
    );
  }
  const levelExplanation = explainPackageLevelCandidate(
    level.explanationIndex,
    candidateId
  );
  const basis = {
    schemaVersion: "1",
    explainer: PACKAGE_RUN_CANDIDATE_EXPLAINER_VERSION,
    storeHash: store.storeHash,
    bundleHash: bundle.bundleHash,
    runHash,
    levelHash: level.level.levelHash,
    resultCensusHash: level.resultCensus.resultCensusHash,
    explanationIndexHash: level.explanationIndex.indexHash,
    targetDepth: level.targetDepth,
    candidateId,
    levelExplanation
  };
  return deepFreeze({
    ...basis,
    explanationHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_RUN_CANDIDATE_EXPLANATION,
      basis
    )
  });
}

/** Verifies an external store, then resolves one candidate strictly by runHash. */
export function explainPackageRunCandidate(
  storeInput,
  runHash,
  candidateId,
  options = {}
) {
  const store = verifyPackageRunArtifactStore(storeInput, options);
  return explainFromVerifiedStore(store, runHash, candidateId);
}

/** Verifies a store once and returns a reusable immutable lookup session. */
export function createPackageRunArtifactStoreSession(storeInput, options = {}) {
  const store = verifyPackageRunArtifactStore(storeInput, options);
  return Object.freeze({
    store,
    explain(runHash, candidateId) {
      return explainFromVerifiedStore(store, runHash, candidateId);
    }
  });
}
