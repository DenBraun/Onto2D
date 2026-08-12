import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  admitPackageSelectors,
  accumulateDecimals,
  advanceDecoratedCandidateEnumeration,
  auditPackageGeneratorFrontiers,
  auditPackageNodeFrontiers,
  auditPackageDepthGeneratorFrontiers,
  auditPackageDepthNodeFrontiers,
  auditPackageDepthPredicateMonotonicity,
  auditPackagePredicateMonotonicity,
  authorizePackageDepthPartialPruning,
  authorizePackagePartialPruning,
  bindPredicateNumericPolicy,
  compilePredicate,
  constructPackageCohorts,
  closePackageDepthLevel,
  closePackageLadder,
  closePackageLevel,
  createPackageCandidateBinding,
  createPackageLevelExplanationIndex,
  createPackageLevelResultCensus,
  createPackageNullModelPlan,
  createPackageNullModelProposals,
  createPackageRunArtifactBundle,
  createPackageRunArtifactStore,
  detectPackageLevelBoundaries,
  detectPartialGraphPredicateFailure,
  enumerateConnectedSkeletons,
  enumerateDecoratedCandidates,
  enumeratePackageCandidates,
  enumeratePackageCandidatesWithPruning,
  enumeratePackageCandidatesWithNodeGrowthPruning,
  enumeratePackageCandidatesWithRecursivePruning,
  enumeratePackageDepthCandidatesWithPruning,
  enumeratePackageDepthCandidatesWithNodeGrowthPruning,
  enumeratePackageDepthCandidatesWithRecursivePruning,
  evaluateGraphPredicatePlan,
  evaluateLocalPredicatePlan,
  evaluatePackageCandidateCensus,
  evaluatePackageCandidateFilter,
  evaluatePackageDepthCandidateFilter,
  evaluatePackageDepthCandidateCensus,
  evaluatePackageFunctional,
  evaluatePackageNullModelTrialCensuses,
  evaluatePackageNullModelTrialSelections,
  evaluatePackageNullModelBaseline,
  evaluatePackageSelectorSensitivity,
  explainPackageLevelCandidate,
  explainPackageRunCandidate,
  enumeratePackageDepthCandidates,
  extractPackageDerivedProfiles,
  loadKernelPackage,
  materializePackageDerivedDepthPopulation,
  materializePackageRunArtifact,
  materializePackageCarrierPromotions,
  materializePackageSelectedFormations,
  materializePrimitiveDepthPopulation,
  normalizeRunConfig,
  rankPackageSelector,
  selectPackageDepthSourcePopulation,
  testPackageProfileCollapse
} from "../../packages/kernel/src/index.js";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const SCHEMA_ROOT = path.join(REPOSITORY_ROOT, "packages", "schemas", "schemas");
const schemaFiles = (await readdir(SCHEMA_ROOT))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const schemas = await Promise.all(schemaFiles.map(async (name) =>
  JSON.parse(await readFile(path.join(SCHEMA_ROOT, name), "utf8"))
));
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
schemas.forEach((schema) => ajv.addSchema(schema));

function assertSchema(name, value) {
  const id = `https://onto2d.dev/schemas/v1/${name}.schema.json`;
  const validate = ajv.getSchema(id);
  assert.ok(validate, `missing compiled schema ${name}`);
  assert.equal(
    validate(value),
    true,
    ajv.errorsText(validate.errors, { dataVar: name, separator: "\n" })
  );
}

function assertNotSchema(name, value) {
  const id = `https://onto2d.dev/schemas/v1/${name}.schema.json`;
  const validate = ajv.getSchema(id);
  assert.ok(validate, `missing compiled schema ${name}`);
  assert.equal(validate(value), false, `${name} unexpectedly accepted an invalid artifact`);
}

function primitive(sourceId = "schema-fixture-source", invariants = {}) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: ["fixture"],
    invariants,
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function predicate(id, expr, monotoneViolation = false) {
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

function quantity(value, unit, semantic, tolerance = { absolute: 0 }, evidence = []) {
  return {
    value,
    unit,
    tolerance,
    semantic,
    provenance: { kind: "declared", evidence }
  };
}

function artifactRef(index, label) {
  return {
    path: `artifacts/${label}.json`,
    mediaType: "application/json",
    schemaVersion: "1",
    bytes: index,
    hash: `sha256:${index.toString(16).padStart(64, "0")}`
  };
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
      perturbationSamples: 10,
      nullModelRuns: 0
    },
    seed: "runtime-schema-conformance-v1",
    invariantPrecision: {
      id: "runtime-schema-precision-v1",
      decimalPlaces: 18,
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
    indeterminateThreshold: 0
  };
}

test("package-authored scalar invariant values conform across primitive and element schemas", () => {
  const invariants = {
    score: 3,
    label: "ready",
    enabled: true,
    marker: null
  };
  for (const value of [
    quantity(1, "m", "length"),
    3,
    "ready",
    true,
    null
  ]) {
    assertSchema("invariant-value", value);
  }
  assertNotSchema("invariant-value", []);
  assertNotSchema("invariant-value", "x".repeat(1_025));

  const sourcePrimitive = primitive("scalar-schema-source", invariants);
  assertSchema("primitive", sourcePrimitive);
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "scalar-schema-fixture",
    version: "1.0.0",
    primitives: [sourcePrimitive]
  });
  const population = materializePrimitiveDepthPopulation(loaded);
  assertSchema("element", population.elements[0]);
  assert.deepEqual(population.elements[0].invariants, {
    enabled: true,
    label: "ready",
    marker: null,
    score: 3
  });
});

test("functional coefficient roles conform and normalize to complete sweep coverage", () => {
  const functional = {
    id: "coefficient-role-functional",
    expr: {
      kind: "add",
      terms: [
        { kind: "coefficient", name: "fixed" },
        { kind: "coefficient", name: "fitted" }
      ]
    },
    coefficients: {
      fixed: quantity(1, "1", "coefficient-role score"),
      fitted: quantity(2, "1", "coefficient-role score")
    },
    coefficientRoles: { fitted: "fitted", fixed: "fixed" },
    sensitivityCoefficients: ["fitted"],
    result: {
      id: "coefficient-role-result",
      unit: "1",
      semantic: "coefficient-role score",
      toleranceTarget: { absolute: 0 }
    },
    explain: "coefficient-role schema fixture",
    claimRefs: []
  };
  assertSchema("functional", functional);
  assertNotSchema("functional", {
    ...functional,
    coefficientRoles: { fitted: "estimated", fixed: "fixed" }
  });
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "coefficient-role-schema-fixture",
    version: "1.0.0",
    primitives: [primitive("coefficient-role-source")],
    functionals: [functional]
  });
  assert.deepEqual(loaded.normalized.functionals[0].coefficientRoles, {
    fitted: "fitted",
    fixed: "fixed"
  });
});

test("source-migration bindings and condensed primitives conform as one package", () => {
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
  const sourceMigration = {
    policyHash: null,
    blindnessStatus: "historically-exposed",
    typedRelationLayers: Array.from(
      { length: 6 },
      (_, index) => artifactRef(fields.length + index + 1, `typed-layer-${index}`)
    )
  };
  fields.forEach((field, index) => {
    sourceMigration[field] = artifactRef(index + 1, field);
  });
  sourceMigration.policyHash = `sha256:${"f".repeat(64)}`;
  const condensed = {
    ...primitive("cluster-a-b"),
    kind: "condensed-cluster",
    cluster: {
      disposition: "constitutive-cluster",
      members: ["source-a", "source-b"],
      internalRelations: ["relation-a-b"],
      internalOrder: "undefined",
      classificationPolicyHash: sourceMigration.policyHash,
      classificationArtifact: sourceMigration.classifiedRelations,
      nodeResolutionArtifact: sourceMigration.nodeResolutions,
      condensationArtifact: sourceMigration.condensation
    }
  };
  const packageInput = {
    schemaVersion: "1",
    id: "source-migration-schema-fixture",
    version: "1.0.0",
    sourceArtifacts: [
      ...fields.map((field) => sourceMigration[field]),
      ...sourceMigration.typedRelationLayers
    ],
    sourceMigration,
    primitives: [condensed]
  };

  assertSchema("source-migration-binding", sourceMigration);
  assertSchema("primitive", condensed);
  assertSchema("kernel-package", packageInput);
  const loaded = loadKernelPackage(packageInput);
  const level = closePackageLevel(loaded, runConfig());
  const bundle = createPackageRunArtifactBundle(loaded, runConfig(), [level]);
  assertSchema("semantic-manifest", loaded.semanticManifest);
  assertSchema("package-run-semantic-manifest", bundle.semanticManifest);
  assertSchema("package-run-artifact-bundle", bundle);
  assert.equal(bundle.semanticManifest.inputArtifacts.length, 16);
  assert.equal(
    bundle.semanticManifest.sourceMigrationHash,
    loaded.semanticManifest.sourceMigrationHash
  );
  assertNotSchema("source-migration-binding", {
    ...sourceMigration,
    typedRelationLayers: [
      sourceMigration.typedRelationLayers[0],
      sourceMigration.typedRelationLayers[0],
      ...sourceMigration.typedRelationLayers.slice(2)
    ]
  });
});

test("monotonicity audits and pruning-controller decisions conform to published schemas", () => {
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "pruning-audit-schema-fixture",
    version: "1.0.0",
    primitives: [primitive("pruning-audit-source")],
    predicates: [predicate("no-support", {
      op: "countRole",
      role: "support",
      max: 0
    }, true)]
  });
  const config = runConfig();
  config.budget.maxNodes = 3;
  config.budget.maxEdges = 2;
  config.budget.maxCandidates = 100;
  const options = { samplesPerPredicate: 3 };
  const audit = auditPackagePredicateMonotonicity(loaded, config, options);
  const ref = loaded.normalized.primitives[0].elementId;
  const decision = authorizePackagePartialPruning(
    loaded,
    config,
    audit,
    "no-support",
    {
      domain: "element-exact",
      nodes: [{ ref }, { ref }],
      edges: [{ from: 0, to: 1, role: "support" }],
      nodesComplete: true
    },
    options
  );
  const prunedGeneration = enumeratePackageCandidatesWithPruning(
    loaded,
    config,
    audit,
    options
  );
  const frontierAudit = auditPackageGeneratorFrontiers(
    loaded,
    config,
    audit,
    options
  );
  const recursiveGeneration = enumeratePackageCandidatesWithRecursivePruning(
    loaded,
    config,
    audit,
    frontierAudit,
    options
  );
  const frontierDecision = recursiveGeneration.pruning.prunedFrontiers[0]?.decision;
  assert.ok(frontierDecision);
  const depthAudit = auditPackageDepthPredicateMonotonicity(
    loaded,
    config,
    [],
    1,
    options
  );
  const depthDecision = authorizePackageDepthPartialPruning(
    loaded,
    config,
    [],
    1,
    depthAudit,
    "no-support",
    {
      domain: "element-exact",
      nodes: [{ ref }, { ref }],
      edges: [{ from: 0, to: 1, role: "support" }],
      nodesComplete: true
    },
    options
  );
  const depthPrunedGeneration = enumeratePackageDepthCandidatesWithPruning(
    loaded,
    config,
    [],
    1,
    depthAudit,
    options
  );
  const depthFrontierAudit = auditPackageDepthGeneratorFrontiers(
    loaded,
    config,
    [],
    1,
    depthAudit,
    options
  );
  const depthRecursiveGeneration =
    enumeratePackageDepthCandidatesWithRecursivePruning(
      loaded,
      config,
      [],
      1,
      depthAudit,
      depthFrontierAudit,
      options
    );
  const depthFrontierDecision =
    depthRecursiveGeneration.pruning.prunedFrontiers[0]?.decision;
  assert.ok(depthFrontierDecision);
  const nodeLoaded = loadKernelPackage({
    schemaVersion: "1",
    id: "node-growth-schema-fixture",
    version: "1.0.0",
    primitives: [primitive("node-growth-source")],
    predicates: [predicate("reject-all", {
      op: "not",
      arg: { op: "countRole", role: "support", min: 0 }
    }, true)]
  });
  const nodeCanonicalAudit = auditPackagePredicateMonotonicity(
    nodeLoaded,
    config,
    options
  );
  const nodeFrontierAudit = auditPackageNodeFrontiers(
    nodeLoaded,
    config,
    nodeCanonicalAudit,
    options
  );
  const nodeGrowthGeneration = enumeratePackageCandidatesWithNodeGrowthPruning(
    nodeLoaded,
    config,
    nodeCanonicalAudit,
    nodeFrontierAudit,
    options
  );
  const nodeFrontierDecision =
    nodeGrowthGeneration.pruning.prunedNodeFrontiers[0]?.decision;
  assert.ok(nodeFrontierDecision);
  const depthNodeCanonicalAudit = auditPackageDepthPredicateMonotonicity(
    nodeLoaded,
    config,
    [],
    1,
    options
  );
  const depthNodeFrontierAudit = auditPackageDepthNodeFrontiers(
    nodeLoaded,
    config,
    [],
    1,
    depthNodeCanonicalAudit,
    options
  );
  const depthNodeGrowthGeneration =
    enumeratePackageDepthCandidatesWithNodeGrowthPruning(
      nodeLoaded,
      config,
      [],
      1,
      depthNodeCanonicalAudit,
      depthNodeFrontierAudit,
      options
    );
  const depthNodeFrontierDecision =
    depthNodeGrowthGeneration.pruning.prunedNodeFrontiers[0]?.decision;
  assert.ok(depthNodeFrontierDecision);

  assertSchema("package-predicate-monotonicity-audit", audit);
  assertSchema("package-partial-pruning-decision", decision);
  assertSchema("package-pruned-candidate-generation", prunedGeneration);
  assertSchema("package-generator-frontier-audit", frontierAudit);
  assertSchema("package-generator-frontier-decision", frontierDecision);
  assertSchema(
    "package-recursive-pruned-candidate-generation",
    recursiveGeneration
  );
  assertSchema("package-depth-predicate-monotonicity-audit", depthAudit);
  assertSchema("package-depth-partial-pruning-decision", depthDecision);
  assertSchema(
    "package-depth-pruned-candidate-generation",
    depthPrunedGeneration
  );
  assertSchema(
    "package-depth-generator-frontier-audit",
    depthFrontierAudit
  );
  assertSchema(
    "package-depth-generator-frontier-decision",
    depthFrontierDecision
  );
  assertSchema(
    "package-depth-recursive-pruned-candidate-generation",
    depthRecursiveGeneration
  );
  assertSchema("package-node-frontier-audit", nodeFrontierAudit);
  assertSchema("package-node-frontier-decision", nodeFrontierDecision);
  assertSchema(
    "package-node-growth-pruned-candidate-generation",
    nodeGrowthGeneration
  );
  assertSchema("package-depth-node-frontier-audit", depthNodeFrontierAudit);
  assertSchema(
    "package-depth-node-frontier-decision",
    depthNodeFrontierDecision
  );
  assertSchema(
    "package-depth-node-growth-pruned-candidate-generation",
    depthNodeGrowthGeneration
  );
  const falseAuthorization = structuredClone(decision);
  falseAuthorization.pruningAuthorized = false;
  assertNotSchema("package-partial-pruning-decision", falseAuthorization);
  const invalidStream = structuredClone(audit);
  invalidStream.results[0].samples[0].streamDraws = 0;
  assertNotSchema("package-predicate-monotonicity-audit", invalidStream);
  const invalidPrunedCount = structuredClone(prunedGeneration);
  invalidPrunedCount.pruning.counts.uniquePrunedCandidates = -1;
  assertNotSchema("package-pruned-candidate-generation", invalidPrunedCount);
  const invalidFrontierStream = structuredClone(frontierAudit);
  invalidFrontierStream.results[0].samples[0].streamDraws = 0;
  assertNotSchema("package-generator-frontier-audit", invalidFrontierStream);
  const invalidFrontierProfileStatus = structuredClone(frontierAudit);
  invalidFrontierProfileStatus.profileExtensionUniverse.status = "complete";
  assertNotSchema(
    "package-generator-frontier-audit",
    invalidFrontierProfileStatus
  );
  const falseFrontierAuthorization = structuredClone(frontierDecision);
  falseFrontierAuthorization.pruningAuthorized = false;
  assertNotSchema(
    "package-generator-frontier-decision",
    falseFrontierAuthorization
  );
  const invalidSkippedCount = structuredClone(recursiveGeneration);
  invalidSkippedCount.pruning.counts.skippedRawCandidates = -1;
  assertNotSchema(
    "package-recursive-pruned-candidate-generation",
    invalidSkippedCount
  );
  const falseNodeAuthorization = structuredClone(nodeFrontierDecision);
  falseNodeAuthorization.pruningAuthorized = false;
  assertNotSchema(
    "package-node-frontier-decision",
    falseNodeAuthorization
  );
  const invalidNodeProfileKind = structuredClone(nodeFrontierAudit);
  invalidNodeProfileKind.profileExtensionUniverse.kind = "edge-group";
  assertNotSchema("package-node-frontier-audit", invalidNodeProfileKind);
  const invalidNodeSkippedCount = structuredClone(nodeGrowthGeneration);
  invalidNodeSkippedCount.pruning.counts.skippedRawCandidates = -1;
  assertNotSchema(
    "package-node-growth-pruned-candidate-generation",
    invalidNodeSkippedCount
  );
  const missingDepthNodeContext = structuredClone(depthNodeFrontierAudit);
  delete missingDepthNodeContext.sourcePopulationHash;
  assertNotSchema(
    "package-depth-node-frontier-audit",
    missingDepthNodeContext
  );
  const missingDepthContext = structuredClone(depthAudit);
  delete missingDepthContext.sourcePopulationHash;
  assertNotSchema(
    "package-depth-predicate-monotonicity-audit",
    missingDepthContext
  );
  const invalidDepthDecision = structuredClone(depthDecision);
  invalidDepthDecision.targetDepth = 0;
  assertNotSchema(
    "package-depth-partial-pruning-decision",
    invalidDepthDecision
  );
  const falseDepthFrontierAuthorization = structuredClone(depthFrontierDecision);
  falseDepthFrontierAuthorization.pruningAuthorized = false;
  assertNotSchema(
    "package-depth-generator-frontier-decision",
    falseDepthFrontierAuthorization
  );
});

test("profile-invariant aggregation expressions and witnesses conform to published schemas", () => {
  const expression = {
    kind: "invariant",
    name: "score",
    profileAggregation: "arithmetic-mean-conservative-v1"
  };
  assertSchema("value-expression", expression);
  assertNotSchema("value-expression", {
    ...expression,
    profileAggregation: "implicit-mean-v0"
  });

  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "profile-aggregation-schema-fixture",
    version: "1.0.0",
    primitives: [
      primitive("profile-aggregation-b", { score: 2 }),
      primitive("profile-aggregation-a", { score: 1 })
    ],
    predicates: [predicate("mean-score", {
      op: "compare",
      left: expression,
      comparator: "eq",
      right: { kind: "constant", value: 1.5 }
    })],
    functionals: [{
      id: "mean-score-functional",
      expr: expression,
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "mean-score-result",
        unit: "1",
        semantic: "mean score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "mean score fixture",
      claimRefs: []
    }]
  });
  const config = runConfig();
  config.countingDomain = "profile-quotient";
  const binding = createPackageCandidateBinding(loaded, config);
  const profileClass = binding.sourcePopulation.profileClasses[0];
  const filter = evaluatePackageCandidateFilter(loaded, binding, {
    domain: "profile-quotient",
    nodes: [{ ref: profileClass.profileHash }],
    edges: []
  });
  const local = filter.predicateEvaluations[0].evaluation;
  const functional = evaluatePackageFunctional(
    loaded,
    binding,
    filter,
    "mean-score-functional"
  );

  assertSchema("predicate-local-evaluation", local);
  assertSchema("package-candidate-filter-evaluation", filter);
  assertSchema("package-functional-evaluation", functional);
  const tampered = structuredClone(local);
  tampered.witnesses[0].invariants[0].aggregation.policy = "mean-v0";
  assertNotSchema("predicate-local-evaluation", tampered);
  const mixedBasis = structuredClone(local);
  mixedBasis.witnesses[0].invariants[0].consensusPolicy =
    "identical-normalized-scalar-v1";
  assertNotSchema("predicate-local-evaluation", mixedBasis);

  const productExpression = {
    kind: "multiply",
    resultSemantic: "work energy",
    factors: [
      { kind: "constant", value: quantity(2, "N", "force") },
      { kind: "constant", value: quantity(3, "m", "length") }
    ]
  };
  assertSchema("value-expression", productExpression);
  const productPlan = compilePredicate(predicate("schema-quantity-product", {
    op: "compare",
    left: productExpression,
    comparator: "eq",
    right: { kind: "constant", value: quantity(6, "J", "work energy") }
  }));
  const productEvaluation = evaluateLocalPredicatePlan(
    productPlan,
    bindPredicateNumericPolicy(productPlan, runConfig().invariantPrecision),
    {
      domain: "element-exact",
      nodes: [{ ref: `sha256:${"e".repeat(64)}` }],
      edges: []
    }
  );
  assertSchema("predicate-local-evaluation", productEvaluation);
  const missingProductSemantic = structuredClone(productExpression);
  delete missingProductSemantic.resultSemantic;
  assertSchema("value-expression", missingProductSemantic);
});

test("novel local witnesses conform with exact constituent and nested-policy evidence", () => {
  const config = normalizeRunConfig(runConfig());
  const candidate = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
    edges: []
  };
  const novelPlan = compilePredicate(predicate("novel-connected-schema", {
    op: "novel",
    predicate: { op: "connected" }
  }));
  const novelEvaluation = evaluateLocalPredicatePlan(
    novelPlan,
    bindPredicateNumericPolicy(novelPlan, config.invariantPrecision),
    candidate
  );
  assertSchema("predicate-local-evaluation", novelEvaluation);

  const nestedPlan = compilePredicate(predicate("novel-minimal-schema", {
    op: "novel",
    predicate: { op: "minimal", predicate: { op: "connected" } }
  }));
  const nestedEvaluation = evaluateLocalPredicatePlan(
    nestedPlan,
    bindPredicateNumericPolicy(nestedPlan, config.invariantPrecision),
    candidate,
    { substructurePolicy: config.substructurePolicy }
  );
  assertSchema("predicate-local-evaluation", nestedEvaluation);

  const nestedInvariantPlan = compilePredicate(predicate(
    "novel-invariant-schema",
    {
      op: "novel",
      predicate: {
        op: "compare",
        left: {
          kind: "invariant",
          name: "score",
          node: { kind: "canonical-index", index: 0 }
        },
        comparator: "eq",
        right: { kind: "constant", value: 1 }
      }
    }
  ), { environment: { invariants: { score: { kind: "number" } } } });
  const nestedInvariantEvaluation = evaluateLocalPredicatePlan(
    nestedInvariantPlan,
    bindPredicateNumericPolicy(nestedInvariantPlan, config.invariantPrecision),
    candidate,
    {
      invariantContext: {
        sourcePopulationHash: `sha256:${"d".repeat(64)}`,
        elements: [{
          elementId: candidate.nodes[0].ref,
          invariants: { score: 1 }
        }]
      }
    }
  );
  assert.deepEqual(nestedInvariantEvaluation.invariantNames, ["score"]);
  assertSchema("predicate-local-evaluation", nestedInvariantEvaluation);

  const unexpectedPolicy = structuredClone(novelEvaluation);
  unexpectedPolicy.substructurePolicy = config.substructurePolicy;
  assertNotSchema("predicate-local-evaluation", unexpectedPolicy);
  const invalidProjection = structuredClone(novelEvaluation);
  invalidProjection.witnesses[0].projection = "representative-element-v1";
  assertNotSchema("predicate-local-evaluation", invalidProjection);
  const incompleteConstituent = structuredClone(novelEvaluation);
  delete incompleteConstituent.witnesses[0].constituents[0].sourceElementId;
  assertNotSchema("predicate-local-evaluation", incompleteConstituent);
});

test("typed perturbations and stable-under witnesses conform to published schemas", () => {
  const definition = {
    id: "replace-support",
    kind: "edge-role-replacement",
    enumeration: "exhaustive-valid-single-edits-v1",
    emptyPolicy: "indeterminate",
    replacements: [{ from: "support", to: "alternate" }]
  };
  assertSchema("perturbation-definition", definition);
  assertSchema("perturbation-definition", "registry-only");
  assertNotSchema("perturbation-definition", {
    ...definition,
    enumeration: "sampled-v1"
  });
  assertSchema("kernel-package", {
    schemaVersion: "1",
    id: "typed-perturbation-schema",
    version: "1.0.0",
    primitives: [primitive("typed-perturbation-source")],
    perturbations: [definition]
  });

  const stablePlan = compilePredicate(predicate("stable-schema", {
    op: "stableUnder",
    perturbation: "replace-support",
    threshold: 1,
    predicate: { op: "connected" }
  }), { environment: { perturbations: ["replace-support"] } });
  const evaluation = evaluateLocalPredicatePlan(
    stablePlan,
    bindPredicateNumericPolicy(
      stablePlan,
      normalizeRunConfig(runConfig()).invariantPrecision
    ),
    {
      domain: "element-exact",
      nodes: [
        { ref: `sha256:${"a".repeat(64)}` },
        { ref: `sha256:${"b".repeat(64)}` }
      ],
      edges: [{ from: 0, to: 1, role: "support" }]
    },
    {
      policy: runConfig().graphPolicy,
      perturbationContext: { definitions: [definition] }
    }
  );
  assertSchema("predicate-local-evaluation", evaluation);

  const missingContextHash = structuredClone(evaluation);
  delete missingContextHash.perturbationContextHash;
  assertNotSchema("predicate-local-evaluation", missingContextHash);
  const incompleteAttempt = structuredClone(evaluation);
  delete incompleteAttempt.witnesses[0].perturbations[0].canonicalNodeToParent;
  assertNotSchema("predicate-local-evaluation", incompleteAttempt);
  const invalidDecision = structuredClone(evaluation);
  invalidDecision.witnesses[0].decisionRule = "rounded-ratio-v1";
  assertNotSchema("predicate-local-evaluation", invalidDecision);

  const sampledDefinition = {
    ...definition,
    enumeration: "sampled-valid-single-edits-v1"
  };
  assertSchema("perturbation-definition", sampledDefinition);
  const sampledEvaluation = evaluateLocalPredicatePlan(
    stablePlan,
    bindPredicateNumericPolicy(
      stablePlan,
      normalizeRunConfig(runConfig()).invariantPrecision
    ),
    {
      domain: "element-exact",
      nodes: [
        { ref: `sha256:${"a".repeat(64)}` },
        { ref: `sha256:${"b".repeat(64)}` }
      ],
      edges: [{ from: 0, to: 1, role: "support" }]
    },
    {
      policy: runConfig().graphPolicy,
      perturbationContext: {
        definitions: [sampledDefinition],
        sampling: {
          algorithm: "sha256-rejection-counter-v1",
          frame: "applicable-single-edit-attempts-v1",
          replacement: "with-replacement",
          uncertainty: "chebyshev-union-95-v1",
          sampleSize: 32,
          streamKey: `sha256:${"c".repeat(64)}`
        }
      }
    }
  );
  assertSchema("predicate-local-evaluation", sampledEvaluation);
  const incompleteSample = structuredClone(sampledEvaluation);
  delete incompleteSample.witnesses[0].perturbations[0].frameIndex;
  assertNotSchema("predicate-local-evaluation", incompleteSample);
  const missingConfidence = structuredClone(sampledEvaluation);
  delete missingConfidence.witnesses[0].confidenceBounds;
  assertNotSchema("predicate-local-evaluation", missingConfidence);
});

test("implemented generation and evaluation artifacts conform to their published schemas", () => {
  const graphPredicate = predicate(
    "empty-support",
    { op: "countRole", role: "support", max: 0 },
    true
  );
  const numericPredicate = predicate("one-node", {
    op: "compare",
    left: { kind: "count", set: { kind: "nodes", selector: { kind: "all" } } },
    comparator: "eq",
    right: { kind: "constant", value: 1 }
  });
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-schema-fixture",
    version: "1.0.0",
    evidence: [{
      id: "runtime-promotion-evidence",
      state: "package-operationalization",
      source: {
        path: "fixtures/runtime-promotion.md",
        mediaType: "text/markdown",
        schemaVersion: "1",
        bytes: 1,
        hash: `sha256:${"d".repeat(64)}`
      }
    }],
    claims: [{
      id: "runtime-promotion-claim",
      statement: "Runtime fixture carrier promotion.",
      state: "package-operationalization",
      evidence: ["runtime-promotion-evidence"]
    }],
    primitives: [primitive("schema-fixture-source", {
      length: quantity(1.25, "m", "length"),
      multiplicity: 2,
      role: "ready"
    })],
    predicates: [graphPredicate, numericPredicate],
    functionals: [
      {
        id: "combined-length",
        expr: {
          kind: "add",
          terms: [
            { kind: "coefficient", name: "offset" },
            { kind: "invariant", name: "length" }
          ]
        },
        coefficients: {
          offset: quantity(0.5, "m", "offset")
        },
        sensitivityCoefficients: ["offset"],
        result: {
          id: "combined-length-result",
          unit: "m",
          semantic: "combined length",
          toleranceTarget: { absolute: 0 }
        },
        explain: "combined length fixture",
        claimRefs: []
      },
      {
        id: "scaled-length",
        expr: {
          kind: "multiply",
          factors: [
            { kind: "invariant", name: "multiplicity" },
            { kind: "constant", value: quantity(1, "m", "length") }
          ]
        },
        coefficients: {},
        sensitivityCoefficients: [],
        result: {
          id: "scaled-length-result",
          unit: "m",
          semantic: "scaled length",
          toleranceTarget: { absolute: 0 }
        },
        explain: "scalar invariant functional fixture",
        claimRefs: []
      },
      {
        id: "uncertain-length",
        expr: {
          kind: "constant",
          value: quantity(1, "m", "uncertain length", { absolute: 0.2 })
        },
        coefficients: {},
        sensitivityCoefficients: [],
        result: {
          id: "uncertain-length-result",
          unit: "m",
          semantic: "uncertain score",
          toleranceTarget: { absolute: 0.1 }
        },
        explain: "uncertain length fixture",
        claimRefs: []
      },
      {
        id: "fixed-length",
        expr: {
          kind: "constant",
          value: quantity(1, "m", "fixed score")
        },
        coefficients: {},
        sensitivityCoefficients: [],
        result: {
          id: "fixed-length-result",
          unit: "m",
          semantic: "fixed score",
          toleranceTarget: { absolute: 0 }
        },
        explain: "fixed score fixture",
        claimRefs: []
      },
      {
        id: "borderline-length",
        expr: { kind: "coefficient", name: "scale" },
        coefficients: {
          scale: quantity(
            1,
            "m",
            "borderline score",
            { absolute: 0.09, relative: 0.05 }
          )
        },
        sensitivityCoefficients: ["scale"],
        result: {
          id: "borderline-length-result",
          unit: "m",
          semantic: "borderline score",
          toleranceTarget: { absolute: 0.1 }
        },
        explain: "borderline sensitivity fixture",
        claimRefs: []
      }
    ],
    cohortRules: [
      { id: "all-eligible", kind: "global" },
      {
        id: "scalar-role",
        kind: "profile-role",
        roleKey: [{ kind: "invariant", name: "role" }]
      },
      {
        id: "uncertain-window",
        kind: "invariant-window",
        value: { kind: "invariant", name: "length" },
        origin: quantity(0, "m", "length", { absolute: 0.1 }),
        width: quantity(1, "m", "length"),
        bins: "lower-closed-upper-open"
      }
    ],
    selectors: [
      {
        id: "minimum-length",
        objective: "min",
        functional: "combined-length",
        cohortRule: "all-eligible",
        epsilon: quantity(0, "m", "selector epsilon"),
        tiePolicy: "retain-all",
        sensitivity: {
          amplitudes: [0.1],
          sweep: "one-at-a-time",
          topK: 1,
          robustLeaderSetThreshold: 0.9,
          robustTopKThreshold: 0.9
        },
        explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
        claimRefs: []
      },
      {
        id: "fixed-minimum",
        objective: "min",
        functional: "fixed-length",
        cohortRule: "all-eligible",
        epsilon: quantity(0, "m", "selector epsilon"),
        tiePolicy: "retain-all",
        sensitivity: {
          amplitudes: [0.1],
          sweep: "one-at-a-time",
          topK: 1,
          robustLeaderSetThreshold: 0.9,
          robustTopKThreshold: 0.9
        },
        explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
        claimRefs: []
      },
      {
        id: "borderline-minimum",
        objective: "min",
        functional: "borderline-length",
        cohortRule: "all-eligible",
        epsilon: quantity(0, "m", "selector epsilon"),
        tiePolicy: "retain-all",
        sensitivity: {
          amplitudes: [0.25],
          sweep: "one-at-a-time",
          topK: 1,
          robustLeaderSetThreshold: 0.9,
          robustTopKThreshold: 0.9
        },
        explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
        claimRefs: []
      }
    ],
    profileDefinition: {
      kind: "residual-slots-v3",
      baseProfile: {
        slots: [{
          role: "external",
          polarity: "sym",
          capacity: { min: 0, max: 1 }
        }],
        invariantVector: [],
        precisionPolicy: "runtime-schema-profile-v1"
      },
      derivedTypeTags: ["runtime-derived"],
      claimRefs: ["runtime-promotion-claim"],
      derivedInvariants: [{
        semantic: "fixed score",
        functional: "fixed-length",
        quantization: quantity(0.1, "m", "fixed score")
      }],
      derivedTypeRules: [{
        typeTag: "runtime-fixed-score",
        invariant: "fixed score",
        comparator: "gte",
        threshold: quantity(1, "m", "fixed score")
      }]
    }
  });
  const normalizedConfig = normalizeRunConfig(runConfig());
  const skeletons = enumerateConnectedSkeletons(1);
  const enumerationInput = {
    domain: "element-exact",
    skeletons: skeletons.skeletons,
    nodeVariants: [{ ref: loaded.normalized.primitives[0].elementId }],
    edgeVariants: [],
    graphPolicy: normalizedConfig.graphPolicy
  };
  const enumeration = enumerateDecoratedCandidates(enumerationInput, {
    maxEdges: 0,
    maxCandidates: 10
  });
  const resumableEnumeration = advanceDecoratedCandidateEnumeration(
    enumerationInput,
    { maxEdges: 0, maxCandidates: 10 },
    { maxRawCandidatesPerStep: 1 }
  );
  const pausedResumableEnumeration = advanceDecoratedCandidateEnumeration(
    {
      ...enumerationInput,
      nodeVariants: [
        ...enumerationInput.nodeVariants,
        { ref: `sha256:${"f".repeat(64)}` }
      ]
    },
    { maxEdges: 0, maxCandidates: 10 },
    { maxRawCandidatesPerStep: 1 }
  );
  const population = materializePrimitiveDepthPopulation(loaded);
  const binding = createPackageCandidateBinding(loaded, normalizedConfig);
  const packageEnumeration = enumeratePackageCandidates(loaded, normalizedConfig);
  const candidate = packageEnumeration.enumeration.candidateStore.candidates[0].candidate;
  const plans = new Map(loaded.predicatePlans.map((plan) => [plan.predicateId, plan]));
  const graphEvaluation = evaluateGraphPredicatePlan(plans.get("empty-support"), candidate);
  const numericPlan = plans.get("one-node");
  const numericBinding = bindPredicateNumericPolicy(
    numericPlan,
    normalizedConfig.invariantPrecision
  );
  const localEvaluation = evaluateLocalPredicatePlan(
    numericPlan,
    numericBinding,
    candidate
  );
  const irreduciblePlan = compilePredicate(predicate("node-irreducible", {
    op: "irreducibleRemoval",
    removal: "node",
    predicate: { op: "connected" }
  }));
  const irreducibleBinding = bindPredicateNumericPolicy(
    irreduciblePlan,
    normalizedConfig.invariantPrecision
  );
  const irreducibleEvaluation = evaluateLocalPredicatePlan(
    irreduciblePlan,
    irreducibleBinding,
    candidate,
    { substructurePolicy: normalizedConfig.substructurePolicy }
  );
  const minimalPlan = compilePredicate(predicate("minimal-connected", {
    op: "minimal",
    predicate: { op: "connected" }
  }));
  const minimalEvaluation = evaluateLocalPredicatePlan(
    minimalPlan,
    bindPredicateNumericPolicy(minimalPlan, normalizedConfig.invariantPrecision),
    candidate,
    { substructurePolicy: normalizedConfig.substructurePolicy }
  );
  const cyclePlan = compilePredicate(predicate("cycle-edge-count", {
    op: "compare",
    left: { kind: "count", set: { kind: "cycle", roles: ["support"] } },
    comparator: "eq",
    right: { kind: "constant", value: 0 }
  }));
  const cycleEvaluation = evaluateLocalPredicatePlan(
    cyclePlan,
    bindPredicateNumericPolicy(cyclePlan, normalizedConfig.invariantPrecision),
    candidate
  );
  const partialEvaluation = detectPartialGraphPredicateFailure(
    plans.get("empty-support"),
    {
      domain: candidate.domain,
      nodes: candidate.nodes,
      edges: candidate.edges,
      nodesComplete: true
    }
  );
  const filterEvaluation = evaluatePackageCandidateFilter(loaded, binding, candidate);
  const functionalEvaluation = evaluatePackageFunctional(
    loaded,
    binding,
    filterEvaluation,
    "combined-length"
  );
  const uncertainFunctionalEvaluation = evaluatePackageFunctional(
    loaded,
    binding,
    filterEvaluation,
    "uncertain-length"
  );
  const scalarFunctionalEvaluation = evaluatePackageFunctional(
    loaded,
    binding,
    filterEvaluation,
    "scaled-length"
  );
  const candidateCensus = evaluatePackageCandidateCensus(loaded, normalizedConfig);
  const disabledNullModelPlan = createPackageNullModelPlan(
    loaded,
    normalizedConfig,
    candidateCensus
  );
  const disabledNullModelProposals = createPackageNullModelProposals(
    loaded,
    normalizedConfig,
    candidateCensus,
    disabledNullModelPlan
  );
  const disabledNullModelTrialCensuses = evaluatePackageNullModelTrialCensuses(
    loaded,
    normalizedConfig,
    candidateCensus,
    disabledNullModelPlan,
    disabledNullModelProposals
  );
  const disabledNullModelTrialSelections = evaluatePackageNullModelTrialSelections(
    loaded,
    normalizedConfig,
    candidateCensus,
    disabledNullModelPlan,
    disabledNullModelProposals,
    disabledNullModelTrialCensuses
  );
  const cohortPartition = constructPackageCohorts(
    loaded,
    normalizedConfig,
    candidateCensus,
    "all-eligible"
  );
  const uncertainCohortPartition = constructPackageCohorts(
    loaded,
    normalizedConfig,
    candidateCensus,
    "uncertain-window"
  );
  const scalarCohortPartition = constructPackageCohorts(
    loaded,
    normalizedConfig,
    candidateCensus,
    "scalar-role"
  );
  const selectorRanking = rankPackageSelector(
    loaded,
    normalizedConfig,
    candidateCensus,
    cohortPartition,
    "minimum-length"
  );
  const selectorSensitivity = evaluatePackageSelectorSensitivity(
    loaded,
    normalizedConfig,
    candidateCensus,
    cohortPartition,
    selectorRanking
  );
  const fixedRanking = rankPackageSelector(
    loaded,
    normalizedConfig,
    candidateCensus,
    cohortPartition,
    "fixed-minimum"
  );
  const fixedSensitivity = evaluatePackageSelectorSensitivity(
    loaded,
    normalizedConfig,
    candidateCensus,
    cohortPartition,
    fixedRanking
  );
  const borderlineRanking = rankPackageSelector(
    loaded,
    normalizedConfig,
    candidateCensus,
    cohortPartition,
    "borderline-minimum"
  );
  const borderlineSensitivity = evaluatePackageSelectorSensitivity(
    loaded,
    normalizedConfig,
    candidateCensus,
    cohortPartition,
    borderlineRanking
  );
  const selectorAdmission = admitPackageSelectors(
    loaded,
    normalizedConfig,
    candidateCensus,
    [
      {
        selectorId: "minimum-length",
        partition: cohortPartition,
        ranking: selectorRanking,
        sensitivity: selectorSensitivity
      },
      {
        selectorId: "fixed-minimum",
        partition: cohortPartition,
        ranking: fixedRanking,
        sensitivity: fixedSensitivity
      },
      {
        selectorId: "borderline-minimum",
        partition: cohortPartition,
        ranking: borderlineRanking,
        sensitivity: borderlineSensitivity
      }
    ]
  );
  const disabledNullModelBaseline = evaluatePackageNullModelBaseline(
    loaded,
    normalizedConfig,
    candidateCensus,
    selectorAdmission,
    disabledNullModelPlan,
    disabledNullModelProposals,
    disabledNullModelTrialCensuses,
    disabledNullModelTrialSelections
  );
  const selectedFormations = materializePackageSelectedFormations(
    loaded,
    normalizedConfig,
    candidateCensus,
    selectorAdmission
  );
  const derivedProfiles = extractPackageDerivedProfiles(
    loaded,
    normalizedConfig,
    candidateCensus,
    selectorAdmission,
    selectedFormations
  );
  const derivedPopulation = materializePackageDerivedDepthPopulation(
    loaded,
    normalizedConfig,
    candidateCensus,
    selectorAdmission,
    selectedFormations,
    derivedProfiles
  );
  const levelClosure = closePackageLevel(loaded, normalizedConfig);
  const levelExplanationIndex = createPackageLevelExplanationIndex(
    loaded,
    normalizedConfig,
    levelClosure
  );
  const levelResultCensus = createPackageLevelResultCensus(
    loaded,
    normalizedConfig,
    levelClosure
  );
  const levelCandidateExplanation = explainPackageLevelCandidate(
    levelExplanationIndex,
    levelExplanationIndex.entries[0].candidateId
  );
  const depthSourceSelection = selectPackageDepthSourcePopulation(
    loaded,
    normalizedConfig,
    [levelClosure],
    2
  );
  const depthCandidates = enumeratePackageDepthCandidates(
    loaded,
    normalizedConfig,
    [levelClosure],
    2
  );
  const depthCandidateFilter = evaluatePackageDepthCandidateFilter(
    loaded,
    depthCandidates.binding,
    [levelClosure],
    depthCandidates.enumeration.candidateStore.candidates[0].candidate
  );
  const depthCandidateCensus = evaluatePackageDepthCandidateCensus(
    loaded,
    normalizedConfig,
    [levelClosure],
    2
  );
  const depthLevelClosure = closePackageDepthLevel(
    loaded,
    normalizedConfig,
    [levelClosure],
    2
  );
  const depthExplanationIndex = createPackageLevelExplanationIndex(
    loaded,
    normalizedConfig,
    depthLevelClosure,
    [levelClosure]
  );
  const depthResultCensus = createPackageLevelResultCensus(
    loaded,
    normalizedConfig,
    depthLevelClosure,
    [levelClosure]
  );
  const depthCandidateExplanation = explainPackageLevelCandidate(
    depthExplanationIndex,
    depthExplanationIndex.entries[0].candidateId
  );
  const runArtifactBundle = createPackageRunArtifactBundle(
    loaded,
    normalizedConfig,
    [levelClosure, depthLevelClosure]
  );
  const runArtifactStore = createPackageRunArtifactStore([runArtifactBundle]);
  const runCandidateExplanation = explainPackageRunCandidate(
    runArtifactStore,
    depthLevelClosure.run.runHash,
    depthExplanationIndex.entries[0].candidateId
  );
  const runArtifactMaterialization = materializePackageRunArtifact(
    runArtifactBundle,
    "levels/001/result.json"
  );
  const ladderClosure = closePackageLadder(loaded, normalizedConfig, 2);
  const fixpointConfig = structuredClone(normalizedConfig);
  fixpointConfig.boundedFixpoint = { enabled: true, maxIterations: 1 };
  const fixpointLadder = closePackageLadder(loaded, fixpointConfig, 1);
  const fixpointLevel = fixpointLadder.levels[0];
  const fixpointRound = fixpointLevel.rounds[0];
  const convergedFixpointPackage = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-converged-fixpoint-fixture",
    version: "1.0.0",
    primitives: [primitive("converged-fixpoint-source")],
    predicates: [predicate("one-fixpoint-node", {
      op: "compare",
      left: {
        kind: "count",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      comparator: "eq",
      right: { kind: "constant", value: 1 }
    })],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      derivedTypeTags: ["runtime-derived"],
      claimRefs: []
    }
  });
  const convergedFixpointConfig = structuredClone(normalizedConfig);
  convergedFixpointConfig.countingDomain = "profile-quotient";
  convergedFixpointConfig.boundedFixpoint = {
    enabled: true,
    maxIterations: 2
  };
  const convergedFixpointLadder = closePackageLadder(
    convergedFixpointPackage,
    convergedFixpointConfig,
    1
  );
  const convergedFixpointLevel = convergedFixpointLadder.levels[0];
  const nullFixpointConfig = structuredClone(convergedFixpointConfig);
  nullFixpointConfig.nullModels = ["role-shuffle"];
  nullFixpointConfig.budget.nullModelRuns = 2;
  const nullFixpointLevel = closePackageLadder(
    convergedFixpointPackage,
    nullFixpointConfig,
    1
  ).levels[0];
  const profileCollapse = testPackageProfileCollapse(
    loaded,
    normalizedConfig,
    1
  );
  const boundaryConfig = structuredClone(normalizedConfig);
  boundaryConfig.levelBoundaryPolicy = {
    enabled: true,
    searchIntervals: [{ fromDepth: 1, toDepth: 1 }],
    maximumCollapseError: 1,
    tieTolerance: 0
  };
  const levelBoundaries = detectPackageLevelBoundaries(
    loaded,
    boundaryConfig,
    1
  );
  const carrierPromotions = materializePackageCarrierPromotions(
    loaded,
    normalizedConfig,
    ladderClosure,
    profileCollapse,
    2,
    {
      schemaVersion: "1",
      targetDepth: 1,
      sourceCoordinate: { level: 0 },
      targetCoordinate: { level: 1 },
      targetTypeTags: ["runtime-level-1-carrier"],
      claimRefs: ["runtime-promotion-claim"],
      evidence: ["runtime-promotion-evidence"],
      counterexampleDisposition: "block"
    }
  );

  assertSchema("run-config", normalizedConfig);
  assertSchema("skeleton-enumeration-result", skeletons);
  assertSchema("candidate-enumeration-input", enumerationInput);
  assertSchema("candidate-enumeration-result", enumeration);
  assertSchema(
    "resumable-candidate-enumeration-step",
    resumableEnumeration
  );
  assert.equal(pausedResumableEnumeration.status, "paused");
  assertSchema(
    "resumable-candidate-enumeration-step",
    pausedResumableEnumeration
  );
  assertNotSchema("resumable-candidate-enumeration-step", {
    ...resumableEnumeration,
    enumeration: null
  });
  assertNotSchema("resumable-candidate-enumeration-step", {
    ...pausedResumableEnumeration,
    checkpoint: null
  });
  assertSchema("primitive-depth-population", population);
  population.elements.forEach((element) => assertSchema("element", element));
  assertSchema("package-candidate-binding", binding);
  assertSchema("package-candidate-enumeration-result", packageEnumeration);
  assertSchema("package-profile-composition", packageEnumeration.profileComposition);
  assertSchema("predicate-graph-evaluation", graphEvaluation);
  const invalidNestedGraphPath = structuredClone(graphEvaluation);
  invalidNestedGraphPath.witnesses[0].expressionPath = "$.predicate";
  assertNotSchema("predicate-graph-evaluation", invalidNestedGraphPath);
  assertSchema("predicate-local-evaluation", localEvaluation);
  assertSchema("predicate-local-evaluation", irreducibleEvaluation);
  assertSchema("predicate-local-evaluation", minimalEvaluation);
  const incompleteMinimalSubstructure = structuredClone(minimalEvaluation);
  delete incompleteMinimalSubstructure.witnesses[0]
    .substructures[0].selectedNodeIndexes;
  assertNotSchema("predicate-local-evaluation", incompleteMinimalSubstructure);
  const invalidMinimalEnumeration = structuredClone(minimalEvaluation);
  invalidMinimalEnumeration.witnesses[0].enumeration = "single-removals-only";
  assertNotSchema("predicate-local-evaluation", invalidMinimalEnumeration);
  const missingSubstructurePolicy = structuredClone(irreducibleEvaluation);
  delete missingSubstructurePolicy.substructurePolicy;
  assertNotSchema("predicate-local-evaluation", missingSubstructurePolicy);
  assertSchema("predicate-local-evaluation", cycleEvaluation);
  const missingCycleSelection = structuredClone(cycleEvaluation);
  delete missingCycleSelection.witnesses[0].selections[0].cycleSelection;
  assertNotSchema("predicate-local-evaluation", missingCycleSelection);
  assertSchema("partial-predicate-graph-evaluation", partialEvaluation);
  assertSchema("package-candidate-filter-evaluation", filterEvaluation);
  assertSchema("package-functional-evaluation", functionalEvaluation);
  assertSchema("package-functional-evaluation", uncertainFunctionalEvaluation);
  assertSchema("package-functional-evaluation", scalarFunctionalEvaluation);
  const contradictoryFunctionalScore = structuredClone(functionalEvaluation);
  contradictoryFunctionalScore.diagnostic.toleranceTargetMet = false;
  assertNotSchema("package-functional-evaluation", contradictoryFunctionalScore);
  const missingFunctionalDetails = structuredClone(uncertainFunctionalEvaluation);
  delete missingFunctionalDetails.details;
  assertNotSchema("package-functional-evaluation", missingFunctionalDetails);
  assertSchema("package-candidate-census", candidateCensus);
  assertSchema("package-null-model-plan", disabledNullModelPlan);
  assertSchema("package-null-model-proposals", disabledNullModelProposals);
  assertSchema(
    "package-null-model-trial-censuses",
    disabledNullModelTrialCensuses
  );
  assertSchema(
    "package-null-model-trial-selections",
    disabledNullModelTrialSelections
  );
  assertSchema("package-null-model-baseline", disabledNullModelBaseline);
  const invalidNullModelPlan = structuredClone(disabledNullModelPlan);
  invalidNullModelPlan.status = "complete";
  assertNotSchema("package-null-model-plan", invalidNullModelPlan);
  assertSchema("package-cohort-partition", cohortPartition);
  assertSchema("package-cohort-partition", uncertainCohortPartition);
  assertSchema("package-cohort-partition", scalarCohortPartition);
  assertSchema("package-selector-ranking", selectorRanking);
  assertSchema("package-selector-sensitivity", selectorSensitivity);
  assertSchema("package-selector-sensitivity", fixedSensitivity);
  assertSchema("package-selector-sensitivity", borderlineSensitivity);
  assertSchema("package-selector-admission", selectorAdmission);
  assertSchema("package-selected-formations", selectedFormations);
  const fabricatedFormationCandidate = structuredClone(selectedFormations);
  fabricatedFormationCandidate.formations[0].candidateId = "not-a-hash";
  assertNotSchema("package-selected-formations", fabricatedFormationCandidate);
  assertSchema("package-derived-profiles", derivedProfiles);
  const fabricatedDerivedProfile = structuredClone(derivedProfiles);
  fabricatedDerivedProfile.results[0].profile.hash = "not-a-hash";
  assertNotSchema("package-derived-profiles", fabricatedDerivedProfile);
  assertSchema("package-derived-depth-population", derivedPopulation);
  derivedPopulation.elements.forEach((element) => assertSchema("element", element));
  const fabricatedDerivedDepth = structuredClone(derivedPopulation);
  fabricatedDerivedDepth.elements[0].kind = "primitive";
  assertNotSchema("package-derived-depth-population", fabricatedDerivedDepth);
  assertSchema("package-level-closure", levelClosure);
  assertSchema("package-level-explanation-index", levelExplanationIndex);
  assertSchema("package-level-candidate-explanation", levelCandidateExplanation);
  assertSchema("package-level-result-census", levelResultCensus);
  assertSchema("package-level-explanation-index", depthExplanationIndex);
  assertSchema("package-level-candidate-explanation", depthCandidateExplanation);
  assertSchema("package-level-result-census", depthResultCensus);
  assertSchema("package-run-semantic-manifest", runArtifactBundle.semanticManifest);
  assertSchema("package-run-artifact-bundle", runArtifactBundle);
  assertSchema("package-run-artifact-store", runArtifactStore);
  assertSchema("package-run-candidate-explanation", runCandidateExplanation);
  assertSchema(
    "package-run-artifact-materialization",
    runArtifactMaterialization
  );
  const invalidRunArtifact = structuredClone(runArtifactMaterialization);
  invalidRunArtifact.bytesBase64 = "not-base64";
  assertNotSchema("package-run-artifact-materialization", invalidRunArtifact);
  const invalidResultCensusDepth = structuredClone(levelResultCensus);
  invalidResultCensusDepth.targetDepth = 0;
  assertNotSchema("package-level-result-census", invalidResultCensusDepth);
  invalidResultCensusDepth.targetDepth = 65;
  assertNotSchema("package-level-result-census", invalidResultCensusDepth);
  const invalidExplanationDepth = structuredClone(levelCandidateExplanation);
  invalidExplanationDepth.targetDepth = 0;
  assertNotSchema("package-level-candidate-explanation", invalidExplanationDepth);
  const contradictoryLevelClosure = structuredClone(levelClosure);
  contradictoryLevelClosure.status = "empty";
  assertNotSchema("package-level-closure", contradictoryLevelClosure);
  assertSchema("package-depth-source-selection", depthSourceSelection);
  const contradictoryDepthSource = structuredClone(depthSourceSelection);
  contradictoryDepthSource.selectedDepths = [1];
  assertNotSchema("package-depth-source-selection", contradictoryDepthSource);
  assertSchema("package-depth-candidate-binding", depthCandidates.binding);
  assertSchema("package-depth-candidate-enumeration-result", depthCandidates);
  assertSchema("package-profile-composition", depthCandidates.profileComposition);
  const contradictoryDepthBinding = structuredClone(depthCandidates.binding);
  contradictoryDepthBinding.targetDepth = 1;
  assertNotSchema("package-depth-candidate-binding", contradictoryDepthBinding);
  assertSchema("package-depth-candidate-filter-evaluation", depthCandidateFilter);
  const invalidDepthCandidateFilter = structuredClone(depthCandidateFilter);
  invalidDepthCandidateFilter.formation.targetDepth = 65;
  assertNotSchema(
    "package-depth-candidate-filter-evaluation",
    invalidDepthCandidateFilter
  );
  assertSchema("package-depth-candidate-census", depthCandidateCensus);
  const invalidDepthCandidateCensus = structuredClone(depthCandidateCensus);
  invalidDepthCandidateCensus.interpretation.status = "empty";
  assertNotSchema("package-depth-candidate-census", invalidDepthCandidateCensus);
  assertSchema("package-depth-level-closure", depthLevelClosure);
  assertSchema("package-ladder-closure", ladderClosure);
  const contradictoryLadder = structuredClone(ladderClosure);
  contradictoryLadder.status = ladderClosure.status === "indeterminate"
    ? "complete"
    : "indeterminate";
  assertNotSchema("package-ladder-closure", contradictoryLadder);
  assertSchema(
    "package-current-level-candidate-binding",
    fixpointRound.artifacts.census.generation.binding
  );
  const disabledFixpointBinding = structuredClone(
    fixpointRound.artifacts.census.generation.binding
  );
  disabledFixpointBinding.runConfig.boundedFixpoint.enabled = false;
  assertNotSchema(
    "package-current-level-candidate-binding",
    disabledFixpointBinding
  );
  assertSchema(
    "package-current-level-candidate-enumeration-result",
    fixpointRound.artifacts.census.generation
  );
  assertSchema(
    "package-current-level-candidate-census",
    fixpointRound.artifacts.census
  );
  for (const evaluation of
    fixpointRound.artifacts.census.candidateEvaluations) {
    assertSchema(
      "package-current-level-candidate-filter-evaluation",
      evaluation
    );
    assertNotSchema("package-depth-candidate-filter-evaluation", evaluation);
  }
  assertSchema(
    "package-current-level-population",
    fixpointLevel.artifacts.population
  );
  const overLimitFixpointPopulation = structuredClone(
    fixpointLevel.artifacts.population
  );
  overLimitFixpointPopulation.maxIterations = 10_001;
  assertNotSchema(
    "package-current-level-population",
    overLimitFixpointPopulation
  );
  assertSchema("package-current-level-fixpoint-closure", fixpointLevel);
  assertSchema("package-fixpoint-ladder-closure", fixpointLadder);
  assert.equal(convergedFixpointLevel.status, "complete");
  assert.equal(convergedFixpointLevel.fixpoint.status, "converged");
  assertSchema(
    "package-current-level-population",
    convergedFixpointLevel.artifacts.population
  );
  assertSchema(
    "package-current-level-fixpoint-closure",
    convergedFixpointLevel
  );
  assertSchema("package-fixpoint-ladder-closure", convergedFixpointLadder);
  assert.equal(nullFixpointLevel.baseline.status, "complete");
  assertSchema("package-current-level-fixpoint-closure", nullFixpointLevel);
  for (const round of nullFixpointLevel.rounds) {
    assertSchema("package-null-model-plan", round.artifacts.nullModels.plan);
    assertSchema(
      "package-null-model-proposals",
      round.artifacts.nullModels.proposals
    );
    assertSchema(
      "package-null-model-trial-censuses",
      round.artifacts.nullModels.trialCensuses
    );
    assertSchema(
      "package-null-model-trial-selections",
      round.artifacts.nullModels.trialSelections
    );
    assertSchema("package-null-model-baseline", round.baseline);
  }
  const missingNullArtifacts = structuredClone(nullFixpointLevel);
  delete missingNullArtifacts.artifacts.nullModels;
  assertNotSchema(
    "package-current-level-fixpoint-closure",
    missingNullArtifacts
  );
  const contradictoryFixpoint = structuredClone(fixpointLevel);
  contradictoryFixpoint.fixpoint.converged = true;
  assertNotSchema(
    "package-current-level-fixpoint-closure",
    contradictoryFixpoint
  );
  assertSchema("package-profile-collapse", profileCollapse);
  const contradictoryCollapse = structuredClone(profileCollapse);
  contradictoryCollapse.verdict = profileCollapse.verdict === "equivalent"
    ? "indeterminate"
    : "equivalent";
  assertNotSchema("package-profile-collapse", contradictoryCollapse);
  assertSchema("package-level-boundary-report", levelBoundaries);
  const contradictoryBoundary = structuredClone(levelBoundaries);
  contradictoryBoundary.interpretation.status = "truncated";
  assertNotSchema("package-level-boundary-report", contradictoryBoundary);
  assertSchema("package-carrier-promotions", carrierPromotions);
  const contradictoryPromotion = structuredClone(carrierPromotions);
  contradictoryPromotion.status = "indeterminate";
  assertNotSchema("package-carrier-promotions", contradictoryPromotion);
  const contradictoryAdmission = structuredClone(selectorAdmission);
  contradictoryAdmission.decisions[0].outcome = "selector-excluded";
  assertNotSchema("package-selector-admission", contradictoryAdmission);
  const fabricatedVariantStability = structuredClone(borderlineSensitivity);
  fabricatedVariantStability.points[0].leaderSetStability = 1;
  assertNotSchema("package-selector-sensitivity", fabricatedVariantStability);
  const completeSensitivityWithoutVerdict = structuredClone(selectorSensitivity);
  completeSensitivityWithoutVerdict.verdict = null;
  assertNotSchema(
    "package-selector-sensitivity",
    completeSensitivityWithoutVerdict
  );
  const rankedMemberWithoutExtremum = structuredClone(selectorRanking);
  rankedMemberWithoutExtremum.cohortRankings[0].members[0].semanticExtremum = null;
  assertNotSchema("package-selector-ranking", rankedMemberWithoutExtremum);
  const incompleteCohortCoverage = structuredClone(cohortPartition);
  incompleteCohortCoverage.cohorts[0].members = [];
  assertNotSchema("package-cohort-partition", incompleteCohortCoverage);
  const mismatchedCohortRuleKey = structuredClone(cohortPartition);
  mismatchedCohortRuleKey.cohorts[0].key = {
    kind: "profile-role",
    atoms: [{ kind: "string", value: "not-global" }]
  };
  assertNotSchema("package-cohort-partition", mismatchedCohortRuleKey);
  const falseResolvedCohortKey = structuredClone(uncertainCohortPartition);
  falseResolvedCohortKey.keyEvaluations[0].status = "resolved";
  assertNotSchema("package-cohort-partition", falseResolvedCohortKey);
  const invalidCandidateCensus = structuredClone(candidateCensus);
  invalidCandidateCensus.interpretation.status = "empty";
  assertNotSchema("package-candidate-census", invalidCandidateCensus);
  const nonemptyDeclaredEmpty = structuredClone(candidateCensus);
  nonemptyDeclaredEmpty.booleanSelectivity = null;
  nonemptyDeclaredEmpty.indeterminateRatio = null;
  nonemptyDeclaredEmpty.interpretation = {
    status: "empty",
    reasons: ["no-evaluated-candidates"]
  };
  assertNotSchema("package-candidate-census", nonemptyDeclaredEmpty);
  const invalidInertness = structuredClone(candidateCensus);
  invalidInertness.census[0].inert = false;
  assertNotSchema("package-candidate-census", invalidInertness);
  const invalidDominance = structuredClone(candidateCensus);
  invalidDominance.census[0].dominating = true;
  assertNotSchema("package-candidate-census", invalidDominance);

  const indeterminateLoaded = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-schema-indeterminate-census",
    version: "1.0.0",
    primitives: [primitive()],
    predicates: [predicate("unresolved-node", {
      op: "degree",
      node: { kind: "canonical-index", index: 9 },
      min: 0
    })],
    functionals: [{
      id: "score",
      expr: { kind: "constant", value: 0 },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "score-result",
        unit: "1",
        semantic: "score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "score",
      claimRefs: []
    }],
    cohortRules: [{ id: "all-eligible", kind: "global" }],
    selectors: [{
      id: "minimum",
      objective: "min",
      functional: "score",
      cohortRule: "all-eligible",
      epsilon: quantity(0, "1", "selector epsilon"),
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 0.9,
        robustTopKThreshold: 0.9
      },
      explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
  const indeterminateCensus = evaluatePackageCandidateCensus(
    indeterminateLoaded,
    normalizedConfig
  );
  assert.equal(indeterminateCensus.interpretation.status, "indeterminate");
  assertSchema("package-candidate-census", indeterminateCensus);
  const sourceIndeterminatePartition = constructPackageCohorts(
    indeterminateLoaded,
    normalizedConfig,
    indeterminateCensus,
    "all-eligible"
  );
  assertSchema("package-cohort-partition", sourceIndeterminatePartition);
  const sourceIndeterminateRanking = rankPackageSelector(
    indeterminateLoaded,
    normalizedConfig,
    indeterminateCensus,
    sourceIndeterminatePartition,
    "minimum"
  );
  assertSchema("package-selector-ranking", sourceIndeterminateRanking);
  const sourceIndeterminateSensitivity = evaluatePackageSelectorSensitivity(
    indeterminateLoaded,
    normalizedConfig,
    indeterminateCensus,
    sourceIndeterminatePartition,
    sourceIndeterminateRanking
  );
  assertSchema(
    "package-selector-sensitivity",
    sourceIndeterminateSensitivity
  );
  const fabricatedSensitivityPoint = structuredClone(
    sourceIndeterminateSensitivity
  );
  fabricatedSensitivityPoint.points.push(selectorSensitivity.points[0]);
  assertNotSchema("package-selector-sensitivity", fabricatedSensitivityPoint);
  const contradictoryIndeterminate = structuredClone(indeterminateCensus);
  contradictoryIndeterminate.interpretation.reasons.push("no-evaluated-candidates");
  assertNotSchema("package-candidate-census", contradictoryIndeterminate);

  const rejectedLoaded = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-schema-empty-cohort",
    version: "1.0.0",
    primitives: [primitive()],
    predicates: [predicate("requires-support", {
      op: "countRole",
      role: "support",
      min: 1
    })],
    functionals: [{
      id: "score",
      expr: { kind: "constant", value: 0 },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "score-result",
        unit: "1",
        semantic: "score",
        toleranceTarget: { absolute: 0 }
      },
      explain: "score",
      claimRefs: []
    }],
    cohortRules: [{ id: "all-eligible", kind: "global" }],
    selectors: [{
      id: "minimum",
      objective: "min",
      functional: "score",
      cohortRule: "all-eligible",
      epsilon: quantity(0, "1", "selector epsilon"),
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 0.9,
        robustTopKThreshold: 0.9
      },
      explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
  const rejectedCensus = evaluatePackageCandidateCensus(
    rejectedLoaded,
    normalizedConfig
  );
  const emptyCohortPartition = constructPackageCohorts(
    rejectedLoaded,
    normalizedConfig,
    rejectedCensus,
    "all-eligible"
  );
  assert.equal(emptyCohortPartition.status, "empty");
  assertSchema("package-cohort-partition", emptyCohortPartition);
  const emptySelectorRanking = rankPackageSelector(
    rejectedLoaded,
    normalizedConfig,
    rejectedCensus,
    emptyCohortPartition,
    "minimum"
  );
  assertSchema("package-selector-ranking", emptySelectorRanking);
  const emptySelectorSensitivity = evaluatePackageSelectorSensitivity(
    rejectedLoaded,
    normalizedConfig,
    rejectedCensus,
    emptyCohortPartition,
    emptySelectorRanking
  );
  assertSchema("package-selector-sensitivity", emptySelectorSensitivity);
  const falseEmptyRobustness = structuredClone(emptySelectorSensitivity);
  falseEmptyRobustness.verdict = "robust";
  assertNotSchema("package-selector-sensitivity", falseEmptyRobustness);

  const missingInvariantLoaded = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-schema-missing-functional-invariant",
    version: "1.0.0",
    primitives: [
      primitive("missing-source"),
      primitive("declared-source", {
        length: quantity(1, "m", "length")
      })
    ],
    functionals: [{
      id: "missing-length",
      expr: { kind: "invariant", name: "length" },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "missing-length-result",
        unit: "m",
        semantic: "missing length",
        toleranceTarget: { absolute: 0 }
      },
      explain: "missing invariant fixture",
      claimRefs: []
    }],
    cohortRules: [{ id: "all-eligible", kind: "global" }],
    selectors: [{
      id: "minimum-missing",
      objective: "min",
      functional: "missing-length",
      cohortRule: "all-eligible",
      epsilon: quantity(0, "m", "selector epsilon"),
      tiePolicy: "retain-all",
      sensitivity: {
        amplitudes: [0.1],
        sweep: "one-at-a-time",
        topK: 1,
        robustLeaderSetThreshold: 0.9,
        robustTopKThreshold: 0.9
      },
      explain: { pass: "selected", fail: "excluded", indeterminate: "unknown" },
      claimRefs: []
    }]
  });
  const missingBinding = createPackageCandidateBinding(
    missingInvariantLoaded,
    normalizedConfig
  );
  const missingRef = missingInvariantLoaded.normalized.primitives
    .find((entry) => entry.sourceId === "missing-source").elementId;
  const missingFilter = evaluatePackageCandidateFilter(
    missingInvariantLoaded,
    missingBinding,
    {
      domain: "element-exact",
      nodes: [{ ref: missingRef }],
      edges: []
    }
  );
  const missingFunctionalEvaluation = evaluatePackageFunctional(
    missingInvariantLoaded,
    missingBinding,
    missingFilter,
    "missing-length"
  );
  assert.equal(missingFunctionalEvaluation.reason, "invariant-value-unavailable");
  assertSchema("package-functional-evaluation", missingFunctionalEvaluation);
  const invalidMissingDiagnostic = structuredClone(missingFunctionalEvaluation);
  invalidMissingDiagnostic.diagnostic = functionalEvaluation.diagnostic;
  assertNotSchema("package-functional-evaluation", invalidMissingDiagnostic);
  const missingCensus = evaluatePackageCandidateCensus(
    missingInvariantLoaded,
    normalizedConfig
  );
  const missingPartition = constructPackageCohorts(
    missingInvariantLoaded,
    normalizedConfig,
    missingCensus,
    "all-eligible"
  );
  const memberIndeterminateRanking = rankPackageSelector(
    missingInvariantLoaded,
    normalizedConfig,
    missingCensus,
    missingPartition,
    "minimum-missing"
  );
  assert.equal(memberIndeterminateRanking.reason, "member-functional-indeterminate");
  assertSchema("package-selector-ranking", memberIndeterminateRanking);
  const memberIndeterminateSensitivity = evaluatePackageSelectorSensitivity(
    missingInvariantLoaded,
    normalizedConfig,
    missingCensus,
    missingPartition,
    memberIndeterminateRanking
  );
  assertSchema(
    "package-selector-sensitivity",
    memberIndeterminateSensitivity
  );
  const fabricatedIndeterminateMetric = structuredClone(memberIndeterminateRanking);
  fabricatedIndeterminateMetric.cohortRankings[0].degeneracy = 1;
  assertNotSchema("package-selector-ranking", fabricatedIndeterminateMetric);
});

test("published graph evaluation schema accepts witnesses above sixty-four edges", () => {
  const plan = compilePredicate(predicate("large-edge-witness", {
    op: "countRole",
    role: "support",
    min: 65,
    max: 65
  }));
  const candidate = {
    domain: "element-exact",
    nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
    edges: Array.from(
      { length: 65 },
      () => ({ from: 0, to: 0, role: "support" })
    )
  };
  const evaluation = evaluateGraphPredicatePlan(plan, candidate, {
    policy: { allowParallelEdges: true, allowSelfLoops: true },
    limits: { maxEdges: 65 }
  });

  assert.equal(evaluation.witnesses[0].edgeIndexes.length, 65);
  assertSchema("predicate-graph-evaluation", evaluation);
});

test("numeric structural-attribute sum evaluations conform to the published schema", () => {
  const exactAccumulation = accumulateDecimals(["0.1", "0.2"], "exact-decimal");
  const compensatedAccumulation = accumulateDecimals(
    ["10000000000000000", "1", "-10000000000000000"],
    "compensated-binary64"
  );
  assertSchema("decimal-unrounded-accumulation", exactAccumulation);
  assertSchema("decimal-unrounded-accumulation", compensatedAccumulation);
  assertNotSchema("decimal-unrounded-accumulation", {
    ...compensatedAccumulation,
    exact: true
  });
  const plan = compilePredicate(predicate("attribute-sum", {
    op: "compare",
    left: {
      kind: "sum",
      attribute: "score",
      set: { kind: "nodes", selector: { kind: "all" } }
    },
    comparator: "eq",
    right: { kind: "constant", value: 0.3 }
  }), { environment: { attributes: { score: { kind: "number" } } } });
  const binding = bindPredicateNumericPolicy(plan, runConfig().invariantPrecision);
  const candidate = {
    domain: "element-exact",
    nodes: [
      {
        ref: `sha256:${"a".repeat(64)}`,
        attrs: {
          score: 0.1,
          distance: quantity(100, "cm", "length", { absolute: 10 }, ["evidence-b"])
        }
      },
      {
        ref: `sha256:${"b".repeat(64)}`,
        attrs: {
          score: 0.2,
          distance: quantity(2, "m", "length", { relative: 0.1 }, ["evidence-a"])
        }
      }
    ],
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  const options = {
    policy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: ["distance", "score"],
      structuralEdgeAttributes: []
    }
  };
  const evaluation = evaluateLocalPredicatePlan(plan, binding, candidate, options);
  const compensatedBinding = bindPredicateNumericPolicy(plan, {
    ...runConfig().invariantPrecision,
    summation: "compensated-binary64"
  });
  const compensated = evaluateLocalPredicatePlan(
    plan,
    compensatedBinding,
    candidate,
    options
  );

  assert.equal(evaluation.outcome, "pass");
  assertSchema("predicate-local-evaluation", evaluation);
  assert.equal(compensated.witnesses[0].left.exact, false);
  assertSchema("predicate-local-evaluation", compensated);
  const inconsistent = structuredClone(compensated);
  inconsistent.witnesses[0].selections[0].accumulationExact = true;
  assertNotSchema("predicate-local-evaluation", inconsistent);

  const quantityPlan = compilePredicate(predicate("quantity-attribute-sum", {
    op: "compare",
    left: {
      kind: "sum",
      attribute: "distance",
      set: { kind: "nodes", selector: { kind: "all" } }
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(3.2, "m", "length") }
  }), {
    environment: {
      attributes: {
        distance: { kind: "quantity", unit: "m", semantic: "length" }
      }
    }
  });
  const quantityEvaluation = evaluateLocalPredicatePlan(
    quantityPlan,
    bindPredicateNumericPolicy(quantityPlan, runConfig().invariantPrecision),
    candidate,
    options
  );
  assert.equal(quantityEvaluation.outcome, "pass");
  assert.equal(quantityEvaluation.witnesses[0].left.quantity.tolerance.absolute, 0.3);
  assertSchema("predicate-local-evaluation", quantityEvaluation);
  const incompleteQuantityWitness = structuredClone(quantityEvaluation);
  delete incompleteQuantityWitness.witnesses[0].selections[0].toleranceAggregation;
  assertNotSchema("predicate-local-evaluation", incompleteQuantityWitness);

  const additionPlan = compilePredicate(predicate("derived-quantity-add", {
    op: "compare",
    left: {
      kind: "add",
      terms: [
        { kind: "constant", value: quantity(0.05, "m", "length") },
        {
          kind: "sum",
          attribute: "distance",
          set: { kind: "nodes", selector: { kind: "all" } }
        }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(3.05, "m", "length") }
  }), {
    environment: {
      attributes: {
        distance: { kind: "quantity", unit: "m", semantic: "length" }
      }
    }
  });
  const additionEvaluation = evaluateLocalPredicatePlan(
    additionPlan,
    bindPredicateNumericPolicy(additionPlan, runConfig().invariantPrecision),
    candidate,
    options
  );
  assert.equal(additionEvaluation.outcome, "pass");
  assert.equal(
    additionEvaluation.witnesses[0].left.quantity.provenance.method,
    "local-quantity-add-v1"
  );
  assertSchema("predicate-local-evaluation", additionEvaluation);

  const scalingPlan = compilePredicate(predicate("derived-quantity-scale", {
    op: "compare",
    left: {
      kind: "multiply",
      factors: [
        { kind: "constant", value: -2 },
        {
          kind: "sum",
          attribute: "distance",
          set: { kind: "nodes", selector: { kind: "all" } }
        }
      ]
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(-6, "m", "length") }
  }), {
    environment: {
      attributes: {
        distance: { kind: "quantity", unit: "m", semantic: "length" }
      }
    }
  });
  const scalingEvaluation = evaluateLocalPredicatePlan(
    scalingPlan,
    bindPredicateNumericPolicy(scalingPlan, runConfig().invariantPrecision),
    candidate,
    options
  );
  assert.equal(scalingEvaluation.outcome, "pass");
  assert.equal(scalingEvaluation.witnesses[0].left.quantity.tolerance.absolute, 0.6);
  assert.equal(
    scalingEvaluation.witnesses[0].left.quantity.provenance.method,
    "local-quantity-scale-v1"
  );
  assertSchema("predicate-local-evaluation", scalingEvaluation);

  const balancePlan = compilePredicate(predicate("local-balance", {
    op: "balance",
    attribute: "score",
    over: { kind: "nodes", selector: { kind: "all" } },
    tolerance: quantity(0.3, "1", "score-balance")
  }), {
    environment: {
      attributes: { score: { kind: "number" } }
    }
  });
  const balanceEvaluation = evaluateLocalPredicatePlan(
    balancePlan,
    bindPredicateNumericPolicy(balancePlan, runConfig().invariantPrecision),
    candidate,
    options
  );
  assert.equal(balanceEvaluation.outcome, "pass");
  assert.equal(balanceEvaluation.witnesses[0].operator, "balance");
  assertSchema("predicate-local-evaluation", balanceEvaluation);
  const invalidBalanceComparison = structuredClone(balanceEvaluation);
  invalidBalanceComparison.witnesses[0].comparison.comparator = "eq";
  assertNotSchema("predicate-local-evaluation", invalidBalanceComparison);
  for (const field of ["attribute", "valueKind", "summation", "accumulationExact"]) {
    const incompleteBalanceSelection = structuredClone(balanceEvaluation);
    delete incompleteBalanceSelection.witnesses[0].selections[0][field];
    assertNotSchema("predicate-local-evaluation", incompleteBalanceSelection);
  }

  const quantityBalancePlan = compilePredicate(predicate("local-quantity-balance", {
    op: "balance",
    attribute: "distance",
    over: { kind: "nodes", selector: { kind: "all" } },
    tolerance: quantity(3.2, "m", "length")
  }), {
    environment: {
      attributes: {
        distance: { kind: "quantity", unit: "m", semantic: "length" }
      }
    }
  });
  const quantityBalanceEvaluation = evaluateLocalPredicatePlan(
    quantityBalancePlan,
    bindPredicateNumericPolicy(
      quantityBalancePlan,
      runConfig().invariantPrecision
    ),
    candidate,
    options
  );
  assert.equal(quantityBalanceEvaluation.outcome, "pass");
  assert.equal(quantityBalanceEvaluation.witnesses[0].aggregate.kind, "quantity");
  assertSchema("predicate-local-evaluation", quantityBalanceEvaluation);

  const invariantPlan = compilePredicate(predicate("element-invariant", {
    op: "compare",
    left: {
      kind: "invariant",
      name: "length",
      node: { kind: "canonical-index", index: 0 }
    },
    comparator: "eq",
    right: { kind: "constant", value: quantity(1, "m", "length") }
  }), {
    environment: {
      invariants: {
        length: quantity(1, "m", "length")
      }
    }
  });
  const invariantContext = {
    sourcePopulationHash: `sha256:${"d".repeat(64)}`,
    elements: candidate.nodes.map((node) => ({
      elementId: node.ref,
      invariants: { length: quantity(1, "m", "length") }
    }))
  };
  const invariantEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    bindPredicateNumericPolicy(invariantPlan, runConfig().invariantPrecision),
    candidate,
    { ...options, invariantContext }
  );
  assert.equal(invariantEvaluation.outcome, "pass");
  assert.equal(invariantEvaluation.witnesses[0].invariants.length, 1);
  assertSchema("predicate-local-evaluation", invariantEvaluation);
  const missingInvariantSource = structuredClone(invariantEvaluation);
  delete missingInvariantSource.invariantSourcePopulationHash;
  assertNotSchema("predicate-local-evaluation", missingInvariantSource);
  const missingInvariantWitnesses = structuredClone(invariantEvaluation);
  delete missingInvariantWitnesses.witnesses[0].invariants;
  assertNotSchema("predicate-local-evaluation", missingInvariantWitnesses);
  assertNotSchema("predicate-local-evaluation", {
    ...evaluation,
    invariantSourcePopulationHash: invariantContext.sourcePopulationHash
  });

  const profileHash = `sha256:${"9".repeat(64)}`;
  const profileCandidate = {
    domain: "profile-quotient",
    nodes: [{ ref: profileHash }],
    edges: []
  };
  const profileContext = {
    sourcePopulationHash: invariantContext.sourcePopulationHash,
    elements: candidate.nodes.map((node) => ({
      elementId: node.ref,
      invariants: { length: quantity(1, "m", "length") }
    })),
    profileClasses: [{
      profileHash,
      members: candidate.nodes.map((node) => node.ref)
    }]
  };
  const profileEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    bindPredicateNumericPolicy(invariantPlan, runConfig().invariantPrecision),
    profileCandidate,
    { ...options, invariantContext: profileContext }
  );
  assert.equal(profileEvaluation.outcome, "pass");
  assert.equal(
    profileEvaluation.witnesses[0].invariants[0].consensusPolicy,
    "identical-normalized-quantity-v1"
  );
  assertSchema("predicate-local-evaluation", profileEvaluation);
  const incompleteConsensus = structuredClone(profileEvaluation);
  delete incompleteConsensus.witnesses[0].invariants[0].consensusPolicy;
  assertNotSchema("predicate-local-evaluation", incompleteConsensus);

  const scalarInvariantPlan = compilePredicate(predicate("scalar-invariant", {
    op: "compare",
    left: {
      kind: "invariant",
      name: "score",
      node: { kind: "canonical-index", index: 0 }
    },
    comparator: "eq",
    right: { kind: "constant", value: 1 }
  }), {
    environment: { invariants: { score: { kind: "number" } } }
  });
  const scalarInvariantEvaluation = evaluateLocalPredicatePlan(
    scalarInvariantPlan,
    bindPredicateNumericPolicy(
      scalarInvariantPlan,
      runConfig().invariantPrecision
    ),
    candidate,
    {
      ...options,
      invariantContext: {
        sourcePopulationHash: invariantContext.sourcePopulationHash,
        elements: candidate.nodes.map((node) => ({
          elementId: node.ref,
          invariants: { score: 1 }
        }))
      }
    }
  );
  assertSchema("predicate-local-evaluation", scalarInvariantEvaluation);
  const invalidScalarResolution = structuredClone(scalarInvariantEvaluation);
  invalidScalarResolution.witnesses[0].invariants[0].valueKind = "string";
  assertNotSchema("predicate-local-evaluation", invalidScalarResolution);
  const profileScalarInvariantEvaluation = evaluateLocalPredicatePlan(
    scalarInvariantPlan,
    bindPredicateNumericPolicy(
      scalarInvariantPlan,
      runConfig().invariantPrecision
    ),
    profileCandidate,
    {
      ...options,
      invariantContext: {
        sourcePopulationHash: invariantContext.sourcePopulationHash,
        elements: candidate.nodes.map((node) => ({
          elementId: node.ref,
          invariants: { score: 1 }
        })),
        profileClasses: profileContext.profileClasses
      }
    }
  );
  assertSchema("predicate-local-evaluation", profileScalarInvariantEvaluation);
  const invalidScalarConsensus = structuredClone(profileScalarInvariantEvaluation);
  invalidScalarConsensus.witnesses[0].invariants[0].consensusPolicy =
    "identical-normalized-quantity-v1";
  assertNotSchema("predicate-local-evaluation", invalidScalarConsensus);

  const disagreementContext = structuredClone(profileContext);
  disagreementContext.elements[0].invariants.length = quantity(2, "m", "length");
  const indeterminateInvariantEvaluation = evaluateLocalPredicatePlan(
    invariantPlan,
    bindPredicateNumericPolicy(invariantPlan, runConfig().invariantPrecision),
    profileCandidate,
    { ...options, invariantContext: disagreementContext }
  );
  assert.equal(indeterminateInvariantEvaluation.outcome, "indeterminate");
  assertSchema("predicate-local-evaluation", indeterminateInvariantEvaluation);
  const missingIndeterminateSource = structuredClone(indeterminateInvariantEvaluation);
  delete missingIndeterminateSource.invariantSourcePopulationHash;
  assertNotSchema("predicate-local-evaluation", missingIndeterminateSource);
  const invalidInvariantFailure = structuredClone(indeterminateInvariantEvaluation);
  invalidInvariantFailure.witnesses[0].invariantFailures[0].reason =
    "representative-substitution";
  assertNotSchema("predicate-local-evaluation", invalidInvariantFailure);
  const incompleteInvariantFailure = structuredClone(indeterminateInvariantEvaluation);
  delete incompleteInvariantFailure.witnesses[0]
    .invariantFailures[0].details.profileHash;
  assertNotSchema("predicate-local-evaluation", incompleteInvariantFailure);
  const resolvedFieldsOnIndeterminate = structuredClone(indeterminateInvariantEvaluation);
  resolvedFieldsOnIndeterminate.witnesses[0].left =
    scalarInvariantEvaluation.witnesses[0].left;
  assertNotSchema("predicate-local-evaluation", resolvedFieldsOnIndeterminate);

  const twoMissingPlan = compilePredicate(predicate("two-missing-invariants", {
    op: "compare",
    left: {
      kind: "invariant",
      name: "leftLength",
      node: { kind: "canonical-index", index: 0 }
    },
    comparator: "eq",
    right: {
      kind: "invariant",
      name: "rightLength",
      node: { kind: "canonical-index", index: 0 }
    }
  }), {
    environment: {
      invariants: {
        leftLength: quantity(1, "m", "length"),
        rightLength: quantity(1, "m", "length")
      }
    }
  });
  const twoMissingEvaluation = evaluateLocalPredicatePlan(
    twoMissingPlan,
    bindPredicateNumericPolicy(twoMissingPlan, runConfig().invariantPrecision),
    candidate,
    {
      ...options,
      invariantContext: {
        sourcePopulationHash: invariantContext.sourcePopulationHash,
        elements: candidate.nodes.map((node) => ({
          elementId: node.ref,
          invariants: {}
        }))
      }
    }
  );
  assert.equal(twoMissingEvaluation.witnesses[0].invariantFailures.length, 2);
  assertSchema("predicate-local-evaluation", twoMissingEvaluation);
  const reversedInvariantFailures = structuredClone(twoMissingEvaluation);
  reversedInvariantFailures.witnesses[0].invariantFailures.reverse();
  assertNotSchema("predicate-local-evaluation", reversedInvariantFailures);
});

test("package-driven scalar candidate attributes conform through generation and filtering", () => {
  const first = primitive("candidate-attribute-a");
  first.invariants = { mass: 1 };
  const second = primitive("candidate-attribute-b");
  second.typeTags = ["fixture-b"];
  second.invariants = { mass: 2 };
  const input = {
    schemaVersion: "1",
    id: "runtime-candidate-attribute-fixture",
    version: "1.0.0",
    primitives: [first, second],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "element-invariant-scalar-v1",
        invariant: "mass"
      }
    }, {
      name: "strength",
      target: "edges",
      source: { kind: "constant-scalar-v1", value: 3 }
    }],
    predicates: [predicate("positive-mass", {
      op: "compare",
      left: {
        kind: "sum",
        attribute: "mass",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      comparator: "gte",
      right: { kind: "constant", value: 1 }
    })]
  };
  assertSchema("kernel-package", input);
  assertSchema("candidate-attribute-definition", input.candidateAttributes[0]);
  const loaded = loadKernelPackage(input);
  const config = runConfig();
  config.budget.maxNodes = 2;
  config.budget.maxEdges = 1;
  config.budget.maxCandidates = 100;
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  config.graphPolicy.structuralEdgeAttributes = ["strength"];
  const generation = enumeratePackageCandidates(loaded, config);
  const census = evaluatePackageCandidateCensus(loaded, config);

  assertSchema("package-candidate-enumeration-result", generation);
  assertSchema("package-candidate-census", census);
  assert.equal(census.counts.filterIndeterminate, 0);
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.nodes.every((node) => node.attrs.mass >= 1) &&
    entry.candidate.edges.every((edge) => edge.attrs.strength === 3)
  ));
});

test("package-driven Quantity candidate attributes conform through generation and filtering", () => {
  const first = primitive("quantity-candidate-attribute-a");
  first.invariants = { mass: quantity(1000, "g", "mass") };
  const second = primitive("quantity-candidate-attribute-b");
  second.typeTags = ["fixture-b"];
  second.invariants = { mass: quantity(1, "kg", "mass") };
  const input = {
    schemaVersion: "1",
    id: "runtime-quantity-candidate-attribute-fixture",
    version: "1.0.0",
    primitives: [first, second],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "element-invariant-quantity-v1",
        invariant: "mass"
      }
    }, {
      name: "span",
      target: "edges",
      source: {
        kind: "constant-quantity-v1",
        value: quantity(100, "cm", "length")
      }
    }],
    predicates: [predicate("positive-quantity-mass", {
      op: "compare",
      left: {
        kind: "sum",
        attribute: "mass",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      comparator: "gte",
      right: { kind: "constant", value: quantity(1, "kg", "mass") }
    })],
    functionals: [{
      id: "total-mass",
      expr: {
        kind: "sum",
        attribute: "mass",
        set: { kind: "nodes", selector: { kind: "all" } }
      },
      coefficients: {},
      sensitivityCoefficients: [],
      result: {
        id: "total-mass-result",
        unit: "kg",
        semantic: "mass",
        toleranceTarget: { absolute: 0 }
      },
      explain: "Sum candidate mass.",
      claimRefs: []
    }]
  };
  assertSchema("kernel-package", input);
  input.candidateAttributes.forEach((entry) =>
    assertSchema("candidate-attribute-definition", entry)
  );
  const scalarAsQuantity = structuredClone(input.candidateAttributes[1]);
  scalarAsQuantity.source.value = 1;
  assertNotSchema("candidate-attribute-definition", scalarAsQuantity);
  const invariantEdge = structuredClone(input.candidateAttributes[0]);
  invariantEdge.target = "edges";
  assertNotSchema("candidate-attribute-definition", invariantEdge);

  const loaded = loadKernelPackage(input);
  const config = runConfig();
  config.budget.maxNodes = 2;
  config.budget.maxEdges = 1;
  config.budget.maxCandidates = 100;
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  config.graphPolicy.structuralEdgeAttributes = ["span"];
  const generation = enumeratePackageCandidates(loaded, config);
  const census = evaluatePackageCandidateCensus(loaded, config);

  assertSchema("package-candidate-enumeration-result", generation);
  assertSchema("package-candidate-census", census);
  assert.equal(census.counts.filterIndeterminate, 0);
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.nodes.every((node) => node.attrs.mass.unit === "kg") &&
    entry.candidate.edges.every((edge) => edge.attrs.span.unit === "m")
  ));
  const candidate = generation.enumeration.candidateStore.candidates
    .map((entry) => entry.candidate)
    .find((entry) => entry.nodes.length === 2);
  const filter = evaluatePackageCandidateFilter(
    loaded,
    generation.binding,
    candidate
  );
  const functional = evaluatePackageFunctional(
    loaded,
    generation.binding,
    filter,
    "total-mass"
  );
  assertSchema("package-functional-evaluation", functional);
  assert.equal(functional.status, "scored");
  assert.equal(functional.selections[0].valueKind, "quantity");
});

test("role-dependent edge candidate attributes conform through finite generation", () => {
  const input = {
    schemaVersion: "1",
    id: "runtime-role-candidate-attribute-fixture",
    version: "1.0.0",
    primitives: [primitive("role-candidate-attribute-source")],
    candidateAttributes: [{
      name: "weight",
      target: "edges",
      source: {
        kind: "edge-role-scalar-v1",
        values: { supports: 2, transforms: 1 }
      }
    }, {
      name: "span",
      target: "edges",
      source: {
        kind: "edge-role-quantity-v1",
        values: {
          supports: quantity(100, "cm", "length"),
          transforms: quantity(2, "m", "length")
        }
      }
    }]
  };
  assertSchema("kernel-package", input);
  input.candidateAttributes.forEach((entry) =>
    assertSchema("candidate-attribute-definition", entry)
  );
  const invalidTarget = structuredClone(input.candidateAttributes[0]);
  invalidTarget.target = "nodes";
  assertNotSchema("candidate-attribute-definition", invalidTarget);
  const emptyMap = structuredClone(input.candidateAttributes[1]);
  emptyMap.source.values = {};
  assertNotSchema("candidate-attribute-definition", emptyMap);

  const loaded = loadKernelPackage(input);
  const config = runConfig();
  config.roleAlphabet = ["supports", "transforms"];
  config.budget.maxNodes = 2;
  config.budget.maxEdges = 1;
  config.budget.maxCandidates = 100;
  config.graphPolicy.structuralEdgeAttributes = ["weight", "span"];
  const generation = enumeratePackageCandidates(loaded, config);

  assertSchema("package-candidate-enumeration-result", generation);
  assert.ok(generation.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.edges.every((edge) =>
      edge.attrs.weight === (edge.role === "supports" ? 2 : 1) &&
      edge.attrs.span.value === (edge.role === "supports" ? 1 : 2)
    )
  ));
});

test("typed profile partner guards and evaluation lineage conform to published schemas", () => {
  const guard = { op: "partnerTypeTag", typeTag: "fixture" };
  assertSchema("profile-slot-guard", guard);
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-profile-guard-fixture",
    version: "1.0.0",
    primitives: [{
      ...primitive("profile-guard-source"),
      profile: {
        slots: [{
          role: "support",
          polarity: "out",
          capacity: { min: 0, max: 2 }
        }, {
          role: "support",
          polarity: "in",
          capacity: { min: 0, max: 2 },
          guard
        }],
        invariantVector: [],
        precisionPolicy: "profile-guard-fixture-v1"
      }
    }],
    predicates: [predicate("one-support", {
      op: "countRole",
      role: "support",
      min: 1,
      max: 1
    })],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "profile-guard-fixture-v1"
      },
      derivedTypeTags: ["profile-guard-derived"],
      claimRefs: []
    }
  });
  const config = runConfig();
  config.budget.maxNodes = 2;
  config.budget.maxEdges = 1;
  config.budget.maxCandidates = 100;
  config.profileCompositionPolicy = "profile-slot-gate-v1";
  config.ontologyTarget = { level: 2, phase: "B", segment: "guarded" };
  const guardedGeneration = enumeratePackageCandidates(loaded, config);
  assert.equal(guardedGeneration.profileComposition.status, "complete");
  assert.ok(guardedGeneration.profileComposition.decisions.some(
    (entry) => entry.guardEvaluations.length > 0
  ));
  assertSchema("package-candidate-enumeration-result", guardedGeneration);
  assertSchema(
    "package-profile-composition",
    guardedGeneration.profileComposition
  );
  const census = evaluatePackageCandidateCensus(loaded, config);
  const admission = admitPackageSelectors(loaded, config, census, []);
  const formations = materializePackageSelectedFormations(
    loaded,
    config,
    census,
    admission
  );
  const profiles = extractPackageDerivedProfiles(
    loaded,
    config,
    census,
    admission,
    formations
  );
  const population = materializePackageDerivedDepthPopulation(
    loaded,
    config,
    census,
    admission,
    formations,
    profiles
  );
  const level = closePackageLevel(loaded, config);

  assert.equal(profiles.results[0].guardEvaluations[0].outcome, "pass");
  assertSchema("package-derived-profiles", profiles);
  assert.deepEqual(population.elements[0].ontologyCoordinate, config.ontologyTarget);
  assertSchema("package-derived-depth-population", population);
  assert.deepEqual(level.ontologyCoordinate, config.ontologyTarget);
  assertSchema("package-level-closure", level);
  const tampered = structuredClone(profiles);
  tampered.results[0].guardEvaluations[0].memberOutcomes[0].outcome = "unknown";
  assertNotSchema("package-derived-profiles", tampered);
});

test("planned null-model streams conform to the published execution-plan schema", () => {
  const loaded = loadKernelPackage({
    schemaVersion: "1",
    id: "runtime-null-model-plan-fixture",
    version: "1.0.0",
    primitives: [primitive("runtime-null-model-source")]
  });
  const config = runConfig();
  config.nullModels = ["uniform", "role-shuffle", "degree-rewire"];
  config.budget.nullModelRuns = 2;
  const census = evaluatePackageCandidateCensus(loaded, config);
  const plan = createPackageNullModelPlan(loaded, config, census);
  const proposals = createPackageNullModelProposals(
    loaded,
    config,
    census,
    plan
  );
  const trialCensuses = evaluatePackageNullModelTrialCensuses(
    loaded,
    config,
    census,
    plan,
    proposals
  );
  const trialSelections = evaluatePackageNullModelTrialSelections(
    loaded,
    config,
    census,
    plan,
    proposals,
    trialCensuses
  );
  const admission = admitPackageSelectors(loaded, config, census, []);
  const baseline = evaluatePackageNullModelBaseline(
    loaded,
    config,
    census,
    admission,
    plan,
    proposals,
    trialCensuses,
    trialSelections
  );
  const level = closePackageLevel(loaded, config);

  assert.equal(plan.status, "planned");
  assert.equal(plan.trials.length, 6);
  assertSchema("package-null-model-plan", plan);
  assertSchema("package-null-model-proposals", proposals);
  assertSchema("package-null-model-trial-censuses", trialCensuses);
  assertSchema("package-null-model-trial-selections", trialSelections);
  assertSchema("package-null-model-baseline", baseline);
  assertSchema("package-level-closure", level);
  const invalidBaseline = structuredClone(baseline);
  invalidBaseline.models.uniform.metrics.booleanSelectivity.z = "infinite";
  assertNotSchema("package-null-model-baseline", invalidBaseline);
  const invalidTrialSelection = structuredClone(trialSelections);
  invalidTrialSelection.trials[0].selectedOccurrenceIds = ["not-a-hash"];
  assertNotSchema("package-null-model-trial-selections", invalidTrialSelection);
  const invalidTrialCensus = structuredClone(trialCensuses);
  invalidTrialCensus.trials[0].occurrenceEvaluations[0].occurrenceId =
    "not-a-hash";
  assertNotSchema("package-null-model-trial-censuses", invalidTrialCensus);
  const invalidProposal = structuredClone(proposals);
  invalidProposal.trials[0].occurrences[0].operation.kind = "unknown";
  assertNotSchema("package-null-model-proposals", invalidProposal);
  const invalidRequirement = structuredClone(plan);
  invalidRequirement.executionRequirements.pooling = "pool-everything";
  assertNotSchema("package-null-model-plan", invalidRequirement);
});
