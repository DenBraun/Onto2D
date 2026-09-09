# Biological structural-geometry robustness

D6 follows the separate [DREAM4](../dream4/README.md) and
[C. elegans](../celegans/README.md) primary studies. It tests the limitations of
those pipelines without changing their targets, reported results or tuning.
The [D3 protocol](../protocol/protocol.json) owns the predeclared robustness
families and the exact constrained-null sampler. Further secondary profiles
need explicit versioned parameters before their own comparative runs; a named
sensitivity family is not a completed parameter specification.

## D6.1: constrained graph nulls

This implementation evaluates all 32 declared null indices on the five complete
DREAM4 networks and all 29 prepared Dataset7 anatomical scopes. A null changes
edge placement while preserving every labelled node's incoming and outgoing
degree and the original labelled weak-component partition. It does not preserve
strong components, reciprocity, path lengths or biological transmission.

Each index starts from the original D2 graph. Current edges are sorted by source
and target in ECMAScript UTF-16 order before every proposal. The first two
big-endian uint32 words of SHA256 over the exact JSON tuple in D3 choose two
edges. Only a changed, loopless, simple edge set preserving component membership
is accepted. Stop at `10 * edgeCount` accepted switches or 4,096 proposals;
insufficient accepted switches make that scope unavailable. A partial final
graph is retained for audit and is not passed to geometry or prediction.

The seed's `datasetId` is the native unit ID (`insilico_size10_1` through `_5`, or
`Dataset7`). Its root is null for DREAM4 and the original source neuron for
C. elegans. The original graph hash is D2's normalized JSON graph hash, not a
Model Pack or an updated graph hash. The implementation profile records these
identifier conventions and the following evaluation rules explicitly.

The same null index is paired across all relevant units. Original scope node
membership stays fixed after rewiring; neighborhoods are not reselected.
All D4/D5 target row identities, measurements, ranks, eligibility and grouped
folds remain unchanged. A newly unreachable receiver remains an observation;
its graph features describe that new reachability state.

Every successfully sampled scope gets fresh Forman, Ollivier and flow evidence,
verified against its own synthetic Model Pack and the original fixed parameter
profile. Baselines and all pair features are recomputed on the same null graph.
Every evaluable study repeats all six ablations, all five ridge penalties and
every outer/inner grouped fold. KO and KD remain separate evaluations.

All target-bearing scopes must succeed for a study/index to receive a score.
An unavailable required scope or numerical fit makes that entire comparison
unavailable, with no partial-population estimate or replacement model. The
other prepared C. elegans scopes remain a separately reported context census:
their failures cannot remove or redefine the nine already eligible source
groups. Their successful nulls are still measured and independently checked.

Every index, failed scope, proposal outcome, returned original graph and duplicate
sample is retained. Duplicates have their original multiplicity; there is no
redraw or deduplication. Ten accepted switches per edge does not establish mixing
or uniform sampling. Small control graphs can return to the original topology
at every index despite completing the required switches.

## Results and interpretation

D6.1 is complete. All **1,088** requested scope/index combinations and
**2,460,251** proposals were independently replayed. Of those combinations,
**837** complete the sampling rule and receive verified geometry; **251** fail
the sampler's acceptance target. No admitted graph encounters a geometry work
failure in this run. The independent reference checks **70,628** ordered pair
descriptors, **21,120** distinct model fits covering all **40,320** nested fit
requests, and **3,628,800** predictions.

The comparison below is full geometry minus the graph-only baseline, as in the
primary studies. Every null uses the original biological target population.

| Study | Original paired difference | Complete indices | Mean null difference | Null difference range | Null differences below original |
|---|---:|---:|---:|---|---:|
| DREAM4 knockout | +0.0767 | 32/32 | −0.0368 | [−0.1450, +0.0894] | 31/32 |
| DREAM4 knockdown | −0.0433 | 32/32 | −0.0152 | [−0.1178, +0.0806] | 9/32 |
| C. elegans Dataset7 | −0.2353 | 0/32 | unavailable | unavailable | unavailable |

For DREAM4 knockout, the null means are 0.0595 for B and 0.0228 for full geometry,
compared with the original 0.1689 and 0.2456. The original incremental gain
exceeds 31 indexed null gains, while one null gain is larger. This is a limited
indication that the result depends on edge placement beyond the preserved
degrees/components; it is not a significance test or a general geometry claim.
Knockdown null means are 0.0010 for B and −0.0142 for full geometry. Its original
negative result remains negative and does not reproduce the knockout pattern.
The 32 indices reuse the same 450 target rows per contrast; they add no
independent biological observations.

C. elegans retains all original 9 groups and 60 target pairs as required.
URADL accepts only **67–114 of the required 180 switches** within 4,096 proposals
at every index, making all 32 matched comparisons unavailable. ASGL also misses
its target at 10 indices. These are limitations of this fixed null procedure;
there is no estimated C. elegans null effect and no revision of D5's negative
primary result. All 160 DREAM4 and 677 successfully sampled anatomical graphs
receive geometry. The 251 unavailable anatomical combinations remain visible.

Repeated graphs matter here: 33 successfully sampled anatomical combinations
return the original graph. SIBDL alone completes 26 indices and returns its
original graph at every one; it fails the acceptance target at the other six.
ASJR, SIADR, SIAVR, SIBDR, SIBVL and SIBVR accept no switches at any index.
These observations reinforce that the bounded sampler does not establish
uniform mixing. Successful but repeated graphs retain full multiplicity.

The complete [machine report](results.json) retains each index, scope coverage,
all six group-level ablations, tuning candidates, secondary metric summaries,
paired comparisons and original-study references. The local journals retain
individual intervention metrics, fitted models, predictions and exact geometry
certificates. Aggregate ranges describe the indexed variants; they are not
confidence intervals or calibrated p-values. No cross-dataset score is formed.

## Verification and reproduction

```sh
# Offline source/report bindings, arithmetic, independent sampler and controls.
npm run structural-geometry:robustness:check

# Explicit full run: all 32 indices, fresh geometry/fits and independent checks.
npm run structural-geometry:robustness:build

# Repeat the full run and compare every semantic report byte.
npm run structural-geometry:robustness:replay

# Explicitly verify one complete index; this is not a full 32-index replay.
node cases/structural-geometry/robustness/build.mjs --verify-index 0
```

Full runs require the ignored, hash-bound D4/D5 `cache/details.json` inputs.
Reproduce them using the primary studies' replay commands after the
[D2 source preparation](../datasets/README.md). D6 does not reinterpret raw
fluorescence or change upstream preprocessing. Source and implementation
bindings are checked before scoring and before publishing the report.

The independent Python implementation uses edge sets and union-find to reproduce
every SHA256 proposal, acceptance decision, component constraint and final graph.
The separate D5 Bellman-Ford/Fraction descriptor reference and D4 joint-intercept
Gaussian ridge solver check every completed null's descriptors and all nested
predictions. Each joined target is compared with the verified original target
row. Numerical fit comparisons use `2e-10 * max(1, abs(reference))`; evaluation
uses exact stored binary64 ranks and ties. Separate code is not external review.

`cache/null-00.json` through `cache/null-31.json` retain the complete per-index
journals, including unavailability. Their hashes bind the report. The committed
report contains graph hashes and summaries, not the native anatomical edge
tables or fluorescence. Offline checks validate bindings and arithmetic;
authenticating every source graph, target and numerical outcome requires replay
with the local dependency inputs. [Costs](costs.json) are separate from semantic
identity and distinguish sampling, geometry, fitting, prediction and independent
verification. Solver subprocess memory is not claimed as measured.

## D6.2: adult anatomy sensitivity

The [versioned profile](anatomy/profile.json) and [source-only audit](anatomy/source-audit.json)
were specified after D4/D5/D6.1 results were known, before Dataset8 predictive
scoring. This is a secondary sensitivity study, not blinded preregistration.
Dataset8 applies the unchanged D3 rules to its own complete eligible population.
Dataset7 remains the primary anatomy. Its native-population score is context;
subtracting scores on different populations is not a paired anatomy comparison.

A second comparison intersects native eligible source/receiver pairs, verifies
identical trial lineage and recording aggregates, reapplies the three-receiver
and nonconstant-target requirements, and reranks the retained receivers. All
six ablations are refit on each anatomy using those same targets, provided at
least five source groups survive and the entire prepared geometry passes. All union pairs, excluded groups and failed
computations remain visible. Reported differences use Dataset8 minus Dataset7
for baseline, full model and full-minus-baseline gain, with descriptive source
vectors and leave-one-source-out ranges. No animal identities are pooled and no
missing geometry is replaced by zeros. The same processed functional recordings
are reused, so the two anatomies are not independent functional replications.

```sh
npm run structural-geometry:anatomy:check
npm run structural-geometry:anatomy:build
npm run structural-geometry:anatomy:replay
```

The build needs the locked D2 cache, Randi archive and D5 local replay details.
The ordinary check uses stored artifacts and synthetic controls; explicit
replay recomputes Dataset8 geometry, extracts source windows again, refits every
eligible model and requires identical scientific content and local artifact hashes.
The [runtime compatibility policy](../../../docs/DEVELOPMENT.md#frozen-inputs-and-deliberate-regeneration)
only permits explicitly pinned implementation metadata differences. Dataset7 geometry
is reused from the authenticated D5 artifact. Independent Python routines verify
native selection, source samples, aggregation, overlap/reranking, both anatomies'
pair coordinates and every eligible nested fit. Runtime and memory measurements
are separate from deterministic report bytes.


### Dataset8 outcome

The [report](anatomy/results.json) retains every study with its actual status.

| Population / computation | Dataset7 primary | Dataset8 sensitivity |
|---|---:|---:|
| Anatomical roots | 180 | 180 |
| Common prepared scopes | 29 | 32 |
| Eligible native stimulus events | 198 | 90 |
| Requested receiver windows | 640 | 243 |
| Measured trial contrasts | 628 | 238 |
| Eligible source groups / pairs | 9 / 60 | 8 / 37 |
| Complete geometry scopes | 29 | 31 |
| Biological predictive evaluation | Complete | Unavailable |

The Dataset8 groups are ALA (4 receivers), ASGR (3), ASJL (4), IL2DR (7),
IL2VL (4), URADL (6), URADR (5) and URAVL (4). All 3,266 anatomical candidate
positions remain accounted for; five requested contrasts fail the positive
baseline rule and 508 additional trial positions have no accepted receiver
column. No missing observation becomes an observed zero.

ALML, a 12-node / 32-edge context scope, exceeds the flow policy's **256-digit
rational bound** (`STRUCTURAL_FLOW_NUMERIC_LIMIT`). Initial size/preparation
eligibility does not guarantee that every subsequent exact flow state fits.
The D5 complete prepared-scope gate also requires context roots that contribute
no eligible response group. Consequently ALML blocks the Dataset8 native score
even though the 37 eligible target pairs have computed features. This is an
explicit conservative gate, not evidence that those pairs have no geometry.
The other 31 scopes complete: 3 reach an actual fixed point, 28 stop at the
four-iteration limit. No artificial terminal state replaces ALML's refusal.

The native eligible populations contain **79 union pairs and 18 shared pairs**.
The common groups are ASJL (3 receivers), IL2DR (6), URADL (5) and URADR (4).
Trial lineage agrees and shared ranks are recomputed, but **four groups are
below the fixed five-group threshold**. Thus neither anatomy has a matched
predictive score. Dataset8 additionally fails the complete geometry gate; both
reasons are visible through the separate population and computation ledgers.
There is no estimated zero effect, gain comparison, confidence interval or
significance claim for this unavailable study.

Independent verification checks 5,808 native events, 29,160 selected source
samples, target aggregation, the full overlap ledger and 4,630 successful pair
descriptors (2,056 reused Dataset7 plus 2,574 Dataset8). **Zero biological fits
and predictions** were performed for the unavailable studies. A synthetic
five-group Dataset8 control separately checks all six ablations against
independent ridge calculations: 330 distinct fits and 2,520 predictions,
including rejection of a changed prediction. [Measured costs](anatomy/costs.json)
disclose this actual workload. Full replay reproduces the failed ALML attempt,
all successful scopes, source extraction and complete scientific report content.

## D6.3: graph features and capacity controls

The [versioned profile](capacity/profile.json) specifies feature formulas, models,
populations and comparisons before its scoring run. The [source audit](capacity/source-audit.json)
binds the already observed D4/D5 populations and graphs. D4, D5, D6.1 and D6.2
were known when this secondary profile was designed; it is not blinded
preregistration. DREAM4 knockout/knockdown each retain all 450 targets and five
networks. Dataset7 retains nine source groups and 60 targets. The 34 original
scopes and all original target magnitudes, ranks and recording/group identities
stay fixed. Dataset8 is outside this capacity study.

B has the original 23 graph coordinates. G has the original 31 Forman, Ollivier
and terminal-flow coordinates. Q adds 15 fixed squares and 16 fixed products of
raw B coordinates, before train-only standardization. S adds 31 graph-only
coordinates: reverse distances and masks, shortest-path counts and distinct edge
unions in both directions, endpoint harmonic accessibility, neighboring degree
means, local reciprocity fractions, longer/reverse walk probabilities and
incoming/outgoing neighbor Jaccard overlap. Graph labels are opaque identifiers;
response values, parent graphs and geometric fields cannot enter Q or S.

| Model | Coordinates | Role |
|---|---:|---|
| B | 23 | Exactly reproduce the primary baseline |
| B+G | 54 | Exactly reproduce the primary full geometry model |
| B+Q | 54 | Fixed nonlinear recoding of the original graph baseline |
| B+S | 54 | Expanded graph context |
| B+Q+G | 85 | Geometry conditioned on nonlinear recoding |
| B+S+G | 85 | Geometry conditioned on expanded graph context |

The main comparison **within this secondary study** is B+S+G minus B+S;
B+Q+G minus B+Q and all other specified comparisons remain visible. No winner
among Q and S is selected after inspection. All models retain the D3 balanced
weighted ridge objective, five penalties, nested whole-group holdouts, exact
rank ties and train-only standardization. Equal coordinate count and tuning
budget do not establish equal statistical capacity. Each outer fold exposes its
constant columns and nonconstant-column count; this is neither matrix rank nor
effective degrees of freedom. Neither control is assumed to outperform B.

### Capacity results

D6.3 is complete. The [report](capacity/results.json) retains all six models,
eight declared comparisons and every group, with no population loss. B and B+G
exactly reproduce their respective D4/D5 reports. Higher rank skill is better:

| Model | DREAM4 knockout | DREAM4 knockdown | C. elegans Dataset7 |
|---|---:|---:|---:|
| B | 0.1689 | 0.0200 | 0.2852 |
| B+G | 0.2456 | −0.0233 | 0.0499 |
| B+Q | 0.1444 | 0.0644 | 0.2766 |
| B+S | 0.1689 | −0.0578 | 0.3942 |
| B+Q+G | 0.2178 | −0.0167 | 0.2997 |
| B+S+G | 0.1878 | −0.0489 | 0.2784 |

The specified conditional geometry comparison is B+S+G minus B+S:

| Study | Mean difference | Improving / tied / worsening groups | Leave-one-group-out mean range |
|---|---:|---:|---:|
| DREAM4 knockout | +0.0189 | 3 / 0 / 2 | +0.0014 to +0.0389 |
| DREAM4 knockdown | +0.0089 | 3 / 0 / 2 | −0.0111 to +0.0486 |
| C. elegans Dataset7 | −0.1158 | 0 / 4 / 5 | −0.1302 to −0.0766 |

S raises Dataset7's graph-only score from 0.2852 to 0.3942; adding geometry
lowers it to 0.2784. On knockouts S ties B exactly, while the conditional
geometry gain is smaller than the original +0.0767. On knockdowns the positive
conditional difference leaves both B+S and B+S+G below zero and below B and B+Q.
Q is the better graph-only control on knockdowns, but it is not selected as a
replacement primary comparison. Geometry over Q yields +0.0733, −0.0811 and
+0.0231 respectively; Dataset7's latter difference has a leave-one-group-out
range spanning zero. All outcomes remain specific to these fixed populations
and learners; they do not establish a generally useful geometric advantage.

Numerical reporting includes an exact aggregation audit: integer concordance
counts determine each intervention's rational rank skill, averaged equally
within each group and then across groups. Exact group and aggregate differences
determine the gain interpretation. D3 binary64 means and descriptive ranges
remain available for compatibility; their summation tails are not evidence of
gain. In particular, knockout B+S minus B is exactly zero. This numerical audit
is part of implementation review, not a claim of blinded preregistration;
prediction ties still use exact binary64 equality with no tolerance.

Training nonconstant-column counts are 21/46/51/52/76/77 for DREAM4's
B/B+G/B+Q/B+S/B+Q+G/B+S+G. Dataset7 has 22/47–50/53/53/78–81/78–81.
Thus even equal-width models do not have equal numbers of varying columns;
these counts also do not measure matrix rank or effective degrees of freedom.

```sh
npm run structural-geometry:capacity:check
npm run structural-geometry:capacity:build
npm run structural-geometry:capacity:replay
```

The build/replay uses authenticated D4/D5 local details. It recomputes Q and S
and all nested models, requires exact reproduction of the original B and B+G
results, and retains outer predictions in the report. Independent Python checks
use Floyd–Warshall distances, predecessor path counting/backtracking, Fraction
matrix walks and the independent joint-intercept ridge solver. It checks 2,506
scoped pair descriptors, 77,686 exact S coordinates, 1,794 distinct reference
fits, 128,160 predictions and all 24 exact aggregate comparisons. The runtime
performs 3,474 nested fits; the reference caches symmetric inner training sets.
Synthetic checks cover all 64 three-node directed graphs, branching paths,
cycles, sinks, held-out leakage and altered reports. Full replay
requires identical scientific content and local artifact hashes. Normal checks verify stored source
bindings, prediction-derived metrics, tuning arithmetic and synthetic controls;
source graph/features and every fitted model require the explicit replay.
Any required computation failure aborts before replacing a stored report.
[Costs](capacity/costs.json) separate new feature/model work from reused source
extraction and geometry solving. The raw local journal is ignored by Git.

## D6.4: transport metric, idleness and initialization

The [versioned profile](metric/profile.json) and [source-only audit](metric/source-audit.json)
fix this secondary study after D6.3 was inspected and before its predictive
scoring. The same 34 scoped graphs, 450/450/60 targets and 5/5/9 groups remain.
Dataset8 and its unavailable comparisons are unchanged. This design does not
claim blinded preregistration, new biological samples or a parameter search.

| Variant | Static transport metric | Idleness | Initial flow lengths |
|---|---|---:|---|
| `unit-half` | Unit | ½ | Unit; reference reproduction |
| `unit-zero` | Unit | 0 | Unit |
| `inverse-share-half` | Inverse target share | ½ | Provider lengths |
| `outdegree-initial` | Unit | ½ | 1 + scoped out-degree of the source endpoint |
| `double-unit-initial` | Unit | ½ | 2 on every edge; scale-invariance control |

All carrier edges explicitly receive unit analysis mass. These masses are
synthetic declarations, not measured synaptic strengths or gene-regulation
weights. On this carrier, `inverse-target-share-v1` assigns each edge its target's
scoped in-degree. Its full normalization context is the existing selected graph,
not the parent anatomy. No functional response, label meaning or native weight
is introduced into the metric. Filtrations and typed selections do not supply
lengths and are outside this comparison.

Each geometry receipt belongs to `biological-metric-sensitivity-v1:pair-geometry`;
its separate `coordinateLayoutId` links the unchanged D3 coordinate order and
does not label a sensitivity result as the original unit-profile calculation.
The 31-coordinate pair layout retains **unit Forman**. Static Ollivier curvature
uses the declared provider lengths after exact shortest-endpoint closure and
mean-one normalization; the same idleness applies to static transport and flow.
Endpoint edge sets and the shortest-path edge union retain D3's unit-hop
membership. The additional terminal flow distance uses the evolved lengths.
The two initialization controls preserve unit static Ollivier while changing
the flow's starting lengths. This is transport-metric sensitivity, not weighted
Forman or an interval-to-scalar conversion. The D3 half step, four-iteration cap,
two stable steps, tolerance 1/1,000,000 and no-cut rule remain. Termination at the
cap is not convergence. Only idleness 0 and ½ are supported by this API; this
one-factor design does not test their interactions with the other settings.

Each available variant refits B+G and B+S+G with the same train-only transforms,
five penalties and nested grouped splits. Authenticated D6.3 B and B+S fits are
reused because their inputs are identical. The main within-study comparison is
B+S+G minus B+S; B+G minus B and each model's difference from the unit reference
are also retained. Exact rational group differences determine their signs.
No setting is chosen as a new primary after scoring, and no cross-dataset score
or calibrated significance is computed. Q is outside this sensitivity profile.

Every original prepared scope is mandatory for its domain, including Dataset7
roots with no eligible response group. A declared flow limit leaves that whole
variant/domain unavailable with null models and comparisons. Every attempted
scope and the other variants remain visible. Unexpected integrity errors and
model failures abort report generation; no partial population is fitted.
The unit reference must reproduce D6.3's exact pair geometry, model summaries,
predictions and training-column counts. The scale control must reproduce the
same normalized geometry and predictions; raw normalization factors and request
hashes still identify the different inputs.

### Metric sensitivity results

D6.4 is complete. All **170** variant/scope combinations and all **15** separate
variant/study evaluations are available; no target, source group or prepared
scope was removed. The independent reference verifies **787** flow states,
**12,530** scoped pair descriptors, **2,990** distinct ridge fits, **213,600**
predictions and **60** exact comparisons. The runtime performs 5,790 nested fits;
the reference caches identical inner training sets. These repeat the same
original biological populations, not additional independent observations.

Mean geometry gain over the expanded graph baseline, **B+S+G minus B+S**:

| Variant | DREAM4 knockout | DREAM4 knockdown | Dataset7 |
|---|---:|---:|---:|
| `unit-half` | +0.0189 | +0.0089 | −0.1158 |
| `unit-zero` | +0.0356 | +0.0167 | −0.2513 |
| `inverse-share-half` | +0.0489 | +0.0378 | −0.1148 |
| `outdegree-initial` | +0.0311 | +0.0189 | −0.1337 |
| `double-unit-initial` | +0.0189 | +0.0089 | −0.1158 |

The unchanged B+S absolute scores are 0.1689 / −0.0578 / 0.3942. All knockout
conditional gains and their leave-one-group-out means remain positive in this
declared panel, with heterogeneous individual networks. All Dataset7 conditional
gains and leave-one-group-out means remain negative. Its B+S+G scores range
from 0.1429 to 0.2794, below the fixed expanded baseline's 0.3942.
Every knockdown B+S+G absolute score remains negative (−0.0489 to −0.0200),
despite positive conditional differences. Only the inverse-share knockdown
conditional difference has all leave-one-group-out means above zero in this
panel; the other ranges span zero. These ranges are descriptive, not confidence
intervals or calibrated significance.

Mean geometry gain over the original graph baseline, **B+G minus B**:

| Variant | DREAM4 knockout | DREAM4 knockdown | Dataset7 |
|---|---:|---:|---:|
| `unit-half` | +0.0767 | −0.0433 | −0.2353 |
| `unit-zero` | +0.0033 | −0.0278 | −0.1345 |
| `inverse-share-half` | +0.0533 | +0.0356 | −0.1585 |
| `outdegree-initial` | +0.0789 | −0.0478 | −0.1642 |
| `double-unit-initial` | +0.0767 | −0.0433 | −0.2353 |

For knockdowns, changing the provider reverses this secondary comparison's sign:
inverse-share B+G reaches 0.0556 versus B at 0.0200. This illustrates parameter
and baseline dependence; it does not replace the frozen negative primary result.
Dataset7 remains worse than both respective graph-only baselines under every
tested setting. Knockout's original-baseline gain nearly disappears at zero
idleness (+0.0033, with a leave-one-group-out range spanning zero).

Idleness changes 2,202 of the 2,506 exact pair descriptors. The provider and
shape-initialization variants each change 2,446; these counts measure changed
coordinates, not prediction improvement. Shape-only initialization changes no
static Ollivier fields. Uniform doubling changes none of the normalized pair
descriptors and reproduces the reference models and predictions exactly. All
group vectors, model-to-reference differences, termination reasons and training
column counts remain in the report. None of the variants is selected as a new
default, and no result is extrapolated beyond the tested settings and samples.

### Metric verification and reproduction

Normal offline checks use committed independent chain, diamond and branching-cycle
controls for all five variants, verify those controls' runtime certificates and source bindings,
recompute prediction-derived report metrics and test the separate ridge reference:

```sh
npm run structural-geometry:metric-sensitivity:check
```

Full generation/replay requires authenticated D6.3 `cache/details.json` and
the pinned NetworkX reference environment. The D6.3 replay above recreates its
local input after the D4/D5 prerequisites. For a separate reference environment:

```sh
python3 -m venv /tmp/onto2d-metric-reference
/tmp/onto2d-metric-reference/bin/python -m pip install -r cases/structural-geometry/flow/requirements-reference.txt
export ONTO2D_METRIC_REFERENCE_PYTHON=/tmp/onto2d-metric-reference/bin/python
npm run structural-geometry:metric-sensitivity:controls
npm run structural-geometry:metric-sensitivity:build
npm run structural-geometry:metric-sensitivity:replay
```

On Windows, use the environment's `Scripts/python.exe` and set the same variable
with the shell's environment syntax. Python defaults to `python3` if the variable
is absent. Full replay checks NetworkX 3.2.1 and the pinned network-simplex source
hash. The independent wrapper recomputes successful trajectories using Dijkstra
distances and integer-scaled transport, static curvatures, Bellman–Ford pair
descriptors, joins, nested joint-intercept ridge fits and exact comparisons.
It retains failed flow attempts and their input definitions, but does not claim
to independently certify the runtime's digit-limit failure. Runtime replay
repeats those failures and requires identical scientific content and local
artifact hashes. Explicitly pinned runtime portability replacements are described
in the [development guide](../../../docs/DEVELOPMENT.md#frozen-inputs-and-deliberate-regeneration);
the original reports and their implementation hashes remain intact.

[Results](metric/results.json) retain every variant; [costs](metric/costs.json)
separate new geometry/fitting/inference work from reused source extraction,
targets, B/S features and baseline fitting. Node phase-end and cumulative peaks
and independent Python peaks are measured; runtime solver subprocess peaks are
not measured. Full local variant journals are ignored by Git.

## D6.5 scope selection and low-degree coverage

D6.5 is complete. The [profile](scope/profile.json) fixes four topology-only
induced neighborhoods before comparative fitting: closed weak one-hop reference,
incoming one-hop, outgoing one-hop and weak two-hop. All 180 roots in each of
Dataset7 and Dataset8 are retained, giving **1,440 selections**. Nodes and edges
are never truncated. Each selection records its parent, selected/excluded nodes,
selected/omitted/boundary edge indices and unchanged D2 provider preparation.
The [source-only audit](scope/source-audit.json) precedes model scoring. Earlier
D4–D6.4 results and a source degree census had been inspected; this is not blinded
preregistration.

### Coverage and its limits

Degree means the number of **distinct neighbors in the parent chemical graph**,
combining incoming and outgoing adjacency. A reciprocal pair counts once;
directed in/out degrees are also retained. Fixed bins are 0, 1–2, 3–5, 6–10,
11–20 and 21+. Low degree means at most five neighbors, including isolated nodes.
Neither anatomy has a degree-0/1/2 node in its declared 180-node universe; the
report does not infer coverage of neurons outside that source universe.

| Neighborhood | Dataset7 prepared roots / represented nodes | Dataset8 prepared roots / represented nodes |
|---|---:|---:|
| Weak one-hop | 29 / 144 | 32 / 138 |
| Incoming one-hop | 104 / 164 | 105 / 163 |
| Outgoing one-hop | 70 / 156 | 64 / 156 |
| Weak two-hop | 0 / 0 | 0 / 0 |

Every denominator is 180. A represented node belongs to at least one prepared
scope; it need not have a prepared scope rooted at itself. Preparation does not
certify successful flow execution or measured response availability. The larger
incoming preparation population is not an independently evaluated expanded
functional population. All two-hop scopes fail the unchanged preparation bounds.

| Low-degree stage | Dataset7 | Dataset8 |
|---|---:|---:|
| Parent nodes with degree ≤5 | 5 | 7 |
| Exact-label mapped in any recording | 5 | 6 |
| Stimulated with an uncontaminated time window, before scope gating | 3 | 3 |
| Prepared weak one-hop root | 5 | 7 |
| Eligible response source / receiver identities | 0 / 0 | 1 / 1 |
| Eligible pairs by low-degree source / receiver | 0 / 0 | 3 / 1 |

Dataset7's five nodes are ASJR, PLNR, SIADR, SIBDR and SIBVL. All their original
root scopes prepare; none has a receiver pair with the required two measured
recordings. Consequently **none of the 60 primary pairs contains a low-degree
source or receiver**. The primary score provides no predictive evidence for this
stratum. A preparation filter did not remove these five roots; measurement and
repeat-recording coverage prevent their evaluation under the existing rules.
Conversely, all 68 Dataset7 nodes with degree ≥21 fail the original rooted-scope
preparation gate, even though 51 occur inside other prepared scopes and 14 appear
as primary receivers. Source and receiver coverage are different populations.

Dataset8 counts above describe candidate response eligibility only. ASGR supplies
three candidate source pairs; ASJR appears in one candidate receiver pair. D6.2
remains unavailable because of ALML, and one low-degree source group cannot
establish a separate predictive result. Missing observations are never scored
as zero. DREAM4 is a full-network coverage control: all 50 network-local genes
are retained, including 48 with degree ≤5; every gene has nine off-target source
and nine receiver rows in each separate contrast. This coverage count is not a
new degree-stratified DREAM4 performance estimate.

### Matched scope comparison

Each Dataset7 alternative is intersected with the original 60 eligible pairs.
The audit keeps every pair's retention/exclusion and every group's eligibility.
At least three common receivers and two distinct magnitudes are required per
source, then at least five source groups. Magnitudes and recording identities
remain fixed; ranks are explicitly recomputed inside each new matched population.
No new native responses are extracted and no missing receiver is substituted.

| Neighborhood | Matched eligible pairs / groups | Comparison |
|---|---:|---|
| Weak one-hop reference | 60 / 9 | Complete; exactly reproduces D6.3 |
| Incoming one-hop | 35 / 6 | Complete; both contexts refitted on identical rows |
| Outgoing one-hop | 21 / 4 | Unavailable: fewer than five groups |
| Weak two-hop | 0 / 0 | Unavailable: no prepared common groups |

The incoming groups are AFDL, ASGL, ASJL, IL1DR, RMEL and SAAVL. Each available
comparison freshly fits B23, B+G54, B+S54 and B+S+G85 in **both** contexts using
the unchanged nested whole-source ridge procedure. B/S/G are computed on each
declared graph; reference features/geometry reuse authenticated D6.3 evidence.
The unit-half D6.4 geometry wrapper supplies unchanged unit Forman, static
Ollivier and terminal flow coordinates with a four-iteration cap, retaining its correct profile
and coordinate-layout metadata. Q occupies its existing basis positions but is
not fitted in D6.5.

Only target-bearing roots in each declared matched population require fresh
geometry here: all nine reference and six incoming roots complete. Other roots
remain preparation-only evidence. A declared failure of any required scope
invalidates the whole comparison; unexpected errors abort generation. This is
an explicit secondary target-bearing gate, not a change to D5/D6.2's complete
prepared-scope requirement. Dataset8 is not rescored.

| Model / gain | Original 60 pairs, weak context | Common 35 pairs, weak context | Common 35 pairs, incoming context |
|---|---:|---:|---:|
| B | 0.2852 | 0.2590 | 0.2594 |
| B+G | 0.0499 | 0.1363 | 0.3316 |
| B+S | 0.3942 | 0.1030 | 0.2581 |
| B+S+G | 0.2784 | 0.1927 | 0.2120 |
| G gain over B | −0.2353 | −0.1226 | +0.0722 |
| G gain over B+S | −0.1158 | +0.0897 | −0.0462 |

These results demonstrate **population, scope and baseline dependence**. The
weak-context expanded gain changes sign when the target population and its
training splits change from 60 to 35 pairs. On those same 35 pairs, incoming
geometry helps B but lowers B+S. Incoming-minus-weak differences are +0.0004,
+0.1953, +0.1551 and +0.0192 for B, B+G, B+S and B+S+G respectively. These
descriptive comparisons do not identify a universally preferable scope, and
different intersections must not be ranked as one population. Every exact
group contrast and leave-one-group-out range is retained; ranges are not
confidence intervals. No outcome becomes a replacement primary or default.

### Verification and reproduction

Independent Python reconstructs all 1,440 selections and boundaries, degree bins,
metadata observation counts and matched populations. Metadata and response
values reuse the authenticated source extraction from D5/D6.2. Pinned NetworkX
replays every new successful trajectory; separate Fraction graph features and
joint-intercept ridge verify joins, predictions and exact contrasts. This checks
**69 flow states, 1,316 pair descriptors, 40,796 expanded coordinates, 2,160
distinct reference fits, 26,960 predictions and 16 exact comparisons**. The
weak reference reproduces D6.3 geometry and all four model reports/predictions.
Full replay requires identical scientific content and local artifact hashes.

```sh
npm run structural-geometry:scope-coverage:check
ONTO2D_SCOPE_REFERENCE_PYTHON=/path/to/ollivier-venv/bin/python \
  npm run structural-geometry:scope-coverage:build
ONTO2D_SCOPE_REFERENCE_PYTHON=/path/to/ollivier-venv/bin/python \
  npm run structural-geometry:scope-coverage:replay
```

Use the same pinned NetworkX 3.2.1 environment described for D6.4. Normal checks
need only Python's standard library and committed reports; full replay requires
the D4/D5/D6.2/D6.3 local journals. The [results](scope/results.json) bind the
profile, implementation, source-only audit and upstream evidence. [Costs](scope/costs.json)
separate census/preparation, geometry, fitting, inference and independent checks
from reused extraction/reference features. Node RSS and reference Python peak
are measured; runtime solver subprocess peaks are not. Local journals are ignored
by Git. Tests include isolated/oversized scopes, reciprocal-degree counting,
boundaries, matched ties, insufficient groups, whole-comparison failure and
tampered coverage/prediction/verification evidence.

## Delivery boundary

D6.1–D6.5 are complete, including unavailable comparisons, mixed capacity results,
parameter dependence and missing low-degree evidence. **D7 is implemented locally:**
the [Structural Geometry Lab](../../../apps/structural-geometry-lab/README.md)
presents these verified findings, populations and limits. It does not retrain
biological models in the browser or imply an external publication decision.
A separately declared arithmetic-budget or expanded native-target sensitivity
may revisit Dataset8 or newly prepared incoming roots later; neither is required
to display the current evidence. It cannot silently replace a failed profile,
supply absent recordings or solve the lack of a fifth shared anatomical group.
