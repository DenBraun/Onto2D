import { deepFreeze } from "@onto2d/kernel/canonical";

export const TYPED_SELECTION_POLICY = deepFreeze({
  id: "typed-source-parent-subgraph-v1", version: "1", nodePopulation: "all-source-nodes",
  necessityOrder: ["necessary", "enabling", "contextual", "optional"],
  roleUniverse: ["arising", "maintenance", "modulation"],
  channels: ["dependencyTypeId", "interactionModeIds", "causalDirectionIds"],
  missingCategory: "reject", missingChannel: "exclude-and-account", roleOrder: "subset-lattice"
});

export const INVERSE_TARGET_SHARE_METRIC_POLICY = deepFreeze({
  id: "inverse-target-share-v1", version: "1", vertexWeight: 1,
  edgeLength: "incoming-source-weight-sum-divided-by-source-weight",
  edgeWeight: "edge-length", normalizationContext: "full-source-projection",
  minimumSourceWeight: 0.000001, maximumSourceWeight: 1, invalidWeight: "reject",
  sourceMutation: "none", status: "experimental"
});

export const STRUCTURAL_INTERVAL_POLICY = deepFreeze({
  id: "outward-decimal-interval-v1", version: "1", decimalPlaces: 12,
  sourceNumberInterpretation: "canonical-json-decimal", squareRoot: "integer-isqrt",
  rounding: "outward-per-incidence", maxIncidences: 100000
});
