import {
  modelPackFilePaths,
  verifyModelPack
} from "@onto2d/model-pack";
import { matchModelPackRegistryResolution } from "@onto2d/model-pack/registry";
import { createLazyModelPresentation } from "@onto2d/view/lazy";
import { engineFail } from "./errors.js";

const OPTION_FIELDS = new Set(["resolution", "defaultCatalogPageSize"]);

function optionEntries(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    engineFail("ENGINE_PRESENTATION_OPTIONS_INVALID", "Presentation options must be a plain object.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    engineFail("ENGINE_PRESENTATION_OPTIONS_INVALID", "Presentation options must be a plain object.");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    engineFail("ENGINE_PRESENTATION_OPTIONS_INVALID", "Presentation options must not contain symbol fields.");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = new Map();
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      engineFail(
        "ENGINE_PRESENTATION_OPTIONS_INVALID",
        "Presentation options must contain enumerable data fields only.",
        { field: key }
      );
    }
    if (!OPTION_FIELDS.has(key)) {
      engineFail("ENGINE_PRESENTATION_OPTIONS_INVALID", "Presentation options contain an unknown field.", {
        field: key
      });
    }
    entries.set(key, descriptor.value);
  }
  return entries;
}

export function createVerifiedModelPresentation(pack, options = {}) {
  const entries = optionEntries(options);
  let verified = verifyModelPack(pack);
  if (entries.has("resolution")) {
    verified = matchModelPackRegistryResolution(verified, entries.get("resolution"));
  }
  const paths = modelPackFilePaths();
  return createLazyModelPresentation({
    identity: {
      modelId: verified.manifest.model.id,
      modelVersion: verified.manifest.model.version,
      rootHash: verified.manifest.rootHash,
      manifestHash: verified.manifest.manifestHash
    },
    nodes: verified.files[paths.nodes],
    edges: verified.files[paths.edges]
  }, entries.has("defaultCatalogPageSize") ? {
    defaultCatalogPageSize: entries.get("defaultCatalogPageSize")
  } : undefined);
}
