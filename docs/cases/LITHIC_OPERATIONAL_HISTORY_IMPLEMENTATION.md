# Lithic Operational History — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Reconstructed

Primary effects:
    Present State

Domain:
    Archaeology

Evidence profile:
    direct-measurement
    published-interpretation
    reconstructed
    counterfactual
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

Use archaeological lithic refitting to test the inverse historical problem:

```text
present material traces
        ↓
candidate past operations
        ↓
evidence-constrained reconstruction
```

Unlike the other cases, the original operational history is not directly recorded.

The central Onto2D challenge is therefore reconstruction under incomplete evidence.

## Primary External Source

ReViBE replication dataset:

```text
DOI: 10.34810/DATA924
https://dataverse.csuc.cat/dataset.xhtml?persistentId=doi:10.34810/DATA924
```

Published application:

```text
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0309611
```

The dataset includes raw photographs, 3D artefact models, a reconstructed sequence, and technical attributes.

## Outputs

```text
cases/lithic-operational-history/
apps/lithic-operational-history-explorer/
models/lithic-refit-history/
docs/cases/LITHIC_OPERATIONAL_HISTORY_IMPLEMENTATION.md
```

## Key Epistemic Distinctions

Represent separately:

```text
physical artefact
3D observation/model
refit relation
technological attribute
sequence interpretation
candidate operation
reconstructed chronology
alternative reconstruction
```

The published reconstruction is evidence-backed interpretation, not a direct recording of prehistoric actions.

## Phase 0 — Freeze ReViBE Dataset

Download and hash the complete selected replication dataset.

Record:

- dataset version;
- DOI;
- artefact IDs;
- 3D model files;
- photographs;
- sequence flowchart;
- technical attribute table;
- publication reference;
- extraction version.

Keep original filenames and identifiers.

## Phase 1 — Artefact Model

Represent:

```text
LithicArtefact
Core
Flake
Fragment
Surface / GeometryReference
TechnicalAttributes
3DModelReference
```

Do not embed full 3D meshes in semantic records.

Store verified references to content-addressed files.

## Phase 2 — Refit Relations

Represent explicit physical/geometric refit relations separately from temporal sequence interpretation.

Possible relation classes:

```text
refits-with
detached-from
spatially-adjacent-in-reconstruction
```

Only use a relation if supported by the source data/publication.

## Phase 3 — Operational Sequence

Represent the published reduction sequence as:

```text
ReconstructionArtifact
OperationNode
TemporalBefore
InputState
OutputState
EvidenceReference
```

Every sequence relation must be traceable to the dataset/publication.

## Phase 4 — Candidate Histories

Introduce alternative histories only as Onto2D analytical constructions.

Represent:

```text
published reconstruction
alternative candidate A
alternative candidate B
```

with explicit constraint violations/evidence support.

Do not present generated alternatives as archaeological findings.

## Phase 5 — Reconstruction Constraints

Potential constraints include:

```text
physical refit compatibility
scar/surface ordering
core geometry
technical attributes
published sequence relations
```

The first implementation should use only constraints directly supported by the selected ReViBE case.

## Phase 6 — Canonical Experiments

### Experiment A — Present Fragments to Refit

Start from the observed fragments and reconstruct the joined volume.

### Experiment B — Refit to Sequence

Show how the refit arrangement plus technological interpretation produces an ordered reduction sequence.

### Experiment C — Remove Evidence

Ablate one evidence class and show how candidate-history ambiguity changes.

### Experiment D — Alternative Sequence

If multiple sequences survive the bounded constraints, present all of them.

If the published case uniquely fixes the selected order under the encoded constraints, report that instead of manufacturing ambiguity.

## Phase 7 — Historical Inference Analysis

Potential case-level analysis:

```text
CandidateHistories(evidence_set)
```

and:

```text
SurvivingHistories(after constraint set F)
```

This is closer to abductive reconstruction than ordinary forward closure.

Do not move this into the kernel before the case proves the required semantics.

## Phase 8 — Historical Load Policy

A reduction sequence may eventually support a bounded Historical Load analysis, but only if:

- primitive operations are explicitly defined;
- alternative paths are declared;
- admissibility constraints are explicit;
- cost semantics are meaningful.

The first release should focus on reconstruction, not Historical Load.

## Phase 9 — Model Pack

Potential:

```text
modelId: lithic-refit-history
```

Entities:

```text
artefact
3D model reference
refit relation
operation
reconstructed state
sequence relation
evidence reference
reconstruction artifact
```

## Phase 10 — Explorer

Views:

1. Present Artefacts
2. 3D Refit
3. Reduction Sequence
4. Evidence Graph
5. Candidate Histories
6. Evidence Ablation
7. Reconstruction Inspector

The conceptual transition should be visible:

```text
what survives now
    ↓
what fits together
    ↓
what sequence is supported
```

## Phase 11 — Negative Tests

Required:

- 3D adjacency cannot automatically imply temporal order;
- published sequence relation remains distinct from physical refit;
- alternative histories remain explicitly counterfactual;
- removed evidence cannot remain active in reconstruction;
- absence of evidence cannot become evidence of absence;
- unresolved ordering remains unresolved;
- file/hash mutation changes case identity.

## Falsification Criterion

The case fails if Onto2D cannot represent several evidence-supported candidate histories without prematurely collapsing them into one `actual` past.

## Definition of Done

The frozen ReViBE case can reproduce the selected artefacts, refit relations, published reduction sequence, and evidence links, and can run at least one bounded reconstruction/evidence-ablation experiment without confusing observation with historical inference.
