import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RUN_BUDGET,
  KernelValidationError,
  RUN_CONFIG_NORMALIZER_VERSION,
  canonicalize,
  normalizeRunConfig
} from "../src/index.js";

function validConfig(overrides = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "profile-quotient",
    sourceDepths: "all-below",
    reportAxes: ["ontology-phase", "derivation-depth"],
    roleAlphabet: ["transforms", "supports"],
    seed: "run-config-fixture-v1",
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
    nullModels: ["uniform", "role-shuffle"],
    evidencePolicy: "require-all",
    indeterminateThreshold: 0.05,
    ...overrides
  };
}

test("run configuration normalization materializes documented budgets and canonical sets", () => {
  const first = normalizeRunConfig(validConfig({
    levelBoundaryPolicy: {
      enabled: true,
      searchIntervals: [
        { fromDepth: 4, toDepth: 6 },
        { fromDepth: 0, toDepth: 2 }
      ],
      maximumCollapseError: 0.1,
      tieTolerance: 0
    }
  }));
  const reordered = validConfig({
    reportAxes: ["derivation-depth", "ontology-phase"],
    roleAlphabet: ["supports", "transforms"],
    nullModels: ["role-shuffle", "uniform"],
    levelBoundaryPolicy: {
      enabled: true,
      searchIntervals: [
        { fromDepth: 0, toDepth: 2 },
        { fromDepth: 4, toDepth: 6 }
      ],
      maximumCollapseError: 0.1,
      tieTolerance: 0
    }
  });
  const second = normalizeRunConfig(reordered);

  assert.equal(RUN_CONFIG_NORMALIZER_VERSION, "run-config-normalizer-v1");
  assert.deepEqual(first.budget, DEFAULT_RUN_BUDGET);
  assert.deepEqual(first.reportAxes, ["derivation-depth", "ontology-phase"]);
  assert.deepEqual(first.roleAlphabet, ["supports", "transforms"]);
  assert.deepEqual(first.nullModels, ["role-shuffle", "uniform"]);
  assert.equal(canonicalize(first), canonicalize(second));
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.budget));
});

test("run budget accepts partial overrides without environment-dependent defaults", () => {
  const normalized = normalizeRunConfig(validConfig({
    budget: { maxNodes: 2, maxCandidates: 17 }
  }));
  assert.deepEqual(normalized.budget, {
    maxNodes: 2,
    maxEdges: "n+2",
    maxCandidates: 17,
    perturbationSamples: 200,
    nullModelRuns: 500
  });
});

test("run configuration rejects unknown, duplicate, incomplete, and out-of-range semantics together", () => {
  const input = validConfig({
    unexpected: true,
    roleAlphabet: ["supports", "supports"],
    budget: { maxNodes: 7 },
    graphPolicy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: []
    },
    indeterminateThreshold: 1.1,
    levelBoundaryPolicy: {
      enabled: true,
      searchIntervals: [{ fromDepth: 3, toDepth: 2 }],
      maximumCollapseError: 0,
      tieTolerance: 0
    }
  });

  assert.throws(
    () => normalizeRunConfig(input),
    (error) => {
      if (!(error instanceof KernelValidationError)) return false;
      const codes = new Set(error.issues.map((entry) => entry.code));
      return error.code === "RUN_CONFIG_VALIDATION_FAILED" &&
        error.stage === "NORMALIZE_RUN_CONFIG" &&
        codes.has("RUN_CONFIG_FIELD_UNKNOWN") &&
        codes.has("RUN_CONFIG_ARRAY_VALUE_DUPLICATE") &&
        codes.has("RUN_CONFIG_MAX_NODES_INVALID") &&
        codes.has("RUN_CONFIG_FIELD_REQUIRED") &&
        codes.has("RUN_CONFIG_INDETERMINATE_THRESHOLD_INVALID") &&
        codes.has("RUN_CONFIG_SEARCH_INTERVAL_REVERSED");
    }
  );
});

test("run configuration rejects invalid precision policy through the common issue contract", () => {
  assert.throws(
    () => normalizeRunConfig(validConfig({
      invariantPrecision: {
        id: "fixture-precision-v1",
        decimalPlaces: 257,
        rounding: "half-even",
        summation: "exact-decimal"
      }
    })),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "DECIMAL_POLICY_INVALID" && entry.path === "$input.invariantPrecision"
      )
  );
});
