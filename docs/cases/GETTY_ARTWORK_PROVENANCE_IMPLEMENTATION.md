# Getty Artwork Provenance — Implementation

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded
    Reconstructed

Primary effects:
    Identity

Domain:
    Cultural heritage

Evidence profile:
    direct-record
    derived
    reconstructed
    unknown

Historical Load:
    Not primary

History Equivalence:
    Primary

Reachability:
    Not primary

Reconstruction:
    Secondary
```

## Result

Artwork Provenance is an analysis-ready Recorded + Reconstructed History → Identity case built from the Getty Provenance Index Linked.Art API. It is intentionally a bounded identity and evidence experiment, not a complete provenance, legal-title, authenticity, or restitution analysis.

The frozen cohort contains four exact `HumanMadeObject` responses, A1981–A1984, connected by one Getty purchase Activity. A1983 (`James Christie`) is the flagship because the bounded source also includes a later sale Activity, two stock-book `LinguisticObject` records, and current-owner/current-location relations. Every external response, the exact SPARQL label query, and its response are committed with byte counts and SHA-256 locks. Reproduction is offline.

## Primary result

Two views of A1983 are compared:

- `evidence-only`: purchase, sale, current context;
- `gap-explicit`: purchase, sale, an explicit unknown interval, current context.

They are equal by exact Getty artwork URI, directly encoded activity sequence, and role-insensitive actor set. They are distinct when explicit missingness is part of history. They are unresolved under a complete-evidence-chain rule because neither view is complete. Equality is therefore local to a named regime, not a global claim.

Historical Load is not evaluated. No finite candidate-chain space, admissibility predicate, or defensible cost has been declared. The stored value is `null`, meaning undefined—not zero.

## Evidence boundary

- Getty `transferred_title_of`, `transferred_title_from`, and `transferred_title_to` relations remain native source statements. Onto2D does not treat them as a legal-title determination.
- `current_owner` and `current_location` remain separate current-context relations with unknown start dates.
- A source record referring to an object does not infer ownership.
- Getty time spans remain bounded. `1938-09-00` is month-bounded; no approximate label becomes an exact instant.
- The interval after the sale has `contents: null`, `assertedTransfer: false`, and `evidenceState: unknown`.
- No alternative history is invented merely to populate the interface.

## Source and license

Primary documentation:

- <https://data.getty.edu/provenance/docs/>
- <https://www.getty.edu/databases-tools-and-technologies/provenance/gpi-user-guide/>
- <https://www.getty.edu/databases-tools-and-technologies/provenance/whats-covered/>

The frozen source data is published under CC0. Attribution is retained as requested: Getty Provenance Index®, J. Paul Getty Trust. Getty does not endorse Onto2D or this interpretation.

## Outputs

```text
cases/getty-artwork-provenance/
models/artwork-provenance/
apps/artwork-provenance-identity-lab/
docs/adr/0114-artwork-provenance-evidence-boundary.md
```

Run:

```sh
npm run case:artwork-provenance:verify
npm run model:artwork-provenance:verify
node --test cases/getty-artwork-provenance/tests/getty-artwork-provenance.test.mjs
node --test models/artwork-provenance/compiler.test.mjs
node --test apps/artwork-provenance-identity-lab/artwork-provenance-model.test.mjs
```
