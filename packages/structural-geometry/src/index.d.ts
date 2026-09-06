import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";

export type StructuralValue = null | boolean | number | string |
  readonly StructuralValue[] | { readonly [key: string]: StructuralValue };
export type StructuralNodeAttribute = "level" | "phase" | "phaseId" | "typeRole" |
  "typeRoleId" | "scienceIds" | "scientificStatus" | "requirements";
export type StructuralEdgeAttribute = "relationLayer" | "causalDirections" |
  "causalDirectionIds" | "interactionModes" | "interactionModeIds" | "weight" |
  "necessity" | "dependencyType" | "dependencyTypeId" | "ontologicalRole" | "quantization";

export interface StructuralProjectionPolicy {
  readonly id: "source-parent-directed-v1";
  readonly version: "1";
  readonly scope: "full-model";
  readonly direction: "native";
  readonly relationLayer: "source-parent";
  readonly includedOntologicalRoles: "all";
  readonly includedNecessities: "all";
  readonly includedDependencyTypes: "all";
  readonly includeQuantization: true;
  readonly higherOrderPolicy: "none";
  readonly selfLoops: "reject";
  readonly parallelEdges: "reject";
  readonly nodeAttributes: readonly StructuralNodeAttribute[];
  readonly edgeAttributes: readonly StructuralEdgeAttribute[];
  readonly limits: { readonly maxNodes: 4096; readonly maxEdges: 16384 };
}

export interface StructuralMetricPolicy {
  readonly id: "unit-v1";
  readonly version: "1";
  readonly vertexWeight: 1;
  readonly edgeWeight: 1;
  readonly edgeLength: 1;
  readonly sourceWeightUsage: "provenance-only";
}

export interface StructuralGeometryRequest {
  projectionPolicyId?: "source-parent-directed-v1";
  metricPolicyId?: "unit-v1";
}

export interface StructuralModelBinding {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly modelRootHash: ContentHash;
  readonly manifestHash: ContentHash;
}

export interface StructuralProjectionNode {
  readonly id: string;
  readonly sourceRecordHash: ContentHash;
  readonly attributes: Readonly<Partial<Record<StructuralNodeAttribute, StructuralValue>>>;
}

export interface StructuralProjectionEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceRecordHash: ContentHash;
  readonly attributes: Readonly<Partial<Record<StructuralEdgeAttribute, StructuralValue>>> & {
    readonly relationLayer: "source-parent";
  };
}

export interface StructuralProjection {
  readonly schemaVersion: "1";
  readonly model: StructuralModelBinding;
  readonly policy: StructuralProjectionPolicy;
  readonly policyHash: ContentHash;
  readonly nodes: readonly StructuralProjectionNode[];
  readonly edges: readonly StructuralProjectionEdge[];
  readonly projectionHash: ContentHash;
}

export interface StructuralCurvatureSummary {
  readonly count: number;
  readonly sum: number;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly mean: { readonly numerator: number; readonly denominator: number } | null;
  readonly histogram: readonly { readonly curvature: number; readonly count: number }[];
}

export interface StructuralCurvatureGroup {
  readonly key: { readonly present: false } | { readonly present: true; readonly value: StructuralValue };
  readonly summary: StructuralCurvatureSummary;
}

export interface StructuralGeometryResult {
  readonly nodes: readonly {
    readonly id: string;
    readonly inDegree: number;
    readonly outDegree: number;
    readonly incomingCurvature: number;
    readonly outgoingCurvature: number;
    readonly balance: number;
  }[];
  readonly edges: readonly {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly inDegreeAtSource: number;
    readonly outDegreeAtTarget: number;
    readonly curvature: number;
  }[];
  readonly summary: StructuralCurvatureSummary;
  readonly groups: {
    readonly bySourceLevel: readonly StructuralCurvatureGroup[];
    readonly byTargetLevel: readonly StructuralCurvatureGroup[];
    readonly byDependencyType: readonly StructuralCurvatureGroup[];
    readonly byNecessity: readonly StructuralCurvatureGroup[];
    readonly byOntologicalRole: readonly StructuralCurvatureGroup[];
  };
  readonly extrema: {
    readonly minimumEdgeIds: readonly string[];
    readonly maximumEdgeIds: readonly string[];
  };
}

export interface StructuralGeometryArtifact {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-geometry"; readonly version: "1" };
  readonly model: StructuralModelBinding;
  readonly projectionPolicy: StructuralProjectionPolicy;
  readonly projectionPolicyHash: ContentHash;
  readonly metricPolicy: StructuralMetricPolicy;
  readonly metricPolicyHash: ContentHash;
  readonly projectionHash: ContentHash;
  readonly algorithm: { readonly id: "forman-directed-unit"; readonly version: "1" };
  readonly parameters: Readonly<Record<string, never>>;
  readonly parametersHash: ContentHash;
  readonly result: StructuralGeometryResult;
  readonly artifactHash: ContentHash;
}

export interface StructuralGeometryAnalysisDefinition {
  readonly id: "structural-geometry";
  readonly version: "1";
  readonly requiredModelCapabilities: readonly [];
  readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_GEOMETRY_REQUEST_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_GEOMETRY_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input?: StructuralGeometryRequest): StructuralGeometryArtifact;
}

export const SOURCE_PARENT_DIRECTED_POLICY: StructuralProjectionPolicy;
export const UNIT_METRIC_POLICY: StructuralMetricPolicy;
export const STRUCTURAL_GEOMETRY_ANALYSIS_ID: "structural-geometry";
export const STRUCTURAL_GEOMETRY_ANALYSIS_VERSION: "1";
export const STRUCTURAL_GEOMETRY_REQUEST_SCHEMA:
  "https://onto2d.dev/schemas/v1/structural-geometry-request.schema.json";
export const STRUCTURAL_GEOMETRY_ARTIFACT_SCHEMA:
  "https://onto2d.dev/schemas/v1/structural-geometry-artifact.schema.json";

export function projectStructuralGeometry(pack: ModelPack, request?: StructuralGeometryRequest): StructuralProjection;
export function analyzeStructuralGeometry(pack: ModelPack, request?: StructuralGeometryRequest): StructuralGeometryArtifact;
export function verifyStructuralProjection(
  projection: unknown, pack: ModelPack, request?: StructuralGeometryRequest
): StructuralProjection;
export function verifyStructuralGeometryArtifact(
  artifact: unknown, pack: ModelPack, request?: StructuralGeometryRequest
): StructuralGeometryArtifact;
export function createStructuralGeometryAnalysis(): StructuralGeometryAnalysisDefinition;
export const structuralGeometryAnalysis: StructuralGeometryAnalysisDefinition;
