# History Matters Benchmark

Status: implemented v0 pilot plus full-cohort FD001 preparation, 2026-09-05. Empirical evaluation and independent
review remain open. The [original proposal](proposals/HISTORY_MATTERS_BENCHMARK_DRAFT.md)
is retained as design input; this document describes the implemented scope.

The benchmark asks whether valid history adds task-relevant information beyond
a declared present representation. Every contrast fixes P (present), H
(admissible history), Y (target), a population, evaluator and metric before a
run. P0 uses P; P1 uses the same P plus H; N0 keeps P and reassigns H.

This is a separate analysis from Historical Load (construction cost under
admissibility constraints), History Equivalence (regime-relative equality),
reachability and reconstruction. Undefined Historical Load does not prohibit
a future History Matters evaluation.

## Proposal assessment and implementation decisions

The proposal's strongest contribution is the move from selected examples to
controlled, replayable comparisons that allow negative results. Its separation
of semantic sensitivity, predictive utility and experimental accessibility is
retained. A cross-domain average or global history score has no defined meaning
and is absent from both artifacts and the Explorer.

The 151-section draft also sketches several different releases. This change
implements its v0 infrastructure and initial semantic sub-suite, with a narrow
exact partition evaluator. A full ML framework, claim ladder implementation,
external evaluator execution, engine analysis registration and run-store
integration are deferred. The existing run-store persists closed kernel-run
bundles; forcing a benchmark into that envelope would alter the wrong boundary.
Standalone benchmark artifacts are replayable without that dependency.

Synthetic is an explicit claim class, so controls cannot count as semantic or
empirical evidence. The pilot metric is **pairwise error**, not just the number
of partitions: splitting every object is penalized when it separates a shared
target class. Negative and neutral controls therefore exercise real evaluator
behavior. The target labels of software cases are derived from declared
identity regimes and are visibly semantic, not independently observed outcomes.

## Implemented corpus

| Contrast | Claim/design | P0 errors | P1 errors | Verdict |
| --- | --- | --- | --- | --- |
| Synthetic path control | synthetic/control | 16/28 | 0/28 | positive |
| Synthetic irrelevant distinctions | synthetic/control | 0/28 | 12/28 | negative |
| Synthetic repeated history | synthetic/control | 0/28 | 0/28 | neutral-within-resolution |
| Git ancestry | semantic/exact | 6/15 | 0/15 | positive |
| OCI layer sequence | semantic/exact | 6/6 | 0/6 | positive |
| Reproducible-build toolchain | semantic/exact | 2/6 | 0/6 | positive |
| Operational Aging (EVALUATION_READY) | empirical/predictive preparation | — | — | not-evaluated |
| LTEE | empirical/experimental candidate | — | — | not-evaluated |

These results apply only to the declared census and equality evaluator. In OCI,
permuting unique histories preserves the partition: its null does not show that
correct correspondence adds utility. All null assignments and this limitation
are published. Git's complete census contains two final trees; equal-state
comparisons are pair-local rather than a claim that all six heads share a tree.

## Reproduce

```sh
npm run history-benchmark:goldens
npm run history-benchmark:test
npm run history-benchmark:check
```

The [Explorer](../../apps/history-matters-benchmark/index.html) verifies exact
payload bytes and replays results before rendering them. Registry membership
and maturity live in [a separate registry](../../cases/history-benchmark-registry.json);
result artifacts hold verdicts. No candidate is assigned zero for missing data.
Three compact synthetic checks introduce the method above five domain examples
and research candidates. Each shows its expected effect and actual errors;
full evidence is available in a disclosure. Filters and the example count apply
only to the domain section; the checks remain visible. The page explains its
local replay on each load, which does not train models or evaluate candidates.

See the [testing guide](HISTORY_BENCHMARK_TESTING.md) for the full acceptance
checklist and the explicit regeneration order after intentional source changes.

## Full-cohort predictive preparation

The [regression profile](HISTORY_REGRESSION_PREPARATION.md) adds a separate
numeric evaluator and six schemas without changing the closed kernel or the
exact semantic API. FD001 now includes all 100 training and 100 test engines,
972 training prefixes, four frozen prediction views and 16 history-null
preparations. Test RUL is not read by preparation or default checks. Independent
review remains pending; no empirical score or gain is published. The source
was previously analyzed, so this is not independent preregistration.

## Next milestones

1. Independently review the [frozen Operational Aging preparation](../../cases/operational-aging/history-benchmark/README.md),
   then verify and join held-out outcomes and publish the first score regardless
   of direction. Full-cohort views, unit-disjoint predictions, training-only
   normalization and an age baseline are now implemented; the old pair stays illustrative.
2. Formalize the [LTEE protocol plan](../../cases/ltee-evolutionary-contingency/history-benchmark-plan.md)
   without pooling unlike experiments or treating non-observation as impossibility.
3. Add independent contract/leakage review, an evaluated empirical contrast and
   clean replay on an exact release commit before claiming benchmark v1.
4. Extend external evaluators, uncertainty and source acquisition only with
   their own explicit contracts and evidence requirements.

The pilot is successful when it faithfully reports what the declared test can
resolve, including when history loses. It does not establish irreducibility,
causality, universal history utility or foundational validation of Onto2D.

See the [contract](HISTORY_BENCHMARK_CONTRACT.md),
[leakage model](HISTORY_BENCHMARK_LEAKAGE_MODEL.md) and
[review guide](HISTORY_BENCHMARK_REVIEW_GUIDE.md).
