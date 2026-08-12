# ADR-0093: Functional coefficient-role and sensitivity closure

- Status: accepted
- Date: 2026-08-12

## Context

The architecture requires every free or fitted functional coefficient to
participate in the precommitted selector sensitivity sweep. The executable
sensitivity engine was complete, but schema v1 exposed only
`coefficients` and `sensitivityCoefficients`. The loader could reject an
unknown sensitivity name but could not prove that the list covered every
coefficient whose scientific role required perturbation.

## Decision

`Functional` accepts an optional closed `coefficientRoles` record with one of
`fixed`, `free`, or `fitted` for each declared coefficient.

When the record is explicit, the loader requires:

- exactly one valid role for every declared coefficient;
- no role for an undeclared coefficient;
- `sensitivityCoefficients` to equal exactly the set of all `free` and
  `fitted` coefficients.

For backward-compatible schema-v1 inputs that omit `coefficientRoles`, the
package syntax itself supplies the declaration: each named sensitivity
coefficient normalizes to `free`, and every other coefficient normalizes to
`fixed`. Thus omission no longer means an unknown role. All normalized
functionals carry the complete sorted role record, and the rules/package/run
hash chain binds it.

The kernel does not infer whether an author's scientific role assertion is
true; that remains reviewable package content, like coefficient provenance.
It does prove that the executable sweep is complete for the asserted roles.

## Consequences

- A fitted/free coefficient can no longer be silently omitted from the
  executable sensitivity denominator when roles are explicit.
- Existing packages retain valid input syntax and receive deterministic role
  normalization.
- Changing a role changes the rules and all downstream semantic identities.
- Empty sensitivity remains valid only when every normalized coefficient role
  is fixed or the functional has no coefficients.

## Verification

Fixtures cover explicit fixed/free/fitted normalization, input-order
invariance, legacy inference, missing-role and unknown-role rejection, and
missing/unexpected sensitivity coverage. Existing complete OAT/Cartesian,
budget, replay, and schema suites remain the downstream acceptance gate.
