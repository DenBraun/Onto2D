# ADR-0029: Complete package-bound local-filter census

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The package candidate generator already freezes and exhaustively enumerates a
finite canonical candidate universe, and the package candidate filter already
evaluates every supported top-level predicate for one verified member of that
universe. The architecture additionally requires reconciled level-wide counts,
per-predicate pass/fail/indeterminate totals, exclusive rejection attribution,
and explicit inert/dominating diagnostics.

Those aggregates are meaningful only for a complete enumeration. A prefix
produced after budget exhaustion cannot be promoted into a selectivity
denominator.

## Decision

`package-candidate-census-evaluator-v1` composes the existing package generator
and package filter into a content-addressed `complete-local-filter-census-v1`
artifact.

- The evaluator accepts a verified loaded package, a RunConfig input, and the
  existing package-candidate execution limits. It reproduces the complete
  package binding and candidate enumeration before filtering.
- A budget-exhausted enumeration fails with
  `PACKAGE_CANDIDATE_CENSUS_ENUMERATION_INCOMPLETE`. No partial census or
  selectivity value is returned.
- Package and binding verification plus local-plan preflight occur once per
  census session. Every canonical candidate is still re-canonicalized, checked
  for bound-universe membership, and evaluated through the same v10 filter
  path. Immutable universe-membership and source/profile lookup indexes are
  prepared once with the session rather than rebuilt per candidate. No
  predicate is skipped after a sibling failure.
- The artifact embeds the complete package enumeration and every full filter
  artifact in canonical candidate-ID order. Their counts must reconcile
  exactly with the enumerator's canonical-candidate count.
- Candidate totals distinguish evaluated, predicate-rejected,
  filter-indeterminate, and locally eligible candidates. Boolean selectivity is
  `eligibleCandidates / evaluatedCandidates`, or `null` only for an empty
  evaluated population. The indeterminate ratio uses the same denominator.
- Each predicate census records evaluated, passed, failed, indeterminate, and
  exclusively rejected candidates. A rejection is exclusive when that
  predicate is the candidate's only definite failed top-level predicate;
  indeterminate siblings do not create an additional rejection. Entries are
  serialized as a predicate-ID-sorted array so arbitrary valid IDs never
  become canonical JSON object keys.
- `inert` means `failed === 0`. `dominating` means a non-empty evaluated
  population with `failed / evaluated >= 0.90`. The v1 dominance threshold is
  explicit in the artifact and hash rather than inferred from results.
- Local interpretation is `empty` for no evaluated candidates,
  `indeterminate` when the observed indeterminate ratio strictly exceeds the
  RunConfig threshold, and otherwise `valid`. The raw reconciled counts and
  ratios remain present when interpretation is indeterminate.

The artifact hash domain is `onto2d:package-candidate-census:v1`.

`verifyPackageCandidateCensus` accepts a serialized census only after exact
deterministic reproduction from an independently supplied loaded package,
RunConfig, execution limits, and expected kernel version. Whole-artifact
canonical equality verifies the census hash, complete generation, embedded
filter explanations, predicate-ID ordering/uniqueness, all count and ratio
reconciliation, thresholds, and interpretation. JSON Schema remains the
shape-validation boundary rather than a substitute for reproduction.

This remains a local-filter artifact. It performs no cohort construction,
functional scoring, selector admission, derived profile extraction, element
materialization, null-model execution, or closure, and it does not claim to be
a complete `LevelResult`.

## Consequences

- Boolean selectivity and predicate diagnostics now have a proved complete
  canonical denominator for the implemented finite package universe;
- overlapping predicate failures cannot be mistaken for exclusive explanatory
  power;
- budget exhaustion cannot leak a plausible-looking partial ratio;
- full per-candidate explanations remain available for audit instead of being
  replaced by aggregate-only counts;
- future configurable dominance policies or truncated `LevelResult` artifacts
  require separately versioned contracts;
- stored census artifacts have a public fail-closed verification path rather
  than relying on schema validity or a self-declared hash.

## Verification

Fixtures cover complete enumeration/filter reconciliation, canonical candidate
ordering, all-pass and all-fail populations, overlapping and exclusive
rejections, inert and dominating predicates, indeterminate-threshold handling,
budget-exhaustion refusal, API capability exposure, schema conformance,
content-hash reproduction, serialized-artifact mismatch rejection, exact
`0.90` dominance-boundary handling, prototype-sensitive predicate IDs, and
Node.js 20/22 determinism.
