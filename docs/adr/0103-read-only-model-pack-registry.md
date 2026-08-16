# ADR-0103: Read-only Model Pack registry

Status: implemented decision

Date: 2026-08-16

## Context

Browser loaders can authenticate an explicit Model Pack URL, and the verified
cache can reuse exact releases. Applications still need one narrow way to map
an explicit model ID and version to the exact identity and location that those
layers consume. Embedding aliases, retries, mutable publication operations, or
verification inside discovery would blur existing trust boundaries.

## Decision

`@onto2d/model-pack/registry` publishes a version-1 read-only registry and a
derived resolution contract. A registry is a flat bounded array of entries.
Each entry contains exactly `modelId`, `version`, `rootHash`, `manifestHash`,
and `packPath`. The model/version pair is unique. Identifiers use a narrow
ASCII grammar, paths are relative ASCII directories, and aliases, version
ranges, implicit latest selection, timestamps, and mutable state are absent.

Resolution always requires an explicit `modelId` and `version`. Entries are
normalized into model/version order and receive a domain-separated canonical
`registryHash`; authoring order does not affect that hash. A caller may provide
an expected registry hash. A matching pin produces `hash-pinned`; an unpinned
resolution is marked `transport-only`. A self-reported or transport-only hash
does not establish registry authority.

The resolved Model Pack URL is relative to the registry document. It must stay
on the same origin and within the registry directory. This first contract does
not support CDN indirection or cross-origin pack URLs. Those capabilities need
an explicit future policy rather than URL inference.

The HTTP resolver accepts one absolute HTTP(S) registry URL without
credentials, query, or fragment. It performs one `GET` with no credentials,
redirects, referrer, or HTTP caching. Status, response URL, JSON media type,
declared and streamed byte counts, UTF-8, JSON, entry count, field sets,
identifiers, hashes, paths, and final URL length are bounded and fail closed.
Options and direct registry values reject accessors and unknown fields without
invocation.

A registry resolution is discovery data, not Model Pack verification. The
separate `matchModelPackRegistryResolution` function binds a previously
verified pack to all four release coordinates: model ID, version, root hash,
and manifest hash. It does not duplicate pack reconstruction or hashing.

Model Studio pins the committed `models/registry.json`, resolves the explicit
Causal Emergence release, and then composes its URL and exact identity with the
existing worker and verified cache. Network candidates and cache records are
matched to the resolution before they can be stored or presented. Repository
checks verify every indexed bundle against its resolution and reject a stale
Studio registry pin.

Registry documents, registry hashes, paths, URLs, trust labels, and resolution
objects are operational metadata. They do not enter Model Pack canonical
bytes, `rootHash`, `manifestHash`, kernel behavior, or analysis artifacts.

## Alternatives considered

- Keep one hardcoded Model Pack URL in each application. This was rejected
  because it provides no reusable discovery contract or registry drift check.
- Resolve aliases such as `latest`. This was rejected because a mutable alias
  does not identify one exact release.
- Trust model ID and version without content hashes. This was rejected because
  labels alone cannot bind received bytes.
- Put HTTP loading and verification inside the registry resolver. This was
  rejected because discovery, transport, verification, and caching have
  separate ownership.
- Allow arbitrary absolute pack URLs. This was deferred because cross-origin
  routing requires an explicit trust and credential policy.
- Treat the computed registry hash as self-authenticating. This was rejected;
  authority requires an independently supplied pin or trusted transport.

## Consequences

- applications can resolve an explicit release without weakening Model Pack
  verification or cache validation;
- a pinned registry change is visible and requires an intentional pin update;
- one committed registry can be checked against every indexed bundle;
- the runtime and its complete dependency graph remain browser-safe;
- publication, signing, aliases, version negotiation, mirrors, retries,
  background refresh, and cross-origin pack hosting remain future work.

## Artifacts and acceptance

- runtime and declarations: `packages/model-pack/src/registry.js` and
  `packages/model-pack/src/registry.d.ts`;
- schemas: `model-pack-registry.schema.json` and
  `model-pack-resolution.schema.json`;
- committed index: `models/registry.json`;
- adversarial tests: `packages/model-pack/test/registry.test.mjs`;
- repository check: `scripts/check-model-pack-registry.mjs`;
- Studio composition: `apps/model-studio/model-studio.js`;
- focused checks: `npm run check:registry`, `npm run check:schemas`,
  `npm run check:types`, and the registry/public-site tests;
- repository acceptance: `npm test`, `npm run check`, `npm run check:goldens`,
  and `npm run build`.
