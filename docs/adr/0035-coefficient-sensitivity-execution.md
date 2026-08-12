# ADR-0035: Complete coefficient-sensitivity execution

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The selector ranker now freezes a complete base ranking, but a ranking that
depends on declared free or fitted coefficients cannot be interpreted without
the selector's precommitted sensitivity sweep. Re-evaluating only successful
variants, only a presentation leader, or only cohorts whose leader changes
would alter the denominator and conceal fragility.

Schema-v1 already names the coefficients to perturb in
`Functional.sensitivityCoefficients`, fixes positive amplitudes and sweep mode
in the selector, and carries `RunConfig.budget.perturbationSamples`. It does not
mark every coefficient as fixed/free/fitted, so the loader can prove that every
listed sensitivity coefficient exists but cannot prove that the author listed
all coefficients that scientifically require a sweep. That authorship gap must
remain explicit at this ADR boundary; ADR-0093 later closes it with normalized
coefficient roles and exact non-fixed coverage.

## Decision

`package-selector-sensitivity-evaluator-v1` consumes an independently
reproduced complete base selector ranking.

- A sensitivity run replays the package, census, cohort partition, and base
  ranking. It accepts neither caller-provided base leaders nor perturbed
  scores.
- `one-at-a-time` creates, for each amplitude, the negative and positive
  multiplicative variant of every listed coefficient. `cartesian` creates the
  complete lexicographically ordered sign product over all listed
  coefficients. Factors are calculated exactly as `1 - amplitude` and
  `1 + amplitude` before conversion to normalized coefficient Quantities.
- A positive factor scales the coefficient value and absolute tolerance;
  relative tolerance and provenance remain unchanged. Unlisted coefficients
  remain byte-equivalent to their normalized package values.
- The complete number of variants is checked before evaluation against the
  run's `perturbationSamples` budget and a separate hard functional-evaluation
  ceiling. An insufficient budget emits an indeterminate report and performs
  no partial sweep. Required counts beyond the JSON safe-integer range remain
  exact canonical decimal strings in the report.
- Each variant evaluates every member of every reproduced cohort through a
  prepared verified functional session, then applies the same dense-ranking,
  epsilon-extremum, gap, and indeterminacy semantics as the base ranker. Full
  perturbed cohort rankings and coefficient witnesses remain in the artifact.
- Each variant identifier binds the package/rules and base-ranking hashes in
  addition to the selector, functional, amplitude, sweep, and direction
  definition, so a perturbation cannot be mistaken for the same variant under
  another semantic basis.
- For each amplitude the comparison denominator is exactly
  `requiredVariants * rankedCohorts`. Leader-set stability counts exact equality
  of complete sorted semantic-extremum sets. Presentation-leader stability
  compares the deterministic first presentation member. Top-K stability
  compares the sorted set of the first `min(topK, cohortSize)` score-ordered
  members.
- If a base ranking is indeterminate or any required perturbed cohort is
  indeterminate, the report is indeterminate and stability ratios are `null`;
  evaluated variants remain inspectable and the denominator is not reduced.
  An empty base ranking or an empty `sensitivityCoefficients` list is explicit
  `not-applicable`, not false robustness.
- A complete verdict is `robust` only when every amplitude meets both the
  leader-set and top-K thresholds. Otherwise it is `fragile`.
- The artifact binds every prerequisite hash, normalized policy, coefficient
  list, exact variant definition, perturbed ranking, comparison, denominator,
  execution budget, point, verdict, and reason in
  `onto2d:package-selector-sensitivity:v1`. Stored reports require exact replay.

## Consequences

- failed variants cannot disappear from a robustness denominator;
- semantic leader stability remains distinct from presentation and top-K
  diagnostics;
- Cartesian combinatorics are visible and fail before partial work;
- packages with no declared sensitivity coefficients are not labelled robust;
- ADR-0093 supersedes the original authorship gap with optional explicit role
  declarations, deterministic legacy inference, and loader-enforced complete
  non-fixed coverage.

## Verification

Local conformance fixtures cover positive/negative one-at-a-time factors,
Cartesian ordering/counts, basis-bound variant hashes, scaled absolute and
preserved relative tolerance, robust and fragile leader/top-K outcomes,
multiple-cohort denominators, empty coefficient/base populations, base and
variant indeterminacy, insufficient run/hard budgets, exact counts beyond the
safe-integer range, report tampering, exact replay, and schema/type/public-API
agreement. Independent implementation comparison and cross-platform evidence
remain required before acceptance.
