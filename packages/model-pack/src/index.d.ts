export type ContentHash = `sha256:${string}`;
export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ModelPackModel {
  id: string;
  name: string;
  version: string;
  description?: string;
  status?: string;
}

export interface ModelPackSourceFile {
  path: string;
  hash: ContentHash;
}

export interface ModelPackSource {
  id: string;
  files: ModelPackSourceFile[];
  auditHash?: ContentHash;
}

export interface ModelPackFileDescriptor {
  id: string;
  path: string;
  hash: ContentHash;
}

export interface ModelPackManifest {
  schemaVersion: "1";
  format: "onto2d-model-pack";
  formatVersion: "1";
  model: ModelPackModel;
  compatibility: {
    engineApiVersion: "1";
    modelPackFormatVersion: "1";
  };
  source: ModelPackSource;
  semanticFiles: ModelPackFileDescriptor[];
  indexFiles: ModelPackFileDescriptor[];
  statistics: { nodeCount: number; edgeCount: number };
  rootHash: ContentHash;
  manifestHash: ContentHash;
}

export interface ModelPackNode {
  id: string;
  [key: string]: JsonValue;
}

export interface ModelPackEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: JsonValue;
}

export interface ModelPack {
  manifest: ModelPackManifest;
  files: Record<string, JsonValue>;
}

export interface BuildModelPackInput {
  model: ModelPackModel;
  source: ModelPackSource;
  nodes: ModelPackNode[];
  edges: ModelPackEdge[];
  dictionaries: Record<string, JsonValue>;
}

export interface ModelPackIndexes {
  byId: { id: string; index: number }[];
  parents: { id: string; nodes: string[] }[];
  children: { id: string; nodes: string[] }[];
  levels: { value: JsonValue; nodes: string[] }[];
  phases: { value: JsonValue; nodes: string[] }[];
  typeRoles: { value: JsonValue; nodes: string[] }[];
  scientificStatus: { value: JsonValue; nodes: string[] }[];
}

export class ModelPackError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const MODEL_PACK_FORMAT: "onto2d-model-pack";
export const MODEL_PACK_FORMAT_VERSION: "1";
export const MODEL_PACK_SCHEMA_VERSION: "1";
export const MODEL_PACK_ENGINE_API_VERSION: "1";

export function buildModelIndexes(
  nodes: ModelPackNode[],
  edges: ModelPackEdge[]
): Readonly<ModelPackIndexes>;
export function buildModelPack(input: BuildModelPackInput): Readonly<ModelPack>;
export function verifyModelPack(pack: ModelPack): Readonly<ModelPack>;
export function modelPackFilePaths(): Readonly<Record<string, string>>;
