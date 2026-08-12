import type {
  ArtifactRef,
  ClusterDisposition,
  ContentHash,
  FrozenSourceClassificationAdjudication,
  FrozenSourceClassificationAmendments,
  FrozenSourceClassificationAnnotations,
  FrozenSourceClassificationPolicy,
  FrozenSourceNodeResolutionPolicy,
  JsonValue,
  SourceClassificationVisibleField,
  SourceRelationKind
} from "@onto2d/kernel";

export interface SourceClassificationViewRelationInput {
  id: string;
  source: string;
  target: string;
  fields: { source: string; target: string } &
    Partial<Record<SourceClassificationVisibleField, JsonValue>>;
}

export interface SourceClassificationView {
  schemaVersion: "1";
  builder: "source-classification-view-v1";
  policyHash: ContentHash;
  relations: SourceClassificationViewRelationInput[];
  statistics: { relationCount: number };
  viewHash: ContentHash;
}

export interface ProjectedSourceRelation {
  id: string;
  source: string;
  target: string;
  kind: SourceRelationKind;
  decisionStatus: "agreement" | "adjudicated";
  rawKinds: SourceRelationKind[];
}

export interface SourceSccComponent {
  componentId: ContentHash;
  members: string[];
  internalRelationIds: string[];
  cyclic: boolean;
}

export interface SourceSccProjection {
  name: "generative" | "formation-support";
  includedKinds: SourceRelationKind[];
  relationIds: string[];
  components: SourceSccComponent[];
  cyclicComponentIds: ContentHash[];
}

export interface SourceClassifiedRelationsArtifact {
  schemaVersion: "1";
  builder: "source-classified-relations-v1";
  policyHash: ContentHash;
  viewHash: ContentHash;
  annotationHash: ContentHash;
  adjudicationHash: ContentHash;
  relations: ProjectedSourceRelation[];
  projections: {
    generative: SourceSccProjection & { name: "generative" };
    formationSupport: SourceSccProjection & { name: "formation-support" };
  };
  statistics: {
    nodeCount: number;
    relationCount: number;
    classifiedByKind: Record<SourceRelationKind, number>;
    generativeCyclicComponentCount: number;
    formationSupportCyclicComponentCount: number;
  };
  projectionHash: ContentHash;
}

export interface EffectiveProjectedSourceRelation
  extends ProjectedSourceRelation {
  frozenKind: SourceRelationKind;
  finalStateHash: ContentHash;
  changeIds: ContentHash[];
}

export interface SourceEffectiveClassifiedRelationsArtifact {
  schemaVersion: "1";
  builder: "source-effective-classified-relations-v1";
  policyHash: ContentHash;
  viewHash: ContentHash;
  annotationHash: ContentHash;
  adjudicationHash: ContentHash;
  amendmentsHash: ContentHash;
  frozenProjectionHash: ContentHash;
  relations: EffectiveProjectedSourceRelation[];
  projections: {
    generative: SourceSccProjection & { name: "generative" };
    formationSupport: SourceSccProjection & { name: "formation-support" };
  };
  statistics: {
    nodeCount: number;
    relationCount: number;
    classifiedByKind: Record<SourceRelationKind, number>;
    changeCount: number;
    amendedRelationCount: number;
    generativeCyclicComponentCount: number;
    formationSupportCyclicComponentCount: number;
  };
  projectionHash: ContentHash;
}

export type SourceCurrentClassifiedRelationsArtifact =
  | SourceClassifiedRelationsArtifact
  | SourceEffectiveClassifiedRelationsArtifact;

export const SOURCE_CLASSIFICATION_VIEW_VERSION: "source-classification-view-v1";
export const SOURCE_CLASSIFIED_RELATIONS_VERSION: "source-classified-relations-v1";
export const SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS_VERSION:
  "source-effective-classified-relations-v1";
export const SOURCE_PROJECTION_LIMITS: Readonly<{
  maxRelations: 10000;
  maxIdentifierLength: 1024;
}>;

export function createSourceClassificationView(
  policy: FrozenSourceClassificationPolicy,
  relations: SourceClassificationViewRelationInput[]
): SourceClassificationView;

export function buildSourceClassifiedRelations(
  policy: FrozenSourceClassificationPolicy,
  view: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication
): SourceClassifiedRelationsArtifact;

export function buildSourceEffectiveClassifiedRelations(
  policy: FrozenSourceClassificationPolicy,
  view: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments
): SourceEffectiveClassifiedRelationsArtifact;

export function verifySourceEffectiveClassifiedRelations(
  policy: FrozenSourceClassificationPolicy,
  view: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceEffectiveClassifiedRelationsArtifact
): SourceEffectiveClassifiedRelationsArtifact;

export interface SourceNodeInventoryEntry {
  id: string;
  identityHash: ContentHash;
  sourceArtifact: ArtifactRef;
}

export interface SourceComponentDecisionInput {
  componentId: ContentHash;
  disposition: ClusterDisposition;
  rationaleArtifact: ArtifactRef;
}

export interface SourceComponentDecision extends SourceComponentDecisionInput {
  members: string[];
  internalRelationIds: string[];
}

export type SourceRelationDestination =
  | "inter-cluster"
  | "internal"
  | "typed-explanation";

export interface SourceRelationDestinationInput {
  relationId: string;
  destination: SourceRelationDestination;
}

export interface ResolvedSourceRelation extends SourceRelationDestinationInput {
  kind: SourceRelationKind;
  source: string;
  target: string;
  sourceVertex: ContentHash;
  targetVertex: ContentHash;
}

export interface SourceResolutionVertex {
  vertexId: ContentHash;
  kind: "source-node" | "condensed-cluster";
  disposition?: ClusterDisposition;
  members: string[];
  internalRelationIds: string[];
  internalOrder: "defined" | "undefined";
}

export interface SourceNodeResolutionArtifact {
  schemaVersion: "1";
  resolver: "source-node-resolution-v1";
  classificationPolicyHash: ContentHash;
  nodeResolutionPolicyHash: ContentHash;
  projectionHash: ContentHash;
  sourceNodes: SourceNodeInventoryEntry[];
  componentDecisions: SourceComponentDecision[];
  relationDestinations: ResolvedSourceRelation[];
  vertices: SourceResolutionVertex[];
  memberIndex: { sourceId: string; vertexId: ContentHash }[];
  counts: {
    sourceNodes: number;
    sourceRelations: number;
    nontrivialComponents: number;
    vertices: number;
    condensedClusters: number;
    internalRelations: number;
    interClusterRelations: number;
    typedExplanationRelations: number;
  };
  resolutionHash: ContentHash;
}

export interface SourceCondensationArtifact {
  schemaVersion: "1";
  condenser: "source-condensation-v1";
  classificationPolicyHash: ContentHash;
  nodeResolutionPolicyHash: ContentHash;
  projectionHash: ContentHash;
  resolutionHash: ContentHash;
  vertices: SourceResolutionVertex[];
  memberIndex: { sourceId: string; vertexId: ContentHash }[];
  quotient: {
    vertexIds: ContentHash[];
    generativeEdges: {
      relationId: string;
      sourceVertex: ContentHash;
      targetVertex: ContentHash;
    }[];
    topologicalOrder: ContentHash[];
  };
  relationLayers: Record<SourceRelationKind, ResolvedSourceRelation[]>;
  counts: {
    sourceNodes: number;
    sourceRelations: number;
    vertices: number;
    condensedClusters: number;
    quotientGenerativeRelations: number;
    internalRelations: number;
    typedExplanationRelations: number;
  };
  condensationHash: ContentHash;
}

export interface SourceMigrationRawComponent {
  componentId: ContentHash;
  members: string[];
  internalRelationIds: string[];
}

export interface SourceMigrationThresholdSignal {
  actual: number;
  maximum: number;
  exceeded: boolean;
}

export interface SourceMigrationReconciliationReport {
  schemaVersion: "1";
  reporter: "source-migration-reconciliation-v1";
  classificationPolicyHash: ContentHash;
  annotationHash: ContentHash;
  adjudicationHash: ContentHash;
  amendmentsHash: ContentHash;
  projectionHash: ContentHash;
  resolutionHash: ContentHash;
  condensationHash: ContentHash;
  rawGraph: {
    nodes: number;
    relations: number;
    nontrivialSccs: number;
    sizeHistogram: Record<string, number>;
    largestScc: number;
    twoNodeSccs: number;
    components: SourceMigrationRawComponent[];
  };
  classification: {
    edgesByKind: Record<SourceRelationKind, number>;
    blindnessStatus:
      | "prospective-blind"
      | "deterministic-precommitted"
      | "historically-exposed";
    disagreementCount: number;
    disagreementRatio: number;
    generativeCyclicComponents: number;
    formationSupportCyclicComponents: number;
  };
  resolution: {
    vertices: number;
    condensedClusters: number;
    constitutiveClusters: number;
    clusteredSourceRecords: number;
    clusteredSourceRecordRatio: number;
    constitutiveClusterSizeHistogram: Record<string, number>;
    destinationCounts: Record<SourceRelationDestination, number>;
    nonformationResolvedRawSccs: number;
    nonformationLayerResolutionShare: number;
    descriptiveResolvedRawSccs: number;
    descriptiveResolutionShare: number;
  };
  riskSignals: {
    historicalExposure: boolean;
    classificationDisagreement: SourceMigrationThresholdSignal;
    descriptiveResolution: SourceMigrationThresholdSignal;
    postUnblindingReclassification: SourceMigrationThresholdSignal;
    fittingRisk: "not-flagged" | "elevated";
    fittingRiskReasons: (
      | "historically-exposed"
      | "classification-disagreement-threshold-exceeded"
      | "descriptive-resolution-threshold-exceeded"
      | "post-unblinding-reclassification-threshold-exceeded"
    )[];
    effectiveClassification: "current";
  };
  reconciliation: {
    nodesExactlyOnce: true;
    relationsExactlyOnce: true;
    quotientIsDag: true;
  };
  reportHash: ContentHash;
}

export type SourceSccPrimaryResolution =
  | "distributed-structure-merge"
  | "constitutive-condensation"
  | "generative-condensation"
  | "mixed-condensation"
  | "nonformation-layer-separation"
  | "post-unblinding-reclassification";

export interface SourceRawSccDispositionInput {
  rawComponentId: ContentHash;
  primaryResolution: SourceSccPrimaryResolution;
  resultingCluster?: ContentHash;
  rationaleArtifact: ArtifactRef;
}

export interface SourceSccDisposition extends SourceRawSccDispositionInput {
  members: string[];
  edgeIds: string[];
}

export interface SourceCatalogueLevel {
  sourceId: string;
  catalogueLevel: number;
}

export interface SourceMigrationMetricsInput {
  schemaVersion: "1";
  reconciliationHash: ContentHash;
  rawSccDispositions: SourceRawSccDispositionInput[];
  catalogueLevels: SourceCatalogueLevel[];
}

export interface SourceMigrationMetricsArtifact {
  schemaVersion: "1";
  builder: "source-migration-metrics-v1";
  classificationPolicyHash: ContentHash;
  amendmentsHash: ContentHash;
  reconciliationHash: ContentHash;
  rawNodes: number;
  rawEdges: number;
  rawNontrivialSccs: number;
  rawSccSizeHistogram: Record<string, number>;
  largestRawScc: number;
  twoNodeSccs: number;
  classifiedEdges: Record<SourceRelationKind, number>;
  blindnessStatus:
    | "prospective-blind"
    | "deterministic-precommitted"
    | "historically-exposed";
  classificationDisagreementRatio: number;
  postUnblindingChanges: number;
  dispositions: SourceSccDisposition[];
  nonformationLayerResolutionShare: number;
  descriptiveResolutionShare: number;
  postUnblindingReclassificationShare: number;
  condensedClusters: number;
  constitutiveClusters: number;
  constitutiveClusterSizeHistogram: Record<string, number>;
  crossCatalogueLevelClusters: number;
  clusteredSourceRecordRatio: number;
  catalogueLevels: SourceCatalogueLevel[];
  riskPolicyHash: ContentHash;
  fittingRisk: "not-flagged" | "elevated";
  fittingRiskReasons: (
    | "historically-exposed"
    | "classification-disagreement-threshold-exceeded"
    | "descriptive-resolution-threshold-exceeded"
    | "post-unblinding-reclassification-threshold-exceeded"
  )[];
  metricsHash: ContentHash;
}

export interface SourceMigrationNodeExplanation {
  sourceId: string;
  identityHash: ContentHash;
  sourceArtifact: ArtifactRef;
  catalogueLevel: number;
  vertexId: ContentHash;
  vertexKind: "source-node" | "condensed-cluster";
  clusterDisposition?: ClusterDisposition;
  vertexMembers: string[];
  rawComponentIds: ContentHash[];
  inboundRelationIds: string[];
  outboundRelationIds: string[];
}

export interface SourceMigrationRelationExplanation {
  relationId: string;
  source: string;
  target: string;
  frozenKind: SourceRelationKind;
  effectiveKind: SourceRelationKind;
  decisionStatus: "agreement" | "adjudicated";
  rawKinds: SourceRelationKind[];
  finalStateHash: ContentHash;
  changeIds: ContentHash[];
  sourceVertex: ContentHash;
  targetVertex: ContentHash;
  destination: SourceRelationDestination;
  rawComponentIds: ContentHash[];
}

export interface SourceMigrationExplanationIndex {
  schemaVersion: "1";
  builder: "source-migration-explanation-index-v1";
  classificationPolicyHash: ContentHash;
  amendmentsHash: ContentHash;
  projectionHash: ContentHash;
  resolutionHash: ContentHash;
  condensationHash: ContentHash;
  reconciliationHash: ContentHash;
  metricsHash: ContentHash;
  nodes: SourceMigrationNodeExplanation[];
  relations: SourceMigrationRelationExplanation[];
  rawComponents: SourceSccDisposition[];
  statistics: {
    sourceNodeCount: number;
    sourceRelationCount: number;
    rawComponentCount: number;
    condensedClusterCount: number;
    amendedRelationCount: number;
  };
  indexHash: ContentHash;
}

export type SourceMigrationExplanationQuery =
  | { kind: "source-node"; id: string }
  | { kind: "source-relation"; id: string }
  | { kind: "raw-component"; id: ContentHash };

export interface SourceMigrationExplanation {
  schemaVersion: "1";
  reporter: "source-migration-explanation-v1";
  indexHash: ContentHash;
  query: SourceMigrationExplanationQuery;
  result:
    | SourceMigrationNodeExplanation
    | SourceMigrationRelationExplanation
    | SourceSccDisposition;
  explanationHash: ContentHash;
}

export interface SourceMigrationExplanationSession {
  readonly indexHash: ContentHash;
  explain(query: SourceMigrationExplanationQuery): SourceMigrationExplanation;
}

export interface SourceClusterConcentrationDefinition {
  version: string;
  frozenAt: string;
  statement: string;
  clusterLocationsSeenBeforeFreeze: false;
  exposureDeclaration: string;
  bottleneckArtifact: ArtifactRef;
  concentratedAtOrAbove: number;
  depletedAtOrBelow: number;
}

export interface SourceClusterConcentrationPointInput {
  depth: number;
  depthBasis: ContentHash;
  stratificationVertices: number;
  sourceVertexIds: ContentHash[];
  bottleneck: boolean;
}

export interface SourceClusterConcentrationInput {
  schemaVersion: "1";
  metricsHash: ContentHash;
  definition: SourceClusterConcentrationDefinition;
  points: SourceClusterConcentrationPointInput[];
}

export interface SourceClusterConcentrationPoint
  extends SourceClusterConcentrationPointInput {
  sourceRecords: number;
  constitutiveClusters: number;
  constitutiveMembers: number;
  constitutiveClusterDensity: number;
  constitutiveMemberShare: number | null;
}

export interface SourceClusterConcentrationArtifact {
  schemaVersion: "1";
  builder: "source-cluster-concentration-v1";
  metricsHash: ContentHash;
  resolutionHash: ContentHash;
  definition: SourceClusterConcentrationDefinition;
  definitionHash: ContentHash;
  points: SourceClusterConcentrationPoint[];
  pooled: {
    bottleneck: {
      sourceRecords: number;
      constitutiveMembers: number;
      constitutiveMemberShare: number | null;
    };
    other: {
      sourceRecords: number;
      constitutiveMembers: number;
      constitutiveMemberShare: number | null;
    };
  };
  enrichmentRatio: number | null;
  nullModel: { status: "not-run" };
  interpretation: "concentrated" | "uniform" | "depleted" | "indeterminate";
  notes: ("enrichment-ratio-denominator-zero-or-population-missing")[];
  concentrationHash: ContentHash;
}

export const SOURCE_NODE_RESOLUTION_VERSION: "source-node-resolution-v1";
export const SOURCE_CONDENSATION_VERSION: "source-condensation-v1";
export const SOURCE_MIGRATION_RECONCILIATION_VERSION:
  "source-migration-reconciliation-v1";
export const SOURCE_MIGRATION_METRICS_VERSION: "source-migration-metrics-v1";
export const SOURCE_MIGRATION_EXPLANATION_INDEX_VERSION:
  "source-migration-explanation-index-v1";
export const SOURCE_MIGRATION_EXPLANATION_VERSION:
  "source-migration-explanation-v1";
export const SOURCE_CLUSTER_CONCENTRATION_VERSION:
  "source-cluster-concentration-v1";
export const SOURCE_CLUSTER_CONCENTRATION_LIMITS: Readonly<{
  maxPoints: 20000;
  maxVertices: 20000;
  maxDepth: 1000000;
  maxIdentifierLength: 1024;
  maxTextLength: 16384;
}>;
export const SOURCE_MIGRATION_METRICS_LIMITS: Readonly<{
  maxNodes: 20000;
  maxRawComponents: 20000;
  maxCatalogueLevel: 1000000;
  maxIdentifierLength: 1024;
}>;
export const SOURCE_CONDENSATION_LIMITS: Readonly<{
  maxNodes: 20000;
  maxRelations: 10000;
  maxIdentifierLength: 1024;
}>;

export function resolveSourceNodes(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  sourceNodes: SourceNodeInventoryEntry[],
  componentDecisions: SourceComponentDecisionInput[],
  relationDestinations: SourceRelationDestinationInput[],
  amendments?: FrozenSourceClassificationAmendments
): SourceNodeResolutionArtifact;

export function resolveSourceNodes(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceEffectiveClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  sourceNodes: SourceNodeInventoryEntry[],
  componentDecisions: SourceComponentDecisionInput[],
  relationDestinations: SourceRelationDestinationInput[],
  amendments: FrozenSourceClassificationAmendments
): SourceNodeResolutionArtifact;

export function verifySourceNodeResolution(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  amendments?: FrozenSourceClassificationAmendments
): SourceNodeResolutionArtifact;

export function verifySourceNodeResolution(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceEffectiveClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  amendments: FrozenSourceClassificationAmendments
): SourceNodeResolutionArtifact;

export function condenseSourceRelations(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  amendments?: FrozenSourceClassificationAmendments
): SourceCondensationArtifact;

export function condenseSourceRelations(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceEffectiveClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  amendments: FrozenSourceClassificationAmendments
): SourceCondensationArtifact;

export function verifySourceCondensation(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  amendments?: FrozenSourceClassificationAmendments
): SourceCondensationArtifact;

export function verifySourceCondensation(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  classifiedRelations: SourceEffectiveClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  amendments: FrozenSourceClassificationAmendments
): SourceCondensationArtifact;

export function createSourceMigrationReconciliationReport(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact
): SourceMigrationReconciliationReport;

export function verifySourceMigrationReconciliationReport(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  report: SourceMigrationReconciliationReport
): SourceMigrationReconciliationReport;

export function createSourceMigrationMetrics(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  input: SourceMigrationMetricsInput
): SourceMigrationMetricsArtifact;

export function verifySourceMigrationMetrics(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  metrics: SourceMigrationMetricsArtifact
): SourceMigrationMetricsArtifact;

export function createSourceMigrationExplanationIndex(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  metrics: SourceMigrationMetricsArtifact
): SourceMigrationExplanationIndex;

export function verifySourceMigrationExplanationIndex(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  metrics: SourceMigrationMetricsArtifact,
  index: SourceMigrationExplanationIndex
): SourceMigrationExplanationIndex;

export function createSourceMigrationExplanationSession(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  metrics: SourceMigrationMetricsArtifact,
  index: SourceMigrationExplanationIndex
): SourceMigrationExplanationSession;

export function createSourceClusterConcentration(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  metrics: SourceMigrationMetricsArtifact,
  input: SourceClusterConcentrationInput
): SourceClusterConcentrationArtifact;

export function verifySourceClusterConcentration(
  classificationPolicy: FrozenSourceClassificationPolicy,
  classificationView: SourceClassificationView,
  annotations: FrozenSourceClassificationAnnotations,
  adjudication: FrozenSourceClassificationAdjudication,
  amendments: FrozenSourceClassificationAmendments,
  classifiedRelations: SourceCurrentClassifiedRelationsArtifact,
  nodeResolutionPolicy: FrozenSourceNodeResolutionPolicy,
  resolution: SourceNodeResolutionArtifact,
  condensation: SourceCondensationArtifact,
  reconciliation: SourceMigrationReconciliationReport,
  metrics: SourceMigrationMetricsArtifact,
  concentration: SourceClusterConcentrationArtifact
): SourceClusterConcentrationArtifact;

export const CATALOG_ADAPTER_STATUS: "audit-active/classified-projection-active/effective-reprojection-active/node-resolution-active/condensation-active/reconciliation-diagnostics-active/migration-metrics-active/source-explanations-active/cluster-concentration-active/migration-inputs-pending";
export const CATALOG_ADAPTER_CAPABILITIES: Readonly<{
  implemented: readonly string[];
  pending: readonly string[];
}>;

export function catalogueNodeCode(node: { Level: number; Id: number }): string;
export function loadSourceCatalogue(options: { catalogueDirectory: string }): Promise<{
  levels: Record<string, unknown>[][];
  descriptions: Record<string, unknown>;
  levelFiles: string[];
}>;
export function auditSourceCatalogue(
  catalogue: { levels: Record<string, unknown>[][]; descriptions: Record<string, unknown> },
  options?: { weightTolerance?: number }
): {
  catalogue: { levelCount: number; nodeCount: number; edgeCount: number };
  summary: Record<string, number>;
  findings: Record<string, unknown[]>;
  nontrivialSccs: string[][];
};
