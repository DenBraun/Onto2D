# Supplemental directed-star and single-bridge flow controls

Status: SG2-004 computational control gate complete, 2026-09-06.
Nine runs, 33 states and 506 exact per-edge calculations agree with the analytic
reference and independent NetworkX replay. No general community-detection or
scientific validation claim follows.

The [protocol and derivation](PROTOCOL.md) and [exact inputs](protocol.json) were
fixed before runtime artifacts were generated. The Python analytic reference
first generated [predictions](analytic-expected.json) from these inputs alone.
It uses endpoint Dirac measures for stars and a three-class transport recurrence
with explicit optimality witnesses for the bridge graph. The separate NetworkX
path recomputes all distances, transport costs, normalization, stopping and cuts.

| Control | Fixed settings | Result |
|---|---|---|
| Inward star, 4 leaves | All 4 step/idleness combinations; initial lengths 1,2,3,4; cap 8; no cut | Normalized lengths 2/5,4/5,6/5,8/5 remain fixed; all curvature 0; stop at iteration 1 |
| Outward star, 4 leaves | Same 4 combinations and initial lengths | Same fixed geometry and stopping; reversing all star arcs preserves this behavior |
| Two K4 groups with one bridge | Reciprocal arcs; unit initial lengths; step one; idleness zero; cap 16; strict final threshold 2 | Bridge lengths about 4.720356, gateway/internal about 1.379941, other internal about 0.000000141465; only the two bridge arcs are cut |

The bridge run reaches its **iteration limit**. It has not been declared
converged. Its initial bridge curvature is -1; the final bridge curvature is
about +0.061493. Final length is accumulated normalized flow, so a long bridge
does not require negative curvature at the final state. The cut recovers the
two specified four-node groups in both weak and strong connectivity views.
This is a synthetic two-group barbell, separate from the earlier published
three-group `G(3,2)` reproduction.

## Replay and inspection

```sh
npm run structural-geometry:flow:controls:check
npm run structural-geometry:flow:controls:report
```

The check recomputes the analytic expectations, solves fresh runtime trajectories,
verifies source-bound certificates and frozen NetworkX values, validates existing
schemas, tests parameter/source/evidence rejection and strict cut equality, and
checks the 117-file legacy compatibility inventory. It requires Node 22+ and
Python 3.9+ with its standard library. It never writes expected output.
Both `structural-geometry:flow:check` and `structural-geometry:check` include it.
The original `flow:report` remains the report for the original 11-run suite.

For a fresh independent optimization replay, use an isolated environment:

```sh
python3 -m venv /tmp/onto2d-flow-controls-reference
/tmp/onto2d-flow-controls-reference/bin/python -m pip install -r cases/structural-geometry/flow/requirements-reference.txt
/tmp/onto2d-flow-controls-reference/bin/python -B cases/structural-geometry/flow-controls/networkx_reference.py --verify
```

On Windows, use the venv's `Scripts/python.exe`. NetworkX 3.2.1 is a development
reference dependency. It is not required by normal checks or the runtime.
The existing independent flow replay is reused without modification; it uses
Dijkstra and integer-scaled network simplex, distinct from the production
shortest-path and successive-augmentation implementations. The reference file
and NetworkX algorithm source hashes are recorded in [networkx-expected.json](networkx-expected.json).
CI runs the fresh independent replay for both suites.

## Identity and deliberate regeneration

[suite.json](suite.json) lists all nine request and artifact identities.
Suite ID: `structural-flow-controls-v1`; suite hash:
`sha256:ee35bacf877b6fb6a96d95e684c2e2a3e7f10b3882a33134cc4ea70c4b248a0c`.
It uses the existing closed flow artifact schema; the case index has its own
hash domain `onto2d:structural-flow-controls-suite:v1` and binds the input protocol.
No new public analysis API, schema, numeric policy or Model Pack contract is added.

Regeneration is explicit and must be reviewed against the frozen protocol:

```sh
python3 -B cases/structural-geometry/flow-controls/analytic_reference.py --write
npm run structural-geometry:flow:controls:build
/tmp/onto2d-flow-controls-reference/bin/python -B cases/structural-geometry/flow-controls/networkx_reference.py --write
npm run structural-geometry:flow:controls:check
```

The analytic writer predicts from the inputs alone; its verifier also compares
all generated artifact values. The NetworkX writer requires agreement with the
analytic reference before writing. Runtime generation alone is not acceptance.
Never change a failed expectation by tuning these inputs or overwrite the
[original suite](../flow/suite.json) or [pre-regime inventory](../../../docs/structural-geometry/BASELINE.md).
All original flow artifact/reference bytes and the original suite hash remain
unchanged. The [milestone review](../../../docs/structural-geometry/FLOW_CONTROLS_REVIEW.md)
records validation and the next task.
