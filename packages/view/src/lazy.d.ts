import type {
  CatalogOptions,
  FacetEntry,
  JsonValue,
  NeighborhoodDirection,
  NeighborhoodOptions,
  ViewEdge,
  ViewInput,
  ViewNode
} from "./index.js";

export interface ModelPresentationIdentity {
  modelId: string;
  modelVersion: string;
  rootHash: `sha256:${string}`;
  manifestHash: `sha256:${string}`;
}

export interface ModelPresentationInput extends ViewInput {
  identity: ModelPresentationIdentity;
}

export interface ModelPresentationOptions {
  defaultCatalogPageSize?: number;
}

export interface ModelPresentationLimits {
  maxCatalogPageSize: number;
  maxInspectorRelations: number;
  maxInputDepth: number;
  maxInputEntries: number;
}

export interface LightweightNodeSummary {
  id: string;
  name: string;
  level: JsonValue;
  phase: JsonValue;
  typeRole: JsonValue;
  scientificStatus: JsonValue;
  shortDescription: string;
  parentCount: number;
  childCount: number;
  incomingEdgeCount: number;
  outgoingEdgeCount: number;
  degree: number;
}

export interface ModelPresentationEnvelope {
  format: "onto2d-model-presentation";
  formatVersion: "1";
  identity: Readonly<ModelPresentationIdentity>;
}

export interface ModelPresentationDescriptor extends ModelPresentationEnvelope {
  kind: "descriptor";
  statistics: Readonly<{ nodeCount: number; edgeCount: number }>;
  facets: Readonly<{
    levels: readonly Readonly<FacetEntry>[];
    phases: readonly Readonly<FacetEntry>[];
    typeRoles: readonly Readonly<FacetEntry>[];
    scientificStatuses: readonly Readonly<FacetEntry>[];
  }>;
  capabilities: Readonly<{
    catalogPaging: true;
    explicitInspection: true;
    boundedNeighborhoods: true;
    semanticExecution: false;
  }>;
}

export interface ModelPresentationCatalogPage extends ModelPresentationEnvelope {
  kind: "catalog-page";
  query: Required<Omit<CatalogOptions, "offset" | "limit">>;
  total: number;
  matching: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  items: readonly Readonly<LightweightNodeSummary>[];
}

export interface ModelPresentationInspectOptions {
  maxRelations?: number;
}

export interface ModelPresentationNodeDetail extends ModelPresentationEnvelope {
  kind: "node-detail";
  node: Readonly<LightweightNodeSummary>;
  record: Readonly<ViewNode>;
  relations: Readonly<{
    parents: readonly Readonly<LightweightNodeSummary>[];
    children: readonly Readonly<LightweightNodeSummary>[];
  }>;
  relationCounts: Readonly<{
    parentCount: number;
    childCount: number;
    hiddenParentCount: number;
    hiddenChildCount: number;
  }>;
}

export interface ModelPresentationNeighborhoodNode extends LightweightNodeSummary {
  relation: "focus" | "parent" | "child" | "both";
  distance: number;
  upstreamDistance: number | null;
  downstreamDistance: number | null;
}

export interface ModelPresentationNeighborhoodEdge {
  id: string;
  source: string;
  target: string;
  relationLayer: JsonValue;
  dependencyType: JsonValue;
  necessity: JsonValue;
  weight: JsonValue;
}

export interface ModelPresentationNeighborhood extends ModelPresentationEnvelope {
  kind: "neighborhood";
  query: Required<NeighborhoodOptions>;
  focus: Readonly<LightweightNodeSummary>;
  adjacent: Readonly<{ parents: readonly string[]; children: readonly string[] }>;
  nodes: readonly Readonly<ModelPresentationNeighborhoodNode>[];
  edges: readonly Readonly<ModelPresentationNeighborhoodEdge>[];
  counts: Readonly<{
    discoveredNodeCount: number;
    displayedNodeCount: number;
    hiddenNodeCount: number;
    availableEdgeCount: number;
    displayedEdgeCount: number;
    hiddenEdgeCount: number;
  }>;
  truncated: boolean;
}

export class LazyModelPresentation {
  constructor(input: ModelPresentationInput, options?: ModelPresentationOptions);
  readonly descriptor: Readonly<ModelPresentationDescriptor>;
  has(id: string): boolean;
  catalog(options?: CatalogOptions): Readonly<ModelPresentationCatalogPage>;
  inspect(
    id: string,
    options?: ModelPresentationInspectOptions
  ): Readonly<ModelPresentationNodeDetail>;
  neighborhood(options: NeighborhoodOptions): Readonly<ModelPresentationNeighborhood>;
  close(): void;
}

export const MODEL_PRESENTATION_FORMAT: "onto2d-model-presentation";
export const MODEL_PRESENTATION_FORMAT_VERSION: "1";
export const MODEL_PRESENTATION_LIMITS: Readonly<ModelPresentationLimits>;
export const MODEL_PRESENTATION_CATALOG_SORTS: readonly ("id" | "name" | "level" | "degree")[];
export const MODEL_PRESENTATION_NEIGHBORHOOD_DIRECTIONS: readonly NeighborhoodDirection[];

export function createLazyModelPresentation(
  input: ModelPresentationInput,
  options?: ModelPresentationOptions
): LazyModelPresentation;
