import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralObservableId, StructuralRegimeInput, StructuralRegimePreparation, StructuralTypedField } from "./regimes.js";
import type { StructuralShadowGraph, StructuralSandboxEdgeMapping, StructuralProbeSandboxArtifact } from "./sandbox.js";
import type { CanonicalStructureValue } from "./canonical.js";
import type { TypedDirectedStructureValue } from "./typed.js";

type ResponseConstant<T> = { readonly [K in keyof T]: T[K] extends object ? ResponseConstant<T[K]> : T[K] };
export type StructuralResponseInput = StructuralRegimeInput;
export type StructuralResponseProbeId = "feedback-edge-ablation-v1" | "necessary-parent-ablation-v1" | "enabling-parent-ablation-v1" |
  "edge-direction-reversal-v1" | "redundant-support-path-ablation-v1";
export type StructuralResponseStatus = "changed" | "unchanged" | "indeterminate";
export interface StructuralResponseCoverage {
  readonly numerator: number; readonly denominator: number; readonly complete: boolean;
}
export interface StructuralResponseComponent {
  readonly observableId: StructuralObservableId;
  readonly state: "equal" | "different" | "indeterminate";
  readonly delta: number | null;
}
export interface StructuralResponseMeasurement {
  readonly status: StructuralResponseStatus;
  readonly coverage: StructuralResponseCoverage;
  readonly components: readonly StructuralResponseComponent[];
}
interface ResponseObservationBinding {
  readonly observable: StructuralContractReference & { readonly id: StructuralObservableId };
  readonly implementation: StructuralContractReference;
}
export type StructuralResponseObservationEntry = ResponseObservationBinding & (
  { readonly availability: "observed"; readonly value: CanonicalStructureValue | TypedDirectedStructureValue | number | readonly number[];
    readonly valueHash: ContentHash; readonly missing: readonly [] } |
  { readonly availability: "missing"; readonly value: null; readonly valueHash: null;
    readonly missing: readonly { readonly sourceEdgeId: string; readonly field: StructuralTypedField }[] }
);
export interface StructuralResponseObservation {
  readonly adapter: StructuralContractReference;
  readonly source: { readonly contextHash: ContentHash; readonly scopeHash: ContentHash };
  readonly graphHash: ContentHash;
  readonly observations: readonly StructuralResponseObservationEntry[];
  readonly work: { readonly canonicalizerCalls: 0 | 1 | 2 };
  readonly artifactHash: ContentHash;
}
export type StructuralResponseTarget =
  { readonly kind: "edge"; readonly sourceNodeIds: readonly [string, string]; readonly shadowNodeIds: readonly [string, string];
    readonly sourceEdgeIds: readonly [string]; readonly shadowEdgeIds: readonly [string] } |
  { readonly kind: "simple-directed-path"; readonly sourceNodeIds: readonly string[]; readonly shadowNodeIds: readonly string[];
    readonly sourceEdgeIds: readonly string[]; readonly shadowEdgeIds: readonly string[] };
interface ResponseRunBinding {
  readonly target: StructuralResponseTarget;
  readonly transformation: "remove-edges" | "reverse-edge";
  readonly beforeGraphHash: ContentHash;
  readonly runHash: ContentHash;
}
export type StructuralResponseRun = ResponseRunBinding & (
  { readonly execution: "applied"; readonly rejection: null; readonly graph: StructuralShadowGraph;
    readonly edgeMapping: readonly StructuralSandboxEdgeMapping[];
    readonly changes: { readonly removedSourceEdgeIds: readonly string[]; readonly reversedSourceEdgeIds: readonly string[] };
    readonly observation: StructuralResponseObservation; readonly response: StructuralResponseMeasurement } |
  { readonly execution: "rejected";
    readonly rejection: { readonly code: "parallel-edge-after-reversal"; readonly sourceEdgeIds: readonly [string, string] };
    readonly graph: null; readonly edgeMapping: null; readonly changes: null; readonly observation: null; readonly response: null }
);
export type StructuralResponseEffect =
  { readonly status: StructuralResponseStatus; readonly components: readonly StructuralResponseComponent[]; readonly rejection: null } |
  { readonly status: "rejected"; readonly components: null; readonly rejection: "parallel-edge-after-reversal" };
export interface StructuralResponseProbeResult {
  readonly probe: StructuralContractReference & { readonly id: StructuralResponseProbeId };
  readonly selection: {
    readonly state: "complete" | "unresolved";
    readonly knownEligibleSourceEdgeIds: readonly string[];
    readonly unknownSourceEdgeIds: readonly string[];
  };
  readonly execution:
    { readonly state: "completed"; readonly reason: null; readonly targetCount: number; readonly appliedCount: number; readonly rejectedCount: number } |
    { readonly state: "unavailable"; readonly reason: "no-eligible-targets" | "missing-selector-evidence";
      readonly targetCount: 0; readonly appliedCount: 0; readonly rejectedCount: 0 };
  readonly runs: readonly StructuralResponseRun[];
  readonly summary: {
    readonly status: "observed" | "indeterminate"; readonly coverage: StructuralResponseCoverage;
    readonly counts: { readonly changed: number; readonly unchanged: number; readonly indeterminate: number; readonly rejected: number };
    readonly diagnostics: { readonly effectHistogram: readonly { readonly effect: StructuralResponseEffect; readonly count: number }[] };
  };
  readonly probeHash: ContentHash;
}
export interface StructuralResponseArtifact {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-response-probes"; readonly version: "1" };
  readonly evaluation: "measured";
  readonly policy: typeof STRUCTURAL_RESPONSE_POLICY;
  readonly registry: typeof STRUCTURAL_RESPONSE_REGISTRY;
  readonly adapter: typeof STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER;
  readonly request: StructuralRegimePreparation["request"];
  readonly preparation: StructuralRegimePreparation;
  readonly profile: { readonly regime: StructuralContractReference; readonly probeIds: readonly StructuralResponseProbeId[];
    readonly excludedProbeIds: readonly StructuralResponseProbeId[]; readonly profileHash: ContentHash };
  readonly sandbox: { readonly policy: StructuralContractReference; readonly identityArtifactHash: ContentHash };
  readonly baseline: StructuralProbeSandboxArtifact["baseline"] & { readonly observation: StructuralResponseObservation };
  readonly probes: readonly StructuralResponseProbeResult[];
  readonly summary: {
    readonly status: "observed" | "indeterminate"; readonly coverage: StructuralResponseCoverage;
    readonly targets: { readonly total: number; readonly applied: number; readonly rejected: number };
  };
  readonly work: {
    readonly selection: { readonly pathExtensions: number; readonly reachabilitySearches: number; readonly edgeScans: number };
    readonly transformationEdgeVisits: number; readonly outputGraphCount: number; readonly observationEvaluations: number; readonly canonicalizerCalls: number;
  };
  readonly artifactHash: ContentHash;
}
export const STRUCTURAL_RESPONSE_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-response-input.schema.json";
export const STRUCTURAL_RESPONSE_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-response-artifact.schema.json";
export function runStructuralResponseProbes(pack: ModelPack, input: StructuralResponseInput): StructuralResponseArtifact;
export function verifyStructuralResponseProbes(value: unknown, pack: ModelPack, input: StructuralResponseInput): StructuralResponseArtifact;
export interface StructuralResponseAnalysisDefinition {
  readonly id: "structural-response-probes"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_RESPONSE_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_RESPONSE_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralResponseInput): StructuralResponseArtifact;
}
export function createStructuralResponseAnalysis(): StructuralResponseAnalysisDefinition;

export const STRUCTURAL_RESPONSE_POLICY: ResponseConstant<{
  "id": "graph-native-response-probes-v1",
  "version": "1",
  "registry": {
    "id": "structural-response-probes-v1",
    "version": "1",
    "contentHash": "sha256:64d61ee79577b6e1239c1a3e7b95387e1bd7e6e330fc156c0a7208f8fd5bde8e"
  },
  "source": "verified-identity-sandbox-with-unchanged-preparation",
  "copies": "every-target-starts-from-baseline",
  "selection": "exhaustive-preflight-before-observation",
  "missingSelector": "unresolved-no-partial-target-set",
  "emptySelector": "unavailable-no-measured-zero",
  "constraintMeaning": "declared-necessary-and-enabling-dependencies-only",
  "reversal": "carry-types-without-semantic-recoding-reject-parallel-edges",
  "observation": "all-ordered-mandatory-regime-observables",
  "delta": "after-minus-before-for-scalar-integers-only",
  "response": "complete-changed-or-unchanged-incomplete-indeterminate",
  "probeCoverage": "comparable-observable-pairs-over-all-targets",
  "overallCoverage": "fully-observed-compatible-probes",
  "histogram": "diagnostic-multiset-of-component-states-scalar-deltas-and-rejections",
  "coordinates": "exclude-source-identifiers-provenance-hashes-and-work",
  "signature": "deferred-to-SG2-024",
  "codeExecution": "closed-data-operations-only",
  "errors": "throw-no-partial-artifact",
  "limits": {
    "maxTargetsPerProbe": 32,
    "maxTargets": 64,
    "maxTransformationEdgeVisits": 2048,
    "maxPathExtensions": 4096,
    "maxSelectionEdgeScans": 131072,
    "maxObservationEvaluations": 65,
    "maxCanonicalizerCalls": 130,
    "maxCanonicalEntries": 500000,
    "maxArtifactBytes": 4194304
  },
  "contentHash": "sha256:37059b8e846b1d100c3e6599258e223f653746a2df0243a54e220add09ea1b4c"
}>;
export const STRUCTURAL_RESPONSE_REGISTRY: ResponseConstant<{
  "id": "structural-response-probes-v1",
  "version": "1",
  "probes": [
    {
      "id": "feedback-edge-ablation-v1",
      "version": "1",
      "family": "response",
      "question": "feedback",
      "selector": "return-path",
      "transformation": "remove-edges",
      "regimeIds": [
        "canonical-structure-v1",
        "topology-only-v1",
        "typed-relations-v1"
      ],
      "mandatoryWhenCompatible": true,
      "targets": "every-eligible-target-independently",
      "parameters": {
        "scope": "internal-edges-only",
        "nodes": "retain-all",
        "path": "single-edge"
      },
      "contentHash": "sha256:e34b09111206809eefb62c085a1579fef8ffd1abd00bcd0668d84970eb39ffb8"
    },
    {
      "id": "necessary-parent-ablation-v1",
      "version": "1",
      "family": "response",
      "question": "declared-dependency-constraint",
      "selector": "necessity-necessary",
      "transformation": "remove-edges",
      "regimeIds": [
        "typed-relations-v1"
      ],
      "mandatoryWhenCompatible": true,
      "targets": "every-eligible-target-independently",
      "parameters": {
        "scope": "internal-edges-only",
        "nodes": "retain-all",
        "path": "single-edge"
      },
      "contentHash": "sha256:3ee91de04581d927b52be13da134ccb353c9eaa833b19748339d65a59270748b"
    },
    {
      "id": "enabling-parent-ablation-v1",
      "version": "1",
      "family": "response",
      "question": "declared-dependency-constraint",
      "selector": "necessity-enabling",
      "transformation": "remove-edges",
      "regimeIds": [
        "typed-relations-v1"
      ],
      "mandatoryWhenCompatible": true,
      "targets": "every-eligible-target-independently",
      "parameters": {
        "scope": "internal-edges-only",
        "nodes": "retain-all",
        "path": "single-edge"
      },
      "contentHash": "sha256:62b34a1e365e74604705626d28f3e239762f224888d25e9c883c321a262fda04"
    },
    {
      "id": "edge-direction-reversal-v1",
      "version": "1",
      "family": "response",
      "question": "direction",
      "selector": "each-internal-edge",
      "transformation": "reverse-edge",
      "regimeIds": [
        "canonical-structure-v1",
        "topology-only-v1",
        "typed-relations-v1"
      ],
      "mandatoryWhenCompatible": true,
      "targets": "every-eligible-target-independently",
      "parameters": {
        "scope": "internal-edges-only",
        "nodes": "retain-all",
        "path": "single-edge"
      },
      "contentHash": "sha256:d9b288a8dfe06aa50f00206edf05900db8d2e2eb7096de222a059917f0904aa9"
    },
    {
      "id": "redundant-support-path-ablation-v1",
      "version": "1",
      "family": "response",
      "question": "support-path",
      "selector": "simple-path-with-edge-disjoint-alternative",
      "transformation": "remove-edges",
      "regimeIds": [
        "canonical-structure-v1",
        "topology-only-v1",
        "typed-relations-v1"
      ],
      "mandatoryWhenCompatible": true,
      "targets": "every-eligible-target-independently",
      "parameters": {
        "scope": "internal-edges-only",
        "nodes": "retain-all",
        "path": "nonempty-distinct-vertices-all-lengths"
      },
      "contentHash": "sha256:370b3e2fc6cb4f9dcca380a8a4419c9d0dc78d24c9dd9a153dd57e627695bab1"
    }
  ],
  "contentHash": "sha256:64d61ee79577b6e1239c1a3e7b95387e1bd7e6e330fc156c0a7208f8fd5bde8e"
}>;
export const STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER: ResponseConstant<{
  "id": "response-shadow-observation-adapter-v1",
  "version": "1",
  "input": "private-verified-source-bound-shadow-graph",
  "graph": "all-retained-nodes-directed-endpoints-and-present-joint-types",
  "vocabulary": "unchanged-source-context",
  "missing": "source-edge-and-field-with-null-value",
  "profile": "all-ordered-mandatory-regime-observables",
  "delta": "after-minus-before-scalar-integers-only",
  "otherAttributes": "excluded",
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
  "contentHash": "sha256:dbe19f3c95fb97213d7b4631119124e3e3b3e36237caae0009de867868b0b68b"
}>;
