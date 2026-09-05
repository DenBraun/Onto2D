# FD001 full-cohort History Matters preparation

Status: **EVALUATION_READY**, with held-out performance **not-evaluated** and
independent protocol review pending. This is a new retrospective protocol; the
existing repository already exposes the supplied outcomes in its old endpoint
analysis. It is not a claim of independent preregistration or an unseen dataset.

The exact [NASA archive](https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data)
matches the pre-existing `upstream.json` SHA-256. This directory preserves only
its FD001 training and test observation members as deterministic gzip snapshots.
The held-out RUL member is not extracted or read by this preparation pipeline.
Source licensing and attribution remain as recorded in the existing upstream lock.

## Frozen population and views

All 100 training engines contribute prefixes at cycles 20, 40, 60, and so on,
strictly before their terminal observation: 972 training examples. All 100 test
engines contribute their last observed frame, without selection by RUL. The
source census is 20,631 training and 13,096 test rows. Engine IDs are explicitly
namespaced by the source's disjoint train/test populations.
If a cutoff amendment leaves any training engine without an eligible prefix,
the compiler rejects the run instead of silently shrinking the full cohort.

| View | Information |
| --- | --- |
| P0 | Three current settings and 21 current sensors |
| P1 | P0 plus the mean of up to 20 preceding frames, excluding the current frame |
| P0Age | P0 plus observed cycle age |
| P1Age | P1 plus observed cycle age |

The first training cutoff has 19 prior frames; the declared short-history policy
uses all available prior frames. There is no zero padding. No latent health or
future test sensor record is assumed. Recorded sensor history is a proxy for
embodied degradation, matching the existing case taxonomy.

Ranges are fit to the training-prefix features only. Zero-range channels have
zero distance contribution; test values are not clipped to training ranges.
Seventeen of 24 current channels and 17 history channels vary in training;
observed age also varies. Feature order is fixed by the source column contract.

For each test endpoint and each view, squared Euclidean distance selects the
nearest prefix of each training engine, then the nearest five **different**
engines. Exact distance ties use sample ID order. Their RUL labels are averaged
without weighting or a RUL cap. This is a transparent reference method, not a
state-of-the-art prognostics model.

Sixteen deterministic hash-priority permutations reassign test history within
the single declared FD001 population. Current features, age, training records,
normalization and fitted labels stay fixed. These are diagnostic controls;
exchangeability, causal inference and statistical significance are not claimed.

## Reproduce

Normal preparation and verification are offline:

```sh
npm run history-benchmark:aging:verify
npm run history-benchmark:aging:test
npm run history-benchmark:check
```

After intentional protocol or compiler changes, regenerate preparation with
`npm run history-benchmark:aging:prepare`, then refresh the dependent pilot with
`npm run history-benchmark:reference`. Verification itself never regenerates
fixtures. See the [testing guide](../../../docs/history/HISTORY_BENCHMARK_TESTING.md).

To recapture observations from an explicitly supplied exact archive:

```sh
python3 cases/operational-aging/history-benchmark/capture-source.py --archive /absolute/path/CMAPSSData.zip --verify
```

Omitting `--verify` intentionally regenerates the two compressed observation
members. The capture verifies archive/member hashes before writing. It never
extracts the held-out targets. The normal compiler verifies the decompressed
member hashes against the existing upstream lock.

`dataset.json` freezes source-prefix identities, cutoffs, separate P/H vectors
and split membership. `training-targets.json` joins supervised labels afterward.
`contract.json` binds these inputs, source/compiler identity, protocol and the
regression implementation. `expected/preparation.json` freezes all four sets of
predictions, nearest neighbors, training ranges and null assignments.
`readiness.json` exposes only preparation status and counts, never test error.

The [protocol](protocol.json) fixes MAE as primary, RMSE as secondary, a one-cycle
resolution and the age sensitivity comparison. No confidence interval is
implemented. The generic scorer exists and is tested on synthetic outcomes;
this case has deliberately not invoked it on NASA test outcomes. A reviewer must
inspect the exact protocol, source identity, split, feature construction and
prior outcome exposure before the first case-level scoring step. Source target
bytes must then be checked against the frozen RUL hash before target extraction.

Do not regenerate selected views or change the metric after scoring without
creating a new contract identity and recording the amendment.
