// Documentation reference checks only. No public v2 builder or loader is exposed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelIndexes, buildModelPack, verifyModelPack } from "@onto2d/model-pack";
import { buildModelLineage, verifyModelLineage } from "@onto2d/engine";

const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
const [examples, manifestSchema, chunkSchema] = await Promise.all([
  readJson("examples.json"), readJson("schema/manifest.schema.json"), readJson("schema/chunk.schema.json")
]);
const ajv = new Ajv2020({ strict: true, allErrors: true });
const manifestShape = ajv.compile(manifestSchema);
const chunkShape = ajv.compile(chunkSchema);
const C = canonicalize;
const size = value => Buffer.byteLength(C(value), "utf8");
const H = (domain, value) => `sha256:${createHash("sha256")
  .update(`ONTO2D\0${Buffer.byteLength(domain)}\0${domain}\0`, "utf8")
  .update(C(value), "utf8").digest("hex")}`;
const INDEX_PATHS = {
  byId: "indexes/by-id.json", parents: "indexes/parents.json", children: "indexes/children.json",
  levels: "indexes/levels.json", phases: "indexes/phases.json", typeRoles: "indexes/type-roles.json",
  scientificStatus: "indexes/scientific-status.json"
};
const clone = name => structuredClone(examples.packs[name]);
const identity = manifest => ({ modelId: manifest.model.id, modelVersion: manifest.model.version, modelRootHash: manifest.rootHash });
const rootInput = manifest => ({
  format: manifest.format, formatVersion: manifest.formatVersion, schemaVersion: manifest.schemaVersion,
  modelId: manifest.model.id, compatibility: manifest.compatibility, source: manifest.source,
  semantics: manifest.semantics
});
function seal(pack, recomputeRoot = false) {
  const manifest = pack.manifest;
  if (recomputeRoot) manifest.rootHash = H("onto2d:model-pack-root:v2", rootInput(manifest));
  const { manifestHash: _hash, ...body } = manifest;
  manifest.manifestHash = H("onto2d:model-pack-manifest:v2", body);
}
function rehashChunk(pack, collection, index = 0) {
  const descriptor = pack.manifest.layout[collection][index];
  const value = pack.files[descriptor.path];
  descriptor.hash = H("onto2d:model-pack-chunk:v2", value);
  descriptor.byteLength = size(value);
  seal(pack);
}
function rehashArtifact(pack) {
  const descriptor = pack.manifest.layout.artifacts[0];
  const value = pack.files[descriptor.path];
  descriptor.hash = H("onto2d:model-pack-artifact:v2", { profile: descriptor.profile, value });
  descriptor.byteLength = size(value);
  seal(pack);
}
function parseCanonical(text, byteLength) {
  assert.equal(Buffer.byteLength(text, "utf8"), byteLength, "decoded byte length");
  const value = JSON.parse(text);
  assert.equal(text, C(value), "canonical bytes");
  return value;
}
function shape(check, value, label) {
  assert.ok(check(value), `${label} schema: ${ajv.errorsText(check.errors)}`);
}
function checkedManifest(pack, expectedManifestHash = pack.manifest.manifestHash) {
  const { manifest } = pack;
  C(manifest);
  shape(manifestShape, manifest, "manifest");
  const { manifestHash, ...body } = manifest;
  assert.equal(H("onto2d:model-pack-manifest:v2", body), manifestHash, "manifest hash");
  assert.equal(manifestHash, expectedManifestHash, "external manifest pin");
  assert.equal(H("onto2d:model-pack-root:v2", rootInput(manifest)), manifest.rootHash, "declared root");
  const paths = new Set();
  const addPath = descriptor => {
    assert.ok(!paths.has(descriptor.path), "duplicate path");
    paths.add(descriptor.path);
  };
  for (const collection of ["nodes", "edges"]) {
    let offset = 0;
    let lastId;
    for (const [index, descriptor] of manifest.layout[collection].entries()) {
      addPath(descriptor);
      assert.equal(descriptor.path, `semantic/${collection}/${String(index).padStart(8, "0")}.json`, "ordinal path");
      assert.equal(descriptor.offset, offset, "exact coverage offset");
      offset += descriptor.count;
      assert.ok(Number.isSafeInteger(offset), "coverage overflow");
      assert.ok(descriptor.firstId <= descriptor.lastId, "ID bounds");
      assert.equal(descriptor.firstId === descriptor.lastId, descriptor.count === 1, "ID range cardinality");
      assert.ok(lastId === undefined || lastId < descriptor.firstId, "disjoint ID ranges");
      lastId = descriptor.lastId;
    }
    assert.equal(offset, manifest.semantics[collection].count, "complete declared coverage");
  }
  addPath(manifest.layout.dictionaries);
  for (const category of ["indexes", "artifacts"]) {
    let previousId;
    for (const descriptor of manifest.layout[category]) {
      addPath(descriptor);
      assert.ok(previousId === undefined || previousId < descriptor.id, "sorted unique optional IDs");
      assert.equal(descriptor.path, category === "indexes"
        ? INDEX_PATHS[descriptor.id] : `artifacts/${descriptor.id}.json`, "optional path binding");
      if (category === "artifacts") assert.equal(descriptor.profile.trim(), descriptor.profile, "profile normalization");
      previousId = descriptor.id;
    }
  }
  assert.ok(paths.size + 1 <= 4096, "declared file ceiling");
  assert.ok(Object.keys(pack.files).every(path => paths.has(path)), "undeclared file");
  return manifest;
}
function readDeclared(pack, descriptor, domain, payload = value => value) {
  assert.ok(Object.hasOwn(pack.files, descriptor.path), `missing file: ${descriptor.path}`);
  const value = pack.files[descriptor.path];
  parseCanonical(C(value), descriptor.byteLength);
  assert.equal(H(domain, payload(value)), descriptor.hash, "file hash");
  return value;
}
function checkedChunk(pack, collection, index) {
  const descriptor = pack.manifest.layout[collection][index];
  const chunk = readDeclared(pack, descriptor, "onto2d:model-pack-chunk:v2");
  shape(chunkShape, chunk, "chunk");
  assert.equal(chunk.collection, collection, "chunk collection");
  assert.equal(chunk.offset, descriptor.offset, "chunk offset");
  assert.equal(chunk.records.length, descriptor.count, "chunk count");
  assert.equal(chunk.records[0].id, descriptor.firstId, "first ID");
  assert.equal(chunk.records.at(-1).id, descriptor.lastId, "last ID");
  for (const record of chunk.records) {
    for (const field of collection === "edges" ? ["id", "source", "target"] : ["id"]) {
      assert.ok(record[field].length <= 1024, "identifier UTF-16 bound");
    }
  }
  for (let i = 1; i < chunk.records.length; i += 1) {
    assert.ok(chunk.records[i - 1].id < chunk.records[i].id, "strict record order");
  }
  return chunk.records;
}
function verifyExample(pack, { optional = true, expectedManifestHash } = {}) {
  const manifest = checkedManifest(pack, expectedManifestHash);
  const data = {};
  for (const collection of ["nodes", "edges"]) {
    data[collection] = manifest.layout[collection].flatMap((_, index) => checkedChunk(pack, collection, index));
  }
  data.dictionaries = readDeclared(pack, manifest.layout.dictionaries, "onto2d:model-pack-collection:v2",
    value => ({ collection: "dictionaries", value }));
  // Reuse unchanged v1 record/source normalization and global endpoint/index checks.
  // This does not make the proposed v2 transport a supported engine input.
  const normalized = buildModelPack({ model: manifest.model, source: manifest.source, ...data });
  assert.equal(C(manifest.source), C(normalized.manifest.source), "source normalization");
  assert.equal(C(manifest.model), C(normalized.manifest.model), "model normalization");
  for (const collection of ["nodes", "edges", "dictionaries"]) {
    assert.equal(C(data[collection]), C(normalized.files[`model/${collection}.json`]), "semantic normalization");
    assert.equal(H("onto2d:model-pack-collection:v2", { collection, value: data[collection] }),
      manifest.semantics[collection].hash, "logical collection hash");
  }
  if (optional) {
    const indexes = buildModelIndexes(data.nodes, data.edges);
    for (const descriptor of manifest.layout.indexes) {
      const value = readDeclared(pack, descriptor, "onto2d:model-pack-index:v2", value => ({ id: descriptor.id, value }));
      assert.equal(C(value), C(indexes[descriptor.id]), "rebuilt index");
    }
    for (const descriptor of manifest.layout.artifacts) {
      const value = readDeclared(pack, descriptor, "onto2d:model-pack-artifact:v2", value => ({ profile: descriptor.profile, value }));
      if (descriptor.profile === "onto2d-model-lineage-v1") {
        verifyModelLineage(value);
        assert.deepEqual(value.to, identity(manifest), "lineage target binding");
      }
    }
  }
  return data;
}

for (const [name, pack] of Object.entries(examples.packs)) {
  test(`frozen ${name} example passes draft schema and complete reference checks`, () => {
    verifyExample(pack);
    assert.deepEqual({ rootHash: pack.manifest.rootHash, manifestHash: pack.manifest.manifestHash }, examples.expected[name]);
    assert.equal(H("onto2d:model-pack-root:v2", rootInput(pack.manifest)),
      hashCanonical("onto2d:model-pack-root:v2", rootInput(pack.manifest)));
  });
}

test("partition and optional artifacts preserve semantics while changing the manifest", () => {
  const names = ["single", "split", "annotated"];
  assert.equal(new Set(names.map(name => examples.expected[name].rootHash)).size, 1);
  assert.equal(new Set(names.map(name => examples.expected[name].manifestHash)).size, 3);
  const { nodes, edges, dictionaries } = examples.input;
  for (const name of names) assert.deepEqual(verifyExample(clone(name)), { nodes, edges, dictionaries });
});

test("v1 round-trip preserves logical data but neither accepts v2 nor shares its root", () => {
  const v1 = buildModelPack(examples.input);
  verifyModelPack(v1);
  assert.notEqual(v1.manifest.rootHash, examples.expected.single.rootHash);
  for (const collection of ["nodes", "edges", "dictionaries"]) {
    assert.deepEqual(v1.files[`model/${collection}.json`], verifyExample(clone("single"))[collection]);
  }
  assert.throws(() => verifyModelPack(clone("single")), { code: "MODEL_PACK_COMPATIBILITY_UNSUPPORTED" });
});

test("individually checked chunks do not prove an inconsistent logical root", () => {
  const pack = clone("split");
  pack.manifest.semantics.nodes.hash = examples.packs.previous.manifest.semantics.nodes.hash;
  seal(pack, true);
  checkedManifest(pack);
  checkedChunk(pack, "nodes", 0);
  assert.throws(() => verifyExample(pack), /logical collection hash/);
});

test("lineage reuses existing v1 normalization and targets the semantic successor", () => {
  const pack = clone("annotated");
  const lineage = pack.files["artifacts/from-previous.json"];
  assert.deepEqual(lineage.from, identity(examples.packs.previous.manifest));
  assert.deepEqual(lineage.to, identity(pack.manifest));
  assert.ok(examples.packs.previous.files["semantic/nodes/00000000.json"].records.some(node => node.id === "a"));
  assert.ok(!examples.input.nodes.some(node => node.id === "a"));
  assert.ok(examples.input.nodes.some(node => node.id === "b"));
  lineage.to.manifestHash = pack.manifest.manifestHash;
  assert.throws(() => verifyModelLineage(lineage), /unknown fields/);
});

test("missing optional data blocks full release checking while leaving core verification possible", () => {
  const pack = clone("annotated");
  delete pack.files["artifacts/from-previous.json"];
  verifyExample(pack, { optional: false });
  assert.throws(() => verifyExample(pack), /missing file/);
});

test("unsupported artifact profiles can be checked as inert data without lineage interpretation", () => {
  const pack = clone("annotated");
  pack.manifest.layout.artifacts[0].profile = "example-uninterpreted-v1";
  pack.files["artifacts/from-previous.json"] = { note: "Inert data" };
  rehashArtifact(pack);
  verifyExample(pack);
  assert.equal(pack.manifest.rootHash, examples.expected.single.rootHash);
});

const mutations = [
  ["unknown manifest field", "single", pack => { pack.manifest.hiddenSemantics = {}; seal(pack); }, /manifest schema/],
  ["unsupported format", "single", pack => { pack.manifest.formatVersion = "3"; seal(pack, true); }, /manifest schema/],
  ["missing semantic file", "split", pack => { delete pack.files[pack.manifest.layout.nodes[1].path]; }, /missing file/],
  ["undeclared file", "single", pack => { pack.files["surprise.json"] = {}; }, /undeclared file/],
  ["offset gap", "split", pack => { pack.manifest.layout.nodes[1].offset += 1; seal(pack); }, /coverage offset/],
  ["offset overlap", "split", pack => { pack.manifest.layout.nodes[1].offset = 0; seal(pack); }, /coverage offset/],
  ["duplicate ID boundary", "split", pack => { pack.manifest.layout.nodes[1].firstId = "b"; seal(pack); }, /disjoint ID ranges/],
  ["unsafe transport path", "single", pack => { pack.manifest.layout.nodes[0].path = "../nodes.json"; seal(pack); }, /manifest schema/],
  ["wrong ordinal path", "single", pack => { pack.manifest.layout.nodes[0].path = "semantic/nodes/00000009.json"; seal(pack); }, /ordinal path/],
  ["changed chunk bytes", "single", pack => { pack.files[pack.manifest.layout.nodes[0].path].records[0].label = "Other"; }, /file hash/],
  ["wrong decoded length", "single", pack => { pack.manifest.layout.nodes[0].byteLength += 1; seal(pack); }, /decoded byte length/],
  ["changed chunk envelope offset", "single", pack => { pack.files[pack.manifest.layout.nodes[0].path].offset = 1; rehashChunk(pack, "nodes"); }, /chunk offset/],
  ["duplicate records after rehash", "single", pack => { pack.files[pack.manifest.layout.nodes[0].path].records[1].id = "b"; rehashChunk(pack, "nodes"); }, /strict record order/],
  ["dangling edge after rehash", "single", pack => { pack.files[pack.manifest.layout.edges[0].path].records[0].target = "absent"; rehashChunk(pack, "edges"); }, /endpoint/],
  ["forged logical count", "single", pack => { pack.manifest.semantics.nodes.count += 1; seal(pack, true); }, /declared coverage/],
  ["unsafe integer", "single", pack => { pack.manifest.layout.nodes[0].count = Number.MAX_SAFE_INTEGER + 1; seal(pack); }, /manifest schema/],
  ["index ID/path mismatch", "annotated", pack => { pack.manifest.layout.indexes[0].path = "indexes/parents.json"; seal(pack); }, /path binding/],
  ["stale index with valid hash", "annotated", pack => {
    const descriptor = pack.manifest.layout.indexes[0];
    const value = pack.files[descriptor.path];
    value[0].index = 2;
    descriptor.hash = H("onto2d:model-pack-index:v2", { id: descriptor.id, value });
    descriptor.byteLength = size(value); seal(pack);
  }, /rebuilt index/],
  ["reversed lineage", "annotated", pack => {
    const descriptor = pack.manifest.layout.artifacts[0];
    const value = pack.files[descriptor.path];
    pack.files[descriptor.path] = buildModelLineage({ from: value.to, to: value.from, events: [] });
    rehashArtifact(pack);
  }, /lineage target binding/],
  ["lineage bound to another version", "annotated", pack => {
    const descriptor = pack.manifest.layout.artifacts[0];
    const value = pack.files[descriptor.path];
    value.to.modelVersion = "99.0.0";
    pack.files[descriptor.path] = buildModelLineage({ from: value.from, to: value.to, events: value.events });
    rehashArtifact(pack);
  }, /lineage target binding/]
];
for (const [label, name, mutate, pattern] of mutations) {
  test(`reject ${label}`, () => {
    const pack = clone(name);
    mutate(pack);
    assert.throws(() => verifyExample(pack), pattern);
  });
}

test("an external manifest pin rejects another layout with the same root", () => {
  assert.throws(() => verifyExample(clone("split"), { expectedManifestHash: examples.expected.single.manifestHash }), /external manifest pin/);
});

test("byte checks reject duplicate keys, alternate JSON encodings and trailing data", () => {
  for (const text of ['{"id":"a","id":"b"}', '{ "id":"b"}', '{"id":"\\u0062"}', '{"id":"b"}\n', '{"x":1.0}', '{"x":-0}', '{"x":1}{}']) {
    assert.throws(() => parseCanonical(text, Buffer.byteLength(text)), /canonical bytes|JSON|Unexpected/);
  }
  const value = { id: "é", label: "🧪" };
  assert.deepEqual(parseCanonical(C(value), size(value)), value);
  assert.throws(() => parseCanonical(C(value), C(value).length), /decoded byte length/);
});

test("local chunk checks preserve the v1 UTF-16 identifier bound", () => {
  const pack = clone("emptyEdges");
  const descriptor = pack.manifest.layout.nodes[0];
  const chunk = pack.files[descriptor.path];
  chunk.records[0].id = "🧪".repeat(513);
  descriptor.firstId = descriptor.lastId = chunk.records[0].id;
  rehashChunk(pack, "nodes");
  // JSON Schema counts Unicode code points; v1's runtime bound counts code units.
  shape(chunkShape, chunk, "chunk");
  assert.throws(() => checkedChunk(pack, "nodes", 0), /identifier UTF-16 bound/);
});
