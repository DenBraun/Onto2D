// Portable routing to the existing graph API; algorithms and contracts are shared.
export {
  canonicalizeCandidate,
  canonicalizeSkeleton,
  normalizeGraphCanonicalizationOptions,
  DEFAULT_GRAPH_POLICY,
  DEFAULT_GRAPH_CANONICALIZATION_LIMITS
} from "./index.js";
export type {
  CandidateInput, SkeletonInput, GraphPolicy, GraphCanonicalizationOptions,
  GraphCanonicalizationLimits, GraphCanonicalizationStatistics,
  CanonicalCandidateResult, CanonicalSkeletonResult
} from "./index.js";
