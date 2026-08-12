# ADR-0070: Typed profile partner guards

- Status: accepted
- Date: 2026-08-12

## Context

Profiles have always allowed an optional slot guard, but the v1 field was
generic JSON and the residual extractor could only return
`profile-slot-guard-unsupported`. A guard affects whether a constituent slot
may be consumed by a concrete partner, so choosing a profile representative or
silently treating unknown data as false would change the closure universe.

The contract must also preserve old content-hash expression references. Their
external semantics are unavailable to the dependency-free kernel and cannot
be guessed.

## Decision

`ProfileSlot.guard` is closed to either a legacy content hash or a typed
`profile-slot-partner-guard-v1` expression. The executable expression language
has bounded depth, node count, and logical arity and contains:

- order-independent `all` and `any` plus three-valued `not`;
- `partnerTypeTag` over the partner element's complete type-tag set;
- `partnerInvariant` with `eq`/`ne` for every scalar invariant and the full
  comparator set for exact numbers and normalized Quantities.

Unknown fields, missing fields, duplicate logical arguments, invalid values,
and nonnumeric ordering comparisons fail package load. Logical arguments are
canonicalized independently of authored order. Quantity comparisons reuse the
kernel's dimensional, semantic, and maximum-declared-tolerance policy.

Residual extraction evaluates a guarded endpoint against every element in the
partner's verified profile class, not only its disclosed representative.
Every member retains a complete path/check transcript. The aggregate result is:

- `pass` only when every member passes;
- `fail` only when every member fails;
- `indeterminate` on missing/incompatible data or mixed class-member outcomes.

Slot preference remains exact polarity, then symmetric polarity, then
normalized slot index. A higher-preference indeterminate guard blocks choosing
a lower-preference slot because its eventual resolution could change the
allocation. A failed guard may be skipped in favor of the next compatible
slot. If every compatible guard fails, extraction emits
`profile-slot-guard-unsatisfied`; unresolved typed guards emit
`profile-slot-guard-indeterminate`. Legacy hash refs remain accepted but emit
`profile-slot-guard-unsupported`.

Each decision is content-addressed in
`onto2d:profile-slot-guard-evaluation:v1`, retained in the derived-profile
result, and referenced by the endpoint consumption witness. Guard failure or
indeterminacy emits no profile or partial derived population.

## Consequences

- partner compatibility is now executable without ambient callbacks;
- profile quotient execution cannot substitute one representative when class
  members differ on a guard dependency;
- missing partner data remains distinct from a definite false guard;
- legacy external expression hashes retain their honest fail-closed behavior;
- this decision itself executes at the post-admission profile boundary and does
  not retroactively prune the candidate universe. ADR-0076 later reuses the
  same typed evaluator in an explicit opt-in complete-candidate generation
  gate. ADR-0084 later supplies the separate complete-extension audit required
  by partial-frontier pruning.

## Verification

Conformance covers logical normalization and package identity, invalid
comparators, type-tag pass/fail, missing invariant data, legacy hash refs,
guard/evaluation hashes, endpoint lineage, all-or-nothing materialization,
profile-class member disagreement without representative substitution,
published schemas, exact replay, and local Node.js 20/22 execution.
