import type {
  ContentHash,
  FrozenSourceClassificationAdjudication,
  FrozenSourceClassificationAnnotations,
  FrozenSourceClassificationPolicy,
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

export const SOURCE_CLASSIFICATION_VIEW_VERSION: "source-classification-view-v1";
export const SOURCE_CLASSIFIED_RELATIONS_VERSION: "source-classified-relations-v1";
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

export const CATALOG_ADAPTER_STATUS: "audit-active/classified-projection-active/migration-pending";
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
