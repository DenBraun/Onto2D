# `@onto2d/run-store`

```sh
npm install @onto2d/run-store
```

`@onto2d/run-store` is the filesystem boundary for verified semantic run
bundles. The kernel remains independent of files and directories; this adapter
only accepts a bundle that the kernel can reproduce exactly.

`writePackageRunArtifactBundle(bundle, runsDirectory)` publishes through a
fresh staging directory and one same-filesystem rename. The final portable
directory name replaces the content-hash colon with a hyphen, for example
`sha256-<64 lowercase hex characters>`. Existing directories are never
overwritten: an identical complete snapshot is returned as `already-present`,
while an invalid or conflicting snapshot fails closed.

`readPackageRunArtifactBundle(directory)` performs full kernel replay of
`artifact-bundle.json`, requires canonical envelope bytes, reconstructs every
referenced artifact, verifies raw SHA-256 and byte length, rejects symbolic
links, and rejects missing or unexpected files and directories. The sole
optional overlay is the verified flat `execution/` subtree described below.

The returned receipt is operational metadata. Its directory and status do not
participate in the semantic bundle or run hashes.

`createPackageRunExecutionRecord(input)` normalizes one terminal execution and
derives an operational content address. `writePackageRunExecutionRecord(record,
directory)` first replays the full run directory, requires an exact `runHash`
binding, stages canonical bytes outside the run, and publishes through an
atomic no-overwrite hard link. Repeating the same record is idempotent;
existing bytes are never replaced. `readPackageRunExecutionRecords(directory)`
verifies all stored records and returns them in execution-ID order.

Execution timestamps, engine/platform labels, resource usage, execution IDs,
and writer receipts never enter the semantic manifest, bundle, or run hash.
Only `execution/sha256-<digest>.json` regular files are allowed; malformed,
non-canonical, misnamed, symlinked, differently bound, or unexpected entries
fail closed.
