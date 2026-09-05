# Operational Aging / NASA C-MAPSS FD001

This case is a source-locked, deterministic comparison of current observation
frames, recorded operational prefixes, and separately provided remaining-life
outcomes in NASA C-MAPSS FD001.

## Result

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

## Evidence boundary

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

## Reproduce

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

## Full-cohort History Matters preparation

The separate [benchmark preparation](history-benchmark/README.md) uses all 100
training and 100 test engines with a fixed training cutoff grid, isolated target
inputs and four prediction views. It is EVALUATION_READY, with test error
not-evaluated pending independent review. This does not upgrade the selected
25/72 illustration or change its frozen case artifact.
