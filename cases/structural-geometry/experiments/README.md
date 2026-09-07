# Stage 3: typed and local-weight experiments

Status: reproducible descriptive experiments; no default metric promotion.
Date: 2026-09-06.

The full Causal Emergence source lock from the foundation is reused unchanged.
[suite.json](suite.json) freezes 72 exact experiment hashes and summaries:
two metrics across all edges, four necessity regimes, seven role subsets and
24 observed dictionary-code channels (13 dependency types, 5 interaction modes
and 6 causal directions). All 249 nodes remain in every run. Channel membership
can overlap and is never pooled into an aggregate score.

Each full experiment is recomputed and hash-checked separately by the builder;
the suite avoids duplicating all per-edge results for every selection. The
[full weighted artifact](weighted-full.json) and
[source weight audit](weight-audit.json) are also frozen in full. The builder
never rewrites the original source lock, unit artifacts or source Model Pack.

```sh
npm run structural-geometry:experiments:check
npm run structural-geometry:experiments:report
```

The first command verifies all 72 runs, the six necessity transitions, frozen
Python reference controls and the focused API/schema tests. The second prints
a verified comparison table. Both are read-only. Regeneration is explicit with
`npm run structural-geometry:experiments:build`; inspect the resulting diff.
To regenerate only reference arithmetic controls, use
`python3 cases/structural-geometry/experiments/reference.py --write`.

## What the current result says

| Necessity endpoint | Edges | Strong components | Nodes in directed cycles |
|---|---:|---:|---:|
| necessary | 613 | 244 | 8 |
| + enabling | 863 | 223 | 29 |
| + contextual | 958 | 214 | 38 |
| + optional | 971 | 214 | 38 |

These connectivity counts are shared by both metrics, since changing lengths
does not change which edges the selection contains. Every regime remains one
weak component and has no isolated nodes in this particular source snapshot.
In other models, isolated nodes remain visible and are counted explicitly.

Incoming source weights sum to 0.9 at `0.18`, 1.9 at `0.2`, and 0.9 at `0.9`.
All current weights fall inside the experimental positive-weight bounds. The
inverse-share hypothesis normalizes in a separate full-source metric context;
it does not repair these findings in source data or re-normalize each filtered
graph. In the full graph, 491 edge curvatures are lower than the unit baseline,
479 higher and one equal. This is sensitivity to a metric hypothesis, not proof
of increased robustness or usefulness. Unit remains the default.

## Controls and precision

[controls.json](controls.json) supplies typed diamond, exact-root, irrational
feedback, non-unit-sum and isolated-node controls. The separate
[Python reference](reference.py) uses Fraction arithmetic and Decimal square
roots at 100 digits; [expected.json](expected.json) freezes its outward bounds.
The JavaScript runtime uses BigInt integer square roots. Tests compare both
implementations across filtered selections and the complete weighted graph.
These are separate implementations in the repository, not independent review.

Curvature values are intervals in integer ticks, where one tick is 10^-12.
`lowerTicks`/`upperTicks` are decimal strings. An interval touching zero is not
declared positive or negative unless its entire range permits that conclusion;
exact [0,0] is distinguished from unresolved sign. They are computational bounds
under the declared metric, not confidence intervals or measured precision.

Read the [experiment contract](../../../docs/structural-geometry/GEOMETRY.md#typed-filtration-and-local-weight-experiments)
for selection, normalization, arithmetic, identity and resource limits.
