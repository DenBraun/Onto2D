# ADR 0114: Preserve evidence boundaries in artwork provenance

## Status

Accepted — 2026-08-18.

## Decision

The Artwork Provenance case binds exact Getty Linked.Art entity responses and one exact SPARQL result, then represents five different things separately: artwork records, acquisition activities, source records, current-context relations, and unknown intervals.

History equality is regime-relative. The evidence-only and gap-explicit views are equal by exact artwork URI, known activity sequence, and role-insensitive actor set; distinct when explicit missingness is part of the chain; and unresolved when a complete evidence-backed chain is required.

`transferred_title_of` is retained as Getty's native acquisition relation but never treated as an Onto2D legal-title finding. `current_owner` and `current_location` remain separate source relations. Source-record co-occurrence does not infer ownership. Approximate dates remain bounded intervals. Missingness may be represented, but its content may not be invented.

Historical Load is not evaluated: the bounded source does not declare a finite candidate-chain space, admissibility predicate, or defensible chain cost. The value is `null`, not zero.

## Consequences

The case is narrower than a provenance catalogue or restitution analysis. It can demonstrate identity-policy effects and evidence gaps reproducibly, but cannot establish authenticity, present legal title, transaction validity, a complete ownership chain, or relations outside the frozen snapshot.
