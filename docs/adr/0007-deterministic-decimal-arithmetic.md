# ADR-0007: Deterministic decimal arithmetic

Status: implemented decision; runtime execution not performed

## Context

The kernel architecture requires every numeric accumulation policy to be
explicit and hashed. Host binary floating-point addition cannot serve as the
only policy: ordinary decimal inputs such as `0.1` and `0.2` do not add exactly
in binary64, cancellation can erase low-order terms, and implicit rounding at
intermediate steps can make an expression depend on evaluation shape.

The existing `PrecisionPolicy` already declares:

- `decimalPlaces`;
- `rounding` as `half-even`, `half-up`, or `toward-zero`;
- `summation` as `exact-decimal` or `compensated-binary64`.

This decision gives those fields one executable meaning before the typed
expression evaluator is added.

## Decision

The version `decimal-rational-v1` represents a finite decimal as:

```text
coefficient * 10^(-scale)
```

`coefficient` is a `BigInt` internally and a canonical signed integer string at
the public boundary. Trailing coefficient zeroes are removed together with the
corresponding scale. Zero is always `{ coefficient: "0", scale: 0,
canonical: "0" }`.

Inputs may be normalized decimal strings, finite binary64 numbers, `bigint`
values, or an already validated `DecimalValue`. A number enters the decimal
domain through its ECMAScript shortest round-trippable `toString()` form. This
is deterministic but represents the published binary64 value, not an
unavailable pre-conversion source literal.

The input grammar accepts an optional minus sign, an integer part, an optional
non-empty fractional part, and an optional decimal exponent. Leading integer
zeroes, whitespace, `NaN`, infinity, hexadecimal notation, separators, and
locale formats are rejected.

Addition, subtraction, and multiplication are exact within resource limits.
Division computes the integer coefficient at the declared `decimalPlaces` and
applies the declared rounding rule once. General rounding also occurs once at
the result boundary:

- `toward-zero` discards the remainder;
- `half-up` moves away from zero when the discarded magnitude is at least one
  half;
- `half-even` moves to the nearest value and resolves an exact half toward an
  even retained coefficient.

`exact-decimal` summation aligns powers of ten and accumulates `BigInt`
coefficients. It rounds only the final sum. `compensated-binary64` uses the
Neumaier compensated algorithm in the declared term order, then converts and
rounds the final finite result through the same decimal boundary. The latter is
not labelled exact; callers must supply canonical term order when the source
collection is unordered.

The fixed resource limits are part of the arithmetic version:

| Limit | Value |
|---|---:|
| input characters | 256 |
| input significant digits | 1,024 |
| result significant digits | 2,048 |
| absolute scale | 1,024 |
| decimal places | 256 |
| power-of-ten exponent | 4,096 |
| summation terms | 100,000 |
| canonical result characters | 4,096 |

Exhausting a limit, dividing by zero, producing a non-finite compensated sum,
or converting a decimal outside finite binary64 produces an explicit
`KernelError` at stage `DECIMAL`. A non-zero decimal that would underflow to
binary64 zero fails with `DECIMAL_NUMBER_UNDERFLOW`; it is not silently
converted to zero. No partial numeric value is returned.

## Consequences

- decimal addition and exact summation no longer inherit binary64 representation
  artifacts;
- rounding modes have fixed behavior for positive and negative ties;
- compensated accumulation remains available where a binary64 algorithm is
  required, but its non-exact status and term order are explicit;
- canonical decimals are serializable without JSON `BigInt` values;
- expression analysis must attach one normalized `PrecisionPolicy` before any
  future sum, balance, functional, ranking, or epsilon-bound computation;
- this module does not yet evaluate expressions or change stored `Quantity`
  values automatically;
- changing parsing, normalization, limits, rounding, or accumulation requires a
  new arithmetic version.

## Conformance artifacts

- exponent and trailing-zero normalization fixtures;
- exact `0.1 + 0.2` and cancellation fixtures;
- positive and negative half-even/half-up/toward-zero tables;
- rounded rational-division fixtures;
- exact-sum order permutations;
- compensated low-order-term recovery;
- invalid grammar, policy-limit, division-by-zero, overflow, and non-zero
  binary64-underflow failures;
- public capability and type-contract checks.

Dynamic execution of these artifacts remains outside the current change.
