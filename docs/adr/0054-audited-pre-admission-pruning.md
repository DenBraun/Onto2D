# ADR-0054: Audited pre-admission candidate pruning

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0053 separates partial-failure diagnostics, a deterministic monotonicity
audit, and pruning authorization. Its one-shot controller exactly reproduces
the full audit for every decision, which is correct for isolated calls but
cannot be used inside candidate generation. The next integration boundary must
verify the package/run/audit tuple once, preserve graph-policy exclusions and
all generator counting domains, expose every authorized removal, and prove
that enabling the optimization does not alter the complete local-filter
result.

The current canonical decoration algorithm learns a candidate's canonical
node and edge order only when a complete raw decoration is materialized.
Therefore this milestone can safely prune before CandidateStore admission, but
does not yet claim to skip the earlier recursive decoration-state traversal.

## Decision

`createPackagePartialPruningControllerSession` reproduces and verifies one
package/run/audit tuple once. The immutable session exposes the audited
binding, kernel version, sorted statically proven and audit-passed predicate
IDs, and a repeated `evaluate` method. Every method result is byte-for-byte the
same `package-partial-pruning-controller-v1` decision produced by the one-shot
API; preparation changes batching cost, not authority.

`decorated-candidate-enumerator-v4` retains the separately reconciled
`preAdmissionPrunedCandidates` raw count and an internal-only pre-admission
decision hook. The public two-argument enumerator never accepts an arbitrary
hook and always reports zero for that count. Package integration first
canonicalizes each complete raw decoration under the actual graph policy, so
connectivity failures remain `policyExcludedCandidates`. Only a valid
canonical candidate reaches the prepared controller.

`package-pruned-candidate-generator-v1` scans the canonical edge prefixes of
each complete raw decoration, including the complete edge sequence, in
increasing edge-count order. At each prefix it evaluates authorized predicate
IDs in lexical order and stops at the first separately authorized persistent
failure. The removed raw decoration never enters CandidateStore. Canonical
duplicates must produce the same first decision; otherwise execution fails.

The artifact binds the package, rules, run configuration, candidate binding,
audit, strategy, sorted authorized predicate set, every unique pruned
candidate's first full decision, raw multiplicity, and a rolling transcript
hash covering every controller decision. Counts distinguish evaluated raw
candidates, prefix states, controller decisions, authorized decisions, unique
and duplicate pruned candidates, and retained canonical candidates.

A result is emitted only after exact pruning-disabled differential
conformance. The implementation reruns the same bound enumeration with no
pruner and requires:

```text
baseline attempted = retained attempted + pruned raw
baseline canonical = retained canonical + unique pruned
baseline duplicate = retained duplicate + duplicate pruned
```

It then performs complete package-local filtering on the baseline and retained
populations. Every pruned canonical candidate must be `predicate-rejected` by
the predicate named in its authorization decision. The pruning-enabled and
disabled `eligible` sets must have identical sorted content hashes, as must the
two `filter-indeterminate` sets. Any disagreement is a hard unsoundness or
differential-conformance error, never a partial artifact. Stored generation
artifacts are accepted only through exact deterministic replay.

The new identities use
`onto2d:package-pruned-candidate-generation:v1`,
`onto2d:package-pruning-transcript:v1`, and
`onto2d:package-pruning-result-set:v1`.

## Consequences

Depth-one generation can now consume audited controller decisions without
trusting an assertion, silently dropping policy exclusions, changing an
eligible/indeterminate result, or repeatedly rebuilding the audit universe.
Raw, canonical, duplicate, rejected, and retained counts remain inspectable,
and tampered stored artifacts fail exact replay.

This is deliberately a correctness-first pre-admission integration. It does
not reduce node/edge decoration-state traversal, serialize resumable state,
or authorize depth-aware/fixpoint generation. True recursive branch closure
needs an audited generator-frontier extension model and exact skipped-subtree
budget/census semantics. ADR-0055 supplies that separate contract for
depth-one raw edge-group traversal and directed-strong gating; ADR-0056 later
extends both audited pruning paths to verified target-depth chains. Resumable
execution remains separate closure work.

## Acceptance artifacts

- exact prepared-session equivalence with the one-shot controller;
- authorized canonical-prefix removal with raw/unique/duplicate reconciliation;
- pruning-disabled eligible and indeterminate set equality;
- full-filter confirmation that every removed candidate fails its authorizing
  predicate;
- whole-audit failure disables every controller call and removal;
- graph-policy exclusions precede pruning;
- schema conformance, exact artifact replay, and tamper rejection;
- Node.js 20/22 full-suite, repository-check, and build conformance.
