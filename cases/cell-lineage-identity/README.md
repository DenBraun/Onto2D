# Cell Lineage Identity

Case ID: `cell-lineage-identity`. [History case registry](../history-case-registry.json).

- [Cell Lineage Identity — use and reproduction](#cell-lineage-identity--use-and-reproduction)
- [Cell Lineage Identity — source and interpretation](#cell-lineage-identity--source-and-interpretation)

<a id="cell-lineage-identity--use-and-reproduction"></a>

## Cell Lineage Identity — use and reproduction

This case freezes every cell-level record in the ZF1 scGESTALT `GestMaster`
table from GEO series `GSE105010` and asks a deliberately narrower question
than “what is the true lineage tree?”: when do the same 750 observations count
as identical under different, explicit regimes?

The answer is regime-relative: 750 native cell records, 56 observed numeric
transcriptomic clusters, 192 exact reported ten-target HMID strings, and 133
exact signatures over HMID target positions 1-4. Those counts are useful because they expose
how much identity changes when the comparison key changes. They are not a
Historical Load score and they are not interchangeable biological claims.

<a id="cell-lineage-identity--use-and-reproduction--reproduce-the-source-projection"></a>

### Reproduce the source projection

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

<a id="cell-lineage-identity--use-and-reproduction--epistemic-boundary"></a>

### Epistemic boundary

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

<a id="cell-lineage-identity--source-and-interpretation"></a>

## Cell Lineage Identity — source and interpretation

<a id="cell-lineage-identity--source-and-interpretation--implemented-release"></a>

### Implemented Release


The release pins NCBI GEO series `GSE105010`, sample `GSM2813984`
(`ZF1_scGSTLT`), the exact `GSE105010_RAW.tar` bytes, and its exact
`GSM2813984_ZF1.GestMaster.txt.gz` member. A standard-library generator
reproduces a complete bounded projection of all 750 source rows.

The verified result is:

```text
750 native cell-record classes
 56 numeric transcriptomic-cluster classes
192 exact reported ten-target HMID classes
133 exact first-four-target signature classes
 16 cells with explicit partial target coverage
  0 invented parent cells, divisions, or confidence values
```

The source table, projection generator, analysis profile, case artifact, Model
Pack, and browser artifact are all byte- or canonical-identity locked. The
Model Pack release is `cell-lineage-history@v1-6e6ea7be0f576db7` with 1,140
nodes and 2,450 edges. The dedicated explorer is
`apps/cell-lineage-identity-lab/`.

This release deliberately does not claim to reproduce the article's final
filtered two-stage PHYLIP topology. The released GestMaster member supports an
exact and useful regime comparison; the Onto2D first-four-target grouping is
therefore labelled as a bounded reconstruction rather than an observed cell
division or the published maximum-parsimony tree.

<a id="cell-lineage-identity--source-and-interpretation--purpose"></a>

### Purpose

Use paired single-cell transcriptomic state and CRISPR lineage recording to test:

```text
current cell state
    !=
developmental lineage
```

and, more importantly:

```text
observed barcode
    !=
true complete lineage
```

This case is primarily about identity plus reconstruction uncertainty.

<a id="cell-lineage-identity--source-and-interpretation--primary-external-sources"></a>

### Primary External Sources

scGESTALT publication:

```text
https://www.nature.com/articles/nbt.4103
```

Public source data:

```text
NCBI BioProject PRJNA414416
GEO GSE105010
```

Protocol reference:

```text
https://www.nature.com/articles/s41596-018-0058-x
```

The implementation must pin concrete downloaded files, not only accession numbers.

<a id="cell-lineage-identity--source-and-interpretation--key-distinctions"></a>

### Key Distinctions

Represent separately:

```text
cell observation
transcriptomic state
cell-type annotation
observed lineage barcode
barcode edit state
reconstructed lineage node
reconstruction method
confidence/support
```

The reconstructed lineage is not direct observation of every cell division.

<a id="cell-lineage-identity--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot maintain independent representations of current cell state, lineage evidence, and reconstructed developmental history.
