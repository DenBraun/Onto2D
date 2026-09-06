import { canonicalize, deepFreeze } from "@onto2d/kernel/canonical";
import { canonicalizeCandidate } from "@onto2d/kernel/graph-canonicalizer";
import { EngineError } from "@onto2d/engine";
import { getDistinguishabilityRegime } from "./regimes.js";

export const typedRegime = getDistinguishabilityRegime("typed-relations-v1");
export const typedFields = typedRegime.vocabularyPolicy.fields;
export const setFields = typedRegime.matchingPolicy.setValuedFields;
export const typedHashDomain = "onto2d:structural-typed";
export function typedFail(code, message) { throw new EngineError(`STRUCTURAL_TYPED_${code}`, message); }
export function validTypedAtom(field, value) {
  if (field === "ontologicalRole") return typedRegime.vocabularyPolicy.roleUniverse.includes(value);
  if (field === "necessity") return typedRegime.vocabularyPolicy.necessityUniverse.includes(value);
  return Number.isSafeInteger(value) && value >= 0;
}
export function normalizeEdgeTypes(edge) {
  const types = {}, missing = [];
  for (const field of typedFields) {
    if (!Object.hasOwn(edge, field)) { missing.push(field); continue; }
    const value = edge[field];
    if (setFields.includes(field)) {
      if (!Array.isArray(value) || value.some((code) => !validTypedAtom(field, code)) || new Set(value).size !== value.length) {
        typedFail("FIELD_INVALID", `Edge ${edge.id} requires a distinct set of nonnegative safe integer codes in ${field}.`);
      }
      types[field] = [...value].sort((a, b) => a - b);
    } else {
      if (!validTypedAtom(field, value)) typedFail("FIELD_INVALID", `Edge ${edge.id} has an invalid ${field}.`);
      types[field] = value;
    }
  }
  return { types, missing };
}

// Private adapter: callers verify source/scope first. One kernel bijection
// preserves directed adjacency and every field together, never per-field maps.
export function canonicalizeTypedDirectedStructure(nodeIds, edges) {
  const { limits: bounds, matchingPolicy } = typedRegime;
  if (nodeIds.length < 1 || nodeIds.length > bounds.maxNodes || edges.length > bounds.maxEdges) {
    typedFail("LIMIT_EXCEEDED", "Typed structure requires 1–6 nodes and at most 30 edges.");
  }
  const ids = [...nodeIds].sort(), ordered = [...edges].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const index = new Map(ids.map((id, i) => [id, i])), edgeIds = new Set(), pairs = new Set();
  if (index.size !== ids.length) typedFail("GRAPH_INVALID", "Typed node IDs must be distinct.");
  const translation = matchingPolicy.candidateTranslation;
  const candidates = ordered.map((edge) => {
    const from = index.get(edge.source), to = index.get(edge.target), pair = `${from}:${to}`;
    if (from === undefined || to === undefined || from === to || edgeIds.has(edge.id) || pairs.has(pair)) {
      typedFail("GRAPH_INVALID", "Typed edges require distinct IDs and loopless, nonparallel scoped endpoints.");
    }
    edgeIds.add(edge.id); pairs.add(pair);
    const { types, missing } = normalizeEdgeTypes(edge);
    if (missing.length) typedFail("EVIDENCE_MISSING", "Exact typed matching requires every declared edge field.");
    const attrs = Object.fromEntries(typedFields.map((field) => [field, setFields.includes(field) ? canonicalize(types[field]) : types[field]]));
    return { from, to, role: translation.edgeRole, attrs };
  });
  const result = canonicalizeCandidate({ domain: translation.domain,
    nodes: ids.map(() => ({ ref: translation.nodeRef })), edges: candidates },
  { policy: matchingPolicy.graphPolicy, limits: { maxNodes: bounds.maxNodes, maxEdges: bounds.maxEdges, maxSearchStates: bounds.maxSearchStates } });
  const decode = (attrs) => Object.fromEntries(typedFields.map((field) => [field, setFields.includes(field) ? JSON.parse(attrs[field]) : attrs[field]]));
  return deepFreeze({ value: { nodeCount: ids.length,
    edges: result.canonical.edges.map(({ from, to, attrs }) => ({ from, to, types: decode(attrs) })) },
  witness: {
    nodes: ids.map((sourceNodeId, i) => ({ sourceNodeId, canonicalNode: result.inputToCanonical[i] })),
    edges: ordered.map((edge, i) => ({ sourceEdgeId: edge.id, from: result.inputToCanonical[candidates[i].from],
      to: result.inputToCanonical[candidates[i].to], types: decode(candidates[i].attrs) })),
    candidateHash: result.candidateId, skeletonHash: result.skeletonId,
    statistics: { searchStates: result.statistics.searchStates, leaves: result.statistics.leaves, refinementRounds: result.statistics.refinementRounds }
  } });
}
