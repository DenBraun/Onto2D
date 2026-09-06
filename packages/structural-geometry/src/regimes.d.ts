import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralMetricContextBinding } from "./providers.js";

export type DistinguishabilityRegimeId = "canonical-structure-v1" | "topology-only-v1" | "typed-relations-v1";
export type StructuralObservableId = "canonical-directed-structure-v1" | "node-count-v1" | "edge-count-v1" |
  "weak-component-sizes-v1" | "strong-component-sizes-v1" | "reachable-ordered-pair-count-v1" |
  "cyclic-node-count-v1" | "isolated-node-count-v1" | "canonical-typed-directed-structure-v1";
export interface StructuralContractReference {
  readonly id: string; readonly version: "1"; readonly contentHash: ContentHash;
}
export interface StructuralObservationSpec extends StructuralContractReference {
  readonly schemaVersion: "1";
  readonly id: StructuralObservableId;
  readonly valueType: "canonical-directed-graph" | "canonical-typed-directed-graph" | "nonnegative-integer" | "sorted-positive-integer-vector";
  readonly scope: "whole-scoped-directed-graph";
  readonly units: "discrete-structure" | "nodes" | "edges" | "ordered-node-pairs";
  readonly normalization: "none"; readonly mandatory: true;
  readonly requiredEvidence: readonly ("verified-scoped-directed-projection" | "complete-declared-edge-types" |
    "bound-local-dictionaries" | "compatible-vocabulary-for-comparison")[];
  readonly supplier: StructuralContractReference & { readonly operation: StructuralObservableId; readonly definition: string };
  readonly definition: string;
}
export type StructuralTypedField = "dependencyTypeId" | "interactionModeIds" | "ontologicalRole" | "necessity" | "causalDirectionIds";
interface StructuralExactMatchingPolicy extends StructuralContractReference {
  readonly id: "directed-candidate-matching-v1" | "directed-typed-candidate-matching-v1";
  readonly equivalence: "directed-graph-isomorphism" | "edge-annotated-directed-graph-isomorphism";
  readonly direction: "preserved";
  readonly nodeMatching: "all-bijections" | "one-common-bijection-for-topology-and-types";
  readonly edgeMatching: "mapped-ordered-endpoints";
  readonly sourceIdentifiers: "provenance-only"; readonly disconnectedGraphs: "allowed";
  readonly candidateTranslation: { readonly domain: "single-candidate"; readonly nodeRef: ContentHash;
    readonly edgeRole: "source-parent"; readonly nodeAttributes: readonly [];
    readonly edgeAttributes: readonly StructuralTypedField[];
    readonly setAttributeEncoding?: "canonical-json-string-of-sorted-integer-array" };
  readonly graphPolicy: { readonly connected: false; readonly allowParallelEdges: false; readonly allowSelfLoops: false;
    readonly connectivityProjection: "directed-weak"; readonly structuralNodeAttributes: readonly [];
    readonly structuralEdgeAttributes: readonly StructuralTypedField[] };
  readonly setValuedFields?: readonly ["interactionModeIds", "causalDirectionIds"];
  readonly setOrdering?: "ascending-distinct-integer-codes";
  readonly algorithm: "kernel-canonicalizeCandidate";
  readonly exhaustion: "error-no-heuristic-identity";
}
interface StructuralSummaryMatchingPolicy extends StructuralContractReference {
  readonly id: "directed-summary-matching-v1";
  readonly equivalence: "ordered-observable-profile-equality"; readonly direction: "preserved";
  readonly nodeMatching: "none"; readonly edgeMatching: "none"; readonly sourceIdentifiers: "provenance-only";
  readonly graphIsomorphismClaim: false; readonly exhaustion: "error-no-partial-profile";
}
export type StructuralMatchingPolicy = StructuralExactMatchingPolicy | StructuralSummaryMatchingPolicy;
export type StructuralVocabularyPolicy = (StructuralContractReference & {
  readonly id: "untyped-vocabulary-v1"; readonly meaning: "excluded-from-observations";
}) | (StructuralContractReference & {
  readonly id: "model-local-typed-vocabulary-v1"; readonly fields: readonly StructuralTypedField[];
  readonly localBinding: "verified-full-model-dictionary-hash";
  readonly codeType: "nonnegative-safe-integer"; readonly setDuplicates: "validation-error";
  readonly roleUniverse: readonly ["arising", "maintenance", "modulation"];
  readonly necessityUniverse: readonly ["necessary", "enabling", "contextual", "optional"];
  readonly crossModel: "requires-explicit-reviewed-shared-vocabulary-or-mapping";
  readonly equalDictionaryBytesAlone: "insufficient-cross-model-authority";
  readonly missingCompatibility: "indeterminate"; readonly epistemicStatus: "excluded-from-observations";
  readonly missingField: "missing-mandatory-evidence"; readonly emptyDeclaredSet: "observed-empty-set";
  readonly invalidField: "validation-error";
});
export interface DistinguishabilityRegime extends StructuralContractReference {
  readonly schemaVersion: "1"; readonly id: DistinguishabilityRegimeId;
  readonly projectionPolicy: StructuralContractReference & { readonly id: "source-parent-directed-v1" };
  readonly scopePolicy: StructuralContractReference & {
    readonly sourceVerification: "complete-model-before-scoping";
    readonly membership: "explicit-node-set-or-full-source"; readonly edges: "both-endpoints-in-scope";
    readonly isolatedNodes: "retained"; readonly boundary: "partition-incoming-outgoing-external-edges";
    readonly implicitTruncation: "forbidden";
  };
  readonly matchingPolicy: StructuralMatchingPolicy;
  readonly vocabularyPolicy: StructuralVocabularyPolicy;
  readonly observables: readonly (StructuralContractReference & { readonly id: StructuralObservableId })[];
  readonly invariancePolicy: StructuralContractReference & {
    readonly transformations: readonly ["record-order", "bijective-node-id-renaming", "bijective-edge-id-renaming", "presentation-only-changes"];
    readonly actsOn: "scoped-graph-with-transported-scope-membership";
    readonly provenanceHashes: "may-change"; readonly probeExecution: "not-implied-by-declaration";
  };
  readonly probeSets: {
    readonly invariance: StructuralContractReference & { readonly probes: readonly []; readonly execution: "none" };
    readonly response: StructuralContractReference & { readonly probes: readonly []; readonly execution: "none" };
  };
  readonly missingnessPolicy: StructuralContractReference & {
    readonly mandatoryGaps: readonly ["missing", "unavailable", "rejected", "unresolved"];
    readonly incompleteStatus: "indeterminate"; readonly incompleteDistance: null;
    readonly observedDifferences: "retain-as-diagnostics"; readonly invalidArtifact: "validation-error";
    readonly emptyProfile: "indeterminate"; readonly coverage: "per-component-with-reasons";
    readonly partialDistance: "not-supported";
  };
  readonly aggregationPolicy: StructuralContractReference & {
    readonly completeEqualStatus: "indistinguishable-under-regime";
    readonly completeDifferentStatus: "distinguishable-under-regime";
    readonly numericPolicy: "exact-discrete"; readonly tolerance: "none"; readonly intervals: "unsupported";
    readonly distanceConstruction: "deferred-to-comparison-contract";
  };
  readonly limits: { readonly minNodes: 1; readonly maxNodes: 6 | 64; readonly maxEdges: 30 | 256;
    readonly maxSearchStates: 0 | 100000; readonly maxReachabilityPairVisits: 0 | 4096;
    readonly maxCanonicalEntries: 100000; readonly maxArtifactBytes: 1048576 };
}
export type StructuralRegimeScope = { readonly kind: "full" } | { readonly kind: "induced"; readonly nodeIds: readonly string[] };
export interface StructuralRegimeInput { readonly regimeId: DistinguishabilityRegimeId; readonly scope?: StructuralRegimeScope }
export interface StructuralRegimePreparation {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-regime-preparation"; readonly version: "1" };
  readonly evaluation: "not-run";
  readonly request: { readonly regimeId: DistinguishabilityRegimeId; readonly scope: StructuralRegimeScope };
  readonly regime: DistinguishabilityRegime;
  readonly context: StructuralMetricContextBinding;
  readonly scope: { readonly kind: "full" | "induced"; readonly sourceProjectionHash: ContentHash;
    readonly sourceNodeCount: number; readonly sourceEdgeCount: number;
    readonly nodeIds: readonly string[]; readonly edgeIds: readonly string[];
    readonly incomingBoundaryEdgeIds: readonly string[]; readonly outgoingBoundaryEdgeIds: readonly string[];
    readonly externalEdgeIds: readonly string[]; readonly scopeHash: ContentHash };
  readonly observableSpecs: readonly StructuralObservationSpec[];
  readonly artifactHash: ContentHash;
}
export const DISTINGUISHABILITY_REGIMES: readonly DistinguishabilityRegime[];
export const STRUCTURAL_OBSERVABLE_SPECS: readonly StructuralObservationSpec[];
export const STRUCTURAL_OBSERVATION_SPEC_SCHEMA: "https://onto2d.dev/schemas/v1/structural-observation-spec.schema.json";
export const DISTINGUISHABILITY_REGIME_SCHEMA: "https://onto2d.dev/schemas/v1/distinguishability-regime.schema.json";
export const STRUCTURAL_REGIME_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-regime-input.schema.json";
export const STRUCTURAL_REGIME_PREPARATION_SCHEMA: "https://onto2d.dev/schemas/v1/structural-regime-preparation.schema.json";
export function getDistinguishabilityRegime(id: DistinguishabilityRegimeId): DistinguishabilityRegime;
export function verifyDistinguishabilityRegime(value: unknown, expectedId: DistinguishabilityRegimeId): DistinguishabilityRegime;
export function verifyStructuralObservationSpec(value: unknown, expectedId: StructuralObservableId): StructuralObservationSpec;
export function prepareStructuralRegime(pack: ModelPack, input: StructuralRegimeInput): StructuralRegimePreparation;
export function verifyStructuralRegimePreparation(value: unknown, pack: ModelPack, input: StructuralRegimeInput): StructuralRegimePreparation;
export interface StructuralRegimePreparationAnalysisDefinition {
  readonly id: "structural-regime-preparation"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_REGIME_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_REGIME_PREPARATION_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralRegimeInput): StructuralRegimePreparation;
}
export function createStructuralRegimePreparationAnalysis(): StructuralRegimePreparationAnalysisDefinition;
