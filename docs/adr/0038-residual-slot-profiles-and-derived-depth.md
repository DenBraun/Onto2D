# ADR-0038: Residual-slot profiles and derived-depth materialization

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0037 freezes selected formation provenance but intentionally cannot create
a structural profile or `Element`. A generic empty profile would erase the
future compositional interface, while accepting a caller-produced profile
would move an identity-bearing scientific decision outside the hashed package.
The architecture instead defines a profile as the remaining role slots,
capacities, guards, and normalized invariant vector exposed to the next
composition.

The current generator does not evaluate profile guards during decoration.
Derived profile execution must therefore be deterministic for the supported
capacity subset and fail closed when a selected internal edge would require an
unexecuted guard.

## Decision

Schema-v1 adds the optional `profileDefinition.kind = "residual-slots-v1"`
policy. The existing default remains `explicit-only`.

- A residual-slot definition carries a normalized `baseProfile`, canonical
  derived type tags, and claim references. The base profile supplies frozen
  package-authored external slots and invariant coordinates; it is hashed in
  the package/rules identity.
- For every selected formation, internal candidate edges are processed in
  canonical edge order. The source endpoint consumes one matching `out` slot
  and the target consumes one matching `in` slot. A `sym` slot may satisfy
  either polarity. Exact polarity precedes `sym`, then normalized source slot
  index breaks allocation ties.
- One edge endpoint consumes one capacity unit. Residual minimum capacity is
  `max(0, min - used)`; finite maximum is `max - used`; unbounded maximum
  remains `null`. Slots with zero finite maximum disappear. The output profile
  is the canonical multiset union of base slots and every constituent residual
  slot, with the base invariant vector and precision policy.
- A matching guarded slot cannot be consumed until guard evaluation is
  executable. Such use yields `profile-slot-guard-unsupported`. Missing
  compatible capacity yields `profile-slot-capacity-unavailable`. An
  `explicit-only` package yields `derived-profile-policy-unavailable`.
  These are hashed indeterminate results, never empty profiles.
- `package-derived-profile-extractor-v1` reproduces package, census,
  admission, and selected formations. Each result is hashed in
  `onto2d:derived-profile-extraction:v1`; the complete result is hashed in
  `onto2d:package-derived-profiles:v1`. Any indeterminate selected profile
  makes the set indeterminate without dropping its formation.

`package-derived-depth-population-v2` then reproduces that whole chain and,
under ADR-0077, materializes any normalized run-target ontology coordinate.

- It emits no elements when the profile set is indeterminate, preventing a
  partial closure depth. An empty selected set remains an explicit empty depth.
- A derived element's structural identity contains canonical candidate graph
  content, identity-policy-selected type tags/invariants/profile, and no
  derivation or evidence provenance. Quantity-valued structural attributes use
  normalized value, unit, tolerance, and semantic meaning while excluding
  evidence provenance, resolving the earlier candidate/element identity
  asymmetry at this boundary.
- Formation provenance records canonical constituents and constituent
  profiles, skeleton, directed role assignment, source candidate, depth,
  depth basis, and evidence. `admittedBy`, `selectedBy`, and claim references
  are non-structural element fields.
- Equal element IDs are reconciled deterministically. The lexicographically
  smallest formation hash supplies the primary immutable element record; every
  derivation remains in a canonical external derivation index with its own
  admission/selection/claim provenance.
- The complete population, prerequisite hashes, identity policy, elements,
  derivation index, counts, and interpretation are hashed in the shared
  `onto2d:depth-population:v1` domain. Stored results require exact replay.

## Consequences

- packages can now opt into a deterministic, falsifiable profile-extraction
  hypothesis without changing the safe `explicit-only` default;
- capacity and polarity affect the next compositional interface explicitly;
- unsupported guards and insufficient capacity stop depth materialization
  rather than leaking a partial population;
- derived structural identity is separated from evidence and derivation
  history, while alternate paths remain inspectable;
- generalized multi-depth source binding and explicit level/ladder state
  machines are subsequently implemented by ADR-0040 and ADR-0041; profile-
  collapse comparison and carrier promotion remain later boundaries, now
  implemented by [ADR-0042](0042-profile-collapse-and-level-boundaries.md) and
  [ADR-0043](0043-explicit-carrier-promotion.md).

## Verification

Local conformance covers package-policy normalization, directed `out`/`in`
consumption, exact-polarity allocation, base/residual composition, finite
capacity subtraction, missing capacity, guarded consumption, explicit-only
fail-closed behavior, profile/result/set hashes, derived `Element` canonical
identity and provenance, no partial population under indeterminacy, depth and
count reconciliation, derivation indexing, strict schemas, exact replay,
tampering, TypeScript declarations, and public API exposure. Independent
implementation comparison and cross-platform evidence remain acceptance
requirements.
