# ADR-0089: Nested substructure invariant resolution

- Status: accepted
- Date: 2026-08-12

## Context

The local predicate runtime already executes invariant expressions and the
`minimal`, `irreducibleRemoval`, `novel`, and `stableUnder` combinators, but its
support preflight rejected every invariant below one of those combinators. The
runtime itself canonicalizes each retained or perturbed graph while preserving
the source `ref` of every retained node and emits canonical-to-parent mappings.
Consequently the missing boundary is semantic, not representational.

Recomputing an invariant from a modified graph would introduce an unspecified
scientific operation and could make the result depend on evaluation order.
Using the original candidate's canonical node index without reevaluating its
selector would instead bind a possibly different node after canonicalization.

## Decision

An invariant below a substructure combinator is a constituent invariant of the
node selected in the currently evaluated canonical graph. It is resolved from
the same immutable, source-population-bound invariant context as the whole
candidate.

The following rules are normative:

1. Every node selector is reevaluated against each canonical retained,
   constituent, or perturbed graph. A `canonical-index` selector therefore
   addresses that graph, not the parent graph.
2. Resolution uses the selected node's retained `ref`. Node removal makes only
   that removed reference unavailable; retained references keep their original
   values.
3. Edge deletion, edge-role replacement, and structural numeric-attribute
   displacement do not recompute or mutate constituent invariants.
4. `element-exact` resolution still requires the exact source element.
   `profile-quotient` resolution still requires complete class membership and
   either identical normalized consensus or an explicitly declared supported
   aggregation policy. A representative is never a value shortcut.
5. Missing values, a selector resolving zero or multiple nodes, and profile
   disagreement remain structured `indeterminate` comparison evidence.
   Malformed contexts and type, unit, or semantic drift remain hard errors.
6. Existing whole/substructure witnesses retain the nested invariant witness
   together with canonical-to-parent mappings, so the selected source can be
   audited after each canonicalization.
7. A local artifact with invariant requirements binds the sorted non-empty
   `invariantNames` list alongside `invariantSourcePopulationHash`. This keeps
   the dependency explicit even when every stability attempt is skipped and no
   nested comparison witness is produced.

No graph-dependent invariant recomputation, missing-node imputation, profile
subset aggregation, or mutation of the bound invariant context is introduced.

The changed artifacts use `local-predicate-evaluator-v19`,
`onto2d:predicate-local-evaluation:v19`,
`package-candidate-filter-evaluator-v20`, and
`onto2d:package-candidate-filter:v20`.

## Consequences

- all schema-v1 predicate value-expression kinds valid in the predicate
  environment now have an executable local path when their declared types are
  supported;
- invariant comparisons compose deterministically with exhaustive and sampled
  substructure evaluation;
- removal and perturbation cannot silently change scientific invariant values;
- selector movement caused by subgraph canonicalization is explicit in nested
  witnesses and parent mappings;
- profile aggregation remains independent of substructure semantics; ADR-0090
  closes the current registry and requires a new versioned scientific contract
  for any future policy.

## Verification

Local conformance covers exact constituent novelty, typed stability, and
single-node irreducibility with retained scalar or Quantity invariants. Package
conformance covers explicit profile aggregation inside canonical removed
substructures. Capability, declaration, schema, full-regression, and build
checks remain mandatory.
