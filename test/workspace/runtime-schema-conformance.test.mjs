import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
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
