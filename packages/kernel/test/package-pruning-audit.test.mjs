import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  auditPackageGeneratorFrontiers,
  auditPackageNodeFrontiers,
  auditPackagePredicateMonotonicity,
  authorizePackageNodeFrontierPruning,
  authorizePackagePartialPruning,
  canonicalize,
  createKernel,
  createPackageGeneratorFrontierControllerSession,
  createPackageNodeFrontierControllerSession,
  createPackagePartialPruningControllerSession,
  enumeratePackageCandidatesWithPruning,
  enumeratePackageCandidatesWithNodeGrowthPruning,
  enumeratePackageCandidatesWithRecursivePruning,
  hashCanonical,
  loadKernelPackage,
  verifyPackageCandidatesWithPruning,
  verifyPackageCandidatesWithRecursivePruning,
  verifyPackageGeneratorFrontierAudit,
  verifyPackageNodeFrontierAudit,
  verifyPackageCandidatesWithNodeGrowthPruning,
  verifyPackagePredicateMonotonicityAudit
} from "../src/index.js";

function primitive(sourceId = "audit-source") {
  return {
    sourceId,
    kind: "primitive",
    typeTags: ["audit-type", sourceId],
    invariants: {},
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function profilePrimitive(sourceId, typeTag, polarity, partnerTypeTag) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [typeTag],
    invariants: {},
    profile: {
      slots: [{
        role: "support",
        polarity,
        capacity: { min: 0, max: 1 },
        guard: { op: "partnerTypeTag", typeTag: partnerTypeTag }
      }],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function predicate(id, expr, monotoneViolation = true) {
  return {
    id,
    phase: "formation",
    monotoneViolation,
    referencesDepth: "below",
    expr,
    explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
    claimRefs: []
  };
}

function loaded(predicates, primitives = [primitive()]) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-pruning-audit-fixture",
    version: "1.0.0",
    primitives,
    predicates
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
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 20,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-pruning-audit-fixture-v1",
    invariantPrecision: {
      id: "fixture-precision-v1",
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
      id: "node-removal-v1",
      remove: "nodes",
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

function partial(packageArtifact, edges) {
  const ref = packageArtifact.normalized.primitives[0].elementId;
  return {
    domain: "element-exact",
    nodes: [{ ref }, { ref }],
    edges,
    nodesComplete: true
  };
}

test("static proof plus deterministic falsification audit authorizes a witnessed failure", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig();
  const options = { samplesPerPredicate: 8 };
  const audit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const repeated = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );

  assert.equal(audit.status, "passed");
  assert.equal(audit.counts.authorizedPlans, 1);
  assert.equal(audit.counts.counterexamples, 0);
  assert.equal(audit.results[0].pruningEligibility, "static-proven");
  assert.equal(audit.results[0].pruningEligible, true);
  assert.equal(audit.results[0].samples.length, 8);
  assert.equal(audit.policy.proofInterpretation,
    "falsification-only-static-proof-required-v1");
  assert.equal(canonicalize(audit), canonicalize(repeated));
  assert.equal(audit.auditHash, repeated.auditHash);
  assert.notEqual(
    auditPackagePredicateMonotonicity(
      packageArtifact,
      runConfig({ seed: "different-audit-seed-v1" }),
      options
    ).auditHash,
    audit.auditHash
  );
  const { auditHash, ...basis } = audit;
  assert.equal(hashCanonical(HASH_DOMAINS.PACKAGE_PRUNING_AUDIT, basis), auditHash);
  assert.ok(Object.isFrozen(audit));
  assert.equal(
    verifyPackagePredicateMonotonicityAudit(
      audit,
      packageArtifact,
      config,
      options
    ).auditHash,
    auditHash
  );

  const decision = authorizePackagePartialPruning(
    packageArtifact,
    config,
    audit,
    "no-support",
    partial(packageArtifact, [{ from: 0, to: 1, role: "support" }]),
    options
  );
  assert.equal(decision.pruningAuthorized, true);
  assert.equal(decision.reason, "authorized-persistent-failure");
  assert.equal(decision.diagnostic.pruningAuthorized, false);
  assert.equal(decision.diagnostic.persistentFailureDetected, true);
  const session = createPackagePartialPruningControllerSession(
    packageArtifact,
    config,
    audit,
    options
  );
  assert.deepEqual(session.authorizedPredicateIds, ["no-support"]);
  assert.equal(session.binding.bindingHash, audit.bindingHash);
  assert.equal(
    canonicalize(session.evaluate(
      "no-support",
      partial(packageArtifact, [{ from: 0, to: 1, role: "support" }])
    )),
    canonicalize(decision)
  );
  assert.ok(Object.isFrozen(session));
  assert.ok(Object.isFrozen(session.authorizedPredicateIds));
  const { decisionHash, ...decisionBasis } = decision;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_PRUNING_DECISION, decisionBasis),
    decisionHash
  );
  assert.equal(
    createKernel().createPackagePartialPruningControllerSession(
      packageArtifact,
      config,
      audit,
      options
    ).evaluate(
      "no-support",
      partial(packageArtifact, [{ from: 0, to: 1, role: "support" }])
    ).decisionHash,
    decisionHash
  );
  assert.equal(
    createKernel().authorizePackagePartialPruning(
      packageArtifact,
      config,
      audit,
      "no-support",
      partial(packageArtifact, [{ from: 0, to: 1, role: "support" }]),
      options
    ).decisionHash,
    decisionHash
  );
  const noFailure = authorizePackagePartialPruning(
    packageArtifact,
    config,
    audit,
    "no-support",
    partial(packageArtifact, []),
    options
  );
  assert.equal(noFailure.pruningAuthorized, false);
  assert.equal(noFailure.reason, "persistent-failure-not-detected");
});

test("audited pre-admission pruning preserves the complete post-filter result", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig();
  const options = { samplesPerPredicate: 8 };
  const audit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const result = enumeratePackageCandidatesWithPruning(
    packageArtifact,
    config,
    audit,
    options
  );

  assert.equal(result.generator, "package-pruned-candidate-generator-v1");
  assert.equal(result.pruning.strategy,
    "canonical-candidate-prefix-pre-admission-v1");
  assert.deepEqual(result.pruning.authorizedPredicateIds, ["no-support"]);
  assert.equal(result.enumeration.status, "complete");
  assert.equal(result.enumeration.counts.generatedCandidates, 3);
  assert.equal(result.enumeration.counts.preAdmissionPrunedCandidates, 2);
  assert.equal(result.enumeration.counts.attemptedCandidates, 1);
  assert.equal(result.enumeration.counts.canonicalCandidates, 1);
  assert.equal(result.pruning.counts.authorizedDecisions, 2);
  assert.equal(result.pruning.counts.uniquePrunedCandidates, 1);
  assert.equal(result.pruning.counts.duplicatePrunedCandidates, 1);
  assert.equal(result.pruning.prunedCandidates[0].predicateId, "no-support");
  assert.equal(result.pruning.prunedCandidates[0].partialEdgeCount, 1);
  assert.equal(result.pruning.prunedCandidates[0].rawOccurrences, 2);
  assert.equal(result.pruning.prunedCandidates[0].decision.pruningAuthorized, true);
  assert.equal(result.conformance.status, "passed");
  assert.equal(result.conformance.pruningDisabledCanonicalCandidates, 2);
  assert.equal(result.conformance.pruningEnabledCanonicalCandidates, 1);
  assert.equal(result.conformance.eligible.candidateCount, 1);
  assert.equal(
    result.conformance.eligible.pruningDisabledHash,
    result.conformance.eligible.pruningEnabledHash
  );
  assert.equal(
    result.conformance.indeterminate.pruningDisabledHash,
    result.conformance.indeterminate.pruningEnabledHash
  );
  const { generationHash, ...basis } = result;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_PRUNED_CANDIDATE_GENERATION, basis),
    generationHash
  );
  assert.equal(
    verifyPackageCandidatesWithPruning(
      result,
      packageArtifact,
      config,
      audit,
      options
    ).generationHash,
    generationHash
  );
  assert.equal(
    createKernel().enumeratePackageCandidatesWithPruning(
      packageArtifact,
      config,
      audit,
      options
    ).generationHash,
    generationHash
  );

  const tampered = structuredClone(result);
  tampered.pruning.counts.uniquePrunedCandidates = 0;
  assert.throws(
    () => verifyPackageCandidatesWithPruning(
      tampered,
      packageArtifact,
      config,
      audit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_PRUNING_ARTIFACT_MISMATCH"
  );
});

test("profile-slot gating precedes audited pre-admission pruning and preserves its exact universe", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ], [
    profilePrimitive("source-alpha", "alpha", "out", "beta"),
    profilePrimitive("source-beta", "beta", "in", "alpha")
  ]);
  const config = runConfig({
    profileCompositionPolicy: "profile-slot-gate-v1",
    budget: {
      maxNodes: 3,
      maxEdges: 2,
      maxCandidates: 200,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const options = { samplesPerPredicate: 8 };
  const audit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const result = enumeratePackageCandidatesWithPruning(
    packageArtifact,
    config,
    audit,
    options
  );

  assert.equal(audit.status, "passed");
  assert.equal(audit.counts.authorizedPlans, 1);
  assert.equal(result.profileComposition.status, "complete");
  assert.equal(result.profileComposition.policy, "profile-slot-gate-v1");
  assert.ok(result.profileComposition.counts.incompatibleCandidates > 0);
  assert.ok(result.enumeration.counts.compositionExcludedCandidates > 0);
  assert.equal(
    audit.universe.candidateCount,
    result.conformance.pruningDisabledCanonicalCandidates
  );
  assert.equal(
    result.profileComposition.counts.excludedRawCandidates,
    result.enumeration.counts.compositionExcludedCandidates
  );
  assert.equal(
    result.pruning.counts.evaluatedRawCandidates,
    result.enumeration.counts.generatedCandidates -
      result.enumeration.counts.compositionExcludedCandidates -
      result.enumeration.counts.policyExcludedCandidates
  );
  assert.ok(result.enumeration.counts.preAdmissionPrunedCandidates > 0);
  assert.equal(result.conformance.status, "passed");
  assert.equal(
    result.conformance.eligible.pruningDisabledHash,
    result.conformance.eligible.pruningEnabledHash
  );
  assert.equal(
    result.conformance.indeterminate.pruningDisabledHash,
    result.conformance.indeterminate.pruningEnabledHash
  );
  assert.equal(
    verifyPackageCandidatesWithPruning(
      result,
      packageArtifact,
      config,
      audit,
      options
    ).generationHash,
    result.generationHash
  );
  const tampered = structuredClone(result);
  tampered.profileComposition.counts.excludedRawCandidates += 1;
  assert.throws(
    () => verifyPackageCandidatesWithPruning(
      tampered,
      packageArtifact,
      config,
      audit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_PRUNING_ARTIFACT_MISMATCH"
  );
  const frontierAudit = auditPackageGeneratorFrontiers(
    packageArtifact,
    config,
    audit,
    options
  );
  const recursive = enumeratePackageCandidatesWithRecursivePruning(
    packageArtifact,
    config,
    audit,
    frontierAudit,
    options
  );
  assert.equal(frontierAudit.profileExtensionUniverse.status, "complete");
  assert.ok(
    frontierAudit.profileExtensionUniverse.excludedRawExtensionCandidates > 0
  );
  assert.equal(
    verifyPackageGeneratorFrontierAudit(
      frontierAudit,
      packageArtifact,
      config,
      audit,
      options
    ).frontierAuditHash,
    frontierAudit.frontierAuditHash
  );
  assert.equal(recursive.conformance.status, "passed");
  assert.ok(recursive.pruning.counts.skippedRawCandidates > 0);
  assert.equal(
    recursive.pruning.counts.skippedProfileCompatibleRawCandidates +
      recursive.pruning.counts.skippedProfileExcludedRawCandidates,
    recursive.pruning.counts.skippedRawCandidates
  );
  assert.equal(
    verifyPackageCandidatesWithRecursivePruning(
      recursive,
      packageArtifact,
      config,
      audit,
      frontierAudit,
      options
    ).generationHash,
    recursive.generationHash
  );
});

test("profile-slot gating composes with audited node-growth subtree pruning", () => {
  const packageArtifact = loaded([
    predicate("reject-all", {
      op: "not",
      arg: { op: "countRole", role: "support", min: 0 }
    })
  ], [
    profilePrimitive("source-alpha", "alpha", "out", "beta"),
    profilePrimitive("source-beta", "beta", "in", "alpha")
  ]);
  const config = runConfig({
    profileCompositionPolicy: "profile-slot-gate-v1",
    budget: {
      maxNodes: 3,
      maxEdges: 2,
      maxCandidates: 200,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const options = { samplesPerPredicate: 8 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const nodeAudit = auditPackageNodeFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );
  const result = enumeratePackageCandidatesWithNodeGrowthPruning(
    packageArtifact,
    config,
    canonicalAudit,
    nodeAudit,
    options
  );

  assert.equal(nodeAudit.profileExtensionUniverse.status, "complete");
  assert.equal(nodeAudit.profileExtensionUniverse.kind, "node-assignment");
  assert.ok(
    nodeAudit.profileExtensionUniverse.excludedRawExtensionCandidates > 0
  );
  assert.equal(
    verifyPackageNodeFrontierAudit(
      nodeAudit,
      packageArtifact,
      config,
      canonicalAudit,
      options
    ).nodeFrontierAuditHash,
    nodeAudit.nodeFrontierAuditHash
  );
  assert.equal(result.profileComposition.status, "complete");
  assert.equal(result.conformance.status, "passed");
  assert.ok(result.pruning.counts.skippedRawCandidates > 0);
  assert.equal(
    result.pruning.counts.skippedProfileCompatibleRawCandidates +
      result.pruning.counts.skippedProfileExcludedRawCandidates,
    result.pruning.counts.skippedRawCandidates
  );
  assert.equal(
    result.enumeration.counts.compositionExcludedCandidates +
      result.pruning.counts.skippedProfileExcludedRawCandidates,
    result.profileComposition.counts.excludedRawCandidates
  );
  assert.equal(
    verifyPackageCandidatesWithNodeGrowthPruning(
      result,
      packageArtifact,
      config,
      canonicalAudit,
      nodeAudit,
      options
    ).generationHash,
    result.generationHash
  );
  const tamperedAudit = structuredClone(nodeAudit);
  tamperedAudit.profileExtensionUniverse.frontiers[0]
    .compatibleRawCandidates += 1;
  assert.throws(
    () => verifyPackageNodeFrontierAudit(
      tamperedAudit,
      packageArtifact,
      config,
      canonicalAudit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NODE_FRONTIER_AUDIT_MISMATCH"
  );
});

test("generator-frontier audit samples actual raw edge-group extension states", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig();
  const options = { samplesPerPredicate: 8 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const frontierAudit = auditPackageGeneratorFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );

  assert.equal(frontierAudit.status, "passed");
  assert.equal(frontierAudit.policy.extensionModel,
    "complete-node-edge-group-frontier-v1");
  assert.equal(frontierAudit.universe.canonicalCandidateCount, 2);
  assert.equal(frontierAudit.universe.rawExtensionCandidates, 3);
  assert.equal(frontierAudit.universe.extensionFrameSize, 2);
  assert.equal(frontierAudit.results[0].samples.length, 8);
  assert.ok(frontierAudit.results[0].samples.every((sample) =>
    sample.completedEdgeGroups === 0 &&
    sample.totalEdgeGroups === 1 &&
    sample.partialEdgeCount === 0 &&
    sample.extensionEdgeCount === 1 &&
    sample.counterexample === false
  ));
  assert.equal(frontierAudit.results[0].pruningEligible, true);
  const { frontierAuditHash, ...basis } = frontierAudit;
  assert.equal(
    hashCanonical(HASH_DOMAINS.PACKAGE_GENERATOR_FRONTIER_AUDIT, basis),
    frontierAuditHash
  );
  assert.equal(
    verifyPackageGeneratorFrontierAudit(
      frontierAudit,
      packageArtifact,
      config,
      canonicalAudit,
      options
    ).frontierAuditHash,
    frontierAuditHash
  );

  const tampered = structuredClone(frontierAudit);
  tampered.universe.extensionFrameSize += 1;
  assert.throws(
    () => verifyPackageGeneratorFrontierAudit(
      tampered,
      packageArtifact,
      config,
      canonicalAudit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_GENERATOR_FRONTIER_AUDIT_MISMATCH"
  );
});

test("recursive frontier pruning skips exact subtrees and matches both reference modes", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig({
    budget: {
      maxNodes: 3,
      maxEdges: 2,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const options = { samplesPerPredicate: 12 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const frontierAudit = auditPackageGeneratorFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );
  const session = createPackageGeneratorFrontierControllerSession(
    packageArtifact,
    config,
    canonicalAudit,
    frontierAudit,
    options
  );
  const result = enumeratePackageCandidatesWithRecursivePruning(
    packageArtifact,
    config,
    canonicalAudit,
    frontierAudit,
    options
  );

  assert.deepEqual(session.authorizedPredicateIds, ["no-support"]);
  assert.equal(result.generator,
    "package-recursive-pruned-candidate-generator-v1");
  assert.equal(result.enumeration.status, "complete");
  assert.equal(result.enumeration.counts.logicalRawCandidates, 7);
  assert.equal(result.enumeration.counts.generatedCandidates, 3);
  assert.equal(result.enumeration.counts.branchPrunedRawCandidates, 4);
  assert.equal(result.enumeration.counts.branchPrunedFrontiers, 2);
  assert.equal(result.enumeration.counts.preAdmissionPrunedCandidates, 2);
  assert.equal(result.enumeration.counts.canonicalCandidates, 1);
  assert.equal(result.pruning.counts.authorizedFrontiers, 2);
  assert.equal(result.pruning.counts.skippedRawCandidates, 4);
  assert.equal(result.pruning.counts.preAdmissionAuthorizedDecisions, 2);
  assert.ok(result.pruning.counts.skippedDecorationStates > 0);
  assert.equal(result.pruning.prunedFrontiers.length, 2);
  assert.ok(result.pruning.prunedFrontiers.every((entry) =>
    entry.decision.pruningAuthorized === true &&
    entry.decision.frontier.completedEdgeGroups === 1 &&
    entry.decision.frontier.remainingRawCandidates === 2 &&
    entry.partialGraph.edges.length === 1
  ));
  const firstFrontier = result.pruning.prunedFrontiers[0];
  assert.throws(
    () => session.evaluate("no-support", {
      candidateInput: {
        domain: firstFrontier.partialGraph.domain,
        nodes: firstFrontier.partialGraph.nodes,
        edges: firstFrontier.partialGraph.edges,
        skeleton: firstFrontier.decision.frontier.skeletonId
      },
      frontier: {
        ...firstFrontier.decision.frontier,
        remainingRawCandidates:
          firstFrontier.decision.frontier.remainingRawCandidates + 1
      }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_GENERATOR_FRONTIER_REMAINING_COUNT_MISMATCH"
  );
  assert.equal(result.conformance.status, "passed");
  assert.equal(
    result.conformance.recursiveRetainedStoreHash,
    result.conformance.preAdmissionRetainedStoreHash
  );
  assert.equal(
    result.conformance.recursiveCanonicalCandidates,
    result.conformance.preAdmissionCanonicalCandidates
  );
  const { generationHash, ...basis } = result;
  assert.equal(
    hashCanonical(
      HASH_DOMAINS.PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATION,
      basis
    ),
    generationHash
  );
  assert.equal(
    verifyPackageCandidatesWithRecursivePruning(
      result,
      packageArtifact,
      config,
      canonicalAudit,
      frontierAudit,
      options
    ).generationHash,
    generationHash
  );

  const tampered = structuredClone(result);
  tampered.pruning.counts.skippedRawCandidates += 1;
  assert.throws(
    () => verifyPackageCandidatesWithRecursivePruning(
      tampered,
      packageArtifact,
      config,
      canonicalAudit,
      frontierAudit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RECURSIVE_PRUNING_ARTIFACT_MISMATCH"
  );
});

test("recursive pruning counts parallel and optional-loop subtrees exactly", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig({
    budget: {
      maxNodes: 2,
      maxEdges: 3,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    graphPolicy: {
      ...runConfig().graphPolicy,
      allowParallelEdges: true,
      allowSelfLoops: true
    }
  });
  const options = { samplesPerPredicate: 8 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const frontierAudit = auditPackageGeneratorFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );
  const result = enumeratePackageCandidatesWithRecursivePruning(
    packageArtifact,
    config,
    canonicalAudit,
    frontierAudit,
    options
  );

  assert.equal(result.enumeration.counts.logicalRawCandidates, 29);
  assert.equal(result.enumeration.counts.generatedCandidates, 4);
  assert.equal(result.enumeration.counts.branchPrunedRawCandidates, 25);
  assert.equal(result.enumeration.counts.preAdmissionPrunedCandidates, 3);
  assert.equal(result.pruning.counts.skippedRawCandidates, 25);
  assert.ok(result.pruning.prunedFrontiers.some((entry) =>
    entry.decision.frontier.completedEdgeGroups === 1 &&
    entry.decision.frontier.edgeGroupCounts[0] === 1 &&
    entry.decision.frontier.remainingRawCandidates === 6
  ));
  assert.equal(result.conformance.status, "passed");
});

test("recursive pruning refuses a non-passed audit and gates directed-strong frontiers", () => {
  const repairablePackage = loaded([
    predicate("requires-support", { op: "countRole", role: "support", min: 1 })
  ]);
  const options = { samplesPerPredicate: 4 };
  const failedCanonical = auditPackagePredicateMonotonicity(
    repairablePackage,
    runConfig(),
    options
  );
  assert.throws(
    () => auditPackageGeneratorFrontiers(
      repairablePackage,
      runConfig(),
      failedCanonical,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code ===
        "PACKAGE_GENERATOR_FRONTIER_AUDIT_CANONICAL_AUDIT_NOT_PASSED"
  );

  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const strongConfig = runConfig({
    budget: {
      maxNodes: 2,
      maxEdges: 3,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    graphPolicy: {
      ...runConfig().graphPolicy,
      allowParallelEdges: true,
      allowSelfLoops: true,
      connectivityProjection: "directed-strong"
    }
  });
  const strongCanonical = auditPackagePredicateMonotonicity(
    packageArtifact,
    strongConfig,
    options
  );
  const strongFrontier = auditPackageGeneratorFrontiers(
    packageArtifact,
    strongConfig,
    strongCanonical,
    options
  );
  assert.equal(strongFrontier.status, "passed");
  assert.equal(strongFrontier.policySupport, "supported");
  const session = createPackageGeneratorFrontierControllerSession(
    packageArtifact,
    strongConfig,
    strongCanonical,
    strongFrontier,
    options
  );
  const skeleton = session.binding.enumerationInput.skeletons.find(
    (entry) => entry.nodeCount === 2
  );
  const ref = session.binding.enumerationInput.nodeVariants[0].ref;
  const disconnected = session.evaluate("no-support", {
    candidateInput: {
      domain: "element-exact",
      nodes: [{ ref }, { ref }],
      edges: [{ from: 0, to: 1, role: "support" }],
      skeleton: skeleton.id
    },
    frontier: {
      skeletonId: skeleton.id,
      completedEdgeGroups: 1,
      totalEdgeGroups: 3,
      edgeGroupCounts: [1],
      remainingRawCandidates: 6
    }
  });
  assert.equal(disconnected.diagnostic.persistentFailureDetected, true);
  assert.equal(disconnected.frontierConnectivitySatisfied, false);
  assert.equal(disconnected.pruningAuthorized, false);
  assert.equal(disconnected.reason, "connectivity-frontier-not-satisfied");

  const strongResult = enumeratePackageCandidatesWithRecursivePruning(
    packageArtifact,
    strongConfig,
    strongCanonical,
    strongFrontier,
    options
  );
  assert.equal(strongResult.conformance.status, "passed");
  assert.equal(strongResult.enumeration.counts.logicalRawCandidates, 29);
  assert.equal(strongResult.enumeration.counts.generatedCandidates, 24);
  assert.equal(strongResult.enumeration.counts.branchPrunedRawCandidates, 5);
  assert.equal(strongResult.enumeration.counts.policyExcludedCandidates, 20);
  assert.equal(strongResult.enumeration.counts.preAdmissionPrunedCandidates, 3);
  assert.equal(strongResult.pruning.counts.authorizedFrontiers, 3);
  assert.equal(strongResult.pruning.counts.skippedRawCandidates, 5);
  assert.ok(strongResult.pruning.prunedFrontiers.every(
    (entry) => entry.decision.frontierConnectivitySatisfied
  ));
});

test("a sampled partial-fail extension-pass pair falsifies a monotonicity claim", () => {
  const packageArtifact = loaded([
    predicate("requires-support", { op: "countRole", role: "support", min: 1 })
  ]);
  const config = runConfig();
  const options = { samplesPerPredicate: 4 };
  const audit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );

  assert.equal(audit.status, "failed");
  assert.equal(audit.results[0].pruningEligibility, "blocked-unproven");
  assert.equal(audit.results[0].status, "failed");
  assert.equal(audit.results[0].counts.counterexamples, 4);
  assert.ok(audit.results[0].samples.every((entry) =>
    entry.partialOutcome === "fail" &&
    entry.extensionOutcome === "pass" &&
    entry.counterexample
  ));
  assert.equal(audit.counts.authorizedPlans, 0);

  const decision = authorizePackagePartialPruning(
    packageArtifact,
    config,
    audit,
    "requires-support",
    partial(packageArtifact, []),
    options
  );
  assert.equal(decision.pruningAuthorized, false);
  assert.equal(decision.reason, "audit-not-passed");

  const generation = enumeratePackageCandidatesWithPruning(
    packageArtifact,
    config,
    audit,
    options
  );
  assert.deepEqual(generation.pruning.authorizedPredicateIds, []);
  assert.equal(generation.pruning.counts.controllerDecisions, 0);
  assert.equal(generation.pruning.counts.authorizedDecisions, 0);
  assert.equal(generation.enumeration.counts.preAdmissionPrunedCandidates, 0);
  assert.equal(generation.conformance.pruningDisabledCanonicalCandidates, 2);
  assert.equal(generation.conformance.pruningEnabledCanonicalCandidates, 2);
});

test("graph-policy exclusions happen before pre-admission pruning", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig({
    graphPolicy: {
      ...runConfig().graphPolicy,
      connectivityProjection: "directed-strong"
    }
  });
  const options = { samplesPerPredicate: 4 };
  const audit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const generation = enumeratePackageCandidatesWithPruning(
    packageArtifact,
    config,
    audit,
    options
  );

  assert.equal(generation.enumeration.counts.generatedCandidates, 3);
  assert.equal(generation.pruning.counts.evaluatedRawCandidates, 3);
  assert.equal(generation.enumeration.counts.policyExcludedCandidates, 2);
  assert.equal(generation.enumeration.counts.preAdmissionPrunedCandidates, 0);
  assert.equal(generation.enumeration.counts.attemptedCandidates, 1);
  assert.equal(generation.conformance.status, "passed");
});

test("unsupported or empty audits remain explicit and cannot manufacture proof", () => {
  const unsupportedPackage = loaded([
    predicate("numeric", {
      op: "compare",
      left: { kind: "constant", value: 0 },
      comparator: "eq",
      right: { kind: "constant", value: 0 }
    })
  ]);
  const unsupported = auditPackagePredicateMonotonicity(
    unsupportedPackage,
    runConfig(),
    { samplesPerPredicate: 2 }
  );
  assert.equal(unsupported.status, "indeterminate");
  assert.equal(unsupported.results[0].status, "unsupported");
  assert.equal(unsupported.results[0].pruningEligible, false);

  const notApplicable = auditPackagePredicateMonotonicity(
    loaded([predicate("ordinary", { op: "connected" }, false)]),
    runConfig(),
    { samplesPerPredicate: 2 }
  );
  assert.equal(notApplicable.status, "not-applicable");
  assert.equal(notApplicable.counts.declaredPredicates, 0);
  assert.deepEqual(notApplicable.results, []);
});

test("audited node-growth pruning closes exact node subtrees and preserves the reference census", () => {
  const packageArtifact = loaded([
    predicate("reject-all", {
      op: "not",
      arg: { op: "countRole", role: "support", min: 0 }
    })
  ]);
  const config = runConfig();
  const options = { samplesPerPredicate: 8 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const nodeAudit = auditPackageNodeFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );

  assert.equal(nodeAudit.status, "passed");
  assert.equal(nodeAudit.universe.rawExtensionCandidates, 3);
  assert.equal(nodeAudit.universe.extensionFrameSize, 2);
  assert.equal(nodeAudit.results[0].pruningEligible, true);
  assert.ok(nodeAudit.results[0].samples.every((sample) =>
    sample.assignedNodes === 1 &&
    sample.totalNodes === 2 &&
    sample.remainingNodeAssignments === 1 &&
    sample.persistentFailureDetected &&
    sample.extensionOutcome === "fail" &&
    sample.counterexample === false
  ));
  assert.equal(
    verifyPackageNodeFrontierAudit(
      nodeAudit,
      packageArtifact,
      config,
      canonicalAudit,
      options
    ).nodeFrontierAuditHash,
    nodeAudit.nodeFrontierAuditHash
  );
  const { nodeFrontierAuditHash, ...nodeAuditBasis } = nodeAudit;
  assert.equal(
    nodeFrontierAuditHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_NODE_FRONTIER_AUDIT, nodeAuditBasis)
  );

  const pairSkeleton = nodeAudit.binding.enumerationInput.skeletons.find(
    (skeleton) => skeleton.nodeCount === 2
  );
  const nodeRef = nodeAudit.binding.enumerationInput.nodeVariants[0];
  const frontierInput = {
    candidateInput: {
      domain: "element-exact",
      nodes: [nodeRef],
      edges: [],
      skeleton: pairSkeleton.id
    },
    frontier: {
      skeletonId: pairSkeleton.id,
      assignedNodes: 1,
      totalNodes: 2,
      remainingNodeAssignments: 1,
      edgeRawCandidatesPerAssignment: 2,
      remainingRawCandidates: 2
    }
  };
  const session = createPackageNodeFrontierControllerSession(
    packageArtifact,
    config,
    canonicalAudit,
    nodeAudit,
    options
  );
  const decision = authorizePackageNodeFrontierPruning(
    packageArtifact,
    config,
    canonicalAudit,
    nodeAudit,
    "reject-all",
    frontierInput,
    options
  );
  assert.deepEqual(session.authorizedPredicateIds, ["reject-all"]);
  assert.equal(decision.pruningAuthorized, true);
  assert.equal(decision.reason,
    "authorized-persistent-node-frontier-failure");
  const { decisionHash, ...decisionBasis } = decision;
  assert.equal(
    decisionHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_NODE_FRONTIER_DECISION, decisionBasis)
  );
  assert.equal(
    session.evaluate("reject-all", frontierInput).decisionHash,
    decision.decisionHash
  );

  const result = enumeratePackageCandidatesWithNodeGrowthPruning(
    packageArtifact,
    config,
    canonicalAudit,
    nodeAudit,
    options
  );
  assert.equal(result.enumeration.status, "complete");
  assert.equal(result.enumeration.counts.logicalRawCandidates, 3);
  assert.equal(result.enumeration.counts.generatedCandidates, 1);
  assert.equal(result.enumeration.counts.nodeBranchPrunedRawCandidates, 2);
  assert.equal(result.enumeration.counts.nodeBranchPrunedFrontiers, 1);
  assert.equal(result.enumeration.counts.preAdmissionPrunedCandidates, 1);
  assert.equal(result.pruning.counts.authorizedNodeFrontiers, 1);
  assert.equal(result.pruning.counts.skippedRawCandidates, 2);
  assert.ok(result.pruning.counts.skippedDecorationStates > 0);
  assert.equal(result.conformance.status, "passed");
  assert.equal(
    result.conformance.nodeGrowthRetainedStoreHash,
    result.conformance.preAdmissionRetainedStoreHash
  );
  assert.equal(
    verifyPackageCandidatesWithNodeGrowthPruning(
      result,
      packageArtifact,
      config,
      canonicalAudit,
      nodeAudit,
      options
    ).generationHash,
    result.generationHash
  );
  const { generationHash, ...generationBasis } = result;
  assert.equal(
    generationHash,
    hashCanonical(
      HASH_DOMAINS.PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION,
      generationBasis
    )
  );

  const tampered = structuredClone(frontierInput);
  tampered.frontier.remainingRawCandidates += 1;
  assert.throws(
    () => session.evaluate("reject-all", tampered),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NODE_FRONTIER_REMAINING_COUNT_MISMATCH"
  );
});

test("node-growth authorization is fail-closed for directed-strong connectivity", () => {
  const packageArtifact = loaded([
    predicate("reject-all", {
      op: "not",
      arg: { op: "countRole", role: "support", min: 0 }
    })
  ]);
  const config = runConfig({
    budget: {
      maxNodes: 2,
      maxEdges: 2,
      maxCandidates: 20,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    graphPolicy: {
      ...runConfig().graphPolicy,
      allowParallelEdges: true,
      connectivityProjection: "directed-strong"
    }
  });
  const options = { samplesPerPredicate: 2 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const nodeAudit = auditPackageNodeFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );
  assert.equal(nodeAudit.status, "indeterminate");
  assert.equal(nodeAudit.results[0].status, "blocked-connectivity");
  assert.equal(nodeAudit.results[0].connectivitySupport,
    "blocked-directed-strong");
  assert.equal(nodeAudit.results[0].pruningEligible, false);
  const pairSkeleton = nodeAudit.binding.enumerationInput.skeletons.find(
    (skeleton) => skeleton.nodeCount === 2
  );
  const decision = createPackageNodeFrontierControllerSession(
    packageArtifact,
    config,
    canonicalAudit,
    nodeAudit,
    options
  ).evaluate("reject-all", {
    candidateInput: {
      domain: "element-exact",
      nodes: [nodeAudit.binding.enumerationInput.nodeVariants[0]],
      edges: [],
      skeleton: pairSkeleton.id
    },
    frontier: {
      skeletonId: pairSkeleton.id,
      assignedNodes: 1,
      totalNodes: 2,
      remainingNodeAssignments: 1,
      edgeRawCandidatesPerAssignment: 5,
      remainingRawCandidates: 5
    }
  });
  assert.equal(decision.pruningAuthorized, false);
  assert.equal(decision.reason, "connectivity-universe-not-fixed");
  assert.throws(
    () => enumeratePackageCandidatesWithNodeGrowthPruning(
      packageArtifact,
      config,
      canonicalAudit,
      nodeAudit,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_NODE_GROWTH_PRUNING_AUDIT_NOT_PASSED"
  );
});

test("node-growth pruning reconciles multiple variants, parallel edges, and loops", () => {
  const packageArtifact = loaded([
    predicate("reject-all", {
      op: "not",
      arg: { op: "countRole", role: "support", min: 0 }
    })
  ], [primitive("audit-source-a"), primitive("audit-source-b")]);
  const config = runConfig({
    budget: {
      maxNodes: 2,
      maxEdges: 3,
      maxCandidates: 500,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    graphPolicy: {
      ...runConfig().graphPolicy,
      allowParallelEdges: true,
      allowSelfLoops: true
    }
  });
  const options = { samplesPerPredicate: 8 };
  const canonicalAudit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const nodeAudit = auditPackageNodeFrontiers(
    packageArtifact,
    config,
    canonicalAudit,
    options
  );
  const result = enumeratePackageCandidatesWithNodeGrowthPruning(
    packageArtifact,
    config,
    canonicalAudit,
    nodeAudit,
    options
  );

  assert.equal(result.conformance.status, "passed");
  assert.equal(result.pruning.counts.authorizedNodeFrontiers, 2);
  assert.ok(result.pruning.counts.skippedRawCandidates > 2);
  assert.ok(result.pruning.prunedNodeFrontiers.every((entry) =>
    entry.decision.frontier.edgeRawCandidatesPerAssignment > 1 &&
    entry.decision.frontier.remainingRawCandidates ===
      entry.decision.frontier.edgeRawCandidatesPerAssignment * 2
  ));
  assert.equal(
    result.enumeration.counts.logicalRawCandidates,
    result.enumeration.counts.generatedCandidates +
      result.enumeration.counts.nodeBranchPrunedRawCandidates
  );
});

test("audit replay, options, and controller universe are fail-closed", () => {
  const packageArtifact = loaded([
    predicate("no-support", { op: "countRole", role: "support", max: 0 })
  ]);
  const config = runConfig();
  const options = { samplesPerPredicate: 3 };
  const audit = auditPackagePredicateMonotonicity(
    packageArtifact,
    config,
    options
  );
  const tampered = structuredClone(audit);
  tampered.results[0].samples[0].counterexample = true;

  assert.throws(
    () => verifyPackagePredicateMonotonicityAudit(
      tampered,
      packageArtifact,
      config,
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_MISMATCH"
  );
  assert.throws(
    () => verifyPackagePredicateMonotonicityAudit(
      audit,
      packageArtifact,
      config,
      { samplesPerPredicate: 2 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_PREDICATE_MONOTONICITY_AUDIT_MISMATCH"
  );
  assert.throws(
    () => authorizePackagePartialPruning(
      packageArtifact,
      config,
      audit,
      "no-support",
      {
        domain: "element-exact",
        nodes: [{ ref: `sha256:${"f".repeat(64)}` }],
        edges: [],
        nodesComplete: true
      },
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_PARTIAL_PRUNING_UNIVERSE_MISMATCH"
  );
  assert.throws(
    () => authorizePackagePartialPruning(
      packageArtifact,
      config,
      audit,
      "no-support",
      { ...partial(packageArtifact, []), nodesComplete: false },
      options
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_PARTIAL_PRUNING_EXTENSION_MODEL_MISMATCH"
  );
});
