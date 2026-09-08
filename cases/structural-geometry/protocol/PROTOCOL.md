# Biological geometric rank study v1

This is the locally frozen D3 protocol for the DREAM4 diagnostic pilot and a
separate C. elegans processed-signal study. [protocol.json](protocol.json) owns
the exact populations, parameters, features, splits and reporting rules.
[frozen.json](frozen.json) binds this document, the machine contract, implemented
helpers and independent references. Preserve these inputs; a changed scientific
question or numerical policy needs an explicitly new protocol.

The question is whether adding specified geometric features improves held-out
response ranking for this baseline and learner. Every feature is computed from
the same input graph. A positive result would establish utility of a feature
representation under this pipeline, not new information beyond the graph,
causal identification, general biological validity or a universal geometry score.

## Sources and prior inspection

The [D2 source census](../datasets/README.md) accounts for five DREAM4 Size10
networks, 113 functional recordings and eight anatomical animals. Its source lock
and census bytes are bound by this protocol. Public datasets, native tables,
source anomalies and D2 numerical diagnostics were already inspected. The
protocol is locally prospective for subsequent predictive scoring; it is neither
external preregistration nor a claim of untouched or blinded data.

The machine contract also commits the [eligibility audit](audit.json) content by
SHA-256, excluding its self-digest and enclosing protocol-lock hash to avoid a
circular dependency. Static validation therefore rejects substituted source
identities as well as contradictory counts; full optional replay independently
reconstructs the content from the bound D2 artifacts.

Six [pinned method files](method-source-lock.json) document the publication export
and its limitations. They are read as evidence, never executed. The publication
snapshots describe the intended export path; an execution manifest establishing
the exact installed software and flags for every archived trace is absent.
Neither the paper nor these snapshots establish per-column processing lineage.

## DREAM4 outcome and population

Use all five known unsigned directed Size10 graphs. For each knockout, rank the
nine other genes by `abs(perturbed - wildtype)` on the native expression scale.
There is no division, logarithm, pseudocount, threshold or noise floor. The direct
gene is excluded even when its forced expression is informative. Source IDs,
hashes and expression measurements never enter structural predictor coordinates.

The primary requires all ten interventions in all five networks, nine finite
off-target magnitudes each and at least two distinct magnitudes per intervention.
Otherwise it is unavailable before fitting; an eligible-only descriptive summary
does not replace it. Knockdowns repeat the same fitting/tuning procedure as a
separate secondary contrast, without pooling data or claiming additional networks.
Dual-knockout outcomes are absent. Time series, multifactorial and Size100 data
are outside this protocol. Graph-edit probe failures do not exclude biological
knockout/knockdown observations.

## C. elegans outcome and limits

Dataset7, the first author-indexed adult anatomical unit, is the fixed primary
chemical graph. Dataset8 is a later sensitivity contrast. Keep the entire D2
neighborhood rooted at each stimulated neuron, including all induced directed
chemical arcs; require common Ollivier/flow preparation for the whole scope.
The full 180-node source population remains in the coverage ledger. No functional
outcome chooses the anatomy, scope size or edge subset. Gap junctions remain
separate native records and do not enter this chemical-only contrast.

Accept a receiver/source mapping operationally only when its trimmed label has
one trace column and exactly names an individual neuron in the chosen anatomy.
Uncertain labels, classes, duplicates, negative target indexes and direct receivers
are excluded with reasons. This is a fixed mapping convention, not an identity
confidence certificate. Different anatomical and functional animals remain distinct.

For stimulus time t, use 60 exported samples in `[t−30s,t)` and 60 in
`[t,t+30s)` on the exact 0.5-second grid. Let F0 be the baseline arithmetic mean;
retain signed `(mean(post)−F0)/F0` and rank its absolute magnitude. Require complete
finite windows and F0 > 0; add no interpolation. Reject both rows at a duplicate
stimulation time and any event with another native stimulus in the combined
half-open window, including negative-target rows. Compare times, preserving row
identities. This cannot rule out carryover from earlier stimulation.

Thirty-second windows and the mean-baseline contrast follow the published
method description and reference implementation. [Primary paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10632145/),
[published contrast code](https://github.com/leiferlab/pumpprobe/blob/5ca97c72a3be2582c25a1ce307da7fc0c57ad7db/pumpprobe/Funatlas.py#L1313).
The export branch saves fluorescence before event-specific decaying-response
correction and auto-response selection. [Export branch](https://github.com/leiferlab/pumpprobe/blob/5ca97c72a3be2582c25a1ce307da7fc0c57ad7db/scripts/fconnectivity/funatlas_plot_intensity_map.py#L73).
The source signal loader keeps the acquisition missing-mask separately from
processed/interpolated data, but the six-family TXT export omits that mask.
Finite exported samples therefore do not certify raw acquisition quality.
[Signal handling](https://github.com/leiferlab/wormdatamodel/blob/8da607ce94d6fea90bf463db2482cbe6e14d5c5f/wormdatamodel/signal/signal.py#L290),
[exported fields](https://github.com/leiferlab/pumpprobe/blob/5ca97c72a3be2582c25a1ce307da7fc0c57ad7db/pumpprobe/Funatlas.py#L279).

Source-quality masks, successful target-hit/auto-response flags, label confidence,
per-column processing history and unstimulated controls are unavailable. This
study cannot reproduce the paper's quality filter, q-values or functional-edge
classifier. Its target is a processed-fluorescence contrast following a recorded
or attempted stimulus. No reliable animal-ID map is asserted.

Aggregate eligible trial magnitudes by median within each recording/source/receiver,
then take the median of recording medians. This differs from the paper's pooled
mean and gives recordings equal weight. A pair needs two measured recording
medians; a source group needs at least three eligible receivers with a nonconstant
target. Require five eligible source groups for the study. Preserve unobserved
pairs and all counts. A metadata-only pre-freeze audit found 201 mapped stimuli
in 29 candidate scopes, 198 complete uncontaminated windows and 19 stimulated
source groups. These are pre-quality counts; no response magnitudes were used.

## Features and learner

The fixed baseline has 23 graph-only coordinates: sizes/density, endpoint degrees,
adjacency, reciprocity, components, reachability/distance, shared neighbors,
two-step paths, two non-induced triangle roles and length 2–4 propagation.
Unreachable distance is a structural zero sentinel with an explicit mask. Walks
terminate at sinks. A separate untrained propagation score uses
`sum(2^(-k) * P^k(source,target), k=1..4)`.

Each Forman and Ollivier edge field contributes six source/receiver coordinates:
four endpoint incidence means, direct-edge value and the mean over distinct edges
in the union of all shortest directed unit-hop paths. Count each union edge once.
Known empty incidence/direct/path sets use zero with the baseline degree,
adjacency or unreachable mask. Missing or failed certificates never become zero.

Flow uses unit initial lengths, half idleness/step, four updates, tolerance
1/1,000,000, two stable steps and no cut. Apply the same six coordinates to actual
terminal lengths and curvature, then add terminal weighted distance, stopping
iteration and five stopping-reason flags: 19 flow coordinates. This separate
terminal-event profile admits only certified observed states. It pads no missing
tail and makes no convergence claim at the iteration cap. Existing
GeometricSignature-v1 and ResponseSignature-v0 are unchanged.

All geometry uses the identical scoped graph, complete edge coverage and verified
exact point values. Aggregate rationals exactly before a finite binary64 feature
conversion; reject unsupported overflow/underflow and non-point intervals.
The full predictor has 54 coordinates. Geometry collection is a D4 implementation
deliverable under these fixed formulas, not an already scored result.

Fit weighted ridge to `(average target rank−1)/(target count−1)`. Standardization
uses only the current training partition; constant training columns become zero
in training and evaluation. Weights balance groups, then interventions, then
eligible receivers. The intercept is unpenalized. The fixed lambda grid is
0.01, 0.1, 1, 10, 100; choose highest inner-validation rank skill, exact ties going
to larger lambda. No prediction clipping or fallback model is used.
The helper bounds complete nested-fold materialization at 2,000,000 row/group
references before allocation; exceeding that budget rejects the requested folds
without sampling groups or changing their membership.

DREAM4 uses five outer leave-one-network-out folds and four inner folds on the
training networks. C. elegans holds out entire stimulated-neuron groups across
all recordings and receivers, with the same nested rule. Its evaluation is
transductive on one anatomy; recordings and receiver neurons may be shared across
folds. It is neither new-animal nor unseen-graph validation.

## Metrics, comparisons and reporting

The primary rank skill assigns +1 to correct ordering, −1 to reversed ordering
and 0 to a prediction tie among pairs with unequal observed targets. Divide by
the number of such target pairs. Constant predictions therefore have a defined
score of zero; constant observed targets are non-estimable. Ties use exact numeric
equality and average ranks. Spearman and Kendall tau-b are secondary metrics with
their mathematically undefined constants explicitly null.

Compare B, B+F, B+O, B+flow, B+F+O and B+F+O+flow. The sole primary contrast in each
study is full geometry minus B on the exact same eligible population, fixed before
fitting all methods. Average interventions within DREAM4 networks, then networks
equally; average eligible C. elegans source groups equally. Report complete paired
group vectors and all ablations, including zeros and negatives. A nonpositive
mean is no observed gain for this pipeline. A positive mean supports only its
limited feature-representation claim.

Report min/max and leave-one-group-out aggregate ranges as descriptive sensitivity,
not confidence intervals. Shared training sets/neurons preclude pairwise IID
inference. Insufficient coverage or failed mandatory calculations leaves the
primary unavailable with reasons. Keep wall time and resource observations
separate from semantic identities. The fixed D6 null/sensitivity plan in the JSON
is not used to tune primary results or claim a calibrated p-value.

## Reproduction and delivery boundary

```sh
npm run structural-geometry:protocol:check
npm run structural-geometry:protocol:methods:fetch
npm run structural-geometry:protocol:methods:verify
npm run structural-geometry:protocol:audit
```

The normal protocol check uses synthetic controls and frozen file/source hashes;
it downloads no corpus. Method commands acquire/verify six small evidence files
in ignored cache. The optional audit requires the verified D2 prepared artifacts,
constructs DREAM4 target eligibility and C. elegans timing/mapping counts, and
does not fit predictors or calculate comparative biological scores. Missing D2
cache is explicit; reproduce it with the source-guide commands first.

Independent rank controls and a high-precision joint-intercept ridge reference
check the numerical helpers. Baselines have independent walk-enumeration controls;
functional windows/aggregation and complete group separation have synthetic
controls. Freeze only after review and these checks pass. D4 implements complete
pair-geometry collection and the DREAM4 evaluation; D5 applies the functional
contract while retaining its documented quality and dependence limits.
