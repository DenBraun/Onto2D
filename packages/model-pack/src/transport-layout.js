import { canonicalize } from "@onto2d/kernel/canonical";
import {
  ModelPackError,
  modelPackFilePaths,
  verifyModelPack
} from "./index.js";

export const MODEL_PACK_REQUIRED_PATHS = Object.freeze([
  "manifest.json",
  ...Object.values(modelPackFilePaths())
]);

export const MODEL_PACK_OPTIONAL_PATHS = Object.freeze(["bundle.json"]);

export const MODEL_PACK_ALLOWED_PATHS = new Set([
  ...MODEL_PACK_REQUIRED_PATHS,
  ...MODEL_PACK_OPTIONAL_PATHS
]);

export const MODEL_PACK_ALLOWED_DIRECTORIES = new Set(
  [...MODEL_PACK_ALLOWED_PATHS].flatMap((filePath) => {
    const segments = filePath.split("/");
    return segments
      .slice(0, -1)
      .map((_, index) => segments.slice(0, index + 1).join("/"));
  })
);

export function modelPackTransportFail(code, message, details = {}) {
  throw new ModelPackError(code, message, details);
}

export function inspectTransportOptions(value, code, subject) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    modelPackTransportFail(code, `${subject} must be a plain data object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    modelPackTransportFail(code, `${subject} must be a plain data object.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = new Map();
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== "string" || !("value" in descriptor)) {
      modelPackTransportFail(code, `${subject} must contain only string data properties.`);
    }
    entries.set(key, descriptor.value);
  }
  return entries;
}

export function verifyTransportFiles(values) {
  const manifest = values.get("manifest.json");
  const packFiles = {};
  for (const relative of Object.values(modelPackFilePaths())) {
    packFiles[relative] = values.get(relative);
  }
  const verified = verifyModelPack({ manifest, files: packFiles });
  if (values.has("bundle.json")) {
    const bundle = verifyModelPack(values.get("bundle.json"));
    if (canonicalize(bundle) !== canonicalize(verified)) {
      modelPackTransportFail(
        "MODEL_PACK_TRANSPORT_BUNDLE_MISMATCH",
        "bundle.json differs from the authoritative split Model Pack files."
      );
    }
  }
  return verified;
}
