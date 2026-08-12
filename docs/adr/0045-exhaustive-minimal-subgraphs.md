# ADR-0045: Exhaustive policy-bound minimal subgraphs

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The predicate language defines `minimal(P)` separately from
`irreducibleRemoval(P, removal)`. ADR-0030 closes the latter by evaluating only
single node or edge removals. That is insufficient for minimality: a predicate
may fail after every single removal but pass again on a smaller proper
subgraph. The normative architecture therefore requires `minimal(P)` to test
every proper substructure selected by the run's explicit
`SubstructurePolicy`.

The search is exponential and must not allocate an unbounded family before a
resource check. Its evidence must also distinguish the parent-index selection
from the effective graph after isolated-node handling, while remaining stable
under relabelling of the input candidate.

## Decision

`local-predicate-evaluator-v12` executes `minimal(P)` for complete canonical
candidates under `exhaustive-proper-subgraphs-v1`.

- The evaluator first evaluates `P` on the whole candidate. A whole failure or
  indeterminate result is final and no subgraph is enumerated.
- An omitted expression policy binds the run's `SubstructurePolicy`. An
  explicit `minimal.policy` must equal the bound run policy ID. All nested
  minimal and irreducible-removal requirements must be satisfiable by that one
  policy before evaluation begins.
- Canonical parent index zero is the least-significant subset bit. Subsets are
  visited in ascending binary order without recursive call-stack growth.
- `remove: nodes` enumerates every proper node subset and retains every parent
  edge whose endpoints are selected.
- `remove: edges` retains the complete parent node selection and enumerates
  every proper edge subset.
- `remove: nodes-and-edges` enumerates every node subset and every subset of
  the parent edges whose endpoints it retains. Only the complete parent node
  and edge selection is excluded.
- `retainIsolatedNodes: false` removes every selected node without an incident
  selected edge before normalization. The witness retains both the raw
  `selectedNodeIndexes`/`selectedEdgeIndexes` and effective
  `parentNodeIndexes`/`parentEdgeIndexes`. Distinct raw selections remain
  distinct audit entries even when isolated-node removal produces the same
  effective graph.
- Empty and disconnected selections excluded by policy are recorded as
  `skipped` and do not count as inner failures. Included empty graphs use the
  existing domain-separated substructure identity. Non-empty graphs use the
  normal candidate canonicalizer with disconnected normalization enabled and
  retain canonical-to-parent node and edge mappings.
- After a whole pass, any evaluated passing proper subgraph makes `minimal`
  fail. Otherwise any evaluated indeterminate subgraph makes it indeterminate;
  if no subgraph was evaluated, the result is also indeterminate. Only a
  non-empty evaluated denominator in which every `P` result fails proves
  minimality.
- Before materialization, a capped exact counter calculates the selected
  proper-subgraph family size. A family that would exceed the remaining shared
  limit of 10,000 substructure attempts fails with
  `PREDICATE_LOCAL_SUBSTRUCTURE_LIMIT`. Nested minimal/removal evaluation shares
  the same counter.
- Runtime invariant expressions below a substructure combinator were rejected
  by this decision. ADR-0089 later freezes retained-node resolution, while
  ADR-0048 through ADR-0050 separately close `novel` and exact/sampled
  `stableUnder`.

The local artifact records the policy, enumeration method, whole result,
attempted/evaluated/skipped counts, every selection and nested outcome. Its
evaluator and hash domain move to `local-predicate-evaluator-v12` and
`onto2d:predicate-local-evaluation:v12`. Package filtering preflights and binds
minimal plans to the reproduced run policy, moving to
`package-candidate-filter-evaluator-v13` and
`onto2d:package-candidate-filter:v13`.

## Consequences

- `minimal` can now prove the architecture's full finite proper-subgraph
  condition rather than conflating it with single-removal irreducibility;
- policy-excluded subgraphs cannot masquerade as failed predicate evidence;
- exponential work is rejected before its witness family is allocated;
- exhaustive witnesses can still be large, but their maximum cardinality and
  recursive aggregate work are explicit and shared;
- `novel`, `stableUnder`, invariant-bearing subgraphs, scalar/non-consensus
  invariants, and general local Quantity products continue to fail closed.

`novel` is subsequently closed for exact constituent projections by
[ADR-0048](0048-exact-constituent-novelty.md); the historical v12 boundary
described above is unchanged.

## Verification

Conformance fixtures cover all three removal modes and their exact family
sizes, a predicate that passes single-removal irreducibility but fails full
minimality, explicit policy-reference match and mismatch, empty/disconnected
filtering, relabelling invariance, preflight exhaustion above 10,000
substructures, package-bound evaluation, published JSON Schema acceptance, and
rejection of incomplete or mislabeled minimal witnesses. The full workspace is
validated on the supported local Node.js 20 and 22 runtimes.
