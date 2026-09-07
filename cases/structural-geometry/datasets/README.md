# DREAM4 and C. elegans research sources

The selected source downloads are acquired and byte-verified locally. The
[source lock](source-lock.json) contains 13 exact files: the DREAM4 distribution,
the Randi functional archive, eight Witvliet anatomical graphs and three author
metadata/parser files. They total about 531 MB. Native adapters, Model Packs,
biological response extraction and scoring are **not implemented**.

The [research plan](../../../docs/structural-geometry/RESEARCH.md) owns scientific
questions, source roles, applicability, evaluation and the next delivery gates.

## Reproduce acquisition

```sh
npm run structural-geometry:datasets:fetch
npm run structural-geometry:datasets:verify
```

The first command downloads missing or invalid files into ignored `cache/`.
The second is offline: every byte count and SHA-256 must match the committed
lock. Downloads are bounded by locked length and verified before atomic
replacement. The tool neither extracts archives nor executes upstream code.
Normal repository tests/builds do not download this research corpus. On a fresh
checkout, run the explicit fetch command before its optional offline verifier.

Large/raw sources stay out of Git and public website payloads. The lock records
source terms separately from the project's code license. A later distributable
fixture needs an explicit permitted source subset and its provenance; no data
license is inferred from a paper or unrelated bundled software.

## DREAM4

Source: [Bioconductor DREAM4](https://bioconductor.org/packages/3.10/data/experiment/html/DREAM4.html),
package 1.22.0 from Bioconductor 3.10. The exact archive is 3,488,976 bytes.
Its internal `DREAM4/inst/extdata/lightlyProcessedDownloadedData.tar.gz` holds
consistently named challenge tables. This is a documented redistribution with
light processing, not an untouched original challenge ZIP.

The Size10 pilot uses all five `insilico_size10_1` through `insilico_size10_5`
directories. Each gold standard contains 90 explicit off-diagonal entries:
respectively **15, 16, 15, 13 and 12** positive directed edges. Each directory
also contains wild type, knockouts, knockdowns, multifactorial perturbations,
time series and a small dual-knockout file. Its name alone does not establish
that dual-knockout response outcomes were supplied. The archive also contains
Size100 material, outside the initial pilot.

The lock verifies the complete distribution; the next adapter must select the
five Size10 directories by name, preserve expression/graph separation and verify
row/header/intervention alignment. Do not run archived R scripts to ingest TSVs.
The package declares `License: GPL` without a version; retain that exact term
and distribution provenance when reviewing a redistributable subset.

## C. elegans functional measurements

Source: Randi et al., [Neural signal propagation atlas](https://doi.org/10.1038/s41586-023-06683-4),
[OSF e2syt](https://osf.io/e2syt/), `exported_data.tar.gz`, version 1.
The local file has **523,093,816 bytes**; SHA-256 matches the OSF file metadata:
`d6e7b3d93175b40b7ae17bde2182835e9c2144388142c522ee9be3832f6ce836`.

The archive has 679 members: its directory and six text-file families for 113
recording indexes (0–112): labels, dataset names, time coordinates, GCaMP traces,
stimulation neuron indexes and stimulation volume indexes. Uncompressed member
content totals 1,242,576,695 bytes. This gives recording-level source material;
it is not an already compiled atlas target table or a proven animal-ID mapping.
The next adapter must validate dimensions, stimulation alignment, neuron
identification and recording-to-animal grouping before deriving responses.

Select the final `exported_data.tar.gz`, not a `pre_review` archive or the
separate unc31 mutant cohort. Those alternatives are different populations.
The OSF node metadata reports no declared node license (`node_license: null`);
local acquisition does not assert permission to redistribute its contents in a
public fixture or app.

## C. elegans anatomy and development

Source: Witvliet et al., [Connectomes across development](https://doi.org/10.1038/s41586-021-03778-8),
[author repository](https://github.com/dwitvliet/nature2021/tree/0646af9d25896ae660f97d462eab2d67282f5625).
All files are pinned to commit `0646af9d25896ae660f97d462eab2d67282f5625`.
The eight `data/nemanode/witvliet_2020_N.json` files retain native connection
records. The filenames' 2020 date is part of the source identity; the paper is
from 2021. `dataset_info.py`, `neuron_info.py` and `data_manager.py` are retained
as readable source metadata/parser specifications and are never executed here.

The author's stage metadata assigns Dataset1–4 to L1, Dataset5 to L2, Dataset6
to L3 and Dataset7–8 to adults. These are eight different animals.
The native files contain respectively **939, 1,231, 1,198, 1,551, 2,092, 1,952,
2,781 and 2,802 connection records**, with 187–224 distinct endpoint labels.
These are raw record counts, not yet a certified neuron-only/simple-directed
projection. Multiple native channels, endpoint types, reciprocal records,
isolates and synapse multiplicity need an explicit adapter policy.

No repository-root license was found in the pinned tree. Third-party software
licenses inside it and the separately licensed Zenodo 3D-model archive do not
establish terms for these graph files. Source terms and bounded redistribution
remain part of the fixture publication gate.

## Next implementation boundary

Source acquisition is complete for the locked files. Next: produce a deterministic
native census and auditable graph/observation mappings, define compatible bounded
scopes, resolve the task-specific response profile, and freeze the scoring
protocol. The full anatomical graphs exceed the current 64-edge flow/signature
limit. The functional and anatomical cohorts must keep separate identities;
sharing a neuron name does not make them measurements of the same animal.
