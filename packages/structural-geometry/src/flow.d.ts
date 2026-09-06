import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { ScientificAdapter } from "@onto2d/scientific-adapter";
import type { StructuralModelBinding } from "./index.js";

/** Reduced rational integer strings, at most 256 digits per magnitude. */
export interface StructuralFlowRational { readonly numerator: string; readonly denominator: string }
export type StructuralFlowScope = { readonly kind: "full" } | { readonly kind: "induced"; readonly nodeIds: readonly string[] };
export type StructuralFlowCut = { readonly kind: "none" } | { readonly kind: "final-length"; readonly threshold: StructuralFlowRational };
export interface StructuralFlowInput {
  readonly scope?: StructuralFlowScope;
  readonly initialLengths?: readonly { readonly edgeId: string; readonly length: StructuralFlowRational }[];
  readonly maxIterations?: number;
  readonly step?: "half" | "one";
  readonly idleness?: "zero" | "half";
  readonly stableSteps?: number;
  readonly tolerance?: StructuralFlowRational;
  readonly cut?: StructuralFlowCut;
}
export interface StructuralFlowSolver {
  readonly id: "onto2d-python-flow-transport-reference";
  readonly version: "1";
  readonly method: "rational-cost-integer-mass-primal-dual-v1";
}
export interface StructuralFlowRequest {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-flow"; readonly version: "1" };
  readonly model: StructuralModelBinding;
  readonly sourceProjectionHash: ContentHash;
  readonly projectionHash: ContentHash;
  readonly graph: {
    readonly nodes: readonly { readonly id: string; readonly sourceRecordHash: ContentHash }[];
    readonly edges: readonly { readonly id: string; readonly source: string; readonly target: string; readonly sourceRecordHash: ContentHash }[];
  };
  readonly scope: StructuralFlowScope & { readonly excludedNodeCount: number; readonly excludedEdgeCount: number; readonly boundaryEdgeCount: number };
  readonly policy: typeof STRUCTURAL_FLOW_POLICY;
  readonly policyHash: ContentHash;
  readonly parameters: Required<StructuralFlowInput>;
  readonly requestHash: ContentHash;
}
export interface StructuralFlowTransportRequest {
  readonly schemaVersion: "1";
  readonly flowRequestHash: ContentHash;
  readonly iteration: number;
  readonly previousStateHash: ContentHash | null;
  readonly metricHash: ContentHash;
  readonly solver: StructuralFlowSolver;
  readonly problems: readonly {
    readonly edgeId: string; readonly source: string; readonly target: string;
    readonly distance: StructuralFlowRational;
    readonly massDenominator: number;
    readonly sourceMeasure: readonly { readonly nodeId: string; readonly units: number }[];
    readonly targetMeasure: readonly { readonly nodeId: string; readonly units: number }[];
    readonly costs: readonly (readonly StructuralFlowRational[])[];
  }[];
  readonly requestHash: ContentHash;
}
export interface StructuralFlowTransportResponse {
  readonly schemaVersion: "1";
  readonly requestHash: ContentHash;
  readonly solver: StructuralFlowSolver;
  readonly solutions: readonly {
    readonly edgeId: string;
    readonly flow: readonly (readonly number[])[];
    readonly sourcePotentials: readonly StructuralFlowRational[];
    readonly targetPotentials: readonly StructuralFlowRational[];
    readonly costNumerator: StructuralFlowRational;
  }[];
}
export interface StructuralFlowState {
  readonly iteration: number;
  readonly previousStateHash: ContentHash | null;
  readonly metricHash: ContentHash;
  readonly normalization: {
    readonly rawSum: StructuralFlowRational; readonly closureSum: StructuralFlowRational;
    readonly factor: StructuralFlowRational; readonly shortenedEdgeIds: readonly string[];
  };
  readonly edges: readonly {
    readonly id: string; readonly length: StructuralFlowRational;
    readonly wasserstein: StructuralFlowRational; readonly curvature: StructuralFlowRational;
  }[];
  readonly summary: {
    readonly lengthSum: StructuralFlowRational; readonly minimumLength: StructuralFlowRational; readonly maximumLength: StructuralFlowRational;
    readonly minimumCurvature: StructuralFlowRational; readonly maximumCurvature: StructuralFlowRational; readonly curvatureSum: StructuralFlowRational;
    readonly signs: { readonly negative: number; readonly zero: number; readonly positive: number };
    readonly maximumLengthEdgeIds: readonly string[];
    readonly maxLengthChange: StructuralFlowRational | null; readonly maxCurvatureChange: StructuralFlowRational | null;
    readonly stableStepCount: number;
  };
  readonly transportResponse: StructuralFlowTransportResponse;
  readonly stateHash: ContentHash;
}
export interface StructuralFlowTermination {
  readonly reason: "fixed-point" | "cycle" | "tolerance" | "iteration-limit" | "degenerate-length";
  readonly iteration: number;
  readonly cycleStart: number | null; readonly cyclePeriod: number | null;
  readonly edgeIds: readonly string[];
}
export interface StructuralFlowArtifact {
  readonly schemaVersion: "1";
  readonly analysis: StructuralFlowRequest["analysis"];
  readonly model: StructuralModelBinding;
  readonly request: StructuralFlowRequest;
  readonly states: readonly StructuralFlowState[];
  readonly termination: StructuralFlowTermination;
  readonly cuts: {
    readonly policy: StructuralFlowCut; readonly iteration: number; readonly removedEdgeIds: readonly string[];
    readonly weakComponents: readonly (readonly string[])[]; readonly strongComponents: readonly (readonly string[])[];
    readonly connectivity: { readonly weakComponentCount: number; readonly strongComponentCount: number; readonly cyclicNodeCount: number; readonly isolatedNodeCount: number };
  };
  readonly artifactHash: ContentHash;
}
export type StructuralFlowAdapter = ScientificAdapter<StructuralFlowTransportRequest, StructuralFlowTransportResponse>;
export interface StructuralFlowAnalyzer { analyze(pack: ModelPack, input?: StructuralFlowInput): Promise<StructuralFlowArtifact> }
export interface StructuralFlowAnalysis {
  readonly id: "structural-flow"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_FLOW_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_FLOW_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input?: StructuralFlowInput): Promise<StructuralFlowArtifact>;
}
export const STRUCTURAL_FLOW_SOLVER: StructuralFlowSolver;
export const STRUCTURAL_FLOW_ANALYSIS_ID: "structural-flow";
export const STRUCTURAL_FLOW_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-flow-input.schema.json";
export const STRUCTURAL_FLOW_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-flow-artifact.schema.json";
export function prepareStructuralFlow(pack: ModelPack, input?: StructuralFlowInput): StructuralFlowRequest;
export function createStructuralFlowAnalyzer(adapter: StructuralFlowAdapter): StructuralFlowAnalyzer;
export function verifyStructuralFlowArtifact(artifact: unknown, pack: ModelPack, input?: StructuralFlowInput): StructuralFlowArtifact;
export function createStructuralFlowAnalysis(adapter: StructuralFlowAdapter): StructuralFlowAnalysis;

export const STRUCTURAL_FLOW_POLICY: {
  readonly id: "directed-ollivier-shadow-flow-v1"; readonly version: "1";
  readonly sourceGraph: "immutable-source-parent-induced-scope";
  readonly lengths: "separate-positive-rational-state";
  readonly measures: "uniform-predecessors-to-uniform-successors";
  readonly emptyNeighborhood: "dirac-at-endpoint";
  readonly distance: "directed-shortest-path";
  readonly update: "simultaneous-(1-step)*distance+step*wasserstein";
  readonly metricClosure: "shortest-endpoint-distances-before-normalization";
  readonly normalization: "total-length-equals-scoped-edge-count";
  readonly numeric: "exact-rational-primal-dual";
  readonly sourceWeights: "ignored"; readonly ordering: "utf16-code-unit";
  readonly convergence: "fixed-point-or-consecutive-length-and-curvature-deltas";
  readonly cycleDetection: "exact-normalized-length-vector";
  readonly degenerateLength: "stop-before-zero-length-update";
  readonly cuts: "optional-final-strict-length-threshold-no-feedback";
  readonly defaults: {
    readonly maxIterations: 16; readonly step: "half"; readonly idleness: "half"; readonly stableSteps: 2;
    readonly tolerance: { readonly numerator: "1"; readonly denominator: "1000000" }; readonly cut: { readonly kind: "none" };
  };
  readonly limits: {
    readonly maxNodes: 64; readonly maxEdges: 64; readonly maxIterations: 24; readonly maxStableSteps: 8;
    readonly maxSupportSize: 16; readonly maxTransportCells: 4096; readonly maxHistoryTransportCells: 32768;
    readonly maxMassDenominator: 512; readonly maxRationalDigits: 256; readonly maxTransportBytes: 1048576;
    readonly maxArtifactBytes: 8388608; readonly maxCanonicalEntries: 500000;
  };
};
