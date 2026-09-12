# Conditional retinal route reconstruction

Edition `2026.09.12.3` extends the [retinal pilot](RETINAL_REVIEW.md) with eight
OFF retinal-output comparison protocols. It adds six protocol-specific
boundary records, eight claims and three aggregate `functional-support`
relations. The full release contains 56 nodes and 60 connections, including
six proposed Level-0 rules, 48 descriptive connections and twelve operating
relations. The graph has 173 claims and 42 source records.

This is a retrospective, internal review under the
[routing policy](routing-policy.json). The selected text and source workbook
were already inspected before the policy was recorded. It is neither a
preregistered comparison nor an independent prediction test. Historical
coverage remains 30 cards and 106 assertions; 219 cards and 865 assertions
still need their own dispositions.

## What the new bridge means

The earlier pilot leaves the post-receptor route unresolved. It contains
toad rod recordings, macaque cone/midget filtering and mouse intrinsic
ganglion-cell phototransduction. Connecting those records would not create
a measured single-preparation cascade.

The new relations therefore bind a specified light-drive protocol to a
specified OFF readout. Their candidate mechanisms explicitly include the
rod bipolar and AII stage, rod-cone coupling, and the direct rod-to-OFF
bipolar alternative. These are route-level interpretations of experiments;
the source does not certify every candidate synapse as an independently
measured edge. AII outputs are not assumed to act only through one OFF
bipolar route.

| Relation | Input boundary | Output boundary | Evidence |
| --- | --- | --- | --- |
| `retinal:routing-primate-off` | Rod-preferring sinusoidal illumination of isolated macaque retina | OFF parasol excitatory synaptic input | Grimes 2018, three backgrounds |
| `retinal:routing-mouse-sustained` | Rod-preferring sinusoidal illumination of isolated mouse retina | OFF sustained alpha excitatory input | Grimes 2018, three backgrounds |
| `retinal:routing-mouse-transient` | Full-field flashes in dark-adapted mouse retina | Transient OFF alpha peak firing response at light offset | Jin 2022, separate cone- and rod-specific Cx36 comparisons |

The drug/genotype contrasts support route interpretations within those
boundaries. They do not demonstrate anatomical development, physical
carrier promotion, or a universal minimal circuit.

## Primary evidence and reading extent

[Grimes et al. (2018)](https://elifesciences.org/articles/38281), eLife 7:e38281,
DOI `10.7554/eLife.38281`, PMID `30299254`: the publisher API supplied article
version 2. Reviewed the circuit introduction, OFF-routing Results and
Figure 6 captions, the relevant control caption, preparation limitations,
and electrophysiology, selection, stimulus and analysis methods. Figure 6
was also visually checked against the workbook. The
publisher's Figure 6 workbook was downloaded unchanged and inspected.
The macaque cohort includes three species; neither the manuscript's species
list nor the summary workbook identifies individual experimental animals.

[Jin et al. (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10938630/), Science
Advances 8(13):eabm4491, DOI `10.1126/sciadv.abm4491`, PMID `35363529`:
read the NLM BioC representation of the circuit introduction, Figure 3
experiment and captions, cone-input controls in Figures 4 and 5, APB and
adaptation limitations, and relevant preparation, stimulus and analysis
methods. Supplementary files and original recordings were not reanalysed.
The selected comparison uses the 20 R*/rod/s flash example and corresponding
genotype-series results; it does not import the paper's fitted pathway
thresholds as canonical carrier thresholds.

The [ledger](routing-review.json) records exact locators, metadata checks,
retrieval URLs and retrieved-representation hashes. These hashes identify
the representations read; the two full articles are not vendored, and no
offline full-text replay is claimed. The workbook is locally preserved and
hash-bound. Correction/retraction checking remains incomplete and is stated
explicitly for both publications.

## Numerical observations and interpretation

The six rows below are extracted from Figure 6F source data. The ratio is
response amplitude during LY341495/APB divided by the control amplitude.
It is dimensionless. The six-row modulation frequency remains unresolved;
2 Hz in the adjacent A-C/supplement experiment is not imported into these
contexts. The Figure 6F legend labels mouse n=6 and primate n=5; these group
counts do not supply individual observations or numeric SEM. The paper's
rounded mouse background labels are
retained alongside the workbook values.

| Context | Background, R*/rod/s | Ratio | Scoped interpretation |
| --- | ---: | ---: | --- |
| `grimes-primate-2` | 2 | 0.09 | Supports primary-route predominance |
| `grimes-primate-20` | 20 | 0.18 | Supports primary-route predominance |
| `grimes-primate-200` | 200 | 0.80 | Rod-route attribution unresolved; cone contribution matters |
| `grimes-mouse-0p5` | 0.49 (nominal 0.5) | 0.097 | Supports primary-route predominance |
| `grimes-mouse-5` | 4.9 (nominal 5) | 0.63 | Supports primary and combined non-primary contributions |
| `grimes-mouse-50` | 49 (nominal 50) | 1.00 | Supports combined non-primary signaling; not proof of zero primary contribution |

LY/APB suppresses ON bipolar signaling rather than deleting one uniquely
identified edge. The high-background primate response is particularly
unsuitable for treating residual activity as pure rod input. Missing
uncertainty and raw responses prevent a new quantitative contribution
estimate. These values remain observations, never graph weights or `N_crit`.

The two Jin contexts compare each photoreceptor-specific Cx36 mutant with
its corresponding control under the flash/APB protocol. They support a
secondary-route contribution. They retain the distinct genotype cohorts,
the transient cell class, dark adaptation, and APB effects on crossover
inhibition and basal firing. A constitutive mutation is not an acute
single-edge deletion. No numerical fraction is extracted from those figures.

## Construction and validation rules

- Publication IDs identify articles. Experimental context IDs identify
  complete context records with preparation, adaptation, cell,
  stimulus, intervention and readout conditions jointly required. Unknown
  parameters stay explicit; the records do not claim replication completeness.
- A context contains baseline and intervention arms. It is not one treatment
  state, one specimen, or proof that cells across experiments were co-recorded.
- `experimentalContextIds` binds claims and relations to these protocols.
  Both types of ID survive compilation and appear in Model Studio rationale.
- Candidate sequences describe proposed mechanisms. The non-primary
  candidate is an inclusive OR of secondary and tertiary routes. Support for
  that OR cannot be propagated to either member without identifying evidence.
- `commonExperimentalContexts` requires a context shared by every edge in
  an ordered path. Pairwise overlap or a shared article is insufficient.
  This is a compatibility prerequisite only: even a shared context does not
  itself establish compositional causality or a measured transfer model.
- Existing publication-only fragments return no context-qualified path.
  Generic engine reachability remains a structural operation; it is not
  silently redefined as experimental evidence.

The strict schema and validator reject missing contexts/alternatives,
changed species or cell class, swapped quantity roles, lost source locators,
unsupported OR-to-member promotion, and new bridges that borrow these claims
without their reviewed binding. Scientific prose and selection decisions
still require review; a schema cannot establish their truth.

```sh
python3 models/causal-emergence/canonical/verify-routing-data.py
node --test test/workspace/canonical-routing.test.mjs
npm run check:canonical
```

## Remaining work

1. Obtain individual response data and uncertainty for quantitative fitting.
2. Resolve secondary versus tertiary contributions with selective
   interventions in matched preparations; retain inhibitory and crossover
   alternatives where they affect the readout.
3. Extend adaptation/spatial conditions only after reviewing their primary
   experiments. Recent candidate publications were located during this
   search but have not been admitted as reviewed evidence.
4. Establish matched upstream transfer, developmental mechanisms and a
   prospective target before claiming a complete generated or predictive graph.
5. Continue the untouched historical-card review and the quantitative
   dictionary audit in the [roadmap](../../docs/ROADMAP.md).

The [validation record](../../models/causal-emergence/canonical/VALIDATION-2026.09.12.3.md)
records the release identities, verification and remaining scientific limits.
