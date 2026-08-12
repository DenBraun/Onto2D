import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  closePackageDepthLevel,
  closePackageLevel,
  createPackageLevelExplanationIndex,
  explainPackageLevelCandidate,
  hashCanonical,
  loadKernelPackage,
  verifyPackageLevelExplanationIndex
} from "../src/index.js";

function loadedFixture() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "level-explanation-index-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "explanation-source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: {},
      profile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [{
          role: "support",
          polarity: "sym",
          capacity: { min: 0, max: 1 }
        }],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      derivedTypeTags: ["derived"],
      claimRefs: []
    }
  });
}

function runConfig() {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "level-explanation-index-v1",
    invariantPrecision: {
      id: "level-explanation-index-precision-v1",
      decimalPlaces: 6,
      rounding: "half-even",
      summation: "exact-decimal"
    },
    graphPolicy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: [],
      structuralEdgeAttributes: []
    },
    substructurePolicy: {
      id: "level-explanation-index-substructure-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
}

test("level explanation index binds complete candidate-to-element lineage", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const index = createPackageLevelExplanationIndex(loaded, config, level);

  assert.equal(index.targetDepth, 1);
  assert.equal(index.runHash, level.run.runHash);
  assert.equal(index.levelHash, level.levelHash);
  assert.equal(index.counts.candidates, 1);
  assert.equal(index.counts.selectedCandidates, 1);
  assert.equal(index.counts.formations, 1);
  assert.equal(index.counts.materializedProfiles, 1);
  assert.equal(index.counts.derivedElementLinks, 1);
  assert.equal(index.entries[0].filter.verdict, "eligible");
  assert.equal(index.entries[0].admission.outcome, "selected");
  assert.equal(index.entries[0].profile.status, "materialized");
  assert.equal(index.entries[0].derivedElements.length, 1);

  const { indexHash, ...indexBasis } = index;
  assert.equal(
    indexHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_LEVEL_EXPLANATION_INDEX, indexBasis)
  );
  const explanation = explainPackageLevelCandidate(
    index,
    index.entries[0].candidateId
  );
  const { explanationHash, ...explanationBasis } = explanation;
  assert.equal(
    explanationHash,
    hashCanonical(
      HASH_DOMAINS.PACKAGE_LEVEL_CANDIDATE_EXPLANATION,
      explanationBasis
    )
  );
  assert.equal(explanation.entry.filter.filterHash, index.entries[0].filter.filterHash);
  assert.equal(
    verifyPackageLevelExplanationIndex(index, loaded, config, level).indexHash,
    indexHash
  );
});

test("depth-aware explanation indexes replay their prior-level chain fail-closed", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level1 = closePackageLevel(loaded, config);
  const level2 = closePackageDepthLevel(loaded, config, [level1], 2);
  const index = createPackageLevelExplanationIndex(
    loaded,
    config,
    level2,
    [level1]
  );

  assert.equal(index.targetDepth, 2);
  assert.equal(index.counts.candidates, 2);
  assert.equal(index.entries.every((entry) => entry.formation !== null), true);
  assert.equal(
    verifyPackageLevelExplanationIndex(
      index,
      loaded,
      config,
      level2,
      [level1]
    ).indexHash,
    index.indexHash
  );

  const tampered = structuredClone(index);
  tampered.entries[0].admission.outcome = "selector-excluded";
  assert.throws(
    () => verifyPackageLevelExplanationIndex(
      tampered,
      loaded,
      config,
      level2,
      [level1]
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_EXPLANATION_INDEX_MISMATCH"
  );
  assert.throws(
    () => createPackageLevelExplanationIndex(loaded, config, level2, []),
    (error) => error instanceof KernelError
  );
  assert.throws(
    () => explainPackageLevelCandidate(
      index,
      `sha256:${"f".repeat(64)}`
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_LEVEL_EXPLANATION_CANDIDATE_UNKNOWN"
  );
});
