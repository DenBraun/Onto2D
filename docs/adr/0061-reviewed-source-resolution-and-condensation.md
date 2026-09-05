# ADR-0061: Reviewed source resolution and lossless condensation

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0012 freezes the node-resolution policy and ADR-0014 produces verified
classified relations plus generative and formation-support SCC projections.
The next deterministic step must reconcile isolated source records, reviewed
component dispositions, and every classified relation without choosing a
scientific interpretation from topology alone.

The current catalogue still has no authored classification policy, independent
annotation set, reviewed component dispositions, or rationale artifacts. The
implementation therefore needs to execute caller-supplied reviewed inputs
without pretending those missing research decisions already exist.

## Decision

`@onto2d/catalog-adapter` implements two fully replayable artifacts:

- `source-node-resolution-v1`;
- `source-condensation-v1`.

Resolution first reproduces the complete classification policy, visible view,
annotations, adjudication, and classified-relation projection. It also
reproduces the frozen node-resolution policy. The caller must provide:

- a complete source-node inventory, including isolated records, with one
  normalized identity hash and source `ArtifactRef` per record;
- exactly one reviewed disposition and rationale artifact for every
  multi-member cyclic formation-support component;
- exactly one reviewed destination for every classified relation.

The adapter derives the partition; callers cannot submit arbitrary cluster
members. Every multi-member cyclic component becomes one content-addressed
cluster vertex. A projected singleton self-loop remains one source vertex but
has undefined internal order. Every other source record maps to one individual
vertex, including records absent from all relation endpoints.

Relation destinations are checked against typed endpoints:

- a formation-support relation whose endpoints resolve to one vertex is
  `internal`;
- an inter-vertex `generative` relation is `inter-cluster`;
- every other relation is `typed-explanation`.

This check prevents a reviewed destination from hiding a generative dependency
or converting a non-generative relation into stratification precedence. The
resolution records every relation exactly once and reconciles every source
node exactly once.

Condensation retains all six relation-kind layers, including internal and
nonformation relations. Its quotient contains only inter-vertex generative
edges and must admit a deterministic complete topological order. A cyclic
quotient fails closed. Vertex identities bind normalized member identities,
complete internal typed relations, disposition, and node-resolution policy;
artifact timestamps and reviewer identities remain provenance.

Both artifacts use separate hash domains and exact serialized replay. Input
ordering, SCC traversal order, decision order, and relation order cannot change
their identities. JSON Schemas and TypeScript declarations cover both results.

## Consequences

- Generic source-node resolution and condensation are executable without
  importing catalogue semantics into the kernel.
- Isolated nodes cannot disappear, arbitrary clusters cannot be injected, and
  every edge remains queryable in one typed layer.
- The generative quotient is a verified DAG rather than an assumed property.
- Applying the mechanism to `references/`, authoring policies, collecting independent
  annotations, reviewing dispositions/rationales, computing migration metrics,
  and producing a loadable `sourceMigration` package remain explicit pending
  research/application work.
- The complete metric and generic explanation-index contracts are added later
  by ADR-0066 and ADR-0067; the actual reviewed migration package remains an
  input gate.
