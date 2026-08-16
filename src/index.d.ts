import type {
  AnalysisDefinition,
  Onto2DCreateOptions,
  Onto2DEngine
} from "@onto2d/engine";
import type { ModelPack } from "@onto2d/model-pack";

export {
  CANONICAL_IDENTITY_ANALYSIS_ID,
  CANONICAL_IDENTITY_ANALYSIS_VERSION,
  CANONICAL_IDENTITY_ARTIFACT_SCHEMA,
  CANONICAL_IDENTITY_REQUEST_SCHEMA,
  analyzeCanonicalIdentity,
  canonicalIdentityAnalysis,
  createCanonicalIdentityAnalysis,
  verifyCanonicalIdentityArtifact
} from "@onto2d/canonical-identity-analysis";
export type {
  CanonicalIdentityAnalysisContext,
  CanonicalIdentityAnalysisDefinition,
  CanonicalIdentityArtifact,
  CanonicalIdentityModelBinding,
  CanonicalIdentityRequest
} from "@onto2d/canonical-identity-analysis";

export {
  ENGINE_API_VERSION,
  ENGINE_VERSION,
  EngineError,
  MODEL_LINEAGE_BUILDER,
  MODEL_LINEAGE_EVENT_KINDS,
  MODEL_LINEAGE_VERSION,
  Model,
  ModelRegistry,
  Workspace,
  buildModelLineage,
  createModel,
  diffModels,
  modelIdentity,
  verifyModelLineage
} from "@onto2d/engine";
export type {
  AnalysisDefinition,
  AnalysisMetadata,
  ModelIdentity,
  ModelLineage,
  ModelLineageEvent,
  ModelLineageEventKind,
  ModelNodeView,
  ModelResolution,
  Neighborhood,
  NeighborhoodOptions,
  Onto2DEngine,
  StructuralModelDiff,
  WorkspaceModelInstance
} from "@onto2d/engine";
export {
  MODEL_PACK_ENGINE_API_VERSION,
  MODEL_PACK_FORMAT,
  MODEL_PACK_FORMAT_VERSION,
  MODEL_PACK_SCHEMA_VERSION,
  ModelPackError,
  buildModelIndexes,
  buildModelPack,
  modelPackFilePaths,
  verifyModelPack
} from "@onto2d/model-pack";
export type {
  BuildModelPackInput,
  ContentHash,
  JsonValue,
  ModelPack,
  ModelPackEdge,
  ModelPackIndexes,
  ModelPackManifest,
  ModelPackModel,
  ModelPackNode,
  ModelPackSource
} from "@onto2d/model-pack";

export const bundledCausalEmergenceModelPack: Readonly<ModelPack>;

export interface DefaultOnto2DCreateOptions
  extends Partial<Omit<Onto2DCreateOptions, "models">> {
  models?: ModelPack[];
  analyses?: AnalysisDefinition<any, any>[];
}

export class Onto2D {
  static create(options?: DefaultOnto2DCreateOptions): Promise<Onto2DEngine>;
}
