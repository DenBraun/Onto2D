import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { projectStructuralGeometry } from "./index.js";
import { packFromEngineModel } from "./engine-model.js";
import { TYPED_SELECTION_POLICY, STRUCTURAL_INTERVAL_POLICY } from "./experiment-policies.js";
import { SCALE, divide, encodedFraction, encodedInterval, sqrtBounds } from "./rational.js";
import { connectivity } from "./connectivity.js";
import { normalize, select, weightAudit, metric } from "./experiment-core.js";

export { TYPED_SELECTION_POLICY, INVERSE_TARGET_SHARE_METRIC_POLICY, STRUCTURAL_INTERVAL_POLICY } from "./experiment-policies.js";
export const STRUCTURAL_EXPERIMENT_REQUEST_SCHEMA = "https://onto2d.dev/schemas/v1/structural-metric-experiment-request.schema.json";
export const STRUCTURAL_EXPERIMENT_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-metric-experiment.schema.json";

function fail(code, message, details = {}) {
  throw new EngineError(`STRUCTURAL_EXPERIMENT_${code}`, message, details);
}
const hash = (name, value) => hashCanonical(`onto2d:${name}:v1`, value);
const seal = (name, body) => deepFreeze({ ...body, artifactHash: hash(name, body) });

export function auditStructuralWeights(pack) {
  return weightAudit(projectStructuralGeometry(pack));
}

export function verifyStructuralWeightAudit(artifact, pack) {
  const expected = auditStructuralWeights(pack);
  if (canonicalize(artifact) !== canonicalize(expected)) fail("AUDIT_VERIFICATION_FAILED", "The weight audit differs from exact source replay.");
  return expected;
}


function results(nodes, edges, lengths) {
  const incoming = new Map(nodes.map((node) => [node.id, []]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    incoming.get(edge.target).push(edge);
    outgoing.get(edge.source).push(edge);
  }
  const incidenceCount = edges.reduce((count, edge) => count + incoming.get(edge.source).length + outgoing.get(edge.target).length, 0);
  if (incidenceCount > STRUCTURAL_INTERVAL_POLICY.maxIncidences) fail("LIMIT_EXCEEDED", "The selected incidence population exceeds the experiment budget.", { incidenceCount });
  const totals = new Map(nodes.map((node) => [node.id, { inLo: 0n, inHi: 0n, outLo: 0n, outHi: 0n }]));
  const signs = { negative: 0, zero: 0, positive: 0, unresolved: 0 };
  const unitComparison = { lower: 0, equal: 0, higher: 0, overlapping: 0 };
  let sumLo = 0n; let sumHi = 0n;
  let minLo = null; let minHi = null; let maxLo = null; let maxHi = null;
  const cache = new Map();
  const edgeResults = edges.map((edge) => {
    let lo = 2n * SCALE; let hi = lo;
    const neighbors = [...incoming.get(edge.source), ...outgoing.get(edge.target)];
    for (const neighbor of neighbors) {
      const ratio = divide(lengths.get(edge.id), lengths.get(neighbor.id));
      const key = `${ratio.n}/${ratio.d}`;
      if (!cache.has(key)) cache.set(key, sqrtBounds(ratio));
      const [lower, upper] = cache.get(key);
      lo -= upper; hi -= lower;
    }
    const from = totals.get(edge.source); const to = totals.get(edge.target);
    from.outLo += lo; from.outHi += hi; to.inLo += lo; to.inHi += hi;
    sumLo += lo; sumHi += hi;
    minLo = minLo === null || lo < minLo ? lo : minLo;
    minHi = minHi === null || hi < minHi ? hi : minHi;
    maxLo = maxLo === null || lo > maxLo ? lo : maxLo;
    maxHi = maxHi === null || hi > maxHi ? hi : maxHi;
    const sign = hi < 0n ? "negative" : lo > 0n ? "positive" : lo === 0n && hi === 0n ? "zero" : "unresolved";
    signs[sign] += 1;
    const unitCurvature = 2 - neighbors.length;
    const unitTicks = BigInt(unitCurvature) * SCALE;
    const comparison = hi < unitTicks ? "lower" : lo > unitTicks ? "higher" : lo === unitTicks && hi === unitTicks ? "equal" : "overlapping";
    unitComparison[comparison] += 1;
    return { id: edge.id, source: edge.source, target: edge.target,
      length: encodedFraction(lengths.get(edge.id)), curvature: encodedInterval(lo, hi), unitCurvature, sign, unitComparison: comparison };
  });
  return {
    incidenceCount,
    connectivity: connectivity(nodes, edges),
    nodes: nodes.map((node) => {
      const value = totals.get(node.id);
      return { id: node.id, inDegree: incoming.get(node.id).length, outDegree: outgoing.get(node.id).length,
        incomingCurvature: encodedInterval(value.inLo, value.inHi), outgoingCurvature: encodedInterval(value.outLo, value.outHi),
        balance: encodedInterval(value.inLo - value.outHi, value.inHi - value.outLo) };
    }),
    edges: edgeResults,
    summary: {
      count: edges.length, sum: encodedInterval(sumLo, sumHi),
      minimum: minLo === null ? null : encodedInterval(minLo, minHi),
      maximum: maxLo === null ? null : encodedInterval(maxLo, maxHi),
      mean: edges.length === 0 ? null : { lowerNumeratorTicks: String(sumLo), upperNumeratorTicks: String(sumHi), denominator: edges.length },
      signs, unitComparison
    }
  };
}

export function analyzeStructuralMetricExperiment(pack, input = {}) {
  const request = normalize(input);
  const projection = projectStructuralGeometry(pack);
  const selected = select(projection, request.selection);
  const context = metric(projection, request.metricPolicyId);
  return seal("structural-metric-experiment", {
    schemaVersion: "1", analysis: { id: "structural-metric-experiment", version: "1" },
    model: projection.model, sourceProjectionHash: projection.projectionHash, request,
    selectionPolicy: TYPED_SELECTION_POLICY, selectionPolicyHash: hash("structural-selection-policy", TYPED_SELECTION_POLICY),
    projectionHash: selected.projectionHash, accounting: selected.accounting,
    metricPolicy: context.policy, metricPolicyHash: context.policyHash,
    metricContextHash: context.contextHash, weightAuditHash: context.auditHash,
    algorithm: { id: "forman-directed-interval", version: "1" },
    numericPolicy: STRUCTURAL_INTERVAL_POLICY, numericPolicyHash: hash("structural-interval-policy", STRUCTURAL_INTERVAL_POLICY),
    parameters: {}, parametersHash: hash("structural-experiment-parameters", {}),
    result: results(projection.nodes, selected.edges, context.lengths)
  });
}

export function verifyStructuralMetricExperiment(artifact, pack, request = {}) {
  const expected = analyzeStructuralMetricExperiment(pack, request);
  if (canonicalize(artifact) !== canonicalize(expected)) fail("VERIFICATION_FAILED", "The experiment differs from exact source and request replay.");
  return expected;
}

export function createStructuralMetricExperimentAnalysis() {
  return Object.freeze({
    id: "structural-metric-experiment", version: "1", requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_EXPERIMENT_REQUEST_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_EXPERIMENT_ARTIFACT_SCHEMA]),
    run(context, request = {}) {
      normalize(request);
      return analyzeStructuralMetricExperiment(packFromEngineModel(context?.model), request);
    }
  });
}
export const structuralMetricExperimentAnalysis = createStructuralMetricExperimentAnalysis();
