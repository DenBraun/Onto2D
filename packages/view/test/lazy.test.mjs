import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { layoutNeighborhood } from "../src/index.js";
import {
  LazyModelPresentation,
  MODEL_PRESENTATION_FORMAT_VERSION,
  MODEL_PRESENTATION_LIMITS,
  createLazyModelPresentation
} from "../src/lazy.js";

const hash = (character) => `sha256:${character.repeat(64)}`;
const identity = Object.freeze({
  modelId: "fixture",
  modelVersion: "1",
  rootHash: hash("a"),
  manifestHash: hash("b")
});
const nodes = [
  { id: "a", name: "Alpha", description: "Heavy alpha record", evidence: [{ source: "fixture" }] },
  { id: "b", name: "Beta", level: 1 },
  { id: "c", name: "Gamma", level: 1 },
  { id: "d", name: "Delta", level: 2 }
];
const edges = [
  { id: "a-b", source: "a", target: "b", dependencyType: "supports" },
  { id: "a-c", source: "a", target: "c", dependencyType: "supports" },
  { id: "c-d", source: "c", target: "d", dependencyType: "supports" }
];

function presentation(options) {
  return createLazyModelPresentation({ identity, nodes, edges }, options);
}

test("lazy presentation pages lightweight records under one exact model identity", () => {
  const view = presentation({ defaultCatalogPageSize: 2 });
  assert.ok(view instanceof LazyModelPresentation);
  assert.equal(view.descriptor.formatVersion, MODEL_PRESENTATION_FORMAT_VERSION);
  assert.deepEqual(view.descriptor.identity, identity);
  assert.deepEqual(view.descriptor.statistics, { nodeCount: 4, edgeCount: 3 });
  assert.equal(view.descriptor.capabilities.semanticExecution, false);

  const first = view.catalog();
  const second = view.catalog({ offset: first.nextOffset, limit: 2 });
  assert.deepEqual(first.items.map((node) => node.id), ["a", "b"]);
  assert.deepEqual(second.items.map((node) => node.id), ["c", "d"]);
  assert.equal(first.nextOffset, 2);
  assert.equal(second.nextOffset, null);
  assert.equal(Object.hasOwn(first.items[0], "data"), false);
  assert.equal(JSON.stringify(first).includes("Heavy alpha record"), false);
  assert.deepEqual(first.identity, second.identity);
  assert.ok(Object.isFrozen(first.items[0]));
});

test("full node records and bounded relation names appear only through explicit inspection", () => {
  const view = presentation();
  const detail = view.inspect("a", { maxRelations: 1 });
  assert.equal(detail.kind, "node-detail");
  assert.equal(detail.record.description, "Heavy alpha record");
  assert.deepEqual(detail.record.evidence, [{ source: "fixture" }]);
  assert.deepEqual(detail.relations.children.map((node) => node.id), ["b"]);
  assert.deepEqual(detail.relationCounts, {
    parentCount: 0,
    childCount: 2,
    hiddenParentCount: 0,
    hiddenChildCount: 1
  });
  assert.equal(Object.hasOwn(detail.node, "data"), false);
  assert.ok(Object.isFrozen(detail.record));
  assert.throws(
    () => view.inspect("missing"),
    (error) => error.code === "VIEW_PRESENTATION_NODE_MISSING"
  );
});

test("bounded graph projections remain layout-ready without carrying full records", () => {
  const view = presentation();
  const graph = view.neighborhood({
    focusId: "c",
    depth: 2,
    direction: "both",
    maxNodes: 2,
    maxEdges: 2
  });
  assert.equal(graph.kind, "neighborhood");
  assert.equal(graph.truncated, true);
  assert.ok(graph.nodes.every((node) => !Object.hasOwn(node, "data")));
  assert.ok(graph.edges.every((edge) => !Object.hasOwn(edge, "data")));
  const layout = layoutNeighborhood(graph, { width: 800, height: 480 });
  assert.equal(layout.focusId, "c");
  assert.ok(layout.edges.every((edge) => typeof edge.path === "string"));
});

test("lazy presentation rejects ambiguous options and accessor-bearing input without invoking accessors", () => {
  let invoked = false;
  const accessorIdentity = { ...identity };
  Object.defineProperty(accessorIdentity, "rootHash", {
    enumerable: true,
    get() {
      invoked = true;
      return hash("a");
    }
  });
  assert.throws(
    () => createLazyModelPresentation({ identity: accessorIdentity, nodes, edges }),
    (error) => error.code === "VIEW_PRESENTATION_INPUT_INVALID"
  );
  assert.equal(invoked, false);
  assert.throws(
    () => createLazyModelPresentation({ identity: { ...identity, rootHash: "sha256:bad" }, nodes, edges }),
    (error) => error.code === "VIEW_PRESENTATION_IDENTITY_INVALID"
  );
  assert.throws(
    () => presentation({ unknown: true }),
    (error) => error.code === "VIEW_PRESENTATION_OPTION_INVALID"
  );
  const view = presentation();
  const levels = [];
  Object.defineProperty(levels, "0", {
    enumerable: true,
    get() {
      invoked = true;
      return 1;
    }
  });
  levels.length = 1;
  assert.throws(
    () => view.catalog({ levels }),
    (error) => error.code === "VIEW_PRESENTATION_INPUT_INVALID"
  );
  assert.equal(invoked, false);
  assert.throws(
    () => view.catalog({ limit: MODEL_PRESENTATION_LIMITS.maxCatalogPageSize + 1 }),
    (error) => error.code === "VIEW_PRESENTATION_LIMIT_INVALID"
  );
});

test("closing a lazy presentation is idempotent and permanently fail-closed", () => {
  const view = presentation();
  assert.equal(view.has("a"), true);
  view.close();
  view.close();
  assert.throws(
    () => view.catalog(),
    (error) => error.code === "VIEW_PRESENTATION_CLOSED"
  );
  assert.throws(
    () => view.descriptor,
    (error) => error.code === "VIEW_PRESENTATION_CLOSED"
  );
});

test("lazy descriptors and every projection kind conform to the published schemas", async () => {
  const descriptorSchema = JSON.parse(await readFile(new URL(
    "../../schemas/schemas/model-presentation-descriptor.schema.json",
    import.meta.url
  ), "utf8"));
  const projectionSchema = JSON.parse(await readFile(new URL(
    "../../schemas/schemas/model-presentation-projection.schema.json",
    import.meta.url
  ), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const validateDescriptor = ajv.compile(descriptorSchema);
  const validateProjection = ajv.compile(projectionSchema);
  const view = presentation();
  assert.equal(validateDescriptor(view.descriptor), true, JSON.stringify(validateDescriptor.errors));
  for (const value of [
    view.catalog({ limit: 2 }),
    view.inspect("a"),
    view.neighborhood({ focusId: "a", depth: 2 })
  ]) {
    assert.equal(validateProjection(value), true, JSON.stringify(validateProjection.errors));
  }
});
