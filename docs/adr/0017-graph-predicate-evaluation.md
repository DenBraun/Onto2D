# ADR-0017: Verified graph-predicate evaluation and partial-failure detection

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

ADR-0009 compiles normalized Boolean expressions and derives conservative
truth-persistence metadata, while ADR-0015 and ADR-0016 generate complete
canonical candidates. The kernel still lacked an executable boundary between
those artifacts. Directly trusting a supplied plan, evaluating numeric or
substructure operators without their runtime data, or treating static
persistence as permission to prune would each overstate the implemented
semantics.

The first evaluation increment therefore needs to be useful for complete graph
predicates and partial-failure diagnostics while remaining narrower than the
future full predicate engine and pruning controller.

## Decision

`predicate-plan-verifier-v1` is the shared internal verification boundary. It
closes a supplied compiled plan, reproduces expression and analysis hashes,
re-runs the supported analyzer from the plan's declared symbol environment,
compares every analysis witness and pruning field, and reproduces the plan
hash. Numeric binding and graph evaluation consume only that verified result.

`evaluateGraphPredicatePlan`, versioned as
`graph-predicate-evaluator-v1`, accepts only:

- `all`, `any`, and `not`;
- `degree`, `cycleExists`, `connected`, `componentCount`, `pathExists`, and
  `countRole`.

It rejects numeric and substructure operators at this boundary. It
re-canonicalizes the supplied candidate under the declared graph policy, uses
canonical node and edge indices for evaluation and witnesses, evaluates every
logical child so that evidence is not erased by short-circuiting, and returns
a domain-separated `predicate-graph-evaluation` hash binding the verified plan,
candidate identity, effective graph policy, outcome, and ordered witnesses.

Complete graph semantics are fixed as follows:

- `degree` applies its range universally to every selected node. Each incident
  edge record contributes one, including a self-loop; this is incidence-record
  degree, not half-edge degree. An empty selector is `indeterminate`.
- `countRole` counts matching canonical edge records exactly.
- directed cycles preserve direction and admit a loop of length one and a
  reciprocal dyad of length two when their declared bounds allow them;
  `undirected-simple` removes loops and collapses parallel/directional copies,
  so its minimum possible cycle length is three;
  `undirected-multigraph` preserves loops and parallel two-cycles.
- `pathExists` is directed and role-filtered. Equal selected endpoints admit a
  zero-edge path. A missing endpoint selection is `indeterminate`; a populated
  but unreachable selection is `fail` on a complete graph.
- `connected` and `componentCount` use the candidate policy's weak/undirected
  or directed-strong connectivity projection.
- logical composition uses the documented three-valued truth tables.

`detectPartialGraphPredicateFailure`, versioned as
`partial-graph-predicate-evaluator-v1`, accepts a closed partial graph with an
explicit `nodesComplete` flag. It canonicalizes the graph with parallel edges,
self-loops, and disconnected state permitted, under the existing six-node and
64-edge safety ceilings. It evaluates partial truth only when the verified
plan already has `pruning.eligibility = "static-proven"`. Currently detectable
facts include exceeding an upper role/degree bound and finding a declared
cycle or directed path; absence and repairable connectivity remain
`indeterminate`. A statically blocked plan stays blocked even when runtime data
looks persuasive.

The partial result is diagnostic evidence, not pruning authority. Every result
has `pruningAuthorized: false`, retains the plan's mandatory `auditRequired`
flag, and receives separate partial-graph and evaluation hashes. Candidate
enumeration does not consume this result until a versioned monotonicity-audit
artifact and pruning controller can verify the exact allowed extension model.

## Consequences

- complete graph-only predicate plans now have deterministic executable
  outcomes and canonical witnesses;
- relabeling nodes or reordering edges cannot change evaluation identity;
- a forged or stale plan is rejected before candidate inspection;
- reciprocal dyads cannot masquerade as undirected-simple triads;
- partial persistent failures can be recorded and tested without silently
  changing the generated universe;
- numeric value execution, balance, substructure combinators, and derived-depth
  pruning remain separate from this evaluator. ADR-0019 later composes these
  graph outcomes into a package-bound local filter, while ADR-0053 through
  ADR-0055 add the audits/controllers and depth-one pre-admission plus raw-
  frontier integration without changing this diagnostic's denied authority.

## Verification

Fixtures cover aggregate witnesses, universal degree, role counts, all 512
directed three-node edge subsets across all three cycle projections,
directed-versus-simple cycles, structural-attribute selectors, zero-length and
ordinary paths, empty selectors, weak and strong components, candidate
permutation invariance, unsupported operators, persistent upper-bound and
forbidden-cycle failures, repairable partial absence, blocked proof claims,
node-population flags, immutable outputs, and compiled-plan tampering. Existing
predicate-analysis and numeric-binding suites run beside the new evaluator
tests to verify the shared plan-verification refactor.
