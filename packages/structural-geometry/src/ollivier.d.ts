import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { ScientificAdapter } from "@onto2d/scientific-adapter";
import type { StructuralModelBinding } from "./index.js";

export type OllivierIdleness = "zero" | "half";
export type OllivierScope = { readonly kind: "full" } |
  { readonly kind: "induced"; readonly nodeIds: readonly string[] };
export interface OllivierInput {
  readonly scope?: OllivierScope;
  readonly edgeIds: readonly string[];
  readonly idleness?: OllivierIdleness;
}
export interface OllivierPolicy {
  readonly id: "ollivier-directed-in-out-unit-v1";
  readonly version: "1";
  readonly sourceMeasure: "uniform-predecessors";
  readonly targetMeasure: "uniform-successors";
  readonly emptyNeighborhood: "dirac-at-endpoint";
  readonly idleness: readonly ["zero", "half"];
  readonly defaultIdleness: "zero";
  readonly distance: "directed-shortest-path-in-scoped-graph";
  readonly edgeLength: 1;
  readonly denominator: "directed-endpoint-distance";
  readonly disconnectedSupport: "reject-unreachable-pair";
  readonly sourceWeights: "ignored";
  readonly numeric: "exact-integer-transport-rational-curvature";
  readonly verification: "primal-dual-equality";
  readonly ordering: "utf16-code-unit";
  readonly limits: {
    readonly maxNodes: 64; readonly maxEdges: 256; readonly maxAnalyzedEdges: 32;
    readonly maxSupportSize: 16; readonly maxTransportCells: 256;
    readonly maxTotalTransportCells: 4096; readonly maxMassDenominator: 512;
    readonly maxPotentialMagnitude: 4096; readonly maxTransportBytes: 1048576;
  };
}
export interface OllivierSolver {
  readonly id: "onto2d-python-ollivier-reference";
  readonly version: "1";
  readonly method: "integer-successive-shortest-path-primal-dual-v1";
}
export interface OllivierMeasureEntry { readonly nodeId: string; readonly units: number }
export interface OllivierProblem {
  readonly edgeId: string; readonly source: string; readonly target: string;
  readonly distance: 1; readonly massDenominator: number;
  readonly sourceMeasure: readonly OllivierMeasureEntry[];
  readonly targetMeasure: readonly OllivierMeasureEntry[];
  readonly costs: readonly (readonly number[])[];
}
export interface OllivierRequest {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-ollivier"; readonly version: "1" };
  readonly model: StructuralModelBinding;
  readonly sourceProjectionHash: ContentHash;
  readonly projectionHash: ContentHash;
  readonly scope: OllivierScope & { readonly excludedNodeCount: number; readonly excludedEdgeCount: number; readonly boundaryEdgeCount: number };
  readonly graph: {
    readonly nodes: readonly { readonly id: string; readonly sourceRecordHash: ContentHash }[];
    readonly edges: readonly { readonly id: string; readonly source: string; readonly target: string; readonly sourceRecordHash: ContentHash }[];
  };
  readonly policy: OllivierPolicy; readonly policyHash: ContentHash;
  readonly parameters: { readonly scope: OllivierScope; readonly edgeIds: readonly string[]; readonly idleness: OllivierIdleness };
  readonly solver: OllivierSolver;
  readonly problems: readonly OllivierProblem[];
  readonly requestHash: ContentHash;
}
export interface OllivierSolution {
  readonly edgeId: string;
  readonly flow: readonly (readonly number[])[];
  readonly sourcePotentials: readonly number[];
  readonly targetPotentials: readonly number[];
  readonly costNumerator: number;
}
export interface OllivierResponse {
  readonly schemaVersion: "1";
  readonly requestHash: ContentHash;
  readonly solver: OllivierSolver;
  readonly solutions: readonly OllivierSolution[];
}
export interface OllivierRational { readonly numerator: string; readonly denominator: string }
export interface OllivierArtifact {
  readonly schemaVersion: "1";
  readonly analysis: OllivierRequest["analysis"];
  readonly model: StructuralModelBinding;
  readonly request: OllivierRequest;
  readonly response: OllivierResponse;
  readonly result: {
    readonly edges: readonly {
      readonly id: string; readonly source: string; readonly target: string;
      readonly wasserstein: OllivierRational; readonly curvature: OllivierRational;
      readonly sign: "negative" | "zero" | "positive";
    }[];
    readonly summary: {
      readonly count: number; readonly sum: OllivierRational; readonly mean: OllivierRational;
      readonly signs: { readonly negative: number; readonly zero: number; readonly positive: number };
    };
  };
  readonly artifactHash: ContentHash;
}
export type OllivierAdapter = ScientificAdapter<OllivierRequest, OllivierResponse>;
export interface OllivierAnalyzerOptions { readonly maxCacheEntries?: number }
export interface OllivierAnalyzer {
  analyze(pack: ModelPack, input: OllivierInput): Promise<OllivierArtifact>;
  clearCache(): void;
}
export interface OllivierAnalysis {
  readonly id: "structural-ollivier"; readonly version: "1";
  readonly requiredModelCapabilities: readonly [];
  readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof OLLIVIER_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof OLLIVIER_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: OllivierInput): Promise<OllivierArtifact>;
}
export const OLLIVIER_POLICY: OllivierPolicy;
export const OLLIVIER_SOLVER: OllivierSolver;
export const OLLIVIER_ANALYSIS_ID: "structural-ollivier";
export const OLLIVIER_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-ollivier-input.schema.json";
export const OLLIVIER_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-ollivier-artifact.schema.json";
export function prepareOllivierRequest(pack: ModelPack, input: OllivierInput): OllivierRequest;
export function acceptOllivierResponse(response: unknown, pack: ModelPack, input: OllivierInput): OllivierArtifact;
export function verifyOllivierArtifact(artifact: unknown, pack: ModelPack, input: OllivierInput): OllivierArtifact;
export function createOllivierAnalyzer(adapter: OllivierAdapter, options?: OllivierAnalyzerOptions): OllivierAnalyzer;
export function createOllivierAnalysis(adapter: OllivierAdapter, options?: OllivierAnalyzerOptions): OllivierAnalysis;
