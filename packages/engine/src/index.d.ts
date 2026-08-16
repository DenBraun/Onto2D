import type {
  JsonValue,
  ModelPack,
  ModelPackEdge,
  ModelPackManifest,
  ModelPackNode
} from "@onto2d/model-pack";
import type { ModelPackRegistryResolution } from "@onto2d/model-pack/registry";
import type { LazyModelPresentation } from "@onto2d/view/lazy";

export class EngineError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const ENGINE_VERSION: "0.1.0";
export const ENGINE_API_VERSION: "1";

export interface ModelNodeView {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly level?: JsonValue;
  readonly phase?: JsonValue;
  readonly typeRole?: JsonValue;
  readonly scientificStatus?: JsonValue;
  readonly data: Readonly<ModelPackNode>;
  parents(selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  children(selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  ancestors(selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  descendants(selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  neighborhood(options?: NeighborhoodOptions): Neighborhood;
  toJSON(): Readonly<ModelPackNode>;
}

export interface NeighborhoodOptions {
  depth?: number;
  direction?: "parents" | "children" | "both";
  selector?: Record<string, JsonValue>;
}

export interface Neighborhood {
  nodes: readonly ModelNodeView[];
  edges: readonly Readonly<ModelPackEdge>[];
  distance: readonly (readonly [string, number])[];
}

export class Model {
  constructor(pack: ModelPack);
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly rootHash: `sha256:${string}`;
  readonly manifestHash: `sha256:${string}`;
  readonly manifest: Readonly<ModelPackManifest>;
  readonly dictionaries: Readonly<Record<string, JsonValue>>;
  has(id: string): boolean;
  get(id: string): ModelNodeView | undefined;
  require(id: string): ModelNodeView;
  nodes(query?: Record<string, JsonValue>): readonly ModelNodeView[];
  edges(query?: Record<string, JsonValue>): readonly Readonly<ModelPackEdge>[];
  query(query?: Record<string, JsonValue>): readonly ModelNodeView[];
  parents(id: string, selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  children(id: string, selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  ancestors(id: string, selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  descendants(id: string, selector?: Record<string, JsonValue>): readonly ModelNodeView[];
  paths(options: {
    from: string;
    to: string;
    selector?: Record<string, JsonValue>;
    maximumPaths?: number;
  }): readonly (readonly string[])[];
  neighborhood(id: string, options?: NeighborhoodOptions): Readonly<Neighborhood>;
}

export function createModel(pack: ModelPack): Model;

export interface VerifiedModelPresentationOptions {
  resolution?: ModelPackRegistryResolution;
  defaultCatalogPageSize?: number;
}

export function createVerifiedModelPresentation(
  pack: ModelPack,
  options?: VerifiedModelPresentationOptions
): LazyModelPresentation;

export interface WorkspaceModelInstance {
  workspaceId: string;
  modelKind: string;
  modelSemanticIdentity: `sha256:${string}`;
  modelVersion: string;
  model: Model;
}

export class Workspace {
  add(model: Model, options?: { workspaceId?: string; modelKind?: string }): WorkspaceModelInstance;
  remove(workspaceId: string): boolean;
  has(workspaceId: string): boolean;
  get(workspaceId: string): WorkspaceModelInstance | undefined;
  models(): readonly WorkspaceModelInstance[];
  addBinding<T extends JsonValue & { id: string; sourceModel: string; targetModel: string }>(binding: T): Readonly<T>;
  removeBinding(id: string): boolean;
  bindings(): readonly Readonly<JsonValue>[];
  addRun<T extends JsonValue & { id: string; modelWorkspaceId: string; modelRootHash: string }>(run: T): Readonly<T>;
  removeRun(id: string): boolean;
  runs(): readonly Readonly<JsonValue>[];
}

export interface ModelResolution {
  requested: string;
  exact: string;
  modelId: string;
  modelVersion: string;
  modelRootHash: `sha256:${string}`;
}

export interface ModelIdentity {
  modelId: string;
  modelVersion: string;
  modelRootHash: `sha256:${string}`;
}

export type ModelLineageEventKind =
  | "rename"
  | "move"
  | "split"
  | "merge"
  | "deprecate"
  | "replace"
  | "relation-change"
  | "classification-change"
  | "metadata-only-change";

export interface ModelLineageEvent {
  id: string;
  kind: ModelLineageEventKind;
  entity: "node" | "edge" | "model";
  from: string[];
  to: string[];
  fields?: string[];
  note?: string;
}

export interface ModelLineage {
  schemaVersion: "1";
  builder: "onto2d-model-lineage-v1";
  from: ModelIdentity;
  to: ModelIdentity;
  events: ModelLineageEvent[];
  lineageHash: `sha256:${string}`;
}

export const MODEL_LINEAGE_VERSION: "1";
export const MODEL_LINEAGE_BUILDER: "onto2d-model-lineage-v1";
export const MODEL_LINEAGE_EVENT_KINDS: readonly ModelLineageEventKind[];
export function modelIdentity(model: Model): Readonly<ModelIdentity>;
export function buildModelLineage(input: {
  from: ModelIdentity;
  to: ModelIdentity;
  events: ModelLineageEvent[];
}): Readonly<ModelLineage>;
export function verifyModelLineage(
  lineage: ModelLineage,
  expected?: { from?: Model; to?: Model }
): Readonly<ModelLineage>;

export interface StructuralModelDiff {
  schemaVersion: "1";
  builder: "onto2d-structural-model-diff-v2";
  left: { modelId: string; modelVersion: string; modelRootHash: string };
  right: { modelId: string; modelVersion: string; modelRootHash: string };
  lineage:
    | { status: "not-declared"; events: []; renamed: []; splits: []; merges: [] }
    | {
      status: "declared";
      lineageHash: `sha256:${string}`;
      events: ModelLineageEvent[];
      renamed: { eventId: string; from: string[]; to: string[] }[];
      splits: { eventId: string; from: string[]; to: string[] }[];
      merges: { eventId: string; from: string[]; to: string[] }[];
    };
  model: { changedFields: string[] };
  nodes: { added: string[]; removed: string[]; changed: { id: string; fields: string[] }[] };
  edges: { added: string[]; removed: string[]; changed: { id: string; fields: string[] }[] };
  statistics: Record<string, number>;
  diffHash: `sha256:${string}`;
}

export function diffModels(
  left: Model,
  right: Model,
  options?: { lineage?: ModelLineage }
): Readonly<StructuralModelDiff>;

export class ModelRegistry {
  constructor(
    packs: ModelPack[],
    aliases?: Record<string, Record<string, string>>,
    lineages?: ModelLineage[]
  );
  register(pack: ModelPack): string;
  registerLineage(lineage: ModelLineage): string;
  resolve(reference: string | { id: string; version: string }): ModelResolution;
  get(reference: string | { id: string; version: string }): Model;
  list(): readonly { id: string; name: string; version: string; rootHash: string }[];
  listLineages(): readonly {
    from: ModelIdentity;
    to: ModelIdentity;
    lineageHash: string;
    eventCount: number;
  }[];
  diff(
    left: string | { id: string; version: string },
    right: string | { id: string; version: string }
  ): Promise<Readonly<StructuralModelDiff>>;
}

export interface AnalysisMetadata {
  id: string;
  version: string;
  requiredModelCapabilities: readonly string[];
  requiredAdapterCapabilities: readonly string[];
  inputSchema: string | null;
  outputArtifacts: readonly string[];
}

export interface AnalysisDefinition<Input = JsonValue, Output = unknown> {
  id: string;
  version: string;
  requiredModelCapabilities?: readonly string[];
  requiredAdapterCapabilities?: readonly string[];
  inputSchema?: string;
  outputArtifacts?: readonly string[];
  run(context: {
    analysis: AnalysisMetadata;
    engine: { version: typeof ENGINE_VERSION; apiVersion: typeof ENGINE_API_VERSION };
    model: Model;
    modelResolution: ModelResolution;
    workspace: Workspace;
  }, input: Input): Output | Promise<Output>;
}

export interface Onto2DCreateOptions {
  models: ModelPack[];
  model?: string | { id: string; version: string };
  aliases?: Record<string, Record<string, string>>;
  lineages?: ModelLineage[];
  analyses?: AnalysisDefinition<any, any>[];
}

export interface Onto2DEngine {
  readonly model: Model;
  readonly modelResolution: ModelResolution;
  readonly workspace: Workspace;
  readonly models: {
    list(): readonly { id: string; name: string; version: string; rootHash: string }[];
    resolve(reference: string | { id: string; version: string }): ModelResolution;
    get(reference: string | { id: string; version: string }): Model;
    diff(
      left: string | { id: string; version: string },
      right: string | { id: string; version: string }
    ): Promise<Readonly<StructuralModelDiff>>;
    lineages(): readonly {
      from: ModelIdentity;
      to: ModelIdentity;
      lineageHash: string;
      eventCount: number;
    }[];
  };
  analyses(): readonly AnalysisMetadata[];
  analyze(id: string, input?: JsonValue): Promise<unknown>;
}

export class Onto2D {
  static create(options: Onto2DCreateOptions): Promise<Onto2DEngine>;
}
