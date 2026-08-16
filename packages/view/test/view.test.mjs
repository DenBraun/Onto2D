import assert from "node:assert/strict";
import test from "node:test";
import {
  ModelView,
  ViewError,
  createModelView,
  layoutNeighborhood
} from "../src/index.js";

const nodes = [
  { id: "d", name: "Delta", level: 2, phase: "C", typeRole: "Effect", scientificStatus: "speculative" },
  { id: "a", name: "Alpha", level: 0, phase: "A", typeRole: "Pattern", scientificStatus: "established" },
  { id: "c", name: "Gamma", level: 1, phase: "B", typeRole: "Object", scientificStatus: "hypothesized" },
  { id: "b", name: "Beta field", level: 1, phase: "B", typeRole: "Process", scientificStatus: "well-supported" }
];
const edges = [
  { id: "c-d", source: "c", target: "d", relationLayer: "source-parent" },
  { id: "b-c", source: "b", target: "c", relationLayer: "source-parent" },
  { id: "a-c", source: "a", target: "c", relationLayer: "source-parent" },
  { id: "a-b", source: "a", target: "b", relationLayer: "source-parent" }
];

test("ModelView validates and freezes a deterministic catalogue projection", () => {
  const view = createModelView({ nodes, edges });
  assert.ok(view instanceof ModelView);
  assert.deepEqual(view.statistics, { nodeCount: 4, edgeCount: 4 });
  assert.deepEqual(view.facets.levels, [
    { value: 0, count: 1 },
    { value: 1, count: 2 },
    { value: 2, count: 1 }
  ]);
  const result = view.catalog({ search: "field", levels: [1], sort: "degree" });
  assert.equal(result.matching, 1);
  assert.equal(result.items[0].id, "b");
  assert.equal(result.items[0].parentCount, 1);
  assert.equal(result.items[0].childCount, 1);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(nodes.map((node) => node.id), ["d", "a", "c", "b"]);
});

test("neighborhood projection respects direction, depth, and deterministic limits", () => {
  const view = createModelView({ nodes, edges });
  const full = view.neighborhood({ focusId: "c", depth: 2, direction: "both" });
  assert.deepEqual(full.nodes.map((node) => node.id), ["c", "a", "b", "d"]);
  assert.deepEqual(full.adjacent, { parents: ["a", "b"], children: ["d"] });
  assert.equal(full.nodes.find((node) => node.id === "a").relation, "parent");
  assert.equal(full.nodes.find((node) => node.id === "d").relation, "child");

  const limited = view.neighborhood({
    focusId: "c",
    depth: 2,
    direction: "parents",
    maxNodes: 2,
    maxEdges: 1
  });
  assert.deepEqual(limited.nodes.map((node) => node.id), ["c", "a"]);
  assert.equal(limited.counts.hiddenNodeCount, 1);
  assert.equal(limited.counts.hiddenEdgeCount, 2);
  assert.equal(limited.truncated, true);
});

test("layout is repeatable, bounded, directed, and keeps labels attached to nodes", () => {
  const view = createModelView({ nodes, edges });
  const projection = view.neighborhood({ focusId: "c", depth: 2 });
  const first = layoutNeighborhood(projection, { width: 800, height: 480 });
  const second = layoutNeighborhood(projection, { width: 800, height: 480 });
  assert.deepEqual(first, second);
  assert.equal(first.focusId, "c");
  assert.equal(first.nodes.find((node) => node.id === "c").layer, 0);
  assert.ok(first.nodes.find((node) => node.id === "a").x < first.nodes.find((node) => node.id === "c").x);
  assert.ok(first.nodes.find((node) => node.id === "d").x > first.nodes.find((node) => node.id === "c").x);
  assert.ok(first.nodes.every((node) => node.x >= 77 && node.x <= 723));
  assert.ok(first.nodes.every((node) => node.y >= 77 && node.y <= 403));
  assert.ok(first.edges.every((edge) => /^M [-\d.]+ [-\d.]+ (?:Q|C) /.test(edge.path)));
});

test("parallel and self-loop routes remain finite and distinct", () => {
  const view = createModelView({
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [
      { id: "a-a", source: "a", target: "a" },
      { id: "a-b-1", source: "a", target: "b" },
      { id: "a-b-2", source: "a", target: "b" },
      { id: "b-a", source: "b", target: "a" }
    ]
  });
  const layout = layoutNeighborhood(view.neighborhood({ focusId: "a", depth: 1 }));
  assert.equal(new Set(layout.edges.map((edge) => edge.path)).size, 4);
  assert.ok(layout.edges.every((edge) => !edge.path.includes("NaN")));
});

test("dense boundary layers use inward lanes without overlapping node centers", () => {
  const manyNodes = [
    { id: "focus" },
    ...Array.from({ length: 30 }, (_, index) => ({ id: `child-${String(index).padStart(2, "0")}` }))
  ];
  const manyEdges = manyNodes.slice(1).map((node) => ({
    id: `focus-${node.id}`,
    source: "focus",
    target: node.id
  }));
  const view = createModelView({ nodes: manyNodes, edges: manyEdges });
  const layout = layoutNeighborhood(view.neighborhood({
    focusId: "focus",
    direction: "children",
    depth: 1,
    maxNodes: 60
  }), { width: 800, height: 480 });
  assert.equal(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size, layout.nodes.length);
  assert.ok(layout.nodes.every((node) => node.x >= 77 && node.x <= 723));
});

test("invalid nodes, references, options, and projections fail closed", () => {
  assert.throws(
    () => createModelView({ nodes: [{ id: "a" }], edges: [{ id: "bad", source: "a", target: "b" }] }),
    (error) => error instanceof ViewError && error.code === "VIEW_EDGE_ENDPOINT_MISSING"
  );
  const view = createModelView({ nodes: [{ id: "a" }], edges: [] });
  assert.throws(
    () => view.neighborhood({ focusId: "missing" }),
    (error) => error instanceof ViewError && error.code === "VIEW_FOCUS_MISSING"
  );
  assert.throws(() => view.catalog({ sort: "random" }), /not supported/);
  assert.throws(() => layoutNeighborhood({ nodes: [], edges: [], query: {} }), /projection/i);
});

test("layout validates a detached copy without freezing caller data", () => {
  const view = createModelView({ nodes, edges });
  const mutable = structuredClone(view.neighborhood({ focusId: "c", depth: 1 }));
  layoutNeighborhood(mutable);
  assert.equal(Object.isFrozen(mutable), false);
  mutable.focus.name = "Changed outside the layout";
  assert.throws(
    () => layoutNeighborhood({
      ...structuredClone(view.neighborhood({ focusId: "c", depth: 1 })),
      edges: [{ id: "bad", source: "c", target: "missing" }]
    }),
    (error) => error instanceof ViewError && error.code === "VIEW_PROJECTION_INVALID"
  );
});
