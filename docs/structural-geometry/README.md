# Structural Geometry

Structural Geometry studies what directed graph structure and its transformations
can tell us about distinguishability and response. The implemented methods are
verified computational tools. Their added empirical usefulness remains open.

The active research program uses **DREAM4** and **C. elegans** with independent
perturbation-response targets. See the [research plan](RESEARCH.md) for source
roles, applicability, evaluation and delivery gates.

| Read about | Guide |
|---|---|
| Representation, Forman/Ollivier and MetricProvider contracts | [Geometry](GEOMETRY.md) |
| Regimes, canonical/topological/typed observations and comparison | [Observations](OBSERVATIONS.md) |
| Sandbox, invariance/response probes, signatures and pseudometric | [Signatures](SIGNATURES.md) |
| Exact normalized lengths, stopping and cut events | [Shadow flow](SHADOW_FLOW.md) |
| Measured evidence, controls, interpretation and verification | [Evidence](EVIDENCE.md) |
| DREAM4 / C. elegans native adapters, census and applicability | [Source guide](../../cases/structural-geometry/datasets/README.md) |
| Fixed biological targets, features, learner and evaluation | [D3 protocol](../../cases/structural-geometry/protocol/PROTOCOL.md) |
| Five-network ablations, outcomes, costs and replay | [DREAM4 pilot](../../cases/structural-geometry/dream4/README.md) |
| Processed functional responses, exclusions and held-out-source results | [C. elegans study](../../cases/structural-geometry/celegans/README.md) |
| Graph nulls, adult-anatomy sensitivity, graph-feature/capacity controls and remaining studies | [Biological robustness](../../cases/structural-geometry/robustness/README.md) |
| Interactive laboratory, biological results and browser verification | [Structural Geometry Lab](../../apps/structural-geometry-lab/README.md) |
| Research boundaries and follow-up decisions | [Research plan](RESEARCH.md) |

## Current boundary

The bounded provider, observation, probe, comparison, signature and flow contracts
are implemented. The synthetic added-value study found **zero new splits on
210 eligible pairs**. Joint degrees already distinguish the entire generated
panel, and missing mandatory responses exclude 286 other pairs. This is a
limited result of that sample, not a verdict on biology or geometry in general.

```sh
npm run structural-geometry:check
npm run structural-geometry:added-value:check
npm run structural-geometry:added-value:report
```

Native adapters account for all five DREAM4 networks, 113 functional recordings
and eight anatomical graphs. A versioned availability profile, exact-label mapping
candidates and exhaustive bounded chemical scopes are implemented. D3 fixes the
scientific protocol and implements target/population checks, rank metrics, graph
baselines, grouped ridge helpers and processed-signal window/aggregation helpers.
The protocol and independent references are bound by its
[freeze manifest](../../cases/structural-geometry/protocol/frozen.json).

D4 is complete: verified geometry and all six nested ablations retain 450 targets
per contrast on the five DREAM4 networks. Full-minus-baseline mean rank skill is
**+0.0767 for knockouts** and **−0.0433 for knockdowns**. Independent calculations
verify descriptors and model predictions; the mixed result has the limits of
this fixed representation, learner and small panel.

D5 is complete: 9 C. elegans source groups and 60 pairs meet the fixed response
rules. Full geometry decreases mean rank skill from **0.2852 to 0.0499**;
all six ablations, native exclusions and independent verification are retained.
The target is an adapted contrast of processed exported fluorescence; the original acquisition
missingness mask and source-paper quality flags are absent. It cannot certify
successful stimulation or reproduce the paper's q-values.

D6.1 is complete: all 32 constrained-null indices are retained. DREAM4 knockout's
original gain exceeds 31 null gains; this is descriptive, not a significance
claim. C. elegans has no available matched null comparison under the fixed
switch budget. D6.2 is also complete with disclosed unavailability: Dataset8's
ALML scope exceeds the flow arithmetic bound, and the shared-anatomy population
has only 4 groups / 18 pairs instead of the required five groups. No predictive
score is supplied for that comparison. D6.3 graph-feature/capacity controls are
complete: geometry over the expanded graph baseline changes rank skill by
+0.0189 / +0.0089 / −0.1158 for knockout / knockdown / Dataset7. The compared
knockdown scores both remain negative; no universal benefit is established.
D6.4 covers five declared metric/idleness/initialization variants without losing
scope or target coverage. Dataset7 remains below both graph baselines; DREAM4
knockdown's original-baseline gain changes sign with the provider. The uniform
scale control preserves geometry and predictions exactly. D6.5 also verifies
all 1,440 scope selections and parent-degree coverage: Dataset7 has no eligible
low-degree pairs. Its matched incoming-scope comparison changes signs with the
population and baseline, while outgoing/two-hop comparisons remain unavailable.
D7 is implemented locally: the homepage presents the connected research map,
and the [Structural Geometry Lab](../../apps/structural-geometry-lab/index.html)
separates compact instrument controls, four interactive views and the frozen
biological evidence. Regime selection changes observations and response probes;
geometric metric parameters remain explicit and fixed. Browser replay verifies
small graph certificates and recalculates stored score summaries; it does not
retrain biological models. Existing graph probes are deterministic structural
edits, not simulations of gene knockouts or stimulation. External review, deployment
and the first project release remain separate steps.

Geometry is opt-in and separate from kernel semantics. Source identities and
relations remain immutable; analysis lengths, policies, scopes and artifacts
have their own identities. Passing numerical checks does not certify a causal
interpretation or a useful biological prediction.
