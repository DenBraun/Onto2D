import assert from "node:assert/strict";
import test from "node:test";
import legacyRuntime from "../../packages/legacy-runtime/src/index.cjs";
import rootRuntime from "../../onto2d.js";
import { schemaUrls, SCHEMA_VERSION } from "../../packages/schemas/src/index.js";

test("legacy workspace package exposes the root compatibility API", () => {
  assert.equal(legacyRuntime.Onto2DEngine, rootRuntime.Onto2DEngine);
  assert.equal(legacyRuntime.OntologyGraph, rootRuntime.OntologyGraph);
});

test("schema package exposes every initial contract as a file URL", () => {
  assert.equal(SCHEMA_VERSION, "1");
  assert.equal(Object.keys(schemaUrls).length, 26);
  for (const url of Object.values(schemaUrls)) {
    assert.equal(url.protocol, "file:");
    assert.ok(url.pathname.endsWith(".schema.json"));
  }
});
