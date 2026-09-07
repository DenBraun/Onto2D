import { canonicalizeDirectedStructure } from "./canonical-core.js";
import { CANONICAL_STRUCTURE_IMPLEMENTATION } from "./canonical.js";
import { measureDirectedTopology } from "./topology-core.js";
import { TOPOLOGY_OBSERVATION_IMPLEMENTATION } from "./topology.js";
import { canonicalizeTypedDirectedStructure, normalizeEdgeTypes } from "./typed-core.js";
import { TYPED_RELATIONS_IMPLEMENTATION } from "./typed-observation.js";
import { responseDescriptor, responseReference, responseSeal, responseHash, responseEncoded, responseFail } from "./responses-core.js";

export const STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER = responseDescriptor("adapter", {
  id: "response-shadow-observation-adapter-v1", version: "1", input: "private-verified-source-bound-shadow-graph",
  graph: "all-retained-nodes-directed-endpoints-and-present-joint-types", vocabulary: "unchanged-source-context",
  missing: "source-edge-and-field-with-null-value", profile: "all-ordered-mandatory-regime-observables",
  delta: "after-minus-before-scalar-integers-only", otherAttributes: "excluded",
  implementations: [CANONICAL_STRUCTURE_IMPLEMENTATION, TOPOLOGY_OBSERVATION_IMPLEMENTATION, TYPED_RELATIONS_IMPLEMENTATION].map(responseReference)
});

// Private adapter: callers cannot authorize a graph's source merely by supplying
// a hash. The public entry point creates it; verification rebuilds that path.
export function observeResponseGraph(preparation, graph, sourceMappings) {
  if (graph.source.contextHash !== preparation.context.contextHash || graph.source.scopeHash !== preparation.scope.scopeHash ||
      responseEncoded(graph.regime) !== responseEncoded(responseReference(preparation.regime))) responseFail("BINDING_MISMATCH", "Shadow graph source, scope or regime differs.");
  const ids = graph.nodes.map(n => n.id), typed = preparation.regime.id === "typed-relations-v1", topology = preparation.regime.id === "topology-only-v1";
  let values, missing = [], canonicalizerCalls = 0;
  if (topology) {
    const { value } = measureDirectedTopology(ids, graph.edges);
    values = TOPOLOGY_OBSERVATION_IMPLEMENTATION.valueFields.map(({ field }) => value[field]);
  } else {
    values = [canonicalizeDirectedStructure(ids, graph.edges).value]; canonicalizerCalls += 1;
    if (typed) {
      const edges = graph.edges.map(e => ({ ...e.types, id: e.id, source: e.source, target: e.target }));
      const sourceIds = new Map(sourceMappings.filter(e => e.afterEdgeId !== null).map(e => [e.afterEdgeId, e.sourceEdgeId]));
      for (const edge of edges) for (const field of normalizeEdgeTypes(edge).missing) missing.push({ sourceEdgeId: sourceIds.get(edge.id), field });
      missing.sort((a, b) => a.sourceEdgeId < b.sourceEdgeId ? -1 : a.sourceEdgeId > b.sourceEdgeId ? 1 : a.field < b.field ? -1 : a.field > b.field ? 1 : 0);
      values.push(missing.length ? null : canonicalizeTypedDirectedStructure(ids, edges).value); canonicalizerCalls += Number(!missing.length);
    }
  }
  const implementation = responseReference(topology ? TOPOLOGY_OBSERVATION_IMPLEMENTATION : typed ? TYPED_RELATIONS_IMPLEMENTATION : CANONICAL_STRUCTURE_IMPLEMENTATION);
  const observations = preparation.regime.observables.map((observable, i) => {
    const value = values[i], binding = { regime: responseReference(preparation.regime), observable, implementation,
      ...(typed ? { contextHash: preparation.context.contextHash } : {}), value };
    return { observable, implementation, availability: value === null ? "missing" : "observed", value,
      valueHash: value === null ? null : responseHash("value", binding), missing: typed && i === 1 ? missing : [] };
  });
  return responseSeal("observation", { adapter: responseReference(STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER),
    source: { contextHash: preparation.context.contextHash, scopeHash: preparation.scope.scopeHash },
    graphHash: graph.graphHash, observations, work: { canonicalizerCalls } });
}

export function measureResponse(before, after) {
  for (const field of ["source", "adapter"]) if (responseEncoded(before[field]) !== responseEncoded(after[field])) responseFail("BINDING_MISMATCH", "Response source, scope or adapter differs.");
  if (before.observations.length !== after.observations.length) responseFail("PROFILE_MISMATCH", "Response observation profiles differ.");
  const components = before.observations.map((left, i) => {
    const right = after.observations[i];
    for (const field of ["observable", "implementation"]) if (responseEncoded(left[field]) !== responseEncoded(right[field])) responseFail("PROFILE_MISMATCH", "Response observable or implementation differs.");
    const observed = left.availability === "observed" && right.availability === "observed";
    const state = !observed ? "indeterminate" : responseEncoded(left.value) === responseEncoded(right.value) ? "equal" : "different";
    return { observableId: left.observable.id, state,
      delta: observed && typeof left.value === "number" && typeof right.value === "number" ? right.value - left.value : null };
  });
  const numerator = components.filter(c => c.state !== "indeterminate").length, denominator = components.length;
  const complete = denominator > 0 && numerator === denominator;
  return { status: !complete ? "indeterminate" : components.some(c => c.state === "different") ? "changed" : "unchanged",
    coverage: { numerator, denominator, complete }, components };
}
