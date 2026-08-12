# ADR-0052: Explicit-semantic local Quantity products

- Status: accepted
- Date: 2026-08-12

## Context

The typed expression analyzer has always inferred dimensions for products of
multiple Quantity operands, and package functionals can execute them because a
functional result specification supplies the final semantic label. Local
predicate comparisons have no such enclosing result declaration. Executing a
product such as force times length while silently inheriting either operand's
semantic would fabricate meaning even when its unit is mechanically known.

## Decision

A `multiply` value expression may declare `resultSemantic`:

```json
{
  "kind": "multiply",
  "resultSemantic": "work energy",
  "factors": [
    { "kind": "constant", "value": { "...": "force Quantity" } },
    { "kind": "constant", "value": { "...": "length Quantity" } }
  ]
}
```

The field is a normalized non-empty string. It is permitted only when the
multiply node has at least two directly Quantity-valued operands. A single-
Quantity scale continues to preserve that operand's semantic and rejects a
semantic override. A nested Quantity product closes its own semantic boundary;
if it is later multiplied by another Quantity, the outer multiply node also
requires its own `resultSemantic`.

Value-expression analysis adds dimensions exactly as before and records the
declared result semantic in the inferred type, normalized expression, and
content hashes. An expression with multiple Quantity operands but no
`resultSemantic` remains analyzable for contexts such as package functionals,
whose result specification supplies the meaning, but it fails local-predicate
runtime preflight. Thus the field is explicit where local execution needs it
without creating two equivalent spellings for ordinary scalar scaling.

Local evaluation multiplies all point values in canonical factor order with
exact decimal arithmetic. Units multiply through `si-multiplicative-v1`. For
current accumulated point `x` and absolute bound `a`, and next point `y` and
bound `b`, the next conservative bound is:

```text
abs(x) * b + abs(y) * a + a * b
```

This is the full interval-product envelope and makes no sign or independence
assumption. Exactness is the conjunction of factor arithmetic exactness;
evidence is the canonical union of Quantity-factor evidence. The emitted
Quantity has computed provenance method `local-quantity-product-v1` and the
declared `resultSemantic`. Scalar-only factors have zero uncertainty. Rounding
still occurs once at the existing operand result boundary.

Package functionals retain their existing general-product behavior and result-
specification semantic source. Missing `resultSemantic` remains rejected only
at the local-predicate support boundary. The changed local artifacts use
`local-predicate-evaluator-v18`,
`onto2d:predicate-local-evaluation:v18`,
`package-candidate-filter-evaluator-v19`, and
`onto2d:package-candidate-filter:v19`.

## Consequences

Local predicates can compare dimensionally general Quantity products without
inventing a semantic label, while existing dimensionless scaling and package
functional expressions remain compatible. Product uncertainty and provenance
are reproducible and visible in the ordinary Quantity comparison witness.

This decision does not add implicit number-to-Quantity lifting, semantic
coercion, division, powers, or a general dimensional type alias. Those require
separate typed operators or contracts.
