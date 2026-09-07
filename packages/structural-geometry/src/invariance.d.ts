import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralObservableId, StructuralRegimeInput, StructuralRegimePreparation, StructuralTypedField } from "./regimes.js";
import type { CanonicalStructureValue } from "./canonical.js";
import type { TypedDirectedStructureValue } from "./typed.js";

type InvarianceConstant<T> = { readonly [K in keyof T]: T[K] extends object ? InvarianceConstant<T[K]> : T[K] };
export type StructuralInvarianceInput = StructuralRegimeInput;
export type StructuralInvarianceStatus = "passed" | "failed" | "indeterminate";
export interface StructuralInvarianceSummary {
  readonly status: StructuralInvarianceStatus;
  readonly coverage: { readonly numerator: number; readonly denominator: number };
}
export interface StructuralInvarianceRepresentation {
  readonly payload: string; readonly payloadHash: ContentHash; readonly graphHash: ContentHash;
}
interface ShadowObservationBinding {
  readonly observable: StructuralContractReference & { readonly id: StructuralObservableId };
  readonly implementation: StructuralContractReference;
}
export type StructuralShadowObservationEntry = ShadowObservationBinding & (
  { readonly availability: "observed"; readonly value: CanonicalStructureValue | TypedDirectedStructureValue | number | readonly number[];
    readonly valueHash: ContentHash; readonly missing: readonly [] } |
  { readonly availability: "missing"; readonly value: null; readonly valueHash: null;
    readonly missing: readonly { readonly sourceEdgeId: string; readonly field: StructuralTypedField }[] }
);
export interface StructuralShadowObservation {
  readonly adapter: StructuralContractReference;
  readonly source: { readonly contextHash: ContentHash; readonly scopeHash: ContentHash };
  readonly payloadHash: ContentHash;
  readonly observations: readonly StructuralShadowObservationEntry[];
  readonly work: { readonly canonicalizerCalls: 0 | 1 | 2 };
  readonly artifactHash: ContentHash;
}
export interface StructuralInvarianceRun {
  readonly probe: StructuralContractReference;
  readonly target: "whole-scoped-representation";
  readonly beforePayloadHash: ContentHash;
  readonly representation: StructuralInvarianceRepresentation;
  readonly mapping: {
    readonly nodes: readonly { readonly sourceNodeId: string; readonly beforeId: string; readonly afterId: string }[];
    readonly edges: readonly { readonly sourceEdgeId: string; readonly beforeId: string; readonly afterId: string }[];
  };
  readonly observation: StructuralShadowObservation;
  readonly payloadChanged: boolean;
  readonly comparison: StructuralInvarianceSummary & {
    readonly components: readonly { readonly observableId: StructuralObservableId; readonly state: "equal" | "different" | "indeterminate" }[];
  };
  readonly runHash: ContentHash;
}
export interface StructuralInvarianceArtifact {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-invariance-probes"; readonly version: "1" };
  readonly evaluation: "measured";
  readonly policy: typeof STRUCTURAL_INVARIANCE_POLICY;
  readonly registry: typeof STRUCTURAL_INVARIANCE_REGISTRY;
  readonly adapter: typeof STRUCTURAL_SHADOW_OBSERVATION_ADAPTER;
  readonly sandbox: { readonly policy: StructuralContractReference; readonly artifactHash: ContentHash };
  readonly request: StructuralRegimePreparation["request"];
  readonly preparation: StructuralRegimePreparation;
  readonly baseline: {
    readonly sourceShadowGraphHash: ContentHash;
    readonly mapping: {
      readonly nodes: readonly { readonly sourceNodeId: string; readonly shadowNodeId: string }[];
      readonly edges: readonly { readonly sourceEdgeId: string; readonly shadowEdgeId: string }[];
    };
    readonly representation: StructuralInvarianceRepresentation;
    readonly observation: StructuralShadowObservation;
  };
  readonly runs: readonly [StructuralInvarianceRun, StructuralInvarianceRun, StructuralInvarianceRun, StructuralInvarianceRun];
  readonly summary: StructuralInvarianceSummary;
  readonly work: { readonly representationCount: 5; readonly observationEvaluations: 5; readonly canonicalizerCalls: 0 | 5 | 10 };
  readonly artifactHash: ContentHash;
}
export const STRUCTURAL_INVARIANCE_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-invariance-input.schema.json";
export const STRUCTURAL_INVARIANCE_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-invariance-artifact.schema.json";
export function runStructuralInvarianceProbes(pack: ModelPack, input: StructuralInvarianceInput): StructuralInvarianceArtifact;
export function verifyStructuralInvarianceProbes(value: unknown, pack: ModelPack, input: StructuralInvarianceInput): StructuralInvarianceArtifact;
export interface StructuralInvarianceAnalysisDefinition {
  readonly id: "structural-invariance-probes"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_INVARIANCE_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_INVARIANCE_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralInvarianceInput): StructuralInvarianceArtifact;
}
export function createStructuralInvarianceAnalysis(): StructuralInvarianceAnalysisDefinition;

export const STRUCTURAL_INVARIANCE_POLICY: InvarianceConstant<{
  "id": "measured-structural-invariance-v1",
  "version": "1",
  "registry": {
    "id": "structural-invariance-probes-v1",
    "version": "1",
    "contentHash": "sha256:bec1366254a158eb1df77ad709cb229fb8cd636dc0411a1a5c2c5b4f4f6b4862"
  },
  "source": "verified-identity-sandbox",
  "copies": "every-probe-starts-from-baseline",
  "targets": "all-scoped-records",
  "payload": "exact-json-string-with-synthetic-presentation",
  "graphHash": "identifier-sensitive-provenance-excludes-presentation",
  "comparison": "all-mandatory-observables-exact-values",
  "missingness": "strict-indeterminate-retain-differences",
  "emptyProfile": "indeterminate",
  "emptyEdgeRename": "explicit-no-op",
  "vocabulary": "same-source-context-only",
  "codeExecution": "closed-data-transformations-only",
  "errors": "throw-no-partial-artifact",
  "limits": {
    "maxRepresentations": 5,
    "maxObservationEvaluations": 5,
    "maxCanonicalizerCalls": 10,
    "maxCanonicalEntries": 500000,
    "maxArtifactBytes": 4194304
  },
  "contentHash": "sha256:34c87772235e3c8f0f0d01384c063a8a95c1d81ab9cb58c0ed22d1a3f3b013c3"
}>;
export const STRUCTURAL_INVARIANCE_REGISTRY: InvarianceConstant<{
  "id": "structural-invariance-probes-v1",
  "version": "1",
  "regimeIds": [
    "canonical-structure-v1",
    "topology-only-v1",
    "typed-relations-v1"
  ],
  "probes": [
    {
      "id": "record-order-probe-v1",
      "version": "1",
      "family": "invariance",
      "mandatory": true,
      "transformation": "record-order",
      "target": "whole-scoped-representation",
      "parameters": {
        "records": "reverse-node-and-edge-arrays",
        "keys": "reverse-recursively",
        "whitespace": "two-space-indentation"
      },
      "contentHash": "sha256:418c8184b377acf5bf73ad19f5b0e7d103624aac4a87f6c4a7461362f2224851"
    },
    {
      "id": "bijective-node-id-renaming-probe-v1",
      "version": "1",
      "family": "invariance",
      "mandatory": true,
      "transformation": "bijective-node-id-renaming",
      "target": "whole-scoped-representation",
      "parameters": {
        "namespace": "vertex:",
        "ordinal": "reversed-zero-based-padded-three",
        "endpoints": "transport-both"
      },
      "contentHash": "sha256:a69c1e750d074e5aa529b5c75b7b9149d63d292e44463e7aa915c24ea2c665d3"
    },
    {
      "id": "bijective-edge-id-renaming-probe-v1",
      "version": "1",
      "family": "invariance",
      "mandatory": true,
      "transformation": "bijective-edge-id-renaming",
      "target": "whole-scoped-representation",
      "parameters": {
        "namespace": "link:",
        "ordinal": "reversed-zero-based-padded-three"
      },
      "contentHash": "sha256:3476096b64e3c82a6844cfaad862536d800c531486ed756a90fc71d37538491c"
    },
    {
      "id": "presentation-only-changes-probe-v1",
      "version": "1",
      "family": "invariance",
      "mandatory": true,
      "transformation": "presentation-only-changes",
      "target": "whole-scoped-representation",
      "parameters": {
        "labels": "replace",
        "positions": "reflect-and-translate",
        "colors": "replace",
        "zoom": "replace"
      },
      "contentHash": "sha256:a23a0ab9cd7c305a11d7a64f2a96dd9536c29824b3c88effb4b397db575c852b"
    }
  ],
  "contentHash": "sha256:bec1366254a158eb1df77ad709cb229fb8cd636dc0411a1a5c2c5b4f4f6b4862"
}>;
export const STRUCTURAL_SHADOW_OBSERVATION_ADAPTER: InvarianceConstant<{
  "id": "invariance-shadow-observation-adapter-v1",
  "version": "1",
  "input": "private-source-bound-representation",
  "decoding": "parse-each-exact-json-payload-before-evaluation",
  "presentation": "exclude-node-and-edge-presentation-and-viewport",
  "graph": "preserve-all-node-ids-directed-endpoints-and-five-present-typed-fields",
  "typedVocabulary": "unchanged-verified-source-context",
  "missing": "source-edge-and-field-with-null-value",
  "implementations": [
    {
      "id": "canonical-directed-observation-v1",
      "version": "1",
      "contentHash": "sha256:c24eb843608db1252a279b2f48f717f13d675680cd7607cec6d46d84c26d9a4d"
    },
    {
      "id": "directed-topology-observation-v1",
      "version": "1",
      "contentHash": "sha256:56e0a358ae1c6f3618fb792c319bedc2d1e06db637b8410de1a39d4a69f3a4e8"
    },
    {
      "id": "typed-directed-observation-v1",
      "version": "1",
      "contentHash": "sha256:953f5ae6ad1fee7069058ac66116848c7b3981850feaf9a1c84d216325ba60e3"
    }
  ],
  "contentHash": "sha256:f50bd13d6e5af467781922e8c1586916532face8b8fd11ac2a69961f318d75df"
}>;
