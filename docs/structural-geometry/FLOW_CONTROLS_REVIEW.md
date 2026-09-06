# SG2-004 supplemental flow control review

Date: 2026-09-06. Status: revised R1 computational control gate complete.
This is an implementation and arithmetic review, not independent scientific review.

## Scope and evidence

The [operative roadmap](REVISED_ROADMAP.md) required directed inward/outward-star
flow controls and two dense groups connected by one bridge before provider work.
The [new suite](../../cases/structural-geometry/flow-controls/README.md) contains
nine runs, 33 states and 506 exact per-edge calculations. It uses the existing
flow runtime, solver, closed schemas and rational semantics without changes.

The [protocol](../../cases/structural-geometry/flow-controls/PROTOCOL.md) fixes all
graphs, unequal star/unit bridge initial lengths, step, idleness, normalization,
cap, tolerance, cut and expected contrast. Input SHA-256:
`52aa6ac26060a17ab17bcd99e31a1ffd3027c88ee5d9d5fa06b68325562f02c6`.
It was written before runtime generation. The analytic writer generated its
predictions from these inputs before runtime results existed. No parameter
search or adjustment to observed bridge separation was performed.

Three computation paths agree:

1. The existing production path uses exact rational arithmetic and verifies
   primal/dual transport certificates at every state.
2. A separate standard-library Python derivation uses endpoint Dirac measures
   and three-class recurrence formulas, with explicit transport and Lipschitz
   witnesses. It imports no runtime or graph/optimization library.
3. The preserved independent NetworkX replay rebuilds Dijkstra distances,
   uniform distributions, integer-scaled network simplex costs, updates,
   normalization traces, convergence summaries, stopping and final connectivity.
   Both references verify the declared input and complete run coverage.

## Findings and interpretation

Both star orientations are fixed at iteration 1 for every combination of
step half/one and idleness zero/half. Initial lengths 1,2,3,4 normalize exactly
to 2/5,4/5,6/5,8/5 and stay there. The selected in/out neighborhoods are empty,
so each edge transports an endpoint Dirac mass to the other endpoint: `W=l`
and curvature is zero. Directed branching alone is insufficient for nonzero
curvature under this convention.

The bridge control contains two bidirected K4 groups with only `a0--b0` between
them. After the first step, the three length classes are exactly
26/7,13/14,13/21. At state 16 their lengths are approximately 4.720356,
1.379941 and 0.000000141465. The fixed strict threshold 2 cuts only `a0->b0`
and `b0->a0`, yielding the known four-node groups as both weak and strong
components. The run stops at its iteration limit. Final bridge curvature is
positive (about 0.061493); accumulated length is not the final curvature sign.

Tests establish exact threshold equality using 26/7 after one transformation:
the bridge is retained at equality and removed at threshold 2. Changing only
the final cut leaves all computed lengths, costs, curvatures and stopping
unchanged; source and input serialization stay intact. Additional rejection
tests change the expected step/idleness/cap/cut, source topology, transport
flows/potentials, length, component membership and termination.

## Compatibility and verification

The original 11-run suite and all of its artifact/reference files are unchanged.
The supplemental suite uses a distinct case index and hash domain:
`sha256:ee35bacf877b6fb6a96d95e684c2e2a3e7f10b3882a33134cc4ea70c4b248a0c`.
The [pre-regime baseline](BASELINE.md) stays frozen; compatibility mode verifies
all 117 legacy scientific inputs, schemas and golden files. Only the check
orchestration, npm scripts and CI reference coverage change outside the new
case/test files and documentation. Production code, schemas and dependencies
are unchanged by this milestone.

A comparison with all 1534 pinned files confirms that 1531 remain byte-identical.
The only three changed inventory entries are `.github/workflows/ci.yml`,
`package.json` and `scripts/check-structural-flow.mjs`, which connect the new
checks. Full-inventory mode therefore reports these three intentional changes;
compatibility mode passes. New files are additive and the inventory is retained.

Verification commands:

```sh
npm run structural-geometry:flow:controls:check
python3 -B cases/structural-geometry/flow-controls/analytic_reference.py --verify
# Use the Python executable in a venv containing pinned NetworkX 3.2.1:
python -B cases/structural-geometry/flow-controls/networkx_reference.py --verify
python3 -B docs/structural-geometry/baselines/verify_baseline.py --compatibility
npm test
npm run build
```

The supplemental check includes five behavioral/contract tests and fresh exact
runtime replay against frozen independent values. The full build includes all
legacy geometry checks plus the supplement. CI additionally runs a fresh
NetworkX replay; normal checks require only standard-library Python.
Check and report modes never rewrite artifacts. Generation uses explicit write
commands, and the independent writer requires analytic agreement first.

Observed local acceptance on macOS arm64, Node 24.19.0 and Python 3.9.6:

- `npm test`: **1308 passed**, zero failures/skips; 211.078 seconds.
- `npm run build`: passed all repository checks, including **112 geometry
  tests** (35 foundation, 23 experiments, 26 Ollivier, 23 original flow, 5
  supplemental), exact suite replay, 182 schemas, TypeScript/export boundaries,
  worker consistency and the kernel contract.
- Fresh NetworkX 3.2.1 replay: original 40 Ollivier runs, original 11 flow runs
  and all nine supplemental flow runs passed. The supplemental analytic
  reference and verified inspection command also passed.
- Legacy compatibility: all 117 pinned files passed; the full-inventory
  comparison confirmed 1531 of 1534 entries unchanged, as described above.
- Source validation: 519 JavaScript and 804 JSON files; documentation links:
  316 Markdown files; whitespace check passed.

CI coverage is configured; a hosted CI run was not executed in this session.

## Remaining limits and next task

This closes SG2-004's bounded computation and control-coverage requirement.
The published `G(3,2)` gate remains the earlier separate reproduction; the new
barbell derivation does not extend that theorem outside its parameter range.
Synthetic separation, independently reproduced arithmetic and exact star fixed
points do not establish empirical accuracy, general directed convergence or
geometric added value over graph/response baselines. The broader flow-parameter
sensitivity task remains SG2-043 at R7.

At completion of this milestone SG2-005 was next: freeze provider descriptor/context/capability contracts, add
compatible wrappers, and preserve every original public entrypoint, source
normalization rule and artifact. The new control suite also becomes a
regression gate for subsequent provider work. Website, regimes, probes and
structural comparison remain separate planned tasks.

Subsequent R2 work is recorded in [METRIC_PROVIDER_REVIEW](METRIC_PROVIDER_REVIEW.md).
The inventory counts above describe this earlier milestone; the operative
roadmap tracks the current task and later intentional implementation changes.
