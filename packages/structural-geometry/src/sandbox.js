import { deepFreeze } from "@onto2d/kernel/canonical";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { prepareStructuralRegime } from "./regimes.js";
import { normalizeEdgeTypes } from "./typed-core.js";
import { packFromEngineModel } from "./engine-model.js";
import { STRUCTURAL_PROBE_SANDBOX_POLICY, sandboxClone, sandboxObject, sandboxFail, sandboxEncoded,
  sandboxSeal, shadowGraph, transformShadowGraph } from "./sandbox-core.js";

export { STRUCTURAL_PROBE_SANDBOX_POLICY } from "./sandbox-core.js";
export const STRUCTURAL_PROBE_SANDBOX_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-probe-sandbox-input.schema.json";
export const STRUCTURAL_PROBE_SANDBOX_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-probe-sandbox-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "structural-probe-sandbox", version: "1" });

function normalize(input) {
  const raw = sandboxObject(sandboxClone(input), ["regimeId", "scope", "transformation"], ["regimeId", "transformation"]);
  const transformation = sandboxObject(raw.transformation, ["kind", "targets"], ["kind"]);
  if (transformation.kind === "identity") sandboxObject(transformation, ["kind"]);
  else if (["remove-edges", "reverse-edges"].includes(transformation.kind)) {
    sandboxObject(transformation, ["kind", "targets"]);
    if (!["all-scoped-edges", "each-scoped-edge"].includes(transformation.targets)) sandboxFail("INPUT_INVALID", "Select all or each scoped edge explicitly.");
  } else sandboxFail("INPUT_INVALID", "The requested sandbox transformation is unsupported.");
  return { regimeInput: { regimeId: raw.regimeId, ...(Object.hasOwn(raw, "scope") ? { scope: raw.scope } : {}) }, transformation };
}

function baselineGraph(source, preparation) {
  const typed = preparation.regime.id === "typed-relations-v1", sourceEdges = source.files[modelPackFilePaths().edges];
  if (typed) for (const edge of sourceEdges) normalizeEdgeTypes(edge);
  const nodes = preparation.scope.nodeIds.map((sourceNodeId, i) => ({ sourceNodeId, shadowNodeId: `n${String(i).padStart(3, "0")}` }));
  const nodeMap = new Map(nodes.map(n => [n.sourceNodeId, n.shadowNodeId]));
  const byId = new Map(sourceEdges.map(edge => [edge.id, edge]));
  const edges = preparation.scope.edgeIds.map((sourceEdgeId, i) => ({ sourceEdgeId, shadowEdgeId: `e${String(i).padStart(3, "0")}` }));
  const graph = shadowGraph(preparation, nodes.map(n => ({ id: n.shadowNodeId })), edges.map(binding => {
    const edge = byId.get(binding.sourceEdgeId);
    return { id: binding.shadowEdgeId, source: nodeMap.get(edge.source), target: nodeMap.get(edge.target),
      ...(typed ? { types: normalizeEdgeTypes(edge).types } : {}) };
  }));
  return deepFreeze({ graph, mapping: { nodes, edges } });
}

export function runStructuralProbeSandbox(pack, input) {
  const { regimeInput, transformation } = normalize(input), source = verifyModelPack(pack);
  const preparation = prepareStructuralRegime(source, regimeInput), baseline = baselineGraph(source, preparation);
  const eligible = baseline.mapping.edges;
  const kind = transformation.kind === "identity" ? "whole-scope" : transformation.targets;
  const groups = kind === "whole-scope" ? [eligible] : !eligible.length ? [] : kind === "all-scoped-edges" ? [eligible] : eligible.map(edge => [edge]);
  const edgeVisits = groups.length * baseline.graph.edges.length, bounds = STRUCTURAL_PROBE_SANDBOX_POLICY.limits;
  if (groups.length > bounds.maxTargets || edgeVisits > bounds.maxTransformationEdgeVisits) {
    sandboxFail("LIMIT_EXCEEDED", "Exhaustive target execution exceeds the fixed work budget; no targets were sampled or truncated.");
  }
  const targets = groups.map(edges => ({ kind: kind === "each-scoped-edge" ? "single-scoped-edge" : kind,
    sourceEdgeIds: edges.map(e => e.sourceEdgeId), shadowEdgeIds: edges.map(e => e.shadowEdgeId) }));
  const runs = [];
  let bytes = new TextEncoder().encode(sandboxEncoded({ preparation, baseline })).length;
  for (const target of targets) {
    const run = transformShadowGraph(preparation, baseline, target, transformation);
    bytes += new TextEncoder().encode(sandboxEncoded(run)).length;
    if (bytes > bounds.maxArtifactBytes) sandboxFail("LIMIT_EXCEEDED", "Sandbox cumulative output exceeds its byte budget.");
    runs.push(run);
  }
  const applied = runs.filter(r => r.execution === "applied").length;
  return sandboxSeal("artifact", { schemaVersion: "1", analysis: ANALYSIS, policy: STRUCTURAL_PROBE_SANDBOX_POLICY,
    request: { ...preparation.request, transformation }, preparation, baseline,
    selection: { kind, eligibleSourceEdgeIds: eligible.map(e => e.sourceEdgeId), eligibleShadowEdgeIds: eligible.map(e => e.shadowEdgeId) },
    observationEvaluation: "not-run", execution: { state: targets.length ? "completed" : "unavailable",
      reason: targets.length ? null : "empty-target-set", targetCount: targets.length, appliedCount: applied, rejectedCount: runs.length - applied },
    work: { transformationEdgeVisits: edgeVisits, outputGraphCount: 1 + applied }, runs });
}

export function verifyStructuralProbeSandbox(value, pack, input) {
  const expected = runStructuralProbeSandbox(pack, input);
  if (sandboxEncoded(value) !== sandboxEncoded(expected)) sandboxFail("VERIFICATION_FAILED", "Sandbox differs from expected source, regime, scope, targets, transformations or exact replay.");
  return expected;
}
export function createStructuralProbeSandboxAnalysis() {
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_PROBE_SANDBOX_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_PROBE_SANDBOX_ARTIFACT_SCHEMA]),
    run(context, input) { return runStructuralProbeSandbox(packFromEngineModel(context?.model), input); } });
}
