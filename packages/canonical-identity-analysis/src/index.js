import {
  canonicalClone,
  canonicalize,
  canonicalizeCandidate,
  deepFreeze,
  hashCanonical,
  isContentHash
} from "@onto2d/kernel";
import { ENGINE_API_VERSION, ENGINE_VERSION, EngineError } from "@onto2d/engine";

export const CANONICAL_IDENTITY_ANALYSIS_ID = "canonical-identity";
export const CANONICAL_IDENTITY_ANALYSIS_VERSION = "1";
export const CANONICAL_IDENTITY_REQUEST_SCHEMA =
  "https://onto2d.dev/schemas/v1/canonical-identity-request.schema.json";
export const CANONICAL_IDENTITY_ARTIFACT_SCHEMA =
  "https://onto2d.dev/schemas/v1/canonical-identity-artifact.schema.json";

function fail(code, message, details = {}) {
  throw new EngineError(code, message, details);
}

function requirePlainObject(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("CANONICAL_IDENTITY_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("CANONICAL_IDENTITY_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  return value;
}

function normalizedModelResolution(context) {
  const resolution = requirePlainObject(context?.modelResolution, "context.modelResolution");
  const model = {
    modelId: resolution.modelId,
    modelVersion: resolution.modelVersion,
    modelRootHash: resolution.modelRootHash
  };
  if (
    typeof model.modelId !== "string" || model.modelId.length === 0 ||
    typeof model.modelVersion !== "string" || model.modelVersion.length === 0 ||
    !isContentHash(model.modelRootHash)
  ) {
    fail("CANONICAL_IDENTITY_MODEL_BINDING_INVALID", "The analysis requires an exact model resolution.");
  }
  return model;
}

function buildArtifact(context, input) {
  const value = canonicalClone(requirePlainObject(input, "input"));
  const unknown = Object.keys(value).filter((field) => !["candidate", "options"].includes(field));
  if (unknown.length > 0) {
    fail("CANONICAL_IDENTITY_INPUT_INVALID", "Canonical Identity input contains unknown fields.", {
      unknown
    });
  }
  const request = {
    candidate: value.candidate,
    options: value.options ?? {}
  };
  const canonical = canonicalizeCandidate(request.candidate, request.options);
  const body = {
    schemaVersion: "1",
    analysis: {
      id: CANONICAL_IDENTITY_ANALYSIS_ID,
      version: CANONICAL_IDENTITY_ANALYSIS_VERSION
    },
    engine: {
      version: ENGINE_VERSION,
      apiVersion: ENGINE_API_VERSION
    },
    model: normalizedModelResolution(context),
    request,
    requestHash: hashCanonical("onto2d:canonical-identity-request:v1", request),
    result: {
      candidateId: canonical.candidateId,
      skeletonId: canonical.skeletonId,
      candidate: canonical.candidate,
      skeletonCanonicalForm: canonical.skeletonCanonicalForm,
      graphPolicy: canonical.graphPolicy,
      canonicalizationLimits: canonical.canonicalizationLimits,
      inputToCanonical: canonical.inputToCanonical,
      canonicalToInput: canonical.canonicalToInput,
      inputEdgeToCanonical: canonical.inputEdgeToCanonical,
      statistics: canonical.statistics
    }
  };
  return deepFreeze({
    ...body,
    artifactHash: hashCanonical("onto2d:canonical-identity-artifact:v1", body)
  });
}

export function analyzeCanonicalIdentity(context, input) {
  return buildArtifact(context, input);
}

export function verifyCanonicalIdentityArtifact(artifact, expectedModelResolution) {
  const value = canonicalClone(requirePlainObject(artifact, "artifact"));
  if (
    value.schemaVersion !== "1" ||
    value.analysis?.id !== CANONICAL_IDENTITY_ANALYSIS_ID ||
    value.analysis?.version !== CANONICAL_IDENTITY_ANALYSIS_VERSION ||
    value.engine?.version !== ENGINE_VERSION ||
    value.engine?.apiVersion !== ENGINE_API_VERSION
  ) {
    fail("CANONICAL_IDENTITY_ARTIFACT_VERSION_UNSUPPORTED", "The Canonical Identity artifact version is unsupported.");
  }
  const rebuilt = buildArtifact({ modelResolution: value.model }, value.request);
  if (canonicalize(value) !== canonicalize(rebuilt)) {
    fail("CANONICAL_IDENTITY_ARTIFACT_VERIFICATION_FAILED", "The Canonical Identity artifact differs from kernel replay.");
  }
  if (expectedModelResolution !== undefined) {
    const expected = normalizedModelResolution({ modelResolution: expectedModelResolution });
    if (canonicalize(rebuilt.model) !== canonicalize(expected)) {
      fail("CANONICAL_IDENTITY_MODEL_BINDING_MISMATCH", "The artifact is bound to a different Model Pack.");
    }
  }
  return rebuilt;
}

export function createCanonicalIdentityAnalysis() {
  return Object.freeze({
    id: CANONICAL_IDENTITY_ANALYSIS_ID,
    version: CANONICAL_IDENTITY_ANALYSIS_VERSION,
    requiredModelCapabilities: Object.freeze([]),
    requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: CANONICAL_IDENTITY_REQUEST_SCHEMA,
    outputArtifacts: Object.freeze([CANONICAL_IDENTITY_ARTIFACT_SCHEMA]),
    run: analyzeCanonicalIdentity
  });
}

export const canonicalIdentityAnalysis = createCanonicalIdentityAnalysis();
