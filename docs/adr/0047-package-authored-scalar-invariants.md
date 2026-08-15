# ADR-0047: Package-authored scalar invariant values

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

ADR-0046 made `number`, `string`, `boolean`, and `null` invariant symbols
executable through the direct local-predicate API, but schema-v1 packages could
still author only `Quantity` values in `PrimitiveDefinition.invariants`.
Consequently, the package loader, materialized primitive `Element` records,
package filtering, finite functionals, and cohort keys could not exercise the
same typed invariant contract end to end.

Scalar element data is distinct from `Profile.invariantVector`. The latter is
the scientific, quantized coordinate contract used by profile identity and
derived-profile construction and remains Quantity-valued. Extending element
data must not silently redefine profile derivation or introduce averaging of
non-identical values.

## Decision

Schema-v1 `PrimitiveDefinition.invariants` and `Element.invariants` admit one
`InvariantValue = Quantity | number | string | boolean | null` per normalized
invariant name.

- Numeric values must be finite and normalize negative zero to zero.
- String values retain their exact content and are limited to 1,024 UTF-16 code
  units, matching the typed-expression ceiling.
- Boolean and null values retain their exact JSON representation.
- Quantity values keep the existing SI normalization, tolerance, semantic,
  provenance, and evidence rules.
- Arrays and other composite values are rejected. Package validation reports
  stable scalar-value issues before identity construction.
- Every declaration with the same invariant name must have the same runtime
  kind. Quantity declarations additionally require the same dimensions and
  semantic label. Number and dimensionless Quantity remain different kinds.
- Primitive identity includes the normalized scalar value. Quantity identity
  continues to exclude evidence provenance, while the complete normalized
  package still includes it.

One internal invariant normalizer supplies package loading, expression-symbol
construction, runtime kind checks, and identity projection. Materialized
primitive elements therefore carry the normalized values without an adapter-
specific representation.

The existing package runtimes consume the extended values as follows:

- `package-candidate-filter-evaluator-v14` supplies package-authored values to
  `local-predicate-evaluator-v13`; exact and identical-profile scalar
  comparisons use the ADR-0046 witnesses and candidate-local indeterminacy.
- `package-functional-evaluator-v1` admits numeric scalar invariants into exact
  number arithmetic. String, Boolean, and null values remain non-numeric and
  therefore cannot become functional scores unless used by a future typed
  functional form. Runtime witnesses retain `valueKind` and `value`.
- `package-cohort-partitioner-v1` admits all scalar kinds as exact
  `shared-support` or ordered `profile-role` atoms. `invariant-window` remains
  numeric/Quantity-only by its analyzed rule contract.
- Profile-quotient resolution validates every member against the reproduced
  descriptor before testing canonical equality. It binds
  `identical-normalized-scalar-v1` for scalars and never substitutes the
  representative element.

`Profile.invariantVector` remains Quantity-valued, so derived elements may
continue to expose only Quantity invariants until a separate formation-
dependent scalar derivation contract exists. Non-identical profile
aggregation is not introduced.

The package, functional, cohort, and filter identity domains do not change.
This is an additive accepted-input extension: every package accepted before
this decision retains identical normalized bytes and runtime artifacts, while
new scalar packages previously failed before receiving a package identity.
Their normalized scalar values and typed witnesses are already included in the
existing hashed bases.

## Consequences

- package-authored scalar values now have one validated path from source
  package through primitive identity and materialized elements to filtering,
  numeric functional evaluation, and cohort partitioning;
- scalar/Quantity kind conflicts cannot be hidden by dimensional equivalence;
- candidate-local missing or non-consensus scalar data remains explicit and
  countable;
- profile-coordinate semantics and derived-profile construction remain
  unchanged;
- non-identical profile aggregation, formation-dependent scalar derivation,
  and general Quantity products inside local predicates remain separate future
  decisions.

## Verification

Fixtures cover all four scalar kinds, negative-zero normalization, package and
primitive identity invariance under source/key ordering, cross-primitive kind
conflicts, string and composite-value rejection, exact and profile-consensus
filtering, profile disagreement as `filter-indeterminate`, numeric scalar
functional arithmetic, scalar profile-role cohort tuples, runtime witness
shape, schema export/compilation, and primitive/element/functional/cohort JSON
Schema conformance.
