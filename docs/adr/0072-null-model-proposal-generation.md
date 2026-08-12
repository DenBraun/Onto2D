# ADR-0072: Deterministic null-model proposal generation

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0071 freezes the exact candidate carrier, ontology gate, model contracts,
and independent stream identities, but deliberately does not transform any
candidate. The three architecture models require different finite sampling
frames. Their population size, replacement policy, mixing work, invalid-swap
behavior, carrier membership, and resource limits must be explicit before
trial evaluation can consume their output.

## Decision

`package-null-model-proposals-v1` exactly replays a verified primitive or
depth-aware plan and complete census. Every planned trial emits exactly one
proposal occurrence for each canonically ordered carrier candidate. An
occurrence retains its source ordinal and source candidate ID even when the
proposed canonical candidate duplicates another occurrence.

All random integer choices use SHA-256 counter expansion in a separate draw
domain with exact rejection sampling. A draw is addressed by the already
independent trial stream plus an operation-specific coordinate, so execution
order and worker scheduling do not affect the result.

The model contracts are:

- `role-shuffle`: candidate-wise Fisher-Yates permutation of the edge-role
  multiset. Nodes, skeleton, direction, edge attributes, and carrier membership
  are retained.
- `degree-rewire`: select uniformly from same-role edge-index pairs and swap
  their directed targets. This preserves each indexed node's role-wise in/out
  degree. Each candidate receives ten attempts per edge when any pair exists.
  Self-loop, parallel-edge, connectivity, canonicalization, or complete-
  carrier membership violations reject that attempt and retain the prior
  candidate. Attempted, accepted, and rejected swaps, acceptance ratio, and
  `mixed`/`unmixed`/`not-applicable` status are retained.
- `uniform`: make one independent exact uniform carrier-index draw with
  replacement for each source occurrence. The trial population therefore has
  carrier size without pretending duplicate draws are distinct canonical
  candidates.

Every emitted candidate is canonicalized under the bound RunConfig graph
policy and limits and must belong to the verified complete carrier. This
membership rule is necessary because subsequent package filtering proves
candidate-universe membership before evaluating predicates.

Proposal occurrence count and random-selection work are preflighted with
caller-lowerable hard limits of one million. Individual rejection sampling has
a fixed 1,024-digest bound. A disabled plan produces an immutable `not-run`
artifact. An enabled artifact reports proposal completion and explicitly states
that trial evaluation and distributions remain pending; it is not a completed
baseline.

## Consequences

- all three declared model transformations are executable without ambient
  randomness;
- degree rewiring cannot leave the exact universe that downstream filters know
  how to verify;
- duplicate uniform draws remain observable occurrences rather than being
  silently deduplicated;
- mixing failures are data, not retries hidden from the artifact;
- the remaining null-model gate is full per-occurrence predicate evaluation,
  trial-local cohort/functional/selector reconstruction, sample artifacts,
  distributions, and interpretation.

## Verification

Conformance covers role-multiset and skeleton preservation, role-wise directed
degree preservation, carrier membership for every model, exact uniform frame
disclosure with replacement, swap-count reconciliation and mixing status,
seed/order determinism inherited from the plan, primitive and depth-aware
execution, disabled state, hard occurrence limits, tampering, kernel facade
methods, public types, compiled JSON Schema, and local Node.js 20/22 execution.
