# Onto2D Engine Architecture

Status: release-quality engine milestone implemented on 2026-08-16.

## Layers

```text
applications and root facade
       /                  \
      v                    v
@onto2d/view        @onto2d/engine
                           /     \
                          v       v
              @onto2d/model-pack  analyses
                          \       /
                           v     v
                       kernel + schemas
```

`@onto2d/engine` is a headless, catalogue-independent facade. It resolves an
exact Model Pack before exposing a model. The repository root facade bundles
the frozen Causal Emergence snapshot and provides `stable` and `latest`
aliases for convenience; the root package remains private while this preview
API is reviewed.

```js
import { Onto2D } from "onto2d";

const engine = await Onto2D.create();
const model = engine.model;
const node = model.require("0.8");
const parents = model.parents(node.id);
```

The model API provides immutable reads, deterministic filtering, parent and
child traversal, ancestors, descendants, bounded neighborhoods, and bounded
all-shortest directed paths. It does not assign new scientific meaning to
source relations.

The root facade also registers `canonical-identity`. It calls the kernel's
canonicalizer and returns a replayable artifact bound to the exact selected
Model Pack; it does not duplicate canonicalization logic.

`@onto2d/view` is a separate dependency-free presentation boundary. It accepts
explicit node and edge arrays and returns catalogue, bounded neighborhood, and
SVG-ready layout projections. It does not authenticate packs, import the
engine, or place coordinates in semantic hashes. The static Model Studio uses
this layer over the bundled release and discloses that browser-side count and
shape checks are not a replacement for Model Pack verification.

## Model Pack contract

A transparent Model Pack contains a manifest plus canonical JSON files for
nodes, edges, dictionaries, and rebuilt indexes. Verification rejects missing,
extra, stale, or hash-mismatched content.

- `rootHash` identifies semantic model content, compatibility, and exact source.
- `manifestHash` also binds release metadata and derived indexes.
- indexes are accelerators only; verification rebuilds them from model files.
- aliases resolve to an exact model version before a `Model` is returned.

Node.js applications may load the transparent split format through
`@onto2d/model-pack/node`. The bounded directory loader accepts only the known
JSON layout and rejects links, unexpected entries, invalid UTF-8, invalid JSON,
resource-limit violations, stale indexes, and hash drift. Archive and remote
transports are not implied by this local loader.

The bundled Causal Emergence pack is compiled reproducibly from the preserved
`scr/` snapshot. Its 971 relations are labelled `source-parent`: they have not
yet passed reviewed migration into a stronger generative relation. The pack
also records the current catalogue audit, including three known weight-sum
anomalies and uncovered requirements. Compilation does not silently repair
those source facts.

## State and comparison

Each `Workspace` owns independent model instances and explicit run bindings.
A referenced model cannot be removed, and a changed root hash cannot replace
an existing exact version. Structural diff reports added, removed, and changed
nodes and edges. Without a registered record it reports lineage as
`not-declared`. A declared lineage record binds both exact release identities,
has its own hash, and is accepted only when every event is supported by the
actual diff. Similar labels or identifiers never create implicit lineage.

## Boundaries

This milestone does not add kernel semantics, a UI framework, archive or remote
loading, an RDF/OWL adapter, empirical Historical Load values, or a fabricated
second release for Studio comparison. Analyses must be registered explicitly.
Deferred engineering work is listed in the
[Engine Roadmap](ENGINE_ROADMAP.md); scientific dependencies remain in the
[Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
