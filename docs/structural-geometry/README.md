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
| DREAM4 / C. elegans sources and local acquisition | [Source guide](../../cases/structural-geometry/datasets/README.md) |
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

The next implementation gate is native dataset/scoped-provider applicability and
a task-specific response profile. Biological adapters, scoring, robustness
experiments and the result-bearing geometry page remain open. Existing graph
probes are deterministic structural edits, not simulations of gene knockouts or
neural stimulation.

Geometry is opt-in and separate from kernel semantics. Source identities and
relations remain immutable; analysis lengths, policies, scopes and artifacts
have their own identities. Passing numerical checks does not certify a causal
interpretation or a useful biological prediction.
