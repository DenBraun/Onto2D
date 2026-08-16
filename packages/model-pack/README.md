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
not discover models, resolve aliases, use a registry, persist a cache, load ZIP
archives, retry requests, or repair content. Those policies belong to higher
operational layers.
