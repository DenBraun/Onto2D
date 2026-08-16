import type {
  ContentHash,
  RdfIriTerm,
  RdfImportArtifact,
  RdfObjectTerm,
  RdfSubjectTerm
} from "@onto2d/rdf-import";

export interface ShaclArtifactIdentity {
  sourceHash: ContentHash;
  graphHash: ContentHash;
  importHash: ContentHash;
}

export interface ShaclMessage {
  value: string;
  language: string | null;
}

export interface ShaclConstraints {
  minCount: number | null;
  maxCount: number | null;
  datatype: string | null;
  nodeKind: string | null;
  class: string | null;
}

export type ShaclTarget =
  | { kind: "node"; term: RdfObjectTerm }
  | { kind: "class"; class: string }
  | { kind: "subjects-of"; predicate: string }
  | { kind: "objects-of"; predicate: string };

export interface ShaclCompiledShapeBase {
  id: ContentHash;
  term: RdfSubjectTerm;
  constraints: ShaclConstraints;
  severity: string;
  messages: ShaclMessage[];
  deactivated: boolean;
}

export interface ShaclCompiledNodeShape extends ShaclCompiledShapeBase {
  targets: ShaclTarget[];
  propertyShapeIds: ContentHash[];
}

export interface ShaclCompiledPropertyShape extends ShaclCompiledShapeBase {
  path: RdfIriTerm;
}

export interface ShaclPlan {
  schemaVersion: "1";
  format: "onto2d-shacl-plan";
  formatVersion: "1";
  profile: "shacl10-core-structural-v1";
  shapesIdentity: ShaclArtifactIdentity;
  nodeShapes: ShaclCompiledNodeShape[];
  propertyShapes: ShaclCompiledPropertyShape[];
  statistics: {
    nodeShapeCount: number;
    propertyShapeCount: number;
    targetCount: number;
    propertyReferenceCount: number;
    deactivatedShapeCount: number;
  };
  planHash: ContentHash;
}

export interface ShaclValidationResult {
  id: ContentHash;
  focusNode: RdfObjectTerm;
  resultPath: RdfIriTerm | null;
  value: RdfObjectTerm | null;
  sourceShape: RdfSubjectTerm;
  sourceConstraintComponent: string;
  severity: string;
  messages: ShaclMessage[];
}

export interface ShaclValidationReport {
  schemaVersion: "1";
  format: "onto2d-shacl-validation-report";
  formatVersion: "1";
  profile: "shacl10-core-structural-v1";
  dataIdentity: ShaclArtifactIdentity;
  shapesIdentity: ShaclArtifactIdentity;
  planHash: ContentHash;
  conforms: boolean;
  results: ShaclValidationResult[];
  statistics: {
    evaluatedNodeShapeCount: number;
    evaluatedFocusNodeCount: number;
    resultCount: number;
    violationCount: number;
    warningCount: number;
    infoCount: number;
    otherSeverityCount: number;
  };
  reportHash: ContentHash;
}

export interface ShaclValidationOptions {
  maxResults?: number;
}

export interface ShaclValidationLimits {
  maxNodeShapes: number;
  maxPropertyShapes: number;
  maxTargets: number;
  maxPropertyReferences: number;
  maxMessagesPerShape: number;
  maxResults: number;
  maxSubclassVisits: number;
  maxTargetStatementScans: number;
  maxShapeEvaluations: number;
  maxValueChecks: number;
}

export class ShaclValidationError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const SHACL_VALIDATION_PROFILE_ID: "shacl10-core-structural-v1";
export const SHACL_PLAN_FORMAT: "onto2d-shacl-plan";
export const SHACL_PLAN_FORMAT_VERSION: "1";
export const SHACL_REPORT_FORMAT: "onto2d-shacl-validation-report";
export const SHACL_REPORT_FORMAT_VERSION: "1";
export const SHACL_VALIDATION_LIMITS: Readonly<ShaclValidationLimits>;
export const SHACL_VALIDATION_PROFILE: Readonly<{
  id: "shacl10-core-structural-v1";
  standard: "SHACL 1.0 Core";
  explicitShapeTypes: true;
  targetKinds: readonly ["node", "class", "subjects-of", "objects-of"];
  pathKind: "iri-predicate";
  constraintKinds: readonly ["min-count", "max-count", "datatype", "node-kind", "class"];
  classTraversal: "rdf:type/rdfs:subClassOf*";
  inference: false;
  sparql: false;
  rules: false;
  dereferencing: false;
  semanticMapping: false;
}>;

export function compileShaclShapes(shapes: RdfImportArtifact): Readonly<ShaclPlan>;
export function verifyShaclPlan(
  shapes: RdfImportArtifact,
  plan: ShaclPlan
): Readonly<ShaclPlan>;
export function validateShacl(
  data: RdfImportArtifact,
  shapes: RdfImportArtifact,
  options?: ShaclValidationOptions
): Readonly<ShaclValidationReport>;
export function validateShaclPlan(
  data: RdfImportArtifact,
  shapes: RdfImportArtifact,
  plan: ShaclPlan,
  options?: ShaclValidationOptions
): Readonly<ShaclValidationReport>;
export function verifyShaclValidationReport(
  data: RdfImportArtifact,
  shapes: RdfImportArtifact,
  report: ShaclValidationReport
): Readonly<ShaclValidationReport>;
