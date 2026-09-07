# Causal Emergence: first descriptive geometry result

Source: complete verified `causal-emergence@2026.08.15`, pinned by
[source-lock.json](causal-emergence/source-lock.json).
Projection: `source-parent-directed-v1`; metric: `unit-v1`;
algorithm: `forman-directed-unit`, version `1`.

| Quantity | Frozen result |
|---|---:|
| Nodes | 249 |
| Edges | 971 |
| Negative-curvature edges | 940 |
| Zero-curvature edges | 24 |
| Positive-curvature edges | 7 |
| Minimum | -34 |
| Maximum | 1 |
| Exact mean | -6328 / 971 |

The [artifact](causal-emergence/artifact.json) has hash
`sha256:c455cd2dba039e9545ab6866b390a2f3522b23247bbef550df0a1c86710cb745`.
It includes every edge/node value, separate source/target level and relation
summaries, and all extrema ties. No edge was sampled or filtered out.

## Reading an edge

For `u -> v`, start with 2 and subtract the number of edges entering `u` and
the number leaving `v`. The result reports exactly those two counts alongside
`curvature`. A negative value therefore says that their sum exceeds 2 under
this metric. It does not establish weakness, causal importance or emergence.
This is the unit specialization of the directed definition documented in the
[metric policy](../../docs/structural-geometry/GEOMETRY.md#metric-and-algorithm-policies).

For example, edge `4.0->4.3` has the minimum value -34. Its result can be traced
through its original edge ID and the projection's source record hash to the
exact Model Pack. A node's `incomingCurvature` and `outgoingCurvature` sum its
incident edge values; `balance` is their difference, without a physical flow
interpretation.

## Local inspection

1. Run `npm ci --ignore-scripts` after pulling the changes.
2. Run `npm run structural-geometry:check`. All 35 focused tests and frozen
   reference checks should pass. Python 3 is required for the reference checks.
3. Run `npm run structural-geometry:report` to verify and inspect the census.
4. Open the JSON artifact for a specific edge or grouped summary. The
   [package API](../../packages/structural-geometry/README.md) supports direct
   analysis, explicit engine registration and verification against a source pack.

The existing web pages do not run this analysis on page load. Visualization,
alternative metrics and scientific comparison follow the
[subsequent roadmap gates](../../docs/structural-geometry/README.md).
