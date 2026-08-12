# ADR-0023: Quantity-valued structural-attribute sums

Status: proposed implementation baseline; local conformance passed; extended
by ADR-0024; independent and cross-platform review pending

## Context

ADR-0022 executes scalar structural-attribute sums but deliberately rejects a
`sum` whose verified attribute type is `quantity`. Canonical candidates already
normalize Quantity-valued structural attributes to SI base units and preserve
their tolerance, semantic label, provenance, and evidence. The missing runtime
decision is therefore not unit conversion, but the aggregation of scientific
uncertainty and provenance.

Silently dropping input tolerances, retaining one arbitrary operand tolerance,
or applying the comparison-time maximum rule to an aggregate would understate
uncertainty. Quantity sums also need a typed zero for an empty selection and
must not infer its unit or semantic meaning from a nonexistent first operand.

## Decision

`local-predicate-evaluator-v4` admits a structural-attribute `sum` when the
verified plan declares a Quantity descriptor with both a canonical unit and an
explicit semantic label.

- Selected node or edge values are read in canonical index order under the
  existing 5,000-value limit. Every selected item must contain a valid
  Quantity. Its normalized SI unit and semantic label must match the verified
  attribute descriptor.
- Values accumulate with the bound `exact-decimal` or
  `compensated-binary64` algorithm. The accumulation remains unrounded until
  the `value-expression-result-v1` boundary and exposes its algorithm-derived
  exactness state.
- Input uncertainty is converted to an effective absolute bound per operand:

  ```text
  max(absolute, relative * abs(value))
  ```

  Missing tolerance components contribute zero. These non-negative bounds are
  summed with exact decimal arithmetic in canonical selection order under the
  named `sum-effective-absolute-bounds-v1` policy. The public binary64
  tolerance is rounded outward when its shortest decimal representation would
  otherwise fall below the exact accumulated bound.
- The aggregate Quantity carries only that absolute tolerance. The existing
  `declared-max-tolerance-v1` comparison then combines it with the other
  comparison operand without recursively reinterpreting the source relative
  bounds.
- Aggregate provenance is `computed` with method
  `local-quantity-attribute-sum-v1`. Its evidence is the canonical sorted union
  of selected input evidence identifiers. The evaluation's `candidateId` binds
  the complete source quantities, including declared or Oracle provenance that
  is not flattened into the computed Quantity.
- An empty selection returns typed zero in the descriptor's unit and semantic,
  with zero absolute tolerance and empty computed evidence. A quantity
  attribute without a declared semantic remains unsupported, so empty sums do
  not invent scientific meaning.
- Selection witnesses distinguish scalar and quantity sums. Quantity witnesses
  bind the canonical unit, semantic label, accumulation algorithm and exactness,
  and the tolerance-aggregation policy.

Numeric evaluated values now use the same representation for direct constants
and aggregates: `unrounded`, `rounded`, and an algorithm-derived `exact`
Boolean. The comparison-facing Quantity contains the rounded value plus its
declared or aggregated tolerance and provenance.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v4`. Package-filter artifacts embed local
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v5` and
`onto2d:package-candidate-filter:v5`.

Quantity-valued `add` and `multiply`, runtime invariants and coefficients,
balance, cycle-set selection, and substructure operators remain unsupported.
Package-driven Quantity structural-attribute derivation remained pending at
this boundary; ADR-0078 later closes finite scalar constant and
element-invariant candidate attributes, and ADR-0085 subsequently closes the
corresponding normalized Quantity sources.

ADR-0024 subsequently enables compatible Quantity-valued `add` while retaining
this evaluator/domain version as the historical structural-sum boundary.

## Consequences

- compatible Quantity attributes can be summed without host-dependent unit or
  tolerance behavior;
- accumulated uncertainty is conservative under the declared interval-bound
  interpretation and cannot be reduced by cancellation of values;
- computational approximation and scientific input uncertainty remain separate
  artifact fields;
- empty selections are deterministic only when their type metadata supplies an
  explicit unit and semantic;
- changing value accumulation, tolerance aggregation, provenance aggregation,
  or witness disclosure requires another versioned evaluator contract.

## Verification

Fixtures cover mixed SI input units, absolute and relative tolerance
aggregation, boundary-only rounding, exact and compensated value accumulation,
outward rounding above an inexact binary64 representation, subnormal and
overflow tolerance boundaries, empty typed sums, canonical evidence ordering,
relabelling invariance, runtime type/unit/semantic mismatches, missing declared
semantics, schema conformance, and Node.js 20/22 determinism.
