import assert from "node:assert/strict";
import test from "node:test";
import { BASELINE_FEATURE_NAMES, GRAPH_BASELINE_PROFILE, graphBaselineFeatures } from "./baselines.mjs";

const graph = (nodes, arcs) => ({ nodes, edges: arcs.map(([source, target]) => ({ source, target })) });
const named = (result, source, target) => {
  const pair = result.pairs.find(row => row.source === source && row.target === target);
  assert.ok(pair, `Missing pair ${source} -> ${target}`);
  return Object.fromEntries(result.featureNames.map((feature, i) => [feature, pair.values[i]]));
};

test("path features have independently known distances, degrees and exact walk lengths", () => {
  const result = graphBaselineFeatures(graph(["a", "b", "c", "d"], [["a", "b"], ["b", "c"], ["c", "d"]]));
  assert.equal(result.profileId, GRAPH_BASELINE_PROFILE.id);
  assert.equal(result.pairs.length, 12);
  assert.equal(BASELINE_FEATURE_NAMES.length, 23);
  assert.deepEqual(result.pairs.find(pair => pair.source === "a" && pair.target === "d").values,
    [4, 3, 1 / 4, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  const backwards = named(result, "d", "a");
  assert.equal(backwards.same_weak_component, 1);
  assert.equal(backwards.same_strong_component, 0);
  assert.equal(backwards.directed_distance, 0);
  assert.equal(backwards.unreachable, 1);
  assert.equal(backwards.reachable, 0);
  assert.equal(named(result, "a", "c").propagation_step_2, 1);
  assert.equal(named(result, "a", "b").directed_distance, 1);
});

test("diamond paths split then recombine, without sink absorption or invented extra samples", () => {
  const result = graphBaselineFeatures(graph(["a", "b", "c", "d", "isolate"],
    [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]]));
  const cross = named(result, "b", "c"), end = named(result, "a", "d");
  assert.equal(result.pairs.length, 20);
  assert.equal(cross.common_predecessors, 1);
  assert.equal(cross.common_successors, 1);
  assert.equal(cross.two_step_path_count, 0);
  assert.equal(end.two_step_path_count, 2);
  assert.equal(end.directed_distance, 2);
  assert.equal(end.propagation_step_2, 1);
  assert.equal(end.propagation_step_3, 0);
  assert.equal(end.propagation_step_4, 0);
  assert.equal(end.feed_forward_shortcut_count, 0);
  assert.equal(named(result, "isolate", "a").same_weak_component, 0);
  assert.equal(named(result, "a", "isolate").unreachable, 1);
});

test("reciprocal edges form a strong component and exact walks may revisit nodes", () => {
  const result = graphBaselineFeatures(graph(["a", "b", "c"], [["a", "b"], ["b", "a"], ["b", "c"]]));
  const pair = named(result, "a", "b"), exit = named(result, "a", "c");
  assert.equal(pair.global_reciprocity, 2 / 3);
  assert.equal(pair.same_strong_component, 1);
  assert.equal(pair.direct_edge, 1);
  assert.equal(pair.reverse_edge, 1);
  assert.equal(pair.propagation_step_2, 0);
  assert.equal(pair.propagation_step_3, 1 / 2);
  assert.equal(pair.propagation_step_4, 0);
  assert.equal(exit.same_strong_component, 0);
  assert.equal(exit.propagation_step_2, 1 / 2);
  assert.equal(exit.propagation_step_3, 0);
  assert.equal(exit.propagation_step_4, 1 / 4);
});

test("pair motif roles are non-induced and do not discard reciprocal or shortcut arcs", () => {
  const result = graphBaselineFeatures(graph(["a", "b", "c"],
    [["a", "b"], ["b", "c"], ["c", "a"], ["a", "c"], ["b", "a"]]));
  assert.equal(named(result, "a", "c").feed_forward_shortcut_count, 1);
  assert.equal(named(result, "a", "b").directed_triangle_closure_count, 1);
  // b -> a has a two-step route b -> c -> a despite the direct reverse edge.
  assert.equal(named(result, "b", "a").feed_forward_shortcut_count, 1);
  // c -> b is not itself an arc, so its roles are zero even though a path exists.
  assert.equal(named(result, "c", "b").two_step_path_count, 1);
  assert.equal(named(result, "c", "b").feed_forward_shortcut_count, 0);
  assert.equal(named(result, "c", "b").directed_triangle_closure_count, 0);
});

test("propagation agrees with an independent exhaustive exact-walk enumeration", () => {
  const input = graph(["a", "b", "c", "d", "e"], [
    ["a", "b"], ["a", "c"], ["a", "d"], ["b", "c"], ["b", "e"],
    ["c", "a"], ["c", "d"], ["d", "b"]
  ]);
  const result = graphBaselineFeatures(input);
  // Enumerate paths explicitly and add rational masses; this reference does
  // not use the implementation's common-denominator matrix recurrence.
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const add = ([an, ad], [bn, bd]) => {
    const n = an * bd + bn * ad, d = ad * bd, g = gcd(n, d);
    return [n / g, d / g];
  };
  const successors = node => input.edges.filter(edge => edge.source === node).map(edge => edge.target);
  for (const pair of result.pairs) for (const steps of [2, 3, 4]) {
    let total = [0n, 1n];
    function visit(node, remaining, denominator) {
      if (!remaining) {
        if (node === pair.target) total = add(total, [1n, denominator]);
        return;
      }
      const next = successors(node);
      for (const target of next) visit(target, remaining - 1, denominator * BigInt(next.length));
    }
    visit(pair.source, steps, 1n);
    const actual = named(result, pair.source, pair.target)[`propagation_step_${steps}`];
    assert.ok(Math.abs(actual - Number(total[0]) / Number(total[1])) <= Number.EPSILON,
      `${pair.source}->${pair.target}, step ${steps}`);
  }
});

test("feature values are exactly equivariant under relabeling and independent of array order", () => {
  const input = graph(["a", "b", "c", "d", "e", "f"], [
    ["a", "b"], ["a", "c"], ["a", "d"], ["b", "c"], ["b", "e"],
    ["c", "a"], ["c", "d"], ["d", "b"], ["e", "a"], ["e", "f"]
  ]);
  const result = graphBaselineFeatures(input);
  assert.deepEqual(result, graphBaselineFeatures({ nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }));
  const rename = new Map(input.nodes.map((node, i) => [node, ["z", "3", "__proto__", "λ", "A:a", "a"][i]]));
  const changed = graphBaselineFeatures({ nodes: [...input.nodes].reverse().map(node => rename.get(node)),
    edges: [...input.edges].reverse().map(edge => ({ source: rename.get(edge.source), target: rename.get(edge.target) })) });
  for (const pair of result.pairs) {
    assert.deepEqual(named(result, pair.source, pair.target), named(changed, rename.get(pair.source), rename.get(pair.target)));
  }
});

test("isolates and edgeless graphs have finite explicit zero and unreachable coordinates", () => {
  const result = graphBaselineFeatures(graph(["a", "b", "c"], []));
  assert.equal(result.pairs.length, 6);
  for (const pair of result.pairs) {
    const values = named(result, pair.source, pair.target);
    assert.equal(values.global_reciprocity, 0);
    assert.equal(values.directed_density, 0);
    assert.equal(values.same_weak_component, 0);
    assert.equal(values.same_strong_component, 0);
    assert.equal(values.unreachable, 1);
    assert.equal(values.directed_distance, 0);
    assert.ok(pair.values.every(Number.isFinite));
  }
  assert.deepEqual(graphBaselineFeatures(graph(["only"], [])).pairs, []);
});

test("input remains unchanged and output contract is deeply immutable", () => {
  const input = graph(["b", "a"], [["a", "b"]]), before = structuredClone(input);
  Object.freeze(input.nodes); input.edges.forEach(Object.freeze); Object.freeze(input.edges); Object.freeze(input);
  const result = graphBaselineFeatures(input);
  assert.deepEqual(input, before);
  assert.throws(() => result.pairs[0].values.push(9), TypeError);
  assert.throws(() => result.pairs.push({}), TypeError);
  assert.throws(() => BASELINE_FEATURE_NAMES.push("unexpected"), TypeError);
  assert.throws(() => { GRAPH_BASELINE_PROFILE.propagation.matrix = "changed"; }, TypeError);
});

test("closed input rejects outcomes, weights, invalid identities and ambiguous edges", () => {
  const valid = graph(["a", "b"], [["a", "b"]]);
  const invalid = [null, [], {}, { ...valid, targets: [] }, graph([], []), graph(["a", "a"], []),
    graph(["", "b"], []), graph(["a", 1], []), graph(new Array(1), []),
    { nodes: ["a", "b"], edges: [null] }, graph(["a", "b"], [["a", "a"]]),
    graph(["a", "b"], [["a", "unknown"]]), graph(["a", "b"], [["a", "b"], ["a", "b"]]),
    { nodes: ["a", "b"], edges: [{ source: "a", target: "b", weight: 2 }] }];
  for (const input of invalid) assert.throws(() => graphBaselineFeatures(input),
    error => error.code === "BIOLOGICAL_BASELINE_INPUT_INVALID");
});

test("pair and work bounds reject complete oversized inputs before dense output allocation", () => {
  const atLimit = graph(Array.from({ length: 64 }, (_, i) => `n${i}`), []);
  const accepted = graphBaselineFeatures(atLimit);
  assert.equal(accepted.pairs.length, GRAPH_BASELINE_PROFILE.limits.maxOrderedPairs);
  assert.equal(accepted.pairs.length * accepted.featureNames.length, GRAPH_BASELINE_PROFILE.limits.maxFeatureValues);
  const fullWork = graph(atLimit.nodes, atLimit.nodes.flatMap((source, i) =>
    [1, 2, 3, 4].map(step => [source, atLimit.nodes[(i + step) % 64]])));
  assert.equal(fullWork.edges.length, 256);
  const fullAccepted = graphBaselineFeatures(fullWork);
  assert.equal(fullAccepted.pairs.length, 4032);
  assert.ok(fullAccepted.pairs.every(pair => pair.values.every(Number.isFinite)));
  const tooManyNodes = graph(Array.from({ length: 4096 }, (_, i) => `n${i}`), []);
  assert.throws(() => graphBaselineFeatures(tooManyNodes), error => error.code === "BIOLOGICAL_BASELINE_LIMIT_EXCEEDED");
  const denseNodes = Array.from({ length: 17 }, (_, i) => `n${i}`);
  const tooManyEdges = graph(denseNodes, denseNodes.flatMap(source => denseNodes
    .filter(target => target !== source).map(target => [source, target])));
  assert.equal(tooManyEdges.edges.length, 272);
  assert.throws(() => graphBaselineFeatures(tooManyEdges), error => error.code === "BIOLOGICAL_BASELINE_LIMIT_EXCEEDED");
  assert.equal(tooManyEdges.edges.length, 272);
});

test("closed graph domain rejects undeclared array and symbol fields instead of silently discarding them", () => {
  for (const key of ["extra", Symbol("undeclared")]) {
    const mutations = [
      input => { input[key] = true; },
      input => { input.nodes[key] = true; },
      input => { input.edges[key] = true; },
      input => { input.edges[0][key] = true; }
    ];
    for (const mutate of mutations) {
      const input = graph(["a", "b"], [["a", "b"]]); mutate(input);
      assert.throws(() => graphBaselineFeatures(input), error => error.code === "BIOLOGICAL_BASELINE_INPUT_INVALID");
    }
  }
  const sparse = graph(["a", "b"], [["a", "b"]]); delete sparse.edges[0];
  assert.throws(() => graphBaselineFeatures(sparse), error => error.code === "BIOLOGICAL_BASELINE_INPUT_INVALID");
});
