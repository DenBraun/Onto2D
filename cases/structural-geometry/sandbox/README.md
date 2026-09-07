# Immutable structural sandbox controls

SG2-020 supplies 51 frozen requests with 108 targets: 104 applied operations and
four rejected singleton reversals. Four edgeless edit requests are unavailable
and produce no targets. See the [protocol](PROTOCOL.md), [controls](controls.json)
and [execution contract](../../../docs/structural-geometry/SIGNATURES.md#immutable-structural-probe-sandbox).

Sources reuse existing canonical/typed fixtures and the exact Causal Emergence
release. Separate controls add a mixed reciprocal/path graph, an induced scope
with all four edge partitions and an isolate, opaque source IDs, and a 32-node
cycle with 32 exhaustive targets / 1,024 transformation edge visits.

Each deletion/reversal starts from the baseline. Deletions retain all nodes and
the original IDs of surviving shadow edges. A reciprocal pair can be reversed
simultaneously; reversing just one member would create a parallel edge and is
explicitly rejected. The mixed graph retains both rejected and applied targets.
Missing typed fields remain absent, declared sets are normalized, and reversal
does not invent a recoding of causal meaning. These are graph operations rather
than physical interventions or observed scientific responses.

The independent Python reference reconstructs source records and mappings and
applies set deletion and simultaneous endpoint reversal. It reads no production
artifact while deriving expectations. The additional exhaustive census covers
all 69 loopless directed graphs on one through three nodes under five requests:

| Nodes | Graphs | Requests | Targets | Applied | Rejected | Unavailable requests |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 5 | 1 | 1 | 0 | 4 |
| 2 | 4 | 20 | 18 | 16 | 2 | 4 |
| 3 | 64 | 320 | 574 | 478 | 96 | 4 |
| Total | 69 | 345 | 593 | 495 | 98 | 12 |

Independent digests cover full source-derived baseline/target/graph/mapping,
rejection and work records, not just success counts. Another 786 requests test
both singleton transformations under all node bijections and edge renaming.
Every target and outcome transports to the corresponding original edge. This
does not make source/shadow identifiers canonical or suitable feature coordinates.

```sh
npm run structural-geometry:sandbox:check
npm run structural-geometry:sandbox:report
```

The check verifies the 117 pinned legacy files, independent source expectations,
all 51 artifacts and the 345-request census, and runs 26 behavior/schema/browser
tests. `npm test` also discovers three reference tests. Report mode verifies
before printing execution counts and work. The [suite index](suite.json) binds
all artifacts and the independent [reference](reference.json).

For a deliberately reviewed control revision, derive the independent outcomes
before regenerating this suite:

```sh
python3 -B cases/structural-geometry/sandbox/reference.py --write
npm run structural-geometry:sandbox:build
```

The builder checks every source binding, individual outcome and census before
writing any result. Retain disagreements and change protocols explicitly; do not
rewrite earlier observation or comparison suites. The
[review](../../../docs/structural-geometry/EVIDENCE.md) records acceptance.
SG2-021/022 still supply scientific probe registries and observation adapters.
