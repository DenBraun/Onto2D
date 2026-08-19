# Material Process History

This case freezes a bounded NIST AM-Bench 2022 cohort and asks what exact
manufacturing records add beyond nominal alloy and recipe identity:

```text
NIST source record
  -> prescribed LPBF process
  -> native build and part identity
  -> separately attributed in-situ thermography
  -> separately attributed ex-situ residual-strain field
  -> Onto2D identity-regime analysis
```

The selected B6, B7, and B8 P3 parts share the same projected nominal IN718
recipe. They still retain three build identities and three part identities.
The published CHESS field contains 2,248 coordinate-bearing XX and ZZ residual
elastic strain measurements for B7-P3 only. Missing B6-P3 and B8-P3 fields stay
unknown.

## Exact source release

The projection is locked to:

- NIST AM-Bench metadata release `3.0.0` at commit
  `77adb06c6de95b9b97e1dd26d46561f29db927af`;
- metadata release ZIP SHA-256
  `0e2f673d6be7b700a9e14e461fab78a6372b9472ba230ff22c638dadee822d8c`;
- challenge-description DOI `10.18434/mds2-2607`;
- residual-strain result DOI `10.18434/mds2-2711`, PDR version `1.1.1`;
- twelve selected XML files, the result table, the measurement-description
  PDF, generator, and generated source projection by exact byte hash.

The normal case, Model Pack, and Explorer builds are entirely offline.

## Evidence discipline

Prescribed process values are not observed machine trajectories. The P1
thermography records and their TAM/SCR artifact references are not the P3
residual-strain measurement. Association is not promoted to causality.

The official B7 and B8 thermography XML records repeat the B6 filename in their
`SCR_filename` fields while publishing different DOI values. This source
literal remains visible; Onto2D does not silently invent corrected filenames.

## Historical Load

Historical Load is `null` / `not-evaluated`. AM-Bench does not declare a finite
universe of possible manufacturing paths, transition costs, or a history-free
counterfactual baseline. Undefined is never rendered as zero.

## Reproduce and verify

Rebuilding the projection requires the unpacked official metadata release and
two small files from DOI `10.18434/mds2-2711`:

```sh
python3 cases/material-process-history/prepare-source.py \
  /path/to/3.0.0_2026-05-05_data-release/xml \
  /path/to/AMB2022_EDD_results_V2.txt \
  '/path/to/AMB2022-01-RS-PD measurement results_v1.1.pdf' \
  cases/material-process-history/source/ambench-2022-01-material-process.json
```

Normal repository verification is offline:

```sh
npm run case:material-process-history:verify
node --test cases/material-process-history/tests/material-process-history.test.mjs
```
