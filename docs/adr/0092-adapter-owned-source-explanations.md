# ADR-0092: Adapter-owned source explanations and closed kernel registry

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0067 implements complete source-node, relation, and raw-SCC explanations
in `@onto2d/catalog-adapter`. Its verifier must replay policy, view,
annotations, adjudication, amendments, effective relations, node resolution,
condensation, reconciliation, metrics, and the explanation index itself.

The kernel exposed an `explainSource()` method that could never receive or
replay that chain and always threw `KERNEL_NOT_IMPLEMENTED`. Implementing it by
importing the catalogue adapter would invert the required dependency direction.
Implementing it from the `ArtifactRef`-only ADR-0091 package manifest would
mistake reference labels for verified artifact contents.

## Decision

Source-migration explanation construction, verification, and lookup remain
owned by `@onto2d/catalog-adapter`:

```js
const session = createSourceMigrationExplanationSession(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reconciliation,
  metrics,
  explanationIndex
);

const explanation = session.explain({ kind: "source-node", id: sourceId });
```

The unusable `kernel.explainSource()` facade is removed. Candidate explanation
lookup remains on a kernel instance only because its complete semantic inputs
and explanation indexes are embedded in a verified kernel run-artifact store.
The generic `requireKernelCapability()`/`KernelNotImplementedError` placeholder
surface is removed with it; unsupported concrete inputs continue to use their
stage-specific fail-closed errors.

The kernel capability registry no longer lists adapter algorithms or authored
research/application inputs as pending kernel work. Its pending list is empty.
This means the published schema-v1 kernel API has no known placeholder
operation; it does not claim that current-catalogue research inputs, remote
stores, user interfaces, or deployment applications already exist.

## Consequences

- No public kernel method advertises a result it cannot verify.
- Source explanations remain fully executable through the layer that owns and
  can replay their complete source chain.
- The dependency direction remains catalogue adapter to kernel, never kernel
  to catalogue adapter.
- Applications may bind a verified adapter explanation session beside a
  kernel artifact-store session without merging their trust boundaries.
- Kernel closure review can treat external research data and application
  integrations as inputs/follow-up work instead of false implementation gaps.

## Verification

Kernel contract tests require an empty pending registry and absence of the
dead facade. Catalogue-adapter fixtures continue to cover exact full-chain
replay, bound node/relation/raw-component queries, missing subjects, and
tamper rejection.
