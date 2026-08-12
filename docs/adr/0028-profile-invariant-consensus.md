# ADR-0028: Profile-wide invariant consensus

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

ADR-0046 later extends this Quantity-only v9 baseline with exact scalar
consensus and replaces candidate-local missing/disagreement exceptions with
structured indeterminate comparison witnesses. Hard contract errors remain
unchanged.

## Context

ADR-0026 resolves a Quantity invariant only when a candidate node names one
exact materialized element. A `profile-quotient` node instead names a complete
class of elements with the same profile hash. Its lexicographically smallest
formation representative is useful for provenance disclosure, but it is not a
scientific rule for choosing one member's invariant.

One conservative profile case is nevertheless decidable without averaging,
interval widening, evidence selection, or representative substitution: every
member supplies the same complete normalized Quantity.

## Decision

`local-predicate-evaluator-v9` admits a Quantity-valued `invariant` for a
`profile-quotient` candidate only through the frozen
`identical-normalized-quantity-v1` consensus policy.

- The explicit invariant context contains the source-population hash, every
  source element belonging to the candidate's referenced profile classes, and
  the exact profile-to-member partition. Profile IDs must equal the distinct
  canonical candidate references. Classes are non-empty and disjoint, and the
  context element IDs must equal their complete member union.
- Invariant selection still resolves exactly one canonical candidate node. An
  omitted selector remains valid only for a singleton candidate.
- Every member of the selected profile class must provide the requested
  invariant. Each value is normalized through the existing multiplicative-SI
  Quantity contract. The complete normalized records must then have identical
  canonical JSON, including value, canonical unit, tolerance, semantic,
  provenance kind/source/method, and evidence.
- Dimensionally equivalent source units may therefore agree after
  normalization. Different tolerance or evidence does not silently agree even
  when nominal values match. This version performs no averaging, tolerance
  union, provenance synthesis, or representative fallback.
- A successful resolution witness records the expression path, invariant name,
  canonical node, profile hash, sorted complete member-element IDs, consensus
  policy, and common normalized Quantity. Element-exact witnesses retain their
  existing element-ID shape.
- Missing member values fail with
  `PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE` and reason
  `member-values-missing`; any normalized disagreement uses the same error with
  reason `member-values-disagree`.
- Package filtering constructs the context only from the reproduced primitive
  depth population and its verified profile classes. The separately disclosed
  formation representative does not participate in invariant resolution.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v9`. Package-filter artifacts embed those
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v10` and
`onto2d:package-candidate-filter:v10`.

This version also corrects the ADR-0027 machine-readable witness contract:
balance selections must carry attribute, value-kind, summation-algorithm, and
accumulation-exactness fields. Quantity selections continue to require their
unit, semantic, and tolerance-aggregation policy. Runtime v8 already emitted
these fields; the v9 schema and TypeScript type no longer accept their absence.

Scalar invariants, non-identical profile aggregation, functional coefficients,
general Quantity products, cycle-set selection, and substructure operators
remain unsupported at this local predicate boundary. ADR-0032 later enables
functional coefficients and general Quantity products after an eligible
package filter without weakening this predicate contract.

## Consequences

- profile counting no longer makes invariant predicates universally
  unavailable when the full source class itself proves one value;
- class membership and every successful consensus witness are deterministic
  under element/context ordering and do not depend on the formation
  representative;
- nominal equality alone cannot discard scientific uncertainty or provenance;
- a future looser consensus, interval-union, or aggregation policy requires a
  separately named and versioned contract.

## Verification

Fixtures cover SI-equivalent member normalization, context/member-order
invariance, complete witness fields, missing and disagreeing members, malformed
profile contexts, package-derived consensus, package rejection of a
representative-only disagreement, schema conformance, balance aggregation-field
rejection, and Node.js 20/22 determinism.
