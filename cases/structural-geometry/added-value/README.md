# Prospective geometric added-value study

SG2-041, frozen local protocol v1. The [protocol](PROTOCOL.md), [configuration](config.json),
[source/pair plan](panel.json) and [verified source packs](sources.json) precede
comparative measurement. This is an offline synthetic study with exact structural
labels. It does not establish semantic similarity or external empirical utility.

```sh
npm run structural-geometry:added-value:check
npm run structural-geometry:added-value:report
```

The report verifies the entire source plan, certificates, independent numerical
locks, descriptors, seven baselines, all pairs and aggregate denominators before
printing results. It performs local response computation and certificate replay;
it does not run an external geometry solver in report mode.

## Frozen population and results

The first 32 accepted graph orbits came from 227 deterministic proposals: 194
failed the eight-arc constraint and one was disconnected. Every evaluation graph
has six vertices and eight oriented arcs. Rejected proposals remain in the plan.
There are 496 structural negative pairs, 32 source transports and three separate
development pairs, referencing 68 source packs. Transports share their base unit
and development cases do not enter evaluation denominators.

Twenty-one evaluation units have complete response signatures; all 32 have full
geometric coverage. Thus 210 negative pairs are jointly eligible, while 286 lack
complete response evidence. Adding geometry causes no additional coverage loss
on the evaluation panel. All exclusions remain in [suite.json](suite.json).

| Comparison on the same 210 pairs | Distinguished | Added splits |
|---|---:|---:|
| A: response-only | 210 / 210 | — |
| A + static Forman/Ollivier | 210 / 210 | 0 |
| B: response + all geometry | 210 / 210 | 0 |

| Baseline on the same 210 pairs | Distinguished |
|---|---:|
| Node/edge counts | 0 |
| Joint in/out-degree multiset | 210 |
| Directed topology summaries | 185 |
| Induced three-node motif census | 209 |
| Exact spectral trace invariant | 135 |
| Six-round directed color refinement | 210 |
| Exact directed canonical identity | 210 |

The primary paired gain is **0**, with no lost splits. The simple degree baseline
already separates every eligible negative. This panel therefore has a ceiling
that prevents demonstrating further discrimination. It supplies no evidence of
geometry outperforming response-only or these simpler features. It also does
not establish that geometry is useless on other populations.

There are **zero degree-matched negative pairs**. That subgroup is indeterminate,
with null rates, not a zero-effect subgroup. No pairs were added after observing
this limitation. Typed motifs and semantic role baselines are explicitly
unavailable on the untyped panel. Stronger negatives require a separately frozen
design; SG2-054 retains the later constrained-null gate.

All 32 representation transports preserve every measured feature and baseline;
21 have full A/B coverage and 11 retain missing response evidence. There are no
observed false differences. The three development graphs with complete responses
stop at exact flow fixed points before the cap and consequently have null B
distances. Their early-stop tails remain missing, including the known
response-only isolate collision. The path also lacks complete response features.

These are exact finite-panel outcomes. Pairs share source units; there are no
independent-pair confidence intervals, p-values or population generalization.
All method choices were fixed locally before scores, with no fitting, tuning or
replacement. This is not an externally registered or blinded evaluation.

## Evidence and reproduction

Each unit file stores its full response and geometric artifacts once. The suite
binds exact unit hashes and records 531 pair outcomes without duplicating those
evidence trees. Two closed schemas cover units and suite; runtime replay supplies
source authority and arithmetic checks beyond schema shape.

`measurements.py` independently regenerates all 68 numerical histories from
source records with NetworkX 3.2.1. Use the existing
[pinned requirements](../flow/requirements-reference.txt):

```sh
python -B cases/structural-geometry/added-value/measurements.py --verify
```

`reference.py` uses only the standard library and the existing independent
graph/response/descriptor references. It repeats source generation and graph
orbits, derives spectral traces through determinant coefficients/Newton identities,
checks exact motifs and refinement, and computes every paired outcome. The
normal stage check uses the frozen numerical lock, validates all source hashes
and replays descriptors and certificates. Live NetworkX was separately repeated
for acceptance.

Explicit regeneration after source/protocol review:

```sh
node cases/structural-geometry/added-value/generate.mjs --write
python -B cases/structural-geometry/added-value/measurements.py --write
python3 -B cases/structural-geometry/added-value/reference.py --write
npm run structural-geometry:added-value:build
```

The runtime writer produces files only after all independent comparisons agree.
Do not regenerate controls to improve their outcomes. Scientific errors or
resource failures abort evaluation rather than replace units or produce a
successful partial study.

## Cost

The 68 stored units contain 1,618 response observation evaluations, 1,210 response
targets, 3,126 certified transport problems and 328 flow frames. Exact baseline
work includes 46,350 full-graph and 7,830 triad permutations. Serialized unit files
occupy 54,144,607 bytes; the separate reference locks are additional files.
These counters describe per-unit analysis/baseline work; source-plan and reference
verification add overhead. Generation and certificate replay have different
costs. To record local timing:

```sh
npm run structural-geometry:added-value:report -- --timing-file /tmp/onto2d-added-value-replay.json
npm run structural-geometry:added-value:build -- --timing-file /tmp/onto2d-added-value-generation.json
```

Timing is a separate local observation with execution mode, runtime/platform and
per-unit response/geometry/baseline durations. It does not enter scientific
hashes or claim portable performance. Deterministic work and byte bounds remain
in the suite. See the [contract](../../../docs/structural-geometry/EVIDENCE.md#finite-prospective-response-versus-geometry-evaluation)
and [acceptance review](../../../docs/structural-geometry/EVIDENCE.md).
SG2-042/043 sensitivity and robustness remain open.
