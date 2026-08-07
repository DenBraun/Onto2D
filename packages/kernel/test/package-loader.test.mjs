import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelNotImplementedError,
  KernelValidationError,
  createKernel,
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

function validPackage() {
  return {
    schemaVersion: "1",
    id: "fixture-package",
    version: "1.0.0",
    primitives: [
      primitive("source-b", "beta"),
      primitive("source-a", "alpha")
    ]
  };
}

function quantity(value, unit, semantic, evidence = []) {
  return {
    value,
    unit,
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence }
  };
}

function addSelectorFixture(source, { amplitude = 0.1, epsilonUnit = "1" } = {}) {
  source.functionals = [{
    id: "score",
    expr: { kind: "constant", value: 0 },
    coefficients: {},
    sensitivityCoefficients: [],
    result: {
      id: "score-value",
      unit: "1",
      semantic: "fixture score",
      toleranceTarget: { absolute: 0 }
    },
    explain: "fixture functional",
    claimRefs: []
  }];
  source.cohortRules = [{ id: "all", kind: "global" }];
  source.selectors = [{
    id: "select-score",
    objective: "min",
    functional: "score",
    cohortRule: "all",
    epsilon: quantity(0, epsilonUnit, "score equivalence"),
    tiePolicy: "retain-all",
    sensitivity: {
      amplitudes: [amplitude],
      sweep: "one-at-a-time",
      topK: 1,
      robustLeaderSetThreshold: 0.9,
      robustTopKThreshold: 0.9
    },
    explain: { pass: "selected", fail: "not selected", indeterminate: "unknown" },
    claimRefs: []
  }];
}

test("package loading materializes defaults and stable semantic identities", () => {
  const first = loadKernelPackage(validPackage(), { kernelVersion: "test" });
  const reordered = validPackage();
  reordered.primitives.reverse();
  const second = loadKernelPackage(reordered, { kernelVersion: "test" });

  assert.equal(first.packageId, second.packageId);
  assert.equal(first.semanticManifest.depthBasis, second.semanticManifest.depthBasis);
  assert.equal(first.normalized.partialOraclePolicy.mode, "indeterminate");
  assert.equal(first.normalized.ontologyAxes.levelPolicy, "declared");
  assert.ok(first.normalized.primitives.every((entry) => entry.elementId.startsWith("sha256:")));
  assert.ok(Object.isFrozen(first));
  assert.throws(() => loadKernelPackage(validPackage(), { unknown: true }), TypeError);
});

test("package loading rejects current-depth predicate references", () => {
  const source = validPackage();
  source.predicates = [{
    id: "self-reference",
    phase: "formation",
    monotoneViolation: false,
    referencesDepth: "self",
    expr: { op: "connected" },
    explain: { pass: "pass", fail: "fail", indeterminate: "unknown" },
    claimRefs: []
  }];

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "STRATIFICATION_SELF_REFERENCE")
  );
});

test("package loading rejects cyclic ontology phase precedence", () => {
  const source = validPackage();
  source.ontologyAxes = {
    levelPolicy: "declared",
    phasePrecedence: [
      { before: "A", after: "B" },
      { before: "B", after: "A" }
    ]
  };

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "ONTOLOGY_COORDINATE_PHASE_CYCLE")
  );
});

test("package loading rejects unresolved claim references", () => {
  const source = validPackage();
  source.primitives[0].claimRefs = ["missing-claim"];

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PACKAGE_CLAIM_REFERENCE_MISSING")
  );
});

test("package loading rejects malformed quantities before identity hashing", () => {
  const source = validPackage();
  source.primitives[0].invariants.mass = {
    value: 1,
    unit: "kg",
    tolerance: {},
    semantic: "fixture mass",
    provenance: { kind: "declared", evidence: [] }
  };

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "QUANTITY_TOLERANCE_MISSING")
  );

  const overflowing = validPackage();
  overflowing.primitives[0].invariants.distance = quantity(1e308, "km", "fixture distance");
  assert.throws(
    () => loadKernelPackage(overflowing),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "QUANTITY_CONVERSION_OVERFLOW")
  );

  const underflowing = validPackage();
  underflowing.primitives[0].invariants.distance = quantity(Number.MIN_VALUE, "cm", "fixture distance");
  assert.throws(
    () => loadKernelPackage(underflowing),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "QUANTITY_CONVERSION_UNDERFLOW")
  );

  const paddedSemantic = validPackage();
  paddedSemantic.primitives[0].invariants.distance = quantity(1, "m", " fixture distance ");
  assert.throws(
    () => loadKernelPackage(paddedSemantic),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PACKAGE_IDENTIFIER_NOT_NORMALIZED")
  );
});

test("quantity evidence changes package provenance but not primitive or profile identity", () => {
  const withoutEvidence = validPackage();
  withoutEvidence.primitives[0].invariants.mass = quantity(1, "kg", "fixture mass");
  withoutEvidence.primitives[0].profile.invariantVector = [{
    semantic: "fixture mass",
    normalized: quantity(1, "kg", "fixture mass"),
    quantization: quantity(0.01, "kg", "fixture mass quantization")
  }];

  const withEvidence = validPackage();
  withEvidence.evidence = [{
    id: "mass-source",
    state: "paper-assumption",
    source: {
      path: "evidence/mass-source.txt",
      mediaType: "text/plain",
      schemaVersion: "1",
      bytes: 1,
      hash: `sha256:${"d".repeat(64)}`
    }
  }];
  withEvidence.primitives[0].invariants.mass = quantity(1, "kg", "fixture mass", ["mass-source"]);
  withEvidence.primitives[0].profile.invariantVector = [{
    semantic: "fixture mass",
    normalized: quantity(1, "kg", "fixture mass", ["mass-source"]),
    quantization: quantity(0.01, "kg", "fixture mass quantization", ["mass-source"])
  }];

  const first = loadKernelPackage(withoutEvidence);
  const second = loadKernelPackage(withEvidence);
  const firstPrimitive = first.normalized.primitives.find((entry) => entry.sourceId === "source-b");
  const secondPrimitive = second.normalized.primitives.find((entry) => entry.sourceId === "source-b");
  assert.equal(firstPrimitive.elementId, secondPrimitive.elementId);
  assert.equal(firstPrimitive.profile.hash, secondPrimitive.profile.hash);
  assert.notEqual(first.packageId, second.packageId);
});

test("partial-oracle residual evidence order does not change package identity", () => {
  const first = validPackage();
  first.evidence = [
    {
      id: "evidence-a",
      state: "paper-assumption",
      source: {
        path: "evidence/a.txt",
        mediaType: "text/plain",
        schemaVersion: "1",
        bytes: 1,
        hash: `sha256:${"a".repeat(64)}`
      }
    },
    {
      id: "evidence-b",
      state: "paper-assumption",
      source: {
        path: "evidence/b.txt",
        mediaType: "text/plain",
        schemaVersion: "1",
        bytes: 1,
        hash: `sha256:${"b".repeat(64)}`
      }
    }
  ];
  first.partialOraclePolicy = {
    mode: "accept-expanded-tolerance",
    toleranceMultiplier: 2,
    maximumResidual: quantity(0.1, "1", "maximum residual", ["evidence-b", "evidence-a"])
  };
  const second = structuredClone(first);
  second.partialOraclePolicy.maximumResidual.provenance.evidence.reverse();

  assert.equal(loadKernelPackage(first).packageId, loadKernelPackage(second).packageId);
});

test("package loading rejects unavailable profile derivation policy", () => {
  const source = validPackage();
  source.profileDefinition = { kind: "derived-from-rules" };
  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PACKAGE_PROFILE_DEFINITION_UNAVAILABLE")
  );
});

test("selector sensitivity amplitudes must remain below one", () => {
  const source = validPackage();
  addSelectorFixture(source, { amplitude: 1 });
  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "SENSITIVITY_AMPLITUDE_INVALID")
  );
});

test("selector epsilon uses the functional result unit", () => {
  const source = validPackage();
  addSelectorFixture(source, { epsilonUnit: "kg" });
  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "QUANTITY_UNIT_INCOMPATIBLE")
  );
});

test("package loading normalizes compatible quantity units before hashing", () => {
  const centimeters = validPackage();
  centimeters.primitives[0].invariants.length = quantity(100, "cm", "fixture length");
  centimeters.primitives[0].profile.invariantVector = [{
    semantic: "fixture length",
    normalized: quantity(100, "cm", "fixture length"),
    quantization: quantity(0.01, "m", "fixture length quantization")
  }];
  addSelectorFixture(centimeters, { epsilonUnit: "1" });

  const meters = structuredClone(centimeters);
  meters.primitives[0].invariants.length = quantity(1, "m", "fixture length");
  meters.primitives[0].profile.invariantVector[0].normalized = quantity(1, "m", "fixture length");

  const first = loadKernelPackage(centimeters);
  const second = loadKernelPackage(meters);
  const normalized = first.normalized.primitives.find((entry) => entry.sourceId === "source-b");

  assert.equal(normalized.invariants.length.value, 1);
  assert.equal(normalized.invariants.length.unit, "m");
  assert.equal(first.packageId, second.packageId);
});

test("quantity specifications convert absolute tolerance with their unit", () => {
  const source = validPackage();
  addSelectorFixture(source);
  source.functionals[0].result.unit = "cm";
  source.functionals[0].result.semantic = "fixture length";
  source.functionals[0].result.toleranceTarget = { absolute: 1 };
  source.functionals[0].expr = { kind: "constant", value: quantity(0, "cm", "fixture length") };
  source.selectors[0].epsilon = quantity(0, "m", "fixture length equivalence");

  const loaded = loadKernelPackage(source);
  assert.equal(loaded.normalized.functionals[0].result.unit, "m");
  assert.equal(loaded.normalized.functionals[0].result.toleranceTarget.absolute, 0.01);
});

test("source migration cannot bypass unfinished reconciliation", () => {
  const source = validPackage();
  source.sourceMigration = {};

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "SOURCE_CLASSIFICATION_FOUNDATION_UNAVAILABLE")
  );
});

test("kernel exposes package loading but keeps closure unavailable", async () => {
  const kernel = createKernel({ version: "test" });
  const loaded = await kernel.loadPackage(validPackage());
  assert.equal(loaded.semanticManifest.kernelVersion, "test");
  await assert.rejects(
    kernel.closeLevel({ package: loaded }),
    (error) => error instanceof KernelNotImplementedError && error.capability === "closure"
  );
});
