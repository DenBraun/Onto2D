import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeCandidate } from "../../packages/kernel/src/index.js";
import { graphSvg } from "../../apps/canonical-identity-lab/graph-view.js";
import {
  ANONYMOUS_NODE_REF,
  IDENTITY_SCENARIOS,
  NODE_PERMUTATIONS,
  TRIANGLE_SKELETON_ID,
  inputView
} from "../../apps/canonical-identity-lab/model.js";

function candidate(edges) {
  return canonicalizeCandidate({
    domain: "single-candidate",
    nodes: Array.from({ length: 3 }, () => ({ ref: ANONYMOUS_NODE_REF })),
    edges
  });
}

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) => permutations(values.filter((_, inner) => inner !== index)).map((tail) => [value, ...tail]));
}

test("all three displayed scenario identities replay through the kernel", () => {
  for (const scenario of Object.values(IDENTITY_SCENARIOS)) {
    const canonical = candidate(scenario.edges);
    assert.equal(canonical.candidateId, scenario.candidateId, scenario.id);
    assert.equal(canonical.skeletonId, TRIANGLE_SKELETON_ID, `${scenario.id} skeleton`);
    assert.deepEqual(canonical.canonical.edges, scenario.canonicalEdges, `${scenario.id} canonical edges`);
  }
  assert.notEqual(IDENTITY_SCENARIOS.base.candidateId, IDENTITY_SCENARIOS.reverse.candidateId);
  assert.notEqual(IDENTITY_SCENARIOS.base.candidateId, IDENTITY_SCENARIOS.role.candidateId);
});

test("all 36 node-order and edge-order representations retain the baseline ID", () => {
  const edgeOrders = permutations([0, 1, 2]);
  let checked = 0;
  for (let permutationIndex = 0; permutationIndex < NODE_PERMUTATIONS.length; permutationIndex += 1) {
    const view = inputView("base", permutationIndex, false);
    for (const edgeOrder of edgeOrders) {
      const edges = edgeOrder.map((index) => view.edges[index]);
      const canonical = candidate(edges);
      assert.equal(canonical.candidateId, IDENTITY_SCENARIOS.base.candidateId);
      assert.equal(canonical.skeletonId, TRIANGLE_SKELETON_ID);
      checked += 1;
    }
  }
  assert.equal(checked, 36);
});

test("identity input views fail closed on unknown scenarios and permutations", () => {
  assert.throws(() => inputView("missing", 0), /Unknown identity scenario/);
  assert.throws(() => inputView("base", 6), /Permutation index/);
});

test("all displayed graph views keep three SVG nodes and exact directed edges", () => {
  let checked = 0;
  for (const scenario of Object.values(IDENTITY_SCENARIOS)) {
    for (let permutationIndex = 0; permutationIndex < NODE_PERMUTATIONS.length; permutationIndex += 1) {
      for (const reverseEdgeOrder of [false, true]) {
        const view = inputView(scenario.id, permutationIndex, reverseEdgeOrder);
        const markup = graphSvg(view);
        const nodes = [...markup.matchAll(/<g class="graph-node" data-node-index="(\d+)" data-label="([^"]+)"><circle cx="(\d+)" cy="(\d+)" r="20"><\/circle><text x="(\d+)" y="(\d+)">/g)]
          .map((match) => ({
            index: Number(match[1]),
            label: match[2],
            x: Number(match[3]),
            y: Number(match[4]),
            textX: Number(match[5]),
            textY: Number(match[6])
          }));
        const edges = [...markup.matchAll(/<path class="([^"]+)" data-edge-index="(\d+)" data-from="(\d+)" data-to="(\d+)" data-role="([^"]+)" d="([^"]+)" marker-end="url\(#([^)]+)\)">/g)]
          .map((match) => ({
            className: match[1],
            index: Number(match[2]),
            from: Number(match[3]),
            to: Number(match[4]),
            role: match[5],
            path: match[6],
            marker: match[7]
          }));

        assert.equal(nodes.length, 3);
        assert.deepEqual(nodes.map((node) => node.index), [0, 1, 2]);
        assert.deepEqual(nodes.map((node) => node.label), view.labels);
        assert.equal(new Set(nodes.map((node) => `${node.x}:${node.y}`)).size, 3);
        for (const node of nodes) {
          assert.equal(node.textX, node.x);
          assert.equal(node.textY, node.y + 5);
          assert.ok(node.x >= 20 && node.x <= 280);
          assert.ok(node.y >= 20 && node.y <= 240);
        }
        assert.doesNotMatch(markup, /class="graph-node"[^>]*\btransform=/);
        assert.equal(edges.length, 3);
        assert.deepEqual(
          edges.map(({ index, from, to, role }) => ({ index, from, to, role })),
          view.edges.map((edge, index) => ({ index, ...edge }))
        );
        for (const edge of edges) {
          assert.doesNotMatch(edge.path, /NaN|Infinity/);
          assert.equal(edge.className.includes("role-edge"), edge.role === "inhibits");
          assert.equal(edge.marker, edge.role === "inhibits" ? "identity-role-arrow" : "identity-arrow");
        }
        assert.doesNotMatch(markup, /<small/i);
        assert.match(markup, /<title id="identity-graph-title">/);
        assert.match(markup, /<desc id="identity-graph-description">/);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 36);
});

test("the graph renderer rejects malformed views and escapes display labels", () => {
  assert.throws(() => graphSvg({}), /exactly three labels/);
  const view = inputView("base", 0, false);
  const escaped = graphSvg({ ...view, labels: ["<a>", "b&b", 'c"c'] });
  assert.match(escaped, /&lt;a&gt;/);
  assert.match(escaped, /b&amp;b/);
  assert.match(escaped, /c&quot;c/);
});
