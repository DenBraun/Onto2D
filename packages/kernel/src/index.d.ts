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

export interface SourceClassificationAmendmentApprover {
  id: string;
  role: string;
}

export interface SourceClassificationAmendmentInput {
  relationId: string;
  newKind: SourceRelationKind;
  changedAt: string;
  reason: string;
  approver: SourceClassificationAmendmentApprover;
  approvalArtifact: ArtifactRef;
}

export interface SourceClassificationAmendmentsInput {
  schemaVersion: "1";
  policyHash: ContentHash;
  adjudicationHash: ContentHash;
  frozenAt: string;
  changes: SourceClassificationAmendmentInput[];
}

export interface SourceClassificationAmendment
  extends SourceClassificationAmendmentInput {
  schemaVersion: "1";
  originalKind: SourceRelationKind;
  priorStateHash: ContentHash;
  changeId: ContentHash;
}

export interface FrozenSourceClassificationAmendments {
  schemaVersion: "1";
  freezer: "source-classification-amendments-v1";
  policyHash: ContentHash;
  annotationHash: ContentHash;
  adjudicationHash: ContentHash;
  unblindedAt: string;
  frozenAt: string;
  changes: SourceClassificationAmendment[];
  effectiveDecisions: {
    relationId: string;
    frozenKind: SourceRelationKind;
    effectiveKind: SourceRelationKind;
    finalStateHash: ContentHash;
    changeIds: ContentHash[];
  }[];
  statistics: {
    relationCount: number;
    changeCount: number;
    changedRelationCount: number;
    changedRelationShare: number;
    maximumPostUnblindingReclassificationShare: number;
    thresholdExceeded: boolean;
  };
  fittingRisk: "not-flagged" | "elevated";
  fittingRiskReasons: (
    | "historically-exposed"
    | "classification-disagreement-threshold-exceeded"
    | "post-unblinding-reclassification-threshold-exceeded"
  )[];
  amendmentsHash: ContentHash;
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

export type InvariantValue = Quantity | JsonPrimitive;

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

export interface SourceMigrationBinding {
  policyHash: ContentHash;
  blindnessStatus: MigrationExposureStatus;
  classificationPolicy: ArtifactRef;
  riskPolicy: ArtifactRef;
  classificationView: ArtifactRef;
  classificationAnnotations: ArtifactRef;
  classificationAdjudication: ArtifactRef;
  classificationAmendments: ArtifactRef;
  classifiedRelations: ArtifactRef;
  nodeResolutions: ArtifactRef;
  condensation: ArtifactRef;
  memberProjections: ArtifactRef;
  typedRelationLayers: ArtifactRef[];
  reconciliation: ArtifactRef;
  metrics: ArtifactRef;
  explanationIndex: ArtifactRef;
  concentration?: ArtifactRef;
}

export type ProfileSlotGuardExpression =
  | { op: "all" | "any"; args: ProfileSlotGuardExpression[] }
  | { op: "not"; arg: ProfileSlotGuardExpression }
  | { op: "partnerTypeTag"; typeTag: string }
  | {
      op: "partnerInvariant";
      name: string;
      comparator: QuantityComparator;
      value: InvariantValue;
    };

export type ProfileSlotGuard = ContentHash | ProfileSlotGuardExpression;

export interface ProfileSlot {
  role: string;
  polarity: "in" | "out" | "sym";
  capacity: { min: number; max: number | null };
  guard?: ProfileSlotGuard;
}

export interface ProfileInvariant {
  semantic: string;
  normalized: Quantity;
  quantization: Quantity;
}

export interface FormationDerivedProfileInvariantDefinition {
  semantic: string;
  functional: string;
  quantization: Quantity;
}

export interface FormationDerivedTypeRuleDefinition {
  typeTag: string;
  invariant: string;
  comparator: QuantityComparator;
  threshold: Quantity;
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
  invariants: Record<string, InvariantValue>;
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
  | {
      kind: "invariant";
      name: string;
      node?: NodeSelector;
      profileAggregation?: "arithmetic-mean-conservative-v1";
    }
  | { kind: "count"; set: SetSelector }
  | { kind: "sum"; attribute: string; set: SetSelector }
  | { kind: "add"; terms: ValueExpression[] }
  | { kind: "multiply"; factors: ValueExpression[]; resultSemantic?: string }
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

export type LocalSelectionWitnessBase = {
  expressionPath: string;
  count: number;
} & (
  | {
      setKind: "nodes";
      nodeIndexes: number[];
      edgeIndexes?: never;
      roles?: never;
      cycleSelection?: never;
    }
  | {
      setKind: "edges";
      nodeIndexes?: never;
      edgeIndexes: number[];
      roles?: string[];
      cycleSelection?: never;
    }
  | {
      setKind: "cycle";
      nodeIndexes?: never;
      edgeIndexes: number[];
      roles?: string[];
      cycleSelection: "directed-cycle-edge-union-v1";
    }
);

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
}

export type LocalScalarInvariantResolutionValueWitness =
  | {
      quantity?: never;
      valueKind: "number";
      value: number;
    }
  | {
      quantity?: never;
      valueKind: "string";
      value: string;
    }
  | {
      quantity?: never;
      valueKind: "boolean";
      value: boolean;
    }
  | {
      quantity?: never;
      valueKind: "null";
      value: null;
    };

export type LocalNumericInvariantResolutionValueWitness = {
  quantity?: never;
  valueKind: "number";
  value: number;
};

export type LocalNonNumericInvariantResolutionValueWitness =
  | {
      quantity?: never;
      valueKind: "string";
      value: string;
    }
  | {
      quantity?: never;
      valueKind: "boolean";
      value: boolean;
    }
  | {
      quantity?: never;
      valueKind: "null";
      value: null;
    };

export type LocalInvariantExactResolutionBasis = {
  elementId: ElementId;
  profileHash?: never;
  memberElementIds?: never;
  consensusPolicy?: never;
  aggregation?: never;
};

export type LocalInvariantProfileResolutionBasis<Policy extends string> = {
  elementId?: never;
  profileHash: ProfileHash;
  memberElementIds: ElementId[];
  consensusPolicy: Policy;
  aggregation?: never;
};

export interface ProfileInvariantNumberAggregationWitness {
  policy: "arithmetic-mean-conservative-v1";
  memberCount: number;
  precisionPolicy: Readonly<PrecisionPolicy>;
  summation: "exact-decimal";
  divisionExact: boolean;
  unrounded: DecimalValue;
}

export interface ProfileInvariantQuantityAggregationWitness
  extends ProfileInvariantNumberAggregationWitness {
  uncertaintyPolicy: "mean-effective-bounds-plus-rounding-v1";
  effectiveAbsoluteTolerance: DecimalValue;
  evidence: string[];
}

export type LocalInvariantProfileAggregationBasis<Aggregation> = {
  elementId?: never;
  profileHash: ProfileHash;
  memberElementIds: ElementId[];
  consensusPolicy?: never;
  aggregation: Aggregation;
};

export type LocalInvariantResolutionWitness = LocalInvariantResolutionWitnessBase & (
  | {
      quantity: Quantity;
      valueKind?: never;
      value?: never;
    } & (
      | LocalInvariantExactResolutionBasis
      | LocalInvariantProfileResolutionBasis<"identical-normalized-quantity-v1">
      | LocalInvariantProfileAggregationBasis<ProfileInvariantQuantityAggregationWitness>
    )
  | LocalNumericInvariantResolutionValueWitness & (
      | LocalInvariantExactResolutionBasis
      | LocalInvariantProfileResolutionBasis<"identical-normalized-scalar-v1">
      | LocalInvariantProfileAggregationBasis<ProfileInvariantNumberAggregationWitness>
    )
  | LocalNonNumericInvariantResolutionValueWitness & (
      | LocalInvariantExactResolutionBasis
      | LocalInvariantProfileResolutionBasis<"identical-normalized-scalar-v1">
    )
);

export interface LocalInvariantElementContext {
  elementId: ElementId;
  invariants: Record<string, InvariantValue>;
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

export interface LocalPerturbationContext {
  definitions: NormalizedPerturbationDefinition[];
  sampling?: {
    algorithm: "sha256-rejection-counter-v1";
    frame: "applicable-single-edit-attempts-v1";
    replacement: "with-replacement";
    uncertainty: "chebyshev-union-95-v1";
    sampleSize: number;
    streamKey: ContentHash;
  };
}

export interface LocalPredicateEvaluationOptions extends GraphCanonicalizationOptions {
  invariantContext?: LocalInvariantContext;
  substructurePolicy?: SubstructurePolicy;
  perturbationContext?: LocalPerturbationContext;
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

export interface LocalInvariantResolutionFailure {
  operand: "left" | "right";
  reason:
    | "invariant-node-ambiguous"
    | "invariant-value-unavailable"
    | "profile-invariant-member-values-missing"
    | "profile-invariant-member-values-disagree";
  details: Record<string, JsonValue>;
}

export interface LocalIndeterminateComparePredicateWitness {
  expressionPath: string;
  operator: "compare";
  outcome: "indeterminate";
  comparator: QuantityComparator;
  invariantFailures: LocalInvariantResolutionFailure[];
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

export type LocalSubstructureRemovalWitness = {
  parentNodeIndexes: number[];
  parentEdgeIndexes: number[];
} & (
  | { removedNodeIndex: number; removedEdgeIndex?: never }
  | { removedNodeIndex?: never; removedEdgeIndex: number }
) & (
  | {
      status: "skipped";
      reason: "empty-excluded" | "disconnected-excluded";
      substructureId?: never;
      canonicalNodeToParent?: never;
      canonicalEdgeToParent?: never;
      outcome?: never;
      witnesses?: never;
    }
  | {
      status: "evaluated";
      reason?: never;
      substructureId: ContentHash;
      canonicalNodeToParent: number[];
      canonicalEdgeToParent: number[];
      outcome: PredicateOutcome;
      witnesses: LocalPredicateWitness[];
    }
);

export interface LocalIrreducibleRemovalWitness {
  expressionPath: string;
  operator: "irreducibleRemoval";
  outcome: PredicateOutcome;
  removal: "node" | "edge";
  policyId: string;
  whole: {
    outcome: PredicateOutcome;
    witnesses: LocalPredicateWitness[];
  };
  attemptedRemovals: number;
  evaluatedSubstructures: number;
  skippedSubstructures: number;
  removals: LocalSubstructureRemovalWitness[];
}

export type LocalMinimalSubstructureWitness = {
  selectedNodeIndexes: number[];
  selectedEdgeIndexes: number[];
  parentNodeIndexes: number[];
  parentEdgeIndexes: number[];
} & (
  | {
      status: "skipped";
      reason: "empty-excluded" | "disconnected-excluded";
      substructureId?: never;
      canonicalNodeToParent?: never;
      canonicalEdgeToParent?: never;
      outcome?: never;
      witnesses?: never;
    }
  | {
      status: "evaluated";
      reason?: never;
      substructureId: ContentHash;
      canonicalNodeToParent: number[];
      canonicalEdgeToParent: number[];
      outcome: PredicateOutcome;
      witnesses: LocalPredicateWitness[];
    }
);

export interface LocalMinimalPredicateWitness {
  expressionPath: string;
  operator: "minimal";
  outcome: PredicateOutcome;
  policyId: string;
  enumeration: "exhaustive-proper-subgraphs-v1";
  whole: {
    outcome: PredicateOutcome;
    witnesses: LocalPredicateWitness[];
  };
  attemptedSubstructures: number;
  evaluatedSubstructures: number;
  skippedSubstructures: number;
  substructures: LocalMinimalSubstructureWitness[];
}

export interface LocalNovelConstituentWitness {
  parentNodeIndex: number;
  sourceElementId: ElementId;
  projectionId: CandidateId;
  canonicalNodeToParent: [number];
  outcome: PredicateOutcome;
  witnesses: LocalPredicateWitness[];
}

export interface LocalNovelPredicateWitness {
  expressionPath: string;
  operator: "novel";
  outcome: PredicateOutcome;
  domain: "element-exact";
  projection: "canonical-single-node-no-edge-v1";
  boundSubstructurePolicyId?: string;
  whole: {
    outcome: PredicateOutcome;
    witnesses: LocalPredicateWitness[];
  };
  attemptedConstituents: number;
  evaluatedConstituents: number;
  constituents: LocalNovelConstituentWitness[];
}

export type LocalPerturbationAttemptWitness = {
  attemptIndex: number;
  frameIndex?: number;
  streamDraws?: number;
  parentNodeIndexes: number[];
  parentEdgeIndexes: number[];
  parentNodeIndex?: number;
  parentEdgeIndex?: number;
  deletedRef?: ElementId | ProfileHash;
  deletedRole?: string;
  replacementIndex?: number;
  fromRole?: string;
  toRole?: string;
  target?: "nodes" | "edges";
  attribute?: string;
  direction?: PerturbationDirection;
  epsilon?: number;
  originalValue?: number;
  displacedValue?: number;
} & (
  | {
      status: "skipped";
      reason:
        | "graph-policy-invalid"
        | "numeric-attribute-unavailable"
        | "numeric-result-non-finite"
        | "numeric-displacement-noop";
      validationIssueCodes?: string[];
      perturbedCandidateId?: never;
      canonicalNodeToParent?: never;
      canonicalEdgeToParent?: never;
      outcome?: never;
      witnesses?: never;
    }
  | {
      status: "evaluated";
      reason?: never;
      validationIssueCodes?: never;
      perturbedCandidateId: CandidateId;
      canonicalNodeToParent: number[];
      canonicalEdgeToParent: number[];
      outcome: PredicateOutcome;
      witnesses: LocalPredicateWitness[];
    }
);

export interface LocalStabilityBound {
  numerator: number;
  denominator: number;
  rounded: DecimalValue;
}

export interface LocalSampledStabilityConfidenceBounds {
  confidenceNumerator: 95;
  confidenceDenominator: 100;
  boundDecimalPlaces: 6;
  radius: DecimalValue;
  passing: { lower: DecimalValue; upper: DecimalValue };
  nonFailure: { lower: DecimalValue; upper: DecimalValue };
}

export interface LocalStableUnderPredicateWitnessBase {
  expressionPath: string;
  operator: "stableUnder";
  outcome: PredicateOutcome;
  perturbationId: string;
  perturbationKind: NormalizedPerturbationDefinition["kind"];
  emptyPolicy: PerturbationEmptyPolicy;
  boundPerturbationContextHash: ContentHash;
  boundSubstructurePolicyId?: string;
  threshold: DecimalValue;
  attemptedPerturbations: number;
  validPerturbations: number;
  skippedPerturbations: number;
  passedPerturbations: number;
  failedPerturbations: number;
  indeterminatePerturbations: number;
  stability: {
    lower: LocalStabilityBound;
    upper: LocalStabilityBound;
  } | null;
  perturbations: LocalPerturbationAttemptWitness[];
}

export type LocalStableUnderPredicateWitness =
  LocalStableUnderPredicateWitnessBase & (
    | {
        enumeration: "exhaustive-valid-single-edits-v1";
        decisionRule: "exact-three-valued-bounds-v1";
        sampling?: never;
        confidenceBounds?: never;
      }
    | {
        enumeration: "sampled-valid-single-edits-v1";
        decisionRule: "chebyshev-union-95-three-valued-bounds-v1";
        sampling: {
          algorithm: "sha256-rejection-counter-v1";
          frame: "applicable-single-edit-attempts-v1";
          replacement: "with-replacement";
          uncertainty: "chebyshev-union-95-v1";
          sampleSize: number;
          streamKey: ContentHash;
          frameSize: number;
          status:
            | "frame-empty"
            | "budget-empty"
            | "no-valid-samples"
            | "evaluated";
        };
        confidenceBounds: LocalSampledStabilityConfidenceBounds | null;
      }
  );

export type LocalPredicateWitness =
  | GraphPredicateWitness
  | LocalComparePredicateWitness
  | LocalIndeterminateComparePredicateWitness
  | LocalBalancePredicateWitness
  | LocalMinimalPredicateWitness
  | LocalIrreducibleRemovalWitness
  | LocalNovelPredicateWitness
  | LocalStableUnderPredicateWitness;

export interface PredicateLocalEvaluation {
  schemaVersion: "1";
  evaluator: "local-predicate-evaluator-v19";
  predicatePlanHash: ContentHash;
  numericBindingHash: ContentHash;
  candidateId: CandidateId;
  invariantSourcePopulationHash?: ContentHash;
  invariantNames?: string[];
  substructurePolicy?: SubstructurePolicy;
  perturbationContextHash?: ContentHash;
  graphPolicy: GraphPolicy;
  outcome: PredicateOutcome;
  witnesses: LocalPredicateWitness[];
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

export type PackagePredicateMonotonicityAuditOptions =
  PackageCandidateExecutionOptions & {
  samplesPerPredicate?: number;
};

export interface PackagePredicateMonotonicityAuditSample {
  sampleOrdinal: number;
  frameIndex: number;
  streamDraws: number;
  extensionCandidateId: CandidateId;
  partialGraphHash: ContentHash;
  partialEvaluationHash: ContentHash;
  extensionEvaluationHash: ContentHash;
  diagnosticEvaluationHash: ContentHash;
  partialEdgeCount: number;
  extensionEdgeCount: number;
  partialOutcome: PredicateOutcome;
  extensionOutcome: PredicateOutcome;
  persistentFailureDetected: boolean;
  counterexample: boolean;
}

export interface PackagePredicateMonotonicityAuditResult {
  predicateId: string;
  predicatePlanHash: ContentHash;
  pruningEligibility: PredicatePlan["pruning"]["eligibility"];
  runtimeSupport: "graph-complete-and-partial-v1" | "unsupported";
  frameSize: number;
  requestedSamples: number;
  samples: PackagePredicateMonotonicityAuditSample[];
  counts: {
    attempted: number;
    partialFailures: number;
    extensionPasses: number;
    persistentFailuresDetected: number;
    counterexamples: number;
  };
  status: "passed" | "failed" | "unsupported" | "no-extensions" | "no-samples";
  pruningEligible: boolean;
}

export interface PackagePredicateMonotonicityAudit {
  schemaVersion: "1";
  auditor: "package-predicate-monotonicity-auditor-v1";
  scope: "complete-depth-one-canonical-universe-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  binding: PackageCandidateBinding;
  runConfigHash: ContentHash;
  seed: string;
  policy: {
    extensionModel: "complete-node-canonical-edge-prefix-v1";
    samplingAlgorithm: "sha256-rejection-counter-v1";
    replacement: "with-replacement";
    counterexampleRule: "partial-fail-extension-pass-v1";
    proofInterpretation: "falsification-only-static-proof-required-v1";
  };
  samplesPerPredicate: number;
  universe: {
    generator: "package-candidate-generator-v5";
    candidateCount: number;
    extensionFrameSize: number;
    universeHash: ContentHash;
  };
  results: PackagePredicateMonotonicityAuditResult[];
  counts: {
    declaredPredicates: number;
    runtimeSupportedPredicates: number;
    passedPredicates: number;
    failedPredicates: number;
    indeterminatePredicates: number;
    authorizedPlans: number;
    attemptedSamples: number;
    counterexamples: number;
  };
  status: "not-applicable" | "passed" | "failed" | "indeterminate";
  auditHash: ContentHash;
}

export interface PackagePartialPruningDecision {
  schemaVersion: "1";
  controller: "package-partial-pruning-controller-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  auditHash: ContentHash;
  predicateId: string;
  predicatePlanHash: ContentHash;
  extensionModel: "complete-node-canonical-edge-prefix-v1";
  auditStatus: PackagePredicateMonotonicityAudit["status"];
  planAuditStatus: PackagePredicateMonotonicityAuditResult["status"] | "not-declared";
  diagnostic: PartialPredicateGraphEvaluation;
  pruningAuthorized: boolean;
  reason:
    | "authorized-persistent-failure"
    | "audit-not-passed"
    | "plan-not-authorized"
    | "persistent-failure-not-detected";
  decisionHash: ContentHash;
}

export interface PackagePartialPruningControllerSession {
  readonly audit: PackagePredicateMonotonicityAudit;
  readonly binding: PackageCandidateBinding;
  readonly kernelVersion: string;
  readonly authorizedPredicateIds: readonly string[];
  evaluate(
    predicateId: string,
    partialGraph: PartialPredicateGraph
  ): PackagePartialPruningDecision;
}

export interface PackagePrunedCandidateRecord {
  candidateId: CandidateId;
  skeletonId: SkeletonId;
  predicateId: string;
  partialEdgeCount: number;
  completeEdgeCount: number;
  decision: PackagePartialPruningDecision;
  rawOccurrences: number;
}

export interface PackagePruningResultSetConformance {
  candidateCount: number;
  pruningDisabledHash: ContentHash;
  pruningEnabledHash: ContentHash;
}

export interface PackagePrunedCandidateGeneration {
  schemaVersion: "1";
  generator: "package-pruned-candidate-generator-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  auditHash: ContentHash;
  binding: PackageCandidateBinding;
  enumeration: CompleteDecoratedCandidateEnumerationResult;
  profileComposition: PackageProfileComposition;
  pruning: {
    strategy: "canonical-candidate-prefix-pre-admission-v1";
    transcriptHash: ContentHash;
    authorizedPredicateIds: string[];
    prunedCandidates: PackagePrunedCandidateRecord[];
    counts: {
      evaluatedRawCandidates: number;
      evaluatedPrefixStates: number;
      controllerDecisions: number;
      authorizedDecisions: number;
      uniquePrunedCandidates: number;
      duplicatePrunedCandidates: number;
      retainedCanonicalCandidates: number;
    };
  };
  conformance: {
    status: "passed";
    pruningDisabledCanonicalCandidates: number;
    pruningEnabledCanonicalCandidates: number;
    pruningDisabledRejectedCandidates: number;
    pruningEnabledRejectedCandidates: number;
    eligible: PackagePruningResultSetConformance;
    indeterminate: PackagePruningResultSetConformance;
  };
  generationHash: ContentHash;
}

export interface PackageGeneratorFrontierAuditSample {
  sampleOrdinal: number;
  frameIndex: number;
  streamDraws: number;
  observedExtensionOrdinal: number;
  rawCandidateOrdinal: number;
  extensionCandidateId: CandidateId;
  skeletonId: SkeletonId;
  completedEdgeGroups: number;
  totalEdgeGroups: number;
  edgeGroupCounts: number[];
  partialEdgeCount: number;
  extensionEdgeCount: number;
  partialGraphHash: ContentHash;
  partialEvaluationHash: ContentHash;
  extensionEvaluationHash: ContentHash;
  diagnosticEvaluationHash: ContentHash;
  partialOutcome: PredicateOutcome;
  extensionOutcome: PredicateOutcome;
  persistentFailureDetected: boolean;
  counterexample: boolean;
}

export interface PackageGeneratorFrontierAuditResult {
  predicateId: string;
  predicatePlanHash: ContentHash;
  pruningEligibility: PredicatePlan["pruning"]["eligibility"];
  canonicalAuditStatus: PackagePredicateMonotonicityAuditResult["status"] |
    "not-declared";
  runtimeSupport: "graph-complete-and-partial-v1" | "unsupported";
  requestedSamples: number;
  frameSize: number;
  samples: PackageGeneratorFrontierAuditSample[];
  counts: {
    attempted: number;
    partialFailures: number;
    extensionPasses: number;
    persistentFailuresDetected: number;
    counterexamples: number;
  };
  status:
    | "passed"
    | "failed"
    | "unsupported-runtime"
    | "no-frontiers"
    | "no-samples";
  pruningEligible: boolean;
}

export interface PackageProfilePruningExtensionFrontier {
  frontierKey: ContentHash;
  compatibleRawCandidates: number;
  excludedRawCandidates: number;
}

export interface PackageProfilePruningExtensionUniverse {
  schemaVersion: "1";
  evaluator: "package-profile-pruning-extension-census-v1";
  bindingHash: ContentHash;
  policy: RunConfig["profileCompositionPolicy"];
  status: "not-run" | "complete";
  kind: "edge-group" | "node-assignment";
  rawExtensionCandidates: number;
  compatibleRawExtensionCandidates: number;
  excludedRawExtensionCandidates: number;
  compatibleCanonicalCandidateCount: number;
  compatibleCanonicalCandidateHash: ContentHash;
  frontiers: PackageProfilePruningExtensionFrontier[];
  censusHash: ContentHash;
  extensionUniverseHash: ContentHash;
}

export interface PackageGeneratorFrontierAudit {
  schemaVersion: "1";
  auditor: "package-generator-frontier-auditor-v1";
  scope: "complete-depth-one-raw-edge-group-frontiers-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  binding: PackageCandidateBinding;
  runConfigHash: ContentHash;
  canonicalAuditHash: ContentHash;
  seed: string;
  policy: {
    extensionModel: "complete-node-edge-group-frontier-v1";
    samplingAlgorithm: "sha256-rejection-counter-v1";
    replacement: "with-replacement";
    counterexampleRule: "frontier-fail-extension-pass-v1";
    proofInterpretation: "falsification-only-static-proof-required-v1";
    connectivityPolicy: "directed-strong-frontier-satisfaction-required-v1";
  };
  policySupport: "supported";
  samplesPerPredicate: number;
  universe: {
    enumerator: "decorated-candidate-enumerator-v5";
    canonicalCandidateCount: number;
    rawExtensionCandidates: number;
    extensionFrameSize: number;
    canonicalUniverseHash: ContentHash;
    frontierFrameHash: ContentHash;
  };
  profileExtensionUniverse: PackageProfilePruningExtensionUniverse;
  results: PackageGeneratorFrontierAuditResult[];
  counts: PackagePredicateMonotonicityAudit["counts"];
  status: "not-applicable" | "passed" | "failed" | "indeterminate";
  frontierAuditHash: ContentHash;
}

export interface PackageGeneratorFrontier {
  skeletonId: SkeletonId;
  completedEdgeGroups: number;
  totalEdgeGroups: number;
  edgeGroupCounts: number[];
  remainingRawCandidates: number;
}

export interface PackageGeneratorFrontierInput {
  candidateInput: CandidateInput & { skeleton: SkeletonId };
  frontier: PackageGeneratorFrontier;
}

export interface PackageGeneratorFrontierDecision {
  schemaVersion: "1";
  controller: "package-generator-frontier-controller-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  canonicalAuditHash: ContentHash;
  frontierAuditHash: ContentHash;
  predicateId: string;
  predicatePlanHash: ContentHash;
  extensionModel: "complete-node-edge-group-frontier-v1";
  frontier: PackageGeneratorFrontier;
  frontierConnectivitySatisfied: boolean;
  diagnostic: PartialPredicateGraphEvaluation;
  pruningAuthorized: boolean;
  reason:
    | "authorized-persistent-frontier-failure"
    | "frontier-audit-not-passed"
    | "plan-not-authorized"
    | "connectivity-frontier-not-satisfied"
    | "persistent-failure-not-detected";
  decisionHash: ContentHash;
}

export interface PackageGeneratorFrontierControllerSession {
  readonly canonicalAudit: PackagePredicateMonotonicityAudit;
  readonly frontierAudit: PackageGeneratorFrontierAudit;
  readonly binding: PackageCandidateBinding;
  readonly kernelVersion: string;
  readonly preAdmissionAuthorizedPredicateIds: readonly string[];
  readonly authorizedPredicateIds: readonly string[];
  evaluatePreAdmission(
    predicateId: string,
    partialGraph: PartialPredicateGraph
  ): PackagePartialPruningDecision;
  evaluate(
    predicateId: string,
    frontier: PackageGeneratorFrontierInput
  ): PackageGeneratorFrontierDecision;
}

export interface PackageRecursivePrunedCandidateGeneration {
  schemaVersion: "1";
  generator: "package-recursive-pruned-candidate-generator-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  canonicalAuditHash: ContentHash;
  frontierAuditHash: ContentHash;
  binding: PackageCandidateBinding;
  enumeration: CompleteDecoratedCandidateEnumerationResult;
  profileComposition: PackageProfileComposition;
  pruning: {
    strategy: "audited-edge-group-subtree-pruning-v1";
    transcriptHash: ContentHash;
    frontierAuthorizedPredicateIds: string[];
    preAdmissionAuthorizedPredicateIds: string[];
    prunedFrontiers: Array<{
      frontierOrdinal: number;
      partialGraph: PartialPredicateGraph;
      decision: PackageGeneratorFrontierDecision;
      profileExtension: PackageProfilePruningExtensionFrontier;
    }>;
    counts: {
      evaluatedFrontiers: number;
      frontierControllerDecisions: number;
      authorizedFrontiers: number;
      skippedRawCandidates: number;
      skippedProfileCompatibleRawCandidates: number;
      skippedProfileExcludedRawCandidates: number;
      evaluatedCompleteRawCandidates: number;
      evaluatedCompletePrefixes: number;
      preAdmissionControllerDecisions: number;
      preAdmissionAuthorizedDecisions: number;
      visitedDecorationStates: number;
      referenceDecorationStates: number;
      skippedDecorationStates: number;
    };
  };
  conformance: {
    status: "passed";
    preAdmissionGenerationHash: ContentHash;
    recursiveRetainedStoreHash: ContentHash;
    preAdmissionRetainedStoreHash: ContentHash;
    pruningDisabledCanonicalCandidates: number;
    preAdmissionCanonicalCandidates: number;
    recursiveCanonicalCandidates: number;
    eligible: PackagePruningResultSetConformance;
    indeterminate: PackagePruningResultSetConformance;
  };
  generationHash: ContentHash;
}

export interface PackageNodeFrontierAuditSample {
  sampleOrdinal: number;
  frameIndex: number;
  streamDraws: number;
  observedExtensionOrdinal: number;
  rawCandidateOrdinal: number;
  extensionHash: ContentHash;
  skeletonId: SkeletonId;
  assignedNodes: number;
  totalNodes: number;
  remainingNodeAssignments: number;
  partialGraphHash: ContentHash;
  extensionEvaluationHash: ContentHash;
  diagnosticEvaluationHash: ContentHash;
  partialOutcome: PredicateOutcome;
  extensionOutcome: PredicateOutcome;
  persistentFailureDetected: boolean;
  counterexample: boolean;
}

export interface PackageNodeFrontierAuditResult {
  predicateId: string;
  predicatePlanHash: ContentHash;
  pruningEligibility: PredicatePlan["pruning"]["eligibility"];
  canonicalAuditStatus: PackagePredicateMonotonicityAuditResult["status"] |
    "not-declared";
  runtimeSupport: "graph-complete-and-partial-v1" | "unsupported";
  connectivitySupport: "supported" | "blocked-directed-strong";
  requestedSamples: number;
  frameSize: number;
  samples: PackageNodeFrontierAuditSample[];
  counts: {
    attempted: number;
    persistentFailuresDetected: number;
    extensionPasses: number;
    counterexamples: number;
  };
  status:
    | "passed"
    | "failed"
    | "unsupported-runtime"
    | "blocked-connectivity"
    | "no-frontiers"
    | "no-samples";
  pruningEligible: boolean;
}

export interface PackageNodeFrontierAudit {
  schemaVersion: "1";
  auditor: "package-node-frontier-auditor-v1";
  scope: "complete-depth-one-raw-node-prefix-extension-pairs-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  binding: PackageCandidateBinding;
  runConfigHash: ContentHash;
  canonicalAuditHash: ContentHash;
  seed: string;
  policy: {
    extensionModel: "incomplete-node-prefix-complete-raw-extension-v1";
    samplingAlgorithm: "sha256-rejection-counter-v1";
    replacement: "with-replacement";
    counterexampleRule: "persistent-node-failure-extension-pass-v1";
    proofInterpretation: "falsification-only-static-proof-required-v1";
    connectivityPolicy: "directed-strong-node-pruning-disabled-v1";
  };
  samplesPerPredicate: number;
  universe: {
    enumerator: "decorated-candidate-enumerator-v5";
    canonicalCandidateCount: number;
    rawExtensionCandidates: number;
    extensionFrameSize: number;
    canonicalUniverseHash: ContentHash;
    nodeFrontierFrameHash: ContentHash;
  };
  profileExtensionUniverse: PackageProfilePruningExtensionUniverse;
  results: PackageNodeFrontierAuditResult[];
  counts: {
    declaredPredicates: number;
    runtimeSupportedPredicates: number;
    connectivitySupportedPredicates: number;
    passedPredicates: number;
    failedPredicates: number;
    indeterminatePredicates: number;
    authorizedPlans: number;
    attemptedSamples: number;
    counterexamples: number;
  };
  status: "not-applicable" | "passed" | "failed" | "indeterminate";
  nodeFrontierAuditHash: ContentHash;
}

export interface PackageNodeFrontier {
  skeletonId: SkeletonId;
  assignedNodes: number;
  totalNodes: number;
  remainingNodeAssignments: number;
  edgeRawCandidatesPerAssignment: number;
  remainingRawCandidates: number;
}

export interface PackageNodeFrontierInput {
  candidateInput: CandidateInput & { skeleton: SkeletonId };
  frontier: PackageNodeFrontier;
}

export interface PackageNodeFrontierDecision {
  schemaVersion: "1";
  controller: "package-node-frontier-controller-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  canonicalAuditHash: ContentHash;
  nodeFrontierAuditHash: ContentHash;
  predicateId: string;
  predicatePlanHash: ContentHash;
  extensionModel: "incomplete-node-prefix-complete-raw-extension-v1";
  frontier: PackageNodeFrontier;
  connectivityUniverseFixed: boolean;
  diagnostic: PartialPredicateGraphEvaluation;
  pruningAuthorized: boolean;
  reason:
    | "authorized-persistent-node-frontier-failure"
    | "connectivity-universe-not-fixed"
    | "node-frontier-audit-not-passed"
    | "plan-not-authorized"
    | "persistent-failure-not-detected";
  decisionHash: ContentHash;
}

export interface PackageNodeFrontierControllerSession {
  readonly canonicalAudit: PackagePredicateMonotonicityAudit;
  readonly nodeFrontierAudit: PackageNodeFrontierAudit;
  readonly binding: PackageCandidateBinding;
  readonly kernelVersion: string;
  readonly preAdmissionAuthorizedPredicateIds: readonly string[];
  readonly authorizedPredicateIds: readonly string[];
  evaluatePreAdmission(
    predicateId: string,
    partialGraph: PartialPredicateGraph
  ): PackagePartialPruningDecision;
  evaluate(
    predicateId: string,
    frontier: PackageNodeFrontierInput
  ): PackageNodeFrontierDecision;
}

export interface PackageNodeGrowthPrunedCandidateGeneration {
  schemaVersion: "1";
  generator: "package-node-growth-pruned-candidate-generator-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  canonicalAuditHash: ContentHash;
  nodeFrontierAuditHash: ContentHash;
  binding: PackageCandidateBinding;
  enumeration: CompleteDecoratedCandidateEnumerationResult;
  profileComposition: PackageProfileComposition;
  pruning: {
    strategy: "audited-node-assignment-subtree-pruning-v1";
    transcriptHash: ContentHash;
    nodeFrontierAuthorizedPredicateIds: string[];
    preAdmissionAuthorizedPredicateIds: string[];
    prunedNodeFrontiers: Array<{
      frontierOrdinal: number;
      partialGraph: PartialPredicateGraph;
      decision: PackageNodeFrontierDecision;
      profileExtension: PackageProfilePruningExtensionFrontier;
    }>;
    counts: {
      evaluatedNodeFrontiers: number;
      nodeFrontierControllerDecisions: number;
      authorizedNodeFrontiers: number;
      skippedRawCandidates: number;
      skippedProfileCompatibleRawCandidates: number;
      skippedProfileExcludedRawCandidates: number;
      evaluatedCompleteRawCandidates: number;
      evaluatedCompletePrefixes: number;
      preAdmissionControllerDecisions: number;
      preAdmissionAuthorizedDecisions: number;
      visitedDecorationStates: number;
      referenceDecorationStates: number;
      skippedDecorationStates: number;
    };
  };
  conformance: {
    status: "passed";
    preAdmissionGenerationHash: ContentHash;
    nodeGrowthRetainedStoreHash: ContentHash;
    preAdmissionRetainedStoreHash: ContentHash;
    pruningDisabledCanonicalCandidates: number;
    preAdmissionCanonicalCandidates: number;
    nodeGrowthCanonicalCandidates: number;
    eligible: PackagePruningResultSetConformance;
    indeterminate: PackagePruningResultSetConformance;
  };
  generationHash: ContentHash;
}

export type PredicateNumericOperationKind =
  | "value-add"
  | "value-multiply"
  | "value-sum"
  | "profile-invariant-arithmetic-mean"
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
  coefficientRoles?: Record<string, "fixed" | "free" | "fitted">;
  sensitivityCoefficients: string[];
  result: QuantitySpec;
  explain: string;
  claimRefs: string[];
}

export interface NormalizedFunctional extends Functional {
  coefficientRoles: Record<string, "fixed" | "free" | "fitted">;
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

export type PerturbationEnumeration =
  | "exhaustive-valid-single-edits-v1"
  | "sampled-valid-single-edits-v1";
export type PerturbationEmptyPolicy = "indeterminate" | "vacuous-pass";
export type PerturbationDirection = "decrease" | "increase";

export type PerturbationDefinition =
  | {
      id: string;
      kind: "edge-deletion";
      enumeration?: PerturbationEnumeration;
      emptyPolicy?: PerturbationEmptyPolicy;
      roles?: string[];
    }
  | {
      id: string;
      kind: "node-deletion";
      enumeration?: PerturbationEnumeration;
      emptyPolicy?: PerturbationEmptyPolicy;
    }
  | {
      id: string;
      kind: "edge-role-replacement";
      enumeration?: PerturbationEnumeration;
      emptyPolicy?: PerturbationEmptyPolicy;
      replacements: { from: string; to: string }[];
    }
  | {
      id: string;
      kind: "numeric-attribute-displacement";
      enumeration?: PerturbationEnumeration;
      emptyPolicy?: PerturbationEmptyPolicy;
      target: "nodes" | "edges";
      attribute: string;
      epsilon: number;
      directions?: PerturbationDirection[];
    };

export type NormalizedPerturbationDefinition =
  | {
      id: string;
      kind: "edge-deletion";
      enumeration: PerturbationEnumeration;
      emptyPolicy: PerturbationEmptyPolicy;
      roles?: string[];
    }
  | {
      id: string;
      kind: "node-deletion";
      enumeration: PerturbationEnumeration;
      emptyPolicy: PerturbationEmptyPolicy;
    }
  | {
      id: string;
      kind: "edge-role-replacement";
      enumeration: PerturbationEnumeration;
      emptyPolicy: PerturbationEmptyPolicy;
      replacements: { from: string; to: string }[];
    }
  | {
      id: string;
      kind: "numeric-attribute-displacement";
      enumeration: PerturbationEnumeration;
      emptyPolicy: PerturbationEmptyPolicy;
      target: "nodes" | "edges";
      attribute: string;
      epsilon: number;
      directions: PerturbationDirection[];
    };

export type CandidateAttributeDefinition =
  | {
      name: string;
      target: "nodes" | "edges";
      source: {
        kind: "constant-scalar-v1";
        value: number | string | boolean | null;
      };
    }
  | {
      name: string;
      target: "nodes";
      source: {
        kind: "element-invariant-scalar-v1";
        invariant: string;
      };
    }
  | {
      name: string;
      target: "nodes" | "edges";
      source: {
        kind: "constant-quantity-v1";
        value: Quantity;
      };
    }
  | {
      name: string;
      target: "nodes";
      source: {
        kind: "element-invariant-quantity-v1";
        invariant: string;
      };
    }
  | {
      name: string;
      target: "edges";
      source: {
        kind: "edge-role-scalar-v1";
        values: Record<string, number | string | boolean | null>;
      };
    }
  | {
      name: string;
      target: "edges";
      source: {
        kind: "edge-role-quantity-v1";
        values: Record<string, Quantity>;
      };
    };

export interface RulePackage {
  schemaVersion: "1";
  id: string;
  version: string;
  primitives: PrimitiveDefinition[];
  sourceArtifacts?: ArtifactRef[];
  sourceMigration?: SourceMigrationBinding;
  evidence?: EvidenceRef[];
  claims?: Claim[];
  predicates?: Predicate[];
  functionals?: Functional[];
  cohortRules?: CohortRule[];
  selectors?: CohortSelector[];
  partialOraclePolicy?: PartialOraclePolicy;
  ontologyAxes?: OntologyAxisDefinition;
  perturbations?: (string | PerturbationDefinition)[];
  candidateAttributes?: CandidateAttributeDefinition[];
  profileDefinition?:
    | { kind: "explicit-only" }
    | {
        kind: "residual-slots-v1";
        baseProfile: Omit<Profile, "hash"> & { hash?: ProfileHash };
        derivedTypeTags: string[];
        claimRefs: string[];
      }
    | {
        kind: "residual-slots-v2";
        baseProfile: Omit<Profile, "hash"> & { hash?: ProfileHash };
        derivedTypeTags: string[];
        claimRefs: string[];
        derivedInvariants: FormationDerivedProfileInvariantDefinition[];
      }
    | {
        kind: "residual-slots-v3";
        baseProfile: Omit<Profile, "hash"> & { hash?: ProfileHash };
        derivedTypeTags: string[];
        claimRefs: string[];
        derivedInvariants: FormationDerivedProfileInvariantDefinition[];
        derivedTypeRules: FormationDerivedTypeRuleDefinition[];
      };
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
  invariants: Record<string, InvariantValue>;
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

export interface NormalizedRulePackage extends Omit<
  Required<Omit<RulePackage, "sourceMigration">>,
  "profileDefinition" | "perturbations" | "functionals"
> {
  sourceMigration?: SourceMigrationBinding;
  primitives: NormalizedPrimitiveDefinition[];
  functionals: NormalizedFunctional[];
  perturbations: (string | NormalizedPerturbationDefinition)[];
  profileDefinition:
    | { kind: "explicit-only" }
    | {
        kind: "residual-slots-v1";
        baseProfile: NormalizedProfile;
        derivedTypeTags: string[];
        claimRefs: string[];
      }
    | {
        kind: "residual-slots-v2";
        baseProfile: NormalizedProfile;
        derivedTypeTags: string[];
        claimRefs: string[];
        derivedInvariants: FormationDerivedProfileInvariantDefinition[];
      }
    | {
        kind: "residual-slots-v3";
        baseProfile: NormalizedProfile;
        derivedTypeTags: string[];
        claimRefs: string[];
        derivedInvariants: FormationDerivedProfileInvariantDefinition[];
        derivedTypeRules: FormationDerivedTypeRuleDefinition[];
      };
  identityPolicy: IdentityPolicy;
}

export interface SemanticManifest {
  schemaVersion: "1";
  kernelVersion: string;
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  identityPolicyHash: ContentHash;
  sourceMigrationHash?: ContentHash;
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
  profileCompositionPolicy: "post-admission-v1" | "profile-slot-gate-v1";
  substructurePolicy: SubstructurePolicy;
  nullModels: NullModelId[];
  ontologyTarget?: OntologyCoordinate;
  evidencePolicy: "require-all" | "allow-declared";
  indeterminateThreshold: number;
  levelBoundaryPolicy?: LevelBoundaryPolicy;
  boundedFixpoint?: { enabled: boolean; maxIterations: number };
}

export type RunConfigInput = Omit<
  RunConfig,
  "budget" | "profileCompositionPolicy"
> & {
  budget?: Partial<RunBudget>;
  profileCompositionPolicy?: RunConfig["profileCompositionPolicy"];
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
  enumerator: "decorated-candidate-enumerator-v5";
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
    logicalRawCandidates: number;
    policyExcludedCandidates: number;
    canonicalizationIndeterminateCandidates: number;
    compositionExcludedCandidates: number;
    preAdmissionPrunedCandidates: number;
    branchPrunedRawCandidates: number;
    branchPrunedFrontiers: number;
    nodeBranchPrunedRawCandidates: number;
    nodeBranchPrunedFrontiers: number;
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

export interface ResumableCandidateEnumerationCheckpoint {
  schemaVersion: "1";
  cursor: "raw-candidate-prefix-v1";
  inputHash: ContentHash;
  optionsHash: ContentHash;
  nextRawCandidateOrdinal: number;
  transcriptHash: ContentHash;
  previousCheckpointHash: ContentHash | null;
  checkpointHash: ContentHash;
}

export interface ResumableCandidateEnumerationOptions {
  checkpoint?: ResumableCandidateEnumerationCheckpoint | null;
  maxRawCandidatesPerStep?: number;
}

export interface ResumableCandidateEnumerationStep {
  schemaVersion: "1";
  coordinator: "resumable-decorated-candidate-enumerator-v1";
  policy: {
    state: "raw-candidate-prefix-transcript-v1";
    continuation: "deterministic-prefix-replay-v1";
    terminalResult: "ordinary-decorated-candidate-enumerator-v5-v1";
    semanticBudgets: "never-bypassed-v1";
  };
  inputHash: ContentHash;
  optionsHash: ContentHash;
  previousCheckpointHash: ContentHash | null;
  step: {
    startRawCandidateOrdinal: number;
    endRawCandidateOrdinal: number;
    maximumRawCandidates: number;
    processedRawCandidates: number;
    replayedRawCandidates: number;
  };
  transcriptHash: ContentHash;
  checkpoint: ResumableCandidateEnumerationCheckpoint | null;
  enumeration: DecoratedCandidateEnumerationResult | null;
  status: "paused" | "complete" | "budget-exhausted";
  interpretation:
    | { status: "paused"; reasons: ["raw-candidate-step-limit-reached"] }
    | { status: "complete"; reasons: [] }
    | {
        status: "budget-exhausted";
        reasons: ["semantic-enumeration-budget-exhausted"];
      };
  stepHash: ContentHash;
}

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
  binder: "package-candidate-binding-v2";
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

export interface PackageProfileCompositionPolicy {
  edgeOrder: "canonical-edge-index-v1";
  endpointOrder: "source-then-target-v1";
  slotPreference: "exact-polarity-before-symmetric-then-slot-index-v1";
  capacityConsumption: "one-unit-per-directed-edge-endpoint-v1";
  partnerDomain: "complete-profile-class-v1";
  incompatibleDisposition: "exclude-before-candidate-store-v1";
  indeterminateDisposition: "fail-closed-whole-generation-v1";
}

export interface PackageProfileCompositionEndpoint {
  canonicalNode: number;
  sourceRef: ElementId | ProfileHash;
  profileHash: ProfileHash;
  slotIndex: number;
  polarity: "in" | "out" | "sym";
  guardEvaluationHash: ContentHash | null;
}

export interface PackageProfileCompositionConsumption {
  canonicalEdge: number;
  role: string;
  source: PackageProfileCompositionEndpoint;
  target: PackageProfileCompositionEndpoint;
}

export interface PackageProfileCompositionDecision {
  schemaVersion: "1";
  evaluator: "package-profile-composition-gate-v1";
  bindingHash: ContentHash;
  runConfigHash: ContentHash;
  sourcePopulationHash: ContentHash;
  candidateId: CandidateId;
  candidateCanonicalHash: ContentHash;
  policy: PackageProfileCompositionPolicy;
  outcome: "pass" | "exclude" | "indeterminate";
  reason: string | null;
  details: {
    canonicalEdge: number;
    endpoint: "source" | "target";
    canonicalNode: number;
    partnerCanonicalNode: number;
    role: string;
    requiredPolarity: "in" | "out";
    profileHash: ProfileHash;
    guardEvaluationHash?: ContentHash;
  } | null;
  consumptions: PackageProfileCompositionConsumption[];
  guardEvaluations: Array<ProfileSlotGuardEvaluation & {
    bindingHash: ContentHash;
    phase: "candidate-generation";
  }>;
  decisionHash: ContentHash;
}

export interface PackageProfileComposition {
  schemaVersion: "1";
  evaluator: "package-profile-composition-gate-v1";
  policy: RunConfig["profileCompositionPolicy"];
  status: "not-run" | "complete" | "truncated";
  reasons: string[];
  decisions: PackageProfileCompositionDecision[];
  counts: {
    evaluatedCanonicalCandidates: number;
    compatibleCandidates: number;
    incompatibleCandidates: number;
    indeterminateCandidates: number;
    excludedRawCandidates: number;
  };
  compositionHash: ContentHash;
}

export interface PackageCandidateEnumerationResult {
  schemaVersion: "1";
  generator: "package-candidate-generator-v5";
  binding: PackageCandidateBinding;
  enumeration: DecoratedCandidateEnumerationResult;
  profileComposition: PackageProfileComposition;
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
  evaluator: "package-candidate-filter-evaluator-v20";
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

export interface FunctionalCoefficientWitness {
  expressionPath: string;
  name: string;
  quantity: Quantity;
}

export interface FunctionalEvaluationDiagnostic {
  unrounded: DecimalValue;
  rounded: DecimalValue;
  exact: boolean;
  expressionUnit: string;
  effectiveAbsoluteTolerance: DecimalValue;
  toleranceTargetBound: DecimalValue;
  toleranceTargetMet: boolean;
}

export interface PackageFunctionalEvaluationBase {
  schemaVersion: "1";
  evaluator: "package-functional-evaluator-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  filterHash: ContentHash;
  candidateId: CandidateId;
  functionalId: string;
  expressionHash: ContentHash;
  analysisHash: ContentHash;
  resultSpecification: QuantitySpec;
  precisionPolicy: PrecisionPolicy;
  claimRefs: string[];
  selections: LocalValueSelectionWitness[];
  invariants: LocalInvariantResolutionWitness[];
  coefficients: FunctionalCoefficientWitness[];
  evaluationHash: ContentHash;
}

export type PackageFunctionalEvaluation = PackageFunctionalEvaluationBase & (
  | {
      status: "scored";
      score: Quantity;
      diagnostic: FunctionalEvaluationDiagnostic & { toleranceTargetMet: true };
      reason?: never;
      details?: never;
    }
  | {
      status: "indeterminate";
      reason:
        | "result-tolerance-target-unmet"
        | "invariant-node-ambiguous"
        | "invariant-value-unavailable"
        | "profile-invariant-member-values-missing"
        | "profile-invariant-member-values-disagree";
      details: Record<string, JsonValue>;
      score: null;
      diagnostic:
        | (FunctionalEvaluationDiagnostic & { toleranceTargetMet: false })
        | null;
    }
);

export type CohortKeyAtom =
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null"; value: null }
  | { kind: "number"; value: DecimalValue }
  | {
      kind: "quantity";
      value: DecimalValue;
      unit: string;
      semantic: string | null;
      effectiveAbsoluteTolerance: DecimalValue;
    };

export type CohortPartitionKey =
  | { kind: "global" }
  | { kind: "singleton"; candidateId: CandidateId }
  | { kind: "shared-support"; resourceTokens: ContentHash[] }
  | { kind: "profile-role"; atoms: CohortKeyAtom[] }
  | { kind: "invariant-window"; binIndex: string };

export type CohortKeyExpressionEvaluation = {
  expressionIndex: number;
  expressionHash: ContentHash;
  analysisHash: ContentHash;
} & (
  | {
      status: "resolved";
      atom: CohortKeyAtom;
      exact: boolean;
      selections: LocalValueSelectionWitness[];
      invariants: LocalInvariantResolutionWitness[];
      reason?: never;
      details?: never;
    }
  | {
      status: "indeterminate";
      reason:
        | "invariant-node-ambiguous"
        | "invariant-value-unavailable"
        | "profile-invariant-member-values-missing"
        | "profile-invariant-member-values-disagree";
      details: Record<string, JsonValue>;
      atom?: never;
      exact?: never;
      selections?: never;
      invariants?: never;
    }
);

export type CohortCandidateKeyEvaluation = {
  candidateId: CandidateId;
  expressions: CohortKeyExpressionEvaluation[];
} & (
  | {
      status: "resolved";
      key: CohortPartitionKey;
      reason?: never;
      details?: never;
    }
  | {
      status: "indeterminate";
      reason:
        | "invariant-node-ambiguous"
        | "invariant-value-unavailable"
        | "profile-invariant-member-values-missing"
        | "profile-invariant-member-values-disagree"
        | "window-origin-uncertain"
        | "window-width-uncertain"
        | "window-value-crosses-boundary";
      details: Record<string, JsonValue>;
      key?: never;
    }
);

export interface PackageCohort {
  cohortId: ContentHash;
  key: CohortPartitionKey;
  members: CandidateId[];
}

export interface PackageCohortPartitionBase {
  schemaVersion: "1";
  partitioner: "package-cohort-partitioner-v1";
  scope: "complete-locally-eligible-population-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  cohortRule: CohortRule;
  excludedCandidateIds: {
    predicateRejected: CandidateId[];
    filterIndeterminate: CandidateId[];
  };
  eligibleCandidateIds: CandidateId[];
  keyEvaluations: CohortCandidateKeyEvaluation[];
  cohorts: PackageCohort[];
  counts: {
    evaluatedCandidates: number;
    eligibleCandidates: number;
    keyResolved: number;
    keyIndeterminate: number;
    cohorts: number;
    coveredMembers: number;
  };
  partitionHash: ContentHash;
}

export type PackageCohortPartition = PackageCohortPartitionBase & (
  | {
      status: "complete";
      reason?: never;
      details?: never;
    }
  | {
      status: "empty";
      reason: "no-eligible-candidates";
      details: Record<string, never>;
      keyEvaluations: [];
      cohorts: [];
    }
  | {
      status: "indeterminate";
      reason: "source-census-indeterminate" | "cohort-key-indeterminate";
      details: Record<string, JsonValue>;
      cohorts: [];
    }
);

export interface PackageSelectorRankingOptions extends PackageCandidateExecutionOptions {
  maxFunctionalEvaluations?: number;
}

export interface PackageSelectorRankingPolicy {
  scoreOrder: "objective-rounded-score-then-candidate-id-v1";
  denseEquivalence: "transitive-overlapping-score-interval-components-v1";
  semanticExtrema: "epsilon-boundary-maximum-effective-tolerance-v1";
  gap: "objective-oriented-first-two-member-scores-v1";
  indeterminate: "retain-all-members-null-cohort-metrics-v1";
}

export type PackageSelectorRankedMember = {
  candidateId: CandidateId;
  evaluation: PackageFunctionalEvaluation;
} & (
  | {
      status: "ranked";
      rank: number;
      semanticExtremum: boolean | null;
    }
  | {
      status: "indeterminate";
      rank: null;
      semanticExtremum: null;
    }
);

export interface PackageCohortRankingBase {
  cohortId: ContentHash;
  key: CohortPartitionKey;
  memberIds: CandidateId[];
  members: PackageSelectorRankedMember[];
  epsilon: Quantity;
}

export type PackageCohortRanking = PackageCohortRankingBase & (
  | {
      status: "ranked";
      optimum: Quantity;
      presentationLeader: CandidateId;
      semanticExtrema: CandidateId[];
      degeneracy: number;
      degeneracyRatio: number;
      variationalSelectivity: number;
      gap: Quantity | null;
      reason?: never;
      details?: never;
    }
  | {
      status: "indeterminate";
      reason: "member-functional-indeterminate";
      details: { candidateIds: CandidateId[] };
      optimum: null;
      presentationLeader: null;
      semanticExtrema: [];
      degeneracy: null;
      degeneracyRatio: null;
      variationalSelectivity: null;
      gap: null;
    }
);

export interface PackageSelectorRankingBase {
  schemaVersion: "1";
  ranker: "package-selector-ranker-v1";
  scope: "complete-cohort-ranking-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  partitionHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  selector: CohortSelector;
  functionalId: string;
  cohortRuleId: string;
  precisionPolicy: PrecisionPolicy;
  rankingPolicy: PackageSelectorRankingPolicy;
  excludedCandidateIds: {
    predicateRejected: CandidateId[];
    filterIndeterminate: CandidateId[];
  };
  cohortRankings: PackageCohortRanking[];
  counts: {
    cohorts: number;
    rankedCohorts: number;
    indeterminateCohorts: number;
    members: number;
    scoredMembers: number;
    indeterminateMembers: number;
    semanticExtrema: number;
  };
  variationalSummary: number | null;
  execution: {
    maxFunctionalEvaluations: number;
    usedFunctionalEvaluations: number;
  };
  rankingHash: ContentHash;
}

export type PackageSelectorRanking = PackageSelectorRankingBase & (
  | {
      status: "ranked";
      variationalSummary: number;
      reason?: never;
      details?: never;
    }
  | {
      status: "empty";
      reason: "no-eligible-candidates";
      details: Record<string, never>;
      cohortRankings: [];
      variationalSummary: null;
    }
  | {
      status: "indeterminate";
      reason:
        | "source-partition-indeterminate"
        | "member-functional-indeterminate";
      details: Record<string, JsonValue>;
      variationalSummary: null;
    }
);

export interface PackageSelectorSensitivityOptions
  extends PackageSelectorRankingOptions {
  maxSensitivityFunctionalEvaluations?: number;
}

export interface PackageSelectorSensitivityPolicy {
  coefficientPerturbation:
    "exact-multiplicative-one-plus-or-minus-amplitude-v1";
  oneAtATimeOrder: "amplitude-coefficient-negative-positive-v1";
  cartesianOrder: "amplitude-lexicographic-sign-vector-v1";
  comparison: "exact-leader-presentation-and-canonical-top-k-sets-v1";
  missingComparison: "indeterminate-without-denominator-reduction-v1";
}

export interface PackageSelectorSensitivityDirection {
  coefficient: string;
  direction: "negative" | "positive";
  factor: DecimalValue;
}

export interface PackageSelectorSensitivityCoefficientWitness {
  name: string;
  factor: DecimalValue;
  base: Quantity;
  perturbed: Quantity;
}

export interface PackageSelectorSensitivityComparisonView {
  semanticExtrema: CandidateId[];
  presentationLeader: CandidateId;
  topK: CandidateId[];
}

export type PackageSelectorSensitivityComparison = {
  cohortId: ContentHash;
  base: PackageSelectorSensitivityComparisonView;
} & (
  | {
      status: "comparable";
      perturbed: PackageSelectorSensitivityComparisonView;
      leaderSetStable: boolean;
      presentationLeaderStable: boolean;
      topKStable: boolean;
      reason?: never;
    }
  | {
      status: "indeterminate";
      reason: "perturbed-cohort-indeterminate";
      perturbed: null;
      leaderSetStable: null;
      presentationLeaderStable: null;
      topKStable: null;
    }
);

export interface PackageSelectorSensitivityVariant {
  amplitude: number;
  sweep: "one-at-a-time" | "cartesian";
  directions: PackageSelectorSensitivityDirection[];
  variantId: ContentHash;
  coefficients: PackageSelectorSensitivityCoefficientWitness[];
  status: "ranked" | "indeterminate";
  cohortRankings: PackageCohortRanking[];
  comparisons: PackageSelectorSensitivityComparison[];
}

export interface PackageSelectorSensitivityPoint {
  amplitude: number;
  requiredVariants: number;
  evaluatedVariants: number;
  requiredComparisons: number;
  evaluatedComparisons: number;
  comparableComparisons: number;
  leaderSetMatches: number;
  presentationLeaderMatches: number;
  topKMatches: number;
  leaderSetStability: number | null;
  presentationLeaderStability: number | null;
  topKStability: number | null;
}

export type PackageSelectorSensitivityReason =
  | "base-ranking-indeterminate"
  | "no-ranked-cohorts"
  | "no-sensitivity-coefficients"
  | "variant-limit-exceeded"
  | "perturbation-budget-insufficient"
  | "functional-evaluation-limit-exceeded"
  | "variant-ranking-indeterminate";

export interface PackageSelectorSensitivityReportBase {
  schemaVersion: "1";
  evaluator: "package-selector-sensitivity-evaluator-v1";
  scope: "complete-required-perturbation-sweep-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  partitionHash: ContentHash;
  baseRankingHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  selectorId: string;
  functionalId: string;
  policy: CohortSelector["sensitivity"];
  sensitivityPolicy: PackageSelectorSensitivityPolicy;
  sensitivityCoefficients: string[];
  status: "complete" | "not-applicable" | "indeterminate";
  reasons: PackageSelectorSensitivityReason[];
  details: Record<string, JsonValue>;
  points: PackageSelectorSensitivityPoint[];
  variants: PackageSelectorSensitivityVariant[];
  verdict: "robust" | "fragile" | null;
  execution: {
    perturbationSamples: number;
    maxSensitivityFunctionalEvaluations: number;
    requiredVariants: number | `${bigint}`;
    evaluatedVariants: number;
    requiredFunctionalEvaluations: number | `${bigint}`;
    usedFunctionalEvaluations: number;
    requiredComparisons: number | `${bigint}`;
    evaluatedComparisons: number;
  };
  sensitivityHash: ContentHash;
}

export type PackageSelectorSensitivityReport =
  PackageSelectorSensitivityReportBase & (
    | {
        status: "complete";
        reasons: [];
        verdict: "robust" | "fragile";
      }
    | {
        status: "not-applicable";
        reasons: ["no-ranked-cohorts" | "no-sensitivity-coefficients"];
        points: [];
        variants: [];
        verdict: null;
      }
    | {
        status: "indeterminate";
        reasons: [Exclude<
          PackageSelectorSensitivityReason,
          "no-ranked-cohorts" | "no-sensitivity-coefficients"
        >];
        verdict: null;
      }
  );

export type PackageSelectorAdmissionOptions =
  PackageSelectorSensitivityOptions;

export interface PackageSelectorExecutionInput {
  selectorId: string;
  partition: PackageCohortPartition;
  ranking: PackageSelectorRanking;
  sensitivity: PackageSelectorSensitivityReport;
}

export type PackageSelectorExecution = PackageSelectorExecutionInput;

export interface PackageSelectorAdmissionPolicy {
  selectorOrder: "normalized-selector-id-v1";
  combination: "every-applicable-semantic-extremum-v1";
  decisionPrecedence:
    "predicate-rejected-filter-indeterminate-selector-excluded-selection-indeterminate-selected-v1";
  noSelectors: "identity-admission-without-synthetic-ranking-v1";
  sensitivityEffect:
    "interpretation-only-without-base-selection-erasure-v1";
}

export interface PackageSelectorAdmissionEvaluation {
  selectorId: string;
  cohortId: ContentHash | null;
  outcome: "selected" | "excluded" | "indeterminate";
  functionalEvaluationHash: ContentHash | null;
  score: Quantity | null;
  rank: number | null;
  semanticExtrema: CandidateId[];
  rankingHash: ContentHash;
  sensitivityHash: ContentHash;
  sensitivityStatus: PackageSelectorSensitivityReport["status"];
  sensitivityVerdict: "robust" | "fragile" | null;
  claimRefs: string[];
}

export type PackageSelectorAdmissionOutcome =
  | "predicate-rejected"
  | "filter-indeterminate"
  | "selector-excluded"
  | "selection-indeterminate"
  | "selected";

export interface PackageSelectorAdmissionDecision {
  candidateId: CandidateId;
  filterHash: ContentHash;
  localVerdict: PackageCandidateFilterEvaluation["verdict"];
  passedPredicateIds: string[];
  outcome: PackageSelectorAdmissionOutcome;
  selectorEvaluations: PackageSelectorAdmissionEvaluation[];
  selectedBy: string[];
  excludedBy: string[];
  indeterminateBy: string[];
}

export interface PackageSelectorAdmissionCensus {
  selectorId: string;
  cohortRuleId: string;
  rankingHash: ContentHash;
  sensitivityHash: ContentHash;
  rankingStatus: PackageSelectorRanking["status"];
  sensitivityStatus: PackageSelectorSensitivityReport["status"];
  sensitivityVerdict: "robust" | "fragile" | null;
  counts: {
    evaluated: number;
    selected: number;
    excluded: number;
    indeterminate: number;
  };
  variationalSelectivity: number | null;
  interpretation: {
    status: "valid" | "fragile" | "not-applicable" | "indeterminate";
    reasons: string[];
  };
}

export interface PackageSelectorAdmission {
  schemaVersion: "1";
  admitter: "package-selector-admission-v1";
  scope: "complete-local-census-all-declared-selectors-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  selectorOrder: string[];
  admissionPolicy: PackageSelectorAdmissionPolicy;
  selectorExecutions: PackageSelectorExecution[];
  decisions: PackageSelectorAdmissionDecision[];
  selectorCensus: PackageSelectorAdmissionCensus[];
  selectedCandidateIds: CandidateId[];
  counts: {
    evaluatedCandidates: number;
    predicateRejected: number;
    filterIndeterminate: number;
    eligibleCandidates: number;
    selectorExcluded: number;
    selectionIndeterminate: number;
    selectedCandidates: number;
    finalIndeterminate: number;
  };
  selectionRetention: number | null;
  overallRetention: number | null;
  indeterminateRatio: number | null;
  status: "complete" | "empty" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "empty"; reasons: ["no-evaluated-candidates"] }
    | {
        status: "indeterminate";
        reasons: ["indeterminate-ratio-exceeds-threshold"];
      };
  admissionHash: ContentHash;
}

export type PackageSelectedFormationsOptions =
  PackageSelectorAdmissionOptions;

export interface PackageSelectedFormationsPolicy {
  candidateOrder: "canonical-candidate-id-v1";
  admissionSource: "exact-admission-selected-outcome-v1";
  constituentResolution: "preserve-filter-formation-resolution-v1";
  claimLineage:
    "passed-predicate-selected-selector-and-functional-claims-v1";
  materializationDisposition:
    "formation-only-profile-and-element-identity-deferred-v1";
}

export interface PackageSelectedFormationSelectionWitness {
  selectorId: string;
  cohortId: ContentHash;
  functionalEvaluationHash: ContentHash;
  rankingHash: ContentHash;
  sensitivityHash: ContentHash;
}

export interface PackageSelectedFormation {
  schemaVersion: "1";
  candidateId: CandidateId;
  filterHash: ContentHash;
  admissionHash: ContentHash;
  targetDepth: number;
  depthBasis: BasisHash;
  sourcePopulationHash: ContentHash;
  candidate: Candidate;
  constituents: PackageCandidateConstituentResolution[];
  admittedBy: string[];
  selectedBy: string[];
  selectionWitnesses: PackageSelectedFormationSelectionWitness[];
  claimRefs: string[];
  evidence: string[];
  formationHash: ContentHash;
}

export interface PackageSelectedFormations {
  schemaVersion: "1";
  materializer: "package-selected-formations-v1";
  scope: "definitely-selected-candidate-formations-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  admissionHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  targetDepth: number;
  depthBasis: BasisHash;
  formationPolicy: PackageSelectedFormationsPolicy;
  selectedCandidateIds: CandidateId[];
  formations: PackageSelectedFormation[];
  counts: PackageSelectorAdmission["counts"] & {
    selectedFormations: number;
  };
  status: PackageSelectorAdmission["status"];
  interpretation: PackageSelectorAdmission["interpretation"];
  formationSetHash: ContentHash;
}

export type PackageDerivedProfileOptions = PackageSelectedFormationsOptions;

export interface PackageDerivedProfilePolicy {
  edgeOrder: "canonical-edge-index-v1";
  endpointOrder: "source-then-target-v1";
  slotPreference: "exact-polarity-before-symmetric-then-slot-index-v1";
  capacityConsumption: "one-unit-per-directed-edge-endpoint-v1";
  guardDisposition: "typed-partner-guards-with-legacy-fail-closed-v1";
  baseComposition: "base-profile-plus-residual-constituent-slots-v1";
  invariantDerivation: "complete-declared-functional-evaluation-v1";
  invariantComposition: "base-plus-formation-derived-invariants-v1";
  invariantFailure: "all-or-nothing-profile-indeterminate-v1";
  typeDerivation: "tolerance-aware-derived-invariant-thresholds-v1";
  typeComposition: "static-plus-matched-rule-tags-v1";
  typeFailure: "source-invariant-all-or-nothing-v1";
}

export interface PackageDerivedProfileEndpointConsumption {
  canonicalNode: number;
  elementId: ElementId;
  profileHash: ProfileHash;
  slotIndex: number;
  polarity: "in" | "out" | "sym";
  guardEvaluationHash: ContentHash | null;
}

export interface ProfileSlotGuardCheck {
  path: string;
  op: string;
  outcome: "pass" | "fail" | "indeterminate";
  details: Record<string, JsonValue>;
}

export interface ProfileSlotGuardMemberOutcome {
  elementId: ElementId;
  outcome: "pass" | "fail" | "indeterminate";
  reason: string | null;
  checks: ProfileSlotGuardCheck[];
}

export interface ProfileSlotGuardEvaluation {
  schemaVersion: "1";
  evaluator: "profile-slot-partner-guard-v1";
  guardHash: ContentHash;
  guard: ProfileSlotGuard;
  candidateId: CandidateId;
  canonicalEdge: number;
  endpoint: "source" | "target";
  canonicalNode: number;
  role: string;
  requiredPolarity: "in" | "out";
  profileHash: ProfileHash;
  slotIndex: number;
  partnerCanonicalNode: number;
  partnerProfileHash: ProfileHash;
  partnerElementIds: ElementId[];
  memberOutcomes: ProfileSlotGuardMemberOutcome[];
  outcome: "pass" | "fail" | "indeterminate";
  reason: string | null;
  evaluationHash: ContentHash;
}

export interface PackageDerivedProfileConsumption {
  canonicalEdge: number;
  role: string;
  source: PackageDerivedProfileEndpointConsumption;
  target: PackageDerivedProfileEndpointConsumption;
}

export interface PackageDerivedProfileResultBase {
  candidateId: CandidateId;
  formationHash: ContentHash;
  guardEvaluations: ProfileSlotGuardEvaluation[];
  derivedInvariantEvaluations: PackageFunctionalEvaluation[];
  derivedTypeEvaluations: FormationDerivedTypeEvaluation[];
  derivedTypeTags: string[];
  claimRefs: string[];
  evidence: string[];
  profileResultHash: ContentHash;
}

export interface FormationDerivedTypeEvaluation {
  schemaVersion: "1";
  evaluator: "formation-derived-type-rule-v1";
  rule: FormationDerivedTypeRuleDefinition;
  sourceFunctionalEvaluationHash: ContentHash;
  comparison: QuantityComparison;
  outcome: "assigned" | "not-assigned";
}

export type PackageDerivedProfileResult =
  | (PackageDerivedProfileResultBase & {
      status: "materialized";
      consumptions: PackageDerivedProfileConsumption[];
      profile: NormalizedProfile;
      reason?: never;
      details?: never;
    })
  | (PackageDerivedProfileResultBase & {
      status: "indeterminate";
      reason:
        | "derived-profile-policy-unavailable"
        | "profile-slot-guard-unsupported"
        | "profile-slot-guard-indeterminate"
        | "profile-slot-guard-unsatisfied"
        | "profile-slot-capacity-unavailable"
        | "profile-derived-invariant-indeterminate";
      details: Record<string, JsonValue>;
      consumptions: [];
      profile: null;
    });

export interface PackageDerivedProfiles {
  schemaVersion: "1";
  extractor: "package-derived-profile-extractor-v3";
  scope: "all-selected-formations-residual-slot-functional-invariants-and-types-v3";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  admissionHash: ContentHash;
  formationSetHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  targetDepth: number;
  depthBasis: BasisHash;
  extractionPolicy: PackageDerivedProfilePolicy;
  profileDefinition: NormalizedRulePackage["profileDefinition"];
  results: PackageDerivedProfileResult[];
  counts: {
    selectedFormations: number;
    materializedProfiles: number;
    indeterminateProfiles: number;
  };
  status: "complete" | "empty" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "empty"; reasons: ["no-selected-formations"] }
    | {
        status: "indeterminate";
        reasons: ["derived-profile-indeterminate"];
      };
  profileSetHash: ContentHash;
}

export type PackageDerivedDepthPopulationOptions = PackageDerivedProfileOptions;

export interface PackageDerivedElementIdentityPolicy {
  graphContent:
    "canonical-candidate-content-without-execution-provenance-v1";
  quantityAttributes: "normalized-value-unit-tolerance-semantic-v1";
  ontologyCoordinate: "normalized-run-target-or-absent-v1";
  typeTags: "verified-profile-result-type-tags-v1";
  packageIdentityFields: "loaded-identity-policy-v1";
  primaryDerivation: "lexicographically-smallest-formation-hash-v1";
  alternateDerivations: "separate-canonical-derivation-index-v1";
}

export interface PackageDerivedDepthDerivation {
  candidateId: CandidateId;
  formationHash: ContentHash;
  profileResultHash: ContentHash;
  admittedBy: string[];
  selectedBy: string[];
  claimRefs: string[];
  provenance: ElementProvenance;
}

export interface PackageDerivedDepthDerivationIndexEntry {
  elementId: ElementId;
  primaryFormationHash: ContentHash;
  derivations: PackageDerivedDepthDerivation[];
}

export interface PackageDerivedDepthPopulation {
  schemaVersion: "1";
  materializer: "package-derived-depth-population-v3";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  admissionHash: ContentHash;
  formationSetHash: ContentHash;
  profileSetHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  depth: number;
  depthBasis: BasisHash;
  elementIdentityPolicy: PackageDerivedElementIdentityPolicy;
  elements: Array<Element & { kind: "derived"; depth: number; provenance: ElementProvenance }>;
  derivationIndex: PackageDerivedDepthDerivationIndexEntry[];
  counts: {
    selectedFormations: number;
    materializedProfiles: number;
    uniqueElements: number;
    alternateDerivations: number;
    indeterminateProfiles: number;
  };
  status: "complete" | "empty" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "empty"; reasons: ["no-materialized-elements"] }
    | {
        status: "indeterminate";
        reasons: ["source-derived-profiles-indeterminate"];
      };
  populationHash: ContentHash;
}

export interface PackageLevelClosureOptions
  extends PackageSelectorSensitivityOptions {}

export interface PackageLevelRunIdentity {
  schemaVersion: "1";
  kernelVersion: string;
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  bindingHash: ContentHash;
  runHash: ContentHash;
}

export interface PackageLevelClosureExecution {
  selectorCount: number;
  eligibleCandidates: number;
  maxFunctionalEvaluations: number;
  requiredFunctionalEvaluations: number;
  usedFunctionalEvaluations: number;
  perturbationSamples: number;
  requiredPerturbationSamples: number;
  usedPerturbationSamples: number;
  maxSensitivityFunctionalEvaluations: number;
  requiredSensitivityFunctionalEvaluations: number;
  usedSensitivityFunctionalEvaluations: number;
}

export interface PackageLevelClosureCounts {
  evaluatedCandidates: number;
  predicateRejected: number;
  filterIndeterminate: number;
  eligibleCandidates: number;
  selectorExcluded: number;
  selectionIndeterminate: number;
  selectedCandidates: number;
  finalIndeterminate: number;
  selectedFormations: number;
  materializedProfiles: number;
  uniqueElements: number;
  alternateDerivations: number;
}

export interface PackageNullModelExecutionArtifacts {
  plan: PackageNullModelPlan;
  proposals: PackageNullModelProposals;
  trialCensuses: PackageNullModelTrialCensuses;
  trialSelections: PackageNullModelTrialSelections;
}

export interface PackageLevelClosure {
  schemaVersion: "1";
  closer: "package-level-closure-v1";
  scope: "primitive-to-derived-depth-1-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  run: PackageLevelRunIdentity;
  depth: 1;
  axisProvenance: AxisProvenance;
  ontologyCoordinate?: OntologyCoordinate;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  artifacts: {
    census: PackageCandidateCensus;
    admission: PackageSelectorAdmission;
    formations: PackageSelectedFormations;
    profiles: PackageDerivedProfiles;
    population: PackageDerivedDepthPopulation;
    nullModels?: PackageNullModelExecutionArtifacts;
  };
  metrics: {
    booleanSelectivity: number | null;
    selectorCensus: PackageSelectorAdmissionCensus[];
    selectionRetention: number | null;
    overallRetention: number | null;
    counts: PackageLevelClosureCounts;
  };
  baseline:
    | {
        status: "not-run";
        reasons: ["null-models-disabled"];
      }
    | PackageNullModelBaseline;
  execution: PackageLevelClosureExecution;
  status: "complete" | "empty" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "empty"; reasons: ["no-materialized-elements"] }
    | {
        status: "indeterminate";
        reasons: Array<
          | "admission-indeterminate"
          | "derived-profile-indeterminate"
          | "population-indeterminate"
          | "baseline-indeterminate"
        >;
      };
  levelHash: ContentHash;
}

export interface PackageDepthLevelClosure extends Omit<
  PackageLevelClosure,
  "closer" | "scope" | "depth" | "artifacts"
> {
  closer: "package-depth-level-closure-v1";
  scope: "verified-prior-levels-to-target-depth-v1";
  depth: number;
  priorLevels: Array<{
    depth: number;
    levelHash: ContentHash;
    populationHash: ContentHash;
    runHash: ContentHash;
  }>;
  sourceSelectionHash: ContentHash;
  artifacts: {
    census: PackageDepthCandidateCensus;
    admission: PackageSelectorAdmission;
    formations: PackageSelectedFormations;
    profiles: PackageDerivedProfiles;
    population: PackageDerivedDepthPopulation;
    nullModels?: PackageNullModelExecutionArtifacts;
  };
}

export type PackageClosedLevel = PackageLevelClosure | PackageDepthLevelClosure;

export interface PackageLevelExplanationDerivedElementLink {
  element: Element & { kind: "derived" };
  primaryFormationHash: ContentHash;
  derivation: PackageDerivedDepthDerivation;
}

export interface PackageLevelExplanationEntry {
  candidateId: CandidateId;
  filter: PackageCandidateFilterEvaluation | PackageDepthCandidateFilterEvaluation;
  admission: PackageSelectorAdmissionDecision;
  formation: PackageSelectedFormation | null;
  profile: PackageDerivedProfileResult | null;
  derivedElements: PackageLevelExplanationDerivedElementLink[];
}

export interface PackageLevelExplanationIndex {
  schemaVersion: "1";
  indexer: "package-level-explanation-indexer-v1";
  scope: "complete-verified-level-candidate-lineage-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runHash: ContentHash;
  levelHash: ContentHash;
  targetDepth: number;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  artifactHashes: {
    censusHash: ContentHash;
    admissionHash: ContentHash;
    formationSetHash: ContentHash;
    profileSetHash: ContentHash;
    populationHash: ContentHash;
  };
  entries: PackageLevelExplanationEntry[];
  counts: {
    candidates: number;
    selectedCandidates: number;
    formations: number;
    materializedProfiles: number;
    indeterminateProfiles: number;
    derivedElementLinks: number;
    distinctDerivedElements: number;
  };
  indexHash: ContentHash;
}

export interface PackageLevelCandidateExplanation {
  schemaVersion: "1";
  explainer: "package-level-candidate-explainer-v1";
  indexHash: ContentHash;
  packageId: ContentHash;
  rulesHash: ContentHash;
  runHash: ContentHash;
  levelHash: ContentHash;
  targetDepth: number;
  candidateId: CandidateId;
  entry: PackageLevelExplanationEntry;
  explanationHash: ContentHash;
}

export interface PackageLevelResultCensusCounts {
  generatedBeforeCanonicalization: number;
  canonicalCandidates: number;
  evaluatedCandidates: number;
  predicateRejected: number;
  filterIndeterminate: number;
  eligibleCandidates: number;
  selectorExcluded: number;
  selectionIndeterminate: number;
  selectedCandidates: number;
  finalIndeterminate: number;
  selectedFormations: number;
  materializedProfiles: number;
  indeterminateProfiles: number;
  admittedElements: number;
  alternateDerivations: number;
}

export interface PackageLevelResultCensus {
  schemaVersion: "1";
  integrator: "package-level-result-census-v1";
  scope: "complete-verified-level-result-census-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runHash: ContentHash;
  levelHash: ContentHash;
  targetDepth: number;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  sourcePopulationHash: ContentHash;
  artifactHashes: PackageLevelExplanationIndex["artifactHashes"];
  counts: PackageLevelResultCensusCounts;
  selectivity: {
    boolean: number | null;
    variational: Array<{ selectorId: string; value: number | null }>;
    selectionRetention: number | null;
    overallRetention: number | null;
    indeterminateRatio: number | null;
  };
  predicateCensus: PackagePredicateCensus[];
  selectorCensus: PackageSelectorAdmissionCensus[];
  admittedElementIds: ElementId[];
  baseline: PackageLevelClosure["baseline"];
  interpretation: {
    level: PackageLevelClosure["interpretation"];
    local: PackageCandidateCensus["interpretation"];
    admission: PackageSelectorAdmission["interpretation"];
    selectors: Array<{
      selectorId: string;
      status: PackageSelectorAdmissionCensus["interpretation"]["status"];
      reasons: string[];
    }>;
  };
  resultCensusHash: ContentHash;
}

export type PackageRunArtifactKind =
  | "semantic-manifest"
  | "normalized-package"
  | "source-artifacts"
  | "source-migration"
  | "primitives"
  | "predicates"
  | "functionals"
  | "cohort-rules"
  | "selectors"
  | "claims"
  | "evidence"
  | "oracle-policy"
  | "ontology-axes"
  | "perturbations"
  | "profile-definition"
  | "identity-policy"
  | "run-config"
  | "level-result"
  | "level-census"
  | "level-explanations";

export interface PackageRunArtifactEntry {
  artifactKind: PackageRunArtifactKind;
  targetDepth: number | null;
  semanticHash: ContentHash;
  ref: ArtifactRef;
}

export interface PackageRunSemanticManifest {
  schemaVersion: "1";
  generator: "package-run-semantic-manifest-v1";
  kernelVersion: string;
  runHash: ContentHash;
  depthBasisHash: BasisHash;
  sourceMigrationHash?: ContentHash;
  packageId: ContentHash;
  primitivesHash: ContentHash;
  rulesHash: ContentHash;
  functionalsHash: ContentHash;
  cohortRulesHash: ContentHash;
  selectorsHash: ContentHash;
  sensitivityPolicyHash: ContentHash;
  claimsHash: ContentHash;
  evidenceHash: ContentHash;
  oraclePolicyHash: ContentHash;
  configHash: ContentHash;
  numericalPolicyHash: ContentHash;
  seed: string;
  targetDepth: number;
  levelRuns: Array<{
    targetDepth: number;
    runHash: ContentHash;
    levelHash: ContentHash;
    resultCensusHash: ContentHash;
    explanationIndexHash: ContentHash;
  }>;
  inputArtifacts: ArtifactRef[];
  manifestHash: ContentHash;
}

export interface PackageRunArtifactBundleLevel {
  targetDepth: number;
  level: PackageClosedLevel;
  resultCensus: PackageLevelResultCensus;
  explanationIndex: PackageLevelExplanationIndex;
}

export interface PackageRunArtifactExecutionOptions {
  kernelVersion: string;
  maxRawCandidates: number;
  maxDecorationStates: number;
  maxSearchStates: number;
  maxFunctionalEvaluations: number;
  maxSensitivityFunctionalEvaluations: number;
}

export interface PackageRunArtifactBundle {
  schemaVersion: "1";
  bundler: "package-run-artifact-bundle-v1";
  scope: "complete-verified-level-chain-artifacts-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  runHash: ContentHash;
  targetDepth: number;
  executionOptions: PackageRunArtifactExecutionOptions;
  normalizedInput: {
    loadedPackage: LoadedRulePackage;
    runConfig: RunConfig;
  };
  semanticManifest: PackageRunSemanticManifest;
  levels: PackageRunArtifactBundleLevel[];
  artifacts: PackageRunArtifactEntry[];
  counts: {
    levels: number;
    runs: number;
    artifacts: number;
    candidates: number;
    admittedElements: number;
  };
  bundleHash: ContentHash;
}

export interface PackageRunArtifactMaterialization {
  schemaVersion: "1";
  materializer: "package-run-artifact-materializer-v1";
  bundleHash: ContentHash;
  ref: ArtifactRef;
  bytesBase64: string;
  materializationHash: ContentHash;
}

export interface PackageRunArtifactStoreIndexEntry {
  runHash: ContentHash;
  bundleHash: ContentHash;
  targetDepth: number;
  levelHash: ContentHash;
  resultCensusHash: ContentHash;
  explanationIndexHash: ContentHash;
}

export interface PackageRunArtifactStore {
  schemaVersion: "1";
  indexer: "package-run-artifact-store-v1";
  scope: "externally-bound-verified-run-bundle-index-v1";
  bundles: PackageRunArtifactBundle[];
  runIndex: PackageRunArtifactStoreIndexEntry[];
  counts: {
    bundles: number;
    runs: number;
    levels: number;
    artifacts: number;
  };
  storeHash: ContentHash;
}

export interface PackageRunCandidateExplanation {
  schemaVersion: "1";
  explainer: "package-run-candidate-explainer-v1";
  storeHash: ContentHash;
  bundleHash: ContentHash;
  runHash: ContentHash;
  levelHash: ContentHash;
  resultCensusHash: ContentHash;
  explanationIndexHash: ContentHash;
  targetDepth: number;
  candidateId: CandidateId;
  levelExplanation: PackageLevelCandidateExplanation;
  explanationHash: ContentHash;
}

export interface PackageRunArtifactStoreSession {
  readonly store: PackageRunArtifactStore;
  explain(
    runHash: ContentHash,
    candidateId: CandidateId
  ): PackageRunCandidateExplanation;
}

export interface PackageLadderClosurePolicy {
  levelOrder: "ascending-contiguous-depth-v1";
  sourceSemantics: "run-config-all-below-or-previous-only-v1";
  elementIdentity: "minimum-derivation-depth-with-all-appearances-v1";
  termination: "requested-depth-or-no-new-elements-or-indeterminate-v1";
  executionCeilings: "independently-preflighted-per-level-v1";
}

export interface PackageLadderIntroduction {
  depth: number;
  levelHash: ContentHash;
  populationHash: ContentHash;
  populationElements: number;
  introducedElements: number;
  rederivedElements: number;
}

export interface PackageLadderDepthIndexEntry {
  elementId: ElementId;
  minimumDepth: number;
  element: Element;
  appearances: Array<{
    depth: number;
    populationHash: ContentHash;
    levelHash: ContentHash | null;
  }>;
}

export interface PackageLadderClosure {
  schemaVersion: "1";
  closer: "package-ladder-closure-v1";
  scope: "bounded-explicit-depth-transitions-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  runConfig: RunConfig;
  requestedDepths: number;
  policy: PackageLadderClosurePolicy;
  primitivePopulation: PrimitiveDepthPopulation;
  levels: PackageClosedLevel[];
  introducedByDepth: PackageLadderIntroduction[];
  depthIndex: PackageLadderDepthIndexEntry[];
  selectivityLadder: Array<{
    depth: number;
    levelHash: ContentHash;
    booleanSelectivity: number | null;
    selectorCensus: PackageSelectorAdmissionCensus[];
  }>;
  counts: {
    requestedLevels: number;
    executedLevels: number;
    primitiveElements: number;
    derivedAppearances: number;
    uniqueDerivedElements: number;
    rederivedAppearances: number;
    totalUniqueElements: number;
  };
  execution: {
    policy: "independently-preflighted-per-level-v1";
    executedLevels: number;
    requiredFunctionalEvaluations: number;
    usedFunctionalEvaluations: number;
    requiredPerturbationSamples: number;
    usedPerturbationSamples: number;
    requiredSensitivityFunctionalEvaluations: number;
    usedSensitivityFunctionalEvaluations: number;
  };
  status: "complete" | "fixpoint" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: []; terminalDepth: number }
    | { status: "fixpoint"; reasons: ["no-new-elements"]; terminalDepth: number }
    | {
        status: "indeterminate";
        reasons: ["level-indeterminate"];
        terminalDepth: number;
      };
  ladderHash: ContentHash;
}

export type PackageCurrentLevelPopulationReference =
  | {
      depth: 0;
      kind: "primitive-depth";
      populationHash: ContentHash;
    }
  | {
      depth: number;
      kind: "closed-current-level-fixpoint";
      populationHash: ContentHash;
      levelHash: ContentHash;
      runHash: ContentHash;
    };

export interface PackageCurrentLevelSourceSelection {
  schemaVersion: "1";
  selector: "package-current-level-source-selector-v1";
  scope: "selected-below-depths-plus-previous-current-set-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  sourceDepths: RunConfig["sourceDepths"];
  targetDepth: number;
  round: number;
  availableDepths: number[];
  selectedDepths: number[];
  belowPopulations: PackageCurrentLevelPopulationReference[];
  selectedBelowPopulationHashes: ContentHash[];
  belowElementIds: ElementId[];
  currentElementIds: ElementId[];
  currentPopulationHash: ContentHash;
  elements: Element[];
  elementIds: ElementId[];
  profileClasses: PackageCandidateProfileClass[];
  policy: {
    belowSelection: "run-config-all-below-or-previous-only-v1";
    currentSelection: "previous-round-monotone-current-set-v1";
    duplicateResolution: "canonical-element-id-first-selected-depth-v1";
    profileRepresentative: "lexicographically-smallest-element-id-v1";
  };
  counts: {
    availableBelowPopulations: number;
    selectedBelowPopulations: number;
    belowElements: number;
    currentElements: number;
    selectedElements: number;
    profileClasses: number;
  };
  selectionHash: ContentHash;
}

export interface PackageCurrentLevelCandidateBinding {
  schemaVersion: "1";
  binder: "package-current-level-candidate-binding-v2";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  runConfig: RunConfig & {
    boundedFixpoint: { enabled: true; maxIterations: number };
  };
  targetDepth: number;
  round: number;
  bindingPolicy: {
    sourceSelection: "exact-current-level-source-selection-v1";
    elementAlphabet: "all-selected-element-ids-v1";
    profileAlphabet: "one-hash-per-selected-profile-class-v1";
    skeletonAndDecorationBudgets: "explicit-round-execution-v1";
  };
  sourcePopulation: PackageCurrentLevelSourceSelection;
  enumerationInput: DecoratedCandidateEnumerationInput & {
    graphPolicy: GraphPolicy;
  };
  enumerationOptions: CandidateEnumerationLimits & {
    canonicalizationLimits: GraphCanonicalizationLimits;
  };
  bindingHash: ContentHash;
}

export interface PackageCurrentLevelCandidateEnumerationResult {
  schemaVersion: "1";
  generator: "package-current-level-candidate-generator-v3";
  binding: PackageCurrentLevelCandidateBinding;
  enumeration: CompleteDecoratedCandidateEnumerationResult;
  profileComposition: PackageProfileComposition;
}

export type PackageCurrentLevelCandidateFilterEvaluation = Omit<
  PackageDepthCandidateFilterEvaluation,
  "evaluator"
> & {
  evaluator: "package-current-level-candidate-filter-evaluator-v1";
};

export interface PackageCurrentLevelCandidateCensus {
  schemaVersion: "1";
  evaluator: "package-current-level-candidate-census-evaluator-v1";
  scope: "complete-current-level-round-local-filter-census-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  targetDepth: number;
  round: number;
  sourcePopulationHash: ContentHash;
  dominanceThreshold: 0.9;
  indeterminateThreshold: number;
  generation: PackageCurrentLevelCandidateEnumerationResult;
  candidateEvaluations: PackageCurrentLevelCandidateFilterEvaluation[];
  counts: PackageCandidateCensusCounts;
  booleanSelectivity: number | null;
  indeterminateRatio: number | null;
  interpretation: PackageDepthCandidateCensus["interpretation"];
  census: PackagePredicateCensus[];
  censusHash: ContentHash;
}

export interface PackageCurrentLevelFixpointPolicy {
  initialCurrentPopulation: "empty-v1";
  roundSource: "selected-below-depths-plus-previous-current-set-v1";
  accumulation: "canonical-element-id-monotone-union-v1";
  convergence: "first-round-with-no-new-elements-v1";
  exhaustion: "indeterminate-without-final-population-v1";
  nullModels: "independent-current-round-carrier-v1";
  roundOrder: "ascending-one-based-v1";
}

export interface PackageCurrentLevelRound {
  schemaVersion: "1";
  evaluator: "package-current-level-fixpoint-round-v2";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  targetDepth: number;
  round: number;
  sourceSelectionHash: ContentHash;
  currentBeforeHash: ContentHash;
  currentBeforeElementIds: ElementId[];
  artifacts: {
    census: PackageCurrentLevelCandidateCensus;
    admission: PackageSelectorAdmission;
    formations: PackageSelectedFormations;
    profiles: PackageDerivedProfiles;
    population: PackageDerivedDepthPopulation;
    nullModels?: PackageNullModelExecutionArtifacts;
  };
  baseline: PackageLevelClosure["baseline"];
  addedElementIds: ElementId[];
  currentAfterHash: ContentHash;
  currentAfterElementIds: ElementId[];
  execution: PackageLevelClosureExecution;
  converged: boolean;
  status: "complete" | "indeterminate";
  interpretation:
    | { status: "advanced"; reasons: ["new-elements-added"] }
    | { status: "converged"; reasons: ["no-new-elements"] }
    | {
        status: "indeterminate";
        reasons: Array<
          | "admission-indeterminate"
          | "derived-profile-indeterminate"
          | "population-indeterminate"
          | "baseline-indeterminate"
        >;
      };
  roundHash: ContentHash;
}

export interface PackageCurrentLevelPopulation {
  schemaVersion: "1";
  materializer: "package-current-level-fixpoint-population-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  runConfigHash: ContentHash;
  depth: number;
  depthBasis: BasisHash;
  maxIterations: number;
  fixpointStatus: "converged" | "exhausted" | "round-indeterminate";
  roundHashes: ContentHash[];
  tentativeElements: Array<Element & { kind: "derived" }>;
  tentativeDerivationIndex: Array<{
    elementId: ElementId;
    primaryFormationHash: ContentHash;
    derivations: Array<PackageDerivedDepthDerivation & { fixpointRound: number }>;
  }>;
  elements: Array<Element & { kind: "derived" }>;
  derivationIndex: Array<{
    elementId: ElementId;
    primaryFormationHash: ContentHash;
    derivations: Array<PackageDerivedDepthDerivation & { fixpointRound: number }>;
  }>;
  counts: {
    rounds: number;
    tentativeUniqueElements: number;
    tentativeAlternateDerivations: number;
    uniqueElements: number;
    alternateDerivations: number;
  };
  status: "complete" | "empty" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "empty"; reasons: ["no-materialized-elements"] }
    | {
        status: "indeterminate";
        reasons: [
          "fixpoint-iteration-limit-exhausted" | "fixpoint-round-indeterminate"
        ];
      };
  populationHash: ContentHash;
}

export interface PackageCurrentLevelFixpointClosure {
  schemaVersion: "1";
  closer: "package-current-level-fixpoint-closure-v2";
  scope: "bounded-current-level-monotone-closure-v2";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  run: {
    schemaVersion: "1";
    kernelVersion: string;
    packageId: ContentHash;
    rulesHash: ContentHash;
    depthBasis: BasisHash;
    runConfigHash: ContentHash;
    targetDepth: number;
    belowPopulations: PackageCurrentLevelPopulationReference[];
    roundPolicy: PackageCurrentLevelFixpointPolicy;
    runHash: ContentHash;
  };
  depth: number;
  axisProvenance: AxisProvenance;
  ontologyCoordinate?: OntologyCoordinate;
  priorLevels: Extract<
    PackageCurrentLevelPopulationReference,
    { kind: "closed-current-level-fixpoint" }
  >[];
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  policy: PackageCurrentLevelFixpointPolicy;
  fixpoint: {
    status: "converged" | "exhausted" | "round-indeterminate";
    enabled: true;
    maxIterations: number;
    iterations: number;
    converged: boolean;
    terminalRound: number;
    terminalRoundHash: ContentHash;
  };
  rounds: PackageCurrentLevelRound[];
  artifacts: {
    census: PackageCurrentLevelCandidateCensus;
    admission: PackageSelectorAdmission;
    formations: PackageSelectedFormations;
    profiles: PackageDerivedProfiles;
    population: PackageCurrentLevelPopulation;
    nullModels?: PackageNullModelExecutionArtifacts;
  };
  metrics: Omit<PackageLevelClosure["metrics"], "counts"> & {
    counts: PackageLevelClosureCounts & { tentativeUniqueElements: number };
  };
  baseline: PackageLevelClosure["baseline"];
  execution: {
    policy: "independently-preflighted-per-fixpoint-round-v1";
    executedRounds: number;
    requiredFunctionalEvaluations: number;
    usedFunctionalEvaluations: number;
    requiredPerturbationSamples: number;
    usedPerturbationSamples: number;
    requiredSensitivityFunctionalEvaluations: number;
    usedSensitivityFunctionalEvaluations: number;
  };
  status: "complete" | "empty" | "indeterminate";
  interpretation: PackageCurrentLevelPopulation["interpretation"];
  levelHash: ContentHash;
}

export interface PackageFixpointLadderClosurePolicy {
  levelOrder: "ascending-contiguous-depth-v1";
  sourceSemantics: "run-config-all-below-or-previous-only-plus-current-v1";
  elementIdentity: "minimum-derivation-depth-with-all-appearances-v1";
  termination: "requested-depth-or-no-new-elements-or-indeterminate-v1";
  executionCeilings: "independently-preflighted-per-fixpoint-round-v1";
}

export interface PackageFixpointLadderClosure extends Omit<
  PackageLadderClosure,
  "closer" | "scope" | "policy" | "levels" | "selectivityLadder" |
    "counts" | "execution"
> {
  closer: "package-fixpoint-ladder-closure-v1";
  scope: "bounded-current-level-fixpoint-depth-transitions-v1";
  policy: PackageFixpointLadderClosurePolicy;
  levels: PackageCurrentLevelFixpointClosure[];
  selectivityLadder: Array<{
    depth: number;
    levelHash: ContentHash;
    fixpointStatus: "converged" | "exhausted" | "round-indeterminate";
    iterations: number;
    booleanSelectivity: number | null;
    selectorCensus: PackageSelectorAdmissionCensus[];
  }>;
  counts: PackageLadderClosure["counts"] & { executedRounds: number };
  execution: Omit<PackageLadderClosure["execution"], "policy"> & {
    policy: "independently-preflighted-per-fixpoint-round-v1";
    executedRounds: number;
  };
}

export type PackageAnyLadderClosure =
  | PackageLadderClosure
  | PackageFixpointLadderClosure;

export interface PackageProfileCollapsePolicy {
  commonDomain: "profile-quotient";
  projection: "constituent-profile-hash-canonicalization-v1";
  admittedSet: "final-selected-candidates-v1";
  observables:
    "local-predicate-final-selection-and-selector-score-rank-v1";
  error: "projected-symmetric-difference-over-exact-projected-set-v1";
  counterexample: "lexicographically-smallest-projected-candidate-v1";
}

export interface PackageProfileCollapseObservation {
  localVerdict: PackageCandidateFilterEvaluation["verdict"];
  predicateOutcomes: Array<{
    predicateId: string;
    outcome: PredicateOutcome;
  }>;
  finalOutcome: PackageSelectorAdmissionDecision["outcome"];
  selectorEvaluations: Array<{
    selectorId: string;
    outcome: "selected" | "excluded" | "indeterminate";
    score: Quantity | null;
    rank: number | null;
    sensitivityStatus: "complete" | "not-applicable" | "indeterminate";
    sensitivityVerdict: "robust" | "fragile" | null;
  }>;
}

export interface PackageProfileCollapseSourceObservation {
  sourceCandidateId: ContentHash;
  observation: PackageProfileCollapseObservation;
}

export interface PackageProfileCollapseDomainEntry {
  projectedCandidateId: ContentHash;
  projectedCandidate: Candidate;
  observations: PackageProfileCollapseSourceObservation[];
  admitted: boolean;
  internallyConsistent: boolean;
}

export interface PackageProfileCollapseProjectedCandidate {
  projectedCandidateId: ContentHash;
  projectedCandidate: Candidate;
  elementExact: PackageProfileCollapseDomainEntry | null;
  profileQuotient: PackageProfileCollapseDomainEntry | null;
  crossDomainConsistent: boolean | null;
}

export interface PackageProfileCollapseReport {
  schemaVersion: "1";
  evaluator: "package-profile-collapse-evaluator-v1";
  scope: "bounded-exact-vs-profile-projection-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  requestedDepths: number;
  targetDepth: number;
  policy: PackageProfileCollapsePolicy;
  runs: {
    elementExact: PackageProfileCollapseRun;
    profileQuotient: PackageProfileCollapseRun;
  };
  projectedCandidates: PackageProfileCollapseProjectedCandidate[];
  comparison: {
    elementExact: ContentHash[];
    profileQuotient: ContentHash[];
    intersection: ContentHash[];
    elementExactOnly: ContentHash[];
    profileQuotientOnly: ContentHash[];
    symmetricDifference: ContentHash[];
    counts: {
      elementExact: number;
      profileQuotient: number;
      intersection: number;
      elementExactOnly: number;
      profileQuotientOnly: number;
      symmetricDifference: number;
    };
    collapseError: number | null;
  };
  counterexample: {
    projectedCandidateId: ContentHash;
    kind:
      | "element-exact-only"
      | "profile-quotient-only"
      | "observable-mismatch";
    projectedCandidate: Candidate;
    elementExactObservations: PackageProfileCollapseSourceObservation[];
    profileQuotientObservations: PackageProfileCollapseSourceObservation[];
  } | null;
  verdict: "equivalent" | "counterexample" | "indeterminate";
  status: "complete" | "truncated" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | {
        status: "truncated";
        reasons: ["target-depth-not-executed"];
      }
    | {
        status: "indeterminate";
        reasons: [
          "element-exact-indeterminate" | "profile-quotient-indeterminate"
        ];
      };
  collapseHash: ContentHash;
}

export interface PackageProfileCollapseRun {
  runConfigHash: ContentHash;
  ladderHash: ContentHash;
  levelHash: ContentHash | null;
  ladderStatus: PackageLadderClosure["status"];
  levelStatus: PackageLevelClosure["status"] | null;
}

export interface PackageLevelBoundaryPolicy {
  transitionOrder: "ascending-target-depth-v1";
  intervalMembership: "target-depth-inclusive-v1";
  minima: "within-tie-tolerance-and-maximum-error-v1";
  noIntervals: "report-global-candidate-minima-without-detection-v1";
  declaration: "uniform-coordinate-or-run-ontology-target-v1";
  mutation: "never-rewrite-declared-coordinates-v1";
}

export interface PackageLevelBoundaryPoint {
  fromDepth: number;
  toDepth: number;
  depthBasis: BasisHash;
  collapseHash: ContentHash;
  collapseError: number | null;
  declaredLevelBefore: number | null;
  declaredLevelAfter: number | null;
  declaredBoundary: boolean;
  status: PackageProfileCollapseReport["status"];
  verdict: PackageProfileCollapseReport["verdict"];
  candidateMinimum: boolean;
  detectedBoundary: boolean;
  matchesDeclaration: boolean | null;
}

export interface PackageLevelBoundaryReport {
  schemaVersion: "1";
  detector: "package-level-boundary-detector-v1";
  scope: "bounded-profile-collapse-minima-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  requestedDepths: number;
  runConfigHash: ContentHash;
  policy: PackageLevelBoundaryPolicy;
  detectionPolicy: LevelBoundaryPolicy & { enabled: true };
  comparisonLadders: {
    elementExact: ContentHash;
    profileQuotient: ContentHash;
  };
  points: PackageLevelBoundaryPoint[];
  candidateMinimumDepths: number[];
  detectedDepths: number[];
  declaredDepths: number[];
  status: "complete" | "truncated" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "truncated"; reasons: ["collapse-truncated"] }
    | { status: "indeterminate"; reasons: ["collapse-indeterminate"] };
  notes: string[];
  boundaryHash: ContentHash;
}

export interface PackageCarrierPromotionMaterializationPolicy {
  sourceSelection: "verified-selected-derived-level-elements-v1";
  profileRequirement: "non-empty-deterministic-profile-v1";
  coordinateSemantics: "declared-cross-level-no-source-mutation-v1";
  collapseBasis: "verified-bounded-profile-collapse-v1";
  counterexampleHandling: "explicit-block-or-record-and-promote-v1";
  targetMaterialization: "new-primitive-package-input-v1";
}

export interface PackageCarrierPromotionPolicy {
  schemaVersion: "1";
  targetDepth: number;
  sourceCoordinate: OntologyCoordinate;
  targetCoordinate: OntologyCoordinate;
  targetTypeTags: string[];
  claimRefs: string[];
  evidence: string[];
  counterexampleDisposition: "block" | "record-and-promote";
}

export interface PackageCarrierPromotion {
  schemaVersion: "1";
  sourceElement: ElementId;
  sourceDepth: number;
  sourceCoordinate: OntologyCoordinate;
  sourceCoordinateStatus: "declared-by-policy" | "verified-on-element";
  targetCoordinate: OntologyCoordinate;
  promotedProfile: ProfileHash;
  rulesHash: ContentHash;
  claimRefs: string[];
  evidence: string[];
  collapseHash: ContentHash;
  collapseVerdict: PackageProfileCollapseReport["verdict"];
  targetPrimitive: PrimitiveDefinition & {
    kind: "primitive";
    ontologyCoordinate: OntologyCoordinate;
    axisProvenance: PrimitiveAxisProvenance;
    profile: NormalizedProfile;
  };
  promotionHash: ContentHash;
}

export interface PackageCarrierPromotionSet {
  schemaVersion: "1";
  materializer: "package-carrier-promotion-materializer-v1";
  scope: "verified-ladder-level-to-target-package-input-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  ladderHash: ContentHash;
  sourceLevelHash: ContentHash | null;
  sourcePopulationHash: ContentHash | null;
  collapseBasis: {
    collapseHash: ContentHash;
    status: PackageProfileCollapseReport["status"];
    verdict: PackageProfileCollapseReport["verdict"];
    counterexample: PackageProfileCollapseReport["counterexample"];
  };
  materializationPolicy: PackageCarrierPromotionMaterializationPolicy;
  promotionPolicyHash: ContentHash;
  promotionPolicy: PackageCarrierPromotionPolicy;
  decisions: Array<{
    sourceElement: ElementId;
    profileHash: ProfileHash;
    profileNonEmpty: boolean;
    outcome: "promoted" | "blocked" | "indeterminate";
  }>;
  promotions: PackageCarrierPromotion[];
  counts: {
    sourceElements: number;
    nonEmptyProfiles: number;
    promotedCarriers: number;
    blockedCarriers: number;
    indeterminateCarriers: number;
  };
  status: "complete" | "empty" | "counterexample" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "empty"; reasons: ["no-selected-source-elements"] }
    | {
        status: "counterexample";
        reasons: [
          | "collapse-counterexample-blocked"
          | "collapse-counterexample-recorded-and-accepted"
        ];
      }
    | {
        status: "indeterminate";
        reasons: [
          | "target-depth-not-executed"
          | "source-level-indeterminate"
          | "collapse-indeterminate"
          | "non-empty-profile-required"
        ];
      };
  promotionSetHash: ContentHash;
}

export interface PackageDepthSourceSelectionPolicy {
  availableDepths: "contiguous-zero-through-target-minus-one-v1";
  allBelow: "select-every-available-depth-v1";
  previousOnly: "select-target-minus-one-v1";
  repeatedElement: "minimum-selected-depth-primary-v1";
  profileRepresentative: "lexicographically-smallest-element-id-v1";
}

export type PackageDepthSourcePopulationEntry =
  | {
      depth: 0;
      kind: "primitive-depth";
      populationHash: ContentHash;
      population: PrimitiveDepthPopulation;
    }
  | {
      depth: number;
      kind: "closed-derived-depth";
      populationHash: ContentHash;
      levelHash: ContentHash;
      runHash: ContentHash;
      population: PackageDerivedDepthPopulation & {
        status: "complete";
      };
    };

export interface PackageDepthSourceOccurrence {
  elementId: ElementId;
  minimumDepth: number;
  appearances: Array<{
    depth: number;
    populationHash: ContentHash;
  }>;
}

export interface PackageDepthSourceSelection {
  schemaVersion: "1";
  selector: "package-depth-source-selector-v2";
  scope: "verified-contiguous-closed-depth-source-selection-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  sourceDepths: RunConfig["sourceDepths"];
  targetDepth: number;
  availableDepths: number[];
  selectedDepths: number[];
  policy: PackageDepthSourceSelectionPolicy;
  populations: PackageDepthSourcePopulationEntry[];
  occurrences: PackageDepthSourceOccurrence[];
  elements: Element[];
  elementIds: ElementId[];
  profileClasses: PackageCandidateProfileClass[];
  counts: {
    availablePopulations: number;
    selectedPopulations: number;
    availableElements: number;
    selectedElements: number;
    profileClasses: number;
  };
  selectionHash: ContentHash;
}

export interface PackageDepthCandidateBindingPolicy {
  sourceSelection: "exact-package-depth-source-selection-v1";
  elementAlphabet: "all-selected-element-ids-v1";
  profileAlphabet: "one-hash-per-selected-profile-class-v1";
  skeletonAndDecorationBudgets:
    "reproduced-package-candidate-binding-execution-v1";
}

export interface PackageDepthCandidateBinding {
  schemaVersion: "1";
  binder: "package-depth-candidate-binding-v2";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  runConfig: RunConfig;
  targetDepth: number;
  bindingPolicy: PackageDepthCandidateBindingPolicy;
  sourcePopulation: PackageDepthSourceSelection;
  enumerationInput: DecoratedCandidateEnumerationInput & {
    graphPolicy: GraphPolicy;
  };
  enumerationOptions: CandidateEnumerationLimits & {
    canonicalizationLimits: GraphCanonicalizationLimits;
  };
  bindingHash: ContentHash;
}

export interface PackageDepthCandidateEnumerationResult {
  schemaVersion: "1";
  generator: "package-depth-candidate-generator-v3";
  binding: PackageDepthCandidateBinding;
  enumeration: DecoratedCandidateEnumerationResult;
  profileComposition: PackageProfileComposition;
}

export interface PackageDepthPredicateMonotonicityAudit extends Omit<
  PackagePredicateMonotonicityAudit,
  "auditor" | "scope" | "binding" | "universe"
> {
  auditor: "package-depth-predicate-monotonicity-auditor-v1";
  scope: "complete-depth-aware-canonical-universe-v1";
  binding: PackageDepthCandidateBinding;
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  universe: Omit<PackagePredicateMonotonicityAudit["universe"], "generator"> & {
    generator: "package-depth-candidate-generator-v3";
  };
}

export interface PackageDepthPartialPruningDecision extends Omit<
  PackagePartialPruningDecision,
  "controller"
> {
  controller: "package-depth-partial-pruning-controller-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
}

export interface PackageDepthPartialPruningControllerSession {
  readonly audit: PackageDepthPredicateMonotonicityAudit;
  readonly binding: PackageDepthCandidateBinding;
  readonly kernelVersion: string;
  readonly authorizedPredicateIds: readonly string[];
  evaluate(
    predicateId: string,
    partialGraph: PartialPredicateGraph
  ): PackageDepthPartialPruningDecision;
}

export interface PackageDepthPrunedCandidateGeneration extends Omit<
  PackagePrunedCandidateGeneration,
  "generator" | "binding" | "pruning"
> {
  generator: "package-depth-pruned-candidate-generator-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  binding: PackageDepthCandidateBinding;
  pruning: Omit<PackagePrunedCandidateGeneration["pruning"], "prunedCandidates"> & {
    prunedCandidates: Array<Omit<PackagePrunedCandidateRecord, "decision"> & {
      decision: PackageDepthPartialPruningDecision;
    }>;
  };
}

export interface PackageDepthGeneratorFrontierAudit extends Omit<
  PackageGeneratorFrontierAudit,
  "auditor" | "scope" | "binding"
> {
  auditor: "package-depth-generator-frontier-auditor-v1";
  scope: "complete-depth-aware-raw-edge-group-frontiers-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  binding: PackageDepthCandidateBinding;
}

export interface PackageDepthGeneratorFrontierDecision extends Omit<
  PackageGeneratorFrontierDecision,
  "controller"
> {
  controller: "package-depth-generator-frontier-controller-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
}

export interface PackageDepthGeneratorFrontierControllerSession {
  readonly canonicalAudit: PackageDepthPredicateMonotonicityAudit;
  readonly frontierAudit: PackageDepthGeneratorFrontierAudit;
  readonly binding: PackageDepthCandidateBinding;
  readonly kernelVersion: string;
  readonly preAdmissionAuthorizedPredicateIds: readonly string[];
  readonly authorizedPredicateIds: readonly string[];
  evaluatePreAdmission(
    predicateId: string,
    partialGraph: PartialPredicateGraph
  ): PackageDepthPartialPruningDecision;
  evaluate(
    predicateId: string,
    frontier: PackageGeneratorFrontierInput
  ): PackageDepthGeneratorFrontierDecision;
}

export interface PackageDepthRecursivePrunedCandidateGeneration extends Omit<
  PackageRecursivePrunedCandidateGeneration,
  "generator" | "binding" | "pruning"
> {
  generator: "package-depth-recursive-pruned-candidate-generator-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  binding: PackageDepthCandidateBinding;
  pruning: Omit<
    PackageRecursivePrunedCandidateGeneration["pruning"],
    "prunedFrontiers"
  > & {
    prunedFrontiers: Array<{
      frontierOrdinal: number;
      partialGraph: PartialPredicateGraph;
      decision: PackageDepthGeneratorFrontierDecision;
      profileExtension: PackageProfilePruningExtensionFrontier;
    }>;
  };
}

export interface PackageDepthNodeFrontierAudit extends Omit<
  PackageNodeFrontierAudit,
  "auditor" | "scope" | "binding"
> {
  auditor: "package-depth-node-frontier-auditor-v1";
  scope: "complete-depth-aware-raw-node-prefix-extension-pairs-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  binding: PackageDepthCandidateBinding;
}

export interface PackageDepthNodeFrontierDecision extends Omit<
  PackageNodeFrontierDecision,
  "controller"
> {
  controller: "package-depth-node-frontier-controller-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
}

export interface PackageDepthNodeFrontierControllerSession {
  readonly canonicalAudit: PackageDepthPredicateMonotonicityAudit;
  readonly nodeFrontierAudit: PackageDepthNodeFrontierAudit;
  readonly binding: PackageDepthCandidateBinding;
  readonly kernelVersion: string;
  readonly preAdmissionAuthorizedPredicateIds: readonly string[];
  readonly authorizedPredicateIds: readonly string[];
  evaluatePreAdmission(
    predicateId: string,
    partialGraph: PartialPredicateGraph
  ): PackageDepthPartialPruningDecision;
  evaluate(
    predicateId: string,
    frontier: PackageNodeFrontierInput
  ): PackageDepthNodeFrontierDecision;
}

export interface PackageDepthNodeGrowthPrunedCandidateGeneration extends Omit<
  PackageNodeGrowthPrunedCandidateGeneration,
  "generator" | "binding" | "pruning"
> {
  generator: "package-depth-node-growth-pruned-candidate-generator-v1";
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  binding: PackageDepthCandidateBinding;
  pruning: Omit<
    PackageNodeGrowthPrunedCandidateGeneration["pruning"],
    "prunedNodeFrontiers"
  > & {
    prunedNodeFrontiers: Array<{
      frontierOrdinal: number;
      partialGraph: PartialPredicateGraph;
      decision: PackageDepthNodeFrontierDecision;
      profileExtension: PackageProfilePruningExtensionFrontier;
    }>;
  };
}

export type PackageDepthCandidateFilterEvaluation = Omit<
  PackageCandidateFilterEvaluation,
  "evaluator" | "formation"
> & {
  evaluator: "package-depth-candidate-filter-evaluator-v1";
  formation: Omit<
    PackageCandidateFilterEvaluation["formation"],
    "targetDepth"
  > & {
    targetDepth: number;
  };
};

export interface PackageDepthCandidateCensus {
  schemaVersion: "1";
  evaluator: "package-depth-candidate-census-evaluator-v1";
  scope: "complete-depth-aware-local-filter-census-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  bindingHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  dominanceThreshold: 0.9;
  indeterminateThreshold: number;
  generation: PackageDepthCandidateEnumerationResult;
  candidateEvaluations: PackageDepthCandidateFilterEvaluation[];
  counts: PackageCandidateCensusCounts;
  booleanSelectivity: number | null;
  indeterminateRatio: number | null;
  interpretation:
    | { status: "valid"; reasons: [] }
    | { status: "empty"; reasons: ["no-evaluated-candidates"] }
    | {
        status: "indeterminate";
        reasons: ["indeterminate-ratio-exceeds-threshold"];
      };
  census: PackagePredicateCensus[];
  censusHash: ContentHash;
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

export interface PackageNullModelPlanOptions
  extends PackageCandidateExecutionOptions {
  maxNullTrials?: number;
}

export interface PackageNullModelCarrierPopulation {
  kind: "complete-canonical-candidate-census-v1";
  bindingHash: ContentHash;
  censusHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  targetDepth: number;
  sourcePopulationHash: ContentHash;
  candidateIds: CandidateId[];
  carrierHash: ContentHash;
  runConfigHash: ContentHash;
}

export interface PackageNullModelContract {
  model: NullModelId;
  proposal:
    | "uniform-edge-role-multiset-permutation-v1"
    | "role-wise-directed-degree-preserving-valid-swap-v1"
    | "exact-uniform-index-from-finite-canonical-universe-v1";
  sampling:
    | "candidate-wise-fisher-yates-v1"
    | "uniform-same-role-edge-pair-v1"
    | "independent-with-replacement-v1";
  population:
    | "one-proposal-per-carrier-candidate-v1"
    | "carrier-size-proposals-v1";
  mixing?: {
    swap: "directed-target-swap-v1";
    attemptsPerEdge: 10;
    minimumWhenEligible: 1;
    invalidProposal: "reject-and-retain-current-v1";
  };
  preserves: string[];
}

export interface PackageNullModelTrial {
  model: NullModelId;
  trialIndex: number;
  streamHash: ContentHash;
  carrierHash: ContentHash;
  trialId: ContentHash;
}

export interface PackageNullModelPlan {
  schemaVersion: "1";
  planner: "package-null-model-plan-v1";
  packageId: ContentHash;
  rulesHash: ContentHash;
  depthBasis: BasisHash;
  runConfigHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  ontologyGate:
    | {
        kind: "derivation-depth-target-v1";
        targetDepth: number;
      }
    | {
        kind: "run-ontology-target-v1";
        targetDepth: number;
        ontologyCoordinate: OntologyCoordinate;
      };
  carrierPopulation: PackageNullModelCarrierPopulation;
  randomnessPolicy: {
    streamDerivation: "run-seed-model-trial-domain-hash-v1";
    streamIndependence: "model-and-trial-order-independent-v1";
    drawExpansion: "sha256-counter-rejection-sampling-v1";
  };
  executionRequirements: {
    localPredicates: "rerun-every-candidate-v1";
    cohorts: "reconstruct-total-partition-per-trial-v1";
    functionals: "reevaluate-every-cohort-member-v1";
    selectors: "rerank-and-readmit-per-trial-v1";
    evidence: "recompute-invalidated-or-indeterminate-v1";
    pooling: "never-across-ontology-gates-or-carrier-populations-v1";
  };
  modelContracts: PackageNullModelContract[];
  trials: PackageNullModelTrial[];
  counts: {
    models: number;
    trialsPerModel: number;
    totalTrials: number;
    carrierCandidates: number;
  };
  status: "planned" | "not-run";
  interpretation:
    | {
        status: "planned";
        reasons: ["trial-execution-and-metric-distributions-pending"];
      }
    | { status: "not-run"; reasons: ["null-models-disabled"] };
  planHash: ContentHash;
}

export interface PackageNullModelProposalOptions
  extends PackageNullModelPlanOptions {
  maxProposalOccurrences?: number;
  maxProposalOperations?: number;
}

export type PackageNullModelProposalOperation =
  | {
      kind: "role-shuffle";
      algorithm: "fisher-yates-uniform-v1";
      randomDraws: number;
      edgeRoles: number;
      changed: boolean;
    }
  | {
      kind: "degree-rewire";
      algorithm: "role-wise-directed-target-swap-v1";
      randomDraws: number;
      eligibleEdgePairs: number;
      attemptedSwaps: number;
      acceptedSwaps: number;
      rejectedSwaps: number;
      acceptanceRatio: number | null;
      mixingStatus: "not-applicable" | "unmixed" | "mixed";
      changed: boolean;
    }
  | {
      kind: "uniform";
      algorithm: "exact-uniform-carrier-index-v1";
      replacement: "with-replacement";
      frameSize: number;
      frameIndex: number;
      randomDraws: number;
      changed: boolean;
    };

export interface PackageNullModelProposalOccurrence {
  occurrenceIndex: number;
  sourceCandidateId: CandidateId;
  candidateId: CandidateId;
  candidate: Candidate;
  operation: PackageNullModelProposalOperation;
}

export interface PackageNullModelTrialProposals {
  trialId: ContentHash;
  model: NullModelId;
  streamHash: ContentHash;
  occurrences: PackageNullModelProposalOccurrence[];
  counts: {
    occurrences: number;
    changed: number;
    randomDraws: number;
    attemptedSwaps: number;
    acceptedSwaps: number;
    rejectedSwaps: number;
  };
  trialProposalHash: ContentHash;
}

export interface PackageNullModelProposals {
  schemaVersion: "1";
  proposer: "package-null-model-proposals-v1";
  planHash: ContentHash;
  packageId: ContentHash;
  rulesHash: ContentHash;
  runConfigHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  carrierHash: ContentHash;
  policy: {
    occurrencePopulation: "carrier-size-per-trial-v1";
    occurrenceIdentity: "source-ordinal-and-proposed-candidate-v1";
    membership: "verified-complete-carrier-v1";
    canonicalization: "bound-run-graph-policy-v1";
    roleShuffle: "candidate-wise-fisher-yates-v1";
    degreeRewire: "ten-directed-target-swaps-per-edge-v1";
    uniform: "independent-carrier-index-with-replacement-v1";
  };
  trials: PackageNullModelTrialProposals[];
  counts: PackageNullModelTrialProposals["counts"] & { trials: number };
  status: "complete" | "not-run";
  interpretation:
    | {
        status: "proposal-complete";
        reasons: ["trial-evaluation-and-distributions-pending"];
      }
    | { status: "not-run"; reasons: ["null-models-disabled"] };
  proposalsHash: ContentHash;
}

export interface PackageNullModelTrialOccurrenceEvaluation {
  trialId: ContentHash;
  occurrenceIndex: number;
  sourceCandidateId: CandidateId;
  candidateId: CandidateId;
  occurrenceId: ContentHash;
  filter: PackageCandidateFilterEvaluation | PackageDepthCandidateFilterEvaluation;
}

export interface PackageNullModelTrialCensus {
  trialId: ContentHash;
  model: NullModelId;
  trialProposalHash: ContentHash;
  occurrenceEvaluations: PackageNullModelTrialOccurrenceEvaluation[];
  counts: {
    evaluatedOccurrences: number;
    predicateRejected: number;
    filterIndeterminate: number;
    eligible: number;
  };
  booleanSelectivity: number | null;
  indeterminateRatio: number | null;
  interpretation:
    | { status: "valid"; reasons: [] }
    | { status: "empty"; reasons: ["no-evaluated-occurrences"] }
    | {
        status: "indeterminate";
        reasons: ["indeterminate-ratio-exceeds-threshold"];
      };
  predicateCensus: PackagePredicateCensus[];
  trialCensusHash: ContentHash;
}

export interface PackageNullModelTrialCensuses {
  schemaVersion: "1";
  evaluator: "package-null-model-trial-censuses-v1";
  scope: "complete-occurrence-local-filter-replay-v1";
  proposalsHash: ContentHash;
  packageId: ContentHash;
  rulesHash: ContentHash;
  runConfigHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  carrierHash: ContentHash;
  indeterminateThreshold: number;
  trials: PackageNullModelTrialCensus[];
  counts: {
    trials: number;
    evaluatedOccurrences: number;
    predicateRejected: number;
    filterIndeterminate: number;
    eligible: number;
    validTrials: number;
    emptyTrials: number;
    indeterminateTrials: number;
  };
  status: "complete" | "not-run";
  interpretation:
    | {
        status: "local-census-complete";
        reasons: ["cohorts-functionals-selectors-and-distributions-pending"];
      }
    | { status: "not-run"; reasons: ["null-models-disabled"] };
  trialCensusesHash: ContentHash;
}

export interface PackageNullModelTrialSelectionOptions
  extends PackageNullModelProposalOptions,
    PackageSelectorSensitivityOptions {}

export interface PackageNullModelTrialSelectionPolicy {
  memberIdentity: "trial-occurrence-id-v1";
  duplicateCandidates: "retain-as-distinct-occurrences-v1";
  cohortKeys: "recompute-on-proposed-candidate-per-trial-v1";
  functionalValues: "recompute-every-occurrence-per-selector-v1";
  selectorAdmission: "rerank-and-readmit-per-trial-v1";
  sensitivity: "repeat-declared-complete-sweep-per-trial-v1";
  nodeInternalQuantities: "fixed-unless-randomized-by-model-v1";
  derivedEvidence: "recompute-with-functional-or-mark-indeterminate-v1";
}

export interface PackageNullModelTrialMetricInterpretation {
  booleanSelectivity: {
    status: "valid" | "empty" | "indeterminate";
    reasons: string[];
  };
  variationalSelectivity: Record<
    string,
    PackageSelectorAdmissionCensus["interpretation"]
  >;
  selectionRetention: {
    status: "valid" | "empty" | "indeterminate";
    reasons: string[];
  };
  overallRetention: {
    status: "valid" | "empty" | "indeterminate";
    reasons: string[];
  };
  indeterminateRatio: {
    status: "valid" | "empty" | "indeterminate";
    reasons: string[];
  };
}

export interface PackageNullModelTrialSelection {
  trialId: ContentHash;
  model: NullModelId;
  trialCensusHash: ContentHash;
  memberIdentity: "trial-occurrence-id-v1";
  selectorExecutions: PackageSelectorExecution[];
  admission: PackageSelectorAdmission;
  selectedOccurrenceIds: ContentHash[];
  metrics: {
    booleanSelectivity: number | null;
    variationalSelectivity: Record<string, number | null>;
    selectionRetention: number | null;
    overallRetention: number | null;
    indeterminateRatio: number | null;
  };
  metricInterpretation: PackageNullModelTrialMetricInterpretation;
  counts: {
    evaluatedOccurrences: number;
    predicateRejected: number;
    filterIndeterminate: number;
    eligible: number;
    selectorExcluded: number;
    selectionIndeterminate: number;
    selected: number;
    finalIndeterminate: number;
    baseFunctionalEvaluations: number;
    sensitivityFunctionalEvaluations: number;
  };
  status: PackageSelectorAdmission["status"];
  interpretation: PackageSelectorAdmission["interpretation"];
  trialSelectionHash: ContentHash;
}

export interface PackageNullModelTrialSelections {
  schemaVersion: "1";
  evaluator: "package-null-model-trial-selections-v1";
  scope: "complete-occurrence-cohort-functional-selector-replay-v1";
  trialCensusesHash: ContentHash;
  packageId: ContentHash;
  rulesHash: ContentHash;
  runConfigHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  carrierHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  selectionPolicy: PackageNullModelTrialSelectionPolicy;
  selectorOrder: string[];
  trials: PackageNullModelTrialSelection[];
  counts: {
    trials: number;
    completeTrials: number;
    emptyTrials: number;
    indeterminateTrials: number;
    evaluatedOccurrences: number;
    selectedOccurrences: number;
    baseFunctionalEvaluations: number;
    sensitivityFunctionalEvaluations: number;
  };
  execution: {
    maxFunctionalEvaluations: number;
    maxSensitivityFunctionalEvaluations: number;
    preflight: {
      eligibleOccurrences: number;
      requiredBaseFunctionalEvaluations: number;
      requiredSensitivityVariantsPerTrial: number | `${bigint}`;
      sensitivityEvaluationUpperBound: number | `${bigint}`;
    };
  };
  status: "complete" | "not-run";
  interpretation:
    | {
        status: "trial-selection-complete";
        reasons: ["metric-distributions-and-baseline-interpretation-pending"];
      }
    | { status: "not-run"; reasons: ["null-models-disabled"] };
  trialSelectionsHash: ContentHash;
}

export type PackageNullModelBaselineOptions =
  PackageNullModelTrialSelectionOptions;

export interface PackageNullModelMetricState {
  value: number | null;
  status: "valid" | "empty" | "indeterminate" | "fragile" | "not-applicable";
  reasons: string[];
}

export interface PackageNullModelDistributionSummary {
  model: NullModelId;
  metricId: string;
  expectedSamples: number;
  availableSamples: number;
  mean: number | null;
  sd: number | null;
  z: number | null;
  constantRelation: "equal" | "different" | "observed-unavailable" | null;
  status: "complete" | "fragile" | "indeterminate";
  notes: string[];
  sampleTrialIds: ContentHash[];
  distributionHash: ContentHash;
}

export interface PackageNullModelBaselineResult {
  status: "complete" | "indeterminate";
  runs: number;
  metrics: {
    booleanSelectivity: PackageNullModelDistributionSummary;
    variationalSelectivity: Record<
      string,
      PackageNullModelDistributionSummary
    >;
    selectionRetention: PackageNullModelDistributionSummary;
    overallRetention: PackageNullModelDistributionSummary;
    indeterminateRatio: PackageNullModelDistributionSummary;
  };
  samplesArtifact: ContentHash;
  notes: string[];
}

export interface PackageNullModelBaseline {
  schemaVersion: "1";
  evaluator: "package-null-model-baseline-v1";
  scope: "per-model-complete-trial-metric-distributions-v1";
  trialSelectionsHash: ContentHash;
  packageId: ContentHash;
  rulesHash: ContentHash;
  runConfigHash: ContentHash;
  bindingHash: ContentHash;
  censusHash: ContentHash;
  carrierHash: ContentHash;
  countingDomain: Exclude<CandidateDomain, "single-candidate">;
  distributionPolicy: {
    pooling: "never-across-models-carriers-or-ontology-gates-v1";
    sampleOrder: "trial-id-v1";
    mean: "compensated-binary64-fixed-order-v1";
    standardDeviation: "sample-n-minus-one-compensated-binary64-v1";
    standardizedEffect: "observed-minus-null-mean-over-sample-sd-v1";
    missingSample: "invalidate-without-denominator-reduction-v1";
    zeroVariance: "null-z-with-observed-constant-relation-v1";
  };
  observed: {
    censusHash: ContentHash;
    admissionHash: ContentHash;
    metrics: {
      booleanSelectivity: PackageNullModelMetricState;
      variationalSelectivity: Record<string, PackageNullModelMetricState>;
      selectionRetention: PackageNullModelMetricState;
      overallRetention: PackageNullModelMetricState;
      indeterminateRatio: PackageNullModelMetricState;
    };
  };
  models: Partial<Record<NullModelId, PackageNullModelBaselineResult>>;
  counts: {
    models: number;
    completeModels: number;
    indeterminateModels: number;
    trials: number;
  };
  status: "complete" | "not-run" | "indeterminate";
  interpretation:
    | { status: "complete"; reasons: [] }
    | { status: "not-run"; reasons: ["null-models-disabled"] }
    | {
        status: "indeterminate";
        reasons: ["one-or-more-model-metrics-uninterpretable"];
      };
  baselineHash: ContentHash;
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
  "ARTIFACT" | "CANDIDATE" |
  "CANDIDATE_RESUME_CHECKPOINT" | "CANDIDATE_RESUME_INPUT" |
  "CANDIDATE_RESUME_STEP" | "CANDIDATE_RESUME_TRANSCRIPT" |
  "CLUSTER" | "COHORT" | "COHORT_RESOURCE" |
  "DEPTH_BASIS" | "DEPTH_POPULATION" | "DERIVED_PROFILE_EXTRACTION" | "ELEMENT" |
  "PREDICATE_EXPRESSION" | "PREDICATE_EXPRESSION_ANALYSIS" | "PREDICATE_GRAPH_EVALUATION" |
  "PREDICATE_LOCAL_EVALUATION" |
  "PERTURBATION_CONTEXT" | "PERTURBATION_SAMPLE_DRAW" |
  "PREDICATE_NUMERIC_BINDING" | "PREDICATE_PLAN" | "PARTIAL_PREDICATE_EVALUATION" |
  "PARTIAL_PREDICATE_GRAPH" |
  "VALUE_EXPRESSION" | "VALUE_EXPRESSION_ANALYSIS" | "IDENTITY_POLICY" |
  "PACKAGE_LEVEL_RESULT" | "PACKAGE_LEVEL_EXPLANATION_INDEX" |
  "PACKAGE_LEVEL_RESULT_CENSUS" | "PACKAGE_LEVEL_CANDIDATE_EXPLANATION" |
  "PACKAGE_NULL_MODEL_BASELINE" | "PACKAGE_NULL_MODEL_DISTRIBUTION" |
  "PACKAGE_NULL_MODEL_CARRIER" | "PACKAGE_NULL_MODEL_DRAW" |
  "PACKAGE_NULL_MODEL_OCCURRENCE" | "PACKAGE_NULL_MODEL_PLAN" |
  "PACKAGE_NULL_MODEL_PROPOSALS" | "PACKAGE_NULL_MODEL_STREAM" |
  "PACKAGE_NULL_MODEL_TRIAL" | "PACKAGE_NULL_MODEL_TRIAL_CENSUS" |
  "PACKAGE_NULL_MODEL_TRIAL_CENSUSES" |
  "PACKAGE_NULL_MODEL_TRIAL_PROPOSAL" |
  "PACKAGE_NULL_MODEL_TRIAL_SELECTION" |
  "PACKAGE_NULL_MODEL_TRIAL_SELECTIONS" |
  "PACKAGE_RUN_BUNDLE_INPUT" | "PACKAGE_RUN_SEMANTIC_MANIFEST" |
  "PACKAGE_RUN_ARTIFACT_MATERIALIZATION" |
  "PACKAGE_RUN_ARTIFACT_BUNDLE" | "PACKAGE_RUN_ARTIFACT_STORE" |
  "PACKAGE_RUN_CANDIDATE_EXPLANATION" | "PACKAGE_LADDER_RESULT" |
  "CARRIER_PROMOTION" | "CARRIER_PROMOTION_POLICY" |
  "PACKAGE_CARRIER_PROMOTIONS" |
  "PACKAGE_PROFILE_COLLAPSE" | "PACKAGE_LEVEL_BOUNDARY_REPORT" |
  "PACKAGE_PROFILE_COMPOSITION" |
  "PACKAGE_PROFILE_COMPOSITION_DECISION" |
  "PACKAGE_PROFILE_PRUNING_EXTENSION_UNIVERSE" |
  "PACKAGE_PROFILE_EDGE_FRONTIER_KEY" |
  "PACKAGE_PROFILE_EDGE_FRONTIER_CENSUS" |
  "PACKAGE_PROFILE_NODE_FRONTIER_KEY" |
  "PACKAGE_PROFILE_NODE_FRONTIER_CENSUS" |
  "ORACLE_REQUEST" | "ORACLE_RESPONSE" | "ORACLE_VALIDATION" |
  "PACKAGE" | "PACKAGE_CANDIDATE_BINDING" | "PACKAGE_CANDIDATE_CENSUS" |
  "PACKAGE_CANDIDATE_FILTER" | "PACKAGE_COHORT_PARTITION" |
  "PACKAGE_PRUNING_AUDIT" | "PACKAGE_PRUNING_AUDIT_SAMPLE" |
  "PACKAGE_PRUNING_AUDIT_UNIVERSE" | "PACKAGE_PRUNING_DECISION" |
  "PACKAGE_PRUNED_CANDIDATE_GENERATION" | "PACKAGE_PRUNING_TRANSCRIPT" |
  "PACKAGE_PRUNING_RESULT_SET" |
  "PACKAGE_GENERATOR_FRONTIER_AUDIT" |
  "PACKAGE_GENERATOR_FRONTIER_AUDIT_SAMPLE" |
  "PACKAGE_GENERATOR_FRONTIER_FRAME" |
  "PACKAGE_GENERATOR_FRONTIER_DECISION" |
  "PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATION" |
  "PACKAGE_RECURSIVE_PRUNING_TRANSCRIPT" |
  "PACKAGE_NODE_FRONTIER_AUDIT" |
  "PACKAGE_NODE_FRONTIER_AUDIT_SAMPLE" |
  "PACKAGE_NODE_FRONTIER_FRAME" |
  "PACKAGE_NODE_FRONTIER_DECISION" |
  "PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION" |
  "PACKAGE_NODE_GROWTH_PRUNING_TRANSCRIPT" |
  "PACKAGE_DEPTH_CANDIDATE_BINDING" | "PACKAGE_DEPTH_CANDIDATE_CENSUS" |
  "PACKAGE_DEPTH_CANDIDATE_FILTER" |
  "PACKAGE_DEPTH_PRUNING_AUDIT" | "PACKAGE_DEPTH_PRUNING_AUDIT_SAMPLE" |
  "PACKAGE_DEPTH_PRUNING_AUDIT_UNIVERSE" |
  "PACKAGE_DEPTH_PRUNING_DECISION" |
  "PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATION" |
  "PACKAGE_DEPTH_PRUNING_TRANSCRIPT" |
  "PACKAGE_DEPTH_PRUNING_RESULT_SET" |
  "PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT" |
  "PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SAMPLE" |
  "PACKAGE_DEPTH_GENERATOR_FRONTIER_FRAME" |
  "PACKAGE_DEPTH_GENERATOR_FRONTIER_DECISION" |
  "PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATION" |
  "PACKAGE_DEPTH_RECURSIVE_PRUNING_TRANSCRIPT" |
  "PACKAGE_DEPTH_NODE_FRONTIER_AUDIT" |
  "PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SAMPLE" |
  "PACKAGE_DEPTH_NODE_FRONTIER_FRAME" |
  "PACKAGE_DEPTH_NODE_FRONTIER_DECISION" |
  "PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION" |
  "PACKAGE_DEPTH_NODE_GROWTH_PRUNING_TRANSCRIPT" |
  "PACKAGE_DEPTH_SOURCE_SELECTION" |
  "PACKAGE_FIXPOINT_CANDIDATE_BINDING" |
  "PACKAGE_FIXPOINT_CANDIDATE_CENSUS" |
  "PACKAGE_FIXPOINT_CANDIDATE_FILTER" |
  "PACKAGE_FIXPOINT_CURRENT_STATE" |
  "PACKAGE_FIXPOINT_LADDER_RESULT" |
  "PACKAGE_FIXPOINT_LEVEL_RESULT" |
  "PACKAGE_FIXPOINT_POPULATION" |
  "PACKAGE_FIXPOINT_ROUND" |
  "PACKAGE_FIXPOINT_SOURCE_SELECTION" |
  "PACKAGE_DERIVED_PROFILES" |
  "PACKAGE_FUNCTIONAL_EVALUATION" | "PACKAGE_SELECTOR_RANKING" |
  "PACKAGE_SELECTOR_ADMISSION" | "PACKAGE_SELECTED_FORMATIONS" |
  "PACKAGE_SELECTOR_SENSITIVITY" | "PACKAGE_SELECTOR_SENSITIVITY_VARIANT" |
  "PROFILE" | "PROFILE_SLOT_GUARD" | "PROFILE_SLOT_GUARD_EVALUATION" |
  "RUN" | "RUN_CONFIG" | "RULES" | "SELECTED_FORMATION" | "SKELETON" |
  "SOURCE_CLASSIFICATION_ADJUDICATION" | "SOURCE_CLASSIFICATION_ANNOTATIONS" |
  "SOURCE_CLASSIFICATION_DECISION" | "SOURCE_CLASSIFICATION_AMENDMENT" |
  "SOURCE_CLASSIFICATION_AMENDMENTS" |
  "SOURCE_CLASSIFICATION_POLICY" | "SOURCE_CLASSIFICATION_VIEW" |
  "SOURCE_CLASSIFIED_RELATIONS" | "SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS" |
  "SOURCE_SCC_COMPONENT" |
  "SOURCE_NODE_RESOLUTION_POLICY" | "SOURCE_NODE_RESOLUTION" |
  "SOURCE_RESOLUTION_VERTEX" | "SOURCE_CONDENSATION" |
  "SOURCE_MIGRATION_RECONCILIATION" | "SOURCE_MIGRATION_RISK_POLICY" |
  "SOURCE_MIGRATION_METRICS" | "SOURCE_MIGRATION_EXPLANATION_INDEX" |
  "SOURCE_MIGRATION_EXPLANATION" |
  "SOURCE_CLUSTER_CONCENTRATION_DEFINITION" |
  "SOURCE_CLUSTER_CONCENTRATION" | "SUBSTRUCTURE",
  string
>>;
export function hashBytes(domain: string, bytes: Uint8Array): ContentHash;
export function hashArtifactBytes(bytes: Uint8Array): ContentHash;
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
export const DECORATED_CANDIDATE_ENUMERATOR_VERSION: "decorated-candidate-enumerator-v5";
export const DEFAULT_CANDIDATE_ENUMERATION_LIMITS: Readonly<CandidateEnumerationLimits>;
export function enumerateDecoratedCandidates(
  input: DecoratedCandidateEnumerationInput,
  options?: Partial<CandidateEnumerationLimits> & {
    canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
  }
): DecoratedCandidateEnumerationResult;
export const RESUMABLE_CANDIDATE_ENUMERATOR_VERSION:
  "resumable-decorated-candidate-enumerator-v1";
export const RESUMABLE_CANDIDATE_ENUMERATION_POLICY: Readonly<
  ResumableCandidateEnumerationStep["policy"]
>;
export const RESUMABLE_CANDIDATE_ENUMERATION_LIMITS: Readonly<{
  maxRawCandidatesPerStep: 1000000;
}>;
export function advanceDecoratedCandidateEnumeration(
  input: DecoratedCandidateEnumerationInput,
  enumerationOptions?: Partial<CandidateEnumerationLimits> & {
    canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
  },
  resumeOptions?: ResumableCandidateEnumerationOptions
): ResumableCandidateEnumerationStep;
export function verifyDecoratedCandidateEnumerationStep(
  artifact: ResumableCandidateEnumerationStep,
  input: DecoratedCandidateEnumerationInput,
  enumerationOptions?: Partial<CandidateEnumerationLimits> & {
    canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
  },
  resumeOptions?: ResumableCandidateEnumerationOptions
): ResumableCandidateEnumerationStep;

export const RUN_CONFIG_NORMALIZER_VERSION: "run-config-normalizer-v2";
export const DEFAULT_PROFILE_COMPOSITION_POLICY: "post-admission-v1";
export const DEFAULT_RUN_BUDGET: Readonly<RunBudget>;
export function normalizeRunConfig(input: RunConfigInput): Readonly<RunConfig>;

export const PRIMITIVE_DEPTH_POPULATION_VERSION: "primitive-depth-population-v1";
export function materializePrimitiveDepthPopulation(
  loadedPackage: LoadedRulePackage,
  options?: LoadedPackageVerificationOptions
): PrimitiveDepthPopulation;

export const PACKAGE_CANDIDATE_BINDER_VERSION: "package-candidate-binding-v2";
export const PACKAGE_CANDIDATE_GENERATOR_VERSION: "package-candidate-generator-v5";
export const PACKAGE_PROFILE_COMPOSITION_VERSION:
  "package-profile-composition-gate-v1";
export const PACKAGE_PROFILE_COMPOSITION_POLICY:
  Readonly<PackageProfileCompositionPolicy>;
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
export const PACKAGE_PREDICATE_MONOTONICITY_AUDITOR_VERSION:
  "package-predicate-monotonicity-auditor-v1";
export const PACKAGE_PARTIAL_PRUNING_CONTROLLER_VERSION:
  "package-partial-pruning-controller-v1";
export const PACKAGE_PREDICATE_MONOTONICITY_AUDIT_SCOPE:
  "complete-depth-one-canonical-universe-v1";
export const PACKAGE_PREDICATE_MONOTONICITY_AUDIT_POLICY:
  Readonly<PackagePredicateMonotonicityAudit["policy"]>;
export const DEFAULT_PACKAGE_PREDICATE_MONOTONICITY_AUDIT_LIMITS: Readonly<{
  samplesPerPredicate: 200;
  maxSamplesPerPredicate: 10000;
  maxStreamDraws: 1024;
}>;
export function auditPackagePredicateMonotonicity(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackagePredicateMonotonicityAuditOptions
): PackagePredicateMonotonicityAudit;
export function verifyPackagePredicateMonotonicityAudit(
  audit: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackagePredicateMonotonicityAuditOptions
): PackagePredicateMonotonicityAudit;
export function authorizePackagePartialPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  audit: PackagePredicateMonotonicityAudit,
  predicateId: string,
  partialGraph: PartialPredicateGraph,
  options?: PackagePredicateMonotonicityAuditOptions
): PackagePartialPruningDecision;
export function createPackagePartialPruningControllerSession(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  audit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackagePartialPruningControllerSession;
export const PACKAGE_GENERATOR_FRONTIER_AUDITOR_VERSION:
  "package-generator-frontier-auditor-v1";
export const PACKAGE_GENERATOR_FRONTIER_CONTROLLER_VERSION:
  "package-generator-frontier-controller-v1";
export const PACKAGE_GENERATOR_FRONTIER_AUDIT_SCOPE:
  "complete-depth-one-raw-edge-group-frontiers-v1";
export const PACKAGE_GENERATOR_FRONTIER_AUDIT_POLICY:
  Readonly<PackageGeneratorFrontierAudit["policy"]>;
export function auditPackageGeneratorFrontiers(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageGeneratorFrontierAudit;
export function verifyPackageGeneratorFrontierAudit(
  audit: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageGeneratorFrontierAudit;
export function createPackageGeneratorFrontierControllerSession(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  frontierAudit: PackageGeneratorFrontierAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageGeneratorFrontierControllerSession;
export const PACKAGE_PRUNED_CANDIDATE_GENERATOR_VERSION:
  "package-pruned-candidate-generator-v1";
export const PACKAGE_CANDIDATE_PRUNING_STRATEGY:
  "canonical-candidate-prefix-pre-admission-v1";
export function enumeratePackageCandidatesWithPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  audit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackagePrunedCandidateGeneration;
export function verifyPackageCandidatesWithPruning(
  artifact: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  audit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackagePrunedCandidateGeneration;
export const PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION:
  "package-recursive-pruned-candidate-generator-v1";
export const PACKAGE_RECURSIVE_PRUNING_STRATEGY:
  "audited-edge-group-subtree-pruning-v1";
export function enumeratePackageCandidatesWithRecursivePruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  frontierAudit: PackageGeneratorFrontierAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageRecursivePrunedCandidateGeneration;
export function verifyPackageCandidatesWithRecursivePruning(
  artifact: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  frontierAudit: PackageGeneratorFrontierAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageRecursivePrunedCandidateGeneration;
export const PACKAGE_NODE_FRONTIER_AUDITOR_VERSION:
  "package-node-frontier-auditor-v1";
export const PACKAGE_NODE_FRONTIER_CONTROLLER_VERSION:
  "package-node-frontier-controller-v1";
export const PACKAGE_NODE_FRONTIER_AUDIT_SCOPE:
  "complete-depth-one-raw-node-prefix-extension-pairs-v1";
export const PACKAGE_NODE_FRONTIER_AUDIT_POLICY:
  Readonly<PackageNodeFrontierAudit["policy"]>;
export function auditPackageNodeFrontiers(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageNodeFrontierAudit;
export function verifyPackageNodeFrontierAudit(
  audit: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageNodeFrontierAudit;
export function createPackageNodeFrontierControllerSession(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  nodeFrontierAudit: PackageNodeFrontierAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageNodeFrontierControllerSession;
export function authorizePackageNodeFrontierPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  nodeFrontierAudit: PackageNodeFrontierAudit,
  predicateId: string,
  frontier: PackageNodeFrontierInput,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageNodeFrontierDecision;
export const PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION:
  "package-node-growth-pruned-candidate-generator-v1";
export const PACKAGE_NODE_GROWTH_PRUNING_STRATEGY:
  "audited-node-assignment-subtree-pruning-v1";
export function enumeratePackageCandidatesWithNodeGrowthPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  nodeFrontierAudit: PackageNodeFrontierAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageNodeGrowthPrunedCandidateGeneration;
export function verifyPackageCandidatesWithNodeGrowthPruning(
  artifact: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  canonicalAudit: PackagePredicateMonotonicityAudit,
  nodeFrontierAudit: PackageNodeFrontierAudit,
  options?: PackagePredicateMonotonicityAuditOptions
): PackageNodeGrowthPrunedCandidateGeneration;
export const PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION:
  "package-candidate-filter-evaluator-v20";
export function evaluatePackageCandidateFilter(
  loadedPackage: LoadedRulePackage,
  binding: PackageCandidateBinding,
  candidate: CandidateInput,
  options?: LoadedPackageVerificationOptions
): PackageCandidateFilterEvaluation;
export const PACKAGE_FUNCTIONAL_EVALUATOR_VERSION:
  "package-functional-evaluator-v1";
export const PROFILE_INVARIANT_AGGREGATION_POLICY:
  "arithmetic-mean-conservative-v1";
export const PROFILE_INVARIANT_UNCERTAINTY_POLICY:
  "mean-effective-bounds-plus-rounding-v1";
export const PROFILE_INVARIANT_PROVENANCE_METHOD:
  "profile-invariant-arithmetic-mean-v1";
export const FUNCTIONAL_EXPRESSION_METHOD: "finite-functional-expression-v1";
export function evaluatePackageFunctional(
  loadedPackage: LoadedRulePackage,
  binding: PackageCandidateBinding,
  filter: PackageCandidateFilterEvaluation,
  functionalId: string,
  options?: LoadedPackageVerificationOptions
): PackageFunctionalEvaluation;
export const PACKAGE_COHORT_PARTITIONER_VERSION:
  "package-cohort-partitioner-v1";
export const PACKAGE_COHORT_PARTITION_SCOPE:
  "complete-locally-eligible-population-v1";
export const PACKAGE_COHORT_PARTITION_LIMITS: Readonly<{
  maxKeyExpressionEvaluations: 1000000;
}>;
export function constructPackageCohorts(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  cohortRuleId: string,
  options?: PackageCandidateExecutionOptions
): PackageCohortPartition;
export function verifyPackageCohortPartition(
  partition: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  options?: PackageCandidateExecutionOptions
): PackageCohortPartition;
export const PACKAGE_SELECTOR_RANKER_VERSION: "package-selector-ranker-v1";
export const PACKAGE_SELECTOR_RANKING_SCOPE: "complete-cohort-ranking-v1";
export const PACKAGE_SELECTOR_RANKING_LIMITS: Readonly<{
  maxFunctionalEvaluations: 1000000;
}>;
export const PACKAGE_SELECTOR_RANKING_POLICY: Readonly<PackageSelectorRankingPolicy>;
export function rankPackageSelector(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  partition: PackageCohortPartition,
  selectorId: string,
  options?: PackageSelectorRankingOptions
): PackageSelectorRanking;
export function verifyPackageSelectorRanking(
  ranking: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  partition: PackageCohortPartition,
  options?: PackageSelectorRankingOptions
): PackageSelectorRanking;
export const PACKAGE_SELECTOR_ADMISSION_VERSION:
  "package-selector-admission-v1";
export const PACKAGE_SELECTOR_ADMISSION_SCOPE:
  "complete-local-census-all-declared-selectors-v1";
export const PACKAGE_SELECTOR_ADMISSION_POLICY:
  Readonly<PackageSelectorAdmissionPolicy>;
export function admitPackageSelectors(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  selectorExecutions: PackageSelectorExecutionInput[],
  options?: PackageSelectorAdmissionOptions
): PackageSelectorAdmission;
export function verifyPackageSelectorAdmission(
  admission: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  selectorExecutions: PackageSelectorExecutionInput[],
  options?: PackageSelectorAdmissionOptions
): PackageSelectorAdmission;
export const PACKAGE_SELECTED_FORMATIONS_VERSION:
  "package-selected-formations-v1";
export const PACKAGE_SELECTED_FORMATIONS_SCOPE:
  "definitely-selected-candidate-formations-v1";
export const PACKAGE_SELECTED_FORMATIONS_POLICY:
  Readonly<PackageSelectedFormationsPolicy>;
export function materializePackageSelectedFormations(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  options?: PackageSelectedFormationsOptions
): PackageSelectedFormations;
export function verifyPackageSelectedFormations(
  formations: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  options?: PackageSelectedFormationsOptions
): PackageSelectedFormations;
export const PACKAGE_DERIVED_PROFILE_EXTRACTOR_VERSION:
  "package-derived-profile-extractor-v3";
export const PACKAGE_DERIVED_PROFILE_SCOPE:
  "all-selected-formations-residual-slot-functional-invariants-and-types-v3";
export const PACKAGE_DERIVED_PROFILE_POLICY:
  Readonly<PackageDerivedProfilePolicy>;
export function extractPackageDerivedProfiles(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  options?: PackageDerivedProfileOptions
): PackageDerivedProfiles;
export function verifyPackageDerivedProfiles(
  profiles: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  options?: PackageDerivedProfileOptions
): PackageDerivedProfiles;
export const PACKAGE_DERIVED_DEPTH_POPULATION_VERSION:
  "package-derived-depth-population-v3";
export const PACKAGE_DERIVED_ELEMENT_IDENTITY_POLICY:
  Readonly<PackageDerivedElementIdentityPolicy>;
export function materializePackageDerivedDepthPopulation(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  profiles: PackageDerivedProfiles,
  options?: PackageDerivedDepthPopulationOptions
): PackageDerivedDepthPopulation;
export function verifyPackageDerivedDepthPopulation(
  population: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  profiles: PackageDerivedProfiles,
  options?: PackageDerivedDepthPopulationOptions
): PackageDerivedDepthPopulation;
export const PACKAGE_LEVEL_CLOSURE_VERSION: "package-level-closure-v1";
export const PACKAGE_LEVEL_CLOSURE_SCOPE:
  "primitive-to-derived-depth-1-v1";
export function closePackageLevel(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackageLevelClosureOptions
): PackageLevelClosure;
export function verifyPackageLevelClosure(
  level: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  options?: PackageLevelClosureOptions
): PackageLevelClosure;
export const PACKAGE_DEPTH_SOURCE_SELECTOR_VERSION:
  "package-depth-source-selector-v2";
export const PACKAGE_DEPTH_SOURCE_SELECTOR_SCOPE:
  "verified-contiguous-closed-depth-source-selection-v1";
export const PACKAGE_DEPTH_SOURCE_SELECTION_LIMITS: Readonly<{
  maxTargetDepth: 64;
}>;
export const PACKAGE_DEPTH_SOURCE_SELECTION_POLICY:
  Readonly<PackageDepthSourceSelectionPolicy>;
export function selectPackageDepthSourcePopulation(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthSourceSelection;
export function verifyPackageDepthSourcePopulation(
  selection: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthSourceSelection;
export const PACKAGE_DEPTH_CANDIDATE_BINDER_VERSION:
  "package-depth-candidate-binding-v2";
export const PACKAGE_DEPTH_CANDIDATE_GENERATOR_VERSION:
  "package-depth-candidate-generator-v3";
export const PACKAGE_DEPTH_CANDIDATE_BINDING_POLICY:
  Readonly<PackageDepthCandidateBindingPolicy>;
export function createPackageDepthCandidateBinding(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthCandidateBinding;
export function enumeratePackageDepthCandidates(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthCandidateEnumerationResult;
export type PackageDepthPruningOptions = PackageLevelClosureOptions & {
  samplesPerPredicate?: number;
};
export const PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDITOR_VERSION:
  "package-depth-predicate-monotonicity-auditor-v1";
export const PACKAGE_DEPTH_PARTIAL_PRUNING_CONTROLLER_VERSION:
  "package-depth-partial-pruning-controller-v1";
export const PACKAGE_DEPTH_PREDICATE_MONOTONICITY_AUDIT_SCOPE:
  "complete-depth-aware-canonical-universe-v1";
export const PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDITOR_VERSION:
  "package-depth-generator-frontier-auditor-v1";
export const PACKAGE_DEPTH_GENERATOR_FRONTIER_CONTROLLER_VERSION:
  "package-depth-generator-frontier-controller-v1";
export const PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SCOPE:
  "complete-depth-aware-raw-edge-group-frontiers-v1";
export const PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATOR_VERSION:
  "package-depth-pruned-candidate-generator-v1";
export const PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATOR_VERSION:
  "package-depth-recursive-pruned-candidate-generator-v1";
export const PACKAGE_DEPTH_CANDIDATE_PRUNING_STRATEGY:
  "canonical-candidate-prefix-pre-admission-v1";
export const PACKAGE_DEPTH_RECURSIVE_PRUNING_STRATEGY:
  "audited-edge-group-subtree-pruning-v1";
export const PACKAGE_DEPTH_NODE_FRONTIER_AUDITOR_VERSION:
  "package-depth-node-frontier-auditor-v1";
export const PACKAGE_DEPTH_NODE_FRONTIER_CONTROLLER_VERSION:
  "package-depth-node-frontier-controller-v1";
export const PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SCOPE:
  "complete-depth-aware-raw-node-prefix-extension-pairs-v1";
export const PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATOR_VERSION:
  "package-depth-node-growth-pruned-candidate-generator-v1";
export const PACKAGE_DEPTH_NODE_GROWTH_PRUNING_STRATEGY:
  "audited-node-assignment-subtree-pruning-v1";
export function auditPackageDepthPredicateMonotonicity(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageDepthPruningOptions
): PackageDepthPredicateMonotonicityAudit;
export function verifyPackageDepthPredicateMonotonicityAudit(
  audit: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageDepthPruningOptions
): PackageDepthPredicateMonotonicityAudit;
export function createPackageDepthPartialPruningControllerSession(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  audit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthPartialPruningControllerSession;
export function authorizePackageDepthPartialPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  audit: PackageDepthPredicateMonotonicityAudit,
  predicateId: string,
  partialGraph: PartialPredicateGraph,
  options?: PackageDepthPruningOptions
): PackageDepthPartialPruningDecision;
export function enumeratePackageDepthCandidatesWithPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  audit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthPrunedCandidateGeneration;
export function verifyPackageDepthCandidatesWithPruning(
  artifact: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  audit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthPrunedCandidateGeneration;
export function auditPackageDepthGeneratorFrontiers(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthGeneratorFrontierAudit;
export function verifyPackageDepthGeneratorFrontierAudit(
  audit: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthGeneratorFrontierAudit;
export function createPackageDepthGeneratorFrontierControllerSession(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  frontierAudit: PackageDepthGeneratorFrontierAudit,
  options?: PackageDepthPruningOptions
): PackageDepthGeneratorFrontierControllerSession;
export function authorizePackageDepthGeneratorFrontierPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  frontierAudit: PackageDepthGeneratorFrontierAudit,
  predicateId: string,
  frontier: PackageGeneratorFrontierInput,
  options?: PackageDepthPruningOptions
): PackageDepthGeneratorFrontierDecision;
export function enumeratePackageDepthCandidatesWithRecursivePruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  frontierAudit: PackageDepthGeneratorFrontierAudit,
  options?: PackageDepthPruningOptions
): PackageDepthRecursivePrunedCandidateGeneration;
export function verifyPackageDepthCandidatesWithRecursivePruning(
  artifact: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  frontierAudit: PackageDepthGeneratorFrontierAudit,
  options?: PackageDepthPruningOptions
): PackageDepthRecursivePrunedCandidateGeneration;
export function auditPackageDepthNodeFrontiers(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthNodeFrontierAudit;
export function verifyPackageDepthNodeFrontierAudit(
  audit: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  options?: PackageDepthPruningOptions
): PackageDepthNodeFrontierAudit;
export function createPackageDepthNodeFrontierControllerSession(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  nodeFrontierAudit: PackageDepthNodeFrontierAudit,
  options?: PackageDepthPruningOptions
): PackageDepthNodeFrontierControllerSession;
export function authorizePackageDepthNodeFrontierPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  nodeFrontierAudit: PackageDepthNodeFrontierAudit,
  predicateId: string,
  frontier: PackageNodeFrontierInput,
  options?: PackageDepthPruningOptions
): PackageDepthNodeFrontierDecision;
export function enumeratePackageDepthCandidatesWithNodeGrowthPruning(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  nodeFrontierAudit: PackageDepthNodeFrontierAudit,
  options?: PackageDepthPruningOptions
): PackageDepthNodeGrowthPrunedCandidateGeneration;
export function verifyPackageDepthCandidatesWithNodeGrowthPruning(
  artifact: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  canonicalAudit: PackageDepthPredicateMonotonicityAudit,
  nodeFrontierAudit: PackageDepthNodeFrontierAudit,
  options?: PackageDepthPruningOptions
): PackageDepthNodeGrowthPrunedCandidateGeneration;
export const PACKAGE_DEPTH_CANDIDATE_FILTER_EVALUATOR_VERSION:
  "package-depth-candidate-filter-evaluator-v1";
export function evaluatePackageDepthCandidateFilter(
  loadedPackage: LoadedRulePackage,
  binding: PackageDepthCandidateBinding,
  levelClosures: PackageClosedLevel[],
  candidate: CandidateInput,
  options?: LoadedPackageVerificationOptions
): PackageDepthCandidateFilterEvaluation;
export const PACKAGE_DEPTH_CANDIDATE_CENSUS_EVALUATOR_VERSION:
  "package-depth-candidate-census-evaluator-v1";
export const PACKAGE_DEPTH_CANDIDATE_CENSUS_SCOPE:
  "complete-depth-aware-local-filter-census-v1";
export const PACKAGE_DEPTH_CANDIDATE_CENSUS_DOMINANCE_THRESHOLD: 0.9;
export function evaluatePackageDepthCandidateCensus(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthCandidateCensus;
export function verifyPackageDepthCandidateCensus(
  census: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthCandidateCensus;
export function evaluatePackageDepthFunctional(
  loadedPackage: LoadedRulePackage,
  binding: PackageDepthCandidateBinding,
  levelClosures: PackageClosedLevel[],
  filter: PackageDepthCandidateFilterEvaluation,
  functionalId: string,
  options?: LoadedPackageVerificationOptions
): PackageFunctionalEvaluation;
export function constructPackageDepthCohorts(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  cohortRuleId: string,
  options?: PackageLevelClosureOptions
): PackageCohortPartition;
export function verifyPackageDepthCohortPartition(
  partition: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  options?: PackageLevelClosureOptions
): PackageCohortPartition;
export function rankPackageDepthSelector(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  partition: PackageCohortPartition,
  selectorId: string,
  options?: PackageLevelClosureOptions
): PackageSelectorRanking;
export function verifyPackageDepthSelectorRanking(
  ranking: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  partition: PackageCohortPartition,
  options?: PackageLevelClosureOptions
): PackageSelectorRanking;
export function evaluatePackageDepthSelectorSensitivity(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  partition: PackageCohortPartition,
  ranking: PackageSelectorRanking,
  options?: PackageLevelClosureOptions
): PackageSelectorSensitivityReport;
export function verifyPackageDepthSelectorSensitivity(
  sensitivity: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  partition: PackageCohortPartition,
  ranking: PackageSelectorRanking,
  options?: PackageLevelClosureOptions
): PackageSelectorSensitivityReport;
export function admitPackageDepthSelectors(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  selectorExecutions: PackageSelectorExecutionInput[],
  options?: PackageLevelClosureOptions
): PackageSelectorAdmission;
export function verifyPackageDepthSelectorAdmission(
  admission: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  selectorExecutions: PackageSelectorExecutionInput[],
  options?: PackageLevelClosureOptions
): PackageSelectorAdmission;
export function materializePackageDepthSelectedFormations(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  options?: PackageLevelClosureOptions
): PackageSelectedFormations;
export function verifyPackageDepthSelectedFormations(
  formations: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  options?: PackageLevelClosureOptions
): PackageSelectedFormations;
export function extractPackageDepthDerivedProfiles(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  options?: PackageLevelClosureOptions
): PackageDerivedProfiles;
export function verifyPackageDepthDerivedProfiles(
  profiles: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  options?: PackageLevelClosureOptions
): PackageDerivedProfiles;
export function materializePackageDepthDerivedPopulation(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  profiles: PackageDerivedProfiles,
  options?: PackageLevelClosureOptions
): PackageDerivedDepthPopulation;
export function verifyPackageDepthDerivedPopulation(
  population: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  formations: PackageSelectedFormations,
  profiles: PackageDerivedProfiles,
  options?: PackageLevelClosureOptions
): PackageDerivedDepthPopulation;
export const PACKAGE_DEPTH_LEVEL_CLOSURE_VERSION:
  "package-depth-level-closure-v1";
export const PACKAGE_DEPTH_LEVEL_CLOSURE_SCOPE:
  "verified-prior-levels-to-target-depth-v1";
export function closePackageDepthLevel(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthLevelClosure;
export function verifyPackageDepthLevelClosure(
  level: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageDepthLevelClosure;
export const PACKAGE_LEVEL_EXPLANATION_INDEXER_VERSION:
  "package-level-explanation-indexer-v1";
export const PACKAGE_LEVEL_EXPLANATION_INDEX_SCOPE:
  "complete-verified-level-candidate-lineage-v1";
export const PACKAGE_LEVEL_CANDIDATE_EXPLAINER_VERSION:
  "package-level-candidate-explainer-v1";
export function createPackageLevelExplanationIndex(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  level: PackageClosedLevel,
  priorLevels?: PackageClosedLevel[],
  options?: PackageLevelClosureOptions
): PackageLevelExplanationIndex;
export function verifyPackageLevelExplanationIndex(
  index: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  level: PackageClosedLevel,
  priorLevels?: PackageClosedLevel[],
  options?: PackageLevelClosureOptions
): PackageLevelExplanationIndex;
export function explainPackageLevelCandidate(
  index: PackageLevelExplanationIndex,
  candidateId: CandidateId
): PackageLevelCandidateExplanation;
export const PACKAGE_LEVEL_RESULT_CENSUS_VERSION:
  "package-level-result-census-v1";
export const PACKAGE_LEVEL_RESULT_CENSUS_SCOPE:
  "complete-verified-level-result-census-v1";
export function createPackageLevelResultCensus(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  level: PackageClosedLevel,
  priorLevels?: PackageClosedLevel[],
  options?: PackageLevelClosureOptions
): PackageLevelResultCensus;
export function verifyPackageLevelResultCensus(
  census: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  level: PackageClosedLevel,
  priorLevels?: PackageClosedLevel[],
  options?: PackageLevelClosureOptions
): PackageLevelResultCensus;
export const PACKAGE_RUN_ARTIFACT_BUNDLE_VERSION:
  "package-run-artifact-bundle-v1";
export const PACKAGE_RUN_ARTIFACT_BUNDLE_SCOPE:
  "complete-verified-level-chain-artifacts-v1";
export const PACKAGE_RUN_SEMANTIC_MANIFEST_VERSION:
  "package-run-semantic-manifest-v1";
export const PACKAGE_RUN_ARTIFACT_MATERIALIZER_VERSION:
  "package-run-artifact-materializer-v1";
export const PACKAGE_RUN_ARTIFACT_STORE_VERSION:
  "package-run-artifact-store-v1";
export const PACKAGE_RUN_ARTIFACT_STORE_SCOPE:
  "externally-bound-verified-run-bundle-index-v1";
export const PACKAGE_RUN_CANDIDATE_EXPLAINER_VERSION:
  "package-run-candidate-explainer-v1";
export const PACKAGE_RUN_ARTIFACT_BUNDLE_LIMITS: Readonly<{
  maxBundles: 100;
  maxLevels: 64;
  maxArtifacts: 4096;
}>;
export function createPackageRunArtifactBundle(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levels: PackageClosedLevel[],
  options?: PackageLevelClosureOptions
): PackageRunArtifactBundle;
export function verifyPackageRunArtifactBundle(
  bundle: unknown,
  options?: { expectedKernelVersion?: string }
): PackageRunArtifactBundle;
export function materializePackageRunArtifact(
  bundle: PackageRunArtifactBundle,
  path: string,
  options?: { expectedKernelVersion?: string }
): PackageRunArtifactMaterialization;
export function createPackageRunArtifactStore(
  bundles: PackageRunArtifactBundle[],
  options?: { expectedKernelVersion?: string }
): PackageRunArtifactStore;
export function verifyPackageRunArtifactStore(
  store: unknown,
  options?: { expectedKernelVersion?: string }
): PackageRunArtifactStore;
export function explainPackageRunCandidate(
  store: PackageRunArtifactStore,
  runHash: ContentHash,
  candidateId: CandidateId,
  options?: { expectedKernelVersion?: string }
): PackageRunCandidateExplanation;
export function createPackageRunArtifactStoreSession(
  store: PackageRunArtifactStore,
  options?: { expectedKernelVersion?: string }
): PackageRunArtifactStoreSession;
export const PACKAGE_LADDER_CLOSURE_VERSION: "package-ladder-closure-v1";
export const PACKAGE_LADDER_CLOSURE_SCOPE:
  "bounded-explicit-depth-transitions-v1";
export const PACKAGE_LADDER_CLOSURE_LIMITS: Readonly<{ maxDepths: 64 }>;
export const PACKAGE_LADDER_CLOSURE_POLICY:
  Readonly<PackageLadderClosurePolicy>;
export function closePackageLadder(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  depths: number,
  options?: PackageLevelClosureOptions
): PackageAnyLadderClosure;
export function verifyPackageLadderClosure(
  ladder: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  depths: number,
  options?: PackageLevelClosureOptions
): PackageAnyLadderClosure;
export const PACKAGE_CURRENT_LEVEL_SOURCE_SELECTOR_VERSION:
  "package-current-level-source-selector-v1";
export const PACKAGE_CURRENT_LEVEL_CANDIDATE_BINDER_VERSION:
  "package-current-level-candidate-binding-v2";
export const PACKAGE_CURRENT_LEVEL_CANDIDATE_GENERATOR_VERSION:
  "package-current-level-candidate-generator-v3";
export const PACKAGE_CURRENT_LEVEL_CANDIDATE_FILTER_VERSION:
  "package-current-level-candidate-filter-evaluator-v1";
export const PACKAGE_CURRENT_LEVEL_CENSUS_VERSION:
  "package-current-level-candidate-census-evaluator-v1";
export const PACKAGE_CURRENT_LEVEL_ROUND_VERSION:
  "package-current-level-fixpoint-round-v2";
export const PACKAGE_CURRENT_LEVEL_POPULATION_VERSION:
  "package-current-level-fixpoint-population-v1";
export const PACKAGE_CURRENT_LEVEL_CLOSURE_VERSION:
  "package-current-level-fixpoint-closure-v2";
export const PACKAGE_FIXPOINT_LADDER_CLOSURE_VERSION:
  "package-fixpoint-ladder-closure-v1";
export const PACKAGE_CURRENT_LEVEL_FIXPOINT_POLICY:
  Readonly<PackageCurrentLevelFixpointPolicy>;
export const PACKAGE_FIXPOINT_LADDER_POLICY:
  Readonly<PackageFixpointLadderClosurePolicy>;
export function closePackageCurrentLevelFixpoint(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  priorLevels?: PackageCurrentLevelFixpointClosure[],
  targetDepth?: number,
  options?: PackageLevelClosureOptions
): PackageCurrentLevelFixpointClosure;
export function verifyPackageCurrentLevelFixpoint(
  level: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  priorLevels?: PackageCurrentLevelFixpointClosure[],
  targetDepth?: number,
  options?: PackageLevelClosureOptions
): PackageCurrentLevelFixpointClosure;
export const PACKAGE_PROFILE_COLLAPSE_VERSION:
  "package-profile-collapse-evaluator-v1";
export const PACKAGE_PROFILE_COLLAPSE_SCOPE:
  "bounded-exact-vs-profile-projection-v1";
export const PACKAGE_PROFILE_COLLAPSE_POLICY:
  Readonly<PackageProfileCollapsePolicy>;
export function testPackageProfileCollapse(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageProfileCollapseReport;
export function verifyPackageProfileCollapse(
  report: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  targetDepth: number,
  options?: PackageLevelClosureOptions
): PackageProfileCollapseReport;
export const PACKAGE_LEVEL_BOUNDARY_DETECTOR_VERSION:
  "package-level-boundary-detector-v1";
export const PACKAGE_LEVEL_BOUNDARY_SCOPE:
  "bounded-profile-collapse-minima-v1";
export const PACKAGE_LEVEL_BOUNDARY_POLICY:
  Readonly<PackageLevelBoundaryPolicy>;
export function detectPackageLevelBoundaries(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  depths: number,
  options?: PackageLevelClosureOptions
): PackageLevelBoundaryReport;
export function verifyPackageLevelBoundaries(
  report: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  depths: number,
  options?: PackageLevelClosureOptions
): PackageLevelBoundaryReport;
export const PACKAGE_CARRIER_PROMOTION_VERSION:
  "package-carrier-promotion-materializer-v1";
export const PACKAGE_CARRIER_PROMOTION_SCOPE:
  "verified-ladder-level-to-target-package-input-v1";
export const PACKAGE_CARRIER_PROMOTION_POLICY:
  Readonly<PackageCarrierPromotionMaterializationPolicy>;
export function normalizePackageCarrierPromotionPolicy(
  policy: PackageCarrierPromotionPolicy
): Readonly<PackageCarrierPromotionPolicy>;
export function materializePackageCarrierPromotions(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  ladder: PackageLadderClosure,
  collapse: PackageProfileCollapseReport,
  requestedDepths: number,
  policy: PackageCarrierPromotionPolicy,
  options?: PackageLevelClosureOptions
): PackageCarrierPromotionSet;
export function verifyPackageCarrierPromotions(
  promotions: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  ladder: PackageLadderClosure,
  collapse: PackageProfileCollapseReport,
  requestedDepths: number,
  policy: PackageCarrierPromotionPolicy,
  options?: PackageLevelClosureOptions
): PackageCarrierPromotionSet;
export const PACKAGE_SELECTOR_SENSITIVITY_EVALUATOR_VERSION:
  "package-selector-sensitivity-evaluator-v1";
export const PACKAGE_SELECTOR_SENSITIVITY_SCOPE:
  "complete-required-perturbation-sweep-v1";
export const PACKAGE_SELECTOR_SENSITIVITY_LIMITS: Readonly<{
  maxVariants: 1000000;
  maxSensitivityFunctionalEvaluations: 1000000;
}>;
export const PACKAGE_SELECTOR_SENSITIVITY_POLICY:
  Readonly<PackageSelectorSensitivityPolicy>;
export function evaluatePackageSelectorSensitivity(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  partition: PackageCohortPartition,
  ranking: PackageSelectorRanking,
  options?: PackageSelectorSensitivityOptions
): PackageSelectorSensitivityReport;
export function verifyPackageSelectorSensitivity(
  sensitivity: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  partition: PackageCohortPartition,
  ranking: PackageSelectorRanking,
  options?: PackageSelectorSensitivityOptions
): PackageSelectorSensitivityReport;
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
export const PACKAGE_NULL_MODEL_PLAN_VERSION: "package-null-model-plan-v1";
export const PACKAGE_NULL_MODEL_PLAN_LIMITS: Readonly<{
  maxTrials: 10000;
  maxCarrierCandidates: 1000000;
}>;
export const PACKAGE_NULL_MODEL_RANDOMNESS_POLICY: Readonly<
  PackageNullModelPlan["randomnessPolicy"]
>;
export const PACKAGE_NULL_MODEL_EXECUTION_REQUIREMENTS: Readonly<
  PackageNullModelPlan["executionRequirements"]
>;
export function createPackageNullModelPlan(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  options?: PackageNullModelPlanOptions
): PackageNullModelPlan;
export function verifyPackageNullModelPlan(
  plan: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  options?: PackageNullModelPlanOptions
): PackageNullModelPlan;
export function createPackageDepthNullModelPlan(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  options?: PackageNullModelPlanOptions
): PackageNullModelPlan;
export function verifyPackageDepthNullModelPlan(
  plan: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  options?: PackageNullModelPlanOptions
): PackageNullModelPlan;
export const PACKAGE_NULL_MODEL_PROPOSALS_VERSION:
  "package-null-model-proposals-v1";
export const PACKAGE_NULL_MODEL_PROPOSAL_LIMITS: Readonly<{
  maxProposalOccurrences: 1000000;
  maxProposalOperations: 1000000;
  maxRejectionDraws: 1024;
}>;
export const PACKAGE_NULL_MODEL_PROPOSAL_POLICY: Readonly<
  PackageNullModelProposals["policy"]
>;
export function createPackageNullModelProposals(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  plan: PackageNullModelPlan,
  options?: PackageNullModelProposalOptions
): PackageNullModelProposals;
export function verifyPackageNullModelProposals(
  proposals: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  plan: PackageNullModelPlan,
  options?: PackageNullModelProposalOptions
): PackageNullModelProposals;
export function createPackageDepthNullModelProposals(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  plan: PackageNullModelPlan,
  options?: PackageNullModelProposalOptions
): PackageNullModelProposals;
export function verifyPackageDepthNullModelProposals(
  proposals: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  plan: PackageNullModelPlan,
  options?: PackageNullModelProposalOptions
): PackageNullModelProposals;
export const PACKAGE_NULL_MODEL_TRIAL_CENSUSES_VERSION:
  "package-null-model-trial-censuses-v1";
export const PACKAGE_NULL_MODEL_TRIAL_CENSUS_SCOPE:
  "complete-occurrence-local-filter-replay-v1";
export function evaluatePackageNullModelTrialCensuses(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  options?: PackageNullModelProposalOptions
): PackageNullModelTrialCensuses;
export function verifyPackageNullModelTrialCensuses(
  trialCensuses: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  options?: PackageNullModelProposalOptions
): PackageNullModelTrialCensuses;
export function evaluatePackageDepthNullModelTrialCensuses(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  options?: PackageNullModelProposalOptions
): PackageNullModelTrialCensuses;
export function verifyPackageDepthNullModelTrialCensuses(
  trialCensuses: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  options?: PackageNullModelProposalOptions
): PackageNullModelTrialCensuses;
export const PACKAGE_NULL_MODEL_TRIAL_SELECTIONS_VERSION:
  "package-null-model-trial-selections-v1";
export const PACKAGE_NULL_MODEL_TRIAL_SELECTION_SCOPE:
  "complete-occurrence-cohort-functional-selector-replay-v1";
export const PACKAGE_NULL_MODEL_TRIAL_SELECTION_POLICY: Readonly<
  PackageNullModelTrialSelectionPolicy
>;
export function evaluatePackageNullModelTrialSelections(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  options?: PackageNullModelTrialSelectionOptions
): PackageNullModelTrialSelections;
export function verifyPackageNullModelTrialSelections(
  trialSelections: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  options?: PackageNullModelTrialSelectionOptions
): PackageNullModelTrialSelections;
export function evaluatePackageDepthNullModelTrialSelections(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  options?: PackageNullModelTrialSelectionOptions
): PackageNullModelTrialSelections;
export function verifyPackageDepthNullModelTrialSelections(
  trialSelections: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  options?: PackageNullModelTrialSelectionOptions
): PackageNullModelTrialSelections;
export const PACKAGE_NULL_MODEL_BASELINE_VERSION:
  "package-null-model-baseline-v1";
export const PACKAGE_NULL_MODEL_BASELINE_SCOPE:
  "per-model-complete-trial-metric-distributions-v1";
export const PACKAGE_NULL_MODEL_DISTRIBUTION_POLICY: Readonly<
  PackageNullModelBaseline["distributionPolicy"]
>;
export function evaluatePackageNullModelBaseline(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  trialSelections: PackageNullModelTrialSelections,
  options?: PackageNullModelBaselineOptions
): PackageNullModelBaseline;
export function verifyPackageNullModelBaseline(
  baseline: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  census: PackageCandidateCensus,
  admission: PackageSelectorAdmission,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  trialSelections: PackageNullModelTrialSelections,
  options?: PackageNullModelBaselineOptions
): PackageNullModelBaseline;
export function evaluatePackageDepthNullModelBaseline(
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  trialSelections: PackageNullModelTrialSelections,
  options?: PackageNullModelBaselineOptions
): PackageNullModelBaseline;
export function verifyPackageDepthNullModelBaseline(
  baseline: unknown,
  loadedPackage: LoadedRulePackage,
  runConfig: RunConfigInput,
  levelClosures: PackageClosedLevel[],
  targetDepth: number,
  census: PackageDepthCandidateCensus,
  admission: PackageSelectorAdmission,
  plan: PackageNullModelPlan,
  proposals: PackageNullModelProposals,
  trialCensuses: PackageNullModelTrialCensuses,
  trialSelections: PackageNullModelTrialSelections,
  options?: PackageNullModelBaselineOptions
): PackageNullModelBaseline;

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
export const LOCAL_PREDICATE_EVALUATOR_VERSION: "local-predicate-evaluator-v19";
export const LOCAL_PREDICATE_EVALUATION_LIMITS: Readonly<{
  maxValueNodes: 10000;
  maxSelectionWitnesses: 10000;
  maxSelectedValues: 5000;
  maxSubstructureRemovals: 10000;
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
export const SOURCE_CLASSIFICATION_AMENDMENTS_VERSION:
  "source-classification-amendments-v1";
export const SOURCE_CLASSIFICATION_AMENDMENT_LIMITS: Readonly<{
  maxChanges: 10000;
  maxIdentifierLength: 1024;
  maxTextLength: 16384;
}>;
export function freezeSourceClassificationAmendments(
  policy: FrozenSourceClassificationPolicy,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: SourceClassificationAmendmentsInput
): FrozenSourceClassificationAmendments;
export function verifySourceClassificationAmendments(
  policy: FrozenSourceClassificationPolicy,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments
): FrozenSourceClassificationAmendments;
export function freezeSourceNodeResolutionPolicy(
  policy: SourceNodeResolutionPolicyInput
): FrozenSourceNodeResolutionPolicy;

export const KERNEL_IMPLEMENTATION_STATUS: "foundation-active/decorated-generation-active/profile-composition-gate-active/scalar-candidate-attributes-active/quantity-candidate-attributes-active/role-dependent-edge-candidate-attributes-active/formation-functional-attribute-carry-forward-active/formation-derived-types-active/predicate-plans-active/local-census-active/null-model-plan-active/null-model-proposals-active/null-model-local-trial-census-active/null-model-trial-selection-active/null-model-baseline-active/functional-evaluation-active/functional-attribute-sums-active/coefficient-role-closure-active/cohort-partition-active/selector-ranking-active/selector-sensitivity-active/selector-admission-active/selected-formations-active/derived-profiles-active/run-axis-active/generalized-level-closure-active/explicit-ladder-closure-active/profile-collapse-active/level-boundary-detection-active/carrier-promotion-active/bounded-fixpoint-active/current-level-null-model-active/resumable-generation-active/exhaustive-minimality-active/local-scalar-invariants-active/package-scalar-invariants-active/local-novel-active/local-stability-active/sampled-stability-active/nested-substructure-invariants-active/profile-invariant-aggregation-active/local-quantity-products-active/pruning-audit-controller-active/pruning-pre-admission-active/profile-gated-pre-admission-pruning-active/profile-gated-raw-frontier-pruning-active/recursive-pruning-active/node-growth-pruning-active/directed-strong-recursive-pruning-active/generalized-depth-recursive-pruning-active/level-explanation-index-active/integrated-level-result-census-active/artifact-bundle-index-active/source-amendments-active/source-migration-binding-active/schema-v1-implementation-closure-active";
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
  allowCurrentDepthReferences?: boolean;
}): LoadedRulePackage;

export const KERNEL_CAPABILITIES: Readonly<{
  implemented: readonly string[];
  pending: readonly string[];
}>;

export interface Kernel {
  readonly version: string;
  readonly capabilities: typeof KERNEL_CAPABILITIES;
  loadPackage(input: RulePackage, options?: {
    allowCurrentDepthReferences?: boolean;
  }): Promise<LoadedRulePackage>;
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
  advanceDecoratedCandidateEnumeration(
    input: DecoratedCandidateEnumerationInput,
    enumerationOptions?: Partial<CandidateEnumerationLimits> & {
      canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
    },
    resumeOptions?: ResumableCandidateEnumerationOptions
  ): ResumableCandidateEnumerationStep;
  verifyDecoratedCandidateEnumerationStep(
    artifact: ResumableCandidateEnumerationStep,
    input: DecoratedCandidateEnumerationInput,
    enumerationOptions?: Partial<CandidateEnumerationLimits> & {
      canonicalizationLimits?: Partial<GraphCanonicalizationLimits>;
    },
    resumeOptions?: ResumableCandidateEnumerationOptions
  ): ResumableCandidateEnumerationStep;
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
  auditPackagePredicateMonotonicity(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackagePredicateMonotonicityAudit;
  verifyPackagePredicateMonotonicityAudit(
    audit: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackagePredicateMonotonicityAudit;
  auditPackageGeneratorFrontiers(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageGeneratorFrontierAudit;
  verifyPackageGeneratorFrontierAudit(
    audit: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageGeneratorFrontierAudit;
  createPackageGeneratorFrontierControllerSession(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    frontierAudit: PackageGeneratorFrontierAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageGeneratorFrontierControllerSession;
  authorizePackagePartialPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    audit: PackagePredicateMonotonicityAudit,
    predicateId: string,
    partialGraph: PartialPredicateGraph,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackagePartialPruningDecision;
  createPackagePartialPruningControllerSession(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    audit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackagePartialPruningControllerSession;
  enumeratePackageCandidatesWithPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    audit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackagePrunedCandidateGeneration;
  verifyPackageCandidatesWithPruning(
    artifact: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    audit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackagePrunedCandidateGeneration;
  enumeratePackageCandidatesWithRecursivePruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    frontierAudit: PackageGeneratorFrontierAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageRecursivePrunedCandidateGeneration;
  verifyPackageCandidatesWithRecursivePruning(
    artifact: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    frontierAudit: PackageGeneratorFrontierAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageRecursivePrunedCandidateGeneration;
  auditPackageNodeFrontiers(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageNodeFrontierAudit;
  verifyPackageNodeFrontierAudit(
    audit: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageNodeFrontierAudit;
  createPackageNodeFrontierControllerSession(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    nodeFrontierAudit: PackageNodeFrontierAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageNodeFrontierControllerSession;
  authorizePackageNodeFrontierPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    nodeFrontierAudit: PackageNodeFrontierAudit,
    predicateId: string,
    frontier: PackageNodeFrontierInput,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageNodeFrontierDecision;
  enumeratePackageCandidatesWithNodeGrowthPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    nodeFrontierAudit: PackageNodeFrontierAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageNodeGrowthPrunedCandidateGeneration;
  verifyPackageCandidatesWithNodeGrowthPruning(
    artifact: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    canonicalAudit: PackagePredicateMonotonicityAudit,
    nodeFrontierAudit: PackageNodeFrontierAudit,
    options?: Omit<PackagePredicateMonotonicityAuditOptions, "kernelVersion">
  ): PackageNodeGrowthPrunedCandidateGeneration;
  evaluatePackageCandidateFilter(
    loadedPackage: LoadedRulePackage,
    binding: PackageCandidateBinding,
    candidate: CandidateInput
  ): PackageCandidateFilterEvaluation;
  evaluatePackageFunctional(
    loadedPackage: LoadedRulePackage,
    binding: PackageCandidateBinding,
    filter: PackageCandidateFilterEvaluation,
    functionalId: string
  ): PackageFunctionalEvaluation;
  constructPackageCohorts(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    cohortRuleId: string,
    options?: Partial<PackageCandidateExecutionLimits>
  ): PackageCohortPartition;
  verifyPackageCohortPartition(
    partition: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    options?: Partial<PackageCandidateExecutionLimits>
  ): PackageCohortPartition;
  rankPackageSelector(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    partition: PackageCohortPartition,
    selectorId: string,
    options?: Omit<PackageSelectorRankingOptions, "kernelVersion">
  ): PackageSelectorRanking;
  verifyPackageSelectorRanking(
    ranking: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    partition: PackageCohortPartition,
    options?: Omit<PackageSelectorRankingOptions, "kernelVersion">
  ): PackageSelectorRanking;
  admitPackageSelectors(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    selectorExecutions: PackageSelectorExecutionInput[],
    options?: Omit<PackageSelectorAdmissionOptions, "kernelVersion">
  ): PackageSelectorAdmission;
  verifyPackageSelectorAdmission(
    admission: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    selectorExecutions: PackageSelectorExecutionInput[],
    options?: Omit<PackageSelectorAdmissionOptions, "kernelVersion">
  ): PackageSelectorAdmission;
  materializePackageSelectedFormations(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    options?: Omit<PackageSelectedFormationsOptions, "kernelVersion">
  ): PackageSelectedFormations;
  verifyPackageSelectedFormations(
    formations: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    options?: Omit<PackageSelectedFormationsOptions, "kernelVersion">
  ): PackageSelectedFormations;
  extractPackageDerivedProfiles(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    options?: Omit<PackageDerivedProfileOptions, "kernelVersion">
  ): PackageDerivedProfiles;
  verifyPackageDerivedProfiles(
    profiles: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    options?: Omit<PackageDerivedProfileOptions, "kernelVersion">
  ): PackageDerivedProfiles;
  materializePackageDerivedDepthPopulation(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    profiles: PackageDerivedProfiles,
    options?: Omit<PackageDerivedDepthPopulationOptions, "kernelVersion">
  ): PackageDerivedDepthPopulation;
  verifyPackageDerivedDepthPopulation(
    population: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    profiles: PackageDerivedProfiles,
    options?: Omit<PackageDerivedDepthPopulationOptions, "kernelVersion">
  ): PackageDerivedDepthPopulation;
  closePackageLevel(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelClosure | PackageCurrentLevelFixpointClosure;
  verifyPackageLevelClosure(
    level: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelClosure | PackageCurrentLevelFixpointClosure;
  selectPackageDepthSourcePopulation(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthSourceSelection;
  verifyPackageDepthSourcePopulation(
    selection: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthSourceSelection;
  createPackageDepthCandidateBinding(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthCandidateBinding;
  enumeratePackageDepthCandidates(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthCandidateEnumerationResult;
  auditPackageDepthPredicateMonotonicity(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthPredicateMonotonicityAudit;
  verifyPackageDepthPredicateMonotonicityAudit(
    audit: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthPredicateMonotonicityAudit;
  createPackageDepthPartialPruningControllerSession(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    audit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthPartialPruningControllerSession;
  authorizePackageDepthPartialPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    audit: PackageDepthPredicateMonotonicityAudit,
    predicateId: string,
    partialGraph: PartialPredicateGraph,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthPartialPruningDecision;
  enumeratePackageDepthCandidatesWithPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    audit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthPrunedCandidateGeneration;
  verifyPackageDepthCandidatesWithPruning(
    artifact: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    audit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthPrunedCandidateGeneration;
  auditPackageDepthGeneratorFrontiers(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthGeneratorFrontierAudit;
  verifyPackageDepthGeneratorFrontierAudit(
    audit: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthGeneratorFrontierAudit;
  createPackageDepthGeneratorFrontierControllerSession(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    frontierAudit: PackageDepthGeneratorFrontierAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthGeneratorFrontierControllerSession;
  authorizePackageDepthGeneratorFrontierPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    frontierAudit: PackageDepthGeneratorFrontierAudit,
    predicateId: string,
    frontier: PackageGeneratorFrontierInput,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthGeneratorFrontierDecision;
  enumeratePackageDepthCandidatesWithRecursivePruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    frontierAudit: PackageDepthGeneratorFrontierAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthRecursivePrunedCandidateGeneration;
  verifyPackageDepthCandidatesWithRecursivePruning(
    artifact: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    frontierAudit: PackageDepthGeneratorFrontierAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthRecursivePrunedCandidateGeneration;
  auditPackageDepthNodeFrontiers(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthNodeFrontierAudit;
  verifyPackageDepthNodeFrontierAudit(
    audit: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthNodeFrontierAudit;
  createPackageDepthNodeFrontierControllerSession(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    nodeFrontierAudit: PackageDepthNodeFrontierAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthNodeFrontierControllerSession;
  authorizePackageDepthNodeFrontierPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    nodeFrontierAudit: PackageDepthNodeFrontierAudit,
    predicateId: string,
    frontier: PackageNodeFrontierInput,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthNodeFrontierDecision;
  enumeratePackageDepthCandidatesWithNodeGrowthPruning(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    nodeFrontierAudit: PackageDepthNodeFrontierAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthNodeGrowthPrunedCandidateGeneration;
  verifyPackageDepthCandidatesWithNodeGrowthPruning(
    artifact: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    canonicalAudit: PackageDepthPredicateMonotonicityAudit,
    nodeFrontierAudit: PackageDepthNodeFrontierAudit,
    options?: Omit<PackageDepthPruningOptions, "kernelVersion">
  ): PackageDepthNodeGrowthPrunedCandidateGeneration;
  evaluatePackageDepthCandidateFilter(
    loadedPackage: LoadedRulePackage,
    binding: PackageDepthCandidateBinding,
    levelClosures: PackageClosedLevel[],
    candidate: CandidateInput,
    options?: Omit<LoadedPackageVerificationOptions, "kernelVersion">
  ): PackageDepthCandidateFilterEvaluation;
  evaluatePackageDepthCandidateCensus(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthCandidateCensus;
  verifyPackageDepthCandidateCensus(
    census: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthCandidateCensus;
  createPackageDepthNullModelPlan(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    options?: Omit<PackageNullModelPlanOptions, "kernelVersion">
  ): PackageNullModelPlan;
  verifyPackageDepthNullModelPlan(
    plan: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    options?: Omit<PackageNullModelPlanOptions, "kernelVersion">
  ): PackageNullModelPlan;
  createPackageDepthNullModelProposals(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    plan: PackageNullModelPlan,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelProposals;
  verifyPackageDepthNullModelProposals(
    proposals: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    plan: PackageNullModelPlan,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelProposals;
  evaluatePackageDepthNullModelTrialCensuses(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelTrialCensuses;
  verifyPackageDepthNullModelTrialCensuses(
    trialCensuses: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelTrialCensuses;
  evaluatePackageDepthNullModelTrialSelections(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    options?: Omit<PackageNullModelTrialSelectionOptions, "kernelVersion">
  ): PackageNullModelTrialSelections;
  verifyPackageDepthNullModelTrialSelections(
    trialSelections: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    options?: Omit<PackageNullModelTrialSelectionOptions, "kernelVersion">
  ): PackageNullModelTrialSelections;
  evaluatePackageDepthNullModelBaseline(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    trialSelections: PackageNullModelTrialSelections,
    options?: Omit<PackageNullModelBaselineOptions, "kernelVersion">
  ): PackageNullModelBaseline;
  verifyPackageDepthNullModelBaseline(
    baseline: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    trialSelections: PackageNullModelTrialSelections,
    options?: Omit<PackageNullModelBaselineOptions, "kernelVersion">
  ): PackageNullModelBaseline;
  evaluatePackageDepthFunctional(
    loadedPackage: LoadedRulePackage,
    binding: PackageDepthCandidateBinding,
    levelClosures: PackageClosedLevel[],
    filter: PackageDepthCandidateFilterEvaluation,
    functionalId: string,
    options?: Omit<LoadedPackageVerificationOptions, "kernelVersion">
  ): PackageFunctionalEvaluation;
  constructPackageDepthCohorts(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    cohortRuleId: string,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageCohortPartition;
  verifyPackageDepthCohortPartition(
    partition: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageCohortPartition;
  rankPackageDepthSelector(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    partition: PackageCohortPartition,
    selectorId: string,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectorRanking;
  verifyPackageDepthSelectorRanking(
    ranking: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    partition: PackageCohortPartition,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectorRanking;
  evaluatePackageDepthSelectorSensitivity(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    partition: PackageCohortPartition,
    ranking: PackageSelectorRanking,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectorSensitivityReport;
  verifyPackageDepthSelectorSensitivity(
    sensitivity: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    partition: PackageCohortPartition,
    ranking: PackageSelectorRanking,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectorSensitivityReport;
  admitPackageDepthSelectors(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    selectorExecutions: PackageSelectorExecutionInput[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectorAdmission;
  verifyPackageDepthSelectorAdmission(
    admission: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    selectorExecutions: PackageSelectorExecutionInput[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectorAdmission;
  materializePackageDepthSelectedFormations(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectedFormations;
  verifyPackageDepthSelectedFormations(
    formations: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageSelectedFormations;
  extractPackageDepthDerivedProfiles(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDerivedProfiles;
  verifyPackageDepthDerivedProfiles(
    profiles: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDerivedProfiles;
  materializePackageDepthDerivedPopulation(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    profiles: PackageDerivedProfiles,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDerivedDepthPopulation;
  verifyPackageDepthDerivedPopulation(
    population: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    census: PackageDepthCandidateCensus,
    admission: PackageSelectorAdmission,
    formations: PackageSelectedFormations,
    profiles: PackageDerivedProfiles,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDerivedDepthPopulation;
  closePackageDepthLevel(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthLevelClosure;
  verifyPackageDepthLevelClosure(
    level: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levelClosures: PackageClosedLevel[],
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageDepthLevelClosure;
  createPackageLevelExplanationIndex(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    level: PackageClosedLevel,
    priorLevels?: PackageClosedLevel[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelExplanationIndex;
  verifyPackageLevelExplanationIndex(
    index: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    level: PackageClosedLevel,
    priorLevels?: PackageClosedLevel[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelExplanationIndex;
  explainPackageLevelCandidate(
    index: PackageLevelExplanationIndex,
    candidateId: CandidateId
  ): PackageLevelCandidateExplanation;
  createPackageLevelResultCensus(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    level: PackageClosedLevel,
    priorLevels?: PackageClosedLevel[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelResultCensus;
  verifyPackageLevelResultCensus(
    census: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    level: PackageClosedLevel,
    priorLevels?: PackageClosedLevel[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelResultCensus;
  createPackageRunArtifactBundle(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    levels: PackageClosedLevel[],
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageRunArtifactBundle;
  verifyPackageRunArtifactBundle(
    bundle: unknown
  ): PackageRunArtifactBundle;
  materializePackageRunArtifact(
    bundle: PackageRunArtifactBundle,
    path: string
  ): PackageRunArtifactMaterialization;
  createPackageRunArtifactStore(
    bundles: PackageRunArtifactBundle[]
  ): PackageRunArtifactStore;
  verifyPackageRunArtifactStore(
    store: unknown
  ): PackageRunArtifactStore;
  explainPackageRunCandidate(
    store: PackageRunArtifactStore,
    runHash: ContentHash,
    candidateId: CandidateId
  ): PackageRunCandidateExplanation;
  evaluatePackageSelectorSensitivity(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    partition: PackageCohortPartition,
    ranking: PackageSelectorRanking,
    options?: Omit<PackageSelectorSensitivityOptions, "kernelVersion">
  ): PackageSelectorSensitivityReport;
  verifyPackageSelectorSensitivity(
    sensitivity: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    partition: PackageCohortPartition,
    ranking: PackageSelectorRanking,
    options?: Omit<PackageSelectorSensitivityOptions, "kernelVersion">
  ): PackageSelectorSensitivityReport;
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
  createPackageNullModelPlan(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    options?: Omit<PackageNullModelPlanOptions, "kernelVersion">
  ): PackageNullModelPlan;
  verifyPackageNullModelPlan(
    plan: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    options?: Omit<PackageNullModelPlanOptions, "kernelVersion">
  ): PackageNullModelPlan;
  createPackageNullModelProposals(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    plan: PackageNullModelPlan,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelProposals;
  verifyPackageNullModelProposals(
    proposals: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    plan: PackageNullModelPlan,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelProposals;
  evaluatePackageNullModelTrialCensuses(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelTrialCensuses;
  verifyPackageNullModelTrialCensuses(
    trialCensuses: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    options?: Omit<PackageNullModelProposalOptions, "kernelVersion">
  ): PackageNullModelTrialCensuses;
  evaluatePackageNullModelTrialSelections(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    options?: Omit<PackageNullModelTrialSelectionOptions, "kernelVersion">
  ): PackageNullModelTrialSelections;
  verifyPackageNullModelTrialSelections(
    trialSelections: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    options?: Omit<PackageNullModelTrialSelectionOptions, "kernelVersion">
  ): PackageNullModelTrialSelections;
  evaluatePackageNullModelBaseline(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    trialSelections: PackageNullModelTrialSelections,
    options?: Omit<PackageNullModelBaselineOptions, "kernelVersion">
  ): PackageNullModelBaseline;
  verifyPackageNullModelBaseline(
    baseline: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    census: PackageCandidateCensus,
    admission: PackageSelectorAdmission,
    plan: PackageNullModelPlan,
    proposals: PackageNullModelProposals,
    trialCensuses: PackageNullModelTrialCensuses,
    trialSelections: PackageNullModelTrialSelections,
    options?: Omit<PackageNullModelBaselineOptions, "kernelVersion">
  ): PackageNullModelBaseline;
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
  freezeSourceClassificationAmendments(
    policy: FrozenSourceClassificationPolicy,
    annotations: FrozenSourceClassificationAnnotations,
    adjudication: FrozenSourceClassificationAdjudication,
    amendments: SourceClassificationAmendmentsInput
  ): FrozenSourceClassificationAmendments;
  verifySourceClassificationAmendments(
    policy: FrozenSourceClassificationPolicy,
    annotations: FrozenSourceClassificationAnnotations,
    adjudication: FrozenSourceClassificationAdjudication,
    amendments: FrozenSourceClassificationAmendments
  ): FrozenSourceClassificationAmendments;
  freezeSourceNodeResolutionPolicy(
    policy: SourceNodeResolutionPolicyInput
  ): FrozenSourceNodeResolutionPolicy;
  hash(domain: string, value: JsonValue): ContentHash;
  closeLevel(input: {
    package: LoadedRulePackage;
    config: RunConfigInput;
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">;
  }): PackageLevelClosure | PackageCurrentLevelFixpointClosure;
  closePackageCurrentLevelFixpoint(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    priorLevels?: PackageCurrentLevelFixpointClosure[],
    targetDepth?: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageCurrentLevelFixpointClosure;
  verifyPackageCurrentLevelFixpoint(
    level: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    priorLevels?: PackageCurrentLevelFixpointClosure[],
    targetDepth?: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageCurrentLevelFixpointClosure;
  closePackageLadder(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    depths: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageAnyLadderClosure;
  closeLadder(input: {
    package: LoadedRulePackage;
    config: RunConfigInput;
    depths: number;
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">;
  }): PackageAnyLadderClosure;
  verifyPackageLadderClosure(
    ladder: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    depths: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageAnyLadderClosure;
  testPackageProfileCollapse(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageProfileCollapseReport;
  verifyPackageProfileCollapse(
    report: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    targetDepth: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageProfileCollapseReport;
  testProfileCollapse(input: {
    package: LoadedRulePackage;
    config: RunConfigInput;
    targetDepth: number;
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">;
  }): PackageProfileCollapseReport;
  detectPackageLevelBoundaries(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    depths: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelBoundaryReport;
  verifyPackageLevelBoundaries(
    report: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    depths: number,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageLevelBoundaryReport;
  explain(input: {
    runHash: ContentHash;
    candidateId: CandidateId;
  }): Promise<PackageRunCandidateExplanation>;
  detectLevelBoundaries(input: {
    package: LoadedRulePackage;
    config: RunConfigInput;
    depths: number;
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">;
  }): PackageLevelBoundaryReport;
  materializePackageCarrierPromotions(
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    ladder: PackageLadderClosure,
    collapse: PackageProfileCollapseReport,
    requestedDepths: number,
    policy: PackageCarrierPromotionPolicy,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageCarrierPromotionSet;
  verifyPackageCarrierPromotions(
    promotions: unknown,
    loadedPackage: LoadedRulePackage,
    runConfig: RunConfigInput,
    ladder: PackageLadderClosure,
    collapse: PackageProfileCollapseReport,
    requestedDepths: number,
    policy: PackageCarrierPromotionPolicy,
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">
  ): PackageCarrierPromotionSet;
  promoteCarriers(input: {
    package: LoadedRulePackage;
    config: RunConfigInput;
    ladder: PackageLadderClosure;
    collapse: PackageProfileCollapseReport;
    depths: number;
    policy: PackageCarrierPromotionPolicy;
    options?: Omit<PackageLevelClosureOptions, "kernelVersion">;
  }): PackageCarrierPromotionSet;
}

export function createKernel(options?: {
  version?: string;
  artifactStore?: PackageRunArtifactStore;
}): Kernel;
export function validationIssue(code: string, path: string, message: string, details?: Record<string, unknown>): ValidationIssue;
