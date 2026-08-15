# ADR-0021: Exact scalar structural-attribute sums

Status: proposed implementation baseline; local conformance passed, extended
by ADR-0022; cross-platform CI passed; independent review pending

## Context

ADR-0020 deliberately rejected every `sum` expression because candidate data,
runtime types, summation order, and quantity uncertainty were not yet closed.
The existing candidate identity and predicate-analysis contracts nevertheless
already determine one narrower case completely: a `sum` whose declared
attribute type is dimensionless `number` and whose selected values are
structural attributes of the canonical candidate.

This case can execute without defining invariant resolution, functional
coefficient binding, quantity-tolerance propagation, or derived attributes.
Missing values and runtime type drift must remain errors rather than becoming
zeroes or silently shortened selections.

## Decision

`local-predicate-evaluator-v2` extends the ADR-0020 evaluator with `sum` over a
node or edge `SetSelector` when the verified predicate plan declares the
attribute as `number`.

- Nodes and edges are selected from the canonical candidate. Node selectors
  retain their existing canonical-index, all, and scalar-where semantics; edge
  role lists retain their normalized semantics.
- Every selected item must own the requested structural attribute and its
  runtime value must be a finite JavaScript number. Missing and mismatched
  values fail with stable errors before an evaluation artifact is emitted.
- Values are parsed into `decimal-rational-v1` and accumulated in increasing
  canonical node or edge index order. The empty sum is exactly zero.
- This version accepts only the bound `exact-decimal` summation algorithm.
  ADR-0022 subsequently freezes an unrounded approximate-accumulation artifact
  and extends execution to `compensated-binary64` under evaluator v3.
- A sum may participate in the already supported dimensionless `add` and
  `multiply` tree. All nested operations remain exact, and the complete
  comparison operand is rounded once at `value-expression-result-v1`.
- At most 5,000 values may enter one aggregation. This specialized limit is
  reached before the general canonical-JSON entry guard for supported graph
  shapes.
- Selection witnesses record the expression path, canonical indexes, optional
  normalized roles, attribute name, and `summation: "exact-decimal"`.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v2`. Because package-filter artifacts embed
local evaluations, their evaluator and domain become
`package-candidate-filter-evaluator-v3` and
`onto2d:package-candidate-filter:v3` even though package-driven generation
still rejects non-empty structural-attribute alphabets.

Quantity-valued sums, runtime invariants, coefficients, balance, cycle-set
selection, and substructure operators remain unsupported. Package filtering
continues to reject a predicate attribute absent from its bound decoration
universe before local execution, comparing node and edge requirements against
their respective structural alphabets.

## Consequences

- Direct canonical-candidate evaluation can execute exact scalar attribute
  aggregation without a caller-defined order or host addition.
- Candidate relabeling and input edge order cannot change the selected indexes,
  exact result, witness, or evaluation identity.
- Declared type metadata is checked again against every selected runtime value;
  a verified analysis cannot make malformed candidate data trustworthy.
- Empty selections have a mathematically defined result, while partially
  populated selections fail instead of changing the denominator or sum.
- General package-to-decoration attribute derivation remains pending;
  compensated and quantity aggregation are supplied by ADR-0022 and ADR-0023.

## Verification

Fixtures cover node and role-filtered edge sums, exact decimal composition,
boundary-only rounding, canonical witness metadata, relabeling invariance,
missing and mismatched attributes, compensated-policy rejection, the
selected-value limit, quantity-sum rejection, and validation of the emitted
artifact against its published JSON Schema.
