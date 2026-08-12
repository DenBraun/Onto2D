# ADR-0046: Scalar invariant resolution and candidate-local uncertainty

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0026 and ADR-0028 froze exact-element and identical-profile resolution for
Quantity invariants. The typed predicate language already admits invariant
symbols of kind `number`, `string`, `boolean`, and `null`, but the local runtime
previously rejected those symbols. It also raised an exception when a valid
candidate could not select one invariant-bearing node, lacked a requested
value, or referenced a profile class without complete identical values. Those
conditions concern one candidate's available scientific data; treating them as
contract corruption aborted an otherwise complete package census.

## Decision

`local-predicate-evaluator-v13` executes scalar invariant symbols supplied
through the explicit local invariant context.

- `number` values must be finite, normalize negative zero to zero, participate
  in the existing exact-decimal arithmetic path, and round only at the bound
  operand boundary.
- `string`, `boolean`, and `null` values retain their exact JSON scalar value
  and are executable only through the comparisons admitted by the verified
  typed expression.
- Context values must match the verified invariant descriptor exactly. A type
  mismatch remains `PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID`.
- Successful witnesses record either a normalized Quantity or a typed scalar
  `valueKind` and `value`. Exact-element witnesses retain the source element.
  Profile scalar witnesses require identical canonical scalar values from
  every class member and bind `identical-normalized-scalar-v1`; Quantity
  witnesses retain `identical-normalized-quantity-v1`.
- This change initially extended only the direct local API. ADR-0047
  subsequently admits the same scalar value kinds in schema-v1 primitive and
  materialized-element invariants and carries them through package runtimes.

Four resolution failures now produce a candidate-local `indeterminate`
comparison witness rather than aborting evaluation:

- `invariant-node-ambiguous`;
- `invariant-value-unavailable`;
- `profile-invariant-member-values-missing`;
- `profile-invariant-member-values-disagree`.

Both comparison operands are evaluated so that up to two invariant failures
can be retained in deterministic left/right order. Each failure records its
operand, stable reason, and the original structured resolution details. The
indeterminate witness deliberately omits fabricated operand values,
comparisons, selections, and successful invariant resolutions. All other
errors—including malformed contexts, stale bindings, type mismatches,
Quantity unit/semantic mismatches, and resource exhaustion—remain hard
failures.

Package filtering therefore classifies these local results as
`filter-indeterminate`, and complete candidate censuses retain them in their
existing denominator and threshold accounting. No averaging, representative
substitution, interval union, or non-identical profile aggregation is added.

The local evaluator and identity domain move to
`local-predicate-evaluator-v13` and
`onto2d:predicate-local-evaluation:v13`. The depth-one package filter embeds
the changed local artifact and moves to
`package-candidate-filter-evaluator-v14` and
`onto2d:package-candidate-filter:v14`.

## Consequences

- the executable scalar types in the verified expression language now have a
  matching direct local runtime contract;
- scientifically unavailable candidate data remains visible and countable
  without making a complete census fail operationally;
- malformed or semantically incompatible data cannot be downgraded to
  uncertainty;
- non-identical profile aggregation remains an explicit future decision;
- package-authored scalar invariant storage and execution are added separately
  by ADR-0047 without changing this local evaluator contract.

## Verification

Fixtures cover scalar number arithmetic, string/boolean/null equality,
exact-element and profile-wide scalar resolution, context type rejection,
deterministic Quantity/profile disagreement and missing-value witnesses,
package-filter classification, complete-census propagation, runtime schema
acceptance, corrupted scalar and failure witnesses, hash replay, and the
continued hard-failure behavior of unit and semantic mismatches.
