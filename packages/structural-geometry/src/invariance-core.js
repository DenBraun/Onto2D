import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { canonicalizeDirectedStructure } from "./canonical-core.js";
import { CANONICAL_STRUCTURE_IMPLEMENTATION } from "./canonical.js";
import { measureDirectedTopology } from "./topology-core.js";
import { TOPOLOGY_OBSERVATION_IMPLEMENTATION } from "./topology.js";
import { canonicalizeTypedDirectedStructure, normalizeEdgeTypes } from "./typed-core.js";
import { TYPED_RELATIONS_IMPLEMENTATION } from "./typed-observation.js";

export const INVARIANCE_CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: 500000 }) });
export const invarianceHash = (kind, value) => hashCanonical(`onto2d:structural-invariance-${kind}:v1`, value, INVARIANCE_CODEC);
export const invarianceReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export function invarianceFail(code, message) { throw new EngineError(`STRUCTURAL_INVARIANCE_${code}`, message); }
export function invarianceEncoded(value) {
  const text = canonicalize(value, INVARIANCE_CODEC);
  if (new TextEncoder().encode(text).length > 4194304) invarianceFail("LIMIT_EXCEEDED", "Invariance output exceeds its 4 MiB byte budget.");
  return text;
}
export function invarianceSeal(kind, body, field = "artifactHash") {
  const result = { ...body, [field]: invarianceHash(kind, body) }; invarianceEncoded(result); return deepFreeze(result);
}
const descriptor = (kind, body) => invarianceSeal(kind, body, "contentHash");
const transformations = ["record-order", "bijective-node-id-renaming", "bijective-edge-id-renaming", "presentation-only-changes"];
const parameters = [
  { records: "reverse-node-and-edge-arrays", keys: "reverse-recursively", whitespace: "two-space-indentation" },
  { namespace: "vertex:", ordinal: "reversed-zero-based-padded-three", endpoints: "transport-both" },
  { namespace: "link:", ordinal: "reversed-zero-based-padded-three" },
  { labels: "replace", positions: "reflect-and-translate", colors: "replace", zoom: "replace" }
];
export const STRUCTURAL_INVARIANCE_REGISTRY = descriptor("registry", {
  id: "structural-invariance-probes-v1", version: "1",
  regimeIds: ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"],
  probes: transformations.map((transformation, i) => descriptor("probe", {
    id: `${transformation}-probe-v1`, version: "1", family: "invariance", mandatory: true,
    transformation, target: "whole-scoped-representation", parameters: parameters[i]
  }))
});
export const STRUCTURAL_INVARIANCE_POLICY = descriptor("policy", {
  id: "measured-structural-invariance-v1", version: "1", registry: invarianceReference(STRUCTURAL_INVARIANCE_REGISTRY),
  source: "verified-identity-sandbox", copies: "every-probe-starts-from-baseline", targets: "all-scoped-records",
  payload: "exact-json-string-with-synthetic-presentation", graphHash: "identifier-sensitive-provenance-excludes-presentation",
  comparison: "all-mandatory-observables-exact-values", missingness: "strict-indeterminate-retain-differences",
  emptyProfile: "indeterminate", emptyEdgeRename: "explicit-no-op", vocabulary: "same-source-context-only",
  codeExecution: "closed-data-transformations-only", errors: "throw-no-partial-artifact",
  limits: { maxRepresentations: 5, maxObservationEvaluations: 5, maxCanonicalizerCalls: 10,
    maxCanonicalEntries: 500000, maxArtifactBytes: 4194304 }
});
export const STRUCTURAL_SHADOW_OBSERVATION_ADAPTER = descriptor("adapter", {
  id: "invariance-shadow-observation-adapter-v1", version: "1", input: "private-source-bound-representation",
  decoding: "parse-each-exact-json-payload-before-evaluation", presentation: "exclude-node-and-edge-presentation-and-viewport",
  graph: "preserve-all-node-ids-directed-endpoints-and-five-present-typed-fields",
  typedVocabulary: "unchanged-verified-source-context", missing: "source-edge-and-field-with-null-value",
  implementations: [CANONICAL_STRUCTURE_IMPLEMENTATION, TOPOLOGY_OBSERVATION_IMPLEMENTATION, TYPED_RELATIONS_IMPLEMENTATION].map(invarianceReference)
});

function graphData(data) {
  return { nodes: data.nodes.map(n => ({ id: n.id })), edges: data.edges.map(e => ({ id: e.id, source: e.source, target: e.target,
    ...(Object.hasOwn(e, "types") ? { types: e.types } : {}) })) };
}
function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).reverse().map(k => [k, reverseKeys(value[k])]));
  return value;
}
function representation(data, serialization = false) {
  const graph = graphData(data), byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  graph.nodes.sort(byId); graph.edges.sort(byId);
  const payload = JSON.stringify(serialization ? reverseKeys(data) : data, null, serialization ? 2 : undefined);
  return deepFreeze({ payload, payloadHash: invarianceHash("payload", payload), graphHash: invarianceHash("graph", graph) });
}
export function baselineRepresentation(graph) {
  return representation({
    nodes: graph.nodes.map((n, i) => ({ id: n.id, presentation: { label: `Node ${i}`, x: i, y: -i } })),
    edges: graph.edges.map((e, i) => ({ ...e, presentation: { label: `Edge ${i}`, color: "#334155" } })), viewport: { zoom: 1 }
  });
}
// Private transformations accept only the baseline made by the verified public
// entry point. Serialized bytes are retained: canonicalizing the enclosing
// artifact cannot erase the record/key/whitespace experiment.
export function transformRepresentation(baseline, mapping, probe) {
  const data = JSON.parse(baseline.payload), t = probe.transformation;
  const aliases = (records, rename, prefix) => new Map(records.map((r, i) => [r.id,
    rename ? `${prefix}${String(records.length - 1 - i).padStart(3, "0")}` : r.id]));
  const nodes = aliases(data.nodes, t === transformations[1], "vertex:"), edges = aliases(data.edges, t === transformations[2], "link:");
  const transported = {
    nodes: mapping.nodes.map(n => ({ sourceNodeId: n.sourceNodeId, beforeId: n.shadowNodeId, afterId: nodes.get(n.shadowNodeId) })),
    edges: mapping.edges.map(e => ({ sourceEdgeId: e.sourceEdgeId, beforeId: e.shadowEdgeId, afterId: edges.get(e.shadowEdgeId) }))
  };
  data.nodes = data.nodes.map(n => ({ ...n, id: nodes.get(n.id) }));
  data.edges = data.edges.map(e => ({ ...e, id: edges.get(e.id), source: nodes.get(e.source), target: nodes.get(e.target) }));
  if (t === transformations[0]) { data.nodes.reverse(); data.edges.reverse(); }
  if (t === transformations[3]) {
    data.nodes = data.nodes.map((n, i) => ({ ...n, presentation: { label: `Changed vertex ${i}`, x: 100 - n.presentation.x, y: 50 - n.presentation.y } }));
    data.edges = data.edges.map((e, i) => ({ ...e, presentation: { label: `Changed link ${i}`, color: "#e11d48" } }));
    data.viewport.zoom = 2;
  }
  return { representation: representation(data, t === transformations[0]), mapping: transported };
}

// This adapter is deliberately private. A hash on caller-supplied graph data
// cannot authorize its source identity; the public verifier rebuilds everything.
export function observeRepresentation(preparation, encodedGraph, sourceEdges) {
  const data = graphData(JSON.parse(encodedGraph.payload)), ids = data.nodes.map(n => n.id);
  const typed = preparation.regime.id === "typed-relations-v1", topology = preparation.regime.id === "topology-only-v1";
  let values, missing = [], canonicalizerCalls = 0;
  if (topology) {
    const result = measureDirectedTopology(ids, data.edges);
    values = TOPOLOGY_OBSERVATION_IMPLEMENTATION.valueFields.map(({ field }) => result.value[field]);
  } else {
    values = [canonicalizeDirectedStructure(ids, data.edges).value]; canonicalizerCalls += 1;
    if (typed) {
      const edges = data.edges.map(e => ({ ...e.types, id: e.id, source: e.source, target: e.target }));
      const sourceIds = new Map(sourceEdges.map(e => [e.afterId, e.sourceEdgeId]));
      for (const edge of edges) for (const field of normalizeEdgeTypes(edge).missing) missing.push({ sourceEdgeId: sourceIds.get(edge.id), field });
      // Stable source provenance order also survives reversed input records.
      missing.sort((a, b) => a.sourceEdgeId < b.sourceEdgeId ? -1 : a.sourceEdgeId > b.sourceEdgeId ? 1 : a.field < b.field ? -1 : a.field > b.field ? 1 : 0);
      values.push(missing.length ? null : canonicalizeTypedDirectedStructure(ids, edges).value);
      canonicalizerCalls += Number(!missing.length);
    }
  }
  const implementation = invarianceReference(topology ? TOPOLOGY_OBSERVATION_IMPLEMENTATION : typed ? TYPED_RELATIONS_IMPLEMENTATION : CANONICAL_STRUCTURE_IMPLEMENTATION);
  const observations = preparation.regime.observables.map((observable, i) => {
    const value = values[i], gaps = typed && i === 1 ? missing : [];
    const binding = { regime: invarianceReference(preparation.regime), observable, implementation,
      ...(typed ? { contextHash: preparation.context.contextHash } : {}), value };
    return { observable, implementation, availability: value === null ? "missing" : "observed", value,
      valueHash: value === null ? null : invarianceHash("value", binding), missing: gaps };
  });
  return invarianceSeal("observation", { adapter: invarianceReference(STRUCTURAL_SHADOW_OBSERVATION_ADAPTER),
    source: { contextHash: preparation.context.contextHash, scopeHash: preparation.scope.scopeHash },
    payloadHash: encodedGraph.payloadHash, observations, work: { canonicalizerCalls } });
}

// Private strict adjudication also serves destructive negative controls. The
// public registry contains only the four transformations fixed above.
export function adjudicateInvariance(states) {
  const numerator = states.filter(s => s !== "indeterminate").length, denominator = states.length;
  return { status: !denominator || numerator !== denominator ? "indeterminate" : states.includes("different") ? "failed" : "passed",
    coverage: { numerator, denominator } };
}
export function compareInvarianceObservations(before, after) {
  if (invarianceEncoded(before.source) !== invarianceEncoded(after.source) || invarianceEncoded(before.adapter) !== invarianceEncoded(after.adapter)) {
    invarianceFail("PROFILE_MISMATCH", "Source context, scope or observation adapter differs.");
  }
  if (before.observations.length !== after.observations.length) invarianceFail("PROFILE_MISMATCH", "Observation profiles differ.");
  const components = before.observations.map((left, i) => {
    const right = after.observations[i];
    if (invarianceEncoded(left.observable) !== invarianceEncoded(right.observable) || invarianceEncoded(left.implementation) !== invarianceEncoded(right.implementation)) {
      invarianceFail("PROFILE_MISMATCH", "Observable or implementation binding differs.");
    }
    return { observableId: left.observable.id, state: left.availability !== "observed" || right.availability !== "observed" ? "indeterminate"
      : invarianceEncoded(left.value) === invarianceEncoded(right.value) ? "equal" : "different" };
  });
  return { ...adjudicateInvariance(components.map(c => c.state)), components };
}

export function normalizeInvarianceInput(input) {
  const raw = canonicalClone(input, INVARIANCE_CODEC);
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.hasOwn(raw, "regimeId") ||
    Object.keys(raw).some(k => !["regimeId", "scope"].includes(k))) invarianceFail("INPUT_INVALID", "Expected an explicit, closed regime and optional scope request.");
  return raw;
}
