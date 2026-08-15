# ADR-0060: Verified run-directory persistence

- Status: accepted
- Date: 2026-08-12

## Context

[ADR-0059](0059-verified-run-artifact-bundles.md) defines a complete semantic
run bundle and exact artifact-byte materialization, but intentionally keeps
filesystem access out of `@onto2d/kernel`. A persisted directory must not be
trusted merely because it contains a plausible manifest: the bundle and every
referenced byte must remain reproducible, and publishing must not partially
overwrite an existing run.

Content hashes contain a colon. That character is not a portable filesystem
name on every supported platform, so the conceptual `runs/<run-hash>/` layout
needs a reversible on-disk spelling.

## Decision

Filesystem persistence belongs to the separate `@onto2d/run-store` adapter.
It publishes a verified bundle below a caller-supplied runs directory using
the portable directory name `sha256-<digest>` for semantic
`sha256:<digest>` run hashes.

Each directory contains `artifact-bundle.json` as the canonical JSON bytes of
the complete self-verifying bundle, plus every path named by the bundle's
artifact references. Writing follows these rules:

1. fully replay the supplied bundle before filesystem work;
2. materialize every referenced artifact through the kernel;
3. write new regular files under a fresh same-filesystem staging directory;
4. verify the staged envelope, inventory, byte lengths, raw SHA-256 hashes,
   and exact reconstructed bytes;
5. publish with one directory rename;
6. never overwrite an existing run directory.

An already-present complete byte-identical bundle is an idempotent success.
An invalid or different existing directory fails closed. Concurrent identical
writers converge on the same result.

Reading performs full serialized-bundle replay, requires canonical envelope
bytes, rejects symbolic links and non-regular files, and requires the exact
set of referenced files and parent directories. Missing and additional entries
are both errors. Bundle-envelope reads have an explicit configurable byte
limit.

ADR-0062 later reserves one strictly verified `execution/` operational
subtree. Entries outside the exact semantic inventory and that versioned
subtree remain errors.

The returned `package-run-artifact-directory-v1` receipt is operational. Its
absolute directory and write status do not contribute to the semantic bundle
or run hashes. The receipt has its own JSON Schema and TypeScript contract.

## Consequences

- The kernel remains dependency-free and filesystem-independent.
- A directory accepted by the adapter is sufficient to reconstruct and replay
  the complete bundle without ambient package state.
- Raw artifact hashes remain compatible with ordinary SHA-256 tools.
- Partial, non-canonical, symlinked, tampered, or unrecognized overlaid
  directories cannot be presented as complete runs.
- Remote object stores and application-specific retention policies remain
  separate adapters.
- This closes physical local artifact writing without coupling persistence to
  a presentation layer.
