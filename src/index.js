import { Onto2D as EngineOnto2D } from "@onto2d/engine";
import { verifyModelPack } from "@onto2d/model-pack";
import { canonicalIdentityAnalysis } from "@onto2d/canonical-identity-analysis";
import bundledPackJson from "../models/causal-emergence/releases/2026.08.15/bundle.json" with { type: "json" };

const CREATE_OPTION_FIELDS = new Set(["models", "aliases", "lineages", "model", "analyses"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function plainEntries(value, subject, allowed) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${subject} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${subject} must be a plain object.`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${subject} must not contain symbol fields.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = new Map();
  for (const field of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[field];
    if (!("value" in descriptor) || !descriptor.enumerable || FORBIDDEN_KEYS.has(field)) {
      throw new TypeError(`${subject} must contain enumerable safe data fields only.`);
    }
    if (allowed !== undefined && !allowed.has(field)) {
      throw new TypeError(`${subject} contains an unknown field: ${field}.`);
    }
    entries.set(field, descriptor.value);
  }
  return entries;
}

function arrayValues(value, subject) {
  if (!Array.isArray(value)) throw new TypeError(`${subject} must be an array.`);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${subject} must not contain symbol fields.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of Object.keys(descriptors)) {
    if (field === "length") continue;
    if (!/^(?:0|[1-9][0-9]*)$/.test(field) || Number(field) >= value.length) {
      throw new TypeError(`${subject} must not contain named fields.`);
    }
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${subject} must contain dense data elements only.`);
    }
    result.push(descriptor.value);
  }
  return result;
}

function copyAliases(value) {
  const result = Object.create(null);
  for (const [modelId, aliases] of plainEntries(value, "Onto2D.create aliases")) {
    const modelAliases = Object.create(null);
    for (const [alias, version] of plainEntries(aliases, `Onto2D.create aliases.${modelId}`)) {
      modelAliases[alias] = version;
    }
    result[modelId] = modelAliases;
  }
  return result;
}

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
    const entries = plainEntries(options, "Onto2D.create options", CREATE_OPTION_FIELDS);
    const suppliedModels = entries.get("models") ?? [];
    const suppliedAnalyses = entries.get("analyses") ?? [];
    const aliases = copyAliases(entries.get("aliases") ?? {});
    const causalAliases = aliases["causal-emergence"] ?? Object.create(null);
    if (!Object.hasOwn(causalAliases, "stable")) {
      causalAliases.stable = bundledCausalEmergenceModelPack.manifest.model.version;
    }
    if (!Object.hasOwn(causalAliases, "latest")) {
      causalAliases.latest = bundledCausalEmergenceModelPack.manifest.model.version;
    }
    aliases["causal-emergence"] = causalAliases;
    return EngineOnto2D.create({
      models: [
        bundledCausalEmergenceModelPack,
        ...arrayValues(suppliedModels, "Onto2D.create models")
      ],
      aliases,
      lineages: entries.get("lineages") ?? [],
      model: entries.get("model") ?? "causal-emergence@stable",
      analyses: [
        canonicalIdentityAnalysis,
        ...arrayValues(suppliedAnalyses, "Onto2D.create analyses")
      ]
    });
  }
}
