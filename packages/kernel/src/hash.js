import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { canonicalBytes } from "./canonical.js";
import { KernelError } from "./errors.js";

const DOMAIN_PATTERN = /^onto2d:[a-z0-9]+(?:-[a-z0-9]+)*:v[1-9][0-9]*$/;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const encoder = new TextEncoder();

export const HASH_DOMAINS = Object.freeze({
  ARTIFACT: "onto2d:artifact:v1",
  CANDIDATE: "onto2d:candidate:v1",
  CANDIDATE_RESUME_CHECKPOINT: "onto2d:candidate-resume-checkpoint:v1",
  CANDIDATE_RESUME_INPUT: "onto2d:candidate-resume-input:v1",
  CANDIDATE_RESUME_STEP: "onto2d:candidate-resume-step:v1",
  CANDIDATE_RESUME_TRANSCRIPT: "onto2d:candidate-resume-transcript:v1",
  CLUSTER: "onto2d:cluster:v1",
  COHORT: "onto2d:cohort:v1",
  COHORT_RESOURCE: "onto2d:cohort-resource:v1",
  DEPTH_BASIS: "onto2d:depth-basis:v1",
  DEPTH_POPULATION: "onto2d:depth-population:v1",
  DERIVED_PROFILE_EXTRACTION: "onto2d:derived-profile-extraction:v1",
  ELEMENT: "onto2d:element:v1",
  PREDICATE_EXPRESSION: "onto2d:predicate-expression:v1",
  PREDICATE_EXPRESSION_ANALYSIS: "onto2d:predicate-expression-analysis:v1",
  PREDICATE_GRAPH_EVALUATION: "onto2d:predicate-graph-evaluation:v1",
  PREDICATE_LOCAL_EVALUATION: "onto2d:predicate-local-evaluation:v19",
  PERTURBATION_CONTEXT: "onto2d:perturbation-context:v2",
  PERTURBATION_SAMPLE_DRAW: "onto2d:perturbation-sample-draw:v1",
  PREDICATE_NUMERIC_BINDING: "onto2d:predicate-numeric-binding:v1",
  PREDICATE_PLAN: "onto2d:predicate-plan:v1",
  PARTIAL_PREDICATE_EVALUATION: "onto2d:partial-predicate-evaluation:v1",
  PARTIAL_PREDICATE_GRAPH: "onto2d:partial-predicate-graph:v1",
  VALUE_EXPRESSION: "onto2d:value-expression:v1",
  VALUE_EXPRESSION_ANALYSIS: "onto2d:value-expression-analysis:v1",
  IDENTITY_POLICY: "onto2d:identity-policy:v1",
  PACKAGE_LEVEL_RESULT: "onto2d:package-level-result:v1",
  PACKAGE_LEVEL_RESULT_CENSUS: "onto2d:package-level-result-census:v1",
  PACKAGE_NULL_MODEL_CARRIER: "onto2d:package-null-model-carrier:v1",
  PACKAGE_NULL_MODEL_BASELINE: "onto2d:package-null-model-baseline:v1",
  PACKAGE_NULL_MODEL_DISTRIBUTION:
    "onto2d:package-null-model-distribution:v1",
  PACKAGE_NULL_MODEL_DRAW: "onto2d:package-null-model-draw:v1",
  PACKAGE_NULL_MODEL_OCCURRENCE: "onto2d:package-null-model-occurrence:v1",
  PACKAGE_NULL_MODEL_PLAN: "onto2d:package-null-model-plan:v1",
  PACKAGE_NULL_MODEL_PROPOSALS: "onto2d:package-null-model-proposals:v1",
  PACKAGE_NULL_MODEL_STREAM: "onto2d:package-null-model-stream:v1",
  PACKAGE_NULL_MODEL_TRIAL: "onto2d:package-null-model-trial:v1",
  PACKAGE_NULL_MODEL_TRIAL_CENSUS:
    "onto2d:package-null-model-trial-census:v1",
  PACKAGE_NULL_MODEL_TRIAL_CENSUSES:
    "onto2d:package-null-model-trial-censuses:v1",
  PACKAGE_NULL_MODEL_TRIAL_SELECTION:
    "onto2d:package-null-model-trial-selection:v1",
  PACKAGE_NULL_MODEL_TRIAL_SELECTIONS:
    "onto2d:package-null-model-trial-selections:v1",
  PACKAGE_NULL_MODEL_TRIAL_PROPOSAL:
    "onto2d:package-null-model-trial-proposal:v1",
  PACKAGE_PROFILE_COMPOSITION:
    "onto2d:package-profile-composition:v1",
  PACKAGE_PROFILE_COMPOSITION_DECISION:
    "onto2d:package-profile-composition-decision:v1",
  PACKAGE_RUN_BUNDLE_INPUT: "onto2d:package-run-bundle-input:v1",
  PACKAGE_RUN_SEMANTIC_MANIFEST:
    "onto2d:package-run-semantic-manifest:v1",
  PACKAGE_RUN_ARTIFACT_MATERIALIZATION:
    "onto2d:package-run-artifact-materialization:v1",
  PACKAGE_RUN_ARTIFACT_BUNDLE:
    "onto2d:package-run-artifact-bundle:v1",
  PACKAGE_RUN_ARTIFACT_STORE:
    "onto2d:package-run-artifact-store:v1",
  PACKAGE_RUN_CANDIDATE_EXPLANATION:
    "onto2d:package-run-candidate-explanation:v1",
  PACKAGE_LEVEL_EXPLANATION_INDEX:
    "onto2d:package-level-explanation-index:v1",
  PACKAGE_LEVEL_CANDIDATE_EXPLANATION:
    "onto2d:package-level-candidate-explanation:v1",
  PACKAGE_LADDER_RESULT: "onto2d:package-ladder-result:v1",
  CARRIER_PROMOTION: "onto2d:carrier-promotion:v1",
  CARRIER_PROMOTION_POLICY: "onto2d:carrier-promotion-policy:v1",
  PACKAGE_CARRIER_PROMOTIONS: "onto2d:package-carrier-promotions:v1",
  PACKAGE_PROFILE_COLLAPSE: "onto2d:package-profile-collapse:v1",
  PACKAGE_LEVEL_BOUNDARY_REPORT: "onto2d:package-level-boundary-report:v1",
  ORACLE_REQUEST: "onto2d:oracle-request:v1",
  ORACLE_RESPONSE: "onto2d:oracle-response:v1",
  ORACLE_VALIDATION: "onto2d:oracle-validation:v1",
  SOURCE_MIGRATION_BINDING: "onto2d:source-migration-binding:v1",
  PACKAGE: "onto2d:package:v1",
  PACKAGE_CANDIDATE_BINDING: "onto2d:package-candidate-binding:v1",
  PACKAGE_CANDIDATE_CENSUS: "onto2d:package-candidate-census:v1",
  PACKAGE_CANDIDATE_FILTER: "onto2d:package-candidate-filter:v20",
  PACKAGE_PRUNING_AUDIT: "onto2d:package-pruning-audit:v1",
  PACKAGE_PRUNING_AUDIT_SAMPLE: "onto2d:package-pruning-audit-sample:v1",
  PACKAGE_PRUNING_AUDIT_UNIVERSE: "onto2d:package-pruning-audit-universe:v1",
  PACKAGE_PRUNING_DECISION: "onto2d:package-pruning-decision:v1",
  PACKAGE_PRUNED_CANDIDATE_GENERATION:
    "onto2d:package-pruned-candidate-generation:v1",
  PACKAGE_PRUNING_TRANSCRIPT: "onto2d:package-pruning-transcript:v1",
  PACKAGE_PRUNING_RESULT_SET: "onto2d:package-pruning-result-set:v1",
  PACKAGE_GENERATOR_FRONTIER_AUDIT:
    "onto2d:package-generator-frontier-audit:v1",
  PACKAGE_GENERATOR_FRONTIER_AUDIT_SAMPLE:
    "onto2d:package-generator-frontier-audit-sample:v1",
  PACKAGE_GENERATOR_FRONTIER_FRAME:
    "onto2d:package-generator-frontier-frame:v1",
  PACKAGE_GENERATOR_FRONTIER_DECISION:
    "onto2d:package-generator-frontier-decision:v1",
  PACKAGE_RECURSIVE_PRUNED_CANDIDATE_GENERATION:
    "onto2d:package-recursive-pruned-candidate-generation:v1",
  PACKAGE_RECURSIVE_PRUNING_TRANSCRIPT:
    "onto2d:package-recursive-pruning-transcript:v1",
  PACKAGE_NODE_FRONTIER_AUDIT:
    "onto2d:package-node-frontier-audit:v1",
  PACKAGE_NODE_FRONTIER_AUDIT_SAMPLE:
    "onto2d:package-node-frontier-audit-sample:v1",
  PACKAGE_NODE_FRONTIER_FRAME:
    "onto2d:package-node-frontier-frame:v1",
  PACKAGE_NODE_FRONTIER_DECISION:
    "onto2d:package-node-frontier-decision:v1",
  PACKAGE_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION:
    "onto2d:package-node-growth-pruned-candidate-generation:v1",
  PACKAGE_NODE_GROWTH_PRUNING_TRANSCRIPT:
    "onto2d:package-node-growth-pruning-transcript:v1",
  PACKAGE_PROFILE_PRUNING_EXTENSION_UNIVERSE:
    "onto2d:package-profile-pruning-extension-universe:v1",
  PACKAGE_PROFILE_EDGE_FRONTIER_KEY:
    "onto2d:package-profile-edge-frontier-key:v1",
  PACKAGE_PROFILE_EDGE_FRONTIER_CENSUS:
    "onto2d:package-profile-edge-frontier-census:v1",
  PACKAGE_PROFILE_NODE_FRONTIER_KEY:
    "onto2d:package-profile-node-frontier-key:v1",
  PACKAGE_PROFILE_NODE_FRONTIER_CENSUS:
    "onto2d:package-profile-node-frontier-census:v1",
  PACKAGE_COHORT_PARTITION: "onto2d:package-cohort-partition:v1",
  PACKAGE_DERIVED_PROFILES: "onto2d:package-derived-profiles:v1",
  PACKAGE_DEPTH_CANDIDATE_BINDING: "onto2d:package-depth-candidate-binding:v1",
  PACKAGE_DEPTH_CANDIDATE_CENSUS: "onto2d:package-depth-candidate-census:v1",
  PACKAGE_DEPTH_CANDIDATE_FILTER: "onto2d:package-depth-candidate-filter:v1",
  PACKAGE_DEPTH_PRUNING_AUDIT: "onto2d:package-depth-pruning-audit:v1",
  PACKAGE_DEPTH_PRUNING_AUDIT_SAMPLE:
    "onto2d:package-depth-pruning-audit-sample:v1",
  PACKAGE_DEPTH_PRUNING_AUDIT_UNIVERSE:
    "onto2d:package-depth-pruning-audit-universe:v1",
  PACKAGE_DEPTH_PRUNING_DECISION:
    "onto2d:package-depth-pruning-decision:v1",
  PACKAGE_DEPTH_PRUNED_CANDIDATE_GENERATION:
    "onto2d:package-depth-pruned-candidate-generation:v1",
  PACKAGE_DEPTH_PRUNING_TRANSCRIPT:
    "onto2d:package-depth-pruning-transcript:v1",
  PACKAGE_DEPTH_PRUNING_RESULT_SET:
    "onto2d:package-depth-pruning-result-set:v1",
  PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT:
    "onto2d:package-depth-generator-frontier-audit:v1",
  PACKAGE_DEPTH_GENERATOR_FRONTIER_AUDIT_SAMPLE:
    "onto2d:package-depth-generator-frontier-audit-sample:v1",
  PACKAGE_DEPTH_GENERATOR_FRONTIER_FRAME:
    "onto2d:package-depth-generator-frontier-frame:v1",
  PACKAGE_DEPTH_GENERATOR_FRONTIER_DECISION:
    "onto2d:package-depth-generator-frontier-decision:v1",
  PACKAGE_DEPTH_RECURSIVE_PRUNED_CANDIDATE_GENERATION:
    "onto2d:package-depth-recursive-pruned-candidate-generation:v1",
  PACKAGE_DEPTH_RECURSIVE_PRUNING_TRANSCRIPT:
    "onto2d:package-depth-recursive-pruning-transcript:v1",
  PACKAGE_DEPTH_NODE_FRONTIER_AUDIT:
    "onto2d:package-depth-node-frontier-audit:v1",
  PACKAGE_DEPTH_NODE_FRONTIER_AUDIT_SAMPLE:
    "onto2d:package-depth-node-frontier-audit-sample:v1",
  PACKAGE_DEPTH_NODE_FRONTIER_FRAME:
    "onto2d:package-depth-node-frontier-frame:v1",
  PACKAGE_DEPTH_NODE_FRONTIER_DECISION:
    "onto2d:package-depth-node-frontier-decision:v1",
  PACKAGE_DEPTH_NODE_GROWTH_PRUNED_CANDIDATE_GENERATION:
    "onto2d:package-depth-node-growth-pruned-candidate-generation:v1",
  PACKAGE_DEPTH_NODE_GROWTH_PRUNING_TRANSCRIPT:
    "onto2d:package-depth-node-growth-pruning-transcript:v1",
  PACKAGE_DEPTH_SOURCE_SELECTION: "onto2d:package-depth-source-selection:v1",
  PACKAGE_FIXPOINT_CANDIDATE_BINDING:
    "onto2d:package-fixpoint-candidate-binding:v1",
  PACKAGE_FIXPOINT_CANDIDATE_CENSUS:
    "onto2d:package-fixpoint-candidate-census:v1",
  PACKAGE_FIXPOINT_CANDIDATE_FILTER:
    "onto2d:package-fixpoint-candidate-filter:v1",
  PACKAGE_FIXPOINT_CURRENT_STATE:
    "onto2d:package-fixpoint-current-state:v1",
  PACKAGE_FIXPOINT_LADDER_RESULT:
    "onto2d:package-fixpoint-ladder-result:v1",
  PACKAGE_FIXPOINT_LEVEL_RESULT:
    "onto2d:package-fixpoint-level-result:v1",
  PACKAGE_FIXPOINT_POPULATION: "onto2d:package-fixpoint-population:v1",
  PACKAGE_FIXPOINT_ROUND: "onto2d:package-fixpoint-round:v1",
  PACKAGE_FIXPOINT_SOURCE_SELECTION:
    "onto2d:package-fixpoint-source-selection:v1",
  PACKAGE_FUNCTIONAL_EVALUATION: "onto2d:package-functional-evaluation:v1",
  PACKAGE_SELECTOR_RANKING: "onto2d:package-selector-ranking:v1",
  PACKAGE_SELECTOR_ADMISSION: "onto2d:package-selector-admission:v1",
  PACKAGE_SELECTED_FORMATIONS: "onto2d:package-selected-formations:v1",
  PACKAGE_SELECTOR_SENSITIVITY: "onto2d:package-selector-sensitivity:v1",
  PACKAGE_SELECTOR_SENSITIVITY_VARIANT:
    "onto2d:package-selector-sensitivity-variant:v1",
  PROFILE: "onto2d:profile:v1",
  PROFILE_SLOT_GUARD: "onto2d:profile-slot-guard:v1",
  PROFILE_SLOT_GUARD_EVALUATION:
    "onto2d:profile-slot-guard-evaluation:v1",
  RUN: "onto2d:run:v1",
  SELECTED_FORMATION: "onto2d:selected-formation:v1",
  RUN_CONFIG: "onto2d:run-config:v1",
  RULES: "onto2d:rules:v1",
  SKELETON: "onto2d:skeleton:v1",
  SOURCE_CLASSIFICATION_ADJUDICATION: "onto2d:source-classification-adjudication:v1",
  SOURCE_CLASSIFICATION_DECISION: "onto2d:source-classification-decision:v1",
  SOURCE_CLASSIFICATION_AMENDMENT: "onto2d:source-classification-amendment:v1",
  SOURCE_CLASSIFICATION_AMENDMENTS: "onto2d:source-classification-amendments:v1",
  SOURCE_CLASSIFICATION_ANNOTATIONS: "onto2d:source-classification-annotations:v1",
  SOURCE_CLASSIFICATION_POLICY: "onto2d:source-classification-policy:v1",
  SOURCE_CLASSIFICATION_VIEW: "onto2d:source-classification-view:v1",
  SOURCE_CLASSIFIED_RELATIONS: "onto2d:source-classified-relations:v1",
  SOURCE_EFFECTIVE_CLASSIFIED_RELATIONS:
    "onto2d:source-effective-classified-relations:v1",
  SOURCE_SCC_COMPONENT: "onto2d:source-scc-component:v1",
  SOURCE_NODE_RESOLUTION_POLICY: "onto2d:source-node-resolution-policy:v1",
  SOURCE_NODE_RESOLUTION: "onto2d:source-node-resolution:v1",
  SOURCE_RESOLUTION_VERTEX: "onto2d:source-resolution-vertex:v1",
  SOURCE_CONDENSATION: "onto2d:source-condensation:v1",
  SOURCE_MIGRATION_RECONCILIATION:
    "onto2d:source-migration-reconciliation:v1",
  SOURCE_MIGRATION_RISK_POLICY: "onto2d:source-migration-risk-policy:v1",
  SOURCE_MIGRATION_METRICS: "onto2d:source-migration-metrics:v1",
  SOURCE_MIGRATION_EXPLANATION_INDEX:
    "onto2d:source-migration-explanation-index:v1",
  SOURCE_MIGRATION_EXPLANATION: "onto2d:source-migration-explanation:v1",
  SOURCE_CLUSTER_CONCENTRATION_DEFINITION:
    "onto2d:source-cluster-concentration-definition:v1",
  SOURCE_CLUSTER_CONCENTRATION: "onto2d:source-cluster-concentration:v1",
  SUBSTRUCTURE: "onto2d:substructure:v1"
});

function assertDomain(domain) {
  if (typeof domain !== "string" || !DOMAIN_PATTERN.test(domain)) {
    throw new KernelError({
      code: "CANONICALIZATION_INVALID_DOMAIN",
      stage: "HASH",
      message: "Hash domain must be a versioned Onto2D domain identifier.",
      details: { domain }
    });
  }
}

function frameDomain(domain) {
  const bytes = encoder.encode(domain);
  return Buffer.concat([
    Buffer.from("ONTO2D\0", "utf8"),
    Buffer.from(String(bytes.byteLength), "ascii"),
    Buffer.from("\0", "utf8"),
    Buffer.from(bytes),
    Buffer.from("\0", "utf8")
  ]);
}

export function hashBytes(domain, bytes) {
  assertDomain(domain);
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("hashBytes requires a Uint8Array payload.");
  }
  const digest = createHash("sha256")
    .update(frameDomain(domain))
    .update(bytes)
    .digest("hex");
  return `sha256:${digest}`;
}

/** Computes the transport-level raw SHA-256 used by ArtifactRef records. */
export function hashArtifactBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("hashArtifactBytes requires a Uint8Array payload.");
  }
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function hashCanonical(domain, value, options) {
  return hashBytes(domain, canonicalBytes(value, options));
}

export function createCanonicalForm(domain, value, schemaVersion = "1", options) {
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0 || schemaVersion !== schemaVersion.trim()) {
    throw new KernelError({
      code: "CANONICALIZATION_SCHEMA_VERSION_INVALID",
      stage: "HASH",
      message: "Canonical-form schema version must be a normalized non-empty string.",
      details: { schemaVersion }
    });
  }
  const bytes = canonicalBytes(value, options);
  return deepFreezeCanonicalForm({
    schemaVersion,
    bytesBase64: Buffer.from(bytes).toString("base64"),
    hash: hashBytes(domain, bytes)
  });
}

function deepFreezeCanonicalForm(form) {
  return Object.freeze(form);
}

export function isContentHash(value) {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export function assertContentHash(value, label = "hash") {
  if (!isContentHash(value)) {
    throw new KernelError({
      code: "ARTIFACT_HASH_INVALID",
      stage: "LOAD",
      message: `${label} must be a lowercase sha256 content identifier.`,
      details: { label, value }
    });
  }
  return value;
}
