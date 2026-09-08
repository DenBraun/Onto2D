# Structural Geometry research plan

The selected research datasets are DREAM4 and C. elegans. The question is
whether geometric features improve held-out response ranking relative to simpler
graph features under the fixed learner. Exact discrimination of arbitrary
small graphs is a computational control, not the principal biological task.

This is the authoritative plan for remaining geometry work. Implemented API
contracts remain in [geometry](GEOMETRY.md), [observations](OBSERVATIONS.md),
[signatures](SIGNATURES.md) and [shadow flow](SHADOW_FLOW.md). Frozen experiment
protocols remain beside their results; this plan does not rewrite those inputs.
The [D3 biological protocol](../../cases/structural-geometry/protocol/PROTOCOL.md)
and its [machine contract](../../cases/structural-geometry/protocol/protocol.json)
own the fixed targets, populations, features, learner and evaluation rules for
the selected studies.

## Evidence motivating the study

The existing synthetic study contains 32 non-isomorphic six-node/eight-arc
graphs and all 496 negative pairs. Complete responses exist for 21 graphs,
leaving 210 eligible pairs and excluding 286 pairs. The 11 excluded graphs are
DAGs: a mandatory feedback probe has no eligible target. All 32 geometric
signatures are complete, so the missingness belongs to the response profile.

Joint degrees already distinguish all 496 graph pairs. Response A separates
all 210 eligible pairs, with 206 distances at the categorical maximum of 1.
There is no degree-matched negative pair. Adding geometry produces zero new
splits. This establishes the result of this panel and exposes a ceiling and
applicability problem; it establishes neither biological usefulness nor general
uselessness. [Frozen evidence](EVIDENCE.md) remains a regression control.

The next study therefore needs an external target, informative baselines,
coverage accounting and independent sampling units. It must not turn every
nonidentical feature family into distance 1 and call that calibrated similarity.

## Selected sources and roles

| Dataset | Role | Independent target | Unit and limits |
|---|---|---|---|
| DREAM4 In Silico Size10, all five networks | First bounded diagnostic pilot | Off-target expression response to published knockout/knockdown interventions | Entire network is a split unit; five networks cannot support broad biological inference |
| C. elegans, Randi et al. 2023 | Primary empirical processed-signal study | Adapted fluorescence-window contrast following recorded stimulation | Hold out stimulated-neuron groups; recordings and receivers may be shared across folds; animal identity is unverified |
| C. elegans, Witvliet et al. 2021 | Secondary developmental structural study and explicitly selected anatomical context | Developmental stage or independently justified structural question | Eight different animals, not repeated measurements of one animal |

The [source acquisition guide](../../cases/structural-geometry/datasets/README.md)
owns exact downloadable files, local verification and source terms. Dataset
adoption is not yet an evaluated result. Native adapters now produce local
preparation artifacts and transient computational Model Packs, without registering
or publishing a biological model. The source guide owns the current census.

### DREAM4 contract

Use all five Size10 networks, not a result-selected subset. The challenge
provides noisy simulated mRNA expression, wild type, gene knockouts, knockdowns,
multifactorial perturbations and time series. The published task primarily
infers networks; our task instead uses a known network to evaluate predictive
utility for intervention responses. This is an adapted experiment, not a
DREAM leaderboard submission or replication of its network-inference score.
[Official challenge description](https://www.bioconductor.org/packages/2.12/data/experiment/vignettes/DREAM4/inst/doc/DREAM4_InSilico_Description.pdf).

The archived Bioconductor package includes lightly processed, consistently named
tables and gold standards. Preserve this distribution provenance instead of
calling the tables untouched original challenge ZIPs. The native adapter verifies
the table shapes and intervention alignment. `dualknockouts.tsv` contains gene
pairs only, with no supplied response outcomes.

Preserve all directed nodes and regulatory edges, including isolates if any;
record explicit zero gold-standard entries separately from absent records.
Do not invent signs, strengths, self-loops or kinetic parameters. The known
unsigned topology underdetermines quantitative dynamics. Source node identifiers
remain network-local, and simulation outputs are targets rather than input edges.

The frozen primary target is the **ranking of off-target response magnitudes**:
`abs(perturbed - wildtype)` on the native expression scale, with no division,
pseudocount or threshold. Exclude the directly intervened gene. Exact numeric
ties receive average ranks. The primary requires all ten interventions in each
of the five networks, nine finite off-target values per intervention and at least
two distinct magnitudes. A constant target makes the strict primary unavailable;
eligible-only summaries cannot replace it. Knockdowns repeat the same fitting
and tuning as a separate secondary contrast. Temporal and multifactorial
experiments are outside this protocol and supply no additional independent units.

Use five outer leave-one-network-out folds and four inner folds on the training
networks. Report per-network results and an equal-network aggregate. Gene pairs,
perturbations and temporal rows from one network must not cross its split.
With five units, uncertainty is coarse and results remain a pilot. GeneNetWeaver
creates a controlled simulation, not direct E. coli/yeast experimental evidence.
[Generator description](https://academic.oup.com/bioinformatics/article/27/16/2263/254752).

### C. elegans functional contract

Randi et al. measure directed signal propagation through optogenetic stimulation
and calcium imaging: the paper reports 23,433 neuron pairs spanning 186 of 188
head neurons across 113 animals. Those published counts describe the paper's
study, not the eligible population of our adapted protocol. Preserve native
stimulation records and observation coverage. Unobserved pairs are missing,
not negative responses.
[Paper and data availability](https://pmc.ncbi.nlm.nih.gov/articles/PMC10632145/),
[author dataset](https://osf.io/e2syt/).

Use an explicitly sourced anatomical graph as structural input and functional
response as target. A graph built from the functional atlas cannot also predict
those same atlas edges as an independent target. Anatomical and functional
records come from different animals and measurement methods; neuron-name
alignment needs an auditable mapping, not a shared-ID assumption.

Keep chemical synapses and gap junctions as distinct channels. Define their
directionality, multiplicity, weights, omissions and any symmetrization before
projection. A reciprocal chemical pair is not a gap junction. Initial geometric
lengths are an analysis policy, not measured conduction delays or synaptic
strengths. Extrasynaptic signaling is a plausible limit on anatomy-only models.

The fixed primary anatomical context is Dataset7, the first author-indexed adult
chemical graph; Dataset8 is a separate sensitivity contrast. Use complete D2
one-hop neighborhoods rooted at the stimulus, with common provider preparation.
All anatomical roots remain in the census. D3 accounts for every native stimulus
in aggregate; its identity remains in the bound native artifact. D5 adds explicit
event-level mapping, window and receiver exclusion records.

The target is an adapted absolute change in **processed exported fluorescence**.
Use complete 30-second baseline and post-stimulation windows on the exact native
grid, a strictly positive baseline mean, and no added interpolation. Duplicate
stimulation times and any other native stimulus in the combined half-open window
exclude an event. Aggregate magnitudes by median within a recording/source/receiver
and then across recordings. A pair requires two measured recording medians;
a source group requires three eligible receivers with a nonconstant target.
At least five eligible source groups are required. The full rules and source
method evidence live in the [protocol](../../cases/structural-geometry/protocol/PROTOCOL.md#c-elegans-outcome-and-limits).

The export omits the original acquisition missingness mask, target-hit/auto-response
flags, label confidence and per-column processing lineage. Finite values may
include upstream interpolation. This contrast cannot reproduce the paper's
quality filters, q-values or functional-edge classifier and does not establish
successful stimulation. Actual trace-derived eligibility remains to be computed.

Hold out each entire stimulated-neuron group across all its recordings and
receivers, with tuning restricted to training groups. This is transductive
evaluation on one anatomy: recordings and receivers may be shared across folds.
It is neither new-animal nor unseen-graph validation. Exact-label matches are an
explicit operational mapping rule, not a confidence certificate. Pairwise IID
confidence intervals are inappropriate for this dependence structure.

### C. elegans developmental contract

Witvliet et al. reconstruct eight isogenic animals: four L1, one L2, one L3 and
two adults. These are cross-sectional connectomes, not the history of one worm.
Keep separate animal and stage identities and preserve edge counts and source
coverage. Do not create a historical lineage or temporal transition between
individuals merely by sorting ages.
[Primary paper and supplementary tables](https://pmc.ncbi.nlm.nih.gov/articles/PMC8756380/),
[author stage metadata](https://github.com/dwitvliet/nature2021/blob/0646af9d25896ae660f97d462eab2d67282f5625/src/data/dataset_info.py).

Use this cohort to ask a separately declared developmental question after the
functional pilot. Stage labels are external metadata; graph-derived communities
or curvature-derived cuts are not independent labels for validating that same
algorithm. Eight animals support a limited descriptive study. Anatomical records
from this cohort can supply context for the functional study only under an
explicitly chosen graph and mapping; do not pool the cohort sample counts.

## Applicability gate before evaluation

Current public contracts have different bounds:

| Contract | Bound relevant to dataset selection |
|---|---|
| Full-source projection / unit Forman | 4,096 nodes, 16,384 edges |
| Exact canonical and typed matching | 6 nodes, 30 edges |
| Topology response scope | 64 nodes, 256 edges, with additional target/work limits |
| Certified Ollivier | 64 nodes, 256 scoped edges, at most 32 analyzed edges per request, plus transport/certificate limits |
| Shadow flow and combined geometric signature | 64 nodes, 64 edges, 25 frames |

DREAM4 Size10 already exceeds exact six-node matching. Dense C. elegans scopes
can exceed the 64-edge flow bound even when their node count is small. D2 audits
native counts, reciprocity, components, probe applicability and preparation work;
complete anatomical execution and its stopping/certificate behavior remain open.
The case-local [scope policy](../../cases/structural-geometry/datasets/scopes.mjs)
also bounds aggregate census work and complete scope-ledger references before
allocation. These limits do not change the public provider contracts.

D2 fixes scopes using anatomical/topological rules without held-out response
labels. Each scope records its parent source, selected IDs, omitted edges,
boundary policy, selection algorithm and coverage. Compared providers use the
same separately compiled fragment. Forman on the full parent graph describes a
different population and stays separate from fragment results. No scope is
truncated by incidental file order.

The current ResponseSignature-v0 requires all mandatory probe families. A DAG
with no feedback target stays incomplete under that contract. The independently
versioned availability profile distinguishes **observed zero**, **not applicable**,
**unobserved**, **rejected transformation** and **budget failure**, with explicit
meanings and comparison domains. D3 target and population helpers
apply their separate scientific eligibility rules. Reciprocal edges also require
probe-policy review: reversing an edge into an existing edge is not an accepted
simple-graph mutation. Biological knockouts/stimulation are external observations;
current graph-edit probes do not simulate those interventions.

The D2 diagnostic compiles every full DREAM4 graph and audits all 1,361
closed one-hop chemical neighborhoods across eight separate anatomical graphs.
Common preparation succeeds for 720 neighborhoods; all exclusions are retained.
This is a census of candidates, not a selected empirical population or 720
independent samples. Its all-edges Ollivier request makes the common edge bound
32. Every provider in a candidate uses the same compiled fragment; parent Forman
is reported separately. The five DREAM4 flows stop at the four-update diagnostic
cap; their five observed frames do not establish convergence. Anatomical flow
execution remains pending.

An early certified flow fixed point is a measured stopping event. Retain that
record; do not pad an unobserved four-frame tail with invented observations.
D3 defines a separate terminal-event feature profile using actual final lengths,
curvatures and stopping metadata. D4 must implement its verified pair extraction;
existing GeometricSignature-v1 remains unchanged.

## Frozen evaluation contract

The [D3 protocol](../../cases/structural-geometry/protocol/PROTOCOL.md) and
[freeze manifest](../../cases/structural-geometry/protocol/frozen.json) own the
reviewed scientific inputs and helper/reference identities. The baseline has
23 graph-only coordinates; the full specified predictor adds Forman, Ollivier
and terminal-flow coordinates on the identical scoped graph. Weighted ridge
uses normalized average-rank targets, training-only standardization and a fixed
lambda grid with nested group validation.

The primary metric is pairwise rank skill on unequal observed target pairs:
correct ordering contributes +1, reversed ordering −1 and a prediction tie 0.
Constant predictions therefore have a defined zero skill; constant observed
targets remain non-estimable. Spearman and Kendall tau-b are secondary diagnostics.
The sole primary comparison in each study is full geometry minus the baseline,
on exactly matched eligible populations, with all ablations and exclusions shown.

Report complete group vectors, equal-group means and descriptive ranges without
pairwise IID confidence intervals or a significance claim. A nonpositive mean
is no observed gain for this pipeline. A positive mean supports usefulness of
this representation for the frozen learner and baseline; all geometry remains a
function of the same graph. It does not establish new information beyond the
graph or a biological causal mechanism. The fixed D6 robustness plan is separate
from primary tuning.

Public datasets and the existing synthetic outcomes have already been inspected.
A prospective local protocol records choices before the next scoring run; it
cannot retroactively create external preregistration or untouched validation data.

## Delivery sequence

| Gate | Deliverable | Acceptance |
|---|---|---|
| D1 — sources | Locked DREAM4 and C. elegans files, metadata, terms, archive inventory and reproducible acquisition | Exact bytes replay; separate anatomy/response identities; missing and unknown fields disclosed |
| D2 — applicability | Native source census, adapters, bounded scopes, neuron/gene mappings and a versioned task profile | All selected units accounted for; no silent truncation, target leakage or unavailable-to-zero coercion |
| D3 — protocol | Fixed target, baselines, splits, transforms, metrics and negative reporting policy | Independent contract/reference review; no scoring-dependent choice hidden in the protocol |
| D4 — DREAM4 pilot | Five-network matched-coverage ablation with independent response targets | Reproducible per-network outcomes and costs, including zero/negative gains |
| D5 — C. elegans functional study | Anatomical-input / measured-response evaluation under the accepted split | Mapping and dependence limits explicit; complete coverage and baseline reporting |
| D6 — robustness | Provider/initial-length/idleness sensitivity, constrained nulls and scope robustness | Repeated conclusions or a disclosed failure; no tuning to force a positive result |
| D7 — publication | Verified artifacts and a readable geometry page | Numerical, source, evidence and claim checks pass; actual outcomes and exclusions visible |

D1 acquisition, D2 source/applicability infrastructure and D3 protocol/helpers
are implemented. The [source guide](../../cases/structural-geometry/datasets/README.md)
owns native replay; the [protocol](../../cases/structural-geometry/protocol/PROTOCOL.md)
owns frozen scientific choices and synthetic/reference checks. D3 supplies
target/population eligibility, rank metrics, graph baselines, grouped ridge and
processed-window/aggregation helpers. It does not supply comparative biological
scores or claim that functional outcome extraction has run over the corpus.

D4 is next: implement complete verified pair-geometry collection and the nested
DREAM4 evaluation. D5 applies the functional contract and reports actual eligible
response populations with all source exclusions. The 42 unbound trailing label
slots, unidentified/duplicate labels, negative stimulus sentinels and anomalous
stimulation rows remain preserved; fixed eligibility rules now govern their use.
D4–D7 and anatomical scope execution remain open.

The developmental cohort is a separate follow-up, not a hidden
extra primary endpoint. Directed persistence and higher-order dependencies remain
conditional research: proceed only if a concrete target requires information
that the current graph/response/geometry profiles cannot supply.

## Website contract

The page should explain the graph, observation/probe, signature and evaluation
in that order. Show compact implementation controls separately from biological
examples. Every result identifies source/version, population, coverage,
baselines, metric and claim class; details expose verified artifacts and costs.
A source viewer may precede evaluated research but must say “not evaluated”.

Display the current synthetic zero result and eventual biological outcomes
without converting them into a universal geometry score. Do not imply that a
browser rerun of a stored result retrains a model, repeats a biological
experiment or provides independent validation. Cross-domain demos, persistence
and higher-order panels are not mandatory placeholders before this page can ship.
