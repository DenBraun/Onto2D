import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalize } from "@onto2d/kernel";
import {
  ModelPackError,
  buildModelPack,
  verifyModelPack
} from "../src/index.js";

const sourceHash = `sha256:${"a".repeat(64)}`;

function fixture(overrides = {}) {
  return buildModelPack({
    model: {
      id: "fixture",
      name: "Fixture Model",
      version: overrides.version ?? "1.0.0"
    },
    source: {
      id: "fixture-source",
      files: [{ path: "source/model.json", hash: sourceHash }]
    },
    nodes: overrides.nodes ?? [
      { id: "a", level: 0, phase: "A", typeRole: "Process" },
      { id: "b", level: 0, phase: "B", typeRole: "Object" },
      { id: "c", level: 1, phase: "A", typeRole: "Pattern" }
    ],
    edges: overrides.edges ?? [
      { id: "a-b", source: "a", target: "b", relationLayer: "source" },
      { id: "b-c", source: "b", target: "c", relationLayer: "source" }
    ],
    dictionaries: overrides.dictionaries ?? { phases: ["A", "B"] }
  });
}

test("Model Pack construction is deterministic and input-order independent", () => {
  const left = fixture();
  const right = fixture({
    nodes: [
      { id: "c", level: 1, phase: "A", typeRole: "Pattern" },
      { id: "b", level: 0, phase: "B", typeRole: "Object" },
      { id: "a", level: 0, phase: "A", typeRole: "Process" }
    ],
    edges: [
      { id: "b-c", source: "b", target: "c", relationLayer: "source" },
      { id: "a-b", source: "a", target: "b", relationLayer: "source" }
    ]
  });
  assert.equal(canonicalize(left), canonicalize(right));
  assert.equal(left.manifest.rootHash, right.manifest.rootHash);
  assert.equal(left.manifest.statistics.nodeCount, 3);
  assert.equal(left.manifest.statistics.edgeCount, 2);
  assert.deepEqual(left.files["indexes/parents.json"], [
    { id: "a", nodes: [] },
    { id: "b", nodes: ["a"] },
    { id: "c", nodes: ["b"] }
  ]);
});

test("Model Pack verification reconstructs every semantic file and derived index", () => {
  const pack = fixture();
  assert.equal(verifyModelPack(pack).manifest.manifestHash, pack.manifest.manifestHash);

  const tamperedIndex = structuredClone(pack);
  tamperedIndex.files["indexes/parents.json"][1].nodes = [];
  assert.throws(
    () => verifyModelPack(tamperedIndex),
    (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_VERIFICATION_FAILED"
  );

  const unexpected = structuredClone(pack);
  unexpected.files["model/script.js"] = "alert(1)";
  assert.throws(() => verifyModelPack(unexpected), /differ from reconstruction/);
});

test("semantic changes create a new root while release metadata stays outside semantic identity", () => {
  const base = fixture();
  const changed = fixture({
    nodes: [
      { id: "a", level: 0, phase: "A", typeRole: "Process" },
      { id: "b", level: 0, phase: "B", typeRole: "Pattern" },
      { id: "c", level: 1, phase: "A", typeRole: "Pattern" }
    ]
  });
  const newVersion = fixture({ version: "1.0.1" });
  assert.notEqual(base.manifest.rootHash, changed.manifest.rootHash);
  assert.equal(base.manifest.rootHash, newVersion.manifest.rootHash);
  assert.notEqual(base.manifest.manifestHash, newVersion.manifest.manifestHash);
});

test("Model Pack construction rejects missing endpoints, duplicate IDs, and path escapes", () => {
  assert.throws(
    () => fixture({ edges: [{ id: "bad", source: "missing", target: "a" }] }),
    /endpoint must resolve/
  );
  assert.throws(
    () => fixture({ nodes: [{ id: "a" }, { id: "a" }] }),
    /identifiers must be unique/
  );
  assert.throws(
    () => buildModelPack({
      model: { id: "fixture", name: "Fixture", version: "1" },
      source: { id: "source", files: [{ path: "../escape", hash: sourceHash }] },
      nodes: [{ id: "a" }],
      edges: [],
      dictionaries: {}
    }),
    /normalized relative paths/
  );
});

test("the Model Pack manifest conforms to the published transport schema", async () => {
  const schema = JSON.parse(await readFile(
    new URL("../../schemas/schemas/model-pack-manifest.schema.json", import.meta.url),
    "utf8"
  ));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(
    validate(fixture().manifest),
    true,
    validate.errors ? JSON.stringify(validate.errors) : ""
  );
});
