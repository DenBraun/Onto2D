# Artwork Provenance

Case ID: `artwork-provenance`. [History case registry](../history-case-registry.json).

- [Artwork Provenance — use and reproduction](#artwork-provenance--use-and-reproduction)
- [Artwork Provenance — source and interpretation](#artwork-provenance--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="artwork-provenance--use-and-reproduction"></a>

## Artwork Provenance — use and reproduction

This case projects a deliberately small, source-locked Getty Provenance Index cohort into Onto2D. Four exact `HumanMadeObject` records (`A1981`–`A1984`) share one purchase activity; `A1983` also carries a later sale, two stock-book records, and current-context relations.

The extractor keeps source statements, derived comparisons, reconstructed missingness, and unknown content separate. A Getty `transferred_title_of`, `current_owner`, or source-record co-occurrence is preserved as the relation encoded by Getty; none is promoted to a legal-title determination. Dates remain intervals, the post-1938 transition remains an explicit gap, and no alternative chain is invented.

Run `npm run case:artwork-provenance`, then verify with `npm run case:artwork-provenance:verify` and `node --test cases/getty-artwork-provenance/tests`.

The committed source snapshots are CC0 Getty data. See `upstream.json` for exact entity URLs, retrieval metadata, byte counts, SHA-256 locks, source documentation, and attribution guidance.

<a id="artwork-provenance--source-and-interpretation"></a>

## Artwork Provenance — source and interpretation

<a id="artwork-provenance--source-and-interpretation--result"></a>

### Result

Artwork Provenance is an analysis-ready Recorded + Reconstructed History → Identity case built from the Getty Provenance Index Linked.Art API. It is intentionally a bounded identity and evidence experiment, not a complete provenance, legal-title, authenticity, or restitution analysis.

The frozen cohort contains four exact `HumanMadeObject` responses, A1981–A1984, connected by one Getty purchase Activity. A1983 (`James Christie`) is the flagship because the bounded source also includes a later sale Activity, two stock-book `LinguisticObject` records, and current-owner/current-location relations. Every external response, the exact SPARQL label query, and its response are committed with byte counts and SHA-256 locks. Reproduction is offline.

<a id="artwork-provenance--source-and-interpretation--primary-result"></a>

### Primary result

Two views of A1983 are compared:

- `evidence-only`: purchase, sale, current context;
- `gap-explicit`: purchase, sale, an explicit unknown interval, current context.

They are equal by exact Getty artwork URI, directly encoded activity sequence, and role-insensitive actor set. They are distinct when explicit missingness is part of history. They are unresolved under a complete-evidence-chain rule because neither view is complete. Equality is therefore local to a named regime, not a global claim.

Historical Load is not evaluated. No finite candidate-chain space, admissibility predicate, or defensible cost has been declared. The stored value is `null`, meaning undefined—not zero.

<a id="artwork-provenance--source-and-interpretation--evidence-boundary"></a>

### Evidence boundary

- Getty `transferred_title_of`, `transferred_title_from`, and `transferred_title_to` relations remain native source statements. Onto2D does not treat them as a legal-title determination.
- `current_owner` and `current_location` remain separate current-context relations with unknown start dates.
- A source record referring to an object does not infer ownership.
- Getty time spans remain bounded. `1938-09-00` is month-bounded; no approximate label becomes an exact instant.
- The interval after the sale has `contents: null`, `assertedTransfer: false`, and `evidenceState: unknown`.
- No alternative history is invented merely to populate the interface.

<a id="artwork-provenance--source-and-interpretation--source-and-license"></a>

### Source and license

Primary documentation:

- <https://data.getty.edu/provenance/docs/>
- <https://www.getty.edu/databases-tools-and-technologies/provenance/gpi-user-guide/>
- <https://www.getty.edu/databases-tools-and-technologies/provenance/whats-covered/>

The frozen source data is published under CC0. Attribution is retained as requested: Getty Provenance Index®, J. Paul Getty Trust. Getty does not endorse Onto2D or this interpretation.

<a id="evidence-contract"></a>

## Evidence contract

The Artwork Provenance case binds exact Getty Linked.Art entity responses and one exact SPARQL result, then represents five different things separately: artwork records, acquisition activities, source records, current-context relations, and unknown intervals.

History equality is regime-relative. The evidence-only and gap-explicit views are equal by exact artwork URI, known activity sequence, and role-insensitive actor set; distinct when explicit missingness is part of the chain; and unresolved when a complete evidence-backed chain is required.

`transferred_title_of` is retained as Getty's native acquisition relation but never treated as an Onto2D legal-title finding. `current_owner` and `current_location` remain separate source relations. Source-record co-occurrence does not infer ownership. Approximate dates remain bounded intervals. Missingness may be represented, but its content may not be invented.

Historical Load is not evaluated: the bounded source does not declare a finite candidate-chain space, admissibility predicate, or defensible chain cost. The value is `null`, not zero.
