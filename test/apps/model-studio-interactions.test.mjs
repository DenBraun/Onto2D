import assert from "node:assert/strict";
import test from "node:test";
import { graphHighlight } from "../../apps/model-studio/graph-interactions.js";

const projection = {
  nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }],
  edges: [
    { id: "a-b", source: "a", target: "b" },
    { id: "a-c", source: "a", target: "c" },
    { id: "b-c", source: "b", target: "c" },
    { id: "c-d", source: "c", target: "d" }
  ]
};

test("node hover selects only its incident edges and nearest neighbors", () => {
  assert.deepEqual(graphHighlight(projection, { kind: "node", id: "c" }), {
    primaryNodes: ["c"],
    connectedNodes: ["a", "b", "d"],
    primaryEdges: [],
    connectedEdges: ["a-c", "b-c", "c-d"]
  });
});

test("edge hover selects its endpoints and their one-hop context", () => {
  assert.deepEqual(graphHighlight(projection, { kind: "edge", id: "a-c" }), {
    primaryNodes: ["a", "c"],
    connectedNodes: ["b", "d"],
    primaryEdges: ["a-c"],
    connectedEdges: ["a-b", "b-c", "c-d"]
  });
});

test("hover projection rejects missing graph entities", () => {
  assert.throws(() => graphHighlight(projection, { kind: "node", id: "missing" }), RangeError);
  assert.throws(() => graphHighlight(projection, { kind: "edge", id: "missing" }), RangeError);
  assert.throws(() => graphHighlight(projection, { kind: "unknown", id: "a" }), TypeError);
});
