# ADR 0128: Certified directed Ollivier reference

- Status: Accepted for bounded computational analysis; scientific validation open
- Date: 2026-09-06

## Decision

Implement stage 4 through the existing scientific adapter interface with a
dedicated [Ollivier transport contract](../structural-geometry/OLLIVIER_CURVATURE.md).
Keep optimization in a bounded external Python standard-library reference.
JavaScript prepares requests and checks exact primal/dual certificates.

Use unit directed shortest paths, uniform predecessors of the source and uniform
successors of the target. Default to zero idleness with an explicit half-idleness
sensitivity setting. Empty neighborhoods retain mass at their endpoint. Required
support paths exist through the analyzed edge; disconnected unrelated components
need no metric repair. Source weights remain provenance only.

Verify the complete source before accepting explicit bounded induced scopes.
Expose scope boundary counts, source record traces and exact model/root/manifest
identity. Cache verified artifacts in a bounded in-memory LRU keyed by the full
request identity. Keep Node process execution in a separate package subpath.

## Consequences

Integral costs and rational marginals permit exact optimization certificates,
so there is no floating-point tolerance or approximate Sinkhorn default. A
different valid certificate may prove the same optimal value; deterministic
reference replay fixes the repository artifact bytes.

NetworkX 3.2.1 independently reconstructs graph distances and probabilities and
solves the fixed fixtures with network simplex. This computational agreement
completes the stage-four reference gate. It does not establish scientific validity
of source semantics, practical superiority or full-model scalability. Weighted
geometry and normalized shadow flow require separate contracts and benchmarks.
