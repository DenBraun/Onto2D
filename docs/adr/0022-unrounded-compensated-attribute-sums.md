# ADR-0022: Unrounded compensated scalar-attribute sums

Status: proposed implementation baseline; local conformance passed, extended
by ADR-0023; cross-platform CI passed; independent review pending

## Context

ADR-0021 admitted exact-decimal structural-attribute sums but rejected a run
whose precision policy selected `compensated-binary64`. The existing
`sumDecimals` operation necessarily rounds to the supplied precision policy,
so using it inside a larger `add` or `multiply` expression would introduce an
extra intermediate rounding boundary.

The compensated algorithm can be used honestly only if accumulation and final
expression rounding are separate artifacts and the approximate nature of the
intermediate value remains visible.

## Decision

The decimal runtime adds `accumulateDecimals(values, algorithm)` and the
`decimal-unrounded-accumulation` schema. The operation requires one explicit
algorithm, enforces the existing 100,000-term decimal limit, and returns:

- `decimal-rational-v1` as the representation contract;
- the selected `exact-decimal` or `compensated-binary64` algorithm;
- the term count;
- an `exact` Boolean fixed by the algorithm;
- the canonical, unrounded decimal representation of the accumulated result.

Exact accumulation aligns arbitrary decimal coefficients and scales.
Compensated accumulation uses the existing reviewed Neumaier-style binary64
path and converts its final finite result once to a canonical decimal. Binary64
overflow and non-zero underflow remain explicit decimal errors. The operation
does not claim that a compensated result is mathematically exact.

`sumDecimals` is reimplemented on this operation and retains its existing
rounded public artifact and policy semantics.

`local-predicate-evaluator-v3` accepts either bound summation algorithm for a
finite numeric structural-attribute `sum`. The selected values remain ordered
by canonical node or edge index. A numeric evaluated value now distinguishes:

- `unrounded`, the decimal passed to the single result boundary;
- `rounded`, the value after the bound precision policy;
- `exact`, which is false if any nested compensated sum contributed.

Each sum witness records its algorithm and `accumulationExact` flag. Exact
decimal addition and multiplication around an approximate accumulated decimal
cannot promote the enclosing result back to exact.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v3`. Package-filter artifacts embed those
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v4` and
`onto2d:package-candidate-filter:v4`.

Quantity-valued sums remain unsupported because this decision does not define
tolerance or provenance propagation. Package-driven structural-attribute
derivation also remains pending.

ADR-0023 subsequently freezes that missing tolerance/provenance contract and
extends the evaluator again; the scalar v3 contract described here remains the
historical baseline.

## Consequences

- a compensated attribute sum can participate in a larger dimensionless
  expression without being rounded before the declared operand boundary;
- artifacts no longer label an approximate numeric operand as an exact
  decimal result merely because it has a canonical decimal serialization;
- callers can inspect and schema-validate unrounded decimal accumulation
  independently of predicate execution;
- changing the compensated algorithm, term order, approximation disclosure,
  or evaluated-value shape requires a new versioned contract.

## Verification

Fixtures cover unrounded exact accumulation, retained low-order compensated
terms, algorithm/exactness coupling, invalid algorithms, unchanged rounded
`sumDecimals` behavior, nested evaluator propagation, schema conformance, and
Node.js 22/24 CI determinism.
