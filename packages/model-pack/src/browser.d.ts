import type { ModelPack } from "./index.js";

export interface ModelPackBrowserLimits {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxBundleBytes: number;
  maxUrlLength: number;
}

export type ModelPackBrowserFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface ModelPackHttpDirectoryOptions {
  fetch?: ModelPackBrowserFetch;
  signal?: AbortSignal | null;
  bundle?: "omit" | "required";
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxUrlLength?: number;
}

export interface ModelPackBrowserBundleOptions {
  maxBundleBytes?: number;
}

export type ModelPackBrowserBundleSource = Blob | ArrayBuffer | ArrayBufferView;

export const MODEL_PACK_BROWSER_LIMITS: Readonly<ModelPackBrowserLimits>;

export function loadModelPackHttpDirectory(
  baseUrl: string | URL,
  options?: ModelPackHttpDirectoryOptions
): Promise<Readonly<ModelPack>>;

export function loadModelPackBundle(
  source: ModelPackBrowserBundleSource,
  options?: ModelPackBrowserBundleOptions
): Promise<Readonly<ModelPack>>;
