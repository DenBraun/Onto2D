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

The biological studies therefore use external targets, informative baselines,
coverage accounting and declared sampling units. A comparison must not turn every
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
successful stimulation. D5 establishes the actual trace-derived population:
9 source groups and 60 pairs, with complete native exclusion accounting.

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
native counts, reciprocity, components, probe applicability and preparation work.
D5 and D6 execute the accepted bounded scopes and retain stopping certificates
or explicit computation failures; they do not execute full-parent anatomical flow.
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
execution is complete for all 29 prepared Dataset7 scopes in D5. Five reach a
fixed point and 24 stop at the four-update cap. Other anatomical units remain
outside the primary study.

An early certified flow fixed point is a measured stopping event. Retain that
record; do not pad an unobserved four-frame tail with invented observations.
D3 defines a separate terminal-event feature profile using actual final lengths,
curvatures and stopping metadata. D4 implements its verified pair extraction;
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
graph or a biological causal mechanism. D6 robustness is separate from primary
tuning. D3 fixes the constrained null sampler and names additional sensitivity
families; concrete parameters for any additional secondary profiles must be
versioned before their own scoring runs, with the already inspected primary
outcomes disclosed.

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
| D6 — robustness | Graph-feature/capacity controls, provider/initial-length/idleness sensitivity, constrained nulls and scope robustness | Repeated conclusions or a disclosed failure; no tuning to force a positive result |
| D7 — publication | Verified artifacts and a readable geometry page | Numerical, source, evidence and claim checks pass; actual outcomes and exclusions visible |

D1 acquisition, D2 source/applicability infrastructure, D3 protocol/helpers,
the [D4 DREAM4 pilot](../../cases/structural-geometry/dream4/README.md) and
the [D5 C. elegans study](../../cases/structural-geometry/celegans/README.md) are implemented.
The [source guide](../../cases/structural-geometry/datasets/README.md)
owns native replay; the [protocol](../../cases/structural-geometry/protocol/PROTOCOL.md)
owns frozen scientific choices and synthetic/reference checks. D3 supplies
target/population eligibility, rank metrics, graph baselines, grouped ridge and
processed-window/aggregation helpers. It does not supply comparative biological
scores or claim that functional outcome extraction has run over the corpus.

D4 retains all 450 target rows in each contrast across five held-out networks.
The full model's mean rank skill is 0.2456 versus B's 0.1689 for primary knockouts
(paired gain +0.0767, positive on all five networks). Secondary knockdowns score
−0.0233 versus 0.0200 (paired gain −0.0433, negative on three networks); standalone
propagation scores 0.0806 there. All six ablations, secondary metrics, tuning
choices, independent numerical checks and costs are retained. These mixed
outcomes support neither a universal improvement nor a general failure claim.

D5 accounts for all 5,808 stimuli and 76,800 selected receiver samples. Of 640
receiver windows, 628 yield measured contrasts and 12 have nonpositive baselines.
After recording medians and group eligibility, 9 sources and 60 pairs remain.
Full mean rank skill is 0.0499 versus B's 0.2852 (paired difference −0.2353);
two sources improve, one ties and six decrease. No declared augmentation exceeds
the baseline mean. This is a negative result on selected small scopes of one
anatomy, with overlapping recording/receiver populations and processed signals.
The independent reference verifies sample selection, exclusions, target ranks,
all 2,056 scoped descriptors, 1,134 distinct fits and 14,760 predictions.
The 42 unbound trailing label
slots, unidentified/duplicate labels, negative stimulus sentinels and anomalous
stimulation rows remain preserved; fixed eligibility rules now govern their use.
The [D6.1 constrained-null study](../../cases/structural-geometry/robustness/README.md)
is complete: all 32 indices and 1,088 scope combinations are retained, with
2,460,251 independently checked proposals and 3,628,800 checked predictions.
The original DREAM4 knockout gain exceeds 31 of 32 null gains; knockdown remains
negative. C. elegans has no available matched null comparison because URADL
never reaches the fixed switch count. This disclosed failure does not change
the primary population or estimate a zero null effect. The bounded deterministic
sampler supplies descriptive sensitivity, not a uniform null or calibrated p-value.
Original target/scope membership stays fixed across all indexed variants.
The implementation profile makes source-unit seed identities,
index pairing and required-scope failure handling explicit.

[D6.2 adult-anatomy sensitivity](../../cases/structural-geometry/robustness/README.md#d62-adult-anatomy-sensitivity)
is implemented and replayed with explicit unavailable results. Dataset8 retains
all 180 roots and 32 prepared scopes, 90 eligible native events, 243 receiver
windows and 8 response groups / 37 pairs. Thirty-one complete geometries yield
2,574 pair descriptors; ALML exceeds the unchanged 256-digit flow bound. D5's
complete prepared-scope requirement is retained, so this context-root failure
blocks Dataset8 predictive evaluation even though ALML supplies no eligible
response group. It is a computational limit, not evidence of zero predictive
gain. The two anatomies share 18 eligible pairs across ASJL, IL2DR, URADL and
URADR; four groups do not meet the fixed five-group study threshold. Recomputed
shared ranks and all 79 union pairs are retained without fitting that subset.
Independent checks cover all 5,808 native events, 29,160 selected samples and
4,630 successful descriptor pairs across both anatomies. No biological fits or
predictions are claimed for this unavailable contrast; a separate synthetic
five-group control verifies the model execution path.

[D6.3 graph-feature/capacity controls](../../cases/structural-geometry/robustness/README.md#d63-graph-features-and-capacity-controls)
are implemented and replayed on the unchanged 450/450/60 targets and 34 scoped
graphs. Q adds 31 fixed nonlinear coordinates of B; S adds 31 graph-context
coordinates. Six models retain the same ridge grid and grouped evaluation.
B and B+G reproduce the primary reports exactly. The prespecified secondary
comparison B+S+G minus B+S gives +0.0189 / +0.0089 / −0.1158 for knockout /
knockdown / Dataset7. Both compared knockdown scores remain negative. S raises
Dataset7's graph-only score from 0.2852 to 0.3942; geometry lowers it to 0.2784.
All eight comparisons, group vectors and training-column counts remain visible;
equal width is not equal statistical capacity. Exact rational group differences
prevent a floating summation tail from becoming a gain claim. The independent
reference checks 2,506 descriptor pairs, 1,794 distinct fits, 128,160 predictions
and all 24 aggregate comparisons. This secondary design follows inspected
primary outcomes; it is not blinded preregistration or a general advantage claim.

[D6.4 transport-metric/idleness/initialization sensitivity](../../cases/structural-geometry/robustness/README.md#d64-transport-metric-idleness-and-initialization)
is complete on the unchanged populations. Five declared variants cover unit
reference, zero idleness, inverse target share with explicit synthetic unit
edge masses, source-outdegree initialization and uniform scaling. Unit Forman
remains fixed; this is not weighted Forman sensitivity. All 170 scope combinations
and 15 study evaluations are available. Independent checks cover 787 states,
12,530 pair descriptors, 2,990 distinct fits, 213,600 predictions and 60 exact
comparisons. The unit reference and uniform-scale control reproduce D6.3 exactly.
Dataset7 stays below both respective graph-only baselines for every tested
setting. Knockdown's B+G-minus-B sign reverses for inverse target share, while all
B+S+G absolute scores remain negative. Knockout gains vary substantially with
the baseline and idleness. Every declared setting is retained; no winner becomes
a replacement primary or default. Interactions, arbitrary idleness values and
native biological weight metrics are not covered by these bounded profiles.

[D6.5 scope/low-degree coverage](../../cases/structural-geometry/robustness/README.md#d65-scope-selection-and-low-degree-coverage)
is complete. Four topology-only rules retain all 1,440 rooted selections in
Dataset7/8. Parent degree, recording/stimulation coverage, preparation and
response eligibility are distinct. All five Dataset7 nodes with at most five
neighbors prepare under the original rule, but none appears in its 60 eligible
source/receiver pairs; that stratum has no primary predictive evidence.
The incoming alternative supports a new matched 35-pair / 6-group population.
Both contexts refit B, B+G, B+S and B+S+G on identical rows. The original weak
context's expanded gain changes from −0.1158 on 60 pairs to +0.0897 on this
subset; incoming expanded gain is −0.0462 while its original-baseline gain is
+0.0722. This discloses population, scope and baseline dependence. Outgoing
and weak two-hop comparisons lack the required five common groups and remain
unavailable. The secondary target-bearing computation gate does not change
D5/D6.2's full prepared-scope requirement. Independent coverage, geometry,
feature, fitting and exact-comparison checks accompany full semantic replay.

D6.1–D6.5 are complete; **D7 is implemented locally** in the
[Structural Geometry Lab](../../apps/structural-geometry-lab/README.md).
External publication and independent review remain separate decisions. An expanded native-target population,
different arithmetic budget or Dataset8 target-scope-only profile would be a
separately declared follow-up. It cannot replace the failed Dataset8 profile,
and fixing ALML would not supply a fifth shared group. No primary contrast is
replaced or retuned to improve the displayed result.

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

Display the current synthetic zero result and the DREAM4/C. elegans outcomes
without converting them into a universal geometry score. Do not imply that a
browser rerun of a stored result retrains a model, repeats a biological
experiment or provides independent validation. Cross-domain demos, persistence
and higher-order panels are not mandatory placeholders before this page can ship.


The implemented homepage places Distinguishability in a foundation strip above
Canonical Identity, Network Motifs and Historical Load, with a shared Structural
Geometry entry beneath them. It expresses a methodological relation, not a new
physical law. The lab keeps a selected graph pair and edge focus across its four
views. The three actual observation regimes are canonical structure, topology
only and typed relations; no history regime or inferred vocabulary is fabricated.
The synthetic geometric metric remains separate from the selected observation
regime. Early flow stops and partial receipts preserve their actual coverage.

Site generation authenticates the committed study dependencies and independent
reference locks, projects compact evidence, bundles the worker, and binds both
JSON payloads by release byte count and SHA-256. The browser replays small
comparisons and certificates and recomputes score summaries from stored rank
counts. Raw native data processing, model training and independent reference runs
remain offline. A failed payload or worker clears its own result surface rather
than displaying a cached or zero-valued substitute. See the
[app guide](../../apps/structural-geometry-lab/README.md) for build and review commands.
