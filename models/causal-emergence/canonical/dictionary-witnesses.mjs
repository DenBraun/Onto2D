import assert from "node:assert/strict";

/** Exact small-integer/dyadic examples; no empirical or general solver claim. */
export function verifyDictionaryWitnesses() {
  const results = [];
  const record = (id, example, conclusion) => results.push({ id, example, conclusion, status: "checked-counterexample" });
  assert.equal((0.5) ** 10, 1 / 1024);
  assert.equal((-2) ** 10, 1024);
  record("feedback-sign", { positiveMultiplier: 0.5, negativeMultiplier: -2, steps: 10 },
    "For x[n+1]=g*x[n], positive g can decay and negative g can grow in magnitude. Sign alone does not decide stability.");
  assert.ok(Math.abs(0.5) < 1 && 0.5 > 0 && Math.abs(-2) > 1 && -2 < 0);
  record("time-domain", { multipliers: [0.5, -2] },
    "Solutions g^n*x[0] and exp(g*t)*x(0) have opposite stability classifications for these two g values. A discrete-time criterion cannot be used unchanged for continuous time.");
  const multiply = (a, b) => a.map((row) => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));
  const identity = [[1, 0], [0, 1]];
  const jordan = [[1, 1], [0, 1]];
  let power = identity;
  for (let n = 1; n <= 16; n += 1) {
    power = multiply(power, jordan);
    assert.deepEqual(power, [[1, n], [0, 1]]);
  }
  record("unit-circle-boundary", { identity, jordan, power16: power },
    "Both triangular matrices have eigenvalues 1,1. I^n is bounded; J^n has an off-diagonal n (by induction). Spectral radius one alone does not decide boundedness.");
  const x = 0, lambda = 0;
  assert.ok(x - 1 < 0 && lambda >= 0);
  assert.ok(lambda * (x - 1) === 0);
  assert.equal(2 * x + lambda, 0);
  assert.ok(x * x < 1 * 1);
  record("inactive-inequality", { objective: "x^2", constraint: "x-1 <= 0", x, lambda },
    "The global minimum is zero at x=0 with an inactive inequality. Replacing the inequality by equality forces x=1 and changes the answer.");
  assert.deepEqual([-1, -2, -4].map((v) => v ** 3), [-1, -8, -64]);
  record("cubic-sign", { coefficient: 1, values: [-1, -8, -64] },
    "V(x)=x^3 tends to minus infinity along x=-n. A positive cubic coefficient does not establish a lower bound or a stable cooperative state; a Lagrangian sign also needs a declared potential convention.");
  const adjacency = [[0, 1], [0, 0]];
  assert.notEqual(adjacency[0][1], adjacency[1][0]);
  record("horizontal-asymmetry", { levels: [1, 1], adjacency },
    "Two vertices can share a display level while having only one directed edge. Equal level does not impose reciprocal influence.");
  const crossLevel = [[0.25, 0.25], [0.25, 0.25]];
  assert.deepEqual(multiply(crossLevel, [[1], [1]]), [[0.5], [0.5]]);
  assert.deepEqual(multiply(crossLevel, [[1], [-1]]), [[0], [0]]);
  record("stable-cross-level-loop", { levels: [0, 1], matrix: crossLevel, eigenvalues: [0.5, 0] },
    "A bidirectional two-level discrete linear example has spectral radius 0.5. Cross-level feedback does not require spectral radius at least one.");
  const cycle = [["a", "b"], ["b", "c"], ["c", "a"]];
  const vertices = new Set(cycle.flat());
  assert.equal(vertices.size, 3);
  assert.ok(cycle.every((edge, i) => edge[1] === cycle[(i + 1) % cycle.length][0]));
  record("cycle-count-unit", { edges: cycle, vertexCount: 3, edgeCount: 3, simpleCyclesModuloRotation: 1 },
    "This isolated directed ring has one simple cycle modulo rotation, containing three vertices and three edges. Counting loops is different from counting their participants.");
  const weights = [0.5, 0.5];
  const and = (a, b) => Number(Boolean(a && b));
  const or = (a, b) => Number(Boolean(a || b));
  assert.equal(weights.reduce((a, b) => a + b), 1);
  assert.equal(and(1, 1), or(1, 1));
  assert.notEqual(and(0, 1), or(0, 1));
  record("normalized-weight-not-necessity", { weights, baseline: [1, 1], removeFirst: [0, 1], outcomes: { and: 0, or: 1 } },
    "The same normalized annotations can accompany AND or OR mechanisms. A removal has different outcomes, so normalization does not identify necessity or a causal effect.");
  const tokens = ["A", "A", "B"];
  assert.equal(tokens.length, 3);
  assert.equal(new Set(tokens).size, 2);
  record("token-individuation", { tokens, occurrences: 3, distinctSymbols: 2 },
    "Token occurrences and symbol types produce different counts for the same sequence. A dimensionless number still needs a quantity kind and individuation rule.");
  return { cases: results, limit: "These exact finite witnesses accompany explicit algebraic arguments. They refute specified universal shortcuts; they do not validate a physical model or classify every possible system." };
}
