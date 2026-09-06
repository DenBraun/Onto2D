# ADR 0126: Read-only structural geometry foundation

- Status: Accepted for the initial computational contract; scientific validation open
- Date: 2026-09-05

## Context

The [supplied roadmap](../structural-geometry/proposals/ONTO2D_STRUCTURAL_GEOMETRY_ROADMAP.md)
proposes typed projections, discrete geometry, flow, topology and comparative
signatures. Model Pack v1 already provides complete deterministic source
identity. Its Causal Emergence edges are `source-parent`, including known source
findings, and must retain that interpretation.

## Decision

Document [representation](../structural-geometry/REPRESENTATION_POLICIES.md),
[metric](../structural-geometry/METRIC_POLICIES.md) and
[claim](../structural-geometry/CLAIM_BOUNDARIES.md) contracts before runtime
implementation. Add `@onto2d/structural-geometry` above Model Pack and engine,
with a closed full-model `source-parent-directed-v1` policy and `unit-v1`
metric. The package exposes immutable projections, exact source replay and an
opt-in analysis. It does not modify the schema-v1 kernel, Model Pack format,
source records, view layouts or the default engine analysis registry.

Use directed non-augmented Forman equation (5), with incoming edges at the
source and outgoing edges at the target. Explicitly reject loops, parallel
edges and foreign relation layers. Preserve typed channels without converting
them to metric coefficients. Bind complete policies, algorithm version,
parameters, source root and exact manifest in deterministic artifacts.

## Corrections to the proposal

Use `source-parent-directed-v1` instead of asserting reviewed causality through
the provisional policy name. Exact artifact identity includes source IDs;
ID relabeling is numerical equivariance, not equal hashes. Unit Forman is
endpoint-degree-derived, and global edge reversal preserves edge curvature.
The initial benchmark therefore checks those properties rather than claiming
that this baseline beats degree information or always detects reversal.

## Acceptance and consequences

Stages 0–2 end with closed schemas, synthetic goldens, separate Python incidence
checks, an exact Causal Emergence artifact, engine integration and repository
validation. These establish computational behavior only. Independent review,
new metrics, flow, directed topology, higher-order semantics and comparative
scientific benchmarks retain separate gates in the
[adopted roadmap](../structural-geometry/README.md).
