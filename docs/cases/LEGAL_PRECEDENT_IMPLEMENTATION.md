# Legal Precedent — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded
    Reconstructed

Primary effects:
    Future
    Normative status

Domain:
    Law / case law

Evidence profile:
    judicial opinion
    citation extraction
    citation graph
    court/jurisdiction metadata
    legal interpretation

Historical Load:
    Not primary

History Equivalence:
    Possible

Reachability:
    Primary, normative

Reconstruction:
    Secondary
```

## Purpose

Test normative path dependence: past decisions are part of the structured
historical context within which later legal reasoning occurs.

Primary distinction:

```text
citation history
    !=
causal dependency
    !=
binding precedent
```

This case must remain a model of legal records and citation/procedural history,
not an automated source of legal advice.

## Primary External Source

CourtListener / Free Law Project:

```text
https://www.courtlistener.com/
https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview
https://wiki.free.law/c/courtlistener/help/api/rest/v4/citations
```

CourtListener exposes opinions and a citation graph between legal decisions.

Bulk citation data may be preferable for reproducible graph experiments.

## Outputs

```text
cases/legal-precedent-history/
apps/legal-precedent-history-lab/
models/legal-precedent-history/
docs/cases/LEGAL_PRECEDENT_IMPLEMENTATION.md
```

## Non-goals

Do not:

- provide legal advice;
- decide whether a precedent is binding;
- infer precedential weight from citation count alone;
- infer doctrinal dependence from one citation;
- classify an opinion as overruled without an explicit source;
- generate a "correct legal outcome".

The first release is a provenance/citation/normative-history representation.

## Phase 0 — Select One Doctrinal Cohort

Choose a small, historically coherent chain, ideally:

- one jurisdiction;
- one doctrinal question;
- 10–100 opinions;
- known chronological ordering;
- manageable citation graph;
- reviewed legal scholarship if doctrinal interpretation is included.

Avoid beginning with the entire U.S. case-law graph.

## Phase 1 — Pin Court Records

Persist:

```text
opinion metadata
opinion IDs
court/jurisdiction
decision date
citation edges
selected opinion text or text hashes where licensing permits
API/bulk snapshot identity
```

Record all extraction versions.

## Phase 2 — Native Citation Model

Represent:

```text
Opinion
Court
DecisionDate
Citation
CitingOpinion
CitedOpinion
CitationDepth if provided
```

Citation is a recorded textual/network relation.

Nothing stronger is implied.

## Phase 3 — Normative Relation Layer

Only with explicit external evidence, represent additional relations such as:

```text
binding-in-jurisdiction
persuasive
distinguished
overruled
affirmed
reversed
doctrinally-relied-on
```

Each must retain source attribution.

Do not derive these labels from citation count.

## Phase 4 — Canonical Experiments

### Experiment A — Citation Ancestry

Trace a bounded chain of later opinions citing earlier opinions.

### Experiment B — Same Current Proposition, Different Citation Histories

If supported by the selected cohort, compare opinions reaching similar legal
language/conclusion through different precedent networks.

### Experiment C — Citation vs Normative Status

Show cases where citation exists but does not by itself establish binding
authority.

### Experiment D — Historical Constraint

Represent the set of prior opinions available at decision time.

Never allow later cases to appear as historical inputs to earlier decisions.

### Experiment E — Counterfactual Removal

As an Onto2D analysis only, remove one cited authority and inspect graph
reachability / support structure.

Do not interpret the counterfactual as a legal conclusion.

## Phase 5 — Normative Reachability

Use a narrow term such as:

```text
AvailablePrecedentContext(
    court,
    decision_time,
    selected_corpus
)
```

rather than `LegalFuture()`.

The first implementation should model what prior sources were available, not
predict what a court should decide.

## Phase 6 — Model Pack

Potential:

```text
modelId: legal-precedent-history
```

Entities:

```text
opinion
court
citation
decision
normative-status claim
source/evidence record
```

## Phase 7 — Explorer

Views:

1. Timeline
2. Citation Graph
3. Available-at-Time Filter
4. Citation vs Normative Status
5. Doctrinal Interpretation Layer
6. Evidence Inspector
7. Counterfactual Graph Analysis

Core safeguard:

```text
CITES
```

must be visually distinct from:

```text
BINDING / RELIED ON / OVERRULED
```

## Phase 8 — Negative Tests

Required:

- future case cannot influence earlier available-context graph;
- citation count cannot create binding status;
- citation extraction cannot become doctrinal interpretation;
- court hierarchy must not be guessed;
- missing treatment status stays unknown;
- counterfactual removal cannot rewrite source history;
- parallel/duplicate citations cannot silently duplicate opinion identity.

## Falsification Criterion

The case fails if Onto2D cannot represent normative history without collapsing
citation, legal authority, and doctrinal interpretation into one edge type.

## Definition of Done

A pinned CourtListener cohort can reproduce exact opinion and citation
identities, display the historical citation network at a selected decision
time, and layer any stronger normative claims only with explicit attribution.
