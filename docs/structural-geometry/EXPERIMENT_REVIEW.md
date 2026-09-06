# Stage-three experiment review

Date: 2026-09-06. Scope: necessity/role selections, typed channels, local-weight
audit and inverse-target-share metric experiments. Implementation self-review;
independent scientific review and default metric promotion remain open.

## Review findings and decisions

- Weight is defined by the source schema relative to a child's parent population.
  The audit reproduces sums of 0.9, 1.9 and 0.9 at `0.18`, `0.2` and `0.9`.
  No global calibration or repair of source data is inferred. Normalization
  occurs only in a separate full-source metric context, fixed across selections.
- Retained all nodes in each selected graph, including isolates. Necessity is
  nested; roles use explicit subsets instead of an invented lifecycle ranking.
  Relation channels can overlap and are not pooled as a partition or score.
- Weighted directed Forman uses geometric edge weights equal to inverse local
  shares and unit vertex weights. Positive ratios use exact decimal fractions
  and outward integer square-root bounds, avoiding floating-root hash drift.
  Boundary tests distinguish exact zero, unresolved sign and overlapping unit
  comparisons. Means and node aggregates preserve outward bounds.
- Found and fixed a request-validation coercion: an array such as `["all"]`
  could pass an object-key lookup for a selection kind. A strict string check
  now rejects it, with regression cases for both all and necessity selections.
- Enlarged the audit's rational transport bounds to cover extreme finite source
  values such as `1e308` while marking them ineligible. Geometric lengths require
  positive rational numerators/denominators; no malformed value becomes epsilon.
- Verified exact source/manifest, selection, policy, normalization-context,
  numeric-policy and audit bindings. Rehashed forged values cannot pass replay.
  Count/codec limits and a separate incidence-operation cap fail without partial
  output. Iterative graph traversals avoid call-stack dependence.
- Shared the existing verified engine Model bridge internally; the original
  unit public API, policies and frozen artifacts retain their identities.
  Experimental APIs use a separate package subpath and opt-in analysis.

## Validation evidence

Local environment: macOS, Node v24.19.0, Python 3.9.6.

- `npm ci --offline --ignore-scripts`: passed.
- `npm test`: 1254 passed, 0 failed, 0 skipped.
- `npm run build`: passed, including all 72 exact experiment replays, six
  necessity transitions, 170 schemas, public declarations, workspace exports,
  source audit, existing unit artifacts, registry, worker and kernel closure.
- `npm run check:goldens`: original canonical/skeleton fixtures verified.
- `npm run structural-geometry:experiments:check`: 23 focused tests passed;
  rerun with the full 72-run replay after the selection-kind review fix.
- The separate Python Fraction/Decimal reference agrees on five frozen weighted
  controls, typed filtered cases, Unicode IDs and all 971 full-model edges.
- Browser-target bundling and isolated JavaScript VM execution reproduce the
  exact weighted artifact using the portable package graph. This does not claim
  a new UI or locally executed coverage of every browser/OS/Node version.
- Documentation checks and `git diff --check` passed.

## Outcome

The [reference suite](../../cases/structural-geometry/experiments/README.md)
is a reproducible sensitivity experiment. Unit remains default. The full weighted
run has 491 edge values below the unit baseline, 479 above and one equal;
that alone does not establish usefulness or improved interpretation.
No unresolved implementation issue was found in this computational scope.
At this stage's completion, directed transport/Ollivier was the next roadmap
stage; its subsequent implementation is recorded in the [Ollivier review](OLLIVIER_REVIEW.md).
The subsequent [flow review](FLOW_REVIEW.md) records the completed bounded
flow stage. Statistical comparison, persistence, higher-order and UI now follow
the [revised R0–R12 program](REVISED_ROADMAP.md).
