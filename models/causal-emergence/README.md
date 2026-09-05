# Causal Emergence Model Pack

This directory builds the preserved `references/level-*.json` catalogue into the
first transparent Onto2D Model Pack. The source files remain in `references/`; the
compiler does not rewrite or silently migrate them.

The release is explicitly a source-catalogue snapshot. `ParentCode` records
are exposed in the `source-parent` relation layer and are not reclassified as
generative relations. Known source-audit findings remain visible through the
bound audit hash and repository audit fixture.

Build or verify the frozen candidate release:

```sh
npm run model:causal-emergence
npm run model:causal-emergence:verify
```

The release directory contains a manifest, semantic JSON files, recomputable
indexes, and a convenience JSON bundle used by the root `onto2d` facade.
