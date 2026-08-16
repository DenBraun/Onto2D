import type { ContentHash, ModelPack } from "./index.js";
import type { ModelPackBrowserFetch } from "./browser.js";

export interface ModelPackRegistryLimits {
  maxRegistryBytes: number;
  maxEntries: number;
  maxUrlLength: number;
  maxIdentifierLength: number;
  maxPathLength: number;
}

export interface ModelPackRegistryEntry {
  modelId: string;
  version: string;
  rootHash: ContentHash;
  manifestHash: ContentHash;
  packPath: string;
}

export interface ModelPackRegistry {
  format: "onto2d-model-pack-registry";
  formatVersion: "1";
  entries: readonly ModelPackRegistryEntry[];
}

export interface ModelPackRegistrySelection {
  modelId: string;
  version: string;
}

export interface ModelPackRegistryResolverOptions {
  expectedRegistryHash?: ContentHash;
  maxEntries?: number;
  maxUrlLength?: number;
}

export interface ModelPackRegistryHttpOptions extends ModelPackRegistryResolverOptions {
  fetch?: ModelPackBrowserFetch;
  signal?: AbortSignal | null;
  maxRegistryBytes?: number;
}

export interface ModelPackRegistryResolution {
  format: "onto2d-model-pack-resolution";
  formatVersion: "1";
  registryHash: ContentHash;
  registryUrl: string;
  registryTrust: "hash-pinned" | "transport-only";
  modelId: string;
  version: string;
  rootHash: ContentHash;
  manifestHash: ContentHash;
  baseUrl: string;
}

export const MODEL_PACK_REGISTRY_FORMAT: "onto2d-model-pack-registry";
export const MODEL_PACK_REGISTRY_FORMAT_VERSION: "1";
export const MODEL_PACK_RESOLUTION_FORMAT: "onto2d-model-pack-resolution";
export const MODEL_PACK_RESOLUTION_FORMAT_VERSION: "1";
export const MODEL_PACK_REGISTRY_LIMITS: Readonly<ModelPackRegistryLimits>;

export function resolveModelPackRegistry(
  registry: ModelPackRegistry,
  registryUrl: string | URL,
  selection: ModelPackRegistrySelection,
  options?: ModelPackRegistryResolverOptions
): Readonly<ModelPackRegistryResolution>;

export function resolveModelPackRegistryHttp(
  registryUrl: string | URL,
  selection: ModelPackRegistrySelection,
  options?: ModelPackRegistryHttpOptions
): Promise<Readonly<ModelPackRegistryResolution>>;

export function matchModelPackRegistryResolution(
  pack: Readonly<ModelPack>,
  resolution: ModelPackRegistryResolution
): Readonly<ModelPack>;
