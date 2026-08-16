# ADR 0095: Lineage, Local Loading, and First Registered Analysis

- Status: Accepted
- Date: 2026-08-16

## Context

The first engine milestone could compare releases only as unrelated structures,
accepted Model Packs only as in-memory objects, and had no bundled reusable
analysis. The next release does not yet exist, so its scientific lineage cannot
be authored honestly.

## Decision

- Define content-addressed lineage sidecars that bind ordered model IDs,
  versions, and semantic root hashes. Registration and diff replay reject
  nonexistent entities, reversed releases, stale hashes, and events unsupported
  by the structural change.
- Keep lineage outside the Model Pack root contract for now. Binding a record
  into a future pack manifest is deferred until a real second release establishes
  the required direction and packaging needs without a self-referential root.
- Add bounded transparent-directory loading only under
  `@onto2d/model-pack/node`; keep the main verifier and engine browser-safe.
- Publish Canonical Identity as an analysis package that calls the existing
  kernel operation. The root facade registers it by default and the static lab
  remains a projection of frozen fixtures.

## Consequences

Diff output can display lineage only when a verified declaration exists. Local
loading does not imply archive, remote, or executable-pack support. Analysis
artifacts now record the exact model and engine contract and can be replayed,
while kernel semantics remain unchanged.
