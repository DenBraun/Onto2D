# Operational Aging

Case ID: `operational-aging`. [History case registry](../history-case-registry.json).

- [Operational Aging — use and reproduction](#operational-aging--use-and-reproduction)
- [Operational Aging — source and interpretation](#operational-aging--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="operational-aging--use-and-reproduction"></a>

## Operational Aging — use and reproduction

This case is a source-locked, deterministic comparison of current observation
frames, recorded operational prefixes, and separately provided remaining-life
outcomes in NASA C-MAPSS FD001.

<a id="operational-aging--use-and-reproduction--result"></a>

### Result

Among all 4,950 unordered pairs of the 100 test endpoints, units 25 and 72 are
ranked 78th by training-normalized RMS distance over the two varying operating
settings and 15 non-constant sensor channels. Their current-frame distance is
`0.082125416271`, while NASA supplies RUL outcomes of 145 and 50 cycles.

The pair was chosen by maximizing the RUL gap inside the nearest five percent
of current-frame pairs. It is therefore outcome-aware and selection-biased. It
is a bounded demonstration, not an evaluation of a predictor.

Adding recorded history changes the context: the pair ranks 1,439th using the
last-20-cycle mean and 1,072nd using each complete observed-prefix mean. Those
descriptors are derived summaries, not direct observations of latent health.

<a id="operational-aging--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

- Current-frame distance uses settings and sensors only.
- Unit ID, cycle, observed-history length, future rows, and provided RUL are
  excluded from current-frame input.
- The two committed histories contain cycles 1–48 and 1–131 exactly; no future
  row is supplied or synthesized.
- Provided RUL is a held-out outcome, not a prediction.
- FD001 has one documented operating condition and one fault mode. The result
  does not automatically generalize to FD002–FD004.
- Historical Load and history equivalence are not evaluated and remain `null`
  or explicitly out of scope rather than being reported as zero.

The NASA source page does not specify a license. The repository records that
fact and commits compact derived projections, not the full upstream archive.

<a id="operational-aging--use-and-reproduction--reproduce"></a>

### Reproduce

With an extracted copy of the exact source archive:

```sh
node cases/operational-aging/prepare-source.mjs --source-dir /absolute/path/to/CMAPSSData
node cases/operational-aging/extract.mjs
node --test cases/operational-aging/tests/operational-aging.test.mjs
```

Verify the committed artifact and Model Pack:

```sh
npm run case:operational-aging:verify
npm run model:operational-aging:verify
```

<a id="operational-aging--use-and-reproduction--full-cohort-history-matters-preparation"></a>

### Full-cohort History Matters preparation

The separate [benchmark preparation](history-benchmark/README.md) uses all 100
training and 100 test engines with a fixed training cutoff grid, isolated target
inputs and four prediction views. It is EVALUATION_READY, with test error
not-evaluated pending independent review. This does not upgrade the selected
25/72 illustration or change its frozen case artifact.

<a id="operational-aging--source-and-interpretation"></a>

## Operational Aging — source and interpretation

<a id="operational-aging--source-and-interpretation--implemented-result"></a>

### Implemented Result

The exact NASA archive is locked at
`sha256:74bef434a34db25c7bf72e668ea4cd52afe5f2cf8e44367c55a82bfd91a5a34f`.
The case consumes and independently locks `train_FD001.txt`, `test_FD001.txt`,
`RUL_FD001.txt`, `readme.txt`, and the source method paper. The deterministic
projection contains all 100 test endpoints plus complete observed prefixes for
the selected test units 25 and 72.

Across all 4,950 unordered endpoint pairs, units 25 and 72 rank 78th under the
declared training-normalized current-frame RMS profile. NASA supplies 145 and
50 remaining cycles for those endpoints, a 95-cycle difference. The pair is
selected using the outcome inside the nearest five percent and is therefore
explicitly selection-biased, not a predictor evaluation.

History changes the comparison context: the same pair ranks 1,439th under the
last-20-cycle mean and 1,072nd under the complete observed-prefix mean. These
are derived descriptors, not observations of latent health. The release trains
no predictor; Historical Load and history equivalence are not evaluated.

<a id="operational-aging--source-and-interpretation--purpose"></a>

### Purpose

Use NASA C-MAPSS run-to-failure engine trajectories to test a clean form of
embodied historical state:

```text
operational history
    -> latent degradation
    -> current measurements
    -> remaining useful life
```

Primary distinction:

```text
similar current observation
    !=
same historical state
    !=
same future lifetime
```

<a id="operational-aging--source-and-interpretation--primary-external-source"></a>

### Primary External Source

NASA Open Data:

```text
https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data
```

The dataset contains multiple engine time series, operational settings, sensor
measurements, run-to-failure training trajectories, and Remaining Useful Life
targets for test trajectories.

Use the downloadable C-MAPSS dataset, not the currently unavailable C-MAPSS
simulator package.

Optional later source:

NASA Prognostics Center of Excellence fatigue/crack-growth datasets.

<a id="operational-aging--source-and-interpretation--initial-dataset"></a>

### Initial Dataset

Start with:

```text
FD001
```

because it has one operating condition and one fault mode.

Only move to FD002–FD004 after the history semantics are verified.

<a id="operational-aging--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot represent the difference between an observation
frame and a trajectory-conditioned state, or if it requires latent degradation
to be directly observed.

<a id="evidence-contract"></a>

## Evidence contract

The Operational Aging case and `operational-aging` Model Pack keep five layers
independent:

1. the current frame contains settings and sensor values only;
2. the recorded history contains ordered observed-prefix rows only;
3. history-window means are derived descriptors, not latent health;
4. NASA-provided RUL is a held-out outcome and never a distance input;
5. prediction remains explicitly not evaluated.

The flagship pair is selected by maximizing the provided-RUL difference inside
the nearest five percent of all current-frame pairs. Every surface therefore
labels the result outcome-aware and selection-biased. Declared nearness creates
no exact state identity. Historical Load remains `null`, because FD001 supplies
no finite alternative-history space, admissibility rule, route cost, or
baseline route.
