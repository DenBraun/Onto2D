import type {
  CanonicalizationOptions,
  ContentHash,
  JsonValue
} from "./index.js";

export function canonicalClone<T extends JsonValue>(
  value: T,
  options?: CanonicalizationOptions
): T;
export function canonicalize(value: JsonValue, options?: CanonicalizationOptions): string;
export function deepFreeze<T>(value: T): Readonly<T>;
export function hashCanonical(
  domain: string,
  value: JsonValue,
  options?: CanonicalizationOptions
): ContentHash;
export function hashArtifactBytes(bytes: Uint8Array): ContentHash;
export function isContentHash(value: unknown): value is ContentHash;
