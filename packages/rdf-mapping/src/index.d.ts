import type {
  ContentHash,
  RdfImportArtifact
} from "@onto2d/rdf-import";
import type { ShaclValidationReport } from "@onto2d/shacl-validation";
import type {
  ModelPack,
  ModelPackModel
} from "@onto2d/model-pack";

export interface RdfMappingInputBindings {
  dataSourceId: string;
  shapesSourceId: string;
  dataImportHash: ContentHash;
  shapesImportHash: ContentHash;
  validationReportHash: ContentHash;
}

export interface RdfMappingLevelPolicy {
  kind: "constant";
  value: number;
  meaning: string;
}

export interface RdfMappingNodeRule {
  classIri: string;
  typeRole: string;
  scientificStatus: string;
}

export interface RdfMappingLabelRule {
  predicateIri: string;
  action: "label";
  required: boolean;
}

export interface RdfMappingEdgeRule {
  predicateIri: string;
  action: "edge";
  sourceClasses: string[];
  targetClasses: string[];
  relationLayer: string;
  relationRole: string;
}

export interface RdfMappingIgnoreRule {
  predicateIri: string;
  action: "ignore";
  reason: string;
}

export type RdfMappingPredicateRule =
  | RdfMappingLabelRule
  | RdfMappingEdgeRule
  | RdfMappingIgnoreRule;

export interface CreateRdfMappingPolicyInput {
  schemaVersion: "1";
  format: "onto2d-rdf-mapping-policy";
  formatVersion: "1";
  profile: "rdf-to-model-pack-explicit-v1";
  id: string;
  provenance: {
    title: string;
    sourceUri: string;
    sourceVersion: string;
    licenseUri: string;
    adaptation: string;
  };
  inputs: RdfMappingInputBindings;
  levelPolicy: RdfMappingLevelPolicy;
  nodeRules: RdfMappingNodeRule[];
  predicateRules: RdfMappingPredicateRule[];
}

export interface RdfMappingPolicy extends CreateRdfMappingPolicyInput {
  policyHash: ContentHash;
}

export interface RdfMappingArtifactIdentity {
  sourceHash: ContentHash;
  graphHash: ContentHash;
  importHash: ContentHash;
}

export interface RdfMappedNode {
  id: string;
  level: number;
  levelMeaning: string;
  typeRole: string;
  scientificStatus: string;
  label?: string;
  rdfSource: {
    termId: ContentHash;
    classIri: string;
    classStatementId: ContentHash;
    labelStatementId: ContentHash | null;
  };
}

export interface RdfMappedEdge {
  id: ContentHash;
  source: string;
  target: string;
  relationLayer: string;
  relationRole: string;
  rdfSource: {
    statementId: ContentHash;
    predicateIri: string;
  };
}

export interface RdfMappingStatementAccounting {
  statementId: ContentHash;
  predicateIri: string;
  occurrenceCount: number;
  disposition: "node-type" | "node-label" | "edge" | "ignored";
  rule: string;
  outputIds: string[];
}

export interface RdfMappingIgnoredStatement {
  statementId: ContentHash;
  predicateIri: string;
  reason: string;
}

export interface RdfMappingArtifact {
  schemaVersion: "1";
  format: "onto2d-rdf-mapping-artifact";
  formatVersion: "1";
  profile: "rdf-to-model-pack-explicit-v1";
  policyHash: ContentHash;
  inputs: {
    data: RdfMappingArtifactIdentity;
    shapes: RdfMappingArtifactIdentity;
    validation: {
      profile: "shacl10-core-structural-v1";
      planHash: ContentHash;
      reportHash: ContentHash;
      conforms: true;
    };
  };
  semantics: {
    classSelection: "explicit-rdf-type";
    nodeIdentity: "source-iri";
    edgeDirection: "rdf-subject-to-object";
    statementAccounting: "complete";
    shapeCoverage: "mapped-classes-and-predicates";
    inference: false;
    dereferencing: false;
    blankNodeEntities: false;
    validatedOnly: true;
  };
  nodes: RdfMappedNode[];
  edges: RdfMappedEdge[];
  statementAccounting: RdfMappingStatementAccounting[];
  ignoredStatements: RdfMappingIgnoredStatement[];
  statistics: {
    sourceStatementCount: number;
    statementCount: number;
    duplicateStatementCount: number;
    nodeCount: number;
    edgeCount: number;
    labelStatementCount: number;
    ignoredStatementCount: number;
  };
  mappingHash: ContentHash;
}

export interface RdfMappingLimits {
  maxNodeRules: number;
  maxPredicateRules: number;
  maxNodes: number;
  maxEdges: number;
  maxStatements: number;
  maxIdentifierLength: number;
  maxTextLength: number;
}

export class RdfMappingError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const RDF_MAPPING_POLICY_FORMAT: "onto2d-rdf-mapping-policy";
export const RDF_MAPPING_POLICY_FORMAT_VERSION: "1";
export const RDF_MAPPING_ARTIFACT_FORMAT: "onto2d-rdf-mapping-artifact";
export const RDF_MAPPING_ARTIFACT_FORMAT_VERSION: "1";
export const RDF_MAPPING_PROFILE_ID: "rdf-to-model-pack-explicit-v1";
export const RDF_MAPPING_LIMITS: Readonly<RdfMappingLimits>;
export const RDF_MAPPING_PROFILE: Readonly<{
  id: "rdf-to-model-pack-explicit-v1";
  inputProfile: "rdf11-n-triples-safe-v1";
  validationProfile: "shacl10-core-structural-v1";
  classSelection: "explicit-rdf-type";
  nodeIdentity: "source-iri";
  edgeDirection: "rdf-subject-to-object";
  statementAccounting: "complete";
  shapeCoverage: "mapped-classes-and-predicates";
  labelDatatype: "http://www.w3.org/2001/XMLSchema#string";
  inference: false;
  dereferencing: false;
  blankNodeEntities: false;
  validatedOnly: true;
}>;

export function createRdfMappingPolicy(
  input: CreateRdfMappingPolicyInput
): Readonly<RdfMappingPolicy>;
export function verifyRdfMappingPolicy(
  policy: RdfMappingPolicy
): Readonly<RdfMappingPolicy>;
export function mapRdfToOnto2D(
  data: RdfImportArtifact,
  shapes: RdfImportArtifact,
  report: ShaclValidationReport,
  policy: RdfMappingPolicy
): Readonly<RdfMappingArtifact>;
export function verifyRdfMappingArtifact(
  data: RdfImportArtifact,
  shapes: RdfImportArtifact,
  report: ShaclValidationReport,
  policy: RdfMappingPolicy,
  artifact: RdfMappingArtifact
): Readonly<RdfMappingArtifact>;
export function buildRdfMappedModelPack(
  data: RdfImportArtifact,
  shapes: RdfImportArtifact,
  report: ShaclValidationReport,
  policy: RdfMappingPolicy,
  model: ModelPackModel
): Readonly<ModelPack>;
