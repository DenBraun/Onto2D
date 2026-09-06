import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { defineScientificAdapter } from "@onto2d/scientific-adapter";
import { projectStructuralGeometry } from "./index.js";
import { packFromEngineModel } from "./engine-model.js";
import { connectivity } from "./connectivity.js";
import { STRUCTURAL_FLOW_POLICY, STRUCTURAL_FLOW_SOLVER } from "./flow-policy.js";
import { ONE, F, absolute, compare, div, encode, fail, fields, ids, integer, limits,
  maximum, minimum, mul, normalizeMetric, plus, rational, sub, sum } from "./flow-math.js";
import { flowMeasures, prepareTransport, verifyTransport } from "./flow-transport.js";

export { STRUCTURAL_FLOW_POLICY, STRUCTURAL_FLOW_SOLVER } from "./flow-policy.js";
export const STRUCTURAL_FLOW_ANALYSIS_ID = "structural-flow";
export const STRUCTURAL_FLOW_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-flow-input.schema.json";
export const STRUCTURAL_FLOW_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-flow-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: STRUCTURAL_FLOW_ANALYSIS_ID, version: "1" });
const CODEC = { limits: { maxEntries: limits.maxCanonicalEntries } };
const POLICY_HASH = hashCanonical("onto2d:structural-flow-policy:v1", STRUCTURAL_FLOW_POLICY);
const seal = (body, field, domain) => deepFreeze({ ...body, [field]: hashCanonical(domain, body, CODEC) });
const supplied = (value, key, fallback) => Object.hasOwn(value, key) ? value[key] : fallback;

export function prepareStructuralFlow(pack, input = {}) {
  const value = canonicalClone(input);
  fields(value, ["scope", "initialLengths", "maxIterations", "step", "idleness", "stableSteps", "tolerance", "cut"], []);
  const defaults = STRUCTURAL_FLOW_POLICY.defaults;
  const scope = supplied(value, "scope", { kind: "full" });
  fields(scope, ["kind", "nodeIds"], ["kind"]);
  if (scope.kind === "full") fields(scope, ["kind"]);
  else if (scope.kind === "induced") { fields(scope, ["kind", "nodeIds"]); scope.nodeIds = ids(scope.nodeIds, 2, limits.maxNodes); }
  else fail("INPUT_INVALID", "Flow scope must be full or an explicit induced node set.");
  const maxIterations = integer(supplied(value, "maxIterations", defaults.maxIterations), 1, limits.maxIterations);
  const stableSteps = integer(supplied(value, "stableSteps", defaults.stableSteps), 1, limits.maxStableSteps);
  const step = supplied(value, "step", defaults.step);
  const idleness = supplied(value, "idleness", defaults.idleness);
  if (!["half", "one"].includes(step) || !["zero", "half"].includes(idleness)) fail("INPUT_INVALID", "Unsupported step or idleness.");
  const tolerance = rational(supplied(value, "tolerance", defaults.tolerance), true);
  if (compare(tolerance, ONE) > 0) fail("INPUT_INVALID", "Convergence tolerance must be at most one.");
  const cut = supplied(value, "cut", defaults.cut);
  fields(cut, ["kind", "threshold"], ["kind"]);
  if (cut.kind === "none") fields(cut, ["kind"]);
  else if (cut.kind === "final-length") { fields(cut, ["kind", "threshold"]); rational(cut.threshold, true); }
  else fail("INPUT_INVALID", "Unsupported analytical cut policy.");

  const projection = projectStructuralGeometry(pack);
  const selected = new Set(scope.kind === "full" ? projection.nodes.map((n) => n.id) : scope.nodeIds);
  const nodes = projection.nodes.filter((n) => selected.has(n.id)).map(({ id, sourceRecordHash }) => ({ id, sourceRecordHash }));
  if (nodes.length !== selected.size) fail("SCOPE_INVALID", "Unknown node in flow scope.");
  const edges = projection.edges.filter((e) => selected.has(e.source) && selected.has(e.target))
    .map(({ id, source, target, sourceRecordHash }) => ({ id, source, target, sourceRecordHash }));
  if (nodes.length > limits.maxNodes || edges.length > limits.maxEdges || edges.length === 0) {
    fail("LIMIT_EXCEEDED", "Flow requires a bounded explicit graph with at least one edge; no truncation is performed.");
  }
  const graph = { nodes, edges };
  const measures = flowMeasures(graph, idleness);
  const cells = measures.reduce((total, m) => total + m.sourceMeasure.length * m.targetMeasure.length, 0);
  if (cells > limits.maxTransportCells || cells * (maxIterations + 1) > limits.maxHistoryTransportCells) {
    fail("LIMIT_EXCEEDED", "Requested flow history exceeds its transport-cell budget.");
  }
  let initialLengths = edges.map((e) => ({ edgeId: e.id, length: encode(ONE) }));
  if (Object.hasOwn(value, "initialLengths")) {
    if (!Array.isArray(value.initialLengths) || value.initialLengths.length !== edges.length) fail("INPUT_INVALID", "Initial lengths must cover every scoped edge exactly once.");
    const byId = new Map();
    for (const entry of value.initialLengths) {
      fields(entry, ["edgeId", "length"]);
      ids([entry.edgeId], 1, 1);
      if (byId.has(entry.edgeId)) fail("INPUT_INVALID", "Duplicate initial edge length.");
      byId.set(entry.edgeId, encode(rational(entry.length, true)));
    }
    initialLengths = edges.map((e) => {
      if (!byId.has(e.id)) fail("INPUT_INVALID", "Initial lengths differ from scoped edge IDs.");
      return { edgeId: e.id, length: byId.get(e.id) };
    });
  }
  const annotatedScope = { ...scope, excludedNodeCount: projection.nodes.length - nodes.length,
    excludedEdgeCount: projection.edges.length - edges.length,
    boundaryEdgeCount: projection.edges.filter((e) => selected.has(e.source) !== selected.has(e.target)).length };
  return seal({ schemaVersion: "1", analysis: ANALYSIS, model: projection.model,
    sourceProjectionHash: projection.projectionHash,
    projectionHash: hashCanonical("onto2d:structural-flow-projection:v1", { sourceProjectionHash: projection.projectionHash, scope: annotatedScope, graph }),
    graph, scope: annotatedScope, policy: STRUCTURAL_FLOW_POLICY, policyHash: POLICY_HASH,
    parameters: { scope, initialLengths, maxIterations, step, idleness, tolerance: encode(tolerance), stableSteps, cut }
  }, "requestHash", "onto2d:structural-flow-request:v1");
}

function stateFor(request, metric, transport, verified, previous) {
  const edges = verified.edges.map((edge, i) => ({ id: edge.id, length: encode(metric.lengths[i]),
    wasserstein: encode(edge.wasserstein), curvature: encode(edge.curvature) }));
  const curvatures = verified.edges.map((e) => e.curvature);
  const maxLengthChange = previous ? maximum(edges.map((e, i) => absolute(sub(metric.lengths[i], rational(previous.edges[i].length))))) : null;
  const maxCurvatureChange = previous ? maximum(curvatures.map((c, i) => absolute(sub(c, rational(previous.edges[i].curvature))))) : null;
  const tolerance = rational(request.parameters.tolerance);
  const stable = previous !== null && compare(maxLengthChange, tolerance) <= 0 && compare(maxCurvatureChange, tolerance) <= 0;
  const signs = { negative: 0, zero: 0, positive: 0 };
  curvatures.forEach((c) => { signs[c.n < 0n ? "negative" : c.n > 0n ? "positive" : "zero"] += 1; });
  const minimumLength = minimum(metric.lengths); const maximumLength = maximum(metric.lengths);
  return seal({ iteration: transport.iteration, previousStateHash: previous?.stateHash ?? null,
    metricHash: transport.metricHash, normalization: metric.normalization, edges,
    summary: { lengthSum: encode(sum(metric.lengths)), minimumLength: encode(minimumLength), maximumLength: encode(maximumLength),
      minimumCurvature: encode(minimum(curvatures)), maximumCurvature: encode(maximum(curvatures)), curvatureSum: encode(sum(curvatures)), signs,
      maximumLengthEdgeIds: edges.filter((_, i) => compare(metric.lengths[i], maximumLength) === 0).map((e) => e.id),
      maxLengthChange: maxLengthChange && encode(maxLengthChange), maxCurvatureChange: maxCurvatureChange && encode(maxCurvatureChange),
      stableStepCount: stable ? previous.summary.stableStepCount + 1 : 0 },
    transportResponse: verified.response
  }, "stateHash", "onto2d:structural-flow-state:v1");
}

function nextAction(request, metric, state, previous, seen) {
  const stop = (reason, extra = {}) => ({ termination: { reason, iteration: state.iteration, cycleStart: null, cyclePeriod: null, edgeIds: [], ...extra } });
  if (previous && state.metricHash === previous.metricHash) return stop("fixed-point");
  if (seen.has(state.metricHash)) return stop("cycle", { cycleStart: seen.get(state.metricHash), cyclePeriod: state.iteration - seen.get(state.metricHash) });
  if (state.summary.stableStepCount >= request.parameters.stableSteps) return stop("tolerance");
  if (state.iteration >= request.parameters.maxIterations) return stop("iteration-limit");
  const step = request.parameters.step === "half" ? div(ONE, F(2)) : ONE;
  const raw = state.edges.map((e, i) => plus(mul(sub(ONE, step), metric.lengths[i]), mul(step, rational(e.wasserstein))));
  const degenerate = state.edges.filter((_, i) => raw[i].n <= 0n).map((e) => e.id);
  if (degenerate.length) return stop("degenerate-length", { edgeIds: degenerate });
  return { metric: normalizeMetric(request.graph, raw) };
}

function partitions(graph, edges) {
  const nodes = graph.nodes.map((n) => n.id);
  const outgoing = new Map(nodes.map((id) => [id, []])); const incoming = new Map(nodes.map((id) => [id, []]));
  edges.forEach((e) => { outgoing.get(e.source).push(e.target); incoming.get(e.target).push(e.source); });
  function reachable(start, neighbors) {
    const seen = new Set([start]); const queue = [start];
    for (let i = 0; i < queue.length; i += 1) for (const next of neighbors(queue[i])) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    return seen;
  }
  const weak = []; const strong = []; const weakSeen = new Set(); const strongSeen = new Set();
  for (const node of nodes) {
    if (!weakSeen.has(node)) { const group = [...reachable(node, (id) => [...outgoing.get(id), ...incoming.get(id)])].sort(); group.forEach((id) => weakSeen.add(id)); weak.push(group); }
    if (!strongSeen.has(node)) {
      const forward = reachable(node, (id) => outgoing.get(id)); const backward = reachable(node, (id) => incoming.get(id));
      const group = [...forward].filter((id) => backward.has(id)).sort(); group.forEach((id) => strongSeen.add(id)); strong.push(group);
    }
  }
  return { weakComponents: weak, strongComponents: strong, connectivity: connectivity(graph.nodes, edges) };
}

function finish(request, states, termination) {
  const final = states.at(-1);
  const cut = request.parameters.cut;
  const removedEdgeIds = cut.kind === "none" ? [] : final.edges.filter((e) => compare(rational(e.length), rational(cut.threshold)) > 0).map((e) => e.id);
  const removed = new Set(removedEdgeIds);
  const cuts = { policy: cut, iteration: final.iteration, removedEdgeIds,
    ...partitions(request.graph, request.graph.edges.filter((edge) => !removed.has(edge.id))) };
  const artifact = seal({ schemaVersion: "1", analysis: ANALYSIS, model: request.model, request, states, termination, cuts },
    "artifactHash", "onto2d:structural-flow-artifact:v1");
  if (new TextEncoder().encode(canonicalize(artifact, CODEC)).length > limits.maxArtifactBytes) fail("LIMIT_EXCEEDED", "Flow artifact exceeds its byte bound.");
  return artifact;
}

export function createStructuralFlowAnalyzer(adapter) {
  const external = defineScientificAdapter(adapter);
  if (canonicalize({ id: external.id, version: external.version, method: external.method }) !== canonicalize(STRUCTURAL_FLOW_SOLVER)) {
    fail("SOLVER_UNSUPPORTED", "The adapter must implement the frozen rational flow transport contract.");
  }
  return Object.freeze({
    async analyze(pack, input = {}) {
      const request = prepareStructuralFlow(pack, input);
      let metric = normalizeMetric(request.graph, request.parameters.initialLengths.map((e) => rational(e.length, true)));
      const states = []; const seen = new Map();
      for (let iteration = 0; iteration <= request.parameters.maxIterations; iteration += 1) {
        const previous = states.at(-1) ?? null;
        const transport = prepareTransport(request, metric.lengths, iteration, previous?.stateHash ?? null);
        const verified = verifyTransport(await external.evaluate(transport), transport);
        const state = stateFor(request, metric, transport, verified, previous);
        states.push(state);
        const next = nextAction(request, metric, state, previous, seen);
        if (next.termination) return finish(request, states, next.termination);
        seen.set(state.metricHash, iteration); metric = next.metric;
      }
      fail("INTERNAL_ERROR", "Flow iteration bound was not respected.");
    }
  });
}

export function verifyStructuralFlowArtifact(artifact, pack, input = {}) {
  const value = canonicalClone(artifact, CODEC);
  const request = prepareStructuralFlow(pack, input);
  if (!Array.isArray(value?.states) || value.states.length === 0 || value.states.length > request.parameters.maxIterations + 1) {
    fail("ARTIFACT_VERIFICATION_FAILED", "Flow history length is outside the expected request.");
  }
  let metric = normalizeMetric(request.graph, request.parameters.initialLengths.map((e) => rational(e.length, true)));
  const states = []; const seen = new Map();
  for (let iteration = 0; iteration < value.states.length; iteration += 1) {
    const previous = states.at(-1) ?? null;
    const transport = prepareTransport(request, metric.lengths, iteration, previous?.stateHash ?? null);
    const verified = verifyTransport(value.states[iteration]?.transportResponse, transport);
    const state = stateFor(request, metric, transport, verified, previous);
    states.push(state);
    const next = nextAction(request, metric, state, previous, seen);
    if (next.termination) {
      const expected = finish(request, states, next.termination);
      if (canonicalize(value, CODEC) !== canonicalize(expected, CODEC)) fail("ARTIFACT_VERIFICATION_FAILED", "Flow history differs from exact source, update or stopping replay.");
      return expected;
    }
    seen.set(state.metricHash, iteration); metric = next.metric;
  }
  fail("ARTIFACT_VERIFICATION_FAILED", "Flow history stops before a valid termination condition.");
}

export function createStructuralFlowAnalysis(adapter) {
  const analyzer = createStructuralFlowAnalyzer(adapter);
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_FLOW_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_FLOW_ARTIFACT_SCHEMA]),
    run(context, input = {}) { return analyzer.analyze(packFromEngineModel(context?.model), input); } });
}
