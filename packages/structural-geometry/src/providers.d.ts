import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralGeometryArtifact, StructuralModelBinding, StructuralMetricPolicy, StructuralProjection } from "./index.js";
import type { InverseTargetShareMetricPolicy, StructuralChannel, StructuralFraction, StructuralMetricExperiment,
  StructuralRole, StructuralSelection, StructuralSelectionPolicy } from "./experiments.js";

export type StructuralMetricProviderId = "unit-v1" | "inverse-target-share-v1";
export type StructuralProviderId = StructuralMetricProviderId | "necessity-filtration-v1" | "role-subset-v1" | "typed-channel-v1";
export type StructuralProviderKind = "metric-values" | "filtration" | "selection" | "channels";
export type StructuralProviderCapability = "positive-edge-lengths" | "vertex-weights" | "edge-weights" |
  "nested-edge-views" | "role-selection" | "overlapping-typed-channels";
export interface StructuralProviderDescriptor {
  readonly id: StructuralProviderId;
  readonly version: "1";
  readonly kind: StructuralProviderKind;
  readonly origin: "existing-structural-geometry-v1";
  readonly representationPolicyId: "source-parent-directed-v1";
  readonly numeric: "exact-positive-rational" | "discrete-membership";
  readonly capabilities: readonly StructuralProviderCapability[];
  readonly context: { readonly source: "verified-full-model"; readonly normalization: "full-source-projection";
    readonly dictionaryMeaning: "model-local"; readonly sourceWeights: "ignored" | "required-and-audited" | "unused" };
  readonly limits: { readonly maxNodes: 4096; readonly maxEdges: 16384; readonly maxViews: 32;
    readonly maxTotalViewEdges: 32768; readonly maxCanonicalEntries: 500000; readonly maxArtifactBytes: 8388608 };
}
export interface StructuralMetricContextBinding {
  readonly schemaVersion: "1";
  readonly model: StructuralModelBinding;
  readonly sourceProjectionHash: ContentHash;
  readonly projectionPolicyHash: ContentHash;
  readonly normalizationContext: "full-source-projection";
  readonly dictionaryHash: ContentHash;
  readonly contextHash: ContentHash;
}
declare const verifiedMetricContext: unique symbol;
export interface StructuralMetricContext {
  readonly [verifiedMetricContext]: true;
  readonly projection: StructuralProjection;
  readonly binding: StructuralMetricContextBinding;
}

export type StructuralProviderParameters<I extends StructuralProviderId> =
  I extends "role-subset-v1" ? { readonly roles: readonly StructuralRole[] } :
  I extends "typed-channel-v1" ? { readonly field: StructuralChannel; readonly values: readonly number[] } :
  Readonly<Record<string, never>>;
export type StructuralProviderInput = {
  readonly providerId: StructuralMetricProviderId | "necessity-filtration-v1";
  readonly parameters?: Readonly<Record<string, never>>;
} | { readonly providerId: "role-subset-v1"; readonly parameters: StructuralProviderParameters<"role-subset-v1"> }
  | { readonly providerId: "typed-channel-v1"; readonly parameters: StructuralProviderParameters<"typed-channel-v1"> };
export type StructuralProviderRequest =
  { readonly providerId: StructuralMetricProviderId | "necessity-filtration-v1"; readonly parameters: Readonly<Record<string, never>> }
  | Extract<StructuralProviderInput, { readonly providerId: "role-subset-v1" | "typed-channel-v1" }>;

export interface StructuralMetricValues {
  readonly kind: "metric-values";
  readonly metricPolicy: StructuralMetricPolicy | InverseTargetShareMetricPolicy;
  readonly metricPolicyHash: ContentHash;
  readonly metricContextHash: ContentHash;
  readonly weightAuditHash: ContentHash | null;
  readonly nodes: readonly { readonly id: string; readonly weight: StructuralFraction }[];
  readonly edges: readonly { readonly id: string; readonly source: string; readonly target: string;
    readonly length: StructuralFraction; readonly weight: StructuralFraction }[];
}
export interface StructuralProviderView {
  readonly selection: StructuralSelection;
  readonly projectionHash: ContentHash;
  readonly accounting: StructuralMetricExperiment["accounting"];
  readonly edges: readonly { readonly id: string; readonly source: string; readonly target: string }[];
}
export interface StructuralProviderViewBase {
  readonly nodeIds: readonly string[];
  readonly selectionPolicy: StructuralSelectionPolicy;
  readonly selectionPolicyHash: ContentHash;
}
export interface StructuralNecessityFiltration extends StructuralProviderViewBase {
  readonly kind: "filtration";
  readonly stages: readonly StructuralProviderView[];
}
export interface StructuralRoleSelection extends StructuralProviderViewBase {
  readonly kind: "selection";
  readonly view: StructuralProviderView;
}
export interface StructuralTypedChannels extends StructuralProviderViewBase {
  readonly kind: "channels";
  readonly channels: readonly StructuralProviderView[];
}
export type StructuralProviderResult = StructuralMetricValues | StructuralNecessityFiltration | StructuralRoleSelection | StructuralTypedChannels;
export interface StructuralProviderArtifact<R extends StructuralProviderResult = StructuralProviderResult> {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-metric-provider"; readonly version: "1" };
  readonly provider: StructuralProviderDescriptor;
  readonly providerHash: ContentHash;
  readonly context: StructuralMetricContextBinding;
  readonly request: StructuralProviderRequest;
  readonly result: R;
  readonly artifactHash: ContentHash;
}
export type StructuralProviderResultFor<I extends StructuralProviderId> =
  I extends StructuralMetricProviderId ? StructuralMetricValues :
  I extends "necessity-filtration-v1" ? StructuralNecessityFiltration :
  I extends "role-subset-v1" ? StructuralRoleSelection : StructuralTypedChannels;
export interface StructuralMetricProvider<I extends StructuralProviderId = StructuralProviderId> {
  readonly descriptor: StructuralProviderDescriptor;
  build(projection: StructuralProjection, context: StructuralMetricContext,
    ...parameters: I extends "role-subset-v1" | "typed-channel-v1"
      ? [parameters: StructuralProviderParameters<I>] : [parameters?: StructuralProviderParameters<I>]
  ): StructuralProviderArtifact<StructuralProviderResultFor<I>>;
}

export type StructuralProviderAnalysisInput =
  { readonly analysis: "structural-geometry"; readonly metricProviderId: "unit-v1" } |
  { readonly analysis: "structural-metric-experiment"; readonly metricProviderId: StructuralMetricProviderId;
    readonly selection?: StructuralSelection };
export type StructuralProviderAnalysisRequest =
  Extract<StructuralProviderAnalysisInput, { readonly analysis: "structural-geometry" }> |
  { readonly analysis: "structural-metric-experiment"; readonly metricProviderId: StructuralMetricProviderId;
    readonly selection: StructuralSelection };
export interface StructuralProviderAnalysisArtifact {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-provider-analysis"; readonly version: "1" };
  readonly request: StructuralProviderAnalysisRequest;
  readonly context: StructuralMetricContextBinding;
  readonly metricArtifact: StructuralProviderArtifact<StructuralMetricValues>;
  readonly viewArtifact: StructuralProviderArtifact<StructuralNecessityFiltration | StructuralRoleSelection | StructuralTypedChannels> | null;
  readonly legacyArtifact: StructuralGeometryArtifact | StructuralMetricExperiment;
  readonly artifactHash: ContentHash;
}

export const STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS: readonly StructuralProviderDescriptor[];
export const STRUCTURAL_PROVIDER_DESCRIPTOR_SCHEMA: "https://onto2d.dev/schemas/v1/structural-provider-descriptor.schema.json";
export const STRUCTURAL_METRIC_CONTEXT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-metric-context.schema.json";
export const STRUCTURAL_PROVIDER_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-provider-input.schema.json";
export const STRUCTURAL_PROVIDER_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-provider-artifact.schema.json";
export const STRUCTURAL_PROVIDER_ANALYSIS_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-provider-analysis-input.schema.json";
export const STRUCTURAL_PROVIDER_ANALYSIS_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-provider-analysis-artifact.schema.json";
export function createStructuralMetricContext(pack: ModelPack): StructuralMetricContext;
export function createStructuralMetricProvider<I extends StructuralProviderId>(id: I): StructuralMetricProvider<I>;
export function buildStructuralProvider(pack: ModelPack, input: StructuralProviderInput): StructuralProviderArtifact;
export function verifyStructuralProviderArtifact(artifact: unknown, pack: ModelPack, input: StructuralProviderInput): StructuralProviderArtifact;
export function requireStructuralMetricValues(artifact: unknown, pack: ModelPack, input: StructuralProviderInput): StructuralMetricValues;
export function analyzeStructuralGeometryWithProvider(pack: ModelPack, input: StructuralProviderAnalysisInput): StructuralProviderAnalysisArtifact;
export function verifyStructuralProviderAnalysis(artifact: unknown, pack: ModelPack, input: StructuralProviderAnalysisInput): StructuralProviderAnalysisArtifact;
export interface StructuralMetricProviderAnalysisDefinition {
  readonly id: "structural-metric-provider"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_PROVIDER_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_PROVIDER_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralProviderInput): StructuralProviderArtifact;
}
export interface StructuralProviderAnalysisDefinition {
  readonly id: "structural-provider-analysis"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_PROVIDER_ANALYSIS_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_PROVIDER_ANALYSIS_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralProviderAnalysisInput): StructuralProviderAnalysisArtifact;
}
export function createStructuralMetricProviderAnalysis(): StructuralMetricProviderAnalysisDefinition;
export function createStructuralProviderAnalysis(): StructuralProviderAnalysisDefinition;
