import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  compilePredicate,
  detectPartialGraphPredicateFailure,
  evaluateGraphPredicatePlan
} from "../src/index.js";

const REF_A = `sha256:${"a".repeat(64)}`;
const REF_B = `sha256:${"b".repeat(64)}`;
const REF_C = `sha256:${"c".repeat(64)}`;

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

function triangle() {
  return {
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" },
      { from: 2, to: 0, role: "support" }
    ]
  };
}

function partial(candidate, nodesComplete = true) {
  return { ...candidate, nodesComplete };
}

test("complete graph predicates return deterministic aggregate and atomic witnesses", () => {
  const plan = compilePredicate(predicate("triangle", {
    op: "all",
    args: [
      { op: "countRole", role: "support", min: 3, max: 3 },
      {
        op: "cycleExists",
        roles: ["support"],
        projection: "undirected-simple",
        minLength: 3,
        maxLength: 3
      },
      { op: "degree", node: { kind: "all" }, role: "support", min: 2, max: 2 }
    ]
  }));

  const evaluation = evaluateGraphPredicatePlan(plan, triangle());
  assert.equal(evaluation.outcome, "pass");
  assert.equal(evaluation.predicatePlanHash, plan.planHash);
  assert.equal(evaluation.witnesses.length, 5);
  assert.deepEqual(
    evaluation.witnesses.filter((entry) => entry.operator === "degree").map((entry) => entry.count),
    [2, 2, 2]
  );
  assert.match(evaluation.candidateId, /^sha256:[a-f0-9]{64}$/);
  assert.match(evaluation.evaluationHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(evaluation));
  assert.ok(Object.isFrozen(evaluation.witnesses));
});

test("candidate relabelling and edge order do not change an evaluation artifact", () => {
  const plan = compilePredicate(predicate("path", {
    op: "pathExists",
    from: { kind: "canonical-index", index: 0 },
    to: { kind: "canonical-index", index: 2 },
    roles: ["support"]
  }));
  const candidate = triangle();
  const permutation = [2, 0, 1];
  const oldToNew = [1, 2, 0];
  const relabelled = {
    domain: candidate.domain,
    nodes: permutation.map((index) => candidate.nodes[index]),
    edges: [...candidate.edges].reverse().map((edge) => ({
      ...edge,
      from: oldToNew[edge.from],
      to: oldToNew[edge.to]
    }))
  };

  const first = evaluateGraphPredicatePlan(plan, candidate);
  const second = evaluateGraphPredicatePlan(plan, relabelled);
  assert.equal(first.candidateId, second.candidateId);
  assert.equal(first.evaluationHash, second.evaluationHash);
  assert.deepEqual(first.witnesses, second.witnesses);
});

test("directed reciprocal dyads are cycles but not undirected-simple cycles", () => {
  const candidate = {
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }],
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 0, role: "support" }
    ]
  };
  const options = { policy: { allowParallelEdges: true } };
  const directed = compilePredicate(predicate("directed-dyad", {
    op: "cycleExists",
    projection: "directed",
    minLength: 2,
    maxLength: 2
  }));
  const simple = compilePredicate(predicate("simple-triad", {
    op: "cycleExists",
    projection: "undirected-simple",
    minLength: 3
  }));

  assert.equal(evaluateGraphPredicatePlan(directed, candidate, options).outcome, "pass");
  assert.equal(evaluateGraphPredicatePlan(simple, candidate, options).outcome, "fail");
});

test("loops and parallel two-cycles follow the declared projection", () => {
  const loop = {
    domain: "element-exact",
    nodes: [{ ref: REF_A }],
    edges: [{ from: 0, to: 0, role: "support" }]
  };
  const directedLoop = compilePredicate(predicate("directed-loop", {
    op: "cycleExists",
    projection: "directed",
    minLength: 1,
    maxLength: 1
  }));
  const multigraphLoop = compilePredicate(predicate("multigraph-loop", {
    op: "cycleExists",
    projection: "undirected-multigraph",
    minLength: 1,
    maxLength: 1
  }));
  const simpleLoop = compilePredicate(predicate("simple-loop", {
    op: "cycleExists",
    projection: "undirected-simple"
  }));
  const degree = compilePredicate(predicate("loop-degree", {
    op: "degree",
    node: { kind: "all" },
    min: 1,
    max: 1
  }));
  const loopOptions = { policy: { allowSelfLoops: true } };
  assert.equal(evaluateGraphPredicatePlan(directedLoop, loop, loopOptions).outcome, "pass");
  assert.equal(evaluateGraphPredicatePlan(multigraphLoop, loop, loopOptions).outcome, "pass");
  assert.equal(evaluateGraphPredicatePlan(simpleLoop, loop, loopOptions).outcome, "fail");
  assert.equal(evaluateGraphPredicatePlan(degree, loop, loopOptions).outcome, "pass");

  const parallel = {
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }],
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 0, to: 1, role: "support" }
    ]
  };
  const twoCycle = compilePredicate(predicate("parallel-two-cycle", {
    op: "cycleExists",
    projection: "undirected-multigraph",
    minLength: 2,
    maxLength: 2
  }));
  assert.equal(evaluateGraphPredicatePlan(twoCycle, parallel, {
    policy: { allowParallelEdges: true }
  }).outcome, "pass");
});

test("graph evaluation witnesses cover edge budgets above the default canonicalization limit", () => {
  const plan = compilePredicate(predicate("sixty-five-edges", {
    op: "countRole",
    role: "support",
    min: 65,
    max: 65
  }));
  const candidate = {
    domain: "element-exact",
    nodes: [{ ref: REF_A }],
    edges: Array.from(
      { length: 65 },
      () => ({ from: 0, to: 0, role: "support" })
    )
  };
  const evaluation = evaluateGraphPredicatePlan(plan, candidate, {
    policy: { allowParallelEdges: true, allowSelfLoops: true },
    limits: { maxEdges: 65 }
  });

  assert.equal(evaluation.outcome, "pass");
  assert.equal(evaluation.witnesses[0].count, 65);
  assert.equal(evaluation.witnesses[0].edgeIndexes.length, 65);
});

test("all 512 directed three-node edge subsets reconcile cycle projections", () => {
  const plans = {
    directed: compilePredicate(predicate("all-directed-cycles", {
      op: "cycleExists",
      projection: "directed"
    })),
    simple: compilePredicate(predicate("all-simple-cycles", {
      op: "cycleExists",
      projection: "undirected-simple"
    })),
    multigraph: compilePredicate(predicate("all-multigraph-cycles", {
      op: "cycleExists",
      projection: "undirected-multigraph"
    }))
  };
  const possibleEdges = [];
  for (let from = 0; from < 3; from += 1) {
    for (let to = 0; to < 3; to += 1) possibleEdges.push([from, to]);
  }
  const hasEdge = (selected, from, to) => selected.has(`${from}:${to}`);
  const pairs = [[0, 1], [0, 2], [1, 2]];
  const options = {
    policy: { connected: false, allowParallelEdges: true, allowSelfLoops: true }
  };

  for (let mask = 0; mask < 2 ** possibleEdges.length; mask += 1) {
    const selected = new Set();
    const edges = [];
    possibleEdges.forEach(([from, to], index) => {
      if ((mask & (1 << index)) === 0) return;
      selected.add(`${from}:${to}`);
      edges.push({ from, to, role: "support" });
    });
    const hasLoop = [0, 1, 2].some((node) => hasEdge(selected, node, node));
    const hasReciprocal = pairs.some(([left, right]) =>
      hasEdge(selected, left, right) && hasEdge(selected, right, left)
    );
    const hasTriangle = pairs.every(([left, right]) =>
      hasEdge(selected, left, right) || hasEdge(selected, right, left)
    );
    const hasDirectedTriangle = (
      hasEdge(selected, 0, 1) &&
      hasEdge(selected, 1, 2) &&
      hasEdge(selected, 2, 0)
    ) || (
      hasEdge(selected, 0, 2) &&
      hasEdge(selected, 2, 1) &&
      hasEdge(selected, 1, 0)
    );
    const candidate = {
      domain: "element-exact",
      nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
      edges
    };
    const expected = {
      directed: hasLoop || hasReciprocal || hasDirectedTriangle,
      simple: hasTriangle,
      multigraph: hasLoop || hasReciprocal || hasTriangle
    };
    for (const projection of Object.keys(plans)) {
      const result = evaluateGraphPredicatePlan(plans[projection], candidate, options);
      assert.equal(result.outcome, expected[projection] ? "pass" : "fail", `${projection}:${mask}`);
    }
  }
});

test("logical graph evaluation preserves three-valued truth tables", () => {
  const missing = {
    op: "degree",
    node: { kind: "canonical-index", index: 5 },
    min: 1
  };
  const passing = { op: "countRole", role: "support", min: 3 };
  const failing = { op: "countRole", role: "support", max: 2 };
  const outcome = (id, expr) => evaluateGraphPredicatePlan(
    compilePredicate(predicate(id, expr)),
    triangle()
  ).outcome;

  assert.equal(outcome("all-fail", { op: "all", args: [missing, failing] }), "fail");
  assert.equal(outcome("any-pass", { op: "any", args: [missing, passing] }), "pass");
  assert.equal(outcome("any-unknown", { op: "any", args: [missing, failing] }), "indeterminate");
  assert.equal(outcome("not-unknown", { op: "not", arg: missing }), "indeterminate");
});

test("attribute selectors, zero-length paths, and empty degree selections are explicit", () => {
  const candidate = {
    domain: "element-exact",
    nodes: [
      { ref: REF_A, attrs: { marker: "origin" } },
      { ref: REF_B, attrs: { marker: "middle" } },
      { ref: REF_C, attrs: { marker: "target" } }
    ],
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" }
    ]
  };
  const options = { policy: { structuralNodeAttributes: ["marker"] } };
  const path = compilePredicate(predicate("selected-path", {
    op: "pathExists",
    from: { kind: "where", attribute: "marker", equals: "origin" },
    to: { kind: "where", attribute: "marker", equals: "target" },
    roles: ["support"]
  }));
  const trivialPath = compilePredicate(predicate("trivial-path", {
    op: "pathExists",
    from: { kind: "where", attribute: "marker", equals: "origin" },
    to: { kind: "where", attribute: "marker", equals: "origin" }
  }));
  const emptyDegree = compilePredicate(predicate("empty-degree", {
    op: "degree",
    node: { kind: "where", attribute: "marker", equals: "missing" },
    min: 1
  }));

  assert.equal(evaluateGraphPredicatePlan(path, candidate, options).outcome, "pass");
  const trivial = evaluateGraphPredicatePlan(trivialPath, candidate, options);
  assert.equal(trivial.outcome, "pass");
  assert.deepEqual(trivial.witnesses[0].edgeIndexes, []);
  const empty = evaluateGraphPredicatePlan(emptyDegree, candidate, options);
  assert.equal(empty.outcome, "indeterminate");
  assert.equal(empty.witnesses[0].reason, "selector-empty");
});

test("component predicates use the declared weak or strong connectivity projection", () => {
  const candidate = {
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  const components = compilePredicate(predicate("two-components", {
    op: "componentCount",
    count: 2
  }));
  const connected = compilePredicate(predicate("connected", { op: "connected" }));
  const weakOptions = { policy: { connected: false, connectivityProjection: "directed-weak" } };
  assert.equal(evaluateGraphPredicatePlan(components, candidate, weakOptions).outcome, "pass");
  const weak = evaluateGraphPredicatePlan(connected, candidate, weakOptions);
  assert.equal(weak.outcome, "fail");
  assert.equal(weak.witnesses[0].count, 2);

  const oneWay = {
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }],
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  assert.equal(evaluateGraphPredicatePlan(connected, oneWay, {
    policy: { connectivityProjection: "directed-strong", connected: false }
  }).outcome, "fail");
});

test("numeric and substructure operators are rejected at the graph boundary", () => {
  const plan = compilePredicate(predicate("numeric", {
    op: "compare",
    left: { kind: "constant", value: 1 },
    comparator: "eq",
    right: { kind: "constant", value: 1 }
  }));
  assert.throws(
    () => evaluateGraphPredicatePlan(plan, triangle()),
    (error) => error instanceof KernelError &&
      error.code === "PREDICATE_GRAPH_OPERATOR_UNSUPPORTED"
  );
});

test("partial upper bounds and forbidden cycles detect persistent failure without authorizing pruning", () => {
  const upper = compilePredicate(predicate(
    "upper",
    { op: "countRole", role: "support", max: 2 },
    true
  ));
  const forbiddenCycle = compilePredicate(predicate("acyclic", {
    op: "not",
    arg: {
      op: "cycleExists",
      roles: ["support"],
      projection: "undirected-simple",
      minLength: 3
    }
  }, true));
  const upperDegree = compilePredicate(predicate(
    "upper-degree",
    { op: "degree", node: { kind: "all" }, max: 1 },
    true
  ));

  for (const plan of [upper, upperDegree, forbiddenCycle]) {
    const result = detectPartialGraphPredicateFailure(plan, partial(triangle()));
    assert.equal(result.detection, "persistent-failure");
    assert.equal(result.outcome, "fail");
    assert.equal(result.persistentFailureDetected, true);
    assert.equal(result.pruningEligibility, "static-proven");
    assert.equal(result.auditRequired, true);
    assert.equal(result.pruningAuthorized, false);
    assert.match(result.partialGraphHash, /^sha256:[a-f0-9]{64}$/);
    assert.match(result.evaluationHash, /^sha256:[a-f0-9]{64}$/);
  }
});

test("absence of a partial cycle remains indeterminate", () => {
  const plan = compilePredicate(predicate("acyclic", {
    op: "not",
    arg: { op: "cycleExists", projection: "undirected-simple", minLength: 3 }
  }, true));
  const candidate = {
    domain: "profile-quotient",
    nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
    edges: [
      { from: 0, to: 1, role: "support" },
      { from: 1, to: 2, role: "support" }
    ]
  };
  const result = detectPartialGraphPredicateFailure(plan, partial(candidate));
  assert.equal(result.detection, "not-detected");
  assert.equal(result.outcome, "indeterminate");
  assert.equal(result.persistentFailureDetected, false);
  assert.equal(result.pruningAuthorized, false);
});

test("a stable selected partial path can witness a persistent forbidden-path failure", () => {
  const plan = compilePredicate(predicate("forbidden-path", {
    op: "not",
    arg: {
      op: "pathExists",
      from: { kind: "where", attribute: "marker", equals: "source" },
      to: { kind: "where", attribute: "marker", equals: "target" },
      roles: ["support"]
    }
  }, true));
  const graph = {
    domain: "element-exact",
    nodes: [
      { ref: REF_A, attrs: { marker: "source" } },
      { ref: REF_B, attrs: { marker: "target" } }
    ],
    edges: [{ from: 0, to: 1, role: "support" }]
  };
  const result = detectPartialGraphPredicateFailure(plan, partial(graph));
  assert.equal(result.detection, "persistent-failure");
  assert.equal(result.outcome, "fail");
  assert.equal(result.pruningAuthorized, false);
  assert.deepEqual(result.witnesses[0].edgeIndexes, [0]);
});

test("node-population closure cannot lift a statically unproven degree plan", () => {
  const plan = compilePredicate(predicate("not-covered", {
    op: "not",
    arg: {
      op: "degree",
      node: { kind: "where", attribute: "active", equals: true },
      min: 1
    }
  }, true));
  const graph = {
    domain: "element-exact",
    nodes: [
      { ref: REF_A, attrs: { active: true } },
      { ref: REF_B, attrs: { active: false } }
    ],
    edges: [{ from: 0, to: 1, role: "support" }]
  };

  const open = detectPartialGraphPredicateFailure(plan, partial(graph, false));
  const closed = detectPartialGraphPredicateFailure(plan, partial(graph, true));
  assert.equal(open.detection, "blocked-plan");
  assert.equal(open.outcome, "indeterminate");
  assert.equal(closed.detection, "blocked-plan");
  assert.equal(closed.outcome, "indeterminate");
  assert.notEqual(open.partialGraphHash, closed.partialGraphHash);
  assert.equal(open.pruningAuthorized, false);
  assert.equal(closed.pruningAuthorized, false);
});

test("unproven plans stay blocked and compiled-plan tampering is rejected", () => {
  const blocked = compilePredicate(predicate(
    "range",
    { op: "countRole", role: "support", min: 1, max: 2 },
    true
  ));
  const result = detectPartialGraphPredicateFailure(blocked, partial(triangle()));
  assert.equal(result.detection, "blocked-plan");
  assert.equal(result.reason, "plan-not-static-proven");
  assert.equal(result.pruningAuthorized, false);

  const tampered = structuredClone(blocked);
  tampered.expression.role = "other";
  assert.throws(
    () => evaluateGraphPredicatePlan(tampered, triangle()),
    (error) => error instanceof KernelError && error.code === "PREDICATE_PLAN_HASH_MISMATCH"
  );
});
