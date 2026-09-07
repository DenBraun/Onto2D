# Structural invariance controls

The [protocol](PROTOCOL.md) fixes four mandatory representation controls before
result generation. The suite contains 13 source-bound artifacts: 12 passed and
one indeterminate because typed evidence is absent. Its 52 probes contain
48 passes and four indeterminate results.

The independent Python reference uses source records, exhaustive node bijections
and Boolean transitive closure. It checks transformed payload data and mappings,
observed graph orbits, topology values, missingness and strict aggregation.
The exhaustive census covers 69 directed graphs in all three regimes: 207
requests and 828 probes. Three destructive negative controls and 3,280 strict
aggregation profiles prevent interpreting constant or missing values as success.
All reference input/dependency files are SHA-256 bound.

Run from the repository root:

```sh
npm run structural-geometry:invariance:check
npm run structural-geometry:invariance:report
```

The report verifies before printing. Golden regeneration is deliberate:
`python3 -B cases/structural-geometry/invariance/reference.py --write` regenerates
independent expectations; `npm run structural-geometry:invariance:build` verifies
source bindings, independent outcomes and the census before writing artifacts.
Never update an expectation merely to silence a discrepancy.

`payloadChanged: false` on edgeless edge renaming denotes a real no-op, not an
exercised edge. Presentation is synthetic harness data; this does not replay the
site renderer. Finite computational agreement does not establish scientific
utility, physical geometry, a response signature or a similarity metric.
See the [contract](../../../docs/structural-geometry/SIGNATURES.md#measured-structural-invariance-probes).
