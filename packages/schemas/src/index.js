const schema = (name) => new URL(`../schemas/${name}.schema.json`, import.meta.url);

export const SCHEMA_VERSION = "1";

export const schemaUrls = Object.freeze({
  artifactRef: schema("artifact-ref"),
  quantity: schema("quantity"),
  evidence: schema("evidence"),
  claim: schema("claim"),
  ontologyCoordinate: schema("ontology-coordinate"),
  ontologyAxis: schema("ontology-axis"),
  sourceRelation: schema("source-relation"),
  clusterProvenance: schema("cluster-provenance"),
  profile: schema("profile"),
  primitive: schema("primitive"),
  predicate: schema("predicate"),
  identityPolicy: schema("identity-policy"),
  graphPolicy: schema("graph-policy"),
  candidate: schema("candidate"),
  skeleton: schema("skeleton"),
  skeletonEnumerationResult: schema("skeleton-enumeration-result"),
  candidateStoreSnapshot: schema("candidate-store-snapshot"),
  functional: schema("functional"),
  cohortRule: schema("cohort-rule"),
  selector: schema("selector"),
  oracleRequest: schema("oracle-request"),
  oracleResponse: schema("oracle-response"),
  sensitivityReport: schema("sensitivity-report"),
  semanticManifest: schema("semantic-manifest"),
  runConfig: schema("run-config"),
  kernelPackage: schema("kernel-package")
});
