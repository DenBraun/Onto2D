# Cell Lineage Identity — Implementation

Updated: 2026-08-19

## History Model Metadata

```text
History modes:
    Reconstructed
    Embodied

Primary effects:
    Identity

Secondary effects:
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

## Implemented Release

Status: `ANALYSIS_READY`

The release pins NCBI GEO series `GSE105010`, sample `GSM2813984`
(`ZF1_scGSTLT`), the exact `GSE105010_RAW.tar` bytes, and its exact
`GSM2813984_ZF1.GestMaster.txt.gz` member. A standard-library generator
reproduces a complete bounded projection of all 750 source rows.

The verified result is:

```text
750 native cell-record classes
 56 numeric transcriptomic-cluster classes
192 exact reported ten-target HMID classes
133 exact first-four-target signature classes
 16 cells with explicit partial target coverage
  0 invented parent cells, divisions, or confidence values
```

The source table, projection generator, analysis profile, case artifact, Model
Pack, and browser artifact are all byte- or canonical-identity locked. The
Model Pack release is `cell-lineage-history@v1-6e6ea7be0f576db7` with 1,140
nodes and 2,450 edges. The dedicated explorer is
`apps/cell-lineage-identity-lab/`.

This release deliberately does not claim to reproduce the article's final
filtered two-stage PHYLIP topology. The released GestMaster member supports an
exact and useful regime comparison; the Onto2D first-four-target grouping is
therefore labelled as a bounded reconstruction rather than an observed cell
division or the published maximum-parsimony tree.

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

Do not ingest every available animal or expression matrix initially.

Select a bounded cohort containing:

- one source-identified zebrafish sample;
- cells with transcriptome and lineage barcode data;
- stable cell-type annotations;
- a reproducible, explicitly bounded lineage grouping;
- enough diversity to demonstrate convergence/divergence.

Freeze all files and hashes.

## Phase 1 — Cell State Model

The release represents:

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
ObservedBarcodeState
FirstFourTargetSignature
BoundedProjectionMethod
ReconstructionBoundary
PartialTargetCoverage
```

The source article documents a two-stage Camin-Sokal maximum-parsimony method,
but its historical interactive JSON endpoint is not imported into this
release. The release therefore creates no lineage-tree parent assignment and
no per-edge confidence. This is a result boundary, not missing UI state.

## Phase 4 — Identity Regimes

Implement:

### Cell Observation Identity

Exact measured cell record.

### Transcriptomic Cluster Identity

Uses exact numeric `ClusterIdent` membership from the source table. It is not a
pairwise expression-distance metric and is never promoted to exact biological
identity.

### Paper-Labelled Cell-Type View

Uses a biological label only for cluster numbers explicitly discussed in Raj
et al. All other clusters remain numeric source memberships.

### Barcode Identity

Observed lineage barcode state.

### Bounded Reconstructed Identity

Based on exact equality over HMID target positions 1-4. It is a
versioned grouping key and not a claim of complete ancestry.

## Phase 5 — Canonical Experiments

### Experiment A — Same Cell Type, Different Lineage

The artifact reports 7,058 unordered pairs in the same numeric transcriptomic
cluster but with different exact observed HMID states, with concrete source-row
examples. The result is phrased as state equality versus barcode-history
difference, not as proof of different true ancestry.

### Experiment B — Close Lineage, Different State

The artifact reports 22,967 unordered pairs with one exact observed HMID but
different numeric clusters. Shared HMID constrains interpretation but does not
prove one unique parent because barcode collisions and saturation remain
possible.

### Experiment C — State Similarity vs Lineage Distance

The explorer links cluster, observed HMID, and first-four-target-signature
layers. Target position is not treated as edit chronology. No
expression-distance or lineage-distance metric is invented from absent source
fields.

### Experiment D — Reconstruction Ambiguity

Sixteen cells with `OUT` target states remain explicitly partial and are never
imputed.

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

```text
modelId: cell-lineage-history
version: v1-6e6ea7be0f576db7
nodes: 1140
edges: 2450
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
2. Bounded Relation Map
3. State vs Lineage Comparison
4. Same-Type / Different-Lineage Cohorts
5. Barcode Evidence
6. Reconstruction Status
7. Evidence Inspector

A useful linked interaction:

```text
select a transcriptomic cluster
        ↓
inspect its observed HMIDs and first-four-target-signature groups
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

A pinned scGESTALT cohort is reproduced with all 750 source rows, four explicit
identity regimes, exact cross-regime pair counts, linked state/barcode/bounded
reconstruction views, and negative tests that reject invented ancestry,
confidence, imputation, or Historical Load.
