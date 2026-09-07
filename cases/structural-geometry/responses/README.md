# Structural response probe controls

These SG2-022 controls implement the [fixed protocol](PROTOCOL.md) and
[public contract](../../../docs/structural-geometry/SIGNATURES.md#graph-native-response-probes).
`controls.json` was fixed before measured generation. Sixteen artifacts bind
their sources, exhaustive targets, transformations, baseline/after observations,
strict coverage and diagnostic effect histograms.

Run from the repository root:

```sh
npm run structural-geometry:responses:check
npm run structural-geometry:responses:report
```

The report verifies before printing. Regenerate with
`npm run structural-geometry:responses:build` only after deliberate review of
the frozen protocol, source controls and independent expectations. The builder
checks source hashes, independent results and census agreement before writing.
`python3 -B cases/structural-geometry/responses/reference.py --help` describes
the separate reference verification/generation commands.

## What the controls show

There are 62 compatible probe results and 158 targets: 154 transformations apply
and four reversals are rejected because they would create parallel edges.
Chains, cycles, reciprocal edges, diamonds, transitive paths and mixed graphs
exercise the four response families (five probes in the typed profile).
Missing necessity leaves target selection unresolved; missing another typed
field retains selected targets and explicit observation gaps. Additional controls
cover isolates, opaque source IDs, induced boundary accounting and a verified
Causal Emergence fragment.

The typed diamond with feedback observes all five compatible probes completely.
The other 15 requests remain overall indeterminate because at least one mandatory
probe has no target, missing evidence or a rejected transformation. These are
expected disclosed outcomes, not failing implementation tests. Individual
complete responses remain available. An absent target family is not a measured
zero effect.

The maximum control has 32 cycle edges and 32 extra isolates: 64 retained nodes,
64 targets, 2,048 transformation edge visits and 65 observed graphs. It exercises
992 simple-path extensions and 1,024 reachability searches. Its support-path
probe has no eligible target, so the overall coverage stays incomplete.

## Independent checks

`reference.py` reconstructs targets and transformations from source records.
It uses Boolean transitive closure, independent path enumeration and exhaustive
node-bijection orbits from the previously independent graph references.
Expectation generation does not read production artifacts. Reference source,
controls, protocol and dependency hashes are bound in `reference.json`.
`build.mjs` independently compares every control and the full finite census.

The census includes all 69 loopless directed graphs on one through three nodes
in all three regimes: 207 requests, 759 compatible probe results, 1,438 targets,
1,144 applied transformations, 294 rejections and 300 unavailable probes.
All 341 aggregation profiles through four targets check changed, unchanged,
indeterminate and rejected states, including empty coverage and multiplicity.
Independent selector work agrees on path-extension/search counts; production
adjacency scan counts are implementation diagnostics checked against bounds.

Transport tests cover 393 requests across all small-graph node bijections plus
24 relabelings of the typed diamond with feedback. They transport node and edge
IDs, target paths, mappings, outcomes and histograms while reordering source
records and changing presentation. All 16 artifacts also replay in the browser.
See the [acceptance review](../../../docs/structural-geometry/EVIDENCE.md).
