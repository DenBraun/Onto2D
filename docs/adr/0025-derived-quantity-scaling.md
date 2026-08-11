# ADR-0025: Derived Quantity scaling

Status: proposed implementation baseline; local conformance passed; extended
by ADR-0026; independent and cross-platform review pending

## Context

ADR-0024 enables compatible Quantity addition but leaves every Quantity-valued
`multiply` unsupported. The expression analyzer already distinguishes one
closed multiplicative case from a general physical product: every `number`
expression is dimensionless, so multiplying exactly one Quantity-valued child
by any number-valued children preserves the Quantity child's dimensions.

This does not solve `Quantity * Quantity`. The analyzer correctly derives that
product's dimensions but the current AST has no declared semantic for the
result. Its uncertainty also requires a two-interval product rather than
scaling one interval by a point value. Copying either input semantic would
invent scientific meaning.

## Decision

`local-predicate-evaluator-v6` recursively evaluates a `multiply` as Quantity
scaling only when exactly one child is Quantity-valued and every other child is
a supported dimensionless number expression. The Quantity child may be a
constant, structural-attribute sum, compatible add, or another supported
scale.

- The result preserves the sole Quantity child's canonical SI unit and explicit
  semantic label. A multiply node with two or more Quantity-valued children
  fails preflight with `quantity-product-semantic-not-frozen`.
- Child values remain unrounded. Number children are multiplied with exact
  decimal operations into a point-valued scalar `s`; the Quantity value `v`
  becomes `s * v`. The complete comparison operand still rounds once at the
  existing `value-expression-result-v1` boundary.
- If the Quantity child has effective absolute scientific bound `delta`, the
  scaled bound is `abs(s) * delta`. A negative scalar therefore cannot produce
  a negative tolerance, and an exact zero scalar produces a zero bound.
- The result is exact only when the Quantity child and every scalar child are
  exact. A compensated scalar or Quantity sum propagates `exact: false`.
  Computational approximation remains distinct from declared scientific
  uncertainty and does not acquire an invented error bound.
- The result has computed provenance method `local-quantity-scale-v1` and
  preserves the Quantity child's canonical evidence union. Number expressions
  do not invent scientific evidence. Selection witnesses from all children are
  retained in normalized expression order.
- A multiply containing only number children retains the existing dimensionless
  behavior. Implicit number/Quantity addition remains unsupported.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v6`. Package-filter artifacts embed local
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v7` and
`onto2d:package-candidate-filter:v7`.

General Quantity products, profile-domain/scalar invariants and coefficients, balance,
cycle-set selection, and substructure operators remain unsupported.

ADR-0026 subsequently allows the sole Quantity child to be an element-exact
runtime invariant while retaining this evaluator/domain version as the
historical scaling boundary.

## Consequences

- signed and nested dimensionless scaling composes with Quantity sums and adds
  without intermediate rounding;
- interval scaling is conservative for the frozen point-scalar model;
- unit, semantic, approximation, provenance, and evidence state remain explicit;
- admitting `Quantity * Quantity` still requires a declared result semantic and
  a separate two-interval propagation contract.

## Verification

Fixtures cover nested negative scaling, boundary-only rounding, absolute and
relative tolerance scaling, zero scaling, evidence/provenance retention,
exactness propagation from compensated scalar sums, selection witnesses,
operand-order normalization, continued multi-Quantity product rejection,
composition with Quantity addition, schema conformance, and Node.js 20/22
determinism.
