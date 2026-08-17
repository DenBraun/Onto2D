import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createModelView, layoutNeighborhood } from "@onto2d/view";

const releaseRoot = new URL("../../models/causal-emergence/releases/2026.08.15/", import.meta.url);

async function json(path) {
  return JSON.parse(await readFile(new URL(path, releaseRoot), "utf8"));
}

test("the Studio projection accepts the exact bundled release and draws a stable initial graph", async () => {
  const [manifest, nodes, edges] = await Promise.all([
    json("manifest.json"),
    json("model/nodes.json"),
    json("model/edges.json")
  ]);
  const view = createModelView({ nodes, edges });
  assert.deepEqual(view.statistics, manifest.statistics);
  assert.equal(view.statistics.nodeCount, 249);
  assert.equal(view.statistics.edgeCount, 971);
  assert.equal(view.facets.levels.length, 8);

  const projection = view.neighborhood({
    focusId: "0.0",
    depth: 1,
    direction: "both",
    maxNodes: 48,
    maxEdges: 180
  });
  const layout = layoutNeighborhood(projection, {
    width: 1040,
    height: 680,
    padding: 62,
    nodeRadius: 25
  });
  assert.deepEqual(projection.adjacent.parents, ["0.15"]);
  assert.deepEqual(projection.adjacent.children, ["0.1", "0.2"]);
  assert.deepEqual(layout.nodes.map((node) => node.id), ["0.0", "0.1", "0.15", "0.2"]);
  assert.equal(layout.edges.length, 3);
  assert.ok(layout.edges.every((edge) => edge.path.includes(" Q ")));
  assert.ok(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.ok(layout.nodes.find((node) => node.id === "0.0").x < layout.nodes.find((node) => node.id === "0.1").x);
});

test("dense real neighborhoods stay bounded and preserve the selected focus", async () => {
  const view = createModelView({
    nodes: await json("model/nodes.json"),
    edges: await json("model/edges.json")
  });
  const projection = view.neighborhood({
    focusId: "4.3",
    depth: 2,
    direction: "both",
    maxNodes: 48,
    maxEdges: 180
  });
  const layout = layoutNeighborhood(projection);
  assert.equal(layout.focusId, "4.3");
  assert.ok(projection.counts.displayedNodeCount <= 48);
  assert.ok(projection.counts.displayedEdgeCount <= 180);
  assert.equal(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size, layout.nodes.length);
  assert.ok(layout.edges.every((edge) => !/NaN|Infinity/.test(edge.path)));
});

test("every real depth-2 Studio layout keeps bounded node cards separated", async () => {
  const nodes = await json("model/nodes.json");
  const view = createModelView({ nodes, edges: await json("model/edges.json") });
  for (const focus of nodes) {
    const projection = view.neighborhood({
      focusId: focus.id,
      depth: 2,
      direction: "both",
      maxNodes: 48,
      maxEdges: 180
    });
    const layout = layoutNeighborhood(projection, {
      width: 1040,
      height: 680,
      padding: 42,
      nodeWidth: 148,
      nodeHeight: 54
    });
    for (let left = 0; left < layout.nodes.length; left += 1) {
      for (let right = left + 1; right < layout.nodes.length; right += 1) {
        const horizontalDistance = Math.abs(layout.nodes[left].x - layout.nodes[right].x);
        const verticalDistance = Math.abs(layout.nodes[left].y - layout.nodes[right].y);
        assert.ok(
          horizontalDistance >= layout.nodeWidth + 12 || verticalDistance >= layout.nodeHeight + 18,
          `${focus.id}: ${layout.nodes[left].id} overlaps ${layout.nodes[right].id}`
        );
      }
    }
  }
});
