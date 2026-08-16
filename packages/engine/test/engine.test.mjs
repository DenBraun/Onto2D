import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { buildModelPack } from "@onto2d/model-pack";
import {
  EngineError,
  Onto2D,
  buildModelLineage,
  modelIdentity,
  verifyModelLineage
} from "../src/index.js";

const sourceHash = `sha256:${"b".repeat(64)}`;

function pack(version, nodes, edges) {
  return buildModelPack({
    model: { id: "fixture", name: "Fixture", version },
    source: { id: "fixture-source", files: [{ path: "fixture.json", hash: sourceHash }] },
    nodes,
    edges,
    dictionaries: {}
  });
}

const first = pack("1.0.0", [
  { id: "a", level: 0, typeRole: "Process" },
  { id: "b", level: 0, typeRole: "Object" },
  { id: "c", level: 1, typeRole: "Pattern" },
  { id: "d", level: 1, typeRole: "Pattern" }
], [
  { id: "a-b", source: "a", target: "b", relationLayer: "native" },
  { id: "a-c", source: "a", target: "c", relationLayer: "native" },
  { id: "b-d", source: "b", target: "d", relationLayer: "native" },
  { id: "c-d", source: "c", target: "d", relationLayer: "native" }
]);

const second = pack("1.1.0", [
  { id: "a", level: 0, typeRole: "Process" },
  { id: "b", level: 0, typeRole: "Pattern" },
  { id: "c", level: 1, typeRole: "Pattern" },
  { id: "e", level: 2, typeRole: "Effect" }
], [
  { id: "a-b", source: "a", target: "b", relationLayer: "revised" },
  { id: "a-c", source: "a", target: "c", relationLayer: "native" },
  { id: "c-e", source: "c", target: "e", relationLayer: "native" }
]);

test("the engine resolves aliases before exposing the selected model", async () => {
  const onto = await Onto2D.create({
    models: [first, second],
    aliases: { fixture: { stable: "1.1.0", previous: "1.0.0" } },
    model: "fixture@stable"
  });
  assert.equal(onto.model.version, "1.1.0");
  assert.equal(onto.modelResolution.requested, "fixture@stable");
  assert.equal(onto.modelResolution.exact, "fixture@1.1.0");
  assert.equal(onto.modelResolution.modelRootHash, second.manifest.rootHash);
  assert.throws(
    () => onto.models.resolve("fixture@latest"),
    (error) => error instanceof EngineError && error.code === "ENGINE_MODEL_RESOLUTION_FAILED"
  );
  await assert.rejects(
    () => Onto2D.create({ models: [first], aliases: { fixture: { stable: 1 } } }),
    (error) => error instanceof EngineError && error.code === "ENGINE_MODEL_REFERENCE_INVALID"
  );
  await assert.rejects(
    () => Onto2D.create(new Date()),
    (error) => error instanceof EngineError && error.code === "ENGINE_OPTIONS_INVALID"
  );
});

test("model queries and traversal are deterministic and preserve relation layers", async () => {
  const onto = await Onto2D.create({ models: [first], model: "fixture@1.0.0" });
  assert.equal(onto.model.get("b").typeRole, "Object");
  assert.deepEqual(onto.model.get("a").children().map((node) => node.id), ["b", "c"]);
  assert.deepEqual(onto.model.get("d").parents().map((node) => node.id), ["b", "c"]);
  assert.deepEqual(onto.model.query({ level: 1 }).map((node) => node.id), ["c", "d"]);
  assert.deepEqual(onto.model.paths({ from: "a", to: "d" }), [
    ["a", "b", "d"],
    ["a", "c", "d"]
  ]);
  assert.deepEqual(onto.model.descendants("a").map((node) => node.id), ["b", "c", "d"]);
  assert.equal(onto.model.neighborhood("a", { depth: 1 }).nodes.length, 3);
  assert.equal(onto.model.edges({ relationLayer: "native" }).length, 4);
});

test("parallel edges do not duplicate neighbor nodes or identical shortest paths", async () => {
  const parallel = pack("parallel", [
    { id: "a" },
    { id: "b" },
    { id: "c" }
  ], [
    { id: "a-b-1", source: "a", target: "b", relationLayer: "first" },
    { id: "a-b-2", source: "a", target: "b", relationLayer: "second" },
    { id: "b-c", source: "b", target: "c", relationLayer: "first" }
  ]);
  const onto = await Onto2D.create({ models: [parallel], model: "fixture@parallel" });
  assert.deepEqual(onto.model.children("a").map((node) => node.id), ["b"]);
  assert.deepEqual(onto.model.paths({ from: "a", to: "c" }), [["a", "b", "c"]]);
  assert.equal(onto.model.children("a", { relationLayer: "second" })[0].id, "b");
});

test("Workspace keeps model identities, bindings, and runs isolated", async () => {
  const onto = await Onto2D.create({ models: [first, second], model: "fixture@1.0.0" });
  const newer = onto.models.get("fixture@1.1.0");
  onto.workspace.add(newer, { workspaceId: "newer" });
  assert.equal(onto.workspace.models().length, 2);
  onto.workspace.addBinding({
    id: "comparison-binding",
    sourceModel: "default",
    targetModel: "newer",
    status: "explicit"
  });
  onto.workspace.addRun({
    id: "run-1",
    modelWorkspaceId: "newer",
    modelRootHash: newer.rootHash
  });
  assert.throws(() => onto.workspace.remove("newer"), /Remove bindings/);
  onto.workspace.removeBinding("comparison-binding");
  assert.throws(() => onto.workspace.remove("newer"), /Remove runs/);
  onto.workspace.removeRun("run-1");
  assert.equal(onto.workspace.remove("newer"), true);
  assert.equal(onto.workspace.models().length, 1);
  assert.throws(
    () => onto.workspace.addBinding(null),
    (error) => error instanceof EngineError && error.code === "ENGINE_WORKSPACE_RECORD_INVALID"
  );
  assert.throws(
    () => onto.workspace.add(newer, { workspaceId: "bad-kind", modelKind: {} }),
    (error) => error instanceof EngineError && error.code === "ENGINE_WORKSPACE_IDENTIFIER_INVALID"
  );
});

test("structural diff reports changed meaning without inventing lineage", async () => {
  const onto = await Onto2D.create({ models: [first, second], model: "fixture@1.0.0" });
  const diff = await onto.models.diff("fixture@1.0.0", "fixture@1.1.0");
  assert.deepEqual(diff.nodes.added, ["e"]);
  assert.deepEqual(diff.nodes.removed, ["d"]);
  assert.deepEqual(diff.nodes.changed, [{ id: "b", fields: ["typeRole"] }]);
  assert.deepEqual(diff.edges.added, ["c-e"]);
  assert.deepEqual(diff.edges.removed, ["b-d", "c-d"]);
  assert.deepEqual(diff.edges.changed, [{ id: "a-b", fields: ["relationLayer"] }]);
  assert.equal(diff.lineage.status, "not-declared");
  assert.equal(diff.statistics.lineageEventCount, 0);
  assert.match(diff.diffHash, /^sha256:[a-f0-9]{64}$/);
});

test("registered lineage is exact, content-addressed, and projected only after structural validation", async () => {
  const leftModel = (await Onto2D.create({ models: [first], model: "fixture@1.0.0" })).model;
  const rightModel = (await Onto2D.create({ models: [second], model: "fixture@1.1.0" })).model;
  const lineage = buildModelLineage({
    from: modelIdentity(leftModel),
    to: modelIdentity(rightModel),
    events: [
      {
        id: "classification-b",
        kind: "classification-change",
        entity: "node",
        from: ["b"],
        to: ["b"],
        fields: ["typeRole"]
      },
      { id: "deprecate-d", kind: "deprecate", entity: "node", from: ["d"], to: [] },
      {
        id: "deprecate-old-edges",
        kind: "deprecate",
        entity: "edge",
        from: ["c-d", "b-d"],
        to: []
      },
      {
        id: "relation-a-b",
        kind: "relation-change",
        entity: "edge",
        from: ["a-b"],
        to: ["a-b"],
        fields: ["relationLayer"]
      }
    ]
  });
  const onto = await Onto2D.create({
    models: [first, second],
    lineages: [lineage],
    model: "fixture@1.0.0"
  });
  const diff = await onto.models.diff("fixture@1.0.0", "fixture@1.1.0");
  assert.equal(diff.lineage.status, "declared");
  assert.equal(diff.lineage.lineageHash, lineage.lineageHash);
  assert.equal(diff.lineage.events.length, 4);
  assert.equal(diff.statistics.lineageEventCount, 4);
  assert.equal(onto.models.lineages()[0].eventCount, 4);

  const tampered = structuredClone(lineage);
  tampered.events[0].fields = ["phase"];
  assert.throws(
    () => verifyModelLineage(tampered),
    (error) => error instanceof EngineError && error.code === "ENGINE_LINEAGE_VERIFICATION_FAILED"
  );
});

test("lineage registry keys retain exact versions even when semantic roots are equal", async () => {
  const metadataRelease = pack("1.0.1", first.files["model/nodes.json"], first.files["model/edges.json"]);
  const otherMetadataRelease = pack("1.0.2", first.files["model/nodes.json"], first.files["model/edges.json"]);
  const preliminary = await Onto2D.create({
    models: [first, metadataRelease, otherMetadataRelease],
    model: "fixture@1.0.0"
  });
  const firstLineage = buildModelLineage({
    from: modelIdentity(preliminary.models.get("fixture@1.0.0")),
    to: modelIdentity(preliminary.models.get("fixture@1.0.1")),
    events: []
  });
  const secondLineage = buildModelLineage({
    from: modelIdentity(preliminary.models.get("fixture@1.0.2")),
    to: modelIdentity(preliminary.models.get("fixture@1.0.1")),
    events: []
  });
  const onto = await Onto2D.create({
    models: [first, metadataRelease, otherMetadataRelease],
    lineages: [firstLineage, secondLineage],
    model: "fixture@1.0.0"
  });
  assert.equal(first.manifest.rootHash, metadataRelease.manifest.rootHash);
  assert.equal(first.manifest.rootHash, otherMetadataRelease.manifest.rootHash);
  assert.equal(onto.models.lineages().length, 2);
  assert.equal(
    (await onto.models.diff("fixture@1.0.0", "fixture@1.0.1")).lineage.lineageHash,
    firstLineage.lineageHash
  );
});

test("lineage rejects wrong release direction and claims unsupported by the structural diff", async () => {
  const leftModel = (await Onto2D.create({ models: [first], model: "fixture@1.0.0" })).model;
  const rightModel = (await Onto2D.create({ models: [second], model: "fixture@1.1.0" })).model;
  const unsupported = buildModelLineage({
    from: modelIdentity(leftModel),
    to: modelIdentity(rightModel),
    events: [{ id: "false-rename", kind: "rename", entity: "node", from: ["a"], to: ["e"] }]
  });
  await assert.rejects(
    () => Onto2D.create({
      models: [first, second],
      lineages: [unsupported],
      model: "fixture@1.0.0"
    }),
    (error) => error instanceof EngineError && error.code === "ENGINE_LINEAGE_CHANGE_UNSUPPORTED"
  );
  assert.throws(
    () => verifyModelLineage(unsupported, { from: rightModel, to: leftModel }),
    (error) => error instanceof EngineError && error.code === "ENGINE_LINEAGE_SOURCE_MISMATCH"
  );
  assert.throws(
    () => buildModelLineage({
      from: modelIdentity(leftModel),
      to: modelIdentity(rightModel),
      events: [{
        id: "empty-fields",
        kind: "classification-change",
        entity: "node",
        from: ["b"],
        to: ["b"],
        fields: []
      }]
    }),
    (error) => error instanceof EngineError && error.code === "ENGINE_LINEAGE_EVENT_INVALID"
  );
});

test("model lineage conforms to the published transport schema", async () => {
  const leftModel = (await Onto2D.create({ models: [first], model: "fixture@1.0.0" })).model;
  const rightModel = (await Onto2D.create({ models: [second], model: "fixture@1.1.0" })).model;
  const lineage = buildModelLineage({
    from: modelIdentity(leftModel),
    to: modelIdentity(rightModel),
    events: []
  });
  const schema = JSON.parse(await readFile(
    new URL("../../schemas/schemas/model-lineage.schema.json", import.meta.url),
    "utf8"
  ));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(lineage), true, JSON.stringify(validate.errors));
});

test("explicitly registered analyses receive exact model resolution", async () => {
  const onto = await Onto2D.create({
    models: [first],
    model: "fixture@1.0.0",
    analyses: [{
      id: "node-count",
      version: "1",
      run(context, input) {
        return {
          count: context.model.nodes(input.query).length,
          rootHash: context.modelResolution.modelRootHash
        };
      }
    }]
  });
  assert.deepEqual(await onto.analyze("node-count", { query: { level: 0 } }), {
    count: 2,
    rootHash: first.manifest.rootHash
  });
  await assert.rejects(() => onto.analyze("missing"), /not registered/);
});
