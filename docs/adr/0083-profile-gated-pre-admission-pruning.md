# ADR-0083: Profile-gated audited pre-admission pruning

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0076 freezes an exact complete-candidate profile-slot gate. ADR-0053 and
ADR-0054 freeze a canonical-prefix monotonicity audit and pre-admission pruning
controller. Both boundaries were executable, but their composition was
rejected because the pruning audit had to bind the same candidate universe that
the profile gate exposes.

The canonical-prefix controller does not close a raw generator subtree: it
runs on one already complete candidate immediately before CandidateStore
admission. This gives it a narrower safe integration point than the raw edge-
group and node-growth controllers. The complete profile decision can run first,
and only compatible candidates need enter the canonical-prefix audit and
pruning universe.

## Decision

The combined depth-one and generalized-depth execution order is fixed as:

1. build a complete raw candidate;
2. canonicalize it under the bound graph policy;
3. execute `package-profile-composition-gate-v1`;
4. record and exclude a definite incompatible composition;
5. fail the whole generation on an indeterminate composition decision;
6. evaluate the audited canonical-prefix pruning controller only after a pass;
7. admit an unpruned compatible candidate to CandidateStore.

`auditPackagePredicateMonotonicity` and its depth-aware counterpart reproduce
ordinary package generation first. Consequently, when
`profileCompositionPolicy` is `profile-slot-gate-v1`, their canonical universe
contains exactly the compatible candidates and their binding hash already
commits to the gate policy, source population, role alphabet, graph policy, and
run configuration. The audit remains falsification-only and cannot authorize a
plan without the existing `static-proven` predicate proof.

The internal decorator has a dedicated combined gate/pruner boundary. It does
not expose either authority to generic callers, and it cannot reverse their
order. The pre-admission generation artifact now carries the complete
`profileComposition` transcript. Before the result is interpretable, execution
replays the same binding with pruning disabled and requires:

- byte-equivalent profile-composition transcripts;
- equal raw, graph-policy, composition-exclusion, and canonicalization counts;
- exact CandidateStore reconciliation after accounting for pruned canonical
  representatives and duplicate raw occurrences;
- identical eligible and filter-indeterminate candidate sets after full local
  filtering.

The generalized-depth path uses the same executor but additionally binds its
verified prior-level chain, `targetDepth`, and `sourcePopulationHash`.

Raw edge-group recursive pruning and incomplete-node growth pruning remain
fail-closed under the profile gate. They can skip candidates before complete
profile consumption is known and therefore require a separate audit that
reconciles capacity/guard state and the overlap between predicate-pruned and
composition-excluded descendants.

[ADR-0084](0084-profile-gated-raw-frontier-pruning.md) later supplies that
separate complete-extension census without broadening this canonical-prefix
decision.

## Consequences

- profile-slot-gated runs can use audited canonical-prefix pre-admission pruning
  at depth one and arbitrary verified target depths;
- profile-incompatible candidates never influence pruning decisions or the
  post-filter differential denominator;
- composition exclusions and predicate-pruned candidates retain separate exact
  counts and artifacts;
- recursive edge and node subtree optimization does not inherit this narrower
  proof; its later authority is independently frozen by ADR-0084;
- ordinary closure APIs keep their exhaustive generator until an integration
  policy explicitly selects the optimized path.

## Verification

Conformance covers gate-before-pruner ordering, compatible and incompatible
profile candidates, typed partner guards, exact composition-transcript replay,
real predicate pruning, pruning-disabled eligible/indeterminate equality,
depth-one and generalized-depth reproduction, schema validation, TypeScript
declarations, and Node.js 22/24 CI execution. ADR-0084 separately verifies the
raw-frontier composition boundary.
