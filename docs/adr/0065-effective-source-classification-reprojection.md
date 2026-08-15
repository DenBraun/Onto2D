# ADR-0065: Effective source-classification reprojection

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0064 preserves approved post-unblinding changes in a separate immutable
log and deliberately prevents a non-empty log from being combined with the
old classified projection. The next migration step must apply those changes
without erasing the blind decisions, recompute both SCC projections, and bind
all later reviewed source-resolution artifacts to the changed topology.

Editing `source-classified-relations-v1` in place would destroy the distinction
between frozen blind evidence and the current effective classification. Merely
changing relation labels without recomputing SCC identities would leave stale
component decisions and could silently invalidate the condensation DAG.

## Decision

`@onto2d/catalog-adapter` implements
`source-effective-classified-relations-v1`. Its constructor exactly replays:

1. the frozen policy, visible classification view, annotations, and
   adjudication;
2. the original `source-classified-relations-v1` projection;
3. the immutable amendment log and every per-relation state chain.

For every source relation the effective artifact retains the frozen kind,
blind decision status, raw classifier kinds, final state hash, and ordered
change identities while exposing the effective kind used downstream. The
artifact binds the original projection and amendment-log hashes, recomputes
the generative and formation-support SCCs from effective kinds, records
effective counts, and receives a separate content identity under
`onto2d:source-effective-classified-relations:v1`.

The existing reviewed resolution and condensation algorithms may consume
either the frozen projection or the effective projection. An effective
projection requires its amendment log during exact replay. Conversely, a
non-empty log cannot accompany the frozen projection. Any changed SCC
identities, component membership, relation destinations, vertices, quotient,
or topological order therefore require new reviewed downstream inputs and
produce new hashes. Empty amendment logs remain compatible with the original
projection and may also be represented by an effective projection.

Migration reconciliation accepts effective projections, verifies the full
amendment-aware chain, and reports metrics over current effective kinds. If a
non-empty log is paired with the frozen projection, it still fails explicitly
with `SOURCE_MIGRATION_REPROJECTION_REQUIRED`.

## Consequences

- Approved corrections are executable without rewriting blind evidence.
- SCC and quotient changes cannot inherit stale reviewed decisions unnoticed.
- Every relation and node remains exactly reconciled after reprojection.
- Schemas and TypeScript declarations distinguish frozen and effective
  classified artifacts while resolution/condensation retain their existing
  projection-hash-bound output contracts.
- This mechanism does not author current-catalogue changes, policies,
  annotations, or component dispositions. Those research inputs and the
  loadable migration package remain pending.

## Verification

Fixtures apply an approved descriptive-to-generative change, prove the
per-relation state lineage and independent projection hash, recompute a larger
formation-support SCC, require fresh component and destination decisions,
rebuild the condensation DAG, and reproduce amended migration diagnostics.
They also cover stale frozen projections, missing amendment logs, tampered
effective artifacts, JSON Schema conformance, and Node.js 22/24 CI execution.
