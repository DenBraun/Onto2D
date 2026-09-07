import { runStructuralProbeSandbox, STRUCTURAL_PROBE_SANDBOX_POLICY } from "./sandbox.js";
import { packFromEngineModel } from "./engine-model.js";
import { STRUCTURAL_INVARIANCE_REGISTRY, STRUCTURAL_INVARIANCE_POLICY, STRUCTURAL_SHADOW_OBSERVATION_ADAPTER,
  invarianceReference, invarianceEncoded, invarianceSeal, invarianceFail, normalizeInvarianceInput,
  baselineRepresentation, transformRepresentation, observeRepresentation, compareInvarianceObservations, adjudicateInvariance } from "./invariance-core.js";

export { STRUCTURAL_INVARIANCE_REGISTRY, STRUCTURAL_INVARIANCE_POLICY, STRUCTURAL_SHADOW_OBSERVATION_ADAPTER } from "./invariance-core.js";
export const STRUCTURAL_INVARIANCE_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-invariance-input.schema.json";
export const STRUCTURAL_INVARIANCE_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-invariance-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "structural-invariance-probes", version: "1" });

export function runStructuralInvarianceProbes(pack, input) {
  const request = normalizeInvarianceInput(input);
  const sandbox = runStructuralProbeSandbox(pack, { ...request, transformation: { kind: "identity" } });
  const { preparation } = sandbox, representation = baselineRepresentation(sandbox.baseline.graph);
  const mapping = sandbox.baseline.mapping;
  const observation = observeRepresentation(preparation, representation, mapping.edges.map(e => ({ sourceEdgeId: e.sourceEdgeId, afterId: e.shadowEdgeId })));
  const baseline = { sourceShadowGraphHash: sandbox.baseline.graph.graphHash, mapping, representation, observation };
  const body = { schemaVersion: "1", analysis: ANALYSIS, evaluation: "measured",
    policy: STRUCTURAL_INVARIANCE_POLICY, registry: STRUCTURAL_INVARIANCE_REGISTRY, adapter: STRUCTURAL_SHADOW_OBSERVATION_ADAPTER,
    sandbox: { policy: invarianceReference(STRUCTURAL_PROBE_SANDBOX_POLICY), artifactHash: sandbox.artifactHash },
    request: preparation.request, preparation, baseline };
  let bytes = new TextEncoder().encode(invarianceEncoded(body)).length;
  const runs = [];
  for (const probe of STRUCTURAL_INVARIANCE_REGISTRY.probes) {
    const transformed = transformRepresentation(representation, mapping, probe);
    const measured = observeRepresentation(preparation, transformed.representation, transformed.mapping.edges);
    const run = invarianceSeal("run", { probe: invarianceReference(probe), target: "whole-scoped-representation",
      beforePayloadHash: representation.payloadHash, ...transformed, observation: measured,
      payloadChanged: representation.payload !== transformed.representation.payload,
      comparison: compareInvarianceObservations(observation, measured) }, "runHash");
    bytes += new TextEncoder().encode(invarianceEncoded(run)).length;
    if (bytes > STRUCTURAL_INVARIANCE_POLICY.limits.maxArtifactBytes) invarianceFail("LIMIT_EXCEEDED", "Cumulative invariance output exceeds its byte budget.");
    runs.push(run);
  }
  const summary = adjudicateInvariance(runs.flatMap(r => r.comparison.components.map(c => c.state)));
  return invarianceSeal("artifact", { ...body, runs, summary,
    work: { representationCount: 5, observationEvaluations: 5,
      canonicalizerCalls: observation.work.canonicalizerCalls + runs.reduce((sum, r) => sum + r.observation.work.canonicalizerCalls, 0) } });
}
export function verifyStructuralInvarianceProbes(value, pack, input) {
  const expected = runStructuralInvarianceProbes(pack, input);
  if (invarianceEncoded(value) !== invarianceEncoded(expected)) invarianceFail("VERIFICATION_FAILED", "Invariance artifact differs from expected source, scope, registry, payloads, mappings or measured replay.");
  return expected;
}
export function createStructuralInvarianceAnalysis() {
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_INVARIANCE_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_INVARIANCE_ARTIFACT_SCHEMA]),
    run(context, input) { return runStructuralInvarianceProbes(packFromEngineModel(context?.model), input); } });
}
