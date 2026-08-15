# ADR-0027: Local balance evaluation

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

ADR-0046 later implements direct local scalar and profile-consensus invariant
resolution without changing this balance contract.

## Context

The predicate language and numeric-policy binder already define `balance` as
the sum of one selected numeric attribute being within an explicit Quantity
threshold of zero. ADR-0021 through ADR-0023 provide the missing canonical
selection, unrounded accumulation, approximation, unit, uncertainty, and
provenance rules. The local evaluator still rejects `balance`, even for the
node and edge sets whose aggregation contract is now complete.

Functional coefficients are not part of this extension. Predicate analysis
intentionally forbids coefficient nodes; coefficients belong to a later
functional/ranking execution boundary and cannot be exposed to candidate
filtering.

## Decision

`local-predicate-evaluator-v8` evaluates `balance` on a complete canonical
candidate for node and edge sets. Cycle-set selection remains unsupported.

- The runtime forms the same synthetic attribute `sum` already verified by the
  predicate analyzer. Selection order, missing-value failures, selected-value
  limits, exact-decimal or compensated-binary64 accumulation, and selection
  witnesses follow ADR-0021 through ADR-0023.
- The signed aggregate remains unrounded through accumulation and rounds once
  at the bound result boundary. Balance compares the absolute magnitude of that
  rounded aggregate with the normalized non-negative `tolerance.value` using
  `lte`; the tolerance window is closed.
- For a scalar number attribute, the aggregate magnitude is lifted only for
  this comparison into a dimensionless Quantity with zero scientific
  tolerance and the balance tolerance's explicit semantic. The public
  aggregate remains a number, and computational approximation does not invent
  a scientific error bound.
- For a Quantity attribute, values normalize to the plan's canonical SI unit
  and one explicit semantic, and their effective absolute bounds and evidence
  aggregate under `sum-effective-absolute-bounds-v1`. If balance analysis
  inferred a dimensioned attribute without semantic metadata, the balance
  tolerance's explicit semantic supplies the runtime attribute semantic;
  selected values must match it.
- The normalized balance tolerance is the right comparison operand, including
  its own declared/computed/Oracle tolerance and provenance. The aggregate's
  scientific bound and the threshold's scientific bound combine through the
  already bound `declared-max-tolerance-v1` policy. The numeric binding's
  `semanticPolicy` applies to the Quantity comparison.
- An empty supported selection produces the typed zero defined by the existing
  sum contracts. It is not changed to `indeterminate` or treated as missing
  data.
- A balance witness records its expression path, outcome, attribute, signed
  evaluated aggregate, normalized threshold Quantity, tolerance-aware
  comparison, and canonical selection witness. Runtime data errors fail
  explicitly rather than becoming a Boolean verdict.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v8`. Package-filter artifacts embed local
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v9` and
`onto2d:package-candidate-filter:v9`.

Package filtering can execute balance only after its verified generation
binding exposes the required structural attribute. The current primitive
package bridge exposes no structural attribute values, so it rejects such a
plan through the existing attribute-availability preflight instead of calling
the evaluator with missing data.

Profile-domain/scalar invariant resolution, functional/coefficient execution,
general Quantity products, cycle-set selection, substructure operators, and
derived-attribute package generation remain unsupported at this local balance
boundary. ADR-0032 later enables coefficients and general Quantity products in
the separate package-functional runtime.

## Consequences

- exact and compensated scalar or Quantity balances share one frozen result
  boundary and one tolerance-aware comparison rule;
- scientific input uncertainty may conservatively admit a magnitude just above
  the nominal threshold, while computational approximation remains separately
  disclosed and never widens it;
- threshold semantic, tolerance, provenance, and evidence are identity-bearing
  through the verified plan, while selected source values remain bound through
  the candidate and witness;
- package filtering cannot mistake an unavailable derived attribute for an
  empty balanced set.

## Verification

Fixtures cover scalar pass/fail boundaries, threshold uncertainty, exact and
compensated accumulation, Quantity unit normalization, aggregate uncertainty
and evidence, semantic-policy behavior, empty selections, missing/type/unit/
semantic failures, cycle-set rejection, canonical relabeling, package
attribute preflight, schema conformance, and Node.js 22/24 CI determinism.
