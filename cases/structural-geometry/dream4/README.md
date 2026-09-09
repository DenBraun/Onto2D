# DREAM4 geometric response-ranking pilot

D4 implements the [frozen D3 protocol](../protocol/PROTOCOL.md) on all five
DREAM4 Size10 networks. The primary knockout comparison improves mean rank
skill by **0.0767**; the separately fitted secondary knockdown comparison
decreases it by **0.0433**. These are limited results of a fixed representation,
learner and five-network panel. They do not establish statistical significance,
a biological mechanism or general usefulness of geometry.
The expression responses are simulated DREAM4 challenge data, not measurements
from five living organisms.

## Results

Each contrast retains 50 interventions and 450 off-target observations, with no
exclusions. An entire network is held out from fitting and tuning; the four
training networks supply inner leave-one-network-out validation. Knockout and
knockdown models are fitted and tuned separately. The two contrasts share the
same five networks and are not ten independent replications.

`B` contains the 23 frozen graph features; `F` adds six Forman coordinates,
`O` adds six Ollivier coordinates and `flow` adds 19 terminal-flow coordinates.
Every ablation uses the same graph and eligible population. The full model has
54 coordinates. Propagation is the separate fixed four-step propagation score.

Rank skill compares the predicted order of response magnitudes within each
intervention: 1 means every unequal observed pair is ordered correctly, −1 means
every order is reversed, and a constant prediction scores 0. Observed ties are
excluded from its pair denominator; prediction ties contribute zero. The score
is averaged over ten interventions per network and then equally over networks.
It is neither classification accuracy nor a percentage of explained variance.

| Predictor | Knockout, primary | Knockdown, secondary |
|---|---:|---:|
| B | 0.1689 | 0.0200 |
| B+F | 0.1833 | −0.0067 |
| B+O | 0.2122 | −0.0056 |
| B+flow | 0.2344 | 0.0133 |
| B+F+O | 0.2106 | −0.0328 |
| B+F+O+flow | 0.2456 | −0.0233 |
| Propagation | 0.2006 | 0.0806 |

The prespecified comparison is full minus B, not whichever predictor performs
best after looking at outcomes. The full model exceeds B on all five knockout
networks; it exceeds B on two knockdown networks and loses on three. Propagation
exceeds both B and the full model on the secondary contrast.

| Held-out network | Knockout B | Knockout full | Difference | Knockdown B | Knockdown full | Difference |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 0.2889 | 0.4278 | +0.1389 | 0.0722 | −0.0667 | −0.1389 |
| 2 | 0.0278 | 0.0611 | +0.0333 | 0.0056 | 0.0278 | +0.0222 |
| 3 | 0.1806 | 0.2111 | +0.0306 | −0.0194 | −0.1056 | −0.0861 |
| 4 | 0.2167 | 0.2889 | +0.0722 | 0.0389 | 0.0556 | +0.0167 |
| 5 | 0.1306 | 0.2389 | +0.1083 | 0.0028 | −0.0278 | −0.0306 |

Leaving one network out of the final five-difference average gives ranges
[0.0611, 0.0882] for knockouts and [−0.0597, −0.0194] for knockdowns. These are
descriptive aggregation sensitivities, not confidence intervals or additional
model refits. Training folds overlap. No IID gene-pair test or p-value is reported.

The geometry coordinates are deterministic functions of the same input graph.
An improvement can show a useful representation for this learner; it cannot
establish new information beyond the complete graph. D6 includes stronger graph
and model-capacity controls before a broader interpretation.

The [machine report](results.json) retains every ablation's per-network and
per-intervention metrics, undefined secondary-metric reasons, all five tuning
candidates on their four inner groups, chosen penalties and all declared paired
comparisons. Negative results and constant predictions remain visible.

## Geometry and independent verification

All 71 native directed edges across five complete ten-node networks receive
fresh Forman, Ollivier and flow calculations. Each certificate is verified
against the expected source Model Pack and request, and must match the accepted
D2 evidence. No expression value determines a feature, graph scope or stopping
rule. Graph-edit probe failures do not exclude experimental response targets.

Each exact edge field supplies incoming/outgoing means at both endpoints, the
direct-edge value, and the mean over distinct edges in the union of all unit-hop
shortest source-to-target paths. Structurally empty sets use zero with baseline
masks; missing certificates never become zero. Rational values are aggregated
exactly before a single correctly rounded binary64 conversion.

Flow uses actual terminal normalized lengths and curvatures, weighted directed
distance, iteration and a five-way stopping reason. All five source flows stop
at the four-update limit; no convergence or unobserved continuation is claimed.
Early-stop controls use their actual terminal state. This profile does not alter
GeometricSignature-v1 or the frozen D3 contract.

The independent Python reference uses Fraction arithmetic, path enumeration and
Dijkstra instead of the JS shortest-path implementation. It checks all 450 pair
descriptors, graph baselines and target/feature joins. Joint-intercept pivoted
Gauss-Jordan fits independently check the centered Cholesky learner: 660 distinct
reference fits cover all 1,260 nested fit requests and 113,400 predictions across
both contrasts. Numeric comparisons allow `2e-10 * max(1, abs(reference))`;
evaluation itself uses exact stored binary64 prediction ties without tolerance.
The reference is separate code, not external reviewer approval.

## Reproduction and costs

```sh
# Offline report bindings, arithmetic, mutation and synthetic controls; no corpus needed.
npm run structural-geometry:dream4:check

# Requires the source-bound D2 native/applicability cache.
# Computes fresh geometry, every nested fit and the independent Python reference.
npm run structural-geometry:dream4:replay

# Explicitly regenerate this derived report after reviewing implementation changes.
npm run structural-geometry:dream4:build
```

Missing prepared inputs must first be acquired and prepared through the
[source workflow](../datasets/README.md). Full replay requires every scientific
field and local artifact hash to match. Only explicitly pinned runtime metadata
may differ under the [compatibility policy](../../../docs/DEVELOPMENT.md#frozen-inputs-and-deliberate-regeneration).
A failed computation aborts with an unavailable reason and cannot
replace the accepted report with a partial or zero score. Frozen D3 files are
never regenerated by these commands.

Normal tests/builds verify hashes, report arithmetic and synthetic controls;
they do not refit models or independently authenticate the original dataset
without its cache. The explicit replay does both source binding and computation.
`cache/details.json` retains local inputs, exact descriptors, folds, fitted
transforms and coefficients, and every inner/outer prediction. Its hash is in the
report. Raw expression tables, source graphs and detailed prediction tables
remain local; this stage adds no redistributed source fixture or website payload.
The [source lock](../datasets/source-lock.json) retains upstream terms and provenance.

[Observed costs](costs.json) are separate from semantic identity and bind to the
report hash. They separate loading/hashing prepared inputs, fresh geometry and
certificate verification, target preparation, fitting, inference and the Python
reference. Geometry costs are recorded per network; fit/inference costs per
ablation and held-out network. Node cumulative peak RSS and phase-end RSS samples
are recorded explicitly; these are not isolated phase peaks and do not include
solver subprocess peaks. Raw acquisition and native adaptation costs belong to
D1/D2 and are outside this measurement.

D4 is complete. The separate [D5 study](../celegans/README.md) evaluates C. elegans
functional targets and retains its negative result. [D6 robustness](../robustness/README.md)
includes completed graph-null, adult-anatomy and graph-feature/capacity studies.
Geometry over expanded graph context gives +0.0189 on knockouts and +0.0089
on knockdowns; both compared knockdown scores remain negative. These secondary
comparisons preserve the primary outcomes above. D6.4's five parameter variants
are complete: inverse target share changes knockdown B+G-minus-B from negative
to positive, while all expanded-geometry knockdown absolute scores remain
negative. No variant replaces the primary. D6.5 confirms complete network-local
coverage for all 50 genes, including 48 with parent degree ≤5, while separately
testing C. elegans scope choices. It adds no degree-stratified DREAM4 score.
D7 then publishes a readable page
over reviewed artifacts. A positive result is not a publication gate.
