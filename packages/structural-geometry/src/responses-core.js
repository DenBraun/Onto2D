import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { shadowGraph } from "./sandbox-core.js";

const limits = { maxTargetsPerProbe: 32, maxTargets: 64, maxTransformationEdgeVisits: 2048,
  maxPathExtensions: 4096, maxSelectionEdgeScans: 131072, maxObservationEvaluations: 65,
  maxCanonicalizerCalls: 130, maxCanonicalEntries: 500000, maxArtifactBytes: 4194304 };
export const RESPONSE_CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: limits.maxCanonicalEntries }) });
export const responseHash = (kind, value) => hashCanonical(`onto2d:structural-response-${kind}:v1`, value, RESPONSE_CODEC);
export const responseReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export function responseFail(code, message) { throw new EngineError(`STRUCTURAL_RESPONSE_${code}`, message); }
export function responseEncoded(value) {
  const text = canonicalize(value, RESPONSE_CODEC);
  if (new TextEncoder().encode(text).length > limits.maxArtifactBytes) responseFail("LIMIT_EXCEEDED", "Response output exceeds its 4 MiB byte budget.");
  return text;
}
export function responseSeal(kind, body, field = "artifactHash") {
  const result = { ...body, [field]: responseHash(kind, body) }; responseEncoded(result); return deepFreeze(result);
}
export const responseDescriptor = (kind, body) => responseSeal(kind, body, "contentHash");
const regimes = ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"];
const definitions = [
  ["feedback-edge-ablation-v1", "feedback", "return-path", "remove-edges", regimes],
  ["necessary-parent-ablation-v1", "declared-dependency-constraint", "necessity-necessary", "remove-edges", [regimes[2]]],
  ["enabling-parent-ablation-v1", "declared-dependency-constraint", "necessity-enabling", "remove-edges", [regimes[2]]],
  ["edge-direction-reversal-v1", "direction", "each-internal-edge", "reverse-edge", regimes],
  ["redundant-support-path-ablation-v1", "support-path", "simple-path-with-edge-disjoint-alternative", "remove-edges", regimes]
];
export const STRUCTURAL_RESPONSE_REGISTRY = responseDescriptor("registry", {
  id: "structural-response-probes-v1", version: "1",
  probes: definitions.map(([id, question, selector, transformation, regimeIds]) => responseDescriptor("probe", {
    id, version: "1", family: "response", question, selector, transformation, regimeIds, mandatoryWhenCompatible: true,
    targets: "every-eligible-target-independently", parameters: { scope: "internal-edges-only", nodes: "retain-all",
      path: selector === "simple-path-with-edge-disjoint-alternative" ? "nonempty-distinct-vertices-all-lengths" : "single-edge" }
  }))
});
export const STRUCTURAL_RESPONSE_POLICY = responseDescriptor("policy", {
  id: "graph-native-response-probes-v1", version: "1", registry: responseReference(STRUCTURAL_RESPONSE_REGISTRY),
  source: "verified-identity-sandbox-with-unchanged-preparation", copies: "every-target-starts-from-baseline",
  selection: "exhaustive-preflight-before-observation", missingSelector: "unresolved-no-partial-target-set",
  emptySelector: "unavailable-no-measured-zero", constraintMeaning: "declared-necessary-and-enabling-dependencies-only",
  reversal: "carry-types-without-semantic-recoding-reject-parallel-edges",
  observation: "all-ordered-mandatory-regime-observables", delta: "after-minus-before-for-scalar-integers-only",
  response: "complete-changed-or-unchanged-incomplete-indeterminate", probeCoverage: "comparable-observable-pairs-over-all-targets",
  overallCoverage: "fully-observed-compatible-probes", histogram: "diagnostic-multiset-of-component-states-scalar-deltas-and-rejections",
  coordinates: "exclude-source-identifiers-provenance-hashes-and-work", signature: "deferred-to-SG2-024",
  codeExecution: "closed-data-operations-only", errors: "throw-no-partial-artifact", limits
});

export function normalizeResponseInput(input) {
  const raw = canonicalClone(input, RESPONSE_CODEC);
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.hasOwn(raw, "regimeId") ||
      Object.keys(raw).some(k => !["regimeId", "scope"].includes(k))) responseFail("INPUT_INVALID", "Expected a closed explicit regime and optional scope request.");
  return raw;
}
export function responseProfile(regime) {
  return responseSeal("profile", { regime: responseReference(regime),
    probeIds: STRUCTURAL_RESPONSE_REGISTRY.probes.filter(p => p.regimeIds.includes(regime.id)).map(p => p.id),
    excludedProbeIds: STRUCTURAL_RESPONSE_REGISTRY.probes.filter(p => !p.regimeIds.includes(regime.id)).map(p => p.id) }, "profileHash");
}

// Private exhaustive selectors over a verified scoped baseline. Traversal order
// serializes evidence; it cannot select a preferred member of a symmetric set.
export function planResponseTargets(baseline, profile) {
  const { graph, mapping } = baseline, edges = graph.edges, nodes = graph.nodes.map(n => n.id);
  if (edges.length > limits.maxTargetsPerProbe) responseFail("LIMIT_EXCEEDED", "Exhaustive direction targets exceed the per-probe budget.");
  const sourceNodes = new Map(mapping.nodes.map(n => [n.shadowNodeId, n.sourceNodeId]));
  const sourceEdges = new Map(mapping.edges.map(e => [e.shadowEdgeId, e.sourceEdgeId]));
  const outgoing = new Map(nodes.map(n => [n, []])); edges.forEach(e => outgoing.get(e.source).push(e));
  const work = { pathExtensions: 0, reachabilitySearches: 0, edgeScans: 0 };
  let total = 0;
  function reaches(source, target, removed = new Set()) {
    work.reachabilitySearches += 1;
    const seen = new Set([source]), queue = [source];
    for (let i = 0; i < queue.length; i += 1) {
      if (queue[i] === target) return true;
      for (const edge of outgoing.get(queue[i])) {
        work.edgeScans += 1;
        if (work.edgeScans > limits.maxSelectionEdgeScans) responseFail("LIMIT_EXCEEDED", "Exhaustive selector adjacency scans exceed their budget.");
        if (!removed.has(edge.id) && !seen.has(edge.target)) { seen.add(edge.target); queue.push(edge.target); }
      }
    }
    return false;
  }
  function target(path, kind) {
    const nodeIds = [path[0].source, ...path.map(e => e.target)], edgeIds = path.map(e => e.id);
    return { kind, sourceNodeIds: nodeIds.map(n => sourceNodes.get(n)), shadowNodeIds: nodeIds,
      sourceEdgeIds: edgeIds.map(e => sourceEdges.get(e)), shadowEdgeIds: edgeIds };
  }
  const plans = [];
  for (const probe of STRUCTURAL_RESPONSE_REGISTRY.probes.filter(p => profile.probeIds.includes(p.id))) {
    const targets = [], known = new Set(), unknown = [];
    function add(path, kind = "edge") {
      targets.push(target(path, kind)); path.forEach(e => known.add(sourceEdges.get(e.id))); total += 1;
      if (targets.length > limits.maxTargetsPerProbe || total > limits.maxTargets || total * edges.length > limits.maxTransformationEdgeVisits) {
        responseFail("LIMIT_EXCEEDED", "Exhaustive response targets exceed the fixed budget; no targets were sampled or truncated.");
      }
    }
    if (probe.selector.startsWith("necessity-")) {
      const value = probe.selector.slice("necessity-".length);
      for (const edge of edges) {
        if (!Object.hasOwn(edge.types, "necessity")) unknown.push(sourceEdges.get(edge.id));
        else if (edge.types.necessity === value) known.add(sourceEdges.get(edge.id));
      }
      if (!unknown.length) for (const edge of edges) if (edge.types.necessity === value) add([edge]);
    } else if (probe.selector === "simple-path-with-edge-disjoint-alternative") {
      function extend(root, current, path, seen) {
        for (const edge of outgoing.get(current)) {
          if (seen.has(edge.target)) continue;
          work.pathExtensions += 1;
          if (work.pathExtensions > limits.maxPathExtensions) responseFail("LIMIT_EXCEEDED", "Exhaustive simple-path discovery exceeds its budget.");
          const next = [...path, edge];
          if (reaches(root, edge.target, new Set(next.map(e => e.id)))) add(next, "simple-directed-path");
          extend(root, edge.target, next, new Set([...seen, edge.target]));
        }
      }
      for (const root of nodes) extend(root, root, [], new Set([root]));
    } else {
      for (const edge of edges) if (probe.selector === "each-internal-edge" || reaches(edge.target, edge.source)) add([edge]);
    }
    targets.sort((a, b) => {
      const left = responseEncoded(a.sourceEdgeIds), right = responseEncoded(b.sourceEdgeIds);
      return left < right ? -1 : left > right ? 1 : 0;
    });
    plans.push({ probe, selection: { state: unknown.length ? "unresolved" : "complete",
      knownEligibleSourceEdgeIds: [...known].sort(), unknownSourceEdgeIds: unknown.sort() }, targets });
  }
  return { plans, work, targetCount: total, transformationEdgeVisits: total * edges.length };
}

// Response targets include entire paths, so their execution records use a new
// contract. The original sandbox's public all/each target contract is unchanged.
export function transformResponseTarget(preparation, baseline, target, kind) {
  const selected = new Set(target.shadowEdgeIds), edges = [], edgeMapping = [], removed = [], reversed = [];
  const pairs = new Map(); let conflict = null;
  for (const [i, edge] of baseline.graph.edges.entries()) {
    const sourceEdgeId = baseline.mapping.edges[i].sourceEdgeId;
    const action = !selected.has(edge.id) ? "preserved" : kind === "remove-edges" ? "removed" : "reversed";
    edgeMapping.push({ sourceEdgeId, beforeEdgeId: edge.id, afterEdgeId: action === "removed" ? null : edge.id, action });
    if (action === "removed") { removed.push(sourceEdgeId); continue; }
    const changed = action === "reversed" ? { ...edge, source: edge.target, target: edge.source } : { ...edge };
    if (action === "reversed") reversed.push(sourceEdgeId);
    const key = `${changed.source}:${changed.target}`;
    if (pairs.has(key)) conflict = [pairs.get(key), sourceEdgeId].sort(); else pairs.set(key, sourceEdgeId);
    edges.push(changed);
  }
  if (conflict) return { execution: "rejected", rejection: { code: "parallel-edge-after-reversal", sourceEdgeIds: conflict }, graph: null, edgeMapping: null, changes: null };
  return { execution: "applied", rejection: null,
    graph: shadowGraph(preparation, baseline.graph.nodes.map(n => ({ ...n })), edges), edgeMapping,
    changes: { removedSourceEdgeIds: removed, reversedSourceEdgeIds: reversed } };
}

export function summarizeResponseProbe(runs, componentCount) {
  let numerator = 0;
  const histogram = new Map(), counts = { changed: 0, unchanged: 0, indeterminate: 0, rejected: 0 };
  for (const run of runs) {
    const status = run.execution === "rejected" ? "rejected" : run.response.status;
    counts[status] += 1; numerator += run.response?.coverage.numerator ?? 0;
    const effect = { status, components: run.response?.components ?? null, rejection: run.rejection?.code ?? null };
    const key = responseEncoded(effect);
    if (histogram.has(key)) histogram.get(key).count += 1; else histogram.set(key, { effect, count: 1 });
  }
  const denominator = runs.length * componentCount, complete = denominator > 0 && numerator === denominator;
  return { status: complete ? "observed" : "indeterminate", coverage: { numerator, denominator, complete }, counts,
    diagnostics: { effectHistogram: [...histogram].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value) } };
}
