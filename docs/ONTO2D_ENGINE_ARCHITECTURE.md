# Onto2D Engine Architecture

Status: release-quality engine milestone implemented on 2026-08-16.

## Layers

```text
applications and root facade
             |
             v
      @onto2d/engine --------> @onto2d/view
             |                       ^
             v                       |
   @onto2d/model-pack      applications may also project directly
             |
             v
      kernel + schemas

external RDF 1.1 N-Triples
             |
             v
      @onto2d/rdf-import ----> kernel/canonical
             |
             v
      exact RDF artifacts ----------+
             |                       |
             v                       v
      neutral RDF graph    @onto2d/shacl-validation
                                    |
                                    v
                           exact plan + report
                                    |
                                    v
                            @onto2d/rdf-mapping
                                    |
                                    v
                     mapping artifact + Model Pack
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

`@onto2d/view/lazy` adds an exact-identity presentation session after full
verification. Its descriptor, catalogue pages, node details, and neighborhood
projections all carry the same model ID, version, root hash, and manifest hash.
Catalogue rows and graph projections omit complete source records; the full
record is returned only by explicit node inspection. Page sizes, relation
summaries, graph size, nesting, input shape, and session lifetime are bounded.
These projections are read-only presentation envelopes, not semantic
artifacts or partial model executions.

`@onto2d/engine/presentation` is the verified bridge. It re-verifies a complete
Model Pack, optionally matches all four coordinates of a registry resolution,
then creates the presentation session from its canonical nodes and edges.
`@onto2d/view` remains dependency-free and does not authenticate caller data.
Model Studio composes the bridge only after registry, worker, and cache checks,
initially materializes 60 catalogue rows, and requests later pages, bounded
neighborhoods, and full node records separately.

This milestone does not change Model Pack v1 into a chunked semantic format.
The current split files are still all required for verification, and complete
analysis still requires a fully materialized verified source population.
Physical level, domain, namespace, or subgraph chunks require a future reviewed
format revision and new release hashes.

## External RDF import

`@onto2d/rdf-import` is a separate browser-safe adapter for the stable
[RDF 1.1 N-Triples Recommendation](https://www.w3.org/TR/n-triples/). It does
not claim conformance to every N-Triples document. Its versioned safe profile
accepts a bounded line-oriented subset: absolute IRIs, RDF 1.1 blank nodes,
simple, language, and datatype literals, comments, LF or CRLF, and ASCII
lexical transport with non-ASCII values expressed through Unicode escapes.

The adapter deliberately rejects relative IRIs, BOMs, malformed UTF-8, Turtle
directives, RDF/XML, and the `VERSION`, triple-term, and directional-language
features described by the current
[RDF 1.2 N-Triples Working Draft](https://www.w3.org/TR/rdf12-n-triples/).
Choosing the stable RDF 1.1 Recommendation prevents a draft syntax from
silently changing the import contract.

Every import artifact binds the exact source bytes, source identifier,
normalized RDF terms, unique statements, and duplicate line occurrences.
`graphHash` identifies the normalized statement set. `importHash` additionally
binds exact source provenance. Blank-node term IDs include the exact source
hash as their scope, so labels never create identity across documents. This is
an import-local identity, not blank-node graph canonicalization or an RDF
isomorphism algorithm.

The optional neutral graph projection uses subjects and objects as nodes and
the RDF predicate as an uninterpreted edge label. It performs no network
dereferencing, RDFS or OWL inference, source classification, or Onto2D
level/relation assignment. It does not build a Model Pack. SHACL validation is
a separate consumer of the exact import artifact, not an import side effect.
The separate mapping package described below is the only implemented crossing
from imported RDF statements to Model Pack records; a schema-valid RDF import
alone is never evidence for such a mapping.

## Closed SHACL validation

`@onto2d/shacl-validation` implements profile
`shacl10-core-structural-v1` over two verified RDF imports: one data graph and
one shapes graph. The profile follows the stable
[SHACL 1.0 Recommendation](https://www.w3.org/TR/shacl/) and deliberately does
not adopt features from the current
[SHACL 1.2 Core Working Draft](https://www.w3.org/TR/shacl12-core/).

The shapes import is compiled into an immutable plan that binds its exact
source, graph, and import hashes. The supported Core surface is explicit node
and property shapes, the four standard target forms, one IRI predicate path,
and min-count, max-count, datatype, node-kind, and class constraints. Severity,
messages, and deactivation are preserved. Datatype constraints accept a
declared lexical subset; a matching datatype IRI with an ill-typed lexical form
still produces a result.

Class targets and class constraints require SHACL type semantics. The validator
therefore follows explicit `rdf:type` values and cycle-safe
`rdfs:subClassOf*` paths inside the exact data artifact. This traversal is
bounded and permits IRI class nodes only. It is not external entailment,
general RDFS closure, OWL reasoning, graph repair, or a new RDF graph identity.

The resulting JSON report binds the exact data import, shapes import, and plan.
Results have content identities and deterministic order; `conforms` is false
whenever at least one result exists, including a warning or information
result. A result-limit overflow fails without returning a partial report.
Verifiers recompute the complete plan or report and compare canonical content.

The profile fails closed on unsupported shape predicates, implicit shape
typing, complex paths, custom targets, lists and logical constraints, SPARQL,
JavaScript, rules, draft features, network access, and non-IRI class edges. A
valid report establishes only conformance to this RDF structural profile. It
does not assign Onto2D levels, relation roles, causality, Historical Load,
scientific status, or Model Pack identity.

## Reviewed RDF-to-Onto2D mapping

`@onto2d/rdf-mapping` implements profile
`rdf-to-model-pack-explicit-v1`. It accepts only verified RDF data and shapes
imports, an exact replayable SHACL report with `conforms: true`, and a canonical
policy bound to all three input identities. The mapping remains outside both
the generic importer and validator.

The first profile makes every semantic choice explicit. Entities are IRIs with
one directly asserted mapped `rdf:type`; no subclass inference participates in
entity selection. Source IRIs remain node IDs. One constant level, its meaning,
class-to-`typeRole` and `scientificStatus` rules, one optional label predicate,
and directed predicate-to-relation rules are all policy fields. Mapped classes
and predicates must also have active coverage in the exact SHACL plan.

Every source statement must resolve to exactly one `node-type`, `node-label`,
`edge`, or `ignored` disposition. An ignored predicate requires a review reason
and its statement ID remains in the mapping audit. Node records preserve RDF
term, class-statement, and label-statement identities; edge records preserve
their source statement and predicate. The policy input binding includes the
data and shapes source IDs as well as their import hashes and the validation
report hash. Raw files plus policy are therefore replayable without hidden
source-ID configuration. The policy itself contains source URI, version,
license, and adaptation provenance and enters `policyHash`.

The mapping artifact and generated Model Pack are deterministic. The pack uses
the exact RDF source hashes, places `mappingHash` in `source.auditHash`, and
retains the complete policy and statement accounting in its dictionaries.
Runtime verification replays import, SHACL validation, mapping, and normal
Model Pack construction. JSON Schema validation alone is never trusted.

The public reference under `cases/rdf-mapping-reference` adapts the W3C SHACL
Person and Company example into a conforming closed-profile fixture. Its level
0 means only a flat external source layer. It is not kernel Level 0, Historical
Load zero, or evidence of formation. The fixture proves the boundary and is not
a general RDF ontology mapper, a W3C conformance test, or an independently
reviewed scientific dataset.

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
operations, registry aliases, RDF/XML or Turtle import, unrestricted SHACL,
OWL reasoning, automatic ontology mapping, empirical Historical Load values,
physical semantic chunking, or a fabricated second release for Studio
comparison. Registry trust, cache limits, storage selection, presentation page
limits, RDF import, SHACL, and mapping limits, and failure fallback are explicit
application policy, not verifier behavior.
Analyses must be registered explicitly.
Deferred engineering work is listed in the
[Engine Roadmap](ENGINE_ROADMAP.md); scientific dependencies remain in the
[Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
