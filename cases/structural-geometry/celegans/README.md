# C. elegans functional response-ranking study

D5 applies the [frozen D3 protocol](../protocol/PROTOCOL.md) to Randi's processed
fluorescence export and the separate Dataset7 chemical anatomy. The complete
matched population contains **9 stimulated-source groups and 60 receiver pairs**.
The full geometric model decreases mean rank skill from **0.2852 to 0.0499**,
a paired difference of **−0.2353**. No observed gain is established for this
representation, learner and eligible population. Both the population's narrow
coverage and the negative result remain explicit.

## Population and exclusions

The source census retains 113 recording identities and all 5,808 native stimulus
rows. The 180-neuron anatomical parent supplies complete closed weak one-hop
chemical neighborhoods. All 29 scopes admitted by common provider preparation
are executed before model fitting; no signal value selects or truncates a graph.
Most anatomical roots exceed the bounded providers, so this is a selected
small-scope study, not evaluation of the entire connectome.

| Intake step | Count |
|---|---:|
| Native stimulus rows | 5,808 |
| Negative native target index | 1,198 excluded |
| Source label absent from anatomy | 694 excluded |
| Ambiguous source label | 95 excluded |
| Unidentified or marked source label | 1,162 excluded |
| Root outside common provider preparation | 2,458 excluded |
| Incomplete/contaminated event window | 3 excluded |
| Events retained by mapping, scope and timing | 198 |
| Mapped receiver windows, 60+60 samples each | 640 |
| Receiver windows with nonpositive baseline | 12 excluded |
| Measured receiver trial magnitudes | 628 |
| Recording/source/receiver medians with a measured value | 480 |
| Source/receiver pairs with any measured recording median | 95 |
| Pairs with at least two measured recording medians | 69 |
| Pairs in groups with at least three qualified receivers | 60 in 9 groups |

The event exclusion categories are disjoint and sum with the 198 retained events
to 5,808. Receiver counts are conditional on those events and are not independent
trials or neurons. The receiver ledger records 27,069 rows: 25,215 excluded trace
columns, 640 requested windows and 1,214 explicit absent-column observations.
The latter are unobserved, never measured zeros. All 42 trailing blank label
slots without trace columns remain separately accounted for.

All 76,800 selected samples are finite in the export; this does not establish
their original acquisition quality. The source archive contains residual NaNs
outside this selected sample set, and finite exported values may already have
been interpolated upstream. The 12 nonpositive baselines remain not applicable.
No measured zero contrast occurs here; synthetic controls verify its retention.

The full anatomical candidate ledger has 3,338 source/receiver positions.
Of those, 3,192 have no trial rows under the accepted event/scope rules. There
are 1,854 retained trial rows including unavailable receiver columns, 1,429
recording/source/receiver aggregates and 146 source/receiver aggregates including
unavailable-only pairs. These counts are different levels of the same data,
not additional observations for inference.

## Results

The predictor ranks absolute `(mean(post) − mean(baseline)) / mean(baseline)`
within the stimulated-source group, after median aggregation within and across
recordings. Each eligible group receives equal weight despite having 4–13
receivers. Every outer fold holds out one source neuron across all recordings;
its eight training sources supply inner leave-one-source-out validation.

| Predictor | Mean held-out rank skill |
|---|---:|
| B: 23 graph-only features | 0.2852 |
| B+F: add Forman | 0.2351 |
| B+O: add Ollivier | 0.0985 |
| B+flow: add terminal flow | 0.2376 |
| B+F+O | 0.2563 |
| B+F+O+flow: all 54 features | 0.0499 |
| Fixed four-step propagation | −0.1074 |

The sole primary comparison is full minus B on the same 60 rows. It improves on
two sources, ties on one and decreases on six. No declared augmentation exceeds
B's equal-source mean on this population. All six ablations, five tuning
candidates per fold, selected penalties, Spearman/Kendall metrics and paired
comparisons are retained in the [machine report](results.json).

| Held-out source | Receivers | B | Full | Difference |
|---|---:|---:|---:|---:|
| AFDL | 6 | 0.6000 | 0.7333 | +0.1333 |
| ASGL | 4 | 0.3333 | 0.3333 | 0.0000 |
| ASJL | 4 | 0.3333 | −0.3333 | −0.6667 |
| IL1DR | 7 | 0.2857 | −0.2381 | −0.5238 |
| IL2DR | 8 | −0.1429 | −0.4286 | −0.2857 |
| RMEL | 13 | 0.2051 | 0.1923 | −0.0128 |
| SAAVL | 7 | 0.1429 | −0.1429 | −0.2857 |
| URADL | 7 | −0.1905 | 0.0000 | +0.1905 |
| URADR | 4 | 1.0000 | 0.3333 | −0.6667 |

Leaving one source out of the final paired-difference average gives
[−0.2885, −0.1814]. This is descriptive aggregation sensitivity, not a confidence
interval or another set of model fits. Rank skill is an ordering score in
[−1,1], not accuracy: constant predictions on nonconstant targets score zero.
Undefined secondary metrics retain null and their reasons.

These are held-out-source associations on one anatomy. Receivers and recordings
can be shared across folds, anatomical and functional animals differ, and the
data does not establish an animal-ID map. The original missingness mask,
target-hit/auto-response flags, label confidence and source-quality controls are
absent. The adapted contrast cannot reproduce the paper's q-values, certify
successful stimulation or establish causal transmission. The geometric features
are functions of the same graph and add no information beyond that complete
graph. D6 tests the declared sensitivity and stronger-baseline/capacity controls;
these primary results are not retuned or replaced after inspection.

## Verification and reproduction

Every admitted scope receives source-bound Forman, Ollivier and flow receipts
verified against its exact Model Pack and frozen request. The 2,056 ordered pair
descriptors cover the complete scoped graphs; only the declared source/eligible
receiver pairs enter prediction. Five flows reach an actual fixed point, including
the eligible RMEL scope; 24 stop at the four-update limit. Actual terminal states
and stopping reasons are retained, with no invented continuation or convergence
claim at the limit.

The independent Python reference reconstructs all native event decisions and
receiver exclusions, rereads the archive with a separate column/sample selector,
and compares all 76,800 samples exactly. Fraction means and separate medians
verify signal eligibility and target ranks. Bellman-Ford and predecessor
backtracking verify pair geometry; the independent D4 graph-baseline and
joint-intercept Gaussian solver verify all 1,134 distinct fits covering 2,214
nested fit requests and 14,760 predictions. Numerical comparisons use
`2e-10 * max(1, abs(reference))`; target ranks and evaluation ties use exact
binary64 comparisons without a tolerance. Separate code is not external review.

```sh
# Offline bindings, report arithmetic, mutation and synthetic/reference controls.
npm run structural-geometry:celegans:check

# Full locked archive scan, fresh geometry, models and independent verification.
npm run structural-geometry:celegans:replay

# Explicitly regenerate the derived report after reviewing implementation changes.
npm run structural-geometry:celegans:build
```

Full replay requires the [D2 source workflow](../datasets/README.md) and compares
every scientific field and local artifact hash exactly. Only explicitly pinned
runtime metadata may differ under the
[compatibility policy](../../../docs/DEVELOPMENT.md#frozen-inputs-and-deliberate-regeneration).
Normal tests/builds require no downloaded corpus;
they verify bindings, arithmetic and synthetic controls. Insufficient source
groups or a required numerical failure leaves the primary unavailable with a
reason. Integrity errors abort rather than publish partial evidence.

The ignored `cache/details.json` retains every native event, column mapping,
receiver exclusion, selected sample, contrast, median, candidate pair, scope,
certificate, fold, fitted model and prediction. Its hash is in the report.
The committed report contains source hashes, group-level coverage and metrics;
it does not bundle raw fluorescence, anatomical edge tables or a website fixture.
Source redistribution terms remain governed by the [source lock](../datasets/source-lock.json).

[Observed costs](costs.json) are outside semantic identity. They separate source
preparation, per-root geometry, archive extraction, response preparation,
per-ablation/per-source fitting and inference, and independent verification.
Node cumulative peak RSS and phase-end samples are distinguished from the two
Python process peaks; geometry solver subprocess peaks are not measured.
Source acquisition and D2 native adaptation are outside these D5 measurements.

D5 is complete. [D6 robustness](../robustness/README.md) now includes constrained
nulls and the separate Dataset8 anatomy sensitivity. The latter is unavailable
under the fixed arithmetic and shared-population gates; it preserves these
Dataset7 results. D6.3 graph-feature/capacity controls are complete: expanded
graph context raises rank skill to 0.3942, while appending geometry lowers it
to 0.2784 on the same 60 targets. These are separate secondary results. D6.4's
five parameter variants are also complete; geometry stays below both respective
graph-only baselines in every variant. D6.5 verifies all rooted scope choices and
parent-degree coverage: none of Dataset7's five low-degree nodes enters the
primary target pairs. The 35-pair incoming-scope comparison has population- and
baseline-dependent signs; other alternatives remain unavailable. The
[D7 laboratory](../../../apps/structural-geometry-lab/README.md) presents all
these outcomes. A positive result is not required for publication.
