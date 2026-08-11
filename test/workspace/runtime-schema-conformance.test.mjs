import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  accumulateDecimals,
  bindPredicateNumericPolicy,
  compilePredicate,
  createPackageCandidateBinding,
  detectPartialGraphPredicateFailure,
  enumerateConnectedSkeletons,
  enumerateDecoratedCandidates,
  enumeratePackageCandidates,
  evaluateGraphPredicatePlan,
  evaluateLocalPredicatePlan,
  evaluatePackageCandidateFilter,
  loadKernelPackage,
  materializePrimitiveDepthPopulation,
  normalizeRunConfig
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

function primitive() {
  return {
    sourceId: "schema-fixture-source",
    kind: "primitive",
    typeTags: ["fixture"],
    invariants: {},
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
    primitives: [primitive()],
    predicates: [graphPredicate, numericPredicate]
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

  assertSchema("run-config", normalizedConfig);
  assertSchema("skeleton-enumeration-result", skeletons);
  assertSchema("candidate-enumeration-input", enumerationInput);
  assertSchema("candidate-enumeration-result", enumeration);
  assertSchema("primitive-depth-population", population);
  population.elements.forEach((element) => assertSchema("element", element));
  assertSchema("package-candidate-binding", binding);
  assertSchema("package-candidate-enumeration-result", packageEnumeration);
  assertSchema("predicate-graph-evaluation", graphEvaluation);
  assertSchema("predicate-local-evaluation", localEvaluation);
  assertSchema("partial-predicate-graph-evaluation", partialEvaluation);
  assertSchema("package-candidate-filter-evaluation", filterEvaluation);
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
});
