export const ANONYMOUS_NODE_REF = "sha256:c211b575685f9d84c0136736ccd8779bfb87f7f0dbb759322f72f03d0987f560";
export const TRIANGLE_SKELETON_ID = "sha256:9be4ec8a7a5f4bca5008180fc8a6dff4b90b7f7a7f5939b3a45745e45675e517";

export const IDENTITY_SCENARIOS = Object.freeze({
  base: Object.freeze({
    id: "base",
    name: "Feed-forward loop",
    change: "none",
    message: "Same structure: the candidate ID is stable.",
    candidateId: "sha256:0f578d7e0e573cc770fb189913486f1c0461a8aeebf83e6cdc7ac3d2208d0fea",
    edges: Object.freeze([
      Object.freeze({ from: 0, to: 1, role: "directed-link" }),
      Object.freeze({ from: 2, to: 1, role: "directed-link" }),
      Object.freeze({ from: 0, to: 2, role: "directed-link" })
    ]),
    canonicalEdges: Object.freeze([
      Object.freeze({ from: 1, to: 0, role: "directed-link" }),
      Object.freeze({ from: 2, to: 0, role: "directed-link" }),
      Object.freeze({ from: 2, to: 1, role: "directed-link" })
    ])
  }),
  reverse: Object.freeze({
    id: "reverse",
    name: "Directed 3-cycle",
    change: "direction",
    message: "Structural change: reversing one edge changes candidate identity.",
    candidateId: "sha256:913c5005d5ac33efaae366360c36c6f2bdfae29f0e86807b7074cf18d5a18f63",
    edges: Object.freeze([
      Object.freeze({ from: 1, to: 0, role: "directed-link" }),
      Object.freeze({ from: 2, to: 1, role: "directed-link" }),
      Object.freeze({ from: 0, to: 2, role: "directed-link" })
    ]),
    canonicalEdges: Object.freeze([
      Object.freeze({ from: 0, to: 2, role: "directed-link" }),
      Object.freeze({ from: 1, to: 0, role: "directed-link" }),
      Object.freeze({ from: 2, to: 1, role: "directed-link" })
    ])
  }),
  role: Object.freeze({
    id: "role",
    name: "Role-decorated feed-forward loop",
    change: "role",
    message: "Structural change: a declared edge role participates in candidate identity.",
    candidateId: "sha256:2a7015ba6762acf4a55aa29f2bb67dce36519b459e26d6698369e7c1d1911d85",
    edges: Object.freeze([
      Object.freeze({ from: 0, to: 1, role: "inhibits" }),
      Object.freeze({ from: 2, to: 1, role: "directed-link" }),
      Object.freeze({ from: 0, to: 2, role: "directed-link" })
    ]),
    canonicalEdges: Object.freeze([
      Object.freeze({ from: 1, to: 0, role: "directed-link" }),
      Object.freeze({ from: 2, to: 1, role: "directed-link" }),
      Object.freeze({ from: 2, to: 0, role: "inhibits" })
    ])
  })
});

export const NODE_PERMUTATIONS = Object.freeze([
  Object.freeze([0, 1, 2]), Object.freeze([1, 2, 0]), Object.freeze([2, 0, 1]),
  Object.freeze([0, 2, 1]), Object.freeze([2, 1, 0]), Object.freeze([1, 0, 2])
]);

const LABEL_SETS = Object.freeze([
  Object.freeze(["a", "b", "c"]), Object.freeze(["d", "e", "f"]), Object.freeze(["node-3", "node-1", "node-2"]),
  Object.freeze(["x", "z", "y"]), Object.freeze(["III", "II", "I"]), Object.freeze(["q", "p", "r"])
]);

export function inputView(scenarioId = "base", permutationIndex = 0, reverseEdgeOrder = false) {
  const scenario = IDENTITY_SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown identity scenario: ${scenarioId}`);
  if (!Number.isInteger(permutationIndex) || permutationIndex < 0 || permutationIndex >= NODE_PERMUTATIONS.length) {
    throw new Error("Permutation index is outside the frozen six-node-order audit.");
  }
  const newToOld = NODE_PERMUTATIONS[permutationIndex];
  const oldToNew = Array(3);
  newToOld.forEach((oldIndex, newIndex) => { oldToNew[oldIndex] = newIndex; });
  const edges = scenario.edges.map((edge) => ({
    from: oldToNew[edge.from],
    to: oldToNew[edge.to],
    role: edge.role
  }));
  if (reverseEdgeOrder) edges.reverse();
  return Object.freeze({
    scenario,
    labels: LABEL_SETS[permutationIndex],
    nodes: Object.freeze(Array.from({ length: 3 }, () => Object.freeze({ ref: ANONYMOUS_NODE_REF }))),
    edges: Object.freeze(edges.map(Object.freeze)),
    permutationIndex,
    reverseEdgeOrder
  });
}
