import { Onto2D as EngineOnto2D } from "@onto2d/engine";
import { verifyModelPack } from "@onto2d/model-pack";
import { canonicalIdentityAnalysis } from "@onto2d/canonical-identity-analysis";
import bundledPackJson from "../models/causal-emergence/releases/2026.08.15/bundle.json" with { type: "json" };

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
export {
  CATALOG_SORTS,
  NEIGHBORHOOD_DIRECTIONS,
  VIEW_VERSION,
  ModelView,
  ViewError,
  createModelView,
  layoutNeighborhood
} from "@onto2d/view";

export const bundledCausalEmergenceModelPack = verifyModelPack(bundledPackJson);

export class Onto2D {
  static async create(options = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Onto2D.create options must be a plain object.");
    }
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Onto2D.create options must be a plain object.");
    }
    const suppliedModels = options.models ?? [];
    if (!Array.isArray(suppliedModels)) {
      throw new TypeError("Onto2D.create models must be an array.");
    }
    const suppliedAnalyses = options.analyses ?? [];
    if (!Array.isArray(suppliedAnalyses)) {
      throw new TypeError("Onto2D.create analyses must be an array.");
    }
    const suppliedAliases = options.aliases ?? {};
    if (
      suppliedAliases === null ||
      typeof suppliedAliases !== "object" ||
      Array.isArray(suppliedAliases) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(suppliedAliases))
    ) {
      throw new TypeError("Onto2D.create aliases must be a plain object.");
    }
    const aliases = {
      ...suppliedAliases,
      "causal-emergence": {
        stable: bundledCausalEmergenceModelPack.manifest.model.version,
        latest: bundledCausalEmergenceModelPack.manifest.model.version,
        ...(suppliedAliases["causal-emergence"] ?? {})
      }
    };
    return EngineOnto2D.create({
      ...options,
      models: [bundledCausalEmergenceModelPack, ...suppliedModels],
      aliases,
      model: options.model ?? "causal-emergence@stable",
      analyses: [canonicalIdentityAnalysis, ...suppliedAnalyses]
    });
  }
}
