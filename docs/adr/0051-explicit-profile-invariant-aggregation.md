# ADR-0051: Explicit profile-invariant aggregation

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0028 and ADR-0046 permit a profile-class invariant to resolve only when
every class member supplies one identical normalized value. That fail-closed
default prevents an arbitrary representative from standing in for a quotient
class, but it also leaves scientifically intended numeric summaries
unexecutable. A generic or implicit `mean` would be insufficient: the runtime
must bind its type domain, decimal boundary, unit and semantic compatibility,
uncertainty propagation, provenance, missing-data behavior, and witness.

## Decision

An invariant `ValueExpression` may opt in with:

```json
{
  "kind": "invariant",
  "name": "length",
  "profileAggregation": "arithmetic-mean-conservative-v1"
}
```

Omitting `profileAggregation` preserves strict identical normalized consensus.
The policy is valid only for declared `number` and `Quantity` invariant types.
String, Boolean, and null invariants remain consensus-only. In an
`element-exact` candidate the expression resolves the selected element
unchanged; aggregation applies only to a complete `profile-quotient` class.

Every profile member MUST provide the invariant. Missing values remain a
candidate-local `indeterminate` result. Every supplied value MUST match the
reproduced symbol descriptor. Quantity members MUST already share the
descriptor's canonical unit and semantic label; type, unit, or semantic drift
is a hard error. The policy never drops a member, substitutes a representative,
or coerces a nonnumeric scalar.

Member IDs are processed in canonical sorted order. Point values are summed by
`exact-decimal` arithmetic and divided by the member count under the bound
run's invariant precision (`decimalPlaces` and `rounding`). The witness records
the complete precision policy, member count, exact summation method, rounded
mean as a `DecimalValue`, and whether the division was exact. Predicate numeric
bindings inventory this as `profile-invariant-arithmetic-mean` with
`arithmetic` and `precision` policy references.

For a Quantity member `i`, let `b_i` be its effective absolute bound, the
maximum of its declared absolute tolerance and `relative * abs(value)`. The
aggregate point is the arithmetic mean. Its conservative absolute tolerance is
the sum of:

```text
outward(sum(b_i) / n)
+ one decimal quantum when point division is inexact
+ decimal-to-reported-number conversion displacement
```

The first division is rounded upward at the decimal runtime's maximum supported
256 places. This makes no independence or cancellation assumption. Evidence is
the canonical sorted union of all member evidence. The resulting Quantity uses
computed provenance method `profile-invariant-arithmetic-mean-v1`; its witness
uses uncertainty policy `mean-effective-bounds-plus-rounding-v1` and records
the effective decimal bound and evidence union.

The same shared aggregation runtime is used by local predicate evaluation,
package functionals, and cohort-key construction. Exact/profile basis,
consensus/aggregation policy, aggregate diagnostic, and result value are all
retained in published witnesses. The changed local artifacts use
`local-predicate-evaluator-v17`,
`onto2d:predicate-local-evaluation:v17`,
`package-candidate-filter-evaluator-v18`, and
`onto2d:package-candidate-filter:v18`.

## Consequences

Non-identical numeric profile invariants are executable only when package
authors make the aggregation semantics part of the hashed expression. The
result changes reproducibly with class membership, member values, evidence,
or run precision. Strict consensus remains backward-compatible and is still
the only policy for nonnumeric scalars.

Arithmetic means are not claimed to be universally meaningful. Packages must
choose this policy only where the invariant's scientific semantics support it.
Formation-dependent derivation, profile guards, other aggregation operators,
and distributional or correlated uncertainty models remain separate future
contracts.
