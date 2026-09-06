import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralModelBinding, StructuralMetricPolicy } from "./index.js";

export type StructuralNecessity = "necessary" | "enabling" | "contextual" | "optional";
export type StructuralRole = "arising" | "maintenance" | "modulation";
export type StructuralChannel = "dependencyTypeId" | "interactionModeIds" | "causalDirectionIds";
export type StructuralSelection =
  { readonly kind: "all" } |
  { readonly kind: "necessity"; readonly through: StructuralNecessity } |
  { readonly kind: "roles"; readonly roles: readonly StructuralRole[] } |
  { readonly kind: "channel"; readonly field: StructuralChannel; readonly value: number };

export interface StructuralSelectionPolicy {
  readonly id: "typed-source-parent-subgraph-v1";
  readonly version: "1";
  readonly nodePopulation: "all-source-nodes";
  readonly necessityOrder: readonly StructuralNecessity[];
  readonly roleUniverse: readonly StructuralRole[];
  readonly channels: readonly StructuralChannel[];
  readonly missingCategory: "reject";
  readonly missingChannel: "exclude-and-account";
  readonly roleOrder: "subset-lattice";
}
export interface InverseTargetShareMetricPolicy {
  readonly id: "inverse-target-share-v1";
  readonly version: "1";
  readonly vertexWeight: 1;
  readonly edgeLength: "incoming-source-weight-sum-divided-by-source-weight";
  readonly edgeWeight: "edge-length";
  readonly normalizationContext: "full-source-projection";
  readonly minimumSourceWeight: 0.000001;
  readonly maximumSourceWeight: 1;
  readonly invalidWeight: "reject";
  readonly sourceMutation: "none";
  readonly status: "experimental";
}
export interface StructuralIntervalPolicy {
  readonly id: "outward-decimal-interval-v1";
  readonly version: "1";
  readonly decimalPlaces: 12;
  readonly sourceNumberInterpretation: "canonical-json-decimal";
  readonly squareRoot: "integer-isqrt";
  readonly rounding: "outward-per-incidence";
  readonly maxIncidences: 100000;
}
export interface StructuralFraction { readonly numerator: string; readonly denominator: string }
export interface StructuralInterval { readonly lowerTicks: string; readonly upperTicks: string }
export type StructuralIntervalSign = "negative" | "zero" | "positive" | "unresolved";
export type StructuralUnitComparison = "lower" | "equal" | "higher" | "overlapping";
export interface StructuralExperimentSummary {
  readonly count: number;
  readonly sum: StructuralInterval;
  readonly minimum: StructuralInterval | null;
  readonly maximum: StructuralInterval | null;
  readonly mean: { readonly lowerNumeratorTicks: string; readonly upperNumeratorTicks: string; readonly denominator: number } | null;
  readonly signs: Readonly<Record<StructuralIntervalSign, number>>;
  readonly unitComparison: Readonly<Record<StructuralUnitComparison, number>>;
}
export interface StructuralConnectivity {
  readonly weakComponentCount: number;
  readonly strongComponentCount: number;
  readonly cyclicNodeCount: number;
  readonly isolatedNodeCount: number;
}
export interface StructuralExperimentResult {
  readonly incidenceCount: number;
  readonly connectivity: StructuralConnectivity;
  readonly edges: readonly {
    readonly id: string; readonly source: string; readonly target: string;
    readonly length: StructuralFraction; readonly curvature: StructuralInterval;
    readonly unitCurvature: number; readonly sign: StructuralIntervalSign;
    readonly unitComparison: StructuralUnitComparison;
  }[];
  readonly nodes: readonly {
    readonly id: string; readonly inDegree: number; readonly outDegree: number;
    readonly incomingCurvature: StructuralInterval; readonly outgoingCurvature: StructuralInterval;
    readonly balance: StructuralInterval;
  }[];
  readonly summary: StructuralExperimentSummary;
}
export interface StructuralMetricExperimentRequest {
  readonly selection?: StructuralSelection;
  readonly metricPolicyId?: "unit-v1" | "inverse-target-share-v1";
}
export interface StructuralMetricExperiment {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-metric-experiment"; readonly version: "1" };
  readonly model: StructuralModelBinding;
  readonly sourceProjectionHash: ContentHash;
  readonly request: Required<StructuralMetricExperimentRequest>;
  readonly selectionPolicy: StructuralSelectionPolicy;
  readonly selectionPolicyHash: ContentHash;
  readonly projectionHash: ContentHash;
  readonly accounting: {
    readonly sourceNodeCount: number; readonly sourceEdgeCount: number;
    readonly selectedEdgeIds: readonly string[]; readonly excludedEdgeIds: readonly string[];
    readonly missingChannelEdgeIds: readonly string[];
  };
  readonly metricPolicy: StructuralMetricPolicy | InverseTargetShareMetricPolicy;
  readonly metricPolicyHash: ContentHash;
  readonly metricContextHash: ContentHash;
  readonly weightAuditHash: ContentHash | null;
  readonly algorithm: { readonly id: "forman-directed-interval"; readonly version: "1" };
  readonly numericPolicy: StructuralIntervalPolicy;
  readonly numericPolicyHash: ContentHash;
  readonly parameters: Readonly<Record<string, never>>;
  readonly parametersHash: ContentHash;
  readonly result: StructuralExperimentResult;
  readonly artifactHash: ContentHash;
}
export interface StructuralWeightAudit {
  readonly schemaVersion: "1";
  readonly model: StructuralModelBinding;
  readonly sourceProjectionHash: ContentHash;
  readonly algorithm: { readonly id: "incoming-source-weight-audit"; readonly version: "1" };
  readonly policy: InverseTargetShareMetricPolicy;
  readonly policyHash: ContentHash;
  readonly sourceNumberInterpretation: "canonical-json-decimal";
  readonly eligibleForInverseShare: boolean;
  readonly invalidWeights: readonly { readonly edgeId: string; readonly reason: "missing" | "not-a-number" | "zero" | "out-of-range" | "below-minimum" }[];
  readonly targets: readonly {
    readonly nodeId: string; readonly incomingEdgeIds: readonly string[];
    readonly sourceWeightSum: StructuralFraction | null;
    readonly disposition: "no-parents" | "invalid" | "normalized" | "non-unit-sum";
  }[];
  readonly nonUnitTargetIds: readonly string[];
  readonly artifactHash: ContentHash;
}
export interface StructuralMetricExperimentAnalysisDefinition {
  readonly id: "structural-metric-experiment";
  readonly version: "1";
  readonly requiredModelCapabilities: readonly [];
  readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_EXPERIMENT_REQUEST_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_EXPERIMENT_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, request?: StructuralMetricExperimentRequest): StructuralMetricExperiment;
}
export const TYPED_SELECTION_POLICY: StructuralSelectionPolicy;
export const INVERSE_TARGET_SHARE_METRIC_POLICY: InverseTargetShareMetricPolicy;
export const STRUCTURAL_INTERVAL_POLICY: StructuralIntervalPolicy;
export const STRUCTURAL_EXPERIMENT_REQUEST_SCHEMA: "https://onto2d.dev/schemas/v1/structural-metric-experiment-request.schema.json";
export const STRUCTURAL_EXPERIMENT_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-metric-experiment.schema.json";
export function auditStructuralWeights(pack: ModelPack): StructuralWeightAudit;
export function verifyStructuralWeightAudit(artifact: unknown, pack: ModelPack): StructuralWeightAudit;
export function analyzeStructuralMetricExperiment(pack: ModelPack, request?: StructuralMetricExperimentRequest): StructuralMetricExperiment;
export function verifyStructuralMetricExperiment(artifact: unknown, pack: ModelPack, request?: StructuralMetricExperimentRequest): StructuralMetricExperiment;
export function createStructuralMetricExperimentAnalysis(): StructuralMetricExperimentAnalysisDefinition;
export const structuralMetricExperimentAnalysis: StructuralMetricExperimentAnalysisDefinition;
