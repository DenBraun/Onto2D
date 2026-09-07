# Structural Geometry research plan

The selected research datasets are DREAM4 and C. elegans. The question is
whether geometry adds information about independently measured or simulated
responses beyond simpler graph features. Exact discrimination of arbitrary
small graphs is a computational control, not the principal biological task.

This is the authoritative plan for remaining geometry work. Implemented API
contracts remain in [geometry](GEOMETRY.md), [observations](OBSERVATIONS.md),
[signatures](SIGNATURES.md) and [shadow flow](SHADOW_FLOW.md). Frozen experiment
protocols remain beside their results; this plan does not rewrite those inputs.

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
| C. elegans, Randi et al. 2023 | Primary empirical functional study | Optogenetic stimulation and calcium-response observations | Trials/animals when available; source neuron and repeated pair dependence must be retained |
| C. elegans, Witvliet et al. 2021 | Secondary developmental structural study and explicitly selected anatomical context | Developmental stage or independently justified structural question | Eight different animals, not repeated measurements of one animal |

The [source acquisition guide](../../cases/structural-geometry/datasets/README.md)
owns exact downloadable files, local verification and source terms. Dataset
adoption is not yet an evaluated result or a Model Pack integration.

### DREAM4 contract

Use all five Size10 networks, not a result-selected subset. The challenge
provides noisy simulated mRNA expression, wild type, gene knockouts, knockdowns,
multifactorial perturbations and time series. The published task primarily
infers networks; our task instead uses a known network to evaluate added
information about intervention responses. This is an adapted experiment, not a
DREAM leaderboard submission or replication of its network-inference score.
[Official challenge description](https://www.bioconductor.org/packages/2.12/data/experiment/vignettes/DREAM4/inst/doc/DREAM4_InSilico_Description.pdf).

The archived Bioconductor package includes lightly processed, consistently named
tables and gold standards. Preserve this distribution provenance instead of
calling the tables untouched original challenge ZIPs. Inspect every table's
shape and intervention labels before making a scoring contract. A file called
`dualknockouts.tsv` is not proof that held-out dual-knockout outcomes are present.

Preserve all directed nodes and regulatory edges, including isolates if any;
record explicit zero gold-standard entries separately from absent records.
Do not invent signs, strengths, self-loops or kinetic parameters. The known
unsigned topology underdetermines quantitative dynamics. Source node identifiers
remain network-local, and simulation outputs are targets rather than input edges.

The proposed first target is the **ranking of off-target response magnitudes**
within an intervention, measured relative to the corresponding wild type.
Exclude the directly intervened gene from the primary outcome, since its
forced response would make the task trivial. Freeze the exact normalization,
zero/missing rules and rank ties after source-shape inspection and before scoring.
Keep knockout and knockdown as separate contrasts. Temporal experiments are a
separate protocol, not extra independent replicates of the steady-state task.

Use leave-one-network-out evaluation with any tuning confined to training
networks. Report per-network results and a declared aggregate. Gene pairs,
perturbations and temporal rows from one network must not cross its split.
With five units, uncertainty is coarse and results remain a pilot. GeneNetWeaver
creates a controlled simulation, not direct E. coli/yeast experimental evidence.
[Generator description](https://academic.oup.com/bioinformatics/article/27/16/2263/254752).

### C. elegans functional contract

Randi et al. measure directed signal propagation through optogenetic stimulation
and calcium imaging: the paper reports 23,433 neuron pairs spanning 186 of 188
head neurons across 113 animals. Preserve actual stimulation/response records,
quality measures, observation counts and uncertainty. Unobserved pairs are
missing, not negative responses.
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

The proposed first target is a fixed functional response magnitude/rank on
observed, eligible stimulus-response pairs. A binary connection-detection task,
its q-value threshold and imbalance metrics require a separately fixed contrast.
Select quality thresholds from source methods, not by maximizing geometric gain.

Use animal-disjoint splits only if the chosen records retain animal/trial IDs
and support that split. A pooled atlas cannot substantiate an animal-disjoint
claim. If only pooled data are usable, declare a weaker held-out neuron-block
study with dependence-aware reporting; do not describe it as validation on new
animals. Pairwise IID confidence intervals are inappropriate for shared neurons
and repeated trials. Any mapping, scope selection or calibration using targets
must be restricted to training data and disclosed.

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
| Certified Ollivier | 64 nodes, 256 edges, plus transport/certificate limits |
| Shadow flow and combined geometric signature | 64 nodes, 64 edges, 25 frames |

DREAM4 Size10 already exceeds exact six-node matching. Dense C. elegans scopes
may exceed the 64-edge flow bound even when their node count is small. The plan
must audit real node/edge counts, reciprocity, components, probe applicability,
transport work and stopping behavior before promising full-graph evaluation.

Choose scopes using anatomical/topological rules fixed without held-out response
labels. Record the parent source, selected IDs, omitted edges, boundary policy,
selection algorithm and coverage. Forman on the full parent graph and Ollivier
on an induced fragment describe different populations. Either compile a
separately source-bound fragment for every compared provider or implement and
verify a common scoped-provider contract. Never combine incompatible contexts
silently or truncate by incidental file order.

The current ResponseSignature-v0 requires all mandatory probe families. A DAG
with no feedback target stays incomplete under that contract. A new task-specific
profile may distinguish **observed zero**, **not applicable**, **unobserved**,
**rejected transformation** and **budget failure**, but must define the meaning
and comparison domain of each state explicitly. Reciprocal edges also require
probe-policy review: reversing an edge into an existing edge is not an accepted
simple-graph mutation. Biological knockouts/stimulation are external observations;
current graph-edit probes do not simulate those interventions.

An early certified flow fixed point is a measured stopping event. Retain that
record; do not pad an unobserved four-frame tail with invented observations.
Any event-aware flow descriptor is a separately versioned feature profile.

## Evaluation contract to freeze

The following are required protocol fields, not claims of an already frozen
biological experiment:

1. Source versions, bytes, terms, mappings, populations, scope selection and
   exclusions, with a census before scoring.
2. Structural inputs, independent target and observation availability; identify
   which source fields can enter features and which remain targets.
3. Baselines: joint in/out degrees, size/density, reciprocity, components,
   directed reachability/shortest paths, motif counts and simple propagation
   using the same allowed input and training information.
4. Geometry ablations: baseline alone, baseline plus Forman, plus Ollivier,
   and plus flow/event features. Report each provider's incremental contribution.
   Compare at matched coverage and disclose the full population separately.
5. A meaningful fixed response distance or predictive objective. For the
   proposed rank task, specify rank correlation, ties and non-estimable cases;
   do not reuse whole-family categorical inequality as calibrated similarity.
6. Grouped training/evaluation splits, fixed transforms, tuning budget and
   nulls preserving relevant degree/channel structure. Relabelings and variants
   of one graph stay in the same group.
7. One primary outcome and declared secondary outcomes, per-unit results,
   uncertainty appropriate to the independent units, missingness and exact
   computation cost. Record local timing separately from semantic identity.
8. Independent reference calculations, blind-to-results implementation checks,
   replayable outputs and conditions under which the hypothesis is rejected.

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

D1 acquisition is recorded in the source guide. D2–D7 remain unimplemented for
these datasets. The developmental cohort is a separate follow-up, not a hidden
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
