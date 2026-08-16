# ADR-0102: Verified Model Pack cache

Status: implemented decision

Date: 2026-08-16

## Context

ADR-0100 authenticates browser Model Packs and ADR-0101 can move that work off
the UI thread. Re-fetching an immutable release on every page load wastes
bandwidth, but treating browser storage as trusted would let stale, damaged, or
substituted bytes bypass verification. Cache policy also must not become part
of the Model Pack verifier or semantic identity.

## Decision

`@onto2d/model-pack/cache` exposes a verified cache and separate storage
adapters. The caller supplies an exact identity containing both `rootHash` and
`manifestHash`. The cache key contains the manifest hash; after verification,
both expected hashes must match. Aliases, labels, URLs, and model versions are
not cache keys.

Records contain canonical JSON for the complete transparent Model Pack. A read
does not trust the record: it applies the configured complete bundle verifier,
checks canonical bytes, reconstructs the actual identity, and compares it with
the expected exact identity. A write canonicalizes the candidate and sends the
result through that verifier before committing. A malformed, unverifiable, or
non-canonical record is deleted and reported as an invalid cache state so an
explicit loader may recover it. A valid record requested with a conflicting
root hash is not deleted; the request fails with an identity mismatch.

The default verifier is `loadModelPackBundle` from the bounded browser adapter.
Applications may inject the equivalent worker-backed verifier, but the worker
origin remains an application trust boundary as described by ADR-0101. The
cache never interprets a storage read as proof of model validity.

The public in-memory and IndexedDB adapters implement the same closed storage
surface. A commit atomically writes the candidate and enforces explicit limits
for record count, record bytes, and total bytes. Deterministic first-in-first-
out eviction uses a monotonic insertion ordinal, preserving the ordinal when a
key is replaced. It does not use wall-clock time or mutate order on a read.
Database names and inventory scans are bounded, malformed stored metadata is
removed, version changes close stale connections, and late successful opens
after blocking or closure are closed immediately.

Loads for one exact cache key are coalesced. Remove waits for that key, while
clear and close wait for all active loads. Whether the cache owns and closes
its storage is explicit. Errors use stable `ModelPackError` codes, and custom
storage results are validated before use.

Model Studio declares the exact identity of its bundled release. It first asks
the verified cache, sends cached canonical bytes through the Model Pack worker,
and only then exposes the model to the view layer. A miss is fetched and
verified before storage. Cache storage availability and operational failures
may fall back to uncached loading; Model Pack verification and identity errors
do not. The UI distinguishes hit, miss, recovery, and unavailable storage for
diagnostics without changing scientific output.

Cache bytes, keys, insertion ordinals, IndexedDB metadata, eviction, and hit or
miss state do not enter canonical Model Pack bytes, `rootHash`, `manifestHash`,
kernel behavior, or analysis artifacts.

## Alternatives considered

- Trust IndexedDB records after the first verification. This was rejected
  because browser storage is not an integrity boundary.
- Key only by model name and version. This was rejected because aliases and
  mutable release labels cannot identify exact content.
- Store worker result objects directly. This was rejected because canonical
  bytes provide one portable record contract and expose non-canonical drift.
- Use least-recently-used eviction. This was rejected because access-time
  mutation and clocks add hidden policy and nondeterminism.
- Put caching inside the HTTP loader. This was rejected because transport,
  verification, storage, and application fallback have separate ownership.
- Recover every cache error through the network. This was rejected because
  verification and identity failures must remain visible hard failures.

## Consequences

- repeat browser loads can avoid network transfer without avoiding complete
  verification;
- corrupted or stale records fail closed and can be replaced only by a newly
  verified exact release;
- applications choose storage, limits, worker use, and operational fallback;
- the IndexedDB adapter is browser-safe and the complete cache module graph has
  no Node dependency;
- read-only registry resolution is specified by
  [ADR-0103](0103-read-only-model-pack-registry.md); aliases, retries,
  background refresh, cross-tab locking, encryption, and service-worker
  caching remain outside this milestone.

## Artifacts and acceptance

- runtime and declarations: `packages/model-pack/src/cache.js` and
  `packages/model-pack/src/cache.d.ts`;
- adversarial contract tests: `packages/model-pack/test/cache.test.mjs`;
- Studio integration: `apps/model-studio/model-studio.js`;
- focused checks: `npm run check:types`, `npm run check:workspace`, the cache
  contract tests, and the public-site tests;
- repository acceptance: `npm test`, `npm run check`, `npm run check:goldens`,
  and `npm run build`.
