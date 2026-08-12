import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  admitPackageSelectors,
  canonicalClone,
  constructPackageCohorts,
  createKernel,
  evaluatePackageCandidateCensus,
  evaluatePackageSelectorSensitivity,
  hashCanonical,
  loadKernelPackage,
  materializePackageSelectedFormations,
  rankPackageSelector,
  verifyPackageSelectedFormations
} from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}`;

function quantity(value, semantic = "score") {
  return {
    value,
    unit: "1",
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function primitive(sourceId) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [sourceId],
    invariants: {},
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function packageFixture({ selectors = true } = {}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-selected-formations-fixture",
    version: "1.0.0",
    evidence: [{
      id: "fixture-evidence",
      state: "computationally-verified",
      source: {
        path: "fixture.json",
        mediaType: "application/json",
        schemaVersion: "1",
        bytes: 1,
        hash: HASH_A
      }
    }],
    claims: [
      {
        id: "predicate-claim",
        statement: "The singleton is connected.",
        state: "package-operationalization",
        evidence: ["fixture-evidence"]
      },
      {
        id: "functional-claim",
        statement: "The fixture score is admissible.",
        state: "package-operationalization",
        evidence: ["fixture-evidence"]
      },
      {
        id: "selector-claim",
        statement: "Minimum fixture score is selected.",
        state: "package-operationalization",
        evidence: ["fixture-evidence"]
      }
    ],
    primitives: [primitive("source-b"), primitive("source-a")],
    predicates: [{
      id: "connected",
      phase: "formation",
      monotoneViolation: false,
      referencesDepth: "below",
      expr: { op: "connected" },
      explain: { pass: "connected", fail: "disconnected", indeterminate: "unknown" },
      claimRefs: ["predicate-claim"]
    }],
    functionals: selectors ? [{
      id: "fixture-score",
      expr: { kind: "constant", value: 0 },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "fixture-score-result",
        unit: "1",
        semantic: "score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "constant fixture score",
      claimRefs: ["functional-claim"]
    }] : [],
    cohortRules: selectors ? [{ id: "all", kind: "global" }] : [],
    selectors: selectors ? [{
      id: "minimum-score",
      objective: "min",
      functional: "fixture-score",
      cohortRule: "all",
      epsilon: quantity(0),
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 0.9,
        robustTopKThreshold: 0.9
      },
      explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
      claimRefs: ["selector-claim"]
    }] : []
  });
}

function runConfig(countingDomain = "profile-quotient") {
  return {
    schemaVersion: "1",
    countingDomain,
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 100,
      perturbationSamples: 10,
      nullModelRuns: 0
    },
    seed: "package-selected-formations-fixture-v1",
    invariantPrecision: {
      id: "formation-precision-v1",
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
      id: "formation-substructure-v1",
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

function pipeline(loaded, config) {
  const census = evaluatePackageCandidateCensus(loaded, config);
  const selectorExecutions = loaded.normalized.selectors.map((selector) => {
    const partition = constructPackageCohorts(
      loaded,
      config,
      census,
      selector.cohortRule
    );
    const ranking = rankPackageSelector(
      loaded,
      config,
      census,
      partition,
      selector.id
    );
    return {
      selectorId: selector.id,
      partition,
      ranking,
      sensitivity: evaluatePackageSelectorSensitivity(
        loaded,
        config,
        census,
        partition,
        ranking
      )
    };
  });
  const admission = admitPackageSelectors(
    loaded,
    config,
    census,
    selectorExecutions
  );
  return { census, admission };
}

test("selected formations preserve profile resolution and complete claim lineage", () => {
  const loaded = packageFixture();
  const config = runConfig();
  const { census, admission } = pipeline(loaded, config);
  const result = materializePackageSelectedFormations(
    loaded,
    config,
    census,
    admission
  );

  assert.equal(result.materializer, "package-selected-formations-v1");
  assert.equal(result.countingDomain, "profile-quotient");
  assert.equal(result.formations.length, 1);
  assert.equal(result.counts.selectedCandidates, 1);
  assert.equal(result.counts.selectedFormations, 1);
  const formation = result.formations[0];
  assert.equal(formation.candidateId, result.selectedCandidateIds[0]);
  assert.equal(formation.constituents[0].resolution, "profile-representative");
  assert.equal(formation.constituents[0].profileClassMembers.length, 2);
  assert.deepEqual(formation.admittedBy, ["connected"]);
  assert.deepEqual(formation.selectedBy, ["minimum-score"]);
  assert.deepEqual(formation.claimRefs, [
    "functional-claim",
    "predicate-claim",
    "selector-claim"
  ]);
  assert.deepEqual(formation.evidence, ["fixture-evidence"]);
  assert.equal(formation.selectionWitnesses.length, 1);
  assert.equal(formation.selectionWitnesses[0].selectorId, "minimum-score");
  const { formationHash, ...formationBasis } = formation;
  assert.equal(
    formationHash,
    hashCanonical(HASH_DOMAINS.SELECTED_FORMATION, formationBasis)
  );
  const { formationSetHash, ...basis } = result;
  assert.equal(
    formationSetHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_SELECTED_FORMATIONS, basis)
  );
  assert.deepEqual(
    verifyPackageSelectedFormations(result, loaded, config, census, admission),
    result
  );
  assert.ok(Object.isFrozen(result));
});

test("identity admission materializes every exact selected formation in canonical order", () => {
  const loaded = packageFixture({ selectors: false });
  const config = runConfig("element-exact");
  const { census, admission } = pipeline(loaded, config);
  const result = materializePackageSelectedFormations(
    loaded,
    config,
    census,
    admission
  );

  assert.equal(result.formations.length, 2);
  assert.deepEqual(
    result.formations.map((entry) => entry.candidateId),
    [...result.selectedCandidateIds].sort()
  );
  assert.ok(result.formations.every(
    (entry) => entry.selectedBy.length === 0 &&
      entry.selectionWitnesses.length === 0 &&
      entry.constituents[0].resolution === "element-exact"
  ));
});

test("selected formation replay rejects tampering, stale admission, and unknown options", () => {
  const loaded = packageFixture();
  const config = runConfig();
  const { census, admission } = pipeline(loaded, config);
  const result = materializePackageSelectedFormations(
    loaded,
    config,
    census,
    admission
  );
  const tampered = canonicalClone(result);
  tampered.formations[0].selectedBy = [];

  assert.throws(
    () => verifyPackageSelectedFormations(
      tampered,
      loaded,
      config,
      census,
      admission
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTED_FORMATIONS_MISMATCH"
  );
  const staleAdmission = canonicalClone(admission);
  staleAdmission.selectedCandidateIds = [];
  assert.throws(
    () => materializePackageSelectedFormations(
      loaded,
      config,
      census,
      staleAdmission
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTOR_ADMISSION_MISMATCH"
  );
  assert.throws(
    () => materializePackageSelectedFormations(
      loaded,
      config,
      census,
      admission,
      { unexpected: true }
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_SELECTED_FORMATIONS_OPTION_UNKNOWN"
  );
});

test("kernel exposes selected formation materialization and verification", () => {
  const loaded = packageFixture();
  const config = runConfig();
  const { census, admission } = pipeline(loaded, config);
  const kernel = createKernel({ version: loaded.semanticManifest.kernelVersion });
  const result = kernel.materializePackageSelectedFormations(
    loaded,
    config,
    census,
    admission
  );

  assert.ok(kernel.capabilities.implemented.includes(
    "package-selected-formation-materialization"
  ));
  assert.deepEqual(
    kernel.verifyPackageSelectedFormations(
      result,
      loaded,
      config,
      census,
      admission
    ),
    result
  );
});
