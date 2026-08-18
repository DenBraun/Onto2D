# Mineral Formation History — Implementation Plan

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
    Mineralogy

Evidence profile:
    direct-measurement
    sample-identity
    published-interpretation
    reconstructed
    unknown
    contested

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

Test whether present mineral classification and formation-history classification can coexist as distinct views over the same samples/species.

Primary distinction:

```text
composition + crystal structure
        !=
complete historical natural-kind description
```

The project must not assume that historical classification replaces conventional mineralogy. It tests whether formation history provides an additional explicit axis.

## Primary External Sources

Evolutionary System of Mineralogy overview:

```text
https://hazen.carnegiescience.edu/research/evolutionary-system-mineralogy
```

RRUFF mineral data:

```text
https://rruff.info/
```

Additional formation/paragenetic claims must come from reviewed publications or reviewed datasets and be pinned individually.

## Outputs

```text
cases/mineral-formation-history/
apps/mineral-history-explorer/
models/mineral-formation-history/
docs/cases/MINERAL_FORMATION_HISTORY_IMPLEMENTATION.md
```

## Key Epistemic Boundary

The system must distinguish:

```text
sample observation
mineral species classification
locality/age record
formation-mode interpretation
historical natural-kind grouping
Onto2D analysis
```

A mineral locality is not itself proof of a formation mechanism.

## Phase 0 — Start With One Mineral Family

Do not ingest the entire mineral kingdom.

Select one mineral with multiple reviewed formation modes. Pyrite is a strong initial candidate, but the final selection must be based on a reviewable published formation-mode corpus.

Freeze:

- mineral species definition;
- selected samples/localities;
- selected formation modes;
- supporting publications;
- evidence mapping.

## Phase 1 — Evidence Package

Create:

```text
cases/mineral-formation-history/upstream.json
cases/mineral-formation-history/evidence/
```

Record:

- RRUFF sample IDs where used;
- locality/source metadata;
- composition/structural identifiers;
- formation-mode publication references;
- age data where used;
- extraction version;
- manually reviewed mapping records.

Manual scientific mappings must be explicit artifacts, not code comments.

## Phase 2 — Native Sample Model

Represent:

```text
MineralSpecies
MineralSample
Locality
AgeEstimate
CompositionRecord
StructureRecord
SpectralRecord
SourceRecord
```

Do not infer formation mode at this layer.

## Phase 3 — Formation Interpretation Model

Represent separately:

```text
FormationMode
FormationClaim
EvidenceReference
Confidence/Status
```

A sample may have:

```text
one supported formation mode
multiple candidate modes
unknown formation mode
contested formation mode
```

Do not force a single label.

## Phase 4 — Identity Regimes

Implement explicit views:

### Conventional Species Identity

Based on the selected conventional mineral-species identifiers.

### Sample Identity

Individual specimen/source record.

### Formation-Mode Identity

Groups samples by reviewed formation mechanism/context.

### Historical Natural-Kind Profile

A reviewed composition of present mineral identity plus selected historical context.

The last profile is an Onto2D representation of published evolutionary mineralogy ideas; it is not a replacement IMA classification.

## Phase 5 — Canonical Experiments

### Experiment A — Same Species, Different Formation

Show two or more samples classified as the same conventional mineral species but assigned different reviewed formation modes.

### Experiment B — Formation Evidence

For each historical classification, expose the publication/data evidence.

### Experiment C — Unknown History

Include at least one sample for which formation mode is not confidently resolved.

### Experiment D — Classification Toggle

Explorer modes:

```text
Species
Sample
Formation mode
Historical profile
```

The same data should regroup differently without rewriting source identity.

## Phase 6 — Historical Load

Do not introduce Historical Load in the first release merely because formation history exists.

A valid Historical Load experiment requires:

- a finite declared formation path space;
- explicit transitions;
- explicit physical admissibility constraints;
- a defensible cost function.

If those are unavailable, the case remains an identity/provenance case.

A later bounded geochemical model may provide the required path space.

## Phase 7 — Model Pack

Create only after the first reviewed sample/formation mapping is stable:

```text
modelId: mineral-formation-history
```

Entities may include:

```text
species
sample
locality
formation mode
age interval
formation claim
evidence reference
```

## Phase 8 — Explorer

Main views:

1. Conventional Classification
2. Samples and Localities
3. Formation Modes
4. Historical Grouping
5. Evidence Inspector
6. Deep-Time Context

The page should visually demonstrate:

```text
same present mineral species
        |
        +-- formation history A
        |
        +-- formation history B
```

without implying different chemical species.

## Phase 9 — Negative Tests

Required:

- locality alone cannot create a formation-mode claim;
- missing age remains missing;
- uncertain formation remains uncertain;
- same species does not imply same formation mode;
- different formation modes do not silently create different conventional species;
- manual mapping must cite evidence;
- analysis layer cannot mutate RRUFF source records.

## Falsification Criterion

The case fails if Onto2D can express historical classification only by overwriting or duplicating conventional mineral identity.

## Definition of Done

A small reviewed mineral cohort exposes conventional identity, specimen identity, formation interpretation, and evidence as independent layers, with at least one same-species/different-history example and one unresolved example.
