# ADR-0036: Deterministic multi-selector admission

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

The kernel can now reproduce complete rankings and coefficient-sensitivity
reports for one selector, but it still has no artifact that combines every
declared selector into the final candidate-domain decision. Treating a
presentation leader as the winner, omitting one selector, accepting a partial
cohort, or allowing an indeterminate selector to disappear would silently
change the selected population.

Schema-v1 normalizes selectors by identifier and has no separate authored
sequence field. The architecture requires a candidate to belong to every
applicable semantic-extremum set. The executable combination rule therefore
needs to freeze normalized selector-ID order without pretending that selectors
sequentially narrow and rerank the population.

## Decision

`package-selector-admission-v1` consumes an independently reproduced complete
local-filter census and exactly one partition/ranking/sensitivity chain for
every normalized package selector.

- Selector inputs are complete: duplicates, omissions, undeclared IDs, rule
  drift, and any partition/ranking/sensitivity replay mismatch fail before an
  admission artifact is emitted. Serialization uses normalized selector-ID
  order; caller array order is non-semantic.
- Every selector is evaluated over its own declared partition of the same
  complete locally eligible census. Multi-selector combination is the
  intersection of all applicable semantic-extremum sets, not sequential
  reranking. With no declared selector, identity admission selects every
  locally eligible candidate and emits no synthetic selector execution.
- For an eligible candidate, a definite non-extremum under any selector yields
  `selector-excluded`. This definite exclusion takes precedence over an
  indeterminate result from another selector. Otherwise any unavailable
  semantic-extremum decision yields `selection-indeterminate`; only membership
  in every selector's semantic-extremum set yields `selected`.
- Predicate-rejected and filter-indeterminate candidates retain their local
  outcomes and receive no selector evaluation. Every evaluated census
  candidate appears exactly once in the admission decision list.
- Per-selector census counts reconcile selected, excluded, and indeterminate
  eligible members. Final counts reconcile the eligible population into
  selector-excluded, selection-indeterminate, and selected buckets. Selection
  and overall retention use the exact candidate domain; empty denominators are
  `null`.
- Final indeterminacy is `filterIndeterminate + selectionIndeterminate`. The
  admission interpretation is indeterminate only when its exact ratio exceeds
  the frozen run threshold. Empty evaluated populations remain explicit.
- A fragile sensitivity report does not erase the reproducible base selection,
  but marks that selector's variational interpretation `fragile`. Missing
  sensitivity or base-ranking information marks the metric indeterminate.
  Sensitivity that is not applicable solely because no coefficient was listed
  leaves a complete base ranking valid, while retaining the authorship caveat
  from ADR-0035.
- The artifact embeds every verified selector execution, candidate decision,
  selector census, reconciliation count, retention ratio, interpretation, and
  prerequisite hash under `onto2d:package-selector-admission:v1`. Stored
  artifacts require exact replay.
- This boundary composes already complete per-selector executions. Aggregate
  whole-level perturbation accounting and execution scheduling remain the
  future `LevelResult` controller's responsibility; the admission artifact
  does not claim that a per-selector budget is a global run-usage ledger.

## Consequences

- final candidate-domain selection cannot omit a selector or collapse a
  degenerate semantic extremum to one presentation ID;
- selector combination is deterministic without inventing schema-v1 sequence
  semantics;
- definite exclusion and missing information remain distinguishable;
- sensitivity fragility remains an interpretation state rather than a hidden
  mutation of the raw selected set;
- selected candidates are not yet derived `Element` records. Formation
  provenance, profiles, alternate-derivation reconciliation, and closure depth
  materialization remain later boundaries.

## Verification

Local conformance covers two-selector intersection and semantic ties, definite
exclusion precedence over indeterminacy, identity admission, local rejection
and filter-indeterminate outcomes, ranking/sensitivity indeterminacy, complete
count and ratio reconciliation, selector omission/duplication/order
invariance, fragile-sensitivity interpretation without selection erasure,
exact replay and tampering, and schema/type/public-API agreement. Independent
implementation comparison and cross-platform evidence remain acceptance
requirements.
