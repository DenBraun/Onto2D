# ADR-0024: Derived Quantity addition

Status: proposed implementation baseline; local conformance passed; extended
by ADR-0025 and ADR-0026; cross-platform CI passed; independent review pending

## Context

ADR-0023 establishes a deterministic unrounded value and conservative absolute
uncertainty bound for a Quantity-valued structural-attribute sum. The local
runtime still rejects an `add` containing Quantity operands, even though
addition has the same dimensional and interval-bound semantics: compatible
values add, while their worst-case absolute uncertainty bounds add without
cancellation.

`multiply` cannot be admitted by the same step. Its result semantic is not
expressed by the current AST, and its uncertainty requires interval-product
rules rather than additive bounds. Treating multiplication as repeated
addition or copying an operand semantic would invent scientific meaning.

## Decision

`local-predicate-evaluator-v5` recursively evaluates Quantity-valued `add`
expressions whose complete operands are direct Quantity constants,
Quantity-valued structural-attribute sums, or other supported Quantity adds.

- Every operand must have the same canonical SI unit and the same explicit
  semantic label. A statically inconsistent or missing semantic fails preflight.
  Implicit lifting between a dimensionless number and a dimensionless Quantity
  remains unsupported.
- Each recursive node carries an unrounded canonical decimal value, an
  algorithm-derived exactness flag, one exact-decimal effective absolute
  tolerance bound, canonical evidence, and canonical selection witnesses.
- Direct constants enter the recursive path through their normalized SI value.
  Their effective absolute bound is
  `max(absolute, relative * abs(value))`.
- A structural sum contributes the value/tolerance result defined by ADR-0023.
  An add sums child values with exact decimal addition and sums child bounds
  with exact decimal accumulation. It cannot become exact again if a nested
  compensated sum made any child approximate.
- No child is rounded. The complete comparison operand rounds once at the
  existing `value-expression-result-v1` boundary. The final public absolute
  tolerance uses the same outward binary64 conversion as ADR-0023.
- A derived result has computed provenance method `local-quantity-add-v1` and
  the canonical sorted union of all child evidence identifiers. Direct
  constants evaluated without arithmetic retain their original declared,
  computed, or Oracle provenance and tolerance shape.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v5`. Package-filter artifacts embed local
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v6` and
`onto2d:package-candidate-filter:v6`.

Quantity multiplication, runtime invariants and coefficients, balance,
cycle-set selection, and substructure operators remain unsupported.

ADR-0025 subsequently enables dimensionless scalar scaling of one compatible
Quantity child while retaining this evaluator/domain version as the historical
addition boundary. ADR-0026 allows element-exact runtime invariant Quantities
to enter the same addition path. General `Quantity * Quantity` products remain
unsupported.

## Consequences

- nested Quantity sums and constants compose without intermediate rounding;
- additive scientific uncertainty is conservative and cannot shrink through
  value cancellation;
- semantic compatibility is enforced independently of the comparison option
  that may ignore semantics between the final left and right operands;
- arithmetic provenance remains explicit while the evaluation hash and
  selection witnesses bind the complete contributing candidate data;
- admitting multiplication requires a separate versioned semantic and
  interval-propagation decision.

## Verification

Fixtures cover direct-plus-aggregate addition, nested boundary-only rounding,
absolute/relative tolerance propagation, evidence union, exactness propagation
from compensated sums, operand-order normalization, semantic mismatch,
implicit number/Quantity lift rejection, continued multiplication rejection,
schema conformance, and Node.js 22/24 CI determinism.
