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
engine, or place coordinates in semantic hashes. The static Model Studio asks
a dedicated worker to authenticate the complete bundled release, then passes
only the verified node and edge arrays into this view layer. If worker startup
or transport fails, Studio runs the same strict browser verifier on the main
thread; a Model Pack data failure is never converted into a fallback success.

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
Persistent caching is a separate caller-selected layer and does not weaken
this source contract.

`@onto2d/model-pack/worker` adds a versioned plain-data protocol over that
browser source contract. Its client owns request identifiers, pending-request
limits, timeouts, `AbortSignal` cancellation, optional explicit buffer
transfer, listener cleanup, and stable remote errors. Its endpoint validates a
closed message shape before calling the browser loader, bounds concurrent work,
and aborts active HTTP requests on cancellation. Worker results are
structured-cloned; the client validates and freezes the result envelope while
trusting the same-origin endpoint to have performed full reconstruction and
hash verification.

Document import maps do not apply inside workers. Model Studio therefore loads
a committed self-contained worker asset generated from a small modular
entrypoint. `npm run check:worker` rebuilds it in memory and rejects stale
generated bytes. This deployment artifact changes neither the Model Pack
format nor `rootHash`, `manifestHash`, or kernel canonical identity.

`@onto2d/model-pack/cache` adds a storage-neutral verified cache above the
browser verifier. A caller must supply the expected exact `rootHash` and
`manifestHash`; the manifest hash determines the cache key and both hashes are
checked after full verification. A record contains only canonical Model Pack
JSON. Every read is parsed, reconstructed, hashed, and compared with the
expected identity before it can become a hit. Every candidate is verified
again before an atomic storage commit. Invalid or non-canonical records are
removed and reported as recovery misses, never returned as model data.

The package provides in-memory and IndexedDB storage adapters. Public limits
bound entries, each record, total bytes, database names, and storage scans.
Eviction is deterministic first-in-first-out by a persisted insertion ordinal;
wall-clock time, access recency, HTTP metadata, and IndexedDB metadata do not
affect model identity. Concurrent loads for the same exact identity share one
operation. Closing, clearing, and removing records wait for relevant active
loads, and storage ownership is explicit.

Model Studio uses the IndexedDB adapter as an optional performance layer. A
cached bundle is still sent through the worker verifier before presentation;
the direct browser verifier remains the worker-transport fallback. IndexedDB
availability or operational failure may bypass caching, but malformed Model
Pack data, hash drift, and an unexpected exact identity remain hard failures.
Neither a cache hit nor a cache recovery changes the verified pack exposed to
the view layer.

`@onto2d/model-pack/registry` is a read-only discovery boundary above these
transports. A version-1 registry is a bounded flat list keyed by an explicit
`modelId` and `version`; aliases, ranges, implicit latest selection, retries,
and mutation are not part of the contract. Each entry supplies exact
`rootHash` and `manifestHash` values plus an ASCII relative directory path.
The resolved pack URL must remain on the registry origin and below its
directory.

Registry JSON is fetched without credentials, redirects, referrer data, or
HTTP caching and is subject to strict response identity, media type, UTF-8,
JSON, byte, entry, path, and URL limits. Normalized entries receive a
domain-separated `registryHash`. Callers may pin that hash; an unpinned result
is explicitly marked `transport-only`. Registry resolution does not verify a
Model Pack. The separate matcher binds a previously verified pack to the
resolved model ID, version, root hash, and manifest hash.

Model Studio pins the committed registry hash, resolves its explicit release,
then passes the resolution URL to the existing worker/cache composition. Both
network candidates and cached records must match the complete resolution
before storage or presentation. The repository registry check also verifies
every indexed `bundle.json` and rejects a stale Studio pin.

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

This milestone does not add kernel semantics, a UI framework, mutable registry
operations, registry aliases, an RDF/OWL adapter, empirical Historical Load
values, or a fabricated second release for Studio comparison. Registry trust,
cache limits, storage selection, and failure fallback are explicit application
policy, not verifier behavior.
Analyses must be registered explicitly.
Deferred engineering work is listed in the
[Engine Roadmap](ENGINE_ROADMAP.md); scientific dependencies remain in the
[Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
