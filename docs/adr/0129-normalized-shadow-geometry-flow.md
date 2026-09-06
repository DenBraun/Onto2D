# ADR 0129: Normalized shadow geometry flow

- Status: Accepted for bounded computational analysis; scientific validation open
- Date: 2026-09-06

## Decision

Implement [stage-five flow](../structural-geometry/SHADOW_FLOW.md) over a separate
positive rational length state bound to a verified source graph. Evolve every
scoped edge simultaneously using directed in/out Ollivier transport. Metric-close
and normalize initial and updated lengths to mean one. Retain source weights as
provenance. Default to half step and half idleness; declare the paper fixture's
full step and zero idleness explicitly.

Reuse the external Python transport algorithm with rational costs and exact
primal/dual certificates. Keep process execution in an explicit Node subpath.
Make portable verification reconstruct every state, stopping decision and final
cut from the independently supplied source and input. Preserve a deterministic
hash chain with no timestamps, mutable source edits or implicit sampling.

Distinguish exact fixed points, cycles, consecutive length-and-curvature tolerance,
iteration limits and proposed zero lengths. Optional strict final-length cuts
produce component membership only; no surgery feeds back into this profile.

## Evidence and consequences

The published `G(3,2)` example matches Appendix E's analytical recurrence at all
17 states and recovers its three four-node groups after a final threshold cut.
Independent NetworkX transport, weighted paths and update reconstruction agree
on 11 runs / 68 states / 1089 edge calculations. These are computational gates,
not independent scientific review or evidence for arbitrary directed convergence.

The reference is limited to 64 nodes, 64 edges and at most 24 transformations,
with explicit transport-history and exact-number limits. It may reject a long
run because reduced rational values exceed the digit bound. Full-model flow,
iterative surgery and scalable approximate solvers require later policies.
The original follow-up was directed persistence. Its scheduling is superseded
by [ADR 0130](0130-distinguishability-research-program.md); this flow contract and
its completed computational acceptance remain unchanged.
