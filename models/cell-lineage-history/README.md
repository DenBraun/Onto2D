# Cell Lineage Identity Model Pack

This Model Pack compiles the complete bounded ZF1 case artifact into separate
nodes for the source cohort, specimen, 750 cell observations, 56 transcriptomic
clusters, 192 exact observed HMID states, 133 signatures over HMID target
positions 1-4, four
identity regimes, and explicit epistemic boundaries.

The graph deliberately contains no inferred parent-cell or division edge.
`projects-to-first-four-target-signature` is a deterministic positional
grouping relation, not an edit-time ordering or the published
maximum-parsimony tree.

```sh
npm run model:cell-lineage
npm run model:cell-lineage:verify
```
