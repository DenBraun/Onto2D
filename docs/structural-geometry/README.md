# Structural Geometry

Status: legacy stages 0–5, revised R1–R2 and SG2-010/011/012/013 complete; strict comparison and coverage next.
Date: 2026-09-06.

The [operative revised roadmap](REVISED_ROADMAP.md) now controls further work.
Read the [full revision analysis](REVISION_ANALYSIS.md),
[distinguishability/provider design](DISTINGUISHABILITY_DESIGN.md),
[baseline record](BASELINE.md) and [gated website plan](WEBSITE_PLAN.md).
Existing contracts, artifacts, providers and regime preparation below are
implemented. Exact canonical and directed topology observations are also
implemented. Typed observations and explicit vocabulary alignment are also
implemented; probes and final structural comparison remain planned.
Scientific validation is open.
The [cumulative code review](CUMULATIVE_REVIEW.md) covers the complete workstream,
its identifier-contract correction and current verification evidence.

This direction adds a read-only, reproducible analysis above verified Model
Packs. The initial deliverable projects a complete directed `source-parent`
graph, assigns unit vertex/edge weights and edge lengths, and computes directed
Forman curvature. It is descriptive geometry of the chosen representation.

The [original proposal](proposals/ONTO2D_STRUCTURAL_GEOMETRY_ROADMAP.md) is
preserved verbatim from the user-supplied document. Its suggested terminology,
hypotheses and later stages are research input, not automatically accepted
runtime or scientific claims. [ADR 0126](../adr/0126-structural-geometry-foundation.md)
records the adopted boundary and corrections.

Original file SHA-256:
`b6e1e8302efa9d183cf6030751adafb57f81fa854d1d5331a1dfff61951aab11`.

The [new research/site proposal](proposals/ONTO2D_STRUCTURAL_GEOMETRY_SITE_IMPLEMENTATION.md)
is also preserved verbatim. [ADR 0130](../adr/0130-distinguishability-research-program.md)
records its adoption with explicit mathematical, compatibility and citation
corrections. Distinguishability is an analytical organizing proposal; geometry
inside one graph and distance between structures are different analysis layers.

## First milestone

- [Terms](TERMS.md) distinguish source semantics, projection, geometry and evidence.
- [Representation policies](REPRESENTATION_POLICIES.md) define full-model scope,
  exact identity, traceability and the supported graph class.
- [Metric policies](METRIC_POLICIES.md) fix the directed equation and unit baseline.
- [Claim boundaries](CLAIM_BOUNDARIES.md) state what a result establishes.
- [Benchmark protocol](BENCHMARK_PROTOCOL.md) defines controls and research gates.
- Published schemas define the closed
  [projection policy](../../packages/schemas/schemas/structural-projection-policy.schema.json),
  [metric policy](../../packages/schemas/schemas/structural-metric-policy.schema.json),
  [projection](../../packages/schemas/schemas/structural-projection.schema.json),
  [request](../../packages/schemas/schemas/structural-geometry-request.schema.json) and
  [artifact](../../packages/schemas/schemas/structural-geometry-artifact.schema.json).
- The [package](../../packages/structural-geometry/README.md) exposes projection,
  replay verification and an explicitly registered engine analysis.
- The [cases](../../cases/structural-geometry/README.md) contain synthetic controls,
  a separate Python reference implementation and a frozen full-model result.
- The [local review](REVIEW.md) records corrections, checks and remaining research.

```sh
npm run structural-geometry:check
npm run structural-geometry:report
```

The first command verifies committed results without changing them. The second
prints the full Causal Emergence summary for inspection. Generation is explicit:
`npm run structural-geometry:build`. No browser page or automatic page-load
analysis is part of this milestone.

## Stage 3: typed and local-weight experiments

The [experiment contract](METRIC_EXPERIMENTS.md) and
[ADR 0127](../adr/0127-typed-structural-metric-experiments.md) add nested necessity
regimes, all role subsets, separate relation-code channels, a source weight audit
and the explicit `inverse-target-share-v1` hypothesis. The unit foundation is
unchanged. A [72-run reference suite](../../cases/structural-geometry/experiments/README.md)
checks source replay, fixed normalization context, directed connectivity and
outward curvature bounds against a separate Python reference.

```sh
npm run structural-geometry:experiments:check
npm run structural-geometry:experiments:report
```

The stage ends with descriptive comparisons, not a promoted metric. New metrics
still need evidence of robustness and interpretability before becoming default.
The [stage-three review](EXPERIMENT_REVIEW.md) records implementation corrections
and validation evidence.

## Stage 4: certified directed Ollivier

The [Ollivier contract](OLLIVIER_CURVATURE.md) and
[ADR 0128](../adr/0128-certified-directed-ollivier-reference.md) add a bounded
external Python transport oracle, exact primal/dual verification in JavaScript,
explicit induced scopes and source-bound request caching. Unit directed distances
and incoming-source/outgoing-target measures have closed empty-neighborhood and
idleness rules. The [40-run reference suite](../../cases/structural-geometry/ollivier/README.md)
contains 242 edge calculations agreeing exactly with independent NetworkX graph
distances and network-simplex transport. The [review](OLLIVIER_REVIEW.md) records
checks and limitations.

```sh
npm run structural-geometry:ollivier:check
npm run structural-geometry:ollivier:report
```

This completes the bounded unit computational reference gate. Scientific
usefulness and full-model scalability remain separate questions.

## Stage 5: normalized shadow flow

The [flow contract](SHADOW_FLOW.md) and
[ADR 0129](../adr/0129-normalized-shadow-geometry-flow.md) add a separate positive
length state, simultaneous weighted Ollivier updates, exact metric closure and
mean-one normalization. History records distinguish fixed points, cycles,
consecutive length/curvature tolerance, iteration limits and zero-length
proposals. Optional final cuts report weak/strong components without source edits.

The [11-run suite](../../cases/structural-geometry/flow/README.md) reproduces the
published `G(3,2)` recurrence over 17 states and recovers three known groups.
Independent NetworkX replay agrees on all 68 states / 1089 edge calculations.
The [flow review](FLOW_REVIEW.md) records checks and remaining limits.

```sh
npm run structural-geometry:flow:check
npm run structural-geometry:flow:report
```

The combined geometry check includes legacy stages 0–5 and the completed
[R1 control supplement](../../cases/structural-geometry/flow-controls/README.md).
Eight directed-star runs preserve unequal normalized lengths exactly; a ninth
run separates two K4 groups at their single bridge under a frozen finite profile.
Analytic and NetworkX references agree on all 33 states / 506 edge calculations.
Use `npm run structural-geometry:flow:controls:report` to inspect those results.
R2 compatible metric providers are implemented below. Regimes, response probes
and a pseudometric precede persistence.

## R2: explicit metric providers

The [MetricProvider contract](METRIC_PROVIDERS.md) adds the `/providers` subpath:
unit and inverse-target-share values, necessity filtration, role selections and
overlapping typed channels. Verified contexts preserve full-source normalization
and bind local dictionaries. Numeric consumers reject discrete views as lengths.
Separate envelopes carry provider identity and unmodified legacy artifacts.

The [compatibility suite](../../cases/structural-geometry/providers/README.md)
checks 13 provider profiles, all 73 full-source legacy analyses and seven small
examples. Six additive schemas and readonly/browser/engine contracts have their
own [review](METRIC_PROVIDER_REVIEW.md). Ordinary entrypoints remain compatible.

```sh
npm run structural-geometry:providers:check
npm run structural-geometry:providers:report
```

## Revised subsequent gates

SG2-010 adds [regime contracts](REGIME_CONTRACTS.md): three immutable profiles,
nine mandatory observable specs and explicit bounded matching/scope policies.
The [six preparations](../../cases/structural-geometry/regimes/README.md) bind
contracts to verified sources and account for every scope-boundary edge.
They explicitly record `not-run`; measured observations use separate artifacts.
The [review](REGIME_CONTRACT_REVIEW.md) records the acceptance boundary.

```sh
npm run structural-geometry:regimes:check
npm run structural-geometry:regimes:report
```

SG2-011 adds [exact canonical observations](CANONICAL_OBSERVATIONS.md), with
17 measured artifacts and complete source mapping witnesses. Independent
permutation enumeration agrees on all 4,165 directed graphs on 1–4 nodes and
238 classes; all 720 relabelings of a six-node control preserve its value.
The [review](CANONICAL_OBSERVATION_REVIEW.md) records the bounded acceptance.

```sh
npm run structural-geometry:canonical:check
npm run structural-geometry:canonical:report
```

SG2-012 adds [directed topology observations](TOPOLOGY_OBSERVATIONS.md): seven
frozen summaries, 23 artifacts and agreement with independent matrix closure
on all 4,165 small directed graphs. Known summary collisions remain explicit;
see the [review](TOPOLOGY_OBSERVATION_REVIEW.md).

```sh
npm run structural-geometry:topology:check
npm run structural-geometry:topology:report
```

SG2-013 adds [typed observations and vocabulary alignment](TYPED_OBSERVATIONS.md):
26 observations, five source-bound maps and eight compatibility controls. Joint
matching agrees with independent permutations on 739 colored graphs / 145 classes
and 720 six-node relabelings. The [review](TYPED_OBSERVATION_REVIEW.md) records
explicit missing data, separately approved mapping hashes and preserved identities.

```sh
npm run structural-geometry:typed:check
npm run structural-geometry:typed:report
```

| Stage | Required work before acceptance |
|---|---|
| R0–R2: migration | Complete: baseline preserved, supplemental flow controls and compatible metric/filtration/channel providers verified |
| R3–R6: distinguishability | SG2-010/011/012/013 contracts, preparation, exact/topology/typed observations and vocabulary alignment complete; next comparison/coverage, probes, response signatures and pseudometric |
| R7: geometric added value | Compare response-only against response+geometry under a preregistered protocol |
| R8–R9: topology/higher order | Independently check directed persistence and explicitly reviewed joint semantics |
| R10–R11: cross-domain evaluation | Source independent candidates and freeze mappings, strong baselines, constrained nulls and held-out evaluation |
| R12: UI | Expose verified measured results with regime/coverage and claim boundaries; a narrower methods page has a separately stated readiness gate |

The [task ledger](REVISED_ROADMAP.md) tracks every SG2/SGWEB2 item. The original
stage numbers remain historical references and no longer define the next task.

Independent scientific review remains open. Separate implementations and local
tests establish computational agreement, not independent review or empirical
validation. Later work may revise or reject a hypothesis without changing source
Model Packs or the schema-v1 kernel.
