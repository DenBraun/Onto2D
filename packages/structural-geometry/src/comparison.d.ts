import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralRegimeScope } from "./regimes.js";
import type { CanonicalStructureObservation, CanonicalStructureValue } from "./canonical.js";
import type { StructuralTopologyObservation } from "./topology.js";
import type { TypedAlignmentOptions, TypedAlignmentReason, TypedRelationsAlignment, TypedDirectedStructureValue } from "./typed.js";

export type StructuralTopologyObservableId = "node-count-v1" | "edge-count-v1" | "weak-component-sizes-v1" |
  "strong-component-sizes-v1" | "reachable-ordered-pair-count-v1" | "cyclic-node-count-v1" | "isolated-node-count-v1";
export type StructuralComparisonObservableId = "canonical-directed-structure-v1" | "canonical-typed-directed-structure-v1" | StructuralTopologyObservableId;
export interface StructuralComparisonEvidenceGap<O extends StructuralComparisonObservableId = StructuralComparisonObservableId> {
  readonly side: "left" | "right"; readonly observableId: O;
  readonly disposition: "unavailable" | "rejected";
  readonly reference: string; readonly contentHash: ContentHash;
}
interface ComparisonScopes { readonly leftScope?: StructuralRegimeScope; readonly rightScope?: StructuralRegimeScope }
export type StructuralComparisonInput = ComparisonScopes & (
  { readonly regimeId: "canonical-structure-v1"; readonly vocabulary?: never;
    readonly evidenceGaps?: readonly StructuralComparisonEvidenceGap<"canonical-directed-structure-v1">[] } |
  { readonly regimeId: "topology-only-v1"; readonly vocabulary?: never;
    readonly evidenceGaps?: readonly StructuralComparisonEvidenceGap<StructuralTopologyObservableId>[] } |
  { readonly regimeId: "typed-relations-v1"; readonly vocabulary?: TypedAlignmentOptions;
    readonly evidenceGaps?: readonly StructuralComparisonEvidenceGap<"canonical-directed-structure-v1" | "canonical-typed-directed-structure-v1">[] }
);
export interface StructuralComparisonPolicy extends StructuralContractReference {
  readonly id: "strict-discrete-structural-comparison-v1";
  readonly profile: "all-ordered-mandatory-regime-observables"; readonly equality: "exact-canonical-value";
  readonly distance: "complete-equal-zero-complete-different-one-incomplete-null";
  readonly missingness: "strict-indeterminate-v1"; readonly emptyProfile: "indeterminate";
  readonly diagnostics: "retain-comparable-equalities-and-differences";
  readonly vocabulary: "existing-explicit-typed-alignment"; readonly metadata: "excluded-from-distance";
  readonly evidenceRestrictions: "caller-declared-use-only-never-skip-source-or-mapping-verification";
  readonly errors: "throw-no-partial-success"; readonly partialDistance: "unsupported";
  readonly signaturePseudometric: "deferred-to-R6"; readonly ordering: "regime-observable-then-left-right";
  readonly limits: { readonly maxComponents: 7; readonly maxEvidenceGaps: 14; readonly maxCanonicalizerCalls: 5;
    readonly maxCanonicalEntries: 500000; readonly maxArtifactBytes: 4194304 };
}
export type StructuralComparisonReason = TypedAlignmentReason | {
  readonly code: "evidence-unavailable" | "evidence-rejected"; readonly side: "left" | "right";
  readonly reference: string; readonly contentHash: ContentHash;
};
export interface StructuralComparisonSide {
  readonly availability: "observed" | "missing"; readonly disposition: "accepted" | "unavailable" | "rejected";
}
export type StructuralComparisonValue = CanonicalStructureValue | TypedDirectedStructureValue | number | readonly number[];
export type StructuralComparisonFamily = "structure" | "topology" | "typed-relations";
interface ComparisonComponentBody {
  readonly observable: StructuralContractReference & { readonly id: StructuralComparisonObservableId };
  readonly family: StructuralComparisonFamily; readonly mandatory: true;
}
export type StructuralComparisonComponent = ComparisonComponentBody & (
  { readonly state: "equal" | "different";
    readonly left: { readonly availability: "observed"; readonly disposition: "accepted" };
    readonly right: { readonly availability: "observed"; readonly disposition: "accepted" };
    readonly values: { readonly left: StructuralComparisonValue; readonly right: StructuralComparisonValue };
    readonly reasons: readonly [] } |
  { readonly state: "indeterminate"; readonly left: StructuralComparisonSide; readonly right: StructuralComparisonSide;
    readonly values: null; readonly reasons: readonly StructuralComparisonReason[] }
);
export interface StructuralComparisonCoverage {
  readonly numerator: number; readonly denominator: number; readonly complete: boolean;
  readonly families: readonly { readonly family: StructuralComparisonFamily; readonly numerator: number; readonly denominator: number }[];
}
interface StructuralComparisonBody {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-comparison"; readonly version: "1" };
  readonly policy: StructuralComparisonPolicy; readonly regime: StructuralContractReference;
  readonly request: {
    readonly regimeId: StructuralComparisonInput["regimeId"];
    readonly leftScope: StructuralRegimeScope; readonly rightScope: StructuralRegimeScope;
    readonly vocabulary: { readonly mappingHash: ContentHash | null; readonly approvedMappingHash: ContentHash | null } | null;
    readonly evidenceGaps: readonly StructuralComparisonEvidenceGap[];
  };
  readonly evidence:
    { readonly kind: "canonical"; readonly left: CanonicalStructureObservation; readonly right: CanonicalStructureObservation } |
    { readonly kind: "topology"; readonly left: StructuralTopologyObservation; readonly right: StructuralTopologyObservation } |
    { readonly kind: "typed"; readonly alignment: TypedRelationsAlignment };
  readonly components: readonly StructuralComparisonComponent[];
  readonly diagnostics: {
    readonly equalObservableIds: readonly StructuralComparisonObservableId[];
    readonly differentObservableIds: readonly StructuralComparisonObservableId[];
    readonly incompleteObservableIds: readonly StructuralComparisonObservableId[];
  };
  readonly artifactHash: ContentHash;
}
export type StructuralComparison = StructuralComparisonBody & (
  { readonly status: "indistinguishable-under-regime"; readonly distance: 0; readonly coverage: StructuralComparisonCoverage & { readonly complete: true } } |
  { readonly status: "distinguishable-under-regime"; readonly distance: 1; readonly coverage: StructuralComparisonCoverage & { readonly complete: true } } |
  { readonly status: "indeterminate"; readonly distance: null; readonly coverage: StructuralComparisonCoverage & { readonly complete: false } }
);
export const STRUCTURAL_COMPARISON_POLICY: StructuralComparisonPolicy;
export const STRUCTURAL_COMPARISON_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-comparison-input.schema.json";
export const STRUCTURAL_COMPARISON_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-comparison-artifact.schema.json";
export function compareStructuralModels(left: ModelPack, right: ModelPack, input: StructuralComparisonInput): StructuralComparison;
export function verifyStructuralComparison(value: unknown, left: ModelPack, right: ModelPack, input: StructuralComparisonInput): StructuralComparison;
export interface StructuralComparisonAnalysisDefinition {
  readonly id: "structural-comparison"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_COMPARISON_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_COMPARISON_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralComparisonInput): StructuralComparison;
}
export function createStructuralComparisonAnalysis(right: ModelPack): StructuralComparisonAnalysisDefinition;
