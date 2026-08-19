# Manuscript Stemmatics - Implementation and Result

Updated: 2026-08-18

Status: implemented and verified - `ANALYSIS_READY`

Exact release:

```text
case: manuscript-stemmatics-v1
case identity: sha256:f434de7c96b481ee68abcf13f4b50e216af99ce8710014061b5a7ff7ac574629
artifact: cases/manuscript-stemmatics/artifacts/manuscript-stemmatics.json
model: manuscript-transmission@v1-4581c6819fd2ab28
explorer: apps/textual-transmission-lab/
```

## Result

The selected tradition is Link 1 and *The Miller's Tale* from the New
Stemmatics data page. The source describes 54 manuscript witnesses and four
pre-1500 print editions. Its NEXUS file contains 59 taxa including the
collation base and 4032 transposed characters.

The bounded explanation projects seven witnesses and two explicitly discussed
reading sites. Those sites are selection-biased examples, not a representative
sample of the complete collation. Exact agreement over them creates neither a
copying relation nor ancestry.

Robinson's published analysis supports the flagship non-tree result:

```text
Cx1 ----------------------> Cx2 ----------------------> Pn
                              \\-----------------------> Wy
unresolved better copy ----> Cx2
```

The first input supplied the base text; the second is an attributed correction
source and is explicitly non-tree-compatible. Its physical identity remains
unresolved. Every transmission relation is a published interpretation, never a
directly observed historical event.

The published quantitative profile reports 207 differences between Cx2 and
Cx1 whose Cx2 reading also appears in more than three witnesses. This supports
the correction interpretation in the published analysis. It is not a count of
copying events and is not a Historical Load result.

Four exact ablations make evidence sensitivity inspectable. Removing only the
207-reading profile downgrades the correction source to attributed-only;
removing the multiple-exemplar claim withholds both bounded inputs into Cx2.
Removing the two displayed example sites does not remove the published
transmission relations, because those relations are not inferred from the
miniature display slice.

These outcomes are replayed by the extractor from an explicit relation-evidence
policy: missing required attribution evidence withholds a relation, while
missing corroborating evidence downgrades it to attributed-only. The values in
the analysis profile are regression expectations and are rejected if they
disagree with the independently derived result. The public verifier repeats
that replay, recomputes every witness identity, and admits only the exact
approved `manuscript-stemmatics-v1` case identity.

Historical Load is `null`, not zero: the source provides no finite admissible
reconstruction space, route-cost functional, or baseline route. The bounded
reconstruction status is `partial`, the central rooting is unresolved, and no
candidate actual past is invented.

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

The implemented corpus is the site's Link 1 and *The Miller's Tale* dataset:

```text
MI.nex
sha256:b6b7b2114119a48cedad400bc1d2cfea80013e71bcf3d70b2e2f3a0ada6ce7b5

MIanal.pdf
sha256:55c0d2c1f50e844b1c465626ca1a5ff21b4d6d79ea10ff23cf450b7ecd8456b9
```

It was selected because the machine-readable collation is accompanied by a
page-located published analysis of Cx2's multiple-exemplar transmission. Exact
upstream byte counts, HTTP metadata, the data-page hash, and the source licence
statement are retained in `cases/manuscript-stemmatics/upstream.json`.

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

The following phase record is retained as the implementation and review
checklist. Every phase is complete for `manuscript-stemmatics-v1`.

## Phase 0 - Choose a Bounded Tradition

Select one tradition satisfying:

- machine-readable collation;
- published scholarly analysis;
- manageable witness count;
- identifiable variant sites;
- ideally at least one supported non-tree/contamination relation.

If no selected New Stemmatics corpus supports multiple-parent transmission,
use the first release for ordinary reconstructed ancestry and select a second
reviewed corpus for contamination rather than fabricating it.

## Phase 1 - Pin Evidence

Persist:

```text
collation files
NEXUS files where present
scholarly analysis files
witness metadata
selection notes
```

Record source hashes and the exact source publication citation.

## Phase 2 - Native Textual Model

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

## Phase 3 - Similarity Projection

Derive explicit, versioned comparisons such as:

```text
shared reading count
variant distance
missing-data profile
```

Similarity metrics are analysis artifacts.

They are not ancestry.

## Phase 4 - Reconstructed Transmission Model

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

## Phase 5 - Canonical Experiments

### Experiment A - Similar Text, Different Ancestry

Show that high textual similarity alone does not define genealogical relation.

### Experiment B - Reconstructed Stemma

Replay or import the selected published reconstruction as an explicitly
attributed artifact.

### Experiment C - Multiple Historical Parents

Where the corpus supports contamination:

```text
Witness A -----\
                > Witness C
Witness B -----/
```

Keep the relation distinct from ordinary tree parentage.

### Experiment D - Evidence Ablation

Remove selected variant sites and recompute the bounded candidate relation set.

Show whether reconstruction becomes more ambiguous.

### Experiment E - History Equivalence

Compare witnesses under:

```text
exact reading identity
selected-passage identity
transmission-history identity
```

## Phase 6 - Reconstruction Analysis

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

## Phase 7 - Model Pack

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

## Phase 8 - Explorer

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

## Phase 9 - Negative Tests

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
