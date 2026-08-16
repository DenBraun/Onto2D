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

## Command-line composition

`@onto2d/cli` is a separate read-only operational package. Its `verify`
command uses the `@onto2d/model-pack/node` source loader for either a split
directory or a ZIP file; model queries first obtain that verified pack and then
call the public `@onto2d/engine` API. The CLI never imports the kernel, reads
semantic files around the loader, repairs a pack, extracts an archive onto the
filesystem, or writes into the source.

Successful commands emit a versioned deterministic JSON envelope. CLI output
is an operational projection, not a Model Pack file, semantic artifact, cache,
or new model identity. Usage failures, rejected data, and internal failures
have distinct stable exit codes.

`@onto2d/view` is a separate dependency-free presentation boundary. It accepts
explicit node and edge arrays and returns catalogue, bounded neighborhood, and
SVG-ready layout projections. It does not authenticate packs, import the
engine, or place coordinates in semantic hashes. The static Model Studio uses
the browser Model Pack adapter to authenticate the complete bundled release,
then passes only the verified node and edge arrays into this view layer.

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
resource-limit violations, stale indexes, and hash drift.

The same subpath accepts a strict single-disk ZIP32 transport containing the
identical root-relative layout. Only stored and Deflate entries are supported.
The loader checks central and local metadata, entry types, CRC-32, UTF-8, JSON,
required and unexpected paths, per-entry compressed and uncompressed sizes,
total expansion, and compression ratio before normal Model Pack verification.
It rejects duplicate entries, links, encryption, data descriptors, ZIP64,
alternative path metadata, non-contiguous records, and changed archive bytes.
ZIP encoding and transport metadata do not enter `rootHash` or `manifestHash`;
only the verified extracted Model Pack does. The ZIP loader does not fetch
remote content.

Browser applications may use `@onto2d/model-pack/browser`. Its HTTP directory
loader accepts one explicit absolute HTTP(S) base URL and requests only the
fixed required JSON paths. Credentials in the URL, query strings, fragments,
redirects, opaque responses, response-URL drift, non-JSON media types,
malformed `Content-Length`, invalid UTF-8 or JSON, and per-file or cumulative
stream-limit violations fail closed. A declared length must equal the received
byte count. An optional required `bundle.json` must reproduce the authoritative
split files exactly. The same entrypoint accepts bounded raw JSON bundle bytes
or a `Blob`; it does not interpret ZIP data.

The browser verifier reaches kernel identity only through the narrow
`@onto2d/kernel/canonical` entrypoint. That entrypoint contains the same
canonicalization and synchronous SHA-256 behavior as the full kernel without
loading Node-only Oracle or graph modules into the browser module graph.

Both browser sources feed the normal Model Pack verifier. URL layout, transfer
chunking, response headers, and the choice between split files and bundle bytes
do not enter model identity. The adapter performs no alias resolution,
discovery, retries, persistent caching, registry access, or automatic repair.

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

This milestone does not add kernel semantics, a UI framework, remote registry
or cache policy, a worker protocol, an RDF/OWL adapter, empirical Historical
Load values, or a fabricated second release for Studio comparison. Analyses
must be registered explicitly.
Deferred engineering work is listed in the
[Engine Roadmap](ENGINE_ROADMAP.md); scientific dependencies remain in the
[Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
