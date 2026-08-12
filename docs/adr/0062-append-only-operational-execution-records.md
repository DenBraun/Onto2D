# ADR-0062: Append-only operational execution records

- Status: accepted
- Date: 2026-08-12

## Context

The semantic run bundle from ADR-0059 is byte-reproducible, and ADR-0060
persists it as one verified directory without placing filesystem behavior in
the kernel. Real executions still need timestamps, build/platform labels,
resource use, and terminal status. Those values legitimately differ between
two executions of the same semantic run and therefore must never change its
`runHash`, manifest, bundle, or artifact bytes.

The architecture reserves `execution/<execution-id>.json` for that metadata.
The storage contract must permit this operational overlay without weakening
the run directory's strict inventory, exact semantic replay, symlink rejection,
or no-overwrite guarantees.

## Decision

`@onto2d/run-store` implements `package-run-execution-record-v1` outside the
kernel. A record binds one verified semantic `runHash` and contains canonical
UTC millisecond timestamps, engine build, optional platform, bounded resource
usage, and `complete`, `failed`, or `cancelled` terminal status. A complete
record requires `completedAt`; a failed or cancelled record may use `null` when
the terminal instant was unavailable.

`executionId` is the raw SHA-256 of the canonical normalized record basis,
including its schema/recorder version but excluding the derived ID itself. It
is an operational content address, not a semantic hash. The portable file path
is `execution/sha256-<digest>.json`; the full stored bytes receive a separate
raw-SHA-256 `ArtifactRef` in the writer receipt.

Appending follows these rules:

1. fully reconstruct the semantic run directory and all existing execution
   records;
2. verify that the new record's `runHash` matches the directory bundle;
3. write and sync canonical bytes in a same-filesystem staging directory;
4. publish with an atomic no-overwrite hard link;
5. accept an identical existing ID as `already-present`, but reject malformed,
   non-canonical, misnamed, differently bound, symlinked, or unexpected entries.

Readers continue to require the exact semantic file inventory. The only
permitted additional subtree is an optional flat `execution/` directory whose
files all match the versioned execution-record filename and runtime contract.
Execution-record byte and count limits are explicit reader/writer bounds.

## Consequences

- Multiple real executions can refer to one byte-identical semantic run.
- Appending operational metadata cannot mutate or replace semantic artifacts.
- Concurrent identical writers converge without partial visible records or
  overwrites.
- `readPackageRunArtifactBundle` still returns the semantic bundle/receipt;
  `readPackageRunExecutionRecords` exposes the independently verified
  operational collection.
- Operational records now satisfy the local execution-record storage gate;
  remote object-store persistence remains a separate adapter.
- This does not activate `POST-CLOSURE-VIS-01`; the visualization must still
  wait for full kernel closure.
