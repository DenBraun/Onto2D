import { runStructuralProbeSandbox, STRUCTURAL_PROBE_SANDBOX_POLICY } from "./sandbox.js";
import { packFromEngineModel } from "./engine-model.js";
import { STRUCTURAL_RESPONSE_POLICY, STRUCTURAL_RESPONSE_REGISTRY, normalizeResponseInput, responseProfile,
  planResponseTargets, transformResponseTarget, summarizeResponseProbe, responseSeal, responseEncoded, responseReference, responseFail } from "./responses-core.js";
import { STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER, observeResponseGraph, measureResponse } from "./responses-observation.js";

export { STRUCTURAL_RESPONSE_POLICY, STRUCTURAL_RESPONSE_REGISTRY } from "./responses-core.js";
export { STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER } from "./responses-observation.js";
export const STRUCTURAL_RESPONSE_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-response-input.schema.json";
export const STRUCTURAL_RESPONSE_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-response-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "structural-response-probes", version: "1" });

export function runStructuralResponseProbes(pack, input) {
  const request = normalizeResponseInput(input), sandbox = runStructuralProbeSandbox(pack, { ...request, transformation: { kind: "identity" } });
  const { preparation } = sandbox, profile = responseProfile(preparation.regime), planned = planResponseTargets(sandbox.baseline, profile);
  const before = observeResponseGraph(preparation, sandbox.baseline.graph,
    sandbox.baseline.mapping.edges.map(e => ({ sourceEdgeId: e.sourceEdgeId, afterEdgeId: e.shadowEdgeId })));
  const body = { schemaVersion: "1", analysis: ANALYSIS, evaluation: "measured", policy: STRUCTURAL_RESPONSE_POLICY,
    registry: STRUCTURAL_RESPONSE_REGISTRY, adapter: STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER,
    request: preparation.request, preparation, profile,
    sandbox: { policy: responseReference(STRUCTURAL_PROBE_SANDBOX_POLICY), identityArtifactHash: sandbox.artifactHash },
    baseline: { ...sandbox.baseline, observation: before } };
  let bytes = new TextEncoder().encode(responseEncoded(body)).length, applied = 0, rejected = 0, canonicalizerCalls = before.work.canonicalizerCalls;
  const probes = [];
  for (const { probe, selection, targets } of planned.plans) {
    const runs = []; let runBytes = 0;
    for (const target of targets) {
      const transformed = transformResponseTarget(preparation, sandbox.baseline, target, probe.transformation);
      const observation = transformed.execution === "applied" ? observeResponseGraph(preparation, transformed.graph, transformed.edgeMapping) : null;
      canonicalizerCalls += observation?.work.canonicalizerCalls ?? 0;
      const run = responseSeal("run", { target, transformation: probe.transformation, beforeGraphHash: sandbox.baseline.graph.graphHash,
        ...transformed, observation, response: observation ? measureResponse(before, observation) : null }, "runHash");
      const size = new TextEncoder().encode(responseEncoded(run)).length;
      bytes += size; runBytes += size;
      if (bytes > STRUCTURAL_RESPONSE_POLICY.limits.maxArtifactBytes) responseFail("LIMIT_EXCEEDED", "Cumulative response output exceeds its byte budget.");
      runs.push(run);
    }
    const appliedCount = runs.filter(r => r.execution === "applied").length, rejectedCount = runs.length - appliedCount;
    applied += appliedCount; rejected += rejectedCount;
    const result = responseSeal("probe-result", { probe: responseReference(probe), selection,
      execution: { state: targets.length ? "completed" : "unavailable", reason: targets.length ? null
        : selection.state === "unresolved" ? "missing-selector-evidence" : "no-eligible-targets",
        targetCount: targets.length, appliedCount, rejectedCount }, runs,
      summary: summarizeResponseProbe(runs, preparation.regime.observables.length) }, "probeHash");
    bytes += new TextEncoder().encode(responseEncoded(result)).length - runBytes;
    if (bytes > STRUCTURAL_RESPONSE_POLICY.limits.maxArtifactBytes) responseFail("LIMIT_EXCEEDED", "Cumulative response output exceeds its byte budget.");
    probes.push(result);
  }
  const numerator = probes.filter(p => p.summary.status === "observed").length, denominator = probes.length, complete = numerator === denominator && denominator > 0;
  return responseSeal("artifact", { ...body, probes,
    summary: { status: complete ? "observed" : "indeterminate", coverage: { numerator, denominator, complete },
      targets: { total: planned.targetCount, applied, rejected } },
    work: { selection: planned.work, transformationEdgeVisits: planned.transformationEdgeVisits,
      outputGraphCount: 1 + applied, observationEvaluations: 1 + applied, canonicalizerCalls } });
}
export function verifyStructuralResponseProbes(value, pack, input) {
  const expected = runStructuralResponseProbes(pack, input);
  if (responseEncoded(value) !== responseEncoded(expected)) responseFail("VERIFICATION_FAILED", "Response artifact differs from expected source, scope, registry, exhaustive targets, transformations or measured replay.");
  return expected;
}
export function createStructuralResponseAnalysis() {
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_RESPONSE_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_RESPONSE_ARTIFACT_SCHEMA]),
    run(context, input) { return runStructuralResponseProbes(packFromEngineModel(context?.model), input); } });
}
