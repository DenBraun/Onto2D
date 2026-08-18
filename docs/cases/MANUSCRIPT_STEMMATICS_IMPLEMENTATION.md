# Manuscript Stemmatics — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Reconstructed
    Recorded

Primary effects:
    Identity

Domain:
    Textual scholarship / cultural transmission

Evidence profile:
    manuscript witness
    textual variant
    collation
    scholarly analysis
    reconstructed stemma

Historical Load:
    Not primary

History Equivalence:
    Relevant

Reachability:
    Not primary

Reconstruction:
    Primary
```

## Purpose

Use manuscript textual traditions to test reconstruction of cultural ancestry
and, critically, histories that are not necessarily trees.

Primary distinctions:

```text
text similarity
    !=
copy ancestry
```

and:

```text
one witness
may inherit from
multiple exemplars
```

The second distinction is important for Onto2D because it tests multiple
historical parents and contamination/horizontal transmission.

## Primary External Source

The New Stemmatics datasets:

```text
https://textualscholarship.org/newstemmatics/data/
```

The site publishes collations for several textual traditions and associated
expert scholarly analyses.

Initial candidate corpora include the provided Chaucer and Old Norse datasets.

The actual first corpus must be selected only after verifying that it contains
a reviewable transmission problem relevant to the intended experiment.

## Outputs

```text
cases/manuscript-stemmatics/
apps/textual-transmission-lab/
models/manuscript-transmission/
docs/cases/MANUSCRIPT_STEMMATICS_IMPLEMENTATION.md
```

## Non-goals

Do not:

- claim to recover the actual lost archetype automatically;
- treat textual similarity as direct ancestry;
- force the tradition into a tree;
- infer contamination without scholarly or explicit algorithmic evidence;
- invent missing witnesses;
- treat an editorial stemma as direct observation.

## Phase 0 — Choose a Bounded Tradition

Select one tradition satisfying:

- machine-readable collation;
- published scholarly analysis;
- manageable witness count;
- identifiable variant sites;
- ideally at least one supported non-tree/contamination relation.

If no selected New Stemmatics corpus supports multiple-parent transmission,
use the first release for ordinary reconstructed ancestry and select a second
reviewed corpus for contamination rather than fabricating it.

## Phase 1 — Pin Evidence

Persist:

```text
collation files
NEXUS files where present
scholarly analysis files
witness metadata
selection notes
```

Record source hashes and the exact source publication citation.

## Phase 2 — Native Textual Model

Represent:

```text
Witness
Passage / Variant Site
Reading
Missing Reading
Editorial Segmentation
Source Document
```

Do not create ancestry relations yet.

## Phase 3 — Similarity Projection

Derive explicit, versioned comparisons such as:

```text
shared reading count
variant distance
missing-data profile
```

Similarity metrics are analysis artifacts.

They are not ancestry.

## Phase 4 — Reconstructed Transmission Model

Represent:

```text
CandidateAncestor
TransmissionEdge
ContaminationEdge
ReconstructionArtifact
ScholarlyClaim
EvidenceReference
```

Each edge must retain its origin:

```text
published-analysis
algorithmic-reconstruction
Onto2D-counterfactual
```

## Phase 5 — Canonical Experiments

### Experiment A — Similar Text, Different Ancestry

Show that high textual similarity alone does not define genealogical relation.

### Experiment B — Reconstructed Stemma

Replay or import the selected published reconstruction as an explicitly
attributed artifact.

### Experiment C — Multiple Historical Parents

Where the corpus supports contamination:

```text
Witness A -----\
                > Witness C
Witness B -----/
```

Keep the relation distinct from ordinary tree parentage.

### Experiment D — Evidence Ablation

Remove selected variant sites and recompute the bounded candidate relation set.

Show whether reconstruction becomes more ambiguous.

### Experiment E — History Equivalence

Compare witnesses under:

```text
exact reading identity
selected-passage identity
transmission-history identity
```

## Phase 6 — Reconstruction Analysis

Primary case-level output:

```text
SupportedTransmissionHistories(
    witness evidence,
    reconstruction profile
)
```

Possible states:

```text
unique
multiple
partial
unsupported
unresolved
```

## Phase 7 — Model Pack

Potential:

```text
modelId: manuscript-transmission
```

Entities:

```text
witness
reading
variant site
transmission relation
reconstruction artifact
scholarly claim
source document
```

## Phase 8 — Explorer

Views:

1. Witnesses
2. Variant Matrix
3. Similarity
4. Reconstructed Stemma
5. Contamination / Multiple Parents
6. Evidence Ablation
7. Reconstruction Inspector

The UI must visually distinguish:

```text
observed reading
derived similarity
reconstructed ancestry
published interpretation
```

## Phase 9 — Negative Tests

Required:

- similarity cannot satisfy ancestry APIs;
- missing readings remain missing;
- a tree algorithm cannot silently erase contamination edges;
- reconstruction cannot become direct observation;
- alternative histories may coexist;
- witness IDs remain stable across projections;
- ablated evidence cannot remain in the reconstruction input.

## Falsification Criterion

The case fails if Onto2D requires all historical ancestry to be a tree or
cannot keep textual evidence distinct from reconstructed transmission history.

## Definition of Done

A pinned manuscript tradition can be loaded, its variants inspected, a
published or reproducible stemmatic reconstruction displayed, and any supported
multiple-parent transmission represented without collapsing it into a tree.
