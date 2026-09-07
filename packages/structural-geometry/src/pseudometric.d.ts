import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralRegimeInput, StructuralRegimeScope } from "./regimes.js";
import type { StructuralResponseSignatureArtifact, StructuralResponseFeatureId, StructuralResponseFeatureGap } from "./signature.js";

export interface StructuralPseudometricInput {
  readonly regimeId: StructuralRegimeInput["regimeId"];
  readonly leftScope?: StructuralRegimeScope; readonly rightScope?: StructuralRegimeScope;
  readonly diagnostics?: "coverage-only" | "partial-with-coverage";
}
export interface StructuralPseudometricRational { readonly numerator: number; readonly denominator: number }
export interface StructuralPseudometricCoverage { readonly numerator: number; readonly denominator: 3 | 5; readonly complete: boolean }
export type StructuralPseudometricReason = { readonly side: "left" | "right";
  readonly code: StructuralResponseFeatureGap["code"] | "invariance-failed" | "invariance-indeterminate"; readonly count: number } |
  { readonly side: "pair"; readonly code: "incompatible-domain"; readonly count: 1 };
export type StructuralPseudometricSide = { readonly measurement: "observed"; readonly valueHash: ContentHash } |
  { readonly measurement: "indeterminate"; readonly valueHash: null };
export type StructuralPseudometricComponent = { readonly featureId: StructuralResponseFeatureId; readonly weight: 1; readonly scale: 1 } & (
  { readonly state: "equal"; readonly distance: 0; readonly reasons: readonly [];
    readonly left: StructuralPseudometricSide & { readonly measurement: "observed" }; readonly right: StructuralPseudometricSide & { readonly measurement: "observed" } } |
  { readonly state: "different"; readonly distance: 1; readonly reasons: readonly [];
    readonly left: StructuralPseudometricSide & { readonly measurement: "observed" }; readonly right: StructuralPseudometricSide & { readonly measurement: "observed" } } |
  { readonly state: "indeterminate"; readonly distance: null; readonly reasons: readonly StructuralPseudometricReason[];
    readonly left: StructuralPseudometricSide; readonly right: StructuralPseudometricSide }
);
export interface StructuralPseudometricDomain {
  readonly profileHash: ContentHash; readonly vocabulary: StructuralResponseSignatureArtifact["comparisonContext"];
  readonly membership: "complete-signature-with-passed-invariance"; readonly domainHash: ContentHash;
}
export interface StructuralPseudometricPartial {
  readonly kind: "exploratory-pairwise-available-mean"; readonly guarantee: "none";
  readonly coverage: StructuralPseudometricCoverage; readonly value: StructuralPseudometricRational | null;
}
interface StructuralPseudometricBody {
  readonly schemaVersion: "1"; readonly analysis: { readonly id: "structural-pseudometric"; readonly version: "1" }; readonly evaluation: "measured";
  readonly policy: typeof STRUCTURAL_PSEUDOMETRIC_POLICY;
  readonly profile: { readonly policy: StructuralContractReference; readonly regime: StructuralContractReference; readonly signatureProfileHash: ContentHash;
    readonly components: readonly { readonly featureId: StructuralResponseFeatureId; readonly weight: 1; readonly scale: 1 }[]; readonly profileHash: ContentHash };
  readonly request: Required<StructuralPseudometricInput>;
  readonly domains: { readonly left: StructuralPseudometricDomain; readonly right: StructuralPseudometricDomain; readonly compatible: boolean;
    readonly commonDomainHash: ContentHash | null; readonly membership: { readonly left: "eligible" | "ineligible"; readonly right: "eligible" | "ineligible" } };
  readonly evidence: { readonly left: StructuralResponseSignatureArtifact; readonly right: StructuralResponseSignatureArtifact };
  readonly components: readonly StructuralPseudometricComponent[];
  readonly diagnostics: { readonly equalFeatureIds: readonly StructuralResponseFeatureId[]; readonly differentFeatureIds: readonly StructuralResponseFeatureId[];
    readonly incompleteFeatureIds: readonly StructuralResponseFeatureId[]; readonly partial: StructuralPseudometricPartial | null };
  readonly work: { readonly componentComparisons: number; readonly observationEvaluations: number; readonly canonicalizerCalls: number };
  readonly artifactHash: ContentHash;
}
export type StructuralPseudometricArtifact = StructuralPseudometricBody & (
  { readonly status: "indeterminate"; readonly distance: null; readonly coverage: StructuralPseudometricCoverage & { readonly complete: false } } |
  { readonly status: "indistinguishable-under-signature"; readonly distance: { readonly numerator: 0; readonly denominator: 1 };
    readonly coverage: StructuralPseudometricCoverage & { readonly complete: true } } |
  { readonly status: "distinguishable-under-signature"; readonly distance: StructuralPseudometricRational;
    readonly coverage: StructuralPseudometricCoverage & { readonly complete: true } }
);
export const STRUCTURAL_PSEUDOMETRIC_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-pseudometric-input.schema.json";
export const STRUCTURAL_PSEUDOMETRIC_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-pseudometric-artifact.schema.json";
export function compareStructuralSignatures(left: ModelPack, right: ModelPack, input: StructuralPseudometricInput): StructuralPseudometricArtifact;
export function verifyStructuralPseudometric(value: unknown, left: ModelPack, right: ModelPack, input: StructuralPseudometricInput): StructuralPseudometricArtifact;
export interface StructuralPseudometricAnalysisDefinition {
  readonly id: "structural-pseudometric"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_PSEUDOMETRIC_INPUT_SCHEMA; readonly outputArtifacts: readonly [typeof STRUCTURAL_PSEUDOMETRIC_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralPseudometricInput): StructuralPseudometricArtifact;
}
export function createStructuralPseudometricAnalysis(right: ModelPack): StructuralPseudometricAnalysisDefinition;

type PseudometricConstant<T> = { readonly [K in keyof T]: T[K] extends object ? PseudometricConstant<T[K]> : T[K] };
export const STRUCTURAL_PSEUDOMETRIC_POLICY: PseudometricConstant<{
  "id": "fixed-domain-response-pseudometric-v0",
  "version": "1",
  "signature": {
    "id": "graph-native-response-signature-v0",
    "version": "1",
    "contentHash": "sha256:00d8b7982278d47e633bcae4a8cb5bd8152009760e9e215d33a83b85afd9cb20"
  },
  "components": "all-ordered-compatible-signature-families",
  "componentDistance": "exact-joint-multiset-mismatch-zero-or-one",
  "weight": 1,
  "scale": 1,
  "aggregation": "mismatch-count-over-fixed-family-count",
  "numeric": "reduced-bounded-integer-fraction-zero-is-0-over-1",
  "domain": "complete-signature-with-passed-invariance",
  "untypedDomain": "common-fixed-profile",
  "typedDomain": "one-verified-full-source-context",
  "vocabulary": "no-pairwise-mapping-or-approval-override",
  "missingness": "strict-null-distance-retain-component-reasons",
  "partial": "opt-in-pairwise-available-mean-no-metric-guarantee",
  "equality": "exact-values-not-fingerprints",
  "metadata": "excluded-from-distance",
  "errors": "throw-no-partial-artifact",
  "limits": {
    "maxComponents": 5,
    "maxObservationEvaluations": 140,
    "maxCanonicalizerCalls": 280,
    "maxCanonicalEntries": 2000000,
    "maxArtifactBytes": 16777216
  },
  "contentHash": "sha256:f0b827304c6f974a43bddc239846b4b7047a7907be4e82b1a36804289f1b1138"
}>;
