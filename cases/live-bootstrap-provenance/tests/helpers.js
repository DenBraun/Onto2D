import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashArtifactBytes, hashCanonical } from "@onto2d/kernel/canonical";
import { parseManifestBytes } from "../extract.mjs";

export const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function readCaseJson(relativePath) {
  return JSON.parse(await readFile(path.join(CASE_ROOT, relativePath), "utf8"));
}

export async function readManifestBytes() {
  return readFile(path.join(CASE_ROOT, "fixtures/manifest/steps-manifest"));
}

export function traceFromText(text, variables = {}) {
  const bytes = new TextEncoder().encode(text);
  const sourceIdentity = hashCanonical("onto2d:test-live-bootstrap-source:v1", { text, variables });
  return parseManifestBytes(bytes, {
    extractionProfile: "live-bootstrap-provenance-v1",
    sourceIdentity,
    source: {
      repository: "https://example.invalid/live-bootstrap",
      revision: "0".repeat(40),
      revisionTree: "1".repeat(40),
      submodules: [],
      files: [{
        path: "steps/manifest",
        role: "test manifest",
        sha256: hashArtifactBytes(bytes)
      }],
      sourceIdentity
    },
    profile: {
      id: "default-amd64",
      description: "Synthetic test profile.",
      upstreamSupportStatus: "unknown",
      upstreamSupportNote: "Synthetic input, not an upstream support claim.",
      variables
    }
  });
}
