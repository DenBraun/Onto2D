import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralRegimePreparation, StructuralRegimeScope } from "./regimes.js";

export interface StructuralTopologyInput {
  readonly regimeId: "topology-only-v1";
  readonly scope?: StructuralRegimeScope;
}
export interface StructuralTopologyValue {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly weakComponentSizes: readonly number[];
  readonly strongComponentSizes: readonly number[];
  readonly reachableOrderedPairCount: number;
  readonly cyclicNodeCount: number;
  readonly isolatedNodeCount: number;
}
export interface TopologyObservationImplementation extends StructuralContractReference {
  readonly id: "directed-topology-observation-v1";
  readonly reachability: "breadth-first-from-each-scoped-node";
  readonly strongComponents: "mutual-directed-reachability";
  readonly weakComponents: "undirected-breadth-first";
  readonly componentSizeOrdering: "numeric-ascending";
  readonly diagnosticOrdering: "source-id-ascending";
  readonly pairVisits: "distinct-source-target-visits-including-self-seeds";
  readonly edgeScans: "directed-adjacency-entries-scanned-by-reachability-only";
  readonly attributes: "excluded";
  readonly graphIsomorphismClaim: false;
  readonly valueFields: readonly { readonly observableId: string; readonly field: keyof StructuralTopologyValue }[];
}
export interface StructuralTopologyObservation {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-topology-observation"; readonly version: "1" };
  readonly evaluation: "measured";
  readonly implementation: TopologyObservationImplementation;
  readonly preparation: StructuralRegimePreparation;
  readonly observation: {
    readonly regime: StructuralContractReference & { readonly id: "topology-only-v1" };
    readonly observables: readonly StructuralContractReference[];
    readonly implementation: StructuralContractReference & { readonly id: "directed-topology-observation-v1" };
    readonly value: StructuralTopologyValue;
    readonly valueHash: ContentHash;
  };
  readonly diagnostics: {
    readonly weakComponents: readonly (readonly string[])[];
    readonly strongComponents: readonly (readonly string[])[];
    readonly reachablePairsBySource: readonly { readonly sourceNodeId: string; readonly count: number }[];
    readonly work: { readonly reachabilityPairVisits: number; readonly reachabilityEdgeScans: number };
  };
  readonly artifactHash: ContentHash;
}
export const TOPOLOGY_OBSERVATION_IMPLEMENTATION: TopologyObservationImplementation;
export const STRUCTURAL_TOPOLOGY_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-topology-input.schema.json";
export const STRUCTURAL_TOPOLOGY_OBSERVATION_SCHEMA: "https://onto2d.dev/schemas/v1/structural-topology-observation.schema.json";
export function observeStructuralTopology(pack: ModelPack, input: StructuralTopologyInput): StructuralTopologyObservation;
export function verifyStructuralTopologyObservation(value: unknown, pack: ModelPack, input: StructuralTopologyInput): StructuralTopologyObservation;
export interface StructuralTopologyObservationAnalysisDefinition {
  readonly id: "structural-topology-observation"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_TOPOLOGY_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_TOPOLOGY_OBSERVATION_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralTopologyInput): StructuralTopologyObservation;
}
export function createStructuralTopologyObservationAnalysis(): StructuralTopologyObservationAnalysisDefinition;
