# Getty Artwork Provenance — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded
    Reconstructed

Primary effects:
    Identity
    Relational/legal status

Domain:
    Cultural heritage / artwork provenance

Evidence profile:
    archival record
    linked-data record
    source catalogue/inventory
    published provenance interpretation

Historical Load:
    Not primary

History Equivalence:
    Primary candidate

Reachability:
    Not primary

Reconstruction:
    Secondary, especially for provenance gaps
```

## Purpose

Use the Getty Provenance Index to test historical identity that is neither
physical construction history nor biological lineage.

Primary distinction:

```text
same physical artwork
    !=
same provenance history
    !=
same relational/provenance status
```

The case should demonstrate that history may exist primarily as relations among
objects, people, transactions, institutions, and archival records.

## Primary External Source

Getty Provenance Index API:

```text
https://data.getty.edu/provenance/docs/
```

The API uses Linked.Art / JSON-LD and provides REST and SPARQL access.

The data are made available under CC0, but exact API responses used by the case
must still be pinned and hashed for reproducibility.

Optional complementary source:

```text
https://data.getty.edu/museum/collection/docs/
```

Do not assume that a Getty Museum object record and Provenance Index record
refer to the same historical object without a supported identifier/mapping.

## Outputs

```text
cases/artwork-provenance/
apps/artwork-provenance-identity-lab/
models/artwork-provenance/
docs/cases/GETTY_ARTWORK_PROVENANCE_IMPLEMENTATION.md
```

Suggested registry identity:

```text
caseId: artwork-provenance
modelId: artwork-provenance
explorerId: artwork-provenance-identity-lab
```

## Non-goals

Do not initially:

- determine legal ownership;
- determine authenticity;
- adjudicate restitution claims;
- infer transaction validity;
- infer acquisition from mere co-occurrence;
- infer one continuous chain from incomplete archival evidence;
- create market-value claims.

This is a provenance representation case, not a legal-opinion engine.

## Phase 0 — Select a Bounded Artwork Cohort

Select approximately 5–20 artwork/object histories with:

- stable Getty records;
- multiple documented provenance events;
- at least one history with a meaningful gap or uncertainty if available;
- sufficiently clear archival sources;
- no need for speculative identity matching.

Prefer a small manually reviewable corpus.

## Phase 1 — Pin Source Records

Create:

```text
cases/artwork-provenance/upstream.json
cases/artwork-provenance/source/
```

Record:

- exact REST/SPARQL queries;
- retrieval timestamp;
- returned entity IDs;
- JSON-LD response hashes;
- Linked.Art interpretation version;
- selection criteria;
- any manual identity mappings.

Persist bounded source responses where permitted.

Do not re-query live data during canonical tests.

## Phase 2 — Native Record Model

Preserve native distinctions such as:

```text
HumanMadeObject
Person
Group
Place
Activity
Encounter
Acquisition/Transfer-like activity
Source record
Identifier
TimeSpan
```

Use the actual Linked.Art classifications in the source snapshot instead of
inventing simplified types before extraction.

## Phase 3 — Provenance Event Projection

Create a deterministic case projection:

```text
Artwork
   |
   +-- Event 1 -- Actor / Place / Time
   |
   +-- Event 2 -- Actor / Place / Time
   |
   +-- Event 3 -- ...
```

Classify each projected edge by evidence:

```text
upstream-declared
derived-order
identity-mapped
published-interpretation
unknown
```

## Phase 4 — Identity Separation

Represent independently:

```text
physical/canonical object identity
source-record identity
provenance-history identity
provenance-chain hypothesis
```

Do not duplicate the artwork object merely because two provenance histories are
being compared.

## Phase 5 — Canonical Experiments

### Experiment A — Same Artwork, Multiple Historical Contexts

Show one artwork object with several successive ownership/market/inventory
contexts.

### Experiment B — Provenance Gap

Where source data support it, represent:

```text
known event
    |
unknown interval
    |
known event
```

The gap is a first-class state.

### Experiment C — Competing Chain Interpretation

Only if the source corpus genuinely supports alternative mappings.

Represent multiple candidate chains rather than selecting one silently.

### Experiment D — History Equivalence

Define explicit comparison profiles such as:

```text
same artwork only
same ordered known provenance events
same actors ignoring exact dates
same complete evidence-backed chain
```

The purpose is to show that provenance identity is regime-relative.

## Phase 6 — Evidence Inspector

Every provenance event must answer:

```text
What record supports this?
Is the relation directly encoded or derived?
Is the object identity exact or manually mapped?
Is the time exact, bounded, approximate, or unknown?
```

## Phase 7 — Model Pack

Create:

```text
modelId: artwork-provenance
```

Candidate entities:

```text
artwork
actor
organization
place
historical event
source record
provenance assertion
time interval
evidence link
```

Keep Getty entity IDs intact in source metadata.

## Phase 8 — Explorer

Views:

1. Artwork Identity
2. Provenance Timeline
3. Actor / Place Network
4. Source Records
5. Gaps and Uncertainty
6. Alternative Chains
7. Identity Regime Comparison

Central visual:

```text
same Artwork X
      |
      +-- known provenance history
      |
      +-- unresolved interval
      |
      +-- current context
```

## Phase 9 — Negative Tests

Required:

- source-record co-occurrence cannot become ownership automatically;
- unknown intervals remain unknown;
- approximate dates cannot become exact;
- different source records cannot be merged without identity evidence;
- provenance status cannot become legal title;
- a missing earlier record cannot be interpreted as first ownership;
- manual mapping must cite its evidence artifact.

## Falsification Criterion

The case fails if Onto2D cannot preserve one physical object identity while
representing multiple historical relational states, uncertainty, and gaps
without inventing a complete chain.

## Definition of Done

A pinned Getty cohort can be reproduced from exact source records, visualized as
a provenance timeline/network, and inspected at the evidence level while
keeping object identity, provenance history, and legal interpretation separate.
