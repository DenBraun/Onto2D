# Material Process History — Implementation Report

Updated: 2026-08-19

## History Model Metadata

```text
History modes:
    Embodied
    Recorded

Primary effects:
    Present State

Domain:
    Materials science

Evidence profile:
    direct-record
    direct-measurement
    published-interpretation
    derived
    unknown

Historical Load:
    Not evaluated

History Equivalence:
    Possible

Reachability:
    Not primary

Reconstruction:
    Not primary
```

## Purpose

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

## Implemented Result

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

## Primary External Sources

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

## Outputs

```text
cases/material-process-history/
apps/material-process-history-lab/
models/material-process-history/
docs/cases/MATERIAL_PROCESS_HISTORY_IMPLEMENTATION.md
```

## Exact Benchmark Choice

The implementation uses `AMB2022-01`. It freezes NIST AM-Bench metadata
release `3.0.0` at repository commit
`77adb06c6de95b9b97e1dd26d46561f29db927af`, challenge-description DOI
`10.18434/mds2-2607`, and residual-strain result DOI `10.18434/mds2-2711`
version `1.1.1`.

The full 19,411,844-byte metadata ZIP, twelve selected XML records, residual
strain table, measurement-description PDF, generator, and generated projection
are bound by exact SHA-256 and byte counts. Canonical extraction, tests, Model
Pack compilation, and the Explorer perform no live network request.

## Phase 0 — Frozen Benchmark Evidence

The release records:

- AM-Bench challenge ID;
- NIST dataset DOI(s);
- exact downloaded files;
- hashes;
- specimen IDs;
- process parameter files;
- measurement files;
- extraction version;
- measurement units.

Do not rely on mutable NIST web presentation pages as the case identity.

## Phase 1 — Native Process Model

The release represents:

```text
AMBuild record
PBFLBAMBuildProcess record
P3 AMBuildPart record
shared nominal P3 recipe projection
P1 thermography record and TAM/SCR references
```

Recorded XML dates retain their source field names; they are not promoted to a
complete physical process chronology.

## Phase 2 — Measurement Model

The implemented measurement layer contains:

```text
P1 staring-camera thermography metadata
source-declared TAM and solid-cooling-rate artifact references
B7-P3 XX and ZZ residual elastic strain at 2,248 coordinates
```

Preserve:

- units;
- spatial coordinates;
- uncertainty;
- specimen identity;
- measurement technique.

Microstructure, grain size, phase state, residual stress, part deflection, and
mechanical behaviour are not selected results in this release. Their absence
is not converted to a value or synthetic score.

## Phase 3 — Process Provenance

The native relation chain is represented as:

```text
feedstock
    |
build / scan history
    |
as-built specimen
    |
separate P1 thermography record

B7 build
    |
B7-P3 comparison part
    |
CHESS residual-strain field
```

The XML `creationDate`, `startDate`, and `completeDate` fields retain their
source names. They are not promoted to a complete physical chronology.

## Phase 4 — Canonical Experiments

The first release implements four bounded experiments:

1. shared nominal material/recipe versus distinct native build and part IDs;
2. measurement coverage: B7-P3 resolved, B6-P3 and B8-P3 unknown;
3. spatial field: 2,248 coordinates and two strain components rather than one
   synthetic material-state scalar;
4. source anomaly preservation: repeated B6 `SCR_filename` literals in the B7
   and B8 XML records are disclosed rather than silently repaired.

Different scan strategies, microstructure comparison, heat treatment, and
multi-specimen residual-state comparison remain future releases. This release
does not imply that unavailable evidence exists.

## Phase 5 — Identity Regimes

Implemented:

```text
nominal-material identity
nominal-recipe identity
native build-record identity
native part-record identity
measured-state identity
```

No single regime is globally authoritative.

## Phase 6 — Evidence/Causality Firewall

Use relation types such as:

```text
processed-by
measured-after
measured-property
correlated-with
modelled-dependence
published-causal-interpretation
```

Do not turn:

```text
process A preceded property B
```

into:

```text
A necessarily caused B
```

without an explicit supported analysis.

## Phase 7 — Historical Load

Historical Load is `null` / `not-evaluated`. The selected source records do not
declare a finite universe of possible manufacturing histories, transition
costs, or a history-free counterfactual baseline. An undefined value is never
rendered as zero.

## Phase 8 — Model Pack

The registered Model Pack is:

```text
modelId: material-process-history
version: v1-0ea3ee56fe462eea
```

Its graph contains:

```text
1 source cohort
1 shared nominal recipe
3 build + 3 process + 3 P3 part records
3 thermography records + 6 derived thermal-product references
1 residual-strain measurement + 24 deterministic height slices
5 identity regimes + 4 interpretation boundaries
```

## Phase 9 — Explorer

Implemented views:

1. exact result metrics;
2. five-layer evidence chain;
3. shared nominal recipe;
4. native build/part and thermography inspector;
5. five identity regimes;
6. interactive XX/ZZ residual-strain map and exact height slices;
7. source-anomaly audit;
8. explicit Historical Load and interpretation boundaries.

The Explorer should make this distinction explicit:

```text
same nominal alloy
    !=
same process history
    !=
same measured material state
```

## Phase 10 — Negative Tests

Required:

- specimen IDs cannot be merged by nominal alloy name;
- measurement units must be preserved;
- missing spatial measurements stay missing;
- different techniques remain distinct;
- source or release mutation changes source/case identity;
- a causal audit promotion is rejected;
- source filename correction is rejected;
- Historical Load cannot be promoted to zero.

All are implemented as extractor, schema, compiler, and browser-model tests.

## Falsification Criterion

The case fails if Onto2D cannot connect process history to present measured state without either collapsing specimen identity or overstating causality.

## Definition of Done

A pinned AM-Bench cohort is reconstructed as an exact process/measurement
graph across three native histories/specimens, with explicit identity regimes,
coordinate-bearing measured state, source anomalies, and evidence-aware
relations that do not overstate causality.

## Reproduce and Verify

See [`cases/material-process-history/README.md`](../../cases/material-process-history/README.md)
for source preparation. Normal verification is offline:

```sh
npm run case:material-process-history:verify
npm run model:material-process-history:verify
node --test cases/material-process-history/tests/material-process-history.test.mjs
node --test models/material-process-history/compiler.test.mjs
node --test apps/material-process-history-lab/material-process-history-model.test.mjs
```
