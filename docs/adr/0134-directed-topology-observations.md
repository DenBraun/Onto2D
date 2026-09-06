# ADR 0134: bounded directed topology observations

- Status: Accepted
- Date: 2026-09-06
- Scope: SG2-012 / R3 directed topology summary

## Context

SG2-010 froze seven topology specs and their lossy matching policy. SG2-011
implemented exact canonical structure. The next R3 evaluator must respect the
existing profile rather than silently expand it to eliminate known collisions.
Probes and comparison results still have separate acceptance tasks.

## Decision

Add `/topology` to the existing structural-geometry package. Verify the full
source before preparing an explicit bounded scope. Measure its seven summaries
using directed BFS, mutual reachability and undirected component traversal.
Keep isolates, numeric component sorting and nonself ordered-pair semantics.

Preserve the preparation and every existing regime/spec identity. Put measured
values in a new source-bound artifact, with a separate content-qualified value
hash. Source-ID memberships and traversal counts are diagnostics excluded from
observation coordinates. Enforce the frozen 64-node/256-edge/4,096-visit and
serialization limits. Add closed schemas, readonly types, browser support and
an opt-in engine analysis. Expected-source replay validates the full envelope.

Verify independently using Boolean matrix closure for every small directed
graph and 23 frozen controls. Record profile collisions against independently
enumerated isomorphism classes; run the public canonical evaluator on the star
collision. Include explicit worst-case work and Causal Emergence fragments.
See the [contract](../structural-geometry/TOPOLOGY_OBSERVATIONS.md) and
[review](../structural-geometry/TOPOLOGY_OBSERVATION_REVIEW.md).

## Consequences

SG2-012 completes a second measured regime observation. All seven summaries
are invariant under reversing every edge, so they cannot resolve global
orientation. Their equality cannot establish graph isomorphism or domain
equivalence. This limitation is accepted and disclosed without changing the
frozen profile. SG2-013 typed observations and SG2-014/015 comparison/coverage
remain required for R3. Probes, signatures and the site remain later gates.
