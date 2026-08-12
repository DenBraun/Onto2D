# ADR-0048: Exact constituent novelty evaluation

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The predicate language defines `novel(P)` as a comparison between a complete
composition and the constituent elements referenced by that composition. It
is not structural minimality: `minimal(P)` searches every policy-selected
proper subgraph, while novelty asks whether the whole has a property absent
from each constituent considered as an element by itself.

The runtime previously accepted and analyzed the expression but rejected it
before evaluation. Closing the boundary requires an exact constituent
projection, a non-vacuous three-valued verdict, deterministic witnesses, and a
clear treatment of profile-quotient nodes. A quotient node is a class, not an
element, so substituting its representative would turn an implementation
detail into scientific evidence.

## Decision

`local-predicate-evaluator-v14` executes `novel(P)` only for complete
`element-exact` candidates under
`canonical-single-node-no-edge-v1`.

- `P` is evaluated first on the whole canonical candidate. A whole `fail` or
  `indeterminate` result is final and no constituent projection is evaluated.
- After a whole pass, every canonical parent node produces one projection
  containing that exact node, including its structural attributes, and no
  edges. The projection is canonicalized with connectedness disabled and
  retains its content identity, exact source element ID, parent node index,
  and canonical-to-parent mapping.
- Any passing constituent makes novelty fail. Otherwise any indeterminate
  constituent makes the result indeterminate. Only a non-empty constituent
  set in which every evaluation fails proves novelty. A zero-constituent
  denominator is indeterminate rather than a vacuous pass.
- A singleton candidate is therefore not novel when `P` passes for its sole
  element projection.
- Constituent projections share the existing hard limit of 10,000 attempted
  substructure evaluations with nested `minimal`, `irreducibleRemoval`, and
  `novel` calls. The direct constituent count is checked against the remaining
  budget before projections are materialized.
- `novel` itself does not require `SubstructurePolicy`, because its projection
  is fixed by this decision. If `P` contains `minimal` or
  `irreducibleRemoval`, the plan still binds the one explicit run policy. The
  novelty witness records that policy ID when such a binding is present.
- Runtime invariant expressions below `novel` remain rejected under the same
  substructure rule as removal and minimality. Constituent-local missing-node
  and profile-subset invariant semantics are not inferred.
- `profile-quotient` candidates fail with
  `PREDICATE_LOCAL_NOVEL_DOMAIN_UNSUPPORTED`. The runtime does not use the
  disclosed representative element as a constituent substitute.

The witness records the projection method, whole result, attempted and
evaluated constituent counts, and every source element/projection identity,
mapping, outcome, and nested witness. Local evaluation moves to
`local-predicate-evaluator-v14` and
`onto2d:predicate-local-evaluation:v14`. The depth-one package filter exposes
the new executable plan through `package-candidate-filter-evaluator-v15` and
`onto2d:package-candidate-filter:v15`.

Other depth and fixpoint coordinators retain their coordinator versions and
hash domains: their algorithms are unchanged, while their embedded local
evaluation artifact explicitly carries v14 and therefore changes every
affected enclosing hash.

`stableUnder` remains unsupported. This decision does not select a
perturbation family or choose exhaustive enumeration versus sampling.

## Consequences

- element-exact package filters and complete censuses can now distinguish a
  whole-only property from properties already present in source elements;
- novelty cannot silently inherit profile-representative bias;
- the fixed linear constituent projection remains distinct from exponential
  proper-subgraph minimality and policy-dependent single removal;
- nested policy use and every constituent verdict remain auditable;
- invariant-bearing constituent evaluation and perturbational stability remain
  explicit future contracts.

## Verification

Fixtures cover whole-only pass, constituent-preserved failure, whole-failure
short circuit, constituent indeterminacy, singleton non-novelty, relabelling
invariance, profile-domain rejection, nested policy discovery, nested invariant
rejection, package-filter execution, complete-census separation, exact witness
schema acceptance, and rejection of invalid projection, missing constituent,
or unexpected policy evidence. The complete workspace is validated on the
supported local Node.js 20 and 22 runtimes.
