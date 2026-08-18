# Reproducible Builds Equivalence — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Identity

Domain:
    Build reproducibility

Evidence profile:
    direct-record
    derived
    counterfactual

Historical Load:
    Not primary

History Equivalence:
    Primary

Reachability:
    Not primary

Reconstruction:
    Not primary
```

## Purpose

Prevent Onto2D from adopting the false rule:

```text
different history => different identity
```

This case introduces explicit historical equivalence.

Primary concept:

```text
H1 ~F H2
```

where two build histories are equivalent under declared regime `F`.

## Outputs

```text
cases/reproducible-build-equivalence/
apps/history-equivalence-lab/
docs/cases/REPRODUCIBLE_BUILD_EQUIVALENCE_IMPLEMENTATION.md
```

A dedicated Model Pack is optional until the bounded experiments stabilize.

## Phase 0 — Select a Tiny Reproducible Fixture

Use a small build whose full inputs can be pinned.

Record:

- source tree;
- build instructions;
- toolchain identity;
- environment inputs;
- output artifact;
- build metadata.

The fixture must support at least two independent executions.

## Phase 1 — Capture Build Executions

Represent each execution as a separate historical instance even when output
bytes match.

Capture, where available:

```text
source identity
declared environment
toolchain
builder/machine profile
execution timestamp
output digest
build metadata
```

Do not make machine-local incidental values identity-relevant by default.

## Phase 2 — Equivalence Regimes

Implement explicit regimes:

### Byte Output Equivalence

```text
digest(outputA) == digest(outputB)
```

### Declared Input Equivalence

Compare declared source and build inputs.

### Toolchain Equivalence

Compare selected toolchain identity fields.

### Environment Equivalence

Compare a declared normalized environment profile.

### Provenance Equivalence

Require selected provenance records to match.

A pair may be equivalent under one regime and distinct under another.

## Phase 3 — Experiments

### Experiment A — Different execution, same bytes

Flagship case.

### Experiment B — Different machine, same bytes

Where practical, run in two isolated environments or use frozen recorded
fixtures if cross-machine execution is unavailable.

### Experiment C — Environment mutation, same bytes

Change an environment value irrelevant to output.

### Experiment D — Environment mutation, changed bytes

Change an identity-relevant build input.

### Experiment E — Regime matrix

For the same pair show:

```text
byte-equivalent: yes
input-equivalent: yes/no
toolchain-equivalent: yes/no
provenance-equivalent: yes/no
```

## Phase 4 — History Equivalence Artifact

Define an analysis artifact containing:

- history A identity;
- history B identity;
- equivalence regime;
- compared fields;
- normalization profile;
- result;
- evidence.

Do not put a global equivalence relation in the kernel.

## Phase 5 — Explorer

Main view:

```text
BUILD A              BUILD B
   \                  /
    \                /
     equivalence regime
            |
          result
```

Controls:

```text
[Byte]
[Inputs]
[Toolchain]
[Environment]
[Provenance]
```

Show exact fields causing divergence.

## Phase 6 — Relation to Historical Load

Do not conflate:

```text
cost of admissible history
```

with:

```text
equivalence of histories
```

Two histories can have different costs and still be equivalent under a selected
identity regime.

This distinction should be explicit in tests and documentation.

## Phase 7 — Negative Tests

Required:

- different executions remain distinct historical records;
- byte equality does not force provenance equality;
- selected normalization rules are explicit and versioned;
- adding an irrelevant field cannot silently alter a regime that excludes it;
- changing a regime-relevant input changes the result;
- no global "history identity" is inferred from one regime.

## Falsification Criterion

The case fails if Onto2D treats every execution difference as identity-relevant
or cannot support regime-relative equivalence.

## Definition of Done

Two or more independent build histories can be compared under multiple explicit
equivalence regimes, with the same pair legitimately equal under one regime
and different under another.
