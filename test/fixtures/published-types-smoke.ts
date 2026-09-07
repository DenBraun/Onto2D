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
  prepareOllivierRequest, acceptOllivierResponse, verifyOllivierArtifact,
  createOllivierAnalyzer, createOllivierAnalysis, type OllivierArtifact, type OllivierInput
} from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { prepareStructuralFlow, createStructuralFlowAnalyzer, createStructuralFlowAnalysis,
  verifyStructuralFlowArtifact, type StructuralFlowArtifact, type StructuralFlowInput,
  type StructuralFlowTransportRequest, type StructuralFlowTransportResponse } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS, createStructuralMetricContext, createStructuralMetricProvider,
  buildStructuralProvider, verifyStructuralProviderArtifact, requireStructuralMetricValues,
  analyzeStructuralGeometryWithProvider, verifyStructuralProviderAnalysis, createStructuralMetricProviderAnalysis,
  createStructuralProviderAnalysis, type StructuralMetricProvider, type StructuralMetricContext } from "@onto2d/structural-geometry/providers";
import {
  analyzeStructuralMetricExperiment, verifyStructuralMetricExperiment,
  auditStructuralWeights, verifyStructuralWeightAudit, structuralMetricExperimentAnalysis,
  type StructuralMetricExperiment, type StructuralWeightAudit
} from "@onto2d/structural-geometry/experiments";
import {
  analyzeStructuralGeometry,
  projectStructuralGeometry,
  verifyStructuralProjection,
  verifyStructuralGeometryArtifact,
  structuralGeometryAnalysis,
  type StructuralGeometryArtifact,
  type StructuralProjection
} from "@onto2d/structural-geometry";
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
  analyses: [canonicalIdentityAnalysis, structuralGeometryAnalysis, structuralMetricExperimentAnalysis]
});
const metricExperiment: StructuralMetricExperiment = analyzeStructuralMetricExperiment(modelPack, {
  metricPolicyId: "inverse-target-share-v1", selection: { kind: "necessity", through: "enabling" }
});
const metricAudit: StructuralWeightAudit = verifyStructuralWeightAudit(auditStructuralWeights(modelPack), modelPack);
const replayedExperiment = verifyStructuralMetricExperiment(metricExperiment, modelPack, metricExperiment.request);
const intervalTicks: string = replayedExperiment.result.summary.sum.lowerTicks;
// @ts-expect-error Typed experimental channels do not scalarize necessity.
analyzeStructuralMetricExperiment(modelPack, { selection: { kind: "channel", field: "necessity", value: 1 } });
// @ts-expect-error Interval bounds are immutable decimal integer strings.
metricExperiment.result.edges[0].curvature.lowerTicks = "0";
void metricAudit;
void intervalTicks;
const structuralProjection: StructuralProjection = projectStructuralGeometry(modelPack);
const providerContext: StructuralMetricContext = createStructuralMetricContext(modelPack);
const unitProvider: StructuralMetricProvider<"unit-v1"> = createStructuralMetricProvider("unit-v1");
const providedMetric = unitProvider.build(providerContext.projection, providerContext);
const providerLength: string = providedMetric.result.edges[0].length.numerator;
const providedChannels = createStructuralMetricProvider("typed-channel-v1").build(providerContext.projection, providerContext,
  { field: "interactionModeIds", values: [0, 1] });
const providerEnvelope = analyzeStructuralGeometryWithProvider(modelPack, { analysis: "structural-metric-experiment", metricProviderId: "inverse-target-share-v1" });
const providerEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralMetricProviderAnalysis(), createStructuralProviderAnalysis()] });
// @ts-expect-error An unverified structural lookalike has no metric-context brand.
const forgedProviderContext: StructuralMetricContext = { projection: structuralProjection, binding: providerContext.binding };
// @ts-expect-error Discrete channels do not expose edge lengths.
providedChannels.result.edges[0].length;
// @ts-expect-error A typed-channel provider requires explicit parameters.
createStructuralMetricProvider("typed-channel-v1").build(providerContext.projection, providerContext);
// @ts-expect-error Provider geometry is deeply readonly.
providedMetric.result.edges[0].length.numerator = "0";
// @ts-expect-error Filtration cannot be requested as a numeric metric provider.
analyzeStructuralGeometryWithProvider(modelPack, { analysis: "structural-metric-experiment", metricProviderId: "necessity-filtration-v1" });
void providerLength; void providerEnvelope; void providerEngine; void forgedProviderContext;
void STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS; void buildStructuralProvider; void verifyStructuralProviderArtifact;
void requireStructuralMetricValues; void verifyStructuralProviderAnalysis;
const ollivierInput: OllivierInput = { scope: { kind: "induced", nodeIds: ["a", "b"] }, edgeIds: ["a->b"], idleness: "half" };
const ollivierRequest = prepareOllivierRequest(modelPack, ollivierInput);
const ollivierAdapter = createPythonOllivierAdapter({ timeoutMs: 20000 });
const ollivierAnalyzer = createOllivierAnalyzer(ollivierAdapter, { maxCacheEntries: 8 });
const ollivierArtifact: Promise<OllivierArtifact> = ollivierAnalyzer.analyze(modelPack, ollivierInput);
const ollivierAnalysis = createOllivierAnalysis(ollivierAdapter);
const ollivierEngine = EngineOnto2D.create({ models: [modelPack], analyses: [ollivierAnalysis] });
// @ts-expect-error Supports are immutable.
ollivierRequest.problems[0].sourceMeasure[0].units = 2;
// @ts-expect-error Idleness values belong to a closed policy.
prepareOllivierRequest(modelPack, { edgeIds: ["a->b"], idleness: 0.5 });
void ollivierArtifact;
void ollivierEngine;
void acceptOllivierResponse;
void verifyOllivierArtifact;
const flowInput: StructuralFlowInput = { maxIterations: 8, step: "half", idleness: "half",
  tolerance: { numerator: "1", denominator: "1000000" }, cut: { kind: "final-length", threshold: { numerator: "2", denominator: "1" } } };
const flowRequest = prepareStructuralFlow(modelPack, flowInput);
const flowAdapter = createPythonStructuralFlowAdapter({ timeoutMs: 20000 });
const flowArtifact: Promise<StructuralFlowArtifact> = createStructuralFlowAnalyzer(flowAdapter).analyze(modelPack, flowInput);
const flowEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralFlowAnalysis(flowAdapter)] });
declare const flowTransport: StructuralFlowTransportRequest;
const flowResponse: StructuralFlowTransportResponse | Promise<StructuralFlowTransportResponse> = flowAdapter.evaluate(flowTransport);
// @ts-expect-error normalized parameters are deeply readonly
flowRequest.parameters.initialLengths[0].length.numerator = "2";
// @ts-expect-error steps are declared symbolic policies
prepareStructuralFlow(modelPack, { step: 0.5 });
void flowArtifact; void flowEngine; void flowResponse; void verifyStructuralFlowArtifact;
const structuralArtifact: StructuralGeometryArtifact = analyzeStructuralGeometry(modelPack, { metricPolicyId: "unit-v1" });
const checkedProjection: StructuralProjection = verifyStructuralProjection(structuralProjection, modelPack);
const checkedGeometry: StructuralGeometryArtifact = verifyStructuralGeometryArtifact(structuralArtifact, modelPack);
const exactGeometryManifest: string = checkedGeometry.model.manifestHash;
const exactMeanNumerator: number | undefined = checkedGeometry.result.summary.mean?.numerator;
// @ts-expect-error Geometry is immutable, including nested result values.
structuralArtifact.result.edges[0].curvature = 9;
// @ts-expect-error The first implementation does not accept weighted metrics.
analyzeStructuralGeometry(modelPack, { metricPolicyId: "weighted" });
void checkedProjection;
void exactGeometryManifest;
void exactMeanNumerator;
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

// R3 contract preparation is additive; it cannot be mistaken for a measured comparison.
import { DISTINGUISHABILITY_REGIMES, getDistinguishabilityRegime, verifyDistinguishabilityRegime,
  prepareStructuralRegime, verifyStructuralRegimePreparation, verifyStructuralObservationSpec,
  createStructuralRegimePreparationAnalysis, type StructuralRegimePreparation } from "@onto2d/structural-geometry/regimes";
const regimeContract = getDistinguishabilityRegime("canonical-structure-v1");
verifyDistinguishabilityRegime(regimeContract, "canonical-structure-v1");
const regimePreparation: StructuralRegimePreparation = prepareStructuralRegime(modelPack,
  { regimeId: "canonical-structure-v1", scope: { kind: "induced", nodeIds: ["a", "b"] } });
verifyStructuralRegimePreparation(regimePreparation, modelPack, regimePreparation.request);
verifyStructuralObservationSpec(regimePreparation.observableSpecs[0], regimePreparation.observableSpecs[0].id);
const regimeEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralRegimePreparationAnalysis()] });
// @ts-expect-error A preparation does not contain a measured distance.
regimePreparation.distance;
// @ts-expect-error Observations are immutable contract descriptors.
regimePreparation.observableSpecs[0].mandatory = false;
// @ts-expect-error Policy identities are readonly.
DISTINGUISHABILITY_REGIMES[0].matchingPolicy.contentHash = "sha256:changed";
// @ts-expect-error No implicit default regime.
prepareStructuralRegime(modelPack, {});
// @ts-expect-error Future history regimes are not implemented.
getDistinguishabilityRegime("history-aware-v1");
// @ts-expect-error Induced scope requires explicit node membership.
prepareStructuralRegime(modelPack, { regimeId: "topology-only-v1", scope: { kind: "induced" } });
void regimeEngine;

// SG2-011 provides a measured exact observation without a comparison API.
import { observeCanonicalStructure, verifyCanonicalStructureObservation, createCanonicalStructureObservationAnalysis,
  CANONICAL_STRUCTURE_IMPLEMENTATION, type CanonicalStructureObservation } from "@onto2d/structural-geometry/canonical";
const canonicalObservation: CanonicalStructureObservation = observeCanonicalStructure(modelPack,
  { regimeId: "canonical-structure-v1", scope: { kind: "induced", nodeIds: ["a", "b"] } });
verifyCanonicalStructureObservation(canonicalObservation, modelPack, { regimeId: "canonical-structure-v1" });
const canonicalValueHash: string = canonicalObservation.observation.valueHash;
const canonicalEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createCanonicalStructureObservationAnalysis()] });
// @ts-expect-error Canonical values are readonly.
canonicalObservation.observation.value.edges[0].from = 2;
// @ts-expect-error Matching witnesses are readonly provenance.
canonicalObservation.witness.nodes[0].canonicalNode = 1;
// @ts-expect-error This observation does not contain a distance or comparison status.
canonicalObservation.distance;
// @ts-expect-error The topology evaluator is a separate subsequent task.
observeCanonicalStructure(modelPack, { regimeId: "topology-only-v1" });
// @ts-expect-error An explicit regime is required.
observeCanonicalStructure(modelPack, {});
// @ts-expect-error Implementation content identities are immutable.
CANONICAL_STRUCTURE_IMPLEMENTATION.contentHash = "sha256:changed";
void canonicalValueHash; void canonicalEngine;

import { canonicalizeCandidate as portableGraphCanonicalize,
  type GraphCanonicalizationOptions as PortableGraphOptions } from "@onto2d/kernel/graph-canonicalizer";
const portableGraphOptions: PortableGraphOptions = { policy: { connected: false }, limits: { maxNodes: 6 } };
const portableGraphResult = portableGraphCanonicalize({ domain: "single-candidate",
  nodes: [{ ref: `sha256:${"a".repeat(64)}` }], edges: [] }, portableGraphOptions);
void portableGraphResult;

import { observeStructuralTopology, verifyStructuralTopologyObservation, createStructuralTopologyObservationAnalysis,
  TOPOLOGY_OBSERVATION_IMPLEMENTATION, type StructuralTopologyObservation } from "@onto2d/structural-geometry/topology";
const topologyObservation: StructuralTopologyObservation = observeStructuralTopology(modelPack,
  { regimeId: "topology-only-v1", scope: { kind: "induced", nodeIds: ["a", "b"] } });
verifyStructuralTopologyObservation(topologyObservation, modelPack, { regimeId: "topology-only-v1" });
const reachablePairs: number = topologyObservation.observation.value.reachableOrderedPairCount;
const topologyEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralTopologyObservationAnalysis()] });
// @ts-expect-error Observation component vectors are immutable.
topologyObservation.observation.value.weakComponentSizes.push(4);
// @ts-expect-error Diagnostic memberships are immutable.
topologyObservation.diagnostics.strongComponents[0][0] = "other";
// @ts-expect-error This observation API does not promise a comparison distance.
topologyObservation.distance;
// @ts-expect-error The evaluator requires explicit topology selection.
observeStructuralTopology(modelPack, {});
// @ts-expect-error The topology evaluator does not implement the typed regime.
observeStructuralTopology(modelPack, { regimeId: "typed-relations-v1" });
// @ts-expect-error Built-in observable-to-field bindings are immutable.
TOPOLOGY_OBSERVATION_IMPLEMENTATION.valueFields[0].field = "edgeCount";
void reachablePairs; void topologyEngine;

import { observeTypedRelations, verifyTypedRelationsObservation, createTypedRelationsObservationAnalysis,
  createStructuralVocabularyMapping, verifyStructuralVocabularyMapping, alignTypedRelations, verifyTypedRelationsAlignment,
  type TypedRelationsObservation, type StructuralVocabularyMappingInput } from "@onto2d/structural-geometry/typed";
const typedInput = { regimeId: "typed-relations-v1" as const };
const typedObservation: TypedRelationsObservation = observeTypedRelations(modelPack, typedInput);
verifyTypedRelationsObservation(typedObservation, modelPack, typedInput);
if (typedObservation.observations[1].availability === "observed") {
  const typedEdges = typedObservation.observations[1].value.edges;
  // @ts-expect-error Typed sets are immutable.
  typedEdges[0].types.causalDirectionIds.push(2);
  void typedEdges;
} else {
  const missingTypedValue: null = typedObservation.observations[1].value;
  void missingTypedValue;
}
const mappingInput: StructuralVocabularyMappingInput = { id: "type-smoke", version: "1",
  fields: { dependencyTypeId: [{ left: 0, right: 10 }], interactionModeIds: [], causalDirectionIds: [],
    ontologicalRole: [{ left: "arising", right: "arising" }], necessity: [] },
  reviewEvidence: { reference: "type-smoke-only", contentHash: modelPack.manifest.rootHash } };
const vocabularyMapping = createStructuralVocabularyMapping(modelPack, modelPack, mappingInput);
verifyStructuralVocabularyMapping(vocabularyMapping, modelPack, modelPack, mappingInput);
const typedAlignment = alignTypedRelations(modelPack, typedInput, modelPack, typedInput, { mapping: vocabularyMapping });
verifyTypedRelationsAlignment(typedAlignment, modelPack, typedInput, modelPack, typedInput, { mapping: vocabularyMapping });
if (typedAlignment.aligned) {
  const normalizedCode: number = typedAlignment.aligned.right.value.edges[0].types.dependencyTypeId;
  void normalizedCode;
}
const typedEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createTypedRelationsObservationAnalysis()] });
// @ts-expect-error Observation values do not assert a pairwise comparison status.
typedObservation.status;
// @ts-expect-error Vocabulary alignment does not supply a distance.
typedAlignment.distance;
// @ts-expect-error This evaluator requires an explicit typed regime.
observeTypedRelations(modelPack, { regimeId: "canonical-structure-v1" });
// @ts-expect-error An approval hash requires its corresponding mapping artifact.
alignTypedRelations(modelPack, typedInput, modelPack, typedInput, { approvedMappingHash: vocabularyMapping.artifactHash });
// @ts-expect-error Mapping code values are scalar atoms, not sets.
mappingInput.fields.interactionModeIds[0].left = [0];
// @ts-expect-error Mapping endpoints and declarations are immutable.
vocabularyMapping.left.dictionaryHash = modelPack.manifest.rootHash;
void typedEngine;

import { compareStructuralModels, verifyStructuralComparison, createStructuralComparisonAnalysis,
  STRUCTURAL_COMPARISON_POLICY, type StructuralComparison, type StructuralComparisonInput } from "@onto2d/structural-geometry/comparison";
const comparisonInput: StructuralComparisonInput = { regimeId: "typed-relations-v1",
  vocabulary: { mapping: vocabularyMapping, approvedMappingHash: vocabularyMapping.artifactHash },
  evidenceGaps: [{ side: "left", observableId: "canonical-typed-directed-structure-v1", disposition: "rejected",
    reference: "type-smoke-only", contentHash: modelPack.manifest.rootHash }] };
const comparison: StructuralComparison = compareStructuralModels(modelPack, modelPack, comparisonInput);
verifyStructuralComparison(comparison, modelPack, modelPack, comparisonInput);
if (comparison.status === "indeterminate") {
  const noDistance: null = comparison.distance;
  const incomplete: false = comparison.coverage.complete;
  void noDistance; void incomplete;
} else if (comparison.status === "indistinguishable-under-regime") {
  const exactZero: 0 = comparison.distance; void exactZero;
} else {
  const exactOne: 1 = comparison.distance; void exactOne;
}
for (const component of comparison.components) {
  if (component.state === "indeterminate") {
    const absent: null = component.values; void absent;
  } else {
    const accepted: "accepted" = component.left.disposition; void accepted;
  }
}
const comparisonEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralComparisonAnalysis(modelPack)] });
// @ts-expect-error All three regimes require explicit selection.
compareStructuralModels(modelPack, modelPack, {});
// @ts-expect-error Vocabulary options belong to typed comparisons only.
compareStructuralModels(modelPack, modelPack, { regimeId: "canonical-structure-v1", vocabulary: {} });
// @ts-expect-error Summary observables do not belong to the typed profile.
compareStructuralModels(modelPack, modelPack, { regimeId: "typed-relations-v1", evidenceGaps: [{ side: "left", observableId: "node-count-v1", disposition: "unavailable", reference: "test", contentHash: modelPack.manifest.rootHash }] });
// @ts-expect-error Result coverage is immutable.
comparison.coverage.numerator = 2;
// @ts-expect-error Partial-distance policy is immutable and unsupported.
STRUCTURAL_COMPARISON_POLICY.partialDistance = "supported";
void comparisonEngine;

import { runStructuralProbeSandbox, verifyStructuralProbeSandbox, createStructuralProbeSandboxAnalysis,
  STRUCTURAL_PROBE_SANDBOX_POLICY, type StructuralProbeSandboxInput, type StructuralProbeSandboxArtifact } from "@onto2d/structural-geometry/sandbox";
const sandboxInput: StructuralProbeSandboxInput = { regimeId: "typed-relations-v1",
  transformation: { kind: "reverse-edges", targets: "each-scoped-edge" } };
const sandbox: StructuralProbeSandboxArtifact = runStructuralProbeSandbox(modelPack, sandboxInput);
verifyStructuralProbeSandbox(sandbox, modelPack, sandboxInput);
if (sandbox.execution.state === "unavailable") {
  const zeroTargets: 0 = sandbox.execution.targetCount; void zeroTargets;
}
for (const run of sandbox.runs) {
  if (run.execution === "applied") {
    const edgeCount: number = run.graph.edges.length; void edgeCount;
    for (const mapping of run.edgeMapping) if (mapping.action === "removed") {
      const noAfterEdge: null = mapping.afterEdgeId; void noAfterEdge;
    }
    // @ts-expect-error Graph and typed annotations remain immutable.
    run.graph.edges[0].types!.interactionModeIds!.push(1);
  } else {
    const noGraph: null = run.graph;
    const conflict: readonly [string, string] = run.rejection.sourceEdgeIds;
    void noGraph; void conflict;
  }
}
const sandboxEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralProbeSandboxAnalysis()] });
// @ts-expect-error Regime selection is required.
runStructuralProbeSandbox(modelPack, { transformation: { kind: "identity" } });
// @ts-expect-error Identity does not accept edge target options.
runStructuralProbeSandbox(modelPack, { regimeId: "topology-only-v1", transformation: { kind: "identity", targets: "all-scoped-edges" } });
// @ts-expect-error Arbitrary source-ID target selection is unsupported.
runStructuralProbeSandbox(modelPack, { regimeId: "topology-only-v1", transformation: { kind: "remove-edges", targets: ["e0"] } });
// @ts-expect-error Sandbox execution does not supply comparison scores.
sandbox.distance;
// @ts-expect-error Work bounds are frozen.
STRUCTURAL_PROBE_SANDBOX_POLICY.limits.maxTargets = 64;
void sandboxEngine;

import { runStructuralInvarianceProbes, verifyStructuralInvarianceProbes, createStructuralInvarianceAnalysis,
  STRUCTURAL_INVARIANCE_REGISTRY, STRUCTURAL_INVARIANCE_POLICY, STRUCTURAL_SHADOW_OBSERVATION_ADAPTER,
  type StructuralInvarianceInput, type StructuralInvarianceArtifact } from "@onto2d/structural-geometry/invariance";
const invarianceInput: StructuralInvarianceInput = { regimeId: "typed-relations-v1" };
const invariance: StructuralInvarianceArtifact = runStructuralInvarianceProbes(modelPack, invarianceInput);
verifyStructuralInvarianceProbes(invariance, modelPack, invarianceInput);
for (const observation of invariance.runs[0].observation.observations) {
  if (observation.availability === "missing") {
    const missingValue: null = observation.value;
    const field: string = observation.missing[0].field; void missingValue; void field;
  } else {
    const valueHash: string = observation.valueHash; void valueHash;
  }
}
const invarianceEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralInvarianceAnalysis()] });
// @ts-expect-error All four probes are mandatory; callers cannot select a subset.
runStructuralInvarianceProbes(modelPack, { regimeId: "typed-relations-v1", probes: [] });
// @ts-expect-error An explicit regime is required.
runStructuralInvarianceProbes(modelPack, {});
// @ts-expect-error Measured profiles are immutable.
invariance.runs[0].observation.observations.push({});
// @ts-expect-error Registry parameters are frozen.
STRUCTURAL_INVARIANCE_REGISTRY.probes[1].parameters.namespace = "other";
// @ts-expect-error Work limits are frozen.
STRUCTURAL_INVARIANCE_POLICY.limits.maxRepresentations = 6;
// @ts-expect-error Presentation exclusion is fixed by the adapter contract.
STRUCTURAL_SHADOW_OBSERVATION_ADAPTER.presentation = "included";
// @ts-expect-error Invariance checks do not produce a response distance.
invariance.distance;
void invarianceEngine;

import { runStructuralResponseProbes, verifyStructuralResponseProbes, createStructuralResponseAnalysis,
  STRUCTURAL_RESPONSE_POLICY, STRUCTURAL_RESPONSE_REGISTRY, STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER,
  type StructuralResponseInput, type StructuralResponseArtifact } from "@onto2d/structural-geometry/responses";
const responseInput: StructuralResponseInput = { regimeId: "typed-relations-v1" };
const responses: StructuralResponseArtifact = runStructuralResponseProbes(modelPack, responseInput);
verifyStructuralResponseProbes(responses, modelPack, responseInput);
for (const probe of responses.probes) {
  if (probe.execution.state === "unavailable") {
    const zeroResponseTargets: 0 = probe.execution.targetCount; void zeroResponseTargets;
  }
  for (const run of probe.runs) {
    if (run.execution === "rejected") {
      const absentResponse: null = run.response;
      const absentObservation: null = run.observation; void absentResponse; void absentObservation;
    } else {
      const delta: number | null = run.response.components[0].delta; void delta;
      for (const observed of run.observation.observations) if (observed.availability === "missing") {
        const absentValue: null = observed.value; void absentValue;
      }
      // @ts-expect-error Derived graph records are readonly.
      run.graph.edges.push({});
    }
  }
  for (const row of probe.summary.diagnostics.effectHistogram) if (row.effect.status === "rejected") {
    const noResponseComponents: null = row.effect.components; void noResponseComponents;
  }
}
const responseEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralResponseAnalysis()] });
// @ts-expect-error Compatible probe selection is fixed by the registry.
runStructuralResponseProbes(modelPack, { regimeId: "typed-relations-v1", probeIds: [] });
// @ts-expect-error The regime must be explicit.
runStructuralResponseProbes(modelPack, {});
// @ts-expect-error Response results do not supply a signature distance.
responses.distance;
// @ts-expect-error Registry selectors are frozen.
STRUCTURAL_RESPONSE_REGISTRY.probes[0].selector = "first-edge";
// @ts-expect-error Exhaustive work bounds cannot be raised by the caller.
STRUCTURAL_RESPONSE_POLICY.limits.maxTargets = 65;
// @ts-expect-error Adapter semantics are fixed.
STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER.vocabulary = "any-source";
void responseEngine;

import { runStructuralResponseSignature, verifyStructuralResponseSignature, createStructuralResponseSignatureAnalysis,
  STRUCTURAL_RESPONSE_SIGNATURE_POLICY, type StructuralResponseSignatureInput, type StructuralResponseSignatureArtifact }
  from "@onto2d/structural-geometry/signature";
const responseSignatureInput: StructuralResponseSignatureInput = { regimeId: "typed-relations-v1" };
const responseSignature: StructuralResponseSignatureArtifact = runStructuralResponseSignature(modelPack, responseSignatureInput);
verifyStructuralResponseSignature(responseSignature, modelPack, responseSignatureInput);
for (const feature of responseSignature.features) {
  if (feature.state === "indeterminate") {
    const noFeatureValue: null = feature.value; const noFeatureHash: null = feature.valueHash; void noFeatureValue; void noFeatureHash;
  } else {
    const featureCount: number = feature.value[0].count; void featureCount;
    // @ts-expect-error Feature rows and their joint components are readonly.
    feature.value[0].components[0].delta = 42;
  }
}
const responseSignatureEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralResponseSignatureAnalysis()] });
// @ts-expect-error Signature policy is fixed before evaluation.
STRUCTURAL_RESPONSE_SIGNATURE_POLICY.limits.maxFeatures = 6;
// @ts-expect-error Callers cannot drop difficult feature families.
runStructuralResponseSignature(modelPack, { regimeId: "typed-relations-v1", features: [] });
// @ts-expect-error Signatures have no distance before the separate R6 gate.
responseSignature.distance;
// @ts-expect-error Complete source evidence remains readonly.
responseSignature.evidence.responses.probes.pop();
void responseSignatureEngine;

import { compareStructuralSignatures, verifyStructuralPseudometric, createStructuralPseudometricAnalysis,
  STRUCTURAL_PSEUDOMETRIC_POLICY, type StructuralPseudometricArtifact, type StructuralPseudometricInput }
  from "@onto2d/structural-geometry/pseudometric";
const pseudometricInput: StructuralPseudometricInput = { regimeId: "topology-only-v1", diagnostics: "partial-with-coverage" };
const pseudometric: StructuralPseudometricArtifact = compareStructuralSignatures(modelPack, modelPack, pseudometricInput);
verifyStructuralPseudometric(pseudometric, modelPack, modelPack, pseudometricInput);
if (pseudometric.status === "indeterminate") {
  const absentDistance: null = pseudometric.distance; void absentDistance;
} else {
  const exactNumerator: number = pseudometric.distance.numerator; void exactNumerator;
}
if (pseudometric.diagnostics.partial) {
  const guarantee: "none" = pseudometric.diagnostics.partial.guarantee; void guarantee;
}
const pseudometricEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createStructuralPseudometricAnalysis(modelPack)] });
// @ts-expect-error Components and weights are fixed by the versioned profile.
compareStructuralSignatures(modelPack, modelPack, { regimeId: "topology-only-v1", weights: [1] });
// @ts-expect-error A pairwise mapping does not establish a common metric domain.
compareStructuralSignatures(modelPack, modelPack, { regimeId: "typed-relations-v1", vocabulary: {} });
// @ts-expect-error Distances are exact fractions or null, never implicit floating values.
const approximatePseudometric: number = pseudometric.distance;
// @ts-expect-error Evidence is deeply readonly.
pseudometric.evidence.left.features.pop();
// @ts-expect-error Fixed policy limits cannot be mutated.
STRUCTURAL_PSEUDOMETRIC_POLICY.limits.maxComponents = 6;
void pseudometricEngine; void approximatePseudometric;

import { buildGeometricSignature, verifyGeometricSignature, createGeometricSignatureAnalysis,
  GEOMETRIC_SIGNATURE_POLICY, type GeometricSignatureInput, type GeometricSignatureEvidence, type GeometricSignatureArtifact }
  from "@onto2d/structural-geometry/geometric-signature";
const geometricInput: GeometricSignatureInput = { forman: { analysis: "structural-geometry", metricProviderId: "unit-v1" }, ollivier: null, flow: null };
const geometricEvidence: GeometricSignatureEvidence = { ollivier: null, flow: null };
const geometricSignature: GeometricSignatureArtifact = buildGeometricSignature(modelPack, geometricInput, geometricEvidence);
verifyGeometricSignature(geometricSignature, modelPack, geometricInput, geometricEvidence);
const formanState: "observed" | "unavailable" = geometricSignature.features[0].state;
void formanState;
for (const feature of geometricSignature.features) {
  if (feature.state === "observed") {
    const completeGeometry: true = feature.coverage.complete; void completeGeometry;
  } else if (feature.state === "unavailable") {
    const noGeometrySamples: 0 = feature.coverage.numerator; void noGeometrySamples;
  } else {
    const partialGeometry: false = feature.coverage.complete; void partialGeometry;
    if (feature.id === "ollivier-curvature-v1") {
      const partialEdges: "partial-edge-coverage" = feature.reasons[0]; void partialEdges;
    } else {
      const partialFlow: "flow-trajectory-v1" = feature.id; void partialFlow;
      // @ts-expect-error Flow incompleteness comes from an unobserved trajectory tail.
      const wrongFlowReason: "partial-edge-coverage" = feature.reasons[0]; void wrongFlowReason;
    }
  }
}
const geometricFlow = geometricSignature.features[2];
if (geometricFlow.state === "unavailable") {
  const missingFlow: null = geometricFlow.value; void missingFlow;
} else {
  for (const frame of geometricFlow.value.frames) {
    if (frame.value) {
      const exactLength: string = frame.value.lengths.minimum.lower.numerator; void exactLength;
    } else {
      const afterStop: string = frame.reason; void afterStop;
    }
  }
}
const geometricEngine = EngineOnto2D.create({ models: [modelPack], analyses: [createGeometricSignatureAnalysis(geometricEvidence)] });
// @ts-expect-error Disabled layers are explicit, not silently omitted.
buildGeometricSignature(modelPack, { forman: geometricInput.forman }, geometricEvidence);
// @ts-expect-error Numerical summaries are not caller-supplied evidence.
buildGeometricSignature(modelPack, geometricInput, { ollivier: { mean: 0 }, flow: null });
// @ts-expect-error A geometric signature remains a descriptor; study comparisons are separate.
geometricSignature.distance;
// @ts-expect-error Policy bounds and alignment are readonly.
GEOMETRIC_SIGNATURE_POLICY.limits.maxFrames = 26;
// @ts-expect-error Feature values and coverage are readonly.
geometricSignature.features[0].coverage.numerator = 1;
void geometricEngine;
