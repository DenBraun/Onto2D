import { deepFreeze } from "@onto2d/kernel/canonical";

export const OLLIVIER_POLICY = deepFreeze({
  id: "ollivier-directed-in-out-unit-v1",
  version: "1",
  sourceMeasure: "uniform-predecessors",
  targetMeasure: "uniform-successors",
  emptyNeighborhood: "dirac-at-endpoint",
  idleness: ["zero", "half"],
  defaultIdleness: "zero",
  distance: "directed-shortest-path-in-scoped-graph",
  edgeLength: 1,
  denominator: "directed-endpoint-distance",
  disconnectedSupport: "reject-unreachable-pair",
  sourceWeights: "ignored",
  numeric: "exact-integer-transport-rational-curvature",
  verification: "primal-dual-equality",
  ordering: "utf16-code-unit",
  limits: {
    maxNodes: 64, maxEdges: 256, maxAnalyzedEdges: 32,
    maxSupportSize: 16, maxTransportCells: 256, maxTotalTransportCells: 4096,
    maxMassDenominator: 512, maxPotentialMagnitude: 4096,
    maxTransportBytes: 1048576
  }
});

export const OLLIVIER_SOLVER = deepFreeze({
  id: "onto2d-python-ollivier-reference",
  version: "1",
  method: "integer-successive-shortest-path-primal-dual-v1"
});
