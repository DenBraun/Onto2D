# Preserved retinal source data

[elife-38281-fig6-data1-v2.xlsx](elife-38281-fig6-data1-v2.xlsx) is the
unchanged publisher download of Grimes, Baudin, Azevedo and Rieke (2018),
[Figure 6 source data 1](https://doi.org/10.7554/eLife.38281.019), retrieved
2026-09-12 from the eLife CDN. Attribution: the authors, *Range, routing and
kinetics of rod signaling in primate retina*, eLife 7:e38281,
[article DOI](https://doi.org/10.7554/eLife.38281). The publisher supplies the
article and its data under the [CC0 dedication](https://creativecommons.org/publicdomain/zero/1.0/).
The canonical source records the download URL and SHA-256.

Only `Sheet1!C14:F19` is used in this extension. It contains the Figure 6F
labels and three mouse and three primate summary response ratios. Figure 6C
is present in the original workbook but outside the extraction. No original
workbook metadata or cells have been rewritten.

The [extractor](../../../models/causal-emergence/canonical/verify-routing-data.py)
checks sheet identity and column labels, reads explicit numeric cells and
compares all six rows with the [review ledger](../routing-review.json).
It neither evaluates workbook formulas nor derives missing observations.
The paper presents mean and SEM graphically, but this workbook supplies no
SEM, sample counts or individual responses. Those quantities remain missing.
