import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelValidationError,
  KernelError,
  createPackageCandidateBinding,
  createKernel,
  loadKernelPackage,
  materializePrimitiveDepthPopulation
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

function artifact(index, label) {
  return {
    path: `artifacts/${label}.json`,
    mediaType: "application/json",
    schemaVersion: "1",
    bytes: index,
    hash: `sha256:${index.toString(16).padStart(64, "0")}`
  };
}

function sourceMigrationFixture() {
  const fields = [
    "classificationPolicy",
    "riskPolicy",
    "classificationView",
    "classificationAnnotations",
    "classificationAdjudication",
    "classificationAmendments",
    "classifiedRelations",
    "nodeResolutions",
    "condensation",
    "memberProjections",
    "reconciliation",
    "metrics",
    "explanationIndex"
  ];
  const migration = {
    policyHash: null,
    blindnessStatus: "historically-exposed",
    typedRelationLayers: Array.from(
      { length: 6 },
      (_, index) => artifact(fields.length + index + 1, `typed-layer-${index}`)
    )
  };
  fields.forEach((field, index) => {
    migration[field] = artifact(index + 1, field);
  });
  migration.policyHash = `sha256:${"f".repeat(64)}`;
  return migration;
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

test("package loading normalizes executable finite perturbation definitions", () => {
  const source = validPackage();
  source.perturbations = [
    { id: "delete-node", kind: "node-deletion" },
    {
      id: "delete-edge",
      kind: "edge-deletion",
      enumeration: "sampled-valid-single-edits-v1",
      roles: ["z", "a"]
    },
    {
      id: "replace-role",
      kind: "edge-role-replacement",
      emptyPolicy: "vacuous-pass",
      replacements: [
        { from: "z", to: "a" },
        { from: "a", to: "z" }
      ]
    },
    {
      id: "move-value",
      kind: "numeric-attribute-displacement",
      target: "nodes",
      attribute: "mass",
      epsilon: 0.25,
      directions: ["increase", "decrease"]
    },
    "registry-only"
  ];
  const loaded = loadKernelPackage(source);
  const byId = new Map(loaded.normalized.perturbations.map((entry) => [
    typeof entry === "string" ? entry : entry.id,
    entry
  ]));

  assert.equal(byId.get("registry-only"), "registry-only");
  assert.equal(
    byId.get("delete-node").enumeration,
    "exhaustive-valid-single-edits-v1"
  );
  assert.equal(byId.get("delete-node").emptyPolicy, "indeterminate");
  assert.equal(
    byId.get("delete-edge").enumeration,
    "sampled-valid-single-edits-v1"
  );
  assert.deepEqual(byId.get("delete-edge").roles, ["a", "z"]);
  assert.deepEqual(byId.get("move-value").directions, ["decrease", "increase"]);
  assert.deepEqual(byId.get("replace-role").replacements, [
    { from: "a", to: "z" },
    { from: "z", to: "a" }
  ]);
  const reorderedSource = structuredClone(source);
  reorderedSource.perturbations.reverse();
  for (const entry of reorderedSource.perturbations) {
    if (typeof entry === "string") continue;
    if (entry.roles !== undefined) entry.roles.reverse();
    if (entry.replacements !== undefined) entry.replacements.reverse();
    if (entry.directions !== undefined) entry.directions.reverse();
  }
  const reordered = loadKernelPackage(reorderedSource);
  assert.equal(reordered.packageId, loaded.packageId);
  assert.equal(reordered.semanticManifest.rulesHash, loaded.semanticManifest.rulesHash);

  for (const invalid of [
    { id: "bad-kind", kind: "sampled-edge-deletion" },
    {
      id: "noop-role",
      kind: "edge-role-replacement",
      replacements: [{ from: "support", to: "support" }]
    },
    {
      id: "bad-epsilon",
      kind: "numeric-attribute-displacement",
      target: "nodes",
      attribute: "mass",
      epsilon: 0
    },
    {
      id: "sampled",
      kind: "edge-deletion",
      enumeration: "sampled-v1"
    },
    { id: "x".repeat(1_025), kind: "node-deletion" }
  ]) {
    const invalidSource = validPackage();
    invalidSource.perturbations = [invalid];
    assert.throws(
      () => loadKernelPackage(invalidSource),
      (error) => error instanceof KernelValidationError &&
        error.issues.some((issue) => issue.path.startsWith("$.perturbations[0]"))
    );
  }
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

  const loaded = loadKernelPackage(source, {
    allowCurrentDepthReferences: true
  });
  assert.equal(loaded.normalized.predicates[0].referencesDepth, "self");
  const invalidDepth = structuredClone(source);
  invalidDepth.predicates[0].referencesDepth = "future";
  assert.throws(
    () => loadKernelPackage(invalidDepth, {
      allowCurrentDepthReferences: true
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PREDICATE_TYPE_DEPTH_REFERENCE_INVALID"
      )
  );
  const config = {
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
    seed: "self-reference-gate-v1",
    invariantPrecision: {
      id: "self-reference-precision-v1",
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
      id: "self-reference-substructure-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
  assert.throws(
    () => createPackageCandidateBinding(loaded, config),
    (error) => error instanceof KernelError &&
      error.code === "STRATIFICATION_SELF_REFERENCE_REQUIRES_FIXPOINT"
  );
  assert.throws(
    () => createPackageCandidateBinding(loaded, {
      ...config,
      boundedFixpoint: { enabled: true, maxIterations: 2 }
    }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_BOUNDED_FIXPOINT_COORDINATOR_REQUIRED"
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

test("package loading normalizes scalar invariants and rejects mixed declarations", () => {
  const source = validPackage();
  source.primitives[0].invariants = {
    score: -0,
    label: "beta",
    enabled: true,
    absent: null
  };
  source.primitives[1].invariants = {
    score: 0,
    label: "alpha",
    enabled: true,
    absent: null
  };

  const loaded = loadKernelPackage(source);
  const beta = loaded.normalized.primitives.find((entry) =>
    entry.sourceId === "source-b"
  );
  assert.equal(beta.invariants.score, 0);
  assert.equal(Object.is(beta.invariants.score, -0), false);
  assert.deepEqual(beta.invariants, {
    absent: null,
    enabled: true,
    label: "beta",
    score: 0
  });

  const reordered = structuredClone(source);
  reordered.primitives.reverse();
  reordered.primitives.forEach((entry) => {
    entry.invariants = Object.fromEntries(Object.entries(entry.invariants).reverse());
  });
  assert.equal(loadKernelPackage(reordered).packageId, loaded.packageId);

  const mixed = validPackage();
  mixed.primitives[0].invariants.state = 1;
  mixed.primitives[1].invariants.state = "one";
  assert.throws(
    () => loadKernelPackage(mixed),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "EXPRESSION_INVARIANT_TYPE_CONFLICT" &&
        issue.details.previousKind === "number" &&
        issue.details.kind === "string"
      )
  );

  const scalarQuantityConflict = validPackage();
  scalarQuantityConflict.primitives[0].invariants.state = 1;
  scalarQuantityConflict.primitives[1].invariants.state = quantity(
    1,
    "1",
    "state"
  );
  assert.throws(
    () => loadKernelPackage(scalarQuantityConflict),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "EXPRESSION_INVARIANT_TYPE_CONFLICT" &&
        issue.details.previousKind === "number" &&
        issue.details.kind === "quantity"
      )
  );

  const maximumString = validPackage();
  maximumString.primitives[0].invariants.label = "x".repeat(1_024);
  assert.equal(
    loadKernelPackage(maximumString).normalized.primitives
      .find((entry) => entry.sourceId === "source-b").invariants.label.length,
    1_024
  );

  const oversized = validPackage();
  oversized.primitives[0].invariants.label = "x".repeat(1_025);
  assert.throws(
    () => loadKernelPackage(oversized),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_INVARIANT_STRING_LIMIT" &&
        issue.details.maximumLength === 1_024
      )
  );

  const composite = validPackage();
  composite.primitives[0].invariants.invalid = [];
  assert.throws(
    () => loadKernelPackage(composite),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_INVARIANT_VALUE_INVALID" &&
        issue.details.actualKind === "array"
      )
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

test("package loading normalizes Quantity candidate attributes and binds evidence", () => {
  const source = validPackage();
  source.evidence = [{
    id: "attribute-source",
    state: "paper-assumption",
    source: {
      path: "evidence/attribute-source.txt",
      mediaType: "text/plain",
      schemaVersion: "1",
      bytes: 1,
      hash: `sha256:${"e".repeat(64)}`
    }
  }];
  source.candidateAttributes = [{
    name: "span",
    target: "edges",
    source: {
      kind: "constant-quantity-v1",
      value: quantity(100, "cm", "length", ["attribute-source"])
    }
  }];
  const loaded = loadKernelPackage(source);
  assert.deepEqual(loaded.normalized.candidateAttributes, [{
    name: "span",
    target: "edges",
    source: {
      kind: "constant-quantity-v1",
      value: quantity(1, "m", "length", ["attribute-source"])
    }
  }]);
  const missingEvidence = structuredClone(source);
  missingEvidence.candidateAttributes[0].source.value.provenance.evidence = [
    "missing"
  ];
  assert.throws(
    () => loadKernelPackage(missingEvidence),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EVIDENCE_REFERENCE_MISSING")
  );
});

test("package loading freezes typed formation-functional attribute carry-forward", () => {
  const source = validPackage();
  for (const entry of source.primitives) {
    entry.invariants.mass = quantity(1, "kg", "mass");
  }
  source.candidateAttributes = [{
    name: "mass",
    target: "nodes",
    source: {
      kind: "element-invariant-quantity-v1",
      invariant: "mass"
    }
  }];
  source.functionals = [{
    id: "formation-mass",
    expr: { kind: "constant", value: quantity(2, "kg", "mass") },
    coefficients: {},
    sensitivityCoefficients: [],
    result: {
      id: "formation-mass-result",
      unit: "kg",
      semantic: "mass",
      toleranceTarget: { absolute: 0 }
    },
    explain: "Carry a formation result into the next source depth.",
    claimRefs: []
  }];
  source.profileDefinition = {
    kind: "residual-slots-v2",
    baseProfile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    derivedTypeTags: ["derived"],
    derivedInvariants: [{
      semantic: "mass",
      functional: "formation-mass",
      quantization: quantity(0.001, "kg", "mass")
    }],
    claimRefs: []
  };

  assert.doesNotThrow(() => loadKernelPackage(source));

  const semanticDrift = structuredClone(source);
  for (const entry of semanticDrift.primitives) {
    entry.invariants.mass.semantic = "primitive mass";
  }
  assert.throws(
    () => loadKernelPackage(semanticDrift),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code ===
          "PACKAGE_CANDIDATE_ATTRIBUTE_CARRY_FORWARD_TYPE_MISMATCH" &&
        issue.details.carriedSource === "formation-functional"
      )
  );

  const scalarDrift = structuredClone(source);
  scalarDrift.candidateAttributes[0].source.kind =
    "element-invariant-scalar-v1";
  for (const entry of scalarDrift.primitives) entry.invariants.mass = 1;
  assert.throws(
    () => loadKernelPackage(scalarDrift),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code ===
          "PACKAGE_CANDIDATE_ATTRIBUTE_CARRY_FORWARD_TYPE_MISMATCH"
      )
  );
});

test("package loading normalizes closed role-dependent edge attribute maps", () => {
  const source = validPackage();
  source.evidence = [{
    id: "role-attribute-source",
    state: "paper-assumption",
    source: {
      path: "evidence/role-attribute-source.txt",
      mediaType: "text/plain",
      schemaVersion: "1",
      bytes: 1,
      hash: `sha256:${"f".repeat(64)}`
    }
  }];
  source.candidateAttributes = [{
    name: "weight",
    target: "edges",
    source: {
      kind: "edge-role-scalar-v1",
      values: { transforms: 1, supports: 2 }
    }
  }, {
    name: "span",
    target: "edges",
    source: {
      kind: "edge-role-quantity-v1",
      values: {
        transforms: quantity(2, "m", "length", ["role-attribute-source"]),
        supports: quantity(100, "cm", "length", ["role-attribute-source"])
      }
    }
  }];
  const loaded = loadKernelPackage(source);
  assert.deepEqual(loaded.normalized.candidateAttributes, [{
    name: "span",
    target: "edges",
    source: {
      kind: "edge-role-quantity-v1",
      values: {
        supports: quantity(1, "m", "length", ["role-attribute-source"]),
        transforms: quantity(2, "m", "length", ["role-attribute-source"])
      }
    }
  }, {
    name: "weight",
    target: "edges",
    source: {
      kind: "edge-role-scalar-v1",
      values: { supports: 2, transforms: 1 }
    }
  }]);
  const reordered = structuredClone(source);
  reordered.candidateAttributes.reverse();
  reordered.candidateAttributes.forEach((definition) => {
    definition.source.values = Object.fromEntries(
      Object.entries(definition.source.values).reverse()
    );
  });
  assert.equal(loadKernelPackage(reordered).packageId, loaded.packageId);

  const missingEvidence = structuredClone(source);
  missingEvidence.candidateAttributes[1].source.values.supports
    .provenance.evidence = ["missing"];
  assert.throws(
    () => loadKernelPackage(missingEvidence),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "EVIDENCE_REFERENCE_MISSING")
  );

  const incompatible = structuredClone(source);
  incompatible.candidateAttributes[1].source.values.transforms =
    quantity(2, "s", "duration", ["role-attribute-source"]);
  assert.throws(
    () => loadKernelPackage(incompatible),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_VALUE_CONFLICT"
      )
  );

  const empty = structuredClone(source);
  empty.candidateAttributes[0].source.values = {};
  assert.throws(
    () => loadKernelPackage(empty),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_MAP_EMPTY"
      )
  );
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

test("package loading normalizes the residual-slot derived-profile policy", () => {
  const source = validPackage();
  source.claims = [{
    id: "profile-policy-claim",
    statement: "Residual slots define the derived interface.",
    state: "package-operationalization",
    evidence: []
  }];
  source.profileDefinition = {
    kind: "residual-slots-v1",
    baseProfile: {
      slots: [
        { role: "zeta", polarity: "sym", capacity: { min: 0, max: null } },
        { role: "alpha", polarity: "out", capacity: { min: 0, max: 1 } }
      ],
      invariantVector: [],
      precisionPolicy: "residual-profile-v1"
    },
    derivedTypeTags: ["zeta", "alpha"],
    claimRefs: ["profile-policy-claim"]
  };
  const loaded = loadKernelPackage(source);
  const reordered = structuredClone(source);
  reordered.profileDefinition.baseProfile.slots.reverse();
  reordered.profileDefinition.derivedTypeTags.reverse();
  const replayed = loadKernelPackage(reordered);

  assert.equal(loaded.packageId, replayed.packageId);
  assert.equal(loaded.normalized.profileDefinition.kind, "residual-slots-v1");
  assert.deepEqual(loaded.normalized.profileDefinition.derivedTypeTags, [
    "alpha",
    "zeta"
  ]);
  assert.match(
    loaded.normalized.profileDefinition.baseProfile.hash,
    /^sha256:[a-f0-9]{64}$/
  );

  const missingClaim = structuredClone(source);
  missingClaim.profileDefinition.claimRefs = ["missing"];
  assert.throws(
    () => loadKernelPackage(missingClaim),
    (error) => error instanceof KernelValidationError &&
      error.issues.some(
        (issue) => issue.code === "PACKAGE_CLAIM_REFERENCE_MISSING"
      )
  );
});

test("package loading closes formation-derived profile invariant references", () => {
  const source = validPackage();
  source.functionals = [{
    id: "edge-count",
    expr: { kind: "count", set: { kind: "edges" } },
    coefficients: {},
    sensitivityCoefficients: [],
    result: {
      id: "edge-count-result",
      unit: "1",
      semantic: "formation-edge-count",
      toleranceTarget: { absolute: 0 }
    },
    explain: "Count formation edges.",
    claimRefs: []
  }];
  source.profileDefinition = {
    kind: "residual-slots-v2",
    baseProfile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "residual-profile-v2"
    },
    derivedTypeTags: ["formation-derived"],
    claimRefs: [],
    derivedInvariants: [{
      semantic: "formation-edge-count",
      functional: "edge-count",
      quantization: quantity(1, "1", "formation-edge-count")
    }]
  };

  const loaded = loadKernelPackage(source);
  assert.equal(loaded.normalized.profileDefinition.kind, "residual-slots-v2");
  assert.deepEqual(
    loaded.normalized.profileDefinition.derivedInvariants.map(
      (entry) => [entry.semantic, entry.functional]
    ),
    [["formation-edge-count", "edge-count"]]
  );

  const missing = structuredClone(source);
  missing.profileDefinition.derivedInvariants[0].functional = "missing";
  assert.throws(
    () => loadKernelPackage(missing),
    (error) => error instanceof KernelValidationError &&
      error.issues.some(
        (issue) => issue.code === "PACKAGE_PROFILE_FUNCTIONAL_REFERENCE_MISSING"
      )
  );

  const semanticDrift = structuredClone(source);
  semanticDrift.profileDefinition.derivedInvariants[0].semantic = "other";
  assert.throws(
    () => loadKernelPackage(semanticDrift),
    (error) => error instanceof KernelValidationError &&
      error.issues.some(
        (issue) => issue.code === "PACKAGE_PROFILE_INVARIANT_SEMANTIC_MISMATCH"
      )
  );
});

test("package loading closes formation-derived type rules over derived invariants", () => {
  const source = validPackage();
  source.functionals = [{
    id: "edge-count",
    expr: { kind: "count", set: { kind: "edges" } },
    coefficients: {},
    sensitivityCoefficients: [],
    result: {
      id: "edge-count-result",
      unit: "1",
      semantic: "formation-edge-count",
      toleranceTarget: { absolute: 0 }
    },
    explain: "Count formation edges.",
    claimRefs: []
  }];
  source.profileDefinition = {
    kind: "residual-slots-v3",
    baseProfile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "residual-profile-v3"
    },
    derivedTypeTags: ["formation-derived"],
    claimRefs: [],
    derivedInvariants: [{
      semantic: "formation-edge-count",
      functional: "edge-count",
      quantization: quantity(1, "1", "formation-edge-count")
    }],
    derivedTypeRules: [{
      typeTag: "one-or-more-edges",
      invariant: "formation-edge-count",
      comparator: "gte",
      threshold: quantity(1, "1", "formation-edge-count")
    }]
  };

  const loaded = loadKernelPackage(source);
  assert.equal(loaded.normalized.profileDefinition.kind, "residual-slots-v3");
  assert.equal(
    loaded.normalized.profileDefinition.derivedTypeRules[0].typeTag,
    "one-or-more-edges"
  );

  const missing = structuredClone(source);
  missing.profileDefinition.derivedTypeRules[0].invariant = "missing";
  assert.throws(
    () => loadKernelPackage(missing),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_PROFILE_TYPE_INVARIANT_REFERENCE_MISSING"
      )
  );

  const duplicate = structuredClone(source);
  duplicate.profileDefinition.derivedTypeRules[0].typeTag = "formation-derived";
  assert.throws(
    () => loadKernelPackage(duplicate),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_PROFILE_TYPE_TAG_DUPLICATE"
      )
  );

  const semanticDrift = structuredClone(source);
  semanticDrift.profileDefinition.derivedTypeRules[0].threshold.semantic = "other";
  assert.throws(
    () => loadKernelPackage(semanticDrift),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "PACKAGE_PROFILE_TYPE_THRESHOLD_SEMANTIC_MISMATCH"
      )
  );
});

test("package loading normalizes typed profile partner guards", () => {
  const source = validPackage();
  const guard = {
    op: "all",
    args: [
      { op: "partnerTypeTag", typeTag: "alpha" },
      {
        op: "partnerInvariant",
        name: "ready",
        comparator: "eq",
        value: true
      }
    ]
  };
  source.primitives[0].profile.slots = [{
    role: "support",
    polarity: "out",
    capacity: { min: 0, max: 1 },
    guard
  }];
  const loaded = loadKernelPackage(source);
  const reordered = structuredClone(source);
  reordered.primitives[0].profile.slots[0].guard.args.reverse();
  assert.equal(loaded.packageId, loadKernelPackage(reordered).packageId);

  const invalid = structuredClone(source);
  invalid.primitives[0].profile.slots[0].guard.args[1].comparator = "contains";
  assert.throws(
    () => loadKernelPackage(invalid),
    (error) => error instanceof KernelValidationError &&
      error.issues.some(
        (issue) => issue.code === "PROFILE_GUARD_COMPARATOR_INVALID"
      )
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

test("functional coefficient roles close every required sensitivity sweep", () => {
  const source = validPackage();
  addSelectorFixture(source);
  source.functionals[0].expr = {
    kind: "add",
    terms: ["a", "b", "c"].map((name) => ({ kind: "coefficient", name }))
  };
  source.functionals[0].coefficients = Object.fromEntries(
    ["a", "b", "c"].map((name, index) => [
      name,
      quantity(index + 1, "1", "fixture score")
    ])
  );
  source.functionals[0].coefficientRoles = {
    c: "fitted",
    a: "fixed",
    b: "free"
  };
  source.functionals[0].sensitivityCoefficients = ["c", "b"];

  const loaded = loadKernelPackage(source);
  assert.deepEqual(loaded.normalized.functionals[0].coefficientRoles, {
    a: "fixed",
    b: "free",
    c: "fitted"
  });
  assert.deepEqual(
    loaded.normalized.functionals[0].sensitivityCoefficients,
    ["b", "c"]
  );

  const legacy = structuredClone(source);
  delete legacy.functionals[0].coefficientRoles;
  assert.deepEqual(
    loadKernelPackage(legacy).normalized.functionals[0].coefficientRoles,
    { a: "fixed", b: "free", c: "free" }
  );

  const incomplete = structuredClone(source);
  incomplete.functionals[0].sensitivityCoefficients = ["b"];
  assert.throws(
    () => loadKernelPackage(incomplete),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "FUNCTIONAL_SENSITIVITY_COVERAGE_MISMATCH" &&
        issue.details.missing.includes("c")
      )
  );

  const fixedSwept = structuredClone(source);
  fixedSwept.functionals[0].sensitivityCoefficients = ["a", "b", "c"];
  assert.throws(
    () => loadKernelPackage(fixedSwept),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "FUNCTIONAL_SENSITIVITY_COVERAGE_MISMATCH" &&
        issue.details.unexpected.includes("a")
      )
  );

  const missingRole = structuredClone(source);
  delete missingRole.functionals[0].coefficientRoles.a;
  assert.throws(
    () => loadKernelPackage(missingRole),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "FUNCTIONAL_COEFFICIENT_ROLE_MISSING"
      )
  );

  const unknownRole = structuredClone(source);
  unknownRole.functionals[0].coefficientRoles.ghost = "fixed";
  assert.throws(
    () => loadKernelPackage(unknownRole),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "FUNCTIONAL_COEFFICIENT_ROLE_UNKNOWN"
      )
  );
});

test("source migration requires the complete closed binding", () => {
  const source = validPackage();
  source.sourceMigration = {};

  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PACKAGE_FIELD_REQUIRED") &&
      !error.issues.some((issue) =>
        issue.code === "SOURCE_CLASSIFICATION_FOUNDATION_UNAVAILABLE"
      )
  );
});

test("source migration binds condensed-cluster provenance and every artifact", () => {
  const source = validPackage();
  const migration = sourceMigrationFixture();
  source.sourceMigration = migration;
  source.sourceArtifacts = [
    ...Object.values(migration).filter((value) =>
      value !== null && typeof value === "object" && !Array.isArray(value)
    ),
    ...migration.typedRelationLayers
  ];
  source.primitives[0] = {
    ...source.primitives[0],
    sourceId: "cluster-alpha-beta",
    kind: "condensed-cluster",
    cluster: {
      disposition: "constitutive-cluster",
      members: ["source-b", "source-a"],
      internalRelations: ["relation-b", "relation-a"],
      internalOrder: "undefined",
      classificationPolicyHash: migration.policyHash,
      classificationArtifact: migration.classifiedRelations,
      nodeResolutionArtifact: migration.nodeResolutions,
      condensationArtifact: migration.condensation
    }
  };
  source.primitives = [source.primitives[0]];

  const loaded = loadKernelPackage(source);
  assert.equal(
    loaded.normalized.sourceMigration.policyHash,
    migration.policyHash
  );
  assert.notEqual(migration.policyHash, migration.classificationPolicy.hash);
  assert.deepEqual(
    loaded.normalized.primitives[0].cluster.members,
    ["source-a", "source-b"]
  );
  assert.equal(loaded.normalized.primitives[0].kind, "condensed-cluster");
  assert.ok(loaded.semanticManifest.sourceMigrationHash.startsWith("sha256:"));
  const population = materializePrimitiveDepthPopulation(loaded);
  assert.equal(population.elements[0].kind, "condensed-cluster");
  assert.deepEqual(population.elements[0].cluster.members, ["source-a", "source-b"]);

  const reordered = structuredClone(source);
  reordered.sourceArtifacts.reverse();
  reordered.sourceMigration.typedRelationLayers.reverse();
  reordered.primitives[0].cluster.members.reverse();
  reordered.primitives[0].cluster.internalRelations.reverse();
  assert.equal(loadKernelPackage(reordered).packageId, loaded.packageId);

  const unbound = structuredClone(source);
  unbound.sourceArtifacts = unbound.sourceArtifacts.filter((entry) =>
    entry.hash !== migration.metrics.hash
  );
  assert.throws(
    () => loadKernelPackage(unbound),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "SOURCE_MIGRATION_ARTIFACT_UNBOUND")
  );

  const referenceDrift = structuredClone(source);
  const driftedReferenceIndex = referenceDrift.sourceArtifacts.findIndex((entry) =>
    entry.hash === migration.metrics.hash
  );
  referenceDrift.sourceArtifacts[driftedReferenceIndex] = {
    ...referenceDrift.sourceArtifacts[driftedReferenceIndex],
    bytes: referenceDrift.sourceArtifacts[driftedReferenceIndex].bytes + 1
  };
  assert.throws(
    () => loadKernelPackage(referenceDrift),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "SOURCE_MIGRATION_ARTIFACT_REFERENCE_MISMATCH"
      )
  );

  const drift = structuredClone(source);
  drift.primitives[0].cluster.condensationArtifact = artifact(31, "stale-condensation");
  assert.throws(
    () => loadKernelPackage(drift),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "SOURCE_MIGRATION_CLUSTER_PROVENANCE_MISMATCH"
      )
  );

  const missingMigration = structuredClone(source);
  delete missingMigration.sourceMigration;
  assert.throws(
    () => loadKernelPackage(missingMigration),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "SOURCE_MIGRATION_REQUIRED")
  );

  const overlapping = structuredClone(source);
  overlapping.primitives.push({
    ...structuredClone(overlapping.primitives[0]),
    sourceId: "cluster-beta-gamma",
    cluster: {
      ...structuredClone(overlapping.primitives[0].cluster),
      members: ["source-b", "source-c"]
    }
  });
  assert.throws(
    () => loadKernelPackage(overlapping),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) =>
        issue.code === "SOURCE_MIGRATION_CLUSTER_MEMBER_DUPLICATE"
      )
  );
});

test("kernel exposes package loading and requires an explicit closure config", async () => {
  const kernel = createKernel({ version: "test" });
  const loaded = await kernel.loadPackage(validPackage());
  assert.equal(loaded.semanticManifest.kernelVersion, "test");
  assert.throws(
    () => kernel.closeLevel({ package: loaded }),
    (error) => error instanceof TypeError &&
      error.message === "closeLevel requires package and config."
  );
});
