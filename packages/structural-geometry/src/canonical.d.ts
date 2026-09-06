import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralRegimePreparation, StructuralRegimeScope } from "./regimes.js";

export interface CanonicalStructureInput {
  readonly regimeId: "canonical-structure-v1";
  readonly scope?: StructuralRegimeScope;
}
export interface CanonicalStructureValue {
  readonly nodeCount: number;
  readonly edges: readonly { readonly from: number; readonly to: number }[];
}
export interface CanonicalStructureImplementation extends StructuralContractReference {
  readonly id: "canonical-directed-observation-v1";
  readonly kernelOperation: "canonicalizeCandidate";
  readonly kernelCanonicalSchemaVersion: "1";
  readonly inputOrdering: "source-id-ascending";
  readonly valueEncoding: "node-count-and-canonical-directed-endpoints";
  readonly witnessMeaning: "one-isomorphism-not-canonical-orbits";
  readonly attributes: "excluded";
}
export interface CanonicalStructureObservation {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-canonical-observation"; readonly version: "1" };
  readonly evaluation: "measured";
  readonly implementation: CanonicalStructureImplementation;
  readonly preparation: StructuralRegimePreparation;
  readonly observation: {
    readonly regime: StructuralContractReference & { readonly id: "canonical-structure-v1" };
    readonly observable: StructuralContractReference & { readonly id: "canonical-directed-structure-v1" };
    readonly implementation: StructuralContractReference & { readonly id: "canonical-directed-observation-v1" };
    readonly value: CanonicalStructureValue;
    readonly valueHash: ContentHash;
  };
  readonly witness: {
    readonly nodes: readonly { readonly sourceNodeId: string; readonly canonicalNode: number }[];
    readonly edges: readonly { readonly sourceEdgeId: string; readonly from: number; readonly to: number }[];
    readonly candidateHash: ContentHash;
    readonly skeletonHash: ContentHash;
    readonly statistics: { readonly searchStates: number; readonly leaves: number; readonly refinementRounds: number };
  };
  readonly artifactHash: ContentHash;
}
export const CANONICAL_STRUCTURE_IMPLEMENTATION: CanonicalStructureImplementation;
export const STRUCTURAL_CANONICAL_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-canonical-input.schema.json";
export const STRUCTURAL_CANONICAL_OBSERVATION_SCHEMA: "https://onto2d.dev/schemas/v1/structural-canonical-observation.schema.json";
export function observeCanonicalStructure(pack: ModelPack, input: CanonicalStructureInput): CanonicalStructureObservation;
export function verifyCanonicalStructureObservation(value: unknown, pack: ModelPack, input: CanonicalStructureInput): CanonicalStructureObservation;
export interface CanonicalStructureObservationAnalysisDefinition {
  readonly id: "structural-canonical-observation"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_CANONICAL_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_CANONICAL_OBSERVATION_SCHEMA];
  run(context: { readonly model: Model }, input: CanonicalStructureInput): CanonicalStructureObservation;
}
export function createCanonicalStructureObservationAnalysis(): CanonicalStructureObservationAnalysisDefinition;
