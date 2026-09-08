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
| Remaining work and website gate | [Research plan](RESEARCH.md) |

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

D4 is next: collect verified pair geometry and run the complete nested DREAM4
evaluation. No comparative biological scores exist yet. The C. elegans target is
an adapted contrast of processed exported fluorescence; the original acquisition
missingness mask and source-paper quality flags are absent. It cannot certify
successful stimulation or reproduce the paper's q-values. Actual functional
response eligibility, robustness experiments and the result-bearing geometry
page remain open. Existing graph probes are deterministic structural edits,
not simulations of gene knockouts or stimulation.

Geometry is opt-in and separate from kernel semantics. Source identities and
relations remain immutable; analysis lengths, policies, scopes and artifacts
have their own identities. Passing numerical checks does not certify a causal
interpretation or a useful biological prediction.
