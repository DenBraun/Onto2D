# Cell Lineage Identity — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Reconstructed
    Embodied

Primary effects:
    Identity
    Present State

Domain:
    Developmental biology

Evidence profile:
    direct-measurement
    sample-identity
    reconstructed
    published-interpretation
    unknown

Historical Load:
    Not primary

History Equivalence:
    Possible

Reachability:
    Not primary

Reconstruction:
    Primary
```

## Purpose

Use paired single-cell transcriptomic state and CRISPR lineage recording to test:

```text
current cell state
    !=
developmental lineage
```

and, more importantly:

```text
observed barcode
    !=
true complete lineage
```

This case is primarily about identity plus reconstruction uncertainty.

## Primary External Sources

scGESTALT publication:

```text
https://www.nature.com/articles/nbt.4103
```

Public source data:

```text
NCBI BioProject PRJNA414416
GEO GSE105010
```

Protocol reference:

```text
https://www.nature.com/articles/s41596-018-0058-x
```

The implementation must pin concrete downloaded files, not only accession numbers.

## Outputs

```text
cases/cell-lineage-identity/
apps/cell-lineage-identity-lab/
models/cell-lineage-history/
docs/cases/CELL_LINEAGE_IDENTITY_IMPLEMENTATION.md
```

## Key Distinctions

Represent separately:

```text
cell observation
transcriptomic state
cell-type annotation
observed lineage barcode
barcode edit state
reconstructed lineage node
reconstruction method
confidence/support
```

The reconstructed lineage is not direct observation of every cell division.

## Phase 0 — Bounded Dataset

Do not ingest every available cell initially.

Select a bounded cohort containing:

- one or a few zebrafish samples;
- cells with transcriptome and lineage barcode data;
- stable cell-type annotations;
- a published or reproducible lineage reconstruction;
- enough diversity to demonstrate convergence/divergence.

Freeze all files and hashes.

## Phase 1 — Cell State Model

Represent:

```text
CellRecord
ExpressionProfileRef
CellTypeAnnotation
BrainRegionAnnotation
Sample/FishIdentity
```

Avoid storing huge expression matrices directly in generic model records.

Use content-addressed external data artifacts plus bounded projections.

## Phase 2 — Barcode Model

Represent:

```text
BarcodeRecord
ObservedEdit
BarcodeIdentity
MissingBarcodeState
```

Keep raw/processed barcode evidence separate from inferred lineage.

## Phase 3 — Lineage Reconstruction

Represent:

```text
LineageTree
LineageNode
ParentAssignment
ReconstructionMethod
Support/Confidence
AlternativeAssignment
```

If the chosen published dataset gives a fixed reconstructed tree without per-edge probabilities, preserve that limitation rather than inventing confidence values.

## Phase 4 — Identity Regimes

Implement:

### Cell Observation Identity

Exact measured cell record.

### Transcriptomic State Similarity

Requires an explicit metric/profile and threshold.

Do not call similarity `identity` without a declared regime.

### Cell-Type Identity

Based on selected annotation labels.

### Barcode Identity

Observed lineage barcode state.

### Reconstructed Lineage Identity

Based on ancestry in the selected reconstruction.

## Phase 5 — Canonical Experiments

### Experiment A — Same Cell Type, Different Lineage

Identify cells with the same selected mature cell-type label but different reconstructed ancestry where supported by the dataset.

### Experiment B — Close Lineage, Different State

Find closely related cells assigned to divergent transcriptional/cell-type states where supported.

### Experiment C — State Similarity vs Lineage Distance

Plot bounded comparisons between expression/state similarity and lineage distance.

### Experiment D — Reconstruction Ambiguity

Where available, show ambiguous or incomplete barcode evidence.

## Phase 6 — Convergent / Divergent Differentiation

Use the domain concepts:

```text
convergent differentiation
divergent differentiation
```

only where supported by the selected data/publication.

Do not infer developmental convergence solely from matching cell-type labels.

## Phase 7 — Historical Load Policy

Do not compute Historical Load over developmental evolution in the first case.

The full possible lineage/state-transition space is not enumerated.

A later deliberately bounded developmental model may support such an analysis.

## Phase 8 — Model Pack

Potential:

```text
modelId: cell-lineage-history
```

Entities:

```text
cell
cell state
cell type
barcode
lineage node
lineage edge
reconstruction artifact
sample/fish
```

Large matrices stay external verified artifacts.

## Phase 9 — Explorer

Views:

1. Cell State Map
2. Lineage Tree
3. State vs Lineage Comparison
4. Same-Type / Different-Lineage Cohorts
5. Barcode Evidence
6. Reconstruction Status
7. Evidence Inspector

A useful linked interaction:

```text
select cells in state space
        ↓
highlight their positions in lineage tree
```

and the reverse.

## Phase 10 — Negative Tests

Required:

- similar transcriptomes cannot become exact identity silently;
- same cell type cannot imply shared ancestry;
- same barcode cannot be interpreted beyond the reconstruction method;
- missing barcode cannot become an inferred ancestor;
- reconstructed parent relation remains distinct from direct observation;
- analysis thresholds are versioned;
- sample/fish identities cannot leak across lineage trees.

## Falsification Criterion

The case fails if Onto2D cannot maintain independent representations of current cell state, lineage evidence, and reconstructed developmental history.

## Definition of Done

A pinned scGESTALT cohort can be reproduced with linked state and lineage views, including at least one reviewed same-state/type versus different-lineage comparison and explicit reconstruction limitations.
