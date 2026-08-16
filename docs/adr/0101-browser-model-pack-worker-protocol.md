# ADR-0101: Browser Model Pack worker protocol

Status: implemented decision

Date: 2026-08-16

## Context

ADR-0100 provides complete browser-side Model Pack authentication, but parsing,
index reconstruction, and hashing can occupy the UI thread. Applications need
an operational boundary that moves this existing work to a worker without
creating another verifier, weakening resource limits, or changing model
identity. The static Model Studio must also run directly from GitHub Pages,
where a document import map does not resolve bare imports inside a worker.

## Decision

`@onto2d/model-pack/worker` publishes protocol version `1` with two operations:
`load-http-directory` and `load-bundle`. Requests, cancellations, results, and
errors use exact closed plain-data envelopes containing the protocol name,
version, bounded request ID, and operation-specific data. Unknown fields,
accessors, symbols, invalid identifiers, unsupported versions, duplicate active
IDs, excessive pending or active work, and values outside public browser limits
fail closed with stable `ModelPackError` codes.

The client supplies per-request timeouts and optional `AbortSignal`
cancellation. Cancellation removes the local request immediately and asks the
endpoint to abort its work; HTTP operations use an `AbortController`. Bundle
verification is synchronous after its bytes have been delivered, so
cancellation is cooperative and cannot preempt CPU work already executing in
that worker. Closing a client cancels every pending request, clears timers and
listeners, and terminates the worker only when `ownsWorker` was declared.

Bundle transport copies the caller's bytes by default. `transfer: "move"` is
accepted only for a complete `ArrayBuffer`, or a view spanning its complete
buffer, and explicitly detaches it. A copied buffer is internally transferred
after the copy to avoid a second copy. `Blob` remains structured-cloned and
cannot use move semantics.

The endpoint calls the unchanged `@onto2d/model-pack/browser` verifier. It
serializes only a bounded error name, code, message, and structured details;
stacks and arbitrary internal exceptions do not cross the boundary. A result
is structured-cloned back to the client, which checks the protocol envelope,
Model Pack format and identity fields, exact file layout, structured-data depth
and entry limits, then freezes it. It does not repeat Model Pack hashing on the
UI thread; the same-origin endpoint is the verification boundary.

Model Studio commits `assets/js/model-pack-worker.js`, a self-contained module
worker generated reproducibly from
`apps/model-studio/model-pack-worker-entry.js`. Repository checks build the
asset in memory and require byte-for-byte equality. Studio falls back to the
direct ADR-0100 verifier only for worker availability, protocol, timeout, or
transport failures. Errors from actual Model Pack verification propagate and
cannot trigger a second path that treats bad data as valid.

The protocol, structured clone, byte transfer, and generated deployment asset
are transport concerns. They do not enter canonical bytes, kernel behavior,
`rootHash`, or `manifestHash`.

## Alternatives considered

- Keep verification on the UI thread. This preserves correctness but can block
  interaction as packs grow.
- Duplicate verification logic in a worker-specific implementation. This was
  rejected because it creates a second integrity contract.
- Load the modular source graph directly through the document import map. This
  does not work for worker module resolution; a deterministic bundle keeps the
  static deployment self-contained.
- Retry every worker error on the main thread. This was rejected because data
  failures must remain failures, not trigger ambiguous double verification.
- Transfer every input buffer implicitly. This was rejected because detaching
  caller-owned memory must be an explicit API choice.

## Consequences

- browser applications can keep complete Model Pack verification off the UI
  thread while reusing the same verifier and limits;
- bounded queues, cancellation, cleanup, and stable error serialization are
  public and testable behavior;
- applications must provide a worker-resolvable entrypoint, normally through a
  bundler or a committed generated asset;
- a compromised worker can fabricate a result because the main thread does not
  hash it again; callers must treat worker construction and script origin as a
  trusted application boundary;
- verified caching is specified separately by
  [ADR-0102](0102-verified-model-pack-cache.md), and read-only registry
  resolution by [ADR-0103](0103-read-only-model-pack-registry.md); worker
  pools, retry policy, progress messages, and cross-origin worker deployment
  remain separate milestones.

## Artifacts and acceptance

- runtime and declarations: `packages/model-pack/src/worker.js` and
  `packages/model-pack/src/worker.d.ts`;
- adversarial protocol tests: `packages/model-pack/test/worker.test.mjs`;
- static worker entry and bundle: `apps/model-studio/model-pack-worker-entry.js`
  and `assets/js/model-pack-worker.js`;
- focused checks: `npm run check:worker`, `npm run check:types`, and
  `node --test packages/model-pack/test/worker.test.mjs`;
- repository acceptance: `npm test`, `npm run check`, `npm run check:goldens`,
  and `npm run build`.
