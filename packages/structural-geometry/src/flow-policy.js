import { deepFreeze } from "@onto2d/kernel/canonical";

export const STRUCTURAL_FLOW_POLICY = deepFreeze({
  id: "directed-ollivier-shadow-flow-v1", version: "1",
  sourceGraph: "immutable-source-parent-induced-scope",
  lengths: "separate-positive-rational-state",
  measures: "uniform-predecessors-to-uniform-successors",
  emptyNeighborhood: "dirac-at-endpoint",
  distance: "directed-shortest-path",
  update: "simultaneous-(1-step)*distance+step*wasserstein",
  metricClosure: "shortest-endpoint-distances-before-normalization",
  normalization: "total-length-equals-scoped-edge-count",
  numeric: "exact-rational-primal-dual",
  sourceWeights: "ignored", ordering: "utf16-code-unit",
  convergence: "fixed-point-or-consecutive-length-and-curvature-deltas",
  cycleDetection: "exact-normalized-length-vector",
  degenerateLength: "stop-before-zero-length-update",
  cuts: "optional-final-strict-length-threshold-no-feedback",
  defaults: {
    maxIterations: 16, step: "half", idleness: "half", stableSteps: 2,
    tolerance: { numerator: "1", denominator: "1000000" }, cut: { kind: "none" }
  },
  limits: {
    maxNodes: 64, maxEdges: 64, maxIterations: 24, maxStableSteps: 8,
    maxSupportSize: 16, maxTransportCells: 4096, maxHistoryTransportCells: 32768,
    maxMassDenominator: 512, maxRationalDigits: 256,
    maxTransportBytes: 1048576, maxArtifactBytes: 8388608, maxCanonicalEntries: 500000
  }
});

export const STRUCTURAL_FLOW_SOLVER = deepFreeze({
  id: "onto2d-python-flow-transport-reference", version: "1",
  method: "rational-cost-integer-mass-primal-dual-v1"
});
