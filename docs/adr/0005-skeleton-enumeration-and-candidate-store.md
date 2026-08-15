# ADR-0005: Bounded skeleton enumeration and candidate-store state

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

The graph canonicalizer can identify a supplied graph, but candidate generation
also needs a reproducible universe of connected unlabeled simple skeletons and
a store that prevents isomorphic decorated candidates from entering later
denominators more than once. Generator truncation must remain distinguishable
from successful completion, and neither insertion order nor duplicate arrival
order may affect the retained semantic candidates.

## Decision

For the documented range `1 <= n <= 6`, the initial reference enumerator walks
the finite labelled simple-graph universe in ascending edge-bitmask order. Edge
positions are the lexicographically generated pairs `(0,1), (0,2), ...`.
Disconnected labelled graphs are rejected before canonicalization. Every
connected graph is canonicalized in the skeleton hash domain and deduplicated
by `SkeletonId`; a same-ID/different-bytes observation is a hard collision
error. Final skeleton records are sorted by ID and record how many labelled
graphs projected to each class.

The reference algorithm intentionally favors reviewability over asymptotic
optimization. Its conformance boundary is the published sequence `2, 6, 21,
112` for three through six nodes. A future orderly-generation optimization must
produce the same canonical IDs and counts before replacing it.

Enumeration has explicit `maxLabelledGraphs` and `maxSkeletons` budgets. The
first unprocessed mask or excluded skeleton ID is recorded. Any exhaustion
returns `status: "budget-exhausted"` and `interpretable: false`; partial output
cannot be reported as a complete skeleton universe.

Each CandidateStore fixes one counting domain, graph policy,
canonicalization-limit set, and unique-candidate budget. Its state is `open`
until explicit finalization, `complete` after successful finalization, or
`budget-exhausted` after the first unique candidate beyond the budget. It
retains canonical candidate content, counts later isomorphic inputs as
duplicates, and serializes snapshots in CandidateId order. Open and truncated
snapshots are non-interpretable.

## Consequences

- skeleton generation cannot inspect roles, functionals, predicates, or source
  catalogue labels;
- reference enumeration remains finite and independently auditable;
- duplicate labelled skeletons and duplicate decorated candidates are visible
  as separate diagnostic counts;
- a caller must finalize the store before treating its snapshot as complete;
- reaching a numeric budget is harmless when the caller has actually finished,
  but discovering the next unique candidate makes truncation explicit;
- multigraph decoration, role/direction assignment, partial pruning, and the
  full generator state machine remain separate work.

## Acceptance artifacts

- exact connected-unlabeled counts for `n = 3, 4, 5, 6`;
- multiplicity reconciliation against connected labelled inputs;
- endpoint and node-permutation invariance;
- input-order-independent candidate-store snapshots;
- explicit labelled-graph, skeleton, and candidate budget fixtures;
- differential comparison with an independent graph generator.

The independent exhaustive generator and frozen full-permutation-orbit fixture
regenerate deterministically and match the JavaScript conformance test in the
supported Node.js 22 and 24 CI matrix. This ADR must not be marked accepted
until independent review passes.
