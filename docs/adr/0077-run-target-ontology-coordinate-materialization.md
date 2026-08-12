# ADR-0077: Run-target ontology-coordinate materialization

- Status: accepted
- Date: 2026-08-12

## Context

`RunConfig.ontologyTarget` was already normalized, content-addressed, and used
by the null-model ontology gate, but successful formation materialization did
not copy it into derived `Element` or level artifacts. When the default
identity policy made ontology coordinates structural, derived identity instead
bound a permanent `null`. The result lost an explicitly declared run axis and
could not distinguish two structurally identical formations intentionally
targeted at different ontology coordinates.

Derivation depth and ontology level are independent axes. The kernel therefore
must preserve the declared target without inferring it from `targetDepth`, a
profile boundary, or observed results.

## Decision

Primitive, generalized-depth, and bounded current-level materialization use one
`normalized-run-ontology-target-or-absent-v1` axis policy:

- absent `ontologyTarget` emits no `ontologyCoordinate` and records only
  computed derivation-depth provenance;
- a present normalized target is copied exactly to the level and every derived
  element;
- ontology-level provenance is `declared`; ontology-phase provenance is also
  `declared` when a phase is present; no provenance value is invented for an
  absent phase or for `segment`;
- target depth never supplies or rewrites an ontology level.

`package-derived-depth-population-v2` binds the exact normalized target, or
`null` when absent, into derived element identity only when
`identityPolicy.ontologyCoordinateStructural` is true. The coordinate remains
visible but non-structural when that flag is false. Formation, run, evidence,
and derivation hashes still do not enter the element identity basis.

Ordinary, arbitrary-depth, and bounded current-level closure artifacts now
carry the same `axisProvenance` and optional `ontologyCoordinate`; their
existing exact-replay verifiers cover those fields.

## Consequences

- an explicitly declared ontology target is no longer discarded between run
  configuration and result materialization;
- derivation depth and ontology coordinate remain separate and auditable;
- the existing identity-policy switch continues to control whether ontology
  coordinates split otherwise equal structural element identities;
- runs without an ontology target preserve the prior absence of a coordinate,
  although the upgraded materializer and explicit level-axis provenance change
  artifact hashes;
- dynamic formation-dependent type classification and package-driven candidate
  structural attributes remain separate contracts; ADR-0079 subsequently
  closes the former for verified Quantity-threshold rules.

## Verification

Conformance covers target presence and absence, level/phase/segment fidelity,
axis provenance, structural versus non-structural identity behavior, primitive,
generalized-depth and bounded current-level propagation, closure exact replay,
public TypeScript declarations, compiled JSON Schema, runtime artifact schema
validation, and local Node.js 20/22 execution.
