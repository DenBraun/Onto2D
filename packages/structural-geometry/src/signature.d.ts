import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralRegimeInput, StructuralRegimePreparation, StructuralContractReference, StructuralObservableId } from "./regimes.js";
import type { StructuralResponseArtifact, StructuralResponseCoverage, StructuralResponseProbeId } from "./responses.js";
import type { StructuralInvarianceArtifact, StructuralInvarianceStatus } from "./invariance.js";

type SignatureConstant<T> = { readonly [K in keyof T]: T[K] extends object ? SignatureConstant<T[K]> : T[K] };
export type StructuralResponseSignatureInput = StructuralRegimeInput;
export type StructuralResponseFeatureId = "feedback-response-multiset-v0" | "necessary-response-multiset-v0" |
  "enabling-response-multiset-v0" | "direction-response-multiset-v0" | "support-response-multiset-v0";
export interface StructuralResponseFeatureRow {
  readonly components: readonly { readonly observableId: StructuralObservableId; readonly state: "equal" | "different"; readonly delta: number | null }[];
  readonly count: number;
}
export interface StructuralResponseFeatureGap {
  readonly code: "no-eligible-targets" | "missing-selector-evidence" | "rejected-transformations" | "missing-observations";
  readonly count: number;
}
interface FeatureBinding {
  readonly id: StructuralResponseFeatureId;
  readonly probeId: StructuralResponseProbeId;
  readonly coverage: StructuralResponseCoverage;
  readonly evidence: { readonly probeHash: ContentHash };
}
export type StructuralResponseSignatureFeature = FeatureBinding & (
  { readonly state: "observed"; readonly value: readonly StructuralResponseFeatureRow[]; readonly valueHash: ContentHash; readonly reasons: readonly [] } |
  { readonly state: "indeterminate"; readonly value: null; readonly valueHash: null; readonly reasons: readonly StructuralResponseFeatureGap[] }
);
export interface StructuralResponseSignatureValue {
  readonly features: readonly { readonly id: StructuralResponseFeatureId; readonly value: readonly StructuralResponseFeatureRow[] }[];
}
export interface StructuralResponseSignatureSummary {
  readonly status: "complete" | "indeterminate";
  readonly coverage: StructuralResponseCoverage;
  readonly invarianceStatus: StructuralInvarianceStatus;
  readonly reasons: readonly ("incomplete-response-features" | "invariance-failed" | "invariance-indeterminate")[];
}
export interface StructuralResponseSignatureArtifact {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-response-signature"; readonly version: "1" };
  readonly evaluation: "measured";
  readonly policy: typeof STRUCTURAL_RESPONSE_SIGNATURE_POLICY;
  readonly request: StructuralRegimePreparation["request"];
  readonly source: { readonly contextHash: ContentHash; readonly scopeHash: ContentHash };
  readonly profile: {
    readonly policy: StructuralContractReference; readonly regime: StructuralContractReference;
    readonly features: readonly { readonly id: StructuralResponseFeatureId; readonly probe: StructuralContractReference;
      readonly observables: readonly StructuralContractReference[] }[];
    readonly profileHash: ContentHash;
  };
  readonly comparisonContext: { readonly kind: "untyped-graph" } | { readonly kind: "source-local-typed"; readonly contextHash: ContentHash };
  readonly evidence: { readonly responses: StructuralResponseArtifact; readonly invariance: StructuralInvarianceArtifact };
  readonly features: readonly StructuralResponseSignatureFeature[];
  readonly summary: StructuralResponseSignatureSummary;
  readonly value: StructuralResponseSignatureValue | null;
  readonly valueHash: ContentHash | null;
  readonly work: { readonly featureRows: number; readonly featureComponentVisits: number; readonly observationEvaluations: number; readonly canonicalizerCalls: number };
  readonly artifactHash: ContentHash;
}
export const STRUCTURAL_RESPONSE_SIGNATURE_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-response-signature-input.schema.json";
export const STRUCTURAL_RESPONSE_SIGNATURE_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-response-signature-artifact.schema.json";
export function runStructuralResponseSignature(pack: ModelPack, input: StructuralResponseSignatureInput): StructuralResponseSignatureArtifact;
export function verifyStructuralResponseSignature(value: unknown, pack: ModelPack, input: StructuralResponseSignatureInput): StructuralResponseSignatureArtifact;
export interface StructuralResponseSignatureAnalysisDefinition {
  readonly id: "structural-response-signature"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_RESPONSE_SIGNATURE_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_RESPONSE_SIGNATURE_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralResponseSignatureInput): StructuralResponseSignatureArtifact;
}
export function createStructuralResponseSignatureAnalysis(): StructuralResponseSignatureAnalysisDefinition;

export const STRUCTURAL_RESPONSE_SIGNATURE_POLICY: SignatureConstant<{
  "id": "graph-native-response-signature-v0",
  "version": "1",
  "response": {
    "policy": {
      "id": "graph-native-response-probes-v1",
      "version": "1",
      "contentHash": "sha256:37059b8e846b1d100c3e6599258e223f653746a2df0243a54e220add09ea1b4c"
    },
    "registry": {
      "id": "structural-response-probes-v1",
      "version": "1",
      "contentHash": "sha256:64d61ee79577b6e1239c1a3e7b95387e1bd7e6e330fc156c0a7208f8fd5bde8e"
    },
    "adapter": {
      "id": "response-shadow-observation-adapter-v1",
      "version": "1",
      "contentHash": "sha256:dbe19f3c95fb97213d7b4631119124e3e3b3e36237caae0009de867868b0b68b"
    }
  },
  "invariance": {
    "policy": {
      "id": "measured-structural-invariance-v1",
      "version": "1",
      "contentHash": "sha256:34c87772235e3c8f0f0d01384c063a8a95c1d81ab9cb58c0ed22d1a3f3b013c3"
    },
    "registry": {
      "id": "structural-invariance-probes-v1",
      "version": "1",
      "contentHash": "sha256:bec1366254a158eb1df77ad709cb229fb8cd636dc0411a1a5c2c5b4f4f6b4862"
    },
    "adapter": {
      "id": "invariance-shadow-observation-adapter-v1",
      "version": "1",
      "contentHash": "sha256:f50bd13d6e5af467781922e8c1586916532face8b8fd11ac2a69961f318d75df"
    }
  },
  "features": [
    {
      "id": "feedback-response-multiset-v0",
      "probe": {
        "id": "feedback-edge-ablation-v1",
        "version": "1",
        "contentHash": "sha256:e34b09111206809eefb62c085a1579fef8ffd1abd00bcd0668d84970eb39ffb8"
      },
      "regimeIds": [
        "canonical-structure-v1",
        "topology-only-v1",
        "typed-relations-v1"
      ],
      "mandatory": true,
      "value": "joint-complete-response-multiset",
      "multiplicity": "exact-positive-integer-count",
      "coordinates": "ordered-observable-id-state-scalar-delta",
      "applicability": "nonempty-exhaustive-applied-complete-targets"
    },
    {
      "id": "necessary-response-multiset-v0",
      "probe": {
        "id": "necessary-parent-ablation-v1",
        "version": "1",
        "contentHash": "sha256:3ee91de04581d927b52be13da134ccb353c9eaa833b19748339d65a59270748b"
      },
      "regimeIds": [
        "typed-relations-v1"
      ],
      "mandatory": true,
      "value": "joint-complete-response-multiset",
      "multiplicity": "exact-positive-integer-count",
      "coordinates": "ordered-observable-id-state-scalar-delta",
      "applicability": "nonempty-exhaustive-applied-complete-targets"
    },
    {
      "id": "enabling-response-multiset-v0",
      "probe": {
        "id": "enabling-parent-ablation-v1",
        "version": "1",
        "contentHash": "sha256:62b34a1e365e74604705626d28f3e239762f224888d25e9c883c321a262fda04"
      },
      "regimeIds": [
        "typed-relations-v1"
      ],
      "mandatory": true,
      "value": "joint-complete-response-multiset",
      "multiplicity": "exact-positive-integer-count",
      "coordinates": "ordered-observable-id-state-scalar-delta",
      "applicability": "nonempty-exhaustive-applied-complete-targets"
    },
    {
      "id": "direction-response-multiset-v0",
      "probe": {
        "id": "edge-direction-reversal-v1",
        "version": "1",
        "contentHash": "sha256:d9b288a8dfe06aa50f00206edf05900db8d2e2eb7096de222a059917f0904aa9"
      },
      "regimeIds": [
        "canonical-structure-v1",
        "topology-only-v1",
        "typed-relations-v1"
      ],
      "mandatory": true,
      "value": "joint-complete-response-multiset",
      "multiplicity": "exact-positive-integer-count",
      "coordinates": "ordered-observable-id-state-scalar-delta",
      "applicability": "nonempty-exhaustive-applied-complete-targets"
    },
    {
      "id": "support-response-multiset-v0",
      "probe": {
        "id": "redundant-support-path-ablation-v1",
        "version": "1",
        "contentHash": "sha256:370b3e2fc6cb4f9dcca380a8a4419c9d0dc78d24c9dd9a153dd57e627695bab1"
      },
      "regimeIds": [
        "canonical-structure-v1",
        "topology-only-v1",
        "typed-relations-v1"
      ],
      "mandatory": true,
      "value": "joint-complete-response-multiset",
      "multiplicity": "exact-positive-integer-count",
      "coordinates": "ordered-observable-id-state-scalar-delta",
      "applicability": "nonempty-exhaustive-applied-complete-targets"
    }
  ],
  "aggregation": "canonical-joint-row-grouping-with-multiplicity",
  "missingness": "null-whole-feature-no-partial-histogram-or-default-zero",
  "coverage": "observed-features-over-fixed-compatible-profile",
  "eligibility": "all-features-observed-and-all-invariance-controls-passed",
  "valueHash": "fixed-profile-and-value-only-no-provenance-or-availability",
  "typedComparison": "source-local-vocabulary-authority-required-separately",
  "evidence": "complete-source-bound-response-and-invariance-artifacts",
  "integrations": "graph-native-only-history-motif-admissibility-identity-unconfigured",
  "geometry": "excluded",
  "distance": "deferred-to-R6",
  "limits": {
    "maxFeatures": 5,
    "maxFeatureRows": 64,
    "maxFeatureComponentVisits": 448,
    "maxObservationEvaluations": 70,
    "maxCanonicalizerCalls": 140,
    "maxCanonicalEntries": 1000000,
    "maxArtifactBytes": 8388608
  },
  "contentHash": "sha256:00d8b7982278d47e633bcae4a8cb5bd8152009760e9e215d33a83b85afd9cb20"
}>;
