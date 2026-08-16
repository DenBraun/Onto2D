# ADR-0104: Lazy presentation over verified Model Packs

Status: implemented decision

Date: 2026-08-16

## Context

Model Studio authenticated a complete Model Pack, then passed full node records
through every catalogue and graph projection. That is acceptable for the first
249-node release but scales poorly: list rows and local graph nodes do not need
descriptions, evidence, requirements, or other heavy source fields. Loading a
partial semantic population would be worse because a user could mistake an
incomplete presentation source for a complete analysis input.

The Model Pack v1 manifest has monolithic semantic files. Changing their
physical partitioning would create a new format and new release hashes, so
transport chunking is not part of this milestone.

## Decision

Add `@onto2d/view/lazy` as a browser-safe, dependency-free presentation
session. A session is created from explicit node and edge arrays plus the exact
model ID, version, root hash, and manifest hash. It exposes four bounded,
read-only operations:

- `descriptor` returns identity, counts, facets, and explicit capabilities;
- `catalog()` returns one deterministic page of lightweight node summaries;
- `neighborhood()` returns bounded lightweight nodes and edges suitable for
  deterministic layout;
- `inspect()` is the only operation that returns a complete node record and it
  bounds displayed relation summaries.

Every response carries the same exact model identity and uses the versioned
`onto2d-model-presentation` envelope. Catalogue and neighborhood results omit
the original `data` records. Limits, input shapes, unknown fields, accessors,
prototype-sensitive keys, closure, and missing nodes fail with stable
`ViewError` codes. Descriptor and projection envelopes have published JSON
Schemas.

The view package still does not authenticate its input. Add the browser-safe
`@onto2d/engine/presentation` bridge as the authoritative constructor for
verified applications. It fully verifies the supplied Model Pack again and,
when supplied, matches the exact read-only registry resolution before creating
the view session. The bridge then copies all four verified identity coordinates
into every presentation response.

Model Studio keeps registry resolution, worker verification, and verified
cache reuse upstream. Only after those checks does it create the presentation
session. Explorer initially materializes 60 lightweight rows and obtains later
pages through an explicit `Load next` action. Graph changes request a bounded
neighborhood; node inspection requests the full record independently. A click
still inspects and a double-click still changes graph focus.

Presentation paging is operational only. It does not create a model, semantic
artifact, analysis population, cache identity, or alternate hash. Complete
analysis still requires a fully materialized and verified source population.

## Alternatives considered

- Treat the current monolithic Model Pack files as independently trusted
  chunks. Rejected because Model Pack v1 defines complete pack verification.
- Add presentation files to the current manifest. Rejected because that would
  change the frozen release and its manifest hash.
- Return full records in every catalogue page and graph node. Rejected because
  the API would be paged in name only.
- Let Studio construct an identity object from unverified data. Rejected; the
  engine bridge must derive identity from a fully verified pack and optionally
  bind it to registry resolution.
- Move filters, selection, or layout into semantic identity. Rejected because
  those remain presentation state.

## Consequences

- large verified models can bound UI materialization without weakening pack
  verification;
- a consumer can distinguish lightweight catalogue/graph data from explicit
  full-record inspection;
- Model Pack v1, kernel identity, the frozen Causal Emergence release, registry
  contents, and conformance goldens remain unchanged;
- physical level/domain/namespace/subgraph transport chunking remains a future
  Model Pack format decision;
- the next large engine milestone can move to the narrow RDF import profile
  without coupling adapter semantics to this presentation layer.

That follow-up boundary is defined by
[ADR 0105](0105-narrow-rdf-import-profile.md). It does not make presentation
sessions responsible for importing or interpreting RDF.

## Artifacts and acceptance

- projection runtime and declarations: `packages/view/src/lazy.js` and
  `packages/view/src/lazy.d.ts`;
- verified bridge: `packages/engine/src/presentation.js` and
  `packages/engine/src/presentation.d.ts`;
- schemas: `model-presentation-descriptor.schema.json` and
  `model-presentation-projection.schema.json`;
- adversarial tests: `packages/view/test/lazy.test.mjs` and
  `packages/engine/test/presentation.test.mjs`;
- Studio composition: `apps/model-studio/model-studio.js`;
- browser acceptance: initial 60-row page, explicit 120-row continuation,
  independent inspection, bounded graph, and cache-hit reload;
- repository acceptance: `npm test`, `npm run check`, `npm run check:goldens`,
  and `npm run build`.
