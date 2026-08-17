export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ViewNode {
  id: string;
  [key: string]: JsonValue;
}

export interface ViewEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: JsonValue;
}

export interface ViewInput {
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface FacetEntry {
  value: JsonPrimitive;
  count: number;
}

export interface ViewNodeSummary {
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
  data: Readonly<ViewNode>;
}

export type CatalogSort = "id" | "name" | "level" | "degree";
export type SortOrder = "asc" | "desc";
export type NeighborhoodDirection = "both" | "parents" | "children";

export interface CatalogOptions {
  search?: string;
  levels?: JsonPrimitive[];
  phases?: JsonPrimitive[];
  typeRoles?: JsonPrimitive[];
  scientificStatuses?: JsonPrimitive[];
  sort?: CatalogSort;
  order?: SortOrder;
  offset?: number;
  limit?: number;
}

export interface CatalogProjection {
  query: Required<Omit<CatalogOptions, "offset" | "limit">>;
  total: number;
  matching: number;
  offset: number;
  limit: number;
  items: readonly Readonly<ViewNodeSummary>[];
}

export interface NeighborhoodOptions {
  focusId: string;
  depth?: number;
  direction?: NeighborhoodDirection;
  maxNodes?: number;
  maxEdges?: number;
}

export interface NeighborhoodNode extends ViewNodeSummary {
  relation: "focus" | "parent" | "child" | "both";
  distance: number;
  upstreamDistance: number | null;
  downstreamDistance: number | null;
}

export interface NeighborhoodEdge {
  id: string;
  source: string;
  target: string;
  relationLayer: JsonValue;
  dependencyType: JsonValue;
  necessity: JsonValue;
  weight: JsonValue;
  data: Readonly<ViewEdge>;
}

export interface NeighborhoodProjection {
  query: Required<NeighborhoodOptions>;
  focus: Readonly<ViewNodeSummary>;
  adjacent: { parents: readonly string[]; children: readonly string[] };
  nodes: readonly Readonly<NeighborhoodNode>[];
  edges: readonly Readonly<NeighborhoodEdge>[];
  counts: {
    discoveredNodeCount: number;
    displayedNodeCount: number;
    hiddenNodeCount: number;
    availableEdgeCount: number;
    displayedEdgeCount: number;
    hiddenEdgeCount: number;
  };
  truncated: boolean;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
  nodeRadius?: number;
  nodeWidth?: number;
  nodeHeight?: number;
}

export interface NeighborhoodLayoutNodeInput extends Omit<NeighborhoodNode, "data"> {
  data?: Readonly<ViewNode>;
}

export interface NeighborhoodLayoutEdgeInput extends Omit<NeighborhoodEdge, "data"> {
  data?: Readonly<ViewEdge>;
}

export interface NeighborhoodLayoutProjection {
  query: Required<NeighborhoodOptions>;
  nodes: readonly Readonly<NeighborhoodLayoutNodeInput>[];
  edges: readonly Readonly<NeighborhoodLayoutEdgeInput>[];
}

export interface PositionedNeighborhoodNode extends NeighborhoodLayoutNodeInput {
  layer: number;
  x: number;
  y: number;
}

export interface RoutedNeighborhoodEdge extends NeighborhoodLayoutEdgeInput {
  path: string;
  labelX: number;
  labelY: number;
}

export interface NeighborhoodLayout {
  width: number;
  height: number;
  nodeRadius: number;
  nodeWidth: number;
  nodeHeight: number;
  focusId: string;
  nodes: readonly Readonly<PositionedNeighborhoodNode>[];
  edges: readonly Readonly<RoutedNeighborhoodEdge>[];
}

export class ViewError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const VIEW_VERSION: "0.1.0";
export const CATALOG_SORTS: readonly CatalogSort[];
export const NEIGHBORHOOD_DIRECTIONS: readonly NeighborhoodDirection[];

export class ModelView {
  constructor(input: ViewInput);
  readonly statistics: Readonly<{ nodeCount: number; edgeCount: number }>;
  readonly facets: Readonly<{
    levels: readonly Readonly<FacetEntry>[];
    phases: readonly Readonly<FacetEntry>[];
    typeRoles: readonly Readonly<FacetEntry>[];
    scientificStatuses: readonly Readonly<FacetEntry>[];
  }>;
  get(id: string): Readonly<ViewNodeSummary> | undefined;
  catalog(options?: CatalogOptions): Readonly<CatalogProjection>;
  neighborhood(options: NeighborhoodOptions): Readonly<NeighborhoodProjection>;
}

export function createModelView(input: ViewInput): ModelView;
export function wrapGraphNodeLabel(
  value: string,
  options?: { maxLines?: number; maxCharacters?: number }
): Readonly<{ lines: readonly string[]; truncated: boolean }>;
export function layoutNeighborhood(
  projection: NeighborhoodProjection | NeighborhoodLayoutProjection,
  options?: LayoutOptions
): Readonly<NeighborhoodLayout>;
