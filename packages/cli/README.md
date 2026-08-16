# `@onto2d/cli`

Read-only command-line access to a local transparent Onto2D Model Pack. A
source may be either the split directory or a bounded ZIP archive containing
the same root-relative layout.

```sh
npm install --global @onto2d/cli

onto2d verify ./model-release
onto2d verify ./model-release.onto2d.zip
onto2d node ./model-release 0.8
onto2d neighborhood ./model-release 0.8 --depth 2 --direction both
onto2d paths ./model-release 0.1 0.8 --maximum-paths 128
```

`verify` checks the complete split pack and optional bundle through the bounded
Node source loader. ZIP input is constrained by entry, compressed-size,
uncompressed-size, total-expansion, and compression-ratio limits. The other
commands load that verified result into
`@onto2d/engine`; they never read unverified model files directly.

`neighborhood` and the bounded all-shortest directed `paths` command accept an
optional edge selector as JSON:

```sh
onto2d neighborhood ./model-release 0.8 --selector '{"relationLayer":"source-parent"}'
```

Successful commands emit a deterministic, versioned JSON document to stdout.
Usage errors exit with code `2`; rejected packs or engine queries exit with
code `3`; unexpected internal failures exit with code `1`. Diagnostics are
JSON on stderr. The CLI does not modify, repair, cache, or download models.
