# Legal Precedent — Implementation Plan

Updated: 2026-08-19

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

## Implementation Status

```text
Maturity:
    ANALYSIS_READY

Case identity:
    sha256:158c1bb5be38b6f9e9f2cd4f32ad3a90f2d3ff20b55369067c86b590c3024691

Model Pack:
    legal-precedent-history@v1-05958887a4ffef41

Model root:
    sha256:c5541db8a9bc669f452a738ccf02d239ae2e2d286e61a5979129fe86275caf2a
```

The first release is complete as a full vertical slice: exact source locks,
offline deterministic extraction, a JSON Schema, negative tests, an exact
Model Pack, a light-theme Explorer, History Atlas integration, and an exact
Model Studio selection.

## Implemented Cohort

The bounded cohort contains seven selected United States Supreme Court
public-school desegregation opinions:

| ID | Citation | GovInfo decision date | CourtListener opinion ID |
|---|---|---|---:|
| `brown-i` | 347 U.S. 483 | 1954-05-17 | 105221 |
| `brown-ii` | 349 U.S. 294 | 1955-05-31 | 105312 |
| `cooper` | 358 U.S. 1 | 1958-09-12 | 105766 |
| `griffin` | 377 U.S. 218 | 1964-05-25 | 106825 |
| `green` | 391 U.S. 430 | 1968-05-27 | 107705 |
| `alexander` | 396 U.S. 19 | 1969-10-29 | 107993 |
| `swann` | 402 U.S. 1 | 1971-04-20 | 108316 |

This is a deliberately incomplete research selection, not a complete doctrinal
corpus or a statement of current law. CourtListener supplies provider
identifiers, opinion SHA-1 fields, retrieval-time citation totals, and native
`opinion.cites` relations. GovInfo supplies official United States Reports
metadata and seven PDF byte locks. The build requires no live network.

## Canonical Result

At `Green`'s official decision date, the four selected prior opinions are:

```text
Brown I
Brown II
Cooper
Griffin
```

`Green` has a CourtListener-native citation edge to each one. `Alexander` and
`Swann` remain in the seven-opinion source record but are excluded from the
1968 historical-input projection. The full cohort contains 16 native citation
edges; the Green context contains 10.

Four stronger treatment labels are stored separately and attributed to exact
locators in the official `Green` opinion:

```text
described-holding
applied-command
supporting-reference
quoted-timing-rule
```

None is derived from citation count, none creates a court-hierarchy edge, and
none is promoted to a binding-status claim. Binding status is `unknown` in the
native citation layer and `not-classified` in the attributed treatment layer.

## Preserved Source Disagreements

GovInfo and CourtListener disagree on two date fields:

| Opinion | GovInfo decision date | CourtListener `dateFiled` |
|---|---|---|
| `Cooper` | 1958-09-12 | 1958-10-06 |
| `Swann` | 1971-04-20 | 1971-06-07 |

Both fields remain visible. The analysis profile explicitly chooses GovInfo's
official decision date for this time slice and makes no claim about why the
CourtListener value differs.

## Counterfactual Result

Withholding `Brown II` from the derived Green-context graph changes the view
from 5 to 4 nodes and from 10 to 6 citation edges. The source record remains
exactly 7 opinions and 16 citations. This is a reachability ablation only; it
cannot rewrite source history or support a legal conclusion.

## Historical Load Result

Historical Load remains `null`, not zero. The case defines no finite legal
route space, route-cost function, or history-free normative baseline. Its
useful result is the typed evidence boundary and the exact available-at-time
projection, not a scalar.

## Reproduction

```sh
npm run case:legal-precedent
npm run case:legal-precedent:verify
npm run model:legal-precedent
npm run model:legal-precedent:verify
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
https://wiki.free.law/c/courtlistener/help/api/rest/v4/rest-api-v47
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
