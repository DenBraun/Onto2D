import { deepFreeze } from "@onto2d/kernel/canonical";

export const RDF_MAPPING_POLICY_FORMAT = "onto2d-rdf-mapping-policy";
export const RDF_MAPPING_POLICY_FORMAT_VERSION = "1";
export const RDF_MAPPING_ARTIFACT_FORMAT = "onto2d-rdf-mapping-artifact";
export const RDF_MAPPING_ARTIFACT_FORMAT_VERSION = "1";
export const RDF_MAPPING_PROFILE_ID = "rdf-to-model-pack-explicit-v1";

export const RDF_MAPPING_LIMITS = Object.freeze({
  maxNodeRules: 256,
  maxPredicateRules: 1_024,
  maxNodes: 100_000,
  maxEdges: 100_000,
  maxStatements: 100_000,
  maxIdentifierLength: 256,
  maxTextLength: 4_096
});

export const RDF_MAPPING_PROFILE = deepFreeze({
  id: RDF_MAPPING_PROFILE_ID,
  inputProfile: "rdf11-n-triples-safe-v1",
  validationProfile: "shacl10-core-structural-v1",
  classSelection: "explicit-rdf-type",
  nodeIdentity: "source-iri",
  edgeDirection: "rdf-subject-to-object",
  statementAccounting: "complete",
  shapeCoverage: "mapped-classes-and-predicates",
  labelDatatype: "http://www.w3.org/2001/XMLSchema#string",
  inference: false,
  dereferencing: false,
  blankNodeEntities: false,
  validatedOnly: true
});

export const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
export const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
export const SH_IRI = "http://www.w3.org/ns/shacl#IRI";

export const POLICY_DOMAIN = "onto2d:rdf-mapping-policy:v1";
export const EDGE_DOMAIN = "onto2d:rdf-mapping-edge:v1";
export const ARTIFACT_DOMAIN = "onto2d:rdf-mapping-artifact:v1";

export const HASH_OPTIONS = Object.freeze({
  limits: Object.freeze({
    maxDepth: 48,
    maxEntries: 2_000_000,
    maxStringBytes: 1024 * 1024
  })
});
