# ADR 0133: exact canonical structural observations

- Status: Accepted
- Date: 2026-09-06
- Scope: SG2-011 / R3 exact untyped observation

## Context

The [SG2-010 contracts](../structural-geometry/REGIME_CONTRACTS.md) prepare
source scopes but explicitly do not measure observations. Probes and response
signatures depend on implemented regime observations and their acceptance
controls. Exact adjacency must be distinguished from lossy summary equality.

## Decision

Implement `/canonical` inside the existing structural-geometry package. Translate
verified scoped source graphs faithfully to the existing candidate canonicalizer
using uniform node references and edge roles, preserved direction, no attributes
and explicit disconnected support. Retain the frozen regime and work bounds.

Return a measured artifact with the exact unchanged preparation, a source-free
canonical adjacency value qualified by content-bound contracts, a complete
mapping witness and separate source-bound artifact identity. Verification must
replay from the expected source and request. A witness chooses one isomorphism;
it does not compute canonical orbits or justify invariant probe targets.

Add two closed schemas, readonly types and an opt-in engine analysis. Route the
existing kernel graph operations through a narrow browser-compatible export to
avoid the Node-only Oracle validator. This adds no kernel operation and changes
neither its implementation nor its existing API behavior.

Independently enumerate all directed graphs on one through four nodes and all
node permutations within each graph. Check both directions of the class mapping,
not identical numbering conventions. Verify all 720 relabelings of a six-node
control and independently reconstruct all 17 public observation witnesses.

The [contract](../structural-geometry/CANONICAL_OBSERVATIONS.md) and
[review](../structural-geometry/CANONICAL_OBSERVATION_REVIEW.md) specify the
implementation and acceptance evidence.

## Consequences

SG2-011 completes the first measured regime observation. SG2-012 topology
summaries are next; typed observations and executable comparison/coverage are
still required before closing R3. Probes and response signatures remain R4/R5.
Large source graphs require explicit bounded fragments, and all errors stay
explicit. Existing preparations, numerical geometry, Model Packs and kernel
canonical identities retain their bytes and contracts.
