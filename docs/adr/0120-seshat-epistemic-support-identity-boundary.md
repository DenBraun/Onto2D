# ADR 0120: Preserve exact epistemic support identity for historical coding claims

Date: 2026-08-23

Status: Accepted

## Context

Polaris-2026 and the public Seshat API expose the same categorical Road result
for three bounded polities. Equality of `P` / `present` does not establish that
the public narratives, cited records, mapped source works, actors, review
events, or derivation histories are equal.

The public datum serializer also excludes curator, citations, review flags, and
intervention timestamps. Missing export fields cannot safely be replaced with
polity-level metadata, confidence tags, or locally guessed identities.

## Decision

The Seshat case pins Codebook `4.20.2021` by content hash and keeps artifact kind, derivation operation, resolution state,
evidence basis, review status, agreement status, and precision as independent
validated axes. Exact native codes round-trip through a closed case-local map;
the source spelling remains part of the claim. Numeric range lexemes and
integer/null time bounds have separate exact round-trip contracts. Unknown,
disputed, transitional, and inferred forms cannot satisfy the direct-attestation
firewall.

A coding claim's exact support identity is the domain-separated hash of its
canonical labelled support DAG closure. The closure includes the claim
identity, mapping identity, evidence-node identities, required typed edges, and
support-group membership. Aggregate composition is descriptive only and cannot
substitute for labelled-DAG equality.

Inline Seshat reference payloads use a versioned explicit local mapping to
source-work groups. This mapping remains distinguishable from a native Seshat
stable citation identifier and makes no independence claim.

Group ablation uses required, conjunctive dependency semantics for this MVP.
Removing a group creates a new graph and transitively removes its dependents.
It cannot mutate the source graph. Outputs preserve exact removed IDs and the
raw categorical resolution transition; no threshold or qualitative stability
label is added. `FirstCategoricalFlip` records the minimum supported group
removal that changes `present` to the categorical response `unresolved`; the
resolution response remains separately recorded as `Resolved -> Unknown`.
Unavailable group types return `null` with an exact reason.

The MIT license of the pinned Polaris build repository and the CC BY-SA 4.0
license of Seshat Public Data are separate scopes. The Public Data terms
response and the compact authority projection are content-addressed, and the
adapted source projection retains attribution and the ShareAlike boundary.

Unavailable per-datapoint RA, expert, reviewer, review-event, and timestamp
relations remain unavailable. The case does not synthesize their nodes or
cuts. Historical Load remains `null` because the case does not declare a path
space, cost, or history-free baseline.

## Consequences

The three claims can remain equal under the native value regime and different
under exact support identity. Egypt and Cahokia admit source-work group
ablations under the declared local mapping; Roman Principate has no exported
source marker and therefore no public source-work cut in this release.

Changing any labelled node, edge, claim identity, or mapping identity changes
the exact support hash. Adding public actor or review metadata requires a new
source lock and release identity. The Explorer can display dependency mechanics
but cannot rank polities, evidence regimes, source quality, or historical truth.
