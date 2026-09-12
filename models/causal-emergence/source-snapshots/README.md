# Historical canonical source snapshots

The directory `2026.09.11/files/` preserves all 25 local files named and hashed
by the [first canonical manifest](../releases/2026.09.11/manifest.json).
`2026.09.12/files/` preserves all 28 files bound by the
[Level-0 relation-review manifest](../releases/2026.09.12/manifest.json).
`2026.09.12.1/files/` preserves all 31 files bound by the
[first retinal-pilot manifest](../releases/2026.09.12.1/manifest.json), before
functional relations received a separate kind. `2026.09.12.2/files/` preserves
all 31 files bound by the [functional-support edition](../releases/2026.09.12.2/manifest.json),
before the experimental-routing extension. `2026.09.12.3/files/` preserves
all 36 files bound by the [routing edition](../releases/2026.09.12.3/manifest.json),
before dictionary review and quantitative accounting. All include their original
source contracts and compilers. Paths under `files/` retain their
repository-relative spelling. Original evidence bytes are immutable, including
original filenames and source-document languages.

```sh
node models/causal-emergence/canonical/build.mjs --verify --version=2026.09.11
node models/causal-emergence/canonical/build.mjs --verify --version=2026.09.12
node models/causal-emergence/canonical/build.mjs --verify --version=2026.09.12.1
node models/causal-emergence/canonical/build.mjs --verify --version=2026.09.12.2
node models/causal-emergence/canonical/build.mjs --verify --version=2026.09.12.3
```

The current builder verifies the stored pack and each archived file against
that manifest before loading the archived compiler. It rebuilds with the
installed project toolchain and compares all twelve release files exactly.
This checks replay after source evolution; it does not claim that all possible
runtime or dependency versions yield the same output. `package-lock.json`
controls the current workspace dependency installation.

Archived Markdown retains its original link context. Documentation traversal
excludes this snapshot directory so historical bytes are not rewritten merely
to satisfy links from their new archival location. The current guides and
checks live outside `files/`.
