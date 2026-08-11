# ADR-0006: Multiplicative SI quantities

Status: implemented decision; runtime execution not performed

## Context

Quantity-bearing package fields and candidate attributes previously preserved
units as strings and compared those strings literally. That made equivalent
values such as `100 cm` and `1 m` structurally different, allowed unsupported
unit spellings through package loading, and left numeric comparison without one
declared tolerance rule.

The kernel needs a deterministic dimensional layer before typed expression
analysis, predicate evaluation, cohort windows, selector ranking, or Oracle
response validation can be implemented.

## Decision

The first quantity runtime uses the versioned grammar
`si-multiplicative-v1`. A unit expression is a product or quotient of known
symbols with optional non-zero integer exponents. Whitespace, parentheses,
affine conversions, logarithmic units, arbitrary user symbols, and executable
conversion hooks are excluded.

The registry contains:

- SI bases `m`, `kg`, `s`, `A`, `K`, `mol`, and `cd`;
- `g`, `rad`, `sr`, `Hz`, `N`, `Pa`, `J`, `W`, `C`, `V`, `F`, `ohm`, `S`,
  `Wb`, `T`, `H`, `lm`, `lx`, `Bq`, `Gy`, `Sv`, and `kat`;
- the accepted non-SI units `min`, `h`, `d`, and `L`;
- decimal prefixes from yocto through yotta, written with ASCII `u` for micro.

`1` is the only canonical dimensionless unit. Parsing produces a seven-axis
dimension vector, a multiplicative scale to SI bases, and a canonical base-unit
expression. Expressions are limited to 128 characters, 32 factors, absolute
factor and combined base exponents of 64. The shared exponent ceiling ensures
that every emitted canonical base-unit expression is accepted when parsed
again.

Package quantities and structural candidate attributes normalize to canonical
SI bases before content hashing. Value and absolute tolerance are multiplied by
the same absolute conversion factor; relative tolerance is unchanged.
Quantity specifications normalize their unit expression even when they do not
carry a value.

Unit-scale composition is retained internally as a reduced rational. When the
resulting conversion has a terminating decimal expansion, value and absolute
tolerance are multiplied in `decimal-rational-v1` before a single conversion to
the public binary64 quantity field. This prevents intermediate binary64
products such as `0.1 * 0.1` from separating equivalent SI inputs. A genuinely
non-terminating rational conversion is converted once under the existing
binary64 policy rather than being labelled an exact decimal.

A tolerance is non-empty by value, not merely by property name: at least one
of `absolute` or `relative` must be defined, finite, and non-negative.
Quantity semantics, evidence identifiers, and method identifiers are
normalized and may not carry leading or trailing whitespace. Package
validation performs the same conversion as the normalizer so conversion
overflow is reported as a package validation issue before identity hashing.

Comparison requires dimensional compatibility. It also requires equal semantic
labels unless the caller explicitly selects `semanticPolicy: "ignore"`.
The comparison algorithm is named `declared-max-tolerance-v1` at the public
runtime boundary so compiled numeric bindings can reference it without copying
its implementation.
`require-equal` is selected only when `semanticPolicy` is absent; null, empty,
or otherwise invalid supplied values fail instead of falling through to the
default.
For normalized operands `a` and `b`, the effective tolerance is:

```text
max(
  absolute_a,
  absolute_b,
  relative_a * max(abs(a), abs(b)),
  relative_b * max(abs(a), abs(b))
)
```

`eq` passes inside that closed window, `ne` outside it, strict inequalities
must clear the window, and inclusive inequalities include it. Comparison emits
the normalized values, difference, effective tolerance, raw relation, semantic
policy, and Boolean outcome.

All conversion and comparison operations reject non-finite results. A non-zero
value or absolute tolerance that would underflow to binary64 zero also fails
explicitly, as does a non-zero relative comparison bound that underflows to
zero. Public quantity fields retain the repository's existing binary64 number
policy; the exact rational/terminating-decimal conversion step only removes an
avoidable intermediate-rounding artifact. General expression accumulation is
still governed separately by ADR-0007.

## Consequences

- dimensionally equivalent package inputs converge before structural hashing;
- terminating SI conversions converge before local exact-decimal evaluation,
  including powered prefix scales;
- unsupported or malformed units fail package or candidate validation;
- affine units such as degrees Celsius need a later explicit contract and
  cannot be approximated as multiplicative units;
- `rad` and `sr` are dimensionless in dimensional algebra, while their
  scientific meaning remains distinguishable through the quantity semantic;
- semantic equality remains separate from dimensional compatibility;
- changing the registry, prefix rules, parser limits, canonical base order, or
  tolerance algorithm requires a new grammar/policy version.

## Conformance artifacts

- derived-unit and expanded-unit equivalence fixtures;
- canonical unit-expression parse/normalize round trips above exponent 16;
- prefix and absolute-tolerance conversion fixtures;
- intermediate-rounding regressions for decimal prefixes and powered units;
- incompatible-dimension, malformed-unit, and unknown-symbol failures;
- tolerance-bound truth-table fixtures;
- undefined tolerance bounds, invalid comparison-policy values, normalized
  provenance identifiers, conversion overflow, and non-zero underflow;
- package identity equivalence for compatible unit representations;
- candidate identity equivalence for structural quantity attributes.

Dynamic execution of these artifacts remains outside the current change.
