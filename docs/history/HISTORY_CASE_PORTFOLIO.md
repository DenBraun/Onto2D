# Onto2D History Case Portfolio

Updated: 2026-08-19

This is the authoritative human-readable portfolio view. The machine-readable
source is [`cases/history-case-registry.json`](../../cases/history-case-registry.json).
Statuses describe repository maturity, not scientific truth.

## Portfolio

| Case | Primary mode | Other modes | Primary effects | Domain | Maturity |
|---|---|---|---|---|---|
| Live Bootstrap Provenance | Recorded | Reconstructed | Identity | Software bootstrap | ANALYSIS_READY |
| Git History Identity | Recorded | — | Identity | Version control | EXPLORER |
| Nix Derivation Identity | Recorded | — | Identity | Package management | EXPLORER |
| OCI Layer History | Recorded | — | Identity | Container images | ANALYSIS_READY |
| in-toto Admissibility | Recorded | — | Identity | Software supply chain | ANALYSIS_READY |
| Reproducible Build Equivalence | Recorded | — | Identity | Build reproducibility | ANALYSIS_READY |
| SLSA Provenance Evidence | Recorded | — | Identity | Software supply chain | PLANNED |
| Software Heritage Lineage | Recorded | — | Identity | Software archival | PLANNED |
| Chemical Synthesis History | Recorded | — | Identity | Chemistry | ANALYSIS_READY |
| Mineral Formation History | Reconstructed | Embodied | Identity | Mineralogy | ANALYSIS_READY |
| LTEE Evolutionary Contingency | Embodied | Recorded, Reconstructed | Future | Experimental evolution | ANALYSIS_READY |
| Material Process History | Embodied | Recorded | Present State | Materials science | ANALYSIS_READY |
| Cell Lineage Identity | Reconstructed | Embodied | Identity | Developmental biology | ANALYSIS_READY |
| Lithic Operational History | Reconstructed | — | Present State | Archaeology | PLANNED |
| Artwork Provenance | Recorded | Reconstructed | Identity | Cultural heritage | ANALYSIS_READY |
| Manuscript Stemmatics | Reconstructed | Recorded | Identity | Textual scholarship | ANALYSIS_READY |
| Operational Aging | Embodied | Recorded | Present State, Future | Mechanical prognostics | ANALYSIS_READY |
| Ecological Memory | Embodied | Recorded | Present State, Future | Ecology | ANALYSIS_READY |
| Historical Linguistics | Reconstructed | Recorded | Identity | Historical linguistics | ANALYSIS_READY |
| Legal Precedent | Recorded | Reconstructed | Future | Law | ANALYSIS_READY |
| Clinical Trajectories | Embodied | Recorded | Present State, Future | Clinical medicine | ANALYSIS_READY |
| Galactic Archaeology | Reconstructed | Recorded | Present State | Galactic astronomy | ANALYSIS_READY |

Secondary effects remain present in the registry and website. The compact table
shows only primary effects so that hybrid cases remain legible.

## Exact matrix placement

`historyModes[]` and the effect arrays are not interpreted as an automatic
Cartesian product. The registry therefore declares `matrixPlacements[]` with
an exact `(mode, effect, role)` tuple for every displayed cell.

For example, LTEE uses reconstructed interpretation and has a future effect,
but its flagship future-accessibility result is an **Embodied x Future**
placement. It is not silently copied into **Reconstructed x Future**. This
preserves the explicit research gap in that cell without hiding LTEE's
reconstructed evidence mode.

## 3 × 3 research map

| History access | Identity | Present State | Future |
|---|---|---|---|
| Recorded | Git, Nix, live-bootstrap, OCI, in-toto, Reproducible Builds, SLSA, Software Heritage, Chemistry, Artwork | OCI secondary view; recorded AM-Bench, operational, ecological, clinical, LTEE observations | Legal Precedent; recorded operational, ecological, clinical, and LTEE contexts |
| Embodied | Mineral and Cell Lineage secondary views | AM-Bench, Operational Aging, Ecological Memory, Clinical Trajectories | LTEE, Operational Aging, Ecological Memory, Clinical Trajectories |
| Reconstructed | Mineral Formation, Cell Lineage, Manuscripts, Historical Linguistics, Artwork gaps | Lithic History, Galactic Archaeology, Mineral Formation | Explicit research gap; no case is inserted artificially |

The same case may occur in more than one cell. Matrix membership is a view over
metadata, never physical ownership of a case.

## Implementation priorities

1. Recorded → Identity: Artwork Provenance, in-toto, Reproducible Builds, and
   Chemistry are analysis-ready.
2. Embodied → Present State: Operational Aging and Ecological Memory are
   analysis-ready; Material Process History is the implemented flagship for
   Embodied History -> Present State.
3. Embodied → Future: LTEE is the implemented flagship with three separate
   Ara-3 replay protocols and descriptive history-conditioned reachability.
   Operational Aging is analysis-ready; Ecological Memory's present-state
   result is analysis-ready while future reachability remains descriptive-only.
4. Reconstructed → Identity: Historical Linguistics, Manuscript Stemmatics,
   Mineral Formation, and Cell Lineage are analysis-ready. Mineral Formation keeps one
   conventional pyrite class, ten sample records, three reviewed formation
   profiles, and seven case-local unresolved mappings. Cell Lineage preserves
   750 source cells as 750 record, 56 cluster, 192 exact HMID, or 133 bounded
   first-four-target signature classes without treating target position as edit
   time or inventing a complete pedigree.
5. Reconstruction from traces: Galactic Archaeology is analysis-ready with a
   64-source Gaia DR3 cohort, five explicit evidence layers, and quality/evidence
   ablations; Lithic Operational History remains planned.
6. Recorded → Future: Legal Precedent is analysis-ready with a bounded
   official-date context and separately attributed treatment layer.
7. Embodied → Present State / Future: Clinical Trajectories is analysis-ready
   with five bounded frames and descriptive recorded-history context. It does
   not perform future prediction or evaluate Historical Load.

Future priorities should be selected explicitly. The portfolio currently has no
entry marked `next`; planned cases remain plans until source pinning,
reproducible extraction, evidence review, and negative tests are complete.
