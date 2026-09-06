# Metric and algorithm policies

This page defines the original unit foundation. The separate
[stage-three experiment contract](METRIC_EXPERIMENTS.md) adds typed selections
and an optional local inverse-share metric with deterministic interval bounds.
It does not change these policies or their frozen artifacts.
The separate [Ollivier contract](OLLIVIER_CURVATURE.md) defines directed unit
transport, idleness, scope boundaries and exact external-solver certificates.

The [revised provider design](DISTINGUISHABILITY_DESIGN.md) will wrap these
policies without changing their IDs, numeric semantics or v1 output. A provider
is an explicit implementation/context boundary, not a scientific justification
by itself. Filtration/channel outputs and inter-structure pseudometrics remain
distinct from positive intra-graph edge lengths. Provider APIs are planned.

## `unit-v1`, version `1`

Every projected vertex has weight 1, every edge has weight 1 and length 1.
Source `weight` and `quantization` are retained for traceability and never used
as distance, strength, confidence or curvature coefficients. Necessity, roles,
levels and scientific status are not scalarized. The full metric policy is
bound under `onto2d:structural-metric-policy:v1`.

## `forman-directed-unit`, version `1`

Use the non-augmented directed definition of Saucan et al., equation (5):
incoming edges at the **source** and outgoing edges at the **target** contribute
to the edge neighborhood. With all weights equal to one, for `e: u -> v`:

```text
F(e) = 2 - indegree(u) - outdegree(v)
```

A reciprocal `v -> u` edge contributes once on each side. Loops and parallel
edges are rejected by the initial projection policy, so no loop convention or
multiplicity interpretation is implicit. The derivation and node aggregates
follow [Saucan et al., Discrete Ricci curvatures for directed networks,
equations (5)–(8)](https://arxiv.org/abs/1809.07698).

For each vertex, report the sum on incoming edges, the sum on outgoing edges,
and their difference `balance = incomingCurvature - outgoingCurvature`.
The word balance describes arithmetic; it does not assert conservation of a
physical quantity. Each edge reports its two contributing endpoint degrees.
All curvature arithmetic is integer and exact within the declared bounds.

Distribution summaries contain count, sum, minimum, maximum and an exact mean
represented as `{numerator: sum, denominator: count}`. Empty populations have
sum zero, null extrema and null mean. Histograms sort by increasing curvature.
Grouped summaries use source level, target level, dependency type, necessity and
ontological role as separate channels. Missing attributes have an explicit
`present: false` group, distinct from a declared null value. Extrema list all
tied edge IDs in canonical order, without a hidden top-k cutoff.

The closed request selects the two policy IDs and has no tunable parameters.
Artifacts include the complete policies and their hashes, exact model binding,
projection hash, algorithm ID/version, empty `parameters` and its hash, result,
and `artifactHash`. Hash domains are `onto2d:structural-geometry-parameters:v1`
and `onto2d:structural-geometry-artifact:v1`. Timestamps, execution environment
and wall time are excluded. Transport shape checks never replace source replay.

## Mathematical limits of the baseline

Unit curvature is exactly determined by the ordered endpoint degree pair. It
cannot add information beyond a baseline containing those same degrees. A
positive later result must identify information added by a different metric,
algorithm or representation, and compare it against an adequate degree baseline.

Reversing every edge preserves the curvature of its corresponding reversed
edge: indegree and outdegree exchange together. Node incoming/outgoing sums
exchange and balance changes sign. Reversing a path is also an isomorphism;
it cannot be required to have a distinct curvature distribution. A feed-forward
triangle and a directed cycle do provide a useful same-undirected-graph control.
These are consequences of the declared equation, not universal properties of
all directed curvature definitions.
