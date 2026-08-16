import { deepFreeze } from "@onto2d/kernel/canonical";

export const SHACL_VALIDATION_PROFILE_ID = "shacl10-core-structural-v1";
export const SHACL_PLAN_FORMAT = "onto2d-shacl-plan";
export const SHACL_PLAN_FORMAT_VERSION = "1";
export const SHACL_REPORT_FORMAT = "onto2d-shacl-validation-report";
export const SHACL_REPORT_FORMAT_VERSION = "1";

export const SHACL_VALIDATION_LIMITS = Object.freeze({
  maxNodeShapes: 1_000,
  maxPropertyShapes: 5_000,
  maxTargets: 10_000,
  maxPropertyReferences: 10_000,
  maxMessagesPerShape: 32,
  maxResults: 10_000,
  maxSubclassVisits: 100_000,
  maxTargetStatementScans: 1_000_000,
  maxShapeEvaluations: 1_000_000,
  maxValueChecks: 2_000_000
});

export const SHACL_VALIDATION_PROFILE = deepFreeze({
  id: SHACL_VALIDATION_PROFILE_ID,
  standard: "SHACL 1.0 Core",
  explicitShapeTypes: true,
  targetKinds: ["node", "class", "subjects-of", "objects-of"],
  pathKind: "iri-predicate",
  constraintKinds: ["min-count", "max-count", "datatype", "node-kind", "class"],
  classTraversal: "rdf:type/rdfs:subClassOf*",
  inference: false,
  sparql: false,
  rules: false,
  dereferencing: false,
  semanticMapping: false
});

export const NS = Object.freeze({
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  SH: "http://www.w3.org/ns/shacl#",
  XSD: "http://www.w3.org/2001/XMLSchema#"
});

export const IRI = Object.freeze({
  RDF_TYPE: `${NS.RDF}type`,
  RDFS_SUBCLASS: `${NS.RDFS}subClassOf`,
  XSD_BOOLEAN: `${NS.XSD}boolean`,
  XSD_INTEGER: `${NS.XSD}integer`,
  XSD_STRING: `${NS.XSD}string`,
  RDF_LANG_STRING: `${NS.RDF}langString`,
  NODE_SHAPE: `${NS.SH}NodeShape`,
  PROPERTY_SHAPE: `${NS.SH}PropertyShape`,
  TARGET_NODE: `${NS.SH}targetNode`,
  TARGET_CLASS: `${NS.SH}targetClass`,
  TARGET_SUBJECTS_OF: `${NS.SH}targetSubjectsOf`,
  TARGET_OBJECTS_OF: `${NS.SH}targetObjectsOf`,
  PROPERTY: `${NS.SH}property`,
  PATH: `${NS.SH}path`,
  MIN_COUNT: `${NS.SH}minCount`,
  MAX_COUNT: `${NS.SH}maxCount`,
  DATATYPE: `${NS.SH}datatype`,
  NODE_KIND: `${NS.SH}nodeKind`,
  CLASS: `${NS.SH}class`,
  SEVERITY: `${NS.SH}severity`,
  MESSAGE: `${NS.SH}message`,
  DEACTIVATED: `${NS.SH}deactivated`,
  VIOLATION: `${NS.SH}Violation`,
  WARNING: `${NS.SH}Warning`,
  INFO: `${NS.SH}Info`,
  BLANK_NODE: `${NS.SH}BlankNode`,
  IRI: `${NS.SH}IRI`,
  LITERAL: `${NS.SH}Literal`,
  BLANK_NODE_OR_IRI: `${NS.SH}BlankNodeOrIRI`,
  BLANK_NODE_OR_LITERAL: `${NS.SH}BlankNodeOrLiteral`,
  IRI_OR_LITERAL: `${NS.SH}IRIOrLiteral`,
  MIN_COUNT_COMPONENT: `${NS.SH}MinCountConstraintComponent`,
  MAX_COUNT_COMPONENT: `${NS.SH}MaxCountConstraintComponent`,
  DATATYPE_COMPONENT: `${NS.SH}DatatypeConstraintComponent`,
  NODE_KIND_COMPONENT: `${NS.SH}NodeKindConstraintComponent`,
  CLASS_COMPONENT: `${NS.SH}ClassConstraintComponent`
});

export const ALLOWED_SHACL_PREDICATES = new Set([
  IRI.TARGET_NODE,
  IRI.TARGET_CLASS,
  IRI.TARGET_SUBJECTS_OF,
  IRI.TARGET_OBJECTS_OF,
  IRI.PROPERTY,
  IRI.PATH,
  IRI.MIN_COUNT,
  IRI.MAX_COUNT,
  IRI.DATATYPE,
  IRI.NODE_KIND,
  IRI.CLASS,
  IRI.SEVERITY,
  IRI.MESSAGE,
  IRI.DEACTIVATED
]);

export const NODE_KINDS = new Set([
  IRI.BLANK_NODE,
  IRI.IRI,
  IRI.LITERAL,
  IRI.BLANK_NODE_OR_IRI,
  IRI.BLANK_NODE_OR_LITERAL,
  IRI.IRI_OR_LITERAL
]);

export const DATATYPE_CONSTRAINTS = new Set([
  IRI.XSD_STRING,
  IRI.RDF_LANG_STRING,
  IRI.XSD_BOOLEAN,
  IRI.XSD_INTEGER,
  `${NS.XSD}decimal`,
  `${NS.XSD}float`,
  `${NS.XSD}double`
]);

export const HASH_OPTIONS = Object.freeze({
  limits: Object.freeze({
    maxDepth: 48,
    maxEntries: 2_000_000,
    maxStringBytes: 1024 * 1024
  })
});

export const PLAN_DOMAIN = "onto2d:shacl-plan:v1";
export const RESULT_DOMAIN = "onto2d:shacl-result:v1";
export const REPORT_DOMAIN = "onto2d:shacl-validation-report:v1";
