import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as catalogAdapter from "@onto2d/catalog-adapter";
import * as canonicalIdentityAnalysis from "@onto2d/canonical-identity-analysis";
import * as kernel from "@onto2d/kernel";
import * as engine from "@onto2d/engine";
import * as modelPack from "@onto2d/model-pack";
import * as modelPackNode from "@onto2d/model-pack/node";
import * as runStore from "@onto2d/run-store";
import * as schemas from "@onto2d/schemas";
import * as scientificAdapter from "@onto2d/scientific-adapter";

const PACKAGE_SURFACES = Object.freeze([
  Object.freeze({
    name: "canonical-identity-analysis",
    runtime: canonicalIdentityAnalysis,
    declarations: new URL("../../packages/canonical-identity-analysis/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "engine",
    runtime: engine,
    declarations: new URL("../../packages/engine/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "model-pack",
    runtime: modelPack,
    declarations: new URL("../../packages/model-pack/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "model-pack/node",
    runtime: modelPackNode,
    declarations: new URL("../../packages/model-pack/src/node.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "kernel",
    runtime: kernel,
    declarations: new URL("../../packages/kernel/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "schemas",
    runtime: schemas,
    declarations: new URL("../../packages/schemas/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "catalog-adapter",
    runtime: catalogAdapter,
    declarations: new URL("../../packages/catalog-adapter/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "scientific-adapter",
    runtime: scientificAdapter,
    declarations: new URL("../../packages/scientific-adapter/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "run-store",
    runtime: runStore,
    declarations: new URL("../../packages/run-store/src/index.d.ts", import.meta.url)
  })
]);

function declaredRuntimeValues(source) {
  return [...new Set(
    [...source.matchAll(/^export (?:declare )?(?:class|const|function)\s+([A-Za-z_$][\w$]*)/gm)]
      .map((match) => match[1])
  )].sort();
}

test("published workspace names resolve through their export maps", () => {
  const ref = `sha256:${"a".repeat(64)}`;
  const identity = kernel.canonicalizeCandidate({
    domain: "element-exact",
    nodes: [{ ref }, { ref }],
    edges: [{ from: 0, to: 1, role: "supports" }]
  });
  const adapter = scientificAdapter.defineScientificAdapter({
    id: "release-smoke-adapter",
    version: "1.0.0",
    method: "release-smoke",
    async evaluate(request) {
      return request;
    }
  });

  assert.match(identity.candidateId, /^sha256:[0-9a-f]{64}$/);
  assert.equal(schemas.SCHEMA_VERSION, "1");
  assert.ok(schemas.schemaUrls.candidate instanceof URL);
  assert.equal(typeof catalogAdapter.auditSourceCatalogue, "function");
  assert.equal(typeof runStore.writePackageRunArtifactBundle, "function");
  assert.equal(typeof engine.Onto2D.create, "function");
  assert.equal(typeof modelPack.verifyModelPack, "function");
  assert.equal(typeof modelPackNode.loadModelPackDirectory, "function");
  assert.equal(typeof canonicalIdentityAnalysis.verifyCanonicalIdentityArtifact, "function");
  assert.ok(Object.isFrozen(adapter));
});

test("every published runtime value has a TypeScript declaration", async () => {
  for (const entry of PACKAGE_SURFACES) {
    const declarations = declaredRuntimeValues(await readFile(entry.declarations, "utf8"));
    assert.deepEqual(Object.keys(entry.runtime).sort(), declarations, entry.name);
  }
});
