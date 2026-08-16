import type { ModelPack } from "./index.js";
import type { ModelPackBrowserFetch } from "./browser.js";

export interface ModelPackWorkerProtocol {
  name: "onto2d-model-pack-worker";
  version: "1";
}

export interface ModelPackWorkerLimits {
  maxActiveRequests: number;
  maxPendingRequests: number;
  maxRequestIdLength: number;
  maxRequestTimeoutMs: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxBundleBytes: number;
  maxUrlLength: number;
  maxResultEntries: number;
  maxResultDepth: number;
}

export interface ModelPackWorkerHttpOptions {
  signal?: AbortSignal | null;
  timeoutMs?: number;
  bundle?: "omit" | "required";
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxUrlLength?: number;
}

export interface ModelPackWorkerBundleOptions {
  signal?: AbortSignal | null;
  timeoutMs?: number;
  transfer?: "copy" | "move";
  maxBundleBytes?: number;
}

export type ModelPackWorkerBundleSource = Blob | ArrayBuffer | ArrayBufferView;

export interface ModelPackWorkerClientOptions {
  clientId?: string;
  maxPendingRequests?: number;
  requestTimeoutMs?: number;
  ownsWorker?: boolean;
}

export interface ModelPackWorkerClient {
  loadHttpDirectory(
    baseUrl: string | URL,
    options?: ModelPackWorkerHttpOptions
  ): Promise<Readonly<ModelPack>>;
  loadBundle(
    source: ModelPackWorkerBundleSource,
    options?: ModelPackWorkerBundleOptions
  ): Promise<Readonly<ModelPack>>;
  close(): void;
}

export interface ModelPackWorkerEndpointOptions {
  fetch?: ModelPackBrowserFetch;
  maxActiveRequests?: number;
}

export interface ModelPackWorkerEndpointScope {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

export interface ModelPackWorkerEndpoint {
  close(): void;
}

export interface ModelPackWorkerSerializedError {
  name: "ModelPackError";
  code: string;
  message: string;
  details: Readonly<Record<string, unknown>>;
}

export interface ModelPackWorkerHttpRequestMessage {
  protocol: ModelPackWorkerProtocol["name"];
  version: ModelPackWorkerProtocol["version"];
  kind: "request";
  id: string;
  operation: "load-http-directory";
  input: {
    baseUrl: string;
    options: {
      bundle: "omit" | "required";
      maxFileBytes: number;
      maxTotalBytes: number;
      maxUrlLength: number;
    };
  };
}

export interface ModelPackWorkerBundleRequestMessage {
  protocol: ModelPackWorkerProtocol["name"];
  version: ModelPackWorkerProtocol["version"];
  kind: "request";
  id: string;
  operation: "load-bundle";
  input: {
    source: Blob | ArrayBuffer;
    options: { maxBundleBytes: number };
  };
}

export interface ModelPackWorkerCancelMessage {
  protocol: ModelPackWorkerProtocol["name"];
  version: ModelPackWorkerProtocol["version"];
  kind: "cancel";
  id: string;
}

export type ModelPackWorkerRequestMessage =
  | ModelPackWorkerHttpRequestMessage
  | ModelPackWorkerBundleRequestMessage
  | ModelPackWorkerCancelMessage;

export interface ModelPackWorkerResultMessage {
  protocol: ModelPackWorkerProtocol["name"];
  version: ModelPackWorkerProtocol["version"];
  kind: "result";
  id: string;
  pack: Readonly<ModelPack>;
}

export interface ModelPackWorkerErrorMessage {
  protocol: ModelPackWorkerProtocol["name"];
  version: ModelPackWorkerProtocol["version"];
  kind: "error";
  id: string;
  error: ModelPackWorkerSerializedError;
}

export type ModelPackWorkerResponseMessage =
  | ModelPackWorkerResultMessage
  | ModelPackWorkerErrorMessage;

export const MODEL_PACK_WORKER_PROTOCOL: Readonly<ModelPackWorkerProtocol>;
export const MODEL_PACK_WORKER_LIMITS: Readonly<ModelPackWorkerLimits>;

export function createModelPackWorkerClient(
  worker: Worker,
  options?: ModelPackWorkerClientOptions
): Readonly<ModelPackWorkerClient>;

export function installModelPackWorkerEndpoint(
  scope?: ModelPackWorkerEndpointScope,
  options?: ModelPackWorkerEndpointOptions
): Readonly<ModelPackWorkerEndpoint>;
