import type { ModelPack } from "./index.js";

export interface ModelPackDirectoryLimits {
  maxFileCount: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export const MODEL_PACK_DIRECTORY_LIMITS: Readonly<ModelPackDirectoryLimits>;

export function loadModelPackDirectory(
  directory: string,
  options?: Partial<ModelPackDirectoryLimits>
): Promise<Readonly<ModelPack>>;
