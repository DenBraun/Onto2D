import assert from "node:assert/strict";
import test from "node:test";
import { schemaUrls, SCHEMA_VERSION } from "../../packages/schemas/src/index.js";

test("schema package exposes every initial contract as a file URL", () => {
  assert.equal(SCHEMA_VERSION, "1");
  assert.equal(Object.keys(schemaUrls).length, 32);
  for (const url of Object.values(schemaUrls)) {
    assert.equal(url.protocol, "file:");
    assert.ok(url.pathname.endsWith(".schema.json"));
  }
});
