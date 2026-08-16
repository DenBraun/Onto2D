import type {
  Candidate,
  CandidateInput,
  CanonicalForm,
  ContentHash,
  GraphCanonicalizationLimits,
  GraphCanonicalizationOptions,
  GraphCanonicalizationStatistics,
  GraphPolicy
} from "@onto2d/kernel";
import type { ModelResolution } from "@onto2d/engine";

export const CANONICAL_IDENTITY_ANALYSIS_ID: "canonical-identity";
export const CANONICAL_IDENTITY_ANALYSIS_VERSION: "1";
export const CANONICAL_IDENTITY_REQUEST_SCHEMA:
  "https://onto2d.dev/schemas/v1/canonical-identity-request.schema.json";
export const CANONICAL_IDENTITY_ARTIFACT_SCHEMA:
  "https://onto2d.dev/schemas/v1/canonical-identity-artifact.schema.json";

export interface CanonicalIdentityRequest {
  candidate: CandidateInput;
  options?: GraphCanonicalizationOptions;
}

export interface CanonicalIdentityModelBinding {
  modelId: string;
  modelVersion: string;
  modelRootHash: ContentHash;
}

export interface CanonicalIdentityArtifact {
  schemaVersion: "1";
  analysis: { id: "canonical-identity"; version: "1" };
  engine: { version: "0.1.0"; apiVersion: "1" };
  model: CanonicalIdentityModelBinding;
  request: Required<CanonicalIdentityRequest>;
  requestHash: ContentHash;
  result: {
    candidateId: ContentHash;
    skeletonId: ContentHash;
    candidate: Candidate;
    skeletonCanonicalForm: CanonicalForm;
    graphPolicy: GraphPolicy;
    canonicalizationLimits: GraphCanonicalizationLimits;
    inputToCanonical: number[];
    canonicalToInput: number[];
    inputEdgeToCanonical: number[];
    statistics: GraphCanonicalizationStatistics & {
      skeleton: GraphCanonicalizationStatistics;
      candidate: GraphCanonicalizationStatistics;
    };
  };
  artifactHash: ContentHash;
}

export interface CanonicalIdentityAnalysisContext {
  modelResolution: ModelResolution;
}

export interface CanonicalIdentityAnalysisDefinition {
  readonly id: "canonical-identity";
  readonly version: "1";
  readonly requiredModelCapabilities: readonly [];
  readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof CANONICAL_IDENTITY_REQUEST_SCHEMA;
  readonly outputArtifacts: readonly [typeof CANONICAL_IDENTITY_ARTIFACT_SCHEMA];
  run(
    context: CanonicalIdentityAnalysisContext,
    input: CanonicalIdentityRequest
  ): Readonly<CanonicalIdentityArtifact>;
}

export function analyzeCanonicalIdentity(
  context: CanonicalIdentityAnalysisContext,
  input: CanonicalIdentityRequest
): Readonly<CanonicalIdentityArtifact>;
export function verifyCanonicalIdentityArtifact(
  artifact: CanonicalIdentityArtifact,
  expectedModelResolution?: ModelResolution | CanonicalIdentityModelBinding
): Readonly<CanonicalIdentityArtifact>;
export function createCanonicalIdentityAnalysis(): Readonly<CanonicalIdentityAnalysisDefinition>;
export const canonicalIdentityAnalysis: Readonly<CanonicalIdentityAnalysisDefinition>;
