export type ContentHash = `sha256:${string}`;
export type ElementId = ContentHash;
export type CandidateId = ContentHash;
export type ProfileHash = ContentHash;
export type SkeletonId = ContentHash;
export type BasisHash = ContentHash;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type InternalOrder = "defined" | "undefined";

export type SourceRelationKind =
  | "generative"
  | "constitutive"
  | "intra-closure-support"
  | "evidential"
  | "descriptive"
  | "regulatory-feedback";

export type ClusterDisposition =
  | "distributed-structure"
  | "constitutive-cluster"
  | "unresolved-generative-cluster"
  | "mixed-unresolved-cluster";

export type MigrationExposureStatus =
  | "prospective-blind"
  | "deterministic-precommitted"
  | "historically-exposed";

export type EvidenceState =
  | "paper-assumption"
  | "paper-derivation"
  | "package-operationalization"
  | "computationally-verified"
  | "externally-supported"
  | "falsified"
  | "unresolved";

export type PredicateOutcome = "pass" | "fail" | "indeterminate";

export interface ArtifactRef {
  path: string;
  mediaType: string;
  schemaVersion: string;
  bytes: number;
  hash: ContentHash;
}

export interface EvidenceRef {
  id: string;
  state: EvidenceState;
  source: ArtifactRef;
  locator?: { page?: number; equation?: number; fragment?: string };
  method?: { id: string; version: string; inputHash: ContentHash };
}

export interface Claim {
  id: string;
  statement: string;
  state: EvidenceState;
  evidence: string[];
}

export interface Tolerance {
  absolute?: number;
  relative?: number;
}

export type QuantityProvenance =
  | { kind: "declared"; evidence: string[] }
  | { kind: "computed"; method: string; evidence: string[] }
  | { kind: "oracle"; source: ContentHash; method: string; evidence: string[] };

export interface Quantity {
  value: number;
  unit: string;
  tolerance: Tolerance;
  semantic: string;
  provenance: QuantityProvenance;
}

export type OntologyPhase = "A" | "B" | "C" | "D" | `custom:${string}`;

export interface OntologyCoordinate {
  level: number;
  phase?: OntologyPhase;
  segment?: string;
}

export interface PrimitiveAxisProvenance {
  ontologyLevel?: "declared" | "computed";
  ontologyPhase?: "declared";
  catalogueLevel?: "declared";
  cataloguePhase?: "declared";
}

export interface ClassifiedSourceRelation {
  id: string;
  source: string;
  target: string;
  kind: SourceRelationKind;
  scope: "inter-cluster" | "intra-cluster";
  policyHash: ContentHash;
  classificationArtifact: ArtifactRef;
  postUnblindingChange?: {
    previousKind: SourceRelationKind;
    reason: string;
    approvalArtifact: ArtifactRef;
  };
}

export type SourceRelation = ClassifiedSourceRelation;

export interface ClusterProvenance {
  disposition: ClusterDisposition;
  members: string[];
  internalRelations: string[];
  internalOrder: "undefined";
  classificationPolicyHash: ContentHash;
  classificationArtifact: ArtifactRef;
  nodeResolutionArtifact: ArtifactRef;
  condensationArtifact: ArtifactRef;
}

export interface ProfileSlot {
  role: string;
  polarity: "in" | "out" | "sym";
  capacity: { min: number; max: number | null };
  guard?: JsonValue;
}

export interface ProfileInvariant {
  semantic: string;
  normalized: Quantity;
  quantization: Quantity;
}

export interface Profile {
  slots: ProfileSlot[];
  invariantVector: ProfileInvariant[];
  precisionPolicy: string;
  hash?: ContentHash;
}

export interface NormalizedProfile extends Omit<Profile, "hash"> {
  hash: ContentHash;
}

export interface PrimitiveDefinition {
  sourceId: string;
  kind: "primitive" | "condensed-cluster";
  cluster?: ClusterProvenance;
  ontologyCoordinate?: OntologyCoordinate;
  axisProvenance?: PrimitiveAxisProvenance;
  typeTags: string[];
  invariants: Record<string, Quantity>;
  profile: Profile;
  claimRefs: string[];
}

export interface Predicate {
  id: string;
  phase: "formation" | "maintenance" | "termination";
  monotoneViolation: boolean;
  referencesDepth: "below" | "self";
  expr: { op: string; [key: string]: JsonValue };
  explain: { pass: string; fail: string; indeterminate: string };
  claimRefs: string[];
}

export interface ValueExpression {
  kind: string;
  [key: string]: JsonValue;
}

export interface QuantitySpec {
  id: string;
  unit: string;
  semantic: string;
  toleranceTarget: Tolerance;
}

export type ParameterSet = Record<string, JsonValue | Quantity>;

export interface Functional {
  id: string;
  expr: ValueExpression;
  coefficients: Record<string, Quantity>;
  sensitivityCoefficients: string[];
  result: QuantitySpec;
  explain: string;
  claimRefs: string[];
}

export type CohortRule =
  | { id: string; kind: "shared-support"; resourceKey: ValueExpression[] }
  | { id: string; kind: "profile-role"; roleKey: ValueExpression[] }
  | {
      id: string;
      kind: "invariant-window";
      value: ValueExpression;
      origin: Quantity;
      width: Quantity;
      bins: "lower-closed-upper-open";
    }
  | { id: string; kind: "singleton" }
  | { id: string; kind: "global" };

export interface SensitivityPolicy {
  amplitudes: number[];
  sweep: "one-at-a-time" | "cartesian";
  topK: number;
  robustLeaderSetThreshold: number;
  robustTopKThreshold: number;
}

export interface SensitivityPoint {
  perturbation: number;
  evaluatedVariants: number;
  leaderSetStability: number;
  presentationLeaderStability: number;
  topKStability: number;
}

export interface SensitivityReport {
  selectorId: string;
  policy: SensitivityPolicy;
  status: "complete" | "indeterminate";
  points: SensitivityPoint[];
  verdict: "robust" | "fragile" | null;
  reasons: string[];
}

export interface ExplanationTemplate {
  pass: string;
  fail: string;
  indeterminate: string;
}

export interface CohortSelector {
  id: string;
  objective: "min" | "max";
  functional: string;
  cohortRule: string;
  epsilon: Quantity;
  tiePolicy: "retain-all";
  sensitivity: SensitivityPolicy;
  explain: ExplanationTemplate;
  claimRefs: string[];
}

export interface OntologyAxisDefinition {
  phasePrecedence: { before: OntologyPhase; after: OntologyPhase }[];
  levelPolicy: "declared" | "profile-collapse-computed" | "mixed-with-comparison";
}

export type PartialOraclePolicy =
  | { mode: "indeterminate" }
  | {
      mode: "accept-expanded-tolerance";
      toleranceMultiplier: number;
      maximumResidual?: Quantity;
    };

export interface OracleRequest {
  candidate: CanonicalForm;
  quantities: QuantitySpec[];
  parameters: ParameterSet;
  toleranceTarget: Tolerance;
  solver: { id: string; version: string; method: string };
}

export interface OracleResponse {
  requestHash: ContentHash;
  values: Record<string, Quantity>;
  convergence: "converged" | "partial" | "failed";
  residual?: Quantity;
  solver: {
    id: string;
    version: string;
    method: string;
    parameters: ParameterSet;
  };
  wallTimeMs: number;
}

export interface IdentityPolicy {
  version: string;
  sourceIdStructural: boolean;
  ontologyCoordinateStructural: boolean;
  typeTagsStructural: boolean;
  invariantsStructural: boolean;
  profileStructural: boolean;
  clusterPolicyStructural: boolean;
}

export interface RulePackage {
  schemaVersion: "1";
  id: string;
  version: string;
  primitives: PrimitiveDefinition[];
  sourceArtifacts?: ArtifactRef[];
  sourceMigration?: { [key: string]: JsonValue };
  evidence?: EvidenceRef[];
  claims?: Claim[];
  predicates?: Predicate[];
  functionals?: Functional[];
  cohortRules?: CohortRule[];
  selectors?: CohortSelector[];
  partialOraclePolicy?: PartialOraclePolicy;
  ontologyAxes?: OntologyAxisDefinition;
  perturbations?: JsonValue[];
  profileDefinition?: { kind: "explicit-only" };
  identityPolicy?: Partial<IdentityPolicy>;
}

export type KernelPackage = RulePackage;

export interface NormalizedPrimitiveDefinition extends Omit<PrimitiveDefinition, "profile"> {
  profile: NormalizedProfile;
  elementId: ElementId;
}

export interface NormalizedRulePackage extends Required<Omit<RulePackage, "sourceMigration">> {
  sourceMigration?: { [key: string]: JsonValue };
  primitives: NormalizedPrimitiveDefinition[];
  identityPolicy: IdentityPolicy;
}

export interface SemanticManifest {
  schemaVersion: "1";
  kernelVersion: string;
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  identityPolicyHash: ContentHash;
}

export interface LoadedRulePackage {
  kind: "loaded-kernel-package";
  schemaVersion: "1";
  packageId: ContentHash;
  normalized: NormalizedRulePackage;
  semanticManifest: SemanticManifest;
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  details: Readonly<Record<string, unknown>>;
}

export class KernelError extends Error {
  readonly code: string;
  readonly stage: string;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(options: {
    code: string;
    stage: string;
    message: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  });
  toJSON(): {
    name: string;
    code: string;
    stage: string;
    message: string;
    details: Readonly<Record<string, unknown>>;
  };
}

export class KernelValidationError extends KernelError {
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[], message?: string, options?: {
    code?: string;
    stage?: string;
  });
}

export class KernelNotImplementedError extends KernelError {
  readonly code: "KERNEL_NOT_IMPLEMENTED";
  readonly capability: string;
  constructor(capability: string);
}

export interface CanonicalizationOptions {
  limits?: Partial<{
    maxDepth: number;
    maxEntries: number;
    maxStringBytes: number;
  }>;
}

export interface CanonicalForm {
  schemaVersion: string;
  bytesBase64: string;
  hash: ContentHash;
}

export type CandidateDomain = "profile-quotient" | "element-exact" | "single-candidate";
export type CandidateAttribute = JsonPrimitive | Quantity;

export interface CandidateNode {
  ref: ElementId | ProfileHash;
  attrs?: Record<string, CandidateAttribute>;
}

export interface CandidateEdge {
  from: number;
  to: number;
  role: string;
  attrs?: Record<string, CandidateAttribute>;
}

export interface CandidateInput {
  id?: CandidateId;
  domain: CandidateDomain;
  nodes: CandidateNode[];
  edges: CandidateEdge[];
  skeleton?: SkeletonId;
  canonicalForm?: CanonicalForm;
}

export interface Candidate extends CandidateInput {
  id: CandidateId;
  skeleton: SkeletonId;
  canonicalForm: CanonicalForm;
}

export interface GraphPolicy {
  connected: boolean;
  allowParallelEdges: boolean;
  allowSelfLoops: boolean;
  connectivityProjection: "undirected" | "directed-strong" | "directed-weak";
  structuralNodeAttributes: string[];
  structuralEdgeAttributes: string[];
}

export type AggregationAxis =
  | "derivation-depth"
  | "ontology-level"
  | "ontology-phase"
  | "catalogue-level"
  | "catalogue-phase"
  | "predicate-phase";

export type NullModelId = "role-shuffle" | "degree-rewire" | "uniform";

export interface RunBudget {
  maxNodes: number;
  maxEdges: number | "n+2";
  maxCandidates: number;
  perturbationSamples: number;
  nullModelRuns: number;
  maxWallTimeMs?: number;
  maxResidentBytes?: number;
}

export interface PrecisionPolicy {
  id: string;
  decimalPlaces: number;
  rounding: "half-even" | "half-up" | "toward-zero";
  summation: "exact-decimal" | "compensated-binary64";
}

export interface SubstructurePolicy {
  id: string;
  remove: "nodes" | "edges" | "nodes-and-edges";
  includeDisconnected: boolean;
  includeEmpty: boolean;
  retainIsolatedNodes: boolean;
}

export interface LevelBoundaryPolicy {
  enabled: boolean;
  searchIntervals?: { fromDepth: number; toDepth: number }[];
  maximumCollapseError: number;
  tieTolerance: number;
}

export interface RunConfig {
  schemaVersion: "1";
  countingDomain: CandidateDomain;
  sourceDepths: "all-below" | "previous-only";
  reportAxes: AggregationAxis[];
  roleAlphabet: string[];
  budget: RunBudget;
  seed: string;
  invariantPrecision: PrecisionPolicy;
  graphPolicy: GraphPolicy;
  substructurePolicy: SubstructurePolicy;
  nullModels: NullModelId[];
  ontologyTarget?: OntologyCoordinate;
  evidencePolicy: "require-all" | "allow-declared";
  indeterminateThreshold: number;
  levelBoundaryPolicy?: LevelBoundaryPolicy;
  boundedFixpoint?: { enabled: boolean; maxIterations: number };
}

export interface GraphCanonicalizationLimits {
  maxNodes: number;
  maxEdges: number;
  maxSearchStates: number;
}

export interface GraphCanonicalizationStatistics {
  searchStates: number;
  leaves: number;
  refinementRounds: number;
}

export interface GraphCanonicalizationOptions {
  policy?: Partial<GraphPolicy>;
  limits?: Partial<GraphCanonicalizationLimits>;
}

export interface CanonicalCandidateResult {
  candidateId: CandidateId;
  skeletonId: SkeletonId;
  canonical: Omit<Candidate, "id" | "canonicalForm">;
  candidate: Candidate;
  canonicalForm: CanonicalForm;
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
}

export interface SkeletonInput {
  id?: SkeletonId;
  nodeCount: number;
  edges: [number, number][];
  canonicalForm?: CanonicalForm;
}

export interface Skeleton extends SkeletonInput {
  id: SkeletonId;
  canonicalForm: CanonicalForm;
}

export interface CanonicalSkeletonResult {
  skeletonId: SkeletonId;
  canonical: Omit<Skeleton, "id" | "canonicalForm">;
  skeleton: Skeleton;
  canonicalForm: CanonicalForm;
  canonicalizationLimits: GraphCanonicalizationLimits;
  inputToCanonical: number[];
  canonicalToInput: number[];
  inputEdgeToCanonical: number[];
  statistics: GraphCanonicalizationStatistics;
}

export interface SkeletonEnumerationLimits {
  maxLabelledGraphs: number;
  maxSkeletons: number;
}

export type GenerationBudgetExhaustion =
  | {
      budget: "maxLabelledGraphs";
      used: number;
      maximum: number;
      nextMask: number;
      totalLabelledGraphs: number;
    }
  | {
      budget: "maxSkeletons";
      used: number;
      maximum: number;
      firstExcludedSkeletonId: SkeletonId;
      mask: number;
    }
  | {
      budget: "maxCandidates";
      used: number;
      maximum: number;
      firstExcludedCandidateId: CandidateId;
      attemptedCandidates: number;
    };

export type SkeletonEnumerationExhaustion = Extract<
  GenerationBudgetExhaustion,
  { budget: "maxLabelledGraphs" | "maxSkeletons" }
>;

export type CandidateStoreExhaustion = Extract<
  GenerationBudgetExhaustion,
  { budget: "maxCandidates" }
>;

export interface EnumeratedSkeleton extends Skeleton {
  labelledMultiplicity: number;
}

export interface SkeletonEnumerationResult {
  schemaVersion: "1";
  status: "complete" | "budget-exhausted";
  interpretable: boolean;
  nodeCount: number;
  skeletons: EnumeratedSkeleton[];
  counts: {
    totalLabelledGraphs: number;
    examinedLabelledGraphs: number;
    connectedLabelledGraphs: number;
    canonicalizedLabelledGraphs: number;
    uniqueSkeletons: number;
    duplicateLabelings: number;
  };
  budget: SkeletonEnumerationLimits & {
    canonicalizationLimits: GraphCanonicalizationLimits;
    exhausted: SkeletonEnumerationExhaustion | null;
  };
}

export interface CandidateStoreRecord {
  candidateId: CandidateId;
  skeletonId: SkeletonId;
  candidate: Candidate;
  canonicalForm: CanonicalForm;
  duplicateCount: number;
}

export interface CandidateStoreSnapshot {
  schemaVersion: "1";
  status: "open" | "complete" | "budget-exhausted";
  interpretable: boolean;
  domain: CandidateDomain;
  canonicalization: {
    policy: GraphPolicy;
    limits: GraphCanonicalizationLimits;
  };
  candidates: CandidateStoreRecord[];
  counts: {
    attemptedCandidates: number;
    uniqueCandidates: number;
    duplicateCandidates: number;
    excludedCandidates: number;
  };
  budget: {
    maxCandidates: number;
    exhausted: CandidateStoreExhaustion | null;
  };
}

export type CandidateStoreAddResult =
  | {
      status: "admitted" | "duplicate";
      candidateId: CandidateId;
      duplicateCount: number;
      canonicalization: CanonicalCandidateResult;
    }
  | {
      status: "budget-exhausted";
      candidateId?: CandidateId;
      exhaustion: CandidateStoreExhaustion;
    };

export interface CandidateStore {
  readonly domain: CandidateDomain;
  readonly size: number;
  readonly status: "open" | "complete" | "budget-exhausted";
  add(input: CandidateInput): CandidateStoreAddResult;
  finalize(): CandidateStoreSnapshot;
  get(candidateId: CandidateId): CandidateStoreRecord | undefined;
  snapshot(): CandidateStoreSnapshot;
}

export const CANONICAL_JSON_POLICY: "rfc8785-compatible-binary64-v1";
export const CANONICAL_LIMITS: Readonly<{
  maxDepth: number;
  maxEntries: number;
  maxStringBytes: number;
}>;
export function canonicalize(value: JsonValue, options?: CanonicalizationOptions): string;
export function canonicalBytes(value: JsonValue, options?: CanonicalizationOptions): Uint8Array;
export function canonicalClone<T extends JsonValue>(value: T, options?: CanonicalizationOptions): T;
export function deepFreeze<T>(value: T): Readonly<T>;

export const HASH_DOMAINS: Readonly<Record<
  "ARTIFACT" | "CANDIDATE" | "CLUSTER" | "DEPTH_BASIS" | "ELEMENT" |
  "IDENTITY_POLICY" | "PACKAGE" | "PROFILE" | "RULES" | "SKELETON",
  string
>>;
export function hashBytes(domain: string, bytes: Uint8Array): ContentHash;
export function hashCanonical(domain: string, value: JsonValue, options?: CanonicalizationOptions): ContentHash;
export function createCanonicalForm(domain: string, value: JsonValue, schemaVersion?: string, options?: CanonicalizationOptions): CanonicalForm;
export function isContentHash(value: unknown): value is ContentHash;
export function assertContentHash(value: unknown, label?: string): ContentHash;

export const DEFAULT_GRAPH_POLICY: Readonly<GraphPolicy>;
export const DEFAULT_GRAPH_CANONICALIZATION_LIMITS: Readonly<GraphCanonicalizationLimits>;
export function normalizeGraphCanonicalizationOptions(options?: GraphCanonicalizationOptions): {
  policy: GraphPolicy;
  limits: GraphCanonicalizationLimits;
};
export function canonicalizeCandidate(input: CandidateInput, options?: GraphCanonicalizationOptions): CanonicalCandidateResult;
export function canonicalizeSkeleton(input: SkeletonInput, options?: {
  limits?: Partial<GraphCanonicalizationLimits>;
}): CanonicalSkeletonResult;

export const DEFAULT_SKELETON_ENUMERATION_LIMITS: Readonly<SkeletonEnumerationLimits>;
export function enumerateConnectedSkeletons(nodeCount: number, options?: Partial<SkeletonEnumerationLimits> & {
  canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
}): SkeletonEnumerationResult;

export const DEFAULT_CANDIDATE_STORE_LIMITS: Readonly<{ maxCandidates: number }>;
export function createCandidateStore(options: {
  domain: CandidateDomain;
  maxCandidates?: number;
  canonicalization?: GraphCanonicalizationOptions;
}): CandidateStore;

export const KERNEL_IMPLEMENTATION_STATUS: "foundation-active/closure-not-implemented";
export const SOURCE_RELATION_KINDS: readonly SourceRelationKind[];
export const CLUSTER_DISPOSITIONS: readonly ClusterDisposition[];
export const MIGRATION_EXPOSURE_STATUSES: readonly MigrationExposureStatus[];
export const EVIDENCE_STATES: readonly EvidenceState[];
export const PREDICATE_OUTCOMES: readonly PredicateOutcome[];
export const INTERNAL_ORDER: Readonly<{ DEFINED: "defined"; UNDEFINED: "undefined" }>;

export const PACKAGE_DEFAULTS: Readonly<{
  partialOraclePolicy: PartialOraclePolicy;
  ontologyAxes: OntologyAxisDefinition;
  profileDefinition: { kind: "explicit-only" };
  identityPolicy: IdentityPolicy;
}>;

export function loadKernelPackage(input: RulePackage, options?: {
  kernelVersion?: string;
}): LoadedRulePackage;

export const KERNEL_CAPABILITIES: Readonly<{
  implemented: readonly string[];
  pending: readonly string[];
}>;

export interface Kernel {
  readonly version: string;
  readonly capabilities: typeof KERNEL_CAPABILITIES;
  loadPackage(input: RulePackage): Promise<LoadedRulePackage>;
  canonicalize(value: JsonValue, options?: CanonicalizationOptions): string;
  canonicalizeCandidate(input: CandidateInput, options?: GraphCanonicalizationOptions): CanonicalCandidateResult;
  canonicalizeSkeleton(input: SkeletonInput, options?: {
    limits?: Partial<GraphCanonicalizationLimits>;
  }): CanonicalSkeletonResult;
  enumerateConnectedSkeletons(nodeCount: number, options?: Partial<SkeletonEnumerationLimits> & {
    canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
  }): SkeletonEnumerationResult;
  createCandidateStore(options: {
    domain: CandidateDomain;
    maxCandidates?: number;
    canonicalization?: GraphCanonicalizationOptions;
  }): CandidateStore;
  hash(domain: string, value: JsonValue): ContentHash;
  closeLevel(input?: unknown): Promise<never>;
  closeLadder(input?: unknown): Promise<never>;
  explain(input?: unknown): Promise<never>;
  explainSource(input?: unknown): Promise<never>;
  testProfileCollapse(input?: unknown): Promise<never>;
  detectLevelBoundaries(input?: unknown): Promise<never>;
}

export function createKernel(options?: { version?: string }): Kernel;
export function requireKernelCapability(capability: string): never;
export function validationIssue(code: string, path: string, message: string, details?: Record<string, unknown>): ValidationIssue;
