import type { ContentHash, ModelPack } from "./index.js";
import type { ModelPackBrowserBundleSource } from "./browser.js";

export interface ModelPackCacheLimits {
  maxEntries: number;
  maxRecordBytes: number;
  maxTotalBytes: number;
  maxDatabaseNameLength: number;
}

export interface ModelPackCacheIdentity {
  rootHash: ContentHash;
  manifestHash: ContentHash;
}

export interface ModelPackCacheStorageReadMiss {
  state: "miss";
}

export interface ModelPackCacheStorageReadEntry {
  state: "entry";
  value: string;
}

export interface ModelPackCacheStorageReadInvalid {
  state: "invalid";
}

export type ModelPackCacheStorageReadResult =
  | ModelPackCacheStorageReadMiss
  | ModelPackCacheStorageReadEntry
  | ModelPackCacheStorageReadInvalid;

export interface ModelPackCacheStorageCommit {
  key: string;
  value: string;
  byteLength: number;
  maxEntries: number;
  maxRecordBytes: number;
  maxTotalBytes: number;
}

export interface ModelPackCacheStorageCommitResult {
  evictedKeys: readonly string[];
  entryCount: number;
  totalBytes: number;
}

export interface ModelPackCacheStorageEntry {
  key: string;
  byteLength: number;
  ordinal: number;
}

export interface ModelPackCacheStorageSnapshot {
  entries: readonly ModelPackCacheStorageEntry[];
  entryCount: number;
  totalBytes: number;
}

export interface ModelPackCacheStorage {
  read(key: string): Promise<ModelPackCacheStorageReadResult>;
  commit(value: ModelPackCacheStorageCommit): Promise<ModelPackCacheStorageCommitResult>;
  remove(key: string): Promise<boolean>;
  clear(): Promise<number>;
  inspect(): Promise<ModelPackCacheStorageSnapshot>;
  close(): void | Promise<void>;
}

export interface IndexedDbModelPackCacheStorageOptions {
  indexedDB?: IDBFactory;
  databaseName?: string;
}

export interface VerifiedModelPackCacheOptions {
  verifyBundle?: (
    source: ModelPackBrowserBundleSource
  ) => Promise<Readonly<ModelPack>>;
  maxEntries?: number;
  maxRecordBytes?: number;
  maxTotalBytes?: number;
  ownsStorage?: boolean;
}

export interface ModelPackCacheMiss {
  state: "miss";
  key: string;
}

export interface ModelPackCacheInvalid {
  state: "invalid";
  key: string;
  invalidCode: string;
}

export interface ModelPackCacheHit {
  state: "hit";
  key: string;
  byteLength: number;
  pack: Readonly<ModelPack>;
}

export type ModelPackCacheMatch =
  | ModelPackCacheMiss
  | ModelPackCacheInvalid
  | ModelPackCacheHit;

export interface ModelPackCacheLoaderContext {
  identity: Readonly<ModelPackCacheIdentity>;
  key: string;
}

export type ModelPackCacheLoader = (
  context: Readonly<ModelPackCacheLoaderContext>
) => Promise<Readonly<ModelPack>> | Readonly<ModelPack>;

export interface ModelPackCacheLoadResult {
  source: "cache" | "loader";
  cacheState: "hit" | "miss" | "invalid";
  invalidCode?: string;
  key: string;
  byteLength: number;
  evictedKeys: readonly string[];
  pack: Readonly<ModelPack>;
}

export interface ModelPackCachePutResult {
  key: string;
  byteLength: number;
  evictedKeys: readonly string[];
  entryCount: number;
  totalBytes: number;
  pack: Readonly<ModelPack>;
}

export interface VerifiedModelPackCache {
  match(identity: ModelPackCacheIdentity): Promise<ModelPackCacheMatch>;
  put(identity: ModelPackCacheIdentity, pack: Readonly<ModelPack>): Promise<ModelPackCachePutResult>;
  load(
    identity: ModelPackCacheIdentity,
    loader: ModelPackCacheLoader
  ): Promise<ModelPackCacheLoadResult>;
  remove(identity: ModelPackCacheIdentity): Promise<boolean>;
  clear(): Promise<number>;
  inspect(): Promise<ModelPackCacheStorageSnapshot>;
  close(): Promise<void>;
}

export const MODEL_PACK_CACHE_FORMAT: "onto2d-model-pack-cache";
export const MODEL_PACK_CACHE_FORMAT_VERSION: "1";
export const MODEL_PACK_CACHE_LIMITS: Readonly<ModelPackCacheLimits>;

export function modelPackCacheKey(identity: ModelPackCacheIdentity): string;
export function createMemoryModelPackCacheStorage(): Readonly<ModelPackCacheStorage>;
export function createIndexedDbModelPackCacheStorage(
  options?: IndexedDbModelPackCacheStorageOptions
): Readonly<ModelPackCacheStorage>;
export function createVerifiedModelPackCache(
  storage: ModelPackCacheStorage,
  options?: VerifiedModelPackCacheOptions
): Readonly<VerifiedModelPackCache>;
