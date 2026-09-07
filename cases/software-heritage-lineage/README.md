# Software Heritage Lineage

Case ID: `software-heritage-lineage`. [History case registry](../history-case-registry.json).

- [Software Heritage Lineage — source and interpretation](#software-heritage-lineage--source-and-interpretation)

<a id="software-heritage-lineage--source-and-interpretation"></a>

## Software Heritage Lineage — source and interpretation

<a id="software-heritage-lineage--source-and-interpretation--purpose"></a>

### Purpose

Move Onto2D external history experiments from controlled fixtures to a bounded
sample of real ecosystem-scale historical data.

Primary questions:

```text
same content
different directory context
different revision ancestry
different origin
different historical depth
```

<a id="software-heritage-lineage--source-and-interpretation--outputs"></a>

### Outputs

```text
cases/software-heritage-lineage/
apps/software-lineage-explorer/
cases/software-heritage-lineage/README.md
```

Do not import the entire archive into Onto2D.

<a id="software-heritage-lineage--source-and-interpretation--phase-0--sample-design"></a>

### Phase 0 — Sample Design

Create a frozen bounded dataset targeting approximately 100–1000 content objects.

Selection criteria should favor objects appearing in multiple historical
contexts.

Record:

- exact API/archive source;
- retrieval date;
- source identifiers;
- response hashes;
- sample-selection algorithm/version.

Prefer a deterministic frozen export committed or otherwise content-addressed
for reproduction.

<a id="software-heritage-lineage--source-and-interpretation--phase-1--native-graph-extraction"></a>

### Phase 1 — Native Graph Extraction

Preserve native object distinctions such as:

```text
content
directory
revision
release
snapshot
origin
```

Map native identifiers exactly.

Do not infer repository ownership or authorship semantics beyond upstream data.

<a id="software-heritage-lineage--source-and-interpretation--phase-2--bounded-lineage-graph"></a>

### Phase 2 — Bounded Lineage Graph

Build deterministic projections:

- content -> directories;
- directories -> revisions;
- revision parent ancestry;
- origin/snapshot context where available;
- shared content across origins;
- ancestry depth within the bounded sample.

Mark incomplete edges caused by sampling.

<a id="software-heritage-lineage--source-and-interpretation--phase-3--canonical-query-cohorts"></a>

### Phase 3 — Canonical Query Cohorts

Create stable cohorts:

<a id="software-heritage-lineage--source-and-interpretation--cohort-a--same-content-multiple-origins"></a>

#### Cohort A — Same content, multiple origins

<a id="software-heritage-lineage--source-and-interpretation--cohort-b--same-content-different-revision-depth"></a>

#### Cohort B — Same content, different revision depth

<a id="software-heritage-lineage--source-and-interpretation--cohort-c--shared-directory-state-different-revision-history"></a>

#### Cohort C — Shared directory state, different revision history

<a id="software-heritage-lineage--source-and-interpretation--cohort-d--shared-ancestry"></a>

#### Cohort D — Shared ancestry

<a id="software-heritage-lineage--source-and-interpretation--cohort-e--convergent-content"></a>

#### Cohort E — Convergent content

Different ancestry reaching equal content identity.

Every cohort selection must be deterministic and documented.

<a id="software-heritage-lineage--source-and-interpretation--phase-4--identity-regimes"></a>

### Phase 4 — Identity Regimes

Support comparisons under:

```text
content identity
directory-state identity
revision identity
ancestry identity
origin-context identity
```

Do not define one universal "software object identity".

<a id="software-heritage-lineage--source-and-interpretation--phase-5--scale-safe-model-strategy"></a>

### Phase 5 — Scale-Safe Model Strategy

Do not immediately create one giant registered Model Pack.

Start with:

```text
frozen sample artifact
+
case-local indexes
+
bounded Explorer
```

Only create a Model Pack after size, verification and semantics are understood.

If a Model Pack is later added, it must preserve sampling boundaries.

<a id="software-heritage-lineage--source-and-interpretation--phase-6--explorer"></a>

### Phase 6 — Explorer

Core modes:

1. Content Occurrences
2. Revision Ancestry
3. Origin Context
4. Shared Lineage
5. Convergence
6. Identity Regime Comparison

Useful query:

> Show all historical contexts in the frozen sample containing this exact
> content object.

<a id="software-heritage-lineage--source-and-interpretation--phase-7--historical-analysis"></a>

### Phase 7 — Historical Analysis

Historical Load is not an initial goal.

The first goal is to validate multiplicity and identity distinctions at real
scale.

Later analyses may study:

- ancestry depth distribution;
- number of distinct historical contexts per content;
- equivalence classes under selected regimes;
- convergence frequency.

These are descriptive unless a stronger validated model is introduced.

<a id="software-heritage-lineage--source-and-interpretation--phase-8--incompleteness-semantics"></a>

### Phase 8 — Incompleteness Semantics

This case must explicitly represent:

```text
complete in sample
not complete globally
unknown outside sample
```

Absence from the frozen sample must never be interpreted as global absence.

<a id="software-heritage-lineage--source-and-interpretation--phase-9--negative-tests"></a>

### Phase 9 — Negative Tests

Required:

- sample omission cannot be treated as nonexistence;
- same content object can retain multiple contexts;
- revision identity cannot collapse into content identity;
- source identifier mutation changes sample identity;
- pagination/retrieval order cannot change canonical output;
- bounded ancestry traversal must terminate deterministically.

<a id="software-heritage-lineage--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D works only on hand-built graphs and cannot represent
many-to-many historical context without collapsing identity or inventing
completeness.

<a id="software-heritage-lineage--source-and-interpretation--definition-of-done"></a>

### Definition of Done

A frozen reproducible sample exposes real content objects occurring in multiple
historical contexts, with deterministic lineage queries and explicit
incompleteness boundaries.
