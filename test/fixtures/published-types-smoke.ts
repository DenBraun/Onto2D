import {
  canonicalizeCandidate,
  type CandidateId
} from "@onto2d/kernel";
import {
  canonicalize as portableCanonicalize,
  hashCanonical as portableHashCanonical
} from "@onto2d/kernel/canonical";
import { schemaUrls } from "@onto2d/schemas";
import { auditSourceCatalogue } from "@onto2d/catalog-adapter";
import { defineScientificAdapter } from "@onto2d/scientific-adapter";
import { writePackageRunArtifactBundle } from "@onto2d/run-store";
import { runCli, type RunCliOptions } from "@onto2d/cli";
import { buildModelPack, type ModelPack } from "@onto2d/model-pack";
import {
  loadModelPackBundle,
  loadModelPackHttpDirectory,
  type ModelPackBrowserBundleOptions,
  type ModelPackBrowserBundleSource,
  type ModelPackHttpDirectoryOptions
} from "@onto2d/model-pack/browser";
import {
  createIndexedDbModelPackCacheStorage,
  createMemoryModelPackCacheStorage,
  createVerifiedModelPackCache,
  modelPackCacheKey,
  type ModelPackCacheIdentity,
  type ModelPackCacheLoadResult,
  type ModelPackCacheStorage,
  type VerifiedModelPackCache
} from "@onto2d/model-pack/cache";
import {
  loadModelPackArchive,
  loadModelPackDirectory,
  loadModelPackPath,
  type ModelPackArchiveLimits,
  type ModelPackPathOptions
} from "@onto2d/model-pack/node";
import {
  loadModelPackRegistryHttp,
  matchModelPackRegistryResolution,
  resolveModelPackRegistry,
  resolveModelPackRegistryHttp,
  type ModelPackRegistry,
  type ModelPackRegistryHttpOptions,
  type ModelPackRegistryResolution,
  type ModelPackRegistrySelection,
  type ModelPackRegistrySnapshot
} from "@onto2d/model-pack/registry";
import {
  createModelPackWorkerClient,
  installModelPackWorkerEndpoint,
  type ModelPackWorkerBundleOptions,
  type ModelPackWorkerClient,
  type ModelPackWorkerHttpOptions,
  type ModelPackWorkerRequestMessage,
  type ModelPackWorkerResponseMessage
} from "@onto2d/model-pack/worker";
import {
  canonicalIdentityAnalysis,
  verifyCanonicalIdentityArtifact,
  type CanonicalIdentityArtifact
} from "@onto2d/canonical-identity-analysis";
import {
  Onto2D as EngineOnto2D,
  buildModelLineage,
  type Model,
  type ModelIdentity
} from "@onto2d/engine";
import {
  createVerifiedModelPresentation,
  type VerifiedModelPresentationOptions
} from "@onto2d/engine/presentation";
import { Onto2D as DefaultOnto2D } from "onto2d";
import { createModelView, layoutNeighborhood, wrapGraphNodeLabel, type NeighborhoodLayout } from "@onto2d/view";
import {
  createLazyModelPresentation,
  type ModelPresentationCatalogPage,
  type ModelPresentationNodeDetail
} from "@onto2d/view/lazy";
import {
  importNTriples,
  matchRdfImportSource,
  projectRdfImportGraph,
  verifyRdfImportArtifact,
  type RdfImportArtifact,
  type RdfImportOptions,
  type RdfNeutralGraph
} from "@onto2d/rdf-import";
import {
  compileShaclShapes,
  validateShacl,
  validateShaclPlan,
  verifyShaclPlan,
  verifyShaclValidationReport,
  type ShaclPlan,
  type ShaclValidationOptions,
  type ShaclValidationReport
} from "@onto2d/shacl-validation";
import {
  buildRdfMappedModelPack,
  createRdfMappingPolicy,
  mapRdfToOnto2D,
  verifyRdfMappingArtifact,
  verifyRdfMappingPolicy,
  type CreateRdfMappingPolicyInput,
  type RdfMappingArtifact,
  type RdfMappingPolicy
} from "@onto2d/rdf-mapping";

const ref = `sha256:${"a".repeat(64)}` as const;
const result = canonicalizeCandidate({
  domain: "element-exact",
  nodes: [{ ref }, { ref }],
  edges: [{ from: 0, to: 1, role: "supports" }]
});
const candidateId: CandidateId = result.candidateId;
const adapter = defineScientificAdapter({
  id: "typescript-smoke",
  version: "1.0.0",
  method: "identity",
  async evaluate(request: unknown) {
    return request;
  }
});

void candidateId;
void portableCanonicalize({ browser: true });
void portableHashCanonical("onto2d:artifact:v1", { browser: true });
void adapter;
void schemaUrls.candidate;
void auditSourceCatalogue;
void writePackageRunArtifactBundle;
const cliOptions: RunCliOptions = {
  cwd: ".",
  stdout: { write() {} },
  stderr: { write() {} }
};
const cliRun = runCli(["--version"], cliOptions);
void cliRun;
const modelPack: ModelPack = buildModelPack({
  model: { id: "types", name: "Types", version: "1" },
  source: { id: "types", files: [{ path: "types.json", hash: ref }] },
  nodes: [{ id: "a" }],
  edges: [],
  dictionaries: {}
});
const enginePromise = EngineOnto2D.create({
  models: [modelPack],
  analyses: [canonicalIdentityAnalysis]
});
const typedModel: Model | undefined = undefined;
const typedIdentity: ModelIdentity = {
  modelId: "types",
  modelVersion: "1",
  modelRootHash: modelPack.manifest.rootHash
};
const lineage = buildModelLineage({ from: typedIdentity, to: { ...typedIdentity, modelVersion: "2" }, events: [] });
const artifact: CanonicalIdentityArtifact | undefined = undefined;
void enginePromise;
void typedModel;
void lineage;
void artifact;
void verifyCanonicalIdentityArtifact;
void loadModelPackDirectory;
const archiveLimits: Partial<ModelPackArchiveLimits> = { maxCompressionRatio: 200 };
const pathOptions: ModelPackPathOptions = { archive: archiveLimits };
void loadModelPackArchive;
void loadModelPackPath;
void pathOptions;
const browserHttpOptions: ModelPackHttpDirectoryOptions = {
  bundle: "omit",
  maxFileBytes: 1024,
  maxTotalBytes: 8192
};
const browserBundleOptions: ModelPackBrowserBundleOptions = { maxBundleBytes: 8192 };
const browserBundleSource: ModelPackBrowserBundleSource = new Uint8Array();
void loadModelPackHttpDirectory;
void loadModelPackBundle;
void browserHttpOptions;
void browserBundleOptions;
void browserBundleSource;
const cacheIdentity: ModelPackCacheIdentity = {
  rootHash: modelPack.manifest.rootHash,
  manifestHash: modelPack.manifest.manifestHash
};
const memoryCacheStorage: ModelPackCacheStorage = createMemoryModelPackCacheStorage();
const verifiedCache: VerifiedModelPackCache = createVerifiedModelPackCache(memoryCacheStorage);
const cacheLoad: Promise<ModelPackCacheLoadResult> = verifiedCache.load(
  cacheIdentity,
  async () => modelPack
);
void createIndexedDbModelPackCacheStorage;
void modelPackCacheKey(cacheIdentity);
void cacheLoad;
const registryDocument: ModelPackRegistry = {
  format: "onto2d-model-pack-registry",
  formatVersion: "1",
  entries: [{
    modelId: "types",
    version: "1",
    rootHash: modelPack.manifest.rootHash,
    manifestHash: modelPack.manifest.manifestHash,
    packPath: "types/1/"
  }]
};
const registrySelection: ModelPackRegistrySelection = { modelId: "types", version: "1" };
const registryResolution: ModelPackRegistryResolution = resolveModelPackRegistry(
  registryDocument,
  "https://example.test/models/registry.json",
  registrySelection
);
const registryHttpOptions: ModelPackRegistryHttpOptions = {
  expectedRegistryHash: registryResolution.registryHash,
  maxRegistryBytes: 8192
};
const registrySnapshot: Promise<ModelPackRegistrySnapshot> = loadModelPackRegistryHttp(
  "https://example.test/models/registry.json",
  registryHttpOptions
);
void registrySnapshot;
void resolveModelPackRegistryHttp;
void matchModelPackRegistryResolution(modelPack, registryResolution);
void registryHttpOptions;
const workerHttpOptions: ModelPackWorkerHttpOptions = { timeoutMs: 30_000 };
const workerBundleOptions: ModelPackWorkerBundleOptions = {
  transfer: "copy",
  maxBundleBytes: 8192
};
const workerClientFactory: typeof createModelPackWorkerClient = createModelPackWorkerClient;
const workerEndpointFactory: typeof installModelPackWorkerEndpoint = installModelPackWorkerEndpoint;
const workerClient: ModelPackWorkerClient | undefined = undefined;
const workerRequest: ModelPackWorkerRequestMessage | undefined = undefined;
const workerResponse: ModelPackWorkerResponseMessage | undefined = undefined;
void workerHttpOptions;
void workerBundleOptions;
void workerClientFactory;
void workerEndpointFactory;
void workerClient;
void workerRequest;
void workerResponse;
void DefaultOnto2D.create();
const modelView = createModelView({ nodes: [{ id: "a" }], edges: [] });
const modelLayout: NeighborhoodLayout = layoutNeighborhood(
  modelView.neighborhood({ focusId: "a" })
);
const wrappedGraphLabel: readonly string[] = wrapGraphNodeLabel("A bounded graph label").lines;
void modelLayout;
void wrappedGraphLabel;
const verifiedPresentationOptions: VerifiedModelPresentationOptions = {
  resolution: registryResolution,
  defaultCatalogPageSize: 25
};
const verifiedPresentation = createVerifiedModelPresentation(modelPack, verifiedPresentationOptions);
const presentationPage: ModelPresentationCatalogPage = verifiedPresentation.catalog();
const presentationDetail: ModelPresentationNodeDetail = verifiedPresentation.inspect("a");
const presentationLayout = layoutNeighborhood(
  verifiedPresentation.neighborhood({ focusId: "a" })
);
const directPresentation = createLazyModelPresentation({
  identity: verifiedPresentation.descriptor.identity,
  nodes: [{ id: "a" }],
  edges: []
});
void presentationPage;
void presentationDetail;
void presentationLayout;
void directPresentation;
const rdfOptions: RdfImportOptions = { sourceId: "typescript-rdf" };
const rdfSource = "<https://example.test/a> <https://example.test/p> <https://example.test/b> .";
const rdfArtifact: Readonly<RdfImportArtifact> = importNTriples(rdfSource, rdfOptions);
const rdfGraph: Readonly<RdfNeutralGraph> = projectRdfImportGraph(rdfArtifact);
void verifyRdfImportArtifact(rdfArtifact);
void matchRdfImportSource(rdfArtifact, rdfSource);
void rdfGraph;
const emptyShapes = importNTriples("", { sourceId: "typescript-shapes" });
const shaclPlan: Readonly<ShaclPlan> = compileShaclShapes(emptyShapes);
const shaclOptions: ShaclValidationOptions = { maxResults: 100 };
const shaclReport: Readonly<ShaclValidationReport> = validateShacl(
  rdfArtifact,
  emptyShapes,
  shaclOptions
);
void verifyShaclPlan(emptyShapes, shaclPlan);
void validateShaclPlan(rdfArtifact, emptyShapes, shaclPlan);
void verifyShaclValidationReport(rdfArtifact, emptyShapes, shaclReport);
const mappingPolicyInput: CreateRdfMappingPolicyInput | undefined = undefined;
const mappingPolicy: RdfMappingPolicy | undefined = undefined;
const mappingArtifact: RdfMappingArtifact | undefined = undefined;
void mappingPolicyInput;
void mappingPolicy;
void mappingArtifact;
void createRdfMappingPolicy;
void verifyRdfMappingPolicy;
void mapRdfToOnto2D;
void verifyRdfMappingArtifact;
void buildRdfMappedModelPack;

import { runHistoryBenchmark, type HistoryBenchmarkContract, type HistoryBenchmarkInputs, type BenchmarkVerdict } from "@onto2d/history-benchmark";
declare const historyBenchmarkContract: HistoryBenchmarkContract;
declare const historyBenchmarkInputs: HistoryBenchmarkInputs;
const historyBenchmarkVerdict: BenchmarkVerdict = runHistoryBenchmark(historyBenchmarkContract, historyBenchmarkInputs).verdict;
void historyBenchmarkVerdict;

import { prepareHistoryRegression, type HistoryRegressionContract, type RegressionDataset, type RegressionTargets } from "@onto2d/history-benchmark/predictive";
declare const regressionContract: HistoryRegressionContract;
declare const regressionData: RegressionDataset;
declare const regressionTargets: RegressionTargets;
const predictionStatus: "prepared" | "incomplete" = prepareHistoryRegression(regressionContract, regressionData, regressionTargets).status;
void predictionStatus;
