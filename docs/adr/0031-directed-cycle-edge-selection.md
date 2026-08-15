# ADR-0031: Directed cycle-edge set selection

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

The value-expression language already admits `SetSelector { kind: "cycle" }`,
and `count`, structural-attribute `sum`, and `balance` can consume a set. The
runtime previously rejected the selector because the language did not say
whether it selected one cycle, counted distinct cycles, or combined overlapping
cycles. Selecting one canonical representative would make a semantic result
depend on an arbitrary tie-break, while enumerating all simple cycles would
create an exponential multiset with ambiguous overlap accounting.

## Decision

`local-predicate-evaluator-v11` gives the existing selector one explicit
finite meaning named `directed-cycle-edge-union-v1`.

- The selector returns every canonical edge that participates in at least one
  directed cycle of the complete candidate after its optional role filter is
  applied. Equivalently, an eligible edge `u -> v` is selected when `v` can
  reach `u` in the same role-filtered directed graph. A self-loop therefore
  participates in a length-one cycle.
- Edge direction and multiplicity are preserved. Every qualifying canonical
  edge appears exactly once, including parallel copies. Reciprocal edges form
  a directed length-two cycle. No undirected projection is inferred from the
  graph connectivity policy.
- `count({ kind: "cycle" })` counts the selected edge union, not the number of
  distinct cycles. `sum` and `balance` likewise consume every selected edge
  attribute exactly once in ascending canonical edge-index order.
- When no edge qualifies, the selector produces an exact empty set. Count is
  zero, and the existing empty-sum and empty-balance identities remain zero;
  missing attributes on unselected edges are not consulted.
- Every selection witness records `setKind: "cycle"`, the sorted canonical
  edge indexes, the optional normalized role filter, and
  `cycleSelection: "directed-cycle-edge-union-v1"`. This distinguishes the
  contract from ordinary edge selection and from graph predicates whose cycle
  projection is supplied explicitly.
- Directed membership is computed by bounded reachability over the already
  canonical candidate. The existing candidate edge and local selected-value
  ceilings bound execution and artifact size; no simple-cycle enumeration is
  performed.

The local artifact moves to hash domain
`onto2d:predicate-local-evaluation:v11`. Package filtering embeds the changed
selection witness and therefore moves to
`package-candidate-filter-evaluator-v12` and
`onto2d:package-candidate-filter:v12`.

This decision does not change `cycleExists`, which continues to require an
explicit `directed`, `undirected-simple`, or `undirected-multigraph`
projection. A future undirected set selector must add an explicit language
contract instead of overloading this method.

## Consequences

- overlapping cycles cannot double-count an edge or its attribute;
- role filters can remove a return path and thereby remove otherwise cyclic
  edges from the selected set;
- directed two-cycles and loops remain observable, while an acyclic orientation
  of an undirected triangle selects no edge;
- cycle counts, sums, and balances become executable in direct local,
  package-filter, census, and nested irreducible-removal evaluation;
- selecting distinct cycle objects or an undirected cycle-edge union remains a
  separately versioned future language extension.

## Verification

Conformance fixtures cover role-filtered overlapping cycle unions, ordinary
and Quantity attribute aggregation, empty selections, loops, reciprocal
edges, acyclic orientations, canonical relabelling, package-bound execution,
schema enforcement, and exhaustive reconciliation of all 512 directed
three-node edge subsets against an independent transitive-closure reference.
