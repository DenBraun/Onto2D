# ADR-0100: Bounded browser Model Pack loading

Status: implemented decision

Date: 2026-08-16

## Context

Browser applications could project committed node and edge files, but they had
no public transport that authenticated the exact bytes received over HTTP.
Repeating partial checks in each application would make the UI an accidental
integrity boundary and would diverge from Node Model Pack verification.

## Decision

`@onto2d/model-pack/browser` provides two bounded sources. The HTTP directory
loader accepts one explicit absolute HTTP(S) base URL without credentials,
query, or fragment and requests only the fixed required split JSON paths. An
optional policy also requires `bundle.json` to reproduce the split files
exactly. The raw bundle loader accepts a `Blob`, `ArrayBuffer`, or array-buffer
view containing JSON.

HTTP requests are sequential and use `GET`, `cache: "no-store"`,
`credentials: "same-origin"`, and `redirect: "error"`. Responses must have
status 200, the exact requested response URL, a JSON media type, a readable
byte stream, and a valid optional `Content-Length`. Declared and streamed
sizes are checked against per-file and cumulative limits before copying or
parsing, and UTF-8 and JSON parsing are strict. Declared length is not required
to equal the decoded stream size because a CDN can declare compressed transfer
bytes while Fetch exposes decompressed content. The decoded stream remains the
authoritative bounded input. Both sources pass their decoded values to the
existing full Model Pack reconstruction and hash/index verifier.

Options are plain data with a closed field set. Accessors and symbols are
rejected without invocation. The published entrypoint contains no Node
transport dependency and exposes matching TypeScript declarations. It reaches
identity primitives through the narrow `@onto2d/kernel/canonical` subpath,
whose portable synchronous SHA-256 is checked against independent Node
references and the frozen canonical fixtures. Model Studio now uses this
adapter before constructing any presentation view.

## Consequences

- a browser can authenticate the complete Model Pack it actually received;
- URL layout, HTTP metadata, stream chunking, and split-versus-bundle transport
  do not alter semantic model identity;
- malformed responses and resource-limit violations produce stable fail-closed
  `ModelPackError` codes;
- the adapter does not discover releases, resolve aliases, retry, persist a
  cache, contact a registry, parse ZIP, repair a pack, or establish scientific
  validity;
- the versioned worker messaging boundary is specified separately by
  [ADR-0101](0101-browser-model-pack-worker-protocol.md), and verified caching
  is specified by [ADR-0102](0102-verified-model-pack-cache.md); read-only
  registry resolution is specified by
  [ADR-0103](0103-read-only-model-pack-registry.md), while lazy presentation
  loading remains a separate operational milestone.
