import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildModelPack } from "@onto2d/model-pack";
import { resolveModelPackRegistry } from "@onto2d/model-pack/registry";
import { createVerifiedModelPresentation } from "../src/presentation.js";

const sourceHash = `sha256:${"c".repeat(64)}`;
const pack = buildModelPack({
  model: { id: "fixture", name: "Fixture", version: "1" },
  source: { id: "fixture-source", files: [{ path: "fixture.json", hash: sourceHash }] },
  nodes: [
    { id: "a", name: "Alpha", description: "Only explicit inspection should expose this." },
    { id: "b", name: "Beta" }
  ],
  edges: [{ id: "a-b", source: "a", target: "b" }],
  dictionaries: {}
});
const resolution = resolveModelPackRegistry({
  format: "onto2d-model-pack-registry",
  formatVersion: "1",
  entries: [{
    modelId: "fixture",
    version: "1",
    rootHash: pack.manifest.rootHash,
    manifestHash: pack.manifest.manifestHash,
    packPath: "fixture/1/"
  }]
}, "https://example.test/models/registry.json", { modelId: "fixture", version: "1" });

test("engine creates an identity-bound lazy presentation only from a fully verified pack", () => {
  const presentation = createVerifiedModelPresentation(pack, {
    resolution,
    defaultCatalogPageSize: 1
  });
  assert.deepEqual(presentation.descriptor.identity, {
    modelId: "fixture",
    modelVersion: "1",
    rootHash: pack.manifest.rootHash,
    manifestHash: pack.manifest.manifestHash
  });
  assert.equal(presentation.catalog().items.length, 1);
  assert.equal(presentation.catalog().items[0].description, undefined);
  assert.equal(presentation.inspect("a").record.description, "Only explicit inspection should expose this.");
});

test("engine rejects pack tampering and registry mismatch before exposing presentation data", () => {
  const tampered = structuredClone(pack);
  tampered.files["model/nodes.json"][0].name = "Changed";
  assert.throws(
    () => createVerifiedModelPresentation(tampered),
    (error) => error.code === "MODEL_PACK_VERIFICATION_FAILED"
  );
  assert.throws(
    () => createVerifiedModelPresentation(pack, {
      resolution: { ...resolution, manifestHash: `sha256:${"d".repeat(64)}` }
    }),
    (error) => error.code === "MODEL_PACK_REGISTRY_RESOLUTION_MISMATCH"
  );
});

test("engine presentation options reject accessors without invoking them", () => {
  let invoked = false;
  const options = {};
  Object.defineProperty(options, "resolution", {
    enumerable: true,
    get() {
      invoked = true;
      return resolution;
    }
  });
  assert.throws(
    () => createVerifiedModelPresentation(pack, options),
    (error) => error.code === "ENGINE_PRESENTATION_OPTIONS_INVALID"
  );
  assert.equal(invoked, false);
});

test("the verified presentation bridge has a browser-safe transitive module graph", async () => {
  const moduleMap = new Map([
    ["@onto2d/kernel/canonical", new URL("../../kernel/src/canonical-entry.js", import.meta.url)],
    ["@onto2d/model-pack", new URL("../../model-pack/src/index.js", import.meta.url)],
    ["@onto2d/model-pack/registry", new URL("../../model-pack/src/registry.js", import.meta.url)],
    ["@onto2d/view", new URL("../../view/src/index.js", import.meta.url)],
    ["@onto2d/view/lazy", new URL("../../view/src/lazy.js", import.meta.url)]
  ]);
  const pending = [new URL("../src/presentation.js", import.meta.url)];
  const visited = new Set();
  while (pending.length > 0) {
    const moduleUrl = pending.pop();
    if (visited.has(moduleUrl.href)) continue;
    visited.add(moduleUrl.href);
    const source = await readFile(moduleUrl, "utf8");
    assert.doesNotMatch(source, /(?:^|["'])node:/, moduleUrl.pathname);
    for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (moduleMap.has(specifier)) {
        pending.push(moduleMap.get(specifier));
      } else if (specifier.startsWith(".")) {
        pending.push(new URL(specifier, moduleUrl));
      } else {
        assert.fail(`unexpected presentation dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
});
