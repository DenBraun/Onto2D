import type { ModelPack } from "./index.js";

export interface ModelPackDirectoryLimits {
  maxFileCount: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface ModelPackArchiveLimits {
  maxArchiveBytes: number;
  maxEntryCount: number;
  maxCompressedEntryBytes: number;
  maxUncompressedEntryBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
}

export interface ModelPackPathOptions {
  directory?: Partial<ModelPackDirectoryLimits>;
  archive?: Partial<ModelPackArchiveLimits>;
}

export const MODEL_PACK_DIRECTORY_LIMITS: Readonly<ModelPackDirectoryLimits>;
export const MODEL_PACK_ARCHIVE_LIMITS: Readonly<ModelPackArchiveLimits>;

export function loadModelPackDirectory(
  directory: string,
  options?: Partial<ModelPackDirectoryLimits>
): Promise<Readonly<ModelPack>>;

export function loadModelPackArchive(
  archive: string,
  options?: Partial<ModelPackArchiveLimits>
): Promise<Readonly<ModelPack>>;

export function loadModelPackPath(
  source: string,
  options?: ModelPackPathOptions
): Promise<Readonly<ModelPack>>;
