# Material Process History

Case ID: `material-process-history`. [History case registry](../history-case-registry.json).

- [Material Process History — use and reproduction](#material-process-history--use-and-reproduction)
- [Material Process History — source and interpretation](#material-process-history--source-and-interpretation)

<a id="material-process-history--use-and-reproduction"></a>

## Material Process History — use and reproduction

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

<a id="material-process-history--use-and-reproduction--exact-source-release"></a>

### Exact source release

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

<a id="material-process-history--use-and-reproduction--evidence-discipline"></a>

### Evidence discipline

Prescribed process values are not observed machine trajectories. The P1
thermography records and their TAM/SCR artifact references are not the P3
residual-strain measurement. Association is not promoted to causality.

The official B7 and B8 thermography XML records repeat the B6 filename in their
`SCR_filename` fields while publishing different DOI values. This source
literal remains visible; Onto2D does not silently invent corrected filenames.

<a id="material-process-history--use-and-reproduction--historical-load"></a>

### Historical Load

Historical Load is `null` / `not-evaluated`. AM-Bench does not declare a finite
universe of possible manufacturing paths, transition costs, or a history-free
counterfactual baseline. Undefined is never rendered as zero.

<a id="material-process-history--use-and-reproduction--reproduce-and-verify"></a>

### Reproduce and verify

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

<a id="material-process-history--source-and-interpretation"></a>

## Material Process History — source and interpretation

<a id="material-process-history--source-and-interpretation--purpose"></a>

### Purpose

Use NIST additive-manufacturing benchmark data to test how recorded process
identity and present measured-material evidence can coexist without collapsing
specimen identity or overstating causality.

Primary relationship:

```text
source-declared build and process records
    -> native build and part identities
    -> separately attributed P1 thermography records

B7-P3 part identity
    -> published CHESS residual-strain field
```

The implemented release does not empirically compare present material state
across all three histories: only B7-P3 has a selected residual-strain result.
It is a structured evidence model over a bounded cohort, not a causal process-
property study.

<a id="material-process-history--source-and-interpretation--implemented-result"></a>

### Implemented Result

The exact release is `material-process-history@v1-0ea3ee56fe462eea`:

```text
3 native AMBuild records: B6, B7, B8
3 native comparison parts: B6-P3, B7-P3, B8-P3
1 exact projected nominal P3 recipe
3 separate P1 thermography records
2,248 CHESS residual-strain coordinates for B7-P3
24 reproducible height-slice summaries
54 Model Pack nodes / 68 Model Pack edges
0 copied sibling measurements / 0 generated causal edges
```

The key result is regime-relative. The selected parts form one class under
nominal material and one class under the exact nominal recipe projection. They
form three classes under native build identity and three under native part
identity. Under measured-state evidence, B7-P3 has one resolved field while
B6-P3 and B8-P3 remain unknown.

<a id="material-process-history--source-and-interpretation--primary-external-sources"></a>

### Primary External Sources

NIST AM-Bench:

```text
https://www.nist.gov/ambench
https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance
https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems
https://github.com/usnistgov/ambench/tree/77adb06c6de95b9b97e1dd26d46561f29db927af
https://doi.org/10.18434/mds2-2607
https://doi.org/10.18434/mds2-2711
```

NIST Material Schemas ProcessHistory:

```text
https://pages.nist.gov/material-schema/ProcessHistory/
```

The NIST Material Schemas site labels the schema as draft/pre-alpha. It is
background context, not an authority used to manufacture fields in this
release. The exact AM-Bench XML and projection generator remain authoritative.

<a id="material-process-history--source-and-interpretation--exact-benchmark-choice"></a>

### Exact Benchmark Choice

The implementation uses `AMB2022-01`. It freezes NIST AM-Bench metadata
release `3.0.0` at repository commit
`77adb06c6de95b9b97e1dd26d46561f29db927af`, challenge-description DOI
`10.18434/mds2-2607`, and residual-strain result DOI `10.18434/mds2-2711`
version `1.1.1`.

The full 19,411,844-byte metadata ZIP, twelve selected XML records, residual
strain table, measurement-description PDF, generator, and generated projection
are bound by exact SHA-256 and byte counts. Canonical extraction, tests, Model
Pack compilation, and the Explorer perform no live network request.

<a id="material-process-history--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot connect process history to present measured state without either collapsing specimen identity or overstating causality.

<a id="material-process-history--source-and-interpretation--reproduce-and-verify"></a>

### Reproduce and Verify

See [`cases/material-process-history/README.md`](#material-process-history--use-and-reproduction)
for source preparation. Normal verification is offline:

```sh
npm run case:material-process-history:verify
npm run model:material-process-history:verify
node --test cases/material-process-history/tests/material-process-history.test.mjs
node --test models/material-process-history/compiler.test.mjs
node --test apps/material-process-history-lab/material-process-history-model.test.mjs
```
