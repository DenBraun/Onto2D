# Cell Lineage Identity

This case freezes every cell-level record in the ZF1 scGESTALT `GestMaster`
table from GEO series `GSE105010` and asks a deliberately narrower question
than “what is the true lineage tree?”: when do the same 750 observations count
as identical under different, explicit regimes?

The answer is regime-relative: 750 native cell records, 56 observed numeric
transcriptomic clusters, 192 exact reported ten-target HMID strings, and 133
exact signatures over HMID target positions 1-4. Those counts are useful because they expose
how much identity changes when the comparison key changes. They are not a
Historical Load score and they are not interchangeable biological claims.

## Reproduce the source projection

Download `GSE105010_RAW.tar` from the locked NCBI GEO URL in
`upstream.json`, extract `GSM2813984_ZF1.GestMaster.txt.gz`, then run:

```sh
python3 cases/cell-lineage-identity/prepare-source.py \
  --gest-master /path/to/GSM2813984_ZF1.GestMaster.txt.gz \
  --output /tmp/gse105010-zf1-scgestalt.json
```

The generator rejects any input whose byte length or SHA-256 differs from the
official file and retains all 750 rows. Compare the result with
`source/gse105010-zf1-scgestalt.json`.

Build or verify the case artifact with:

```sh
npm run case:cell-lineage
npm run case:cell-lineage:verify
```

## Epistemic boundary

`ClusterIdent` and `HMID` are direct fields in the processed source table.
Paper-authored biological labels are added only where Raj et al. explicitly
maps a cluster number to a named population. The targets 1-4 grouping is a
deterministic positional Onto2D projection; target position is not treated as
edit time. It is intentionally not presented as the
paper's filtered two-stage PHYLIP maximum-parsimony tree, and no division,
parent, confidence value, or missing target state is inferred.

The artifact reports cross-regime pair counts and concrete source-row
examples. Historical Load remains `null` because the sources do not declare a
finite developmental path universe, costs, and a counterfactual baseline.
