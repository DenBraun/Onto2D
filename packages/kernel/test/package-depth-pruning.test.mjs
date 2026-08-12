import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  auditPackageDepthGeneratorFrontiers,
  auditPackageDepthNodeFrontiers,
  auditPackageDepthPredicateMonotonicity,
  canonicalize,
  closePackageLevel,
  createPackageDepthGeneratorFrontierControllerSession,
  createPackageDepthNodeFrontierControllerSession,
  enumeratePackageDepthCandidates,
  enumeratePackageDepthCandidatesWithPruning,
  enumeratePackageDepthCandidatesWithNodeGrowthPruning,
  enumeratePackageDepthCandidatesWithRecursivePruning,
  hashCanonical,
  loadKernelPackage,
  verifyPackageDepthCandidatesWithPruning,
  verifyPackageDepthCandidatesWithRecursivePruning,
  verifyPackageDepthGeneratorFrontierAudit,
  verifyPackageDepthNodeFrontierAudit,
  verifyPackageDepthCandidatesWithNodeGrowthPruning,
  verifyPackageDepthPredicateMonotonicityAudit
} from "../src/index.js";

function loadedFixture(predicateOverride = null, slotCapacity = 2) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "depth-pruning-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "depth-pruning-source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: {},
      profile: {
        slots: [
          {
            role: "support",
            polarity: "out",
            capacity: { min: 0, max: slotCapacity }
          },
          {
            role: "support",
            polarity: "in",
            capacity: { min: 0, max: slotCapacity }
          }
        ],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }],
    predicates: [{
      id: predicateOverride?.id ?? "no-support",
      phase: "formation",
      monotoneViolation: true,
      referencesDepth: "below",
      expr: predicateOverride?.expr ??
        { op: "countRole", role: "support", max: 0 },
      explain: { pass: "empty", fail: "supported", indeterminate: "unknown" },
      claimRefs: []
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      derivedTypeTags: ["derived"],
      claimRefs: []
    }
  });
}

function runConfig(overrides = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 3,
      maxEdges: 2,
      maxCandidates: 500,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "depth-pruning-fixture-v1",
    invariantPrecision: {
      id: "depth-pruning-precision-v1",
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
      id: "depth-pruning-substructure-v1",
      remove: "nodes-and-edges",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0,
    ...overrides
  };
}

test("depth-aware pre-admission pruning composes with the exact profile-slot universe", () => {
  const loaded = loadedFixture(null, 1);
  const config = runConfig({ profileCompositionPolicy: "profile-slot-gate-v1" });
  const levels = [];
  const targetDepth = 1;
  const options = { samplesPerPredicate: 12 };
  const audit = auditPackageDepthPredicateMonotonicity(
    loaded,
    config,
    levels,
    targetDepth,
    options
  );
  const result = enumeratePackageDepthCandidatesWithPruning(
    loaded,
    config,
    levels,
    targetDepth,
    audit,
    options
  );

  assert.equal(audit.status, "passed");
  assert.equal(audit.targetDepth, targetDepth);
  assert.equal(result.profileComposition.status, "complete");
  assert.equal(result.profileComposition.policy, "profile-slot-gate-v1");
  assert.ok(result.enumeration.counts.compositionExcludedCandidates > 0);
  assert.ok(result.enumeration.counts.preAdmissionPrunedCandidates > 0);
  assert.equal(result.conformance.status, "passed");
  assert.equal(
    result.conformance.eligible.pruningDisabledHash,
    result.conformance.eligible.pruningEnabledHash
  );
  assert.equal(
    verifyPackageDepthCandidatesWithPruning(
      result,
      loaded,
      config,
      levels,
      targetDepth,
      audit,
      options
    ).generationHash,
    result.generationHash
  );
  const frontierAudit = auditPackageDepthGeneratorFrontiers(
    loaded,
    config,
    levels,
    targetDepth,
    audit,
    options
  );
  const recursive = enumeratePackageDepthCandidatesWithRecursivePruning(
    loaded,
    config,
    levels,
    targetDepth,
    audit,
    frontierAudit,
    options
  );
  assert.equal(frontierAudit.profileExtensionUniverse.status, "complete");
  assert.equal(frontierAudit.profileExtensionUniverse.kind, "edge-group");
  assert.ok(
    frontierAudit.profileExtensionUniverse.excludedRawExtensionCandidates > 0
  );
  assert.equal(recursive.profileComposition.status, "complete");
  assert.equal(recursive.conformance.status, "passed");
  assert.equal(
    recursive.pruning.counts.skippedProfileCompatibleRawCandidates +
      recursive.pruning.counts.skippedProfileExcludedRawCandidates,
    recursive.pruning.counts.skippedRawCandidates
  );
  assert.equal(
    verifyPackageDepthCandidatesWithRecursivePruning(
      recursive,
      loaded,
      config,
      levels,
      targetDepth,
      audit,
      frontierAudit,
      options
    ).generationHash,
    recursive.generationHash
  );
});

test("depth-aware recursive pruning matches pre-admission and disabled target-depth universes", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  assert.equal(level.status, "complete");
  const levels = [level];
  const targetDepth = 2;
  const options = { samplesPerPredicate: 12 };
  const disabled = enumeratePackageDepthCandidates(
    loaded,
    config,
    levels,
    targetDepth
  );
  const canonicalAudit = auditPackageDepthPredicateMonotonicity(
    loaded,
    config,
    levels,
    targetDepth,
    options
  );
  const frontierAudit = auditPackageDepthGeneratorFrontiers(
    loaded,
    config,
    levels,
    targetDepth,
    canonicalAudit,
    options
  );
  const preAdmission = enumeratePackageDepthCandidatesWithPruning(
    loaded,
    config,
    levels,
    targetDepth,
    canonicalAudit,
    options
  );
  const recursive = enumeratePackageDepthCandidatesWithRecursivePruning(
    loaded,
    config,
    levels,
    targetDepth,
    canonicalAudit,
    frontierAudit,
    options
  );

  assert.equal(canonicalAudit.targetDepth, 2);
  assert.equal(canonicalAudit.binding.binder,
    "package-depth-candidate-binding-v2");
  assert.equal(canonicalAudit.universe.generator,
    "package-depth-candidate-generator-v3");
  assert.equal(canonicalAudit.status, "passed");
  assert.equal(frontierAudit.targetDepth, 2);
  assert.equal(frontierAudit.status, "passed");
  assert.equal(preAdmission.conformance.status, "passed");
  assert.equal(recursive.conformance.status, "passed");
  assert.equal(
    recursive.enumeration.counts.logicalRawCandidates,
    disabled.enumeration.counts.logicalRawCandidates
  );
  assert.ok(recursive.enumeration.counts.branchPrunedRawCandidates > 0);
  assert.ok(recursive.pruning.counts.skippedDecorationStates > 0);
  assert.equal(
    canonicalize(recursive.enumeration.candidateStore),
    canonicalize(preAdmission.enumeration.candidateStore)
  );
  assert.equal(
    recursive.sourcePopulationHash,
    recursive.binding.sourcePopulation.selectionHash
  );
  const { auditHash, ...canonicalBasis } = canonicalAudit;
  assert.equal(
    auditHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DEPTH_PRUNING_AUDIT, canonicalBasis)
  );
  const { frontierAuditHash, ...frontierBasis } = frontierAudit;
  assert.equal(
    frontierAuditHash,
    hashCanonical(
      HASH_DOMAINS.PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT,
      frontierBasis
    )
  );

  assert.equal(
    verifyPackageDepthPredicateMonotonicityAudit(
      canonicalAudit,
      loaded,
      config,
      levels,
      targetDepth,
      options
    ).auditHash,
    auditHash
  );
  assert.equal(
    verifyPackageDepthGeneratorFrontierAudit(
      frontierAudit,
      loaded,
      config,
      levels,
      targetDepth,
      canonicalAudit,
      options
    ).frontierAuditHash,
    frontierAuditHash
  );
  assert.equal(
    verifyPackageDepthCandidatesWithPruning(
      preAdmission,
      loaded,
      config,
      levels,
      targetDepth,
      canonicalAudit,
      options
    ).generationHash,
    preAdmission.generationHash
  );
  assert.equal(
    verifyPackageDepthCandidatesWithRecursivePruning(
      recursive,
      loaded,
      config,
      levels,
      targetDepth,
      canonicalAudit,
      frontierAudit,
      options
    ).generationHash,
    recursive.generationHash
  );
});

test("depth-aware pruning binds the exact target chain and rejects tampering", () => {
  const loaded = loadedFixture();
  const config = runConfig();
  const levels = [closePackageLevel(loaded, config)];
  const options = { samplesPerPredicate: 4 };
  const canonicalAudit = auditPackageDepthPredicateMonotonicity(
    loaded,
    config,
    levels,
    2,
    options
  );
  const frontierAudit = auditPackageDepthGeneratorFrontiers(
    loaded,
    config,
    levels,
    2,
    canonicalAudit,
    options
  );
  const session = createPackageDepthGeneratorFrontierControllerSession(
    loaded,
    config,
    levels,
    2,
    canonicalAudit,
    frontierAudit,
    options
  );
  assert.deepEqual(session.authorizedPredicateIds, ["no-support"]);

  const tampered = structuredClone(frontierAudit);
  tampered.targetDepth = 3;
  assert.throws(
    () => verifyPackageDepthGeneratorFrontierAudit(
      tampered,
      loaded,
      config,
      levels,
      2,
      canonicalAudit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_MISMATCH"
  );
  assert.throws(
    () => verifyPackageDepthPredicateMonotonicityAudit(
      canonicalAudit,
      loaded,
      config,
      levels,
      3,
      options
    ),
    (error) => error instanceof KernelError
  );
});

test("depth-aware profile-gated node-growth pruning preserves the exact target-depth reference", () => {
  const loaded = loadedFixture({
    id: "reject-all",
    expr: {
      op: "not",
      arg: { op: "countRole", role: "support", min: 0 }
    }
  }, 1);
  const config = runConfig({
    profileCompositionPolicy: "profile-slot-gate-v1"
  });
  const levels = [];
  const targetDepth = 1;
  const options = { samplesPerPredicate: 8 };
  const canonicalAudit = auditPackageDepthPredicateMonotonicity(
    loaded,
    config,
    levels,
    targetDepth,
    options
  );
  const nodeAudit = auditPackageDepthNodeFrontiers(
    loaded,
    config,
    levels,
    targetDepth,
    canonicalAudit,
    options
  );
  const session = createPackageDepthNodeFrontierControllerSession(
    loaded,
    config,
    levels,
    targetDepth,
    canonicalAudit,
    nodeAudit,
    options
  );
  const result = enumeratePackageDepthCandidatesWithNodeGrowthPruning(
    loaded,
    config,
    levels,
    targetDepth,
    canonicalAudit,
    nodeAudit,
    options
  );

  assert.equal(nodeAudit.targetDepth, targetDepth);
  assert.equal(
    nodeAudit.sourcePopulationHash,
    nodeAudit.binding.sourcePopulation.selectionHash
  );
  assert.equal(nodeAudit.status, "passed");
  assert.equal(nodeAudit.profileExtensionUniverse.status, "complete");
  assert.equal(nodeAudit.profileExtensionUniverse.kind, "node-assignment");
  assert.ok(
    nodeAudit.profileExtensionUniverse.excludedRawExtensionCandidates > 0
  );
  assert.deepEqual(session.authorizedPredicateIds, ["reject-all"]);
  assert.equal(result.targetDepth, targetDepth);
  assert.equal(result.conformance.status, "passed");
  assert.equal(result.profileComposition.status, "complete");
  assert.ok(result.enumeration.counts.nodeBranchPrunedRawCandidates > 0);
  assert.equal(
    result.pruning.counts.skippedProfileCompatibleRawCandidates +
      result.pruning.counts.skippedProfileExcludedRawCandidates,
    result.pruning.counts.skippedRawCandidates
  );
  assert.ok(result.pruning.counts.skippedDecorationStates > 0);
  assert.equal(
    result.conformance.nodeGrowthRetainedStoreHash,
    result.conformance.preAdmissionRetainedStoreHash
  );
  const { nodeFrontierAuditHash, ...nodeAuditBasis } = nodeAudit;
  assert.equal(
    nodeFrontierAuditHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_DEPTH_NODE_FRONTIER_AUDIT, nodeAuditBasis)
  );
  const { generationHash, ...generationBasis } = result;
  assert.equal(
    generationHash,
    hashCanonical(
      HASH_DOMAINS.PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION,
      generationBasis
    )
  );
  assert.equal(
    verifyPackageDepthNodeFrontierAudit(
      nodeAudit,
      loaded,
      config,
      levels,
      targetDepth,
      canonicalAudit,
      options
    ).nodeFrontierAuditHash,
    nodeAudit.nodeFrontierAuditHash
  );
  assert.equal(
    verifyPackageDepthCandidatesWithNodeGrowthPruning(
      result,
      loaded,
      config,
      levels,
      targetDepth,
      canonicalAudit,
      nodeAudit,
      options
    ).generationHash,
    result.generationHash
  );

  const tampered = structuredClone(nodeAudit);
  tampered.targetDepth = 3;
  assert.throws(
    () => verifyPackageDepthNodeFrontierAudit(
      tampered,
      loaded,
      config,
      levels,
      targetDepth,
      canonicalAudit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_MISMATCH"
  );
});
