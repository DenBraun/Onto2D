# Structural Geometry cumulative code review

Date: 2026-09-06. Scope: the complete uncommitted Structural Geometry workstream,
including new files, relative to `92db9f5e6462606aef860a5423f189899cf6a79b`.
This is a local implementation review, not independent scientific review.

## Scope reviewed

- Verified Model Pack projection, source-record bindings, directed unit Forman,
  exact weight audits, interval experiments and discrete selections.
- Ollivier request preparation, integer transport, primal/dual certificate
  acceptance, cache binding and bounded Python subprocess handling.
- Shadow flow arithmetic, simultaneous updates, metric closure, normalization,
  trajectory replay, stopping precedence and final cuts.
- MetricProvider capabilities and full-source contexts, frozen regimes, exact
  canonical observations, directed topology and joint typed observations.
- Missing typed evidence, source-local vocabulary, explicit mapping approval,
  coverage and recanonicalization after vocabulary translation.
- Runtime exports, readonly declarations, JSON schemas, portable engine/kernel
  import routing, browser replay, npm contents and workspace/CI checks.
- Scientific controls, independent reference implementations, source locks,
  preserved baselines, case builders and the operative research/site ledger.

Stored scientific JSON is checked by exact source replay and independent
references. Generated artifacts were not regenerated during this review.

## Finding and correction

**Medium: regime identifier validation disagreed with valid Model Pack sources.**
Model Packs permit nonempty identifiers containing surrounding whitespace.
Full regime preparation accepted such a source and emitted its exact node and
edge IDs, but its schema rejected those same IDs. Explicit induced selection
also rejected the exact source spelling. Every measured observation embeds this
preparation, so all three observation families inherited the inconsistency.

The regime input and preparation schemas now preserve opaque source strings,
and induced membership no longer imposes trimming. Exact membership, duplicate
rejection and source verification still apply. Selecting `a` does not select a
source node whose ID is ` a\n`.

The regression failed against the original implementation/schema and passes
after the correction. It checks full and induced canonical/topology/typed
observations, output-schema validity, expected-source replay, all four edge
partitions and source immutability. Existing invalid-request tests now classify
a differently spelled unknown ID as a scope error. Empty IDs remain invalid.

The correction does not change any frozen policy, observation specification,
case artifact, numeric result or source identity. No other actionable defect
was found in the reviewed changes.

## Verification

- `npm test`: **1,434 passed**, zero failures, cancellations or skips.
- Focused regime behavior/contracts: **20 passed**, including the regression.
- Additional local schema sweep: **200 checks passed** across connected and
  edgeless graphs, opaque attributes, whitespace/Unicode IDs, empty typed sets
  and maximum safe integer codes in all implemented observation/provider layers.
- Fresh NetworkX 3.2.1 reference verification passed: **40 Ollivier runs**, the
  **11-run / 68-state** original flow suite and **9-run / 33-state** supplement.
  The pinned network-simplex source identity was checked by each reference.
- Package dry run: **46 files**, all runtime/type export targets and both Python
  oracles included; no Python cache files.
- Baseline compatibility: **117 pinned legacy files** verified. A separate
  before/after inventory also confirms **635 source, case/reference, kernel,
  proposal and baseline files** are byte-identical to the start of this review.
- `npm run build`: **passed**, including complete geometry replay, independent
  incidence/interval/permutation/closure/analytic controls, browser and engine
  contracts, all **201 schemas**, workspace exports, TypeScript declarations,
  worker identity, kernel closure, documentation and catalogue checks.
- `git diff --check`: **passed**.

Reproduce the principal checks with:

```sh
npm test
npm run build
python3 -B docs/structural-geometry/baselines/verify_baseline.py --compatibility
```

Fresh NetworkX verification additionally requires the pinned reference
requirements and the three `networkx_reference.py --verify` commands documented
in the [Ollivier](../../cases/structural-geometry/ollivier/README.md),
[flow](../../cases/structural-geometry/flow/README.md) and
[supplement](../../cases/structural-geometry/flow-controls/README.md) case guides.

## Acceptance boundary

Local checks run on macOS arm64, Node 24.19.0 and Python 3.9.6. The configured
Linux/macOS/Windows and Node 22/24 CI matrix has not been executed by this review.
Computational agreement does not establish empirical usefulness or independent
scientific validation. SG2-014/015 comparison/coverage, probes, signatures,
pseudometrics and the public Structural Geometry page remain subsequent work
under the [operative roadmap](REVISED_ROADMAP.md).
