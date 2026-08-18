# Material Process History — Implementation Plan

Updated: 2026-08-18

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
    Bounded candidate

History Equivalence:
    Possible

Reachability:
    Not primary

Reconstruction:
    Not primary
```

## Purpose

Use NIST additive-manufacturing benchmark data to test whether process history can remain physically encoded in present material structure and properties.

Primary relationship:

```text
process history
    -> thermal / mechanical history
    -> microstructure / residual state
    -> measured properties
```

The first implementation must not interpret this chain as universal causal necessity. It is a structured evidence model over controlled benchmark data.

## Primary External Sources

NIST AM-Bench:

```text
https://www.nist.gov/ambench
https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance
```

NIST Material Schemas ProcessHistory:

```text
https://pages.nist.gov/material-schema/ProcessHistory/
```

The NIST Material Schemas site labels the schema as draft/pre-alpha. Onto2D must therefore pin the exact schema version/source used and must not treat it as a stable standard.

## Outputs

```text
cases/material-process-history/
apps/material-process-history-lab/
models/material-process-history/
docs/cases/MATERIAL_PROCESS_HISTORY_IMPLEMENTATION.md
```

## Initial Benchmark Choice

Prefer one controlled AM-Bench cohort with:

- known processing parameters;
- multiple specimens or scan strategies;
- in-situ/thermal data;
- microstructure data;
- residual strain/stress or deflection data.

AMB2022-01 and AMB2022-02 are strong candidates. Select one after verifying downloadable data size and mapping effort.

## Phase 0 — Freeze Benchmark Evidence

Record:

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

Represent:

```text
Material / Specimen
ProcessStep
ControlledParameter
MeasuredVariable
Instrument / Technique
ProcessTime / Order
ResultingMaterialState
```

Where NIST ProcessHistory concepts are mapped, retain exact mapping metadata.

## Phase 2 — Measurement Model

Represent measurements independently:

```text
temperature / thermography
cooling rate
microstructure
grain size
phase state
residual strain
residual stress
part deflection
mechanical behavior
```

Preserve:

- units;
- spatial coordinates;
- uncertainty;
- specimen identity;
- measurement technique.

Do not merge different measurement modalities into a synthetic score.

## Phase 3 — Process History

Build an ordered process history:

```text
feedstock
    |
build / scan history
    |
as-built specimen
    |
optional heat treatment
    |
characterized specimen
```

Separate intended process protocol from measured process history where the data support the distinction.

## Phase 4 — Canonical Experiments

### Experiment A — Different Scan Strategy

Compare nominally similar material/specimen classes produced under different laser scan strategies.

### Experiment B — Process to Microstructure

Compare measured microstructure against recorded processing history.

### Experiment C — Process to Residual State

Compare residual strain/stress or deflection across selected histories.

### Experiment D — Heat Treatment

Compare as-built and heat-treated material states.

### Experiment E — Same Nominal Material, Different Present Properties

Demonstrate that nominal alloy identity does not determine full material state.

## Phase 5 — Identity Regimes

Implement:

```text
nominal-material identity
specimen identity
process-history identity
microstructure-state identity
measured-property profile identity
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

A bounded process-plan experiment may support Historical Load.

Possible finite constraints:

```text
required process steps
allowed scan strategies
maximum temperature
required heat treatment
allowed machine configuration
```

Possible costs:

```text
process-step-count
process-transition-count
thermal-cycle-count
```

Do not use energy, monetary cost, or manufacturing risk until explicit data and semantics exist.

## Phase 8 — Model Pack

Create:

```text
modelId: material-process-history
```

Entities:

```text
material
specimen
process step
parameter
measurement
microstructure state
property observation
instrument
evidence relation
```

## Phase 9 — Explorer

Views:

1. Process Timeline
2. Specimen Comparison
3. Thermal/Build History
4. Microstructure
5. Residual State / Properties
6. Identity Regimes
7. Evidence Inspector

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
- process order mutation changes process-history identity;
- correlation cannot satisfy an API requiring causal evidence;
- schema-draft version changes alter mapping identity.

## Falsification Criterion

The case fails if Onto2D cannot connect process history to present measured state without either collapsing specimen identity or overstating causality.

## Definition of Done

A pinned AM-Bench cohort can be reconstructed as an exact process/measurement graph and compared across at least two histories/specimens, with explicit identity regimes and evidence-aware process-to-property relationships.
