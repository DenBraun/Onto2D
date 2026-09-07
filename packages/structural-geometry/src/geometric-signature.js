import { canonicalClone } from "@onto2d/kernel/canonical";
import { createStructuralMetricContext, analyzeStructuralGeometryWithProvider } from "./providers.js";
import { prepareOllivierRequest, verifyOllivierArtifact } from "./ollivier.js";
import { prepareStructuralFlow, verifyStructuralFlowArtifact } from "./flow.js";
import { packFromEngineModel } from "./engine-model.js";
import { GEOMETRIC_CODEC, GEOMETRIC_SIGNATURE_POLICY, geometricFail, geometricFields, geometricEncoded, geometricSeal, geometricHash,
  geometricCoverage, geometricRoles, scalarDescriptor, flowDescriptor, point, integerPoint, intervalPoint, geometricFeature, geometricSummary } from "./geometric-signature-core.js";

export { GEOMETRIC_SIGNATURE_POLICY } from "./geometric-signature-core.js";
export const GEOMETRIC_SIGNATURE_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/geometric-signature-input.schema.json";
export const GEOMETRIC_SIGNATURE_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/geometric-signature-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "geometric-signature", version: "1" });
const bound = graph => ({ nodeIds: graph.nodes.map(n => n.id).sort(), edgeIds: graph.edges.map(e => e.id).sort() });

export function buildGeometricSignature(pack, input, expectedEvidence) {
  const raw = canonicalClone(input, GEOMETRIC_CODEC), supplied = canonicalClone(expectedEvidence, GEOMETRIC_CODEC);
  geometricFields(raw, ["forman", "ollivier", "flow"]); geometricFields(supplied, ["ollivier", "flow"]);
  for (const name of ["ollivier", "flow"]) if (raw[name] === null && supplied[name] !== null) {
    geometricFail("EVIDENCE_UNREQUESTED", "An unrequested layer cannot supply external evidence.");
  }
  const context = createStructuralMetricContext(pack), graphs = [];
  const forman = raw.forman === null ? null : analyzeStructuralGeometryWithProvider(pack, raw.forman);
  if (forman) graphs.push({ nodes: forman.legacyArtifact.result.nodes, edges: forman.legacyArtifact.result.edges });
  const ollivierRequest = raw.ollivier === null ? null : prepareOllivierRequest(pack, raw.ollivier);
  if (ollivierRequest) graphs.push(ollivierRequest.graph);
  const flowRequest = raw.flow === null ? null : prepareStructuralFlow(pack, raw.flow);
  if (flowRequest) graphs.push(flowRequest.graph);
  const graph = graphs[0] ?? context.projection, population = bound(graph), populationBytes = geometricEncoded(population);
  if (graphs.some(g => geometricEncoded(bound(g)) !== populationBytes)) geometricFail("POPULATION_MISMATCH", "Requested geometry layers must use the same exact node and edge population.");
  const limits = GEOMETRIC_SIGNATURE_POLICY.limits;
  if (graph.nodes.length > limits.maxNodes || graph.edges.length > limits.maxEdges) geometricFail("LIMIT_EXCEEDED", "The common signature population exceeds 64 nodes or edges.");
  const ollivier = supplied.ollivier === null ? null : verifyOllivierArtifact(supplied.ollivier, pack, raw.ollivier);
  const flow = supplied.flow === null ? null : verifyStructuralFlowArtifact(supplied.flow, pack, raw.flow);
  const evidence = { forman, ollivier, flow }; geometricEncoded(evidence);
  const request = { forman: forman?.request ?? null, ollivier: ollivierRequest?.parameters ?? null, flow: flowRequest?.parameters ?? null };
  const flowCondition = flowRequest ? Object.fromEntries(Object.entries(flowRequest.parameters).filter(([k]) => !["scope", "initialLengths"].includes(k))) : null;
  const profile = geometricSeal("profile", { policy: { id: GEOMETRIC_SIGNATURE_POLICY.id, version: "1", contentHash: GEOMETRIC_SIGNATURE_POLICY.contentHash },
    forman: forman ? { request: forman.request, providerHash: forman.metricArtifact.providerHash, metricPolicyHash: forman.legacyArtifact.metricPolicyHash,
      algorithm: forman.legacyArtifact.algorithm, numericPolicy: forman.legacyArtifact.numericPolicy ?? { id: "exact-unit-integer", version: "1" } } : null,
    ollivier: ollivierRequest ? { policyHash: ollivierRequest.policyHash, idleness: ollivierRequest.parameters.idleness, coverage: "all-common-edges" } : null,
    flow: flowRequest ? { policyHash: flowRequest.policyHash, parameters: flowCondition,
      initialization: flowRequest.parameters.initialLengths.every(e => e.length.numerator === "1" && e.length.denominator === "1") ? "unit" : "explicit-source-lengths" } : null }, "profileHash");
  const roles = geometricRoles(graph), n = graph.edges.length, ids = GEOMETRIC_SIGNATURE_POLICY.layers;
  const formanResult = forman?.legacyArtifact.result;
  const formanDescriptor = formanResult ? scalarDescriptor(formanResult.edges.map(e => ({ id: e.id,
    value: typeof e.curvature === "number" ? integerPoint(e.curvature) : intervalPoint(e.curvature) })), roles,
  forman.legacyArtifact.analysis.id === "structural-geometry" ? "exact-rational" : "certified-interval") : null;
  const ollivierDescriptor = ollivier ? scalarDescriptor(ollivier.result.edges.map(e => ({ id: e.id, value: point(e.curvature) })), roles, "exact-rational") : null;
  const flowValue = flow ? flowDescriptor(flow, roles) : null;
  const features = [
    geometricFeature(ids[0], geometricCoverage(formanResult?.edges.length ?? 0, n), formanDescriptor, !forman ? "not-requested" : !n ? "empty-population" : null),
    geometricFeature(ids[1], geometricCoverage(ollivier?.result.edges.length ?? 0, n), ollivierDescriptor,
      !ollivierRequest ? "not-requested" : !ollivier ? "missing-evidence" : ollivier.result.edges.length !== n ? "partial-edge-coverage" : null),
    geometricFeature(ids[2], geometricCoverage(flow?.states.length ?? 0, flowRequest ? flowRequest.parameters.maxIterations + 1 : 0), flowValue,
      !flowRequest ? "not-requested" : !flow ? "missing-evidence" : flow.states.length < flowRequest.parameters.maxIterations + 1 ? `after-${flow.termination.reason}` : null)
  ];
  const summary = geometricSummary(features), value = summary.status === "complete" ? { features: features.map(f => ({ id: f.id, value: f.value })) } : null;
  const flowSamples = flow ? flow.states.length * n : 0;
  const work = { scalarSamples: (formanResult?.edges.length ?? 0) + (ollivier?.result.edges.length ?? 0) + 2 * flowSamples,
    jointSamples: flowSamples, trajectoryFrames: flow?.states.length ?? 0 };
  if (work.scalarSamples > limits.maxScalarSamples || work.jointSamples > limits.maxJointSamples || work.trajectoryFrames > limits.maxFrames) {
    geometricFail("LIMIT_EXCEEDED", "Geometric descriptor composition exceeds its cumulative work budget.");
  }
  return geometricSeal("artifact", { schemaVersion: "1", analysis: ANALYSIS, evaluation: "measured", policy: GEOMETRIC_SIGNATURE_POLICY,
    source: context.binding, population: { ...population, populationHash: geometricHash("population", { contextHash: context.binding.contextHash, ...population }) },
    request, profile, evidence, features, summary, value, valueHash: value ? geometricHash("value", { profileHash: profile.profileHash, value }) : null, work });
}
export function verifyGeometricSignature(value, pack, input, expectedEvidence) {
  const expected = buildGeometricSignature(pack, input, expectedEvidence);
  if (geometricEncoded(value) !== geometricEncoded(expected)) geometricFail("VERIFICATION_FAILED", "Geometric signature differs from expected source, policies, evidence availability or certified descriptors.");
  return expected;
}
export function createGeometricSignatureAnalysis(expectedEvidence) {
  const evidence = canonicalClone(expectedEvidence, GEOMETRIC_CODEC); geometricFields(evidence, ["ollivier", "flow"]); geometricEncoded(evidence);
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]), inputSchema: GEOMETRIC_SIGNATURE_INPUT_SCHEMA,
    outputArtifacts: Object.freeze([GEOMETRIC_SIGNATURE_ARTIFACT_SCHEMA]),
    run(context, input) { return buildGeometricSignature(packFromEngineModel(context?.model), input, evidence); } });
}
