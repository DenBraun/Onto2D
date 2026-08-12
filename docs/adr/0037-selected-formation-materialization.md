# ADR-0037: Selected formation materialization before derived profiles

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0036 deterministically identifies every selected candidate, but a selected
candidate ID is not yet a reproducible formation record. The verified local
filter already contains the canonical graph, target depth, depth basis, source
population, and exact or profile-representative constituent resolution needed
by later provenance. Reconstructing those fields ad hoc after admission would
permit stale candidates, a different profile representative, omitted predicate
claims, or a selector witness from another execution.

Materializing a derived `Element` at the same boundary would still be unsafe.
At this decision boundary schema-v1 accepted only
`profileDefinition.kind = "explicit-only"`; it did not define deterministic
external-slot consumption, invariant extraction, derived attributes, or a
derived-profile identity. Because the default identity policy makes the
profile structural, inventing an empty or caller-supplied profile would also
invent the derived element ID. ADR-0038 subsequently adds the separate,
explicit `residual-slots-v1` policy without changing this formation contract.

## Decision

`package-selected-formations-v1` consumes a reproduced complete census and a
reproduced `package-selector-admission-v1` artifact.

- The materializer uses only decisions whose exact outcome is `selected`.
  Predicate-rejected, filter-indeterminate, selector-excluded, and selection-
  indeterminate candidates never become formation records.
- Every formation preserves the canonical candidate, target depth, depth
  basis, source-population hash, filter hash, and complete constituent
  resolution from the verified filter artifact. In `profile-quotient` mode the
  lexicographic representative and the complete profile-class membership both
  remain explicit.
- `admittedBy` is the canonical set of every passed top-level predicate.
  `selectedBy` is the canonical set of every selector that selected the
  candidate. Per-selector witnesses bind cohort, functional evaluation,
  ranking, and sensitivity hashes.
- Claim lineage is the canonical union of passed-predicate, selected-selector,
  and selector-functional claims. Evidence is the canonical union referenced
  by those claims. These fields are reproduced from the loaded package rather
  than accepted from the caller.
- Candidate order is canonical candidate-ID order. There is exactly one
  formation per definitely selected candidate, so `selectedFormations` must
  equal the admission's `selectedCandidates`. The complete admission counts
  remain embedded; this artifact does not replace the candidate-domain
  denominator with a later element count.
- Each formation is hashed in `onto2d:selected-formation:v1`; the full set,
  policy, prerequisite hashes, counts, and interpretation are hashed in
  `onto2d:package-selected-formations:v1`. Stored artifacts require exact
  deterministic replay.
- The artifact's materialization disposition explicitly defers profile and
  derived-element identity. It emits no `Profile`, `Element`, alternate-
  derivation index, or depth population.

## Consequences

- selected graph/provenance input can no longer drift between admission and
  profile extraction;
- candidate-domain selection counts remain distinct from future structural
  element reconciliation;
- profile-quotient representative choice stays auditable instead of becoming
  hidden structural identity;
- D5 can add deterministic profile extraction and element reconciliation as a
  separate versioned boundary without changing the meaning of admission;
- level closure remains unavailable until that next boundary exists.

## Verification

Local conformance covers profile-quotient representative/class preservation,
element-exact identity admission, canonical ordering, complete predicate/
functional/selector claim and evidence lineage, count reconciliation, both
hash domains, exact replay, tampering, stale admission, closed options, strict
JSON Schema, TypeScript declarations, and configured public API exposure.
Independent implementation comparison and cross-platform evidence remain
acceptance requirements.
