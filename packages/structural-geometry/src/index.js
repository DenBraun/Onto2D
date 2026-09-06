import {
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical
} from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { SOURCE_PARENT_DIRECTED_POLICY, UNIT_METRIC_POLICY } from "./policies.js";
import { calculateDirectedUnitForman } from "./forman.js";
import { packFromEngineModel } from "./engine-model.js";

export { SOURCE_PARENT_DIRECTED_POLICY, UNIT_METRIC_POLICY } from "./policies.js";

export const STRUCTURAL_GEOMETRY_ANALYSIS_ID = "structural-geometry";
export const STRUCTURAL_GEOMETRY_ANALYSIS_VERSION = "1";
export const STRUCTURAL_GEOMETRY_REQUEST_SCHEMA =
  "https://onto2d.dev/schemas/v1/structural-geometry-request.schema.json";
export const STRUCTURAL_GEOMETRY_ARTIFACT_SCHEMA =
  "https://onto2d.dev/schemas/v1/structural-geometry-artifact.schema.json";

const PROJECTION_POLICY_HASH = hashCanonical(
  "onto2d:structural-projection-policy:v1", SOURCE_PARENT_DIRECTED_POLICY
);
const METRIC_POLICY_HASH = hashCanonical("onto2d:structural-metric-policy:v1", UNIT_METRIC_POLICY);
const PARAMETERS = Object.freeze({});
const PARAMETERS_HASH = hashCanonical("onto2d:structural-geometry-parameters:v1", PARAMETERS);

function fail(code, message, details = {}) {
  throw new EngineError(`STRUCTURAL_GEOMETRY_${code}`, message, details);
}

function normalizeRequest(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("INPUT_INVALID", "The structural geometry request must be a plain object.");
  }
  const value = canonicalClone(input);
  const unknown = Object.keys(value).filter((key) => (
    !["projectionPolicyId", "metricPolicyId"].includes(key)
  ));
  if (unknown.length > 0) {
    fail("INPUT_INVALID", "The request contains unsupported fields.", { unknown });
  }
  if (
    Object.hasOwn(value, "projectionPolicyId") &&
    value.projectionPolicyId !== SOURCE_PARENT_DIRECTED_POLICY.id
  ) {
    fail("POLICY_UNSUPPORTED", "The projection policy is unsupported.");
  }
  if (Object.hasOwn(value, "metricPolicyId") && value.metricPolicyId !== UNIT_METRIC_POLICY.id) {
    fail("POLICY_UNSUPPORTED", "The metric policy is unsupported.");
  }
}

function attributes(record, fields) {
  return Object.fromEntries(fields
    .filter((field) => Object.hasOwn(record, field))
    .map((field) => [field, record[field]]));
}

function binding(manifest) {
  return {
    modelId: manifest.model.id,
    modelVersion: manifest.model.version,
    modelRootHash: manifest.rootHash,
    manifestHash: manifest.manifestHash
  };
}

function seal(body, field, domain) {
  return deepFreeze({ ...body, [field]: hashCanonical(domain, body) });
}

function projectVerifiedPack(pack) {
  const policy = SOURCE_PARENT_DIRECTED_POLICY;
  const paths = modelPackFilePaths();
  const sourceNodes = pack.files[paths.nodes];
  const sourceEdges = pack.files[paths.edges];
  if (sourceNodes.length > policy.limits.maxNodes || sourceEdges.length > policy.limits.maxEdges) {
    fail("LIMIT_EXCEEDED", "The complete graph exceeds the projection count bounds.", {
      nodeCount: sourceNodes.length,
      edgeCount: sourceEdges.length,
      limits: policy.limits
    });
  }
  const pairs = new Map();
  for (const edge of sourceEdges) {
    if (edge.relationLayer !== policy.relationLayer) {
      fail("RELATION_LAYER_UNSUPPORTED", "Every projected edge must be a source-parent relation.", {
        edgeId: edge.id
      });
    }
    if (edge.source === edge.target) {
      fail("SELF_LOOP_UNSUPPORTED", "The initial projection policy rejects self-loops.", {
        edgeId: edge.id
      });
    }
    if (!pairs.has(edge.source)) pairs.set(edge.source, new Set());
    const targets = pairs.get(edge.source);
    if (targets.has(edge.target)) {
      fail("PARALLEL_EDGE_UNSUPPORTED", "The initial projection policy rejects parallel directed edges.", {
        edgeId: edge.id, source: edge.source, target: edge.target
      });
    }
    targets.add(edge.target);
  }

  const nodes = sourceNodes.map((record) => ({
    id: record.id,
    sourceRecordHash: hashCanonical("onto2d:structural-source-record:v1", { kind: "node", record }),
    attributes: attributes(record, policy.nodeAttributes)
  }));
  const edges = sourceEdges.map((record) => ({
    id: record.id,
    source: record.source,
    target: record.target,
    sourceRecordHash: hashCanonical("onto2d:structural-source-record:v1", { kind: "edge", record }),
    attributes: attributes(record, policy.edgeAttributes)
  }));
  return seal({
    schemaVersion: "1",
    model: binding(pack.manifest),
    policy,
    policyHash: PROJECTION_POLICY_HASH,
    nodes,
    edges
  }, "projectionHash", "onto2d:structural-projection:v1");
}

export function projectStructuralGeometry(pack, request = {}) {
  normalizeRequest(request);
  return projectVerifiedPack(verifyModelPack(pack));
}

export function analyzeStructuralGeometry(pack, request = {}) {
  const projection = projectStructuralGeometry(pack, request);
  return seal({
    schemaVersion: "1",
    analysis: { id: STRUCTURAL_GEOMETRY_ANALYSIS_ID, version: STRUCTURAL_GEOMETRY_ANALYSIS_VERSION },
    model: projection.model,
    projectionPolicy: projection.policy,
    projectionPolicyHash: projection.policyHash,
    metricPolicy: UNIT_METRIC_POLICY,
    metricPolicyHash: METRIC_POLICY_HASH,
    projectionHash: projection.projectionHash,
    algorithm: { id: "forman-directed-unit", version: "1" },
    parameters: PARAMETERS,
    parametersHash: PARAMETERS_HASH,
    result: calculateDirectedUnitForman(projection)
  }, "artifactHash", "onto2d:structural-geometry-artifact:v1");
}

export function verifyStructuralProjection(projection, pack, request = {}) {
  const expected = projectStructuralGeometry(pack, request);
  if (canonicalize(projection) !== canonicalize(expected)) {
    fail("PROJECTION_VERIFICATION_FAILED", "The projection differs from exact source replay.");
  }
  return expected;
}

export function verifyStructuralGeometryArtifact(artifact, pack, request = {}) {
  const expected = analyzeStructuralGeometry(pack, request);
  if (canonicalize(artifact) !== canonicalize(expected)) {
    fail("ARTIFACT_VERIFICATION_FAILED", "The geometry artifact differs from exact source replay.");
  }
  return expected;
}


export function createStructuralGeometryAnalysis() {
  return Object.freeze({
    id: STRUCTURAL_GEOMETRY_ANALYSIS_ID,
    version: STRUCTURAL_GEOMETRY_ANALYSIS_VERSION,
    requiredModelCapabilities: Object.freeze([]),
    requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_GEOMETRY_REQUEST_SCHEMA,
    outputArtifacts: Object.freeze([STRUCTURAL_GEOMETRY_ARTIFACT_SCHEMA]),
    run(context, input = {}) {
      normalizeRequest(input);
      return analyzeStructuralGeometry(packFromEngineModel(context?.model), input);
    }
  });
}

export const structuralGeometryAnalysis = createStructuralGeometryAnalysis();
