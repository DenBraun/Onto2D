import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as cli from "@onto2d/cli";
import * as catalogAdapter from "@onto2d/catalog-adapter";
import * as canonicalIdentityAnalysis from "@onto2d/canonical-identity-analysis";
import * as kernel from "@onto2d/kernel";
import * as kernelCanonical from "@onto2d/kernel/canonical";
import * as levelZeroSolver from "@onto2d/level-zero-solver";
import * as engine from "@onto2d/engine";
import * as enginePresentation from "@onto2d/engine/presentation";
import * as modelPack from "@onto2d/model-pack";
import * as modelPackBrowser from "@onto2d/model-pack/browser";
import * as modelPackCache from "@onto2d/model-pack/cache";
import * as modelPackNode from "@onto2d/model-pack/node";
import * as modelPackRegistry from "@onto2d/model-pack/registry";
import * as modelPackWorker from "@onto2d/model-pack/worker";
import * as runStore from "@onto2d/run-store";
import * as rdfImport from "@onto2d/rdf-import";
import * as rdfMapping from "@onto2d/rdf-mapping";
import * as shaclValidation from "@onto2d/shacl-validation";
import * as schemas from "@onto2d/schemas";
import * as scientificAdapter from "@onto2d/scientific-adapter";
import * as view from "@onto2d/view";
import * as viewLazy from "@onto2d/view/lazy";

const PACKAGE_SURFACES = Object.freeze([
  Object.freeze({
    name: "cli",
    runtime: cli,
    declarations: new URL("../../packages/cli/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "level-zero-solver",
    runtime: levelZeroSolver,
    declarations: new URL("../../packages/level-zero-solver/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "view",
    runtime: view,
    declarations: new URL("../../packages/view/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "view/lazy",
    runtime: viewLazy,
    declarations: new URL("../../packages/view/src/lazy.d.ts", import.meta.url)
  }),
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
    name: "engine/presentation",
    runtime: enginePresentation,
    declarations: new URL("../../packages/engine/src/presentation.d.ts", import.meta.url)
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
    name: "model-pack/browser",
    runtime: modelPackBrowser,
    declarations: new URL("../../packages/model-pack/src/browser.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "model-pack/cache",
    runtime: modelPackCache,
    declarations: new URL("../../packages/model-pack/src/cache.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "model-pack/registry",
    runtime: modelPackRegistry,
    declarations: new URL("../../packages/model-pack/src/registry.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "model-pack/worker",
    runtime: modelPackWorker,
    declarations: new URL("../../packages/model-pack/src/worker.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "kernel",
    runtime: kernel,
    declarations: new URL("../../packages/kernel/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "kernel/canonical",
    runtime: kernelCanonical,
    declarations: new URL("../../packages/kernel/src/canonical-entry.d.ts", import.meta.url)
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
  }),
  Object.freeze({
    name: "rdf-import",
    runtime: rdfImport,
    declarations: new URL("../../packages/rdf-import/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "rdf-mapping",
    runtime: rdfMapping,
    declarations: new URL("../../packages/rdf-mapping/src/index.d.ts", import.meta.url)
  }),
  Object.freeze({
    name: "shacl-validation",
    runtime: shaclValidation,
    declarations: new URL("../../packages/shacl-validation/src/index.d.ts", import.meta.url)
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
  assert.equal(kernelCanonical.canonicalize({ b: 2, a: 1 }), "{\"a\":1,\"b\":2}");
  assert.equal(typeof kernelCanonical.hashCanonical, "function");
  assert.equal(typeof kernelCanonical.hashArtifactBytes, "function");
  assert.equal(schemas.SCHEMA_VERSION, "1");
  assert.ok(schemas.schemaUrls.candidate instanceof URL);
  assert.equal(typeof catalogAdapter.auditSourceCatalogue, "function");
  assert.equal(typeof runStore.writePackageRunArtifactBundle, "function");
  assert.equal(typeof cli.runCli, "function");
  assert.equal(cli.CLI_EXIT_CODES.data, 3);
  assert.equal(typeof engine.Onto2D.create, "function");
  assert.equal(typeof engine.createVerifiedModelPresentation, "function");
  assert.equal(typeof enginePresentation.createVerifiedModelPresentation, "function");
  assert.equal(typeof modelPack.verifyModelPack, "function");
  assert.equal(typeof modelPackBrowser.loadModelPackHttpDirectory, "function");
  assert.equal(typeof modelPackBrowser.loadModelPackBundle, "function");
  assert.equal(modelPackBrowser.MODEL_PACK_BROWSER_LIMITS.maxFileBytes, 16 * 1024 * 1024);
  assert.equal(typeof modelPackCache.createVerifiedModelPackCache, "function");
  assert.equal(typeof modelPackCache.createMemoryModelPackCacheStorage, "function");
  assert.equal(typeof modelPackCache.createIndexedDbModelPackCacheStorage, "function");
  assert.equal(modelPackCache.MODEL_PACK_CACHE_FORMAT_VERSION, "1");
  assert.equal(typeof modelPackRegistry.resolveModelPackRegistry, "function");
  assert.equal(typeof modelPackRegistry.resolveModelPackRegistryHttp, "function");
  assert.equal(typeof modelPackRegistry.matchModelPackRegistryResolution, "function");
  assert.equal(modelPackRegistry.MODEL_PACK_REGISTRY_FORMAT_VERSION, "1");
  assert.equal(typeof modelPackWorker.createModelPackWorkerClient, "function");
  assert.equal(typeof modelPackWorker.installModelPackWorkerEndpoint, "function");
  assert.equal(modelPackWorker.MODEL_PACK_WORKER_PROTOCOL.version, "1");
  assert.equal(typeof modelPackNode.loadModelPackDirectory, "function");
  assert.equal(typeof modelPackNode.loadModelPackArchive, "function");
  assert.equal(typeof modelPackNode.loadModelPackPath, "function");
  assert.equal(modelPackNode.MODEL_PACK_ARCHIVE_LIMITS.maxCompressionRatio, 200);
  assert.equal(typeof canonicalIdentityAnalysis.verifyCanonicalIdentityArtifact, "function");
  assert.equal(typeof view.layoutNeighborhood, "function");
  assert.equal(typeof viewLazy.createLazyModelPresentation, "function");
  assert.equal(viewLazy.MODEL_PRESENTATION_FORMAT_VERSION, "1");
  assert.equal(typeof rdfImport.importNTriples, "function");
  assert.equal(typeof rdfImport.verifyRdfImportArtifact, "function");
  assert.equal(typeof rdfImport.projectRdfImportGraph, "function");
  assert.equal(rdfImport.RDF_IMPORT_PROFILE_ID, "rdf11-n-triples-safe-v1");
  assert.equal(typeof rdfMapping.createRdfMappingPolicy, "function");
  assert.equal(typeof rdfMapping.mapRdfToOnto2D, "function");
  assert.equal(typeof rdfMapping.buildRdfMappedModelPack, "function");
  assert.equal(rdfMapping.RDF_MAPPING_PROFILE_ID, "rdf-to-model-pack-explicit-v1");
  assert.equal(typeof shaclValidation.compileShaclShapes, "function");
  assert.equal(typeof shaclValidation.validateShacl, "function");
  assert.equal(shaclValidation.SHACL_VALIDATION_PROFILE_ID, "shacl10-core-structural-v1");
  assert.equal(typeof levelZeroSolver.levelZeroReferenceSolver.evaluate, "function");
  assert.equal(levelZeroSolver.levelZeroReferenceSolver.id, "onto2d-level-0-reference-solver");
  assert.ok(Object.isFrozen(adapter));
});

test("every published runtime value has a TypeScript declaration", async () => {
  for (const entry of PACKAGE_SURFACES) {
    const declarations = declaredRuntimeValues(await readFile(entry.declarations, "utf8"));
    assert.deepEqual(Object.keys(entry.runtime).sort(), declarations, entry.name);
  }
});
