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
network aliases, UI layout, or adapter semantics. The optional Node.js subpath
loads the same transparent format from a bounded local directory without adding
filesystem code to the browser-safe main entrypoint.

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
import { loadModelPackDirectory } from "@onto2d/model-pack/node";

const pack = await loadModelPackDirectory("./example.onto2d", {
  maxTotalBytes: 64 * 1024 * 1024
});
```

The directory loader rejects links, unexpected entries, invalid UTF-8, invalid
JSON, incomplete layouts, changed bytes, oversized input, stale indexes, and
hash mismatches. Archive and remote transports remain separate future work.
