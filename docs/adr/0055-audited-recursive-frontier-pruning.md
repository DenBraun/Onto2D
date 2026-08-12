# ADR-0055: Audited recursive generator-frontier pruning

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0054 authorizes predicate evaluation immediately before CandidateStore
admission, but it still materializes every raw edge decoration. Closing an
earlier recursive branch requires a model that is identical to the actual
decorator traversal, an exact count of every skipped raw descendant, and
evidence that the optimized result agrees with both the existing pre-admission
path and pruning-disabled execution.

Canonical edge prefixes are not sufficient for this purpose: canonical edge
order is known only after complete candidate canonicalization, whereas the
decorator traverses skeleton-edge and optional-loop groups in a fixed raw
order. The recursive boundary therefore needs its own audit and controller. It
must not infer proof from samples or enable pruning under a connectivity policy
whose exclusions can change after the observed frontier.

## Decision

`decorated-candidate-enumerator-v4` exposes internal-only hooks for observing
complete raw extensions and evaluating strict edge-group frontiers after all
nodes have been assigned. A frontier is the exact raw traversal state before
at least one group remains. Its closed metadata binds the skeleton, number of
completed and total groups, selected multiplicity in every completed group,
and the exact number of reachable raw completions. Mandatory skeleton-edge
groups precede optional self-loop groups. Parallel selections are canonical
multisets, and the remaining count is reproduced with exact integer
combinatorics before it is admitted to the safe-integer artifact contract.

`package-generator-frontier-auditor-v1` first verifies the ADR-0053 canonical
audit and the same package/run binding. It observes the actual raw traversal,
hashes every raw extension and its complete group-count vector into a rolling
frame, and samples strict frontiers uniformly with SHA-256 rejection sampling.
Each selected frontier is paired with a reachable complete raw extension. A
`frontier fail -> extension pass` pair falsifies the claim. Passing samples are
still falsification evidence only: pruning eligibility additionally requires
the plan's static proof and the passed canonical audit.

For `connectivityProjection: "directed-strong"`, a controller may authorize
closure only after the current complete-node frontier is already strongly
connected in both directions. Edge addition cannot destroy that property, so
every raw descendant then survives the connectivity policy. Earlier
disconnected frontiers remain visible to the audit but receive
`connectivity-frontier-not-satisfied` and cannot be closed, even when their
predicate diagnostic is persistently failing.

`package-generator-frontier-controller-v1` exactly reproduces both audits once
and validates every submitted frontier against the bound skeleton, domain,
node alphabet, edge-group alphabets and order, multiplicities, edge limit, and
exact descendant count. It emits a separate hashed decision and authorizes a
branch only when the frontier audit passed, the plan remains statically proven,
and the partial evaluator reproduces a persistent failure.

`package-recursive-pruned-candidate-generator-v1` applies those decisions at
strict group boundaries and retains the ADR-0054 canonical-prefix check as a
final pre-admission guard. It records every authorized frontier, its partial
graph and decision, the exact raw subtree size, visited/reference/skipped
decoration-state counts, and a rolling decision transcript. `generatedCandidates`
counts complete raw candidates actually visited;
`branchPrunedRawCandidates` counts exact skipped descendants; and
`logicalRawCandidates` is their reconciled sum.

An artifact is interpretable only after exact three-layer conformance:

1. the recursive CandidateStore and policy/canonicalization counts equal the
   complete pre-admission-only reference;
2. visited raw candidates plus skipped descendants equal that reference's raw
   universe, and pre-admission removals plus skipped descendants equal its
   removal census;
3. the pre-admission artifact has already proved eligible and indeterminate
   set equality against pruning-disabled full filtering.

The reference executions must complete under the declared semantic and
execution budgets, so subtree skipping cannot turn a baseline-exhausted run
into an interpretable result. Stored audits, decisions, and recursive
generation artifacts require exact deterministic replay; schema validation or
a self-declared hash is insufficient.

## Consequences

- Depth-one raw edge-decoration subtrees may now be skipped without changing
  the retained canonical candidates or their complete filter result.
- Raw, branch-pruned, pre-admission-pruned, policy-excluded, indeterminate,
  canonical, duplicate, and decoration-state counts remain distinct.
- Arbitrary callbacks are not part of the public low-level enumerator API; only
  package integration may supply the internal pruning hooks.
- The audit frame is tied to the actual raw traversal rather than reconstructed
  from canonical candidates.
- Generalized-depth frontier binding is supplied by ADR-0056. ADR-0081 later
  supplies exact low-level node frontiers and replay-resumable traversal;
  ADR-0082 supplies separate depth-one/generalized node-growth audits and
  authorization. Formation-derived decoration attributes remain a separate
  gate.

## Rejected alternatives

- Treating a passed randomized audit as proof was rejected because it can hide
  unsampled repairs.
- Reusing canonical edge prefixes as recursive cursors was rejected because
  canonical order is unavailable at the raw group frontier.
- Estimating skipped subtree sizes was rejected because budgets and censuses
  require exact reconciliation.
- Closing a disconnected directed-strong frontier and relying on the final
  differential check was rejected because later edge groups may be the ones
  that make the candidate strongly connected. Authorization therefore requires
  connectivity satisfaction before optimization.
- Returning only the optimized store was rejected because it would conceal the
  changed traversal and make pruning regressions unauditable.

## Acceptance artifacts

- deterministic raw-frontier frame construction, sampling, exact replay, and
  tamper rejection;
- exact frontier-universe validation, including remaining descendant counts;
- parallel-edge and optional-loop combinatorial subtree fixtures;
- directed-strong disconnected-frontier denial and strongly connected
  subtree conformance;
- recursive/pre-admission/disabled differential conformance;
- public TypeScript and JSON Schema contracts for audit, decision, and
  generation artifacts;
- Node.js 20/22 repository checks, full suites, and builds.
