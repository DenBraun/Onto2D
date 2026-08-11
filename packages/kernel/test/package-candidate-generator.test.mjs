import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelValidationError,
  canonicalClone,
  canonicalize,
  createPackageCandidateBinding,
  enumeratePackageCandidates,
  loadKernelPackage
} from "../src/index.js";

function primitive(sourceId, typeTag) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [typeTag],
    invariants: {},
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function loadedPackage() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-candidate-fixture",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ]
  });
}

function runConfig(overrides = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["transforms", "supports"],
    budget: {
      maxNodes: 2,
      maxEdges: 1,
      maxCandidates: 100,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-candidate-fixture-v1",
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

test("package binding derives exact/profile alphabets, profile provenance, skeletons, and run budgets", () => {
  const loaded = loadedPackage();
  const exact = createPackageCandidateBinding(loaded, runConfig());
  const quotient = createPackageCandidateBinding(loaded, runConfig({
    countingDomain: "profile-quotient",
    roleAlphabet: ["supports", "transforms"]
  }));

  assert.equal(exact.binder, "package-candidate-binding-v1");
  assert.equal(exact.packageId, loaded.packageId);
  assert.equal(exact.depthBasis, loaded.semanticManifest.depthBasis);
  assert.equal(exact.sourcePopulation.kind, "primitive-depth-population-selection-v1");
  assert.equal(exact.sourcePopulation.population.depth, 0);
  assert.equal(
    exact.sourcePopulation.population.populationHash,
    quotient.sourcePopulation.population.populationHash
  );
  assert.deepEqual(exact.sourcePopulation.selection, {
    sourceDepths: "all-below",
    targetDepth: 1,
    availableDepths: [0],
    selectedDepths: [0]
  });
  assert.equal(exact.enumerationInput.skeletons.length, 2);
  assert.deepEqual(
    exact.enumerationInput.nodeVariants.map((entry) => entry.ref),
    loaded.normalized.primitives.map((entry) => entry.elementId).sort()
  );
  assert.deepEqual(
    exact.enumerationInput.edgeVariants.map((entry) => entry.role),
    ["supports", "transforms"]
  );
  assert.equal(exact.sourcePopulation.profileClasses.length, 1);
  assert.equal(exact.sourcePopulation.profileClasses[0].members.length, 2);
  assert.equal(
    exact.sourcePopulation.profileClasses[0].representativeElementId,
    [...exact.sourcePopulation.profileClasses[0].members].sort()[0]
  );
  assert.equal(quotient.enumerationInput.nodeVariants.length, 1);
  assert.equal(
    quotient.enumerationInput.nodeVariants[0].ref,
    exact.sourcePopulation.profileClasses[0].profileHash
  );
  assert.equal(exact.enumerationOptions.maxEdges, 1);
  assert.equal(exact.enumerationOptions.maxCandidates, 100);
  assert.ok(Object.isFrozen(exact));
  assert.ok(Object.isFrozen(exact.enumerationInput.skeletons));
});

test("package binding is invariant to normalized run set order", () => {
  const loaded = loadedPackage();
  const first = createPackageCandidateBinding(loaded, runConfig());
  const second = createPackageCandidateBinding(loaded, runConfig({
    roleAlphabet: ["supports", "transforms"]
  }));
  assert.equal(first.bindingHash, second.bindingHash);
  assert.equal(canonicalize(first), canonicalize(second));
});

test("primitive depth selection discloses the source-depth policy even when depth zero is equivalent", () => {
  const allBelow = createPackageCandidateBinding(loadedPackage(), runConfig());
  const previous = createPackageCandidateBinding(loadedPackage(), runConfig({
    sourceDepths: "previous-only"
  }));

  assert.deepEqual(allBelow.sourcePopulation.selection.selectedDepths, [0]);
  assert.deepEqual(previous.sourcePopulation.selection.selectedDepths, [0]);
  assert.equal(previous.sourcePopulation.selection.sourceDepths, "previous-only");
  assert.equal(
    allBelow.sourcePopulation.population.populationHash,
    previous.sourcePopulation.population.populationHash
  );
  assert.notEqual(allBelow.bindingHash, previous.bindingHash);
});

test("package enumeration executes the bound finite universe and retains provenance", () => {
  const config = runConfig({
    roleAlphabet: ["supports"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  });
  const result = enumeratePackageCandidates(loadedPackage(), config);

  assert.equal(result.generator, "package-candidate-generator-v1");
  assert.equal(result.enumeration.status, "complete");
  assert.equal(result.enumeration.interpretable, true);
  assert.equal(result.enumeration.counts.generatedCandidates, 2);
  assert.equal(result.enumeration.counts.canonicalCandidates, 2);
  assert.equal(result.binding.bindingHash.length, 71);
  assert.equal(result.binding.runConfig.budget.maxNodes, 1);
  assert.ok(Object.isFrozen(result));
});

test("package enumeration reports execution-budget exhaustion without changing the run budget", () => {
  const result = enumeratePackageCandidates(loadedPackage(), runConfig({
    roleAlphabet: ["supports"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    }
  }), { maxRawCandidates: 1 });

  assert.equal(result.enumeration.status, "budget-exhausted");
  assert.equal(result.enumeration.budget.exhausted?.budget, "maxRawCandidates");
  assert.equal(result.binding.enumerationOptions.maxCandidates, 10);
  assert.equal(result.binding.enumerationOptions.maxRawCandidates, 1);
});

test("package binding reproduces loader output instead of trusting loaded-package labels", () => {
  const tampered = canonicalClone(loadedPackage());
  tampered.packageId = `sha256:${"f".repeat(64)}`;

  assert.throws(
    () => createPackageCandidateBinding(tampered, runConfig()),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "PACKAGE_CANDIDATE_LOADED_PACKAGE_MISMATCH")
  );
});

test("package binding rejects generator semantics that are not implemented", () => {
  const cases = [
    [
      runConfig({ countingDomain: "single-candidate" }),
      "PACKAGE_CANDIDATE_SINGLE_CANDIDATE_UNSUPPORTED"
    ],
    [
      runConfig({ graphPolicy: { ...runConfig().graphPolicy, connected: false } }),
      "PACKAGE_CANDIDATE_CONNECTED_POLICY_REQUIRED"
    ],
    [
      runConfig({
        graphPolicy: {
          ...runConfig().graphPolicy,
          structuralNodeAttributes: ["mass"]
        }
      }),
      "PACKAGE_CANDIDATE_NODE_ATTRIBUTES_UNAVAILABLE"
    ],
    [
      runConfig({
        budget: {
          ...runConfig().budget,
          maxWallTimeMs: 100
        }
      }),
      "PACKAGE_CANDIDATE_RESOURCE_BUDGET_UNSUPPORTED"
    ],
    [
      runConfig(),
      "PACKAGE_CANDIDATE_SEARCH_BUDGET_TOO_SMALL",
      { maxSearchStates: 1 }
    ]
  ];

  for (const [config, code, options] of cases) {
    assert.throws(
      () => createPackageCandidateBinding(loadedPackage(), config, options),
      (error) => error instanceof KernelValidationError &&
        error.issues.some((entry) => entry.code === code),
      code
    );
  }
});
