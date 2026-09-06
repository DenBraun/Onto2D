import { deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { SOURCE_PARENT_DIRECTED_POLICY } from "./policies.js";
import { TYPED_SELECTION_POLICY } from "./experiment-policies.js";

export const regimeHash = (kind, body) => hashCanonical(`onto2d:structural-regime-${kind}:v1`, body);
const policy = (id, definition) => {
  const body = { id, version: "1", ...definition };
  return { ...body, contentHash: regimeHash("policy", body) };
};
const projectionPolicy = { id: SOURCE_PARENT_DIRECTED_POLICY.id, version: "1",
  contentHash: hashCanonical("onto2d:structural-projection-policy:v1", SOURCE_PARENT_DIRECTED_POLICY) };
// A uniform synthetic color satisfies the kernel's content-hash ref contract.
// It is not a source node ID or a claim that the node refers to a kernel package.
const nodeRef = regimeHash("node-color", { id: "untyped-structural-node", version: "1" });
const scopePolicy = policy("verified-source-induced-scope-v1", {
  sourceVerification: "complete-model-before-scoping", membership: "explicit-node-set-or-full-source",
  edges: "both-endpoints-in-scope", isolatedNodes: "retained",
  boundary: "partition-incoming-outgoing-external-edges", implicitTruncation: "forbidden"
});
const exactMatching = policy("directed-candidate-matching-v1", {
  equivalence: "directed-graph-isomorphism", direction: "preserved",
  nodeMatching: "all-bijections", edgeMatching: "mapped-ordered-endpoints",
  sourceIdentifiers: "provenance-only", disconnectedGraphs: "allowed",
  candidateTranslation: { domain: "single-candidate", nodeRef,
    edgeRole: "source-parent", nodeAttributes: [], edgeAttributes: [] },
  graphPolicy: { connected: false, allowParallelEdges: false, allowSelfLoops: false,
    connectivityProjection: "directed-weak", structuralNodeAttributes: [], structuralEdgeAttributes: [] },
  algorithm: "kernel-canonicalizeCandidate", exhaustion: "error-no-heuristic-identity"
});
const summaryMatching = policy("directed-summary-matching-v1", {
  equivalence: "ordered-observable-profile-equality", direction: "preserved",
  nodeMatching: "none", edgeMatching: "none", sourceIdentifiers: "provenance-only",
  graphIsomorphismClaim: false, exhaustion: "error-no-partial-profile"
});
const typedFields = ["dependencyTypeId", "interactionModeIds", "ontologicalRole", "necessity", "causalDirectionIds"];
const typedMatching = policy("directed-typed-candidate-matching-v1", {
  equivalence: "edge-annotated-directed-graph-isomorphism", direction: "preserved",
  nodeMatching: "one-common-bijection-for-topology-and-types", edgeMatching: "mapped-ordered-endpoints",
  sourceIdentifiers: "provenance-only", disconnectedGraphs: "allowed",
  candidateTranslation: { domain: "single-candidate", nodeRef,
    edgeRole: "source-parent", nodeAttributes: [], edgeAttributes: typedFields,
    setAttributeEncoding: "canonical-json-string-of-sorted-integer-array" },
  graphPolicy: { connected: false, allowParallelEdges: false, allowSelfLoops: false,
    connectivityProjection: "directed-weak", structuralNodeAttributes: [], structuralEdgeAttributes: typedFields },
  setValuedFields: ["interactionModeIds", "causalDirectionIds"], setOrdering: "ascending-distinct-integer-codes",
  algorithm: "kernel-canonicalizeCandidate", exhaustion: "error-no-heuristic-identity"
});
const ignoredVocabulary = policy("untyped-vocabulary-v1", { meaning: "excluded-from-observations" });
const typedVocabulary = policy("model-local-typed-vocabulary-v1", {
  fields: typedFields, localBinding: "verified-full-model-dictionary-hash",
  codeType: "nonnegative-safe-integer", setDuplicates: "validation-error",
  roleUniverse: TYPED_SELECTION_POLICY.roleUniverse, necessityUniverse: TYPED_SELECTION_POLICY.necessityOrder,
  crossModel: "requires-explicit-reviewed-shared-vocabulary-or-mapping",
  equalDictionaryBytesAlone: "insufficient-cross-model-authority",
  missingCompatibility: "indeterminate", epistemicStatus: "excluded-from-observations",
  missingField: "missing-mandatory-evidence", emptyDeclaredSet: "observed-empty-set",
  invalidField: "validation-error"
});
const invariance = policy("structural-relabeling-invariances-v1", {
  transformations: ["record-order", "bijective-node-id-renaming", "bijective-edge-id-renaming", "presentation-only-changes"],
  actsOn: "scoped-graph-with-transported-scope-membership",
  provenanceHashes: "may-change", probeExecution: "not-implied-by-declaration"
});
const probeSets = {
  invariance: policy("empty-invariance-probe-set-v1", { probes: [], execution: "none" }),
  response: policy("empty-response-probe-set-v1", { probes: [], execution: "none" })
};
const missingness = policy("strict-indeterminate-v1", {
  mandatoryGaps: ["missing", "unavailable", "rejected", "unresolved"],
  incompleteStatus: "indeterminate", incompleteDistance: null,
  observedDifferences: "retain-as-diagnostics", invalidArtifact: "validation-error",
  emptyProfile: "indeterminate", coverage: "per-component-with-reasons", partialDistance: "not-supported"
});
const aggregation = policy("exact-profile-equality-v1", {
  completeEqualStatus: "indistinguishable-under-regime", completeDifferentStatus: "distinguishable-under-regime",
  numericPolicy: "exact-discrete", tolerance: "none", intervals: "unsupported",
  distanceConstruction: "deferred-to-comparison-contract"
});
const reference = ({ id, version, contentHash }) => ({ id, version, contentHash });
function observable(id, valueType, units, definition, supplier, evidence = ["verified-scoped-directed-projection"]) {
  const body = { schemaVersion: "1", id, version: "1", valueType, scope: "whole-scoped-directed-graph",
    units, normalization: "none", mandatory: true, requiredEvidence: evidence,
    supplier: policy(supplier, { operation: id, definition }), definition };
  return { ...body, contentHash: regimeHash("observable", body) };
}
export const STRUCTURAL_OBSERVABLE_SPECS = deepFreeze([
  observable("canonical-directed-structure-v1", "canonical-directed-graph", "discrete-structure",
    "Canonical directed adjacency including isolated nodes, modulo node relabeling; all source attributes excluded.", "structural-canonical-observation-v1"),
  ...[
    ["node-count-v1", "nonnegative-integer", "nodes", "Number of scoped nodes including isolates."],
    ["edge-count-v1", "nonnegative-integer", "edges", "Number of directed edges with both endpoints in scope."],
    ["weak-component-sizes-v1", "sorted-positive-integer-vector", "nodes", "Ascending multiset of weak-component sizes, including singleton isolates."],
    ["strong-component-sizes-v1", "sorted-positive-integer-vector", "nodes", "Ascending multiset of strongly connected component sizes, including singletons."],
    ["reachable-ordered-pair-count-v1", "nonnegative-integer", "ordered-node-pairs", "Number of distinct ordered pairs (u,v), u != v, connected by a directed path; each pair counted once."],
    ["cyclic-node-count-v1", "nonnegative-integer", "nodes", "Number of nodes in a strongly connected component of size greater than one; source policy excludes self-loops."],
    ["isolated-node-count-v1", "nonnegative-integer", "nodes", "Number of nodes with zero incoming and zero outgoing scoped edges."]
  ].map(([id, type, units, definition]) => observable(id, type, units, definition, "structural-topology-observation-v1")),
  observable("canonical-typed-directed-structure-v1", "canonical-typed-directed-graph", "discrete-structure",
    "Canonical directed adjacency with all five declared edge fields under one common node bijection; ID arrays are sets, and code meanings require the vocabulary policy.",
    "structural-typed-observation-v1", ["verified-scoped-directed-projection", "complete-declared-edge-types", "bound-local-dictionaries", "compatible-vocabulary-for-comparison"])
]);

export const DISTINGUISHABILITY_REGIMES = deepFreeze([
  ["canonical-structure-v1", exactMatching, ignoredVocabulary, [0], 6, 30, 100000],
  ["topology-only-v1", summaryMatching, ignoredVocabulary, [1, 2, 3, 4, 5, 6, 7], 64, 256, 0],
  ["typed-relations-v1", typedMatching, typedVocabulary, [0, 8], 6, 30, 100000]
].map(([id, matchingPolicy, vocabularyPolicy, indices, maxNodes, maxEdges, maxSearchStates]) => {
  const body = { schemaVersion: "1", id, version: "1", projectionPolicy, scopePolicy, matchingPolicy, vocabularyPolicy,
    observables: indices.map((index) => reference(STRUCTURAL_OBSERVABLE_SPECS[index])),
    invariancePolicy: invariance, probeSets, missingnessPolicy: missingness, aggregationPolicy: aggregation,
    limits: { minNodes: 1, maxNodes, maxEdges, maxSearchStates,
      maxReachabilityPairVisits: id === "topology-only-v1" ? 4096 : 0,
      maxCanonicalEntries: 100000, maxArtifactBytes: 1048576 } };
  return { ...body, contentHash: regimeHash("descriptor", body) };
}));
