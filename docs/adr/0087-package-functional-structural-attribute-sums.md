# ADR-0087: Package-functional structural-attribute sums

- Status: accepted
- Date: 2026-08-12

## Context

The value-expression analyzer and package loader accepted typed
`sum(attribute, set)` expressions for functionals and cohort keys, and local
predicate evaluation already executed scalar and Quantity structural sums.
The shared post-filter package value runtime nevertheless stopped at
`PACKAGE_FUNCTIONAL_ATTRIBUTE_SUM_UNSUPPORTED`. This made a normalized package
valid at load time but unable to reproduce its own functional or cohort
analysis, and prevented formation-derived profile invariants from consuming
package-generated attributes.

## Decision

The verified package value runtime executes structural `sum` expressions over
the canonical node, edge, or directed-cycle selection returned by the existing
set-selector contract.

For numeric scalar attributes, values accumulate in canonical selection order
under the RunConfig summation policy. `exact-decimal` is exact;
`compensated-binary64` remains explicitly approximate. Missing, non-finite, or
wrongly typed selected values are hard replay errors because a verified binding
must already have fixed the candidate attribute alphabet.

For Quantity attributes, every selected value is normalized and must match the
analyzed canonical unit and semantic. Values use the run summation policy,
effective absolute tolerance bounds add exactly, and evidence IDs form a
canonical union. The selection witness records attribute, value kind,
summation algorithm, exactness, unit, semantic, and
`sum-effective-absolute-bounds-v1` tolerance aggregation.

The same runtime serves package functionals and evaluated cohort-key
expressions. Formation-derived profile functionals can therefore materialize
verified invariants from candidate structural sums at primitive, generalized-
depth, and current-level closure boundaries.

`package-functional-evaluator-v1` remains the artifact label because the
published expression and selection-witness schemas already included this
operation and its exact output shape; this decision closes a fail-closed
execution branch without changing artifact layout or existing evaluations.

This decision does not feed new attributes back into the same formation being
scored. ADR-0088 subsequently freezes an acyclic later-depth carry-forward
contract through derived profile and `Element` invariants.

## Consequences

- loader acceptance, deterministic replay, functional scoring, and cohort-key
  execution now agree for structural sums;
- package-generated scalar, Quantity, and role-dependent edge values can feed
  downstream functionals without caller-supplied candidates;
- derived profile invariants can preserve the complete sum witness and
  uncertainty/evidence lineage;
- invalid runtime drift remains a hard error rather than an indeterminate
  scientific result;
- same-candidate formation-functional decoration remains forbidden; the
  later-depth carry-forward path is closed by ADR-0088.

## Verification

Conformance covers exact scalar sums, SI-normalized Quantity sums, canonical
selection witnesses, tolerance and evidence propagation, cohort-key execution,
formation-derived profile invariants that continue into target-depth-2 source
populations, runtime JSON Schema validation, capability publication, and full
repository regression execution.

`POST-CLOSURE-VIS-01` remains scheduled only after the full kernel closure
gate.
