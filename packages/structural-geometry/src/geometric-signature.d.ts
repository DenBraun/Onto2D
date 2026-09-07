import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralProviderAnalysisInput, StructuralProviderAnalysisRequest, StructuralProviderAnalysisArtifact, StructuralMetricContextBinding } from "./providers.js";
import type { StructuralIntervalPolicy, StructuralConnectivity } from "./experiments.js";
import type { OllivierInput, OllivierArtifact } from "./ollivier.js";
import type { StructuralFlowInput, StructuralFlowArtifact, StructuralFlowCut, StructuralFlowTermination } from "./flow.js";

export interface GeometricSignatureInput {
  readonly forman: StructuralProviderAnalysisInput | null; readonly ollivier: OllivierInput | null; readonly flow: StructuralFlowInput | null;
}
export interface GeometricSignatureEvidence { readonly ollivier: OllivierArtifact | null; readonly flow: StructuralFlowArtifact | null }
export interface GeometricRational { readonly numerator: string; readonly denominator: string }
export interface GeometricInterval { readonly lower: GeometricRational; readonly upper: GeometricRational }
export interface GeometricMultisetRow<V> { readonly value: V; readonly count: number }
export interface GeometricExtremeRole {
  readonly sourceInDegree: number; readonly sourceOutDegree: number; readonly targetInDegree: number; readonly targetOutDegree: number;
}
export interface GeometricExtreme extends GeometricInterval {
  readonly possibleRoles: readonly GeometricMultisetRow<GeometricExtremeRole>[]; readonly certainRoles: readonly GeometricMultisetRow<GeometricExtremeRole>[];
}
export interface GeometricScalarDescriptor {
  readonly numeric: "exact-rational" | "certified-interval"; readonly count: number;
  readonly distribution: readonly GeometricMultisetRow<GeometricInterval>[];
  readonly signs: { readonly negative: number; readonly zero: number; readonly positive: number; readonly unresolved: number };
  readonly minimum: GeometricExtreme; readonly maximum: GeometricExtreme;
}
export interface GeometricAttainment { readonly possibleEdgeIds: readonly string[]; readonly certainEdgeIds: readonly string[] }
export interface GeometricScalarProvenance { readonly minimum: GeometricAttainment; readonly maximum: GeometricAttainment }
export type GeometricAfterTermination = `after-${StructuralFlowTermination["reason"]}`;
export interface GeometricFlowFrameValue {
  readonly jointDistribution: readonly GeometricMultisetRow<{ readonly length: GeometricRational; readonly curvature: GeometricRational }>[];
  readonly lengths: GeometricScalarDescriptor; readonly curvatures: GeometricScalarDescriptor;
  readonly maxLengthChange: GeometricRational | null; readonly maxCurvatureChange: GeometricRational | null; readonly stableStepCount: number;
}
export type GeometricFlowFrame = { readonly iteration: number } & (
  { readonly value: GeometricFlowFrameValue; readonly reason: null } |
  { readonly value: null; readonly reason: GeometricAfterTermination }
);
export interface GeometricThresholdEvents {
  readonly threshold: GeometricRational;
  readonly frames: readonly { readonly iteration: number; readonly aboveCount: number; readonly enteredCount: number; readonly exitedCount: number }[];
  readonly terminalRunLengths: readonly GeometricMultisetRow<number>[];
}
export interface GeometricFlowDescriptor {
  readonly horizon: number; readonly frames: readonly GeometricFlowFrame[];
  readonly termination: Omit<StructuralFlowTermination, "edgeIds"> & { readonly degenerateEdgeCount: number };
  readonly cuts: { readonly policy: StructuralFlowCut; readonly iteration: number; readonly removedEdgeCount: number;
    readonly weakComponentSizes: readonly number[]; readonly strongComponentSizes: readonly number[]; readonly connectivity: StructuralConnectivity };
  readonly thresholdEvents: GeometricThresholdEvents | null;
}
export interface GeometricFlowProvenance {
  readonly frames: readonly { readonly iteration: number; readonly lengths: GeometricScalarProvenance; readonly curvatures: GeometricScalarProvenance; readonly stateHash: ContentHash }[];
  readonly thresholdEvents: readonly { readonly iteration: number; readonly aboveEdgeIds: readonly string[]; readonly enteredEdgeIds: readonly string[]; readonly exitedEdgeIds: readonly string[] }[] | null;
  readonly degenerateEdgeIds: readonly string[]; readonly cuts: StructuralFlowArtifact["cuts"];
}
export type GeometricFeatureId = "forman-curvature-v1" | "ollivier-curvature-v1" | "flow-trajectory-v1";
export interface GeometricCoverage { readonly numerator: number; readonly denominator: number; readonly complete: boolean }
export type GeometricFeature<V, P, I extends GeometricFeatureId> = I extends GeometricFeatureId ? { readonly id: I } & (
  { readonly state: "observed"; readonly coverage: GeometricCoverage & { readonly complete: true };
    readonly value: V; readonly provenance: P; readonly valueHash: ContentHash; readonly reasons: readonly [] } |
  (I extends "forman-curvature-v1" ? never : {
    readonly state: "partial"; readonly coverage: GeometricCoverage & { readonly complete: false };
    readonly value: V; readonly provenance: P; readonly valueHash: ContentHash;
    readonly reasons: readonly [I extends "ollivier-curvature-v1" ? "partial-edge-coverage" : GeometricAfterTermination];
  }) |
  { readonly state: "unavailable"; readonly coverage: GeometricCoverage & { readonly numerator: 0; readonly complete: false };
    readonly value: null; readonly provenance: null; readonly valueHash: null;
    readonly reasons: readonly [I extends "forman-curvature-v1" ? "not-requested" | "empty-population" : "not-requested" | "missing-evidence"]; }
) : never;
export interface GeometricSignatureProfile {
  readonly policy: { readonly id: "geometric-signature-v1"; readonly version: "1"; readonly contentHash: ContentHash };
  readonly forman: { readonly request: StructuralProviderAnalysisRequest; readonly providerHash: ContentHash; readonly metricPolicyHash: ContentHash;
    readonly algorithm: { readonly id: "forman-directed-unit" | "forman-directed-interval"; readonly version: "1" };
    readonly numericPolicy: StructuralIntervalPolicy | { readonly id: "exact-unit-integer"; readonly version: "1" } } | null;
  readonly ollivier: { readonly policyHash: ContentHash; readonly idleness: "zero" | "half"; readonly coverage: "all-common-edges" } | null;
  readonly flow: { readonly policyHash: ContentHash; readonly parameters: Omit<Required<StructuralFlowInput>, "scope" | "initialLengths">;
    readonly initialization: "unit" | "explicit-source-lengths" } | null;
  readonly profileHash: ContentHash;
}
export interface GeometricSignatureArtifact {
  readonly schemaVersion: "1"; readonly analysis: { readonly id: "geometric-signature"; readonly version: "1" }; readonly evaluation: "measured";
  readonly policy: typeof GEOMETRIC_SIGNATURE_POLICY; readonly source: StructuralMetricContextBinding;
  readonly population: { readonly nodeIds: readonly string[]; readonly edgeIds: readonly string[]; readonly populationHash: ContentHash };
  readonly request: { readonly forman: StructuralProviderAnalysisRequest | null; readonly ollivier: Required<OllivierInput> | null; readonly flow: Required<StructuralFlowInput> | null };
  readonly profile: GeometricSignatureProfile;
  readonly evidence: GeometricSignatureEvidence & { readonly forman: StructuralProviderAnalysisArtifact | null };
  readonly features: readonly [
    GeometricFeature<GeometricScalarDescriptor, GeometricScalarProvenance, "forman-curvature-v1">,
    GeometricFeature<GeometricScalarDescriptor, GeometricScalarProvenance, "ollivier-curvature-v1">,
    GeometricFeature<GeometricFlowDescriptor, GeometricFlowProvenance, "flow-trajectory-v1">
  ];
  readonly summary: { readonly status: "complete" | "indeterminate"; readonly coverage: GeometricCoverage;
    readonly partialFeatureIds: readonly GeometricFeatureId[]; readonly unavailableFeatureIds: readonly GeometricFeatureId[] };
  readonly value: { readonly features: readonly [
    { readonly id: "forman-curvature-v1"; readonly value: GeometricScalarDescriptor },
    { readonly id: "ollivier-curvature-v1"; readonly value: GeometricScalarDescriptor },
    { readonly id: "flow-trajectory-v1"; readonly value: GeometricFlowDescriptor }
  ] } | null;
  readonly valueHash: ContentHash | null;
  readonly work: { readonly scalarSamples: number; readonly jointSamples: number; readonly trajectoryFrames: number };
  readonly artifactHash: ContentHash;
}
export const GEOMETRIC_SIGNATURE_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/geometric-signature-input.schema.json";
export const GEOMETRIC_SIGNATURE_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/geometric-signature-artifact.schema.json";
export function buildGeometricSignature(pack: ModelPack, input: GeometricSignatureInput, expectedEvidence: GeometricSignatureEvidence): GeometricSignatureArtifact;
export function verifyGeometricSignature(value: unknown, pack: ModelPack, input: GeometricSignatureInput, expectedEvidence: GeometricSignatureEvidence): GeometricSignatureArtifact;
export interface GeometricSignatureAnalysisDefinition {
  readonly id: "geometric-signature"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof GEOMETRIC_SIGNATURE_INPUT_SCHEMA; readonly outputArtifacts: readonly [typeof GEOMETRIC_SIGNATURE_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: GeometricSignatureInput): GeometricSignatureArtifact;
}
export function createGeometricSignatureAnalysis(expectedEvidence: GeometricSignatureEvidence): GeometricSignatureAnalysisDefinition;

type GeometricConstant<T> = { readonly [K in keyof T]: T[K] extends object ? GeometricConstant<T[K]> : T[K] };
export const GEOMETRIC_SIGNATURE_POLICY: GeometricConstant<{
  "id": "geometric-signature-v1",
  "version": "1",
  "source": "expected-verified-model-pack",
  "layers": [
    "forman-curvature-v1",
    "ollivier-curvature-v1",
    "flow-trajectory-v1"
  ],
  "population": "same-exact-scoped-nodes-and-edges-for-all-requested-layers",
  "scalar": "exact-multiset-of-closed-rational-intervals",
  "intervals": "retain-certified-endpoints-no-midpoints",
  "extrema": "possible-and-certain-attainment-with-inclusive-ties",
  "roles": "source-target-in-out-degree-multisets",
  "provenance": "exact-edge-ids-excluded-from-values",
  "flow": "joint-normalized-length-curvature-multisets",
  "alignment": "absolute-iteration-through-requested-cap-no-padding",
  "earlyStop": "unavailable-tail-partial-horizon-never-convergence-substitution",
  "cuts": "strict-threshold-events-and-terminal-consecutive-run-lengths",
  "missingness": "observed-partial-unavailable-whole-value-only-if-all-three-observed",
  "comparison": "no-distance-or-cross-source-comparability-authority",
  "verification": "expected-source-request-and-external-evidence-replay",
  "errors": "throw-no-partial-success",
  "limits": {
    "maxNodes": 64,
    "maxEdges": 64,
    "maxFrames": 25,
    "maxScalarSamples": 3328,
    "maxJointSamples": 1600,
    "maxCanonicalEntries": 2000000,
    "maxArtifactBytes": 25165824
  },
  "contentHash": "sha256:0f9af7849baee9674666e82ea0022e716f841d73cfd0dc40500f0a1f4fe884dd"
}>;
