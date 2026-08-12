# ADR-0040: Verified depth-source population selection and binding

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The original package candidate binding always materializes primitives and
targets depth one. After ADR-0039, the kernel has a verified complete depth-1
population, but using it directly as a new node alphabet would bypass the
RunConfig `sourceDepths` policy, prior-level terminal status, element
deduplication, and the prerequisite level hash chain.

The first implementation selected only target depth two. The reviewed v2
contract generalizes the same prerequisite chain to bounded explicit target
depths without accepting an unverified intermediate population.

## Decision

`package-depth-source-selector-v2` builds a content-addressed source selection
for target depths one through 64.

- It independently verifies the loaded package, RunConfig, and every supplied
  prior closure by exact replay: depth one uses `package-level-closure-v1` and
  later depths use `package-depth-level-closure-v1` against their own complete
  prerequisite chain.
- Available depths must be contiguous from zero through `targetDepth - 1`.
  Depth zero is reproduced directly from the package. A target `d` selection
  therefore requires exactly one complete, nonempty closure for every depth
  from one through `d - 1`.
- `all-below` selects every available depth; `previous-only` selects exactly
  `targetDepth - 1`. At target depth one both policies necessarily select the
  primitive population.
- The artifact embeds the primitive/derived population records and their
  population, level, and run hashes. It records every element occurrence and
  its minimum available depth. Equal element IDs in selected depths resolve to
  the earliest selected record; IDs and profile classes are canonical.
- Empty or indeterminate prior levels are ladder terminals and cannot feed a
  later candidate universe. Missing/duplicate depths, targets above the hard
  explicit-chain limit, invalid options, and exact-replay drift fail
  explicitly.
- The entire selection is hashed in
  `onto2d:package-depth-source-selection:v1` and stored artifacts require exact
  deterministic reproduction.
- `package-depth-candidate-binding-v2` consumes that exact selection. It uses
  every selected element ID in `element-exact` or exactly one hash per selected
  profile class in `profile-quotient`, while reproducing the reviewed skeleton,
  role, graph-policy, and execution-budget surface of the primitive binder.
  Its target depth, complete source selection, normalized run, enumeration
  input, and limits are hashed in
  `onto2d:package-depth-candidate-binding:v1`.
- `package-depth-candidate-generator-v3` executes that binding through the same
  finite decorated enumerator and exposes complete/budget-exhausted status
  without silently reducing the universe.
- `package-depth-candidate-filter-evaluator-v1` exact-replays the depth binding,
  proves candidate-universe membership, resolves selected-depth element or
  profile constituents, and evaluates the same frozen local predicate plans.
  Its formation basis carries target depth and source-selection hash and is
  bound in `onto2d:package-depth-candidate-filter:v1`.
- `package-depth-candidate-census-evaluator-v1` filters every canonical record
  only after complete enumeration, reconciles Boolean selectivity and
  predicate diagnostics, and hashes the complete denominator in
  `onto2d:package-depth-candidate-census:v1`. Stored censuses require exact
  package/run/prior-level reproduction.

## Consequences

- `sourceDepths` now has observable execution semantics beyond target depth
  one;
- the depth-aware candidate binder receives one verified element/profile
  alphabet instead of assembling prior artifacts ad hoc;
- minimum derivation depth and alternate population occurrence remain visible;
- the selector is now the shared source boundary for generalized depth-level
  closure and explicit ladder execution; current-level fixpoints remain a
  separate contract subsequently implemented by ADR-0044.

## Verification

Local conformance covers target-depth-1 compatibility, target-depth-2
`all-below` and `previous-only` selection, complete-level enforcement,
contiguous coverage, the depth-three ladder path, over-limit targets, canonical occurrences and
profile classes, domain hashing, strict schema validation, tamper rejection,
exact replay, element/profile depth-aware alphabets, finite enumeration,
binding hashing, universe-membership rejection, local filtering, complete
census/count/selectivity reconciliation, complete selection/materialization,
TypeScript declarations, and public API exposure. Independent
implementation comparison and additional-platform evidence remain acceptance
requirements.
