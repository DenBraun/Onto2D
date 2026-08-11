# ADR-0019: Package-bound graph-only local candidate filtering

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0017 evaluates one verified graph predicate plan against one canonical
candidate. ADR-0018 materializes and binds the primitive depth-zero source
population. Neither boundary proves that a candidate belongs to a particular
package/run generation universe, evaluates every top-level predicate, or
records the constituent resolution needed by later formation provenance.

Materializing a derived `Element` at this point would still be premature.
Numeric and substructure predicates, selector-based final admission, and
deterministic derived-profile extraction are not implemented. Local graph-only
eligibility can nevertheless be established without weakening any of those
later gates.

## Decision

`package-candidate-filter-evaluator-v1` accepts a `LoadedRulePackage`, its
`PackageCandidateBinding`, and one complete candidate. It first reproduces the
loaded package and then reconstructs the complete binding from its recorded
RunConfig and raw/state/search execution limits. The supplied binding must be
canonically identical to that reproduction.

The candidate is re-canonicalized under the binding's graph policy and
canonicalization limits. Before predicate evaluation, the evaluator proves
membership in the bound finite universe by checking:

- the counting domain and semantic node/edge budgets;
- the canonical skeleton against the bound connected-skeleton set;
- every canonical node against the bound element/profile alphabet;
- every canonical edge against the bound role/attribute alphabet;
- non-parallel multiplicity per undirected adjacency group, including the
  reciprocal-direction case that directed graph validation alone permits but
  the decorator does not generate.

For `element-exact`, each canonical node resolves directly to its source
element and profile class. For `profile-quotient`, it resolves to the disclosed
lexicographically smallest representative and retains the complete sorted
profile-class membership. This resolution, the full canonical candidate,
target depth, depth basis, and source-population hash form the artifact's
formation basis; they are not yet an `Element.provenance` record.

All top-level predicate plans are checked for graph-only support before an
artifact is emitted. Every supported plan is evaluated even after another plan
fails. The result retains predicate ID, phase, claim references, the complete
graph-evaluation artifact, reconciled pass/fail/indeterminate counts, and the
three corresponding sorted predicate-ID sets. Verdict precedence is:

1. any failure produces `predicate-rejected`;
2. otherwise any indeterminate result produces `filter-indeterminate`;
3. otherwise the candidate is locally `eligible`.

An empty predicate set is vacuously locally eligible and does not create a
synthetic predicate or selector admission. The complete basis is hashed in
`onto2d:package-candidate-filter:v1`.

## Consequences

- a standalone graph evaluation can no longer be mistaken for proof that its
  candidate came from the declared package/run universe;
- profile-quotient representative choice is explicit at the formation
  boundary rather than reconstructed later from an ID alone;
- all currently executable top-level predicates contribute to one immutable
  local-filter artifact and failure does not suppress other diagnostics;
- malformed or stale packages/bindings, foreign node/edge variants, excess
  budgets, foreign skeletons, and non-generable reciprocal decorations fail
  before a verdict is returned;
- `eligible` remains strictly local: the artifact does not claim selector
  survival, final admission, derived profile availability, or derived-element
  identity;
- the presence of any numeric, balance, stability, or substructure operator
  blocks the entire artifact until the corresponding evaluator is implemented.

## Verification

Fixtures cover simultaneous pass/fail/indeterminate outcomes and failure
precedence, complete evaluation without top-level short-circuiting, independent
filter-hash reproduction, immutability, exact and profile-quotient constituent
resolution, relabeling/edge-order invariance, stale binding rejection, foreign
node and edge variants, reciprocal non-parallel decorations, unsupported
numeric predicates, and the empty-predicate eligibility boundary.
