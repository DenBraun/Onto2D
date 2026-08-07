import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelValidationError,
  analyzePredicateExpression,
  compilePredicate,
  loadKernelPackage
} from "../src/index.js";

function quantity(value, unit, semantic) {
  return {
    value,
    unit,
    tolerance: { absolute: 0 },
    semantic,
    provenance: { kind: "declared", evidence: [] }
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

function rulePackage(predicates, perturbations = []) {
  return {
    schemaVersion: "1",
    id: "predicate-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "base",
      kind: "primitive",
      typeTags: [],
      invariants: { length: quantity(1, "m", "length") },
      profile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }],
    predicates,
    perturbations
  };
}

test("predicate analysis proves persistent upper-bound and forbidden-cycle violations", () => {
  const expression = {
    op: "all",
    args: [
      { op: "countRole", role: "support", max: 2 },
      {
        op: "not",
        arg: {
          op: "cycleExists",
          roles: ["support", "bridge"],
          projection: "undirected-simple",
          minLength: 3
        }
      }
    ]
  };
  const analysis = analyzePredicateExpression(expression);

  assert.equal(analysis.result, "predicate-outcome");
  assert.equal(analysis.truthPersistence.fail, "proven");
  assert.equal(analysis.truthPersistence.pass, "not-proven");
  assert.deepEqual(analysis.requirements.roles, ["bridge", "support"]);
  assert.deepEqual(analysis.requirements.graphProjections, ["undirected-simple"]);
  assert.ok(analysis.requirements.witnessKinds.includes("cycle"));
  assert.match(analysis.analysisHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(analysis));
});

test("commutative Boolean argument order does not change expression identity", () => {
  const first = analyzePredicateExpression({
    op: "all",
    args: [{ op: "connected" }, { op: "countRole", role: "x", max: 1 }]
  });
  const second = analyzePredicateExpression({
    op: "all",
    args: [{ op: "countRole", role: "x", max: 1 }, { op: "connected" }]
  });

  assert.equal(first.expressionHash, second.expressionHash);
  assert.equal(first.analysisHash, second.analysisHash);
});

test("predicate plans distinguish static pruning proof, blocked claims, and opt-out", () => {
  const proven = compilePredicate(predicate(
    "upper-bound",
    { op: "countRole", role: "support", max: 2 },
    true
  ));
  const audit = compilePredicate(predicate(
    "range",
    { op: "countRole", role: "support", min: 1, max: 2 },
    true
  ));
  const disabled = compilePredicate(predicate(
    "disabled",
    { op: "countRole", role: "support", max: 2 },
    false
  ));
  const canonicalDegree = compilePredicate(predicate(
    "canonical-degree",
    {
      op: "degree",
      node: { kind: "canonical-index", index: 0 },
      max: 2
    },
    true
  ));

  assert.equal(proven.pruning.eligibility, "static-proven");
  assert.equal(audit.pruning.eligibility, "blocked-unproven");
  assert.equal(audit.pruning.auditRequired, true);
  assert.equal(disabled.pruning.eligibility, "disabled");
  assert.equal(canonicalDegree.pruning.eligibility, "blocked-unproven");
  assert.equal(canonicalDegree.pruning.partialFailureDetectable, false);
  assert.match(proven.planHash, /^sha256:[a-f0-9]{64}$/);
});

test("partial persistence does not depend on unstable canonical selectors", () => {
  const canonicalPath = analyzePredicateExpression({
    op: "pathExists",
    from: { kind: "canonical-index", index: 0 },
    to: { kind: "canonical-index", index: 1 }
  });
  const selectedPath = analyzePredicateExpression({
    op: "pathExists",
    from: { kind: "where", attribute: "source", equals: true },
    to: { kind: "where", attribute: "target", equals: true }
  });
  const growingDegreeSelection = analyzePredicateExpression({
    op: "degree",
    node: { kind: "all" },
    min: 1
  });

  assert.equal(canonicalPath.truthPersistence.pass, "not-proven");
  assert.equal(canonicalPath.partialDetectability.pass, false);
  assert.equal(selectedPath.truthPersistence.pass, "proven");
  assert.equal(selectedPath.partialDetectability.pass, true);
  assert.equal(growingDegreeSelection.truthPersistence.pass, "not-proven");
});

test("compare expressions enforce dimensions and collect invariant dependencies", () => {
  const analysis = analyzePredicateExpression({
    op: "compare",
    left: { kind: "invariant", name: "length" },
    comparator: "lte",
    right: { kind: "constant", value: quantity(100, "cm", "length") }
  }, {
    environment: { invariants: { length: quantity(1, "m", "length") } }
  });

  assert.deepEqual(analysis.requirements.invariants, ["length"]);
  assert.equal(analysis.requirements.valueExpressionHashes.length, 2);
  assert.equal(analysis.symbols.invariants.length.unit, "m");

  assert.throws(
    () => analyzePredicateExpression({
      op: "compare",
      left: { kind: "constant", value: quantity(1, "m", "length") },
      comparator: "eq",
      right: { kind: "constant", value: quantity(1, "kg", "mass") }
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_COMPARE_UNIT_INCOMPATIBLE")
  );

  assert.throws(
    () => analyzePredicateExpression({
      op: "compare",
      left: { kind: "constant", value: "a" },
      comparator: "lt",
      right: { kind: "constant", value: "b" }
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_SCALAR_ORDERING_FORBIDDEN")
  );

  assert.throws(
    () => analyzePredicateExpression({
      op: "compare",
      left: { kind: "coefficient", name: "forbidden" },
      comparator: "eq",
      right: { kind: "constant", value: 0 }
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_COEFFICIENT_FORBIDDEN")
  );

  assert.throws(
    () => analyzePredicateExpression({
      op: "compare",
      left: { kind: "constant", value: "long" },
      comparator: "eq",
      right: { kind: "constant", value: "long" }
    }, { limits: { maxStringLength: 3 } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_EXPRESSION_CONSTANT_INVALID")
  );
});

test("balance infers an attribute dimension from its explicit tolerance", () => {
  const analysis = analyzePredicateExpression({
    op: "balance",
    attribute: "momentum",
    over: { kind: "edges", roles: ["out", "in"] },
    tolerance: quantity(0.01, "kg*m*s^-1", "momentum balance tolerance")
  });

  assert.deepEqual(analysis.requirements.attributes, ["momentum"]);
  assert.deepEqual(analysis.requirements.roles, ["in", "out"]);
  assert.equal(analysis.symbols.attributes.momentum.unit, "kg*m*s^-1");

  assert.throws(
    () => analyzePredicateExpression({
      op: "balance",
      attribute: "momentum",
      over: { kind: "edges", roles: [""] },
      tolerance: quantity(0.01, "kg*m*s^-1", "momentum balance tolerance")
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.path === "$.over.roles[0]")
  );

  assert.throws(
    () => analyzePredicateExpression({
      op: "degree",
      node: { kind: "canonical-index", index: -1 },
      max: 1
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.path === "$.node.index")
  );

  assert.throws(
    () => analyzePredicateExpression({
      op: "balance",
      attribute: "x",
      over: { kind: "edges" },
      tolerance: quantity(0.1, "1", "semantic-too-long")
    }, { limits: { maxStringLength: 8 } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_STRING_LIMIT")
  );
});

test("substructure combinators validate perturbation references and nesting", () => {
  const analysis = analyzePredicateExpression({
    op: "stableUnder",
    perturbation: "edge-drop",
    predicate: { op: "connected" },
    threshold: 0.9
  }, {
    environment: { perturbations: ["edge-drop"] }
  });
  assert.deepEqual(analysis.requirements.perturbations, ["edge-drop"]);
  assert.ok(analysis.requirements.witnessKinds.includes("perturbation"));

  assert.throws(
    () => analyzePredicateExpression({
      op: "stableUnder",
      perturbation: "missing",
      predicate: { op: "connected" },
      threshold: 1
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_PERTURBATION_UNDECLARED")
  );

  assert.throws(
    () => analyzePredicateExpression({
      op: "minimal",
      predicate: { op: "minimal", predicate: { op: "connected" } }
    }, { limits: { maxSubstructureNesting: 1 } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_SUBSTRUCTURE_NESTING_LIMIT")
  );

  assert.throws(
    () => analyzePredicateExpression({ op: "connected" }, { environment: null }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_ENVIRONMENT_INVALID")
  );
});

test("package loading emits sorted compiled predicate plans and normalized expressions", () => {
  const source = rulePackage([
    predicate("z-stability", {
      op: "stableUnder",
      perturbation: "edge-drop",
      predicate: { op: "connected" },
      threshold: 1
    }),
    predicate("a-upper", { op: "countRole", role: "support", max: 2 }, true)
  ], [{ id: "edge-drop", kind: "edge-deletion" }]);

  const loaded = loadKernelPackage(source);
  assert.deepEqual(loaded.predicatePlans.map((plan) => plan.predicateId), ["a-upper", "z-stability"]);
  assert.equal(loaded.predicatePlans[0].pruning.eligibility, "static-proven");
  assert.equal(loaded.normalized.predicates[0].id, "a-upper");

  source.predicates[0].expr.perturbation = "missing";
  assert.throws(
    () => loadKernelPackage(source),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "PREDICATE_TYPE_PERTURBATION_UNDECLARED")
  );
});
