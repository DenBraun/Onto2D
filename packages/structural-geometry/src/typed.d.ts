import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralModelBinding } from "./index.js";
import type { StructuralContractReference, StructuralRegimePreparation, StructuralRegimeScope, StructuralTypedField } from "./regimes.js";
import type { CanonicalStructureValue, CanonicalStructureObservation } from "./canonical.js";

export interface TypedRelationsInput { readonly regimeId: "typed-relations-v1"; readonly scope?: StructuralRegimeScope }
export interface StructuralEdgeTypes {
  readonly dependencyTypeId: number;
  readonly interactionModeIds: readonly number[];
  readonly ontologicalRole: "arising" | "maintenance" | "modulation";
  readonly necessity: "necessary" | "enabling" | "contextual" | "optional";
  readonly causalDirectionIds: readonly number[];
}
export interface TypedDirectedStructureValue {
  readonly nodeCount: number;
  readonly edges: readonly { readonly from: number; readonly to: number; readonly types: StructuralEdgeTypes }[];
}
export interface TypedDirectedStructureWitness extends Omit<CanonicalStructureObservation["witness"], "edges"> {
  readonly edges: readonly { readonly sourceEdgeId: string; readonly from: number; readonly to: number; readonly types: StructuralEdgeTypes }[];
}
export interface TypedRelationsImplementation extends StructuralContractReference {
  readonly id: "typed-directed-observation-v1";
  readonly kernelOperation: "canonicalizeCandidate"; readonly kernelCanonicalSchemaVersion: "1";
  readonly inputOrdering: "source-id-ascending";
  readonly valueEncoding: "node-count-and-directed-endpoints-with-five-joint-edge-fields";
  readonly setEncoding: "canonical-json-string-of-numeric-sorted-distinct-integers";
  readonly sourceAudit: "all-present-fields-before-scoped-measurement";
  readonly missingScopedField: "null-typed-value-with-explicit-evidence-gaps";
  readonly vocabularyMeaning: "source-local-codes-require-separate-comparison-compatibility";
  readonly witnessMeaning: "one-common-bijection-not-canonical-orbits"; readonly otherAttributes: "excluded";
}
export interface LocalStructuralVocabulary {
  readonly policy: StructuralContractReference & { readonly id: "model-local-typed-vocabulary-v1" };
  readonly model: StructuralModelBinding; readonly dictionaryHash: ContentHash;
}
interface TypedObservationBinding {
  readonly regime: StructuralContractReference & { readonly id: "typed-relations-v1" };
  readonly observable: StructuralContractReference;
  readonly implementation: StructuralContractReference & { readonly id: "typed-directed-observation-v1" };
}
export type TypedObservedComponent<V, W> = TypedObservationBinding & {
  readonly availability: "observed"; readonly value: V; readonly valueHash: ContentHash; readonly witness: W;
};
export type TypedMissingComponent = TypedObservationBinding & {
  readonly availability: "missing"; readonly value: null; readonly valueHash: null; readonly witness: null;
};
export interface TypedRelationsObservation {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-typed-observation"; readonly version: "1" };
  readonly evaluation: "measured" | "incomplete";
  readonly implementation: TypedRelationsImplementation;
  readonly preparation: StructuralRegimePreparation;
  readonly vocabulary: LocalStructuralVocabulary;
  readonly observations: readonly [TypedObservedComponent<CanonicalStructureValue, CanonicalStructureObservation["witness"]>,
    TypedObservedComponent<TypedDirectedStructureValue, TypedDirectedStructureWitness> | TypedMissingComponent];
  readonly evidence: { readonly requiredFieldCount: number; readonly observedFieldCount: number;
    readonly missing: readonly { readonly sourceEdgeId: string; readonly field: StructuralTypedField }[] };
  readonly artifactHash: ContentHash;
}
export type StructuralVocabularyMappingFields = {
  readonly [F in StructuralTypedField]: readonly {
    readonly left: StructuralEdgeTypes[F] extends readonly number[] ? number : StructuralEdgeTypes[F];
    readonly right: StructuralEdgeTypes[F] extends readonly number[] ? number : StructuralEdgeTypes[F];
  }[];
};
export interface StructuralVocabularyMappingInput {
  readonly id: string; readonly version: "1"; readonly fields: StructuralVocabularyMappingFields;
  readonly reviewEvidence: { readonly reference: string; readonly contentHash: ContentHash };
}
export interface TypedVocabularyAlignmentPolicy extends StructuralContractReference {
  readonly id: "explicit-typed-vocabulary-alignment-v1";
  readonly sameSource: "exact-model-binding-and-full-dictionary-hash";
  readonly crossSource: "explicit-approved-mapping-hash";
  readonly approval: "external-caller-allowance-not-self-asserted-by-mapping";
  readonly mapping: "partial-bijection-per-field";
  readonly requiredCoverage: "every-scoped-value-on-both-sides";
  readonly targetVocabulary: "left-source";
  readonly recanonicalization: "joint-fields-after-right-to-left-remapping";
  readonly missingCompatibility: "unresolved-no-aligned-values";
  readonly maxMappingEntries: 1024; readonly maxCanonicalizerCalls: 5;
  readonly maxSearchStatesPerCall: 100000; readonly maxArtifactBytes: 1048576;
}
export interface StructuralVocabularyMapping {
  readonly schemaVersion: "1"; readonly policy: TypedVocabularyAlignmentPolicy;
  readonly regime: StructuralContractReference & { readonly id: "typed-relations-v1" };
  readonly declaration: StructuralVocabularyMappingInput;
  readonly left: LocalStructuralVocabulary; readonly right: LocalStructuralVocabulary;
  readonly artifactHash: ContentHash;
}
export type TypedAlignmentOptions = { readonly mapping?: never; readonly approvedMappingHash?: never } |
  { readonly mapping: StructuralVocabularyMapping; readonly approvedMappingHash?: ContentHash };
export type TypedAlignmentReason =
  { readonly code: "missing-typed-observation"; readonly side: "left" | "right" } |
  { readonly code: "mapping-not-approved" | "cross-source-mapping-required" } |
  { readonly code: "mapping-value-uncovered"; readonly side: "left" | "right"; readonly field: StructuralTypedField; readonly value: number | string };
interface TypedAlignmentBody {
  readonly schemaVersion: "1"; readonly analysis: { readonly id: "structural-typed-alignment"; readonly version: "1" };
  readonly policy: TypedVocabularyAlignmentPolicy;
  readonly regime: StructuralContractReference & { readonly id: "typed-relations-v1" };
  readonly request: { readonly approvedMappingHash: ContentHash | null };
  readonly mapping: StructuralVocabularyMapping | null;
  readonly sources: { readonly left: TypedRelationsObservation; readonly right: TypedRelationsObservation };
  readonly artifactHash: ContentHash;
}
export type TypedRelationsAlignment = TypedAlignmentBody & (
  { readonly compatibility: { readonly state: "compatible"; readonly basis: "same-source" | "approved-mapping"; readonly reasons: readonly [] };
    readonly aligned: { readonly domainHash: ContentHash;
      readonly left: { readonly value: TypedDirectedStructureValue; readonly witness: TypedDirectedStructureWitness };
      readonly right: { readonly value: TypedDirectedStructureValue; readonly witness: TypedDirectedStructureWitness } } } |
  { readonly compatibility: { readonly state: "unresolved"; readonly basis: null; readonly reasons: readonly TypedAlignmentReason[] }; readonly aligned: null }
);
export const TYPED_RELATIONS_IMPLEMENTATION: TypedRelationsImplementation;
export const TYPED_VOCABULARY_ALIGNMENT_POLICY: TypedVocabularyAlignmentPolicy;
export const STRUCTURAL_TYPED_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-typed-input.schema.json";
export const STRUCTURAL_TYPED_OBSERVATION_SCHEMA: "https://onto2d.dev/schemas/v1/structural-typed-observation.schema.json";
export const STRUCTURAL_VOCABULARY_MAPPING_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-vocabulary-mapping-input.schema.json";
export const STRUCTURAL_VOCABULARY_MAPPING_SCHEMA: "https://onto2d.dev/schemas/v1/structural-vocabulary-mapping.schema.json";
export const STRUCTURAL_TYPED_ALIGNMENT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-typed-alignment.schema.json";
export function observeTypedRelations(pack: ModelPack, input: TypedRelationsInput): TypedRelationsObservation;
export function verifyTypedRelationsObservation(value: unknown, pack: ModelPack, input: TypedRelationsInput): TypedRelationsObservation;
export function createStructuralVocabularyMapping(left: ModelPack, right: ModelPack, input: StructuralVocabularyMappingInput): StructuralVocabularyMapping;
export function verifyStructuralVocabularyMapping(value: unknown, left: ModelPack, right: ModelPack, input: StructuralVocabularyMappingInput): StructuralVocabularyMapping;
export function alignTypedRelations(left: ModelPack, leftInput: TypedRelationsInput, right: ModelPack, rightInput: TypedRelationsInput, options?: TypedAlignmentOptions): TypedRelationsAlignment;
export function verifyTypedRelationsAlignment(value: unknown, left: ModelPack, leftInput: TypedRelationsInput, right: ModelPack, rightInput: TypedRelationsInput, options?: TypedAlignmentOptions): TypedRelationsAlignment;
export interface TypedRelationsObservationAnalysisDefinition {
  readonly id: "structural-typed-observation"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_TYPED_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_TYPED_OBSERVATION_SCHEMA];
  run(context: { readonly model: Model }, input: TypedRelationsInput): TypedRelationsObservation;
}
export function createTypedRelationsObservationAnalysis(): TypedRelationsObservationAnalysisDefinition;
