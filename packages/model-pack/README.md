# `@onto2d/model-pack`

```sh
npm install @onto2d/model-pack
```

This package builds and verifies transparent, immutable Onto2D Model Packs.
Semantic files determine `rootHash`; recomputable indexes are verified but do
not redefine model semantics. Every file is content-addressed, unexpected
paths fail closed, and verification reconstructs all indexes from nodes and
edges.

The package is model-neutral. It does not know the Causal Emergence Catalogue,
network aliases, UI layout, or adapter semantics. Separate Node.js and browser
subpaths load the same transparent format without moving filesystem or network
policy into the portable main entrypoint.

```js
import { buildModelPack, verifyModelPack } from "@onto2d/model-pack";

const pack = buildModelPack({
  model: { id: "example", name: "Example", version: "1.0.0" },
  source: { id: "example-source", files: [] },
  nodes: [{ id: "a", level: 0 }],
  edges: [],
  dictionaries: {}
});

verifyModelPack(pack);
```

```js
import {
  loadModelPackArchive,
  loadModelPackDirectory,
  loadModelPackPath
} from "@onto2d/model-pack/node";

const pack = await loadModelPackDirectory("./example.onto2d", {
  maxTotalBytes: 64 * 1024 * 1024
});

const archived = await loadModelPackArchive("./example.onto2d.zip", {
  maxTotalUncompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 200
});

const either = await loadModelPackPath("./example.onto2d.zip");
```

```js
import {
  loadModelPackBundle,
  loadModelPackHttpDirectory
} from "@onto2d/model-pack/browser";

const remote = await loadModelPackHttpDirectory(
  "https://example.org/models/example/1.0.0/"
);

const selected = await loadModelPackBundle(fileInput.files[0]);
```

For browser verification off the UI thread, expose a module-worker entrypoint
through the application's normal bundling or static-asset pipeline:

```js
// model-pack-worker-entry.js
import { installModelPackWorkerEndpoint } from "@onto2d/model-pack/worker";

installModelPackWorkerEndpoint(globalThis);
```

```js
import { createModelPackWorkerClient } from "@onto2d/model-pack/worker";

const worker = new Worker(new URL("./model-pack-worker-entry.js", import.meta.url), {
  type: "module"
});
const client = createModelPackWorkerClient(worker, { ownsWorker: true });

try {
  const pack = await client.loadHttpDirectory(
    "https://example.org/models/example/1.0.0/"
  );
} finally {
  client.close();
}
```

The worker protocol has a fixed name and version, closed message shapes,
bounded request identifiers, request and concurrency limits, timeouts,
`AbortSignal` cancellation, and stable serialized `ModelPackError` values.
Bundle bytes use copy semantics by default. `transfer: "move"` is explicit and
is allowed only for an `ArrayBuffer`, or a view covering its complete buffer;
the caller's buffer is then detached. Closing a client cancels its outstanding
endpoint work and removes every listener and timer.

The endpoint performs the same complete browser verification described below.
The client validates and freezes the returned transport envelope but does not
repeat all hashes on the UI thread. A worker entry containing bare package
specifiers therefore needs a bundler or another worker-compatible module
resolution strategy; document import maps do not resolve worker imports. Model
Studio commits a reproducibly generated self-contained worker asset and uses
the direct browser verifier only as a safe operational fallback.

A read-only registry can resolve one explicit model and version before loading
or caching it:

```js
import {
  matchModelPackRegistryResolution,
  resolveModelPackRegistryHttp
} from "@onto2d/model-pack/registry";

const resolution = await resolveModelPackRegistryHttp(
  "https://example.org/models/registry.json",
  { modelId: "example", version: "1.0.0" },
  { expectedRegistryHash }
);

const pack = await loadModelPackHttpDirectory(resolution.baseUrl);
matchModelPackRegistryResolution(pack, resolution);
```

Registry lookup never accepts an alias or version range. The bounded registry
entry provides both exact Model Pack hashes and one relative directory path;
the resolved URL remains on the registry origin and below its directory. The
HTTP resolver sends no credentials or referrer and rejects redirects. Pinning
the canonical `registryHash` makes registry drift explicit. Without a pin, the
resolution reports `transport-only` and does not claim independent authority.
The matcher binds an already verified pack to model ID, version, root hash, and
manifest hash; it does not replace full Model Pack verification.

For persistent browser reuse, place the separate verified cache above either
the direct bundle verifier or its worker-backed equivalent:

```js
import {
  createIndexedDbModelPackCacheStorage,
  createVerifiedModelPackCache
} from "@onto2d/model-pack/cache";

const storage = createIndexedDbModelPackCacheStorage({
  databaseName: "example-model-cache-v1"
});
const cache = createVerifiedModelPackCache(storage, { ownsStorage: true });

try {
  const result = await cache.load({
    rootHash: expectedRootHash,
    manifestHash: expectedManifestHash
  }, () => loadModelPackHttpDirectory(modelUrl));
  useVerifiedPack(result.pack);
} finally {
  await cache.close();
}
```

The expected identity must contain exact content hashes. A cache hit is still
fully parsed, reconstructed, hashed, canonical-byte checked, and compared with
both expected hashes. Candidates are verified before an atomic commit.
Malformed records are removed before an explicit loader can recover them.
Storage limits and deterministic first-in-first-out eviction are application
policy; they never change Model Pack identity. Use the in-memory adapter for
the same contract without browser persistence.

The directory loader rejects links, unexpected entries, invalid UTF-8, invalid
JSON, incomplete layouts, changed bytes, oversized input, stale indexes, and
hash mismatches. The archive loader accepts a bounded single-disk ZIP32 subset
with stored or Deflate entries. It rejects ZIP64, encryption, data descriptors,
links, path escapes, duplicate or unexpected entries, ambiguous local metadata,
bad CRC-32, unsafe expansion, and content that fails normal Model Pack
verification.

Default archive limits are 64 MiB of input, 32 entries, 16 MiB compressed and
16 MiB uncompressed per entry, 64 MiB total uncompressed content, and a 200:1
per-entry compression ratio. `loadModelPackPath` selects the transport from the
inspected filesystem type rather than trusting a filename extension.

The browser HTTP loader accepts one explicit absolute HTTP(S) base URL without
credentials, query, or fragment. It fetches only the fixed required split JSON
paths, disables redirects and HTTP caching, validates response identity, JSON
media type, declared and received byte counts, UTF-8, JSON, and cumulative
stream limits, then runs full Model Pack reconstruction. Set
`bundle: "required"` to additionally require `bundle.json` to reproduce those
split files exactly. The bundle loader accepts a `Blob`, `ArrayBuffer`, or
array-buffer view and checks its byte limit before parsing and verification.

Default browser limits are 16 MiB per split file, 64 MiB total split content,
64 MiB for a bundle, and 16,384 characters per resolved URL. The adapter does
not discover models, resolve aliases, use a registry, persist a cache itself,
load ZIP archives, retry requests, or repair content. The optional cache
and registry subpaths are higher operational layers and do not weaken this
source contract.
