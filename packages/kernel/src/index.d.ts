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

export type SourceClassificationVisibleField =
  | "causal-directions"
  | "dependency-type"
  | "interaction-modes"
  | "necessity"
  | "ontological-role"
  | "parent-code"
  | "quantization"
  | "source"
  | "source-text"
  | "statement"
  | "target"
  | "weight";

export type SourceClassificationAuthorship =
  | {
      mode: "human-independent";
      minimumIndependentClassifiers: number;
      adjudicationRule: string;
    }
  | {
      mode: "deterministic-precommitted";
      classifier: { id: string; version: string };
      adjudicationRule: string;
    };

export interface SourceClassificationExposure {
  status: MigrationExposureStatus;
  declaration: string;
  sccAwareMaterialSeenBeforeFreeze: boolean;
}

export interface SourceClassificationRelationRule {
  decisionQuestion: string;
  necessaryObservations: string[];
  sufficientObservations: string[];
  inclusions: string[];
  exclusions: string[];
  counterexamples: string[];
}

export interface SourceMigrationRiskPolicy {
  maximumClassificationDisagreementRatio: number;
  maximumDescriptiveResolutionShare: number;
  maximumPostUnblindingReclassificationShare: number;
  acceptedBlindness: MigrationExposureStatus[];
}

export interface SourceClassificationPolicyInput {
  schemaVersion: "1";
  version: string;
  authorship: SourceClassificationAuthorship;
  exposure: SourceClassificationExposure;
  visibleFields: SourceClassificationVisibleField[];
  forbiddenInputs: string[];
  relationKinds: Record<SourceRelationKind, SourceClassificationRelationRule>;
  conflictRule: string;
  riskPolicy: SourceMigrationRiskPolicy;
}

export interface FrozenSourceClassificationPolicy extends SourceClassificationPolicyInput {
  freezer: "source-classification-policy-v1";
  policyHash: ContentHash;
}

export interface SourceClassifierExposure {
  status: MigrationExposureStatus;
  declaration: string;
  sccAwareMaterialSeenBeforeAnnotation: boolean;
}

export type SourceClassifierDeclaration =
  | {
      id: string;
      type: "human";
      exposure: SourceClassifierExposure;
    }
  | {
      id: string;
      type: "deterministic";
      version: string;
      exposure: SourceClassifierExposure;
    };

export interface SourceClassificationAnnotation {
  relationId: string;
  classifierId: string;
  kind: SourceRelationKind;
  observations: string[];
  rationale: string;
}

export interface SourceClassificationAnnotationsInput {
  schemaVersion: "1";
  policyHash: ContentHash;
  view: {
    hash: ContentHash;
    visibleFields: string[];
    relationIds: string[];
  };
  frozenAt: string;
  classifiers: SourceClassifierDeclaration[];
  annotations: SourceClassificationAnnotation[];
}

export interface FrozenSourceClassificationAnnotations extends SourceClassificationAnnotationsInput {
  freezer: "source-classification-annotations-v1";
  statistics: {
    relationCount: number;
    classifierCount: number;
    annotationCount: number;
  };
  annotationHash: ContentHash;
}

export interface SourceClassificationAdjudicationDecisionInput {
  relationId: string;
  kind: SourceRelationKind;
  rationale: string;
}

export interface SourceClassificationAdjudicationDecision
  extends SourceClassificationAdjudicationDecisionInput {
  status: "agreement" | "adjudicated";
  rawKinds: SourceRelationKind[];
}

export interface SourceClassificationAdjudicationInput {
  schemaVersion: "1";
  policyHash: ContentHash;
  annotationHash: ContentHash;
  frozenAt: string;
  unblindedAt: string;
  adjudicator: SourceClassifierDeclaration;
  decisions: SourceClassificationAdjudicationDecisionInput[];
}

export interface FrozenSourceClassificationAdjudication
  extends Omit<SourceClassificationAdjudicationInput, "decisions"> {
  freezer: "source-classification-adjudication-v1";
  decisions: SourceClassificationAdjudicationDecision[];
  statistics: {
    relationCount: number;
    disagreementCount: number;
    disagreementRatio: number;
    maximumClassificationDisagreementRatio: number;
    thresholdExceeded: boolean;
  };
  fittingRisk: "not-flagged" | "elevated";
  fittingRiskReasons: (
    | "historically-exposed"
    | "classification-disagreement-threshold-exceeded"
  )[];
  adjudicationHash: ContentHash;
}

export interface SourceNodeResolutionDispositionRule {
  decisionQuestion: string;
  criteria: string[];
  positiveExamples: string[];
  negativeExamples: string[];
}

export interface SourceNodeResolutionPolicyInput {
  schemaVersion: "1";
  version: string;
  classificationPolicyHash: ContentHash;
  visibleInputs: string[];
  forbiddenCriteria: string[];
  dispositionRules: Record<ClusterDisposition, SourceNodeResolutionDispositionRule>;
  edgeReconciliation: {
    destinations: ("inter-cluster" | "internal" | "typed-explanation")[];
    requireExactlyOnce: true;
    preserveRawRelationReferences: true;
  };
  clusterSemantics: {
    internalOrder: "undefined";
    memberDepthInheritance: "cluster-depth";
    requireCondensationDag: true;
  };
  reviewRule: string;
}

export interface FrozenSourceNodeResolutionPolicy extends SourceNodeResolutionPolicyInput {
  freezer: "source-node-resolution-policy-v1";
  policyHash: ContentHash;
}

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

export type Tolerance =
  | { absolute: number; relative?: number }
  | { absolute?: number; relative: number };

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

export type SIBaseUnit = "kg" | "m" | "s" | "A" | "K" | "mol" | "cd";

export interface ParsedUnitExpression {
  grammar: "si-multiplicative-v1";
  expression: string;
  canonicalUnit: string;
  dimensionSignature: string;
  dimensions: Partial<Record<SIBaseUnit, number>>;
  scale: number;
}

export type QuantityComparator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte";

export interface QuantityComparison {
  comparator: QuantityComparator;
  pass: boolean;
  equivalent: boolean;
  relation: -1 | 0 | 1;
  unit: string;
  leftValue: number;
  rightValue: number;
  difference: number;
  effectiveTolerance: number;
  semanticPolicy: "require-equal" | "ignore";
}

export interface DecimalValue {
  arithmetic: "decimal-rational-v1";
  coefficient: string;
  scale: number;
  canonical: string;
}

export type DecimalInput = number | bigint | string | DecimalValue;

export interface DecimalLimits {
  maxInputCharacters: number;
  maxInputSignificantDigits: number;
  maxResultSignificantDigits: number;
  maxAbsoluteScale: number;
  maxDecimalPlaces: number;
  maxPowerOfTen: number;
  maxTerms: number;
  maxCanonicalCharacters: number;
}

export type DecimalAccumulation =
  | {
      arithmetic: "decimal-rational-v1";
      policy: Readonly<PrecisionPolicy & { summation: "exact-decimal" }>;
      termCount: number;
      exact: true;
      value: DecimalValue;
    }
  | {
      arithmetic: "decimal-rational-v1";
      policy: Readonly<PrecisionPolicy & { summation: "compensated-binary64" }>;
      termCount: number;
      exact: false;
      value: DecimalValue;
    };

export type DecimalUnroundedAccumulation =
  | {
      arithmetic: "decimal-rational-v1";
      algorithm: "exact-decimal";
      termCount: number;
      exact: true;
      value: DecimalValue;
    }
  | {
      arithmetic: "decimal-rational-v1";
      algorithm: "compensated-binary64";
      termCount: number;
      exact: false;
      value: DecimalValue;
    };

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
  expr: BooleanExpression;
  explain: { pass: string; fail: string; indeterminate: string };
  claimRefs: string[];
}

export type NodeSelector =
  | { kind: "canonical-index"; index: number }
  | { kind: "all" }
  | { kind: "where"; attribute: string; equals: JsonPrimitive };

export type SetSelector =
  | { kind: "nodes"; selector: NodeSelector }
  | { kind: "edges"; roles?: string[] }
  | { kind: "cycle"; roles?: string[] };

export type ValueExpression =
  | { kind: "constant"; value: JsonPrimitive | Quantity }
  | { kind: "invariant"; name: string; node?: NodeSelector }
  | { kind: "count"; set: SetSelector }
  | { kind: "sum"; attribute: string; set: SetSelector }
  | { kind: "add"; terms: ValueExpression[] }
  | { kind: "multiply"; factors: ValueExpression[] }
  | { kind: "coefficient"; name: string };

export type GraphProjection = "directed" | "undirected-simple" | "undirected-multigraph";

export type PredicateRange =
  | { min: number; max?: number }
  | { min?: number; max: number };

export type BooleanExpression =
  | { op: "all"; args: BooleanExpression[] }
  | { op: "any"; args: BooleanExpression[] }
  | { op: "not"; arg: BooleanExpression }
  | ({ op: "degree"; node: NodeSelector; role?: string } & PredicateRange)
  | {
      op: "cycleExists";
      roles?: string[];
      projection: GraphProjection;
      minLength?: number;
      maxLength?: number;
    }
  | { op: "connected" }
  | { op: "componentCount"; count: number }
  | { op: "pathExists"; from: NodeSelector; to: NodeSelector; roles?: string[] }
  | ({ op: "countRole"; role: string } & PredicateRange)
  | { op: "balance"; attribute: string; over: SetSelector; tolerance: Quantity }
  | { op: "compare"; left: ValueExpression; comparator: QuantityComparator; right: ValueExpression }
  | { op: "minimal"; predicate: BooleanExpression; policy?: string }
  | { op: "novel"; predicate: BooleanExpression }
  | { op: "stableUnder"; perturbation: string; predicate: BooleanExpression; threshold: number }
  | { op: "irreducibleRemoval"; predicate: BooleanExpression; removal: "node" | "edge" };

export type ExpressionSymbolDescriptor =
  | { kind: "number" }
  | { kind: "quantity"; unit: string; semantic?: string }
  | { kind: "string" }
  | { kind: "boolean" }
  | { kind: "null" };

export type ExpressionSymbolInput = Quantity | QuantitySpec | ExpressionSymbolDescriptor;

export interface ValueExpressionEnvironment {
  coefficients?: Record<string, ExpressionSymbolInput>;
  invariants?: Record<string, ExpressionSymbolInput>;
  attributes?: Record<string, ExpressionSymbolInput>;
}

export interface ValueExpressionLimits {
  maxDepth: number;
  maxNodes: number;
  maxTerms: number;
  maxRoles: number;
  maxStringLength: number;
  maxAbsoluteDimensionExponent: number;
}

export type ExpressionResultType =
  | {
      kind: "number" | "quantity";
      unit: string;
      dimensionSignature: string;
      dimensions: Partial<Record<SIBaseUnit, number>>;
      semantic?: string;
    }
  | { kind: "string" | "boolean" | "null" };

export interface ValueExpressionRequirements {
  invariants: string[];
  coefficients: string[];
  attributes: string[];
  roles: string[];
}

export interface ValueExpressionAnalysis {
  schemaVersion: "1";
  analyzer: "typed-value-expression-v1";
  expressionHash: ContentHash;
  analysisHash: ContentHash;
  expression: ValueExpression;
  result: ExpressionResultType;
  requirements: ValueExpressionRequirements;
  symbols: {
    invariants: Record<string, ExpressionResultType>;
    coefficients: Record<string, ExpressionResultType>;
    attributes: Record<string, ExpressionResultType>;
  };
  statistics: { nodes: number; maxDepth: number };
}

export interface PredicateExpressionEnvironment {
  invariants?: Record<string, ExpressionSymbolInput>;
  attributes?: Record<string, ExpressionSymbolInput>;
  perturbations?: string[];
  substructurePolicies?: string[];
}

export interface PredicateExpressionLimits {
  maxDepth: number;
  maxNodes: number;
  maxArgs: number;
  maxRoles: number;
  maxStringLength: number;
  maxSubstructureNesting: number;
}

export type TruthPersistence = "proven" | "not-proven";

export type PredicateWitnessKind =
  | "node"
  | "edge"
  | "path"
  | "cycle"
  | "substructure"
  | "perturbation"
  | "quantity"
  | "cohort"
  | "evidence"
  | "source-relation"
  | "cluster";

export interface PredicateExpressionRequirements {
  invariants: string[];
  attributes: string[];
  roles: string[];
  perturbations: string[];
  substructurePolicies: string[];
  graphProjections: GraphProjection[];
  operators: BooleanExpression["op"][];
  valueExpressionHashes: ContentHash[];
  witnessKinds: PredicateWitnessKind[];
  usesDefaultSubstructurePolicy: boolean;
}

export interface PredicateExpressionAnalysis {
  schemaVersion: "1";
  analyzer: "typed-predicate-expression-v1";
  expressionHash: ContentHash;
  analysisHash: ContentHash;
  expression: BooleanExpression;
  result: "predicate-outcome";
  requirements: PredicateExpressionRequirements;
  symbols: {
    invariants: Record<string, ExpressionResultType>;
    attributes: Record<string, ExpressionResultType>;
  };
  truthPersistence: { pass: TruthPersistence; fail: TruthPersistence };
  partialDetectability: { pass: boolean; fail: boolean };
  statistics: {
    nodes: number;
    maxDepth: number;
    valueExpressions: number;
    substructureCombinators: number;
    maxSubstructureNesting: number;
  };
}

export interface PredicatePlan {
  schemaVersion: "1";
  compiler: "predicate-plan-v1";
  planHash: ContentHash;
  predicateId: string;
  phase: Predicate["phase"];
  referencesDepth: Predicate["referencesDepth"];
  monotoneViolation: boolean;
  expressionAnalysisHash: ContentHash;
  pruning: {
    declared: boolean;
    staticFailurePersistence: TruthPersistence;
    partialFailureDetectable: boolean;
    auditRequired: boolean;
    eligibility: "disabled" | "static-proven" | "blocked-unproven" | "blocked-partial-data";
  };
  expressionHash: ContentHash;
  expression: BooleanExpression;
  requirements: PredicateExpressionRequirements;
  symbols: PredicateExpressionAnalysis["symbols"];
  truthPersistence: PredicateExpressionAnalysis["truthPersistence"];
  partialDetectability: PredicateExpressionAnalysis["partialDetectability"];
  statistics: PredicateExpressionAnalysis["statistics"];
}

export type GraphPredicateOperator =
  | "degree"
  | "cycleExists"
  | "connected"
  | "componentCount"
  | "pathExists"
  | "countRole";

export interface GraphPredicateWitness {
  expressionPath: string;
  operator: GraphPredicateOperator;
  outcome: PredicateOutcome;
  nodeIndexes?: number[];
  edgeIndexes?: number[];
  components?: number[][];
  count?: number;
  expectedCount?: number;
  min?: number;
  max?: number;
  role?: string;
  roles?: string[];
  projection?: GraphProjection;
  reason?:
    | "selector-empty"
    | "no-matching-cycle"
    | "no-matching-path"
    | "partial-connectivity-repairable";
}

export interface PredicateGraphEvaluation {
  schemaVersion: "1";
  evaluator: "graph-predicate-evaluator-v1";
  predicatePlanHash: ContentHash;
  candidateId: CandidateId;
  graphPolicy: GraphPolicy;
  outcome: PredicateOutcome;
  witnesses: GraphPredicateWitness[];
  evaluationHash: ContentHash;
}

export type LocalEvaluatedValue =
  | { kind: "number"; unrounded: DecimalValue; rounded: DecimalValue; exact: boolean }
  | {
      kind: "quantity";
      unrounded: DecimalValue;
      rounded: DecimalValue;
      exact: boolean;
      quantity: Quantity;
    }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null"; value: null };

export interface LocalSelectionWitnessBase {
  expressionPath: string;
  setKind: "nodes" | "edges";
  count: number;
  nodeIndexes?: number[];
  edgeIndexes?: number[];
  roles?: string[];
}

export type LocalAttributeSelectionWitness = LocalSelectionWitnessBase &
  {
    attribute: string;
  } & (
    | { summation: "exact-decimal"; accumulationExact: true }
    | { summation: "compensated-binary64"; accumulationExact: false }
  ) & (
    | {
        valueKind: "number";
        quantityUnit?: never;
        quantitySemantic?: never;
        toleranceAggregation?: never;
      }
    | {
        valueKind: "quantity";
        quantityUnit: string;
        quantitySemantic: string;
        toleranceAggregation: "sum-effective-absolute-bounds-v1";
      }
  );

export type LocalValueSelectionWitness =
  | (LocalSelectionWitnessBase & {
      attribute?: never;
      valueKind?: never;
      summation?: never;
      accumulationExact?: never;
      quantityUnit?: never;
      quantitySemantic?: never;
      toleranceAggregation?: never;
    })
  | LocalAttributeSelectionWitness;

export interface LocalInvariantResolutionWitnessBase {
  expressionPath: string;
  name: string;
  canonicalNode: number;
  quantity: Quantity;
}

export type LocalInvariantResolutionWitness = LocalInvariantResolutionWitnessBase & (
  | {
      elementId: ElementId;
      profileHash?: never;
      memberElementIds?: never;
      consensusPolicy?: never;
    }
  | {
      elementId?: never;
      profileHash: ProfileHash;
      memberElementIds: ElementId[];
      consensusPolicy: "identical-normalized-quantity-v1";
    }
);

export interface LocalInvariantElementContext {
  elementId: ElementId;
  invariants: Record<string, Quantity>;
}

export type LocalInvariantContext = {
  sourcePopulationHash: ContentHash;
  elements: LocalInvariantElementContext[];
} & (
  | { profileClasses?: never }
  | {
      profileClasses: {
        profileHash: ProfileHash;
        members: ElementId[];
      }[];
    }
);

export interface LocalPredicateEvaluationOptions extends GraphCanonicalizationOptions {
  invariantContext?: LocalInvariantContext;
}

export interface LocalComparePredicateWitness {
  expressionPath: string;
  operator: "compare";
  outcome: "pass" | "fail";
  comparator: QuantityComparator;
  left: LocalEvaluatedValue;
  right: LocalEvaluatedValue;
  comparison:
    | { kind: "number"; relation: -1 | 0 | 1 }
    | ({ kind: "quantity" } & QuantityComparison)
    | { kind: "scalar"; equal: boolean };
  selections: LocalValueSelectionWitness[];
  invariants: LocalInvariantResolutionWitness[];
}

export interface LocalBalancePredicateWitness {
  expressionPath: string;
  operator: "balance";
  outcome: "pass" | "fail";
  attribute: string;
  aggregate: Extract<LocalEvaluatedValue, { kind: "number" | "quantity" }>;
  tolerance: Quantity;
  comparison: { kind: "quantity"; comparator: "lte" } & QuantityComparison;
  selections: [LocalAttributeSelectionWitness];
}

export interface PredicateLocalEvaluation {
  schemaVersion: "1";
  evaluator: "local-predicate-evaluator-v9";
  predicatePlanHash: ContentHash;
  numericBindingHash: ContentHash;
  candidateId: CandidateId;
  invariantSourcePopulationHash?: ContentHash;
  graphPolicy: GraphPolicy;
  outcome: PredicateOutcome;
  witnesses: (
    | GraphPredicateWitness
    | LocalComparePredicateWitness
    | LocalBalancePredicateWitness
  )[];
  evaluationHash: ContentHash;
}

export interface PartialPredicateGraph {
  domain: CandidateDomain;
  nodes: CandidateNode[];
  edges: CandidateEdge[];
  nodesComplete: boolean;
}

export interface PartialPredicateGraphEvaluation {
  schemaVersion: "1";
  evaluator: "partial-graph-predicate-evaluator-v1";
  predicatePlanHash: ContentHash;
  partialGraphHash: ContentHash;
  outcome: PredicateOutcome;
  detection: "persistent-failure" | "not-detected" | "blocked-plan";
  reason:
    | "persistent-failure-detected"
    | "partial-failure-not-detected"
    | "plan-not-static-proven";
  persistentFailureDetected: boolean;
  pruningEligibility: PredicatePlan["pruning"]["eligibility"];
  auditRequired: boolean;
  pruningAuthorized: false;
  witnesses: GraphPredicateWitness[];
  evaluationHash: ContentHash;
}

export type PredicateNumericOperationKind =
  | "value-add"
  | "value-multiply"
  | "value-sum"
  | "numeric-compare"
  | "quantity-compare"
  | "balance"
  | "stability-threshold";

export type PredicateNumericPolicyRef =
  | "arithmetic"
  | "precision"
  | "quantityComparison"
  | "summation";

export interface PredicateNumericBinding {
  schemaVersion: "1";
  binder: "predicate-numeric-binding-v1";
  bindingHash: ContentHash;
  predicatePlanHash: ContentHash;
  expressionHash: ContentHash;
  numericPolicy: {
    arithmetic: "decimal-rational-v1";
    precision: Readonly<PrecisionPolicy>;
    roundingBoundary: "value-expression-result-v1";
    summation: {
      algorithm: PrecisionPolicy["summation"];
      termOrder: "canonical-selection-order-v1";
    };
    quantityComparison: {
      version: "declared-max-tolerance-v1";
      semanticPolicy: "require-equal" | "ignore";
      toleranceCombination: "maximum-declared-bound-v1";
      boundary: "closed";
    };
  };
  operations: {
    path: string;
    operation: PredicateNumericOperationKind;
    policyRefs: PredicateNumericPolicyRef[];
  }[];
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

export interface OracleRequestBinding {
  schemaVersion: "1";
  protocol: "oracle-protocol-v1";
  requestHash: ContentHash;
  request: OracleRequest;
}

export type OracleValidationReason =
  | "oracle-failed"
  | "partial-policy-indeterminate"
  | "partial-response-incomplete"
  | "partial-residual-exceeds-maximum"
  | "partial-tolerance-target-unmet";

export interface OracleToleranceAdjustment {
  quantityId: string;
  original: Tolerance;
  effective: Tolerance;
}

export interface OracleValidationResult {
  schemaVersion: "1";
  validator: "oracle-response-validator-v1";
  validationHash: ContentHash;
  requestHash: ContentHash;
  responseHash: ContentHash;
  status: "accepted" | "indeterminate";
  convergence: OracleResponse["convergence"];
  returnedValues: Record<string, Quantity>;
  acceptedValues: Record<string, Quantity>;
  residual?: Quantity;
  solver: OracleResponse["solver"];
  partialPolicy: PartialOraclePolicy;
  toleranceAdjustments: OracleToleranceAdjustment[];
  reasons: OracleValidationReason[];
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

export interface AxisProvenance extends PrimitiveAxisProvenance {
  derivationDepth: "computed";
}

export interface ElementRoleAssignment {
  edges: {
    canonicalEdge: number;
    role: string;
    direction: "forward" | "reverse" | "symmetric";
  }[];
}

export interface ElementProvenance {
  constituents: ElementId[];
  constituentProfiles: ProfileHash[];
  skeleton: SkeletonId;
  roleAssignment: ElementRoleAssignment;
  sourceCandidate: CandidateId;
  derivationDepth: number;
  depthBasis: BasisHash;
  evidence: string[];
}

export interface Element {
  id: ElementId;
  kind: "primitive" | "derived" | "condensed-cluster";
  depth: number;
  depthBasis: BasisHash;
  axisProvenance: AxisProvenance;
  canonicalForm: CanonicalForm;
  profile: NormalizedProfile;
  provenance: ElementProvenance | null;
  ontologyCoordinate?: OntologyCoordinate;
  typeTags: string[];
  invariants: Record<string, Quantity>;
  admittedBy: string[];
  selectedBy: string[];
  claimRefs: string[];
  cluster?: ClusterProvenance;
}

export interface PrimitiveDepthElement extends Omit<Element, "kind" | "depth" | "provenance"> {
  kind: "primitive" | "condensed-cluster";
  depth: 0;
  provenance: null;
}

export interface PrimitiveDepthPopulation {
  schemaVersion: "1";
  materializer: "primitive-depth-population-v1";
  packageId: ContentHash;
  depthBasis: BasisHash;
  depth: 0;
  elements: PrimitiveDepthElement[];
  populationHash: ContentHash;
}

export interface NormalizedRulePackage extends Required<Omit<RulePackage, "sourceMigration">> {
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
  predicatePlans: PredicatePlan[];
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

export type RunConfigInput = Omit<RunConfig, "budget"> & {
  budget?: Partial<RunBudget>;
};

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

export type CompleteCandidateStoreSnapshot = Omit<
  CandidateStoreSnapshot,
  "status" | "interpretable" | "budget"
> & {
  status: "complete";
  interpretable: true;
  budget: CandidateStoreSnapshot["budget"] & { exhausted: null };
};

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

export interface CandidateDecorationEdgeVariant {
  role: string;
  attrs?: Record<string, CandidateAttribute>;
}

export interface DecoratedCandidateEnumerationInput {
  domain: CandidateDomain;
  skeletons: (SkeletonInput | EnumeratedSkeleton)[];
  nodeVariants: CandidateNode[];
  edgeVariants: CandidateDecorationEdgeVariant[];
  graphPolicy?: Partial<GraphPolicy>;
}

export interface CandidateEnumerationLimits {
  maxEdges: number | "n+2";
  maxRawCandidates: number;
  maxCandidates: number;
  maxDecorationStates: number;
}

export interface CandidateEnumerationCursor {
  skeletonId: SkeletonId;
  nodeIndex: number;
  edgeGroupIndex: number | null;
}

export type CandidateEnumerationExhaustion =
  | {
      budget: "maxDecorationStates" | "maxRawCandidates";
      used: number;
      maximum: number;
      cursor: CandidateEnumerationCursor;
    }
  | {
      budget: "maxSearchStates";
      used: number;
      maximum: number;
      skeletonId: SkeletonId;
      canonicalizationPhase: "skeleton" | "candidate";
    }
  | CandidateStoreExhaustion;

export interface DecoratedCandidateEnumerationResult {
  schemaVersion: "1";
  enumerator: "decorated-candidate-enumerator-v1";
  status: "complete" | "budget-exhausted";
  interpretable: boolean;
  domain: CandidateDomain;
  graphPolicy: GraphPolicy;
  skeletonIds: SkeletonId[];
  nodeVariants: CandidateNode[];
  edgeVariants: CandidateDecorationEdgeVariant[];
  candidateStore: CandidateStoreSnapshot;
  counts: {
    inputSkeletons: number;
    edgeBoundExcludedSkeletons: number;
    decorationStates: number;
    generatedCandidates: number;
    policyExcludedCandidates: number;
    canonicalizationIndeterminateCandidates: number;
    attemptedCandidates: number;
    canonicalCandidates: number;
    duplicateCandidates: number;
  };
  budget: CandidateEnumerationLimits & {
    canonicalizationLimits: GraphCanonicalizationLimits;
    exhausted: CandidateEnumerationExhaustion | null;
  };
}

export type CompleteDecoratedCandidateEnumerationResult = Omit<
  DecoratedCandidateEnumerationResult,
  "status" | "interpretable" | "candidateStore" | "budget"
> & {
  status: "complete";
  interpretable: true;
  candidateStore: CompleteCandidateStoreSnapshot;
  budget: DecoratedCandidateEnumerationResult["budget"] & { exhausted: null };
};

export interface PackageCandidateExecutionLimits {
  maxRawCandidates: number;
  maxDecorationStates: number;
  maxSearchStates: number;
}

export interface LoadedPackageVerificationOptions {
  kernelVersion?: string;
}

export type PackageCandidateExecutionOptions =
  Partial<PackageCandidateExecutionLimits> & LoadedPackageVerificationOptions;

export interface PackageCandidateProfileClass {
  profileHash: ProfileHash;
  members: ElementId[];
  representativeElementId: ElementId;
}

export interface PackageCandidateBinding {
  schemaVersion: "1";
  binder: "package-candidate-binding-v1";
  packageId: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  runConfig: RunConfig;
  sourcePopulation: {
    kind: "primitive-depth-population-selection-v1";
    population: PrimitiveDepthPopulation;
    selection: {
      sourceDepths: RunConfig["sourceDepths"];
      targetDepth: 1;
      availableDepths: [0];
      selectedDepths: [0];
    };
    elementIds: ElementId[];
    profileRepresentativePolicy: "lexicographically-smallest-element-id-v1";
    profileClasses: PackageCandidateProfileClass[];
  };
  enumerationInput: DecoratedCandidateEnumerationInput & { graphPolicy: GraphPolicy };
  enumerationOptions: CandidateEnumerationLimits & {
    canonicalizationLimits: GraphCanonicalizationLimits;
  };
  bindingHash: ContentHash;
}

export interface PackageCandidateEnumerationResult {
  schemaVersion: "1";
  generator: "package-candidate-generator-v1";
  binding: PackageCandidateBinding;
  enumeration: DecoratedCandidateEnumerationResult;
}

export type CompletePackageCandidateEnumerationResult = Omit<
  PackageCandidateEnumerationResult,
  "enumeration"
> & {
  enumeration: CompleteDecoratedCandidateEnumerationResult;
};

export interface PackageCandidateConstituentResolution {
  canonicalNode: number;
  sourceRef: ElementId | ProfileHash;
  elementId: ElementId;
  profileHash: ProfileHash;
  resolution: "element-exact" | "profile-representative";
  representativePolicy:
    | "direct-element-reference-v1"
    | "lexicographically-smallest-element-id-v1";
  profileClassMembers: ElementId[];
}

export interface PackageCandidatePredicateEvaluation {
  predicateId: string;
  phase: Predicate["phase"];
  claimRefs: string[];
  evaluation: PredicateLocalEvaluation;
}

export interface PackageCandidateFilterEvaluation {
  schemaVersion: "1";
  evaluator: "package-candidate-filter-evaluator-v10";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  formation: {
    targetDepth: 1;
    depthBasis: BasisHash;
    sourcePopulationHash: ContentHash;
    candidate: Candidate;
    constituents: PackageCandidateConstituentResolution[];
  };
  predicateEvaluations: PackageCandidatePredicateEvaluation[];
  verdict: "eligible" | "predicate-rejected" | "filter-indeterminate";
  counts: {
    evaluated: number;
    passed: number;
    failed: number;
    indeterminate: number;
  };
  passedPredicates: string[];
  failedPredicates: string[];
  indeterminatePredicates: string[];
  filterHash: ContentHash;
}

export interface PackagePredicateCensus {
  predicateId: string;
  evaluated: number;
  passed: number;
  failed: number;
  indeterminate: number;
  exclusivelyRejected: number;
  inert: boolean;
  dominating: boolean;
}

export interface PackageCandidateCensusCounts {
  generatedBeforeCanonicalization: number;
  canonicalCandidates: number;
  evaluatedCandidates: number;
  predicateRejected: number;
  filterIndeterminate: number;
  eligibleCandidates: number;
}

export interface PackageCandidateCensusBase {
  schemaVersion: "1";
  evaluator: "package-candidate-census-evaluator-v1";
  scope: "complete-local-filter-census-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  targetDepth: 1;
  sourcePopulationHash: ContentHash;
  dominanceThreshold: 0.9;
  indeterminateThreshold: number;
  generation: CompletePackageCandidateEnumerationResult;
  candidateEvaluations: PackageCandidateFilterEvaluation[];
  counts: PackageCandidateCensusCounts;
  census: PackagePredicateCensus[];
  censusHash: ContentHash;
}

export type PackageCandidateCensus = PackageCandidateCensusBase & (
  | {
      counts: PackageCandidateCensusCounts & {
        canonicalCandidates: 0;
        evaluatedCandidates: 0;
        predicateRejected: 0;
        filterIndeterminate: 0;
        eligibleCandidates: 0;
      };
      candidateEvaluations: [];
      booleanSelectivity: null;
      indeterminateRatio: null;
      interpretation: {
        status: "empty";
        reasons: ["no-evaluated-candidates"];
      };
    }
  | {
      booleanSelectivity: number;
      indeterminateRatio: number;
      interpretation:
        | { status: "valid"; reasons: [] }
        | {
            status: "indeterminate";
            reasons: ["indeterminate-ratio-exceeds-threshold"];
          };
    }
);

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
  "ARTIFACT" | "CANDIDATE" | "CLUSTER" | "DEPTH_BASIS" | "DEPTH_POPULATION" | "ELEMENT" |
  "PREDICATE_EXPRESSION" | "PREDICATE_EXPRESSION_ANALYSIS" | "PREDICATE_GRAPH_EVALUATION" |
  "PREDICATE_LOCAL_EVALUATION" |
  "PREDICATE_NUMERIC_BINDING" | "PREDICATE_PLAN" | "PARTIAL_PREDICATE_EVALUATION" |
  "PARTIAL_PREDICATE_GRAPH" |
  "VALUE_EXPRESSION" | "VALUE_EXPRESSION_ANALYSIS" | "IDENTITY_POLICY" |
  "ORACLE_REQUEST" | "ORACLE_RESPONSE" | "ORACLE_VALIDATION" |
  "PACKAGE" | "PACKAGE_CANDIDATE_BINDING" | "PACKAGE_CANDIDATE_CENSUS" |
  "PACKAGE_CANDIDATE_FILTER" |
  "PROFILE" | "RUN_CONFIG" | "RULES" | "SKELETON" |
  "SOURCE_CLASSIFICATION_ADJUDICATION" | "SOURCE_CLASSIFICATION_ANNOTATIONS" |
  "SOURCE_CLASSIFICATION_POLICY" | "SOURCE_CLASSIFICATION_VIEW" |
  "SOURCE_CLASSIFIED_RELATIONS" | "SOURCE_SCC_COMPONENT" |
  "SOURCE_NODE_RESOLUTION_POLICY",
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
export const DECORATED_CANDIDATE_ENUMERATOR_VERSION: "decorated-candidate-enumerator-v1";
export const DEFAULT_CANDIDATE_ENUMERATION_LIMITS: Readonly<CandidateEnumerationLimits>;
export function enumerateDecoratedCandidates(
  input: DecoratedCandidateEnumerationInput,
  options?: Partial<CandidateEnumerationLimits> & {
    canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
  }
): DecoratedCandidateEnumerationResult;

export const RUN_CONFIG_NORMALIZER_VERSION: "run-config-normalizer-v1";
export const DEFAULT_RUN_BUDGET: Readonly<RunBudget>;
export function normalizeRunConfig(input: RunConfigInput): Readonly<RunConfig>;

export const PRIMITIVE_DEPTH_POPULATION_VERSION: "primitive-depth-population-v1";
export function materializePrimitiveDepthPopulation(
  loadedPackage: LoadedRulePackage,
  options?: LoadedPackageVerificationOptions
): PrimitiveDepthPopulation;

export const PACKAGE_CANDIDATE_BINDER_VERSION: "package-candidate-binding-v1";
export const PACKAGE_CANDIDATE_GENERATOR_VERSION: "package-candidate-generator-v1";
export const DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS: Readonly<PackageCandidateExecutionLimits>;
export function createPackageCandidateBinding(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackageCandidateExecutionOptions
): PackageCandidateBinding;
export function enumeratePackageCandidates(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackageCandidateExecutionOptions
): PackageCandidateEnumerationResult;
export const PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION:
  "package-candidate-filter-evaluator-v10";
export function evaluatePackageCandidateFilter(
  loadedPackage: LoadedRulePackage,
  binding: PackageCandidateBinding,
  candidate: CandidateInput,
  options?: LoadedPackageVerificationOptions
): PackageCandidateFilterEvaluation;
export const PACKAGE_CANDIDATE_CENSUS_EVALUATOR_VERSION:
  "package-candidate-census-evaluator-v1";
export const PACKAGE_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD: 0.9;
export function evaluatePackageCandidateCensus(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackageCandidateExecutionOptions
): PackageCandidateCensus;
export function verifyPackageCandidateCensus(
  census: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackageCandidateExecutionOptions
): PackageCandidateCensus;

export const UNIT_GRAMMAR_VERSION: "si-multiplicative-v1";
export const QUANTITY_COMPARISON_POLICY_VERSION: "declared-max-tolerance-v1";
export function parseUnitExpression(expression: string): ParsedUnitExpression;
export function normalizeUnitExpression(expression: string): string;
export function areUnitsCompatible(left: string, right: string): boolean;
export function convertQuantity(quantity: Quantity, targetUnit: string): Readonly<Quantity>;
export function normalizeQuantity(quantity: Quantity): Readonly<Quantity>;
export function compareQuantities(
  left: Quantity,
  comparator: QuantityComparator,
  right: Quantity,
  options?: { semanticPolicy?: "require-equal" | "ignore" }
): QuantityComparison;

export const DECIMAL_ARITHMETIC_VERSION: "decimal-rational-v1";
export const DECIMAL_LIMITS: Readonly<DecimalLimits>;
export function parseDecimal(input: DecimalInput): DecimalValue;
export function normalizePrecisionPolicy(policy: PrecisionPolicy): Readonly<PrecisionPolicy>;
export function addDecimals(left: DecimalInput, right: DecimalInput): DecimalValue;
export function subtractDecimals(left: DecimalInput, right: DecimalInput): DecimalValue;
export function multiplyDecimals(left: DecimalInput, right: DecimalInput): DecimalValue;
export function divideDecimals(left: DecimalInput, right: DecimalInput, policy: PrecisionPolicy): DecimalValue;
export function roundDecimal(value: DecimalInput, policy: PrecisionPolicy): DecimalValue;
export function accumulateDecimals(
  values: DecimalInput[],
  algorithm: PrecisionPolicy["summation"]
): DecimalUnroundedAccumulation;
export function sumDecimals(values: DecimalInput[], policy: PrecisionPolicy): DecimalAccumulation;
export function decimalToNumber(value: DecimalInput): number;

export const VALUE_EXPRESSION_ANALYZER_VERSION: "typed-value-expression-v1";
export const DEFAULT_VALUE_EXPRESSION_LIMITS: Readonly<ValueExpressionLimits>;
export function analyzeValueExpression(
  expression: ValueExpression,
  options?: {
    environment?: ValueExpressionEnvironment;
    limits?: Partial<ValueExpressionLimits>;
  }
): ValueExpressionAnalysis;

export const PREDICATE_EXPRESSION_ANALYZER_VERSION: "typed-predicate-expression-v1";
export const PREDICATE_PLAN_COMPILER_VERSION: "predicate-plan-v1";
export const DEFAULT_PREDICATE_EXPRESSION_LIMITS: Readonly<PredicateExpressionLimits>;
export function analyzePredicateExpression(
  expression: BooleanExpression,
  options?: {
    environment?: PredicateExpressionEnvironment;
    limits?: Partial<PredicateExpressionLimits>;
  }
): PredicateExpressionAnalysis;
export function compilePredicate(
  predicate: Predicate,
  options?: {
    environment?: PredicateExpressionEnvironment;
    limits?: Partial<PredicateExpressionLimits>;
  }
): PredicatePlan;
export const GRAPH_PREDICATE_EVALUATOR_VERSION: "graph-predicate-evaluator-v1";
export const PARTIAL_GRAPH_PREDICATE_EVALUATOR_VERSION: "partial-graph-predicate-evaluator-v1";
export function evaluateGraphPredicatePlan(
  plan: PredicatePlan,
  candidate: CandidateInput,
  options?: GraphCanonicalizationOptions
): PredicateGraphEvaluation;
export const LOCAL_PREDICATE_EVALUATOR_VERSION: "local-predicate-evaluator-v9";
export const LOCAL_PREDICATE_EVALUATION_LIMITS: Readonly<{
  maxValueNodes: 10000;
  maxSelectionWitnesses: 10000;
  maxSelectedValues: 5000;
}>;
export function evaluateLocalPredicatePlan(
  plan: PredicatePlan,
  numericBinding: PredicateNumericBinding,
  candidate: CandidateInput,
  options?: LocalPredicateEvaluationOptions
): PredicateLocalEvaluation;
export function detectPartialGraphPredicateFailure(
  plan: PredicatePlan,
  partialGraph: PartialPredicateGraph
): PartialPredicateGraphEvaluation;
export const PREDICATE_NUMERIC_BINDER_VERSION: "predicate-numeric-binding-v1";
export const PREDICATE_NUMERIC_BINDING_LIMITS: Readonly<{ maxOperations: 10000 }>;
export function bindPredicateNumericPolicy(
  plan: PredicatePlan,
  precisionPolicy: PrecisionPolicy,
  options?: { semanticPolicy?: "require-equal" | "ignore" }
): PredicateNumericBinding;
export const ORACLE_PROTOCOL_VERSION: "oracle-protocol-v1";
export const ORACLE_RESPONSE_VALIDATOR_VERSION: "oracle-response-validator-v1";
export const ORACLE_VALIDATION_LIMITS: Readonly<{
  maxQuantities: 10000;
  maxParameters: 10000;
  maxEvidenceIds: 10000;
  maxIdentifierLength: 1024;
}>;
export function createOracleRequestBinding(request: OracleRequest): OracleRequestBinding;
export function validateOracleResponse(
  requestBinding: OracleRequestBinding,
  response: OracleResponse,
  options?: {
    partialPolicy?: PartialOraclePolicy;
    evidenceIds?: string[];
  }
): OracleValidationResult;
export const SOURCE_CLASSIFICATION_POLICY_VERSION: "source-classification-policy-v1";
export const SOURCE_NODE_RESOLUTION_POLICY_VERSION: "source-node-resolution-policy-v1";
export const SOURCE_CLASSIFICATION_VISIBLE_FIELDS: readonly SourceClassificationVisibleField[];
export const SOURCE_POLICY_LIMITS: Readonly<{
  maxIdentifierLength: 1024;
  maxTextLength: 16384;
  maxListEntries: 1000;
  maxIndependentClassifiers: 100;
}>;
export function freezeSourceClassificationPolicy(
  policy: SourceClassificationPolicyInput
): FrozenSourceClassificationPolicy;
export const SOURCE_CLASSIFICATION_ANNOTATIONS_VERSION: "source-classification-annotations-v1";
export const SOURCE_CLASSIFICATION_ADJUDICATION_VERSION: "source-classification-adjudication-v1";
export const SOURCE_CLASSIFICATION_LIMITS: Readonly<{
  maxRelations: 10000;
  maxClassifiers: 100;
  maxAnnotations: 1000000;
  maxObservationsPerAnnotation: 100;
  maxIdentifierLength: 1024;
  maxTextLength: 16384;
}>;
export function freezeSourceClassificationAnnotations(
  policy: FrozenSourceClassificationPolicy,
  artifact: SourceClassificationAnnotationsInput
): FrozenSourceClassificationAnnotations;
export function freezeSourceClassificationAdjudication(
  policy: FrozenSourceClassificationPolicy,
  annotations: FrozenSourceClassificationAnnotations,
  artifact: SourceClassificationAdjudicationInput
): FrozenSourceClassificationAdjudication;
export function freezeSourceNodeResolutionPolicy(
  policy: SourceNodeResolutionPolicyInput
): FrozenSourceNodeResolutionPolicy;

export const KERNEL_IMPLEMENTATION_STATUS: "foundation-active/decorated-generation-active/predicate-plans-active/local-census-active/closure-not-implemented";
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
  enumerateDecoratedCandidates(
    input: DecoratedCandidateEnumerationInput,
    options?: Partial<CandidateEnumerationLimits> & {
      canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
    }
  ): DecoratedCandidateEnumerationResult;
  normalizeRunConfig(input: RunConfigInput): Readonly<RunConfig>;
  materializePrimitiveDepthPopulation(
    loadedPackage: LoadedRulePackage
  ): PrimitiveDepthPopulation;
  createPackageCandidateBinding(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Partial<PackageCandidateExecutionLimits>
  ): PackageCandidateBinding;
  enumeratePackageCandidates(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Partial<PackageCandidateExecutionLimits>
  ): PackageCandidateEnumerationResult;
  evaluatePackageCandidateFilter(
    loadedPackage: LoadedRulePackage,
    binding: PackageCandidateBinding,
    candidate: CandidateInput
  ): PackageCandidateFilterEvaluation;
  evaluatePackageCandidateCensus(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Partial<PackageCandidateExecutionLimits>
  ): PackageCandidateCensus;
  verifyPackageCandidateCensus(
    census: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Partial<PackageCandidateExecutionLimits>
  ): PackageCandidateCensus;
  parseUnitExpression(expression: string): ParsedUnitExpression;
  normalizeUnitExpression(expression: string): string;
  normalizeQuantity(quantity: Quantity): Readonly<Quantity>;
  convertQuantity(quantity: Quantity, targetUnit: string): Readonly<Quantity>;
  compareQuantities(
    left: Quantity,
    comparator: QuantityComparator,
    right: Quantity,
    options?: { semanticPolicy?: "require-equal" | "ignore" }
  ): QuantityComparison;
  parseDecimal(input: DecimalInput): DecimalValue;
  normalizePrecisionPolicy(policy: PrecisionPolicy): Readonly<PrecisionPolicy>;
  addDecimals(left: DecimalInput, right: DecimalInput): DecimalValue;
  subtractDecimals(left: DecimalInput, right: DecimalInput): DecimalValue;
  multiplyDecimals(left: DecimalInput, right: DecimalInput): DecimalValue;
  divideDecimals(left: DecimalInput, right: DecimalInput, policy: PrecisionPolicy): DecimalValue;
  roundDecimal(value: DecimalInput, policy: PrecisionPolicy): DecimalValue;
  accumulateDecimals(
    values: DecimalInput[],
    algorithm: PrecisionPolicy["summation"]
  ): DecimalUnroundedAccumulation;
  sumDecimals(values: DecimalInput[], policy: PrecisionPolicy): DecimalAccumulation;
  decimalToNumber(value: DecimalInput): number;
  analyzeValueExpression(
    expression: ValueExpression,
    options?: {
      environment?: ValueExpressionEnvironment;
      limits?: Partial<ValueExpressionLimits>;
    }
  ): ValueExpressionAnalysis;
  analyzePredicateExpression(
    expression: BooleanExpression,
    options?: {
      environment?: PredicateExpressionEnvironment;
      limits?: Partial<PredicateExpressionLimits>;
    }
  ): PredicateExpressionAnalysis;
  compilePredicate(
    predicate: Predicate,
    options?: {
      environment?: PredicateExpressionEnvironment;
      limits?: Partial<PredicateExpressionLimits>;
    }
  ): PredicatePlan;
  evaluateGraphPredicatePlan(
    plan: PredicatePlan,
    candidate: CandidateInput,
    options?: GraphCanonicalizationOptions
  ): PredicateGraphEvaluation;
  evaluateLocalPredicatePlan(
    plan: PredicatePlan,
    numericBinding: PredicateNumericBinding,
    candidate: CandidateInput,
    options?: LocalPredicateEvaluationOptions
  ): PredicateLocalEvaluation;
  detectPartialGraphPredicateFailure(
    plan: PredicatePlan,
    partialGraph: PartialPredicateGraph
  ): PartialPredicateGraphEvaluation;
  bindPredicateNumericPolicy(
    plan: PredicatePlan,
    precisionPolicy: PrecisionPolicy,
    options?: { semanticPolicy?: "require-equal" | "ignore" }
  ): PredicateNumericBinding;
  createOracleRequestBinding(request: OracleRequest): OracleRequestBinding;
  validateOracleResponse(
    requestBinding: OracleRequestBinding,
    response: OracleResponse,
    options?: {
      partialPolicy?: PartialOraclePolicy;
      evidenceIds?: string[];
    }
  ): OracleValidationResult;
  freezeSourceClassificationPolicy(
    policy: SourceClassificationPolicyInput
  ): FrozenSourceClassificationPolicy;
  freezeSourceClassificationAnnotations(
    policy: FrozenSourceClassificationPolicy,
    artifact: SourceClassificationAnnotationsInput
  ): FrozenSourceClassificationAnnotations;
  freezeSourceClassificationAdjudication(
    policy: FrozenSourceClassificationPolicy,
    annotations: FrozenSourceClassificationAnnotations,
    artifact: SourceClassificationAdjudicationInput
  ): FrozenSourceClassificationAdjudication;
  freezeSourceNodeResolutionPolicy(
    policy: SourceNodeResolutionPolicyInput
  ): FrozenSourceNodeResolutionPolicy;
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
