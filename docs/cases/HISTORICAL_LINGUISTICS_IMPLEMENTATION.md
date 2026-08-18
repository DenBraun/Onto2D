# Historical Linguistics — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Reconstructed
    Recorded

Primary effects:
    Identity

Domain:
    Historical linguistics

Evidence profile:
    genealogical classification
    lexical form
    cognacy/etymology record
    borrowing annotation
    expert linguistic interpretation

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

Test historical systems in which both vertical inheritance and horizontal
transfer matter.

Primary distinctions:

```text
lexical similarity
    !=
genealogical ancestry
```

and:

```text
history
=
vertical inheritance
+
horizontal borrowing/contact
```

This case complements manuscript stemmatics but operates at the language and
lexical-system scale.

## Primary External Sources

Glottolog:

```text
https://glottolog.org/
```

Use it for stable languoid identifiers and published genealogical
classification.

Lexibank:

```text
https://lexibank.clld.org/
```

Use a pinned released Lexibank dataset for standardized lexical forms and
features.

World Loanword Database (WOLD):

```text
https://wold.clld.org/
```

Use WOLD for expert-curated loanword/source information where the selected
languages are covered.

CLDF should be preferred when a pinned machine-readable release exists.

## Outputs

```text
cases/historical-linguistics/
apps/language-lineage-borrowing-lab/
models/language-transmission/
docs/cases/HISTORICAL_LINGUISTICS_IMPLEMENTATION.md
```

## Non-goals

Do not:

- reconstruct Proto-Indo-European or another proto-language from scratch;
- infer cognacy from surface similarity alone;
- infer borrowing solely from geographic proximity;
- convert Glottolog classification into unquestionable ground truth;
- claim a universal language phylogeny;
- treat lexical borrowing as genealogical parentage.

## Phase 0 — Select a Small Language Cohort

Choose approximately 5–20 languages with:

- stable Glottocodes;
- a reviewed genealogical relation;
- lexical coverage in a pinned Lexibank dataset;
- at least one WOLD borrowing relation if possible;
- a manageable contact history.

The first cohort should be selected to demonstrate both inheritance and
borrowing.

## Phase 1 — Pin Source Releases

Record:

```text
Glottolog version
Lexibank dataset/version
WOLD/CLDF release
selected language IDs
selected concept IDs
source hashes
```

Do not query only live web applications in canonical tests.

## Phase 2 — Native Language Model

Represent:

```text
Languoid
Glottocode
GenealogicalFamily
ClassificationEdge
LexicalForm
Concept
SourceDataset
```

Keep Glottolog classification attribution.

## Phase 3 — Borrowing Model

Represent separately:

```text
LoanwordRecord
RecipientLanguage
DonorLanguage / SourceLanguage
SourceForm where available
BorrowingConfidence / Status where available
Attestation
```

Do not convert borrowing into tree ancestry.

## Phase 4 — Similarity / Cognacy Boundary

If cognate sets are added:

```text
observed form
cognate annotation
phonological similarity
algorithmic cognate prediction
```

must remain separate.

A high similarity score is not a cognacy fact.

## Phase 5 — Canonical Experiments

### Experiment A — Genealogical Inheritance

Show a small family tree from the pinned Glottolog classification.

### Experiment B — Horizontal Borrowing

Overlay WOLD loan edges.

The graph should visibly cease to be a pure tree.

### Experiment C — Similarity Without Shared Immediate Ancestry

Find a reviewed borrowed lexical item that creates cross-family similarity.

### Experiment D — Same Concept, Multiple Historical Sources

Show different lexical forms for the same concept with distinct inheritance or
borrowing histories.

### Experiment E — Classification Sensitivity

Allow a published classification edge to be marked uncertain/contested if the
source itself treats it as tentative.

## Phase 6 — History Equivalence

Potential comparison regimes:

```text
same language identifier
same genealogical family
same lexical state for selected concept set
same transmission profile
```

These are distinct.

## Phase 7 — Reconstruction Analysis

Initial question:

```text
Which edges are genealogical classification,
which are borrowing,
which are merely similarity?
```

Do not attempt a new phylogenetic reconstruction until the imported evidence
model is stable.

## Phase 8 — Model Pack

Potential:

```text
modelId: language-transmission
```

Entities:

```text
language
family
lexical form
concept
genealogical relation
borrowing relation
source record
classification claim
```

## Phase 9 — Explorer

Views:

1. Genealogical Tree
2. Lexical Forms
3. Borrowing Overlay
4. Vertical vs Horizontal History
5. Similarity vs Ancestry
6. Source/Evidence Inspector

Core visual:

```text
Family tree
   +
cross-tree borrowing edges
```

## Phase 10 — Negative Tests

Required:

- borrowed word cannot create genealogical parent edge;
- similarity cannot create cognacy automatically;
- Glottocode identity must remain stable across datasets;
- unmatched language mappings remain unresolved;
- uncertain classification remains uncertain;
- WOLD source relation cannot be generalized to all vocabulary;
- a tree layout cannot drop horizontal edges.

## Falsification Criterion

The case fails if Onto2D can represent historical inheritance only as a tree or
cannot distinguish vertical ancestry from horizontal transfer.

## Definition of Done

A pinned multilingual cohort can display stable genealogical classification,
lexical evidence, and at least one expert-curated borrowing relation in one
model without conflating similarity, cognacy, borrowing, and ancestry.
