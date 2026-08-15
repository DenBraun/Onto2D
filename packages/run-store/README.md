# `@onto2d/run-store`

```sh
npm install @onto2d/run-store
```

Filesystem adapter for verified semantic run bundles.

- `writePackageRunArtifactBundle()` publishes through staging and an atomic
  same-filesystem rename; existing bundles are never overwritten.
- `readPackageRunArtifactBundle()` inventories files, rejects links or extras,
  verifies canonical bytes, and replays the full bundle through the kernel.
- execution-record helpers append separately content-addressed operational
  records bound to an existing run hash.

Timestamps, platform labels, resource usage, directory names, and write
receipts remain outside semantic identity. Remote object-store persistence is
not implemented.
