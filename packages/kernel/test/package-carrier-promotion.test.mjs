import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  closePackageLadder,
  createKernel,
  hashCanonical,
  loadKernelPackage,
  materializePackageCarrierPromotions,
  testPackageProfileCollapse,
  verifyPackageCarrierPromotions
} from "../src/index.js";

const ARTIFACT_HASH = `sha256:${"a".repeat(64)}`;

function slot(role, polarity, max) {
  return { role, polarity, capacity: { min: 0, max } };
}

function profile(slots = []) {
  return {
    slots,
    invariantVector: [],
    precisionPolicy: "exact-structural-v1"
  };
}

function quantity(value) {
  return {
    value,
    unit: "1",
    tolerance: { absolute: 0 },
    semantic: "promotion fixture invariant",
    provenance: { kind: "declared", evidence: [] }
  };
}

function evidenceAndClaims() {
  return {
    evidence: [{
      id: "promotion-evidence",
      state: "package-operationalization",
      source: {
        path: "fixture/promotion.md",
        mediaType: "text/markdown",
        schemaVersion: "1",
        bytes: 1,
        hash: ARTIFACT_HASH
      }
    }],
    claims: [{
      id: "promotion-claim",
      statement: "The selected formation has an effective carrier interface.",
      state: "package-operationalization",
      evidence: ["promotion-evidence"]
    }]
  };
}

function loadedFixture() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "carrier-promotion-fixture",
    version: "1.0.0",
    ...evidenceAndClaims(),
    primitives: [{
      sourceId: "source",
      kind: "primitive",
      ontologyCoordinate: { level: 0 },
      axisProvenance: { ontologyLevel: "declared" },
      typeTags: ["source"],
      invariants: {},
      profile: profile([
        slot("support", "out", 2),
        slot("support", "in", 2)
      ]),
      claimRefs: []
    }],
    predicates: [{
      id: "one-support",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: { op: "countRole", role: "support", min: 1, max: 1 },
      explain: { pass: "supported", fail: "unsupported", indeterminate: "unknown" },
      claimRefs: []
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: profile([slot("external", "sym", 1)]),
      derivedTypeTags: ["selected-formation"],
      claimRefs: ["promotion-claim"]
    }
  });
}

function mismatchLoadedFixture() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "carrier-promotion-counterexample-fixture",
    version: "1.0.0",
    ...evidenceAndClaims(),
    primitives: [1, 2].map((value) => ({
      sourceId: `source-${value}`,
      kind: "primitive",
      ontologyCoordinate: { level: 0 },
      axisProvenance: { ontologyLevel: "declared" },
      typeTags: ["source"],
      invariants: { q: quantity(value) },
      profile: profile(),
      claimRefs: []
    })),
    functionals: [{
      id: "q-score",
      expr: {
        kind: "invariant",
        name: "q",
        node: { kind: "canonical-index", index: 0 }
      },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "q-result",
        unit: "1",
        semantic: "promotion fixture invariant",
        toleranceTarget: { absolute: 0 }
      },
      explain: "Prefer the smallest q.",
      claimRefs: []
    }],
    cohortRules: [{ id: "all", kind: "global" }],
    selectors: [{
      id: "minimum-q",
      objective: "min",
      functional: "q-score",
      cohortRule: "all",
      epsilon: quantity(0),
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 1,
        robustTopKThreshold: 1
      },
      explain: { pass: "minimum", fail: "larger", indeterminate: "unknown" },
      claimRefs: []
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: profile([slot("external", "sym", 1)]),
      derivedTypeTags: ["selected-formation"],
      claimRefs: ["promotion-claim"]
    }
  });
}

function mismatchRunConfig() {
  const value = runConfig();
  value.budget.maxNodes = 1;
  value.budget.maxEdges = 0;
  return value;
}

function runConfig() {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth", "ontology-level"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "carrier-promotion-fixture-v1",
    invariantPrecision: {
      id: "carrier-promotion-precision-v1",
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
      id: "carrier-promotion-substructure-v1",
      remove: "nodes-and-edges",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
}

function promotionPolicy(counterexampleDisposition = "block") {
  return {
    schemaVersion: "1",
    targetDepth: 1,
    sourceCoordinate: { level: 0 },
    targetCoordinate: { level: 1, phase: "custom:effective-carrier" },
    targetTypeTags: ["level-1-carrier"],
    claimRefs: ["promotion-claim"],
    evidence: ["promotion-evidence"],
    counterexampleDisposition
  };
}

function pipeline() {
  const loaded = loadedFixture();
  const config = runConfig();
  const ladder = closePackageLadder(loaded, config, 1);
  const collapse = testPackageProfileCollapse(loaded, config, 1);
  return { loaded, config, ladder, collapse };
}

test("carrier promotion emits replayable target-package primitive inputs", () => {
  const { loaded, config, ladder, collapse } = pipeline();
  const policy = promotionPolicy();
  const result = materializePackageCarrierPromotions(
    loaded,
    config,
    ladder,
    collapse,
    1,
    policy
  );

  assert.equal(collapse.verdict, "equivalent");
  assert.equal(result.status, "complete");
  assert.equal(result.promotions.length, 1);
  assert.equal(result.counts.promotedCarriers, 1);
  assert.equal(result.decisions[0].outcome, "promoted");
  const promotion = result.promotions[0];
  assert.equal(promotion.sourceCoordinateStatus, "declared-by-policy");
  assert.equal(promotion.promotedProfile, promotion.targetPrimitive.profile.hash);
  assert.deepEqual(promotion.targetPrimitive.ontologyCoordinate, {
    level: 1,
    phase: "custom:effective-carrier"
  });
  assert.deepEqual(promotion.targetPrimitive.axisProvenance, {
    ontologyLevel: "declared",
    ontologyPhase: "declared"
  });
  const { promotionHash, ...promotionBasis } = promotion;
  assert.equal(
    promotionHash,
    hashCanonical(HASH_DOMAINS.CARRIER_PROMOTION, promotionBasis)
  );
  const { promotionSetHash, ...setBasis } = result;
  assert.equal(
    promotionSetHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_CARRIER_PROMOTIONS, setBasis)
  );
  assert.deepEqual(
    verifyPackageCarrierPromotions(
      result,
      loaded,
      config,
      ladder,
      collapse,
      1,
      policy
    ),
    result
  );

  const target = loadKernelPackage({
    schemaVersion: "1",
    id: "promoted-target-package",
    version: "1.0.0",
    evidence: loaded.normalized.evidence,
    claims: loaded.normalized.claims,
    primitives: result.promotions.map((entry) => entry.targetPrimitive)
  });
  assert.equal(target.normalized.primitives.length, 1);
  assert.equal(target.normalized.primitives[0].ontologyCoordinate.level, 1);

  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  assert.equal(
    kernel.promoteCarriers({
      package: loaded,
      config,
      ladder,
      collapse,
      depths: 1,
      policy
    }).promotionSetHash,
    result.promotionSetHash
  );
  assert.ok(kernel.capabilities.implemented.includes(
    "package-carrier-promotion-materialization"
  ));
});

test("promotion rejects incomplete evidence and tampered artifacts", () => {
  const { loaded, config, ladder, collapse } = pipeline();
  const policy = promotionPolicy();
  const result = materializePackageCarrierPromotions(
    loaded,
    config,
    ladder,
    collapse,
    1,
    policy
  );
  const tampered = canonicalClone(result);
  tampered.promotions[0].targetPrimitive.typeTags = ["tampered"];
  assert.throws(
    () => verifyPackageCarrierPromotions(
      tampered,
      loaded,
      config,
      ladder,
      collapse,
      1,
      policy
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CARRIER_PROMOTION_MISMATCH"
  );

  const missingEvidence = { ...policy, evidence: [] };
  assert.throws(
    () => materializePackageCarrierPromotions(
      loaded,
      config,
      ladder,
      collapse,
      1,
      missingEvidence
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CARRIER_PROMOTION_STRING_SET_INVALID"
  );

  const reversedLevels = {
    ...policy,
    sourceCoordinate: { level: 1 },
    targetCoordinate: { level: 0 }
  };
  assert.throws(
    () => materializePackageCarrierPromotions(
      loaded,
      config,
      ladder,
      collapse,
      1,
      reversedLevels
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CARRIER_PROMOTION_LEVEL_ORDER_INVALID"
  );
});

test("collapse counterexamples require their exact frozen disposition", () => {
  const loaded = mismatchLoadedFixture();
  const config = mismatchRunConfig();
  const ladder = closePackageLadder(loaded, config, 1);
  const collapse = testPackageProfileCollapse(loaded, config, 1);
  assert.equal(collapse.verdict, "counterexample");

  const blocked = materializePackageCarrierPromotions(
    loaded,
    config,
    ladder,
    collapse,
    1,
    promotionPolicy("block")
  );
  assert.equal(blocked.status, "counterexample");
  assert.equal(blocked.interpretation.reasons[0], "collapse-counterexample-blocked");
  assert.deepEqual(blocked.promotions, []);
  assert.ok(blocked.decisions.every((entry) => entry.outcome === "blocked"));

  const recorded = materializePackageCarrierPromotions(
    loaded,
    config,
    ladder,
    collapse,
    1,
    promotionPolicy("record-and-promote")
  );
  assert.equal(recorded.status, "counterexample");
  assert.equal(
    recorded.interpretation.reasons[0],
    "collapse-counterexample-recorded-and-accepted"
  );
  assert.equal(recorded.promotions.length, 1);
  assert.deepEqual(recorded.collapseBasis.counterexample, collapse.counterexample);
});
