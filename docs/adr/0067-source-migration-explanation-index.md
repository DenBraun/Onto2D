# ADR-0067: Source-migration explanation index

- Status: accepted
- Date: 2026-08-12

## Context

The reviewed migration chain now reaches complete metrics, but consumers still
need a deterministic way to answer what happened to one source node, relation,
or raw SCC. Recomputing joins in a UI would duplicate semantic logic, while an
ambient lookup over unverified files could combine an object with a different
policy, amendment log, resolution, or metric result.

The architecture requires source explanations to retain classification and
condensation lineage. This can be implemented generically before the current
catalogue has authored research inputs, provided the index accepts only a
fully verified migration chain.

## Decision

`@onto2d/catalog-adapter` implements
`source-migration-explanation-index-v1`. Construction exactly replays the
complete ADR-0066 metric chain and binds the policy, amendments, projection,
resolution, condensation, reconciliation, and metrics identities.

The index contains:

- one record per source node with normalized source identity/artifact, source
  catalogue level, resolved vertex and cluster disposition, all co-members,
  raw-SCC membership, and sorted incoming/outgoing source relations;
- one record per source relation with endpoints, frozen and effective kinds,
  blind decision status and raw kinds, amendment state/change identities,
  resolved endpoint vertices, typed destination, and raw-SCC membership;
- every complete raw-SCC disposition and rationale already verified by the
  migration metrics artifact.

All inventories and statistics are derived from verified upstream artifacts,
sorted canonically, and hashed under
`onto2d:source-migration-explanation-index:v1`.

Serialized indexes must be replayed before lookup. The adapter exposes a bound
in-memory session which performs that replay once and then accepts only exact
queries for `source-node`, `source-relation`, or `raw-component`. Every result
binds the index hash and query and is independently content-addressed under
`onto2d:source-migration-explanation:v1`. Missing or malformed queries fail
explicitly.

## Consequences

- Presentation code no longer needs to reconstruct scientific lineage or join
  mutable inputs.
- Isolated source records remain explainable even with no incident relations
  or raw SCC membership.
- Post-unblinding changes remain visible beside the frozen kind and raw votes.
- A raw SCC's reviewed rationale and resulting cluster, when any, are returned
  from the same verified index.
- An application-level persistent migration store and the actual reviewed
  current-catalogue migration remain pending; no ambient `kernel.explainSource`
  result is fabricated.
- The index is suitable input for application-owned presentation layers.

## Verification

Fixtures cover isolated-node lookup, unchanged and amended relation lineage,
raw-component lookup, exact index/result hashes, schema conformance, full
serialized replay, missing queries, tampered indexes, and Node.js 22/24 CI.
