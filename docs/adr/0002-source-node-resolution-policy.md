# ADR-0002: Source node resolution policy

Status: template awaiting policy authorship

The executable artifact shape, hash, forbidden-criterion checks, and fixed
reconciliation invariants are implemented by
[ADR-0012](0012-source-policy-freeze-contracts.md); no current component is
resolved by that contract.

## Context

After eligible relation annotations are frozen, nontrivial formation-support
SCCs may represent one distributed structure, joint constitution, unresolved
generative recursion, or a mixed unresolved cluster. SCC membership alone is
not evidence that cards are identical.

## Decision to freeze

Define general merge and cluster criteria with positive and negative examples.
The following criterion is forbidden: “merge these cards because doing so
removes a cycle.” Component size and resemblance to the foundational paper are
diagnostics only.

Every surviving component must become one stratification vertex with
`internalOrder = "undefined"`; members inherit its depth and basis. Every raw
edge must remain reconciled as an inter-cluster, internal, or typed explanation
relation.

## Acceptance artifacts

- policy version and hash;
- reviewed disposition for every raw nontrivial SCC;
- member and edge reconciliation;
- condensation DAG and depth-inheritance proof;
- fitting-risk metrics and post-unblinding change report.

No current catalogue component is resolved by this template.
